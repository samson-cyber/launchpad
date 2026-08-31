/* global I18n, document */

// ===========================================================================
// [1.5.0] R2 - the DOM pass that resolves static markup against the catalogue.
//
// Deliberately NOT part of i18n.js. That module also loads in the service
// worker, where there is no document, so it stays DOM-free; this file is the
// page-side half and is loaded only by pages that have markup to resolve.
//
// THE MARKUP CONTRACT, one attribute per SINK:
//
//   data-i18n="key"             the element's own text
//   data-i18n-title="key"       its title attribute
//   data-i18n-placeholder="key" its placeholder
//   data-i18n-aria-label="key"  its aria-label
//   data-i18n-alt="key"         its alt
//
// An element that needs several carries several, and they may name the SAME
// key when the sense is the same - a sidebar button whose label and tooltip
// are both the feature's name is one message rendered into two sinks.
//
// THE ENGLISH TEXT STAYS IN THE MARKUP. It is the fallback if this pass never
// runs, and it is what makes "byte-identical rendering" provable rather than
// merely likely: with an English catalogue the pass writes back exactly what
// was already there.
// ===========================================================================

var I18nDom = (function () {
  "use strict";

  var ATTR_SINKS = {
    "data-i18n-title": "title",
    "data-i18n-placeholder": "placeholder",
    "data-i18n-aria-label": "aria-label",
    "data-i18n-alt": "alt"
  };

  // REPLACE THE TEXT NODE, NOT textContent. Many controls in this markup hold
  // an inline SVG icon AND a label - `<button><svg>...</svg>Delete</button>` -
  // and assigning textContent would delete the icon. So the pass finds the
  // element's first non-empty DIRECT-CHILD text node and rewrites only that,
  // leaving every element child untouched.
  //
  // Surrounding whitespace is preserved rather than trimmed away, so the
  // serialized document is unchanged where the catalogue value matches the
  // original. HTML collapses whitespace when rendering, but preserving it
  // keeps an outerHTML comparison honest.
  function setText(el, value) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) {
        var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.nodeValue);
        n.nodeValue = (m ? m[1] : "") + value + (m ? m[3] : "");
        return true;
      }
    }
    el.appendChild(document.createTextNode(value));
    return true;
  }

  // Re-runnable by design: R1's runtime locale switch needs a re-render, and
  // for static markup a re-render IS calling this again. Returns how many
  // sinks it filled so a caller (or a harness) can tell "resolved nothing"
  // from "resolved everything", which a silent pass cannot.
  function apply(root) {
    var scope = root || document;
    var filled = 0, missing = [];

    var textEls = scope.querySelectorAll("[data-i18n]");
    for (var i = 0; i < textEls.length; i++) {
      var el = textEls[i];
      var key = el.getAttribute("data-i18n");
      if (!key) continue;
      if (!I18n.has(key)) { missing.push(key); continue; }
      setText(el, I18n.t(key));
      filled++;
    }

    for (var attr in ATTR_SINKS) {
      if (!Object.prototype.hasOwnProperty.call(ATTR_SINKS, attr)) continue;
      var els = scope.querySelectorAll("[" + attr + "]");
      for (var j = 0; j < els.length; j++) {
        var e2 = els[j];
        var k2 = e2.getAttribute(attr);
        if (!k2) continue;
        if (!I18n.has(k2)) { missing.push(k2); continue; }
        e2.setAttribute(ATTR_SINKS[attr], I18n.t(k2));
        filled++;
      }
    }

    if (missing.length && typeof console !== "undefined" && console.warn) {
      console.warn("[i18n-dom] " + missing.length + " key(s) not in the catalogue:",
                   missing.slice(0, 10));
    }
    return { filled: filled, missing: missing };
  }

  // Run once at load, and again whenever the locale changes. Binding the
  // listener here rather than at each call site is what keeps the "a switch
  // needs a re-render, not a reload" promise true for static markup.
  function init() {
    var r = apply(document);
    if (I18n && I18n.onChange) I18n.onChange(function () { apply(document); });
    return r;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  return { apply: apply, init: init, ATTR_SINKS: ATTR_SINKS };
})();

if (typeof module !== "undefined" && module.exports) module.exports = I18nDom;
