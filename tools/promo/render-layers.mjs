// Render the cut's drawn layers from the card page at 1920x1080:
//   wordmark.png        transparent, faded in over the opening shot
//   end/                the end card as a frame sequence, cued to the closing lines
//   end-final.png + .ground.png + report.json for the contrast check
//   node --experimental-websocket render-layers.mjs <repo> <pkg> <cards-dir> <out-dir> <end-cues.json>
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, CARDS_ARG, OUT, CUESF] = process.argv.slice(2);
const CARDS = path.resolve(CARDS_ARG), CUES = JSON.parse(fs.readFileSync(CUESF, "utf8"));
const types = { ".html": "text/html", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(CARDS, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(CARDS) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const base = `http://127.0.0.1:${server.address().port}/cards.html`;
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ repo: REPO, ext: PKG, port: 9886, profile: path.join(REPO, ".scratch-profile-layers"), dpr: 1, width: 1920, height: 1080 });
const report = {};
try {
  const tab = await b.open("about:blank");
  const shoot = async (file, fmt = "png") => { const s = await tab.send("Page.captureScreenshot", { format: fmt, quality: fmt === "jpeg" ? 92 : undefined }); fs.writeFileSync(path.join(OUT, file), Buffer.from(s.result.data, "base64")); };
  // 1. the wordmark, on a transparent page
  await tab.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await tab.send("Page.navigate", { url: `${base}?card=wordmark` }); await sleep(900);
  report.wordmarkFont = await tab.ev("window.ready");
  await shoot("wordmark.png");
  await tab.send("Emulation.setDefaultBackgroundColorOverride", {});
  // 2. the end card, frame by frame
  const dir = path.join(OUT, "end"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await tab.send("Page.navigate", { url: `${base}?card=end` }); await sleep(900);
  report.endFont = await tab.ev("window.ready");
  await tab.ev("new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = 'end-bg.jpg'; })");
  const frames = [], fps = 30;
  for (let i = 0; i <= Math.round(CUES.duration * fps); i++) {
    const t = i / fps; await tab.ev(`window.setEndT(${t}, ${JSON.stringify(CUES)})`);
    const file = String(i).padStart(4, "0") + ".jpg"; await shoot(path.join("end", file), "jpeg"); frames.push({ file, t: Math.round(t * 1000) });
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ frames, pointer: [{ t: 0, x: -50, y: -50, down: false }], durationMs: Math.round(CUES.duration * 1000) }));
  await tab.ev(`window.setEndT(${CUES.duration}, ${JSON.stringify(CUES)})`);
  report["end-final"] = { boxes: await tab.ev("window.inkBoxes()") };
  await shoot("end-final.png");
  await tab.ev(`document.querySelectorAll('[data-ink]').forEach(e => { e.style.color = 'transparent'; e.style.textShadow = 'none'; e.querySelectorAll('*').forEach(c => { c.style.color = 'transparent'; }); e.querySelectorAll('.dots i').forEach(d => { d.style.opacity = 0; }); })`);
  await shoot("end-final.ground.png");
  report.errors = tab.errors;
} finally { await b.close(); server.close(); }
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ wordmarkFont: report.wordmarkFont, endFont: report.endFont, endLines: report["end-final"].boxes.length, errors: report.errors }));
process.exit(0);
