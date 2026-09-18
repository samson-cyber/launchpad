#!/usr/bin/env node
// ===========================================================================
// DRIVE THE GATE - every state of gate.html, every button, to its destination.
//
// WHY THIS IS COMMITTED. drive-dialogs.mjs (ebe7339) is the sibling instrument
// and it CANNOT reach this page: it drives newtab's confirms, and its REPO is
// a hardcoded absolute path to the main checkout, so a worktree running it
// tests a different tree. The gate's buttons were driven once, by hand, in
// 53cfc42's round, and that run evaporated with its session (BUGS.md P5) - the
// same way [1.11.3d]'s pixel-diff measurer did. This is the answer to "re-run
// the gate harness" existing at all.
//
// WHAT IT ASSERTS, per state: which controls are PRESENT (the gate removes
// rather than disables - the [1.1.4] preview-ghost rule), what the headline and
// reason say, and where every button actually LANDS. Destinations are read from
// the tab after the click, not inferred from the handler.
//
// THE DESTINATION TARGET IS THE CDP SERVER'S OWN HTTP PORT, and that is
// deliberate. goBackToSite() only follows http(s) (safeTarget), and a scratch
// browser has no network - a real site would land on chrome-error://chromewebdata
// (BUGS I6's neighbourhood) and the assertion would be reading an error page
// rather than a destination. http://127.0.0.1:<port>/json/version is a real 200
// that this process is already serving, is not in any block list, and is not the
// extension - so "the tab is now at the destination" is exactly what is measured.
//
//   node --experimental-websocket tools/drive-gate.mjs
//   (Node 20 needs the flag; Node 22+ does not. Runs on Edge - BUGS I22.)
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { browserArgs, EDGE } from "./browser-launch.mjs";

// Derived from cwd, NOT hardcoded - drive-dialogs.mjs's own header records the
// bug this avoids: an absolute REPO means a worktree drives the main checkout.
const REPO = process.cwd();
const PORT = 9400 + (process.pid % 300);            // I25: unique per run
const PROFILE = path.join(REPO, ".scratch", "gate-" + process.pid);
const DEST = `http://127.0.0.1:${PORT}/json/version`;
const ENTRY = "youtube.com";

let pass = 0, fail = 0;
const rows = [];
const chk = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  rows.push({ name, ok: !!ok, detail });
};

// ---- CDP, inlined so this tool stands alone (the tools/ convention) -------
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let n = 0;
  const pend = new Map();
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const { res, rej } = pend.get(m.id);
      pend.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  };
  return {
    ready,
    send(method, params, sessionId) {
      const id = ++n;
      ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
      return new Promise((res, rej) => pend.set(id, { res, rej }));
    },
    close() { try { ws.close(); } catch (e) { /* closing */ } },
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort(ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch (e) { /* not up yet */ }
    await wait(300);
  }
  throw new Error("browser never opened its debugging port");
}

// I6: match on the repo path, never "the first chrome-extension:// target" -
// Edge's own force-installed extensions get there first.
function extensionId(tries = 60) {
  const pref = path.join(PROFILE, "Default", "Secure Preferences");
  for (let i = 0; i < tries; i++) {
    try {
      const j = JSON.parse(fs.readFileSync(pref, "utf8"));
      const want = path.resolve(REPO).toLowerCase();
      for (const [k, v] of Object.entries((j.extensions && j.extensions.settings) || {})) {
        if (v && v.path && path.resolve(v.path).toLowerCase() === want) return k;
      }
    } catch (e) { /* not written yet */ }
  }
  return null;
}
async function extensionIdWait(ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const id = extensionId(1);
    if (id) return id;
    await wait(400);
  }
  throw new Error("extension id never appeared in the scratch profile");
}

