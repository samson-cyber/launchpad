#!/usr/bin/env node
// Suite for the [1.2.0] Focus Blocking DECISION CHAIN — the pure block/allow
// logic behind the flagship Pro feature.
//
// WHY THIS FILE EXISTS: this suite existed once, as 35 checks plus 7 mutation
// seeds, and it lived in a session scratch directory through R2 and R2.5 and
// then evaporated with the session (BUGS.md P5). It is reconstructed here from
// the R2/R2.5 IMPLEMENTATION records on Asana 1216776953648220 plus the code as
// it stands. WHERE THE RECORD AND THE CODE DISAGREE, THE CODE WINS: this suite
// protects what the extension DOES today, not what a scratch session once
// asserted.
//
// It loads the REAL storage.js, pro-access.js, license.js, tracking.js and
// background.js into a Node VM against a fake chrome.*, then exercises the two
// functions background.js exports on `self` for exactly this purpose:
//   focusInterceptCandidateHost(url) -> host, or null if the URL is never a candidate
//   focusInterceptDecision(data, host) -> the matched block-list entry, or null
// The listener is only wiring; these two are the whole decision.
//
// Usage:
//   node tools/check-focus-decision.mjs [repoRoot]            clean run (the gate)
//   node tools/check-focus-decision.mjs [repoRoot] --mutate   mutation-seeding run
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
//
// Exit code 2 is load-bearing and Section Q is why: in the R2.5 round a fake
// chrome with no webNavigation made background.js throw on import, and the
// mutation run then reported a FALSE 7/7 — every mutant "died" of the same
// import crash rather than of its seeded defect (Q1). A suite whose subject
// cannot load must say so instead of scoring.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || process.cwd();

const DAY_MS = 86400000;
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

const SUBJECT_FILES = ["storage.js", "pro-access.js", "license.js", "tracking.js", "background.js"];

function readSubject(file) {
  // core.autocrlf=true -> these are CRLF in the working tree. Normalize before
  // any anchor matching, or a multi-line seed silently lands nowhere (BUGS.md M).
  return fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");
}

