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

// ---------------------------------------------------------------------------
// THE HTML REFERENCE EXTRACTOR.
//
// This is the piece P8's worked example is about: a greedy regex swallowed the
// slash of self-closing tags, and because the extractor and the checker shared
// it, they agreed on the same wrong elements. So this is a small tokenizer
// rather than one clever pattern, and it is self-tested on every run (below).
//
// Three deliberate properties:
//   - comments are stripped FIRST, so tag-like text inside a comment cannot
//     contribute a reference;
//   - the attribute scanner requires `name = value`, so a trailing `/` before
//     `>` is simply unmatched text rather than being absorbed into a value;
//   - quoted values may contain `>`, which the tag pattern's alternation allows.
// ---------------------------------------------------------------------------
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR_RE = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

// The CONTENT of <script> and <style> is raw text, not markup. An inline script
// containing the string "<script src='x.js'>" must contribute nothing, and the
// extractor fixture below caught exactly that before this shipped. The OPENING
// tag is preserved, so <script src="real.js"> is still read; only the body is
// dropped. The attribute alternation matches the tag pattern's, so a quoted
// attribute containing `>` cannot end the tag early.
function stripRawTextElements(html) {
  return html.replace(
    /(<(script|style)(?:[^>"']|"[^"]*"|'[^']*')*>)[\s\S]*?(<\/\2\s*>)/gi,
    "$1$3"
  );
}

// Returns [{tag, attr, value}] for every src/href in the document.
function extractRefs(html) {
  const out = [];
  const src = stripRawTextElements(stripComments(html));
  let t;
  TAG_RE.lastIndex = 0;
  while ((t = TAG_RE.exec(src))) {
    const tag = t[1].toLowerCase();
    const attrs = t[2] || "";
    let a;
    ATTR_RE.lastIndex = 0;
    while ((a = ATTR_RE.exec(attrs))) {
      const name = a[1].toLowerCase();
      if (name !== "src" && name !== "href") continue;
      const value = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4];
      if (value !== undefined) out.push({ tag, attr: name, value });
    }
  }
  return out;
}

function isLocal(p) {
  return p && !/^(https?:|data:|blob:|chrome:|mailto:|#)/i.test(p) && !p.startsWith("//");
}
function norm(p) { return p.replace(/^\.\//, "").replace(/\\/g, "/"); }
function isGlob(p) { return /[*?]/.test(p); }

function localRefs(html) {
  return extractRefs(html).map((r) => r.value).filter(isLocal).map(norm);
}

// ---------------------------------------------------------------------------
// PARSER SELF-TEST. Runs on EVERY gate invocation, not only under a flag: a
// parser that silently stops matching is exactly the failure this gate cannot
// survive, and P13 says a check that can quietly become vacuous is not a check.
// Each case is awkward-but-legal markup that a naive regex gets wrong.
// ---------------------------------------------------------------------------
const PARSER_FIXTURES = [
  {
    name: "self-closing tag keeps its value and does not absorb the slash",
    html: '<link rel="stylesheet" href="a.css"/><img src="b.png" />',
    want: ["a.css", "b.png"]
  },
  {
    name: "attributes in unusual order, src last",
    html: '<script defer type="text/javascript" src="c.js"></script>',
    want: ["c.js"]
  },
  {
    name: "single quotes",
    html: "<script src='d.js'></script><link href='e.css' rel='stylesheet'>",
    want: ["d.js", "e.css"]
  },
  {
    name: "unquoted attribute value",
    html: "<script src=f.js></script>",
    want: ["f.js"]
  },
  {
    name: "a comment containing tag-like text contributes nothing",
    html: '<!-- <script src="ghost.js"></script> --><script src="real.js"></script>',
    want: ["real.js"]
  },
  {
    name: "script tag with no src is not a reference",
    html: '<script>var x = "<script src=\'nope.js\'>";</script><script src="yes.js"></script>',
    want: ["yes.js"]
  },
  {
    name: "quoted value containing > does not truncate the tag",
    html: '<a title="a > b" href="g.html">x</a>',
    want: ["g.html"]
  },
  {
    name: "remote and non-file schemes are excluded",
    html: '<a href="https://example.com/x.html">a</a><a href="mailto:x@y.z">b</a>' +
          '<a href="#frag">c</a><img src="data:image/png;base64,AAA">' +
          '<script src="local.js"></script>',
    want: ["local.js"]
  },
  {
    name: "uppercase tag and attribute names",
    html: '<SCRIPT SRC="H.js"></SCRIPT>',
    want: ["H.js"]
  },
  {
    name: "leading ./ is normalised",
    html: '<script src="./i.js"></script>',
    want: ["i.js"]
  }
];

function runParserSelfTest() {
  const results = [];
  for (const f of PARSER_FIXTURES) {
    const got = localRefs(f.html);
    const ok = got.length === f.want.length && got.every((g, i) => g === f.want[i]);
    results.push({ name: f.name, ok, got, want: f.want });
  }
  return results;
}

// ---------------------------------------------------------------------------
// SOURCE B — build.sh's shipping allowlist, READ FROM build.sh.
//
// The allowlist is a PowerShell array literal inside the packaging step:
//     $allow = @(
//       'manifest.json',
//       ...
//     )
// (the `$` is backslash-escaped in build.sh because the block sits inside a
// double-quoted bash string). Parsing it is the whole point: a copy of this list
// living in this file would be a SECOND hand-maintained table, which is the
// defect this gate was rewritten to remove. If this parse ever fails, the gate
// stops with exit 2 rather than falling back to a duplicate.
// ---------------------------------------------------------------------------
function readAllowlist(buildShPath) {
  if (!fs.existsSync(buildShPath)) {
    return { ok: false, why: `build.sh not found at ${buildShPath}` };
  }
  const sh = fs.readFileSync(buildShPath, "utf8");
  const block = sh.match(/\\?\$allow\s*=\s*@\(([\s\S]*?)\)/);
  if (!block) {
    return { ok: false, why: "could not locate the `$allow = @( ... )` array in build.sh" };
  }
  const entries = [];
  const re = /'([^']+)'/g;
  let m;
  while ((m = re.exec(block[1]))) entries.push(norm(m[1]));
  if (!entries.length) {
    return { ok: false, why: "found the `$allow = @( ... )` array in build.sh but it parsed to zero entries" };
  }
  return { ok: true, entries };
}

// Expand directory entries to their files, so comparison happens at file
// granularity. See the header: entry granularity cannot see instance 2.
function expandAllowlist(entries, repoRoot) {
  const files = [];
  const missing = [];
  for (const e of entries) {
    const abs = path.join(repoRoot, e);
    if (!fs.existsSync(abs)) { missing.push(e); continue; }
    if (fs.statSync(abs).isDirectory()) {
      const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          if (fs.statSync(full).isDirectory()) walk(full);
          else files.push(norm(path.relative(repoRoot, full)));
        }
      };
      walk(abs);
    } else {
      files.push(e);
    }
  }
  return { files, missing };
}

// ---------------------------------------------------------------------------
// THE EXPECTED-UNREFERENCED LIST — the residual hand-maintained surface, named
// rather than hidden.
//
// A file that ships but is referenced by nothing is normally a defect (it is how
// instance 2 announces itself). A few are legitimate. EVERY ENTRY CARRIES A
// REASON, THE GATE PRINTS THE REASON WHEN IT USES ONE, AND AN ENTRY WITH NO
// REASON IS A FAILURE. That is deliberate: adding a file here must be a decision
// someone justifies in writing, not a reflex that silences a warning.
//
// If you are here because the gate told you to add something: the question to
// answer first is "why does this ship at all?", not "how do I make this quiet?".
// ---------------------------------------------------------------------------
const EXPECTED_UNREFERENCED = [
  {
    p: "privacy-policy.html",
    reason: "Ships for the Chrome Web Store listing and is served from GitHub Pages. " +
            "Settings links the HOSTED absolute URL, so no local reference to this file " +
            "exists or should. The original miss that opened Asana 1217989152996164."
  },
  {
    p: "gate.html",
    reason: "Loaded at runtime by the focus-blocking intercept via chrome.runtime.getURL " +
            "(background.js focusHandleNavigation), which no static reference can express."
  },
  {
    p: "offscreen.html",
    reason: "Created at runtime by chrome.offscreen.createDocument for break chimes; " +
            "again a runtime URL, not a static reference."
  },
  {
    p: "sounds/chime1.wav",
    reason: "Selected at runtime by Storage.pomodoroSoundFile; the path is built from the " +
            "user's chosen sound, so no static reference names it."
  },
  {
    p: "sounds/chime2.wav",
    reason: "Selected at runtime by Storage.pomodoroSoundFile; see chime1.wav."
  },
  {
    p: "sounds/chime3.wav",
    reason: "Selected at runtime by Storage.pomodoroSoundFile; see chime1.wav."
  },
  {
    p: "_locales/en/messages.json",
    reason: "Resolved by CHROME, not by us: the manifest's __MSG_extension_name__ / " +
            "__MSG_extension_description__ placeholders are looked up against " +
            "default_locale at install time. The path is a platform convention and is " +
            "never written down anywhere, so it cannot appear as a reference."
  },
  {
    p: "package.json",
    reason: "UNJUSTIFIED SHIP, excused only to keep this round scoped. It is a six-line " +
            "metadata stub (stale \"version\": \"1.0.0\"), Chrome never reads it, and " +
            "nothing references it. It is here because build.sh's allowlist ships it and " +
            "changing the allowlist is out of scope for Asana 1217989152996164 round 1. " +
            "Revisit: either justify it or drop it from the allowlist."
  }
];

// ---------------------------------------------------------------------------
// ANTI-VACUITY FLOORS (P13).
//
// A parser that silently stops matching produces small sets that AGREE with each
// other, and agreement is what this gate reports as success. So each source must
// clear a floor, and a breach is exit 2 (gate broken), not exit 1 (violation).
//
// Floors are set near 70% of today's MEASURED counts: low enough that ordinary
// product change never trips them, high enough that a half-broken parser cannot
// slip under. Measured on the 2.1.0 tree: REFERENCED 21, ALLOWED 29 (25
// allowlist entries, six of them directories), PACKAGED 29, HTML pages 4.
// ---------------------------------------------------------------------------
const FLOOR_REFERENCED = 15;
const FLOOR_ALLOWED = 20;
const FLOOR_PACKAGED = 20;
const FLOOR_HTML_PAGES = 3;

// ---- raw zip central-directory reader (no separator normalization) ----------
function readZipEntryNames(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip (no EOCD record)");
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const CEN_SIG = 0x02014b50;
  const names = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== CEN_SIG) throw new Error("central dir header mismatch at " + off);
    const fnLen = buf.readUInt16LE(off + 28);
    const exLen = buf.readUInt16LE(off + 30);
    const cmLen = buf.readUInt16LE(off + 32);
    names.push(buf.toString("latin1", off + 46, off + 46 + fnLen)); // RAW bytes
    off += 46 + fnLen + exLen + cmLen;
  }
  return names;
}

