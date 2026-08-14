#!/usr/bin/env node
// Suite for the [2.0] pill-clarity round. Asana 1217412345143493.
//
// Four findings, one theme: the flagship widget was making claims it could not
// cash. What each part of this suite is actually guarding:
//
//   1. THE DONE TRAP — the defect that started the round. "✓ Done" permanently
//      completed the task while "stop for now, keep the task" hid behind an
//      unlabeled ×. The failure is silent and UNRECOVERABLE-FEELING: the user
//      taps the labeled button, the task closes, and nothing warned them. So the
//      binding between a LABEL and the ACTION IT ROUTES TO is asserted in both
//      directions — the control that says Complete must reach completeTask, and
//      the control that says End for now must reach clearActiveTask and must
//      never touch completeTask. Seeded both ways.
//   2. LIVENESS — a dot claiming "tracking" while nothing accrues would be a lie
//      told by the surface whose entire job is honest measurement. The indicator
//      is executed from its real source against a controlled readout, so the
//      claim is proven to follow the ENGINE'S OPEN SESSION and not mere
//      activation.
//   3. OVERLAP — the reserve must live on the shared panel root (R1) and must
//      not compound with the header rule it replaces.
//   4. PER-TASK TIME — the window is a rolling 30 days. Copy that says "month"
//      is a lie on the 3rd; the label is built from the engine's own constant.
//
// Usage: node tools/check-pill-clarity.mjs [repoRoot] [--mutate]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
const MUTATE = process.argv.includes("--mutate");
const clone = (v) => JSON.parse(JSON.stringify(v));
const rd = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

