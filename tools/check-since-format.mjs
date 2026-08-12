#!/usr/bin/env node
// Suite for the [1.2.3] pill "Active since …" line.
//
// WHY THIS FILE EXISTS: the pill's ACTIVE counter was deleted because it could
// read 139:52:01 and still be "correct". Its replacement is a timestamp whose
// entire job is to stay honest at any age — which rests on ONE branch (is the
// activation today?) and one fallback (no usable stamp renders nothing rather
// than an empty row). That branch is worth a committed gate, per BUGS.md P5.
//
// It extracts the SHIPPED function bodies out of newtab.js and runs them, so it
// exercises the real code rather than a copy that can drift. newtab.js is a
// single browser IIFE with no export surface, so text extraction is the only
// way in; the extraction itself is guarded (exit 2) so "the function was renamed"
// can never masquerade as "the assertions passed".
//
// Usage: node tools/check-since-format.mjs [repoRoot]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2] || process.cwd();

let SRC;
try {
  // core.autocrlf=true -> newtab.js is CRLF in the working tree. Normalize
  // before slicing, or every anchor below silently misses (BUGS.md M).
  SRC = fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8").replace(/\r\n/g, "\n");
} catch (e) {
  console.error(`SINCE FORMAT: SUBJECT DID NOT LOAD — cannot read newtab.js (${e.message})`);
  process.exit(2);
}

function extract(name) {
  const start = SRC.indexOf(`  function ${name}(`);
  if (start === -1) throw new Error(`function ${name}() not found in newtab.js`);
  const end = SRC.indexOf("\n  }\n", start);
  if (end === -1) throw new Error(`could not find the end of ${name}()`);
  return SRC.slice(start, end + 4);
}

// Build the subject: the real fmtShortDate + satActiveSinceText, with the two
// globals they close over (Storage, data) injected. `mutate` exists for the
// negative control at the end — a suite that cannot be made to fail is not a
// suite (BUGS.md P2/Q1).
function subject({ activeTask, mutate }) {
  // [2.0] The line now LEADS with the activation stopwatch ("Active 12:04 ·
  // since 5:03 PM"), so its helpers come with it. satActiveElapsedMs reads the
  // same fake Storage.getActiveTask this factory already injects, so the count
  // is driven by the fixture's own startedAt — the very thing the date
  // assertions below vary. The date rules themselves are unchanged; only the
  // prefix they sit behind moved, and the patterns were updated to match rather
  // than loosened.
  let body = extract("fmtShortDate") + "\n" + extract("satFmtLong") + "\n" +
    extract("satFmtStopwatch") + "\n" + extract("satActiveElapsedMs") + "\n" +
    extract("satActiveSinceText");
  if (mutate) {
    const before = body;
    body = mutate(body);
    if (body === before) throw new Error("negative control did not apply — the anchor it patches has moved");
  }
  const factory = new Function("Storage", "data", body + "\n  return satActiveSinceText;");
  return factory({ getActiveTask: () => activeTask }, {});
}

