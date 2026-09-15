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

  // ABSENT, NOT DISABLED. Removed from the DOM, so there is nothing to tab to
  // and nothing greyed out implying a state the user could reach.
  function dropControl(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  // The actions row settles once, after the worker answers. Until then both
  // conditional controls are out of the flow - the page is not flash-critical
  // and a button that appears and then vanishes is worse than one that arrives.
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

  send({ type: "focus-gate-state", entry: entry }).then(function (st) {
    if (!st || !st.ok) {
      // The worker did not answer. Leave both real controls in place with the
      // generic label: failing to reach the worker is not evidence that the
      // user is unblocked, and removing their way out would be the worse error.
      endBtn.textContent = I18n.t("gate_turn_off_focus");
      return;
    }

    contextEl.textContent = reasonText(st);

    endMode = st.endMode || "none";
    if (endMode === "none") {
      // Nothing to end: a budget and a schedule are not things you "end", and
      // an inert gate has nothing armed at all.
      dropControl(endBtn);
    } else if (endMode === "both") {
      // A manual arm AND a running phase. One label for one click that clears
      // both, because ending only one of them leaves the user here.
      endBtn.textContent = I18n.t("gate_end_focus");
    } else {
      endBtn.textContent = (endMode === "session") ? I18n.t("gate_end_focus_session")
                                                   : I18n.t("gate_turn_off_focus");
    }

    if (!st.reason) {
      // AN INERT GATE MUST NOT CONTRADICT ITSELF, and the first version did.
      // The reason line said blocking was not on while the headline above it
      // still read "<domain> is blocked" and the footnote below still described
      // the rule as live - three statements, two of them false, on one page.
      // Caught by looking at the rendered frame rather than at the code.
      //
      // The headline keeps its domain chip and only its TRAILING TEXT NODE
      // changes, which is the same element i18n-dom writes into and the reason
      // the chip survives.
      if (headlineEl && headlineEl.lastChild && headlineEl.lastChild.nodeType === 3) {
        headlineEl.lastChild.nodeValue = " " + I18n.t("gate_is_not_blocked");
      }
      // Snoozing something that is not blocking you is meaningless, so the
      // whole blocked-page vocabulary goes and one plain way onward remains.
      dropControl(snoozeBtn);
      document.querySelector(".gate-actions").appendChild(continueBtn);
      footnoteEl.textContent = "";
      return;
    }

    footnoteEl.textContent = entry
      ? I18n.t("gate_blocking_domain", { domain: entry })
      : "";
  });

  continueBtn.addEventListener("click", function () {
    continueBtn.disabled = true;
    goBackToSite();
  });

  // ---- [5 more minutes] — C7 ------------------------------------------------
  snoozeBtn.addEventListener("click", function () {
    snoozeBtn.disabled = true;
    endBtn.disabled = true;
    // AWAIT THE WRITE BEFORE NAVIGATING. If the tab arrived at the site before
    // the snooze landed, the intercept would re-evaluate against storage that
    // does not yet carry it and gate the arrival straight back here. The page is
    // not flash-critical, so waiting is free.
    send({ type: "focus-gate-snooze", entry: entry }).then(function () {
      goBackToSite();
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
