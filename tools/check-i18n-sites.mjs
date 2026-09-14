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
// 749 at [1.5.0] R1, 605 after R4 stage 1, 565 after stage 1b - the last drop
// because 40 array entries stopped being construction sites when they started
// holding a KEY instead of a call. The floor tracks the residue rather than the
// original, or it fails the round that legitimately shrinks the surface.
const SITE_FLOOR = 520;               // measured 565 after R4 stage 1b

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
  // R4 stage 1b took 40 sites OUT of this pattern's view for a good reason: an
  // array entry that used to read `label: t("k")` now reads `labelKey: "k"`, and
  // a key reference is not a construction site. Measured 189 -> 149. The floor
  // follows the residue down; leaving it at 120 would have been fine here, but
  // the comment matters more than the number - a floor is only meaningful when
  // it is set against what SHOULD survive, and 40 sites disappearing is exactly
  // the shape of an accident, so it is recorded as deliberate.
  "modal-copy": 110,   // measured 149 after stage 1b (was 189)
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
//     can see it.
//
// [1.5.0] R5.3: THIS LIST NOW FILTERS THE SCAN. It used to be declared and
// never read - documentation of a decision with no mechanism behind it, which
// held only because privacy-policy.html was not in HTML_FILES anyway. The
// offscreen <title> made the gap visible: the comment above claimed the file
// "contains nothing to find" while the scan found one thing and counted it
// toward the migration backlog. Either the decision is real and the scan should
// honour it, or the decision should be reversed; this makes it real.
const NOT_LOCALIZED = [
  { file: "privacy-policy.html", why: "not localized by decision; revisit when a human translation is commissioned" },
  { file: "offscreen.html", why: "a <title> on a document with no visible surface; nobody can read it" }
];
const NOT_LOCALIZED_FILES = NOT_LOCALIZED.map((x) => x.file);
const isLocalized = (f) => NOT_LOCALIZED_FILES.indexOf(f) === -1;

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
  // A GLYPH SPELLED AS AN ESCAPE IS NOT PROSE. "\u22EE" is the three-dot menu
  // icon; the tokenizer reads the six SOURCE characters, so "u22EE" scores as
  // two consecutive letters and the string reads as a sentence. Same family as
  // entity-only, and deliberately requires the WHOLE string to be escapes,
  // punctuation or symbols - " \u00B7 on " keeps its "on", which is a real
  // preposition joining a session to its task and is genuinely translatable.
  { name: "escape-glyph",  re: /^(?:\\u[0-9A-Fa-f]{4}|\\x[0-9A-Fa-f]{2}|\\[nrt]|[\s\p{P}\p{S}])+$/u },
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
  // The `>` must CLOSE A TAG and the `<` must OPEN one. Without those two
  // guards a JS comparison reads as markup: `if (x >= rect.left - pad && x <=
  // rect.right + pad)` captured "= rect.left - pad && x" as user-facing text,
  // and six such expressions sat in the backlog for three rounds looking like
  // work to do. `(?<![=<>!-])` drops `>=`, `=>`, `->`, `<<`; `(?=[a-zA-Z/])`
  // requires the closing `<` to begin a real tag rather than precede a space
  // or a digit, which is what every `a < b` comparison does.
  { id: "html-text",   argGroup: 1, re: new RegExp(`(?<![=<>!-])>\\s*([^<>{}\`"'\\\\]{2,140}?)\\s*<(?=[a-zA-Z/])`, "g") },
  // (?<![.\w]) so a JS PROPERTY ASSIGNMENT is not mistaken for an HTML
  // attribute. `el.title = "Options"` matched both this pattern and dom-assign,
  // so that one site was counted TWICE and the gate's totals were inflated by
  // every such line. Found in R3 stage C: 21 conversions dropped the count by
  // 24, and the three extra were exactly the double-counted ones.
  { id: "html-attr",   argGroup: 1, re: new RegExp(`(?<![.\\w])(?:title|placeholder|alt)\\s*=\\s*\\\\?["']([^"'<>{}\`]{2,140}?)\\\\?["']`, "g") },
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
// ===========================================================================
// CONCATENATED PROSE ([1.5.0] blocker, Asana 1218050333264862)
//
// THE BLIND SPOT. Every pattern above reads SOURCE TEXT. `html-text` needs a
// `>` and a `<` inside ONE string literal, so a sentence assembled ACROSS a
// concatenation is invisible to all of them. The decisive illustration was two
// lines apart in one dashboard headline:
//
//   '<div class="pp-dash-card-title">That's the day</div>'      CAUGHT
//   (open === 1 ? 'One still on the board.' : 'Still a few...')  INVISIBLE
//
// The second is a user-facing sentence that lands between two markup fragments.
// No amount of care with `>` and `<` can see it, because neither character is
// in the literal that holds the prose.
//
// WHY NOT A FOURTH REGEX. The task warned against it and the warning is right:
// the shape crosses line breaks, parentheses and a ternary, and a regex that
// spans those reliably is one that also matches things it should not. Three
// patterns each with a blind spot plus a fourth bolted on is how P8's family
// gets built, and this repo has already found one gate whose regex could
// satisfy itself from a different rule than the one it named.
//
// WHY NOT AN AST. It is the most honest instrument and it was rejected on cost
// rather than on merit: this repo has ZERO dependencies and no node_modules by
// design, `build.sh` gates the shipped file list, and acorn/espree are not
// available. Adding a parser to run one gate is a larger change than the gate.
//
// WHAT THIS IS INSTEAD: a CHAIN SCANNER over the literal token stream. The gate
// already tokenizes string literals; what it never did was RELATE two adjacent
// ones. This walks the literals in order and asks what separates each from the
// next. If the glue is concatenation - and not an argument comma, a statement
// break or an object brace - the literals belong to one expression, and that
// expression can be judged as a whole.
//
// It reasons about the EXPRESSION rather than the characters, which is why it
// crosses the line break, the parentheses and the ternary that defeated the
// regexes. It is not an AST and does not pretend to be; its limits are listed
// in the coverage report the gate prints, because a number without its
// coverage statement is the thing this whole task exists to prevent.
//
// NO DOUBLE COUNTING WITH html-text, and the rule is exact rather than
// approximate. html-text owns text bracketed by `>` and `<` INSIDE one literal.
// This owns only the complement: the run BEFORE a literal's first `<` and the
// run AFTER its last `>`. Those are precisely the runs that continue into the
// concatenation, and precisely the ones html-text cannot see. R3's history is
// the reason for the care - `el.title = "x"` matched two patterns at once and
// inflated the totals by every such line for three rounds.
// ===========================================================================

