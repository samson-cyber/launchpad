#!/usr/bin/env node
// ===========================================================================
// SWEEP-INK — the whole-product ink sweep. ENUMERATE every text node on every
// shipped surface, on every ground, and measure all of them, so the
// denominator is visible and the finding is whatever turns up.
//
// WHY THIS IS A FILE, AND IT IS THE SAME ARGUMENT tools/pixel-contrast.mjs
// MAKES ONE LAYER DOWN. That file's header records this project building one
// instrument twice and losing it once: `[1.11.3d]` wrote it into a round's
// scratchpad, the scratchpad went, and the 2026-09-15 ink round rebuilt it
// from nothing. This is the layer ABOVE it, and it was in exactly that
// position: the 2026-09-17 light-ground round (Asana 1218572571448016,
// commit eaa3a69) built it, found 43 light-ground-only failures across 22
// classes when the brief had named 3, and left it in a scratchpad because that
// round's brief was "newtab.css ONLY" and committing a tool was out of scope.
// One more session and it would have been rebuilt from scratch a second time.
//
// WHAT IT DOES THAT pixel-contrast.mjs CANNOT. pixel-contrast measures ONE node
// you already suspect, and it is the right tool when you have a suspect. It has
// no opinion about how many nodes you failed to suspect. This enumerates the
// population first and measures all of it, which is the difference between "the
// three nodes in the brief are fixed" and "every text node on every surface
// meets its floor" — and only the second of those is a claim about the product.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT A BUILD GATE, DECIDED RATHER THAN ASSUMED.
//
// It needs a browser, a compositor (see I30 — headless renders different
// pixels, so this may not go headless), and a seeded Pro profile, and one full
// run is ~5 ground x 6 surface x up to 6 screens of paired screenshots. That is
// minutes, not seconds, and build.sh's gates are seconds. A gate that slow gets
// skipped, and a skipped gate is P2's vacuous gate with a longer runtime.
//
// So it is an ON-DEMAND INSTRUMENT, like tools/seed-fixture.mjs and
// tools/pixel-contrast.mjs: invoked per round, by a round that is touching ink.
// The standing per-build coverage of ink lives where it already lives, in
// tools/check-panel-ink.mjs and tools/check-chip-ink.mjs, which read CSS and
// are cheap. This answers the question those cannot: what did nobody think to
// assert?
//
// THE NAME IS LOAD-BEARING. tools/check-mutation-boot.mjs scans tools/ for
// `check-*.mjs` and FAILS THE BUILD for any it finds that build.sh does not
// run — a gate nobody runs being worse than no gate. An on-demand instrument
// named `check-sweep-ink.mjs` would be mistaken for exactly that and would
// have to be wired in to make the build green again, which is how a tool that
// was deliberately kept out of the build ends up in it. Hence `sweep-ink.mjs`.
// Do not rename this to `check-`.
//
// ---------------------------------------------------------------------------
// THE FOUR TECHNIQUES, each of which was arrived at by a failure.
//
//   1. ONE PAINTED FRAME AND ONE INKLESS FRAME PER (surface, ground, screen),
//      not two screenshots per node. Enumerate first, tag every owning element
//      with a data attribute, then flip them all at once. Two captures instead
//      of hundreds; a 90-node screen costs 2 screenshots rather than 180.
//
//   2. THE INKLESS FRAME USES `color: transparent; text-shadow: none`, NOT
//      `visibility: hidden` — which is what the single-node rounds used and
//      what this must not inherit. visibility:hidden also removes the element's
//      OWN BACKGROUND, so a node with a fill (.tab.active, a chip, a button)
//      gets measured against whatever is behind the fill instead of against the
//      fill itself. Transparent ink leaves every surface painted and removes
//      only the glyphs.
//
//      The shadow IS removed, deliberately, so a text-shadow's help is NOT
//      credited. That is the strict reading and the one this repo's earlier ink
//      rounds used, which is what makes a number from here comparable with a
//      number from tools/pixel-contrast.mjs. It also means a reading here can
//      be WORSE than what a user sees, which is the safe direction.
//
//      A NUMBER PUBLISHED BY AN EARLIER ROUND IS NOT A REGRESSION BASELINE FOR
//      THIS TOOL, and the first committed run is why the point is made here.
//      The scratchpad original's header claimed it reproduced the tab labels'
//      previously published 2.51/2.67; at this commit they measure 7.65-8.00 on
//      a dark ground. Nothing is wrong with either number — eaa3a69 and 1292ef4
//      landed in between and recoloured them. Cross-check this harness against
//      pixel-contrast on the SAME commit, never against a figure from a round
//      whose fixes have since shipped.
//
//   3. THE BOX IS A RANGE OVER THE ELEMENT'S OWN TEXT NODE, not its border
//      box. A parent that contains a child's text would otherwise be credited
//      with the child's ink, and the boxes would nest, so one bad node would
//      be reported once per ancestor.
//
//   4. AN elementFromPoint HIT TEST AT FIVE POINTS ACROSS THE TEXT, requiring
//      80% hits. `checkVisibility` answers "is this painted at all", not "can
//      this be seen right now", and two things defeat it — both of which
//      produced wrong numbers on the first run:
//        OCCLUSION. Settings and Pro Settings are panels OVER the live page,
//          so every node behind them is still "visible" by the CSS definition.
//          Its pixels belong to the panel, so the painted/inkless diff finds
//          only edge noise and returns a ratio built from it. That is where
//          .sidebar-shortcut-name's impossible 1.68 came from: grey #5f6368 on
//          a near-white plate cannot be 1.68, and it was not — it was not on
//          screen.
//        CLIPPING. A node half inside a scroller's overflow has a Range rect
//          that extends past the clip, so most of the measured box is somebody
//          else's paint.
//      A covering panel is not an ancestor of what it covers, so it fails
//      `el.contains(hit)`. `hit.contains(el)` is ALSO allowed, because a child
//      with pointer-events:none legitimately reports its ancestor.
//
//   And the fifth thing, which is not a technique but a scope correction: THE
//   FOLD IS NOT THE END OF THE SURFACE. Settings and Pro Settings are long
//   panels and Insights is ~1400px inside a ~700px frame. A single viewport
//   measures a fraction of each and would call it "every text node". Each
//   surface's real scroller is found and walked a screen at a time, and each
//   stop gets its own painted/inkless pair.
//
// ---------------------------------------------------------------------------
// THE SELF-TEST IS NOT OPTIONAL AND IT IS THE MOST IMPORTANT PART OF THIS FILE.
//
// The first version of this harness was written through a shell heredoc, which
// ate a backslash. `/{BS}S/` inside a TEMPLATE LITERAL arrived as `/S/`, so the
// "is there any non-whitespace here" test silently became "does this contain a
// capital S". It returned 950 confident measurements covering about a fifth of
// the product, with plausible node counts and real ratios. Every number in it
// was true. The output was a FILTER WEARING A SWEEP'S CLOTHES, and nothing in
// the output said so — which is the whole hazard of an enumerating instrument:
// a sweep that silently narrows looks exactly like a sweep that passes.
//
// Three defences, and they do different jobs. Read the difference before
// trusting any of them:
//
//   A. NO BACKSLASH IS WRITTEN INTO PAGE-SIDE SOURCE AT ALL, and --self-test
//      enforces it. Character classes come from String.fromCharCode; the
//      emptiness test is `s.trim()` rather than a whitespace regex. THIS DOES
//      NOT DETECT A MANGLING THAT ALREADY HAPPENED — a mangled escape has no
//      backslash left in it, so it passes this check trivially. What it does is
//      REMOVE THE OPPORTUNITY: there is nothing in these strings for any
//      carrier to eat, and an author who adds one is told at once.
//
//   B. THE PREDICATE IS TESTED OFFLINE, against real samples, in --self-test.
//      The acceptance test is a standalone function source shared by the page
//      side and the self-test, so it is evaluated in node and run against
//      "Home", "Tasks", "", "   " and friends. THIS ONE DOES detect a mangling,
//      with no browser, the moment it happens.
//
//   C. THE ENUMERATOR MUST PROVE IT CAN STILL SEE, in the browser, before a
//      single measurement is taken: the four tab labels come back reading
//      exactly "Home", "Tasks", "Dashboard", "Insights", and the population
//      clears a floor. NONE OF THOSE FOUR CONTAINS A CAPITAL S, so the broken
//      version failed it outright; its population was 5 where Home's first
//      screen enumerates ~34.
//
// A is prevention, B is detection without a browser, C is detection against the
// real product. The run refuses to continue if C fails, because every number
// after it would be a subset reported as a total.
//
// ---------------------------------------------------------------------------
// USAGE
//
//   node --experimental-websocket tools/sweep-ink.mjs --out sweep.json
//   node --experimental-websocket tools/sweep-ink.mjs --out s.json --attach 9800
//   node tools/sweep-ink.mjs --report sweep.json [ground]
//   node tools/sweep-ink.mjs --split  sweep.json
//   node tools/sweep-ink.mjs --self-test
//
// --experimental-websocket IS REQUIRED ON NODE 20, which is what this machine
// runs; WebSocket only became an unflagged global in Node 21. Without it the
// run dies AFTER seeding a profile and launching a browser, so it reads as a
// harness fault rather than a missing flag. Harmless on a newer node. The run
// checks for the global up front and says so rather than letting that happen.
//
// Other flags: --grounds a,b  --surfaces a,b  (subset, for iteration)
//              --profile NAME (seed-fixture profile, default busy-messy)
//              --port N       (CDP port; default is a unique one per run, I25)
//              --keep         (leave the browser and profile up afterwards)
//
// THE BROWSER AND THE FIXTURE ARE NOT HAND-ROLLED HERE, and that is deliberate.
// tools/seed-fixture.mjs --profile busy-messy --headed --keep launches it, and
// seed-fixture routes its command line through tools/browser-launch.mjs — which
// is the single place the off-screen position (I30), the MAX_PATH refusal (I31)
// and the extension-loading flags (I6) live. A spawn() written out here would
// be exactly the per-round hand-rolled flag array that browser-launch.mjs's own
// header says is the thing it exists to stop. This file's own obligations are
// the two browser-launch cannot cover for it: A UNIQUE PORT (I25) and A UNIQUE
// PROFILE DIRECTORY (I32), both generated per run below.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn, spawnSync, execSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const REPO = path.resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i === -1 ? d : argv[i + 1]; };
const flag = (k) => argv.includes(k);

