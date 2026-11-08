// Turn a video file into a compositor clip folder: play it in Edge at quarter
// speed, capture every presented frame (requestVideoFrameCallback) as JPEG
// with its media time, and write index.json. Also writes the LAST frame as a
// separate still (the end card's background).
//   node --experimental-websocket extract-frames.mjs <repo> <pkg> <video> <out-dir> <last-frame.jpg>
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, FILE, OUT, LAST] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/v")) {
    const size = fs.statSync(FILE).size, m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    const type = FILE.endsWith(".mp4") ? "video/mp4" : "video/webm";
    if (!m) { res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" }); return fs.createReadStream(FILE).pipe(res); }
    const a = Number(m[1]), z = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { "content-type": type, "content-length": z - a + 1, "content-range": `bytes ${a}-${z}/${size}`, "accept-ranges": "bytes" });
    return fs.createReadStream(FILE, { start: a, end: z }).pipe(res);
  }
  res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><body style='margin:0;background:#000'><video id=v src='/v' muted playsinline></video></body>");
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ repo: REPO, ext: PKG, port: 9885, profile: path.join(REPO, ".scratch-profile-extract"), dpr: 1 });
try {
  const tab = await b.open(`http://127.0.0.1:${server.address().port}/`);
  await sleep(1000);
  await tab.ev(`(async () => { const v = document.getElementById('v'); await new Promise(r => v.readyState >= 2 ? r() : v.onloadeddata = r);
    window.__frames = []; const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d');
    const cb = (now, m) => { g.drawImage(v, 0, 0); window.__frames.push({ t: Math.round(m.mediaTime * 1000), jpg: c.toDataURL('image/jpeg', 0.94).split(',')[1] }); if (!v.ended) v.requestVideoFrameCallback(cb); };
    v.requestVideoFrameCallback(cb); v.playbackRate = 0.25; await v.play(); await new Promise(r => v.onended = r); await new Promise(r => setTimeout(r, 300));
    window.__info = { w: v.videoWidth, h: v.videoHeight, duration: v.duration, frames: window.__frames.length }; return 1; })()`, 10 * 60 * 1000);
  const info = await tab.ev("window.__info");
  const index = [];
  for (let i = 0; i < info.frames; i += 20) {
    const chunk = await tab.ev(`window.__frames.slice(${i}, ${i + 20})`, 60000);
    chunk.forEach((f, k) => { const file = String(i + k).padStart(4, "0") + ".jpg"; fs.writeFileSync(path.join(OUT, file), Buffer.from(f.jpg, "base64")); index.push({ file, t: f.t }); });
  }
  const dedup = index.filter((f, i) => i === 0 || f.t !== index[i - 1].t);
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ frames: dedup, pointer: [{ t: 0, x: -50, y: -50, down: false }], durationMs: Math.round(info.duration * 1000) }));
  fs.copyFileSync(path.join(OUT, dedup.at(-1).file), LAST);
  const gaps = dedup.slice(1).map((f, i) => f.t - dedup[i].t);
  console.log(JSON.stringify({ ...info, unique: dedup.length, firstT: dedup[0].t, lastT: dedup.at(-1).t, maxGapMs: Math.max(...gaps), medianGapMs: [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] }));
} finally { await b.close(); server.close(); }
process.exit(0);
