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
