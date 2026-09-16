// =============================================================================
// SOURCE GATE - every <script src> and <link href> in shipped markup is in the
// build allowlist, and every allowlisted file is accounted for.
//
// THREE DATA POINTS, NOT A HYPOTHESIS. This class of defect has reached a
// packaged build three times:
//
//   importers.js (5c585ae)  newtab.html referenced it, build.sh did not list it.
//                           The zip would have shipped a dead <script src> with
//                           every import path broken, in a release whose notes
//                           lead with imports.
//   quickadd.js  (3c03f0b)  Identical shape, one round later. TD.1 added the
//                           parser; nothing added it here; TD.2's build caught it.
//   the parser   (d5dd9e3)  verify-package's own allowlist reader could be edited
//                           by PROSE - an apostrophe in a comment paired with
//                           another and the text between became an "entry".
//
// All three reached a build nobody was required to run. THAT is the gap this
// closes: the working tree always works, because the file is there; only a
// packaged build reads the allowlist, and packaging happened roughly once per
// release. A gate that runs on every build - and on demand in a second, with no
// browser and no zip - moves the discovery from release day to the commit.
//
// WHAT IT ASKS, in both directions:
//   1. Every local src/href in shipped HTML resolves to an allowlisted file.
//      Failure names the FILE and the HTML that referenced it.
//   2. Every allowlisted file is explained by something: shipped markup, the
//      manifest, or the documented set. An unexplained file is a silent one,
//      and a silent file is how a stale asset ships forever.
//
// WHAT IT CANNOT SEE, stated so nobody assumes otherwise:
//   - importScripts() IN THE SERVICE WORKER. background.js pulls i18n.js,
//     locales/en.js, storage.js, pro-access.js, license.js and tracking.js at
//     runtime, and none of that is markup. verify-package reads those as part of
//     its source A; this gate does not, deliberately, because its subject is
//     MARKUP and widening it would blur what a failure here means.
//   - DYNAMICALLY CREATED SCRIPT TAGS. A document.createElement("script") with a
//     computed src is invisible to any static reader, here and everywhere.
//   - PATHS BUILT IN JS. assets/placeholder.svg and the three chimes are reached
//     by string construction; they live in the documented set for that reason.
//   - A PAGE LOSING A SCRIPT IT NEEDS while another page still references it.
//     locales/en.js is referenced by three pages; deleting its tag from one
//     leaves this gate green. That is a limit of absence-checking, inherited from
//     verify-package's own Q17 note, and closing it needs a per-page required-
//     script assertion, which is a different check.
//
// SO THIS DOES NOT REPLACE verify-package.mjs, AND MUST NOT BE READ AS DOING SO.
// That gate is the RELEASE BACKSTOP: it compares three independent sources -
// what is referenced, what is allowed, and what the zip ACTUALLY CONTAINS, read
// from the raw central directory - and only it can see a file that failed to
// make it into the archive, or an entry written with a backslash separator. This
// one never opens a zip. It answers a source question early; that one answers an
// artifact question last. Both.
//
// ONE READER, NOT A THIRD. The allowlist parse and the HTML extractor come from
// ./lib/package-sources.mjs, which is where verify-package keeps them too. A
// copy here would be a second implementation of a parse whose entire job is to
// agree with the build - and d5dd9e3 is the standing example of what a quietly
// wrong one costs.
//
// Usage: node tools/check-html-refs.mjs [repoRoot]
//        node tools/check-html-refs.mjs --self-test
// Exit 0 = PASS, 1 = a violation, 2 = THE GATE ITSELF IS BROKEN (allowlist
// unreadable, fixtures failed, or a source came back implausibly small). 2 is
// deliberately distinct from 1: a broken gate is not a clean tree.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import {
  localRefs,
  extractRefs,
  isLocal,
  norm,
  readAllowlist,
  expandAllowlist,
  enumerateManifest,
  EXPECTED_UNREFERENCED,
  runParserSelfTest
} from "./lib/package-sources.mjs";

