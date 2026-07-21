#!/usr/bin/env node
// Release-package gate for the LaunchPad extension zip.
//
// Verifies that EVERY file the manifest declares — scripts, pages, AND assets
// (icons, action.default_icon, web_accessible_resources, content_scripts, ...) —
// plus everything those pages/scripts reference (HTML <script>/<link>/<img>,
// service-worker importScripts) resolves to a real entry inside the zip, stored
// with the EXACT forward-slash path the manifest uses.
//
// Why raw entry names matter (bug: RUNWAY STEP 1 live finding, 2026-07-21):
// PowerShell 5.1's Compress-Archive wrote sub-directory entries with BACKSLASH
// separators (icons\icon16.png, byte 0x5c). That violates the ZIP spec (APPNOTE
// 4.4.17 mandates '/'), so Chrome — which looks for the manifest's forward-slash
// path 'icons/icon16.png' — cannot find it and refuses to install ("Could not
// load icon"). Every tool that NORMALIZES separators hides this: Python's
// zipfile.namelist() rewrites '\'->'/' on Windows, and Windows Explorer /
// Expand-Archive turn a backslash entry back into a real sub-folder on
// extraction. So this gate parses the central directory itself and compares RAW
// bytes — the only faithful reproduction of what Chrome's zip loader does.
//
// Usage: node tools/verify-package.mjs <zip> [repoRoot]
// Exit 0 = PASS, 1 = FAIL (or usage/parse error).

import fs from "node:fs";
import path from "node:path";

const zipPath = process.argv[2];
const repoRoot = process.argv[3] || process.cwd();
if (!zipPath) { console.error("usage: node tools/verify-package.mjs <zip> [repoRoot]"); process.exit(1); }

// ---- raw zip central-directory reader (no separator normalization) ----------
function readZipEntryNames(buf) {
  // Find End Of Central Directory record (sig 0x06054b50), scanning from the end.
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip (no EOCD record)");
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16); // central directory offset
  const CEN_SIG = 0x02014b50;
  const names = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== CEN_SIG) throw new Error("central dir header mismatch at " + off);
    const fnLen = buf.readUInt16LE(off + 28);
    const exLen = buf.readUInt16LE(off + 30);
    const cmLen = buf.readUInt16LE(off + 32);
    const name = buf.toString("latin1", off + 46, off + 46 + fnLen); // RAW bytes, no normalization
    names.push(name);
    off += 46 + fnLen + exLen + cmLen;
  }
  return names;
}

