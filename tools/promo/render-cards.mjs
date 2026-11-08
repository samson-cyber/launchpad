// Render the card page: the six captioned 1280x800 store frames as PNG, and
// (with --video) the comparison card as a 1920x1080 frame sequence a
// compositor clip can play. Also writes each frame's text boxes, and the same
// frame with the text hidden, so contrast can be measured against the real
// ground behind each line.
//   node --experimental-websocket render-cards.mjs <repo> <pkg> <cards-dir> <out-dir> [--video cues.json]
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, CARDS_ARG, OUT, ...rest] = process.argv.slice(2);
const CARDS = path.resolve(CARDS_ARG);
const vi = rest.indexOf("--video"), CUES = vi >= 0 ? JSON.parse(fs.readFileSync(rest[vi + 1], "utf8")) : null;
const types = { ".html": "text/html", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const p = path.join(CARDS, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(CARDS) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const base = `http://127.0.0.1:${server.address().port}/cards.html`;
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ repo: REPO, ext: PKG, port: 9884, profile: path.join(REPO, ".scratch-profile-cards"), dpr: 1, width: 1280, height: 800 });
const report = {};
try {
  const tab = await b.open("about:blank");
  const shoot = async (file, fmt = "png") => { const s = await tab.send("Page.captureScreenshot", { format: fmt, quality: fmt === "jpeg" ? 92 : undefined }); fs.writeFileSync(path.join(OUT, file), Buffer.from(s.result.data, "base64")); };
  for (const f of [1, 2, 3, 4, 5, 6]) {
    await tab.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await tab.send("Page.navigate", { url: `${base}?frame=${f}` }); await sleep(800);
    const fontOk = await tab.ev("window.ready");
    const name = `0${f}-${["", "home", "tasks", "focus", "blocking", "insights", "compare"][f]}`;
    await shoot(`${name}.png`);
    report[name] = { fontOk, boxes: await tab.ev("window.inkBoxes()") };
    await tab.ev(`document.querySelectorAll('[data-ink]').forEach(e => { e.style.color = 'transparent'; e.style.textShadow = 'none'; e.querySelectorAll('*').forEach(c => { c.style.color = 'transparent'; }); })`);
    await shoot(`${name}.ground.png`);
  }
  if (CUES) {
    const dir = path.join(OUT, "compare-video"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    await tab.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await tab.send("Page.navigate", { url: `${base}?card=compare` }); await sleep(800);
    report.compareFontOk = await tab.ev("window.ready");
    const frames = [], fps = 30;
    for (let i = 0; i <= Math.round(CUES.duration * fps); i++) {
      const t = i / fps; await tab.ev(`window.setT(${t}, ${JSON.stringify(CUES)})`);
      const file = String(i).padStart(4, "0") + ".jpg"; await shoot(path.join("compare-video", file), "jpeg"); frames.push({ file, t: Math.round(t * 1000) });
    }
    fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ frames, pointer: [{ t: 0, x: -50, y: -50, down: false }], durationMs: Math.round(CUES.duration * 1000) }));
    await tab.ev(`window.setT(${CUES.duration}, ${JSON.stringify(CUES)})`);
    report.compareVideo = { frames: frames.length, boxes: await tab.ev("window.inkBoxes()") };
    await shoot("compare-video-final.png");
    await tab.ev(`document.querySelectorAll('[data-ink]').forEach(e => { e.style.color = 'transparent'; e.style.textShadow = 'none'; e.querySelectorAll('*').forEach(c => { c.style.color = 'transparent'; }); })`);
    await shoot("compare-video-final.ground.png");
  }
  report.errors = tab.errors;
} finally { await b.close(); server.close(); }
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v && v.boxes ? { fontOk: v.fontOk, lines: v.boxes.length } : v]))));
process.exit(0);
