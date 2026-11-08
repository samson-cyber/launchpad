// Check a rendered WebM the way a viewer meets it: play it in Edge, record the
// media time of every presented frame (requestVideoFrameCallback), and grab
// stills as playback crosses the given seconds (seeking is not used: headless
// seeking proved unreliable). Reports size, duration, frame pacing.
//   node --experimental-websocket verify-video.mjs <repo> <pkg> <file.webm> <outdir> <sec,sec,...>
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, FILE, OUTDIR, SECS] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/v.webm")) {
    const size = fs.statSync(FILE).size, m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    if (!m) { res.writeHead(200, { "content-type": "video/webm", "content-length": size, "accept-ranges": "bytes" }); return fs.createReadStream(FILE).pipe(res); }
    const a = Number(m[1]), z = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { "content-type": "video/webm", "content-length": z - a + 1, "content-range": `bytes ${a}-${z}/${size}`, "accept-ranges": "bytes" });
    return fs.createReadStream(FILE, { start: a, end: z }).pipe(res);
  }
  res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><body style='margin:0;background:#000'><video id=v src='/v.webm' muted playsinline></video></body>");
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const b = await launch({ repo: REPO, ext: PKG, port: 9862, profile: path.join(REPO, ".scratch-profile-footage-verify"), dpr: 1, width: 1280, height: 720 });
fs.mkdirSync(OUTDIR, { recursive: true });
try {
  const tab = await b.open(`http://127.0.0.1:${server.address().port}/`);
  await sleep(1000);
  const targets = SECS.split(",").map(Number);
  const r = await tab.ev(`(async () => {
    const v = document.getElementById('v');
    await new Promise(r => v.readyState >= 1 ? r() : v.onloadedmetadata = r);
    const targets = ${JSON.stringify(targets)}, stills = [], times = [];
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d');
    const cb = (now, m) => {
      times.push(m.mediaTime);
      while (targets.length && m.mediaTime >= targets[0]) { g.drawImage(v, 0, 0); stills.push({ at: targets.shift(), mediaTime: m.mediaTime, jpg: c.toDataURL('image/jpeg', 0.85).split(',')[1] }); }
      v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
    await v.play();
    await new Promise(r => v.onended = r);
    const d = []; for (let i = 1; i < times.length; i++) d.push(times[i] - times[i-1]);
    const sorted = [...d].sort((a,b) => a-b);
    return { w: v.videoWidth, h: v.videoHeight, duration: v.duration, endTime: v.currentTime, frames: times.length,
      medianGapMs: +(sorted[Math.floor(sorted.length/2)]*1000).toFixed(1), maxGapMs: +(Math.max(...d)*1000).toFixed(1),
      gapsOver50ms: d.filter(x => x > 0.05).length, stills };
  })()`, 10 * 60 * 1000);
  for (const s of r.stills) fs.writeFileSync(path.join(OUTDIR, `still-${String(s.at).replace(".", "_")}.jpg`), Buffer.from(s.jpg, "base64"));
  const { stills, ...rest } = r;
  console.log(JSON.stringify({ ...rest, stills: stills.map((s) => ({ at: s.at, mediaTime: +s.mediaTime.toFixed(3) })) }));
} finally { await b.close(); server.close(); }
process.exit(0);
