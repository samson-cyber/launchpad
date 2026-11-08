#!/usr/bin/env node
// ===========================================================================
// [MC4] THE DASHBOARD CALENDAR'S MONTH - Storage.calendarMonth.
//
// WHY THIS EXISTS. The calendar draws two kinds of day - DUE (a real task's
// dueAt) and SCHEDULED (the days a recurring template will next fire) - and
// the one way it can lie without looking wrong is to count a recurring day
// twice: once as the task the sweep already spawned and once as a projection.
// The other quiet failures are a grid that starts on the wrong column, a task
// that lands a day off because its stamp was read in the wrong space, and a
// finished or trashed task still on the calendar. None of those throws.
//
// WHAT IT HOLDS, against the real storage.js in a VM:
//   - the grid: lead blanks for Sunday- and Monday-first weeks, whole weeks,
//     every day of the month once, today marked, the past marked
//   - DUE: on its own day, overdue only before today, completed / trashed /
//     undated tasks absent, other months absent, priority then name order
//   - SCHEDULED: weekly, daily and monthly (31st clamps to the 30th) projected
//     with nextRecurrenceUTC; nothing before today or before nextScheduledAt;
//     a day holding the template's spawned instance is not counted again;
//     paused and trashed templates project nothing; past months project nothing
//   - totals match the cells
//   [MC5] and the calendar's edits:
//   - Storage.editTask saves name/description/priority/tags in ONE write,
//     refuses the whole edit on any bad field, leaves dueAt alone
//   - a live due chip drags and is a control; a scheduled chip is a control
//     but does not drag; the PREVIEW cell has no control, role, tabindex or
//     drag at all; the date is the day's select button
//   - the drop and the edit overlay both set dueAt through commitTaskDueAt
//     (the goal-deadline check), never by writing it directly
//   - the count-up is 560ms, and opening the tab clears the carried figures
//
// Exit codes: 0 pass · 1 failures · 2 the subject did not load, or too few
// rows. `--mutate` re-runs against seeded reversions, each of which must turn
// it red. `--boot-check` is what check-mutation-boot runs.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUBJECT = "storage.js";
function readSubject() { return fs.readFileSync(path.join(repoRoot, SUBJECT), "utf8").replace(/\r\n/g, "\n"); }
function readNewtab() { return fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8").replace(/\r\n/g, "\n"); }
function extractFn(src, name) {
  const at = src.indexOf("  function " + name + "(");
  if (at < 0) throw new Error("function " + name + " not found in newtab.js");
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
function bootUi(nt) {
  const m = /var DASH_CAL_MAX_CHIPS = (\d+);/.exec(nt);
  if (!m) throw new Error("DASH_CAL_MAX_CHIPS not found");
  const code = ["var DASH_CAL_MAX_CHIPS = " + m[1] + ";", extractFn(nt, "dashCalDayLabel"), extractFn(nt, "dashCalChipHtml"),
    extractFn(nt, "dashCalCellHtml"), "this.ui = { dashCalChipHtml, dashCalCellHtml };"].join("\n");
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const sb = { escapeHtml: esc, th: (k, p) => esc(k + (p ? JSON.stringify(p) : "")), Date, String, Number };
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: "newtab.js" });
  return sb.ui;
}
function fnBody(nt, name) { try { return extractFn(nt, name); } catch (e) { return ""; } }

function boot(src) {
  const sets = [];
  const chrome = {
    runtime: { getManifest: () => ({ version: "2.2.0" }), lastError: null, id: "t" },
    storage: { local: { get: async () => ({}), set: async (o) => { sets.push(o); }, remove: async () => {}, getBytesInUse: async () => 0 } }
  };
  const sandbox = {
    chrome, crypto, Date, JSON, Math, Object, Array, Set, Map, String,
    Number, Boolean, isFinite, setTimeout, structuredClone, Promise, Error, RegExp,
    parseInt, parseFloat, Intl, Proxy, Reflect,
    I18n: { t: (k) => k, th: (k) => k },
    ProAccess: { getProAccessLevel: () => "active", isProAccessibleLevel: () => true },
    console: { log() {}, warn() {}, error() {} }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: SUBJECT });
  const S = sandbox.Storage;
  if (!S || typeof S.calendarMonth !== "function") throw new Error("Storage.calendarMonth missing after load");
  return { S, sets };
}

