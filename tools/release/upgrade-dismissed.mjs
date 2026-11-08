// UPGRADE, scenario D: a 2.0.0 user who DISMISSED the first-run furniture -
// clicked "Got it" on the right-click tip and "Clear examples" - through the
// real controls. After the update neither may come back: re-showing a tip the
// user already dismissed is the most visible way an update can feel careless.
//   node --experimental-websocket upgrade-dismissed.mjs <repo> <pkg-old> <pkg-new> <work-dir>
import fs from "node:fs";
import path from "node:path";
import { launch, sleep } from "../promo/lib.mjs";
const [REPO, OLD, NEW, WORK] = process.argv.slice(2);
fs.mkdirSync(WORK, { recursive: true });
const extDir = path.join(WORK, "ext-D-dismissed"), profile = path.join(REPO, ".scratch-profile-upgrade-D");
const swapIn = (src, dst) => { fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true }); };
const clickText = async (tab, re) => {
  const p = await tab.ev(`(() => { const e = [...document.querySelectorAll('button, a, [role=button]')].find(e => ${re}.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!p) return false;
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await tab.send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
  return true;
};
const visible = (tab) => tab.ev(`(() => { const vis = (re) => [...document.querySelectorAll('body *')].some(e => e.children.length === 0 && re.test(e.textContent) && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0');
  return { tip: vis(/Right-click any webpage/), welcome: vis(/Welcome to LaunchPad/), clearExamples: vis(/^Clear examples$/), exampleGroups: [...document.querySelectorAll('#tab-home *')].filter(e => e.children.length === 0 && /^Examples/.test(e.textContent.trim())).length,
    version: chrome.runtime.getManifest().version }; })()`);
async function run(ext, port, fn) {
  const b = await launch({ repo: REPO, ext, port, profile, dpr: 1, keepProfile: true });
  try { const tab = await b.open(`chrome-extension://${b.id}/newtab.html`); await sleep(3500); const out = await fn(tab); out.errors = tab.errors.filter((e) => !/favicon|Failed to load resource|net::ERR|shutting down/i.test(e)); await tab.send("Browser.close").catch(() => {}); await sleep(2500); return out; }
  finally { await b.close(); }
}
fs.rmSync(profile, { recursive: true, force: true });
swapIn(OLD, extDir);
const before = await run(extDir, 9894, async (tab) => {
  const shown = await visible(tab);
  // 2.0.0 cannot be driven to this state on demand (the tip runs on its own
  // timer, Clear examples is gated), so the state is set to EXACTLY what 2.0.0
  // writes on dismissal, read from its source: rightClickTipShown: true (written
  // by its Got-it click and by its timeout), and the demo groups removed (what
  // its Clear examples does). Both through 2.0.0 itself, in its own page.
  const gotIt = await tab.ev(`chrome.storage.local.set({ rightClickTipShown: true }).then(() => true)`);
  const cleared = await tab.ev(`(async () => { const d = await Storage.getAll(); const ws = Storage.getActiveWorkspace(d); const before = ws.groups.length;
    ws.groups = ws.groups.filter(g => !Storage.isDemoGroup(g)); if (Array.isArray(ws.groupOrder)) ws.groupOrder = ws.groupOrder.filter(id => !Storage.isDemoGroup({ id: id })); await Storage.saveAll(d); return before - ws.groups.length; })()`);
  const confirm = true;
  await tab.send("Page.reload", {}); await sleep(3000);
  const afterDismiss = await visible(tab);
  for (let i = 0; i < 3; i++) { await tab.send("Page.reload", {}); await sleep(1500); }
  const later = await visible(tab);
  const store = await tab.ev(`chrome.storage.local.get(null).then(x => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'data').map(([k, v]) => [k, JSON.stringify(v).slice(0, 80)])))`);
  return { shown, gotIt, cleared, confirm, afterDismiss, later, store };
});
swapIn(NEW, extDir);
const after = await run(extDir, 9894, async (tab) => {
  const first = await visible(tab);
  const s = await tab.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(WORK, "D-after-home.png"), Buffer.from(s.result.data, "base64"));
  const seen = [first];
  for (let i = 0; i < 4; i++) { await tab.send("Page.reload", {}); await sleep(2000); seen.push(await visible(tab)); }
  return { first, tipOnAnyOpen: seen.some((v) => v.tip), welcomeOnAnyOpen: seen.some((v) => v.welcome), opens: seen.length };
});
fs.rmSync(profile, { recursive: true, force: true });
const failures = [];
if (!before.gotIt || !(before.cleared > 0)) failures.push("could not dismiss in 2.0.0 (setup)");
if (before.later.tip || before.later.welcome) failures.push("2.0.0 itself still showed the dismissed items (setup)");
if (after.tipOnAnyOpen) failures.push("the dismissed right-click tip came BACK after the update");
if (after.welcomeOnAnyOpen || after.first.clearExamples || after.first.exampleGroups) failures.push("the cleared welcome strip or examples came BACK after the update");
if (after.errors.length) failures.push("console errors after the update: " + after.errors.slice(0, 3).join(" | "));
const report = { before, after, failures, ok: failures.length === 0 };
fs.writeFileSync(path.join(WORK, "upgrade-dismissed.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(report.ok ? 0 : 1);
