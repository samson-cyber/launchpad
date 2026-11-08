#!/usr/bin/env node
// ===========================================================================
// [MC6] TAB-OPEN MOTION - the bars grow, the numbers count, and the two stay
// in the ratio Samson asked for.
//
// WHY THIS EXISTS. The grow is a JS selector list and a CSS rule list that
// must name the same bars, a duration that is defined relative to another
// one, and a reduced-motion rule that must cover every animated selector.
// Each can drift on its own with nothing visibly broken: a bar added to the
// JS list but not the CSS never grows, one added to the CSS but not the JS
// never triggers, and a reduced-motion block that misses one selector
// animates for exactly the users who asked it not to.
//
// WHAT IT HOLDS, from newtab.js and newtab.css:
//   - LP_GROW_MS is LP_COUNT_MS x 1.4 (Samson: "slower than the number counter
//     by another 40%"), and the count is 560ms
//   - every selector in LP_GROW_SEL has a .lp-grow animation at that duration
//     with the entrance curve, and every .lp-grow rule's selector is in the list
//   - no stagger: no animation-delay and no per-index delay in the grow rules
//   - reduced motion: lpGrowBars returns early, AND the CSS turns every
//     animated selector off
//   - it runs once per open, after the fills: from setActiveTab's ready.then,
//     beside the count, and the class is taken off when the growth is done
//   - the duration columns fit "10hr 59min" (>= 6em), and the weekly values
//     do not wrap
//
// Exit codes: 0 pass · 1 failures · 2 the subject did not load. `--mutate`
// re-runs against seeded reversions; `--boot-check` is what
// check-mutation-boot runs.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

function boot(js, css) {
  if (!/function lpGrowBars\(/.test(js)) throw new Error("lpGrowBars not found");
  if (!/var LP_COUNT_MS = \d+;/.test(js)) throw new Error("LP_COUNT_MS not found");
  if (!/\.lp-grow/.test(css)) throw new Error(".lp-grow rules not found");
  return true;
}

function suite(js, css) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  boot(js, css);
  const count = Number(/var LP_COUNT_MS = (\d+);/.exec(js)[1]);
  const growM = /var LP_GROW_MS = (\d+);/.exec(js);
  const grow = growM ? Number(growM[1]) : NaN;
  chk("the count-up is 560ms", count === 560, String(count));
  chk("the grow is the count x 1.4 (another 40% slower)", grow === Math.round(count * 1.4), `${grow} vs ${count * 1.4}`);

  const selM = /var LP_GROW_SEL = "([^"]+)";/.exec(js);
  const jsSel = selM ? selM[1].split(",").map((x) => x.trim()) : [];
  chk("LP_GROW_SEL names the vertical and horizontal bars", jsSel.includes(".pp-bar") && jsSel.includes(".insights-task-bar-fill") && jsSel.includes(".ins-tagshare-bar"), jsSel.join(" "));

  // Every .lp-grow rule outside the reduced-motion block.
  const rm = css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .lp-grow");
  const body = rm > 0 ? css.slice(0, rm) : css;
  const rules = [...body.matchAll(/((?:html\[dir="rtl"\] )?\.lp-grow [^{]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2] }));
  const animated = rules.filter((r) => /animation:/.test(r.decl));
  const cssSel = new Set();
  animated.forEach((r) => r.sel.split(",").forEach((x) => cssSel.add(x.trim().replace(/^\.lp-grow\s+/, ""))));
  chk("every bar in the JS list has a grow animation in the sheet", jsSel.length > 0 && jsSel.every((x) => cssSel.has(x)), [...cssSel].join(" "));
  chk("every grow animation in the sheet is a bar the JS list triggers", [...cssSel].every((x) => jsSel.includes(x)), [...cssSel].filter((x) => !jsSel.includes(x)).join(" "));
  chk("every grow animation runs LP_GROW_MS with the entrance curve",
    animated.length >= 2 && animated.every((r) => new RegExp("animation:\\s*lp-grow-[xy]\\s+" + grow + "ms\\s+cubic-bezier\\(0\\.2,\\s*0,\\s*0,\\s*1\\)").test(r.decl)),
    animated.map((r) => r.decl.trim()).join(" | "));
  chk("no stagger: no animation-delay or per-item delay in the grow rules", rules.every((r) => !/animation-delay|nth-child|--i\b/.test(r.decl + r.sel)));
  chk("vertical bars grow from their baseline", rules.some((r) => /\.pp-bar/.test(r.sel) && /transform-origin:\s*50% 100%/.test(r.decl) && /transform-box:\s*fill-box/.test(r.decl)));
  chk("horizontal bars grow from their start edge (and RTL from the right)",
    rules.some((r) => /insights-task-bar-fill/.test(r.sel) && /transform-origin:\s*0 50%/.test(r.decl)) &&
    rules.some((r) => /dir="rtl"/.test(r.sel) && /transform-origin:\s*100% 50%/.test(r.decl)));

  // Reduced motion, both halves.
  const rmBlock = rm > 0 ? css.slice(rm, css.indexOf("}\n}", rm) + 3) : "";
  chk("reduced motion: the sheet turns every grow animation off", jsSel.every((x) => rmBlock.includes(".lp-grow " + x)) && /animation:\s*none/.test(rmBlock), rmBlock);
  const fn = (() => { const a = js.indexOf("  function lpGrowBars("); return a < 0 ? "" : js.slice(a, js.indexOf("\n  }\n", a) + 4); })();
  chk("reduced motion: lpGrowBars returns before adding the class", /prefers-reduced-motion: reduce\)"\)\.matches\) return;[\s\S]*classList\.add\("lp-grow"\)/.test(fn));
  chk("the class comes off when the growth is done", /setTimeout\(function \(\) \{ root\.classList\.remove\("lp-grow"\); \}, LP_GROW_MS/.test(fn));
  chk("a second open restarts it (remove, reflow, add)", /classList\.remove\("lp-grow"\);\s*void root\.offsetWidth;\s*root\.classList\.add\("lp-grow"\)/.test(fn));
  chk("it runs once per open, after the fills, beside the count",
    /ready\.then\(function \(\) \{ lpCountUp\(countPanel\); lpGrowBars\(countPanel\); \}\);/.test(js) &&
    (js.match(/lpGrowBars\(/g) || []).length === 2);

  // Durations fit.
  const dashCol = /--dash-row-value:\s*([\d.]+)em/.exec(css);
  chk("the shared row's value column fits '10hr 59min' (>= 6em)", dashCol && Number(dashCol[1]) >= 6, dashCol && dashCol[0]);
  const siteCol = /\.ins-sites \.insights-task-row \{[^}]*grid-template-columns:[^;]*\s([\d.]+)em;/.exec(css);
  chk("the site list's value column fits '10hr 59min' (>= 6em)", siteCol && Number(siteCol[1]) >= 6, siteCol && siteCol[0]);
  chk("the weekly values do not wrap", /(?:^|[\n}])\.ins-wk-now, \.ins-wk-delta \{ white-space: nowrap; \}/.test(css));
  return rows;
}

