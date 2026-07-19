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
   The "clean" wording is reserved for audits where Claude Code (or a human) actually loaded the extension in Chrome and exercised the affected paths. When the agent environment cannot drive a Chrome session (the common case), the second form makes the gap explicit so the reviewer knows live verification is still pending. Sections under **Section I: Live Verification Gates** must use the second form unless the audit was actually live-verified — code-reading alone is insufficient evidence for those change types. If the audit was clean, a single line is sufficient. No separate comment needed.

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

  **Always carry a sanity guard** that asserts a post-load inline override *does* take effect. It will fail in this environment — that is the point: it identifies the limitation instead of letting a silent freeze masquerade as a product defect. Corroborate with a screenshot; and note that two iframes reporting genuinely different token values is itself proof the reads are real, which a frozen style tree could not produce.

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
