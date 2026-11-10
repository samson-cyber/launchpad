#!/usr/bin/env node
// ===========================================================================
// [1.17.0] WP - THE WELCOME TAB: opened on a fresh install and nowhere else,
// shipped, catalogued, offline, storage-free, and pointing at the right button.
//
// WHY THIS EXISTS. onInstalled cannot be driven end to end: under
// --load-extension the browser fires reason "install" on EVERY launch (BUGS I8),
// so no harness can show an update leaving the tab closed. The runtime check
// (invoking the listener's work with reason "update" against the service worker)
// is one round's evidence. This is the standing one. A refactor that hoists the
// tabs.create out of its reason check would open the welcome tab on every
// browser update for every existing user, and nothing else in the build would
// notice.
//
// WHAT IT HOLDS (against the real files, CRLF-normalised per M4/M7):
//   W1  background.js opens welcome.html exactly once, inside the onInstalled
//       listener, in a block whose condition is details.reason === "install",
//       as an active tab. Never in onStartup, never anywhere else.
//   W2  welcome.html, welcome.js and welcome.css are in build.sh's allowlist,
//       and the screenshot the page references exists under assets/.
//   W3  every data-i18n key welcome.html uses has a message, and every
//       welcome_* message is used by the page (no orphan strings).
//   W4  no U+2014 (em dash) in any welcome file or welcome_* message.
//   W5  ZERO NETWORK: no http(s) or protocol-relative URL, @import, fetch,
//       XMLHttpRequest, sendBeacon or WebSocket in any welcome file.
//   W6  NO STORAGE: welcome.js touches no chrome.storage and welcome.html
//       loads exactly i18n.js, locales/en.js, i18n-dom.js and welcome.js. The
//       page is not a new tab, and every first-run counter is keyed on new-tab
//       opens.
//   W7  welcome.js never closes a tab (D3): no window.close, no tabs.remove.
//   W8  the Keep it ring sits on Keep it's measured box in the screenshot, and
//       its 3px spread stays clear of Change it back.
//   W9  the capture folder assets/welcome/_incoming is not in the tree. It is
//       a full-window screenshot of a real profile and must never ship.
//
// Exit codes: 0 pass, 1 failures, 2 a subject did not load. `--mutate` re-runs
// the checks against seeded reversions held in memory, each of which must turn
// them red. `--boot-check` is what check-mutation-boot runs.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAllowlistText } from "./lib/package-sources.mjs";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

// The screenshot's pixel geometry, measured on the cropped image (450x168):
// Keep it x 355-428 y 109-146, Change it back x 227-346. RING_SPREAD is the
// ring's box-shadow spread in welcome.css.
const IMG_W = 450, IMG_H = 168;
const KEEP = { x0: 355, x1: 429, y0: 109, y1: 147 };
const CHANGE_X1 = 347;
const RING_SPREAD = 3;

function loadSources() {
  return {
    bg: read("background.js"),
    sh: read("build.sh"),
    en: read("locales/en.js"),
    html: read("welcome.html"),
    js: read("welcome.js"),
    css: read("welcome.css"),
    incomingExists: fs.existsSync(path.join(repoRoot, "assets", "welcome", "_incoming")),
  };
}

function stripJsComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
}

// The body of `chrome.runtime.on<Event>.addListener(function (...) {` by brace
// depth. Comments are stripped first so a brace in prose cannot end it.
function listenerBody(src, event) {
  const s = stripJsComments(src);
  const m = new RegExp("chrome\\.runtime\\." + event + "\\.addListener\\(function\\s*\\([^)]*\\)\\s*\\{").exec(s);
  if (!m) return null;
  let depth = 1, i = m.index + m[0].length;
  const start = i;
  for (; i < s.length && depth; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") depth--;
  }
  return depth === 0 ? s.slice(start, i - 1) : null;
}