const SEEDS = [
  ["the grow loses its 40%", "var LP_GROW_MS = 784;", "var LP_GROW_MS = 560;", "js"],
  ["a bar is in the JS list but never animated", "var LP_GROW_SEL = \".pp-bar, .insights-task-bar-fill, .ins-tagshare-bar, .pp-progress-fill\";",
   "var LP_GROW_SEL = \".pp-bar, .insights-task-bar-fill, .ins-tagshare-bar, .pp-progress-fill, .dash-session-fill\";", "js"],
  ["reduced motion still grows (JS)", "if (window.matchMedia && window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches) return;\n    if (!root.querySelector(LP_GROW_SEL)) return;",
   "if (!root.querySelector(LP_GROW_SEL)) return;", "js"],
  ["the class never comes off", "root.__lpGrowTimer = setTimeout(function () { root.classList.remove(\"lp-grow\"); }, LP_GROW_MS + 80);", "", "js"],
  ["the grow runs before the fills", "    ready.then(function () { lpCountUp(countPanel); lpGrowBars(countPanel); });",
   "    lpGrowBars(countPanel);\n    ready.then(function () { lpCountUp(countPanel); });", "js"],
  ["a stagger creeps in", "  transform-origin: 0 50%;\n  animation: lp-grow-x 784ms cubic-bezier(0.2, 0, 0, 1) both;\n}",
   "  transform-origin: 0 50%;\n  animation: lp-grow-x 784ms cubic-bezier(0.2, 0, 0, 1) both;\n  animation-delay: 40ms;\n}", "css"],
  ["reduced motion misses the tag bar (CSS)", "  .lp-grow .pp-bar, .lp-grow .insights-task-bar-fill, .lp-grow .pp-progress-fill, .lp-grow .ins-tagshare-bar { animation: none; }",
   "  .lp-grow .pp-bar, .lp-grow .insights-task-bar-fill, .lp-grow .pp-progress-fill { animation: none; }", "css"],
  ["vertical bars grow from the middle", "  transform-origin: 50% 100%;\n  animation: lp-grow-y", "  transform-origin: 50% 50%;\n  animation: lp-grow-y", "css"],
  ["the site column shrinks back", "grid-template-columns: minmax(0, 1fr) minmax(64px, 1.1fr) 6.2em;", "grid-template-columns: minmax(0, 1fr) minmax(64px, 1.1fr) 4.5em;", "css"],
];

const cleanJs = read("newtab.js"), cleanCss = read("newtab.css");
if (args.includes("--boot-check")) {
  try { boot(cleanJs, cleanCss); console.log("BOOT-CHECK OK   check-motion.mjs"); process.exit(0); }
  catch (e) { console.log("BOOT-CHECK DEAD check-motion.mjs — " + e.message); process.exit(1); }
}
console.log("\nMOTION — bars grow 40% slower than the count, together, once per open, never under reduced motion\n");
let rows;
try { rows = suite(cleanJs, cleanCss); }
catch (e) { console.error("SUBJECT DID NOT LOAD — " + e.message); process.exit(2); }
const ROW_FLOOR = 17;
if (rows.length < ROW_FLOOR) { console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`); process.exit(2); }
let failed = 0;
for (const r of rows) if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
console.log(`MOTION: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);
if (!MUTATE) process.exit(failed === 0 ? 0 : 1);
if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }
console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl, file] of SEEDS) {
  const base = file === "css" ? cleanCss : cleanJs;
  const n = base.split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  const mut = base.split(find).join(repl);
  let mrows;
  try { mrows = suite(file === "css" ? cleanJs : mut, file === "css" ? mut : cleanCss); }
  catch (e) { mrows = [{ name: "subject did not load: " + e.message, ok: false }]; }
  const red = mrows.filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else console.log(`  killed   ${name}\n           by: ${red[0].name.slice(0, 92)}`);
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
