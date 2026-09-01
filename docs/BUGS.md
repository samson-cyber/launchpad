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

- **D10. COMPUTE THE PROPERTY, DON'T GUESS THE CROSSOVER.** `tagTextColorFor` already chose chip ink per fill — it just scored the fill with a **threshold** (Rec 601 brightness, switch at 0.55) instead of the property it actually cared about. `#4A90E2` scored 0.519, a hair under, and took white ink at **3.29:1**; five of nineteen shipped fills failed 4.5:1 the same way. The chooser now computes the real contrast against both candidate inks and returns the better one. **A threshold is a guess about where the answer changes; the ratio IS the crossover, and asking directly costs two multiplications.** That is also what makes it correct for a hex a user typed and nobody ever tested. Joins D8 in the default-inversion family. `14ea15f`.

- **D11. AN INDICATOR MUST BE TRUE IN THE MOMENT IT IS SEEN.** The pill's liveness dot was asked to say "tracking" for an *active* task. It would have been a lie in exactly the moment it is read: the engine only holds an open session for a **trackable focused tab**, and the new-tab page is not one — so while the user looks at the card, nothing is accruing. The indicator therefore says two different true things and never conflates them: `openSince` set → a pulsing dot and **"Tracking"** (genuine accrual, reachable when a tracked site is focused in another window); armed but not open → a static dot and **"Ready"**, with the reason in the tooltip. **Design the claim against the state the surface is in WHILE IT IS BEING LOOKED AT, not the state that makes the feature sound best.** `satTrackingIndicatorHtml`, `[2.0]`.

- **D12. A TRAP DOCUMENTED IN A COMMENT PROTECTS ONLY ITS OWN FUNCTION.** `tracking.js` keys a day aggregate by the workspace that was **active at capture**, not by the task's own workspace, and `rollupBucketOverWindow` drops every aggregate whose `workspaceId` misses the scope. `focusedTodayForTask` knew this and summed across every workspace — **and said so in its own comment**. Every other reader added later re-derived the naive scoped read and returned nothing for exactly the tasks a two-workspace user tracks (the pill's headline read 25 minutes while the chips beside it read empty). A comment on the one function that got it right is invisible to the next author. **A cross-cutting keying rule belongs in a shared constant or a shared reader — `SAT_ALL_WORKSPACES` is that constant — not in prose attached to a single caller.** `dd56d02`.

- **D13. DEFERRAL GUARDS GO WHERE NOTHING HAS BEEN CONSUMED YET.** The Pro celebration must suppress three rival surfaces. Each of them **consumes something at the moment it decides to show**: the promo scheduler writes `lastPromoOpen` and increments `openCount`, and the badge splash persists its dequeue *before* painting (its D8 consume-on-show contract). A guard placed *inside* either callee would consume the surface without ever showing it — **a silent permanent loss, not a deferral**. The guards therefore sit at the **call sites**, where nothing has been read and nothing written. Assert non-consumption with an **eligibility premise** ("it was eligible this render"), or "not consumed" is vacuously true. `c2afed6`.

- **D14. ROUTING DECISIONS INHERIT THE PREMISES OF THEIR DESTINATIONS.** The 2026-04-26 decision sent trialing users to Pro Settings rather than the upgrade popover, and it was **correct when made** — the popover was a stub-laden detour. Its premise expired the day the popover gained live tier buttons into hosted checkout: the detour became the destination, and nobody revisited the routing until the person the trial was nagging tried to convert. **When a destination graduates, re-audit who is still being routed around it.** `01fdef9`. The same class, one repo over: `/thanks` would have missed `background.js`'s strict-equality `isCheckoutReturnUrl` and silently killed auto-activation — a route change inherits its destination's couplings too (website `1ffa3d5`).

- **D15. AN EXEMPTION THAT OUTLIVES ITS PREMISE IS A LATENT DEFECT.** The card's "Active since 9:04" line was genuinely static, so `satPaintTime` carried a note exempting it from the tick — *"a static timestamp that cannot change while the task stays active, so ticking it would be pure waste"*. When the line later gained a **running count**, the note stayed, and it is the documented ancestor of a frozen-hero report. **A line that acquires a moving value joins the tick in the same change, and its documentation moves with it** — the same commit, or the exemption starts protecting the defect. Check the doc comments of every surface a change gives a new property to. `9358392`.

- **D16. A BOUNDARY MUST NAME ITSELF AT THE POINT OF CONFUSION.** (Not an ink rule — the ink doctrine is Section O. Asana comments on the `[1.2.2]` round refer to a "D14/D16 ink doctrine"; no rule exists under those numbers — D14 is routing, D15 is exemptions, and this entry is the first D16.) The `[1.2.2 R2]` range picker greys every date older than the retention horizon. A control that refuses input without saying why reads as broken, so the caption beside it names the actual floor ("History starts 31 July") rather than restating the rule in the abstract. **The constraint and its explanation derive from ONE value** — the caption's date is the same horizon key the input's `min` attribute carries, itself derived from `RETENTION_DAYS` — so the boundary and the sentence describing it cannot drift apart, and both follow a future retention change without a second edit. A boundary explained by a hand-maintained sentence is a boundary that will eventually lie.

- **D17. A SINGLE-INSTANCE MODAL CANNOT RAISE A CONFIRM OVER ITSELF AND SURVIVE IT.** `openTasksModal` closes the modal after `onPrimary`/`onCancel` resolve, so a confirm raised *from* an open modal destroys the view underneath it, and reopening that view from inside the callback is immediately undone by the close that follows. The symptom is a correct mutation with no surface: the notes trash purge committed to storage exactly as asked and the trash view simply never came back, which reads as a broken feature rather than a lifecycle collision. **Reopen on a deferred macrotask** — the idiom this file already uses for the task-due conflict modal — and **forward `onCancel`** so a cancelled confirm restores the view instead of dumping the user out of it. Any surface that raises a confirmation over itself inherits this. `d7d15ce`.

- **D18. TWO ORDERING MODELS COEXIST DELIBERATELY, AND THE DIVERGENCE IS RECORDED RATHER THAN ACCIDENTAL.** Goals order by a `displayOrder` **field** and never touch their array; notes order by **canonical array position** and carry no order field at all. `reorderNotes` therefore matches `reorderGoals` in signature, validation ladder and save/return tail while its body permutes the array, and it adds a stricter every-live-note-exactly-once length check the goals version has no counterpart for. Neither model is wrong and neither is migrating to the other, so **the hazard is a reader who learns one and assumes the other**: a note reorder written against `displayOrder` would be a silent no-op, and a goal reorder written against array position would be discarded by the next render. `[1.1.2]` `2c054e0` made array order canonical for notes; `[1.1.3]` `d7d15ce` landed the sibling method.

- **D19. A CARET INSIDE A TRANSFORMED ELEMENT BLINKS ONCE AND DIES.** The caret is painted through the element's transform, but its blink invalidation is not computed in the same space, so the first paint lands and the next repaint targets the wrong rectangle. The symptom reads as a focus bug or a colour bug and is neither. **The fix is to flatten the transform while the element holds an editing caret** (`transform: none` on the editing state) and to narrow any hover rule so it cannot put one back. Cost two rounds, because the three obvious theories were all plausible, all wrong, and all disproven only by measuring: `caret-color` was never unset (it already resolved to the ink through inheritance), the empty editor never collapsed (150 by 198 px with a 21.75 px line-height), and compositing was not involved (LayerTree reported the editing card owning **zero** layers, with `will-change` present and removed). That last measurement disproved the rationale for the previous commit's own fix, which was reverted rather than left in the stylesheet asserting a mechanism no longer believed. The explicit `caret-color` was kept regardless, because a caret that depends on inheritance breaks silently the day a wrapper changes colour. `e3ed271`, superseding `bcaf712`.

