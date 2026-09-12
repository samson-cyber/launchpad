/* global URL */

// ===========================================================================
// [1.11.2 B10] CROSS-TOOL IMPORT PARSERS
//
// Pure parsing. No storage, no DOM, no chrome.* — every function here takes
// text and returns a plain object, so the whole surface is testable without a
// browser and the writing half stays in one place in newtab.js.
//
// WHAT THIS PARSES, AND HOW HONEST EACH ONE IS. Four of the six formats are
// user-generated exports that cannot be obtained without the product that
// writes them, so they were built against their documented shape and a
// structurally faithful sample rather than against a file a real tool emitted.
// That is recorded per format in the round's report rather than papered over.
//
// SO THE DESIGN DOES NOT DEPEND ON BRAND RECOGNITION. Every branch below is a
// HINT that improves GROUPING; underneath them is a generic extractor that
// finds links by structure — any JSON containing objects with a url, any text
// containing URLs. A Toby export whose shape has changed since this was written
// still imports its links; it just lands as one group instead of several. A
// parser that can only succeed or fail is the one that fails silently.
//
// THE INPUT IS UNTRUSTED. It is a file from another product, or a paste from
// anywhere. Two rules follow and neither is optional:
//   1. ONLY http AND https SURVIVE. An allowlist, failing closed, the same way
//      Storage.isCapturableSessionUrl treats session capture. Bookmark files
//      genuinely contain `javascript:` bookmarklets, and a bookmarklet imported
//      into a tile is a script that runs in the extension's own page when it is
//      clicked. data:, file: and chrome: are refused for the same reason.
//   2. TITLES ARE DATA. They reach the DOM through the product's own esc(), and
//      nothing here tries to be clever about markup inside them.
// ===========================================================================

