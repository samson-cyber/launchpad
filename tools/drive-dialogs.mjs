#!/usr/bin/env node
// ===========================================================================
// DRIVE THE DIALOGS - every confirm in the product, opened, read, cancelled
// and confirmed.
//
// WHY THIS IS COMMITTED RATHER THAN LEFT IN A SCRATCHPAD. [1.11.3d] built a
// pixel-diff measurer, used it, and never committed it; the 2026-09-15 ink
// round had to rebuild it from scratch. This harness is the thing THREE ROUNDS
// could not produce (Asana 1217995910218382) and it is not being lost the same
// way.
//
// WHAT IT ASSERTS, per dialog: the dialog is IN THE VIEWPORT; it carries role
// and aria-modal; its title, sentence and BOTH button labels are read from the
// DOM; CANCEL HAS FOCUS on open; danger styling matches whether the action is
// destructive; the focus trap holds on Tab AND Shift-Tab; Escape closes it;
// CANCEL LEAVES STATE UNCHANGED; CONFIRM CHANGES IT.
//
// CANCEL FIRST, ALWAYS. A harness that confirms first has destroyed the state
// its cancel assertion needed.
//
// THE FIXTURE STATES ARE THE HARD PART, and the lesson that cost two rounds is
// SEED THROUGH THE WRITER THE PRODUCT USES:
//   workspace   created through the Pro Settings form. A hand-built record
//               pushed to data.workspaces is invisible to the panel, which
//               renders from data.workspaceOrder and filters misses.
//   variants    created by adding a same-domain URL and accepting the nest
//               offer - which is how a user makes one.
//   backup      exported through Storage.buildBackupEnvelope, the product's
//               own builder, then handed back through the real file input.
//   nest        findDomainMatchInGroup(modalState.groupId, url): the match must
//               be in THE SAME GROUP as the add-tile clicked. An earlier round
//               clicked the first add-tile and typed a URL whose domain lived
//               in a different group, so the condition was never met and the
//               dialog correctly never opened.
//
//   node --experimental-websocket tools/drive-dialogs.mjs [browser-path]
//   (Node 20 needs the flag; Node 22+ does not. Runs on Edge - BUGS I22.)
//   [ROUND FL] Also drives Linux Chromium when given its path. As root it needs
//   --no-sandbox, which belongs in a one-line wrapper script passed as the
//   path, not in this file's flags.
// Exit 0 = PASS, 1 = FAIL.
// ===========================================================================
import fs from "node:fs";

// ---- CDP helper, INLINED so this file stands alone -----------------------
// tools/ carries no shared CDP module and capture-screenshots.mjs is
// self-contained for the same reason: a tool that imports from a scratchpad
// is a tool that breaks the moment the scratchpad is gone.
import path from "node:path";
import { spawn } from "node:child_process";
// Minimal CDP helper, reused from the earlier rounds in this arc.
// Node 20 needs --experimental-websocket.




import { browserArgs } from "./browser-launch.mjs";
import { decodePNG } from "./pixel-contrast.mjs";

// [H3a] DERIVED FROM cwd, and the note this replaces had been recording the
// bug for two rounds: an absolute REPO means a worktree drives the MAIN
// checkout, so the tool reports on a tree nobody is editing. H2d fixed the
// same thing in drive-gate.mjs, whose header cites THIS file as the example -
// so the note had outlived its own reason not to act on it. A harness that
// silently tests the wrong tree is worse than one that fails to start.
const REPO = process.cwd();

function launch(profileDir, port) {
  // [ROUND FL] THE HEADER HAS ALWAYS DOCUMENTED A [browser-path] ARGUMENT AND
  // THIS LINE NEVER READ IT, so the harness could only ever drive Edge at its
  // Windows install path. Honoured now, defaulting to exactly that path, so a
  // Windows run is unchanged and a run elsewhere (a Chromium in a container)
  // can be pointed at its browser rather than rewritten.
  const exe = process.argv[2] || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  // Off-screen by default via browser-launch.mjs; this harness is headless
  // anyway, and stays that way - it drives dialogs over CDP and needs neither
  // a compositor nor a window manager.
  const args = browserArgs({
    profileDir: profileDir,
    extDir: REPO,
    port: port,
    windowSize: null,
    headless: true,
  });
  const p = spawn(exe, args, { detached: false, stdio: "ignore" });
  return p;
}

async function waitForPort(port, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("CDP port never opened");
}

// BUGS.md I7: the extension id comes from Secure Preferences, matched on the
// REPO PATH. Taking "the first chrome-extension:// target" gets one of Edge's
// own force-installed extensions.
//
// [ROUND FL] Linux Chromium keeps the same record in plain "Preferences" and
// leaves Secure Preferences' extension map empty, so both are read - Secure
// Preferences first, which is where Edge on Windows puts it.
function extensionId(profileDir, tries = 40) {
  const files = ["Secure Preferences", "Preferences"].map((n) => path.join(profileDir, "Default", n));
  // Both sides normalised to one separator: the old form normalised only the
  // stored path, toward backslashes, so it could never match a POSIX REPO. On
  // Windows the comparison is unchanged.
  const norm = (x) => x.toLowerCase().replace(/\\/g, "/");
  for (let i = 0; i < tries; i++) {
    for (const f of files) {
      try {
        const j = JSON.parse(fs.readFileSync(f, "utf8"));
        const settings = j?.extensions?.settings || {};
        for (const [id, v] of Object.entries(settings)) {
          if (norm((v && v.path) || "") === norm(REPO)) return id;
        }
      } catch (e) {}
    }
  }
  return null;
}

