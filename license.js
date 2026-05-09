/* global chrome */

// LicenseClient — client-side Dodo Payments license activation + validation.
//
// Per DECISIONS.md (2026-05-08 "Dodo integration architecture: client-side
// polling, no backend" and 2026-05-09 "Dodo license flow: activate then
// validate (two-step)"), this module talks directly to Dodo's public
// /licenses/* endpoints. No backend, no webhook receiver, no auth header.
//
// Two-step lifecycle: activate once per install (consuming one of the
// 3 activation slots configured per product in [1.0.5.1]), then validate
// daily. activate returns an instance_id we persist as data.pro.instanceId
// — used later for /licenses/deactivate when the user invokes the
// customer portal in [1.0.5.4], or to recover an activation slot.
//
// Network / 5xx failures during validate do NOT touch lastVerifiedAt or
// subscriptionStatus — the 7-day offline grace window is preserved so a
// Dodo outage doesn't downgrade paying users. Only explicit invalid
// responses (200 OK with valid:false, or 4xx) flip the status.

var LicenseClient = (function () {
  "use strict";

  // SWAP TO https://live.dodopayments.com IN [pre-launch Dodo Live Mode] TASK
  var DODO_API_BASE = 'https://test.dodopayments.com';
  var VALIDATE_DEBOUNCE_MS = 24 * 60 * 60 * 1000;  // 24h
  var OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;  // 7d

  // chrome.runtime.getPlatformInfo() returns {os: 'mac'|'win'|'linux'|'cros'|
  // 'android'|'openbsd'|'fuchsia'}. Mapping below covers the user-facing
  // names; openbsd / fuchsia / anything else passes through verbatim so
  // support sees the actual platform string for rare OSes.
  var OS_NAMES = {
    mac: 'Mac',
    win: 'Windows',
    linux: 'Linux',
    cros: 'ChromeOS',
    android: 'Android'
  };

  async function deriveInstanceName() {
    try {
      var info = await chrome.runtime.getPlatformInfo();
      var os = info && info.os;
      var label = (os && OS_NAMES[os]) || os || 'Browser';
      return 'LaunchPad on ' + label;
    } catch (err) {
      return 'LaunchPad on Browser';
    }
  }

  // Dodo's License Keys API uses public POST endpoints (no auth header). We
  // wrap fetch so callers get a uniform shape regardless of network failure
  // vs HTTP error vs unparseable body.
  async function postJson(path, body) {
    var url = DODO_API_BASE + path;
    var resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      return {
        status: 0,
        networkError: true,
        raw: null,
        errorMessage: (err && err.message) || 'Network error contacting Dodo.'
      };
    }
    var raw = null;
    try { raw = await resp.json(); } catch (e) { raw = null; }
    return { status: resp.status, ok: resp.ok, networkError: false, raw: raw, errorMessage: null };
  }

  // Map a non-200 result to { error, message }. Dodo's structured errors
  // (e.g., activation_limit_reached) come through as raw.error — we pass
  // the string through verbatim so callers can branch on the documented
  // error codes. Otherwise we bucket by HTTP class: http_5xx / http_400 /
  // network / unknown. The caller decides what each bucket means for state.
  function classifyError(httpResult) {
    if (httpResult.networkError) {
      return { error: 'network', message: httpResult.errorMessage || 'Network error contacting Dodo.' };
    }
    var raw = httpResult.raw;
    if (raw && typeof raw.error === 'string') {
      return {
        error: raw.error,
        message: (typeof raw.message === 'string') ? raw.message : raw.error
      };
    }
    if (httpResult.status >= 500) {
      return { error: 'http_5xx', message: 'Dodo server error (' + httpResult.status + ').' };
    }
    if (httpResult.status >= 400) {
      return { error: 'http_400', message: 'Dodo request rejected (' + httpResult.status + ').' };
    }
    return { error: 'unknown', message: 'Unexpected response from Dodo (status ' + httpResult.status + ').' };
  }

  async function activate(licenseKey) {
    var name = await deriveInstanceName();
    var result = await postJson('/licenses/activate', { license_key: licenseKey, name: name });
    // Dodo returns 201 Created on activate (the canonical REST status for
    // resource creation). Accept any 2xx with a body.id rather than strict 200.
    if (result.ok && result.raw && typeof result.raw.id === 'string') {
      return { ok: true, instanceId: result.raw.id, instanceName: name, raw: result.raw };
    }
    var classified = classifyError(result);
    return { ok: false, error: classified.error, message: classified.message, raw: result.raw };
  }

  async function validate(licenseKey) {
    var result = await postJson('/licenses/validate', { license_key: licenseKey });
    // Defensive consistency with activate/deactivate — accept any 2xx with
    // a boolean valid field. Dodo's validate has been observed at 200 to
    // date, but the relaxed check protects against future status changes.
    if (result.ok && result.raw && typeof result.raw.valid === 'boolean') {
      return { ok: true, valid: result.raw.valid, raw: result.raw };
    }
    var classified = classifyError(result);
    return { ok: false, error: classified.error, message: classified.message, raw: result.raw };
  }

  async function deactivate(licenseKey, instanceId) {
    var result = await postJson('/licenses/deactivate', {
      license_key: licenseKey,
      license_key_instance_id: instanceId
    });
    // Accept any 2xx — Dodo may return 200 or 204 No Content for deactivate.
    if (result.ok) {
      return { ok: true, raw: result.raw };
    }
    var classified = classifyError(result);
    return { ok: false, error: classified.error, message: classified.message, raw: result.raw };
  }

  // High-level orchestration. Mutates data.pro IN PLACE; caller is
  // responsible for persisting via Storage.saveAll(data). Three stages:
  //
  //   1. activate — only if data.pro.instanceId is missing. Failure here
  //      returns without mutating data.pro so the caller's state is
  //      preserved for retry.
  //   2. debounce — skip the network round-trip if a successful validation
  //      happened within VALIDATE_DEBOUNCE_MS. opts.force === true
  //      bypasses.
  //   3. validate — flips subscriptionStatus to 'active'/'invalid'.
  //
  // Validate failure handling is asymmetric:
  //   - network / 5xx / unknown 200-with-bad-shape → preserve
  //     subscriptionStatus and lastVerifiedAt (offline grace lives on)
  //   - 4xx and explicit Dodo-structured errors → flip to 'invalid' and
  //     refresh lastVerifiedAt (the user did get an answer; it was no)
  async function ensureValidated(data, licenseKey, opts) {
    opts = opts || {};
    if (!data || !licenseKey) {
      return {
        ok: false,
        stage: 'precondition',
        error: 'invalid_args',
        message: 'data and licenseKey are required.'
      };
    }
    if (!data.pro || typeof data.pro !== 'object') data.pro = {};

    if (!data.pro.instanceId) {
      var act = await activate(licenseKey);
      if (!act.ok) {
        return { ok: false, stage: 'activate', error: act.error, message: act.message };
      }
      data.pro.licenseKey = licenseKey;
      data.pro.instanceId = act.instanceId;
      data.pro.instanceName = act.instanceName;
    }

    if (!opts.force && data.pro.lastVerifiedAt &&
        (Date.now() - data.pro.lastVerifiedAt) < VALIDATE_DEBOUNCE_MS) {
      return { ok: true, cached: true, status: data.pro.subscriptionStatus };
    }

    var val = await validate(licenseKey);
    if (val.ok) {
      data.pro.subscriptionStatus = val.valid ? 'active' : 'invalid';
      data.pro.lastVerifiedAt = Date.now();
      return { ok: true, status: data.pro.subscriptionStatus, valid: val.valid };
    }
    // Transient: network outage, Dodo 5xx, or 200-with-unparseable-shape.
    // Preserve grace.
    if (val.error === 'network' || val.error === 'http_5xx' || val.error === 'unknown') {
      return { ok: false, stage: 'validate', error: val.error, message: val.message };
    }
    // 4xx or Dodo-structured error: explicit "no". Flip to invalid.
    data.pro.subscriptionStatus = 'invalid';
    data.pro.lastVerifiedAt = Date.now();
    return { ok: false, stage: 'validate', error: val.error, message: val.message };
  }

  function isWithinOfflineGrace(data) {
    if (!data || !data.pro || !data.pro.lastVerifiedAt) return false;
    return (Date.now() - data.pro.lastVerifiedAt) < OFFLINE_GRACE_MS;
  }

  return {
    DODO_API_BASE: DODO_API_BASE,
    VALIDATE_DEBOUNCE_MS: VALIDATE_DEBOUNCE_MS,
    OFFLINE_GRACE_MS: OFFLINE_GRACE_MS,
    activate: activate,
    validate: validate,
    deactivate: deactivate,
    ensureValidated: ensureValidated,
    isWithinOfflineGrace: isWithinOfflineGrace
  };
})();
