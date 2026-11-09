// Render the two Chrome Web Store promo tiles from tiles.html: 440x280 and
// 1400x560, as 24-bit PNG with no alpha (the store's rule). Like
// render-cards.mjs it also writes each tile with its text made transparent
// and the text boxes, so card-contrast.py measures every line against the real
// ground behind it.
//   node --experimental-websocket render-tiles.mjs <repo> <pkg> <bg.png> <shots-dir> <out-dir>
// <shots-dir> holds the listing frames captured from the PACKAGED build
// (tools/capture-screenshots.mjs), e.g. store-assets/2.2.0.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, BG, SHOTS, OUT] = process.argv.slice(2).map((p) => path.resolve(p));
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
fs.mkdirSync(OUT, { recursive: true });
// The work folder: the page, its font, the backdrop, the frames.
const WORK = path.join(OUT, "_work");
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(path.join(WORK, "shots"), { recursive: true });
fs.copyFileSync(path.join(HERE, "tiles.html"), path.join(WORK, "tiles.html"));
fs.cpSync(path.join(REPO, "fonts"), path.join(WORK, "fonts"), { recursive: true });
fs.copyFileSync(BG, path.join(WORK, "bg.png"));
for (const f of ["01-home-grid.png", "02-tasks-and-notes.png"]) fs.copyFileSync(path.join(SHOTS, f), path.join(WORK, "shots", f));
const types = { ".html": "text/html", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const p = path.join(WORK, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(WORK) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const base = `http://127.0.0.1:${server.address().port}/tiles.html`;
const TILES = [["small-tile-440x280", "small", 440, 280], ["marquee-tile-1400x560", "marquee", 1400, 560]];
const b = await launch({ repo: REPO, ext: PKG, port: 9886, profile: path.join(REPO, ".scratch-profile-tiles"), dpr: 1, width: 1400, height: 800 });
const report = {};
try {
  const tab = await b.open("about:blank");
  const shoot = async (file, w, h) => { const s = await tab.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }); fs.writeFileSync(path.join(OUT, file), Buffer.from(s.result.data, "base64")); };
  for (const [name, t, w, h] of TILES) {
    await tab.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await tab.send("Page.navigate", { url: `${base}?tile=${t}` }); await sleep(900);
    const ready = await tab.ev("window.ready");
    await shoot(`${name}.raw.png`, w, h);
    report[name] = { ready, boxes: await tab.ev("window.inkBoxes()") };
    await tab.ev(`document.querySelectorAll('[data-ink]').forEach(e => { e.style.color = 'transparent'; e.style.textShadow = 'none'; e.querySelectorAll('*').forEach(c => { c.style.color = 'transparent'; c.style.borderColor = 'transparent'; }); }); document.querySelectorAll('[data-ink] svg').forEach(s => s.style.visibility = 'hidden')`);
    await shoot(`${name}.ground.png`, w, h);
  }
  report.errors = tab.errors;
} finally { await b.close(); server.close(); fs.rmSync(path.join(REPO, ".scratch-profile-tiles"), { recursive: true, force: true }); }
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
// 24-bit, no alpha: flatten with Pillow and say what came out.
for (const [name, , w, h] of TILES) {
  const py = `from PIL import Image\nim=Image.open(r"${path.join(OUT, name + ".raw.png")}").convert("RGB")\nassert im.size==(${w},${h}), im.size\nim.save(r"${path.join(OUT, name + ".png")}", optimize=True)\nprint(Image.open(r"${path.join(OUT, name + ".png")}").mode, im.size)`;
  console.log(name, execFileSync("python", ["-I", "-c", py], { encoding: "utf8" }).trim());
  fs.rmSync(path.join(OUT, name + ".raw.png"));
}
fs.rmSync(WORK, { recursive: true, force: true });
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v && v.boxes ? { ready: v.ready, lines: v.boxes.length } : v]))));
