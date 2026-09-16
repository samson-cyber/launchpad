#!/usr/bin/env node
// Release-package gate for the LaunchPad extension zip.
//
// THREE INDEPENDENT SOURCES THAT MUST AGREE. None of them is hand-typed here.
//
//   A. REFERENCED — every file the manifest names, plus every local src/href in
//      the shipped HTML pages, plus every importScripts() in the shipped JS,
//      closed transitively.
//   B. ALLOWED    — build.sh's shipping allowlist, PARSED FROM build.sh at run
//      time and expanded (its directory entries become their files).
//   C. PACKAGED   — the zip's actual central-directory entry names, raw.
//
// WHY THREE, AND WHY THE VALUE IS IN THE DISAGREEMENT RATHER THAN THE
// DERIVATION. This gate used to build its expected set from a manifest walk plus
// a hand-maintained EXTRA_ROOTS list, and it missed shipped files twice in one
// day (Asana 1217989152996164):
//
//   1. privacy-policy.html ships and is referenced by nothing, so the walk could
//      not reach it and nobody added it by hand.
//   2. locales/en.js and i18n-dom.js were absent from the table BECAUSE THEIR
//      <script src> TAGS HAD BEEN DROPPED. The table's silence was the only
//      symptom.
//
// Instance 2 is the one that constrains the design. A gate that derived its
// expectations by parsing those same script tags would have derived a SMALLER
// set, matched the zip exactly, and passed — converting a hand-maintained blind
// spot into a derived one while feeling safer. That is BUGS.md P8: when the
// producer and the checker read the same source, one defect writes the bug and
// hides it.
//
// What actually catches instance 2 is ONE DIRECTION of disagreement: a file that
// is in the shipping allowlist but referenced by nothing. locales/en.js is in the
// allowlist (it ships) and would be unreferenced (tag dropped), so the two
// sources disagree and this gate speaks. THE ALLOWLIST IS THE SOURCE THAT DOES
// NOT MOVE WHEN A SCRIPT TAG IS DELETED, and that independence is the entire
// mechanism. Do not "simplify" this gate by deriving the allowlist from the HTML,
// or by copying the allowlist into this file: either change re-couples the two
// sources and silently restores the bug.
//
// COMPARISON IS AT FILE GRANULARITY, with the allowlist's directory entries
// expanded. That is required rather than cosmetic: `locales` is a directory entry,
// so at entry granularity dropping the locales/en.js script tag leaves `locales`
// still allowed and still shipping, and instance 2 stays invisible.
//
// EXCUSED FROM NEEDING A REFERENCE IS NOT EXCUSED FROM NEEDING TO SHIP. The
// first draft of this rewrite checked zip presence for REFERENCED files only,
// which would have silently stopped verifying that gate.html, offscreen.html and
// the three chimes are in the artifact — a coverage regression inside a coverage
// tool, introduced while fixing a coverage defect, and caught by a diff re-read
// rather than by any mutant. An entry in EXPECTED_UNREFERENCED is excused from
// one question only. See mustBeInZip below, which is why that set is the union.
//
// WHAT THIS GATE CANNOT SEE, stated so nobody assumes otherwise (BUGS.md Q17).
// It detects a file that NOTHING references. It cannot detect a single page
// losing a script it individually needs while another page still references that
// file: locales/en.js is referenced by both newtab.html and gate.html, so
// deleting its tag from newtab.html alone breaks the new-tab page and leaves this
// gate green. That is a limit of absence-checking, not a bug here, and closing it
// would need a per-page required-script assertion, which is a different check.
//
// Why raw zip entry names matter (RUNWAY STEP 1 live finding, 2026-07-21):
// PowerShell 5.1's Compress-Archive wrote sub-directory entries with BACKSLASH
// separators (icons\icon16.png, byte 0x5c). That violates the ZIP spec (APPNOTE
// 4.4.17 mandates '/'), so Chrome cannot find 'icons/icon16.png' and refuses to
// install. Every tool that NORMALIZES separators hides this, so this gate parses
// the central directory itself and compares RAW bytes.
//
// Usage: node tools/verify-package.mjs <zip> [repoRoot]
//        node tools/verify-package.mjs --self-test
// Exit 0 = PASS, 1 = a disagreement (violation), 2 = THE GATE ITSELF IS BROKEN
// (allowlist unreadable, parser self-test failed, or a source came back
// implausibly small). 2 is deliberately distinct from 1: a broken gate is not a
// clean build, and it must never be read as one.

import fs from "node:fs";
import path from "node:path";

