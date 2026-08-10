#!/usr/bin/env node
// Suite for the L1 BACKGROUND-WRITER SERIALIZATION contract: every background
// path that mutates the `data` key goes through the enqueueBgData FIFO.
//
// THE ONE SENTENCE THIS FILE EXISTS TO HONOUR (BUGS.md L2):
// A SHARED IN-MEMORY OBJECT CANNOT FAIL ON THIS CLASS OF BUG — a single writer
// cannot clobber itself, so a harness that hands every cycle the same object is
// structurally incapable of reporting the clobber, no matter how many
// assertions it makes. This harness therefore does two things that are not
// optional:
//   1. chrome.storage.local.get returns an INDEPENDENT STRUCTURED CLONE per
//      call, exactly as the real API does, so each getAll -> mutate -> saveAll
//      cycle works on its own snapshot; and
//   2. get AND set carry INJECTED LATENCY, so cycles genuinely interleave
//      rather than completing atomically by accident of scheduling.
// The suite is red-proof: the mutation pass un-queues writers one at a time and
// the clobber must REPRODUCE, in both directions.
//
// Reconstructed from the R0 IMPLEMENTATION record (Asana 1217301306121338, 17
// checks + 5 seeds, commit 5451504) plus the writers that exist at HEAD, which
// are MORE than R0 had: [1.2.0] added focus-blocked-count, focus-gate-snooze and
// focus-gate-end. Where record and code disagree, the CODE is the spec.
//
// Usage:
//   node tools/check-bg-queue.mjs [repoRoot]            clean run (the gate)
//   node tools/check-bg-queue.mjs [repoRoot] --mutate   mutation-seeding run
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || process.cwd();

const LATENCY_MS = 8;                 // enough that cycles interleave, cheap enough to run in a gate
const SUBJECT_FILES = ["storage.js", "pro-access.js", "license.js", "tracking.js", "background.js"];
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readSubject(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");
}

