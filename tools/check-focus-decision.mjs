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
    if (opts.sessionId !== undefined) ps.sessionId = opts.sessionId;
    data.activeTask = {
      taskId: "t1", workspaceId: "main", startedAt: Date.now(),
      pomodoroState: ps,
    };
  }
  if (opts.workspaceMode) data.workspaces[0].mode = opts.workspaceMode;
  // [WM.3] Tracking is ON by default everywhere (emptyTrackingState), so a
  // fixture only says so when it wants it OFF - which is the budget case that
  // can never fire.
  if (opts.tracking === false) data.workspaces[0].tracking = { enabled: false };
  // [WM.4] The settings this round adds. Absent unless a fixture asks, so every
  // pre-existing fixture keeps describing a profile that never opened them.
  if (opts.commitment !== undefined) data.settings.focus.commitment = opts.commitment;
  if (opts.idleSec !== undefined) data.settings.focus.idleSec = opts.idleSec;
  if (opts.snoozes) data.focusSnoozes = opts.snoozes;
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
  // [WM.3] THESE TWO ROWS ARE WHERE THE ROUND LANDS. They read "refused, WM.3
  // has not built it" until this commit; now each asks the ruling WM.2 wrote at
  // the branch site, and the ruling is the assertion.
  check("SCHEDULE is mode-governed: live on a WORK workspace",
    live(buildData(ctx, { workspaceMode: "work" }), "schedule") === true);
  check("SCHEDULE is mode-governed: NOT live on a Casual workspace",
    live(buildData(ctx, { workspaceMode: "casual" }), "schedule") === false);
  check("BUDGET is outside mode: live on a CASUAL workspace",
    live(buildData(ctx, { workspaceMode: "casual" }), "budget") === true);
  check("BUDGET is outside mode: live on a WORK workspace too",
    live(buildData(ctx, { workspaceMode: "work" }), "budget") === true);
  check("BUDGET is refused when the workspace is not TRACKED - it could never be spent",
    live(buildData(ctx, { tracking: false }), "budget") === false);
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

  // ===== LAYER 6 [WM.3]: SCHEDULES AND BUDGETS =====
  const S = ctx.Storage;
  // A fixed instant to reason about, so no row depends on when the suite runs:
  // Wednesday 2026-09-16, 10:30 local. new Date(y,m,d,h,mm) is local by
  // construction, which is the same calendar localDayKey is cut from.
  const WED_1030 = new Date(2026, 8, 16, 10, 30).getTime();
  const WED_2330 = new Date(2026, 8, 16, 23, 30).getTime();
  const THU_0100 = new Date(2026, 8, 17, 1, 0).getTime();
  const THU_1030 = new Date(2026, 8, 17, 10, 30).getTime();
  const SUN_0100 = new Date(2026, 8, 20, 1, 0).getTime();
  check("fixture: the instants are the weekdays they claim",
    new Date(WED_1030).getDay() === 3 && new Date(THU_0100).getDay() === 4 && new Date(SUN_0100).getDay() === 0);

  const sched = (windows) => ({ host: "youtube.com", mode: "schedule", windows: windows });
  const WORKDAYS = [1, 2, 3, 4, 5];
  const decideAt = (data, h, now, c) => {
    const m = S.blockingMatchFor(data, h, now, c);
    return m ? m.reason : null;
  };

  // --- the window ---
  check("INSIDE the window, on a listed day, gates",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([{ days: WORKDAYS, start: "09:00", end: "17:00" }])] }),
      "youtube.com", WED_1030) === "schedule");
  check("OUTSIDE the window does not gate",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([{ days: WORKDAYS, start: "09:00", end: "17:00" }])] }),
      "youtube.com", WED_2330) === null);
  check("a day NOT in the set does not gate, even at the right hour",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([{ days: [0], start: "09:00", end: "17:00" }])] }),
      "youtube.com", WED_1030) === null);
  check("the window is half-open: the END minute is already outside",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([{ days: WORKDAYS, start: "09:00", end: "10:30" }])] }),
      "youtube.com", WED_1030) === null);
  check("and the START minute is inside",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([{ days: WORKDAYS, start: "10:30", end: "17:00" }])] }),
      "youtube.com", WED_1030) === "schedule");

  // --- overnight ---
  const NIGHT = [{ days: [3], start: "22:00", end: "02:00" }];   // Wednesday night
  check("OVERNIGHT: late on the listed day gates",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched(NIGHT)] }), "youtube.com", WED_2330) === "schedule");
  check("OVERNIGHT: early on the day AFTER the listed day gates - the window belongs to the night it opened",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched(NIGHT)] }), "youtube.com", THU_0100) === "schedule");
  check("OVERNIGHT: mid-morning after it closed does not gate",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched(NIGHT)] }), "youtube.com", THU_1030) === null);
  check("OVERNIGHT: early on a day whose PREVIOUS day is not listed does not gate",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched(NIGHT)] }), "youtube.com", SUN_0100) === null);

  // --- mode, and malformed windows ---
  check("a CASUAL workspace does not gate on a schedule, inside the window",
    decideAt(buildData(ctx, { workspaceMode: "casual", blockList: [sched([{ days: WORKDAYS, start: "09:00", end: "17:00" }])] }),
      "youtube.com", WED_1030) === null);
  check("two windows on one entry: the SECOND one gates",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([
      { days: WORKDAYS, start: "06:00", end: "07:00" }, { days: WORKDAYS, start: "09:00", end: "17:00" }])] }),
      "youtube.com", WED_1030) === "schedule");
  check("a schedule entry with NO windows gates nothing",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([])] }), "youtube.com", WED_1030) === null);
  check("a malformed window is dropped rather than throwing",
    decideAt(buildData(ctx, { workspaceMode: "work", blockList: [sched([{ days: [3], start: "nope", end: "17:00" }])] }),
      "youtube.com", WED_1030) === null);
  check("a zero-length window is not a window",
    S.normalizeScheduleWindow({ days: [3], start: "09:00", end: "09:00" }) === null);

  // --- the budget ---
  const budget = (min) => ({ host: "youtube.com", mode: "budget", limitMin: min });
  const today = S.localDayKey(WED_1030);
  const used = (ms) => ({ budgetToday: { day: today, byWorkspace: { main: { "youtube.com": ms } } } });
  check("budget MET gates",
    decideAt(buildData(ctx, { blockList: [budget(30)] }), "youtube.com", WED_1030, used(30 * 60000)) === "budget");
  check("budget EXCEEDED gates",
    decideAt(buildData(ctx, { blockList: [budget(30)] }), "youtube.com", WED_1030, used(45 * 60000)) === "budget");
  check("budget UNDER does not gate, to the minute",
    decideAt(buildData(ctx, { blockList: [budget(30)] }), "youtube.com", WED_1030, used(30 * 60000 - 1)) === null);
  check("a budget gates on a CASUAL workspace - it sits outside mode",
    decideAt(buildData(ctx, { workspaceMode: "casual", blockList: [budget(30)] }), "youtube.com", WED_1030, used(60 * 60000)) === "budget");
  check("a budget on an UNTRACKED workspace never gates",
    decideAt(buildData(ctx, { tracking: false, blockList: [budget(30)] }), "youtube.com", WED_1030, used(60 * 60000)) === null);
  check("figures from ANOTHER DAY read as zero - the budget reset with the day",
    decideAt(buildData(ctx, { blockList: [budget(30)] }), "youtube.com", WED_1030,
      { budgetToday: { day: "2020-01-01", byWorkspace: { main: { "youtube.com": 99 * 60000 } } } }) === null);
  check("NO figures supplied is not the same as zero: the budget cannot answer, so it does not gate",
    decideAt(buildData(ctx, { blockList: [budget(30)] }), "youtube.com", WED_1030) === null);
  // AND THE DISTINCTION ITSELF, asserted on the reader rather than through the
  // decision - through the decision it is invisible, because "not told" and
  // "zero used" both fail the comparison. It is still a real contract: a
  // surface reporting usage must be able to tell "none yet" from "I do not
  // know", and only this row can fail if that collapses.
  check("budgetUsedMs reports NOT TOLD as null, distinctly from zero",
    S.budgetUsedMs(undefined, "main", "youtube.com", WED_1030) === null &&
    S.budgetUsedMs({ budgetToday: { day: today, byWorkspace: {} } }, "main", "youtube.com", WED_1030) === 0);
  check("figures for ANOTHER workspace do not spend this one's budget",
    decideAt(buildData(ctx, { blockList: [budget(30)] }), "youtube.com", WED_1030,
      { budgetToday: { day: today, byWorkspace: { other: { "youtube.com": 99 * 60000 } } } }) === null);
  check("a budget with no limit is inert rather than instant",
    decideAt(buildData(ctx, { blockList: [{ host: "youtube.com", mode: "budget" }] }), "youtube.com", WED_1030, used(99 * 60000)) === null);
  check("a SUBDOMAIN is gated by the entry's budget once the entry is spent",
    decideAt(buildData(ctx, { blockList: [budget(30)] }), "m.youtube.com", WED_1030, used(45 * 60000)) === "budget");

  // The worker's summing half: a subdomain's tracked minutes SPEND the entry.
  check("the worker sums every tracked domain that matches the entry",
    ctx.focusBudgetSumFor({ "m.youtube.com": 10 * 60000, "www.youtube.com": 5 * 60000, "vimeo.com": 99 * 60000 }, "youtube.com")
      === 15 * 60000);
  check("and nothing that does not match it",
    ctx.focusBudgetSumFor({ "notyoutube.com": 99 * 60000 }, "youtube.com") === 0);

  // --- precedence, with two reasons live at once ---
  check("session wins over budget when both would hold - the order is session, budget, schedule",
    decideAt(buildData(ctx, { armed: true, workspaceMode: "work", blockList: ["youtube.com", { host: "vimeo.com", mode: "budget", limitMin: 1 }] }),
      "youtube.com", WED_1030, used(99 * 60000)) === "session");

  // ===== LAYER 7 [WM.4]: FRICTION, SOUNDS, AND THE IDLE THRESHOLD =====
  const RUNNING = { phase: "work", sessionMode: "work", sessionId: "s1" };
  const plan = (o, host) => S.frictionPlanFor(buildData(ctx, o), host || "youtube.com");
  const snoozed = (session, count) => ({ "youtube.com": { until: Date.now() - 1000, session: session, count: count } });

  check("no session, no friction - a hand-set arm has no stamp to read",
    plan({ armed: true }).delayMs === 0);
  check("a CASUAL session has no friction",
    plan({ phase: "work", sessionMode: "casual", sessionId: "s1" }).delayMs === 0);
  check("a WORK session: the FIRST snooze waits 10s",
    plan(RUNNING).delayMs === S.FRICTION_FIRST_MS && plan(RUNNING).repeat === false);
  check("a REPEAT snooze in the SAME session waits 60s",
    plan(Object.assign({}, RUNNING, { snoozes: snoozed("s1", 1) })).delayMs === S.FRICTION_REPEAT_MS);
  check("a snooze from an EARLIER session is not a repeat - the escalation lives inside one session",
    plan(Object.assign({}, RUNNING, { snoozes: snoozed("s0", 4) })).delayMs === S.FRICTION_FIRST_MS);
  check("a legacy snooze record (a bare number) is not a repeat either",
    plan(Object.assign({}, RUNNING, { snoozes: { "youtube.com": Date.now() - 1000 } })).delayMs === S.FRICTION_FIRST_MS);
  check("a repeat on a DIFFERENT host is not a repeat on this one",
    plan(Object.assign({}, RUNNING, { snoozes: { "vimeo.com": { until: 1, session: "s1", count: 3 } } })).delayMs === S.FRICTION_FIRST_MS);
  check("the typed sentence is ABSENT unless the user armed it",
    plan(Object.assign({}, RUNNING, { snoozes: snoozed("s1", 1) })).needsSentence === false);
  check("armed, it appears on a REPEAT",
    plan(Object.assign({}, RUNNING, { commitment: true, snoozes: snoozed("s1", 1) })).needsSentence === true);
  check("armed, it does NOT appear on a first snooze - escalation, not a toll",
    plan(Object.assign({}, RUNNING, { commitment: true })).needsSentence === false);
  check("the sentence judges nothing",
    S.COMMITMENT_SENTENCE === "I am choosing to open this");
  check("friction reads the STAMP, not the live workspace: a Work session on a Casual workspace still escalates",
    plan(Object.assign({}, RUNNING, { workspaceMode: "casual" })).delayMs === S.FRICTION_FIRST_MS);
  check("and a Casual session on a Work workspace does not",
    plan({ phase: "work", sessionMode: "casual", sessionId: "s1", workspaceMode: "work" }).delayMs === 0);

  // The session id itself.
  check("a session id is forced null when no phase is running - it cannot outlive its session",
    S.hydratePomodoroState({ phase: null, sessionId: "s1" }).sessionId === null);
  check("and it survives a running phase",
    S.hydratePomodoroState({ phase: "work", phaseEndsAt: 9, phaseDurationMs: 9, sessionId: "s1" }).sessionId === "s1");

  // [1.13.0 E6] Eight sound rows stood here. Focus sounds are cut, and an
  // assertion about a reader that no longer exists is not a weaker test, it is
  // a broken one.

  // The idle threshold.
  check("the idle default is 60s", S.getIdleThresholdSec({}) === 60);
  check("a stored 5 READS as the 15s floor - the browser would ignore anything less",
    S.getIdleThresholdSec({ settings: { focus: { idleSec: 5 } } }) === S.IDLE_THRESHOLD_FLOOR_SEC);
  check("a stored 0 and a stored negative read as the floor too",
    S.getIdleThresholdSec({ settings: { focus: { idleSec: 0 } } }) === 15 &&
    S.getIdleThresholdSec({ settings: { focus: { idleSec: -30 } } }) === 15);
  check("garbage reads as the default, not as the floor",
    S.getIdleThresholdSec({ settings: { focus: { idleSec: "soon" } } }) === 60);
  check("a sane value is kept",
    S.getIdleThresholdSec({ settings: { focus: { idleSec: 120 } } }) === 120);

  // ONE VALUE, BOTH READERS. tracking.js holds the live number and writes
  // chrome.idle.setDetectionInterval, which is what the ACTIVE idle deduction's
  // onStateChanged obeys; the engine gate reads the same number directly.
  ctx.Tracking.setIdleSeconds(5);
  check("tracking clamps to the floor too, so neither reader can be given 5",
    ctx.Tracking.idleSeconds() === 15, String(ctx.Tracking.idleSeconds()));
  ctx.Tracking.setIdleSeconds(120);
  check("and setting it writes the browser's detection interval, which is the other reader's only input",
    ctx.Tracking.idleSeconds() === 120);

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
    seeds: [{ file: "storage.js", find: "        if (getActiveFocusSnooze(data, entry, now)) continue;\n", replace: "" }],
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
    // [WM.4] RE-ANCHORED: the reader now tolerates both the bare number and the
    // {until, session, count} record, so the comparison it guards moved onto the
    // extracted `until`. Same guard, same defect - a stored snooze becomes
    // permanent.
    seeds: [{ file: "storage.js", find: "    return until > now ? until : null;", replace: "    return until;" }],
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
    // [WM.3] RE-ANCHORED, because the thing it guarded MOVED. WM.2's matcher
    // collected every host in a mode and tested them together, so the mode
    // filter lived in blockHostsForMode; the matcher now walks the entries, so
    // the filter is the `continue` below and blockHostsForMode is gone. Same
    // guard, same defect - a budget rule answering during a session.
    name: "entry mode filter dropped",
    note: "every entry would answer to every reason - a budget rule blocking during a session",
    seeds: [{
      file: "storage.js",
      find: "        if (entries[j].mode !== mode) continue;",
      replace: "        if (false) continue;",
    }],
  },
  {
    name: "[WM.4] friction ignores the session stamp",
    note: "a Casual session would escalate - mode-governance dropped",
    seeds: [{ file: "storage.js", find: '    if (sessionStampMode(data) !== "work") return none;   // Casual, or no session at all', replace: "" }],
  },
  {
    name: "[WM.4] every snooze treated as a repeat",
    note: "a first snooze would wait 60s",
    seeds: [{ file: "storage.js", find: "    var repeat = (snoozeSession(prev) === session) && snoozeCount(prev) >= 1;", replace: "    var repeat = true;" }],
  },
  {
    name: "[WM.4] a repeat from an EARLIER session still counts",
    note: "the escalation would leak across sessions and never reset",
    seeds: [{ file: "storage.js", find: "    var repeat = (snoozeSession(prev) === session) && snoozeCount(prev) >= 1;", replace: "    var repeat = snoozeCount(prev) >= 1;" }],
  },
  {
    name: "[WM.4] the typed sentence imposed without the toggle",
    note: "a user who never armed it would meet it anyway",
    seeds: [{ file: "storage.js", find: "      needsSentence: repeat && isCommitmentArmed(data),", replace: "      needsSentence: repeat," }],
  },
  {
    name: "[WM.4] the session id outlives its session",
    note: "the next session's first snooze would look like a repeat",
    seeds: [{
      file: "storage.js",
      find: '      sessionId: (phase && typeof ps.sessionId === "string" && ps.sessionId) ? ps.sessionId : null',
      replace: '      sessionId: (typeof ps.sessionId === "string" && ps.sessionId) ? ps.sessionId : null',
    }],
  },
  {
    name: "[WM.4] the idle floor removed",
    note: "a 5s threshold would be stored and silently ignored by the browser",
    seeds: [{ file: "storage.js", find: "    if (n < IDLE_THRESHOLD_FLOOR_SEC) return IDLE_THRESHOLD_FLOOR_SEC;", replace: "" }],
  },
  {
    name: "[WM.3] the schedule mode gate removed",
    note: "a Casual workspace would run scheduled blocking",
    seeds: [{ file: "storage.js", find: '      return getWorkspaceMode(getActiveWorkspace(data)) === "work";', replace: "      return true;" }],
  },
  {
    name: "[WM.3] the schedule WINDOW ignored",
    note: "a scheduled entry would block around the clock",
    seeds: [{ file: "storage.js", find: '    if (entry.mode === "schedule") return entryScheduleHolds(entry, nowMs);', replace: '    if (entry.mode === "schedule") return true;' }],
  },
  {
    name: "[WM.3] the overnight wrap dropped",
    note: "22:00-02:00 would never hold, because start > end fails a plain range test",
    seeds: [{
      file: "storage.js",
      find: "    if (start < end) {\n      return win.days.indexOf(today) !== -1 && mins >= start && mins < end;\n    }",
      replace: "    {\n      return win.days.indexOf(today) !== -1 && mins >= start && mins < end;\n    }",
    }],
  },
  {
    name: "[WM.3] the budget tracking gate removed",
    note: "a budget on an untracked workspace would look armed and never fire",
    seeds: [{ file: "storage.js", find: "      return isTrackingEnabled(getActiveWorkspace(data));", replace: "      return true;" }],
  },
  {
    name: "[WM.3] the budget comparison always true",
    note: "every budgeted host would block from the first navigation of the day",
    seeds: [{ file: "storage.js", find: "      return used >= limit * 60000;", replace: "      return true;" }],
  },
  {
    name: "[WM.3] the budget day check removed",
    note: "yesterday's minutes would keep a budget spent forever",
    seeds: [{ file: "storage.js", find: "    if (rec.day !== localDayKey(nowMs)) return 0;", replace: "" }],
  },
  {
    name: "[WM.3] not-told read as zero",
    note: "a caller with no figures would report every budget as unspent",
    seeds: [{ file: "storage.js", find: '    if (!rec || typeof rec !== "object") return null;', replace: '    if (!rec || typeof rec !== "object") return 0;' }],
  },
  {
    // [WM.3] WM.2's TWO SEEDS RETIRE HERE, AND THIS IS THEM DOING THEIR JOB
    // RATHER THAN BEING DELETED. They guarded "schedule and budget are REFUSED,
    // not merely unreachable" by forcing each branch live before it was built -
    // and both anchors were the `return false` lines this round replaced with
    // real conditions, so they can no longer land. What they were protecting is
    // now protected by the seven seeds above, each of which forces a REAL
    // condition wrong. The rulings they were holding open - schedule is
    // mode-governed, budget is not - are the first two rows of layer 6.
    name: "[WM.3] the reason ORDER collapsed",
    note: "WM.2 could not seed this - session was the only live reason, so hardcoding it was invisible. With three live it is not.",
    seeds: [{
      file: "storage.js",
      find: "        return { reason: mode, entry: entry };",
      replace: '        return { reason: "session", entry: entry };',
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
    boot([{ file: "background.js", find: "function focusInterceptDecision(data, host, ctx) {", replace: "function focusInterceptDecision(data, host, ctx) { syntax error here" }]);
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
