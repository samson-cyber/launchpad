#!/usr/bin/env node
// ===========================================================================
// [MC7] A LABEL MUST TARGET ITS OWN CONTROL.
//
// WHY THIS EXISTS. A <label> with no for= hands every click to its FIRST
// labelable descendant - and a <button> is labelable. 4cb7420 (2026-09-19)
// put an info button ahead of the checkbox in seven Settings rows, so a click
// on the switch, or on its words, "clicked" the info button and the switch
// never moved: site tracking, the focus chain, notifications, the commitment
// sentence, reminders and combined analytics, dead to the mouse on master for
// seven weeks. Found by MC7's live check when its new row inherited the same
// shape. No gate saw it, because every earlier harness toggled with
// input.click(), which never goes through the label (BUGS I11's lesson again:
// drive the real control).
//
// WHAT IT HOLDS, over newtab.html:
//   - every <label> that contains a <button> names its control with for=
//   - that for= is the id of an input/select/textarea INSIDE the same label
//   - the seven rows found broken all carry it
//
// Exit codes: 0 pass · 1 failures · 2 too few rows. `--mutate` re-runs
// against seeded reversions; `--boot-check` is what check-mutation-boot runs.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clean = fs.readFileSync(path.join(repoRoot, "newtab.html"), "utf8").replace(/\r\n/g, "\n");
const FOUND = ["pomo-chain-toggle", "pomo-notifications-toggle", "focus-commitment-toggle", "settings-track-sites",
  "due-reminders-toggle", "due-sound-toggle", "due-voice-toggle", "pro-analytics-toggle"];

function suite(html) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  const labels = [...html.matchAll(/<label([^>]*)>([\s\S]*?)<\/label>/g)].map((m) => ({ attrs: m[1], body: m[2], line: html.slice(0, m.index).split("\n").length }));
  const withButton = labels.filter((l) => /<button\b/.test(l.body));
  chk("labels holding a button were found to check", withButton.length >= FOUND.length, String(withButton.length));
  for (const l of withButton) {
    const f = /\bfor="([^"]+)"/.exec(l.attrs);
    const inside = f && new RegExp("<(?:input|select|textarea)\\b[^>]*\\bid=\"" + f[1].replace(/[-]/g, "\\-") + "\"").test(l.body);
    chk(`newtab.html:${l.line} the label with a button targets its own control (for=${f ? f[1] : "none"})`, !!inside, l.body.slice(0, 120));
  }
  for (const id of FOUND) chk(`the row found broken targets #${id}`, new RegExp("<label for=\"" + id + "\"").test(html));
  return rows;
}

const SEEDS = [
  ["a row loses its for=", '<label for="settings-track-sites"', "<label"],
  ["a for= points outside its label", '<label for="due-sound-toggle"', '<label for="due-reminders-toggle"'],
];

if (args.includes("--boot-check")) { console.log("BOOT-CHECK OK   check-label-targets.mjs"); process.exit(0); }
console.log("\nLABEL TARGETS — a label with a button inside names its own control\n");
const rows = suite(clean);
if (rows.length < 15) { console.error(`GATE BROKEN — produced ${rows.length} rows, floor is 15.`); process.exit(2); }
let failed = 0;
for (const r of rows) if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
console.log(`LABEL TARGETS: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);
if (!MUTATE) process.exit(failed === 0 ? 0 : 1);
if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }
console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl] of SEEDS) {
  const n = clean.split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  const red = suite(clean.split(find).join(repl)).filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else console.log(`  killed   ${name}\n           by: ${red[0].name.slice(0, 92)}`);
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
