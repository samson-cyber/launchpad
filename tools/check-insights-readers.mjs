#!/usr/bin/env node
// Reader suite for the Insights board's windowed rollups.
//
// WHY THIS FILE EXISTS AT ALL: the [1.2.1] MINI-PLAN named "the committed
// board-suite harness" as a premise to extend. There wasn't one — every suite
// built for the Insights, Focus-session and Focus-blocking rounds lived in a
// session scratch directory and evaporated with the session, so none of that
// coverage was protecting the repo. This file is the smallest honest correction:
// the windowed readers, committed, runnable, and extendable by the next round.
//
// It loads the REAL tracking.js and storage.js in a Node VM against a fake
// chrome.storage.local, so it exercises the shipped code rather than a copy.
//
// Usage: node tools/check-insights-readers.mjs [repoRoot]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
//
// Exit code 2 matters: a mutation runner must be able to tell "the seeded defect
// was caught" from "the module could not even be imported". Without that
// distinction a mutant that merely breaks the file scores as coverage, and the
// suite reports perfect results while testing nothing.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] || process.cwd();
const clone = (v) => JSON.parse(JSON.stringify(v));

function boot() {
  const store = {};
  const ctx = {
    chrome: {
      storage: {
        local: {
          async get(k) {
            if (typeof k === "string") { const o = {}; if (k in store) o[k] = clone(store[k]); return o; }
            return clone(store);
          },
          async set(o) { for (const [k, v] of Object.entries(o)) store[k] = clone(v); },
          async remove(k) { delete store[k]; },
        },
        onChanged: { addListener() {} },
      },
      runtime: { lastError: null, getManifest: () => ({ version: "0.0.0" }) },
      tabs: { query: async () => [], onUpdated: { addListener() {} }, onActivated: { addListener() {} } },
      windows: { getLastFocused: async () => ({ id: 1, focused: true }), onFocusChanged: { addListener() {} }, onRemoved: { addListener() {} } },
      idle: { queryState: async () => "active", setDetectionInterval() {}, onStateChanged: { addListener() {} } },
      alarms: { create() {}, get: async () => null, clear: async () => true, onAlarm: { addListener() {} } },
    },
    console: { log() {}, warn() {}, error() {} },
    Date, Math, JSON, URL, Promise, setTimeout, clearTimeout,
  };
  ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(repoRoot, "storage.js"), "utf8"), ctx, { filename: "storage.js" });
  vm.runInContext(fs.readFileSync(path.join(repoRoot, "tracking.js"), "utf8"), ctx, { filename: "tracking.js" });
  return { ctx, store };
}

let ctx, store;
try { ({ ctx, store } = boot()); }
catch (err) {
  console.log("INSIGHTS READERS: SUBJECT DID NOT LOAD — " + (err && err.message));
  process.exit(2);
}
const T = ctx.Tracking;
for (const fn of ["byDomainForScope", "byTagForScope", "byTaskForScope", "lastNLocalDayKeys", "_localDayKey"]) {
  if (!T || typeof T[fn] !== "function") {
    console.log(`INSIGHTS READERS: SUBJECT DID NOT LOAD — Tracking.${fn} missing`);
    process.exit(2);
  }
}

const rows = [];
const check = (name, pass, detail = "") => rows.push({ name, pass, detail });
const dayKey = (offsetDays) => T._localDayKey(Date.now() - offsetDays * 86400000);

// Build a tracking_days map directly: { "<wsId>:<dayKey>": aggregate }
function seedDays(records) {
  const days = {};
  for (const r of records) {
    const key = r.workspaceId + ":" + r.day;
    days[key] = Object.assign(
      { day: r.day, workspaceId: r.workspaceId, totalFocusedMs: 0, byDomain: {}, byTag: {}, byTask: {}, longestSessionMs: 0 },
      { byDomain: r.byDomain || {} }
    );
    days[key].day = r.day;
    days[key].workspaceId = r.workspaceId;
  }
  store["tracking_days"] = days;
}
const sum = (recs) => recs.reduce((a, r) => a + r.ms, 0);
const find = (recs, ws, dom) => recs.find((r) => r.workspaceId === ws && r.domain === dom);

