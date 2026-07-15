/*
 * tracking.js — LaunchPad Pro focus-time capture engine ([1.0.25])
 *
 * Design in docs/SPECS/tracking-engine.md; deltas in the Asana PLAN + AMENDMENT
 * (task 1216550774959099). The capture half only: no attribution, no per-day
 * rollup, no retention pruning — all [1.0.26].
 *
 * Architecture (inherited from the validated April prototype, commit 7ff8af8):
 *
 *   - WRITE-PER-EVENT. Every boundary persists immediately. No chrome.alarms
 *     flush cadence (the 30s minimum interval makes it unviable for this
 *     workload) and no in-memory buffering of pending writes.
 *   - NO DURABLE MODULE STATE. An MV3 service worker suspends after ~30s idle,
 *     so anything that must survive lives in chrome.storage, never in a
 *     module-level variable.
 *   - SESSION RECORDS LIVE OUTSIDE `data`. They go in the flat top-level
 *     `tracking_sessions` key. This is load-bearing: both background.js and
 *     newtab.js run storage.onChanged handlers keyed on `data`, and the
 *     newtab's write-provenance gate only suppresses its OWN writes — so
 *     service-worker writes pass it. Routing write-per-event capture through
 *     `data` would rebuild the context menu and re-render every open LaunchPad
 *     tab on every tab switch. Only the low-frequency, user-toggled settings
 *     (per-workspace enabled flag, global pause) live in `data`, where a
 *     re-render on change is correct.
 *
 * This module registers NO listeners at import time — background.js owns the
 * wiring. That keeps it safe to load on the newtab page (for debugSummary)
 * without double-registering handlers in every open tab, and it is why the
 * retired prototype's self-registering IIFE shape was not carried forward.
 *
 * Privacy (spec + BUGS.md G2, PLAN D8): records store the DOMAIN of the focused
 * tab and never the full URL — not in storage, not in console output. All data
 * is local; nothing is transmitted.
 *
 * Console: Tracking.debugSummary()
 */

/* global chrome, Storage, ProAccess */

