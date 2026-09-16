#!/usr/bin/env node
// ===========================================================================
// MUTATION BOOT CHECK — can every mutation runner still boot its own subject?
//
// WHY THIS EXISTS (Asana 1218320168124333). A mutation runner materialises the
// subject into a scratch directory and re-runs itself against it. Every one of
// them carried a HAND-WRITTEN list of files to write, separate from the list its
// loader reads, and nothing compared the two. A file split therefore invalidated
// the runner silently: the materialised subject was missing a file, the re-run
// could not boot, and the pass stopped proving anything.
//
// That is not a hypothesis. When this file was written, FOUR of the four
// materialising runners were dead:
//   check-chip-ink        tokens.css never written        dead since 1987469
//   check-text-size       tokens.css never written        dead since 1987469
//   check-today-cockpit   tokens.css + i18n.js + en.js    dead since 1987469
//   check-pill-clarity    tokens.css + i18n.js + en.js    dead since 977b108
// check-today-cockpit had already been found broken and fixed ONCE before, which
// is the argument for a standing check rather than a third manual repair.
//
// WHY IT WENT UNNOTICED FOR SO LONG is worth stating, because it is the real
// lesson. build.sh runs these gates WITHOUT --mutate, so the gates stayed green
// and nothing pointed at the seeding pass. Worse, two of the runners scored
// their own boot failure as a PASSING CONTROL: the "an unloadable subject exits
// 2" control read the exit 2 that came from the missing file and reported OK.
// An instrument that cannot boot will happily report that it is healthy.
//
// WHAT THIS CHECKS, and what it deliberately does not. It runs each runner's
// --boot-check, which materialises the CLEAN subject and reports only whether it
// runs. One child process per runner, not one per seed, so it is cheap enough to
// sit in build.sh. It does NOT run the seeds: whether a seed still BITES is a
// different question, answered by the full --mutate pass, and paying for that on
// every build would guarantee it gets skipped.
//
// DISCOVERY, NOT A LIST. The runners are found by scanning tools/ rather than
// enumerated here. Writing the list by hand would reproduce, in the checker for
// the hardcoded-enumeration class, exactly the hardcoded enumeration it exists
// to catch - a new mutation runner would simply never be checked.
//
// THIS FILE IS THE GATE ABOUT GATES, and it now carries three sections. They
// are here together because they answer the same question in three forms - does
// the suite still have teeth? - and because a claim about the gates belongs
// next to the other claims about the gates rather than in a fourth file nobody
// wires in, which is precisely the defect section 3 exists to catch.
//
//   1. BOOT      can every --mutate runner still load its own subject?
//   2. ANCHORING can a gate's CSS assertion silently drift to a scoped rule?
//   3. WIRING    is every tools/check-*.mjs actually run by build.sh, and does
//                every gate build.sh names exist? (Asana 1218551512094479)
//
// Usage:  node tools/check-mutation-boot.mjs [repoRoot]
// Exit 0 = every runner boots. 1 = at least one is dead, or the scan is unsound.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
const toolsDir = path.join(repoRoot, "tools");

console.log("\nMUTATION BOOT CHECK — every runner must be able to load its own subject\n");

const files = fs.readdirSync(toolsDir).filter((f) => f.startsWith("check-") && f.endsWith(".mjs"));

