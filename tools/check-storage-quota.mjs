#!/usr/bin/env node
// ===========================================================================
// [1.10.3] STORAGE-QUOTA VISIBILITY GATE.
//
// THE CONTRACT, in one sentence: a write that chrome.storage.local REFUSES must
// never look to the user like a write that succeeded.
//
// Before this round it always did. `saveAll`'s entire catch body was one
// console.error; the caller had already mutated the in-memory `data`, nothing
// told it otherwise, and the page went on rendering a change that was not on
// disk. The user saw it apply and lost it at the next reload. Measured in a
// scratch profile, not inferred: the set throws "Resource::kQuotaBytes quota
// exceeded" and the value reads back absent.
//
// WHY THIS IS A BEHAVIOURAL GATE AND NOT A GREP. Every property below is about
// what a REFUSED WRITE DOES - what saveAll returns, whether the hook fires, what
// getAll hands back afterwards. A regex can see that `onWriteFail` is spelled
// somewhere; it cannot see that the hook fires on failure and stays silent on
// success, which is the entire contract. So the real storage.js is loaded into a
// VM against a fake chrome.storage.local whose `set` can be made to refuse.
//
// WHY THE INJECTED REFUSAL, rather than filling a real profile. The live
// harness for this round tried that and could not make it deterministic:
// getBytesInUse is NOT the accounting Chrome charges the quota against. A
// profile it reported as having ZERO bytes free still accepted a ~306-byte
// write, while a ~45-byte one had been refused with 21 bytes reportedly free.
// A gate that only sometimes exercises its path is worse than one that never
// claims to, so the refusal is injected here.
//
// AND THE SECOND SUBJECT, ADDED 2026-09-14: THE PAGE-SIDE WIRING.
// The line above used to end "...and the USER-VISIBLE half (toast, revert) is
// verified live instead", and that was the whole hazard. A live pass is run
// once, by hand, in the round that writes it; it is not a gate. Every property
// below concerns storage.js, so DELETING newtab.js's one-line
// `Storage.onWriteFail(...)` registration removed the entire user-facing half
// of this feature and left all 15 rows GREEN - measured, by seeding exactly
// that deletion. storage.js would still faithfully report a failure to a hook
// nobody had registered.
//
// This is the I8 split the ledger already names: RUNTIME PROVES THE BEHAVIOUR,
// A GATE PROVES THE WIRING. The behavioural half stays in the VM; the wiring
// half is necessarily STATIC, because newtab.js is one ~22,000-line IIFE that
// exports nothing and needs a DOM (BUGS.md I27) - there is no way to boot it
// and ask. So it is read as text, and every wiring row carries its own
// mutation seed so a row that stops meaning anything says so.
//
// Usage:
//   node tools/check-storage-quota.mjs [repoRoot]            clean run (the gate)
//   node tools/check-storage-quota.mjs [repoRoot] --mutate   mutation-seeding run
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || process.cwd();

const SUBJECT = "storage.js";
const QUOTA_MSG = "Resource::kQuotaBytes quota exceeded";

function readSubject() {
  // Normalised to LF before any anchor is matched. The working copy is CRLF
  // (core.autocrlf) while the blob is LF, and an anchor built from one silently
  // misses the other - BUGS.md M4 / M7, which cost two rounds.
  return fs.readFileSync(path.join(repoRoot, SUBJECT), "utf8").replace(/\r\n/g, "\n");
}

// A profile in the CURRENT shape but MISSING the seeded deletedAt fields, so
// ensureDeletedAtFields patches it and getAll is obliged to write. That write is
// the one the backfill assertions refuse.
function userProfile() {
  return {
    workspaces: [{
      id: "main", name: "Main", createdAt: 1, isReadOnly: false,
      groupOrder: ["ungrouped"],
      groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [
        { id: "s1", title: "TheUsersOwnShortcut", url: "https://example.com", addedAt: 1 }
      ] }],
      goals: [], tasks: [], tags: [], notes: [], namedSessions: [],
      tracking: { enabled: true }
    }],
    workspaceOrder: ["main"], activeWorkspaceId: "main", trackingPaused: false,
    settings: { columns: 6, collapsedGroups: {}, combinedAnalyticsEnabled: false, endOfDayMinutes: 1020 },
    pro: { subscriptionStatus: "free", licenseKey: null, instanceId: null, instanceName: null,
           email: null, trialStartedAt: null, trialEndedAt: null, lastVerifiedAt: null }
  };
}