(function (root) {
  "use strict";

  var STORE_KEY = "tracking_sessions";

  // Fixed at 60s in v1; user-configurable threshold is v2.1 (spec, Out of scope).
  var IDLE_DETECTION_SECONDS = 60;

  // Entitlement levels that permit capture. 'grace' is included deliberately
  // (PLAN AMENDMENT A3): the user is still entitled during the offline-grace
  // window, and focus history cannot be backfilled once the moment has passed.
  // 'expired' and 'free' stop capture; existing records are preserved untouched,
  // consistent with read-only downgrade behavior elsewhere in Pro.
  var CAPTURING_LEVELS = ["active", "trialing", "grace"];

  // Serialized op chain. Boundary events can arrive faster than a
  // read-modify-write round-trips (rapid tab switching), which would drop
  // records — the prototype hit exactly this and solved it the same way.
  //
  // Module-level, but NOT durable state: it carries no session data, only
  // ordering within a single service-worker lifetime. Losing it to a suspend is
  // harmless, since the store is re-read from chrome.storage on the next event.
  var opChain = Promise.resolve();

  function enqueue(fn) {
    opChain = opChain.then(fn).catch(function (err) {
      console.error("[LaunchPad] Tracking: queued op failed:", err);
    });
    return opChain;
  }

  function genSessionId() {
    return "sess_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function emptyStore() {
    return { open: null, sessions: [] };
  }

  async function readStore() {
    try {
      var result = await chrome.storage.local.get(STORE_KEY);
      var store = result[STORE_KEY];
      if (!store || typeof store !== "object") return emptyStore();
      if (!Array.isArray(store.sessions)) store.sessions = [];
      if (!store.open || typeof store.open !== "object") store.open = null;
      return store;
    } catch (err) {
      console.error("[LaunchPad] Tracking: store read failed:", err);
      return emptyStore();
    }
  }

  async function writeStore(store) {
    try {
      var payload = {};
      payload[STORE_KEY] = store;
      await chrome.storage.local.set(payload);
      return true;
    } catch (err) {
      console.error("[LaunchPad] Tracking: store write failed:", err);
      return false;
    }
  }

  // D1: http/https only. chrome://, chrome-extension:// (which includes
  // LaunchPad's own new tab — sitting on the dashboard is not tracked focus),
  // about:, file:, view-source: and friends all return null, which closes any
  // open session and opens nothing.
  function domainOf(url) {
    if (!url) return null;
    try {
      var u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.hostname || null;
    } catch (e) {
      return null;
    }
  }

  // D4: gates evaluated per-event and statelessly — one read of `data`, three
  // checks, no cached verdict. Any failure closes the open session and opens
  // nothing; the returned reason becomes that record's closedBy.
  function evaluateGates(data) {
    if (!data) return { ok: false, reason: "no-data" };

    var level;
    try {
      level = ProAccess.getProAccessLevel(data);
    } catch (e) {
      console.error("[LaunchPad] Tracking: entitlement check failed:", e);
      return { ok: false, reason: "entitlement-lost" };
    }
    if (CAPTURING_LEVELS.indexOf(level) === -1) return { ok: false, reason: "entitlement-lost" };

    // Manual pause. Idle never writes this flag — a user who manually paused
    // stays paused after returning to the keyboard (spec, Manual pause).
    if (Storage.isTrackingPaused(data)) return { ok: false, reason: "paused" };

    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return { ok: false, reason: "no-workspace" };
    if (!Storage.isTrackingEnabled(ws)) return { ok: false, reason: "tracking-disabled" };

    return { ok: true, workspaceId: ws.id };
  }

  // D2: one open session GLOBALLY, not one per window. The OS-focused Chrome
  // window's active tab owns it. getLastFocused().focused reads false when no
  // Chrome window holds OS focus, which is how windows.onFocusChanged's
  // WINDOW_ID_NONE resolves here without persisting any focus state of our own.
  async function focusedTrackableDomain() {
    try {
      var win = await chrome.windows.getLastFocused({ populate: false });
      if (!win || win.focused !== true) return { domain: null, reason: "window-blur" };

      var tabs = await chrome.tabs.query({ active: true, windowId: win.id });
      var tab = tabs && tabs[0];
      if (!tab) return { domain: null, reason: "no-active-tab" };

      var domain = domainOf(tab.url);
      if (!domain) return { domain: null, reason: "not-trackable" };
      return { domain: domain, reason: null };
    } catch (err) {
      console.error("[LaunchPad] Tracking: focused-tab query failed:", err);
      return { domain: null, reason: "query-failed" };
    }
  }

  // What SHOULD be open right now. Every boundary resolves through this one
  // function and the caller diffs it against what IS open — so tab switch,
  // domain change, window focus, workspace switch, gate flip and active-task
  // change are all the same code path rather than six bespoke handlers.
  async function computeDesired(data, idleState) {
    // Idle/locked: nothing is open regardless of what tab is focused.
    if (idleState && idleState !== "active") return { session: null, reason: "idle" };

    var gate = evaluateGates(data);
    if (!gate.ok) return { session: null, reason: gate.reason };

    var focus = await focusedTrackableDomain();
    if (!focus.domain) return { session: null, reason: focus.reason };

    return {
      reason: null,
      session: {
        workspaceId: gate.workspaceId,
        domain: focus.domain,
        // Stamped as-is: null until [1.0.16] ships setActiveTask, and
        // attribution ([1.0.26]) simply skips a null. The spec's active-task
        // boundary needs no special handling — data.activeTask lives in `data`,
        // so the storage watcher fires on change and sameSession() sees the
        // mismatch, closing and reopening exactly like any other boundary.
        activeTaskId: (data && data.activeTask) || null
      }
    };
  }

  function sameSession(open, desired) {
    return open.domain === desired.domain &&
      open.workspaceId === desired.workspaceId &&
      (open.activeTaskId || null) === (desired.activeTaskId || null);
  }

  // Closes the open session into the record list.
  //
  // Record shape per spec, minus tagIds/bookmarkId: those are attribution,
  // which the spec stamps at close and which [1.0.26] owns. They are omitted
  // rather than written null so [1.0.26] can add them without reinterpreting
  // this task's rows.
  //
  // Sub-millisecond records are dropped: two events in the same millisecond
  // describe no elapsed focus, so the row carries no information. That is not
  // retention policy ([1.0.26]) — it is declining to store degenerate rows.
  function closeOpenInto(store, end, closedBy) {
    var open = store.open;
    store.open = null;
    if (!open) return false;
    if (!(end > open.start)) return false;

    store.sessions.push({
      id: open.id,
      workspaceId: open.workspaceId,
      domain: open.domain,
      start: open.start,
      end: end,
      activeTaskId: open.activeTaskId || null,
      closedBy: closedBy || "unknown"
    });
    return true;
  }

  async function syncInner(trigger, idleHint) {
    var idleState = idleHint || (await currentIdleState());
    var data = await Storage.getAll();
    var store = await readStore();
    var desired = await computeDesired(data, idleState);

    // Sample the clock HERE — after the gate and focused-tab observation, not
    // before it and not at the moment the event fired.
    //
    // State and time must come from the same instant. This function re-derives
    // the focused tab rather than trusting an event payload, so the honest
    // timestamp for that observation is when the observation actually happened.
    // Reading the clock any earlier pairs state from one moment with a clock
    // reading from another: every await above (queue wait, two storage
    // round-trips) widens the gap, and the result is session records that claim
    // to start before the user ever reached the domain they describe. Under a
    // burst of boundaries that skew is easily tens of milliseconds.
    var now = Date.now();
    var changed = false;

    if (store.open) {
      if (!desired.session || !sameSession(store.open, desired.session)) {
        // A gate failure names itself (paused / tracking-disabled / idle / ...);
        // otherwise the firing event names the boundary.
        closeOpenInto(store, now, desired.session ? trigger : desired.reason);
        changed = true;
      } else if (store.open.lastEventAt !== now) {
        // Same session continues. Refresh the last-known-event stamp — this is
        // the timestamp orphan reconciliation falls back to if the browser dies.
        store.open.lastEventAt = now;
        changed = true;
      }
    }

    if (!store.open && desired.session) {
      store.open = {
        id: genSessionId(),
        workspaceId: desired.session.workspaceId,
        domain: desired.session.domain,
        start: now,
        activeTaskId: desired.session.activeTaskId,
        lastEventAt: now
      };
      changed = true;
    }

    if (changed) await writeStore(store);
    return changed;
  }

  async function currentIdleState() {
    try {
      return await chrome.idle.queryState(IDLE_DETECTION_SECONDS);
    } catch (e) {
      // Fail open: capture rather than silently stopping on an API hiccup.
      return "active";
    }
  }

  // The universal boundary handler. Every listener funnels through here; the
  // queue guarantees one read-modify-write at a time (see opChain).
  function sync(trigger, idleHint) {
    return enqueue(function () { return syncInner(trigger, idleHint); });
  }

  // Spec: an open session orphaned by browser or SW death is reconciled on SW
  // startup from the LAST-KNOWN event timestamp — deliberately not from `now`.
  // The gap between the last observed event and the browser dying is unknown,
  // and closing at `now` would fabricate focus time the user may never have
  // spent. The honest floor is what we last saw.
  //
  // Note this does NOT fire on a mere SW suspend/wake: neither onStartup nor
  // onInstalled fires for that, so an open session correctly survives a suspend
  // and closes at the next real boundary event with its true end time.
  async function reconcileOrphansInner() {
    var store = await readStore();
    if (!store.open) return false;

    var domain = store.open.domain;
    var end = store.open.lastEventAt || store.open.start;
    var kept = closeOpenInto(store, end, "orphan-reconciled");
    await writeStore(store);
    console.log("[LaunchPad] Tracking: reconciled orphaned session on " + domain +
      (kept ? "" : " (zero-duration, dropped)"));
    return true;
  }

  function reconcileOrphans() {
    return enqueue(reconcileOrphansInner);
  }

  // D5: engine start. Reconcile any orphan, then open a session for the
  // currently focused tab if the gates pass — so capture begins at once rather
  // than waiting for the user's first tab switch. Both steps ride the same
  // queue so a boundary event arriving mid-start cannot interleave.
  function start() {
    try {
      chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);
    } catch (e) {
      console.error("[LaunchPad] Tracking: setDetectionInterval failed:", e);
    }
    return enqueue(async function () {
      await reconcileOrphansInner();
      await syncInner("engine-start", null);
    });
  }

  // Local calendar day, NOT UTC.
  //
  // This contrast is deliberate and the spec requires it documented where the
  // day key is computed. Task due dates are UTC-normalized (the [1.0.13]
  // lesson) because a due date is a calendar commitment that must mean the same
  // instant everywhere. A focus day answers "what did I actually do today",
  // which is a question about the user's lived day — so it follows local time.
  // The [1.0.26] per-day aggregates inherit this rule.
  function startOfLocalDay(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function localDayKey(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function msToMinutes(ms) {
    return Math.round((ms / 60000) * 100) / 100;
  }

  // Primary observability surface for the capture phase (spec, Surfaces v1).
  // Domains only, never URLs, including in console output (D8 / G2) — the
  // records hold no URL to leak in the first place.
  async function debugSummary() {
    var store = await readStore();
    var dayStart = startOfLocalDay();
    var today = store.sessions.filter(function (s) { return s.start >= dayStart; });

    var byDomainMs = {};
    var totalMs = 0;
    var longestMs = 0;
    today.forEach(function (s) {
      var ms = (s.end || 0) - (s.start || 0);
      if (!(ms > 0)) return;
      byDomainMs[s.domain] = (byDomainMs[s.domain] || 0) + ms;
      totalMs += ms;
      if (ms > longestMs) longestMs = ms;
    });

    var byDomain = {};
    Object.keys(byDomainMs)
      .sort(function (a, b) { return byDomainMs[b] - byDomainMs[a]; })
      .forEach(function (d) { byDomain[d] = msToMinutes(byDomainMs[d]); });

    var bytesInUse = null;
    try {
      bytesInUse = await chrome.storage.local.getBytesInUse(STORE_KEY);
    } catch (e) {
      // getBytesInUse is unavailable in some contexts; the rest still reports.
    }

    var open = null;
    if (store.open) {
      open = {
        domain: store.open.domain,
        workspaceId: store.open.workspaceId,
        activeTaskId: store.open.activeTaskId || null,
        startedAt: new Date(store.open.start).toISOString(),
        elapsedMinutes: msToMinutes(Date.now() - store.open.start)
      };
    }

    var out = {
      day: localDayKey(),
      openSession: open,
      sessionsToday: today.length,
      focusedMinutesToday: msToMinutes(totalMs),
      longestSessionMinutesToday: msToMinutes(longestMs),
      byDomainToday: byDomain,
      totalSessionsStored: store.sessions.length,
      // Unpruned until [1.0.26] lands retention (D6) — this is how growth stays
      // observable in the meantime.
      bytesInUse: bytesInUse
    };

    console.log("[LaunchPad] Tracking summary:", out);
    return out;
  }

  var Tracking = {
    STORE_KEY: STORE_KEY,
    IDLE_DETECTION_SECONDS: IDLE_DETECTION_SECONDS,
    CAPTURING_LEVELS: CAPTURING_LEVELS,

    start: start,
    sync: sync,
    reconcileOrphans: reconcileOrphans,
    debugSummary: debugSummary,

    // Exposed for the Section I console harness — verification needs to drive
    // the gates and the store directly without waiting on real Chrome events.
    _domainOf: domainOf,
    _evaluateGates: evaluateGates,
    _computeDesired: computeDesired,
    _readStore: readStore,
    _writeStore: writeStore,
    _emptyStore: emptyStore,
    _startOfLocalDay: startOfLocalDay
  };

  if (typeof self !== "undefined") self.Tracking = Tracking;
  if (typeof window !== "undefined") window.Tracking = Tracking;
  if (typeof root !== "undefined" && root) root.Tracking = Tracking;
})(typeof globalThis !== "undefined" ? globalThis : this);
