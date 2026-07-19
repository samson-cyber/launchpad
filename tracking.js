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

  // [1.0.26] Per-day aggregates. Flat top-level key for the same reason session
  // records are: anything written per-event into `data` re-renders every open
  // LaunchPad tab and rebuilds the context menu. Keyed `${workspaceId}:${day}`,
  // so aggregates are per-workspace by construction and a future combined view
  // just sums keys.
  var DAYS_KEY = "tracking_days";

  // Spec: session records prune at 30 days; per-day aggregates keep forever.
  // Because aggregates roll up on write, pruning raw records never loses
  // history. Pruning runs on SW startup — no alarm (write-per-event, D6).
  var RETENTION_DAYS = 30;
  var DAY_MS = 24 * 60 * 60 * 1000;

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
    return persist(store, null);
  }

  async function readDays() {
    try {
      var result = await chrome.storage.local.get(DAYS_KEY);
      var days = result[DAYS_KEY];
      if (!days || typeof days !== "object") return {};
      return days;
    } catch (err) {
      console.error("[LaunchPad] Tracking: day-aggregate read failed:", err);
      return {};
    }
  }

  async function writeDays(days) {
    return persist(null, days);
  }

  // [1.0.26] Single write for both keys.
  //
  // This is what makes D3's idempotency real: the day-aggregate increment and
  // the session's `aggregated: true` stamp MUST land together. chrome.storage's
  // set() is atomic across the keys in one call, so a crash can never leave an
  // incremented aggregate with an unstamped session (double-count on next run)
  // or a stamped session with no increment (silently lost time). Pass null for
  // either side to leave that key untouched.
  async function persist(store, days) {
    try {
      var payload = {};
      if (store) payload[STORE_KEY] = store;
      if (days) payload[DAYS_KEY] = days;
      if (!Object.keys(payload).length) return false;
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
        // TWO DIFFERENT SHAPES, one name. `data.activeTask` is an OBJECT —
        // {taskId, workspaceId, startedAt, ...} per tasks-and-goals.md — while a
        // session stamps the BARE id per tracking-engine.md. Read `.taskId`,
        // never the object itself.
        //
        // Stamping the object breaks three things at once, none of them loudly:
        // sameSession() compares this field with ===, and two deserialized
        // objects are never identical, so every boundary would close and reopen
        // the session (and the lastEventAt heartbeat below would be
        // unreachable); rollup would key byTask by "[object Object]", collapsing
        // every task's time into one bucket; and getTaskById() would resolve
        // null, silently dropping the active task's tags from attribution.
        //
        // This read was written when nothing populated data.activeTask, so
        // `undefined || null` made it correct-by-accident until [1.0.16] shipped
        // setActiveTask.
        //
        // The active-task boundary itself needs no special handling —
        // data.activeTask lives in `data`, so the storage watcher fires on
        // change and sameSession() sees the mismatch, closing and reopening
        // exactly like any other boundary.
        activeTaskId: (data && data.activeTask && data.activeTask.taskId) || null
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

  // ===== [1.0.26] Attribution =====
  //
  // Does a bookmark point at this domain? Matches the shortcut's own URL, and
  // also its variants'.
  //
  // Variants matter more than they look. background.js auto-nests bookmarks by
  // DOMAIN_ALIASES, which deliberately groups DIFFERENT hostnames under one
  // parent: sheets.google.com nests under a docs.google.com parent,
  // outlook.office.com under outlook.live.com. Variants carry URLs but no tags
  // of their own (nothing can tag them — findItemByContext only resolves
  // "group" and "shortcut"). So matching top-level URLs only would silently
  // drop the tags on exactly the bookmarks a user was most deliberate about:
  // tag "Google Docs" as Work, then get nothing for time spent in Sheets.
  //
  // A variant hit therefore attributes its PARENT — the parent's tags, and the
  // parent's id as bookmarkId. The parent is the tagged, user-facing entity;
  // the variant is a nesting detail.
  function shortcutMatchesDomain(shortcut, domain) {
    if (!shortcut || !domain) return false;
    if (domainOf(shortcut.url) === domain) return true;
    var variants = shortcut.variants || [];
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (v && !v.deletedAt && domainOf(v.url) === domain) return true;
    }
    return false;
  }

  // Every live bookmark in `ws` whose URL (or a variant's) is on `domain`.
  // Each parent appears at most once however many of its URLs match.
  function matchingBookmarks(ws, domain) {
    var out = [];
    if (!ws || !domain) return out;
    (ws.groups || []).forEach(function (g) {
      if (!g || g.deletedAt) return;
      (g.shortcuts || []).forEach(function (s) {
        if (!s || s.deletedAt) return;
        if (shortcutMatchesDomain(s, domain)) out.push(s);
      });
    });
    return out;
  }

  // D1: stamp attribution onto the record.
  //
  //   tagIds     = deduped union of every matching bookmark's tags and the
  //                active task's tags.
  //   bookmarkId = the match, but ONLY when exactly one bookmark matched.
  //                Zero or ambiguous both store null rather than guessing.
  //
  // Trashed never attributes: getTagById and getTaskById both return null for a
  // soft-deleted row, so routing every tag through addTag and the task through
  // getTaskById filters them for free — and keeps filtering if the trash bin
  // later extends to bookmarks (groups/shortcuts/variants already carry
  // deletedAt as a model field; nothing soft-deletes them today, and the
  // guards above are defensive on purpose).
  function attributeSession(session, data) {
    var ws = Storage.resolveWorkspaceFromData(data, session.workspaceId);

    var tagIds = [];
    var seen = {};
    function addTag(tid) {
      if (!tid || seen[tid]) return;
      if (!Storage.getTagById(ws, tid)) return; // unknown or trashed
      seen[tid] = true;
      tagIds.push(tid);
    }

    var matches = matchingBookmarks(ws, session.domain);
    matches.forEach(function (s) { (s.tagIds || []).forEach(addTag); });

    // The task may have been trashed between capture and close (or, for
    // backfill, since capture) — resolve defensively rather than trusting the
    // stamped id.
    if (session.activeTaskId && ws) {
      var task = Storage.getTaskById(ws, session.activeTaskId);
      if (task) (task.tagIds || []).forEach(addTag);
    }

    session.tagIds = tagIds;
    session.bookmarkId = matches.length === 1 ? matches[0].id : null;
    return session;
  }

  // ===== [1.0.26] Per-day rollup =====

  function emptyDay(dayKey, workspaceId) {
    return {
      day: dayKey,
      workspaceId: workspaceId,
      totalFocusedMs: 0,
      byDomain: {},
      byTag: {},
      byTask: {},
      longestSessionMs: 0
    };
  }

  function dayAggregateKey(workspaceId, dayKey) {
    return workspaceId + ":" + dayKey;
  }

  function startOfNextLocalDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  // D4: split a session across every local midnight it crosses.
  //
  // Generic in the number of boundaries — a session left open over a weekend
  // yields a segment per day, not a special case. Walks local midnights via
  // Date rather than adding 24h, so DST-short and DST-long days split at their
  // real boundaries. Each step is strictly forward (the next local midnight is
  // always after the cursor), so this cannot spin.
  function splitAcrossLocalDays(start, end) {
    var out = [];
    var cursor = start;
    while (cursor < end) {
      var boundary = Math.min(end, startOfNextLocalDay(cursor));
      out.push({ dayKey: localDayKey(cursor), ms: boundary - cursor });
      cursor = boundary;
    }
    return out;
  }

  // Roll one session into the day aggregates and stamp it.
  //
  // The stamp is the entire idempotency mechanism (D3): a session contributes
  // exactly once, ever. It is set here and persisted in the same write as the
  // increments, so this is safe to call on every session on every run.
  function rollupSessionInto(days, session) {
    if (!session || session.aggregated) return false;

    var duration = (session.end || 0) - (session.start || 0);
    if (!(duration > 0)) {
      // Contributes nothing. Stamp anyway so it is not rescanned forever.
      session.aggregated = true;
      return true;
    }

    splitAcrossLocalDays(session.start, session.end).forEach(function (seg, i) {
      var key = dayAggregateKey(session.workspaceId, seg.dayKey);
      var agg = days[key] || emptyDay(seg.dayKey, session.workspaceId);

      agg.totalFocusedMs += seg.ms;
      agg.byDomain[session.domain] = (agg.byDomain[session.domain] || 0) + seg.ms;
      (session.tagIds || []).forEach(function (t) {
        agg.byTag[t] = (agg.byTag[t] || 0) + seg.ms;
      });
      if (session.activeTaskId) {
        agg.byTask[session.activeTaskId] = (agg.byTask[session.activeTaskId] || 0) + seg.ms;
      }

      // D4: longestSessionMs is the FULL un-split duration, recorded on the
      // START day only. A 40-minute stretch across midnight is one 40-minute
      // stretch, not two shorter ones — the metric answers "how long did you
      // focus without breaking", which a calendar boundary does not interrupt.
      if (i === 0 && duration > agg.longestSessionMs) agg.longestSessionMs = duration;

      days[key] = agg;
    });

    session.aggregated = true;
    return true;
  }

  // Attribute + roll up every unstamped session.
  //
  // This is deliberately ONE function serving both D3 (rollup at close) and D5
  // (backfill of records that predate this task). The close path is just
  // backfill with a backlog of one, so there is no second code path that could
  // drift — and idempotency is structural rather than a rule to remember.
  //
  // Backfill attributes with CURRENT tag/bookmark mappings (D5): a tag added
  // since capture applies retroactively. Accepted and noted — for a backlog of
  // hours it is immaterial, and the alternative (never attributing old rows)
  // is worse.
  function rollupUnaggregated(store, days, data) {
    var rolled = 0;
    (store.sessions || []).forEach(function (s) {
      if (s.aggregated) return;
      attributeSession(s, data);
      if (rollupSessionInto(days, s)) rolled++;
    });
    return rolled;
  }

  function hasUnaggregated(store) {
    return (store.sessions || []).some(function (s) { return !s.aggregated; });
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

    // [1.0.26] Roll up whatever the close above produced, in the SAME write.
    //
    // The day-aggregate read is skipped entirely when there is nothing to roll
    // up, so a heartbeat-only sync still costs exactly what it did in [1.0.25].
    // In steady state the backlog here is the single session just closed.
    var days = null;
    if (hasUnaggregated(store)) {
      days = await readDays();
      if (rollupUnaggregated(store, days, data)) changed = true;
      else days = null;
    }

    if (changed) await persist(store, days);
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

  // [1.0.26] Startup backfill + retention (D5 + D6). No alarm: SW startup
  // cadence is enough for a 30-day window, and tracking adds no alarms by
  // design (write-per-event).
  //
  // Order is load-bearing. The backfill runs FIRST, so a session older than 30
  // days that was never rolled up gets attributed and counted before the prune
  // considers it — its time lands in the aggregate (kept forever) and only then
  // does the raw row go. D6's "roll up first, then prune" is therefore
  // structural rather than a sequencing rule someone must remember.
  //
  // The prune only ever removes STAMPED sessions. If a rollup somehow failed
  // for one row, that row survives instead of being silently discarded —
  // failure loses a prune, never data.
  async function rollupAndPruneInner() {
    var data = await Storage.getAll();
    var store = await readStore();
    var days = await readDays();

    var rolled = rollupUnaggregated(store, days, data);

    var cutoff = Date.now() - RETENTION_DAYS * DAY_MS;
    var before = (store.sessions || []).length;
    store.sessions = (store.sessions || []).filter(function (s) {
      if (!s.aggregated) return true;   // never prune un-rolled-up data
      return s.start >= cutoff;
    });
    var pruned = before - store.sessions.length;

    if (rolled || pruned) {
      await persist(store, rolled ? days : null);
      console.log("[LaunchPad] Tracking: rolled up " + rolled + " session(s), pruned " + pruned +
        " past " + RETENTION_DAYS + "-day retention");
    }
    return { rolled: rolled, pruned: pruned };
  }

  function rollupAndPrune() {
    return enqueue(rollupAndPruneInner);
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
      // [1.0.26] After reconciling — the orphan just closed is itself an
      // unstamped session, so it rolls up in the same pass as the backlog.
      await rollupAndPruneInner();
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

  // ===== [1.0.16] Read surface =====
  //
  // The active-task widget's focused-time readout. The first thing outside the
  // engine to read tracking data, so it is a deliberate contract rather than
  // the UI reaching into storage keys — debugSummary is console-shaped (minutes,
  // display labels) and unusable here.
  //
  // Returns the two halves of the number separately, on purpose:
  //
  //   { baseMs, openSince }   live total = baseMs + (openSince ? now - openSince : 0)
  //
  // The engine writes ONLY at boundaries — no alarm, no heartbeat, nothing
  // polls. So between boundaries `open.start` is fixed and storage is provably
  // static: the caller can tick a smooth 1s clock off `openSince` locally with
  // no writer racing its interpolation, and re-read only when a
  // storage.onChanged fires for our keys. Handing back a single `totalMs` would
  // force a storage read per tick to animate.
  //
  // SUMS ACROSS EVERY WORKSPACE's aggregate for today, which is required, not
  // defensive. Aggregates are keyed `${workspaceId}:${day}` from the session's
  // workspaceId — the workspace that was ACTIVE at capture. The active task is
  // global and may belong to a different workspace (the widget's cross-workspace
  // state), so its time lands under whichever workspace the user was browsing
  // in. Reading only the task's own workspace would show 0 for a foreign task.
  //
  // No double-count: byTask counts only sessions stamped `aggregated`, the
  // unaggregated term counts only those without the stamp, and the open session
  // is in neither list until it closes. Close + rollup land in ONE atomic
  // write, so the handover is seamless in both directions.
  async function focusedTodayForTask(taskId) {
    if (!taskId) return { baseMs: 0, openSince: null };

    var days = await readDays();
    var store = await readStore();
    var today = localDayKey();
    var baseMs = 0;

    Object.keys(days).forEach(function (k) {
      var agg = days[k];
      if (!agg || agg.day !== today) return;
      baseMs += (agg.byTask && agg.byTask[taskId]) || 0;
    });

    // Closed but not yet rolled up. Steady state is none of these (rollup rides
    // the closing write), but a failed rollup or a pre-[1.0.26] record would
    // otherwise make the readout jump backwards at the close and forwards again
    // at the next startup backfill.
    (store.sessions || []).forEach(function (s) {
      if (!s || s.aggregated) return;
      if ((s.activeTaskId || null) !== taskId) return;
      splitAcrossLocalDays(s.start, s.end).forEach(function (seg) {
        if (seg.dayKey === today) baseMs += seg.ms;
      });
    });

    // Clamp to today's start: a session left open across local midnight has
    // already contributed yesterday's share to yesterday's aggregate (D4 splits
    // at every midnight it crosses), so counting from its true start would
    // re-add that time to today.
    var openSince = null;
    if (store.open && (store.open.activeTaskId || null) === taskId) {
      openSince = Math.max(store.open.start, startOfLocalDay());
    }

    return { baseMs: baseMs, openSince: openSince };
  }

  // [1.0.20] WHOLE-DAY focused total. The Dashboard's "Today: Xh Ym focused"
  // line, and the second public read contract on this namespace.
  //
  // focusedTodayForTask answers "how long on THIS task"; there was no reader for
  // "how long today", and the UI is not allowed to reach for _readDays /
  // _dayAggregateKey to get it — those are console-harness hooks by their own
  // label. Same reasoning that produced the per-task reader: a deliberate
  // contract rather than the UI reaching into storage keys.
  //
  // SCOPE. `workspaceId` scopes to one workspace; `null` means COMBINED — every
  // workspace summed. Day aggregates are keyed workspaceId:dayKey, so the
  // combined case is the same walk with the id test dropped, which is exactly
  // why this is ONE implementation with two public names rather than two
  // functions: the subtle part (the open-session clamp) must not be written
  // twice. combinedAnalyticsEnabled picks which name the Dashboard calls.
  //
  // Returns the same two halves as the per-task reader, for the same reason:
  // baseMs is settled (rolled-up + closed-but-unaggregated), openSince is the
  // clamped start of the open session so a caller can tick without re-reading.
  //
  // OPEN-SESSION ATTRIBUTION. openSince is non-null ONLY when the open session
  // belongs to the queried scope — an open session in Personal must not lift
  // Work's number. In combined mode any open session qualifies.
  //
  // The clamp to startOfLocalDay is load-bearing and matches the per-task
  // reader: a session left open across local midnight has already contributed
  // yesterday's share to yesterday's aggregate (splitAcrossLocalDays splits at
  // every midnight it crosses), so counting from its true start would re-add it.
  async function focusedTodayForScope(workspaceId) {
    var combined = (workspaceId == null);

    var days = await readDays();
    var store = await readStore();
    var today = localDayKey();
    var baseMs = 0;

    Object.keys(days).forEach(function (k) {
      var agg = days[k];
      if (!agg || agg.day !== today) return;
      if (!combined && agg.workspaceId !== workspaceId) return;
      baseMs += agg.totalFocusedMs || 0;
    });

    // Closed but not yet rolled up — mirrors the per-task reader's second term.
    // Steady state is none of these (rollup rides the closing write); a failed
    // rollup would otherwise make the line jump backwards then forwards again.
    (store.sessions || []).forEach(function (s) {
      if (!s || s.aggregated) return;
      if (!combined && s.workspaceId !== workspaceId) return;
      splitAcrossLocalDays(s.start, s.end).forEach(function (seg) {
        if (seg.dayKey === today) baseMs += seg.ms;
      });
    });

    var openSince = null;
    if (store.open && (combined || store.open.workspaceId === workspaceId)) {
      openSince = Math.max(store.open.start, startOfLocalDay());
    }

    return { baseMs: baseMs, openSince: openSince };
  }

  function focusedTodayForWorkspace(workspaceId) {
    return focusedTodayForScope(workspaceId || null);
  }

  function focusedTodayCombined() {
    return focusedTodayForScope(null);
  }

  function msToMinutes(ms) {
    return Math.round((ms / 60000) * 100) / 100;
  }

  // Primary observability surface for the capture phase (spec, Surfaces v1).
  // Domains only, never URLs, including in console output (D8 / G2) — the
  // records hold no URL to leak in the first place.
  // Sort an ms-keyed map descending and convert to minutes for reading.
  // `label` optionally rewrites each key for display — see labelForTag/Task.
  function toMinutesDesc(msMap, label) {
    var out = {};
    Object.keys(msMap || {})
      .sort(function (a, b) { return msMap[b] - msMap[a]; })
      .forEach(function (k) { out[label ? label(k) : k] = msToMinutes(msMap[k]); });
    return out;
  }

  // [Polish] byTag/byTask keys are ids, which are unreadable in the console —
  // you cannot tell which tag you just attributed time to. Resolve them to
  // "Name (id)" for DISPLAY ONLY; the stored aggregates keep bare ids.
  //
  // The id stays in the label deliberately: it disambiguates same-named tags and
  // keeps the output greppable against raw storage.
  //
  // Falling back to the bare id is a real path, not a formality. Aggregates are
  // immutable history kept forever, while getTagById returns null once a tag is
  // trashed — and the trash purge sweeps dead tag ids off shortcuts and tasks
  // but never touches tracking_days. So a tag deleted (or purged) after its
  // sessions rolled up leaves an id here that resolves to nothing, forever.
  // Showing the id beats showing "undefined".
  function labelWithId(named, id) {
    return named && named.name ? named.name + " (" + id + ")" : id;
  }

  function labelForTag(ws, tagId) {
    return labelWithId(Storage.getTagById(ws, tagId), tagId);
  }

  function labelForTask(ws, taskId) {
    return labelWithId(Storage.getTaskById(ws, taskId), taskId);
  }

  async function debugSummary() {
    var store = await readStore();
    var days = await readDays();
    var data = await Storage.getAll();
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

    var byDomain = toMinutesDesc(byDomainMs);

    // [1.0.26] Today's stored aggregate for the ACTIVE workspace, read back
    // from tracking_days rather than recomputed — so this reports what the
    // rollup actually wrote, and disagreement with the raw session figures
    // above is itself the signal.
    var activeWs = Storage.getActiveWorkspace(data);
    var todayAgg = null;
    if (activeWs) {
      var stored = days[dayAggregateKey(activeWs.id, localDayKey())];
      if (stored) {
        todayAgg = {
          day: stored.day,
          workspaceId: stored.workspaceId,
          focusedMinutes: msToMinutes(stored.totalFocusedMs || 0),
          longestSessionMinutes: msToMinutes(stored.longestSessionMs || 0),
          byDomain: toMinutesDesc(stored.byDomain),
          // Names resolved against the aggregate's own workspace — which is the
          // active one here by construction, since todayAgg is keyed on it.
          byTag: toMinutesDesc(stored.byTag, function (id) { return labelForTag(activeWs, id); }),
          byTask: toMinutesDesc(stored.byTask, function (id) { return labelForTask(activeWs, id); })
        };
      }
    }

    var bytesInUse = null;
    var bytesInUseDays = null;
    try {
      bytesInUse = await chrome.storage.local.getBytesInUse(STORE_KEY);
      bytesInUseDays = await chrome.storage.local.getBytesInUse(DAYS_KEY);
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

      // Raw session view (what capture recorded today).
      sessionsToday: today.length,
      focusedMinutesToday: msToMinutes(totalMs),
      longestSessionMinutesToday: msToMinutes(longestMs),
      byDomainToday: byDomain,

      // [1.0.26] Rolled-up view (what aggregation stored for today, active
      // workspace). Null before the first session of the day rolls up. Note the
      // two views can legitimately differ: the raw figures above count whole
      // sessions on their start day, whereas the aggregate splits a
      // midnight-spanning session across days (D4).
      todayAggregate: todayAgg,

      totalSessionsStored: store.sessions.length,

      // Rollup health signal (D7): steady state is 0. A persistently nonzero
      // value means sessions are being closed but not rolled up — i.e. a
      // rollup bug — because the close path stamps in the same write.
      unaggregatedSessions: store.sessions.filter(function (s) { return !s.aggregated; }).length,

      // Growth is now bounded by the 30-day prune (D6); aggregates keep forever
      // but are tiny and fixed-shape per day.
      bytesInUse: bytesInUse,
      bytesInUseDays: bytesInUseDays,
      dayAggregatesStored: Object.keys(days).length
    };

    console.log("[LaunchPad] Tracking summary:", out);
    return out;
  }

  var Tracking = {
    STORE_KEY: STORE_KEY,
    DAYS_KEY: DAYS_KEY,
    RETENTION_DAYS: RETENTION_DAYS,
    IDLE_DETECTION_SECONDS: IDLE_DETECTION_SECONDS,
    CAPTURING_LEVELS: CAPTURING_LEVELS,

    start: start,
    sync: sync,
    reconcileOrphans: reconcileOrphans,
    rollupAndPrune: rollupAndPrune,
    debugSummary: debugSummary,

    // [1.0.16] Read surface for the active-task widget. The only non-console
    // read contract; see focusedTodayForTask for why it returns two halves.
    focusedTodayForTask: focusedTodayForTask,

    // [1.0.20] Read surface for the Dashboard's whole-day line. Two public
    // names over one implementation (focusedTodayForScope) so call sites read
    // honestly while the open-session clamp exists in exactly one place.
    // Both return { baseMs, openSince } — the same contract as above.
    focusedTodayForWorkspace: focusedTodayForWorkspace,
    focusedTodayCombined: focusedTodayCombined,

    // Exposed for the Section I console harness — verification needs to drive
    // the gates and the store directly without waiting on real Chrome events.
    _domainOf: domainOf,
    _evaluateGates: evaluateGates,
    _computeDesired: computeDesired,
    _readStore: readStore,
    _writeStore: writeStore,
    _emptyStore: emptyStore,
    _startOfLocalDay: startOfLocalDay,

    // [1.0.26]
    _readDays: readDays,
    _writeDays: writeDays,
    _attributeSession: attributeSession,
    _matchingBookmarks: matchingBookmarks,
    _splitAcrossLocalDays: splitAcrossLocalDays,
    _rollupSessionInto: rollupSessionInto,
    _rollupUnaggregated: rollupUnaggregated,
    _dayAggregateKey: dayAggregateKey,
    _emptyDay: emptyDay,
    _localDayKey: localDayKey
  };

  if (typeof self !== "undefined") self.Tracking = Tracking;
  if (typeof window !== "undefined") window.Tracking = Tracking;
  if (typeof root !== "undefined" && root) root.Tracking = Tracking;
})(typeof globalThis !== "undefined" ? globalThis : this);
