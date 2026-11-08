// Record one take of the five product shots, each through real controls, in a
// fresh scratch profile on the packaged build. Writes frames + pointer log per
// shot under <out>/<shot>/ and a take.json summary.
//   node --experimental-websocket record.mjs <repo> <pkg> <out> <port>
import fs from "node:fs";
import path from "node:path";
import { launch, seed, recorder, centre, sleep } from "./lib.mjs";
const [REPO, EXT, OUT, PORTS] = process.argv.slice(2);
const PORT = Number(PORTS);
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ repo: REPO, ext: EXT, port: PORT, profile: path.join(REPO, `.scratch-profile-footage-${PORT}`) });
const summary = {};
const dismissTips = (tab) => tab.ev(`(() => { let n = 0; for (const e of document.querySelectorAll('button')) { if (/^got it$/i.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0) { e.click(); n++; } } return n; })()`);
const tabTo = async (tab, name, wait = 2000) => { await tab.ev(`document.querySelector('[data-tab="${name}"]').click()`); await sleep(wait); await dismissTips(tab); await sleep(300); };
const rowCtl = (tab, taskText, sel) => tab.ev(`(() => { const r = [...document.querySelectorAll('#tab-tasks .tt-task-row')].find(r => r.textContent.includes(${JSON.stringify(taskText)})); if (!r) return null; const e = r.querySelector(${JSON.stringify(sel)}); if (!e) return null; const q = e.getBoundingClientRect(); return { x: Math.round(q.left + q.width/2), y: Math.round(q.top + q.height/2) }; })()`);
try {
  const tab = await b.open(`chrome-extension://${b.id}/newtab.html`);
  await seed(tab, REPO);
  const rec = recorder(tab);

  // ---- 1 home: hover along the Daily group, drag Notion past Slack, Open All
  await tabTo(tab, "home", 1500);
  await tab.ev(`(() => { const p = document.getElementById('sidebar-panel'); if (p) p.innerHTML = ''; return 1; })()`);
  const tiles = await tab.ev(`Object.fromEntries([...document.querySelectorAll('#tab-home .shortcut')].slice(0, 5).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim(), { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2 - 12) }]; }))`);
  const openAll = await centre(tab, "#tab-home .group-open-all-btn");
  await rec.start(1180, 760);
  await rec.hold(500);
  await rec.moveTo(tiles.Gmail.x, tiles.Gmail.y, 900);
  await rec.moveTo(tiles.Notion.x, tiles.Notion.y, 900);
  await rec.hold(250);
  // Native HTML5 drag (Sortable, forceFallback off): intercept the drag the
  // press-and-move starts, then deliver real drag events along the path.
  let dragData = null;
  tab.on((d) => { if (d.method === "Input.dragIntercepted") dragData = d.params.data; });
  await tab.send("Input.setInterceptDrags", { enabled: true });
  await rec.press();
  await rec.moveTo(tiles.Notion.x + 12, tiles.Notion.y + 4, 120, true);
  await sleep(150);
  let dragged = false;
  if (dragData) {
    const sx = tiles.Notion.x + 12, sy = tiles.Notion.y + 4, tx = tiles.Slack.x + 40, ty = tiles.Slack.y;
    await tab.send("Input.dispatchDragEvent", { type: "dragEnter", x: sx, y: sy, data: dragData });
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      const u = i / steps, e = u < 0.5 ? 4*u*u*u : 1 - Math.pow(-2*u + 2, 3) / 2;
      const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e;
      await tab.send("Input.dispatchDragEvent", { type: "dragOver", x, y, data: dragData });
      await rec.moveTo(x, y, 16, true);
    }
    await rec.hold(200);
    await tab.send("Input.dispatchDragEvent", { type: "drop", x: tx, y: ty, data: dragData });
    dragged = true;
  }
  await rec.release();
  await tab.send("Input.setInterceptDrags", { enabled: false });
  const order = await tab.ev(`[...document.querySelectorAll('#tab-home .shortcuts-grid')].at(0) ? [...[...document.querySelectorAll('#tab-home .shortcuts-grid')].at(0).querySelectorAll('.shortcut')].map(e => e.textContent.trim()) : []`);
  await rec.hold(500);
  await rec.moveTo(openAll.x, openAll.y, 900);
  await rec.hold(300);
  await rec.click();
  await rec.hold(1200);
  summary.home = { ...(await rec.stop(path.join(OUT, "1-home"))), dragged, orderAfter: order };
  // Close the tabs Open All opened; keep the new tab.
  for (const t of await b.j("/json/list")) if (t.type === "page" && t.id !== tab.targetId) await b.j(`/json/close/${t.id}`).catch(() => {});
  await tab.send("Page.bringToFront");

  // ---- 2 tasks: tick "Circulate for comment"
  await tabTo(tab, "tasks", 2200);
  await tab.ev(`(() => { const col = [...document.querySelectorAll('#tab-tasks *')].find(el => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 8 && el.querySelector('.note-card, .note, [data-note-id]')); if (!col) return 0; const g = col.querySelector('.note-ghost, .notes-ghost, [data-note-ghost], .note-new'); col.scrollTop = g ? g.getBoundingClientRect().height + 14 : 0; return col.scrollTop; })()`);
  await sleep(500);
  const cb = await rowCtl(tab, "Circulate for comment", ".tt-task-check");
  await rec.start(1000, 300);
  await rec.hold(600);
  await rec.moveTo(cb.x, cb.y, 1100);
  await rec.hold(300);
  await rec.click();
  await rec.hold(2200);
  const ticked = await tab.ev(`(() => { const r = [...document.querySelectorAll('#tab-tasks .tt-task-row, #tab-tasks [data-task-id]')].find(r => r.textContent.includes('Circulate for comment')); const c = r && r.querySelector('.tt-task-check'); return !!(c && (c.checked || c.getAttribute('aria-checked') === 'true' || r.className.includes('done'))); })()`);
  summary.tasks = { ...(await rec.stop(path.join(OUT, "2-tasks"))), ticked };

  // ---- 3 focus: start the task, then the Dashboard's ring counting down
  await sleep(600);
  const play = await rowCtl(tab, "Wireframe the shortened flow", ".tt-task-play");
  const dashTab = await centre(tab, '#tab-bar [data-tab="dashboard"]');
  await rec.start(900, 640);
  await rec.hold(500);
  await rec.moveTo(play.x, play.y, 1000);
  await rec.hold(250);
  await rec.click();
  await rec.hold(1800);
  await rec.moveTo(dashTab.x, dashTab.y, 1000);
  await rec.hold(200);
  await rec.click();
  await rec.hold(500);
  await dismissTips(tab);
  await rec.moveTo(1500, 760, 900);
  await rec.hold(3200);
  const running = await tab.ev(`(async () => { const d = await Storage.getAll(); return { focusArmed: d.focusArmed === true, active: !!d.activeTask }; })()`);
  summary.focus = { ...(await rec.stop(path.join(OUT, "3-focus"))), running };

  // ---- 4 gate: a blocked site, opened for real, lands on the reminder page
  const g = await b.open("about:blank");
  const grec = recorder(g);
  await grec.start(960, 900);
  await grec.hold(400);
  await g.send("Page.navigate", { url: "https://news.ycombinator.com/" });
  await sleep(2500);
  await grec.hold(2500);
  const gateUrl = await g.ev("location.href");
  summary.gate = { ...(await grec.stop(path.join(OUT, "4-gate"))), landedOn: gateUrl.replace(/^chrome-extension:\/\/[^/]+/, "ext:").slice(0, 80) };
  await b.j(`/json/close/${g.targetId}`).catch(() => {});
  await tab.send("Page.bringToFront");

  // ---- 5 insights: pick Past 7 days, then ease down to the tag and site tiles
  await tabTo(tab, "insights", 2600);
  await tab.ev(`(() => { const s = document.getElementById('tab-insights'); if (s) s.scrollTop = 0; const b = document.querySelector('[data-ins-range="30"]'); if (b) b.click(); return 1; })()`);
  await sleep(1500);
  const r7 = await centre(tab, '[data-ins-range="7"]');
  await rec.start(1300, 520);
  await rec.hold(500);
  await rec.moveTo(r7.x, r7.y, 1000);
  await rec.hold(250);
  await rec.click();
  await rec.hold(1600);
  await rec.moveTo(960, 640, 800);
  await rec.wheel(210, 1400);
  await rec.hold(2600);
  const seg = await tab.ev(`(document.querySelector('#tab-insights .seg-btn.active') || {}).textContent`);
  summary.insights = { ...(await rec.stop(path.join(OUT, "5-insights"))), segment: seg && seg.trim() };

  summary.consoleErrors = tab.errors;
  fs.writeFileSync(path.join(OUT, "take.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
} finally { await b.close(); }
process.exit(0);
