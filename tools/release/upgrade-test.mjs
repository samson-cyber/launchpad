// UPGRADE TEST: what a real 2.0.0 user meets when the next build arrives.
// Each scenario: install the 2.0.0 artifact into a profile, use it, close the
// browser GRACEFULLY (I9: a hard kill drops unflushed storage), swap the files
// at the SAME load path (same extension id, the way an update lands), reopen,
// and compare every stored key before and after. Plus a control: a brand-new
// install of the new build must get the photograph, proving the detection
// this test leans on can tell the two apart.
//   node --experimental-websocket upgrade-test.mjs <repo> <pkg-old> <pkg-new> <work-dir>
import fs from "node:fs";
import path from "node:path";
import { launch, sleep, connect } from "../promo/lib.mjs";
const [REPO, OLD, NEW, WORK] = process.argv.slice(2);
fs.mkdirSync(WORK, { recursive: true });
const report = { scenarios: {}, failures: [] };
const fail = (sc, m) => { report.failures.push(`${sc}: ${m}`); };
const swapIn = (src, dst) => { fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true }); };
const snapshot = (tab) => tab.ev(`chrome.storage.local.get(null).then(x => JSON.parse(JSON.stringify(x)))`);
const shot = async (tab, file) => { const s = await tab.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(WORK, file), Buffer.from(s.result.data, "base64")); };
const counts = (st) => {
  const d = st.data || {}, ws = d.workspaces || [];
  const all = (k) => ws.flatMap((w) => (w[k] || []));
  const ids = (k) => all(k).map((x) => x && x.id).filter(Boolean).sort();
  return {
    workspaces: ws.map((w) => w.id).sort(),
    groups: ws.flatMap((w) => (w.groups || []).map((g) => g.id)).sort(),
    shortcuts: ws.flatMap((w) => (w.groups || []).flatMap((g) => (g.shortcuts || []).map((s) => s.id || s.url))).sort(),
    tasks: ids("tasks"), goals: ids("goals"), tags: ids("tags"), notes: ids("notes"), namedSessions: ids("namedSessions"),
    tagColors: Object.fromEntries(all("tags").map((t) => [t.id, t.color])),
    trackingKeys: Object.keys(st).filter((k) => /track/i.test(k)).sort(),
  };
};
const pageState = (tab) => tab.ev(`(() => { const cs = getComputedStyle(document.body); return {
  version: chrome.runtime.getManifest().version, bgImage: cs.backgroundImage.slice(0, 120), bgColor: cs.backgroundColor,
  htmlClass: document.documentElement.className,
  welcome: !!document.querySelector('.fr-strip, .welcome-strip, [data-first-run], .onboarding, #onboarding, .ob-strip, .fr-examples'),
  overlays: [...document.querySelectorAll('[class*="first-run"], [class*="onboard"], [class*="coach"], [class*="tour"]')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.className.toString().slice(0, 50)).slice(0, 6),
  shortcutsOnScreen: document.querySelectorAll('#tab-home .shortcut').length }; })()`);

async function phase(name, ext, profile, port, fn) {
  const b = await launch({ repo: REPO, ext, port, profile, dpr: 1, keepProfile: true });
  try {
    const tab = await b.open(`chrome-extension://${b.id}/newtab.html`);
    await sleep(3500);
    const sw = (await b.j("/json/list")).find((t) => t.type === "service_worker" && t.url.includes(b.id));
    const swc = sw ? await connect(sw.webSocketDebuggerUrl) : null;
    const out = await fn(tab, b);
    out.extId = b.id;
    out.pageErrors = tab.errors.filter((e) => !/favicon|Failed to load resource|net::ERR/i.test(e));
    out.swErrors = swc ? swc.errors : ["(service worker target not found)"];
    await tab.send("Browser.close").catch(() => {});
    await sleep(2500);
    return out;
  } finally { await b.close(); }
}

const OLDV = JSON.parse(fs.readFileSync(path.join(OLD, "manifest.json"))).version, NEWV = JSON.parse(fs.readFileSync(path.join(NEW, "manifest.json"))).version;
report.from = OLDV; report.to = NEWV;