// FLOORS. A source that comes back implausibly small is the vacuity failure this
// whole family of gates exists to refuse: a parser that silently stops matching
// reports a clean tree. These are deliberately well under today's real numbers
// (31 allowlist entries, 5 pages, 20 referenced files) so ordinary growth never
// trips them, and a parse returning almost nothing always does.
const FLOOR_ENTRIES = 20;
const FLOOR_PAGES = 3;
const FLOOR_REFS = 10;

const argv = process.argv.slice(2);
const selfTestOnly = argv.includes("--self-test");
const repoRoot = argv.filter((a) => !a.startsWith("--"))[0] || process.cwd();

// --- the shared fixtures run first, always -----------------------------------
// Not under a flag. The extractor and the allowlist parser are this gate's only
// eyes, and a gate that cannot see reports a clean tree.
const fixtures = runParserSelfTest();
const fixtureFails = fixtures.filter((r) => !r.ok);
console.log("\nHTML REFS GATE - shared parser self-test");
console.log(`  ${fixtures.length - fixtureFails.length}/${fixtures.length} fixture(s) passed` +
  " (the same set verify-package runs; they are the same parsers)");
for (const r of fixtureFails) {
  console.log(`  FAIL  ${r.name}\n          want ${JSON.stringify(r.want)}\n          got  ${JSON.stringify(r.got)}`);
}
if (fixtureFails.length) {
  console.error(`\nHTML REFS GATE: BROKEN - ${fixtureFails.length} fixture(s) failed. ` +
    `The readers are wrong, so every answer below would be untrustworthy.\n`);
  process.exit(2);
}
if (selfTestOnly) {
  console.log(`\nself-test only: ${fixtures.length} fixtures passed.\n`);
  process.exit(0);
}

// --- SOURCE: the allowlist ----------------------------------------------------
const allow = readAllowlist(path.join(repoRoot, "build.sh"));
if (!allow.ok) {
  console.error(`\nHTML REFS GATE: BROKEN - ${allow.why}\n`);
  process.exit(2);
}
const { files: allowedFiles, missing: allowMissing } = expandAllowlist(allow.entries, repoRoot);
const ALLOWED = new Set(allowedFiles);

if (allow.entries.length < FLOOR_ENTRIES) {
  console.error(`\nHTML REFS GATE: BROKEN - the allowlist parsed to only ${allow.entries.length} ` +
    `entries (floor ${FLOOR_ENTRIES}). A parse this small is a broken reader, not a small build.\n`);
  process.exit(2);
}

// --- SOURCE: shipped markup ---------------------------------------------------
// Every HTML file the allowlist ships, whether or not anything references the
// PAGE. gate.html and offscreen.html are reached only at runtime; their CONTENTS
// are still shipped markup and their references still have to resolve.
const pages = allowedFiles.filter((p) => /\.html?$/i.test(p)).sort();
if (pages.length < FLOOR_PAGES) {
  console.error(`\nHTML REFS GATE: BROKEN - only ${pages.length} shipped HTML page(s) found ` +
    `(floor ${FLOOR_PAGES}).\n`);
  process.exit(2);
}

// ref -> the pages that reference it. The MAP is the point: a failure has to be
// able to name the HTML, not just the missing file.
const referencedBy = new Map();
const perPage = new Map();
for (const page of pages) {
  const html = fs.readFileSync(path.join(repoRoot, page), "utf8");
  const refs = extractRefs(html).filter((r) => isLocal(r.value));
  perPage.set(page, refs);
  for (const r of refs) {
    const v = norm(r.value);
    if (!referencedBy.has(v)) referencedBy.set(v, []);
    referencedBy.get(v).push({ page, tag: r.tag, attr: r.attr, raw: r.value });
  }
}
if (referencedBy.size < FLOOR_REFS) {
  console.error(`\nHTML REFS GATE: BROKEN - only ${referencedBy.size} local reference(s) found ` +
    `across ${pages.length} page(s) (floor ${FLOOR_REFS}). The extractor has stopped seeing.\n`);
  process.exit(2);
}

// --- SOURCE: the manifest -----------------------------------------------------
// Read, not hand-listed. background.js, newtab.html, companion.html and the
// icons are all declared there, and a file the manifest names is explained -
// there is nothing for a human to keep in sync.
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifest.json"), "utf8"));
const { refs: manifestRefs } = enumerateManifest(manifest);
const manifestExplains = new Map();
manifestRefs.forEach((r) => manifestExplains.set(r.p, r.field));
manifestExplains.set("manifest.json", "(the manifest itself)");

