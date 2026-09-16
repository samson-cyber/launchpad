#!/usr/bin/env node
// ===========================================================================
// [1.5.0] THE i18n CENSUS — the instrument check-i18n-sites cannot be.
//
// WHY THIS EXISTS AS A FILE AT ALL. e8b1a10's census was run ad hoc and its
// numbers reached Asana as prose. That is exactly the shape of claim nobody can
// re-check: "newtab.js 154" is either reproducible or it is a memory. This
// round's closing condition is "the population is zero", and a zero nobody can
// re-derive is worth nothing at all. So the probe is committed, it prints every
// survivor rather than counting them, and the next session can run it.
//
// WHAT IT MEASURES, AND HOW IT DIFFERS FROM check-i18n-sites.
//
//   check-i18n-sites asks: is there prose at a CONSTRUCTION SITE I can parse?
//   It is precise, it enforces, and it is BLIND to eight shapes — template
//   literals, prose in an array consumed later, textContent from a variable set
//   elsewhere, a bare argument to a helper. Its "0 strings await migration" is
//   true and is about the shapes it reaches.
//
//   This census asks: is there an English SENTENCE anywhere in this file that
//   is not already a catalogue key? No parsing of context at all. It cannot
//   enforce, because it cannot tell a sentence shown to a user from a sentence
//   in a throw() nobody sees — that judgement is the reader's.
//
// IT OVER-COLLECTS ON PURPOSE. A census that guesses "probably not user-facing"
// and stays quiet is how 154 live strings sat behind a green gate. Every
// survivor is printed with its file, line and text, so the classification can
// be READ rather than trusted. A false positive costs a glance; a false
// negative costs a round.
//
// Exit codes: 0 population zero (or ALLOW covers it) · 1 survivors · 2 broken.
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The shipped .js, taken from build.sh's allowlist. locales/* is the catalogue
// itself and is the one file whose prose is SUPPOSED to be prose.
const FILES = [
  "newtab.js", "background.js", "storage.js", "license.js", "tracking.js",
  "companion.js", "importers.js", "bookmarks.js", "quickadd.js", "gate.js",
  "pro-access.js", "i18n.js", "i18n-dom.js", "offscreen.js",
];

