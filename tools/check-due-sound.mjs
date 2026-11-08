#!/usr/bin/env node
// ===========================================================================
// [MC7] THE DUE SOUND, THE BELL, AND THE CALENDAR'S ADD AND DELETE.
//
// WHY THIS EXISTS. A sound that plays on launch is the most intrusive thing
// this product does, so its restraint has to be a rule rather than a habit:
// once a day, only for work that REACHED its date, never for work already
// heard, off for anyone updating, and decided in ONE place so a dozen tabs
// cannot ring a dozen times. None of those failures throws; each just makes
// noise at the wrong moment or silence at the right one.
//
// WHAT IT HOLDS:
//   Storage.dueSoundToAnnounce, against the real storage.js in a VM:
//     - off unless the switch is on; off without Pro; NOT mode-gated (the
//       default mode is Casual, and a Work-only rule would silence it)
//     - due today counts; overdue does not; snoozed does not
//     - a task CREATED today does not (it was added, it did not arrive),
//       but a recurring instance does
//     - a task heard today is not heard again; another task arriving is; a
//       new day starts over; nextDueSoundLog merges without duplicates
//   background.js: the launch message runs the chain; the log is written
//     BEFORE the sound plays; the install default is "install" only and does
//     not overwrite a set value; the file goes through the offscreen document
//   the file: a real WAV, shorter than the offscreen document's 6s belt, and
//     listed as a documented runtime exception; not in the sync allowlist
//   the bell: an SVG, no ring glyph
//   the calendar: Delete goes through deleteTaskWithUndo; a double-click opens
//     "Add task?"; the add uses the clicked day unless the text names one and
//     refuses a cadence; the overlay ignores the backdrop click that is the
//     second half of the click that opened it
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
  if (!S || typeof S.dueSoundToAnnounce !== "function") throw new Error("Storage.dueSoundToAnnounce missing after load");
  return S;
}

const DAY = 86400000;
// Local noon, 9 Nov 2026. dueAt lives as the UTC midnight of the LOCAL date.
const NOW = new Date(2026, 10, 9, 12, 0, 0).getTime();
const TODAY = Date.UTC(2026, 10, 9);
const YESTERDAY_LOCAL = new Date(2026, 10, 8, 10, 0, 0).getTime();
const task = (id, extra) => ({ id, name: id, dueAt: TODAY, completed: false, deletedAt: null, createdAt: YESTERDAY_LOCAL, ...(extra || {}) });
const fx = (tasks, extra) => ({
  activeWorkspaceId: "w", workspaceOrder: ["w"],
  workspaces: [{ id: "w", name: "W", tasks, tags: [], goals: [], recurringTemplates: [], mode: (extra && extra.mode) || undefined }],
  settings: { dueSoundEnabled: !(extra && extra.off) },
  dueWorkSnoozes: (extra && extra.snoozes) || {},
  pro: { subscriptionStatus: "active" }
});

