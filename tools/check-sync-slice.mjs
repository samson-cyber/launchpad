#!/usr/bin/env node
// THE storage.sync SLICE: what may leave this machine, asserted against the
// REAL storage.js rather than against a copy of the list.
//
// WHY A GATE AND NOT A COMMENT. The slice is an ALLOWLIST, and an allowlist's
// whole value is that adding a setting does not silently add it to the sync
// payload. That property is invisible in review - a new line in SYNC_SETTING_FIELDS
// looks exactly like every other line - so it is asserted here, where adding
// something that must never sync fails the build.
//
// THE SUBJECT IS LOADED, NOT PARSED. storage.js runs in a VM against a fake
// chrome, and buildSyncSlice is then CALLED with a deliberately dirty data
// object carrying every excluded key. Asserting on the function's real output
// is what makes this stronger than a regex over the source: a filter that was
// meant to remove __devProOverride but removed the wrong thing would still read
// correctly and would still fail here.
//
// WHAT THIS CANNOT SEE: whether Chrome actually replicates the bytes to another
// machine. Nothing static can. That is the round's stated human check.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] || process.cwd();
const rows = [];
function check(name, ok, detail) { rows.push({ name, pass: !!ok, detail: detail === undefined ? "" : String(detail) }); }

// ---- load the real storage.js -------------------------------------------
let Storage = null;
let SRC_TEXT = "";

// FACTORED OUT so the MUTANT can be loaded the same way as the subject. A
// mutation test that builds its victim differently is testing a different
// program.
function loadStorage(source) {
  const noop = () => {};
  const listeners = [];
  const ctx = {
    console: { log: noop, warn: noop, error: noop },
    setTimeout: () => 0, clearTimeout: noop,
    JSON, Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, Promise,
    TextEncoder, structuredClone,
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), id: "test" },
      storage: {
        local: { get: async () => ({}), set: async () => {}, remove: async () => {}, getBytesInUse: async () => 0 },
        sync: { get: async () => ({}), set: async () => {}, remove: async () => {},
                QUOTA_BYTES: 102400, QUOTA_BYTES_PER_ITEM: 8192, MAX_ITEMS: 512 },
        onChanged: { addListener: (f) => listeners.push(f) },
      },
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: "storage.js" });
  return ctx.Storage;
}

try {
  SRC_TEXT = fs.readFileSync(path.join(repoRoot, "storage.js"), "utf8");
  Storage = loadStorage(SRC_TEXT);
} catch (e) {
  console.log("\nSYNC SLICE: BROKEN - storage.js did not load: " + e.message + "\n");
  process.exit(2);
}
if (!Storage || typeof Storage.buildSyncSlice !== "function") {
  console.log("\nSYNC SLICE: BROKEN - Storage.buildSyncSlice missing\n");
  process.exit(2);
}

const PREFIX = Storage.SYNC_PREFIX;
const FIELDS = Storage.SYNC_SETTING_FIELDS || [];

// Everything that must NEVER travel, named individually so a failure names it.
//
// [PF.2 follow-up, ruled 2026-09-16] The last three are the ruled exclusions,
// and the gate carries them for the reason the ruling gives: each looks like an
// ordinary preference, so the only durable form of "do not add this" is a build
// that goes red when someone does. Adding any one of them to the allowlist in
// storage.js turns this suite RED and names the row.
//   nestingTipDismissed  onboarding state, per-machine by nature
//   autoBackupEnabled    the backup file lands in THIS machine's downloads
//   notificationsEnabled the permission is per-browser; a synced `true` reads ON
//                        and does nothing on a machine that never granted it
const FORBIDDEN_SETTINGS = [
  "collapsedGroups", "greetingSeenDay", "storageNoticeAt", "lastBackupAt",
  "nestingTipDismissed", "autoBackupEnabled", "notificationsEnabled",
];
// data.pro's verdict: per-machine by definition. A synced verdict MINTS access.
const FORBIDDEN_PRO = ["instanceId", "instanceName", "subscriptionStatus", "lastVerifiedAt", "trialStartedAt", "trialEndedAt", "email"];

