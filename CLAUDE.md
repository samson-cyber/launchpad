# LaunchPad — Project Anchor for Claude

This document is the entry point for any Claude Chat or Claude Code session working on LaunchPad. Read it first before taking action.

---

## What LaunchPad Is

LaunchPad is a Chrome extension that replaces Chrome's default new tab page with a customizable shortcut dashboard. It has two tiers:

- **LaunchPad (free)** — Shipped on Chrome Web Store. Unlimited shortcuts, groups, drag-and-drop, session restore, history panel, wallpapers, backup/export. Privacy-first, all data local.
- **LaunchPad Pro** — **Shipped and sold since v2.0.0 (2026-08-14)**, $4.99/month or $39/year with a 7-day no-card trial. Workspaces (Work/Personal) + task/goal system + tab time tracking + Day Recap + achievements. Positioned as a browser-based productivity companion for portfolio workers, deep-work seekers, and people wanting accountability without surveillance. *(This line read "in development" until 2026-09-01, more than two months after Pro went on sale — a stale tier label reads as a release-state claim, so it is corrected here rather than left to mislead a session.)*

## RELEASE STATE — as of 2026-09-01

**TWO VERSIONS MATTER AT ONCE, AND COLLAPSING THEM INTO ONE SENTENCE IS THE ERROR THIS BLOCK EXISTS TO PREVENT.** Read both lines before writing anything about what shipped.

- **`2.1.0` is SUBMITTED and AWAITING REVIEW.** Uploaded to the Chrome Web Store on **2026-09-01**. **Submitted is not published.** Until Google approves it, no user has it. Do not call 2.1.0 live, shipped, released, or "out" — it is *in review*.
- **`2.0.0` is the LIVE store version**, and stays the live version until 2.1.0 clears review. It is therefore still the **store baseline**: the manifest any permission diff must be taken against is 2.0.0's, because that is what users would be upgrading *from*.

Supporting facts for 2.1.0:

- **The manifest is at `2.1.0`.** This time that number does match a real submission — but that is timing, not a rule. See the doctrine below before using it as evidence of anything.
- **Artifact:** `launchpad-2.1.0-15797ad.zip`, built from **`15797ad`**, sha256 `b6f47738fe7c836a34acf8d83ede3ad7c17f94cfd3f3955ca6b5fd18145d1f28`. Deleted from disk after upload per the no-candidate-zip rule; reproducible from `15797ad`.
- **Tag:** **`v2.1.0`** exists, annotated, pushed to origin, peeling to `15797ad`.
- **`2.0.1` was built and NEVER submitted.** Samson deferred it on 2026-08-29 so its four items (Insights date-range selector, the drag-to-nest refusal toast, the Rate-link host move, the `tracking.js` NUL escaping) would ride inside a larger update rather than spend a review cycle on a point release days after 2.0.0 reached users. That larger update is 2.1.0, and those four items reached the store inside it. **There is deliberately no `v2.0.1` tag.** Keep this fact — the doctrine below turns on it.

Earlier releases: v2.0.0 submitted 2026-08-14 (the Pro launch; confirmed live — a store-installed `2.0.0_0` sits beside `1.0.5_0` under the store extension id `jfmmagapjdionoomkjmkfppcplkjilnp` in the local browser profiles). v1.0.5 shipped 2026-07-21, v1.0.4 on 2026-04-23. Asana 1217318434594388 (2.0.0 scope) and 1217967430924095 (release engineering) hold the history, including gate tables and artifact hashes for every build.

**HOW RELEASE STATE IS DETERMINED: THE ANNOTATED TAGS, NEVER THE MANIFEST.** A present `v<version>` tag means that version was submitted; an absent one means it was not. `v1.0.5` (`3eb9323`), `v2.0.0` (`92eeb68`) and `v2.1.0` (`15797ad`) all exist; there is no `v2.0.1`, correctly. **A manifest bump is never evidence that a release occurred** — it records what the next submission would carry, not what users have. `2.0.1` is the standing counter-example: the manifest read `2.0.1` for three days with no release behind it. Note also what a tag does *not* tell you: it records **submission**, not approval. `v2.1.0` existing means 2.1.0 was uploaded, not that it is live.