// Boot the real storage.js in a VM. `refuse` is a predicate over the written
// keys, so a test can refuse the backfill while letting everything else land.
function boot(src, refuse = () => false) {
  const store = { data: userProfile() };
  const writes = [];
  const chrome = {
    runtime: { getManifest: () => ({ version: "2.1.0" }), lastError: null, id: "test" },
    storage: {
      local: {
        QUOTA_BYTES: 10485760,
        // Structured-clone semantics per get, exactly as the real API (L2).
        get: async (k) => {
          const out = {};
          const keys = k === null ? Object.keys(store) : (Array.isArray(k) ? k : [k]);
          for (const key of keys) if (key in store) out[key] = JSON.parse(JSON.stringify(store[key]));
          return out;
        },
        set: async (obj) => {
          const keys = Object.keys(obj);
          writes.push(keys.join(","));
          if (refuse(keys)) throw new Error(QUOTA_MSG);
          for (const [k, v] of Object.entries(obj)) store[k] = JSON.parse(JSON.stringify(v));
        },
        remove: async () => {},
        getBytesInUse: async () => JSON.stringify(store).length
      }
    }
  };
  const errors = [];
  const sandbox = {
    chrome, crypto, Date, JSON, Math, Object, Array, Set, Map, String, Number,
    Boolean, isFinite, setTimeout, structuredClone, Promise, Error, RegExp,
    console: { log() {}, warn() {}, error(...a) { errors.push(a.map(String).join(" ")); } }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: SUBJECT });
  if (!sandbox.Storage || typeof sandbox.Storage.saveAll !== "function") {
    const e = new Error("Storage.saveAll missing after load");
    e.subjectDidNotLoad = true;
    throw e;
  }
  return { S: sandbox.Storage, store, writes, errors };
}

