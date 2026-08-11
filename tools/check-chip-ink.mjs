#!/usr/bin/env node
// Suite for [2.0] chip ink — the ink a chip paints on a colour fill.
// Asana 1217358651953106.
//
// WHY THIS ONE IS ARITHMETIC AND NOT A BROWSER MEASUREMENT. Every other ink rule
// in this product has to be measured live, because the surface underneath is a
// translucent frosted card over an arbitrary wallpaper and no static analysis can
// know what that composites to (BUGS.md O1). A chip is the exception: its fill is
// OPAQUE, so the ink-versus-fill ratio is identical on the default frame, on a
// dark photo, on a bright photo and on a light solid. That makes the whole rule
// provable from the source, on every fill the product can produce, in 0.1s —
// which is strictly better coverage than four browser frames on the two or three
// chips that happen to be mounted when the harness runs.
//
// WHAT IT GUARDS. The shipped chooser used Rec 601 brightness with a 0.55
// threshold. Rec 601 is not WCAG relative luminance — it skips the sRGB transfer
// function — and the two disagree most in the middle of the range, where chip
// palettes live. #4A90E2, the FIRST colour in both the tag palette and the
// workspace palette, scored 0.519, took white ink, and measured 3.29:1. Five of
// nineteen fills failed the same way. The regression this suite exists to catch
// is any return to a threshold, and any new chip that paints text on a fill
// without going through the one chooser.
//
// Usage: node tools/check-chip-ink.mjs [repoRoot] [--mutate] [--table]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
const MUTATE = process.argv.includes("--mutate");
const TABLE = process.argv.includes("--table");
const clone = (v) => JSON.parse(JSON.stringify(v));

// core.autocrlf=true -> CRLF in the working tree; normalize before slicing (M).
const rd = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

