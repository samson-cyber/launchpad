# LaunchPad — Bug Audit and Known Limitations

This file serves two purposes:

1. **Audit checklist** — Claude Code runs relevant sections of this before moving any task to Needs Review. Catches regressions, codebase-convention violations, and common Chrome extension pitfalls.
2. **Living log** — Known limitations, accepted bugs, and recently-fixed issues for pattern recognition.

This file is NOT a substitute for the Asana "Bugs / Issues" section. The distinction:

- **Asana Bugs / Issues** = actionable bugs with a fix lifecycle (discovered → being fixed → verified → closed)
- **BUGS.md Known Limitations** = accepted bugs we've decided not to fix, with reasoning
- **BUGS.md Audit Checklist** = the questions Claude Code asks itself at task completion to avoid introducing bugs

---

## Workflow for Claude Code

After completing a task and before moving it to Needs Review:

1. **Run relevant audit sections below.** Only run sections applicable to what the task touched (e.g., if the task didn't touch `manifest.json`, skip the manifest-related checks).
2. **If the audit finds a bug you introduced in this task**: fix it before moving to Needs Review. Re-audit.
3. **If the audit finds a pre-existing bug** unrelated to this task: create a separate task in Asana "Bugs / Issues" section. Do not try to fix it in this task's scope. Reference the originating area in the bug name.
4. **If you discover a new accepted limitation**: add it to the "Known Limitations" section of this file and note it in your IMPLEMENTATION comment.
5. **Include audit results in your IMPLEMENTATION comment** on the Asana task. Format:
   ```
   AUDIT — Checked: [sections run]. Findings: [clean, or list of issues].
   ```
   If the audit was clean, a single line is sufficient. No separate comment needed.

The audit takes minutes, not hours. Skip sections that don't apply. Don't pad.

---

## Audit Checklist

### Section A: Chrome Extension / Manifest V3

Run when the task touched: `manifest.json`, `background.js`, `tracking-prototype.js`, any service worker code, any permissions, any Chrome API.

- **A1. Service worker suspend safety.** Any in-memory state in the service worker (module-level `let` / `const`, singleton objects, cached values) is lost when Chrome suspends the SW after ~30s idle. Persist state to `chrome.storage.local` or `chrome.storage.session` immediately, not on a timer. Alarms wake the SW but with empty globals.
- **A2. No `setTimeout` / `setInterval` for anything longer than a few seconds** in the service worker. They pause when the SW suspends. Use `chrome.alarms` (minimum period 30s / 0.5 minutes for repeating alarms).
- **A3. `chrome.runtime.lastError` checked** on any async Chrome API call that uses a callback pattern. Silent failures hide in the console without this. Prefer promise-based APIs where available.
- **A4. Permissions audit.** Every permission in `manifest.json` is actually used by the code. Every API the code calls has a corresponding permission. No permission added "just in case."
- **A5. Event listener duplication.** Adding `chrome.tabs.onActivated.addListener(fn)` at module scope in a service worker runs on every SW wake. If `fn` is the same function reference, Chrome dedupes it; if it's a new arrow function each wake, you get duplicate listeners. Module-scope listeners with named functions are safe.
- **A6. CSP compliance.** No inline event handlers in HTML (`onclick="..."`), no inline scripts (`<script>alert()</script>`), no `eval`, no `new Function()`. External resources only over HTTPS. `<script src="...">` must be a local file or explicitly allowed in `content_security_policy` in manifest.
- **A7. `chrome.storage.local` quota.** Default quota is 10 MB. Writing large objects (wallpaper base64, tracking event history) accumulates. Check `chrome.storage.local.getBytesInUse(key)` during review. Plan a pruning/aggregation policy for anything that grows unboundedly.
- **A8. `chrome.storage.sync` size limits.** If tempted to use `chrome.storage.sync` instead of `.local`: 100 KB total, 8 KB per item, ~2 writes/sec rate limit. Almost always too small for LaunchPad data.
- **A9. `tabId` / `windowId` staleness.** A tab can close between the event fire and the handler execution. Any `chrome.tabs.get(tabId)` call can reject with "No tab with id". Wrap in try/catch or check `chrome.runtime.lastError`.

### Section B: Free-Tier Regression

Run when the task touched: anything shipped to end users (`newtab.js`, `newtab.html`, `newtab.css`, `background.js`, `manifest.json`, `storage.js`, `bookmarks.js`).

- **B1. Load unpacked, open a new tab, check for console errors.** Free-tier stability is sacred. If you can't drive a Chrome session from your environment, say so explicitly in the IMPLEMENTATION comment and flag it as a manual step for Samson.
- **B2. Drag-and-drop still works.** Drag a shortcut between positions within a group. Drag between groups. Sortable JS integration is easy to break.
- **B3. Storage key is `"data"`**, not `"launchpad_data"`. Every reference in code. No exceptions.
- **B4. Settings panel still opens and the panel's sub-panels (wallpaper picker, import bookmarks, etc.) still work.**
- **B5. Sidebar `sidebarLocked` flag.** When any panel/menu/modal is open, `sidebarLocked = true` to prevent collapse. When closed, reset to `false`. If you added a new panel, it must set the flag.
- **B6. Right-click "Add to LaunchPad" context menu** still enumerates groups correctly. It rebuilds on `chrome.storage.onChanged` — if you changed storage structure, the menu rebuild code may need updating too.
- **B7. Wallpaper background** still applies to `<body>` with `background-attachment: fixed`, not to content area. Regression here causes the ugly gray strip behind the sidebar.
- **B8. Text shadow / luminance-aware styling** on custom wallpapers still applied. Light backgrounds (the 2026-04-24 color presets) must get the light-theme overrides for sidebar and search bar.

### Section C: Release Hygiene

Run when the task is a release candidate (committing for build, preparing a ZIP, bumping version).

- **C1. Working tree is clean** before running `build.sh`. The clean-tree guard in `build.sh` exists because v1.0.3 shipped with uncommitted code. Never bypass it.
- **C2. Version bumped in `manifest.json`.** Chrome Web Store rejects ZIPs with the same version as a live listing. Also update any hardcoded version string in the UI (check `newtab.html` — there was previously a hardcoded "v1.0.0" string that lingered through multiple releases).
- **C3. Prototype code excluded from ZIP.** If `tracking-prototype.js` is in the repo, verify it's excluded from `launchpad.zip` (either by an allowlist in `build.sh` or by removing the `importScripts('tracking-prototype.js')` line in `background.js` before building).
- **C4. No demo data in production build.** `demo-data.js` is gitignored and must not ship.
- **C5. Commit messages follow conventional format.** `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `refactor: ...`. Scope optional in parentheses: `feat(prototype): ...`.
- **C6. CHANGELOG / store listing "What's new"** updated. Chrome Web Store asks for release notes at submission; having them ready avoids rushed copy.

### Section D: LaunchPad Codebase Conventions

Run when the task touched the main extension code (not docs, not workflow).

- **D1. DuckDuckGo never added** as a search option. Blocked in Samson's region (Indonesia). This is a permanent constraint.
- **D2. Search uses `chrome.search.query`**, not a custom URL dictionary. Custom search URLs were removed in v1.0.2 for Chrome Web Store "single purpose" policy compliance. Re-adding them will cause rejection.
- **D3. Domain alias map** (Outlook Personal vs Growve, Gmail vs GSuite, etc.) preserved if you touched the nesting/variants logic. See `DOMAIN_ALIASES` constant.
- **D4. Favicon fallback chain intact.** Google S2 favicon API → curated override → placeholder SVG. Breaking this causes missing icons all over the grid.
- **D5. Frosted glass styling.** All panels use `backdrop-filter: blur(12px); background: rgba(30,30,30,0.85);`. If you added a new panel, match the style.
- **D6. Text shadow on all text over backgrounds.** `text-shadow: 0 1px 3px rgba(0,0,0,0.5);`. Critical for wallpaper readability.
- **D7. No secrets committed.** No Firebase config, no API keys, no tokens, no passwords in source files. `.env` file gitignored.

### Section E: Data Integrity

Run when the task touched: storage, backup/export, migration logic, or the `data` schema.

- **E1. Migration paths tested.** Users upgrading from older versions have data in the old shape. Any schema change needs a migration in `Storage.getDefaultData()` or equivalent, not just a fresh-install default.
- **E2. Backup/export round-trip.** Export → delete local data → import backup → verify data restored correctly. Covers groups, shortcuts, variants, settings, background.
- **E3. Recovery backup on import.** `data_pre_import_backup` key preserves the pre-import state so users can recover from a bad import. If you changed the import flow, this must still work.
- **E4. Storage key isolation.** Production uses `"data"`. Prototypes use their own keys (e.g., `"tracking_prototype"`). A prototype must never read or write the production key.

### Section F: Asana Workflow Hygiene

Run before moving any task to Needs Review.

- **F1. Task description's Context section is preserved.** Never overwrite it. Only fill in / update `What was done`, `Files affected`, `Dependencies`, `Issues encountered`, `Next steps`.
- **F2. IMPLEMENTATION comment is plain text.** Use the `text` parameter of `add_comment`, never `html_text`. No HTML tags. Follow `docs/ASANA.md` Comment Formatting rules.
- **F3. Task stays in the correct project.** Verify `memberships` still includes project `1214252324886224`. Never use `remove_projects`.
- **F4. Task moved to correct section.** Needs Review = `1214252324886229`. Completed = `1214252324886230`. Bugs / Issues = `1214252324886231`. Fixed Bugs / Issues = `1214252324886232`.
- **F5. New bug tasks named correctly.** `Bug: [Area] — [description]`. Areas: Prototype, Foundation, Tasks, Tracking, Experience, Infrastructure, Polish.
- **F6. If stale content exists in the Issues section** of the task description (e.g., a previous bullet is superseded by this task's fix), note it in the IMPLEMENTATION comment. Do not overwrite prior content per the existing rule; surface the tension instead.

### Section G: Security and Privacy

Run when the task touched: any user data, storage, network calls, or third-party integrations.

- **G1. No user data sent externally.** LaunchPad's positioning is "All data stored locally. No tracking." Do not add `fetch` calls that send user bookmarks, history, or tracking data to any external server. Only exception: Google's favicon S2 API (already live and disclosed).
- **G2. No PII logging.** URLs may contain session tokens, query params, identifiers. Don't `console.log` full URLs in production code. Debug helpers (like `trackingExport()`) are fine because they only run on the user's own machine in their own DevTools.
- **G3. Privacy policy accuracy.** If the task added a new data collection, disclosure, or permission, the privacy policy at `https://samson-cyber.github.io/launchpad/privacy-policy.html` may need an update. Flag this in IMPLEMENTATION — don't fix the hosted privacy policy yourself (it lives on GitHub Pages and is versioned separately).
- **G4. No third-party analytics.** No Google Analytics, no Mixpanel, no Sentry calls in shipped code. If a future Pro tier adds telemetry, it needs explicit user opt-in, clear disclosure, and self-hosted collection.

### Section H: Prototype Discipline

Run when the task touched: `tracking-prototype.js` or any other experimental / prototype module.

- **H1. Prototype module is isolated.** It runs alongside production code via a single `importScripts` line or equivalent. It does not modify shared state, production storage keys, or shared UI.
- **H2. Prototype is gitignored from release ZIP** via `build.sh` allowlist, OR the `importScripts` line must be commented out / removed before the next release build. Flag this in Next Steps of the task.
- **H3. Prototype storage keys are disposable.** A prototype uses its own storage key (e.g., `tracking_prototype`). The user can wipe it at any time without affecting production data.
- **H4. Prototype does not add user-facing UI** unless the task explicitly calls for it. Prototypes live in the service worker, in debug helpers, and in console output.

---

## Known Limitations

Accepted bugs and constraints we're not planning to fix. Format: date, area, description, reasoning.

### 2026-04-24 — Tracking Prototype — `chrome.alarms` original 10s cadence not achievable

**Area:** Prototype (tracking)
**Description:** Original spec called for 10-second flush cadence. Chrome's `chrome.alarms` API has a minimum repeating period of 30 seconds (`periodInMinutes: 0.5`). Buffer approach was scrapped entirely in favor of write-per-event; this note is here as historical reference for why the initial spec couldn't be followed literally.
**Status:** Superseded — write-per-event architecture doesn't use alarms at all.

### 2026-04-24 — Tracking Prototype — unbounded `chrome.storage.local` growth during validation

**Area:** Prototype (tracking)
**Description:** The write-per-event architecture (commit 7ff8af8) appends one record to `chrome.storage.local["tracking_prototype"]` on every tab switch, active-tab URL update, window focus change, and idle state transition, with no pruning. Over the 3–5 day validation window this accumulates without bound. Default `chrome.storage.local` quota is 10 MB; rough estimate for normal work is well under that, but heavy activity or a longer run could approach it.
**Status:** Accepted for validation scope. Mitigation: `chrome.storage.local.getBytesInUse("tracking_prototype")` sampled during review; the prototype is retired (or wiped with `chrome.storage.local.remove("tracking_prototype")`) once validation concludes. The production Tracking Engine will implement per-day aggregation and pruning instead of raw event retention.

### 2026-04-24 — Free Tier — Settings panel stays dark glass on light backgrounds

**Area:** Polish (free tier)
**Description:** When user selects a light color background (white, light gray), the Settings panel retains its dark frosted glass style. Contrast is acceptable but inconsistent with the luminance-aware text styling elsewhere. Candidate for v1.0.5 polish.
**Status:** Acknowledged, not fixing in current scope.

### 2026-04-24 — Free Tier — "+ New Group..." in right-click context menu silently creates "New Group" without prompting

**Area:** Polish (free tier)
**Description:** When user right-clicks a webpage and picks "+ New Group..." from the Add to LaunchPad submenu, a group named "New Group" is created silently. User expects a rename prompt. Minor UX rough edge.
**Status:** Acknowledged, candidate for v1.0.5.

### 2026-04-24 — Free Tier — "Promote variant to parent" capability lost in radial → dropdown refactor

**Area:** Polish (free tier)
**Description:** The original radial pop-out for variants allowed dragging the parent out to promote a child variant to the new parent. The dropdown redesign removed this capability. Could return as a context menu action on variant rows.
**Status:** Acknowledged, candidate for v1.0.5 or later.

---

## Recently Resolved

Short history of recently-fixed bugs, ordered newest first. For pattern recognition during audits — if an old bug shape looks similar to something you're about to ship, pause.

### 2026-04-24 — Tracking Prototype — SW suspend buffer drops events

**Area:** Prototype (tracking)
**Fixed in:** Commit 7ff8af8
**Pattern:** Module-level in-memory state in a service worker is not durable. Any state needed across events must live in `chrome.storage`. Alarms wake the SW but not state.

### 2026-04-23 — Free Tier — Hardcoded `v1.0.0` string in Settings didn't match shipped version

**Fixed in:** v1.0.4 release, commit f2929bd
**Pattern:** Hardcoded version strings drift from the manifest. Use `chrome.runtime.getManifest().version` for any version display.

### 2026-04-23 — Free Tier — Parent shortcut rename didn't update displayed name

**Fixed in:** v1.0.4 release
**Pattern:** When a data structure has a primary object with sub-objects (parent shortcut + variants), renames to the primary need to update all references, including display paths that might be reading from a cached or derived field.

### 2026-04-23 — Free Tier — "Remove background" silently re-applied default image

**Fixed in:** v1.0.4 release
**Pattern:** "Remove X" actions should unset, not replace-with-default. If a default is needed elsewhere, compute it at read time, not at reset time.

### 2026-04-22 — Free Tier — v1.0.3 shipped with uncommitted code

**Fixed in:** `build.sh` clean-tree guard added
**Pattern:** Build tooling that doesn't enforce commit state lets silent regressions ship. Automate the discipline rather than relying on human memory.

### 2026-03 — Free Tier — Drag-to-nest failure (SortableJS suppressed mousemove)

**Pattern:** Third-party libraries can suppress events you expect to fire. Read the library's event model before relying on standard DOM events. When SortableJS is active, use its `drag` event rather than `mousemove`.

### 2026-03 — Free Tier — Duplicate shortcuts after nesting

**Pattern:** When moving items between collections, dedupe must apply globally, not just within the source collection. The target collection can receive duplicates from elsewhere.

### 2026-03 — Free Tier — Sidebar collapsing while menus open

**Pattern:** CSS `:hover` state cannot be locked by JS. When UI state depends on "open" / "closed" modes, use JS classes and explicit state flags, not CSS pseudo-selectors.

---

## How to Add to This File

When adding a known limitation:

1. Under `Known Limitations`, add a new `### YYYY-MM-DD — [Area] — [short name]` heading
2. Fill in Area, Description, Status
3. Commit: `docs(bugs): add known limitation for [short name]`

When moving a recently-resolved bug to archive (after ~3 months of stability):

1. Move the entry to a new `## Archive` section at the bottom
2. No change to the heading format

When adding a new audit section:

1. Propose the section in an Asana task first (`Spec: BUGS.md audit section — [name]`) so it can be discussed
2. On approval, add under `Audit Checklist`
3. Update the Workflow for Claude Code section if the new section changes how Claude Code should use the file

---

## Relationship to Other Docs

- **`ASANA.md`** describes the task lifecycle. BUGS.md is consulted as part of that lifecycle (at task completion).
- **`DECISIONS.md`** records why we chose certain approaches. BUGS.md records what we accepted as imperfect.
- **`ROADMAP.md`** tracks planned work. BUGS.md's Known Limitations inform ROADMAP (a limitation might be scheduled for fixing).
- **Asana "Bugs / Issues" section** is for bugs currently being fixed. BUGS.md is for bugs accepted-as-is and historical patterns.