// Glue that keeps two literals in the same expression. A comma separates
// arguments or object entries, a semicolon ends a statement, and a brace opens
// a different scope - any of those and the two literals are NOT one sentence
// being built. Requiring one of + ? : keeps `foo('a') bar('b')` apart while
// letting a ternary's two branches stay together, which is the exact shape of
// the dashboard headline this was written for.
const CHAIN_BREAK = /[,;{}]/;
const CHAIN_JOIN = /[+?:]/;

// A literal is part of MARKUP construction if any literal in its chain opens or
// closes a tag. Without this a SQL string or a log message assembled from parts
// would score as user-facing markup.
const CONCAT_TAG = /<\s*\/?\s*[a-zA-Z][-\w]*|\/\s*>/;

// ===========================================================================
// COVERAGE PROBES — the statement that has to travel with the number.
//
// Three times in this arc a null result was read as "nothing" rather than
// "nothing where I looked": the site gate read complete and a runtime probe
// found 81 more; the probe read complete and a static scan found 350 more; the
// static scan read complete and a whole CONSTRUCTION SHAPE was invisible. Each
// instrument was believed because it reported a number and said nothing about
// its own edges.
//
// So the edges are MECHANICAL here rather than prose. Every shape below is run
// through the real scanner on every gate start and reported as seen or blind.
// Nobody has to remember to update a comment: if someone later teaches the gate
// template literals, that row flips by itself. A shape marked `blind` that
// starts being seen is an improvement and is announced, not failed; a shape
// marked `seen` that goes blind is a BROKEN gate.
// ===========================================================================
const COVERAGE_PROBES = [
  { name: "prose across a concatenation", expect: "seen",
    src: `var a = '<div class="h">' + 'One still on the board.' + '</div>';` },
  { name: "prose in a ternary between fragments", expect: "seen",
    src: `var b = '<div>' + (n === 1 ? 'One left.' : 'A few left.') + '</div>';` },
  { name: "prose trailing an unclosed fragment", expect: "seen",
    src: `var c = '<p class="m">This is an instance of a task. ' + x + '</p>';` },
  { name: "prose inside one literal (html-text)", expect: "seen",
    src: `var d = '<span class="x">Save current tabs</span>';` },

  // ---- the edges, and each one is a real shape in this codebase ----
  { name: "TEMPLATE LITERAL", expect: "blind",
    src: "var e = `<div class=\"h\">${n} still on the board.</div>`;" },
  // THIS ROW WAS WRITTEN AS `blind` AND THE PROBE SAID OTHERWISE on its first
  // run. A callback that builds its whole fragment internally is one chain like
  // any other - the braces sit OUTSIDE the glue, not in it. The round's
  // assumption was wrong and the probe is why that is known rather than
  // believed.
  { name: "markup built wholly inside a .map() callback", expect: "seen",
    src: `var f = items.map(function (i) { return '<li>' + 'Open in a new tab' + '</li>'; }).join("");` },
  // The genuinely blind half of the same family: the tag is opened before the
  // map and closed after it, so no single chain holds both the markup and the
  // prose.
  { name: "markup opened outside a .map(), closed after", expect: "blind",
    src: `var f2 = '<ul>' + items.map(function (i) { return 'Nothing here yet.'; }).join("") + '</ul>';` },
  { name: "assembled with += across statements", expect: "blind",
    src: `var g = '<ul>'; g += 'Nothing here yet.'; g += '</ul>';` },
  { name: "prose returned by a helper, markup built elsewhere", expect: "blind",
    src: `function lbl() { return 'Nothing here yet.'; }\nvar h = '<div>' + lbl() + '</div>';` },
  { name: "prose in an array consumed later", expect: "blind",
    src: `var i3 = ['Daily', 'Weekly', 'Monthly'];\nvar j3 = '<b>' + i3[0] + '</b>';` },
  { name: "textContent from a variable set elsewhere", expect: "blind",
    src: `var k3 = 'Nothing in the trash.';\nfunction z(el) { el.textContent = k3; }` },

  // [1.5.0] R5.3. THE SHAPE NO ROW NAMED UNTIL NOW. Every pattern here keys off
  // markup or off a sink NAME, and then reads the sink's FIRST argument as a
  // literal. An argument that begins with an identifier - a ternary, a
  // concatenation, a variable - never yields one, so the sentence is not merely
  // missed, it is unreachable. This is what produces "3 tabs" and
  // "1 unfinished task", and it is what R5.2 found behind eight of the ten
  // hardcoded confirm halves.
  { name: "assembled into a sink with no markup anywhere", expect: "blind",
    src: `showToast(hostA + ' and ' + hostB + ' are different sites.');` },
  { name: "a counted phrase with no markup, in a ternary", expect: "blind",
    src: `el.textContent = n + (n === 1 ? ' tab' : ' tabs');` },
];

