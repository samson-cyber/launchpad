#!/usr/bin/env node
// ===========================================================================
// ACCENT BOUNDARY GATE — Asana 1218344798532326, scope item 3.
//
// THREE BLUES THAT LOOK ALIKE AND MEAN DIFFERENT THINGS. This gate exists to
// stop a later round folding them together while tidying up, which is the one
// failure mode the task predicted and the only part of it that survives the
// accent picker being cut (445f691).
//
//   --accent              INTERACTIVE or LIVE. If a picker ever returns, this
//                         is the token that follows the user's choice.
//   --pro-identity-*      THIS IS PRO. A brand mark. A Pro chip that turns
//                         green because the user picked green has stopped
//                         being a brand mark.
//   the Google logo       SOMEONE ELSE'S TRADEMARK, quoted visually in
//                         newtab.html as four SVG fills. It must not move when
//                         either of the above does, under any circumstance.
//
// A fourth token, --pro-ink-accent, is the interactive blue ON PRO'S DARK
// FROST. It is guarded the same way: it happens to equal --pro-identity-to
// today, and the whole point of naming it separately is that a change to the
// brand gradient must not silently recolour 26 unrelated controls.
//
// WHY A GATE AND NOT A COMMENT. The comments exist too, in tokens.css. But the
// [1.9.4] lesson from build.sh's allowlist is that a comment recording a class
// of error does not prevent the next instance of it — that one was twelve lines
// above the exact mistake it described and the mistake happened anyway. A gate
// is the thing that actually refuses.
//
// P2 FLOORS. A gate whose inspection set collapses to zero passes forever and
// reads exactly like a gate that looked at everything and found nothing wrong.
// Every assertion here counts what it inspected and fails if the count is zero.
//
// Exit codes: 0 ok · 1 violations · 2 gate broken.
// Exit 2 is the P5/Q1 convention — "the subject did not load" must never be
// scored as a pass.
//
//   node tools/check-accent-boundary.mjs
//   node tools/check-accent-boundary.mjs --mutate     (prove it can fail)
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUTATE = process.argv.includes("--mutate");

function read(rel) {
  const p = path.join(ROOT, rel);
  let s;
  try {
    s = fs.readFileSync(p, "utf8");
  } catch (e) {
    console.error(`GATE BROKEN: cannot read ${rel} — ${e.message}`);
    process.exit(2);
  }
  if (!s.trim()) {
    console.error(`GATE BROKEN: ${rel} is empty`);
    process.exit(2);
  }
  return s.replace(/\r\n/g, "\n");
}

// Comment-blanked copy, so a hex value CITED in a doc block is never read as a
// declaration. newtab.css cites #1a73e8 five times in prose on purpose.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

let TOKENS = read("tokens.css");
let SHEET = read("newtab.css");
let HTML = read("newtab.html");

// --------------------------------------------------------------------------
// MUTATION SEEDS. Each must be CAUGHT. A seed that does not apply is reported
// as an ANCHOR MISS, never as a catch — a mutation that changed nothing and a
// gate that noticed are indistinguishable from the exit code alone.
// --------------------------------------------------------------------------
const SEEDS = [
  { name: "pro-identity-from follows the accent",
    file: "tokens", from: "--pro-identity-from: #4a90e2;", to: "--pro-identity-from: var(--accent);" },
  { name: "pro-identity-to follows the accent",
    file: "tokens", from: "--pro-identity-to: #6fb1ff;", to: "--pro-identity-to: var(--accent);" },
  { name: "pro-ink-accent follows the accent",
    file: "tokens", from: "--pro-ink-accent: #6fb1ff;", to: "--pro-ink-accent: var(--accent);" },
  { name: "the Google logo blue is tokenised",
    file: "html", from: 'fill="#4285F4"', to: 'fill="var(--accent)"' },
  { name: "the Google logo blue is set to the accent's value",
    file: "html", from: 'fill="#4285F4"', to: 'fill="#1a73e8"' },
  { name: "a Pro gradient goes back to deriving from the accent",
    file: "sheet", from: "linear-gradient(135deg, var(--pro-identity-from) 0%, var(--pro-identity-to) 100%)",
    to: "linear-gradient(135deg, var(--accent) 0%, var(--pro-identity-to) 100%)" },
  { name: "the Pro ink token is inlined back to a literal everywhere",
    file: "sheet", from: "var(--pro-ink-accent)", to: "#6fb1ff", all: true },

  // ---- ruling 40's seeds. THE BRIEF ASKED FOR THE BLUE TO BE RE-PLANTED ON
  // #bg-save, AND THAT SEED CANNOT EXIST: #bg-save was an orphan rule - the id
  // appeared in newtab.css and in no other shipped file - so this round
  // deleted it rather than recolouring a control nobody can reach. An anchor
  // on a deleted rule would report ANCHOR MISS, which is not a catch. Both
  // halves of the intent are kept instead: seed 7 takes a REAL action back to
  // the accent, and seed 8 re-introduces #bg-save as a brand-new blue rule,
  // which is the case the census has to catch for an orphan to be safe to
  // delete at all.
  { name: "an action goes back to the accent blue",
    file: "sheet", from: ".gd-btn-primary {\n  background: var(--action);",
    to: ".gd-btn-primary {\n  background: var(--accent);" },
  { name: "a new blue action rule appears (the deleted #bg-save, re-planted)",
    file: "sheet", from: ".restore-all-btn:hover {",
    to: "#bg-save { background: var(--accent); color: var(--accent-text); }\n.restore-all-btn:hover {" },

  // ---- ruling 41's seed, and the same defect on the tag popover. Both are
  // rules that win only on FILE ORDER once the qualifying class is dropped.
  { name: "the modal primary's light branch drops .tt-modal-btn and ties again",
    file: "sheet", from: "html.has-bg.bg-light .tt-modal-btn.tt-modal-btn-primary-fill {",
    to: "html.has-bg.bg-light .tt-modal-btn-primary-fill {" },
  { name: "the tag primary drops .tag-create-btn and goes back to being dead",
    file: "sheet", from: "html.has-bg .tag-create-btn.tag-create-btn-primary {",
    to: "html.has-bg .tag-create-btn-primary {" },
];