> **CORRECTION, 2026-08-30 — kept because the shape of this error recurs.** This block previously read "nothing after v1.0.5 has ever been uploaded" and "v2.0.0 was built and never submitted". **Both were false.** The 2026-08-29 docs pass over-corrected after Samson deferred *2.0.1*, and generalised that deferral backwards onto 2.0.0; the 2026-08-30 docs sync then propagated it into ROADMAP.md. Caught during 2.1.0 release engineering by two independent pieces of evidence: an **annotated `v2.0.0` tag on `92eeb68`** reading "submitted to the Chrome Web Store 2026-08-14", and a **store-installed `2.0.0_0` build in the local profiles**. The release-shell task (1217967430924095) had said so in its own notes all along. **The lesson is in the shape of the error: a deferral of one release was written up as a statement about a different one.** That same shape is live right now, in a new form — 2.1.0 is *submitted* and 2.0.0 is *live*, and any sentence that merges those two states will be wrong about one of them.

**THE NEXT STORE SUBMISSION HAS NO NUMBER YET**, and it must not get one until it is cut: the manifest is bumped manually, only at a submission. Its store baseline will be whatever is live at that moment — `2.0.0` today, `2.1.0` once approved. Its annotated tag is applied at submission, and **its artifact is built fresh from the commit being submitted**. An older zip is never resurrected: master has moved since every previous build, so any surviving artifact would ship code that no longer matches the tree it was cut from.

- **NO CANDIDATE ZIP EXISTS BETWEEN RELEASES, BY DESIGN.** A gate-blessed artifact sitting on disk while master keeps moving is the stale-candidate hazard in its purest form — it looks authoritative, it passes its own checks, and it is wrong the moment the next commit lands. The 2.0.0, 2.0.1 and 2.1.0 artifacts were each retired once their purpose was served — 2.0.0 and 2.1.0 once uploaded, 2.0.1 once deferred; their sha256, byte counts and gate results live in the Asana threads, and each is reproducible from its commit (`92eeb68`, `23a250f`, `15797ad`). If you find a zip in the repo root outside an active submission, it is stale: delete it rather than reason about it.
- **ARTIFACT-STAMPING IS STANDING PRACTICE.** Every build that leaves the tree is stamped `launchpad-<version>-<shorthash>.zip`, published with its sha256 and byte count, and **the superseded zip is deleted in the same step**. An unstamped `launchpad.zip` cannot identify itself, and a stale zip left on disk is the one that eventually gets uploaded.
- **The annotated tag follows the ARTIFACT, and is applied AT SUBMISSION** — `v<manifest-version>` on the exact commit the uploaded zip was built from, extension repo only. **`v1.0.5` (`3eb9323`), `v2.0.0` (`92eeb68`) and `v2.1.0` (`15797ad`) all exist.** There is deliberately **no `v2.0.1` tag**, because 2.0.1 was never submitted — which is the rule working exactly as intended, and is also the fact that should have prevented the release-state error corrected above: a missing tag means "not submitted", and a present one means it was.

---

## Developer

- **Samson Stephens** (alias CyberSam) — solo developer, based in Bali, Indonesia
- GitHub: `github.com/samson-cyber/launchpad`
- Contact: `info.skewed@gmail.com`
- Buy Me a Coffee: `buymeacoffee.com/cybersamwise`

Background as Amazon seller and Shopify user. This informs product design and target audience.

---

## Local Development Paths

