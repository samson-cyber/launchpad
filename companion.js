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
  // [1.16.0] HOW MANY ROWS. A panel has height, not infinite height, and a list
  // that scrolls past the fold stops being a glance. Six is what fits above the
  // fold at the panel's native width with the card above it; the count line says
  // how many more there are, so nothing is hidden without being counted.
  var DUE_LIST_MAX = 6;

  // ===== [H3d] WM.5's CHAINING COUNTDOWN, ON THE SURFACE THAT OWNS START ====
  //
  // RULED 2026-09-19. FIX-6 moved this to the Dashboard hero when the pill was
  // removed; this moves it once more, and the reason is the one FIX-6 itself
  // gave - it must render on a LIVE surface the user is looking at, because the
  // consent property IS the visibility. The side panel is where Start lives, and
  // the surface that begins a session is the one that should ask whether to
  // begin the next.
  //
  // PAGE MEMORY, NOT STORAGE, CARRIED OVER INTACT. A stored deadline would
  // outlive the surface that showed it: close the panel mid-countdown and the
  // next surface to open would find an expired commitment and start a work phase
  // nobody watched. That is the invisible auto-advance [WM.5] exists to prevent.
  // The deadline below is a closure variable and dies with the document.
  //
  // WHAT THE CLOSED-PANEL CASE GETS: the boundary notification the worker
  // already posts, which carries its own 'Start next session' button. One click
  // rather than none, which is the right default when nobody is looking.

  // The READ half: is the product in a chaining state right now? Pure - no
  // timer, no DOM, no arming - so readState keeps its contract.
  function chainReadState(data) {
    var a = Storage.getActiveTask(data);
    if (!a) return null;
    var ps = Storage.hydratePomodoroState(a.pomodoroState);
    if (!ps.sessionComplete) return null;
    if (!Storage.shouldChainAfterBreak(data, ps)) return null;
    // THE MODE THAT AUTHORISED THE CHAIN travels with it. Driven on the page
    // before this moved: with the workspace flipped to Casual during the
    // countdown, the continuation started a Casual session while the countdown
    // on screen promised the next phase of a Work one. Only the AUTOMATIC
    // continuation inherits; a hand click on Start reads the live workspace,
    // because the user is here and chose it.
    return { mode: ps.mode || null };
  }

  async function readState(opts) {
    var wantDue = !!(opts && opts.showDueList);
    // [FIX-6] OPT-IN, THE SAME SHAPE showDueList TAKES, AND THE POPUP DOES NOT
    // PASS IT. The omission note above actionsHtml is a RULING about the
    // TOOLBAR POPUP - "nobody mid-page reaches for the toolbar to configure a
    // Pomodoro" - and it still holds for the popup. The SIDE PANEL is a
    // different surface: persistent, 420px, and the place a user works from.
    // It is also, since the pill was removed, the only surface that can START
    // a focus session at all.
    var wantControls = !!(opts && opts.showSessionControls);
    var data = await Storage.getAll();
    var level = ProAccess.getProAccessLevel(data);
    var pro = ProAccess.isProAccessibleLevel(level);

    // D9 / CLAUDE.md: gate on the CLASSIFIER, never on a hand-written list of
    // states. `grace` is a paying customer and an `active || trialing` check
    // would lock them out silently.
    if (!pro) return { pro: false, level: level, due: null };

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
      // [FIX-6] THE SESSION CONTROLS' STATE, present only when the mount asked
      // for them - exactly as st.due is. A surface that did not ask renders
      // byte-identically to before, which is what keeps the popup's ruling
      // intact by construction rather than by a second code path.
      // [H3d] THE CHAIN'S READ HALF, and it is a READ - no arming here.
      // readState is pure by contract ("ONE READ, ONE PLAIN OBJECT, NO DOM"),
      // and arming starts a timer, so the deadline lives in the mount closure
      // and this only reports what the stored state says is true.
      //
      // Gated on wantControls rather than on its own option: the countdown asks
      // "start the next phase?", which is only a question a surface that can
      // START one may ask. The popup passes neither and renders neither.
      chain: wantControls ? chainReadState(data) : null,
      controls: wantControls ? {
        running: !!pomo,
        // The length a start would use: the CURRENT workspace mode's preset,
        // which is the same value startPomodoroPhase stamps and the same one
        // Pro Settings edits. Reading the global durations here would show a
        // number the session would not use ([WM.5]).
        workMin: Storage.pomodoroConfigForMode(data,
          Storage.getWorkspaceMode(Storage.getActiveWorkspace(data))).workMin,
        // "off" | "manual" | "auto" - the tri-state the pill's row showed, from
        // the same reader, so the two surfaces cannot disagree about it.
        arm: Storage.focusArmState(data),
        noSites: Storage.getBlockList(data).length === 0
      } : null,
      // The stopwatch ticks from a fixed origin rather than being incremented,
      // so a tick that fires late cannot drift. Frozen while paused, exactly as
      // Storage.activeElapsedMs computes it.
      focusedMs: 0,
      focusedOpenSince: null,
      // [1.16.0 / decision A] THE DUE LIST, and it is Storage.getDueWork's
      // answer rather than a new one.
      //
      // WHY THAT LIST. Three candidates were on the table and the other two
      // fail on their own terms:
      //
      //   TODAY'S THREE is the Dashboard picker's CURATED set - three things
      //   the user chose, on a full page, with the board in front of them.
      //   Mirroring it read-only on a surface that cannot curate shows a list
      //   whose whole meaning is that you picked it, with no way to pick.
      //
      //   THE ACTIVE GOAL'S TASKS is empty whenever no goal is active, which is
      //   most of the time - the same dead end [1.9.4] finding 1 found in the
      //   empty popup, rebuilt in a new place.
      //
      //   getDueWork IS ALREADY THE PRODUCT'S ANSWER to "what needs doing": it
      //   is what WM.5's reminders fire from, it is per-workspace like every
      //   other task surface, and it classifies overdue / today / recurring
      //   itself. Using it means ONE definition of due. A second one here would
      //   drift from the notification the user got this morning, and I28 is the
      //   standing entry on what a second implementation of a shared question
      //   costs.
      //
      // SNOOZED ROWS ARE EXCLUDED. A snooze is the user saying "not today", and
      // a surface that keeps showing it has not heard them.
      due: null
    };

    if (wantDue) {
      try {
        var work = Storage.getDueWork(data);
        var live = (work.items || []).filter(function (it) { return !it.snoozed; });
        st.due = {
          total: live.length,
          items: live.slice(0, DUE_LIST_MAX).map(function (it) {
            // [FIX-7] ws RIDES ALONG. getDueWork has always returned it and
            // this map dropped it, which was fine while the list was a reading
            // surface and is not now: activating a task needs the workspace it
            // lives in, and a due row can be from any of them.
            return { id: it.taskId, name: it.name, kind: it.kind, ws: it.workspaceId };
          })
        };
      } catch (err) {
        console.error("[LaunchPad] Companion: due-work read failed", err);
        st.due = { total: 0, items: [] };
      }
    }

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

  // [1.16.0] THE LIST IS READ-ONLY, AND THAT IS THE SAME DECISION actionsHtml
  // ALREADY MADE rather than a new one.
  //
  // Its comment rules Complete off the popup because "both are destructive-
  // adjacent, neither has an undo, and this is a surface the user dismisses by
  // clicking away from it. A misfire costs a real session." Every word of that
  // holds for a panel except the last clause, and the panel replaces it with
  // something worse: it sits open for hours beside whatever the user is doing,
  // so a stray click is MORE likely, not less. So the rows show what is due and
  // the route below the card is still the one way to act on it.
  //
  // THE KIND IS A WORD, NOT A COLOUR. Overdue is the only kind that differs
  // from "today" in any way that matters here, and saying it in text means the
  // row does not depend on a hue to be read - which also keeps this surface out
  // of the business of inventing a second urgency scale beside the trash
  // countdown's.
  function dueListHtml(st) {
    if (!st.due) return "";
    if (!st.due.total) {
      return '<div class="cmp-due cmp-due-empty">' +
          '<span class="cmp-due-empty-text">' + esc(t("companion_due_none")) + '</span>' +
        '</div>';
    }
    // [FIX-7] EVERY ROW CARRIES A PLAY GLYPH, ON THE PANEL ONLY.
    //
    // THE DEFECT THIS CLOSES, stated plainly because it is the round: the
    // panel's Start renders only when a task is ALREADY active, and these rows
    // were inert <li>. A Pro user with nothing active therefore opened the
    // side panel and found one control - "Open LaunchPad". The pill used to
    // cover that gap and the pill is gone.
    //
    // st.controls IS THE PANEL FLAG, so the popup's rows stay exactly as they
    // were - reading surface, no controls, finding 3 intact.
    var canStart = !!st.controls;
    var rows = st.due.items.map(function (it) {
      return '<li class="cmp-due-row">' +
          (canStart
            ? '<button type="button" class="cmp-due-play" data-cmp-act="due-start" ' +
                'data-cmp-task="' + esc(it.id) + '" data-cmp-ws="' + esc(it.ws || "") + '" ' +
                'title="' + esc(t("companion_start_on_task", { name: it.name })) + '" ' +
                'aria-label="' + esc(t("companion_start_on_task", { name: it.name })) + '">\u25b6</button>'
            : '') +
          '<span class="cmp-due-name" title="' + esc(it.name) + '">' + esc(it.name) + '</span>' +
          (it.kind === "overdue"
            ? '<span class="cmp-due-kind">' + esc(t("companion_due_overdue")) + '</span>'
            : "") +
        '</li>';
    }).join("");
    var more = st.due.total > st.due.items.length
      ? '<div class="cmp-due-more">' + esc(t("companion_due_more", { count: st.due.total - st.due.items.length })) + '</div>'
      : "";
    return '<div class="cmp-due">' +
        '<div class="cmp-due-head">' + esc(t("companion_due_head", { count: st.due.total })) + '</div>' +
        '<ul class="cmp-due-list">' + rows + '</ul>' +
        more +
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
          // THE EMPTY STATE IS WHERE THE LIST EARNS ITS PLACE MOST. No session
          // is running, so the card above says almost nothing - and "what should
          // I be doing" is exactly the question a user with no active task came
          // to this surface with.
          dueListHtml(st) +
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
        dueListHtml(st) +
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
  //
  // ===== [FIX-6] AND THE SIDE PANEL NOW ASKS FOR MORE, BECAUSE THE PILL IS
  // GONE AND IT WAS THE ONLY PLACE A SESSION COULD BE STARTED. =============
  //
  // THE OMISSION ABOVE IS NOT REVERSED; ITS SCOPE IS NAMED. Every word of it
  // is about the TOOLBAR POPUP - a surface you open, glance at and dismiss by
  // clicking away. The side panel is the opposite: it is pinned open beside
  // the page you are working on. "Nobody mid-page reaches for the toolbar to
  // configure a Pomodoro" is true and says nothing about a panel that is
  // already on screen.
  //
  // WHAT THE CENSUS FOUND, which is why this is here at all: Storage
  // .startPomodoroPhase had exactly TWO callers in the shipped product - the
  // service worker's auto-advance, and the pill. Removing the pill without
  // this block would have left Pro's headline feature with no way to begin.
  // Storage.stopPomodoro was the same, and the MANUAL blocking arm was
  // pill-only too (Settings owns the block list and the AUTO arm, not this).
  //
  // STILL ABSENT, and still for finding 3's reasons: Complete and End for now
  // (destructive-adjacent, no undo, and this surface is dismissed by clicking
  // away), and switching task (it needs the list this panel declined).
  function sessionControlsHtml(st) {
    var c = st.controls;
    if (!c) return "";
    // NO ACTIVE TASK, NO SESSION CONTROLS. A focus session is a session ON
    // something; startPomodoroPhase stamps the active task's record, and a
    // Start button with nothing to start against would be a control that
    // cannot act - which this codebase rules is worse than an absent one.
    if (!st.task) return "";
    var armOn = c.arm !== "off";
    var armLabel = c.arm === "off" ? t("focusblock_state_off")
                 : c.arm === "auto" ? t("focusblock_state_auto")
                 : t("focusblock_state_on");
    var armTitle = armOn ? t("focusblock_turn_off") : t("focusblock_turn_on");
    // [H3d] THE COUNTDOWN SITS ABOVE THE CONTROLS, because it is the only thing
    // in this cluster that is about to happen rather than something to do. It
    // renders for ten seconds at a phase boundary and is absent every other
    // moment. role="status" so the seconds are announced without stealing focus.
    var chain = (st.chainSecs === null || st.chainSecs === undefined) ? "" :
      '<div class="cmp-chain" data-cmp-chain role="status">' +
        '<span class="cmp-chain-text" data-cmp-chain-text>' +
          esc(t("sat_next_phase_in_seconds", { count: st.chainSecs })) + '</span>' +
        '<button type="button" class="cmp-chain-cancel" data-cmp-act="chain-cancel">' +
          esc(t("common_cancel")) + '</button>' +
      '</div>';

    return '<div class="cmp-session">' +
        chain +
        '<div class="cmp-session-row">' +
          (c.running
            ? '<button type="button" class="cmp-btn cmp-btn-stop" data-cmp-act="pomo-stop">' +
                esc(t("sat_stop")) + '</button>'
            : '<button type="button" class="cmp-btn cmp-btn-primary" data-cmp-act="pomo-start">' +
                esc(t("companion_start_focus", { minutes: c.workMin })) + '</button>') +
        '</div>' +
        '<div class="cmp-block-row' + (armOn ? ' is-on' : '') + '">' +
          '<button type="button" class="cmp-block-toggle" data-cmp-act="focus-arm" ' +
            'role="switch" aria-checked="' + (armOn ? 'true' : 'false') + '" ' +
            'title="' + esc(armTitle) + '" aria-label="' + esc(armTitle) + '">' +
            '<span class="cmp-block-knob" aria-hidden="true"></span>' +
          '</button>' +
          '<span class="cmp-block-label">' + esc(armLabel) + '</span>' +
          (c.noSites ? '<span class="cmp-block-hint">' + esc(t("sat_no_sites_listed")) + '</span>' : '') +
        '</div>' +
      '</div>';
  }

  function actionsHtml(st) {
    var pauseLabel = st.paused ? t("companion_resume") : t("companion_pause");
    return sessionControlsHtml(st) +
      '<div class="cmp-actions">' +
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
    // THE ONE NEW OPTION. The popup passes nothing and renders exactly what it
    // rendered before this round - asserted byte-for-byte in the verification,
    // not argued from the shape of this default.
    var showDueList = !!options.showDueList;
    var showSessionControls = !!options.showSessionControls;
    var state = null;
    var timer = null;
    var stopped = false;

    // [H3d] THE CHAIN'S WRITE HALF: page memory, scoped to this mount. Closing
    // the panel destroys the document and takes the deadline with it, which is
    // exactly [WM.5]'s rule rather than an accident of scope.
    var chainDeadline = null;     // ms epoch, or null
    var chainCancelled = false;   // cleared when a new session begins
    var chainTimer = null;

    function chainClear() {
      if (chainTimer) { clearTimeout(chainTimer); chainTimer = null; }
      chainDeadline = null;
    }

    // IS THE COUNTDOWN ACTUALLY ON SCREEN? The page had to ask whether a tab
    // panel carried .hidden; this surface is its OWN DOCUMENT, so it asks the
    // document. A closed side panel is destroyed outright and never reaches
    // here; this covers the softer cases - the window minimised, the panel
    // occluded - where the timer would otherwise keep its promise to nobody.
    function chainVisible() {
      if (typeof document === "undefined") return false;
      if (document.visibilityState !== "visible") return false;
      return !!container.querySelector("[data-cmp-chain]");
    }

    // Seconds left, or null when no countdown is running. Called from render,
    // so it also ARMS the first time the panel sees a chaining state - once,
    // because a re-render must not restart the clock.
    function chainSecs() {
      var c = state && state.chain;
      if (!c) {
        // The chaining state is gone: a new session started, or the record was
        // dismissed. Either way the cancel is spent.
        chainClear();
        chainCancelled = false;
        return null;
      }
      if (chainCancelled) return null;
      if (chainDeadline === null) {
        chainDeadline = Date.now() + Storage.CHAIN_COUNTDOWN_MS;
        chainTick();
      }
      return Math.max(0, Math.ceil((chainDeadline - Date.now()) / 1000));
    }

    function chainTick() {
      if (chainTimer) clearTimeout(chainTimer);
      chainTimer = setTimeout(async function () {
        chainTimer = null;
        if (stopped || chainDeadline === null || chainCancelled) return;
        // THE SURFACE MUST STILL BE THERE WHEN IT FIRES. If the panel is hidden
        // the commitment was never witnessed, and the countdown simply ends -
        // the boundary notification's button is the answer for nobody looking.
        if (!chainVisible()) { chainClear(); return; }
        if (Date.now() >= chainDeadline) {
          var mode = (state && state.chain && state.chain.mode) || null;
          chainClear();
          try {
            // `data` re-read at the point of write, as every write on this
            // surface is: a foreign context's object can be superseded between
            // the render that armed this and the moment it fires.
            var fresh = await Storage.getAll();
            await Storage.startPomodoroPhase(fresh, mode ? { mode: mode } : null);
          } catch (err) {
            console.error("[LaunchPad] Companion: chained start failed", err);
          }
          await render();
          return;
        }
        // TEXT ONLY, FOUR TIMES A SECOND. The only thing that changes while the
        // countdown runs is the number, and this surface re-renders on every
        // foreign storage write already - rebuilding it four times a second for
        // one digit would fight that.
        var txt = container.querySelector("[data-cmp-chain-text]");
        if (txt) txt.textContent = t("sat_next_phase_in_seconds", { count: Math.max(0, Math.ceil((chainDeadline - Date.now()) / 1000)) });
        chainTick();
      }, 250);
    }

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
      state = await readState({ showDueList: showDueList, showSessionControls: showSessionControls });
      state.readAt = Date.now();
      // [H3d] ARM BEFORE PAINT. chainSecs reads the state readState just built
      // and starts the clock the first time it sees a chaining boundary, so the
      // number the markup carries and the number the tick continues from are the
      // same one.
      state.chainSecs = chainSecs();
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
    // [FIX-7] THE ELEMENT COMES THROUGH NOW. Every act until this round was
    // identified by its NAME alone; due-start needs the row's task and
    // workspace, which live on the button. Existing callers pass one argument
    // and btnEl is simply undefined for them.
    async function act(action, btnEl) {
      if (action === "open") {
        // The same URL the open-launchpad command builds, for the same reason:
        // chrome.tabs.create({}) would open whichever extension owns the new tab
        // override, which need not be this one.
        await chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
        // The popup is done once it has handed off to a full page.
        if (typeof window !== "undefined" && window.close) window.close();
        return;
      }
      // [FIX-6] THE THREE ACTS THE PILL USED TO OWN. Each goes through the
      // SAME Storage writer the pill called, re-reading `data` at the point of
      // write for the reason the note above gives: a second write path for any
      // of these would break the phase accounting invisibly from here.
      // [FIX-7] ONE CLICK FROM NOTHING TO A RUNNING SESSION. Activate, then
      // start - two writers, in that order, because startPomodoroPhase stamps
      // the ACTIVE task's record and there is no active task yet.
      //
      // RE-READ BETWEEN THEM. setActiveTask persists, so the object the second
      // writer needs is the one on disk rather than the one in hand - the same
      // rule the pause path above follows and for the same reason.
      if (action === "due-start") {
        var tid = btnEl && btnEl.getAttribute("data-cmp-task");
        var wid = btnEl && btnEl.getAttribute("data-cmp-ws");
        if (!tid) return;
        try {
          var f1 = await Storage.getAll();
          await Storage.setActiveTask(f1, tid, wid || null, { clearPause: true });
          var f2 = await Storage.getAll();
          await Storage.startPomodoroPhase(f2, null);
        } catch (err) {
          console.error("[LaunchPad] Companion: start-on-task failed", err);
        }
        await render();
        return;
      }
      // [H3d] CANCEL STOPS THE COUNTDOWN AND NOTHING ELSE. No phase is running
      // to stop and no session is ended: stepping off the treadmill is not the
      // same act as ending the session. It writes nothing - the cancel is page
      // memory, exactly as the deadline is - so there is no storage round trip
      // and the re-render is immediate.
      if (action === "chain-cancel") {
        chainCancelled = true;
        chainClear();
        await render();
        return;
      }
      if (action === "pomo-start") {
        try {
          var fs1 = await Storage.getAll();
          await Storage.startPomodoroPhase(fs1, null);
        } catch (err) {
          console.error("[LaunchPad] Companion: focus session start failed", err);
        }
        await render();
        return;
      }
      if (action === "pomo-stop") {
        try {
          var fs2 = await Storage.getAll();
          await Storage.stopPomodoro(fs2);
        } catch (err) {
          console.error("[LaunchPad] Companion: focus session stop failed", err);
        }
        await render();
        return;
      }
      if (action === "focus-arm") {
        try {
          var fs3 = await Storage.getAll();
          // ADDITIVE, exactly as the pill's row was: the control owns the
          // MANUAL arm only, so a tap is always "flip my manual arm" and never
          // a fight with the auto path.
          await Storage.setFocusArmed(fs3, !Storage.isFocusManuallyArmed(fs3));
        } catch (err) {
          console.error("[LaunchPad] Companion: blocking arm toggle failed", err);
        }
        await render();
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
      act(btn.getAttribute("data-cmp-act"), btn);
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
      // [H3d] AND THE CHAIN'S TIMER. A 250ms timeout outliving the view would
      // keep calling startPomodoroPhase against a document nobody is looking at,
      // which is the whole thing the visibility rule exists to prevent.
      chainClear();
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
