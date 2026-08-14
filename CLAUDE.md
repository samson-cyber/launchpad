# LaunchPad — Project Anchor for Claude

This document is the entry point for any Claude Chat or Claude Code session working on LaunchPad. Read it first before taking action.

---

## What LaunchPad Is

LaunchPad is a Chrome extension that replaces Chrome's default new tab page with a customizable shortcut dashboard. It has two tiers:

- **LaunchPad (free)** — Shipped on Chrome Web Store. Unlimited shortcuts, groups, drag-and-drop, session restore, history panel, wallpapers, backup/export. Privacy-first, all data local.
- **LaunchPad Pro (in development)** — Workspaces (Work/Personal) + task/goal system + tab time tracking + Day Recap + achievements. Positioned as a browser-based productivity companion for portfolio workers, deep-work seekers, and people wanting accountability without surveillance.

Current version shipped: **v1.0.5** (free tier, submitted 2026-07-21; confirmed live — a store-installed `1.0.5_0` is present in the local Chrome profiles). v1.0.4 shipped 2026-04-23.

**The manifest is at `2.0.0` as of 2026-08-10 — the Pro-launch SUBMISSION CANDIDATE, built but NOT yet uploaded.** Until the Web Store approves it, "shipped" still means v1.0.5; do not describe 2.0.0 as live. Asana 1217318434594388.

**The v2.0.0 BUILD PHASE IS COMPLETE as of 2026-08-14, at commit `0335e49`.** Nothing further is queued for this version. (The build phase first closed at `3c719d6` on 2026-08-13; the Buy Me a Coffee retirement reopened it for one commit and closed it again.)

- **FINAL ARTIFACT: `launchpad-2.0.0-0335e49.zip`** — sha256 `bf01127a0612fccbd0be99c4a4f685cd66e0bab90c4d4d2da6e66af40ca072fb`, 608,826 bytes, clean tree, **thirteen gates green**. Supersedes `launchpad-2.0.0-3c719d6.zip`, which is deleted.
- **At submission the annotated `v2.0.0` tag goes on `0335e49`** — the commit the uploaded artifact was built from. (The target moved off `3c719d6` when that artifact was superseded; the rule is unchanged — the tag follows the artifact.)
- **ARTIFACT-STAMPING IS STANDING PRACTICE.** Every build that leaves the tree is stamped `launchpad-<version>-<shorthash>.zip`, published with its sha256 and byte count, and **the superseded zip is deleted in the same step**. An unstamped `launchpad.zip` cannot identify itself, and a stale zip left on disk is the one that eventually gets uploaded.

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

---

## Versioning & Release Tagging

LaunchPad uses **two distinct, parallel numbering tracks**. They look alike but mean different things — never conflate them. Full rationale: `docs/DECISIONS.md` (2026-06-13 entry).

- **Store / manifest version (`manifest.json`)** — `X.Y.Z`, the published build users install. Bumped **manually, only at a Chrome Web Store submission**; nothing else touches it. Currently `2.0.0` (the Pro-launch submission candidate, bumped 2026-08-10; `1.0.5` was the last SHIPPED build, free tier, submitted 2026-07-21). `1.0.3` is intentionally absent in git (uncommitted-ship incident; `1.0.4` was the recommit). The manifest did not move at any point during Pro development — it moved once, here, at submission.
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

## Dev Tooling

- **`LP.devPro` — dev-only Pro toggle (shipped commit `bc3b303`).** In an UNPACKED build, run `LP.devPro(true)` in the new-tab page console to enable full Pro for testing; persists across reload. `LP.devPro(false)` returns to free/locked (for testing the gated UI).
  - Gated by `IS_UNPACKED` (`!chrome.runtime.getManifest().update_url`), and the `getProAccessLevel` override is independently `IS_UNPACKED`-guarded, so it is inert in the published Web Store build.
  - Flag persists at top-level `data.__devProOverride`. Does not touch real license/trial state and triggers no Dodo network calls.
  - Supersedes the old manual `chrome.storage.local` trial-arming workaround for entering Pro in dev.

---

## What to Always Do

- **Search before acting.** For factual questions about the codebase, use file view/grep. For web-facing facts, search the web.
- **Read SKILL.md files** when relevant before code generation (docx, pdf, pptx, xlsx, frontend-design).
- **Verify git state before destructive operations.** Confirm GitHub has latest commits before deleting any local folder.
- **Use Asana for task tracking.** See `ASANA.md` for the workflow.
- **Update docs as you go.** When a significant decision is made, add it to `DECISIONS.md`. When a spec changes, update the relevant spec file.
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

---

## Session Start Checklist

When starting a new Claude Chat session on LaunchPad:

1. Read this `CLAUDE.md` file
2. Skim `docs/ROADMAP.md` for current priorities
3. Check Asana (`LaunchPad Pro - Development Log` project) for active tasks
4. Check recent commits in `C:\Dev\Git\launchpad` via `git log --oneline -10`
5. Proceed with the user's request

When starting a new Claude Code session:

1. Confirm working directory is `C:\Dev\Git\launchpad`
2. Verify `git status` shows clean working tree (or understood in-progress work)
3. Read any Asana task ID provided in the prompt
4. Review the relevant sections of `docs/BUGS.md` that apply to the task's scope
5. Proceed with the requested change
6. Before moving the task to Needs Review, run the BUGS.md audit and include a one-line AUDIT summary in the IMPLEMENTATION comment