// A fake chrome.* that covers exactly what background.js touches at import.
// Written out explicitly rather than auto-stubbed with a Proxy: the point of Q1
// is that a missing API must fail loudly at load, and an auto-stub would paper
// over a genuinely broken manifest surface. Listener registrations are captured
// so the sibling queue suite can drive them; this suite only needs the exports.
function fakeChrome() {
  const listeners = {};
  const cap = (name) => ({ addListener: (fn) => { (listeners[name] = listeners[name] || []).push(fn); }, removeListener() {} });
  const chrome = {
    storage: {
      local: {
        async get(k) { return {}; },
        async set() {},
        async remove() {},
        async getBytesInUse() { return 0; },
      },
      // [OT.3] The recently-closed tab mirror lives in session storage (it
      // must survive a worker suspend and die with the browser). This gate
      // does not assert on the mirror, so a minimal store is enough - but it
      // has to EXIST or background.js does not load at all.
      session: {
        async get() { return {}; },
        async set() {},
        async remove() {},
      },
      onChanged: cap("storage.onChanged"),
    },
    runtime: {
      lastError: null,
      id: "harness-extension-id",
      // No update_url -> IS_UNPACKED is true in pro-access.js, which is what
      // makes the __devProOverride branch reachable below.
      getManifest: () => ({ version: "0.0.0", permissions: [] }),
      getURL: (p) => "chrome-extension://harness-extension-id/" + p,
      onInstalled: cap("runtime.onInstalled"),
      onStartup: cap("runtime.onStartup"),
      onMessage: cap("runtime.onMessage"),
      onSuspend: cap("runtime.onSuspend"),
    },
    tabs: {
      query: async () => [], get: async () => ({}), update: async () => ({}), remove: async () => {},
      create: async () => ({}), sendMessage: async () => ({}),
      onUpdated: cap("tabs.onUpdated"), onRemoved: cap("tabs.onRemoved"),
      onActivated: cap("tabs.onActivated"), onCreated: cap("tabs.onCreated"),
      onReplaced: cap("tabs.onReplaced"),   // [OT.3] the tab mirror re-notes a swap
    },
    windows: {
      getLastFocused: async () => ({ id: 1, focused: true }), getAll: async () => [],
      onFocusChanged: cap("windows.onFocusChanged"), onRemoved: cap("windows.onRemoved"),
      WINDOW_ID_NONE: -1,
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
  return { chrome, listeners };
}

// Load the subject. `seeds` is a list of {file, find, replace, expect} applied
// as context-bound string surgery BEFORE the VM sees the source. Anchors are
// verified for occurrence count (Q2) — a seed that lands nowhere, or lands in
// more places than intended, is reported as ANCHOR-MISS / ANCHOR-AMBIGUOUS and
// never scored as coverage.
function boot(seeds = []) {
  const sources = {};
  for (const f of SUBJECT_FILES) sources[f] = readSubject(f);

  for (const s of seeds) {
    const src = sources[s.file];
    if (src === undefined) throw new Error(`seed targets unknown file ${s.file}`);
    const occurrences = src.split(s.find).length - 1;
    const want = s.expect === undefined ? 1 : s.expect;
    if (occurrences === 0) { const e = new Error(`ANCHOR-MISS in ${s.file}`); e.anchor = "MISS"; throw e; }
    if (occurrences !== want) { const e = new Error(`ANCHOR-AMBIGUOUS in ${s.file}: ${occurrences} occurrences, expected ${want}`); e.anchor = "AMBIGUOUS"; throw e; }
    sources[s.file] = src.split(s.find).join(s.replace);
  }

  const { chrome, listeners } = fakeChrome();
  const ctx = {
    chrome,
    console: { log() {}, warn() {}, error() {}, info() {} },
    Date, Math, JSON, URL, URLSearchParams, Promise, Error, Object, Array, String, Number, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat,
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }),
    importScripts(...files) {
      for (const f of files) {
        // The path AS WRITTEN for the disk read - imports are no longer all in
        // the repo root - and the basename for the `sources` override, which is
        // how a mutation seed substitutes a file.
        const rel = String(f);
        const name = rel.replace(/^.*[\\/]/, "");
        vm.runInContext(sources[name] !== undefined ? sources[name] : readSubject(rel), ctx, { filename: rel });
      }
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(sources["background.js"], ctx, { filename: "background.js" });
  return { ctx, listeners };
}

function requireExports(ctx) {
  for (const fn of ["focusInterceptDecision", "focusInterceptCandidateHost"]) {
    if (typeof ctx[fn] !== "function") throw new Error(`background.js does not export ${fn} on self`);
  }
  if (typeof ctx.Storage?.focusBlockingActive !== "function") throw new Error("Storage.focusBlockingActive missing");
  if (typeof ctx.ProAccess?.getProAccessLevel !== "function") throw new Error("ProAccess.getProAccessLevel missing");
}

// ---------------------------------------------------------------- fixtures
//
// Q7: every fixture verifies its own seeding. buildData asserts the pro level it
// claims to have produced, so a fixture that silently fails to make the profile
// "trialing" can never be mistaken for a decision-chain result.
const PRO = {
  free: () => ({}),
  active: () => ({ subscriptionStatus: "active", lastVerifiedAt: Date.now() }),
  grace: () => ({ subscriptionStatus: "active", lastVerifiedAt: Date.now() - (7 * DAY_MS + 60000) }),
  expired: () => ({ subscriptionStatus: "active", lastVerifiedAt: Date.now() - (30 * DAY_MS) }),
  trialing: () => ({ subscriptionStatus: "trialing", trialStartedAt: Date.now() - DAY_MS }),
  trialExpired: () => ({ subscriptionStatus: "trialing", trialStartedAt: Date.now() - (30 * DAY_MS) }),
};

function buildData(ctx, opts = {}) {
  const data = {
    workspaces: [{ id: "main", name: "Main", groups: [], groupOrder: [] }],
    activeWorkspaceId: "main",
    settings: { focus: { autoArmDuringWork: opts.autoArm === undefined ? true : opts.autoArm } },
    blockList: opts.blockList || [],
    focusSnoozes: opts.snoozes || {},
    focusArmed: !!opts.armed,
    trackingPaused: !!opts.paused,
    pro: (PRO[opts.pro || "active"])(),
    activeTask: null,
  };
  if (opts.devPro) data.__devProOverride = true;
  if (opts.phase) {
    // [WM.2] `sessionMode` is WM.1's stamp. Left ABSENT unless a fixture asks
    // for it, so every pre-existing fixture keeps describing a session with no
    // stamp - which is exactly the legacy case, and it must still gate.
    const ps = { phase: opts.phase, phaseEndsAt: Date.now() + 600000, phaseDurationMs: 900000, cycleCount: 1, sessionComplete: false };
    if (opts.sessionMode !== undefined) ps.mode = opts.sessionMode;
    data.activeTask = {
      taskId: "t1", workspaceId: "main", startedAt: Date.now(),
      pomodoroState: ps,
    };
  }
  if (opts.workspaceMode) data.workspaces[0].mode = opts.workspaceMode;
  // Fixture self-verification (Q7).
  const wantLevel = opts.expectLevel || null;
  if (wantLevel) {
    const got = ctx.ProAccess.getProAccessLevel(data);
    if (got !== wantLevel) throw new Error(`FIXTURE BROKEN: pro level is "${got}", fixture claims "${wantLevel}"`);
  }
  return data;
}

// ------------------------------------------------------------------ suite
function runSuite(ctx) {
  const rows = [];
  const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail });
  const host = (u) => ctx.focusInterceptCandidateHost(u);
  const decide = (data, h) => ctx.focusInterceptDecision(data, h);

  // ===== LAYER 1: the scheme / host allowlist ==============================
  // One comparison covers every non-http(s) class the audit enumerated, and it
  // fails CLOSED for schemes invented later.
  check("http:// is a candidate", host("http://youtube.com/watch") === "youtube.com");
  check("https:// is a candidate", host("https://youtube.com/watch") === "youtube.com");
  check("chrome-extension:// (our own gate page) is never a candidate", host("chrome-extension://harness-extension-id/gate.html?to=x") === null);
  check("chrome-extension:// (any other extension id) is never a candidate", host("chrome-extension://abcdefghijklmnopabcdefghijklmnop/newtab.html") === null);
  check("chrome:// is never a candidate", host("chrome://extensions") === null);
  check("chrome-untrusted:// is never a candidate", host("chrome-untrusted://foo") === null);
  check("about:blank is never a candidate", host("about:blank") === null);
  check("devtools:// is never a candidate", host("devtools://devtools/bundled/inspector.html") === null);
  check("view-source: is never a candidate", host("view-source:https://youtube.com") === null);
  check("file:// is never a candidate", host("file:///C:/Users/x/notes.html") === null);
  check("a scheme invented later fails CLOSED", host("futurescheme://youtube.com") === null);
  check("an unparseable URL is not a candidate", host("http://") === null);
  check("an empty URL is not a candidate", host("") === null);
  check("a null URL is not a candidate", host(null) === null);

  // The two never-block hosts, and the coupling that broke once (07f979e).
  check("mylaunchpad.me is never a candidate", host("https://mylaunchpad.me/checkout-return") === null);
  check("a mylaunchpad.me SUBDOMAIN is never a candidate", host("https://www.mylaunchpad.me/pricing") === null);
  check("live.dodopayments.com is never a candidate", host("https://live.dodopayments.com/checkout") === null);
  check("a dodopayments SUBDOMAIN is never a candidate", host("https://api.live.dodopayments.com/v1") === null);
  check("a never-host LOOKALIKE is still a candidate (suffix needs the dot)", host("https://notmylaunchpad.me/") === "notmylaunchpad.me");

  // ===== LAYER 2: the decision chain, in order =============================
  const LIST = ["youtube.com", "reddit.com"];

  // C10 — the Pro gate, first.
  check("FREE tier is never intercepted",
    decide(buildData(ctx, { pro: "free", armed: true, blockList: LIST, expectLevel: "free" }), "youtube.com") === null);
  check("EXPIRED subscription is never intercepted",
    decide(buildData(ctx, { pro: "expired", armed: true, blockList: LIST, expectLevel: "expired" }), "youtube.com") === null);
  check("EXPIRED TRIAL is never intercepted",
    decide(buildData(ctx, { pro: "trialExpired", armed: true, blockList: LIST, expectLevel: "expired" }), "youtube.com") === null);
  check("ACTIVE gates",
    decide(buildData(ctx, { pro: "active", armed: true, blockList: LIST, expectLevel: "active" }), "youtube.com") === "youtube.com");
  check("TRIALING gates",
    decide(buildData(ctx, { pro: "trialing", armed: true, blockList: LIST, expectLevel: "trialing" }), "youtube.com") === "youtube.com");
  check("GRACE gates",
    decide(buildData(ctx, { pro: "grace", armed: true, blockList: LIST, expectLevel: "grace" }), "youtube.com") === "youtube.com");
  check("devPro override gates (unpacked dev build)",
    decide(buildData(ctx, { pro: "free", devPro: true, armed: true, blockList: LIST, expectLevel: "active" }), "youtube.com") === "youtube.com");

  // C2 — armed, manual and derived.
  check("UNARMED does not gate (nothing is arming it)",
    decide(buildData(ctx, { armed: false, blockList: LIST }), "youtube.com") === null);
  check("MANUAL ARM gates",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "youtube.com") === "youtube.com");
  check("AUTO-ARM during a WORK phase gates",
    decide(buildData(ctx, { armed: false, phase: "work", blockList: LIST }), "youtube.com") === "youtube.com");
  check("a BREAK phase does NOT gate (E1's asymmetry)",
    decide(buildData(ctx, { armed: false, phase: "shortBreak", blockList: LIST }), "youtube.com") === null);
  check("a LONG BREAK does NOT gate",
    decide(buildData(ctx, { armed: false, phase: "longBreak", blockList: LIST }), "youtube.com") === null);
  check("a PAUSED work phase does NOT gate (a frozen phase is not a running one)",
    decide(buildData(ctx, { armed: false, phase: "work", paused: true, blockList: LIST }), "youtube.com") === null);
  check("auto-arm PREFERENCE OFF + work phase does NOT gate",
    decide(buildData(ctx, { armed: false, phase: "work", autoArm: false, blockList: LIST }), "youtube.com") === null);
  check("MANUAL ARM survives a pause (the flag is not derived)",
    decide(buildData(ctx, { armed: true, paused: true, blockList: LIST }), "youtube.com") === "youtube.com");

  // C3 — the matcher.
  check("a LISTED host gates",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "reddit.com") === "reddit.com");
  check("an UNLISTED host does not gate",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "wikipedia.org") === null);
  check("a SUBDOMAIN of a listed host gates",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "m.youtube.com") === "youtube.com");
  check("a deep subdomain gates",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "a.b.youtube.com") === "youtube.com");
  check("LOOKALIKE SUFFIX does not gate — notyoutube.com is not youtube.com",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "notyoutube.com") === null);
  check("a longer lookalike does not gate — myyoutube.com",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "myyoutube.com") === null);
  check("www. is stripped from the visited host before matching",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "www.youtube.com") === "youtube.com");
  check("a host that merely CONTAINS an entry does not gate",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "youtube.com.evil.example") === null);

  // A www-PREFIXED STORED ENTRY IS UNMATCHABLE, and that is worth pinning.
  // normalizeBlockEntry strips "www." on write, so this shape can only come from
  // legacy or hand-edited storage — and because the matcher ALSO strips "www."
  // from the visited host, "www.youtube.com" as an entry can never match
  // anything: the stripped host is shorter than the entry, so neither the exact
  // nor the suffix rule can fire. These two checks are what makes the host-side
  // strip observable at all (mutation seeding found the earlier www check passed
  // either way, because the dot-suffix rule already covers www.x.com vs x.com).
  check("a www-prefixed STORED entry never matches its own host (entries are normalized on write)",
    decide(buildData(ctx, { armed: true, blockList: ["www.youtube.com"] }), "www.youtube.com") === null);
  check("a www-prefixed STORED entry never matches the bare host either",
    decide(buildData(ctx, { armed: true, blockList: ["www.youtube.com"] }), "youtube.com") === null);
  check("an EMPTY block list gates nothing",
    decide(buildData(ctx, { armed: true, blockList: [] }), "youtube.com") === null);
  check("the matched ENTRY is returned (the gate page needs it), not just true",
    decide(buildData(ctx, { armed: true, blockList: LIST }), "m.youtube.com") === "youtube.com");

  // C7 — snooze.
  const soon = Date.now() + 60000, past = Date.now() - 60000;
  check("a LIVE snooze suppresses the gate",
    decide(buildData(ctx, { armed: true, blockList: LIST, snoozes: { "youtube.com": soon } }), "youtube.com") === null);
  check("an EXPIRED snooze gates again",
    decide(buildData(ctx, { armed: true, blockList: LIST, snoozes: { "youtube.com": past } }), "youtube.com") === "youtube.com");
  check("a snooze on a DIFFERENT entry does not protect this one",
    decide(buildData(ctx, { armed: true, blockList: LIST, snoozes: { "reddit.com": soon } }), "youtube.com") === "youtube.com");
  check("a snooze keyed on the ENTRY covers its subdomains",
    decide(buildData(ctx, { armed: true, blockList: LIST, snoozes: { "youtube.com": soon } }), "m.youtube.com") === null);
  check("a malformed snooze value is ignored (gates)",
    decide(buildData(ctx, { armed: true, blockList: LIST, snoozes: { "youtube.com": "soon" } }), "youtube.com") === "youtube.com");

  // Degenerate inputs.
  check("null data does not gate and does not throw", decide(null, "youtube.com") === null);
  check("a null host does not gate", decide(buildData(ctx, { armed: true, blockList: LIST }), null) === null);
  check("an empty host does not gate", decide(buildData(ctx, { armed: true, blockList: LIST }), "") === null);

  // ===== LAYER 5 [WM.2]: ONE READER, ENTRY MODES, AND THE SESSION STAMP =====
  //
  // Every check above still runs through focusInterceptDecision, which is now
  // a thin wrapper over Storage.blockingMatchFor - so the 54 rows that were
  // green before this round staying green IS the evidence that the move
  // preserved the chain. These rows test what the move made possible.
  const reason = (data, h) => ctx.Storage.blockingReasonFor(data, h);

  check("the reader NAMES the reason, not just the fact",
    reason(buildData(ctx, { blockList: ["youtube.com"], armed: true }), "youtube.com") === "session");
  check("an unblocked host has NO reason",
    reason(buildData(ctx, { blockList: ["youtube.com"], armed: true }), "example.com") === null);
  check("EXPIRED gets null from the READER itself, not merely from the intercept",
    reason(buildData(ctx, { blockList: ["youtube.com"], armed: true, pro: "expired", expectLevel: "expired" }), "youtube.com") === null);
  check("FREE gets null from the reader",
    reason(buildData(ctx, { blockList: ["youtube.com"], armed: true, pro: "free", expectLevel: "free" }), "youtube.com") === null);
  check("GRACE is a paying customer and still gets a reason",
    reason(buildData(ctx, { blockList: ["youtube.com"], armed: true, pro: "grace", expectLevel: "grace" }), "youtube.com") === "session");

  // Liveness per reason, asserted directly. WM.3 flips these two to true and
  // these rows are the first thing that should change.
  const live = (data, m) => ctx.Storage.blockingReasonActive(data, m);
  check("the SESSION reason is live while blocking is armed",
    live(buildData(ctx, { armed: true }), "session") === true);
  check("the SESSION reason is not live when nothing arms it",
    live(buildData(ctx, {}), "session") === false);
  check("the SCHEDULE reason is refused - WM.3 has not built it",
    live(buildData(ctx, { armed: true }), "schedule") === false);
  check("the BUDGET reason is refused - WM.3 has not built it",
    live(buildData(ctx, { armed: true }), "budget") === false);
  check("an invented reason is refused",
    live(buildData(ctx, { armed: true }), "vibes") === false);

  // The entry mode. Session is the only live reason this round, so an entry
  // parked on a schedule or a budget must not gate - and must not throw.
  check("a string entry is session mode and gates",
    decide(buildData(ctx, { blockList: ["youtube.com"], armed: true }), "youtube.com") === "youtube.com");
  check("an OBJECT entry in session mode gates identically",
    decide(buildData(ctx, { blockList: [{ host: "youtube.com", mode: "session" }], armed: true }), "youtube.com") === "youtube.com");
  check("a SCHEDULE-mode entry does not gate during a session",
    decide(buildData(ctx, { blockList: [{ host: "youtube.com", mode: "schedule" }], armed: true }), "youtube.com") === null);
  check("a BUDGET-mode entry does not gate during a session",
    decide(buildData(ctx, { blockList: [{ host: "youtube.com", mode: "budget" }], armed: true }), "youtube.com") === null);
  check("an entry with a GARBAGE mode falls back to session and gates",
    decide(buildData(ctx, { blockList: [{ host: "youtube.com", mode: "whenever" }], armed: true }), "youtube.com") === "youtube.com");
  check("a malformed entry is dropped without taking the list with it",
    decide(buildData(ctx, { blockList: [null, 7, {}, "youtube.com"], armed: true }), "youtube.com") === "youtube.com");

  // SESSION BLOCKING IS NOT MODE-GOVERNED, and these six rows are the guard on
  // that. The round tried the other rule and withdrew it: every workspace
  // defaults to Casual, so governing auto-arm by mode would have turned a
  // shipped default off for every existing user in silence. Mode governs what
  // it brings - schedules, friction, sounds, presets - not what it found.
  check("a session stamped WORK gates",
    decide(buildData(ctx, { blockList: ["youtube.com"], phase: "work", sessionMode: "work" }), "youtube.com") === "youtube.com");
  check("a session stamped CASUAL STILL GATES - session blocking is not mode-governed",
    decide(buildData(ctx, { blockList: ["youtube.com"], phase: "work", sessionMode: "casual" }), "youtube.com") === "youtube.com");
  check("a session with NO stamp (pre-WM.1) gates, unchanged",
    decide(buildData(ctx, { blockList: ["youtube.com"], phase: "work" }), "youtube.com") === "youtube.com");
  check("a MANUAL arm gates inside a casual session",
    decide(buildData(ctx, { blockList: ["youtube.com"], phase: "work", sessionMode: "casual", armed: true }), "youtube.com") === "youtube.com");
  check("a CASUAL workspace does not suppress session blocking",
    decide(buildData(ctx, { blockList: ["youtube.com"], phase: "work", workspaceMode: "casual" }), "youtube.com") === "youtube.com");
  check("a break in a WORK workspace still does not gate - the phase rule is untouched",
    decide(buildData(ctx, { blockList: ["youtube.com"], phase: "shortBreak", sessionMode: "work", workspaceMode: "work" }), "youtube.com") === null);

  // THE NEVER-BLOCK LIST WINS OVER EVERY ENTRY MODE. It is a transport rule and
  // it runs before the reader is ever consulted, so the assertion is that the
  // URL never becomes a candidate even when it is listed in each mode in turn.
  ["session", "schedule", "budget"].forEach(function (m) {
    check("never-block wins over a " + m + "-mode entry that lists it",
      host("https://mylaunchpad.me/account") === null);
    check("never-block wins over a " + m + "-mode SUBDOMAIN entry",
      host("https://app.mylaunchpad.me/account") === null);
  });

  return rows;
}