**All dev work lives under `C:\Dev\Git\` — NEVER under OneDrive paths.** OneDrive corrupted git metadata for multiple repos in April 2026; the environment was migrated out entirely on 2026-04-23.

- Repo: `C:\Dev\Git\launchpad`
- Docs: `C:\Dev\Git\launchpad\docs\`

Other projects in the same dev root: `reelabs`, `condence-ai`, `exhale-health`, `Git-parent` (which contains WhatsBiting and whatsbiting-website as subdirectories).

---

## Git Configuration

- **Default branch: `master`** (not `main`)
- Old `main` branch has been deleted. Preserved as `main-archive` tag at commit `ac0c2ad` for historical reference.
- `build.sh` refuses to build when the working tree has uncommitted changes. **Never bypass this guard** — it exists because code shipped to users was not in git for several months, and this was painful to untangle.
- **`build.sh` also reports push state, and that one is a WARNING BY DESIGN, not a guard.** On 2026-09-01 `origin/master` was found sitting **83 commits** behind local: everything from the 2.0.1 batch through the whole 2.1.0 arc existed on one disk, and a release cut then would have stamped and tagged a commit with no remote copy. The clean-tree guard above is absolute because it can always be satisfied by committing; a push guard **cannot be satisfied offline**, and a hard guard that fires on a plane teaches the habit of overriding `build.sh` — after which the clean-tree guard is no longer absolute either. So it warns loudly, never blocks, and reports **UNKNOWN rather than IN SYNC** whenever the fetch behind it did not succeed, because `origin/master` is a local ref and a stale comparison is a confident wrong answer.

---

## Versioning & Release Tagging

LaunchPad uses **two distinct, parallel numbering tracks**. They look alike but mean different things — never conflate them. Full rationale: `docs/DECISIONS.md` (2026-06-13 entry).

- **Store / manifest version (`manifest.json`)** — `X.Y.Z`, the published build users install. Bumped **manually, only at a Chrome Web Store submission**; nothing else touches it. Currently `2.1.0`, submitted **2026-09-01** and **awaiting review** — see the release-state block at the top of this file. `2.0.0` is the last APPROVED build and the one users are on (Pro launch, submitted 2026-08-14). `1.0.3` is intentionally absent in git (uncommitted-ship incident; `1.0.4` was the recommit). The manifest stayed put through all of Pro development, then moved to `2.0.0` on 2026-08-10 for a submission that DID happen, to `2.0.1` on 2026-08-29 for one that did NOT, and to `2.1.0` on 2026-09-01 for one that did. **A manifest bump is therefore not evidence that a release occurred**, and `2.0.1` remains the standing example. The release-state block at the top of this file, cross-checked against the annotated tags, is the source of truth for what shipped.
- **Feature-marker track (commit subjects + Asana task names)** — `[X.Y.Z]` for a roadmap task, `[X.Y.Z.W]` for a split / follow-up / multi-round under one task. Internal planning IDs for Pro work units; runs `[1.0.5.3]…[1.0.13]…` and **never touches `manifest.json`**. One task may span many commits. Planning order, not strict chronology; the convention began at `[1.0.9.1]` (commits before it carry no marker).
- **First Pro store release is a deliberate major bump to `2.0.0`**, permanently separating the store line (`2.x` = Pro era) from the `[1.x.y]` marker track (pre-empts the `[1.1.0]` Notes clash). Plain SemVer from `2.0.0` on.

**Commit subjects:**
- **Feature commits** lead with the marker: `[X.Y.Z(.W)] <subject>`; a Conventional-Commits type may follow optionally (e.g. `[1.0.13] feat(tasks): …`).
- **Non-feature commits** (bugs, docs, chores, refactors) use a Conventional-Commits prefix and **no marker**, and bump nothing: `fix:` / `docs:` / `chore:` / `refactor:` (`perf:` / `style:` / `test:` when apt).

**Release tags:**
- Annotated `v<manifest-version>` on the exact commit submitted to the Web Store, **extension repo only** (website is continuous-deploy; docs are append-only — neither is tagged).
- Tag message: submission date + one-line summary.
- **From the next store submission forward.** Historical builds `1.0.0`–`1.0.4` are not back-tagged (commit↔build mapping isn't reliably reconstructable; `1.0.3` never existed in git).
- **`v1.0.5` is tagged at `3eb9323`** (annotated, pushed 2026-08-09; submitted to the store 2026-07-21). Tagged after the fact, so the method is recorded: the store-installed `1.0.5_0` build was diffed file-by-file against every candidate commit, which narrowed it to exactly **two** — `696ede4` (the `[1.0.5]` Release commit) and `3eb9323` (the zip-separator fix). Those two are content-indistinguishable **by construction**, since `3eb9323` touched only `build.sh` and `tools/verify-package.mjs` and neither ships. `3eb9323` was chosen on build evidence rather than content: at `696ede4`, `build.sh` still used `Compress-Archive`, whose backslash entry separators Chrome rejects on install, and the installed copy has proper subdirectories. Confirmed by Samson.
- **If a future build ever needs identifying this way**, three traps cost a pass each: compare against a detached **worktree**, not raw blobs (`core.autocrlf=true` means git stores LF and checks out CRLF, while `build.sh` zips the checked-out tree); `manifest.json` and the icons can never byte-match, because Chrome's unpacker re-encodes images and rewrites the manifest on install; and a file that differs only in line endings is not evidence of uncommitted code (`license.js` read as an uncommitted-ship incident until the byte arithmetic showed LF-vs-CRLF).

---

## Tech Stack

- **Manifest V3** Chrome extension
- Vanilla HTML / CSS / JavaScript (no build pipeline — direct file edit, reload unpacked)
- **SortableJS** bundled locally (`/lib/Sortable.min.js`) for drag-and-drop. NOT from CDN due to CSP.
- `chrome.storage.local` for data (key: `"data"` — NOT `"launchpad_data"`)
- `chrome.search.query` for search (uses user's default search engine, does NOT offer a picker — removed in v1.0.2 for Chrome Web Store "single purpose" policy)
- `chrome.alarms` for background scheduling (session snapshots, forthcoming tracking flushes)

---

## Key Files

- `manifest.json` — Extension manifest, version, permissions
- `newtab.html` — New tab page markup
- `newtab.js` — All client-side logic (~150 KB as of v1.0.4, will grow with Pro features)
- `newtab.css` — All styles (~66 KB)
- `background.js` — Service worker: session saving, context menus, tab listeners
- `storage.js` — Storage utilities
- `bookmarks.js` — Chrome bookmarks import
- `i18n.js` — Message catalogue engine: `t()` plain text, `th()` HTML-escaped, `Intl.PluralRules`, locale negotiation. DOM-free on purpose, because it also loads in the service worker
- `locales/en.js` — The UI catalogue, ~440 messages, each with a description
- `i18n-dom.js` — The `data-i18n` pass over static markup. Replaces the text NODE, never `textContent`, so inline icons survive
- `privacy-policy.html` — Hosted via GitHub Pages at `https://samson-cyber.github.io/launchpad/privacy-policy.html`
- `build.sh` — ZIP packaging script (with clean-tree guard)

