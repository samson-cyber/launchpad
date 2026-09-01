# LaunchPad expansion research: competitor sweep, market signals and feature candidates

Date: 2026-09-01
Prepared for: Samson (pick-and-choose input for the post-2.1.0 roadmap and Asana Backlog)
Scope: every project doc read in full (CLAUDE, ROADMAP, DECISIONS, BUGS, ASANA, all SPECS, release notes), then a web sweep of the new-tab, tab-manager, focus/blocker, time-tracker and read-later categories, plus Chrome Web Store ranking research.

---

## 1. Executive summary

- LaunchPad's position is clear and defensible: the only new-tab launcher whose paid layer is measurement and focus rather than sync or decoration, and one of very few in the category that is local-first with a genuinely uncapped free tier. That posture is the wedge, because free tiers across the category are visibly shrinking (Toby's 60-tab cap, Workona cut from 10 to 5 workspaces, Speed Dial 2 paywalled custom icons and users are furious about it).
- The single biggest growth lever right now is not a feature. The store listing is stale (Overview copy predates Pro, title and short description carry none of the Pro keywords, 3 ratings, English only). Chrome Web Store ranking research is unanimous that title and short description keywords are the top relevance signals and that review velocity, not review count, drives ranking. This is a listing round, not a build round, and it should ship with 2.1.0.
- On the product side, the highest-leverage additions are surfaces that carry existing features to where the user already is, at zero new install-warning permissions: a toolbar popup, a live focus badge on the toolbar icon, keyboard commands, an omnibox keyword and a side panel. Every one of these is available today without a manifest warning, and each one multiplies the value of Tasks, Focus and Sessions without new data capture.
- Three feature gaps map directly onto named personas and onto search demand: domain time budgets and scheduled blocking (the StayFocusd category, and the doomscroll use case DECISIONS already predicted), a read-later queue (Pocket died July 2025 and Omnivore before it, leaving a hole that bookmark tools are racing to fill), and a per-task time export (the portfolio worker's real reason to pay).
- Distribution is under-exploited: LaunchPad is already tested on Edge in the scratch-profile harness, yet has no Edge Add-ons listing. Localization infrastructure exists (R1 to R4 merged) and the store listing is English only despite Japanese and Russian installs.

---

## 2. Alignment check: what I treated as fixed

Everything below respects the decisions already locked. I did not propose, and will push back if asked to relitigate:

- No cloud sync as a paid feature; `storage.sync` full and hybrid both rejected (only the settings-plus-licence slice remains open).
- No ads, no telemetry, no third-party analytics, nothing leaves the machine. Favicons via Google S2 are the one disclosed exception, and browsing-domain rows must never reach an icon service.
- No gating of existing free features. Pro is additive. Export stays free.
- No team or manager dashboards, ever. No enterprise pivot.
- No AI that moves or organises the user's shortcuts. No productivity score. No exhortation to work more.
- No two-way calendar sync, no invoicing.
- No custom search-engine picker (store single-purpose policy), and never DuckDuckGo.
- Zero new install-warning permissions as the standing bar; runtime `optional_permissions` on explicit opt-in are the accepted pattern (notifications, downloads).
- The gate is a door, not a wall. Preview is the promise (no create affordances on preview surfaces). Idle is silent, pause is loud. Dashboard is today, Insights is the past.
- Vanilla JS, no build pipeline, per-field storage updaters, render-hook convention, serial background queue.

Each idea below carries a permission tag so nothing sneaks a warning in.

---

## 3. Where LaunchPad stands today (verified live)

**Chrome Web Store listing** (fetched 2026-09-01):
- Title: "LaunchPad - New Tab Shortcuts". Version shown 2.0.0, updated Aug 14 2026. 102 users. 4.7 stars from 3 ratings. Languages: English only. "Offers in-app purchases" flag is set.
- The Overview copy is the v1 free-tier description. It says "no background processes", "no cloud sync", lists only shortcut features, and mentions nothing about focus sessions, blocking, time insights, tasks or goals. A cached variant surfaced by search ends with "Coming soon: LaunchPad Pro". Either way, the listing is selling a product that no longer matches what installs.
- Short description (the 132-char field that appears in search results): "Unlimited organized shortcuts on your new tab page. Groups, drag-and-drop, dark mode. Free and private." No focus, tasks, timer, time-tracking, blocker or dashboard terms.

**Website** (mylaunchpad.me): current and well-written, Pro is positioned as "the focus system", four compare pages live (Speed Dial 2, Momentum, Toby, Bonjourr), no analytics by design. The ROADMAP note that the Toby compare row is now understated post-named-sessions still stands.

**Implication**: the extension has shipped roughly four months of Pro work that the primary discovery surface does not mention. Section 8 covers the fix.

---

## 4. Competitive landscape

### 4.1 New-tab dashboards (the category LaunchPad is listed in)

| Tool | Model | What they have that LaunchPad lacks | Where LaunchPad wins |
|---|---|---|---|
| Momentum (10M+ users) | Free limited, Plus ~$3.33/mo | Clock, weather, daily photo and quote, "main focus" line, todo integrations (Asana, Todoist, Trello, GitHub, Google Tasks), soundscapes, pomodoro, autofocus, metrics, countdowns, world clocks, tab groups (link collections), site blocker | Passive time measurement, task-attached focus, real insights, local-first, uncapped free shortcuts |
| Start Page HQ | Free (1 page, 8 widgets), $3.99/mo, $49 LTD | 63 widgets incl. RSS, weather, calendars, world clocks, currency, kanban, JSON tools; cross-browser; heavy content-marketing site | Focus; simplicity; privacy; no account |
| New Tab Widgets | Free 10 widgets, $4.99/mo, $179 LTD | 67 widgets, free placement, custom CSS | Same as above |
| Infinity New Tab | Free | Thousands of preloaded icons, 365 wallpapers, weather, todo, notes, cloud backup, strong non-English markets | Privacy, tasks and tracking, no account |
| Speed Dial 2 | Free limited, Pro subscription | Keyboard navigation (Tab, arrows, "/" to search), visit counters per dial, custom thumbnails (now paywalled), Ctrl+U action menu from any page, Focus mode, compact layout, bookmarks sidebar, multi-URL import, mobile app | Free custom icons would directly exploit their most-complained-about paywall |
| Tabliss / Bonjourr | Free, open source | Minimal, clock, weather, quotes, quick links, pomodoro (Bonjourr), iOS-style design | Anything beyond decoration |
| Tabisto | Free (2 workspaces, 25 bookmarks, 1 session, 3 reminders), Pro $3.99/mo | Command palette, reminders, free cloud sync, aggressive SEO content (alternatives pages, how-to guides) | Uncapped free, focus system |
| daily.dev | Free | Developer news feed on new tab | Not a competitor for the same job |
| start.me | Free / $25 yr | Bookmark manager, RSS, team dashboards | Solo focus, privacy |

Pattern: decoration-first tools (Momentum, Tabliss, Bonjourr) win on calm; widget-first tools (Start Page HQ, New Tab Widgets, Infinity) win on breadth; nobody but LaunchPad pairs the launcher with honest measurement. The category's free tiers are mostly caps and upsells, and reviews across Speed Dial 2, Toby and Workona show users despise bait-and-switch monetisation. "Free stays free, uncapped" is worth saying louder.

### 4.2 Tab and session managers (adjacent, and now overlapping via named sessions)

| Tool | Free tier | Notable features |
|---|---|---|
| Toby (500K+) | 60 saved tabs | Visual collections in spaces, notes, "to/" address-bar shortcuts, team sharing, iOS/Android, AI organisation on the roadmap |
| Workona | 5 workspaces | Project workspaces with tabs, docs, notes, tasks; Slack/Asana/Drive integrations; tab suspender; autosave and cloud backup |
| OneTab | Free | One click parks every open tab into a list; the "memory panic button" |
| Session Buddy | Free | Crash recovery, unified search across open tabs, saved sessions and history |
| Tabox, BoTab, Marqly, Amazing Tabs, Leap | Various | AI grouping of open tabs (Tabox), board built from bookmarks (BoTab), searchable closed-tab library (Marqly), "/" search (Amazing Tabs) |

LaunchPad already has named sessions (free, uncapped) which beats Toby's free cap. What is missing is the live side: seeing and acting on currently open tabs from the new tab, a one-click "park this window", and Chrome tab-group awareness.

### 4.3 Focus and blocking

| Tool | Signature feature |
|---|---|
| StayFocusd (500K+) | Daily time allowance per site, then blocked for the day; the Nuclear Option (hard block for a set period, no undo); subdomain and in-page blocking; dated UI, sparse updates |
| LeechBlock NG | Up to 30 block sets with schedules, regex rules, open source |
| Freedom ($40/yr) | Cross-device blocking, scheduled sessions |
| Cold Turkey ($39) | Uninstall-proof strict blocking |
| one sec | Breathing pause before a distracting site rather than a block (friction, not enforcement) |
| Forest | Grow a tree while focused; visual stakes |
| Bouncer ($25 one-time) | Nuclear mode, friction unlocks, in-app content blocking (hide Shorts without blocking YouTube) |
| Time Halo | ADHD-targeted: always-visible progress bar on every page during a time block, ring on the toolbar icon, nudge points, overtime colour shift |

LaunchPad's gate is deliberately a door. The gap is not enforcement strength; it is coverage: blocking only works during a focus session, and there is no daily budget, no schedule and no friction mode. The Time Halo pattern (persistent visible time awareness) is the most on-brand idea in this table for the ADHD persona, and the toolbar-icon half of it needs no permission at all.

### 4.4 Automatic time trackers (Pro's true competitors)

| Tool | Price | Features worth noting |
|---|---|---|
| RescueTime | $12/mo | Background tracking, productivity score (rejected here), FocusTime blocking, weekly email report |
| Rize | ~$10/mo | Passive tracking, focus score, break reminders, overwork notification (daily max hours), context-switch tracking, focus music, calendar integration, daily and weekly reports; praised by ADHD users specifically for zero manual effort |
| Toggl / Clockify | Free tiers | Manual one-click timers, project reports, CSV export, billing focus |

Rize's most-praised non-score features (break nudges, overwork notice, "when am I most productive") are all compatible with LaunchPad's doctrine because they suggest stopping or noticing, never working more. Toggl and Clockify's exports are what the portfolio worker actually uses to invoice; LaunchPad captures better data and cannot get it out per task.

### 4.5 Read-later (an orphaned category)

Pocket shut down July 2025; Omnivore in late 2024. Raindrop, Instapaper, Matter and a wave of indie tools are absorbing the users. Chrome's own Reading List exists and has an extension API (`chrome.readingList`, but it carries an install warning). A launcher that already owns a right-click "Add to LaunchPad" is one context-menu entry away from a "Read later" queue with zero new permissions.

### 4.6 What the most-installed productivity extensions teach

uBlock Origin, Grammarly, Bitwarden and Dark Reader are not adjacent. The ones that are: Todoist (natural-language quick-add, the single most copied task UX), OneTab (park all tabs), Session Buddy (search everything), Notion Web Clipper (clip a selection to a note), Vimium (keyboard-first), Momentum (calm plus a daily focus line), StayFocusd (time budgets), Clockify (one-click timer from any page). Each appears in the idea list as a LaunchPad-native, local-only version.

---

## 5. Market signals worth building against

1. **Free tiers are contracting across the category**, and users notice. LaunchPad's uncapped free tier is a marketing asset the listing does not currently exploit.
2. **Local-first and privacy are now a purchase criterion**, not a nicety. Every 2026 roundup has a privacy column. Pocket and Omnivore dying taught people that cloud read-later can vanish with their data. "Nothing leaves your machine" is a category-level differentiator; keep every new feature inside it.
3. **Chrome Web Store ranking research** (three independent 2026 studies, one on 120K ranking records): title is the strongest relevance signal, short description second; weekly users and ratings compound; review recency outweighs review count; permission warnings depress click-to-install; screenshot quality moves CTR by 20 to 30 percent; consistent updates matter more than update size; Featured and Verified badges help less than assumed. Roughly 70 percent of installs for a typical solo dev come from store search.
4. **The ADHD segment is loud, organised and underserved by gentle tools.** Rize's ADHD testimonials centre on zero manual effort; Time Halo's entire pitch is persistent time awareness. LaunchPad already has the measurement; it lacks the always-visible part.
5. **Zero-warning Chrome surfaces are under-used by the category**: `action` popup and badge, `commands` (keyboard shortcuts), `omnibox` keyword, `sidePanel`. None of these adds an install warning. Together they turn a new-tab-only product into a companion that is reachable from any page.
6. **Migration is acquisition.** Speed Dial 2 built an FVD converter; Tabisto and Start Page HQ publish "alternative to X" pages for every competitor. Import paths plus compare pages are how small tools in this category grow.

---

## 6. The idea list

Tags per item: **Tier** (Free / Pro / Free with Pro depth), **Effort** (S under a week of CC rounds, M one to three weeks, L an arc), **Perm** (none / optional / warning), **Fit** (how well it sits with the doctrine; anything marked "tension" has a note).

### A. Reach: carry LaunchPad to where the user already is

- **A1. Toolbar popup** (Free with Pro depth, M, Perm none). Click the extension icon on any page: see the active task and its counter, start, pause or end a focus session, quick-add a task or note, "Add this page to LaunchPad", launch a named session. Speed Dial 2's Ctrl+U menu and Clockify's one-click timer both live here. Turns Pro from "when I open a tab" into "while I work".
- **A2. Live focus badge on the toolbar icon** (Pro, S, Perm none). `chrome.action.setBadgeText` shows minutes remaining during a session, an amber mark when paused, nothing otherwise. This is Time Halo's ADHD pitch without a content script or an all-URLs warning. Also a free-tier candidate: badge the count of tabs in the window or the day's focused minutes (Pro).
- **A3. Global keyboard commands** (Free with Pro depth, S, Perm none). `chrome.commands`: open LaunchPad, add current page to LaunchPad, save window as named session, start or pause focus. Users set their own keys in `chrome://extensions/shortcuts`. Vimium and Speed Dial 2 both cite keyboard reach as retention.
- **A4. Omnibox keyword** (Free, S, Perm none). Type `lp ` in the address bar to search shortcuts and launch groups or sessions by name (Toby's `to/` shortcuts). Note: Chrome's omnibox suggestions are Chrome's own UI, so this does not trip the search single-purpose rule; it searches LaunchPad's data, not the web.
- **A5. Side panel** (Free with Pro depth, M, Perm none: `sidePanel` carries no warning). LaunchPad beside any page: tasks, notes, active task, sessions. Dashy is built on this; Workona and Toby users ask for it. The Notes panel and Tasks list render inside a narrow column already (the 900px stack), so much of the layout work is done.
- **A6. Keyboard navigation on the new tab** (Free, S, Perm none). "/" focuses search, arrow keys move across tiles, Enter opens, Ctrl+Enter opens in a new tab, type-to-filter. Speed Dial 2 shipped exactly this and lists it as a headline. Doubles as the accessibility pass a Featured badge review looks for.
- **A7. Command palette (Ctrl+K)** (Free with Pro depth, M, Perm none). Fuzzy search across shortcuts, groups, sessions, tasks, goals, notes and history in one box, with actions ("new task", "start focus", "switch to workspace X"). Tabisto has one; Session Buddy's unified search is its most-praised feature. Pairs with A6.

### B. Free tier: dashboard staples and launcher depth

- **B1. Clock, date and greeting line** (Free, S, Perm none, opt-in, off by default). The single most expected element of a new-tab page; Momentum, Tabliss, Bonjourr and Infinity all lead with it. Zero network. Cheap, and its absence is a reason people bounce on day one.
- **B2. World clocks** (Free, S, Perm none). Two to four labelled time zones via `Intl.DateTimeFormat`. Direct portfolio-worker fit (clients across zones). Momentum gates this behind Plus.
- **B3. Countdown tiles** (Free, S, Perm none). "Days until [date]". Momentum Plus feature. On Pro, goal deadlines could surface here automatically.
- **B4. Custom icons for shortcuts** (Free, M, Perm none). Upload an image, pick an emoji, or use a lettered tile with a chosen colour. Speed Dial 2 moved this behind Pro and its reviews are full of anger about it. Stored as data URLs (mind the export envelope size; already a known consideration).
- **B5. Visit counters and "most used" sort** (Free, S, Perm none). Per-shortcut open count, local only. Enables "Most used" as a sort and a possible "Frequently used" auto-group. Speed Dial 2 has the counter; nobody surfaces it well.
- **B6. Layout options** (Free, S to M, Perm none). Compact density, column count, list view, and a "Focus view" that hides everything except search and the active task (Speed Dial 2 3.9.0 added "Focus mode" and "Compact layout" as headline items).
- **B7. Themes, accent colours and fonts** (Free basics, Pro pack optional, M, Perm none). The frost tiers already exist as variables; exposing three or four accents and a light-glass option is mostly CSS. ROADMAP v3 already banks premium wallpaper and theme packs as a Pro sweetener; DECISIONS says visuals cannot justify Pro alone, which still holds.
- **B8. Per-workspace wallpaper or tint** (Pro, S, Perm none). Deferred in the workspaces spec; the data model already reserves per-workspace settings. Makes the context switch visible at a glance, which is the whole point of workspaces.
- **B9. Live Chrome bookmarks panel** (Free, M, Perm none if `bookmarks` is already declared for import). Browse the actual bookmark tree from the sidebar, not only import it. Speed Dial 2's most recent releases were about its bookmarks sidebar.
- **B10. Bulk and cross-tool import** (Free, M, Perm none). Paste a list of URLs; import a Bookmarks HTML export; import Toby JSON, OneTab text, Session Buddy and Speed Dial 2 exports into groups or named sessions. Each import format is also a landing page ("Import your Toby collections into LaunchPad").
- **B11. One free scratchpad note** (Free, S, Perm none). A single sticky on the Home tab for everyone; unlimited notes stay Pro. Tabliss, Bonjourr and Infinity all give a free note. This is a real surface, not a preview, so the preview rule does not apply; it is a free-tier expansion, which the "Pro is additive" rule permits. Tension: dilutes the Notes headline slightly. Your call.
- **B12. Daily or time-of-day wallpaper rotation** (Free, S, Perm none for bundled sets; the existing Unsplash path already makes network calls with disclosure). "New photo each day" is Momentum's most-loved free behaviour.
- **B13. Search bar: inline shortcut results** (Free, S, Perm none). As the user types, show matching shortcuts, groups and sessions above the web-search action, so the bar becomes a launcher before it becomes a search. Stays inside `chrome.search.query` for the web part.

### C. Tabs and sessions: finish the tab-manager story

- **C1. Open-tabs panel** (Free, M, Perm none: `tabs` is already held). A live list of all windows and tabs on the new tab, searchable, with close, switch-to, and "save selection as named session". This is the Session Buddy and Tab Manager Plus job, and the query "tab manager" dwarfs "new tab shortcuts" in volume.
- **C2. Park this window** (Free, S, Perm none). One click: save the current window as a named session and close its tabs. The OneTab reflex, with LaunchPad's session model underneath. Directly claimable in a compare page ("OneTab alternative that keeps favicons and reopens into a window").
- **C3. Tab-group aware sessions** (Free, M, Perm warning: `tabGroups` shows "View and manage your tab groups"; request as optional at first use). Capture Chrome tab-group names and colours into a session and restore them. Tabox and Tab Group Vault are built entirely on this.
- **C4. Session upgrades** (Free, S each, Perm none). "Refresh from this window" already exists; add "append to current window" as a launch mode, "open pinned", and a session keyboard shortcut (via A3). Scheduled launch ("open Morning at 09:00") is possible with `chrome.alarms` but opens tabs the user did not click for; DECISIONS 2026-08-31 rejected launch-on-activate for that reason, so I list it and do not recommend it.
- **C5. Recently closed tabs** (Free, S, Perm none: `sessions` API sits under the `history` warning already carried). A "Recently closed" strip in the history panel. Chrome hides this behind a menu; every session tool surfaces it.

### D. Read later: the Pocket hole

- **D1. LaunchPad Read Later** (Free, M, Perm none). Right-click "Save to read later" on any page or link (existing `contextMenus`), a Read Later section on the Home tab with mark-as-read, and a "clear read items after 30 days" sweep on the trash cadence. No cloud, cannot be shut down, and "Pocket alternative" plus "read later Chrome extension" are live, high-intent queries with weak incumbents. Note: this deliberately does not use `chrome.readingList` (install warning); a later optional-permission bridge to Chrome's native list could sync the two.
- **D2. Clip selection to note** (Pro, S, Perm none). Highlight text on any page, right-click "Save to LaunchPad note" (context menu `selection` context exposes `selectionText` with no extra permission). Notion Web Clipper's core move, kept local, feeding the Notes panel.

### E. Focus and blocking depth (Pro)

- **E1. Domain time budgets** (Pro, M, Perm none: reuses `webNavigation` gate and the per-day `byDomain` aggregates). "YouTube: 30 minutes a day." When spent, the existing gate page appears with the same snooze and honesty. This is StayFocusd's whole product, and DECISIONS 2026-04-24 already predicted the "stop doomscrolling" use case as the Personal-workspace discovery. Capture already exists; this is a reader plus one rule.
- **E2. Scheduled blocking** (Pro, M, Perm none). Block list active on a weekly schedule (LeechBlock's block sets), independent of sessions. The gate stays a door: snooze remains.
- **E3. Friction mode** (Pro, S, Perm none). Instead of blocking, the gate offers a ten-second breathing pause and a "Still want to go?" button (the "one sec" pattern). More on-brand than any nuclear option, and cheap because the gate page already exists.
- **E4. Strict lock (opt-in)** (Pro, S, Perm none). A user-armed lock with no snooze for N minutes. Tension: "the gate is a door, not a wall" is a locked decision. If offered, it must be armed deliberately, time-boxed, and never default. StayFocusd's Nuclear Option is its single most-cited feature, so demand is real; the doctrine says no. I list it for completeness and do not recommend it.
- **E5. Break nudges and overwork notice** (Pro, S, Perm optional: notifications already runtime-requested). After N consecutive focused minutes, a quiet "you have been at it for 90 minutes" notification; after a user-set daily focused total, "that is your day". Rize's most-praised non-score features. Compatible with doctrine because both suggest stopping.
- **E6. Focus sounds** (Pro, S, Perm none). Brown, pink and white noise plus a soft rain texture synthesised with WebAudio through the existing offscreen document, so no audio assets and no network. Momentum Plus soundscapes and Rize focus music are paid headline features; LaunchPad can ship the honest version in under a week.
- **E7. Configurable idle threshold** (Pro, S, Perm none). Fixed at 60 seconds today; expose 30 to 300 in Pro Settings.
- **E8. Focus session presets** (Pro, S, Perm none). Named routines ("Deep work 50/10 x3", "Sprint 25/5 x4") on top of the sticky duration chips.

### F. Insights and reporting (Pro)

- **F1. Per-task and per-tag time export** (Pro, M, Perm none). CSV of focused time by task, goal, tag and domain for a date range, downloaded locally. ROADMAP v3 lists "analytics export". This is the portfolio worker's reason to pay: LaunchPad measures better than Toggl and cannot currently get the number out per client. Zero network.
- **F2. Weekly review card** (Pro, M, Perm none). "This week versus last": focused total, deep-work stretches, top tasks and tags, blocks and snoozes. Already in the Pro v1 spec as "weekly summary"; the aggregates exist. RescueTime's weekly email is the feature its users say they would miss most; LaunchPad renders it on the new tab instead of sending mail.
- **F3. Best-focus-hours heatmap** (Pro, M, Perm none, but needs capture). Hour-of-day by weekday. Requires adding an hourly bucket to the rollup-on-write aggregate now, so the chart arrives pre-populated later (the capture-first lesson). Rize's "when am I most productive" is a top-three praise item.
- **F4. Context-switch count** (Pro, S, Perm none). Sessions closed by tab-switch per day is already in the record (`closedBy`). Surface it as a plain count, never a score. Tension: it edges toward judgement; present it as information beside deep-work stretches, not as a headline.
- **F5. User-set daily focus target with progress ring** (Pro, S, Perm none). "2h focused today" on the Dashboard cockpit. Deferred v3+ in ROADMAP. Doctrine-safe because the user sets it and nothing nags when it is missed; the ring simply fills.
- **F6. Retroactive session reassignment** (Pro, L, Perm none). "That hour was actually Client B." Tension and cost: attribution is stamped at close and aggregates roll up on write, so re-attributing means reversing and re-applying rollups within the 30-day raw window and refusing beyond it. Real portfolio-worker need; real architecture cost. Flagged, not recommended before F1 proves demand.

### G. Tasks and notes (Pro)

- **G1. Natural-language quick-add** (Pro, M, Perm none). "Call Nadia tomorrow 3pm !high #acme" parsed locally into due date, priority and tag. Todoist's signature UX, no AI, no network. Lands in A1, A4, A5 and A7 wherever a task box appears.
- **G2. Due-date reminders** (Pro, S, Perm optional: notifications). A notification for tasks due today at the user's chosen morning time, and for a task's set time. Tabisto sells "reminders" as a Pro line item.
- **G3. Subtasks or checklists inside a task** (Pro, M, Perm none). The spec deferred sub-goals; a lightweight checklist inside the task detail covers most of the ask without nesting goals.
- **G4. Resources on tasks and goals** (Pro, M, Perm none). Attach shortcuts or a whole group to a task, so activating it can open them. Named-session attachment already exists; this is the lighter, always-current version, and it is the core of Workona's "project workspace" without the account.
- **G5. Notebooks** (Pro, L, Perm none). Already ROADMAP v1.2.0; the layout assumptions need re-speccing for the 20-percent panel. Listed so it is not forgotten, not re-argued here.
- **G6. Markdown-lite and checkboxes in notes** (Pro, S, Perm none). Bold, lists and `[ ]` toggles. Notes spec lists markdown as a future consideration.
- **G7. Habit tracking in a workspace** (Pro, M, Perm none). Daily-check habits with a simple month grid, built on recurring templates. Deferred v2 in ROADMAP as "habit tracking specialisation". Doctrine note: one-shot recognitions are allowed, persistent streak nagging is not, so the grid shows history and never scolds a gap. "Habit tracker new tab" has real search volume and Momentum sells this as Metrics.
- **G8. Task import from file** (Pro, S, Perm none). Todoist and TickTick CSV, plain-text lists. External live sync stays deferred (OAuth and network would breach the posture); import from a file does not.
- **G9. Today's three** (Pro, S, Perm none). A morning pick of up to three tasks that headline the Dashboard day card, distinct from "due today". Momentum's Today list, Sunsama's daily plan, and the Start-of-Day "suggested first task" all point here.

### H. Platform and distribution

- **H1. Edge Add-ons listing** (S, no code). The scratch-profile harness already runs on Edge; the same zip lists there. Far lower competition per keyword than the Chrome store, and Edge users are exactly the Windows knowledge workers in persona two. Dodo checkout and the return URL are browser-agnostic.
- **H2. Localised store listings** (S to M, uses R1 to R4 infra for the two manifest strings; listing copy is manual). Japanese, Russian, Spanish, Portuguese (Brazil), German. Store search is per locale, so an English-only listing is invisible to those searches. The existing Japanese and Russian installs arrived despite that.
- **H3. Localisation R5 plus a first translation** (L, already scoped). Commissioning one language turns H2 from listing-only into product. Japanese or Spanish first, based on the install base and freelancer density respectively.
- **H4. Settings-plus-licence `storage.sync` slice** (S to M, Perm none). The one sync path DECISIONS left open: reinstall or new machine recovers Pro status and preferences instantly, data still restores from backup. Strong support-ticket reducer.
- **H5. Firefox port** (L). `chrome.search.query` and offscreen documents differ; a real port, not a relist. Bonjourr and Start Page HQ trade on cross-browser reach. Park until Edge proves the second-store thesis.

---

## 7. My lean: the twelve I would build first

Ordered by leverage per week of work, not by size.

1. **Store listing round** (Section 8). Not a feature, and it outranks every feature. Ships with 2.1.0.
2. **A2 focus badge on the toolbar icon.** Days of work, zero permissions, and the most on-brand ADHD feature in the market.
3. **A1 toolbar popup.** The multiplier for Tasks, Focus and Sessions from any page.
4. **A3 keyboard commands plus A6 keyboard navigation.** Cheap, expected by power users, and an accessibility signal.
5. **D1 Read Later.** A dead category with live demand, zero new permissions, and a compare page ("Pocket alternative") that writes itself.
6. **E1 domain time budgets.** The StayFocusd job, built on capture that already exists, fulfilling a use case DECISIONS predicted in April.
7. **F1 per-task time export.** The portfolio worker's reason to keep paying; almost no new capture.
8. **C1 open-tabs panel plus C2 park this window.** Moves LaunchPad into "tab manager" searches, the biggest adjacent keyword pool.
9. **B4 custom icons and B5 visit counters.** Direct exploit of Speed Dial 2's most-hated paywall.
10. **E6 focus sounds and E5 break nudges.** Two paid headline features elsewhere, both a week each here, both doctrine-safe.
11. **B1 clock and B2 world clocks.** The cheapest fix for day-one bounce, plus a persona-specific win.
12. **H1 Edge listing and H2 localised listings.** Distribution that costs no code.

Devil's advocate on my own list: A1, A5 and A7 overlap (three ways to reach the same actions). Build the popup first, watch whether people ask for a palette or a side panel, and do not build all three in one release. Likewise C1 is the largest item on the list; C2 alone captures most of the OneTab story for a fraction of the work.

---

## 8. Store and web growth (non-feature, high leverage)

**Chrome Web Store listing (ship with 2.1.0):**
- Title (75 chars): lead with the search terms, brand second or third. Candidates: "LaunchPad: New Tab Dashboard, Shortcuts, Focus Timer & Tasks" or "New Tab Dashboard: Shortcuts, Focus Timer, Site Blocker | LaunchPad". Every 2026 ranking study puts exact title keywords first.
- Short description (132 chars): replace the shortcut-only line with the product: "Unlimited new tab shortcuts, free. Pro adds a focus timer, gentle site blocking, tasks and goals, and private time insights."
- Overview: lead with the problem, use verb bullets, state the free/Pro boundary explicitly, and include a "what LaunchPad does not do" block (no account, no sync, no telemetry, never sells data). The research says the boundary statement and the negative list both raise click-to-install.
- Screenshots: five at 1280x800, real content, light annotation: 1 the grid, 2 the focus session and gate, 3 the Dashboard cockpit, 4 Insights, 5 Sessions and Notes. Annotated carousels measured 20 to 30 percent higher CTR.
- Category: confirm Productivity, not Tools (the listing currently shows "Tools").
- Verified publisher badge: email verification and 2FA on the developer account, if not already done.
- Permission justifications: `webNavigation`, optional `downloads`, and the `history` warning, each explained in the listing in one sentence, since unexplained warnings measurably depress installs.

**Review velocity:** three ratings is the weakest signal on the page. The rate toast fires on open count; the research is clear that asks convert best right after a success moment. Move (or add) the ask to: third task completed, first Day Recap seen, first named session launched, first badge earned. Keep the 40-open fallback. Copy that names the moment ("If LaunchPad helped you finish something today, a quick review helps others find it") converts around 12 percent in the cited data.

**Website:** the four compare pages are the right pattern; Tabisto and Start Page HQ have twenty to forty each plus persona pages and how-to guides, and they rank. Add: vs Workona, vs Infinity New Tab, vs Tabliss, vs StayFocusd, vs RescueTime, vs Rize; "for freelancers", "for ADHD", "for students"; how-to posts (change Chrome's new tab page, save tabs as a session, block sites during focus, Pocket alternative). Update the Toby row now that sessions ship. Submit to AlternativeTo, Product Hunt (assets drafted), and the indie directories Tabisto lists.

**Cadence:** the algorithm rewards steady updates. A small store release every four to six weeks after 2.1.0 beats one large one per quarter.

---

## 9. Explicitly not recommended, and why

- **Weather widget.** Requires a third-party API call and a location or city; it is the second most common new-tab feature, but it breaks "nothing leaves your machine" for a decoration. If ever done: user-typed city, explicit disclosure, off by default. I would not.
- **Live task sync (Todoist, Asana, Trello).** Momentum's headline Plus feature; it needs OAuth, tokens and outbound calls. File import (G8) captures the migration value without the posture cost.
- **Strict or nuclear blocking (E4).** Demand is real; the door-not-wall decision is locked and correct for the brand.
- **RSS or news feeds.** Start Page HQ, start.me and daily.dev own this; it pulls the new tab toward consumption, the opposite of the product's job.
- **AI summaries, AI tab grouping, AI task suggestions.** Toby and Tabox are heading there. Off-brand by decision, and every one requires sending content off-machine.
- **Cloud sync of any kind beyond H4.** Rejected on numbers and posture; do not relitigate.
- **Team sharing of sessions or groups.** Toby and Workona's growth lever, and the positioning says never.

---

## 10. Sources consulted

- Chrome Web Store listing for LaunchPad (jfmmagapjdionoomkjmkfppcplkjilnp), fetched 2026-09-01; mylaunchpad.me home page.
- Start Page HQ, "The 9 Best New Tab Extensions in 2026" (June 2026); Tabisto, "Best Chrome New Tab Extensions in 2026" (June 2026); Linkflare and Web Highlights roundups (March 2026).
- Momentum Plus overview (help centre, Aug 2026), momentumdash.com/plus, App Store listing.
- Tabox, BoTab, Marqly, Amazing Tabs, Leap, Uncluttr and SupaSidebar tab-manager comparisons (March to August 2026).
- FocusMe, Bouncer, SiteBlocker, Intently and DigitalZen website-blocker comparisons (2026); Time Halo store listing.
- Rize product pages and reviews (2026); Toggl and Clockify references in productivity roundups.
- TechCrunch, How-To Geek, Mailist, SupaSidebar and Readless on Pocket and Omnivore shutdowns and alternatives.
- Chrome for Developers permissions list (warning text per permission); ExtensionBooster permissions cheatsheet (2026).
- Chrome Web Store ranking research: dev.to "CWS Listing SEO after 18 extensions" (May 2026); Extension Ranker 120K-record ranking analysis (May 2026); ExtensionFast ranking guide (June 2026); ExtensionBooster ranking guide (April 2026).
- Productivity-extension roundups from ClickUp, Voicy, VoiceDash, Lifestack, Unlike, Hubkub, TechTippr and Browwwser (2026) for the most-installed set and the ADHD segment.
