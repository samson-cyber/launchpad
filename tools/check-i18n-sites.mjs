#!/usr/bin/env node
// ===========================================================================
// [1.5.0] i18n construction-site gate — SKELETON, NOT YET ENFORCING.
//
// The rule this will enforce, once R2 and R3 have migrated the strings:
// every user-visible string reaches the DOM through I18n.t / I18n.th, so any
// prose literal left at a construction site is a violation.
//
// It cannot enforce that TODAY, because nothing has migrated and it would fail
// on all ~749 sites at once. So this round wires the enumeration, proves it can
// see the sites, and hard-fails only when the GATE ITSELF is broken. Flip
// ENFORCING to true at the end of R3.
//
// P2 IS THE WHOLE POINT OF THE FLOORS BELOW. A gate whose inspection set
// silently collapses to zero passes forever and reads exactly like a gate that
// looked at everything and found nothing wrong — which is how the ink gate
// shipped green over the bug it was written for. Three independent defences:
//
//   1. LITERAL_FLOOR  — string literals the tokenizer produced. Does NOT shrink
//                       as strings migrate (a literal becomes a key, still a
//                       literal), so it measures tokenizer health specifically.
//   2. SITE_FLOOR     — construction sites found. A site is a POSITION, not a
//                       prose string, so `.textContent = t("x")` still counts.
//                       Also does not shrink with migration.
//   3. SELF-TEST      — every pattern must match its own built-in fixture. This
//                       is the one that actually catches a broken regex: a
//                       count floor tells you the total moved, the self-test
//                       tells you WHICH pattern went blind.
//
// Exit codes: 0 ok · 1 violations (only when ENFORCING) · 2 gate broken.
// Exit 2 is the P5/Q1 convention — "the subject did not load" must never be
// scored as a pass.
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENFORCING = false;              // flip at the end of R3
const LITERAL_FLOOR = 6000;           // measured 7334 at [1.5.0]; see report
const SITE_FLOOR = 600;               // measured 749 at [1.5.0]; see report

