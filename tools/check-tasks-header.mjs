#!/usr/bin/env node
// ===========================================================================
// [MC11] THE TASKS HEADER AND ITS COUNT TILES.
//
// WHY THIS EXISTS. Samson asked for four New buttons side by side in one
// style (the old indigo New task read faded on a photograph, and a menu hid
// three of the four), and for the count tiles to do their own thing: Goals
// adds a goal, Recurring adds a repeat, Overdue takes you to the overdue tasks.
// The quiet ways this breaks: one button drifts back to the faded style, a
// tile's action is wired to the wrong dialog, "View overdue" offers to show
// nothing, or the action grows a chip the calendar's language does not have.
//
// WHAT IT HOLDS (the real builders run in a VM, plus the sheet):
//   - the header renders exactly four .tt2-newbtn.tasks-action buttons, in
//     order new-task, new-goal, new-recurring, new-tag, and no menu
//   - the tiles: Add goal and Add recurring always; View overdue only when
//     there is something overdue
//   - each data-tile-act routes to its own opener, and View overdue expands
//     the goals, leaves the Completed view, then scrolls and lights the rows
//   - the tile action has no surface, appears on hover and keyboard focus,
//     and is always visible with no hover
//
// Exit codes: 0 pass · 1 failures · 2 the subject did not load. `--mutate`
// re-runs against seeded reversions; `--boot-check` is what
// check-mutation-boot runs.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

function extractFn(src, name) {
  const at = src.indexOf("  function " + name + "(");
  if (at < 0) throw new Error("function " + name + " not found");
  let i = src.indexOf("{", at), depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
    else if (c === "'" || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } }
    else if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; }
  }
  throw new Error("unbalanced " + name);
}
function grabVar(src, name) {
  const m = new RegExp("var " + name + " = '[^\\n]*';").exec(src);
  if (!m) throw new Error(name + " not found");
  return m[0];
}
function boot(nt) {
  const code = [grabVar(nt, "TT2_PLUS_SVG"), grabVar(nt, "TT2_DOWN_SVG"), extractFn(nt, "tasksTileActHtml"), extractFn(nt, "tasksCountTilesHtml"),
    extractFn(nt, "tasksHeaderHtml"), "this.api = { tasksCountTilesHtml, tasksHeaderHtml };"].join("\n");
  const sb = {
    th: (k, p) => k + (p ? JSON.stringify(p) : ""), escapeHtml: (x) => String(x),
    taskFilterState: { status: "active", priorities: [], tagIds: [], sort: "created" },
    priorityFilterLabel: () => "Priority", tagFilterLabel: () => "Tag", tasksSelectedAttr: () => "", CHEVRON_DOWN_SVG: "<svg/>"
  };
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: "newtab.js" });
  return sb.api;
}

function suite(c) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  const api = boot(c.nt);
  const head = api.tasksHeaderHtml({ completed: 2 });
  const btns = [...head.matchAll(/<button class="([^"]*)" data-action="([^"]*)"/g)].map((m) => ({ cls: m[1], act: m[2] }));
  chk("the header renders four New buttons", btns.length === 4, JSON.stringify(btns));
  chk("...in order: task, goal, recurring, tag", btns.map((b) => b.act).join() === "new-task,new-goal,new-recurring,new-tag", JSON.stringify(btns));
  chk("...all in the one style, routed through the header handler", btns.every((b) => b.cls === "tt2-newbtn tasks-action"), JSON.stringify(btns));
  chk("...and no menu or faded action button is left", !/new-more|tt2-action|tt2-newmenu|aria-haspopup="menu"/.test(head));

  const base = { overdueOldest: "", goals: 2, goalsComplete: 1, openTasks: 4, recurring: 1, recurringNext: "" };
  const none = api.tasksCountTilesHtml({ ...base, overdue: 0 });
  const some = api.tasksCountTilesHtml({ ...base, overdue: 3, overdueOldest: "Old" });
  const acts = (h) => [...h.matchAll(/data-tile-act="([^"]+)"/g)].map((m) => m[1]);
  chk("Goals and Recurring always offer to add", acts(none).join() === "add-goal,add-recurring", JSON.stringify(acts(none)));
  chk("Overdue offers View overdue only when something is overdue", acts(some).join() === "view-overdue,add-goal,add-recurring", JSON.stringify(acts(some)));
  chk("each action is an icon and a label", /data-tile-act="add-goal"><svg[^>]*>[\s\S]*?<\/svg><span>tasks_tile_add_goal<\/span>/.test(none));

  const bind = (() => { const a = c.nt.indexOf("      // [MC11] The count tiles' own actions."); return a < 0 ? "" : c.nt.slice(a, a + 700); })();
  chk("Add goal opens the new-goal dialog", /ta === "add-goal"\) openNewGoalModal\(\);/.test(bind));
  chk("Add recurring opens the repeat dialog", /ta === "add-recurring"\) openRecurringModal\(null\);/.test(bind));
  chk("View overdue runs tasksViewOverdue", /ta === "view-overdue"\) tasksViewOverdue\(\);/.test(bind));
  const vo = (() => { const a = c.nt.indexOf("  async function tasksViewOverdue("); return a < 0 ? "" : c.nt.slice(a, c.nt.indexOf("\n  }\n", a) + 4); })();
  chk("View overdue uses the tile's own predicate (isOverdue over open tasks)", /Storage\.getActiveTasks\(ws\)\.filter\(function \(t\) \{ return isOverdue\(t\.dueAt\); \}\)/.test(vo));
  chk("...expands the goals they sit under", /Storage\.updateGoalCollapsed\(data, goals\[i\], false\)/.test(vo));
  chk("...leaves the Completed view, where overdue tasks are hidden", /if \(taskFilterState\.status === "completed"\) taskFilterState\.status = "active";/.test(vo));
  chk("...then scrolls to the oldest and lights them all", /rows\[0\]\.scrollIntoView/.test(vo) && /classList\.add\("is-bell-target"\)/.test(vo));

  const rule = (/(?:^|[\n}])\.tt2-tile-act \{([^}]*)\}/.exec(c.css) || [])[1] || "";
  chk("the tile action has no surface (transparent, no border, no shadow)", /background:\s*transparent/.test(rule) && /border:\s*0/.test(rule) && !/box-shadow/.test(rule), rule);
  chk("it appears on hover and on keyboard focus", /(?:^|[\n}])\.tt2-count:hover \.tt2-tile-act, \.tt2-count:focus-within \.tt2-tile-act \{ opacity: 1; \}/.test(c.css));
  chk("...and is always visible on a screen with no hover", /@media \(hover: none\) \{ \.tt2-tile-act \{ opacity: 1; \} \}/.test(c.css));
  chk("its fade is still under reduced motion", /@media \(prefers-reduced-motion: reduce\) \{ \.tt2-tile-act \{ transition: none; \} \}/.test(c.css));
  chk("the New buttons carry no text shadow (the blur on their words)", /(?:^|[\n}])html\.has-bg \.tasks-split \.tt2-newbtn \{ padding: 8px 14px; text-shadow: none; \}/.test(c.css));
  chk("the faded indigo button's style is gone",!/(?:^|[\n}])html\.has-bg \.tasks-split \.tt2-action \{/.test(c.css));
  return rows;
}