// The one character this file must never write into page-side source, built
// rather than typed so that this line cannot itself be eaten by a carrier.
const BACKSLASH = String.fromCharCode(92);

// =========================================================================
// THE PAGE-SIDE SOURCE. Every string below is evaluated inside the product's
// own page. NONE OF THEM MAY CONTAIN A BACKSLASH — see defence A above.
//
// THE TWO MARKERS ARE NOT DECORATION: --self-test reads THIS FILE and asserts
// that the region between them contains no backslash. Checking the runtime
// VALUES is not enough and the difference is the historical bug itself — a
// backslash inside a double-quoted string literal is consumed by the JS parser,
// so `"/{BS}S/"` has a backslash in the source, none in the value, and means
// "contains a capital S". A value-only check cannot see it. The source check
// can. Both run, because a template literal can carry a backslash the other way.
//
// Nothing that needs a backslash may be added between the markers. Build
// character classes with String.fromCharCode, and test emptiness with trim().
//
// >>> PAGE-SOURCE-BEGIN <<<
// =========================================================================

// The acceptance predicate, kept as its own source string for one reason: it is
// the thing that broke, and a standalone function source can be evaluated in
// node and tested against real samples with no browser (defence B). It is
// embedded into ENUMERATE below, and --self-test asserts that embedding, so the
// predicate tested is provably the predicate used.
const ACCEPTS_TEXT = "function (s) { return !!(s && s.trim()); }";

