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

// =========================================================================
// [H4.2] THE SECOND RULE: A v1 GROUND BRANCH MUST NOT OUTRANK A v2 CONTAINER.
//
// Four instances this arc, all one shape - a v1 html.has-bg / bg-light ink rule
// reaching a v2 surface that no longer changes with the ground:
//   H1b    tile #2's ink
//   FIX-2  the streak number
//   H3a    the danger button
//   H3a    html.has-bg .seg-btn.active beating .tt-modal .seg-btn.active
//
// A v2 container declares its own ink precisely BECAUSE it does not change with
// the ground - a tile is the same colour on every wallpaper (H1a's ruling: the
// tint alphas rise on a light ground, the inks do not move). So a ground rule
// that wins inside one has overruled a decision already made.
//
// RANK, NOT EXISTENCE. H3a's fix was to give the container rule its own
// ground-scoped forms so it outranks the v1 rule; a gate that forbade the v1
// rule outright would forbid the fix. This fails only when the ground rule
// actually WINS.
export const V2_CONTAINERS = [".tile", ".dash-tile", ".tt-modal", ".tt-context-menu"];

export function containerBreaches(text) {
  // rules() yields [sel, body] TUPLES and paints() yields a SET - read from the
  // producer above rather than assumed.
  //
  // AND COMMENTS COME OFF FIRST. rules() treats everything between one rule's
  // `}` and the next `{` as the selector, comments included, which the existing
  // audit never cared about because it only regex-TESTS selectors. specificity()
  // COUNTS them: a hex colour in a comment reads as an ID, and one finding here
  // came back ranked 1004019 because the note above it mentioned #6fb1ff. A rank
  // computed from prose is not a rank. Stripped here only, so the gate's
  // published 19-finding baseline still counts exactly what it counted before.
  const rs = rules(text.replace(/\/\*[\s\S]*?\*\//g, " "));
  const out = [];
  // Every (class, property) a container-scoped rule paints, with its best rank.
  const owned = new Map();
  for (const [sel, body] of rs) {
    if (!V2_CONTAINERS.some((c) => sel.includes(c))) continue;
    const props = [...paints(body)];
    if (!props.length) continue;
    const subject = sel.trim().split(/\s+/).pop();      // the node it paints
    const key = classesOf(subject).sort().join(".");
    if (!key) continue;
    for (const pr of props) {
      const k = key + "|" + pr;
      const r = rank(specificity(sel));
      if (!owned.has(k) || owned.get(k).r < r) owned.set(k, { r, sel });
    }
  }
  // Any v1 ground rule that can REACH INSIDE a container and outranks its ink.
  //
  // "Can reach" is the whole difficulty. A ground rule with an ancestor
  // qualifier cannot leave it: html.has-bg .insights-tab .seg-btn never
  // matches inside .tt-modal. Only the UNQUALIFIED shape reaches everywhere -
  // html.has-bg .seg-btn.active - and that is the shape of all four instances
  // this arc. So: exactly one compound after the html qualifier, and the same
  // subject compound as the container rule, so the two really can select one
  // node rather than merely sharing a class name.
  const compoundKey = (compound) => classesOf(compound).sort().join(".");
  for (const [sel, body] of rs) {
    const s = sel.trim();
    if (!GROUND.test(s)) continue;
    if (V2_CONTAINERS.some((c) => s.includes(c))) continue;   // it names one: fine
    const parts = s.split(/\s+/).filter(Boolean);
    // html.<ground> <subject> and nothing between them
    if (parts.length !== 2 || !/^html\./.test(parts[0])) continue;
    const props = [...paints(body)];
    if (!props.length) continue;
    const key = compoundKey(parts[1]);
    if (!key) continue;
    const r = rank(specificity(s));
    for (const pr of props) {
      const own = owned.get(key + "|" + pr);
      if (!own) continue;
      if (r > own.r) out.push({ cls: key, prop: pr, ground: s, groundRank: r,
                                container: own.sel.trim(), containerRank: own.r });
    }
  }
  return out;
}

// =========================================================================
// [ROUND G] THE THIRD RULE: ONE ACTION COLOUR. A v1 ACCENT FILL MUST NOT
// OUTRANK A v2 --action FILL ON THE SAME CONTROL.
//
// WHY THIS IS A THIRD SECTION AND NOT A WIDENING OF THE SECOND. Round F found
// every modal primary in the product rendering v1 blue on a light wallpaper,
// and the obvious diagnosis - "the v1-vs-v2 section checks color but not
// background" - is WRONG. paints() has matched `background` since H4.2: the
// property was never the problem. Two other things were, and both were
// measured rather than reasoned about:
//
//   1. THE SUBSTRING EXEMPTION. containerBreaches skips any ground rule whose
//      selector "names a container", tested with sel.includes(".tt-modal").
//      `.tt-modal-btn-primary-fill` CONTAINS `.tt-modal`, so the breaching
//      rule was exempted before any property was looked at. Verified: with
//      exactly the two rules in question as input, containerBreaches returns
//      []. Round A's review flagged this substring match as a weakness; this
//      is it firing.
//
//   2. SECTION ONE EXCUSES IT TOO, for a different reason. hasGroundForm asks
//      whether a ground-scoped form of the state modifier EXISTS. H3a wrote
//      three, and the best of them is (0,3,1) against the v1 rule's (0,4,1) -
//      so a form existed, did not win, and the state was skipped.
//
// SO THE TEST HERE IS NOT ABOUT RANK ALONE, WHICH IS WHAT MAKES IT SAFE.
// A gate that failed whenever a ground rule outranked a bare class rule would
// also fail H3a's own fix for the danger button, which deliberately adds
// .tt-modal-btn to reach (0,4,1). Structure cannot tell that rule from the
// blue one - both are ground-scoped supersets that outrank a bare class. What
// separates them is the COLOUR SYSTEM they paint: one control painted
// var(--action) by one rule and v1 blue by another is a contradiction, and
// the contradiction is the thing worth failing on. That is also exactly the
// round's title.
const V1_ACCENT = /var\(\s*--accent\b|#1a73e8|#1667d4|#125bbb|#186cdd/i;
const V2_ACTION = /var\(\s*--action\b/;

// The declared VALUE for one property, so a rule can be classified by what it
// paints rather than by where it sits.
function declValue(body, prop) {
  const re = new RegExp("(?:^|;)\\s*" + prop + "(?:-color)?\\s*:([^;]*)", "i");
  const m = re.exec(body);
  return m ? m[1] : "";
}

export function actionColourBreaches(text) {
  const rs = rules(text.replace(/\/\*[\s\S]*?\*\//g, " "));
  const v2 = new Map();   // subject-key -> the best-ranked --action FILL
  const v1 = [];          // every v1 accent FILL, with its rank
  for (const [sel, body] of rs) {
    if (!paints(body).has("background")) continue;
    const key = classesOf(sel.trim().split(/\s+/).pop()).sort().join(".");
    if (!key) continue;
    const decl = declValue(body, "background");
    const r = rank(specificity(sel));
    if (V2_ACTION.test(decl)) {
      if (!v2.has(key) || v2.get(key).r < r) v2.set(key, { r, sel: sel.trim() });
    } else if (V1_ACCENT.test(decl)) {
      v1.push({ key, sel: sel.trim(), r, decl: decl.trim().slice(0, 60) });
    }
  }
  const out = [];
  for (const g of v1) {
    const gCls = g.key.split(".");
    for (const [ownKey, own] of v2) {
      // The v1 rule must be able to select a node the v2 rule paints: its
      // subject compound is the same set, or a SUPERSET of it (the v1 rule
      // adds an identity class, which is the shape of the modal primary).
      const ownCls = ownKey.split(".");
      if (!ownCls.every((c) => gCls.includes(c))) continue;
      if (g.r <= own.r) continue;
      out.push({ cls: ownKey, v1: g.sel, v1Rank: g.r, v1Value: g.decl, v2: own.sel, v2Rank: own.r });
    }
  }
  return out;
}

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

  // ---- [ROUND G] one action colour ----
  const RG_V2 = ".tt-modal-btn-primary-fill { background: var(--action); }";
  const RG_V1 = "html.has-bg.bg-light .tt-modal-btn.tt-modal-btn-primary-fill { background: linear-gradient(135deg, var(--accent) 0%, #1667d4 100%); }";
  chk("CATCHES a v1 accent fill outranking a v2 --action fill",
    actionColourBreaches(RG_V2 + "\n" + RG_V1).length === 1,
    JSON.stringify(actionColourBreaches(RG_V2 + "\n" + RG_V1)));
  chk("...and names both sides",
    (actionColourBreaches(RG_V2 + "\n" + RG_V1)[0] || {}).v1Rank === 4001 &&
    (actionColourBreaches(RG_V2 + "\n" + RG_V1)[0] || {}).v2Rank === 1000);
  chk("PASSES when the v2 rule outranks the v1 one (the fix must not fail)",
    actionColourBreaches(RG_V1 + "\nhtml.has-bg.bg-light .tt-modal-btn.tt-modal-btn-primary-fill { background: var(--action); }").length === 0);
  chk("PASSES a v1 accent fill on a control no --action rule paints",
    actionColourBreaches("#some-v1-thing { background: var(--accent); }").length === 0);
  chk("does NOT fire on a DIFFERENT control that merely shares no class",
    actionColourBreaches(RG_V2 + "\nhtml.has-bg.bg-light .unrelated-btn { background: var(--accent); }").length === 0);
  chk("does not mistake an --action fill for a v1 one",
    actionColourBreaches(".a { background: var(--action); }\nhtml.has-bg .a.b { background: var(--action); }").length === 0);

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
// =========================================================================
// [H4.2] THE SECOND RULE'S VERDICT, AND IT IS ENFORCING.
//
// Unlike the baseline above, this rule starts at zero, so it can be red from
// day one: the four instances this arc produced are fixed, and a fifth must
// fail the build rather than move a counter. H1b's tile #2, FIX-2's streak
// number and H3a's two are the whole population, and H4.2 retired
// .dash-hero-region's light branch - the last v1 ground rule that owned a
// surface a v2 container had taken over.
const breaches = containerBreaches(css);
const CONTAINER_BASELINE = 0;
console.log("\n  v1 GROUND BRANCH vs v2 CONTAINER");
console.log("    containers: " + V2_CONTAINERS.join(" "));
if (!breaches.length) {
  console.log("    ok   no v1 ground rule outranks a v2 container's own ink\n");
} else {
  const seen = new Set();
  for (const b of breaches) {
    const k = b.cls + "|" + b.prop;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log("    FAIL  ." + b.cls + " { " + b.prop + " }");
    console.log("          ground    (" + b.groundRank + ")  " + b.ground);
    console.log("          container (" + b.containerRank + ")  " + b.container);
    console.log("          FIX: give the CONTAINER rule its ground-scoped forms so it wins,");
    console.log("               as H3a did - do not delete the v1 rule, which other surfaces read.");
  }
  console.log("");
}
// ANTI-VACUITY: the scan must have found containers to check at all, or a
// refactor that renamed .tile would make this row pass by measuring nothing.
const containerRules = rules(css.replace(/\/\*[\s\S]*?\*\//g, " ")).filter(([sel]) => V2_CONTAINERS.some((c) => sel.includes(c))).length;
if (containerRules < 20) {
  console.log("  REFUSED: only " + containerRules + " container-scoped rule(s) found; this row would pass vacuously.\n");
  process.exit(2);
}
console.log("    (scanned " + containerRules + " container-scoped rules)\n");

// [ROUND G] ONE ACTION COLOUR. Enforced at zero from the day it lands: the
// round that added it is the round that cleared the two sites it found, so
// there is no baseline to grandfather and no reason to let one accumulate.
const actionBreaches = actionColourBreaches(css);
const ACTION_BASELINE = 0;
console.log("\n  ONE ACTION COLOUR - a v1 accent fill must not outrank an --action fill");
if (!actionBreaches.length) {
  console.log("    ok   no v1 accent fill outranks a v2 --action fill\n");
} else {
  const seenA = new Set();
  for (const b of actionBreaches) {
    if (seenA.has(b.cls)) continue;
    seenA.add(b.cls);
    console.log("    FAIL  ." + b.cls + " { background }");
    console.log("          v1 accent (" + b.v1Rank + ")  " + b.v1);
    console.log("                          -> " + b.v1Value);
    console.log("          v2 --action (" + b.v2Rank + ")  " + b.v2);
    console.log("          FIX: retire the v1 fill if it only restores the old blue, or give");
    console.log("               the --action rule a form that outranks it. One colour, every ground.");
  }
  console.log("");
}
// ANTI-VACUITY: there must BE --action fills to protect, or a token rename
// would make this row pass by measuring nothing.
const actionFills = new Set();
for (const [sel, body] of rules(css.replace(/\/\*[\s\S]*?\*\//g, " "))) {
  if (paints(body).has("background") && /var\(\s*--action\b/.test(body)) actionFills.add(sel.trim());
}
if (actionFills.size < 3) {
  console.log("  REFUSED: only " + actionFills.size + " --action fill(s) found; this row would pass vacuously.\n");
  process.exit(2);
}
console.log("    (scanned " + actionFills.size + " --action fill rule(s))\n");

const ENFORCING = false;
const BASELINE = 19;

if (actionBreaches.length > ACTION_BASELINE) {
  console.log("  BUTTON SPECIFICITY: FAIL - " + actionBreaches.length + " v1 accent fill(s) outrank an --action fill\n");
  process.exit(1);
}
if (breaches.length > CONTAINER_BASELINE) {
  console.log(`\n  BUTTON SPECIFICITY: FAIL - ${breaches.length} v1 ground rule(s) outrank a v2 container\n`);
  process.exit(1);
}
if (!findings.length) {
  console.log("\n  BUTTON SPECIFICITY: PASS - no state modifier is outranked by a ground rule,\n" +
    "  and no v1 ground branch outranks a v2 container\n");
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