function runCoverage() {
  const rows = [];
  for (const probe of COVERAGE_PROBES) {
    const prepared = blankConsole(stripComments(probe.src));
    const hits = scan(prepared, "<probe>").filter((x) => x.verdict === "violation");
    rows.push({ name: probe.name, expect: probe.expect, seen: hits.length > 0 });
  }
  return rows;
}

function literalTokens(src) {
  const re = new RegExp(STR, "g");
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, value: m[0].slice(1, -1) });
  }
  return out;
}

// WALKING THE CHAIN AS MARKUP, WITH PROVENANCE - and the first cut of this did
// it per-literal, which was wrong in a way worth recording.
//
// Taking "everything before a literal's first `<`" as a text run assumes every
// literal starts OUTSIDE a tag. Many do not: `'vector-effect="non-scaling-
// stroke"></circle>'` opens inside a tag its predecessor left open, and
// `'">&times;</button>'` opens inside an attribute value. Per-literal, both read
// as prose and both were false positives on the first run.
//
// A chain is one markup document assembled from parts, so it is walked as one.
// The literals are concatenated with a one-character SENTINEL standing for each
// interpolated expression, a map records which segment every character came
// from, and the combined string is walked tag by tag. A text run then belongs
// to this detector when it touches MORE THAN ONE SEGMENT - which is exactly the
// definition of "continues across the concatenation", and exactly what
// html-text cannot see. A run inside a single literal is html-text's and is
// left alone, so the two can never count the same sentence twice.
const EXPR_SENTINEL = "\u0001";