// --------------------------------------------------------------- the suite
async function suite(src) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });

  // 1. THE HAPPY PATH STAYS HAPPY. Asserted first and not as a formality: every
  //    row below is about failure, and a subject where NOTHING can be written
  //    would satisfy most of them for entirely the wrong reason.
  {
    const { S, store } = boot(src);
    const d = await S.getAll();
    d.settings.columns = 9;
    const ok = await S.saveAll(d);
    chk("saveAll returns TRUE when the write lands", ok === true, `returned ${ok}`);
    chk("...and the value is really on disk", store.data.settings.columns === 9,
      `columns=${store.data.settings.columns}`);
  }

  // 2. A REFUSED WRITE REPORTS ITSELF. The boolean is what a caller can branch
  //    on; setShortcutIcon is the first that does.
  {
    const { S } = boot(src, (keys) => keys.includes("data"));
    const ok = await S.saveAll(userProfile());
    chk("saveAll returns FALSE when the write is refused", ok === false, `returned ${ok}`);
  }

  // 3. THE HOOK FIRES, AND SAYS IT WAS THE QUOTA. This is the row that carries
  //    the whole user-facing surface: the toast and the revert both hang off it.
  {
    let fired = 0, sawQuota = null, where = null;
    const { S } = boot(src, (keys) => keys.includes("data"));
    S.onWriteFail((info) => { fired++; sawQuota = info && info.quota; where = info && info.where; });
    await S.saveAll(userProfile());
    chk("the write-failure hook fires on a refused write", fired === 1, `fired ${fired}x`);
    chk("...and reports the failure as a QUOTA failure", sawQuota === true, `quota=${sawQuota}`);
    chk("...and names where it happened", where === "saveAll", `where=${where}`);
  }

  // 4. AND STAYS SILENT WHEN THE WRITE LANDS. Without this row a hook that fired
  //    unconditionally would pass row 3, and the product would toast "not saved"
  //    over every successful write in the app.
  {
    let fired = 0;
    const { S } = boot(src);
    S.onWriteFail(() => { fired++; });
    const ok = await S.saveAll(await S.getAll());
    chk("the hook does NOT fire when the write succeeds", fired === 0 && ok === true,
      `fired ${fired}x, returned ${ok}`);
  }

  // 5. NO PROVENANCE LEAK. A refused set fires no onChanged, so a writeId left
  //    pending is never collected. Small, but it is the kind of residue that
  //    later suppresses a render nobody can explain.
  {
    const { S } = boot(src, (keys) => keys.includes("data"));
    const before = S._pendingWriteIds.size;
    await S.saveAll(userProfile());
    chk("a refused write leaves no writeId pending", S._pendingWriteIds.size === before,
      `${before} -> ${S._pendingWriteIds.size}`);
  }

  // 6. A REFUSED BACKFILL MUST NOT DISCARD A SUCCESSFUL READ. The hazard found
  //    during this round: getAll's one-time backfills sat inside its single try,
  //    so an over-quota backfill fell to the outer catch and getAll returned
  //    getDefaultData() - an EMPTY profile, from a read that had just SUCCEEDED.
  //    The next write that did land would persist that over the user's real
  //    data, turning a refused write into permanent loss.
  {
    const { S } = boot(src, (keys) => keys.includes("data"));
    const got = await S.getAll();
    const titles = (((got.workspaces || [])[0] || {}).groups || [])
      .flatMap((g) => (g.shortcuts || []).map((s) => s.title));
    chk("a refused BACKFILL still returns the user's own data, not defaults",
      titles.indexOf("TheUsersOwnShortcut") !== -1, `shortcuts=[${titles}]`);
  }

  // 7. THE QUOTA CLASSIFIER. Both directions: a real Chrome quota message must
  //    be recognised, and an unrelated failure must NOT be dressed up as one -
  //    the user would be told to delete icons over a bug that has nothing to do
  //    with space.
  {
    const { S } = boot(src);
    chk("isQuotaError recognises Chrome's real message", S.isQuotaError(new Error(QUOTA_MSG)) === true);
    chk("isQuotaError does not claim an unrelated failure is the quota",
      S.isQuotaError(new Error("An unexpected error occurred")) === false);
  }

  // 8. THE PROACTIVE READ. The warning surface is only as good as this number.
  {
    const { S } = boot(src);
    const u = await S.getStorageUsage();
    chk("getStorageUsage reports bytes, the quota and a ratio",
      !!u && u.quota === 10485760 && u.bytes > 0 && u.ratio > 0 && u.ratio < 1,
      JSON.stringify(u));
    chk("the warn threshold is a real fraction below 1",
      typeof S.QUOTA_WARN_RATIO === "number" && S.QUOTA_WARN_RATIO > 0 && S.QUOTA_WARN_RATIO < 1,
      `QUOTA_WARN_RATIO=${S.QUOTA_WARN_RATIO}`);
  }

  // 9. THE FIRST CALLER THAT BRANCHES ON THE BOOLEAN. setShortcutIcon must
  //    report a refused write rather than claiming ok - otherwise the page
  //    renders optimistically and races the hook's revert, and which of the two
  //    paints last is a scheduling accident.
  {
    const { S } = boot(src, (keys) => keys.includes("data"));
    const d = await S.getAll();
    const res = await S.setShortcutIcon(d, "s1", { kind: "emoji", value: "\u{1F680}" });
    chk("setShortcutIcon reports a refused write instead of claiming ok",
      res && res.ok === false && res.reason === "not-saved", JSON.stringify(res));
  }
  {
    const { S } = boot(src);
    const d = await S.getAll();
    const res = await S.setShortcutIcon(d, "s1", { kind: "emoji", value: "\u{1F680}" });
    chk("...and still reports ok when the write lands", res && res.ok === true, JSON.stringify(res));
  }

  return rows;
}

