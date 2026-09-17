#!/usr/bin/env node
// ===========================================================================
// THE BELL'S DOCTRINE, ASSERTED.
//
// This product's organising principle is that NOTHING NAGS, and the due-work
// bell is the most nag-shaped element it has built. The spec admitted it only
// on conditions, and conditions written in a comment erode one commit at a
// time - a transition added for polish, an accent borrowed from a neighbour, a
// count that grows "so it reads better at a glance". Each is defensible alone
// and together they are a demand.
//
// So the conditions are a gate. Same shape as [1.12.4]'s running-animations
// assertion: enumerate what the stylesheet actually declares for a family of
// selectors, and refuse anything outside the allowed set.
//
// WHAT IS FORBIDDEN, from the spec and PLAN decision C:
//   NO ANIMATION   no animation, transition, @keyframes or transform on any
//                  .due-bell* selector. Quiet is not a default, it is a rule.
//   NO RED         no red-ish literal and no danger/warning/error token in any
//                  bell declaration. Neutral ink only.
//   NO GROWING     the count's font-size is declared exactly once and is not a
//                  function of anything.
//
// WHAT IT DELIBERATELY DOES NOT CHECK: whether the bell is ABSENT at zero.
// That is behaviour, lives in JS, and is asserted from a click in the round's
// runtime pass - a stylesheet cannot answer it.
//
//   node tools/check-bell-doctrine.mjs
// Exit 0 = the doctrine holds. 1 = a violation. 2 = the gate could not look.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
const cssPath = path.join(repoRoot, "newtab.css");

let css;
try { css = fs.readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n"); }
catch (e) { console.log("BELL DOCTRINE: BROKEN - could not read newtab.css: " + e.message); process.exit(2); }

console.log("\nBELL DOCTRINE - the bell reports, it does not urge\n");
let pass = 0, fail = 0;
const chk = (n, ok, x) => { ok ? pass++ : fail++;
  console.log("  " + (ok ? "PASS  " : "FAIL  ") + n + (x ? "   << " + x : "")); };

// Every rule whose selector list mentions the bell family.
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const bellRules = [];
let m;
while ((m = RULE.exec(css))) {
  const sel = m[1].trim(), body = m[2];
  if (!/\.due-bell/.test(sel)) continue;
  bellRules.push({ sel: sel.replace(/\s+/g, " "), body });
}

// ANTI-VACUITY (P2). A gate that found no rules would pass every row below
// while asserting nothing about a stylesheet that could say anything at all.
if (bellRules.length < 8) {
  console.log("  UNSOUND  only " + bellRules.length + " .due-bell rule(s) found; the bell block is");
  console.log("           larger than that, so the rule parser is not seeing the stylesheet");
  process.exit(2);
}
console.log("  " + bellRules.length + " .due-bell rule(s) under assertion\n");

// ---- NO ANIMATION --------------------------------------------------------
const MOTION = /(^|[;\s])(animation|animation-name|animation-duration|transition|transition-property|transform|scale|rotate|translate)\s*:/;
const moving = bellRules.filter((r) => MOTION.test(r.body));
chk("no animation, transition or transform on any bell selector",
    moving.length === 0, moving.map((r) => r.sel).join(" | "));

// A @keyframes whose name is used by a bell rule would evade the property scan.
const kfNames = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((k) => k[1]);
const kfUsed = kfNames.filter((n) => bellRules.some((r) => new RegExp("\\b" + n + "\\b").test(r.body)));
chk("no @keyframes referenced from a bell rule", kfUsed.length === 0, kfUsed.join(", "));

// ---- NO RED --------------------------------------------------------------
// Both halves: a literal, and a token whose NAME means danger.
// A COLOUR IS RED WHEN ITS CHANNELS SAY SO, NOT WHEN A PATTERN GUESSES.
// The first version of this was a hex regex and it FAILED ITS OWN CONTROL: it
// could not see #e53935, so every green row above it was a statement about a
// blind matcher rather than about the stylesheet. Parsing the channels is both
// simpler and the only version whose correctness can itself be checked.
function isRed(r, g, b) { return r > 120 && r - Math.max(g, b) > 45; }
function REDDISH(text) {
  if (/\b(red|crimson|firebrick|tomato|indianred|orangered)\b/i.test(text)) return true;
  var m;
  var HEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;
  while ((m = HEX.exec(text))) {
    var h = m[1].length === 3 ? m[1].split('').map(function (c) { return c + c; }).join('') : m[1];
    if (isRed(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16))) return true;
  }
  var FN = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi;
  while ((m = FN.exec(text))) { if (isRed(+m[1], +m[2], +m[3])) return true; }
  return false;
}
function DANGER_TOKEN(text) { return /--[\w-]*(danger|error|warning|alert|overdue|urgent)[\w-]*/i.test(text); }
const red = bellRules.filter(function (r) { return REDDISH(r.body) || DANGER_TOKEN(r.body); });
chk("no red literal and no danger/warning token in any bell rule",
    red.length === 0, red.map((r) => r.sel).join(" | "));

// The control: the scanner must be able to SEE a red, or the row above is a
// statement about a blind regex rather than about the stylesheet.
chk("CONTROL: the red scanner fires on a red declaration",
    REDDISH('color: #e53935;') && REDDISH('background: rgb(220, 53, 69);') &&
    DANGER_TOKEN('color: var(--danger-ink);') &&
    // And the other direction, which is what makes it a control rather than a
    // tripwire: the neutrals the bell actually uses must NOT read as red.
    !REDDISH('color: var(--ink-secondary);') && !REDDISH('outline: 2px solid #4a90e2;'));

// ---- THE COUNT DOES NOT GROW --------------------------------------------
const countRules = bellRules.filter((r) => /\.due-bell-count\b/.test(r.sel));
chk("the count has a rule of its own", countRules.length >= 1, String(countRules.length));
const sizes = countRules.flatMap((r) => [...r.body.matchAll(/font-size\s*:\s*([^;]+)/g)].map((x) => x[1].trim()));
chk("the count declares exactly one font-size", sizes.length === 1, JSON.stringify(sizes));
chk("that font-size is a fixed token, not a calc or a var of the count",
    sizes.length === 1 && /^var\(--fs-\d+\)$/.test(sizes[0]), sizes[0]);

// ---- THE LIGHT GROUND ----------------------------------------------------
// Eight ink rounds have each found a white-on-white defect, and the floater is
// white-tinted under html.bg-light. The measurement is the round's job; that
// the override EXISTS is checkable here and cheap.
chk("the bell list carries an html.bg-light ink override",
    bellRules.some((r) => /html\.has-bg\.bg-light/.test(r.sel) && /--ink-primary/.test(r.body)));

const verdict = fail ? "FAIL" : "PASS";
console.log(`\nBELL DOCTRINE: ${verdict} - ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