let SRC;
try {
  SRC = { nt: rd("newtab.js"), css: rd("newtab.css"), storage: rd("storage.js") };
} catch (e) {
  console.error(`CHIP INK: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Load the REAL chooser out of newtab.js.
// ---------------------------------------------------------------------------
// One contiguous slice rather than eight per-function extractions: the block is
// the unit that has to stay coherent (the helpers, the two tuned constants and
// the chooser), and slicing it whole means a constant cannot be silently left
// behind. Both anchors are occurrence-counted (Q2) — a slice that lands nowhere,
// or spans the wrong region, reads as a result and is not one.
function sliceChooser(src) {
  const START = "\n  // Parses #rgb and #rrggbb, with or without the leading #.";
  const END = "\n  // Date input <-> epoch ms helpers.";
  const ns = src.split(START).length - 1;
  const ne = src.split(END).length - 1;
  if (ns !== 1) throw new Error(`chooser START anchor matched ${ns} times (want 1)`);
  if (ne !== 1) throw new Error(`chooser END anchor matched ${ne} times (want 1)`);
  const a = src.indexOf(START), b = src.indexOf(END);
  if (b <= a) throw new Error("chooser anchors are out of order");
  const block = src.slice(a, b);
  for (const need of ["function hexToRgb", "function srgbToLinear", "function relativeLuminance",
                      "function contrastRatio", "function rgbToHsl", "function hslToHex",
                      "function chipDarkInkFor", "function tagTextColorFor",
                      "CHIP_INK_LIGHTNESS", "CHIP_INK_MAX_SATURATION"]) {
    if (!block.includes(need)) throw new Error(`chooser slice is missing ${need}`);
  }
  return block;
}

// The WORKSPACE palette lives in the page; the TAG palette lives in storage.js
// and is driven through its REAL accessor below rather than restated here.
function sliceWorkspacePalette(src) {
  const A = "\n  var WORKSPACE_PALETTE = [";
  const n = src.split(A).length - 1;
  if (n !== 1) throw new Error(`WORKSPACE_PALETTE anchor matched ${n} times (want 1)`);
  const a = src.indexOf(A);
  const b = src.indexOf("];", a);
  if (b === -1) throw new Error("WORKSPACE_PALETTE is unterminated");
  return src.slice(a, b + 2);
}

function bootChooser(src) {
  const ctx = { Math, JSON, String, Number, Array, Object, parseInt, parseFloat, console: { log() {}, warn() {}, error() {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    `(function(){ ${sliceChooser(src.nt)} \n ${sliceWorkspacePalette(src.nt)} \n` +
    ` globalThis.tagTextColorFor = tagTextColorFor;` +
    ` globalThis.contrastRatio = contrastRatio;` +
    ` globalThis.relativeLuminance = relativeLuminance;` +
    ` globalThis.chipDarkInkFor = chipDarkInkFor;` +
    ` globalThis.hexToRgb = hexToRgb;` +
    ` globalThis.WORKSPACE_PALETTE = WORKSPACE_PALETTE;` +
    ` globalThis.CHIP_INK_LIGHTNESS = CHIP_INK_LIGHTNESS; })();`,
    ctx, { filename: "newtab.js#chip-ink" }
  );
  return ctx;
}

// The tag palette, produced by storage.js's own rotation accessor — so a change
// to the palette is picked up here without this file knowing the colours.
function bootStoragePalette(src) {
  const store = {};
  const ctx = {
    chrome: {
      storage: {
        local: {
          async get(k) { if (typeof k === "string") { const o = {}; if (k in store) o[k] = clone(store[k]); return o; } return clone(store); },
          async set(o) { for (const [k, v] of Object.entries(o)) store[k] = clone(v); },
          async remove(k) { delete store[k]; },
        },
        onChanged: { addListener() {} },
      },
      runtime: { lastError: null, getManifest: () => ({ version: "0.0.0" }) },
      alarms: { create() {}, get: async () => null, clear: async () => true, onAlarm: { addListener() {} } },
    },
    console: { log() {}, warn() {}, error() {} },
    Date, Math, JSON, URL, Promise, Set, Map, Object, Array, String, Number, Boolean,
    isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src.storage, ctx, { filename: "storage.js" });
  if (!ctx.Storage || typeof ctx.Storage.nextAutoTagColor !== "function") {
    throw new Error("Storage.nextAutoTagColor missing");
  }
  // Walk the rotation by handing it workspaces with n auto-tags already present.
  const colors = [];
  for (let n = 0; n < 24; n++) {
    const ws = { id: "w", tags: [] };
    for (let i = 0; i < n; i++) ws.tags.push({ id: "t" + i, autoGeneratedFromGoalId: "g" + i });
    colors.push(ctx.Storage.nextAutoTagColor(ws));
  }
  // The rotation is cyclic; the distinct prefix IS the palette.
  const seen = [];
  for (const c of colors) { if (seen.includes(c)) break; seen.push(c); }
  if (seen.length < 4) throw new Error(`tag palette came back as ${seen.length} colours — the accessor is not rotating`);
  return seen;
}

let C, TAG_PALETTE;
try {
  C = bootChooser(SRC);
  TAG_PALETTE = bootStoragePalette(SRC);
} catch (err) {
  console.error(`CHIP INK: SUBJECT DID NOT LOAD — ${err && err.message}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Assertions.
// ---------------------------------------------------------------------------
const rows = [];
const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail: String(detail) });
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const FLOOR = 4.5;
// Two accent fills that are not in either palette but do appear as chip fills:
// the tag editor's fallback colour, and the accent the Pro surfaces use.
const EXTRA_FILLS = ["#6fb1ff", "#8ab4f8"];
const ALL_FILLS = TAG_PALETTE.concat(C.WORKSPACE_PALETTE).concat(EXTRA_FILLS);

// ---- the contrast maths itself, against known-good reference values --------
// If relativeLuminance is wrong, every ratio below is wrong in a way that still
// looks like a number — so it is pinned to values that can be checked by hand.
check("luminance: black is 0", C.relativeLuminance("#000000") === 0, String(C.relativeLuminance("#000000")));
check("luminance: white is 1", Math.abs(C.relativeLuminance("#ffffff") - 1) < 1e-9, String(C.relativeLuminance("#ffffff")));
check("contrast: black on white is exactly 21:1", Math.abs(C.contrastRatio("#000000", "#ffffff") - 21) < 1e-9, String(C.contrastRatio("#000000", "#ffffff")));
check("contrast: a colour against itself is 1:1", Math.abs(C.contrastRatio("#4A90E2", "#4A90E2") - 1) < 1e-9);
check("contrast: symmetric in its arguments",
  Math.abs(C.contrastRatio("#4A90E2", "#ffffff") - C.contrastRatio("#ffffff", "#4A90E2")) < 1e-12);