---

## Style and Pattern Constants

- **Frosted glass — three tiers (CSS variables in `newtab.css :root`):**
  - **Card** (panels, sections, cards, submenus): `var(--pro-frost-card-bg)` = `rgba(30,30,30,0.85)`, `var(--pro-frost-card-blur)` = `blur(12px)`.
  - **Floater** (modals, popovers, dropdowns, dialogs): `var(--pro-frost-floater-bg)` = `rgba(30,30,30,0.92)`, `var(--pro-frost-floater-blur)` = `blur(14px)`.
  - **Menu** (context menus, pickers, small high-opacity surfaces): `var(--pro-frost-menu-bg)` = `rgba(30,30,30,0.95)`, `var(--pro-frost-menu-blur)` = `blur(12px)`.
  - Light-wallpaper variants (under `html.bg-light`) override Card and Floater backgrounds to white-tinted equivalents; menus stay dark on light wallpapers. New frosted surfaces MUST use the variables, not literal `rgba(30,30,30,…)` or literal `blur(…)`. Banners/pills with intentionally lower alpha (e.g. `#tab-bar`, `.pro-preview-banner`) are not part of the tier system and stay literal.
- **Background image:** `<body>` with `background-attachment: fixed; background-size: cover;`
- **Sidebar:** JS-class-based expand/collapse with `sidebarLocked` flag (NOT CSS `:hover`). When a panel/menu is open, `sidebarLocked = true` prevents collapse.
- **Text:** White with `text-shadow: 0 1px 3px rgba(0,0,0,0.5)` for readability on wallpapers. Luminance-aware overrides for light backgrounds (v1.0.4+).
- **CSP:** `img-src 'self' https: data: blob:` — allows favicons from any HTTPS domain.

---

## Pro Access States

**There are FIVE license states, and `isProAccessibleLevel` is the single source of truth for which of them get the real surface.** Verbatim:

```js
function isProAccessibleLevel(level) {
  return level === "trialing" || level === "active" || level === "grace";
}
```

| State | Surface | Notes |
| --- | --- | --- |
| `free` | Preview | Never had Pro. CTA reads "Start free trial". |
| `trialing` | **Real, full function** | |
| `active` | **Real, full function** | |
| `grace` | **Real, full function** | An active subscription 7 to 14 days past its last verification. Indistinguishable from `active` on every surface. It is a real state and it is easy to forget it exists. |
| `expired` | Preview | Trial lapsed, or a subscription past double the offline grace. |

