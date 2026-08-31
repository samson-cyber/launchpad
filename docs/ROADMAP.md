# LaunchPad — Roadmap

Living document. Updated when scope decisions change. Append-only for the historical record; move items between sections as scope evolves.

---

## Shipped: Free Tier (v1.0.4 and earlier)

The free LaunchPad Chrome extension, live on the Chrome Web Store.

- Unlimited shortcuts with groups
- Drag-and-drop reordering (shortcuts and groups)
- Group collapse / inline rename / open-all
- Right-click "Add to LaunchPad" context menu
- Chrome bookmarks import
- Wallpaper system: Unsplash gallery, uploads, URL paste, solid color backgrounds (6 presets with luminance-aware text styling)
- Browsing history panel (grouped, searchable, date-filtered)
- Session restore (auto-saves tabs every 5 min)
- Settings panel with icon size, wallpaper, bookmarks import, about
- Search bar using Chrome Search API (respects user's default search engine)
- Nested shortcut variants (click-triggered dropdown showing sub-shortcuts under a parent icon)
- First-run example content on fresh install — a seeded, obviously-example grid plus permanent Import and Tips sidebar entries ([1.0.19], replaced the three-step onboarding wizard)
- **Backup / export / import** (JSON envelope format with recovery backup on import) — shipped v1.0.4
- Promo toast system (Rate at 3rd open, then every 40 opens). The Coffee leg and the sidebar Buy Me a Coffee entry were **retired at 2.0.0** — see DECISIONS.md 2026-08-14.

---

## v2.0.0 — SHIPPED 2026-08-14 (the Pro launch)

**Corrected twice, and the second correction reversed the first.** On 2026-08-30 this section was
rewritten to say v2.0.0 had never been uploaded. **That was wrong**, inherited from a CLAUDE.md block
that had generalised the *2.0.1* deferral backwards onto 2.0.0. Two independent facts settle it: the
annotated **`v2.0.0` tag on `92eeb68`** reads "submitted to the Chrome Web Store 2026-08-14", and a
store-installed **`2.0.0_0`** build sits in the local browser profiles under the store extension id.

**v2.0.0 is live and users are on it. It is the store baseline for 2.1.0**, which is what any
permission diff must be taken against.

**v2.0.1 was built, fully gated, and never submitted** — deferred by Samson on 2026-08-29 so its four
items would ride inside a larger update rather than spend a review cycle days after 2.0.0 reached
users. That update is **2.1.0** (see below). Its artifact was retired; sha256, byte counts and gate
tables live in Asana 1217318434594388 and 1217967430924095, and each build is reproducible from its
commit (`92eeb68` and `23a250f`). **There is no `v2.0.1` tag, correctly**, and that absence is itself
the evidence that it was never submitted.

*It first ended at `3c719d6` on 2026-08-13. Three rounds have reopened it for exactly one commit each: the Buy Me a Coffee retirement (a product-surface decision), the closed-browser-time fix (a pre-submission defect found in lived use), and the per-task worked clock (a feature Samson specified on 2026-08-14). The artifact identity and the tag target moved with each.*

- **The 2.0.0 artifact was `launchpad-2.0.0-92eeb68.zip`** — sha256 `2bffe33c14e4e562344841e4c973ae78b70068c47eeada1653453521339a9093`, 619,610 bytes. **This is the build that was uploaded and approved.** Deleted from disk after upload per the no-candidate-zip rule; reproducible from `92eeb68`.
- **Thirteen build gates green** — twelve source suites (`panel-ink`, `focus-decision`, `insights-readers`, `since-format`, `trial-copy`, `license-line`, `pro-celebration`, `chip-ink`, `today-cockpit`, `text-size`, `pill-clarity`, `bg-queue`) plus the package gate (23/23 manifest-declared and referenced files resolve with exact forward-slash entry names).
- **SHIPPED means v2.0.0.** The manifest now reads `2.0.1` and *that* bump is unreleased. **A manifest bump is not evidence that a release occurred** — see CLAUDE.md, which is the source of truth for release state, cross-checked against the annotated tags.
- **`v2.0.0` is tagged on `92eeb68`**, annotated, applied at submission per the rule. **No `v2.0.1` tag exists and none should**, since it was never submitted.

### Artifact-stamping discipline (standing practice)

Adopted during the launch run and it holds from here on. Every build that leaves the working tree is **stamped**: `launchpad-<version>-<shorthash>.zip`, published with its **sha256 and byte count** in the task comment, and the **previous stamped zip is deleted from the repo directory in the same step**. The rule exists because QA phases ran across days and multiple rebuilds: an unstamped `launchpad.zip` cannot tell you which build it is, and a superseded zip left on disk will eventually be the one someone uploads. *If the zip you are testing does not hash to the published value, it is not that build.*

### Fast-follow queue — cleared into 2.1.0 (updated 2026-08-30)

- **`[1.2.2]` date-range selector** for Insights (1217301997679347) — **SHIPPED**, presets plus custom calendar.
- **Refusal toast** (1217317549419902) — **SHIPPED**.
- **Lifetime totals** (1217404571388348) — **SHIPPED** as `[2.1]`.
- **Notes `[1.1.0]`–`[1.1.4]`** — **SHIPPED**, plus follow-ups through `[1.1.7]`. The 2.1.0 headline.
- **`[1.3.0]` Backup & Restore** — **SHIPPED**, both rounds.
- **Variant disambiguation** (1217948890038248) — **SHIPPED**, promoted from candidate.
- **Harness-rescue remainder** — the priority pair shipped pre-launch; the rest is opportunistic. Still open.
- **Website meta-description trim.** Still open.
- **Named sessions `[1.4.0]`–`[1.4.4]`** — **SHIPPED** 2026-08-31, promoted from candidate to scoped arc inside 2.1.0. See its own section below.
- **Task options pill, goal-completion fix, modal-footer tidy** — **SHIPPED** 2026-08-31, all out of the same week. See below.

---

## In Progress: Pro v1 (target 10 weeks)

Paid tier. Pricing: **$4.99/mo or $39/year** (annual ~$3.25/mo). See `SPECS/pro-value-proposition.md` for positioning.

### Pro v1 scope (committed)

#### Foundation
- Workspaces: generic user-managed containers (free = 1 "Main" workspace, Pro = unlimited). Switcher, add/rename/reorder/delete from Pro Settings.
- Pro settings panel (separate from free Settings)
- Pro upgrade flow via Dodo Payments (KYC + Live Mode verified 2026-05-15; see `docs/DECISIONS.md` 2026-04-24)
- License key system (local verification + server-side abuse check)

#### Task / Goal System
- Goals: create, edit, delete. Scoped to today / this week / this month
- Tasks under goals: simple checklist
- Tags: create, assign to tasks, assign to bookmarks
- Active task picker (small widget on main grid)
- Recurring tasks: template model + instance generation (templates CRUD shipped in [1.0.10]; generation in [1.0.14])
- **Task completion = the dopamine moment** — deliberate animation + subtle sound (opt-in)

#### Focus Sessions, Blocking, Time-by-Site (the v2.0 launch trio) — **COMPLETE 2026-08-09**

Locked 2026-07-22 (v2.0 design lock, Asana 1214260527650518). Privacy posture absolute: nothing leaves the machine, zero new install-warning permissions — `optional_permissions` requested at runtime on explicit opt-in only.

- **Focus sessions** (`[1.0.18]`) — **COMPLETE 2026-08-08.** Attached to the active task (no task, no timer); sticky point-of-use duration chips; auto-break with work never self-starting; graceful expiry with grace-uniform honesty; pause integration; desktop notifications via runtime-requested optional permission; three synthesized local chimes with offscreen playback. Rounds A1/A2 `b141d3a`/`29bbb07`, E `1627003`, B-1 `65711b6`, B-2 `a7cf131`. See DECISIONS.md 2026-07-22 (naming/duration, session semantics) and 2026-08-02 (notifications fork).
- **Focus Blocking** (`[1.2.0]`) — **COMPLETE 2026-08-09.** Gentle gate page (blocked host, focused-time-on-task, snooze + end focus), manual arm plus auto-arm during focus work phases, global block list in Pro Settings, hard-coded never-block list for checkout/licensing, capture-first block/snooze counters, pill Focus toggle and armed indicator. Interception is **`webNavigation.onBeforeNavigate`**, not the tabs API: the tabs hook fires post-commit and the blocked page flashes. `declarativeNetRequest` rejected on three independent blockers. Rounds R1 `b6fa2b6`, R2, R2.5 `f750170`, R3 `c4f8d83`. See DECISIONS.md 2026-08-09 (shipped entry + the F2 amendment).
- **Time-by-Site** (`[1.2.1]`) — **COMPLETE 2026-08-09.** `byDomainForScope` reader on the shared rollup spine plus one Insights card; raw hostnames as measured, **no favicons ever** (browsing-domain rows must not be sent to an icon service), zero new CSS. `1e19b5d`; both board lists aligned at 6 rows in `12a7fb4`.

#### Pro launch prep — done, except the upload itself (updated 2026-08-30)

The trio is done and so is the release mechanics list below; what remains is the **2.1.0** submission,
which Asana 1217967430924095 owns end to end.

- ~~**Manifest version bump to `2.0.0`**~~ — **DONE**, and since moved to `2.0.1`. The next submission
  picks its own number (2.1.0), applied at that point. The `2.x` = Pro era separation from the
  `[1.x.y]` marker track holds. See CLAUDE.md "Versioning & Release Tagging".
- ~~**Flip the trial CTA live**~~ — **DONE** at 2.0.0. `TRIAL_CTA_ENABLED` is now true, and the flag
  plus its teaser branches are deliberately KEPT as the kill switch if billing must be pulled.
- **Store listing** — Pro screenshots, description, pricing copy.
- **Permission-bubble check on the Web Store dashboard at upload.** Still open, and it now has a
  second item on it. The `webNavigation` addition is expected to be warning-invisible (`history`
  already carries the broader warning) and was verified by comparing two loadable variant builds in
  real Chrome. **2.1.0 additionally adds `downloads` as an OPTIONAL permission** (auto-backup), which
  carries no install warning and no re-consent prompt but does need a justification in the listing.
  The dashboard's install bubble is the final authority and is only visible at upload time.
- ~~**Wallpaper Remove fix in the release notes**~~ — **DONE**, written into RELEASE-NOTES-2.0.0.md. `ddba4d3` fixes a Settings > Remove that was inert in both v1.0.4 and v1.0.5; free-tier users are affected and are told.
- ~~**Checkout-return tab-close fix in the release notes**~~ — **DONE**, written into RELEASE-NOTES-2.0.0.md. The post-purchase page closed its own tab on *every* visit, including keyless and failed-activation ones (`finally`-block `chrome.tabs.remove`). **v1.0.5 only** — the handler landed `4e12636`, 2026-05-09, after v1.0.4 shipped.

Filed post-v2.0 and now **all shipped except harness rescue**: `[1.2.2]` Insights date-range selector, the nest refusal toast, the pill redesign, and `[1.3.0]` Backup & Restore. **Harness rescue** (recover the pre-`tools/` round suites, Asana 1217302152465697) remains open.

#### Tracking Engine
- Ships capture-first: capture/attribution/retention pre-launch ([1.0.25]/[1.0.26], sequenced before [1.0.16]/[1.0.17]); analytics UI including Day Recap content and Deep Diver ships v2.1 — see SPECS/tracking-engine.md and DECISIONS 2026-07-07.
- Tab focus tracking via `chrome.tabs.onActivated`, `onUpdated`, `chrome.windows.onFocusChanged`
- Idle handling via `chrome.idle`
- URL → bookmark → tag mapping
- Time attribution to active task's tags
- Debounced storage writes
- Data retention: per-event granularity 30 days, per-day aggregates forever

#### Dashboard & Reviews
- **Day Recap** card (end of day, after user-set "end time"): deep work total, goals completed / pushed, longest focus stretch, tag pie breakdown, "how did today feel?" single-click capture (ships v2.1 with the analytics UI; per-day aggregates accrue from launch so it arrives pre-populated — DECISIONS 2026-07-07)
- **Start of Day** card (morning): today's goals, suggested first task, "Let's go" CTA
- **Weekly summary**: goals completion, time breakdown, deep work trend (v2.1 — same decision)
- **Deep Work Time** as primary metric (explicitly not "productivity score") (launch-day surface: the 'Today: Xh Ym focused' Dashboard line from [1.0.20]; full analytics v2.1)
- **Pill redesign** (`[1.2.3]`) — **COMPLETE 2026-08-10.** FOCUSED TODAY is the headline number on the idle card, the minimized face and the session-done card; the old small focused-today row is gone (one number, one place); ACTIVE is deleted as a counter and replaced by a static "Active since 9:04" / "Active since Aug 2, 9:04" line off `startedAt`. Pomodoro takeover byte-identical. The session-anchor machinery is deliberately KEPT despite losing its only reader — the same write normalizes `pausedAt`, which the pomodoro freeze still needs. Asana 1217301162748887; see DECISIONS.md 2026-08-10.

#### Achievements
- 5-7 thoughtfully designed badges (First Week, Goal Crusher, Deep Diver, Variety, Consistency, plus 2 TBD)
- Non-invasive UI — small Achievements section in Pro settings
- No celebration fanfare on the main grid

#### Cross-workspace tracking
- All workspaces track domain + tag time by default. Combined analytics toggle (opt-in, default off) shows totals across all workspaces in Dashboard. Marketing positions Pro as "unlimited contexts" — Work, clients, projects, side gigs. Personal/habit-tracking emerges as a user-discovered use case.

#### Free-tier additions shipping alongside Pro v1 launch
- Tab bar UI with greyed Pro tabs for free users (spec: `docs/SPECS/pro-tab-architecture.md`)
- Universal trash bin / soft delete (bookmarks, groups, goals, tasks, tags) — 30-day auto-purge, sidebar icon, spec: `docs/SPECS/trash-bin.md`

Per DECISIONS.md "Ship Pro and free tab-bar update as one release", these free-tier enhancements ship in the same release as Pro launch rather than a separate v1.0.5. Amended 2026-07-07: the [1.0.19] onboarding redesign ships earlier as a free-only v1.0.5 (no tab bar); see DECISIONS.md 2026-07-07.

### Pro v1 UI principles

- Minimal. Lightly pulsing "what's on for today" button is the only persistent Pro indicator on the grid.
- Supportive, not confrontational. No guilt, no Duolingo-owl vibes.
- Settings panel houses full Pro controls (separate from free Settings).
- Dark glass frosted aesthetic continues.

---

## v1.1.0 — Notes — **SHIPPED** (2026-08-30)

Pro-only. Sticky-note capture living as the **right-hand panel of the Tasks tab** (roughly 80/20,
stacking below 900px), with drag-to-**reorder**, threshold-gated search, promote-to-task and
promote-to-goal, a per-note hover trash plus a footer trash view, and a default-paper-colour
setting. `[1.1.0]`–`[1.1.4]` as scoped, plus `[1.1.5]`–`[1.1.7]` follow-ups from Samson's
checkpoint sweep.

**What the original scope said and did not ship:** a dedicated Notes tab, 2D drag positioning
with `{x, y}` coordinates, drag-to-trash, tag-chip filtering, and Ctrl+N / arrow-key navigation.
All deliberate; see DECISIONS.md 2026-08-30 and the reconciled `SPECS/notes.md`.

**Two changes reach every user, not only notes users:** the **Description** field on the New Task
and New Goal modals, and the **+ New Tag** button in the Tasks header.

## v1.2.0 — Notebooks

Organizational layer on top of standalone notes. Master-detail layout with left notebook column.
Drag-to-combine creates notebooks; drag-out returns notes to standalone. Asana tasks not yet
scoped — to be created once there is usage signal from shipped v1.1.

**Its layout assumptions predate the v1.1 redirect and have NOT been re-specced.** Notes ship in a
20% panel of the Tasks tab rather than a full tab area, and `position: {x, y}` is dormant, so the
left-column/right-pane split and the x-coordinate clamping in `SPECS/notes.md` both need
redesigning before this is scoped.

**Numbering note (2026-07-22):** this section's `v1.2.0` is a Notes-era release label and is **not** the `[1.2.0]` feature marker, which the v2.0 design lock assigned to Focus Blocking ("Notes owns `[1.1.x]`; the new features take `[1.2.x]`"). The collision is cosmetic — Notebooks has no marker-track tasks scoped yet — and should be reconciled at v2.1 planning.

## [1.3.0] — Backup & Restore — **SHIPPED** (2026-08-30)

Extended the shipped free Settings > Backup export/import rather than building one. **Round 1
(free):** a versioned v2 envelope carrying `data`, `launchpad_background`, `tracking_sessions` and
`tracking_days`, with v1 partial-format files accepted forever and named honestly at the confirm.
**Round 2 (Pro):** a weekly automatic backup to `Downloads/LaunchPad Backups/`, default OFF, that
**never deletes anything**.

**One scope correction worth carrying:** the licence was never a separate store to cover — it
lives in `data.pro` inside the `data` key, so v1 files already carried it. The real problem was
trust, and import now clears the stored verdict and re-validates. See DECISIONS.md 2026-08-30.

`chrome.storage.sync` full and hybrid both remain rejected; see DECISIONS.md 2026-07-22 and do not
relitigate. The `storage.sync` settings+licence slice is still an open later marker.

**Release consequence:** Round 2 adds `optional_permissions: ["downloads"]`, so the 2.1.0 permission
diff against 2.0.0 is **not** empty. It carries no install warning and no re-consent prompt, but it
needs a justification in the store listing at submission.

---

## [1.4.0] — Named Sessions — **SHIPPED** (2026-08-31)

**FREE TIER.** A user-named saved set of tabs, saved from the current window and relaunched into a
new one. Filed 2026-08-28 as a competitor-review candidate and built the same week as
`[1.4.0]`–`[1.4.4]`: data model (`6bf036f`), save/launch UI (`c54f73b`), task attachment
(`1c6160f`/`44c258b`), task-side attach and picker search (`6ee4f1e`), arc closer (`d251d77`),
trash view (`6496cca`).

Lives as a **sidebar flyout twinned with Restore Session**. Capture is an allowlist (`http`,
`https`, `file`) so unknown schemes fail closed; favicons are **captured at save time, never
derived**, because the app's only URL-to-favicon path ends at Google's S2 service. Array order is
canonical, `namedSessions` registered in the purge sweep at birth, and the trash view landed as
the last row of the list.

**Attachment to a task is Pro by inheritance** — tasks are Pro, so the attach entries are absent
on free and expired profiles while the sessions themselves stay fully functional, and the stored
`taskId` survives to return intact on upgrade.

**What was decided and NOT built:** focus pairing (launching a session does not start a focus
session — two intentions, one click is overreach) and launch-on-activate (a row control instead,
so a click that opens six tabs is a click the user aimed at). Both are closed decisions rather
than deferrals; see DECISIONS.md 2026-08-31.

**Website consequence, still open:** the `/compare/toby` table row concedes deliberate saving to
Toby and is now understated, and the free-tier claims are still written about shortcuts only.
The compare-page copy carrying named sessions has shipped; the remaining rows are a website
round.

## Same week, alongside the arc — **SHIPPED** (2026-08-31)

- **Task options pill** (1217980262292381, `772f8c3`) — a hover-revealed, keyboard-reachable
  affordance in the task row's name cluster, opening the existing task context menu that was
  previously reachable only by right-click. Costs zero row width (proven pixel-identical against
  a real master build). Adds **Priority** and **Assign to a goal** to that menu; the row keeps its
  own flag and trash, consolidation rejected.
- **Completing a goal releases its unfinished tasks** (1217981037474018, `53f8a3b`/`d3c87fd`) — a
  **pre-existing bug fix**, not a feature: a goal's unfinished children rendered in none of the
  three lists the Tasks tab draws, so completing a goal made them invisible while they were still
  incomplete. A one-time marker-guarded sweep repairs existing profiles; Samson's own carried
  twenty. `SPECS/tasks-and-goals.md` corrected in the same commit as this entry — it had claimed
  those tasks "remain visible but read-only", which was never true of shipped code.
- **Modal footer convention** (`1c65c48`, `3f966ff`, `e223290`) — `hideCancel`, one dismissal in
  the primary slot for modals that commit nothing, confirms keep their Cancel.

---

## [1.5.0] Localization — **MERGED, NOT SHIPPED, PAUSED AFTER R4** (2026-08-31)

Asana 1217984014133950. On master and in the 2.1.0 build; **no user-visible change and no
translated string.** English is the only catalogue. Listed here because roughly 700 lines of
infrastructure and 440 migrated messages are otherwise invisible in this file, and because a
reader who does not see it will assume the surface is still all hardcoded.

- **R1 skeleton** (`844e322`) — `i18n.js` (DOM-free, so it also loads in the service worker),
  `Intl.PluralRules`, locale negotiation with a stored preference, `_locales/en/` plus
  `default_locale` for the manifest's two strings, and the construction-site gate with its
  anti-vacuity floors. No strings moved.
- **R2 static markup** (`29cd400`…`f949ea3`) — `data-i18n` attributes and the DOM pass; the
  text node is replaced rather than `textContent`, so inline icons survive.
- **R3 static JS labels** (`977b108`) — 437 conversions, one accessor chosen per SINK.
- **R4 interpolation, plurals, em dashes** (`1e5ff29`, `7ae8e9f`, `5d5b998`, `186b137`,
  `8a93008`) — named placeholders, real CLDR plural forms, and 28 prose em dashes rewritten.
- **Escaping fix** (`0641149`, bug 1217985856381677) — `esc()` filled quoted attributes without
  escaping quotes. Fixed as a class. **This one blocks the 2.1.0 upload** and is in the build.

**PAUSED at R4-complete, deliberately, so 2.1.0 can ship.** R5 is scoped (~350 messages,
five stages, thirteen surfaces) and not started; the scoping report on the task is the plan
of record and R5.0 builds the verification harness before any string moves. None of this
reaches a user until translations are commissioned, which is a separate decision.

DECISIONS.md 2026-08-31 (localization) holds the mechanism, the escaping inversion, the
naming and placeholder conventions, and the four scope decisions. BUGS.md **P7 to P14**,
**D20**, **D21**, **G5** and **J9** hold what the arc cost to learn.

**Filed separately, not blocking:** locale-aware dates and numbers (1217984149041947) and the
RTL CSS conversion (114 physical direction properties; new work authors logical properties
from here, with no retrofit).

---

## Deferred: Pro v2

Items worth building but out of scope for v1 to keep the 10-week build shippable.

- Per-shortcut / per-domain time tracking within a workspace
- Richer analytics: time trends, categories, deep-work detection patterns
- Manual workspace switching keyboard shortcut
- ~~Pomodoro / sprint timer integrated into workspaces (deferred from Pro v1 per DECISIONS 2026-07-07)~~ — **un-deferred 2026-07-22** by the v2.0 design lock and shipped as **Focus sessions `[1.0.18]`**; see Pro v1 scope above
- Per-domain opt-out for tracking (Personal workspace)
- Habit tracking specialization for Personal workspace

---

## Deferred: Pro v3+

- Goal setting with numeric targets ("2 hours of deep work today")
- Analytics export (CSV, integrations with Toggl / Clockify)
- Premium wallpaper collection / icon packs / CSS themes
- Read-only calendar widget pulling today's events from Google Calendar
- Full calendar UI (low priority; likely never if users don't request)
- Calendar sync (two-way; ambitious; possibly v4+)

---

## Explicitly Out of Scope

Decisions already made. See `DECISIONS.md` for reasoning.

- **Cloud sync as primary paid feature.** `chrome.storage.sync` already offers free cross-device sync within Chrome (with size limits). Paying for what Chrome mostly does already is a weak value prop.
- **Advertising.** Breaks the privacy-first positioning.
- **Gating existing features.** Users who have the free features keep them. Pro is additive.
- **Team / manager dashboards.** Positioning is "no boss watching over your shoulder." Never pivot to enterprise.
- **AI-assisted organization.** Users like to customize their layouts; AI-moved icons would deter use.
- **Productivity score as primary metric.** Too subjective, too easy to misattribute, too easy to feel judged.

---

## Free Tier: Future Improvements

Non-Pro items that might land in v1.0.5 or later for everyone.

- Fix launchpad git identity misattribution (cosmetic, future commits only)
- "+ New Group..." right-click menu silently creates "New Group" without prompting — UX polish
- Settings panel staying dark glass on light backgrounds — minor visual inconsistency
- Promote variant to parent — capability lost in the radial → dropdown refactor, could return as ctx menu action
- Break `Git-parent` pseudo-monorepo into proper separate repos for WhatsBiting and whatsbiting-website

---

## Non-Product

Items that affect the business but not the product directly.

- First-run telemetry for v1.0.5 (minimal anonymous events — which onboarding step do users drop off at). Requires privacy policy update.
- Product Hunt launch prep (after Pro v1 or alongside)
- Landing page / comparison content ("LaunchPad vs Speed Dial 2 vs Toby")
- Multilingual store listings (given existing Japanese and Russian install base)
- User interviews with the two people who already installed it
