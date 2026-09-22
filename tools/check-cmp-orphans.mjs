#!/usr/bin/env node
// ===========================================================================
// CHECK-CMP-ORPHANS — every .cmp- class the companion EMITS has a rule, and
// every rule it DEFINES has an emitter.
//
// WHY THIS IS A GATE. H4.0 re-applied H2c's wholesale restyle of companion.css
// onto a tree that had grown four new surfaces under it, and the two drifts a
// restyle always produces are invisible to every other check:
//
//   EMITTED WITH NO RULE   the markup still renders, just unstyled. No error,
//                          no warning, and a frame only shows it if you happen
//                          to drive that state.
//   RULED WITH NO EMITTER  dead CSS that the next reader has to reason about,
//                          and that a token sweep then has to chase.
//
// Its first run found a real one: .cmp-actions-route, whose emitter had become
// H2c's .cmp-link. Nothing else in the build would have said so. Ruling 13.
//
// COMMENTS ARE STRIPPED FROM BOTH SIDES FIRST, and that is not tidiness. A
// class name inside a comment is invisible to a sweep for that name, and
// equally makes a clean file look dirty — both directions cost H4.0 an
// assertion each (BUGS.md M5). companion.css carries two comments naming
// --sat-accent precisely to warn against it, and one naming .cmp-btn-primary to
// record its retirement; an unstripped scan reads all three as live.
//
// WHAT IS DELIBERATELY NOT A FAILURE:
//
//   HOOKS ON .cmp-tile. The companion emits `cmp-tile cmp-controls`,
//   `cmp-tile cmp-empty`, `cmp-tile cmp-locked` and so on, where the second
//   class is a hook for the JS and a name for the reader, and ALL the styling
//   comes from .cmp-tile. Those are listed, not failed. The allowlist below is
//   explicit so a NEW orphan cannot hide among them.
//
//   THE ROOT CLASSES. .cmp-panel, .cmp-popup and .cmp-root are set in
//   side-panel.html and companion.html, not by companion.js, so a scan of the
//   JS alone calls them dead. The HTML is read too, for exactly that reason —
//   the first version of this sweep reported all three as dead rules.
//
//   CONCATENATED CLASSES. `'cmp-due-group cmp-due-group--' + g.kind` is built
//   at runtime, so a static scan sees the prefix `cmp-due-group--` and never
//   the whole name. Prefixes that end in `--` are matched against rules by
//   prefix, and the rule side reports which concrete names exist.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const REPO = path.resolve(HERE, "..");
const R = (f) => fs.readFileSync(path.join(REPO, f), "utf8");

let fails = 0;
const check = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? "   " + detail : ""}`);
};

// ---------------------------------------------------------------- sources
const JS_FILES = ["companion.js", "companion-popup.js", "side-panel.js"];
const HTML_FILES = ["companion.html", "side-panel.html"];
const CSS_FILE = "companion.css";

const stripJs = (s) => s.replace(/(?<![:"'`])\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const stripCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

const js = stripJs(JS_FILES.map(R).join("\n"));
const html = HTML_FILES.map(R).join("\n");
const css = stripCss(R(CSS_FILE));

// ---------------------------------------------------------------- emitted
const emitted = new Set();
// class="..." in both the JS template strings and the two documents
for (const src of [js, html]) {
  for (const m of src.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].matchAll(/cmp-[a-z0-9-]+/g)) emitted.add(c[0]);
  }
}
// A class added through a ternary arrives as a bare quoted string:
//   '<span class="cmp-glyph' + (st.paused ? " cmp-glyph-paused" : "") + '">'
for (const m of js.matchAll(/["'`]\s*(cmp-[a-z0-9-]+)\s*["'`]/g)) emitted.add(m[1]);
// classList.add / toggle / remove
for (const m of js.matchAll(/classList\.\w+\(\s*["'`](cmp-[a-z0-9-]+)/g)) emitted.add(m[1]);

// ---------------------------------------------------------------- defined
const defined = new Set();
for (const m of css.matchAll(/\.(cmp-[a-z0-9-]+)/g)) defined.add(m[1]);

// ---------------------------------------------------------------- rules
// Hooks whose styling comes from .cmp-tile. Explicit, so a new orphan cannot
// hide among them.
const TILE_HOOKS = new Set([
  "cmp-controls", "cmp-due-empty", "cmp-empty", "cmp-locked",
  "cmp-metric", "cmp-metric-hero",
]);

const isPrefix = (c) => c.endsWith("--");
const prefixHasRule = (p) => [...defined].some((d) => d.startsWith(p) && d.length > p.length);

const orphans = [];
for (const c of [...emitted].sort()) {
  if (defined.has(c)) continue;
  if (isPrefix(c) && prefixHasRule(c)) continue;      // concatenated, rule exists
  if (TILE_HOOKS.has(c)) continue;                    // styled by .cmp-tile
  orphans.push(c);
}

const dead = [];
for (const d of [...defined].sort()) {
  if (emitted.has(d)) continue;
  // a concrete name whose emitter is a runtime concatenation
  if ([...emitted].some((e) => isPrefix(e) && d.startsWith(e))) continue;
  dead.push(d);
}

console.log("CHECK-CMP-ORPHANS");
console.log(`  companion emits ${emitted.size} .cmp- classes; companion.css defines ${defined.size}`);
console.log(`  tile hooks exempt (styled by .cmp-tile): ${[...TILE_HOOKS].join(", ")}`);

check("every emitted .cmp- class has a rule", orphans.length === 0,
  orphans.length ? "EMITTED WITH NO RULE: " + orphans.join(", ") : "");
check("every .cmp- rule has an emitter", dead.length === 0,
  dead.length ? "RULED WITH NO EMITTER: " + dead.join(", ") : "");

// ANTI-VACUITY. A scan that read nothing passes both rows above, which is the
// failure mode this repo has met often enough to write down.
check("anti-vacuity: the sources were actually read",
  emitted.size > 30 && defined.size > 30, `emitted=${emitted.size} defined=${defined.size}`);
check("anti-vacuity: the HTML root classes were seen (they are not in the JS)",
  ["cmp-panel", "cmp-popup", "cmp-root"].every((c) => emitted.has(c)),
  "a JS-only scan reports all three as dead rules");
check("anti-vacuity: comments were stripped (--sat-accent survives only in prose)",
  !/var\(\s*--sat-accent/.test(css), "a live --sat-accent would resolve to nothing here");

console.log(fails ? `\nCHECK-CMP-ORPHANS: ${fails} FAILED` : "\nCHECK-CMP-ORPHANS: all clear");
process.exit(fails ? 1 : 0);