// The condition of the innermost block enclosing `at`.
function enclosingCondition(body, at) {
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    if (body[i] === "}") depth++;
    else if (body[i] === "{") {
      if (depth === 0) {
        const before = body.slice(Math.max(0, i - 200), i);
        const m = /if\s*\(([^{}]*)\)\s*$/.exec(before);
        return m ? m[1].replace(/\s+/g, " ").trim() : "(not an if block)";
      }
      depth--;
    }
  }
  return null;   // at the listener's top level
}

function messages(en) {
  const out = {};
  for (const m of en.matchAll(/^\s*"([a-z0-9_]+)"\s*:\s*\{([\s\S]*?)\n\s*\},?\s*$/gm)) {
    const msg = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(m[2]);
    if (msg) out[m[1]] = JSON.parse('"' + msg[1] + '"');
  }
  return out;
}

function pct(css, sel, prop) {
  const block = new RegExp(sel.replace(".", "\\.") + "\\s*\\{([^}]*)\\}").exec(css);
  if (!block) return null;
  const m = new RegExp("(?:^|[;\\s])" + prop + "\\s*:\\s*([0-9.]+)%").exec(block[1]);
  return m ? parseFloat(m[1]) : null;
}

function runChecks(S) {
  const rows = [];
  const ok = (name, pass, detail) => rows.push({ name, pass: !!pass, detail: detail || "" });

  // W1 ------------------------------------------------------------------
  const bgCode = stripJsComments(S.bg);
  const opens = (bgCode.match(/welcome\.html/g) || []).length;
  ok("W1 background.js names welcome.html exactly once", opens === 1, `found ${opens}`);
  const inst = listenerBody(S.bg, "onInstalled");
  ok("W1 the onInstalled listener was found", inst !== null);
  const startup = listenerBody(S.bg, "onStartup");
  ok("W1 onStartup does not open the welcome tab", startup !== null && !/welcome\.html/.test(startup));
  if (inst) {
    const at = inst.search(/chrome\.tabs\.create\(\s*\{\s*url:\s*chrome\.runtime\.getURL\("welcome\.html"\)/);
    ok("W1 onInstalled opens welcome.html with chrome.tabs.create + getURL", at >= 0);
    if (at >= 0) {
      const cond = enclosingCondition(inst, at);
      ok("W1 the open is guarded by details.reason === \"install\" and nothing else",
        cond === 'details && details.reason === "install"', `condition: ${cond}`);
      ok("W1 the welcome tab opens active", /getURL\("welcome\.html"\)\s*,\s*active:\s*true\s*\}/.test(inst.slice(at, at + 200)));
    }
  }

  // W2 ------------------------------------------------------------------
  const allow = parseAllowlistText(S.sh);
  ok("W2 build.sh's allowlist parses", allow.ok, allow.why);
  const entries = allow.ok ? allow.entries.map((e) => (typeof e === "string" ? e : e.value || e.p || String(e))) : [];
  for (const f of ["welcome.html", "welcome.js", "welcome.css", "assets"]) {
    ok(`W2 '${f}' is in the allowlist`, entries.includes(f));
  }
  const img = /<img[^>]*\ssrc="([^"]+)"/.exec(S.html);
  ok("W2 the page's screenshot is under assets/welcome/ and exists",
    img && img[1].startsWith("assets/welcome/") && fs.existsSync(path.join(repoRoot, img[1])), img ? img[1] : "no <img>");

  // W3 ------------------------------------------------------------------
  const M = messages(S.en);
  const used = [...S.html.matchAll(/data-i18n(?:-[a-z-]+)?="([a-z0-9_]+)"/g)].map((m) => m[1]);
  const missing = used.filter((k) => !(k in M));
  ok("W3 every data-i18n key on the page has a message", used.length >= 10 && !missing.length,
    `${used.length} used; missing: ${missing.join(", ") || "none"}`);
  const welcomeKeys = Object.keys(M).filter((k) => k.startsWith("welcome_"));
  const orphans = welcomeKeys.filter((k) => !used.includes(k));
  ok("W3 every welcome_* message is used by the page", welcomeKeys.length >= 10 && !orphans.length,
    `${welcomeKeys.length} keys; orphans: ${orphans.join(", ") || "none"}`);

  // W4 ------------------------------------------------------------------
  const dashFiles = ["html", "js", "css"].filter((k) => S[k].includes("\u2014"));
  const dashMsgs = welcomeKeys.filter((k) => M[k].includes("\u2014"));
  ok("W4 no em dash in welcome.html / .js / .css", !dashFiles.length, dashFiles.join(", "));
  ok("W4 no em dash in any welcome_* message", !dashMsgs.length, dashMsgs.join(", "));

  // W5 ------------------------------------------------------------------
  const NET = /https?:\/\/|(["'(=]\s*)\/\/[a-z0-9]|@import|\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i;
  for (const k of ["html", "js", "css"]) {
    const hit = NET.exec(S[k]);
    ok(`W5 welcome.${k} names no network resource`, !hit, hit ? hit[0] : "");
  }

  // W6 ------------------------------------------------------------------
  ok("W6 welcome.js touches no chrome.storage", !/chrome\.storage|\bStorage\./.test(stripJsComments(S.js)));
  const scripts = [...S.html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  ok("W6 welcome.html loads exactly i18n.js, locales/en.js, i18n-dom.js, welcome.js",
    scripts.join(",") === "i18n.js,locales/en.js,i18n-dom.js,welcome.js", scripts.join(","));
  ok("W6 welcome.html carries no inline script", !/<script(?![^>]*\ssrc=)[^>]*>/.test(S.html));

  // W7 ------------------------------------------------------------------
  ok("W7 welcome.js never closes a tab", !/window\.close|tabs\.remove|\bself\.close/.test(stripJsComments(S.js)));
  ok("W7 the primary button opens a plain new tab", /chrome\.tabs\.create\(\{\}\)/.test(S.js));

  // W8 ------------------------------------------------------------------
  const L = pct(S.css, ".wl-ring", "left"), T = pct(S.css, ".wl-ring", "top");
  const Wd = pct(S.css, ".wl-ring", "width"), Ht = pct(S.css, ".wl-ring", "height");
  ok("W8 the ring is positioned in percentages", [L, T, Wd, Ht].every((v) => typeof v === "number"), `${L} ${T} ${Wd} ${Ht}`);
  if ([L, T, Wd, Ht].every((v) => typeof v === "number")) {
    const x0 = L / 100 * IMG_W, x1 = (L + Wd) / 100 * IMG_W, y0 = T / 100 * IMG_H, y1 = (T + Ht) / 100 * IMG_H;
    const near = (a, b) => Math.abs(a - b) <= 1.5;
    ok("W8 the ring's box is Keep it's box (within 1.5px)",
      near(x0, KEEP.x0) && near(x1, KEEP.x1) && near(y0, KEEP.y0) && near(y1, KEEP.y1),
      `ring x ${x0.toFixed(1)}-${x1.toFixed(1)} y ${y0.toFixed(1)}-${y1.toFixed(1)}`);
    ok("W8 the ring's spread stays clear of Change it back", x0 - RING_SPREAD > CHANGE_X1,
      `ring outer left ${(x0 - RING_SPREAD).toFixed(1)} vs Change it back right ${CHANGE_X1}`);
  }
  ok("W8 the ring's spread is the 3px this gate assumes", /\.wl-ring\s*\{[^}]*box-shadow:\s*0 0 0 3px var\(--action\)/.test(S.css));

  // W9 ------------------------------------------------------------------
  ok("W9 assets/welcome/_incoming is not in the tree", !S.incomingExists);

  return rows;
}

let S;
try { S = loadSources(); } catch (e) { console.error("WELCOME GATE: a subject did not load - " + e.message); process.exit(2); }

if (args.includes("--boot-check")) {
  const rows = runChecks(S);
  console.log(`boot-check: ${rows.length} rows`);
  process.exit(rows.length >= 20 ? 0 : 2);
}

const rows = runChecks(S);
const failed = rows.filter((r) => !r.pass);
if (!MUTATE) {
  console.log(`\nWELCOME GATE - ${path.basename(path.resolve(repoRoot))}`);
  for (const r of rows) console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  [" + r.detail + "]" : ""}`);
  if (rows.length < 20) { console.log(`\nWELCOME GATE: BROKEN - only ${rows.length} rows (floor 20).`); process.exit(2); }
  console.log(`\nWELCOME GATE: ${failed.length ? "FAIL" : "PASS"} - ${rows.length - failed.length} passed, ${failed.length} failed.`);
  process.exit(failed.length ? 1 : 0);
}

// --mutate: each seed edits ONE subject in memory; the checks must go red.
const SEEDS = [
  ["reason widened to !== update", (s) => ({ ...s, bg: s.bg.replace('if (details && details.reason === "install") {\n    chrome.tabs.create', 'if (details && details.reason !== "update") {\n    chrome.tabs.create') })],
  ["open hoisted out of its reason check", (s) => ({ ...s, bg: s.bg.replace(/if \(details && details\.reason === "install"\) \{\n(\s*chrome\.tabs\.create\(\{ url: chrome\.runtime\.getURL\("welcome\.html"\)[\s\S]*?\);)\n  \}/, "$1") })],
  ["open copied into onStartup", (s) => ({ ...s, bg: s.bg.replace('chrome.runtime.onStartup.addListener(function () {', 'chrome.runtime.onStartup.addListener(function () {\n  chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });') })],
  ["welcome.css dropped from the allowlist", (s) => ({ ...s, sh: s.sh.replace("    'welcome.css',\n", "") })],
  ["a web font imported", (s) => ({ ...s, css: "@import url(\"https://fonts.googleapis.com/css2?family=Figtree\");\n" + s.css })],
  ["an em dash in the headline", (s) => ({ ...s, en: s.en.replace('"LaunchPad is installed. One quick thing first."', '"LaunchPad is installed \u2014 one quick thing first."') })],
  ["the page reads storage", (s) => ({ ...s, js: s.js.replace('var edge = isEdge();', 'chrome.storage.local.get("promoState");\n  var edge = isEdge();') })],
  ["the page closes itself", (s) => ({ ...s, js: s.js.replace("chrome.tabs.create({});", "chrome.tabs.create({}); window.close();") })],
  ["the ring drifts onto Change it back", (s) => ({ ...s, css: s.css.replace("left: 78.89%;", "left: 76.5%;") })],
  ["a page key with no message", (s) => ({ ...s, html: s.html.replace('data-i18n="welcome_privacy"', 'data-i18n="welcome_privacy_line"') })],
  ["storage.js loaded by the page", (s) => ({ ...s, html: s.html.replace('<script src="welcome.js"></script>', '<script src="storage.js"></script>\n  <script src="welcome.js"></script>') })],
  ["the capture folder reappears", (s) => ({ ...s, incomingExists: true })],
];
if (failed.length) { console.log("MUTATE: the clean subject is red; seeds prove nothing."); process.exit(1); }
let caught = 0;
for (const [name, seed] of SEEDS) {
  const mutated = seed(S);
  const changed = Object.keys(S).some((k) => S[k] !== mutated[k]);
  const red = changed && runChecks(mutated).some((r) => !r.pass);
  console.log(`  ${red ? "CAUGHT " : (changed ? "ESCAPED" : "NO-OP  ")}  ${name}`);
  if (red) caught++;
}
console.log(`\nWELCOME MUTATE: ${caught}/${SEEDS.length} caught.`);
process.exit(caught === SEEDS.length ? 0 : 1);
