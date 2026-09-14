/* global chrome */

// ===========================================================================
// [1.5.0] The message catalogue.
//
// WHY THIS EXISTS RATHER THAN chrome.i18n ALONE (PLAN 2026-08-31, ratified):
// chrome.i18n owns the manifest's name and description and the Web Store
// listing, and nothing else can do that job - so it keeps that job, in
// _locales/en/messages.json. It cannot do THIS job for two structural reasons:
// it has no plural support at all (28 shipped strings vary by count), and it
// follows the browser UI language with no override API, so "my browser is
// English but I want the UI in Indonesian" is unreachable through it. Building
// Intl.PluralRules on top of chrome.i18n means writing this module anyway with
// an extra layer underneath it.
//
// THIS ROUND MOVES NO STRINGS. The engine ships with an empty English
// catalogue; R2 fills it from newtab.html and R3 from the builders. Nothing on
// screen changes.
//
// Loads in BOTH contexts - the page (<script src>) and the service worker
// (importScripts) - so it must never touch `document`. That single constraint
// is why the escaper below is the string-replacement one rather than the
// DOM-based `esc()` in newtab.js.
// ===========================================================================

var I18n = (function () {
  "use strict";

  var DEFAULT_LOCALE = "en";

  // locale code -> { key -> normalized entry }
  var catalogues = Object.create(null);
  var active = DEFAULT_LOCALE;
  var listeners = [];

  var IS_UNPACKED = (function () {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.getManifest &&
                !chrome.runtime.getManifest().update_url);
    } catch (e) { return false; }
  })();

  // -------------------------------------------------------------- escaping
  //
  // THE ESCAPING DECISION. Two accessors, split by SINK rather than by
  // "safe vs raw", and the reasoning is in the IMPLEMENTATION comment on the
  // Asana task. The short form, because the next reader will be a mechanical
  // conversion in R3 and needs the rule in one line:
  //
  //   t(key, params)   -> PLAIN TEXT.    For .textContent, a .title PROPERTY,
  //                                      alert/confirm/prompt, and any site
  //                                      that already wraps in escapeHtml.
  //   th(key, params)  -> HTML-ESCAPED.  For direct concatenation into a
  //                                      string that is assigned to innerHTML.
  //
  // There is deliberately NO raw-markup accessor: no catalogue value may
  // contain markup (the gate enforces it), so such an accessor would have zero
  // legitimate callers and would exist only to be misused.
  //
  // Semantics are byte-identical to newtab.js's escapeHtml - all five
  // characters, so the result is safe inside a double-quoted ATTRIBUTE and not
  // merely inside a text node. That is the stricter of the two escapers the
  // codebase currently carries, and it is the one adopted.
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ------------------------------------------------------- entry normalizing
  //
  // A message is authored in one of three shapes. They normalize to one record
  // so every consumer - t, th, the gate, and R5's duplicate-source check -
  // reads the same fields.
  //
  //   "key": "Plain text with {placeholders}"
  //   "key": { "message": "...", "description": "...", "sense": "..." }
  //   "key": { "plural": { "=0": "...", "one": "...", "other": "..." }, ... }
  //
  // `description` and `sense` are REQUIREMENT 6 and are not decoration.
  // `sense` is the vocabulary defence: the three meanings of "session" get
  // three sense families, so newtab.html:223 and :236 - which today share the
  // sentence "No saved sessions yet." and mean auto-restore and named sessions
  // respectively - cannot collide on a key, and R5's check can fail a build
  // where two DIFFERENT senses carry an IDENTICAL source string.
  function normalize(key, raw) {
    var e = { key: key, message: null, plural: null, description: "", sense: "" };
    if (typeof raw === "string") { e.message = raw; return e; }
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.message === "string") e.message = raw.message;
    if (raw.plural && typeof raw.plural === "object") e.plural = raw.plural;
    if (typeof raw.description === "string") e.description = raw.description;
    if (typeof raw.sense === "string") e.sense = raw.sense;
    if (e.message === null && e.plural === null) return null;
    return e;
  }

  function register(locale, messages) {
    if (!locale || !messages || typeof messages !== "object") return 0;
    var target = catalogues[locale] || (catalogues[locale] = Object.create(null));
    var n = 0;
    Object.keys(messages).forEach(function (k) {
      var e = normalize(k, messages[k]);
      if (!e) {
        if (IS_UNPACKED) console.warn("[i18n] unusable message shape, skipped:", locale, k);
        return;
      }
      target[k] = e;
      n++;
    });
    return n;
  }

  // ---------------------------------------------------------------- plurals
  //
  // Real CLDR categories via Intl.PluralRules, never an English "+ s". The
  // categories a locale actually uses are its own business: English has one
  // and other; Russian has one, few, many and other; Indonesian has only
  // other; Arabic has all six. A message supplies whichever forms its source
  // language needs and translators supply whichever theirs do.
  //
  // EXACT FORMS WIN. "=0" and friends are matched before the category,
  // because an empty state is usually a different sentence rather than a
  // different inflection ("Nothing in the trash", not "0 items"), and English
  // has no `zero` category to hang it on - Intl.PluralRules("en").select(0) is
  // "other".
  var pluralCache = Object.create(null);
  function rulesFor(locale) {
    if (pluralCache[locale]) return pluralCache[locale];
    var r = null;
    try { r = new Intl.PluralRules(locale); } catch (e) { r = null; }
    if (!r) { try { r = new Intl.PluralRules(DEFAULT_LOCALE); } catch (e2) { r = null; } }
    pluralCache[locale] = r;
    return r;
  }

  function pluralCategory(count, locale) {
    var r = rulesFor(locale || active);
    if (!r) return "other";
    return r.select(Number(count));
  }

  function selectPluralForm(entry, count, locale) {
    var forms = entry.plural;
    var exact = "=" + String(count);
    if (Object.prototype.hasOwnProperty.call(forms, exact)) return forms[exact];
    var cat = pluralCategory(count, locale);
    if (Object.prototype.hasOwnProperty.call(forms, cat)) return forms[cat];
    if (Object.prototype.hasOwnProperty.call(forms, "other")) return forms.other;
    return null;
  }

  // --------------------------------------------------------- interpolation
  //
  // NAMED placeholders, {likeThis}. Named rather than positional because a
  // translation is free to reorder, and several shipped sentences already
  // START with their value - "<name> is attached to <task>." - which a
  // positional scheme handles only by accident.
  //
  // An unknown placeholder is left verbatim rather than blanked, so the defect
  // is visible on screen instead of silently producing a sentence with a hole
  // in it.
  var PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;
  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(PLACEHOLDER, function (whole, name) {
      if (!Object.prototype.hasOwnProperty.call(params, name)) return whole;
      var v = params[name];
      return v == null ? "" : String(v);
    });
  }

  // ---------------------------------------------------------------- lookup
  function lookup(key) {
    var c = catalogues[active];
    if (c && c[key]) return c[key];
    var f = catalogues[DEFAULT_LOCALE];
    if (f && f[key]) return f[key];
    return null;
  }

  // A MISSING KEY RETURNS THE KEY. It never throws and never returns empty:
  // an empty string is an invisible failure, and a throw in a render path
  // takes a whole surface down for one absent label. The key is recognisable
  // on screen, greppable, and loud in an unpacked build.
  function t(key, params) {
    var e = lookup(key);
    if (!e) {
      if (IS_UNPACKED) console.warn("[i18n] missing message:", key);
      return key;
    }
    var str;
    if (e.plural) {
      // THE COUNT IS COERCED ONCE, HERE, AND THE SAME NUMBER BOTH CHOOSES THE
      // FORM AND APPEARS IN THE SENTENCE.
      //
      // Before this the two came from different expressions: the category from
      // Number(count) inside pluralCategory, the {count} substitution from the
      // RAW value. They can disagree. A caller passing the string "3.0" got the
      // plural form for 3 and the text "3.0"; one passing {} got the "other"
      // form and the text "[object Object]". Neither is reachable now, because
      // after this line there is only one number.
      //
      // This is the R5.1 convention made STRUCTURAL rather than documented. A
      // caller cannot pass a count that selects one form and prints another,
      // because it no longer has a way to.
      var raw = params ? params.count : undefined;
      var n = Number(raw);
      if (raw == null || !isFinite(n)) {
        if (IS_UNPACKED) {
          console.warn("[i18n] plural message needs a numeric params.count:", key, raw);
        }
        n = 0;
      }
      str = selectPluralForm(e, n, active);
      if (str == null) {
        if (IS_UNPACKED) console.warn("[i18n] no usable plural form:", key);
        return key;
      }
      var merged = {};
      for (var p in params) {
        if (Object.prototype.hasOwnProperty.call(params, p)) merged[p] = params[p];
      }
      merged.count = n;
      params = merged;
    } else {
      str = e.message;
    }
    return interpolate(str, params);
  }

  function th(key, params) { return escapeHtml(t(key, params)); }

  // A SENTENCE WITH MARKUP IN THE MIDDLE IS STILL ONE SENTENCE.
  //
  // "Right-click any page -> <strong>Add to LaunchPad</strong>. That is the
  // whole habit." has to reach a translator WHOLE. Split into two catalogue
  // fragments around the <strong> it becomes two half-sentences that cannot be
  // reordered, and in a language that puts the emphasised term first there is
  // no way to say it at all. Fragments are how a catalogue ends up unable to
  // express the sentences it already contains.
  //
  // So markup is a NAMED PLACEHOLDER like any other value: the catalogue holds
  // the whole sentence, th() escapes it exactly as it escapes everything else,
  // and each html param is swapped in afterwards. The sentinel is U+0001,
  // which cannot occur in catalogue text and cannot survive escapeHtml, so a
  // swap can never land on real content.
  function thHtml(key, params, htmlParams) {
    var merged = {}, marks = {}, k, i = 0;
    for (k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k)) merged[k] = params[k];
    }
    for (k in htmlParams) {
      if (!Object.prototype.hasOwnProperty.call(htmlParams, k)) continue;
      marks[k] = "\u0001" + (i++) + "\u0001";
      merged[k] = marks[k];
    }
    var out = th(key, merged);
    for (k in marks) {
      if (Object.prototype.hasOwnProperty.call(marks, k)) {
        out = out.split(marks[k]).join(htmlParams[k]);
      }
    }
    return out;
  }

  // ------------------------------------------------------------ negotiation
  //
  // STORED PREFERENCE, then the browser UI language, then English. Kept PURE
  // and synchronous - it takes the stored value as an argument rather than
  // reading storage itself - because storage is async and every render path
  // that needs a string is not. The async read lives at the call site, which
  // is also the convention storage.js follows (data threaded through, never
  // held).
  //
  // Regional codes degrade to their base: a catalogue of "pt" serves "pt-BR"
  // rather than silently falling back to English over a hyphen.
  function negotiate(stored, uiLanguage) {
    var avail = availableLocales();
    function match(code) {
      if (!code || typeof code !== "string") return null;
      var c = code.replace(/_/g, "-");
      if (avail.indexOf(c) !== -1) return c;
      var base = c.split("-")[0];
      if (avail.indexOf(base) !== -1) return base;
      for (var i = 0; i < avail.length; i++) {
        if (avail[i].split("-")[0] === base) return avail[i];
      }
      return null;
    }
    return match(stored) || match(uiLanguage) || DEFAULT_LOCALE;
  }

  function uiLanguage() {
    try {
      if (chrome && chrome.i18n && chrome.i18n.getUILanguage) return chrome.i18n.getUILanguage();
    } catch (e) {}
    return DEFAULT_LOCALE;
  }

  function availableLocales() { return Object.keys(catalogues); }
  function getLocale() { return active; }

  // Returns whether the active locale actually changed, so a caller can skip a
  // re-render it does not need.
  function setLocale(code) {
    if (!code || code === active) return false;
    active = code;
    listeners.slice().forEach(function (fn) {
      try { fn(active); } catch (e) { if (IS_UNPACKED) console.warn("[i18n] listener threw:", e); }
    });
    return true;
  }

  // RUNTIME SWITCHING is the reason this module exists rather than
  // chrome.i18n alone. Every accessor reads `active` AT CALL TIME, so a switch
  // needs a re-render and not a reload - provided the surfaces that R2 and R3
  // migrate keep resolving their strings inside their render functions rather
  // than caching them at module scope. That is the property those rounds have
  // to preserve, and it is why this listener hook exists now rather than being
  // retrofitted later.
  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  // ------------------------------------------------- introspection for gates
  function has(key) { return !!lookup(key); }
  function meta(key) {
    var e = lookup(key);
    if (!e) return null;
    return { key: e.key, description: e.description, sense: e.sense,
             source: e.message, plural: e.plural };
  }
  function keys(locale) {
    var c = catalogues[locale || active];
    return c ? Object.keys(c) : [];
  }

  // R1 registers an EMPTY English catalogue so the locale exists, negotiation
  // resolves, and R2 has something to fill. No strings move this round.
  register(DEFAULT_LOCALE, {});

  return {
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    t: t,
    th: th,
    thHtml: thHtml,
    escapeHtml: escapeHtml,
    register: register,
    has: has,
    meta: meta,
    keys: keys,
    getLocale: getLocale,
    setLocale: setLocale,
    availableLocales: availableLocales,
    negotiate: negotiate,
    uiLanguage: uiLanguage,
    pluralCategory: pluralCategory,
    onChange: onChange
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = I18n;
