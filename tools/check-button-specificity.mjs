#!/usr/bin/env node
// ===========================================================================
// BUTTON SPECIFICITY GATE - a ground rule must not outrank a state modifier.
//
// THE CLASS, NOT THE INSTANCES. Three rounds have now fixed the same defect:
//   aeaf99d  html.has-bg.bg-light .tt-modal-btn (0,3,1) beat
//            .tt-modal-btn-danger (0,1,0), so on EVERY light wallpaper the
//            destructive button in EVERY confirm rendered identical to Cancel.
//            The red was not dimmed, it was gone.
//   this one .tt-modal-btn-primary-fill, the main affirmative button, rendered
//            byte-identical to Cancel on light - colour, background AND the
//            gradient, because the ground rule uses the `background` shorthand
//            which resets background-image.
//   this one .sat-pomo-chip.is-active rendered byte-identical to an INACTIVE
//            chip, so "which phase am I in" had no answer on a light ground.
//
// Raising each modifier as it is found is what produced three rounds of one
// fix. The modifier written next month starts at (0,1,0) again and nobody
// notices until someone photographs it. So this gate enforces the RULE instead:
//
//   IF a control has a ground rule that paints it (html.has-bg / .bg-light /
//   .bg-dark / .bg-image setting colour, background or border), THEN every
//   state modifier on that control that paints the same property must ALSO
//   have a ground-scoped form, so it can win where the ground rule applies.
//
// WHY STATIC RATHER THAN RENDERED. The runtime probe that found these two is
// better evidence - it reads what the browser actually computed - but it needs
// a browser, a profile and a fixture, and it can only see controls something
// puts on screen. This runs in the build, sees every rule in the sheet, and
// fails the moment a new state modifier is written without its ground form.
// The two are complementary: this one catches the omission, the probe proves
// the outcome.
//
// Usage:
//   node tools/check-button-specificity.mjs [repoRoot]
//   node tools/check-button-specificity.mjs --self-test
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const repoRoot = args.find((a) => !a.startsWith("--")) ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A real brace matcher. An earlier pass at this used a regex over the whole
// file and mis-parsed every @media block, which is how it reported zero holes
// for a hole that was plainly there.
export function rules(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const b = text.indexOf("{", i);
    if (b === -1) break;
    const sel = text.slice(i, b).trim();
    let depth = 1, j = b + 1;
    while (j < n && depth) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    const body = text.slice(b + 1, j - 1);
    if (sel.startsWith("@")) {
      if (body.includes("{")) out.push(...rules(body));
    } else {
      for (const one of sel.split(",")) {
        const t = one.trim();
        if (t) out.push([t, body]);
      }
    }
    i = j;
  }
  return out;
}

// (id, class, element). This sheet uses no :is()/:where(), so the simple count
// is exact rather than approximate.
export function specificity(sel) {
  const t = sel.replace(/::?[a-z-]+\([^)]*\)/g, " ");
  const ids = (t.match(/#[\w-]+/g) || []).length;
  const cls = (t.match(/\.[\w-]+/g) || []).length +
              (t.match(/\[[^\]]+\]/g) || []).length +
              (t.match(/(?<!:):(?!:)[a-z-]+/g) || []).length;
  const els = (t.match(/(?:^|[\s>+~])([a-z][\w-]*)/g) || []).length;
  return [ids, cls, els];
}
const rank = (s) => s[0] * 1e6 + s[1] * 1e3 + s[2];

const GROUND = /html\.(?:has-bg|bg-light|bg-dark|bg-image)/;
const PAINT = /(?:^|;)\s*(color|background|background-color|border|border-color)\s*:/gm;
// A STATE modifier encodes meaning: what this control IS right now. An identity
// class (.tt-modal-btn) says which control it is; a state class says whether it
// is dangerous, primary, active, gated.
const STATE = /\.[\w-]*(?:danger|primary|destructive|urgent|warning|is-active|is-on|is-gated|is-selected|is-live)\b/;

