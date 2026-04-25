/* global self, window */

// ProAccess — canonical license / subscription state derivation for LaunchPad Pro.
//
// Single source of truth for "what access level does this user have right now?".
// Pure logic on top of data.pro; no DOM, no network, no UI. Future Pro gates
// (tab access, workspace switcher, trial banners, pulsing CTA) consume this
// module. Real Dodo Payments verification will replace applyLicenseKey() later.

(function (root) {
  "use strict";

  var DAY_MS = 24 * 60 * 60 * 1000;
  var TRIAL_DURATION_MS = 7 * DAY_MS;
  var OFFLINE_GRACE_MS = 7 * DAY_MS;
  var REACTIVATION_OFFER_MS = 48 * 60 * 60 * 1000;

  // Stub Dodo Payments verification. Real verification (HTTP call to Dodo's
  // license API) lands in the Infrastructure area. Until then a single dev
  // key unlocks Pro for testing.
  var DEV_LICENSE_KEYS = {
    "LAUNCHPAD-DEV-LIFETIME": true
  };

  function defaultProBlock() {
    return {
      licenseKey: null,
      trialStartedAt: null,
      trialEndedAt: null,
      subscriptionStatus: "free",
      lastVerifiedAt: null
    };
  }

  function ensureProBlock(data) {
    if (!data.pro || typeof data.pro !== "object") {
      data.pro = defaultProBlock();
    }
    return data.pro;
  }

  function getProAccessLevel(data) {
    if (!data || !data.pro) return "free";
    var pro = data.pro;
    var status = pro.subscriptionStatus || "free";
    var now = Date.now();

    if (status === "trialing") {
      if (pro.trialStartedAt && (now - pro.trialStartedAt) < TRIAL_DURATION_MS) {
        return "trialing";
      }
      return "expired";
    }

    if (status === "active") {
      var lastVerified = pro.lastVerifiedAt || 0;
      var elapsed = now - lastVerified;
      if (elapsed < OFFLINE_GRACE_MS) return "active";
      if (elapsed < 2 * OFFLINE_GRACE_MS) return "grace";
      return "expired";
    }

    return "free";
  }

  function startTrial(data) {
    var pro = ensureProBlock(data);
    if (pro.trialEndedAt) return false; // one trial per user
    pro.trialStartedAt = Date.now();
    pro.subscriptionStatus = "trialing";
    return true;
  }

  function applyLicenseKey(data, key) {
    if (typeof key !== "string" || !key) return false;
    if (!DEV_LICENSE_KEYS[key]) return false;
    var pro = ensureProBlock(data);
    pro.licenseKey = key;
    pro.subscriptionStatus = "active";
    pro.lastVerifiedAt = Date.now();
    return true;
  }

  function clearLicense(data) {
    var pro = ensureProBlock(data);
    pro.licenseKey = null;
    pro.subscriptionStatus = "free";
    pro.lastVerifiedAt = null;
  }

  function reconcileProState(data) {
    var pro = ensureProBlock(data);
    var status = pro.subscriptionStatus || "free";
    var now = Date.now();
    var changed = false;

    if (status === "trialing") {
      if (pro.trialStartedAt && (now - pro.trialStartedAt) >= TRIAL_DURATION_MS) {
        pro.trialEndedAt = pro.trialStartedAt + TRIAL_DURATION_MS;
        pro.subscriptionStatus = "free";
        changed = true;
      }
    } else if (status === "active") {
      var lastVerified = pro.lastVerifiedAt || 0;
      if ((now - lastVerified) >= 2 * OFFLINE_GRACE_MS) {
        // Past combined grace window — drop to free. Keep licenseKey so a
        // later re-verification can restore access without re-entry.
        pro.subscriptionStatus = "free";
        changed = true;
      }
    }

    return changed;
  }

  function isReactivationOfferActive(data) {
    if (!data || !data.pro || !data.pro.trialEndedAt) return false;
    return (Date.now() - data.pro.trialEndedAt) < REACTIVATION_OFFER_MS;
  }

  function trialDaysRemaining(data) {
    if (!data || !data.pro) return 0;
    var pro = data.pro;
    if (pro.subscriptionStatus !== "trialing" || !pro.trialStartedAt) return 0;
    var elapsed = Date.now() - pro.trialStartedAt;
    var remaining = TRIAL_DURATION_MS - elapsed;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / DAY_MS);
  }

  var ProAccess = {
    TRIAL_DURATION_MS: TRIAL_DURATION_MS,
    OFFLINE_GRACE_MS: OFFLINE_GRACE_MS,
    REACTIVATION_OFFER_MS: REACTIVATION_OFFER_MS,
    getProAccessLevel: getProAccessLevel,
    startTrial: startTrial,
    applyLicenseKey: applyLicenseKey,
    clearLicense: clearLicense,
    reconcileProState: reconcileProState,
    isReactivationOfferActive: isReactivationOfferActive,
    trialDaysRemaining: trialDaysRemaining
  };

  if (typeof self !== "undefined") self.ProAccess = ProAccess;
  if (typeof window !== "undefined") window.ProAccess = ProAccess;
  if (typeof root !== "undefined" && root) root.ProAccess = ProAccess;
})(typeof globalThis !== "undefined" ? globalThis : this);
