#!/usr/bin/env node
// Suite for the [2.0] Dashboard "Today" cockpit. Asana 1217356961646855.
//
// The cockpit reports five figures about the user's own day, and every one of
// them fails in the same quiet direction: a wrong number that looks like a
// number. A streak that resets at 09:00 because today has no minutes yet, a
// completed-today count that rolls over at UTC midnight instead of the user's,
// a done-ratio that reads NaN on a goal with no tasks, a blocked count that says
// nothing when it means zero — none of these throw, none of them look broken,
// and all of them make the surface untrustworthy the first time the user checks
// the arithmetic. So the boundaries get asserted rather than eyeballed.
//
// The readers are loaded from the REAL storage.js and tracking.js in a Node VM
// against a fake chrome.storage.local, so this exercises shipped code and not a
// restatement of it. The page-side pieces the VM cannot host (the day-encoding
// helper, the render composition, the O1 ink rules for markup no static gate can
// see) are asserted against newtab.js / newtab.css source, with every anchor
// occurrence-counted per Q2 so a seed or a slice can never silently land nowhere.
//
// Usage: node tools/check-today-cockpit.mjs [repoRoot] [--mutate]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
//
// --mutate re-boots the subject once per seeded defect and confirms the suite
// catches each (P3). It is development verification, not a release gate — the
// gate is the clean run, which takes ~0.1s.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
const MUTATE = process.argv.includes("--mutate");
const clone = (v) => JSON.parse(JSON.stringify(v));
const DAY = 86400000;

// core.autocrlf=true -> CRLF in the working tree; normalize before slicing or
// every anchor below silently misses (BUGS.md M).
const rd = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

