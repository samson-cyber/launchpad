// Serve the footage folder on localhost, open compositor.html in a scratch
// headless Edge, render a spec to WebM, and write it out.
//   node --experimental-websocket render.mjs <repo> <pkg> <spec.json> <out.webm>
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./lib.mjs";
const [REPO, PKG, SPEC, OUT] = process.argv.slice(2);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "video/webm", ".mp4": "video/mp4", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
const b = await launch({ repo: REPO, ext: PKG, port: 9861, profile: path.join(REPO, ".scratch-profile-footage-render"), dpr: 1 });
try {
  const tab = await b.open(`${base}/compositor.html`);
  await tab.send("Emulation.setDeviceMetricsOverride", { width: spec.w, height: spec.h, deviceScaleFactor: 1, mobile: false });
  await sleep(1200);
  const r = await tab.ev(`window.render(${JSON.stringify(spec)})`, 15 * 60 * 1000);
  fs.writeFileSync(OUT, Buffer.from(r.b64, "base64"));
  console.log(JSON.stringify({ out: OUT, bytes: r.bytes, frames: r.frames, errors: tab.errors }));
} finally { await b.close(); server.close(); }
process.exit(0);