// ---- SOURCE A helpers: the manifest's own references -------------------------
function enumerateManifest(m) {
  const refs = [];
  const globs = [];
  const add = (p, field) => { if (isLocal(p)) refs.push({ p: norm(p), field }); };

  if (m.background) {
    if (m.background.service_worker) add(m.background.service_worker, "background.service_worker");
    (m.background.scripts || []).forEach((s, i) => add(s, `background.scripts[${i}]`));
  }
  Object.entries(m.chrome_url_overrides || {}).forEach(([k, v]) => add(v, `chrome_url_overrides.${k}`));
  Object.entries(m.icons || {}).forEach(([sz, v]) => add(v, `icons.${sz}`));

  const action = m.action || m.browser_action || m.page_action;
  if (action) {
    if (typeof action.default_icon === "string") add(action.default_icon, "action.default_icon");
    else if (action.default_icon) Object.entries(action.default_icon).forEach(([sz, v]) => add(v, `action.default_icon.${sz}`));
    if (action.default_popup) add(action.default_popup, "action.default_popup");
    (action.theme_icons || []).forEach((ti, i) => {
      if (ti.light) add(ti.light, `action.theme_icons[${i}].light`);
      if (ti.dark) add(ti.dark, `action.theme_icons[${i}].dark`);
    });
  }
  (m.web_accessible_resources || []).forEach((w, i) => {
    const list = Array.isArray(w) ? w : (w && w.resources) || (typeof w === "string" ? [w] : []);
    list.forEach((r, j) => {
      if (!isLocal(r)) return;
      const field = `web_accessible_resources[${i}].resources[${j}]`;
      if (isGlob(r)) globs.push({ p: norm(r), field });
      else refs.push({ p: norm(r), field });
    });
  });
  (m.content_scripts || []).forEach((cs, i) => {
    (cs.js || []).forEach((p, j) => add(p, `content_scripts[${i}].js[${j}]`));
    (cs.css || []).forEach((p, j) => add(p, `content_scripts[${i}].css[${j}]`));
  });
  return { refs, globs };
}

function importScriptsRefs(file) {
  const js = fs.readFileSync(file, "utf8");
  const out = [];
  const re = /importScripts\s*\(\s*([^)]*)\)/g;
  let m;
  while ((m = re.exec(js))) {
    const inner = m[1];
    const sre = /['"]([^'"]+)['"]/g;
    let s;
    while ((s = sre.exec(inner))) if (isLocal(s[1])) out.push(norm(s[1]));
  }
  return out;
}

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
