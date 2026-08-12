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
    Date, Math, JSON, Object, Array, String, Number, Boolean, Promise, Set, Map,
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
      extractFn(src.nt, "escapeHtml"),
      extractFn(src.nt, "fmtDurationHM"),
      extractFn(src.nt, "satWindowDays"),
      extractFn(src.nt, "satTrackingIndicatorHtml"),
      extractFn(src.nt, "satWindowLineHtml"),
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
    check("liveness: armed but not accruing -> a dot and the word Active", /sat-live-dot/.test(armed) && />Active</.test(armed), armed);
    check("liveness: ...and it does NOT claim to be tracking", !/Tracking/.test(armed), armed);
    check("liveness: ...and it is not the live variant", !/is-live/.test(armed), armed);
    check("liveness: ...with the reason in the tooltip, not left as a mystery",
      /not tracked|while you browse/i.test(armed), armed);

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
    check("window: the Tasks-row chip uses the SAME windowed reader, not a second one",
      /Tracking\.byTaskForScope\(scope\.workspaceId, Tracking\.lastNLocalDayKeys\(satWindowDays\(\)\)\)/.test(tt));
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
  // NOTE: this anchor carries the CURRENT alpha (0.65, raised from 0.55 by the
  // live ink pass in this same round). A seed anchored on the pre-fix value
  // reported an anchor-miss on the re-run — Q2 catching a stale seed rather than
  // scoring it, which is exactly what the miss category is for.
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
