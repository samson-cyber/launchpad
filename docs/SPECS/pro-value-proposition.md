# Spec: LaunchPad Pro — Value Proposition and Positioning

**Status:** Active (written 2026-04-24)
**Owner:** Samson
**Linked Asana task:** TBD — create in "Specs & Decisions" section

---

## What LaunchPad Pro Is

A browser-based productivity companion that helps portfolio workers, deep-work seekers, and self-tracking enthusiasts organize their day, stay focused, and see where their time went — without the surveillance vibe of traditional productivity tools.

Built on top of the free LaunchPad Chrome extension. Pro adds workspaces, a goal/task system, tab time tracking tied to tasks, a Day Recap, and a light achievement system.

---

## Positioning Statement

> LaunchPad Pro is a productivity tool for people with no boss looking over their shoulder. Track your time toward goals you set. See what you worked on at the end of the day. Feel supported, not surveilled.

**Tone markers:**
- Supportive, not confrontational
- Fun at end-of-day, not guilt-inducing
- Concrete wins (task completion) over abstract scores
- Your data, local-first, your control

**What we don't want to sound like:**
- A boss-facing time tracker
- A judgmental productivity coach
- A gamified infantilization (Duolingo owl energy)
- A clinical metrics dashboard (RescueTime vibes)

---

## Who It's For

### Primary — The Portfolio Worker

Freelancers, consultants, solo operators juggling 2-5 clients or gigs simultaneously. No boss tracking them; they track themselves.

**Their pain:** Context-switching between clients, forgetting which client got which hours, under/over-billing, losing track of what's most urgent.

**Market size:** ~70M freelancers in the US alone; 200M+ globally. Large and underserved.

**Existing tools and why they fall short:**
- Toggl, Clockify, Harvest ($5-15/mo each): require manual timer toggling; easy to forget; billing-focused, not planning-focused
- Notion / Obsidian custom systems: hours of setup, then break over time
- Spreadsheets: the default, reveals how bad the alternatives are

**Why LaunchPad Pro fits:** Passive tracking tied to goals. Zero setup. The extension is already in the place where the work happens (the browser).

### Secondary — The Deep Work Protector

Knowledge workers (engineers, writers, designers, researchers) at companies, trying to carve out focus time in environments designed to fragment it.

**Their pain:** Slack pings, email interruptions, meeting overload, constant context-switching. Want to know: "did I get real work done today?"

**Market size:** 40-50M knowledge workers in the US; millions more globally. Already paying $5-15/mo for productivity apps.

**Existing tools and why they fall short:**
- Rize, Sunsama, Motion: subscription-heavy, clinical, or aggressive
- Session (Mac only): narrow

**Why LaunchPad Pro fits:** Lightweight, lives in the browser (where the work happens), goal-connected, non-confrontational.

### Tertiary — The ADHD Time-Awareness Seeker

People with ADHD (diagnosed or not) who struggle with time perception. They look up and three hours have passed.

**Market size:** ~10M diagnosed adults in the US; 2-3x if undiagnosed included. Active communities on Reddit.

**Their pain:** "I meant to check Slack for 30 seconds and lost an hour." External scaffolding helps; guilt doesn't.

**Why LaunchPad Pro fits:** The tab-time-tracking directly addresses the "intended X, got Y" pattern. The non-confrontational framing is crucial — many in this group have avoidance-relationships with traditional productivity tools.

### Quaternary — The Student / Self-Studier

University students, bootcamp learners, people self-teaching skills. Track study time for accountability and progress.

**Market size:** Millions globally, budget-conscious. Lifetime pricing serves this group well.

**Why LaunchPad Pro fits:** Tagging time by subject, weekly review showing progress, "I actually studied 12 hours this week" confidence.

### Quinary — The WFH Parent / Caregiver

Balancing paid work with caregiving. Work happens in fragments.

**Why LaunchPad Pro fits:** Shows that 4 × 30-minute focus blocks = 2 hours of real work. Reduces the "I got nothing done today" despair.

---

## Explicitly NOT For

- **Teams / managers.** No boss-dashboard, no team visibility. Positioning is solo.
- **Enterprise.** Same reason.
- **Agencies billing clients.** Invoicing is Toggl / Harvest's game; not chasing that.

---

## Pricing

- **$4.99/month** — standard monthly
- **$39/year** (effective ~$3.25/mo) — 35% discount for annual commitment
- **$59 lifetime** — one-time purchase for subscription-averse users

Positioned below competitors (RescueTime $9, Toggl $10, Rize $10, Motion $19+) but not bargain-bin. Feels professional.

### Why these prices?

- $4.99 is low enough that portfolio workers expense without thinking. High enough to signal real product.
- Annual discount incentivizes commitment; reduces churn accounting load.
- Lifetime option serves the "I hate subscriptions" segment (large and passionate). $59 feels generous vs paying $60/year.

### Billing provider