// ---- A: a PLAIN user. Installs 2.0.0, opens a few tabs, changes nothing.
// ---- B: a HEAVY user. Pro on, groups and shortcuts, tasks, goals, tags,
//         notes, a named session, an uploaded wallpaper, changed settings.
for (const sc of ["A-plain", "B-heavy"]) {
  const extDir = path.join(WORK, `ext-${sc}`), profile = path.join(REPO, `.scratch-profile-upgrade-${sc}`);
  fs.rmSync(profile, { recursive: true, force: true });
  swapIn(OLD, extDir);
  const port = sc === "A-plain" ? 9891 : 9892;
  const before = await phase(sc + " on " + OLDV, extDir, profile, port, async (tab) => {
    await tab.send("Page.reload", {}); await sleep(2500);
    if (sc === "B-heavy") {
      const seeded = await tab.ev(`(async () => {
        const out = { steps: [] }; const S = window.Storage;
        const step = async (n, f) => { try { await f(); out.steps.push(n + ":ok"); } catch (e) { out.steps.push(n + ":ERR " + String(e && e.message).slice(0, 80)); } };
        await step("devPro", async () => { if (window.LP && LP.devPro) await LP.devPro(true); });
        let d = await S.getAll();
        await step("tags", async () => { for (const n of ["client-a", "writing", "admin"]) { await S.createTag(d, { name: n }); d = await S.getAll(); } });
        await step("goal", async () => { await S.createGoal(d, { name: "Ship the Q3 report" }); d = await S.getAll(); });
        await step("tasks", async () => { for (const n of ["Draft the summary", "Book the studio", "Reply to review"]) { await S.createTask(d, { name: n }); d = await S.getAll(); } });
        await step("notes", async () => { if (S.createNote) { const ws = S.getActiveWorkspace(d); S.createNote(d, { content: "Renewal is annual" }); await S.saveAll(d); d = await S.getAll(); } });
        await step("session", async () => { if (S.createNamedSession) { await S.createNamedSession(d, { name: "Morning", tabs: [{ url: "https://example.com", title: "Example" }] }); d = await S.getAll(); } });
        await step("wallpaper", async () => { const c = document.createElement("canvas"); c.width = 64; c.height = 40; const g = c.getContext("2d"); g.fillStyle = "#335"; g.fillRect(0, 0, 64, 40); await S.saveBackground(c.toDataURL("image/jpeg", 0.8)); });
        await step("settings", async () => { d = await S.getAll(); d.settings = d.settings || {}; d.settings.columns = 7; await S.saveAll(d); });
        return out; })()`, 60000);
      await tab.send("Page.reload", {}); await sleep(3000);
      return { seeded, page: await pageState(tab), store: await snapshot(tab), shot: await shot(tab, `${sc}-before.png`) };
    }
    // plain: open a couple more new tabs, the way a real user would
    for (let i = 0; i < 2; i++) { await tab.send("Page.reload", {}); await sleep(1500); }
    return { page: await pageState(tab), store: await snapshot(tab), shot: await shot(tab, `${sc}-before.png`) };
  });
  swapIn(NEW, extDir);
  const after = await phase(sc + " on " + NEWV, extDir, profile, port, async (tab) => {
    const p = await pageState(tab);
    await shot(tab, `${sc}-after-home.png`);
    const tabs = {};
    for (const t of ["tasks", "dashboard", "insights"]) {
      const ok = await tab.ev(`(() => { const b = document.querySelector('[data-tab="${t}"]'); if (!b) return false; b.click(); return true; })()`);
      await sleep(1800); tabs[t] = ok; await shot(tab, `${sc}-after-${t}.png`);
    }
    return { page: p, tabs, store: await snapshot(tab) };
  });
  fs.rmSync(profile, { recursive: true, force: true });
  const c0 = counts(before.store), c1 = counts(after.store);
  const keys0 = Object.keys(before.store).sort(), keys1 = Object.keys(after.store).sort();
  const lost = {};
  for (const k of ["workspaces", "groups", "shortcuts", "tasks", "goals", "tags", "notes", "namedSessions"]) {
    const gone = c0[k].filter((x) => !c1[k].includes(x)); if (gone.length) lost[k] = gone;
  }
  const tagColorChanged = Object.entries(c0.tagColors).filter(([id, col]) => c1.tagColors[id] !== col);
  const s = {
    from: before.page.version, to: after.page.version, sameExtensionId: before.extId === after.extId,
    seeded: before.seeded, countsBefore: Object.fromEntries(Object.entries(c0).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])),
    countsAfter: Object.fromEntries(Object.entries(c1).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])),
    lost, tagColorChanged, keysAdded: keys1.filter((k) => !keys0.includes(k)), keysRemoved: keys0.filter((k) => !keys1.includes(k)),
    backgroundBefore: String(JSON.stringify(before.store.launchpad_background)).slice(0, 140), backgroundAfter: String(JSON.stringify(after.store.launchpad_background)).slice(0, 140),
    onboardingLatchBefore: before.store.launchpad_onboarding === undefined ? "(absent)" : JSON.stringify(before.store.launchpad_onboarding).slice(0, 80),
    pageBefore: before.page, pageAfter: after.page, tabsAfter: after.tabs,
    settingsColumnsAfter: after.store.data && after.store.data.settings && after.store.data.settings.columns,
    errors: { before: [...before.pageErrors, ...before.swErrors], after: [...after.pageErrors, ...after.swErrors] },
  };
  report.scenarios[sc] = s;
  if (!s.sameExtensionId) fail(sc, "extension id changed across the update");
  if (s.to !== NEWV) fail(sc, `new build did not load (version ${s.to})`);
  if (Object.keys(lost).length) fail(sc, "records lost: " + JSON.stringify(lost));
  if (tagColorChanged.length) fail(sc, "existing tag colours changed: " + JSON.stringify(tagColorChanged));
  if (s.keysRemoved.length) fail(sc, "storage keys removed: " + s.keysRemoved.join(","));
  if (/default\.webp/.test(s.backgroundAfter) || /default\.webp/.test(after.page.bgImage)) fail(sc, "an EXISTING user was given the fresh-install photograph");
  if (sc === "B-heavy" && !/data:image/.test(s.backgroundAfter)) fail(sc, "the user's own wallpaper was not kept");
  if (sc === "B-heavy" && s.settingsColumnsAfter !== 7) fail(sc, `a changed setting was not kept (columns ${s.settingsColumnsAfter})`);
  if (s.errors.after.length) fail(sc, "console errors after the update: " + s.errors.after.slice(0, 3).join(" | "));
  for (const [t, ok] of Object.entries(after.tabs)) if (!ok) fail(sc, `tab ${t} missing after update`);
}

// ---- C: CONTROL. A brand-new install of the new build gets the photograph.
{
  const extDir = path.join(WORK, "ext-C-fresh"), profile = path.join(REPO, ".scratch-profile-upgrade-C");
  fs.rmSync(profile, { recursive: true, force: true }); swapIn(NEW, extDir);
  const fresh = await phase("C fresh " + NEWV, extDir, profile, 9893, async (tab) => ({ page: await pageState(tab), store: await snapshot(tab), shot: await shot(tab, "C-fresh-home.png") }));
  fs.rmSync(profile, { recursive: true, force: true });
  const bg = String(JSON.stringify(fresh.store.launchpad_background)).slice(0, 140);
  report.scenarios["C-fresh-control"] = { version: fresh.page.version, background: bg, bgImage: fresh.page.bgImage, errors: [...fresh.pageErrors, ...fresh.swErrors] };
  if (!/default\.webp/.test(bg + fresh.page.bgImage)) fail("C-fresh-control", "a FRESH install did not get the photograph - the control cannot tell the cases apart");
}
report.ok = report.failures.length === 0;
fs.writeFileSync(path.join(WORK, "upgrade-report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(report.ok ? 0 : 1);