// ------------------------------------------------------------- mutation seeds
// Each reverts ONE property to how it behaved before this round. A seed that
// does not turn the suite red is a property nothing is actually testing.
// Anchors are occurrence-asserted (Q2): a seed that lands nowhere, or in more
// places than intended, is reported as BROKEN rather than scored.
const SEEDS = [
  { name: "saveAll swallows the failure again (returns undefined)",
    find: "      _pendingWriteIds.delete(writeId);\n      reportWriteFailure(err, \"saveAll\");\n      return false;",
    replace: "      console.error(\"[LaunchPad] Storage write failed:\", err);" },
  { name: "the failure hook is never invoked",
    find: "      try {\n        _onWriteFail({ quota: quota, where: where, error: err });",
    replace: "      try {\n        void 0;" },
  { name: "the hook fires on EVERY write, not only failures",
    find: "      return true;\n    } catch (err) {\n      _pendingWriteIds.delete(writeId);",
    replace: "      if (_onWriteFail) _onWriteFail({ quota: true, where: \"saveAll\", error: null });\n      return true;\n    } catch (err) {\n      _pendingWriteIds.delete(writeId);" },
  { name: "the pending writeId is leaked again on failure",
    find: "      _pendingWriteIds.delete(writeId);\n      reportWriteFailure(err, \"saveAll\");",
    replace: "      reportWriteFailure(err, \"saveAll\");" },
  { name: "a refused backfill discards the read and returns defaults",
    find: "          } catch (backfillErr) {\n            reportWriteFailure(backfillErr, \"getAll backfill\");\n          }",
    replace: "          } catch (backfillErr) {\n            throw backfillErr;\n          }" },
  { name: "every error is classified as a quota error",
    find: "    return /quota/i.test(msg);",
    replace: "    return true;" },
  { name: "no error is classified as a quota error",
    find: "    return /quota/i.test(msg);",
    replace: "    return false;" },
  // BOTH of setShortcutIcon's write sites (the set and the clear), which is why
  // this one declares expect: 2. The first cut anchored on the SET site plus its
  // preceding line, and a commit that inserted one line between them (the icon
  // `fit` field) broke the anchor - reported honestly as BROKEN rather than as a
  // kill, which is the machinery working, but a seed pinned to its neighbours is
  // a seed that breaks whenever a neighbour moves. Anchoring on the guard itself
  // and declaring how many there are survives that.
  { name: "setShortcutIcon claims ok even when the write was refused",
    find: "    if (!(await saveAll(data))) return { ok: false, reason: \"not-saved\" };",
    replace: "    await saveAll(data);", expect: 2 },
];

// ------------------------------------------------------- the wiring subjects
// Read as text, for the reason given in the header: newtab.js cannot be booted.
const PAGE = "newtab.js";
const CATALOGUE = "locales/en.js";

function readAux(name) {
  return fs.readFileSync(path.join(repoRoot, name), "utf8").replace(/\r\n/g, "\n");
}

// The three strings the surface actually renders. Named once, because both the
// wiring rows and the catalogue rows have to agree about them.
const FAIL_KEYS = ["storage_full_change_not_saved", "storage_write_failed"];
const WARN_KEY = "storage_nearly_full";