const SEEDS = [
  ["New task goes back to the faded style", `'<button class="tt2-newbtn tasks-action" data-action="new-task"`, `'<button class="tt2-action tasks-action" data-action="new-task"`, "nt"],
  ["New tag drops out", `            '<button class="tt2-newbtn tasks-action" data-action="new-tag" type="button">' + th('tasks_btn_new_tag') + '</button>' +\n`, "", "nt"],
  ["View overdue offered with nothing overdue", `o.overdue > 0 ? tasksTileActHtml("view-overdue"`, `o.overdue >= 0 ? tasksTileActHtml("view-overdue"`, "nt"],
  ["Add goal opens the wrong dialog", `if (ta === "add-goal") openNewGoalModal();`, `if (ta === "add-goal") openRecurringModal(null);`, "nt"],
  ["View overdue forgets collapsed goals", `      try { await Storage.updateGoalCollapsed(data, goals[i], false); } catch (err) {}\n`, "", "nt"],
  ["the action grows a chip", `  appearance: none; border: 0; background: transparent; cursor: pointer;\n  display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px;`,
   `  appearance: none; border: 0; background: rgba(17, 19, 25, 0.6); cursor: pointer;\n  display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px;`, "css"],
  ["the text shadow comes back", "{ padding: 8px 14px; text-shadow: none; }", "{ padding: 8px 14px; }", "css"],
  ["keyboard users never see it", `.tt2-count:hover .tt2-tile-act, .tt2-count:focus-within .tt2-tile-act { opacity: 1; }`, `.tt2-count:hover .tt2-tile-act { opacity: 1; }`, "css"],
];

const clean = { nt: read("newtab.js"), css: read("newtab.css") };
if (args.includes("--boot-check")) {
  try { boot(clean.nt); console.log("BOOT-CHECK OK   check-tasks-header.mjs"); process.exit(0); }
  catch (e) { console.log("BOOT-CHECK DEAD check-tasks-header.mjs — " + e.message); process.exit(1); }
}
console.log("\nTASKS HEADER — four New buttons in one style; tiles that add and show\n");
let rows;
try { rows = suite(clean); }
catch (e) { console.error("SUBJECT DID NOT LOAD — " + e.message); process.exit(2); }
const ROW_FLOOR = 19;
if (rows.length < ROW_FLOOR) { console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`); process.exit(2); }
let failed = 0;
for (const r of rows) if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
console.log(`TASKS HEADER: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);
if (!MUTATE) process.exit(failed === 0 ? 0 : 1);
if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }
console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl, file] of SEEDS) {
  const n = clean[file].split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  let mrows;
  try { mrows = suite({ ...clean, [file]: clean[file].split(find).join(repl) }); }
  catch (e) { mrows = [{ name: "subject did not load: " + e.message, ok: false }]; }
  const red = mrows.filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else console.log(`  killed   ${name}\n           by: ${red[0].name.slice(0, 92)}`);
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
