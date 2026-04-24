# LaunchPad — Decisions Log

Append-only record of significant architectural and product decisions. Format loosely inspired by Architecture Decision Records (ADRs).

Each entry:
- Date
- Decision (what)
- Context (why we were deciding)
- Alternatives considered
- Outcome (what we picked)
- Reasoning (why)

Never rewrite historical entries. If a decision is later reversed, add a new entry explaining the reversal.

---

## 2026-04-24 — Workspaces + productivity layer as the Pro value prop (not cloud sync)

**Context:** Needed to pick a paid tier for LaunchPad. Initial direction (documented in project memory) was cloud sync at $1.49/mo.

**Alternatives considered:**
- Cloud sync across devices (original direction)
- AI-assisted shortcut organization
- Premium wallpaper / icon / theme library
- Ad removal (N/A — no ads exist)
- Gating existing free features behind a paywall

**Outcome:** LaunchPad Pro = Workspaces (Work/Personal) + goal/task system + tab time tracking + Day Recap + achievements. Positioned as a browser-based productivity companion for portfolio workers, deep-work seekers, and people wanting accountability without surveillance.

**Reasoning:**
- `chrome.storage.sync` already offers free cross-device sync within Chrome (with 100KB size limits that affect wallpapers and heavy data). Asking users to pay for something Chrome mostly does for free is a weak value prop, even if the free version has real limits.
- AI-assisted organization deters users who want to customize their own layouts.
- Premium visuals are low-margin and don't justify a recurring subscription by themselves.
- Gating existing features punishes current users and erodes trust.
- Workspaces + productivity layer:
  - Solves a real pain point (context-switching between work/personal, losing track of time)
  - Competes with RescueTime / Toggl / Rize / Motion — market exists, users pay for productivity tools
  - Novel positioning: "productivity new tab" is not a category anyone else owns
  - Non-confrontational framing is genuinely differentiated from clinical competitors
  - Has ongoing value (users open Chrome dozens of times daily; Pro features engage every time)

**Pricing settled:** $4.99/mo or $39/year. $59 lifetime option for subscription-averse users.

---

## 2026-04-24 — Task completion, not productivity score, is the core dopamine mechanic

**Context:** Needed a primary metric and feedback loop for Pro users to feel rewarded.

**Alternatives considered:**
- Productivity Score (algorithmic, 0-100)
- Focus Score (ratio of tagged-tab time to untagged)
- Day Quality (user-rated subjective)
- Task completion (checkbox moments)
- Deep Work Time (raw duration, no score)

**Outcome:** Task completion is the core mechanic. Deep Work Time is the primary secondary metric. "How did today feel?" captures subjective signal without algorithmic judgment.

**Reasoning:**
- A score implies measurement of something real. Tab-focus time is not productivity. Users who think, read away from screen, or meet in person would be penalized unfairly by a score.
- Task completion gives an immediate, concrete, user-controlled reward moment. Unambiguous — the user defined the task, the user decides when it's done.
- Deep Work Time is honest: "here's how long you were focused on tagged tabs." No judgment.
- Combining both (task completion as celebration, Deep Work Time as trend data) covers the immediate reward loop + long-term pattern awareness without fabricated confidence.

---

## 2026-04-24 — Work + Personal workspaces both get tracking; marketing leads with Work

**Context:** Initial proposal was to track only Work workspace and leave Personal untracked to avoid privacy concerns.

**Alternatives considered:**
- Work-only tracking (simpler, positions Pro as pure work tool)
- Work + Personal both tracked by default
- Work + Personal with per-workspace opt-in

**Outcome:** Both workspaces are trackable with per-workspace opt-in. Marketing positions Pro as a productivity tool (Work-first); Personal is a secondary "habit tracker" use case that users discover.

**Reasoning:**
- The "I want to stop doomscrolling / limit YouTube" problem is massive. Personal workspace tracking directly addresses it.
- Same tracking engine serves both — no extra build cost.
- Per-workspace opt-in preserves user control and privacy-respecting positioning.
- Marketing stays focused on Work (productivity = willingness to pay), Personal emerges as a delight feature.
- Roughly doubles the addressable use cases without scope expansion.

---

## 2026-04-24 — No calendar integration in Pro v1

**Context:** User proposed calendar function with potential Google / Outlook sync.

**Alternatives considered:**
- Full calendar UI with 2-way sync (Google Calendar, Outlook)
- Read-only "today's events" pulled from Google Calendar
- No calendar integration