// ---- a deliberately DIRTY subject ---------------------------------------
const dirty = {
  __devProOverride: true,
  proCelebrated: true,
  settings: {
    iconSize: "large", textSize: "large", layout: "compact", focusView: true,
    searchMode: "search", wallDim: 0.4, dueRemindersEnabled: true,
    // notificationsEnabled is NESTED, and that is the point of this row. It has
    // no top-level existence anywhere in the product, so a gate that only
    // checked top-level settings would pass while the field travelled inside
    // pomodoro - which is exactly what it did until this round.
    pomodoro: { workMin: 50, sound: "chime2", notificationsEnabled: true },
    focus: { idleSec: 90, commitment: true },
    modePresets: { work: { workMin: 45 }, casual: { workMin: 20 } },
    collapsedGroups: { g1: true, g2: true },
    greetingSeenDay: "2026-09-16", storageNoticeAt: 1, lastBackupAt: 2,
    nestingTipDismissed: true, autoBackupEnabled: true,
    columns: 8, locale: "en-GB", defaultNoteColor: "lavender",
    endOfDayMinutes: 1320, focusTargetMin: 120, insightsRangeDays: 30,
    combinedAnalyticsEnabled: true,
  },
  pro: {
    licenseKey: "LP-KEY", instanceId: "inst_seat", instanceName: "Machine",
    email: "a@b.c", subscriptionStatus: "active", lastVerifiedAt: 99,
    trialStartedAt: 1, trialEndedAt: null,
  },
};
const bgCfg = { v: 2, global: "data:image/webp;base64,AAAA", rotate: { on: true, every: "hour" },
                ws: { w1: "data:image/webp;base64,BBBB" } };

const slice = Storage.buildSyncSlice(dirty, bgCfg);
const sliceKeys = Object.keys(slice);
const blob = JSON.stringify(slice);

// ---- anti-vacuity FIRST (P2) --------------------------------------------
// Every assertion below is of the form "X is absent". If the slice were empty,
// or the prefix blank, all of them would pass while proving nothing.
check("the slice is non-empty", sliceKeys.length >= 8, sliceKeys.length + " keys");
check("the prefix is a real namespace", typeof PREFIX === "string" && PREFIX.length >= 4, PREFIX);
check("the allowlist is populated", FIELDS.length >= 8, FIELDS.length + " fields");
// SCOPED TO THE TOP-LEVEL EXCLUSIONS ON PURPOSE. notificationsEnabled is in
// FORBIDDEN_SETTINGS - so the allowlist loop below still guards it - but it has
// no top-level existence in the product, so requiring it at dirty.settings[k]
// would assert a shape that does not occur. Its own anti-vacuity row, further
// down, asserts it where it actually lives: inside pomodoro.
const FORBIDDEN_TOP_LEVEL = FORBIDDEN_SETTINGS.filter((k) => k !== "notificationsEnabled");
check("the dirty subject really does carry the excluded keys",
  FORBIDDEN_TOP_LEVEL.every((k) => dirty.settings[k] !== undefined) && dirty.__devProOverride === true,
  FORBIDDEN_TOP_LEVEL.filter((k) => dirty.settings[k] === undefined).join(",") || "all present");

// ---- the actual rules ----------------------------------------------------
check("every key is namespaced", sliceKeys.every((k) => k.indexOf(PREFIX) === 0),
  sliceKeys.filter((k) => k.indexOf(PREFIX) !== 0).join(",") || "all");

// A namespaced key that collides with what the three areaName-blind listeners
// watch would undo the whole reason for the namespace.
const WATCHED = ["data", "tracking_sessions", "__lastWrite"];
check("no sync key collides with an unguarded listener's key",
  !sliceKeys.some((k) => WATCHED.includes(k.slice(PREFIX.length)) || WATCHED.includes(k)),
  sliceKeys.join(","));

for (const k of FORBIDDEN_SETTINGS) {
  check(`settings.${k} is not in the allowlist`, !FIELDS.includes(k));
  check(`settings.${k} does not appear in the built slice`, !blob.includes(JSON.stringify(dirty.settings[k])) || !sliceKeys.includes(PREFIX + k));
}
// ---- the NESTED exclusion, which the loop above cannot see ---------------
//
// FORBIDDEN_SETTINGS' loop asserts "not a top-level allowlist entry". For
// notificationsEnabled that is true and useless: the field only ever exists
// inside pomodoro, and pomodoro syncs whole. These rows assert the thing that
// actually matters - it is stripped on the way OUT and re-grafted from local on
// the way IN, so a merge can never overwrite this machine's permission answer.
const OMIT = Storage.SYNC_OMIT_SUBFIELDS || {};
check("the omission table names pomodoro.notificationsEnabled",
  Array.isArray(OMIT.pomodoro) && OMIT.pomodoro.includes("notificationsEnabled"),
  JSON.stringify(OMIT));
