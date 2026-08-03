#!/usr/bin/env node
// Ink gate for wallpaper-backed panels — the a68dd89 / [1.0.18 B-2] bug class.
//
// THE BUG THIS EXISTS FOR (twice now):
// Panel surfaces flip to a DARK frosted background when a wallpaper is active
// (html.has-bg -> --pro-frost-floater-bg = rgba(30,30,30,0.92)), but the ink does
// not flip with them automatically. A new rule that sets no `color` at all lets
// its text fall through to body { color: var(--text-primary) } = #202124, which
// on that dark panel measures ~1.05:1. Invisible. It looks perfect in the default
// no-wallpaper theme, so it ships. a68dd89 was this on the Insights board; the
// B-2 sound picker was this again in Pro Settings.
//
// WHAT THIS CHECKS — AND WHAT IT DOES NOT:
// This is a STRUCTURAL PROXY, not a cascade engine. It asserts the invariant that
// actually failed: every element that renders its own text inside a wallpaper-
// backed panel must have SOME `html.has-bg`-scoped rule declaring `color` on
// itself or an ancestor, so its ink is re-lit when the surface darkens. It does
// NOT compute the effective colour or a contrast ratio — resolving specificity,
// custom properties and alpha compositing without a browser would be
// re-implementing the cascade, which is the very mistake that let both bugs
// through (BUGS.md J6: assert the cascade, don't assert the intent).
//
// The AUTHORITATIVE check is a real browser reading getComputedStyle. Extension
// pages can't be driven directly, so serve the real markup + CSS over localhost
// and measure there:
//   1. copy newtab.html + newtab.css to a scratch dir; strip <script> tags
//      (they need chrome.*; the CSS cascade is unaffected)
//   2. add class="has-bg" to <html>; remove `hidden` from the panel
//   3. serve both over http://localhost, then in the page:
//        getComputedStyle(el).color   // <- the real answer
//      and composite it over rgba(30,30,30,0.92) for the contrast ratio.
// That measurement is what proved both the mechanism and the fix; this file is
// the cheap always-on guard that would have caught either one at commit time.
//
// Usage: node tools/check-panel-ink.mjs [repoRoot]
// Exit 0 = PASS, 1 = FAIL.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2] || process.cwd();

// Wallpaper-backed containers whose surface darkens under html.has-bg. Add to
// this list when a new such panel ships.
const PANELS = ["pro-settings-panel"];

// ---- CSS: collect selectors that declare `color` ----------------------------
function rulesWithColor(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0, selStart = 0, blockStart = -1, sel = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      if (depth === 0) { sel = css.slice(selStart, i).trim(); blockStart = i + 1; }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        const body = css.slice(blockStart, i);
        // A nested block (@media/@supports) — recurse rather than treat as decls.
        if (body.includes("{")) out.push(...rulesWithColor(body));
        else if (/(^|;)\s*color\s*:/.test(body)) out.push(sel);
        selStart = i + 1;
      }
    }
  }
  return out;
}

