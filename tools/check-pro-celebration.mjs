#!/usr/bin/env node
// Suite for the [2.0] Pro activation celebration + first-Pro tour.
// Asana 1217329431446433.
//
// The thing under test is a TRIGGER, and a trigger's failure modes are all
// "fired for the wrong person" or "fired twice". Both are unrecoverable in
// opposite directions: celebrating a purchase nobody made is embarrassing, and
// burning the one-time flag without showing anything means a real buyer paid and
// got nothing. So the matrix is walked against the REAL ProAccess and the REAL
// Storage setter loaded from source, not against a restatement of them.
//
// Usage: node tools/check-pro-celebration.mjs [repoRoot]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] || process.cwd();

let NT, PA, ST, CSS, HTML;
try {
  // core.autocrlf=true -> CRLF in the working tree; normalize before slicing or
  // every anchor below silently misses (BUGS.md M).
  const rd = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");
  NT = rd("newtab.js");
  PA = rd("pro-access.js");
  ST = rd("storage.js");
  CSS = rd("newtab.css");
  HTML = rd("newtab.html");
} catch (e) {
  console.error(`PRO CELEBRATION: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

// The real modules, in a VM with the minimum chrome.* they touch at load.
// UNPACKED is parameterised because the devPro override only exists when the
// build is unpacked, and that is precisely the exclusion under test.
function loadModules(unpacked) {
  const ctx = {
    chrome: {
      runtime: {
        // No update_url => IS_UNPACKED true. Supplying one makes it a store build.
        getManifest: () => (unpacked ? { version: "0.0.0" } : { version: "0.0.0", update_url: "https://clients2.google.com/service/update2/crx" }),
        id: "test",
      },
      storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } },
    },
    console: { log() {}, warn() {}, error() {} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, isFinite, isNaN,
    Promise, Set, Map, parseInt, parseFloat,
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(PA, ctx, { filename: "pro-access.js" });
  vm.runInContext(ST, ctx, { filename: "storage.js" });
  if (!ctx.ProAccess || typeof ctx.ProAccess.isRealProEntitlement !== "function") {
    throw new Error("ProAccess.isRealProEntitlement missing — is it exported?");
  }
  if (!ctx.Storage || typeof ctx.Storage.markProCelebrated !== "function") {
    throw new Error("Storage.markProCelebrated missing — is it exported?");
  }
  return ctx;
}

let U, S;
try {
  U = loadModules(true);    // unpacked: devPro override is live
  S = loadModules(false);   // store build: devPro override cannot exist
} catch (e) {
  console.error(`PRO CELEBRATION: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; } else { fail++; console.log(`  FAIL ${label}`); }
}
function eq(label, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) { pass++; } else { fail++; console.log(`  FAIL ${label}\n       got:  ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }
}

// The trigger, restated ONCE here as the composition the product performs:
// real entitlement AND the flag unset. Every row below goes through this.
const wouldFire = (ctx, d) => !(d && d.proCelebrated === true) && ctx.ProAccess.isRealProEntitlement(d);

const NOW = 1754800000000;
const paid = () => ({ pro: { subscriptionStatus: "active", licenseKey: "LP-REAL-KEY", lastVerifiedAt: NOW } });

console.log("TRIGGER MATRIX — who gets the moment");
eq("a real buyer, first open              -> FIRES", wouldFire(U, paid()), true);
eq("...same buyer, second open            -> silent",
  wouldFire(U, { ...paid(), proCelebrated: true }), false);
eq("TRIALING                              -> never",
  wouldFire(U, { pro: { subscriptionStatus: "trialing", trialStartedAt: NOW - 86400000, licenseKey: null } }), false);
// A trial that somehow carries a key is still a trial: status is what decides.
eq("trialing WITH a key present           -> never",
  wouldFire(U, { pro: { subscriptionStatus: "trialing", licenseKey: "LP-REAL-KEY" } }), false);
eq("FREE                                  -> never", wouldFire(U, { pro: { subscriptionStatus: "free", licenseKey: null } }), false);
eq("INVALID / revoked                     -> never", wouldFire(U, { pro: { subscriptionStatus: "invalid", licenseKey: "LP-REAL-KEY" } }), false);
eq("active status but NO key              -> never", wouldFire(U, { pro: { subscriptionStatus: "active", licenseKey: null } }), false);
eq("empty-string key                      -> never", wouldFire(U, { pro: { subscriptionStatus: "active", licenseKey: "" } }), false);
eq("no pro block at all                   -> never", wouldFire(U, {}), false);
eq("null data                             -> never", wouldFire(U, null), false);
// GRACE is a buyer whose verification went stale, not a non-buyer.
eq("GRACE (stale verification)            -> FIRES",
  wouldFire(U, { pro: { subscriptionStatus: "active", licenseKey: "LP-REAL-KEY", lastVerifiedAt: NOW - 40 * 86400000 } }), true);

console.log("DEVPRO OVERRIDE — the exclusion that needs the real module to prove");
const devOnly = { __devProOverride: true, pro: { subscriptionStatus: "free", licenseKey: null } };
// Premise: the override really does grant Pro in an unpacked build...
eq("premise: devPro DOES grant access level 'active'", U.ProAccess.getProAccessLevel(devOnly), "active");
// ...and the celebration still refuses it. Both halves matter: without the
// premise this row would pass even if the override had silently stopped working.
eq("devPro override                       -> never", wouldFire(U, devOnly), false);
eq("devPro override + trialing            -> never",
  wouldFire(U, { __devProOverride: true, pro: { subscriptionStatus: "trialing", licenseKey: null } }), false);
// A dev who ALSO has a real key is a real buyer; the override is irrelevant.
eq("devPro override + a REAL key          -> FIRES",
  wouldFire(U, { __devProOverride: true, ...paid() }), true);
// In a store build the override is inert, so the flag is just ignored data.
eq("store build: override is inert (level)", S.ProAccess.getProAccessLevel(devOnly), "free");
eq("store build: override                 -> never", wouldFire(S, devOnly), false);

console.log("THE FLAG — one-time, per-field, no-op guarded");
const d1 = paid();
eq("first mark reports a change", U.Storage.markProCelebrated(d1), true);
eq("...and sets the field", d1.proCelebrated, true);
eq("second mark is a NO-OP (no redundant save)", U.Storage.markProCelebrated(d1), false);
// Either dismissal calls the same setter, and the tour's exit calls it again —
// the no-op guard is what makes that double call free rather than a double write.
eq("third mark still a no-op", U.Storage.markProCelebrated(d1), false);
eq("the fired buyer is now silent", wouldFire(U, d1), false);
ok("mark touches ONLY the flag", (() => {
  const d = paid();
  const before = JSON.stringify(d.pro);
  U.Storage.markProCelebrated(d);
  return JSON.stringify(d.pro) === before && Object.keys(d).sort().join() === "pro,proCelebrated";
})());
eq("null data is safe", U.Storage.markProCelebrated(null), false);
// The flag must survive a licence clear, or clear+reapply replays the moment.
ok("flag SURVIVES clearLicense (once ever, not once per licence)", (() => {
  const d = paid();
  U.Storage.markProCelebrated(d);
  U.ProAccess.clearLicense(d);
  return d.proCelebrated === true;
})());
eq("...and a re-applied licence does NOT re-fire", (() => {
  const d = paid();
  U.Storage.markProCelebrated(d);
  U.ProAccess.clearLicense(d);
  d.pro.subscriptionStatus = "active";
  d.pro.licenseKey = "LP-REAL-KEY-2";
  return wouldFire(U, d);
})(), false);

console.log("DEV REPLAY — clears the flag, and only in an unpacked build");
const d2 = paid();
U.Storage.markProCelebrated(d2);
eq("clear reports a change", U.Storage.clearProCelebrated(d2), true);
eq("clearing re-arms the trigger", wouldFire(U, d2), true);
eq("clear on an unset flag is a no-op", U.Storage.clearProCelebrated(paid()), false);
ok("the replay hook is IS_UNPACKED-gated in source", (() => {
  // It must live inside the same `if (!chrome.runtime.getManifest().update_url)`
  // block as LP.devPro, or it ships to real users.
  const i = NT.indexOf("if (!chrome.runtime.getManifest().update_url) {");
  if (i === -1) return false;
  const j = NT.indexOf("\n  }\n", i);
  const block = NT.slice(i, j);
  return block.includes("LP.replayProCelebration") && block.includes("LP.devPro");
})());

console.log("ARBITRATION — the celebration owns the render, nothing is consumed");
function initBlock() {
  const i = NT.indexOf("[2.0] Pro activation celebration. FIRST");
  if (i === -1) throw new Error("celebration call site not found in init");
  return NT.slice(i, i + 2000);
}
const IB = initBlock();
ok("the celebration is decided BEFORE the other surfaces",
  IB.indexOf("maybeShowProCelebration") < IB.indexOf("checkRightClickTip"));
ok("right-click tip is guarded", /if \(!isProOnboardingBusy\(\)\) checkRightClickTip\(\)/.test(IB));
ok("achievements splash is guarded", /if \(!isProOnboardingBusy\(\)\) runAchievementsOnOpen\(\)/.test(IB));
ok("promo toast is guarded INSIDE its timeout (re-checked at fire time)",
  /setTimeout\(function \(\) \{\s*if \(isProOnboardingBusy\(\)\) return;\s*checkPromoToast\(\);/.test(IB));
// The guards must be at the CALL SITES. If one migrated inside the callee it
// would consume the surface before suppressing it: the promo scheduler
// increments openCount and writes lastPromoOpen at the moment it decides, and
// the badge splash persists its dequeue before painting.
function body(name) {
  let s = NT.indexOf(`  function ${name}(`);
  if (s === -1) s = NT.indexOf(`  async function ${name}(`);
  if (s === -1) throw new Error(`${name} not found`);
  return NT.slice(s, NT.indexOf("\n  }\n", s));
}
ok("checkPromoToast itself is untouched", !body("checkPromoToast").includes("ProOnboardingBusy"));
ok("runAchievementsOnOpen itself is untouched", !body("runAchievementsOnOpen").includes("ProOnboardingBusy"));
ok("checkRightClickTip itself is untouched", !body("checkRightClickTip").includes("ProOnboardingBusy"));
ok("a throw in the celebration cannot mute the others",
  /catch[\s\S]{0,200}proOnboardingBusy = false/.test(IB));

console.log("TOUR — four anchored steps, every exit completes");
const stepsSrc = NT.slice(NT.indexOf("var PRO_TOUR_STEPS = ["), NT.indexOf("];", NT.indexOf("var PRO_TOUR_STEPS = [")));
for (const sel of ['data-tab="tasks"', 'data-tab="dashboard"', 'data-tab="insights"', "#active-task-pill"]) {
  ok(`step anchored to ${sel}`, stepsSrc.includes(sel));
}
eq("exactly four steps", (stepsSrc.match(/\{ sel:/g) || []).length, 4);
// Every anchor must actually exist in the shipped markup, or a step points at
// nothing. This is the check that catches a renamed tab or a moved pill.
for (const sel of ['data-tab="tasks"', 'data-tab="dashboard"', 'data-tab="insights"', 'id="active-task-pill"']) {
  ok(`anchor ${sel} exists in newtab.html`, HTML.includes(sel));
}
const tour = body("endProTour");
ok("endProTour sets completion", tour.includes("setProCelebrated"));
ok("endProTour releases the arbitration lock", /proOnboardingBusy = false/.test(tour));
ok("endProTour unbinds BOTH drift listeners",
  tour.includes('removeEventListener("resize"') && tour.includes('removeEventListener("scroll"'));
ok("endProTour clears the anchor ring", tour.includes("clearProTourRing"));
const start = body("startProTour");
ok("tour repositions rather than drift-closing (resize)", start.includes('addEventListener("resize"'));
ok("...and on scroll too", start.includes('addEventListener("scroll"'));
ok("Escape exits the tour", /Escape[\s\S]{0,80}endProTour/.test(start));
const render = body("renderProTourStep");
ok("Skip on every step but the last", render.includes("data-pro-tour-skip"));
ok("Done on the last step", /last \? "Done" : "Next"/.test(render));
ok("an off-screen anchor is skipped, not pointed at", render.includes("isTourAnchorVisible"));
// offsetParent is null for EVERY position:fixed element, and #active-task-pill is
// fixed — so an offsetParent-based visibility test silently drops the pill step
// and the tour of four becomes a tour of three. Found at runtime; pinned here.
ok("anchor visibility is measured by RECT, not offsetParent",
  !body("isTourAnchorVisible").includes("offsetParent") &&
  body("isTourAnchorVisible").includes("getBoundingClientRect"));
// The ring must MOVE between steps, not accumulate.
ok("each step clears the previous anchor ring", render.includes("clearProTourRing"));
ok("clearProTourRing removes the class from ALL ringed nodes",
  /querySelectorAll\("\.pro-tour-target"\)/.test(body("clearProTourRing")));
const cel = body("showProCelebration");
ok("Escape exits the celebration", /Escape[\s\S]{0,80}teardown/.test(cel));
ok("both buttons exist", cel.includes("data-pro-celebrate-tour") && cel.includes("data-pro-celebrate-skip"));
ok("both dismissals set the flag (single teardown path)",
  (cel.match(/setProCelebrated\(\)/g) || []).length >= 1 && cel.includes("teardown(true)") && cel.includes("teardown(false)"));
ok("the burst is SKIPPED, not stilled, under reduced motion",
  /if \(!prefersReducedMotion\(\)\) burst = startProBurst/.test(cel));
const bur = body("startProBurst");
ok("burst settles well under 2s", /DURATION = 1[0-4]\d\d/.test(bur));
ok("burst uses no external asset or library", !/fetch\(|import\(|src\s*=|new Audio/.test(bur));
ok("burst clamps dt (a backgrounded tab must not teleport particles)", /Math\.min\(\(ts - prev\) \/ 1000/.test(bur));
ok("burst removes its own canvas", /removeChild\(canvas\)/.test(bur));

console.log("INK — every new text class, three branches (O1; JS-rendered)");
// Comments are stripped first. The prose below the coach-mark rules EXPLAINS why
// there is deliberately no bg-light background flip, and a naive scan reads that
// explanation as the very rule it denies. Assert on declarations, not on prose.
const CSSC = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
// The card sits on the FLOATER tier, which flips to white glass on a light
// wallpaper, so each of its text classes needs the light correction.
for (const cls of ["pro-celebrate-title", "pro-celebrate-desc", "pro-celebrate-eyebrow"]) {
  ok(`${cls} declares a colour`, new RegExp(`\\.${cls}\\s*\\{[^}]*color`).test(CSSC));
  ok(`${cls} has a light-wallpaper correction`,
    new RegExp(`html\\.has-bg\\.bg-light[^{]*\\.${cls}\\s*\\{[^}]*color`).test(CSSC));
}
ok("the card declares base ink", /\.pro-celebrate-card\s*\{[^}]*color:\s*#fff/.test(CSSC));
ok("...and corrects it on a light wallpaper", /html\.has-bg\.bg-light\s+\.pro-celebrate-card\s*\{[^}]*color/.test(CSSC));
// The coach mark deliberately does NOT flip: it uses the MENU tier, which has no
// bg-light override, so it stays dark on every wallpaper and its white ink is
// wallpaper-independent. Assert the absence, so a future "consistency" edit that
// adds a white background there has to argue with this line.
ok("coach mark uses the menu tier", /\.pro-tour-mark\s*\{[^}]*--pro-frost-menu-bg/.test(CSSC));
ok("coach mark declares white ink", /\.pro-tour-mark\s*\{[^}]*color:\s*#fff/.test(CSSC));
ok("coach mark has NO light-wallpaper background flip (deliberate)",
  !/html\.(has-bg\.)?bg-light[^{]*\.pro-tour-mark\s*\{[^}]*background/.test(CSSC));
ok("the menu tier still has no bg-light override (the premise for the above)",
  !/html\.bg-light\s*\{[^}]*--pro-frost-menu-bg/.test(CSSC));
ok("coach-mark text and count declare colours",
  /\.pro-tour-text\s*\{[^}]*color/.test(CSSC) && /\.pro-tour-count\s*\{[^}]*color/.test(CSSC));
ok("reduced motion covers the card, glow and mark",
  (() => {
    const i = CSSC.indexOf("@media (prefers-reduced-motion: reduce)", CSSC.indexOf(".pro-celebrate"));
    const blk = CSSC.slice(CSSC.lastIndexOf("@media (prefers-reduced-motion: reduce)", CSSC.indexOf(".pro-tour-mark") + 20000), CSSC.length);
    return /\.pro-celebrate-card\s*\{[^}]*transition:\s*none/.test(blk) &&
           /\.pro-celebrate-glow\s*\{[^}]*animation:\s*none/.test(blk) &&
           /\.pro-tour-mark\s*\{[^}]*transition:\s*none/.test(blk);
  })());
// Stacking: the card must sit above the badge splash it can collide with.
const zCel = (CSSC.match(/\.pro-celebrate\s*\{[\s\S]*?z-index:\s*(\d+)/) || [])[1];
const zMark = (CSSC.match(/\.pro-tour-mark\s*\{[\s\S]*?z-index:\s*(\d+)/) || [])[1];
ok(`celebration (z ${zCel}) sits above the badge splash (z 9000)`, Number(zCel) > 9000);
ok(`coach mark (z ${zMark}) sits above the celebration`, Number(zMark) > Number(zCel));

// ---------------------------------------------------------------------------
// PROMO ROTATION — added 2026-08-14 with the Buy-Me-a-Coffee retirement.
//
// This suite already owns the promo toast's ARBITRATION (above), so it owns the
// rotation's CADENCE too rather than opening a fourteenth gate for it. Three
// things are asserted, and each of them fails silently in the product:
//
//   1. The coffee surfaces are ABSENT. A tip jar beside a live subscription is
//      the thing the removal exists to prevent, and it comes back the easy way:
//      a merge, a revert, a copy-paste of the sidebar row.
//   2. The remaining cadence is the one we chose (3, then every 40) and not the
//      one that falls out of deleting a branch (3, then every 20 — DOUBLE the
//      nag, arriving as a side effect nobody decided).
//   3. Legacy promoState parses. Real users carry `lastPromo: "coffee"` and the
//      pre-promoState keys; the failure mode is a reset rating history or a
//      throw inside an init-time async function, neither of which is visible.
//
// The cadence rows run the REAL checkPromoToast in a VM against a fake
// chrome.storage.local that round-trips through JSON, the way the real one does.
console.log("PROMO — the coffee surfaces are gone");
ok("no Buy Me a Coffee URL in newtab.js", !NT.includes("buymeacoffee"));
ok("no Buy Me a Coffee URL in newtab.html", !HTML.includes("buymeacoffee"));
ok("no #sb-bmc entry in the sidebar markup", !HTML.includes("sb-bmc"));
ok("no #sb-bmc rules left in the stylesheet", !CSS.includes("sb-bmc"));
ok("no coffee cup glyph in the toast", !NT.includes("\\u2615") && !NT.includes("☕"));
ok("no 'coffee' promo type is ever assigned", !/showType|lastPromo\s*=/.test(NT.slice(NT.indexOf("async function checkPromoToast("), NT.indexOf("async function checkPromoToast(") + 3000)));
ok("the support-the-dev line is gone", !NT.includes("Support the dev"));
// The inverse: the RATING ask must still be here. Without these rows the four
// above would pass just as well if someone deleted the whole promo system.
// Matches the KEY. [1.5.0] R3 moved this copy into the catalogue, so asserting
// on the words would now test where the English lives rather than whether the
// rating ask still exists. The anti-vacuity purpose is unchanged: if someone
// deleted the promo system, this key would go with it.
ok("the rating toast copy survives", NT.includes("promo_enjoying_launchpad_leave_a_quick_rating"));
ok("the rating toast links to the real store listing",
  NT.includes("https://chromewebstore.google.com/detail/launchpad-new-tab-shortcu/jfmmagapjdionoomkjmkfppcplkjilnp"));
ok("the sidebar Rate entry survives", HTML.includes('id="sb-rate"'));
// It shipped pointing at a literal placeholder; fixed alongside the removal.
ok("...and its href is a real listing, not a placeholder",
  !HTML.includes("EXTENSION_ID_HERE") &&
  /id="sb-rate"[^>]*href="https:\/\/chromewebstore\.google\.com\/detail\/launchpad-new-tab-shortcu\/jfmmagapjdionoomkjmkfppcplkjilnp"/.test(
    HTML.replace(/(<a )([^>]*?)(id="sb-rate")/g, "$1$3 $2")));

console.log("PROMO CADENCE — the rating ask, alone (real function, faked storage)");
// Slice the constants through the end of checkPromoToast and run it for real.
const promoSrc = (() => {
  const i = NT.indexOf("var PROMO_FIRST_OPEN =");
  if (i === -1) throw new Error("PROMO_FIRST_OPEN not found");
  const f = NT.indexOf("async function checkPromoToast(", i);
  if (f === -1) throw new Error("checkPromoToast not found after the constants");
  return NT.slice(i, NT.indexOf("\n  }\n", f)) + "\n  }\n";
})();

// Drives n consecutive new-tab opens against a seeded storage. Returns the open
// ordinals on which the toast fired, plus the storage as it finally stands.
async function opens(n, seed) {
  const store = JSON.parse(JSON.stringify(seed || {}));
  const shows = [];
  let at = 0;
  const ctx = {
    // JSON round-trip on both sides: chrome.storage serializes, so a test that
    // hands back live object references would prove less than the product does.
    chrome: { storage: { local: {
      get: (keys) => {
        const o = {};
        for (const k of keys) if (k in store) o[k] = JSON.parse(JSON.stringify(store[k]));
        return Promise.resolve(o);
      },
      set: (obj) => { Object.assign(store, JSON.parse(JSON.stringify(obj))); return Promise.resolve(); },
      remove: (keys) => { for (const k of keys) delete store[k]; return Promise.resolve(); },
    } } },
    showPromoToast: () => { shows.push(at); },
    JSON, Object, Promise, Array, Number, String, Boolean,
    console: { log() {}, warn() {}, error() {} },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(promoSrc + "\nglobalThis.__run = checkPromoToast;", ctx, { filename: "promo.js" });
  for (at = 1; at <= n; at++) await ctx.__run();
  return { shows, store };
}

const fresh = await opens(200, {});
eq("fresh install, 200 opens -> asks at 3 then every 40", fresh.shows, [3, 43, 83, 123, 163]);
eq("...and the count is the plain open count", fresh.store.promoState.openCount, 200);
eq("...and lastPromoOpen holds the last ask", fresh.store.promoState.lastPromoOpen, 163);
// The interval is the DECISION, not an artifact of deleting the coffee branch:
// had the old 20 survived, the first re-ask would land on open 23.
ok("the re-ask interval is 40, not the pair's 20", !fresh.shows.includes(23));
ok("nothing fires before the third open", fresh.shows[0] === 3);

console.log("PROMO MIGRATION — legacy state parses, history is not reset");
// A long-standing user mid-rotation, carrying the retired field.
const legacy = await opens(60, { promoState: { openCount: 30, lastPromo: "coffee", lastPromoOpen: 28 } });
eq("legacy promoState: history is carried, not reset", legacy.store.promoState.openCount, 90);
eq("...next ask honours the stored lastPromoOpen (28 + 40 = 68)", legacy.shows, [38]);
eq("...the retired lastPromo field rides through UNTOUCHED", legacy.store.promoState.lastPromo, "coffee");
ok("...and nothing new writes it", legacy.store.promoState.lastPromoOpen === 68);
// A user whose last promo WAS the coffee toast is not owed a rating ask sooner
// or later than anyone else; the field naming it simply stops deciding.
const legacyRate = await opens(60, { promoState: { openCount: 30, lastPromo: "rate", lastPromoOpen: 28 } });
eq("...identical schedule whichever toast fired last", legacyRate.shows, legacy.shows);

// The pre-promoState keys. bmcToastDismissed is retired as a WRITE but still
// honoured as a READ: it means "already prompted once".
const old = await opens(41, { tabOpenCount: 7, bmcToastDismissed: true });
eq("pre-promoState keys migrate without a reset", old.store.promoState.openCount, 48);
eq("...an old BMC dismissal still suppresses (no ask on the next open)", old.shows, [40]);
ok("...and the legacy keys are removed from storage",
  !("tabOpenCount" in old.store) && !("bmcToastDismissed" in old.store) && !("rateToastDismissed" in old.store));
ok("...no coffee field is written by the migration", !("lastPromo" in old.store.promoState));
const oldRate = await opens(41, { tabOpenCount: 7, rateToastDismissed: true });
eq("...a rate dismissal migrates the same way", oldRate.shows, old.shows);
// tabOpenCount with NO dismissal is the dead end the coffee leg used to cover:
// under exact-equality this user would never be asked again.
const orphan = await opens(3, { tabOpenCount: 40 });
eq("a never-asked legacy user is asked, not stranded forever", orphan.shows, [1]);
// Shapes that should not throw inside an init-time async function.
eq("empty promoState object is safe", (await opens(4, { promoState: {} })).shows, [3]);
eq("promoState with only openCount is safe", (await opens(2, { promoState: { openCount: 1 } })).shows, [2]);
eq("a null-ish stored state is safe", (await opens(3, { promoState: null })).shows, [3]);

console.log(`\nPRO CELEBRATION: ${fail ? "FAIL" : "PASS"} — ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