// Every day is a UTC-midnight stamp of a LOCAL date, as dueAt is.
const day = (y, m, d) => Date.UTC(y, m, d);
// "Now" is local noon on Sunday 8 November 2026 - a month whose 1st is a Sunday.
const NOW = new Date(2026, 10, 8, 12, 0, 0).getTime();
const task = (id, dueAt, extra) => ({ id, name: id, dueAt, completed: false, deletedAt: null, priority: null, ...(extra || {}) });
const tpl = (id, extra) => ({ id, name: id, isActive: true, deletedAt: null, nextScheduledAt: null, ...(extra || {}) });
const cellOf = (model, d) => model.cells.find((c) => c && c.day === d);

async function suite(src, nt) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  const eq = (name, got, want) => chk(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  const { S, sets } = boot(src);

  // ---- the grid ----
  {
    const m = S.calendarMonth({ tasks: [], recurringTemplates: [] }, 2026, 10, 0, NOW);
    eq("Nov 2026, Sunday-first: no lead blanks (the 1st is a Sunday)", m.lead, 0);
    eq("the grid is whole weeks", m.cells.length % 7, 0);
    eq("every day of the month appears once, in order", m.cells.filter(Boolean).map((c) => c.day), Array.from({ length: 30 }, (_, i) => i + 1));
    eq("each day's stamp is the UTC midnight of its local date", cellOf(m, 17).stamp, day(2026, 10, 17));
    eq("today is the 8th and only the 8th", m.cells.filter((c) => c && c.isToday).map((c) => c.day), [8]);
    eq("the 1st-7th are past, the 8th is not", [cellOf(m, 7).isPast, cellOf(m, 8).isPast], [true, false]);
    eq("the model's today is the local-day stamp", m.today, day(2026, 10, 8));
    const mon = S.calendarMonth({ tasks: [] }, 2026, 10, 1, NOW);
    eq("Monday-first: six lead blanks before a Sunday 1st", mon.lead, 6);
    eq("Monday-first: the leading cells are blanks", mon.cells.slice(0, 6).every((c) => c === null), true);
    const feb = S.calendarMonth({ tasks: [] }, 2026, 1, 0, NOW);
    eq("Feb 2026 (Sunday 1st) is exactly four weeks", feb.cells.length, 28);
    eq("a month with no workspace data still draws", S.calendarMonth(null, 2026, 10, 0, NOW).cells.filter(Boolean).length, 30);
  }

  // ---- DUE ----
  {
    const ws = { tasks: [
      task("past-open", day(2026, 10, 3)),
      task("today-open", day(2026, 10, 8)),
      task("future-open", day(2026, 10, 20)),
      task("done", day(2026, 10, 20), { completed: true }),
      task("trashed", day(2026, 10, 20), { deletedAt: 5 }),
      task("undated", null),
      task("next-month", day(2026, 11, 2)),
      task("b-low", day(2026, 10, 12), { priority: "low" }),
      task("a-none", day(2026, 10, 12)),
      task("z-urgent", day(2026, 10, 12), { priority: "urgent" }),
      task("m-high", day(2026, 10, 12), { priority: "high" })
    ] };
    const m = S.calendarMonth(ws, 2026, 10, 0, NOW);
    eq("a task lands on its own day", cellOf(m, 20).due.map((x) => x.id), ["future-open"]);
    eq("a past open task is overdue", cellOf(m, 3).due[0].overdue, true);
    eq("a task due today is not overdue", cellOf(m, 8).due[0].overdue, false);
    eq("a future task is not overdue", cellOf(m, 20).due[0].overdue, false);
    chk("completed, trashed and undated tasks are absent", !m.cells.some((c) => c && c.due.some((x) => ["done", "trashed", "undated"].includes(x.id))));
    chk("next month's task is not in this month", !m.cells.some((c) => c && c.due.some((x) => x.id === "next-month")));
    eq("a day sorts by priority, then name", cellOf(m, 12).due.map((x) => x.id), ["z-urgent", "m-high", "b-low", "a-none"]);
    eq("totals count due and overdue", m.totals, { due: 7, overdue: 1, scheduled: 0 });
    const dec = S.calendarMonth(ws, 2026, 11, 0, NOW);
    eq("next month shows its own task", cellOf(dec, 2).due.map((x) => x.id), ["next-month"]);
    const ov = S.calendarMonth({ tasks: [task("b", day(2026, 10, 8)), task("a", day(2026, 10, 2))] }, 2026, 10, 0, NOW);
    eq("an overdue item sorts first within its day", [cellOf(ov, 2).due[0].overdue, cellOf(ov, 8).due[0].overdue], [true, false]);
  }

  // ---- SCHEDULED ----
  {
    // Weekly on Wednesdays (3). Nov 2026 Wednesdays: 4, 11, 18, 25.
    const weekly = tpl("weekly", { frequency: "weekly", daysOfWeek: [3] });
    const m = S.calendarMonth({ tasks: [], recurringTemplates: [weekly] }, 2026, 10, 0, NOW);
    eq("weekly projects on its weekday from today on (not the past 4th)",
      m.cells.filter((c) => c && c.scheduled.length).map((c) => c.day), [11, 18, 25]);
    eq("a scheduled item carries its template and name", cellOf(m, 11).scheduled[0], { templateId: "weekly", name: "weekly" });
    eq("scheduled total", m.totals.scheduled, 3);

    const spawned = S.calendarMonth({
      tasks: [task("weekly-inst", day(2026, 10, 11), { recurringTemplateId: "weekly", isRecurringInstance: true })],
      recurringTemplates: [weekly]
    }, 2026, 10, 0, NOW);
    eq("a day already holding the template's spawned task is not counted again", cellOf(spawned, 11).scheduled.length, 0);
    eq("...it shows once, as due", cellOf(spawned, 11).due.map((x) => x.id), ["weekly-inst"]);

    const ahead = S.calendarMonth({ recurringTemplates: [tpl("w2", { frequency: "weekly", daysOfWeek: [3], nextScheduledAt: day(2026, 10, 18) })] }, 2026, 10, 0, NOW);
    eq("projection starts at nextScheduledAt when that is after today", ahead.cells.filter((c) => c && c.scheduled.length).map((c) => c.day), [18, 25]);

    const daily = S.calendarMonth({ recurringTemplates: [tpl("d", { frequency: "daily" })] }, 2026, 10, 0, NOW);
    eq("daily projects every day from today to the month's end", daily.totals.scheduled, 23);

    const monthly = S.calendarMonth({ recurringTemplates: [tpl("m31", { frequency: "monthly", dayOfMonth: 31 })] }, 2026, 10, 0, NOW);
    eq("a monthly 31st clamps to November's 30th", monthly.cells.filter((c) => c && c.scheduled.length).map((c) => c.day), [30]);

    const off = S.calendarMonth({ recurringTemplates: [
      tpl("paused", { frequency: "daily", isActive: false }),
      tpl("gone", { frequency: "daily", deletedAt: 9 })
    ] }, 2026, 10, 0, NOW);
    eq("paused and trashed templates project nothing", off.totals.scheduled, 0);

    const past = S.calendarMonth({ recurringTemplates: [tpl("d", { frequency: "daily" })] }, 2026, 9, 0, NOW);
    eq("a past month projects nothing (it already happened)", past.totals.scheduled, 0);

    const jan = S.calendarMonth({ recurringTemplates: [weekly] }, 2027, 0, 0, NOW);
    eq("a future month projects from its 1st (Jan 2027 Wednesdays)", jan.cells.filter((c) => c && c.scheduled.length).map((c) => c.day), [6, 13, 20, 27]);

    const bad = S.calendarMonth({ recurringTemplates: [tpl("bad", { frequency: "weekly", daysOfWeek: [] })] }, 2026, 10, 0, NOW);
    eq("a malformed template projects nothing and does not throw", bad.totals.scheduled, 0);
  }

  // ---- [MC5] Storage.editTask ----
  {
    const fx = () => ({ activeWorkspaceId: "main", workspaceOrder: ["main"], workspaces: [{ id: "main", name: "Main", tags: [], goals: [], recurringTemplates: [],
      tasks: [task("t1", day(2026, 10, 12), { name: "Old", description: "d", priority: "low", tagIds: ["a"] }), task("gone", null, { deletedAt: 3 })] }] });
    chk("editTask is exported", typeof S.editTask === "function");
    if (typeof S.editTask === "function") {
      let d = fx(); sets.length = 0;
      const r = await S.editTask(d, "t1", { name: "  New name ", description: "nd", priority: "high", tagIds: ["b", "c", "b"] });
      const t1 = d.workspaces[0].tasks[0];
      eq("name, description, priority and tags land", [t1.name, t1.description, t1.priority, t1.tagIds], ["New name", "nd", "high", ["b", "c"]]);
      eq("...in ONE write", sets.length, 1);
      eq("...and dueAt is untouched (it goes through the goal-deadline path)", t1.dueAt, day(2026, 10, 12));
      chk("it returns the task", r && r.id === "t1");
      d = fx(); sets.length = 0;
      eq("an empty name refuses the whole edit", await S.editTask(d, "t1", { name: "  ", priority: "high" }), null);
      eq("...and changes nothing, writes nothing", [d.workspaces[0].tasks[0].name, d.workspaces[0].tasks[0].priority, sets.length], ["Old", "low", 0]);
      d = fx();
      eq("a bad priority refuses the whole edit", await S.editTask(d, "t1", { name: "X", priority: "huge" }), null);
      eq("...the name stays", d.workspaces[0].tasks[0].name, "Old");
      d = fx();
      eq("bad tagIds refuse", await S.editTask(d, "t1", { tagIds: [1] }), null);
      d = fx(); await S.editTask(d, "t1", { priority: null });
      eq("fields left out are untouched; null priority clears", [d.workspaces[0].tasks[0].name, d.workspaces[0].tasks[0].priority, d.workspaces[0].tasks[0].tagIds], ["Old", null, ["a"]]);
      d = fx();
      eq("a trashed task cannot be edited", await S.editTask(d, "gone", { name: "X" }), null);
    }
  }

  // ---- [MC5] the cell's affordances (the real builders, from newtab.js) ----
  if (nt) {
    const ui = bootUi(nt);
    const cell = { stamp: day(2026, 10, 12), day: 12, isToday: false, isPast: false,
      due: [{ id: "t1", name: "Write <it>", overdue: false }], scheduled: [{ templateId: "tp1", name: "Weekly" }] };
    const live = ui.dashCalCellHtml(cell, null, false);
    const pv = ui.dashCalCellHtml(cell, null, true);
    chk("live: the due chip drags and opens the task", /<span class="dash-cal-chip is-due" role="button" tabindex="0" draggable="true" data-cal-task="t1"/.test(live), live);
    chk("live: the scheduled chip opens its repeat and does NOT drag", /data-cal-tpl="tp1"/.test(live) && !/draggable="true" data-cal-tpl/.test(live) && (live.match(/draggable/g) || []).length === 1, live);
    chk("live: the date is the day's select button", /<button type="button" class="dash-cal-date" data-cal-pick/.test(live), live);
    chk("live: the cell is a box (a button cannot hold the chips)", /^<div class="dash-cal-cell[^"]*" data-cal-day="/.test(live), live.slice(0, 80));
    chk("live: a task name is escaped", /Write &lt;it&gt;/.test(live) && !/<it>/.test(live));
    chk("preview: no control, role, tabindex or drag anywhere in the cell", !/<button|role=|tabindex|draggable|data-cal-/.test(pv), pv);
    chk("preview: the chips still show", (pv.match(/dash-cal-chip/g) || []).length === 2, pv);

    // ---- [MC5] the wiring ----
    const bind = fnBody(nt, "bindDashCalendar"), editM = fnBody(nt, "openEditTaskModal");
    chk("the drop sets dueAt through commitTaskDueAt", /drop[\s\S]*commitTaskDueAt\(id, stamp\)/.test(bind));
    chk("the calendar never writes dueAt directly", !/updateTaskDueAt/.test(bind) && !/updateTaskDueAt/.test(editM));
    chk("a drop onto the task's own day writes nothing", /habitLocalDayStamp\(taskObj\.dueAt\) === stamp\) return;/.test(bind));
    chk("the edit overlay saves through Storage.editTask", /Storage\.editTask\(data, taskId,/.test(editM));
    chk("...and sends a changed due date through commitTaskDueAt after it closes", /setTimeout\(function \(\) \{ commitTaskDueAt\(taskId, dueAt\); \}, 0\)/.test(editM));
    chk("...keeping tags it cannot show", /var kept = has\.filter/.test(editM) && /kept\.concat\(checked\)/.test(editM));
    chk("the count-up runs 560ms", /var LP_COUNT_MS = 560;/.test(nt));
    chk("opening the Dashboard clears the carried figures (the ring sweeps, the numbers count)",
      /dashPanel\.removeAttribute\("data-dash-carry"\); filling = renderDashboardTab\(dashPanel, data\);/.test(nt));
    chk("a re-render restores the carried figures before binding", /dashCarryRestore\(panel, dashCarry\);\n\n    bindDashboardEvents\(panel\);/.test(nt));
    chk("a committed dialog refreshes a visible Dashboard", (fnBody(nt, "openTasksModal").match(/dashRefreshIfShown\(\)/g) || []).length === 2);

    // ---- [MC8] the calendar lives on the Tasks tab, above Active goals ----
    const tasksR = fnBody(nt, "renderTasksTab");
    chk("Tasks renders the calendar section", /var calendarSectionHtml = showActiveSections\s*\? '<section class="tt-section tt-cal-section" data-section="calendar">' \+\s*dashCalendarTileHtml\(workspace, null\)/.test(tasksR));
    chk("...ABOVE Active goals (count tiles, calendar, goals)", /tasksCountTilesHtml\(tasksCounts\) \+\s*calendarSectionHtml \+\s*activeGoalsSectionHtml \+/.test(tasksR));
    chk("its handlers bind on the Tasks panel", /panel\.dataset\.tasksTabBound = "1";[\s\S]{0,200}bindDashCalendar\(panel\);/.test(fnBody(nt, "bindTasksTabEvents")));
    chk("...and nowhere else", (nt.match(/bindDashCalendar\(panel\);/g) || []).length === 1);
    chk("the Dashboard no longer draws it", !/dashCalendarTileHtml/.test(fnBody(nt, "renderDashboardTab")));
    chk("the free Tasks preview shows it above its Active goals header",
      /'<div class="pp-cal-wrap">' \+ dashCalendarTileHtml\(dashCalDemoWorkspace\(\), \{ preview: true \}\) \+ '<\/div>' \+\s*'<div class="pp-section-header">' \+ th\("tasks_active_goals"\)/.test(nt));
    chk("...and the Dashboard preview does not", !/dash-free-demo-grid[^;]*dashCalendarTileHtml/.test(nt) && (nt.match(/dashCalendarTileHtml\(dashCalDemoWorkspace\(\)/g) || []).length === 1);
    chk("an add from the calendar repaints Tasks, and the Dashboard if shown", /async function dashCalCommitAdd\([\s\S]*?rerenderTasksPanel\(\);\s*dashRefreshIfShown\(\);\s*\}/.test(nt));
  }
  return rows;
}

