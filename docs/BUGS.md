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
5. **Include audit results in your IMPLEMENTATION comment** on the Asana task. Format depends on whether the audit was driven by live verification or code-reading only:
   ```
   AUDIT clean — Checked: [sections run]. Findings: [clean, or list of issues].
   ```
   ```
   AUDIT (code-reading only; live verification required) — Checked: [sections run]. Findings: [clean, or list of issues].
   ```
   The "clean" wording is reserved for audits where Claude Code (or a human) actually loaded the extension in Chrome and exercised the affected paths. When the agent environment cannot drive a Chrome session, the second form makes the gap explicit so the reviewer knows live verification is still pending. (Amended 2026-08-09: this is no longer the common case — the extension's own pages are drivable over CDP from an isolated scratch profile, see **I6** — so reach for the "clean" wording when the paths really were exercised, and keep the second form honest for the times they were not.) Sections under **Section I: Live Verification Gates** must use the second form unless the audit was actually live-verified — code-reading alone is insufficient evidence for those change types. If the audit was clean, a single line is sufficient. No separate comment needed.

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
- **D5. Frosted glass styling.** New frosted surfaces MUST reference the tier CSS variables defined in `newtab.css :root` — `--pro-frost-card-{bg,blur}` (panels/sections/cards), `--pro-frost-floater-{bg,blur}` (modals/popovers/dropdowns), or `--pro-frost-menu-{bg,blur}` (context menus). Never reintroduce a literal `rgba(30,30,30,…)` or literal `blur(…)` on a tier surface — those drift. Banners/pills with intentionally different alpha (e.g. `#tab-bar`, `.pro-preview-banner`) sit outside the tier system. CLAUDE.md "Style and Pattern Constants" lists the tier values.
- **D6. Text shadow on all text over backgrounds.** `text-shadow: 0 1px 3px rgba(0,0,0,0.5);`. Critical for wallpaper readability.
- **D7. No secrets committed.** No Firebase config, no API keys, no tokens, no passwords in source files. `.env` file gitignored.
- **D8. An interactive-control default must be the INTERACTIVE one — a rule that has to be opted out of every time IS the defect.** `.pro-toggle-row` was written `cursor: not-allowed` back when its only instance was a permanently-disabled placeholder. Every row added since has been live and has had to remember to opt out — the notifications row via `:has()`, the Focus-blocking row via its section class — and the row nobody remembered was **the Analytics row itself**, the one the default had been written for. It shipped wearing a "you can't click this" cursor over a control that worked perfectly. The base is `cursor: pointer` now, and only a genuinely disabled row is special, keyed to `:disabled` **state** rather than to a hard-coded row id so it cannot go stale the day a row goes live. The redundant per-row opt-outs were deleted in the same commit: a rule that opts out of a default that no longer exists teaches the next reader to copy it into a fourth row. **Generalize it — when the second instance needs an opt-out, invert the default rather than writing a third.** `12a7fb4`.
- **D9. A shared helper that gains a PRECONDITION obliges you to grep every caller in the same commit.** `applyWallpaper` grew a "only when the picker is open" guard for a preview-before-commit flow; the non-modal callers (Settings > Remove among them) had no picker open and silently became no-ops, so Remove looked inert for two shipped releases. The refactor that adds the precondition is the commit that must inventory the callers — not a later bug report. Applies to any helper reached from more than one entry point, and doubly to preview/commit refactors, where the new state is by definition absent on the paths that were there first. `ddba4d3` (fix) / `493c7a6` (the commit that introduced it).

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
- **H2. A file imported by shipped code MUST be in the `build.sh` allowlist.** These are not alternatives — read the two conditions together, not as an either/or:
  - **If the module still ships** (still `importScripts`-ed / `<script src>`-ed by `background.js`, `newtab.html`, or anything else in the ZIP), its file **must** be in the `build.sh` allowlist.
  - **If the module should not ship**, remove the import **first**, and only then let it fall out of the allowlist.

  **The fatal quadrant is "excluded from the ZIP + still imported."** `importScripts` of a file that is not in the ZIP throws at service-worker registration, which kills the entire background script — every listener, alarm, and handler in it, not just the missing module. A `<script src>` pointing at a missing file fails the same way on the page. This is invisible in dev because the unpacked tree has the file on disk; it only detonates in the built ZIP.

  Verify by resolving the import graph of the **built ZIP**, not the working tree: extract it, walk `importScripts` / `<script src>` transitively from the manifest's declared `service_worker` and from `newtab.html`, and assert every target is present. This caught the 2026-07-15 release blocker (see Recently Resolved) and is cheap to re-run whenever a file is added to or removed from the import graph.
- **H3. Prototype storage keys are disposable.** A prototype uses its own storage key (e.g., `tracking_prototype`). The user can wipe it at any time without affecting production data.
- **H4. Prototype does not add user-facing UI** unless the task explicitly calls for it. Prototypes live in the service worker, in debug helpers, and in console output.

### Section I: Live Verification Gates

Run when the task touched any of the following — these change types CANNOT ship to Needs Review on code-reading alone. The IMPLEMENTATION comment must use the `AUDIT (code-reading only; live verification required) — ...` wording, and the task notes must call out a manual live-verification pass as a Needs Review prerequisite.

- **I1. Event handler attachment and lifecycle.** Adding / removing / re-binding `addEventListener`, `chrome.contextMenus.create`, delegated event handlers, or any handler that participates in the open/close lifecycle of a panel or menu. Code-reading misses race conditions between handler attach and first event, double-binding across re-renders, and handlers attached to elements that get replaced by `innerHTML` rewrites.
- **I2. Render flow changes.** Anything that mutates the order or conditions of `render()`, `renderMainGrid()`, `renderSidebarGroups()`, `renderProTagsSection()`, or other top-level render functions. Code-reading misses subtle DOM-state loss when an outer container is rewritten (e.g., expansion classes, focus, scroll position, contextmenu state).
- **I3. Contextmenu / focus / hover behavior.** Changes to right-click menu construction, the outside-click close pattern, focus management across menu transitions, or hover-driven UI like the sidebar expansion. Code-reading misses Chrome's actual focus / blur / pointer event sequence — these only surface in a live browser.
- **I4. Sidebar lock state.** Anything that reads, writes, or guards `sidebarLocked`, `sidebarCtxState`, `tagSubmenuContext`, `tagCreateContext`, or other lock flags that gate the sidebar's `mouseleave`-driven collapse. Code-reading misses the "lock leaks across feature interactions" class of regression — the [1.0.9.2] sidebar / tag submenu interactions hit this multiple times.
- **I5. Drag-and-drop integration.** SortableJS callbacks, `onEnd` / `onAdd` / `onUpdate` handlers, and any code path that mutates storage in response to drag events. Code-reading misses SortableJS's event ordering quirks and the divergence between expected and actual DOM state when `onEnd` fires.

The originating data point for this section is the [1.0.9.2] right-click-tag-attach saga (Asana 1214425856049640): five rounds of follow-up commits were needed because each round's audit was based on code-reading and missed regressions that live verification immediately surfaced. The pattern was consistent — handlers attached to wrong containers, render flow wiping DOM-only state, sidebar locks not propagating across the parent-menu / submenu boundary, and one focus-mismatch that needed a synthesized cursor anchor. None of these were detectable by reading the diff; all five were detectable in a 30-second Chrome session. Section I exists so future tasks in these change types do not repeat the saga.

Console-based verification fully satisfies these gates when the snippet exercises the same code paths a UI walkthrough would. When the relevant change is in a storage-layer or pre-UI module, console verification is the preferred form. Two procedural notes:

- Always reload the extension via chrome://extensions before running verification snippets, so the running code matches the latest commit. Function.toString() reads the live source; if it disagrees with source on disk, the extension was loaded before the most recent build, not that the commit is missing logic. Confirm reload state before suspecting a commit-vs-build divergence.

- Storage methods that internally call saveAll often use a closure-captured local reference, not Storage.saveAll. Reassigning Storage.saveAll in a test snippet does NOT prevent persistence. To run truly in-memory tests, either accept the persistence and add a cleanup step, or work directly on a JSON-cloned data object that's never passed to a method that calls saveAll.

- **I6. Browser automation runs against an ISOLATED SCRATCH PROFILE, never the developer's default profile — and `--user-data-dir` alone does not isolate Edge.** A fresh `--user-data-dir` looks like isolation and is not: Edge still force-installs extensions listed under the `Extensions` keys in `HKLM`/`HKCU`, and still pulls extensions and settings through the signed-in OS account, so a "clean" profile came up carrying Samson's real synced extensions. Third-party extensions inject listeners and CSS into the page under test, which both pollutes measurements and exposes personal browser state to test runs. **The convention:** a repo-adjacent, gitignored `.scratch-profile*` plus `--no-first-run --no-default-browser-check --disable-sync` and `--disable-extensions-except=<repo> --load-extension=<repo>` (plain `--disable-extensions` would disable the subject too). **Teardown kills by PID, never by image name** — `taskkill /IM msedge.exe` closes the developer's real browser windows along with the test one; capture the PID at launch or just close the CDP target. Convention established in `638bbde`; the image-name teardown mistake is recorded because it was made once.

### Section J: Verification Snippet Anti-Patterns

Run before publishing any console-based verification snippet (the kind written for Section I gates or any pre-Needs-Review verification).

- **J1. Stub, do not spy.** When isolating `Storage.saveAll` for a verification snippet, replace it with a no-op stub. Never wrap it with a forwarding spy that still calls the original.

  ```
  // CORRECT — stub. Returns undefined, blocks the saveAll write path entirely.
  Storage.saveAll = async () => {};

  // ANTI-PATTERN — spy. Forwards to real saveAll, persists fixtures to chrome.storage.local.
  Storage.saveAll = async (...args) => { saveCount++; return _origSaveAll.apply(Storage, args); };
  ```

  The spy looks helpful (it gives you a call count) but every call still writes to `chrome.storage.local`. Verification snippets must leave storage exactly as they found it. The spy's intermediate writes pollute real state even if a final cleanup tries to restore — and the [1.0.10] / [1.0.10.1] verification snippets shipped this anti-pattern twice despite explicit "stub Storage.saveAll" instruction in their PLANs. Spy patterns are appropriate for production telemetry; never for verification snippets.

- **J2. Stubbing alone is not sufficient.** At least one persistence path bypasses `Storage.saveAll`. During [1.0.10] Phase A verification, the renderer's `[LaunchPad] Storage changed externally, refreshing` log fired multiple times during the snippet despite `Storage.saveAll` being stubbed — meaning a CRUD method, debounced flush, or direct `chrome.storage.local.set()` is sidestepping the `saveAll` choke point. Treat the stub as the primary mechanism, not a complete one.

- **J3. Canonical safe pattern.** The combination — stub + full-data backup at the start + always-restore in a `finally` — is the only reliably-clean snippet shape:

  ```
  const _origSaveAll = Storage.saveAll;
  Storage.saveAll = async () => {};
  const _backup = JSON.parse(JSON.stringify((await chrome.storage.local.get('data')).data));

  try {
    // ... verification operations ...
  } finally {
    Storage.saveAll = _origSaveAll;
    await chrome.storage.local.set({ data: _backup });
  }
  ```

  Either the stub or the backup-restore alone is incomplete. The stub blocks the primary write path during the snippet; the backup-restore catches anything that bypasses it. The `finally` ensures restoration even if the verification body throws. The spy pattern is still wrong even when wrapped in this safe shape — the backup-restore catches the pollution at the end, but the spy unnecessarily writes intermediate fixtures along the way (which can fire renderer side effects and skew the very behavior the snippet is trying to verify).

- **J4. Cleanup is non-negotiable.** Whichever pattern is used, the snippet must restore the original `Storage.saveAll` at the end. Leaving `Storage.saveAll = async () => {}` dangling in a live tab silently breaks all subsequent CRUD until the page reloads.

- **J5. Storage is stateless-by-argument — thread `data` through every call.** Storage holds no data of its own. Every console session begins `const data = await Storage.getAll()`, then threads `data` (and `Storage.getActiveWorkspace(data)`) into every read: `getAllTasks(ws)`, `getAllGoals(ws)`, `getAllRecurringTemplates(ws)`, `getActiveWorkspace(data)`. Argless calls return `[]` or `null`, NOT errors that explain themselves. Mutations on the fetched object persist via `await Storage.saveAll(data)`. Console writes through `saveAll` count as same-tab writes: the write-provenance gate suppresses the re-render, so the UI may show stale state (e.g. a stale Paused chip) until the next full render — storage is correct, force a render before suspecting a bug.

  **Most `getAll*` readers exclude trashed items — but not all of them. Check, don't assume.** `getAll` reads like "everything" and usually is not:

  | Reader | Trashed (`deletedAt`) rows |
  |---|---|
  | `getAllTasks(ws)`, `getAllGoals(ws)`, `getAllRecurringTemplates(ws)` | **excluded** — "all *live* items" |
  | `getActiveTasks/Goals/Tags/RecurringTemplates(ws)`, `getCompletedTasks/Goals(ws)` | **excluded** |
  | `getAllTags(ws)` | **INCLUDED** — the exception; returns every tag, deleted ones too, and expects the caller to filter |
  | `getTagById(ws, id)` | returns `null` for a soft-deleted tag |

  So a snippet that creates an item, soft-deletes it, then asserts against `getAllTasks` sees a count that looks like data loss and is not — the row is in the trash, exactly where it belongs. The mirror-image trap is asserting against `getAllTags` and finding trashed tags still in the list.

  To read trashed items, `getDeletedGoals(ws)` and `getDeletedTasks(ws)` exist — **and nothing else does**. There is no `getDeletedTags` or `getDeletedRecurringTemplates`; for tags, diff `getAllTags` against `getActiveTags`.

  Four separate verification sessions on 2026-07-14 tripped on this family of pattern from different sides.

- **J6. Assert what the cascade actually renders, not what the spec intends.** A verification snippet must read the COMPUTED / rendered output — `getComputedStyle(el).color`, the actual `textContent`, the resolved attribute — and compare that to the requirement. Restating the spec's intended value as both the expected AND (implicitly) the actual — "the ink should be white, the code sets white, therefore pass" — verifies nothing: it cannot catch a value that is set correctly in one place and then overridden by the cascade, inheritance, or a later write. This is the a68dd89 lesson: on-card ink was authored white but inherited the body's dark `#202124` at the board root and rendered illegible on image wallpapers; a snippet asserting the intended white would have passed while the pixels were black. Read the END of the pipeline, not the middle. (Corollary to Section K: computed-style harnesses lie in their own ways — but a snippet that never reads computed style at all cannot even be lied to; it is asserting against itself.)

  **This rule is now mechanised — it lived as prose here (e5e9597) and unmechanised prose let the same class ship a second time.** Two artifacts carry it: `tools/check-panel-ink.mjs`, a structural proxy wired into `build.sh` ahead of packaging (8902816), and the localhost + `getComputedStyle` measurement recipe documented in that file's header, which is the *authoritative* check. See **Section O** for what the static gate can and cannot see, and **Section P2** for what mutation-testing the gate found inside the gate itself.

Originating data points: [1.0.10] commit 2f00d01 and [1.0.10.1] commit 71eafe0 — both shipped verification snippets that used the spy pattern despite explicit "stub `Storage.saveAll`" instruction in their PLANs. The "Storage changed externally" observation in J2 surfaced during [1.0.10] Phase A verification on 2026-05-10 and forced the broader stub-plus-backup pattern as the canonical answer.

### Section K: CSS Harness Environment Traps

Run before trusting any in-browser (CDP / claude-in-chrome) harness that measures computed style. Both entries below produced **confident, plausible, wrong numbers** — the failure mode is silent, not a crash.

- **K1. `color-mix()` resolves to float channels — normalize before any contrast maths.** Chrome serializes `color-mix()` to CSS Color 4 form, `color(srgb 0.945098 0.768627 0.0588235 / 0.14)`, whose RGB channels are **0–1 floats**, not 0–255 integers. A parser written for `rgb()`/`rgba()` reads `0.945` as a channel value, so every colour flattens to near-black and all contrast arithmetic silently collapses. Observed: a ring measuring **7.59:1** was reported as **1.16:1** — comfortably "failing" a 3:1 gate it actually passed by a wide margin.

  ```
  // Detect the function form and scale; do not assume rgb().
  function parseRgb(s) {
    const m = s.match(/[\d.]+/g); if (!m) return null;
    const k = /^color\(/.test(s.trim()) ? 255 : 1;   // color(srgb ...) is 0-1
    return { r: +m[0]*k, g: +m[1]*k, b: +m[2]*k, a: m[3] === undefined ? 1 : +m[3] };
  }
  ```

  Also flatten translucent ink over its actual backdrop before measuring — an alpha ring judged as if opaque overstates its real contrast. Both corrections are needed; either alone still lies.

- **K2. Runtime theme toggling does not work in this environment — use one iframe per theme.** Post-load style mutations made from the CDP context **do not take effect in computed style**. Toggling `html.bg-light` at runtime, and even setting an inline `color` or `background-color`, is ignored by `getComputedStyle` — in a fresh, foregrounded tab too. A harness that flips the theme then reads styles is reading the *parse-time* theme while believing it read the other one, producing false failures (and, in the mirror case, false passes).

  The working structure is **one iframe per theme, each loading its theme at parse time** from the query string, never toggled afterwards:

  ```
  <iframe src="/_rows.html"></iframe>         <!-- dark  -->
  <iframe src="/_rows.html?light"></iframe>   <!-- light -->
  <!-- inside _rows.html, before the stylesheet: -->
  document.documentElement.className =
    new URLSearchParams(location.search).has('light') ? 'has-bg bg-light' : 'has-bg';
  ```

  **Always carry a sanity guard** that asserts a post-load inline override *does* take effect. Whether it *passes* or *fails* is itself the diagnostic — read it, do not assume it.

  **The freeze is CDP-specific, not universal.** The failure above was observed driving the tab over the Chrome DevTools Protocol. Under the **`javascript_tool`** path (extension-injected page script, as used for bd95cf8's three-frame CSS pass), a post-load inline override **does** take effect: the sanity probe set `padding-top:99px` after load and `getComputedStyle` returned `99px` on all three frames. So the guard is not a fixed "must fail" — it reports which harness transport you are on. Parse-time-per-iframe is still the right construction regardless, because it is strictly safer and needs no per-transport reasoning; but do not treat a *passing* post-load override as evidence the harness is broken. (2026-07-20, Arc B live-fix round.)

  Poll for the real iframe document rather than waiting on `load`: an iframe starts on `about:blank`, which already reports `readyState === 'complete'`, so a naive wait resolves before the `src` has loaded and every query returns `null`.

- **K3. Never delete a CSS rule by regex — a GROUPED selector orphans its leading line into the NEXT rule.** Deleting `#foo`'s rule with a pattern like `/[^\n]*#foo[^{]*\{[^}]*\}/` works on a standalone rule and silently corrupts a grouped one. Given:

  ```
  html.has-bg #content,
  html.has-bg #first-run-toast { position: relative; z-index: 1; }
  ```

  removing the `#first-run-toast` half takes its line **and the shared `{...}` body**, leaving `html.has-bg #content,` dangling. A trailing comma is not a syntax error — the orphan simply joins whatever rule comes next:

  ```
  html.has-bg #content, html.has-bg #content-header::after { display: none; }
  ```

  `#content` — the `<main>` wrapping the entire grid — silently inherited `display: none`, and the whole page rendered blank on every wallpaper.

  **Three reasons the usual checks miss it, all of which held in the real incident:**
  1. **It is not an error.** The merged rule is *valid CSS*. Nothing throws, nothing fails to parse, and the console stays completely clean — so "zero errors" tells you nothing.
  2. **Brace balance still passes.** A complete `{...}` block was removed, so open/close counts match and a well-formedness check reports depth 0. Balance checking cannot detect this class.
  3. **JS looks healthy.** `render()` runs to completion and writes the correct markup; any log placed *after* it still prints. The DOM is fully populated — only its container is switched off, so DOM-presence probes near the failure can mislead badly (an ancestor walk from `[id*=group]` matched the sidebar's `#sb-group-list` first in document order and never inspected `#groups` at all).

  **Before deleting:** grep the selector and check whether the matched line ends in a comma, or whether the line above it does. Afterwards, scan for orphans — a selector line ending in `,` whose next non-blank line begins a new selector block is the signature.

  **The countermeasure is a container-chain render guard**, not more logging: assert every element from the outermost layout container down to the grid is neither `display: none` nor `visibility: hidden`, has a non-zero bounding box, and retains the positioning it is supposed to have. Per Section I discipline, prove the guard can fail — reintroducing the broken rule must turn it red (it did: `#content -> none`, `#groups -> 0x0`, every section `0` height). A guard that has never failed is not yet a guard.

Originating data points: established during [1.0.17]-era polish commit 77fabf7, where the first harness was a single page toggling `html.bg-light` at runtime and **reported a light-theme amber failure that did not exist** — the sanity guard caught the lie and the iframe-per-theme rewrite was the fix. Corroborated in commit 567a603, where K1's float-channel trap surfaced on the amber-row contrast check and, once fixed, exposed a **real** finding underneath it (55% ring alpha genuinely failing 3:1 on light wallpapers at 2.19:1, shipped at 85%). K3 was paid for in [1.0.19]: commit 623f44b removed the dead `#first-run-toast` by regex and shipped a **completely blank grid** to fresh installs *and* to every existing user on update, with zero console errors, passing brace balance, and a correct `render()`. Root-caused and fixed in ec2e00e, which also added the container-chain guard and demonstrated it failing against the reintroduced bug. All three entries earned their place by producing wrong answers first.

### Section L: Background-Writer Serialization

Run before adding, or writing a harness for, any background (`background.js`) code path that mutates the `data` storage key.

- **L1. Every background writer of `data` must go through the serial queue (`enqueueBgData`).** Each background mutation is its own `getAll → mutate → saveAll` cycle. `Storage.getAll()` returns a **fresh, independent object per call** (a structured-clone snapshot from `chrome.storage.local.get`), and `Storage.saveAll()` writes the **whole blob** — so two cycles that interleave are last-write-wins: the later `saveAll` silently overwrites the earlier task's fields, even when the two touched **disjoint** fields. `chrome.runtime.onStartup` fires several such writers together, un-awaited (session anchor, pro reconcile, recurring sweep, trash purge), and a genuine cold start adds a **fifth from a separate entry point** — the missed daily-sweep alarm (`nextRecurringSweepAt` scheduled the next 03:00, which elapsed while the machine was off, so it fires as a missed alarm just after launch). This is how bug 1216739924148350 shipped: the `[1.0.17]` cold-start session anchor (`sessionAnchorAt := now`, `idleMs := 0`) was written, then a sweep that had read the pre-anchor snapshot wrote its blob back on top, reverting `sessionAnchorAt` to `startedAt` and restoring the pre-shutdown `idleMs`. Fixed in b72b0a6 by funnelling every background `data` writer through one FIFO queue (`enqueueBgData`) so each read sees the prior write; disjoint-field writers then all land regardless of trigger or arrival order. Session snapshots (`savedSessions` key) stay unqueued — a different key cannot clobber `data`. **The rule for new code: if a background path writes the `data` key, it goes through `enqueueBgData`, or it is a latent clobber.**

- **L2. A single in-memory object cannot reveal a multi-writer clobber — the harness must model independent snapshots.** The simulated gates that passed before the bug shipped called `anchorBrowserSession(data)` on **one shared in-memory object** and asserted its fields. A single writer cannot clobber itself, so the race was structurally invisible — the harness could not fail on this class no matter how many assertions it carried. The honest harness loads the **real** `storage.js` in a Node VM against a fake `chrome.storage.local` that (a) **clones on every `get`** (the structured-clone semantics that create the independent snapshots) and (b) **injects latency** into `get`/`set` so the two cycles actually interleave. With that, the un-serialized fan-out (== reverting the fix) reproduces the clobber (`sessionAnchorAt` reverts to `startedAt`) and the serial queue makes the anchor land in **both** arrival orders (anchor-first and missed-alarm-first). Per Section I discipline, prove the guard can fail: reverting to the un-serialized writers must turn it red. A concurrency harness that shares one object across "concurrent" writers is testing nothing.

  Fixture trap that hides inside L2: the anchor's writer no-ops (writes nothing) when there is no active task, and `getActiveTask` / `isTrackingPaused` read **top-level** `data.activeTask` / `data.trackingPaused`, not per-workspace fields. A fixture that nests `activeTask` under a workspace makes `anchorBrowserSession` return false without writing — at which point `sessionAnchorAt === startedAt` holds because the anchor **never ran**, and a "clobber reproduced" assertion passes for the wrong reason. Keep a green control (the serial path genuinely advances the anchor) alongside the red one so a non-writing fixture can't fake the red.

Originating data point: bug 1216739924148350 — the `[1.0.17]` cold-start session anchor silently reverted on a genuine full-shutdown restart. The stored state alone could not distinguish "onStartup fired and was clobbered" from "onStartup never fired"; the fix (b72b0a6) is robust to both because it guarantees the anchor lands whenever onStartup fires, in any ordering. The harness gap (L2) is why the simulated step-12..15 gates went green while a real cold start failed.

### Section M: Search / Grep Tooling Traps

Run before trusting any grep- or ripgrep-based search or audit over the repository.

- **M1. `tracking.js` is ripgrep-invisible — it embeds NUL bytes, so `rg` classifies it as binary and SILENTLY skips it.** Every tool built on ripgrep (the Grep tool, any `rg`-driven audit sweep) inherits this: a search returns "no matches" with no error, so a grep that never inspected the file reads identically to a grep that inspected it and found nothing — a false negative that looks like a clean result. The NUL bytes are DELIBERATE and correct: `agg.workspaceId + "\0" + id` composite-key separators (~`tracking.js:962`; a space can never appear in a workspace/entity id, so NUL is a safe delimiter). **Do not "fix" them.** The consequence is tooling-only: search this one file with a NUL-tolerant reader — `Select-String` (PowerShell, the project convention), or `rg --text` / `grep -a`. Any future audit, harness, or refactor sweep that greps the tree for a symbol (e.g. checking the tracking engine for shared state, renaming an export, counting call sites) MUST search `tracking.js` explicitly with such a reader, or it will conclude a symbol is absent when it is present. Surfaced during the [1.0.18] Pomodoro audit, where every globbed `rg` over `tracking.js` returned empty until the file was read byte-wise; two NUL bytes were confirmed at file offsets 41216 and 41951.

  **Amendment (2026-08-09):** the NUL/`rg` rule above stands unchanged and is permanent. The **line-ending** half of the old instruction is retired — `tracking.js` was normalized to pure LF during the `[1.2.1]` round, so the "check the CRLF diffstat before committing this file" step no longer applies to it. `newtab.js`, `newtab.css` and `newtab.html` remain CRLF; the docs are LF. The general trap is unchanged: build multi-line anchors with the line ending the target file actually uses, or the patch silently misses and a whole-file diffstat is the symptom.

### Section N: Global Listeners and Anchored Popovers

Run when the task touched: any `window` / `document`-level listener, any body-mounted popover, dropdown, context menu or picker, or any open/close lifecycle that registers and tears down handlers. Both entries below shipped as user-facing bugs on the **same** popover within an hour of each other.

- **N1. A capture-phase listener on `window` receives NON-BUBBLING events (`scroll`, `focus`, `blur`, `error`) from EVERY descendant — scope any close-on-outer-event handler by target containment.** The Switch-task dropdown could not be scrolled by wheel, trackpad **or** scrollbar-drag. The CSS was textbook-correct (flex column, `max-height`, `flex:1; overflow-y:auto` on the list — the list genuinely was the scroll container and the visible thumb reflected real overflow). The cause was the *close-on-scroll* handler registered on `window` with `capture = true`. `scroll` does not bubble — which is exactly why the handler looked safe — but **capture phase still delivers it to every ancestor on the path**, so the instant the inner list scrolled by any input method, the window handler fired and destroyed the menu. The list could never move because moving it tore the menu down.

  The fix is one guard, mirroring the idiom the sibling outside-click handler already used:

  ```
  satSwitchScrollHandler = function (e) {
    if (e && e.target && menu.contains(e.target)) return;   // inner scroll: ignore
    closeSatSwitchMenu();                                    // page/ancestor scroll: close
  };
  ```

  **Two traps around the diagnosis, both worth keeping.** First, "wheel AND scrollbar-drag are both dead" was read as proof of a per-second re-render rebuilding the DOM — it is not: a capture-phase scroll-close explains both inputs more simply, because *all* of them emit `scroll`. Second, that re-render hypothesis was structurally impossible and could have been dismissed in one read: the menu is `document.body.appendChild`-ed, so it is a **sibling** of the pill whose `innerHTML` gets rewritten, not a child — a cadence re-render cannot touch it (proven empirically too: `scrollTop` held at 500 across four forced rebuilds). **A body-mounted popover is outside the render tree of the element it is anchored to.** Fixed in `a507fff` (bug 1217092237076418).

- **N2. Anchored body-mounted popovers must drift-close on RESIZE, not just on scroll.** These popovers are `position: fixed` with coordinates computed **once** at open time from the anchor's `getBoundingClientRect`. Any viewport resize — DevTools open/close, window drag, zoom change — reflows the anchor while the fixed menu holds its stale coordinates, orphaning it mid-screen. Page scroll and viewport resize are two independent drift sources and a handler for one is not a handler for the other; before `50499a1` there were **zero** `resize` listeners anywhere in `newtab.js`.

  A 13-popover sweep found 10 sharing the gap, fixed in one commit with **two mechanisms, each matching the popover's existing pattern**: a per-open handler for the Switch menu (paired with its per-open scroll teardown), and **one bind-once `window` `resize` listener** at init calling the same `close*` functions already served by the global scroll/Escape close path. Every `close*` is a no-op when nothing is open, so the permanent listener is leak-free by construction and needs no teardown. **New anchored popovers inherit this pattern** — register with the global listener, or pair `addEventListener` with `removeEventListener` in the close function if the popover manages its own.

  **Documented exception:** `#nest-rename-dialog` is deliberately left out of both drift-closes. It auto-appears to capture a just-nested group's name, so closing it on resize would silently discard the user's in-progress text. Rare cosmetic drift is the lesser evil against destroying input — and its matching absence of a scroll-close confirms the exclusion is intent, not oversight. **Banked residual, low severity:** the upgrade / workspace / nest / tag / restore popovers still lack *scroll*-drift-close; their anchors barely move on page scroll, so only the resize gap was closed. Recorded so it is not rediscovered as a mystery. Fixed in `50499a1` (bug 1217092468273137).

### Section O: Wallpaper-Panel Ink and Stacking Context

Run when the task added or changed any text, badge, or control that renders inside a panel whose surface darkens under `html.has-bg`, or applied `opacity` to anything containing a control. Companion to **J6** (assert what the cascade produces) and **Section K** (how computed-style harnesses lie).

- **O1. JS-RENDERED PANEL TEXT IS OUTSIDE THE STATIC INK GATE — any round that adds it verifies ink by BROWSER MEASUREMENT.** `tools/check-panel-ink.mjs` parses **static** `newtab.html`. Containers that ship empty and are filled at runtime — `#pro-tags-list` is the worked example — present the gate with zero text nodes, so every row, badge, button and inline note inside them is invisible to it and passes vacuously. That is precisely where the ink bug hid a third time: the "in trash" tag badge declared only `opacity: 0.7` and inherited its colour, i.e. body's `#202124` on the dark frosted panel — the 8902816 class exactly, but JS-rendered, so no gate had ever looked at it.

  **This is doctrine, not a to-do.** The reviewed decision was to **NOT** build a template-string parser for `newtab.js`: a JS-parsing gate would be fragile in exactly the way the ink gate was built to avoid — re-implementing rendering instead of observing it. So the obligation moves to the round: **any round that adds JS-rendered panel text measures its ink in a real browser** using the localhost + `getComputedStyle` recipe in the gate file's header (serve the real `newtab.html` + `newtab.css`, set `html.has-bg`, un-hide the panel, composite the computed colour over the frosted surface). Verify all three branches — dark photo, bright photo, light solid — not just the one you are looking at.

  **Related trap found by the same measurement pass:** `html.has-bg .pro-tag-name` beat `html.bg-light .pro-tag-name` at **equal specificity on source order**, so tag names rendered white-on-white at **1.10:1** on a light solid wallpaper. The order-independent form is the two-class guard `html.has-bg.bg-light` (the idiom the `--sat-accent` block already documents). Measured 1.10 → 14.54. Any new `bg-light` rule uses the two-class form so it cannot regress on source order. `8c76a5e`.

- **O2. Dim TEXT NODES, never a container that holds interactive controls — `opacity` on an ancestor creates a stacking group its children cannot escape.** The archived tag row's `opacity: 0.5` sat on the `<li>`. That is a group opacity: it composites the entire subtree as one layer, and **no child can raise itself back out of it** — not with `opacity: 1`, not with a higher `z-index`. The new **Restore** button, a real interactive control, would have shipped at half strength with no way to override it locally. The fix is to move the dimming onto the specific text nodes that should read as archived (the name and the swatch), leaving the control at a measured effective opacity of 1.

  The general rule: **`opacity` is not "make this text lighter" — it is "flatten this subtree into one translucent layer."** When the intent is de-emphasis, apply it to the leaf text nodes, or use `color` with alpha instead. Reserve container-level `opacity` for subtrees with nothing actionable in them. Code review does not catch this class — the CSS reads as obviously correct; it was found by measuring the button's effective opacity. `8c76a5e`.

- **O3. The MIRROR IMAGE of a68dd89: a LIGHT-surface token used on a surface that is DARK by default.** a68dd89 was dark ink falling through onto a dark frosted card. The inverse ships just as easily: a new label reached for `var(--text-secondary)` — a *light-theme* token, `#5f6368` — on the Pro card, whose default state is the dark frost, and measured **2.73:1**. An earlier draft of the same label sat at 3.66:1 and additionally lost on specificity. The fix in both directions is the same: **re-base the ink on the surface's own family** (the card's white-alpha ramp) and add a single `html.bg-light` override, rather than borrowing a token whose theme assumption is the opposite of the surface's. Neither token name warns you — `--text-secondary` sounds surface-agnostic and is not. `c4f8d83`.

  **Companion rule from the 2026-08-09 ink verdict:** *inheriting* a known-accepted contrast deficit (`.pro-section-subtitle` on light wallpapers — see DECISIONS.md, same date) is a **decision** and is not re-flagged. *Deepening* one — adding opacity or a lighter token on top of it — is a **defect**. Report the first as known-accepted; treat the second as a finding.

### Section P: Gate and Harness Integrity

Run when the task adds, extends, or relies on any automated gate, harness, or generator — including the ones in `tools/` and any verification suite written for a Section I gate. Every entry below is a defect found **inside a check**, not in the code the check was guarding.

- **P1. Generated assets are verified by ANALYSIS, not by assumption — a valid container is not valid content.** The three boundary chimes are synthesized by a committed generator (`tools/make-chimes.mjs`). Its decay early-out tested the **attack-multiplied** envelope, which is `0` on the first sample, so every partial rendered as silence — and all three files were written as **digital silence inside perfectly valid WAV headers**, at plausible file sizes. Nothing threw. Nothing was malformed. A file-exists check, a size check, a header check, and a "the generator ran successfully" check would all have passed while the feature made no sound.

  The gate that actually works measures the **content**: peak amplitude (0.5 FS) plus a DFT confirming each strike's real frequency and timing (chime1 659/988 Hz at t=0/0.28 s; chime2 523/659/784 Hz; chime3 392 Hz still ringing at 1.2 s). **J6 applies to assets exactly as it applies to CSS** — read the end of the pipeline, not the middle. Whenever a build step *generates* an artifact (audio, image, icon, sprite, minified bundle), assert a property of the artifact's decoded content, never of its wrapper. `a7cf131`.

- **P2. A VACUOUS GATE IS WORSE THAN NO GATE — gates must fail-as-broken when their inspection set collapses, and gate suites get mutation-seeded like any other harness.** Mutation-testing `tools/check-panel-ink.mjs` found **two defects in the gate itself**, both of which made it report a confident green:

  1. **It credited `html.bg-light` overrides as satisfying the wallpaper-ink requirement — so it PASSED the very bug it was written for.** `bg-light` is the light-*solid*-wallpaper luminance class; a photo wallpaper never carries it. That substitution is a68dd89's root cause verbatim, reproduced inside the tool built to prevent it. It now accepts `has-bg` scoping only.
  2. **Two parser slips silently reduced it to ZERO nodes checked, and reported PASS.** (The word `hidden` matched inside `class="… hidden"`, and the panel root ships with its own `hidden` flag that JS removes at runtime.) A gate that inspects nothing passes forever and reads exactly like a gate that inspected everything and found nothing wrong.

  **The countermeasures, both now standard:** a **minimum-node floor** — the gate hard-fails as *broken* if it inspects fewer than 20 nodes, rather than passing on an empty set — and **mutation seeding**: validate the gate by breaking the code four ways and confirming each is caught (strip has-bg ink from `.pro-toggle-row` / `.settings-header span` / `.pomo-setting-row`, and re-introduce the original B-2 bug), plus running it against the pre-fix commit `a7cf131` and confirming it flags exactly the five nodes the browser had measured. **Any gate whose result depends on a discovered set — files matched, nodes parsed, rules found — needs a floor on that set.** `8902816`.

  **Record correction, since the assumption cost a round:** there was **no committed contrast, a11y, ink or luminance suite at any point in this repo's history** before `8902816`. `tools/` held only `verify-package.mjs` and `make-chimes.mjs`. The Section K harnesses (`77fabf7`, `567a603`) were one-off measurement rigs built and discarded within their commits, never standing checks. The J6 rule existed as **prose only** (e5e9597) — which is exactly why the ink class shipped twice before anything mechanical could catch it. Do not assume a gate exists because a rule is written down.

- **P3. Mutation-seeding is standard for any harness guarding a SILENCE or ABSENCE property — a suite that tests nothing passes forever.** Assertions that something does *not* happen — no sound on expiry, no double-play, no write on a no-op, no duplicate listener after five open/close cycles — are the easiest to satisfy accidentally: a broken fixture, an early return, or a mis-wired stub produces the same green as correct behavior. The only proof the suite has teeth is to break the code deliberately and watch it turn red.

  Established as routine across the B-2 and tags rounds, with the seeded defects and their catch-counts recorded in the IMPLEMENTATION comment so the evidence is auditable: five defects on the sound suite (expiry made audible → 73 assertions fired; silence gate removed → 112; SW ignoring an open tab → 2; whitelist made permissive → 101; setter no-op guard dropped → 4) and four on `restoreTag` (drop the collision guard, make the no-op guard write anyway, return non-null for an unknown id, clear `deletedAt` to `0` instead of `null`). **Expect this now**: a harness asserting an absence ships with its seeded defects listed, or it is not yet evidence. This is Section I's "prove the guard can fail" applied to the suite as a whole rather than to a single assertion — and per **P2**, gates are harnesses too.

- **P4. A PROBE MEASURES A PROBE — the implementation re-measures its own shipped code.** The pre-PLAN measurement round for `[1.2.0]` concluded the tabs-API intercept produced no visible flash. The shipped intercept flashed. The supersession itself is the durable rule: **where a probe and the shipped implementation disagree, the shipped measurement wins, and the probe's conclusion is retracted in writing rather than quietly dropped** — a stale probe finding left standing in a doc is worse than no probe, because the next round cites it.

  *Candidate cause, explicitly UNVERIFIED:* the probe navigated to a `data:` URL placeholder, which commits far faster than a real extension-page load, so the window between commit and redirect that produces the flash was likely never opened. Recorded as the leading hypothesis so it is not re-derived, **not** as a finding — nobody went back and proved it. `f750170`.

- **P5. Round harnesses that live in a session directory protect NOTHING — new suites are COMMITTED under `tools/`.** Through the Insights, Focus-session, Focus-blocking and L1 rounds, every verification suite was built in a session scratch directory and evaporated with the session. The coverage was real when it ran and was worth zero afterwards: master was never protected by any of it, and the `[1.2.1]` MINI-PLAN could name "the committed board-suite harness" as a premise while no such thing existed. `tools/check-insights-readers.mjs` (`1e19b5d`) is the first committed round suite and the pattern for the rest — it carries **P2**'s anti-vacuity floor and a distinct **exit code 2** for "subject did not load". Recovery of the earlier rounds' coverage is tracked as Asana 1217302152465697. **The rule going forward: a suite that is worth writing is worth committing, under `tools/`, to the gate standards in P1–P3.**

Originating data points: the three `[1.0.18]` Round B / tags rounds. P1 was paid for in `a7cf131`, where three silent-but-well-formed WAV files were caught only by peak + DFT measurement. P2 came out of mutation-testing the ink gate erected in `8902816` — the mutation pass found the gate crediting the wrong theme class and, separately, silently inspecting zero nodes. P3 generalizes the practice that caught both, and the L2 discipline it descends from. P4 and P5 come out of the `[1.2.0]`/`[1.2.1]` trio rounds: P4 from the flash contradiction, P5 from discovering that eight rounds of harnesses had left no trace in the repo.


### Section Q: Mutation-Seeding Discipline

Run whenever a round claims a suite has teeth. **P3** says *why* to mutation-seed; this section is *how to do it without fooling yourself*. Every entry below is a seeding run that produced a confident, wrong number before it was caught — the failure mode is uniform: **a mutant dies for a reason unrelated to the assertion you were crediting**, and the suite is scored as covering something it does not.

- **Q1. The subject must LOAD and the clean run must PASS before any mutant is scored.** A mutation that breaks the module — a syntax error, a missing global, an unfaithful edit that deletes rather than alters — kills every mutant identically and reports a perfect score against a suite that never executed. The `[1.2.0]` R2.5 run reported a **false 7/7** this way: the fake `chrome` object had no `webNavigation`, so `background.js` threw on import and every mutant "died" at the same line. The runner therefore distinguishes **exit code 2 — "subject did not load"** from a genuine catch, and each run ships a **control**: a deliberately unloadable subject that must be reported as broken and NOT scored. `f750170`, mechanised in `1e19b5d`.

- **Q2. Report ANCHOR-MISS and ANCHOR-AMBIGUOUS separately from ESCAPED.** A seed applied by string replacement can silently land nowhere, or land in the wrong place. The scope-filter line occurs **four times** in `tracking.js`, so a naive `replace()` hit a reader the suite does not cover and the mutant "escaped" for reasons that had nothing to do with coverage; separately, an anchor written with a **space** never matched the **NUL** separator (M1) and applied zero seeds. Both read as coverage gaps and neither was one. Anchors are context-bound to the code under test, occurrence counts are asserted, and a mis-aimed seed is reported as a miss — never as a result. `1e19b5d`.

- **Q3. Seeds must be FAITHFUL — the writer still has to run.** Replacing `enqueueBgData(...)` with an uninvoked function expression *deleted* the writer instead of un-serializing it, so the suite went red for the wrong reason and the serialization assertion got credit it had not earned. A faithful seed for "this writer bypasses the queue" neuters the **queue** for that label and leaves the writer running. `5451504`.

- **Q4. Every concurrency writer is raced against a SIBLING, never exercised alone.** The context-menu-add writer passed in isolation and **escaped** its seed, because a single writer cannot clobber itself (this is **L2** applied to seeding). Each writer gets a scenario that runs it against another writer arriving in both orders. `5451504`.

- **Q5. Write-counting suites re-base on every backfill.** A suite asserting "N writes" silently mis-counts the moment a defaulting/migrating reader performs a backfill write on first read. Re-derive the baseline in the fixture rather than hard-coding a number that a future backfill will invalidate. `b6fa2b6`.

- **Q6. Purity assertions use a FRESH fixture.** "This reader does not mutate its input" was snapshotted *after* earlier reads in the same run had already triggered a prune, so a prune-on-read mutant had nothing left to prune and the assertion passed against broken code. Anything asserting absence-of-effect starts from an untouched fixture. `b6fa2b6`.

- **Q7. A fixture verifies its OWN seeding, with a read-back control.** A drag-to-nest harness interpolated its URLs incorrectly and produced literal unparseable strings; the "reproduction" it then reported was an artifact of the broken fixture. Read the seeded state back and assert it is what you meant to write before asserting anything about behavior.

- **Q8. A strict-order fixture must contain NO TIES — and the fix is the FIXTURE, never the sort.** Two domains summed to exactly the same total, so "rows are ordered descending" had no single correct answer and failed against correct code. De-tie the data. A sort "fixed" to satisfy an ambiguous fixture is a defect installed to make a test green.

- **Q9. Synthetic clicks assert `document.elementFromPoint(x, y)` hits the intended element BEFORE dispatching.** A first pass scored all three `.pro-toggle-row` labels as dead controls; the coordinates were below the fold in a scrolled panel and the clicks landed nowhere. A click that misses its target is reported as a **MISS**, never as a result — an off-target click produces a confident, entirely fictional finding. `12a7fb4`.

### Section R: Panel Layout, Scroll Containment and Reserved Space

Run when the task adds content to a tab panel, changes a panel's height/overflow chain, or reserves space for a message that appears and disappears.

- **R1. A tab panel's content has NO scroll path unless the panel provides one — `#content` is `height:100vh; overflow:hidden` and `html`/`body` are `height:100%`.** Nothing above a `.tab-panel` can scroll, so a panel child taller than the viewport is simply **clipped**: no wheel, no keyboard, no scrollbar, no way to reach the rest of it. Measured on the live Insights board, `.insights-tab` was 1421px inside a 676px panel with 745px unreachable and the wheel moving `scrollTop` 0 → 0 on **every element in the document**. Adding a fourth board module did not create this; it made an existing trap tall enough to hit.

  It was shared and had been solved three times privately — `#shortcut-grid-area`, `.tasks-body` and `.pro-preview-content` each own an inner scroller — while `.insights-tab` and `.dash-tab` did not (inflating the Dashboard past the viewport proved it clips identically, latent only behind shorter content). **The fix belongs on the shared `.tab-panel` root**, which is what stops the next panel's content from inheriting it a fourth time; it is inert for the three surfaces that already scroll, because their roots are `flex:1 + min-height:0` (or are scroll containers, whose automatic minimum size is 0) and so size exactly to the panel. **Bottom clearance goes on the board roots, not the panel** — a `padding-bottom` on the shared panel would shrink Home's grid scroller by the same amount.

  **Keyboard needs more than `overflow`.** A `div` is not a keyboard scroll target unless it holds focus, and after a tab switch focus sits on the tab **button**, outside the panel — PageDown moved nothing on **any** of the four tabs, including the two with working scrollers. Hence `tabindex="-1"` on the panels plus a focus call on Pro-tab switch, with Home excluded because its search input owns focus by design. **Known limit, banked:** the Tasks tab still has no keyboard scrolling, because its scroller is a *descendant* of the focused panel and is recreated on every render — fixing it needs focus restoration inside the render path, which would blur inline rename inputs. `12a7fb4`.

  Cross-check **N1** whenever a surface becomes newly scrollable: capture-phase scroll-close handlers will now fire from it.

- **R2. A "reserve the space so the layout doesn't jump" pattern cannot be built on `.hidden`.** `.hidden` is `display: none !important`; a `visibility: hidden` rule intended to keep the box measured therefore loses, the element measures **0px**, and the layout shifts by the full row height anyway — which looks exactly like the reserve rule not being applied. The instinct to answer an `!important` with a second `!important` is the wrong move: give the element its own state class (`.is-quiet`) that means "present but silent" and keep it out of `.hidden` entirely. **And measure the box** — `getBoundingClientRect().height`, not "the CSS looks right"; the failure is invisible in the cascade and obvious in one measurement. `1942096`.

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

### 2026-07-15 — Release Build — prototype import vs. `build.sh` allowlist would have killed the service worker

**Area:** Release hygiene / Prototype discipline
**Fixed in:** Commit e13b6ab (bug 1216582708412142)
**Pattern:** **Excluded from the ZIP + still imported is fatal, and each half looks fine on its own.** `background.js` still ran `importScripts('tracking-prototype.js')` while `build.sh`'s allowlist omitted that file. `importScripts` of a missing file throws at service-worker registration and kills the *entire* background script — session saving, context menus, alarms, Pro reconcile, checkout-return license activation — not just the missing module. Shipped 1.0.4 was unaffected only by luck of timing (the prototype landed after that submission).

Three lessons worth more than the fix:

- **Dev cannot see it.** The unpacked tree has the file on disk, so everything works locally; the failure exists only in the built ZIP. Anything that reads the working tree instead of the build artifact is blind to this class.
- **The checklist itself was the bug.** H2 used to offer the allowlist and the import-removal as alternatives ("OR"). They are conjunctive: an imported file *must* be in the allowlist. A rule phrased as an either/or licensed exactly the state that broke. When a bug slips past an audit item, suspect the audit item's wording, not just the code.
- **Verify against the artifact, and prove the check can fail.** The fix was confirmed by resolving the ZIP's import graph — and by re-running the same check against the pre-fix tree to watch it fail. A check that has never failed proves nothing.

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