// ---------------------------------------------------------------- tokenizer
// Same shape as check-i18n-sites': walk the source, know what a string is, and
// never regex for one. Comments are dropped as they are met, not stripped in a
// pre-pass, because a pre-pass cannot tell `"// not a comment"` from a comment.
// A `/` is a regex only in a position where a VALUE may begin. Getting this
// wrong is not a rounding error: `/['"]/` swallows the rest of the file as a
// string, and the census then reports comment text as user-facing prose. That
// is how the first run of this probe produced 715 survivors instead of 177.
// check-i18n-sites has the same blind spot and works around it by discarding
// any literal that spans lines; this reads the position instead.
const VALUE_POSITION = /[(,=:[!&|?{};+\-*%~^<>]$/;
const VALUE_KEYWORD = /\b(return|typeof|instanceof|in|of|new|delete|void|do|else|case|yield|await)$/;

function tokenize(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  let lastSig = "";          // last significant char, for the regex decision
  while (i < n) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    // line comment
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    // block comment
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
      i += 2; continue;
    }
    // regex literal — consumed and discarded, but its CHARACTER CLASS must be
    // skipped as a unit, because `/[/]/` is legal and the `/` inside is not
    // the terminator.
    if (c === "/") {
      const before = src.slice(Math.max(0, i - 24), i).replace(/\s+$/, "");
      if (!before || VALUE_POSITION.test(before) || VALUE_KEYWORD.test(before)) {
        let j = i + 1, inClass = false;
        while (j < n) {
          if (src[j] === "\\") { j += 2; continue; }
          if (src[j] === "\n") break;                 // unterminated: not a regex
          if (src[j] === "[") inClass = true;
          else if (src[j] === "]") inClass = false;
          else if (src[j] === "/" && !inClass) { j++; break; }
          j++;
        }
        while (j < n && /[a-z]/.test(src[j])) j++;    // flags
        i = j; lastSig = "/"; continue;
      }
      i++; lastSig = "/"; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c, startLine = line;
      let j = i + 1, buf = "";
      while (j < n) {
        if (src[j] === "\\") {
          // Keep the ESCAPE'S MEANING, not its spelling: "·" and "·" are
          // the same character to a reader and must census the same.
          const e = src[j + 1];
          if (e === "n") buf += "\n";
          else if (e === "t") buf += "\t";
          else if (e === "u" && src[j + 2] === "{") {
            const close = src.indexOf("}", j + 3);
            buf += String.fromCodePoint(parseInt(src.slice(j + 3, close), 16));
            j = close + 1; continue;
          } else if (e === "u") {
            buf += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16));
            j += 6; continue;
          } else buf += e;
          j += 2; continue;
        }
        if (src[j] === quote) break;
        // A template's ${...} is a HOLE, not text. Replace it with a marker so
        // "Deleted ${n} items" censuses as prose rather than as two fragments.
        if (quote === "`" && src[j] === "$" && src[j + 1] === "{") {
          let depth = 1, k = j + 2;
          while (k < n && depth > 0) {
            if (src[k] === "{") depth++;
            else if (src[k] === "}") depth--;
            else if (src[k] === "\n") line++;
            k++;
          }
          buf += "\u0000"; j = k; continue;
        }
        if (src[j] === "\n") line++;
        buf += src[j]; j++;
      }
      out.push({ text: buf, line: startLine, quote, index: i });
      i = j + 1; lastSig = quote; continue;
    }
    lastSig = c;
    i++;
  }
  return out;
}

// SELF-TEST. The tokenizer is the whole instrument: if it desyncs, the census
// reports garbage, and if it over-skips it reports zero. Both failures look
// like a finished migration. Neither is caught by a count floor, so the shapes
// that actually broke it are pinned here as fixtures.
const TOKENIZER_FIXTURES = [
  { name: "regex holding a quote",  src: `var re = /['"]/g; var s = "Name is required.";`, want: ["Name is required."] },
  { name: "regex holding a slash",  src: `var re = /[/]/; var s = "Could not create task.";`, want: ["Could not create task."] },
  { name: "division is not a regex", src: `var a = w / 2; var b = h / 2; var s = "Pause tracking";`, want: ["Pause tracking"] },
  { name: "template hole",          src: "var s = `Deleted ${n} items`;", want: ["Deleted \u0000 items"] },
  { name: "escape means its char",  src: `var s = "a \\u00B7 b";`, want: ["a · b"] },
  { name: "apostrophe in comment",  src: `// don't\nvar s = "No goals match that.";`, want: ["No goals match that."] },
  { name: "quote inside a string",  src: `var s = "she said \\"hi\\" loudly";`, want: [`she said "hi" loudly`] },
];
for (const fx of TOKENIZER_FIXTURES) {
  const got = tokenize(fx.src).map((t) => t.text);
  const ok = fx.want.every((w) => got.includes(w));
  if (!ok) {
    console.log("CENSUS BROKEN — tokenizer self-test failed: " + fx.name);
    console.log("  wanted to see: " + JSON.stringify(fx.want));
    console.log("  got:           " + JSON.stringify(got));
    process.exit(2);
  }
}

