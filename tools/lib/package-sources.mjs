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
// CSS url() REFERENCES. [H0 2026-09-18]
//
// THE GATE COULD NOT SEE A FONT. Before this, "referenced" meant an src or href
// attribute in an HTML page, so a file reached only from a stylesheet was
// invisible: adding fonts/ to the allowlist would have made three woff2 files
// "allowed but never referenced", and the gate would have demanded an
// EXPECTED_UNREFERENCED entry apologising for each - which is exactly the reflex
// that list's own header warns against. The files ARE referenced. The reader
// just could not read the language they are referenced in.
//
// SCOPE, KEPT NARROW ON PURPOSE. This reads url() out of CSS that the pages
// already link. It does NOT read string literals out of JavaScript, for the
// reason assets/placeholder.svg's entry records: widening to JS would match
// every URL the product ever mentions, and a matcher that matches everything
// proves nothing.
//
// COMMENTS ARE STRIPPED FIRST. A commented-out url() is not a reference, and a
// gate that counted one would report a file as referenced when the only thing
// pointing at it was a note explaining why it is not used.
// ---------------------------------------------------------------------------
export const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g;

export function stripCssComments(css) {
  return String(css).replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Local paths a stylesheet points at. Remote, data: and blob: are dropped by
  * isLocal - the SAME filter the HTML side uses, so there is one definition of
  * "local" for both languages rather than two that can drift. A url(#id)
  * fragment is not a file, and isLocal already refuses it. */
export function cssUrlRefs(css) {
  const out = [];
  const src = stripCssComments(css);
  let m;
  CSS_URL_RE.lastIndex = 0;
  while ((m = CSS_URL_RE.exec(src))) {
    const v = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
    if (v === undefined || v === "") continue;
    if (!isLocal(v)) continue;
    out.push(norm(v));
  }
  return out;
}

// Awkward-but-legal CSS, in the same spirit as PARSER_FIXTURES above: each case
// is something a naive regex gets wrong.
export const CSS_FIXTURES = [
  {
    name: "quoted, unquoted and single-quoted url() all resolve",
    css: 'a{background:url("a.png")}b{background:url(b.png)}c{background:url(\'c.png\')}',
    want: ["a.png", "b.png", "c.png"]
  },
  {
    name: "whitespace inside url() does not break the match",
    css: '@font-face{src:url( "fonts/x.woff2" ) format("woff2")}',
    want: ["fonts/x.woff2"]
  },
  {
    name: "remote, data: and fragment urls are not local files",
    css: 'a{background:url(https://x/y.png)}b{background:url(data:image/png;base64,AA)}c{filter:url(#f)}',
    want: []
  },
  {
    name: "a commented-out url() is NOT a reference",
    css: '/* a{background:url(ghost.png)} */ b{background:url(real.png)}',
    want: ["real.png"]
  },
  {
    name: "a leading ./ is normalised the same way an HTML ref is",
    css: 'a{background:url(./sub/d.png)}',
    want: ["sub/d.png"]
  }
];

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
//
// EVERY FIXTURE CARRIES THE SENTINEL, because build.sh's array must. A fixture
// without it is not a smaller build.sh, it is an invalid one, and the three
// `broken` cases below are exactly the fixtures that leave it out or move it.
//
// COUNTS ARE ASSERTED AGAINST A KNOWN LIST, NEVER AGAINST "more than before".
// The defect this file exists to catch produces a SHORT list that is internally
// consistent, so a floor or a trend would have passed it; only naming the
// entries catches it. The `count` fixture below states its number in words as
// well as its entries, so a fixture edited carelessly disagrees with itself.
export const ALLOWLIST_FIXTURES = [
  {
    name: "an apostrophe in a comment does not become an entry",
    sh: "$allow = @(\n" +
        "    'manifest.json',\n" +
        "    # [1.14.1] TD.1's parser. Referenced by newtab.html and MISSING from this\n" +
        "    # array until TD.2's build caught it.\n" +
        "    'quickadd.js'\n" +
        ") # end-allowlist",
    want: ["manifest.json", "quickadd.js"]
  },
  {
    name: "a trailing comment after a real entry is stripped",
    sh: "$allow = @(\n    'a.js',   # it's fine\n    'b.js'\n) # end-allowlist",
    want: ["a.js", "b.js"]
  },
  {
    name: "a # inside a quoted entry is NOT a comment",
    sh: "$allow = @(\n    'weird#name.js',\n    'b.js'\n) # end-allowlist",
    want: ["weird#name.js", "b.js"]
  },
  {
    name: "ordinary entries are unaffected",
    sh: "$allow = @(\n    'manifest.json',\n    'newtab.html',\n    'locales'\n) # end-allowlist",
    want: ["manifest.json", "newtab.html", "locales"]
  },

  // ---- ROUND D: the second prose trap, aa79686 -----------------------------
  {
    // THE FIXTURE THIS ROUND EXISTS FOR. Under the old non-greedy match this
    // returned ["manifest.json"] and reported ok - a short list, silently.
    roundD: true,
    name: "a ) in a comment above the close does NOT truncate the array",
    sh: "$allow = @(\n" +
        "    'manifest.json',\n" +
        "    # A DIRECTORY (like lib and sounds) so a fourth subset follows.\n" +
        "    'fonts',\n" +
        "    'sounds'\n" +
        ") # end-allowlist",
    want: ["manifest.json", "fonts", "sounds"]
  },
  {
    roundD: true,
    name: "a ) inside a quoted entry does not close the array either",
    sh: "$allow = @(\n    'odd)name.js',\n    'b.js'\n) # end-allowlist",
    want: ["odd)name.js", "b.js"]
  },
  {
    roundD: true,
    name: "a balanced ( ) pair in a comment leaves the depth where it found it",
    sh: "$allow = @(\n" +
        "    # see tokens.css (the @font-face block) for why\n" +
        "    'fonts',\n" +
        "    'sounds'\n" +
        ") # end-allowlist",
    want: ["fonts", "sounds"]
  },
  {
    roundD: true,
    name: "count: eight entries, named, so a careless edit disagrees with itself",
    sh: "$allow = @(\n" +
        "    'manifest.json', 'newtab.html', 'newtab.js',\n" +
        "    # a comment with a ) and an apostrophe: TD.1's\n" +
        "    'tokens.css', 'locales', 'lib',\n" +
        "    'fonts', 'sounds'\n" +
        ") # end-allowlist",
    want: ["manifest.json", "newtab.html", "newtab.js", "tokens.css", "locales", "lib", "fonts", "sounds"],
    count: 8
  },

  // ---- the three mutations, each of which must be BROKEN, not a short list --
  {
    roundD: true,
    name: "BROKEN: the sentinel is missing",
    sh: "$allow = @(\n    'manifest.json',\n    'fonts'\n)",
    broken: /sentinel/i
  },
  {
    roundD: true,
    name: "BROKEN: the sentinel is present but the array is never closed",
    sh: "$allow = @(\n    'manifest.json',\n    'fonts'\n# end-allowlist\n$root = (Get-Location).Path\n",
    broken: /never closed|sentinel/i
  },
  {
    roundD: true,
    name: "BROKEN: the opener is gone",
    sh: "$deny = @(\n    'manifest.json'\n) # end-allowlist",
    broken: /opener/i
  }
];

export function runParserSelfTest() {
  const results = [];
  for (const f of PARSER_FIXTURES) {
    const got = localRefs(f.html);
    const ok = got.length === f.want.length && got.every((g, i) => g === f.want[i]);
    results.push({ name: f.name, ok, got, want: f.want });
  }
  for (const f of CSS_FIXTURES) {
    const got = cssUrlRefs(f.css);
    const ok = got.length === f.want.length && got.every((g, i) => g === f.want[i]);
    results.push({ name: "css: " + f.name, ok, got, want: f.want });
  }
  for (const f of ALLOWLIST_FIXTURES) {
    const r = parseAllowlistText(f.sh);
    let ok, got, want;
    if (f.broken) {
      // A BROKEN FIXTURE ASSERTS THE REFUSAL AND ITS REASON. Asserting only
      // ok===false would pass for a parser broken in some other way, which is
      // the shape of vacuity P13 is about.
      got = r.ok ? "parsed " + r.entries.length + " entr(ies)" : r.why;
      ok = r.ok === false && f.broken.test(r.why);
      want = "BROKEN, why matching " + String(f.broken);
    } else {
      got = r.ok ? r.entries : ["<<" + r.why + ">>"];
      ok = got.length === f.want.length && got.every((g, i) => g === f.want[i]);
      // The stated count and the stated list must agree with EACH OTHER as
      // well as with the parse, so a fixture edited on one side fails.
      if (f.count !== undefined && (f.count !== f.want.length || got.length !== f.count)) ok = false;
      want = f.want;
    }
    results.push({ name: "allowlist: " + f.name, ok, got, want });
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

// THE SENTINEL. build.sh's allowlist must END with this exact line, and the
// parser refuses the file if it does not. See parseAllowlistText for why a
// second, redundant-looking defence is here at all.
export const ALLOWLIST_SENTINEL = ") # end-allowlist";

// The parse, SEPARATED FROM THE FILE READ so it can be fixtured without a
// temp file. Source B is the allowlist; a source that mis-parses is worse than
// a missing one, because it reports a confident wrong answer.
//
// =============================================================================
// TWO PROSE TRAPS, AND WHY THE FIX IS TWO DEFENCES RATHER THAN ONE
// =============================================================================
// This array has now been silently edited by its own comments TWICE, from
// opposite ends:
//
//   d5dd9e3  AN APOSTROPHE ADDED ENTRIES. The reader paired single quotes
//            across comment lines, so "TD.1's parser" and "TD.2's build" paired
//            with each other and the prose between them became an entry.
//   aa79686  A CLOSING PARENTHESIS REMOVED THEM. The reader located the block
//            with a NON-GREEDY match that stopped at the first `)`, so one in a
//            comment ended the array early and every entry below it vanished.
//            H0 hit this twice in one round: first in a comment about the fonts
//            directory, then again in the comment WARNING about the trap, which
//            contained the character inside the warning.
//
// Both are the same defect - the allowlist being editable by prose - and the
// first fix's own line said an allowlist that can be edited by prose is not an
// allowlist.
//
// THE SHRINKING DIRECTION IS THE DANGEROUS ONE. An entry that appears is noisy
// and informational. An entry that DISAPPEARS takes the gate's coverage with
// it: everything below the cut stops being enforced, nothing goes red, and the
// first thing that notices is a packaged build. That is the importers.js shape,
// and it has reached a real build three times.
//
// SO: A WALK, AND A SENTINEL.
//
// THE WALK finds the array's real close by BRACKET DEPTH, tracking quoted
// strings and comments as it goes - d5dd9e3's per-line walk for `#`, extended
// to parentheses and run over the whole block. It also collects the entries as
// it walks, so there is no second pass over "uncommented" text that could
// disagree with the first. A `)` in a comment is now simply a character in a
// comment.
//
// THE SENTINEL requires the array to end with the exact line `) # end-allowlist`
// and returns BROKEN if it does not. It is deliberately redundant with the walk,
// because the failure this file is guarding is SILENCE: a truncated parse looks
// exactly like a short allowlist, and every consumer of a short allowlist agrees
// with every other consumer of the same short allowlist. The walk makes the
// parse correct; the sentinel makes a wrong parse impossible to mistake for a
// correct one. If a third trap is ever found in a third character, the sentinel
// catches it on the day it lands rather than on the next release build.
//
// BOTH CONSUMERS ALREADY EXIT 2 ON ok:false - check-html-refs.mjs:119 and
// verify-package.mjs:151 - so BROKEN is wired through without either gate
// changing. That was checked, not assumed.
// =============================================================================
export function parseAllowlistText(sh) {
  const open = /\\?\$allow\s*=\s*@\(/.exec(sh);
  if (!open) {
    return { ok: false, why: "could not locate the `$allow = @(` array opener in build.sh" };
  }

  const bodyStart = open.index + open[0].length;
  const entries = [];
  let depth = 1;          // the @( we just consumed
  let quote = null;       // "'" or '"' while inside a string
  let quoteStart = -1;    // where the current single-quoted string's body began
  let inComment = false;  // from an unquoted # to the end of its line
  let close = -1;

  for (let i = bodyStart; i < sh.length; i++) {
    const ch = sh[i];

    if (inComment) {
      // A comment runs to the newline and NOTHING inside it is code. This one
      // line is the whole of the second trap's fix: a `)` here is a character.
      if (ch === "\n") inComment = false;
      continue;
    }

    if (quote) {
      if (ch !== quote) continue;
      // Only SINGLE-quoted strings are allowlist entries; that is what the
      // array is written in, and it is what the old regex matched.
      if (quote === "'" && i > quoteStart) entries.push(norm(sh.slice(quoteStart, i)));
      quote = null;
      continue;
    }

    if (ch === "'" || ch === '"') { quote = ch; quoteStart = i + 1; continue; }
    if (ch === "#") { inComment = true; continue; }
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth--; if (depth === 0) { close = i; break; } }
  }

  if (close === -1) {
    return { ok: false, why:
      "the `$allow = @( ... )` array is never closed - walked to the end of build.sh " +
      "at depth " + depth + " without the parenthesis depth returning to zero" };
  }

  // THE SENTINEL, checked on the close parenthesis's OWN LINE. Taking the line
  // from the close rather than searching the file for the string is what makes
  // mutation 3 fail: delete the array's `)` and leave the marker behind, and the
  // walk runs on into the packaging code and closes on some later parenthesis -
  // whose line is not the sentinel, so this refuses rather than returning a
  // parse of everything in between.
  const lineEnd = sh.indexOf("\n", close);
  const closeLine = (lineEnd === -1 ? sh.slice(close) : sh.slice(close, lineEnd)).replace(/\r$/, "");
  if (closeLine.trim() !== ALLOWLIST_SENTINEL) {
    return { ok: false, why:
      "the `$allow = @( ... )` array does not end with the sentinel line `" +
      ALLOWLIST_SENTINEL + "` - it ends with " + JSON.stringify(closeLine.trim()) + ". " +
      "The sentinel is required so that a TRUNCATED parse cannot pass as a short " +
      "allowlist: without it, a stray `)` in a comment silently removes every " +
      "entry below it and every gate agrees on the short list (aa79686)." };
  }

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
    p: "fonts/OFL.txt",
    reason: "The SIL Open Font License, shipped because the licence REQUIRES it: Space " +
            "Grotesk is OFL-1.1, and clause 2 says the copyright notice and licence must " +
            "travel with the font files in any redistribution - which is what putting a " +
            "woff2 inside a Chrome Web Store zip is. Nothing references it and nothing " +
            "should: it is a legal artifact, not a resource the product loads. The three " +
            "space-grotesk-*.woff2 beside it ARE referenced, from the @font-face src in " +
            "tokens.css, which this gate learned to read in the same commit. Deleting " +
            "this file would make the build non-compliant while changing nothing a user " +
            "can see, which is the most dangerous shape of unreferenced file there is.",
  },
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

  // [1.16.0] THE SIDE PANEL'S ENTRY, and this reader not knowing the key was a
  // real gap the moment one existed. side_panel.default_path declares an HTML
  // page exactly as chrome_url_overrides and action.default_popup do; without
  // this line check-html-refs saw an allowlisted file that nothing explained and
  // refused the build - correct in shape, wrong in fact. The alternative, adding
  // it to EXPECTED_UNREFERENCED, would have put a declared file in the set
  // reserved for undeclared ones and hidden the gap instead of closing it.
  if (m.side_panel && m.side_panel.default_path) {
    add(m.side_panel.default_path, "side_panel.default_path");
  }

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
