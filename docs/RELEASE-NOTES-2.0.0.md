# Release notes — v2.0.0 (Pro launch)

Store-listing copy for the Chrome Web Store submission. **Samson pastes the block
below at upload**; everything after it is context for choosing between variants
and for keeping the claims honest.

Submission candidate built 2026-08-10 from commit — see the IMPLEMENTATION
comment on Asana 1217318434594388 for the zip's SHA and gate table.

---

## PASTE THIS — "What's new" (primary, ~600 characters)

```
LaunchPad Pro is here.

• Focus sessions — a timer attached to the task you're actually on, with
  optional desktop notifications and a gentle chime at each break.
• Focus blocking — during a session, sites you've listed get a calm
  reminder page instead of your attention. Snooze or end anytime.
• Time insights — where your time actually went: deep-work stretches,
  time by tag, by site, and your top tasks. Measured automatically.
• Tasks and goals — daily/weekly/monthly goals, tasks, tags, and an
  active-task widget on your new tab.
• Achievements — quiet recognition for streaks and follow-through.

Try Pro free for 7 days. Everything that was free stays free.

Your data never leaves your machine. No accounts, no tracking, no servers.

Fixed: Settings > Wallpaper > Remove did nothing (v1.0.4–v1.0.5).
Fixed: the post-checkout page could close before showing activation
guidance (v1.0.5).
```

---

## Shorter variant (~300 characters), if the field is tight

```
LaunchPad Pro is here: focus sessions with optional notifications and
chimes, gentle site blocking while you focus, automatic time insights
(deep work, tags, sites, top tasks), tasks and goals, and achievements.
Free for 7 days. Everything free stays free, and your data still never
leaves your machine.

Fixed: Settings > Wallpaper > Remove did nothing (v1.0.4–v1.0.5).
Fixed: the post-checkout page could close before showing activation
guidance (v1.0.5).
```

---

## Why the two "Fixed" lines are non-negotiable

Both bugs shipped to real users and both are invisible until someone hits them,
which is exactly when a silent fix reads as gaslighting.

- **Wallpaper Remove** (`ddba4d3`) was inert in **v1.0.4 and v1.0.5** — a
  free-tier control, so it affects the whole installed base, not just buyers.
- **Post-checkout close** (`0e76a76`) shipped in **v1.0.5 only** (the handler
  landed 2026-05-09, after v1.0.4). Visiting `mylaunchpad.me/checkout-return`
  closed the tab on every path, including the ones where activation had failed
  and the page was the buyer's only remaining instructions.

The wallpaper line is the one most users can act on. Keep it even if the field
has to be trimmed; trim the marketing bullets first.

## Claims this copy deliberately does NOT make

Checked against ROADMAP.md so the listing cannot promise something the build
does not do:

- **No "Day Recap".** The recap UI and the Deep Diver achievement are v2.1
  (DECISIONS.md 2026-07-07). The tracking engine captures the data now; the
  recap surface is not in this build.
- **No date-range control on Insights.** Every card is a fixed 30-day window
  (`[1.2.2]`, filed post-v2.0). Saying "insights over any period" would be
  false.
- **No cross-device sync, no accounts.** There is no server. The privacy line
  is a statement of architecture, not a policy promise.
- **"Measured automatically"** is accurate — tracking is capture-first and
  local — but avoid "tracks everything you do", which describes the same
  mechanism in the words of the thing this product is positioned against.

## Trial mechanics, so support answers match the listing

- The 7-day trial is **local and instant**: clicking "Start free trial" sets the
  window in local storage. No card, no account, no network call.
- One trial per install (`trialStartedAt` is written once and never cleared).
- At expiry, access drops back to free at read time. Pro data is not deleted —
  it becomes inaccessible until they subscribe, and returns intact if they do.

## Where this goes at upload

1. Chrome Web Store dashboard → the item → **Store listing** → version notes /
   "What's new" field.
2. The **Privacy practices** tab is a separate job and is the known rejection
   risk: every permission needs a justification, and `webNavigation` is new in
   this submission. Draft justification lives in the Asana task
   (1217318434594388) scope notes — review all the others for staleness in the
   same pass.
