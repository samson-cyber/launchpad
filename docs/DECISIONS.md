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
