// =============================================================================
// PACKAGE SOURCES - the readers BOTH package gates share.
//
// WHY THIS FILE EXISTS. tools/verify-package.mjs owned all of this, and the
// [1.14.5] source gate needs the same two readers: the HTML reference extractor
// and build.sh's shipping allowlist. Copying either one would have created a
// SECOND implementation of a parse whose whole job is to agree with the build -
// and d5dd9e3 is the standing example of what a mis-parse of that array costs,
// since it passed while being quietly wrong.
//
// So the block MOVED here rather than being rewritten, and verify-package.mjs
// imports it back. Its 14 fixtures run unchanged and are the evidence that the
// move changed no behaviour.
//
// PURE. Nothing here reads argv, prints, or exits. Both gates own their own
// reporting, because they answer different questions at different times: this
// library only knows how to READ.
// =============================================================================

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// THE HTML REFERENCE EXTRACTOR.
//
// This is the piece P8's worked example is about: a greedy regex swallowed the
// slash of self-closing tags, and because the extractor and the checker shared
// it, they agreed on the same wrong elements. So this is a small tokenizer
// rather than one clever pattern, and it is self-tested on every run (below).
//
// Three deliberate properties:
//   - comments are stripped FIRST, so tag-like text inside a comment cannot
//     contribute a reference;
//   - the attribute scanner requires `name = value`, so a trailing `/` before
//     `>` is simply unmatched text rather than being absorbed into a value;
//   - quoted values may contain `>`, which the tag pattern's alternation allows.
// ---------------------------------------------------------------------------
export const TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
export const ATTR_RE = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

export function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

