// ===========================================================================
// COMPANION POPUP SHELL — mounts the companion module in the toolbar popup.
//
// [1.9.1] This file is deliberately tiny and deliberately separate. It is the
// ONLY thing that knows this surface is a popup. The module it mounts knows
// nothing about the surface, which is what makes [1.16.0]'s side-panel mount a
// second file of about this size rather than a second implementation.
//
// Keeping the mount out of companion.js also keeps companion.js loadable in a
// harness without a container existing, so its state and view can be asserted
// directly rather than only through pixels.
// ===========================================================================
(function () {
  "use strict";

  var root = document.getElementById("companion-root");
  if (!root) {
    console.error("[LaunchPad] Companion popup: #companion-root missing");
    return;
  }

  // THE TEXT-SIZE SETTING TRAVELS WITH THE TOKENS. tokens.css carries the
  // --fs ramp and its small/large branches, which are keyed off a class on
  // <html> exactly as newtab.js's applyTextSize sets it. Without this the popup
  // would silently ignore a setting the user changed for readability - the one
  // setting most likely to matter to the person who needs a 360px surface.
  // Surface-level, so it lives in the shell rather than in the module: the side
  // panel will want the same two lines, the module wants neither.
  (async function applyTextSize() {
    try {
      var d = await Storage.getAll();
      var size = Storage.getTextSize(d);
      var html = document.documentElement;
      html.classList.remove("text-size-small", "text-size-large");
      if (size === "small") html.classList.add("text-size-small");
      else if (size === "large") html.classList.add("text-size-large");
    } catch (err) {
      console.error("[LaunchPad] Companion popup: text size read failed", err);
    }
  })();

  var view = Companion.mount(root, {});

  // [1.9.4] THE DRIVE HANDLE. Exported for the same reason [1.9.3] put the
  // command dispatcher on `self`: a harness must drive the view THIS FILE
  // mounted, not one of its own. Mounting a second view on the same container
  // is not a neutral act - both tick, both write the same node, and whichever
  // painted last wins, so an assertion can read a value the code under test
  // never produced. Not hypothetical: it made a mutant that reverted the hero
  // numeral look alive for the first two assertions of this round's own suite.
  window.__companionView = view;

  view.render().catch(function (err) {
    console.error("[LaunchPad] Companion popup: first render failed", err);
  });

  // A popup is torn down by Chrome when it closes and gets no lifecycle event
  // worth trusting, but pagehide fires on the way out in practice and clearing
  // the interval is free. The listener is removed with it.
  window.addEventListener("pagehide", function () { view.destroy(); });
})();