let seedApplied = null;
if (MUTATE) {
  const which = Number(process.env.SEED || 0);
  const seed = SEEDS[which];
  if (!seed) {
    console.error(`GATE BROKEN: no seed ${which} (have ${SEEDS.length})`);
    process.exit(2);
  }
  const target = { tokens: TOKENS, sheet: SHEET, html: HTML }[seed.file];
  const hits = target.split(seed.from).length - 1;
  if (hits === 0) {
    console.error(`ANCHOR MISS: seed ${which} "${seed.name}" — its anchor is not in the file.`);
    console.error("This is NOT a catch. The mutation changed nothing.");
    process.exit(2);
  }
  const mutated = seed.all ? target.split(seed.from).join(seed.to) : target.replace(seed.from, seed.to);
  if (seed.file === "tokens") TOKENS = mutated;
  else if (seed.file === "sheet") SHEET = mutated;
  else HTML = mutated;
  seedApplied = { which, ...seed, hits };
  console.log(`MUTATED [${which}] ${seed.name}  (${hits} site${hits === 1 ? "" : "s"})`);
}

const T = strip(TOKENS);
const S = strip(SHEET);

// --------------------------------------------------------------------------
let passed = 0;
const failures = [];
function check(label, ok, detail) {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failures.push(label + (detail ? `  << ${detail}` : "")); console.log(`  FAIL  ${label}${detail ? `  << ${detail}` : ""}`); }
}

