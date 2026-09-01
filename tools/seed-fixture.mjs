#!/usr/bin/env node
// ===========================================================================
// SEED-FIXTURE — one parameterised seeder for every harness this project runs.
//
//   node tools/seed-fixture.mjs --profile busy  --user-data-dir .scratch/demo
//   node tools/seed-fixture.mjs --profile calm  --user-data-dir .scratch/shots
//   node tools/seed-fixture.mjs --profile empty --user-data-dir .scratch/zero
//
// Optional: --port N (default 9700), --keep (leave the browser running),
//           --headed (watch it), --verify (drive the surfaces and report).
//
// PROFILES
//   calm   tools/capture-fixture.js, unchanged and called by reference. Store
//          frames must not move because this file changed.
//   busy   tools/fixture-profiles.js, the full coverage list.
//   empty  a fresh Pro profile with nothing in it.
//
// It seeds through the PAGE, because window.Storage and window.Tracking are the
// product's own layer and a seeder that writes chrome.storage directly produces
// a shape the product never produces (BUGS.md Q13).
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn, execSync } from "node:child_process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i === -1 ? d : argv[i + 1]; };
const flag = (k) => argv.includes(k);

const PROFILE  = arg("--profile", "busy");
const USER_DIR = arg("--user-data-dir", null);
const PORT     = Number(arg("--port", 9700));
const EDGE     = arg("--browser", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
const VALID    = ["calm", "busy", "empty"];

// =========================================================================
// THE GUARD. FIRST THING, BEFORE A BROWSER EXISTS.
//
// This writes hundreds of records and wipes the workspace list to do it.
// Pointed at a real Chrome or Edge profile it would be unrecoverable without a
// restore, so the target MUST live under <repo>/.scratch/. Containment is
// checked on the RESOLVED REAL PATH with a separator-terminated prefix, so
// neither "..", nor a symlink, nor a sibling directory whose name merely starts
// with ".scratch" (".scratchpad-real") can slip past it.
// =========================================================================
function assertScratch(target) {
  if (!target) {
    console.error("REFUSED: --user-data-dir is required. It must be under .scratch/.");
    process.exit(2);
  }
  const root = path.resolve(REPO, ".scratch");
  // resolve through any existing symlink; a not-yet-created dir resolves via its
  // nearest existing ancestor, which is what we actually need to constrain.
  const realOf = (p) => { try { return fs.realpathSync(p); } catch {
    const parent = path.dirname(p);
    if (parent === p) return path.resolve(p);
    return path.join(realOf(parent), path.basename(p));
  } };
  const abs  = realOf(path.resolve(REPO, target));
  const rootReal = fs.existsSync(root) ? fs.realpathSync(root) : root;
  const inside = abs === rootReal || abs.startsWith(rootReal + path.sep);
  if (!inside) {
    console.error("REFUSED: the seeder only writes to scratch profiles.");
    console.error("  asked for : " + abs);
    console.error("  allowed   : " + rootReal + path.sep + "...");
    console.error("This wipes the workspace list and writes hundreds of records;");
    console.error("against a real browser profile that is not undoable.");
    process.exit(2);
  }
  return abs;
}

if (!VALID.includes(PROFILE)) {
  console.error(`REFUSED: unknown profile "${PROFILE}". One of: ${VALID.join(", ")}`);
  process.exit(2);
}
const PROFILE_DIR = assertScratch(USER_DIR);

// ---------------------------------------------------------------- plumbing
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = (p, m = "GET") => new Promise((res, rej) => {
  const r = http.request({ host: "127.0.0.1", port: PORT, path: p, method: m }, (x) => {
    let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => { try { res(b ? JSON.parse(b) : null); } catch { res(null); } });
  }); r.on("error", rej); r.end();
});
let CHILD = null;
const teardown = () => { try { if (CHILD?.pid && !flag("--keep")) execSync(`taskkill /PID ${CHILD.pid} /T /F`, { stdio: "ignore" }); } catch {} };
process.on("exit", teardown);
process.on("SIGINT", () => process.exit(130));

fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
fs.mkdirSync(PROFILE_DIR, { recursive: true });

console.log(`SEED  profile=${PROFILE}  dir=${path.relative(REPO, PROFILE_DIR)}  port=${PORT}`);
CHILD = spawn(EDGE, [
  `--user-data-dir=${PROFILE_DIR}`, "--no-first-run", "--no-default-browser-check", "--disable-sync",
  "--disable-features=DisableLoadExtensionCommandLineSwitch", "--enable-unsafe-extension-debugging",
  `--disable-extensions-except=${REPO}`, `--load-extension=${REPO}`, `--remote-debugging-port=${PORT}`,
  "--window-size=1400,900", ...(flag("--headed") ? [] : ["--headless=new"]), "about:blank"
], { stdio: "ignore" });

for (let i = 0; i < 30; i++) { await sleep(1000); try { await j("/json/version"); break; } catch {} }
await sleep(2500);

let ID = null;
for (let i = 0; i < 20 && !ID; i++) {
  for (const f of ["Secure Preferences", "Preferences"]) {
    const sp = path.join(PROFILE_DIR, "Default", f); if (!fs.existsSync(sp)) continue;
    try {
      const s = (JSON.parse(fs.readFileSync(sp, "utf8")).extensions || {}).settings || {};
      for (const [id, v] of Object.entries(s)) if (v?.path && path.resolve(v.path).toLowerCase() === REPO.toLowerCase()) ID = id;
    } catch {}
  }
  if (!ID) await sleep(1000);
}
if (!ID) { console.error("BROKEN: extension id not resolved"); process.exit(2); }

