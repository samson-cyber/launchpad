/* global chrome */

// [1.2.0 R2 / PLAN C5-C7] Focus blocking gate page.
//
// This page is NOT on the flash-critical path — by the time it renders, the
// redirect has already happened — so unlike the intercept it can afford to wait
// for a round-trip and for a durable write.
//
// It deliberately does NOT load storage.js (206 KB): everything it needs is
// computed by the worker, where storage.js already lives, and arrives in one
// message. The headline renders immediately from the query string so the page is
// never blank while that is in flight.
//
// ALL WRITES GO THROUGH THE WORKER, never chrome.storage directly from here:
// page-side writes would race the intercept's own counter writes. Routing them
// through the worker puts them in the SAME enqueueBgData FIFO as every other
// background `data` writer (BUGS.md L1) — one queue, not two.

(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var target = params.get("to") || "";
  var entry = params.get("entry") || "";

  var $ = function (id) { return document.getElementById(id); };
  var domainEl = $("gate-domain");
  var contextEl = $("gate-context");
  var footnoteEl = $("gate-footnote");
  var snoozeBtn = $("gate-snooze");
  var endBtn = $("gate-end");
  var continueBtn = $("gate-continue");
  var headlineEl = document.querySelector(".gate-headline");

  var actionsEl = document.querySelector(".gate-actions");
  // The headline's trailing text node, captured before anything rewrites it, so
  // a re-render back to the blocked state can put it back.
  var HEADLINE_BLOCKED = (headlineEl && headlineEl.lastChild && headlineEl.lastChild.nodeType === 3)
    ? headlineEl.lastChild.nodeValue : " is blocked";

  // ABSENT, NOT DISABLED. Removed from the DOM, so there is nothing to tab to
  // and nothing greyed out implying a state the user could reach.
  function dropControl(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  // [WM.3] THE ACTIONS ROW IS REBUILT EACH RENDER, not patched. WM.2 removed
  // whichever control did not apply, which is correct exactly once - and this
  // page now re-renders when blocking changes underneath it, so a control that
  // was removed has to be able to come back. Emptying and re-appending from
  // three held references is the only version of that with no order to get
  // wrong.
  dropControl(snoozeBtn);
  dropControl(endBtn);
  dropControl(continueBtn);

  // TEXT NODES ONLY for anything derived from the query string. `entry` is
  // normalized before it is ever stored, but this page is reachable with an
  // arbitrary query, so it is treated as untrusted input regardless. textContent
  // cannot introduce markup; innerHTML here would be an injection sink.
  domainEl.textContent = entry || "This site";

  // Only ever navigate back to an http(s) target — the same scheme allowlist the
  // intercept uses. A crafted ?to=javascript:... must not be followed.
  function safeTarget() {
    if (!target) return null;
    if (target.lastIndexOf("http://", 0) !== 0 && target.lastIndexOf("https://", 0) !== 0) return null;
    return target;
  }

  function goBackToSite() {
    var t = safeTarget();
    // replace(), not assign(): the gate should not sit in history between the
    // site and itself, or Back from the site lands on the gate again.
    if (t) location.replace(t);
    else location.replace(chrome.runtime.getURL("newtab.html"));
  }

  function send(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (res) {
          if (chrome.runtime.lastError) return resolve(null);   // BUGS.md A3
          resolve(res);
        });
      } catch (e) { resolve(null); }
    });
  }

  function fmtMinutes(ms) {
    var mins = Math.floor(ms / 60000);
    if (mins < 1) return I18n.t("gate_less_than_a_minute");
    return I18n.t("gate_minutes", { count: mins });
  }

  // ---- state round-trip: the reason line and the end-control label ----------
  //
  // C6: the label names exactly what the click will do. [WM.2] And the REASON
  // now comes from Storage.blockingReasonFor by way of the worker - this page
  // no longer works anything out for itself. It used to receive phaseRunning
  // and manualArmed and derive its own answer, which is a second derivation
  // parallel to the one the intercept uses; with two, the page could label a
  // control for one cause while a second cause was what actually held the user
  // here. Now there is one.
  //
  // THREE REASONS ARE RENDERED THOUGH ONLY ONE CAN FIRE. WM.3 builds schedules
  // and budgets; their copy is already here and already catalogued, so that
  // round adds a branch to the reader and writes no gate copy at all.
  var endMode = "none";

  function reasonText(st) {
    if (st.reason === "budget") {
      return I18n.t("gate_reason_budget", { domain: entry || I18n.t("gate_this_site") });
    }
    if (st.reason === "schedule") {
      return I18n.t("gate_reason_schedule", { domain: entry || I18n.t("gate_this_site") });
    }
    if (st.reason === "session") {
      if (st.phaseRunning && st.taskName) {
        return I18n.t("gate_reason_session_task",
          { duration: fmtMinutes(st.elapsedMs), taskName: st.taskName });
      }
      if (st.phaseRunning) {
        return I18n.t("gate_reason_session", { duration: fmtMinutes(st.elapsedMs) });
      }
      return I18n.t("gate_reason_session_armed");
    }
    // No reason at all. Reachable two ways: Pro lapsed while this tab sat here
    // (PLAN decision H - expired renders the gate inert), or the page was
    // opened directly. Either way nothing is holding the user, and the page
    // says so rather than pretending otherwise.
    return I18n.t("gate_reason_none");
  }

  function setHeadlineTail(text) {
    // The headline keeps its domain chip and only its TRAILING TEXT NODE
    // changes, which is the same node i18n-dom writes into and the reason the
    // chip survives.
    if (headlineEl && headlineEl.lastChild && headlineEl.lastChild.nodeType === 3) {
      headlineEl.lastChild.nodeValue = text;
    }
  }

  function show(btn) {
    btn.disabled = false;
    actionsEl.appendChild(btn);
  }

  function render(st) {
    // [WM.4] A RE-RENDER WHILE FRICTION IS UP WOULD RESTORE THE ACTIONS ROW
    // UNDER IT. The panel owns the surface until it is dismissed or satisfied,
    // and the storage change that triggered the re-render is almost always the
    // snooze this very countdown is waiting to write.
    if (frictionPlan) return;
    actionsEl.textContent = "";
    if (!st || !st.ok) {
      // The worker did not answer. Leave both real controls in place with the
      // generic label: failing to reach the worker is not evidence that the
      // user is unblocked, and removing their way out would be the worse error.
      setHeadlineTail(HEADLINE_BLOCKED);
      endBtn.textContent = I18n.t("gate_turn_off_focus");
      show(snoozeBtn);
      show(endBtn);
      return;
    }

    contextEl.textContent = reasonText(st);
    endMode = st.endMode || "none";

    if (!st.reason) {
      // AN INERT GATE MUST NOT CONTRADICT ITSELF, and the first version did.
      // The reason line said blocking was not on while the headline above it
      // still read "<domain> is blocked" and the footnote below still described
      // the rule as live - three statements, two of them false, on one page.
      // Caught by looking at the rendered frame rather than at the code.
      setHeadlineTail(" " + I18n.t("gate_is_not_blocked"));
      // Snoozing something that is not blocking you is meaningless, so the
      // whole blocked-page vocabulary goes and one plain way onward remains.
      show(continueBtn);
      footnoteEl.textContent = "";
      return;
    }

    setHeadlineTail(HEADLINE_BLOCKED);
    show(snoozeBtn);
    // Nothing to end: a budget and a schedule are not things you "end", so the
    // control is ABSENT for those two reasons and for an inert gate.
    if (endMode !== "none") {
      endBtn.textContent = (endMode === "both") ? I18n.t("gate_end_focus")
        : (endMode === "session") ? I18n.t("gate_end_focus_session")
        : I18n.t("gate_turn_off_focus");
      show(endBtn);
    }
    footnoteEl.textContent = entry
      ? I18n.t("gate_blocking_domain", { domain: entry })
      : "";
  }

  function refresh() {
    return send({ type: "focus-gate-state", entry: entry }).then(render);
  }
  refresh();

  // ---- [WM.3] the page keeps up ---------------------------------------------
  //
  // WM.2's follow-up found this page renders from a snapshot taken at load: a
  // user who turned blocking off in another tab came back to a page still
  // claiming to block them, and the only way forward was a reload. Now the
  // reasons the decision depends on are watched, and the page re-asks.
  //
  //   data                 the arm, the phase, the entries, the workspace mode
  //   focus_budget_today   the minutes a budget is spent against
  //
  // tracking_days is deliberately NOT watched: it changes on every tab switch
  // and it is not what the decision reads - the worker derives the budget
  // figures from it, and THAT derived key is the one that matters here.
  //
  // THE PAGE ASKS THE WORKER; IT NEVER READS OR WRITES STORAGE ITSELF. That was
  // already true and it is now load-bearing (I28): an answer that wrote would be
  // a change, and a change is another ask. The worker's side reads raw `data`
  // rather than getAll for the same reason.
  //
  // DEBOUNCED, because a single user action lands as several writes - ending a
  // session writes the phase and the arm - and one settled answer is worth more
  // than three racing ones.
  var refreshTimer = null;
  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { refreshTimer = null; refresh(); }, 120);
  }
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName && areaName !== "local") return;
      if (!changes.data && !changes.focus_budget_today) return;
      scheduleRefresh();
    });
  }
  // A schedule window closes at a wall-clock minute, with no storage write to
  // announce it. One coarse tick covers it; it costs a message a minute on a
  // page the user is looking at, and nothing at all otherwise.
  setInterval(function () { refresh(); }, 60000);

  // ---- Continue, on an inert gate --------------------------------------
  //
  // IT GOES TO LAUNCHPAD, NOT TO THE DESTINATION, and that is Samson's ruling
  // rather than a technical constraint - ?to= is present and reliable on this
  // state, so either would build. What decided it is what the two do when they
  // are wrong.
  //
  // THE BUTTON WAS NEVER INERT. It called goBackToSite() and that navigated in
  // all four branches, measured. What made it READ as a dead button is where it
  // landed: this page renders from a snapshot taken when it loaded, and if
  // blocking is live again by the time the click happens - the user re-armed it,
  // or started a focus session, or auto-arm fired at a work phase - then the
  // navigation is intercepted and the tab comes straight back to gate.html. Same
  // URL, same page. Reproduced both ways in this round's report.
  //
  // newtab.html CANNOT BE INTERCEPTED. focusInterceptCandidateHost only ever
  // considers http(s), so an extension page is refused in one comparison before
  // any policy question is asked. Continue-to-LaunchPad therefore always lands
  // somewhere; Continue-to-destination can always bounce.
  //
  // location.replace, not assign: the inert gate should not sit in history
  // between the user and where they end up, for the same reason goBackToSite
  // replaces rather than assigns.
  continueBtn.addEventListener("click", function () {
    continueBtn.disabled = true;
    location.replace(chrome.runtime.getURL("newtab.html"));
  });

  // ---- [5 more minutes] — C7, and [WM.4] the friction in front of it --------
  //
  // THE GATE STAYS A DOOR (PLAN decision E). Nothing here refuses; the door
  // simply takes a moment to open, and the moment is REPORTED rather than
  // argued. No red, no pulse, no copy about discipline - a number counting down
  // and a way out that works at every instant.
  var frictionEl = $("gate-friction");
  var frictionLine = $("gate-friction-line");
  var ringFill = $("gate-ring-fill");
  var ringNum = $("gate-ring-num");
  var commitEl = $("gate-commit");
  var commitLabel = $("gate-commit-label");
  var commitInput = $("gate-commit-input");
  var frictionCancel = $("gate-friction-cancel");
  var frictionGo = $("gate-friction-go");

  // The Dashboard ring's own geometry. ITS CSS CANNOT BE SHARED - gate.css is a
  // standalone sheet with no newtab.css and no has-bg surface model, by its own
  // header - so what is shared is the part that makes it that ring: a 100-unit
  // viewBox, r=45, a non-scaling stroke, and a sweep by stroke-dashoffset from
  // full circumference to zero. The two colours are the gate's own green,
  // because --sat-accent is the product blue and this page is not that page.
  // tools/check-focus-decision.mjs asserts the radius here matches newtab.js's
  // DASH_RING_R, so the geometry cannot drift even though the sheets are apart.
  var RING_R = 45;
  var RING_C = 2 * Math.PI * RING_R;
  ringFill.setAttribute("stroke-dasharray", RING_C.toFixed(2));
  ringFill.setAttribute("stroke-dashoffset", "0");

  var frictionTimer = null;
  var frictionPlan = null;
  var frictionEndsAt = 0;

  function frictionReady() {
    if (!frictionPlan) return false;
    if (Date.now() < frictionEndsAt) return false;
    if (frictionPlan.needsSentence) {
      return commitInput.value.trim() === frictionPlan.sentence;
    }
    return true;
  }

  function paintFriction() {
    var leftMs = Math.max(0, frictionEndsAt - Date.now());
    var secs = Math.ceil(leftMs / 1000);
    var total = frictionPlan ? frictionPlan.delayMs : 1;
    ringNum.textContent = secs > 0 ? String(secs) : "";
    // Sweeps from full to empty as the wait runs down. Offset 0 is a whole
    // ring; RING_C is none of it.
    ringFill.setAttribute("stroke-dashoffset", (RING_C * (1 - (leftMs / total))).toFixed(2));
    frictionLine.textContent = secs > 0
      ? I18n.t("gate_friction_counting", { seconds: secs })
      : I18n.t("gate_friction_ready");
    frictionGo.disabled = !frictionReady();
  }

  function stopFriction() {
    if (frictionTimer) { clearInterval(frictionTimer); frictionTimer = null; }
  }

  function closeFriction() {
    stopFriction();
    frictionPlan = null;
    frictionEl.classList.add("hidden");
    actionsEl.classList.remove("hidden");
    snoozeBtn.disabled = false;
    endBtn.disabled = false;
  }

  function beginFriction(plan) {
    frictionPlan = plan;
    frictionEndsAt = Date.now() + plan.delayMs;
    frictionGo.textContent = I18n.t("gate_5_more_minutes");
    commitEl.classList.toggle("hidden", !plan.needsSentence);
    if (plan.needsSentence) {
      commitLabel.textContent = I18n.t("gate_commit_label", { sentence: plan.sentence });
      commitInput.value = "";
    }
    // The actions row goes while this is up: one decision at a time.
    actionsEl.classList.add("hidden");
    frictionEl.classList.remove("hidden");
    paintFriction();
    stopFriction();
    frictionTimer = setInterval(paintFriction, 200);
    if (plan.needsSentence) commitInput.focus();
  }

  function doSnooze() {
    stopFriction();
    frictionGo.disabled = true;
    frictionCancel.disabled = true;
    snoozeBtn.disabled = true;
    endBtn.disabled = true;
    // AWAIT THE WRITE BEFORE NAVIGATING. If the tab arrived at the site before
    // the snooze landed, the intercept would re-evaluate against storage that
    // does not yet carry it and gate the arrival straight back here. The page is
    // not flash-critical, so waiting is free.
    send({ type: "focus-gate-snooze", entry: entry }).then(function () {
      goBackToSite();
    });
  }

  commitInput.addEventListener("input", function () { frictionGo.disabled = !frictionReady(); });
  commitInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && frictionReady()) { e.preventDefault(); doSnooze(); }
  });
  frictionCancel.addEventListener("click", closeFriction);
  frictionGo.addEventListener("click", function () { if (frictionReady()) doSnooze(); });

  snoozeBtn.addEventListener("click", function () {
    snoozeBtn.disabled = true;
    endBtn.disabled = true;
    send({ type: "focus-gate-friction", entry: entry }).then(function (res) {
      var plan = (res && res.ok && res.plan) ? res.plan : null;
      // NO PLAN IS NO FRICTION. A worker that did not answer must not invent a
      // wait the user has no way to understand.
      if (!plan || !plan.delayMs) return doSnooze();
      beginFriction(plan);
    });
  });

  // ---- end control — C6 ----------------------------------------------------
  endBtn.addEventListener("click", function () {
    snoozeBtn.disabled = true;
    endBtn.disabled = true;
    // If state changed since load (another tab ended the session), the worker
    // re-derives from fresh state and reports "none" — blocking is already off,
    // there is nothing to end, and navigating back is the whole correct action.
    // No error, no complaint.
    if (endMode === "none") return goBackToSite();
    send({ type: "focus-gate-end" }).then(function () {
      goBackToSite();
    });
  });
})();
