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
  SRC = { storage: rd("storage.js"), nt: rd("newtab.js"), css: rd("newtab.css") };
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
      check("stopwatch: the lifetime total is maintained on every path that folds a paused span",
        (SRC.storage.match(/activePausedMs = \(/g) || []).length >= 3);
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

const FILEKEY = { storage: "storage", nt: "nt", css: "css" };
import { spawnSync } from "node:child_process";
import os from "node:os";
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lp-pill-mut-"));
function materialize(src) {
  const dir = fs.mkdtempSync(path.join(scratch, "seed-"));
  fs.writeFileSync(path.join(dir, "storage.js"), src.storage);
  fs.writeFileSync(path.join(dir, "newtab.js"), src.nt);
  fs.writeFileSync(path.join(dir, "newtab.css"), src.css);
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
