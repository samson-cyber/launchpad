// Record one take of the five product shots CHOREOGRAPHED TO THE NARRATION:
// every action waits on an absolute cue (ms after the shot starts), taken from
// take C's measured pauses, so the drag lands on "Drag them anywhere" and the
// scroll on "by task, by tag, and by site". Same real controls, same fixture,
// same packaged build as record.mjs.
//   node --experimental-websocket record-cut.mjs <repo> <pkg> <out> <port>
import fs from "node:fs";
import path from "node:path";
import { launch, seed, recorder, centre, sleep } from "./lib.mjs";
const [REPO, EXT, OUT, PORTS] = process.argv.slice(2);
const PORT = Number(PORTS);
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ repo: REPO, ext: EXT, port: PORT, profile: path.join(REPO, `.scratch-profile-footage-${PORT}`), dpr: 1 });
const summary = {};
const dismissTips = (tab) => tab.ev(`(() => { let n = 0; for (const e of document.querySelectorAll('button')) { if (/^got it$/i.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0) { e.click(); n++; } } return n; })()`);
const tabTo = async (tab, name, wait = 2000) => { await tab.ev(`document.querySelector('[data-tab="${name}"]').click()`); await sleep(wait); await dismissTips(tab); await sleep(300); };
const rowCtl = (tab, taskText, sel) => tab.ev(`(() => { const r = [...document.querySelectorAll('#tab-tasks .tt-task-row')].find(r => r.textContent.includes(${JSON.stringify(taskText)})); if (!r) return null; const e = r.querySelector(${JSON.stringify(sel)}); if (!e) return null; const q = e.getBoundingClientRect(); return { x: Math.round(q.left + q.width/2), y: Math.round(q.top + q.height/2) }; })()`);
try {
  const tab = await b.open(`chrome-extension://${b.id}/newtab.html`);
  await seed(tab, REPO);
  const rec = recorder(tab);

  // [cut] recorded FIRST: Open All in the Home shot loads five real sites, and the
  // tracker logged their first seconds as an "Untagged <1%" row in Insights.
  // ---- F insights, 6.9 s: Past 7 days at 1.3 s, ease down on "by task, by tag, and by site" (scroll 3.7-4.6 s)
  await tabTo(tab, "insights", 2600);
  await tab.ev(`(() => { const s = document.getElementById('tab-insights'); if (s) s.scrollTop = 0; const b = document.querySelector('[data-ins-range="30"]'); if (b) b.click(); return 1; })()`);
  await sleep(1500);
  const r7 = await centre(tab, '[data-ins-range="7"]');
  await rec.start(1300, 520);
  await rec.at(250); await rec.moveTo(r7.x, r7.y, 900);
  await rec.at(1300); await rec.click();
  await rec.at(3150); await rec.moveTo(960, 640, 500);
  await rec.at(3700); await rec.wheel(130, 900);
  const scrollEnd = rec.now();
  await rec.at(7300);
  const seg = await tab.ev(`(document.querySelector('#tab-insights .seg-btn.active') || {}).textContent`);
  summary.insights = { ...(await rec.stop(path.join(OUT, "5-insights"))), segment: seg && seg.trim(), scrollEndMs: scrollEnd };

  // ---- B home, 7.8 s: hover the group, drag Notion past Slack on "Drag them anywhere" (2.46 s), Open All on "one click" (~5.0 s)
  await tabTo(tab, "home", 1500);
  await tab.ev(`(() => { const p = document.getElementById('sidebar-panel'); if (p) p.innerHTML = ''; return 1; })()`);
  const tiles = await tab.ev(`Object.fromEntries([...document.querySelectorAll('#tab-home .shortcut')].slice(0, 5).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim(), { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2 - 12) }]; }))`);
  const openAll = await centre(tab, "#tab-home .group-open-all-btn");
  await rec.start(1300, 780);
  await rec.at(300); await rec.moveTo(tiles.Gmail.x, tiles.Gmail.y, 800);
  await rec.moveTo(tiles.Drive.x, tiles.Drive.y, 650);
  await rec.moveTo(tiles.Notion.x, tiles.Notion.y, 450);
  let dragData = null;
  tab.on((d) => { if (d.method === "Input.dragIntercepted") dragData = d.params.data; });
  await tab.send("Input.setInterceptDrags", { enabled: true });
  await rec.at(2420); await rec.press();
  await rec.moveTo(tiles.Notion.x + 12, tiles.Notion.y + 4, 100, true);
  await sleep(120);
  let dragged = false;
  if (dragData) {
    const sx = tiles.Notion.x + 12, sy = tiles.Notion.y + 4, tx = tiles.Slack.x + 40, ty = tiles.Slack.y;
    await tab.send("Input.dispatchDragEvent", { type: "dragEnter", x: sx, y: sy, data: dragData });
    // Time-based like every move: 1.0 s from Notion to past Slack, a real
    // dragOver delivered at each step the pointer takes.
    await rec.moveTo(tx, ty, 1000, true, (x, y) => tab.send("Input.dispatchDragEvent", { type: "dragOver", x, y, data: dragData }));
    await rec.hold(120);
    await tab.send("Input.dispatchDragEvent", { type: "drop", x: tx, y: ty, data: dragData });
    dragged = true;
  }
  await rec.release();
  await tab.send("Input.setInterceptDrags", { enabled: false });
  const dropAt = rec.now();
  await rec.at(4000); await rec.moveTo(openAll.x, openAll.y, 750);
  await rec.at(4950); await rec.click();
  const clickAt = rec.now();
  await rec.at(8300);
  const order = await tab.ev(`[...[...document.querySelectorAll('#tab-home .shortcuts-grid')].at(0).querySelectorAll('.shortcut')].map(e => e.textContent.trim())`);
  summary.home = { ...(await rec.stop(path.join(OUT, "1-home"))), dragged, orderAfter: order, dropAtMs: dropAt, openAllClickMs: clickAt };
  for (const t of await b.j("/json/list")) if (t.type === "page" && t.id !== tab.targetId) await b.j(`/json/close/${t.id}`).catch(() => {});
  await tab.send("Page.bringToFront");

  // ---- C tasks, 4.5 s: tick "Circulate for comment" at 2.4 s
  await tabTo(tab, "tasks", 2200);
  const cb = await rowCtl(tab, "Circulate for comment", ".tt-task-check");
  await rec.start(1000, 300);
  await rec.at(300); await rec.moveTo(cb.x, cb.y, 1300);
  await rec.at(2400); await rec.click();
  const tickAt = rec.now();
  await rec.at(4900);
  const ticked = await tab.ev(`(() => { const r = [...document.querySelectorAll('#tab-tasks .tt-task-row')].find(r => r.textContent.includes('Circulate for comment')); const c = r && r.querySelector('.tt-task-check'); return !!(c && (c.checked || c.getAttribute('aria-checked') === 'true' || r.className.includes('done'))); })()`);
  summary.tasks = { ...(await rec.stop(path.join(OUT, "2-tasks"))), ticked, tickAtMs: tickAt };

  await tabTo(tab, "tasks", 2200);
  // ---- D focus, 2.3 s: Start task on "Start a focus session" (~0.95 s)
  await sleep(500);
  const play = await rowCtl(tab, "Wireframe the shortened flow", ".tt-task-play");
  await rec.start(760, 680);
  await rec.at(150); await rec.moveTo(play.x, play.y, 700);
  await rec.at(950); await rec.click();
  const startAt = rec.now();
  await rec.at(2700);
  const running = await tab.ev(`(async () => { const d = await Storage.getAll(); return { focusArmed: d.focusArmed === true, active: !!d.activeTask }; })()`);
  summary.focus = { ...(await rec.stop(path.join(OUT, "3-focus"))), running, startAtMs: startAt };

  // ---- E gate, 2.9 s: a blocked site opened for real lands on the reminder page
  const g = await b.open("about:blank");
  const grec = recorder(g);
  await grec.start(960, 900);
  await grec.at(200);
  await g.send("Page.navigate", { url: "https://news.ycombinator.com/" });
  await grec.at(3600);
  const gateUrl = await g.ev("location.href");
  summary.gate = { ...(await grec.stop(path.join(OUT, "4-gate"))), landedOn: gateUrl.replace(/^chrome-extension:\/\/[^/]+/, "ext:").slice(0, 60) };
  await b.j(`/json/close/${g.targetId}`).catch(() => {});
  await tab.send("Page.bringToFront");

  summary.consoleErrors = tab.errors;
  fs.writeFileSync(path.join(OUT, "take.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
} finally { await b.close(); }
process.exit(0);
