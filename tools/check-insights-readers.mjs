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
