#!/usr/bin/env node
// Suite for the Pro Settings inline license status line (QA 2026-08-10,
// Asana 1217318316893989).
//
// The point of this file is ONE distinction: a licence that Dodo rejected must
// read differently from a licence we simply could not ask about. The toast this
// line replaces collapsed both into whatever string came back, so a dropped
// connection could tell a paying user their licence was dead. That is a copy bug
// with a state-machine cause, so the test drives the SHIPPED copy function
// against the REAL LicenseClient loaded from license.js — the same joined-seam
// discipline as check-trial-copy.mjs. A mapper that handles 'network' correctly
// is worthless if ensureValidated never actually emits it under that name.
//
// Usage: node tools/check-license-line.mjs [repoRoot]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] || process.cwd();

let NT, LC;
try {
  // core.autocrlf=true -> CRLF in the working tree; normalize before slicing
  // or every anchor below silently misses (BUGS.md M).
  NT = fs.readFileSync(path.join(repoRoot, "newtab.js"), "utf8").replace(/\r\n/g, "\n");
  LC = fs.readFileSync(path.join(repoRoot, "license.js"), "utf8").replace(/\r\n/g, "\n");
} catch (e) {
  console.error(`LICENSE LINE: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

function extract(src, name, label) {
  // Handlers here are `async function`, renderers are plain — accept either, or
  // the suite reports a missing subject when the subject is merely awaited.
  let start = src.indexOf(`  function ${name}(`);
  if (start === -1) start = src.indexOf(`  async function ${name}(`);
  if (start === -1) throw new Error(`function ${name}() not found in ${label}`);
  const end = src.indexOf("\n  }\n", start);
  if (end === -1) throw new Error(`could not find the end of ${name}() in ${label}`);
  return src.slice(start, end + 4);
}

// The real LicenseClient, in a VM with the minimum it touches at load.
function loadLicenseClient() {
  const ctx = {
    chrome: { runtime: { getManifest: () => ({ version: "0.0.0" }) } },
    console: { log() {}, warn() {}, error() {} },
    fetch: () => Promise.reject(new Error("no network in the harness")),
    Date, Math, JSON, Object, Array, String, Number, Boolean, Promise,
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(LC, ctx, { filename: "license.js" });
  if (!ctx.LicenseClient || typeof ctx.LicenseClient.isTransientError !== "function") {
    throw new Error("LicenseClient.isTransientError missing — is it exported?");
  }
  return ctx.LicenseClient;
}

// DAY_MS_LOCAL comes from the source, never hand-copied: if someone redefines a
// day, this suite must move with it rather than quietly disagreeing.
function extractDayMs() {
  const m = NT.match(/var\s+DAY_MS_LOCAL\s*=\s*([0-9*\s]+);/);
  if (!m) throw new Error("could not find DAY_MS_LOCAL in newtab.js");
  const value = Function(`"use strict"; return (${m[1]});`)();
  if (!Number.isFinite(value) || value <= 0) throw new Error(`DAY_MS_LOCAL parsed as ${value}`);
  return value;
}

let LicenseClient, DAY_MS, statusLine;
try {
  LicenseClient = loadLicenseClient();
  DAY_MS = extractDayMs();
  const ctx = {
    LicenseClient,
    DAY_MS_LOCAL: DAY_MS,
    Math, Date, String, Number, Boolean, Object,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(extract(NT, "licenseStatusLine", "newtab.js"), ctx, { filename: "newtab.js" });
  if (typeof ctx.licenseStatusLine !== "function") throw new Error("licenseStatusLine did not define");
  statusLine = ctx.licenseStatusLine;
} catch (e) {
  console.error(`LICENSE LINE: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

let pass = 0, fail = 0;
const NOW = 1754800000000;   // fixed clock; Date.now() is never called by the mapper

function check(label, got, want) {
  const ok = got === want;
  if (ok) { pass++; } else { fail++; console.log(`  FAIL ${label}\n       got:  ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }
}
function tone(label, result, pro, wantTone) {
  check(label + " [tone]", statusLine(result, pro, NOW).tone, wantTone);
}
function textHas(label, result, pro, needle) {
  const got = statusLine(result, pro, NOW).text;
  const ok = got.includes(needle);
  if (ok) { pass++; } else { fail++; console.log(`  FAIL ${label}\n       text: ${JSON.stringify(got)}\n       must contain: ${JSON.stringify(needle)}`); }
}
function textLacks(label, result, pro, needle) {
  const got = statusLine(result, pro, NOW).text;
  const ok = !got.toLowerCase().includes(needle.toLowerCase());
  if (ok) { pass++; } else { fail++; console.log(`  FAIL ${label}\n       text: ${JSON.stringify(got)}\n       must NOT contain: ${JSON.stringify(needle)}`); }
}

const activePro = (ageDays) => ({ subscriptionStatus: "active", lastVerifiedAt: NOW - ageDays * DAY_MS, licenseKey: "K" });
const invalidPro = (ageDays) => ({ subscriptionStatus: "invalid", lastVerifiedAt: NOW - ageDays * DAY_MS, licenseKey: "K" });

console.log("STATE 1 — checking (in flight)");
tone("checking", { checking: true }, activePro(0), "idle");
check("checking text", statusLine({ checking: true }, activePro(0), NOW).text, "Checking...");
// The in-flight line must not leak the previous verdict alongside itself.
textLacks("checking says nothing about validity", { checking: true }, invalidPro(0), "not valid");

console.log("STATE 2 — fresh success");
tone("ok + active", { ok: true }, activePro(0), "ok");
textHas("says active", { ok: true }, activePro(0), "License active");
textHas("says JUST NOW, not a date", { ok: true }, activePro(0), "verified just now");

console.log("STATE 3 — fresh definite rejection");
tone("ok-response + invalid", { ok: true }, invalidPro(0), "bad");
textHas("honest rejection", { ok: true }, invalidPro(0), "not valid");
textLacks("no false 'active'", { ok: true }, invalidPro(0), "License active");

console.log("STATE 4 — NETWORK / TRANSIENT: never a verdict (the whole point)");
for (const err of ["network", "http_5xx", "unknown"]) {
  // Guard the premise: these are the codes license.js itself calls transient.
  check(`license.js agrees '${err}' is transient`, LicenseClient.isTransientError(err), true);
  // Worst case: the stored status is ACTIVE and the network died. Must not
  // report a verdict, and must not claim a fresh success either.
  tone(`${err} (was active)`, { ok: false, error: err }, activePro(2), "warn");
  textHas(`${err} says unreachable`, { ok: false, error: err }, activePro(2), "Could not reach the license server");
  textLacks(`${err} never says invalid`, { ok: false, error: err }, activePro(2), "not valid");
  textLacks(`${err} never says verified`, { ok: false, error: err }, activePro(2), "verified just now");
}

console.log("STATE 5 — our own fault: the check never left the building");
for (const err of ["invalid_args", "module_missing", "threw"]) {
  check(`license.js does NOT call '${err}' transient`, LicenseClient.isTransientError(err), false);
  tone(`${err}`, { ok: false, error: err }, activePro(1), "warn");
  textHas(`${err} blames neither side`, { ok: false, error: err }, activePro(1), "Could not run the check");
  textLacks(`${err} never says invalid`, { ok: false, error: err }, activePro(1), "not valid");
}

console.log("STATE 6 — definitive rejection carries Dodo's own reason");
const limitErr = { ok: false, error: "activation_limit_reached", message: "Activation limit reached." };
tone("dodo error + status flipped to invalid", limitErr, invalidPro(0), "bad");
textHas("passes Dodo's message through", limitErr, invalidPro(0), "Activation limit reached.");

console.log("STATE 7 — THE HONEST DEFAULT: unrecognised error, status NOT flipped");
// A future/unknown non-transient code arriving while the state machine did NOT
// flip to invalid means we do not actually have a verdict. Must degrade to the
// non-verdict, not to an accusation. This is the inverse of the checkout-return
// bug (optimistic default); here the dangerous default would be pessimistic.
const futureErr = { ok: false, error: "some_future_code_2027", message: "Whatever this is." };
check("premise: not transient", LicenseClient.isTransientError("some_future_code_2027"), false);
tone("unknown code, still active", futureErr, activePro(1), "warn");
textLacks("does not libel a good licence", futureErr, activePro(1), "not valid");
textLacks("does not parrot an unexplained message", futureErr, activePro(1), "Whatever this is.");
// ...but the SAME code WITH the flip is trusted, because the state machine spoke.
tone("unknown code, status flipped", futureErr, invalidPro(0), "bad");

console.log("STATE 8 — idle render on panel open (the relocated 'Last verified')");
tone("idle active", null, activePro(0), "ok");
check("today", statusLine(null, activePro(0), NOW).text, "License active — last verified today.");
check("1 day", statusLine(null, activePro(1), NOW).text, "License active — last verified 1 day ago.");
check("5 days", statusLine(null, activePro(5), NOW).text, "License active — last verified 5 days ago.");
// Singular/plural boundary, the class of bug check-trial-copy was written for.
check("2 days plural", statusLine(null, activePro(2), NOW).text, "License active — last verified 2 days ago.");
check("never verified", statusLine(null, { subscriptionStatus: "active", licenseKey: "K" }, NOW).text,
  "License active — last verified never.");
tone("idle invalid", null, invalidPro(3), "bad");
textHas("idle invalid is dated too", null, invalidPro(3), "last checked 3 days ago");
tone("idle, never checked", null, { licenseKey: "K" }, "idle");
check("never-checked copy", statusLine(null, { licenseKey: "K" }, NOW).text, "Not checked yet.");

console.log("STATE 9 — defensive shapes");
tone("null pro", null, null, "idle");
tone("empty pro", null, {}, "idle");
// A fractional day must not render as "0 days ago".
textLacks("no bare '0 days'", null, { subscriptionStatus: "active", lastVerifiedAt: NOW - Math.floor(DAY_MS * 0.4), licenseKey: "K" }, "0 days");
// No branch may ever emit NaN or undefined.
for (const [lbl, r, p] of [
  ["idle active", null, activePro(0)], ["fresh ok", { ok: true }, activePro(0)],
  ["transient", { ok: false, error: "network" }, activePro(0)],
  ["ourfault", { ok: false, error: "threw" }, activePro(0)],
  ["checking", { checking: true }, activePro(0)],
  ["idle never", null, { licenseKey: "K" }],
]) {
  const out = statusLine(r, p, NOW);
  const clean = typeof out.text === "string" && out.text.length > 0 &&
    !/NaN|undefined|null/.test(out.text) && ["ok", "bad", "warn", "idle"].includes(out.tone);
  if (clean) { pass++; } else { fail++; console.log(`  FAIL no-garbage ${lbl}: ${JSON.stringify(out)}`); }
}

console.log("STRUCTURAL — the wiring the copy depends on");
function structural(label, cond) {
  if (cond) { pass++; } else { fail++; console.log(`  FAIL structural: ${label}`); }
}
structural("the status <p> exists in newtab.html", (() => {
  const html = fs.readFileSync(path.join(repoRoot, "newtab.html"), "utf8");
  return html.includes('id="pro-license-check-status"');
})());
structural("it is announced (role=status)", (() => {
  const html = fs.readFileSync(path.join(repoRoot, "newtab.html"), "utf8");
  const i = html.indexOf('id="pro-license-check-status"');
  return i !== -1 && /role="status"/.test(html.slice(i, i + 200));
})());
structural("handleLicenseCheckNow fires NO toast any more",
  !/showToast/.test(extract(NT, "handleLicenseCheckNow", "newtab.js")));
structural("handleLicenseCheckNow renders the inline line",
  /renderProLicenseCheckStatus/.test(extract(NT, "handleLicenseCheckNow", "newtab.js")));
structural("the button no longer swaps its own label (one indicator)",
  !/btn\.textContent\s*=/.test(extract(NT, "handleLicenseCheckNow", "newtab.js")));
structural("the button is still disabled while in flight",
  /btn\.disabled\s*=\s*true/.test(extract(NT, "handleLicenseCheckNow", "newtab.js")));
// Comment lines are stripped first: the relocation is DOCUMENTED in that
// function ("'Last verified' used to render here"), and a naive substring test
// reads the explanation as the offence. Test what renders, not what is discussed.
function codeOnly(src) {
  return src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
}
structural("'Last verified' is GONE from the subscription section (one fact, one home)",
  !/Last verified/.test(codeOnly(extract(NT, "renderProSubscriptionSection", "newtab.js"))));
// Matches the KEY, not the copy. [1.5.0] R3 moved every user-visible string in
// this function into the catalogue, so asserting on the words tests where the
// English lives rather than where the warning renders. The structural fact -
// the grace warning is emitted by THIS section - is now expressed by the key
// its call site names, which is exactly as strong and does not move when copy
// is edited.
structural("the grace warning stayed in the subscription section",
  /pro_verification_overdue/.test(extract(NT, "renderProSubscriptionSection", "newtab.js")));
structural("'Last verified' now appears in the status line instead",
  /last verified/.test(extract(NT, "licenseStatusLine", "newtab.js")));
structural("the line is gated on the same predicate as the button",
  /shouldShowLicenseControls/.test(extract(NT, "renderProLicenseCheckStatus", "newtab.js")));
structural("other actions keep their toasts (handleLicenseClear untouched)",
  /showToast/.test(extract(NT, "handleLicenseClear", "newtab.js")));
// Every tone the mapper can emit must have a CSS rule in ALL THREE branches,
// or it renders as inherited dark ink on the dark frosted panel (the O1 trap).
const CSS = fs.readFileSync(path.join(repoRoot, "newtab.css"), "utf8");
for (const t of ["ok", "bad", "warn"]) {
  structural(`tone '${t}' has a base colour`, new RegExp(`\\.pro-license-check-${t}\\s*\\{[^}]*color`).test(CSS));
  structural(`tone '${t}' has an html.has-bg colour`, new RegExp(`html\\.has-bg\\s+[^{]*pro-license-check-${t}\\s*\\{[^}]*color`).test(CSS));
  structural(`tone '${t}' has a light-wallpaper colour`, new RegExp(`html\\.has-bg\\.bg-light\\s+[^{]*pro-license-check-${t}\\s*\\{[^}]*color`).test(CSS));
}
structural("the idle/base line declares a colour (never inherits body ink)",
  /\.pro-license-check-status\s*\{[^}]*color/.test(CSS));
structural("...and overrides it on a dark wallpaper",
  /html\.has-bg\s+\.pro-license-check-status\s*\{[^}]*color/.test(CSS));
structural("...and again on a light wallpaper",
  /html\.has-bg\.bg-light\s+\.pro-license-check-status\s*\{[^}]*color/.test(CSS));

console.log(`\nLICENSE LINE: ${fail ? "FAIL" : "PASS"} — ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