- **D20. STRINGS RESOLVED AT MODULE LOAD ARE FROZEN FOREVER — store the key, resolve at render.** `newtab.js` is one IIFE, so `var X = [ { label: t("k") } ]` at its top level runs ONCE when the file loads. English resolves correctly, every static check agrees, and the value is then frozen in the array: a runtime locale change re-renders the page and these strings do not move, because the array still holds what was built at startup. R3 left **39** of them across six tables — the wallpaper labels, the safe-colour labels, the demo week's day names, both badge tables and the Insights range labels.

  Nothing could see this but a locale switch. A static gate cannot distinguish a call that runs at load from one that runs per render, and English is identical either way; it surfaced only because a string added in a later round appeared as UNGOVERNED under a pseudo-locale, which made no sense until the array was the answer. The array stores the KEY and the consumer resolves it, and the gate now fails unconditionally on an accessor call at module level (P9's rule: the string IS migrated, so nothing waits on a round).

  **Generalises past i18n to anything that can change after load** — a formatter bound to a preference, a label derived from a setting, a value read from storage at startup. `5d5b998`.

- **D21. ESCAPING IS CHOSEN BY THE SINK, NOT BY THE STRING.** The catalogue ships two accessors over one message: `t()` returns plain text for a sink that does not interpret markup (`textContent`, a `.title` property, `setAttribute`, `confirm()`, a modal option the modal helper escapes itself), and `th()` returns the HTML-escaped form for a value concatenated into a markup string bound for `innerHTML`. The same words take a different accessor at two different sinks, and that is the point.

  The original specification had the primary accessor escape by default. Two measurements inverted it. **Zero of 431** unique user-visible strings contained inline markup, so a raw accessor would have had no legitimate callers and its only use would have been misuse; and `openTasksModal` already escapes at the sink while roughly 120 sites are text sinks, so a pre-escaping primary would have **double-escaped** and printed `Backup &amp;amp; Restore` to users.

  **Only the direction that fails SILENTLY is enforced.** `th()` at a text sink is loud and cosmetic (the user reads `Don&#39;t`); `t()` spliced into markup is silent and is an injection hole the moment a value carries a tag. The gate flags a bare `t()` whose immediately adjacent literal opens an attribute value or contains a tag — adjacency, not statement-wide, because a statement-wide test flags every legitimate `t()` that merely shares a function with markup, and a gate that cries wolf gets switched off. A user-supplied value goes in RAW and the accessor escapes the finished sentence; pre-escaping the value is the double-escape all over again. `844e322`, `d51e38e`.

### Section E: Data Integrity

Run when the task touched: storage, backup/export, migration logic, or the `data` schema.

- **E1. Migration paths tested.** Users upgrading from older versions have data in the old shape. Any schema change needs a migration in `Storage.getDefaultData()` or equivalent, not just a fresh-install default.
- **E2. Backup/export round-trip.** Export → delete local data → import backup → verify data restored correctly. Covers groups, shortcuts, variants, settings, background.
- **E3. Recovery backup on import.** `data_pre_import_backup` key preserves the pre-import state so users can recover from a bad import. If you changed the import flow, this must still work.
- **E4. Storage key isolation.** Production uses `"data"`. Prototypes use their own keys (e.g., `"tracking_prototype"`). A prototype must never read or write the production key.

- **E5. THE PURGE SWEEP'S ENUMERATIONS ARE HARDCODED LISTS, NOT A REGISTRY — a new entity that does not register is silently never swept.** `purgeExpiredTrash` walks a literal array of entity keys — `["goals", "tasks", "recurringTemplates", "goalTemplates"]` **at the time of this defect**, and today `["goals", "tasks", "recurringTemplates", "goalTemplates", "notes", "namedSessions"]`, which is the point: it grows by hand, one commit at a time — and its tag-cascade batch walks a second, separate literal (groups, shortcuts, tasks, recurringTemplates, `goal.autoTagId`). Notes were absent from **both** from `[1.1.0]` until `[1.1.3]`, so no note would ever have been purged while the trash view promised "days until permanent deletion" that could never arrive, and a purged tag id would have stayed dangling in every note's `tagIds` forever. Neither omission throws, logs, or fails a gate; the only symptom is trash that never empties, which nobody notices for thirty days. **Every new soft-deletable entity registers in the first list and every new id-carrying structure registers in the second, in the commit that introduces it.** Worth knowing why the fix was one line each: the `expired()` predicate needed no change at all, because `[1.1.0]` had already aligned notes to epoch-ms `deletedAt` rather than the ISO the spec then described. `d7d15ce`.

- **E6. `tracking_days` IS NEVER SWEPT, so its `byTask` maps retain entries for tasks that were purged long ago.** Per-day aggregates are kept forever by policy while session records prune at 30 days, and nothing has ever removed a task id from an aggregate when that task left the workspace. The ids are therefore not merely stale, they are **uncollectable**: no lookup will resolve them again. Any reader or backfill that sums `byTask` across days must **filter to currently-existing tasks**, or it silently resurrects dead work into a total the user cannot account for and cannot click through to. This is not a defect in the retention policy — aggregates outliving their subjects is the point of keeping them forever — it is a constraint every consumer inherits. `[2.1]` `e2ff2a9`.

- **E7. HARDCODED SELECTOR AND ENTITY LITERALS ARE A RECURRING OMISSION CLASS, and the omission never announces itself.** **E5** recorded the first instance as a purge-sweep problem. It is not: it is a shape that recurs wherever a literal list is asked to know about a new thing. THREE instances landed in one month, in three different literals:

  1. `purgeExpiredTrash`'s entity list omitted **notes**, so no note could ever be purged while the trash view counted down to a deletion that would never arrive (`[1.1.0]` until `[1.1.3]`, **E5**).
  2. `emptyTrash` was missing from **both** the detach registration and the `announceTasksPurged` registration, so every bulk trash-empty since `[2.1]` leaked an uncollectable lifetime-accumulator entry per task. It hard-splices tasks exactly as `deleteTaskPermanent` does, and simply was not on either list (`[1.4.2]`, `1c6160f`).
  3. `PANEL_OVERLAY_SELECTORS` omitted `.tt-modal-overlay`, so a click inside a modal spawned from the sessions flyout counted as an OUTSIDE click and closed the flyout underneath it. That one was **shipped**, and had been closing the flyout under the attach picker since `[1.4.2]` (`[1.4.4]`, `6496cca`).

  None of the three throws, logs, or fails a gate. **Every new entity or spawned surface checks the literals that are supposed to know about it, BEHAVIOURALLY rather than by reading** — a de-registration mutant that turns exactly the affected rows red. `[1.4.4]` verified `namedSessions`' registration in the purge sweep that way rather than trusting `[1.4.0]`'s claim that it was there. The claim happened to be true; the point is that reading a literal proves nothing about the sweep that walks it.

  **The corollary, from instance 2: A COMMENT ASSERTING A PATH SET IS COMPLETE ROTS SILENTLY.** The comment above `announceTasksPurged` read *"both exits fire it"* — true the day it was written, false the moment the bulk action existed. Enumerations get re-derived from code at every audit, and a comment claiming completeness ("both exits", "all callers", "the only path") is a claim to CHECK, never a finding to cite. Same family as **D12**, one scope up: D12 is a comment that protects only its own function, this is a comment describing a set that has since grown.

- **E8. A FILTER ON A FIELD THAT DOES NOT EXIST IS INDISTINGUISHABLE FROM NO FILTER, and it reads as intent in review.** The goal picker filtered destinations with `!g.completed`. **Goals have no `completed` field.** A goal is finished by `status === "completed"`; `completed` is a TASK field, a boolean. The predicate therefore read `undefined` on every goal, excluded nothing, and looked deliberate to anyone reading it. Completed goals were offered as destinations, `reassignTaskToGoal` accepted the move (it requires a goal that is LIVE, not one that is ACTIVE), and the task landed in a container that renders nowhere: goal cards come from `getActiveGoals`, the standalone list is `goalId === null`, and the Completed box lists the goal as one row plus completed STANDALONE tasks. Three lists, and the task belonged to none of them. Data intact, visibility gone — Samson lost sight of a real task on his real profile.

  **TASKS AND GOALS DO NOT SHARE A COMPLETION FIELD**, and that is the specific trap. **When filtering entity state, read the entity's real state field from the code, and assert that the EXCLUDED case exists in the fixture** — a fixture holding no completed goal cannot tell a working filter from an absent one. The repair was structural rather than a corrected predicate: destinations now come from `getActiveGoals`, the same reader the Tasks surface draws its cards from, so "offered here" and "drawn there" became one question instead of two that happened to agree. `ae06109`.

- **E9. A READER THAT SILENTLY FILTERS RETURNS NULL FOR TWO DIFFERENT REASONS, and the caller cannot tell them apart.** "Not found" and "found, but this reader declines to see it" arrive as the same `null`. Seen twice in one week:

  1. The stranded-task bug above — the caller read the absence as "no such goal" when the truth was "wrong reader for this question".
  2. `confirmPurgeSession` resolved a TRASHED session through `getNamedSessionById`, which goes via `findLiveNamedSession` and cannot see a soft-deleted session BY CONSTRUCTION. Every session reachable from that confirm is trashed, so the `"This session"` fallback was not a fallback at all: it was the only branch that could ever run, and the confirm named nothing for every session it was ever shown for. `[1.4.4]` `6496cca`.

  **Fix the CALLER, not the reader, when other callers depend on the filtering.** Widening `getNamedSessionById` would have let launch, rename and reorder reach trashed sessions — the filtering is the feature. The caller now reads from the array the surface itself renders from, which additionally guarantees the confirm says exactly what the row said. **A null from a filtering reader is not evidence of absence**; before treating it as one, establish which of the two questions that reader actually answers.
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

- **G5. A USER-SUPPLIED VALUE REACHING AN HTML ATTRIBUTE NEEDS QUOTE ESCAPING — an escaper that handles text but not quotes is attribute injection wherever it fills a quoted attribute.** `esc()` escaped `&`, `<` and `>` and not `"` or `'`, which is correct for a text node and wrong for an attribute. It was filling double-quoted attributes with **user-typed session names**, so a session named with a double quote broke out of the attribute and could add its own. Found by self-audit during the localization recon, against code written earlier in the same week.

  **Fix the escaper, not the call site.** The instinct is an attribute-only variant beside the existing one, and that is a second helper to forget: the next author reaches for the familiar name, and the whole class comes back. `esc()` now delegates to the escaper that handles all five characters, so every existing call site is fixed at once and there is no way to pick the wrong one. The generalisation is the whole class, not the instance: **every site where a value the user typed reaches a quoted attribute**, which is what the fix was scoped to rather than the session-name symptom that surfaced it.

  Consequence for the catalogue accessors: this is why `th()` escapes quotes as well, and why a value passed to it goes in **raw** rather than pre-escaped (**D21**). `0641149`, bug 1217985856381677.

- **G6. A PERMISSION JUSTIFICATION WRITTEN FROM WHAT THE PERMISSION IS OBVIOUSLY FOR, RATHER THAN FROM ITS CALL SITES, OVERSTATES ACCESS — and the reader is a store reviewer holding the same manifest.** Three justifications were written from purpose on 2026-09-01. **Two were wrong, and both erred in the same direction: claiming MORE access than the product takes.**

  1. **`webNavigation`** was described as feeding per-site time attribution as well as focus blocking. It does not. Every `chrome.webNavigation` reference in the tree is one of three listeners — `onBeforeNavigate`, `onHistoryStateUpdated`, `onReferenceFragmentUpdated` — all routed to a single handler that redirects a top-level frame to `gate.html`. Attribution rides `chrome.tabs.onActivated`/`onUpdated`, `chrome.windows.onFocusChanged` and `chrome.idle.onStateChanged`, **none of which need this permission**.
  2. **`downloads`** was described as covering manual export. **The opposite is true**: manual export works with the permission DENIED, because the page builds a blob and clicks an `<a download>`. The only `chrome.downloads.download` call is the weekly auto-backup, which the service worker cannot do that way for lack of an anchor.

  **Why this is its own line rather than an instance of E7.** E7 is code failing to know about code — a literal list that silently omits a new entity, symptomless until someone notices trash that never empties. The failure mode here is different in kind and in audience: **the reader is a human reviewer deciding whether the extension ships, and they can read the same `manifest.json` you can.** An overstatement is therefore not a stale comment, it is **a false claim to the party holding the decision** — a rejection risk and a trust problem, not a maintenance smell. It also fails in the opposite direction from most disclosure bugs, which understate; writing "we also use this for X" when you do not hands a reviewer a discrepancy they did not have to go looking for.

  **THE CHECK: derive every justification from `grep`ped call sites, never from the permission's name.** For each declared permission, enumerate the actual references, name the API surface used, and say what it does with the result. `history` was checked the same way and was already right — the point is that being right by luck and right by derivation are indistinguishable in the written text, so derive all of them.

  **COROLLARY — an OPTIONAL permission must be stated as optional and requested at point of use.** `downloads` and `notifications` are in `optional_permissions`, not `permissions`. A justification written as though the permission were standing is wrong against a manifest the reviewer can check, and it forfeits the strongest thing you could have said: that the extension does not hold it unless the user turns the feature on.

  **THE NEGATIVE FINDING THAT MADE IT CONCLUSIVE:** grepping for `onBeforeRequest` returned **nothing**, and `webRequest` is **not declared in the manifest at all**. LaunchPad navigates a tab to its own page rather than inspecting traffic. That distinction is worth stating explicitly in a privacy justification, and it is only available to someone who searched for the API that is absent — a permission audit that only looks at what IS declared cannot produce it. `0a21974`, Asana 1217967430924095.

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

- **I7. Getting the scratch browser to actually load the extension, and identifying it once it has.** Three separate traps, each of which costs a pass and each of which fails as *"your feature is broken"* rather than *"your harness is wrong"*:
  - **`--load-extension` is ignored when a remote-debugging port is open.** Chrome/Edge 137+ hardened this deliberately. The page then loads as `chrome-error://chromewebdata`, where `chrome.runtime` is `undefined` and `document.body` is non-empty (the error page) — so naive presence checks pass while nothing under test exists. Add **`--disable-features=DisableLoadExtensionCommandLineSwitch`** and **`--enable-unsafe-extension-debugging`** to the I6 invocation. Verify the load rather than assuming it: read back `chrome.runtime.getManifest().name`.
  - **Never identify the extension as "the first `chrome-extension://` target".** Per I6 the profile is *not* extension-free: Edge force-installs its own (Edge Copilot Bridge, plus several MV2 background pages), so the first target is reliably one of *those*. Navigating to `chrome-extension://<wrong-id>/newtab.html` produces a plausible-looking URL and the `chrome-error://` page above. Match on the **manifest name**, or read the id out of the profile's own registry — `.scratch-profile/Default/Secure Preferences` → `extensions.settings[<id>].path` names the unpacked directory outright.
  - **The MV3 service worker is not a durable landmark.** It is a target for roughly its first 30 seconds and then suspends, so a target-scan that worked at launch throws "extension not loaded" on the next run against the same live browser. The `Secure Preferences` lookup is the primary path precisely because it does not depend on the worker being awake.

  Originating data point: the `[1.2.3]` pill-redesign runtime pass, where all three fired in sequence before a single assertion ran.

- **I8. `chrome.runtime.onStartup` NEVER FIRES for an extension loaded with `--load-extension`, so no startup-triggered feature can be tested end to end in the scratch profile.** A command-line unpacked extension is installed *fresh into the profile on every launch*, so the browser fires `onInstalled` — never `onStartup`. This fails in the shape I7 warns about: the feature looks broken. **Proven, not assumed:** after a real graceful close and relaunch, the `[1.0.17]` `sessionAnchorAt` was still 20h old, meaning the long-shipped `anchorBrowserSession` — code the round under test had not touched — had not run either. That is the discriminator to reach for, because it needs no instrumentation of shipped code: back-date `sessionAnchorAt`, relaunch, and see whether it was re-stamped. **The workaround, and its honest limit:** attach to the service-worker target over CDP and invoke the onStartup *work* (`anchorBrowserSessionBg(); foldClosedBrowserSpanBg();`) — real functions, real `enqueueBgData` queue, real storage, real order. What that cannot prove is that the *listener* is wired, so a build gate asserts the listener calls exactly those two in exactly that order, with a mutation seed proving the row reddens when the call is removed **or merely commented out** (an `indexOf`-based ordering check passes on a commented-out call — that seed escaped once for precisely this reason). Runtime proves the behavior; the gate proves the wiring. `[2.0]` closed-browser fold.

- **I9. A hard `taskkill /F` does not simulate "the browser was closed" — it simulates "the disk lied".** SIGKILL discards `chrome.storage` writes that have not yet flushed to LevelDB, so a relaunch reads *pre-test* state and every assertion about persisted state fails for a reason that has nothing to do with the product. Cost a full pass on the `[2.0]` fold round, where the fold correctly found no evidence to fold. **Close gracefully over CDP (`Browser.close`), wait for the devtools endpoint to go away, then `taskkill` by PID as a teardown safety net only.** A graceful close is also the more faithful scenario: the bug being tested is a user closing their browser overnight, not a crash. Assert the pre-close state after the close-triggering write has settled, so "the write landed" and "the feature worked" cannot be confused.

- **I10. The active-task pill is a PRO surface, so a free scratch profile renders it as an empty node.** Every stopwatch/card assertion reads `null` or `""` and the failure looks like a rendering regression. Run `LP.devPro(true)` (the shipped `IS_UNPACKED`-gated toggle) and reload before asserting on any Pro surface, and make it a **premise row** — assert `getProAccessLevel() === "active"` — so a future change to the toggle reports itself instead of silently emptying the suite.

- **I11. Driving a state change by writing storage from the page console does not re-render that page.** The `[1.0.11.2]` write-provenance gate suppresses the refresh for the tab that made the write, and a console write *is* that tab's write — while the page's in-memory `data` still holds the old value, because `Storage.getAll()` handed back a fresh object. The surface then sits frozen and reads as a bug. **Click the real control instead** (`#active-task-pill [data-sat-act]`), which is both correct and what the user does. Console writes remain fine for asserting *service-worker-side* effects, which read storage fresh.

- **I12. A hand-built task object does not render — seed through the real creation API.** `taskRowHtml` needs the full record shape, so a literal `{id, name, createdAt, displayOrder}` pushed onto `ws.tasks` stores fine, reads fine, and paints *nothing*: the Tasks panel opens with its headers and zero rows, which reads as "the tab is broken" rather than "the fixture is wrong". Seed with `Storage.createTask(data, {name}, wsId)` and capture the returned ids. Generally: **seed through the writer the product uses**, not through the shape you think it produces. `[2.0]` worked clock.

- **I13. Measure ink from SCREENSHOT PIXELS, not computed styles.** Every text surface in this product sits on a frosted, `backdrop-filter`ed panel over a user wallpaper, so the effective backdrop behind a glyph is something no `getComputedStyle` call knows — the only honest source is the composited pixels. Method: `Page.captureScreenshot`, hand the PNG back to the page as a data URL, draw it on a canvas (the browser does the decoding), read `getImageData` over the element's box, and take the 5th/95th luminance percentiles as ink and backdrop. Anti-aliasing softens the extremes, which biases the result DOWNWARD — the safe direction to be wrong. This is what caught the `[2.0]` worked line at **3.77:1** on a light wallpaper, a defect the static ink gate cannot see (JS-rendered) and the eye does not report. **Always pair it with a negative control** — set the ink to something plainly illegible and confirm the measurement says so — or a broken sampler reads as a clean pass.

- **I14. GEOMETRY INSIDE A DRAG PATH IS INSTRUMENTED, NEVER REASONED ABOUT.** The refusal-toast round (1217317549419902) had TWO plausible premises defeated by one measurement. The task's premise was that both hostnames and the mismatch verdict exist at the refusal point; they do not, because every target search pre-filters by domain and returns before capturing the rejected tile. The replacement premise — re-run the drop geometry with the filter removed — was also wrong, and only real drags showed why: SortableJS **displaces a non-frozen tile before the cursor ever reaches it**, so at `onEnd` the drop point sits over the dragged tile itself (22px away) with the intended target a full tile away (104px), and mid-drag `elementFromPoint` returns the grid, never a tile. The first build was therefore dead code that fired zero times across an entire suite. **Any claim about what exists at a given moment of a drag gets measured with real drags before it enters a spec** — Section I's founding rule applied to premises, not only to fixes.

- **I15. A RUNTIME PASS CAPTURES THE VISIBLE TEXT OF EVERY SURFACE THE CHANGE TOUCHES, not only its accessible labels.** The `[1.2.2]` Round 1 pass asserted that the deep-work chart's `aria-label` tracked the selected range, and never read the chart's two VISIBLE axis captions, which were hard-coded "30 days ago" and "today". Those shipped wrong: a 7-day board announced "30 days ago", and it took Round 2's audit to find it. An accessible label and the rendered text are two different strings that can disagree, and asserting the one that is easier to query proves nothing about the one the user reads.

  **AND THE TWO ARE ASSERTED SEPARATELY, never by one check spanning both.** A single regex written to accept either the visible string or the accessible name passes when EITHER matches, so it cannot distinguish "the product is right" from "my expectation of the visible half was wrong". That is exactly what happened on `[1.4.4]`'s trash entrance: the assertion `/1 session in trash|Trash . 1/` was satisfied by the aria-label, while its visible-text half never matched the rendered `Trash·1` at all — so a harness typo would have read as a product pass. Split them: the VISIBLE label asserted exactly (`Trash·1`), and the sentence that pluralises asserted on the accessible name (`1 session in trash`), which is where a sentence belongs. **P2's vacuity rule in the two-strings dimension** — an assertion satisfiable by the half you were not testing is measuring the wrong half. `6496cca`.
- **I16. A MANIFEST-ONLY CHANGE IS INVISIBLE TO AN ALREADY-LOADED PROFILE, and it fails in the I7 shape: your feature looks broken.** After editing `manifest.json`, the running unpacked extension still reported the OLD `optional_permissions` and every new message handler answered `undefined` with no error at all — not a rejection, not an exception, just a silent nothing that reads exactly like an unwired listener. The tree was correct; the profile was serving a manifest from before the edit. **Any runtime pass over a change that touches `manifest.json` begins with `chrome.runtime.reload()` and a read-back of the field that changed**, asserted rather than assumed, before a single behavioural assertion runs. `77490b2`.

- **I17. `Browser.setDownloadBehavior` DOES NOT GOVERN an extension's `chrome.downloads.download`.** The CDP call succeeds, reports no error, and changes nothing: files land in the real Downloads folder regardless. A harness that redirects downloads to a scratch directory and then asserts on that directory therefore measures an empty folder and reports the feature as broken, while quietly writing into the developer's actual Downloads. **A harness that touches downloads baselines the real folder before the run, treats only newly-appearing files as its own, deletes exactly those at the end, and reads the true path back from `chrome.downloads.search` rather than assuming where a file went.** `77490b2`.

- **I18. UNTRUSTED CLICKS CANNOT SATISFY A PERMISSION-GESTURE REQUIREMENT — and the resulting denial is the product behaving correctly.** `chrome.permissions.request` refuses to run without a user gesture and returns `false`; `element.click()` from an eval carries none. The shipped handler then reports a denial and renders its declined copy, which is **exactly right** and looks exactly like a bug. Dispatch real input (`Input.dispatchMouseEvent`) instead. Two further facts, both measured: a trusted click **does** raise Chrome's native permission bubble, which CDP cannot answer, so the request callback simply stays pending — the bubble was answered by screen-coordinate click on Allow after locating the window by PID; and once a user has granted an optional permission, a later `permissions.remove` followed by a re-request **with** a gesture re-grants without prompting again. `77490b2`.

- **I19. HOVER-REVEALED CONTROLS ARE NOT CLICKABLE WITHOUT A REAL POINTER, and a re-render drops the hover that was keeping them rendered.** A control styled `display: none` until its parent is hovered measures a **zero-size box at the origin**, so a coordinate click computed from `getBoundingClientRect` lands at (0, 0) and hits nothing; the run then reports the control as dead. Worse is the second-order version: an action that succeeds **re-renders** and replaces the node, dropping `:hover` because the mouse has not moved, so a loop over several such actions fails on alternating iterations — a pattern that reads as a flaky product bug and is entirely the harness. **Move a real pointer to the parent, re-read the box, assert it has non-zero width before clicking, and re-hover after any action that re-renders.** Companion to **Q9**, which requires the click to hit its intended element; this is the case where the element is not there to be hit yet. `5d9d11f`.

- **I22. CHROME 152 DOES NOT HONOUR `--load-extension` AT ALL, so I6's invocation is Edge-only in practice.** Measured 2026-09-01 while capturing the store set, which the brief asked to run on Chrome because the listing is a Chrome listing. Two launches, identical but for the debug port: **zero** entries matching the load path in either `Preferences` or `Secure Preferences`, no `chrome-extension://` target for the subject, and the service worker never starts — with `--disable-features=DisableLoadExtensionCommandLineSwitch` AND `--enable-unsafe-extension-debugging` both set, which is the pair that still works on Edge. The flags are not the problem and neither is the port; the switch is gone.

  The failure is silent in the I7 style: the browser opens, the debug port answers, and the only `chrome-extension://` targets are Chrome's own built-ins (`nkeimhogjdpnpccoofpliimaahmaaome` hangout_services, `fignfifoniblkonapihmkfakmlgkbkcf` network_speech_synthesis). **Anything that grabs "the first chrome-extension:// target" gets one of those and reports a nonsense result** rather than an error, which is exactly why I7 says to match on the load path instead.

  Re-enabling it needs an enterprise policy, i.e. a system setting, so it is not something a capture script may do to a developer's machine. **The practical rule: drive Chromium automation on EDGE, and treat the rendering as equivalent** — same engine, and `Page.captureScreenshot` captures the page, not the browser chrome, so no Edge UI can enter a frame. `tools/capture-screenshots.mjs` therefore takes the browser binary as its third argument, still defaults to Chrome, and fails with this diagnosis printed rather than a bare "could not resolve the extension id".

- **I20. CHROMIUM SCREENSHOTS DO NOT CAPTURE THE TEXT CARET, so caret visibility cannot be verified by `Page.captureScreenshot` at all.** Proven against a control rather than assumed: a plain focused input with an explicit black caret on white produced **zero changing pixels across ten frames**, while the same sampling correctly saw that input's border. A pixel-differ built to catch a blinking caret is therefore void, and a "no change detected" result means nothing about the caret. This is an **I8**-class interaction gap, and the practical rule is that **a caret question is a `HUMAN CHECKS REMAINING` item by construction** rather than something to keep trying to automate. Naming the limit up front is what kept the second caret round honest instead of claiming a fix that could not be seen — and the human's precise symptom report ("it pops up for one blink and then disappears", not "it never appears") is what redirected the diagnosis to **D19**. `bcaf712` / `e3ed271`.

- **I21. AN UNPACKED EXTENSION KEEPS SERVING ITS OLD CSS AND JS to already-open pages until the EXTENSION reloads — `Page.reload({ignoreCache: true})` is NOT enough.** This generalises **I16** from the manifest to every shipped asset, and it is worse than I16 because it is silent in the other direction: the page loads, renders, and answers every query, using the PREVIOUS stylesheet and the PREVIOUS script. Every rule added in a round is then measured against the build before it. On `[1.4.3]` a correct focus rule read as `opacity: 0` and cost a debugging pass; on `[1.4.4]` the same trap sat between an edited `newtab.js` and every assertion about it.

  **Harnesses call `chrome.runtime.reload()` before asserting anything**, then re-attach — the service worker and every page target are replaced, so handles taken before the call are stale. The tell is a measurement that matches the code exactly as it was BEFORE your edit: treat that as an instrument reading, not a finding. `d251d77`, `6496cca`.
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

- **J7. A STUB MUST PROVE IT FIRED BEFORE ITS SILENCE MEANS ANYTHING.** Stubbing the EXPORT does not intercept an internal caller: `setInsightsRangeDays` calls the module-internal `saveAll`, so replacing `Storage.saveAll` captured zero writes while the real write sailed through — and a "zero writes" assertion passed for entirely the wrong reason. **In this repo, persistence stubs go at `chrome.storage.local.set`**, which is `saveAll`'s own write boundary and the one point an internal caller cannot route around. Every harness asserting an ABSENCE of writes ships with a CONTROL row that first performs a write it expects to see — the preset setter writing exactly once — so a silent instrument is distinguishable from a silent subject. J2 ("stubbing alone is not sufficient") and P2's vacuity rule meeting in one place.

  **This rule is now mechanised — it lived as prose here (e5e9597) and unmechanised prose let the same class ship a second time.** Two artifacts carry it: `tools/check-panel-ink.mjs`, a structural proxy wired into `build.sh` ahead of packaging (8902816), and the localhost + `getComputedStyle` measurement recipe documented in that file's header, which is the *authoritative* check. See **Section O** for what the static gate can and cannot see, and **Section P2** for what mutation-testing the gate found inside the gate itself.

- **J8. READING A PRE-MIGRATION STATE IS SELF-DEFEATING WHEN THE READ PATH PERFORMS THE MIGRATION.** Two independent ways the "before" state cannot be observed, both hit in one round:

  1. **A dump through `Storage.getAll()` RUNS the sweep it was inspecting.** The one-time stranded-task sweep lives inside `getAll`, so a harness reading the profile through it performed the migration and then faithfully reported that nothing was stranded. **Anything asserting a BEFORE state reads `chrome.storage.local` directly**, never through the product's own defaulting reader.
  2. **Even a raw write cannot be observed pre-sweep while a page is open**, because the write fires `storage.onChanged`, the page re-reads through `getAll`, and the sweep runs before any read of yours can land. That is the feature working promptly, not a race to beat. The seed therefore reports what it wrote from INSIDE the writing eval, which is the only vantage point that exists before the page reacts.

  The general form: **a reader that repairs, defaults or migrates on read has no "before".** Establish which of your readers mutate, and reach past them. `53f8a3b`.

- **J9. ASSERT ON THE NODE THAT OWNS THE TEXT, NEVER ON AN ANCESTOR'S AGGREGATE.** `textContent` is the concatenation of every descendant, so a value injected into a CHILD shows up in the parent's `textContent` and the parent reads as correct. The probe hunting twelve misplaced markers asked whether the button's `textContent` contained the marker. It did — because the marker had been injected into the `<path>` inside the button, which is precisely the defect — and the probe reported **0 of 12 broken**. Reading the button's OWN child text nodes reversed the answer to **12 of 12**.

  The snippet is one line either way:

  ```js
  el.textContent                                   // wrong: includes every descendant
  [...el.childNodes].filter(n => n.nodeType === 3)  // the node that owns the label
    .map(n => n.nodeValue).join('')
  ```

  **Any assertion about "what this control says" means its own text nodes**, because that is what the user reads next to an icon. Same trap in `innerText` and in `.closest(...).textContent`. The check that eventually shipped this rule was written into the gate so it cannot recur silently (**P8**). `1e5ff29`.

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

- **K4. PERCEIVED-BRIGHTNESS FORMULAS ARE NOT WCAG LUMINANCE.** Rec 601/709 brightness (`0.299r + 0.587g + 0.114b` on raw channels) **skips the sRGB transfer function**, and it diverges from relative luminance most in the middle of the range — which is exactly where a chip palette lives. Any contrast decision uses the real maths: linearise each channel (`c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`), then weight `0.2126/0.7152/0.0722`. The hand-checkable references that catch a regression to the linear form: **`#808080` is 0.2159, not ~0.5**, and black-on-white is exactly 21. `14ea15f`.

- **K5. COMPUTED-STYLE COMPOSITING LIES OVER GRADIENTS — measure RENDERED PIXELS.** A sweep that composites `getComputedStyle().backgroundColor` up the ancestor chain reads **`transparent` for any element backed by a gradient**, so it scores the glyph against whatever is behind the gradient rather than the gradient itself. That reported the progress bar's in-fill label at **1.72:1** when it really measures 7.68–7.80, and the dual-layer clip it "failed" was already the correct shipped design. The harness now diffs screenshots: capture, hide the measured glyphs, capture again — **pixels that differ ARE the glyph, and the without-text pixel underneath IS the backdrop.** Three more artifacts surfaced the moment it ran: an element clipped to zero width scored against whatever showed through; a `-webkit-text-stroke` keeps painting when `color` goes transparent (a glyph compared against its own outline for a confident 1.10); and quiet controls were scored at resting opacity rather than the revealed state a user sees. `eba59f5`.

- **K6. A FIX FOR AN INSTRUMENT ERROR IS A NEW DEFECT — establish what the number MEASURED before improving it.** Four of the eight items on one ink-remediation list dissolved as instrument error under K5. Had they been "fixed", correct shipped code would have been rewritten to satisfy a broken probe, and the real cause would have survived. **Report the dissolution; do not quietly repair numbers that were never wrong.** `eba59f5`.

- **K7. FONT-BITMAP (COLOUR) EMOJI IGNORE `color` — they cannot be made to meet a contrast floor.** The due-date calendar emoji rendered the same mid-grey on all four wallpaper frames, immovable at 2.86:1, because its pixels come from the font's own bitmap. The `U+FE0E` text-presentation selector was tried and **rejected on measurement** (2.86 → 3.37, still not taking colour) rather than shipped with a comment claiming a fix that had not happened. The fix is an inline SVG on `currentColor`, sized in `em` so existing font-size rules keep owning it — the idiom the lock, check and chevron glyphs already use. `eba59f5`.

- **K8. AN ASSERTION AFTER A CLASS CHANGE ON A TRANSITIONING ELEMENT MUST LET THE TRANSITION SETTLE — `getComputedStyle` in the same tick returns the PREVIOUS value.** The task-options pill transitions `opacity`, `color` and `background` over 0.15s. Reading computed style in the same tick as `.focus()` reported it still invisible; reading in the same tick as a tier-class flip reported the light tier not applying. **Both readings were false and the product was correct both times** — but each reads exactly like a real product failure, and one of them impersonates the ink-tier class this repo has already shipped twice (**O1**).

  This is **K5**'s lie in the time dimension rather than the compositing one: the number is real, it is just the number from before. Wait out the declared `transition-duration` (read it, do not guess it) or assert on a `transitionend`, and treat any measurement taken in the same tick as a class change as void. Three of one round's four harness defects were this single trap wearing different clothes. `772f8c3`.
### Section L: Background-Writer Serialization

Run before adding, or writing a harness for, any background (`background.js`) code path that mutates the `data` storage key.

- **L1. Every background writer of `data` must go through the serial queue (`enqueueBgData`).** Each background mutation is its own `getAll → mutate → saveAll` cycle. `Storage.getAll()` returns a **fresh, independent object per call** (a structured-clone snapshot from `chrome.storage.local.get`), and `Storage.saveAll()` writes the **whole blob** — so two cycles that interleave are last-write-wins: the later `saveAll` silently overwrites the earlier task's fields, even when the two touched **disjoint** fields. `chrome.runtime.onStartup` fires several such writers together, un-awaited (session anchor, pro reconcile, recurring sweep, trash purge), and a genuine cold start adds a **fifth from a separate entry point** — the missed daily-sweep alarm (`nextRecurringSweepAt` scheduled the next 03:00, which elapsed while the machine was off, so it fires as a missed alarm just after launch). This is how bug 1216739924148350 shipped: the `[1.0.17]` cold-start session anchor (`sessionAnchorAt := now`, `idleMs := 0`) was written, then a sweep that had read the pre-anchor snapshot wrote its blob back on top, reverting `sessionAnchorAt` to `startedAt` and restoring the pre-shutdown `idleMs`. Fixed in b72b0a6 by funnelling every background `data` writer through one FIFO queue (`enqueueBgData`) so each read sees the prior write; disjoint-field writers then all land regardless of trigger or arrival order. Session snapshots (`savedSessions` key) stay unqueued — a different key cannot clobber `data`. **The rule for new code: if a background path writes the `data` key, it goes through `enqueueBgData`, or it is a latent clobber.**

- **L2. A single in-memory object cannot reveal a multi-writer clobber — the harness must model independent snapshots.** The simulated gates that passed before the bug shipped called `anchorBrowserSession(data)` on **one shared in-memory object** and asserted its fields. A single writer cannot clobber itself, so the race was structurally invisible — the harness could not fail on this class no matter how many assertions it carried. The honest harness loads the **real** `storage.js` in a Node VM against a fake `chrome.storage.local` that (a) **clones on every `get`** (the structured-clone semantics that create the independent snapshots) and (b) **injects latency** into `get`/`set` so the two cycles actually interleave. With that, the un-serialized fan-out (== reverting the fix) reproduces the clobber (`sessionAnchorAt` reverts to `startedAt`) and the serial queue makes the anchor land in **both** arrival orders (anchor-first and missed-alarm-first). Per Section I discipline, prove the guard can fail: reverting to the un-serialized writers must turn it red. A concurrency harness that shares one object across "concurrent" writers is testing nothing.

  Fixture trap that hides inside L2: the anchor's writer no-ops (writes nothing) when there is no active task, and `getActiveTask` / `isTrackingPaused` read **top-level** `data.activeTask` / `data.trackingPaused`, not per-workspace fields. A fixture that nests `activeTask` under a workspace makes `anchorBrowserSession` return false without writing — at which point `sessionAnchorAt === startedAt` holds because the anchor **never ran**, and a "clobber reproduced" assertion passes for the wrong reason. Keep a green control (the serial path genuinely advances the anchor) alongside the red one so a non-writing fixture can't fake the red.

Originating data point: bug 1216739924148350 — the `[1.0.17]` cold-start session anchor silently reverted on a genuine full-shutdown restart. The stored state alone could not distinguish "onStartup fired and was clobbered" from "onStartup never fired"; the fix (b72b0a6) is robust to both because it guarantees the anchor lands whenever onStartup fires, in any ordering. The harness gap (L2) is why the simulated step-12..15 gates went green while a real cold start failed.

- **L3. A WRITE THAT SPANS TWO STORAGE KEYS CANNOT BE ONE ATOM — design the failure semantics across the gap and SAY SO IN THE CODE.** `enqueueBgData` serializes writers of the `data` key and `tracking.js` has its own `opChain`, but the two queues are independent: nothing makes a `data` mutation and a tracking mutation commit or fail together, and no lock can be added that would not deadlock the two chains against each other. Within one key the guarantee is real and is used — `persist(store, days)` writes both tracking keys in a **single** `set()`, so a reader mid-write sees both-old or both-new and never a torn pair, which is why a mid-write export needs no lock. Across keys, the honest target is **stale-never-wrong**: pick the ordering where an interrupted sequence leaves the later key merely behind rather than describing something that did not happen, and state that reasoning in a comment at the write site. The backup round is the worked example — the lifetime accumulator lives on the tracking store precisely so it commits inside the session-close write rather than in a second write that could be interrupted between the two. `46bfed9`, `e2ff2a9`.

- **L4. A ONE-TIME MIGRATION'S WRITE MUST BE CONDITIONED ON THE MARKER READ *BEFORE* THE SWEEP RUNS, or every warmed load performs a backfill write forever.** The stranded-task sweep sets `data.__strandedTaskSweep`, and the first cut then decided whether to write by testing that marker — AFTER the sweep had just set it. True on every subsequent read, so a warmed profile would have written on **every** `getAll`, permanently, while moving nothing. The sweep itself was correct and idempotent; only the write condition was wrong, which is why no behavioural assertion could see it.

  **The BG QUEUE gate caught it when no harness of the round did**, on the row that exists for exactly this: *"a second read of a warmed fixture must write NOTHING; if this ever fails, every write-count assertion below is measuring a backfill."* Two rules follow. **THE STANDING GATES ARE PART OF THE VERIFICATION SURFACE, not a formality run after it** — a round is not verified until they are green, and a gate failing on your change is evidence before it is an inconvenience. And **a marker-guarded migration is tested for its WRITE COUNT on a second load, not only for its effect on the first**: Q5's re-basing rule, in the migration dimension. `53f8a3b` (defect) / `d3c87fd` (fix).
### Section M: Search / Grep Tooling Traps

Run before trusting any grep- or ripgrep-based search or audit over the repository.

- **M1. RESOLVED 2026-08-28 — `tracking.js` greps normally; this entry is kept as history.** The two NUL bytes were escaped to `\u0000` (branch `fix/nul-escape`), so the file is plain text to every reader: **no special handling, no `Select-String` convention, no `rg --text` / `grep -a` for this file.** Search it like any other. The entry is retained because the *class* of trap is real — any file that acquires a NUL goes silently invisible to ripgrep the same way.

  **Original entry ([1.0.18], superseded):** **`tracking.js` is ripgrep-invisible — it embeds NUL bytes, so `rg` classifies it as binary and SILENTLY skips it.** Every tool built on ripgrep (the Grep tool, any `rg`-driven audit sweep) inherits this: a search returns "no matches" with no error, so a grep that never inspected the file reads identically to a grep that inspected it and found nothing — a false negative that looks like a clean result. The NUL bytes are DELIBERATE and correct: `agg.workspaceId + "\0" + id` composite-key separators (~`tracking.js:962`; a space can never appear in a workspace/entity id, so NUL is a safe delimiter). ~~**Do not "fix" them.**~~ *(Reversed 2026-08-28: escaped to `\u0000`, which JavaScript parses to the same one-character NUL — byte-identical at runtime, and it costs the tooling nothing.)* The consequence is tooling-only: search this one file with a NUL-tolerant reader — `Select-String` (PowerShell, the project convention), or `rg --text` / `grep -a`. Any future audit, harness, or refactor sweep that greps the tree for a symbol (e.g. checking the tracking engine for shared state, renaming an export, counting call sites) MUST search `tracking.js` explicitly with such a reader, or it will conclude a symbol is absent when it is present. Surfaced during the [1.0.18] Pomodoro audit, where every globbed `rg` over `tracking.js` returned empty until the file was read byte-wise; two NUL bytes were confirmed at file offsets 41216 and 41951.

  **Amendment (2026-08-28):** the NUL/`rg` rule is **retired**, not amended — the cause is gone. The separator is now the six-character escape `\u0000` in source, which the JS parser turns into the same one-character NUL string, so composite keys are byte-identical and stored data is untouched; only the bytes on disk changed. Verified both ways: BEFORE, `rg` reported `binary file matches` and a tree-wide `rg -l` listed only `newtab.js`, silently omitting the file that *defines* the symbol; AFTER, plain `rg` and `grep` match its four lines and the tree sweep lists it. Runtime identity was asserted through the real rollup spine against a reference key built with a literal one-character NUL, with three seeded wrong separators to prove the assertions can fail.

  **Amendment (2026-08-09, first clause superseded):** the NUL/`rg` rule above stands unchanged and is permanent. The **line-ending** half of the old instruction is retired — `tracking.js` was normalized to pure LF during the `[1.2.1]` round, so the "check the CRLF diffstat before committing this file" step no longer applies to it. `newtab.js`, `newtab.css` and `newtab.html` remain CRLF; the docs are LF. The general trap is unchanged: build multi-line anchors with the line ending the target file actually uses, or the patch silently misses and a whole-file diffstat is the symptom.

- **M2. EXPLANATORY QUOTES OF WRONG RULES ARE GREP TRAPS.** A comment that *quotes a rule* outlives the rule. `newtab.js` carried a note saying not to pass `redirect_url` as a query parameter — true of an earlier Dodo reading, false once the query-parameter mechanism was the documented one, and stated with enough authority that a grep for `redirect_url` returned the wrong answer confidently. A stale *fact* is a nuisance; a stale *rule* actively instructs the next reader. When a decision is reversed, grep for prose that states the old rule, not just for the code that implemented it. (Caught and corrected; the comment now asserts the round trip.)

- **M3. A SHELL HEREDOC CAN WRITE THE CONTROL CHARACTER YOU ARE DOCUMENTING INTO THE DOCUMENT.** Editing BUGS.md to record the `tracking.js` NUL escaping, the escape sequence passed through the heredoc unescaped and wrote **three raw NUL bytes into BUGS.md** — reproducing, inside the ledger entry, the exact defect that entry describes. Caught only by a byte count afterwards. **Any edit whose CONTENT discusses control characters, escapes or encodings is made by a writer that refuses them**: build the escape from `chr(92)` rather than typing a backslash, and assert `chr(0) not in text` before writing. Broader than NUL — a heredoc is a second parser between the author and the file, and its damage is invisible in the diff you meant to make. This entry and the two below it were themselves written through a file-based writer for exactly this reason, after a heredoc refused to parse them.

- **M4. `core.autocrlf=true` MAKES THE WORKING COPY AND THE COMMITTED BLOB DIFFERENT FILES.** A checkout re-materializes `tracking.js` as CRLF while the committed blob stays pure LF, so a replacement anchor typed with an LF newline matches nothing, while an anchor built from the file's own lines injects MIXED endings if its replacement is typed with LF. Both happened in one round. **Detect the ending the target file actually uses and build every multi-line anchor from it**, assert `CR count == LF count` before writing, and check the committed blob afterwards. The diffstat is the tell: whole-file churn on a two-line edit means the endings flipped. Extends M1's 2026-08-09 amendment from "pick the right ending" to "the two copies of this file can disagree at any moment".

- **M5. A GUARD STRING INSIDE A REGEX IS INVISIBLE TO A SWEEP FOR THAT STRING.** `check-pro-celebration.mjs` asserts the store URL twice: once as a literal, once as an escaped regex whose dots and slashes carry backslashes. A plain grep for the host finds the literal and **silently misses the regex**, so a "modernize every occurrence" sweep would have moved one assertion and left the other asserting the dead host. **When sweeping for a string that a gate ASSERTS, search the literal form and the regex-escaped form as two separate searches**, and assert the occurrence count before and after. Same family as M1: a form of the text your search cannot see.

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

- **N3. TWO UNRELATED DISMISSALS MUST NOT RIDE ONE KEY.** A global Escape sweep called `closeSessionsDropdown()` unconditionally while a modal spawned FROM that flyout ran its own Escape handler. Both fired on one press, so a single Escape closed the trash view AND the flyout underneath it, dropping the user to the desktop instead of back where they were. The modal's handler is bound at OPEN time and the sweep at init, so the sweep runs first and the modal cannot defend itself — ordering is not a fix available to the newer surface.

  **Scope the guard to the specific overlay, never a blanket check.** Yielding the whole sweep to `anyPanelOverlayOpen()` would have stranded `#bg-overlay` and the history overlay, which have no Escape handler of their own and are closed BY that sweep two lines above. The shipped guard tests for `.tt-modal-overlay` alone, which is exact rather than approximate: `openTasksModal` appends that element and `closeTasksModal` removes it, so presence IS openness.

  This is the ESCAPE half of the rule the outside-click path already encodes by listing `.tt-modal-overlay` in `PANEL_OVERLAY_SELECTORS` (**E7**, instance 3): **a spawned overlay is not "outside" the panel that spawned it, and it is not deaf to the key that dismisses it either.** The two halves are separate code paths, and fixing one does not fix the other — the click half shipped first and the Escape half survived it. A guard added inside a shared sweep also obliges you to re-prove that sweep's OWN documented behaviour in the same round: `[1.4.1]`'s "Escape is a sweep, an outside click is a peel" (flyout alone closes on one press; row menu plus flyout go together) was re-asserted rather than assumed. `6496cca`.
### Section O: Wallpaper-Panel Ink and Stacking Context

Run when the task added or changed any text, badge, or control that renders inside a panel whose surface darkens under `html.has-bg`, or applied `opacity` to anything containing a control. Companion to **J6** (assert what the cascade produces) and **Section K** (how computed-style harnesses lie).

- **O1. JS-RENDERED PANEL TEXT IS OUTSIDE THE STATIC INK GATE — any round that adds it verifies ink by BROWSER MEASUREMENT.** `tools/check-panel-ink.mjs` parses **static** `newtab.html`. Containers that ship empty and are filled at runtime — `#pro-tags-list` is the worked example — present the gate with zero text nodes, so every row, badge, button and inline note inside them is invisible to it and passes vacuously. That is precisely where the ink bug hid a third time: the "in trash" tag badge declared only `opacity: 0.7` and inherited its colour, i.e. body's `#202124` on the dark frosted panel — the 8902816 class exactly, but JS-rendered, so no gate had ever looked at it.

  **This is doctrine, not a to-do.** The reviewed decision was to **NOT** build a template-string parser for `newtab.js`: a JS-parsing gate would be fragile in exactly the way the ink gate was built to avoid — re-implementing rendering instead of observing it. So the obligation moves to the round: **any round that adds JS-rendered panel text measures its ink in a real browser** using the localhost + `getComputedStyle` recipe in the gate file's header (serve the real `newtab.html` + `newtab.css`, set `html.has-bg`, un-hide the panel, composite the computed colour over the frosted surface). Verify all three branches — dark photo, bright photo, light solid — not just the one you are looking at.

  **Related trap found by the same measurement pass:** `html.has-bg .pro-tag-name` beat `html.bg-light .pro-tag-name` at **equal specificity on source order**, so tag names rendered white-on-white at **1.10:1** on a light solid wallpaper. The order-independent form is the two-class guard `html.has-bg.bg-light` (the idiom the `--sat-accent` block already documents). Measured 1.10 → 14.54. Any new `bg-light` rule uses the two-class form so it cannot regress on source order. `8c76a5e`.

- **O2. Dim TEXT NODES, never a container that holds interactive controls — `opacity` on an ancestor creates a stacking group its children cannot escape.** The archived tag row's `opacity: 0.5` sat on the `<li>`. That is a group opacity: it composites the entire subtree as one layer, and **no child can raise itself back out of it** — not with `opacity: 1`, not with a higher `z-index`. The new **Restore** button, a real interactive control, would have shipped at half strength with no way to override it locally. The fix is to move the dimming onto the specific text nodes that should read as archived (the name and the swatch), leaving the control at a measured effective opacity of 1.

  The general rule: **`opacity` is not "make this text lighter" — it is "flatten this subtree into one translucent layer."** When the intent is de-emphasis, apply it to the leaf text nodes, or use `color` with alpha instead. Reserve container-level `opacity` for subtrees with nothing actionable in them. Code review does not catch this class — the CSS reads as obviously correct; it was found by measuring the button's effective opacity. `8c76a5e`.

- **O3. The MIRROR IMAGE of a68dd89: a LIGHT-surface token used on a surface that is DARK by default.** a68dd89 was dark ink falling through onto a dark frosted card. The inverse ships just as easily: a new label reached for `var(--text-secondary)` — a *light-theme* token, `#5f6368` — on the Pro card, whose default state is the dark frost, and measured **2.73:1**. An earlier draft of the same label sat at 3.66:1 and additionally lost on specificity. The fix in both directions is the same: **re-base the ink on the surface's own family** (the card's white-alpha ramp) and add a single `html.bg-light` override, rather than borrowing a token whose theme assumption is the opposite of the surface's. Neither token name warns you — `--text-secondary` sounds surface-agnostic and is not. `c4f8d83`.

  **Companion rule from the 2026-08-09 ink verdict:** *inheriting* a known-accepted contrast deficit (`.pro-section-subtitle` on light wallpapers — see DECISIONS.md, same date) is a **decision** and is not re-flagged. *Deepening* one — adding opacity or a lighter token on top of it — is a **defect**. Report the first as known-accepted; treat the second as a finding.

