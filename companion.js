// ===========================================================================
// COMPANION — the pill's content, rendered outside the new tab.
//
// [1.9.1] LaunchPad is only reachable while a new tab is open. This module
// carries the one thing a user needs mid-work — what they said they are doing,
// and how long they have been doing it — to a surface that is one click away
// from any page.
//
// NAMING, LOCKED BY THE PLAN AND KEPT HERE. The in-page column is the SIDEBAR.
// Chrome's is the SIDE PANEL. This is the POPUP. Nothing in this file is named
// `panel`, because this product already carries three senses of "session" and a
// fourth ambiguity in "panel" is a cost paid forever. `mount` takes a container
// and does not know or care which surface it is on.
//
// IT DOES NOT IMPORT newtab.js, which is a bare IIFE with no exports and could
// not be imported even if that were wanted. What it shares instead is the part
// that MUST NOT DIVERGE: Storage.fmtDuration, Storage.runningPomodoro,
// Storage.pomodoroRemainingMs and ProAccess.isProAccessibleLevel all moved into
// loadable modules in this round precisely so there is one implementation
// rather than two that drift. The MARKUP is deliberately not shared - a 360px
// popup is not a docked card - but every number it prints comes from the same
// code the pill prints from.
//
// TWO MOUNT POINTS. The popup now, the side panel in [1.16.0]. That is why
// mount() takes its container as an argument and why nothing here reads
// document.body or a hard-coded id.
// ===========================================================================
var Companion = (function () {
  "use strict";

  function t(key, params) {
    return (typeof I18n !== "undefined" && I18n.t) ? I18n.t(key, params) : key;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ---------------------------------------------------------------- state
  //
  // ONE READ, ONE PLAIN OBJECT, NO DOM. Keeping the read pure is what lets the
  // same state be asserted directly in a harness without going through pixels,
  // and it is what will let the side panel reuse this untouched.
  //
  // `data` is read FRESH on every call rather than cached. The popup is a
  // short-lived foreign context: it opens, it is looked at, it closes. A cache
  // would buy nothing and could serve a stale active task, which is the one
  // thing this surface exists to get right.
  async function readState() {
    var data = await Storage.getAll();
    var level = ProAccess.getProAccessLevel(data);
    var pro = ProAccess.isProAccessibleLevel(level);

    // D9 / CLAUDE.md: gate on the CLASSIFIER, never on a hand-written list of
    // states. `grace` is a paying customer and an `active || trialing` check
    // would lock them out silently.
    if (!pro) return { pro: false, level: level };

    var resolved = Storage.resolveActiveTask(data);
    // resolveActiveTask reports a task completed or deleted anywhere as stale.
    // The popup DOES NOT SELF-HEAL: the page owns that write, and a read-only
    // surface firing a storage write on open would be a surprising side effect
    // of looking at something. It simply renders the empty state, and the page
    // clears the record the next time it renders.
    var res = (resolved && !resolved.stale) ? resolved : null;
    var paused = Storage.isTrackingPaused(data);
    var pomo = res ? Storage.runningPomodoro(data) : null;

    var goalName = null;
    if (res && res.task && res.task.goalId) {
      var ws = Storage.getActiveWorkspace(data);
      var goal = ws ? Storage.getGoalById(ws, res.task.goalId) : null;
      if (goal) goalName = goal.name;
    }

    var st = {
      pro: true,
      level: level,
      paused: paused,
      task: res ? { id: res.task.id, name: res.task.name } : null,
      goalName: goalName,
      pomo: pomo ? {
        phase: pomo.phase,
        label: Storage.POMODORO_PHASE_LABELS[pomo.phase] || "Focus",
        remainingMs: Storage.pomodoroRemainingMs(data, pomo)
      } : null,
      focusedMs: 0,
      focusedOpenSince: null
    };

    // The focused-today numeral comes from the tracking engine, exactly as the
    // pill's satRefreshReadout does. baseMs is settled time; openSince is the
    // start of an in-flight span, so the live figure is base + (now - openSince)
    // and only that second term ticks.
    if (res && typeof Tracking !== "undefined" && Tracking.focusedTodayForTask) {
      try {
        var r = await Tracking.focusedTodayForTask(res.task.id);
        st.focusedMs = r.baseMs || 0;
        st.focusedOpenSince = r.openSince || null;
      } catch (err) {
        console.error("[LaunchPad] Companion: focused-time read failed", err);
      }
    }
    return st;
  }

  // The live figure. A GLOBAL PAUSE FREEZES IT: the open span stops accruing,
  // which is the same rule the pill follows and the reason a paused popup shows
  // a still number rather than one that keeps climbing while nothing is tracked.
  function liveFocusedMs(st, now) {
    if (!st || !st.task) return 0;
    if (st.paused || !st.focusedOpenSince) return st.focusedMs;
    var ref = (typeof now === "number") ? now : Date.now();
    return st.focusedMs + Math.max(0, ref - st.focusedOpenSince);
  }

  // ----------------------------------------------------------------- view
  //
  // Pure: state in, HTML out. No storage reads, no Date.now() except through the
  // caller's `now`, so a harness can render every state without contriving one.
  function viewHtml(st, now) {
    if (!st.pro) {
      // NOT A PREVIEW STUB. D9 hides the pill entirely for free users and the
      // guide forbids a preview surface that renders a create affordance, so
      // this is one sentence and no controls - it explains the empty popup
      // rather than imitating the thing it cannot show.
      return '<div class="cmp-locked">' +
          '<p class="cmp-locked-text">' + esc(t("companion_locked")) + '</p>' +
        '</div>';
    }

    if (!st.task) {
      return '<div class="cmp-body cmp-empty">' +
          (st.paused ? '<span class="cmp-glyph cmp-glyph-paused" aria-hidden="true">&#9208;</span>' : '') +
          '<span class="cmp-empty-text">' + esc(t("companion_no_active_task")) + '</span>' +
          (st.paused ? '<span class="cmp-eyebrow cmp-eyebrow-paused">' + esc(t("companion_paused")) + '</span>' : '') +
        '</div>';
    }

    var eyebrow, numeral, glyph, numeralClass;
    if (st.pomo) {
      // A running phase REPLACES the focused-today figure with the countdown,
      // as it does on the pill: two numerals racing each other on a 360px
      // surface is exactly the "one honest number per claim" failure.
      glyph = "&#9711;";
      eyebrow = st.pomo.label;
      numeral = Storage.fmtDuration(st.pomo.remainingMs);
      numeralClass = "cmp-numeral cmp-numeral-countdown";
    } else {
      glyph = st.paused ? "&#9208;" : "&#9654;";
      eyebrow = st.paused ? t("companion_paused") : t("companion_active_task");
      numeral = Storage.fmtDuration(liveFocusedMs(st, now));
      numeralClass = "cmp-numeral";
    }

    return '<div class="cmp-body' + (st.paused ? " is-paused" : "") + '">' +
        '<div class="cmp-head">' +
          '<span class="cmp-glyph" aria-hidden="true">' + glyph + '</span>' +
          '<span class="cmp-eyebrow">' + esc(eyebrow) + '</span>' +
        '</div>' +
        '<div class="cmp-name" title="' + esc(st.task.name) + '">' + esc(st.task.name) + '</div>' +
        (st.goalName
          ? '<div class="cmp-goal" title="' + esc(st.goalName) + '">' + esc(st.goalName) + '</div>'
          : '') +
        '<div class="' + numeralClass + '" data-cmp-numeral>' + esc(numeral) + '</div>' +
        '<div class="cmp-numeral-label">' +
          esc(st.pomo ? t("companion_remaining") : t("companion_focused_today")) +
        '</div>' +
      '</div>';
  }

  // ---------------------------------------------------------------- mount
  //
  // THE CONTAINER IS A PARAMETER. [1.16.0] mounts this same module in the side
  // panel; nothing below reads document.body, a fixed id, or window size, so
  // that mount is a second call rather than a second implementation.
  function mount(container, opts) {
    if (!container) throw new Error("Companion.mount: a container element is required");
    var options = opts || {};
    var tickMs = options.tickMs || 1000;
    var state = null;
    var timer = null;
    var stopped = false;

    function paintNumeral() {
      if (!state || !state.pro || !state.task) return;
      var el = container.querySelector("[data-cmp-numeral]");
      if (!el) return;
      // A running phase counts DOWN and the focused figure counts UP, so the
      // tick recomputes from the state rather than incrementing a display value.
      var next = state.pomo
        ? Storage.fmtDuration(Math.max(0, state.pomo.remainingMs - (Date.now() - state.readAt)))
        : Storage.fmtDuration(liveFocusedMs(state));
      if (el.textContent !== next) el.textContent = next;
    }

    function startTick() {
      stopTick();
      // Only a moving number earns a timer. A paused or empty popup ticks
      // nothing, which is the same rule the pill's satStopTick follows.
      if (!state || !state.pro || !state.task) return;
      if (!state.pomo && (state.paused || !state.focusedOpenSince)) return;
      timer = setInterval(paintNumeral, tickMs);
    }
    function stopTick() { if (timer) { clearInterval(timer); timer = null; } }

    async function render() {
      if (stopped) return;
      state = await readState();
      state.readAt = Date.now();
      container.innerHTML = viewHtml(state, state.readAt);
      container.setAttribute("data-cmp-state", state.pro
        ? (state.task ? (state.pomo ? "pomodoro" : (state.paused ? "paused" : "active")) : (state.paused ? "empty-paused" : "empty"))
        : "locked");
      startTick();
      return state;
    }

    // CROSS-CONTEXT REFRESH, AND WHY IT WORKS HERE.
    // storage.js generates TAB_INSTANCE_ID per CONTEXT. The new tab's writes
    // carry the PAGE's id, which never equals this context's, so the page's
    // own-tab suppression does not apply to us: from here every page write is a
    // FOREIGN write and we re-render. Established by reading the gate in
    // newtab.js, not assumed - see the round's report.
    function onChanged(changes) {
      if (changes && (changes.data || changes.tracking_sessions)) render();
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(onChanged);
    }

    // [1.9.1] WRITE ADOPTION IS REGISTERED HERE TOO, and the reason is worth
    // stating because nothing in this round writes. Storage's _adoptWrite is a
    // per-context module variable: the page registers its own, the service
    // worker deliberately registers none. A popup that kept a cached `data` and
    // used a self-reading writer would be left holding a superseded object. We
    // do not cache - readState re-reads every time - so this is belt to that
    // brace, and [1.9.4]'s quick-add must ALSO re-read at the point of write
    // rather than trusting anything read at open time. Registered now so the
    // question is answered before quick-add lands, per PLAN decision 5.
    if (Storage.onWriteAdopt) Storage.onWriteAdopt(function () { /* no cache to adopt into */ });

    function destroy() {
      stopped = true;
      stopTick();
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(onChanged);
      }
    }

    return { render: render, destroy: destroy, getState: function () { return state; } };
  }

  return {
    mount: mount,
    readState: readState,
    viewHtml: viewHtml,
    liveFocusedMs: liveFocusedMs
  };
})();

if (typeof window !== "undefined") window.Companion = Companion;
