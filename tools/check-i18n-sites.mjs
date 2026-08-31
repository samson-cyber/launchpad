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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS_FILES = ["newtab.js", "background.js", "storage.js", "bookmarks.js",
                  "license.js", "pro-access.js", "tracking.js", "gate.js", "offscreen.js"];
const HTML_FILES = ["newtab.html", "gate.html", "offscreen.html"];

// --------------------------------------------------------------- exclusions
//
// Every entry here is a class that LOOKS like prose to a naive scan and is not.
// The list is the recon round's findings, not speculation — each one actually
// appeared and had to be removed.
const EXCLUDE = [
  { name: "css-selector",  re: /^\s*[.#\[][A-Za-z0-9_\-\[\]="'.:# >~+]*$/ },
  { name: "url",           re: /^(https?:|chrome(-extension)?:|data:|blob:|mailto:)/i },
  { name: "css-var",       re: /^var\(--/ },
  { name: "css-decl",      re: /^[a-z-]+:\s*[a-z0-9(#.]/i },
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
    out = out.slice(0, j) + " ".repeat(k - j + 1) + out.slice(k + 1);
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
  { id: "set-attr",    argGroup: 2, re: new RegExp(`setAttribute\\s*\\(\\s*["'](?:title|aria-label|placeholder|alt)["']\\s*,\\s*([^)\\n]{1,160})()`, "g") },
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
}
for (const f of HTML_FILES) {
  const p = path.join(repoRoot, f);
  if (!fs.existsSync(p)) continue;
  let src = fs.readFileSync(p, "utf8")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "<script></script>")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "<style></style>")
    .replace(/<!--[\s\S]*?-->/g, "");
  sites = sites.concat(scan(src, f));
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
const violations = sites.filter((s) => s.verdict === "violation");

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
console.log("  string literals tokenized : " + literals + "  (floor " + LITERAL_FLOOR + ")");
console.log("  construction sites found  : " + sites.length + "  (floor " + SITE_FLOOR + ")");

const catProblems = checkCatalogues();
if (catProblems.length) {
  console.log("\n  catalogue value problems:");
  for (const [k, why] of catProblems) console.log("    " + k + " — " + why);
}

// --- broken checks, which run whether or not the gate is enforcing
const broken = [];
if (selfMissed.length) broken.push("patterns that no longer match their own fixture: " + selfMissed.join(", "));
if (literals < LITERAL_FLOOR) broken.push(`only ${literals} string literals tokenized, below floor ${LITERAL_FLOOR}`);
if (sites.length < SITE_FLOOR) broken.push(`only ${sites.length} construction sites found, below floor ${SITE_FLOOR}`);

if (broken.length) {
  console.log("\nI18N SITE GATE: BROKEN — the gate itself is not measuring what it claims.");
  for (const b of broken) console.log("  ! " + b);
  process.exit(2);
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