// The gamma step is the whole point of the change: mid-grey's WCAG luminance is
// ~0.216, NOT the ~0.5 a linear/Rec-601 formula reports. This one row is what
// fails if anyone reintroduces the un-linearised brightness.
check("luminance: #808080 is ~0.2159 (the sRGB transfer function is applied)",
  Math.abs(C.relativeLuminance("#808080") - 0.21586) < 0.0005, String(C.relativeLuminance("#808080")));

// ---- THE HEADLINE: every fill the product can produce clears the floor -----
const table = [];
for (const fill of ALL_FILLS) {
  const ink = C.tagTextColorFor(fill);
  const r = C.contrastRatio(fill, ink);
  table.push({ fill, ink, ratio: +r.toFixed(2), dark: ink !== "#ffffff" });
  check(`fill ${fill}: chosen ink clears ${FLOOR}:1`, r >= FLOOR, `${ink} gives ${r.toFixed(2)}`);
}
check("palette: the tag palette came through storage's own rotation",
  TAG_PALETTE.length >= 8 && TAG_PALETTE[0] === "#4A90E2", JSON.stringify(TAG_PALETTE));
check("palette: the workspace palette came through the page's own constant",
  C.WORKSPACE_PALETTE.length >= 8, JSON.stringify(C.WORKSPACE_PALETTE));
// P2 anti-vacuity: if either palette collapsed to nothing, every loop above
// would pass by inspecting an empty set.
check("palette: the fill set under test is not empty", ALL_FILLS.length >= 18, `${ALL_FILLS.length} fills`);

// ---- the specific regression that started this round ----------------------
// #4A90E2 is the first entry in BOTH palettes, so it is the chip on almost every
// user's first goal and first workspace. It is the fill that was wrong.
{
  const ink = C.tagTextColorFor("#4A90E2");
  check("#4A90E2 (first tag AND first workspace colour) now takes DARK ink", ink !== "#ffffff", ink);
  check("#4A90E2: and the old white ink is demonstrably worse",
    C.contrastRatio("#4A90E2", ink) > C.contrastRatio("#4A90E2", "#ffffff"),
    `${C.contrastRatio("#4A90E2", ink).toFixed(2)} vs white ${C.contrastRatio("#4A90E2", "#ffffff").toFixed(2)}`);
  check("#4A90E2: white ink really did fail the floor (the defect was real)",
    C.contrastRatio("#4A90E2", "#ffffff") < FLOOR, C.contrastRatio("#4A90E2", "#ffffff").toFixed(2));
}

// ---- the chooser is a MAXIMISER, not a threshold --------------------------
// The property that makes it correct for arbitrary user colour is that it never
// returns the worse of the two inks. Swept across the whole cube rather than the
// palettes alone, because a user can type any hex into the tag editor.
{
  let worse = 0, worst = Infinity, worstFill = "", checked = 0;
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const fill = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        const ink = C.tagTextColorFor(fill);
        const other = ink === "#ffffff" ? C.chipDarkInkFor(fill) : "#ffffff";
        const got = C.contrastRatio(fill, ink);
        if (got < C.contrastRatio(fill, other) - 1e-9) worse++;
        if (got < worst) { worst = got; worstFill = fill; }
        checked++;
      }
    }
  }
  check(`maximiser: never returns the worse ink (${checked} fills swept)`, worse === 0, `${worse} fills got the worse ink`);
  check("maximiser: the sweep actually ran", checked === 16 * 16 * 16, String(checked));
  // A full-cube floor is NOT claimed: mid-luminance greys are the classic case
  // where neither black nor white clears 4.5, and a user is free to pick one.
  // What IS claimed is that the product's own palettes clear it, and that a
  // user-picked fill never gets the worse of the two inks. Recorded so the gap
  // is a stated limit rather than an unnoticed one.
  check("maximiser: the worst fill in the whole cube is recorded, not hidden",
    worst > 1 && worstFill.length === 7, `worst ${worst.toFixed(2)} at ${worstFill}`);
}

// ---- the dark candidate follows the gold precedent ------------------------
check("dark ink: hue-matched, not neutral grey — #ffd66e yields a warm dark",
  (() => { const d = C.chipDarkInkFor("#ffd66e"); const rgb = C.hexToRgb(d); return rgb[0] > rgb[2]; })(),
  C.chipDarkInkFor("#ffd66e"));