const documented = new Map();
EXPECTED_UNREFERENCED.forEach((e) => documented.set(e.p, e.reason));

// --- DIRECTION 1: referenced but not allowlisted ------------------------------
// The importers.js / quickadd.js shape, and the reason this gate exists.
const dangling = [];
for (const [ref, sites] of referencedBy) {
  if (!ALLOWED.has(ref)) dangling.push({ ref, sites });
}

// --- DIRECTION 2: allowlisted but unexplained ---------------------------------
const unexplained = [];
for (const f of allowedFiles) {
  if (referencedBy.has(f)) continue;
  if (manifestExplains.has(f)) continue;
  if (documented.has(f)) continue;
  unexplained.push(f);
}

// --- report -------------------------------------------------------------------
console.log(`\nHTML REFS GATE - ${path.basename(path.resolve(repoRoot))}`);
console.log(`  allowlist entries   ${String(allow.entries.length).padStart(3)}  (${allowedFiles.length} file(s) after expanding directories)`);
console.log(`  shipped HTML pages  ${String(pages.length).padStart(3)}  ${pages.join(", ")}`);
console.log(`  local references    ${String(referencedBy.size).padStart(3)}  distinct path(s)`);

for (const page of pages) {
  const refs = perPage.get(page);
  console.log(`\n  ${page}  (${refs.length} local reference(s))`);
  for (const r of refs) {
    const v = norm(r.value);
    console.log(`    ${ALLOWED.has(v) ? "ok  " : "MISS"}  <${r.tag} ${r.attr}="${r.value}">`);
  }
}

const accountedManifest = allowedFiles.filter((f) => !referencedBy.has(f) && manifestExplains.has(f));
const accountedDocumented = allowedFiles.filter((f) => !referencedBy.has(f) && !manifestExplains.has(f) && documented.has(f));
console.log(`\n  UNREFERENCED BY MARKUP, and how each is accounted for:`);
console.log(`    ${accountedManifest.length} by the MANIFEST (read, not listed):`);
accountedManifest.forEach((f) => console.log(`      ${f}  <- ${manifestExplains.get(f)}`));
console.log(`    ${accountedDocumented.length} by the DOCUMENTED SET (shared with verify-package):`);
accountedDocumented.forEach((f) => console.log(`      ${f}`));

if (allowMissing.length) {
  console.log(`\n  allowlist entries absent from the repo (build.sh throws first):`);
  allowMissing.forEach((e) => console.log(`    ${e}`));
}

let failed = false;

if (dangling.length) {
  failed = true;
  console.log(`\n  VIOLATION - ${dangling.length} referenced path(s) are NOT in build.sh's allowlist.`);
  console.log(`  The working tree will behave perfectly and the PACKAGED BUILD will ship a dead reference.`);
  for (const d of dangling) {
    console.log(`\n    ${d.ref}`);
    for (const s of d.sites) {
      console.log(`      referenced by ${s.page}  as  <${s.tag} ${s.attr}="${s.raw}">`);
    }
    console.log(`      FIX: add '${d.ref}' to the $allow array in build.sh`);
  }
}

if (unexplained.length) {
  failed = true;
  console.log(`\n  VIOLATION - ${unexplained.length} allowlisted file(s) are referenced by nothing and`);
  console.log(`  explained by nothing. Each ships to every user for a reason nobody has written down.`);
  for (const f of unexplained) {
    console.log(`\n    ${f}`);
    console.log(`      Not referenced by any shipped HTML, not declared in manifest.json,`);
    console.log(`      and not in EXPECTED_UNREFERENCED in tools/lib/package-sources.mjs.`);
    console.log(`      FIX: reference it, declare it, document it there with a REASON, or stop shipping it.`);
  }
}

if (failed) {
  console.error(`\nHTML REFS GATE: FAIL\n`);
  process.exit(1);
}

console.log(`\nHTML REFS GATE: PASS - ${referencedBy.size} referenced path(s) all allowlisted; ` +
  `${accountedManifest.length + accountedDocumented.length} unreferenced file(s) all accounted for.\n`);