To be decided during Infrastructure work. Leaning toward **LemonSqueezy** or **Paddle** as Merchant of Record handling global VAT / GST / sales tax (important since dev is Indonesia-based, users are global). 5% fee on top of Stripe-equivalent is worth avoiding tax compliance headaches as a solo dev.

---

## Value Proposition by Feature

### Workspaces (Work / Personal)
**Promise:** One click separates your professional context from your life.
**Free alternative:** None.
**Pain solved:** Mixing work bookmarks with personal feels unprofessional or distracting.

### Goals / Tasks / Tags
**Promise:** Give your day structure without leaving your browser.
**Free alternative:** Todoist free tier, Notion, Apple Reminders.
**Pain solved:** Context-switching between a task app and the browser where the work happens. Tags bind tasks to bookmarks, so time tracking is automatic.

### Tab Time Tracking → Active Task
**Promise:** See what you actually worked on, without manual timer-toggling.
**Free alternative:** Toggl free tier (manual timer), Rize (automatic but $10/mo).
**Pain solved:** "I thought I worked on the proposal all morning, but actually…"

### Day Recap
**Promise:** A warm, honest end-of-day wrap-up that shows progress.
**Free alternative:** Manual journaling.
**Pain solved:** Losing the sense of what you accomplished. The Recap is THE signature Pro moment.

### Deep Work Time metric
**Promise:** An honest number for "how focused were you today?"
**Free alternative:** Nothing as specific.
**Pain solved:** Gives trend data ("deep work is up 20% this week") without a false "productivity score" algorithm.

### Task Completion Moment
**Promise:** A small, satisfying win each time you finish something.
**Free alternative:** Every task app has checkboxes, but most don't celebrate.
**Pain solved:** The dopamine loop that keeps productivity tools useful long-term.

### Achievements (light)
**Promise:** Occasional recognition for good work habits.
**Free alternative:** None direct.
**Pain solved:** Long-term motivation without daily gamification overload.

---

## Positioning Against Competitors

| Tool | What it does | Where LaunchPad Pro wins |
|------|--------------|--------------------------|
| RescueTime ($9/mo) | Background tracking, productivity score | Less clinical. Goal-connected, not just metric-driven. Browser-native. |
| Toggl ($10/mo) | Manual timer, reports | Passive tracking (no forgotten timers). Task system built in. |
| Rize ($10/mo) | Auto-tracking, coaching nudges | Less aggressive. No "you should work more" prompts. |
| Motion ($19/mo) | AI schedule + calendar | Way cheaper. Browser-focused vs calendar-focused. |
| Sunsama ($20/mo) | Daily planning + tasks | Cheaper. Lives where work happens (browser). |
| Forest ($4 one-time) | Gamified focus timer | Broader — tracks all your browser time, not just Pomodoro sessions. |
| Notion / Obsidian | Custom systems | Zero setup. Works out of the box. |

**Where competitors win over LaunchPad Pro:**
- Toggl has mature billing / invoicing (we don't; not trying to)
- Motion has sophisticated AI scheduling (we don't; not trying to)
- Sunsama has external integrations (we might add later, not v1)
- Obsidian has total customization (we're opinionated; that's fine)

We're not trying to win every dimension — we're carving a specific niche.

---

## Anti-Goals (what LaunchPad Pro explicitly avoids)

- **Algorithmic productivity scores.** See `DECISIONS.md` — these create false confidence.
- **Manager-facing dashboards.** Destroys positioning.
- **Gamified over-rewards.** Confetti on every task completion loses meaning fast.
- **Invoicing / billing features.** Not our category.
- **Calendar management.** Not our category (may read-only display events eventually).
- **AI that moves or organizes the user's shortcuts.** Users curate their own layouts.
- **Pushing users to work more.** We show; we don't exhort.

---

## Success Metrics (for Pro v1)

Beta phase (weeks 10-14):
- 20-50 beta users
- 70%+ retention after week 1
- Qualitative: "I feel like I know what I did today" signal in interviews

General availability (weeks 14-24):
- 100+ paying users within 3 months of launch
- <5% monthly churn
- $500+ MRR by month 3 post-launch
- At least 10 organic review mentions (blogs, Product Hunt, Twitter) within 6 months

Not v1 goals:
- Hockey-stick growth
- Breaking into mainstream productivity tool comparison charts
- Replacing RescueTime / Toggl for existing users (would be nice, not required)

---

## Open Questions / Decisions Deferred

These are documented in `DECISIONS.md` as they get resolved.

- Billing provider: LemonSqueezy vs Paddle vs Stripe (decision due Week 4-5)
- License key verification: local-only or server-checked on install (Week 5-6)
- Beta acceptance criteria: how do we select 20-50 first users (Week 9)
- Whether to add a free trial (likely 14-day trial; confirm Week 9)
- Day Recap trigger: fixed time (5pm?) or user-set? (Week 7-8 UX spec)