// ---- manifest asset/script/page enumeration ---------------------------------
function isLocal(p) {
  return p && !/^(https?:|data:|blob:|chrome:|mailto:|#)/i.test(p) && !p.startsWith("//");
}
function norm(p) { return p.replace(/^\.\//, "").replace(/\\/g, "/"); }
function isGlob(p) { return /[*?]/.test(p); }

function enumerateManifest(m) {
  const refs = []; // {p, field, kind: 'script'|'page'|'asset'}
  const add = (p, field, kind) => { if (isLocal(p)) refs.push({ p: norm(p), field, kind }); };

  if (m.background) {
    if (m.background.service_worker) add(m.background.service_worker, "background.service_worker", "script");
    (m.background.scripts || []).forEach((s, i) => add(s, `background.scripts[${i}]`, "script"));
  }
  Object.entries(m.chrome_url_overrides || {}).forEach(([k, v]) => add(v, `chrome_url_overrides.${k}`, "page"));
  Object.entries(m.icons || {}).forEach(([sz, v]) => add(v, `icons.${sz}`, "asset"));

  const action = m.action || m.browser_action || m.page_action;
  if (action) {
    if (typeof action.default_icon === "string") add(action.default_icon, "action.default_icon", "asset");
    else if (action.default_icon) Object.entries(action.default_icon).forEach(([sz, v]) => add(v, `action.default_icon.${sz}`, "asset"));
    if (action.default_popup) add(action.default_popup, "action.default_popup", "page");
    (action.theme_icons || []).forEach((ti, i) => {
      if (ti.light) add(ti.light, `action.theme_icons[${i}].light`, "asset");
      if (ti.dark) add(ti.dark, `action.theme_icons[${i}].dark`, "asset");
    });
  }
  // web_accessible_resources: MV3 [{resources:[]}] or MV2 [] of strings.
  const globs = [];
  (m.web_accessible_resources || []).forEach((w, i) => {
    const list = Array.isArray(w) ? w : (w && w.resources) || (typeof w === "string" ? [w] : []);
    list.forEach((r) => { if (isGlob(r)) globs.push({ p: r, field: `web_accessible_resources[${i}]` }); else add(r, `web_accessible_resources[${i}]`, "asset"); });
  });
  (m.content_scripts || []).forEach((cs, i) => {
    (cs.js || []).forEach((j) => add(j, `content_scripts[${i}].js`, "script"));
    (cs.css || []).forEach((c) => add(c, `content_scripts[${i}].css`, "asset"));
  });
  if (m.options_page) add(m.options_page, "options_page", "page");
  if (m.options_ui && m.options_ui.page) add(m.options_ui.page, "options_ui.page", "page");
  if (m.devtools_page) add(m.devtools_page, "devtools_page", "page");
  if (m.side_panel && m.side_panel.default_path) add(m.side_panel.default_path, "side_panel.default_path", "page");
  (m.sandbox && m.sandbox.pages || []).forEach((p, i) => add(p, `sandbox.pages[${i}]`, "page"));
  if (m.default_locale) add(`_locales/${m.default_locale}/messages.json`, "default_locale", "asset");
  return { refs, globs };
}

// ---- recursive expansion: HTML sub-refs + JS importScripts ------------------
function htmlRefs(file) {
  const html = fs.readFileSync(file, "utf8");
  const out = [];
  const re = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m; while ((m = re.exec(html))) if (isLocal(m[1])) out.push(norm(m[1]));
  return out;
}
function importScriptsRefs(file) {
  const js = fs.readFileSync(file, "utf8");
  const out = [];
  const re = /importScripts\s*\(\s*([^)]*)\)/g;
  let m; while ((m = re.exec(js))) {
    const inner = m[1];
    const sre = /["']([^"']+)["']/g; let s;
    while ((s = sre.exec(inner))) if (isLocal(s[1])) out.push(norm(s[1]));
  }
  return out;
}

// ---- run --------------------------------------------------------------------
const manifestPath = path.join(repoRoot, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const { refs, globs } = enumerateManifest(manifest);

// Recurse into pages and scripts that exist in the repo.
const seen = new Set(refs.map((r) => r.p));
const queue = refs.slice();
while (queue.length) {
  const r = queue.shift();
  const abs = path.join(repoRoot, r.p);
  if (!fs.existsSync(abs)) continue;
  let subs = [];
  if (/\.html?$/i.test(r.p)) subs = htmlRefs(abs).map((p) => ({ p, field: `↳ referenced by ${r.p}`, kind: "asset/script" }));
  else if (/\.js$/i.test(r.p)) subs = importScriptsRefs(abs).map((p) => ({ p, field: `↳ importScripts in ${r.p}`, kind: "script" }));
  for (const s of subs) if (!seen.has(s.p)) { seen.add(s.p); refs.push(s); queue.push(s); }
}

const rawNames = readZipEntryNames(fs.readFileSync(zipPath));
const rawSet = new Set(rawNames);

// Ensure manifest.json itself ships.
if (!refs.some((r) => r.p === "manifest.json")) refs.unshift({ p: "manifest.json", field: "(manifest root)", kind: "page" });

const rows = [];
let fails = 0, repoMissing = 0;
for (const r of refs) {
  const inRepo = fs.existsSync(path.join(repoRoot, r.p));
  const inZip = rawSet.has(r.p);                       // exact forward-slash match — what Chrome needs
  const asBackslash = !inZip && rawSet.has(r.p.replace(/\//g, "\\")); // present, but backslashed
  let status = "ok";
  if (!inZip) {
    fails++;
    status = asBackslash ? "FAIL: stored with backslash separator (invalid; Chrome can't find it)" : "FAIL: missing from zip";
  }
  if (!inRepo) { repoMissing++; status += (status === "ok" ? "" : " | ") + "WARN: missing from repo too"; }
  rows.push({ p: r.p, field: r.field, kind: r.kind, inRepo, inZip, status });
}

// ---- report -----------------------------------------------------------------
console.log(`\nPACKAGE GATE — ${path.basename(zipPath)} (${rawNames.length} entries) vs manifest\n`);
const w = Math.max(...rows.map((r) => r.p.length), 12);
console.log("  " + "path".padEnd(w) + "  repo  zip  field / source");
console.log("  " + "-".repeat(w) + "  ----  ---  --------------");
for (const r of rows) {
  console.log("  " + r.p.padEnd(w) + "  " + (r.inRepo ? " ✓ " : " ✗ ") + "  " + (r.inZip ? "✓" : "✗") + "   " + r.field + (r.status === "ok" ? "" : "   << " + r.status));
}
if (globs.length) {
  console.log("\n  glob resources (pattern — not literally checked):");
  globs.forEach((g) => console.log("    " + g.p + "   (" + g.field + ")"));
}
console.log("");
if (fails === 0 && repoMissing === 0) {
  console.log(`PACKAGE GATE: PASS — all ${rows.length} manifest-declared/referenced files resolve in the zip with exact forward-slash paths.\n`);
  process.exit(0);
} else {
  console.log(`PACKAGE GATE: FAIL — ${fails} unresolved in zip` + (repoMissing ? `, ${repoMissing} missing from repo` : "") + `. Chrome/CWS would reject this artifact.\n`);
  process.exit(1);
}
