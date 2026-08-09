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
- Promo toast system (Rate at 3rd open, Coffee at 8th, alternating every 20)

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

#### Focus Sessions, Blocking, Time-by-Site (the v2.0 launch trio)

Locked 2026-07-22 (v2.0 design lock, Asana 1214260527650518). Privacy posture absolute: nothing leaves the machine, zero new install-warning permissions — `optional_permissions` requested at runtime on explicit opt-in only.

- **Focus sessions** (`[1.0.18]`) — **COMPLETE 2026-08-08.** Attached to the active task (no task, no timer); sticky point-of-use duration chips; auto-break with work never self-starting; graceful expiry with grace-uniform honesty; pause integration; desktop notifications via runtime-requested optional permission; three synthesized local chimes with offscreen playback. Rounds A1/A2 `b141d3a`/`29bbb07`, E `1627003`, B-1 `65711b6`, B-2 `a7cf131`. See DECISIONS.md 2026-07-22 (naming/duration, session semantics) and 2026-08-02 (notifications fork).
- **Focus Blocking** (`[1.2.0]`) — **NEXT ON THE BOARD.** Gentle gate page ("YouTube is blocked — 23m focused on <task>", snooze + end focus), arms manually and auto-arms during focus work phases, global block list in Pro Settings, capture-first block/snooze counters. Tabs-API navigation intercept (zero new permissions); `declarativeNetRequest` is the fallback only if the audit disproves that route.
- **Time-by-Site** (`[1.2.1]`) — follows `[1.2.0]`. One-card reader round on settled conventions, no open design questions.

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
- **Pill redesign** — FOCUSED TODAY becomes the headline number, ACTIVE becomes a static "Active since …" line. Decided 2026-08-08 (DECISIONS.md), **not yet implemented**; Asana Backlog, candidate pre-v2.0-launch polish.

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

## v1.1.0 — Notes (standalone)

Pro-only feature. Sticky-note-styled grid for quick capture, with promote-to-task and promote-to-goal integration, drag positioning, search/filter, and a Notes-specific trash can UI. 5 Asana tasks scoped: [1.1.0] through [1.1.4]. Target release: ~4-6 weeks post v1.0 launch.

## v1.2.0 — Notebooks

Organizational layer on top of standalone notes. Master-detail layout with left notebook column. Drag-to-combine creates notebooks; drag-out returns notes to standalone. Asana tasks not yet scoped — to be created after v1.1.0 ships and we have usage signal. Target release: ~6-8 weeks after v1.1.0.

**Numbering note (2026-07-22):** this section's `v1.2.0` is a Notes-era release label and is **not** the `[1.2.0]` feature marker, which the v2.0 design lock assigned to Focus Blocking ("Notes owns `[1.1.x]`; the new features take `[1.2.x]`"). The collision is cosmetic — Notebooks has no marker-track tasks scoped yet — and should be reconciled at v2.1 planning.

## [1.3.0] — Backup & Restore

Reframed 2026-07-22 (task 1216777305263735) as **extending the shipped free Settings > Backup export/import**, not building one: full coverage (`data` + `tracking_sessions` + `tracking_days` + license key), schema-stamped with migration on import, old partial-format backups still importable. Export stays free; the Pro layer is **automation** — periodic auto-export via `optional_permissions ["downloads"]`, runtime-requested, default OFF. `chrome.storage.sync` full and hybrid both rejected; see DECISIONS.md 2026-07-22. Post-v2.0, slot early in v2.1. Pre-pickup audit of the existing implementation required before any PLAN.

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