check("dark ink: a blue fill yields a cool dark",
  (() => { const d = C.chipDarkInkFor("#4A90E2"); const rgb = C.hexToRgb(d); return rgb[2] > rgb[0]; })(),
  C.chipDarkInkFor("#4A90E2"));
check("dark ink: the tuned lightness is the derived 0.08, not the failing 0.12",
  C.CHIP_INK_LIGHTNESS === 0.08, String(C.CHIP_INK_LIGHTNESS));
check("dark ink: a pure grey fill still produces a usable near-black",
  C.contrastRatio("#cccccc", C.chipDarkInkFor("#cccccc")) > 10, C.chipDarkInkFor("#cccccc"));

// ---- degenerate fills -----------------------------------------------------
// An unparseable fill means the inline background did not apply either, so the
// element falls back to its CSS class — which is dark. White is the ink that
// matches that, and it is what the previous chooser returned too.
eq("degenerate: null fill falls back to white", C.tagTextColorFor(null), "#ffffff");
eq("degenerate: a non-hex string falls back to white", C.tagTextColorFor("rebeccapurple"), "#ffffff");
eq("degenerate: a truncated hex falls back to white", C.tagTextColorFor("#12"), "#ffffff");
eq("degenerate: undefined falls back to white", C.tagTextColorFor(undefined), "#ffffff");
check("degenerate: 3-digit shorthand IS parsed, not rejected", C.tagTextColorFor("#fff") !== "#ffffff", C.tagTextColorFor("#fff"));
check("degenerate: a bare hex without # is parsed", C.hexToRgb("4A90E2") !== null);