// Split a complex selector into its compounds, right-most last. All combinators
// are treated as "ancestor" — a child combinator matched as a descendant is
// permissive, never falsely strict, which is the safe direction for a gate whose
// failure mode should be a false alarm rather than a missed bug.
function compounds(sel) {
  return sel
    .replace(/:has\([^)]*\)/g, "")
    .replace(/::?[a-z-]+(\([^)]*\))?/gi, "")
    .split(/[\s>+~]+/)
    .filter(Boolean);
}
function compoundKeys(compound) {
  return {
    tag: (compound.match(/^[a-zA-Z][\w-]*/) || [""])[0].toLowerCase(),
    ids: (compound.match(/#[\w-]+/g) || []).map((x) => x.slice(1)),
    classes: (compound.match(/\.[\w-]+/g) || []).map((x) => x.slice(1))
  };
}
function compoundMatches(k, node) {
  if (k.tag && k.tag !== node.tag) return false;
  if (k.ids.length && !k.ids.every((i) => i === node.id)) return false;
  return k.classes.every((c) => node.classes.includes(c));
}
// Right-to-left descendant match of a compound list against a node's chain.
function selectorMatches(parts, node) {
  if (!parts.length) return false;
  if (!compoundMatches(parts[parts.length - 1], node)) return false;
  let ancestors = chain(node).slice(1);
  for (let i = parts.length - 2; i >= 0; i--) {
    const at = ancestors.findIndex((a) => compoundMatches(parts[i], a));
    if (at === -1) return false;
    ancestors = ancestors.slice(at + 1);
  }
  return true;
}

// ---- HTML: minimal element tree (sufficient for this hand-authored markup) ---
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"]);

function parseHtml(html) {
  const root = { tag: "#root", id: "", classes: [], hidden: false, children: [], text: "", parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {                                   // close tag
      const t = m[1].toLowerCase();
      let n = cur;
      while (n && n.tag !== t) n = n.parent;
      if (n && n.parent) cur = n.parent;
    } else if (m[2]) {                            // open tag
      const tag = m[2].toLowerCase(), attrs = m[3] || "";
      const id = (attrs.match(/\bid\s*=\s*["']([^"']*)["']/i) || [, ""])[1];
      const cls = (attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i) || [, ""])[1];
      const node = {
        tag, id, classes: cls.split(/\s+/).filter(Boolean),
        // Test for the bare `hidden` ATTRIBUTE only. Strip quoted values first:
        // the panel ships as class="pro-settings-panel hidden", and matching the
        // word inside that class list marked every node hidden, which silently
        // emptied this gate (0 nodes checked = vacuous pass).
        hidden: /(^|\s)hidden(\s|=|$)/i.test(attrs.replace(/=\s*("[^"]*"|'[^']*')/g, "=")),
        children: [], text: "", parent: cur
      };
      cur.children.push(node);
      if (!VOID.has(tag) && !m[4]) cur = node;
      if (tag === "script" || tag === "style") {  // skip raw-text content
        const end = html.indexOf(`</${tag}`, re.lastIndex);
        if (end !== -1) { re.lastIndex = end; cur = node.parent; }
      }
    } else if (m[5] && m[5].trim()) {             // text node
      cur.text += (cur.text ? " " : "") + m[5].trim().replace(/\s+/g, " ");
    }
  }
  return root;
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const c of node.children) { const r = findById(c, id); if (r) return r; }
  return null;
}
function chain(node) { const out = []; for (let n = node; n; n = n.parent) out.push(n); return out; }
function decodeEntities(s) {
  return s.replace(/&[a-z]+;|&#\d+;/gi, (e) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"' }[e] || " "));
}

// ---- run --------------------------------------------------------------------
const css = fs.readFileSync(path.join(repoRoot, "newtab.css"), "utf8");
const html = fs.readFileSync(path.join(repoRoot, "newtab.html"), "utf8");

// Selectors that re-light ink specifically when a wallpaper is active. bg-light
// is the light-SOLID-wallpaper branch and counts too — it is has-bg-scoped.
const hasBgInk = rulesWithColor(css)
  .flatMap((s) => s.split(","))
  .map((s) => s.trim())
  // html.has-bg ONLY — html.bg-light does NOT count. bg-light is the light-SOLID-
  // wallpaper luminance class; a photo wallpaper carries has-bg WITHOUT it, so a
  // bg-light-only override leaves the ink dark on exactly the surface that broke.
  // That substitution is the a68dd89 root cause verbatim, and crediting it here
  // made this gate pass the very bug it was written for (caught by mutation M3).
  .filter((s) => /^html\.has-bg\b/.test(s))
  // Drop the leading html.has-bg compound: that root condition is what the filter
  // above already established. What remains must match inside the panel.
  .map((s) => compounds(s).slice(1).map(compoundKeys))
  .filter((parts) => parts.length);

// Ink counts if the has-bg rule targets this element OR any ancestor — colour
// inherits, so a lit ancestor lights its text children.
function hasWallpaperInk(node) {
  return chain(node).some((n) => hasBgInk.some((parts) => selectorMatches(parts, n)));
}

const rows = [];
for (const panelId of PANELS) {
  const root = parseHtml(html);
  const panel = findById(root, panelId);
  if (!panel) { console.error(`ink gate: #${panelId} not found in newtab.html`); process.exit(1); }
  const walk = (n, hidden, isRoot) => {
    // `.hidden { display: none !important }` is this codebase's hide mechanism,
    // alongside the bare attribute. Both must be skipped or the gate reports on
    // text the user can never see.
    //
    // EXCEPT on the panel root: it ships class="hidden" and is revealed by JS, so
    // honouring its own flag marks the entire subtree hidden and empties the gate.
    const h = isRoot ? false : (hidden || n.hidden || n.classes.includes("hidden"));
    if (n.text) {
      const t = decodeEntities(n.text).trim();
      // Glyph-only nodes (▶ and friends) carry no reading load; they are styled
      // by their own button rules and were never part of this bug class.
      if (t && /[a-z0-9]/i.test(t)) {
        rows.push({ panel: panelId, text: t.slice(0, 44), hidden: h, ok: hasWallpaperInk(n),
                    where: n.tag + (n.classes.length ? "." + n.classes.join(".") : "") });
      }
    }
    n.children.forEach((c) => walk(c, h, false));
  };
  walk(panel, false, true);
}

const visible = rows.filter((r) => !r.hidden);
const bad = visible.filter((r) => !r.ok);

console.log(`\nINK GATE — wallpaper-backed panel text (${visible.length} visible text nodes)\n`);

// Anti-vacuity guard. A parser tweak that silently stops finding text turns this
// gate into a green light that checks nothing — which happened twice while
// writing it (the `hidden` class matched inside class="...", then the panel
// root's own hidden flag). A run that inspects almost nothing is a broken gate,
// not a clean bill of health.
const MIN_NODES = 20;
if (visible.length < MIN_NODES) {
  console.log(`INK GATE: FAIL — only ${visible.length} text nodes found (expected >= ${MIN_NODES}).`);
  console.log(`The HTML walk is broken, so this run proves nothing. Fix the parser, not the threshold.\n`);
  process.exit(1);
}
for (const r of bad) console.log(`  MISSING html.has-bg ink   ${r.where}\n      "${r.text}"`);
if (!bad.length) {
  console.log(`INK GATE: PASS — every visible panel text node has has-bg-scoped ink on its chain.\n`);
  process.exit(0);
}
console.log(`\nINK GATE: FAIL — ${bad.length} text node(s) will fall through to --text-primary (#202124)`);
console.log(`on a dark frosted panel (~1.05:1). Give the rule a colour plus an html.has-bg override,`);
console.log(`matching .pro-toggle-row / .pomo-setting-row.\n`);
process.exit(1);