const PAGE = {
  // Enumerate every element that owns a non-empty text node, with that text's
  // own client rects, and tag it so the whole population can be de-inked at
  // once. checkVisibility covers display:none, visibility:hidden,
  // content-visibility and opacity:0 anywhere up the tree; the hit test after
  // it covers occlusion and clipping, which checkVisibility does not consider
  // its business.
  ENUMERATE: `(function () {
  var accepts = ` + ACCEPTS_TEXT + `;
  var out = [];
  // Built from char codes so the source carries no escape for anything to eat:
  // space, tab, LF, CR, FF, VT.
  var WS = new RegExp("[" + String.fromCharCode(32, 9, 10, 13, 12, 11) + "]+", "g");
  var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  var node, seq = 0;
  while ((node = w.nextNode())) {
    var s = node.nodeValue;
    if (!accepts(s)) continue;
    var el = node.parentElement;
    if (!el) continue;
    if (el.closest("script,style,noscript,template")) continue;
    if (!el.checkVisibility || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    var r = document.createRange();
    r.selectNodeContents(node);
    var rects = Array.prototype.slice.call(r.getClientRects()).filter(function (b) { return b.width > 1 && b.height > 1; });
    if (!rects.length) continue;
    rects = rects.filter(function (b) { return b.bottom > 2 && b.top < innerHeight - 2 && b.right > 2 && b.left < innerWidth - 2; });
    if (!rects.length) continue;
    // The widest run is the one measured; a wrapped line is the same ink.
    rects.sort(function (a, b) { return (b.width * b.height) - (a.width * a.height); });
    var box = rects[0];
    if (box.width * box.height < 40) continue;

    // THE HIT TEST (technique 4). Five points across the text, 80% must land
    // on this element, an ancestor of it, or a descendant of it.
    var hits = 0, tries = 0;
    for (var f = 0.12; f <= 0.88; f += 0.19) {
      var cx = box.x + box.width * f, cy = box.y + box.height / 2;
      if (cx < 1 || cy < 1 || cx > innerWidth - 1 || cy > innerHeight - 1) continue;
      tries++;
      var hit = document.elementFromPoint(cx, cy);
      if (hit && (hit === el || el.contains(hit) || hit.contains(el))) hits++;
    }
    if (tries < 3 || hits / tries < 0.8) continue;

    var cs = getComputedStyle(el);
    var id = "n" + (seq++);
    el.setAttribute("data-ink-id", (el.getAttribute("data-ink-id") || "") + " " + id);
    out.push({
      id: id,
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === "string" ? el.className : "") || (el.id ? "#" + el.id : ""),
      elId: el.id || "",
      text: s.trim().replace(WS, " ").slice(0, 46),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      fs: parseFloat(cs.fontSize) || 0,
      fw: cs.fontWeight,
      color: cs.color,
      shadow: cs.textShadow === "none" ? "" : cs.textShadow
    });
  }
  return out;
})()`,

  // The surface's real scroller: the largest on-screen element that actually
  // overflows. Tagged rather than returned, because the reference has to
  // survive the round trip.
  SCROLLERS: `(function () {
  var best = null, bestArea = 0;
  var all = document.querySelectorAll("div,main,section,ul,nav");
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.scrollHeight - e.clientHeight < 24) continue;
    if (!e.checkVisibility || !e.checkVisibility()) continue;
    var b = e.getBoundingClientRect();
    if (b.width < 100 || b.height < 100) continue;
    if (b.bottom < 0 || b.top > innerHeight) continue;
    var a = b.width * b.height;
    if (a > bestArea) { bestArea = a; best = e; }
  }
  if (!best) return { steps: 1 };
  best.setAttribute("data-ink-scroller", "1");
  return { steps: Math.min(6, Math.ceil(best.scrollHeight / Math.max(1, best.clientHeight))), h: best.clientHeight, sh: best.scrollHeight };
})()`,

  // 0.88 of a screen per step, so consecutive stops overlap slightly and a node
  // straddling the boundary is fully on screen at one of them.
  SCROLL_TO: (i) => `(function () {
  var e = document.querySelector("[data-ink-scroller]");
  if (!e) return 0;
  e.scrollTop = Math.round(e.clientHeight * 0.88) * ${i};
  return e.scrollTop;
})()`,

  CLEAR_SCROLLER: `(function () { document.querySelectorAll("[data-ink-scroller]").forEach(function (e) { e.scrollTop = 0; e.removeAttribute("data-ink-scroller"); }); return 1; })()`,

  // Technique 2. Transparent ink, not hidden elements.
  INKLESS_ON: `(function () {
  var st = document.getElementById("__inkless");
  if (!st) { st = document.createElement("style"); st.id = "__inkless"; document.head.appendChild(st); }
  st.textContent = "[data-ink-id]{color:transparent !important;text-shadow:none !important;-webkit-text-stroke-color:transparent !important;}";
  return 1;
})()`,

  INKLESS_OFF: `(function () { var s = document.getElementById("__inkless"); if (s) s.textContent = ""; return 1; })()`,
  CLEAR_IDS: `(function () { document.querySelectorAll("[data-ink-id]").forEach(function (e) { e.removeAttribute("data-ink-id"); }); return 1; })()`,

  // THE FRAME GEOMETRY PRECONDITION. Every box below is in CSS pixels and every
  // screenshot is in device pixels; if the two disagree by a factor nobody
  // noticed, every box is offset and every ratio is fiction that still looks
  // like a measurement. Read the ratio rather than assuming 1.
  VIEWPORT: `({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`,
  ROOT_CLASS: `document.documentElement.className`,
};
// >>> PAGE-SOURCE-END <<<

// =========================================================================
// THE GROUNDS. Applied through the PRODUCT'S OWN writer and a reload, never by
// poking classes onto <html> — so the resulting class list is DERIVED and can
// be read back as evidence rather than asserted.
//
// The two photographs are not decoration. A bright photograph never gets
// `bg-light`, so nothing in the light-ground branch of the stylesheet reaches
// text sitting on it; `photo-light` is the only ground that can show that.
// =========================================================================
function png(w, h, px) {
  const ch = 3, stride = w * ch;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = px(x, y), o = y * (stride + 1) + 1 + x * ch;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "ascii"), all = Buffer.concat([t, data]);
    let c = ~0;
    for (let i = 0; i < all.length; i++) { c ^= all[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    const crc = Buffer.alloc(4); crc.writeUInt32BE((~c) >>> 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)));
