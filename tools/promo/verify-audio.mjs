// Prove the rendered video carries the mix, whole and in sync: decode the
// WebM's own audio track in Edge, compare its length and level with the
// source mix, and find the lag that best lines up their 20 ms loudness
// envelopes (must be ~0 ms). A video whose audio is missing, truncated or
// shifted fails here even if it plays.
//   node --experimental-websocket verify-audio.mjs <repo> <pkg> <video.webm> <mix.wav>
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, VIDEO, MIX] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  const f = req.url.startsWith("/v") ? VIDEO : req.url.startsWith("/m") ? MIX : null;
  if (!f) { res.writeHead(200, { "content-type": "text/html" }); return res.end("<!doctype html><body></body>"); }
  res.writeHead(200, { "content-type": "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const b = await launch({ repo: REPO, ext: PKG, port: 9887, profile: path.join(REPO, ".scratch-profile-vaudio"), dpr: 1 });
let out;
try {
  const tab = await b.open(`http://127.0.0.1:${server.address().port}/`);
  await sleep(800);
  out = await tab.ev(`(async () => {
    const ac = new OfflineAudioContext(2, 1, 48000);
    const v = await ac.decodeAudioData(await (await fetch('/v')).arrayBuffer());
    const m = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(await (await fetch('/m')).arrayBuffer());
    const env = (buf) => { const d = buf.getChannelData(0), W = Math.round(buf.sampleRate * 0.02), e = []; for (let i = 0; i + W <= d.length; i += W) { let s = 0; for (let k = 0; k < W; k++) s += d[i + k] * d[i + k]; e.push(Math.sqrt(s / W)); } return e; };
    const ev = env(v), em = env(m), n = Math.min(ev.length, em.length);
    const corr = (lag) => { let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0, k = 0; for (let i = Math.max(0, -lag); i < n && i + lag < n; i++) { const x = ev[i + lag], y = em[i]; sxy += x * y; sx += x; sy += y; sxx += x * x; syy += y * y; k++; } return (k * sxy - sx * sy) / Math.sqrt((k * sxx - sx * sx) * (k * syy - sy * sy)); };
    let best = 0, bc = -2; for (let lag = -25; lag <= 25; lag++) { const c = corr(lag); if (c > bc) { bc = c; best = lag; } }
    const rms = (buf) => { const d = buf.getChannelData(0); let s = 0; for (const x of d) s += x * x; return 20 * Math.log10(Math.sqrt(s / d.length)); };
    return { videoAudioSecs: +v.duration.toFixed(3), mixSecs: +m.duration.toFixed(3), channels: v.numberOfChannels, videoRmsDb: +rms(v).toFixed(1), mixRmsDb: +rms(m).toFixed(1), bestLagMs: best * 20, corrAtBest: +bc.toFixed(3), corrAtZero: +corr(0).toFixed(3) };
  })()`, 180000);
} finally { await b.close(); server.close(); }
const ok = out.videoAudioSecs >= out.mixSecs - 0.1 - 0.05 && Math.abs(out.bestLagMs) <= 40 && out.corrAtZero > 0.95 && Math.abs(out.videoRmsDb - out.mixRmsDb) < 1.5;
console.log(JSON.stringify({ ...out, ok }));
process.exit(ok ? 0 : 1);
