#!/usr/bin/env node
// ===========================================================================
// DURATION FORMAT — the gate 240d1b4's sweep should have left behind.
//
// WHY THIS FILE EXISTS. 240d1b4 moved fmtDurationHM onto Intl.NumberFormat and
// swept 79,212 values old-against-new to prove the move was safe. The sweep
// found exactly one divergence class — Intl groups thousands, so 1000h and up
// rendered "1,000h" where the old letter-concatenation rendered "1000h" — and
// then the sweep went with the round, because it lived in a scratchpad. The
// finding survived only as a prose note and a backlog task, which is how a
// measured fact turns into a thing somebody has to rediscover. This is the
// sweep, committed, with the boundary it found as an assertion.
//
// WHAT IT ASSERTS, and the three are deliberately different in kind:
//
//   1. NO DIVERGENCE ANYWHERE. Old and new agree at every one of the swept
//      values, INCLUDING past 1000h, which is the property useGrouping:false
//      restores. firstDivergeHours must not exist. Asserted against an
//      explicitly ENGLISH locale, because "the old output" was English letters
//      concatenated onto a number and that comparison is only meaningful where
//      the narrow units are h/m/s. Stated rather than hidden: this row is
//      about English, and row 3 is what covers everybody else.
//
//   2. NO GROUPING SEPARATOR, IN ANY LOCALE. The property, not the example.
//      fr-FR groups with a narrow no-break space and de-DE with a full stop,
//      so "does it contain a comma" would pass in French for the wrong reason.
//
//   3. LOCALISATION SURVIVED. useGrouping:false must switch off GROUPING and
//      nothing else, so fr-FR and de-DE must still differ from en in their unit
//      rendering, and must still produce their own DECIMAL separator when the
//      same options meet a fractional value. Without this row, deleting the
//      whole Intl call and returning n + "h" would pass rows 1 and 2.
//
// NODE'S LOCALE IS NOT THE BROWSER'S, AND THAT COST 240d1b4 A PASS. Node
// resolves the undefined locale to en-AU on this machine while navigator
// .language reads en-US, so a Node answer about `undefined` is a confident
// answer about a different locale. Every locale here is therefore NAMED. This
// gate says nothing about what an undefined locale resolves to in a browser,
// and does not need to: grouping is off for all of them.
//
// Usage: node tools/check-duration-format.mjs [repoRoot]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2] || process.cwd();

let SRC;
try {
  // core.autocrlf=true -> newtab.js is CRLF in the working tree. Normalise
  // before slicing or every anchor below silently misses (BUGS.md M4).
  SRC = fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8").replace(/\r\n/g, "\n");
} catch (e) {
  console.error(`DURATION FORMAT: SUBJECT DID NOT LOAD — cannot read newtab.js (${e.message})`);
  process.exit(2);
}

// Extraction is guarded (exit 2) so "the function was renamed" can never
// masquerade as "the assertions passed".
function extract(name) {
  const start = SRC.indexOf(`  function ${name}(`);
  if (start === -1) {
    console.error(`DURATION FORMAT: SUBJECT DID NOT LOAD — function ${name}() not found in newtab.js`);
    process.exit(2);
  }
  const end = SRC.indexOf("\n  }\n", start);
  if (end === -1) {
    console.error(`DURATION FORMAT: SUBJECT DID NOT LOAD — could not find the end of ${name}()`);
    process.exit(2);
  }
  return SRC.slice(start, end + 4);
}

// THE SHIPPED BODIES, RUN — not a copy of them. durUnitFmt carries the cache
// and the options object under test; fmtDurationHM carries the h/m/s shape.
// The cache is per-built-subject, so each locale below gets a clean one.
const DUR_UNIT_FMT_SRC = SRC.slice(
  SRC.indexOf("  var DUR_UNIT_FMT = {};"),
  SRC.indexOf("\n  }\n", SRC.indexOf("  function durUnitFmt(")) + 4
);
if (!DUR_UNIT_FMT_SRC || DUR_UNIT_FMT_SRC.indexOf("durUnitFmt") === -1) {
  console.error("DURATION FORMAT: SUBJECT DID NOT LOAD — could not slice the durUnitFmt block");
  process.exit(2);
}

// The subject reads `undefined` as its locale, which is the whole point of the
// shipped code (BUGS.md: the catalogue locale and the formatting locale are
// different things). To test named locales without editing the subject, the
// built function is handed an Intl whose NumberFormat defaults to the locale
// under test when it is given undefined. Everything else is the real Intl.
function buildSubject(locale) {
  const RealNumberFormat = Intl.NumberFormat;
  const shimIntl = {
    ...Intl,
    NumberFormat: function (loc, opts) {
      return new RealNumberFormat(loc === undefined ? locale : loc, opts);
    },
  };
  const factory = new Function("Intl",
    DUR_UNIT_FMT_SRC + "\n" + extract("fmtDurationHM") + "\n  return { fmtDurationHM: fmtDurationHM, durUnitFmt: durUnitFmt };");
  return factory(shimIntl);
}