async function extensionIdWait(profileDir, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const id = extensionId(profileDir, 1);
    if (id) return id;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("extension id never appeared in Secure Preferences");
}

let msgId = 0;

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    } else {
      listeners.forEach((fn) => fn(m));
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  return {
    ready,
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
    send(method, params = {}, sessionId) {
      const id = ++msgId;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify(payload));
      });
    },
  };
}

// Open a target and return a flat session id for it.
async function openPage(cdp, url) {
  const { targetId } = await cdp.send("Target.createTarget", { url });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  return { targetId, sessionId };
}

async function evaluate(cdp, sessionId, expression, awaitPromise = true) {
  const r = await cdp.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise,
  }, sessionId);
  if (r.exceptionDetails) {
    throw new Error("page threw: " + (r.exceptionDetails.exception?.description ||
                                      r.exceptionDetails.text));
  }
  return r.result.value;
}



const PROFILE = path.join(REPO, ".scratch-profile-dlg-" + process.pid);
const PORT = 9700 + (process.pid % 250);   // I25: unique per run
fs.rmSync(PROFILE, { recursive: true, force: true });
const proc = launch(PROFILE, PORT);
const ver = await waitForPort(PORT);
const id = await extensionIdWait(PROFILE);
const cdp = connect(ver.webSocketDebuggerUrl);
await cdp.ready;
const URL_ = `chrome-extension://${id}/newtab.html`;
const { sessionId } = await openPage(cdp, URL_);
const ev = (e) => evaluate(cdp, sessionId, e);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await cdp.send("Emulation.setDeviceMetricsOverride",
  { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await wait(3000); await ev(`LP.devPro(true)`); await wait(800);
// [H3a] AND THE SECOND ONE, which the first fix missed. REPO became
// cwd-derived above while this line still read the MAIN checkout's
// fixture seeder - so a worktree run drove its own tree with another
// tree's fixture, which is the harder half of the same bug to notice,
// because it fails silently rather than not at all.
const seedSrc = fs.readFileSync(path.join(REPO, "tools", "capture-fixture.js"), "utf8");
await ev(`(async () => { ${seedSrc} \n return await __seedCaptureFixture(); })()`);
await cdp.send("Page.navigate", { url: URL_ }, sessionId);
await wait(3300); await ev(`LP.devPro(true)`); await wait(900);

let pass = 0, fail = 0;
const chk = (n, ok, x) => { ok ? pass++ : fail++;
  console.log("    " + (ok ? "PASS  " : "FAIL  ") + n + (x ? "   << " + x : "")); };

const READ = `(function () {
  var ov = document.querySelector(".tt-modal-overlay");
  if (!ov) return JSON.stringify({ open: false });
  var m = ov.querySelector(".tt-modal"), r = m.getBoundingClientRect();
  var p = ov.querySelector(".tt-modal-primary"), c = ov.querySelector(".tt-modal-cancel");
  return JSON.stringify({ open: true,
    title: (ov.querySelector(".tt-modal-title") || {}).textContent || "",
    message: (ov.querySelector(".tt-modal-message") || {}).textContent || "",
    primaryLabel: p ? p.textContent : null, cancelLabel: c ? c.textContent : null,
    dangerous: !!(p && p.classList.contains("tt-modal-btn-danger")),
    // [RULING 42] The fill the primary ACTUALLY paints, and the action token
    // RESOLVED BY THE BROWSER rather than hardcoded here. A literal
    // "rgb(255, 138, 61)" in this file would keep passing after someone
    // retuned --action, and would then be asserting the old colour.
    primaryFill: p ? getComputedStyle(p).backgroundColor : null,
    primaryInk: p ? getComputedStyle(p).color : null,
    actionFill: (function () {
      var probe = document.createElement("span");
      probe.style.cssText = "background:var(--action);color:var(--ink-on-action);position:fixed;left:-9999px";
      document.body.appendChild(probe);
      var cs = getComputedStyle(probe);
      var out = { fill: cs.backgroundColor, ink: cs.color };
      probe.remove();
      return out;
    })(),
    focused: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : null,
    inViewport: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.width > 0,
    role: m.getAttribute("role"), ariaModal: m.getAttribute("aria-modal") });
})()`;
const key = async (k, shift) => {
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send("Input.dispatchKeyEvent", { type, key: k, code: k,
      modifiers: shift ? 8 : 0, windowsVirtualKeyCode: k === "Escape" ? 27 : 9 }, sessionId);
  }
};
const click = (s) => ev(`(function(){var e=document.querySelector(${JSON.stringify(s)});
  if(!e) return "no"; e.click(); return "ok";})()`);

async function contract(label, dangerous) {
  const d = JSON.parse(await ev(READ));
  chk(`${label}: opens IN-PAGE`, d.open === true, d.open ? "title=" + JSON.stringify(d.title) : "no overlay");
  if (!d.open) return null;
  chk(`${label}: role=dialog + aria-modal`, d.role === "dialog" && d.ariaModal === "true");
  chk(`${label}: IN THE VIEWPORT`, d.inViewport === true);
  chk(`${label}: title + sentence + BOTH labels`,
    !!d.title && !!d.message && !!d.primaryLabel && !!d.cancelLabel,
    `${JSON.stringify(d.title)} | ${JSON.stringify(d.primaryLabel)} | ${JSON.stringify(d.cancelLabel)}`);
  chk(`${label}: CANCEL HAS FOCUS on open`, /tt-modal-cancel/.test(String(d.focused)), "focus=" + d.focused);
  chk(`${label}: danger styling ${dangerous ? "present" : "ABSENT (not destructive)"}`,
    d.dangerous === dangerous);

  // [RULING 42] ONE ACTION COLOUR, ASSERTED ON THE PAINTED PIXEL RATHER THAN
  // ON THE CLASS LIST. The class check above only says which branch of the
  // markup ran; it says nothing about which rule won. That distinction is the
  // whole point this round: `.tag-create-btn-primary` carried its class
  // correctly and still painted the neutral wash, because a ground-scoped rule
  // out-ranked it, and no class-level assertion anywhere could have seen it.
  //
  // The destructive case asserts the NEGATIVE, which is the other half of
  // "never a second action on the same view": a delete button that wore the
  // action colour would read as the safe default.
  if (dangerous) {
    chk(`${label}: the destructive primary does NOT wear the action colour`,
      d.primaryFill !== d.actionFill.fill,
      `primary=${d.primaryFill} action=${d.actionFill.fill}`);
  } else {
    chk(`${label}: the primary is filled with --action, resolved`,
      d.primaryFill === d.actionFill.fill,
      `primary=${d.primaryFill} action=${d.actionFill.fill}`);
    chk(`${label}: the primary's ink is --ink-on-action, resolved`,
      d.primaryInk === d.actionFill.ink,
      `primary=${d.primaryInk} action=${d.actionFill.ink}`);
  }
  await ev(`(function(){var b=document.querySelectorAll(".tt-modal-overlay button");
    if(b.length) b[b.length-1].focus();})()`);
  await key("Tab"); await wait(180);
  chk(`${label}: focus trap holds on Tab`,
    (await ev(`(function(){var o=document.querySelector(".tt-modal-overlay");
      return o && o.contains(document.activeElement) ? "in":"OUT";})()`)) === "in");
  await ev(`(function(){var b=document.querySelectorAll(".tt-modal-overlay button");
    if(b.length) b[0].focus();})()`);
  await key("Tab", true); await wait(180);
  chk(`${label}: focus trap holds on Shift-Tab`,
    (await ev(`(function(){var o=document.querySelector(".tt-modal-overlay");
      return o && o.contains(document.activeElement) ? "in":"OUT";})()`)) === "in");
  return d;
}
const focusReturned = async (label) =>
  chk(`${label}: focus RETURNED to the page, not body`,
    (await ev(`(function(){return document.activeElement && document.activeElement!==document.body
      ? (document.activeElement.className||document.activeElement.tagName):"body";})()`)) !== "body");

// KNOWN OPEN, reported every run and deliberately NOT counted as a failure, so
// a committed tool does not exit 1 for a defect that is filed rather than new.
//
// The nest confirm is raised from saveModal(), inside the OLD add-shortcut
// modal (#modal-overlay), which is not an openTasksModal at all. Its opener is
// #modal-save, and by the time the confirm closes that button is HIDDEN rather
// than removed - so document.contains() still says it is there, .focus() is a
// silent no-op on a hidden element, and focus lands on <body>. The user loses
// their place and the next Tab starts at the top of the document.
//
// Both DESTRUCTIVE confirms restore focus correctly; this is the one
// non-destructive dialog, and the fix belongs with whoever reunifies
// #modal-overlay with the tt-modal system rather than in a dialog round.
let known = 0;
const knownOpen = async (label, desc) => {
  const at = await ev(`(function(){return document.activeElement && document.activeElement!==document.body
    ? (document.activeElement.className||document.activeElement.tagName):"body";})()`);
  if (at === "body") { known++; console.log("    KNOWN  " + label + ": " + desc); }
  else chk(`${label}: focus RETURNED to the page, not body`, true, "now fixed - retire this branch");
};

// ============================================ 1. NEST UNDER AN EXISTING =====
// Same group as the add-tile. Daily holds www.notion.so, so a second notion.so
// URL added through DAILY's own add-tile meets the condition.
console.log("\n  1. NEST UNDER AN EXISTING DOMAIN (not destructive)");
const openNest = async () => {
  await ev(`(function(){
    var gs = document.querySelectorAll(".group");
    for (var i=0;i<gs.length;i++){
      if (/Daily/.test((gs[i].querySelector(".group-name")||{}).textContent||"")) {
        var t = gs[i].querySelector(".add-tile"); if (t) { t.click(); return "daily add-tile"; }
      }
    } return "no Daily add-tile";})()`);
  await wait(900);
  return ev(`(function(){
    var u = document.querySelector("#modal-url"), n = document.querySelector("#modal-name");
    if (!u) return "no url field";
    u.value = "https://www.notion.so/second-page"; u.dispatchEvent(new Event("input",{bubbles:true}));
    if (n) { n.value = "Notion Second"; n.dispatchEvent(new Event("input",{bubbles:true})); }
    var s = document.querySelector("#modal-save"); if (s) { s.click(); return "saved"; }
    return "no save";})()`);
};
console.log("    (" + (await openNest()) + ")");
await wait(1200);
const nestD = await contract("nest", false);
if (nestD) {
  const before = await ev(`(async()=>{var r=await chrome.storage.local.get("data");
    var ws=(r.data.workspaces||[])[0]||{};
    var g=(ws.groups||[]).find(function(x){return x.name==="Daily";})||{};
    var n=(g.shortcuts||[]).find(function(s){return /notion\\.so$/.test(new URL(s.url).hostname);});
    return JSON.stringify({variants:(n&&n.variants||[]).length,count:(g.shortcuts||[]).length});})()`);
  await key("Escape"); await wait(800);
  chk("nest: Escape closes it", JSON.parse(await ev(READ)).open === false);
  const afterCancel = await ev(`(async()=>{var r=await chrome.storage.local.get("data");
    var ws=(r.data.workspaces||[])[0]||{};
    var g=(ws.groups||[]).find(function(x){return x.name==="Daily";})||{};
    var n=(g.shortcuts||[]).find(function(s){return /notion\\.so$/.test(new URL(s.url).hostname);});
    return JSON.stringify({variants:(n&&n.variants||[]).length,count:(g.shortcuts||[]).length});})()`);
  chk("nest: CANCEL did not nest it (added as its own shortcut instead)",
    JSON.parse(afterCancel).variants === JSON.parse(before).variants,
    `variants ${JSON.parse(before).variants} -> ${JSON.parse(afterCancel).variants}`);
  await knownOpen("nest", "focus falls to <body> - opener is a hidden control in #modal-overlay");

  // CONFIRM: reopen and accept, which also BUILDS THE VARIANT for case 2.
  console.log("    (" + (await openNest()) + ")");
  await wait(1200);
  if (JSON.parse(await ev(READ)).open) {
    await click(".tt-modal-primary"); await wait(1500);
    const nested = await ev(`(async()=>{var r=await chrome.storage.local.get("data");
      var ws=(r.data.workspaces||[])[0]||{};
      var g=(ws.groups||[]).find(function(x){return x.name==="Daily";})||{};
      var n=(g.shortcuts||[]).find(function(s){return /notion\\.so$/.test(new URL(s.url).hostname);});
      return (n&&n.variants||[]).length;})()`);
    chk("nest: CONFIRM nested it as a variant", nested > 0, "variants=" + nested);
  } else chk("nest: CONFIRM nested it as a variant", false, "did not reopen");
}

// ============================================ 2. DELETE WITH VARIANTS =======
console.log("\n  2. DELETE A SHORTCUT CARRYING VARIANTS (destructive)");
await cdp.send("Page.navigate", { url: URL_ }, sessionId);
await wait(3200); await ev(`LP.devPro(true)`); await wait(900);
const openVarDelete = async () => {
  // the SIDEBAR shortcut context menu owns this confirm
  await ev(`(function(){var b=document.querySelector("#sb-expand-all, .sb-group-toggle");if(b)b.click();})()`);
  await wait(600);
  return ev(`(function(){
    var items = document.querySelectorAll(".sidebar-shortcut-item");
    for (var i=0;i<items.length;i++){
      if (/Notion/.test(items[i].textContent||"")) {
        var e = new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:200,clientY:300});
        items[i].dispatchEvent(e); return "ctx on " + items[i].textContent.trim().slice(0,18);
      }
    } return "no Notion sidebar item (" + items.length + " items)";})()`);
};
console.log("    (" + (await openVarDelete()) + ")");
await wait(800);
const delClicked = await ev(`(function(){
  var m = document.querySelector("#sidebar-shortcut-ctx-menu");
  if (!m || m.classList.contains("hidden")) return "menu not open";
  var d = m.querySelector('[data-action="delete"]');
  if (!d) return "no delete item";
  d.click(); return "clicked delete";})()`);
console.log("    (" + delClicked + ")");
await wait(900);
const varD = await contract("variants delete", true);
if (varD) {
  await key("Escape"); await wait(800);
  chk("variants delete: Escape closes it", JSON.parse(await ev(READ)).open === false);
  chk("variants delete: CANCEL LEFT THE SHORTCUT in place",
    (await ev(`(async()=>{var r=await chrome.storage.local.get("data");
      var ws=(r.data.workspaces||[])[0]||{};
      var g=(ws.groups||[]).find(function(x){return x.name==="Daily";})||{};
      return (g.shortcuts||[]).some(function(s){return /notion\\.so$/.test(new URL(s.url).hostname);});})()`)) === true);
  await focusReturned("variants delete");
  console.log("    (" + (await openVarDelete()) + ")");
  await wait(800);
  await ev(`(function(){var m=document.querySelector("#sidebar-shortcut-ctx-menu");
    if(m){var d=m.querySelector('[data-action="delete"]'); if(d) d.click();}})()`);
  await wait(900);
  if (JSON.parse(await ev(READ)).open) {
    await click(".tt-modal-primary"); await wait(1500);
    chk("variants delete: CONFIRM REMOVED the shortcut AND its variants",
      (await ev(`(async()=>{var r=await chrome.storage.local.get("data");
        var ws=(r.data.workspaces||[])[0]||{};
        var g=(ws.groups||[]).find(function(x){return x.name==="Daily";})||{};
        return !(g.shortcuts||[]).some(function(s){return /notion\\.so$/.test(new URL(s.url).hostname);});})()`)) === true);
  } else chk("variants delete: CONFIRM REMOVED the shortcut AND its variants", false, "did not reopen");
}

// ============================================ 3. DELETE A GROUP ============
// [ROUND FL / RULING 52] #group-delete-dialog JOINS THE DRIVEN SET. It is a v1
// dialog, not an openTasksModal, so READ above cannot see it and it has its own
// reader here.
//
// RULING 52 IS WHY THE PRIMARY ASSERTION IS THE NON-DESTRUCTIVE ONE. "Move &
// Delete" keeps the action pair: MOVE is the action and the delete is its
// consequence - the shortcuts survive. A dialog whose primary preserves the
// user's content is not a destructive confirm even when a container goes away,
// so the destructive assertion is deliberately NOT extended to it. What IS
// asserted is the same thing the tt-modals carry: the primary WEARS --action,
// resolved by the browser rather than hardcoded, and on the PAINTED PIXEL as
// well as the computed style - the tag popover's Save carried the right class
// and the right declaration and still painted the neutral wash.
//
// THE v1 DIALOG'S OWN GAPS ARE REPORTED, NOT COUNTED: it carries no role or
// aria-modal and does not move focus on open. Those belong with whoever
// reunifies it with the tt-modal system (the same note as the nest confirm's
// focus, above), not with a round about its ink.
console.log("\n  3. DELETE A GROUP THAT HOLDS SHORTCUTS (ruling 52: move is the action)");
await cdp.send("Page.navigate", { url: URL_ }, sessionId);
await wait(3200); await ev(`LP.devPro(true)`); await wait(900);
const GROUP = "Read";
const groupState = () => ev(`(async()=>{var r=await chrome.storage.local.get("data");
  var ws=(r.data.workspaces||[])[0]||{};
  var live=(ws.groups||[]).filter(function(g){return !g.deletedAt;});
  var g=live.find(function(x){return x.name===${JSON.stringify(GROUP)};});
  var counts={}; live.forEach(function(x){counts[x.id]=(x.shortcuts||[]).length;});
  return JSON.stringify({present:!!g, id:g?g.id:null, n:g?(g.shortcuts||[]).length:0, counts:counts});})()`).then(JSON.parse);
const openGroupDelete = () => ev(`(function(){
  var gs=document.querySelectorAll(".group");
  for (var i=0;i<gs.length;i++){
    if ((gs[i].querySelector(".group-name")||{}).textContent===${JSON.stringify(GROUP)}) {
      var b=gs[i].querySelector(".group-more-btn"); if(!b) return "no more-btn";
      b.click();
      var d=document.querySelector('#group-menu [data-action="delete"]');
      if(!d) return "no delete item"; d.click(); return "clicked delete on " + ${JSON.stringify(GROUP)};
    }
  } return "no group " + ${JSON.stringify(GROUP)};})()`);
const GD_READ = `(function () {
  var ov = document.getElementById("group-delete-overlay"), dlg = document.getElementById("group-delete-dialog");
  if (!ov || ov.classList.contains("hidden")) return JSON.stringify({ open: false });
  var r = dlg.getBoundingClientRect(), p = document.getElementById("gd-move-delete"), c = document.getElementById("gd-cancel");
  var pr = p.getBoundingClientRect();
  var probe = document.createElement("span");
  probe.style.cssText = "background:var(--action);color:var(--ink-on-action);position:fixed;left:-9999px";
  document.body.appendChild(probe);
  var pc = getComputedStyle(probe), act = { fill: pc.backgroundColor, ink: pc.color };
  probe.remove();
  return JSON.stringify({ open: true,
    title: document.getElementById("gd-title").textContent, message: document.getElementById("gd-message").textContent,
    primaryLabel: p.textContent, cancelLabel: c.textContent,
    moveVisible: !document.getElementById("gd-move-section").classList.contains("hidden"),
    primaryDanger: p.classList.contains("gd-btn-danger"),
    primaryFill: getComputedStyle(p).backgroundColor, primaryInk: getComputedStyle(p).color, actionFill: act,
    box: { x: pr.x, y: pr.y, width: pr.width, height: pr.height },
    target: document.getElementById("gd-move-target").value,
    inViewport: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.width > 0,
    role: dlg.getAttribute("role"), ariaModal: dlg.getAttribute("aria-modal"),
    focusInside: dlg.contains(document.activeElement) });
})()`;
// The painted fill: the MODAL colour inside the button's box, from the screen.
// Text is a minority of the box, so the most common pixel is the fill.
async function paintedFill(box) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png",
    clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } }, sessionId);
  const img = decodePNG(Buffer.from(shot.data, "base64"));
  const tally = new Map();
  for (let i = 0; i < img.w * img.h; i++) {
    const k = img.data[i * img.ch] + "," + img.data[i * img.ch + 1] + "," + img.data[i * img.ch + 2];
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
}
const rgbOf = (css) => (css.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const before = await groupState();
console.log("    (" + (await openGroupDelete()) + ")");
await wait(700);
const g = JSON.parse(await ev(GD_READ));
chk("group delete: opens IN-PAGE", g.open === true, g.open ? "title=" + JSON.stringify(g.title) : "overlay hidden");
if (g.open) {
  chk("group delete: IN THE VIEWPORT", g.inViewport === true);
  chk("group delete: title + sentence + BOTH labels, and the move section is offered",
    !!g.title && !!g.message && !!g.primaryLabel && !!g.cancelLabel && g.moveVisible,
    `${JSON.stringify(g.title)} | ${JSON.stringify(g.primaryLabel)} | ${JSON.stringify(g.cancelLabel)}`);
  chk("group delete: the primary is NOT danger-styled (ruling 52)", g.primaryDanger === false);
  chk("group delete: the primary is filled with --action, resolved",
    g.primaryFill === g.actionFill.fill, `primary=${g.primaryFill} action=${g.actionFill.fill}`);
  chk("group delete: the primary's ink is --ink-on-action, resolved",
    g.primaryInk === g.actionFill.ink, `primary=${g.primaryInk} action=${g.actionFill.ink}`);
  const px = await paintedFill(g.box), want = rgbOf(g.actionFill.fill);
  chk("group delete: the primary PAINTS --action (screen pixel, +/-3)",
    px.every((v, i) => Math.abs(v - want[i]) <= 3), `painted=rgb(${px.join(", ")}) action=${g.actionFill.fill}`);
  if (g.role !== "dialog" || g.ariaModal !== "true") { known++; console.log("    KNOWN  group delete: no role=dialog / aria-modal - a v1 dialog, not an openTasksModal"); }
  if (!g.focusInside) { known++; console.log("    KNOWN  group delete: focus is not moved into the dialog on open"); }
  await key("Escape"); await wait(600);
  chk("group delete: Escape closes it", JSON.parse(await ev(GD_READ)).open === false);
  console.log("    (" + (await openGroupDelete()) + ")"); await wait(700);
  await click("#gd-cancel"); await wait(700);
  const afterCancel = await groupState();
  chk("group delete: CANCEL LEFT THE GROUP and its shortcuts in place",
    afterCancel.present && afterCancel.n === before.n, `present=${afterCancel.present} n=${before.n}->${afterCancel.n}`);
  console.log("    (" + (await openGroupDelete()) + ")"); await wait(700);
  const target = JSON.parse(await ev(GD_READ)).target;
  await click("#gd-move-delete"); await wait(1500);
  const afterMove = await groupState();
  chk("group delete: MOVE & DELETE removed the group AND kept its shortcuts in the target",
    !afterMove.present && afterMove.counts[target] === (before.counts[target] || 0) + before.n,
    `present=${afterMove.present} target ${before.counts[target] || 0} -> ${afterMove.counts[target]} (moved ${before.n})`);
}

// ====================================== 4. THE RIGHT-CLICK PATH (RULING 59) =
// Two FUNCTIONAL bugs, not ink, on the path every user takes. Both were found
// by Round FL's frames and neither had a driven proof until here.
//
// 4A. The tag-create popover captures #tag-submenu as its anchor, CLOSES the
//     submenu, and only then reads the anchor's rect - which is now all zeros,
//     because the element is display:none. The popover lands at (0, 6) in the
//     viewport's top-left corner, with the shortcut context menu still open
//     behind it.
//
// 4B. #menu-nest-with is the ONLY one of the four toggles that passes
//     hasVariants UN-NEGATED. classList.toggle(name, undefined) has no force
//     argument, so it FLIPS. The other three pass !hasVariants, which coerces
//     undefined to a real boolean, which is why only this one item alternates.
//
//     THE RECORD THAT TRIGGERS IT IS THE ORDINARY ONE. The capture fixture
//     seeds variants: [] and would never reproduce this. The add-shortcut
//     modal builds { url, title, favicon } and Storage.addShortcut adds id,
//     addedAt, deletedAt and tagIds - so a shortcut THE USER ADDED has no
//     variants key at all and hasVariants is undefined for it.
console.log("\n  4. THE RIGHT-CLICK PATH: tag-create popover + Nest with... (ruling 59)");
await cdp.send("Page.navigate", { url: URL_ }, sessionId);
await wait(3200); await ev(`LP.devPro(true)`); await wait(900);

// ---- 4A ------------------------------------------------------------------
const rightClickTile = () => ev(`(function(){
  var t = document.querySelector("#groups .shortcuts-grid .shortcut");
  if (!t) return "no shortcut tile";
  var r = t.getBoundingClientRect();
  t.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
    clientX: Math.round(r.left + r.width / 2), clientY: Math.round(r.top + r.height / 2) }));
  return "ctx on " + (t.dataset.id || "?");
})()`);
console.log("    (" + (await rightClickTile()) + ")");
await wait(700);
const menuUp = JSON.parse(await ev(`(function(){
  var m = document.querySelector("#shortcut-menu");
  var r = m ? m.getBoundingClientRect() : null;
  return JSON.stringify({ open: !!m && !m.classList.contains("hidden"),
    left: r ? Math.round(r.left) : null, top: r ? Math.round(r.top) : null });
})()`));
chk("tag popover: the shortcut menu opens on right-click", menuUp.open === true,
  `menu at (${menuUp.left}, ${menuUp.top})`);

await click("#menu-add-tag"); await wait(700);
// The submenu's rect is read HERE, while it is still on screen - this is the
// reading the product itself fails to take before it closes the element.
const subRect = JSON.parse(await ev(`(function(){
  var s = document.querySelector("#tag-submenu");
  if (!s || s.classList.contains("hidden")) return JSON.stringify({ open: false });
  var r = s.getBoundingClientRect();
  return JSON.stringify({ open: true, left: Math.round(r.left), top: Math.round(r.top),
    bottom: Math.round(r.bottom), width: Math.round(r.width) });
})()`));
chk("tag popover: the Tags submenu opens", subRect.open === true,
  subRect.open ? `submenu at (${subRect.left}, ${subRect.top})` : "submenu hidden");

await ev(`(function(){var b=document.querySelector("#tag-submenu .tag-submenu-create"); if(b) b.click();})()`);
await wait(800);
const popState = JSON.parse(await ev(`(function(){
  var p = document.querySelector("#tag-create-popover");
  var m = document.querySelector("#shortcut-menu");
  var sm = document.querySelector("#tag-submenu");
  var r = p ? p.getBoundingClientRect() : null;
  return JSON.stringify({
    open: !!p && !p.classList.contains("hidden"),
    left: r ? Math.round(r.left) : null, top: r ? Math.round(r.top) : null,
    width: r ? Math.round(r.width) : null, height: r ? Math.round(r.height) : null,
    inViewport: !!r && r.top >= 0 && r.left >= 0 && r.width > 0 && r.height > 0
                && r.right <= innerWidth && r.bottom <= innerHeight,
    menuStillOpen: !!m && !m.classList.contains("hidden"),
    submenuStillOpen: !!sm && !sm.classList.contains("hidden") });
})()`));
chk("tag popover: it opens", popState.open === true);
chk("tag popover: IN THE VIEWPORT", popState.inViewport === true,
  `rect (${popState.left}, ${popState.top}) ${popState.width}x${popState.height}`);
// THE DISCRIMINATOR. With the defect the popover sits at x=0, top=6 - the
// viewport corner - while the submenu it claims to be anchored to is hundreds
// of pixels away.
//
// BOTH VERTICAL PLACEMENTS ARE CORRECT, and a first version of this assertion
// only allowed one. openTagCreatePopover places the popover BELOW the anchor,
// then flips it ABOVE when below would overflow the viewport - which is what
// happens here, because the submenu's bottom is 811 in a 900px-tall window.
// Asserting only "top === bottom + 6" failed a correctly placed popover, so
// the assertion was wrong rather than the fix.
const below = Math.abs(popState.top - (subRect.bottom + 6)) <= 24;
const above = Math.abs((popState.top + popState.height) - (subRect.top - 6)) <= 24;
const nearAnchor = popState.open && subRect.open
  && Math.abs(popState.left - subRect.left) <= 24 && (below || above);
chk("tag popover: ANCHORED TO THE SUBMENU it was opened from, not the viewport corner",
  nearAnchor === true,
  `popover (${popState.left}, ${popState.top}) ${popState.width}x${popState.height} vs submenu ` +
  `(${subRect.left}, top ${subRect.top}, bottom ${subRect.bottom})` +
  (nearAnchor ? `  [placed ${below ? "below" : "above"} the anchor]` : ""));
chk("tag popover: THE CONTEXT MENU IS CLOSED behind it",
  popState.menuStillOpen === false, `#shortcut-menu open=${popState.menuStillOpen}`);
await key("Escape"); await wait(500);

// ---- 4B ------------------------------------------------------------------
// The record shape is COPIED FROM THE PRODUCT'S OWN add-shortcut branch, and
// written through Storage.addShortcut, the writer that branch calls. Then the
// stored record is read back and the missing key is asserted, so the premise
// is proven here rather than assumed.
// BOTH records are made HERE rather than taken from the fixture, because
// sections 1-3 delete the fixture's variant-carrying shortcut and its group.
// A first pass reused "Notion" and read [true,true,true] off a menu that never
// opened - a PASS on a tile that no longer existed. The tile lookup below now
// fails loudly for exactly that reason.
const madeRecords = await ev(`(async () => {
  var d = await Storage.getAll();
  var ws = Storage.getActiveWorkspace(d);
  var g = (ws.groups || []).find(function (x) { return (x.shortcuts || []).length > 0; });
  if (!g) return "no group";
  // The record shape of the add-shortcut modal's own branch, verbatim.
  await Storage.addShortcut(g.id, {
    url: "https://rc-no-variants.example.com/", title: "RC no-variants", favicon: ""
  });
  // And one carrying variants, which is what the nest flow leaves behind.
  await Storage.addShortcut(g.id, {
    url: "https://rc-has-variants.example.com/", title: "RC has-variants", favicon: "",
    variants: [{ id: "rcv1", url: "https://rc-has-variants.example.com/two", title: "two" }]
  });
  var d2 = await Storage.getAll();
  var ws2 = Storage.getActiveWorkspace(d2);
  var g2 = (ws2.groups || []).find(function (x) { return x.id === g.id; });
  var pick = function (t) { return (g2.shortcuts || []).find(function (s) { return s.title === t; }); };
  var a = pick("RC no-variants"), b = pick("RC has-variants");
  if (!a || !b) return "not stored";
  return JSON.stringify({ groupId: g.id,
    noVarKey: Object.prototype.hasOwnProperty.call(a, "variants"),
    hasVarLen: (b.variants || []).length });
})()`);
let recs = null;
try { recs = JSON.parse(madeRecords); } catch (e) { /* string error */ }
chk("nest-with: the product's own writer stores a shortcut with NO variants key",
  !!recs && recs.noVarKey === false,
  recs ? `hasVariantsKey=${recs.noVarKey}` : String(madeRecords));
chk("nest-with: and the control record DOES carry variants",
  !!recs && recs.hasVarLen === 1, recs ? `variants.length=${recs.hasVarLen}` : String(madeRecords));

await cdp.send("Page.navigate", { url: URL_ }, sessionId);
await wait(3200); await ev(`LP.devPro(true)`); await wait(900);

// Right-click ONE record three times and read the item each time. Three, not
// two, because a flip is only visible as a flip across an odd number.
const nestReads = async (title) => {
  const out = [], found = [];
  for (let i = 0; i < 3; i++) {
    found.push(await ev(`(function(){
      var tiles = document.querySelectorAll("#groups .shortcuts-grid .shortcut");
      for (var i = 0; i < tiles.length; i++) {
        if ((tiles[i].textContent || "").indexOf(${JSON.stringify(title)}) !== -1) {
          var r = tiles[i].getBoundingClientRect();
          tiles[i].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
            clientX: Math.round(r.left + r.width / 2), clientY: Math.round(r.top + r.height / 2) }));
          return "ok";
        }
      } return "not found";})()`));
    await wait(450);
    // The MENU must actually be open, or the class being read is last time's.
    out.push(await ev(`(function(){
      var m = document.querySelector("#shortcut-menu");
      if (!m || m.classList.contains("hidden")) return "menu-closed";
      var n = document.querySelector("#menu-nest-with");
      return n ? !n.classList.contains("hidden") : null;})()`));
    await ev(`(function(){document.body.click();})()`); await wait(300);
  }
  return { out, found };
};
const recHasVariants = (title) => ev(`(async () => {
  var d = await Storage.getAll(); var ws = Storage.getActiveWorkspace(d);
  for (var i = 0; i < (ws.groups || []).length; i++) {
    var s = (ws.groups[i].shortcuts || []).find(function (x) {
      return ((x.title || "") + "").indexOf(${JSON.stringify(title)}) !== -1; });
    if (s) return !!(s.variants && s.variants.length > 0);
  } return null; })()`);

for (const title of ["RC no-variants", "RC has-variants"]) {
  const { out: seen, found } = await nestReads(title);
  const truth = await recHasVariants(title);
  const drivable = found.every((f) => f === "ok") && seen.every((v) => typeof v === "boolean");
  chk(`nest-with [${title}]: the tile is there and the menu opens all three times`,
    drivable === true, `found=${JSON.stringify(found)} read=${JSON.stringify(seen)}`);
  const stable = drivable && seen.every((v) => v === seen[0]);
  chk(`nest-with [${title}]: IDENTICAL across three right-clicks`, stable === true,
    `shown = ${JSON.stringify(seen)}`);
  chk(`nest-with [${title}]: shown IFF the record has no variants`,
    stable && seen[0] === (truth === false),
    `shown=${seen[0]} recordHasVariants=${truth}`);
}

console.log("\n  " + pass + " passed, " + fail + " failed" +
  (known ? ", " + known + " known-open" : "") + "\n");
try { await cdp.send("Browser.close"); } catch (e) {}
await wait(500);
try { process.kill(proc.pid); } catch (e) {}
process.exit(fail === 0 ? 0 : 1);
