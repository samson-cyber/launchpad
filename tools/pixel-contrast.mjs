#!/usr/bin/env node
// ===========================================================================
// PIXEL CONTRAST - composited contrast measured from the SCREEN, not from CSS.
//
// WHY THIS IS A FILE. [1.11.3d] built exactly this, used it to find a declared
// 0.46 alpha rendering as 2.84:1 because thin strokes never reach their
// declared alpha, and never committed it - it lived in that round's scratchpad
// and went with it. The 2026-09-15 ink round had to rebuild it from scratch to
// answer two tasks that had been open since 1218312944568543 was filed. That
// is twice the same instrument has been needed and once it has been lost, so
// it lives here now.
//
// WHAT IT DOES THAT tools/ink-ratio.mjs CANNOT. ink-ratio composites DECLARED
// colours and is the right tool when the stack is known. It cannot see a
// text-shadow, a backdrop-filter, a drop-shadow filter, a photograph behind
// 85%-opaque glass, or a hairline that never reaches its declared alpha. Those
// are precisely the cases this product is made of.
//
// THE METHOD (BUGS I13): capture the frame with the element painted, then again
// with it `visibility: hidden` - which removes the paint without moving layout -
// and diff the two inside the element's own box. Changed pixels are the
// element's real composited ink; the same pixels in the hidden frame are the
// real backdrop. WCAG-contrast the two.
//
// ANTI-ALIASING drags both extremes together, biasing the result DOWNWARD,
// which is the safe direction to be wrong.
//
// THE NEGATIVE CONTROL THAT MATTERS, and it is not the obvious one: force the
// element to its OWN measured backdrop and re-measure. A working sampler then
// finds almost no changed pixels and says so; a sampler that is really keying
// on noise, or on its neighbours, keeps returning a number. `--self-test`
// asserts that, and asserts a known pair in both directions.
//
//   node tools/pixel-contrast.mjs --self-test
//
// Callers drive the browser themselves and pass PNG buffers - this file does no
// CDP, so it stays usable from any harness.
// ===========================================================================
import zlib from "node:zlib";

export function relLum(r, g, b) {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function ratio(a, b) {
  const l1 = relLum(...a), l2 = relLum(...b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Minimal PNG reader: enough for Chrome's own 8-bit RGBA / RGB output.
export function decodePNG(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const depth = buf[24], color = buf[25];
  if (depth !== 8 || (color !== 6 && color !== 2)) {
    throw new Error(`unsupported PNG: depth=${depth} colorType=${color}`);
  }
  const ch = color === 6 ? 4 : 3;
  let idat = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    if (type === "IDAT") idat.push(buf.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * ch);
  const stride = w * ch;
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.slice(rp, rp + stride); rp += stride;
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

// The measurement. `box` is the element's viewport rect in CSS px; `scale` maps
// it to device pixels.
export function measure(paintedBuf, hiddenBuf, box, scale = 1) {
  const A = decodePNG(paintedBuf), B = decodePNG(hiddenBuf);
  const x0 = Math.max(0, Math.round(box.x * scale)), y0 = Math.max(0, Math.round(box.y * scale));
  const x1 = Math.min(A.w, Math.round((box.x + box.width) * scale));
  const y1 = Math.min(A.h, Math.round((box.y + box.height) * scale));
  const diffs = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * A.w + x) * A.ch, j = (y * B.w + x) * B.ch;
      const d = Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1])
              + Math.abs(A.data[i + 2] - B.data[j + 2]);
      // 24 of 765 - enough to reject compression noise, low enough to keep
      // genuinely faint strokes, which are the ones that matter here.
      if (d > 24) diffs.push({ d, ink: [A.data[i], A.data[i + 1], A.data[i + 2]],
                               bg: [B.data[j], B.data[j + 1], B.data[j + 2]] });
    }
  }
  if (diffs.length < 6) return { pixels: diffs.length, ratio: null, note: "too few changed pixels" };
  // The most-changed pixels are the element at full strength; anti-aliased
  // edges are the weak tail and would flatter the result if averaged in.
  diffs.sort((p, q) => q.d - p.d);
  const core = diffs.slice(0, Math.max(6, Math.floor(diffs.length * 0.2)));
  const avg = (arr, k) => arr.reduce((s, p) => s + p[k][0], 0) / arr.length;
  const mean = (k) => [0, 1, 2].map((c) => Math.round(core.reduce((s, p) => s + p[k][c], 0) / core.length));
  const ink = mean("ink"), bg = mean("bg");
  return { pixels: diffs.length, ink, bg, ratio: Math.round(ratio(ink, bg) * 100) / 100 };
}


// ---------------------------------------------------------------- self-test
function synth(w, h, px) {
  // A tiny uncompressed-ish PNG built through zlib, so the decoder above is
  // exercised by real deflate output rather than a hand-rolled stream.
  const ch = 3, stride = w * ch;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = px(x, y), o = y * (stride + 1) + 1 + x * ch;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const idat = zlib.deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "ascii");
    const crcBuf = Buffer.concat([t, data]);
    let c = ~0;
    for (let i = 0; i < crcBuf.length; i++) {
      c ^= crcBuf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    const crc = Buffer.alloc(4); crc.writeUInt32BE((~c) >>> 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (process.argv.includes("--self-test")) {
  let pass = 0, fail = 0;
  const chk = (name, ok, extra) => {
    (ok ? pass++ : fail++);
    console.log("  " + (ok ? "PASS  " : "FAIL  ") + name + (extra ? "   << " + extra : ""));
  };
  const BOX = { x: 0, y: 0, width: 20, height: 20 };
  const WHITE = [255, 255, 255], BLACK = [0, 0, 0], GREY = [119, 119, 119];

  // 1. Black on white is 21:1, the maximum. Both directions of the same pair.
  const onWhite = synth(20, 20, (x, y) => (y > 4 && y < 15 ? BLACK : WHITE));
  const bare = synth(20, 20, () => WHITE);
  const m1 = measure(onWhite, bare, BOX);
  chk("black ink on white reads ~21:1", m1.ratio > 20.5, m1.ratio + ":1");

  const onBlack = synth(20, 20, (x, y) => (y > 4 && y < 15 ? WHITE : BLACK));
  const bareB = synth(20, 20, () => BLACK);
  const m2 = measure(onBlack, bareB, BOX);
  chk("white ink on black reads the same ~21:1", m2.ratio > 20.5, m2.ratio + ":1");

  // 2. A mid grey on white is a KNOWN low number, not merely "lower".
  const m3 = measure(synth(20, 20, (x, y) => (y > 4 && y < 15 ? GREY : WHITE)), bare, BOX);
  chk("mid grey on white lands near 4.5:1", m3.ratio > 4.0 && m3.ratio < 5.2, m3.ratio + ":1");

  // 3. THE NEGATIVE CONTROL. An element painted in its own backdrop colour
  //    leaves nothing to diff, and the instrument must SAY so rather than
  //    return a comfortable number from noise.
  const m4 = measure(bare, bare, BOX);
  chk("an element forced to its own backdrop reports no measurement",
    m4.ratio === null, m4.note || String(m4.ratio));

  // 4. And a false-pass guard: a box that does not overlap the element must
  //    also report nothing rather than sampling its neighbours.
  const m5 = measure(onWhite, bare, { x: 0, y: 16, width: 20, height: 4 });
  chk("a box outside the painted region reports no measurement",
    m5.ratio === null, m5.note || String(m5.ratio));

  console.log(`
  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