function tokenValue(name) {
  const m = T.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

console.log("ACCENT BOUNDARY — three blues that must not converge\n");

// ---- 0. the token graph has a root -------------------------------------
const accent = tokenValue("accent");
if (!accent) {
  console.error("GATE BROKEN: --accent is not defined in tokens.css. The whole");
  console.error("comparison below is meaningless without it.");
  process.exit(2);
}
console.log(`  --accent = ${accent}\n`);

// ---- 1. the guarded tokens are LITERAL, never derived ------------------
const GUARDED = ["pro-identity-from", "pro-identity-to", "pro-ink-accent"];
let inspected = 0;
for (const name of GUARDED) {
  const v = tokenValue(name);
  if (v === null) {
    check(`--${name} is defined at all`, false, "missing from tokens.css");
    continue;
  }
  inspected++;
  check(`--${name} is a LITERAL colour, not derived`,
    /^#[0-9a-fA-F]{3,8}$|^rgba?\(/.test(v), `= ${v}`);
  check(`--${name} does not reference the accent`,
    !/var\(\s*--accent/.test(v), `= ${v}`);
  check(`--${name} is not simply the accent's value`,
    v.toLowerCase() !== accent.toLowerCase(),
    v.toLowerCase() === accent.toLowerCase() ? `both are ${v}` : "");
}
// P2: the inspection set must not be empty.
if (inspected !== GUARDED.length) {
  console.error(`\nGATE BROKEN: expected ${GUARDED.length} guarded tokens, inspected ${inspected}.`);
  process.exit(2);
}

// ---- 2. the Pro identity surfaces do not derive from the accent --------
// Scoped to the gradient declarations themselves: an unscoped search for
// "var(--accent)" matches the whole sheet and would pass on anything.
const gradients = S.match(/linear-gradient\([^)]*--pro-identity[^)]*\)/g) || [];
// THE FLOOR IS A CENSUS, AND ROUND FC MOVED THE POPULATION FROM 3 TO 2.
// The tab-bar CTA chip was the third identity gradient. It is a BUTTON -
// the one action on the free tier's chrome - and white on
// --pro-identity-to (#6fb1ff) measured 2.17-2.47 against a 4.5 floor on
// ALL FIVE grounds, so it took the action pair instead (--action fill,
// --ink-on-action ink), which is DECISIONS 2026-09-18 ("never a second
// action on the same view") and ROUND G's ruling 37 in the same week.
//
// THE FLOOR IS RE-BASELINED, NOT REMOVED. Its job is to stop "0 found, 0
// violations" reading as clean if the tokens are ever inlined away; at 2
// it still catches a drop to 1 or 0, which is every way that could
// happen. What it must never become is 0.
check("the Pro gradients are still painted from the identity tokens",
  gradients.length >= 2, `found ${gradients.length}, expected at least 2`);
check("no Pro gradient mixes the accent into the brand mark",
  gradients.every((g) => !/var\(\s*--accent/.test(g)),
  gradients.filter((g) => /var\(\s*--accent/.test(g))[0] || "");

// ---- 3. the Pro ink token is actually used -----------------------------
// The floor is what stops "0 literals found, 0 violations" reading as clean
// when the token has simply been inlined away again.
const inkUses = (S.match(/var\(\s*--pro-ink-accent\s*\)/g) || []).length;
check("the Pro ink accent is used through its token, not re-inlined",
  inkUses >= 20, `${inkUses} use(s), floor 20`);
const bareInk = (S.match(/#6fb1ff/gi) || []).length;
check("no bare #6fb1ff literal is left in a live declaration",
  bareInk === 0, `${bareInk} left`);

// ---- 4. THE GOOGLE LOGO. Literal, always, under every circumstance. -----
const logoFills = HTML.match(/<circle[^>]*fill="([^"]+)"/g) || [];
check("the four-colour logo is still four fills",
  logoFills.length === 4, `found ${logoFills.length}`);
const fillValues = logoFills.map((f) => (f.match(/fill="([^"]+)"/) || [])[1] || "");
check("every logo fill is a LITERAL hex, never a token",
  fillValues.length > 0 && fillValues.every((v) => /^#[0-9a-fA-F]{6}$/.test(v)),
  fillValues.join(" ") || "no fills found");
check("no logo fill equals the accent's value",
  fillValues.every((v) => v.toLowerCase() !== accent.toLowerCase()),
  fillValues.filter((v) => v.toLowerCase() === accent.toLowerCase())[0] || "");
check("the logo still carries Google's four brand colours",
  ["#4285f4", "#ea4335", "#34a853", "#fbbc05"]
    .every((c) => fillValues.map((v) => v.toLowerCase()).includes(c)),
  fillValues.join(" "));

// ---- 5. THE ACTION CENSUS (ruling 40) ----------------------------------
//
// ONE ACTION COLOUR ON EVERY CONTROL. DECISIONS 2026-09-18 settled that the
// thing a user clicks is --action with --ink-on-action, and never a second
// action on the same view. Round G swept the modal primary and the right-click
// tip; this gate is what stops the next blue fill arriving on a button.
//
// IT ENFORCES AT ZERO, against a NAMED list rather than a count. A count would
// have been satisfied by the population it inherited: at the time this was
// written the sheet had exactly four --accent fills and all four were
// non-actions, so "no more than four" would pass a fifth one straight through
// if someone deleted one of these and added a button. Every surviving accent
// fill is listed here by selector, with the reason it is not a control.
//
// WHAT COUNTS AS AN ACCENT FILL: a `background` or `background-color`
// declaration whose value mentions --accent, INCLUDING through color-mix. The
// open-tabs active-row wash is a color-mix and would slip past a plain
// `var(--accent)` search - which is exactly how the eighth action escaped
// Round G's census, that one by being painted from --pro-ink-accent instead.
const NON_ACTIONS = new Map([
  [".bg-gallery-thumb .bg-check",
   "a selection checkmark on a wallpaper thumbnail - state, not a control"],
  [".shortcut-custom-letter",
   "the letter avatar on a shortcut with no favicon - identity, not a control"],
  [".set-row-toggle input:checked + .set-toggle",
   "a switch in its on position - state, and the switch IS the control"],
  ["html.bg-light #open-tabs-panel .ot-row.is-active",
   "a 12% wash marking the current tab in a list - state, not a control"],
]);

// Flat-parse the comment-blanked sheet. An @media prelude glues itself onto
// the first selector inside it; strip it so a media-scoped rule is still
// matched by its real selector rather than silently skipped.
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const norm = (x) => x.replace(/@media[^{]*\{/g, "").replace(/\s+/g, " ").trim();
let rulesSeen = 0;
let actionFills = 0;
const accentFills = [];
for (const m of S.matchAll(RULE)) {
  const sel = norm(m[1]);
  if (!sel || sel.startsWith("@")) continue;
  rulesSeen++;
  for (const decl of m[2].split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim(), val = decl.slice(i + 1).trim();
    if (prop !== "background" && prop !== "background-color") continue;
    if (/var\(\s*--action\s*\)/.test(val)) actionFills++;
    if (/--accent/.test(val)) accentFills.push({ sel, val });
  }
}

// P2 floors. Both of these exist because "0 found, 0 violations" and "looked
// at everything, found nothing" have the same exit code.
if (rulesSeen < 500) {
  console.error(`\nGATE BROKEN: parsed only ${rulesSeen} rules out of newtab.css.`);
  console.error("The census would pass on an empty read. Refusing to score it.");
  process.exit(2);
}
check("the action colour is actually in use as a fill",
  actionFills >= 3, `${actionFills} --action fill(s), floor 3`);

const strays = accentFills.filter((f) => !NON_ACTIONS.has(f.sel));
check("no control is filled with the accent blue",
  strays.length === 0,
  strays.length ? strays.map((f) => `${f.sel} { background: ${f.val} }`).join("  |  ") : "");

// The listed non-actions must still BE there. If one is renamed away, the
// entry stops describing anything and the list quietly loosens.
let listedFound = 0;
for (const sel of NON_ACTIONS.keys()) {
  if (accentFills.some((f) => f.sel === sel)) listedFound++;
}
check("every named non-action is still present and still accent-filled",
  listedFound === NON_ACTIONS.size,
  `${listedFound} of ${NON_ACTIONS.size} found - an entry that matches nothing is a hole`);

// ---- 6. RANK, NOT FILE ORDER (ruling 41) --------------------------------
//
// Two action rules used to win only because they sat lower in the file than a
// ground-scoped rule of EQUAL specificity. A tie decided by line number is not
// a decision: move either rule, or add one between them, and the fill silently
// reverts to a neutral wash. Both now carry the qualifying class so they win
// on rank.
//
// THE TAG POPOVER IS WHY THIS IS A GATE AND NOT A COMMENT. There the same
// shape was not a latent risk but a live defect that had already happened:
// `.tag-create-btn-primary` is (0,1,0) and `html.has-bg .tag-create-btn` is
// (0,2,1) and later, so with any wallpaper set the primary lost outright and
// Save had been byte-identical to Cancel for as long as the frosted branch had
// existed. Measured, both rgba(255, 255, 255, 0.08) with white ink.
//
// EACH FORM IS ANCHORED ON ITS SELECTOR TERMINATOR - the selector followed by
// " {" if it ends a selector list, or by "," if it sits inside one - and every
// state is listed separately. A bare substring search does not work
// here and the first draft of this check proved it: each selector also occurs
// in its own :hover twin, so dropping the qualifying class from the base rule
// left the twin's text behind and the search still matched. Both seeds escaped
// a gate that was already written to catch them. Anchoring on the opening is
// what makes the assertion about the rule rather than about the file.
const RANKED = [
  { what: "the modal primary on a light wallpaper",
    forms: ["html.bg-light .tt-modal-btn.tt-modal-btn-primary-fill",
            "html.has-bg.bg-light .tt-modal-btn.tt-modal-btn-primary-fill",
            "html.bg-light .tt-modal-btn.tt-modal-btn-primary-fill:hover",
            "html.has-bg.bg-light .tt-modal-btn.tt-modal-btn-primary-fill:hover"] },
  { what: "the tag popover's Save",
    forms: ["html.has-bg .tag-create-btn.tag-create-btn-primary",
            "html.has-bg .tag-create-btn.tag-create-btn-primary:hover:not(:disabled)",
            "html.has-bg .tag-create-btn.tag-create-btn-primary:disabled"] },
];
const declared = (f) => S.includes(f + " {") || S.includes(f + ",");
for (const { what, forms } of RANKED) {
  const missing = forms.filter((f) => !declared(f));
  check(`${what} out-ranks its ground-scoped rule in every state, rather than out-ordering it`,
    missing.length === 0, missing.join("  |  "));
}

// --------------------------------------------------------------------------
console.log("");
if (MUTATE) {
  if (failures.length) {
    console.log(`MUTATION [${seedApplied.which}] CAUGHT — ${failures.length} assertion(s) failed as intended.`);
    process.exit(0);
  }
  console.log(`MUTATION [${seedApplied.which}] ESCAPED — "${seedApplied.name}" changed the`);
  console.log("subject and every assertion still passed. The gate is blind to it.");
  process.exit(1);
}

if (failures.length) {
  console.log(`ACCENT BOUNDARY: FAIL — ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`ACCENT BOUNDARY: PASS — ${passed} passed, 0 failed`);
