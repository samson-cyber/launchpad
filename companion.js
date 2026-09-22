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
    // [H4.0] AND A SECOND, SEPARATE OPT-IN FOR THE THREE DAILY CONTROLS.
    // e597640 spelled this `showControls` and read it into a variable also
    // called wantControls - so re-applying it on top of FIX-6 collided on both
    // names at once. They are different features and the panel wants both;
    // the popup passes neither, which is the standing ruling on that surface.
    var wantDaily = !!(opts && opts.showDailyControls);
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
      // [H2c] THE MODE RIDES EVERY RENDER, not just the panel's controls tile.
      // The spec gives the POPUP a chip too ("ring, chip, task, the two
      // figures"), and the chip is the Work stamp - so this is read on the base
      // state rather than behind an option, which is also what lets the panel's
      // chip and its mode segment come from one read and never disagree.
      mode: Storage.getWorkspaceMode(Storage.getActiveWorkspace(data)),
      pomo: pomo ? {
        phase: pomo.phase,
        label: Storage.POMODORO_PHASE_LABELS[pomo.phase] || "Focus",
        remainingMs: Storage.pomodoroRemainingMs(data, pomo),
        // [H2c] THE RING NEEDS THE WHOLE, not just what is left. runningPomodoro
        // already returns totalMs (its own phaseDurationMs, or the configured
        // total for the phase), so the sweep is derived from the engine's own
        // two numbers rather than from a duration this file guesses at.
        totalMs: pomo.totalMs || 0
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
      due: null,
      // [BELL-PANEL, renamed in H4.0] The three daily controls, read only where
      // they are shown. Absent on the popup, which has no height to put them in.
      //
      // THIS LINE SAID `controls: null` AND IT WAS A DUPLICATE KEY. FIX-6's
      // session controls are declared `controls:` earlier in THIS SAME literal,
      // so the re-apply gave one object two `controls` keys and the last one
      // won: st.controls was null everywhere, which silently removed Start,
      // Stop, the blocking arm AND every due row's play glyph while the list
      // above them rendered perfectly. Git reported no conflict and node
      // --check no error.
      daily: null
    };

    if (wantDue) {
      try {
        var work = Storage.getDueWork(data);
        var live = (work.items || []).filter(function (it) { return !it.snoozed; });
        // ORDERED BY KIND BEFORE THE CAP, WHICH IS THE PART THAT MATTERS.
        // getDueWork pushes rows in due-day order, so a flat slice(0, 6) took
        // whichever six came first and could drop an overdue row to show a
        // recurring one. The bell renders overdue -> today -> recurring, so the
        // panel sorts into that order FIRST and caps afterwards: the six it
        // shows are now the six the bell shows first, and "3 more" is the same
        // tail. Stable within a kind, because sort() is stable and the input is
        // already the bell's own order.
        var rank = { overdue: 0, today: 1, recurring: 2 };
        var ordered = live.slice().sort(function (a, b) {
          return (rank[a.kind] == null ? 9 : rank[a.kind]) - (rank[b.kind] == null ? 9 : rank[b.kind]);
        });
        st.due = {
          total: live.length,
          // [H4.0] e597640's `ordered` REPLACES master's `live` here - that is
          // the whole point of the kind-sort above, and slicing `live` would
          // have left the sort computed and unused, which is the defect
          // e597640 was written to fix still present with a comment claiming
          // otherwise.
          items: ordered.slice(0, DUE_LIST_MAX).map(function (it) {
            // [FIX-7] ws RIDES ALONG, AND e597640 DROPPED IT - it predates the
            // rows being actionable. Kept: activating a task needs the
            // workspace it lives in, and a due row can be from any of them.
            return { id: it.taskId, name: it.name, kind: it.kind, ws: it.workspaceId };
          })
        };
      } catch (err) {
        console.error("[LaunchPad] Companion: due-work read failed", err);
        st.due = { total: 0, items: [] };
      }
    }

    // [BELL-PANEL] THE THREE DAILY CONTROLS, READ THROUGH STORAGE'S OWN
    // READERS. Mode and tracking are per-workspace and hang off the ACTIVE
    // workspace - the same one getDueWork scopes to, so the panel never mixes
    // one workspace's due list with another's switches. Reminders is a settings
    // flag and is global, which is why it has no workspace beside it.
    // [H4.0] st.daily, NOT st.controls - AND THIS ONE AUTO-MERGED WITHOUT A
    // CONFLICT, which is why it is worth a note. FIX-6 put the SESSION controls
    // on st.controls; this block assigned the DAILY controls to the same
    // property, later in the same function, so on the side panel it overwrote
    // them. sessionControlsHtml would have read c.arm and c.running off an
    // object carrying neither and rendered nothing, while FIX-7's
    // `!!st.controls` stayed truthy and kept drawing the play glyphs. Two
    // features, two shapes, one name: separated here rather than sequenced.
    if (wantDaily) {
      try {
        var cws = Storage.getActiveWorkspace(data);
        // NO `mode` HERE. It used to be read a second time into this object,
        // and once the chip put it on the base state that was two reads of one
        // value on one render - the shape that lets a surface disagree with
        // itself. The segment and the hint below both take st.mode.
        st.daily = cws ? {
          workspaceId: cws.id,
          workspaceName: cws.name || cws.id,
          tracking: Storage.isTrackingEnabled(cws),
          reminders: Storage.getDueRemindersEnabled(data)
        } : null;
      } catch (err) {
        console.error("[LaunchPad] Companion: daily-controls read failed", err);
        st.daily = null;
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
  // [H2c] THE ROUTE IS A LINK, NOT A BUTTON, and that is the spec's "Pause and
  // the link" read literally. Opening LaunchPad is a way OUT of this surface
  // rather than something it does; giving it a second filled button would put
  // two equal-weight actions on one view, which the one-action rule forbids.
  // Still a <button> element - it performs an action rather than navigating a
  // document, so a link element here would lie to a keyboard and a reader.
  function routeHtml() {
    return '<button type="button" class="cmp-link" data-cmp-act="open">' +
        esc(t("companion_open_launchpad")) +
      '</button>';
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
  // THE KIND IS A WORD, NOT A COLOUR - and after [BELL-PANEL] the word is a
  // GROUP HEADING rather than a tag on the row, which is the bell's own shape.
  // Saying it in text still means the row does not depend on a hue to be read,
  // and it keeps this surface out of the business of inventing a second urgency
  // scale beside the trash countdown's.
  //
  // [BELL-PANEL] THE HEADING, THE GROUPS AND THE WORD ARE THE BELL'S, REUSED
  // RATHER THAN RESTATED. The census found the two surfaces naming one list two
  // ways - the bell "Due work", the panel "Due now" - and the ruling is one
  // word. These are the BELL'S catalogue keys (bell_due_work_label,
  // bell_group_*), not new ones: a second string saying the same thing is the
  // drift the ruling is about, one catalogue entry further down. An empty group
  // is ABSENT rather than rendered empty, exactly as dueBellListHtml does it.
  var DUE_GROUPS = [
    { kind: "overdue",   key: "bell_group_overdue" },
    { kind: "today",     key: "bell_group_today" },
    { kind: "recurring", key: "bell_group_recurring" }
  ];

  function dueListHtml(st) {
    if (!st.due) return "";
    if (!st.due.total) {
      return '<div class="cmp-tile cmp-tile--list cmp-due-empty">' +
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
    //
    // [H4.0] THE GLYPH NOW RIDES INSIDE e597640's GROUPS. The two versions of
    // this function each built the <li> themselves - one grouped and inert,
    // one flat and actionable - so neither could simply win: grouping without
    // the glyph loses the only way to start work from this surface, and the
    // glyph without grouping loses the one definition of due. The group walk
    // is e597640's; the row's contents are FIX-7's.
    //
    // THE PER-ROW "Overdue" TAG IS GONE, and that is e597640's call kept
    // deliberately: the group HEADING carries the word now, so the tag was the
    // same fact printed twice on one line.
    var canStart = !!st.controls;
    var body = DUE_GROUPS.map(function (g) {
      var rows = st.due.items.filter(function (it) { return it.kind === g.kind; });
      if (!rows.length) return "";               // absent, never an empty group
      // [H4.0] THE KIND RIDES ON THE HEADING so "Overdue is a word in the
      // action colour" has something to select. g.kind is already the group's
      // identity here - this is a hook on it, not a second definition of it.
      return '<div class="cmp-due-group cmp-due-group--' + g.kind + '">' +
          esc(t(g.key)) + '</div>' +
        '<ul class="cmp-due-list">' +
          rows.map(function (it) {
            return '<li class="cmp-due-row">' +
                (canStart
                  ? '<button type="button" class="cmp-due-play" data-cmp-act="due-start" ' +
                      'data-cmp-task="' + esc(it.id) + '" data-cmp-ws="' + esc(it.ws || "") + '" ' +
                      'title="' + esc(t("companion_start_on_task", { name: it.name })) + '" ' +
                      'aria-label="' + esc(t("companion_start_on_task", { name: it.name })) + '">\u25b6</button>'
                  : '') +
                '<span class="cmp-due-name" title="' + esc(it.name) + '">' + esc(it.name) + '</span>' +
              '</li>';
          }).join("") +
        '</ul>';
    }).join("");
    var more = st.due.total > st.due.items.length
      ? '<div class="cmp-due-more">' + esc(t("companion_due_more", { count: st.due.total - st.due.items.length })) + '</div>'
      : "";
    // [H2c] THE LIST TILE. The faintest of the family at 72%, which is what
    // makes a list read as somewhere to rest rather than as another card.
    return '<div class="cmp-tile cmp-tile--list">' +
        '<div class="cmp-eyebrow cmp-due-head">' + esc(t("bell_due_work_label", { count: st.due.total })) + '</div>' +
        body +
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
      return '<div class="cmp-tile cmp-locked">' +
          '<p class="cmp-locked-text">' + esc(t("companion_locked")) + '</p>' +
          routeHtml() +
        '</div>';
    }

    if (!st.task) {
      // [1.9.5 finding 5] ONE amber signal: the head says the state, so the
      // eyebrow carries it and nothing else does.
      // [H2c] THREE TILES, SIDE BY SIDE IN THE ROOT, not three regions inside
      // one card. That is the whole structural move of this round: .cmp-root is
      // a column with the grid's own gap, so the module, the list and the
      // controls read as three things a panel holds rather than as one long
      // card with rules drawn across it.
      return '<div class="cmp-tile cmp-empty' + (st.paused ? " is-paused" : "") + '">' +
          '<div class="cmp-empty-row">' +
            (st.paused ? '<span class="cmp-glyph cmp-glyph-paused" aria-hidden="true">&#9208;</span>' : '') +
            '<span class="cmp-empty-text">' + esc(t("companion_no_active_task")) + '</span>' +
            (st.paused ? '<span class="cmp-eyebrow cmp-eyebrow-paused">' + esc(t("companion_paused")) + '</span>' : '') +
            modeChipHtml(st) +
          '</div>' +
          '<div class="cmp-actions">' + routeHtml() + '</div>' +
        '</div>' +
        // THE EMPTY STATE IS WHERE THE LIST EARNS ITS PLACE MOST. No session is
        // running, so the tile above says almost nothing - and "what should I be
        // doing" is exactly the question a user with no active task came to this
        // surface with.
        dueListHtml(st) +
        controlsHtml(st);
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

    return '<div class="cmp-tile' + (st.paused ? " is-paused" : "") + '">' +
        // [H2c] THE HEAD IS RING, CHIP, EYEBROW, in the spec's own order. The
        // ring REPLACES the glyph during a phase rather than sitting beside it:
        // both say "a phase is running" and two marks for one fact is the
        // doubling the 1.9.5 finding below already rejected once for PAUSED.
        '<div class="cmp-head">' +
          (st.pomo
            ? ringHtml(st)
            : '<span class="cmp-glyph' + (st.paused ? " cmp-glyph-paused" : "") + '" aria-hidden="true">' + glyph + '</span>') +
          // [H4.0] "ONE AMBER SIGNAL PER SURFACE: the ring when a session
          // runs, the label only when no ring." The ring and the glyph are
          // already mutually exclusive on st.pomo one line above, so st.pomo IS
          // "there is a ring" - and when there is, the ring carries the pause
          // and this label does not. H2c had both amber and argued they read as
          // one signal because they sit adjacent; the ruling says otherwise.
          '<span class="cmp-eyebrow' + (st.paused && !st.pomo ? " cmp-eyebrow-paused" : "") + '">' + esc(eyebrow) + '</span>' +
          modeChipHtml(st) +
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
      '</div>' +
      dueListHtml(st) +
      controlsHtml(st);
  }

  // [H2c] THE RING. A conic sweep of the phase that has ELAPSED, so it fills as
  // the countdown empties - the direction every progress ring in this product
  // reads. --p is a percentage on the element's own style attribute, which the
  // CSP allows (style-src carries 'unsafe-inline'); the alternative is a class
  // per percent.
  //
  // IT IS DECORATION IN THE STRICT SENSE and is marked aria-hidden: the phase
  // label sits beside it and the countdown sits beneath it, both as text, so a
  // screen reader that never sees this loses nothing. That is also why its floor
  // is 3:1 against the tile rather than 4.5 - it is a graphical fill, not a word.
  //
  // A ZERO-LENGTH PHASE CANNOT DIVIDE. totalMs is 0 when runningPomodoro had no
  // duration to report, and 0/0 would paint NaN% - which CSS drops, leaving the
  // ring at its default 0 rather than at an arbitrary sweep.
  function ringHtml(st) {
    var total = st.pomo && st.pomo.totalMs;
    var pct = 0;
    if (total > 0) {
      pct = Math.round(((total - st.pomo.remainingMs) / total) * 100);
      pct = Math.max(0, Math.min(100, pct));
    }
    return '<span class="cmp-ring" aria-hidden="true" style="--p:' + pct + '"></span>';
  }

  // [H2c] THE WORK CHIP. The stamp the pill already carries, on this surface for
  // the first time. Work only: Casual is the default and a chip that is always
  // present says nothing. It is the ONE place the action colour touches this
  // tile, and it takes the action tile's own pairing - opaque --action with
  // --ink-on-action - which is the pairing H0 measured at 7.53, rather than
  // action ink on an action tint.
  //
  // AND IT IS SUPPRESSED WHEN IT WOULD SAY THE EYEBROW'S WORD BACK, which the
  // first rendered frame of this round is the reason for. During a POMODORO
  // WORK PHASE the eyebrow is the phase label - "Work" - and the chip beside it
  // said "WORK" too: two adjacent identical words, in two weights, meaning two
  // different things (this phase is a work phase / this workspace is
  // disciplined). It reads as a rendering fault, which is exactly what [1.9.5
  // finding 5] found when PAUSED printed twice on one 360px card, and the fix is
  // the one that finding used: SAY IT ONCE.
  //
  // The comparison is against the phase LABEL rather than against the phase key,
  // because the collision is a collision of WORDS - a "Short break" phase in a
  // Work workspace does not collide and keeps its chip, which is the case where
  // the chip is most worth having.
  function modeChipHtml(st) {
    if (st.mode !== "work") return "";
    var label = t("wsmode_work");
    if (st.pomo && String(st.pomo.label).toLowerCase() === String(label).toLowerCase()) return "";
    return '<span class="cmp-chip">' + esc(label) + '</span>';
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
            : '<button type="button" class="cmp-btn" data-cmp-act="pomo-start">' +
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
    // [H4.0] THE CLASS WEIGHTS ARE INVERTED BETWEEN THE TWO SIDES, so neither
    // literal string could simply win. On master .cmp-btn was the QUIET control
    // and .cmp-btn-primary the loud one; in H2c's language .cmp-btn IS the loud
    // one (background: var(--action)) and .cmp-link is the quiet one. Taking
    // master's string here would have painted pause in a fill master never gave
    // it, and taking H2c's without the prefix below would have deleted the
    // session block from the panel.
    //
    // So: H2c's .cmp-btn for pause - the popup's one solid control, beside
    // routeHtml's .cmp-link, which is the shape H2c was accepted with - and
    // master's sessionControlsHtml prefix kept intact.
    // [H4.0] PAUSE IS QUIET WHERE START EXISTS, LOUD WHERE IT IS ALONE.
    // Two solid --action buttons appeared on the idle panel once these two
    // commits met, and the frame is what showed it. FIX-6 had ranked them -
    // Start loud, Pause quiet - but it ranked them on MASTER's scale, where
    // .cmp-btn was the quiet class; in H2c's scale .cmp-btn is the loud one, so
    // carrying each literal class across flattened the ranking rather than
    // preserving it.
    //
    // st.controls is the panel/popup discriminator this file already uses (it
    // is what FIX-7 gates the play glyph on), so no new condition is invented.
    // On the popup Pause is the only control and stays solid, which is exactly
    // the shape H2c was accepted with.
    var pauseClass = st.controls ? "cmp-link" : "cmp-btn";
    return sessionControlsHtml(st) +
      '<div class="cmp-actions">' +
        '<button type="button" class="' + pauseClass + '" data-cmp-act="' +
          (st.paused ? "resume" : "pause") + '">' + esc(pauseLabel) + '</button>' +
        routeHtml() +
      '</div>';
  }

  // [BELL-PANEL] THE THREE DAILY CONTROLS, AND WHY THESE THREE.
  //
  // The census measured this panel at 900px and found the module and its list
  // occupying about a third of it, with the rest void. The ruling spends that
  // void on the three switches a user flips during a day rather than while
  // configuring: the workspace's mode, whether reminders fire, and whether this
  // workspace is tracked. Everything else in Settings is set once and left.
  //
  // THEY ARE NOT A SECOND IMPLEMENTATION OF ANYTHING. Each one reads through
  // Storage's own reader and writes through Storage's own writer - the SAME
  // functions the page's controls call. This file owns no mode logic, no
  // reminder logic and no tracking logic, which is the one-writer rule and the
  // reason a change here cannot disagree with the page.
  //
  // WHY BUTTONS AND NOT CHECKBOXES. The container already carries ONE delegated
  // click listener, so a button-based switch needs no second listener and no
  // change-event plumbing, and `role="switch"` with `aria-checked` gives a
  // screen reader the same thing a checkbox would. It also keeps every control
  // on this surface in one idiom.
  //
  // THE SEGMENT SAYS WHICH WORKSPACE IT IS ACTING ON, because mode and tracking
  // are per-workspace and a panel that sits open for hours beside a page where
  // the workspace can be switched must not look global. Reminders carries no
  // workspace name for the same reason inverted: it IS global.
  function controlsHtml(st) {
    // [H4.0] st.daily - see the read above. This function is the DAILY controls
    // (mode / reminders / tracking); sessionControlsHtml is the session ones.
    if (!st.daily) return "";
    var c = st.daily;
    var seg = [
      { mode: "work",   key: "wsmode_work" },
      { mode: "casual", key: "wsmode_casual" }
    ].map(function (o) {
      var on = st.mode === o.mode;
      return '<button type="button" class="cmp-seg-btn' + (on ? " is-on" : "") + '"' +
          ' data-cmp-act="mode-' + o.mode + '" aria-pressed="' + (on ? "true" : "false") + '">' +
          esc(t(o.key)) + '</button>';
    }).join("");

    function switchRow(label, on, action) {
      return '<div class="cmp-ctl-row">' +
          '<span class="cmp-ctl-label">' + esc(label) + '</span>' +
          '<button type="button" class="cmp-switch' + (on ? " is-on" : "") + '"' +
            ' role="switch" aria-checked="' + (on ? "true" : "false") + '"' +
            ' data-cmp-act="' + action + '">' +
            '<span class="cmp-switch-knob" aria-hidden="true"></span>' +
          '</button>' +
        '</div>';
    }

    // [H2c] THE HINT, AND IT IS THE RULED PART OF THIS TILE.
    //
    // A due reminder is suppressed OUTRIGHT when the workspace is not in Work -
    // storage.js returns an empty set before it looks at a single task - so on
    // Casual this toggle can read ON while nothing will ever fire. Saying so
    // where the control is, rather than leaving the user to find out by silence,
    // is the same fix the schedule editor's mode note already makes.
    //
    // RENDERED ONLY ON CASUAL, because on Work it is not a condition to warn
    // about. Same gate, same string and same shape as .dash-tile-hint on the
    // Dashboard's due tile (H1a) - dash_reminders_work_only is reused rather
    // than a second string saying the same sentence.
    //
    // It sits UNDER the reminders row rather than under the head, because on
    // this surface the switch it qualifies is a row in a list of rows and a hint
    // floating at the top would attach itself to the wrong one.
    var casual = st.mode !== "work";
    var remindersHint = casual
      ? '<p class="cmp-ctl-hint">' + esc(t("dash_reminders_work_only")) + '</p>'
      : "";

    return '<div class="cmp-tile cmp-controls">' +
        '<div class="cmp-eyebrow cmp-ctl-head">' + esc(c.workspaceName) + '</div>' +
        '<div class="cmp-seg" role="group" aria-label="' +
          esc(t("wsmode_group_label", { workspaceName: c.workspaceName })) + '">' + seg + '</div>' +
        switchRow(t("prosettings_reminders"), c.reminders, "toggle-reminders") +
        remindersHint +
        switchRow(t("settings_track_time_on_sites"), c.tracking, "toggle-tracking") +
        '<p class="cmp-ctl-note" data-cmp-ctl-note hidden></p>' +
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
    // [BELL-PANEL, renamed in H4.0] THE THIRD OPTION, and it is a separate one
    // for the same reason the others are: the popup has no height to spend, so
    // it passes nothing and renders exactly what it rendered before.
    var showDailyControls = !!options.showDailyControls;
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
      state = await readState({
        showDueList: showDueList,
        showSessionControls: showSessionControls,
        showDailyControls: showDailyControls
      });
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
        return;
      }

      // [BELL-PANEL] THE THREE CONTROLS. `data` is re-read here for the reason
      // stated above the pause branch - this is a foreign context and the object
      // readState returned can be superseded between open and click.
      //
      // TWO OF THESE WRITERS ARE MUTATE-ONLY AND ONE SAVES ITSELF, and getting
      // that backwards is silent either way. setWorkspaceMode and
      // setTrackingEnabled are pure mutations on the in-memory object (J5 -
      // Storage is stateless-by-argument), so the caller owns the saveAll;
      // setDueRemindersEnabled awaits its OWN saveAll, so a saveAll after it
      // would be a second write of the same object. The page's handlers make the
      // same distinction, which is why this reads the way newtab.js reads.
      if (action === "mode-work" || action === "mode-casual") {
        try {
          var modeData = await Storage.getAll();
          var modeWs = Storage.getActiveWorkspace(modeData);
          if (!modeWs) return;
          // Returns false when the value is unchanged, so clicking the segment
          // you are already on emits no write and no re-render.
          if (!Storage.setWorkspaceMode(modeData, modeWs.id, action === "mode-work" ? "work" : "casual")) return;
          await Storage.saveAll(modeData);
        } catch (err) {
          console.error("[LaunchPad] Companion: mode write failed", err);
        }
        await render();
        return;
      }

      if (action === "toggle-tracking") {
        try {
          var trkData = await Storage.getAll();
          var trkWs = Storage.getActiveWorkspace(trkData);
          if (!trkWs) return;
          Storage.setTrackingEnabled(trkData, trkWs.id, !Storage.isTrackingEnabled(trkWs));
          await Storage.saveAll(trkData);
        } catch (err) {
          console.error("[LaunchPad] Companion: tracking toggle failed", err);
        }
        await render();
        return;
      }

      if (action === "toggle-reminders") {
        // THE PERMISSION IS REQUESTED FROM THIS GESTURE AND ONLY IN THE ON
        // BRANCH, which is the shape newtab.js's #due-reminders-toggle already
        // uses and the reason the phase-boundary toggle can share the same
        // optional permission without either owning it. A click in a side panel
        // IS a user gesture, so the request is allowed to prompt here.
        //
        // DENIED NEVER FLIPS THE FLAG. A reminders switch that reads ON while
        // the browser will not deliver a notification is a surface telling the
        // user something untrue, which is worse than the switch refusing to move.
        try {
          var remData = await Storage.getAll();
          var turningOn = !Storage.getDueRemindersEnabled(remData);
          if (turningOn) {
            var granted = false;
            try {
              granted = await new Promise(function (resolve) {
                chrome.permissions.request({ permissions: ["notifications"] }, function (g) { resolve(!!g); });
              });
            } catch (err2) {
              console.error("[LaunchPad] Companion: permission request failed", err2);
              granted = false;
            }
            if (!granted) {
              var note = container.querySelector("[data-cmp-ctl-note]");
              if (note) {
                note.textContent = t("bind_notifications_permission_was_declined");
                note.hidden = false;
              }
              return;
            }
          }
          // Saves itself - no saveAll after this one.
          await Storage.setDueRemindersEnabled(remData, turningOn);
        } catch (err) {
          console.error("[LaunchPad] Companion: reminders toggle failed", err);
        }
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