- **O4. MEASURED FRAMES MUST BE REACHABLE FRAMES.** The cockpit round reported the greeting's white-on-white at **1.37:1** on the "no wallpaper" frame. The measurement was real and the frame is not: `loadBackground` self-heals a missing background record to `DEFAULT_BG` **and persists it**, and `applyBackground` always adds `has-bg` — so no no-wallpaper state exists after first paint. The fix stands as correct defensive CSS; the *report* was wrong. **An ink table's frame column is a claim about states users can occupy** — enumerate the reachable ones (default dark solid, dark photo, bright photo, light solid) and say which is which. `14ea15f`.

- **O5. ACCENT TOKENS KEY TO THE SURFACE THEY PAINT ON — carry the branch, not the name.** `--sat-accent` is `#1a73e8` in the light theme and flips to `#8ab4f8` the moment a wallpaper sits behind it. The website's old stylesheet claimed `#1a73e8` "matches the extension" — true of a branch the site, which is dark throughout, never renders; on that background it is muddy. **When lifting a token across surfaces, lift the value the DESTINATION would resolve, not the one the source declares first.** O3's sibling: same failure, tokens rather than themes. `ae3b3c5`.

- **O6. A NATIVE FORM CONTROL PAINTS ITSELF FROM `color-scheme`, NOT FROM `color`.** `<input type="date">` renders its own text, calendar indicator and dropdown from the used colour scheme, so a `color` declaration leaves them untouched: on a wallpaper the default light control sits black-on-white against the `rgba(30,30,30,0.85)` frosted panel — measured in the browser before the design was accepted, not assumed. `color-scheme` flips the whole native control at once. **The block mirrors `.seg-btn`'s three-tier structure exactly** — default board light, `html.has-bg` dark, `html.has-bg.bg-light` light again — which is also why the picker carries no per-element ink of its own to keep in sync. Any future native control (`time`, `color`, `select` on some platforms) inherits this entry, and O1 still applies: the board is JS-rendered, so the static ink gate cannot see any of it.

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