**EXPIRED IS FULL PREVIEW LOCKOUT, IDENTICAL TO FREE. There is no read-only fallback anywhere in this product.** Verified on both lapse paths and byte-identical to `free` except for CTA copy, which reads "Upgrade" once a trial has been used and "Start free trial" otherwise. Specs and plans written before 2026-08-30 sometimes assume a degraded-but-usable expired mode; they are wrong, and building one would make the newer surface more permissive than the one it inherits from.

**Everything not in that list falls to `renderProPreview`.** Gate by calling `isProAccessibleLevel`, never by testing states individually: a hand-written `active || trialing` check silently locks out every `grace` user, who is a paying customer.

**A PREVIEW SURFACE MUST NEVER RENDER A CREATE AFFORDANCE.** Preview is the promise: same component, same styling path, differing only in data source and interactivity. A control that cannot do anything is worse than an absent one, because it reads as broken rather than as locked. The worked example is the `[1.1.4]` preview-ghost bug: the notes preview rendered the ghost note, which is the create affordance, on a surface that can never create. Whenever a surface gains a new create control, check the preview branch in the same commit.

---

## Dev Tooling

- **`LP.devPro` — dev-only Pro toggle (shipped commit `bc3b303`).** In an UNPACKED build, run `LP.devPro(true)` in the new-tab page console to enable full Pro for testing; persists across reload. `LP.devPro(false)` returns to free/locked (for testing the gated UI).
  - Gated by `IS_UNPACKED` (`!chrome.runtime.getManifest().update_url`), and the `getProAccessLevel` override is independently `IS_UNPACKED`-guarded, so it is inert in the published Web Store build.
  - Flag persists at top-level `data.__devProOverride`. Does not touch real license/trial state and triggers no Dodo network calls.
  - Supersedes the old manual `chrome.storage.local` trial-arming workaround for entering Pro in dev.

---

## What to Always Do

- **Edit through a writer, not through a shell parser.** A heredoc is a second parser between you and the file: an edit whose content discusses escapes or control characters can write them in literally (BUGS.md **M3**), and `core.autocrlf=true` means the working copy and the committed blob can have different line endings, so anchors are built from the ending the file actually uses (**M4**). Byte-check after any such edit.
- **Search before acting.** For factual questions about the codebase, use file view/grep. For web-facing facts, search the web.
- **Read SKILL.md files** when relevant before code generation (docx, pdf, pptx, xlsx, frontend-design).
- **Verify git state before destructive operations.** Confirm GitHub has latest commits before deleting any local folder.
- **Use Asana for task tracking.** See `ASANA.md` for the workflow.
- **Update docs as you go.** When a significant decision is made, add it to `DECISIONS.md`. When a spec changes, update the relevant spec file.
- **Read `docs/SPECS/design-guide.md` before any task that touches UI, and paste its Section 8 checklist into the PLAN.**
- **Present Claude Code prompts in a single copy-pasteable code block** (not split across prose). This matches Samson's working preference.

---

## Browser Testing

Browser automation runs against an **isolated scratch profile — never Samson's default profile.** A fresh `--user-data-dir` is not by itself isolation: Edge still force-installs extensions from the `HKLM`/`HKCU` `Extensions` registry keys and still pulls extensions and settings through the signed-in OS account, so a "clean" profile came up carrying his real synced extensions (Phantom Wallet among them) and live sessions. That pollutes measurements with third-party listeners and CSS, and exposes personal browser state to test runs.

The standing invocation — profile dir is gitignored (`.scratch-profile*/`):

```
msedge.exe --user-data-dir=C:\Dev\Git\launchpad\.scratch-profile   --no-first-run --no-default-browser-check --disable-sync   --disable-features=DisableLoadExtensionCommandLineSwitch --enable-unsafe-extension-debugging   --disable-extensions-except=C:\Dev\Git\launchpad --load-extension=C:\Dev\Git\launchpad   --remote-debugging-port=<port>
```

