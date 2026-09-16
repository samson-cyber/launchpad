#!/usr/bin/env node
// ===========================================================================
// [TD.1] THE QUICK-ADD PARSER, IN THREE ZONES.
//
// THIS IS THE ROUND. [1.0.13] cost a round to establish that `dueAt` lives in
// UTC-MIDNIGHT-OF-THE-LOCAL-CALENDAR-DATE space, and WM.5 recorded that this
// codebase has TWO day bases that must not be merged. A parser that reads
// "tomorrow 3pm" in the user's zone and writes a due date has to get both
// right, and ONE ZONE CANNOT PROVE IT: the two ways to be wrong land a day out
// in OPPOSITE directions, so a test suite run only in London passes while a
// Sydney user's task is on the wrong day.
//
// So every case runs in three zones - one WEST of UTC, UTC itself, and one EAST
// - and every due date is asserted TWICE:
//   1. as the stored number, and
//   2. as the utcDay() getDueWork would actually read back from it,
//      compared against the day the USER'S CALENDAR shows.
// The second assertion is the contract. The first is just the encoding.
//
// PURITY IS ASSERTED, NOT ASSUMED. The parser takes `now` and `zone` as
// arguments; this file proves it by (a) calling it twice with identical
// arguments and requiring identical output, and (b) running the whole suite
// with process.env.TZ set to a FOURTH, unrelated zone, so anything reading the
// host clock's zone would show up as a difference.
//
// Exit codes: 0 pass · 1 failures · 2 the subject did not load (P5/Q1 - a
// subject that will not load must never be scored as a pass).
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// THE HOST ZONE IS DELIBERATELY SET TO SOMETHING NONE OF THE CASES USE. If any
// line of the parser reached for the system zone instead of its `zone`
// argument, Kolkata's +05:30 offset would drag a result off a whole-hour
// boundary and the three-zone table would stop agreeing with itself.
process.env.TZ = "Asia/Kolkata";

let QuickAdd;
try {
  const src = fs.readFileSync(path.join(ROOT, "quickadd.js"), "utf8");
  const ctx = { Intl, Date, Math, JSON, Object, Array, String, Number, parseInt, parseFloat, Error, console };
  ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "quickadd.js" });
  QuickAdd = ctx.QuickAdd;
  if (!QuickAdd || typeof QuickAdd.parse !== "function") throw new Error("QuickAdd.parse missing");
} catch (e) {
  console.error(`QUICK-ADD: SUBJECT DID NOT LOAD — ${e && e.message}`);
  process.exit(2);
}

const rows = [];
const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail: String(detail) });
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want),
  `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// ---- the reader's half of the contract, copied from storage.js -------------
// Deliberately a COPY rather than an import: this asserts that the parser's
// output survives the reader's arithmetic, so the reader's arithmetic has to be
// stated here independently. If storage.js's utcDay ever changes, this gate
// should go red and make someone look, not silently follow it.
const utcDay = (ts) => { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const ymd = (stamp) => { const d = new Date(stamp); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };

// What the user's own calendar says, in their zone, at `now`.
const localYmd = (ts, zone) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
  return p; // en-CA formats as YYYY-MM-DD
};

const ZONES = [
  { name: "America/Los_Angeles", side: "west of UTC" },
  { name: "Europe/London", side: "UTC" },
  { name: "Australia/Sydney", side: "east of UTC" },
];

// ---------------------------------------------------------------------------
// THE INSTANTS. Each is chosen so the three zones DISAGREE about the calendar
// date at that moment - which is the only kind of instant that can catch the
// bug. A midday-UTC instant would have all three agreeing and would prove
// nothing.
//
//   T_EVENING_UTC  2026-09-17T06:30:00Z
//     Los Angeles  16 Sep 23:30  (YESTERDAY relative to UTC)
//     London       17 Sep 07:30
//     Sydney       17 Sep 16:30
//
//   T_MORNING_UTC  2026-09-17T22:15:00Z
//     Los Angeles  17 Sep 15:15
//     London       17 Sep 23:15
//     Sydney       18 Sep 08:15  (TOMORROW relative to UTC)
// ---------------------------------------------------------------------------
const T_EVENING = Date.parse("2026-09-17T06:30:00Z");
const T_MORNING = Date.parse("2026-09-17T22:15:00Z");

// Sanity: the instants really do straddle the date line the way the comment
// claims. A fixture that stopped straddling would quietly defuse the whole
// suite, which is exactly the P2 failure this guards against.
eq("fixture: LA/London/Sydney disagree at T_EVENING",
  ZONES.map((z) => localYmd(T_EVENING, z.name)),
  ["2026-09-16", "2026-09-17", "2026-09-17"]);
eq("fixture: LA/London/Sydney disagree at T_MORNING",
  ZONES.map((z) => localYmd(T_MORNING, z.name)),
  ["2026-09-17", "2026-09-17", "2026-09-18"]);

// ---- the core assertion ----------------------------------------------------
// `expectOffset` is in DAYS FROM THE USER'S OWN TODAY, which is the only frame
// in which one expectation can be right in all three zones at once. Writing
// absolute dates per zone would just re-encode the bug into the test.
function dueCase(label, text, now, expectOffset, extra) {
  for (const z of ZONES) {
    const r = QuickAdd.parse(text, { now, zone: z.name });
    const todayLocal = localYmd(now, z.name);
    const todayStamp = Date.UTC(...todayLocal.split("-").map((v, i) => i === 1 ? +v - 1 : +v));
    const wantStamp = todayStamp + expectOffset * 86400000;

    if (expectOffset === null) {
      check(`${label} [${z.name}] no due date invented`, r.dueAt === null, String(r.dueAt));
      continue;
    }
    // 1. the stored number
    eq(`${label} [${z.name}] dueAt stamp`, r.dueAt, wantStamp);
    // 2. THE CONTRACT: what getDueWork reads back, against the user's calendar
    eq(`${label} [${z.name}] utcDay(dueAt) == the user's calendar day`,
      ymd(utcDay(r.dueAt)), ymd(wantStamp));
    if (extra) extra(r, z, label);
  }
}