// ------------------------------------------------------------- mutations
//
// Q3: every seed must be FAITHFUL — it removes exactly one guard and leaves the
// rest of the chain running. A seed that deletes the function outright would go
// red for the wrong reason and earn coverage it has not proved.
const SEEDS = [
  {
    name: "pro gate removed (C10)",
    // [WM.2] RE-ANCHORED. Same subject - the Pro guard on the blocking path -
    // moved from background.js into the one reader, per PLAN decision H.
    note: "recorded R2 seed 1, re-anchored to the reader in WM.2",
    seeds: [{ file: "storage.js", find: "    if (!blockingProActive(data)) return null;\n", replace: "" }],
  },
  {
    name: "armed check removed (C2)",
    // [WM.2] RE-ANCHORED into blockingReasonActive, where the session reason now
    // decides whether it is live at all.
    note: "recorded R2 seed 2, re-anchored to the reader in WM.2",
    seeds: [{ file: "storage.js", find: '    if (mode === "session") return focusBlockingActive(data);', replace: '    if (mode === "session") return true;' }],
  },
  {
    name: "snooze check removed (C7)",
    // [WM.2] RE-ANCHORED into the reader's loop.
    note: "recorded R2 seed 3, re-anchored to the reader in WM.2",
    seeds: [{ file: "storage.js", find: "      if (getActiveFocusSnooze(data, entry, nowMs)) continue;\n", replace: "" }],
  },
  {
    name: "scheme allowlist removed",
    note: "recorded R2 seed 4 — http(s) test dropped, so every scheme becomes a candidate",
    seeds: [{
      file: "background.js",
      find: '  if (rawUrl.lastIndexOf("http://", 0) !== 0 && rawUrl.lastIndexOf("https://", 0) !== 0) return null;\n',
      replace: "",
    }],
  },
  {
    name: "never-hosts list emptied",
    note: "recorded R2 seed 5 — mylaunchpad.me / dodopayments become interceptable",
    seeds: [{ file: "background.js", find: 'var FOCUS_NEVER_HOSTS = ["mylaunchpad.me", "live.dodopayments.com"];', replace: "var FOCUS_NEVER_HOSTS = [];" }],
  },
  {
    name: "never-hosts SUBDOMAIN guard removed",
    note: "recorded R2 seed 6 — exact match still bails, subdomains no longer do",
    seeds: [{ file: "background.js", find: '    if (host.length > h.length && host.slice(-(h.length + 1)) === "." + h) return null;\n', replace: "" }],
  },
  {
    name: "Pro level set widened to admit expired",
    note: "recorded R2 seed 7",
    // [1218314553351830] RE-ANCHORED, and this is a MOVE not a rewrite: the seed
    // still widens the accessible set to admit `expired`, which is the same
    // subject matter it has always had. What changed is where the set lives.
    // 7d55682 made isProAccessibleLevel canonical in pro-access.js so the popup
    // and the badge could share one definition, and the operand order was
    // normalised with it (trialing first). The anchor still pointed at
    // background.js and had been reporting ANCHOR-MISS ever since, so this seed
    // has protected nothing since that commit. pro-access.js was already in this
    // runner's SUBJECT_FILES, so nothing else needed to change.
    seeds: [{
      file: "pro-access.js",
      find: 'return level === "trialing" || level === "active" || level === "grace";',
      replace: 'return level === "active" || level === "trialing" || level === "grace" || level === "expired";',
    }],
  },
  {
    name: "naive phase misread — any phase arms, including breaks",
    note: "the [1.2.0] R3 label bug in derivation form: 'a phase is running, so block'",
    seeds: [{
      file: "storage.js",
      // [WM.2] BACK ON ITS ORIGINAL ANCHOR. It moved when the session stamp
      // briefly split this derivation across two lines, and moved back when that
      // rule was withdrawn - recorded rather than tidied away, because a seed
      // that has wandered is the kind that quietly stops protecting anything.
      find: 'return hydratePomodoroState(active.pomodoroState).phase === "work";',
      replace: "return hydratePomodoroState(active.pomodoroState).phase !== null;",
    }],
  },
  {
    name: "matcher suffix without the dot",
    note: "the classic: notyoutube.com starts matching youtube.com",
    seeds: [{
      file: "storage.js",
      find: "      if (h.length > e.length && h.slice(-(e.length + 1)) === \".\" + e) return e;",
      replace: "      if (h.length > e.length && h.slice(-e.length) === e) return e;",
    }],
  },
  {
    name: "snooze ignores expiry",
    note: "a stored snooze becomes permanent",
    seeds: [{ file: "storage.js", find: "    return v > now ? v : null;", replace: "    return v;" }],
  },
  {
    name: "www-strip removed from the matcher",
    note: "www.youtube.com stops matching a bare youtube.com entry",
    seeds: [{ file: "storage.js", find: '    if (h.indexOf("www.") === 0) h = h.slice(4);\n', replace: "" }],
  },
  {
    name: "tracking-paused term dropped from the arm derivation",
    note: "a paused work phase would keep blocking",
    seeds: [{ file: "storage.js", find: "    if (isTrackingPaused(data)) return false;\n    var active = getActiveTask(data);", replace: "    var active = getActiveTask(data);" }],
  },
  {
    // [WM.2] THE SEED THAT STOOD HERE GUARDED A RULE THAT WAS WITHDRAWN.
    // It protected "auto-arm only when the session stamp reads work" - a rule
    // this round tried and removed, because it would have silently disabled a
    // shipped default for every user whose workspace had never been set to
    // Work. What replaces it guards the rule that actually holds: session
    // blocking must keep arming from the phase alone.
    name: "[WM.2] session blocking made mode-governed",
    note: "the withdrawn rule, seeded so it cannot come back unnoticed",
    seeds: [{
      file: "storage.js",
      find: '    return hydratePomodoroState(active.pomodoroState).phase === "work";',
      replace: '    return hydratePomodoroState(active.pomodoroState).phase === "work" && hydratePomodoroState(active.pomodoroState).mode === "work";',
    }],
  },
  {
    name: "[WM.2] entry mode filter dropped",
    note: "every entry would answer to every reason - a budget rule blocking during a session",
    seeds: [{
      file: "storage.js",
      find: "      if (entries[i].mode === want) out.push(entries[i].host);",
      replace: "      out.push(entries[i].host);",
    }],
  },
  {
    name: "[WM.2] an unbuilt reason goes live",
    // THE SEED THIS REPLACED COULD NOT BE CAUGHT, and dropping it is the honest
    // move rather than a gap. It hardcoded the returned reason to "session" -
    // and session is the ONLY live reason this round, so every correct answer
    // already IS "session" and the mutation is behaviourally invisible. A seed
    // that cannot fail earns no coverage. WM.3 makes it meaningful; WM.3 can
    // add it back when it does.
    //
    // What IS worth proving now is the other half: that schedule and budget are
    // REFUSED rather than merely unreachable. Turn the schedule branch live and
    // a schedule-mode entry starts gating, which the suite already watches.
    note: "schedule blocking fires before WM.3 has built it",
    seeds: [{
      file: "storage.js",
      find: '    if (mode === "schedule") return false;',
      replace: '    if (mode === "schedule") return true;',
    }],
  },
  {
    name: "[WM.2] budget blocking goes live",
    note: "same shape as the schedule seed, for the reason that sits OUTSIDE mode",
    seeds: [{
      file: "storage.js",
      find: '    if (mode === "budget") return false;',
      replace: '    if (mode === "budget") return true;',
    }],
  },
];