check("ANTI-VACUITY: the dirty pomodoro really does carry notificationsEnabled",
  dirty.settings.pomodoro.notificationsEnabled === true);
check("pomodoro still syncs its other fields",
  slice[PREFIX + "pomodoro"] && slice[PREFIX + "pomodoro"].workMin === 50 &&
  slice[PREFIX + "pomodoro"].sound === "chime2",
  JSON.stringify(slice[PREFIX + "pomodoro"]));
check("notificationsEnabled is STRIPPED out of the synced pomodoro",
  slice[PREFIX + "pomodoro"] &&
  !Object.prototype.hasOwnProperty.call(slice[PREFIX + "pomodoro"], "notificationsEnabled"),
  JSON.stringify(slice[PREFIX + "pomodoro"]));
check("notificationsEnabled appears NOWHERE in the built slice",
  !/notificationsEnabled/.test(blob), blob.slice(0, 200));

// THE INBOUND HALF. An arriving pomodoro carries no notificationsEnabled, so a
// wholesale assignment would DELETE the local one. Assert it survives, and that
// the rest of the arrival still lands.
{
  const local = { settings: { pomodoro: { workMin: 25, sound: "none", notificationsEnabled: true } } };
  const arrival = {};
  arrival[PREFIX + "pomodoro"] = { workMin: 50, sound: "chime2" };
  Storage.applySyncedValues(local, arrival);
  check("a merged pomodoro KEEPS this machine's notificationsEnabled",
    local.settings.pomodoro.notificationsEnabled === true,
    JSON.stringify(local.settings.pomodoro));
  check("...and still adopts the arriving fields",
    local.settings.pomodoro.workMin === 50 && local.settings.pomodoro.sound === "chime2",
    JSON.stringify(local.settings.pomodoro));
}

// ---- the seven RULED IN actually travel ---------------------------------
// The mirror of the exclusion rows: an allowlist entry that silently failed to
// build would leave these absent and every "is not present" row above would
// still pass.
for (const [f, want] of [["columns", 8], ["locale", "en-GB"], ["endOfDayMinutes", 1320],
                         ["focusTargetMin", 120], ["insightsRangeDays", 30],
                         ["defaultNoteColor", "lavender"], ["combinedAnalyticsEnabled", true]]) {
  check(`settings.${f} syncs (ruled in 2026-09-16)`, slice[PREFIX + f] === want,
    String(slice[PREFIX + f]));
}

check("__devProOverride is not in the allowlist", !FIELDS.includes("__devProOverride"));
check("__devProOverride does not appear in the built slice", !/devProOverride/i.test(blob) && !sliceKeys.some((k) => /devPro/i.test(k)));

for (const f of FORBIDDEN_PRO) {
  check(`pro.${f} never syncs`, !sliceKeys.includes(PREFIX + f) && !new RegExp(f).test(blob.replace(/lp_sync:licenseKey/g, "")));
}
check("the licence KEY does sync", slice[PREFIX + "licenseKey"] === "LP-KEY", slice[PREFIX + "licenseKey"]);

// The wallpaper: the mode travels, the pixels never do.
check("the wallpaper rotation MODE syncs",
  slice[PREFIX + "bgRotate"] && slice[PREFIX + "bgRotate"].on === true && slice[PREFIX + "bgRotate"].every === "hour",
  JSON.stringify(slice[PREFIX + "bgRotate"]));
check("no image data reaches the slice", !/data:image|base64/i.test(blob));
check("no per-workspace wallpaper map reaches the slice", !/"ws"/.test(blob));

// Nothing outside the allowlist, whatever else is in settings.
const extra = sliceKeys
  .map((k) => k.slice(PREFIX.length))
  .filter((n) => !FIELDS.includes(n) && n !== "licenseKey" && n !== "bgRotate");
check("the slice contains NOTHING beyond the allowlist", extra.length === 0, extra.join(",") || "none");