// The readers live in ./lib/package-sources.mjs so the [1.14.5] source gate can
// use the SAME ones rather than a second copy. They were MOVED, not rewritten;
// the fixtures below are unchanged and prove it.
import {
  TAG_RE,
  ATTR_RE,
  stripComments,
  stripRawTextElements,
  extractRefs,
  isLocal,
  norm,
  isGlob,
  localRefs,
  PARSER_FIXTURES,
  ALLOWLIST_FIXTURES,
  runParserSelfTest,
  readAllowlist,
  parseAllowlistText,
  expandAllowlist,
  EXPECTED_UNREFERENCED,
  FLOOR_REFERENCED,
  FLOOR_ALLOWED,
  FLOOR_PACKAGED,
  FLOOR_HTML_PAGES,
  readZipEntryNames,
  enumerateManifest,
  importScriptsRefs
} from "./lib/package-sources.mjs";

// =============================================================================
// RUN
// =============================================================================
const argv = process.argv.slice(2);
const selfTestOnly = argv.includes("--self-test");
const zipPath = argv.filter((a) => !a.startsWith("--"))[0];
const repoRoot = argv.filter((a) => !a.startsWith("--"))[1] || process.cwd();

// --- the parser self-test runs first, always ---------------------------------
const fixtureResults = runParserSelfTest();
const fixtureFails = fixtureResults.filter((r) => !r.ok);
console.log("\nPACKAGE GATE — HTML extractor self-test");
for (const r of fixtureResults) {
  console.log("  " + (r.ok ? "PASS  " : "FAIL  ") + r.name +
    (r.ok ? "" : `\n          want ${JSON.stringify(r.want)}\n          got  ${JSON.stringify(r.got)}`));
}
if (fixtureFails.length) {
  console.error(`\nPACKAGE GATE: BROKEN — ${fixtureFails.length} extractor fixture(s) failed. ` +
    `The reference parser is wrong, so every count below would be untrustworthy.\n`);
  process.exit(2);
}
if (selfTestOnly) {
  console.log(`\nself-test only: ${fixtureResults.length} fixtures passed.\n`);
  process.exit(0);
}
if (!zipPath) {
  console.error("usage: node tools/verify-package.mjs <zip> [repoRoot]  |  --self-test");
  process.exit(2);
}

// --- the expected-unreferenced list must itself be well-formed ---------------
const unreasoned = EXPECTED_UNREFERENCED.filter((e) => !e.p || typeof e.reason !== "string" || !e.reason.trim());
if (unreasoned.length) {
  console.error("\nPACKAGE GATE: BROKEN — expected-unreferenced entries with no reason:\n" +
    unreasoned.map((e) => "    " + (e.p || "(no path)")).join("\n") +
    "\n\n  Every entry must say WHY the file ships unreferenced. An entry without a\n" +
    "  reason is a silenced warning, which is the defect this list exists to avoid.\n");
  process.exit(2);
}
const EXCUSED = new Map(EXPECTED_UNREFERENCED.map((e) => [e.p, e.reason]));

// --- SOURCE B: allowlist ------------------------------------------------------
const allow = readAllowlist(path.join(repoRoot, "build.sh"));
if (!allow.ok) {
  console.error(`\nPACKAGE GATE: BROKEN — cannot read the shipping allowlist from build.sh.\n` +
    `  ${allow.why}\n\n` +
    `  STOPPING RATHER THAN FALLING BACK. A copy of the allowlist inside this gate\n` +
    `  would be a second hand-maintained table and would re-couple the two sources,\n` +
    `  which is exactly the defect this gate was rewritten to remove\n` +
    `  (Asana 1217989152996164). Fix the parse or fix build.sh.\n`);
  process.exit(2);
}
const { files: allowedFiles, missing: allowMissing } = expandAllowlist(allow.entries, repoRoot);
const ALLOWED = new Set(allowedFiles);

// --- SOURCE A: referenced -----------------------------------------------------
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifest.json"), "utf8"));
const { refs: manifestRefs, globs } = enumerateManifest(manifest);

const refSource = new Map(); // p -> human-readable origin
const REFERENCED = new Set();
const addRef = (p, why) => { if (!REFERENCED.has(p)) { REFERENCED.add(p); refSource.set(p, why); } };

addRef("manifest.json", "(the manifest itself)");
manifestRefs.forEach((r) => addRef(r.p, `manifest ${r.field}`));