function chainProse(chain) {
  const segs = [];
  for (let k = 0; k < chain.length; k++) {
    if (k > 0) segs.push({ lit: null, text: EXPR_SENTINEL });
    segs.push({ lit: chain[k], text: chain[k].value });
  }
  let combined = "";
  const owner = [];
  for (const seg of segs) {
    for (let q = 0; q < seg.text.length; q++) owner.push(seg);
    combined += seg.text;
  }

  const found = [];
  const takeRun = (from, to) => {
    if (to <= from) return;
    const touched = new Set(owner.slice(from, to));
    // One segment means the run never leaves its literal: html-text's job.
    if (touched.size <= 1) return;
    for (const seg of touched) {
      if (!seg.lit) continue;
      // The portion of THIS literal that falls inside the run, reported on its
      // own line so a ternary's two branches stay two separate sentences rather
      // than one glued impossibility.
      let piece = "";
      for (let q = from; q < to; q++) if (owner[q] === seg) piece += combined[q];
      // No attribute-glue trim here, deliberately. An earlier cut carried one;
      // mutation testing showed it could be disabled without changing a single
      // site, because this walk only ever hands out text from BETWEEN tags and
      // glue lives inside them. If a future change lets a run start inside a
      // tag, that trim comes back WITH a fixture that fails without it.
      const text = piece.trim();
      if (isProse(text)) found.push({ lit: seg.lit, text });
    }
  };

  // A CHAIN CAN START INSIDE A TAG, and assuming otherwise was the last false
  // positive. `' style="--note-paper: ' + v + ';"></button>'` is a chain whose
  // `<button` lives in an earlier literal that a comma split away, so the walk
  // begins mid-attribute and read `style="--note-paper:` as a sentence. A `>`
  // appearing before any `<` is exactly the signature of that, and the fix is
  // to skip to it: whatever precedes it was inside a tag.
  let i = 0;
  const firstGt = combined.indexOf(">"), firstLt = combined.indexOf("<");
  if (firstGt !== -1 && (firstLt === -1 || firstGt < firstLt)) i = firstGt + 1;
  while (i < combined.length) {
    const lt = combined.indexOf("<", i);
    if (lt === -1) { takeRun(i, combined.length); break; }
    takeRun(i, lt);
    const gt = combined.indexOf(">", lt);
    if (gt === -1) break;                 // a tag this chain never closes
    i = gt + 1;
  }
  return found;
}

function scanConcatProse(src, file) {
  const toks = literalTokens(src);
  const sites = [];
  let i = 0;
  while (i < toks.length) {
    // Grow a chain while the glue keeps the literals in one expression.
    let j = i;
    while (j + 1 < toks.length) {
      const glue = src.slice(toks[j].end, toks[j + 1].start);
      if (CHAIN_BREAK.test(glue) || !CHAIN_JOIN.test(glue)) break;
      j++;
    }
    const chain = toks.slice(i, j + 1);
    if (chain.length > 1 && chain.some((t) => CONCAT_TAG.test(t.value))) {
      for (const hit of chainProse(chain)) {
        sites.push({ file, pattern: "concat-text", verdict: "violation", text: hit.text,
                     line: src.slice(0, hit.lit.start).split("\n").length });
      }
    }
    i = j + 1;
  }
  return sites;
}