const noise = (x, y) => (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
// A bright overcast sky / pale sand: the kind of wallpaper a user actually
// picks, and the kind this product has no light-branch answer for.
const LIGHT_PHOTO = "data:image/png;base64," + png(240, 150, (x, y) => {
  const b = 226 + 22 * Math.sin(x / 30) * Math.cos(y / 22) + 10 * noise(x, y);
  return [clamp(b + 6), clamp(b + 2), clamp(b - 6)];
}).toString("base64");
const DARK_PHOTO = "data:image/png;base64," + png(240, 150, (x, y) => {
  const b = 34 + 16 * Math.sin(x / 30) * Math.cos(y / 22) + 8 * noise(x, y);
  return [clamp(b - 4), clamp(b), clamp(b + 10)];
}).toString("base64");

const GROUNDS = [
  { key: "none",        bg: "color:#2a2a2a", note: "the shipped default (#2a2a2a -> bg-dark)" },
  { key: "solid-dark",  bg: "color:#1e3a5f", note: "a dark colour preset" },
  { key: "solid-light", bg: "color:#f5f5f5", note: "a light colour preset -> bg-light" },
  { key: "photo-dark",  bg: DARK_PHOTO,      note: "a dark photograph -> bg-image, no luminance class" },
  { key: "photo-light", bg: LIGHT_PHOTO,     note: "a LIGHT photograph -> bg-image, STILL no luminance class" },
];

const SURFACES = [
  { key: "Home",         open: `(function(){document.querySelector('[data-tab="home"]').click();return 1})()`, wait: 1500 },
  { key: "Tasks",        open: `(function(){document.querySelector('[data-tab="tasks"]').click();return 1})()`, wait: 2000 },
  { key: "Dashboard",    open: `(function(){document.querySelector('[data-tab="dashboard"]').click();return 1})()`, wait: 2400 },
  { key: "Insights",     open: `(function(){document.querySelector('[data-tab="insights"]').click();return 1})()`, wait: 2600 },
  { key: "Settings",     open: `(function(){document.querySelector('[data-tab="home"]').click();document.getElementById("sb-settings").click();return 1})()`, wait: 1600 },
  { key: "Pro Settings", open: `(function(){document.getElementById("sb-pro-settings").click();return 1})()`, wait: 1800 },
];

// WCAG large text: >= 24px at any weight, or >= 18.66px at 700+. Everything
// else takes the 4.5 floor.
export function floorFor(fontPx, fontWeight) {
  const w = parseInt(fontWeight, 10) || 400;
  const big = fontPx >= 24 || (fontPx >= 18.66 && w >= 700);
  return { big, floor: big ? 3.0 : 4.5 };
}

// =========================================================================
// ANALYSIS. Shared by --report and --split, and exported so the self-test can
// exercise it without a browser.
//
// DEDUPE IS NOT COSMETIC. Settings and Pro Settings are PANELS over the live
// page, so opening one re-measures every node of the page behind it that is
// still on screen. The same text node therefore appears under several
// "surfaces" on one ground. Counted raw, the tab bar would be reported four
// times and the denominator would be a fiction. A node is keyed by
// class+id+tag+text and kept ONCE per ground, at its WORST reading — which is
// also the reading a fix has to clear.
// =========================================================================
export const rowKey = (r) => `${r.cls} ${r.elId} ${r.tag} ${r.text}`;

export function dedupeByGround(rows) {
  const out = new Map();                       // ground -> key -> row
  for (const r of rows) {
    if (!out.has(r.ground)) out.set(r.ground, new Map());
    const m = out.get(r.ground), k = rowKey(r);
    const prev = m.get(k);
    if (!prev) { m.set(k, { ...r, surfaces: new Set([r.surface]) }); continue; }
    prev.surfaces.add(r.surface);
    const a = prev.ratio === null ? Infinity : prev.ratio;
    const b = r.ratio === null ? Infinity : r.ratio;
    if (b < a) { const s = prev.surfaces; Object.assign(prev, r); prev.surfaces = s; }
  }
  return out;
}

// THE SPLIT THAT DEFINES A ROUND'S SCOPE.
//
// A node under floor on a light wallpaper is not automatically a light-ground
// defect. One that is equally dim on EVERY ground is a faded state — an
// unearned achievement, a disabled control — and needs a product decision, not
// a per-ground token. One that clears its floor on dark and fails on light is
// the class a `bg-light` rule can actually answer. Reporting them together
// would put work in a round that the round cannot do.
//
//   lightOnly  passes on both dark grounds, fails on solid-light.   ACTIONABLE
//   both       fails on dark as well.                               REPORT ONLY
//   photoOnly  passes on solid-light, fails on a light PHOTOGRAPH, where no
//              bg-light rule reaches it at all.                     REPORT ONLY
//   darkOnly   fails only on a dark ground.                         REPORT ONLY
export function classify(rows) {
  const per = new Map();                       // key -> { ground -> worst row }
  for (const r of rows) {
    const k = rowKey(r);
    if (!per.has(k)) per.set(k, {});
    const g = per.get(k);
    const cur = g[r.ground];
    const a = cur && cur.ratio !== null ? cur.ratio : Infinity;
    const b = r.ratio !== null ? r.ratio : Infinity;
    if (!cur || b < a) g[r.ground] = r;
  }
  const cat = { lightOnly: [], both: [], photoOnly: [], darkOnly: [] };
  const bad = (r) => !!r && r.ratio !== null && r.ratio < r.floor;
  const good = (r) => !!r && r.ratio !== null && r.ratio >= r.floor;
  for (const [k, g] of per) {
    const sl = g["solid-light"], nn = g["none"], sd = g["solid-dark"], pl = g["photo-light"];
    const rec = { k, sl, nn, sd, pl, cls: (sl || nn || pl || {}).cls };
    if (bad(sl) && (bad(nn) || bad(sd))) cat.both.push(rec);
    else if (bad(sl)) cat.lightOnly.push(rec);
    else if (bad(pl) && good(sl)) cat.photoOnly.push(rec);
    else if (bad(nn) || bad(sd)) cat.darkOnly.push(rec);
  }
  return { per, cat };
}

// =========================================================================
// --report
// =========================================================================
function report(file, only) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const dedup = dedupeByGround(d.rows);

  console.log("GROUNDS");
  for (const [k, v] of Object.entries(d.grounds)) console.log(`  ${k.padEnd(13)} html.class="${v.classes}"   ${v.note}`);

  const grounds = [...dedup.keys()];
  console.log("\nDISTINCT TEXT NODES MEASURED, and how many clear their floor");
  console.log("  " + "ground".padEnd(14) + "clear".padStart(7) + "under".padStart(7) + "n/m".padStart(6) + "  total");
  for (const g of grounds) {
    const rows = [...dedup.get(g).values()];
    const un = rows.filter((r) => r.ratio !== null && r.ratio < r.floor).length;
    const nm = rows.filter((r) => r.ratio === null).length;
    console.log("  " + g.padEnd(14) + String(rows.length - un - nm).padStart(7) + String(un).padStart(7) + String(nm).padStart(6) + "  " + rows.length);
  }

  for (const g of grounds) {
    if (only && g !== only) continue;
    const rows = [...dedup.get(g).values()].filter((r) => r.ratio !== null && r.ratio < r.floor);
    if (!rows.length) { console.log(`\n=== ${g}: nothing under floor ===`); continue; }
    const by = new Map();
    for (const r of rows) {
      const k = r.cls || (r.elId ? "#" + r.elId : "<" + r.tag + ">");
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    }
    console.log(`\n=== ${g}: ${rows.length} distinct nodes under floor, in ${by.size} classes ===`);
    for (const [k, list] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const ratios = list.map((r) => r.ratio).sort((a, b) => a - b);
      const surf = [...new Set(list.flatMap((r) => [...r.surfaces]))].join(",");
      console.log(`  ${String(list.length).padStart(2)}x  ${ratios.map((n) => n.toFixed(2)).join(" ").slice(0, 52).padEnd(52)} floor ${list[0].floor}`);
      console.log(`      ${k.slice(0, 92)}`);
      console.log(`      color=${list[0].color}  bg=${JSON.stringify(list[0].bg)}  seen on [${surf}]`);
      console.log(`      eg "${list.map((r) => r.text).slice(0, 3).join('" / "')}"`);
    }
  }
}