// The CONTENT of <script> and <style> is raw text, not markup. An inline script
// containing the string "<script src='x.js'>" must contribute nothing, and the
// extractor fixture below caught exactly that before this shipped. The OPENING
// tag is preserved, so <script src="real.js"> is still read; only the body is
// dropped. The attribute alternation matches the tag pattern's, so a quoted
// attribute containing `>` cannot end the tag early.
export function stripRawTextElements(html) {
  return html.replace(
    /(<(script|style)(?:[^>"']|"[^"]*"|'[^']*')*>)[\s\S]*?(<\/\2\s*>)/gi,
    "$1$3"
  );
}

// Returns [{tag, attr, value}] for every src/href in the document.
export function extractRefs(html) {
  const out = [];
  const src = stripRawTextElements(stripComments(html));
  let t;
  TAG_RE.lastIndex = 0;
  while ((t = TAG_RE.exec(src))) {
    const tag = t[1].toLowerCase();
    const attrs = t[2] || "";
    let a;
    ATTR_RE.lastIndex = 0;
    while ((a = ATTR_RE.exec(attrs))) {
      const name = a[1].toLowerCase();
      if (name !== "src" && name !== "href") continue;
      const value = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4];
      if (value !== undefined) out.push({ tag, attr: name, value });
    }
  }
  return out;
}

export function isLocal(p) {
  return p && !/^(https?:|data:|blob:|chrome:|mailto:|#)/i.test(p) && !p.startsWith("//");
}
export function norm(p) { return p.replace(/^\.\//, "").replace(/\\/g, "/"); }
export function isGlob(p) { return /[*?]/.test(p); }

export function localRefs(html) {
  return extractRefs(html).map((r) => r.value).filter(isLocal).map(norm);
}

// ---------------------------------------------------------------------------
// PARSER SELF-TEST. Runs on EVERY gate invocation, not only under a flag: a
// parser that silently stops matching is exactly the failure this gate cannot
// survive, and P13 says a check that can quietly become vacuous is not a check.
// Each case is awkward-but-legal markup that a naive regex gets wrong.
// ---------------------------------------------------------------------------
export const PARSER_FIXTURES = [
  {
    name: "self-closing tag keeps its value and does not absorb the slash",
    html: '<link rel="stylesheet" href="a.css"/><img src="b.png" />',
    want: ["a.css", "b.png"]
  },
  {
    name: "attributes in unusual order, src last",
    html: '<script defer type="text/javascript" src="c.js"></script>',
    want: ["c.js"]
  },
  {
    name: "single quotes",
    html: "<script src='d.js'></script><link href='e.css' rel='stylesheet'>",
    want: ["d.js", "e.css"]
  },
  {
    name: "unquoted attribute value",
    html: "<script src=f.js></script>",
    want: ["f.js"]
  },
  {
    name: "a comment containing tag-like text contributes nothing",
    html: '<!-- <script src="ghost.js"></script> --><script src="real.js"></script>',
    want: ["real.js"]
  },
  {
    name: "script tag with no src is not a reference",
    html: '<script>var x = "<script src=\'nope.js\'>";</script><script src="yes.js"></script>',
    want: ["yes.js"]
  },
  {
    name: "quoted value containing > does not truncate the tag",
    html: '<a title="a > b" href="g.html">x</a>',
    want: ["g.html"]
  },
  {
    name: "remote and non-file schemes are excluded",
    html: '<a href="https://example.com/x.html">a</a><a href="mailto:x@y.z">b</a>' +
          '<a href="#frag">c</a><img src="data:image/png;base64,AAA">' +
          '<script src="local.js"></script>',
    want: ["local.js"]
  },
  {
    name: "uppercase tag and attribute names",
    html: '<SCRIPT SRC="H.js"></SCRIPT>',
    want: ["H.js"]
  },
  {
    name: "leading ./ is normalised",
    html: '<script src="./i.js"></script>',
    want: ["i.js"]
  }
];

// The allowlist reader has its own fixtures, for the same reason the HTML
// extractor does: it is source B, and a source that mis-parses is worse than one
// that is missing, because it reports a confident wrong answer.
export const ALLOWLIST_FIXTURES = [
  {
    name: "an apostrophe in a comment does not become an entry",
    sh: "$allow = @(\n" +
        "    'manifest.json',\n" +
        "    # [1.14.1] TD.1's parser. Referenced by newtab.html and MISSING from this\n" +
        "    # array until TD.2's build caught it.\n" +
        "    'quickadd.js'\n" +
        ")",
    want: ["manifest.json", "quickadd.js"]
  },
  {
    name: "a trailing comment after a real entry is stripped",
    sh: "$allow = @(\n    'a.js',   # it's fine\n    'b.js'\n)",
    want: ["a.js", "b.js"]
  },
  {
    name: "a # inside a quoted entry is NOT a comment",
    sh: "$allow = @(\n    'weird#name.js',\n    'b.js'\n)",
    want: ["weird#name.js", "b.js"]
  },
  {
    name: "ordinary entries are unaffected",
    sh: "$allow = @(\n    'manifest.json',\n    'newtab.html',\n    'locales'\n)",
    want: ["manifest.json", "newtab.html", "locales"]
  }
];

export function runParserSelfTest() {
  const results = [];
  for (const f of PARSER_FIXTURES) {
    const got = localRefs(f.html);
    const ok = got.length === f.want.length && got.every((g, i) => g === f.want[i]);
    results.push({ name: f.name, ok, got, want: f.want });
  }
  for (const f of ALLOWLIST_FIXTURES) {
    const r = parseAllowlistText(f.sh);
    const got = r.ok ? r.entries : ["<<" + r.why + ">>"];
    const ok = got.length === f.want.length && got.every((g, i) => g === f.want[i]);
    results.push({ name: "allowlist: " + f.name, ok, got, want: f.want });
  }
  return results;
}

// ---------------------------------------------------------------------------
// SOURCE B — build.sh's shipping allowlist, READ FROM build.sh.
//
// The allowlist is a PowerShell array literal inside the packaging step:
//     $allow = @(
//       'manifest.json',
//       ...
//     )
// (the `$` is backslash-escaped in build.sh because the block sits inside a
// double-quoted bash string). Parsing it is the whole point: a copy of this list
// living in this file would be a SECOND hand-maintained table, which is the
// defect this gate was rewritten to remove. If this parse ever fails, the gate
// stops with exit 2 rather than falling back to a duplicate.
// ---------------------------------------------------------------------------
export function readAllowlist(buildShPath) {
  if (!fs.existsSync(buildShPath)) {
    return { ok: false, why: `build.sh not found at ${buildShPath}` };
  }
  return parseAllowlistText(fs.readFileSync(buildShPath, "utf8"));
}

// The parse, SEPARATED FROM THE FILE READ so it can be fixtured without a
// temp file. Source B is the allowlist; a source that mis-parses is worse than
// a missing one, because it reports a confident wrong answer.
export function parseAllowlistText(sh) {
  const block = sh.match(/\\?\$allow\s*=\s*@\(([\s\S]*?)\)/);
  if (!block) {
    return { ok: false, why: "could not locate the `$allow = @( ... )` array in build.sh" };
  }
  // COMMENTS COME OUT FIRST, AND THIS IS NOT TIDYING.
  //
  // The scan below pairs single quotes. An APOSTROPHE in a comment is a single
  // quote, so two comment lines reading "TD.1's parser ..." and "... TD.2's
  // build" pair with each other and the text between them is read as an
  // allowlist ENTRY. That is exactly what happened: the [1.14.1] comment added
  // beside 'quickadd.js' produced two phantom entries, and the gate duly
  // reported them under "allowlist entries absent from the repo".
  //
  // Absent entries are only informational, so the gate still passed - which is
  // the part that makes this worth fixing rather than noting. The failure mode
  // in the other direction is silent and real: if an apostrophe pair happened to
  // span a genuine filename, that file would be ALLOWLISTED by a comment, and
  // source B - the thing this gate cross-checks the zip against - would be
  // quietly wrong. An allowlist that can be edited by prose is not an allowlist.
  //
  // Found by TD.4's packaged smoke, which is the first build since the comment
  // landed. Third time a build has caught something no other check could see.
  const uncommented = block[1]
    .split(/\r?\n/)
    .map(function (line) {
      // Everything from the first # that is not inside a quoted string. Walking
      // the line rather than regexing it, because the thing being got wrong here
      // is precisely quote pairing.
      var inQ = false, qc = "";
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQ) { if (ch === qc) inQ = false; continue; }
        if (ch === "'" || ch === '"') { inQ = true; qc = ch; continue; }
        if (ch === "#") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");

  const entries = [];
  const re = /'([^']+)'/g;
  let m;
  while ((m = re.exec(uncommented))) entries.push(norm(m[1]));
  if (!entries.length) {
    return { ok: false, why: "found the `$allow = @( ... )` array in build.sh but it parsed to zero entries" };
  }
  return { ok: true, entries };
}

// Expand directory entries to their files, so comparison happens at file
// granularity. See the header: entry granularity cannot see instance 2.
export function expandAllowlist(entries, repoRoot) {
  const files = [];
  const missing = [];
  for (const e of entries) {
    const abs = path.join(repoRoot, e);
    if (!fs.existsSync(abs)) { missing.push(e); continue; }
    if (fs.statSync(abs).isDirectory()) {
      const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          if (fs.statSync(full).isDirectory()) walk(full);
          else files.push(norm(path.relative(repoRoot, full)));
        }
      };
      walk(abs);
    } else {
      files.push(e);
    }
  }
  return { files, missing };
}

// ---------------------------------------------------------------------------
// THE EXPECTED-UNREFERENCED LIST — the residual hand-maintained surface, named
// rather than hidden.
//
// A file that ships but is referenced by nothing is normally a defect (it is how
// instance 2 announces itself). A few are legitimate. EVERY ENTRY CARRIES A
// REASON, THE GATE PRINTS THE REASON WHEN IT USES ONE, AND AN ENTRY WITH NO
// REASON IS A FAILURE. That is deliberate: adding a file here must be a decision
// someone justifies in writing, not a reflex that silences a warning.
//
// If you are here because the gate told you to add something: the question to
// answer first is "why does this ship at all?", not "how do I make this quiet?".
// ---------------------------------------------------------------------------
export const EXPECTED_UNREFERENCED = [
  {
    p: "assets/placeholder.svg",
    reason: "The favicon fallback, referenced ONLY from JavaScript - seven sites in " +
            "newtab.js, including sessionTabIcon and the delegated error listener that " +
            "replaced the CSP-inert inline onerror. This extractor parses HTML src/href " +
            "attributes, so a path built or assigned in JS is invisible to it BY DESIGN: " +
            "widening it to string literals in JS would match every URL the product ever " +
            "mentions. Ships deliberately; deleting it would show broken images wherever " +
            "a favicon fails to load."
  },
  {
    p: "privacy-policy.html",
    reason: "Ships for the Chrome Web Store listing and is served from GitHub Pages. " +
            "Settings links the HOSTED absolute URL, so no local reference to this file " +
            "exists or should. The original miss that opened Asana 1217989152996164."
  },
  {
    p: "gate.html",
    reason: "Loaded at runtime by the focus-blocking intercept via chrome.runtime.getURL " +
            "(background.js focusHandleNavigation), which no static reference can express."
  },
  {
    p: "offscreen.html",
    reason: "Created at runtime by chrome.offscreen.createDocument for break chimes; " +
            "again a runtime URL, not a static reference."
  },
  {
    p: "sounds/chime1.wav",
    reason: "Selected at runtime by Storage.pomodoroSoundFile; the path is built from the " +
            "user's chosen sound, so no static reference names it."
  },
  {
    p: "sounds/chime2.wav",
    reason: "Selected at runtime by Storage.pomodoroSoundFile; see chime1.wav."
  },
  {
    p: "sounds/chime3.wav",
    reason: "Selected at runtime by Storage.pomodoroSoundFile; see chime1.wav."
  },
  {
    p: "_locales/en/messages.json",
    reason: "Resolved by CHROME, not by us: the manifest's __MSG_extension_name__ / " +
            "__MSG_extension_description__ placeholders are looked up against " +
            "default_locale at install time. The path is a platform convention and is " +
            "never written down anywhere, so it cannot appear as a reference."
  },
];
// package.json was the eighth entry here until 2026-09-01, excused with a reason
// that said in its own words the ship was unjustified. It has now been dropped
// from build.sh's allowlist (Asana 1218045515360272), so it no longer ships and
// no longer needs excusing. The excuse had to go in the same commit: an entry for
// a file that is no longer allowlisted is a stale excuse, which the stale-excuse
// WARN exists to surface. That is the list working as designed.

// ---------------------------------------------------------------------------
// ANTI-VACUITY FLOORS (P13).
//
// A parser that silently stops matching produces small sets that AGREE with each
// other, and agreement is what this gate reports as success. So each source must
// clear a floor, and a breach is exit 2 (gate broken), not exit 1 (violation).
//
// Floors are set near 70% of today's MEASURED counts: low enough that ordinary
// product change never trips them, high enough that a half-broken parser cannot
// slip under. Measured on the 2.1.0 tree: REFERENCED 21, ALLOWED 29 (25
// allowlist entries, six of them directories), PACKAGED 29, HTML pages 4.
// ---------------------------------------------------------------------------
export const FLOOR_REFERENCED = 15;
export const FLOOR_ALLOWED = 20;
export const FLOOR_PACKAGED = 20;
export const FLOOR_HTML_PAGES = 3;

// ---- raw zip central-directory reader (no separator normalization) ----------
export function readZipEntryNames(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip (no EOCD record)");
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const CEN_SIG = 0x02014b50;
  const names = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== CEN_SIG) throw new Error("central dir header mismatch at " + off);
    const fnLen = buf.readUInt16LE(off + 28);
    const exLen = buf.readUInt16LE(off + 30);
    const cmLen = buf.readUInt16LE(off + 32);
    names.push(buf.toString("latin1", off + 46, off + 46 + fnLen)); // RAW bytes
    off += 46 + fnLen + exLen + cmLen;
  }
  return names;
}

