#!/usr/bin/env node
// Chrome Web Store screenshot capture. Six 1280x800 frames, from the PACKAGED
// build, against a seeded fixture, reproducibly.
//
//   node tools/capture-screenshots.mjs <extension-dir> <output-dir> [chrome-path]
//
//   <extension-dir>  an UNPACKED extension directory. For a listing set this is
//                    the unpacked release artifact, never the working tree, so
//                    the frames show what actually ships:
//                      mkdir -p /tmp/pkg && cd /tmp/pkg && unzip -q ../launchpad-2.1.0-<hash>.zip
//   <output-dir>     where the PNGs are written, e.g. store-assets/2.1.0
//
//   Example, the 2.1.0 run:
//     node tools/capture-screenshots.mjs /tmp/pkg store-assets/2.1.0
//
// RE-RUN IT AT EVERY ARC CHECKPOINT. Nothing here is version-specific: the
// output folder is an argument, and the fixture describes a working day rather
// than a release. [1.6.0] and [1.8.0] should need no edit beyond the arguments.
//
// WHY IT IS BUILT THE WAY IT IS - the ledger entries this obeys:
//   I6  isolated scratch profile; --disable-extensions-except WITH
//       --load-extension; both *-extension-debugging flags, without which
//       Chrome 137+ ignores --load-extension whenever a debug port is open;
//       teardown by PID, never by image name, or it closes the real browser.
//   I7  the extension id comes from Secure Preferences by matching the load
//       path, NOT from "the first chrome-extension:// target" - the browser's
//       own force-installed extensions get there first.
//   I10 LP.devPro(true) before any Pro surface, or it renders as an empty node.
//   I11 drive real controls; writing storage from the console does not re-render
//       the tab that wrote it (the write-provenance gate).
//   I12 seed through the real creation APIs; a hand-built task does not render.
//   I19 hover-revealed controls measure a zero-size box until a real pointer is
//       over the parent, and any re-render drops the hover.
//   O4  a fresh profile has no background record and self-heals to DEFAULT_BG,
//       so every frame would come out on the bare default unless one is pinned.
//
// THE WALLPAPER IS GENERATED, NOT FETCHED. All twelve gallery images in this
// build are Unsplash URLs fetched at runtime; nothing is bundled. A listing set
// must be reproducible and license-clean, so the fixture paints its own dark
// low-detail gradient on a canvas and stores the data URL. No network, no
// licence question, identical on every run.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, execSync } from "node:child_process";

const EXT_DIR = process.argv[2];
const OUT_DIR = process.argv[3];
const CHROME = process.argv[4] || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CAPTURE_PORT || 9422);
const PROFILE = path.resolve(".capture-profile");

if (!EXT_DIR || !OUT_DIR) {
  console.error("usage: node tools/capture-screenshots.mjs <extension-dir> <output-dir> [chrome-path]");
  process.exit(2);
}
if (!fs.existsSync(path.join(EXT_DIR, "manifest.json"))) {
  console.error(`SUBJECT DID NOT LOAD - no manifest.json in ${EXT_DIR}`);
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const chk = (n, ok, x = "") => {
  ok ? pass++ : fail++;
  console.log("  " + (ok ? "PASS  " : "FAIL  ") + n + (x ? "   << " + x : ""));
};

// --------------------------------------------------------------- CDP plumbing
const j = (p, m = "GET") => new Promise((res, rej) => {
  const r = http.request({ host: "127.0.0.1", port: PORT, path: p, method: m }, (x) => {
    let b = ""; x.on("data", (d) => (b += d));
    x.on("end", () => { try { res(b ? JSON.parse(b) : null); } catch { res({ raw: b }); } });
  });
  r.on("error", rej); r.end();
});

class Sess {
  constructor(ws) {
    this.ws = ws; this.i = 0; this.p = new Map(); this.errors = [];
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) {
        const { res, rej } = this.p.get(m.id); this.p.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return;
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
        this.errors.push((m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(" "));
      if (m.method === "Runtime.exceptionThrown")
        this.errors.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    });
  }
  send(method, params = {}) {
    const id = ++this.i;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.p.set(id, { res, rej }));
  }
  async ev(expr, ms = 20000) {
    const r = await Promise.race([
      this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("EVAL TIMED OUT")), ms)),
    ]);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "threw");
    return r.result.value;
  }
}