function boot(seeds = []) {
  const sources = {};
  for (const f of SUBJECT_FILES) sources[f] = readSubject(f);

  // Context-bound seeds with occurrence assertions (BUGS.md Q2): a seed that
  // lands nowhere, or in more places than intended, is a BROKEN SEED and is
  // reported as such rather than as a coverage result.
  for (const s of seeds) {
    const src = sources[s.file];
    if (src === undefined) throw new Error(`seed targets unknown file ${s.file}`);
    const occurrences = src.split(s.find).length - 1;
    const want = s.expect === undefined ? 1 : s.expect;
    if (occurrences === 0) { const e = new Error(`ANCHOR-MISS in ${s.file}: ${JSON.stringify(s.find.slice(0, 60))}`); e.anchor = "MISS"; throw e; }
    if (occurrences !== want) { const e = new Error(`ANCHOR-AMBIGUOUS in ${s.file}: ${occurrences} occurrences, expected ${want}`); e.anchor = "AMBIGUOUS"; throw e; }
    sources[s.file] = src.split(s.find).join(s.replace);
  }

  const store = {};
  const stats = { gets: 0, sets: 0, dataSets: 0, pending: 0 };
  const listeners = {};
  const cap = (name) => ({ addListener: (fn) => { (listeners[name] = listeners[name] || []).push(fn); }, removeListener() {} });

  const local = {
    async get(k) {
      stats.gets++; stats.pending++;
      await sleep(LATENCY_MS);                     // INJECTED LATENCY (1)
      stats.pending--;
      if (typeof k === "string") { const o = {}; if (k in store) o[k] = clone(store[k]); return o; }
      if (Array.isArray(k)) { const o = {}; for (const key of k) if (key in store) o[key] = clone(store[key]); return o; }
      return clone(store);                          // INDEPENDENT SNAPSHOT (2)
    },
    async set(o) {
      stats.sets++; if ("data" in o) stats.dataSets++;
      stats.pending++;
      await sleep(LATENCY_MS);                     // INJECTED LATENCY on the write side too
      stats.pending--;
      for (const [k, v] of Object.entries(o)) store[k] = clone(v);
    },
    async remove(k) { delete store[k]; },
    async getBytesInUse() { return 0; },
  };

  const chrome = {
    storage: { local, onChanged: cap("storage.onChanged") },
    runtime: {
      lastError: null, id: "harness-extension-id",
      getManifest: () => ({ version: "0.0.0", permissions: [] }),
      getURL: (p) => "chrome-extension://harness-extension-id/" + p,
      onInstalled: cap("runtime.onInstalled"), onStartup: cap("runtime.onStartup"),
      onMessage: cap("runtime.onMessage"), onSuspend: cap("runtime.onSuspend"),
    },
    tabs: {
      query: async () => [], get: async () => ({}), update: async () => ({}),
      remove: async () => {}, create: async () => ({}), sendMessage: async () => ({}),
      onUpdated: cap("tabs.onUpdated"), onRemoved: cap("tabs.onRemoved"),
      onActivated: cap("tabs.onActivated"), onCreated: cap("tabs.onCreated"),
    },
    windows: {
      getLastFocused: async () => ({ id: 1, focused: true }), getAll: async () => [],
      onFocusChanged: cap("windows.onFocusChanged"), onRemoved: cap("windows.onRemoved"), WINDOW_ID_NONE: -1,
    },
    webNavigation: {
      onBeforeNavigate: cap("webNavigation.onBeforeNavigate"),
      onHistoryStateUpdated: cap("webNavigation.onHistoryStateUpdated"),
      onReferenceFragmentUpdated: cap("webNavigation.onReferenceFragmentUpdated"),
    },
    alarms: { create() {}, get: async () => null, getAll: async () => [], clear: async () => true, onAlarm: cap("alarms.onAlarm") },
    idle: { queryState: async () => "active", setDetectionInterval() {}, onStateChanged: cap("idle.onStateChanged") },
    contextMenus: { create() {}, removeAll(cb) { if (cb) cb(); }, update() {}, onClicked: cap("contextMenus.onClicked") },
    action: { setBadgeText() {}, setTitle() {}, onClicked: cap("action.onClicked") },
    notifications: {
      create(id, opts, cb) { if (cb) cb(id); }, clear(id, cb) { if (cb) cb(true); },
      onClicked: cap("notifications.onClicked"), onButtonClicked: cap("notifications.onButtonClicked"),
    },
    permissions: { contains: async () => true, request: async () => true },
    offscreen: { createDocument: async () => {}, closeDocument: async () => {}, hasDocument: async () => false },
    bookmarks: { getTree: async () => [], search: async () => [] },
    history: { search: async () => [] },
    topSites: { get: async () => [] },
    search: { query() {} },
  };

  const ctx = {
    chrome,
    console: { log() {}, warn() {}, error() {}, info() {} },
    Date, Math, JSON, URL, URLSearchParams, Promise, Error, Object, Array, String, Number, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat,
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => { await sleep(LATENCY_MS); return { ok: false, status: 0, json: async () => ({}) }; },
    // THE FAITHFUL UN-QUEUE (BUGS.md Q3). Mutation seeds redirect one label's
    // call site here. The writer STILL RUNS, immediately and concurrently —
    // exactly the pre-5451504 shape. A seed that merely deleted the writer would
    // turn the suite red for the wrong reason and earn credit it had not proved.
    __bypassQueue(label, fn) { return Promise.resolve().then(fn).catch(() => {}); },
    importScripts(...files) {
      for (const f of files) {
        const name = String(f).replace(/^.*[\\/]/, "");
        vm.runInContext(sources[name] !== undefined ? sources[name] : readSubject(name), ctx, { filename: name });
      }
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(sources["background.js"], ctx, { filename: "background.js" });
  return { ctx, store, stats, listeners };
}

// Wait for everything to settle: drain the real queue, then keep ticking while
// any storage op is still in flight (an UN-QUEUED writer is not on the queue, so
// draining alone would not wait for it).
async function settle(ctx, stats) {
  for (let i = 0; i < 200; i++) {
    await ctx.enqueueBgData("harness-drain", async () => {});
    await sleep(LATENCY_MS * 2);
    if (stats.pending === 0) {
      await ctx.enqueueBgData("harness-drain-2", async () => {});
      if (stats.pending === 0) return;
    }
  }
}

const fire = (listeners, name, ...a) => (listeners[name] || []).map((fn) => fn(...a));

// ------------------------------------------------------------------ fixture
const FAVICON_OLD = "https://old.example/icon.png";
const FAVICON_NEW = "https://new.example/icon.png";
const CHECKOUT_URL = "https://mylaunchpad.me/checkout-return?license_key=LP-TEST-KEY&email=x%40y.z";

function seedStore(store, opts = {}) {
  store.data = {
    workspaces: [{
      id: "main", name: "Main", groupOrder: ["ungrouped"],
      groups: [{
        id: "ungrouped", name: "Ungrouped", deletedAt: null,
        shortcuts: [
          { id: "s1", url: "https://mylaunchpad.me/", title: "LP", favicon: FAVICON_OLD, deletedAt: null, variants: [] },
          { id: "s2", url: "https://example.com/", title: "Ex", favicon: FAVICON_OLD, deletedAt: null, variants: [] },
        ],
      }],
      tasks: [], goals: [], tags: [],
    }],
    activeWorkspaceId: "main",
    settings: {
      columns: 6, collapsedGroups: {},
      pomodoro: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLongBreak: 4, notificationsEnabled: true, sound: "none" },
      focus: { autoArmDuringWork: true },
    },
    blockList: ["youtube.com"],
    focusSnoozes: {},
    focusArmed: true,
    trackingPaused: false,
    pro: { subscriptionStatus: "active", lastVerifiedAt: Date.now() },
    activeTask: {
      taskId: "t1", workspaceId: "main", startedAt: Date.now() - 60000,
      idleAt: null, idleMs: 0, pausedAt: null, pausedMs: 0,
      pomodoroState: opts.phaseExpired
        ? { phase: "work", phaseEndsAt: Date.now() - 1000, phaseDurationMs: 1500000, cycleCount: 0, sessionComplete: false, startedAt: Date.now() - 1500000 }
        : { phase: null, phaseEndsAt: null, phaseDurationMs: null, cycleCount: 0, sessionComplete: false },
    },
  };
}

// WARM THE FIXTURE BEFORE MEASURING ANYTHING (BUGS.md Q5). Storage.getAll()
// performs a ONE-TIME backfill write when it meets a blob without the tracking /
// focus-blocking state (storage.js: ensureDeletedAtFields / ensureTrackingState /
// ensureFocusBlockingState, "one write on the first load after update"). That
// write lands inside the first writer to read, so an unwarmed fixture inflates
// whichever writer happens to go first and makes every write-count assertion
// lie. This cost the suite a pass: the "raced == sum of solos" check failed at
// 4 vs 5 because the backfill was counted twice in the solo baselines and once
// in the raced run. Warming absorbs it; the check below proves the warm worked.
async function seed(ctx, store, opts) {
  seedStore(store, opts);
  await ctx.Storage.getAll();
}

// Readers over the persisted blob — each answers "did THIS writer's field survive?"
const readFavicon = (store, id = "s1") =>
  store.data.workspaces[0].groups[0].shortcuts.find((s) => s.id === id)?.favicon;
const readLicense = (store) => store.data.pro?.licenseKey || null;
const readIdleAt = (store) => store.data.activeTask?.idleAt ?? null;
const readShortcutCount = (store) => store.data.workspaces[0].groups.reduce((n, g) => n + g.shortcuts.length, 0);
const readBlockedCount = (store) => {
  const st = store.data.focusStats;
  if (!st || !st.byDay) return 0;
  return Object.values(st.byDay).reduce((n, d) => n + (d.blocked || 0), 0);
};
const readSnooze = (store) => Object.keys(store.data.focusSnoozes || {}).length;
const readArmed = (store) => store.data.focusArmed;

// -------------------------------------------------------------- the writers
// Each returns a promise for the listener call(s) it triggered. Fired through
// the REAL registered listeners, not by calling internals, so the wiring is
// under test too.
const WRITERS = {
  favicon: (ctx, L) => Promise.all(fire(L, "tabs.onUpdated",
    7, { status: "complete" }, { id: 7, url: "https://mylaunchpad.me/pricing", favIconUrl: FAVICON_NEW })),
  faviconExample: (ctx, L) => Promise.all(fire(L, "tabs.onUpdated",
    8, { status: "complete" }, { id: 8, url: "https://example.com/page", favIconUrl: FAVICON_NEW })),
  checkout: (ctx, L) => Promise.all(fire(L, "tabs.onUpdated",
    9, { url: CHECKOUT_URL }, { id: 9, url: CHECKOUT_URL })),
  // ONE EVENT, BOTH WRITERS — the [1.2.0]-shaped scenario: a checkout-return URL
  // on a domain that is ALSO bookmarked, so the favicon writer and the
  // checkout-return writer both fire from a single chrome.tabs.onUpdated.
  oneEventBoth: (ctx, L) => Promise.all(fire(L, "tabs.onUpdated",
    9, { url: CHECKOUT_URL, status: "complete" }, { id: 9, url: CHECKOUT_URL, favIconUrl: FAVICON_NEW })),
  idle: (ctx, L) => Promise.all(fire(L, "idle.onStateChanged", "idle")),
  contextAdd: (ctx, L) => Promise.all(fire(L, "contextMenus.onClicked",
    { menuItemId: "add-to-group_ungrouped", pageUrl: "https://wikipedia.org/wiki/Main" },
    { title: "Wikipedia", favIconUrl: FAVICON_NEW })),
  pomodoro: (ctx, L) => Promise.all(fire(L, "alarms.onAlarm", { name: "pomodoro-phase" })),
  focusBlocked: (ctx, L) => Promise.all(fire(L, "webNavigation.onBeforeNavigate",
    { frameId: 0, tabId: 11, url: "https://youtube.com/watch?v=1" })),
  gateSnooze: (ctx, L) => Promise.all(fire(L, "runtime.onMessage",
    { type: "focus-gate-snooze", entry: "youtube.com" }, {}, () => {})),
  gateEnd: (ctx, L) => Promise.all(fire(L, "runtime.onMessage",
    { type: "focus-gate-end" }, {}, () => {})),
};

// ------------------------------------------------------------------- suite
async function runSuite(ctx, store, stats, listeners) {
  const rows = [];
  const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail });

  // ===== GREEN CONTROL + its NEGATIVE TWIN ================================
  // "Serialized" must be PROVEN, not inferred from "nothing bad happened". Six
  // queued read-modify-writes on one counter must all land; the identical work
  // run unserialized must lose writes. Without the twin, a harness that cannot
  // see interleaving at all would report the same green.
  {
    store.data = { counter: 6 };
    const bump = async () => {
      const got = await ctx.chrome.storage.local.get("data");
      const d = got.data;
      d.counter = (d.counter || 0) + 1;
      await ctx.chrome.storage.local.set({ data: d });
    };
    await Promise.all([1, 2, 3, 4, 5, 6].map(() => ctx.enqueueBgData("harness-control", bump)));
    await settle(ctx, stats);
    check("GREEN CONTROL: 6 queued read-modify-writes all land (6 -> 12)", store.data.counter === 12, `counter=${store.data.counter}`);

    store.data = { counter: 6 };
    await Promise.all([1, 2, 3, 4, 5, 6].map(() => bump()));
    await settle(ctx, stats);
    check("NEGATIVE TWIN: the same work UNSERIALIZED loses writes (harness can see interleaving)",
      store.data.counter < 12, `counter=${store.data.counter} (must be < 12 or the harness is blind)`);
  }

  // ===== FIXTURE SELF-VERIFICATION (Q7) ===================================
  await seed(ctx, store);
  check("FIXTURE: seeded blob reads back as intended (old favicon, no license, idle clear)",
    readFavicon(store) === FAVICON_OLD && readLicense(store) === null && readIdleAt(store) === null,
    `favicon=${readFavicon(store)} license=${readLicense(store)} idleAt=${readIdleAt(store)}`);
  {
    // Prove the warm actually absorbed the backfill, rather than trusting it
    // (Q5 + Q7). A second read of a warmed fixture must write NOTHING; if this
    // ever fails, every write-count assertion below is measuring a backfill.
    const before = stats.dataSets;
    await ctx.Storage.getAll();
    check("FIXTURE IS WARM: re-reading a warmed blob performs no backfill write",
      stats.dataSets === before, `dataSets moved by ${stats.dataSets - before}`);
  }

  // ===== SOLO BASELINES — every assertion below is re-based off these (Q5) ==
  // Never hard-code "N writes": a defaulting or migrating reader can perform a
  // backfill write on first read and silently invalidate a literal count.
  const solo = {};
  for (const [name, w] of Object.entries({
    favicon: WRITERS.favicon, checkout: WRITERS.checkout, idle: WRITERS.idle,
    contextAdd: WRITERS.contextAdd, focusBlocked: WRITERS.focusBlocked,
  })) {
    await seed(ctx, store);
    const before = stats.dataSets;
    await w(ctx, listeners);
    await settle(ctx, stats);
    solo[name] = stats.dataSets - before;
  }
  check("BASELINE: each writer performs at least one `data` write when run alone",
    Object.values(solo).every((n) => n >= 1), JSON.stringify(solo));

  // ===== S1 — ONE EVENT, TWO WRITERS (the [1.2.0]-shaped clobber) ==========
  {
    await seed(ctx, store);
    const before = stats.dataSets;
    await WRITERS.oneEventBoth(ctx, listeners);
    await settle(ctx, stats);
    check("S1: one tabs.onUpdated event drives favicon AND checkout-return — favicon survives",
      readFavicon(store) === FAVICON_NEW, `favicon=${readFavicon(store)}`);
    check("S1: ...and the license key survives the same event",
      readLicense(store) === "LP-TEST-KEY", `license=${readLicense(store)}`);
    check("S1: total `data` writes equal the sum of the solo runs (no write was swallowed)",
      stats.dataSets - before === solo.favicon + solo.checkout,
      `raced=${stats.dataSets - before} solo=${solo.favicon}+${solo.checkout}`);
  }

  // ===== S2 — favicon x idle-state, BOTH ORDERS ===========================
  // R0's second direction: pre-fix, the UNQUEUED favicon save reverted a
  // correctly-QUEUED idle write. The queue only protects you if everyone is in it.
  {
    await seed(ctx, store);
    await Promise.all([WRITERS.favicon(ctx, listeners), WRITERS.idle(ctx, listeners)]);
    await settle(ctx, stats);
    check("S2a: favicon then idle — favicon survives", readFavicon(store) === FAVICON_NEW, `favicon=${readFavicon(store)}`);
    check("S2a: favicon then idle — the queued idle stamp survives", readIdleAt(store) !== null, `idleAt=${readIdleAt(store)}`);

    await seed(ctx, store);
    await Promise.all([WRITERS.idle(ctx, listeners), WRITERS.favicon(ctx, listeners)]);
    await settle(ctx, stats);
    check("S2b: idle then favicon — favicon survives", readFavicon(store) === FAVICON_NEW, `favicon=${readFavicon(store)}`);
    check("S2b: idle then favicon — the idle stamp survives", readIdleAt(store) !== null, `idleAt=${readIdleAt(store)}`);
  }

  // ===== S3 — context-menu add x idle =====================================
  // Q4 EXISTS BECAUSE OF THIS ONE: in R0 the context-menu writer passed in
  // isolation and its un-queue seed ESCAPED, because a single writer cannot
  // clobber itself. It is never exercised alone here.
  {
    await seed(ctx, store);
    const baseCount = readShortcutCount(store);
    await Promise.all([WRITERS.contextAdd(ctx, listeners), WRITERS.idle(ctx, listeners)]);
    await settle(ctx, stats);
    check("S3a: right-click add races an idle transition — the shortcut lands",
      readShortcutCount(store) === baseCount + 1, `count=${readShortcutCount(store)} base=${baseCount}`);
    check("S3a: ...and the idle stamp survives", readIdleAt(store) !== null, `idleAt=${readIdleAt(store)}`);

    await seed(ctx, store);
    await Promise.all([WRITERS.idle(ctx, listeners), WRITERS.contextAdd(ctx, listeners)]);
    await settle(ctx, stats);
    check("S3b: reverse order — the shortcut still lands", readShortcutCount(store) === baseCount + 1, `count=${readShortcutCount(store)}`);
    check("S3b: reverse order — the idle stamp still survives", readIdleAt(store) !== null, `idleAt=${readIdleAt(store)}`);
  }

  // ===== S4 — the pomodoro alarm-fire x favicon ===========================
  {
    await seed(ctx, store, { phaseExpired: true });
    await Promise.all([WRITERS.pomodoro(ctx, listeners), WRITERS.favicon(ctx, listeners)]);
    await settle(ctx, stats);
    check("S4: pomodoro alarm-fire races favicon — favicon survives", readFavicon(store) === FAVICON_NEW, `favicon=${readFavicon(store)}`);
    check("S4: ...and the phase advanced write survives (work -> break)",
      store.data.activeTask.pomodoroState.phase !== "work", `phase=${store.data.activeTask.pomodoroState.phase}`);
  }

  // ===== S5 — the [1.2.0] focus writers, which R0 never saw ===============
  {
    await seed(ctx, store);
    await Promise.all([WRITERS.focusBlocked(ctx, listeners), WRITERS.faviconExample(ctx, listeners)]);
    await settle(ctx, stats);
    check("S5a: focus blocked-counter races favicon — the counter ticks",
      readBlockedCount(store) === 1, `blocked=${readBlockedCount(store)}`);
    check("S5a: ...and the favicon write survives", readFavicon(store, "s2") === FAVICON_NEW, `favicon=${readFavicon(store, "s2")}`);

    await seed(ctx, store);
    await Promise.all([WRITERS.gateSnooze(ctx, listeners), WRITERS.idle(ctx, listeners)]);
    await settle(ctx, stats);
    check("S5b: gate snooze races an idle transition — the snooze persists", readSnooze(store) === 1, `snoozes=${readSnooze(store)}`);
    check("S5b: ...and the idle stamp survives", readIdleAt(store) !== null, `idleAt=${readIdleAt(store)}`);

    await seed(ctx, store);
    await Promise.all([WRITERS.gateEnd(ctx, listeners), WRITERS.favicon(ctx, listeners)]);
    await settle(ctx, stats);
    check("S5c: gate end-blocking races favicon — the arm is cleared", readArmed(store) === false, `focusArmed=${readArmed(store)}`);
    check("S5c: ...and the favicon write survives", readFavicon(store) === FAVICON_NEW, `favicon=${readFavicon(store)}`);
  }

  // ===== S6 — the full fan-out, five writers at once =======================
  {
    await seed(ctx, store, { phaseExpired: true });
    const baseCount = readShortcutCount(store);
    await Promise.all([
      WRITERS.favicon(ctx, listeners), WRITERS.idle(ctx, listeners), WRITERS.contextAdd(ctx, listeners),
      WRITERS.focusBlocked(ctx, listeners), WRITERS.pomodoro(ctx, listeners),
    ]);
    await settle(ctx, stats);
    check("S6: five writers at once — favicon survives", readFavicon(store) === FAVICON_NEW, `favicon=${readFavicon(store)}`);
    check("S6: five writers at once — idle stamp survives", readIdleAt(store) !== null, `idleAt=${readIdleAt(store)}`);
    check("S6: five writers at once — the shortcut lands", readShortcutCount(store) === baseCount + 1, `count=${readShortcutCount(store)}`);
    check("S6: five writers at once — the blocked counter ticks", readBlockedCount(store) === 1, `blocked=${readBlockedCount(store)}`);
    check("S6: five writers at once — the phase advance survives",
      store.data.activeTask.pomodoroState.phase !== "work", `phase=${store.data.activeTask.pomodoroState.phase}`);
  }

  // ===== STRUCTURAL: no unqueued `data` writer may exist at all ============
  // The suite races the writers it knows about; this catches a NEW one added
  // later that nobody thought to race. Every Storage.saveAll in background.js
  // must sit inside an enqueueBgData job.
  {
    const src = readSubject("background.js");
    const labels = [...src.matchAll(/enqueueBgData\("([^"]+)"/g)].map((m) => m[1]);
    check("STRUCTURAL: background.js still routes through enqueueBgData (>= 12 labelled jobs)",
      labels.length >= 12, `${labels.length} labels: ${labels.join(", ")}`);
    const raced = ["favicon-refresh", "checkout-return", "context-menu-add", "idle-state", "pomodoro-phase", "focus-blocked-count", "focus-gate-snooze", "focus-gate-end"];
    const missing = raced.filter((l) => !labels.includes(l));
    check("STRUCTURAL: every writer this suite races still exists under its label",
      missing.length === 0, `missing: ${missing.join(", ")}`);
  }

  return rows;
}