// =========================================================================
// --split
// =========================================================================
function split(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));

  // A SUBSET RUN CANNOT BE SPLIT, and saying so is the point. Every category
  // below is defined by a COMPARISON between grounds; if a ground was never
  // measured, "passes on dark" is unknown rather than true, and every node
  // would silently fall into whichever bucket the missing ground was keeping it
  // out of. That is the same class of wrongness as the run this file's
  // self-test exists to prevent, so it refuses rather than guesses.
  const need = ["none", "solid-dark", "solid-light", "photo-light"];
  const have = new Set(d.rows.map((r) => r.ground));
  const missing = need.filter((g) => !have.has(g));
  if (missing.length) {
    console.error(`REFUSED: the split compares grounds, and this sweep is missing ${missing.join(", ")}.`);
    console.error("  Every category is a comparison; an unmeasured ground is unknown, not passing.");
    console.error("  Re-run the sweep without --grounds, or use --report, which is per-ground.");
    process.exit(2);
  }

  const { per, cat } = classify(d.rows);
  const show = (title, list) => {
    const by = new Map();
    for (const r of list) {
      const kk = r.cls || "<anon>";
      if (!by.has(kk)) by.set(kk, []);
      by.get(kk).push(r);
    }
    console.log(`\n${title}  -  ${list.length} nodes in ${by.size} classes`);
    for (const [kk, l] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const f = l.map((r) => (r.sl && r.sl.ratio !== null ? r.sl.ratio : (r.pl && r.pl.ratio !== null ? r.pl.ratio : 0)));
      const dk = l.map((r) => (r.nn && r.nn.ratio !== null ? r.nn.ratio.toFixed(1) : "-"));
      console.log(`  ${String(l.length).padStart(2)}x ${kk.slice(0, 40).padEnd(42)} light ${f.map((n) => n.toFixed(2)).join(" ").slice(0, 34).padEnd(34)} (dark ${dk.slice(0, 4).join(" ")})`);
      const s = l[0].sl || l[0].pl;
      console.log(`     ink=${JSON.stringify(s.ink)} bg=${JSON.stringify(s.bg)} declared=${s.color}  eg "${l.map((r) => (r.sl || r.pl).text).slice(0, 2).join('" / "')}"`);
    }
  };

  console.log(`distinct text nodes measured: ${per.size}`);
  show("A. LIGHT-GROUND ONLY - clears on dark, fails on a light SOLID. ACTIONABLE BY A bg-light RULE.", cat.lightOnly);
  show("B. FAILS ON EVERY GROUND - not a light-ground defect. REPORTED, NOT FIXED BY A GROUND RULE.", cat.both);
  show("C. LIGHT PHOTOGRAPH ONLY - passes bg-light, fails on a bright photo where no bg-light rule reaches.", cat.photoOnly);
  show("D. DARK GROUND ONLY - fails on a dark ground and clears on light.", cat.darkOnly);
}

