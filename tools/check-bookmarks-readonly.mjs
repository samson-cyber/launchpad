#!/usr/bin/env node
// ===========================================================================
// [1.11.1 B9] THE BOOKMARK TREE IS READ-ONLY, AND THIS ASSERTS IT.
//
// LaunchPad holds the `bookmarks` permission so the importer can READ the tree,
// and [1.11.1] added a panel that browses it live. Holding a permission for
// reading does not license writing: a user's bookmark tree belongs to the
// browser and to them, and a launcher that silently created, moved or deleted
// bookmarks would be a far worse defect than any it could fix. That is a
// PRODUCT RULE, so it gets a gate rather than a comment.
//
// WHAT MAKES THIS MORE THAN A GREP. The panel subscribes to change events by
// DYNAMIC access - chrome.bookmarks[name].addListener, over an array of event
// names - so a naive scan for `chrome.bookmarks.create` would miss a write
// smuggled in the same shape. This gate therefore checks two things: no write
// member appears by static access, and every dynamic access resolves to a name
// on an explicit allow-list.
//
// P2: the inspection set has a floor and every pattern is self-tested against a
// fixture it must catch, because a scan that silently matches nothing passes
// forever and reads exactly like a scan that looked and found nothing.
//
// Exit codes: 0 ok · 1 violations · 2 gate broken.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Every script that ships inside the zip. Deliberately explicit: a glob would
// silently pick up tools/ and .scratch/ and quietly start passing for the wrong
// reason if the repo layout moved.
const SHIPPED = [
  "newtab.js", "bookmarks.js", "background.js", "storage.js",
  "i18n.js", "i18n-dom.js", "locales/en.js", "license.js",
  "pro-access.js", "tracking.js", "gate.js", "offscreen.js"
];

// chrome.bookmarks members that MUTATE. From the MV3 API surface.
const WRITE_MEMBERS = ["create", "remove", "removeTree", "move", "update"];
// Members the product is allowed to touch: the reads, and the four change events.
const ALLOWED_MEMBERS = [
  "get", "getChildren", "getRecent", "getSubTree", "getTree", "search",
  "onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered",
  "onImportBegan", "onImportEnded"
];

let fail = 0, pass = 0;
const problems = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "  [" + detail + "]" : "")); problems.push(name); }
}

// Strip comments so the doc-comment on the panel - which NAMES the write members
// in order to say it never calls them - is not reported as the violation.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const STATIC_WRITE = new RegExp("chrome\\s*\\.\\s*bookmarks\\s*\\.\\s*(" + WRITE_MEMBERS.join("|") + ")\\b");
const ANY_STATIC = /chrome\s*\.\s*bookmarks\s*\.\s*([A-Za-z_$][\w$]*)/g;
const ANY_DYNAMIC = /chrome\s*\.\s*bookmarks\s*\[([^\]]*)\]/g;

console.log("BOOKMARKS READ-ONLY GATE");
console.log("");

// ---- 0. the inspection set is real ---------------------------------------
const sources = [];
for (const rel of SHIPPED) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.error("  gate broken: missing " + rel); process.exit(2); }
  sources.push({ rel, code: stripComments(fs.readFileSync(abs, "utf8")) });
}
const touching = sources.filter((s) => /chrome\s*\.\s*bookmarks/.test(s.code));
check("the scan found the files that actually touch chrome.bookmarks",
  touching.length >= 2, touching.map((s) => s.rel).join(", ") || "none");

// ---- 1. no write member by static access ---------------------------------
for (const s of sources) {
  const m = s.code.match(STATIC_WRITE);
  check("no bookmarks write API in " + s.rel, !m, m ? m[0] : undefined);
}

// ---- 2. every static member is on the allow-list -------------------------
for (const s of touching) {
  const used = new Set();
  let m;
  ANY_STATIC.lastIndex = 0;
  while ((m = ANY_STATIC.exec(s.code))) used.add(m[1]);
  const bad = [...used].filter((n) => !ALLOWED_MEMBERS.includes(n));
  check("every chrome.bookmarks member used in " + s.rel + " is a read or an event",
    bad.length === 0, bad.join(", ") || [...used].join(", "));
}

// ---- 3. dynamic access resolves only to allowed names --------------------
// The panel does chrome.bookmarks[BM_EVENTS[i]].addListener over a literal
// array. Assert that array's contents rather than trusting the shape.
for (const s of touching) {
  let m, ok = true, seen = [];
  ANY_DYNAMIC.lastIndex = 0;
  while ((m = ANY_DYNAMIC.exec(s.code))) {
    const expr = m[1].trim();
    seen.push(expr);
    // Accept an inline string literal, or an identifier indexed from a literal
    // array declared in the same file whose every entry is allow-listed.
    const lit = expr.match(/^["']([\w$]+)["']$/);
    if (lit) { if (!ALLOWED_MEMBERS.includes(lit[1])) ok = false; continue; }
    const viaArray = expr.match(/^([A-Za-z_$][\w$]*)\s*\[/);
    if (viaArray) {
      const decl = new RegExp("(?:var|let|const)\\s+" + viaArray[1] + "\\s*=\\s*\\[([^\\]]*)\\]").exec(s.code);
      if (!decl) { ok = false; continue; }
      const names = decl[1].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      if (!names.length || !names.every((n) => ALLOWED_MEMBERS.includes(n))) ok = false;
      continue;
    }
    ok = false;   // an expression this gate cannot resolve is not a pass
  }
  check("every DYNAMIC chrome.bookmarks[...] access in " + s.rel + " resolves to a read or an event",
    ok, seen.join(" | ") || "none");
}

// ---- 4. SELF-TEST. Each pattern must catch a fixture it is meant to catch.
const FIXTURES = [
  { name: "a plain create is caught", src: 'chrome.bookmarks.create({title:"x"});', pat: STATIC_WRITE, want: true },
  { name: "a spaced remove is caught", src: 'chrome . bookmarks . remove ( id );', pat: STATIC_WRITE, want: true },
  { name: "removeTree is caught", src: "chrome.bookmarks.removeTree(id);", pat: STATIC_WRITE, want: true },
  { name: "a read is NOT caught", src: "chrome.bookmarks.getTree();", pat: STATIC_WRITE, want: false }
];
for (const f of FIXTURES) {
  check("self-test: " + f.name, f.pat.test(f.src) === f.want);
}
// and the dynamic resolver must reject a smuggled write
{
  const smuggled = 'var EVTS = ["onCreated", "create"]; chrome.bookmarks[EVTS[0]].addListener(x);';
  const decl = /(?:var|let|const)\s+EVTS\s*=\s*\[([^\]]*)\]/.exec(smuggled);
  const names = decl[1].split(",").map((x) => x.trim().replace(/^["']|["']$/g, ""));
  check("self-test: a write smuggled into the event-name array is rejected",
    !names.every((n) => ALLOWED_MEMBERS.includes(n)));
}
// and comment-stripping must not blind the scan to real code
check("self-test: stripping comments does not hide a real call",
  STATIC_WRITE.test(stripComments('/* never calls chrome.bookmarks.create */\nchrome.bookmarks.create(x);')));
check("self-test: a write named only INSIDE a comment is not reported",
  !STATIC_WRITE.test(stripComments("/* it never calls chrome.bookmarks.create */\nvar a = 1;")));

console.log("");
if (fail) {
  console.log("BOOKMARKS READ-ONLY: FAIL — " + pass + " passed, " + fail + " failed.");
  console.log("  " + problems.join("\n  "));
  process.exit(1);
}
console.log("BOOKMARKS READ-ONLY: PASS — " + pass + " passed, 0 failed.");
process.exit(0);