// --------------------------------------------------------------- mutations
// Q3: each seed neuters the QUEUE for exactly one label and leaves the writer
// running. Every seed carries a writer-still-runs guard, asserted below.
const SEEDS = [
  { name: "un-queue favicon-refresh", label: "favicon-refresh" },
  { name: "un-queue checkout-return", label: "checkout-return" },
  { name: "un-queue context-menu-add", label: "context-menu-add" },
  { name: "un-queue idle-state", label: "idle-state" },
  { name: "un-queue focus-blocked-count ([1.2.0], newer than R0)", label: "focus-blocked-count" },
  { name: "un-queue focus-gate-snooze ([1.2.0], newer than R0)", label: "focus-gate-snooze" },
  {
    name: "QUEUED but handed a PRE-QUEUE snapshot (the subtle one)",
    subtle: true,
    seeds: [{
      file: "background.js",
      find: "  return enqueueBgData(\"favicon-refresh\", async function () {\n  try {\n    var data = await Storage.getAll();",
      replace: "  var __preQueue = Storage.getAll();\n  return enqueueBgData(\"favicon-refresh\", async function () {\n  try {\n    var data = await __preQueue;",
    }],
  },
];

function seedFor(m) {
  if (m.seeds) return m.seeds;
  return [{ file: "background.js", find: `enqueueBgData("${m.label}"`, replace: `__bypassQueue("${m.label}"` }];
}