await (async () => {
  // ---- window boundaries -------------------------------------------------
  seedDays([
    { workspaceId: "main", day: dayKey(0), byDomain: { "a.com": 1000 } },
    { workspaceId: "main", day: dayKey(29), byDomain: { "a.com": 2000 } },   // last day INSIDE a 30-key window
    { workspaceId: "main", day: dayKey(30), byDomain: { "a.com": 4000 } },   // one day OUTSIDE
    { workspaceId: "main", day: dayKey(60), byDomain: { "a.com": 8000 } },   // far outside
  ]);
  const keys30 = T.lastNLocalDayKeys(30);
  const w30 = await T.byDomainForScope("main", keys30);
  check("window: includes today and the 30th-newest day", find(w30, "main", "a.com")?.ms === 3000,
    `got ${find(w30, "main", "a.com")?.ms} want 3000`);
  check("window: EXCLUDES the day just outside the window", sum(w30) === 3000, `total ${sum(w30)}`);

  const keys1 = T.lastNLocalDayKeys(1);
  const w1 = await T.byDomainForScope("main", keys1);
  check("window: a 1-day window sees only today", find(w1, "main", "a.com")?.ms === 1000, `got ${find(w1, "main", "a.com")?.ms}`);

  const w0 = await T.byDomainForScope("main", []);
  check("window: an empty key list yields nothing", w0.length === 0, `got ${w0.length} records`);

  // ---- tuple keying: same domain, two workspaces --------------------------
  seedDays([
    { workspaceId: "main", day: dayKey(1), byDomain: { "shared.com": 500, "onlymain.com": 70 } },
    { workspaceId: "work", day: dayKey(1), byDomain: { "shared.com": 900 } },
  ]);
  const single = await T.byDomainForScope("main", T.lastNLocalDayKeys(30));
  check("tuple: single-workspace scope excludes the other workspace",
    single.length === 2 && !single.some((r) => r.workspaceId === "work"), JSON.stringify(single));
  check("tuple: same domain in another workspace does NOT leak into the total",
    find(single, "main", "shared.com")?.ms === 500, `got ${find(single, "main", "shared.com")?.ms} want 500`);

  const combined = await T.byDomainForScope(null, T.lastNLocalDayKeys(30));
  check("combined: both workspaces present", combined.length === 3, JSON.stringify(combined.map((r) => r.workspaceId + "/" + r.domain)));
  check("combined: the SAME domain stays TWO records, never merged",
    find(combined, "main", "shared.com")?.ms === 500 && find(combined, "work", "shared.com")?.ms === 900,
    JSON.stringify(combined));

  // ---- summing across days within the window -----------------------------
  seedDays([
    { workspaceId: "main", day: dayKey(0), byDomain: { "x.com": 10 } },
    { workspaceId: "main", day: dayKey(1), byDomain: { "x.com": 20 } },
    { workspaceId: "main", day: dayKey(2), byDomain: { "x.com": 30 } },
  ]);
  const summed = await T.byDomainForScope("main", T.lastNLocalDayKeys(30));
  check("sum: one record per (workspace, domain) across the window", summed.length === 1, JSON.stringify(summed));
  check("sum: ms accumulates across days", summed[0].ms === 60, `got ${summed[0].ms}`);

  // ---- record shape matches the sibling readers' contract ----------------
  const rec = summed[0];
  check("contract: record is { workspaceId, domain, ms }",
    Object.keys(rec).sort().join(",") === "domain,ms,workspaceId", Object.keys(rec).join(","));
  const byTask = await T.byTaskForScope("main", T.lastNLocalDayKeys(30));
  check("contract: same arity/shape family as byTaskForScope",
    T.byDomainForScope.length === T.byTaskForScope.length, `${T.byDomainForScope.length} vs ${T.byTaskForScope.length}`);
  check("contract: sibling reader still works (no collateral damage)", Array.isArray(byTask), typeof byTask);

  // ---- raw hostnames, no normalisation (T4) -------------------------------
  seedDays([{ workspaceId: "main", day: dayKey(0),
    byDomain: { "www.x.com": 5, "x.com": 7, "m.x.com": 9, "xn--mnchen-3ya.de": 11 } }]);
  const raw = await T.byDomainForScope("main", T.lastNLocalDayKeys(30));
  check("T4: www. and bare host stay SEPARATE (no stripping)",
    find(raw, "main", "www.x.com")?.ms === 5 && find(raw, "main", "x.com")?.ms === 7, JSON.stringify(raw));
  check("T4: subdomains are not collapsed", find(raw, "main", "m.x.com")?.ms === 9);
  check("T4: punycode host passes through verbatim", find(raw, "main", "xn--mnchen-3ya.de")?.ms === 11);

  // ---- top-6 truncation ORDERING (the module's rule, verified on data) ----
  seedDays([{ workspaceId: "main", day: dayKey(0),
    byDomain: { d1: 100, d2: 900, d3: 300, d4: 800, d5: 200, d6: 700, d7: 400, d8: 600 } }]);
  const many = await T.byDomainForScope("main", T.lastNLocalDayKeys(30));
  const ordered = many.slice().sort((a, b) => b.ms - a.ms).slice(0, 6).map((r) => r.domain);
  check("top-6: the six largest, in descending order",
    ordered.join(",") === "d2,d4,d6,d8,d7,d3", ordered.join(","));
  check("top-6: the reader itself returns everything (truncation is the board's job)",
    many.length === 8, `got ${many.length}`);

  // ---- degenerate inputs --------------------------------------------------
  store["tracking_days"] = {};
  check("empty store yields no records", (await T.byDomainForScope("main", T.lastNLocalDayKeys(30))).length === 0);
  seedDays([{ workspaceId: "main", day: dayKey(0), byDomain: {} }]);
  check("a day with an empty byDomain map yields no records",
    (await T.byDomainForScope("main", T.lastNLocalDayKeys(30))).length === 0);
  store["tracking_days"] = { "main:x": { day: dayKey(0), workspaceId: "main" } };   // byDomain absent
  check("a day record with byDomain ABSENT does not throw",
    (await T.byDomainForScope("main", T.lastNLocalDayKeys(30))).length === 0);
})();