// Parse every shipped HTML page, whether or not anything references the page.
// gate.html and offscreen.html are reached only at runtime; their CONTENTS are
// still shipped code and their references still have to resolve.
const shippedHtml = allowedFiles.filter((p) => /\.html?$/i.test(p)).sort();
let htmlPagesParsed = 0;
for (const page of shippedHtml) {
  const abs = path.join(repoRoot, page);
  if (!fs.existsSync(abs)) continue;
  htmlPagesParsed++;
  for (const p of localRefs(fs.readFileSync(abs, "utf8"))) addRef(p, `<${page}> src/href`);
}

// importScripts closure over shipped JS.
const queue = allowedFiles.filter((p) => /\.js$/i.test(p));
const seenJs = new Set();
while (queue.length) {
  const j = queue.shift();
  if (seenJs.has(j)) continue;
  seenJs.add(j);
  const abs = path.join(repoRoot, j);
  if (!fs.existsSync(abs)) continue;
  for (const p of importScriptsRefs(abs)) { addRef(p, `importScripts in ${j}`); if (!seenJs.has(p)) queue.push(p); }
}

// --- SOURCE C: packaged -------------------------------------------------------
const rawNames = readZipEntryNames(fs.readFileSync(zipPath));
const PACKAGED = new Set(rawNames);

// --- P13 floors ---------------------------------------------------------------
const floorBreaches = [];
if (REFERENCED.size < FLOOR_REFERENCED) floorBreaches.push(`REFERENCED=${REFERENCED.size} < floor ${FLOOR_REFERENCED}`);
if (ALLOWED.size < FLOOR_ALLOWED) floorBreaches.push(`ALLOWED=${ALLOWED.size} < floor ${FLOOR_ALLOWED}`);
if (PACKAGED.size < FLOOR_PACKAGED) floorBreaches.push(`PACKAGED=${PACKAGED.size} < floor ${FLOOR_PACKAGED}`);
if (htmlPagesParsed < FLOOR_HTML_PAGES) floorBreaches.push(`HTML pages parsed=${htmlPagesParsed} < floor ${FLOOR_HTML_PAGES}`);
if (floorBreaches.length) {
  console.error("\nPACKAGE GATE: BROKEN — a source came back implausibly small (P13):\n" +
    floorBreaches.map((b) => "    " + b).join("\n") +
    "\n\n  Small sets AGREE with each other, and agreement is what this gate reports as\n" +
    "  success. A parser that silently stopped matching must not read as a clean\n" +
    "  build. Fix the source or, if the product genuinely shrank, lower the floor\n" +
    "  deliberately and say why.\n");
  process.exit(2);
}

// --- the five directions ------------------------------------------------------
const refNotAllowed = [];
const refNotPackaged = [];
const allowedNotReferenced = [];
const packagedOrphans = [];
const staleExcuses = [];
const usedExcuses = [];