// ------------------------------------------------------------------- teardown
// BY PID (I6). `taskkill /IM chrome.exe` would close the developer's own
// browser along with this one, which is the whole reason the rule exists.
let CHILD = null;
function teardown() {
  try {
    if (CHILD && CHILD.pid) {
      execSync(`taskkill /PID ${CHILD.pid} /T /F`, { stdio: "ignore" });
    }
  } catch { /* already gone */ }
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* best effort */ }
}
process.on("exit", teardown);
process.on("SIGINT", () => { teardown(); process.exit(130); });

// -------------------------------------------------------------------- the run
console.log(`capture-screenshots: ${EXT_DIR} -> ${OUT_DIR}`);
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

CHILD = spawn(CHROME, [
  `--user-data-dir=${PROFILE}`,
  "--no-first-run", "--no-default-browser-check", "--disable-sync",
  // Load-bearing on Chrome 137+: without these, --load-extension is ignored
  // whenever a remote-debugging port is open and the target lands on
  // chrome-error://chromewebdata with chrome.runtime undefined (I7).
  "--disable-features=DisableLoadExtensionCommandLineSwitch",
  "--enable-unsafe-extension-debugging",
  `--disable-extensions-except=${EXT_DIR}`,
  `--load-extension=${EXT_DIR}`,
  `--remote-debugging-port=${PORT}`,
  "--window-size=1400,900",
  "about:blank",
], { detached: false, stdio: "ignore" });

let up = false;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  try { await j("/json/version"); up = true; break; } catch { /* not yet */ }
}
if (!up) { console.error("Chrome never opened the debug port"); process.exit(2); }
const ver = await j("/json/version");
console.log(`  browser: ${ver.Browser}`);
await sleep(2500);

// EXTENSION ID BY MATCHING THE LOAD PATH in the profile's own records (I7).
// Never "the first chrome-extension:// target": the browser's built-ins get
// there first, and on Chrome they are the ONLY ones there (see the note below).
// Both preference files are read because Edge records a command-line extension
// in "Secure Preferences" and the plain file is where some builds put it.
let EXT_ID = null;
for (let i = 0; i < 20 && !EXT_ID; i++) {
  for (const f of ["Secure Preferences", "Preferences"]) {
    const sp = path.join(PROFILE, "Default", f);
    if (!fs.existsSync(sp)) continue;
    try {
      const prefs = JSON.parse(fs.readFileSync(sp, "utf8"));
      const settings = (prefs.extensions && prefs.extensions.settings) || {};
      const want = path.resolve(EXT_DIR).toLowerCase().replace(/\\/g, "/");
      for (const [id, v] of Object.entries(settings)) {
        const p = String(v.path || "").toLowerCase().replace(/\\/g, "/");
        if (p && (want.endsWith(p) || p.endsWith(want) || p === want)) { EXT_ID = id; break; }
      }
    } catch { /* written concurrently; retry */ }
    if (EXT_ID) break;
  }
  if (!EXT_ID) await sleep(1000);
}
if (!EXT_ID) {
  console.error("could not resolve the extension id: the browser did not load the extension.");
  console.error("");
  console.error("  CHROME 152 DOES NOT HONOUR --load-extension, measured 2026-09-01: zero entries");
  console.error("  in either preference file, with AND without a debug port, with both");
  console.error("  --disable-features=DisableLoadExtensionCommandLineSwitch and");
  console.error("  --enable-unsafe-extension-debugging set. The only chrome-extension:// targets");
  console.error("  are Chrome's own built-ins. Re-enabling it needs an enterprise policy, which is");
  console.error("  a system setting and not this script's business.");
  console.error("");
  console.error("  Pass a Chromium that still allows it as the third argument, e.g. Edge:");
  console.error("    node tools/capture-screenshots.mjs <ext> <out> \\");
  console.error("      \"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe\"");
  process.exit(2);
}
console.log(`  extension: ${EXT_ID}`);

