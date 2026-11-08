// Shared plumbing for the promo footage: launch a scratch Edge on the PACKAGED
// build through the repo's own launch helper, seed the store fixture (default
// wallpaper, distinct tag colours), Pro on, and expose CDP + a recorder that
// logs screencast frames and the pointer path together.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ repo, ext, port, profile, width = 1920, height = 1080, dpr = 1.5 }) {
  const { browserArgs, EDGE } = await import(pathToFileURL(path.join(repo, "tools/browser-launch.mjs")).href);
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn(EDGE, browserArgs({ profileDir: profile, extDir: ext, port, headless: true }), { stdio: "ignore" });
  const j = (p, method = "GET") => new Promise((res, rej) => {
    const r = http.request({ host: "127.0.0.1", port, path: p, method }, (x) => {
      let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }); r.on("error", rej); r.end();
  });
  for (let i = 0; i < 80; i++) { try { await j("/json/version"); break; } catch { await sleep(250); } }
  const spPath = path.join(profile, "Default/Secure Preferences");
  for (let i = 0; i < 80 && !fs.existsSync(spPath); i++) await sleep(250);
  await sleep(1000);
  const sp = JSON.parse(fs.readFileSync(path.join(profile, "Default/Secure Preferences"), "utf8"));
  const norm = (p) => p.replace(/\\/g, "/").toLowerCase().replace(/\/$/, "");
  const id = Object.entries(sp.extensions.settings).find(([, v]) => norm(v.path || "") === norm(ext))[0];
  async function open(url) {
    const t = await j(`/json/new?${url}`, "PUT");
    const tab = await connect(t.webSocketDebuggerUrl);
    tab.targetId = t.id;
    await tab.send("Page.enable");
    await tab.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: false });
    return tab;
  }
  async function close() {
    try { const v = await j("/json/version"); const b = await connect(v.webSocketDebuggerUrl); await b.send("Browser.close"); } catch {}
    await sleep(1500);
    try { process.kill(proc.pid); } catch {}
    fs.rmSync(profile, { recursive: true, force: true });
  }
  return { proc, id, j, open, close };
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0; const pending = new Map(); const listeners = []; const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.text + " " + (d.params.exceptionDetails.exception?.description || "").slice(0, 200));
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value ?? a.description).join(" "));
    for (const l of listeners) l(d);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr, timeout = 30000) => {
    const r = await Promise.race([send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }), sleep(timeout).then(() => ({ timeout: true }))]);
    if (r.timeout) throw new Error("evaluate timed out: " + expr.slice(0, 80));
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  return { ws, send, ev, on: (fn) => listeners.push(fn), errors };
}

export async function seed(tab, repo) {
  const src = fs.readFileSync(path.join(repo, "tools/capture-fixture.js"), "utf8");
  await sleep(2500);
  const r = await tab.ev(`(async () => { ${src} \n return await __seedCaptureFixture({ wallpaper: "default", distinctTagColors: true }); })()`, 90000);
  if (!r || !r.ok) throw new Error("seed failed: " + JSON.stringify(r));
  await tab.ev(`(async () => { ${src} \n return await __captureSilenceToasts(); })()`, 30000);
  await tab.ev(`LP.devPro(true)`);
  await sleep(600);
  await tab.send("Page.reload", {});
  await sleep(3500);
  return src;
}

// A recorder: screencast frames + the pointer path, on one clock (ms since start).
export function recorder(tab) {
  let frames = [], pointer = [], t0 = 0, on = false, mx = 960, my = 540;
  tab.on((d) => {
    if (d.method !== "Page.screencastFrame" || !on) return;
    tab.send("Page.screencastFrameAck", { sessionId: d.params.sessionId });
    frames.push({ t: d.params.metadata.timestamp * 1000, data: d.params.data });
  });
  const now = () => Date.now() - t0;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const api = {
    async start(x = 960, y = 540) {
      frames = []; pointer = []; mx = x; my = y; t0 = Date.now(); on = true;
      pointer.push({ t: 0, x, y, down: false });
      await tab.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 2880, maxHeight: 1620, everyNthFrame: 1 });
      await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
    },
    async moveTo(x, y, ms = 700, down = false) {
      const sx = mx, sy = my, steps = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const u = ease(i / steps), px = sx + (x - sx) * u, py = sy + (y - sy) * u;
        await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py, buttons: down ? 1 : 0, button: down ? "left" : "none" });
        pointer.push({ t: now(), x: px, y: py, down });
        await sleep(ms / steps);
      }
      mx = x; my = y;
    },
    async click(hold = 90) {
      await tab.send("Input.dispatchMouseEvent", { type: "mousePressed", x: mx, y: my, button: "left", buttons: 1, clickCount: 1 });
      pointer.push({ t: now(), x: mx, y: my, down: true });
      await sleep(hold);
      await tab.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mx, y: my, button: "left", buttons: 0, clickCount: 1 });
      pointer.push({ t: now(), x: mx, y: my, down: false });
    },
    async press() { await tab.send("Input.dispatchMouseEvent", { type: "mousePressed", x: mx, y: my, button: "left", buttons: 1, clickCount: 1 }); pointer.push({ t: now(), x: mx, y: my, down: true }); },
    async release() { await tab.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mx, y: my, button: "left", buttons: 0, clickCount: 1 }); pointer.push({ t: now(), x: mx, y: my, down: false }); },
    async wheel(dy, ms = 900) {
      const steps = Math.max(2, Math.round(ms / 16));
      for (let i = 0; i < steps; i++) { await tab.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: mx, y: my, deltaX: 0, deltaY: dy / steps }); await sleep(ms / steps); }
      pointer.push({ t: now(), x: mx, y: my, down: false });
    },
    hold: (ms) => sleep(ms),
    async stop(dir) {
      await sleep(300);
      await tab.send("Page.stopScreencast");
      on = false;
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const base = t0, wall = Date.now() - t0;
      const index = frames.map((f, i) => { const n = String(i).padStart(4, "0") + ".jpg"; fs.writeFileSync(path.join(dir, n), Buffer.from(f.data, "base64")); return { file: n, t: Math.round(f.t - base) }; });
      // Frames carry their own epoch timestamp; both clocks are measured from start().
      const gaps = index.slice(1).map((f, i) => f.t - index[i].t);
      const meta = { frames: index, pointer, durationMs: wall, maxGapMs: gaps.length ? Math.max(...gaps) : 0, frameCount: index.length };
      fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(meta));
      return { frameCount: index.length, durationMs: wall, maxGapMs: meta.maxGapMs };
    },
  };
  return api;
}

// Centre of the first element matching a selector (optionally whose text matches), in CSS px.
export async function centre(tab, sel, text) {
  return tab.ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ${text ? `e.textContent.trim().includes(${JSON.stringify(text)})` : "true"}; });
    const e = els[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
}