function paints(body) {
  PAINT.lastIndex = 0;
  const found = new Set();
  let m;
  while ((m = PAINT.exec(body))) found.add(m[1].replace("-color", "").replace("background-color", "background"));
  return found;
}
const classesOf = (sel) => (sel.match(/\.([\w-]+)/g) || []).map((c) => c.slice(1));

export function audit(css) {
  const all = rules(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  const grounds = [], states = [];
  for (const [sel, body] of all) {
    const p = paints(body);
    if (!p.size) continue;
    if (GROUND.test(sel)) grounds.push({ sel, sp: specificity(sel), p });
    else if (STATE.test(sel)) states.push({ sel, sp: specificity(sel), p });
  }
  const findings = [];
  // Computed ONCE per state modifier, before any ground rule is compared to it.
  // The first cut computed it inside the loop and compared the covering rule's
  // rank against the ground rule currently under test - which meant a correctly
  // ground-scoped form was measured against ITSELF and reported as a failure.
  // The self-test's negative control caught that, which is exactly why it is
  // there: a gate that cries wolf on every correct control gets switched off.
  const hasGroundForm = (st) => {
    const need = classesOf(st.sel);
    return [...grounds, ...states].some((o) =>
      o.sel !== st.sel && GROUND.test(o.sel) && need.every((c) => o.sel.includes("." + c)));
  };
  for (const st of states) {
    if (GROUND.test(st.sel) || hasGroundForm(st)) continue;
    const stateClasses = classesOf(st.sel);
    // the control root: every class on the state rule that is NOT the state word
    for (const g of grounds) {
      if (GROUND.test(st.sel)) continue;              // already ground-scoped
      const gCls = classesOf(g.sel).filter((c) => !/^(has-bg|bg-light|bg-dark|bg-image)$/.test(c));
      if (!gCls.length) continue;
      // Does the ground rule target a control this state modifier also targets?
      // Either the same class, or a class the state class is built on
      // (.tt-modal-btn vs .tt-modal-btn-primary-fill), which is the shape that
      // hid the second instance from a naive subset test.
      const related = gCls.some((gc) =>
        stateClasses.some((sc) => sc === gc || sc.startsWith(gc + "-")));
      if (!related) continue;
      // Mutually exclusive by :not() is not a collision.
      if (gCls.some((gc) => new RegExp(":not\\([^)]*\\." + gc + "\\b").test(st.sel))) continue;
      if (stateClasses.some((sc) => new RegExp(":not\\([^)]*\\." + sc + "\\b").test(g.sel))) continue;
      const overlap = [...st.p].filter((x) => g.p.has(x));
      if (!overlap.length) continue;
      if (rank(g.sp) <= rank(st.sp)) continue;
      if (findings.some((f) => f.state === st.sel)) continue;
      findings.push({ state: st.sel, sp: st.sp, ground: g.sel, gsp: g.sp, overlap });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- self-test
if (args.includes("--self-test")) {
  let pass = 0, fail = 0;
  const chk = (n, ok, x) => { ok ? pass++ : fail++;
    console.log("  " + (ok ? "PASS  " : "FAIL  ") + n + (x ? "   << " + x : "")); };

  chk("specificity counts classes, ids and elements",
    JSON.stringify(specificity("html.has-bg.bg-light .tt-modal-btn")) === "[0,3,1]",
    JSON.stringify(specificity("html.has-bg.bg-light .tt-modal-btn")));
  chk("...and a bare state class is (0,1,0)",
    JSON.stringify(specificity(".tt-modal-btn-danger")) === "[0,1,0]");
  chk("the parser descends into @media rather than mis-slicing it",
    rules("@media (x){ .a{color:red} } .b{color:blue}").length === 2);

  // THE POSITIVE CONTROL: the exact shape that shipped twice must be caught.
  const bad = audit(`
    html.has-bg.bg-light .tt-modal-btn { color:#1f1f1f; background:rgba(0,0,0,.04); }
    .tt-modal-btn-danger { color:#ff8a8a; background:rgba(208,2,27,.22); }`);
  chk("CATCHES a state modifier outranked by a ground rule", bad.length === 1,
    bad.length ? bad[0].state + " < " + bad[0].ground : "found nothing");

  // THE NEGATIVE CONTROL, and it is the one that matters: the same pair with a
  // ground-scoped form present must NOT be reported, or the gate cries wolf on
  // every correctly-written control and gets switched off.
  const good = audit(`
    html.has-bg.bg-light .tt-modal-btn { color:#1f1f1f; background:rgba(0,0,0,.04); }
    .tt-modal-btn-danger { color:#ff8a8a; background:rgba(208,2,27,.22); }
    html.has-bg.bg-light .tt-modal-btn.tt-modal-btn-danger { color:#6b1411; background:rgba(208,2,27,.1); }`);
  chk("...and STAYS QUIET once a ground-scoped form exists", good.length === 0,
    good.length ? good[0].state : "silent");

  // And a :not() pair can never co-occur, so it is not a collision.
  const excl = audit(`
    html.has-bg.bg-light .gd-btn:not(.gd-btn-primary) { color:#111; }
    .gd-btn-primary { color:#fff; }`);
  chk("...and does not report a :not() pair that cannot co-occur", excl.length === 0);

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

// ------------------------------------------------------------------ the gate
let css;
try {
  css = fs.readFileSync(path.join(repoRoot, "newtab.css"), "utf8").replace(/\r\n/g, "\n");
} catch (e) {
  console.error("SUBJECT DID NOT LOAD - " + e.message);
  process.exit(2);
}

console.log("\nBUTTON SPECIFICITY GATE - a ground rule must not outrank a state modifier\n");
const findings = audit(css);
for (const f of findings) {
  console.log("  FAIL  " + f.state + "  (" + f.sp.join(",") + ")");
  console.log("        is outranked by  " + f.ground + "  (" + f.gsp.join(",") + ")");
  console.log("        on: " + f.overlap.join(", "));
  console.log("        FIX: add a ground-scoped form, e.g. html.has-bg.bg-light " +
    f.state.trim() + " { ... }");
}
// NOT ENFORCING YET, and the precedent is check-i18n-sites: it shipped
// reporting its backlog, published the count every run, and was flipped once
// the count reached zero. Turning this red on day one would fail the build for
// 19 pre-existing controls and the gate would simply be removed.
//
// WHAT IT ALREADY BUYS, non-enforcing: the count is printed on every build, so
// a NEW state modifier written without its ground form moves the number and is
// visible in the same breath as the commit that added it. That is the thing
// three rounds of this defect did not have.
//
// The 19 are listed above. They are not a backlog of contrast failures - most
// will be harmless, because a ground rule overriding a decorative border costs
// nothing. Each needs the runtime probe pointed at it to say whether the
// property it loses CARRIES MEANING, which is the judgement this gate cannot
// make and deliberately does not try to.
const ENFORCING = false;
const BASELINE = 19;

if (!findings.length) {
  console.log("\n  BUTTON SPECIFICITY: PASS - no state modifier is outranked by a ground rule\n");
  process.exit(0);
}
if (ENFORCING) {
  console.log(`\n  BUTTON SPECIFICITY: FAIL - ${findings.length} state modifier(s) outranked\n`);
  process.exit(1);
}
const worse = findings.length > BASELINE;
console.log(`\n  BUTTON SPECIFICITY: ${worse ? "FAIL" : "PASS"} - ` +
  `${findings.length} state modifier(s) outranked by a ground rule ` +
  `(baseline ${BASELINE}, not yet enforcing)\n`);
if (worse) {
  console.log("  The count went UP. A new state modifier was written without a\n" +
    "  ground-scoped form - that is the defect this gate exists for.\n");
}
process.exit(worse ? 1 : 0);