// PER-PATTERN FLOORS ([1.5.0] R3). The global floor is not enough, and the
// set-attr defect is the proof: that pattern found 11 sites and read NOTHING
// from any of them for two rounds, while the global total stayed healthy on the
// strength of the other seven. "11 sites, 0 hardcoded" reads as clean and meant
// blind. A floor that only watches the sum cannot see one pattern die.
//
// Each floor sits below the measured count with room for ordinary churn, and
// well above zero - the number that actually matters, since the failure mode is
// a pattern collapsing to nothing rather than drifting a little. Measured at
// [1.5.0] R3 with set-attr repaired.
// THE TWO PATTERN FAMILIES ERODE DIFFERENTLY, and the R3 pilot proved it on its
// first run. A floor calibrated on today's count is wrong for half of them.
//
//   TEXT patterns KEEP their sites. `.textContent = "x"` becomes
//   `.textContent = t('k')` - still a dom-assign site, now compliant. The count
//   is stable across migration, so the floor can sit just under it.
//
//   MARKUP patterns LOSE their sites. `'>Tasks<'` becomes `'>' + th('k') + '<'`,
//   which the >prose< pattern no longer matches at all: the site does not turn
//   compliant, it ceases to exist. Converting 16 sites dropped html-text from
//   401 to 388 and html-aria from 43 to 40.
//
// So markup floors are set against the POST-R3 residue - the HTML-file sites,
// which do keep their data-i18n markers - not against today's total. Set
// against today they would have hard-failed the gate as BROKEN partway through
// this very round, which is the failure the floors exist to prevent, arriving
// from the opposite direction.
const PATTERN_FLOORS = {
  // markup: floor against the ~184 / ~31 / ~10 that survive full conversion
  "html-text":  120,   // 388 now, ~184 after R3 (HTML files keep their sites)
  "html-attr":   20,   //  87 now,  ~31 after R3
  "html-aria":    6,   //  40 now,  ~10 after R3
  // text: sites persist and merely flip to compliant, so floors sit under today
  "dom-assign":  70,   // measured 107
  "set-attr":     6,   // measured  11 - the one this rule exists for
  "modal-copy": 120,   // measured 189
  "toast":       40,   // measured  61
  "native-dlg":   6,   // measured  10
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS_FILES = ["newtab.js", "background.js", "storage.js", "bookmarks.js",
                  "license.js", "pro-access.js", "tracking.js", "gate.js", "offscreen.js"];
const HTML_FILES = ["newtab.html", "gate.html", "offscreen.html"];

// NOT LOCALIZED, BY DECISION - excluded with the reason recorded here rather
// than silently absent, so the next reader learns why instead of assuming an
// oversight ([1.5.0] R2 answers, 2026-08-31):
//
//   privacy-policy.html - dropped from localization entirely. It is a static
//     document with no script tags, also served publicly via GitHub Pages, and
//     its values would never be translated: a machine-translated privacy policy
//     is a legal document nobody has reviewed. Extracting it into a catalogue
//     the page cannot read would create a SECOND SOURCE OF TRUTH for text that
//     never changes language, and two sources drift. Revisit only when a human
//     translation is deliberately commissioned, at which point the page needs
//     wiring as a considered step rather than a mechanical one.
//
//   offscreen.html - its only string is a <title> on a document that is never
//     rendered (chrome.offscreen documents have no visible surface), so no user
//     can see it. Scanned, but it contains nothing to find.
const NOT_LOCALIZED = [
  { file: "privacy-policy.html", why: "not localized by decision; revisit when a human translation is commissioned" }
];

// --------------------------------------------------------------- exclusions
//
// Every entry here is a class that LOOKS like prose to a naive scan and is not.
// The list is the recon round's findings, not speculation — each one actually
// appeared and had to be removed.
const EXCLUDE = [
  { name: "css-selector",  re: /^\s*[.#\[][A-Za-z0-9_\-\[\]="'.:# >~+]*$/ },
  { name: "url",           re: /^(https?:|chrome(-extension)?:|data:|blob:|mailto:)/i },
  { name: "css-var",       re: /^var\(--/ },
  // CASE-SENSITIVE on purpose. CSS property names are lowercase, and the /i
  // flag this rule shipped with matched ordinary prose that happens to open
  // with a capitalized word and a colon - it was swallowing the Tips panel's
  // "Tip: Use LaunchPad's background picker...", a real user-visible sentence,
  // and would have hidden it from the gate forever. Found by R2's own
  // arithmetic: the count dropped by 214 where 215 strings had moved.
  { name: "css-decl",      re: /^[a-z-]+:\s*[a-z0-9(#.]/ },
  { name: "data-attr",     re: /^(data|aria)-[a-z-]+$/i },
  { name: "svg-path",      re: /^[Mm][\s\d.,\-]/ },
  // NOT a blanket single-token rule. "Cancel" and "Delete" are single tokens
  // and are among the most common user-visible strings in the product;
  // excluding every single token made the gate blind to 83 real labels on its
  // first run. Only identifier SHAPES are excluded, and a capitalized word is
  // never one of them.
  { name: "identifier",    re: /^[A-Za-z0-9_$.\-]*[_$.\-0-9][A-Za-z0-9_$.\-]*$/ },
  { name: "lowercase-key", re: /^[a-z]+$/ },                    // event names, enum values, keys
  { name: "const-case",    re: /^[A-Z0-9_]+$/ },                // SCREAMING_CASE constants
  { name: "entity-only",   re: /^(&[a-z]+;|&#\d+;|\s)+$/i },
  { name: "format-spec",   re: /^[%\d\s.:+\-/]*$/ },
];
const isExcluded = (s) => EXCLUDE.find((e) => e.re.test(s.trim()));

// Prose = at least two consecutive letters, and not one of the classes above.
function isProse(s) {
  const t = String(s).trim();
  if (t.length < 2) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;
  if (isExcluded(t)) return false;
  return true;
}

// ------------------------------------------------------- comment stripping
// Comments MUST go first. This repo's sources carry more English prose in
// comments than in UI strings, and every one of it would score as a violation.
function stripComments(src) {
  let out = "", i = 0, state = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (state === null) {
      if (c === "/" && n === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && n === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === "'" || c === '"' || c === "`") state = c;
      out += c; i++; continue;
    }
    if (state === "line") { if (c === "\n") { state = null; out += "\n"; } else out += " "; i++; continue; }
    if (state === "block") {
      if (c === "*" && n === "/") { state = null; out += "  "; i += 2; continue; }
      out += (c === "\n" ? "\n" : " "); i++; continue;
    }
    out += c;
    if (c === "\\") { if (i + 1 < src.length) out += src[i + 1]; i += 2; continue; }
    if (c === state) state = null;
    i++;
  }
  return out;
}

// Blank console.* argument spans so their contents cannot score.
function blankConsole(src) {
  let out = src;
  const re = /console\s*\.\s*\w+\s*\(/g;
  let m;
  while ((m = re.exec(out)) !== null) {
    let depth = 0, j = m.end ? m.end : re.lastIndex - 1;
    j = re.lastIndex - 1;
    let k = j;
    for (; k < out.length; k++) {
      if (out[k] === "(") depth++;
      else if (out[k] === ")") { depth--; if (depth === 0) break; }
    }
    // PRESERVE NEWLINES. Blanking a multi-line console call with plain spaces
    // deletes its line breaks, so every line number after it drifts - by two
    // lines at the first multi-line console.log in newtab.js, and more further
    // down. The reported violations were always the right STRINGS at the wrong
    // LINES, which nothing noticed until R3 tried to edit source by line number
    // and every single site missed.
    const span = out.slice(j, k + 1).replace(/[^\n]/g, " ");
    out = out.slice(0, j) + span + out.slice(k + 1);
    re.lastIndex = j;
  }
  return out;
}

// ---------------------------------------------------------------- patterns
// A SITE is a position where a string reaches the user. Each pattern captures
// the site and, where one exists, the argument that will carry the string.
const STR = `(?:"(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*')`;
const PATTERNS = [
  { id: "html-text",   argGroup: 1, re: new RegExp(`>\\s*([^<>{}\`"'\\\\]{2,140}?)\\s*<`, "g") },
  { id: "html-attr",   argGroup: 1, re: new RegExp(`\\b(?:title|placeholder|alt)\\s*=\\s*\\\\?["']([^"'<>{}\`]{2,140}?)\\\\?["']`, "g") },
  { id: "html-aria",   argGroup: 1, re: new RegExp(`\\baria-label\\s*=\\s*\\\\?["']([^"'<>{}\`]{2,140}?)\\\\?["']`, "g") },
  { id: "dom-assign",  argGroup: 2, re: new RegExp(`\\.(textContent|innerText|title|placeholder|ariaLabel)\\s*=\\s*([^;\\n]{1,160})`, "g") },
  // argGroup 1, and the trailing empty () is GONE. It used to be argGroup 2
  // pointing at that empty group, so `raw` was always "" and every setAttribute
  // site scored neutral - the pattern found its sites and then read nothing from
  // them. It reported "11 sites, 0 hardcoded" for two rounds, which reads as
  // clean and meant blind. Five real violations were invisible.
  { id: "set-attr",    argGroup: 1, re: new RegExp(`setAttribute\\s*\\(\\s*["'](?:title|aria-label|placeholder|alt)["']\\s*,\\s*([^)\\n]{1,160})`, "g") },
  { id: "modal-copy",  argGroup: 2, re: new RegExp(`\\b(title|message|primaryLabel|confirmLabel|cancelLabel|label|emptyText)\\s*:\\s*([^,\\n}]{1,180})`, "g") },
  { id: "toast",       argGroup: 1, re: new RegExp(`\\b(?:showToast|showUndoToast)\\s*\\(\\s*([^,;\\n]{1,180})`, "g") },
  // `window.` is spelled out rather than left to the lookbehind: the codebase
  // uses window.confirm and window.prompt three times, and a bare "not preceded
  // by a dot" rule excluded exactly those. The self-test caught it.
  { id: "native-dlg",  argGroup: 1, re: new RegExp(`(?:window\\s*\\.\\s*)?(?<![.\\w])(?:alert|confirm|prompt)\\s*\\(\\s*([^,;\\n]{1,180})`, "g") },
];

// Self-test fixture: one genuine instance of every pattern. If a pattern stops
// matching its own fixture the gate is broken, whatever the totals say.
const FIXTURE = [
  `var a = '<span class="x">Save current tabs</span>';`,
  `var b = '<button title="Rename session" aria-label="Session options">';`,
  `el.textContent = "Nothing in the trash.";`,
  `el.setAttribute("title", "Drag to reorder");`,
  `openTasksModal({ title: "Delete permanently?", message: "This cannot be undone." });`,
  `showToast("Session restored.");`,
  `window.confirm("Are you sure?");`,
  `prompt("Name this session:");`,
].join("\n");

function isCompliantArg(arg) {
  return /^\s*(?:I18n\s*\.\s*)?(?:t|th)\s*\(/.test(arg);
}

// ===========================================================================
// SINK ENFORCEMENT ([1.5.0] R3)
//
// t() returns plain text and th() returns HTML-escaped text. Which is correct
// is decided by the SINK, and the two mistakes are asymmetric: th() at a text
// sink prints "&amp;" on screen, which is loud and cosmetic, while a bare t()
// spliced into markup breaks the markup or injects, which is SILENT. So only
// the silent direction is enforced mechanically; the loud one polices itself.
//
// HOW A MARKUP CONCATENATION IS DISTINGUISHED FROM A TEXT ONE, which is the
// judgement the whole check rests on:
//
// Look at the string literal IMMEDIATELY adjacent to the call on either side -
// the literal it is being concatenated WITH, not the whole statement. The call
// is in a markup concatenation when that neighbouring literal shows one of two
// unambiguous signs of HTML construction:
//
//   1. it contains a tag           ... '<span class="x">' + t(k)
//   2. it OPENS an attribute value ... ' title="' + t(k) + '"'
//
// Deliberately NARROW. A statement-wide search would flag a plain-text call
// that merely sits in a function which also builds markup somewhere else, and
// a false positive here trains people to work around the gate. Adjacency is
// the property that actually determines where the value lands.
//
// The inverse (th() at a text sink) is NOT flagged: it is visible on the first
// runtime pass, and flagging it would mean deciding sinks for call sites the
// gate cannot see the destination of.
// ===========================================================================
const TAG_IN_LITERAL = /<\s*\/?\s*[a-zA-Z][-\w]*/;
const ATTR_OPENER = /[a-zA-Z-]+\s*=\s*\\?["']\s*$/;

function markupMisuse(src, file) {
  const out = [];
  const call = /(?:I18n\s*\.\s*)?\bt\s*\(/g;
  let m;
  while ((m = call.exec(src)) !== null) {
    // `th(` also matches `\bt\s*\(`? No - \b before t means "th(" starts at h's
    // t... guard explicitly so th() is never mistaken for t().
    const before = src.slice(Math.max(0, m.index - 2), m.index + 1);
    if (/th\s*\($/.test(src.slice(Math.max(0, m.index - 1), m.index + 2))) continue;

    // the literal immediately to the LEFT, across a + operator
    const left = src.slice(Math.max(0, m.index - 220), m.index);
    const leftLit = /((?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'))\s*\+\s*$/.exec(left);
    // the literal immediately to the RIGHT, across a + operator, after the call
    let depth = 0, j = m.index + m[0].length - 1, end = -1;
    for (; j < src.length && j < m.index + 400; j++) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") { depth--; if (depth === 0) { end = j; break; } }
    }
    const right = end === -1 ? "" : src.slice(end + 1, end + 220);
    const rightLit = /^\s*\+\s*((?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'))/.exec(right);

    const l = leftLit ? leftLit[1].slice(1, -1) : null;
    const r = rightLit ? rightLit[1].slice(1, -1) : null;
    const markupLeft = l !== null && (TAG_IN_LITERAL.test(l) || ATTR_OPENER.test(l));
    const markupRight = r !== null && TAG_IN_LITERAL.test(r);
    if (markupLeft || markupRight) {
      out.push({ file, line: src.slice(0, m.index).split("\n").length,
                 pattern: "sink-misuse", verdict: "violation",
                 text: (l !== null ? l.slice(-40) : "") + " + t(...) + " + (r !== null ? r.slice(0, 40) : "") });
    }
  }
  return out;
}
function literalOf(arg) {
  const m = String(arg).trim().match(new RegExp(`^${STR}`));
  if (!m) return null;
  return m[0].slice(1, -1);
}

function scan(src, file) {
  const sites = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(src)) !== null) {
      const raw = m[p.argGroup];
      if (raw == null) continue;
      let verdict, text = null;
      if (p.id.startsWith("html-")) {
        text = raw;
        verdict = isProse(text) ? "violation" : "neutral";
      } else if (isCompliantArg(raw)) {
        verdict = "compliant";
      } else {
        const lit = literalOf(raw);
        if (lit === null) verdict = "neutral";
        else { text = lit; verdict = isProse(lit) ? "violation" : "neutral"; }
      }
      sites.push({ file, pattern: p.id, verdict, text,
                   line: src.slice(0, m.index).split("\n").length });
    }
  }
  return sites;
}

// ------------------------------------------------------ catalogue-value rules
// Two rules the catalogue must hold from the very first message R2 writes, so
// they never have to be retrofitted across 763 values.
function checkCatalogues() {
  const problems = [];

  // THE INTERNAL CATALOGUE IS CHECKED TOO ([1.5.0] R2). _locales/ holds only the
  // manifest's two strings; every UI message lives in locales/*.js, and a rule
  // that governs "catalogue values" but only inspects the smaller of the two
  // catalogues is a rule with a hole in it. Parsed by regex rather than by
  // executing the file, because the gate must not need an I18n global.
  const uiDir = path.join(repoRoot, "locales");
  if (fs.existsSync(uiDir)) {
    for (const f of fs.readdirSync(uiDir).filter((n) => n.endsWith(".js"))) {
      const src = fs.readFileSync(path.join(uiDir, f), "utf8");
      const entries = [...src.matchAll(/"([A-Za-z0-9_]+)":\s*\{([\s\S]*?)\n\s*\}/g)];
      if (!entries.length) {
        problems.push([`locales/${f}`, "no messages parsed - the catalogue shape changed"]);
        continue;
      }
      for (const [, key, body] of entries) {
        const msg = /"message":\s*("(?:[^"\\]|\\.)*")/.exec(body);
        if (!msg) { problems.push([`${f}/${key}`, "no message value"]); continue; }
        let value;
        try { value = JSON.parse(msg[1]); } catch { problems.push([`${f}/${key}`, "unparseable message"]); continue; }
        if (/<\s*\/?\s*[a-z]/i.test(value)) problems.push([`${f}/${key}`, "value contains markup"]);
        if (value.includes("—")) problems.push([`${f}/${key}`, "value contains an em dash"]);
        if (!/"description":/.test(body)) problems.push([`${f}/${key}`, "missing description"]);
      }
    }
  }

  const dir = path.join(repoRoot, "_locales");
  if (!fs.existsSync(dir)) return problems;
  for (const loc of fs.readdirSync(dir)) {
    const f = path.join(dir, loc, "messages.json");
    if (!fs.existsSync(f)) continue;
    let json;
    try { json = JSON.parse(fs.readFileSync(f, "utf8")); }
    catch (e) { problems.push([`_locales/${loc}/messages.json`, "unparseable: " + e.message]); continue; }
    for (const [k, v] of Object.entries(json)) {
      const msg = v && typeof v === "object" ? v.message : v;
      if (typeof msg !== "string") continue;
      // No markup in catalogue values: the escaping design depends on it, and
      // it is what makes a raw accessor unnecessary.
      if (/<\s*\/?\s*[a-z]/i.test(msg)) problems.push([`${loc}/${k}`, "value contains markup"]);
      // The em-dash ban applies to catalogue values (PLAN, standing rule).
      if (msg.includes("—")) problems.push([`${loc}/${k}`, "value contains an em dash"]);
      if (!v || typeof v !== "object" || !v.description) {
        problems.push([`${loc}/${k}`, "missing description"]);
      }
    }
  }
  return problems;
}

// ------------------------------------------------------------------- run
let literals = 0, sites = [];
for (const f of JS_FILES) {
  const p = path.join(repoRoot, f);
  if (!fs.existsSync(p)) continue;
  const src = blankConsole(stripComments(fs.readFileSync(p, "utf8")));
  literals += (src.match(new RegExp(STR, "g")) || []).length;
  sites = sites.concat(scan(src, f));
  sites = sites.concat(markupMisuse(src, f));
}
// HTML is scanned TAG-AWARE rather than by the JS patterns, because a migrated
// static string is NOT recognisable from its text.
//
// [1.5.0] R2 deliberately LEAVES THE ENGLISH TEXT IN THE MARKUP as the fallback
// for a page whose JS never runs - that is what makes the byte-identical claim
// provable. So `<span data-i18n="k">Restore Session</span>` still contains the
// words, and a text-only scan counts it as hardcoded forever. The first run
// after R2 showed exactly that: 223 strings moved and the count did not budge.
//
// What marks a string as migrated is therefore the data-i18n ATTRIBUTE on its
// sink, not the absence of the words. A text node is compliant when its
// CONTAINING element carries data-i18n; a title/placeholder/alt/aria-label is
// compliant when its own tag carries the matching data-i18n-<attr>.
const VOID_EL = new Set(["input", "img", "br", "meta", "link", "hr", "source", "area", "base", "col"]);
const TAG_RE = /<(\/?)([a-zA-Z][-\w]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g;
const ATTR_SINK = { title: "data-i18n-title", placeholder: "data-i18n-placeholder",
                    alt: "data-i18n-alt", "aria-label": "data-i18n-aria-label" };

function scanHtml(src, file) {
  const out = [];
  const tags = [...src.matchAll(TAG_RE)];
  const lineAt = (i) => src.slice(0, i).split("\n").length;

  // --- attributes: the sink and its marker are on the SAME tag
  for (const m of tags) {
    if (m[1]) continue;
    const attrs = m[3];
    for (const [attr, marker] of Object.entries(ATTR_SINK)) {
      const am = new RegExp(`(?<![-\\w])${attr}\\s*=\\s*"([^"]*)"`).exec(attrs);
      if (!am) continue;
      const value = am[1].trim();
      if (!isProse(value)) continue;
      out.push({ file, pattern: attr === "aria-label" ? "html-aria" : "html-attr",
                 verdict: attrs.includes(marker + "=") ? "compliant" : "violation",
                 text: value, line: lineAt(m.index) });
    }
  }

  // --- text nodes: resolve the CONTAINING element with a depth walk, because
  // text can follow a closing tag (`<button><svg/></svg>Delete</button>`) and
  // the previous tag is then the wrong element entirely.
  for (const tm of src.matchAll(/>([^<>]+)</g)) {
    const text = tm[1].replace(/\s+/g, " ").trim();
    if (!isProse(text)) continue;
    const pos = tm.index + 1;
    let depth = 0, container = null;
    for (let i = tags.length - 1; i >= 0; i--) {
      const t = tags[i];
      if (t.index + t[0].length > pos) continue;
      const name = t[2].toLowerCase();
      if (VOID_EL.has(name) || t[4]) continue;
      if (t[1]) { depth++; continue; }
      if (depth === 0) { container = t; break; }
      depth--;
    }
    out.push({ file, pattern: "html-text",
               verdict: container && container[3].includes("data-i18n=") ? "compliant" : "violation",
               text, line: lineAt(pos) });
  }
  return out;
}

for (const f of HTML_FILES) {
  const p = path.join(repoRoot, f);
  if (!fs.existsSync(p)) continue;
  let src = fs.readFileSync(p, "utf8")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "<script></script>")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "<style></style>")
    .replace(/<!--[\s\S]*?-->/g, "");
  sites = sites.concat(scanHtml(src, f));
}

// --- self-test
const selfMissed = [];
for (const p of PATTERNS) {
  p.re.lastIndex = 0;
  if (!p.re.test(FIXTURE)) selfMissed.push(p.id);
}

const byPattern = {};
for (const s of sites) {
  byPattern[s.pattern] = byPattern[s.pattern] || { total: 0, violation: 0, compliant: 0 };
  byPattern[s.pattern].total++;
  if (s.verdict === "violation") byPattern[s.pattern].violation++;
  if (s.verdict === "compliant") byPattern[s.pattern].compliant++;
}
// The BACKLOG only. sink-misuse rows are violations too, but they are a defect
// and are reported separately, so counting them here would report a defect as
// "awaiting migration" and quietly inflate the number the round reconciles against.
const violations = sites.filter((s) => s.verdict === "violation" && s.pattern !== "sink-misuse");

console.log("");
console.log("I18N SITE GATE — " + (ENFORCING ? "ENFORCING" : "SKELETON (not enforcing)"));
console.log("");
console.log("  pattern         sites   hardcoded   via t()/th()");
console.log("  " + "-".repeat(52));
for (const p of PATTERNS) {
  const b = byPattern[p.id] || { total: 0, violation: 0, compliant: 0 };
  console.log("  " + p.id.padEnd(14) + String(b.total).padStart(6) +
              String(b.violation).padStart(12) + String(b.compliant).padStart(15));
}
console.log("  " + "-".repeat(52));
console.log("  " + "TOTAL".padEnd(14) + String(sites.length).padStart(6) +
            String(violations.length).padStart(12) +
            String(sites.filter((s) => s.verdict === "compliant").length).padStart(15));
console.log("");
// Per-file breakdown behind an env flag. Kept because it is what reconciled
// R2's "the count must drop by exactly what you moved" check: the totals alone
// could not say WHICH file still held a violation.
// Violation dump behind an env flag. Kept because R3 and R4 each have to
// reconcile "the count dropped by exactly what I converted" against an
// independent classification, and totals alone cannot say WHICH site differs.
if (process.env.I18N_DUMP) {
  fs.writeFileSync(process.env.I18N_DUMP, sites
    .filter((s) => s.verdict === "violation")
    .map((s) => [s.file, s.line, s.pattern, JSON.stringify(s.text)].join("|"))
    .join("\n"));
}
if (process.env.I18N_DEBUG) {
  const per = {};
  for (const s of sites) per[s.file + " " + s.verdict] = (per[s.file + " " + s.verdict] || 0) + 1;
  console.log("  --- per file/verdict ---");
  for (const k of Object.keys(per).sort()) console.log("   " + k.padEnd(36) + per[k]);
  console.log("");
}
console.log("  string literals tokenized : " + literals + "  (floor " + LITERAL_FLOOR + ")");
console.log("  construction sites found  : " + sites.length + "  (floor " + SITE_FLOOR + ")");

const catProblems = checkCatalogues();
if (catProblems.length) {
  console.log("\n  catalogue value problems:");
  for (const [k, why] of catProblems) console.log("    " + k + " — " + why);
}

// ===========================================================================
// THE RULE THAT DECIDES WHICH SIDE OF `ENFORCING` A CHECK SITS ON
// ([1.5.0] R3, carried forward from the sink mutant that was not caught):
//
//   A check whose finding is a DEFECT fails UNCONDITIONALLY.
//   Only a check whose finding is a known BACKLOG ITEM may sit behind ENFORCING.
//
// ENFORCING exists for exactly one thing: "this string has not been migrated
// yet" is a counted, expected, shrinking backlog, and failing the build on it
// before the migration finishes would mean the gate could never be added until
// the work was already done. Nothing else belongs there. A defect in code that
// has ALREADY been converted is not waiting for anything.
//
// AUDIT OF EVERY CHECK AGAINST THAT RULE:
//
//   self-test / floors      DEFECT (in the gate itself)   unconditional, exit 2
//   sink misuse             DEFECT (in converted code)    unconditional, exit 1
//   catalogue values        DEFECT (markup, em dash, or   unconditional, exit 1
//                           a message with no description
//                           - all wrong the moment they
//                           are written, not later)
//   hardcoded strings       BACKLOG                       behind ENFORCING
//
// No check was found on the wrong side after the sink-misuse fix. One counting
// overlap was: `violations` included the sink-misuse rows, so the "N strings
// await migration" line would have reported a defect as backlog. Separated
// below - the backlog count now means only what it says.
// ===========================================================================
const broken = [];
if (selfMissed.length) broken.push("patterns that no longer match their own fixture: " + selfMissed.join(", "));
for (const [id, floor] of Object.entries(PATTERN_FLOORS)) {
  const n = sites.filter((s) => s.pattern === id).length;
  if (n < floor) broken.push(`pattern "${id}" found only ${n} sites, below its floor ${floor}`);
}
if (literals < LITERAL_FLOOR) broken.push(`only ${literals} string literals tokenized, below floor ${LITERAL_FLOOR}`);
if (sites.length < SITE_FLOOR) broken.push(`only ${sites.length} construction sites found, below floor ${SITE_FLOOR}`);

if (broken.length) {
  console.log("\nI18N SITE GATE: BROKEN — the gate itself is not measuring what it claims.");
  for (const b of broken) console.log("  ! " + b);
  process.exit(2);
}
// SINK MISUSE FAILS UNCONDITIONALLY, not behind ENFORCING.
//
// ENFORCING gates "this string has not migrated yet", which is a known, counted
// backlog. A bare t() spliced into markup is a different thing entirely: it is a
// DEFECT IN CODE THAT HAS ALREADY BEEN CONVERTED, and it is the silent one. The
// first mutant run caught this distinction the hard way - the misuse was counted
// in the total and the gate still exited 0, because it was filed with the
// backlog instead of with the defects.
const misuse = sites.filter((s) => s.pattern === "sink-misuse" && s.verdict === "violation");
if (misuse.length) {
  console.log("\nI18N SITE GATE: FAIL — " + misuse.length +
              " bare t() spliced into markup (must be th()).");
  for (const m of misuse.slice(0, 20)) console.log(`  ${m.file}:${m.line}  ${m.text}`);
  process.exit(1);
}
if (catProblems.length) {
  console.log("\nI18N SITE GATE: FAIL — " + catProblems.length + " catalogue value problem(s).");
  process.exit(1);
}
if (ENFORCING && violations.length) {
  console.log("\nI18N SITE GATE: FAIL — " + violations.length + " hardcoded user-visible string(s).");
  for (const v of violations.slice(0, 40)) {
    console.log(`  ${v.file}:${v.line} [${v.pattern}] ${JSON.stringify(v.text).slice(0, 90)}`);
  }
  process.exit(1);
}
console.log("\nI18N SITE GATE: PASS — self-test green, " + sites.length +
            " sites inspected, " + literals + " literals tokenized." +
            (ENFORCING ? "" : " " + violations.length + " strings await migration (R2/R3)."));
process.exit(0);
