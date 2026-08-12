#!/usr/bin/env node
// Suite for the [2.0] Text size setting (Settings > Appearance). Asana 1214275087201909.
//
// Three tiers over one token ramp. What can go wrong here is not subtle-looking
// but it IS silent:
//
//   - SMALL STOPS BEING TODAY'S SIZING. Small's entire contract is that a user
//     who prefers density loses nothing by choosing it. One wrong value in the
//     small block breaks that, and nothing anywhere throws — the page just
//     renders a size nobody asked for. The proof is structural: a token is named
//     after its own small value, so `--fs-11` must be `11px` under
//     `text-size-small`. That invariant is asserted token by token.
//   - A NEW LITERAL font-size SLIPS IN. A rule added later as `font-size: 12px`
//     is frozen at 12px on every tier — the setting silently stops covering part
//     of the product. Every declaration in the sheet is checked.
//   - THE RAMP INVERTS. Bumping a secondary size past an untouched one puts
//     small text above body text at Large. The ordering is asserted across all
//     three tiers, including against the 16px literals the ramp must not pass.
//   - A JUNK STORED VALUE REACHES classList. The reader coerces; that is why the
//     reader lives in storage.js and is driven here from the real module.
//
// Storage is loaded from the REAL storage.js in a Node VM against a fake
// chrome.storage.local; applyTextSize is executed from its REAL source against a
// fake documentElement. The CSS ramp and the wiring are asserted against
// newtab.css / newtab.js / newtab.html source, every anchor occurrence-counted
// per Q2.
//
// Usage: node tools/check-text-size.mjs [repoRoot] [--mutate] [--table]
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
const MUTATE = process.argv.includes("--mutate");
const TABLE = process.argv.includes("--table");
const clone = (v) => JSON.parse(JSON.stringify(v));