var Importers = (function () {
  "use strict";

  var MAX_TITLE = 200;

  // ---- URL hygiene -------------------------------------------------------

  // Allowlist, not blocklist. Anything whose protocol is not http(s) is dropped
  // and counted, so the caller can tell the user how many and why.
  function cleanUrl(raw) {
    if (typeof raw !== "string") return null;
    var s = raw.trim();
    if (!s) return null;
    // A bare domain typed into a paste box is a URL the user means.
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
      if (!/^[\w-]+(\.[\w-]+)+/.test(s)) return null;
      s = "https://" + s;
    }
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u.href;
  }

  function cleanTitle(raw) {
    if (typeof raw !== "string") return "";
    var s = raw.replace(/\s+/g, " ").trim();
    return s.length > MAX_TITLE ? s.slice(0, MAX_TITLE) : s;
  }

  function link(url, title) {
    var u = cleanUrl(url);
    if (!u) return null;
    return { url: u, title: cleanTitle(title) };
  }

  // ---- the shape every parser returns ------------------------------------

  function result(format, label, groups, skipped) {
    var total = 0, seen = Object.create(null), out = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var links = [];
      for (var k = 0; k < g.links.length; k++) {
        var l = g.links[k];
        // DEDUPE WITHIN ONE IMPORT ONLY. Across imports is the user's call and
        // is surfaced in the preview instead - see the duplicate handling in
        // newtab.js. A file that lists the same tab in two windows should not
        // produce two tiles from one action.
        if (seen[l.url]) continue;
        seen[l.url] = true;
        links.push(l);
      }
      if (links.length) { out.push({ name: cleanTitle(g.name) || "Imported", links: links }); total += links.length; }
    }
    return { format: format, label: label, groups: out, total: total, skipped: skipped || 0 };
  }

  // ---- 1. JSON -----------------------------------------------------------

  // Recognised shapes, each only for GROUPING. Anything unrecognised falls to
  // the deep walk, which is what actually guarantees the links are found.
  function fromJson(obj) {
    var skipped = { n: 0 };
    var groups;

    // Toby: { lists: [ { title, cards: [ { url, title, customTitle } ] } ] }
    if (obj && Array.isArray(obj.lists)) {
      groups = obj.lists.map(function (l) {
        return { name: (l && (l.title || l.name)) || "Toby list",
                 links: collect(l && l.cards, skipped) };
      });
      if (countLinks(groups)) return result("toby", "Toby", groups, skipped.n);
    }

    // Session Buddy: { sessions: [ { windows: [ { tabs: [...] } ] } ] }, and the
    // flatter { windows: [ { tabs: [...] } ] } a single-session export writes.
    var wins = (obj && Array.isArray(obj.windows)) ? obj.windows
      : (obj && Array.isArray(obj.sessions))
        ? obj.sessions.reduce(function (acc, s) {
            return acc.concat((s && s.windows) || []);
          }, [])
        : null;
    if (wins && wins.length) {
      groups = wins.map(function (w, i) {
        return { name: (w && (w.title || w.name)) || ("Window " + (i + 1)),
                 links: collect(w && w.tabs, skipped) };
      });
      if (countLinks(groups)) return result("session-buddy", "Session Buddy", groups, skipped.n);
    }

    // Speed Dial 2: { groups: [ { name, dials: [ { url, title } ] } ] }
    if (obj && Array.isArray(obj.groups)) {
      groups = obj.groups.map(function (g, i) {
        return { name: (g && (g.name || g.title)) || ("Group " + (i + 1)),
                 links: collect(g && (g.dials || g.items || g.links), skipped) };
      });
      if (countLinks(groups)) return result("speed-dial-2", "Speed Dial 2", groups, skipped.n);
    }

    // THE FLOOR. Any JSON at all: walk it and take every object carrying a url.
    var found = [];
    deepWalk(obj, found, skipped, 0);
    if (found.length) {
      return result("json", "JSON export", [{ name: "Imported links", links: found }], skipped.n);
    }
    return null;
  }

  function countLinks(groups) {
    var n = 0;
    for (var i = 0; i < groups.length; i++) n += groups[i].links.length;
    return n;
  }

  function collect(arr, skipped) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (!c || typeof c !== "object") continue;
      var l = link(c.url || c.href || c.uri,
                   c.customTitle || c.title || c.name || c.label);
      if (l) out.push(l); else if (c.url || c.href || c.uri) skipped.n++;
    }
    return out;
  }

  // Depth-limited so a pathological file cannot spin, and it takes the FIRST
  // url-bearing object on a path rather than recursing into it.
  function deepWalk(node, out, skipped, depth) {
    if (!node || depth > 12 || out.length > 20000) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) deepWalk(node[i], out, skipped, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    var raw = node.url || node.href || node.uri;
    if (typeof raw === "string") {
      var l = link(raw, node.customTitle || node.title || node.name || node.label);
      if (l) out.push(l); else skipped.n++;
      return;
    }
    for (var k in node) {
      if (Object.prototype.hasOwnProperty.call(node, k)) deepWalk(node[k], out, skipped, depth + 1);
    }
  }

  // ---- 2. Netscape bookmarks HTML ----------------------------------------

  // The format every browser and most extensions emit, Toby and Speed Dial 2
  // among them. Parsed by scanning rather than by DOMParser: this module is
  // deliberately DOM-free so it can be exercised outside a page, and the format
  // is a flat token stream in practice - H3 opens a folder, A is a link, /DL
  // closes one.
  function fromNetscape(text) {
    var groups = [{ name: "Imported bookmarks", links: [] }];
    var stack = [];
    var skipped = 0;
    var re = /<(\/?)(DL|H3|A)\b([^>]*)>([\s\S]*?)(?=<)/gi;
    var m;
    while ((m = re.exec(text)) !== null) {
      var closing = m[1], tag = m[2].toUpperCase(), attrs = m[3] || "", inner = m[4] || "";
      if (tag === "H3" && !closing) {
        stack.push(decodeEntities(stripTags(inner)));
        groups.push({ name: stack.join(" / "), links: [] });
      } else if (tag === "DL" && closing) {
        if (stack.length) stack.pop();
      } else if (tag === "A" && !closing) {
        var href = (attrs.match(/\bHREF\s*=\s*"([^"]*)"/i) || attrs.match(/\bHREF\s*=\s*'([^']*)'/i) || [])[1];
        if (href) {
          var l = link(decodeEntities(href), decodeEntities(stripTags(inner)));
          if (l) groups[groups.length - 1].links.push(l); else skipped++;
        }
      }
    }
    if (!countLinks(groups)) return null;
    return result("netscape", "Bookmarks HTML", groups, skipped);
  }

  function stripTags(s) { return String(s).replace(/<[^>]*>/g, ""); }

  function decodeEntities(s) {
    return String(s)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&amp;/g, "&");   // last, so &amp;lt; does not become <
  }

  // ---- 3. Plain text: OneTab, and any list of URLs ------------------------

  // OneTab writes `url | title`, one per line, with a BLANK LINE between tab
  // groups. That blank line is the only grouping information in the file, so it
  // is honoured; a paste with no blank lines is simply one group.
  function fromText(text) {
    var lines = String(text).split(/\r?\n/);
    var groups = [{ name: "", links: [] }];
    var skipped = 0, sawPipe = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) {
        if (groups[groups.length - 1].links.length) groups.push({ name: "", links: [] });
        continue;
      }
      var url = line, title = "";
      var bar = line.indexOf(" | ");
      if (bar > 0) { sawPipe = true; url = line.slice(0, bar); title = line.slice(bar + 3); }
      var l = link(url, title);
      if (l) groups[groups.length - 1].links.push(l);
      else if (/^[a-z]+:/i.test(line) || /^[\w-]+(\.[\w-]+)+/.test(line)) skipped++;
    }
    if (!countLinks(groups)) return null;
    var multi = groups.filter(function (g) { return g.links.length; }).length > 1;
    for (var k = 0; k < groups.length; k++) {
      groups[k].name = multi ? ("Imported group " + (k + 1)) : "Imported links";
    }
    return result(sawPipe ? "onetab" : "urls", sawPipe ? "OneTab" : "Pasted links", groups, skipped);
  }

  // ---- the sniffer -------------------------------------------------------

  // SNIFFED, NOT PICKED. A format chooser puts the burden on someone who has a
  // file and does not necessarily know what wrote it. Sniffing fails worse in
  // general, which is why the fallback chain never ends in an error for a file
  // that contains links at all: JSON -> HTML -> text, and text accepts any line
  // that looks like a URL. Only a file with NO recoverable link is refused, and
  // then it says so rather than importing nothing quietly.
  function parse(text) {
    if (typeof text !== "string" || !text.trim()) {
      return { format: "empty", label: "", groups: [], total: 0, skipped: 0 };
    }
    var trimmed = text.trim();

    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
      var obj = null;
      try { obj = JSON.parse(trimmed); } catch (e) { obj = null; }
      if (obj) {
        var j = fromJson(obj);
        if (j) return j;
      }
    }
    if (/<a\s[^>]*href\s*=/i.test(trimmed) || /NETSCAPE-Bookmark-file/i.test(trimmed)) {
      var h = fromNetscape(trimmed);
      if (h) return h;
    }
    var t = fromText(trimmed);
    if (t) return t;
    return { format: "unrecognised", label: "", groups: [], total: 0, skipped: 0 };
  }

  return {
    parse: parse,
    cleanUrl: cleanUrl,
    cleanTitle: cleanTitle
  };
})();