let loaded;
try {
  loaded = subject({ activeTask: { startedAt: Date.now() } })();
  if (typeof loaded !== "string") throw new Error("satActiveSinceText did not return a string");
} catch (e) {
  console.error(`SINCE FORMAT: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

const rows = [];
const check = (name, pass, detail) => rows.push({ name, pass: !!pass, detail });
const run = (startedAt) => subject({ activeTask: { startedAt } })();

const now = new Date();
const at = (dayOffset, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, h, m, 0).getTime();
const localMidnight = at(0, 0, 0);

// --- today: the date is DROPPED (a bare time is unambiguous) -----------------
{
  const out = run(at(0, 12, 34));
  check("today -> no date component", /^Active .+ · since [^,]+$/.test(out), out);
  check("today -> carries an h:mm time", /\d{1,2}:\d{2}/.test(out), out);
}

// --- older: the date is SHOWN (a bare time would read as this morning) -------
{
  const ts = at(-7, 9, 4);
  const out = run(ts);
  check("7 days ago -> date shown", /^Active .+ · since .+, .+$/.test(out), out);
  const expected = new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  check("the date is fmtShortDate's own output", out.includes(expected), `want "${expected}" in "${out}"`);
}
{
  const out = run(at(-1, 23, 0));
  check("yesterday -> date shown (not just 'older than a day')", /^Active .+ · since .+, .+$/.test(out), out);
}

// --- the boundary itself: local midnight, to the millisecond -----------------
{
  const onIt = run(localMidnight);
  const justBefore = run(localMidnight - 1);
  check("local midnight today -> still today, no date", /^Active .+ · since [^,]+$/.test(onIt), onIt);
  check("1ms before local midnight -> yesterday, date shown", /^Active .+ · since .+, .+$/.test(justBefore), justBefore);
  check("the two sides of the boundary differ", onIt !== justBefore, `${onIt} | ${justBefore}`);
}

// --- same day-of-year, different year: the year must participate ------------
{
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 9, 4, 0).getTime();
  check("same month+day one year ago -> date shown", /^Active .+ · since .+, .+$/.test(run(lastYear)), run(lastYear));
}

// --- [2.0] the stopwatch prefix: the count is real, and it is not the date ---
// The date rules above all pass through the new prefix, but none of them would
// notice if the count itself vanished or read 0:00 forever, so it gets its own
// rows. The count derives from the SAME startedAt the date branch reads, which
// is what makes "Active 7d 8h · since Aug 5, 9:04 am" internally consistent.
{
  check("the line LEADS with the count, then the timestamp", /^Active \S+ · since /.test(run(Date.now() - 5 * 60000)),
    run(Date.now() - 5 * 60000));
  check("a five-minute-old activation counts about five minutes",
    /^Active 5:0\d · since /.test(run(Date.now() - 5 * 60000)), run(Date.now() - 5 * 60000));
  check("a multi-day activation uses the day form rather than a 3-digit hour count",
    /^Active 7d \d+h · since /.test(run(at(-7, 9, 4))), run(at(-7, 9, 4)));
  check("the count is not frozen at zero", !/^Active 0:00 · /.test(run(Date.now() - 90 * 1000)), run(Date.now() - 90 * 1000));
}

// --- degenerate records render NOTHING, so no empty row is left behind ------
check("no startedAt -> empty string", subject({ activeTask: {} })() === "");
check("startedAt = 0 -> empty string", run(0) === "");
check("startedAt is a string -> empty string", run("2026-08-02") === "");
check("startedAt is NaN -> empty string", run(NaN) === "");
check("no active task -> empty string", subject({ activeTask: null })() === "");

// --- negative control: prove the today/older branch is actually observed -----
{
  let mutantOut = null, applied = true;
  try {
    mutantOut = subject({
      activeTask: { startedAt: at(-7, 9, 4) },
      mutate: (b) => b.replace(
        "var isToday = d.getFullYear() === now.getFullYear() &&",
        "var isToday = true || d.getFullYear() === now.getFullYear() &&"),
    })();
  } catch (e) { applied = false; }
  check("NEGATIVE CONTROL: an always-today mutant drops the date (assertions are live)",
    applied && /^Active .+ · since [^,]+$/.test(mutantOut || ""), applied ? String(mutantOut) : "control failed to apply");
}

let pass = 0, fail = 0;
console.log("\nSINCE FORMAT — the pill's 'Active since' line\n");
for (const r of rows) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
  r.pass ? pass++ : fail++;
}
// Anti-vacuity floor: a suite that silently stops asserting is a green light
// that checks nothing (the check-panel-ink.mjs lesson, BUGS.md P2).
const MIN = 18;
if (rows.length < MIN) {
  console.log(`\nSINCE FORMAT: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
console.log(`\nSINCE FORMAT: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
