// Find the spoken segments of a narration take: decode it in headless Edge,
// take a 20 ms RMS envelope, and split on pauses of at least MIN_GAP below
// -42 dB of the take's peak. Prints each segment's start, end and length, the
// total, and the loudness, so the cut can be timed to the real voice.
//   node --experimental-websocket narration-segments.mjs <repo> <pkg> <file.mp3> [minGapMs]
import fs from "node:fs";
import path from "node:path";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, FILE, GAP] = process.argv.slice(2);
const MIN_GAP = Number(GAP || 280);
const b = await launch({ repo: REPO, ext: PKG, port: 9881, profile: path.join(REPO, ".scratch-profile-narration"), dpr: 1 });
try {
  const tab = await b.open("about:blank");
  const b64 = fs.readFileSync(FILE).toString("base64");
  const r = await tab.ev(`(async () => {
    const bin = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const buf = await ctx.decodeAudioData(bin.buffer);
    const n = buf.length, sr = buf.sampleRate, x = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) x[i] += d[i] / buf.numberOfChannels; }
    const W = Math.round(sr * 0.02), env = [];
    for (let i = 0; i + W <= n; i += W) { let e = 0; for (let k = 0; k < W; k++) e += x[i + k] * x[i + k]; env.push(Math.sqrt(e / W)); }
    let peak = 0, sq = 0; for (const v of x) { const a = Math.abs(v); if (a > peak) peak = a; sq += v * v; }
    const envPeak = Math.max(...env), thr = envPeak * Math.pow(10, -42 / 20);
    const segs = []; let s = -1, quiet = 0;
    for (let i = 0; i < env.length; i++) {
      if (env[i] > thr) { if (s < 0) s = i; quiet = 0; }
      else if (s >= 0) { quiet++; if (quiet * 20 >= ${MIN_GAP}) { segs.push([s * 20, (i - quiet + 1) * 20]); s = -1; quiet = 0; } }
    }
    if (s >= 0) segs.push([s * 20, (env.length - quiet) * 20]);
    return { secs: +(n / sr).toFixed(2), channels: buf.numberOfChannels, sampleRate: sr, peakDb: +(20 * Math.log10(peak)).toFixed(1), rmsDb: +(10 * Math.log10(sq / n)).toFixed(1), segs };
  })()`, 120000);
  console.log(JSON.stringify({ file: path.basename(FILE), secs: r.secs, sr: r.sampleRate, ch: r.channels, peakDb: r.peakDb, rmsDb: r.rmsDb, count: r.segs.length }));
  r.segs.forEach(([a, z], i) => console.log(`  ${String(i + 1).padStart(2)}  ${(a / 1000).toFixed(2)}  ->  ${(z / 1000).toFixed(2)}   (${((z - a) / 1000).toFixed(2)} s)`));
} finally { await b.close(); }
process.exit(0);