// =========================================================================
// --self-test
// =========================================================================
function selfTest() {
  let pass = 0, fail = 0;
  const chk = (name, ok, extra) => {
    (ok ? pass++ : fail++);
    console.log("  " + (ok ? "PASS  " : "FAIL  ") + name + (extra ? "   << " + extra : ""));
  };

  console.log("\nSWEEP-INK SELF-TEST\n");

  // --- DEFENCE A, IN TWO HALVES, because one half cannot see what the other
  // catches and the pair is the whole point.
  //
  // Stated honestly first, because a green that means less than it looks like
  // it means is this file's founding sin: NEITHER half detects a mangling that
  // has already happened. An eaten escape leaves nothing behind. What they do
  // is make the class unreachable, and tell an author who reaches for it.
  //
  // A1 SCANS THIS FILE'S OWN SOURCE, between the two markers. A backslash
  //    inside a double-quoted string literal is eaten by the JS parser itself,
  //    so it is real in the source and gone from the value - which is the
  //    historical bug arriving through a different carrier. Only a source scan
  //    sees it.
  // A2 SCANS THE RUNTIME VALUES, which catches the other direction: a template
  //    literal carries a backslash straight through to the page.
  //
  // The markers are assembled rather than typed so that this file contains
  // exactly ONE literal occurrence of each, and the scan can insist on that.
  const MARK_A = ">>> PAGE-SOURCE-" + "BEGIN <<<";
  const MARK_B = ">>> PAGE-SOURCE-" + "END <<<";
  const selfSrc = fs.readFileSync(new URL(import.meta.url), "utf8");
  const count = (h, n) => h.split(n).length - 1;
  chk("this file carries exactly one pair of page-source markers",
    count(selfSrc, MARK_A) === 1 && count(selfSrc, MARK_B) === 1,
    `${count(selfSrc, MARK_A)} begin / ${count(selfSrc, MARK_B)} end`);
  const region = selfSrc.slice(selfSrc.indexOf(MARK_A) + MARK_A.length, selfSrc.indexOf(MARK_B));
  // Anti-vacuity: an empty or misplaced region would pass the scan by
  // containing nothing, which is exactly the shape of failure being guarded.
  chk("the page-source region is the real one (it contains the enumerator)",
    region.length > 2000 && region.includes("createTreeWalker") && region.includes(ACCEPTS_TEXT),
    region.length + " chars");
  const at = region.indexOf(BACKSLASH);
  chk("A1: the page-source region contains no backslash IN THIS FILE", at === -1,
    at === -1 ? "" : "near: " + region.slice(Math.max(0, at - 40), at + 20).replace(/\n/g, " "));

  const pageStrings = { ACCEPTS_TEXT, ...PAGE, SCROLL_TO: PAGE.SCROLL_TO(1) };
  let offenders = 0;
  for (const [k, v] of Object.entries(pageStrings)) {
    if (typeof v !== "string" || !v.includes(BACKSLASH)) continue;
    offenders++;
    console.log(`        PAGE.${k} carries a backslash to the page at index ${v.indexOf(BACKSLASH)}`);
  }
  chk("A2: no page-side VALUE contains a backslash either", offenders === 0,
    offenders ? offenders + " string(s)" : "");
  const scanned = Object.values(pageStrings).filter((v) => typeof v === "string" && v.length > 40).length;
  chk("the value scan examined the real page-side strings", scanned >= 6, scanned + " string(s) scanned");

  // --- DEFENCE B. The acceptance predicate, evaluated offline against real
  // samples. THIS one detects a mangling, with no browser, immediately.
  let accepts;
  try { accepts = new Function("return (" + ACCEPTS_TEXT + ")")(); }
  catch (e) { accepts = null; console.log("        predicate did not evaluate: " + e.message); }
  chk("the acceptance predicate evaluates", typeof accepts === "function");
  if (typeof accepts === "function") {
    // The four tab labels are the canonical samples because NONE OF THEM
    // CONTAINS A CAPITAL S: the historical break turned this predicate into
    // "does the text contain a capital S", and these four are exactly what it
    // dropped. Keep them.
    const yes = ["Home", "Tasks", "Dashboard", "Insights", "x", "0", "Focus 25:00", "-"];
    const no = ["", " ", "   ", String.fromCharCode(10), String.fromCharCode(9, 32, 10), String.fromCharCode(13, 10)];
    const wrongYes = yes.filter((s) => !accepts(s));
    const wrongNo = no.filter((s) => accepts(s));
    chk("it accepts real label text, including all four tab labels", wrongYes.length === 0, JSON.stringify(wrongYes));
    chk("it rejects empty and whitespace-only text", wrongNo.length === 0, JSON.stringify(wrongNo));
    // The negative control that makes the two rows above mean something: the
    // historically broken predicate must FAIL them. A test every predicate
    // passes proves nothing about this one.
    const broken = (s) => !!(s && /S/.test(s));
    chk("the historically broken predicate FAILS these samples (the test can fail)",
      yes.some((s) => !broken(s)), "");
  }

  // The predicate tested must be the predicate used, or defence B is testing a
  // string nothing runs.
  chk("ENUMERATE embeds that exact predicate source", PAGE.ENUMERATE.includes(ACCEPTS_TEXT));

  // --- The WCAG floor, at its boundaries rather than in its middle.
  const f = (px, w) => floorFor(px, w).floor;
  chk("16px/400 takes the 4.5 floor", f(16, "400") === 4.5, String(f(16, "400")));
  chk("24px/400 takes the 3.0 floor", f(24, "400") === 3.0, String(f(24, "400")));
  chk("19px/700 takes the 3.0 floor", f(19, "700") === 3.0, String(f(19, "700")));
  chk("19px/400 stays at 4.5 (weight matters below 24px)", f(19, "400") === 4.5, String(f(19, "400")));
  chk("18px/700 stays at 4.5 (18.66 is the boundary, not 18)", f(18, "700") === 4.5, String(f(18, "700")));

  // --- Dedupe: worst reading wins, surfaces merge.
  const mk = (o) => ({ ground: "solid-light", surface: "Home", cls: "a", elId: "", tag: "span", text: "T", floor: 4.5, ratio: null, ...o });
  const dd = dedupeByGround([
    mk({ ratio: 7.1, surface: "Home" }),
    mk({ ratio: 2.2, surface: "Settings" }),
    mk({ ratio: 5.0, surface: "Tasks" }),
  ]);
  const only = [...dd.get("solid-light").values()];
  chk("one text node seen on three surfaces dedupes to one row", only.length === 1, String(only.length));
  chk("...kept at its WORST reading, which is the one a fix must clear", only[0] && only[0].ratio === 2.2, only[0] && String(only[0].ratio));
  chk("...with every surface it was seen on recorded", only[0] && only[0].surfaces.size === 3, only[0] && String(only[0].surfaces.size));

  // --- Classification, one synthetic node per category plus a passing control.
  const node = (cls, byGround) => Object.entries(byGround).map(([g, ratio]) =>
    ({ ground: g, surface: "Home", cls, elId: "", tag: "span", text: cls, floor: 4.5, ratio }));
  const rows = [
    ...node("lightonly", { none: 9.0, "solid-dark": 8.0, "solid-light": 2.0, "photo-light": 2.1 }),
    ...node("everywhere", { none: 2.4, "solid-dark": 2.3, "solid-light": 2.0, "photo-light": 2.0 }),
    ...node("photoonly", { none: 9.0, "solid-dark": 8.0, "solid-light": 6.0, "photo-light": 2.2 }),
    ...node("darkonly", { none: 2.1, "solid-dark": 2.0, "solid-light": 9.0, "photo-light": 8.0 }),
    ...node("clean", { none: 9.0, "solid-dark": 8.0, "solid-light": 7.0, "photo-light": 6.5 }),
  ];
  const { cat } = classify(rows);
  const names = (l) => l.map((r) => r.cls).sort().join(",");
  chk("a node failing only on a light solid is LIGHT-ONLY", names(cat.lightOnly) === "lightonly", names(cat.lightOnly));
  chk("a node failing on every ground is BOTH, not light-only", names(cat.both) === "everywhere", names(cat.both));
  chk("a node failing only on a light photograph is PHOTO-ONLY", names(cat.photoOnly) === "photoonly", names(cat.photoOnly));
  chk("a node failing only on dark is DARK-ONLY", names(cat.darkOnly) === "darkonly", names(cat.darkOnly));
  // The control: a node that clears everywhere must appear in NO category. A
  // classifier that put everything somewhere would pass all four rows above.
  const placed = [...cat.lightOnly, ...cat.both, ...cat.photoOnly, ...cat.darkOnly].map((r) => r.cls);
  chk("a node that clears its floor everywhere is in NO category", !placed.includes("clean"), placed.join(","));

  // --- THE DEPENDENCY. measure() is this harness's arithmetic, and its own
  // self-test carries the negative control that matters (an element forced to
  // its own backdrop must report NO measurement rather than a comfortable
  // number from noise). Run it as a CHILD, which also sidesteps a real trap:
  // pixel-contrast.mjs runs its self-test on `process.argv.includes
  // ("--self-test")` at import time, so a static import here would hijack this
  // command. measure() is therefore imported dynamically, in the sweep path
  // only.
  const pc = spawnSync(process.execPath, [path.join(HERE, "pixel-contrast.mjs"), "--self-test"], { encoding: "utf8" });
  chk("tools/pixel-contrast.mjs --self-test passes (the arithmetic under this)",
    pc.status === 0, pc.status === 0 ? "" : (pc.stdout || "").trim().split("\n").slice(-3).join(" | "));

  // --- Anti-vacuity on the suite itself.
  const EXPECTED = 24;
  if (pass + fail < EXPECTED) {
    console.log(`\n  FAIL  the self-test ran only ${pass + fail} assertions, fewer than the ${EXPECTED} it should`);
    fail++;
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

// =========================================================================
// THE SWEEP
// =========================================================================
async function sweep() {
  if (typeof WebSocket === "undefined") {
    console.error("REFUSED: WebSocket is not a global on this node.");
    console.error("  Re-run as: node --experimental-websocket tools/sweep-ink.mjs ...");
    console.error("  Without the flag this dies AFTER seeding a profile and launching a browser,");
    console.error("  which reads as a harness fault rather than a missing flag.");
    process.exit(2);
  }

  const OUT = arg("--out", null);
  if (!OUT) { console.error("REFUSED: --out <file.json> is required."); process.exit(2); }

  const { measure } = await import("./pixel-contrast.mjs");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const groundFilter = arg("--grounds", null);
  const surfaceFilter = arg("--surfaces", null);
  const grounds = groundFilter ? GROUNDS.filter((g) => groundFilter.split(",").includes(g.key)) : GROUNDS;
  const surfaces = surfaceFilter ? SURFACES.filter((s) => surfaceFilter.split(",").includes(s.key)) : SURFACES;
  if (!grounds.length || !surfaces.length) {
    console.error("REFUSED: --grounds / --surfaces selected nothing. A run that measures nothing passes.");
    process.exit(2);
  }

  // I25 + I32: a unique port AND a unique profile directory, per run. Neither
  // is sufficient alone — a stale browser on the port makes you silently drive
  // the PREVIOUS run's profile while your banner prints the new one, and a
  // stale browser on the profile makes Edge hand off so your port is never
  // opened at all. The token is shared so the two always move together and a
  // leftover pair is identifiable at a glance.
  const token = Date.now().toString(36).slice(-5) + "-" + Math.floor(Math.random() * 1e4);
  const PORT = Number(arg("--port", 0)) || (9300 + Math.floor(Math.random() * 600));
  const attach = arg("--attach", null);
  const profileRel = path.join(".scratch", "ink-" + token);
  const PROFILE_DIR = path.join(REPO, profileRel);

  let childPid = null;
  const kill = () => {
    if (!childPid || flag("--keep")) return;
    try { execSync(`taskkill /PID ${childPid} /T /F`, { stdio: "ignore" }); } catch {}
    childPid = null;
  };
  process.on("exit", kill);
  process.on("SIGINT", () => process.exit(130));

  let port = PORT;
  if (attach) {
    port = Number(attach);
    console.log(`ATTACH  using the browser already on port ${port}; nothing is seeded or torn down`);
  } else {
    // I25's guard, and it costs one request: if something already answers on
    // this port, a launch here would lose the bind without an error anyone sees
    // and every measurement would come from a browser we did not start.
    let squatter = null;
    try { squatter = await (await fetch(`http://127.0.0.1:${port}/json/version`)).text(); } catch {}
    if (squatter) {
      console.error(`REFUSED: something is already listening on port ${port} (I25).`);
      console.error("  A launch would lose the bind silently and this would drive the WRONG browser.");
      process.exit(2);
    }

    console.log(`SEED    tools/seed-fixture.mjs --profile ${arg("--profile", "busy-messy")} --user-data-dir ${profileRel} --port ${port} --headed --keep`);
    console.log("        headed because I30: headless renders different pixels (backdrop-filter),");
    console.log("        so a pixel-contrast harness may not go headless. Off-screen, via browser-launch.mjs.");
    const seedOut = await new Promise((res, rej) => {
      const p = spawn(process.execPath, ["--experimental-websocket", path.join(HERE, "seed-fixture.mjs"),
        "--profile", arg("--profile", "busy-messy"), "--user-data-dir", profileRel,
        "--port", String(port), "--headed", "--keep"], { cwd: REPO });
      let buf = "";
      p.stdout.on("data", (d) => { buf += d; process.stdout.write("  | " + String(d).replace(/\n(?!$)/g, "\n  | ")); });
      p.stderr.on("data", (d) => { buf += d; process.stderr.write("  ! " + d); });
      p.on("close", (c) => (c === 0 ? res(buf) : rej(new Error("seed-fixture exited " + c))));
    });
    // seed-fixture prints this line on purpose so a caller can adopt the
    // browser it deliberately left running. If the line ever stops matching we
    // must NOT carry on: the browser would leak on every run, off-screen and
    // invisible, holding a scratch profile open.
    const m = /browser left running on port \d+ \(pid (\d+)\)/.exec(seedOut);
    if (!m) {
      console.error("REFUSED: seed-fixture did not report the pid of the browser it kept.");
      console.error("  Without it this cannot tear the browser down, and a leaked off-screen");
      console.error("  browser holding a scratch profile is invisible until the disk fills.");
      process.exit(2);
    }
    childPid = Number(m[1]);
    console.log(`        adopted browser pid ${childPid} on port ${port}`);
  }

  // ---------------------------------------------------------------- CDP
  const http = async (p, method) => {
    let last;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: method || "GET" });
        const b = await r.text();
        try { return JSON.parse(b); } catch { throw new Error(b.slice(0, 90)); }
      } catch (e) { last = e; await sleep(500); }
    }
    throw new Error("CDP never answered: " + last.message);
  };

  // I6: take the id from the PROFILE's own record, matching on the repo path.
  // Never "the first chrome-extension:// target" — the browser's own
  // force-installed extensions get there first.
  function extId() {
    const want = path.resolve(REPO).toLowerCase();
    for (const f of ["Secure Preferences", "Preferences"]) {
      const sp = path.join(PROFILE_DIR, "Default", f);
      if (!fs.existsSync(sp)) continue;
      try {
        const s = (JSON.parse(fs.readFileSync(sp, "utf8")).extensions || {}).settings || {};
        for (const [id, v] of Object.entries(s))
          if (v && v.path && path.resolve(v.path).toLowerCase() === want) return id;
      } catch {}
    }
    throw new Error("extension id not found in " + profileRel);
  }
  // Under --attach the profile is somebody else's, so fall back to asking the
  // browser for an extension target rather than reading a directory we do not own.
  async function attachedExtId() {
    const ts = await http("/json/list");
    const t = (ts || []).find((x) => String(x.url).startsWith("chrome-extension://") && /newtab\.html/.test(x.url));
    if (!t) throw new Error("no newtab.html target on the attached browser");
    return /chrome-extension:\/\/([a-p]{32})\//.exec(t.url)[1];
  }

  await http("/json/version");
  const id = attach ? await attachedExtId() : extId();
  const target = await http(`/json/new?chrome-extension://${id}/newtab.html`, "PUT");

  let ws, n = 0; const pend = new Map();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  };
  const send = (m, p) => { const i = ++n; ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
  await send("Runtime.enable"); await send("Page.enable");
  const ev = async (x) => {
    const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  const shot = async () => Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64");

  await sleep(3500);
  // I10: without this every Pro surface renders as a preview and the sweep
  // measures the wrong product.
  await ev(`LP.devPro(true)`);
  await ev(`location.reload()`); await sleep(5000);

  // ---- PRECONDITION: THE FRAME'S SCALE.
  // Every box is CSS pixels and every screenshot is device pixels. If the two
  // disagree by a factor nobody checked, every box is offset and every ratio is
  // a real number measured in the wrong place — which still looks like a
  // measurement. Derive the scale from the frame rather than assuming 1.
  const vp = await ev(PAGE.VIEWPORT);
  const probeShot = await shot();
  const shotW = probeShot.readUInt32BE(16);
  const SCALE = shotW / vp.w;
  if (Math.abs(SCALE - vp.dpr) > 0.02) {
    console.error(`REFUSED: the screenshot is ${shotW}px wide for a ${vp.w}px viewport (scale ${SCALE.toFixed(3)}),`);
    console.error(`  but the page reports devicePixelRatio ${vp.dpr}. Every box would be measured in the`);
    console.error("  wrong place, and every ratio would be a real number about the wrong pixels.");
    process.exit(2);
  }
  console.log(`\nFRAME   viewport ${vp.w}x${vp.h} css, screenshots ${shotW}px wide, scale ${SCALE}`);

  // ---- THE SELF-TEST THAT MATTERS (defence C). Before any measurement.
  const probe = await ev(PAGE.ENUMERATE);
  const labels = probe.filter((p) => p.cls === "tab-label").map((p) => p.text).sort();
  const want = ["Dashboard", "Home", "Insights", "Tasks"];
  if (String(labels) !== String(want)) {
    console.error(`\nSELF-TEST FAILED: the tab labels came back as ${JSON.stringify(labels)}, expected ${JSON.stringify(want)}.`);
    console.error("  The enumerator is filtering or corrupting text. Every number below would be a");
    console.error("  SUBSET REPORTED AS A TOTAL, which is indistinguishable from a clean sweep.");
    process.exit(3);
  }
  // The second, weaker net: a floor on the population. Home's first screen
  // enumerates ~34; the historically broken run enumerated 5. 30 is a floor,
  // not a target, and is not claimed to be tight.
  if (probe.length < 30) {
    console.error(`\nSELF-TEST FAILED: Home enumerated only ${probe.length} text nodes; its first screen has ~34.`);
    process.exit(3);
  }
  console.log(`SELF-TEST OK  Home enumerates ${probe.length} text nodes and the four tab labels read exactly right`);
  await ev(PAGE.CLEAR_IDS);

  const rows = [];
  const groundMeta = {};

  for (const g of grounds) {
    await ev(`(async function(){ await Storage.saveBackgroundConfig({ global: ${JSON.stringify(g.bg)}, rotate:{on:false,every:"day"}, ws:{} }); return 1; })()`);
    await ev(`location.reload()`); await sleep(5200);
    const cls = await ev(PAGE.ROOT_CLASS);
    groundMeta[g.key] = { classes: cls, note: g.note };
    console.log(`\n### GROUND ${g.key}  ->  html.class = "${cls}"`);

    for (const s of surfaces) {
      await ev(PAGE.CLEAR_IDS); await ev(PAGE.CLEAR_SCROLLER);
      try { await ev(s.open); } catch (e) { console.log(`  ${s.key}: OPEN FAILED ${e.message.slice(0, 80)}`); continue; }
      await sleep(s.wait);
      const sc = await ev(PAGE.SCROLLERS);
      let seen = 0, under = 0;
      for (let step = 0; step < (sc.steps || 1); step++) {
        if (step) { await ev(PAGE.SCROLL_TO(step)); await sleep(700); }
        await ev(PAGE.CLEAR_IDS);
        const nodes = await ev(PAGE.ENUMERATE);
        if (!nodes.length) continue;
        // Technique 1: the whole population flips at once, so a screen of 90
        // nodes costs two screenshots rather than 180.
        await ev(PAGE.INKLESS_OFF); await sleep(250);
        const painted = await shot();
        await ev(PAGE.INKLESS_ON); await sleep(300);
        const inkless = await shot();
        await ev(PAGE.INKLESS_OFF); await sleep(120);
        for (const nd of nodes) {
          const m = measure(painted, inkless, nd.box, SCALE);
          const { big, floor } = floorFor(nd.fs, nd.fw);
          const r = typeof m.ratio === "number" ? m.ratio : null;
          if (r !== null && r < floor) under++;
          seen++;
          rows.push({ ground: g.key, surface: s.key, step, cls: nd.cls, elId: nd.elId, tag: nd.tag,
                      text: nd.text, fs: nd.fs, fw: nd.fw, big, floor, ratio: r,
                      pixels: m.pixels, ink: m.ink || null, bg: m.bg || null,
                      color: nd.color, shadow: nd.shadow });
        }
      }
      console.log(`  ${s.key.padEnd(13)} ${String(seen).padStart(4)} nodes over ${sc.steps || 1} screen(s)   ${under ? under + " UNDER FLOOR" : "all clear"}`);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({
    grounds: groundMeta,
    viewport: { w: vp.w, h: vp.h, dpr: vp.dpr, scale: SCALE },
    scope: { grounds: grounds.map((g) => g.key), surfaces: surfaces.map((s) => s.key) },
    rows,
  }, null, 1));
  console.log(`\nwrote ${rows.length} measurements to ${OUT}`);
  console.log(`  node tools/sweep-ink.mjs --report ${OUT}`);
  console.log(`  node tools/sweep-ink.mjs --split  ${OUT}`);

  // I9: close gracefully over CDP before killing. A hard taskkill discards
  // unflushed chrome.storage writes, and this run has written a background
  // config five times.
  if (!attach && !flag("--keep")) {
    try { await send("Browser.close"); await sleep(1500); } catch {}
    kill();
    try { fs.rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch {}
  }
  process.exit(0);
}

// =========================================================================
if (flag("--self-test")) selfTest();
else if (arg("--report")) report(arg("--report"), argv[argv.indexOf("--report") + 2] || null);
else if (arg("--split")) split(arg("--split"));
else if (flag("--out") || flag("--attach")) {
  sweep().catch((e) => { console.error("\nSWEEP FAILED: " + e.message); process.exit(2); });
} else {
  console.log(`
SWEEP-INK — enumerate every text node on every shipped surface and measure all
of them. An ON-DEMAND instrument, not a build gate: see the header for why.

  node --experimental-websocket tools/sweep-ink.mjs --out sweep.json
  node tools/sweep-ink.mjs --report sweep.json [ground]
  node tools/sweep-ink.mjs --split  sweep.json
  node tools/sweep-ink.mjs --self-test

  --grounds a,b   subset of ${GROUNDS.map((g) => g.key).join(",")}
  --surfaces a,b  subset of ${SURFACES.map((s) => s.key).join(",")}
  --profile NAME  seed-fixture profile (default busy-messy)
  --port N        CDP port (default: unique per run, I25)
  --attach N      use a browser already seeded and running on port N
  --keep          leave the browser and scratch profile up afterwards
`);
  process.exit(argv.length ? 2 : 0);
}