// A writer-still-runs guard per seed: under the mutation the writer must still
// perform its own effect when run ALONE. A seed that silently deletes the writer
// would turn the suite red for the wrong reason (Q3).
const STILL_RUNS = {
  "favicon-refresh": async (ctx, store, stats, L) => { await seed(ctx, store); await WRITERS.favicon(ctx, L); await settle(ctx, stats); return readFavicon(store) === FAVICON_NEW; },
  "checkout-return": async (ctx, store, stats, L) => { await seed(ctx, store); await WRITERS.checkout(ctx, L); await settle(ctx, stats); return readLicense(store) === "LP-TEST-KEY"; },
  "context-menu-add": async (ctx, store, stats, L) => { await seed(ctx, store); const b = readShortcutCount(store); await WRITERS.contextAdd(ctx, L); await settle(ctx, stats); return readShortcutCount(store) === b + 1; },
  "idle-state": async (ctx, store, stats, L) => { await seed(ctx, store); await WRITERS.idle(ctx, L); await settle(ctx, stats); return readIdleAt(store) !== null; },
  "focus-blocked-count": async (ctx, store, stats, L) => { await seed(ctx, store); await WRITERS.focusBlocked(ctx, L); await settle(ctx, stats); return readBlockedCount(store) === 1; },
  "focus-gate-snooze": async (ctx, store, stats, L) => { await seed(ctx, store); await WRITERS.gateSnooze(ctx, L); await settle(ctx, stats); return readSnooze(store) === 1; },
};

