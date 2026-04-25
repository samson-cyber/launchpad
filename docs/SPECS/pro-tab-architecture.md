# Spec: Pro Tab Architecture and Free-Tier Gating UX

Status: Draft (v1, 2026-04-24)
Owner: Samson
Related: `workspaces-data-model.md`, `pro-value-proposition.md`, `billing-and-license.md`

> Updated 2026-04-25 to reflect the implementation decision in [1.0.2]: no top header strip, tab bar lives directly under the existing logo. The original top-strip layout was reconsidered to preserve the Google-new-tab-page familiarity that existing free users associate with LaunchPad. See DECISIONS.md entry "Tab bar lives directly under the logo, no top header strip in v1" for the full rationale.

---

## What and Why

Pro features are organized as tabs in a horizontal tab bar at the top of
the new tab page. Free users see the same tab bar with Pro tabs visibly
greyed/translucent. Free users can click Pro tabs to preview the feature
(read-only) but cannot interact with its contents. A pulsing "Upgrade
to Pro" button in the top-right activates when a free user is viewing
a Pro tab.

This pattern:
- Keeps the free experience visible on the Home tab (no regression)
- Makes Pro features discoverable without requiring marketing to show them
- Creates a natural upgrade moment when curiosity drives a click
- Avoids a hard paywall popup that interrupts the new-tab flow

Shipping note: the tab bar itself is a free-tier UI change. It ships with
the Pro launch release in a single combined update (no staged v1.0.5).
See DECISIONS.md for reasoning.

---

## Tab Bar Layout

Position: Directly below the existing centered LaunchPad logo. No top header
strip in v1 — the logo, search bar, and grid stay where they are today, and
the tab bar slips between the logo and the Home tab content. Workspace
switcher and upgrade CTA are deferred to later releases (see those sections
below).

Tabs (left to right):

1. **Home** — existing free experience (bookmarks, groups, wallpaper)
2. **Tasks** — Pro: goals, tasks, tags, active task picker
3. **Dashboard** — Pro: Day Recap, Start of Day, Deep Work time, today/this-week focus
4. **Insights** — Pro: long-term trend charts (Deep Work over weeks/months),
   tag time breakdowns, goal completion history, and achievement badges
   (7 total, greyed placeholders for unearned ones)

Home is the **default landing tab on every new-tab open** for all users.
No tab persistence across new-tab-opens. This preserves the "new tab =
my launchpad" mental model and keeps the experience predictable.

Within a single new-tab session the last-active tab is remembered until
new-tab is reopened; switching tabs within the session is instant and
doesn't reset until the next new-tab-open event.

---

## Tab States

Each tab has three visual states:

**Active (any user):**
- Full color, bold text
- Subtle underline or pill background matching theme accent
- Content rendered below

**Inactive, accessible (any user, or Pro tab for Pro user):**
- Muted text (~60% opacity)
- No underline
- Clickable to activate

**Inactive, gated (free user viewing Pro tab in tab bar):**
- Further muted (~35% opacity)
- Small padlock icon next to label (subtle, 12px)
- Clickable — opens tab in Preview Mode (see below)

Hover state for gated tabs: slight opacity increase, tooltip: "Pro feature
— click to preview"

---

## Preview Mode (free user, Pro tab active)

When a free user clicks a gated Pro tab, the tab activates and shows a
preview of the feature. The preview:

