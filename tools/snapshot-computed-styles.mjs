#!/usr/bin/env node
// [1.6.1] Zero-visible-change proof.
//
// Snapshots getComputedStyle for EVERY element in the new-tab page, in both the
// dark default and the forced light-wallpaper branch, and writes JSON. Run once
// before the change and once after; the diff must be empty.
//
// WALKS EVERY ELEMENT rather than a hand-picked list on purpose. A curated list
// of "one element per surface" cannot prove the absence of change anywhere else,
// and "I looked at twelve and they were fine" is P7 — the instrument's null
// result only covers where it looked.
//
// usage: node --experimental-websocket computed-snapshot.mjs <ext-dir> <out.json> <port>
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import http from "node:http";

const EXT = process.argv[2];
const OUT = process.argv[3];
const PORT = Number(process.argv[4] || 9471);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PROFILE = path.resolve(".snap-profile-" + PORT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = (p, m = "GET") => new Promise((res, rej) => {
  const r = http.request({ host: "127.0.0.1", port: PORT, path: p, method: m }, (x) => {
    let b = ""; x.on("data", (d) => (b += d));
    x.on("end", () => { try { res(b ? JSON.parse(b) : null); } catch { res({ raw: b }); } });
  });
  r.on("error", rej); r.end();
});

let CHILD = null;
function teardown() {
  try { if (CHILD && CHILD.pid) execSync(`taskkill /PID ${CHILD.pid} /T /F`, { stdio: "ignore" }); } catch {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}
process.on("exit", teardown);
process.on("SIGINT", () => { teardown(); process.exit(130); });

fs.rmSync(PROFILE, { recursive: true, force: true });
CHILD = spawn(EDGE, [
  `--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check", "--disable-sync",
  "--disable-features=DisableLoadExtensionCommandLineSwitch", "--enable-unsafe-extension-debugging",
  `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
  `--remote-debugging-port=${PORT}`, "--window-size=1400,900", "about:blank",
], { stdio: "ignore" });

let up = false;
for (let i = 0; i < 30; i++) { await sleep(1000); try { await j("/json/version"); up = true; break; } catch {} }
if (!up) { console.error("no debug port"); process.exit(2); }
await sleep(2500);

let EXT_ID = null;
for (let i = 0; i < 20 && !EXT_ID; i++) {
  for (const f of ["Secure Preferences", "Preferences"]) {
    const sp = path.join(PROFILE, "Default", f);
    if (!fs.existsSync(sp)) continue;
    try {
      const d = JSON.parse(fs.readFileSync(sp, "utf8"));
      const s = (d.extensions && d.extensions.settings) || {};
      for (const [id, v] of Object.entries(s)) {
        const p = String((v && v.path) || "");
        if (p && path.resolve(p).toLowerCase() === path.resolve(EXT).toLowerCase()) EXT_ID = id;
      }
    } catch {}
  }
  if (!EXT_ID) await sleep(1000);
}
if (!EXT_ID) { console.error("extension id not resolved"); process.exit(2); }

const t = await j(`/json/new?chrome-extension://${EXT_ID}/newtab.html`, "PUT");
await sleep(3500);
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${t.id}`);
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
let n = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const ev = async (expr) => {
  const k = ++n;
  ws.send(JSON.stringify({ id: k, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  const r = await new Promise((res) => pend.set(k, res));
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "threw");
  return r.result.value;
};

await ev("1"); await sleep(800);
// Pro surfaces must be present or half the page is not measured (I10).
await ev(`(typeof LP!=="undefined"&&LP.devPro)?LP.devPro(true):null`);

// READINESS IS ASSERTED, NOT SLEPT FOR. A fixed sleep produced a run where
// devPro had not applied: the Pro surfaces were absent, every sibling index
// downstream shifted, and because the element key contains those indices, NO key
// matched the baseline. The differ then reported "0 property diffs" over an
// intersection of ZERO elements, which is P13's vacuous pass wearing a
// zero-change hat. A snapshot that cannot see the Pro surfaces is not a smaller
// snapshot, it is a different page, so this now waits for a Pro marker and
// refuses to write a file without one.
// WAIT FOR THE COUNT TO STABILISE, not for a hardcoded floor. The page renders
// in at least two stages (~822 elements, then ~1092 once the later content
// lands), so a floor of 700 was satisfied by the FIRST stage and produced a
// snapshot of a half-built page. The differ caught it as a 72% intersection, but
// the fix belongs here. A stabilisation test also does not rot as the product
// grows, which any hardcoded count would.
let ready = false, last = -1, stable = 0;
for (let i = 0; i < 60; i++) {
  await sleep(500);
  const st = await ev(`(() => ({
    tabs: document.querySelectorAll("#tab-bar .tab").length,
    els: document.querySelectorAll("*").length
  }))()`);
  // A MINIMUM SETTLE TIME AS WELL AS STABILITY. The page has an early plateau:
  // it sits at ~822 elements for seconds before a later stage brings it to
  // ~1092. Stability alone exits on that plateau and measures 25% fewer
  // elements, which is a quieter version of the same coverage loss the
  // hardcoded floor caused. Both sides of a comparison were consistent, so the
  // result was valid, but it covered less than it could.
  if (st.tabs >= 4 && st.els === last && i >= 16) {
    if (++stable >= 4) { ready = true; break; }   // ~2s unchanged, after ~8s
  } else {
    stable = 0;
  }
  last = st.els;
}
if (!ready) {
  console.error("NOT READY: the element count never stabilised with the Pro tab bar " +
    "present, so this snapshot would describe a different page than the baseline. " +
    "Refusing to write a file.");
  process.exit(2);
}

const SNAP = `(() => {
  const PROPS = ["color","background-color","background-image","border-radius","box-shadow",
                 "font-size","font-weight","padding","margin","gap","border-color","border-width","opacity"];
  const key = (el) => {
    const parts = [];
    let e = el, guard = 0;
    while (e && e.nodeType === 1 && guard++ < 40) {
      let ix = 0, s = e;
      while ((s = s.previousElementSibling)) ix++;
      parts.unshift(e.tagName.toLowerCase() + "[" + ix + "]" + (e.id ? "#" + e.id : "") +
        (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\\s+/).join(".") : ""));
      e = e.parentElement;
    }
    return parts.join(">");
  };
  const out = {};
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    const rec = {};
    for (const p of PROPS) rec[p] = cs.getPropertyValue(p);
    out[key(el)] = rec;
  }
  return out;
})()`;

const dark = await ev(SNAP);
// Force the light-wallpaper branch so every html.has-bg.bg-light rule is exercised.
await ev(`document.documentElement.classList.add("has-bg","bg-light"); 1`);
await sleep(1200);
const light = await ev(SNAP);

fs.writeFileSync(OUT, JSON.stringify({ dark, light }, null, 0));
console.log(`snapshot -> ${OUT}  dark:${Object.keys(dark).length} light:${Object.keys(light).length} elements`);
process.exit(0);
