# Spec: Pro Tab Architecture and Free-Tier Gating UX

Status: Draft (v1, 2026-04-24)
Owner: Samson
Related: `workspaces-data-model.md`, `pro-value-proposition.md`, `billing-and-license.md`

> Updated 2026-04-25 to reflect the implementation decision in [1.0.2]: no top header strip, tab bar lives directly under the existing logo. The original top-strip layout was reconsidered to preserve the Google-new-tab-page familiarity that existing free users associate with LaunchPad. See DECISIONS.md entry "Tab bar lives directly under the logo, no top header strip in v1" for the full rationale.

> Updated 2026-04-25 ([1.0.3]): Pro Settings entry point in v1 is a sidebar item placed above the existing Settings cog, visible only to users with Pro access. The originally-specified entry points (gear icon on Pro tabs, Pro badge in top-right header) are deferred — those UIs don't exist in v1 per the tab-bar-under-logo decision and the deferred upgrade-CTA decision. Future iterations may add additional entry points. See DECISIONS.md entry "Pro Settings v1 entry point is sidebar-only, hidden for free users" for the full rationale.

> Updated 2026-04-26 ([1.0.5]): Upgrade CTA placement settled on the right side of the tab bar pill (a fifth element after the four tab buttons), not a top header. Five visual states now defined (Start free trial / Upgrade / Trial · N days left / Pro badge), each with explicit copy and pulse rules. Click routes through a small upgrade popover anchored to the CTA; the popover includes an "Already have a license?" affordance that calls `ProAccess.applyLicenseKey`. The trial / checkout flow itself is stubbed in [1.0.5] (toast placeholder) — real Dodo Payments integration lands in [1.0.5.1]. See DECISIONS.md entry "Pulsing CTA placement: right side of tab bar pill" for the full rationale.

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

Placement: a fifth element on the right side of the tab bar pill, after
the four tab buttons (Home / Tasks / Dashboard / Insights). Same vertical
band as the tabs, separated by a thin vertical divider. See DECISIONS.md
"Pulsing CTA placement: right side of tab bar pill" for the rationale and
the alternatives that were considered.

Appearance:
- Small pill, text content per state below
- Accent gradient fill (#4a90e2 → #6fb1ff) for the upgrade states; muted
  amber outline for the trial countdown state; transparent + accent
  outline for the Pro badge state
- Slight drop shadow on the upgrade-state fill; outline-only on others

Five visual states (derived from access level + trial-used + active tab):

| State | Condition                                    | Label                  | Pulse | Visual         |
|-------|----------------------------------------------|------------------------|-------|----------------|
| A     | free/expired, no trial used, on Home         | "Start free trial"     | No    | Accent fill    |
| B     | free/expired, no trial used, on Pro tab      | "Start free trial"     | Yes   | Accent fill    |
| C     | free/expired, trial used, on Home            | "Upgrade"              | No    | Accent fill    |
| D     | free/expired, trial used, on Pro tab         | "Upgrade"              | Yes   | Accent fill    |
| E     | trialing                                     | "Trial · N days left"  | No    | Amber outline  |
| F     | active / grace                               | "✓ Pro"                | No    | Accent outline |

Pulse animation: 2s breathing cycle, ~8% scale variation + subtle opacity
shift, driven by a CSS @keyframes (`pp-cta-pulse`) toggled by the
`.is-pulsing` class. Honors `prefers-reduced-motion: reduce` (no animation).

State E label edge cases:
- N === 1 → singular "Trial · 1 day left" (between 24h and 48h remaining)
- N === 0 → "Trial ends today" (final 24 hours of the trial; once the
  trial actually expires, `getProAccessLevel` demotes to free / expired
  and the CTA flips to "Upgrade")
- Narrow viewports (<1024px) collapse to "Trial · 5d" / "1d" / "Today"

Trial countdown re-derives every 60s via a page-scope setInterval so the
label updates without a reload.

Click behavior:
- States A–D: opens the upgrade popover anchored below the CTA, right
  edge aligned to the CTA's right edge
- States E and F: open the Pro Settings panel directly (no popover).
  Trialing users already have an account context — a popover with a
  stub "Manage subscription" button would be a worse interim experience
  than landing in Subscription. See DECISIONS.md 2026-04-26 entry
  "Trialing user CTA click bypasses popover".

The same upgrade popover is opened by the [1.0.4] preview-banner trial
link, anchored to the link itself.

### Upgrade popover

Frosted-glass panel matching Pro Settings (rgba(30,30,30,0.92) +
backdrop-filter blur 14px). Light-wallpaper luminance overrides apply.
Closes on X button, Escape, click outside.

Contents:
1. Header with state-specific title + close (×)
2. Subhead: "Workspaces, tasks, time tracking, and more."
3. Primary CTA button: matches the state's call-to-action ("Start free
   trial" / "Upgrade" / "Manage subscription"). Click is stubbed in
   [1.0.5] (`showToast("Upgrade flow coming soon")`); real Dodo Payments
   integration lands in [1.0.5.1].
4. Divider
5. "Already have a license?" text link → expands inline to reveal an
   `<input>` + `<button>Apply</button>` row. Apply calls
   `ProAccess.applyLicenseKey(data, key)` + `Storage.saveAll(data)`.
   Toast on success / failure. Storage-change listener flips the CTA to
   the Pro badge within ~1s.

This affordance is the canonical free-tier path for entering a license
during the [1.0.5] → [1.0.5.1] gap (the Pro Settings panel itself is
hidden from free users per [1.0.3]).

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
