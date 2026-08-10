#!/usr/bin/env node
// Suite for the two QA fixes of 2026-08-10 (Asana 1217318316893989):
//   1. the trial popover's countdown headline, and
//   2. the condition that decides whether the license controls render at all.
//
// Both are one-line-looking things that are wrong in exactly one state, which
// is the state the user is in and the developer usually is not: a plural
// boundary nobody sees until day six, and a red "Clear license" button offered
// to someone who has no license. They are pure functions on purpose so this
// file can walk every branch instead of hoping.
//
// It extracts the SHIPPED function bodies out of newtab.js (never a hand-copy)
// and, for the headline, drives them with the REAL ProAccess.trialDaysRemaining
// loaded from pro-access.js — so the two halves of the boundary (what the clock
// says, and how the copy renders it) are tested joined, the way they ship.
//
// Usage: node tools/check-trial-copy.mjs [repoRoot]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] || process.cwd();
const DAY_MS = 86400000;

let NT, PA;
try {
  // core.autocrlf=true -> CRLF in the working tree; normalize before slicing
  // or every anchor below silently misses (BUGS.md M).
  NT = fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8").replace(/\r\n/g, "\n");
  PA = fs.readFileSync(path.join(repoRoot, "pro-access.js"), "utf8").replace(/\r\n/g, "\n");
} catch (e) {
  console.error(`TRIAL COPY: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

function extract(src, name, label) {
  const start = src.indexOf(`  function ${name}(`);
  if (start === -1) throw new Error(`function ${name}() not found in ${label}`);
  const end = src.indexOf("\n  }\n", start);
  if (end === -1) throw new Error(`could not find the end of ${name}() in ${label}`);
  return src.slice(start, end + 4);
}

// The real ProAccess, in a VM with the minimum chrome.* it touches at load.
function loadProAccess() {
  const ctx = {
    chrome: { runtime: { getManifest: () => ({ version: "0.0.0" }) } },
    console: { log() {}, warn() {}, error() {} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, isFinite, isNaN,
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(PA, ctx, { filename: "pro-access.js" });
  if (!ctx.ProAccess || typeof ctx.ProAccess.trialDaysRemaining !== "function") {
    throw new Error("ProAccess.trialDaysRemaining missing");
  }
  return ctx.ProAccess;
}

let headline, showControls, ProAccess;
try {
  ProAccess = loadProAccess();
  headline = new Function(extract(NT, "trialPopoverHeadline", "newtab.js") + "\n  return trialPopoverHeadline;")();
  showControls = new Function(extract(NT, "shouldShowLicenseControls", "newtab.js") + "\n  return shouldShowLicenseControls;")();
  if (typeof headline("x") !== "string") throw new Error("trialPopoverHeadline did not return a string");
} catch (e) {
  console.error(`TRIAL COPY: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

const rows = [];
const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail });

// ---- the headline, branch by branch ---------------------------------------
check("7 days -> plural", headline(7) === "7 days left in your trial", headline(7));
check("2 days -> plural", headline(2) === "2 days left in your trial", headline(2));
check("1 day  -> SINGULAR (the boundary nobody sees until day six)",
  headline(1) === "1 day left in your trial", headline(1));
check("0      -> 'Trial ends today', not '0 days left'",
  headline(0) === "Trial ends today", headline(0));
check("negative -> 'Trial ends today' (clock shift / hand-edited record)",
  headline(-3) === "Trial ends today", headline(-3));
check("NaN -> 'Trial ends today' rather than 'NaN days left'",
  headline(NaN) === "Trial ends today", headline(NaN));
check("no headline ever renders a bare '0 days'",
  ![0, -1, NaN].some((n) => /0 days|NaN/.test(headline(n))));

// ---- joined to the REAL clock ---------------------------------------------
// trialDaysRemaining collapses the final 24h to 0, so "ends today" is reachable
// and the copy above has something to render. Assert the seam rather than the
// two sides separately: a formatter that handles 0 is worthless if the clock
// can never produce one.
const trialing = (startedDaysAgo) => ({
  pro: { subscriptionStatus: "trialing", trialStartedAt: Date.now() - startedDaysAgo * DAY_MS },
});
{
  const fresh = ProAccess.trialDaysRemaining(trialing(0));
  check("REAL CLOCK: a trial started just now reads 7 days", fresh === 7, `n=${fresh}`);
  check("REAL CLOCK: ...and renders the plural headline",
    headline(fresh) === "7 days left in your trial", headline(fresh));

  const day6 = ProAccess.trialDaysRemaining(trialing(5.5));
  check("REAL CLOCK: 5.5 days in reads 2 days", day6 === 2, `n=${day6}`);

  const lastDay = ProAccess.trialDaysRemaining(trialing(6.5));
  check("REAL CLOCK: inside the final 24h collapses to 0", lastDay === 0, `n=${lastDay}`);
  check("REAL CLOCK: ...and renders 'Trial ends today'",
    headline(lastDay) === "Trial ends today", headline(lastDay));

  const over = ProAccess.trialDaysRemaining(trialing(9));
  check("REAL CLOCK: an expired trial clamps at 0, never negative", over === 0, `n=${over}`);
}

// ---- the license-controls condition ---------------------------------------
check("a stored key SHOWS the controls",
  showControls({ pro: { licenseKey: "LP-REAL-KEY" } }) === true);
check("a TRIALING user (no key) HIDES them — the QA finding",
  showControls({ pro: { subscriptionStatus: "trialing", trialStartedAt: Date.now() } }) === false);
check("a free user with no pro block hides them", showControls({}) === false);
check("null data hides them and does not throw", showControls(null) === false);
check("an EMPTY-STRING key counts as no key",
  showControls({ pro: { licenseKey: "" } }) === false);
check("the predicate returns a real boolean, not a truthy key string",
  showControls({ pro: { licenseKey: "LP-REAL-KEY" } }) === true &&
  typeof showControls({ pro: { licenseKey: "LP-REAL-KEY" } }) === "boolean");

// ---- structural: the markup the render toggles must still exist ------------
{
  const html = fs.readFileSync(path.join(repoRoot, "newtab.html"), "utf8");
  check("newtab.html still carries #pro-license-clear-row for the toggle to find",
    html.includes('id="pro-license-clear-row"'));
  check("newtab.js still toggles that row", NT.includes('$("#pro-license-clear-row")'));
  // The entry row must NOT be gated — it is how the empty state is escaped.
  check("the key ENTRY row is never gated on having a key",
    !/pro-license-input-row[\s\S]{0,200}shouldShowLicenseControls/.test(NT));
}

// ---- structural: no "Start free trial" button in the trial variant ---------
// The trial block is suppressed by (trialUsed || !trialCtaLive()), and a user
// mid-trial has trialStartedAt set. Assert the condition is still that one,
// rather than trusting a comment.
check("the trial block is still gated on trialUsed (so a mid-trial user gets no 'Start free trial')",
  /var trialBlock = \(trialUsed \|\| !trialCtaLive\(\)\) \? "" :/.test(NT));

let pass = 0, fail = 0;
console.log("\nTRIAL COPY — countdown headline + license-control gating\n");
for (const r of rows) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
  r.pass ? pass++ : fail++;
}
// Anti-vacuity floor (BUGS.md P2).
const MIN = 20;
if (rows.length < MIN) {
  console.log(`\nTRIAL COPY: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
console.log(`\nTRIAL COPY: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
