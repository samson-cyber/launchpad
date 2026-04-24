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
- Onboarding wizard on first install
- **Backup / export / import** (JSON envelope format with recovery backup on import) — shipped v1.0.4
- Promo toast system (Rate at 3rd open, Coffee at 8th, alternating every 20)

---

## In Progress: Pro v1 (target 10 weeks)

Paid tier. Pricing: **$4.99/mo or $39/year** (annual ~$3.25/mo). Lifetime option: **$59 one-time**. See `SPECS/pro-value-proposition.md` for positioning.

### Pro v1 scope (committed)

#### Foundation
- Workspaces: Work + Personal (2 hardcoded initially), with UI switcher
- Pro settings panel (separate from free Settings)
- Pro upgrade flow (billing provider TBD — LemonSqueezy / Paddle / Stripe)
- License key system (local verification + server-side abuse check)

#### Task / Goal System
- Goals: create, edit, delete. Scoped to today / this week / this month
- Tasks under goals: simple checklist
- Tags: create, assign to tasks, assign to bookmarks
- Active task picker (small widget on main grid)
- **Task completion = the dopamine moment** — deliberate animation + subtle sound (opt-in)

#### Tracking Engine
- Tab focus tracking via `chrome.tabs.onActivated`, `onUpdated`, `chrome.windows.onFocusChanged`
- Idle handling via `chrome.idle`
- URL → bookmark → tag mapping
- Time attribution to active task's tags
- Debounced storage writes
- Data retention: per-event granularity 30 days, per-day aggregates forever

#### Dashboard & Reviews
- **Day Recap** card (end of day, after user-set "end time"): deep work total, goals completed / pushed, longest focus stretch, tag pie breakdown, "how did today feel?" single-click capture
- **Start of Day** card (morning): today's goals, suggested first task, "Let's go" CTA
- **Weekly summary**: goals completion, time breakdown, deep work trend
- **Deep Work Time** as primary metric (explicitly not "productivity score")

#### Achievements
- 5-7 thoughtfully designed badges (First Week, Goal Crusher, Deep Diver, Variety, Consistency, plus 2 TBD)
- Non-invasive UI — small Achievements section in Pro settings
- No celebration fanfare on the main grid

#### Work + Personal Tracking
- Both workspaces track by default (opt-in per workspace)
- Marketing leads with Work (productivity tool)
- Personal secondarily serves habit tracking (YouTube, social, etc.) with per-domain opt-in

### Pro v1 UI principles

- Minimal. Lightly pulsing "what's on for today" button is the only persistent Pro indicator on the grid.
- Supportive, not confrontational. No guilt, no Duolingo-owl vibes.
- Settings panel houses full Pro controls (separate from free Settings).
- Dark glass frosted aesthetic continues.

---

## Deferred: Pro v2

Items worth building but out of scope for v1 to keep the 10-week build shippable.

- Custom workspaces beyond Work/Personal (user can create named workspaces)
- Per-shortcut / per-domain time tracking within a workspace
- Richer analytics: time trends, categories, deep-work detection patterns
- Manual workspace switching keyboard shortcut
- Recurring tasks
- Per-domain opt-out for tracking (Personal workspace)
- Habit tracking specialization for Personal workspace

---

## Deferred: Pro v3+

- Pomodoro / sprint timer integrated into workspaces
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
