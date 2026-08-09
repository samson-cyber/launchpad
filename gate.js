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
    if (mins < 1) return "less than a minute";
    return mins + (mins === 1 ? " minute" : " minutes");
  }

  // ---- state round-trip: the context line and the end-control label ---------
  //
  // C6: the label names exactly what the click will do. Rendered from live state
  // rather than assumed, because the two cases end different things.
  var endMode = "none";

  send({ type: "focus-gate-state" }).then(function (st) {
    if (!st || !st.ok) {
      endBtn.textContent = "Turn off focus";
      return;
    }
    endMode = st.phaseRunning ? "session" : (st.manualArmed ? "manual" : "none");
    endBtn.textContent = st.phaseRunning ? "End focus session" : "Turn off focus";

    if (st.phaseRunning && st.taskName) {
      contextEl.textContent = fmtMinutes(st.elapsedMs) + " focused on " + st.taskName;
    } else if (st.phaseRunning) {
      contextEl.textContent = fmtMinutes(st.elapsedMs) + " focused so far";
    } else if (st.manualArmed) {
      contextEl.textContent = "Focus blocking is on";
    }

    footnoteEl.textContent = entry
      ? "Blocking " + entry + " and its subdomains while focus is on."
      : "";
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
