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

// ===================== recurrence =====================
//
// THE DEFECT THIS SECTION EXISTS FOR: "long run every friday" matched `friday`
// as a weekday and produced a ONE-OFF task due next Friday. A habit ran once
// and nothing said so.
//
// TWO HALVES, AND THE SECOND IS THE ONE THAT KEEPS THE FIX HONEST:
//   1. the recurrence cases produce a template-shaped record and NO dueAt, and
//   2. A BARE WEEKDAY WITH NO "every" IS STILL A ONE-OFF. A fix that widened
//      into every weekday sentence would pass half of this section and break
//      the product, so the negative is asserted beside every positive.
//
// THE THREE ZONES ARE NOT CEREMONY HERE. "every week" and "every month" have
// to anchor on something, and they anchor on the day the USER is typing on -
// which at T_EVENING is 16 Sep (a Wednesday) in Los Angeles and 17 Sep (a
// Thursday) in London and Sydney. So the correct answer genuinely differs by
// zone, and a parser reading the host clock would agree across all three.

// The writer's own rules, COPIED rather than imported - the same discipline as
// utcDay above, and for the same reason: if storage.js's
// validateRecurringPattern changes, this gate should go red and make someone
// look rather than silently following it.
const TEMPLATE_FREQS = ["daily", "weekly", "monthly"];
const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isInt = (v) => typeof v === "number" && Number.isFinite(v) && (v | 0) === v;

function templateShapeErrors(rec) {
  if (rec === null) return ["recurrence is null"];
  const errs = [];
  // EXACTLY the writer's four fields. An extra field here is a field the
  // template writer does not take, which a later round would silently drop -
  // the same quiet loss this round exists to end, one level up.
  const keys = Object.keys(rec).sort().join(",");
  if (keys !== "dayOfMonth,daysOfWeek,frequency,timeOfDay") errs.push(`fields are ${keys}`);
  if (TEMPLATE_FREQS.indexOf(rec.frequency) === -1) errs.push(`frequency ${JSON.stringify(rec.frequency)}`);
  if (rec.frequency === "weekly") {
    if (!Array.isArray(rec.daysOfWeek) || rec.daysOfWeek.length === 0) errs.push("weekly needs a non-empty daysOfWeek");
    else if (!rec.daysOfWeek.every((d) => isInt(d) && d >= 0 && d <= 6)) errs.push("daysOfWeek outside 0..6");
  } else if (rec.daysOfWeek !== null) errs.push("daysOfWeek must be null unless weekly");
  if (rec.frequency === "monthly") {
    if (!isInt(rec.dayOfMonth) || rec.dayOfMonth < 1 || rec.dayOfMonth > 31) errs.push("monthly needs dayOfMonth 1..31");
  } else if (rec.dayOfMonth !== null) errs.push("dayOfMonth must be null unless monthly");
  if (rec.timeOfDay !== null && !TIME_OF_DAY_RE.test(rec.timeOfDay)) errs.push(`timeOfDay ${JSON.stringify(rec.timeOfDay)}`);
  return errs;
}

// `expect` may be a literal record, or a function of the user's own local
// today - which is the only frame in which one expectation is right in all
// three zones at once.
function recurCase(label, text, now, expect, wantTitle) {
  for (const z of ZONES) {
    const r = QuickAdd.parse(text, { now, zone: z.name });
    const [Y, M, D] = localYmd(now, z.name).split("-").map(Number);
    const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
    const want = typeof expect === "function" ? expect({ dow, dayOfMonth: D }) : expect;

    const errs = templateShapeErrors(r.recurrence);
    check(`${label} [${z.name}] matches the template writer's shape`, errs.length === 0, errs.join("; "));
    eq(`${label} [${z.name}] recurrence`, r.recurrence, want);
    // THE HEADLINE INVARIANT: a template has no single due date.
    check(`${label} [${z.name}] dueAt is null`, r.dueAt === null, String(r.dueAt));
    check(`${label} [${z.name}] matched names recurrence`, r.matched.indexOf("recurrence") !== -1, r.matched.join(","));
    if (wantTitle !== undefined) eq(`${label} [${z.name}] title`, r.title, wantTitle);
  }
}

// A phrase the RECORD CANNOT HOLD must produce nothing at all - and in
// particular must not fall through into a one-off, which is the defect
// arriving by a longer road.
function refuseCase(label, text, now) {
  for (const z of ZONES) {
    const r = QuickAdd.parse(text, { now, zone: z.name });
    check(`${label} [${z.name}] no recurrence invented`, r.recurrence === null, JSON.stringify(r.recurrence));
    check(`${label} [${z.name}] and NO one-off either`, r.dueAt === null, String(r.dueAt));
    check(`${label} [${z.name}] the phrase stays in the title`, /every/i.test(r.title), r.title);
  }
}