for (const p of [...REFERENCED].sort()) {
  if (!ALLOWED.has(p)) refNotAllowed.push(p);
}
// ZIP PRESENCE IS CHECKED FOR EXCUSED FILES TOO, not only referenced ones.
// gate.html, offscreen.html and the chimes are excused from needing a REFERENCE,
// but they are load-bearing at runtime and must still be in the artifact — the
// old EXTRA_ROOTS table did check them, and dropping that would trade one blind
// spot for another. Excused-but-absent is the same defect as referenced-but-
// absent, so it reports through the same direction.
const mustBeInZip = new Set(REFERENCED);
for (const e of EXPECTED_UNREFERENCED) if (ALLOWED.has(e.p)) mustBeInZip.add(e.p);
for (const p of [...mustBeInZip].sort()) {
  if (!PACKAGED.has(p)) {
    const backslashed = PACKAGED.has(p.replace(/\//g, "\\"));
    refNotPackaged.push({ p, backslashed });
  }
}
for (const p of [...ALLOWED].sort()) {
  if (REFERENCED.has(p)) {
    if (EXCUSED.has(p)) staleExcuses.push(p);
    continue;
  }
  if (EXCUSED.has(p)) { usedExcuses.push({ p, reason: EXCUSED.get(p) }); continue; }
  allowedNotReferenced.push(p);
}
for (const p of [...PACKAGED].sort()) {
  if (!ALLOWED.has(p) && !REFERENCED.has(p)) packagedOrphans.push(p);
}

// --- report -------------------------------------------------------------------
console.log(`\nPACKAGE GATE — ${path.basename(zipPath)}`);
console.log(`  three independent sources, none hand-typed in this file:`);
console.log(`    A REFERENCED  ${String(REFERENCED.size).padStart(3)}   manifest + ${htmlPagesParsed} shipped HTML page(s) + importScripts`);
console.log(`    B ALLOWED     ${String(ALLOWED.size).padStart(3)}   build.sh allowlist (${allow.entries.length} entries, directories expanded)`);
console.log(`    C PACKAGED    ${String(PACKAGED.size).padStart(3)}   raw zip central-directory entries`);
console.log(`  pages parsed: ${shippedHtml.join(", ") || "(none)"}`);

if (usedExcuses.length) {
  console.log(`\n  EXPECTED-UNREFERENCED (${usedExcuses.length} used) — ships deliberately, referenced by nothing:`);
  for (const e of usedExcuses) console.log(`    ${e.p}\n        ${e.reason}`);
}
if (globs.length) {
  console.log("\n  glob resources (pattern — not literally checked):");
  globs.forEach((g) => console.log("    " + g.p + "   (" + g.field + ")"));
}
if (allowMissing.length) {
  console.log("\n  allowlist entries absent from the repo (build.sh would throw first):");
  allowMissing.forEach((e) => console.log("    " + e));
}

let fails = 0;
const fail = (title, body) => { fails++; console.log("\n  FAIL — " + title + "\n" + body); };

if (refNotAllowed.length) {
  fail(`${refNotAllowed.length} file(s) REFERENCED but NOT in build.sh's allowlist`,
    refNotAllowed.map((p) => `    ${p}\n        referenced by ${refSource.get(p)}`).join("\n") +
    "\n    These will NOT ship. Add them to the $allow array in build.sh.");
}
if (refNotPackaged.length) {
  fail(`${refNotPackaged.length} file(s) REFERENCED but NOT in the zip`,
    refNotPackaged.map((r) => `    ${r.p}\n        referenced by ${refSource.get(r.p)}` +
      (r.backslashed
        ? "\n        PRESENT BUT BACKSLASHED — invalid per APPNOTE 4.4.17; Chrome cannot find it."
        : "")).join("\n"));
}
if (allowedNotReferenced.length) {
  fail(`${allowedNotReferenced.length} file(s) SHIP but are REFERENCED BY NOTHING`,
    allowedNotReferenced.map((p) => `    ${p}`).join("\n") +
    "\n\n    THIS IS THE DIRECTION THAT CATCHES A DELETED <script src> TAG.\n" +
    "    Before excusing any of these, check whether the reference was REMOVED by\n" +
    "    mistake — a dropped script tag looks exactly like this and breaks the\n" +
    "    extension for every user who updates, while dev keeps working because the\n" +
    "    unpacked tree still has the file on disk.\n" +
    "    If the file genuinely ships unreferenced, add it to EXPECTED_UNREFERENCED\n" +
    "    in tools/verify-package.mjs WITH A REASON. An entry with no reason fails.");
}
if (packagedOrphans.length) {
  fail(`${packagedOrphans.length} zip entr(ies) accounted for by NEITHER source`,
    packagedOrphans.map((p) => `    ${p}`).join("\n") +
    "\n    Something is shipping that neither the allowlist nor any reference explains.");
}
// STALE EXCUSE IS THE ONE WARNING, and it is a warning on purpose. P9 says a
// check whose finding is a DEFECT must fail unconditionally — but this finding is
// not a defect in the artifact. The file ships and is referenced, which is the
// healthy state; only the bookkeeping is out of date. Failing the build over
// tidy-up would teach people to edit the gate under time pressure, which is how a
// gate loses its authority. It is loud, it names the file, and it costs nothing
// to fix.
if (staleExcuses.length) {
  console.log(`\n  WARN — ${staleExcuses.length} STALE excuse(s) in EXPECTED_UNREFERENCED\n` +
    staleExcuses.map((p) => `    ${p}\n        is now referenced by ${refSource.get(p)}`).join("\n") +
    "\n    The file no longer needs excusing. Remove the entry from\n" +
    "    EXPECTED_UNREFERENCED in tools/verify-package.mjs so the list keeps\n" +
    "    meaning what it says. Not a build failure: the artifact is fine.");
}

console.log("");
if (fails === 0) {
  console.log(`PACKAGE GATE: PASS — A(${REFERENCED.size}) / B(${ALLOWED.size}) / C(${PACKAGED.size}) agree; ` +
    `${usedExcuses.length} documented exception(s); all referenced paths resolve with exact forward slashes.\n`);
  process.exit(0);
}
console.log(`PACKAGE GATE: FAIL — ${fails} disagreement(s) between the three sources. ` +
  `Chrome/CWS would reject this artifact, or it is missing code it needs.\n`);
process.exit(1);
