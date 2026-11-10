/* global chrome, document, navigator */

// ===========================================================================
// [1.17.0] WP - the welcome tab's behaviour. Three jobs and nothing else:
//
//   1. Pick the copy for the browser. Chrome gets the screenshot of its own
//      "Change back to Google?" prompt and the words that name its buttons.
//      Anything detected as Edge gets the generic line and no screenshot,
//      because Edge shows a different prompt and its labels have not been
//      observed (D5). Both branches are in the markup; this only removes the
//      one that does not apply.
//   2. "Open my first new tab" opens a plain new tab, so the user meets the
//      prompt straight from the instructions. The welcome tab is left open
//      behind it and is NEVER closed by code (D3).
//   3. "Open extensions page" opens the browser's extensions page on
//      LaunchPad's own entry. An extension page cannot reach chrome:// through
//      an <a href>; chrome.tabs.create can. If it is refused, the address is
//      shown as selectable text instead (D4).
//
// THIS PAGE READS AND WRITES NO STORAGE. It is not a new tab page, and every
// first-run counter (promoState.openCount, rightClickTipShows, the Clear
// examples pulse, launchpad_onboarding) is keyed on new-tab opens. Loading
// storage.js here would be the first step towards moving one of them.
// ===========================================================================

(function () {
  "use strict";

  // userAgentData first, because Edge's UA string is Chrome's plus "Edg/",
  // and a reduced UA may stop carrying it. The string is the fallback for a
  // browser without userAgentData.
  function isEdge(nav) {
    var n = nav || navigator;
    var uad = n.userAgentData;
    if (uad && Array.isArray(uad.brands) && uad.brands.length) {
      return uad.brands.some(function (b) { return /Microsoft Edge/i.test(b && b.brand); });
    }
    return /\bEdg\//.test(n.userAgent || "");
  }

  function removeAll(selector) {
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) els[i].parentNode.removeChild(els[i]);
  }

  var edge = isEdge();
  document.documentElement.setAttribute("data-browser", edge ? "edge" : "chrome");
  removeAll(edge ? ".wl-copy-chrome" : ".wl-copy-generic");

  var openBtn = document.getElementById("wl-open");
  if (openBtn) {
    openBtn.addEventListener("click", function () {
      chrome.tabs.create({});
    });
  }

  var extBtn = document.getElementById("wl-ext");
  if (extBtn) {
    extBtn.addEventListener("click", function () {
      // chrome:// is honoured by Edge as well, which maps it to edge://.
      var url = "chrome://extensions/?id=" + chrome.runtime.id;
      function showAddress() {
        var box = document.getElementById("wl-ext-address");
        var code = document.getElementById("wl-ext-url");
        if (code) code.textContent = url;
        if (box) box.hidden = false;
      }
      try {
        chrome.tabs.create({ url: url }).catch(showAddress);
      } catch (e) {
        showAddress();
      }
    });
  }
})();
