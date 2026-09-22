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
      cls: (typeof el.className === "string" ? el.className
            : (el.className && el.className.baseVal) || "") || (el.id ? "#" + el.id : ""),
      elId: el.id || "",
      text: s.trim().replace(WS, " ").slice(0, 46),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      fs: parseFloat(cs.fontSize) || 0,
      fw: cs.fontWeight,
      color: cs.color,
      inPreview: !!(el.closest && el.closest(".pro-preview-content")),
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

  // [H4.1] THE RE-PIN (H3a). The ground is applied once per ground loop, by the
  // product's own writer plus a reload - but newtab.js rewrites
  // documentElement's className on every render, so by the time a later surface
  // is measured the class can no longer be the one the loop set, and every row
  // is then filed under a ground label it was not taken on. H3a turned 195
  // clean readings into ten real failures by moving the pin to immediately
  // before each measurement.
  //
  // This RE-ASSERTS the classes and reports what it found, so a drift is
  // visible in the output rather than inferred. It does not reload: a reload
  // per capture pair would multiply the run by the number of surfaces, and the
  // class is the only thing that drifts - the stored background does not.
  REPIN: (cls) => `(function () {
  var h = document.documentElement;
  var want = ${JSON.stringify(cls)};
  var had = h.className;
  if (had !== want) h.className = want;
  return { had: had, want: want, drifted: had !== want };
})()`,

  // Technique 2. Transparent ink, not hidden elements.
  // [ROUND E] THE INKLESS FRAME MUST BLANK SVG PAINT TOO, and not doing so
  // FABRICATED FAILURES. An SVG text element - the donut centre figure, the bar
  // chart axis captions - takes its paint from "fill", not from "color". With
  // only color cleared those glyphs stayed painted in BOTH frames, the two were
  // identical over that box, and the ratio came back near 1.0. The Insights
  // donut read 1.26 on the DEFAULT DARK ground: the worst number in the product
  // and not a measurement at all. Technique 2 one element type further on - the
  // inkless frame removes the GLYPHS and nothing else, and it was missing a
  // whole class of glyph. It moves the Pro board numbers as well as the
  // preview's, which is a correction rather than a leak.
  INKLESS_ON: `(function () {
  var st = document.getElementById("__inkless");
  if (!st) { st = document.createElement("style"); st.id = "__inkless"; document.head.appendChild(st); }
  st.textContent = "[data-ink-id]{color:transparent !important;text-shadow:none !important;" +
    "-webkit-text-stroke-color:transparent !important;fill:transparent !important;stroke:none !important;}";
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

// [ROUND E] EVERY SURFACE NAMES ITS TIER, and the free preview is a target
// rather than a thing the sweep could not see.
//
// WHY IT WAS INVISIBLE, which is the finding this change closes. The run below
// opens with LP.devPro(true) - correctly, because without it every Pro surface
// renders as a preview and the sweep measures the wrong product (I10). The
// consequence nobody stated is the other half of that sentence: WITH it, the
// preview is never measured at all. The preview is a DIFFERENT DOM WITH THE
// SAME CLASS NAMES under .pro-preview-content, so every fix scoped to
// .tasks-tab / .insights-tab / .dash-tab is a fix the preview did not get, and
// no instrument has ever pointed at it. Two white-on-white defects shipped and
// were found by looking at a picture (Asana 1218617885858729).
//
// TIER IS A RUN DIMENSION, NOT A SURFACE PROPERTY, because switching it costs a
// reload of the whole page. The loop below sorts pro before free within each
// ground and flips ONCE, so a five-ground run pays five flips rather than
// thirty.
const SURFACES = [
  { key: "Home",         tier: "pro",  open: `(function(){document.querySelector('[data-tab="home"]').click();return 1})()`, wait: 1500 },
  { key: "Tasks",        tier: "pro",  open: `(function(){document.querySelector('[data-tab="tasks"]').click();return 1})()`, wait: 2000 },
  { key: "Dashboard",    tier: "pro",  open: `(function(){document.querySelector('[data-tab="dashboard"]').click();return 1})()`, wait: 2400 },
  { key: "Insights",     tier: "pro",  open: `(function(){document.querySelector('[data-tab="insights"]').click();return 1})()`, wait: 2600 },
  { key: "Settings",     tier: "pro",  open: `(function(){document.querySelector('[data-tab="home"]').click();document.getElementById("sb-settings").click();return 1})()`, wait: 1600 },
  // THE FREE PREVIEW. Same three tabs, same clicks - the difference is entirely
  // the tier the page was reloaded under, which is what makes these separate
  // surfaces rather than a flag on the three above.
  { key: "Free Tasks",     tier: "free", open: `(function(){document.querySelector('[data-tab="tasks"]').click();return 1})()`, wait: 2000 },
  { key: "Free Dashboard", tier: "free", open: `(function(){document.querySelector('[data-tab="dashboard"]').click();return 1})()`, wait: 2400 },
  { key: "Free Insights",  tier: "free", open: `(function(){document.querySelector('[data-tab="insights"]').click();return 1})()`, wait: 2600 },
  // [H4.1] "Pro Settings" IS RETIRED (ruling 11). It opened #sb-pro-settings,
  // a control 4cb7420 removed when the two panels became one, so every run
  // since has printed "OPEN FAILED" for it. A sweep that reports failure to
  // open a surface which no longer exists is noise, and noise is what
  // eventually hides a real failure - the whole point of this instrument being
  // that the denominator is visible. Settings above is now the one panel.
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
// [ROUND E] THE TIER IS PART OF THE KEY, and leaving it out would have made
// this round's own no-leak proof impossible.
//
// The preview renders the SAME CLASS NAMES as the Pro board under a different
// tier - .dash-hero-num, .insights-task-name, .pp-* and the rest. Without the
// tier in the key, a preview node and a Pro node that happen to share a class
// and a string merge into one row kept AT ITS WORST, so a preview failure would
// be reported under "Dashboard" and a Pro number would move because the preview
// moved. They are two different renders of two different DOMs; they are not one
// node measured twice.
export const rowKey = (r) => `${r.tier || "pro"} ${r.cls} ${r.elId} ${r.tag} ${r.text}`;

// THE FORMATTER IS EXPORTED BECAUSE THE FORMATTER IS WHAT LIED. A node need not
// exist on every ground — `#rc-tip-dismiss` is a dismissable tip, on screen for
// the dark grounds and gone by the light ones — and the first version of the
// display read its missing light reading as `r.sl ? r.sl.ratio : 0` and printed
// **light 0.00**, a fabricated zero indistinguishable from a measured contrast
// of zero, which is the worst number this file could emit. AN ABSENT READING IS
// NEVER A NUMBER. Kept at module scope, and under test, because a helper buried
// inside the reporter is a helper nothing can assert about: the mutant that
// restored the zero escaped every other row until this moved out here.
export const fmtRatio = (row) =>
  (row && row.ratio !== null && row.ratio !== undefined ? row.ratio.toFixed(2) : "-");

