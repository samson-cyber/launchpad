#!/usr/bin/env node
// ===========================================================================
// THE DOCS GATE, AND IT IS DELIBERATELY SMALL.
//
// Asana 1217983753179202 raised this at the close of the 2026-08-31 docs sync:
// no tool in tools/ reads docs/, so months of drift were repaired by hand and
// every instance was found by a premise audit tripping over a contradiction.
// That is still true - nothing reads docs/ but this file.
//
// WHAT THIS CHECKS, AND IT IS ONLY TWO THINGS:
//
//   1. LEDGER IDS in BUGS.md: per section, no DUPLICATES and no GAPS.
//   2. THE RELEASE-STATE CLAIMS in CLAUDE.md against the ANNOTATED TAGS, which
//      CLAUDE.md itself names as the authority - the tag set, the deliberate
//      absences, and each named tag -> commit mapping.
//
// WHY ONLY THOSE TWO, with the rejected candidates named so nobody re-proposes
// them without reading this:
//
//   ARC MARKERS -> a matching ROADMAP/DECISIONS entry. REJECTED. CLAUDE.md
//     records that markers are arc numbers rather than versions, that only 154
//     of 423 commits carry one, that `[tooling]` and `[site]` appear in NO
//     commit subject, that non-numeric markers exist, and that one arc has
//     three spellings - and it says DO NOT RENUMBER ANYTHING TO TIDY THIS. A
//     gate here would fail on documented, accepted, deliberate inconsistency,
//     which is the fastest way to teach people to ignore a gate.
//
//   .md FILES ARE LF. REJECTED as its own check: .gitattributes already pins
//     `*.md text eol=lf`, so a gate would assert git's own behaviour back at
//     itself. Nothing can drift while that line exists.
//
//   NO DECISIONS ENTRY DATED AFTER THE FILE'S LAST COMMIT, or entries in date
//     order. REJECTED. DECISIONS.md states outright that six entries were
//     APPENDED rather than interleaved and that a reader must read their dates
//     rather than their position. Out-of-order dates are deliberate there, so
//     the check would fire on the file working as designed.
//
//   A DOC QUOTING A CODE LITERAL MUST MATCH THE CODE (the task's item 1).
//     REJECTED AS TOO EXPENSIVE, not as wrong - it is the best idea in the
//     task. It needs a marking convention (a fenced block annotated with file
//     and symbol) that does not exist and would have to be retrofitted across
//     BUGS.md before the gate could check anything. Worth doing the day someone
//     adopts the convention; not worth inventing one inside a gate.
//
//   FIELD-SHAPE CLAIMS IN SPECS vs the factory functions (the task's item 3).
//     REJECTED: it needs a JS parser this repo does not have and will not grow
//     for one check.
//
// WHAT IT CANNOT CATCH, said plainly because the alternative is a gate that
// implies more coverage than it has. The 2026-09-14 board cleanup found TEN
// CLOSED TASKS SITTING IN OPEN SECTIONS and a version-marker collision. Both
// live in Asana, not in the repo, and no gate that reads files can see either.
// The drift this project actually suffers is split between the two, and this
// file guards only the half that is checkable from a checkout.
//
// Exit codes: 0 ok - 1 drift found - 2 gate broken.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// THE DOCS ROOT IS OVERRIDABLE; THE GIT ROOT IS NOT, and the split is the
// whole mutation story. CLAUDE.md is the thing that ROTS - the tags are the
// authority it is being checked against, and an authority you can seed is not
// an authority. So --mutate rewrites the DOC and leaves the tags alone, which
// is exactly the direction real drift travels.
const MUTATE = process.argv.includes("--mutate");
const DOCS_ROOT = process.argv.find((a) => a.startsWith("--docs=")) 
  ? process.argv.find((a) => a.startsWith("--docs=")).slice(7)
  : ROOT;

let pass = 0, fail = 0;
const problems = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  PASS  " + name); return true; }
  fail++;
  const line = name + (detail ? "   << " + detail : "");
  problems.push(line);
  console.log("  FAIL  " + line);
  return false;
}

function read(rel) {
  const p = path.join(DOCS_ROOT, rel);
  if (!fs.existsSync(p)) {
    console.error("DOCS GATE: cannot read " + rel);
    process.exit(2);
  }
  return fs.readFileSync(p, "utf8");
}

console.log("\nDOCS GATE — ledger ids and the release-state block\n");

// ===================================================== 1. LEDGER IDS
//
// An id is how every other document CITES an entry ("see BUGS.md E7", "P25's
// worked example"). A DUPLICATE makes a citation ambiguous, and a GAP means an
// entry was deleted while something may still point at it. Those are the two
// that matter.
//
// ORDER IS NOT CHECKED, and that is a finding rather than an omission: section
// I currently runs ...19, 22, 20, 21, 23... and section L runs 1, 2, 5, 3, 4.
// Both are real, both are harmless - ids are stable handles, not an index - and
// gating on order would demand churn on a ledger for a cosmetic property.
const bugs = read(path.join("docs", "BUGS.md"));
const idRe = /^- \*\*([A-Z])(\d+)\./gm;
const bySection = new Map();
let m;
while ((m = idRe.exec(bugs)) !== null) {
  const L = m[1], n = Number(m[2]);
  if (!bySection.has(L)) bySection.set(L, []);
  bySection.get(L).push(n);
}