let SRC;
try {
  SRC = { storage: rd("storage.js"), tracking: rd("tracking.js"), nt: rd("newtab.js"), css: rd("newtab.css") };
} catch (e) {
  console.error(`TODAY COCKPIT: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Boot the real modules.
// ---------------------------------------------------------------------------
function boot(src) {
  const store = {};
  const ctx = {
    chrome: {
      storage: {
        local: {
          async get(k) { if (typeof k === "string") { const o = {}; if (k in store) o[k] = clone(store[k]); return o; } return clone(store); },
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
    Date, Math, JSON, URL, Promise, Set, Map, Object, Array, String, Number, Boolean,
    isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src.storage, ctx, { filename: "storage.js" });
  vm.runInContext(src.tracking, ctx, { filename: "tracking.js" });

  // The page-side day encoder, executed from its REAL source rather than
  // restated here. dueAt lives in a single encoding and this function is the one
  // place that produces it, so a copy in the suite would be testing the copy.
  const fn = extractFn(src.nt, "dashboardTodayAsUtcDay");
  ctx.__extracted = null;
  vm.runInContext(`__extracted = (function(){ ${fn} ; return dashboardTodayAsUtcDay; })();`, ctx, { filename: "newtab.js#extract" });
  ctx.dashboardTodayAsUtcDay = ctx.__extracted;

  // The module-4 header block, likewise from its REAL source. Its arbitration is
  // the subject of the 2026-08-11 follow-up ("Work’s done." rendered above five
  // Overdue rows), and a restatement of the branch here would be a suite that
  // tests the restatement. Everything the branch reaches for comes with it —
  // the suggestion cascade, the escaper, the two label maps — so the fixtures
  // drive the shipped decision and not a stand-in for it.
  const PAGE_DECLS = ["PRIORITY_LABELS", "PRIORITY_RANK", "DASH_DUE_MAX"];
  const PAGE_FNS = [
    "escapeHtml", "fmtShortDate", "dashboardSuggestionTier", "dashboardCompareSuggestions",
    "dashboardPickSuggestion", "dashboardDueLabel", "dashHeadHtml", "dashDueListHtml",
  ];
  vm.runInContext(
    PAGE_DECLS.map((n) => extractDecl(src.nt, n)).join("\n") + "\n" +
      PAGE_FNS.map((n) => extractFn(src.nt, n)).join("\n"),
    ctx, { filename: "newtab.js#head" });
  return { ctx, store };
}

// Slice one function declaration out of newtab.js by an anchor that must match
// EXACTLY ONCE (Q2: a slice that lands nowhere, or in the wrong place, reads as
// a result and is not one).
function extractFn(src, name) {
  const anchor = `\n  function ${name}(`;
  const first = src.indexOf(anchor);
  if (first === -1) throw new Error(`anchor miss: ${name} not found in newtab.js`);
  if (src.indexOf(anchor, first + 1) !== -1) throw new Error(`anchor ambiguous: ${name} declared more than once`);
  const end = src.indexOf("\n  }\n", first);
  if (end === -1) throw new Error(`anchor unterminated: ${name}`);
  return src.slice(first, end + 4);
}

// Same rule for a top-level `var NAME = …;` constant: exactly one match, or the
// extraction is guessing.
function extractDecl(src, name) {
  const m = src.match(new RegExp(`^  var ${name} = .*$`, "gm"));
  if (!m) throw new Error(`decl anchor miss: ${name} not found in newtab.js`);
  if (m.length !== 1) throw new Error(`decl anchor ambiguous: ${name} declared ${m.length} times`);
  return m[0];
}

let ctx, store;
try {
  ({ ctx, store } = boot(SRC));
} catch (err) {
  console.error(`TODAY COCKPIT: SUBJECT DID NOT LOAD — ${err && err.message}`);
  process.exit(2);
}

const S = ctx.Storage, T = ctx.Tracking;
for (const fn of ["localDayKey", "focusBlockedOnDay", "tasksCompletedOnDay", "goalProgressList", "tasksDueByDay", "focusStreakFromRange", "createTask", "completeTask", "utcDay"]) {
  if (!S || typeof S[fn] !== "function") { console.error(`TODAY COCKPIT: SUBJECT DID NOT LOAD — Storage.${fn} missing`); process.exit(2); }
}
for (const fn of ["focusedRangeForScope", "lastNLocalDayKeys", "_localDayKey"]) {
  if (!T || typeof T[fn] !== "function") { console.error(`TODAY COCKPIT: SUBJECT DID NOT LOAD — Tracking.${fn} missing`); process.exit(2); }
}
if (typeof ctx.dashboardTodayAsUtcDay !== "function") { console.error("TODAY COCKPIT: SUBJECT DID NOT LOAD — dashboardTodayAsUtcDay did not extract"); process.exit(2); }
for (const fn of ["dashHeadHtml", "dashDueListHtml", "dashboardPickSuggestion", "escapeHtml"]) {
  if (typeof ctx[fn] !== "function") { console.error(`TODAY COCKPIT: SUBJECT DID NOT LOAD — ${fn} did not extract`); process.exit(2); }
}

// ---------------------------------------------------------------------------
// Assertions.
// ---------------------------------------------------------------------------
const rows = [];
let SKIPPED = 0;
const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail: String(detail) });
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
const skip = (name, why) => { SKIPPED++; rows.push({ name, pass: true, skip: true, detail: why }); };

// A workspace fixture. Q6/Q7: every scenario builds its own from scratch and
// reads back what it seeded, so nothing leaks between sections.
let uid = 0;
const mkWs = (over) => Object.assign({ id: "main", name: "Main", tasks: [], goals: [], tags: [] }, over || {});
const mkTask = (o) => Object.assign({
  id: "t" + (++uid), name: "task " + uid, description: "", goalId: null, dueAt: null, priority: null,
  tagIds: [], completed: false, completedAt: null, createdAt: 1000, deletedAt: null, displayOrder: uid,
}, o);
const mkGoal = (o) => Object.assign({
  id: "g" + (++uid), name: "goal " + uid, description: "", deadlineAt: null, status: "active",
  autoTagId: null, isCollapsed: false, createdAt: 1000, completedAt: null, deletedAt: null, displayOrder: uid,
}, o);

// Local-calendar instants, built from the runner's own zone so the boundaries
// under test are the ones the user actually experiences.
const now = new Date();
const localMidnight = (offsetDays) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (offsetDays || 0));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const TODAY_KEY = S.localDayKey();

await (async () => {

  // ======================= day keys: the shared premise ====================
  // The strip keys today's blocked count with Storage.localDayKey and the streak
  // walks a window built by Tracking.lastNLocalDayKeys. Those are two separate
  // implementations in two separate files, and the cockpit is only coherent if
  // they name the same day the same way. Asserted, never assumed.
  const probes = [Date.now(), localMidnight(0), localMidnight(0) + DAY - 1, localMidnight(1), localMidnight(400), 0];
  check("day key: Storage.localDayKey matches Tracking._localDayKey on every probe",
    probes.every((p) => S.localDayKey(p) === T._localDayKey(p)),
    JSON.stringify(probes.map((p) => [S.localDayKey(p), T._localDayKey(p)])));
  check("day key: zero-padded YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(TODAY_KEY), TODAY_KEY);
  eq("day key: no argument means now", S.localDayKey(), S.localDayKey(Date.now()));
  eq("day key: today's window key is today's key", T.lastNLocalDayKeys(1)[0], TODAY_KEY);
  check("day key: a 30-key window is oldest-first, today last",
    T.lastNLocalDayKeys(30).length === 30 && T.lastNLocalDayKeys(30)[29] === TODAY_KEY);

  // ======================= streak math =====================================
  const K = (n) => T.lastNLocalDayKeys(n);
  const rangeOf = (keys, msList) => { const r = {}; keys.forEach((k, i) => { r[k] = msList[i]; }); return r; };
  // keys are oldest-first, so the array below reads oldest -> today.
  const streak = (msOldestFirst) => { const keys = K(msOldestFirst.length); return S.focusStreakFromRange(rangeOf(keys, msOldestFirst), keys); };

  eq("streak: no keys at all", S.focusStreakFromRange({}, []), { days: 0, capped: false, todayCounted: false });
  eq("streak: null range", S.focusStreakFromRange(null, K(5)), { days: 0, capped: false, todayCounted: false });
  eq("streak: every day zero", streak([0, 0, 0, 0, 0]), { days: 0, capped: false, todayCounted: false });
  eq("streak: today only -> 1 day", streak([0, 0, 0, 0, 60000]), { days: 1, capped: false, todayCounted: true });
  eq("streak: today + yesterday -> 2 days", streak([0, 0, 0, 5, 5]), { days: 2, capped: false, todayCounted: true });
  eq("streak: n consecutive days", streak([0, 1, 1, 1, 1]), { days: 4, capped: false, todayCounted: true });
  // A GAP RESETS. The days before the gap are real, and they are not this streak.
  eq("streak: a gap resets — earlier days do NOT carry over", streak([9, 9, 0, 9, 9]), { days: 2, capped: false, todayCounted: true });

  // TODAY-ZERO GRACE. The single most important row here: a user who has focused
  // every day for a month opens a tab at 09:00 before starting, and the streak
  // must not read 0. It stands at yesterday's count and says today is still open.
  eq("streak: today zero -> the streak THROUGH YESTERDAY stands", streak([0, 7, 7, 7, 0]), { days: 3, capped: false, todayCounted: false });
  eq("streak: today zero and yesterday zero -> genuinely 0", streak([7, 7, 7, 0, 0]), { days: 0, capped: false, todayCounted: false });
  eq("streak: today zero, only yesterday -> 1", streak([0, 0, 0, 7, 0]), { days: 1, capped: false, todayCounted: false });

  // THE RETENTION CAP. A full window is a FLOOR, not a total — the engine keeps
  // 30 days and cannot answer for the 31st, so the page renders "30+".
  const full30 = new Array(30).fill(60000);
  eq("streak: 30 full days -> capped (renders '30+')", streak(full30), { days: 30, capped: true, todayCounted: true });
  const gap30 = full30.slice(); gap30[0] = 0;
  eq("streak: a zero on the OLDEST day -> exactly 29, NOT capped", streak(gap30), { days: 29, capped: false, todayCounted: true });
  const todayZero30 = full30.slice(); todayZero30[29] = 0;
  eq("streak: today zero on a full window -> 29 and capped (honest floor)", streak(todayZero30), { days: 29, capped: true, todayCounted: false });
  eq("streak: a 1-key window with time today is already capped", streak([5]), { days: 1, capped: true, todayCounted: true });
  eq("streak: an exhausted window with ZERO days is not 'capped'", streak([0]), { days: 0, capped: false, todayCounted: false });

  // Degenerate map values must read as no-time, never as time.
  {
    const keys = K(3);
    eq("streak: a MISSING key reads as zero, not as time",
      S.focusStreakFromRange({ [keys[2]]: 10 }, keys), { days: 1, capped: false, todayCounted: true });
    eq("streak: undefined / null / negative ms all read as no time",
      S.focusStreakFromRange({ [keys[0]]: null, [keys[1]]: -500, [keys[2]]: 10 }, keys),
      { days: 1, capped: false, todayCounted: true });
  }
  // Q6: purity from a fresh fixture — the reader must not touch what it is given.
  {
    const keys = K(4);
    const r = rangeOf(keys, [1, 0, 1, 1]);
    const before = JSON.stringify(r), keysBefore = JSON.stringify(keys);
    S.focusStreakFromRange(r, keys);
    check("streak: reader mutates neither the range map nor the key list",
      JSON.stringify(r) === before && JSON.stringify(keys) === keysBefore);
  }
  check("streak: composed page-side — tracking.js gained NO streak reader",
    T.focusStreakFromRange === undefined && T.focusStreak === undefined && T.streakForScope === undefined);

  // ======================= completed today (midnight boundary) =============
  {
    const ws = mkWs({ tasks: [
      mkTask({ id: "a", completed: true, completedAt: localMidnight(0) }),                 // 00:00:00.000 today
      mkTask({ id: "b", completed: true, completedAt: localMidnight(0) + DAY - 1 }),       // 23:59:59.999 today
      mkTask({ id: "c", completed: true, completedAt: localMidnight(0) - 1 }),             // 23:59:59.999 YESTERDAY
      mkTask({ id: "d", completed: true, completedAt: localMidnight(1) }),                 // yesterday 00:00
    ] });
    eq("completed today: both edges of the local day count, neither neighbour does",
      S.tasksCompletedOnDay(ws, TODAY_KEY), 2);
    eq("completed today: yesterday's key sees exactly yesterday's two",
      S.tasksCompletedOnDay(ws, S.localDayKey(localMidnight(1))), 2);
  }
  {
    // The three ways a stamp can be present and still not mean "completed today".
    const ws = mkWs({ tasks: [
      mkTask({ completed: true, completedAt: Date.now(), deletedAt: Date.now() }),  // trashed
      mkTask({ completed: false, completedAt: Date.now() }),                        // stamp without the flag
      mkTask({ completed: true, completedAt: null }),                               // flag without a stamp
      mkTask({ completed: true, completedAt: "today" }),                            // non-numeric
    ] });
    eq("completed today: a TRASHED task keeps its stamp and must not be counted", S.tasksCompletedOnDay(ws, TODAY_KEY), 0);
  }
  eq("completed today: empty workspace", S.tasksCompletedOnDay(mkWs(), TODAY_KEY), 0);
  eq("completed today: null workspace", S.tasksCompletedOnDay(null, TODAY_KEY), 0);
  eq("completed today: a non-string key", S.tasksCompletedOnDay(mkWs(), 12345), 0);
  {
    // Reactivation clears the stamp, so the count falls — driven through the REAL
    // completeTask/reactivateTask pair rather than by hand-editing the fixture.
    const d = { workspaces: [mkWs({ tasks: [mkTask({ id: "x" })] })], activeWorkspaceId: "main" };
    await S.completeTask(d, "x");
    eq("completed today: the real completeTask makes the count 1", S.tasksCompletedOnDay(d.workspaces[0], TODAY_KEY), 1);
    check("completed today: ...and stamps the local day the page keys on",
      S.localDayKey(d.workspaces[0].tasks[0].completedAt) === TODAY_KEY);
    await S.reactivateTask(d, "x");
    eq("completed today: reactivating takes it back out", S.tasksCompletedOnDay(d.workspaces[0], TODAY_KEY), 0);
  }

  // ======================= goal done-ratios ================================
  {
    const ws = mkWs();
    const gEmpty = mkGoal({ id: "ge", name: "empty", createdAt: 500 });
    const gAll = mkGoal({ id: "ga", name: "all done", createdAt: 400 });
    const gNone = mkGoal({ id: "gn", name: "none done", createdAt: 300 });
    const gPart = mkGoal({ id: "gp", name: "partial", createdAt: 200 });
    const gDone = mkGoal({ id: "gd", name: "closed", status: "completed", createdAt: 100 });
    const gTrash = mkGoal({ id: "gt", name: "trashed", deletedAt: 1, createdAt: 100 });
    ws.goals = [gEmpty, gAll, gNone, gPart, gDone, gTrash];
    ws.tasks = [
      mkTask({ goalId: "ga", completed: true, completedAt: 4000, createdAt: 10 }),
      mkTask({ goalId: "ga", completed: true, completedAt: 4100, createdAt: 10 }),
      mkTask({ goalId: "gn", createdAt: 20 }),
      mkTask({ goalId: "gn", createdAt: 20 }),
      mkTask({ goalId: "gp", completed: true, completedAt: 9000, createdAt: 30 }),
      mkTask({ goalId: "gp", createdAt: 30 }),
      mkTask({ goalId: "gp", createdAt: 30 }),
      mkTask({ goalId: "gp", deletedAt: 1, completed: true, completedAt: 9999, createdAt: 30 }), // trashed
    ];
    const list = S.goalProgressList(ws);
    const byId = (id) => list.find((e) => e.goal.id === id);

    check("goals: completed and trashed goals are excluded", list.length === 4 && !byId("gd") && !byId("gt"), JSON.stringify(list.map((e) => e.goal.id)));
    eq("goals: a goal with NO tasks is 0 of 0 at 0% — never NaN", [byId("ge").done, byId("ge").total, byId("ge").pct], [0, 0, 0]);
    check("goals: 0% on an empty goal is a real number", Number.isFinite(byId("ge").pct));
    eq("goals: all done -> 100%", [byId("ga").done, byId("ga").total, byId("ga").pct], [2, 2, 100]);
    eq("goals: none done -> 0%", [byId("gn").done, byId("gn").total, byId("gn").pct], [0, 2, 0]);
    eq("goals: 1 of 3 rounds to 33%", [byId("gp").done, byId("gp").total, byId("gp").pct], [1, 3, 33]);
    check("goals: a TRASHED task is outside the ratio entirely", byId("gp").total === 3);
    // The deliberate behaviour change from the retired dashboardTopGoals, which
    // hid any goal with nothing open. A goal at 2 of 2 waiting to be closed is
    // exactly what a progress module exists to show.
    check("goals: a fully-done ACTIVE goal is still shown", !!byId("ga"));
    // Recency ordering: gp's newest child stamp (9000) beats ga's (4100); the
    // taskless goal falls back to its own createdAt (500), which beats gn's
    // children (20) but loses to both stamped goals.
    eq("goals: ordered by most recent activity, taskless goals by createdAt",
      list.map((e) => e.goal.id), ["gp", "ga", "ge", "gn"]);
  }
  {
    // A total order: equal recency must not leave the list free to flicker.
    const ws = mkWs({ goals: [
      mkGoal({ id: "g2", createdAt: 777, displayOrder: 2 }),
      mkGoal({ id: "g1", createdAt: 777, displayOrder: 1 }),
    ] });
    eq("goals: equal recency breaks on displayOrder, so the order is stable",
      S.goalProgressList(ws).map((e) => e.goal.id), ["g1", "g2"]);
  }
  eq("goals: null workspace", S.goalProgressList(null), []);
  eq("goals: workspace with no goals", S.goalProgressList(mkWs()), []);

  // ======================= blocked count ===================================
  eq("blocked: an install that has NEVER blocked reads 0", S.focusBlockedOnDay({}, TODAY_KEY), 0);
  check("blocked: ...and 0 is a number, not NaN or undefined", Number.isFinite(S.focusBlockedOnDay({}, TODAY_KEY)));
  eq("blocked: a day with no bucket reads 0", S.focusBlockedOnDay({ focusStats: { version: 1, byDay: { "2001-01-01": { blocked: 9, snoozed: 0 } } } }, TODAY_KEY), 0);
  eq("blocked: today's bucket reads exactly", S.focusBlockedOnDay({ focusStats: { version: 1, byDay: { [TODAY_KEY]: { blocked: 7, snoozed: 2 } } } }, TODAY_KEY), 7);
  eq("blocked: a malformed bucket normalizes to 0", S.focusBlockedOnDay({ focusStats: { version: 1, byDay: { [TODAY_KEY]: "lots" } } }, TODAY_KEY), 0);
  eq("blocked: a negative count normalizes to 0", S.focusBlockedOnDay({ focusStats: { version: 1, byDay: { [TODAY_KEY]: { blocked: -4, snoozed: 0 } } } }, TODAY_KEY), 0);
  eq("blocked: a garbage focusStats record does not throw", S.focusBlockedOnDay({ focusStats: "nope" }, TODAY_KEY), 0);
  eq("blocked: null data", S.focusBlockedOnDay(null, TODAY_KEY), 0);
  eq("blocked: a non-string key", S.focusBlockedOnDay({}, null), 0);
  {
    // Driven through the REAL writer, so a change to either side is caught.
    const d = { workspaces: [mkWs()], activeWorkspaceId: "main" };
    await S.incrementFocusStat(d, "blocked", Date.now());
    await S.incrementFocusStat(d, "blocked", Date.now());
    await S.incrementFocusStat(d, "snoozed", Date.now());
    eq("blocked: the real incrementFocusStat writer and this reader agree", S.focusBlockedOnDay(d, TODAY_KEY), 2);
    eq("blocked: snoozes are NOT counted as blocks", S.focusBlockedOnDay(d, S.localDayKey()), 2);
  }

  // ======================= due today / overdue =============================
  const TODAY_UTC = ctx.dashboardTodayAsUtcDay();
  {
    const ws = mkWs({ tasks: [
      mkTask({ id: "od2", dueAt: TODAY_UTC - 2 * DAY, createdAt: 5 }),
      mkTask({ id: "od1", dueAt: TODAY_UTC - DAY, createdAt: 5 }),
      mkTask({ id: "td_b", dueAt: TODAY_UTC, createdAt: 200 }),
      mkTask({ id: "td_a", dueAt: TODAY_UTC, createdAt: 100 }),
      mkTask({ id: "tomorrow", dueAt: TODAY_UTC + DAY }),
      mkTask({ id: "nodue", dueAt: null }),
      mkTask({ id: "done", dueAt: TODAY_UTC, completed: true, completedAt: Date.now() }),
      mkTask({ id: "trashed", dueAt: TODAY_UTC - DAY, deletedAt: 1 }),
    ] });
    const due = S.tasksDueByDay(ws, TODAY_UTC);
    eq("due: overdue first (oldest first), then today's, tie-broken by createdAt",
      due.map((t) => t.id), ["od2", "od1", "td_a", "td_b"]);
    check("due: tomorrow, undated, completed and trashed are all out",
      !due.some((t) => ["tomorrow", "nodue", "done", "trashed"].includes(t.id)));
    eq("due: exactly the overdue ones read as overdue",
      due.filter((t) => S.utcDay(t.dueAt) < TODAY_UTC).map((t) => t.id), ["od2", "od1"]);
  }
  eq("due: nothing due today", S.tasksDueByDay(mkWs(), TODAY_UTC), []);
  eq("due: null workspace", S.tasksDueByDay(null, TODAY_UTC), []);
  eq("due: a non-numeric today stamp", S.tasksDueByDay(mkWs(), "today"), []);

  // ======================= the header's claim about the board ==============
  // FOLLOW-UP, live finding 2026-08-11: the evening head read "Work’s done."
  // while five Overdue rows sat directly beneath it, in the very module the head
  // belongs to. The header was gated on the CLOCK alone, and the clock does not
  // know what is on the board.
  //
  // The whole point is that the head and the list cannot disagree, so every row
  // below drives the REAL dashHeadHtml and the REAL dashDueListHtml off the same
  // fixture and reads both.
  {
    const head = (d, ws, period) => ctx.dashHeadHtml(d, ws, period, S.tasksDueByDay(ws, TODAY_UTC));
    const list = (ws) => ctx.dashDueListHtml(ws, S.tasksDueByDay(ws, TODAY_UTC));
    const variantOf = (html) => (html.match(/data-dash-variant="([^"]+)"/) || [])[1] || "";
    const headlineOf = (html) => (html.match(/<div class="dash-headline">([\s\S]*?)<\/div>/) || [])[1] || "";
    const DONE = "Work’s done.";
    const ONE = "One still on the board.";
    const FEW = "Still a few on the board.";

    const wsWith = (tasks) => mkWs({ tasks: tasks });
    const dataFor = (ws) => ({ workspaces: [ws], activeWorkspaceId: "main" });
    const overdue = (n) => Array.from({ length: n }, (_, i) => mkTask({ dueAt: TODAY_UTC - (i + 1) * DAY }));
    const dueToday = (n) => Array.from({ length: n }, () => mkTask({ dueAt: TODAY_UTC }));

    // --- evening, nothing open: the close-out line stands, unchanged ---
    {
      const ws = wsWith([
        mkTask({ dueAt: TODAY_UTC, completed: true, completedAt: Date.now() }),  // done today
        mkTask({ dueAt: TODAY_UTC + DAY }),                                      // tomorrow
        mkTask({ dueAt: null }),                                                 // undated
        mkTask({ dueAt: TODAY_UTC - DAY, deletedAt: 1 }),                        // trashed
      ]);
      const h = head(dataFor(ws), ws, "evening");
      eq("header: evening + an EMPTY board -> the close-out line, unchanged", headlineOf(h), DONE);
      eq("header: ...under the unchanged evening variant", variantOf(h), "evening");
      check("header: ...and the list beneath it agrees there is nothing", /Nothing due today\./.test(list(ws)));
      check("header: ...with the title unchanged", /That’s the day/.test(h));
    }

    // --- evening with work still open: the defect, in both plural forms ---
    {
      const ws = wsWith(overdue(5));  // the screenshot, exactly
      const h = head(dataFor(ws), ws, "evening");
      check("header: evening + five OVERDUE rows never says the work is done", !h.includes(DONE), h);
      eq("header: ...it says so plainly instead", headlineOf(h), FEW);
      eq("header: ...under its own variant, so the two states are distinguishable", variantOf(h), "evening-open");
      check("header: ...and the list beneath it is not empty", !/Nothing due today\./.test(list(ws)) && (list(ws).match(/dash-due-row/g) || []).length === 5);
      check("header: ...with the same close-out title — the day IS over", /That’s the day/.test(h));
    }
    {
      const ws = wsWith(overdue(1));
      eq("header: evening + exactly ONE open item takes the singular", headlineOf(head(dataFor(ws), ws, "evening")), ONE);
    }
    {
      const ws = wsWith(overdue(1).concat(dueToday(1)));
      eq("header: evening + TWO is the plural boundary", headlineOf(head(dataFor(ws), ws, "evening")), FEW);
    }
    {
      const ws = wsWith(dueToday(3));
      eq("header: due-today with nothing overdue is open work too", headlineOf(head(dataFor(ws), ws, "evening")), FEW);
      eq("header: ...and still the open variant", variantOf(head(dataFor(ws), ws, "evening")), "evening-open");
    }
    {
      // Completing the last open row must take the header back to the close-out,
      // driven through the REAL completeTask rather than by swapping fixtures.
      const ws = wsWith(overdue(1));
      const d = dataFor(ws);
      eq("header: one open row -> the open line", headlineOf(head(d, ws, "evening")), ONE);
      await S.completeTask(d, ws.tasks[0].id);
      eq("header: ...ticking it off earns the close-out line", headlineOf(head(d, ws, "evening")), DONE);
    }

    // --- copy register: a statement, not a scolding ---
    for (const [label, line] of [["singular", ONE], ["plural", FEW]]) {
      check(`header: the ${label} open line is a calm statement — no exclamation, no second person`,
        !/[!]/.test(line) && !/\byou(r|’ve|'ve)?\b/i.test(line) && /\.$/.test(line), line);
    }

    // --- precedence, unchanged in every direction ---
    {
      // Evening still wins over an active task and over the suggestion cascade —
      // that arbitration is NOT what this round changes.
      const ws = wsWith([mkTask({ id: "act", dueAt: TODAY_UTC })]);
      const d = dataFor(ws);
      d.activeTask = { taskId: "act", workspaceId: "main", startedAt: Date.now() };
      const res = S.resolveActiveTask(d);
      check("header: FIXTURE PRECONDITION — the active task resolves non-stale",
        !!(res && !res.stale && res.task && res.task.id === "act"), JSON.stringify(res && res.reason));
      const evening = head(d, ws, "evening");
      eq("header: evening still outranks an active task (precedence unchanged)", variantOf(evening), "evening-open");
      check("header: ...and the pick-up copy does not leak into it", !/Pick up where you left off/.test(evening));
      eq("header: an active task in the DAY is still the pick-up head", variantOf(head(d, ws, "day")), "pickup");
      eq("header: ...with the active task's own name on the line", headlineOf(head(d, ws, "day")), ws.tasks[0].name);
    }
    {
      // Suggestion present: the day head is the suggestion, whether or not the
      // due module has open rows. The new gate must not have reached this branch.
      const ws = wsWith([mkTask({ id: "sug", name: "write the thing", dueAt: TODAY_UTC })]);
      const d = dataFor(ws);
      const h = head(d, ws, "day");
      eq("header: day + a suggestion -> the suggestion head (precedence unchanged)", variantOf(h), "suggestion");
      eq("header: ...carrying the picked task's name", headlineOf(h), "write the thing");
      check("header: ...and it is the SAME task the cascade picks", ctx.dashboardPickSuggestion(ws).id === "sug");
      check("header: ...with the open board changing nothing about it", !h.includes(DONE) && !h.includes(FEW) && !h.includes(ONE));
    }
    {
      const ws = wsWith([]);
      eq("header: day + an empty board -> the calm empty head (unchanged)", variantOf(head(dataFor(ws), ws, "day")), "empty");
      eq("header: ...with its unchanged line", headlineOf(head(dataFor(ws), ws, "day")), "Nothing on the list.");
    }
    {
      // Only "evening" opts into the close-out at all — an unknown period must
      // fall through to the day cascade, never to a bare "Work’s done.".
      const ws = wsWith([]);
      check("header: only the evening period reaches the close-out branch",
        !head(dataFor(ws), ws, "day").includes(DONE) && !head(dataFor(ws), ws, "").includes(DONE));
    }

    // --- the invariant, stated once over the whole matrix ---
    {
      const boards = [[], overdue(1), overdue(5), dueToday(2), overdue(2).concat(dueToday(2))];
      const coherent = boards.every((tasks) => {
        const ws = wsWith(tasks);
        const empty = /Nothing due today\./.test(list(ws));
        return head(dataFor(ws), ws, "evening").includes(DONE) === empty;
      });
      check("header: over every board shape, \"Work’s done.\" appears IF AND ONLY IF the list below is empty", coherent);
    }

    // --- one read, structurally: the head cannot read a different list ---
    {
      const headBody = extractFn(SRC.nt, "dashHeadHtml");
      const renderBody = (() => {
        const i = SRC.nt.indexOf("\n  function renderDashboardTab(");
        return SRC.nt.slice(i, SRC.nt.indexOf("\n  }\n", i));
      })();
      check("header: the head does NOT read the due set itself — it is handed the render's array",
        !/tasksDueByDay/.test(headBody) && /dueOpen/.test(headBody), headBody.slice(0, 60));
      check("header: the render reads it exactly ONCE and feeds both builders",
        (renderBody.match(/tasksDueByDay/g) || []).length === 1 &&
        /dashHeadHtml\(d, ws, period, dueOpen\)/.test(renderBody) &&
        /dashDueListHtml\(ws, dueOpen\)/.test(renderBody));
    }

    // --- O1: no new ink surface. The two new lines are .dash-headline inside
    // .dash-head, the same classes the evening variant already shipped, so the
    // rules the live pass measured cover them unchanged. Asserted rather than
    // asserted-by-comment: a new class here would be a new unmeasured surface.
    {
      const headBody = extractFn(SRC.nt, "dashHeadHtml");
      // Cut at the first quote: one attribute is built by concatenation
      // (`class="dash-meta-due' + (dueLabel === …`), so the literal head of the
      // value is the part that is actually a class list.
      const classes = new Set((headBody.match(/class="([^"]+)"/g) || [])
        .flatMap((m) => m.slice(7, -1).split("'")[0].split(/\s+/)).filter(Boolean));
      const known = ["dash-head", "pp-dash-card-title", "dash-headline", "dash-sub", "dash-cta", "dash-meta", "dash-meta-due", "is-overdue", "dash-meta-prio"];
      check("header: the new variant introduces NO new class — nothing unmeasured ships with it",
        [...classes].every((c) => known.includes(c)), [...classes].join(" "));
      check("header: ...and the evening-open line rides .dash-headline like every other head",
        /data-dash-variant="evening-open"[\s\S]{0,300}class="dash-headline"/.test(headBody));
      check("header: ...so the ink rules already in the sheet cover it",
        /\.dash-head \{/.test(SRC.css) && /\.dash-headline \{/.test(SRC.css) &&
        !/\.dash-head\[data-dash-variant/.test(SRC.css));
    }
  }

  // ======================= quick-add ======================================
  // THE ENCODING IS THE WHOLE RISK. dueAt is UTC-midnight of the user's LOCAL
  // calendar date; both a local-midnight timestamp and utcDay(Date.now()) are
  // off by a day for some users, and the second is off in Bali specifically,
  // every morning before 08:00.
  check("quick-add: the day stamp is UTC-midnight (no time-of-day component)", TODAY_UTC % DAY === 0, String(TODAY_UTC));
  eq("quick-add: the stamp is already normalized — utcDay is a no-op on it", S.utcDay(TODAY_UTC), TODAY_UTC);
  eq("quick-add: it encodes the LOCAL calendar date", TODAY_UTC, Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  {
    // Zone-independent proof that the helper reads LOCAL calendar fields: the two
    // wrong implementations are both visible in source, and neither may appear.
    const body = extractFn(SRC.nt, "dashboardTodayAsUtcDay");
    check("quick-add: the encoder uses LOCAL getters, never the UTC ones",
      /getFullYear\(\)/.test(body) && /getMonth\(\)/.test(body) && /getDate\(\)/.test(body) && !/getUTC/.test(body), body.trim().slice(0, 120));
    check("quick-add: ...and is not Storage.utcDay(Date.now()) in disguise", !/utcDay/.test(body));
  }
  {
    // And a behavioural check in whatever zone the runner is in. Reported as an
    // explicit SKIP under UTC rather than passing vacuously (P2).
    const offsetMin = now.getTimezoneOffset();
    if (offsetMin === 0) {
      skip("quick-add: local-vs-UTC divergence", "runner is at UTC — the two encodings cannot diverge here");
    } else {
      // Somewhere in the day there is an hour where the local date and the UTC
      // date disagree; at that instant the naive encoding is off by a day.
      const probe = new Date(now.getFullYear(), now.getMonth(), now.getDate(), offsetMin > 0 ? 23 : 1, 30).getTime();
      const naive = S.utcDay(probe);
      const right = ctx.dashboardTodayAsUtcDay(probe);
      check("quick-add: the naive utcDay(now) encoding IS off by a day at the edge of the local day",
        naive !== right && Math.abs(naive - right) === DAY, `naive ${naive} right ${right}`);
    }
  }
  {
    // The real creation path, end to end: type a name, get a task that the
    // due-today module will show today and will not call overdue.
    const d = { workspaces: [mkWs()], activeWorkspaceId: "main" };
    const created = await S.createTask(d, { name: "  ship it  ", dueAt: ctx.dashboardTodayAsUtcDay() });
    check("quick-add: createTask returns the task", !!created);
    eq("quick-add: the name is trimmed", created.name, "ship it");
    eq("quick-add: it is due TODAY", created.dueAt, TODAY_UTC);
    eq("quick-add: it is standalone — no goal, no tags, no priority", [created.goalId, created.tagIds.length, created.priority], [null, 0, null]);
    eq("quick-add: it is incomplete", [created.completed, created.completedAt], [false, null]);
    const due = S.tasksDueByDay(d.workspaces[0], TODAY_UTC);
    eq("quick-add: the row appears in the due-today list immediately", due.map((t) => t.id), [created.id]);
    check("quick-add: and is NOT badged overdue on the day it was created", S.utcDay(created.dueAt) >= TODAY_UTC);
    eq("quick-add: an empty name creates nothing", await S.createTask(d, { name: "   ", dueAt: TODAY_UTC }), null);
    eq("quick-add: ...and did not grow the list", S.tasksDueByDay(d.workspaces[0], TODAY_UTC).length, 1);
    // Completion round-trip: the strip's count must be able to tick off this task.
    await S.completeTask(d, created.id);
    eq("quick-add: completing it clears it from due-today", S.tasksDueByDay(d.workspaces[0], TODAY_UTC).length, 0);
    eq("quick-add: ...and adds it to today's completed count", S.tasksCompletedOnDay(d.workspaces[0], TODAY_KEY), 1);
  }

  // ======================= render composition =============================
  // The five modules and the tense split, asserted on the shipped render source.
  const render = (() => {
    const i = SRC.nt.indexOf("\n  function renderDashboardTab(");
    if (i === -1) throw new Error("renderDashboardTab not found");
    return SRC.nt.slice(i, SRC.nt.indexOf("\n  }\n", i));
  })();
  check("render: the greeting is the tab's header line, above every card", /dash-greeting[\s\S]*insights-strip[\s\S]*dash-cockpit/.test(render));
  check("render: the stat strip is full-width, above the columns", render.indexOf("insights-strip") < render.indexOf("dash-cockpit"));
  check("render: due-today is the PRIMARY column", /dash-col-primary[\s\S]*dashDueListHtml/.test(render));
  check("render: goals and streak are the SECONDARY column", /dash-col-secondary[\s\S]*dashGoalsHtml/.test(render) && /dash-col-secondary[\s\S]*streakCard|streakCard[\s\S]*dash-col-secondary/.test(render));
  check("render: quick-add sits at the due-today module's foot", render.indexOf("dashDueListHtml") < render.indexOf("dashQuickAddHtml"));
  check("render: the suggestion block is the due module's HEAD, not a card of its own",
    render.indexOf("dashHeadHtml") < render.indexOf("Due today") && !/class="dash-card"/.test(SRC.nt));
  check("render: the streak and focused tile suppress on the SAME scope",
    /if \(scope\) dashRefreshStreak/.test(render) && /var streakCard = scope\s*$/m.test(render));
  check("render: the strip's blocked tile reads focusStats, and 0 renders as 0",
    /Storage\.focusBlockedOnDay\(d, todayKey\)/.test(SRC.nt) && !/focusBlockedOnDay[\s\S]{0,120}\|\| *""/.test(SRC.nt));
  check("render: the blocking badge REUSES the pill's tri-state derivation",
    /Storage\.focusArmState\(d\)/.test(SRC.nt.slice(SRC.nt.indexOf("function dashStripHtml"), SRC.nt.indexOf("function dashGoalsHtml"))));
  check("render: completing the ACTIVE task routes through satComplete, not a second funnel",
    /active\.task\.id === taskId[\s\S]{0,200}await satComplete\(\)/.test(SRC.nt));
  // Caps are fine; SILENT caps are not — a list that stops at N and says nothing
  // reads as "that is all of them". Asserted inside each builder's own body so a
  // stray match elsewhere in a 650KB file cannot stand in for it.
  {
    const goalsBody = extractFn(SRC.nt, "dashGoalsHtml");
    check("render: goals are capped and the overflow is counted out loud",
      /DASH_GOALS_MAX/.test(goalsBody) && /overflow/.test(goalsBody) && /goto-tasks/.test(goalsBody), goalsBody.slice(0, 80));
    const dueBody = extractFn(SRC.nt, "dashDueListHtml");
    check("render: the due list is capped and its overflow is counted out loud",
      /DASH_DUE_MAX/.test(dueBody) && /more due or overdue/.test(dueBody) && /goto-tasks/.test(dueBody), dueBody.slice(0, 80));
    check("render: the empty states say what they mean",
      /Nothing due today\./.test(dueBody) && /No active goals/.test(goalsBody));
    // O2 in the markup, not just the cascade: any cockpit line that carries the
    // Tasks button must use .dash-note (colour-alpha de-emphasis), never
    // .insights-empty (container opacity), or the button ships flattened into a
    // 60% layer it cannot climb out of.
    const streakBody = extractFn(SRC.nt, "dashStreakBodyHtml");
    for (const [label, body] of [["goals", goalsBody], ["due", dueBody], ["streak", streakBody]]) {
      check(`render: ${label} note lines use .dash-note, never the opacity-dimmed .insights-empty (O2)`,
        !/insights-empty/.test(body) && /dash-note/.test(body));
    }
  }
  check("render: the streak window is the ENGINE's retention, not a restated 30",
    /Tracking\.lastNLocalDayKeys\(Tracking\.RETENTION_DAYS/.test(SRC.nt));
  check("render: the free-tier Dashboard preview is untouched by the cockpit",
    /function renderDashboardPreview\(\) \{\s*\n?\s*var d = DEMO_DASHBOARD_DATA;/.test(SRC.nt));

  // ======================= O1 ink (JS-rendered, invisible to the static gate) ==
  // tools/check-panel-ink.mjs parses STATIC newtab.html. Every element above is
  // built at runtime, so the gate sees zero of it and passes vacuously. These
  // rows hold the rules the browser measurement confirmed.
  const cssHas = (re) => re.test(SRC.css);
  check("ink: .dash-tab declares the on-card white at the ROOT (the a68dd89 class)",
    /\.dash-tab \{[^}]*color: #fff;/.test(SRC.css));
  check("ink: the greeting sits bare over the wallpaper and takes the D6 ring",
    /^html\.has-bg \.dash-greeting \{[^}]*color: #fff;[^}]*text-shadow: 0 1px 3px/m.test(SRC.css));
  check("ink: ...with a light-wallpaper override using the TWO-CLASS guard (O1)",
    cssHas(/html\.has-bg\.bg-light \.dash-greeting \{/) && !cssHas(/\nhtml\.bg-light \.dash-greeting/));
  check("ink: the inline tab-switch link declares colour on BOTH frames (O3)",
    /\.dash-inline-link \{[^}]*color: #/.test(SRC.css) && cssHas(/html\.has-bg\.bg-light \.dash-inline-link \{/));
  check("ink: the head's separator rule has a light-wallpaper override",
    cssHas(/html\.has-bg\.bg-light \.dash-head \{/));
  // THE DEFAULT FRAME. With no wallpaper, html carries neither class and --bg is
  // #fff, so a bare `color:#fff` on the greeting is white-on-white — measured
  // 1.37:1 live. The base rule must take the page's ink and scope the white to
  // has-bg, not the other way round.
  // Line-anchored on purpose: an unanchored `\.dash-greeting \{` also matches the
  // html.has-bg rule, which would make the negative clause below unfalsifiable —
  // the assertion would have passed against the very defect it was written for.
  check("ink: the bare greeting takes the PAGE's ink by default, white only under has-bg",
    /^\.dash-greeting \{[^}]*color: var\(--text-primary\);/m.test(SRC.css) &&
    /^html\.has-bg \.dash-greeting \{[^}]*color: #fff;/m.test(SRC.css) &&
    !/^\.dash-greeting \{[^}]*color: #fff;/m.test(SRC.css));
  check("ink: .dash-note de-emphasises with colour ALPHA, never container opacity (O2)",
    /\.dash-note \{[^}]*color: rgba\(255, 255, 255, 0\.\d+\);/.test(SRC.css) &&
    !/\.dash-note \{[^}]*opacity:/.test(SRC.css) &&
    cssHas(/html\.has-bg\.bg-light \.dash-note \{/));
  check("ink: no cockpit rule dims a container that holds a control (O2)",
    !/\.dash-(due-row|cockpit|col|head|quickadd|streak|note|inline-link) \{[^}]*opacity:/.test(SRC.css));
  {
    // Every frosted surface added this round must speak through the tier
    // variables, never a literal — the CLAUDE.md constant.
    const block = SRC.css.slice(SRC.css.indexOf("[1.0.20 → 2.0] Live Dashboard tab"), SRC.css.indexOf("/* ----- Dashboard preview ----- */"));
    check("ink: the cockpit block uses the frost TIER VARIABLES, no literal rgba(30,30,30) or blur()",
      block.length > 2000 && !/rgba\(30, ?30, ?30/.test(block) && !/backdrop-filter: blur\(/.test(block), `block ${block.length} chars`);
    check("ink: Section R — the board root still carries its 48px tail clearance",
      /\.dash-tab \{[^}]*padding-bottom: 48px;/.test(block));
  }
})();

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
if (!MUTATE) {
  console.log("\nTODAY COCKPIT — the Dashboard's five modules\n");
  for (const r of rows) {
    if (r.skip) { console.log(`  SKIP  ${r.name}   << ${r.detail}`); pass++; continue; }
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
    r.pass ? pass++ : fail++;
  }
} else {
  for (const r of rows) { if (r.skip || r.pass) pass++; else fail++; }
}

// P2 anti-vacuity floor: a suite that silently stops asserting is a green light
// that checked nothing. Set below the current count with room to edit, far above
// the "parser slipped and inspected zero nodes" failure this exists to catch.
const MIN = 130;
if (!MUTATE && rows.length < MIN) {
  console.log(`\nTODAY COCKPIT: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}

if (!MUTATE) {
  console.log(`\nTODAY COCKPIT: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed${SKIPPED ? ` (${SKIPPED} skipped)` : ""}, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --mutate: prove the suite has teeth (P3), without fooling ourselves (Q1-Q4).
// ---------------------------------------------------------------------------
//
// Every seed is FAITHFUL (Q3): it alters the behaviour under test and leaves the
// code running, rather than deleting the thing so the module breaks. Anchors are
// occurrence-counted (Q2) so a seed that lands nowhere is reported as a MISS and
// never as a result. And the run opens with a CONTROL (Q1): a deliberately
// unloadable subject that must be reported broken and NOT scored.
console.log("\nTODAY COCKPIT — mutation seeding\n");

const SEEDS = [
  { name: "streak: today-zero grace removed (walk starts at today regardless)",
    file: "storage", from: "    } else {\n      i--;   // today is still open — count the streak through yesterday\n    }", to: "    } else {\n      /* seeded: no grace */\n    }" },
  { name: "streak: cap reported for any streak, not just an exhausted window",
    file: "storage", from: "out.capped = (i < 0 && out.days > 0);", to: "out.capped = (out.days > 0);" },
  { name: "streak: a zero day EXTENDS the streak instead of ending it",
    file: "storage", from: "      if ((range[keys[i]] || 0) <= 0) break;", to: "      if ((range[keys[i]] || 0) < 0) break;" },
  { name: "completed-today: day-keyed in UTC instead of the user's local day",
    file: "storage", from: "      if (achDayKey(t.completedAt) === dayKey) n++;", to: "      if (new Date(t.completedAt).toISOString().slice(0, 10) === dayKey) n++;" },
  { name: "completed-today: trashed tasks counted",
    file: "storage", from: "      if (!t || t.deletedAt || !t.completed) return;", to: "      if (!t || !t.completed) return;" },
  { name: "goals: empty goal divides by zero (NaN%)",
    file: "storage", from: "        pct: children.length ? Math.round((done / children.length) * 100) : 0,", to: "        pct: Math.round((done / children.length) * 100)," },
  { name: "goals: recency ordering dropped (falls back to insertion order)",
    file: "storage", from: "      if (a.lastActiveAt !== b.lastActiveAt) return b.lastActiveAt - a.lastActiveAt;", to: "      if (false) return b.lastActiveAt - a.lastActiveAt;" },
  // NOTE, from this run: the obvious seed here — dropping the `typeof` half of
  // the guard — is an EQUIVALENT MUTANT, not a coverage gap. ensureFocusStats has
  // already normalized every malformed bucket by the time the guard is reached,
  // so the guard is unreachable defence-in-depth and no input can tell the two
  // versions apart. The behaviour the assertions actually protect is the ZERO
  // for an absent day, so that is what gets seeded. (Q3: a seed must change
  // behaviour, or it is scoring the suite against nothing.)
  { name: "blocked: an absent day leaks undefined instead of 0",
    file: "storage", from: "? bucket.blocked : 0;", to: "? bucket.blocked : undefined;" },
  { name: "blocked: snoozes counted as blocks",
    file: "storage", from: "? bucket.blocked : 0;", to: "? (bucket.blocked + bucket.snoozed) : 0;" },
  { name: "due: overdue tasks excluded (only exact-today matches)",
    file: "storage", from: "      .filter(function (t) { return typeof t.dueAt === \"number\" && utcDay(t.dueAt) <= todayUtcDay; })", to: "      .filter(function (t) { return typeof t.dueAt === \"number\" && utcDay(t.dueAt) === todayUtcDay; })" },
  { name: "day key: storage and tracking disagree about which day it is",
    file: "storage", from: "  function localDayKey(ts) {\n    return achDayKey(ts);\n  }", to: "  function localDayKey(ts) {\n    return new Date(ts == null ? Date.now() : ts).toISOString().slice(0, 10);\n  }" },
  { name: "quick-add: dueAt encoded from the UTC date instead of the local one",
    file: "nt", from: "    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());", to: "    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());" },
  // The anchor carries the tail of .dash-tab's OWN comment: the shorter
  // "color: #fff;\n  /* [1.2.1 fix] Tail clearance" form matches twice, because
  // .insights-tab ends identically — reported as an anchor-miss on the first run
  // of this seed set, which is exactly the Q2 failure mode it exists to surface.
  { name: "ink: the .dash-tab root white removed (a68dd89 reintroduced)",
    file: "css", from: "against this rule's 0,1,0). */\n  color: #fff;", to: "against this rule's 0,1,0). */" },
  // The two defects the LIVE pass found, seeded so they cannot come back quietly.
  { name: "ink: the greeting goes back to bare white (white-on-white by default)",
    file: "css", from: ".dash-greeting {\n  font-size: 22px;\n  font-weight: 600;\n  line-height: 1.2;\n  color: var(--text-primary);",
    to: ".dash-greeting {\n  font-size: 22px;\n  font-weight: 600;\n  line-height: 1.2;\n  color: #fff;" },
  { name: "ink: note lines go back to the opacity-dimmed class (the O2 button trap)",
    file: "nt", from: "'<div class=\"dash-note\">No active goals — '", to: "'<div class=\"insights-empty\">No active goals — '" },
  // The 2026-08-11 follow-up, seeded from both sides of the condition it added.
  { name: "header: the board gate removed — evening claims 'Work’s done.' over open rows again",
    file: "nt", from: "      if (open > 0) {", to: "      if (false) {" },
  { name: "header: the gate inverted — the close-out line can never render",
    file: "nt", from: "      var open = (dueOpen || []).length;\n      if (open > 0) {", to: "      var open = (dueOpen || []).length;\n      if (open >= 0) {" },
  { name: "header: the gate counts ALL tasks, not the open due set (done work keeps the day open)",
    file: "nt", from: "      var open = (dueOpen || []).length;", to: "      var open = ((ws && ws.tasks) || []).length;" },
  { name: "header: the plural boundary slips by one (a single item reads as 'a few')",
    file: "nt", from: "(open === 1 ? 'One still on the board.'", to: "(open === 2 ? 'One still on the board.'" },
  // The declaration line matches the same call text, so the anchor carries the
  // render's indentation and trailing `+` — reported as an anchor-miss on the
  // first run of this seed, which is the Q2 failure mode working.
  { name: "header: the head is fed an empty array instead of the render's read",
    file: "nt", from: "\n              dashHeadHtml(d, ws, period, dueOpen) +", to: "\n              dashHeadHtml(d, ws, period, []) +" },
  { name: "header: evening precedence yields to an active task",
    file: "nt", from: "    if (period === \"evening\") {", to: "    if (period === \"evening\" && !Storage.resolveActiveTask(d)) {" },
];

const FILEKEY = { storage: "storage", nt: "nt", css: "css" };

function runChild(src) {
  // Re-run THIS file's assertions against a mutated source set, in-process, by
  // re-importing under a temp root. Simpler and faster: write the mutated tree to
  // a scratch dir and shell out, so the mutant runs the identical code path.
  return src;
}

import { spawnSync } from "node:child_process";
import os from "node:os";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lp-cockpit-mut-"));
function materialize(src) {
  const dir = fs.mkdtempSync(path.join(scratch, "seed-"));
  fs.writeFileSync(path.join(dir, "storage.js"), src.storage);
  fs.writeFileSync(path.join(dir, "tracking.js"), src.tracking);
  fs.writeFileSync(path.join(dir, "newtab.js"), src.nt);
  fs.writeFileSync(path.join(dir, "newtab.css"), src.css);
  return dir;
}
const runAgainst = (dir) => spawnSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), dir], { encoding: "utf8" });

// CONTROL (Q1). An unloadable subject must be reported as BROKEN (exit 2) and
// must NOT be scored as a caught mutant — otherwise every syntax error reads as
// coverage and the run reports a perfect, meaningless score.
{
  const broken = Object.assign({}, SRC, { storage: SRC.storage + "\nthis is not javascript(" });
  const r = runAgainst(materialize(broken));
  console.log(`  ${r.status === 2 ? "OK  " : "BAD "} control: an unloadable subject exits 2 (got ${r.status}), and is not scored`);
  if (r.status !== 2) { console.log("\n  the runner cannot distinguish broken from caught — no seed below is meaningful.\n"); process.exit(1); }
}
// And the clean run must PASS before any mutant is scored.
{
  const r = runAgainst(materialize(SRC));
  console.log(`  ${r.status === 0 ? "OK  " : "BAD "} control: the CLEAN subject passes (exit ${r.status})`);
  if (r.status !== 0) { console.log(r.stdout); process.exit(1); }
}

let caught = 0, escaped = 0, missed = 0;
for (const seed of SEEDS) {
  const key = FILEKEY[seed.file];
  const hay = SRC[key];
  const n = hay.split(seed.from).length - 1;
  if (n !== 1) {
    missed++;
    console.log(`  MISS  ${seed.name}   << anchor matched ${n} times in ${seed.file} (want exactly 1)`);
    continue;
  }
  const mutated = Object.assign({}, SRC, { [key]: hay.replace(seed.from, seed.to) });
  const r = runAgainst(materialize(mutated));
  if (r.status === 2) { missed++; console.log(`  MISS  ${seed.name}   << subject did not load (unfaithful seed)`); continue; }
  if (r.status === 1) { caught++; console.log(`  CAUGHT   ${seed.name}`); }
  else { escaped++; console.log(`  ESCAPED  ${seed.name}   << the suite did not notice`); }
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\nMUTATION: ${caught} caught, ${escaped} escaped, ${missed} anchor-miss (of ${SEEDS.length})\n`);
process.exit(escaped || missed ? 1 : 0);