- Shows the feature's UI shell (layout, controls, navigation)
- Pre-populates with representative demo data (not the user's real data)
- Makes all controls visually "present" but non-functional — clicks
  don't save, inputs don't persist
- Includes a thin persistent banner at the top of the content area:
  "Preview mode. Upgrade to Pro to use this feature with your data."
  with a subtle "Start free trial" link

Why preview instead of empty state with upgrade CTA:
- Empty states feel like the feature doesn't exist yet
- Preview lets the user imagine their own use case
- Demo data shows the feature at its best

Demo data conventions per tab:
- **Tasks**: 2 goals ("Ship Q3 report", "Learn TypeScript"), 4 tasks under
  them, 1 active task timer, realistic tag list
- **Dashboard**: sample Day Recap with fake numbers ("3h 42m deep work",
  "4 tasks completed"), sample weekly trend chart
- **Insights**: sample monthly Deep Work trend chart, sample tag breakdown
  pie chart, 3 unlocked achievement badges and 4 greyed placeholders

Demo data is hard-coded in the preview components, NOT written to storage.
No risk of demo data leaking into the user's real state.

---

## Pulsing Upgrade CTA

Placement TBD — decided in [1.0.5]. Visual states and behavior spec is
unchanged from below.

Appearance:
- Small button, text: "Upgrade to Pro" (or "Start free trial" if user
  hasn't started one yet)
- Accent color fill, not outline
- Slight drop shadow

Pulse behavior:
- **Free user on Home tab**: button visible but NOT pulsing. Calm,
  non-intrusive.
- **Free user on Pro tab (preview mode)**: button pulses. Slow breathing
  animation (2s cycle, 8-10% scale variation, subtle opacity shift).
  Intent: "you're exploring a Pro feature — here's the door."
- **Pro user**: button replaced with a small checkmark icon or user's
  status (e.g., "Pro" text badge). No upgrade prompt for paying users.
- **Free user in trial**: button shows "Trial: 5 days left" (counts down).
  Changes to "Upgrade" on trial end.

Click behavior:
- If not in trial and no card: starts 7-day free trial flow (Dodo checkout,
  email capture, no card required)
- If trial has ended: opens upgrade / subscribe flow (Dodo Payments
  checkout)
- If Pro user: opens Pro Settings → Subscription

---

## Workspace Switcher (on the tab bar)

Placement TBD — decided in [1.0.6] when the switcher widget is built.
Candidate locations include the sidebar (top or middle) or the existing
logo area.

See `workspaces-data-model.md` for full behavior. On this spec, scope:

- Free user: switcher hidden entirely
- Pro user with Personal disabled: switcher visible, disabled (greyed),
  tooltip "Enable Personal workspace in Pro Settings"
- Pro user with both enabled: switcher active, shows active workspace
  name + chevron, dropdown lists both

---

## Responsiveness

Tab bar must work at:
- Wide desktop (≥1400px): all tabs visible, labels + icons
- Standard desktop (1024–1400px): all tabs visible, labels + icons
- Narrow (<1024px): tab labels may collapse to icons only with tooltip
  on hover (extensions in narrow Chrome windows — rare but possible)

Mobile new-tab not a concern (Chrome extensions don't run on mobile
Chrome).

---

## Keyboard Accessibility

Keyboard shortcuts deferred. Click-only navigation in v1. Chrome reserves
Ctrl+1..8 for browser tab switching, so a different shortcut would be
needed if added later.

---

## Pro → Free Downgrade Transition

When subscription lapses:
- Tab bar remains in place
- Pro tabs transition from "Active, accessible" state to "Inactive, gated"
  with padlock icon
- If user was on a Pro tab when downgrade detected: auto-switch to Home,
  show brief toast: "Your Pro access has ended. Your data is saved —
  resubscribe anytime to restore full access."
- Pulsing upgrade CTA reactivates when viewing Pro tabs

No data deletion. See `workspaces-data-model.md` + DECISIONS.md.

---

## What This Spec Does NOT Cover

- The internal content/UX of each Pro tab (those are their own specs)
- Goal/task data model (see `goals-and-tasks.md`)
- Tracking engine (see `tracking-engine.md`)
- License verification logic (see `billing-and-license.md`)

---

## Dependencies

- Workspace data model spec (switcher behavior)
- License/billing spec (trial countdown, subscription status detection)
- Each Pro tab's own internal spec (content, not shell)

---

## Acceptance Criteria (for implementation tasks)

- Tab bar renders on Home with no loss of free feature fidelity
- Free user sees greyed Pro tabs with padlock icons
- Free user clicks a Pro tab, sees preview mode with demo data,
  sees preview banner, cannot mutate demo data
- Pulsing upgrade CTA activates when free user is on Pro tab, stops
  pulsing on Home
- Keyboard shortcut Ctrl/Cmd+1..4 jumps between tabs
- Every new-tab open lands on Home regardless of prior tab state
- Pro user sees all tabs active, no padlocks, no preview banners
- Pro → free downgrade transitions Pro tabs to gated state without
  data loss
- Home tab content renders identically to pre-Pro free experience
  (baseline regression check)
