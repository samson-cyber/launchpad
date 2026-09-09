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
  const stats = { gets: 0, sets: 0, dataSets: 0, pending: 0, tabsRemoved: [], dataWrites: [] };
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
      stats.sets++;
      if ("data" in o) {
        stats.dataSets++;
        // [1218314553351830] THE PAYLOAD, not just the count. Every assertion in
        // this suite reads the FINAL blob or counts writes, and both are blind to
        // a clobber that a later write repairs. The checkout-return seed escaped
        // for exactly that reason: un-queued, a concurrent favicon write DOES
        // wipe the licence key, and the handler's own second write - a fresh
        // re-read added by e550c75 for an unrelated staleness bug - puts it back
        // before the suite ever looks. Recording each write lets an assertion see
        // the sequence rather than the endpoint.
        const dd = o.data || {};
        stats.dataWrites.push({
          licenseKey: dd.pro ? dd.pro.licenseKey : undefined,
          favicon: (function () {
            try { return dd.workspaces[0].groups[0].shortcuts[0].favicon; } catch (e) { return undefined; }
          })(),
        });
      }
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
      remove: async (id) => { stats.tabsRemoved.push(id); }, create: async () => ({}), sendMessage: async () => ({}),
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
    // Programmable Dodo stand-in. Default: a hard network failure, which is what
    // every scenario except the explicit success ones wants. Scenarios swap
    // ctx.__dodo to drive activate/validate outcomes without a real key.
    fetch: async (url, opts) => {
      await sleep(LATENCY_MS);
      return ctx.__dodo(String(url), opts);
    },
    __dodo: async () => { throw new Error("network unreachable (harness default)"); },
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
    // Default is an already-Pro install. The checkout scenarios override this:
    // a real buyer arrives on the FREE tier with no instanceId and no
    // lastVerifiedAt, and seeding them Pro silently routes ensureValidated down
    // its VALIDATE_DEBOUNCE cached branch, which never calls validate at all —
    // so a "rejected license" fixture would quietly return ok/active and test
    // nothing (Q7: a fixture must produce the state it claims).
    pro: opts.pro || { subscriptionStatus: "active", lastVerifiedAt: Date.now() },
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

    // [1218314553351830] NO INTERMEDIATE CLOBBER, and this is the row that makes
    // the "un-queue checkout-return" seed bite. It had been the suite's one
    // standing ESCAPE.
    //
    // WHY THE OTHER THREE ROWS CANNOT CATCH IT. All of them read the FINAL blob
    // or count writes. Un-queued, the race is:
    //     checkout GET   (no key)
    //     checkout SET   key persisted            <- the guarantee lands
    //     favicon  GET   snapshot taken EARLIER, no key
    //     favicon  SET   key GONE                 <- the clobber
    //     checkout GET   fresh re-read, post-network
    //     checkout SET   key restored             <- healed, before anyone looks
    // Final state correct, write count correct, and a real clobber in the middle.
    // Measured across five network-window widths, 0ms to 120ms: the mutant
    // clobbers in 5 of 5 and the clean subject in 0 of 5, so this separates them
    // deterministically rather than by timing luck.
    //
    // WHY THE INTERMEDIATE STATE IS WORTH ASSERTING, rather than shrugging at a
    // self-healing race. handleCheckoutReturn's own comment states the guarantee
    // the first write exists to provide: the key is on disk BEFORE the Dodo round
    // trip, "if the network call fails, hangs, or the worker dies mid-flight".
    // Un-queued, that key is wiped milliseconds later and only restored IF the
    // job survives the network call - which is precisely the case the first write
    // was written to cover. The healing is real but it is not the guarantee.
    {
      const writes = stats.dataWrites.slice(-(stats.dataSets - before));
      let seenKey = false, clobbers = 0;
      for (const w of writes) {
        if (w.licenseKey) seenKey = true;
        else if (seenKey) clobbers++;
      }
      check("S1: ...and no write DROPS a licence key an earlier write had persisted",
        clobbers === 0,
        `${clobbers} clobber(s) across ${writes.length} writes: ` +
          JSON.stringify(writes.map((w) => (w.licenseKey ? "key" : "-"))));
    }
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

  // ===== S7 — [2.0] the cold-start fold is a `data` writer =================
  //
  // foldClosedBrowserSpanBg mutates activePausedMs, the pause flag and the
  // reopen notice, so it is squarely inside the L1 contract. It also runs at the
  // single busiest moment in the extension's life: onStartup fires the anchor,
  // the sweeps, the purge, the licence re-validation and this, all at once. If
  // it were unqueued, the write it loses is the one that removes the overnight
  // hours — and the user sees the bug this round exists to fix, intermittently,
  // which is worse than seeing it every time.
  {
    await seed(ctx, store);
    const now = ctx.Date.now();
    store.data.activeTask.startedAt = now - 20 * 3600000;
    store.data.activeTask.activePausedMs = 0;
    store.data.trackingPaused = false;
    store.launchpad_heartbeat = { at: now - 18 * 3600000, taskId: store.data.activeTask.taskId };
    const baseCount = readShortcutCount(store);
    // The fold racing the two writers most likely to be in flight beside it.
    await Promise.all([
      ctx.foldClosedBrowserSpanBg(),
      WRITERS.favicon(ctx, listeners),
      WRITERS.contextAdd(ctx, listeners),
    ]);
    await settle(ctx, stats);
    // Windowed, not exact: this harness runs on the real clock and injects
    // latency on purpose, so the fold's own Date.now() lands tens of ms after
    // the seed's. The invariant is "the whole night, and nothing beyond it".
    const folded = store.data.activeTask.activePausedMs;
    check("S7: the fold survives a three-way race — the closed span is deducted",
      folded >= 18 * 3600000 && folded < 18 * 3600000 + 5000, `activePausedMs=${folded}`);
    check("S7: ...and the task comes back paused",
      store.data.trackingPaused === true, `paused=${store.data.trackingPaused}`);
    check("S7: ...and the reopen notice survives the race",
      store.data.activeTask.closedPauseNoticeAt != null, `notice=${store.data.activeTask.closedPauseNoticeAt}`);
    check("S7: ...while the favicon writer beside it also lands",
      readFavicon(store) === FAVICON_NEW, `favicon=${readFavicon(store)}`);
    check("S7: ...and the context-menu shortcut beside it also lands",
      readShortcutCount(store) === baseCount + 1, `count=${readShortcutCount(store)}`);
    check("S7: the spent beat is cleared, so a later launch cannot re-fold it",
      store.launchpad_heartbeat === undefined, `beat=${JSON.stringify(store.launchpad_heartbeat)}`);
  }

  // ===== S8 — [2.0] the HEARTBEAT is deliberately NOT a `data` writer ======
  //
  // The one writer in the file that must stay OUT of the queue, and the reason
  // is not performance-through-laziness: it does not touch `data` at all. It
  // owns launchpad_heartbeat, which nothing else writes and nothing watches.
  // Queueing it would only make a once-a-minute beat wait behind sweeps.
  //
  // The property that matters is asserted BEHAVIOURALLY, not from the source: a
  // beat must leave the `data` blob byte-identical. If someone ever moves the
  // timestamp back onto the activeTask record, this row goes red and the L1
  // contract will demand the queue back.
  {
    await seed(ctx, store);
    store.data.trackingPaused = false;
    const before = JSON.stringify(store.data);
    const dataSetsBefore = stats.dataSets;
    await Promise.all(fire(listeners, "alarms.onAlarm", { name: "active-heartbeat" }));
    await settle(ctx, stats);
    check("S8: a beat leaves the `data` blob byte-identical",
      JSON.stringify(store.data) === before, "data changed");
    check("S8: ...and performs no `data` write at all",
      stats.dataSets === dataSetsBefore, `writes=${stats.dataSets - dataSetsBefore}`);
    check("S8: ...but it DOES stamp its own key",
      store.launchpad_heartbeat && typeof store.launchpad_heartbeat.at === "number",
      JSON.stringify(store.launchpad_heartbeat));
    check("S8: ...stamped with the task it belongs to",
      store.launchpad_heartbeat && store.launchpad_heartbeat.taskId === store.data.activeTask.taskId,
      JSON.stringify(store.launchpad_heartbeat));
    // And the inverse: a beat that fires against a paused task must not claim
    // liveness. The alarm can outlive its condition by one tick.
    store.data.trackingPaused = true;
    await Promise.all(fire(listeners, "alarms.onAlarm", { name: "active-heartbeat" }));
    await settle(ctx, stats);
    check("S8: a beat firing against a PAUSED task clears itself instead of stamping",
      store.launchpad_heartbeat === undefined, JSON.stringify(store.launchpad_heartbeat));
  }

  // ===== S9 — [2.0] banking rides the write it was already making ==========
  //
  // The worked clock's fold is MUTATE-ONLY: it credits task.workedMs and lets
  // clearActiveTask / setActiveTask's own saveAll persist it. That is the
  // property under test here, because the alternative — a second write — would
  // put an unqueued `data` cycle on the deactivation path, which is exactly the
  // L1 clobber shape. Asserted by counting WRITES, not by reading the source.
  {
    await seed(ctx, store);
    // The seed blob ships no tasks; this suite needs one to credit.
    store.data.workspaces[0].tasks = [{ id: "wt1", name: "Worked clock", displayOrder: 1 }];
    store.data.activeTask = {
      taskId: "wt1", workspaceId: store.data.workspaces[0].id,
      startedAt: ctx.Date.now() - 3600000, activePausedMs: 0, pausedAt: null,
      pausedMs: 0, idleAt: null, idleMs: 0
    };
    store.data.trackingPaused = false;
    const before = stats.dataSets;
    const d = await ctx.Storage.getAll();
    await ctx.Storage.clearActiveTask(d);
    await settle(ctx, stats);
    check("S9: deactivating costs exactly ONE `data` write, banking included",
      stats.dataSets - before === 1, `writes=${stats.dataSets - before}`);
    const banked = store.data.workspaces[0].tasks[0].workedMs;
    check("S9: ...and the span really landed in that write",
      banked >= 3600000 && banked < 3600000 + 60000, `workedMs=${banked}`);
    check("S9: ...and the activation ended in the same write", store.data.activeTask === null);
  }

  // ===== CHECKOUT-RETURN TAB DISCIPLINE ===================================
  //
  // Lives in THIS file rather than a seventh gate because it drives the very
  // same writer through the very same fake chrome — the checkout-return job is
  // already booted, raced and seeded here, and the property under test is
  // "write-work queued, TAB-WORK OUTSIDE, and only on success". A separate file
  // would duplicate the whole VM boot for four assertions.
  //
  // THE BUG THIS PINS: the close used to sit in a `finally`, so EVERY path took
  // it — no key, empty key, unparseable URL, rejected license, Dodo outage,
  // thrown handler. Shipped in v1.0.5. The post-purchase page was unviewable on
  // any machine with the extension installed, and a buyer whose activation
  // failed lost their fallback instructions with the tab.
  const dodoOk = async (url) => ({
    ok: true, status: url.includes("/activate") ? 201 : 200,
    json: async () => (url.includes("/activate") ? { id: "inst_harness" } : { valid: true }),
  });
  const dodoRejects = async (url) => ({
    ok: true, status: url.includes("/activate") ? 201 : 200,
    json: async () => (url.includes("/activate") ? { id: "inst_harness" } : { valid: false }),
  });
  const fireCheckout = (query) => Promise.all(fire(listeners, "tabs.onUpdated",
    77, { url: "https://mylaunchpad.me/checkout-return" + query }, { id: 77, url: "https://mylaunchpad.me/checkout-return" + query }));
  {
    // (a) KEYLESS visit — the organic visit, and the replaceState refire after a
    // real activation (the site scrubs the key from the URL, which fires
    // tabs.onUpdated a second time with no license_key).
    await seed(ctx, store);
    stats.tabsRemoved = [];
    const beforeWrites = stats.dataSets;
    await fireCheckout("");
    await settle(ctx, stats);
    check("CHECKOUT (a) keyless visit does NOT close the tab", stats.tabsRemoved.length === 0, `removed=${JSON.stringify(stats.tabsRemoved)}`);
    check("CHECKOUT (a) keyless visit writes nothing", stats.dataSets === beforeWrites, `writes=${stats.dataSets - beforeWrites}`);

    // (b) KEY PRESENT, activation FAILS (Dodo unreachable). The buyer keeps the
    // page — it carries their key, their manual steps and the support address.
    await seed(ctx, store, { pro: {} });
    stats.tabsRemoved = [];
    ctx.__dodo = async () => { throw new Error("network unreachable"); };
    await fireCheckout("?license_key=GARBAGE-KEY&email=x%40y.z");
    await settle(ctx, stats);
    check("CHECKOUT (b) failed activation does NOT close the tab", stats.tabsRemoved.length === 0, `removed=${JSON.stringify(stats.tabsRemoved)}`);
    check("CHECKOUT (b) ...but the key IS still persisted (Pro Settings retry path)",
      readLicense(store) === "GARBAGE-KEY", `license=${readLicense(store)}`);

    // (c) THE SHARP EDGE: Dodo ANSWERS, and answers no. ensureValidated returns
    // ok:true with status 'invalid' here — "the call succeeded", not "the buyer
    // is activated". Closing on result.ok alone would slam the page shut on
    // exactly the buyer whose key was REJECTED.
    await seed(ctx, store, { pro: {} });
    stats.tabsRemoved = [];
    ctx.__dodo = dodoRejects;
    await fireCheckout("?license_key=REJECTED-KEY");
    await settle(ctx, stats);
    check("CHECKOUT (c) a REJECTED license (ok:true, status invalid) does NOT close the tab",
      stats.tabsRemoved.length === 0, `removed=${JSON.stringify(stats.tabsRemoved)} status=${store.data.pro?.subscriptionStatus}`);

    // (d) The success path still closes — the fix must not break the thing that
    // worked. Driven entirely through the fake Dodo, so no real key is involved.
    await seed(ctx, store, { pro: {} });
    stats.tabsRemoved = [];
    ctx.__dodo = dodoOk;
    await fireCheckout("?license_key=GOOD-KEY&email=buyer%40example.com");
    await settle(ctx, stats);
    check("CHECKOUT (d) a CONFIRMED activation DOES close the tab", stats.tabsRemoved.length === 1 && stats.tabsRemoved[0] === 77,
      `removed=${JSON.stringify(stats.tabsRemoved)}`);
    check("CHECKOUT (d) ...and Pro is actually live (status active, email stored)",
      store.data.pro?.subscriptionStatus === "active" && store.data.pro?.email === "buyer@example.com",
      `status=${store.data.pro?.subscriptionStatus} email=${store.data.pro?.email}`);

    ctx.__dodo = async () => { throw new Error("network unreachable (harness default)"); };
  }

  // ===== CROSS-REPO COUPLING: the checkout redirect_url round trip ========
  //
  // The extension builds the Dodo checkout URL with a redirect_url pointing at
  // the website's post-purchase page; background.js then has to RECOGNISE that
  // page when the buyer lands on it. Two repos, one string, and it has broken
  // once already (07f979e, bug 1215525319408075). So this asserts the round
  // trip rather than trusting it: pull the URL the page actually builds out of
  // newtab.js, decode the redirect_url it carries, and run it through the REAL
  // isCheckoutReturnUrl from background.js.
  {
    const nt = readSubject("newtab.js");
    const base = nt.match(/var DODO_CHECKOUT_BASE = "([^"]+)"/)?.[1];
    const ret = nt.match(/var DODO_RETURN_URL = "([^"]+)"/)?.[1];
    const builder = nt.match(/return DODO_CHECKOUT_BASE \+ pdtId \+\n\s*"([^"]+)" \+ encodeURIComponent\(DODO_RETURN_URL\);/)?.[1];
    check("COUPLING: newtab.js still builds the checkout URL from base + product + redirect_url",
      !!base && !!ret && !!builder, `base=${base} return=${ret} tail=${builder}`);

    if (base && ret && builder) {
      const built = base + "pdt_TEST" + builder + encodeURIComponent(ret);
      const decoded = new URL(built).searchParams.get("redirect_url");
      check("COUPLING: redirect_url is URL-ENCODED in the checkout URL",
        built.includes(encodeURIComponent(ret)) && !built.includes("?quantity=1&redirect_url=https://"),
        built);
      check("COUPLING: it decodes back to the exact return URL", decoded === ret, `decoded=${decoded}`);
      check("COUPLING: and background.js's REAL matcher accepts that URL",
        ctx.isCheckoutReturnUrl(decoded) === true, `isCheckoutReturnUrl(${decoded}) = ${ctx.isCheckoutReturnUrl(decoded)}`);
      check("COUPLING: the .html variant the matcher also accepts still resolves",
        ctx.isCheckoutReturnUrl(decoded + ".html") === true, `${decoded}.html`);
      // Negative control: the matcher is host-scoped, so a look-alike host must
      // NOT satisfy it. Without this, "accepts that URL" could pass against a
      // matcher that accepts everything.
      check("COUPLING: negative control — a look-alike host is NOT accepted",
        ctx.isCheckoutReturnUrl("https://notmylaunchpad.me/checkout-return") === false);
    }
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

  // ===== L5 PAGE-SIDE WRITE ADOPTION =====================================
  // The page half of this file's subject. L1 serializes background writers;
  // nothing serializes page writers, and a writer that reads its OWN snapshot
  // (addShortcut and five like it, bookmarks.js importSelected) leaves the
  // page's module `data` superseded. saveAll now hands the persisted object
  // back to a registered page callback so the call site cannot forget.
  //
  // THIS IS DELIBERATELY A SHAPE ASSERTION, NOT A BEHAVIOURAL ONE. The
  // behavioural proof is the browser race (drive the control, then drive a
  // second control that saves the shared `data`, assert the first write
  // survives) and it lives outside this DOM-less harness. What is worth
  // pinning here is exactly what the survey proved is easy to get wrong:
  // "is the hook wired at all", which is a far cheaper question than
  // distinguishing a pre-write re-read from a post-write refresh - the
  // distinction that produced three false positives in that survey.
  {
    const st = readSubject("storage.js");
    const nt = readSubject("newtab.js");

    check("L5: the page REGISTERS a write-adoption callback",
      /Storage\.onWriteAdopt\(\s*function\s*\([\w$]+\)\s*\{[^}]*\bdata\s*=/.test(nt));

    check("L5: storage.js EXPORTS onWriteAdopt",
      /onWriteAdopt:\s*onWriteAdopt/.test(st));

    // Invocation must sit INSIDE saveAll and AFTER the awaited set, so nothing
    // adopts an object that failed to persist.
    const saveAllBody = (st.match(/async function saveAll\(data\)[\s\S]*?\n  \}/) || [""])[0];
    check("L5: saveAll INVOKES the callback with the object it persisted",
      /_adoptWrite\(\s*data\s*\)/.test(saveAllBody));
    check("L5: it invokes AFTER the awaited storage write, not before",
      /await chrome\.storage\.local\.set\([\s\S]*?_adoptWrite\(/.test(saveAllBody));

    // The service worker imports this file and registers nothing. If the call
    // were unguarded, every background write would throw on a null callback.
    check("L5: the callback is OPTIONAL, so the service worker is unaffected",
      /if\s*\(_adoptWrite\)/.test(saveAllBody) && /var _adoptWrite = null/.test(st));

    // A page-side throw must not fail a write that already succeeded.
    check("L5: a throwing adopter cannot fail the write that already landed",
      /_adoptWrite\(\s*data\s*\)[\s\S]{0,120}catch/.test(saveAllBody));

    // background.js must NOT register - that would let a background write
    // reach into a page's snapshot, which is the opposite of the intent.
    check("L5: background.js registers no adopter",
      !/onWriteAdopt/.test(readSubject("background.js")));
  }

  // ===== CAPTURE-TIME REFERENCE WINDOWS ==================================
  // A writer that YIELDS between capturing the object it saves and saving it
  // persists a superseded snapshot, discarding everything written during the
  // suspension. reconcilePomodoro did exactly that: `var fresh = await
  // getAll()` is a real yield and it then saved the CAPTURE-TIME `data`.
  // Reproduced through driven controls and fixed by saving `fresh`.
  //
  // WHY THESE ASSERTIONS ARE NAMED RATHER THAN GENERAL. The general form -
  // "no writer yields between capture and save" - was prototyped over 173
  // saveAll sites and flagged 6, of which 2 were FALSE POSITIVES: saves sitting
  // in mutually exclusive branches, where the "intervening await" is another
  // branch's own save and can never run on the same path. Distinguishing those
  // needs real control-flow analysis, and a hand-rolled approximation that is
  // wrong a third of the time is the P8 hazard - a parser confident enough to
  // be believed. So the general gate is deferred to a real parser, and what is
  // pinned here are the three specific invariants that carry the safety today.
  {
    const st = readSubject("storage.js");
    const fnBody = (name) => {
      const m = st.match(new RegExp("async function " + name + "\\([^)]*\\)[\\s\\S]*?\\n  \\}"));
      return m ? m[0] : "";
    };
    const beforeFirstSave = (body) => {
      const i = body.search(/await saveAll\(/);
      return i === -1 ? null : body.slice(0, i);
    };

    // 1 + 2. The two sweeps are safe ONLY because they never suspend before
    // their save: called un-awaited, they run to completion synchronously and
    // the write is initiated in the same block, so nothing can interleave.
    // One added await silently opens the window.
    for (const name of ["purgeExpiredTrash", "runRecurringSweep"]) {
      const body = fnBody(name);
      const head = beforeFirstSave(body);
      check(`${name}: NO await before its saveAll (un-awaited callers depend on this)`,
        !!head && !/\bawait\b/.test(head),
        head === null ? "no saveAll found" : "awaits: " + (head.match(/\bawait\b/g) || []).length);
    }

    // 3. reconcilePomodoro DOES yield - it must therefore save the object it
    // captured AFTER that yield, never the one it was handed.
    const rp = fnBody("reconcilePomodoro");
    check("reconcilePomodoro: saves the POST-yield object (fresh), not the capture-time one",
      /await saveAll\(\s*fresh\s*\)/.test(rp) && !/await saveAll\(\s*data\s*\)/.test(rp));
    check("reconcilePomodoro: applies the new phase to the fresh object it saves",
      /freshActive\.pomodoroState\s*=\s*nextPs/.test(rp));
  }

  // ===== CAPTURE-TIME WINDOWS ACROSS A NETWORK CALL =====================
  // The licence writers capture `data` at the head of their queued job and
  // then make a NETWORK round trip - hundreds of ms to seconds - before
  // saving. Writing the capture-time object back discarded everything the page
  // wrote in that window. enqueueBgData does not help: it serialises background
  // writers against each other, and the competing writer is the page.
  //
  // Reproduced through the real trigger (a tab navigating to the checkout
  // return URL) with the licence response stubbed slow, and a shortcut added
  // through the add-shortcut modal inside the window.
  //
  // The transplant is exact because license.js touches nothing outside
  // `data.pro` - so these assertions pin BOTH halves: a fresh read, and the pro
  // block carried onto it. Either alone would be wrong.
  {
    const bg = readSubject("background.js");
    const jobBody = (label) => {
      const i = bg.indexOf(`enqueueBgData("${label}"`);
      if (i === -1) return "";
      return bg.slice(i, i + 3000);
    };

    const rev = jobBody("license-revalidate");
    check("revalidateLicenseBg: re-reads AFTER the network call before saving",
      /var freshLic = await Storage\.getAll\(\)/.test(rev) &&
      /await Storage\.saveAll\(\s*freshLic\s*\)/.test(rev));
    check("revalidateLicenseBg: carries the pro block onto the fresh object",
      /freshLic\.pro\s*=\s*data\.pro/.test(rev));

    const ck = jobBody("checkout-return");
    check("handleCheckoutReturn: its POST-NETWORK save uses a fresh object",
      /ensureValidated\([\s\S]{0,600}?var freshCk = await Storage\.getAll\(\)/.test(ck) &&
      /await Storage\.saveAll\(\s*freshCk\s*\)/.test(ck));
    check("handleCheckoutReturn: carries the pro block onto the fresh object",
      /freshCk\.pro\s*=\s*data\.pro/.test(ck));
  }

  // foldClosedBrowserSpan was AUDITED AND FOUND SAFE rather than fixed, and it
  // is safe for one reason only: its own saveAll runs solely on the `!wrote`
  // branch, and setTrackingPaused can return false only from two synchronous
  // guards, before any I/O. So on the single path that reaches the outer save,
  // nothing yielded to the event loop. Make that load-bearing property
  // explicit - an unconditional save here would open a real window.
  {
    const st = readSubject("storage.js");
    const m = st.match(/async function foldClosedBrowserSpan\([\s\S]*?\n  \}/);
    const body = m ? m[0] : "";
    check("foldClosedBrowserSpan: its own save stays on the !wrote branch",
      /if \(!wrote\)\s*await saveAll\(data\)/.test(body));
  }

  // ===== [1.8.2] HOURLY CAPTURE ORDERING ==================================
  // The hourly bucket is written by the rollup AND, once, by a backfill over
  // the raw window. The two must cover DISJOINT sets or every backfilled
  // session is counted twice, and the only thing separating them is the
  // `aggregated` stamp plus the order they run in. Nothing else enforces it,
  // and a double-counted heatmap looks exactly like a busy one.
  //
  // These are shape assertions; the behavioural proof is the capture harness
  // (200 random sessions reconciling, a session driven across midnight AND an
  // hour boundary, the backfill run twice).
  {
    const tr = readSubject("tracking.js");

    check("[1.8.2] the day aggregate declares byHour",
      /byHour:\s*\{\}/.test(tr) && /function emptyDay\([\s\S]{0,900}?byHour/.test(tr));

    // The hour boundary must walk the local clock, exactly as the day boundary
    // does. A fixed +3600000 step smears an hour into the wrong slot at DST.
    const nextHour = (tr.match(/function startOfNextLocalHour\([\s\S]*?\n  \}/) || [""])[0];
    check("[1.8.2] the hour boundary steps via Date.setHours, not a fixed +3600000",
      /setHours\(\s*d\.getHours\(\)\s*\+\s*1\s*\)/.test(nextHour) &&
      !/3600000|60\s*\*\s*60\s*\*\s*1000/.test(nextHour));

    const bf = (tr.match(/function backfillHourly\([\s\S]*?\n  \}/) || [""])[0];
    check("[1.8.2] the backfill is ONE-TIME guarded",
      /if \(store\.hourlyBackfilledAt\) return false/.test(bf) &&
      /store\.hourlyBackfilledAt = Date\.now\(\)/.test(bf));
    check("[1.8.2] the backfill SKIPS unstamped sessions (the rollup owns those)",
      /if \(!sess\.aggregated\) return;/.test(bf));
    check("[1.8.2] the backfill anchors hourlyKnownFrom to the OLDEST record, not now",
      /store\.hourlyKnownFrom = oldest/.test(bf) && !/hourlyKnownFrom = Date\.now/.test(bf));

    // Order inside the pass: backfill must be invoked BEFORE the rollup.
    const pass = (tr.match(/async function rollupAndPruneInner\([\s\S]*?\n  \}/) || [""])[0];
    const iBackfill = pass.indexOf("backfillHourly(store, days)");
    const iRollup = pass.indexOf("rollupUnaggregated(store, days");
    check("[1.8.2] backfillHourly runs BEFORE rollupUnaggregated in the pass",
      iBackfill !== -1 && iRollup !== -1 && iBackfill < iRollup,
      "backfill@" + iBackfill + " rollup@" + iRollup);

    // The backfill mutates `days` without stamping anything, so a persist
    // conditioned only on `rolled` would compute its work and drop it.
    check("[1.8.2] the pass persists `days` when the hourly backfill touched them",
      /persist\(store, \(rolled \|\| hourly\) \? days : null\)/.test(pass));
  }

  // ===== [1.9.2] THE FOCUS BADGE ==========================================
  //
  // DECISION 6 IS A DOCTRINE, AND A DOCTRINE WITH NO GATE IS A PREFERENCE.
  // The badge is visible on every page the user visits, so "shows nothing when
  // nothing is running" has to be enforced by something other than care.
  //
  // These are STATIC reads of background.js. reconcileBadge itself needs a
  // chrome.action and a live storage, which this harness deliberately does not
  // fake - the runtime behaviour is covered by the round's service-worker
  // driver. What is pinned here is the SHAPE that makes the doctrine true:
  // the derivation is pure and reachable, the absent state is the empty string,
  // and the entitlement gate is the canonical one.
  {
    const BG = readSubject("background.js");

    check("[1.9.2] the badge derivation exists and is PURE (a named function taking state)",
      /function desiredBadge\(state\)/.test(BG));
    check("[1.9.2] it is fed by a state-collapsing reader, like every other reconcile here",
      /function badgeStateFromData\(data, now\)/.test(BG));
    check("[1.9.2] the painter exists",
      /async function reconcileBadge\(\)/.test(BG));

    // THE DOCTRINE, three ways. Absent must be the EMPTY STRING - not "0", not
    // a dot, not a colour with no text.
    check("[1.9.2] DOCTRINE: the absent state is the empty string",
      /var ABSENT = \{ text: "", bg: null, ink: null \};/.test(BG));
    check("[1.9.2] DOCTRINE: no Pro access -> absent, before anything else is considered",
      /if \(!state\.pro\) return ABSENT;/.test(BG));
    // [1.9.2 fix] THE DOCTRINE'S BOUNDARY MOVED, and this assertion moved with it.
    // It used to pin "no PHASE -> absent", which was the defect: a session with
    // no Pomodoro is still a session and the badge showed nothing for it. What
    // must hold is "no ACTIVE TASK -> absent" - that is the state a user is in
    // most of the time and the one decision 6 is actually about.
    check("[1.9.2 fix] DOCTRINE: no active task -> absent",
      /if \(!state\.hasActiveTask\) return ABSENT;/.test(BG));
    check("[1.9.2 fix] an UNBOUNDED session (no phase) still paints, counting up",
      /var elapsed = state\.elapsedMs;[\s\S]{0,200}?Math\.floor\(elapsed \/ 60000\)/.test(BG));
    check("[1.9.2 fix] ...from the PILL'S elapsed maths, shared through Storage",
      /elapsedMs: Storage\.activeElapsedMs\(data, ref\)/.test(BG));
    // ORDER IS THE PROPERTY, so it is asserted by position rather than by a
    // regex spanning both: the paused branch must come BEFORE the phase branch,
    // which is what makes a paused session show the mark whether or not a
    // Pomodoro bounds it. Samson's session had no Pomodoro and showed nothing.
    {
      const pausedAt = BG.indexOf("if (state.paused) return { text:");
      const phaseAt = BG.indexOf("if (state.phase && state.phaseEndsAt != null)");
      const activeAt = BG.indexOf("if (!state.hasActiveTask) return ABSENT;");
      check("[1.9.2 fix] paused is checked BEFORE the phase, so it covers both kinds of session",
        pausedAt > 0 && phaseAt > 0 && pausedAt < phaseAt, `paused@${pausedAt} phase@${phaseAt}`);
      check("[1.9.2 fix] ...and the active-task gate comes before both",
        activeAt > 0 && activeAt < pausedAt, `active@${activeAt} paused@${pausedAt}`);
    }
    check("[1.9.2] DOCTRINE: a phase past its end -> absent, not a stale number",
      /if \(!\(remaining > 0\)\) return ABSENT;/.test(BG));

    // The gate must be the canonical one, or a `grace` customer loses the badge.
    check("[1.9.2] the entitlement gate is ProAccess.hasProAccess, not a hand-written set",
      /pro: ProAccess\.hasProAccess\(data\)/.test(BG));

    // Mechanism (b): the event half must be wired to the SAME onChanged the
    // other reconciles use, or the badge and the pill drift apart.
    const onChangedBlock = BG.slice(BG.indexOf("chrome.storage.onChanged.addListener"));
    check("[1.9.2] mechanism (b): the badge repaints on the same `data` onChanged the pill's source uses",
      /reconcilePomodoroAlarm\(\);[\s\S]{0,600}?reconcileBadge\(\);/.test(onChangedBlock));
    check("[1.9.2] ...and on startup, so a badge left painted by a dead browser is corrected",
      /chrome\.runtime\.onStartup[\s\S]*?reconcileBadge\(\);/.test(BG));
    check("[1.9.2] ...and the tick alarm is dispatched",
      /alarm\.name === BADGE_ALARM[\s\S]{0,400}?reconcileBadge\(\);/.test(BG));

    // The alarm must NOT run when there is nothing counting down: a badge that
    // wakes the service worker every 30s forever is a background process, not a
    // badge.
    check("[1.9.2] the tick alarm is cleared whenever the badge is not counting down",
      /if \(!ticking\) \{[\s\S]{0,200}?chrome\.alarms\.clear\(BADGE_ALARM\)/.test(BG));

    // Paused is a mark, not a number, and it is the shipped amber.
    check("[1.9.2] paused paints a mark rather than a number",
      /if \(state\.paused\) return \{ text: "\\u23F8"/.test(BG));
    check("[1.9.2] ...in the shipped --sat-amber",
      /var BADGE_AMBER = "#F1C40F";/.test(BG));
    check("[1.9.2] amber carries DARK ink (white on amber measures 1.66:1)",
      /var BADGE_INK_ON_AMBER = "#202124";/.test(BG));

    // NEGATIVE CONTROL for this block: the patterns must actually be capable of
    // failing. If desiredBadge were renamed, every check above would silently
    // stop matching and report nothing - so assert the source is non-trivial.
    check("[1.9.2] anti-vacuity: background.js was actually read",
      BG.length > 10000 && BG.includes("BADGE_ALARM"), `len=${BG.length}`);
  }

  // ===== [1.9.3] KEYBOARD COMMANDS =========================================
  //
  // Static reads of background.js and manifest.json. The runtime behaviour is
  // covered by the round's service-worker driver, which drives every command
  // through runCommand in a two-window profile. What is pinned here is the
  // wiring that driver cannot protect from drift: the manifest and the
  // dispatcher agreeing on names, and the two decisions that were WRONG on the
  // first run of that driver and would look fine again if reverted.
  {
    const BG = readSubject("background.js");
    const MAN = JSON.parse(readSubject("manifest.json"));
    const cmds = MAN.commands || {};
    const names = Object.keys(cmds);

    check("[1.9.3] the manifest declares the four commands",
      names.length === 4 && ["open-launchpad", "add-current-page",
        "save-window-as-session", "toggle-focus-pause"].every(function (n) {
          return names.indexOf(n) !== -1; }), JSON.stringify(names));

    // EVERY NAME MUST BE DISPATCHED. A command in the manifest with no branch
    // in runCommand appears on chrome://extensions/shortcuts, accepts a
    // binding, and then does nothing when pressed - a dead key the user has to
    // diagnose.
    for (const n of names) {
      check("[1.9.3] `" + n + "` is dispatched by runCommand",
        BG.indexOf('name === "' + n + '"') !== -1);
    }
    // ...AND THE CONVERSE. A branch with no manifest entry is unreachable: it
    // can never be pressed, so it is dead code that reads as a shipped feature.
    // SCOPED TO runCommand'S OWN BODY. A file-wide scan for `name === "..."`
    // also catches the runtime-message router, which speaks a different
    // vocabulary - it matched "save-session" and failed this check on a correct
    // tree the first time it ran.
    const rcAt = BG.indexOf("async function runCommand(name, tab)");
    const rcBody = rcAt > 0 ? BG.slice(rcAt, BG.indexOf("self.runCommand = runCommand;")) : "";
    const branches = (rcBody.match(/name === "[a-z-]+"/g) || [])
      .map(function (m) { return m.slice(10, -1); });
    check("[1.9.3] ...and no dispatch branch is unreachable from the manifest",
      rcBody.length > 100 && branches.length === names.length &&
      branches.every(function (b) { return names.indexOf(b) !== -1; }),
      JSON.stringify(branches));

    // NO SUGGESTED KEYS. Chrome caps suggested_key at FOUR commands and a
    // manifest with five DOES NOT LOAD AT ALL, so shipping four would leave the
    // next command added one line from breaking the whole extension.
    check("[1.9.3] no command ships a suggested_key",
      names.every(function (n) { return !cmds[n].suggested_key; }),
      JSON.stringify(names.filter(function (n) { return !!cmds[n].suggested_key; })));
    // Every command needs a description or its row on the shortcuts page is
    // blank and the user cannot tell what they are binding.
    check("[1.9.3] every command carries a description for the shortcuts page",
      names.every(function (n) { return typeof cmds[n].description === "string"
        && cmds[n].description.length > 0; }));

    // DEFECT 1, FOUND BY DRIVING IT. currentWindow is a PAGE idiom; a service
    // worker is in no window, so Chrome degrades it to the last focused one and
    // the command acts on the wrong window. onCommand hands the listener the
    // tab the key fired on; that argument must reach both commands that need it.
    check("[1.9.3] the onCommand listener takes the TAB Chrome passes it",
      /onCommand\.addListener\(function \(name, tab\) \{ runCommand\(name, tab\); \}\)/.test(BG));
    check("[1.9.3] ...and the dispatcher carries it through",
      /async function runCommand\(name, tab\)/.test(BG));
    check("[1.9.3] ...to add-current-page",
      /if \(name === "add-current-page"\) return await cmdAddCurrentPage\(tab\);/.test(BG));
    check("[1.9.3] ...and to save-window-as-session",
      /if \(name === "save-window-as-session"\) return await cmdSaveWindowAsSession\(tab\);/.test(BG));
    check("[1.9.3] save-window-as-session scopes by the KEYSTROKE'S windowId",
      /\{ windowId: cmdTab\.windowId \}/.test(BG));
    check("[1.9.3] no command re-introduces the currentWindow page idiom",
      BG.indexOf("cmdAddCurrentPage") !== -1 &&
      !/cmdAddCurrentPage[\s\S]{0,400}currentWindow/.test(BG) &&
      !/cmdSaveWindowAsSession[\s\S]{0,400}currentWindow/.test(BG));

    // DEFECT-SHAPE 2. The add path must REUSE the right-click menu's builder,
    // not carry a second copy of the rules about which URLs are addable.
    check("[1.9.3] the shortcut record builder is shared with the context menu",
      /function buildShortcutRecord\(info, tab\)/.test(BG));
    check("[1.9.3] ...and the context menu calls it rather than inlining the rules",
      /var shortcut = buildShortcutRecord\(info, tab\);/.test(BG));
    check("[1.9.3] ...and so does the command",
      /var shortcut = buildShortcutRecord\(\{ pageUrl: tab\.url \}, tab\);/.test(BG));
    check("[1.9.3] the session capture allowlist is Storage's, not a worker copy",
      /Storage\.isCapturableSessionUrl\(t\.url\)/.test(BG) &&
      !/SESSION_ALLOWED_SCHEMES/.test(BG));
    check("[1.9.3] the newest-leads ordering is Storage's, not per-caller",
      /Storage\.createNamedSessionAtFront\(/.test(BG));

    // THE PRO GATE. Canonical, and silent.
    check("[1.9.3] the gated command gates on ProAccess.hasProAccess",
      /if \(!ProAccess\.hasProAccess\(data\)\) \{ result = \{ skipped: "not-pro" \}; return; \}/.test(BG));
    check("[1.9.3] ...and FAILS SILENTLY: no gated command opens a tab or notifies",
      !/cmdToggleFocusPause[\s\S]{0,900}?(chrome\.tabs\.create|chrome\.notifications|openUpgrade)/.test(BG));

    // THE DECISION: with no active task it writes NOTHING. The driver's D1b
    // proved a mutant that toggled the global flag here still returned the
    // right-looking skip code, so the return value alone does not pin this.
    {
      const at = BG.indexOf('result = { skipped: "no-active-task" }');
      const gate = BG.indexOf("if (!Storage.getActiveTask(data))");
      const seg = gate > 0 ? BG.slice(gate, at + 60) : "";
      check("[1.9.3] no active task -> returns without writing anything",
        gate > 0 && at > gate && !/setTrackingPaused|saveAll/.test(seg), seg.length + " chars");
    }
    // Every write still goes through the FIFO, which is what this whole file is about.
    check("[1.9.3] both writing commands go through enqueueBgData",
      /enqueueBgData\("command-save-session"/.test(BG) &&
      /enqueueBgData\("command-focus-toggle"/.test(BG));

    check("[1.9.3] anti-vacuity: the manifest and background.js were actually read",
      names.length > 0 && BG.indexOf("runCommand") !== -1, `cmds=${names.length} len=${BG.length}`);
  }

  // ===== [1.9.4] THE COMPANION POPUP =======================================
  //
  // Static reads. The runtime behaviour is covered by the round's popup driver,
  // which renders every state and drives the pause control through the view the
  // shell mounted. What is pinned here is what that driver cannot protect from
  // drift, plus the two traps this round actually fell into.
  {
    const CJ = readSubject("companion.js");
    const CP = readSubject("companion-popup.js");
    const CC = readSubject("companion.css");
    const TK = readSubject("tokens.css");
    const NC = readSubject("newtab.css");

    // FINDING 2. The hero is the ACTIVATION STOPWATCH, from Storage, in the
    // pill's form. It led with the engine's focused-today figure, which is
    // honestly zero whenever the engine has seen no trackable time - so the
    // popup's headline was a zero while a real session ran.
    check("[1.9.4] the popup's hero is the activation stopwatch, not the engine figure",
      /hero = Storage\.fmtStopwatch\(liveActiveMs\(st, now\)\)/.test(CJ));
    check("[1.9.4] ...and the TICK repaints it from the same pair",
      /Storage\.fmtStopwatch\(liveActiveMs\(state, now\)\)/.test(CJ));
    check("[1.9.4] the stopwatch FORMATTER is shared with the pill, not re-implemented",
      /function fmtStopwatch\(ms\)/.test(readSubject("storage.js")) &&
      /function satFmtStopwatch\(ms\) \{ return Storage\.fmtStopwatch\(ms\); \}/.test(readSubject("newtab.js")));
    check("[1.9.4] ...and the ELAPSED reader is Storage's, so pill, popup and badge agree",
      /Storage\.activeElapsedMs\(data\)/.test(CJ));
    // The two number FAMILIES must stay separately labelled. newtab.js's
    // vocabulary law: "focused" belongs to the engine and never labels a
    // wall-clock.
    check("[1.9.4] the hero label names the QUANTITY and does not switch on pause",
      /heroLabel = t\("companion_active"\);/.test(CJ));
    check("[1.9.4] ...so the state word is said ONCE, by the head",
      !/heroLabel = st\.paused/.test(CJ));
    check("[1.9.4] focused-today is still rendered, subordinate, with its own label",
      /data-cmp-focused/.test(CJ) && /companion_focused_today/.test(CJ));

    // FINDING 3. ONE pause path. A second one is the defect this arc found twice
    // and it is invisible from the surface: the flag flips either way, and only
    // the writer's side effects (the pause stamp, the resume shift, the counter
    // accounting) tell them apart.
    check("[1.9.4] the pause control calls the SHARED writer",
      /await Storage\.setTrackingPaused\(fresh, action === "pause"\)/.test(CJ));
    check("[1.9.4] ...and never assigns the flag directly",
      !/\.trackingPaused\s*=/.test(CJ));
    check("[1.9.4] ...re-reading `data` at the point of write, not trusting the open-time read",
      /var fresh = await Storage\.getAll\(\);[\s\S]{0,120}setTrackingPaused/.test(CJ));
    check("[1.9.4] the destructive-adjacent controls are NOT on this surface",
      !/data-cmp-act="(complete|end|switch|cancel)"/.test(CJ));

    // FINDING 1. One route, in every state, built the canonical way.
    check("[1.9.4] the route opens the extension's OWN page, not the new tab override",
      /chrome\.tabs\.create\(\{ url: chrome\.runtime\.getURL\("newtab\.html"\) \}\)/.test(CJ));
    check("[1.9.4] ...and it is offered in the LOCKED state",
      /cmp-locked-text[\s\S]{0,200}?routeHtml\(\)/.test(CJ));
    check("[1.9.4] ...and in the EMPTY state",
      /cmp-empty-row[\s\S]{0,600}?routeHtml\(\)/.test(CJ));
    check("[1.9.4] ...and beside the pause control while a session runs",
      /data-cmp-act="open"/.test(CJ) && /function actionsHtml\(st\)/.test(CJ));

    // FINDING 5. ONE amber signal per surface.
    {
      const cardAmber = (NC.match(/\.sat-expanded\.is-paused[^{]*\{[^}]*--sat-amber[^}]*\}/g) || []);
      check("[1.9.4] the pill's paused CARD carries exactly one amber rule",
        cardAmber.length === 1, JSON.stringify(cardAmber));
      check("[1.9.4] ...on the hero LABEL, not on either numeral",
        cardAmber.length === 1 && /sat-hero-label/.test(cardAmber[0]) &&
        !/sat-hero-time|sat-time\b/.test(cardAmber[0]), JSON.stringify(cardAmber));
      check("[1.9.4] the Resume button is no longer tinted amber",
        !/\.sat-btn-resume\s*\{/.test(NC));
      const slim = (NC.match(/#active-task-pill\.is-paused[^{]*\{[^}]*--sat-amber[^}]*\}/g) || []);
      check("[1.9.4] the SLIM pill carries exactly one amber rule, on the glyph",
        slim.length === 1 && /sat-pill-glyph/.test(slim[0]) &&
        !/sat-pill-time/.test(slim[0]), JSON.stringify(slim));
      check("[1.9.4] the popup's numeral is not amber",
        !/cmp-hero[^}]*\{[^}]*--sat-amber/.test(CC) && !/\.cmp-sub[^}]*--sat-amber/.test(CC));
    }

    // THE TRAP THIS ROUND FELL INTO, generalised. companion.html loads ONLY
    // tokens.css and companion.css - deliberately not newtab.css - so any custom
    // property companion.css consumes must be defined in one of those two. An
    // undefined one makes the declaration invalid at computed-value time: no
    // console warning, no visible error, the rule simply never applies.
    // --fs-16 had been referenced since [1.9.1] and does not exist anywhere in
    // this product; the task name had been silently rendering at the inherited
    // size ever since.
    {
      const used = new Set((CC.match(/var\(\s*(--[A-Za-z0-9-]+)/g) || [])
        .map(m => m.replace(/var\(\s*/, "")));
      // NOT anchored to line start: tokens.css writes one-liners like
      // `:root { --sat-amber: #f1c40f; }`, and an anchored scan misses every
      // property defined that way - which reported --sat-amber as undefined on a
      // correct tree the first time this ran.
      const DEF = /(?:^|[{;\s])(--[A-Za-z0-9-]+)\s*:/g;
      const defined = new Set();
      for (const src of [TK, CC]) { let m; DEF.lastIndex = 0;
        while ((m = DEF.exec(src)) !== null) defined.add(m[1]); }
      const missing = [...used].filter(v => !defined.has(v));
      check("[1.9.4] every custom property companion.css uses is DEFINED in the layer it loads",
        missing.length === 0, JSON.stringify(missing));
      check("[1.9.4] anti-vacuity: that scan found real properties to check",
        used.size > 8 && defined.size > 20, `used=${used.size} defined=${defined.size}`);
    }

    // The drive handle, so the round's own instrument stays honest.
    check("[1.9.4] the popup shell exports the view it mounted, so a harness drives THAT one",
      /window\.__companionView = view;/.test(CP));
    // The module must stay surface-agnostic for [1.16.0]'s side-panel mount.
    check("[1.9.4] the module still takes its container as a parameter",
      /function mount\(container, opts\)/.test(CJ));
    // COMMENTS STRIPPED FIRST. companion.js's own header says "nothing here reads
    // document.body or a hard-coded id" - so a raw scan matches the sentence
    // promising the property and fails on a tree that keeps it.
    const CJ_CODE = CJ.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    check("[1.9.4] ...and its CODE reads no document.body and no fixed id",
      !/document\.body|getElementById\(/.test(CJ_CODE));

    check("[1.9.4] anti-vacuity: the companion sources were actually read",
      CJ.length > 4000 && CC.length > 2000 && CP.length > 500,
      `js=${CJ.length} css=${CC.length} shell=${CP.length}`);
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
  // [2.0] The cold-start fold runs at onStartup, elbow to elbow with the anchor,
  // three sweeps and the licence re-validation. Un-queued, the write it loses is
  // the one that removes the overnight hours.
  { name: "un-queue closed-browser-fold ([2.0], the cold-start fold)", label: "closed-browser-fold" },
  {
    // THE REGRESSION SEED: restore the v1.0.5 SHAPE ITSELF — the close back
    // inside a `finally`, so every path takes it including the three early
    // returns. This is the actual shipped bug, not an approximation of it. If it
    // ever ESCAPES, the checkout checks have gone vacuous and v1.0.5 can return.
    name: "the v1.0.5 `finally` restored — every path closes",
    label: "checkout-return",
    seeds: [{
      file: "background.js",
      find: '  } catch (err) {\n    console.error("[LaunchPad] Checkout return handler failed:", err);\n  }',
      replace: '  } catch (err) {\n    console.error("[LaunchPad] Checkout return handler failed:", err);\n  } finally {\n    try { await chrome.tabs.remove(tabId); } catch (e) {}\n  }',
    }],
  },
  {
    // [2.0] Banking must ride the write the deactivation was already making.
    // Giving it its own saveAll puts a SECOND, unqueued `data` cycle on the
    // busiest path in the product — the L1 clobber shape, arriving through a
    // feature that looks like it only touches a display number.
    name: "the worked-clock fold takes its OWN write instead of riding the deactivation's",
    label: "session-anchor",
    seeds: [{
      file: "storage.js",
      find: "    task.workedMs = (task.workedMs || 0) + span;\n    return span;",
      replace: "    task.workedMs = (task.workedMs || 0) + span;\n    saveAll(data);\n    return span;",
    }],
  },
  {
    // A narrower variant: the early returns are respected, but the outcome of
    // the activation is not. Gives the failed-activation checks their own teeth
    // independently of the shape seed above.
    name: "checkout closes regardless of activation OUTCOME",
    label: "checkout-return",
    seeds: [{ file: "background.js", find: "  if (!activated) return;", replace: "  if (!activated && false) return;" }],
  },
  {
    // The sharp edge, seeded on its own: trust result.ok and nothing else. Dodo
    // answering a clear NO returns ok:true, so this closes on a REJECTED buyer.
    name: "checkout trusts result.ok alone (closes on a rejected license)",
    label: "checkout-return",
    seeds: [{
      file: "background.js",
      find: 'return !!(result && result.ok === true && result.status !== "invalid");',
      replace: "return !!(result && result.ok === true);",
    }],
  },
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
