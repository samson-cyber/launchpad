#!/usr/bin/env node
// ===========================================================================
// [IT] INSIGHTS' ONE-DAY RANGE DRAWS THE DAY BY HOUR, NOT ONE GIANT BAR.
//
// WHY THIS EXISTS. insightsBarChartSvg sizes every bar at 60% of (width /
// number of days). Over 30 days that is a bar; over ONE day it is a slab 60%
// of the tile wide - the "giant bar" Samson's recording showed on Today. No
// part of that throws, and no contrast or layout gate can see it.
//
// WHAT IT HOLDS, against the real functions extracted from newtab.js and run
// in a VM:
//   - the free preview passes no opts and its SVG is unchanged: no opts means
//     no cap, byte for byte
//   - with the board's cap, one to six days are capped and seven or more days
//     draw exactly as before
//   - insightsDayHours reads the day's own weekday row, in minutes; refuses a
//     day the reader excluded (no complete hour data); a day with no focus is
//     24 zeros
//   - the board's one-day path reads hours, draws 24 bars, and the switch
//     waits for that read (it is in insightsRefresh's returned Promise.all)
//
// Exit codes: 0 pass · 1 failures · 2 the subject did not load, or too few
// rows. `--mutate` re-runs against seeded reversions; `--boot-check` is what
// check-mutation-boot runs.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUBJECT = "newtab.js";
function readSubject() { return fs.readFileSync(path.join(repoRoot, SUBJECT), "utf8").replace(/\r\n/g, "\n"); }

// Pull one top-level-in-the-IIFE function out by brace matching.
function extractFn(src, name) {
  const at = src.indexOf("  function " + name + "(");
  if (at < 0) throw new Error("function " + name + " not found");
  let i = src.indexOf("{", at), depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
    else if (c === "'" || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } }
    else if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; }
  }
  throw new Error("unbalanced " + name);
}
function extractInsightsRefresh(src) {
  const a = src.indexOf("  async function insightsRefresh(");
  if (a < 0) throw new Error("insightsRefresh not found");
  const b = src.indexOf("\n  }\n", a);
  return src.slice(a, b + 4);
}

function boot(src) {
  const m = /var INS_BAR_MAX_W = (\d+);/.exec(src);
  if (!m) throw new Error("INS_BAR_MAX_W not found");
  const code = [
    "var INS_BAR_MAX_W = " + m[1] + ";",
    extractFn(src, "insightsDayHours"),
    extractFn(src, "insightsHourLabel"),
    extractFn(src, "insightsBarChartSvg"),
    "this.api = { insightsDayHours, insightsHourLabel, insightsBarChartSvg, INS_BAR_MAX_W };"
  ].join("\n");
  const sandbox = { th: (k) => k, escapeHtml: (s) => String(s), Date, Math, String, Number };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: SUBJECT });
  return { api: sandbox.api, refresh: extractInsightsRefresh(src) };
}

