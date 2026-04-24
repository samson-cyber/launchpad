# LaunchPad — Project Anchor for Claude

This document is the entry point for any Claude Chat or Claude Code session working on LaunchPad. Read it first before taking action.

---

## What LaunchPad Is

LaunchPad is a Chrome extension that replaces Chrome's default new tab page with a customizable shortcut dashboard. It has two tiers:

- **LaunchPad (free)** — Shipped on Chrome Web Store. Unlimited shortcuts, groups, drag-and-drop, session restore, history panel, wallpapers, backup/export. Privacy-first, all data local.
- **LaunchPad Pro (in development)** — Workspaces (Work/Personal) + task/goal system + tab time tracking + Day Recap + achievements. Positioned as a browser-based productivity companion for portfolio workers, deep-work seekers, and people wanting accountability without surveillance.

Current version shipped: **v1.0.4** (April 23, 2026).

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

- **Frosted glass panels:** `backdrop-filter: blur(12px); background: rgba(30,30,30,0.85);`
- **Background image:** `<body>` with `background-attachment: fixed; background-size: cover;`
- **Sidebar:** JS-class-based expand/collapse with `sidebarLocked` flag (NOT CSS `:hover`). When a panel/menu is open, `sidebarLocked = true` prevents collapse.
- **Text:** White with `text-shadow: 0 1px 3px rgba(0,0,0,0.5)` for readability on wallpapers. Luminance-aware overrides for light backgrounds (v1.0.4+).
- **CSP:** `img-src 'self' https: data: blob:` — allows favicons from any HTTPS domain.

---

## What to Always Do

- **Search before acting.** For factual questions about the codebase, use file view/grep. For web-facing facts, search the web.
- **Read SKILL.md files** when relevant before code generation (docx, pdf, pptx, xlsx, frontend-design).
- **Verify git state before destructive operations.** Confirm GitHub has latest commits before deleting any local folder.
- **Use Asana for task tracking.** See `ASANA.md` for the workflow.
- **Update docs as you go.** When a significant decision is made, add it to `DECISIONS.md`. When a spec changes, update the relevant spec file.
- **Present Claude Code prompts in a single copy-pasteable code block** (not split across prose). This matches Samson's working preference.

---

## What to Never Do

- **Never add DuckDuckGo as a search option.** Blocked in Samson's region (Indonesia).
- **Never bypass `build.sh`'s clean-tree guard.** Commit first, then build.
- **Never work in OneDrive paths.** If a path includes `OneDrive`, stop and redirect to `C:\Dev\Git\`.
- **Never put secrets in source files.** Firebase configs, API keys, and credentials belong in `.env` (gitignored) or equivalent.
- **Never create an Asana task when the work belongs on an existing task.** One task per piece of work. See `ASANA.md`.
- **Never overwrite a task's "Context" section** when updating from Claude Code. Context is written once at task creation and stays stable.

---

## Communication Preferences

- Longer, comprehensive responses preferred generally — but contextual. Don't pad short answers.
- Direct honesty over hedging. If Samson is making a mistake, say so.
- Offer options rather than single recommendations where multiple paths are defensible.
- Stay focused during back-and-forth — no rambling on one point.
- Brainstorming: wide net first, then narrow down.
- If unsure about something, say so. Don't fabricate confidence.

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
