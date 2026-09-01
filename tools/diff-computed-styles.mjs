import fs from "node:fs";

const A = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const B = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const LABEL = process.argv[4] || "diff";

// ANTI-VACUITY (BUGS.md P13). "0 property diffs" is only evidence if there were
// elements to compare. A run where the Pro surfaces failed to render produced an
// intersection of ZERO and this tool cheerfully reported success. The intersection
// must therefore cover most of BOTH snapshots before any pass is believed.
const MIN_INTERSECTION_RATIO = 0.9;
let vacuous = false;

let anyProp = 0;
for (const branch of ["dark", "light"]) {
  const a = A[branch], b = B[branch];
  const ka = new Set(Object.keys(a)), kb = new Set(Object.keys(b));
  const both = [...ka].filter((k) => kb.has(k));
  const onlyA = [...ka].filter((k) => !kb.has(k));
  const onlyB = [...kb].filter((k) => !ka.has(k));

  // PROPERTY DIFF over the intersection. This is the measurement that matters:
  // element presence varies run to run because the page renders async content
  // (history, favicons), but a token addition can only change PROPERTIES of
  // elements that exist in both runs.
  const changed = [];
  for (const k of both) {
    for (const p of Object.keys(a[k])) {
      if (a[k][p] !== b[k][p]) changed.push({ k, p, a: a[k][p], b: b[k][p] });
    }
  }
  anyProp += changed.length;
  console.log(`\n[${LABEL}] ${branch.toUpperCase()}`);
  console.log(`  elements: A=${ka.size} B=${kb.size} intersection=${both.length}`);
  console.log(`  present only in A: ${onlyA.length}   only in B: ${onlyB.length}   (async-render noise)`);
  console.log(`  PROPERTY DIFFS over the intersection: ${changed.length}`);
  for (const c of changed.slice(0, 25)) {
    console.log(`    ${c.p}  "${c.a}" -> "${c.b}"`);
    console.log(`      at ${c.k.slice(-140)}`);
  }
  if (changed.length > 25) console.log(`    ... and ${changed.length - 25} more`);

  const ratio = both.length / Math.max(ka.size, kb.size, 1);
  if (ratio < MIN_INTERSECTION_RATIO) {
    vacuous = true;
    console.log(`  *** VACUOUS: intersection is ${(ratio * 100).toFixed(0)}% of the larger snapshot ` +
      `(floor ${MIN_INTERSECTION_RATIO * 100}%). The two runs describe DIFFERENT PAGES, so a zero ` +
      `property diff proves nothing. Usually the Pro surfaces did not render in one of them.`);
  }
}
console.log(`\n[${LABEL}] TOTAL property diffs across both branches: ${anyProp}`);
if (vacuous) {
  console.log(`[${LABEL}] RESULT: NOT EVIDENCE — see the VACUOUS note above.`);
  process.exit(2);
}
console.log(`[${LABEL}] RESULT: ${anyProp === 0 ? "zero computed change, over a valid intersection" : "CHANGED"}`);
process.exit(anyProp === 0 ? 0 : 1);