const SEEDS = [
  ["projection ignores the spawned instance (double count)",
   "if (c && !c.due.some(function (x) { return x.templateId === tpl.id; })) {",
   "if (c) {"],
  ["projection starts at the month's 1st, not today",
   "var from = Math.max(first, todayStamp);",
   "var from = first;"],
  ["projection ignores nextScheduledAt",
   "if (typeof tpl.nextScheduledAt === \"number\") from = Math.max(from, recurUtcMidnight(tpl.nextScheduledAt));",
   ""],
  ["completed tasks stay on the calendar",
   "if (!t || t.deletedAt || t.completed || typeof t.dueAt !== \"number\") return;",
   "if (!t || t.deletedAt || typeof t.dueAt !== \"number\") return;"],
  ["overdue includes today",
   "var overdue = c.stamp < todayStamp;",
   "var overdue = c.stamp <= todayStamp;"],
  ["the week always starts on Sunday",
   "var ws0 = (weekStart === 1) ? 1 : 0;\n    var lead = (new Date(year, month, 1).getDay() - ws0 + 7) % 7;\n    var daysInMonth = new Date(year, month + 1, 0).getDate();\n    var first",
   "var ws0 = 0;\n    var lead = (new Date(year, month, 1).getDay() - ws0 + 7) % 7;\n    var daysInMonth = new Date(year, month + 1, 0).getDate();\n    var first"],
  ["paused templates still project",
   "if (!tpl || tpl.deletedAt || tpl.isActive === false) return;",
   "if (!tpl || tpl.deletedAt) return;"],
  ["editTask half-saves before validating",
   "    Object.keys(next).forEach(function (k) { task[k] = next[k]; });\n    await saveAll(data);\n    return task;\n  }",
   "    Object.keys(next).forEach(function (k) { task[k] = next[k]; });\n    await saveAll(data);\n    await saveAll(data);\n    return task;\n  }"],
  ["editTask keeps duplicate tag ids",
   "next.tagIds = fields.tagIds.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; });",
   "next.tagIds = fields.tagIds.slice();"],
  ["the drop writes dueAt directly", "      commitTaskDueAt(id, stamp);\n", "      Storage.updateTaskDueAt(data, id, stamp);\n", "nt"],
  ["scheduled chips drag too",
   "return '<span class=\"dash-cal-chip is-scheduled\" role=\"button\" tabindex=\"0\" data-cal-tpl=",
   "return '<span class=\"dash-cal-chip is-scheduled\" role=\"button\" tabindex=\"0\" draggable=\"true\" data-cal-tpl=", "nt"],
  ["the preview chip becomes a control",
   "if (preview) return '<span class=\"dash-cal-chip is-' + kind + '\">' + name + '</span>';",
   "if (preview) return '<span class=\"dash-cal-chip is-' + kind + '\" role=\"button\">' + name + '</span>';", "nt"],
  ["the edit overlay drops trashed tags", "tagIds: kept.concat(checked)", "tagIds: checked", "nt"],
  ["the count goes back to 400ms", "var LP_COUNT_MS = 560;", "var LP_COUNT_MS = 400;", "nt"],
  ["the calendar goes back under Active goals",
   "            calendarSectionHtml +\n            activeGoalsSectionHtml +",
   "            activeGoalsSectionHtml +\n            calendarSectionHtml +", "nt"],
  ["opening the tab carries figures (no sweep)",
   "if (dashPanel) { dashPanel.removeAttribute(\"data-dash-carry\"); filling",
   "if (dashPanel) { filling", "nt"],
];