// ---- EVERY chip render site goes through the one chooser ------------------
// The failure this catches is a NEW chip that paints text on a fill and sets ink
// by hand — which is how the product ended up with two answers in the first
// place. Any inline `background:` carrying a runtime colour must be accompanied
// by a `color:` from the chooser, or be a swatch with no text in it.
{
  // Colour blocks with NO glyph on them: selection is a border, not a mark, so
  // there is no ink to choose. Verified by reading each one — an empty <button>
  // or <span> whose only job is to be the colour. (Their SELECTED ring is ink on
  // the fill and is covered separately below.)
  const SWATCH_ONLY = ["tag-submenu-swatch", "pp-donut-legend-swatch",
                       "pro-tag-color-swatch", "pro-tag-swatch"];
  const lines = SRC.nt.split("\n");
  const offenders = [];
  lines.forEach((line, i) => {
    if (!/style="background:'\s*\+/.test(line)) return;
    if (SWATCH_ONLY.some((c) => line.includes(c))) return;   // a colour block with no glyph on it
    if (line.includes("tagTextColorFor(")) return;
    offenders.push(`${i + 1}: ${line.trim().slice(0, 100)}`);
  });
  check("render sites: every text-bearing colour fill sets ink from the chooser",
    offenders.length === 0, offenders.join(" | "));
  const sites = (SRC.nt.match(/tagTextColorFor\(/g) || []).length;
  // 7 call sites + the declaration. A floor, not an equality: adding a chip is
  // allowed, silently dropping one is not.
  check("render sites: the chooser has at least its seven call sites", sites >= 8, `${sites} occurrences`);
}
for (const cls of ["tt-tag-pill", "pp-tag-pill", "tag-pill", "sb-ws-chip", "pws-chip"]) {
  const re = new RegExp(`class="[^"]*${cls}[^"]*"[^\\n]*style="background:`);
  const rendered = re.test(SRC.nt) || SRC.nt.includes(`.${cls}`);
  check(`render sites: ${cls} is still a real, rendered chip`, rendered);
}

// ---- the SELECTED-swatch ring: ink on the fill by another name ------------
// A 2px white ring on #F8E71C measures 1.28:1 against the swatch it marks. Four
// of the eight palette colours failed the 3:1 non-text floor, and on a light
// wallpaper the panel is white glass so the ring lost its outer edge too.
{
  const RING_FLOOR = 3;
  let worstRing = Infinity, worstFill = "";
  for (const fill of TAG_PALETTE) {
    const ink = C.tagTextColorFor(fill);
    const r = C.contrastRatio(fill, ink);
    if (r < worstRing) { worstRing = r; worstFill = fill; }
  }
  check(`ring: the derived ink clears the ${RING_FLOOR}:1 non-text floor on every palette fill`,
    worstRing >= RING_FLOOR, `worst ${worstRing.toFixed(2)} at ${worstFill}`);
  check("ring: white would have failed — the defect was real",
    TAG_PALETTE.some((f) => C.contrastRatio(f, "#ffffff") < RING_FLOOR),
    JSON.stringify(TAG_PALETTE.map((f) => f + "=" + C.contrastRatio(f, "#ffffff").toFixed(2))));
  check("ring: both swatch render sites carry --swatch-ink from the chooser",
    (SRC.nt.match(/--swatch-ink:' \+ tagTextColorFor\(/g) || []).length === 2,
    String((SRC.nt.match(/--swatch-ink:/g) || []).length));
  // A var, not an inline border-color — an inline declaration would beat :hover
  // and silently remove the hover affordance.
  check("ring: consumed as a CSS var so :hover still wins",
    /\.pro-tag-swatch\.selected \{[^}]*border-color: var\(--swatch-ink, #fff\);/.test(SRC.css));
  check("ring: the hover rule is still there to win",
    /\.pro-tag-swatch:hover \{[^}]*border-color:/.test(SRC.css));
}

// ---- the PRIORITY chips: same doctrine, same arithmetic -------------------
// Priority pills stopped being tinted outlines this round and became real chips:
// opaque fill, ink derived against it. Which means their ratios are provable
// here rather than measurable only in a browser — the fill is opaque, so the
// number is identical on all four frames. Both halves are read out of the CSS,
// so a change to either the palette variable or the pinned ink is caught.
{
  const cssVar = (name) => {
    const m = SRC.css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    return m && m[1];
  };
  const rule = (cls) => {
    const m = SRC.css.match(new RegExp(`\\.tt-prio-pill\\.tt-prio-${cls}\\s*\\{([^}]*)\\}`));
    if (!m) return null;
    const color = m[1].match(/color:\s*(#[0-9a-fA-F]{6})/);
    const bg = m[1].match(/background:\s*var\(--prio-([a-z]+)\)/);
    return color && bg ? { ink: color[1], fillVar: bg[1] } : null;
  };
  const PRIOS = ["urgent", "high", "medium", "low"];
  let checked = 0;
  for (const p of PRIOS) {
    const r = rule(p);
    if (!r) { check(`priority ${p}: chip rule parses (opaque fill + pinned ink)`, false, "rule not found or not a chip"); continue; }
    const fill = cssVar("prio-" + r.fillVar);
    if (!fill) { check(`priority ${p}: --prio-${r.fillVar} resolves`, false); continue; }
    const got = C.contrastRatio(fill, r.ink);
    check(`priority ${p}: ${fill} on ${r.ink} clears ${FLOOR}:1`, got >= FLOOR, got.toFixed(2));
    // The pinned ink must still be what the ONE chooser would produce — the
    // whole point of pinning it in CSS is that it is the chooser's answer, not
    // a hand-picked colour that happens to pass today.
    check(`priority ${p}: the pinned ink IS the chooser's own output`,
      C.tagTextColorFor(fill).toLowerCase() === r.ink.toLowerCase(),
      `css ${r.ink} vs chooser ${C.tagTextColorFor(fill)}`);
    checked++;
  }
  check("priority: all four priorities were inspected (anti-vacuity)", checked === 4, `${checked} of 4`);
  // The unset pill stays a quiet outline and must NOT be given a fill — that is
  // the whole distinction between "no priority" and "priority set".
  check("priority: the UNSET pill is still a transparent outline, not a chip",
    /\.tt-prio-pill \{[^}]*background: transparent;/.test(SRC.css));
}

// ---- the PROGRESS % label: the dual-layer clip contract --------------------
// This one needed no colour change: the widget was already correct, and the
// 1.72:1 that put it on the list was a MEASUREMENT artifact — the DOM-composite
// harness reads backgroundColor, which is transparent for a gradient-backed
// element, so it scored the in-fill copy against the track behind the bar. The
// pixel-diff harness reports 7.68-7.80.
//
// So what is guarded here is the DESIGN, not a number: two copies with opposing
// inks, each revealed only over the region it contrasts. Collapse it to a single
// static ink and no ink can clear both halves of the bar — which is exactly the
// regression this section exists to fail.
{
  const grad = SRC.css.match(/\.tt-progress-fill \{[^}]*background: linear-gradient\(90deg,\s*(#[0-9a-fA-F]{6})[^,]*,\s*(#[0-9a-fA-F]{6})/);
  check("progress: the fill is still a two-stop gradient", !!grad, grad ? grad.slice(1, 3).join(" -> ") : "not found");
  const baseInk = SRC.css.match(/\.tt-progress-pct-base \{[^}]*color:\s*(rgba?\([^)]*\))/);
  const fillInk = SRC.css.match(/\.tt-progress-pct-fill \{[^}]*color:\s*(rgba?\([^)]*\))/);
  check("progress: BOTH copies exist and declare their own ink", !!baseInk && !!fillInk,
    `${baseInk && baseInk[1]} / ${fillInk && fillInk[1]}`);
  if (grad && fillInk) {
    // The in-fill copy sits on the gradient, which is opaque — so its ratio is
    // derivable at both ends of the sweep, and both ends have to clear.
    const m = fillInk[1].match(/[\d.]+/g).map(Number);
    const a = m.length > 3 ? m[3] : 1;
    for (const stop of [grad[1], grad[2]]) {
      const bg = C.hexToRgb(stop);
      const comp = "#" + [0, 1, 2].map((i) => Math.round(m[i] * a + bg[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
      const got = C.contrastRatio(stop, comp);
      check(`progress: the in-fill % clears ${FLOOR}:1 on gradient stop ${stop}`, got >= FLOOR, got.toFixed(2));
    }
  }
  if (baseInk && fillInk) {
    // Opposing inks are the mechanism. Same-side inks mean one region is unread.
    const L = (c) => { const m = c.match(/[\d.]+/g).map(Number); return C.relativeLuminance(
      "#" + [0, 1, 2].map((i) => Math.round(m[i]).toString(16).padStart(2, "0")).join("")); };
    check("progress: the two copies sit on OPPOSITE sides of the ink range",
      (L(baseInk[1]) > 0.5) !== (L(fillInk[1]) > 0.5), `${baseInk[1]} / ${fillInk[1]}`);
  }
  check("progress: the markup still emits both copies",
    /tt-progress-pct-base/.test(SRC.nt) && /tt-progress-pct-fill/.test(SRC.nt));
  check("progress: the fill still CLIPS its copy (the reveal mechanism)",
    /\.tt-progress-fill \{[^}]*overflow: hidden;/.test(SRC.css));
}

// ---- the due-date icon must stay ink-reachable ----------------------------
// It was a colour emoji, whose pixels come from the font's own bitmap and ignore
// `color` on every frame — 2.86:1 and immovable. The U+FE0E text-presentation
// selector was tried and measured: still fixed-colour. An inline SVG on
// currentColor is what actually made it inherit the pill's ink.
check("due icon: rendered as an inline SVG, not a colour emoji",
  /CALENDAR_SVG/.test(SRC.nt) && !/tt-due-icon" aria-hidden="true">🗓/.test(SRC.nt));
check("due icon: the SVG takes currentColor, so the pill's ink reaches it",
  /var CALENDAR_SVG[^\n]*stroke="currentColor"/.test(SRC.nt));
check("due icon: sized in em, so the existing font-size rules still own its size",
  /var CALENDAR_SVG[^\n]*width="1em" height="1em"/.test(SRC.nt));

// ---- CSS: the ring that a dark ink cannot carry ---------------------------
check("css: .pp-tag-pill no longer paints a dark ring under a dark ink",
  /\.pp-tag-pill \{[^}]*text-shadow: none;/.test(SRC.css));
check("css: .tt-tag-pill is unchanged in that respect",
  /\.tt-tag-pill \{[^}]*text-shadow: none;/.test(SRC.css));
// The retired placeholder, deleted rather than "fixed" — see the CSS note.
check("css: the dead .insights-soon rules are gone", !/\n\.insights-soon \{/.test(SRC.css));
check("css: ...and nothing renders the class", !/insights-soon/.test(SRC.nt.replace(/\/\/[^\n]*/g, "")));

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
if (TABLE || !MUTATE) {
  console.log("\nCHIP INK — ink on every fill the product can produce\n");
}
if (TABLE) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log("  " + pad("fill", 12) + pad("ink", 12) + pad("ratio", 8) + "kind");
  for (const t of table) console.log("  " + pad(t.fill, 12) + pad(t.ink, 12) + pad(t.ratio, 8) + (t.dark ? "dark (hue-matched)" : "white"));
  console.log();
}
if (!MUTATE) {
  for (const r of rows) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
    r.pass ? pass++ : fail++;
  }
} else {
  for (const r of rows) { r.pass ? pass++ : fail++; }
}

const MIN = 35;
if (!MUTATE && rows.length < MIN) {
  console.log(`\nCHIP INK: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
if (!MUTATE) {
  console.log(`\nCHIP INK: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --mutate (P3). Faithful seeds only (Q3): each one changes the CHOICE the
// chooser makes and leaves it running. Anchors occurrence-counted (Q2).
// ---------------------------------------------------------------------------
import { spawnSync } from "node:child_process";
import os from "node:os";

console.log("\nCHIP INK — mutation seeding\n");

const SEEDS = [
  // The exact defect this round fixed: back to a Rec-601 threshold.
  { name: "chooser: back to the Rec-601 brightness threshold (the shipped defect)",
    file: "nt",
    from: "    if (!hexToRgb(hex)) return CHIP_INK_LIGHT;\n    var dark = chipDarkInkFor(hex);\n    return contrastRatio(hex, dark) >= contrastRatio(hex, CHIP_INK_LIGHT) ? dark : CHIP_INK_LIGHT;",
    to: "    var rgb = hexToRgb(hex);\n    if (!rgb) return CHIP_INK_LIGHT;\n    var b = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;\n    return b > 0.55 ? chipDarkInkFor(hex) : CHIP_INK_LIGHT;" },
  // Always white — the naive "chips are dark" assumption.
  { name: "chooser: always returns white ink",
    file: "nt", from: "? dark : CHIP_INK_LIGHT;", to: "? CHIP_INK_LIGHT : CHIP_INK_LIGHT;" },
  // Always dark — the naive over-correction, which fails on the deep fills.
  { name: "chooser: always returns the dark ink (over-correction)",
    file: "nt", from: "? dark : CHIP_INK_LIGHT;", to: "? dark : dark;" },
  // The tuning that was measured and rejected.
  { name: "dark ink: lightness back to the 0.12 that failed #A569BD",
    file: "nt", from: "var CHIP_INK_LIGHTNESS = 0.08;", to: "var CHIP_INK_LIGHTNESS = 0.12;" },
  // The gamma step removed — luminance silently becomes linear.
  { name: "luminance: sRGB transfer function dropped (Rec-601 by the back door)",
    file: "nt", from: "return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);", to: "return v;" },
  // Neutral grey ink instead of the hue-matched gold precedent.
  { name: "dark ink: neutral grey instead of hue-matched (loses the gold pattern)",
    file: "nt", from: "return hslToHex(hsl[0], Math.min(hsl[1], CHIP_INK_MAX_SATURATION), CHIP_INK_LIGHTNESS);",
    to: "return hslToHex(hsl[0], 0, CHIP_INK_LIGHTNESS);" },
  // A chip that skips the chooser — the drift this round consolidated away.
  // The class name is IN the anchor: the sb-ws-chip and pws-chip lines share an
  // identical tail, so the shorter form matched twice and was reported as an
  // anchor-miss on this seed set's first run (Q2).
  { name: "render site: a workspace chip sets ink by hand again",
    file: "nt", from: "class=\"pws-chip' + (ws.isReadOnly ? ' is-readonly' : '') + '\" style=\"background:' + color + ';color:' + tagTextColorFor(color) + '\">",
    to: "class=\"pws-chip' + (ws.isReadOnly ? ' is-readonly' : '') + '\" style=\"background:' + color + ';color:#fff\">" },
  { name: "ring: the selected swatch goes back to a hardcoded white ring",
    file: "nt", from: "';--swatch-ink:' + tagTextColorFor(color) + '\" data-color=\"'", to: "';--swatch-ink:#fff\" data-color=\"'" },
  // THE PROGRESS-LABEL REGRESSION. The widget needed no colour change — but the
  // thing that makes it correct is the dual-layer clip, and collapsing it to one
  // static ink is the failure mode a future "simplification" would reach for.
  // No single ink clears both halves of the bar, which is why this must fail.
  { name: "progress: dual-layer collapsed to one static ink (the classic straddle bug)",
    file: "css", from: ".tt-progress-pct-fill {\n  width: 100cqw;\n  color: rgba(0, 0, 0, 0.82);\n}",
    to: ".tt-progress-pct-fill {\n  width: 100cqw;\n  color: rgba(255, 255, 255, 0.92);\n}" },
  { name: "progress: the fill stops clipping, so the reveal mechanism dies",
    file: "css", from: ".tt-progress-fill {\n  height: 100%;\n  background: linear-gradient(90deg, #4a90e2 0%, #6fb1ff 100%);\n  transition: width 0.4s ease;\n  overflow: hidden;",
    to: ".tt-progress-fill {\n  height: 100%;\n  background: linear-gradient(90deg, #4a90e2 0%, #6fb1ff 100%);\n  transition: width 0.4s ease;\n  overflow: visible;" },
  // The priority chips regressing to the tinted outline they replaced.
  { name: "priority: back to a translucent tint with the hue as ink",
    file: "css", from: ".tt-prio-pill.tt-prio-urgent { color: #240704; border-color: var(--prio-urgent); background: var(--prio-urgent); }",
    to: ".tt-prio-pill.tt-prio-urgent { color: var(--prio-urgent); border-color: var(--prio-urgent); background: rgba(231, 76, 60, 0.14); }" },
  { name: "priority: ink hand-picked instead of taken from the chooser",
    file: "css", from: ".tt-prio-pill.tt-prio-medium { color: #271f02;", to: ".tt-prio-pill.tt-prio-medium { color: #3a2f03;" },
  // The emoji coming back, which no colour rule can reach.
  { name: "due icon: back to the ink-unreachable colour emoji",
    file: "nt", from: `'<span class="tt-due-icon" aria-hidden="true">' + CALENDAR_SVG + '</span>' +`,
    to: `'<span class="tt-due-icon" aria-hidden="true">\u{1F5D3}</span>' +` },
  // The muddy ring returning under a dark ink.
  { name: "css: .pp-tag-pill paints its dark ring again",
    file: "css", from: "  font-weight: 500;\n  color: #fff;\n  text-shadow: none;", to: "  font-weight: 500;\n  color: #fff;\n  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);" },
];

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lp-chip-mut-"));
function materialize(src) {
  const dir = fs.mkdtempSync(path.join(scratch, "seed-"));
  fs.writeFileSync(path.join(dir, "newtab.js"), src.nt);
  fs.writeFileSync(path.join(dir, "newtab.css"), src.css);
  fs.writeFileSync(path.join(dir, "storage.js"), src.storage);
  return dir;
}
const selfPath = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const runAgainst = (dir) => spawnSync(process.execPath, [selfPath, dir], { encoding: "utf8" });

// CONTROL (Q1): an unloadable subject must report BROKEN and not be scored.
{
  const broken = Object.assign({}, SRC, { nt: SRC.nt.replace("function hexToRgb(hex) {", "function hexToRgb(hex) { (") });
  const r = runAgainst(materialize(broken));
  console.log(`  ${r.status === 2 ? "OK  " : "BAD "} control: an unloadable subject exits 2 (got ${r.status}), and is not scored`);
  if (r.status !== 2) { console.log("\n  the runner cannot distinguish broken from caught — no seed below is meaningful.\n"); process.exit(1); }
}
{
  const r = runAgainst(materialize(SRC));
  console.log(`  ${r.status === 0 ? "OK  " : "BAD "} control: the CLEAN subject passes (exit ${r.status})`);
  if (r.status !== 0) { console.log(r.stdout); process.exit(1); }
}

let caught = 0, escaped = 0, missed = 0;
for (const seed of SEEDS) {
  const hay = SRC[seed.file];
  const n = hay.split(seed.from).length - 1;
  if (n !== 1) { missed++; console.log(`  MISS  ${seed.name}   << anchor matched ${n} times in ${seed.file} (want exactly 1)`); continue; }
  const mutated = Object.assign({}, SRC, { [seed.file]: hay.replace(seed.from, seed.to) });
  const r = runAgainst(materialize(mutated));
  if (r.status === 2) { missed++; console.log(`  MISS  ${seed.name}   << subject did not load (unfaithful seed)`); continue; }
  if (r.status === 1) { caught++; console.log(`  CAUGHT   ${seed.name}`); }
  else { escaped++; console.log(`  ESCAPED  ${seed.name}   << the suite did not notice`); }
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\nMUTATION: ${caught} caught, ${escaped} escaped, ${missed} anchor-miss (of ${SEEDS.length})\n`);
process.exit(escaped || missed ? 1 : 0);