const DAILY = { frequency: "daily", daysOfWeek: null, dayOfMonth: null, timeOfDay: null };
const weekly = (days, timeOfDay = null) => ({ frequency: "weekly", daysOfWeek: days, dayOfMonth: null, timeOfDay });
const monthly = (dayOfMonth, timeOfDay = null) => ({ frequency: "monthly", daysOfWeek: null, dayOfMonth, timeOfDay });

// ---- THE REPORTED CASE, first and by name ----
recurCase("THE DEFECT 'long run every friday'", "long run every friday", T_EVENING, weekly([5]), "long run");
recurCase("THE DEFECT at the late instant", "long run every friday", T_MORNING, weekly([5]), "long run");

// ---- daily ----
recurCase("every day", "every day water plants", T_EVENING, DAILY, "water plants");
recurCase("daily", "daily standup", T_EVENING, DAILY, "standup");
recurCase("every 1 day", "every 1 day vitamins", T_EVENING, DAILY, "vitamins");

// ---- weekly, days named ----
recurCase("every weekday", "every weekday gym", T_EVENING, weekly([1, 2, 3, 4, 5]), "gym");
recurCase("weekdays (bare)", "weekdays gym", T_EVENING, weekly([1, 2, 3, 4, 5]), "gym");
recurCase("every mon, wed and fri", "every mon, wed and fri gym", T_EVENING, weekly([1, 3, 5]), "gym");
recurCase("every monday and thursday", "every monday and thursday standup", T_EVENING, weekly([1, 4]), "standup");
recurCase("a day list de-dupes and sorts", "every fri, mon and fri gym", T_EVENING, weekly([1, 5]), "gym");

// ---- weekly and monthly, ANCHORED ON THE USER'S OWN TODAY ----
// These are the zone-sensitive ones; the expectation is a function of the
// user's local date, not a constant.
recurCase("every week", "every week review", T_EVENING, ({ dow }) => weekly([dow]), "review");
recurCase("weekly (bare)", "weekly retro", T_EVENING, ({ dow }) => weekly([dow]), "retro");
recurCase("every 7 days", "every 7 days backup", T_EVENING, ({ dow }) => weekly([dow]), "backup");
recurCase("every month", "every month rent", T_EVENING, ({ dayOfMonth }) => monthly(dayOfMonth), "rent");
recurCase("monthly (bare)", "monthly invoices", T_EVENING, ({ dayOfMonth }) => monthly(dayOfMonth), "invoices");

// ANTI-VACUITY FOR THE ANCHOR (P2). If the parser read the HOST zone instead of
// its `zone` argument, every row above would still be internally consistent -
// so assert that the three zones genuinely DISAGREE here, which is the only
// thing that proves the anchor is the user's.
{
  const day = (z) => QuickAdd.parse("every week review", { now: T_EVENING, zone: z }).recurrence.daysOfWeek[0];
  const dom = (z) => QuickAdd.parse("every month rent", { now: T_EVENING, zone: z }).recurrence.dayOfMonth;
  check("ANCHOR: 'every week' resolves to a DIFFERENT day in LA than in London",
    day("America/Los_Angeles") !== day("Europe/London"),
    `LA ${day("America/Los_Angeles")} vs London ${day("Europe/London")}`);
  check("ANCHOR: 'every month' resolves to a DIFFERENT day-of-month in LA than in London",
    dom("America/Los_Angeles") !== dom("Europe/London"),
    `LA ${dom("America/Los_Angeles")} vs London ${dom("Europe/London")}`);
}

// ---- timeOfDay ----
recurCase("an explicit time becomes timeOfDay", "every day 7am meds", T_EVENING, { ...DAILY, timeOfDay: "07:00" });
recurCase("a 24-hour time becomes timeOfDay", "every month rent 09:00", T_EVENING,
  ({ dayOfMonth }) => monthly(dayOfMonth, "09:00"));
// A CADENCE SUPPRESSES EVERY DATE PHRASE, "tonight" INCLUDED - so it is not
// merely that tonight's implied 20:00 is kept out of timeOfDay, it is that the
// word is never read at all and is LEFT IN THE TITLE for the user to see.
//
// The first version of this row asserted only `timeOfDay: null` and was
// VACUOUS: under recurrence nothing ever sets dueTime, so the row passed
// against a subject with its guard deleted. The seeded-mutation pass found it
// by escaping. Asserting the title is what makes the claim real.
recurCase("EDGE a cadence suppresses 'tonight' entirely",
  "every friday tonight", T_EVENING, weekly([5]), "tonight");