let cdp;
async function openPage(url) {
  const t = await cdp.send("Target.createTarget", { url });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);
  return { targetId: t.targetId, sessionId };
}
async function ev(sessionId, expression) {
  const r = await cdp.send("Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
// Where the tab ACTUALLY is. Page.getNavigationHistory rather than
// location.href: after location.replace the old execution context is gone and
// an evaluate races the swap.
async function tabUrl(sessionId) {
  const h = await cdp.send("Page.getNavigationHistory", {}, sessionId);
  const e = h.entries[h.currentIndex];
  return (e && e.url) || "";
}
// POLL, NEVER SAMPLE. A single read at a fixed delay is a coin toss: END was
// measured navigating at t+1s and still read as "did not navigate" when sampled
// once at 2.6s, because the history had not swapped in the attached session yet.
// Waiting FOR the condition is the only version of this that is not flaky.
async function waitForUrl(sessionId, pred, ms = 12000) {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    try { last = await tabUrl(sessionId); } catch (e) { /* mid-swap */ }
    if (pred(last)) return last;
    await wait(300);
  }
  return last;
}

async function closePage(targetId) {
  try { await cdp.send("Target.closeTarget", { targetId }); } catch (e) { /* already gone */ }
}

// ---- fixtures, written through the product's own serializer ---------------
//
// Storage.saveAll on a mutated snapshot, which is what every writer in the
// product does at the end of its own mutation. NOT chrome.storage.local.set:
// that would bypass the shape the readers expect and a fixture that seeds a
// shape the product never writes proves nothing about the product.
const FIXTURES = {
  // A running WORK phase, stamped, with a session id - the only state in which
  // frictionPlanFor returns a plan at all.
  session: (opts) => `(async function () {
    var d = await Storage.getAll();
    var w = Storage.getActiveWorkspace(d);
    d.blockList = [${JSON.stringify(ENTRY)}];
    d.focusArmed = false;
    d.trackingPaused = false;
    d.settings = d.settings || {};
    d.settings.focus = d.settings.focus || {};
    d.settings.focus.autoArmDuringWork = true;
    d.settings.focus.commitment = ${opts && opts.commitment ? "true" : "false"};
    d.focusSnoozes = ${opts && opts.snoozes ? opts.snoozes : "{}"};
    var t = (w.tasks || []).filter(function (x) { return !x.completed && !x.deletedAt; })[0];
    d.activeTask = {
      taskId: t ? t.id : "t1", workspaceId: w.id, startedAt: Date.now() - 300000,
      pomodoroState: { phase: "work", phaseEndsAt: Date.now() + 900000,
                       phaseDurationMs: 1500000, cycleCount: 1, sessionComplete: false,
                       mode: "work", sessionId: "sess-drive-gate" }
    };
    await Storage.saveAll(d);
    return { stamp: Storage.sessionStampMode(d), id: Storage.sessionStampId(d),
             reason: Storage.blockingReasonFor(d, ${JSON.stringify(ENTRY)}, Date.now(), {}) };
  })()`,

  // A schedule, no session anywhere. Mode-governed, so the workspace must be
  // in WORK mode - every workspace defaults to Casual and forgetting this is
  // what made an earlier round read a working feature as a broken one.
  schedule: () => `(async function () {
    var d = await Storage.getAll();
    var w = Storage.getActiveWorkspace(d);
    Storage.setWorkspaceMode(d, w.id, "work");   // mutate-only (I34): we own the save
    d.activeTask = null;
    d.focusArmed = false;
    d.focusSnoozes = {};
    var now = new Date(), m = now.getHours() * 60 + now.getMinutes();
    var hhmm = function (x) { x = ((x % 1440) + 1440) % 1440;
      return ("0" + Math.floor(x / 60)).slice(-2) + ":" + ("0" + (x % 60)).slice(-2); };
    d.blockList = [{ host: ${JSON.stringify(ENTRY)}, mode: "schedule",
      windows: [{ days: [0,1,2,3,4,5,6], start: hhmm(m - 60), end: hhmm(m + 60) }] }];
    await Storage.saveAll(d);
    return { mode: Storage.getWorkspaceMode(Storage.getActiveWorkspace(d)),
             reason: Storage.blockingReasonFor(d, ${JSON.stringify(ENTRY)}, Date.now(), {}) };
  })()`,

  // Nothing blocking at all. The gate is reachable here by its own documented
  // route - opened directly - and must say so.
  inert: () => `(async function () {
    var d = await Storage.getAll();
    var w = Storage.getActiveWorkspace(d);
    Storage.setWorkspaceMode(d, w.id, "casual");
    d.activeTask = null; d.focusArmed = false; d.blockList = []; d.focusSnoozes = {};
    await Storage.saveAll(d);
    return { reason: Storage.blockingReasonFor(d, ${JSON.stringify(ENTRY)}, Date.now(), {}) };
  })()`,
};

// SEED, THEN MAKE THE PRODUCT AGREE. Not a sleep.
//
// Every gate button writes through the worker's enqueueBgData FIFO (BUGS L1),
// and the page's promise resolves on sendResponse - which is not the same
// instant the job's storage write lands. A harness that seeds the next fixture
// immediately can have that stale job arrive on top of it: block 2's
// focus-gate-end wiped block 3's freshly seeded session, and block 3 then
// opened an INERT gate and failed seven assertions about a state it had never
// asked for. A fixed sleep would paper over that and stay flaky.
//
// So: write the fixture, read the DECISION back, and rewrite until the product
// reports the state the block is about. It converges as soon as the queue is
// empty, and a fixture that can never be reached FAILS here, next to the seed,
// instead of misreporting as a broken feature six assertions later.
async function seed(sessionId, expr, wantReason, label) {
  let got = null;
  for (let i = 0; i < 6; i++) {
    got = await ev(sessionId, expr);
    await wait(450);
    const now = await ev(sessionId,
      `(async function () { var d = await Storage.getAll();
         return Storage.blockingReasonFor(d, ${JSON.stringify(ENTRY)}, Date.now(), {}); })()`);
    if (now === wantReason) return got;
  }
  chk(label + ": the fixture never settled", false,
    "wanted reason " + JSON.stringify(wantReason) + ", last seed " + JSON.stringify(got));
  return got;
}

// What the gate is showing, read from the DOM. PAINTED controls only: a
// textContent scrape of .gate-actions button reports the friction panel's two
// as well, and they are 0x0 while it is hidden.
const READ = `(function () {
  var painted = function (e) {
    var cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && cs.display !== "none" &&
           cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0;
  };
  var gate = document.querySelector(".gate");
  return {
    headline: ((document.querySelector(".gate-headline") || {}).textContent || "").trim(),
    reason: ((document.getElementById("gate-context") || {}).textContent || "").trim(),
    foot: ((document.getElementById("gate-footnote") || {}).textContent || "").trim(),
    inert: !!(gate && gate.classList.contains("is-inert")),
    tint: gate ? getComputedStyle(gate).backgroundImage.slice(0, 60) : "",
    buttons: Array.prototype.filter.call(document.querySelectorAll("button"), painted)
      .map(function (b) { return { id: b.id, text: b.textContent.trim(), disabled: b.disabled }; }),
    ids: Array.prototype.map.call(document.querySelectorAll("button"), function (b) { return b.id; }),
    frictionUp: !document.getElementById("gate-friction").classList.contains("hidden"),
    ringPct: (function () { var r = document.getElementById("gate-ring");
      return r ? getComputedStyle(r).getPropertyValue("--ring-pct").trim() : null; })(),
    ringNum: ((document.getElementById("gate-ring-num") || {}).textContent || "").trim(),
    commitUp: !document.getElementById("gate-commit").classList.contains("hidden"),
    commitLabel: ((document.getElementById("gate-commit-label") || {}).textContent || "").trim()
  };
})()`;

const clickJs = (id) => `(function () { var e = document.getElementById(${JSON.stringify(id)});
  if (!e) return false; e.click(); return true; })()`;
// A CLICK THAT FOUND NOTHING IS A FAILURE, NOT A NO-OP. The first run of this
// harness lost three assertions to a control that had been removed from the
// DOM: the click quietly returned false and the reads that followed were empty
// strings, which presented as "the friction panel says nothing" rather than as
// "there was no button to press".
async function clickOk(sessionId, id, where) {
  const landed = await ev(sessionId, clickJs(id));
  chk(where + ": the #" + id + " control is there to be clicked", landed === true,
      landed === true ? "" : "no such element in the DOM");
  return landed === true;
}

// ---------------------------------------------------------------- run ----
let proc;
try {
  fs.mkdirSync(PROFILE, { recursive: true });
  proc = spawn(EDGE, browserArgs({
    profileDir: PROFILE, port: PORT, extDir: REPO,
    headless: false, onScreen: false, url: "about:blank",
  }), { stdio: "ignore", detached: false });

  const ver = await waitForPort();
  const id = await extensionIdWait();
  cdp = connect(ver.webSocketDebuggerUrl);
  await cdp.ready;

  // The seeding page. Storage lives on the new tab; the gate has none.
  const seeder = await openPage(`chrome-extension://${id}/newtab.html`);
  await wait(3500);
  await ev(seeder.sessionId, "LP.devPro(true)");
  await wait(600);

  const gateUrl = `chrome-extension://${id}/gate.html` +
    `?to=${encodeURIComponent(DEST)}&entry=${encodeURIComponent(ENTRY)}`;

  const openGate = async () => {
    const g = await openPage(gateUrl);
    await wait(1400);                       // the worker round-trip
    return g;
  };

  // ===== 1. THE SESSION GATE ==============================================
  {
    const seeded = await seed(seeder.sessionId, FIXTURES.session({}), "session", "session");
    chk("fixture: a WORK-stamped session with an id exists",
      seeded.stamp === "work" && !!seeded.id, JSON.stringify(seeded));
    chk("fixture: the reason is session", seeded.reason === "session", String(seeded.reason));

    const g = await openGate();
    const st = await ev(g.sessionId, READ);
    chk("session: the headline says the host is blocked", /is blocked/.test(st.headline), st.headline);
    chk("session: the tile is NOT inert", st.inert === false);
    chk("session: the tile wears the overdue tint",
      /90,\s*47,\s*42/.test(st.tint), st.tint);
    chk("session: snooze and end are both present",
      st.buttons.some((b) => b.id === "gate-snooze") && st.buttons.some((b) => b.id === "gate-end"),
      JSON.stringify(st.buttons.map((b) => b.id)));
    chk("session: Continue is ABSENT, not disabled (the preview-ghost rule)",
      st.ids.indexOf("gate-continue") === -1, JSON.stringify(st.ids));
    chk("session: the footnote names the blocked domain",
      st.foot.indexOf(ENTRY) !== -1, st.foot);
    await closePage(g.targetId);
  }

  // ===== 2. END -> the destination ========================================
  {
    await seed(seeder.sessionId, FIXTURES.session({}), "session", "end");
    const g = await openGate();
    await clickOk(g.sessionId, "gate-end", "end");
    const landed = await waitForUrl(g.sessionId, (u) => u === DEST);
    chk("END lands on the destination", landed === DEST, landed);
    const after = await ev(seeder.sessionId,
      `(async function () { var d = await Storage.getAll();
         var a = Storage.getActiveTask(d);
         return { phase: a ? Storage.hydratePomodoroState(a.pomodoroState).phase : null,
                  armed: Storage.isFocusManuallyArmed(d) }; })()`);
    chk("END really ended the session (the phase is gone)", !after.phase, JSON.stringify(after));
    await closePage(g.targetId);
  }

  // ===== 3. THE FRICTION SEQUENCE - 10s, then cancel ======================
  {
    await seed(seeder.sessionId, FIXTURES.session({}), "session", "friction");
    const g = await openGate();
    const pre = await ev(g.sessionId, READ);
    chk("friction: the gate is a BLOCKED gate before the snooze",
      pre.inert === false && pre.buttons.some((b) => b.id === "gate-snooze"), JSON.stringify(pre));
    await clickOk(g.sessionId, "gate-snooze", "friction");
    await wait(1200);
    const f = await ev(g.sessionId, READ);
    chk("friction: the panel replaces the actions row", f.frictionUp === true, JSON.stringify(f));
    chk("friction: the FIRST wait counts from 10s",
      Number(f.ringNum) >= 8 && Number(f.ringNum) <= 10, "ringNum=" + f.ringNum);
    chk("friction: the conic is driven by --ring-pct",
      f.ringPct !== null && f.ringPct !== "" && Number(f.ringPct) > 0 && Number(f.ringPct) <= 1,
      "--ring-pct=" + f.ringPct);
    chk("friction: no typed sentence on a FIRST snooze", f.commitUp === false);
    chk("friction: the way out is present and ENABLED at every instant",
      f.buttons.some((b) => b.id === "gate-friction-cancel" && !b.disabled));
    chk("friction: the go button is DISABLED while the wait runs",
      f.buttons.some((b) => b.id === "gate-friction-go" && b.disabled));

    await clickOk(g.sessionId, "gate-friction-cancel", "friction");
    await wait(600);
    const c = await ev(g.sessionId, READ);
    chk("friction: cancel restores the actions row and navigates nowhere",
      c.frictionUp === false && c.buttons.some((b) => b.id === "gate-snooze") &&
      (await tabUrl(g.sessionId)).indexOf("gate.html") !== -1, JSON.stringify(c));
    await closePage(g.targetId);
  }

  // ===== 4. THE FRICTION SEQUENCE - waited out, then through =============
  {
    await seed(seeder.sessionId, FIXTURES.session({}), "session", "waited");
    const g = await openGate();
    await clickOk(g.sessionId, "gate-snooze", "friction");
    await wait(11500);                       // the 10s wait, plus the paint tick
    const r = await ev(g.sessionId, READ);
    chk("friction: the go button ENABLES when the wait is done",
      r.buttons.some((b) => b.id === "gate-friction-go" && !b.disabled),
      JSON.stringify(r.buttons));
    chk("friction: the ring has run down to empty", Number(r.ringPct) <= 0.02, "--ring-pct=" + r.ringPct);
    await clickOk(g.sessionId, "gate-friction-go", "friction");
    const went = await waitForUrl(g.sessionId, (u) => u === DEST);
    chk("friction: GO lands on the destination", went === DEST, went);
    const sn = await ev(seeder.sessionId,
      `(async function () { var d = await Storage.getAll();
         return Object.keys(d.focusSnoozes || {}); })()`);
    chk("friction: GO wrote the snooze before it navigated", sn.indexOf(ENTRY) !== -1, JSON.stringify(sn));
    await closePage(g.targetId);
  }

  // ===== 5. THE REPEAT - 60s, and the typed sentence ======================
  {
    // THE PREVIOUS BLOCK LEFT A LIVE SNOOZE, and a live snooze means the entry
    // does not block, which means the gate renders INERT and there is no
    // #gate-snooze to press. Seeding the record this block wants is therefore
    // not enough - it has to be seeded AFTER the queued write from block 4 has
    // landed, and the `until` has to be in the FUTURE relative to the browser's
    // clock rather than to this process's start, or the entry is snoozed and
    // the state under test never renders.
    const snoozes = `{ ${JSON.stringify(ENTRY)}: { until: Date.now() - 1000, count: 1, session: "sess-drive-gate" } }`;
    const seeded = await seed(seeder.sessionId,
      FIXTURES.session({ commitment: true, snoozes }), "session", "repeat");
    chk("fixture: the repeat is set up - a prior snooze from THIS session, expired",
      seeded.reason === "session", JSON.stringify(seeded));
    const g = await openGate();
    const pre = await ev(g.sessionId, READ);
    chk("repeat: the gate is a BLOCKED gate, not an inert one",
      pre.inert === false && pre.buttons.some((b) => b.id === "gate-snooze"), JSON.stringify(pre));
    await clickOk(g.sessionId, "gate-snooze", "repeat");
    await wait(1200);
    const f = await ev(g.sessionId, READ);
    chk("repeat: the SECOND snooze in one session waits 60s",
      Number(f.ringNum) >= 57 && Number(f.ringNum) <= 60, "ringNum=" + f.ringNum + " " + JSON.stringify(f));
    chk("repeat: the typed sentence is asked for when commitment is armed",
      f.commitUp === true && f.commitLabel.length > 0, JSON.stringify(f));
    chk("repeat: go stays disabled with the sentence unTYPED",
      f.buttons.some((b) => b.id === "gate-friction-go" && b.disabled));
    await closePage(g.targetId);
  }

  // ===== 6. THE SCHEDULE GATE - no session, so no friction ===============
  {
    const seeded = await seed(seeder.sessionId, FIXTURES.schedule(), "schedule", "schedule");
    chk("fixture: a Work workspace with an open schedule window",
      seeded.mode === "work" && seeded.reason === "schedule", JSON.stringify(seeded));

    const g = await openGate();
    const st = await ev(g.sessionId, READ);
    chk("schedule: the tile wears the overdue tint", /90,\s*47,\s*42/.test(st.tint), st.tint);
    chk("schedule: there is NOTHING to end, so the end control is absent",
      st.ids.indexOf("gate-end") === -1, JSON.stringify(st.ids));
    chk("schedule: snooze is the only painted action",
      st.buttons.filter((b) => b.id).length === 1 && st.buttons[0].id === "gate-snooze",
      JSON.stringify(st.buttons.map((b) => b.id)));

    // frictionPlanFor refuses without a work-stamped session, so this snooze
    // goes straight through rather than opening the panel.
    await clickOk(g.sessionId, "gate-snooze", "schedule");
    const straight = await waitForUrl(g.sessionId, (u) => u === DEST);
    chk("schedule: snooze goes STRAIGHT to the destination - no friction without a session",
      straight === DEST, straight);
    await closePage(g.targetId);
  }

  // ===== 7. THE INERT GATE ================================================
  {
    const seeded = await seed(seeder.sessionId, FIXTURES.inert(), null, "inert");
    chk("fixture: nothing is blocking", seeded.reason === null, String(seeded.reason));

    const g = await openGate();
    const st = await ev(g.sessionId, READ);
    chk("inert: the headline says the host is NOT blocked",
      /is not blocked/.test(st.headline), st.headline);
    chk("inert: the tile takes the HERO tint, not the rose",
      st.inert === true && /38,\s*30,\s*34/.test(st.tint), st.tint);
    chk("inert: the blocked vocabulary is gone - snooze and end are both absent",
      st.ids.indexOf("gate-snooze") === -1 && st.ids.indexOf("gate-end") === -1,
      JSON.stringify(st.ids));
    chk("inert: Continue is the one way onward", st.buttons.some((b) => b.id === "gate-continue"));
    chk("inert: the footnote is cleared - no rule is described as live", st.foot === "");

    await clickOk(g.sessionId, "gate-continue", "inert");
    const u = await waitForUrl(g.sessionId, (x) => /newtab\.html$/.test(x));
    chk("inert: Continue lands on LAUNCHPAD, never the destination (53cfc42's ruling)",
      /newtab\.html$/.test(u) && u.indexOf(DEST) === -1, u);
    await closePage(g.targetId);
  }

  // ===== 8. THE SCHEME ALLOWLIST ON ?to= ==================================
  {
    await seed(seeder.sessionId, FIXTURES.session({}), "session", "scheme");
    const g = await openPage(`chrome-extension://${id}/gate.html` +
      `?to=${encodeURIComponent("javascript:alert(1)")}&entry=${encodeURIComponent(ENTRY)}`);
    await wait(1600);
    await clickOk(g.sessionId, "gate-end", "scheme");
    const u = await waitForUrl(g.sessionId, (x) => /newtab\.html$/.test(x));
    chk("a javascript: ?to= is REFUSED and falls back to LaunchPad",
      /newtab\.html$/.test(u) && u.indexOf("javascript:") === -1, u);
    await closePage(g.targetId);
  }
} catch (err) {
  console.error("GATE DRIVE: SUBJECT DID NOT LOAD — " + (err && err.message));
  try { if (cdp) cdp.close(); } catch (e) { /* closing */ }
  try { if (proc) proc.kill(); } catch (e) { /* gone */ }
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* locked */ }
  process.exit(2);
}

// ---- teardown. BY PID, never by image name (I6): taskkill /IM msedge.exe
// closes the developer's real browser along with this one.
try { cdp.close(); } catch (e) { /* closing */ }
try { proc.kill(); } catch (e) { /* gone */ }
await wait(900);
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* locked */ }

console.log("\nDRIVE THE GATE — every state, every button, to its destination\n");
for (const r of rows) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "   << " + r.detail}`);

// Anti-vacuity floor (BUGS.md P2). This suite was born at 30 assertions across
// eight states; a run that quietly stops reaching the browser must fail rather
// than report a clean nothing.
const MIN = 40;
if (rows.length < MIN) {
  console.log(`\nDRIVE THE GATE: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the harness is broken, not the gate.\n`);
  process.exit(1);
}
console.log(`\nDRIVE THE GATE: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
