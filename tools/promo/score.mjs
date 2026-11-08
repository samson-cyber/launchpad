// Score each take of each shot by smoothness WHILE THINGS MOVE: the frame rate
// and the longest frame gap inside the pointer's motion windows (a still
// screen sends no frames, so gaps there are not stutter). Picks the best take
// per shot: fewest stutters (gap > 50 ms), then the highest motion frame rate.
//   node score.mjs <takes-dir> t2 t3 t4
import fs from "node:fs";
import path from "node:path";
const [DIR, ...TAKES] = process.argv.slice(2);
const SHOTS = ["1-home", "2-tasks", "3-focus", "4-gate", "5-insights"];
const best = {};
for (const shot of SHOTS) {
  const rows = [];
  for (const t of TAKES) {
    const f = path.join(DIR, t, shot, "index.json");
    if (!fs.existsSync(f)) { rows.push({ take: t, missing: true }); continue; }
    const m = JSON.parse(fs.readFileSync(f, "utf8"));
    const ft = m.frames.map((x) => x.t);
    // Bursts: a still screen sends no frames, so frames come in runs while the
    // page changes. A gap over 250 ms ends a run; inside a run, a gap of 50 to
    // 250 ms is a visible stutter in a transition, a reorder or a scroll.
    let worst = 0, stutters = 0, inBurst = 0, burstMs = 0;
    for (let i = 1; i < ft.length; i++) { const g = ft[i] - ft[i - 1]; if (g > 250) continue; inBurst++; burstMs += g; if (g > worst) worst = g; if (g > 50) stutters++; }
    const span = burstMs, inFrames = inBurst;
    const firstFrame = ft.length ? ft[0] : null;
    rows.push({ take: t, frames: ft.length, burstMs: Math.round(span), burstFps: span ? +(inFrames / (span / 1000)).toFixed(1) : null, worstGapMs: Math.round(worst), stutters, firstFrameMs: firstFrame });
  }
  const ok = rows.filter((r) => !r.missing);
  ok.sort((x, y) => (x.stutters - y.stutters) || ((y.burstFps || 0) - (x.burstFps || 0)));
  best[shot] = ok[0] ? ok[0].take : null;
  console.log(shot);
  for (const r of rows) console.log("  " + JSON.stringify(r));
}
console.log("BEST", JSON.stringify(best));
fs.writeFileSync(path.join(DIR, "best.json"), JSON.stringify(best, null, 1));