async function runMutations() {
  console.log("\nBG QUEUE — MUTATION SEEDING (red-proof reconstruction)\n");
  console.log("  Each seed neuters the QUEUE for one label; the writer still runs, immediately");
  console.log("  and concurrently — the pre-5451504 shape. ANCHOR-MISS / ANCHOR-AMBIGUOUS are");
  console.log("  reported separately from ESCAPED (BUGS.md Q2/Q3).\n");

  const results = [];
  for (const m of SEEDS) {
    let booted;
    try { booted = boot(seedFor(m)); }
    catch (err) {
      results.push({ name: m.name, status: err.anchor ? "ANCHOR-" + err.anchor : "SUBJECT-BROKEN", detail: err.message, ran: "n/a" });
      continue;
    }
    const { ctx, store, stats, listeners } = booted;

    let ran = "n/a";
    if (m.label && STILL_RUNS[m.label]) {
      try { ran = (await STILL_RUNS[m.label](ctx, store, stats, listeners)) ? "yes" : "NO"; }
      catch (e) { ran = "NO (threw)"; }
    } else if (m.subtle) {
      // The pre-queue-snapshot seed keeps the writer queued AND running; its
      // solo effect must still land, or the seed deleted the writer instead.
      try { await seed(ctx, store); await WRITERS.favicon(ctx, listeners); await settle(ctx, stats); ran = readFavicon(store) === FAVICON_NEW ? "yes" : "NO"; }
      catch (e) { ran = "NO (threw)"; }
    }

    let rows;
    try { rows = await runSuite(ctx, store, stats, listeners); }
    catch (err) { results.push({ name: m.name, status: "SUBJECT-BROKEN", detail: err.message, ran }); continue; }
    const failed = rows.filter((r) => !r.pass);
    results.push({
      name: m.name,
      status: failed.length ? "CAUGHT" : "ESCAPED",
      detail: failed.length ? `${failed.length} check(s), first: ${failed[0].name}` : "suite stayed green — this writer is not protected",
      ran,
    });
  }

  // Q1 control: an unloadable subject must be reported as broken, never scored.
  let control;
  try {
    boot([{ file: "background.js", find: "function enqueueBgData(label, fn) {", replace: "function enqueueBgData(label, fn) { syntax ~ error" }]);
    control = "NOT DETECTED — the runner failed to notice an unloadable subject";
  } catch (err) {
    control = err.anchor ? `NOT DETECTED — control seed did not apply (${err.message})` : "detected as SUBJECT-BROKEN";
  }

  const width = Math.max(...results.map((r) => r.name.length), 20);
  for (const r of results) {
    console.log(`  ${r.status.padEnd(15)} ${r.name.padEnd(width)}  writer still runs: ${String(r.ran).padEnd(4)}  ${r.detail}`);
  }
  console.log(`\n  CONTROL (unloadable subject must not be scored): ${control}`);

  const caught = results.filter((r) => r.status === "CAUGHT").length;
  const faithful = results.every((r) => r.ran === "yes" || r.ran === "n/a");
  const controlOk = control === "detected as SUBJECT-BROKEN";
  const ok = caught === results.length && faithful && controlOk;
  console.log(`\nBG QUEUE MUTATIONS: ${ok ? "PASS" : "FAIL"} — ${caught}/${results.length} caught, all seeds faithful: ${faithful}, control ${controlOk ? "ok" : "BROKEN"}\n`);
  process.exit(ok ? 0 : 1);
}

// -------------------------------------------------------------------- entry
let booted;
try {
  booted = boot();
  if (typeof booted.ctx.enqueueBgData !== "function") throw new Error("background.js does not define enqueueBgData");
  if (typeof booted.ctx.Storage?.saveAll !== "function") throw new Error("Storage.saveAll missing");
  if (!(booted.listeners["tabs.onUpdated"] || []).length) throw new Error("no tabs.onUpdated listeners registered");
} catch (err) {
  console.log("BG QUEUE: SUBJECT DID NOT LOAD — " + (err && err.message));
  process.exit(2);
}

if (MUTATE) { await runMutations(); }
else {
  const { ctx, store, stats, listeners } = booted;
  const rows = await runSuite(ctx, store, stats, listeners);
  let pass = 0, fail = 0;
  console.log("\nBG QUEUE — L1 background-writer serialization\n");
  for (const r of rows) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
    r.pass ? pass++ : fail++;
  }
  // Anti-vacuity floor (BUGS.md P2). R0's recorded suite ran 17 checks.
  const MIN = 17;
  if (rows.length < MIN) {
    console.log(`\nBG QUEUE: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
    process.exit(1);
  }
  console.log(`\nBG QUEUE: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
