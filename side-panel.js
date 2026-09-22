// ===========================================================================
// COMPANION SIDE-PANEL SHELL — mounts the companion module in Chrome's side
// panel.
//
// [1.16.0] THE SECOND MOUNT, AND IT IS A SECOND FILE OF ABOUT SIXTY LINES
// RATHER THAN A SECOND IMPLEMENTATION. That was [1.9.1]'s stated reason for
// splitting the shell out of the module: "It is the ONLY thing that knows this
// surface is a popup. The module it mounts knows nothing about the surface,
// which is what makes [1.16.0]'s side-panel mount a second file of about this
// size." This is that file, and the prediction held — the module needed one new
// OPTION, not a new code path.
//
// WHAT DIFFERS FROM THE POPUP SHELL, and it is exactly two things:
//
//   1. `showDueList: true` and `showControls: true`. A panel has HEIGHT and a
//      popup does not. Decision A spends it on the due list; see the module's
//      own comment for why that list and not another. [BELL-PANEL] spends what
//      was still void beneath it on the three daily controls - the mode
//      segment, reminders, tracking - after the design-pack census measured
//      this surface at 900px and found roughly two thirds of it empty. Both are
//      OPTIONS rather than branches, so the popup is untouched by either.
//   2. The teardown. A popup is destroyed by Chrome when it closes and gets no
//      lifecycle event worth trusting, so it leans on pagehide. A panel can
//      stay open for hours and is closed by the user, so it ALSO listens for
//      visibilitychange — not to tear down, but because a panel that is hidden
//      and shown again must not be showing an hour-old number.
//
// Everything else — the text-size read, the drive handle, the first render — is
// the popup shell's, deliberately, so the two cannot drift.
// ===========================================================================
(function () {
  "use strict";

  var root = document.getElementById("companion-root");
  if (!root) {
    console.error("[LaunchPad] Companion side panel: #companion-root missing");
    return;
  }

  // THE TEXT-SIZE SETTING TRAVELS WITH THE TOKENS, exactly as in the popup
  // shell. Surface-level, so it lives here rather than in the module — and it
  // matters MORE on this surface than on that one: a panel is read for hours,
  // not glanced at for a second.
  (async function applyTextSize() {
    try {
      var d = await Storage.getAll();
      var size = Storage.getTextSize(d);
      var html = document.documentElement;
      html.classList.remove("text-size-small", "text-size-large");
      if (size === "small") html.classList.add("text-size-small");
      else if (size === "large") html.classList.add("text-size-large");
    } catch (err) {
      console.error("[LaunchPad] Companion side panel: text size read failed", err);
    }
  })();

  // [FIX-6] THE SIDE PANEL ASKS FOR THE SESSION CONTROLS; THE POPUP DOES NOT.
  // companion.js's own note rules them out of the TOOLBAR popup - a surface you
  // glance at and dismiss - and that ruling stands. This panel is pinned open
  // beside the work, and since the active-task pill was removed it is the only
  // surface in the product that can start a focus session at all.
  //
  // [H4.0] AND IT ASKS FOR THE THREE DAILY CONTROLS, which are a DIFFERENT
  // FEATURE with a name one word away. e597640 called them `showControls`;
  // beside FIX-6's `showSessionControls` that reads as the same option, and a
  // future round resolving them by picking one would drop the other in silence
  // - which is exactly how this pair arrived here in the first place. Renamed
  // to showDailyControls. A mount option is never rendered, so the rename
  // reaches nothing but this call and companion.js's reader.
  //
  //   showSessionControls -> Start / Stop, the blocking arm, the countdown
  //   showDailyControls   -> the mode segment, reminders, tracking
  //
  // The popup passes NEITHER (companion-popup.js mounts with {}), which is the
  // standing ruling on that surface and is asserted by its own drive.
  var view = Companion.mount(root, {
    showDueList: true,
    showSessionControls: true,
    showDailyControls: true
  });

  // [1.9.4] THE DRIVE HANDLE, for the reason the popup shell states: a harness
  // must drive the view THIS FILE mounted, not one of its own, because two
  // views on one container both tick and both write the same node.
  window.__companionView = view;

  view.render().catch(function (err) {
    console.error("[LaunchPad] Companion side panel: first render failed", err);
  });

  // A PANEL THAT HAS BEEN HIDDEN FOR AN HOUR MUST NOT COME BACK STALE.
  //
  // The storage listener inside mount() already re-renders on every foreign
  // write, which covers the case where something CHANGED while we were hidden.
  // This covers the other one: nothing changed, but the clock moved. The tick
  // keeps the numeral live while visible; on return we re-read rather than
  // trusting a state object whose readAt is an hour old, because liveActiveMs
  // extrapolates from that moment and an hour of extrapolation is a guess.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    view.render().catch(function (err) {
      console.error("[LaunchPad] Companion side panel: refresh on show failed", err);
    });
  });

  // pagehide for parity with the popup: the panel is torn down when the user
  // closes it or navigates the panel away, and clearing the interval is free.
  window.addEventListener("pagehide", function () { view.destroy(); });
})();