// ===================== dates =====================
dueCase("today", "Call Nadia today", T_EVENING, 0);
dueCase("today (late instant)", "Call Nadia today", T_MORNING, 0);
dueCase("tomorrow", "Call Nadia tomorrow", T_EVENING, 1);
dueCase("tomorrow (late instant)", "Call Nadia tomorrow", T_MORNING, 1);
dueCase("tonight", "Ship it tonight", T_EVENING, 0, (r, z, l) =>
  eq(`${l} [${z.name}] tonight implies 20:00`, r.dueTime, { hour: 20, minute: 0 }));
dueCase("in 3 days", "Review in 3 days", T_EVENING, 3);
dueCase("in 1 day", "Review in 1 day", T_MORNING, 1);

// THE TWO COUNTER-EXAMPLES FROM quickadd.js's header, asserted as cases.
// These are the ones that a UTC-instant encoding gets wrong, in opposite
// directions, and they are the reason this file runs three zones.
dueCase("EDGE tonight 11pm stays on the user's today", "Call tonight 11pm", T_EVENING, 0);
dueCase("EDGE today 8am stays on the user's today", "Standup today 8am", T_MORNING, 0);

// ===================== weekdays, and the stated edge =====================
// T_EVENING is a Thursday in London/Sydney and a Wednesday in LA, so a fixed
// day-offset expectation cannot be shared. Assert the RULE per zone instead:
// strictly-after-today, and "next" is seven beyond that.
for (const z of ZONES) {
  const r = QuickAdd.parse("Gym friday", { now: T_EVENING, zone: z.name });
  const today = localYmd(T_EVENING, z.name);
  const todayStamp = Date.UTC(...today.split("-").map((v, i) => i === 1 ? +v - 1 : +v));
  const delta = (r.dueAt - todayStamp) / 86400000;
  check(`weekday [${z.name}] 'friday' lands on a Friday`, new Date(r.dueAt).getUTCDay() === 5, ymd(r.dueAt));
  check(`weekday [${z.name}] 'friday' is strictly after today (1..7)`, delta >= 1 && delta <= 7, `delta ${delta}`);

  const rn = QuickAdd.parse("Gym next friday", { now: T_EVENING, zone: z.name });
  const deltaN = (rn.dueAt - todayStamp) / 86400000;
  check(`weekday [${z.name}] 'next friday' is exactly 7 beyond 'friday'`, deltaN - delta === 7, `${delta} -> ${deltaN}`);
}