function wiringSuite(page, catalogue) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });

  // W1. THE REGISTRATION EXISTS. Without this single line every behavioural row
  //     above still passes and the user is told nothing at all. It is the one
  //     that caught nothing before today because nothing was looking.
  const registers = /Storage\.onWriteFail\s*\(/.test(page);
  chk("the PAGE registers a write-failure handler", registers);

  // W2. ...AND IT REGISTERS A REAL HANDLER, not null. Storage.onWriteFail(null)
  //     is the documented way to UNREGISTER, so a registration that passes W1
  //     can still be a disconnection. This is the shape the live run used to
  //     reproduce the pre-fix product, which is exactly why it is worth a row.
  const realHandler = /Storage\.onWriteFail\s*\(\s*(function|\(|[A-Za-z_$])/.test(page) &&
    !/Storage\.onWriteFail\s*\(\s*(null|undefined)\s*\)/.test(page);
  chk("...and registers a function rather than unregistering", realHandler);

  // W3. THE HANDLER TELLS THE USER. A hook that fires into a handler that does
  //     nothing is the return-value trap wearing a different hat.
  const toasts = FAIL_KEYS.every((k) => page.indexOf(k) !== -1);
  chk("...and the handler renders one of the failure strings", toasts,
    FAIL_KEYS.join(" + "));

  // W4. THE HANDLER REVERTS. The toast alone is half honest - the user reads
  //     "not saved" while looking straight at the change that was apparently
  //     saved. Asserted as re-read AND re-render, because either alone leaves
  //     the page showing something that is not on disk.
  //     Counted rather than merely matched: `revertToPersistedState(` appears
  //     in its own definition, so a page that DEFINES the revert and never
  //     CALLS it satisfies a bare test() - the W5 lesson, one row earlier.
  const revertCalls = page.split(/revertToPersistedState\s*\(/).length - 1;
  const revertBody =
    /async function revertToPersistedState[\s\S]{0,900}Storage\.getAll\s*\([\s\S]{0,400}render\s*\(/
      .test(page);
  chk("...and drops back to what is actually persisted", revertCalls >= 2 && revertBody,
    revertCalls >= 2 ? (revertBody ? "called + re-reads + re-renders"
      : "CALLED BUT DOES NOT RE-READ/RE-RENDER") : "DEFINED BUT NEVER CALLED");

  // W5. THE PROACTIVE HALF IS CALLED, not merely defined. A warning function
  //     nobody invokes is the same defect as a boolean nobody reads.
  const defined = /function maybeWarnStoragePressure/.test(page);
  const called = (page.split(/maybeWarnStoragePressure\s*\(/).length - 1) >= 2;
  chk("the 80% pressure warning is CALLED, not just defined", defined && called,
    defined ? (called ? "defined + called" : "defined but NEVER CALLED") : "not defined");

  // W6. AND IT IS GATED ON THE THRESHOLD storage.js publishes, rather than on a
  //     second copy of 0.8 that can drift away from it.
  chk("...and reads its threshold from Storage.QUOTA_WARN_RATIO",
    /Storage\.QUOTA_WARN_RATIO/.test(page));

  // W7. THE STRINGS EXIST IN THE CATALOGUE. A t() call on a missing key renders
  //     the key, so the surface would survive every row above and still show the
  //     user "storage_full_change_not_saved".
  const missing = FAIL_KEYS.concat([WARN_KEY])
    .filter((k) => catalogue.indexOf('"' + k + '"') === -1);
  chk("every storage string the page renders is in the catalogue",
    missing.length === 0, missing.length ? "MISSING: " + missing.join(", ") : "3 of 3");

  return rows;
}

// -------------------------------------------------- wiring mutation seeds
// These mutate the PAGE, not the subject. Each is a way the user-facing half
// could be lost without a single behavioural row noticing - which is precisely
// what the pre-2026-09-14 gate allowed.
const WIRING_SEEDS = [
  { name: "the page stops registering the failure handler",
    find: "  Storage.onWriteFail(function (info) { handleStorageWriteFailure(info); });",
    replace: "" },
  { name: "the page UNREGISTERS instead of registering",
    find: "  Storage.onWriteFail(function (info) { handleStorageWriteFailure(info); });",
    replace: "  Storage.onWriteFail(null);" },
  { name: "the handler toasts but never calls the revert",
    find: "    revertToPersistedState();",
    replace: "    void 0;" },
  { name: "the revert never re-reads what is actually on disk",
    find: "      var persisted = await Storage.getAll();",
    replace: "      var persisted = data;" },
  { name: "the pressure warning is defined but never called",
    find: "      maybeWarnStoragePressure().catch(function (err) {",
    replace: "      Promise.resolve().catch(function (err) {" },
  { name: "the warning threshold is hardcoded rather than read from storage.js",
    find: "    if (usage.ratio < Storage.QUOTA_WARN_RATIO) return false;",
    replace: "    if (usage.ratio < 0.8) return false;" },
];

// ---------------------------------------------------------------------- main
const clean = readSubject();

if (args.includes("--boot-check")) {
  // In-process runner: the subject is built in memory, so "can it boot" is
  // simply "does it load and expose saveAll".
  try {
    boot(clean);
    console.log("BOOT-CHECK OK   check-storage-quota.mjs");
    process.exit(0);
  } catch (e) {
    console.log("BOOT-CHECK DEAD check-storage-quota.mjs — " + e.message);
    process.exit(1);
  }
}

console.log("\nSTORAGE-QUOTA GATE — a refused write must never look like a successful one\n");

let rows;
let page, catalogue;
try {
  page = readAux(PAGE);
  catalogue = readAux(CATALOGUE);
} catch (e) {
  console.error("WIRING SUBJECT DID NOT LOAD — " + e.message);
  process.exit(2);
}
try {
  rows = (await suite(clean)).concat(wiringSuite(page, catalogue));
} catch (e) {
  // P5/Q1: "the subject did not load" is never scored as a pass.
  console.error("SUBJECT DID NOT LOAD — " + e.message);
  process.exit(2);
}

// ANTI-VACUITY (P2). A suite that silently stops producing rows passes forever
// and reads exactly like one that checked everything and found nothing wrong.
const ROW_FLOOR = 21;
if (rows.length < ROW_FLOOR) {
  console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`);
  process.exit(2);
}

let failed = 0;
for (const r of rows) {
  if (!r.ok) failed++;
  console.log("  " + (r.ok ? "PASS  " : "FAIL  ") + r.name + (r.extra ? "   << " + r.extra : ""));
}
console.log(`\n  ${rows.length - failed} passed, ${failed} failed`);

if (!MUTATE) {
  process.exit(failed === 0 ? 0 : 1);
}

// ------------------------------------------------------------ mutation pass
if (failed > 0) {
  console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1).");
  process.exit(2);
}

console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const s of SEEDS) {
  // Occurrence-asserted (Q2). A seed whose anchor lands nowhere, or in more
  // places than it declares, is BROKEN and reported as such - never scored as a
  // kill, and never silently applied to more of the file than intended.
  const want = s.expect === undefined ? 1 : s.expect;
  const occurrences = clean.split(s.find).length - 1;
  if (occurrences !== want) {
    broken++;
    console.log(`  BROKEN SEED  ${s.name}`);
    console.log(`               anchor matched ${occurrences} times, expected exactly ${want}`);
    continue;
  }
  const mutated = clean.split(s.find).join(s.replace);
  let mrows;
  try {
    mrows = await suite(mutated);
  } catch (e) {
    // A mutant that breaks the MODULE kills every row for a reason unrelated to
    // the assertion being credited (Q1). That is a broken seed, not a kill.
    broken++;
    console.log(`  BROKEN SEED  ${s.name}`);
    console.log(`               subject did not load: ${e.message}`);
    continue;
  }
  const red = mrows.filter((r) => !r.ok);
  if (red.length === 0) {
    escaped++;
    console.log(`  ESCAPED  ${s.name}`);
  } else {
    console.log(`  killed   ${s.name}`);
    console.log(`           by: ${red.map((r) => r.name).slice(0, 2).join(" / ")}`);
  }
}

// The wiring seeds mutate the PAGE and are scored against the WIRING rows
// only, so a page mutant cannot be credited to a storage.js assertion.
for (const s of WIRING_SEEDS) {
  const want = s.expect === undefined ? 1 : s.expect;
  const occurrences = page.split(s.find).length - 1;
  if (occurrences !== want) {
    broken++;
    console.log(`  BROKEN SEED  ${s.name}`);
    console.log(`               anchor matched ${occurrences} times, expected exactly ${want}`);
    continue;
  }
  const red = wiringSuite(page.split(s.find).join(s.replace), catalogue).filter((r) => !r.ok);
  if (red.length === 0) {
    escaped++;
    console.log(`  ESCAPED  ${s.name}`);
  } else {
    console.log(`  killed   ${s.name}`);
    console.log(`           by: ${red.map((r) => r.name).slice(0, 2).join(" / ")}`);
  }
}

const TOTAL_SEEDS = SEEDS.length + WIRING_SEEDS.length;
console.log(`\n  ${TOTAL_SEEDS - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
