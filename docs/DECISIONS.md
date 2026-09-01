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

---

## 2026-04-24 — Universal trash bin with 30-day auto-purge (free tier)

**Context:** The existing backup/export system (v1.0.4) handles catastrophic data loss scenarios but doesn't address the far more common "oh shit I didn't mean to delete that" moment. Users who accidentally delete a bookmark shouldn't need to restore an entire JSON export to recover it.

**Alternatives considered:**
- Goals/tasks-only trash (inconsistent — why can I undo deleting a task but not a bookmark?)
- Manual-only purge with no auto-cleanup (unbounded storage growth, trash becomes a graveyard)
- Pro-gated trash bin (adds friction to a trust feature; punishes free users for accidents)
- Per-item expiration timers (doesn't scale, no benefit over batch sweep)

**Outcome:** Universal soft-delete system covering bookmarks, groups, goals, tasks, and tags. Deleted items remain in a Trash Bin for 30 days, then are permanently removed by a daily auto-purge (`chrome.alarms`). Accessible via an icon adjacent to the Settings cog in the sidebar. Shipped as a free-tier feature.

**Reasoning:**
- Applying the pattern uniformly to bookmarks, groups, goals, tasks, and tags keeps the UX consistent — users don't have to remember which things are recoverable.
- 30-day retention matches industry norms (Gmail, Drive, Dropbox) and keeps storage bounded (~250 KB worst case, negligible).
- Free-tier status reinforces LaunchPad's "we respect your data" brand without creating dependency on Pro for basic safety.
- Batch sweep via a single daily `chrome.alarms` fire is simpler than per-item timers and scales to any trash size.
- Full spec: `docs/SPECS/trash-bin.md`. Asana spec task: GID `1214257389471009`.

---

## 2026-04-24 — Workspaces as generic user-managed containers (reframe)

**Context:** Original Pro design (documented earlier in DECISIONS.md) assumed two fixed workspaces, Work and Personal, with asymmetric feature sets — Work got full task/tag tracking, Personal got domain-only. On reflection during the Tasks/Goals scoping session, the two-workspace design felt limiting for the portfolio-worker persona who might want one workspace per client, per job context, or per project. The asymmetry also complicated UX (two sets of rules) and marketing copy.

**Alternatives considered:**
- Fixed Work + Personal with asymmetric features (original design)
- Fixed Work + Personal with symmetric features (compromise)
- Generic user-managed workspaces, unlimited count, all symmetric (this decision)

**Outcome:** Workspaces are generic user-managed containers. Free tier gets 1 workspace (default name "Main"). Pro gets unlimited workspaces, all with identical feature sets (goals, tasks, tags, tracking). Users can name, reorder, and organize workspaces however they want — per client, per context, work vs personal, etc. "Work" and "Personal" become example use cases, not product structure.

**Reasoning:**
- Better fit for the portfolio-worker persona (client workspaces)
- Simpler mental model: one concept, one feature set
- More compelling Pro value prop (unlimited contexts vs "one extra workspace")
- Easier marketing copy
- Extensible array-of-workspaces data model from the original spec already supports this — no schema rework needed

**Free / Pro boundary:**
- Free: 1 workspace, default name "Main", renameable
- Pro: unlimited workspaces, create/rename/reorder/delete
- Pro downgrade with N workspaces: all preserved, first workspace is editable, others become read-only (isReadOnly = true). User can view but not edit.
- Pro re-upgrade: restores full editability across all workspaces immediately

**Supersedes:**
- "Personal workspace default off, opt-in via Pro Settings" (2026-04-24) — replaced with "Pro users create workspaces as needed from Pro Settings; free tier has 1 renameable workspace"
- "Work workspace gets tags + domain tracking; Personal workspace gets domain-only" (2026-04-24) — replaced with "All workspaces have symmetric feature sets; combined analytics toggle still applies across all workspaces in Dashboard"

Full spec: `docs/SPECS/workspaces-data-model.md` (v2). Asana spec task: GID `1214257173070934`.

---

## 2026-04-24 — Tasks/Goals architecture: flat hierarchy, auto-tagging from goals, paused task is sacred

**Context:** Tasks/Goals is the core productivity layer of Pro. Scoping session needed to settle several structural decisions: how goals and tasks relate, how tagging works across entities, what the active-task experience feels like, which advanced features land in v1 vs v2.

**Alternatives considered:**
- Nested goals (goal → sub-goal → tasks) vs flat (goal → tasks)
- Auto-tag every task on creation vs goal-level tagging only
- Task dependencies in v1 vs deferred
- Advanced template field interpolation in v1 vs basic templates only
- Idle detection as the only pause mechanism vs explicit pause button

**Outcome:**
- Flat hierarchy: Goal → Tasks only, no sub-goals in v1
- Tags auto-create from goals; child tasks inherit; standalone tasks don't auto-tag; bookmarks/groups taggable separately
- Task dependencies (blocking relationships) deferred to v2
- Basic goal templates in v1 (name + task list + priorities); advanced field interpolation deferred
- Explicit pause button added to active-task widget; idle detection runs silently in parallel but manual pause is sacred
- Task due dates with hierarchy rule: child task cannot exceed parent goal deadline without confirmation modal; goal deadline cannot move earlier than any existing child task without blocking

**Reasoning:**
- Flat hierarchy avoids rabbit-hole feature creep (sub-goals invite Gantt, critical path, etc.)
- Auto-tagging every task would create 40+ tags per week and destroy tag picker usability
- Dependencies look good on feature lists but get minimal use in solo productivity tools; positioning is "no boss watching" which implies informal workflows
- Explicit pause respects user agency; idle detection is honest but invisible; having both covers "I'm stepping away" and "I never wondered if it was still tracking"
- Due-date hierarchy prevents the silent surprise of a child outlasting its parent; modal makes the trade-off explicit rather than magical-in-a-bad-way

Full spec: `docs/SPECS/tasks-and-goals.md`. Asana spec task: GID `1214260169431711`.

---

## 2026-04-25 — Tab bar lives directly under the logo, no top header strip in v1

**Context:** The original Pro tab architecture spec (`pro-tab-architecture.md` v1) called for a top header strip with brand, workspace switcher, and pulsing upgrade CTA, with the tab bar living below it. While implementing the [1.0.2] tab bar scaffold, the layout was reconsidered. The free-tier visual identity is anchored on the centered Google-new-tab-page logo + search bar — moving the brand into a top strip would change the first impression for the existing install base, even though the change is subtle.

**Alternatives considered:**
- Top header strip with brand + workspace switcher + upgrade CTA, tab bar below (original spec)
- Tab bar inside the sidebar's middle area
- Tab bar between the search bar and the grid (under the search field)
- Tab bar directly under the existing centered logo, above the search bar (this decision)

**Outcome:** Tab bar lives directly under the existing centered LaunchPad logo and above the search bar. Logo, search bar, and grid stay where they are today. No top header strip is added in v1.

**Reasoning:**
- Preserves the Google-new-tab-page familiarity that existing free-tier users associate with LaunchPad. The eye flow — logo, then search, then grid — is intact.
- The sidebar's middle area is reserved for the active task widget per `tasks-and-goals.md`, so it can't host the tab bar without crowding.
- Placing the tab bar between the search bar and the grid would visually divorce two elements that feel like one unit.
- Putting the tab bar under the logo is the smallest possible disruption to the existing layout while still making Pro tabs discoverable.

**Implications:**
- Workspace switcher placement TBD in [1.0.6] when the switcher is built. Likely sidebar (top or middle), but the decision is deferred until the widget exists in code.
- Upgrade CTA placement TBD in [1.0.5]. Visual states and behavior remain per the existing pulsing-CTA spec.
- Keyboard shortcuts dropped from v1 — Ctrl+1..4 conflicts with Chrome's reserved tab-switching shortcuts. Click-only navigation. Revisit if user feedback requests it.

Spec updated: `docs/SPECS/pro-tab-architecture.md` (revision note added at top, Tab Bar Layout / Workspace Switcher / Pulsing Upgrade CTA / Keyboard Accessibility sections revised).

---

## 2026-04-25 — Pro Settings v1 entry point is sidebar-only, hidden for free users

**Context:** The Pro tab architecture spec called for two Pro Settings entry points: a gear icon on the Pro tabs themselves, and a Pro badge in the top-right header. Neither UI exists in v1 — the top header strip was dropped in [1.0.2], and the upgrade CTA / Pro badge placement is deferred to [1.0.5]. The [1.0.3] task needed to land a Pro Settings panel anyway (so license entry, subscription status, and future Workspaces/Pomodoro/Achievements management have somewhere to live), so an interim entry point was required.

**Alternatives considered:**
- Merge free Settings + Pro Settings into a single panel with greyed sections for Pro features (rejected — Settings panels are "I came to change a setting" UIs; half-disabled sections are more frustrating than discovery-inducing, and the existing free panel's character would be diluted)
- Separate Pro Settings panel with a sidebar entry hidden for free users (chosen)
- Separate Pro Settings panel with a sidebar entry visible-but-disabled for free users (rejected — broken upgrade routing has no destination yet, and a disabled sidebar entry advertises "you don't have this" without a path forward)
- Separate Pro Settings panel reachable only via a gear icon on Pro tabs (rejected for v1 — the gear icon UI hasn't been built; sidebar is the simplest interim path)

**Outcome:** A separate Pro Settings panel with the same frosted-glass treatment as the existing free Settings panel. Entry is a new sidebar item placed directly above the existing Settings cog, hidden via `display: none` for users at access levels `free` and `expired`. Visible for `trialing` / `active` / `grace`. Visibility is re-derived from `ProAccess.getProAccessLevel(data)` on every storage change, so license toggles propagate within ~1s without a reload.

**Reasoning:**
- Clean separation of free and Pro UIs preserves the existing Settings panel's character (no half-disabled sections, no "Pro" tooltips cluttering everyday settings interactions).
- The chicken-and-egg problem (a free user with an existing license has no UI route to enter it) is acceptable in v1 because (a) testing happens via console snippets while Dodo integration is unbuilt, and (b) [1.0.5]'s upgrade flow will provide an "Already have a license?" affordance that opens the panel after applying access.
- Hiding rather than disabling the sidebar entry avoids the "tease and frustrate" anti-pattern.

**Implications:**
- [1.0.5] upgrade-CTA task should include an "Apply existing license" affordance that elevates a free user's access state and reveals the Pro Settings entry.
- Future Polish work could revisit additional entry points (gear-on-Pro-tabs, header badge) once those UIs land. The sidebar entry stays regardless — it's the canonical home for Pro Settings.
- The Workspaces / Combined analytics / Pomodoro / Achievements sections inside Pro Settings are placeholders in [1.0.3]; their corresponding feature tasks ([1.0.6], Dashboard area, [1.0.18], [1.0.23]) fill them in.

Spec updated: `docs/SPECS/pro-tab-architecture.md` (second revision note added at top).

---

## 2026-04-26 — Pulsing CTA placement: right side of tab bar pill

**Context:** The Pro tab architecture spec originally placed the pulsing upgrade CTA in a top-right header strip. That header strip was dropped in [1.0.2] (the "Tab bar lives directly under the logo, no top header strip in v1" decision), which left the CTA placement open. [1.0.5] needed to settle it. Constraints: must be persistently visible, must adapt across five states (Start free trial / Upgrade / Trial countdown / Pro badge), must be able to pulse subtly when a free user is on a Pro tab without nagging on Home.

**Alternatives considered:**
- Top-right viewport corner — independent of any other UI, maximally visible
- Right side of the tab bar pill, as a fifth element after the four tab buttons (this decision)
- Sidebar item placed above the existing Pro Settings entry
- Banner-only — surface the CTA only inside the [1.0.4] preview banner on Pro tabs, no persistent global element

**Outcome:** The CTA is a fifth element on the right side of the tab bar pill, separated from the four tab buttons by a thin vertical divider. Sized and styled to feel like part of the same frosted-glass band but visually distinct (accent gradient fill versus the tabs' transparent text). The pulse activates only when access level is `free` or `expired` AND the active tab is one of the three Pro tabs.

**Reasoning:**
- Symmetry with the tabs: the upgrade door belongs next to the doors it unlocks. Putting it in the same pill makes the relationship spatial, not conceptual.
- Contextual adjacency to the gated Pro tabs: when a user clicks Tasks / Dashboard / Insights and sees Preview Mode, the CTA is right there in the same horizontal band — the eye flow from a gated tab label to the upgrade pill is a few pixels.
- Top-right viewport corner felt nag-y and competed with Chrome's own toolbar zone; it also implied a top header strip that we've decided not to ship.
- Sidebar placement would hide the CTA when the sidebar is collapsed, which is most of the time. The pulse would be invisible exactly when discovery matters.
- Banner-only would skip Home entirely, which is the wrong default — a free user who never clicks a Pro tab should still see a calm static CTA.
- The thin divider preserves the tab bar's existing visual rhythm; the gradient fill prevents the CTA from being mistaken for a fifth tab.

**Implications:**
- Trial-flow / checkout click handling is stubbed in [1.0.5] with `showToast("Upgrade flow coming soon")`. Real Dodo Payments integration lands in [1.0.5.1] (Backlog GID `1214293491924982`).
- Apply-license affordance ("Already have a license?") in the popover gives free users a path to enter a key, which the Pro Settings panel can't provide because that panel is hidden from free users per the [1.0.3] decision.
- Tab bar minimum width grows by the CTA's footprint (~120px at default copy); narrow viewport (<1024px) collapses the trial-countdown copy from "Trial · 5 days left" to "Trial · 5d" via CSS.
- Trial countdown updates every 60s via a page-scope setInterval — page-scope is fine here (service worker not involved); the alarm overhead is negligible.

Spec updated: `docs/SPECS/pro-tab-architecture.md` (third revision note added at top, Pulsing Upgrade CTA section rewritten).

---

## 2026-04-26 — Trialing user CTA click bypasses popover

**Context:** [1.0.5] initially routed all non-Pro states (A–E) through the upgrade popover, which for trialing users would surface a "Manage subscription" primary button stubbed to toast "Upgrade flow coming soon" until [1.0.5.1] lands real Dodo integration. Review on 2026-04-26 flagged this as a worse interim experience than just opening the Pro Settings panel.

**Outcome:** Trialing (E) joins active / grace (F) — CTA click opens Pro Settings panel directly, no popover. Free / expired states (A–D) still open the upgrade popover. Apply-license affordance remains in the popover for free / expired users; trialing users don't need it (they already have access).

**Reasoning:**
- Trialing users have account context and want subscription information, not a generic upgrade pitch with a non-functional button.
- Pro Settings already shows trial days remaining, last-verified status, and the license-key entry row — strictly more useful than the popover for someone in trial.
- Avoids shipping a known-bad interim flow that we'd just have to redesign when [1.0.5.1] adds the real checkout.
- Routing change is one-line in the click handler; popover construction is unchanged.

Spec updated: `docs/SPECS/pro-tab-architecture.md` (Pulsing Upgrade CTA section's click-behavior list amended; no new top-of-file revision note — this is a minor correction).

---

## 2026-04-26 — Trial-ends-today copy displays during final 24 hours

**Context:** [1.0.5] revision 1 added a "Trial ends today" branch in both the CTA pill and Pro Settings copy. Manual verification revealed it was unreachable: `trialDaysRemaining` returned 1 for everything from 24h down to 1ms remaining, and `getProAccessLevel` demoted the trial to free the moment the 7-day window closed — so the 0 branch only fired on an exact-millisecond boundary that no user would ever observe.

**Outcome:** `trialDaysRemaining` returns 0 for any positive remaining time under 24 hours (instead of only at exact expiry). The "Trial ends today" copy now displays continuously during the final day of the trial, ending only when the level itself demotes to free / expired and the CTA naturally flips to "Upgrade".

**Reasoning:**
- The 0 branch existed for a UX moment that the math made impossible — pure dead code in the previous shape.
- Inclusive day-counting matches how users think about deadlines ("the trial ends today" is true any time within the final 24 hours, not just at the stroke of midnight).
- `Math.ceil` for >=24h still rounds up, so 24h+1ms reads "Trial · 2 days left" — preserves the "you have at least one full day plus part of another" reading.
- Single-source-of-truth: both the CTA pill and `renderProSubscriptionSection` consume the same function, so the behavior change is consistent across surfaces.

Spec updated: `docs/SPECS/pro-tab-architecture.md` (state E edge-case list clarified). No new top-of-file revision note — same minor-correction precedent as the previous trialing-routing entry.

---

## 2026-04-26 — Workspace switcher placement: sidebar top

**Context:** The original `workspaces-data-model.md` v1 placed the workspace switcher "top-left of header strip, before the LaunchPad logo." That placement is no longer viable: the [1.0.2] decision dropped the top header strip from v1 entirely. [1.0.6] needed to settle the actual placement before implementation. Constraints: must be visible to Pro users only, must show active workspace identity at a glance, must not crowd the existing free-tier UI for free users (who never see it).

**Alternatives considered:**
- Sidebar top, above the History entry (this decision)
- Right side of the tab bar pill, far-left counterpart to the [1.0.5] upgrade CTA
- Its own row between the LaunchPad logo and the tab bar
- Top-left viewport float, independent of any other UI

**Outcome:** The switcher lives at the top of the sidebar, above the existing History entry. Two visual modes mirror the sidebar's collapsed (28×28 chip) and expanded (chip + name + chevron) states. Hidden via the existing `.hidden` class for free / expired users; visible for trialing / active / grace. Click locks the sidebar expanded and opens a frosted-glass dropdown anchored via `getBoundingClientRect`.

**Reasoning:**
- Workspaces are a navigation primitive (which set of bookmarks / groups / goals / tasks am I in?). The sidebar is LaunchPad's navigation surface. They belong together.
- The sidebar already handles the collapsed / expanded real-estate constraint via the existing hover + lock pattern. Reusing it for the switcher means no new UI primitive — chip in collapsed mode, full row in expanded mode, same as every other sidebar entry.
- Tab bar pill placement would crowd the [1.0.5] upgrade CTA on the right and visually compete with the four tab buttons; it would also be invisible to free users who don't see the switcher, leaving an asymmetric pill.
- Own-row placement would push the search bar and grid further down the viewport for Pro users, regressing the layout.
- Top-left viewport float would float over the sidebar and create overlapping z-index concerns.

**Implications:**
- No keyboard shortcuts in v1 (Ctrl+1..8 conflict with Chrome's reserved tab shortcuts). Revisit only on user demand.
- The dropdown reuses the `getBoundingClientRect` + `position: fixed` anchoring pattern from the [1.0.5] upgrade popover and the [1.0.4] preview banner — third use of the same mechanic, suggests a future shared helper if a fourth case appears.
- Workspace deletion is hard-delete via `window.confirm` in v1; the trash-bin spec explicitly excludes workspaces. Spec updated with a "Trash-bin coupling" sub-section documenting the tension and the revisit trigger.

Spec updated: `docs/SPECS/workspaces-data-model.md` (top-of-file revision note added; "Workspace Switcher UI" and "Managing Workspaces" sections rewritten; new "Read-only banner on the grid" and "Trash-bin coupling" sub-sections).

---

## 2026-04-26 — Close-* function noop-safety contract

**Contract:** Every `close*` / `hide*` function in `newtab.js` must early-return cleanly when its own state is absent — DOM ref null, state object null, listener handle null, or panel already in the hidden CSS state. After the early-return, the function may freely mutate `sidebarLocked`, manipulate sidebar classes, remove document-level event listeners, or detach DOM elements. Before the early-return (or in the absence of one), the function must not side-effect any state outside its own panel — most importantly, must not reset `sidebarLocked` and must not remove `.expanded` / `.sidebar-locked` classes from `#sidebar`.

This contract exists because two callers invoke close functions speculatively. The generic outside-click handler in `bindEvents` calls every close function on every click outside its panel — it can't know which panels are actually open, so each close function decides whether it has anything to do. Separately, `open*` functions call their corresponding `close*` preventatively at the top of their body (defensive "close any prior instance before opening a new one" pattern). Both call patterns rely on close functions being safe-when-called-as-noop. Idempotent local CSS class operations (e.g., `classList.add("hidden")` on an already-hidden panel) and state nullification (e.g., `activeMenu = null` when already null) are fine and don't require the guard. The guard is specifically for state mutations that affect *other* panels or the sidebar lifecycle.

**Why this is documented now:** [1.0.6] revision 2 hit the broader shape via the generic outside-click handler. A click target that the click handler synchronously detached returned `null` from `e.target.closest(selector)` for every selector, which made the handler conclude "click was outside all panels" and fire close handlers for all of them. Fixed with an `e.target.isConnected` guard at the top of the outside-click handler. [1.0.6] revision 3 hit two functions specifically: `closeWorkspaceDropdown` was called preventatively by `openWorkspaceDropdown` and walked through its `sidebarLocked = false` branch even when no dropdown was open, undoing the lock that `bindWorkspaceSwitcher` had just established; `closeVariantDropdown` was called by the generic outside-click handler for any non-variant click and unconditionally unlocked the sidebar. Both were fixed with state-check early-returns. The audit task captured by Asana 1214280945058706 walked the remaining 22 close/hide functions in `newtab.js` and confirmed they were already SAFE — either explicit early-return guards present (`closeProSettingsPanel`, `closeSettingsPanel`, `closeRestoreDropdown`, `closeHistoryOverlay`, `hideGroupMenu`, `hideSidebarPanel`, `closeSidebarShortcutCtxMenu` via `if (sidebarCtxState)`) or bodies consisting only of idempotent local operations with no global side-effect. The contract is recorded here so future close functions land safe by default rather than depending on a future verification pass to catch the omission.

---

## 2026-04-26 — Goal CRUD on Storage namespace

**API placement:** Goal CRUD lives on the existing `Storage` namespace in `storage.js` (`Storage.createGoal`, `Storage.renameGoal`, `Storage.updateGoalDescription`, `Storage.updateGoalDeadline`, `Storage.completeGoal`, `Storage.reactivateGoal`, `Storage.deleteGoal`, plus the read helpers `getActiveGoals`, `getCompletedGoals`, `getAllGoals`, `getGoalById`). No new `Goals` or `Tasks` namespace was introduced. Reasoning: storage operations belong on `Storage`, and a sibling namespace would split concerns artificially — readers who want to know "where do I create a goal?" already look at `Storage.addGroup` / `Storage.addShortcut` and would be confused if goals lived elsewhere. [1.0.8] task CRUD and [1.0.9] tag CRUD will follow the same pattern (`Storage.createTask`, `Storage.createTag`). Mutating helpers take the full `data` object plus an optional `workspaceId` override (defaults to the active workspace) and persist via `saveAll` before resolving. Read helpers take a workspace directly so callers can iterate across workspaces without re-resolving.

**Cascade hooks present but no-op:** `Storage.deleteGoal` already iterates `workspace.tasks` looking for child records (matching `goalId`) and `workspace.tags` looking for the auto-tag (matching `goal.autoTagId === tag.id`), soft-deleting any matches with the same timestamp. In [1.0.7] those iterations are no-ops because the data types are empty until [1.0.8] / [1.0.9] populate them. The architecture is correct from day one; activation happens organically as later tasks add records, with no further changes to `deleteGoal`. The return shape — `{ goal, cascadedTaskIds: [], cascadedTagId: null }` — is finalized now so [1.0.10]'s "X tasks moved to trash" toast can rely on it without a return-shape migration later. Same idea for soft-delete via `deletedAt`: applied from day one so the Trash Bin UI lands later and immediately has things to display, rather than backfilling tombstones across existing records when the trash UI ships.

---

## 2026-04-26 — Task CRUD with auto-complete / auto-reactivate parent goal

**API placement + rich return shapes:** Task CRUD extends the existing `Storage` namespace in `storage.js`, mirroring the [1.0.7] goal CRUD shape (`Storage.createTask`, `Storage.renameTask`, `Storage.updateTaskDescription`, `Storage.updateTaskDueAt`, `Storage.updateTaskPriority`, `Storage.completeTask`, `Storage.reactivateTask`, `Storage.duplicateTask`, `Storage.deleteTask`, `Storage.moveTaskToGoal`, plus reads `getActiveTasks` / `getCompletedTasks` / `getAllTasks` / `getTaskById`). Same internal-helper pattern: `findLiveTask`, `ensureTasksArray`, `nextTaskDisplayOrder`. `completeTask` and `reactivateTask` return rich shapes — `{ task, goalAutoCompleted, autoCompletedGoal }` and `{ task, goalAutoReactivated, autoReactivatedGoal }` respectively — so [1.0.10]'s UI can fire goal-completion celebration animations without re-querying state. Same precedent as [1.0.7]'s `deleteGoal { goal, cascadedTaskIds, cascadedTagId }`. Rich returns also let the caller distinguish a normal task complete from a "this completed the whole goal" moment, which is the dopamine peak the spec calls out. `[1.0.7]`'s `deleteGoal` cascade activates organically here — `workspace.tasks` now has records, so the existing iteration finds and soft-deletes child tasks with no code changes to `deleteGoal`.

**Symmetric auto-reactivation (lock (a) from today's session):** `reactivateTask` flips a `'completed'` parent goal back to `'active'` whenever the user reactivates one of its tasks. Without this, the system would sit in an awkward "goal is completed but has an incomplete child task" state — visually contradictory and likely to confuse the dopamine moment when the user later re-completes the same task. The reasoning: a goal's completed state is a derived consequence of all-children-complete, so reverting any child should revert the goal. The user can manually re-complete the goal explicitly (via `Storage.completeGoal`) if they want to keep it marked done despite the active child. Both auto-flips are guarded — `completeTask` only flips an `active` goal, `reactivateTask` only flips a `completed` goal — so re-calls don't double-cascade. The flip happens inline (mutating goal in place + single `saveAll`) rather than calling `Storage.completeGoal` to avoid double persistence. Active task selection (top-level `data.activeTask` per `workspaces-data-model.md`) is entirely [1.0.16]'s territory — no `Storage.setActiveTask` here, intentionally.

---

## 2026-04-27 — Tag CRUD with auto-creation on goal + inheritance on task; tag name decoupled from goal name after creation

**API placement:** Tag CRUD extends the existing `Storage` namespace in `storage.js`, mirroring the [1.0.7] goal CRUD and [1.0.8] task CRUD shape (`Storage.createTag`, `Storage.renameTag`, `Storage.updateTagColor`, `Storage.deleteTag`, plus reads `getActiveTags` / `getAllTags` / `getTagById` / `getTagByName`). No new `Tags` namespace was introduced — readers who want to know "where do I create a tag?" already look at `Storage.createGoal` / `Storage.createTask` and would be confused if tags lived elsewhere. Same internal-helper convention as [1.0.7]/[1.0.8]: `findLiveTag`, `ensureTagsArray`, `genTagId`, plus tag-specific `kebabCase` (one-pass goal-name-to-tag-name derivation) and `nextAutoTagColor` (palette rotation). Mutations are async + persist via `saveAll` before resolving; reads are sync. The cross-cutting wiring is a single inline auto-tag block at the end of `createGoal` (shares the goal-create `saveAll` for atomicity) and an inline inheritance block in `createTask` that defaults `tagIds` from the parent goal's `autoTagId` when omitted.

**8-color palette + monotonic rotation rationale:** Auto-tag colors rotate through an 8-color `TAG_PALETTE` constant indexed by `nextAutoTagColor(workspace)`. The count includes both live and soft-deleted auto-tags (`autoGeneratedFromGoalId` is a string, regardless of `deletedAt`). Reasoning: a 30-day trash window means deleted auto-tags can be restored at any point during that window — if the rotation index were perturbed by deletions, restoring a goal could land its tag at a color a different live goal already owns, defeating the point of the rotation. Eight colors gives enough perceptual separation across the wheel for adjacent goals to be distinguishable while staying small enough that the user can mentally associate "blue tags = my first batch of goals" before the rotation cycles back. User color override at goal creation bypasses the palette but does NOT halt the counter — every auto-tag creation advances the rotation, so the next default-color goal gets the next palette index, not the one the override "would have used." This avoids the surprise where overriding a single color silently re-uses the same palette slot for the next default goal.

**Tag name decoupling rule (and tradeoff vs auto-rename):** Tag name is derived from goal name once, at goal creation, via `kebabCase(goal.name)`. Subsequent `renameGoal` does NOT auto-rename the tag. The user can rename the tag manually via Pro Settings ([1.0.9.1]) if they want them to match. Alternatives considered: (a) auto-rename the tag whenever the goal renames; (b) track a `decoupled` flag on the tag that flips true the moment the user manually renames either side, then auto-rename only when the flag is false. (a) was rejected because tags attach to bookmarks and groups too — silently rebroadcasting a tag rename across all of those when the user just wanted to rename the goal would be a surprising side effect. (b) was rejected because tracking the decoupled state adds complexity (one more field, one more set of edge cases when tags get manually edited then the goal gets renamed) for marginal value. The "always decoupled after creation" rule is simpler and respects the user's mental model that tags become independent objects once they exist. Tradeoff: users who rename goals frequently and want their auto-tags to stay aligned have to do a second rename click — accepted because it's an explicit choice rather than an implicit one.

---

## 2026-05-08 — Dodo integration architecture: client-side polling, no backend

**Context:** [1.0.5.1] required locking 5 architectural decisions for the Dodo integration (webhook vs polling, no-card trial mechanism, license key issuance, backend hosting platform, backend storage). Research into Dodo's actual capabilities collapsed these to a single architectural choice.

**Alternatives considered:**
- Serverless backend (Cloudflare Workers / Vercel / Firebase / Deno Deploy) receiving Dodo webhooks, minting or storing license keys, exposing a status query endpoint to the extension
- Hybrid: webhooks for proactive entitlement updates, polling as fallback
- Pure client-side: extension calls Dodo's public licenses.validate() endpoint directly, no backend at all

**Outcome:** Pure client-side. The extension stores the license key in chrome.storage.local after purchase (delivered via Dodo's return_url query parameter), then calls Dodo's public licenses.validate() endpoint once per day to refresh entitlement state. The return URL handler also calls validate() immediately on first redirect, so purchases grant instant access. Trial state is purely local — Dodo only enters when the user converts to paid. No backend, no webhooks, no separate hosting account.

**Reasoning:**
- Dodo's licenses.validate(), licenses.activate(), and licenses.deactivate() endpoints are public (no API key required), specifically designed for client-side calls. Architecturally, they handle exactly the use case we have.
- License keys are natively minted by Dodo when "License Keys" is enabled on a product. Subscription-tied keys auto-expire when the subscription ends and auto-reactivate on renewal — Dodo handles the lifecycle. We don't need to mint or store keys ourselves.
- The no-card trial design (DECISIONS.md 2026-04-24) is incompatible with Dodo's native trial (which is opt-out, card-required). Dodo's own docs recommend handling no-card trials in app state, with Dodo only entering at conversion. This aligns perfectly with our existing data.pro.trialStartedAt / trialEndedAt schema from [1.0.1].
- No backend means: no hosting account to maintain, no webhook signature verification, no retry handling, no operational overhead, no $0-tier-budget anxiety, no separate privacy disclosures for our backend's data handling. Aligns with the "all data local, privacy-first" positioning.
- Decision is reversible: if a future business model (per-seat pricing, usage metering, team accounts) requires real-time entitlement enforcement, adding a backend at that point is roughly 2 weeks of work — not architecturally locked in.

**Trade-offs accepted:**

- Up to 24h delay on entitlement *removal*. The polling cadence is intentionally asymmetric: purchases grant instant access via the return URL handler's immediate validate() call, while cancellations, refunds, failed renewals, and plan changes propagate at the next daily polling cycle. A user who cancels mid-cycle stays Pro for up to 24 hours after Dodo flips their license to invalid. Acceptable because (a) entitlement is binary not metered, (b) the cost per delayed-revocation is bounded at the $4.99/month tier, and (c) revocation is the user-friendly direction to err on (worst case is a paying-feeling user keeps Pro slightly too long, not a paying user is locked out). Mitigated by a "Check license status now" button in Pro Settings for users with payment issues who want to refresh their status immediately.

- "Still says free after upgrade" support tickets are possible if the return URL redirect fails to fire — browser blocks the redirect, user closes the tab too fast, payment completed on a different device, etc. Mitigated by Dodo's automatic emailed license key plus the "Apply existing license" affordance in Pro Settings, which calls validate() and grants access immediately. Orthogonal to the polling-delay trade-off; self-service fix exists.

- No server-side abuse detection (device fingerprinting, IP-based limits). Trial-clearing abuse vector remains, as already acknowledged in DECISIONS.md (2026-04-24 "Free trial: no card required").

- During Dodo API outages or network partitions, the extension's offline grace window (7 days) could expire and downgrade paying users. Mitigated in implementation by distinguishing network errors and 5xx responses from explicit "invalid" responses — only reset the grace timer on successful validations; treat network failures as "stay in current state, retry tomorrow." A Dodo outage extends the grace window rather than punishing paying users.

- Architecture works for binary entitlement (Pro is unlocked or it's not). It would NOT support per-seat pricing, usage-based metering, or team accounts cleanly — those require real-time enforcement via webhooks/backend. Reversible at modest cost (~2 weeks to stand up a backend) if the business model shifts post-launch.

**Supersedes (within [1.0.5.1] scope):**
- Decision 1 (webhook vs polling): polling chosen.
- Decision 2 (no-card trial mechanism): client-side state, no Dodo trial used.
- Decision 3 (license key issuance): Dodo-minted, native feature.
- Decisions 4 and 5 (backend hosting platform, backend storage): dissolved — not needed.

Linked Asana tasks: [1.0.5.1] (planning) GID 1214293491924982, [1.0.5.2] (build) GID 1214627520649678.

---

## 2026-05-09 — Variants are not taggable in [1.0.9.2]

**Context:** [1.0.9.2] introduced `tagIds` on top-level shortcut and group records, with right-click attach UIs and pill rendering. Variants (the child entries inside a parent shortcut's `s.variants` array, surfaced via the dropdown UI) do not participate. The question came up during the round 6 architecture review: should variants get their own tagIds slot, mirroring shortcuts?

**Outcome:** Out of scope for v1. `tagIds` lives on top-level shortcuts and groups only. Variants inherit nothing from the parent shortcut's tagIds (the parent's pills are not visually re-emitted on the variant dropdown rows) and have no independent tag-attach affordance.

**Reasoning:**
- A future "tag variants" feature requires a schema additive on `s.variants` entries and a new render pass for the variant dropdown UI (which today shows only title + favicon + URL, no metadata pills).
- The right-click contextmenu surface for variants doesn't exist as a separate path — variants are surfaced inside the parent shortcut's dropdown, not as standalone shortcut elements with their own contextmenu binding.
- The mental model "tags attach to bookmarks and groups" stays simple. Adding a third taggable entity (variants) without a strong driving use case would just expand the surface area of the tag system without delivering equivalent value.
- Reversible: nothing in the [1.0.9.2] design prevents adding variant tagging later. The tagIds field is a per-record additive, so variants getting their own tagIds is purely additive on top.
- Not planned for v1. Revisit if a Pro user explicitly asks for it after Pro launch.

---

## 2026-05-09 — Sidebar shortcut entries do not render tag pills

**Context:** [1.0.9.2] surfaces tag pills on three places per the original plan: main-grid bookmarks, main-grid group headers, and sidebar group rows. Sidebar shortcut entries (the individual bookmark rows inside an expanded sidebar group) intentionally do not render pills. Round 6 review re-questioned this: would surfacing pills there give users a more complete tag picture across the sidebar?

**Outcome:** Sidebar shortcut entries stay minimal — no pill rendering. The three pill surfaces from the original plan are preserved as-is.

**Reasoning:**
- The sidebar is horizontally constrained. Adding pills next to favicon + title + URL hint would either truncate the title earlier or wrap to a second line, both of which regress the sidebar's information density.
- The sidebar's role is fast navigation — users scan it for a bookmark by title or favicon, not by tag. The main-grid surfaces (bookmark thumbnails, group headers) are where tag-driven discovery happens.
- Tags are visible on the parent group row in the sidebar, which gives the user the "this group is tagged" signal without crowding individual entries.
- Reversible if user feedback indicates the omission causes confusion. The decision is a defaults / UX call, not a constraint imposed by the data model — the rendering function for sidebar shortcut rows can opt in to pills with a one-screen change.
- Aligns with the [1.0.9.2] plan's explicit pill-surface list: main-grid bookmarks, main-grid group headers, sidebar group rows. The plan picked those three deliberately and the round 6 review didn't surface a new reason to expand the list.

---

## 2026-05-09 — Pre-existing missing wire-ups can be bundled with in-flight tasks

**Context:** [1.0.9.2] rounds 2 and 3 surfaced two pre-existing missing wire-ups — the `#groups` container had no `contextmenu` listener (so the main-grid right-click menu was relying on event bubbling from item handlers, which broke in empty-cell areas), and the sidebar's "Add tag" menu item dispatched to a function that never propagated through the menu close lifecycle. Both predated the [1.0.9.2] changes but were uncovered by the new tag attach paths exercising those code paths more aggressively. The question: file a separate Bug task and revert the in-flight scope, or fix both inline as part of the in-flight task?

**Outcome:** Bundling is acceptable when (i) the missing wire-up is in the same surface area as the in-flight work, (ii) the fix is small and surgical (single function or single listener attachment), and (iii) the IMPLEMENTATION comment explicitly notes the bundling and identifies which commit fixes which pre-existing issue. Otherwise file a separate Bug task in the Asana Bugs / Issues section.

**Reasoning:**
- Splitting tightly-coupled fixes creates artificial review surface area. A reviewer auditing "right-click tag attach" naturally walks the entire contextmenu path; making them open a second task to verify the related fix doubles the cognitive cost without any traceability gain.
- The "same surface area" guard prevents this from becoming a blank cheque to fix anything tangentially related. A round-2 fix to the contextmenu listener is in scope for a round-1 contextmenu-touching task. A round-2 fix to drag-and-drop is not.
- Surgical fixes (one listener, one missing classList toggle, one missing close call) are low-risk to bundle. Anything that touches more than ~10 lines or crosses module boundaries deserves its own Bug task with its own audit cycle.
- The IMPLEMENTATION comment requirement makes the bundling auditable — the next reviewer can see at a glance "this commit also fixed pre-existing issue X" rather than discovering the unrelated change while git-blaming a regression.
- Aligns with the existing F1 rule (Context section is preserved) by keeping the conversation history honest: the original plan didn't include the wire-up fix, so the IMPLEMENTATION comment explicitly notes the scope expansion rather than silently broadening the task.

Originating data point: [1.0.9.2] rounds 2 (`3dfcd04`) and 3 (`5e277d4`).

---

## 2026-05-09 — Auto-tag dedup at goal creation; renameGoal does not participate; deleteGoal cascade tightened

**Context:** Round 6 (commit `c48122b`) closed the manual-tag uniqueness gap by tightening `Storage.createTag` and `Storage.renameTag` to reject case-insensitive trim-equal duplicates against active tags. Round 6's IMPLEMENTATION comment explicitly called out that auto-tag creation in `Storage.createGoal` bypasses the new check (auto-tags are pushed directly to `workspace.tags`, not via `createTag`) and flagged that as a separate concern. Round 7 closes that gap.

**Alternatives considered:**
- Reject auto-tag creation on collision and surface an error to the goal-creation flow (rejected — auto-tag creation is a side effect of goal creation, not an explicit user intent; surfacing an error here would block the primary action with a secondary problem).
- Auto-rename the colliding goal's auto-tag to a unique form (e.g., suffix with goal id) (rejected — produces ugly tag names like `work-tasks-goal-abc123` that the user never asked for).
- Skip auto-tag creation on collision but leave `goal.autoTagId = null` (rejected — defeats the auto-tag's purpose, which is to give the goal an immediately-usable tag for child-task inheritance and bookmark filtering).
- Reuse the existing tag on collision (chosen).

**Outcome:** On goal creation with `autoCreateTag === true`, the auto-tag dedup logic scans active tags via kebab-form comparison (`kebabCase(t.name) === kebabCase(goalName)`) and reuses an existing tag on match instead of pushing a duplicate. Manual tags whose case/whitespace happens to render to the same kebab as the candidate auto-tag are matched too — manual `"Work Tasks"` (kebab `work-tasks`) collides with auto for goal `"Work Tasks"` (also kebab `work-tasks`). Soft-deleted tags are skipped. On reuse, the existing tag's `autoGeneratedFromGoalId` is cleared if it was tied to a different goal — the tag becomes "shared, not owned". The `deleteGoal` cascade was tightened in the same round to require `tag.autoGeneratedFromGoalId === goalId` (instead of the prior cascade-by-`goal.autoTagId` shape), so cleared ties mean the reused tag survives both goals' deletions correctly.

**`renameGoal` intentionally does NOT participate:** The 2026-04-27 tag-name decoupling rule established that `renameGoal` does not auto-rename the tag — once the auto-tag exists, it lives an independent life. Round 7 preserves that. Consequence: a goal renamed to a name that happens to collide with an existing tag's kebab does NOT rebind the goal's `autoTagId` to the existing tag, and the original auto-tag is not torn down. The goal keeps its original (now stale, by-name) auto-tag.

**Reasoning for the rename non-participation:**
- Reversing the 2026-04-27 decision in a single round would conflict with the rationale that case originally cited: tags attach to bookmarks and groups too, and silently rebroadcasting tag changes when the user just renamed a goal is a surprising side effect. The same rationale applies to silently rebinding the auto-tag during a rename.
- The auto-tag at goal creation is the only point where the "user implicitly chose a tag name" semantic holds — at rename time, the user's intent is ambiguous (rename the visible goal label vs. also re-link the underlying tag).
- Bookmarks and tasks already attached to the original auto-tag would lose their relationship if the rename rebound the goal to a different tag. Preserving the original binding keeps existing attachments stable.
- Reversible if the user-facing semantics turn out wrong in practice. For now, the safer default is "rename is cosmetic at the goal level; the auto-tag's name is a frozen artifact of when the goal was created."

**Cascade tightening rationale:** The pre-existing `deleteGoal` cascade looked up the tag via `goal.autoTagId` and soft-deleted it unconditionally. That had two latent bugs even before round 7: (a) a goal whose `autoTagId` was set by a caller to an existing manual tag (per the createGoal docstring's "Any `autoTagId` passed in `fields` is preserved as-is" feature) would silently soft-delete the manual tag on goal deletion; (b) shared tags from round 7's reuse pattern would be cascade-deleted by the originating goal's deletion even with other goals depending on them. The tightened cascade — `tag.autoGeneratedFromGoalId === goalId` — fixes both: manual tags (autoGeneratedFromGoalId === null) never cascade, and shared tags (autoGeneratedFromGoalId cleared on reuse) never cascade. Auto-tags strictly tied to the goal being deleted still cascade as before.

**Trade-offs accepted:**
- Stale-rename: user renames goal "Project A" → "Project B" with manual tag "Project B" already existing. Goal's auto-tag stays "project-a" (kebab form of the original name). User who expects the goal-name-to-tag relationship to follow the rename will be surprised. Mitigated by the existing Pro Settings tag-rename UI — user can manually rename the auto-tag to "project-b" if they want them aligned, then deal with the round 6 duplicate-name guard separately (which would block "project-b" if "Project B" exists; in which case the desired behavior is probably "delete my old auto-tag and use Project B" — a manual cleanup step).
- Reused auto-tag rotation drift: `nextAutoTagColor` counts auto-tags by `autoGeneratedFromGoalId` being a string. Reuse clears that field, so the rotation counter can drift downward. In practice this just means the next default-color goal might land on a color that's already used — an aesthetic issue, not a correctness one. Documented here rather than fixed because the rotation comment explicitly accepts deletion-window perturbation as an acceptable failure mode of the same shape.
- Bypass via direct push: any future code that pushes to `workspace.tags` directly (without calling `Storage.createTag` or going through `createGoal`'s auto-tag block) bypasses both the round 6 manual-name guard and the round 7 auto-tag dedup. The round 6 IMPLEMENTATION already noted this for auto-tags; round 7 widens the note to all direct pushes. If a third path appears, the dedup logic should be extracted into a single helper.

Originating data point: round 6 IMPLEMENTATION comment on Asana 1214425856049640, which flagged the auto-tag bypass as a known limitation of the round 6 fix.

---

## 2026-05-09 — Dodo license flow: activate then validate (two-step), client-side, no backend

**Context:** [1.0.5.3] PLAN-stage empirical testing surfaced two corrections to the verified specs from [1.0.5.1]. (a) `test.api.dodopayments.com` does not resolve (DNS failure); the actual hostnames are `https://test.dodopayments.com` (returns `{valid:true}` for test license keys) and `https://live.dodopayments.com`. (b) Dodo's License Keys API is a TWO-step flow per the official docs at `https://docs.dodopayments.com/features/license-keys` (last modified 2026-05-07): activate consumes one of the configured activation slots and returns an `instance_id`; validate is the runtime check that returns `{valid: boolean}`; deactivate frees a slot. All three endpoints are public (no Bearer token), specifically designed for client-side calls. The 2026-05-08 "Dodo integration architecture: client-side polling, no backend" decision already established no backend; this entry locks the two-step shape on top of that.

**Alternatives considered:**
- Validate-only flow (rejected — Dodo's API does require activation before validation will succeed against a fresh license key from a fresh install; without activate, validate would either silently fail or require us to set the product's activation limit to "unlimited" to bypass).
- Validate-only with Dodo activation limit set to "unlimited" (rejected — defeats the deliberate 3-activation-limit configured in [1.0.5.1], which exists to gate license sharing across more than 3 devices per purchase. Removing the limit would erase a built-in anti-sharing mechanism in exchange for one less HTTP call per install).
- Activate-then-validate canonical (chosen) — matches Dodo's documented happy path, preserves the activation limit, gives the Dodo dashboard meaningful per-install activation records for support diagnostics.

**Outcome:** Two-step flow. On first encounter of a license key per Chrome install, `LicenseClient.activate(licenseKey)` is called with `{license_key, name}` where name is `"LaunchPad on {OS}"` derived from `chrome.runtime.getPlatformInfo()`. The returned `instance_id` is stored as `data.pro.instanceId` for later `/licenses/deactivate` calls. Subsequent runs hit `LicenseClient.validate(licenseKey)` directly with a 24-hour debounce on `data.pro.lastVerifiedAt`. One of the 3 per-product activation slots is consumed per Chrome install. `LicenseClient.ensureValidated(data, licenseKey, opts)` is the high-level orchestrator — activate-if-needed, debounce-check, validate, mutate `data.pro` in place.

**Reasoning:**
- Preserves the deliberate 3-activation-limit from [1.0.5.1]. The limit exists as a built-in anti-sharing mechanism — a user who shares a license key with more than 3 devices hits a hard wall via Dodo's API rather than relying on us to detect and act on it.
- Dodo's dashboard surfaces per-install activation records (instance_id, name, created_at). Useful for support: when a user reports "Pro stopped working," we can ask for their email, look up their license, see which 3 devices have active slots, and identify a recent install that consumed the last slot.
- `instance_id` enables /licenses/deactivate from the user-facing customer portal that [1.0.5.4] will wire into Pro Settings. Self-serve slot recovery without our involvement.
- The asymmetric error handling in `ensureValidated` (network / 5xx / unknown 200-with-bad-shape preserves grace; 4xx and Dodo-structured errors flip to invalid) maintains the "Dodo outage extends grace window rather than punishing paying users" property from the 2026-05-08 decision. The 24h validate debounce + 7d offline grace are unchanged from that decision.

**Implications:**
- Extension reinstall consumes a slot. The new install has no prior `data.pro.instanceId` (Chrome storage cleared on reinstall), so `ensureValidated` re-runs activate. The user has 3 reinstalls per product before hitting `activation_limit_reached`. [1.0.5.4] surfaces this error explicitly with a customer portal link so the user can deactivate the dead slot.
- [1.0.5.4] wires Dodo's customer portal URL into Pro Settings as the canonical self-serve path for activation slot management — we don't build our own UI for it.
- `DODO_API_BASE` is a hardcoded constant in `license.js` with an explicit "SWAP TO live.dodopayments.com IN [pre-launch Dodo Live Mode] TASK" comment. No runtime mode flag — keeping the swap point as a single grep target avoids the "did I forget to flip the env var?" failure mode that killed prior projects.
- `host_permissions` in `manifest.json` includes `https://test.dodopayments.com/*` and `https://mylaunchpad.me/*` for [1.0.5.3]. Live mode adds `https://live.dodopayments.com/*` in the pre-launch task, then test.dodopayments.com can be removed if we want a clean live-only build (or kept for in-house QA — TBD at launch time).
- `data.pro` schema gained `instanceId`, `instanceName`, `email` (additive, default null) on top of the existing `licenseKey`, `subscriptionStatus`, `lastVerifiedAt`, `trialStartedAt`, `trialEndedAt` from [1.0.1].

**Originating data points:** Dodo License Keys docs at `https://docs.dodopayments.com/features/license-keys` (last modified 2026-05-07); PLAN-stage empirical testing on 2026-05-09 (DNS-failure observation against `test.api.dodopayments.com`; successful direct fetch against `test.dodopayments.com` and `live.dodopayments.com`). Test license keys captured during [1.0.5.1] smoke tests are reusable for `validate()` integration testing without making new test purchases.

---

## 2026-05-09 — Dodo activation limit: unlimited (revises 3-limit assumption from earlier same day)

**Context:** The same-day "Dodo license flow: activate then validate (two-step), client-side, no backend" entry (above) included reasoning that referenced "the deliberate 3-activation-limit from [1.0.5.1]" and listed "extension reinstall consumes a slot" as an implication. After round 1 of [1.0.5.3] landed and live verification began, Samson switched the activation limit on all three Dodo entitlements (Monthly Pro, Annual Pro, Lifetime Pro) from 3 to "unlimited". The two-step FLOW is unchanged and still correct — activate registers per-device support diagnostics in Dodo's dashboard, validate enforces runtime checks, deactivate stays callable. Only the Dodo-side limit setting changed. Filing as a separate entry rather than rewriting the prior one because the prior entry's flow rationale is still load-bearing — only the limit-related reasoning is superseded.

**Alternatives considered:**
- Keep limit at 3 and ship an "activation limit reached" UI in [1.0.5.4] before launch (rejected — adds critical-path UI work and creates real friction for legitimate reinstallers, who are common: Chrome profile switches, storage clears, no-sync moves between machines all consume slots without anti-sharing intent).
- Drop the activate flow entirely and switch to validate-only (rejected — loses Dodo dashboard diagnostics for support, and removes the customer-portal-deactivation surface that's a natural future affordance).
- Keep activate+validate flow; raise Dodo's limit to unlimited (chosen) — keeps the diagnostics + portal value, removes the scarcity-induced friction at the $5/mo / $59 lifetime tier where the cost-of-friction outweighs the revenue-protection-by-limit.

**Outcome:** All three license entitlements (Monthly Pro, Annual Pro, Lifetime Pro) configured with Activations Limit: unlimited on the Dodo dashboard. license.js code unchanged: activate still runs on first encounter per install and stores `instance_id`; validate still runs daily; deactivate still callable. The unlimited setting is purely a Dodo-side configuration change — no extension-side code touched.

**Reasoning:**
- Chrome extension reinstall realities (profile switches, storage clears, no-sync moves between machines, fresh-install onboarding flows) are common enough that the 3-limit would create steady support burden and user friction without proportional revenue protection at the $5/mo / $59 lifetime tier. The "shared license across 4+ devices" abuse case the limit was protecting against is a low-volume edge case relative to the legitimate-reinstall-tripping-the-limit case.
- The activate flow still earns its keep without the limit: per-install diagnostics in the Dodo dashboard for support investigations ("user reports Pro stopped working" → look up by email → see 5 active instances → identify which one corresponds to the reporting user's current install via instance_name), customer-portal-driven deactivation if [1.0.5.4] surfaces it, and a graceful re-tightening path if license sharing turns out to matter post-launch.
- The earlier PLAN treated the flow and the limit as a package; they aren't. Limit is a runtime tunable on Dodo's dashboard with no code dependency; flow is the architectural choice that determines what code we ship. Decoupling them lets us tune the limit empirically post-launch without code changes.
- Round 1 milestone testing surfaced a phantom-activation friction mode: failed activate calls (e.g., the round 2 201-vs-200 bug, or transient network errors) could still consume slots on Dodo's side while the local code captured no `instance_id` — leaving the user with one fewer slot and no client-side knowledge of the consumption. Unlimited removes the user-visible failure mode entirely. Re-tightening the limit later (if needed) would also need a "reconcile slots from Dodo" code path to surface phantom consumption to the user; that work is now deferred along with the limit re-tightening.

**Implications:**
- [1.0.5.4]'s scope shrinks: the "activation limit reached" error UI and customer-portal-link in Pro Settings become nice-to-have rather than launch-critical. The customer-portal link still belongs in Pro Settings as a user-facing entry point, but it's no longer the primary recovery path for an error users will frequently hit.
- License-sharing detection is deferred to post-launch monitoring. Dodo dashboard activation counts per key remain visible to support, so a "this key has 47 active instances" pattern is detectable manually if it shows up.
- Re-enabling the limit later is a one-toggle change on the Dodo entitlement configuration; no code change needed on the extension side. If we go that route post-launch, the re-tightening work also needs a phantom-activation reconcile (see Reasoning above).
- The prior entry's "extension reinstall consumes a slot" implication is superseded — reinstall still triggers an activate call (so a fresh `instance_id` lands in Dodo's dashboard) but no slot scarcity exists.
- The prior entry's "preserves the deliberate 3-activation-limit from [1.0.5.1]" reasoning point for choosing activate-then-validate over validate-only is superseded — the activate-then-validate choice now stands on the diagnostics + portal-deactivation arguments alone, both of which remain valid.

**Originating data points:** round 1 milestone activation friction (Asana 1214627520649678 round 1 + round 2 IMPLEMENTATION comments); subsequent Dodo dashboard config switch on 2026-05-09.

---

## 2026-05-10 — timeOfDay required-with-default on recurring task templates

**Context:** [1.0.10] commit 2f00d01 landed `Storage.createRecurringTemplate` as part of the Tasks tab layout pass. The PLAN comment for that task specified the recurring template's `timeOfDay` field as a required string. The originating spec doc `docs/SPECS/tasks-and-goals.md` says nullable. The discrepancy surfaced during implementation; this entry locks the chosen reading.

**Outcome:** `timeOfDay` is a required string in `'HH:mm'` 24-hour format. When omitted on `Storage.createRecurringTemplate`, default `'09:00'` is applied at create time. Validation regex `/^([01]\d|2[0-3]):[0-5]\d$/` rejects malformed strings on both create and update.

**Reasoning:**
- The PLAN for [1.0.10] specified `timeOfDay` as required-string. The spec doc `docs/SPECS/tasks-and-goals.md` says nullable.
- [1.0.14]'s alarm sweep needs a time anchor — null would force every downstream consumer to default it themselves, which scatters the default across the codebase.
- Centralizing the default at create time (`Storage.createRecurringTemplate`) keeps validation simple and makes [1.0.14] simpler to implement.
- Required-with-default is a strict superset of nullable — any code expecting a non-null `timeOfDay` continues to work; no caller is forced to handle null.

**Implications:**
- `docs/SPECS/tasks-and-goals.md`'s recurring template schema section should be updated to match (required-with-default, not nullable). Track this as a pre-work item for [1.0.14], or do a one-line spec doc edit before then.
- [1.0.10.1]'s "+ New Recurring" modal can omit a "no time" affordance entirely — the field is always populated, defaulting to a sensible morning anchor.
- Tests / verification snippets that consume recurring templates can rely on `timeOfDay` always being a non-null `HH:mm` string.

**Originating data points:** [1.0.10] commit 2f00d01 (`storage.js` recurring template CRUD; `newtab.js` recurring row rendering); PLAN comment on Asana task GID 1214260745064524.

---

## 2026-05-10 — Auto-tag name remains decoupled from goal rename (re-affirmed)

**Context:** [1.0.10.1] commit 71eafe0's PLAN comment was authored under the [1.0.9] semantic assumption — that an auto-tag's name follows the goal it was created from. The actual rule, locked in DECISIONS 2026-04-27 ("Tag name decoupling rule") and re-affirmed in DECISIONS 2026-05-09 ("renameGoal intentionally does NOT participate"), is that the auto-tag's name is frozen at goal-creation time. CC's [1.0.10.1] implementation correctly followed the existing rule rather than the PLAN, and surfaced the drift in its IMPLEMENTATION comment. This entry exists so the next task that reads back through recent history sees the resolution at the top, rather than re-litigating it.

**Outcome:** Auto-tag name is fixed at goal-creation time. `Storage.renameGoal` repaints the goal card (the displayed pill text re-reads from the live tag store, so it reflects whatever the tag is currently called) but does NOT update the auto-tag's `name` field. Users can manually rename the auto-tag via Pro Settings if they want it aligned with the goal's new name.

**Reasoning:**
- The rule is already established by DECISIONS 2026-04-27 round 7 and DECISIONS 2026-05-09 round 7. Reversing it in [1.0.10.1] would have re-introduced cascading rename surprises across bookmarks, groups, and tasks that share the auto-tag.
- PLAN-vs-implementation drift typically resolves by following the PLAN; in this case, the existing rule is the source of truth and the PLAN was a misread of that rule. The IMPLEMENTATION comment correctly chose the rule.
- The 2026-04-27 rationale ("tags attach to bookmarks and groups too — silently rebroadcasting a tag rename when the user just wanted to rename the goal would be a surprising side effect") still applies verbatim. Nothing in [1.0.10.1]'s scope (Tasks tab interactivity) gives a reason to revisit it.

**Implications:**
- Renaming a goal "Fitness" → "Health" leaves the auto-tag's stored name as "Fitness". The goal card pill renders "Fitness" until the user separately renames the tag.
- Future PLAN comments that touch goal/tag interaction should reference the 2026-04-27 + 2026-05-09 entries directly rather than relying on a remembered description of the rule.
- If a future spec wants rename propagation (opt-in toggle, feature flag, etc.), it must be added as a new explicit feature — not as a silent reversal of the decoupling.

**Originating data points:** [1.0.10.1] commit 71eafe0 IMPLEMENTATION comment (where the PLAN-vs-implementation drift was flagged); DECISIONS 2026-04-27 ("Tag CRUD with auto-creation on goal + inheritance on task; tag name decoupled from goal name after creation"); DECISIONS 2026-05-09 ("renameGoal intentionally does NOT participate" within the auto-tag dedup entry); Asana task GID 1214681339623264.

---

## 2026-05-15 — Notes feature design locked (v1.1 + v1.2)

Decisions made during scoping session for the Notes feature, captured here as the canonical record for future cross-task continuity:

1. **Tier**: Pro-only feature, with free-user Preview Mode (greyed-out tab opens hardcoded demo, non-interactive). Justification: notes reinforce productivity narrative; mixing free notes dilutes Pro positioning.

2. **Release split**: v1.1.0 ships standalone notes. v1.2.0 ships notebooks (organizational layer). Justification: faster v1.1, gives real usage signal before committing to notebook UX, smaller releases easier to ship clean.

3. **Aesthetic**: nostalgic-realistic sticky notes (paper texture, slight rotation, soft shadows, paper color palette, curl effect). Trade-off accepted: style will age with the rest of the UI but provides strong brand identity and instant metaphor recognition. Visual layer can be re-themed later without touching data model.

4. **Layout - v1.1**: full-grid standalone notes. No left column. Notes are absolutely positioned via stored {x,y} coordinates with light grid snap.

5. **Layout - v1.2**: master-detail with left notebook column (1/5) + right content area (4/5). "Standalone Notes" item at top of left column returns to the standalone grid. Persistent "+" drop target at bottom of left column for drag-to-create-notebook.

6. **Notebook deletion**: confirmation modal with two options ("Move notes to standalone" default, vs "Delete notebook and all notes" cascade). Restoration of cascade-deleted notebook restores all child notes inside it.

7. **Trash UI**: Notes tab includes its own trash can icon in the bottom-right corner, acting as the visual surface for the Notes portion of the universal trash bin. Click opens trash view with Restore + Delete Permanently + Empty Trash actions. 30-day auto-purge handled by universal trash-bin spec.

8. **Drag interactions**:
   - Drag note → reposition on grid (or within a notebook)
   - Drag standalone note onto "+" empty target → create new notebook with that note
   - Drag standalone note onto existing notebook → add to that notebook
   - Drag note from notebook view onto "Standalone Notes" item → remove from notebook
   - Drag note onto trash can icon → soft-delete

9. **Promote-to-task / Promote-to-goal**: act as copy by default, with secondary "and delete note" menu option for move semantics.

10. **Task versioning**: Notes work tasks use [1.1.x] versioning, matching the release version directly (overriding earlier [2.0.x] proposal).

---

## 2026-05-15 — Drop lifetime tier: pricing simplified to monthly + yearly only

**Context:** Earlier pricing structure (set 2026-04-24) included a $59 lifetime tier alongside $4.99/mo and $39/year. Reconsidered as billing infrastructure became real (Dodo KYC + Live Mode verified 2026-05-15, payment endpoint configuration about to start). The lifetime tier creates a permanent ongoing-support obligation for a solo dev with no offsetting recurring revenue — asymmetric for an indie-hobbyist project not dependent on launch cash flow.

**Alternatives considered:**
- Keep $59 lifetime as-is (rejected — permanent support tail; undervalued ratio of 1.5x annual cannibalizes yearly conversions disproportionately).
- Time-limited founder lifetime cohort, e.g. first N buyers or first X weeks (rejected — adds tracking/communication overhead at solo-dev scale without launch-cash justification).
- Version-scoped lifetime ("lifetime to Pro v1" with major versions sold separately) (rejected — explicit scoping addresses the obligation tail but adds complexity to license tier definitions and marketing copy; not worth it without a strong reason to keep lifetime in the kit).
- Reprice lifetime upward to industry-standard 3-5x annual ratio ($120-195) to filter buyers (rejected — same underlying obligation issue at smaller scale).

**Outcome:** Pro v1 ships with two tiers only: $4.99/month and $39/year. Lifetime tier dropped entirely. No lifetime tier was ever announced or sold publicly (decision made pre-launch).

**Reasoning:**
- Solo-dev sustainability: subscriber churn is a feature, not a bug — users who stop using LaunchPad stop being a support obligation. Lifetime holders keep the obligation indefinitely.
- No launch cash flow dependency: indie-hobbyist project; the launch-revenue argument for lifetime doesn't apply here.
- Browser extension support tail is real: Manifest version transitions, Chrome API deprecations, and browser update breakage are inevitable cost events. Subscription churn naturally bounds the user base carrying those cost events for paid tiers; lifetime would have left that bound unset.
- Simpler tier structure: cleaner economics, less Dodo configuration overhead, simpler marketing copy.
- The original $59 ratio was undervalued (1.5x annual vs the industry-standard 3-5x), which would have cannibalized yearly conversions disproportionately while still leaving each lifetime sale priced below its long-term obligation cost.

**Supersedes:**
- Lifetime tier references in the 2026-04-24 "Dodo Payments as billing provider" entry's Context section ("lifetime purchases ($59)"). The Dodo entry's core decision is unchanged — Dodo remains the billing provider; only the lifetime-tier portion of its pricing context is superseded.
- The "$5/mo / $59 lifetime tier" framing used in the 2026-04-24 activations-limit entry reasoning. Limit decision itself (unlimited activations on the Dodo dashboard) unchanged.

**Dodo configuration impact (manual, owner action):** The Lifetime Pro entitlement on the Dodo dashboard should be deactivated or archived. Monthly Pro and Annual Pro entitlements unchanged. License.js code unchanged (no lifetime-specific code paths in the extension).

---

## 2026-06-13 — Versioning + release-tagging convention (two-track model locked)

**Context:** Surfaced in the 2026-06-09 backlog reconciliation; resolved after a read-only git fact-find. Two numbering schemes had grown up implicitly and collide visually in 1.0.0–1.0.4; the live store version lived only in memory/CLAUDE.md, never in git tags; the convention was never written down.

**Findings (git fact-find):**
- `manifest.json` = `1.0.4`, frozen since 2026-04-23. Bump history 1.0.0 → 1.0.1 → 1.0.2 → 1.0.4 (1.0.3 skipped — uncommitted-ship incident; 1.0.4 was the recommit). Bumped only at store submissions.
- Pro work runs as an internal marker track `[1.0.5.3]…[1.0.13]` in commit subjects + Asana, never touching the manifest. Subject-marker convention began at `[1.0.9.1]` (2026-04-30), moved to subject-front at `[1.0.9.2]`. `[1.0.5]`–`[1.0.9]` base increments (incl. `[1.0.7]`/`[1.0.8]` CRUD) predate it, no markers.
- Conventional prefixes in use: feat, docs, fix, chore. Only tag in repo: `main-archive`. No release tags for 1.0.0–1.0.4.

**Outcome (locked):**
- Two tracks documented in CLAUDE.md (new "Versioning & Release Tagging" section): store/manifest `X.Y.Z` (manual, store-submission only) vs feature-marker `[X.Y.Z(.W)]` (Pro work units, never touch manifest).
- Commit subjects: feature commits lead with `[X.Y.Z(.W)]` (optional conventional type after); non-feature commits use a conventional prefix with no marker and no bump.
- Historical 1.0.0–1.0.4 collision left as-is. First Pro store release is a deliberate major bump to `2.0.0` to permanently de-collide from the `[1.x.y]` marker track (pre-empts the `[1.1.0]` Notes clash); SemVer (`2.x`) thereafter.
- Release tags: annotated `v<manifest-version>` on the submitted commit, extension repo only, from the next store submission forward. No back-tagging of 1.0.0–1.0.4.

**Reasoning:**
- The marker track is embedded in Asana + commit history + docs; renumbering it destroys traceability for no gain. Documenting the distinction costs nothing and removes the ambiguity.
- A clean `2.0.0` break at Pro launch is the cheapest permanent de-collision and honestly signals the new tier.
- Tagging from now forward closes the provenance gap heading into higher-stakes Pro/billing releases without fabricating unreliable history; 1.0.3's absence makes back-tagging actively misleading.

Complements the Git Configuration section of CLAUDE.md.

---

## 2026-07-07 — Amend one-release model: onboarding redesign ships as free v1.0.5 ahead of v2.0.0; recurring tasks pulled into Pro v1 scope; Pomodoro deferred post-launch

**Context:** The 2026-04-24 "Ship Pro and free tab-bar update as one release" entry concluded "No intermediate v1.0.5." The `[1.0.19]` onboarding redesign PLAN (2026-05-15, Asana GID 1214275063240256) scoped it as a free-tier task shipping independently as v1.0.5, but no DECISIONS entry ever ratified that amendment — the plan and the log disagreed. Separately, ROADMAP listed recurring tasks under Deferred: Pro v2 and Pomodoro under Deferred: Pro v3+, while `[1.0.14]` (recurring instance generation) and `[1.0.18]` (Pomodoro) both sat in the pre-launch Asana chain. This entry reconciles the log to the board on all three points.

**Alternatives considered:**
- Bundle onboarding into v2.0.0 per the original one-release model — rejected: the uninstall rate is a first-run-experience problem affecting free users today, and holding a finished fix costs every install between completion and Pro launch for the price of one store review cycle.
- Pull both recurring and Pomodoro into Pro v1 scope — rejected for Pomodoro: no shipped foundation forces it, it is a commodity feature with no launch-day conversion value.
- Cut recurring from pre-launch — rejected: `[1.0.10]` already shipped recurring template CRUD and the "+ New Recurring" modal, so cutting `[1.0.14]` would ship dead UI.

**Outcome:** v1.0.5 ships as a free-only release carrying the `[1.0.19]` onboarding redesign — no tab bar, no Pro surfaces. The tab-bar-ships-with-Pro principle from 2026-04-24 is unchanged; only the "no intermediate v1.0.5" outcome line is amended. The first Pro store release remains v2.0.0 per the 2026-06-13 versioning entry. Recurring task instance generation (`[1.0.14]`) is Pro v1 committed scope. Pomodoro (`[1.0.18]`) is deferred post-v2.0.0; its Pro Settings placeholder ships as a placeholder.

**Reasoning:**
- A finished first-run fix that reduces churn should not be gated behind an unrelated paid launch; shipping it as a free v1.0.5 is one extra store review for continuous benefit to every new install.
- Keeping the tab bar out of v1.0.5 preserves the 2026-04-24 principle that the tab-bar UI is part of the Pro launch narrative, so v1.0.5 introduces no Pro-shaped surfaces prematurely.
- Recurring is already half-shipped in the UI; finishing generation is cheaper and more coherent than reverting shipped CRUD.
- Pomodoro has a placeholder but no dependency forcing it pre-launch; deferring it keeps the 10-week build shippable without stranding any shipped code.

**Supersedes:** Partially amends 2026-04-24 "Ship Pro and free tab-bar update as one release" — the no-intermediate-release outcome line only, not the tab-bar bundling reasoning, which stands.

---

## 2026-07-07 — Tracking engine ships capture-first: capture + attribution + retention pre-launch, analytics UI v2.1

**Context:** The tracking engine had zero scoped tasks, yet the Pro value proposition names Deep Work Time as its primary metric — the engine is the sole source of that number. The Experience area's Phase 1 was scoped "tracking-light," which left two untenable poles. Launching with no engine guts the paid value proposition: the headline metric would have no data behind it on day one. Launching with a full engine (capture + analytics UI) adds an estimated 3–5 high-risk weeks to the pre-launch runway. This entry scopes a middle path and creates the tasks to build it.

**Alternatives considered:**
- **Full engine + analytics UI pre-launch** — rejected. Longest runway, and the analytics UI cannot be de-risked the way capture already has been: the April prototype (commit `7ff8af8`) validated the capture architecture, but no equivalent prototype exists for the charts, Day Recap content, or badge surfaces. Building all of that on the critical path to launch is the highest-risk option for the least launch-day conversion value.
- **Everything post-launch** — rejected. Tracking data has a hard cold-start: it only exists from the moment the engine runs. Every week the engine is absent is a week of user history that never exists, and Insights would open empty for every launch buyer when v2.1 arrives.
- **Capture pre-launch, analytics v2.1** — chosen. Data accrues from day one; the v2.1 analytics arrive pre-populated with real history rather than a blank slate.

**Outcome:**
- `[1.0.25]` (capture core) and `[1.0.26]` (attribution / aggregation / retention) created, **sequenced BEFORE `[1.0.16]` / `[1.0.17]`** — those tasks' acceptance criteria are engine behaviors, so the engine must exist first.
- One thin user-facing surface — "Today: Xh Ym focused" — folded into `[1.0.20]` (Dashboard shell). No other analytics UI ships pre-launch.
- `Tracking.debugSummary()` console helper for observability during the capture phase.
- Idle detection interval fixed at 60s in v1 (not configurable).
- Per-workspace `trackingEnabled`, default ON, with a visible toggle at workspace creation and in the Pro Settings workspaces list. This **partially supersedes** the 2026-04-24 "Personal workspace default off" mechanic: the per-type default is replaced by visible per-workspace control now that workspaces are generic containers.
- Session records store **domain only, never full URLs.**
- Per-day aggregate keys use the **local calendar day**, deliberately contrasted with UTC-normalized task due dates (the `[1.0.13]` lesson); the contrast is documented in the spec and to be documented in code comments.
- **Achievements redefined:** Consistency and Variety compute on task/goal data; Deep Diver is deferred to v2.1 (it needs tracking analytics). Result: 4 of 5 badges launch.

**Reasoning:**
- Capture is the de-risked half — the prototype already validated the hard part (write-per-event, storage-durable state, orphan reconciliation), so putting it pre-launch buys the cold-start fix at the lowest architectural risk.
- The cold-start property is decisive: it is the one part of the analytics story that cannot be added retroactively. Charts can ship late; the history they chart cannot be back-filled.
- Folding a single "Today" line into the Dashboard gives launch buyers a visible, honest signal that tracking is working, without dragging the full Insights UI onto the critical path.
- Redefining achievements so 4 of 5 launch keeps the badge set coherent without forcing Deep Diver's analytics dependency into the pre-launch build.

**Supersedes:** Partially supersedes the 2026-04-24 Work/Personal tracking-defaults entries — the **default mechanics only** (per-type on/off defaults, replaced by per-workspace `trackingEnabled`). The privacy principle (attribute by tag, store domain only, local-only, no third-party analytics) and the local-only stance are **reaffirmed**, not superseded.

---

## 2026-07-14 — Trash surfaces are per-tab, not a single global panel (lifecycle unchanged)

**Context:** `trash-bin.md` originally spec'd one global Trash panel, opened from an icon next to the Settings cog in the sidebar — a single surface listing deleted bookmarks, groups, goals, tasks, and tags. During the 2026-07-14 Tasks-tab UX iteration (task-row controls + direct trash-delete), restore discoverability surfaced as a real gap: a soft-deleted task had no visible recovery path once its 5-second Undo toast expired. Reviewing the fix, the global-panel model itself was judged unintuitive — recovering a task by navigating away to a different, separate surface breaks the in-context mental model of where the item lives. `notes.md` had already established the alternative pattern: a per-tab trash surface acting as the visual layer over the shared, universal soft-delete lifecycle. This entry ratifies that pattern for the whole system.

**Alternatives considered:**
- **One global Trash panel via the sidebar icon (original spec)** — rejected. Restore happens out of context: the user leaves the surface where the item lived to recover it, which reads as a separate "system utility" rather than an undo of a local action.
- **Per-tab trash surfaces over the shared lifecycle** — chosen. Each surface exposes its own deleted items in place, so recovery stays where the deletion happened; the underlying soft-delete data layer is common to all of them.

**Outcome:**
- **Tasks tab** gets a **Deleted** box beside the existing **Completed** box — two boxes on one row — with per-item Restore, Delete Permanently (confirmed), and 30-day countdowns.
- **Notes** keeps its spec'd per-tab trash can (per `notes.md`).
- The **universal data layer is UNCHANGED**: the `deletedAt` field, 30-day auto-purge, restore semantics, Pro-downgrade rules, and the delete-moment toast with 5-second Undo all stand exactly as spec'd. Only the *surface* model changes — where deleted items are shown and recovered — not the lifecycle beneath it.

**Named deferred gap:** With the global panel gone, **bookmarks and groups (the Home grid) lose their only planned restore surface.** A Home-grid trash surface is an **explicit backlog item, not a silent omission**. Until it ships, free-tier bookmark/group deletes are recoverable only via the 5-second Undo toast at the moment of deletion (the soft-delete + 30-day retention still happens underneath; there is simply no UI to browse or restore it yet). This is called out so the gap is tracked rather than discovered later.

**Supersedes:** Supersedes the **"Trash View UX" surface model** of the 2026-04-24 universal trash bin entry (the single panel opened from a sidebar icon). The **universal-lifecycle outcome** of that entry — soft-delete via `deletedAt`, 30-day retention + auto-purge, restore/cascade/downgrade semantics — **stands unchanged.**

---

## 2026-07-19 — ACTIVE means "this sitting, while present": idle deducts silently, pause deducts loudly

**Context:** The card's headline ACTIVE counter was introduced (2026-07-17) as wall-clock since activation minus paused time, and later session-anchored (2026-07-18) so it stops counting through a closed browser. A live pass then surfaced the remaining hole: ACTIVE kept climbing while the user was **idle**. The tracking engine already closes its session on idle, so FOCUSED TODAY correctly froze — but ACTIVE is pure arithmetic over stored timestamps and had no idle term, so walking away for lunch inflated it. Reported as "task did not auto pause on idle"; the underlying complaint was not that idle should pause (it must not — pause is manual-only and sacred), but that the visible number was dishonest about presence.

**Alternatives considered:**
- **Leave ACTIVE as raw wall-clock, document it as "time since you started"** — rejected. It is the largest, most-looked-at number on the surface; a number that says 6:14 when you worked 40 minutes teaches users to distrust the whole panel.
- **Make idle trigger the manual pause flag** — rejected outright. It would make idle *visible and sticky*: the user returns to an amber PAUSED card they never asked for and must click Resume. It also collides with the standing rule that manual pause survives an idle round-trip, and would blur a user-owned declaration into an automatic one.
- **Idle silently deducts from ACTIVE, mirroring the pause arithmetic** — chosen.

**Outcome:**
- `data.activeTask` gains **`idleAt` / `idleMs`**, deliberately **separate from `pausedAt`/`pausedMs`** so manual-pause semantics, Rule 4 (activation clears pause) and the born-paused shape are untouched.
- The background idle listener additionally maintains them, gated on an active task **and** `!trackingPaused`: idle/locked stamps `idleAt`, active folds `idleMs += now - idleAt`. No-op guarded both ways, one `saveAll` per real transition.
- `ACTIVE = now - max(startedAt, sessionAnchorAt) - pausedMs - idleMs - (paused ? now - pausedAt : 0) - (idleAt ? now - idleAt : 0)`.
- **The two states are deliberately asymmetric in presentation.** Manual pause is **loud** — amber card, pill, row, frozen counter, "PAUSED" label — because it is a user declaration they need reflected back. Idle is **silent** — no amber, no label, no idle indication anywhere — because it is an automatic inference the user did not ask for and cannot act on. The counter simply reads honest on their return. Surfacing idle is a v2.1 consideration, not a gap.
- **No double-deduct:** `setTrackingPaused(true)` folds any pending `idleAt` in the same write before stamping `pausedAt`; the idle listener never touches the fields while paused. The two spans can never overlap.
- The **session anchor** (`onStartup`) resets `idleAt`/`idleMs` alongside the pause accounting, so a pre-shutdown idle span cannot bleed into the new sitting.
- **Engine untouched:** `computeDesired`, `evaluateGates`, session lifecycle and FOCUSED TODAY are unchanged. `computeDesired` reads only `activeTask.taskId`; these fields are display-only. Idle still closes the engine session by its own existing path.
- Legacy records without the fields degrade to zero deduction, the same convention as the `sessionAnchorAt` fallback.

**Supersedes:** Completes the ACTIVE-counter definition begun by the 2026-07-17 dual-counters addition and the 2026-07-18 session anchor. ACTIVE is now **present-time within this sitting** rather than wall-clock. FOCUSED TODAY is unchanged and still answers the other question — honest cross-day attribution, advancing only inside an open session. The April per-task pause model (`isPaused` / `totalPausedMs`) remains superseded.

---

## 2026-07-19 — First-run onboarding: the wizard is removed, the grid teaches itself

**Context:** Install-to-WAU sat around 1 in 5. The first thing a new user met was a three-step modal wizard that could not be dismissed — no close control, no Escape handler, no backdrop click; the two "Skip" links advanced steps rather than exiting, so the shortest way out was three clicks, and closing the tab instead left the completion flag unset so the wizard returned on the next new tab. Behind it sat an empty grid. The 2026-04-25 plan proposed redesigning that wizard. The 2026-07-19 design conversation concluded the wizard itself was the problem: it front-loads explanation onto someone who has not yet seen the thing being explained.

**Alternatives considered:**
- **Redesign the wizard (tighter copy, fewer screens, genuinely skippable)** — rejected. A shorter takeover is still a takeover, and still teaches before there is anything to teach with.
- **Interactive step-by-step tour engine** (coach marks walking the user through the UI) — explicitly rejected for v1.0.5. It is the wizard reborn with more machinery, and it carries a maintenance surface (anchors, sequencing, resumability) far larger than the problem. May return as its own task if lived use demands it.
- **Seed example content and let the grid demonstrate itself** — chosen. First run is a populated grid of obviously-example content that shows the interaction model and asks to be replaced, plus a permanent Tips home. No modal, no tour, no takeover.

**Outcome:**
- **The wizard is gone entirely** — markup, ~275 lines of JS, ~400 lines of CSS, its event bindings, and the POPULAR_SITES chips. No replacement modal of any kind.
- **First-run seeding sits behind the SAME latch**, and the storage key `launchpad_onboarding` is **kept deliberately** rather than renamed. Its semantics move from "wizard completed" to "first-run setup done"; the continuity is the point, because every existing install already has it true and renaming it would re-seed the entire installed base on their next new tab. The flag stays load-bearing: `isFirstRun` is a content heuristic, so without the flag a user who deleted everything would be re-seeded repeatedly.
- **Example content is demo-marked** — `demo: true` on every seeded record, reserved `demo_` group ids — so it can later be identified and removed as an exact set. Nothing else in the codebase writes either marker. Records are fully inert: url, title, timestamps, no analytics or tracking seeds.
- **Clear Examples is gated on owning a real shortcut**, and the gate is a pure reader (`Storage.hasRealShortcut`) computed at render, never event-wired. That is what makes every add path — add tile, right-click, bookmark import, top sites, drag — flip it without being special-cased: no path has to remember to announce itself. It uses `aria-disabled` plus a handler guard rather than the `disabled` attribute, because a disabled button fires no pointer events and the tooltip explaining why it is inert could never appear. Gating on real content makes an empty-grid-via-clear structurally impossible.
- **Import is now permanent** in the sidebar, offering both existing flows. This is not cosmetic: Top Sites import was reachable *only* from the wizard, so removing the wizard would have deleted its only route. (Bookmark import already had three non-wizard callers and survived regardless.)
- **Tips is a permanent sidebar panel** — deliberately a static list for v1.0.5, plus a Restore Examples action and one Pro seed line. No versioning, no what's-new engine, no unread badges.
- **Restore Examples re-runs the same seed**, and is idempotent by construction: `seedDemoContent` no-ops when examples are present, so restore cannot ever produce a second copy.
- **The seed does not write a background.** `loadBackground` already substitutes *and persists* `DEFAULT_BG` when no record exists, and it runs before the seeding check at init — so the wizard's explicit background writes died with it at no loss.
- **New hint/latch state lives in `data.settings`** (the nesting-tooltip convention), with the D2 latch as the sole exception for the migration-safety reason above. `#rc-tip` and the promo toasts are left exactly as they are — no migration, no consolidation.
- **Existing users see zero change** beyond the two new sidebar entries. This was treated as a premise-grade invariant and is asserted in the harness: an existing profile's init performs no write at all and leaves stored data byte-identical.

**Supersedes:** Supersedes the 2026-04-25 plan for this task in full (that plan redesigned the wizard; this removes it). The 2026-07-07 shipping-vehicle ratification stands unchanged — this ships free-tier in v1.0.5 ahead of the v2.0.0 Pro launch, and the manifest bump happens at store submission, not here.

---

## 2026-07-20 — Dashboard is a two-state surface, not a card registry; time-of-day governs card SELECTION only

**Context:** [1.0.20] (Dashboard shell) and [1.0.21] (Start of Day card) were built as one round ("Arc B"). The April plan specified a card registration system: cards declare a time window, the shell walks them in priority order and features the first match. Two audits of the integration surface (2026-07-19) then established that the Dashboard panel was empty, that no end-of-day setting existed anywhere, that there was no public reader for a whole-day focused total, and that the tracking engine's day aggregates are hard-bound to local midnight.

**Alternatives considered:**
1. Build the registry as originally specified.
2. Two states selected by a pure function; build the switcher when a second card actually exists.
3. A 04:00 "day floor" governing both card selection and the reported figures.
4. Recompute figures from raw sessions so a 04:00 day could be reported consistently.

**Outcome:**
- **No registry.** `dashboardPeriod(now, endOfDayMinutes)` returns `"day"` or `"evening"`; the renderer branches on it. There is exactly one card per state, so a selector with one entry per slot is machinery pretending to be architecture. Day Recap (v2.1) builds whatever selection it needs when there is something to select between.
- **Time boundaries govern card SELECTION ONLY.** `data.settings.endOfDayMinutes` (minutes since local midnight, default 1020 = 17:00) plus a named 04:00 night-owl floor decide *which card shows*. Every FIGURE stays local-midnight-based.
- **`endOfDayMinutes` ships before its picker UI**, with a defaulting reader (`Storage.getEndOfDayMinutes`) rather than migration alone — `migrate()` only runs for pre-workspaces data, so already-migrated installs would otherwise read `undefined`.
- **One new public reader on Tracking**, two names over one implementation: `focusedTodayForWorkspace(id)` and `focusedTodayCombined()`, both returning the same `{ baseMs, openSince }` contract as `focusedTodayForTask`. This gives `combinedAnalyticsEnabled` its first consumer and its semantics.
- **Tracking-disabled suppresses the focused line entirely** rather than rendering `0h 0m`.

**Reasoning:** Options 3 and 4 both fail on the same fact — `splitAcrossLocalDays` splits sessions at every local midnight, so the stored aggregates *are* midnight-bounded and no read-time adjustment un-splits them. Option 4 would mean re-deriving totals from raw sessions, i.e. changing the engine's storage contract to move a greeting. Selection-only keeps the engine untouched: between 00:00 and 04:00 the evening card reports the new day's near-zero total, which is honest.

A bare `0h 0m` for a workspace with tracking off says "you did nothing today" when the truth is "nothing was measured" — different claims, and the misleading one is the one the user would act on.

**Also decided, and worth recording because both were found by measurement rather than reading:**
- **"Today" for due-date labels is `Date.UTC(localYear, localMonth, localDate)`** — the user's LOCAL calendar date re-encoded into the UTC-midnight space `dueAt` lives in. Both obvious alternatives are wrong: comparing against a local-midnight timestamp shifts the day for users behind UTC (storage.js:2371), and `utcDay(Date.now())` shifts it for users *ahead* of UTC — in UTC+8 it returns yesterday's UTC day every morning before 08:00, so a task due today would read as due tomorrow. Bali is UTC+8; the second bug was live in the first draft and was caught by a multi-zone harness, not by review.
- **The Dashboard CTA takes its affordance from an OUTLINE, not fill contrast.** Because the card is translucent, its rendered luminance spans the full range across wallpapers (rgb(30,30,30) dark preset, ~rgb(64) over a bright image, near-white on the light preset). Measured, no single fill colour clears 3:1 fill-vs-surface on all three frames — a dark fill passes on light and fails over an image, a light fill does the reverse. A border contrasts against both fill and surface regardless, which is the same answer commits 77fabf7 and 70870ef reached for the row glyph and the ACTIVE state.

**Deferred:** the pulsing "what's on for today" Home-grid button (greenfield sub-feature, not a tweak), the end-of-day picker UI, Day Recap content and all analytics (v2.1 boundary holds).

---

## 2026-07-20 — Achievements: five-badge v1 set (Deep Diver un-deferred), global scope, one-shot celebrations allowed

**Context:** Arc C R1 ([1.0.23]) builds the achievements foundation. Three rulings from the 2026-07-20 design conversation (Samson + Claude) supersede earlier decisions.

**1. The v1 set is FIVE badges, and Deep Diver is UN-DEFERRED.** First Week, Goal Crusher, Deep Diver, Variety, Consistency. This supersedes the **2026-07-07** ruling (recorded in the 2026-07-14 scope-change note) that deferred Deep Diver to v2.1 with the analytics UI. Reasoning: the tracking engine already retains per-day aggregates forever, each carrying `longestSessionMs` (the full un-split session duration). So "a single 2-hour focus session" is computable from a one-line read (`Tracking.maxLongestSessionMs()` ≥ 7,200,000) with NO analytics UI and NO new capture. The thing that blocked Deep Diver turned out already to exist. Marathoner (8h `totalFocusedMs` day) and Curator (50+ shortcuts) are NOT shipped; they are banked here as future badge-pack candidates, and the free Insights preview is trimmed to the five in R2 (preview-is-the-promise).

Locked thresholds: First Week = opened on 7 consecutive local calendar days (no historical open-log exists, so it starts from zero at ship). Goal Crusher = 5 goals completed lifetime. Deep Diver = a single session ≥ 2h. Variety = ≥ 5 distinct tags across tasks completed in a rolling 7-day window. Consistency = ≥ 1 task completed on each of 7 consecutive local calendar days.

**2. Scope is GLOBAL for all five** (supersedes the April 2026 per-workspace framing). Counters, streaks, and reads span every workspace. Deep Diver reads any workspace's aggregates regardless of `combinedAnalyticsEnabled` — that setting governs the Dashboard's focused-today line only, not achievements.

**3. Celebration-doctrine amendment: one-shot unlock celebrations are ALLOWED; persistent gamification noise stays banned.** The original achievements framing rejected the "Duolingo-owl" pattern — no streak-nagging, no persistent counters shouting at the user, no daily-goal pressure. That ban holds for anything PERSISTENT. But a single, dismissible, one-shot recognition at the moment a badge is earned is not that — it is the payoff, shown once, then quiet forever. So: a deferred badge SPLASH on next new-tab open (queued, one per open, CSS-only, auto-dismiss) and an immediate in-place goal-completion celebration are both permitted (R2, [1.0.24]). What remains banned: any surface that keeps reminding the user of streaks/progress after the moment has passed.

**Data-model note (R1):** earned state lives in `data.achievements` (survives export/restore — earned state is precious), read through a defaulting reader (`getAchievements` / `ensureAchievements`) because `migrate()` is a no-op for existing installs — the getEndOfDayMinutes lesson. A one-time retro pass, guarded by a `seeded` flag, seeds the lifetime counter and completion streak from the live snapshot and retro-earns any already-satisfied badge (so existing users' first open after the update earns its splash — the feature demos itself). Retro is honestly purge-lossy: completed-then-purged goals and trashed tasks are gone, so the lifetime counter floors rather than reconstructs — which is exactly why it is persisted from the seed forward instead of recomputed.

---

## 2026-07-20 (R2 amendment) — Goal Crusher is DISTINCT (a set of goal ids), not a transition-counter

**Amends the 2026-07-20 achievements entry above.** R1 shipped Goal Crusher as a persistent counter incremented at each goal-completion transition (per D3's "counter" wording). Samson's Flag-1 ruling (2026-07-20, after the R1 live gate) changes it: **Goal Crusher counts 5 DIFFERENT goals completed lifetime** — a persistent SET of completed goal ids (`data.achievements.counters.completedGoalIds`), not a count of completion events.

**Why:** "crushed five goals" plainly means five *goals*. The transition-counter was farmable by reactivating and recompleting one goal five times; the set is not (the same id adds once). Reactivation still never removes an id (lifetime), and a purged goal's id persists in the set — so the set is the honest lifetime record, added-to at completion and never recomputed.

**Migration:** a seeded R1 record carrying the old `counters.goalCompletions` number is re-mapped once, at read (`ensureAchievements`), by re-deriving `completedGoalIds` from the live completed-goal snapshot and dropping the old field — the same honest-floor snapshot the retro seed uses. An inflated old counter therefore collapses to the true distinct live count (Samson's live record: counter 1 → set of 1).

**Delivery, also locked this round (D8 realized):** badge unlocks queue as `pendingCelebrations` and deliver as a deferred one-shot **splash** on #content at next open — CONSUME-ON-SHOW (the dequeue is persisted before the overlay renders, so a crash between show and dismiss cannot double-play; a missed splash beats a repeated one for a non-critical nicety). Goal completions are the IMMEDIATE type — an in-place sat-sweep on the goal card at the moment of completion, never queued. Both honor `prefers-reduced-motion` with their own fallback (the splash still appears, statically; the goal sweep is suppressed) — none existed to inherit.

---

## 2026-07-20 (R2 amendment 2) — the badge set is SIX: Curator un-banked (stateless), Marathoner the sole banked candidate

**Amends the 2026-07-20 achievements entries above.** After the R2 live pass Samson called the layout: five tiles sit oddly, six make a clean 3x2. **Curator joins the shipped set** ("Organize 50+ shortcuts"), un-banked from the future-candidates note. **Marathoner remains the sole banked candidate.**

**Curator is STATELESS** — its condition is a current count, not a persisted metric: total LIVE shortcuts across ALL workspaces ≥ 50, computed at evaluation time. So it needs no counter, no seed, and no migration; the `data.achievements` record shape is unchanged. Retro is inherent — any user already at 50+ earns on the first open with this build (and gets the splash).

**Counting rule:** a shortcut counts iff neither it nor its group is soft-deleted. **Variants are NOT counted** — an auto-nested domain-alias (e.g. sheets.google.com nested under a docs.google.com parent) is an alias of a shortcut, not an independently-organized entry; counting them would inflate the milestone opaquely. Trashed shortcuts and shortcuts in trashed groups are excluded.

**Evaluated on the DAY-OPENED tick only**, alongside Deep Diver — a 50-shortcut milestone earns at the next open. This matches the accepted Flag-2 next-open pattern and deliberately sidesteps the multi-site shortcut-add problem (the audit found shortcut-add is not a single funnel — background.js reimplements the write inline for the context menu). R3's emit helpers may later add an add-event hook for in-the-moment earning; until then next-open is honest and sufficient.

**Layout:** the live Insights set and the free preview are both six now (the promise and the product match exactly); the `.pp-badge-grid` was nudged from `auto-fit`/`minmax` (which packed 5+1) to a fixed 3 columns (2 on narrow) for the clean 3x2.

---

## 2026-07-19 (option c1; recorded at v1.0.5 packaging, 2026-07-21) — v1.0.5 ships FROM MASTER in TEASER MODE: tab bar + locked Pro tabs stay, the trial CTA is gated off

**Context:** Ratified 2026-07-19 (Asana RELEASE DECISION on `[1.0.19]`, GID 1214275063240256), formally recorded here with the packaging/gating commit per the amendment-ships-with-the-work convention. This amends the 2026-07-07 "free-only v1.0.5, no tab bar" outcome. Master has moved well past the free-only shape the 2026-07-07 entry assumed: the tab bar, locked Pro tabs, preview-mode clicks, the upgrade CTA/popover, and (since that decision) the Dashboard and Insights surfaces (`[1.0.20]`–`[1.0.24]`) are all built. Shipping strictly "free-only" would now mean tearing working surfaces back out.

**Outcome:** v1.0.5 ships **from master** with the tab bar visible, the locked Pro tabs, and preview-mode clicks — the existing `[1.0.4]` greyed-tab pattern, untouched. The **7-day trial funnel is gated OFF** by a single build-time flag, `TRIAL_CTA_ENABLED = false` in `newtab.js`, surfaced through `trialCtaLive()`. When gated, every trial entry point renders an inert "Coming soon" chip instead of a live "Start free trial" control:
- the tab-bar CTA (`applyCtaState` free state) — `.tab-cta-teaser`, `pointer-events:none`, and `bindUpgradeCta` bails;
- the Pro-preview banner CTA (`previewBannerHtml`) — inert chip, no `data-pro-preview-cta` hook so no handler binds;
- the upgrade popover's trial block (`openUpgradePopover` / `popoverTitleForState`) — suppressed, as a defense-in-depth chokepoint.

**Dev builds keep the live CTA:** `trialCtaLive()` returns true when `TRIAL_CTA_ENABLED` is true **or** the build is unpacked (`!update_url`, the same IS_UNPACKED signal as `LP.devPro`/pro-access.js), so only a *packed* build with the flag false is in teaser mode. The flag flips to `true` in **one line** at the v2.0.0 launch to make the trial live everywhere.

**Reasoning:**
- **Why still gate the trial now that Dashboard/Insights have shipped:** the original burn-the-placeholder rationale is partly overtaken by events, but the trial stays gated because **billing is not yet smoke-tested** and the trial funnel (start → 7-day unlock → read-time auto-downgrade → conversion) belongs to the v2.0.0 launch. A user's one 7-day trial is an irreversible per-user resource; spending it against an unverified funnel pre-launch is premature regardless of how finished the Pro *surfaces* now look.
- **Why teaser rather than hide entirely:** "Coming soon" banks the curiosity (the decision's own framing) without offering something we cannot yet honor; hiding the CTA banks nothing.
- **Consequence, not a separate gate:** gating the two free-user entry points makes the upgrade popover — and therefore the Dodo checkout tiers inside it — unreachable for a fresh free install, so no live purchase flow is exposed at v1.0.5 either. The read-only-workspace "Upgrade" banner also routes through the popover but only appears for multi-workspace (Pro) state, which a fresh free install never has.

**Supersedes:** Amends the 2026-07-07 "free-only v1.0.5 (no tab bar)" outcome — v1.0.5 now ships the tab bar and Pro-preview surfaces in teaser form. The 2026-04-24 "tab bar is part of the Pro launch narrative" principle is softened, not broken: the tab bar *previews* ahead of Pro, but the trial/purchase funnel does not go live until v2.0.0. The first Pro store release remains v2.0.0 per the 2026-06-13 versioning entry; the manifest bumps to 1.0.5 at this submission, per that same entry's "store version bumps only at submission" rule.

---

## 2026-07-21 — Insights analytics READERS + board pull forward to v2.0.0 launch (capture-first boundary itself unchanged)

**Context:** Ratified 2026-07-21 (Samson, pre-v2.0.0 launch-fullness ruling), recorded with the implementation commit per the amendment-ships-with-the-work convention. Pro at launch must let people *reference their own work and productivity*: the free preview already promises a 30-day Deep Work chart and a Time by Tag donut, and Pro must deliver those against real data on the Insights tab, not a placeholder. This amends the analytics-UI half of the **2026-07-07 "Tracking engine ships capture-first"** entry.

**What changes:** The analytics **readers** and a **live Insights board** (summary strip, 30-day Deep Work bars, Time by Tag donut, Top Tasks) pull forward from the v2.1 deferral to the **v2.0.0 launch build** (`[2.0]` Insights task, Asana 1216743756248660).

**What does NOT change:** The capture-first *boundary* is unchanged and vindicated. `[1.0.25]`/`[1.0.26]` shipped capture + attribution + per-day aggregation + retention; the aggregates (`totalFocusedMs`, `byTag`, `byTask`, `longestSessionMs`) have accrued since then and are kept forever, so the board arrives **pre-populated with real history** rather than blank — exactly the cold-start property the 2026-07-07 entry protected. No capture path is touched by this work; the board is pure new read contracts on `Tracking` plus render.

**Outcome (design locked with Samson 2026-07-21, Q1–Q4):**
- **Three new exported `Tracking` readers + one helper**, all in the `focusedTodayForScope` mould (deliberate contracts, one `readDays()` each, no UI reach for `_readDays`): a per-day focused-range reader, a windowed `byTag` rollup, and a windowed `byTask` rollup — the two rollups keyed on the **(workspaceId, tagId/taskId) tuple**, never a bare id (the Variety namespacing rule). `lastNLocalDayKeys(n)` builds the window on `localDayKey`/`startOfLocalDay`. Today's open-session share folds into the range reader by **composing** `focusedTodayForScope` (the across-midnight clamp stays in one place).
- **One scope for the whole board** (the Dashboard `combinedAnalyticsEnabled` convention verbatim). **Per-card suppression (Q1):** in per-workspace mode with tracking disabled, the tracking-derived surfaces are absent entirely (measured-nothing is not did-nothing); the Achievements card always renders. Combined mode ignores per-workspace disabled flags; global `trackingPaused` never suppresses.
- **Asymmetric orphan handling (Q2):** minutes owned by trashed/purged tags/tasks survive in the aggregates forever (`tracking_days` is never swept). The donut buckets orphaned tag minutes into a single **"Deleted tags"** slice (the ring must not lie about the total); Top Tasks **drops** orphaned task ids silently (an unnameable rank is noise — the minutes still count in every total).
- **No cross-workspace tag merging (Q3):** same tag *name* in two workspaces stays two slices; combined mode adds a workspace suffix to the legend.
- **Donut-cannot-lie:** the ring denominator and the center label are both the sum of the drawn segments. With no multi-tag sessions, `Σ tag buckets ≤ scope total` and that sum **equals** scope total (an "Untagged" remainder fills the gap) — the exact "Untagged + Deleted + live === scope total" invariant. Because `byTag` credits a multi-tag session's minutes to *each* of its tags (`attributeSession` unions bookmark + task tags), `Σ tag buckets` can exceed scope total; then Untagged clamps to 0 and the center reflects the ring's real drawn total rather than understating it. The donut never sums to a number other than its own center label.

**Reasoning:** The blocker the 2026-07-07 entry named for the analytics UI — "the charts cannot be de-risked the way capture was" — is materially smaller now: the preview's SVG constructions are production-styled and parameterizable, the aggregates exist and are proven, and the board is static (no tooltips/interactivity in v1). The remaining risk is read-shape + resolution correctness, which is console/VM-verifiable against the real modules. Day Recap (the evening Dashboard card) remains a follow-on task sharing these same readers.

**Supersedes:** Amends the **2026-07-07** entry's "analytics UI v2.1" outcome — the readers and this board move to v2.0.0. The capture-first sequencing, the cold-start reasoning, the privacy stance (domain-only, local-only, no third-party analytics), and the local-calendar-day aggregate basis are all **reaffirmed**, not superseded.

---

## 2026-07-21 — Day Recap ships at v2.0.0 (the last v2.1 analytics deferral consumed for launch)

The evening Dashboard card's future-update teaser is retired: it now shows real today-scoped recap figures (focused total, most-focused task, longest session, top tag) built on the Insights board's windowed readers plus one small `longestSessionForScope`. Follows the 2026-07-21 Insights amendment above — the same pull-forward reasoning (the readers exist, the risk is read-shape correctness, the surface is calm prose with no new charts). This consumes the last analytics item that the 2026-07-07 capture-first entry had deferred to v2.1; capture-first itself remains unchanged and vindicated (the recap arrives pre-populated). Task 1216745591530862.

---

## 2026-07-22 — "Focus session" is the user-facing name; duration is a sticky, point-of-use choice

**Context:** Locked with Samson after the `[1.0.18]` Round A1 lived-use pass (Asana 1214260527650518, PLAN ADDENDUM). Two findings from his hands-on session: the "Pomodoro" button was unclear — *the builder himself read it and asked where the focus limit was* — and there was no duration control at the point of use, so changing session length meant a trip to Pro Settings.

**Alternatives considered:**
- **Keep "Pomodoro" in the UI** — rejected. It names the *technique*, not the function. If the person who built it has to ask what it does, a cold user has no chance.
- **Rename internal identifiers too** (`pomodoro*` functions, storage keys) — rejected. Pure churn risk for zero user-visible benefit.
- **Per-session one-off duration** (pick a length for this session only, don't persist) — evaluated and deferred until lived use demands it. The button should promise what it will actually do next time.

**Outcome:**
- **D9 NAMING — "Focus session" replaces "Pomodoro" in ALL user-facing UI:** button, card/pill strings, toasts, the Pro Settings section title. Phase labels stay **Work / Break / Long break**; the ring label becomes **FOCUS** (E3, entry below). **Internal identifiers are NOT renamed** — `pomodoro*` function names, storage keys and `data.settings.pomodoro` are untouched, so the rename carries no refactor risk. **"Pomodoro" survives in marketing copy** as the name of the technique. The task marker and name are unchanged.
- **The unification is deliberate and forward-looking.** When `[1.2.0]` lands, site blocking is presented as a *property of a focus session* ("block distracting sites during focus") plus its arm toggle — one concept, one word. F1's auto-arm coupling makes that reading natural; two names would have made it two features.
- **D10 DURATION AT POINT OF USE — STICKY:** the start control reads `▶ Focus session · {workMin} min`; the duration segment is tappable and reveals preset chips **5 / 10 / 15 / 25 / 45 + Custom**. Picking a chip **persists** through the existing `setPomodoroWorkMin` (clamped 5–60, custom input clamped identically), so the button always shows what it will do next time. Pro Settings remains the home for break lengths and cycles.

**Shipped in:** `29bbb07` (Round A2).

---

## 2026-07-22 — A focus session ENDS: the break auto-starts, the next work phase never does

**Context:** Locked with Samson after the Round A2 lived-use pass (Asana 1214260527650518, PLAN ADDENDUM 2). The contradiction was one we created in a single day: **P3** of the 2026-07-22 v2.0 design lock specified auto-advance `work → break → work` forever, locked under the "Pomodoro" framing; **D9** (entry above) then renamed the feature a *Focus session* — and a session is something you start and **finish**. A timer that silently puts you back on the clock is a treadmill, not a session. The sharper stake is downstream: `[1.2.0]` auto-arms site blocking during work phases (F1), so an auto-looping work phase would **re-block the user's sites indefinitely without consent**.

**Alternatives considered:**
- **Keep P3's endless loop** — rejected. Treadmill semantics, and a consent violation the moment blocking couples to the work phase.
- **Require explicit user action at BOTH boundaries** (confirm the break too) — rejected. Resting needs no decision; a prompt to start a break is friction that buys nothing.
- **Asymmetric: break automatic, work explicit** — chosen. The asymmetry *is* the decision: consent is required only where the machine would otherwise put you back to work.

**Outcome:**
- **E1 SESSION SEMANTICS (supersedes P3's loop, refines D3):** work-phase end → the break starts **automatically**. Break end → the session **COMPLETES**: phase cleared, `cycleCount` kept, and the card shows a session-complete state — *"Session done · cycle {n} of {cyclesBeforeLongBreak}"* — with a one-click **▶ Start next session** that begins the next work phase (long-break cadence math unchanged). **Work never begins without explicit user action**, so when `[1.2.0]` lands, blocking can never re-arm without consent.
- **Graceful expiry (D3) is unchanged** for unattended boundaries.
- **Session-complete is a display state, not a stored phase.** `phase: null` + `cycleCount > 0` already encodes it; the render distinguishes "stopped by user" from "completed break" via a small transient flag that survives re-render but need not survive a task switch.
- **E2 COPY — focus is the protagonist, not the break:** work-phase end → *"Nice — {workMin} min focused. Break time."*; break end → *"Session complete — ready for another?"*; the expiry toast is unchanged (*"Focus session ended while you were away."*).
- **E3 RING LABEL:** `WORK` inside the ring becomes `FOCUS`. Phase text labels elsewhere stay Work / Break / Long break.

**Supersedes:** the endless-loop clause of **P3** in the 2026-07-22 v2.0 design lock (recorded on Asana 1214260527650518). The rest of P3 — auto-advance mechanics, the gentle boundary cue, pause always available — stands unchanged.

**Shipped in:** `1627003`, with the modular cycle-position display in `b3d3048`.

---

## 2026-07-22 — Backup: sync-based approaches shelved; `[1.3.0]` EXTENDS the shipped export/import rather than building one

**Context:** Asana 1216777305263735. `chrome.storage.local` does **not** travel with Chrome Sync, so a bricked or lost machine means total loss of layout, workspaces, tasks, goals and all accumulated tracking history. The license survives (key + email + unlimited activations); the data does not. This is the highest-blast-radius failure mode for the most invested users, and it grows with every day of accrued tracking data. A same-day premise correction reshaped the scope: the v1.0.5 store-build spot-check showed the shipped **free** build already has **Settings > Backup** with Export/Import covering shortcuts, groups, settings and background. The gap is **coverage**, not existence.

**Alternatives considered:**
- **(a) Full `chrome.storage.sync`** — REJECTED. ~100 KB total, 8 KB per item, throttled writes: orders of magnitude below the `data` blob plus the tracking stores. A dead end, not a trade-off.
- **(b) Hybrid partial sync** (layout essentials only) — REJECTED as the primary answer. Custom icons stored as data URLs blow the 8 KB item limit unpredictably; a partial restore ("shortcuts came back, goals vanished") reads to the user as a bug, not a feature boundary; and sync transits Google's servers, fraying the "nothing leaves the machine" posture. **One narrow slice survives as a later enhancement:** settings + license key via `storage.sync`, so a reinstall recovers Pro status and preferences instantly.
- **(d) Cloud backup to the user's own Drive/Dropbox** — REJECTED. OAuth and identity infrastructure, plus a real privacy-posture hit. Not this product.
- **(c) Local export/import** — CHOSEN, and rescoped to *extend* what already ships.

**Outcome:**
- **`[1.3.0]` extends the existing free export/import to full coverage**: `data` + `tracking_sessions` + `tracking_days` + license key, schema-stamped and versioned, validated and migrated on import. **Import of old partial-format backups must keep working** — backward compatibility is a requirement, not a nicety.
- **Export stays FREE.** Exporting your own data is a right; "pay to not lose your stuff" contradicts the respectful brand.
- **The Pro layer is AUTOMATION, not access** — periodic auto-export via `optional_permissions: ["downloads"]`, runtime-requested on toggle-ON, default OFF, zero install warning (the same pattern as the focus-session notifications, 2026-08-02 entry below). The quiet superpower: most consumers' Downloads/Documents folders are already synced by OneDrive/Google Drive/iCloud, so an auto-exported snapshot lands off-machine **with the extension never touching a cloud API**.
- **A pre-pickup AUDIT maps the existing implementation** (format, versioning, exactly what is serialized, import validation) before any PLAN. The task's original "build from scratch" framing is superseded by its own premise-correction comment.
- **Timing:** post-v2.0 launch, slotted early in v2.1.

**Do not relitigate the sync options.** (a) and (b) were evaluated on the numbers and the posture, and both fail on both.

---

## 2026-08-02 — The notifications toggle is the fork in boundary semantics

**Context:** `[1.0.18]` Round B PLAN (B1), locked with Samson. Flagged in advance by the E-series entry as the first design question of Round B, not an implementation detail: with notifications ON and no tab open, *something* has to happen at a phase boundary, and the three candidate behaviors are not equivalent.

**Alternatives considered:**
- **Notify without advancing** — rejected. The notification announces a break that has not started. It lies.
- **Always advance regardless of the toggle** — rejected. Silent background phase churn the user never consented to — the treadmill again, wearing a different hat.
- **Fork the semantics on the toggle** — chosen. The alarm *is* the consent for background operation.

**Outcome:**
- **Notifications ON:** the service-worker alarm **PERFORMS** the transition with no tab open. Work-end fires the break notification **and starts the break**; break-end fires *"Session complete — ready for another?"* **and** sets the session-complete marker, carrying one action button (**Start next session**) that begins the next work phase without a tab. The user opted into an ambient timer that runs while they work elsewhere.
- **Notifications OFF:** today's behavior exactly — page-side only, graceful expiry when unattended.
- **GRACE UNIFORMITY:** the SW advance obeys the same `GRACE_MS` (90 s) window as the page. An alarm that fires late beyond grace (sleep, suspend) means the boundary passed unattended → **quiet expiry per D3**: no notification barrage, no catch-up cascade, the user returns to an expired card. Notifications ON changes behavior **only for on-time boundaries**. Honesty is preserved in both directions.
- **Sound is an independent control** (Pro Settings ships a separate picker), but the alarm exists **iff** notifications are ON — so a sound-only user with no tab open simply hears nothing, and expiry applies as before. Documented, not a bug. Expiry itself is **always silent**: an unattended timeout is not an achievement.
- **The SW-initiated write path routes through `enqueueBgData`** (BUGS.md Section L). Playback is fired *after* the queued section returns, so holding the worker alive for a second of audio cannot stall unrelated background `data` writers.

**Shipped in:** `65711b6` (B-1, notifications), `a7cf131` (B-2, chimes).

---

## 2026-08-08 — Pill honesty: FOCUSED TODAY becomes the headline, ACTIVE becomes an "active since" timestamp

**Status: DECIDED, NOT YET IMPLEMENTED.** Asana 1217301162748887 (Backlog), candidate pre-v2.0-launch polish.

**Context:** Samson's live-use finding, 2026-08-08: ACTIVE displayed **139:52:01** — roughly six days of wall clock — because Chrome had never cold-started. Sleep/lid-close habits plus background-apps mode mean the browser process can live for weeks, and the session anchor only resets on a true process restart. The number was working exactly as designed (2026-07-19, "ACTIVE means this sitting, while present") and was still useless: technically true, practically meaningless. It fails the product's own honesty standard on the flagship surface.

**Alternatives considered:**
- **Day-bounded ACTIVE** (roll at midnight) — rejected. Honest and cheap, but still *slot time* rather than work, and redundant the moment FOCUSED TODAY is the headline.
- **A "time while browser window open" accumulator** — rejected. A third metric that neither measures work nor stays cheap: it needs service-worker heartbeat machinery under MV3 and converges on a worse version of the number the tracking engine already produces.
- **Promote the number that is already accurate** — chosen. The fix is prominence and honesty, not machinery.

**Outcome:**
- **The pill/card leads with FOCUSED TODAY** as the big headline number — engine-measured, engaged-time-only, restart-proof. It is the number Pro actually sells.
- **ACTIVE stops being a running counter entirely.** It becomes a quiet static line — *"Active since Aug 2, 9:04"* (activation timestamp; exact copy at the implementation PLAN). A timestamp cannot accumulate into absurdity: it is honest at any age, with zero new machinery.
- **FOCUSED TODAY's old small slot goes away** — one number, one place.
- **During a running Focus session the pomodoro display still takes over the face**, exactly as today. `[1.0.18]` behavior is unchanged.
- **Optional scope at pickup:** with no running ACTIVE counter, audit what the session-anchor machinery (`onStartup` anchor write, the cold-start fix path) still serves. If the pill was its only consumer it may be removable — but verify nothing else reads it (Day Recap, Insights, Dashboard) first. Removal is optional, not required.

**Amends:** the **2026-07-19** ACTIVE entry. That entry's *definition* of ACTIVE — present-time within this sitting, idle deducted silently, pause deducted loudly — stands and was never the problem; what changes is its **presentation**, from a running counter to a static timestamp. The 2026-07-18 session anchor and the 2026-07-17 dual-counter framing are amended in the same way.

---

## 2026-08-09 — `[1.2.0]` Focus Blocking shipped: the gate is a door, not a wall

**Context:** Second of the v2.0 launch trio (Asana 1216776953648220). A gentle block-page for a small user-managed domain list, active only while focus is armed. Built over four rounds — R1 storage foundations (`b6fa2b6`), R2 intercept + gate page, R2.5 transport change, R3 pill toggle (`c4f8d83`) — after a read-only audit (A1–A7) and a measurement round that never merged.

**Alternatives considered:**
- **`declarativeNetRequest`** — rejected on three independent blockers, any one of which is fatal: it adds an install-warning permission (the launch constraint forbids it), its rules are static relative to the arm/snooze state that changes second-by-second, and a redirect rule cannot carry the per-navigation context the gate page needs to say anything true.
- **Block silently / show Chrome's error page** — rejected. A block the user cannot see the reason for is indistinguishable from a broken network.
- **A hard wall with no escape** — rejected. The product's whole posture is accountability without surveillance; a block you cannot leave is a punishment.

**Outcome (C1–C10):**
- **The gate is a real extension page** (`gate.html`/`gate.js`/`gate.css`) — the first navigable one in the extension — carrying the blocked host, the focused-time-on-task figure, a **snooze**, and an **end-focus** exit. It refuses any `?to=` that is not `http(s)`.
- **Two arm states, one predicate.** Manual arm and auto-arm-during-work-phases resolve through a single `focusBlockingActive` reader, so the pill, the settings row and the intercept can never disagree.
- **The decision chain is ordered cheapest-first and short-circuits**: Pro access → blocking active → domain match → no active snooze. Anything else returns before touching the block list.
- **A never-block list is hard-coded** (`mylaunchpad.me`, `live.dodopayments.com` and subdomains) so a user can never block themselves out of checkout or license recovery.
- **Counters are capture-first**: blocks and snoozes accrue per local day from launch, reusing the achievements day-key helper, so the analytics surface arrives pre-populated whenever it ships.
- **The pill carries the Focus toggle and an armed indicator** (R3); the free tier inherits the pill's existing full hide and renders no focus row at all.

**Favorable behavior worth recording:** a navigation that never commits (dead host, DNS failure) still shows the **gate**, not Chrome's error page — the intercept fires before commit, so the user gets the honest message instead of a network error for a site that was blocked anyway.

**Shipped in:** `b6fa2b6` (R1), R2, `f750170` (R2.5), `c4f8d83` (R3).

---

## 2026-08-09 — The F2 amendment: interception moves to `webNavigation`, and the zero-warning constraint survives a permission ADDITION

**Context:** R2 shipped the intercept on `chrome.tabs.onUpdated`, chosen in the audit because it needs no permission beyond what the extension already had. The pre-PLAN measurement round had probed the flash and concluded there was none. **That conclusion was wrong, and the way it was wrong is the point of this entry.**

**Alternatives considered:**
- **Keep `tabs.onUpdated` and accept the flash** — rejected once it was measured on shipped code. `changeInfo.url` fires **post-commit**: the blocked page has already begun painting when the listener runs, so the user sees a flash of the site they asked to be blocked from. That is not cosmetic; the whole feature is about not seeing the thing.
- **Session-cache mitigation** (remember recently blocked hosts to shorten the hot path) — rejected. Measured, and the saving was inside the noise: the flash is structural, caused by *when* the hook fires, not by how long the decision takes.
- **`webNavigation.onBeforeNavigate`** — chosen. It is a **pre-commit** hook, so the redirect happens before the blocked page paints at all.

**Outcome:**
- **Transport changed, logic untouched.** R2.5 replaced the listener and nothing else; the decision chain, the never-block list and the gate page are byte-identical. The other three `tabs.onUpdated` listeners (checkout-return, tracking, favicon) were verified unchanged by diff.
- **`onHistoryStateUpdated` and `onReferenceFragmentUpdated`** are registered alongside, so SPA route changes into a blocked host are caught too.
- **The zero-install-warning constraint held through a permission addition.** `webNavigation` normally adds a browsing-history warning — but the extension already declares `history`, which carries the broader warning that **absorbs** it. Verified the honest way: two loadable variant builds compared in Samson's real Chrome, permission list against permission list. A doc claim would not have been evidence.
- **Final authority stays with the Web Store dashboard** at the v2.0.0 upload, which shows the actual install bubble users will see. The variant comparison is strong evidence, not the last word.

**Amends:** the MEASUREMENTS round's "no flash" finding. **The operative rule this leaves behind:** a probe measures a probe. The implementation re-measures its own shipped code, and where the two disagree the shipped measurement wins and the probe's conclusion is retracted in writing rather than quietly dropped. See BUGS.md **P4** for the probe-fidelity candidate cause.

---

## 2026-08-09 — The nest matcher stays literal: no subdomain or `www.` collapsing

**Status: CONFIRMED TWICE by Samson on 2026-08-09.** Do not relitigate without new user data.

**Context:** Two reports — auto-nest not firing, and drag-to-nest "no longer" nesting same-domain tiles — were both investigated at runtime and both proved to be **original behavior, not regressions**: the matcher compares hostnames literally, so `mail.google.com` and `google.com`, or `www.x.com` and `x.com`, have never been the same domain to it. A v1.0.5 worktree comparison confirmed the behavior is unchanged since before the Pro work began.

**Alternatives considered:**
- **Collapse `www.` and/or registrable-domain-match** — rejected. It would introduce a **fourth** domain-matching semantic beside the three the codebase already carries, and it silently merges tiles the user deliberately kept apart. Convenience bought with unpredictability.
- **Leave it and say nothing** — rejected. The real defect was never the matcher; it was that a refused drag **looks identical to a bug**, because nothing tells the user why.

**Outcome:** the matcher stays exactly as-is for both auto-nest and drag-to-nest. The genuine gap — **silent refusal** — is resolved separately by a refusal toast (Asana 1217317549419902), which fixes the user's experience without changing what "same domain" means.

---

## 2026-08-09 — `.pro-section-subtitle` on light wallpapers: accepted as-is

**Context:** Repeated ink measurement passes keep surfacing `.pro-section-subtitle` as the lowest-contrast text on a light-solid wallpaper. It has been re-measured and re-reported in several rounds' ink tables.

**Outcome:** **Samson's eyeball verdict, 2026-08-09: accepted as-is.** It reads fine in use, and the deliberate de-emphasis is doing its job. Ink tables from here on report it as **known-accepted** and do not re-flag it as a finding.

**The general rule this sets:** *inheriting* a known-accepted contrast deficit is a decision and needs no re-litigation; *deepening* one — stacking extra opacity or a lighter token on top of it — is a defect. See BUGS.md **O3**.

---

## 2026-08-09 — `[1.2.1]` Time-by-Site shipped: no favicons, ever

**Context:** Third of the v2.0 launch trio (Asana 1216776761472404). One reader plus one Insights card showing top domains over the same 30-day window as the rest of the board.

**Alternatives considered:**
- **Favicons beside each domain row** — rejected, **absolutely and permanently**. These rows come from *browsing* data, so fetching an icon for one transmits the user's browsing domains to a favicon service. That is the exact thing "nothing leaves the machine" forbids, and no amount of caching makes the first request not happen. Text rows only.
- **Collapse `www.` / alias domains for a tidier list** — rejected, for the same reason as the nest matcher above: a fourth matching semantic, and a display that no longer says what was measured.
- **A separate windowed reader written to match its siblings** — rejected in favour of reusing the shared rollup spine, so the three readers are identical **by construction** rather than by imitation and cannot drift apart.

**Outcome:**
- **`byDomainForScope` lives in the tracking engine**, beside `byTagForScope` and `byTaskForScope`. A reader over the engine's own aggregates is the **engine's own contract**, not a consumer reaching into private state — this is explicitly *not* the Section-H prototype-boundary concern.
- **Raw hostnames displayed exactly as captured.** `www.reddit.com` renders as `www.reddit.com`; `x.com` and `www.x.com` stay separate rows because they were measured separately.
- **Both board lists aligned at 6 rows** (Samson, on the eyeball pass) — Time by site sits directly above Top tasks, and a one-row asymmetry between neighbours reads as an accident. `12a7fb4`.
- **Zero new CSS**: the card reuses the Top Tasks row classes rather than cloning them under `site-*` names, so the two lists cannot drift and the new rows inherit ink that was already measured.

**Shipped in:** `1e19b5d`; row count aligned in `12a7fb4`.

---

## 2026-08-09 — `[1.2.2]` date-range selector filed, with the 30-day retention horizon as its honest constraint

**Context:** Samson's ask on seeing the finished board: every Insights card is hard-wired to "last 30 days", and the natural next question is "what about last week / this month / last quarter?"

**Outcome:** filed as `[1.2.2]`, post-v2.0. **The constraint is recorded with the ask, not discovered during the build:** per-event granularity is retained for 30 days and only **per-day aggregates** are kept beyond that (DECISIONS 2026-07-07, SPECS/tracking-engine.md). So ranges *shorter* than 30 days and ranges built from day aggregates are free, while anything needing per-event detail beyond 30 days does not exist and cannot be back-filled. A range picker that silently offers "last 6 months" over data that only began aggregating at launch would be the pill's honesty problem in a new place. The PLAN decides which ranges are offered and how the horizon is communicated — it does not get to assume the data is there.

---

## 2026-08-10 — Pill redesign: FOCUSED TODAY is the headline, ACTIVE becomes a timestamp

**Context:** Live use, 2026-08-08 — the card's ACTIVE counter read **139:52:01**. Nothing was broken: ACTIVE measured the current *browser sitting*, the session anchor only moves on a true `chrome.runtime.onStartup`, and with sleep/lid-close habits the browser process had simply not restarted in six days. The number was correct and useless — exactly the kind of technically-true-but-meaningless figure the product's honesty standard exists to prevent.

**Alternatives considered (Samson chose option c of three, 2026-08-08):**
- **Day-bounded ACTIVE (midnight roll)** — rejected. Honest and cheap, but still "slot time" rather than work, and redundant the moment FOCUSED TODAY takes the headline.
- **A "time while browser window open" accumulator** — rejected. A third metric that measures neither work nor anything cheap: it needs SW heartbeat machinery under MV3 and converges on a worse copy of the engine's own number.
- **Prominence, not machinery** — chosen. The accurate number already existed one line below, demoted to a small secondary row.

**Outcome:**
- **FOCUSED TODAY takes the headline slot** (`.sat-time`), on the idle card, on the minimized pill face, and on the session-done card. The engine's reader and the existing formatter are unchanged — only the source of the headline moved.
- **The old small "focused today" row is gone.** One number, one place; a headline and a secondary row showing the same value is duplication, not reinforcement.
- **ACTIVE is deleted as a counter** and replaced by a quiet static line: `Active since 9:04` when the activation is today, `Active since Aug 2, 9:04` when it is older. A timestamp cannot accumulate into absurdity, and the date appears exactly when a bare time would mislead.
- **`startedAt` is the source** — written once at activation, never rewritten while the task stays active, preserved by `anchorBrowserSession`, and storage-backed, so it survives reload and restart.
- **The pomodoro takeover is byte-identical.** A running phase still owns the card and the face. The session-*done* card, which previously showed no time surface at all, gains the headline treatment (Samson's call at implementation) — it is the moment the number is most worth seeing.
- **Per-second repaint covers the headline only.** The since-line is static while the task is active, so it never enters the tick path; no full re-renders were added (A1).

**The session-anchor machinery STAYS, and the audit is why:** `sessionAnchorAt` had exactly one reader — the deleted counter — which invited removing `anchorBrowserSession` and its `onStartup` write as dead weight. It is not dead. The same write also normalizes `pausedAt`, which the `[1.0.18]` pomodoro freeze reads (`satPomoRemainingMs`) and which `setTrackingPaused`'s resume shift restores continuity against. Removing it would change how a pause held across a browser restart resumes a phase — a silent behavioural change in the one area this task required to stay identical. **The general rule:** a "last reader removed" audit is not finished at the field; it has to cover every field the writer touches. `pausedMs` / `idleMs` are now write-only and are left as such — retiring that accounting is a separate scope.

**Shipped in:** `[1.2.3]`, Asana 1217301162748887.

---

## 2026-08-12 — Text size ships as a token ramp, not a rem conversion; Medium is the default and carries the bump

**Context:** The last planned change before the v2.0.0 store submission. Settings > Appearance needed a Text size control (Small / Medium / Large) beside Icon Size — a **free** setting, never Pro-gated, because text size is accessibility. The locked semantics (Samson, 2026-08-11): Medium is the default and carries a global bump of the small/secondary tiers; Small is today's exact sizing so existing users who prefer density lose nothing; Large is one notch above Medium.

The audit found the sheet is **entirely px**: 342 `font-size` declarations, no `em`, no `rem`, no `%`, and no `font:` shorthand carrying a size. Bucketed: micro 8–10px (16), secondary 11–12.5px (159), body 13–14px (123), headline/display 15px+ (44).

**Alternatives considered:**
- **A rem conversion with a root `font-size`.** Rejected. It touches all 342 declarations, and a root scale moves the headline and display tiers with everything else — 42px brand text and 36px recap numerals grow for no reason, and the tiers can no longer be steered independently. It also collides with `.icon-size-*`, which already scales the grid's own type.
- **Root-class overrides that re-declare `font-size` per selector.** Rejected. Medium bumps ~300 declarations, so the override blocks would have to enumerate hundreds of selectors — more churn than the conversion it was meant to avoid, and it goes stale the moment a rule is added.
- **A CSS `zoom` on a container.** Rejected outright. It scales icons, spacing and layout, not text.
- **A token ramp** — chosen.

**Outcome:**
- **Eleven tokens, `--fs-8` … `--fs-15`**, defined three times: on `:root` (Medium, the unclassed base), under `html.text-size-small`, and under `html.text-size-large`. 308 declarations at or below 15px became `var(--fs-N)`; the 34 at 16px and above are untouched literals.
- **A token is named after its own SMALL value.** `--fs-11` is `11px` under `text-size-small`. Because every replacement swapped `font-size: Npx` for `font-size: var(--fs-N)`, Small is today's sheet reconstructed **by construction** — which is Small's whole contract. Verified at the commit as well: substituting the Small values back reproduces the previous `newtab.css` byte for byte.
- **The ramp is non-decreasing and compresses at the top.** +1/+2 for micro and secondary; the body tier follows so a bumped 12px cannot overtake an unbumped 13px; the 15px tier moves only at Large so a bumped 14px cannot overtake it either. Nothing passes the untouched 16px tier — 14 and 15 both meet it at Large and stop. Headlines, display numerals and glyph buttons stand at every tier.
- **Applied exactly like Icon Size**: a root class on `<html>` (`text-size-small` / `text-size-large`), Medium unclassed, re-applied on boot, on backup restore, and on the foreign-write re-render so a change in one tab lands in every other open new tab.
- **Storage deviates from Icon Size in one place, deliberately.** `Storage.getTextSize` / `setTextSize` are a reader/setter pair rather than Icon Size's bare `data.settings.iconSize || "medium"`. Coercion has to be provable, and a page-side `||` is unreachable from a Node VM. Icon Size's own idiom is left as it shipped — this round does not refactor working free-tier code on the way to the store.
- **Migration is the default.** Absence means "never configured", so every existing install reads Medium and gets the bump. That is the intended product change; a user who wants today's density picks Small.

**Known boundary:** `gate.html` carries its own stylesheet, is already set in large type, and is a transient interstitial nobody configures from. It is out of scope, stated rather than discovered.

**Gate:** `tools/check-text-size.mjs`, build.sh gate #12 — the naming invariant, the locked table, the no-inversion ordering across all three tiers, the "no hard literal below the floor" rule that stops a future rule escaping the setting, the reader's coercion, and the fact that the row is never Pro-gated.

**Shipped in:** `[2.0]`, the v2.0.0 store-submission candidate.

---

## 2026-08-13 — The stopwatch's two surfaces share one clock edge; and the reported card freeze did not reproduce

**Context:** Samson reported, with a screenshot, that the task row's stopwatch ticked while the card's `Active 0:06 · since 2:49 PM` held still — same number at render time, stale seconds later.

**The diagnosis is that it does not reproduce at `ed84aa6`, and that is the finding.** The three candidate causes were checked directly against the live extension over CDP (isolated scratch profile, real `chrome.*`, the actual `newtab.html`):
- **"Never joined `satPaintTime`"** — false. `ed84aa6` put the count on the line and the `.sat-since` repaint into the tick **in the same commit**; the built `launchpad-2.0.0-ed84aa6.zip` carries both.
- **"Gated to the wrong card states"** — false. Idle, work-phase takeover, session-done, minimize/restore, both tabs, paused, resumed, workspace switch, reload, deactivate/reactivate: **24 interaction states, 0 divergences**, plus a 46-sample soak across a real browsing tab and a background/foreground cycle.
- **"A node-identity miss"** — false. One `.sat-since`, inside `#active-task-pill`, connected and visible, its `textContent` mutating once a second (MutationObserver: 77 writes to the card against 79 to the row over ~80s).

The pre-`ed84aa6` line read `Active since 2:49 PM` with no count at all, so the screenshot is of a build where the count had landed and the repaint had not — an intermediate state, not committed code. **Recorded rather than quietly closed:** a symptom that cannot be reproduced is a result, and the round still owed the guard that makes it un-recurrable.

**What was actually wrong, and is now fixed — the two surfaces did not share the clock EDGE.** They shared the formatter (`satFmtStopwatch`) and the tick (`satPaintTime`), but each called `satActiveElapsedMs()` from its own `Date.now()` inside the same pass. A paint that straddles a second boundary hands the row `1:12` and the card `1:11`: rare, real, and indistinguishable from the reported freeze in a screenshot.

**Outcome:**
- **`satStopwatchText()`** is the count as one string. `satPaintTime` reads it **once per tick** and passes it to both `satActiveSinceText(stopwatch)` and `satRowLiveState(stopwatch)`. Both keep a self-serve fallback for the render path, where there is no tick to share.
- **The whole SENTENCE is still rebuilt**, not a count substring — at midnight `isToday` flips and the line has to gain its date, which a count-only write would never deliver.
- **An uncomputable sentence now REMOVES the line** instead of leaving the last one standing. The old `if (sinceTxt)` skipped silently, which is the one code path that could still strand a stale count under a live task.
- **The stale docs went with it.** `satPaintTime`'s header still recorded the since-line as deliberately exempt "static timestamp, ticking it would be pure waste" (the `[1.2.3]` entry above says the same), and the `.sat-since` CSS comment still called it a STATIC line. That note is the ancestor of this report: **an exemption that outlives the static line is how a surface ends up frozen while its twin ticks beside it.** A line that acquires a moving number joins the tick in the same change, and its documentation moves with it.

**Gate:** `tools/check-pill-clarity.mjs` — lockstep is now **executed, not pattern-matched**, against a pinned clock (`ClockDate`): both producers at one instant, both again 3s later, both advanced, equal at every sample. The clock-edge rows pin time forward *between* the two calls, so a surface that re-reads desynchronises deterministically. Seven new seeds, including the reported symptom itself (the card's count frozen while the row's moves) and its mirror on the row. **62 caught, 0 escaped, 0 anchor-miss.** Two clock-edge seeds escaped the first run through a temporal tie — recorded as BUGS.md **Q10**.

**Runtime:** activate → 6 samples climbing in lockstep; pause → both frozen; resume → both continue. 15 samples, 0 splits, against the patched file (provenance asserted before measuring, so the pass cannot be the old code wearing the new commit's name).

**Shipped in:** `[2.0]`, the v2.0.0 store-submission candidate.

---

## 2026-08-13 — The hero swap: the activation stopwatch leads the idle card, FOCUSED TODAY sits beneath (amends [1.2.3])

**This amends the [1.2.3] hero decision recorded above.** That entry moved FOCUSED TODAY into the headline slot and deleted the ACTIVE counter; this one gives the slot to the activation stopwatch and demotes FOCUSED TODAY one line. Both rationales are kept in full, because the second only makes sense against the first — and because the first was right when it was made.

**The original demotion's rationale ([1.2.3], 2026-08-08), unchanged and still correct on its own terms:** the ACTIVE counter measured *the current browser sitting*. In live use it read **139:52:01** — nothing was broken; Chrome had simply not cold-started in six days. A number that can grow to "139 hours" while meaning "you have not rebooted" fails the product's honesty standard, and the accurate work-output number already existed one line below it. Prominence, not machinery: FOCUSED TODAY took the headline and activation became a static timestamp.

**Today's reversal-in-part, and why it is not a round trip.** FOCUSED TODAY only advances while a **trackable site** is the focused tab — and the new-tab page is not one (`domainOf()` returns null for anything that is not http/https). So the headline a user is looking at is, *by construction*, the number that cannot move while they are looking at it. Samson reported the widget as frozen more than once on numbers behaving exactly as designed. That is not a bug report about arithmetic; it is the product saying the slot is wrong. **The hero of a live widget must be alive.**

**What changed between the two decisions — the mitigations that make the stopwatch safe in the slot the old counter was thrown out of:**
- **It counts from `startedAt`, an ACTIVATION** — not from a browser sitting. A six-day-old browser process no longer inflates anything; only a six-day-old *task activation* does, and that is a true statement about the user's own decision.
- **Pause-aware.** The paused span is excluded (`activePausedMs` + the open `pausedAt` span), so the count cannot claim hours the user explicitly stopped. The old counter had no such notion.
- **"End for now" gives it a lifecycle.** The count is bounded by an action the user takes. The old counter was bounded by whether Chrome happened to restart, which is why it read as meaningless.
- **The day form.** `2d 5h` past 24 hours, instead of letting the figure grow into an unreadable `54:12:07`.
- **The timestamp stays directly beneath it** (`since 5:03 PM`), so a large figure always carries the "since when" that makes it interpretable.

**Outcome:**
- **Idle/active card only.** `satIdleHeadlineHtml` renders the stopwatch as `.sat-hero-time` with `Active` as its quiet unit word, the timestamp beneath it, then FOCUSED TODAY on one line — smaller, **always visible**, label and liveness indicator intact — then the windowed total. The phase takeover, the session-done card and the task row are **untouched** and still go through `satHeadlineHtml`; the takeover already has a live hero (the ring) and the done card is a terminal summary, so neither has the problem this solves.
- **Two classes, two numbers, one paint.** The hero deliberately does **not** wear `.sat-time`: `satPaintTime` fills every `.sat-time` it finds with the engine figure, so a hero wearing that class would be painted with the wrong number every second. `.sat-time` still means exactly one thing everywhere — the engine's figure.
- **The since-line drops its count on the idle card** (`since 5:03 PM`, not `Active 0:06 · since 5:03 PM`): the stopwatch is directly above it, and repeating it is the duplication [1.2.3] deleted. Every other branch keeps the leading count, because there it has no other home.
- **Honesty guards unchanged.** Never blended, never summed, "focused" still reserved for engine time, and the wall-clock tooltip moved with the number to the hero's unit word.
- **The pause statement is made once.** The hero's unit word becomes `Paused` and both frozen numbers take the amber treatment; FOCUSED TODAY keeps its own label rather than becoming a second "PAUSED" on the same card.

**Known copy collision, flagged not fixed:** the hero's unit word (`ACTIVE`, the unit of a wall-clock) and the liveness indicator's armed word (`● ACTIVE`, meaning *armed but not accruing*) now sit two lines apart saying the same word about different things. Both are individually correct and both were specified; the collision is only visible once they share a card. Cheapest fixes if it grates in use: rename the indicator's armed state (`Armed`), or the hero's unit (`Active time`). Left to Samson rather than decided here.

**Gate:** `tools/check-pill-clarity.mjs` — the hero assertions **swap rather than disappear** (the rows that asserted FOCUSED TODAY held the slot now assert the stopwatch does, with in-file notes recording the amendment), both builders are **executed** so the claim is about rendered markup, and the takeover/session-done branches are asserted unchanged. Twelve new seeds including the three the brief names — the hero frozen while active-unpaused, the FOCUSED TODAY line dropped, the two numbers blended. **74 caught, 0 escaped, 0 anchor-miss.** One ink seed escaped the first run through a selector list that matched the neighbouring `text-shadow` group instead of the `color` rule; the assertion now binds the selector to its declaration (Q2).

**Runtime:** fresh profile, live extension. Activation → the big number is counting **within one tick** and equals the row at every sample; FOCUSED TODAY visible, labeled and carrying its dot; pause freezes both with the word said once; the takeover is unchanged (ring counting, FOCUSED TODAY beneath, no hero, since-line still leading with its count). Rendered-pixel ink across **four frames × three text sizes**: worst contrast **4.56**, nothing absent.

**Shipped in:** `[2.0]`, the v2.0.0 store-submission candidate.

---

## 2026-08-13 — The liveness indicator's holding word: Active → Ready (closes the collision flagged in the hero swap)

**Context:** The hero swap entry above flagged a copy collision and left it to Samson: the hero's unit word (`ACTIVE`, the unit of a wall-clock) and the liveness indicator's armed-not-accruing word (`● ACTIVE`, meaning *armed, nothing accruing*) ended up two lines apart on the same card, one word doing two jobs. Called, 2026-08-13: rename the indicator's holding state.

**Outcome:** the holding state reads **`● Ready`**. The PULSING accruing state keeps **`Tracking`**, which was never ambiguous, and the hero's unit word stays **`Active`**, which is what a wall-clock measures.

- **"Ready" over "Armed".** `Armed` is the obvious synonym and is the wrong word here: this product already spends "armed" on FOCUS BLOCKING (`focusArmed`, `isFocusManuallyArmed`, the armed dot on the pill face). Borrowing it would have traded a collision with the hero for a collision with the blocking vocabulary. "Ready" says what the state *is* — it will count when you browse — and collides with neither.
- **The tooltip was reworded WITH the label**, not left behind explaining a word that no longer renders: `"Ready — time records as soon as you browse a site. This page is not tracked, so the number holds here."` Same register, same reason-for-the-stillness, leading with the word it explains. The hero's tooltip and the row's are untouched.
- **One renderer, audited.** `satTrackingIndicatorHtml` is the only producer of this state; its two call sites are the idle card and the takeover/session-done builder. There is no Dashboard or Insights copy of the indicator — the sweep found the other `Active` strings in the codebase to be a task-status filter option and a recurring-task checkbox, neither related.
- **No new classes.** The markup is the same three nodes (`.sat-live`, `.sat-live-dot`, `.sat-live-word`), so the existing ink coverage on both wallpaper frames carries over untouched — a rename that emitted a new class would need its own ink declaration, which is the failure mode this repo has paid for twice.

**Gate:** the holding-word rows in `tools/check-pill-clarity.mjs` are re-pointed with in-file notes — the row now asserts `Ready` AND asserts the colliding word is absent, plus that the tooltip was reworded with the label and that no new classes were emitted. Two seeds: the holding state reading `Active` again (the collision returning), and the label renamed while the tooltip is left explaining the old word. **76 caught, 0 escaped, 0 anchor-miss.**

**Runtime:** one glance — card reads `0:01 / Active / since 5:27 pm / 7:00 Focused today ● Ready`, row reads `0:01 active`, and the only remaining `Active` strings on the card are the widget's own eyebrow (`ACTIVE TASK`) and the hero's unit, which mean the same thing as each other. Forcing an open engine session flips it to `Tracking` with `is-live` and its own tooltip — verified after a **fixture read-back**, because the first pass seeded `{taskId, startedAt}` where the engine's open record is `{activeTaskId, start}` and the indicator correctly stayed in its holding state (Q7: that read as a broken live branch and was a broken fixture).

**Shipped in:** `[2.0]`, the v2.0.0 store-submission candidate — the final change before submission.

---

# BACKFILL — the launch-campaign ledger, synced 2026-08-13

The six entries below were decided between 2026-08-09 and 2026-08-13 and lived only in Asana review comments until this sync. **They are appended rather than interleaved**, because this log is append-only and rewriting history to look tidy is how a log stops being trustworthy. Read their own dates, not their position. The pre-submission run is now fully recorded.

---

## 2026-08-09 — v2.0.0 launch scope LOCKED (three items in, everything else fast-follow or parked)

**Context:** Samson reviewed the full Backlog and found nothing already-done. The lock exists so the run to submission cannot be widened by a good idea arriving late.

**IN before submission:**
1. **Pill redesign** (1217301162748887) — flagship-surface honesty at first impression.
2. **Harness rescue, PRIORITY PAIR ONLY** (1217302152465697) — the `[1.2.0]` decision-chain suite and the L1 serialization suite, committed *before* release churn so they protect it. Remainder opportunistic post-launch.
3. **`[2.0]` Checkout return flow** (1216759422045146) — Dodo `redirect_url` on both payment links plus the return page; closes the documented conversion gap on the purchase path.

**FAST-FOLLOW (v2.0.1+):** `[1.2.2]` date-range selector (1217301997679347), the refusal toast (1217317549419902), the harness-rescue remainder.

**PARKED, unchanged:** Notes `[1.1.0]`–`[1.1.4]` (v2.1 headline); `[1.3.0]` Backup & Restore (early v2.1 — its task notes predate the extend-existing discovery; **this document governs**: it extends the shipped Settings backup rather than building a new one).

**Execution order:** harness rescue first, pill redesign second, checkout-return in parallel (website repo + Dodo dashboard, Samson-involved). Launch workstreams filed alongside: release engineering, store listing / ASO, pre-submission QA (one real trial → checkout → activation loop), marketing runway.

**What actually happened, recorded because the lock held in spirit rather than to the letter:** the three IN items shipped, and the run then absorbed several *findings from Samson living in the product* — the Today cockpit, the pre-launch ink rounds, the celebration, the text-size setting, and the pill-clarity arc. Each was filed as its own task and each closed before submission. The lock did its job: nothing new was invented, and every addition came from use rather than from ambition.

---

## 2026-08-10 — Pro activation celebration + first-Pro tour: a REAL-ENTITLEMENT trigger, and arbitration at the call sites

**Context:** A buyer completing checkout got no acknowledgement inside the product. The celebration is the one moment the product is allowed to be loud.

**The trigger is `ProAccess.isRealProEntitlement` — `subscriptionStatus === "active"` AND a non-empty `licenseKey` — and it deliberately does NOT call `getProAccessLevel`.** That function's whole job is collapsing trial / devPro / paid into one "has Pro" answer, and that is exactly the collapse a *purchase* celebration must not inherit. Reading `data.pro` directly excludes every non-buyer **by construction**: `devPro` returns "active" without touching `data.pro`, a trial's status is `trialing`, free and invalid are not `active`. The `licenseKey` half is a second independent guard, so no single flipped field can celebrate. **Grace counts** — in grace only the verification is stale; the buyer is real.

**The flag is TOP-LEVEL `data.proCelebrated`, not inside `data.pro`,** because `clearLicense()` wipes that block — a flag living there would replay the moment on any clear-and-reapply. *"Once ever" has to outlive the licence that triggered it.*

**Arbitration:** three rival surfaces (right-click tip, promo/rate toast, badge splash) are suppressed by one module flag with **three guards at the call sites**. Rationale is now BUGS.md **D13** — each rival consumes something at the moment it decides to show, so a guard inside a callee converts a deferral into a silent permanent loss.

**The tour REPOSITIONS on resize rather than drift-closing** — N2's `#nest-rename-dialog` exception, invoked with force: any exit sets the once-ever flag, so a resize-close would burn the tour permanently for someone who dragged a window. Repositioning costs one rect read and cannot lose anything.

**Two bugs only the runtime pass could find:** `offsetParent` is `null` for **every** `position: fixed` element, and `#active-task-pill` is fixed — the anchor-visibility test silently dropped the pill step, shipping a four-stop tour as three with no error anywhere; and the anchor ring accumulated rather than moving, so by step 3 three tabs were ringed. The runtime check now asserts **exactly one** ringed node per step.

**Gate:** `tools/check-pro-celebration.mjs` (84 checks), run against the real `ProAccess` and the real `Storage` setter in **both** an unpacked and a store-build context — so "devPro does not celebrate" is proved alongside the premise that devPro really does grant Pro. 12 mutations, 12 caught. Two harness faults recorded: a zero-node ink pass that reported three empty rows and **added zero assertions** (hence the node-floor doctrine), and a leaked tab whose 10s tip timer wrote the very flag a later assertion was reading.

**Shipped in:** `c2afed6`.

---

## 2026-08-11 — The Dashboard is TODAY; Insights is the PAST. The tense split governs which surface a number belongs to

**Context:** The Dashboard grew from a two-variant card into the "Today" cockpit (stat strip, goals progress, streak, due-today, quick-add) while Insights already owned the analytics board. Without a rule, every new number has two plausible homes and the two surfaces drift into being the same page twice.

**The rule: the Dashboard answers "what about today", Insights answers "what has happened".** Present tense versus past tense, and it decides placement mechanically — focused *today*, tasks completed *today*, distractions blocked *today*, what is due *today*, the streak *as it stands now* are cockpit; per-day history, time-by-site, the 30-day window and the trend board are Insights. The evening recap stays on the Dashboard **because it is today-scoped**, not because it is a summary.

**Consequences ratified in the same round:**
- **No new capture, ever, for a placement question.** "5 most-recently-active goals" had no `lastActiveAt` to read, so recency is **derived** from the newest signal a goal's own tasks already carry (a child's `completedAt`, else its `createdAt`), with `displayOrder` as a total-order tie-break so it cannot flicker.
- **A fully-done active goal now SHOWS** where `dashboardTopGoals` hid it — a 5-of-5 goal awaiting closure is a progress module's proudest row.
- **Absorbing surfaces route through their owners.** Completing the ACTIVE task from a due row goes through `satComplete`, never a bare `completeTask`, because `clearActiveTask` IS the engine's session boundary.
- **Readers live in `storage.js`, wording lives in the page** — state that lives there is harnessable in a VM against the real module.

**Follow-up, same doctrine (`28f5324`):** the evening close-out read the clock and never the board, so "Work's done." sat above five overdue rows. The header now gates on the module's own open set, rendered from **one read** handed to both header and list, with the invariant stated as: *"Work's done." appears if and only if the list beneath renders "Nothing due today."*

**Shipped in:** `5d7a1ec`, `28f5324`. Gate: `tools/check-today-cockpit.mjs` (142 assertions).

---

## 2026-08-11 — The pill-clarity arc: consequence-labeled actions, the activation stopwatch, and one honest number per claim

**One entry for one arc.** It ran from a near-miss on a destructive control to a one-word coda, and every step came from Samson living in his own product. The individual rounds are recorded above and below this entry (`2026-08-08` FOCUSED TODAY headline, `2026-08-10` pill redesign, `2026-08-13` clock edge / hero swap / "Ready"); this entry is what the arc **decided**.

**1. CONSEQUENCE-LABELED ACTIONS — the defect that started it.** "✓ Done" permanently completed the task while "stop for now, keep the task" hid behind an unlabeled ×. The failure is silent and feels unrecoverable: the user taps the labeled button and the task closes. **A control is labeled with its consequence, not its sentiment** — Complete and *End for now*, with the binding between label and action asserted in both directions and seeded both ways.

**2. THE ACTIVATION STOPWATCH — "an active task is a running stopwatch".** Samson's model, adopted whole. One number, one regime, and **it always counts**: from `startedAt` (an activation, storage-backed, surviving restart), pauses excluded, continuing through a work phase rather than resetting, degrading to a day form (`2d 5h`) past 24 hours. It replaced a session-elapsed switch that reset when a session started and froze when none was running — **a frozen number on an active task reads as broken**, which is the report it answered.

**3. WALL-CLOCK AND ENGINE TIME ARE NEVER BLENDED, and "focused" is reserved for engine time.** The stopwatch is a wall-clock and says so in its tooltip; FOCUSED TODAY is the engine's measurement. They are never summed, never shown as one figure, and the row's unit word is "active" — never "focused". Asserted, and seeded from both directions.

**4. THE TWO-TRUTH LIVENESS INDICATOR.** BUGS.md **D11**: a pulsing "tracking" dot would be a lie in the one moment it is reliably read. Two states, two claims — pulsing **"Tracking"** only on a genuine open session, static **"Ready"** when armed but not accruing. Paused and tracking-off render nothing.

**5. THE HERO SWAP amends the `2026-08-08` decision** — recorded inline in its own entry (`1efcab2`, below), cross-referenced here so the arc reads in one place: the stopwatch takes the headline, FOCUSED TODAY is demoted but always visible. *The hero of a live widget must be alive.*

**6. "● Ready" as the holding word** (`3c719d6`) — the coda. "Active" was doing two jobs two lines apart once the hero landed. "Armed" was rejected because the product already spends that word on focus blocking.

**Also in the arc:** the overlap reserve moved to the shared panel root; per-task time became the 30-day chips, read **across every workspace** (BUGS.md D12 — the aggregate-keying trap that made chips vanish for exactly the tasks a two-workspace user tracks).

**Gate:** `tools/check-pill-clarity.mjs`, 153 rows, 76 seeds, all caught. **Task 1217412345143493 CLOSED 2026-08-13 — the build phase of v2.0.0 ended with it.**

---

## 2026-08-11 — The website brand pass: tokens DERIVED from the extension, gold is earned, and the beacon comes off

**Context:** mylaunchpad.me did not look like the product it sells, and the styling predated everything Pro.

**Tokens are extracted, not invented — and `gate.css` is the true precedent.** Two sources with different jobs: `newtab.css` gives the surface model (the three frost tiers), and the focus-blocking gate page is **the only place the product renders a standalone FULL PAGE rather than panels over a wallpaper**, which is exactly what a website is — so the ink ramp comes from there. **Blue is `#8ab4f8`, not `#1a73e8`:** the old stylesheet's comment claimed `#1a73e8` "matches the extension", and it matched the branch the site never renders (BUGS.md **O5**). The logomark is the real 2x2 four-dot SVG, not a typeset colon pair.

**GOLD IS EARNED — locked as doctrine.** `#ffd66e` belongs to achievements and `.pro-celebrate`: recognition for something completed. It appears on **exactly one surface site-wide**, the confirmed-key success state. The fallback state deliberately does not get it, and neither does the og share card — *a share card is an ad, not an earned moment*. Written into the website README so it cannot spread by precedent.

**Every byte comes from this origin, and that is an ASSERTED property** — a CDP network audit fails the build if any request leaves the origin. Landing page 37.7 KB uncompressed against a 300 KB budget, three requests, no webfont and no CDN; later 99.5 KB at first paint once real screenshots landed, argued against the budget rather than asserted.

**Copy corrections the pass forced:** the pricing card and FAQ both promised a **Day Recap** that `RELEASE-NOTES-2.0.0` explicitly lists under claims-not-made — the site was contradicting the build's own honesty ledger. And the 7-day trial is local, instant and card-free, so it is deliberately **not** attached to either Dodo button: "start your free trial" on a checkout link would describe the wrong mechanism.

**THE BEACON — the round's real finding, and the reason S1/S2 exist.** The live site was loading Cloudflare's `beacon.min.js`, injected at the edge and absent from git, while the landing page promised "no Cloudflare Insights, no beacon of any kind" — and it rode `/checkout-return`, where Navigation Timing still holds the pre-scrub URL including `license_key`. **Decision: Web Analytics disabled for the site entirely**, matching the posture the site sells, which makes the copy true again and closes the exposure path at its root rather than papering it with an exclusion rule.

**Shipped in:** website `ae3b3c5`, `54ae560`, `3330fd3`, `eb2b95d`.

---

## 2026-08-10 — Checkout-return status buckets: terminal vs in-flight vs unknown, and the honest default

**Context:** A wrong-CVV decline redirected to `/checkout-return` and rendered the **processing** state — promising a licence key that was never coming. Samson caught it in live QA.

**The defect was the branch SHAPE, not the copy.** The test was `status && status !== 'succeeded'` → processing: one narrow success case, and **every other value in the universe** — declines, cancellations, typos, statuses Dodo has not shipped yet — inherited a promise. Rewriting the copy would have left the shape intact.

**Dodo documents the 11-value enum thoroughly and documents the REDIRECT's values almost not at all** (one example URL, `succeeded` the only value in it). So "which of these can land here" is inference, and the page must not guess. Two small **allowlists**, and the default is the honest state:

| bucket | members | claim |
|---|---|---|
| **success** | a `license_key` present (regardless of status), or `succeeded` | key + activation steps |
| **processing** | `processing`, `requires_capture` | key is coming — the ONLY two branches permitted to promise one |
| **failed** | `failed`, `cancelled`, `canceled`, `requires_payment_method` | not charged, try again |
| **unconfirmed** (default) | `requires_customer_action`, `requires_confirmation`, `requires_merchant_action`, `partially_captured*`, **anything unknown or future** | check email first; try again offered *secondary* |

**Two judgment calls, stated as such.** (a) `requires_payment_method` → failed: pre-capture under both readings ("no card entered" and "declined, another needed"), so the copy's only claim — no charge — holds either way. (b) `requires_*_action` → **unconfirmed, not processing**, overruling the original brief: these mean an unfinished step, usually an abandoned 3-D Secure, and promising "your key will arrive shortly" for an authentication nobody completed is the same lie one bucket over. They cannot be called failures either, since the redirect may simply have raced the buyer.

**Confidence is encoded in button weight:** a solid *Try again* where failure is known, an outlined one where it is not — because if the payment actually landed, buying twice is the wrong move.

**Observed value closing the table:** the declined attempt read **`failed`** in Samson's Dodo dashboard, consistent with the interstitial. It routes correctly, as would any other value — which is the point of the allowlist design.

**Related:** the page is a **UX surface, not fulfilment** (Dodo's own guidance is to fulfil on the `payment.succeeded` webhook), which is why every non-success state points at email and support rather than trying to be authoritative. The inverse default is recorded one round later in the licence line: there the dangerous default was optimism, here it is **accusation** — an unrecognised error degrades to "could not reach" and never to "your licence is invalid" unless the state machine agrees.

**Shipped in:** website `8dcad5e` (buckets), `ccf3f14` (key-alone success), `6cb4b59` (fallback copy). 21 cases verified over HTTP, proven able to fail against the pre-fix page.

---

## 2026-08-14 — Buy Me a Coffee is retired from the product surface: one payment avenue, the product's own

**Context:** BMC was the free-era monetization — a sidebar entry and one leg of the promo toast rotation, both dating from when the extension had nothing to sell. v2.0.0 puts a paid tier in front of users. A tip jar beside a subscription reads as **two hands out**, and the second one undercuts the first: it invites the reading that the paid tier is not quite enough, or that the subscription is optional goodwill. One payment avenue, and it is the product's own. Retired with honors.

**What went, and what deliberately stayed.** Removed: the `#sb-bmc` sidebar entry with its cup icon and its three stylesheet blocks (base, `has-bg`, `bg-light`), and the coffee leg of the promo rotation — the ☕ toast, its "LaunchPad is free & ad-free. Support the dev?" copy, and the `openCount === 8` milestone that fired it. **The rate toast stays: a rating ask is not a payment ask.** It costs the user nothing, it is the free tier's only remaining growth lever, and it was never part of the objection. The `.promo-toast` surface itself was never coffee-specific and is untouched.

**THE CADENCE IS A DECISION, NOT A RESIDUE — the round's real finding.** The two toasts alternated every 20 opens, so the *rating* ask actually landed roughly **every 40**. Deleting the coffee branch and leaving the interval at 20 would have left working code that looks like a pure removal while **doubling the rating nag** — a user-visible behavior change nobody chose, arriving as a side effect. The interval is therefore set to **40 outright**: first ask at open 3, then every 40 opens (3, 43, 83, …). The removal is felt by the user as a removal, not as a new frequency.

**Corollary, generalized:** when one member of an alternating pair is deleted, the survivor's *interval* is not the pair's interval. Restate the survivor's real cadence before touching the constant, or a deletion silently promotes it.

**`promoState` is migration-safe by ignoring, not by rewriting.** Real users carry state from three eras. The legacy `lastPromo` field (`"rate"` / `"coffee"`) is now **neither read nor written** — an existing object keeps its own copy untouched as it rides through the storage set, and it decides nothing. `openCount` and `lastPromoOpen`, the two fields carrying actual history, are read exactly as before, so **no one's rating history is reset**. The pre-`promoState` key `bmcToastDismissed` is retired as a *write* but still honoured as a *read* during the one-time migration: it records that the user was already prompted once, and ignoring it would re-prompt a long-standing user on their very next open.

**One dead end closed while the branch was open.** The first ask was `openCount === 3`, exact-equality. That was safe only because the coffee leg's `=== 8` milestone caught anyone migrated in above 3 — and with the coffee leg gone, a user migrated in at `openCount` 7 with nothing ever shown would have been **stranded, never asked again**. The anchor is now `lastPromoOpen > 0 ? interval : openCount >= 3`, where `lastPromoOpen === 0` means "never asked". BUGS.md **D13**'s premise is updated accordingly (the scheduler still consumes at decision time — it increments `openCount` and writes `lastPromoOpen` — so its deferral guard stays at the call site).

**Incidental fix, found by the same sweep:** the sidebar Rate entry's href had shipped as a literal placeholder, `…/webstore/detail/launchpad/EXTENSION_ID_HERE`, with nothing rewriting it at runtime — a dead link in every build to date. It now points at the real listing ID the promo toast already used. Folded into this commit rather than deferred, because the submission artifact would otherwise carry it.

**Verified:** the `pro-celebration` gate — which already owned the promo toast's arbitration — gains the rotation's cadence rather than opening a fourteenth gate. It drives the **real** `checkPromoToast` in a VM against a `chrome.storage.local` that round-trips through JSON, asserting the 3/43/83 schedule, four legacy fixtures parsing without a reset, and the coffee surfaces absent *with* the inverse rows that stop "everything is gone" from passing. 114 assertions, and proven able to fail against **11 seeded defects** — the load-bearing two being the sidebar entry and the coffee toast returning, plus the cadence silently falling back to 20.

**Not touched:** `CLAUDE.md`'s BMC line is developer contact information, not product surface. `docs/RELEASE-NOTES-2.0.0.md` and `store-description.md` were swept and mention BMC nowhere.

---

## 2026-08-14 — Browser-closed time is paused time (AMENDS continuity-across-restarts, 2026-08-12)

**Context:** Samson's morning-after finding. Yesterday's test task greeted him at **18:14:35** — the activation stopwatch had counted the entire night. The continuity-across-restarts decision was specified two days earlier and was tolerable while the count lived on a quiet line; **the hero swap made staleness the first thing an overnight user sees**, and lived use overturned it.

**THE SCREENSHOT'S CONTRADICTION WAS NOT A SECOND BUG, AND ESTABLISHING THAT CAME FIRST.** The card read PAUSED *and* showed 18 hours, which reads like the pause-exclusion failing. Driven against the real `storage.js` and the real `satActiveElapsedMs`: a task paused **before** a shutdown has its closed span folded correctly — `anchorBrowserSession` adds `now − pausedAt` to `activePausedMs` and re-stamps the born-paused shape, and an 18-hour night is fully excluded. The screenshot is the other scenario, reproduced to the second: **active and unpaused overnight, paused the next morning.** `trackingPaused` has exactly two writers — the pill's control and `setActiveTask`'s clearPause — and idle is not one of them, so the pause was a click after the reopen. The two facts on screen are consistent: the pause froze the clock at the instant it was pressed, which was already 18:14:35 in. **Nothing was designed on top of a broken foundation.**

**The corrected semantics: THE STOPWATCH MEASURES ACTIVE TIME WHILE THE BROWSER EXISTS.** Closed spans are *definitionally* paused — excluded retroactively, not merely paused-from-reopen. A liveness **heartbeat** (~1 min) while a task is active and unpaused; on cold start, fold `now − lastBeat` into `activePausedMs` and pause the task. Error per shutdown is at most one beat, and always in the safe direction — slightly less than the true closure, never more. **"End for now" is unchanged** as the lifecycle answer to long staleness; this fixes overnight, not abandonment.

**THE HEARTBEAT GETS ITS OWN STORAGE KEY, NOT A FIELD ON `data` — the round's real engineering finding.** The brief specified `data` + the queue. The audit said `data` is the expensive place: every `data` write fans out to `Tracking.sync`, a context-menu rebuild, the pomodoro alarm re-derivation, **and a full `render()` in every other open new-tab page** — and a service worker cannot opt out of that last one, because the `__lastWrite` provenance suppression is keyed by TAB instance. A once-a-minute beat in the blob buys that entire fan-out forever, for one timestamp. `launchpad_heartbeat` is the **`tracking_sessions` precedent**: the high-frequency writer gets a key nobody watches. It consequently needs **no `enqueueBgData`** — a single-key set is not a `getAll → mutate → saveAll` cycle, so there is nothing to clobber. **The FOLD does touch `data` and does ride the queue.** Samson chose this over the brief's letter.

**ORDERING: the anchor first, the fold second, and they are MUTUALLY EXCLUSIVE BY CONSTRUCTION.** Paused before the shutdown → the anchor folds `now − pausedAt` itself and the fold declines on `isTrackingPaused`. Unpaused before the shutdown → the anchor finds `pausedAt` null and folds nothing, and the fold does the work. Exactly one accounts for the closure, never both, never neither. **Reversed, the fold would set the pause flag first and the anchor would then charge the same span again.** The overlap is milliseconds today; the invariant is what keeps it correct, not the size of the window.

**NO EVIDENCE MEANS NO FOLD *AND NO PAUSE*.** An absent or zero beat is a legacy profile's first launch after this update. `now − 0` is fifty-six years; folded into `activePausedMs` it pins the stopwatch at 0:00 permanently with no user-reachable way back — **the epoch-fold catastrophe is worse than the bug being fixed**, and every rejecting shape is asserted. The second half is the less obvious one: pausing *without* folding would freeze a count that still contains the closed hours — a wrong number, now also stuck, requiring a Resume click to undo. Not pausing preserves the old behavior for exactly one cycle, and the heartbeat starts on that very launch.

**A race that would have let the fix erase its own evidence.** `reconcileHeartbeatAlarm` bootstraps a beat when it creates the alarm, and on a cold start it races the fold. If the bootstrap overwrote the beat left by the *previous* session, the fold would compute ~0 and do nothing — **the overnight bug would survive its own fix and look like the feature simply did not work.** The bootstrap is therefore non-destructive (never overwrites a stored beat), and the fold reads the beat *before* entering the queue. Both are gated.

**The reopen moment is the amber paused card; the toast only says WHY.** The card already carries the frozen count, the state and Resume. The one-time toast — *Paused "{task}" while the browser was closed — resume when ready.* — answers the only question the card cannot. Consume-before-paint (D8), so two tabs opening together show it once, and guarded at the call site (D13), so suppression is a deferral rather than a loss.

**The pomodoro's CODE is untouched; its BEHAVIOR under this pause is the path that already existed.** `reconcilePomodoro` has always returned `none` while paused, so a phase held across a shutdown freezes and resumes rather than expiring. This round routes more shutdowns into that same pre-existing path, and the result is the only internally consistent one: if closed time did not count for the stopwatch, it did not count for the phase either. **FOCUSED TODAY and the engine are untouched** — the fold writes two fields on the activation record and nothing the engine reads.

**Rejected: a minimum-closure threshold** ("only pause if the browser was shut for more than N minutes"). It buys a little politeness on a fast restart and costs a magic constant with no principled value, plus a second regime to reason about. The semantics are cleaner without it: `onStartup` *is* the browser having been closed.

**Verified:** 32 new rows on the `pill-clarity` gate (which owns the pill's number) and 11 on `bg-queue` (which owns serialization) — **96/96 and 11/11 mutation seeds caught**, the load-bearing one being the fold never running and the 18-hour morning returning. A pre-existing assertion was found to have gone slack in the process: `activePausedMs` accrual was gated by a `>= 3` **count** of accrual paths, and this round's fourth path meant deleting one of the original three still passed. Replaced with four named per-path rows. **A threshold over a growing population stops testing anything.**

**Amends, does not supersede:** the 2026-08-12 decision's other halves stand — `startedAt` is still preserved across restarts, the count still continues across a browser restart *while the browser is running*, and the timestamp still sits beside it.

---

## 2026-08-14 — The per-task worked clock: lifetime wall-clock time, banked at every deactivation

**The model (Samson):** every task accumulates **worked** time — wall-clock active time, pauses excluded — across all of its activations, forever. Resume counts, pause freezes, switching banks the span. Shown per task so people keep a mental note of where their effort went.

**EXISTING TASKS START FROM NOW, and that is the honest choice.** `task.workedMs` is absent on every task that predates this feature, and absent reads as 0. Their history was never captured, so it is not invented: a task worked on for months begins counting today. A back-filled estimate would put a number on the surface whose whole purpose is to be trusted.

**THE FOLD LIVES IN THE TWO PRIMITIVES, NOT AT THE CALL SITES — the round's central decision.** A missed deactivation path is a *silently leaking span*: the user works an hour, the total does not move, and nothing reports an error. The audit enumerated **eight** ways an activation can end — End for now; Complete from the card; Complete from a row or the context menu; switching tasks; the pill's self-heal; a task deleted while active; a recurring instance completing; a hard purge — and found that **only two writes in the entire codebase actually end one**: `clearActiveTask`, and `setActiveTask`'s replace branch. Every one of the eight terminates at one of those two. Banking inside them covers all eight *by construction*, and covers any path added later; banking at call sites would have covered the ones somebody remembered. The gate asserts each of the eight **by name, one row each** — the direct lesson from the previous round, where a `>= 3` count-based assertion went slack the moment a fourth path appeared.

**Two corollaries the enumeration forced:**
- **The re-pick branch must NOT bank.** Re-picking the already-active task *keeps* the record, so the activation continues rather than ending; banking there would credit the span twice.
- **A trashed task is still credited.** The lookup is deliberately raw rather than `getTaskById`/`findLiveTask`, both of which skip a soft-deleted task. Deletion is reversible, and restoring a task that had lost its worked history would be a silent data loss. Only a hard purge loses the span — and there the task is gone with it, so there is nowhere to show it.

**Banking is MUTATE-ONLY and rides the write the deactivation was already making.** Giving it its own `saveAll` would put a second, unqueued `data` cycle on the busiest path in the product — the L1 clobber shape, arriving through a feature that looks like it only touches a display number. Asserted by counting writes (exactly one per deactivation), not by reading the source.

**VOCABULARY, and why it is on screen.** The word is **worked** — the wall-clock family, alongside the stopwatch. **"Focused" stays engine-only.** The unit word is rendered rather than implied, and the tooltips carry the distinction outright ("Total time this task has been active, pauses excluded" against the windowed chip's "tracked in the last N days"), because the two readouts sit inches apart on the same row. Never blended, never summed — the standing law, now with two more surfaces under it.

**LAYOUT, stated as a judgment call.** The row's cluster is *name → live stopwatch (active row only) → worked → windowed engine chip*. The stopwatch keeps its position as the active row's hero; at rest — every non-active row — the stopwatch is absent and the worked clock sits immediately beside the name, which is where the row's one always-present number belongs. Distinctness is carried by a **word** ("worked", where the chip has none) and by **weight**, not by a shade of grey; it deliberately does not take the accent ink, which belongs to the active row's live figure. **Zero renders nothing**, matching the chip beside it — a wall of "0m" on never-started tasks says nothing the empty space does not.

**The card gets the line — yes, and it goes in the wall-clock block.** Directly under the stopwatch and its stamp, *above* Focused today, so the card reads as two families rather than one column of mixed numbers: wall-clock (hero, stamp, lifetime) then engine (focused today, last N days). Idle card only; the phase takeover is dominated by a live ring and the session-done card is a terminal summary, and neither is a place for a fourth figure.

**SUB-MINUTE HONESTY.** A true value between 1s and 59s floored to "0m", which says *nothing was measured* about time that was. Under a minute the label now carries seconds. **Zero still reads "0m"** — there is no "0s" worth showing. One function (`fmtDurationHM`) serves the Insights board (donut centre, legend, Top Tasks), the Dashboard (focused line, recap lines, summary strip), the Tasks-tab windowed chip, the pill's windowed line and this new readout, so the change lands on all of them at once; the minute and hour forms are byte-identical to before.

**A REAL DEFECT THE RENDERED-PIXEL PASS CAUGHT.** The card's worked line inherited its neighbours' `--text-secondary` on a light wallpaper and measured **3.77:1** over the white-tinted floater frost — under the 4.5 floor, invisible to the static ink gate because the whole surface is JS-rendered, and invisible to the eye because it *looks* fine. It takes `--text-primary` instead, re-measured at 6.8:1. All 24 measurements (four frames × three text sizes × two surfaces) now clear the floor, with a negative control proving the measurement reports a deliberately illegible readout. **Screenshot pixels, not computed styles**: a frosted surface's effective backdrop is not something `getComputedStyle` knows.

---

## 2026-08-28/29 — the 2.0.1 fast-follow batch: four decisions

**Context:** four small rounds shipped back to back after the v2.0.0 submission candidate was built. None of them moved the manifest; release engineering bumps 2.0.1 once, at the end. Recorded together because each carries a decision that will look arbitrary later without its reason.

### [1.2.2] Insights range selector — presets, then a custom calendar

**The preset PERSISTS, the custom range is TRANSIENT, and the asymmetry is the decision.** A person who lives in a 7-day view should not be reset to 30 every time they open a tab, so the preset is written. A pinned custom range would do the opposite of a favour: "Jul 1-31" silently goes stale and then completely empty as the 30-day retention rolls past it, and the user would be looking at a board that is empty for a reason the board never states. So a custom range lives for the visit and a reload lands back on the preset. The stored value is the DAY COUNT rather than a label, because the count is what every reader already consumes — one representation, nothing to keep in sync — and it is read through a defaulting reader rather than a seeded field, so an absent value means "never chosen" and there is no migration write.

**The picker is horizon-bounded, and the floor is DERIVED, not restated.** The calendar cannot select before today minus 29, and the caption names that date ("History starts 31 July") rather than repeating the rule. Both come from the engine's `RETENTION_DAYS`, so the constraint and its explanation cannot disagree and both follow a future retention change unaided. Extending retention itself stays a separate decision with storage-size consequences; it was deliberately not folded in here.

**The locale date formatter was kept over the brief's illustration.** The spec asked for "Aug 12-Aug 25"; the board's existing formatter renders "12 Aug-25 Aug" outside the US. Pinning the order to match the example would have put TWO date formats on one board, because the summary strip directly beneath the titles uses that same formatter for its best-day label. One format per board beat matching the illustration. US users see exactly the spec's string; everyone else sees their own convention.

**A typed reversed range SWAPS rather than errors.** The picker itself cannot produce one (the To field's floor tracks From), so this only arises from keyboard entry mid-edit. A board that renders the honest range beats a board that refuses and explains.

**"Today" as a preset is a LENS, not a second Dashboard.** The Dashboard remains the today cockpit; Insights with Today selected is the analytical view of the same day. The doctrine is intact and this preset does not erode it.

### Drag-to-nest explains its refusal

**The refusal had no code point to hang feedback on, and finding that out cost the round's first build.** The task assumed both hostnames and the mismatch verdict were in scope at the moment of refusal. They are not: every target search pre-filters by domain and returns before capturing the rejected tile, so a mismatched drop and a plain reorder produce the identical null. Refusal was implemented as never-seeing.

**Pure drop-time geometry cannot see the rejected tile either**, which is the finding worth keeping. A non-matching tile is never frozen, so SortableJS slides it aside as the drag approaches: measured with real drags, the intended target was already 81px away before the cursor arrived and 104px away at `onEnd`, while the nearest tile to the drop point was the dragged tile itself. The "drop onto a tile" moment does not geometrically exist for the only case this feature is about.

**Shipped mechanism:** the target is read from `evt.related` in `onMove` — the tile SortableJS is about to displace, captured before it moves, at no cost because that handler already reads the value — and the 60px hit test is applied to the SLOT the drag landed in rather than to the target. Same constant, same geometry, asked about the landing instead of the destination. That slot gate is what keeps a sweep into empty space silent.

**Verdict and display come from different functions on purpose.** The mismatch verdict is `getMatchKey`, the matcher's own value, so one notion of sameness exists. The toast names hostnames via `getBaseDomain`, because match keys are synthetic for aliased hosts and "meta-ads and google-docs are different sites" is not a sentence. Matcher, hint and nest mutation path were untouched throughout, per the twice-confirmed as-is decision.

### Rate links move to the modern store host, with NO tracking parameters

Both Rate surfaces pointed at the pre-2023 `chrome.google.com/webstore` host. It still redirects, but a redirect is not a contract. **No UTM or campaign parameters were added, deliberately.** These are in-product asks shown to people who already installed the extension, not acquisition links: tagging them would fold existing users into campaign reporting and quietly corrupt the numbers that are supposed to measure new reach. The store-generated slug is copied exactly as the listing serves it, truncation included, because the store owns that string.

### `tracking.js` NUL separators escaped; BUGS.md M1 resolved

The composite-key separator was written as a raw 0x00 byte, which made the whole file binary to ripgrep and grep — a tree sweep for a symbol the file DEFINES returned only `newtab.js`, with no error. **This is a source-byte change with no runtime change**, and that was proven rather than asserted: the escaped literal was extracted from the patched source and compared against the same literal extracted from the pre-change file, then the real rollup spine was driven end to end, with three seeded wrong separators to show the assertions could fail. M1 is marked resolved rather than deleted, because the CLASS of trap outlives this instance — any file that acquires a NUL goes silently invisible the same way.

**A label correction while here:** Asana comments on the `[1.2.2]` round refer to a "D14/D16 ink doctrine". No such rule exists under those numbers. The ink doctrine is BUGS.md **Section O**, enforced by `tools/check-panel-ink.mjs`; D14 is about routing decisions inheriting their destinations' premises. The mislabel lives only in Asana comment text, so nothing in the docs was changed to chase it, and BUGS.md D16 now says so explicitly.

---

## 2026-08-30 - the 2.1.0 bundle: Notes v1.1 as shipped, lifetime totals, Backup and Restore, variant disambiguation

Five subsections. The first four are what four feature arcs decided while building; the fifth is the release those arcs are being packaged into. Asana: Notes 1214828205178648 / 1214828112367791 / 1214828143535448 / 1214828143468800 / 1214828347776047, lifetime 1217404571388348, backup 1216777305263735, variants 1217948890038248, release shell 1217967430924095.

### Notes v1.1: what shipped, and how far it moved from the spec

`SPECS/notes.md` was written in May 2026 against a full-tab feature. **Samson saw the first real render on 2026-08-29 and redirected the design that day**, and almost every interaction decision below dates from after that moment. The spec has been reconciled to shipped reality in this same commit; this entry is why each line moved.

**NO DEDICATED NOTES TAB.** Notes are the right-hand panel of the **Tasks** tab, roughly 80/20 with a 260px floor on the panel, stacking below the tasks content under 900px viewport width. The spec's greyed-Notes-tab and its free-preview concept both died with the tab. The breakpoint was bisected rather than guessed: the tasks body first overflows at **730px**, and 900 was chosen deliberately to leave 170px of clearance above the measured cliff rather than shipping at it. The tab was removed from the bar entirely, so the shipped tab set is unchanged from before the arc: home, tasks, dashboard, insights.

**GHOST NOTE, AT THE TOP OF THE STACK.** The only creation affordance. It replaced both the "+ New Note" header button and the click-empty-space behaviour, because discoverability was the actual failure ("it just kind of appears and you have to learn it"). It is a dashed, faded, un-rotated, curl-less card in the paper idiom, and **it doubles as the zero-notes empty state**, which is what removes the second branch a separate empty state would have had to keep in sync. It shipped at the END of the stack and moved to the TOP in `c48c411`: notes insert at array top, so the invitation now sits exactly where the result lands, and the control is reachable without scrolling at 0, 8 and 50 notes. The trade was taken deliberately: the ghost's slot costs one visible note.

**ARRAY ORDER IS CANONICAL; `position: {x, y}` IS DORMANT.** The 2D drag-positioned corkboard the spec describes is not what shipped and is not planned. Notes reorder vertically within the panel by drag, and **the array is the order**. This was forced by a contradiction found in the `[1.1.2]` premise audit: `[1.1.1]` produced newest-first by **sorting on `createdAt` at render time** while `Storage.createNote` pushed to the array END, so the display was a reversal of storage and a committed reorder would have been silently re-sorted away on the next render. "A drop had nowhere to commit to." The sort is gone; newest-at-top is a real array position via a caller-side unshift, leaving the shared `createNote` primitive untouched. The `{x, y}` field survives in the data model, unread and unwritten, marked reserved in `storage.js` - no migration, no semantics, and **`[1.2.0]` Notebooks must not assume it holds anything**, which supersedes that section's x-coordinate clamping plan.

**SEARCH IS COLLISION-GATED AT MORE THAN SIX LIVE NOTES**, and is text-only. Below the threshold the input does not render at all, because "doesn't look too busy" is the ratified state being protected and a permanent search box on a 20% column is pure chrome. Tag-chip filtering is cut until a tag-assignment affordance for notes exists, which it does not. **Reorder is disabled while a filter is active**: dragging a filtered subset would silently rewrite the positions of notes the user cannot see, and simple-and-honest beat clever-and-lossy.

**TRASH: A STICKY FULL-WIDTH FOOTER BUTTON, AND NO DRAG-TO-TRASH.** The spec's bottom-right trash can that notes are dragged onto is cut on a mode conflict: SortableJS reorder owns dragging in that column, and a second drag semantic in the same space is exactly the Section I hazard. Deletion already has two good affordances (the per-note hover trash and the menu item), so the trash became purely the entrance to the trash view. It took three rounds to look right, and the sequence is worth keeping because each step was a real finding: a slim strip that was unreachable below 900px where the panel stops scrolling itself (`fae4054`, fixed with `position: sticky; bottom: 0`, which is inert in the branch where nothing scrolls past it); then Samson's "pretty ugly" veto, answered with a full-width button measured computed-style-identical to the header buttons on radius, type ramp, weight, border and padding (`7bcd089`); then the removal of the scrim the slim chip had needed and the button did not, which had stopped being a backdrop and become a dark slab painted around the button (`0c20d22`). The footer renders only when the workspace has trashed notes, mirroring the search threshold.

**PROMOTE-AND-DELETE IS A CHECKBOX IN THE MODAL, NOT A MENU ENTRY.** The spec's four menu entries (promote to task, promote to goal, and an "and delete" variant of each) collapse to two, with "Delete note after creating" living inside the pre-filled creation modal, default unchecked. Two entries keep the menu tight and **the choice lives where the confirmation happens**. Promote stays copy-semantics by default; a cancelled modal creates nothing and deletes nothing, and a failed creation leaves the note alive.

**THE DESCRIPTION FIELD ON NEW TASK AND NEW GOAL.** The build halted here rather than working around it: the spec assumes "full content to description", and **neither creation modal had a description field at all** - task rendered Name/Priority/Due date, goal rendered Name/Deadline, zero textareas between them - while both data models had stored `description` all along. Samson's call, mid-build: add it to both, always visible, as a textarea rather than the single-line input the goal-template editor uses, because a note is multi-line. This is the most broadly visible thing the Notes arc changed: **every user meets it whether or not they ever touch a note.**

**KEYBOARD SCOPE CUT TO FOCUS ACCESSIBILITY.** Tab/Shift+Tab across notes, Enter to edit the focused note, the existing Escape-saves, ARIA labels on every interactive control, tier-aware focus rings. **Ctrl+N and arrow-key spatial navigation are cut**: the standing click-only rejection is about shortcut-driven navigation, arrow-nav over a simple vertical list adds nothing Tab does not, and a global create shortcut is the exact adjacency that rejection warns about. Reopens with data if real users ask. A known consequence, accepted rather than fixed: tab traversal alternates note, delete, note, delete, which is 100 stops at 50 notes; a roving-tabindex pattern is the answer **if** keyboard-heavy users materialise.

**GATE INHERITANCE, AND THE STATE MAP THAT CORRECTED THE PLAN.** Notes inherit the Tasks tab's gate because the live panel is emitted inside `renderTasksTab` and the preview column inside `renderTasksPreview`. The May plan assumed four states with a read-only fallback on expiry. There are **five**, and there is no read-only fallback: `expired` is the same full preview lockout as `free`, byte-identical on both lapse paths, differing only in CTA copy. The full map now lives in CLAUDE.md as a product fact. One real gap was found and closed by this audit: **the preview rendered the ghost note - a create affordance on a surface that can never create anything.** Preview-is-the-promise enforced at the pixel level.

**DEFAULT PAPER COLOUR, WITH CYCLE AS THE ABSENT DEFAULT.** One setting in Pro Settings, stored as a palette token name (never a hex, so a palette change is a CSS edit and not a data migration). Precedence is explicit-choice > setting > cycle, and **absence means cycle**, so `[1.1.3]`'s count-keyed rotation stays the untouched default. The spec's auto-save indicator is cut (a non-settable setting is furniture) and its "clear all trash" is cut (Empty Trash already lives in the trash view).

**`unlimitedStorage`: MEASURED-NO.** Decided on numbers, not vibes (Asana 1217942581701884). A realistic seeded profile used 411,980 bytes of the 10,485,760-byte quota, of which the custom wallpaper key alone was **88.6 percent** - wallpapers are stored as base64 data URIs after a 1920-wide JPEG re-encode. A plain-text note is roughly 450 bytes, so it would take about **22,000 notes** to exhaust the remainder, and the pathological case (a 5MB wallpaper plus 2,000 notes) still sits at 59.1 percent. Re-check triggers, since the answer is contingent rather than permanent: notes gaining rich content that embeds images as data URIs, a workspace expected to exceed ~5,000 notes, or wallpaper handling changing to store originals.

### `[2.1]` Lifetime focused time per task

**FOCUSED, never blended with worked.** The two clocks answer different questions and the vocabulary law is absolute: this figure is engine-measured focus time and is never summed with, or described as, the wall-clock worked figure.

**The accumulator lives on the tracking store and is incremented INSIDE the session-close write.** Not in a second write afterwards. A separate write could be interrupted between the two, leaving the aggregate and the accumulator describing different histories; joined to the existing write, the worst case is stale-never-wrong. This is the concrete case behind BUGS.md **L3**.

**The backfill is honest about what it does not know.** Existing installs have months of aggregates and no accumulator, so the first read backfills by summing `byTask` across the retained days and **stamps a `since` anchor** at the earliest day it actually saw. The surface then says "focused since 1 July" rather than implying a lifetime it cannot substantiate. Two defects were found in building it, both worth the record: it ran AFTER the rollup at first and double-counted the closing session exactly 2x, so it now runs before; and it read `agg.dayKey` where the product's own `emptyDay()` names the field `agg.day`, which made the anchor fall back to `Date.now()` and would have claimed "focused since today" over months of history. **The console harness was green through both, because the fixture had been hand-written with the same wrong field name.** That escape is now BUGS.md **Q13**.

**Purged tasks are collected by announcement, not by polling.** The purge sweep announces what it removed and the tracking layer listens, rather than every reader independently filtering. The underlying constraint is permanent and is now BUGS.md **E6**: `tracking_days` is never swept, so its `byTask` maps retain ids for long-purged tasks, and any consumer summing them must filter to tasks that still exist.

**The lifetime line is suppressed while it can only repeat the 30-day figure.** It renders once it can differ from the window, and the threshold is derived from the retention constant rather than a restated 30. Same philosophy as the search threshold and the trash footer: a surface that can only tell you something you are already being told is noise, so it does not appear. `e2ff2a9`, `df7735b`.

### `[1.3.0]` Backup and Restore: both rounds

The option analysis - full `chrome.storage.sync` and hybrid partial sync both rejected, local export/import chosen, cloud backup rejected - was settled on 2026-07-22 and **is recorded in that dated entry above; it is not restated here and is not reopened.** What follows is only what building it decided.

**THE v2 ENVELOPE.** `{ launchpadBackup: true, version: 2, exportedAt, appVersion, stores: { data, launchpad_background, tracking_sessions, tracking_days } }`. The store names ARE the storage keys, so an envelope reads as a map of what it holds rather than as aliases needing a decoder. v1 files are accepted forever, detected and imported as the partial restore they are, with the confirm naming exactly what an old file does and does not carry.

**THE LICENCE WAS NEVER A COVERAGE GAP - IT WAS A TRUST PROBLEM.** The July scope said the envelope must add "the license key". It does not, and never needed to: the licence lives in `data.pro` inside the `data` key, so v1 backups already carried it and a separate `stores.license` would duplicate it. The real hazard is the opposite one: restoring `data` raw-writes `lastVerifiedAt`, so **a file carrying a recent verdict would grant offline grace regardless of what the licence is worth now.** Import therefore clears the verdict (`lastVerifiedAt = null`, status back to free) and re-enters `ensureValidated(force)`. **`instanceId` is deliberately KEPT**, because clearing it forces a fresh `activate()` and burns an activation seat every time someone restores their own backup onto their own machine.

**AN OPEN SESSION IN A BACKUP IS CLOSED, NOT RESTORED.** A backup captures whatever session was open at export. Restoring it hands the engine a session whose start is arbitrarily far in the past, on a domain the user is not looking at, and the next boundary would bank that entire stretch as focus that never happened. The restore closes it from `lastEventAt` and rolls it up - exactly what `reconcileOrphans` already does to a session the engine cannot trust - keeping the focus up to the export and inventing nothing after it. Engine stores are restored through `Tracking.restoreStores` on the engine's own queue, because a raw write could interleave with an in-flight sync and be silently overwritten.

**NO DOWNGRADE MIRROR, accepted with its consequence stated.** A v2 file cannot be read by the shipped 1.0.5 importer, which looks for a top-level `data`. Mirroring `data` at the top level would fix that and roughly double every backup file forever. Rejected: 1.0.5 cannot produce a v2 file, the downgrade-mid-restore path is vanishingly rare, and the cost is permanent.

**THE PRO LAYER IS AUTOMATION, AND IT NEVER DELETES ANYTHING.** A weekly alarm writes the same envelope to `Downloads/LaunchPad Backups/` with dated filenames and `conflictAction: "uniquify"`, so a second run the same day sits BESIDE the first rather than over it. No code path in the extension calls `downloads.removeFile`, `erase` or `cancel`, and that property is asserted two independent ways. **The Downloads folder is the user's territory**; an extension deleting files there is a trust violation regardless of intent, and small weekly JSON files accumulating is the honest trade. The off-machine story costs no cloud API at all: most consumers' Downloads folders are already synced by OneDrive, Drive or iCloud.

**`downloads` IS AN OPTIONAL PERMISSION**, requested at the moment the toggle is turned on and never held otherwise, so there is no install warning and no re-consent prompt. Default OFF. Three gates, each a silent skip rather than an error: toggle off, Pro lapsed, permission revoked - and the revoked case turns the stored flag off and clears the alarm so the settings surface tells the truth next time it opens. **The release consequence: the 2.1.0 permission diff against 2.0.0 is NOT empty.** The release-engineering premise changes from "diff is empty" to "diff is exactly the optional `downloads` addition", which needs a justification in the store listing at submission.

**THE FREE-USER BACKUP NUDGE IS CUT.** The original scope had a periodic toast reminding free users to back up. A recurring prompt asking users to do chores contradicts the quiet product; the settings surface is the free floor and Pro automation is the adoption answer. Reopenable if churn data ever argues otherwise. Export itself stays free, unchanged: exporting your own data is a right, and "pay to not lose your stuff" contradicts the brand.

### Variant disambiguation: a second line only where the list is blind

Two nested shortcuts with the same title render as identical dropdown rows, so choosing between them is clicking blind. Reading page content to learn a real account identity is **permanently out of scope** - it needs content scripts and host permissions on user sites, the exact permission detonation the ad-blocker rejection documented - so the only honest source is the address already stored.

**COLLISION-ONLY.** A row gains a second line only when another row in the same dropdown shows an identical title. Unique-titled dropdowns are unchanged to the pixel. Same threshold philosophy as the notes search and the trash footer.

**AN ESCALATING LADDER, NOT A FIXED FIELD.** Candidates are tried cheapest-first - trimmed path, host, host+path, path+query, host+path+query - and **the first that tells every colliding row apart wins.** A fixed "path, then query" rule would have had to answer "same address" for two tiles on aliased hosts with identical paths, which would be false. Leading path segments every colliding row shares carry no information and are dropped, but never so far that a bare `0` is all that survives: two segments are kept when the path has them, which is what turns `/mail/u/0` and `/mail/u/1` into `u/0` and `u/1` rather than `0` and `1`.

**"SAME ADDRESS" IS THE HONEST ANSWER, NOT A FALLBACK.** When two tiles genuinely point at one address, the row says so rather than inventing a difference it cannot know. The phrasing matches the existing nest-refusal toast, which already says "Nest tiles from the same address".

**RENAME WINS, AND THE ANNOTATION HEALS ITSELF.** Variants could already be renamed by hand, which stores a `customLabel`. This ships as the truthful DEFAULT for anyone who has not renamed, and defers to the rename when they have: renaming one of a colliding pair ends the collision, and both second lines are recomputed away rather than left stale. `5d9d11f`.

### The 2.1.0 release shape

**Locked 2026-08-30.** The batch deferred on 2026-08-29 ships as **2.1.0**, not as the point release it was built as. Contents: **Notes v1.1 complete** (the marquee), lifetime per-task totals, Backup and Restore, variant disambiguation, the Description field on both creation modals, the `+ New Tag` button in the Tasks header, and the full 2.0.1 batch riding along (the `tracking.js` NUL escape, the drag-to-nest refusal toast, the Rate-link host modernization, and the Insights date-range selector with its custom calendar).

**NAMED SESSIONS ARE DELIBERATELY HELD** as the 2.2 headline candidate rather than folded in here. A release needs a headline, and 2.1.0 already has one.

**Nothing about the release is decided until submission.** Asana 1217967430924095 remains the release-engineering shell: its sequence runs as written when the bundle closes, the version number is applied then, the annotated tag goes on the exact commit submitted, and **the artifact is built fresh from that commit** rather than resurrected from any surviving zip. The 2.0.0 and 2.0.1 artifacts were both retired for that reason and are reproducible from `92eeb68` and `23a250f`.

---

## 2026-08-31 - the named-sessions arc, the task options pill, goal completion, and two conventions

Five subsections. The first three are feature arcs; the last two are conventions that
came out of them and now bind future work. Asana: named sessions 1217940376018210 /
1217974084201923 / 1217974156997355 / 1217974247458001 / 1217982049281072, task options
pill 1217980262292381, goal completion 1217981037474018.

### Named sessions, as shipped

A user-named saved set of tabs that launches as a unit. Filed 2026-08-28 as a candidate out
of a competitor review and built across `[1.4.0]` to `[1.4.4]`.

**THE FIELD IS `ws.namedSessions`, AND THE QUALIFIER DOES SEMANTIC WORK.** "Session" already
meant FOUR things in this codebase before this arc, not the three the plan expected: the
tracking engine's focus records (`tracking_sessions`, 184 occurrences in `tracking.js`), the
5-minute auto-restore's saved tabs (`savedSessions`, user-facing as "Restore Session"), Pomodoro
focus sessions (user-facing as "Focus session"), and the browser-restart anchor
(`anchorBrowserSession`). The decisive argument was not the count but one specific collision:
`savedSessions` and a bare `ws.sessions` would have been **the same noun for two systems that
both save tabs**, with near-identical semantics, deliberately zero shared storage or lifecycle,
and only their capture rules in common. That is precisely the shape that produces a
wrote-to-the-wrong-system bug. "Named" is exactly the property distinguishing these from the
ambient unnamed autosave, so the qualifier earns its length. Every identifier derives from it,
and the id prefix is `nsession_` because `tracking.js` already owns `sess_` — a literal collision
is impossible across separate stores, but a grep for one must not surface the other.

**SESSIONS ARE FREE; ATTACHMENT IS PRO BY INHERITANCE.** The launcher is the free tier's
identity and sessions are launching, so gating them would have put a save-and-reopen feature
behind the paywall while `/compare/toby` argues the free tier covers save-and-reopen without
Toby's 60-tab cap. Pro's story is measurement and focus and does not need this. Attaching a
session to a TASK is Pro because tasks are Pro — nothing was built to enforce that, it follows
from the Tasks tab's own gate. What was built is the honest degradation: the attachment entries
are **absent** rather than disabled on free and expired profiles, per the preview rule, and the
stored `taskId` is untouched so it returns intact on upgrade. Absent also means **no upsell in
the free flyout**; a hint about a Pro pairing is an upsell wearing a hint's clothes. Verified in
all five gate states, with expired — sessions fully working while the Tasks tab shows preview
copy in the same profile — exercised explicitly as the combination most likely to be wrong.

**PLACEMENT IS A SIDEBAR FLYOUT, TWINNED WITH RESTORE SESSION.** The sidebar is already the
tabs-come-back neighbourhood and the grid's calm stays untouched. It is Restore Session's twin
by construction: one more `button.sb-item`, one more static dropdown, one more
`SIDEBAR_PANEL_CHAIN` entry, reusing `.restore-header` outright. Two follow-ups came out of that
twinning and both are deliberate. The two flyouts had carried **byte-identical background values
in four separate blocks**, which is how twins drift apart the first time one is touched; they now
share one rule per tier, and **Restore Session therefore changed appearance too, on purpose**.
And both twins now dismiss identically on outside click and on Escape, closing a divergence where
Restore closed on Escape and Sessions did not.

**LAUNCH OPENS A NEW WINDOW.** A named session IS a context, and contexts get their own window.
One `chrome.windows.create` with the stored urls in order; the originating window is untouched.
Current-window launch can join later as a secondary action if real use asks for it.

**CAPTURE IS AN ALLOWLIST: `http`, `https`, `file`.** Everything else is declined, so a scheme
nobody has thought of yet fails CLOSED. This deliberately does NOT inherit the 5-minute
auto-restore's filter, which declines only `chrome://` and `chrome-extension://` and would have
carried that gap forward. A known and accepted consequence: **Edge's own new-tab page is an
HTTPS url** (`ntp.msn.com`) and is therefore captured, where Chrome's `chrome://newtab` is not.
Special-casing a vendor host is the alternative and was rejected as worse than the asymmetry.

**FAVICONS ARE CAPTURED AT SAVE TIME, NEVER DERIVED.** The plan asked for icons "via the app's
existing favicon idiom" AND "no external favicon service"; those turned out to be incompatible.
`getFaviconUrl`'s third priority is **Google's S2 service**, reached by every domain outside an
8-entry curated map whose values are themselves external hosts, so deriving icons would have sent
every domain in every saved session to Google on every render. The nearer precedent is the
`[1.2.1]` Time-by-Site decision (raw hostnames, no favicons ever, because browsing-domain rows
must not go to an icon service) rather than the shortcut grid, since a captured tab list is the
same category of data as a Time-by-Site row. So the page's own `favIconUrl` is stored at capture
and the bundled placeholder is the fallback. Proven with the network log: 22 rendered sessions
produced zero favicon requests of any kind. **The grid's own S2 use is now a filed
privacy-posture question rather than an unexamined assumption.**

**ARRAY ORDER IS CANONICAL**, matching the notes precedent, position-free, with no `tagIds` and
therefore no tag-cascade obligations. `namedSessions` registered in the purge sweep's enumeration
in the same commit that introduced the entity, per **BUGS.md E5/E7**.

**ATTACHMENT IS WRITTEN ON THE SESSION ONLY, AND BOTH INVARIANTS LIVE AT THE STORAGE BOUNDARY.**
`session.taskId` is a forward reference and is never mirrored onto the task, so there is one place
to write and one to read. A task has at most one session and a session at most one task; both
halves are enforced in storage rather than in the UI, which is why `taskId` is deliberately NOT
routed through `updateNamedSession`'s generic partial — that path cannot see sibling sessions and
so cannot hold the one-session-per-task half. Attaching a session that is already attached MOVES
it, with a confirm naming both tasks. Reachable from both sides, and the two entry points were
proven to write byte-identical stored JSON. **A permanently deleted task NULLS the reference and
keeps the session** — a saved tab set is user work in its own right and must not die with the
task it was attached to — registered in all three permanent-removal paths, before the write.
Soft-delete leaves the attachment intact so a restore returns it whole.

**LAUNCH-ON-ACTIVATE WAS REJECTED IN FAVOUR OF A ROW CONTROL.** Activating a task must not spawn
a window as a side effect; a click that opens six tabs should be a click the user aimed at. The
launch chip on the task row reaches the same place in one gesture and keeps activation meaning
what it means today. Reopenable if real use argues for it, and recorded so it is not relitigated
silently. The chip joined the flex chip cluster in `.tt-task-main` rather than
`.tt-task-controls`, which is a fixed four-column grid where a fifth member would have taxed
every row about 30px of name width, attached or not; it returns `""` when there is no
attachment, and unattached rows were proven byte-identical before and after.

**FOCUS PAIRING: DECIDED, NOT BUILT.** Launching a session and starting a focus session are two
intentions, and one click doing both is the same overreach the launch-on-activate decision
rejected. If it is ever wanted it is an explicit separate control. This closes the question the
arc carried from `[1.4.2]`, rather than deferring it a third time.

**THE TRASH VIEW CLOSES THE ARC'S OWN GAP.** Deleting a session soft-deletes it behind a 5-second
Undo toast; once that toast expired the session was unreachable for 30 days until the purge
removed it — alive in storage, counting down, with no surface. The same family as the
stranded-task bug below: data alive, no surface. The way in is the **last row of the sessions
list** rather than header chrome, so it reads as the end of the same collection, and it renders
only when something is in there, so at zero trash there is no control and no gap. It reuses the
shared `tt-trash-days-*` countdown bands and the retention constant rather than restating 30, so
the three trash surfaces cannot drift on what urgent looks like.

Building it exposed **two dismissal defects in the flyout-plus-modal relationship**, one of them
already shipped. A click inside a modal spawned from the flyout counted as an OUTSIDE click and
closed the flyout underneath it, because `PANEL_OVERLAY_SELECTORS` did not list
`.tt-modal-overlay`; and one Escape press closed both the modal and the flyout, because the
global sweep and the modal's own handler both fired. The governing rule, now written down in
both code paths: **a spawned overlay is not "outside" the panel that spawned it, and it is not
deaf to the key that dismisses it either.** See BUGS.md **E7** and **N3**.

### Completing a goal RELEASES its unfinished tasks to standalone

A pre-existing bug, found while fixing the goal picker: a goal's unfinished children belong to
none of the three lists the Tasks tab draws (active goal cards, the standalone list, the
Completed box, which lists a completed goal as ONE row plus completed STANDALONE tasks). So
completing a goal with an unfinished task inside it made that task invisible while it was still
incomplete and undeleted in storage. **This is not theoretical: Samson's real profile carried
twenty tasks stranded this way.**

**COMPLETION NOW RELEASES UNFINISHED CHILDREN TO STANDALONE IN THE SAME WRITE, behind a confirm
naming how many will move.** Standalone is where an orphan belongs, it needs no new surface, and
nothing can hide afterwards. Two alternatives were rejected: refusing completion while unfinished
tasks remain blocks a legitimate action for a bookkeeping reason, and teaching the Completed box
to list a completed goal's children leaves tasks in a container that renders nowhere else and
multiplies the places completion state must be reasoned about.

Four things about the shape. **Only `goalId` changes** — name, priority, due date, tags and
tracked time are untouched, and the release is deliberately NOT routed through
`reassignTaskToGoal`, which also swaps the goal's auto-tag: the user did not ask to leave the
goal, the goal ended underneath them, and silently stripping a visible tag would be a second
surprise stacked on the first. **COMPLETED children stay put**, because the completed goal's own
row represents them and moving finished work to Standalone would be wrong. **Both completion
paths release**, including the auto-complete branch that cannot currently strand anything — the
rule belongs to "a goal became completed", not to one caller's reasoning about who is left (see
BUGS.md **Q14** for why that call is asserted structurally rather than behaviourally). **No
confirm appears at all when nothing is unfinished**, so the speed bump only exists when something
real is about to move.

**A ONE-TIME MARKER-GUARDED SWEEP repairs existing profiles**, releasing tasks whose goal is
live-but-not-active. The marker (`data.__strandedTaskSweep`) rather than natural idempotency is
the point: unlike the `ensureX` family, which repairs SHAPE and can safely re-run, "release
everything in a non-active goal" is a judgement about HISTORY and must never run twice. The sweep
is silent; a one-time toast was considered and left out, because it fires on a load the user did
not initiate and an unexplained message about tasks moving is its own confusion.

**REACTIVATING A GOAL DOES NOT RE-ADOPT ITS RELEASED TASKS.** They belong to the user now, and
silently re-adopting work that may have been edited since would be a third surprise. **Goal
DELETION is unchanged and was already safe** — it soft-deletes children in the same write, so
they appear in the Deleted box and restore normally.

### The task options pill

Task rows reached their context menu only by right-click, while goals carry a visible kebab. Now
that the menu holds genuinely useful entries, the affordance had to become discoverable.

**HOVER-REVEALED, AND KEYBOARD-REACHABLE.** These pull against each other and the brief asked for
both: a control injected only on hover cannot be tabbed to. Keyboard reach won, so the pill is in
every row's markup at `opacity: 0`, revealed on row hover and independently by `:focus-within`.
The stronger claim that is actually true was then proven instead of the literal one: **rendered
layout is pixel-identical to master** across four rows including a truncating one, measured by
stashing the working files, reloading so the page ran the real prior build, and capturing
like-for-like. It rests at `opacity: 0` where the goal kebab rests at `0.6`, a deliberate break
from that family: a goal card has one kebab, a task list has one per row, and a permanent column
of dots down the right of every row is noise the goal header never had.

**PLACED IN THE NAME CLUSTER, FOR ZERO WIDTH COST, decided by measuring a real row rather than
reading the CSS.** There are 8px to the right of the trash, nowhere near enough; `.tt-task-controls`
is a fixed four-column grid where a fifth member costs every row about 30px of name width. But
`.tt-task-main` is `flex: 1` and packs left, leaving 179px of dead space at its right edge even
on a row whose name truncates. The pill sits there, out of flow, pinned to that cluster's right
edge — at the opposite end of the row from the drag handle, so two faint hover controls do not
compete in one corner.

**PRIORITY OPENS THE SHIPPED POPOVER rather than a submenu or an inlined list.** It reuses the
control whole, so the four levels, the active marker and Clear stay defined in exactly one place,
and it adds no interaction pattern this codebase does not already have — there is no submenu
anywhere in it. A submenu would need positioning, edge-awareness and keyboard handling invented
from scratch; an inlined list would be a second definition of the same choices, and the day a
fifth level appears only one of them learns about it.

**ASSIGN TO A GOAL was an EXISTING capability**, not new functionality: cross-goal drag already
ran through `reassignTaskToGoal`. Both of its rules carry over to the menu path unchanged, and
the second one matters — a collision moving INTO a goal offers the next unique name, while a
collision moving OUT to standalone is **refused outright**, never silently renamed. The two
collision strings are now extracted so the drag path and the menu path share one definition.

**ROW CONSOLIDATION REJECTED: the row keeps its flag and its trash.** The pill duplicating them
is acceptable, because one click beats two for the two most-used controls and Samson has muscle
memory for both. The pill's job is the things that had no home.

### The modal footer convention

`openTasksModal` always emitted its own Cancel button, so the three pickers — which commit
nothing, because selection is by row click — were passing `primaryLabel: "Cancel"` and rendering
**Cancel | Cancel**, with the affirmative slot occupied by a dismissal.

**THE RULE: a modal that COMMITS keeps Cancel beside its primary; a modal that commits NOTHING
carries ONE dismissal, in the primary slot, named for what it does.** "Close" for a list you
browse and leave, "Done" for a view you finish with. `hideCancel` is the opt-in that suppresses
the redundant button and **defaults to `false`**, so every other caller's footer is byte-unchanged
— proved by a standing control asserting that New task still reads `[Cancel, Create]` rather than
assumed. Hiding the button removes no way out: the X, the overlay click and Escape all route
through `doCancel` independently of it, and `defaultFocus: "cancel"` now falls back to the primary
when Cancel is absent, so a keyboard user is never left outside the dialog.

**A CONFIRM IS A COMMITTING MODAL AND KEEPS ITS CANCEL.** That is the judgement that stops this
from being swept across every footer in sight: the notes trash view carries `[Empty trash, Done]`,
while the "Empty the notes trash?" confirm it raises keeps `[Cancel, Empty trash]`.

**A PICKER'S TITLE AGREES WITH THE ENTRY THAT OPENED IT**, not with a sibling picker's phrasing.
Five surfaces now opt in (three pickers, the templates panel, the notes trash view).

### The website vocabulary rule for "session"

The compare pages now carry **three** senses of the word: the five-minute auto-restore, Pomodoro
focus sessions, and named sessions. The extension solved this in code by qualifying the field
name; the pages have to solve it in prose.

**WHEREVER "session" APPEARS ON A PAGE, NAME THE DISTINGUISHING PROPERTY IN THE SAME BREATH** —
automatic and unnamed, deliberate and named, or a timed stretch of focus. Never add an
undifferentiated third. **If a sentence cannot carry both the capability and its distinguishing
property without becoming clumsy, split the sentence rather than drop the distinction.** This is
the same reasoning that produced `ws.namedSessions`: two systems that both save tabs, described
by one noun, is the shape that makes a reader reach for the wrong one.

Named sessions also change what the compare pages can honestly claim. The `/compare/toby` table
row conceded deliberate saving to Toby ("Collections and spaces; session save" against
"Groups with open-all; session auto-restore"), which read as though LaunchPad answered a
deliberate save with an automatic backup. That is no longer true, and the free-tier claims —
still written about shortcuts only — now have a stronger version available, since named sessions
are free and uncapped against a competitor whose free plan caps at 60 saved tabs.

---

## 2026-08-31 - localization: the hybrid mechanism, the escaping inversion, and the pause at R4

The `[1.5.0]` arc, Asana 1217984014133950. Four rounds merged (R1 through R4), R5 scoped
and not started. **Nothing here is user-visible: no string is translated, English is the
only catalogue, and the product renders exactly as it did before.** The value delivered is
that ~440 messages now have identifiers, descriptions and a single source of truth, and
that the machinery to add a language exists.

### The mechanism is HYBRID, and that is not a compromise

`_locales/en/` plus `default_locale` carries the **manifest's two strings**, because that
is the only way to localize the extension name and description, and it is also what
localizes the **Chrome Web Store listing** - which for a non-English market is plausibly
worth more than every in-product string combined.

An **internal catalogue** (`i18n.js` plus `locales/en.js`) carries the ~761 UI strings, for
two reasons `chrome.i18n` cannot answer. Twenty-eight strings need real plural categories
and `chrome.i18n` has none, so putting `Intl.PluralRules` on top of it means writing the
catalogue anyway with a redundant layer underneath. And `chrome.i18n` follows the browser's
UI language with **no override API**, while an internal catalogue can offer runtime
switching. "My browser is English and I want LaunchPad in Indonesian" is a real case for
this audience, and the platform API structurally cannot serve it.

`i18n.js` deliberately never touches `document`, because it also loads in the service
worker. The DOM pass is a separate file added in R2.

### The escaping decision INVERTED the original specification

The plan specified that the primary accessor escape by default, with a raw accessor for the
few sites that compose markup. Two measurements reversed it, and the reversal is ratified.

**Zero of 431** unique user-visible strings contain inline markup, so a raw accessor would
have had no legitimate caller and its only possible use would have been misuse. And
`openTasksModal` already escapes at its own sink while roughly 120 sites are text sinks, so
a pre-escaping primary would have **double-escaped** and printed `Backup &amp;amp; Restore`
to users.

**So the SINK decides, not the accessor and not the string.** `t()` returns plain text;
`th()` returns the escaped form for concatenation into markup. The fail-safe property
survives the inversion because the two mistakes are asymmetric: `th()` at a text sink is
loud and cosmetic, `t()` into `innerHTML` is silent and dangerous. **Only the silent
direction is mechanically enforced**, and the visible one polices itself. Ledger: BUGS.md
**D21**.

Alongside it, and blocking the 2.1.0 upload rather than this arc: `esc()` escaped text but
not quotes while filling double-quoted attributes with user-typed session names. Fixed as a
CLASS rather than as the instance - the escaper itself, so every call site moves at once,
because a second attribute-only helper is a second thing to forget. BUGS.md **G5**,
`0641149`, bug 1217985856381677.

### Naming, and the split rule that came out of it

Keys are **`surface_element_purpose`**, and they are **sense-carrying on purpose**: a
catalogue keyed on English source text hands one translation to two strings that happen to
match, and every translation-memory tool does the same. The worked case is "Import", a noun
on three surfaces and a verb on a fourth. Each message also carries a **description**, and
the gate fails a message that has none.

**THE SPLIT RULE: a width-constrained label does not share a key with an unconstrained
heading.** Raised on the Tasks tab label sharing with the Tasks page heading, and then
applied by asking where else it held - which found **seven more**, all inherited from R2, in
the shape of a sidebar label sharing with the heading of the panel it opens. Eight splits
total. Two keys can carry one value; one key cannot carry two, and which lengths a language
needs is a translator's call rather than ours.

**What stays shared, deliberately:** a sidebar label and its OWN button's title attribute.
That is one control and one string, and a tooltip is not a second surface.

The eight split pairs keep **identical English values**. Splitting bought the option to
diverge; exercising it is a separate copy decision, and there is no evidence today that any
English tab label wants shortening.

### The placeholder convention

`{lowerCamelCase}`, naming what the value IS, never its type and never its position.

1. **Name the entity, not "name".** `{taskName}`, `{groupName}`, `{sessionName}`. A bare
   `{name}` tells a translator nothing about whether it inflects or whether it is a person.
2. **`{count}` is reserved.** It selects the plural form, so a second quantity in the same
   sentence takes a role name (`{openCount}`).
3. **A formatted value says so.** `{date}` is an already-rendered short date and must not be
   reformatted inside the sentence.

Named rather than positional because a translation reorders freely, and several shipped
sentences already start with their value. Where two counts are genuinely independent, the
sentence becomes **two messages** rather than one message with two selectors - the saved-tabs
toast is the worked case, where the second count inflects a verb as well as a noun.

A translated noun is never spliced into a sentence: "Permanently delete the {kind}" became
two whole messages, one per kind, because the article and the case move with the noun in
most target languages.

### Four scope decisions

- **The four Tasks sort options stay WHOLE** ("Sort: created", not "Sort: " plus a word).
  Splitting produces the sentence-assembly anti-pattern localization exists to remove:
  languages differ on whether the label takes a colon, whether the word inflects after it,
  and whether the label leads at all. The cost is that "Sort" is translated four times and
  could drift, which is a translation-QA problem with a known remedy; frozen word order has
  no remedy.
- **`privacy-policy.html` is excluded from localization by decision**, and the reason is
  recorded **in the gate itself** rather than only here. It ships, so it was in scope on the
  facts; extracting its values into a catalogue the page cannot read would create a second
  source of truth for text that is never translated, and two sources drift. Every other
  surface degrades to a missing label; a privacy policy degrades to a legal document showing
  message keys, served publicly. Revisit when a human translation is commissioned, and
  extract and wire it in one deliberate change at that point.
- **RTL is decided as logical-properties-going-forward, with no retrofit.** 114 physical
  direction properties exist and zero logical ones. Converting them is filed separately and
  is not a prerequisite for any translation round; authoring new work with
  `inline-start`/`inline-end` costs nothing and keeps the door open.
- **`gate.html` IS wired** (a user stopped mid-navigation is the last person who should meet
  an untranslated page); `offscreen.html` is dropped (a title on a document that never
  renders is not a user-visible string).

### The finish line is the PROBE, with the gate as a proxy

The instrument of record is a **pseudo-locale probe**: register a locale in which every key
resolves to a marker, switch to it, walk the surfaces, and read what stayed English. A
string that does not move is a string the catalogue does not govern - which is the question,
and one no static analysis answers.

The **site gate** is a fast proxy that runs in 0.1s, and it **must AGREE with the probe
rather than substitute for it**. The evidence for the rule is this arc: the gate reported
"76 await migration" while the probe found 81 ungoverned strings it structurally could not
see, and was simultaneously reporting twelve broken markers as compliant because it shared a
parser with the extractor that broke them.

**R5 therefore adopts a reconciliation step that runs both and FAILS ON DISAGREEMENT.** A
string the probe calls ungoverned and the gate calls migrated is a gate defect; a string the
gate reports that the probe cannot reach is a missing fixture. A third number rides with it:
literals the static scan classifies as messages that no enumerated state renders - the set
nobody can verify - driven to zero by ADDING FIXTURES rather than by deleting the check.
Ledger: BUGS.md **P7**.

### Two findings recorded here because they outlive the arc

**The achievements catalogue restates its own thresholds.** `INSIGHTS_BADGES` carries
`desc: "Organize 50+ shortcuts"` while `storage.js` holds `ACH_CURATOR_TARGET = 50`, and the
same for the goal, streak, deep-dive and variety targets. Change the constant today and the
badge advertises the old number: a live E7 instance. R5.3 closes it by interpolating
`{count}` from the constant rather than by retyping it into a sentence.

**The demo badge table words the same achievements differently from the real one**
("50+ shortcuts organized" against "Organize 50+ shortcuts"). Preview-is-the-promise says a
preview shows what the user would actually get. **DECISION: the real badge wording is
authoritative and the demo matches it**, resolved rather than translated twice.

### The pause, and why it is here

**Localization pauses after R4, with R5 scoped and not started.** The morning's pitch was
extraction and plumbing in one clear run; R5's scoping found ~350 messages across five
stages, thirteen surfaces and four structural pockets, comparable to R2, R3 and R4 combined.

None of it reaches a user until translations exist, which is a separate decision not yet
made. Meanwhile 102 users are on v2.0.0, which predates Notes, named sessions, Insights date
ranges, lifetime totals and Backup and Restore - all finished and sitting on master, with
the attribute-escaping fix waiting alongside them. **Shipping is what turns finished work
into value**, and the language-share evidence will still be there next week.

R4-complete is the cleanest boundary the arc offers: every round is merged, the gate is
green, and the probe's number is honest about its own coverage. Resumption starts at
**R5.0, the harness, before any string moves** - and its first act is to re-run the gate to
see whether anything added in the interim introduced new hardcoded strings, which takes
0.1s and is the point of having built it.

---

## 2026-09-01 - Expansion roadmap and design direction: rulings

Nine rulings taken while scoping the expansion arcs against the 2026-09-01 research pass.
Specs: Asana 1218038704670634 (expansion roadmap and design direction) and 1218038593317292
(notebooks and the surfaces that carry them). The research they were taken against is
`docs/RESEARCH/launchpad-expansion-research-2026-09-01.md`; the rules that follow from them
live in `docs/SPECS/design-guide.md`, whose Section 8 is the checklist every UI task pastes
into its PLAN.

### The design direction is the instrument panel, and Home is exempt

The product reads as an instrument panel: dense, calm, legible at a glance, with every
surface answering "what is true right now" rather than decorating. **Home keeps the
Google-default grid** and is deliberately outside that direction, because the launcher is the
free tier's identity and a user who installed a new-tab page for shortcuts did not ask for a
dashboard. The ink doctrine for all of it is **BUGS.md Section O**, Wallpaper-Panel Ink and
Stacking Context. Older Asana comments refer to a "D14/D16 ink doctrine"; that is a garbled
pointer and no such rule exists under those numbers, where D14 is routing and D15 is
exemptions. Cite Section O.

### E4 strict lock rejected again; E3 escalating friction is the answer

A strict lock that a user cannot leave was proposed again and is rejected again, on the same
ground as 2026-08-09: **the gate is a door, not a wall.** A blocker the user cannot open
teaches them to disable the extension, and an extension that has been disabled blocks
nothing. What ships instead is **E3, escalating friction**: a 10-second wait on the first
attempt, 60 seconds on a repeat within the same session, and a typed sentence only under a
**commitment toggle the user arms themselves**. The escalation is the persuasion and the
toggle is the consent; neither is imposed. Reaffirms 2026-08-09 rather than amending it.

### Workspace mode governs behaviour; budgets sit outside it

**Workspace mode (Work / Casual) is the single switch** that governs which sessions run, which
schedules apply, how much friction the gate raises, and whether reminders fire. **Budgets sit
outside the mode**, because a budget is a limit the user set for themselves and a mode switch
must not silently spend or restore it. The rule for ambiguity: a session runs under **the mode
of the workspace it started in** and keeps it to the end, so switching workspaces mid-session
never changes the rules the session began under, while **scheduled blocking follows the
current workspace**, because a schedule is about now rather than about what was running.

**AMENDS 2026-07-22 ("A focus session ENDS: the break auto-starts, the next work phase
never does"), the E1 clause only.** The 2026-07-22 ruling was that work never begins
without explicit user action, and its real
stake was downstream: `[1.2.0]` auto-arms site blocking during work phases, so an auto-looping
work phase would re-block the user's sites without consent. **In Work mode the next work phase
now starts after a visible 10-second countdown with a cancel control, and a notification if
notifications are permitted.** The consent property survives intact because the countdown is
visible, cancellable and announced: what changes is that a user who wants continuity no longer
has to click to get it. **It is never silent, and in Casual mode it does not auto-advance at
all.** Amends the E1 clause only; the rest of that entry stands.

**2026-07-22 objected on a second ground, semantic rather than procedural**, and the consent
argument above does not answer it: a session is something you start and finish, and a timer
that silently puts you back on the clock is a treadmill rather than a session. A cancellable
countdown does not settle that by itself, because it is consent by opt-out while the default
outcome is still the machine resuming work. **What settles it is that the consent moved up a
level**: Work mode is armed deliberately, per workspace, by a user who is choosing a
structured environment, and Casual does not auto-advance at all, so the per-boundary countdown
is the second layer rather than the only one. The user built the treadmill on purpose and can
step off it at any boundary, which is the difference between a mode with two phases and a
machine that will not let go.

### Imported named sessions show a placeholder until a refresh captures favicons

A named session captures each tab's own `favIconUrl` at save time, and an imported session has
none, because the tabs were never open in this browser. Imported sessions therefore render a
**fresh-import placeholder tile** until the user runs refresh-from-window, which captures the
real icons the same way an original capture does. **The never-derived favicon rule from
2026-08-31 holds unchanged**: LaunchPad does not fetch an icon from any service to fill the
gap, and it does not derive one from the hostname, because a saved-session row is the same
category of data as a Time-by-Site row.

### One free scratchpad note, in its own slot

The free tier gets **one scratchpad note**, stored in a dedicated `homeNote` slot rather than
as a member of the Notes collection, so it cannot be confused with a Pro note or migrated into
one by accident. The store and in-product copy become **"one note free, unlimited on Pro"**,
which is a truthful upgrade line rather than a teaser for a locked panel. **Expired is
identical to free** here as everywhere: an expired user keeps the one note and loses the rest,
which is the same shape as every other Pro surface and needs no special case.

### Attach resources: one entry, and the launch relation is not tag attribution

Session attachment, group attachment and shortcut attachment collapse into **one task-menu
entry, "Attach resources"**, because three near-identical entries on one menu is a menu the
user has to read rather than scan. The unification is presentational and the underlying
relations stay distinct. **The launch relation is not tag attribution**: attaching a resource
says "open this when I work on this task", while a tag says "this time counts towards that
category", and conflating them would put launch targets into time reporting where they do not
belong.

### Weekly review is Insights; the Dashboard gains present-state modules

**The weekly review lives on Insights and is written in the past tense**, because Insights is
the surface that reports what happened and a review is a report. The Dashboard gains three
present-state modules instead: **the target ring, today's three, and a this-week-so-far
strip.** All three sit on the **same footing as the streak** already there, which is the
existing precedent for a present-state module on that surface. The split is the tense: the
Dashboard says what is true now, Insights says what was true.

### Recently closed is built from tabs.onRemoved, not chrome.sessions

**Recently closed is built from our own `tabs.onRemoved` record**, not from
`chrome.sessions`. The reason is a permission consequence rather than a technical one: the
`sessions` permission combines with the `history` permission already in the manifest to change
the install-time warning text, and a scarier warning on a feature this small is a bad trade.
Our own record is bounded, lives in local storage like everything else, and costs no new
permission.

### A localised store listing ships only with a translated catalogue

**A localised store listing ships only paired with a translated in-product catalogue for the
same language.** A listing that sells LaunchPad in Indonesian while the product renders
entirely in English converts a user into an immediate disappointment, and the review that
follows is worse than the install was worth. The two ship together per language or neither
ships. This binds the listing round on 1217302412535620 and follows from the `[1.5.0]`
localization work being groundwork rather than a shipped language.

### The checkout-return scrub is an address-bar boundary, not a confidentiality boundary

**The licence key transits the URL to Cloudflare on every checkout return, and that is
ACCEPTED.** Dodo redirects to `https://mylaunchpad.me/checkout-return?license_key=...`, so
the key is in the request line of a request Cloudflare terminates. This is **own
infrastructure, not a third party**, and it is no different in kind from trusting the CDN
to serve the site at all and to hold access logs while doing it. Accepting it is a
decision, not an oversight, and it is recorded here so nobody re-litigates it from
scratch.

**What `history.replaceState` on `checkout-return.html` actually protects.** It rewrites
the URL after the page loads, so it protects: the **address bar** (the key is not sitting
in a window the user may screenshot, screen-share or read aloud), the **history entry**
(the key is not persisted into browsing history, where the extension's own history panel
could later surface it), and **anything reading `location.search` afterwards**, including
scripts that run later on the page.

**What it CANNOT protect, and this is the part the scrub's existence tends to obscure:**

- **The wire.** The key is in the request line, sent before any script exists.
- **Cloudflare's access logs.** Same reason. The request is logged when it arrives.
- **Navigation Timing.** `performance.getEntriesByType("navigation")[0].name` retains the
  ORIGINAL URL for the life of the document, and `replaceState` does not touch it.

All three see the request **before the first line of script runs**, which is the general
form: a client-side rewrite cannot retroactively unsend a request. **A future reader must
not take the scrub to mean the key is not exposed.** It means the key is not left lying
around in surfaces a person or a later script can read.

**Cloudflare's NEL headers were investigated and closed as acceptable.** Network Error
Logging on the zone reports to Cloudflare with `success_fraction 0.0`, so it fires on
errors only, and it reports to the same party that already terminates the request and
writes the access log. That makes it **a rounding error on data the CDN necessarily
already holds**. This is the distinction that matters and it is why the two cases were
decided differently: **the beacon was a THIRD PARTY reading the URL after the scrub**,
which is a genuine leak to someone who otherwise would have had nothing; NEL is the
existing party seeing an error-sampled subset of what it already has.

**CLOSED 2026-09-01, and the answer inverted the recommendation.** The question was
whether Dodo could append to a FRAGMENT instead of a query string, since a fragment is
never sent to a server. A full read of the dashboard and API reference found **no control
of any kind over the return parameters**: not at product level (the licence-key entitlement
drawer has four fields, none URL-related), not on the payment link (one `Redirect URL`
field, and Advanced Settings covers only prefill and field-locking), not at account level
(the only URL setting is the customer-portal exit), and not in the Checkout Sessions API,
whose eighteen `feature_flags` are all about currency, editable fields, discounts and
phone collection. `return_url` is documented as nothing more than "The url to redirect
after payment failure or success". Fragment handling is **undocumented**, which is silence
rather than a stated behaviour, so it is not something to design on.

**What Dodo appends is now definitive**, from the return_url table: `payment_id` (one-time)
or `subscription_id` (subscription), `status`, `license_key` "Present if the product has
license keys enabled. Comma-separated if multiple keys", and `email` **"Present if the
customer has an email on record"**. Two checks against our code: the comma-split in
`handleCheckoutReturn` is correct and documented rather than folklore; and **`email` is
conditional, not guaranteed**, which `background.js` already handles with
`if (email) data.pro.email = email`. Both LaunchPad products are subscriptions, so live
returns carry `subscription_id` and `status=active`, never `payment_id` or
`status=succeeded`. Nothing in the handler reads either field, by design: entitlement comes
from `LicenseClient.ensureValidated`, not from the redirect.

**THE ONLY WAY TO KEEP THE KEY OFF THE WIRE IS TO STOP DODO APPENDING IT, AND THAT COSTS
MORE THAN THE EXPOSURE.** The documented path is the `license_key.created` webhook, whose
payload carries the key alongside `payment_id` and `subscription_id` server to server. It
genuinely closes the class. But adopting it means: a Cloudflare Worker endpoint, a stored
mapping from subscription id to licence key so the return page can collect it (the webhook
and the redirect race, and the redirect frequently wins), a Dodo API key whose permissions
are coarse enough to list every customer's keys, and a new authenticated endpoint to
defend. **That trades a transient entry in an access log we already trust for a PERSISTENT
KEY STORE we would have to build, secure and be trusted with.**

It also collides with the product's central claim. The store listing says, in its own
section heading, that **there is no LaunchPad server**. Building one to hold licence keys
would make the strongest sentence in the listing false, in order to close an exposure to
infrastructure the same listing already discloses we use. **The accepted risk stands, and
it is now accepted on evidence rather than on assumption.** Revisit only if Dodo adds a
return-parameter control, or if a server exists for some other reason and the store is a
marginal addition rather than a new liability.

Full finding, including the beacon that was removed and the measurements behind each
claim, is filed on Asana 1217977486245315.