- `--disable-extensions-except` **with** `--load-extension`; plain `--disable-extensions` would disable the subject too.
- **The two `*-extension-debugging` flags are load-bearing on Edge/Chrome 137+**, which otherwise ignores `--load-extension` whenever a remote-debugging port is open. Without them the target navigates to `chrome-error://chromewebdata`, where `chrome.runtime` is undefined and the failure reads as a broken feature.
- The extension's own pages **are** drivable this way — attach over CDP and `Target.createTarget` on `chrome-extension://<id>/newtab.html`.
- **Get the ID from `.scratch-profile/Default/Secure Preferences` → `extensions.settings[<id>].path`**, matching on the repo path. Do NOT take "the first `chrome-extension://` target" (Edge's own force-installed extensions get there first) and do not rely on LaunchPad's MV3 service worker being a visible target (it suspends after ~30s). Full trap list: BUGS.md **I7**.
- **Teardown kills by PID, never by image name.** `taskkill /IM msedge.exe` closes Samson's real browser along with the test one. Capture the PID at launch, or just close the CDP target.
- **`chrome.runtime.onStartup` NEVER FIRES under `--load-extension`** — a command-line unpacked extension is reinstalled into the profile each launch, so the browser fires `onInstalled` instead. Nothing hanging off onStartup (the session anchor, the closed-browser fold) can be tested end to end this way. Attach to the service-worker target and invoke the startup *work* directly; prove the *listener* wiring with a build gate. BUGS.md **I8**.
- **Close gracefully over CDP (`Browser.close`) before relaunching** — a hard `taskkill /F` discards unflushed `chrome.storage` writes, so the relaunch reads pre-test state. BUGS.md **I9**.
- **Run `LP.devPro(true)` before asserting on any Pro surface** (the pill renders as an empty node on a free profile), and **click real controls rather than writing storage from the console** (the write-provenance gate suppresses the own-tab re-render). BUGS.md **I10**, **I11**.
- Delete the scratch profile when the round ends.

Full rationale and the failure it came from: BUGS.md **I6**.

---

## Verification methodology

Adopted 2026-08-29. This governs every implementation prompt: Claude Code verifies
what it can, Samson verifies only what it cannot.

**Claude Code verifies everything it is able to verify, as part of the
implementation, before reporting.** Not as an optional extra pass, and not deferred
to the review. That means, wherever the change makes each applicable:

- **Functional runtime behaviour in a real scratch browser profile** (Browser Testing
  above): the feature does what it claims, state changes land, persistence survives a
  reload, and the console is clean.
- **The VISIBLE TEXT and numbers of every surface the change touches**, asserted
  against an expectation rather than eyeballed, and never only the accessible label.
  A chart's `aria-label` and its rendered axis captions are two different strings that
  can disagree: asserting the queryable one while the visible one shipped wrong is
  exactly how the 2026-08-28 axis captions escaped a green runtime pass. BUGS.md
  **I15**.
- **Regression flips of adjacent features** the change could plausibly disturb, not
  only the feature being built.
- **Packaged-build smoke whenever an artifact exists** - drive the unpacked artifact,
  not the working tree, so what is verified is what would ship.
- **Website checks end to end** where the change is web-side.

**Every IMPLEMENTATION report ends with a section titled `HUMAN CHECKS REMAINING`.**
It is mandatory and it is the last thing in the report. It contains either the
specific checks only a human can perform, each with one line on why, or the exact
sentence `none — fully verified.` The categories that genuinely qualify:

- **Taste and feel** - whether a motion reads as calm or twitchy, whether copy lands.
  Measurable properties are not taste; assert those instead of deferring them.
- **Resonance against real accumulated data** - whether a board of the user's own
  months of history tells them something true. Seeded fixtures cannot answer it.
- **Credentialed or destructive actions** - store uploads, payment dashboards,
  anything touching real money, real user data or an account Claude Code must not
  hold credentials for.
- **Documented interaction gaps** - a thing the harness provably cannot drive, cited
  by its BUGS.md entry. Chrome swallowing key events during a native drag (**I8**'s
  neighbourhood) is the worked example: shift-drag cannot be exercised end to end, so
  it is named rather than quietly claimed.

**Samson verifies that list and nothing else.** A task whose list is empty and which
touches no UI surface closes on Claude Chat's REVIEW, with no Samson pass at all.
Visual sweeps happen at **feature-arc checkpoints** - the final task of an arc - not
once per prompt; in between, Samson vetoes UI problems ambiently from daily use.
Claude Chat may flag a visually load-bearing change as wanting Samson's eyes before
it closes, and **that flag overrides the checkpoint cadence** for that one change.

**A verification Claude Code could normally perform but could not this time is stated
in `HUMAN CHECKS REMAINING`, explicitly, as a gap.** A tooling limit or an
environment limit is a finding worth reporting, not a reason to quietly soften the
claim. Silently downgrading "verified" to "looks right" is the failure this whole
section exists to prevent.

---

## What to Never Do

- **Never add DuckDuckGo as a search option.** Blocked in Samson's region (Indonesia).
- **Never bypass `build.sh`'s clean-tree guard.** Commit first, then build.
- **Never work in OneDrive paths.** If a path includes `OneDrive`, stop and redirect to `C:\Dev\Git\`.
- **Never put secrets in source files.** Firebase configs, API keys, and credentials belong in `.env` (gitignored) or equivalent.
- **Never create an Asana task when the work belongs on an existing task.** One task per piece of work. See `ASANA.md`.
- **Never overwrite a task's "Context" section** when updating from Claude Code. Context is written once at task creation and stays stable.

---

## Cross-repo couplings

- **launchpad-website routing ↔ extension URL matcher:** `background.js` (`isCheckoutReturnUrl` / `handleCheckoutReturn`) matches `https://mylaunchpad.me/checkout-return` with or without `.html`. The website serves this via Cloudflare clean-URL routing (`wrangler.toml`, website commit `3c7edb3`) which strips `.html`. A website route / clean-URL change can silently break extension auto-activation. Broke once, fixed in extension commit `07f979e` (bug 1215525319408075).

---

## Communication Preferences

- Longer, comprehensive responses preferred generally — but contextual. Don't pad short answers.
- Direct honesty over hedging. If Samson is making a mistake, say so.
- Offer options rather than single recommendations where multiple paths are defensible.
- Stay focused during back-and-forth — no rambling on one point.
- Brainstorming: wide net first, then narrow down.
- If unsure about something, say so. Don't fabricate confidence.
- Prefer console-based verification over manual UI testing whenever console verification yields the same accurate outcome. Faster, more reproducible, less ambiguous than UI walkthroughs and screenshots. For storage-layer or non-UI changes, default to writing a console snippet that exercises the code paths and asserts results.

---

## Related Documents

- `docs/ASANA.md` — Task tracking workflow between Claude Chat, Claude Code, and Asana.
- `docs/ROADMAP.md` — What's in Pro v1, deferred to v2/v3, future considerations.
- `docs/DECISIONS.md` — Architectural and product decisions with reasoning. Append-only log.
- `docs/BUGS.md` — Audit checklist Claude Code runs at task completion, plus known limitations log.
- `docs/HANDOVER.md` — Session handover document, updated when context limits approach.
- `docs/SPECS/*.md` — Individual spec documents (UX, data model, tracking engine, etc.)
- `docs/SPECS/design-guide.md` — The design guide: tokens, layouts, components, copy voice. Read it before any UI task; Section 8 is the checklist that goes into the PLAN.
- `docs/RESEARCH/` — Point-in-time research snapshots, dated in the filename. Evidence behind decisions, not rules; the rules live in SPECS and DECISIONS.

---

## Session Start Checklist

When starting a new Claude Chat session on LaunchPad:

1. Read this `CLAUDE.md` file
2. Skim `docs/ROADMAP.md` for current priorities
3. Check Asana (`LaunchPad Pro - Development Log` project) for active tasks
4. Check recent commits in `C:\Dev\Git\launchpad` via `git log --oneline -10`, and report the ahead-by count (`git rev-list --count origin/master..master` after a fetch) alongside them
5. Proceed with the user's request

When starting a new Claude Code session:

1. Confirm working directory is `C:\Dev\Git\launchpad`
2. Verify `git status` shows clean working tree (or understood in-progress work), and report the ahead-by count (`git fetch` then `git rev-list --count origin/master..master`) so unpushed work is visible before it accumulates
3. Read any Asana task ID provided in the prompt
4. Review the relevant sections of `docs/BUGS.md` that apply to the task's scope
5. Proceed with the requested change
6. Before moving the task to Needs Review, run the BUGS.md audit and include a one-line AUDIT summary in the IMPLEMENTATION comment
