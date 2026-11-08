// Measure a music take for use under narration: length, true peak, overall
// RMS, the loudness curve in 2 s steps (does it build, does it stay under a
// voice), and the ending - the level of the last 0.5 s against the loudest
// 2 s, so a track that is still playing at the cut shows as "cut off" and one
// that resolves shows a decay.
//   node --experimental-websocket music-measure.mjs <repo> <pkg> <file.mp3>...
import fs from "node:fs";
import path from "node:path";
import { launch } from "./lib.mjs";
const [REPO, PKG, ...FILES] = process.argv.slice(2);
const b = await launch({ repo: REPO, ext: PKG, port: 9882, profile: path.join(REPO, ".scratch-profile-music"), dpr: 1 });
try {
  const tab = await b.open("about:blank");
  for (const FILE of FILES) {
    const b64 = fs.readFileSync(FILE).toString("base64");
    const r = await tab.ev(`(async () => {
      const bin = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
      const buf = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bin.buffer);
      const n = buf.length, sr = buf.sampleRate, chs = [...Array(buf.numberOfChannels).keys()].map(c => buf.getChannelData(c));
      let peak = 0, sq = 0;
      for (const d of chs) for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sq += d[i] * d[i]; }
      const rmsOf = (a, z) => { let s = 0, k = 0; for (const d of chs) for (let i = Math.max(0, a); i < Math.min(n, z); i++) { s += d[i] * d[i]; k++; } return k ? Math.sqrt(s / k) : 0; };
      const db = (x) => +(20 * Math.log10(x || 1e-9)).toFixed(1);
      const steps = []; for (let s = 0; s < n / sr; s += 2) steps.push(db(rmsOf(Math.round(s * sr), Math.round((s + 2) * sr))));
      const loudest = Math.max(...steps);
      const tail = db(rmsOf(n - Math.round(0.5 * sr), n));
      return { secs: +(n / sr).toFixed(2), ch: buf.numberOfChannels, peakDb: db(peak), rmsDb: db(Math.sqrt(sq / (n * chs.length))), every2s: steps, last05sVsLoudestDb: +(tail - loudest).toFixed(1) };
    })()`, 120000);
    console.log(path.basename(FILE), JSON.stringify(r));
  }
} finally { await b.close(); }
process.exit(0);
