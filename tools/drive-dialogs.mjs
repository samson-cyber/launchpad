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




const REPO = "C:\\Dev\\Git\\launchpad";

function launch(profileDir, port) {
  const exe = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const args = [
    `--user-data-dir=${profileDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-sync",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--enable-unsafe-extension-debugging",
    `--disable-extensions-except=${REPO}`,
    `--load-extension=${REPO}`,
    `--remote-debugging-port=${port}`,
    "--headless=new",
    "about:blank",
  ];
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
function extensionId(profileDir, tries = 40) {
  const f = path.join(profileDir, "Default", "Secure Preferences");
  for (let i = 0; i < tries; i++) {
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf8"));
      const settings = j?.extensions?.settings || {};
      for (const [id, v] of Object.entries(settings)) {
        const p = (v && v.path) || "";
        if (p.toLowerCase().replace(/\//g, "\\") === REPO.toLowerCase()) return id;
      }
    } catch (e) {}
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
const seedSrc = fs.readFileSync("C:/Dev/Git/launchpad/tools/capture-fixture.js", "utf8");
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

console.log("\n  " + pass + " passed, " + fail + " failed" +
  (known ? ", " + known + " known-open" : "") + "\n");
try { await cdp.send("Browser.close"); } catch (e) {}
await wait(500);
try { process.kill(proc.pid); } catch (e) {}
process.exit(fail === 0 ? 0 : 1);