// Whichever ground actually has a reading, for the descriptive line.
export const anyRow = (r) => r.sl || r.pl || r.nn || r.sd || null;

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

  // A NODE NEED NOT EXIST ON EVERY GROUND, and assuming it does printed a
  // number nobody measured. `#rc-tip-dismiss` is a dismissable tip: it was on
  // screen for the two dark grounds and gone by the light ones, so it has no
  // solid-light and no photo-light row at all. The first version of this
  // display read its light ratio as `r.sl ? r.sl.ratio : 0` and printed
  // **light 0.00** — a fabricated zero that reads exactly like a measured
  // contrast of zero, which is the worst number this file could emit — and
  // then crashed on the ink/bg line below it. An absent reading is "-", never
  // a number, and the representative row is whichever ground actually has one.
  const show = (title, list) => {
    const by = new Map();
    for (const r of list) {
      const kk = r.cls || "<anon>";
      if (!by.has(kk)) by.set(kk, []);
      by.get(kk).push(r);
    }
    console.log(`\n${title}  -  ${list.length} nodes in ${by.size} classes`);
    for (const [kk, l] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const f = l.map((r) => fmtRatio(r.sl && r.sl.ratio !== null ? r.sl : r.pl));
      const dk = l.map((r) => fmtRatio(r.nn));
      console.log(`  ${String(l.length).padStart(2)}x ${kk.slice(0, 40).padEnd(42)} light ${f.join(" ").slice(0, 34).padEnd(34)} (dark ${dk.slice(0, 4).join(" ")})`);
      const s = anyRow(l[0]);
      if (!s) { console.log("     no reading on any ground — nothing to describe"); continue; }
      const seen = ["none", "solid-dark", "solid-light", "photo-light"].filter((g) => l[0][{ none: "nn", "solid-dark": "sd", "solid-light": "sl", "photo-light": "pl" }[g]]);
      console.log(`     ink=${JSON.stringify(s.ink)} bg=${JSON.stringify(s.bg)} declared=${s.color}  seen on grounds [${seen.join(",")}]`);
      console.log(`     eg "${l.map((r) => (anyRow(r) || { text: "?" }).text).slice(0, 2).join('" / "')}"`);
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

  // A NODE THAT DOES NOT EXIST ON EVERY GROUND, which every synthetic row
  // above quietly assumed away. `#rc-tip-dismiss` is a dismissable tip: it was
  // on screen for the two dark grounds and gone by the light ones, so it has
  // no light reading at all. The display read that as `0.00` — a fabricated
  // zero that looks exactly like a measured contrast of zero — and then threw
  // on the line after it. THE POPULATION IN A TEST IS ITSELF AN ASSUMPTION;
  // this is the row that stops this one being made again.
  const partial = classify([...rows, ...node("partialdark", { none: 2.0, "solid-dark": 2.1 })]);
  const dop = partial.cat.darkOnly.find((r) => r.cls === "partialdark");
  chk("a node seen only on dark grounds classifies as DARK-ONLY", !!dop);
  chk("...and has no light-ground row that could be printed as a zero", !!dop && !dop.sl && !dop.pl);
  // AND THE FORMATTER, which is the half that actually lied. Classifying it
  // correctly while rendering it as 0.00 is still a fabricated measurement.
  chk("an absent reading formats as \"-\", never as a number",
    fmtRatio(undefined) === "-" && fmtRatio(null) === "-" && fmtRatio({ ratio: null }) === "-",
    [fmtRatio(undefined), fmtRatio(null), fmtRatio({ ratio: null })].join(" "));
  chk("a REAL zero still formats as 0.00 (the fix must not hide a true reading)",
    fmtRatio({ ratio: 0 }) === "0.00", fmtRatio({ ratio: 0 }));
  chk("anyRow falls back to a ground that has a reading", 
    !!dop && anyRow(dop) === dop.nn && anyRow({ sl: null, pl: null, nn: null, sd: null }) === null);

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
  const EXPECTED = 29;
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
  // measures the wrong product. [ROUND E] And with it, the preview is never
  // measured - see SURFACES. The run starts Pro because the self-test below
  // needs the Pro board; ensureTier flips it per ground thereafter.
  let currentTier = "pro";
  await ev(`LP.devPro(true)`);
  await ev(`location.reload()`); await sleep(5000);

  // [ROUND E] FLIP ONLY WHEN THE TIER ACTUALLY CHANGES, and RE-ASSERT what the
  // page came back as rather than trusting the call. LP.devPro writes a flag and
  // reloads; a run that assumed the flip landed would file free rows under pro.
  const tierFlips = [];
  async function ensureTier(want) {
    if (currentTier === want) return;
    await ev(`LP.devPro(${want === "pro"})`);
    await ev(`location.reload()`); await sleep(5200);
    const got = await ev(`(async function(){ return ProAccess.getProAccessLevel(await Storage.getAll()); })()`);
    const isPro = (got === "active" || got === "trialing" || got === "grace");
    const landed = isPro ? "pro" : "free";
    if (landed !== want) {
      console.error(`\nREFUSED: asked for the ${want} tier and the page came back "${got}" (${landed}).`);
      console.error("  Every row of this ground would be filed under a tier it was not measured on.");
      process.exit(2);
    }
    tierFlips.push({ want, got });
    currentTier = want;
  }

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

  // [H4.1] TWO RUN-LEVEL LEDGERS. A re-pin that fired and a node that could not
  // be measured are both facts about the RUN rather than about the product, and
  // both were invisible before: the first would have mislabelled a ground, the
  // second would have been counted as a clear node.
  const repins = [];
  const unmeasuredRows = [];

  for (const g of grounds) {
    await ev(`(async function(){ await Storage.saveBackgroundConfig({ global: ${JSON.stringify(g.bg)}, rotate:{on:false,every:"day"}, ws:{} }); return 1; })()`);
    await ev(`location.reload()`); await sleep(5200);
    const cls = await ev(PAGE.ROOT_CLASS);
    groundMeta[g.key] = { classes: cls, note: g.note };
    console.log(`\n### GROUND ${g.key}  ->  html.class = "${cls}"`);

    // [ROUND E] Pro first, then free, so the tier flips once per ground.
    const ordered = surfaces.slice().sort((a, b) =>
      ((a.tier || "pro") === "free" ? 1 : 0) - ((b.tier || "pro") === "free" ? 1 : 0));

    for (const s of ordered) {
      await ensureTier(s.tier || "pro");
      await ev(PAGE.CLEAR_IDS); await ev(PAGE.CLEAR_SCROLLER);
      try { await ev(s.open); } catch (e) { console.log(`  ${s.key}: OPEN FAILED ${e.message.slice(0, 80)}`); continue; }
      await sleep(s.wait);
      const sc = await ev(PAGE.SCROLLERS);
      let seen = 0, under = 0, unmeasured = 0;
      for (let step = 0; step < (sc.steps || 1); step++) {
        if (step) { await ev(PAGE.SCROLL_TO(step)); await sleep(700); }
        await ev(PAGE.CLEAR_IDS);
        const nodes = await ev(PAGE.ENUMERATE);
        if (!nodes.length) continue;
        // Technique 1: the whole population flips at once, so a screen of 90
        // nodes costs two screenshots rather than 180.
        // [H4.1] RE-PIN IMMEDIATELY BEFORE THE PAIR (H3a), and record it. A
        // drift here means every row of this screen would otherwise have been
        // filed under a ground it was not taken on.
        const pin = await ev(PAGE.REPIN(groundMeta[g.key].classes));
        if (pin && pin.drifted) {
          repins.push({ ground: g.key, surface: s.key, step, had: pin.had, want: pin.want });
          await sleep(150);
        }
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
          // [H4.1] AN UNMEASURABLE NODE IS NOT A CLEAR NODE (H4.0 fault 1). The
          // most dangerous line a measurement can print is "0 under floor" from
          // a run that measured nothing: H4.0's ad-hoc harness reported exactly
          // that with 32 of 32 nodes unmeasurable, because every box came out
          // NaN. Counted here, named below, and fatal at the end when it is
          // paired with a zero failure count.
          if (r === null) { unmeasured++; unmeasuredRows.push({ ground: g.key, surface: s.key,
            cls: nd.cls, text: (nd.text || "").slice(0, 28), note: m.note || null, px: m.pixels }); }
          seen++;
          rows.push({ ground: g.key, surface: s.key, tier: s.tier || "pro", inPreview: !!nd.inPreview,
                      step, cls: nd.cls, elId: nd.elId, tag: nd.tag,
                      text: nd.text, fs: nd.fs, fw: nd.fw, big, floor, ratio: r,
                      pixels: m.pixels, ink: m.ink || null, bg: m.bg || null,
                      color: nd.color, shadow: nd.shadow });
        }
      }
      // "all clear" is printed ONLY when nothing failed AND nothing was
      // unmeasurable. Anything else says which, because the two are different
      // findings and only one of them is about the product.
      const verdict = under && unmeasured ? `${under} UNDER FLOOR, ${unmeasured} UNMEASURABLE`
                    : under ? `${under} UNDER FLOOR`
                    : unmeasured ? `${unmeasured} UNMEASURABLE (this is NOT a pass)`
                    : "all clear";
      console.log(`  ${s.key.padEnd(13)} ${String(seen).padStart(4)} nodes over ${sc.steps || 1} screen(s)   ${verdict}`);
    }
  }

  // ---------------------------------------------------------------- the run
  // [H4.1] WHAT THE RUN ITSELF DID, reported before any finding about the
  // product, because a finding from a run that mislabelled its grounds or
  // measured nothing is not a finding.
  console.log("\nTHE RUN");
  // [ROUND E] The tier flips are a run-level fact for the same reason the
  // re-pins are: a run that measured the wrong tier is not a finding.
  console.log(`  TIER FLIPS: ${tierFlips.length}, each verified against ProAccess.getProAccessLevel after the reload`);
  if (repins.length) {
    console.log(`  RE-PINS: the ground class had drifted ${repins.length} time(s) and was re-asserted (H3a)`);
    for (const r of repins.slice(0, 12)) {
      console.log(`    ${r.ground}/${r.surface}#${r.step}: had "${r.had}" want "${r.want}"`);
    }
    if (repins.length > 12) console.log(`    ... and ${repins.length - 12} more`);
  } else {
    console.log("  RE-PINS: none - the ground class held for every capture pair");
  }

  const totalUnder = rows.filter((r) => r.ratio !== null && r.ratio < r.floor).length;
  console.log(`  UNMEASURABLE: ${unmeasuredRows.length} of ${rows.length} node(s)`);
  for (const u of unmeasuredRows.slice(0, 20)) {
    console.log(`    ${u.ground}/${u.surface}  ${u.cls}  "${u.text}"  ${u.note || ""} px=${u.px}`);
  }
  if (unmeasuredRows.length > 20) console.log(`    ... and ${unmeasuredRows.length - 20} more`);

  // THE FATAL PAIRING (H4.0 fault 1). "0 under floor" from a run with
  // unmeasurable nodes is the shape of a false green: the number that looks
  // like a pass is produced by the nodes that were never measured. A run may
  // legitimately fail to measure a 3px glyph, so this does not forbid
  // unmeasurable nodes - it forbids REPORTING A CLEAN SWEEP alongside them.
  if (unmeasuredRows.length && totalUnder === 0) {
    console.error("\nREFUSED: 0 under floor with " + unmeasuredRows.length +
      " unmeasurable node(s). That is not a pass (H4.0).");
    console.error("  The nodes above were never measured, so the zero is about them, not the product.");
    console.error("  Fix the instrument or name each one, then re-run. --allow-unmeasurable overrides.");
    if (!flag("--allow-unmeasurable")) process.exitCode = 3;
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
// THE SAME-TREE RE-RUN CONTROL (H3c). Two sweeps in, every moved row out.
//
// WHY THIS IS NOT A DIFF TOOL. A row that moved between two trees is not a
// finding until you know how far rows move between two runs of ONE tree. H3c
// nearly reported three noise readings as a regression on a locked surface;
// the same-tree control moved seven rows, one of them the identical node, by
// more than the difference being investigated. So:
//
//   node tools/sweep-ink.mjs --compare before.json after.json
//       every moved row, labelled "vs noise: UNKNOWN"
//   node tools/sweep-ink.mjs --compare before.json after.json --noise twice.json
//       where twice.json is a SECOND sweep of the SAME tree as before.json;
//       each delta is then labelled against that tree's measured noise floor
//
// A delta at or below the noise floor is NOISE and must not be reported as a
// product change. A delta above it is a candidate, still to be explained.
function compare(aPath, bPath, noisePath) {
  const load = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  const rowsOf = (j) => (Array.isArray(j) ? j : (j.rows || []));
  // The hero and the clock TICK, so a key that includes their text never
  // matches across runs (H4.0 fault 3, one layer along). Text is part of the
  // key because it is what makes a row legible, so the digits are masked.
  const key = (r) => [r.ground, r.surface, r.step, r.cls, r.elId || "",
                      String(r.text || "").replace(/\d+/g, "#").slice(0, 24)].join(" | ");
  const index = (f) => {
    const m = new Map();
    for (const r of rowsOf(load(f))) m.set(key(r), r);
    return m;
  };
  const A = index(aPath), B = index(bPath);

  let floor = null;
  const unstable = new Set();
  if (noisePath) {
    const Nz = index(noisePath);
    const deltas = [];
    for (const [k, a] of A) {
      const z = Nz.get(k);
      if (!z || a.ratio === null || z.ratio === null) continue;
      const dd = Math.abs(a.ratio - z.ratio);
      deltas.push(dd);
      // [H4.6] NAMED, NOT JUST COUNTED. A node that moves between two runs of
      // ONE tree is unstable by identity - Home's one-time tips and
      // search-mode-label are the whole population here - and a delta on one of
      // those is noise however large it is. That is the distinction H3c made by
      // hand, and no single threshold can express it.
      if (dd >= 0.5) unstable.add(k);
    }
    deltas.sort((x, y) => x - y);
    const at = (q) => deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * q))] : 0;
    const max = deltas.length ? deltas[deltas.length - 1] : 0;
    // [H4.6] THE p99, NOT THE MAX. Taking the largest same-tree swing as the
    // floor let ONE unstable node excuse the entire product: on this repo the
    // max is 10.84 and the p99 is 0.18, and the max-as-floor labelled a real
    // +3.77 improvement "NOISE". The distribution is bimodal - 95% of rows are
    // perfectly stable - so the tail is a property of a few nodes, not of the
    // measurement.
    floor = at(0.99);
    const moved = deltas.filter((x) => x >= 0.01).length;
    console.log(`NOISE, measured on the SAME tree twice, over ${deltas.length} shared rows:`);
    console.log(`  p50 ${at(0.5).toFixed(4)}   p95 ${at(0.95).toFixed(2)}   p99 ${floor.toFixed(2)}   max ${max.toFixed(2)}`);
    console.log(`  ${moved} row(s) moved at all; ${unstable.size} are UNSTABLE BY IDENTITY (>= 0.5 on one tree)`);
    for (const k of [...unstable].slice(0, 8)) console.log(`    unstable: ${k}`);
    if (unstable.size > 8) console.log(`    ... and ${unstable.size - 8} more`);
    console.log("  THE FLOOR IS THE p99. The max is printed beside it because taking the max");
    console.log("  as the floor lets one unstable node excuse every other delta (H4.6).\n");
  } else {
    console.log("NO --noise RUN SUPPLIED, so every delta below is labelled UNKNOWN.");
    console.log("  Sweep the SAME tree twice and pass it as --noise before calling any of");
    console.log("  these a regression. H3c is the round that learned this.\n");
  }

  const moved = [], onlyA = [], onlyB = [];
  for (const [k, b] of B) {
    const a = A.get(k);
    if (!a) { onlyB.push(k); continue; }
    if (a.ratio === null || b.ratio === null) continue;
    if (Math.abs(a.ratio - b.ratio) >= 0.01) moved.push({ k, from: a.ratio, to: b.ratio, floorAt: b.floor });
  }
  for (const k of A.keys()) if (!B.has(k)) onlyA.push(k);

  moved.sort((x, y) => (x.to - x.from) - (y.to - y.from));
  console.log(`MOVED: ${moved.length}   only-in-before: ${onlyA.length}   only-in-after: ${onlyB.length}`);
  for (const m of moved) {
    const delta = m.to - m.from;
    const verdict = floor === null ? "vs noise: UNKNOWN"
                  : unstable.has(m.k) ? "NOISE (node is unstable on one tree)"
                  : Math.abs(delta) <= floor ? "NOISE (<= p99)"
                  : "ABOVE THE NOISE FLOOR";
    const crossed = m.from >= m.floorAt && m.to < m.floorAt ? "  *** CROSSED DOWN ***"
                  : m.from < m.floorAt && m.to >= m.floorAt ? "  crossed up" : "";
    console.log(`  ${m.from.toFixed(2)} -> ${m.to.toFixed(2)}  ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}  ${verdict}${crossed}   ${m.k}`);
  }
  if (onlyA.length) { console.log("\n  gone in the after run:"); onlyA.slice(0, 15).forEach((k) => console.log("    " + k)); }
  if (onlyB.length) { console.log("\n  new in the after run:"); onlyB.slice(0, 15).forEach((k) => console.log("    " + k)); }
  process.exit(0);
}

// =========================================================================
if (flag("--self-test")) selfTest();
else if (flag("--compare")) {
  const i = argv.indexOf("--compare");
  const a = argv[i + 1], b = argv[i + 2];
  if (!a || !b) { console.error("--compare needs two sweep files"); process.exit(2); }
  compare(a, b, arg("--noise", null));
}
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
  node tools/sweep-ink.mjs --compare before.json after.json [--noise twice.json]
      the SAME-TREE RE-RUN CONTROL (H3c). A row that moved between two trees
      is not a finding until you know how far rows move between two runs of
      ONE tree. Pass a second sweep of the before-tree as --noise and every
      delta is labelled against that measured floor.

  --grounds a,b   subset of ${GROUNDS.map((g) => g.key).join(",")}
  --surfaces a,b  subset of ${SURFACES.map((s) => s.key).join(",")}
  --profile NAME  seed-fixture profile (default busy-messy)
  --port N        CDP port (default: unique per run, I25)
  --attach N      use a browser already seeded and running on port N
  --keep          leave the browser and scratch profile up afterwards
`);
  process.exit(argv.length ? 2 : 0);
}