// SELF-TEST, and it is the NEGATIVE MUTANT the task requires rather than a
// decoration. A detector extended for a shape it still cannot see reports a
// bigger number and reads as fixed, which is how the previous three instances
// of this happened. So the gate refuses to run unless it can prove, on every
// start, that it sees the exact shape it was extended for AND stays quiet on
// the two things nearest to it.
const CONCAT_FIXTURE_SEEN = [
  // the dashboard headline, verbatim in shape: prose in a ternary between two
  // markup fragments, across a line break
  `var a = '<div class="h">' +\n  (n === 1 ? 'One still on the board.' : 'Still a few on the board.') +\n'</div>';`,
  // prose trailing a markup fragment, with no closing tag in its own literal
  `var b = '<p class="m">This is an instance of a recurring task. ' + x + '</p>';`,
  // a bare label between two fragments
  `var c = '<button type="button">' + 'Clear examples' + '</button>';`,
];
const CONCAT_FIXTURE_QUIET = [
  // NOT markup: no tag anywhere in the chain, so nothing here reaches a user
  // as HTML. Flagging it would make every assembled log line a violation.
  `var d = 'SELECT * FROM ' + table + ' WHERE id = ' + id;`,
  // attribute glue, which has letters and is in no EXCLUDE class - the nearest
  // false positive to the real shape
  `var e = '<button' + ' aria-disabled="' + flag + '">' + '</button>';`,
  // ALREADY COMPLIANT and fully inside one literal: html-text's territory, and
  // counting it here would double-count exactly as R3's title/dom-assign did
  `var f = '<span>Save current tabs</span>' + '<i></i>';`,
  // A literal that OPENS INSIDE A TAG its predecessor left open. The first cut
  // of this detector read "vector-effect=..." as a sentence.
  `var g = '<circle class="r" ' + 'vector-effect="non-scaling-stroke"></circle>' + '';`,
  // A literal that OPENS INSIDE AN ATTRIBUTE VALUE. The first cut read
  // '">&times;' as prose, entity and all.
  `var h = '<button title="' + k + '">&times;</button>' + '';`,
  // CSS inside a style attribute, which has letters and colons and is not a
  // sentence. The first cut reported ';color:'.
  `var i2 = '<span style="background:' + c1 + ';color:' + c2 + '">' + n + '</span>';`,
  // A chain that BEGINS INSIDE A TAG, its opener split away by a comma in a
  // neighbouring call. The second cut reported 'style="--note-paper:'.
  `var k = ' style="--note-paper: ' + v + ';"></button>';`,
];

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
  // The chain scanner runs over the same prepared source the patterns do -
  // comments stripped, consoles blanked - so it inherits every exclusion they
  // already earned rather than re-deriving them.
  for (const c of scanConcatProse(src, file)) sites.push(c);
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
        // A PLURAL entry carries no "message" - it carries a form per CLDR
        // category. Every form is a value a user reads, so each is checked by
        // the same rules; checking only "message" would have exempted plurals
        // from the markup, em-dash and entity rules entirely, which is a hole
        // that opens the moment the first plural lands (R4 stage 1).
        const values = [];
        const msg = /"message":\s*("(?:[^"\\]|\\.)*")/.exec(body);
        // One level of nesting allowed, because a plural FORM contains
        // "{count}" and a lazy [\s\S]*? stops at that placeholder's brace,
        // truncating the object to `{"one": "Move {count}` - which parses as
        // nothing and reads as a broken catalogue rather than a broken regex.
        const plural = /"plural":\s*(\{(?:[^{}]|\{[^{}]*\})*\})/.exec(body);
        if (msg) {
          try { values.push(["message", JSON.parse(msg[1])]); }
          catch { problems.push([`${f}/${key}`, "unparseable message"]); continue; }
        } else if (plural) {
          let forms;
          try { forms = JSON.parse(plural[1]); }
          catch { problems.push([`${f}/${key}`, "unparseable plural forms"]); continue; }
          const names = Object.keys(forms);
          if (!names.length) { problems.push([`${f}/${key}`, "plural with no forms"]); continue; }
          // English needs `other`; without it selectPluralForm has nothing to
          // fall back to and t() returns the KEY at some count nobody tested.
          if (!names.includes("other")) problems.push([`${f}/${key}`, "plural has no 'other' form"]);
          for (const n of names) values.push([n, String(forms[n])]);
        } else {
          problems.push([`${f}/${key}`, "no message value"]); continue;
        }
        for (const [where, value] of values) {
          const at = values.length > 1 ? `${f}/${key}[${where}]` : `${f}/${key}`;
          if (/<\s*\/?\s*[a-z]/i.test(value)) problems.push([at, "value contains markup"]);
          if (value.includes("—")) problems.push([at, "value contains an em dash"]);
          // AN HTML ENTITY IN A VALUE IS ALWAYS WRONG, whichever accessor reads it.
          // th() escapes the ampersand, so "&mdash;" renders as the literal seven
          // characters; t() writes it into a text node, where it also renders
          // literally. Either way the user sees the entity. It also hides em
          // dashes from the rule above, which is how one shipped through R3:
          // "Verification overdue &mdash; reconnect to keep access."
          if (/&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;|&#x[0-9a-fA-F]+;/.test(value)) {
            problems.push([at, "value contains an HTML entity; store the character itself"]);
          }
        }
        if (!/"description":/.test(body)) problems.push([`${f}/${key}`, "missing description"]);
      }
    }
  }

  // E7: TAG_PALETTE is an ENUMERATION and tagColorName() resolves each hex
  // through TAG_COLOR_KEYS to a message. A ninth colour added to the palette
  // without a map entry or a message falls back to the HEX CODE, which is the
  // exact defect R4 fixed - "Color #4A90E2" read aloud to a screen reader.
  //
  // Both ends are DERIVED, from storage.js and newtab.js, never restated here:
  // a check that carries its own copy of the list goes stale against the list
  // it is checking. (My audit called this palette a set of slugs; it is hex,
  // and only driving the real swatch said so. Deriving both ends is what stops
  // the next such assumption from surviving.)
  {
    const sSrc = fs.readFileSync(path.join(repoRoot, "storage.js"), "utf8");
    const nSrc = fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8");
    const en = fs.readFileSync(path.join(repoRoot, "locales", "en.js"), "utf8");
    const m = /var TAG_PALETTE = \[([\s\S]*?)\]/.exec(sSrc);
    const mapM = /var TAG_COLOR_KEYS = \{([\s\S]*?)\}/.exec(nSrc);
    if (!m) problems.push(["storage.js", "TAG_PALETTE not found - the E7 colour-key check cannot run"]);
    else if (!mapM) problems.push(["newtab.js", "TAG_COLOR_KEYS not found - the E7 colour-key check cannot run"]);
    else {
      const hexes = [...m[1].matchAll(/"(#[0-9A-Fa-f]{3,8})"/g)].map((x) => x[1].toUpperCase());
      const map = Object.fromEntries([...mapM[1].matchAll(/"(#[0-9A-Fa-f]{3,8})"\s*:\s*"([a-z0-9_]+)"/g)]
        .map((x) => [x[1].toUpperCase(), x[2]]));
      if (!hexes.length) problems.push(["storage.js", "TAG_PALETTE parsed empty"]);
      for (const hex of hexes) {
        const key = map[hex];
        if (!key) { problems.push(["newtab.js", `TAG_PALETTE has ${hex} but TAG_COLOR_KEYS does not map it`]); continue; }
        if (!new RegExp(`"${key}"\\s*:`).test(en)) {
          problems.push(["locales/en.js", `TAG_COLOR_KEYS maps ${hex} to "${key}", which has no message`]);
        }
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
// The attribute group is LAZY so the trailing slash of a self-closing tag lands
// in group 4 where the container walk looks for it. Greedy, `[^>"']` swallowed
// the `/` and group 4 was ALWAYS empty, so no tag ever registered as
// self-closing. That is why `<button><svg><path data-i18n="k"/></svg>Delete</button>`
// scored compliant: the walk stopped at the <path> instead of stepping over it
// to the button, and the marker it found was the misplaced one. The gate was
// agreeing with the bug because it was reading the same wrong element.
const TAG_RE = /<(\/?)([a-zA-Z][-\w]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

// An element that CANNOT RENDER A TEXT CHILD must never carry data-i18n.
// i18n-dom's setText() looks for a child text node and, finding none, appends
// one - so the value is injected into a <path>, where SVG draws nothing, while
// the control's own label is never touched. Nothing throws and nothing looks
// wrong; the label simply stays English forever.
const SVG_TEXT_OK = new Set(["text", "tspan", "textpath", "title", "desc"]);
const SVG_EL = new Set(["svg", "path", "polyline", "polygon", "line", "circle", "ellipse",
                        "rect", "g", "defs", "use", "mask", "clippath", "lineargradient",
                        "radialgradient", "stop", "filter", "marker", "symbol", "pattern"]);
const ATTR_SINK = { title: "data-i18n-title", placeholder: "data-i18n-placeholder",
                    alt: "data-i18n-alt", "aria-label": "data-i18n-aria-label" };

// Every data-i18n on an element that cannot render a text child. Returns
// DEFECTS, not backlog: the string was already migrated, the marker is simply
// pointing at the wrong element, so nothing is waiting on a future round.
//
// The reported text is the element's OWN direct child text - never an
// ancestor's. Asking an ancestor is what made this invisible in the first
// place: the injected value shows up in the button's textContent, so a check
// that reads textContent sees the translation and calls it fixed. Reading the
// node's own children is what turned "0 of 12 broken" into "12 of 12".
function scanMisplacedMarkers(src, file) {
  const bad = [];
  let svgDepth = 0;
  for (const m of src.matchAll(TAG_RE)) {
    const name = m[2].toLowerCase();
    const closing = !!m[1], selfClosing = !!m[4];
    if (name === "svg") {
      if (closing) svgDepth = Math.max(0, svgDepth - 1);
      else if (!selfClosing) svgDepth++;
    }
    if (closing) continue;
    if (!/\sdata-i18n\s*=/.test(m[3])) continue;
    const key = (/\sdata-i18n\s*=\s*"([^"]*)"/.exec(m[3]) || [, "?"])[1];
    const inSvg = svgDepth > 0 || SVG_EL.has(name);
    const cannotHoldText =
      VOID_EL.has(name) || (inSvg && SVG_EL.has(name) && !SVG_TEXT_OK.has(name));
    if (!cannotHoldText) continue;
    // The element's OWN text, read directly rather than through a parent.
    const after = src.slice(m.index + m[0].length);
    const own = selfClosing ? "" : (after.split("<")[0] || "").replace(/\s+/g, " ").trim();
    bad.push({ file, line: src.slice(0, m.index).split("\n").length,
               tag: name, key, ownText: own });
  }
  return bad;
}

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

const misplacedMarkers = [];
for (const f of HTML_FILES.filter(isLocalized)) {
  const p = path.join(repoRoot, f);
  if (!fs.existsSync(p)) continue;
  let src = fs.readFileSync(p, "utf8")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "<script></script>")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "<style></style>")
    .replace(/<!--[\s\S]*?-->/g, "");
  sites = sites.concat(scanHtml(src, f));
  misplacedMarkers.push(...scanMisplacedMarkers(src, f));
}

// --- self-test
const selfMissed = [];
for (const p of PATTERNS) {
  p.re.lastIndex = 0;
  if (!p.re.test(FIXTURE)) selfMissed.push(p.id);
}
// The concat scanner is not a regex, so the PATTERNS self-test above cannot
// exercise it. This is its equivalent, and it runs in BOTH directions.
for (const fx of CONCAT_FIXTURE_SEEN) {
  if (scanConcatProse(fx, "<fixture>").length === 0) {
    selfMissed.push("concat-text (blind to the shape it exists for: " +
      fx.split("\n")[0].slice(0, 46) + "...)");
  }
}
const coverage = runCoverage();
for (const row of coverage) {
  // A shape the gate is supposed to SEE going blind is the gate breaking. The
  // reverse - a `blind` row starting to be seen - is an improvement, reported
  // in the coverage block rather than failed here.
  if (row.expect === "seen" && !row.seen) selfMissed.push("coverage: blind to " + row.name);
}
for (const fx of CONCAT_FIXTURE_QUIET) {
  const got = scanConcatProse(fx, "<fixture>");
  if (got.length !== 0) {
    selfMissed.push("concat-text (false positive on " +
      fx.split("\n")[0].slice(0, 40) + "... -> " + JSON.stringify(got[0].text) + ")");
  }
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
for (const p of PATTERNS.map((x) => x.id).concat(["concat-text"])) {
  const b = byPattern[p] || { total: 0, violation: 0, compliant: 0 };
  console.log("  " + p.padEnd(14) + String(b.total).padStart(6) +
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
console.log("");
console.log("  WHAT THIS GATE CAN AND CANNOT SEE (probed on this run, not asserted)");
for (const row of coverage) {
  const drift = row.expect === "blind" && row.seen ? "   <-- now SEEN; update expect" : "";
  console.log("    " + (row.seen ? "sees " : "BLIND") + "  " + row.name + drift);
}
console.log("");
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
// A MARKER ON AN ELEMENT THAT CANNOT HOLD TEXT FAILS UNCONDITIONALLY, by the
// same rule as sink misuse: the finding is a DEFECT in already-converted markup,
// not a backlog item waiting for a round. Twelve of these shipped in R2 and both
// of the checks that should have caught them structurally could not - the
// byte-identical pass proved the rendering did not CHANGE, and a no-op changes
// nothing, so a no-op passed it.
if (misplacedMarkers.length) {
  console.log("\nI18N SITE GATE: FAIL — " + misplacedMarkers.length +
              " data-i18n marker(s) on an element that cannot render text.");
  for (const b of misplacedMarkers.slice(0, 20)) {
    console.log(`  ${b.file}:${b.line}  <${b.tag} data-i18n="${b.key}">` +
                `  own text = ${JSON.stringify(b.ownText)}`);
  }
  console.log("  The value is appended INSIDE this element, where it never renders,");
  console.log("  and the control's own label stays in the source language.");
  process.exit(1);
}

// AN EM DASH IN A USER-FACING STRING IS A DEFECT ([1.5.0] R4 stage 3).
//
// It was already banned in catalogue VALUES. That rule could only ever see
// strings which had already migrated, so the ban held on 586 messages while 28
// em dashes sat in the source waiting to migrate into it - and one had already
// slipped through as the literal "&mdash;". The rule now applies where the
// copy is WRITTEN rather than where it lands.
//
// TWO EXEMPTIONS, both deliberate:
//   1. A literal whose entire TEXT is dashes. The dash is used as a separator
//      between two values ("task name - workspace name") and as a stand-in for
//      "no value" in a stat tile. Those are typography, not prose, and Samson
//      kept them. Tags are stripped first, so `<span>-</span>` is exempt too.
//   2. A console.* argument. Never seen by a user, and the ledger's own prose
//      uses the dash throughout.
// Comments are skipped entirely: this codebase carries far more English in
// comments than in UI strings, and every one of them would score.
function emDashViolations() {
  const EM = "—";
  const out = [];
  const scan = (src, file) => {
    const lines = src.split("\n");
    let i = 0, line = 1;
    while (i < src.length) {
      const c = src[i];
      if (c === "\n") { line++; i++; continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") {
        i += 2;
        while (i + 1 < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
        i += 2; continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        const q = c, start = line;
        let buf = "";
        i++;
        while (i < src.length) {
          if (src[i] === "\\") { buf += src.slice(i, i + 2); i += 2; continue; }
          if (src[i] === q) { i++; break; }
          if (src[i] === "\n") line++;
          buf += src[i]; i++;
        }
        if (buf.includes(EM) || buf.includes("&mdash;")) {
          // a literal spanning lines is the scanner losing its place on a regex
          // containing a quote, not a real string in this codebase
          if (buf.includes("\n")) continue;
          const text = buf.replace(/<[^>]*>/g, "").replace(/\s/g, "");
          if (text && [...text].every((ch) => ch === EM)) continue;      // exemption 1
          const ctx = lines[start - 1] || "";
          if (/console\.(log|warn|error|debug|info)\s*\(/.test(ctx)) continue;  // exemption 2
          out.push({ file, line: start, text: buf.slice(0, 90) });
        }
        continue;
      }
      i++;
    }
  };
  for (const f of JS_FILES.concat(["i18n.js", "i18n-dom.js", "locales/en.js"])) {
    const p = path.join(repoRoot, f);
    if (fs.existsSync(p)) scan(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"), f);
  }
  for (const f of HTML_FILES.filter(isLocalized)) {
    const p = path.join(repoRoot, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "");
    src.split("\n").forEach((l, n) => {
      if (!l.includes(EM) && !l.includes("&mdash;")) return;
      const text = l.replace(/<[^>]*>/g, "").replace(/\s/g, "");
      if (text && [...text].every((ch) => ch === EM)) return;
      out.push({ file: f, line: n + 1, text: l.trim().slice(0, 90) });
    });
  }
  return out;
}
{
  const dashes = emDashViolations();
  if (dashes.length) {
    console.log("\nI18N SITE GATE: FAIL — " + dashes.length + " em dash(es) in user-facing copy.");
    for (const d of dashes.slice(0, 20)) console.log(`  ${d.file}:${d.line}  ${d.text}`);
    console.log("  Rewrite the sentence. A dash used purely as a separator or as a");
    console.log("  no-value glyph is exempt; prose is not.");
    process.exit(1);
  }
}

// AN ACCESSOR CALL AT MODULE LEVEL IS A DEFECT, and an invisible one.
//
// newtab.js is a single IIFE, so `var X = [ { label: t("k") } ]` at its top
// level runs ONCE when the file loads. English resolves correctly, so every
// static check and every screenshot agrees it works - and the value is FROZEN.
// A locale switch re-renders the page and the string does not change, because
// the array still holds what was built at load. R3 left 39 of these and only
// the pseudo-locale probe could see them.
//
// Unconditional, per the defect-versus-backlog rule: the string IS migrated,
// nothing is waiting on a future round, and it is wrong the moment it is
// written. Depth is counted with strings and comments skipped; the IIFE itself
// is the outermost function, so top level is a function depth of one.
function frozenAccessorLines(src) {
  const CALL = /(?<![.\w])(t|th)\(\s*["'][a-z0-9_]+["']/y;
  let depth = 0, i = 0, line = 1;
  const fnDepth = [], out = [];
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i + 1 < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
      i += 2; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === q) { i++; break; }
        if (src[i] === "\n") line++;
        i++;
      }
      continue;
    }
    if (c === "{") {
      const back = src.slice(Math.max(0, i - 260), i);
      if (/\bfunction\b[^{};]*\)\s*$/.test(back) || /=>\s*$/.test(back)) fnDepth.push(depth + 1);
      depth++; i++; continue;
    }
    if (c === "}") {
      if (fnDepth.length && fnDepth[fnDepth.length - 1] === depth) fnDepth.pop();
      depth--; i++; continue;
    }
    CALL.lastIndex = i;
    const m = CALL.exec(src);
    if (m) {
      if (fnDepth.length <= 1) out.push({ line, text: src.slice(i, i + 60).split("\n")[0] });
      i += m[0].length; continue;
    }
    i++;
  }
  return out;
}
{
  const frozen = frozenAccessorLines(fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8"));
  if (frozen.length) {
    console.log("\nI18N SITE GATE: FAIL — " + frozen.length +
                " accessor call(s) at MODULE LEVEL, frozen at load.");
    for (const f of frozen.slice(0, 20)) console.log(`  newtab.js:${f.line}  ${f.text}`);
    console.log("  Store the KEY in the literal and resolve it in the renderer,");
    console.log("  or the string never follows a locale change.");
    process.exit(1);
  }
}

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