async function openPage(url) {
  const t = await j(`/json/new?${url}`, "PUT");
  await sleep(2500);
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${t.id}`);
  await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  const s = new Sess(ws);
  await s.send("Runtime.enable"); await s.send("Page.enable");
  // Exactly 1280x800 at dsf 1. The PNG is measured after writing regardless:
  // a frame that is not exactly 1280x800 is a rejected upload.
  await s.send("Emulation.setDeviceMetricsOverride",
    { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  s.targetId = t.id;
  return s;
}

async function shoot(s, name) {
  // Anything transient that a re-render may have re-armed goes now, not after.
  // The right-click tip is dismissed through its OWN button rather than by
  // hiding the node, so the dismissal persists the way a user's would and it
  // cannot reappear on the next render (I11).
  try {
    await s.ev(`(() => {
      const b = document.getElementById('rc-tip-dismiss');
      if (b && !document.getElementById('rc-tip').classList.contains('hidden')) b.click();
      const tip = document.getElementById('rc-tip');
      if (tip) { tip.classList.add('hidden'); tip.classList.remove('tip-visible'); }
      for (const el of document.querySelectorAll('.toast, .promo-toast, #promo-toast, .tip-toast, .undo-toast, .gs-toast')) {
        el.classList.remove('visible');
      }
      return 1;
    })()`);
  } catch { /* the gate page has neither */ }
  await sleep(400);
  await sleep(900);                       // let transitions finish
  const r = await s.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  // MEASURE, never trust the emulation call: read IHDR out of the PNG itself.
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  chk(`${name} is exactly 1280x800`, w === 1280 && h === 800, `${w}x${h}, ${b.length} bytes`);
  return { file, w, h, bytes: b.length };
}

const page = await openPage(`chrome-extension://${EXT_ID}/newtab.html`);
await page.ev("1");

// ------------------------------------------------------------ seed the fixture
console.log("\n  seeding the fixture (through the product's own factories, I12/Q13)");
const seedSrc = fs.readFileSync(new URL("./capture-fixture.js", import.meta.url), "utf8");
const seeded = await page.ev(`(async () => { ${seedSrc} \n return await __seedCaptureFixture(); })()`, 90000);
console.log("  " + JSON.stringify(seeded));
chk("fixture seeded", seeded && seeded.ok === true, seeded && seeded.error);

// Promo toasts are transient and would land mid-frame; consumed through their
// own storage so they cannot reappear on a later render.
await page.ev(`(async () => { ${seedSrc} 
 return await __captureSilenceToasts(); })()`, 30000);

await page.send("Page.reload", {});
await sleep(3500);
await page.ev("1");

// The wallpaper must be on the branch the panels were designed for.
const bg = await page.ev(`(() => {
  const h = document.documentElement;
  return { hasBg: h.classList.contains('has-bg'), bgLight: h.classList.contains('bg-light'),
           bgImage: h.classList.contains('bg-image'),
           attachment: getComputedStyle(document.body).backgroundAttachment };
})()`);
console.log("  wallpaper: " + JSON.stringify(bg));
chk("html carries has-bg", bg.hasBg === true);
chk("html does NOT carry bg-light (dark branch, as designed)", bg.bgLight === false);

await page.ev(`(typeof LP!=="undefined"&&LP.devPro)?(LP.devPro(true),"on"):"missing"`);   // I10
await sleep(2000);
await page.send("Page.reload", {});
await sleep(3500);
await page.ev("1");

const frames = [];
const click = async (sel, wait = 1500) => {
  const r = await page.ev(`(() => { const e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return 'no control: '+${JSON.stringify(sel)}; e.click(); return 'ok'; })()`);
  await sleep(wait);
  return r;
};

// ---- 01 home grid --------------------------------------------------------
console.log("\n  01 home grid");
await click('[data-tab="home"]');
await page.ev(`(() => { const p=document.getElementById('sidebar-panel'); if(p) p.innerHTML=''; return 1; })()`);
await sleep(700);
frames.push(await shoot(page, "01-home-grid.png"));

// ---- 02 tasks and notes --------------------------------------------------
console.log("\n  02 tasks and notes");
await click('[data-tab="tasks"]', 2200);
// I19: a real pointer over the row, box re-read and asserted non-zero, before
// anything depends on the hover-revealed pill being there.
const hover = await page.ev(`(async () => {
  const row = document.querySelector('#tab-tasks .tt-task-row, #tab-tasks [data-task-id]');
  if (!row) return { hovered: false, why: 'no task row on screen' };
  const r = row.getBoundingClientRect();
  return { hovered: true, x: Math.round(r.left + r.width * 0.5), y: Math.round(r.top + r.height / 2) };
})()`);
let hoverHeld = false;
if (hover.hovered) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: hover.x, y: hover.y, buttons: 0 });
  await sleep(700);
  const pill = await page.ev(`(() => {
    const p = document.querySelector('#tab-tasks .tt-task-options, #tab-tasks [data-task-menu], #tab-tasks .tt-row-options');
    if (!p) return { found: false };
    const r = p.getBoundingClientRect();
    return { found: true, w: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  hoverHeld = !!(pill.found && pill.w > 0);
  console.log("  hover pill: " + JSON.stringify(pill));
}
console.log("  hover held: " + hoverHeld);
frames.push(await shoot(page, "02-tasks-and-notes.png"));

// ---- 03 focus session, RUNNING with time on the clock --------------------
// The fixture's helpers are re-injected because each Page.reload above wipes the
// evaluation context; and the state write is followed by a reload because a page
// that writes storage does not re-render itself (I11, the write-provenance gate).
console.log("\n  03 focus session");
const focus = await page.ev(`(async () => { ${seedSrc} \n return await __captureStartFocus(); })()`, 30000);
console.log("  focus: " + JSON.stringify(focus));
await page.send("Page.reload", {});
await sleep(3500);
await page.ev("1");
await click('[data-tab="dashboard"]', 2000);
const pill = await page.ev(`(() => {
  const el = document.querySelector('#sat-pill, .sat-pill, [data-sat-card], .sat-card');
  return { present: !!el, text: el ? el.innerText.replace(/\\s+/g,' ').trim().slice(0,80) : null };
})()`);
console.log("  active-task surface: " + JSON.stringify(pill));
frames.push(await shoot(page, "03-focus-session.png"));

// ---- 04 the gate page ----------------------------------------------------
console.log("\n  04 focus blocking (gate page)");
// ENCODE THE WHOLE TARGET. /json/new?<url> treats a bare & as its own
// separator, so `entry` never reached the page and the gate rendered its
// generic "This site is blocked" fallback instead of naming the domain.
const gateUrl = `chrome-extension://${EXT_ID}/gate.html?to=`
  + encodeURIComponent("https://news.ycombinator.com/") + "&entry=news.ycombinator.com";
const gate = await openPage(encodeURIComponent(gateUrl));
await gate.ev("1");
await sleep(1200);
frames.push(await shoot(gate, "04-focus-blocking.png"));
await j(`/json/close/${gate.targetId}`);

// ---- 05 insights ---------------------------------------------------------
console.log("\n  05 insights");
await click('[data-tab="insights"]', 3000);
frames.push(await shoot(page, "05-insights.png"));

// ---- 06 sessions ---------------------------------------------------------
console.log("\n  06 sessions");
// Home first: the flyout was previously captured over a half-covered Insights
// board, which reads as a mistake rather than as a panel over the grid.
await click('[data-tab="home"]', 1600);
await click("#sb-sessions", 2200);
frames.push(await shoot(page, "06-sessions.png"));

// ------------------------------------------------------------------ hygiene
console.log("\n  frame hygiene");
chk("console clean across the run", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
const shown = await page.ev(`(() => {
  const v = document.getElementById('settings-version');
  return { version: chrome.runtime.getManifest().version, settingsLine: v ? v.textContent.trim() : null };
})()`);
chk("manifest version is what the frames show", !!shown.version, shown.version);

console.log(`\nCAPTURE: ${fail === 0 ? "PASS" : "FAIL"} - ${pass} passed, ${fail} failed`);
console.log(`  hoverHeld=${hoverHeld}`);
for (const f of frames) console.log(`  ${path.basename(f.file)}  ${f.w}x${f.h}  ${f.bytes} bytes`);
teardown();
process.exit(fail === 0 ? 0 : 1);