// THE FRIDAY-ON-FRIDAY EDGE, pinned with an instant that IS a Friday in all
// three zones so the answer is unambiguous: 2026-09-18T12:00Z.
{
  const FRI = Date.parse("2026-09-18T12:00:00Z");
  for (const z of ZONES) {
    check(`fixture: ${z.name} is a Friday at FRI noon UTC`,
      new Intl.DateTimeFormat("en-US", { timeZone: z.name, weekday: "long" }).format(new Date(FRI)) === "Friday");
    const r = QuickAdd.parse("Gym friday", { now: FRI, zone: z.name });
    const today = localYmd(FRI, z.name);
    const todayStamp = Date.UTC(...today.split("-").map((v, i) => i === 1 ? +v - 1 : +v));
    eq(`EDGE [${z.name}] 'friday' written ON a Friday means +7, not today`,
      (r.dueAt - todayStamp) / 86400000, 7);
  }
}

// ===================== a bare time, and its edge =====================
// T_EVENING: LA 23:30, London 07:30, Sydney 16:30. So "3pm" is already past in
// LA and Sydney (-> tomorrow) and still ahead in London (-> today). One
// sentence, three correct-but-different answers, which is the edge stated.
{
  const expect = { "America/Los_Angeles": 1, "Europe/London": 0, "Australia/Sydney": 1 };
  for (const z of ZONES) {
    const r = QuickAdd.parse("Call Nadia 3pm", { now: T_EVENING, zone: z.name });
    const today = localYmd(T_EVENING, z.name);
    const todayStamp = Date.UTC(...today.split("-").map((v, i) => i === 1 ? +v - 1 : +v));
    eq(`EDGE bare 3pm [${z.name}] today if ahead, tomorrow if past`,
      (r.dueAt - todayStamp) / 86400000, expect[z.name]);
    eq(`bare 3pm [${z.name}] parses 15:00`, r.dueTime, { hour: 15, minute: 0 });
  }
}

// ===================== explicit times =====================
{
  const z = "Europe/London";
  const p = (s) => QuickAdd.parse(s, { now: T_EVENING, zone: z });
  eq("time 3pm", p("x tomorrow 3pm").dueTime, { hour: 15, minute: 0 });
  eq("time 3:30pm", p("x tomorrow 3:30pm").dueTime, { hour: 15, minute: 30 });
  eq("time 15:00", p("x tomorrow 15:00").dueTime, { hour: 15, minute: 0 });
  eq("time 9am", p("x tomorrow 9am").dueTime, { hour: 9, minute: 0 });
  eq("time 12am is midnight", p("x tomorrow 12am").dueTime, { hour: 0, minute: 0 });
  eq("time 12pm is noon", p("x tomorrow 12pm").dueTime, { hour: 12, minute: 0 });
  eq("time 00:30", p("x tomorrow 00:30").dueTime, { hour: 0, minute: 30 });
  eq("13pm is not a time", p("x tomorrow 13pm").dueTime, null);
  eq("25:00 is not a time", p("x tomorrow 25:00").dueTime, null);
}

// ===================== month-day =====================
{
  const z = "Europe/London";
  const p = (s) => QuickAdd.parse(s, { now: T_EVENING, zone: z });
  eq("sep 20", ymd(p("Renew sep 20").dueAt), "2026-09-20");
  eq("20 sep", ymd(p("Renew 20 sep").dueAt), "2026-09-20");
  eq("september 20", ymd(p("Renew september 20").dueAt), "2026-09-20");
  eq("20th sep ordinal", ymd(p("Renew 20th sep").dueAt), "2026-09-20");
  // EDGE: already past this year -> next year, never a date in the past.
  eq("EDGE mar 1 has passed, rolls to next year", ymd(p("Taxes mar 1").dueAt), "2027-03-01");
  // EDGE: a day the month does not have is refused, not rolled into March.
  eq("EDGE feb 31 is refused", p("Nope feb 31").dueAt, null);
  // EDGE: numeric dates are locale-ambiguous and refused outright.
  eq("EDGE 20/9 is refused", p("Renew 20/9").dueAt, null);
  eq("EDGE 3/4 is refused", p("Renew 3/4").dueAt, null);
}

// ===================== priority =====================
{
  const z = "Europe/London";
  const p = (s) => QuickAdd.parse(s, { now: T_EVENING, zone: z });
  eq("!low", p("x !low").priority, "low");
  eq("!med", p("x !med").priority, "medium");
  eq("!medium", p("x !medium").priority, "medium");
  eq("!high", p("x !high").priority, "high");
  eq("!urgent", p("x !urgent").priority, "urgent");
  eq("!HIGH is case-insensitive", p("x !HIGH").priority, "high");
  // WHAT IS NOT A PRIORITY, stated as loudly as what is.
  eq("EDGE bare ! is not a priority", p("x ! y").priority, null);
  eq("EDGE !banana is not a priority", p("x !banana").priority, null);
  eq("EDGE !banana stays in the title", p("Fix !banana now").title, "Fix !banana now");
  eq("EDGE '3' alone is not a priority", p("Call 3").priority, null);
  eq("EDGE !1 is not a priority (word syntax only)", p("x !1").priority, null);
  eq("first priority wins", p("x !low !high").priority, "low");
}