// ---- what the record cannot hold ----
refuseCase("EDGE 'every 2 days' has no interval field", "every 2 days x", T_EVENING);
refuseCase("EDGE 'every 3 weeks' has no interval field", "every 3 weeks x", T_EVENING);
refuseCase("EDGE 'every other friday' is refused AND stays a non-date",
  "every other friday long run", T_EVENING);
refuseCase("EDGE 'every 2nd friday' is refused AND stays a non-date",
  "every 2nd friday long run", T_EVENING);

// ---- THE NEGATIVE: THE FIX MUST NOT WIDEN ----
//
// Every one of these was a one-off before this round and must still be one.
// Without this block, a parser that treated EVERY weekday as recurrence would
// pass everything above.
{
  const oneOff = (label, text, now) => {
    for (const z of ZONES) {
      const r = QuickAdd.parse(text, { now, zone: z.name });
      check(`NEGATIVE ${label} [${z.name}] is still a ONE-OFF`, r.dueAt !== null, String(r.dueAt));
      check(`NEGATIVE ${label} [${z.name}] invents no recurrence`, r.recurrence === null, JSON.stringify(r.recurrence));
    }
  };
  oneOff("bare 'friday'", "call Nadia friday", T_EVENING);
  oneOff("'next friday'", "dentist next friday", T_EVENING);
  oneOff("'tomorrow'", "call Nadia tomorrow", T_EVENING);
  oneOff("'today'", "call Nadia today", T_EVENING);
  oneOff("'in 3 days'", "review in 3 days", T_EVENING);
  oneOff("'sep 20'", "renew sep 20", T_EVENING);
  oneOff("the TD.1 example sentence", "Call Nadia tomorrow 3pm !high #acme", T_EVENING);

  // And a plain sentence still invents nothing of either kind.
  const plain = QuickAdd.parse("Email the landlord about the boiler", { now: T_EVENING, zone: "Europe/London" });
  eq("NEGATIVE a plain sentence invents no recurrence", plain.recurrence, null);
  eq("NEGATIVE a plain sentence invents no due date", plain.dueAt, null);
}

// ---- recurrence composes with the other tokens ----
{
  const r = QuickAdd.parse("every monday standup !high #team 9am", { now: T_EVENING, zone: "Europe/London" });
  eq("recurrence composes: recurrence", r.recurrence, weekly([1], "09:00"));
  eq("recurrence composes: title", r.title, "standup");
  eq("recurrence composes: priority", r.priority, "high");
  eq("recurrence composes: tags", r.tags, ["team"]);
  eq("recurrence composes: no due date", r.dueAt, null);
}

// ===================== purity =====================
{
  const a = QuickAdd.parse("Call Nadia tomorrow 3pm !high #acme", { now: T_EVENING, zone: "Australia/Sydney" });
  const b = QuickAdd.parse("Call Nadia tomorrow 3pm !high #acme", { now: T_EVENING, zone: "Australia/Sydney" });
  eq("PURE: same input, same output", a, b);

  // The recurrence path too, because it reads `now` for its weekly/monthly
  // anchors and is therefore the newest place a stray clock read could hide.
  const ra = QuickAdd.parse("every week review 9am", { now: T_EVENING, zone: "Australia/Sydney" });
  const rb = QuickAdd.parse("every week review 9am", { now: T_EVENING, zone: "Australia/Sydney" });
  eq("PURE: same recurrence input, same output", ra, rb);
  // The module-level recurrence regexes are /g, so their lastIndex survives a
  // call. Parsing twice and getting the same answer is what proves scan()'s
  // reset actually resets - a stale lastIndex would make the SECOND parse of a
  // sentence differ from the first, which no single-parse assertion can see.
  const rc = QuickAdd.parse("every monday and thursday standup", { now: T_EVENING, zone: "Europe/London" });
  const rd = QuickAdd.parse("every monday and thursday standup", { now: T_EVENING, zone: "Europe/London" });
  eq("PURE: a /g regex's lastIndex does not leak between calls", rc, rd);

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
// 120 when TD.1 wrote it; 482 once recurrence landed. The floor tracks the
// suite it actually guards - left at 120 it would still pass with the entire
// recurrence section deleted, which is exactly the vacuum it exists to catch.
const MIN = 440;

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