// ---- the wiring, read from the sources ----------------------------------
const BG = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
check("background.js's sync listener is scoped to areaName 'sync'",
  /onChanged\.addListener\(function \(changes, areaName\) \{\s*\n\s*if \(areaName !== "sync"\) return;/.test(BG));
check("background.js merges on install and on startup",
  /onInstalled[\s\S]{0,600}?runSyncMerge\("installed"\)/.test(BG) && /onStartup[\s\S]{0,400}?runSyncMerge\("startup"\)/.test(BG));
check("the merge goes through the background write queue (L1)",
  /function runSyncMerge[\s\S]{0,200}?enqueueBgData\("sync-merge"/.test(BG));
check("storage.js cancels a queued push when a value arrives",
  /syncNoteExternalChange[\s\S]{0,700}?delete _syncPending\[k\]/.test(SRC_TEXT));
check("the licence adoption clears the seat and the verdict",
  /function adoptSyncedLicenseKey[\s\S]{0,400}?instanceId = null[\s\S]{0,200}?lastVerifiedAt = null[\s\S]{0,120}?subscriptionStatus = "free"/.test(SRC_TEXT));

// ===== [L6] THE PER-FIELD WRITE STAMPS ====================================
//
// WHAT THESE ROWS ARE FOR. Without a stamp the merge treated an arriving
// value as authoritative because it arrived, so a 1500ms-old echo of the
// FIRST click overwrote a change made 20ms ago - measured 5 times in 9 on a
// real profile before the fix. The stamp makes "last write wins" a fact
// about when each side wrote rather than about who spoke most recently.
//
// AND WHY THE MUTATION IS HERE RATHER THAN IN A ROUND REPORT. The comparison
// is four lines and deleting them leaves a merge that still runs, still
// returns the right shape and still passes every other row in this file. A
// row that cannot fail is P2's vacuous gate, so the deletion is performed
// below, against a second copy of storage.js in its own VM, and the suite
// fails if the mutant still behaves.

const STAMP_KEY = Storage.SYNC_STAMPS_KEY;
const REM = PREFIX + "dueRemindersEnabled";
const stampedData = (value, stamp) => {
  const d = { settings: { dueRemindersEnabled: value } };
  if (stamp !== null) d[STAMP_KEY] = { dueRemindersEnabled: stamp };
  return d;
};

check("the stamps map has a name storage.js and the gate agree on", typeof STAMP_KEY === "string" && STAMP_KEY.length > 0, STAMP_KEY);

// --- the wire format ---
{
  const wrapped = Storage.syncWrapStamped({ workMin: 25 }, 4242);
  check("a stamped value travels WRAPPED, value and stamp together",
    wrapped && wrapped.t === 4242 && wrapped.v && wrapped.v.workMin === 25, JSON.stringify(wrapped));
  check("an UNSTAMPED value travels in the legacy shape",
    Storage.syncWrapStamped(true, null) === true, JSON.stringify(Storage.syncWrapStamped(true, null)));
  const back = Storage.syncUnwrapStamped(wrapped);
  check("a wrapper round-trips", back.stamp === 4242 && back.v === undefined && back.value.workMin === 25, JSON.stringify(back));
  const plain = Storage.syncUnwrapStamped({ workMin: 25 });
  check("a plain OBJECT is not mistaken for a wrapper", plain.stamp === null && plain.value.workMin === 25, JSON.stringify(plain));
}

// --- the stamp never leaks into the payload as a setting ---
{
  const dirtyStamped = JSON.parse(JSON.stringify(dirty));
  dirtyStamped[STAMP_KEY] = { iconSize: 1 };
  const s2 = Storage.buildSyncSlice(dirtyStamped, null);
  check("the stamps map is NEVER a key in the slice",
    !Object.keys(s2).some((k) => k.indexOf(STAMP_KEY) !== -1), Object.keys(s2).join(","));
}

// --- the truth table, against the real applySyncedValues ---
{
  let d = stampedData(false, 1000);
  Storage.applySyncedValues(d, { [REM]: Storage.syncWrapStamped(true, 2000) });
  check("both stamped, remote NEWER -> remote wins (PF.2 preserved)", d.settings.dueRemindersEnabled === true, JSON.stringify(d.settings));

  d = stampedData(false, 2000);
  Storage.applySyncedValues(d, { [REM]: Storage.syncWrapStamped(true, 1000) });
  check("both stamped, remote OLDER -> LOCAL wins (this is L6)", d.settings.dueRemindersEnabled === false, JSON.stringify(d.settings));

  d = stampedData(false, 1500);
  Storage.applySyncedValues(d, { [REM]: Storage.syncWrapStamped(true, 1500) });
  check("equal stamps -> local kept", d.settings.dueRemindersEnabled === false, JSON.stringify(d.settings));

  d = stampedData(false, null);
  Storage.applySyncedValues(d, { [REM]: true });
  check("NEITHER side stamped -> today's behaviour, remote wins", d.settings.dueRemindersEnabled === true, JSON.stringify(d.settings));

  d = stampedData(false, 1000);
  Storage.applySyncedValues(d, { [REM]: true });
  check("remote UNSTAMPED against a stamped local -> the unstamped side is older",
    d.settings.dueRemindersEnabled === false, JSON.stringify(d.settings));

  d = stampedData(false, null);
  Storage.applySyncedValues(d, { [REM]: Storage.syncWrapStamped(true, 1) });
  check("local UNSTAMPED against a stamped remote -> the unstamped side is older",
    d.settings.dueRemindersEnabled === true, JSON.stringify(d.settings));

  d = stampedData(true, 1000);
  const r = Storage.applySyncedValues(d, { [REM]: Storage.syncWrapStamped(true, 9000) });
  check("same value, newer stamp -> the stamp is adopted and REPORTED",
    Storage.syncStampOf(d, "dueRemindersEnabled") === 9000 && r.stamps.indexOf("dueRemindersEnabled") !== -1,
    JSON.stringify(r) + " " + Storage.syncStampOf(d, "dueRemindersEnabled"));
}

// --- key order is not a change (the spurious save that carried a stale blob) ---
{
  const a = { workMin: 25, notificationsEnabled: true, chain: false };
  const bb = { chain: false, workMin: 25, notificationsEnabled: true };
  check("the merge compares values on a STABLE key order",
    Storage.syncStableStringify(a) === Storage.syncStableStringify(bb) && JSON.stringify(a) !== JSON.stringify(bb),
    Storage.syncStableStringify(a));
}

// --- ONE WRITER: the stamp goes in the same set() as the value ---
check("saveAll stamps BEFORE the local set, so value and stamp are one write",
  /syncStampLocal\(data\)[\s\S]{0,400}?await chrome\.storage\.local\.set\(\{/.test(SRC_TEXT));
check("getAll primes the stamp basis",
  /async function getAll\(\)[\s\S]{0,400}?syncNoteLocalBasis\(data\)/.test(SRC_TEXT));
check("a stamp-only merge still counts as touched in background.js",
  /var touched = res\.settings\.length > 0 \|\| res\.licenseKeyAdopted \|\| \(res\.stamps/.test(BG));

// --- THE MUTATION. Remove the comparison; L6 must come back. ---
{
  const CUT = SRC_TEXT.indexOf("if (localStamp !== null && (parsed.stamp === null || parsed.stamp <= localStamp)) {");
  check("the stamp comparison is present in storage.js to be mutated", CUT !== -1, String(CUT));
  if (CUT !== -1) {
    const end = SRC_TEXT.indexOf("}", SRC_TEXT.indexOf("continue;", CUT)) + 1;
    const mutated = SRC_TEXT.slice(0, CUT) + "if (false) {" + SRC_TEXT.slice(SRC_TEXT.indexOf("{", CUT) + 1, end) + SRC_TEXT.slice(end);
    let Mutant = null, why = "";
    try { Mutant = loadStorage(mutated); } catch (e) { why = e.message; }
    check("the mutant still loads (so the row below is about behaviour, not a syntax error)", !!Mutant, why);
    if (Mutant) {
      const d = { settings: { dueRemindersEnabled: false }, [STAMP_KEY]: { dueRemindersEnabled: 2000 } };
      Mutant.applySyncedValues(d, { [REM]: Mutant.syncWrapStamped(true, 1000) });
      check("MUTATION: removing the stamp comparison brings L6 back (older remote overwrites newer local)",
        d.settings.dueRemindersEnabled === true,
        "the mutant kept the local value - this suite cannot see the comparison being removed");
    }
  }
}
// ---- report --------------------------------------------------------------
let pass = 0, fail = 0;
console.log("\nSYNC SLICE - what may leave this machine\n");
for (const r of rows) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
  r.pass ? pass++ : fail++;
}
const MIN = 45;
if (rows.length < MIN) {
  console.log(`\nSYNC SLICE: FAIL - only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
console.log(`\nSYNC SLICE: ${fail === 0 ? "PASS" : "FAIL"} - ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