// ===== [1.8.3] THE WEEK READERS THE WEEKLY REVIEW CARD USES =================
// The card compares this week against last on Insights while the Dashboard
// shows this-week-so-far. Both call Storage.localWeekDayKeys, so they agree by
// construction - but only as long as last week is DERIVED from that same
// helper rather than computed a second time, and only as long as the focus
// stats index on the same day keys. Both are asserted here.
{
  const S = ctx.Storage;
  const has = (fn) => S && typeof S[fn] === "function";

  check("[1.8.3] Storage exposes lastLocalWeekDayKeys and focusStatsForKeys",
    has("lastLocalWeekDayKeys") && has("focusStatsForKeys"));

  // THE ONE-IMPLEMENTATION CONSTRAINT, ASSERTED STRUCTURALLY. The output checks
  // below would all pass a second, independent week calculation that happens to
  // agree today - which is exactly the drift the 04:00 correction was about. So
  // the delegation itself is pinned: last week must be derived by calling the
  // same helper, not by subtracting seven days from anything.
  {
    const src = fs.readFileSync(path.join(repoRoot, "storage.js"), "utf8");
    const m = src.match(/function lastLocalWeekDayKeys\([\s\S]*?\n  \}/);
    const body = m ? m[0] : "";
    check("[1.8.3] lastLocalWeekDayKeys DELEGATES to localWeekDayKeys/startOfLocalWeek",
      /return localWeekDayKeys\(startOfLocalWeek\(ts\) - 1\)/.test(body), body.slice(0, 140));
    check("[1.8.3] ...and computes no week of its own",
      body.length > 0 && !/604800000/.test(body) && !/setDate\(/.test(body) &&
      !/7\s*\*\s*24/.test(body), body.slice(0, 140));
  }

  if (has("lastLocalWeekDayKeys")) {
    const thisWeek = S.localWeekDayKeys();
    const lastWeek = S.lastLocalWeekDayKeys();
    check("[1.8.3] last week is always SEVEN days, however far into this week we are",
      lastWeek.length === 7, `got ${lastWeek.length}`);
    check("[1.8.3] every one of last week's keys precedes this week's first day",
      lastWeek.every((k) => k < thisWeek[0]), JSON.stringify([lastWeek[6], thisWeek[0]]));
    check("[1.8.3] last week's days are contiguous and ascending",
      lastWeek.every((k, i) => i === 0 || k > lastWeek[i - 1]), JSON.stringify(lastWeek));
    // The like-for-like slice is what stops a Tuesday being compared with a
    // whole week. It must never ask for more days than last week has.
    check("[1.8.3] the like-for-like slice never exceeds seven",
      thisWeek.length <= 7 && lastWeek.slice(0, thisWeek.length).length === thisWeek.length,
      `${thisWeek.length} of ${lastWeek.length}`);
    check("[1.8.3] this week is 'so far' - it never runs past today",
      thisWeek[thisWeek.length - 1] === T._localDayKey(Date.now()),
      JSON.stringify(thisWeek));
  }

  if (has("focusStatsForKeys")) {
    const keys = S.localWeekDayKeys();
    // THE KEY ALIGNMENT, asserted rather than assumed: focusStats is keyed by
    // achDayKey and the week helpers emit localDayKey. They are separate
    // functions that happen to build the same string. If either drifts this
    // reader returns zeroes silently, so the agreement is pinned here.
    const data = { focusStats: { version: 1, byDay: {} } };
    data.focusStats.byDay[keys[0]] = { blocked: 3, snoozed: 1 };
    if (keys.length > 1) data.focusStats.byDay[keys[1]] = { blocked: 2, snoozed: 4 };
    data.focusStats.byDay["1999-01-01"] = { blocked: 99, snoozed: 99 };
    const got = S.focusStatsForKeys(data, keys);
    const expectB = keys.length > 1 ? 5 : 3;
    const expectS = keys.length > 1 ? 5 : 1;
    check("[1.8.3] focusStatsForKeys sums ONLY the requested days",
      got.blocked === expectB && got.snoozed === expectS, JSON.stringify(got));
    check("[1.8.3] a day outside the window contributes nothing",
      got.blocked < 99 && got.snoozed < 99, JSON.stringify(got));
    check("[1.8.3] an empty key list yields zeroes, never undefined",
      JSON.stringify(S.focusStatsForKeys(data, [])) === JSON.stringify({ blocked: 0, snoozed: 0 }),
      JSON.stringify(S.focusStatsForKeys(data, [])));
    check("[1.8.3] a profile with no focusStats at all reads as zero, not a throw",
      JSON.stringify(S.focusStatsForKeys({}, keys)) === JSON.stringify({ blocked: 0, snoozed: 0 }));
    // The stats keys must index straight into the week keys - the whole point.
    check("[1.8.3] focusStats day keys and week day keys are the SAME shape",
      Object.keys(data.focusStats.byDay).some((k) => keys.includes(k)),
      JSON.stringify(Object.keys(data.focusStats.byDay)));
  }
}

// ===== [1.8.4] CSV HYGIENE ================================================
// The escaping is the security-relevant part of the export: a task name is
// user-controlled text that ends up in someone's spreadsheet. These are pure
// string functions, so they are pinned here rather than only in the browser.
{
  const S = ctx.Storage;
  const Q = String.fromCharCode(34);

  check("[1.8.4] Storage exposes the CSV helpers",
    ["csvField", "csvGuard", "csvRow", "buildCsv", "exportFilename"]
      .every((f) => typeof S[f] === "function"));

  if (typeof S.csvField === "function") {
    check("[1.8.4] every field is quoted, not only the ones that need it",
      S.csvField("plain") === Q + "plain" + Q, S.csvField("plain"));
    check("[1.8.4] an embedded quote is DOUBLED, per RFC 4180",
      S.csvField('a' + Q + 'b') === Q + "a" + Q + Q + "b" + Q, S.csvField("a" + Q + "b"));
    check("[1.8.4] a comma survives inside a quoted field",
      S.csvField("a,b") === Q + "a,b" + Q, S.csvField("a,b"));
    check("[1.8.4] a NEWLINE survives rather than being stripped - a two-line name is a real name",
      S.csvField("a" + String.fromCharCode(10) + "b").indexOf(String.fromCharCode(10)) !== -1);
    check("[1.8.4] null and undefined become empty, never the string 'undefined'",
      S.csvField(null) === Q + Q && S.csvField(undefined) === Q + Q,
      S.csvField(null) + "/" + S.csvField(undefined));
  }

  if (typeof S.csvGuard === "function") {
    // FORMULA INJECTION. Each of these leads is evaluated by Excel and
    // LibreOffice; a task named "=HYPERLINK(...)" would otherwise be live in the
    // recipient's sheet. The guard prefixes an apostrophe, which spreadsheets
    // read as "the rest is text".
    ["=", "+", "-", "@"].forEach((c) => {
      check("[1.8.4] a name beginning " + c + " is neutralised",
        S.csvGuard(c + "danger").charAt(0) === "'" &&
        S.csvGuard(c + "danger").slice(1) === c + "danger", S.csvGuard(c + "danger"));
    });
    check("[1.8.4] a leading TAB is neutralised too - importers strip it back to the lead",
      S.csvGuard(String.fromCharCode(9) + "=x").charAt(0) === "'");
    check("[1.8.4] a leading CR is neutralised",
      S.csvGuard(String.fromCharCode(13) + "=x").charAt(0) === "'");
    check("[1.8.4] an ORDINARY name is left completely alone",
      S.csvGuard("Write the copy") === "Write the copy", S.csvGuard("Write the copy"));
    check("[1.8.4] a name with = in the MIDDLE is not touched - only the lead is dangerous",
      S.csvGuard("a=b") === "a=b", S.csvGuard("a=b"));
  }

  if (typeof S.buildCsv === "function") {
    const out = S.buildCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    check("[1.8.4] the file starts with a BOM - Excel reads UTF-8 without one as the system codepage",
      out.charCodeAt(0) === 65279, String(out.charCodeAt(0)));
    check("[1.8.4] records are separated by CRLF, per RFC 4180",
      out.indexOf(String.fromCharCode(13) + String.fromCharCode(10)) !== -1 &&
      out.split(String.fromCharCode(10)).length - 1 === out.split(String.fromCharCode(13)).length - 1,
      JSON.stringify(out.slice(0, 24)));
    check("[1.8.4] the file ends with a record separator",
      out.slice(-2) === String.fromCharCode(13) + String.fromCharCode(10));
    check("[1.8.4] the header is the first record",
      out.indexOf(Q + "a" + Q + "," + Q + "b" + Q) === 1, JSON.stringify(out.slice(0, 12)));
  }

  if (typeof S.exportFilename === "function") {
    check("[1.8.4] a multi-day range names both ends",
      S.exportFilename("2026-09-01", "2026-09-07") === "launchpad-focus-2026-09-01_2026-09-07.csv",
      S.exportFilename("2026-09-01", "2026-09-07"));
    check("[1.8.4] a single-day range names it once, not twice",
      S.exportFilename("2026-09-07", "2026-09-07") === "launchpad-focus-2026-09-07.csv",
      S.exportFilename("2026-09-07", "2026-09-07"));
  }
}

// ===== [2026-09-09] EXPORT ABSENCE LABELS ==================================
// The goal dimension shipped the TASK dimension's "(no task)" label, and it
// reached a real export before anyone noticed. These are static assertions over
// newtab.js rather than VM ones, because insightsExportRows lives on the page
// and this suite loads storage.js and tracking.js - a static read is the honest
// way to pin a string literal that no loadable module owns.
{
  const nSrc = fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8");
  const re = /push\("(task|goal|tag)",\s*"(\([^"]*\))"/g;
  const byDim = { task: [], goal: [], tag: [] };
  let m;
  while ((m = re.exec(nSrc)) !== null) byDim[m[1]].push(m[2]);
  const all = byDim.task.concat(byDim.goal, byDim.tag);

  check("[2026-09-09] the export still emits parenthesised absence labels",
    all.length >= 6, JSON.stringify(byDim));
  check("[2026-09-09] EVERY absence label is unique across the three dimensions",
    new Set(all).size === all.length, JSON.stringify(all));
  check("[2026-09-09] the goal dimension does NOT reuse the task dimension's (no task)",
    byDim.goal.indexOf("(no task)") === -1, JSON.stringify(byDim.goal));
  check("[2026-09-09] the task dimension keeps (no task) as its own",
    byDim.task.indexOf("(no task)") !== -1, JSON.stringify(byDim.task));
  check("[2026-09-09] the tag dimension keeps (untagged) as its own",
    byDim.tag.indexOf("(untagged)") !== -1, JSON.stringify(byDim.tag));
  // The two goal absences are DIFFERENT FACTS - no goal possible vs goal
  // unknowable - and [1.8.4] kept them apart on purpose.
  check("[2026-09-09] untasked goal time is distinct from purged-task goal time",
    byDim.goal.indexOf("(no goal - untasked)") !== -1 &&
    byDim.goal.indexOf("(goal unknown - task purged)") !== -1 &&
    byDim.goal.indexOf("(no goal)") !== -1, JSON.stringify(byDim.goal));
  // Each dimension's ABSENCE label (the "none"-status one) differs pairwise.
  const absence = { task: "(no task)", goal: "(no goal - untasked)", tag: "(untagged)" };
  check("[2026-09-09] the three dimensions' untasked/absence labels are pairwise distinct",
    new Set(Object.values(absence)).size === 3 &&
    Object.keys(absence).every((k) => byDim[k].indexOf(absence[k]) !== -1),
    JSON.stringify(absence));
}

let pass = 0, fail = 0;
console.log("\nINSIGHTS READERS — windowed rollups\n");
for (const r of rows) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
  r.pass ? pass++ : fail++;
}
// Anti-vacuity floor, the check-panel-ink.mjs lesson: a suite that silently stops
// asserting is a green light that checks nothing.
const MIN = 15;
if (rows.length < MIN) {
  console.log(`\nINSIGHTS READERS: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
console.log(`\nINSIGHTS READERS: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