- **P6. AN ENVIRONMENT-DEPENDENT TEST MUST PROVE THE ENVIRONMENT TOOK EFFECT.** The DST rows for `rangeLocalDayKeys` passed on the first run and meant nothing: this host is a no-DST zone, so "no day skipped across a transition" is vacuously true. Worse, the fix LOOKED like it worked — injecting `TZ` through the shell **silently drops crossing into Node on this platform** (`process.env.TZ` reads `undefined`), so every zone reported itself as no-DST and the matrix came back uniformly green. Setting a real process environment variable worked, and the suite then ran under five genuine DST zones including Lord Howe's 30-minute shift. **Read the environment back and require it to have changed — compare a January and a July offset — before scoring any row that depends on it.** P2's vacuity rule in the environment dimension: a test whose precondition silently failed to apply is a test of nothing.

- **P7. EVERY INSTRUMENT'S NULL RESULT MEANS "NOTHING WHERE I LOOKED", NEVER "NOTHING".** Three instances inside one migration, each discovered by the next instrument along:

  1. the **site gate's** backlog count read as completeness, and the pseudo-locale probe found **81 ungoverned strings it could not see** — the gate finds strings by construction site, and a sentence concatenated into markup whose tags live in neighbouring literals matches no pattern at all;
  2. the **probe** then read as completeness, and the static scan found a population of **~350 against the probe's 65** — the probe walks ten surfaces of a fresh profile at rest, so it sees the empty case of everything and the populated case of nothing;
  3. the **static scan itself** first rejected **1,670 literals for containing markup**, in a codebase where prose lives inside markup literals, which hid most of the first-run surface.

  Each number was true and each was read as a claim about the product when it was a claim about the instrument. **A finish line must state its own coverage alongside its number** — "zero across these enumerated states", never "zero". The countermeasure adopted for R5 is a reconciliation that runs two instruments and **fails on disagreement**: a string one calls ungoverned and the other calls migrated is a defect in the second, and a string the gate reports that the probe cannot reach is a missing fixture. `[1.5.0]` R3 through R5 scoping.

