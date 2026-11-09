#!/usr/bin/env node
// ===========================================================================
// [MC9] CALENDAR REMINDERS - when they go off, how often, and from where.
//
// WHY THIS EXISTS. A reminder is a promise about a moment. The ways it breaks
// are all quiet: it goes off twice (two wakes racing), goes off a day late
// (the ruled same-day-only rule ignored), never goes off (the alarm not
// re-pointed after an edit), speaks when it was told not to, or creates one
// in the past that fires the instant it is saved. None of those throws.
//
// WHAT IT HOLDS:
//   storage.js, real code in a VM:
//     - create refuses a missing or past time; trims the title; voice defaults
//       on, notify off
//     - update re-arms a fired reminder when its time moves; refuses the past
//     - delete returns the record and restore puts it back exactly once
//     - remindersToFire: unfired, due, TODAY only (ruled), from EVERY
//       workspace, Pro only; markRemindersFired makes it not fire again
//     - nextReminderAt: the earliest unfired future one, or null
//     - reminderSoundFile: the line if any speaks, else the chime
//     - calendarMonth puts each on its local day, sorted, fired/missed marked
//   background.js: the alarm, the page's change message, startup and worker
//     boot all run the same function; it MARKS AND SAVES BEFORE it plays or
//     notifies; notifications only for reminders that asked, behind the
//     permission check; the alarm is re-pointed every time
//   newtab.js: a double-click opens the split pill; its halves open the task
//     box and the reminder box; a past time is refused; the permission is
//     requested before any await; the page tells the worker on every change
//   the file: sounds/reminder.wav is a WAV inside the offscreen 6s belt and is
//     a documented package exception
//
// Exit codes: 0 pass · 1 failures · 2 the subject did not load. `--mutate`
// re-runs against seeded reversions; `--boot-check` is what
// check-mutation-boot runs.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

function boot(src, pro) {
  const chrome = {
    runtime: { getManifest: () => ({ version: "2.2.0" }), lastError: null, id: "t" },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {}, getBytesInUse: async () => 0 } }
  };
  const sandbox = {
    chrome, crypto, Date, JSON, Math, Object, Array, Set, Map, String, Number, Boolean, isFinite, setTimeout,
    structuredClone, Promise, Error, RegExp, parseInt, parseFloat, Intl, Proxy, Reflect,
    I18n: { t: (k) => k, th: (k) => k },
    ProAccess: { getProAccessLevel: () => (pro ? "active" : "free"), isProAccessibleLevel: () => pro, hasProAccess: () => pro },
    console: { log() {}, warn() {}, error() {} }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "storage.js" });
  const S = sandbox.Storage;
  if (!S || typeof S.remindersToFire !== "function") throw new Error("Storage.remindersToFire missing after load");
  return S;
}

const H = 3600000;
// Local 14:00 on 9 Nov 2026.
const NOW = new Date(2026, 10, 9, 14, 0, 0).getTime();
const local = (d, h, m) => new Date(2026, 10, d, h, m || 0, 0).getTime();
const rem = (id, at, extra) => ({ id, title: id, at, voice: true, notify: false, createdAt: NOW - 86400000, firedAt: null, deletedAt: null, ...(extra || {}) });
const fx = (wsRems, otherRems) => ({
  activeWorkspaceId: "w", workspaceOrder: ["w", "x"],
  workspaces: [{ id: "w", name: "W", tasks: [], tags: [], goals: [], recurringTemplates: [], reminders: wsRems || [] },
               { id: "x", name: "X", tasks: [], tags: [], goals: [], recurringTemplates: [], reminders: otherRems || [] }],
  settings: {}, pro: { subscriptionStatus: "active" }
});