const clean = readSubject();
const cleanNt = readNewtab();
if (args.includes("--boot-check")) {
  try { boot(clean); bootUi(cleanNt); console.log("BOOT-CHECK OK   check-calendar.mjs"); process.exit(0); }
  catch (e) { console.log("BOOT-CHECK DEAD check-calendar.mjs — " + e.message); process.exit(1); }
}

console.log("\nCALENDAR — due on its day, scheduled projected once, the grid on the right columns\n");
let rows;
try { rows = await suite(clean, cleanNt); }
catch (e) { console.error("SUBJECT DID NOT LOAD — " + e.message); process.exit(2); }

const ROW_FLOOR = 70;
if (rows.length < ROW_FLOOR) { console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`); process.exit(2); }

let failed = 0;
for (const r of rows) if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
console.log(`CALENDAR: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);
if (!MUTATE) process.exit(failed === 0 ? 0 : 1);
if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }

console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl, file] of SEEDS) {
  const base = file === "nt" ? cleanNt : clean;
  const n = base.split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  let mrows;
  const mut = base.split(find).join(repl);
  try { mrows = await suite(file === "nt" ? clean : mut, file === "nt" ? mut : cleanNt); }
  catch (e) { broken++; console.log(`  BROKEN SEED  ${name} (subject did not load: ${e.message})`); continue; }
  const red = mrows.filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else console.log(`  killed   ${name}\n           by: ${red[0].name.slice(0, 92)}`);
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