- **P8. WHEN A PRODUCER AND ITS CHECKER SHARE A PARSER, A PARSER DEFECT WRITES THE BUG AND HIDES IT IN ONE MOVE.** `TAG_RE`'s attribute group was greedy over `[^>"']`, which matches `/`, so the trailing slash of a self-closing tag was swallowed and the self-closing capture group was **always empty**. The extractor's container walk therefore stopped at `<path>` instead of stepping over it to the button, and wrote twelve `data-i18n` markers onto SVG shapes that can never render text. The gate then walked the same way, found the marker on the same wrong element, and reported all twelve as migrated. Nothing threw; twelve context-menu labels were simply English in every locale, permanently.

  This is **Q13's** family arriving from the other direction: there, a hand-built fixture agreed with the code because both were wrong the same way; here, a checker agreed with a producer because both parse with the same broken regex. **When a check and the thing it checks share a parser, they cannot disagree, and a check that cannot disagree is not a check.** The fix ran in both places at once — the regex made lazy, plus a NEW unconditional rule that a marker on an element which cannot render a text child is a defect. `1e5ff29`.

- **P9. A CHECK WHOSE FINDING IS A DEFECT FAILS UNCONDITIONALLY; ONLY A CHECK WHOSE FINDING IS A KNOWN BACKLOG ITEM MAY SIT BEHIND AN ENFORCEMENT FLAG.** The i18n gate carried an `ENFORCING` flag so it could be added before the migration finished — correct for "this string has not moved yet", which is a counted, expected, shrinking backlog. **Sink misuse was filed with that backlog and therefore silenced**: a bare `t()` spliced into a markup string is a defect in code that has ALREADY been converted, nothing is waiting on a future round, and it is the injection direction that fails silently. It was also being counted INSIDE the "N strings await migration" figure, so a defect was inflating a backlog number the round was reconciling against.

  The rule is now a comment block above the gate's exits, so the next person choosing where to put a check reads it before choosing, with the audit of every existing check against it recorded beneath. Three later checks were placed by it without argument: the misplaced marker (P8), the module-level frozen call (**D20**), and the em dash in prose (**P11**). `06f895c`, `1e5ff29`.

- **P10. A GATE'S EXCLUSIONS ARE WHERE ITS BLIND SPOTS LIVE.** Three in one gate, each a single line, each invisible in a green run:

  - a **blanket single-token exclusion** written to skip identifiers swallowed **83 real labels** including Cancel, Delete, Done and Edit — the most common strings in the product, in a gate written to find hardcoded strings. Caught only by cross-checking against an independent recon count (485 to 719 against ~749);
  - an **`/i` flag** on the CSS-declaration exclusion made it match real sentences, swallowing "Tip: Use LaunchPad's...";
  - an **`argGroup` pointing at an empty capture group** meant every `setAttribute` site read `""` and scored neutral. The pattern found its sites and then read nothing from them, reporting "11 sites, 0 hardcoded" for two rounds. Five real violations were invisible.

  An exclusion is the one part of a gate that removes evidence, and it is never exercised by a passing run. **Every exclusion ships with a case it must NOT swallow, asserted** — the same shape as P2's floor, applied to the filter rather than to the set. `d51e38e`, `844e322`.

- **P11. A RULE ENFORCED ONLY WHERE VALUES LAND, RATHER THAN WHERE THEY ARE WRITTEN, HOLDS GREEN WHILE VIOLATIONS ACCUMULATE UPSTREAM.** The em-dash ban inspected catalogue values. It passed across 586 messages for four rounds while **28 em dashes sat in source waiting to migrate in**, and one had already arrived as the literal `&mdash;`, which the character-based check could not see at all. The rule was true of everything it governed and governed the wrong end of the pipeline.

  Moved to where copy is WRITTEN, with two named exemptions rather than a softened rule: a literal whose entire text is dashes (a separator between two values, or a no-value glyph), and a `console.*` argument. **Ask of any content rule: does it run at the point of authorship, or only at the point of arrival?** `8a93008`.

- **P12. A FALLBACK THAT RENDERS IDENTICALLY TO SUCCESS MAKES SUCCESS UNVERIFIABLE BY RENDERING.** `setText` looks for a child text node and, finding none, appends one. On a `<path>` that append succeeds, produces no error, and renders nothing, because SVG shapes do not draw text children. So the failing case and the working case were pixel-identical, and R2's byte-identical verification — which proves the rendering did not CHANGE — passed on twelve no-ops. **A no-op changes nothing, so a no-op satisfies any check phrased as "nothing changed".**

  The assertion has to be POSITIVE and about the mechanism: not "the page still looks right" but "this specific control's own text became the value the catalogue holds". Under a pseudo-locale that answer flipped from 0-of-12 to 12-of-12. Pairs with **P7**: byte-identical was a true statement about a comparison that could not distinguish the two outcomes. `1e5ff29`.

- **P13. ABSENCE PROVES NOTHING WHEN THE POPULATION MIGHT BE EMPTY FOR THE WRONG REASON — a check reporting "0 of 0" is a vacuous pass.** After moving the twelve markers, the natural check was "no `data-i18n` sits on an SVG shape any more", and it reported `0 of 0 controls keep their English label`. Both halves were true and the sentence proved nothing: the query found no shapes to inspect, which is exactly what a gate reports when its selector has gone stale.

  Replaced with a **positive per-item assertion** — each of the twelve keys named, each control's own text asserted to have moved — plus a **negative control**, an unmarked control that must NOT move. P2 is this rule for a gate's discovered set; this is the same failure inside a single round's verification, where there is no floor to protect you. `1e5ff29`.

- **P14. A COUNT THAT DROPS BECAUSE SITES CEASE TO EXIST IS NOT THE SAME AS ONE THAT DROPS BECAUSE SITES BECAME COMPLIANT, and floors calibrated on today's counts hard-fail as the work succeeds.** Markup patterns ERODE as they migrate and text patterns do not: a `>Delete<` text run stops being an `html-text` site once its words move behind a marker, whereas a `showToast(...)` site persists and merely flips from violation to compliant. R4 stage 1b made this vivid by converting `label: t("k")` array entries to `labelKey: "k"` — a key reference is not a construction site, so **40 sites vanished from the gate's view for an entirely correct reason**, `modal-copy` fell 189 to 149 and the total 605 to 565, tripping the site floor and reporting the gate BROKEN mid-success.

  Floors track the RESIDUE — what should survive a completed migration — never today's total, and the reason is recorded beside the number, because forty sites disappearing is exactly the shape of an accident and must not read as one. `d51e38e` set the pattern floors this way from the start for the markup patterns; `5d5b998` moved them again and said why.

- **P15. A CHECKER THAT DERIVES ITS EXPECTATIONS FROM THE SAME SOURCE THE PRODUCER READS CANNOT DETECT THAT SOURCE GOING WRONG — this is P8 one level up, and it survives a perfect parser.** P8 is a shared PARSER: two readers with the same broken regex agree on the same wrong elements. This is a shared SOURCE: both readers may parse flawlessly and still agree, because the checker's expectation shrinks in lockstep with the defect. The coupling is in WHAT is consulted, not in HOW it is read, so no amount of care in the extractor removes it.

  The worked example is the package gate's own repair. It had missed shipped files twice in one day: `privacy-policy.html`, which ships and is referenced by nothing so no walk could reach it; and `locales/en.js` / `i18n-dom.js`, which were absent from the expected table **because their `<script src>` tags had been dropped**, so the table's silence was the only symptom. The obvious fix — derive the expected set by parsing the HTML — would have caught the first and **passed the second**: it would have derived a smaller set, matched the zip exactly, and reported a clean build on an artifact missing load-bearing code.

  **THE FIX IS A SECOND SOURCE THAT DOES NOT MOVE WHEN THE FIRST ONE DOES, AND THE VALUE IS IN THE DISAGREEMENT RATHER THAN IN THE DERIVATION.** `build.sh`'s shipping allowlist still contains `locales` when a script tag is deleted, so *allowlisted but referenced by nothing* is the direction that speaks. Choosing a genuinely independent second source is the whole design problem: a source derived from the first is decoration. The gate now reconciles three (references, allowlist, zip) and **reads the allowlist out of `build.sh` at run time rather than copying it**, because a copy would be a second hand-maintained table and would re-couple what was just separated.

  **THE RESIDUE IS NAMED RATHER THAN HIDDEN.** Some files legitimately ship unreferenced, so an expected-unreferenced list is unavoidable — the class reappears one level up, in a better place. Every entry carries a REASON STRING, the gate PRINTS the reason when it uses one, and an entry without a reason fails the gate. That makes adding a file a decision someone justifies in writing rather than a reflex that silences a warning. `edc3b13`, Asana 1217989152996164.

- **P16. OVER-SPECIFICATION IN A NEGATIVE ASSERTION CANNOT FAIL LOUDLY; IT CAN ONLY PASS SILENTLY — so the instinct that serves a positive assertion inverts.** A positive assertion that asserts more than it means produces false FAILURES: noisy, attributable, and fixed the week they appear. A negative assertion that asserts more than it means produces false PASSES, which announce themselves never. The same excess specificity is self-correcting in one direction and permanent in the other. **A NEGATIVE ASSERTION MUST THEREFORE BE WRITTEN AS LOOSE AS ITS MEANING PERMITS**, which is the opposite of the care a positive one deserves.

  The worked example, with its measurement, because the measurement is what makes this a finding rather than a plausible claim. `check-chip-ink` forbids a colour-emoji due icon — emoji pixels come from the font's own bitmap and ignore `color` on every frame, measured at 2.86:1 and immovable, which is why an inline SVG on `currentColor` replaced it. The guard was written as ``!/tt-due-icon" aria-hidden="true">CALENDAR-EMOJI/``, pinning **one codepoint and one attribute order**. Measured 2026-09-01, against a tree where the emoji had been reinstated with its attributes reordered: **the OLD assertion PASSED and the NEW one caught it.** The defect the line exists to forbid was reinstatable, in more than one ordinary way, while the gate stayed green forever. Now `!/tt-due-icon[^>]*>\s*['"]?\s*\p{Extended_Pictographic}/u` — attribute-order tolerant, every pictographic codepoint. `1bcd949`, Asana 1217989152996164.

  **DISTINGUISH IT FROM ITS NEIGHBOURS, because the value is in not collapsing them.** **P12** is a fallback that renders identically to success. **P13** is a vacuous pass over an empty population. Both are *a check reporting success on ABSENCE* — nothing was there to see. This is different in kind: the population is present, the check ran, and it reported success **because it was asked too specific a question in the direction where specificity subtracts coverage**. P12 and P13 are answered by making the assertion positive and counting the population; this one is answered by making the assertion broader.

  **THE UNRESOLVED CASE, recorded rather than decided.** The 2026-09-01 audit also ruled that exact `class="x"` equality is APPROPRIATE and must not be loosened, because "verbatim, no new markup surface" is genuinely the meaning. That ruling was reasoned about POSITIVE assertions. At least two instances are NEGATIVE — `!/class="dash-card"/` (check-today-cockpit) and `!/class="sat-time"/` (check-pill-clarity) — where the two rulings pull opposite ways: renaming the class, or adding a second one, would satisfy the prohibition without removing the thing prohibited. Neither was changed, because that round forbade assertion changes. **Whoever opens this next should decide those two rather than assume the group ruling covers them.**

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

- **Q10. A TIME-based fixture must cross the boundary it claims to test — Q8's tie, in the time dimension.** The `[2.0]` clock-edge seeds ("this surface re-reads the clock instead of taking the paint's read") both **ESCAPED** on the first run. The subject was pinned at an activation stamp of a whole second and stepped forward 999ms, so the re-read landed inside the *same displayed second* and printed the identical string a sharing surface would — two different behaviours, one output, exactly Q8's ambiguity with `Date.now()` in place of a sort key. Offsetting the stamp by 6500ms makes the same 999ms step cross a real boundary (`0:06` → `0:07`) and both seeds die. **A formatter that truncates (`M:SS`, day keys, `fmtDurationHM`) swallows any step smaller than its own resolution; size the step against what the string can actually show, not against the raw millisecond arithmetic.** `[2.0]`, this round.

- **Q11. A SEED IN UNREACHABLE DEFENCE-IN-DEPTH IS AN EQUIVALENT MUTANT — it scores nothing and proves nothing.** The obvious seed on the blocked-count reader flipped a `typeof` guard that `ensureFocusStats` has *already* normalised every input past: no fixture can distinguish the two versions, so the mutant is behaviourally identical to the original and its "escape" measures nothing about the suite. Replaced with one that actually changes behaviour. **Before scoring a seed, ask what INPUT distinguishes the mutant from the original; if none exists, the seed is invalid, not the suite.** `5d7a1ec`.

- **Q12. SEED THE MUTANT INTO A COPY BUILT FROM COMMITTED STATE, NEVER INTO THE WORKING TREE.** Restoring a seeded revert with `git checkout -- <file>` while the real change was still UNCOMMITTED reverted the change as well as the seed — the negative control silently destroyed the work it was validating, and only a follow-up sweep reporting zero occurrences of the new string caught it. **Commit the real change first, then build every mutant from `git show HEAD:<file>` into a scratch copy** and point the harness at it by parameter. The working tree is then verifiably unmodified for the whole exercise, which is itself worth asserting and printing. Companion to Q1: the clean run must pass before a mutant is scored, and it must still EXIST afterwards.

- **Q13. FIXTURES ARE BUILT IN THE PRODUCT'S OWN SHAPE, DERIVED FROM ITS CONSTRUCTORS AND FACTORIES WHERE THEY EXIST — NEVER HAND-TYPED.** A hand-shaped fixture can encode the same wrong assumption as the code under test, and then **the test agrees with the code because both are wrong the same way**. The worked example cost a round: `[2.1]`'s backfill read `agg.dayKey` while `emptyDay()` names the field `agg.day`, so the read was permanently `undefined` and the since-anchor fell back to `Date.now()` — a bug that would have claimed "focused since today" over months of real history. **The console harness was green**, because the fixture had been hand-written with a `dayKey` field too. Seeding through `emptyDay()` makes the mutant that restores the wrong read go red immediately. This is **I12** (seed through the real creation API) promoted from a rendering concern to a correctness one: I12 says a hand-built record does not *paint*, and Q13 says a hand-built record does not *disagree with the code*, which is worse, because the first fails loudly and the second passes. **Where no factory exists, derive the fixture from the shape the product actually persists** and assert one field name against the producer rather than against your memory of it. `e2ff2a9`.

- **Q14. WHEN A CORRECTNESS CALL IS DEFENSIVE RATHER THAN CURRENTLY REACHABLE, ASSERT ITS REGISTRATION, NOT ITS BEHAVIOUR.** `completeGoal` has two paths, and path 2 (the auto-complete branch inside `completeTask`) fires only when every live sibling is already complete — so it can never have an unfinished task to release. It calls the release ANYWAY, deliberately: the rule belongs to "a goal became completed", not to one caller's reasoning about who is left, so the day that `allComplete` condition loosens, the release travels with it instead of being the line somebody forgets.

  **A behavioural mutant on that call comes back GREEN**, because deleting an unreachable release changes no observable outcome. It is **Q11**'s equivalent mutant arriving by a different road, and scoring it as "escaped" would report a coverage gap that does not exist. The harness reads the source and asserts the release call appears inside the auto-complete branch. This is **I8** (prove unexercisable wiring structurally) promoted from an environment limit to a design one: I8's wiring cannot be reached by the HARNESS, and this wiring cannot be reached by the PRODUCT yet. Both take the same answer. `53f8a3b`.

- **Q15. ADDRESS ROWS BY ID, NEVER BY VISIBLE NAME, WHEN A FIXTURE DELIBERATELY CONTAINS DUPLICATES.** A name-collision test needs two tasks called "Clashing", and "hover the first row called Clashing" then picks whichever one DOM order hands you — which is not the one the assertion means. Every row lookup goes through the entity id. The same round's companion: **prove with `document.elementFromPoint` that a click reaches its target when a fixed bottom bar can cover the lowest row.** The lowest visible row's pill sat under the bar, the click hit the bar, and the menu that never opened read as a dead control. That is **Q9** with a named cause, and the fixed bar is worth naming because it is invisible in the element's own rect. `772f8c3`.

- **Q16. A FIXTURE MUST NOT ANCHOR TO TIME OF DAY — a gate that depends on the wall clock is red at night and green at standup, and its history reads as flaky when it is perfectly deterministic.** The SINCE FORMAT gate seeded an activation seven days ago **at 09:04** and asserted the literal `"7d"`. Elapsed time from a fixed time of day only reads "7d something" once the current local time passes 09:04, so the same entirely correct output read `"Active 6d 20h"` before mid-morning. **That gate had been failing for roughly nine hours out of every twenty-four, on every commit, and going green again by itself.** It was found only because a round happened to run at 05:00.

  Two rules. **Assert the FORM, not the number** (`\d+d`, not `7d`) when the number is a function of when the suite ran — de-timed, not weakened, and proven so: removing the day-form branch makes the same row report `"Active 165:01:14"`, the three-digit hour count that row exists to forbid. And **a gate that fails intermittently is diagnosed before it is re-run** — "it passed the second time" is how a real clock dependency survives for months. Q10 says a time fixture must CROSS the boundary it tests; this says it must not depend on when you happen to be standing. `da15714`.

- **Q17. A MUTANT THAT REMOVES ONE OF N REFERENCES DOES NOT TEST AN ABSENCE CHECK, and it passes for a reason that has nothing to do with the gate being wrong.** The package-gate round specified its acceptance mutant as "delete a `<script src>` line from `newtab.html`", reproducing the incident where a dropped tag left `locales/en.js` shipping unreferenced. Run literally, **the mutant PASSED** — and the gate was correct to pass it. `locales/en.js` is also referenced by `gate.html`, so deleting one of its two references left it referenced, no source disagreed, and there was nothing to report.

  **The check under test was "referenced by NOTHING", and the mutant only ever produced "referenced by one fewer thing".** Before trusting a mutant that works by removal, count how many things reference the target: for an absence check the count must be exactly one, or every reference must be removed. Re-run against both pages, the gate failed correctly; re-run against a sole-reference file (`bookmarks.js`), it failed correctly on a single edit.

  **The residual limitation this exposed is worth more than the mutant.** The gate detects a file that nothing references; it CANNOT detect a page losing a script it individually needs while another page still references that file. Deleting `locales/en.js` from `newtab.html` alone breaks the new-tab page and this gate stays green, by construction.

  **THAT IS A DIVISION OF LABOUR, NOT A GAP, and it must be read as one.** The per-page case is covered by a DIFFERENT INSTRUMENT: the **packaged-build smoke** (**B1**) loads the artifact in a scratch profile and asserts a clean console, and a page missing a script it needs does not fail quietly at runtime — `t()` or the `i18n-dom` pass goes undefined and the console fills. That check ran green for 2.1.0. So: **the package gate catches files that ship unreferenced; the packaged-build smoke catches pages missing scripts they need; neither covers the other, and the pair covers the class.** Recorded explicitly so nobody builds a second static check for something a runtime check already owns — P7 applied honestly, which is to state what the instrument does not see AND where that coverage actually lives. `edc3b13`, Asana 1217989152996164.

### Section R: Panel Layout, Scroll Containment and Reserved Space

Run when the task adds content to a tab panel, changes a panel's height/overflow chain, or reserves space for a message that appears and disappears.

- **R1. A tab panel's content has NO scroll path unless the panel provides one — `#content` is `height:100vh; overflow:hidden` and `html`/`body` are `height:100%`.** Nothing above a `.tab-panel` can scroll, so a panel child taller than the viewport is simply **clipped**: no wheel, no keyboard, no scrollbar, no way to reach the rest of it. Measured on the live Insights board, `.insights-tab` was 1421px inside a 676px panel with 745px unreachable and the wheel moving `scrollTop` 0 → 0 on **every element in the document**. Adding a fourth board module did not create this; it made an existing trap tall enough to hit.

  It was shared and had been solved three times privately — `#shortcut-grid-area`, `.tasks-body` and `.pro-preview-content` each own an inner scroller — while `.insights-tab` and `.dash-tab` did not (inflating the Dashboard past the viewport proved it clips identically, latent only behind shorter content). **The fix belongs on the shared `.tab-panel` root**, which is what stops the next panel's content from inheriting it a fourth time; it is inert for the three surfaces that already scroll, because their roots are `flex:1 + min-height:0` (or are scroll containers, whose automatic minimum size is 0) and so size exactly to the panel. **Bottom clearance goes on the board roots, not the panel** — a `padding-bottom` on the shared panel would shrink Home's grid scroller by the same amount.

  **Keyboard needs more than `overflow`.** A `div` is not a keyboard scroll target unless it holds focus, and after a tab switch focus sits on the tab **button**, outside the panel — PageDown moved nothing on **any** of the four tabs, including the two with working scrollers. Hence `tabindex="-1"` on the panels plus a focus call on Pro-tab switch, with Home excluded because its search input owns focus by design. **Known limit, banked:** the Tasks tab still has no keyboard scrolling, because its scroller is a *descendant* of the focused panel and is recreated on every render — fixing it needs focus restoration inside the render path, which would blur inline rename inputs. `12a7fb4`.

  Cross-check **N1** whenever a surface becomes newly scrollable: capture-phase scroll-close handlers will now fire from it.

- **R2. A "reserve the space so the layout doesn't jump" pattern cannot be built on `.hidden`.** `.hidden` is `display: none !important`; a `visibility: hidden` rule intended to keep the box measured therefore loses, the element measures **0px**, and the layout shifts by the full row height anyway — which looks exactly like the reserve rule not being applied. The instinct to answer an `!important` with a second `!important` is the wrong move: give the element its own state class (`.is-quiet`) that means "present but silent" and keep it out of `.hidden` entirely. **And measure the box** — `getBoundingClientRect().height`, not "the CSS looks right"; the failure is invisible in the cascade and obvious in one measurement. `1942096`.

---

### Section S: Production-Edge and Static-Site Traps

Run for any change to the website repo, to anything a CDN serves, or to a page that receives sensitive query parameters. These are the traps that live between the repo and what the user's browser actually loads — every other section in this file is extension-side, and none of them can see these.

- **S1. EDGE INJECTIONS BYPASS REPO-LEVEL AUDITS — privacy-posture audits run against PRODUCTION.** The site's off-origin gate was green in the repo and on a local serve, while the live site loaded `https://static.cloudflareinsights.com/beacon.min.js`: Cloudflare Web Analytics auto-injects its beacon at the edge for browser user-agents. It is not in git — `curl` with a plain UA does not get it, `curl` with a Chrome UA does. It made the landing page **factually wrong** (that page promises "no Cloudflare Insights, no beacon of any kind"), and the checkout-return README rule — *anything that reads `location` must load after the scrub or exclude the route* — cannot bind a script that never passes through the repo. **A claim about what a page loads is a claim about the deployment, and can only be verified there.** `eb2b95d`.

- **S2. NAVIGATION TIMING RETAINS THE PRE-SCRUB URL — `replaceState` does not reach it.** `/checkout-return` scrubs its query string in a head-time script, so `location.href` is clean before body parse. But `performance.getEntriesByType('navigation')[0].name` **still returns the full original URL including `?license_key=…&email=…`** — verified empirically: the visible URL read `checkout-return.html` while the navigation entry read `checkout-return.html?status=processing`. RUM beacons routinely read Navigation Timing. Recorded as a **confirmed exposure path, not a confirmed leak** (transmission was never proven), and closed at the root by disabling the beacon. **The scrub's protection boundary is `location` and history — not the performance timeline.**

- **S3. `og:image` MUST BE ABSOLUTE.** `/og-image.png` is a valid URL to a browser and unresolvable to Facebook, Slack and LinkedIn — so every share renders bare **even once the file exists**. The failure is invisible from the site itself and would have silently wasted a launch runway's worth of shares. Same class as any scraper-facing metadata: it is consumed by a client with no page context. Also worth knowing: `/404` deliberately carries **no `og:url`** — the URL that lands there varies by definition, so asserting one would be a lie. `eb2b95d`.

---

## Known Limitations

Accepted bugs and constraints we're not planning to fix. Format: date, area, description, reasoning.

### 2026-09-01 — Build tooling — the push-state check offers NO protection offline, and UNKNOWN cannot be distinguished from badly ahead

**Area:** `build.sh` push-state block (Asana 1218039022445037)
**Description:** The check reports IN SYNC only when a fetch actually succeeded, which is deliberate: `origin/master` is a local ref, and comparing against it without fetching would report IN SYNC from stale data. The consequence is that **every offline build reports UNKNOWN**, and UNKNOWN is indistinguishable from "you are 83 commits ahead" — which is the exact state the check was written to catch. So the protection is present only when the network is, and a build on a plane gets none of it.
**Reasoning:** Accepted rather than fixed, because the alternatives are worse. Falling back to the local ref when the fetch fails reintroduces the confident-wrong-answer failure this block exists to prevent. Refusing to build on UNKNOWN turns a warning into the hard guard the PLAN rejected, for the reason recorded in CLAUDE.md: a guard that fires on a plane teaches the habit of overriding `build.sh`, and that habit costs more than this check is worth.
**Status:** Accepted. The compensating control is the session-start checklist line in CLAUDE.md, which asks for the ahead-by count at the start of a session rather than at build time — a different moment, usually online, and it is where the 83-commit gap should have been caught.

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