const target = await j(`/json/new?chrome-extension://${ID}/newtab.html`, "PUT");
await sleep(3500);
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${target.id}`);
await new Promise((r, x) => { ws.addEventListener("open", r); ws.addEventListener("error", x); });
let n = 0; const pend = new Map(); const consoleErrors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    consoleErrors.push(String((m.params.args || []).map((a) => a.value).join(" ")));
});
const send = (method, params = {}) => { const k = ++n; ws.send(JSON.stringify({ id: k, method, params })); return new Promise((r) => pend.set(k, r)); };
const ev = async (x) => {
  const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "threw");
  return r.result.value;
};
await send("Runtime.enable"); await send("Page.enable");
await ev("1"); await sleep(600);

// ------------------------------------------------------------------- seed
let result;
if (PROFILE === "calm") {
  // Absorbed by reference, not copied: this is the store-frame fixture and it
  // must keep producing byte-comparable frames.
  await ev(fs.readFileSync(path.join(REPO, "tools", "capture-fixture.js"), "utf8"));
  await ev(`(typeof LP!=="undefined"&&LP.devPro)?LP.devPro(true):null`);
  await sleep(1000);
  result = await ev(`__seedCaptureFixture()`);
  await ev(`__captureSilenceToasts && __captureSilenceToasts()`);
  if (result) result.profile = "calm";
} else {
  await ev(fs.readFileSync(path.join(REPO, "tools", "fixture-profiles.js"), "utf8"));
  await ev(`(typeof LP!=="undefined"&&LP.devPro)?LP.devPro(true):null`);
  await sleep(1000);
  result = await ev(`__seedProfile(${JSON.stringify(PROFILE)})`);
}
if (!result || !result.ok) {
  console.error("SEED FAILED: " + JSON.stringify(result));
  process.exit(1);
}
(result.log || []).forEach((l) => console.log("  " + l));

await ev(`location.reload()`); await sleep(4500);
await ev(`(typeof LP!=="undefined"&&LP.devPro)?LP.devPro(true):null`); await sleep(2000);

if (result.tracking && result.tracking.seeded) {
  const t = result.tracking;
  console.log(`  tracking: ${t.sessionsSeeded} sessions -> ${t.dayAggregates} day aggregates, ` +
              `${t.sessionsRetained} raw sessions retained after the 30-day prune`);
  console.log(`  lifetime.since is ${t.lifetimeSinceAgeDays} days old ` +
              `(the line needs >= 30, else it is suppressed)`);
}

// ---------------------------------------------------------------- verify
// Seeding is not the deliverable. This drives the real surfaces and reports
// what they RENDER, because a seeder whose data never reaches a surface is the
// vacuous pass with extra steps.
if (flag("--verify")) {
  const goTab = async (t) => { await ev(`(()=>{const e=document.querySelector('[data-tab="${t}"]');if(e)e.click();return 1})()`); await sleep(1600); };
  const timeTab = async (t) => ev(`(async()=>{const e=document.querySelector('[data-tab="${t}"]');if(!e)return null;
      const t0=performance.now(); e.click();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return Math.round(performance.now()-t0);})()`);
  const text = async () => ev(`document.body.innerText.replace(/\\n{2,}/g,"\\n").slice(0,900)`);
  const count = async (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);

  console.log("\nVERIFY — what each surface actually renders");
  const timings = {};
  for (const [tab, label] of [["home","Home"],["tasks","Tasks"],["dashboard","Dashboard"],["insights","Insights"]]) {
    timings[label] = await timeTab(tab);
    await sleep(1400);
  }
  // EVERY COUNT IS SCOPED TO ITS OWN PANEL. Unscoped selectors matched the
  // SIDEBAR's shortcut list too and reported 70 groups against a profile with
  // five, which is a wrong number that looks like a measurement.
  const panelText = async (id) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
      return e ? e.innerText.replace(/\\n{2,}/g,"\\n").slice(0,600) : null;})()`);
  await goTab("home");
  console.log(`  Home       shortcuts=${await count("#tab-home .shortcut-link")} groups=${await count("#tab-home .group-name")} grids=${await count("#tab-home .shortcuts-grid")}`);
  await goTab("tasks");
  console.log(`  Tasks      goalCards=${await count("#tab-tasks .tt-goal-card")} taskRows=${await count("#tab-tasks .tt-task-row")} notes=${await count("#tab-tasks .note-card")}`);
  await goTab("dashboard");
  console.log(`  Dashboard  ${JSON.stringify((await panelText("tab-dashboard") || "").split("\n").slice(0, 8).join(" | ").slice(0, 190))}`);
  await goTab("insights");
  console.log(`  Insights   chartBars=${await count("#tab-insights svg.pp-trend-chart rect")} taskRows=${await count("#tab-insights .insights-task-row")} stripItems=${await count("#tab-insights .insights-strip-item")}`);

  console.log("\nRENDER TIMINGS (tab click to second animation frame, ms)");
  for (const [k, v] of Object.entries(timings)) console.log(`  ${k.padEnd(11)}${v}`);
}

console.log(`\nconsole errors during seeding: ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log("  " + e.slice(0, 160)));
if (flag("--keep")) console.log(`\nbrowser left running on port ${PORT} (pid ${CHILD.pid}); profile at ${path.relative(REPO, PROFILE_DIR)}`);
process.exit(0);