function runMutations() {
  console.log("\nFOCUS DECISION — MUTATION SEEDING\n");
  console.log("  Each seed removes exactly ONE guard and leaves the rest of the chain running.");
  console.log("  ANCHOR-MISS / ANCHOR-AMBIGUOUS are reported separately from ESCAPED (BUGS.md Q2):");
  console.log("  a seed that lands nowhere is a broken seed, not a coverage gap.\n");

  const results = [];
  for (const m of SEEDS) {
    let ctx;
    try { ({ ctx } = boot(m.seeds)); }
    catch (err) {
      if (err.anchor) { results.push({ name: m.name, status: "ANCHOR-" + err.anchor, detail: err.message }); continue; }
      results.push({ name: m.name, status: "SUBJECT-BROKEN", detail: err.message });
      continue;
    }
    try { requireExports(ctx); }
    catch (err) { results.push({ name: m.name, status: "SUBJECT-BROKEN", detail: err.message }); continue; }

    const rows = runSuite(ctx);
    const failed = rows.filter((r) => !r.pass);
    results.push({
      name: m.name,
      status: failed.length ? "CAUGHT" : "ESCAPED",
      detail: failed.length ? `${failed.length} check(s), first: ${failed[0].name}` : "suite stayed green — the guard is unprotected",
    });
  }

  // The unloadable-subject CONTROL (Q1). A deliberately broken subject must be
  // reported as broken and NOT scored as a catch — this is the run that proves
  // the runner can tell "the seeded defect was found" from "nothing loaded".
  let control;
  try {
    boot([{ file: "background.js", find: "function focusInterceptDecision(data, host) {", replace: "function focusInterceptDecision(data, host) { syntax error here" }]);
    control = "NOT DETECTED — the runner failed to notice an unloadable subject";
  } catch (err) {
    control = err.anchor ? `NOT DETECTED — control seed did not apply (${err.message})` : "detected as SUBJECT-BROKEN";
  }

  const width = Math.max(...results.map((r) => r.name.length), 20);
  for (const r of results) {
    console.log(`  ${r.status.padEnd(15)} ${r.name.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n  CONTROL (unloadable subject must not be scored): ${control}`);

  const caught = results.filter((r) => r.status === "CAUGHT").length;
  const bad = results.filter((r) => r.status !== "CAUGHT");
  const controlOk = control === "detected as SUBJECT-BROKEN";
  console.log(`\nFOCUS DECISION MUTATIONS: ${bad.length === 0 && controlOk ? "PASS" : "FAIL"} — ${caught}/${results.length} caught, control ${controlOk ? "ok" : "BROKEN"}\n`);
  process.exit(bad.length === 0 && controlOk ? 0 : 1);
}

// ---------------------------------------------------------------- entry
let ctx;
try { ({ ctx } = boot()); requireExports(ctx); }
catch (err) {
  console.log("FOCUS DECISION: SUBJECT DID NOT LOAD — " + (err && err.message));
  process.exit(2);
}

if (MUTATE) { runMutations(); }
else {
  const rows = runSuite(ctx);
  let pass = 0, fail = 0;
  console.log("\nFOCUS DECISION — [1.2.0] block/allow chain\n");
  for (const r of rows) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
    r.pass ? pass++ : fail++;
  }
  // Anti-vacuity floor (BUGS.md P2). The recorded suite ran 35 checks; this one
  // must never quietly shrink below that.
  const MIN = 35;
  if (rows.length < MIN) {
    console.log(`\nFOCUS DECISION: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
    process.exit(1);
  }
  console.log(`\nFOCUS DECISION: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