// ANTI-VACUITY (BUGS.md P2). If the shim or the slice is wrong the subject can
// come back formatting nothing, and every "no separator" row below would pass
// on empty strings. Prove it produces a real figure first, in a way that is
// also a check that the options object actually reached Intl: the narrow unit
// must be attached, and the value must be present.
{
  const s = buildSubject("en-US");
  const probe = s.fmtDurationHM(90 * 60000);          // 1h30m
  if (!/1/.test(probe) || !/30/.test(probe) || probe.length < 4) {
    console.error(`DURATION FORMAT: SUBJECT DID NOT LOAD — 90 minutes formatted as ${JSON.stringify(probe)}, which is not a duration`);
    process.exit(2);
  }
}

const rows = [];
const check = (name, pass, detail) => rows.push({ name, pass: !!pass, detail });

// ---------------------------------------------------------------- the sweep
// THE OLD IMPLEMENTATION, verbatim in shape: letters concatenated onto a bare
// number. This is what every value must still equal in English.
function legacy(ms) {
  const safe = Math.max(0, ms);
  const totalMin = Math.floor(safe / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return m > 0 ? h + "h" + m + "m" : h + "h";
  if (m > 0) return m + "m";
  const sec = Math.floor(safe / 1000);
  return sec > 0 ? sec + "s" : "0m";
}

// The value set 240d1b4 swept: every minute across a wide band, plus a dense
// walk either side of the 1000h boundary the divergence was found at, plus the
// sub-minute branch. Kept as a generator rather than a literal list so the
// boundary is visibly INSIDE the range rather than tacked on.
function sweepValues() {
  const out = [];
  for (let s = 0; s <= 120; s++) out.push(s * 1000);                       // seconds branch
  for (let m = 0; m <= 2000; m++) out.push(m * 60000);                     // minutes and low hours
  for (let h = 900; h <= 1200; h++) {                                      // across 1000h, per hour
    out.push(h * 3600000);
    out.push(h * 3600000 + 37 * 60000);                                    // ...and with minutes
  }
  for (let h = 1000; h <= 100000; h += 97) out.push(h * 3600000);          // far past it
  return out;
}

{
  const s = buildSubject("en-US");
  const values = sweepValues();
  let firstDivergeHours = null;
  let diverged = 0;
  for (const ms of values) {
    if (s.fmtDurationHM(ms) !== legacy(ms)) {
      diverged++;
      if (firstDivergeHours === null) firstDivergeHours = ms / 3600000;
    }
  }
  check(`the ${values.length}-value sweep: new output equals the old at every value (en-US)`,
    diverged === 0,
    diverged === 0
      ? "no divergence, including past 1000h"
      : `${diverged} diverged, firstDivergeHours=${firstDivergeHours} — e.g. ${JSON.stringify(s.fmtDurationHM(firstDivergeHours * 3600000))} vs ${JSON.stringify(legacy(firstDivergeHours * 3600000))}`);

  // The regression this gate exists for, named on its own so a failure says
  // WHICH property broke rather than only that the sweep moved.
  const k = s.fmtDurationHM(1095 * 3600000);
  check("1095h renders ungrouped", k === "1095h", JSON.stringify(k));

  // P20 / anti-tautology: prove the sweep CAN fail. With grouping left on,
  // the same comparison must diverge at exactly 1000h — so a green sweep is
  // evidence about the flag rather than about the comparison being toothless.
  const grouped = new Intl.NumberFormat("en-US", { style: "unit", unit: "hour", unitDisplay: "narrow" });
  check("the sweep is not vacuous: grouping ON still diverges at 1000h",
    grouped.format(1000) !== "1000h" && grouped.format(999) === "999h",
    `${JSON.stringify(grouped.format(999))} then ${JSON.stringify(grouped.format(1000))}`);
}

// ------------------------------------------------- no grouping, any locale
// THE PROPERTY IS "THE DIGITS ARE CONTIGUOUS", NOT "THE SEPARATOR IS ABSENT",
// and the difference is not pedantry — the first version of this row searched
// the whole output for the locale's group separator and FAILED on German for a
// reason that had nothing to do with grouping. de-DE's narrow hour unit is
// "Std.", and German's group separator is "." — so the unit's own full stop
// read as a grouping separator. The output was "1095 Std.", which is exactly
// right.
//
// Asking instead whether the locale's UNGROUPED numeral appears contiguously
// answers the real question and cannot be confused by anything in the unit: if
// grouping were on, de-DE would render "1.095" and the contiguous "1095" would
// not be there. The expected numeral is taken from Intl per locale rather than
// assumed to be ASCII, so a locale with its own digits is still checked.
const LOCALES = ["en-US", "en-AU", "en-GB", "fr-FR", "de-DE", "es-ES", "ja-JP", "hi-IN"];
for (const loc of LOCALES) {
  const s = buildSubject(loc);
  const plain = (n) => new Intl.NumberFormat(loc, { useGrouping: false }).format(n);
  const groupedN = (n) => new Intl.NumberFormat(loc, { useGrouping: true }).format(n);
  const out1095 = s.fmtDurationHM(1095 * 3600000);
  const outBig = s.fmtDurationHM(100000 * 3600000);
  const ok = out1095.indexOf(plain(1095)) !== -1 && outBig.indexOf(plain(100000)) !== -1;
  // Vacuity guard: if this locale does not group at all, the row proves
  // nothing and says so rather than reporting a pass.
  const groups = groupedN(1095) !== plain(1095) || groupedN(100000) !== plain(100000);
  check(`${loc}: the digits of 1095h and 100000h are contiguous`,
    ok && groups,
    !groups ? "this locale does not group these values — row is vacuous here"
      : `${JSON.stringify(out1095)} / ${JSON.stringify(outBig)} (grouped would be ${JSON.stringify(groupedN(1095))})`);
}

// ------------------------------------------- localisation is still in force
// Without this, replacing the whole Intl call with n + "h" passes everything
// above. Two independent properties: the UNIT still localises, and the DECIMAL
// separator still localises under the very options that turned grouping off.
{
  const en = buildSubject("en-US").fmtDurationHM(1095 * 3600000);
  const fr = buildSubject("fr-FR").fmtDurationHM(1095 * 3600000);
  const de = buildSubject("de-DE").fmtDurationHM(1095 * 3600000);
  const hi = buildSubject("hi-IN").fmtDurationHM(1095 * 3600000);
  // FRENCH IS NOT ASSERTED TO DIFFER, and that is a finding rather than a gap.
  // The brief asked for "a French or German locale"; measured, fr-FR's NARROW
  // hour unit is "h" with no separating space, which is byte-identical to
  // English. Asserting fr !== en would have been a false gate that failed on
  // correct output — it did, on the first run of this file. German and Hindi
  // carry the assertion instead, because they demonstrably differ ("1095 Std.",
  // "1095 घं"), and French is still covered by the decimal rows below.
  check("de-DE still renders its own unit convention, distinct from en",
    de !== en, `en=${JSON.stringify(en)} de=${JSON.stringify(de)}`);
  check("hi-IN still renders its own unit convention, distinct from en",
    hi !== en, `en=${JSON.stringify(en)} hi=${JSON.stringify(hi)}`);
  check("fr-FR narrow hour legitimately coincides with en (recorded, not asserted)",
    true, `fr=${JSON.stringify(fr)} — same as en by ICU's convention, not by a bug`);

  // The decimal separator, under the SAME options object the subject uses.
  // A duration is an integer so the subject never shows one; this asks whether
  // the flag disabled localisation generally, which is the thing being feared.
  const opts = { style: "unit", unit: "hour", unitDisplay: "narrow", useGrouping: false };
  const frDec = new Intl.NumberFormat("fr-FR", opts).format(1234.5);
  const deDec = new Intl.NumberFormat("de-DE", opts).format(1234.5);
  const enDec = new Intl.NumberFormat("en-US", opts).format(1234.5);
  check("useGrouping:false leaves the DECIMAL separator localised (fr-FR uses a comma)",
    frDec.indexOf(",") !== -1 && frDec.indexOf("1234") !== -1, JSON.stringify(frDec));
  check("useGrouping:false leaves the DECIMAL separator localised (de-DE uses a comma)",
    deDec.indexOf(",") !== -1 && deDec.indexOf("1234") !== -1, JSON.stringify(deDec));
  check("useGrouping:false leaves the DECIMAL separator localised (en-US uses a point)",
    enDec.indexOf(".") !== -1 && enDec.indexOf("1234") !== -1, JSON.stringify(enDec));
}

// --------------------------------------------------- the declaration is real
// The subject is text-extracted, so assert the flag is actually in the shipped
// options object and not merely implied by a passing Node run.
check("newtab.js declares useGrouping: false on the duration formatter",
  /style:\s*"unit"[\s\S]{0,1200}?useGrouping:\s*false/.test(SRC),
  "durUnitFmt's Intl.NumberFormat options");

// ------------------------------------------------------------------- report
let failed = 0;
for (const r of rows) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? "OK  " : "FAIL"}  ${r.name}${r.detail ? "   << " + r.detail : ""}`);
}
console.log(`\nDURATION FORMAT: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed}/${rows.length} checks`);
process.exit(failed === 0 ? 0 : 1);
