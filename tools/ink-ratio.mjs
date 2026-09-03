#!/usr/bin/env node
// ===========================================================================
// INK RATIO - contrast measurement that composites alpha against its backdrop.
//
// WHY THIS IS A FILE AND NOT THREE LINES IN A HARNESS. [1.7.2]'s ink pass used
// an inline helper that read an rgba() colour as if it were opaque. That
// reported 1.00:1 for white text on an rgba(255,255,255,0.08) field sitting on
// a dark floater, which is a FALSE FAILURE and was easy to spot because the
// surface obviously worked.
//
// THE SAME BUG PRODUCES FALSE PASSES, AND THOSE ARE INVISIBLE. A translucent
// DARK fill over a LIGHT surface measures as though it were opaque dark and
// reports a comfortable ratio, while the real composite is light-on-light and
// fails. An instrument that errs toward passing is worse than no instrument,
// because a green result is then indistinguishable from a real one (BUGS P13).
//
// So: composite every layer onto its actual backdrop, THEN measure. The
// self-test below carries a NEGATIVE CONTROL for exactly the false-pass case,
// so the fix is demonstrated rather than asserted.
//
//   node tools/ink-ratio.mjs --self-test
// ===========================================================================

// Parse "rgb(r, g, b)" / "rgba(r, g, b, a)" / "#rrggbb" / "#rgb" -> [r,g,b,a].
export function parseColor(c) {
  if (Array.isArray(c)) return c.length === 4 ? c.slice() : [c[0], c[1], c[2], 1];
  const s = String(c || "").trim();
  if (!s || s === "none" || s === "transparent") return [0, 0, 0, 0];
  if (s[0] === "#") {
    const h = s.slice(1);
    const x = h.length === 3 ? h.split("").map((ch) => ch + ch) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
    return [parseInt(x[0], 16), parseInt(x[1], 16), parseInt(x[2], 16), 1];
  }
  const m = s.match(/-?[\d.]+/g);
  if (!m || m.length < 3) return null;
  return [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2]), m.length > 3 ? parseFloat(m[3]) : 1];
}

// Source-over: put `fg` on top of `bg`. `bg` is assumed opaque - it is the
// bottom of the stack, and every caller below builds the stack bottom-up.
export function over(fg, bg) {
  const f = parseColor(fg), b = parseColor(bg);
  if (!f || !b) return null;
  const a = f[3];
  return [
    f[0] * a + b[0] * (1 - a),
    f[1] * a + b[1] * (1 - a),
    f[2] * a + b[2] * (1 - a),
    1
  ];
}

// Flatten a stack given BOTTOM FIRST: flatten(["#000", frostRgba, fieldRgba]).
export function flatten(stack) {
  let acc = parseColor(stack[0]);
  if (!acc) return null;
  if (acc[3] < 1) acc = over(acc, [255, 255, 255, 1]);   // nothing below: assume white page
  for (let i = 1; i < stack.length; i++) {
    const next = over(stack[i], acc);
    if (!next) return null;
    acc = next;
  }
  return acc;
}