**Outcome:** No calendar integration in Pro v1. Possibly a read-only "today's events" widget in Pro v2. Full sync deferred indefinitely.

**Reasoning:**
- Two-way Google Calendar sync is 3-4 weeks of work minimum (OAuth, event watching, recurring-event complexity, API quotas).
- Calendar UI inside a new-tab page is unusual; users already have dedicated calendar apps.
- 20+ calendar widget extensions already exist in the Chrome Web Store — crowded category.
- Scope was already large; adding calendar delays the Pro v1 launch by weeks for marginal value.
- "Today's goals and tasks" in the Pro dashboard serves the underlying need (what should I work on today) without touching calendar.

---

## 2026-04-24 — Move all dev work out of OneDrive to `C:\Dev\Git\`

**Context:** OneDrive silently corrupted `.git` metadata for multiple repos over months. Discovered during a session where shipped code turned out to not be committed, leading to a day-long investigation and recovery.

**Alternatives considered:**
- Continue using OneDrive with `.git` folders excluded from sync (unreliable)
- Move everything out of OneDrive (drastic but clean)
- Use a different cloud sync tool (just shifts the problem)

**Outcome:** All development repos moved to `C:\Dev\Git\`. OneDrive Git folder deleted entirely. Repos re-cloned fresh from GitHub. Repositories affected: launchpad, reelabs, condence-ai, exhale-health, and the Git-parent pseudo-monorepo.

**Reasoning:**
- Cloud-sync tools are not designed to handle `.git` internals, which involve many small files, case-sensitive content-addressed storage, and atomic state transitions.
- "Just exclude .git from sync" is brittle and requires per-repo configuration that can be forgotten.
- Losing git integrity silently is catastrophic. Not worth ongoing risk.
- Dev work isn't typically something you restore from cloud — it's already on GitHub.

---

## 2026-04-24 — LaunchPad default branch is `master`, not `main`

**Context:** LaunchPad's GitHub repo had two branches (`main` and `master`) with diverged histories. `master` contained v1.0.4 work; `main` contained the project's original history through v1.0.3 (53+ commits back to MVP). They shared no common ancestor.

**Alternatives considered:**
- Make master the default, delete main, accept loss of old history
- Merge master's recent work into main, make main default, delete master
- Leave both branches alone, document the split
- Rename master → main after syncing

**Outcome:** Master is the GitHub default. Main was deleted. Main's historical state is preserved as the tag `main-archive` at commit `ac0c2ad`.

**Reasoning:**
- Merging master into main would likely produce major conflicts (disjoint histories on same files) — more time than the historical value justifies.
- Leaving both branches persisted caused ongoing confusion (clones defaulted to main and pulled outdated code).
- A tag preserves history immutably with zero ongoing maintenance.
- Convention preference (`main` vs `master`) is secondary to having a single clean default.

---

## 2026-04-24 — `build.sh` requires a clean working tree

**Context:** v1.0.3 shipped to the Chrome Web Store containing code that was never committed to git. Discovered during later investigation; caused significant untangling effort.

**Outcome:** `build.sh` now refuses to produce a release ZIP when `git status` shows uncommitted changes or untracked files in the source tree.

**Reasoning:**
- Every shipped version of the extension must correspond to a git commit, so it can be audited and rebuilt.
- A "commit before ship" habit is reliable; a "remember to commit after shipping" habit is not.
- One extra `git commit` is cheap insurance against another day-long recovery session.

---

## 2026-04-24 — Ship Pro and free tab-bar update as one release

**Context:** Pro v1 introduces a tab bar in the new-tab UI (Home, Tasks, Dashboard, Insights). Question was whether to ship the free-tier tab-bar UI change (Home as default, greyed/locked Pro tabs visible to free users) separately as a v1.0.5 before Pro launches, or as part of the Pro launch itself.

**Alternatives considered:**
- Staged v1.0.5 with free-only tab-bar UI, then Pro launch weeks later
- Single release containing free tab-bar update + Pro features gated by license

**Outcome:** Free tab bar + Pro features ship in the same release. No intermediate v1.0.5.

**Reasoning:**
- One unified launch narrative instead of two disconnected announcements.
- No prolonged transition period where free users see a half-changed UI without the payoff.
- Testing is concentrated on one release day, not spread across two windows.
- The free-tier tab bar on its own has no standalone value for users — it only makes sense as the entry point to Pro.

---

## 2026-04-24 — Pro tabs: Home, Tasks, Dashboard, Insights (4 tabs)

**Context:** Pro's new-tab UI needed a tab structure. Candidates included separate tabs for each major surface (Tasks, Dashboard, Insights, Achievements, Day Recap, etc.). Achievement badges were initially considered for their own tab.

**Alternatives considered:**
- 3 tabs (Home, Tasks, Dashboard) with Insights folded into Dashboard
- 4 tabs (Home, Tasks, Dashboard, Insights) with Achievements as a subsection inside Insights
- 5 tabs (Home, Tasks, Dashboard, Insights, Achievements)
- 6+ tabs including Day Recap, Start of Day as separate surfaces

**Outcome:** 4 tabs — Home, Tasks, Dashboard, Insights. Achievement badges live inside Insights as a subsection alongside long-term trends.

**Reasoning:**
- Pro v1 ships with ~7 achievement badges. A dedicated tab for 7 items feels thin and invites comparison to gamified competitors (which is the wrong positioning).
- Insights is framed as "the longer view" — trends, patterns, milestones. Achievements (milestones you've hit) naturally belong there alongside tab-time trends and deep-work history.
- 4 tabs fits comfortably in the tab bar without scrolling or crowding.
- Dashboard = "today"; Insights = "over time". Clean mental model.

---

## 2026-04-24 — Dodo Payments as billing provider

**Context:** Pro needs a billing provider for subscriptions ($4.99/mo, $39/year), lifetime purchases ($59), license key generation, and tax compliance across international buyers.

**Alternatives considered:**
- Stripe (industry standard, most flexible)
- LemonSqueezy (Merchant of Record, popular with indie SaaS)
- Paddle (Merchant of Record, enterprise-leaning)
- Dodo Payments (newer Merchant of Record, launched 2025)
- Gumroad (simpler but weaker subscription tooling)

**Outcome:** Dodo Payments is the billing provider for Pro v1.

**Reasoning:**
- Merchant of Record model = Dodo handles tax compliance across 220+ countries; Samson doesn't register for VAT/GST/sales tax anywhere. Stripe would require registering in every jurisdiction with threshold crossings — unsustainable for a solo dev.
- Built-in license key management means no custom license-server code needed.
- Fees are lower than LemonSqueezy (4% + 40¢ vs 5% + 50¢) which compounds on $4.99/mo subscriptions.
- Risk acknowledged: Dodo is newer (2025 launch) with a smaller community than Stripe/LemonSqueezy. If Dodo has reliability or support issues, the plan is to swap providers.
- Mitigation: build a clean billing abstraction layer in LaunchPad so the provider is swappable in 1-2 days without touching feature code.

---

## 2026-04-24 — Free trial: no card required, auto-downgrade at day 7, no emails

**Context:** Pro needs a free trial mechanic to let users try Work Mode, tracking, and Day Recap before paying. Standard industry options range from card-required 14-day trials with email reminders to card-less short trials with in-app nudges.

**Alternatives considered:**
- Card required up front, 14-day trial, auto-billed after trial
- Card required, 7-day trial, cancellation email reminders
- No card, 7-day trial, email reminders + final conversion email
- No card, 7-day trial, auto-downgrade at end, in-extension reminders only (no email)

**Outcome:** No card required. 7-day free trial. At day 7, account auto-downgrades to free. In-extension reminders only — no email notifications at any point.

**Reasoning:**
- "No card required" removes the biggest friction point in trial signup and matches the "no boss watching" brand positioning.
- Auto-downgrade (rather than auto-charge) maintains user trust — no surprise charges, no "I forgot to cancel" complaints.
- In-extension messaging (day 5 trial-ending banner, day 7 trial-end modal, 48-hour post-end reactivation toast offering 30% discount) reaches users where they already are, without requiring email permission.
- Skipping email entirely keeps LaunchPad's privacy-first story consistent and avoids an entire class of integration (ESP account, list management, unsubscribe flows, GDPR, deliverability).
- Acknowledged trade-off: conversion rate will be lower than industry benchmark (card-required trials convert ~30%; no-card card-less trials convert ~10-15%). Accepted in exchange for word-of-mouth strength, brand consistency, and operational simplicity.

---

## 2026-04-24 — Personal workspace default off, opt-in via Pro Settings

**Context:** Pro supports two workspaces (Work and Personal). Question was whether Personal should be enabled by default on Pro activation or require explicit opt-in.

**Alternatives considered:**
- Both workspaces enabled by default on Pro activation
- Only Work enabled by default; Personal opt-in from Pro Settings
- User prompted to choose during Pro onboarding

**Outcome:** Work is enabled by default. Personal workspace is default off and requires opt-in via Pro Settings.

**Reasoning:**
- Marketing leads with Work as the primary productivity use case. First impression should be "this is a tool for my work day."
- Personal is a secondary habit-tracking / doomscroll-limiting use case discovered by users who want it — not the headline value prop.
- Avoids the "why is this tracking my YouTube?" reaction at first launch, which would undercut trust even though tracking is scoped to the workspace.
- Users who want Personal tracking will find it; users who don't won't have it sprung on them.
- Opt-in is consistent with the privacy-respecting positioning established in the earlier "Work + Personal both get tracking" decision — that decision established the capability exists; this decision establishes the default.

---

## 2026-04-24 — Tags: auto-created from goals, inherited by child tasks, bookmarks taggable separately

**Context:** Pro's task system supports tags for cross-cutting organization (e.g., "#client-x" across goals and tasks). Needed to decide when tags get created, what inherits them, and whether bookmarks participate.

**Alternatives considered:**
- Every task and bookmark auto-tagged on creation
- Tags manually created by user, no auto-creation
- Tags auto-created from goals only, inherited by child tasks, bookmarks tagged separately
- Separate tag namespaces for tasks vs bookmarks

**Outcome:** Creating a goal auto-creates a tag with the goal's name. Child tasks under a goal inherit the tag. Standalone tasks (no parent goal) do not auto-tag. Bookmarks are tagged separately via right-click or from the Goal detail view.

**Reasoning:**
- Auto-tagging every task produces 40+ tags per week of normal use — the tag picker becomes unusable and tag sprawl destroys the feature's value.
- Goal-anchored tags keep the tag namespace close to the user's mental model of "projects I care about."
- Inheritance from goal to child tasks is a natural default that avoids repetitive tagging.
- Standalone tasks (quick todos) don't need tags — forcing them would just be noise.
- Bookmarks benefit from tags for cross-goal retrieval ("show me all reference links for client-x"), but need explicit user action so the tag set stays curated.

---

## 2026-04-24 — Work workspace gets tags + domain tracking; Personal workspace gets domain-only

**Context:** Tracking semantics should differ between Work and Personal workspaces because the use cases differ. Needed to decide whether tags apply to Personal and whether domain tracking applies to both.

**Alternatives considered:**
- Both workspaces get full tag + domain tracking (symmetric)
- Work gets tags + domain; Personal gets domain-only
- Work gets tags + domain; Personal gets tags-only
- Work-only tracking of any kind (deferred Personal tracking to v2)

**Outcome:** Work gets tags (goal-based) plus domain tracking. Personal gets domain-only tracking — no tags. Optional combined analytics toggle lets users see one number across both if they opt in.

**Reasoning:**
- Work is framed as productivity: "how much focused time on goal X this week?" Tags are the mechanism for that answer.
- Personal is framed as awareness: "how much time on YouTube / Reddit / news sites this week?" Domain is the natural unit; tagging personal browsing would be overengineering a casual use case.
- Asymmetric design keeps Personal lightweight — the user adopts Personal if they want a gentle habit mirror, not another spreadsheet to maintain.
- Combined analytics toggle is opt-in for users who specifically want a unified view ("my total deep-focus time across everything"). Default off to avoid implying the two workspaces should be conflated.

---

## 2026-04-24 — Always reset to Home tab on every new-tab open

**Context:** With Pro introducing a tab bar (Home, Tasks, Dashboard, Insights), needed to decide whether the last-selected tab persists across new-tab opens.

**Alternatives considered:**
- Persist last-selected tab (user ends up on whatever they viewed last)
- Always reset to Home
- User-configurable default tab

**Outcome:** Every new-tab open starts on the Home tab. No persistence of tab selection across new-tab-opens.

**Reasoning:**
- "New tab = my launchpad" is the consistent mental model Home reinforces — shortcuts, search, everything users associate with the free extension.
- Landing on Tasks or Dashboard when the user just wanted to search for something would be disorienting.
- Simpler rule to implement and explain; no edge cases around first-open vs subsequent-open state.
- Users who want the Dashboard can click one tab — one click is a small cost for the consistency payoff.