// ===================== tags =====================
{
  const z = "Europe/London";
  const p = (s) => QuickAdd.parse(s, { now: T_EVENING, zone: z });
  eq("#acme", p("x #acme").tags, ["acme"]);
  eq("several tags accumulate", p("x #acme #beta").tags, ["acme", "beta"]);
  eq("tags de-dupe within one sentence, case-insensitively", p("x #acme #ACME").tags, ["acme"]);
  eq("tag with digits and dashes", p("x #q3-2026").tags, ["q3-2026"]);
  eq("EDGE bare # is not a tag", p("x # y").tags, []);
  eq("EDGE #! is not a tag", p("x #! y").tags, []);
  eq("EDGE a mid-word hash is not a tag", p("issue#42").tags, []);
}

// ===================== the title, and what is left of it =====================
{
  const z = "Europe/London";
  const p = (s) => QuickAdd.parse(s, { now: T_EVENING, zone: z });
  eq("the example sentence strips to its title",
    p("Call Nadia tomorrow 3pm !high #acme").title, "Call Nadia");
  eq("the example sentence parses everything else",
    (() => { const r = p("Call Nadia tomorrow 3pm !high #acme");
      return { d: ymd(r.dueAt), t: r.dueTime, pr: r.priority, tg: r.tags }; })(),
    { d: "2026-09-18", t: { hour: 15, minute: 0 }, pr: "high", tg: ["acme"] });
  eq("a token taken from the middle does not leave a double space",
    p("Call tomorrow Nadia").title, "Call Nadia");

  // A PLAIN SENTENCE IS A PLAIN TITLE. Nothing invented - the single most
  // important negative in the whole grammar.
  const plain = p("Email the landlord about the boiler");
  eq("plain sentence keeps its title", plain.title, "Email the landlord about the boiler");
  eq("plain sentence invents no due date", plain.dueAt, null);
  eq("plain sentence invents no time", plain.dueTime, null);
  eq("plain sentence invents no priority", plain.priority, null);
  eq("plain sentence invents no tags", plain.tags, []);
  eq("plain sentence reports nothing matched", plain.matched, []);

  // A sentence that is ONLY tokens still needs a name.
  const allTokens = p("!high #acme");
  check("a token-only sentence keeps a usable title", allTokens.title.length > 0, allTokens.title);
  eq("a token-only sentence parses nothing rather than making an unnamed task",
    { d: allTokens.dueAt, p: allTokens.priority, t: allTokens.tags }, { d: null, p: null, t: [] });

  eq("empty input is empty output", p("").title, "");
  eq("whitespace input invents nothing", p("   ").dueAt, null);
}

// ===================== purity =====================
{
  const a = QuickAdd.parse("Call Nadia tomorrow 3pm !high #acme", { now: T_EVENING, zone: "Australia/Sydney" });
  const b = QuickAdd.parse("Call Nadia tomorrow 3pm !high #acme", { now: T_EVENING, zone: "Australia/Sydney" });
  eq("PURE: same input, same output", a, b);

  // And it REFUSES rather than silently reaching for a clock, which is what
  // would make the zone dimension untestable.
  let threw = false;
  try { QuickAdd.parse("x tomorrow", {}); } catch { threw = true; }
  check("PURE: refuses to run without now and zone", threw);
  threw = false;
  try { QuickAdd.parse("x tomorrow", { now: T_EVENING }); } catch { threw = true; }
  check("PURE: refuses without a zone", threw);
}

// ===================== the anti-vacuity floor (P2) =====================
const MIN = 120;

let pass = 0, fail = 0;
console.log("\nQUICK-ADD — the parser, in three zones\n");
for (const r of rows) {
  if (!r.pass) console.log(`  FAIL  ${r.name}   << ${r.detail}`);
  r.pass ? pass++ : fail++;
}
if (rows.length < MIN) {
  console.log(`\nQUICK-ADD: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
console.log(`\nQUICK-ADD: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed (host TZ ${process.env.TZ})\n`);
process.exit(fail ? 1 : 0);