export function relLuminance(c) {
  const p = parseColor(c);
  if (!p) return null;
  const f = p.slice(0, 3).map((v) => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

// THE ONE ENTRY POINT CALLERS SHOULD USE.
//   inkStack  bottom-first stack ending in the text colour
//   bgStack   bottom-first stack for the backdrop the text sits on
// Both are flattened before the ratio, so alpha anywhere in either stack is
// resolved against what is actually beneath it.
export function contrast(inkStack, bgStack) {
  const bg = flatten([].concat(bgStack));
  if (!bg) return null;
  // Text alpha composites onto its OWN backdrop, which is the flattened bg.
  const ink = flatten([].concat(bgStack, inkStack.slice(-1)));
  if (!ink) return null;
  const A = relLuminance(ink), B = relLuminance(bg);
  if (A === null || B === null) return null;
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
}

// The naive version [1.7.2] used, kept ONLY so the self-test can demonstrate the
// difference. Never call this for a real measurement.
export function naiveContrast(ink, bg) {
  const A = relLuminance(ink), B = relLuminance(bg);
  if (A === null || B === null) return null;
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
}

if (process.argv.includes("--self-test")) {
  let pass = 0, fail = 0;
  const chk = (n, ok, x = "") => { ok ? pass++ : fail++; console.log("  " + (ok ? "PASS  " : "FAIL  ") + n + (x ? "   << " + x : "")); };
  const r2 = (v) => v === null ? "null" : v.toFixed(2);

  console.log("INK RATIO - self-test\n");

  // --- sanity: the two extremes and a known value
  chk("black on white is 21:1", Math.abs(contrast(["#000"], ["#fff"]) - 21) < 0.01, r2(contrast(["#000"], ["#fff"])));
  chk("white on white is 1:1", Math.abs(contrast(["#fff"], ["#fff"]) - 1) < 0.01, r2(contrast(["#fff"], ["#fff"])));

  // --- THE FALSE FAILURE [1.7.2] actually hit.
  // White text on an rgba(255,255,255,0.08) field over a 0.92 dark floater over
  // a dark page. Naive reads the field as opaque white and reports 1.00:1.
  const fieldStack = ["#101014", "rgba(30,30,30,0.92)", "rgba(255,255,255,0.08)"];
  const naiveFalseFail = naiveContrast("#fff", "rgba(255,255,255,0.08)");
  const realField = contrast(["#fff"], fieldStack);
  console.log(`\n  [false FAILURE] naive ${r2(naiveFalseFail)}:1  vs  composited ${r2(realField)}:1`);
  chk("naive reports the settings field as failing", naiveFalseFail < 4.5, r2(naiveFalseFail));
  chk("composited shows it actually passes comfortably", realField >= 4.5, r2(realField));

  // --- THE NEGATIVE CONTROL: a case that genuinely FAILS but naively PASSES.
  //
  // THE SHAPE THAT MATTERS IS LIGHT INK OVER A TRANSLUCENT DARK SCRIM ON A LIGHT
  // CARD. Naive reads rgba(0,0,0,0.12) as OPAQUE BLACK, so white-on-black scores
  // ~21:1 and sails through. Composited, that scrim over a white card is only
  // about rgb(224,224,224), and white ink on it is ~1.2:1 - unreadable. This is
  // the exact false pass the [1.7.2] REVIEW predicted, and it is invisible in a
  // green report, which is why it is pinned here rather than described.
  //
  // My first attempt at this control used DARK ink, which naive ALSO failed - so
  // it demonstrated nothing. A control that does not pass naively cannot show
  // that naive was wrong, and it took running it to notice.
  const scrimOverWhite = ["#ffffff", "rgba(0,0,0,0.12)"];
  const ink = "#ffffff";
  const naivePass = naiveContrast(ink, "rgba(0,0,0,0.12)");
  const realFail = contrast([ink], scrimOverWhite);
  console.log(`\n  [NEGATIVE CONTROL] naive ${r2(naivePass)}:1  vs  composited ${r2(realFail)}:1`);
  chk("naive PASSES this case (>= 4.5) - the false pass the old helper would have shipped",
    naivePass >= 4.5, r2(naivePass));
  chk("composited FAILS it (< 4.5) - the fixed helper catches what naive missed",
    realFail < 4.5, r2(realFail));
  chk("the two disagree by a wide margin, so this is not a rounding artifact",
    Math.abs(naivePass - realFail) > 2, `delta ${(naivePass - realFail).toFixed(2)}`);

  // --- the ordering rule: a stack is BOTTOM FIRST
  const darkCard = flatten(["#101014", "rgba(30,30,30,0.85)"]);
  chk("flatten resolves the frosted card to a real opaque colour",
    darkCard && darkCard[0] > 24 && darkCard[0] < 34, JSON.stringify(darkCard && darkCard.map(Math.round)));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