const widths = (svg) => [...svg.matchAll(/<rect class="pp-bar[^"]*" x="[^"]*" y="[^"]*" width="([^"]*)"/g)].map((x) => Number(x[1]));
const BOARD = (cap) => ({ w: 520, h: 270, caption: false, axis: false, maxBarW: cap });
// The pre-[IT] formula, written out, so "unchanged" is measured against
// arithmetic rather than against the code under test.
const oldBarW = (n, w) => ((w - 64) / n) * 0.6;

function suite(src) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  const { api, refresh } = boot(src);
  const B = api.insightsBarChartSvg;

  // ---- the preview: no opts, no cap ----
  for (const n of [1, 3, 30]) {
    const svg = B(new Array(n).fill(1), n - 1, "x", "a", "b");
    chk(`preview (no opts), ${n} day(s): bar width is the original 60% of a step`,
      widths(svg).every((wd) => Math.abs(wd - oldBarW(n, 1060)) < 1e-9), JSON.stringify(widths(svg).slice(0, 2)));
  }
  chk("preview (no opts): the SVG carries no new attribute", !/maxBarW|data-cap/.test(B([1, 2], 1, "x", "a", "b")));

  // ---- the board: capped below a week, unchanged from a week up ----
  const cap = api.INS_BAR_MAX_W;
  chk("the cap is set", typeof cap === "number" && cap > 0, String(cap));
  for (const n of [1, 2, 3, 6]) {
    const wd = widths(B(new Array(n).fill(1), 0, "x", "a", "b", BOARD(cap)));
    chk(`board, ${n} day(s): every bar is capped at ${cap}`, wd.length === n && wd.every((v) => v <= cap + 1e-9), JSON.stringify(wd));
  }
  for (const n of [7, 30, 90]) {
    const wd = widths(B(new Array(n).fill(1), 0, "x", "a", "b", BOARD(cap)));
    chk(`board, ${n} days: bars draw exactly as before the cap`, wd.every((v) => Math.abs(v - oldBarW(n, 520)) < 1e-9), JSON.stringify(wd.slice(0, 2)));
  }
  {
    const svg = B([5, 10], 1, "x", "a", "b", BOARD(cap));
    const xs = [...svg.matchAll(/<rect class="pp-bar[^"]*" x="([^"]*)"/g)].map((x) => Number(x[1]));
    const step = (520 - 64) / 2;
    chk("a capped bar stays centred in its slot", Math.abs(xs[0] + cap / 2 - (32 + step / 2)) < 1e-9, JSON.stringify(xs));
  }

  // ---- one day's hours ----
  {
    // 2026-11-08 is a Sunday (row 0). Put noise on Monday to prove the row.
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    grid[0][9] = 30 * 60000; grid[0][14] = 90 * 60000; grid[1][9] = 999 * 60000;
    const h = api.insightsDayHours({ grid, includedDays: 1, excludedDays: 0 }, "2026-11-08");
    chk("a day's hours are its own weekday's row", h && h[9] === 30 && h[14] === 90, JSON.stringify(h));
    chk("...24 of them, in minutes", h && h.length === 24 && h.reduce((a, b) => a + b, 0) === 120, JSON.stringify(h));
    const empty = api.insightsDayHours({ grid: Array.from({ length: 7 }, () => new Array(24).fill(0)), includedDays: 0, excludedDays: 0 }, "2026-11-08");
    chk("a day with no focus is 24 zeros, not a refusal", empty && empty.length === 24 && empty.every((v) => v === 0), JSON.stringify(empty));
    chk("a day the reader excluded (no complete hours) is refused", api.insightsDayHours({ grid, includedDays: 0, excludedDays: 1 }, "2026-11-08") === null);
    chk("no reader result is refused", api.insightsDayHours(null, "2026-11-08") === null);
    const svg = B(h, 14, "x", "a", "b", BOARD(cap));
    chk("the hourly chart draws 24 bars", widths(svg).length === 24, String(widths(svg).length));
    chk("the current hour is the highlighted bar", (svg.match(/pp-bar-today/g) || []).length === 1 &&
      /<rect class="pp-bar pp-bar-today" x="([^"]*)"/.exec(svg)[1] === String(32 + ((520 - 64) / 24) * 14 + (((520 - 64) / 24) - Math.min(((520 - 64) / 24) * 0.6, cap)) / 2));
    chk("hour labels are non-empty", api.insightsHourLabel(0).length > 0 && api.insightsHourLabel(23).length > 0);
  }

  // ---- the board wiring ----
  chk("insightsRefresh takes the hourly path for a one-day window", /if \(keys\.length === 1\) \{[\s\S]{0,200}bestHoursForScope\(scope\.workspaceId, keys\)/.test(refresh));
  chk("...and paints it through insightsDayHours", /insightsDayHours\(res, keys\[0\]\)/.test(refresh));
  chk("...falling back to the capped daily bar when the day has no complete hours", /if \(!byHour\) \{ paintDaily\(\); return; \}/.test(refresh));
  chk("the switch waits for the hourly read (render before reveal)", /Promise\.all\(\[[^\]]*hourlyP[^\]]*\]\)/.test(refresh));
  chk("every daily paint on the board passes the cap", (refresh.match(/maxBarW: INS_BAR_MAX_W/g) || []).length === 2);
  return rows;
}

const SEEDS = [
  ["the cap is ignored",
   "if (opts && typeof opts.maxBarW === \"number\") barW = Math.min(barW, opts.maxBarW);", ""],
  ["the day's hours come from the wrong row",
   "var row = res.grid[dow] || [];", "var row = res.grid[(dow + 1) % 7] || [];"],
  ["an excluded day is drawn as empty",
   "if (!res.includedDays && res.excludedDays) return null;", ""],
  ["the switch stops waiting for the hourly read",
   "return Promise.all([weeklyP, heatP, hzP, hourlyP])", "return Promise.all([weeklyP, heatP, hzP])"],
  ["one day goes back to the daily bar",
   "if (keys.length === 1) {", "if (false) {"],
  ["the cap is set below a week's bar",
   "var INS_BAR_MAX_W = 40;", "var INS_BAR_MAX_W = 20;"],
];

const clean = readSubject();
if (args.includes("--boot-check")) {
  try { boot(clean); console.log("BOOT-CHECK OK   check-insights-day-chart.mjs"); process.exit(0); }
  catch (e) { console.log("BOOT-CHECK DEAD check-insights-day-chart.mjs — " + e.message); process.exit(1); }
}

console.log("\nINSIGHTS DAY CHART — one day by hour, short windows capped, the preview unchanged\n");
let rows;
try { rows = suite(clean); }
catch (e) { console.error("SUBJECT DID NOT LOAD — " + e.message); process.exit(2); }

const ROW_FLOOR = 25;
if (rows.length < ROW_FLOOR) { console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`); process.exit(2); }

let failed = 0;
for (const r of rows) if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
console.log(`INSIGHTS DAY CHART: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);
if (!MUTATE) process.exit(failed === 0 ? 0 : 1);
if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }

console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl] of SEEDS) {
  const n = clean.split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  let mrows;
  try { mrows = suite(clean.split(find).join(repl)); }
  catch (e) { broken++; console.log(`  BROKEN SEED  ${name} (subject did not load: ${e.message})`); continue; }
  const red = mrows.filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else console.log(`  killed   ${name}\n           by: ${red[0].name.slice(0, 92)}`);
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