function suite(st, bg, nt, html, css, pkg) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  const eq = (name, got, want) => chk(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  const S = boot(st, true), F = boot(st, false);
  const key = S.localDayKey(NOW);

  // ---- the policy ----
  eq("a task that reached today is announced", S.dueSoundToAnnounce(fx([task("a")]), null, NOW), ["a"]);
  eq("off when the switch is off", S.dueSoundToAnnounce(fx([task("a")], { off: true }), null, NOW), []);
  eq("off when the switch was never set (an updating profile)", S.dueSoundToAnnounce({ ...fx([task("a")]), settings: {} }, null, NOW), []);
  eq("off without Pro", F.dueSoundToAnnounce(fx([task("a")]), null, NOW), []);
  eq("NOT mode-gated: a Casual workspace (the default) still hears it", S.dueSoundToAnnounce(fx([task("a")], { mode: "casual" }), null, NOW), ["a"]);
  eq("overdue is not announced (it was, on its day)", S.dueSoundToAnnounce(fx([task("o", { dueAt: TODAY - 2 * DAY })]), null, NOW), []);
  eq("a snoozed task is not announced", S.dueSoundToAnnounce(fx([task("a")], { snoozes: { a: key } }), null, NOW), []);
  eq("a task CREATED today is not announced (added, not arrived)", S.dueSoundToAnnounce(fx([task("n", { createdAt: NOW - 3600000 })]), null, NOW), []);
  eq("...but a recurring instance spawned today is", S.dueSoundToAnnounce(fx([task("r", { createdAt: NOW - 3600000, isRecurringInstance: true, recurringTemplateId: "tp" })]), null, NOW), ["r"]);
  eq("completed and trashed tasks are not announced", S.dueSoundToAnnounce(fx([task("c", { completed: true }), task("d", { deletedAt: 5 })]), null, NOW), []);
  eq("tomorrow's task is not announced", S.dueSoundToAnnounce(fx([task("t", { dueAt: TODAY + DAY })]), null, NOW), []);
  eq("a task heard today is not heard again", S.dueSoundToAnnounce(fx([task("a")]), { day: key, ids: ["a"] }, NOW), []);
  eq("another task arriving the same day is", S.dueSoundToAnnounce(fx([task("a"), task("b")]), { day: key, ids: ["a"] }, NOW), ["b"]);
  eq("yesterday's log does not silence today", S.dueSoundToAnnounce(fx([task("a")]), { day: "2026-11-08", ids: ["a"] }, NOW), ["a"]);
  eq("the log grows within a day without duplicates", S.nextDueSoundLog({ day: key, ids: ["a"] }, ["a", "b"], NOW), { day: key, ids: ["a", "b"] });
  eq("the log starts over on a new day", S.nextDueSoundLog({ day: "2026-11-08", ids: ["a"] }, ["b"], NOW), { day: key, ids: ["b"] });
  eq("setDueSoundEnabled / getDueSoundEnabled round-trip", (() => { const d = { settings: {} }; S.setDueSoundEnabled(d, true); return S.getDueSoundEnabled(d); })(), true);
  chk("the file the worker plays is the packaged one", S.DUE_SOUND_FILE === "sounds/due-reminder.wav" && S.DUE_SOUND_LOG_KEY === "dueSoundLog");

  // ---- the worker ----
  const runFn = (() => { const a = bg.indexOf("function runDueSoundOnLaunch()"); return a < 0 ? "" : bg.slice(a, bg.indexOf("\n}\n", a) + 3); })();
  chk("the launch message runs the worker's chain", /msg\.type === "lp-due-sound-launch"\) \{\n\s*runDueSoundOnLaunch\(\)/.test(bg));
  chk("one check at a time: each run is chained on the last", /var p = _dueSoundChain\.then\(run, run\);/.test(runFn));
  chk("the log is written BEFORE the sound plays", runFn.indexOf("await chrome.storage.local.set(rec);") > 0 &&
    runFn.indexOf("await chrome.storage.local.set(rec);") < runFn.indexOf("playFileViaOffscreen(Storage.DUE_SOUND_FILE)"));
  chk("the worker holds no policy: it asks Storage.dueSoundToAnnounce", /Storage\.dueSoundToAnnounce\(d, log, now\)/.test(runFn));
  chk("the install default is for fresh installs only", /if \(details && details\.reason === "install"\) \{\n\s*enqueueBgData\("due-sound-default"/.test(bg));
  chk("...and never overwrites a value already set", /typeof d\.settings\.dueSoundEnabled === "boolean"\) return;/.test(bg));
  chk("the boundary chime still plays through the shared path", /async function playSoundViaOffscreen\(sound\) \{[\s\S]{0,160}await playFileViaOffscreen\(file\);/.test(bg));

  // ---- the file ----
  const wavPath = path.join(repoRoot, "sounds/due-reminder.wav");
  let wavOk = false, secs = 0;
  if (fs.existsSync(wavPath)) {
    const w = fs.readFileSync(wavPath);
    wavOk = w.toString("ascii", 0, 4) === "RIFF" && w.toString("ascii", 8, 12) === "WAVE";
    const rate = w.readUInt32LE(24), bytesPerSec = w.readUInt32LE(28);
    secs = w.readUInt32LE(40) / bytesPerSec;
    wavOk = wavOk && rate === 22050;
  }
  chk("sounds/due-reminder.wav is a 22050 Hz WAV", wavOk);
  chk("...shorter than the offscreen document's 6s belt", secs > 2 && secs < 5.5, secs.toFixed(2) + "s");
  chk("...listed as a documented runtime exception for the package gate", /p: "sounds\/due-reminder\.wav"/.test(pkg));
  const syncList = (/var SYNC_SETTING_FIELDS = \[([\s\S]*?)\];/.exec(st) || [])[1] || "";
  chk("the switch does not sync (this machine's speakers, this machine's install)", syncList.length > 0 && !/dueSoundEnabled/.test(syncList));

  // ---- the bell ----
  const bell = (/<button id="due-bell"[\s\S]*?<\/button>/.exec(html) || [""])[0];
  chk("the due count wears a bell icon, not the ring glyph", /<svg class="due-bell-glyph"/.test(bell) && !/○/.test(bell), bell.slice(0, 200));
  chk("the settings switch exists", /<input type="checkbox" id="due-sound-toggle">/.test(html));

  // ---- the calendar ----
  const editM = (() => { const a = nt.indexOf("  function openEditTaskModal("); return a < 0 ? "" : nt.slice(a, nt.indexOf("\n  }\n", a) + 4); })();
  chk("Delete in the Edit task overlay goes through deleteTaskWithUndo", /extraButtons: \[\{[\s\S]{0,200}deleteTaskWithUndo\(taskId\)/.test(editM));
  chk("the delete's Undo refreshes the Dashboard too", /restoreTask\(data, taskId\);[\s\S]{0,260}dashRefreshIfShown\(\);/.test(nt));
  chk("a second click on a day opens Add task?", /if \(e\.detail >= 2\) \{[\s\S]{0,200}dashCalOpenAdd\(panel, st\);/.test(nt));
  const commit = (() => { const a = nt.indexOf("  async function dashCalCommitAdd("); return a < 0 ? "" : nt.slice(a, nt.indexOf("\n  }\n", a) + 4); })();
  chk("Add uses the clicked day unless the text names one", /dueAt: \(parsed && parsed\.dueAt !== null\) \? parsed\.dueAt : stamp,/.test(commit));
  chk("Add refuses a cadence, as the Dashboard box does", /if \(parsed && parsed\.recurrence\) \{ quickAddRenderPreview\(input\); input\.focus\(\); return; \}/.test(commit) &&
    /hasAttribute\("data-cal-add-input"\)\)\);/.test(nt));
  chk("the overlay ignores the backdrop click that opened it", /if \(e\.target === overlay && Date\.now\(\) - openedAt > 400\) doCancel\(\);/.test(nt));
  chk("Add task? slides down (240ms, entrance curve) and is still under reduced motion",
    /(?:^|\n)\.dash-cal-add \{[^}]*animation: lp-cal-add-in 240ms cubic-bezier\(0\.2, 0, 0, 1\) both;/.test(css) &&
    /@media \(prefers-reduced-motion: reduce\) \{ \.dash-cal-add \{ animation: none; \} \}/.test(css));
  return rows;
}

const SEEDS = [
  ["overdue is announced again", "if (it.snoozed || it.kind === \"overdue\") return false;", "if (it.snoozed) return false;", "st"],
  ["tasks added today ring", "      return !(typeof t.createdAt === \"number\" && localDayKey(t.createdAt) === today);", "      return true;", "st"],
  ["heard tasks ring again", "      if (heard.indexOf(it.taskId) !== -1) return false;\n", "", "st"],
  ["mode-gated after all", "    var ws = getActiveWorkspace(data);\n    var today = localDayKey(ref);\n    var heard",
   "    var ws = getActiveWorkspace(data);\n    if (getWorkspaceMode(ws) !== \"work\") return [];\n    var today = localDayKey(ref);\n    var heard", "st"],
  ["the switch is ignored", "    if (!data || !getDueSoundEnabled(data)) return [];", "    if (!data) return [];", "st"],
  ["the log is written after playing",
   "    await chrome.storage.local.set(rec);\n    var played = await playFileViaOffscreen(Storage.DUE_SOUND_FILE);",
   "    var played = await playFileViaOffscreen(Storage.DUE_SOUND_FILE);\n    await chrome.storage.local.set(rec);", "bg"],
  ["updates turn it on too", "  if (details && details.reason === \"install\") {", "  if (details) {", "bg"],
  ["the overlay closes on its own opening click", "if (e.target === overlay && Date.now() - openedAt > 400) doCancel();", "if (e.target === overlay) doCancel();", "nt"],
  ["Add ignores the clicked day", "dueAt: (parsed && parsed.dueAt !== null) ? parsed.dueAt : stamp,", "dueAt: (parsed && parsed.dueAt !== null) ? parsed.dueAt : dashboardTodayAsUtcDay(),", "nt"],
];

const clean = { st: read("storage.js"), bg: read("background.js"), nt: read("newtab.js"), html: read("newtab.html"), css: read("newtab.css"), pkg: read("tools/lib/package-sources.mjs") };
const runSuite = (c) => suite(c.st, c.bg, c.nt, c.html, c.css, c.pkg);
if (args.includes("--boot-check")) {
  try { boot(clean.st, true); console.log("BOOT-CHECK OK   check-due-sound.mjs"); process.exit(0); }
  catch (e) { console.log("BOOT-CHECK DEAD check-due-sound.mjs — " + e.message); process.exit(1); }
}
console.log("\nDUE SOUND — once a day, for work that arrived, decided in one place; the bell; calendar add and delete\n");
let rows;
try { rows = runSuite(clean); }
catch (e) { console.error("SUBJECT DID NOT LOAD — " + e.message); process.exit(2); }
const ROW_FLOOR = 38;
if (rows.length < ROW_FLOOR) { console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`); process.exit(2); }
let failed = 0;
for (const r of rows) if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
console.log(`DUE SOUND: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);
if (!MUTATE) process.exit(failed === 0 ? 0 : 1);
if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }
console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl, file] of SEEDS) {
  const n = clean[file].split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  const mut = { ...clean, [file]: clean[file].split(find).join(repl) };
  let mrows;
  try { mrows = runSuite(mut); }
  catch (e) { mrows = [{ name: "subject did not load: " + e.message, ok: false }]; }
  const red = mrows.filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else console.log(`  killed   ${name}\n           by: ${red[0].name.slice(0, 92)}`);
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