// ---- SOURCE A helpers: the manifest's own references -------------------------
export function enumerateManifest(m) {
  const refs = [];
  const globs = [];
  const add = (p, field) => { if (isLocal(p)) refs.push({ p: norm(p), field }); };

  if (m.background) {
    if (m.background.service_worker) add(m.background.service_worker, "background.service_worker");
    (m.background.scripts || []).forEach((s, i) => add(s, `background.scripts[${i}]`));
  }
  Object.entries(m.chrome_url_overrides || {}).forEach(([k, v]) => add(v, `chrome_url_overrides.${k}`));
  Object.entries(m.icons || {}).forEach(([sz, v]) => add(v, `icons.${sz}`));

  const action = m.action || m.browser_action || m.page_action;
  if (action) {
    if (typeof action.default_icon === "string") add(action.default_icon, "action.default_icon");
    else if (action.default_icon) Object.entries(action.default_icon).forEach(([sz, v]) => add(v, `action.default_icon.${sz}`));
    if (action.default_popup) add(action.default_popup, "action.default_popup");
    (action.theme_icons || []).forEach((ti, i) => {
      if (ti.light) add(ti.light, `action.theme_icons[${i}].light`);
      if (ti.dark) add(ti.dark, `action.theme_icons[${i}].dark`);
    });
  }
  (m.web_accessible_resources || []).forEach((w, i) => {
    const list = Array.isArray(w) ? w : (w && w.resources) || (typeof w === "string" ? [w] : []);
    list.forEach((r, j) => {
      if (!isLocal(r)) return;
      const field = `web_accessible_resources[${i}].resources[${j}]`;
      if (isGlob(r)) globs.push({ p: norm(r), field });
      else refs.push({ p: norm(r), field });
    });
  });
  (m.content_scripts || []).forEach((cs, i) => {
    (cs.js || []).forEach((p, j) => add(p, `content_scripts[${i}].js[${j}]`));
    (cs.css || []).forEach((p, j) => add(p, `content_scripts[${i}].css[${j}]`));
  });
  return { refs, globs };
}

export function importScriptsRefs(file) {
  const js = fs.readFileSync(file, "utf8");
  const out = [];
  const re = /importScripts\s*\(\s*([^)]*)\)/g;
  let m;
  while ((m = re.exec(js))) {
    const inner = m[1];
    const sre = /['"]([^'"]+)['"]/g;
    let s;
    while ((s = sre.exec(inner))) if (isLocal(s[1])) out.push(norm(s[1]));
  }
  return out;
}