// P2: a scan that silently matches nothing passes forever and reads exactly
// like a scan that looked and found nothing. This gate is worthless below a
// floor, so the floor is asserted.
const totalIds = [...bySection.values()].reduce((a, v) => a + v.length, 0);
if (!check("the id scan found a plausible number of entries (>= 150 across >= 15 sections)",
  totalIds >= 150 && bySection.size >= 15, totalIds + " ids in " + bySection.size + " sections")) {
  console.log("\nDOCS GATE: the scan is broken, so nothing below means anything.\n");
  process.exit(2);
}

for (const L of [...bySection.keys()].sort()) {
  const ns = bySection.get(L);
  const seen = new Set(), dupes = new Set();
  for (const n of ns) { if (seen.has(n)) dupes.add(n); seen.add(n); }
  const max = Math.max(...ns);
  const gaps = [];
  for (let i = 1; i <= max; i++) if (!seen.has(i)) gaps.push(i);
  check("BUGS.md section " + L + ": " + ns.length + " ids, no duplicates and no gaps (1.." + max + ")",
    dupes.size === 0 && gaps.length === 0,
    (dupes.size ? "duplicates " + [...dupes].join(",") : "") +
    (dupes.size && gaps.length ? "; " : "") +
    (gaps.length ? "gaps " + gaps.join(",") : ""));
}

// ===================================================== 2. RELEASE STATE
//
// CLAUDE.md: "The authoritative record of what shipped is the ANNOTATED GIT
// TAGS, never the markers and never the manifest." So the tags are the truth
// and the prose is the thing that can rot - which it did: on 2026-08-30 the
// block asserted that v2.0.0 was never submitted while an annotated v2.0.0 tag
// sat in the repo, and that error propagated into ROADMAP.md before two
// independent pieces of evidence caught it. THAT is the drift this half exists
// for, and it is the one piece of documented drift a file-reading gate could
// have caught.
const claude = read("CLAUDE.md");