let SRC;
try {
  // [2.0] background.js joins the subject list: the heartbeat derivation and
  // the onStartup ordering it depends on both live there, and the stopwatch's
  // number is what goes wrong when either is off.
  SRC = { storage: rd("storage.js"), nt: rd("newtab.js"), css: rd("newtab.css"), bg: rd("background.js") };
} catch (e) {
  console.error(`PILL CLARITY: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

function extractFn(src, name) {
  const anchor = `\n  function ${name}(`;
  const first = src.indexOf(anchor);
  if (first === -1) throw new Error(`anchor miss: ${name}`);
  if (src.indexOf(anchor, first + 1) !== -1) throw new Error(`anchor ambiguous: ${name}`);
  const end = src.indexOf("\n  }\n", first);
  if (end === -1) throw new Error(`anchor unterminated: ${name}`);
  return src.slice(first, end + 4);
}
// A TOP-LEVEL function (background.js is not wrapped in an IIFE, so its
// functions sit at column 0 and extractFn's two-space anchor cannot see them).
function extractTopFn(src, name) {
  // `async function` too — reconcileHeartbeatAlarm and heartbeatBg are async,
  // and a plain-`function` anchor silently misses them (it threw mid-suite once,
  // which is a worse failure than a red row because it skips everything after).
  const hits = [];
  for (const anchor of [`\nfunction ${name}(`, `\nasync function ${name}(`]) {
    let i = src.indexOf(anchor);
    while (i !== -1) { hits.push(i); i = src.indexOf(anchor, i + 1); }
  }
  if (hits.length === 0) throw new Error(`top anchor miss: ${name}`);
  if (hits.length > 1) throw new Error(`top anchor ambiguous: ${name}`);
  const end = src.indexOf("\n}\n", hits[0]);
  if (end === -1) throw new Error(`top anchor unterminated: ${name}`);
  return src.slice(hits[0], end + 2);
}
// Top-level `var NAME = …;` constants, from their real declaration. Exactly one
// match or the extraction is guessing.
function extractDecl(src, name) {
  const m = src.match(new RegExp(`^  var ${name} = .*$`, "gm"));
  if (!m) throw new Error(`decl anchor miss: ${name}`);
  if (m.length !== 1) throw new Error(`decl anchor ambiguous: ${name} (${m.length})`);
  return m[0];
}
// async siblings need their own anchor form.
function extractAsyncFn(src, name) {
  const anchor = `\n  async function ${name}(`;
  const first = src.indexOf(anchor);
  if (first === -1) throw new Error(`anchor miss: async ${name}`);
  if (src.indexOf(anchor, first + 1) !== -1) throw new Error(`anchor ambiguous: async ${name}`);
  const end = src.indexOf("\n  }\n", first);
  if (end === -1) throw new Error(`anchor unterminated: async ${name}`);
  return src.slice(first, end + 4);
}

// ---------------------------------------------------------------------------
// Boot: real storage.js, plus the page-side renderers from their real source.
// ---------------------------------------------------------------------------
// [2.0] A CONTROLLABLE CLOCK, so lockstep can be asserted at all.
//
// The claim under test is "these two surfaces show the same count at the same
// instant, and both advance". Real time cannot demonstrate that: two reads
// microseconds apart agree by luck, not by construction, and the failure this
// round is about — one surface taking a LATER read than the other inside the
// same pass — is exactly what luck hides. Pinning the clock makes a straddled
// second-boundary reproducible on demand instead of one paint in a thousand.
//
// Subclassing keeps `new Date(ts)` / toLocaleTimeString real; only `now()` and
// the argument-less constructor answer to the pin. `Date` inside the static
// resolves to the host's real Date (the class binding is ClockDate), so there
// is no recursion.
let CLOCK = null;
class ClockDate extends Date {
  constructor(...a) { if (a.length === 0 && CLOCK !== null) super(CLOCK); else super(...a); }
  static now() { return CLOCK !== null ? CLOCK : Date.now(); }
}
const setClock = (t) => { CLOCK = t; };

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
    },
    console: { log() {}, warn() {}, error() {} },
    Date: ClockDate, Math, JSON, Object, Array, String, Number, Boolean, Promise, Set, Map,
    isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src.storage, ctx, { filename: "storage.js" });
  // The renderers under test, from newtab.js itself. `data`, `satReadout`,
  // `satTaskWindow` and `Tracking` are the page globals they close over; the
  // suite drives them directly, which is the whole point — the indicator's
  // claim is a function of the readout, and that is what gets varied.
  vm.runInContext(
    [
      extractDecl(src.nt, "SAT_LIVE_TITLE"),
      extractDecl(src.nt, "SAT_ACTIVE_TITLE"),
      extractDecl(src.nt, "SAT_ALL_WORKSPACES"),
      extractFn(src.nt, "escapeHtml"),
      extractFn(src.nt, "fmtDurationHM"),
      extractFn(src.nt, "satWindowDays"),
      extractFn(src.nt, "satTrackingIndicatorHtml"),
      extractFn(src.nt, "satWindowLineHtml"),
      // The session-clock switch, executed rather than pattern-matched: the
      // whole point is WHICH number it returns and what it calls it.
      extractFn(src.nt, "satFmtLong"),
      extractFn(src.nt, "satLiveMs"),
      extractFn(src.nt, "satPomoPhaseTotalMs"),
      extractFn(src.nt, "satPomoRemainingMs"),
      extractFn(src.nt, "satRunningPomo"),
      extractFn(src.nt, "satActiveElapsedMs"),
      extractFn(src.nt, "satFmtStopwatch"),
      extractFn(src.nt, "satStopwatchText"),
      extractFn(src.nt, "satRowLiveState"),
      extractFn(src.nt, "satRowLiveHtml"),
      // [2.0] The CARD's copy of the same count, so LOCKSTEP can be executed
      // rather than pattern-matched: the reported symptom was one surface moving
      // while the other held still, and only running both against one clock can
      // tell those apart.
      extractFn(src.nt, "fmtShortDate"),
      extractFn(src.nt, "satActiveSinceText"),
      // [2.0 hero swap] Both headline builders, executed. Which number is the
      // HERO and which is demoted is the whole change; asserting it by regex on
      // the source would pass on markup that never renders.
      extractFn(src.nt, "satSinceHtml"),
      extractFn(src.nt, "satHeadlineHtml"),
      extractFn(src.nt, "satIdleHeadlineHtml"),
      // [2.0] The worked clock's builders, executed rather than pattern-matched:
      // the whole question is WHICH number they print and what they call it.
      extractDecl(src.nt, "SAT_WORKED_TITLE"),
      extractFn(src.nt, "fmtDurationHM"),
      extractFn(src.nt, "satWorkedText"),
      extractFn(src.nt, "satWorkedChipHtml"),
      extractFn(src.nt, "satWorkedLineHtml"),
    ].join("\n"), ctx, { filename: "newtab.js#pill" });
  ctx.data = null;
  ctx.satReadout = { taskId: null, baseMs: 0, openSince: null };
  ctx.satTaskWindow = { taskId: null, ms: 0 };
  ctx.Tracking = { RETENTION_DAYS: 30 };
  return { ctx, store };
}

let ctx;
try { ({ ctx } = boot(SRC)); } catch (err) {
  console.error(`PILL CLARITY: SUBJECT DID NOT LOAD — ${err && err.message}`);
  process.exit(2);
}
const S = ctx.Storage;
for (const fn of ["resolveActiveTask", "isTrackingEnabled", "isTrackingPaused", "completeTask", "clearActiveTask"]) {
  if (!S || typeof S[fn] !== "function") { console.error(`PILL CLARITY: SUBJECT DID NOT LOAD — Storage.${fn} missing`); process.exit(2); }
}
for (const fn of ["satTrackingIndicatorHtml", "satWindowLineHtml"]) {
  if (typeof ctx[fn] !== "function") { console.error(`PILL CLARITY: SUBJECT DID NOT LOAD — ${fn} did not extract`); process.exit(2); }
}

const rows = [];
const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail: String(detail) });
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// The action row's markup, sliced from satCardHtml once and reused.
const CARD = extractFn(SRC.nt, "satCardHtml");
const ACTIONS = (() => {
  const i = CARD.indexOf("var actionsRow =");
  const j = CARD.indexOf("];", i) === -1 ? CARD.indexOf("'</div>';", i) : CARD.indexOf("'</div>';", i);
  return CARD.slice(i, j + 9);
})();

await (async () => {

  // ================= 1. THE DONE TRAP: label <-> consequence ================
  //
  // A control is (label, data-sat-act) and the act is what routes. Both halves
  // are asserted, and so is the routing on the other side of the handler.
  const btn = (act) => {
    // the markup fragment for the button carrying this act
    const re = new RegExp(`<button[^>]*data-sat-act="${act}"[^>]*>`, "g");
    const m = ACTIONS.match(new RegExp(`'<button type="button"[^']*data-sat-act="${act}"[\\s\\S]*?</button>'`));
    if (m) return m[0];
    // the builder splits attributes across concatenated string literals
    const i = ACTIONS.indexOf(`data-sat-act="${act}"`);
    if (i === -1) return "";
    const start = ACTIONS.lastIndexOf("<button", i);
    const end = ACTIONS.indexOf("</button>", i);
    return start === -1 || end === -1 ? "" : ACTIONS.slice(start, end + 9);
  };
  const completeBtn = btn("complete");
  const cancelBtn = btn("cancel");

  check("trap: the action row still carries all four controls",
    ["complete", "cancel", "pause", "switch"].every((a) => ACTIONS.includes(`data-sat-act="${a}"`)) ||
    (["complete", "cancel", "switch"].every((a) => ACTIONS.includes(`data-sat-act="${a}"`)) && CARD.includes("pauseBtn")),
    ACTIONS.slice(0, 120));

  // THE LOAD-BEARING PAIR. The word on the button and the act it fires.
  check("trap: the COMPLETE control says Complete", /Complete<\/button>|>✓ Complete/.test(completeBtn), completeBtn.slice(0, 200));
  check("trap: ...and the word 'Done' is gone from it — it never said the task ENDS",
    !/\bDone\b/.test(completeBtn), completeBtn.slice(0, 200));
  check("trap: the SET-DOWN control is LABELED, not a bare glyph",
    /End for now<\/button>/.test(cancelBtn) && !/^[^>]*>×</.test(cancelBtn), cancelBtn.slice(0, 200));
  check("trap: ...and it fires cancel, never complete", cancelBtn.includes('data-sat-act="cancel"') && !cancelBtn.includes('data-sat-act="complete"'));
  check("trap: the two live side by side at equal dignity in the primary row",
    /sat-actions-primary[\s\S]*data-sat-act="complete"[\s\S]*data-sat-act="cancel"[\s\S]*sat-actions-session/.test(ACTIONS));
  check("trap: Complete's tooltip states the consequence AND the recovery",
    /moves to Completed/i.test(completeBtn) && /(uncheck|reopen)/i.test(completeBtn), completeBtn.slice(0, 260));
  check("trap: End-for-now's tooltip says the task SURVIVES",
    /stays open/i.test(cancelBtn), cancelBtn.slice(0, 260));
  check("trap: no confirmation dialog was added on either path — labels are the fix",
    !/confirm\(|window\.confirm/.test(CARD));

  // The other side of the handler: what each act actually reaches.
  {
    const handler = SRC.nt.slice(SRC.nt.indexOf('if (act === "complete")'), SRC.nt.indexOf('if (act === "switch"'));
    check("trap: act=complete routes to satComplete, act=cancel routes to satCancel",
      /act === "complete"\s*\)\s*\{\s*await satComplete\(\)/.test(handler) &&
      /act === "cancel"\s*\)\s*\{\s*await satCancel\(\)/.test(handler), handler.slice(0, 160));
    const satComplete = extractAsyncFn(SRC.nt, "satComplete");
    const satCancel = extractAsyncFn(SRC.nt, "satCancel");
    check("trap: satComplete ends the task (completeTask) and then clears the session",
      /Storage\.completeTask\(/.test(satComplete) && /Storage\.clearActiveTask\(/.test(satComplete));
    // THE DIRECTION THAT MATTERS MOST: set-down must not be able to finish a task.
    check("trap: satCancel NEVER completes — it only clears the active session",
      /Storage\.clearActiveTask\(/.test(satCancel) && !/completeTask/.test(satCancel), satCancel.slice(0, 200));
    // The funnel rule from the cockpit round, stated where it actually bites:
    // the WIDGET must not complete a task except through satComplete. (Other
    // surfaces — the Tasks row, the Dashboard due row, the context menu — each
    // legitimately call completeTask for a task that is not necessarily active.)
    const satFns = SRC.nt.split(/\n  (?:async )?function /).filter((b) => /^sat[A-Z]/.test(b));
    const satCallers = satFns.filter((b) => /Storage\.completeTask\(/.test(b)).map((b) => b.slice(0, b.indexOf("(")));
    check("trap: satComplete is the ONLY widget function that completes a task",
      satCallers.length === 1 && satCallers[0] === "satComplete", satCallers.join(","));
  }
  // Non-destructive controls may be glyphs, but never anonymous ones.
  {
    const sw = btn("switch");
    check("trap: the glyph-only control carries BOTH a title and an aria-label",
      /title="[^"]+"/.test(sw) && /aria-label="[^"]+"/.test(sw), sw.slice(0, 160));
    check("trap: Pause keeps its word (it is the loud recovery control when paused)",
      /▶ Resume<\/button>/.test(CARD) && /⏸ Pause<\/button>/.test(CARD));
  }

  // ================= 2. LIVENESS: the claim follows the engine ==============
  const mkData = (over) => Object.assign({
    workspaces: [{ id: "w1", name: "W", tasks: [{ id: "t1", name: "T", completed: false, deletedAt: null, goalId: null, tagIds: [] }], goals: [], tags: [], trackingEnabled: true }],
    activeWorkspaceId: "w1",
    activeTask: { taskId: "t1", workspaceId: "w1", startedAt: 1000 },
    settings: { columns: 6 },
  }, over || {});
  const ind = (opts) => {
    ctx.data = opts.data === undefined ? mkData() : opts.data;
    ctx.satReadout = { taskId: opts.taskId === undefined ? "t1" : opts.taskId, baseMs: 0, openSince: opts.openSince === undefined ? null : opts.openSince };
    return ctx.satTrackingIndicatorHtml(!!opts.paused);
  };
  {
    const armed = ind({ openSince: null });
    // RE-POINTED [2.0]: the holding word was "Active" and is now "Ready". The
    // rename is the assertion, not a loosening of it — the hero swap put the
    // stopwatch's unit word ("Active") two lines above this indicator, where the
    // same word meant armed-not-accruing, so the row now asserts the word that
    // ends the collision AND asserts the colliding one is gone.
    check("liveness: armed but not accruing -> a dot and the word Ready", /sat-live-dot/.test(armed) && />Ready</.test(armed), armed);
    check("liveness: ...and it never says Active, which is the HERO's unit word two lines above",
      !/>Active</.test(armed), armed);
    check("liveness: ...and it does NOT claim to be tracking", !/Tracking/.test(armed), armed);
    check("liveness: ...and it is not the live variant", !/is-live/.test(armed), armed);
    check("liveness: ...with the reason in the tooltip, not left as a mystery",
      /not tracked|while you browse|as soon as you browse/i.test(armed), armed);
    check("liveness: ...and the tooltip was reworded WITH the label, not left explaining the old one",
      /Ready/.test(armed.match(/title="([^"]*)"/)[1]) && !/\bActive\b/.test(armed.match(/title="([^"]*)"/)[1]), armed);
    check("liveness: the rename emitted no new classes — same three nodes, same ink coverage",
      (armed.match(/class="[^"]*"/g) || []).join(" ") === 'class="sat-live" class="sat-live-dot" class="sat-live-word"', armed);

    const live = ind({ openSince: Date.now() - 60000 });
    check("liveness: an OPEN engine session -> the live variant and the word Tracking",
      /is-live/.test(live) && />Tracking</.test(live), live);
    check("liveness: ...and it says it is recording right now", /right now/i.test(live), live);
  }
  // THE TRUTHFULNESS ROW. Activation alone must never light it.
  check("liveness: mere ACTIVATION does not produce the tracking claim",
    !/Tracking/.test(ind({ openSince: null })) && /Tracking/.test(ind({ openSince: 5 })));
  check("liveness: a readout for a DIFFERENT task cannot light this task's dot",
    !/is-live/.test(ind({ taskId: "other", openSince: Date.now() })));
  eq("liveness: paused renders nothing (the amber state already owns it)", ind({ paused: true, openSince: Date.now() }), "");
  eq("liveness: no active task renders nothing", ind({ data: mkData({ activeTask: null }) }), "");
  {
    // Q7: the fixture verifies its OWN seeding. isTrackingEnabled reads the
    // NESTED workspace.tracking.enabled — a flat `trackingEnabled: false` reads
    // as enabled, and the row would have passed against nothing.
    const off = mkData({ workspaces: [{ id: "w1", name: "W", tracking: { enabled: false }, tasks: [{ id: "t1", name: "T", completed: false, deletedAt: null, goalId: null, tagIds: [] }], goals: [], tags: [] }] });
    check("liveness: FIXTURE PRECONDITION — the tracking-off workspace really reads as off",
      S.isTrackingEnabled(off.workspaces[0]) === false);
    eq("liveness: tracking disabled for the workspace renders nothing", ind({ data: off }), "");
  }
  eq("liveness: null data renders nothing", ind({ data: null }), "");
  check("liveness: the live branch reads openSince, not the activation stamp",
    /satReadout\.openSince != null/.test(extractFn(SRC.nt, "satTrackingIndicatorHtml")) &&
    !/startedAt/.test(extractFn(SRC.nt, "satTrackingIndicatorHtml")));
  check("liveness: the indicator is repainted on the tick, so it can flip when the engine does",
    /satTrackingIndicatorHtml\(Storage\.isTrackingPaused\(data\)\)/.test(extractFn(SRC.nt, "satPaintTime")));
  check("liveness: reduced motion drops the animation only, not the dot or the word",
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.sat-live\.is-live \.sat-live-dot \{ animation: none; \}/.test(SRC.css) &&
    !/prefers-reduced-motion[\s\S]{0,120}\.sat-live \{[^}]*display: none/.test(SRC.css));

  // ================= 4. PER-TASK TIME: the 30-day honesty constraint ========
  const win = (ms, days) => {
    ctx.Tracking = { RETENTION_DAYS: days || 30 };
    ctx.satTaskWindow = { taskId: ms > 0 ? "t1" : null, ms: ms };
    return ctx.satWindowLineHtml();
  };
  eq("window: a task with no measured time renders NOTHING (no '0m' noise)", win(0), "");
  eq("window: ...and a null cache renders nothing either", (ctx.satTaskWindow = { taskId: null, ms: 0 }, ctx.satWindowLineHtml()), "");
  {
    const line = win(3600000 + 20 * 60000);
    check("window: a measured total renders the duration", /1h20m/.test(line), line);
    check("window: ...labeled as a ROLLING WINDOW, never a calendar month",
      /last 30 days/.test(line) && !/month/i.test(line), line);
    check("window: ...and the tooltip says the history does not go further back",
      /no more history/i.test(line), line);
  }
  check("window: the label follows the ENGINE's retention constant, not a literal 30",
    /last 45 days/.test(win(60000, 45)), win(60000, 45));
  check("window: the source reads Tracking.RETENTION_DAYS",
    /Tracking\.RETENTION_DAYS/.test(extractFn(SRC.nt, "satWindowDays")));
  check("window: nowhere in the new copy does the product say 'this month'",
    !/this month/i.test(extractFn(SRC.nt, "satWindowLineHtml")) &&
    !/this month/i.test(extractAsyncFn(SRC.nt, "ttRefreshTaskTimes")));
  {
    const tt = extractAsyncFn(SRC.nt, "ttRefreshTaskTimes");
    // The scope ARGUMENT is asserted in section 5; this row is only about there
    // being ONE reader rather than two. It was written against scope.workspaceId
    // and widened when the 2026-08-12 diagnosis changed the read to every
    // workspace — leaving the old literal here would have made the suite argue
    // with its own section 5.
    check("window: the Tasks-row chip uses the SAME windowed reader, not a second one",
      /Tracking\.byTaskForScope\([A-Za-z_.]+, Tracking\.lastNLocalDayKeys\(satWindowDays\(\)\)\)/.test(tt));
    check("window: ...ONE read for the whole panel, not one per row",
      (tt.match(/Tracking\.byTaskForScope\(/g) || []).length === 1 && /querySelectorAll\("\[data-task-time\]"\)/.test(tt));
    check("window: ...zero renders an EMPTY slot, never a chip", /if \(!\(ms > 0\)\) \{ slot\.innerHTML = ""; return; \}/.test(tt));
    check("window: ...and it patches rather than re-rendering (inline rename survives)",
      !/renderTasksTab/.test(tt));
    check("window: ...suppressed entirely when tracking is off, not painted as zero",
      /if \(!scope\) return;/.test(tt));
    const satWin = extractAsyncFn(SRC.nt, "satRefreshTaskWindow");
    check("window: the pill's read is staleness-tokened like every other engine read here",
      /satWindowToken/.test(satWin) && /if \(token !== satWindowToken\) return;/.test(satWin));
    check("window: no new engine capture was added for this — byTask already existed",
      !/byTaskForScope/.test(SRC.storage));
  }

  // ================= 5. THE INVISIBLE CHIPS (2026-08-12 residual) ===========
  //
  // Samson tracked time and saw no chips. Two separate things were wrong, and
  // only one of them was where the hypothesis pointed.
  //
  // (a) THE READ WAS WORKSPACE-SCOPED. A day aggregate is keyed by the workspace
  //     ACTIVE AT CAPTURE, not by the task's own workspace, and
  //     rollupBucketOverWindow drops every aggregate outside the scope. The
  //     active task is global, so a two-workspace user's tasks read zero. This is
  //     the load-bearing correctness row: both readers must pass the
  //     all-workspaces sentinel, exactly as focusedTodayForTask does.
  // (b) THE CHIP SAT IN THE CONTROLS ZONE, past the divider at the far right of a
  //     1000px row. It was never hover-gated — measured opacity 1 at rest — but
  //     it belonged beside the name. VISIBLE AT REST is now asserted
  //     structurally: in the name cluster, and gated by no :hover rule anywhere.
  {
    const ttBody = extractAsyncFn(SRC.nt, "ttRefreshTaskTimes");
    const satWin = extractAsyncFn(SRC.nt, "satRefreshTaskWindow");
    const row = extractFn(SRC.nt, "taskRowHtml");
    check("chips: BOTH windowed readers read across every workspace, never the active one",
      /byTaskForScope\(SAT_ALL_WORKSPACES,/.test(ttBody) && /byTaskForScope\(SAT_ALL_WORKSPACES,/.test(satWin) &&
      !/byTaskForScope\(scope\.workspaceId/.test(ttBody) && !/byTaskForScope\(scope\.workspaceId/.test(satWin));
    check("chips: ...and the sentinel really is 'every workspace' (null), matching focusedTodayForTask",
      ctx.SAT_ALL_WORKSPACES === null);
    check("chips: tracking-off still suppresses — the fix widened the SCOPE, not the gate",
      /if \(!scope\) return;/.test(ttBody) && /if \(!scope\) \{ satTaskWindow/.test(satWin));
    // VISIBLE AT REST — the load-bearing new row.
    check("chips: the time slot lives in the NAME CLUSTER, not the right-hand controls zone",
      /tt-task-main[\s\S]*data-task-time[\s\S]*<\/span>'[\s\S]*tt-task-controls/.test(row) &&
      !/tt-task-controls[\s\S]*data-task-time/.test(row), row.slice(0, 80));
    check("chips: ...and the controls grid went back to its four original columns",
      /grid-template-columns: 72px 78px 66px 24px;/.test(SRC.css));
    {
      // No :hover rule anywhere may gate the readouts or their container — that
      // is what "visible at rest" means mechanically.
      const cssCode = SRC.css.replace(/\/\*[\s\S]*?\*\//g, "");
      const gated = /:hover[^{]*\b(tt-task-main|tt-time-chip|tt-task-live|tt-active-badge)\b[^{]*\{/.test(cssCode) ||
        /\.(tt-task-main|tt-time-chip|tt-task-live|tt-active-badge)[^{]*\{[^}]*(display: none|visibility: hidden|opacity: 0(\.0*)?;)/.test(cssCode);
      check("chips: NOTHING hover-gates or hides the readouts at rest", !gated);
      check("chips: ...and the cluster itself is not opacity-dimmed (O2)",
        !/\.tt-task-main \{[^}]*opacity:/.test(cssCode));
    }
  }

  // ================= 6. THE ACTIVE ROW ======================================
  {
    const row = extractFn(SRC.nt, "taskRowHtml");
    // REWRITTEN: the static Active badge this row also asserted is superseded —
    // the stopwatch's own ticking "active" word says the same thing and says it
    // live, so keeping both would have been the word twice. Section 8 asserts
    // the badge is gone from the markup AND the sheet.
    check("active row: it carries a live ticking figure",
      /\(isActiveTask \? satRowLiveHtml\(\) : ""\)/.test(row));
    check("active row: ...only on the active row, never on the others",
      !/satRowLiveHtml/.test(row.replace(/\(isActiveTask \? satRowLiveHtml\(\) : ""\)/g, "")));
    // REWRITTEN: the row no longer shows the ENGINE figure at all, so it no
    // longer carries the engine's sentence — it carries the stopwatch's, which
    // section 8 holds to naming the wall-clock and excluding measured browsing.
    // SAT_LIVE_TITLE stays the pill indicator's, unchanged.
    check("active row: the live figure explains itself, and the pill's own sentence is untouched",
      /title: SAT_ACTIVE_TITLE/.test(extractFn(SRC.nt, "satRowLiveState")) &&
      /escapeHtml\(s\.title\)/.test(extractFn(SRC.nt, "satRowLiveHtml")) &&
      /SAT_LIVE_TITLE/.test(extractFn(SRC.nt, "satTrackingIndicatorHtml")));
    check("active row: it is painted by the SHARED 1s tick, not a second timer",
      /document\.querySelectorAll\("\.tt-task-live"\)\.forEach/.test(extractFn(SRC.nt, "satPaintTime")) &&
      !/setInterval/.test(extractAsyncFn(SRC.nt, "ttRefreshTaskTimes")));
    {
      const paint = extractFn(SRC.nt, "satPaintTime");
      check("active row: ...and the tick writes TEXT only, so an open rename survives",
        /val\.textContent = liveState\.text/.test(paint) && /unit\.textContent = liveState\.unit/.test(paint) &&
        !/\.tt-task-live[\s\S]{0,300}innerHTML/.test(paint));
    }

    // ============= 8. THE ACTIVATION STOPWATCH — executed ===================
    //
    // SUPERSEDES the session-elapsed section that stood here. Those rows asserted
    // the two-regime switch (engine figure / session elapsed with a "session"
    // unit) and they are REWRITTEN rather than quietly deleted: the model changed
    // — an active task's clock always counts, and a work phase continues it
    // rather than replacing it — so an assertion protecting the old behaviour
    // would now be protecting the defect (a frozen number on an active task).
    //
    // Driven, not pattern-matched: the fixture puts a real activation stamp and a
    // real phase on the task and reads what comes out.
    {
      const AGO = (ms) => Date.now() - ms;
      const fix = (over) => {
        const d = mkData();
        Object.assign(d.activeTask, { startedAt: AGO(5 * 60000), activePausedMs: 0, pausedAt: null, pomodoroState: null }, over || {});
        ctx.data = d;
        ctx.satReadout = { taskId: "t1", baseMs: 7 * 60000, openSince: null };  // the ENGINE says 7:00
        return ctx.satRowLiveState();
      };
      const phase = (p, endsIn, dur) => ({ pomodoroState: { phase: p, phaseEndsAt: Date.now() + endsIn, phaseDurationMs: dur, cycleCount: 1, sessionComplete: false } });

      // IT ALWAYS COUNTS. No phase, nothing running: the clock still reads.
      const idle = fix();
      eq("stopwatch: an active task with NO session running still counts", idle.text, "5:00");
      eq("stopwatch: ...labeled 'active', which is what it measures", idle.unit, "active");
      check("stopwatch: ...and it is NOT the engine's figure", idle.text !== "7:00");

      // CONTINUITY — the spec. A work phase does not reset or replace it.
      //
      // Q8: the phase is 25min with 22 left, so its OWN elapsed is 3:00 —
      // deliberately different from both the activation age (5:00) and the engine
      // figure (7:00). The first version used 20 left, whose 5:00 elapsed happened
      // to equal the stopwatch, and the "it resets when a session starts" seed
      // ESCAPED through that tie: two different behaviours produced the same
      // string, so the assertion could not tell them apart.
      const work = fix(phase("work", 22 * 60000, 25 * 60000));
      eq("stopwatch: a WORK phase CONTINUES the same count — no reset, no replacement", work.text, idle.text);
      eq("stopwatch: ...and takes the accent treatment", work.work, true);
      eq("stopwatch: ...with the unit word unchanged", work.unit, "active");
      const brk = fix(phase("shortBreak", 3 * 60000, 5 * 60000));
      eq("stopwatch: a BREAK also continues the same count", brk.text, idle.text);
      eq("stopwatch: ...without the accent (the accent marks the stretch that counts)", brk.work, false);

      // PAUSE FREEZES IT, and the pending span counts from the first tick.
      const paused = fix({ startedAt: AGO(10 * 60000), pausedAt: AGO(4 * 60000) });
      eq("stopwatch: a pause in flight is excluded live, not one round trip later", paused.text, "6:00");
      const resumed = fix({ startedAt: AGO(10 * 60000), activePausedMs: 4 * 60000, pausedAt: null });
      eq("stopwatch: a settled pause stays excluded after resume", resumed.text, "6:00");
      eq("stopwatch: pauses accumulate across several cycles",
        fix({ startedAt: AGO(30 * 60000), activePausedMs: 12 * 60000, pausedAt: AGO(3 * 60000) }).text, "15:00");

      // IT COUNTS FROM ACTIVATION, not from the browser sitting — that is what
      // makes it survive a restart.
      check("stopwatch: it counts from startedAt, never from the per-sitting anchor",
        /a\.startedAt/.test(extractFn(SRC.nt, "satActiveElapsedMs")) &&
        !/sessionAnchorAt/.test(extractFn(SRC.nt, "satActiveElapsedMs")));
      check("stopwatch: ...and deducts the ACTIVATION-LIFETIME paused total, not the per-sitting one",
        /a\.activePausedMs/.test(extractFn(SRC.nt, "satActiveElapsedMs")) &&
        !/a\.pausedMs/.test(extractFn(SRC.nt, "satActiveElapsedMs")));
      // Per-path, NOT a count. This was `>= 3` and it went slack the moment
      // [2.0] added a fourth accrual path: removing one of the original three
      // still left three, so a real regression passed. A threshold over a
      // growing population stops testing anything — name the paths instead.
      for (const [label, fn] of [
        ["resume (setTrackingPaused)", "setTrackingPaused"],
        ["the browser-session anchor", "anchorBrowserSession"],
        ["re-picking the same task (setActiveTask)", "setActiveTask"],
        ["the closed-browser fold", "foldClosedBrowserSpan"],
      ]) {
        const i = SRC.storage.indexOf(`  async function ${fn}(`);
        const body = i === -1 ? "" : SRC.storage.slice(i, SRC.storage.indexOf("\n  }\n", i));
        check(`stopwatch: the lifetime total accrues on the path that folds a span — ${label}`,
          /activePausedMs = \(/.test(body), fn);
      }
      check("stopwatch: ...and the browser anchor folds the open span BEFORE zeroing the per-sitting one",
        /if \(active\.pausedAt != null\) \{[\s\S]{0,200}activePausedMs[\s\S]{0,160}active\.sessionAnchorAt = now;/.test(SRC.storage));
      eq("stopwatch: a legacy record with no stamp reads 0 rather than an epoch-sized number",
        (() => { const d = mkData(); d.activeTask = { taskId: "t1", workspaceId: "w1" }; ctx.data = d; return ctx.satActiveElapsedMs(); })(), 0);

      // FORMAT.
      eq("format: under an hour is M:SS", ctx.satFmtStopwatch(5 * 60000 + 12000), "5:12");
      eq("format: under a day is H:MM:SS", ctx.satFmtStopwatch(3 * 3600000 + 4 * 60000 + 9000), "3:04:09");
      eq("format: a day or more is Xd Yh", ctx.satFmtStopwatch(2 * 86400000 + 5 * 3600000), "2d 5h");
      eq("format: exactly 24h crosses to the day form", ctx.satFmtStopwatch(86400000), "1d 0h");
      eq("format: zero is 0:00, never blank", ctx.satFmtStopwatch(0), "0:00");

      // HONESTY GUARDS.
      check("stopwatch: the word the product reserves for ENGINE time never appears on it",
        !/focused/i.test(work.unit) && !/focused/i.test(work.title) && !/focused/i.test(idle.unit));
      check("stopwatch: the tooltip names the wall-clock AND excludes measured browsing",
        /wall-clock/i.test(work.title) && /not measured browsing/i.test(work.title) && /pauses excluded/i.test(work.title));
      check("stopwatch: it is never blended with the engine figure — the switch does not read satLiveMs at all",
        !/satLiveMs/.test(extractFn(SRC.nt, "satRowLiveState")) && !/satLiveMs/.test(extractFn(SRC.nt, "satActiveElapsedMs")));
      check("stopwatch: ...and no surface sums the two",
        !/satActiveElapsedMs\(\)\s*\+\s*satLiveMs/.test(SRC.nt) && !/satLiveMs\(\)\s*\+\s*satActiveElapsedMs/.test(SRC.nt));
      check("stopwatch: FOCUSED TODAY still comes from the ENGINE, untouched",
        /satFmtLong\(satLiveMs\(\)\)/.test(extractFn(SRC.nt, "satHeadlineHtml")) &&
        /satFmtLong\(satLiveMs\(\)\)/.test(extractFn(SRC.nt, "satIdleHeadlineHtml")));

      // ── THE HERO SWAP, EXECUTED ───────────────────────────────────────────
      //
      // SWAPPED, not added: the rows below used to assert that FOCUSED TODAY
      // held the hero slot on the idle card ([1.2.3]). That decision is amended
      // — the hero of a live widget must be alive, and FOCUSED TODAY cannot move
      // while this page is the focused tab — so the assertions move with it
      // rather than being deleted. What did NOT change is asserted just as hard:
      // the takeover and session-done cards still lead with FOCUSED TODAY, and
      // the two numbers are still never blended.
      {
        const d = mkData();
        Object.assign(d.activeTask, { startedAt: Date.now() - 5 * 60000, activePausedMs: 0, pausedAt: null, pomodoroState: null });
        ctx.data = d;
        ctx.satReadout = { taskId: "t1", baseMs: 7 * 60000, openSince: null };   // engine says 7:00, stopwatch says 5:00
        ctx.satTaskWindow = { taskId: "t1", ms: 42 * 60000 };
        const idleHtml = ctx.satIdleHeadlineHtml(false);
        const doneHtml = ctx.satHeadlineHtml(false);
        const heroText = (idleHtml.match(/<div class="sat-hero-time">([^<]*)</) || [])[1];
        const todayText = (idleHtml.match(/<span class="sat-time">([^<]*)</) || [])[1];

        eq("hero: the idle card LEADS with the activation stopwatch", heroText, "5:00");
        eq("hero: ...labeled 'Active' — the unit of a wall-clock, never 'focused'", (idleHtml.match(/class="sat-hero-label"[^>]*>([^<]*)</) || [])[1], "Active");
        check("hero: ...and carries the wall-clock tooltip to its new position",
          idleHtml.indexOf(ctx.escapeHtml(ctx.SAT_ACTIVE_TITLE)) !== -1 && /wall-clock/i.test(ctx.SAT_ACTIVE_TITLE));
        eq("hero: FOCUSED TODAY is DEMOTED, NOT DROPPED — still rendered, from the engine", todayText, "7:00");
        check("hero: ...with its label intact", /class="sat-time-label-text">Focused today</.test(idleHtml));
        check("hero: ...and its liveness indicator intact", /class="sat-live/.test(idleHtml));
        check("hero: the two are never blended — both numbers appear, each once, neither summed",
          heroText !== todayText && idleHtml.indexOf("12:00") === -1);
        check("hero: the stopwatch sits ABOVE the engine figure (that is the swap)",
          idleHtml.indexOf('class="sat-hero-time"') < idleHtml.indexOf('class="sat-time"'));
        check("hero: the timestamp stays WITH the stopwatch, and drops the count it used to lead with",
          /class="sat-since">since /.test(idleHtml) && !/class="sat-since">Active /.test(idleHtml));
        check("hero: the windowed total still trails the block",
          idleHtml.indexOf('class="sat-window"') > idleHtml.indexOf('class="sat-today"'));

        // UNCHANGED, and asserted so the swap cannot silently reach them.
        eq("hero: the takeover / session-done builder STILL leads with FOCUSED TODAY",
          (doneHtml.match(/<div class="sat-time">([^<]*)</) || [])[1], "7:00");
        check("hero: ...and its since-line still leads with the count, which has no other home there",
          /class="sat-since">Active /.test(doneHtml) && !/class="sat-hero-time"/.test(doneHtml));

        // PAUSED: both numbers are frozen, and the word is said exactly once.
        const pausedHtml = ctx.satIdleHeadlineHtml(true);
        eq("hero: a pause renames the HERO's unit word", (pausedHtml.match(/class="sat-hero-label"[^>]*>([^<]*)</) || [])[1], "Paused");
        check("hero: ...exactly once — FOCUSED TODAY keeps its own label rather than repeating it",
          (pausedHtml.match(/Paused/g) || []).length === 1 && /Focused today/.test(pausedHtml));
        check("hero: ...and the amber treatment covers BOTH frozen numbers",
          /\.sat-expanded\.is-paused[\s\S]{0,200}\.sat-hero-time,/.test(SRC.css) &&
          /\.sat-expanded\.is-paused \.sat-time,/.test(SRC.css));

        // The hero is a TICKING surface — the entire point of the swap.
        check("hero: the tick repaints it, from the shared clock edge",
          /heroEl\.textContent = stopwatch;/.test(extractFn(SRC.nt, "satPaintTime")));
        check("hero: ...and it does NOT wear .sat-time, which the paint fills with the ENGINE figure",
          !/class="sat-hero-time sat-time|class="sat-time sat-hero-time/.test(SRC.nt));
        // The light-frame rows bind the selector to the DECLARATION it must sit
        // in — `[^{}]*` cannot cross a brace, so a hero listed only in the
        // neighbouring text-shadow group no longer satisfies a colour check.
        // Written loosely the first time, and the "ink is left to inherit" seed
        // ESCAPED straight through it (Q2: an assertion that matches the wrong
        // rule is not coverage).
        check("hero: its ink is declared on the dark frame and overridden on the light one",
          /\.sat-hero-time \{[^}]*color: #fff;/.test(SRC.css) &&
          /html\.bg-light \.sat-hero-time,[^{}]*\{ color: var\(--text-primary\)/.test(SRC.css) &&
          /\.sat-hero-label \{[^}]*color: rgba\(255, 255, 255/.test(SRC.css) &&
          /html\.bg-light \.sat-hero-label,[^{}]*\{ color: var\(--text-secondary\)/.test(SRC.css));
        ctx.satTaskWindow = { taskId: null, ms: 0 };
      }

      // THE CARD CARRIES THE SAME COUNT, from the same helper.
      const since = extractFn(SRC.nt, "satActiveSinceText");
      const paintFn = extractFn(SRC.nt, "satPaintTime");
      check("cross-surface: the card's since-line shows the SAME stopwatch, from the same helper",
        /satStopwatchText\(\)/.test(since) && /satFmtStopwatch\(satActiveElapsedMs\(\)\)/.test(extractFn(SRC.nt, "satStopwatchText")));
      check("cross-surface: ...and keeps the timestamp, which is what makes a long count readable",
        /since " \+ since/.test(since) && /toLocaleTimeString/.test(since));
      // Re-pointed [2.0 hero swap]: the window widened from 200 to 500 because
      // the branch note explaining the leadWithCount flag now sits between the
      // query and the call. The ASSERTION is unchanged — this line is painted by
      // the tick — only the distance the anchor has to reach.
      check("cross-surface: the card's since-line is repainted by the tick, or it would freeze",
        /\.sat-since"\)[\s\S]{0,500}satActiveSinceText\(/.test(paintFn));
      check("cross-surface: ...and a sentence that stops computing REMOVES the line instead of leaving the last one frozen",
        /sinceEl\.textContent = sinceTxt;\s*\n\s*else sinceEl\.remove\(\);/.test(paintFn));

      // ── LOCKSTEP, EXECUTED ────────────────────────────────────────────────
      //
      // The reported symptom (2026-08-13): the task row's stopwatch ticked while
      // the card's "Active 0:06 · since 2:49 PM" held still. Both are the same
      // count; a user seeing them disagree has no way to know which is lying.
      // These rows run the two REAL producers against ONE pinned clock, so a
      // surface that freezes, lags, or takes its own later read fails here
      // rather than in a screenshot.
      const cardCount = (s) => (s.match(/^Active (.+?) · since /) || [])[1];
      {
        const T0 = Date.UTC(2026, 7, 13, 6, 49, 0);
        const at = (t, startedAt) => {
          setClock(t);
          const d = mkData();
          Object.assign(d.activeTask, { startedAt, activePausedMs: 0, pausedAt: null, pomodoroState: null });
          ctx.data = d;
          ctx.satReadout = { taskId: "t1", baseMs: 7 * 60000, openSince: null };
          return { card: cardCount(ctx.satActiveSinceText()), row: ctx.satRowLiveState().text };
        };
        const s0 = at(T0, T0 - 6000);
        eq("lockstep: at one instant the card and the row show the SAME count", s0.card, s0.row);
        eq("lockstep: ...and it is the real elapsed, not a placeholder", s0.card, "0:06");
        const s3 = at(T0 + 3000, T0 - 6000);
        eq("lockstep: three seconds later BOTH have advanced — neither holds still", s3.card, "0:09");
        eq("lockstep: ...and they are still within one tick of each other", s3.card, s3.row);
        check("lockstep: the card genuinely MOVED between the two samples", s0.card !== s3.card);

        // THE CLOCK EDGE. The paint takes one read and hands it to both. Pin the
        // clock forward BETWEEN the two calls: a surface that honours the shared
        // read is unmoved, a surface that re-reads jumps a second and the pair
        // desynchronises — the 1:11/1:12 split, made deterministic.
        //
        // The activation is a HALF-second old on purpose. With a whole-second
        // stamp, +999ms lands inside the same displayed second and a re-reading
        // surface prints the same string as a sharing one — the seeds for both
        // escaped through exactly that tie on the first run. Offset by 6500 and
        // the 999ms step really does cross a boundary (0:06 -> 0:07).
        setClock(T0);
        const d = mkData();
        Object.assign(d.activeTask, { startedAt: T0 - 6500, activePausedMs: 0, pausedAt: null, pomodoroState: null });
        ctx.data = d;
        const shared = ctx.satStopwatchText();
        setClock(T0 + 999);                      // the boundary moves under the pass
        const cardTxt = cardCount(ctx.satActiveSinceText(shared));
        const rowTxt = ctx.satRowLiveState(shared).text;
        eq("clock edge: the card paints the read the tick handed it, not a fresh one", cardTxt, shared);
        eq("clock edge: ...and so does the row", rowTxt, shared);
        eq("clock edge: ...so a pass that straddles a second cannot split the two surfaces", cardTxt, rowTxt);

        // The RENDER path has no tick to share, so both must still self-serve.
        setClock(T0 + 4000);
        eq("clock edge: with no shared read (the render path) the card still computes its own",
          cardCount(ctx.satActiveSinceText()), "0:10");
        eq("clock edge: ...and so does the row", ctx.satRowLiveState().text, "0:10");
        setClock(null);
      }
      // Re-pointed [2.0 hero swap]: satActiveSinceText now takes a second
      // argument (the branch flag), and the HERO joined the same shared read —
      // so the row asserts three consumers of one call instead of two. The
      // single-read rule it protects is unchanged and is still counted.
      check("clock edge: the paint reads the stopwatch ONCE and passes it to every surface",
        /var stopwatch = satStopwatchText\(\);/.test(paintFn) &&
        /satActiveSinceText\(stopwatch, /.test(paintFn) &&
        /satRowLiveState\(stopwatch\)/.test(paintFn) &&
        /heroEl\.textContent = stopwatch;/.test(paintFn) &&
        (paintFn.match(/satStopwatchText\(\)/g) || []).length === 1);

      // The unit node is always present; the tick only writes into it.
      check("stopwatch: the unit node is always present, so the tick never restructures the row",
        /<span class="tt-live-unit">/.test(ctx.satRowLiveHtml()));
      check("stopwatch: the paint reads the shared state, not a second derivation",
        /var liveState = satRowLiveState\(stopwatch\);/.test(paintFn));
      check("stopwatch: the unit word is NOT dimmed — size and weight subordinate it, not opacity",
        !/\.tt-live-unit \{[^}]*opacity:/.test(SRC.css) &&
        /\.tt-live-unit \{[^}]*font-size: var\(--fs-10\)/.test(SRC.css));
      // The work highlight has to follow the TICK, because the row is not
      // re-rendered when a phase starts.
      check("stopwatch: the row's bar intensifies from the tick's own class, via :has()",
        /\.tt-task-row\.is-active-task:has\(\.tt-task-live\.is-work\)::after \{/.test(SRC.css) &&
        /el\.classList\.toggle\("is-work", liveState\.work\)/.test(extractFn(SRC.nt, "satPaintTime")));
      check("stopwatch: ...and the figure itself takes a tint while a work phase runs",
        /\.tt-task-live\.is-work \.tt-live-val \{/.test(SRC.css));
      // The retired badge: the ticking word replaced it, and nothing may still
      // render a class the stylesheet no longer defines.
      check("stopwatch: the superseded static Active badge is gone from BOTH the markup and the sheet",
        !/tt-active-badge/.test(SRC.nt) && !/tt-active-badge/.test(SRC.css));
    }

    // ============= 9. THE FOCUS-ROW OVERFLOW =================================
    check("focus row: it wraps, so the hint takes a second line instead of being cut",
      /\.sat-focus-row \{[^}]*flex-wrap: wrap;/.test(SRC.css));
    check("focus row: ...and the hint cannot be squeezed into an ellipsis instead of wrapping",
      /\.sat-focus-hint \{[^}]*flex: 0 0 auto;/.test(SRC.css));
    check("focus row: both strings are kept whole — neither the state nor the hint was shortened away",
      /Focus blocking: on \(auto\)/.test(SRC.nt) && /no sites listed/.test(SRC.nt));
    // The highlight, and the three-way collision it had to avoid.
    check("highlight: the accent bar is ::after — not a border (priority owns it), not an outline (paused), not a box-shadow (drag lift)",
      /\.tt-task-row\.is-active-task::after \{/.test(SRC.css) &&
      !/\.tt-task-row\.is-active-task \{[^}]*(border-left|outline|box-shadow)/.test(SRC.css));
    check("highlight: ...with a row tint, and a hover state that still reads as hover",
      /\.tt-task-row\.is-active-task \{[^}]*background: color-mix\(in srgb, var\(--sat-accent-ink\) 10%/.test(SRC.css) &&
      /\.tt-task-row\.is-active-task:hover \{[^}]*16%/.test(SRC.css));
    check("highlight: every part of it derives from a THEME TOKEN, never a literal colour",
      (SRC.css.match(/\.tt-(task-row\.is-active-task[^{]*|active-badge|task-live) \{[^}]*\}/g) || [])
        .every((b) => !/#[0-9a-f]{3,6}/i.test(b)));
    check("highlight: the Active label is text-only — no fill, so no un-chosen ink on a colour",
      !/\.tt-active-badge \{[^}]*background/.test(SRC.css));
  }

  // ================= 7. THE UNIFIED TIMER ===================================
  {
    const card = CARD;
    check("takeover: FOCUSED TODAY is rendered beneath the ring during a running phase",
      /sat-pomo-stop-row[\s\S]*?sat-pomo-today">' \+ satHeadlineHtml\(paused\)[\s\S]*?satFocusRowHtml/.test(card));
    check("takeover: ...through the SAME builder the idle card uses, not a copy",
      (card.match(/satHeadlineHtml\(/g) || []).length >= 2 && !/class="sat-time"/.test(card));
    check("takeover: only its SCALE changes, and only in CSS",
      /\.sat-pomo-today \.sat-time \{[^}]*font-size: var\(--fs-15\)/.test(SRC.css));
    check("takeover: the paint no longer returns early, so the kept headline still ticks",
      !/fill\.style\.strokeDashoffset[\s\S]{0,200}\n      return;/.test(extractFn(SRC.nt, "satPaintTime")));
    check("highlight: the ring is emphasised for a WORK phase only",
      /var pomoWork = pomo\.phase === "work";/.test(card) &&
      /sat-expanded-pomo' \+ \(pomoWork \? ' is-work' : ''\)/.test(card) &&
      /\.sat-expanded-pomo\.is-work \.sat-pomo-ring-fill \{/.test(SRC.css));
    check("highlight: ...as a drop-shadow, because a box-shadow on an SVG circle draws a rectangle",
      /\.sat-expanded-pomo\.is-work \.sat-pomo-ring-fill \{[^}]*filter: drop-shadow/.test(SRC.css));
  }

  // ================= 3. OVERLAP: the reserve ================================
  check("overlap: the reserve is on the SHARED panel root (R1), gated on the card being open",
    /body\.sat-card-open \.tab-panel \{[^}]*padding-right: 300px;/.test(SRC.css));
  // The compounding trap: two reserves inside one another would throw the header
  // cluster into the middle of the page.
  {
    // Comments stripped first: the replacement rule's own note QUOTES the deleted
    // selector to explain why it went, and scanning the prose would report the
    // documentation as the defect.
    const cssCode = SRC.css.replace(/\/\*[\s\S]*?\*\//g, "");
    check("overlap: the old header-only reserve is GONE — the two would have compounded to 600px",
      !/body\.sat-card-open \.tasks-header-right \{/.test(cssCode) &&
      !/\.tasks-header-right \{[^}]*margin-right: 300px/.test(cssCode));
  }
  check("overlap: released in the stacked layout, where a right gutter is dead space",
    /@media \(max-width: 720px\) \{\s*body\.sat-card-open \.tab-panel \{ padding-right: 0; \}/.test(SRC.css));
  check("overlap: it slides rather than jumping, matching the card's minimize feel",
    /body\.sat-card-open \.tab-panel \{[^}]*transition: padding-right/.test(SRC.css));
  check("overlap: the class it keys on is really toggled by the widget",
    /classList\.toggle\("sat-card-open", showCard\)/.test(SRC.nt));

  // ================= O1 ink on every new text surface =======================
  // All of this is JS-rendered, so tools/check-panel-ink.mjs cannot see any of
  // it — these rows are the only thing standing between a new line and the
  // a68dd89 failure (a text rule with no colour, invisible on frosted dark).
  for (const [label, sel] of [["sat-live", "\\.sat-live"], ["sat-window", "\\.sat-window"], ["tt-time-chip", "\\.tt-time-chip"]]) {
    check(`ink: ${label} declares its own colour on the dark frame`,
      new RegExp(`^${sel} \\{[^}]*color: `, "m").test(SRC.css), label);
    check(`ink: ${label} has a light-wallpaper override`,
      new RegExp(`html\\.(has-bg\\.)?bg-light [^{]*${sel}[^{]*\\{`).test(SRC.css), label);
  }
  check("ink: the armed dot's fill is declared on both frames",
    /\.sat-live-dot \{[^}]*background: /.test(SRC.css) && /html\.bg-light \.sat-live-dot \{[^}]*background: /.test(SRC.css));
  check("ink: no new cockpit/pill rule dims a container that holds a control (O2)",
    !/\.sat-(live|window|actions|actions-primary|actions-session) \{[^}]*opacity:/.test(SRC.css));
  check("ink: the new frosted surfaces added no literal rgba(30,30,30) or blur()",
    !/\.sat-(live|window)[^{]*\{[^}]*rgba\(30, ?30, ?30/.test(SRC.css));

  // ================= [2.0] BROWSER-CLOSED TIME IS PAUSED TIME ===============
  //
  // The stopwatch's semantics changed under it: closed-browser spans are now
  // folded out retroactively. This section owns the ARITHMETIC (the pill's
  // number is what goes wrong) — check-bg-queue owns the serialization.
  //
  // The defect that started the round is a NUMBER, so it is asserted as a
  // number, end to end: fold, then run the REAL satActiveElapsedMs over the
  // REAL storage record and compare the string a user would read.
  //
  // THE EPOCH-FOLD CATASTROPHE is the one to fear more than the bug being
  // fixed. `now - 0` is fifty-six years; folded into activePausedMs it pins the
  // stopwatch at 0:00 permanently with no user-reachable way back. Every
  // no-evidence shape is therefore asserted to fold NOTHING and — just as
  // importantly — to leave the task RUNNING, because a pause without a fold
  // freezes a count that still contains the closed hours.
  const H = 3600000;
  const T0 = 1755000000000;
  const seedActive = (over) => Object.assign({
    workspaces: [{ id: "main", name: "Main", groups: [], shortcuts: [], tasks: [{ id: "t1", name: "Test task" }] }],
    activeWorkspaceId: "main",
    trackingPaused: false,
    activeTask: {
      taskId: "t1", workspaceId: "main", startedAt: T0, sessionAnchorAt: T0,
      activePausedMs: 0, pausedAt: null, pausedMs: 0, idleAt: null, idleMs: 0
    }
  }, over || {});

  // --- the pure fold, every shape ---
  const fold = (hb, now, over) => S.closedBrowserFoldMs(seedActive(over).activeTask, hb, now);
  check("fold: a good beat folds exactly the closed span",
    fold({ at: T0 + 2 * H, taskId: "t1" }, T0 + 20 * H) === 18 * H);
  check("fold: NO heartbeat at all folds nothing", fold(null, T0 + 20 * H) === 0);
  check("fold: an undefined heartbeat folds nothing", fold(undefined, T0 + 20 * H) === 0);
  // The catastrophe, stated as the arithmetic it would produce.
  check("fold: at === 0 folds NOTHING, not fifty-six years",
    fold({ at: 0, taskId: "t1" }, T0 + 20 * H) === 0);
  check("fold: a missing `at` field folds nothing", fold({ taskId: "t1" }, T0 + 20 * H) === 0);
  check("fold: a non-numeric `at` folds nothing",
    fold({ at: "1755000000000", taskId: "t1" }, T0 + 20 * H) === 0);
  check("fold: NaN / Infinity fold nothing",
    fold({ at: NaN, taskId: "t1" }, T0 + 20 * H) === 0 &&
    fold({ at: Infinity, taskId: "t1" }, T0 + 20 * H) === 0);
  check("fold: a negative `at` folds nothing", fold({ at: -1, taskId: "t1" }, T0 + 20 * H) === 0);
  // A beat from another activation would fold that task's closure into this one.
  check("fold: a beat belonging to ANOTHER task folds nothing",
    fold({ at: T0 + 2 * H, taskId: "other" }, T0 + 20 * H) === 0);
  check("fold: a beat with no taskId folds nothing",
    fold({ at: T0 + 2 * H }, T0 + 20 * H) === 0);
  // Older than the activation = corrupt; folding it could exceed the elapsed
  // time and pin the count at zero, which is the catastrophe by another route.
  check("fold: a beat older than the activation folds nothing",
    fold({ at: T0 - 1, taskId: "t1" }, T0 + 20 * H) === 0);
  check("fold: a beat in the FUTURE clamps to 0 (clock moved back)",
    fold({ at: T0 + 30 * H, taskId: "t1" }, T0 + 20 * H) === 0);
  check("fold: an activation with no startedAt folds nothing",
    S.closedBrowserFoldMs({ taskId: "t1" }, { at: T0, taskId: "t1" }, T0 + H) === 0);
  check("fold: the fold can never exceed the elapsed activation time",
    fold({ at: T0, taskId: "t1" }, T0 + 20 * H) === 20 * H);

  // --- end to end: the morning the round exists for ---
  // 2h of real work, the browser dies, 18h closed, relaunch.
  await (async () => {
    setClock(T0 + 20 * H);
    const d = seedActive();
    d.activeTask.lastBeat = undefined;
    const wrote = await S.foldClosedBrowserSpan(d, { at: T0 + 2 * H, taskId: "t1" });
    ctx.data = d;
    check("THE 18-HOUR MORNING: the closed span is folded out", wrote === true);
    check("THE 18-HOUR MORNING: the stopwatch reads the WORK, not the night",
      ctx.satStopwatchText() === "2:00:00", ctx.satStopwatchText());
    check("THE 18-HOUR MORNING: the task comes back PAUSED", S.isTrackingPaused(d) === true);
    check("THE 18-HOUR MORNING: pausedAt is stamped, so the count is frozen",
      d.activeTask.pausedAt === T0 + 20 * H);
    check("THE 18-HOUR MORNING: the reopen notice is armed exactly once",
      d.activeTask.closedPauseNoticeAt === T0 + 20 * H);
    // Frozen means frozen: an hour of staring at it must not move the number.
    setClock(T0 + 21 * H);
    check("THE 18-HOUR MORNING: an hour later it still reads the same",
      ctx.satStopwatchText() === "2:00:00", ctx.satStopwatchText());
    // And the double-fold: a second startup must not re-charge the same span.
    const again = await S.foldClosedBrowserSpan(d, { at: T0 + 2 * H, taskId: "t1" });
    ctx.data = d;
    check("NO DOUBLE FOLD: a second fold on an already-paused task is a no-op",
      again === false && ctx.satStopwatchText() === "2:00:00", ctx.satStopwatchText());
  })();

  // --- no evidence: the legacy profile's first launch after this update ---
  await (async () => {
    setClock(T0 + 20 * H);
    const d = seedActive();
    const wrote = await S.foldClosedBrowserSpan(d, null);
    ctx.data = d;
    check("NO EVIDENCE: nothing is folded", wrote === false && d.activeTask.activePausedMs === 0);
    // The load-bearing half. Pausing here would freeze a number that STILL
    // contains the closed hours — a wrong count, now also stuck.
    check("NO EVIDENCE: and the task is NOT paused", S.isTrackingPaused(d) === false);
    check("NO EVIDENCE: no reopen notice is armed", d.activeTask.closedPauseNoticeAt == null);
    check("NO EVIDENCE: the count is the old behavior, unchanged",
      ctx.satStopwatchText() === "20:00:00", ctx.satStopwatchText());
  })();

  // --- already paused before the shutdown: the ANCHOR owns that span ---
  // This is the mutual exclusion the onStartup ordering depends on. If both
  // accounted for the closure the night would be deducted twice and the
  // stopwatch would run backwards.
  await (async () => {
    setClock(T0 + 2 * H);
    const d = seedActive();
    await S.setTrackingPaused(d, true);          // paused at T0+2h
    setClock(T0 + 20 * H);
    await S.anchorBrowserSession(d);             // onStartup, FIRST
    const wrote = await S.foldClosedBrowserSpan(d, { at: T0 + 2 * H, taskId: "t1" });
    ctx.data = d;
    check("PAUSED BEFORE SHUTDOWN: the fold declines (the anchor already folded)",
      wrote === false);
    check("PAUSED BEFORE SHUTDOWN: the night is deducted exactly ONCE",
      ctx.satStopwatchText() === "2:00:00", ctx.satStopwatchText());
    check("PAUSED BEFORE SHUTDOWN: activePausedMs holds one night, not two",
      d.activeTask.activePausedMs === 18 * H, d.activeTask.activePausedMs);
  })();

  // --- the notice is consume-on-show, exactly once ---
  await (async () => {
    setClock(T0 + 20 * H);
    const d = seedActive();
    await S.foldClosedBrowserSpan(d, { at: T0 + 2 * H, taskId: "t1" });
    check("NOTICE: the first consume reports it", S.consumeClosedPauseNotice(d) === true);
    check("NOTICE: the second consume reports nothing (fires once per fold)",
      S.consumeClosedPauseNotice(d) === false);
    check("NOTICE: consuming clears the field", d.activeTask.closedPauseNoticeAt == null);
    check("NOTICE: an ordinary startup has nothing to consume",
      S.consumeClosedPauseNotice(seedActive()) === false);
    check("NOTICE: no active task is safe", S.consumeClosedPauseNotice({}) === false);
    check("NOTICE: null data is safe", S.consumeClosedPauseNotice(null) === false);
  })();

  // --- legacy state: no new fields anywhere ---
  await (async () => {
    setClock(T0 + 20 * H);
    const legacy = seedActive();
    delete legacy.activeTask.activePausedMs;      // pre-[2.0] record shape
    delete legacy.activeTask.closedPauseNoticeAt;
    const wrote = await S.foldClosedBrowserSpan(legacy, { at: T0 + 2 * H, taskId: "t1" });
    ctx.data = legacy;
    check("LEGACY: a record with no activePausedMs folds without throwing", wrote === true);
    check("LEGACY: ...and the arithmetic still lands", ctx.satStopwatchText() === "2:00:00", ctx.satStopwatchText());
    check("LEGACY: consuming a notice on a pre-[2.0] record is safe",
      S.consumeClosedPauseNotice(seedActive()) === false);
  })();
  setClock(null);

  // ================= [2.0] THE PER-TASK WORKED CLOCK ========================
  //
  // Lifetime wall-clock active time per task, banked at every deactivation.
  //
  // THE FAILURE THIS SECTION EXISTS FOR IS A LEAK: a deactivation path that
  // does not bank means the user works for an hour, the total does not move,
  // and nothing anywhere reports an error. So the boundaries are asserted BY
  // NAME, one row each, executed against the real setters — not counted, and
  // not sampled. (Last round's lesson: a threshold over a growing population
  // stops testing anything the moment the population grows.)
  const WH = 3600000;
  const WT0 = 1755000000000;
  const mkWorked = (over) => Object.assign({
    workspaces: [{
      id: "main", name: "Main", groups: [], shortcuts: [],
      tasks: [
        { id: "t1", name: "Task one", displayOrder: 1 },
        { id: "t2", name: "Task two", displayOrder: 2 }
      ]
    }],
    activeWorkspaceId: "main",
    trackingPaused: false,
    activeTask: null
  }, over || {});
  // An activation of `id` that began `agoMs` ago with `pausedMs` already banked.
  const activation = (id, startedAt, pausedTotal, pausedAt) => ({
    taskId: id, workspaceId: "main", startedAt: startedAt,
    activePausedMs: pausedTotal || 0, pausedAt: pausedAt == null ? null : pausedAt,
    pausedMs: 0, idleAt: null, idleMs: 0, sessionAnchorAt: startedAt
  });
  const taskOf = (d, id) => d.workspaces[0].tasks.filter((t) => t.id === id)[0];

  // --- the arithmetic, before any boundary ---
  check("worked: one activation's span is elapsed minus paused",
    S.activationWorkedMs(activation("t1", WT0, 30 * 60000), WT0 + 2 * WH) === 2 * WH - 30 * 60000);
  check("worked: an OPEN paused span counts as paused, live",
    S.activationWorkedMs(activation("t1", WT0, 0, WT0 + WH), WT0 + 2 * WH) === WH);
  check("worked: a record with no startedAt is 0, not an epoch-sized number",
    S.activationWorkedMs({ taskId: "t1" }, WT0 + WH) === 0);
  check("worked: null activation is 0", S.activationWorkedMs(null, WT0) === 0);
  check("worked: it can never go negative", S.activationWorkedMs(activation("t1", WT0, 99 * WH), WT0 + WH) === 0);
  // THE EQUIVALENCE THAT KEEPS THE LIVE ROW HONEST. The row shows banked + this,
  // and the pill's stopwatch shows this — a divergence would make the number
  // jump at the instant of banking. Both derivations are EXECUTED against the
  // same records rather than compared by eye.
  check("worked: Storage's derivation is numerically IDENTICAL to the pill's stopwatch", (() => {
    const cases = [
      activation("t1", WT0, 0), activation("t1", WT0, 30 * 60000),
      activation("t1", WT0, 0, WT0 + WH), activation("t1", WT0, 15 * 60000, WT0 + WH),
      { taskId: "t1" }, activation("t1", 0, 0)
    ];
    setClock(WT0 + 3 * WH);
    for (const a of cases) {
      const d = mkWorked({ activeTask: a });
      ctx.data = d;
      if (ctx.satActiveElapsedMs() !== S.activationWorkedMs(a, WT0 + 3 * WH)) return false;
    }
    setClock(null);
    return true;
  })());

  // --- THE BOUNDARIES, ONE NAMED ROW EACH ---
  // Every path that ends an activation terminates at clearActiveTask or at
  // setActiveTask's replace branch. Each row drives the REAL setter.
  await (async () => {
    // 1. End for now (pill card) -> clearActiveTask
    setClock(WT0 + 2 * WH);
    let d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.clearActiveTask(d);
    check("BOUNDARY 1/8 — End for now banks the span", taskOf(d, "t1").workedMs === 2 * WH, taskOf(d, "t1").workedMs);
    check("BOUNDARY 1/8 — ...and the activation is gone", d.activeTask === null);

    // 2. Complete from the card (D6: completeTask, then clearActiveTask)
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.completeTask(d, "t1", "main");
    await S.clearActiveTask(d);
    check("BOUNDARY 2/8 — Complete from the card banks the span",
      taskOf(d, "t1").workedMs === 2 * WH, taskOf(d, "t1").workedMs);
    check("BOUNDARY 2/8 — ...and the total SURVIVES on the completed task",
      taskOf(d, "t1").completed === true && taskOf(d, "t1").workedMs === 2 * WH);

    // 3. Switching to another task -> setActiveTask's replace branch
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.setActiveTask(d, "t2", "main", { clearPause: true });
    check("BOUNDARY 3/8 — switching banks the OUTGOING task",
      taskOf(d, "t1").workedMs === 2 * WH, taskOf(d, "t1").workedMs);
    check("BOUNDARY 3/8 — ...and the incoming task is not credited",
      taskOf(d, "t2").workedMs === undefined || taskOf(d, "t2").workedMs === 0);
    check("BOUNDARY 3/8 — ...and the new activation starts clean",
      d.activeTask.taskId === "t2" && d.activeTask.activePausedMs === 0);

    // 4. The pill's self-heal (task completed/deleted anywhere, incl. another tab)
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.deleteTask(d, "t1", "main");        // now stale; the pill self-heals
    await S.clearActiveTask(d);
    check("BOUNDARY 4/8 — the self-heal banks rather than dropping the span",
      taskOf(d, "t1").workedMs === 2 * WH, taskOf(d, "t1").workedMs);

    // 5. Complete from a task row / the context menu: leaves the record dangling,
    //    and the next render's self-heal is what actually ends it.
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.completeTask(d, "t1", "main");
    check("BOUNDARY 5/8 — completing from a row does NOT bank on its own (it does not deactivate)",
      taskOf(d, "t1").workedMs === undefined);
    await S.clearActiveTask(d);
    check("BOUNDARY 5/8 — ...the self-heal that follows banks it exactly once",
      taskOf(d, "t1").workedMs === 2 * WH, taskOf(d, "t1").workedMs);

    // 6. Deleted while active — a TRASHED task must still be credited, because
    //    deletion is reversible and restoring must not lose the history.
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.deleteTask(d, "t1", "main");
    await S.clearActiveTask(d);
    const restored = await S.restoreTask(d, "t1", "main");
    check("BOUNDARY 6/8 — a task trashed while active keeps its worked total on restore",
      restored && restored.workedMs === 2 * WH, restored && restored.workedMs);

    // 7. Hard purge while active — the task is gone, so there is nothing to
    //    credit. The requirement is that banking does not THROW.
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.deleteTaskPermanent(d, "t1", "main");
    let threw = false;
    try { await S.clearActiveTask(d); } catch (e) { threw = true; }
    check("BOUNDARY 7/8 — a hard purge mid-activation is survivable, not a throw", !threw);
    check("BOUNDARY 7/8 — ...and the activation still ends", d.activeTask === null);

    // 8. Re-picking the ALREADY-active task must NOT bank: the activation
    //    continues, so banking here would credit the span twice.
    d = mkWorked({ activeTask: activation("t1", WT0), trackingPaused: true });
    d.activeTask.pausedAt = WT0 + WH;
    await S.setActiveTask(d, "t1", "main", { clearPause: true });
    check("BOUNDARY 8/8 — re-picking the SAME task does not bank (the activation continues)",
      taskOf(d, "t1").workedMs === undefined, taskOf(d, "t1").workedMs);
    check("BOUNDARY 8/8 — ...and the record is kept, not replaced",
      d.activeTask.startedAt === WT0);

    // NO DOUBLE FOLD across a repeated deactivation.
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.clearActiveTask(d);
    await S.clearActiveTask(d);
    check("no double fold: a second clearActiveTask is a no-op",
      taskOf(d, "t1").workedMs === 2 * WH, taskOf(d, "t1").workedMs);

    // ACCUMULATION across activations — the whole point of the feature.
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.clearActiveTask(d);
    setClock(WT0 + 5 * WH);
    await S.setActiveTask(d, "t1", "main", { clearPause: true });
    setClock(WT0 + 6 * WH);
    await S.clearActiveTask(d);
    check("ACCUMULATION: two activations sum (2h then 1h = 3h)",
      taskOf(d, "t1").workedMs === 3 * WH, taskOf(d, "t1").workedMs);

    // PAUSE IS EXCLUDED end to end, through the real pause setter.
    setClock(WT0);
    d = mkWorked({ activeTask: activation("t1", WT0) });
    setClock(WT0 + WH);
    await S.setTrackingPaused(d, true);          // worked 1h, now paused
    setClock(WT0 + 3 * WH);
    await S.setTrackingPaused(d, false);         // 2h of pause
    setClock(WT0 + 4 * WH);
    await S.clearActiveTask(d);                  // 1h more worked
    check("PAUSE EXCLUDED: 4h elapsed, 2h paused, banks 2h",
      taskOf(d, "t1").workedMs === 2 * WH, taskOf(d, "t1").workedMs);
    // ...and while still paused, the live figure does not move.
    setClock(WT0 + WH);
    d = mkWorked({ activeTask: activation("t1", WT0) });
    await S.setTrackingPaused(d, true);
    const frozenA = S.taskWorkedMs(d, taskOf(d, "t1"), WT0 + WH);
    const frozenB = S.taskWorkedMs(d, taskOf(d, "t1"), WT0 + 9 * WH);
    check("PAUSE EXCLUDED: the LIVE total is frozen while paused", frozenA === frozenB, `${frozenA} vs ${frozenB}`);

    // THE LIVE ROW = BANKED + CURRENT, and banking must not make it jump.
    setClock(WT0 + 2 * WH);
    d = mkWorked({ activeTask: activation("t1", WT0) });
    taskOf(d, "t1").workedMs = 5 * WH;                       // 5h already banked
    const liveBefore = S.taskWorkedMs(d, taskOf(d, "t1"), WT0 + 2 * WH);
    check("LIVE = banked + current", liveBefore === 7 * WH, liveBefore);
    await S.clearActiveTask(d);
    check("...and banking does not make the number JUMP",
      taskOf(d, "t1").workedMs === liveBefore, `${taskOf(d, "t1").workedMs} vs ${liveBefore}`);
    setClock(null);
  })();

  // --- legacy: the field is absent on every task that predates the feature ---
  check("LEGACY: a task with no workedMs field reads 0, not NaN or undefined",
    S.taskWorkedMs(mkWorked(), { id: "t1", name: "x" }) === 0);
  check("LEGACY: an inactive task's total is its banked value alone",
    S.taskWorkedMs(mkWorked(), { id: "t1", workedMs: 42 }) === 42);
  check("LEGACY: a null task is 0, not a throw", S.taskWorkedMs(mkWorked(), null) === 0);
  await (async () => {
    // A legacy blob whose task objects have never seen the field, banked into.
    setClock(WT0 + WH);
    const d = mkWorked({ activeTask: activation("t1", WT0) });
    delete taskOf(d, "t1").workedMs;
    await S.clearActiveTask(d);
    check("LEGACY: banking into an absent field starts it at the span, not NaN",
      taskOf(d, "t1").workedMs === WH, taskOf(d, "t1").workedMs);
    setClock(null);
  })();

  // --- the surfaces: vocabulary, distinctness, at-rest ---
  await (async () => {
    setClock(WT0 + 2 * WH);
    const d = mkWorked({ activeTask: activation("t1", WT0) });
    taskOf(d, "t1").workedMs = 3 * WH;
    ctx.data = d;
    const chip = ctx.satWorkedChipHtml(taskOf(d, "t1"), true);
    const line = ctx.satWorkedLineHtml();
    check("SURFACE: the row readout renders at rest (no hover, no async phase)", chip.length > 0);
    check("SURFACE: it shows banked + current (5h)", /5h/.test(chip), chip);
    check("SURFACE: the unit word is 'worked'", /worked/.test(chip));
    // THE VOCABULARY LAW. 'focused' is the engine's word and must never appear
    // on a wall-clock surface; the two are never blended or summed.
    check("SURFACE: 'focused' NEVER appears on the worked readout", !/focus/i.test(chip), chip);
    check("SURFACE: ...nor on the card's worked line", !/focus/i.test(line), line);
    check("SURFACE: the tooltip states the definition (active, pauses excluded)",
      /pauses excluded/.test(chip) && /pauses excluded/.test(line));
    check("SURFACE: the tooltip does NOT borrow the engine's 'tracked in the last N days'",
      !/tracked in the last/.test(chip) && !/tracked in the last/.test(line));
    // Distinct CLASSES from the windowed chip, so the CSS can tell them apart.
    check("SURFACE: it does not reuse the engine chip's class",
      /tt-task-worked/.test(chip) && !/tt-time-chip/.test(chip));
    check("SURFACE: the active row is marked as a ticking surface", /is-live/.test(chip));
    check("SURFACE: an INACTIVE row is not marked live", !/is-live/.test(ctx.satWorkedChipHtml(taskOf(d, "t2"), false)));
    // Zero renders NOTHING, like the chip beside it.
    check("SURFACE: a never-worked task renders nothing rather than '0m'",
      ctx.satWorkedChipHtml({ id: "t9", name: "never" }, false) === "");
    // The card line, and the block it belongs to.
    check("SURFACE: the card carries the line", /sat-worked/.test(line) && /5h/.test(line));
    const headline = ctx.satIdleHeadlineHtml(false);
    check("SURFACE: the card's line sits in the WALL-CLOCK block, above the engine's figures",
      headline.indexOf("sat-worked") !== -1 &&
      headline.indexOf("sat-worked") < headline.indexOf("Focused today"), "ordering");
    check("SURFACE: ...and after the stopwatch and its stamp",
      headline.indexOf("sat-hero-time") < headline.indexOf("sat-worked"));
    // The two numbers are never summed into one figure.
    check("SURFACE: the worked total is never added to the engine's figure",
      !/taskWorkedMs\([^)]*\)\s*\+\s*satLiveMs/.test(SRC.nt) &&
      !/satLiveMs\(\)\s*\+\s*Storage\.taskWorkedMs/.test(SRC.nt));
    setClock(null);
  })();

  // --- O1 ink: JS-rendered, so the static ink gate cannot see any of it ---
  const CSSW = SRC.css.replace(/\/\*[\s\S]*?\*\//g, "");
  check("ink: the row readout declares its own colour on the dark frame",
    /^\.tt-task-worked \{[^}]*color: /m.test(CSSW));
  check("ink: ...and has a light-wallpaper correction",
    /html\.has-bg\.bg-light \.tt-task-worked \{[^}]*color/.test(CSSW));
  check("ink: the card's line declares its own colour",
    /^\.sat-worked \{[^}]*color: /m.test(CSSW));
  // MEASURED, not assumed: with --text-secondary this line rendered 3.77:1 over
  // the white-tinted floater frost — a real defect the rendered-pixel pass
  // caught. It takes --text-primary, and inheriting its neighbours' token again
  // would silently reintroduce it.
  check("ink: the card's line takes --text-primary on a light wallpaper (3.77:1 with --text-secondary)",
    /html\.bg-light \.sat-worked \{[^}]*color: var\(--text-primary\)/.test(CSSW));
  check("ink: ...and is NOT lumped back in with the --text-secondary group",
    !/html\.bg-light \.sat-worked,[\s\S]{0,120}var\(--text-secondary\)/.test(CSSW));
  check("ink: the unit words take the same ink as their figure, never a lower alpha",
    !/\.tt-worked-unit \{[^}]*(opacity|color)/.test(CSSW) &&
    !/\.sat-worked-unit \{[^}]*(opacity|color)/.test(CSSW));
  check("ink: neither readout dims a container (O2: colour, never opacity)",
    !/\.(tt-task-worked|sat-worked) \{[^}]*opacity:/.test(CSSW));

  // --- the tick paints BOTH surfaces from ONE read ---
  {
    const paint = extractFn(SRC.nt, "satPaintTime");
    check("TICK: the worked clock is repainted on the existing paint path",
      /\.tt-task-worked\.is-live \.tt-worked-val/.test(paint) && /sat-worked-val/.test(paint));
    check("TICK: ...from a SINGLE read, so the row and the card cannot disagree",
      (paint.match(/satWorkedText\(/g) || []).length === 1);
    check("TICK: it repaints text only, never markup (an open rename must survive)",
      !/\.tt-task-worked[\s\S]{0,200}innerHTML/.test(paint));
  }

  // --- sub-minute honesty ---
  eq("SUB-MINUTE: 45s renders as seconds, not 0m", ctx.fmtDurationHM(45000), "45s");
  eq("SUB-MINUTE: 1s renders", ctx.fmtDurationHM(1000), "1s");
  eq("SUB-MINUTE: 59s renders", ctx.fmtDurationHM(59999), "59s");
  eq("SUB-MINUTE: 60s crosses to minutes", ctx.fmtDurationHM(60000), "1m");
  eq("SUB-MINUTE: ZERO STAYS ZERO", ctx.fmtDurationHM(0), "0m");
  eq("SUB-MINUTE: sub-second is zero, not '0s'", ctx.fmtDurationHM(999), "0m");
  eq("SUB-MINUTE: negative is zero", ctx.fmtDurationHM(-5000), "0m");
  // The minute/hour forms are UNCHANGED — this must not have moved the labels
  // every Insights and Dashboard surface already reads.
  eq("SUB-MINUTE: minutes unchanged", ctx.fmtDurationHM(5 * 60000 + 12000), "5m");
  eq("SUB-MINUTE: hours unchanged", ctx.fmtDurationHM(2 * WH), "2h");
  eq("SUB-MINUTE: hours+minutes unchanged", ctx.fmtDurationHM(2 * WH + 20 * 60000), "2h20m");

  // --- the SW derivation: heartbeat exists IFF active AND unpaused ---
  const hbOn = extractTopFn(SRC.bg, "desiredHeartbeatOn");
  const runHbOn = new Function(hbOn + "\nreturn desiredHeartbeatOn;")();
  check("heartbeat: ON for an active, unpaused task",
    runHbOn({ activeTaskId: "t1", trackingPaused: false }) === true);
  check("heartbeat: OFF while PAUSED (a frozen clock has no liveness to claim)",
    runHbOn({ activeTaskId: "t1", trackingPaused: true }) === false);
  check("heartbeat: OFF with no active task",
    runHbOn({ activeTaskId: null, trackingPaused: false }) === false);
  check("heartbeat: OFF for both at once",
    runHbOn({ activeTaskId: null, trackingPaused: true }) === false);
  check("heartbeat: a null state is OFF, not a crash", runHbOn(null) === false);
  // The bootstrap must never overwrite a stored beat, or the cold-start fold
  // loses the only record of when the previous session died — the bug would
  // survive its own fix and look like the feature simply did not work.
  check("heartbeat: the create-time bootstrap is NON-destructive",
    /var stored = await Storage\.readHeartbeat\(\);\s*\n\s*if \(!stored\) await Storage\.writeHeartbeat\(/.test(SRC.bg));
  // Scoped to reconcileHeartbeatAlarm's own body. An unscoped search matches
  // heartbeatBg's identical off-branch and passes even when this one is gutted.
  check("heartbeat: turning it off also DROPS the stored beat",
    (() => {
      const b = extractTopFn(SRC.bg, "reconcileHeartbeatAlarm");
      const off = b.slice(b.indexOf("if (!desiredHeartbeatOn(state))"), b.indexOf("if (!existing)"));
      return /chrome\.alarms\.clear\(HEARTBEAT_ALARM\)/.test(off) && /Storage\.clearHeartbeat\(\)/.test(off);
    })());
  check("heartbeat: the beat re-checks state rather than trusting the alarm",
    /async function heartbeatBg\(\)[\s\S]{0,600}?if \(!desiredHeartbeatOn\(state\)\)/.test(SRC.bg));
  check("heartbeat: it is its OWN alarm, not a rider on the pomodoro's",
    /var HEARTBEAT_ALARM = "active-heartbeat"/.test(SRC.bg) &&
    SRC.bg.includes('var POMODORO_PHASE_ALARM = "pomodoro-phase"'));
  check("heartbeat: it is periodic, not a one-shot `when`",
    /chrome\.alarms\.create\(HEARTBEAT_ALARM, \{ periodInMinutes: HEARTBEAT_PERIOD_MINUTES \}\)/.test(SRC.bg));
  check("heartbeat: the alarm has its own listener branch",
    /alarm\.name === HEARTBEAT_ALARM\) \{\s*\n\s*heartbeatBg\(\);/.test(SRC.bg));
  // The write must stay OUT of the `data` blob, or every beat costs a full
  // render() in every open tab plus an engine sync. This is the whole reason
  // the key exists; a "tidy-up" that moves it back would be silent.
  check("heartbeat: it writes its OWN key, never the `data` blob",
    /var HEARTBEAT_KEY = "launchpad_heartbeat"/.test(SRC.storage) &&
    /launchpad_heartbeat: \{ at:/.test(SRC.storage));
  check("heartbeat: the beat writer never calls saveAll",
    !/async function writeHeartbeat[\s\S]{0,400}?saveAll/.test(SRC.storage));

  // --- ORDERING on startup: anchor first, fold second ---
  const startup = SRC.bg.slice(SRC.bg.indexOf("chrome.runtime.onStartup.addListener"));
  // Two rows, because they fail differently and one hides the other: a
  // commented-out call still satisfies an indexOf-based ordering test, which is
  // exactly how the load-bearing seed (the fold never runs) escaped once.
  // Match the CALL at statement position, not the identifier anywhere.
  const CALLS = (s) => (s.match(/^  (\w+)\(\);$/gm) || []).map((x) => x.trim());
  check("startup: the fold is actually CALLED, not commented out",
    CALLS(startup).includes("foldClosedBrowserSpanBg();"));
  check("startup: the fold is queued AFTER the anchor (never before)",
    CALLS(startup).indexOf("anchorBrowserSessionBg();") !== -1 &&
    CALLS(startup).indexOf("anchorBrowserSessionBg();") < CALLS(startup).indexOf("foldClosedBrowserSpanBg();"));
  check("startup: the fold rides the serialized queue",
    /function foldClosedBrowserSpanBg\(\)[\s\S]{0,400}?enqueueBgData\("closed-browser-fold"/.test(SRC.bg));
  check("startup: the beat is read BEFORE the queue, so nothing can overwrite it",
    /var heartbeatRead = Storage\.readHeartbeat\(\);\s*\n\s*return enqueueBgData\("closed-browser-fold"/.test(SRC.bg));
  check("startup: the spent beat is cleared after the fold",
    /foldClosedBrowserSpan\(data, heartbeat\);[\s\S]{0,300}?Storage\.clearHeartbeat\(\)/.test(SRC.bg));
  // onInstalled is an update, not a browser launch: there is no closed span.
  const installed = SRC.bg.slice(SRC.bg.indexOf("chrome.runtime.onInstalled.addListener"),
    SRC.bg.indexOf("chrome.runtime.onStartup.addListener"));
  check("install/update does NOT fold (it is not a browser launch)",
    !installed.includes("foldClosedBrowserSpanBg"));
  check("install/update still reconciles the alarm", installed.includes("reconcileHeartbeatAlarm"));

  // --- the reopen toast ---
  // Consume, PERSIST, then paint — in that order. Persisting between the two is
  // what makes it once-per-fold across tabs rather than once per tab.
  check("toast: it consumes and PERSISTS before it paints (D8)",
    /if \(!Storage\.consumeClosedPauseNotice\(data\)\) return;[\s\S]{0,900}?await Storage\.saveAll\(data\);[\s\S]{0,300}?showToast\(/.test(SRC.nt));
  check("toast: it names the task and says why",
    /Paused "' \+ name \+ '" while the browser was closed — resume when ready\./.test(SRC.nt));
  check("toast: it has a fallback when the task name cannot be resolved",
    /"Paused while the browser was closed — resume when ready\."/.test(SRC.nt));
  check("toast: it is guarded at the CALL SITE, not inside the callee (D13)",
    /if \(!isProOnboardingBusy\(\)\) \{\s*\n\s*try \{\s*\n\s*await maybeShowClosedBrowserPauseToast\(\);/.test(SRC.nt) &&
    !(() => {
      const i = SRC.nt.indexOf("  async function maybeShowClosedBrowserPauseToast() {");
      return i === -1 ? "ProOnboardingBusy" : SRC.nt.slice(i, SRC.nt.indexOf("\n  }\n", i));
    })().includes("ProOnboardingBusy"));
  check("toast: a throw in it cannot break init",
    /await maybeShowClosedBrowserPauseToast\(\);\s*\n\s*\} catch/.test(SRC.nt));

  // --- the blast radius: what this round must NOT have touched ---
  // FOCUSED TODAY reads the engine's day aggregates and knows nothing about any
  // of this. If a fold ever reached it, measured time would start moving.
  check("UNTOUCHED: the fold never writes an engine field",
    !/async function foldClosedBrowserSpan[\s\S]{0,1400}?(focusedToday|tracking_sessions|dayAggregates|idleMs)/.test(SRC.storage));
  check("UNTOUCHED: the fold touches only the four fields it declares",
    (() => {
      const body = SRC.storage.slice(SRC.storage.indexOf("async function foldClosedBrowserSpan"));
      const head = body.slice(0, body.indexOf("\n  }\n"));
      const writes = (head.match(/active\.(\w+) =/g) || []).map((s) => s.slice(7, -2));
      return writes.every((f) => ["activePausedMs", "closedPauseNoticeAt"].includes(f));
    })());
  // The pomodoro's own code is not touched. Its BEHAVIOR under a pause is the
  // pre-existing paused-across-a-shutdown path, which this round simply routes
  // more cases into — a frozen phase resumes rather than expiring, which is
  // what "the browser was paused" has always meant here.
  check("UNTOUCHED: the pomodoro alarm derivation is unchanged",
    /function desiredPomodoroAlarmWhen\(state\) \{[\s\S]*?if \(state\.trackingPaused\) return null;/.test(SRC.bg));
  check("UNTOUCHED: reconcilePomodoro still gates on the SAME pause flag it always did",
    /async function reconcilePomodoro\(data, graceMs\) \{\s*\n\s*if \(!data \|\| isTrackingPaused\(data\)\) return \{ action: "none" \};/.test(SRC.storage));
  check("UNTOUCHED: the fold reuses setTrackingPaused rather than writing the flag raw",
    /async function foldClosedBrowserSpan[\s\S]{0,1400}?await setTrackingPaused\(data, true\)/.test(SRC.storage) &&
    !/async function foldClosedBrowserSpan[\s\S]{0,1400}?data\.trackingPaused =/.test(SRC.storage));

})();

let pass = 0, fail = 0;
if (!MUTATE) {
  console.log("\nPILL CLARITY — consequence labels, liveness, overlap, windowed time\n");
  for (const r of rows) { console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`); r.pass ? pass++ : fail++; }
} else {
  for (const r of rows) { r.pass ? pass++ : fail++; }
}

const MIN = 45;
if (!MUTATE && rows.length < MIN) {
  console.log(`\nPILL CLARITY: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
if (!MUTATE) {
  console.log(`\nPILL CLARITY: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --mutate
// ---------------------------------------------------------------------------
console.log("\nPILL CLARITY — mutation seeding\n");

const SEEDS = [
  // ===== [2.0] THE PER-TASK WORKED CLOCK =====
  // THE LOAD-BEARING SEED: a deactivation path that does not bank. The span is
  // gone, silently — no error, no warning, just a total that stopped growing.
  { name: "WORKED LEAK: clearActiveTask stops banking (End for now / Complete / self-heal / delete all leak)",
    file: "storage", from: `    bankWorkedTime(data, Date.now());\n    data.activeTask = null;`,
    to: `    data.activeTask = null;` },
  { name: "WORKED LEAK: switching stops banking (the outgoing task's span vanishes)",
    file: "storage", from: `    bankWorkedTime(data, now);\n\n    // [1.0.17 dual counters]`, to: `\n    // [1.0.17 dual counters]` },
  { name: "WORKED LEAK: a task trashed while active loses its history (raw lookup narrowed to live-only)",
    file: "storage", from: `      if (tasks[i] && tasks[i].id === active.taskId) { task = tasks[i]; break; }`,
    to: `      if (tasks[i] && tasks[i].id === active.taskId && !tasks[i].deletedAt) { task = tasks[i]; break; }` },
  // DOUBLE FOLD, both directions.
  { name: "WORKED DOUBLE FOLD: the re-pick branch banks too (same span credited twice)",
    file: "storage", from: `        data.trackingPaused = false;\n        await saveAll(data);\n      }\n      return current;`,
    to: `        data.trackingPaused = false;\n        bankWorkedTime(data, now);\n        await saveAll(data);\n      }\n      return current;` },
  { name: "WORKED DOUBLE FOLD: clearActiveTask banks twice",
    file: "storage", from: `    bankWorkedTime(data, Date.now());\n    data.activeTask = null;`,
    to: `    bankWorkedTime(data, Date.now());\n    bankWorkedTime(data, Date.now());\n    data.activeTask = null;` },
  // COUNTING WHILE PAUSED — the arithmetic that makes the clock a lie.
  { name: "WORKED: it counts while PAUSED (the open paused span is dropped)",
    file: "storage", from: `      (active.pausedAt != null ? Math.max(0, now - active.pausedAt) : 0);`, to: `      0;` },
  { name: "WORKED: it counts pauses ALREADY TAKEN (the lifetime paused total is dropped)",
    file: "storage", from: `    var pausedTotal = (active.activePausedMs || 0) +`, to: `    var pausedTotal = (0) +` },
  // Anchored on the line PLUS its successor: the identical guard also opens
  // closedBrowserFoldMs (last round), so the bare line matches twice.
  { name: "WORKED: an absent startedAt folds an epoch-sized span",
    file: "storage",
    from: `    if (!active || typeof active.startedAt !== "number" || !active.startedAt) return 0;\n    var pausedTotal = (active.activePausedMs || 0) +`,
    to: `    if (!active) return 0;\n    var pausedTotal = (active.activePausedMs || 0) +` },
  { name: "WORKED: the live figure stops including the current activation",
    file: "storage", from: `      total += activationWorkedMs(active, typeof now === "number" ? now : Date.now());`, to: `` },
  // VOCABULARY — the standing law.
  { name: "WORKED VOCABULARY: the row readout calls itself 'focused' (the engine's word)",
    file: "nt", from: `'<span class="tt-worked-unit">worked</span>'`, to: `'<span class="tt-worked-unit">focused</span>'` },
  { name: "WORKED VOCABULARY: the card's line calls itself 'focused'",
    file: "nt", from: `'<span class="sat-worked-unit">worked on this task</span>'`,
    to: `'<span class="sat-worked-unit">focused on this task</span>'` },
  { name: "WORKED VOCABULARY: the tooltip borrows the engine's windowed wording",
    file: "nt", from: `var SAT_WORKED_TITLE = "Total time this task has been active, pauses excluded";`,
    to: `var SAT_WORKED_TITLE = "Total time tracked in the last 30 days";` },
  // Dropped from the wall-clock block entirely: the card silently loses its
  // lifetime line, which is the same failure as never having added it.
  { name: "WORKED: the card's line disappears from the wall-clock block",
    file: "nt", from: `      satWorkedLineHtml() +\n      '<div class="sat-today">'`,
    to: `      '<div class="sat-today">'` },
  // THE SURFACE.
  { name: "WORKED: a never-worked task paints '0m' on every row",
    file: "nt", from: `    if (!(ms > 0)) return "";\n    return '<span class="tt-task-worked'`,
    to: `    return '<span class="tt-task-worked'` },
  { name: "WORKED: the row readout reuses the engine chip's class (the two stop being distinct)",
    file: "nt", from: `'<span class="tt-task-worked'`, to: `'<span class="tt-time-chip tt-task-worked'` },
  { name: "WORKED: the tick stops repainting it, so the active row freezes",
    file: "nt", from: `      document.querySelectorAll(".tt-task-worked.is-live .tt-worked-val").forEach(function (el) {\n        el.textContent = workedTxt;\n      });`, to: `` },
  // SUB-MINUTE HONESTY.
  { name: "SUB-MINUTE: a real 45s reverts to '0m'",
    file: "nt", from: `    var sec = Math.floor(safe / 1000);\n    return sec > 0 ? (sec + "s") : "0m";`, to: `    return "0m";` },
  { name: "SUB-MINUTE: zero starts claiming '0s'",
    file: "nt", from: `    return sec > 0 ? (sec + "s") : "0m";`, to: `    return sec + "s";` },
  { name: "SUB-MINUTE: the change leaks into the minute form (5m becomes 312s)",
    file: "nt", from: `    if (m > 0) return m + "m";`, to: `` },

  // ===== [2.0] BROWSER-CLOSED TIME IS PAUSED TIME =====
  // THE LOAD-BEARING SEED: the fold is skipped and the 18-hour morning returns.
  // This is the defect the round exists to remove, seeded at its root.
  { name: "CLOSED-TIME: the fold is never called on startup (the 18-hour morning returns)",
    file: "bg", from: `  foldClosedBrowserSpanBg();`, to: `  // foldClosedBrowserSpanBg();` },
  { name: "CLOSED-TIME: the fold declines every time, so nothing is ever folded",
    file: "storage", from: `    if (fold <= 0) return false;`, to: `    if (fold >= 0) return false;` },
  // The catastrophe in the other direction. Both of these fold garbage.
  { name: "CLOSED-TIME: EPOCH FOLD — a zero beat is folded (56 years, count pinned at 0:00)",
    file: "storage", from: `    if (!isFinite(heartbeat.at) || heartbeat.at <= 0) return 0;`, to: `` },
  { name: "CLOSED-TIME: an absent beat is treated as epoch instead of no-evidence",
    file: "storage", from: `    if (!heartbeat || typeof heartbeat.at !== "number") return 0;`,
    to: `    if (!heartbeat) heartbeat = { at: 0, taskId: active.taskId };` },
  { name: "CLOSED-TIME: a beat from ANOTHER task is folded into this activation",
    file: "storage", from: `    if (heartbeat.taskId !== active.taskId) return 0;`, to: `` },
  { name: "CLOSED-TIME: a beat older than the activation is folded (count pinned at zero)",
    file: "storage", from: `    if (heartbeat.at < active.startedAt) return 0;`, to: `` },
  // Double-fold: the anchor and the fold both accounting for one closure.
  { name: "CLOSED-TIME: the fold runs on an ALREADY-PAUSED task (the night deducted twice)",
    file: "storage", from: `    if (isTrackingPaused(data)) return false;   // already paused: the pause term owns the span`, to: `` },
  { name: "CLOSED-TIME: the fold is queued BEFORE the anchor (ordering inverted)",
    file: "bg", from: `  anchorBrowserSessionBg();\n  // [2.0] IMMEDIATELY AFTER the anchor`,
    to: `  foldClosedBrowserSpanBg();\n  anchorBrowserSessionBg();\n  // [2.0] IMMEDIATELY AFTER the anchor` },
  // No-evidence must not pause. Pausing here freezes a still-wrong number.
  { name: "CLOSED-TIME: no evidence still PAUSES (freezing a count that has the night in it)",
    file: "storage", from: `    if (fold <= 0) return false;                // no usable evidence -> leave it alone`,
    to: `    if (fold < 0) return false;` },
  // The heartbeat's own lifecycle.
  { name: "HEARTBEAT: it survives into the PAUSED state (a frozen clock claiming liveness)",
    file: "bg", from: `  if (state.trackingPaused) return false;\n  return true;`, to: `  return true;` },
  { name: "HEARTBEAT: it runs with no active task at all",
    file: "bg", from: `  if (!state.activeTaskId) return false;`, to: `` },
  { name: "HEARTBEAT: the bootstrap OVERWRITES a stored beat (the fix erases its own evidence)",
    file: "bg", from: `    var stored = await Storage.readHeartbeat();\n    if (!stored) await Storage.writeHeartbeat(state.activeTaskId, Date.now());`,
    to: `    await Storage.writeHeartbeat(state.activeTaskId, Date.now());` },
  { name: "HEARTBEAT: the beat is read INSIDE the queue, where the bootstrap can beat it",
    file: "bg", from: `  var heartbeatRead = Storage.readHeartbeat();\n  return enqueueBgData("closed-browser-fold", async function () {\n    var heartbeat = await heartbeatRead;`,
    to: `  return enqueueBgData("closed-browser-fold", async function () {\n    var heartbeat = await Storage.readHeartbeat();` },
  { name: "HEARTBEAT: turning it off leaves the stale beat in storage",
    file: "bg", from: `    if (existing) await chrome.alarms.clear(HEARTBEAT_ALARM);\n    await Storage.clearHeartbeat();`,
    to: `    if (existing) await chrome.alarms.clear(HEARTBEAT_ALARM);` },
  { name: "HEARTBEAT: it moves into the `data` blob (a full render in every tab, every minute)",
    file: "storage", from: `        launchpad_heartbeat: { at: now || Date.now(), taskId: taskId || null }`,
    to: `        launchpad_heartbeat_moved: { at: now || Date.now(), taskId: taskId || null }` },
  { name: "HEARTBEAT: it rides the pomodoro's alarm instead of owning one",
    file: "bg", from: `var HEARTBEAT_ALARM = "active-heartbeat";`, to: `var HEARTBEAT_ALARM = "pomodoro-phase";` },
  // The toast.
  { name: "TOAST: it fires on every startup, not only after a fold",
    file: "nt", from: `    if (!Storage.consumeClosedPauseNotice(data)) return;   // mutate-only; nothing to show`, to: `` },
  { name: "TOAST: it paints BEFORE consuming, so two tabs both show it",
    file: "storage", from: `    active.closedPauseNoticeAt = null;\n    return true;`, to: `    return true;` },
  { name: "TOAST: the guard migrates INSIDE the callee, eating the notice it suppresses",
    file: "nt", from: `    if (!Storage.consumeClosedPauseNotice(data)) return;   // mutate-only; nothing to show`,
    to: `    if (isProOnboardingBusy()) return;\n    if (!Storage.consumeClosedPauseNotice(data)) return;` },
  // The blast radius.
  { name: "UNTOUCHED: the fold writes the pause flag raw, bypassing the canonical setter",
    file: "storage", from: `    var wrote = await setTrackingPaused(data, true);   // saveAll's internally`,
    to: `    data.trackingPaused = true; var wrote = false;` },

  // THE LOAD-BEARING PAIR — the label/consequence binding, broken in BOTH
  // directions. Either one ships the exact defect this round exists to remove.
  { name: "LABEL->ACTION: the button that says Complete routes to DEACTIVATE",
    file: "nt", from: `'<button type="button" class="sat-btn sat-btn-complete" data-sat-act="complete" ' +`,
    to: `'<button type="button" class="sat-btn sat-btn-complete" data-sat-act="cancel" ' +` },
  { name: "LABEL->ACTION: the button that says End for now routes to COMPLETE",
    file: "nt", from: `'<button type="button" class="sat-btn sat-btn-setdown" data-sat-act="cancel" ' +`,
    to: `'<button type="button" class="sat-btn sat-btn-setdown" data-sat-act="complete" ' +` },
  { name: "the set-down path silently completes the task as well",
    file: "nt", from: "      await Storage.clearActiveTask(data);\n    } catch (err) {\n      console.error(\"[LaunchPad] Active task: cancel failed\", err);",
    to: "      await Storage.completeTask(data, (Storage.getActiveTask(data)||{}).taskId);\n      await Storage.clearActiveTask(data);\n    } catch (err) {\n      console.error(\"[LaunchPad] Active task: cancel failed\", err);" },
  { name: "the Complete label reverts to the ambiguous '✓ Done'",
    file: "nt", from: "'✓ Complete</button>'", to: "'✓ Done</button>'" },
  { name: "the set-down action goes back to an unlabeled ×",
    file: "nt", from: "'End for now</button>'", to: "'×</button>'" },
  { name: "Complete's tooltip stops mentioning that it is recoverable",
    file: "nt", from: "You can uncheck it in Tasks to reopen it.", to: "This cannot be undone." },
  { name: "the glyph-only Switch loses its aria-label (an anonymous control)",
    file: "nt", from: `'title="Switch active task" aria-label="Switch active task">⇄</button>'`, to: `'title="Switch active task">⇄</button>'` },
  // LIVENESS
  { name: "LIVENESS: the dot claims 'tracking' from mere ACTIVATION",
    file: "nt", from: "var live = satReadout.taskId === res.task.id && satReadout.openSince != null;",
    to: "var live = true;" },
  // The collision returning: the holding word going back to the hero's unit word.
  { name: "LIVENESS: the holding state reads 'Active' again, colliding with the hero's unit word",
    file: "nt", from: 'var label = live ? "Tracking" : "Ready";', to: 'var label = live ? "Tracking" : "Active";' },
  { name: "LIVENESS: the label is renamed but the tooltip is left explaining the old word",
    file: "nt", from: 'var SAT_LIVE_TITLE = "Ready — time records as soon as you browse a site. This page is not tracked, so the number holds here.";',
    to: 'var SAT_LIVE_TITLE = "Active — time records while you browse a site. This page is not tracked, so the number holds here.";' },
  { name: "LIVENESS: the indicator lights for a readout belonging to another task",
    file: "nt", from: "var live = satReadout.taskId === res.task.id && satReadout.openSince != null;",
    to: "var live = satReadout.openSince != null;" },
  { name: "LIVENESS: it renders while PAUSED, contradicting the amber state",
    file: "nt", from: "  function satTrackingIndicatorHtml(paused) {\n    if (paused) return \"\";",
    to: "  function satTrackingIndicatorHtml(paused) {\n    if (false) return \"\";" },
  { name: "LIVENESS: it renders with tracking switched off",
    file: "nt", from: "    if (!Storage.isTrackingEnabled(res.workspace)) return \"\";", to: "    if (false) return \"\";" },
  { name: "LIVENESS: the tick stops repainting it, so the dot freezes at first paint",
    file: "nt", from: "      var html = satTrackingIndicatorHtml(Storage.isTrackingPaused(data));", to: "      var html = live.outerHTML;" },
  { name: "LIVENESS: reduced motion is dropped (the pulse runs regardless)",
    file: "css", from: "@media (prefers-reduced-motion: reduce) {\n  .sat-live.is-live .sat-live-dot { animation: none; }\n}", to: "" },
  // WINDOWED TIME
  { name: "WINDOW: the label claims a calendar month",
    file: "nt", from: 'var txt = fmtDurationHM(ms) + " · last " + satWindowDays() + " days";', to: 'var txt = fmtDurationHM(ms) + " · this month";' },
  { name: "WINDOW: the window is a restated 30 instead of the engine's constant",
    file: "nt", from: "    return (typeof Tracking !== \"undefined\" && Tracking.RETENTION_DAYS) || 30;", to: "    return 30;" },
  { name: "WINDOW: zero-time tasks render a '0m' chip",
    file: "nt", from: '      if (!(ms > 0)) { slot.innerHTML = ""; return; }', to: '      if (false) { slot.innerHTML = ""; return; }' },
  { name: "WINDOW: the pill line renders at zero too",
    file: "nt", from: "    if (!ms) return \"\";", to: "    if (false) return \"\";" },
  { name: "WINDOW: the Tasks chip re-renders the panel instead of patching it",
    file: "nt", from: "    panel.querySelectorAll(\"[data-task-time]\").forEach(function (slot) {", to: "    renderTasksTab(panel, data); panel.querySelectorAll(\"[data-task-time]\").forEach(function (slot) {" },
  { name: "WINDOW: the pill's read drops its staleness token",
    file: "nt", from: "    if (token !== satWindowToken) return;", to: "    if (false) return;" },
  // OVERLAP
  { name: "OVERLAP: the reserve moves off the shared root back onto one surface",
    file: "css", from: "body.sat-card-open .tab-panel {\n  padding-right: 300px;", to: "body.sat-card-open .tasks-body {\n  padding-right: 300px;" },
  { name: "OVERLAP: the old header reserve comes back and compounds to 600px",
    file: "css", from: "body.sat-card-open .tab-panel {\n  padding-right: 300px;", to: "body.sat-card-open .tasks-header-right {\n  margin-right: 300px;\n}\nbody.sat-card-open .tab-panel {\n  padding-right: 300px;" },
  // INK
  { name: "INK: the windowed line loses its light-wallpaper override",
    file: "css", from: "html.bg-light .sat-live,\nhtml.bg-light .sat-window { color: var(--text-secondary); text-shadow: none; }",
    to: "html.bg-light .sat-live { color: var(--text-secondary); text-shadow: none; }" },
  // ── the activation stopwatch ────────────────────────────────────────────
  // SUPERSEDES the session-clock seeds. Those broke a two-regime switch that no
  // longer exists; re-pointing them at the stopwatch is the honest move, because
  // a seed that cannot apply is not coverage. The four the brief names as
  // load-bearing are the first four here.
  { name: "STOPWATCH: it FREEZES while active and unpaused (Samson's 'looks broken')",
    file: "nt", from: "    return Math.max(0, Date.now() - a.startedAt - pausedTotal);",
    to: "    return Math.max(0, (a.frozenAt || a.startedAt) - a.startedAt - pausedTotal);" },
  { name: "STOPWATCH: it RESETS when a session starts (continuity is the spec)",
    file: "nt", from: "      text: countText != null ? countText : satStopwatchText(),",
    to: "      text: satFmtStopwatch(pomo && pomo.phase === \"work\" ? Math.max(0, pomo.totalMs - satPomoRemainingMs(pomo)) : satActiveElapsedMs())," },
  { name: "STOPWATCH: it keeps COUNTING while paused",
    file: "nt", from: "    var pausedTotal = (a.activePausedMs || 0) + (a.pausedAt != null ? Math.max(0, Date.now() - a.pausedAt) : 0);",
    to: "    var pausedTotal = (a.activePausedMs || 0);" },
  { name: "STOPWATCH: it claims to be FOCUSED time (the word reserved for the engine)",
    file: "nt", from: '      unit: "active",', to: '      unit: "focused",' },
  { name: "STOPWATCH: it is BLENDED with the engine figure",
    file: "nt", from: "      text: countText != null ? countText : satStopwatchText(),",
    to: "      text: satFmtStopwatch(satActiveElapsedMs() + satLiveMs())," },
  { name: "STOPWATCH: it counts from the per-SITTING anchor, so a restart resets it",
    file: "nt", from: "    return Math.max(0, Date.now() - a.startedAt - pausedTotal);",
    to: "    return Math.max(0, Date.now() - (a.sessionAnchorAt || a.startedAt) - pausedTotal);" },
  { name: "STOPWATCH: it deducts the per-sitting paused total, so pre-restart pauses stop counting",
    file: "nt", from: "    var pausedTotal = (a.activePausedMs || 0) + (a.pausedAt != null",
    to: "    var pausedTotal = (a.pausedMs || 0) + (a.pausedAt != null" },
  { name: "STOPWATCH: the lifetime paused total stops accruing on resume",
    file: "storage", from: "        active.activePausedMs = (active.activePausedMs || 0) + pausedSpan;", to: "" },
  { name: "STOPWATCH: the browser anchor drops the open paused span instead of folding it",
    file: "storage", from: "    if (active.pausedAt != null) {\n      active.activePausedMs = (active.activePausedMs || 0) + Math.max(0, now - active.pausedAt);\n    }\n", to: "" },
  { name: "STOPWATCH: the tooltip stops naming the wall-clock",
    file: "nt", from: 'var SAT_ACTIVE_TITLE = "Wall-clock since you activated this task, pauses excluded — not measured browsing time.";',
    to: 'var SAT_ACTIVE_TITLE = "Active time.";' },
  { name: "STOPWATCH: the day form is dropped, so a weekend reads as 54:12:07",
    file: "nt", from: "    if (totalSec < 86400) return satFmtLong(ms);", to: "    if (true) return satFmtLong(ms);" },
  { name: "STOPWATCH: the work highlight fires on BREAK phases too",
    file: "nt", from: '      work: !!(pomo && pomo.phase === "work"),', to: "      work: !!pomo," },
  { name: "STOPWATCH: the row's bar stops following the tick's class",
    file: "css", from: ".tt-task-row.is-active-task:has(.tt-task-live.is-work)::after {", to: ".tt-task-row.is-active-task-never:has(.tt-task-live.is-work)::after {" },
  { name: "CROSS-SURFACE: the card's since-line loses the count and drifts from the row",
    file: "nt", from: 'return "Active " + (countText != null ? countText : satStopwatchText()) + " · since " + since;',
    to: 'return "Active since " + since;' },
  { name: "CROSS-SURFACE: the card's since-line stops being repainted, so it freezes",
    file: "nt", from: "    var sinceEl = container.querySelector(\".sat-since\");", to: "    var sinceEl = null;" },
  // ── THE REPORTED SYMPTOM, seeded ─────────────────────────────────────────
  // Samson, 2026-08-13: the row's stopwatch ticked and the card's held still.
  // This is that failure written as code — the card's count pinned at its first
  // value while every other surface keeps moving. It must be caught by the
  // EXECUTED lockstep rows, not by a pattern: a frozen number is a behaviour.
  { name: "LOCKSTEP: the card's count freezes at its first value while the row's keeps moving",
    file: "nt", from: 'return "Active " + (countText != null ? countText : satStopwatchText()) + " · since " + since;',
    to: 'return "Active " + (satActiveSinceText.__frozen || (satActiveSinceText.__frozen = (countText != null ? countText : satStopwatchText()))) + " · since " + since;' },
  { name: "LOCKSTEP: the row's count freezes instead (the same failure, other surface)",
    file: "nt", from: "      text: countText != null ? countText : satStopwatchText(),",
    to: "      text: satRowLiveState.__frozen || (satRowLiveState.__frozen = (countText != null ? countText : satStopwatchText()))," },
  { name: "LOCKSTEP: the card lags the row by a fixed second, so the two never agree",
    file: "nt", from: 'return "Active " + (countText != null ? countText : satStopwatchText()) + " · since " + since;',
    to: 'return "Active " + satFmtStopwatch(Math.max(0, satActiveElapsedMs() - 1000)) + " · since " + since;' },
  { name: "CLOCK EDGE: the card ignores the paint's read and takes its own",
    file: "nt", from: 'return "Active " + (countText != null ? countText : satStopwatchText()) + " · since " + since;',
    to: 'return "Active " + satStopwatchText() + " · since " + since;' },
  { name: "CLOCK EDGE: the row ignores the paint's read and takes its own",
    file: "nt", from: "      text: countText != null ? countText : satStopwatchText(),", to: "      text: satStopwatchText()," },
  { name: "CLOCK EDGE: the paint reads the clock twice, once per surface",
    file: "nt", from: "    var liveState = satRowLiveState(stopwatch);", to: "    var liveState = satRowLiveState(satStopwatchText());" },
  // ── THE HERO SWAP ────────────────────────────────────────────────────────
  // The three the brief names as load-bearing come first. The first is the
  // reason the swap exists at all: a hero that cannot move while it is watched.
  { name: "HERO: the headline is frozen while the task is active and unpaused",
    file: "nt", from: '    return \'<div class="sat-hero-time">\' + escapeHtml(satStopwatchText()) + \'</div>\' +',
    to: '    return \'<div class="sat-hero-time">\' + escapeHtml(satFmtLong(satLiveMs())) + \'</div>\' +' },
  { name: "HERO: ...or frozen by the tick skipping it (same symptom, other end)",
    file: "nt", from: "    if (heroEl) heroEl.textContent = stopwatch;", to: "" },
  { name: "HERO: the FOCUSED TODAY line is dropped, so the engine figure leaves the card",
    file: "nt", from: `      '<div class="sat-today">' +\n        '<span class="sat-time">' + escapeHtml(satFmtLong(satLiveMs())) + '</span>' +`,
    to: `      '<div class="sat-today">' +\n        '<span class="sat-time-gone">' + escapeHtml(satFmtLong(satLiveMs())) + '</span>' +` },
  { name: "HERO: the two numbers are BLENDED into one figure",
    file: "nt", from: '    return \'<div class="sat-hero-time">\' + escapeHtml(satStopwatchText()) + \'</div>\' +',
    to: '    return \'<div class="sat-hero-time">\' + escapeHtml(satFmtStopwatch(satActiveElapsedMs() + satLiveMs())) + \'</div>\' +' },
  { name: "HERO: the hero claims to be FOCUSED time, the word reserved for the engine",
    file: "nt", from: "        (paused ? 'Paused' : 'Active') +", to: "        (paused ? 'Paused' : 'Focused') +" },
  { name: "HERO: the demoted line loses its label, leaving a bare unexplained number",
    file: "nt", from: `          '<span class="sat-time-label-text">Focused today</span>' +`, to: "" },
  { name: "HERO: the demoted line loses its liveness indicator",
    file: "nt", from: "          satTrackingIndicatorHtml(paused) +\n        '</span>' +\n      '</div>' +\n      satWindowLineHtml();", to: "        '</span>' +\n      '</div>' +\n      satWindowLineHtml();" },
  { name: "HERO: the since-line repeats the count already shown in the hero above it",
    file: "nt", from: "      satSinceHtml(false) +", to: "      satSinceHtml() +" },
  { name: "HERO: the swap reaches the phase takeover, which must keep FOCUSED TODAY",
    file: "nt", from: "          '<div class=\"sat-pomo-today\">' + satHeadlineHtml(paused) + '</div>' +",
    to: "          '<div class=\"sat-pomo-today\">' + satIdleHeadlineHtml(paused) + '</div>' +" },
  { name: "HERO: the hero wears .sat-time, so the tick paints it with the ENGINE figure",
    file: "nt", from: '    return \'<div class="sat-hero-time">\'', to: '    return \'<div class="sat-time sat-hero-time">\'' },
  { name: "HERO: the hero's ink is left to inherit on the light frame",
    file: "css", from: "html.bg-light .sat-name,\nhtml.bg-light .sat-hero-time,\nhtml.bg-light .sat-time { color: var(--text-primary); }",
    to: "html.bg-light .sat-name,\nhtml.bg-light .sat-time { color: var(--text-primary); }" },
  { name: "HERO: the paused amber covers only the demoted number, not the hero",
    file: "css", from: ".sat-expanded.is-paused .sat-time,\n.sat-expanded.is-paused .sat-hero-time,", to: ".sat-expanded.is-paused .sat-time," },
  { name: "CROSS-SURFACE: an uncomputable sentence leaves the last one standing, frozen",
    file: "nt", from: "      if (sinceTxt) sinceEl.textContent = sinceTxt;\n      else sinceEl.remove();",
    to: "      if (sinceTxt) sinceEl.textContent = sinceTxt;" },
  { name: "CROSS-SURFACE: FOCUSED TODAY is switched to the wall-clock",
    file: "nt", from: "    return '<div class=\"sat-time\">' + escapeHtml(satFmtLong(satLiveMs())) + '</div>' +",
    to: "    return '<div class=\"sat-time\">' + escapeHtml(satFmtStopwatch(satActiveElapsedMs())) + '</div>' +" },
  // ── the focus row ───────────────────────────────────────────────────────
  { name: "SESSION CLOCK: the unit word goes back to being opacity-dimmed (3.48:1)",
    file: "css", from: ".tt-live-unit {\n  font-size: var(--fs-10);", to: ".tt-live-unit {\n  opacity: 0.75;\n  font-size: var(--fs-10);" },
  { name: "FOCUS ROW: the wrap is removed and the hint truncates again",
    file: "css", from: "  flex-wrap: wrap;\n  row-gap: 2px;", to: "  row-gap: 2px;" },
  { name: "FOCUS ROW: the hint becomes shrinkable, so it ellipsises instead of wrapping",
    file: "css", from: "  flex: 0 0 auto;\n  min-width: 0;\n  overflow: hidden;", to: "  flex: 0 1 auto;\n  min-width: 0;\n  overflow: hidden;" },
  // NOTE: this anchor carries the CURRENT alpha (0.65, raised from 0.55 by the
  // live ink pass in this same round). A seed anchored on the pre-fix value
  // reported an anchor-miss on the re-run — Q2 catching a stale seed rather than
  // scoring it, which is exactly what the miss category is for.
  // ── 2026-08-12 residuals ────────────────────────────────────────────────
  // THE LOAD-BEARING ONE: the chip goes back into the right-hand controls zone,
  // which is where it was when Samson could not find it.
  { name: "VISIBLE AT REST: the chip returns to the right-hand controls zone",
    file: "nt", from: `        '<span class="tt-task-time" data-task-time="' + escapeHtml(task.id) + '"></span>' +\n      '</span>' +\n      '<div class="tt-task-controls">' +`,
    to: `      '</span>' +\n      '<div class="tt-task-controls">' +\n        '<span class="tt-task-time" data-task-time="' + escapeHtml(task.id) + '"></span>' +` },
  { name: "VISIBLE AT REST: the readouts are hover-gated (the original hypothesis, seeded)",
    file: "css", from: ".tt-task-main {\n  flex: 1;", to: ".tt-task-main {\n  opacity: 0;\n  flex: 1;" },
  { name: "VISIBLE AT REST: the chip is hidden until the row is hovered",
    file: "css", from: ".tt-time-chip {\n  font-size: var(--fs-11);", to: ".tt-time-chip {\n  display: none;\n  font-size: var(--fs-11);" },
  // THE READ SCOPE — the actual cause of the empty chips.
  { name: "SCOPE: the Tasks chips go back to a workspace-scoped read (foreign tasks read zero)",
    file: "nt", from: "      rows = await Tracking.byTaskForScope(SAT_ALL_WORKSPACES, Tracking.lastNLocalDayKeys(satWindowDays()));\n    } catch (err) {\n      console.error(\"[LaunchPad] Tasks tab: windowed task times read failed\", err);",
    to: "      rows = await Tracking.byTaskForScope(scope.workspaceId, Tracking.lastNLocalDayKeys(satWindowDays()));\n    } catch (err) {\n      console.error(\"[LaunchPad] Tasks tab: windowed task times read failed\", err);" },
  { name: "SCOPE: the pill's window line goes back to a workspace-scoped read",
    file: "nt", from: "      rows = await Tracking.byTaskForScope(SAT_ALL_WORKSPACES, Tracking.lastNLocalDayKeys(satWindowDays()));\n    } catch (err) {\n      console.error(\"[LaunchPad] Active task: windowed task total read failed\", err);",
    to: "      rows = await Tracking.byTaskForScope(scope.workspaceId, Tracking.lastNLocalDayKeys(satWindowDays()));\n    } catch (err) {\n      console.error(\"[LaunchPad] Active task: windowed task total read failed\", err);" },
  { name: "SCOPE: the sentinel stops meaning 'every workspace'",
    file: "nt", from: "  var SAT_ALL_WORKSPACES = null;", to: '  var SAT_ALL_WORKSPACES = "main";' },
  { name: "SCOPE: tracking-off stops suppressing the chips (0m painted as measured)",
    file: "nt", from: "    if (!scope) return;\n    var rows;", to: "    var rows;" },
  // ACTIVE ROW
  { name: "ACTIVE ROW: the highlight goes back to a border-left, fighting the priority indicator",
    file: "css", from: ".tt-task-row.is-active-task::after {\n  content: \"\";", to: ".tt-task-row.is-active-task { border-left-color: var(--sat-accent); }\n.tt-task-row.is-active-task-unused::after {\n  content: \"\";" },
  // Re-anchored: the row's paint gained the session switch, so the one-line
  // forEach this seed was written against no longer exists. Reported as an
  // anchor-miss on the re-run and fixed rather than scored (Q2).
  { name: "ACTIVE ROW: the live figure stops riding the shared tick (freezes at first paint)",
    file: "nt", from: '    document.querySelectorAll(".tt-task-live").forEach(function (el) {', to: '    document.querySelectorAll(".tt-task-live-gone").forEach(function (el) {' },
  { name: "ACTIVE ROW: the live figure appears on EVERY row, not just the active one",
    file: "nt", from: '(isActiveTask ? satRowLiveHtml() : "")', to: '(true ? satRowLiveHtml() : "")' },
  { name: "TAKEOVER: FOCUSED TODAY disappears again when a phase runs",
    file: "nt", from: `          '<div class="sat-pomo-today">' + satHeadlineHtml(paused) + '</div>' +\n`, to: "" },
  { name: "TAKEOVER: the ring highlight fires on BREAK phases too",
    file: "nt", from: '      var pomoWork = pomo.phase === "work";', to: "      var pomoWork = true;" },
  { name: "TAKEOVER: the kept headline stops ticking (the early return comes back)",
    file: "nt", from: "      // [2.0 timing] The takeover now keeps FOCUSED TODAY beneath the ring, so",
    to: "      return;\n      // [2.0 timing] The takeover now keeps FOCUSED TODAY beneath the ring, so" },
  { name: "INK: the task-row chip ships with no colour of its own",
    file: "css", from: ".tt-time-chip {\n  font-size: var(--fs-11);\n  font-variant-numeric: tabular-nums;\n  color: rgba(255, 255, 255, 0.65);",
    to: ".tt-time-chip {\n  font-size: var(--fs-11);\n  font-variant-numeric: tabular-nums;" },
];

const FILEKEY = { storage: "storage", nt: "nt", css: "css", bg: "bg" };
import { spawnSync } from "node:child_process";
import os from "node:os";
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lp-pill-mut-"));
function materialize(src) {
  const dir = fs.mkdtempSync(path.join(scratch, "seed-"));
  fs.writeFileSync(path.join(dir, "storage.js"), src.storage);
  fs.writeFileSync(path.join(dir, "newtab.js"), src.nt);
  fs.writeFileSync(path.join(dir, "newtab.css"), src.css);
  fs.writeFileSync(path.join(dir, "background.js"), src.bg);
  return dir;
}
const runAgainst = (dir) => spawnSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), dir], { encoding: "utf8" });

{
  const broken = Object.assign({}, SRC, { storage: SRC.storage + "\nthis is not javascript(" });
  const r = runAgainst(materialize(broken));
  console.log(`  ${r.status === 2 ? "OK  " : "BAD "} control: an unloadable subject exits 2 (got ${r.status}), and is not scored`);
  if (r.status !== 2) { console.log("\n  the runner cannot distinguish broken from caught — no seed below is meaningful.\n"); process.exit(1); }
}
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
  if (n !== 1) { missed++; console.log(`  MISS  ${seed.name}   << anchor matched ${n} times in ${seed.file} (want exactly 1)`); continue; }
  const mutated = Object.assign({}, SRC, { [key]: hay.replace(seed.from, seed.to) });
  const r = runAgainst(materialize(mutated));
  if (r.status === 2) { missed++; console.log(`  MISS  ${seed.name}   << subject did not load (unfaithful seed)`); continue; }
  if (r.status === 1) { caught++; console.log(`  CAUGHT   ${seed.name}`); }
  else { escaped++; console.log(`  ESCAPED  ${seed.name}   << the suite did not notice`); }
}
fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\nMUTATION: ${caught} caught, ${escaped} escaped, ${missed} anchor-miss (of ${SEEDS.length})\n`);
process.exit(escaped || missed ? 1 : 0);