// ------------------------------------------------------------- exclusions
// Each is a SHAPE with a name, so a survivor list can be argued with. An
// unnamed `if` in a filter chain is how a census quietly stops seeing things.
// THE CENSUS MEASURES THE PROSE A USER COULD READ, NOT THE LITERAL. Most of
// this codebase's long strings are markup with a word or two of text threaded
// through them, and a probe that tests the raw literal reports every <svg> icon
// as a survivor. So each literal is reduced to the text a browser would render
// and THAT is what gets classified. `'<div class="dash-sub">in '` reduces to
// "in " and drops out; `'<h3>No goals match that.</h3>'` reduces to the
// sentence and stays.
function visibleText(s) {
  return s
    .replace(/<[^<>]*>/g, " ")            // whole tags
    .replace(/<\/?[a-z][^<>]*$/i, " ")    // a tag opened and left unclosed
    .replace(/^[^<>]*>/, " ")             // the tail of a tag opened elsewhere
    .replace(/[a-z-]+\s*=\s*["']?/gi, " ")// stray attribute syntax between them
    .replace(/&[a-z]+;|&#\d+;/gi, " ")    // entities
    .replace(/\u0000/g, " ")              // a template hole
    .replace(/\s+/g, " ")
    .trim();
}

const NOT_PROSE = [
  { name: "empty-or-tiny",   re: /^.{0,2}$/s },
  { name: "no-space",        re: /^\S+$/ },              // one token: an id, a key, a class
  { name: "url",             re: /^(https?:|mailto:|data:|blob:|chrome|\/\/)/i },
  { name: "path",            re: /^[.\/\\]|\.(js|css|html|json|png|svg|ico|mp3|wav)$/i },
  // CSS declarations are LOWER CASE. Matching case-insensitively here excluded
  // "Groceries: oat milk, coffee, the good bread." — a demo note — as though it
  // were a style rule. A false negative in a census is the dangerous direction:
  // it removes a live string from the list nobody then re-checks.
  { name: "css-decl",        re: /^[a-z-]+\s*:\s*\S|;\s*$|^var\(--|^\d+(px|rem|em|%|s|ms)\b/ },
  { name: "css-selector",    re: /^[.#\[][A-Za-z0-9_-]/ },
  { name: "format-spec",     re: /^%[sdoc]|^\{[a-z_]+\}$/i },
  { name: "sql-or-json",     re: /^\s*[{[]/ },
  // A sentence is words. This asked for two runs of >=2 letters separated by
  // non-letters, which "Ship Q3 report" and "May 31" both FAIL — the digit sits
  // between the letter runs and breaks the pattern, so two demo strings were
  // silently dropped. The floor is now: a run of >=3 letters somewhere, plus a
  // space (the no-space rule above already took single tokens). That admits
  // "Ship Q3 report" and still refuses "rgba(30, 30, 30, 0.85)" and "12 4 8".
  { name: "not-words",       re: /^(?![\s\S]*[A-Za-z]{3,})/ },
  { name: "all-caps-const",  re: /^[A-Z0-9_ ]+$/ },
  // SVG path data: "M12 2 L4 7 v10" reads as words to the rule above.
  { name: "svg-path-data",   re: /^[Mm][\d\s.,-]+[A-Za-z][\d\s.,-]/ },
  // A CLASS LIST. "pp-prio pp-prio-urgent" is two words to the rule above and
  // is not a sentence in any language. The discriminator is that every token is
  // lower-case-hyphenated and at least one carries a hyphen — English prose
  // does not look like that, and a class name never capitalises.
  { name: "class-list",      re: /^(?=[a-z0-9 -]+$)(?=.*-)[a-z0-9-]+(?: [a-z0-9-]+)*$/ },
  // Attribute residue left after visibleText(): a stray quote with a lower-case
  // token or two around it. It MUST contain a quote character — without that
  // requirement the rule reads "Session Buddy" as residue, which is how the
  // importer format names briefly vanished from this census. Case-sensitive for
  // the same reason: a capital letter means prose, not an attribute value.
  { name: "attr-residue",    re: /^(?=[^"']*["'])["'\s]*(?:[a-z-]+|true|false)?["'\s]+(?:[a-z-]+|true|false)?["'\s]*$/ },
  // A CSS SELECTOR with structure - attribute matchers, pseudo-classes. These
  // read as words ("input select textarea") to every rule above.
  { name: "css-selector-complex", re: /\[[a-z-]+[\]=]|\]:|:not\(|:checked\b/i },
  // A CSS FUNCTION VALUE: transforms, gradients, url(). "translateX(-50%)
  // rotate(180deg)" is two words to the word rule.
  { name: "css-function-value",   re: /^(?:translate|rotate|scale|matrix|linear-gradient|radial-gradient|rgba?|url)\s*\(|\b(?:translate3d|rotate)\(/ },
  { name: "media-query",          re: /^\(\s*(?:prefers|min|max)-/ },
  // A BARE CSS PROPERTY left at the end of a concatenated fragment - `'"
  // style="background:' + colour`. After the markup strip it is a property name
  // and a colon and nothing else, which the word rule reads as text.
  // (`--` included: a custom property such as `--note-rot` is still a property.)
  { name: "css-property-stub",    re: /^["'\s;]*-{0,2}[a-z]+(?:-[a-z]+)*\s*:\s*$/ },
  { name: "mime-type",            re: /^[a-z]+\/[a-z0-9.+-]+\s*;?\s*(?:charset|utf)/i },
  { name: "query-string",         re: /^\?[a-z_]+=/i },
];

// CONTEXT RULES. Some strings are only classifiable by WHERE they sit, not by
// how they look: "no active workspace" is prose by every shape test and is an
// internal invariant nobody sees. These read the string's own line - the same
// move check-i18n-sites makes for its console exemption.
const NOT_PROSE_IN_CONTEXT = [
  // A diagnostic printed to the console. Developer-facing by construction: it
  // reaches a DevTools pane, never a DOM sink.
  { name: "console-diagnostic", re: /\bconsole\.(log|warn|error|debug|info|trace)\s*\(/ },
  // A thrown Error's message. These are programming-error invariants - "the
  // writer refused", "a container element is required" - and are read by whoever
  // is debugging, not by the user. A thrown message that IS shown to the user
  // reaches them through a catch that formats it, and that sentence is a
  // separate string this census still sees.
  { name: "thrown-invariant",   re: /\bthrow\s+new\s+[A-Za-z]*Error\s*\(/ },
];

// Strings whose FIRST argument position is a key, not prose: the catalogue call
// itself. Detected at the call site rather than by shape, because a key like
// "common_empty_note" is indistinguishable from a snake_case sentinel.
const KEY_CALL = /\b(?:I18n\.)?(?:t|th|thHtml)\s*\(\s*$/;

// ------------------------------------------------------------------- ALLOW
// A survivor that has been READ and ruled not user-facing prose. Each carries
// the reason, because "we looked at it" is the entire value of this list.
//
// EVERY ENTRY IS A SUBSTRING MATCH ON THE STRING'S OWN TEXT, not a line number:
// line numbers move with every edit and an allowlist keyed on them silently
// stops covering what it named.
const ALLOW = [
  { why: "a JS directive, not text", re: /^use strict$/ },
  { why: "console diagnostic - reaches DevTools, never a DOM sink", re: /^\[LaunchPad\]/ },

  // --- MARKUP FRAGMENTS the shape rules cannot generalise about ---
  // Each was read at its call site. They are pieces of a tag being concatenated:
  // the words in them are class names, custom-property names and ARIA role
  // values, none of which a translator may touch. They are listed one by one
  // rather than covered by a broader regex, because a regex loose enough to
  // catch all of them starts eating real sentences out of markup.
  { why: "custom-property fragment on a note card", re: /--note-paper/ },
  { why: "workspace chip markup - class names and inline colour", re: /(?:sb-ws-chip|pws-chip)/ },
  { why: "tag swatch markup - class names and inline colour", re: /--swatch-ink/ },
  { why: "bookmark tree row markup - role and depth custom property", re: /--bm-depth/ },
  { why: "session row markup - data attributes and role", re: /^<div class="session-row"/ },
  { why: "wallpaper swatch markup - class names and inline colour", re: /bg-gallery-thumb bg-color-swatch/ },
  { why: "tag pill markup - class names and inline colour", re: /^<span class="' \+ classes/ },

  // NOT OURS TO TRANSLATE - it is CHROME'S. tracking.js matches this substring
  // against the message of an error the browser throws, to tell the expected
  // "no window is focused" case from a real query failure. Translating it would
  // break the match and turn a routine condition back into a console.error.
  // The classic shape of a string that looks like prose and must not move.
  { why: "a Chrome error message this code MATCHES, not emits", re: /^No last-focused window$/ },

  // --- SELECTORS passed to querySelector ---
  { why: "querySelector selector", re: /^\.(?:tt-task-row|pro-tag-row|group)\[data-/ },
  { why: "querySelector selector tail", re: /^"?\]\s*\.(?:tt-task-name|tt-prio-pill|pro-tag-delete|group-name)$/ },
];

// ---------------------------------------------------------------------- run
const argv = new Set(process.argv.slice(2));
const ONLY = process.argv.find((a) => a.startsWith("--file="));
const rows = [];
let tokensSeen = 0;

for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const src = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const srcLines = src.split("\n");
  const toks = tokenize(src);
  tokensSeen += toks.length;
  for (const tk of toks) {
    // Context rules first - they are about the site, not the string. The
    // PREVIOUS line counts too, because a console.log's arguments routinely
    // wrap: `console.log("[LaunchPad] x",\n  n + " bytes against a " + q)`.
    // Only when that previous line is unterminated, so an ordinary string on
    // the line after a finished console call is still censused.
    const ctxLine = srcLines[tk.line - 1] || "";
    const prevLine = srcLines[tk.line - 2] || "";
    const continues = !/[;{}]\s*$/.test(prevLine);
    if (NOT_PROSE_IN_CONTEXT.some((r) => r.re.test(ctxLine) || (continues && r.re.test(prevLine)))) continue;
    // the catalogue call's first argument is a key
    if (KEY_CALL.test(src.slice(Math.max(0, tk.index - 40), tk.index))) continue;
    const t = visibleText(tk.text);
    let excluded = null;
    for (const rule of NOT_PROSE) if (rule.re.test(t)) { excluded = rule.name; break; }
    // A few shapes are about the LITERAL, not the text a browser would show:
    // stripping markup out of "?quantity=1&redirect_url=" leaves "?1&", which no
    // longer looks like a query string to the rule written for one. These run
    // against the raw literal as well. Deliberately only the unambiguous ones -
    // widening every rule to the raw string would start excluding real prose.
    if (!excluded) {
      for (const name of ["url", "path", "query-string", "mime-type",
                          "css-selector-complex", "css-function-value", "media-query"]) {
        const rule = NOT_PROSE.find((r) => r.name === name);
        if (rule && rule.re.test(tk.text)) { excluded = name; break; }
      }
    }
    // A MARKUP FRAGMENT: the literal is a piece of a tag being concatenated -
    // it carries attribute syntax or an unclosed tag - and what survives the
    // strip is a couple of leftover words with no sentence in them. Real prose
    // inside markup ("<h3>No goals match that.</h3>") keeps its punctuation or
    // its length and is not touched by this.
    if (!excluded && /=["']|^\s*<|<[a-z][^>]*$/i.test(tk.text) &&
        !/[.!?:]\s*$/.test(t) && t.split(/\s+/).length < 5) {
      excluded = "markup-fragment";
    }
    if (excluded) continue;
    const allowed = ALLOW.find((a) => a.re.test(t) || a.re.test(tk.text));
    rows.push({ file: rel, line: tk.line, text: t, raw: tk.text, allowed: allowed ? allowed.why : null });
  }
}

// P2: a census whose tokenizer broke reads as a population of zero, which is
// the exact answer this round wants to hear. The floor is on TOKENS, which do
// not shrink as prose migrates — a migrated sentence becomes a key, still a
// string — so it measures the instrument, not the backlog.
const TOKEN_FLOOR = 9000;               // measured 9855 at e8b1a10
if (tokensSeen < TOKEN_FLOOR) {
  console.log(`CENSUS BROKEN — tokenized ${tokensSeen} strings, floor ${TOKEN_FLOOR}.`);
  console.log("A census that cannot see strings reports a population of zero.");
  process.exit(2);
}

// --file= narrows the REPORT, never the scan: the token floor above has to see
// the whole population or it stops being a floor.
const survivors = rows.filter((r) => !r.allowed && (!ONLY || ONLY.endsWith(r.file)));
const perFile = {};
for (const r of survivors) perFile[r.file] = (perFile[r.file] || 0) + 1;

console.log("\nI18N CENSUS — every English sentence in shipped .js that is not a catalogue key\n");
if (argv.has("--list") || survivors.length) {
  let cur = null;
  for (const r of survivors) {
    if (r.file !== cur) { cur = r.file; console.log("  " + cur); }
    const shown = r.text.replace(/\u0000/g, "${}").replace(/\n/g, "\\n");
    console.log("    " + String(r.line).padStart(6) + "  " + JSON.stringify(shown.slice(0, 120)));
  }
  console.log("");
}
console.log("  POPULATION PER FILE");
for (const f of FILES) if (perFile[f]) console.log("    " + f.padEnd(16) + String(perFile[f]).padStart(5));
if (!survivors.length) console.log("    (none)");
console.log("  " + "-".repeat(22));
console.log("    " + "TOTAL".padEnd(16) + String(survivors.length).padStart(5));
console.log("\n  strings tokenized: " + tokensSeen + "  (floor " + TOKEN_FLOOR + ")");
console.log("  ruled not-prose by an allowlist entry: " + rows.filter((r) => r.allowed).length);

// ---------------------------------------------------------------- the verdict
// A CENSUS THAT ALWAYS FAILS IS NOT A GATE. The migration finished newtab.js,
// importers.js, companion.js and tracking.js; background.js, storage.js and
// license.js were owned by a parallel session and are still to do. So the gate
// fails on a file that is SUPPOSED to be clean, and holds the rest at a pinned
// count - which means the remainder cannot quietly grow either, and the day
// those three files are migrated this block is deleted rather than edited.
const OWNED_CLEAN = ["newtab.js", "importers.js", "companion.js", "tracking.js",
                     "bookmarks.js", "quickadd.js", "gate.js", "pro-access.js",
                     "i18n.js", "i18n-dom.js", "offscreen.js"];
const REMAINING = { "background.js": 2, "storage.js": 6, "license.js": 4 };

const regressions = survivors.filter((s) => OWNED_CLEAN.includes(s.file));
const overs = Object.entries(REMAINING)
  .filter(([f, n]) => (perFile[f] || 0) > n)
  .map(([f, n]) => `${f}: ${perFile[f]} survivors, pinned at ${n}`);
const unders = Object.entries(REMAINING)
  .filter(([f, n]) => (perFile[f] || 0) < n)
  .map(([f, n]) => `${f}: ${perFile[f] || 0} survivors, pinned at ${n} — migrated? lower the pin`);

if (regressions.length) {
  console.log("\nI18N CENSUS: FAIL — " + regressions.length +
              " new hardcoded string(s) in a file that was migrated to zero:");
  for (const r of regressions) console.log("    " + r.file + ":" + r.line + "  " + JSON.stringify(r.text));
  process.exit(1);
}
if (overs.length) {
  console.log("\nI18N CENSUS: FAIL — a file still awaiting migration grew:");
  for (const o of overs) console.log("    " + o);
  process.exit(1);
}
for (const u of unders) console.log("\n  NOTE  " + u);
console.log("\nI18N CENSUS: PASS — the migrated files are at zero; " +
            survivors.length + " survivor(s) remain in " +
            Object.keys(REMAINING).length + " file(s) owned elsewhere.");
process.exit(0);
