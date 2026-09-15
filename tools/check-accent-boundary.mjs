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
check("the Pro gradients are still painted from the identity tokens",
  gradients.length >= 3, `found ${gradients.length}, expected at least 3`);
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