async function suite(c) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  const eq = (name, got, want) => chk(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  const S = boot(c.st, true), F = boot(c.st, false);

  // ---- create / update / delete ----
  {
    let d = fx();
    const r = await S.createReminder(d, { title: "  Call Sam  ", at: NOW + H }, undefined, NOW);
    chk("create stores a reminder", r && d.workspaces[0].reminders.length === 1);
    eq("...title trimmed, voice on and notify off by default", r && [r.title, r.voice, r.notify, r.firedAt], ["Call Sam", true, false, null]);
    eq("create refuses a past time", await S.createReminder(fx(), { at: NOW - 60000 }, undefined, NOW), null);
    eq("create refuses no time", await S.createReminder(fx(), { title: "x" }, undefined, NOW), null);
    eq("a title is optional", (await S.createReminder(fx(), { at: NOW + H }, undefined, NOW)).title, "");
    d = fx([rem("a", NOW - H, { firedAt: NOW - H })]);
    const u = await S.updateReminder(d, "a", { at: NOW + 2 * H }, undefined, NOW);
    eq("moving a fired reminder's time re-arms it", u && [u.at, u.firedAt], [NOW + 2 * H, null]);
    eq("update refuses a past time", await S.updateReminder(fx([rem("a", NOW + H)]), "a", { at: NOW - 1 }, undefined, NOW), null);
    d = fx([rem("a", NOW + H), rem("b", NOW + 2 * H)]);
    const gone = await S.deleteReminder(d, "a");
    eq("delete removes it and returns the record", [gone && gone.id, d.workspaces[0].reminders.map((x) => x.id)], ["a", ["b"]]);
    await S.restoreReminder(d, gone); await S.restoreReminder(d, gone);
    eq("restore puts it back, once", d.workspaces[0].reminders.map((x) => x.id).sort(), ["a", "b"]);
  }

  // ---- what fires ----
  {
    const d = fx([rem("due", local(9, 13, 0)), rem("later", local(9, 18, 0)), rem("fired", local(9, 10, 0), { firedAt: local(9, 10, 0) }),
                  rem("yesterday", local(8, 20, 0)), rem("gone", local(9, 12, 0), { deletedAt: 5 })],
                 [rem("other-ws", local(9, 11, 0))]);
    eq("due today and unfired go off - from every workspace, oldest first", S.remindersToFire(d, NOW).map((r) => r.id), ["other-ws", "due"]);
    eq("without Pro nothing goes off", F.remindersToFire(d, NOW).map((r) => r.id), []);
    chk("yesterday's missed reminder does NOT go off (same day only)", !S.remindersToFire(d, NOW).some((r) => r.id === "yesterday"));
    S.markRemindersFired(d, ["due", "other-ws"], NOW);
    eq("once marked fired, they do not go off again", S.remindersToFire(d, NOW).map((r) => r.id), []);
    eq("the next wake is the earliest unfired future reminder", S.nextReminderAt(d, NOW), local(9, 18, 0));
    eq("...none left, no wake", S.nextReminderAt(fx([rem("f", NOW - H, { firedAt: 1 })]), NOW), null);
    eq("...and none without Pro", F.nextReminderAt(d, NOW), null);
    eq("a batch where any speaks plays the line", S.reminderSoundFile([{ voice: false }, { voice: true }]), "sounds/reminder.wav");
    eq("a batch where none speaks plays the chime", S.reminderSoundFile([{ voice: false }]), "sounds/due-chime.wav");
  }

  // ---- on the calendar ----
  {
    const d = fx([rem("b", local(12, 15, 0)), rem("a", local(12, 9, 0)), rem("m", local(5, 9, 0)), rem("f", local(9, 9, 0), { firedAt: 1 })]);
    const m = S.calendarMonth(d.workspaces[0], 2026, 10, 0, NOW);
    const cell = (n) => m.cells.find((x) => x && x.day === n);
    eq("reminders land on their local day, by time", cell(12).reminders.map((r) => r.id), ["a", "b"]);
    eq("an earlier day's unfired reminder is marked missed", [cell(5).reminders[0].missed, cell(5).reminders[0].fired], [true, false]);
    eq("a fired one is marked fired, not missed", [cell(9).reminders[0].fired, cell(9).reminders[0].missed], [true, false]);
    eq("totals count them", m.totals.reminders, 4);
  }

  // ---- the worker ----
  const run = (() => { const a = c.bg.indexOf("async function runRemindersBg()"); return a < 0 ? "" : c.bg.slice(a, c.bg.indexOf("\n}\n", a) + 3); })();
  chk("the alarm runs it", /if \(alarm\.name === REMINDER_ALARM\) \{ runRemindersBg\(\); return; \}/.test(c.bg));
  chk("the page's change message runs it", /msg\.type === "lp-reminders-changed"\) \{\s*runRemindersBg\(\)/.test(c.bg));
  chk("startup runs it (same-day catch-up)", /onStartup\.addListener\(function \(\) \{[\s\S]{0,400}runRemindersBg\(\);/.test(c.bg));
  chk("worker boot runs it", /\nrunDueRemindersBg\(\);\n[\s\S]{0,200}\nrunRemindersBg\(\);\n/.test(c.bg));
  chk("a cheap raw read gates the write queue", /var raw;[\s\S]{0,200}if \(!Storage\.remindersToFire\(raw, Date\.now\(\)\)\.length\)/.test(run));
  chk("it MARKS AND SAVES before it sounds or notifies",
    run.indexOf("Storage.markRemindersFired(") > 0 && run.indexOf("await Storage.saveAll(d);") > run.indexOf("Storage.markRemindersFired(") &&
    run.indexOf("chrome.notifications.create(") > run.indexOf("await Storage.saveAll(d);") &&
    run.indexOf("playFileViaOffscreen(") > run.indexOf("await Storage.saveAll(d);"));
  chk("...inside the data queue", /enqueueBgData\("calendar-reminders"/.test(run));
  chk("notifications only for reminders that asked, behind the permission", /if \(due\.some\(function \(r\) \{ return r\.notify; \}\) && await hasNotificationsPermission\(\)\)/.test(run) && /if \(!r\.notify\) return;/.test(run));
  chk("the sound follows the voice switches", /playFileViaOffscreen\(Storage\.reminderSoundFile\(due\)\)/.test(run));
  chk("the alarm is re-pointed after every run", (run.match(/await reconcileReminderAlarm\(\);/g) || []).length >= 2);

  // ---- the page ----
  const commit = (() => { const a = c.nt.indexOf("  async function dashCalCommitReminder("); return a < 0 ? "" : c.nt.slice(a, c.nt.indexOf("\n  }\n", a) + 4); })();
  chk("a double-click opens the split pill", /if \(e\.detail >= 2\) \{[\s\S]{0,200}dashCalOpenSplit\(panel, st\);/.test(c.nt));
  chk("its halves open the reminder box and the task box",
    /half\.getAttribute\("data-cal-split"\) === "reminder"\) dashCalOpenReminder\(panel, sst, null\);\s*else dashCalOpenAdd\(panel, sst\);/.test(c.nt));
  chk("the pill shows a tick box for tasks and a bell for reminders",
    /data-cal-split="task">' \+ DASH_CAL_TICK_SVG/.test(c.nt) && /data-cal-split="reminder">' \+ DASH_CAL_BELL_LG_SVG/.test(c.nt));
  chk("the time defaults to 9:00", /: "09:00"\) \+ '">'/.test(c.nt));
  chk("a past time is refused", /if \(!\(at > Date\.now\(\)\)\) \{ dashCalRemError\(pop, "dash_cal_rem_past"\); return; \}/.test(commit));
  chk("the notification permission is asked before any other await",
    commit.indexOf("chrome.permissions.request") > 0 && commit.indexOf("chrome.permissions.request") < commit.indexOf("await Storage."));
  chk("every change tells the worker", /type: "lp-reminders-changed"/.test(c.nt) && /dashCalAfterReminderChange\(panel, Storage\.habitLocalDayStamp\(saved\.at\)\);/.test(commit));
  chk("a reminder chip opens its box", /if \(remChip\) \{ dashCalOpenReminder\(panel, null, remChip\.getAttribute\("data-cal-rem"\)\); return; \}/.test(c.nt));

  // ---- the file ----
  const p = path.join(repoRoot, "sounds/reminder.wav");
  const w = fs.existsSync(p) ? fs.readFileSync(p) : null;
  const secs = w ? w.readUInt32LE(40) / w.readUInt32LE(28) : 0;
  chk("sounds/reminder.wav is a WAV inside the offscreen 6s belt", w && w.toString("ascii", 8, 12) === "WAVE" && secs > 2 && secs < 5.5, secs.toFixed(2));
  chk("...and a documented package exception", /p: "sounds\/reminder\.wav"/.test(c.pkg));
  return rows;
}

const SEEDS = [
  ["missed days ring late", "      return typeof r.firedAt !== \"number\" && r.at <= ref && localDayKey(r.at) === today;", "      return typeof r.firedAt !== \"number\" && r.at <= ref;", "st"],
  ["fired reminders ring again", "      return typeof r.firedAt !== \"number\" && r.at <= ref && localDayKey(r.at) === today;", "      return r.at <= ref && localDayKey(r.at) === today;", "st"],
  ["past times accepted", "    if (typeof fields.at !== \"number\" || !isFinite(fields.at) || fields.at <= ref) return null;\n    var r = {", "    if (typeof fields.at !== \"number\" || !isFinite(fields.at)) return null;\n    var r = {", "st"],
  ["a moved reminder stays fired", "      if (fields.at !== r.at) { r.at = fields.at; r.firedAt = null; }", "      if (fields.at !== r.at) { r.at = fields.at; }", "st"],
  ["only the active workspace fires", "    ((data && data.workspaces) || []).forEach(function (w) {\n      ((w && Array.isArray(w.reminders))", "    [getActiveWorkspace(data)].forEach(function (w) {\n      ((w && Array.isArray(w.reminders))", "st"],
  ["it plays before it saves",
   "    Storage.markRemindersFired(d, list.map(function (r) { return r.id; }), now);\n    await Storage.saveAll(d);",
   "    Storage.markRemindersFired(d, list.map(function (r) { return r.id; }), now);\n    await playFileViaOffscreen(Storage.REMINDER_FILE);\n    await Storage.saveAll(d);", "bg"],
  ["startup forgets the catch-up", "  // [MC9] A reminder due while the browser was closed goes off now - if it is\n  // still the same day (Storage.remindersToFire holds that rule).\n  runRemindersBg();", "", "bg"],
  ["the page forgets to tell the worker", "    try { chrome.runtime.sendMessage({ type: \"lp-reminders-changed\" }", "    try { void ({ type: \"lp-reminders-x\" }", "nt"],
  ["double-click goes straight to the task box", "          dashCalOpenSplit(panel, st);", "          dashCalOpenAdd(panel, st);", "nt"],
];

const clean = { st: read("storage.js"), bg: read("background.js"), nt: read("newtab.js"), pkg: read("tools/lib/package-sources.mjs") };
if (args.includes("--boot-check")) {
  try { boot(clean.st, true); console.log("BOOT-CHECK OK   check-reminders.mjs"); process.exit(0); }
  catch (e) { console.log("BOOT-CHECK DEAD check-reminders.mjs — " + e.message); process.exit(1); }
}
console.log("\nREMINDERS — on time, once, today only, from the worker; the split pill\n");
let rows;
try { rows = await suite(clean); }
catch (e) { console.error("SUBJECT DID NOT LOAD — " + e.message); process.exit(2); }
const ROW_FLOOR = 40;
if (rows.length < ROW_FLOOR) { console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`); process.exit(2); }
let failed = 0;
for (const r of rows) if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
console.log(`REMINDERS: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);
if (!MUTATE) process.exit(failed === 0 ? 0 : 1);
if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }
console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl, file] of SEEDS) {
  const n = clean[file].split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  let mrows;
  try { mrows = await suite({ ...clean, [file]: clean[file].split(find).join(repl) }); }
  catch (e) { mrows = [{ name: "subject did not load: " + e.message, ok: false }]; }
  const red = mrows.filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else console.log(`  killed   ${name}\n           by: ${red[0].name.slice(0, 92)}`);
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