// A runner is anything that offers --mutate. Of those, the ones that
// MATERIALISE a subject to disk are the ones with a boot risk; the in-process
// ones build their subject in memory and cannot lose a file to a split.
const runners = [];
for (const f of files) {
  if (f === "check-mutation-boot.mjs") continue;
  const src = fs.readFileSync(path.join(toolsDir, f), "utf8");
  if (!/--mutate/.test(src)) continue;
  runners.push({
    file: f,
    materialises: /function materialize\s*\(/.test(src),
    hasBootCheck: /--boot-check/.test(src),
  });
}

let dead = 0, unsound = 0, booted = 0, inProcess = 0;

// ANTI-VACUITY. A scan that finds nothing passes, loudly and wrongly. These two
// rows are the difference between "every runner boots" and "I looked for
// runners, found none, and said nothing was broken".
if (!files.length) {
  console.log("  UNSOUND  tools/ contained no check-*.mjs at all — the scan is not looking where it thinks");
  process.exit(1);
}
if (!runners.length) {
  console.log(`  UNSOUND  scanned ${files.length} gate(s) and found no --mutate runner — either they were all`);
  console.log("           removed, or the token this scan matches on has been renamed");
  process.exit(1);
}

for (const r of runners) {
  if (!r.materialises) {
    inProcess++;
    console.log(`  n/a  ${r.file.padEnd(30)} in-process runner — builds its subject in memory, no boot risk`);
    continue;
  }
  if (!r.hasBootCheck) {
    unsound++;
    console.log(`  UNSOUND  ${r.file.padEnd(26)} materialises a subject but offers no --boot-check.`);
    console.log("           It cannot be verified here, so it can die the way the others did.");
    continue;
  }
  const res = spawnSync(process.execPath, [path.join(toolsDir, r.file), repoRoot, "--boot-check"], { encoding: "utf8" });
  const out = res.stdout || "";
  const say = out.split("\n").filter((l) => /BOOT-CHECK (OK|DEAD)/.test(l)).join(" ").trim();

  // THE MARKER IS REQUIRED, and this is not belt-and-braces. A runner that
  // IGNORES --boot-check falls through to its ordinary gate run and exits 0 -
  // indistinguishable, by exit code alone, from one that materialised a subject
  // and watched it boot. Trusting the code would mean this checker reports
  // health it never observed, which is precisely the failure it was built to
  // end. Measured: a mutant that disabled one runner's flag handling escaped
  // this check until the marker was required.
  if (!/BOOT-CHECK (OK|DEAD)/.test(out)) {
    unsound++;
    console.log(`  UNSOUND  ${r.file.padEnd(26)} did not answer --boot-check (exit ${res.status}).`);
    console.log("           It printed no BOOT-CHECK line, so it either ignored the flag or");
    console.log("           never reached its materialise path — either way nothing was proven.");
    continue;
  }
  if (res.status === 0) {
    booted++;
    console.log(`  OK   ${r.file.padEnd(30)} boots`);
  } else {
    dead++;
    console.log(`  DEAD ${r.file.padEnd(30)} ${say || "exit " + res.status}`);
    for (const line of out.split("\n").filter((l) => /^\s{5,}/.test(l)).slice(0, 4)) {
      console.log("       " + line.trim());
    }
  }
}

const verdict = dead || unsound ? "FAIL" : "PASS";
// ===== UNANCHORED CSS ASSERTIONS ==========================================
//
// A gate regex that opens on ".foo {" is not anchored to the rule it names.
// [^}]* cannot cross a brace, but a FAILED match on the base rule simply
// advances the engine to the next place that substring occurs - and
// "html.has-bg.bg-light .foo {" contains it. So the assertion silently
// re-targets the light-wallpaper override and reports the base rule as present
// when it is gone.
//
// DEMONSTRATED rather than reasoned about (Asana 1218048949825387): deleting
// .tt-progress-pct-base's colour and leaving its override in place produced
// CHIP INK: PASS - 79 passed, 0 failed. The gate was green about a declaration
// that did not exist.
//
// This runs here because this file is already the gate-about-gates. It
// ENFORCES from zero: the 14 instances were anchored in the same commit, so
// there is no backlog and no reason for a report-only mode.
//
// The anchor is [\n}]\s* before the selector. A top-level rule is preceded by
// a newline or the close brace above it; a descendant selector has a SPACE
// before the class, which is neither. Assertions that are DELIBERATELY scoped
// (/html\.has-bg\.bg-light \.dash-greeting \{/) and those already anchored
// with ^ or \n are untouched - an earlier pass anchored all 33 occurrences
// rather than these 14 and turned 16 assertions red, which is how the
// distinction was learned.
let unanchored = 0;
try {
  const cssPath = path.join(repoRoot, "newtab.css");
  const css = fs.readFileSync(cssPath, "utf8").replace(/\r\n/g, "\n");
  const LITERAL = /\/((?:[^/\\\n]|\\.)+)\/[gimsuy]*/g;
  const UNANCHORED = /^\\\.([A-Za-z][\w-]*)(?:[^{]*?)\\\{/;
  for (const f of files) {
    if (f === "check-mutation-boot.mjs") continue;
    const src = fs.readFileSync(path.join(toolsDir, f), "utf8");
    let m;
    LITERAL.lastIndex = 0;
    while ((m = LITERAL.exec(src))) {
      const body = m[1];
      if (!body.includes("\\{")) continue;
      const u = UNANCHORED.exec(body);
      if (!u) continue;
      // does the class it names have a LONGER selector twin in the sheet?
      const twin = new RegExp("^[^\\n{]*\\." + u[1] + "\\s*\\{", "m");
      const all = css.match(new RegExp("^[^\\n{]*\\." + u[1] + "\\s*\\{", "gm")) || [];
      const longer = all.filter((s) => s.trim() !== "." + u[1] + " {" &&
                                       s.trim() !== "." + u[1] + "{");
      if (!longer.length) continue;
      unanchored++;
      console.log(`  UNANCHORED  ${f}`);
      console.log(`              /${body.slice(0, 58)}.../`);
      console.log(`              can drift to  ${longer[0].trim()}`);
    }
  }
  if (!unanchored) console.log("  OK   no gate assertion can drift to a scoped rule");
} catch (e) {
  console.log("  UNSOUND  the unanchored-assertion scan did not run: " + e.message);
  unsound++;
}

// ===== THE RUNNER LIST \u2014 is every gate actually WIRED INTO build.sh? ======
//
// THE FAILURE: a gate can be written, committed, and left out of build.sh's
// runner list, and nothing notices. It looks like a gate, it passes when run by
// hand, and it gates nothing. Green by nobody.
//
// THE INSTANCE: 250cb05 shipped check-sync-slice.mjs with 33 assertions about
// what leaves the machine over chrome.storage.sync, and never added it here. It
// sat unrun for a full round; 11989c4 found it while extending that same gate.
//
// FOURTH INSTANCE OF ONE CLASS - a thing only a build reads, that no build
// read. importers.js and quickadd.js were both missing from the packaging
// ALLOWLIST; side-panel.html was declared by a manifest key the shared reader
// did not know; this one is the RUNNER list, which is why none of the three
// earlier fixes covered it. Each of those was fixed by adding the missing entry,
// and none of them made the next instance impossible, because the answer always
// arrived from a build rather than from a check. This is the check.
//
// IT RUNS HERE because this file is already the gate-about-gates, and presence
// in the runner list is the same kind of claim as "the runner can still boot".
// It costs one directory read and one file read.
//
// WHAT IT CANNOT SEE, stated so nobody reads more into a green than is there:
// a gate that IS wired in, runs, and asserts NOTHING. A file of zero assertions
// exits 0 and passes this check. That is the P2 anti-vacuity floors' job, and
// they do it per gate, from inside. THIS IS ONLY ABOUT PRESENCE.
//
// BOTH DIRECTIONS, because each catches a different mistake: a gate on disk and
// not in build.sh is a gate nobody runs; a gate in build.sh and not on disk is
// a build that dies at the shell on a rename.
//
// THE PARSER MUST NOT MATCH COMMENTS, and that is not hypothetical - build.sh
// names tools/check-html-refs.mjs inside a comment today. A parser that counted
// that would let a gate be "wired" by being mentioned, which is the exact
// failure in a more embarrassing form. Comments are stripped first.
//
// The parser's failure mode is deliberately the loud one: if the invocation
// regex ever stops matching, the parsed set empties and EVERY gate reports
// unwired, rather than every gate silently passing.
let unwired = 0, phantom = 0;
try {
  const shPath = path.join(repoRoot, "build.sh");
  const sh = fs.readFileSync(shPath, "utf8").replace(/\r\n/g, "\n");
  // A `#` at line start or after whitespace opens a shell comment. None of the
  // gate invocations contain one, so this cannot eat a real line.
  const code = sh.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "$1")).join("\n");
  const INVOKE = /\bnode\s+(?:--[\w=.-]+\s+)*tools\/([\w.-]+\.mjs)/g;
  const invoked = new Set();
  let inv;
  while ((inv = INVOKE.exec(code))) invoked.add(inv[1]);

  if (!invoked.size) {
    unsound++;
    console.log("  UNSOUND  build.sh invokes no tools/*.mjs at all \u2014 either every gate was removed,");
    console.log("           or the invocation pattern this scan matches on has changed shape");
  } else if (!files.some((f) => invoked.has(f))) {
    // Anti-vacuity with teeth: the parse must yield names that are really on
    // disk. A regex returning plausible-looking rubbish would otherwise report
    // a full runner list made of files that do not exist.
    unsound++;
    console.log(`  UNSOUND  build.sh's ${invoked.size} invocation(s) name no gate that exists in tools/ \u2014`);
    console.log("           the parse is producing names, but not the names of real files");
  } else {
    for (const f of files) {
      if (invoked.has(f)) continue;
      unwired++;
      console.log(`  UNWIRED  tools/${f}`);
      console.log(`           exists and is never run by build.sh. Add it to the runner list, or`);
      console.log(`           delete it \u2014 a gate nobody runs is worse than no gate, because the`);
      console.log(`           suite's count says it is covered.`);
    }
    for (const f of invoked) {
      if (fs.existsSync(path.join(toolsDir, f))) continue;
      phantom++;
      console.log(`  PHANTOM  build.sh runs tools/${f}, which does not exist`);
      console.log(`           The build would die at the shell. A rename that missed build.sh.`);
    }
    if (!unwired && !phantom) {
      console.log(`  OK   all ${files.length} gate(s) are wired into build.sh, and all ` +
        `${invoked.size} invocation(s) resolve`);
    }
  }
} catch (e) {
  console.log("  UNSOUND  the build.sh runner-list scan did not run: " + e.message);
  unsound++;
}

const finalVerdict = (dead || unsound || unanchored || unwired || phantom) ? "FAIL" : verdict;
console.log(`\nMUTATION BOOT: ${finalVerdict} \u2014 ${booted} runner(s) boot, ${dead} dead, ` +
  `${unsound} unsound, ${inProcess} in-process (of ${runners.length} with --mutate, ${files.length} gates scanned), ` +
  `${unanchored} unanchored CSS assertion(s), ${unwired} unwired gate(s), ${phantom} phantom invocation(s)\n`);
process.exit(dead || unsound || unanchored || unwired || phantom ? 1 : 0);