// core.autocrlf=true -> CRLF in the working tree; normalize before slicing.
const rd = (f) => fs.readFileSync(path.join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");

let SRC;
try {
  SRC = { storage: rd("storage.js"), nt: rd("newtab.js"), css: rd("newtab.css"), html: rd("newtab.html") };
} catch (e) {
  console.error(`TEXT SIZE: SUBJECT DID NOT LOAD — ${e.message}`);
  process.exit(2);
}

// The locked ramp (Samson, 2026-08-11). Restated here ON PURPOSE: this is the
// spec side of the assertion, and a suite that reads the table out of the sheet
// it is checking would agree with any sheet at all.
const LOCKED = [
  ["--fs-8",    8,    9,    10],
  ["--fs-9",    9,    10,   11],
  ["--fs-10",   10,   11,   12],
  ["--fs-11",   11,   12,   13],
  ["--fs-11-5", 11.5, 12.5, 13.5],
  ["--fs-12",   12,   13,   14],
  ["--fs-12-5", 12.5, 13.5, 14.5],
  ["--fs-13",   13,   14,   15],
  ["--fs-13-5", 13.5, 14.5, 15.5],
  ["--fs-14",   14,   15,   16],
  ["--fs-15",   15,   15,   16],
];
// The lowest font-size the ramp does NOT touch. Nothing may be bumped past it.
const UNTOUCHED_FLOOR = 16;

function extractFn(src, name) {
  const anchor = `\n  function ${name}(`;
  const first = src.indexOf(anchor);
  if (first === -1) throw new Error(`anchor miss: ${name} not found`);
  if (src.indexOf(anchor, first + 1) !== -1) throw new Error(`anchor ambiguous: ${name}`);
  const end = src.indexOf("\n  }\n", first);
  if (end === -1) throw new Error(`anchor unterminated: ${name}`);
  return src.slice(first, end + 4);
}

// Pull one declaration block out of the sheet by an anchor that must match
// exactly once, and parse its --fs-* declarations.
function tokenBlock(css, anchor) {
  const first = css.indexOf(anchor);
  if (first === -1) throw new Error(`css anchor miss: ${anchor}`);
  if (css.indexOf(anchor, first + 1) !== -1) throw new Error(`css anchor ambiguous: ${anchor}`);
  const end = css.indexOf("\n}", first);
  if (end === -1) throw new Error(`css anchor unterminated: ${anchor}`);
  const body = css.slice(first, end);
  const out = {};
  for (const m of body.matchAll(/(--fs-[0-9-]+):\s*([0-9.]+)px;/g)) out[m[1]] = parseFloat(m[2]);
  return out;
}

// ---------------------------------------------------------------------------
// Boot the real subjects.
// ---------------------------------------------------------------------------
function boot(src) {
  const store = {};
  const ctx = {
    chrome: {
      storage: {
        local: {
          async get(k) { if (typeof k === "string") { const o = {}; if (k in store) o[k] = clone(store[k]); return o; } return clone(store); },
          async set(o) { for (const [k, v] of Object.entries(o)) store[k] = clone(v); },
          async remove(k) { delete store[k]; },
        },
        onChanged: { addListener() {} },
      },
      runtime: { lastError: null, getManifest: () => ({ version: "0.0.0" }) },
    },
    console: { log() {}, warn() {}, error() {} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, Promise, Set, Map,
    isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src.storage, ctx, { filename: "storage.js" });

  // applyTextSize from its REAL source, against a documentElement that records
  // exactly what the shipped function does to it. A restatement of the three
  // lines here would be a suite agreeing with itself.
  const classes = new Set();
  ctx.document = {
    documentElement: {
      classList: {
        add: (...c) => c.forEach((x) => classes.add(x)),
        remove: (...c) => c.forEach((x) => classes.delete(x)),
        contains: (c) => classes.has(c),
      },
    },
  };
  ctx.__classes = classes;
  vm.runInContext(extractFn(src.nt, "applyTextSize"), ctx, { filename: "newtab.js#applyTextSize" });
  return { ctx, store, classes };
}

let ctx, store, classes;
try {
  ({ ctx, store, classes } = boot(SRC));
} catch (err) {
  console.error(`TEXT SIZE: SUBJECT DID NOT LOAD — ${err && err.message}`);
  process.exit(2);
}
const S = ctx.Storage;
for (const fn of ["getTextSize", "setTextSize", "saveAll"]) {
  if (!S || typeof S[fn] !== "function") { console.error(`TEXT SIZE: SUBJECT DID NOT LOAD — Storage.${fn} missing`); process.exit(2); }
}
if (typeof ctx.applyTextSize !== "function") { console.error("TEXT SIZE: SUBJECT DID NOT LOAD — applyTextSize did not extract"); process.exit(2); }

let TIERS;
try {
  TIERS = {
    small: tokenBlock(SRC.css, "html.text-size-small {"),
    medium: tokenBlock(SRC.css, "/* MEDIUM — the default tier"),
    large: tokenBlock(SRC.css, "html.text-size-large {"),
  };
} catch (err) {
  console.error(`TEXT SIZE: SUBJECT DID NOT LOAD — ${err && err.message}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Assertions.
// ---------------------------------------------------------------------------
const rows = [];
const check = (name, pass, detail = "") => rows.push({ name, pass: !!pass, detail: String(detail) });
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const mkData = (over) => Object.assign({ workspaces: [], activeWorkspaceId: null, settings: { columns: 6 } }, over || {});

await (async () => {

  // ======================= the reader: default and coercion ================
  eq("read: an install that has never configured it reads medium", S.getTextSize(mkData()), "medium");
  eq("read: null data", S.getTextSize(null), "medium");
  eq("read: no settings bag at all", S.getTextSize({}), "medium");
  eq("read: settings present but empty", S.getTextSize({ settings: {} }), "medium");
  for (const v of ["small", "medium", "large"]) {
    eq(`read: "${v}" reads back as itself`, S.getTextSize(mkData({ settings: { textSize: v } })), v);
  }
  // Every junk shape must land on medium — never on undefined, never on the raw
  // value, which is what would reach classList as a class name.
  for (const junk of ["SMALL", "Large", "sm", "", " small", 12, null, undefined, true, {}, ["small"], "medium "]) {
    eq(`read: junk value ${JSON.stringify(junk)} coerces to medium`, S.getTextSize(mkData({ settings: { textSize: junk } })), "medium");
  }
  eq("read: the tier list is exactly the three tiers", S.TEXT_SIZES, ["small", "medium", "large"]);
  {
    // Q6: the reader must not repair what it is given.
    const d = mkData({ settings: { textSize: "nonsense" } });
    const before = JSON.stringify(d);
    S.getTextSize(d);
    check("read: the reader does not write back its coercion", JSON.stringify(d) === before);
  }

  // ======================= the setter: persistence and refusal =============
  {
    const d = mkData();
    eq("write: setting large returns true", await S.setTextSize(d, "large"), true);
    eq("write: ...and the field is stored", d.settings.textSize, "large");
    eq("write: ...and the reader agrees", S.getTextSize(d), "large");
    // Through the REAL saveAll, so a broken persist is caught here and not live.
    const persisted = (await ctx.chrome.storage.local.get("data")).data;
    eq("write: ...and it actually reached chrome.storage", persisted.settings.textSize, "large");
    eq("write: re-setting the same tier is a no-op", await S.setTextSize(d, "large"), false);
    eq("write: switching to small returns true", await S.setTextSize(d, "small"), true);
    eq("write: ...and stores small", (await ctx.chrome.storage.local.get("data")).data.settings.textSize, "small");
  }
  {
    // An unrecognised value is REFUSED, not stored-and-coerced: a junk value in
    // the blob reads as a setting the user chose, and rides their backup export.
    const d = mkData({ settings: { columns: 6, textSize: "large" } });
    for (const junk of ["SMALL", "huge", "", null, undefined, 3, {}]) {
      eq(`write: ${JSON.stringify(junk)} is refused`, await S.setTextSize(d, junk), false);
    }
    eq("write: ...and the stored value is untouched by every refusal", d.settings.textSize, "large");
  }
  eq("write: no settings bag -> refused rather than thrown", await S.setTextSize({}, "small"), false);
  eq("write: null data -> refused rather than thrown", await S.setTextSize(null, "small"), false);
  {
    // The migration case, stated as its own row because it IS the product change.
    const legacy = { workspaces: [], activeWorkspaceId: null, settings: { columns: 6, iconSize: "large" } };
    eq("migration: an existing install with no textSize reads medium (gets the bump)", S.getTextSize(legacy), "medium");
    check("migration: ...and nothing was written to get there", !("textSize" in legacy.settings));
    eq("migration: ...its OTHER settings are untouched", legacy.settings.iconSize, "large");
  }

  // ======================= applyTextSize: the three class states ===========
  {
    const state = () => [...classes].filter((c) => c.startsWith("text-size-")).sort();
    ctx.applyTextSize("small");
    eq("apply: small -> text-size-small", state(), ["text-size-small"]);
    ctx.applyTextSize("large");
    eq("apply: large -> text-size-large, and small is REMOVED", state(), ["text-size-large"]);
    ctx.applyTextSize("medium");
    eq("apply: MEDIUM IS THE UNCLASSED BASE — no class at all", state(), []);
    ctx.applyTextSize("large");
    ctx.applyTextSize("large");
    eq("apply: idempotent on a repeat", state(), ["text-size-large"]);
    // Defence in depth: the page only ever passes a coerced value, but a junk
    // one must land on the base, never on classList.
    for (const junk of ["SMALL", "huge", "", null, undefined, 0]) {
      ctx.applyTextSize("large");
      ctx.applyTextSize(junk);
      eq(`apply: junk ${JSON.stringify(junk)} falls back to the unclassed base`, state(), []);
    }
    ctx.applyTextSize("medium");
    check("apply: it touches nothing but its own two classes",
      !["icon-size-small", "icon-size-large", "has-bg", "bg-light"].some((c) => classes.has(c)));
  }
  {
    // The reader and the applier agree end to end: whatever is stored, the class
    // that lands is the class for the tier the reader names.
    const want = { small: ["text-size-small"], medium: [], large: ["text-size-large"] };
    const all = ["small", "medium", "large", "nonsense", undefined].every((v) => {
      const d = mkData({ settings: { textSize: v } });
      ctx.applyTextSize(S.getTextSize(d));
      const got = [...classes].filter((c) => c.startsWith("text-size-")).sort();
      return JSON.stringify(got) === JSON.stringify(want[S.getTextSize(d)]);
    });
    check("apply: stored value -> coerced tier -> class, for every input including junk", all);
  }

  // ======================= the ramp ========================================
  const names = LOCKED.map((r) => r[0]);
  for (const tier of ["small", "medium", "large"]) {
    eq(`ramp: the ${tier} block defines exactly the ramp's tokens`, Object.keys(TIERS[tier]).sort(), names.slice().sort());
  }
  // THE LOAD-BEARING ROW. A token is named after its own small value, so the
  // small tier is today's sheet reconstructed by construction.
  for (const [name] of LOCKED) {
    const want = parseFloat(name.replace("--fs-", "").replace("-", "."));
    eq(`ramp: SMALL identity — ${name} is ${want}px, exactly its own name`, TIERS.small[name], want);
  }
  for (const [name, s, m, l] of LOCKED) {
    eq(`ramp: ${name} is ${s} / ${m} / ${l}`, [TIERS.small[name], TIERS.medium[name], TIERS.large[name]], [s, m, l]);
  }
  check("ramp: every token grows or holds across the tiers, never shrinks",
    LOCKED.every(([n]) => TIERS.small[n] <= TIERS.medium[n] && TIERS.medium[n] <= TIERS.large[n]));
  check("ramp: MEDIUM actually bumps the small and secondary tiers (it is the product change)",
    LOCKED.filter(([, s]) => s <= 12.5).every(([n]) => TIERS.medium[n] > TIERS.small[n]));
  check("ramp: LARGE is a further notch above MEDIUM for those tiers",
    LOCKED.filter(([, s]) => s <= 12.5).every(([n]) => TIERS.large[n] > TIERS.medium[n]));
  // NO INVERSION. Sorted by their small value, each tier's column must be
  // non-decreasing — otherwise a bumped secondary size overtakes a body size.
  for (const tier of ["small", "medium", "large"]) {
    const col = LOCKED.slice().sort((a, b) => a[1] - b[1]).map(([n]) => TIERS[tier][n]);
    check(`ramp: the ${tier} column preserves the original ordering (no inversion)`,
      col.every((v, i) => i === 0 || col[i - 1] <= v), col.join(","));
  }
  check(`ramp: nothing is bumped past the untouched ${UNTOUCHED_FLOOR}px tier`,
    LOCKED.every(([n]) => TIERS.large[n] <= UNTOUCHED_FLOOR), JSON.stringify(TIERS.large));

  // ======================= the sheet =======================================
  {
    // Every font-size in the sheet is either a ramp token, a `0` (the two
    // glyph-collapse rules), or a literal at or above the untouched floor. This
    // is what stops a new small literal from silently escaping the setting.
    // Comments stripped first: this file's own ramp note contains the words
    // `font-size: Npx`, and scanning it would report the documentation as a
    // defect — a false red that reads exactly like a real one.
    const cssNoComments = SRC.css.replace(/\/\*[\s\S]*?\*\//g, "");
    const decls = [...cssNoComments.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
    const bad = decls.filter((v) => {
      if (/^var\(--fs-[0-9-]+\)(\s*!important)?$/.test(v)) return false;
      if (/^0$/.test(v)) return false;
      const px = v.match(/^([0-9.]+)px(\s*!important)?$/);
      return !(px && parseFloat(px[1]) >= UNTOUCHED_FLOOR);
    });
    check("sheet: no font-size below the floor is a hard literal — the setting covers all of them",
      bad.length === 0, bad.slice(0, 8).join(" | "));
    check("sheet: the ramp is actually load-bearing (hundreds of declarations, not a token nobody uses)",
      decls.filter((v) => v.startsWith("var(--fs-")).length >= 250,
      String(decls.filter((v) => v.startsWith("var(--fs-")).length));
    // A var nobody defines renders as nothing at all — the declaration is simply
    // dropped and the element inherits, which looks like a cascade bug.
    const used = new Set([...SRC.css.matchAll(/var\((--fs-[0-9-]+)\)/g)].map((m) => m[1]));
    check("sheet: every --fs-* referenced is defined in all three tiers",
      [...used].every((t) => t in TIERS.small && t in TIERS.medium && t in TIERS.large), [...used].join(" "));
    check("sheet: and every token defined is actually used", names.every((n) => used.has(n)),
      names.filter((n) => !used.has(n)).join(" "));
    // No em/rem anywhere: a relative unit would compound with the ramp and make
    // the table above a lie about what renders.
    check("sheet: no em/rem/% font-size compounds on top of the ramp", !/font-size:\s*[0-9.]+(em|rem|%)/.test(SRC.css));
  }
  check("sheet: MEDIUM is the unclassed base — the default tier is defined on :root, not on a class",
    /\/\* MEDIUM[\s\S]{0,200}\n:root \{/.test(SRC.css));
  check("sheet: the two tier classes are scoped to html, matching the icon-size pattern",
    /html\.text-size-small \{/.test(SRC.css) && /html\.text-size-large \{/.test(SRC.css) &&
    !/[^l]\.text-size-(small|large) \{/.test(SRC.css));

  // ======================= wiring ==========================================
  {
    const html = SRC.html;
    const rowRe = /<label class="settings-label">Text Size<\/label>\s*<div class="settings-segmented" id="settings-text-size">/;
    check("wiring: the row exists, labelled and wired to #settings-text-size", rowRe.test(html));
    check("wiring: it carries exactly the three tiers as seg-btns",
      ["small", "medium", "large"].every((v) => new RegExp(`id="settings-text-size"[\\s\\S]{0,400}data-value="${v}"`).test(html)));
    // Beside Icon Size, inside Appearance, and BEFORE the wallpaper row — the
    // locked placement.
    const appearance = html.slice(html.indexOf(">Appearance<"), html.indexOf(">Data<"));
    check("wiring: it lives in the Appearance section", appearance.includes('id="settings-text-size"'));
    check("wiring: ...directly beside Icon Size",
      appearance.indexOf('id="settings-icon-size"') < appearance.indexOf('id="settings-text-size"') &&
      appearance.indexOf('id="settings-text-size"') < appearance.indexOf("settings-wallpaper-row"));
    check("wiring: it reuses the icon-size row's own classes — no new markup surface",
      (html.match(/<div class="settings-row">\s*<label class="settings-label">Text Size/) || []).length === 1);
    // FREE, NEVER GATED. Neither the row nor its handler may sit behind Pro.
    check("wiring: the row is NOT inside any pro-gated container",
      !/pro-(only|gated|locked)[\s\S]{0,600}id="settings-text-size"/.test(html) &&
      !/id="settings-text-size"[\s\S]{0,400}data-pro/.test(html));
  }
  {
    const nt = SRC.nt;
    const handler = nt.slice(nt.indexOf('safeOn("#settings-text-size"'), nt.indexOf('safeOn("#settings-change-wallpaper"'));
    check("wiring: the click handler exists and is bound to the container, delegated",
      handler.includes('e.target.closest(".seg-btn")'), handler.slice(0, 60));
    check("wiring: it applies LIVE before awaiting the write", /applyTextSize\(btn\.dataset\.value\)[\s\S]*await Storage\.setTextSize/.test(handler));
    check("wiring: it persists through the storage setter, not a bare field write",
      /Storage\.setTextSize\(data, btn\.dataset\.value\)/.test(handler) && !/data\.settings\.textSize *=/.test(nt));
    check("wiring: it re-reads after the write, so a refused value cannot stick on screen",
      /applyTextSize\(Storage\.getTextSize\(data\)\)/.test(handler));
    check("wiring: it refreshes the segmented control's selected state", /updateSettingsUI\(\)/.test(handler));
    check("wiring: FREE — no Pro/trial/licence check anywhere in the handler",
      !/(isPro|getProAccessLevel|proAccess|requirePro|trial)/i.test(handler), handler.slice(0, 200));
    // applyTextSize rides every path applyIconSize does: boot, backup restore,
    // and the foreign-write re-render (so another tab's change lands here).
    const iconCalls = (nt.match(/applyIconSize\(/g) || []).length - 1;   // minus the declaration
    const textCalls = (nt.match(/applyTextSize\(/g) || []).length - 1;
    check("wiring: applyTextSize is applied on at least as many paths as applyIconSize",
      textCalls >= iconCalls, `text ${textCalls} icon ${iconCalls}`);
    for (const [label, anchor] of [
      ["boot", 'applyIconSize(data.settings.iconSize || "medium");\n    applyTextSize'],
      ["backup restore", 'applyIconSize(data.settings.iconSize || "medium");\n      applyTextSize'],
      ["foreign-write re-render", 'applyIconSize((data && data.settings && data.settings.iconSize) || "medium");\n    applyTextSize'],
    ]) {
      check(`wiring: applied on the ${label} path, right beside applyIconSize`, nt.includes(anchor));
    }
    check("wiring: the settings panel syncs the control from the COERCED reader",
      /var textSize = Storage\.getTextSize\(data\);[\s\S]{0,220}#settings-text-size/.test(nt));
    check("wiring: applyTextSize mirrors applyIconSize's shape — remove both, add at most one",
      /html\.classList\.remove\("text-size-small", "text-size-large"\)/.test(nt));
    check("wiring: the gate page is NOT wired to it (known, stated boundary)",
      !/text-size-(small|large)/.test(rd("gate.css")) && !/applyTextSize/.test(rd("gate.js")));
  }
  // O1: the row introduces no new painted surface — it reuses the icon-size
  // row's classes verbatim, which the static ink gate already walks.
  check("ink: the row's classes all already exist in the sheet",
    ["settings-row", "settings-label", "settings-segmented", "seg-btn"].every((c) => new RegExp(`\\.${c}[ ,{:]`).test(SRC.css)));
  check("ink: no new class was invented for it",
    !/class="[^"]*text-size[^"]*"/.test(SRC.html));

})();

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
if (TABLE && !MUTATE) {
  console.log("\n  token       small   medium   large");
  for (const [n] of LOCKED) {
    console.log(`  ${n.padEnd(10)} ${String(TIERS.small[n]).padStart(5)}   ${String(TIERS.medium[n]).padStart(6)}   ${String(TIERS.large[n]).padStart(5)}`);
  }
}

let pass = 0, fail = 0;
if (!MUTATE) {
  console.log("\nTEXT SIZE — Settings > Appearance, three tiers over one token ramp\n");
  for (const r of rows) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "   << " + r.detail}`);
    r.pass ? pass++ : fail++;
  }
} else {
  for (const r of rows) { r.pass ? pass++ : fail++; }
}

// P2 anti-vacuity floor.
const MIN = 90;
if (!MUTATE && rows.length < MIN) {
  console.log(`\nTEXT SIZE: FAIL — only ${rows.length} assertions ran (expected >= ${MIN}); the suite is broken, not clean.\n`);
  process.exit(1);
}
if (!MUTATE) {
  console.log(`\nTEXT SIZE: ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --mutate (P3/Q1-Q3).
// ---------------------------------------------------------------------------
console.log("\nTEXT SIZE — mutation seeding\n");

const SEEDS = [
  // THE LOAD-BEARING SEED. Small must be today's sizing; break one value and the
  // naming invariant has to catch it.
  { name: "SMALL IS NOT IDENTICAL — one token in the small block is bumped",
    file: "css", from: "html.text-size-small {\n  --fs-8: 8px;\n  --fs-9: 9px;\n  --fs-10: 10px;\n  --fs-11: 11px;",
    to:            "html.text-size-small {\n  --fs-8: 8px;\n  --fs-9: 9px;\n  --fs-10: 10px;\n  --fs-11: 12px;" },
  { name: "SMALL IS NOT IDENTICAL — the whole small block is the medium ramp",
    file: "css", from: "html.text-size-small {\n  --fs-8: 8px;", to: "html.text-size-small {\n  --fs-8: 9px;" },
  { name: "medium stops bumping — the default tier is just small again",
    file: "css", from: ":root {\n  --fs-8: 9px;\n  --fs-9: 10px;", to: ":root {\n  --fs-8: 8px;\n  --fs-9: 9px;" },
  { name: "the ramp inverts — large pushes a 14px token past the untouched 16px tier",
    file: "css", from: "html.text-size-large {\n  --fs-8: 10px;", to: "html.text-size-large {\n  --fs-8: 18px;" },
  { name: "a hard literal creeps back into the sheet (a rule the setting no longer covers)",
    file: "css", from: ".pro-tour-text { font-size: var(--fs-13);", to: ".pro-tour-text { font-size: 13px;" },
  { name: "a token is referenced but never defined (the declaration silently drops)",
    file: "css", from: ".pro-tour-count { font-size: var(--fs-11);", to: ".pro-tour-count { font-size: var(--fs-11-25);" },
  { name: "the default flips to small — every existing install stops getting the bump",
    file: "storage", from: 'var DEFAULT_TEXT_SIZE = "medium";', to: 'var DEFAULT_TEXT_SIZE = "small";' },
  { name: "the reader stops coercing — junk passes through to classList",
    file: "storage", from: "return TEXT_SIZES.indexOf(v) === -1 ? DEFAULT_TEXT_SIZE : v;", to: "return v || DEFAULT_TEXT_SIZE;" },
  { name: "the setter accepts anything — junk lands in the user's stored settings",
    file: "storage", from: "    if (TEXT_SIZES.indexOf(val) === -1) return false;", to: "    if (val === undefined) return false;" },
  { name: "the setter no-op guard writes anyway (every click a storage round trip)",
    file: "storage", from: "if (getTextSize(data) === val && data.settings.textSize === val) return false;", to: "if (false) return false;" },
  { name: "applyTextSize stops removing the previous tier's class (both stack)",
    file: "nt", from: '    html.classList.remove("text-size-small", "text-size-large");', to: '    html.classList.remove("text-size-nothing");' },
  { name: "medium stops being the unclassed base (it adds a class of its own)",
    file: "nt", from: '    if (size === "small") html.classList.add("text-size-small");', to: '    if (size !== "large") html.classList.add("text-size-small");' },
  { name: "the settings control reads the raw field instead of the coercing reader",
    file: "nt", from: "    var textSize = Storage.getTextSize(data);", to: "    var textSize = (data.settings && data.settings.textSize) || \"medium\";" },
  { name: "the handler writes the field directly, bypassing the setter's validation",
    file: "nt", from: "      await Storage.setTextSize(data, btn.dataset.value);", to: "      data.settings.textSize = btn.dataset.value; await Storage.saveAll(data);" },
  { name: "the foreign-write re-render stops re-applying it (a second tab never updates)",
    file: "nt", from: '    applyIconSize((data && data.settings && data.settings.iconSize) || "medium");\n    applyTextSize(Storage.getTextSize(data));',
    to:            '    applyIconSize((data && data.settings && data.settings.iconSize) || "medium");' },
  { name: "the row is Pro-gated (an accessibility setting behind a paywall)",
    file: "html", from: '<div class="settings-segmented" id="settings-text-size">', to: '<div class="settings-segmented pro-only" data-pro="1" id="settings-text-size">' },
];

const FILEKEY = { storage: "storage", nt: "nt", css: "css", html: "html" };

import { spawnSync } from "node:child_process";
import os from "node:os";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lp-textsize-mut-"));
function materialize(src) {
  const dir = fs.mkdtempSync(path.join(scratch, "seed-"));
  fs.writeFileSync(path.join(dir, "storage.js"), src.storage);
  fs.writeFileSync(path.join(dir, "newtab.js"), src.nt);
  fs.writeFileSync(path.join(dir, "newtab.css"), src.css);
  fs.writeFileSync(path.join(dir, "newtab.html"), src.html);
  // Read verbatim: the gate-page boundary assertion reads these two, and a
  // mutant must not fail merely because they are absent from the scratch tree.
  fs.writeFileSync(path.join(dir, "gate.css"), rd("gate.css"));
  fs.writeFileSync(path.join(dir, "gate.js"), rd("gate.js"));
  return dir;
}
const runAgainst = (dir) => spawnSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), dir], { encoding: "utf8" });

// CONTROL (Q1).
{
  const broken = Object.assign({}, SRC, { storage: SRC.storage + "\nthis is not javascript(" });
  const r = runAgainst(materialize(broken));
  console.log(`  ${r.status === 2 ? "OK  " : "BAD "} control: an unloadable subject exits 2 (got ${r.status}), and is not scored`);
  if (r.status !== 2) { console.log("\n  the runner cannot distinguish broken from caught — no seed below is meaningful.\n"); process.exit(1); }
}
{
  const r = runAgainst(materialize(SRC));
  console.log(`  ${r.status === 0 ? "OK  " : "BAD "} control: the CLEAN subject passes (exit ${r.status})`);
  if (r.status !== 0) { console.log(r.stdout); process.exit(1); }
}

let caught = 0, escaped = 0, missed = 0;
for (const seed of SEEDS) {
  const key = FILEKEY[seed.file];
  const hay = SRC[key];
  const n = hay.split(seed.from).length - 1;
  if (n !== 1) { missed++; console.log(`  MISS  ${seed.name}   << anchor matched ${n} times in ${seed.file} (want exactly 1)`); continue; }
  const mutated = Object.assign({}, SRC, { [key]: hay.replace(seed.from, seed.to) });
  const r = runAgainst(materialize(mutated));
  if (r.status === 2) { missed++; console.log(`  MISS  ${seed.name}   << subject did not load (unfaithful seed)`); continue; }
  if (r.status === 1) { caught++; console.log(`  CAUGHT   ${seed.name}`); }
  else { escaped++; console.log(`  ESCAPED  ${seed.name}   << the suite did not notice`); }
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\nMUTATION: ${caught} caught, ${escaped} escaped, ${missed} anchor-miss (of ${SEEDS.length})\n`);
process.exit(escaped || missed ? 1 : 0);
