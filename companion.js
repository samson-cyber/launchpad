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
      // [1.9.4 finding 2] THE SESSION NUMERAL, and it is a DIFFERENT KIND OF
      // NUMBER from focusedMs below. This is the ACTIVATION STOPWATCH - wall
      // clock since the task was activated, less paused and idle spans - which
      // is what the pill leads with and what the badge counts. focusedMs is the
      // ENGINE's figure: time it actually saw on a trackable site. newtab.js
      // states the law this obeys: "the two are never added, averaged or shown
      // as one figure", and the word "focused" is reserved for the engine.
      //
      // The popup led with focusedMs, which is why Samson's popup showed 0:00
      // as its hero while a real session ran - the engine had seen no trackable
      // time yet, so the number was HONESTLY zero and completely useless as a
      // headline. It was not a resolution bug: fmtDuration already prints
      // seconds. It was the wrong quantity.
      activeMs: res ? Storage.activeElapsedMs(data) : 0,
      // The stopwatch ticks from a fixed origin rather than being incremented,
      // so a tick that fires late cannot drift. Frozen while paused, exactly as
      // Storage.activeElapsedMs computes it.
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

  // The live stopwatch. Recomputed from the state's read moment rather than
  // incremented, and FROZEN while paused - the same rule liveFocusedMs follows
  // and the same one Storage.activeElapsedMs encodes.
  function liveActiveMs(st, now) {
    if (!st || !st.task) return 0;
    if (st.paused) return st.activeMs;
    var ref = (typeof now === "number") ? now : Date.now();
    return st.activeMs + Math.max(0, ref - (st.readAt || ref));
  }

  // ----------------------------------------------------------------- view
  //
  // Pure: state in, HTML out. No storage reads, no Date.now() except through the
  // caller's `now`, so a harness can render every state without contriving one.
  // [1.9.4 finding 1] THE ROUTE OUT, and it is ONE route on purpose.
  //
  // The empty popup is this surface's MOST COMMON state - most of the time no
  // session is running - and it offered a sentence and nothing else. A user who
  // clicked the toolbar icon from a webpage came looking for something.
  //
  // OPEN LAUNCHPAD, NOT A TASK PICKER, and the reasoning is the rule this arc
  // established. Choosing a task ACTIVATES it and starts tracking; that is a
  // decision the product makes on a full page where the board, the goals and the
  // priorities are visible. Making it from a 360px surface with none of that
  // context is the same class of error as a keyboard command starting a session
  // on a keystroke the user may have mistyped - [1.9.3] refused that, and this
  // refuses it for the same reason. The pill's own "+" in this state is not a
  // counter-example: it opens a picker ON the page that already shows the board.
  //
  // It is also the only route that serves BOTH empty states. The popup is empty
  // when no task is active AND when the user is free or expired, and a picker
  // answers only the first.
  //
  // The URL is built with runtime.getURL exactly as the open-launchpad command
  // builds it - never chrome.tabs.create({}), which opens whichever extension
  // currently owns the new tab override.
  function routeHtml() {
    return '<div class="cmp-actions cmp-actions-route">' +
        '<button type="button" class="cmp-btn cmp-btn-route" data-cmp-act="open">' +
          esc(t("companion_open_launchpad")) +
        '</button>' +
      '</div>';
  }

  function viewHtml(st, now) {
    if (!st.pro) {
      // NOT A PREVIEW STUB. D9 hides the pill entirely for free users and the
      // guide forbids a preview surface that renders a create affordance, so
      // this is one sentence and no controls - it explains the empty popup
      // rather than imitating the thing it cannot show.
      // [1.9.4] The sentence told the user to open LaunchPad and gave them no
      // way to do it, which is the same dead end finding 1 is about. Still not a
      // preview and still no create affordance - one route, no imitation of the
      // surface it cannot show.
      return '<div class="cmp-locked">' +
          '<p class="cmp-locked-text">' + esc(t("companion_locked")) + '</p>' +
          routeHtml() +
        '</div>';
    }

    if (!st.task) {
      // [1.9.5 finding 5] ONE amber signal: the head says the state, so the
      // eyebrow carries it and nothing else does.
      return '<div class="cmp-body cmp-empty' + (st.paused ? " is-paused" : "") + '">' +
          '<div class="cmp-empty-row">' +
            (st.paused ? '<span class="cmp-glyph cmp-glyph-paused" aria-hidden="true">&#9208;</span>' : '') +
            '<span class="cmp-empty-text">' + esc(t("companion_no_active_task")) + '</span>' +
            (st.paused ? '<span class="cmp-eyebrow cmp-eyebrow-paused">' + esc(t("companion_paused")) + '</span>' : '') +
          '</div>' +
          routeHtml() +
        '</div>';
    }

    // [1.9.4 finding 2] THE HERO IS THE SESSION NUMERAL, at the pill's
    // resolution, in the pill's form, from the pill's function. During a running
    // phase the COUNTDOWN takes the hero, exactly as the pill's phase takeover
    // does - it is still the session numeral, just the bounded one.
    var glyph, eyebrow, hero, heroLabel, heroClass;
    if (st.pomo) {
      glyph = "&#9711;";
      eyebrow = st.pomo.label;
      hero = Storage.fmtDuration(st.pomo.remainingMs);
      heroLabel = t("companion_remaining");
      heroClass = "cmp-hero cmp-hero-countdown";
    } else {
      glyph = st.paused ? "&#9208;" : "&#9654;";
      eyebrow = st.paused ? t("companion_paused") : t("companion_active_task");
      hero = Storage.fmtStopwatch(liveActiveMs(st, now));
      // THE LABEL NAMES THE QUANTITY, NOT THE STATE, and it does not switch when
      // paused. The pill's card has no eyebrow, so its hero label is the only
      // place the state can be said and it says it there. This surface DOES have
      // an eyebrow, and making the label switch too printed "PAUSED" twice on one
      // 360px card - once in amber at the top and once in grey four lines down.
      // Caught by looking at the rendered frame, not by reading the code.
      //
      // The state is said ONCE, in the head, where the amber marks it. This label
      // answers the other question - WHICH number is this - and the answer does
      // not change when the clock stops: it is still the wall-clock time on this
      // task, the pill's "active" quantity, never "focused", which is the
      // engine's word and belongs to the figure on the right.
      heroLabel = t("companion_active");
      heroClass = "cmp-hero";
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
        // [1.9.4 finding 4] TWO COLUMNS. The card this mirrors shows both
        // numbers; showing both here fills the horizontal space a short task
        // name leaves empty, and keeps the two FAMILIES visibly separate - the
        // wall-clock on the left, the engine's figure on the right - rather than
        // stacking them where they read as one ramp of the same quantity.
        '<div class="cmp-metrics">' +
          '<div class="cmp-metric cmp-metric-hero">' +
            '<div class="' + heroClass + '" data-cmp-hero>' + esc(hero) + '</div>' +
            '<div class="cmp-metric-label">' + esc(heroLabel) + '</div>' +
          '</div>' +
          '<div class="cmp-metric cmp-metric-today">' +
            '<div class="cmp-sub" data-cmp-focused>' + esc(Storage.fmtDuration(liveFocusedMs(st, now))) + '</div>' +
            '<div class="cmp-metric-label">' + esc(t("companion_focused_today")) + '</div>' +
          '</div>' +
        '</div>' +
        actionsHtml(st) +
      '</div>';
  }

  // [1.9.4 finding 3] WHICH CONTROLS, AND WHAT IS DELIBERATELY ABSENT.
  //
  // Pause and resume, and the route. That is the whole set, and the omissions
  // are the decision rather than an unfinished list:
  //
  //   COMPLETE and END FOR NOW are not here. Both end the session and one ends
  //   the task; both are destructive-adjacent, neither has an undo, and this is
  //   a surface the user dismisses by clicking away from it. A misfire costs a
  //   real session. They live on the card, where the board is visible and the
  //   consequence is legible.
  //   SWITCH TASK is not here: it needs the task list, which is the picker
  //   finding 1 declined for the same reason.
  //   START A FOCUS SESSION, the duration segment and the blocking toggle are
  //   not here: they are configuration, and nobody mid-page reaches for the
  //   toolbar to configure a Pomodoro.
  //
  // What is left is the question this popup exists to answer - "what am I
  // doing, and can I stop the clock without leaving this page" - which is
  // exactly what Samson asked for.
  function actionsHtml(st) {
    var pauseLabel = st.paused ? t("companion_resume") : t("companion_pause");
    return '<div class="cmp-actions">' +
        '<button type="button" class="cmp-btn cmp-btn-primary" data-cmp-act="' +
          (st.paused ? "resume" : "pause") + '">' + esc(pauseLabel) + '</button>' +
        '<button type="button" class="cmp-btn cmp-btn-route" data-cmp-act="open">' +
          esc(t("companion_open_launchpad")) + '</button>' +
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

    // [1.9.4] BOTH numerals tick, and they are recomputed from the state's read
    // moment rather than incremented, so a tick that fires late cannot drift.
    // A running phase counts DOWN; the stopwatch and the engine figure count UP.
    function paintNumeral() {
      if (!state || !state.pro || !state.task) return;
      var now = Date.now();
      var hero = container.querySelector("[data-cmp-hero]");
      if (hero) {
        var nextHero = state.pomo
          ? Storage.fmtDuration(Math.max(0, state.pomo.remainingMs - (now - state.readAt)))
          : Storage.fmtStopwatch(liveActiveMs(state, now));
        if (hero.textContent !== nextHero) hero.textContent = nextHero;
      }
      var today = container.querySelector("[data-cmp-focused]");
      if (today) {
        var nextToday = Storage.fmtDuration(liveFocusedMs(state, now));
        if (today.textContent !== nextToday) today.textContent = nextToday;
      }
    }

    function startTick() {
      stopTick();
      // Only a moving number earns a timer. A paused or empty popup ticks
      // nothing, which is the same rule the pill's satStopTick follows.
      //
      // [1.9.4] THE CONDITION CHANGED WITH THE HERO. It used to stop whenever
      // the ENGINE had no open span, because the engine's figure was the only
      // number on the surface. The stopwatch moves whenever a task is active and
      // tracking is not paused - which is most of the time the engine is idle,
      // since the engine only counts trackable sites. Keeping the old condition
      // would have frozen the new hero on exactly the pages this popup exists
      // for.
      if (!state || !state.pro || !state.task) return;
      if (state.paused) return;
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

    // [1.9.4] THE CONTROLS. One delegated listener on the container, so a
    // re-render replaces the buttons without leaking a listener per paint.
    //
    // EVERY WRITE GOES THROUGH THE FUNCTION THE PILL CALLS. Storage.setTrackingPaused
    // is the single writer for this flag: it maintains the activation counters,
    // folds a pending idle span, slides a running phase's endpoint by the paused
    // duration on resume, and persists the whole object itself. A popup that set
    // data.trackingPaused directly would be a SECOND pause path, which is the
    // exact defect this arc found twice - and it would silently break the phase
    // shift and the counter accounting, neither of which is visible from here.
    //
    // `data` IS RE-READ AT THE POINT OF WRITE, never taken from the object
    // readState returned when the popup opened. The popup is a foreign context
    // whose Storage._adoptWrite is a no-op (registered in [1.9.1] against
    // exactly this moment); an object read at open time can be superseded by the
    // page or the service worker before the user clicks.
    async function act(action) {
      if (action === "open") {
        // The same URL the open-launchpad command builds, for the same reason:
        // chrome.tabs.create({}) would open whichever extension owns the new tab
        // override, which need not be this one.
        await chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
        // The popup is done once it has handed off to a full page.
        if (typeof window !== "undefined" && window.close) window.close();
        return;
      }
      if (action === "pause" || action === "resume") {
        try {
          var fresh = await Storage.getAll();
          await Storage.setTrackingPaused(fresh, action === "pause");
        } catch (err) {
          console.error("[LaunchPad] Companion: pause toggle failed", err);
        }
        // EAGER RE-RENDER, matching satSetPaused. The onChanged path would also
        // fire here, but waiting for a storage round trip to reflect a click the
        // user just made is the lag this surface can least afford.
        await render();
      }
    }

    function onClick(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-cmp-act]") : null;
      if (!btn || !container.contains(btn)) return;
      ev.preventDefault();
      act(btn.getAttribute("data-cmp-act"));
    }
    container.addEventListener("click", onClick);

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
      container.removeEventListener("click", onClick);
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(onChanged);
      }
    }

    // `act` is exported so a harness drives the SAME function the click handler
    // calls, rather than a lookalike. J10, and [1.9.3]'s mutant 2 is why the
    // result is then read from storage rather than from a return value.
    return { render: render, destroy: destroy, act: act,
             getState: function () { return state; } };
  }

  return {
    mount: mount,
    readState: readState,
    viewHtml: viewHtml,
    liveFocusedMs: liveFocusedMs,
    liveActiveMs: liveActiveMs
  };
})();

if (typeof window !== "undefined") window.Companion = Companion;