let tagLines = [];
try {
  tagLines = execFileSync("git", ["for-each-ref", "--format=%(refname:short) %(objecttype) %(*objectname)", "refs/tags"],
    { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
} catch (e) {
  console.error("DOCS GATE: cannot read git tags — " + (e.message || e));
  process.exit(2);
}

// ANNOTATED ONLY, and the distinction is the convention rather than pedantry:
// CLAUDE.md requires an ANNOTATED `v<manifest-version>` at each submission.
// `main-archive` is a lightweight commit tag and is deliberately not a release.
const realTags = new Map();   // "v2.1.0" -> peeled commit sha
for (const line of tagLines) {
  const [name, type, peeled] = line.split(/\s+/);
  if (type !== "tag") continue;
  if (!/^v\d+\.\d+\.\d+$/.test(name)) continue;
  realTags.set(name, peeled || "");
}
check("the repo exposes at least one annotated release tag", realTags.size >= 1,
  realTags.size + " found");

// Versions CLAUDE.md says EXIST, taken only from backtick-quoted `vX.Y.Z`
// tokens so ordinary prose about a version number cannot be mistaken for a
// claim about a tag.
const quoted = new Set();
const qRe = /`(v\d+\.\d+\.\d+)`/g;
let q;
while ((q = qRe.exec(claude)) !== null) quoted.add(q[1]);

// ...minus the ones it explicitly says do NOT exist. CLAUDE.md states the
// absence of `v2.0.1` three times and calls it "the rule working exactly as
// intended", so the gate must understand a denial or it would fail on the
// document being right.
const denied = new Set();
const dRe = /(?:no|NO)\s+`(v\d+\.\d+\.\d+)`\s+tag/g;
let dm;
while ((dm = dRe.exec(claude)) !== null) denied.add(dm[1]);
check("CLAUDE.md's explicit tag DENIALS were parsed (it denies at least one)",
  denied.size >= 1, [...denied].join(",") || "none parsed");

const claimed = new Set([...quoted].filter((v) => !denied.has(v)));

for (const v of [...claimed].sort()) {
  check("CLAUDE.md names `" + v + "` as a tag, and an annotated tag exists",
    realTags.has(v), "no annotated tag " + v);
}
for (const v of [...denied].sort()) {
  check("CLAUDE.md says there is deliberately no `" + v + "` tag, and there is none",
    !realTags.has(v), "a tag " + v + " EXISTS, so the doc is wrong");
}
for (const v of [...realTags.keys()].sort()) {
  check("the annotated tag " + v + " is named in CLAUDE.md",
    claimed.has(v), "tag exists but CLAUDE.md never names it");
}

// THE TAG -> COMMIT MAPPING. CLAUDE.md writes these as `v1.0.5` (`3eb9323`),
// and that pairing is the most rot-prone claim in the file: it was derived
// once, by hand, from build evidence. A tag re-pointed without the doc being
// updated is exactly the kind of silent contradiction this gate is for.
const pairRe = /`(v\d+\.\d+\.\d+)`\s*\(`([0-9a-f]{7,40})`\)/g;
let pm, pairs = 0;
while ((pm = pairRe.exec(claude)) !== null) {
  const [, v, sha] = pm;
  pairs++;
  const actual = realTags.get(v) || "";
  check("CLAUDE.md pairs " + v + " with " + sha + ", and the tag peels there",
    actual.startsWith(sha), actual ? "tag peels to " + actual.slice(0, sha.length) : "no such annotated tag");
}
check("at least one tag -> commit pairing was found to check", pairs >= 1, pairs + " found");

// ===================================================== --mutate
//
// Six seeded drifts, one per thing this gate claims to catch. Each is written
// `all: true` ON THE CLAUDE.md SEEDS IS NOT A CONVENIENCE: each of those claims
// is stated TWICE in that file - once in the release-state block and once in
// the tag notes - which the first run of this suite found by reporting three
// anchor MISSES rather than by anyone knowing it. Seeding one occurrence models
// a doc contradicting ITSELF; seeding both models a doc that is consistently
// wrong, which is the drift that actually happened. The gate catches either.
// into a COPY of the docs and the gate is re-run against it as a child; a seed
// that does not turn the run red is a seed this gate cannot see.
if (MUTATE && DOCS_ROOT === ROOT) {
  if (fail) {
    console.log("\n  the CLEAN tree is already failing, so no seed below means anything.\n");
    process.exit(1);
  }
  console.log("\nDOCS GATE - mutation seeding\n");
  const os = await import("node:os");
  const { execFileSync: run } = await import("node:child_process");
  const SEEDS = [
    { name: "a DUPLICATE ledger id (E10 becomes a second E9)",
      file: "docs/BUGS.md", from: "- **E10.", to: "- **E9." },
    { name: "a GAP in the ledger (E10 becomes E11)",
      file: "docs/BUGS.md", from: "- **E10.", to: "- **E11." },
    { name: "CLAUDE.md names a tag that does not exist (v2.1.0 -> v9.9.9)",
      file: "CLAUDE.md", from: "`v2.1.0` (`15797ad`)", to: "`v9.9.9` (`15797ad`)", all: true },
    { name: "CLAUDE.md pairs a real tag with the WRONG commit",
      file: "CLAUDE.md", from: "`v2.0.0` (`92eeb68`)", to: "`v2.0.0` (`deadbee`)", all: true },
    { name: "THE 2026-08-30 DRIFT ITSELF: the doc denies a tag that exists",
      file: "CLAUDE.md", from: "no `v2.0.1` tag", to: "no `v2.0.0` tag", all: true },
    { name: "an annotated tag stops being named at all (every `v1.0.5` defanged)",
      file: "CLAUDE.md", from: "`v1.0.5`", to: "v1.0.5", all: true },
  ];
  let caught = 0, missed = 0;
  for (const s of SEEDS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docsgate-"));
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    for (const rel of ["docs/BUGS.md", "CLAUDE.md"]) {
      fs.copyFileSync(path.join(ROOT, rel), path.join(dir, rel));
    }
    const target = path.join(dir, s.file);
    const src = fs.readFileSync(target, "utf8");
    const hits = src.split(s.from).length - 1;
    if (hits < 1) {
      console.log("  MISS  " + s.name + "   << anchor matched 0 times");
      missed++; fs.rmSync(dir, { recursive: true, force: true }); continue;
    }
    if (!s.all && hits !== 1) {
      console.log("  MISS  " + s.name + "   << anchor matched " + hits + " times (want 1)");
      missed++; fs.rmSync(dir, { recursive: true, force: true }); continue;
    }
    fs.writeFileSync(target, s.all ? src.split(s.from).join(s.to) : src.replace(s.from, s.to));
    let code = 0;
    try {
      run(process.execPath, [fileURLToPath(import.meta.url), "--docs=" + dir], { stdio: "pipe" });
    } catch (e) { code = e.status === undefined ? -1 : e.status; }
    fs.rmSync(dir, { recursive: true, force: true });
    if (code === 1) { console.log("  CAUGHT   " + s.name); caught++; }
    else { console.log("  ESCAPED  " + s.name + "   << child exited " + code); missed++; }
  }
  console.log("\nMUTATION: " + caught + " caught, " + missed + " escaped (of " + SEEDS.length + ")");
  if (missed) process.exit(1);
}

console.log("");
if (fail) {
  console.log("DOCS GATE: FAIL — " + pass + " passed, " + fail + " failed.");
  console.log("  " + problems.join("\n  "));
  process.exit(1);
}
console.log("DOCS GATE: PASS — " + pass + " passed, 0 failed.");
console.log("  " + totalIds + " ledger ids across " + bySection.size + " sections; " +
  realTags.size + " annotated tag(s), " + pairs + " tag->commit pairing(s) checked.");
process.exit(0);
