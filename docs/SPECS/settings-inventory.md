# The settings inventory, and the redesign's shape

**SR.1, 2026-09-17, research only.** Written against `793cf7c`. No code changed.

Samson called Settings "clinical and jumbled" on 2026-09-12 and "a mess, way too
much going on" on 2026-09-16, and parked the redesign until the feature arcs
landed. They have. This is the count that has to exist before anything is
redrawn, because **a redesign of a panel nobody has counted is a redesign of a
guess**.

**The task's own inventory is out of date and that is the first finding.** It was
written on 2026-09-16 and lists twelve things in Settings and about nine in Pro
Settings. The real numbers are below, and they are roughly three times that.

---

## 1. THE COUNT

Measured in a real browser at 1600x1050, both tiers, with a workspace and two
blocked sites present so the runtime-rendered rows exist.

| | Settings | Pro Settings |
| --- | --- | --- |
| Sections | 5 | 10 |
| **Operable controls** | **22** | **44** |
| Content height | 1052px | 2029px |
| Fits the viewport? | No, by 2px | No, by 979px |
| Control families | 4 | 5 |

**Sixty-six controls across two panels.** Settings overflows a 1050px viewport by
two pixels, which is its own small joke: it is exactly one row past fitting. Pro
Settings is nearly twice the viewport.

### The method, so the number can be re-derived rather than believed

The static markup undercounts badly: roughly a third of Pro Settings is injected
at runtime into empty hosts (`#pro-workspace-list`, `#focus-block-list`,
`#notes-default-color`, `#pomo-sound-options`, `#pro-tags-list`). So the count is
taken from the **live DOM**, not from `newtab.html`:

    panel.querySelectorAll("input, select, textarea, button:not(.settings-close), .seg-btn, .swatch, [role='button']")
      .filter(e => e.offsetParent !== null)

Visible only, panel-close buttons excluded, segmented children counted
individually because a user meets three buttons, not one control. A count taken
from the markup alone would have read 24 and 33 and been wrong in the direction
that matters - it would have missed exactly the rows that grow with the user's
data.

### Control families: [1.11.3b] counted five, there are now seven

| Family | Settings | Pro Settings | Example |
| --- | --- | --- | --- |
| Segmented | 12 | - | Icon size, Text size, Layout, Rotate |
| Checkbox | 4 | 8 | Focus view, Track time on sites, Chain after break |
| Button | 5 | 23 | Change wallpaper, Export backup, Add, Rules |
| Slider (`range`) | 1 | - | Dim wallpaper |
| Text input | - | 3 | Licence key, new tag name, site to block |
| Number input | - | 6 | Focus target, four Pomodoro durations, idle seconds |
| Radio | - | 4 | Chime picker |

**An eighth lives in a modal.** The task says the dropdown was "since replaced".
It was not - it moved. The per-entry **Rules** dialog on a blocked site carries a
`<select>` (`#fb-mode`). So the dropdown is still a family the user meets; it is
just no longer on the panel, which is a different fact from being gone.

### Six seams still measure at zero

[1.11.3b] found the three clock rows at **zero gap** and named that as the
mechanism behind "jumbled". The class did not go away with those rows:

| Panel | Section | Zero-gap seams |
| --- | --- | --- |
| Settings | Appearance | 1 |
| Settings | Backup | 1 |
| Pro Settings | Licence key | 1 |
| Pro Settings | Analytics | 2 |
| Pro Settings | Focus sessions | 1 |

Six places where two consecutive rows touch with no separation at all. This is
not a styling preference - it is the difference between reading a panel as
grouped rows and reading it as a wall.

---

## 2. THE INVENTORY

`Scope`: **G** global (`data.settings.*` or a top-level key), **W** per-workspace.
`Sync`: whether PF.2's allowlist carries it to another machine.

### Settings (free panel; identical for Pro users)

| Control | Type | Storage | Scope | Sync | Tier |
| --- | --- | --- | --- | --- | --- |
| Icon size | segmented (3) | `settings.iconSize` | G | yes | free |
| Text size | segmented (3) | `settings.textSize` | G | yes | free |
| Layout | segmented (3) | `settings.layout` | G | yes | free |
| Focus view | checkbox | `settings.focusView` | G | yes | free |
| Wallpaper: Change | button | `launchpad_background` | G or W | no (image) | free |
| Wallpaper: Remove | button | `launchpad_background` | G or W | no | free |
| Rotate wallpaper | segmented (3) | `bgRotate` | G | **yes** | free |
| Just for this workspace | checkbox | `launchpad_background` | W | no | free |
| Dim wallpaper | slider | `settings.wallDim` | G | yes | free |
| **Track time on sites** | checkbox | `workspace.tracking.enabled` | **W** | no | free |
| Import Chrome bookmarks | button | - (action) | - | - | free |
| Export backup | button | - (action) | - | - | free |
| Import backup | button + file | - (action) | - | - | free |
| Automatic weekly backup | checkbox | `settings.autoBackupEnabled` | G | **no**, ruled | free |
| About / version | text | - | - | - | free |

### Pro Settings

| Control | Type | Storage | Scope | Sync | Tier |
| --- | --- | --- | --- | --- | --- |
| Subscription status + manage | buttons | `data.pro.*` | G | verdict never | Pro |
| Licence key: apply / check / clear | text + 3 buttons | `data.pro.licenseKey` | G | **key yes, verdict no** | Pro |
| Tags: new / save / cancel, per-tag rows | text + buttons | `workspace.tags` | W | no | Pro |
| Workspaces list, create, reorder, delete | buttons + drag | `data.workspaces` | - | no | Pro |
| **Per-workspace tracking** | checkbox per row | `workspace.tracking.enabled` | **W** | no | Pro |
| Combined analytics | checkbox | `settings.combinedAnalyticsEnabled` | G | yes | Pro |
| Daily focus target | number | `settings.focusTargetMin` | G | yes | Pro |
| Default note colour | 8 swatches | `settings.defaultNoteColor` | G | yes | Pro |
| Mode presets (Work / Casual) | 2 buttons | `settings.modePresets` | G | yes | Pro |
| Pomodoro: work / short / long / cycles | 4 numbers | `settings.pomodoro.*` | G | yes | Pro |
| Chain after break | checkbox | `settings.pomodoro.chain` | G | yes | Pro |
| Reset cycle count | button | `settings.pomodoro.*` | G | - | Pro |
| Desktop notifications at each phase | checkbox | `settings.pomodoro.notificationsEnabled` | G | **no**, stripped | Pro |
| Chime picker | 4 radios | `settings.pomodoro.sound` | G | yes | Pro |
| Due reminders | checkbox | `settings.dueRemindersEnabled` | G | yes | Pro |
| Focus blocking: site input + Add | text + button | `data.blockList` | **G** | no | Pro |
| Blocked rows + per-entry Rules | buttons (+ modal `select`) | `data.blockList` | **G** | no | Pro |
| Commitment | checkbox | `settings.focus.commitment` | G | yes | Pro |
| Idle threshold | number | `settings.focus.idleSec` | G | yes | Pro |
| Block automatically during sessions | checkbox | `settings.focus.autoArmDuringWork` | G | yes | Pro |

**Two scope facts that will surprise a reader of the panel.** Focus blocking
*looks* per-workspace - it sits among per-workspace things and the feature is
about how you work - and `data.blockList` is **global**. Tracking is the
opposite: it looks global, and it is **per-workspace**. Neither panel says so.

---

## 3. CLASSIFICATION A - RATE OF USE

A setting touched once at install and a setting flipped daily should not have the
same weight, and today they have exactly the same weight: one row each, in source
order.

### Once, at install or on a new machine (14)

Licence key apply / check / clear, subscription manage, import Chrome bookmarks,
import backup, automatic weekly backup, combined analytics, daily focus target,
idle threshold, commitment, chain after break, reset cycle count, desktop
notifications.

These are **setup**. A user meets them once and is right never to see them again.
Eleven of the fourteen are in Pro Settings, which is most of why that panel is
2029px long.

### Occasionally - weeks or months apart (16)

Icon size, text size, layout, focus view, wallpaper change / remove / per-
workspace, rotate, dim, default note colour, chime picker, Pomodoro durations
(4), export backup.

These are **taste**. They get revisited when something annoys the user or when
the seasons change. They deserve to be findable, not prominent.

### Daily or per-session (the rest, and the interesting ones)

Track time on sites, per-workspace tracking, mode presets, focus blocking's site
list and per-entry rules, due reminders, block automatically during sessions,
workspace create/switch.

**This is the category the panel is worst at**, and Mode is the proof: [1.13.0]
moved it out of Settings into the switcher on precisely this argument, and nobody
has missed it. The blocked-site list is the clearest remaining case - a user
adding a site to block is doing it *because they are about to work*, which is a
per-session act performed in a setup panel.

---

## 4. CLASSIFICATION B - SETTING OR MODE

The [1.13.0] question, applied to every control: is this a preference the user
sets and forgets, or a **state they choose for this session**?

### States, not settings - candidates to leave the panel (6)

| Control | Why it is a state |
| --- | --- |
| **Track time on sites** | "Am I recording this session?" A user turning it off is usually doing so *for now*, not forever. |
| **Per-workspace tracking** | The same question, per workspace - and it is the same stored field, reached from two panels. |
| **Block automatically during sessions** | Arms a behaviour for the sessions you are about to run. |
| **Commitment** | Decides how hard this session's blocking bites. Already a session concept. |
| **Focus blocking site list** | Adding a site is a "today, this is the problem" act. |
| **Mode presets** | Belongs to the mode, which already left. |

### Everything else is a genuine preference

Sizes, layout, wallpaper, chimes, durations, backup, licence, tags, workspaces.
These are set and forgotten, and a settings panel is the right home for them.

**The honest caveat: "candidate to leave" is not "must leave".** [1.13.0] moved
one control and it worked; moving six at once would be a bigger bet than that
evidence supports. The recommendation below sequences it.

---

## 5. CLASSIFICATION C - WHY TWO PANELS

They were split by **tier**, not by **subject**. The Pro Settings entry is hidden
outright for a free user (measured: `#sb-pro-settings` carries `.hidden`), so the
split is a paywall boundary rendered as an information architecture.

### Subjects split across both panels

| Subject | In Settings | In Pro Settings |
| --- | --- | --- |
| **Tracking** | Track time on sites (Privacy) | Per-workspace tracking toggle, combined analytics, focus target |
| **Backup / data** | Export, import, automatic weekly backup | - (but the licence is data too) |
| **Appearance** | Icon size, text size, layout, wallpaper, dim, focus view | Default note colour |
| **About / version** | About section | A second About section |

**Tracking is the worst of these and PT.2 made it worse**, honestly. A user
looking for "the tracking settings" now finds the on/off switch in
Settings → Privacy and everything else about tracking in a panel they cannot open
unless they pay. The two write the **same stored field** - `workspace.tracking.enabled`
through `setTrackingEnabled` - from two different panels, one of which is
invisible to half the users.

**There are two About sections.** Both render a version string. Nobody has ever
needed two.

---

## 6. THE CLAUDE DESIGN QUESTION

Can a design canvas consume this product's constraints? The honest answer, from
what the inventory shows:

### What a canvas CAN be told

| Constraint | How it transfers |
| --- | --- |
| **Tokens** | `tokens.css` holds 105 custom properties. A canvas can be handed the names and values as a palette and a type scale. This transfers cleanly. |
| **The three grounds** | none / dark colour / light colour become **three frames of the same layout**. A canvas is good at exactly this. |
| **Control families** | The seven families above are drawable, and [1.11.3b] already mocked the checkbox. A canvas can hold a component set. |
| **Layout and grouping** | The actual question the redesign exists to answer. A canvas is the right tool. |
| **Copy** | Labels can be pasted in as strings. |

### What a canvas CANNOT enforce

| Constraint | Why not |
| --- | --- |
| **Pixel-contrast on the real grounds** | The instrument measures **composited screen pixels** through `backdrop-filter` over a photograph. A canvas renders its own approximation; it cannot tell you that a token reads 2.53:1 on a light wallpaper. Two rounds this week found exactly that, in shipped chrome, and neither would have been visible in a mock. |
| **The census gate** | Every visible string must be a catalogue key with a description. A canvas produces text, not keys. |
| **The 25 gates** | Ink, button specificity, the anchoring rules, the bell doctrine. All source-level. |
| **`html.bg-light`** | 705 occurrences in `newtab.css`. A canvas frame is one ground at a time by construction; the *pairing* is the thing that breaks, and pairing is not drawable. |
| **State** | Disabled, Pro-locked, empty, error, mid-edit. A canvas shows a state; the code has to enumerate them. |

### So: the canvas decides LAYOUT and GROUPING; the code decides everything measurable

That is the honest line, and it is worth taking - not as a compromise but because
**the rejections this arc has paid for were all layout and grouping rejections**,
never contrast ones. The greeting, the bare-text surface, the accent picker, the
scratchpad, the sounds: five taste rejections after a full build. A canvas moves
that rejection to before the build, which is exactly where it is cheap.

### What a handoff would need to carry

1. **The grouping decision, named.** Which controls sit together and in what
   order - the output that matters.
2. **A control-family mapping.** Every drawn control named as one of the seven
   existing families, or explicitly flagged as a NEW family with its cost stated.
   A canvas that invents an eighth control type has spent a gate's worth of work.
3. **Token names, not colours.** "`--ink-secondary`", never "#B0B0B0". A hex in a
   handoff becomes a hex in the stylesheet, and the per-ground pair is then lost.
4. **Every label as an existing catalogue key** where one exists, and marked NEW
   where it does not - so the census cost is visible before the build.
5. **What is NOT drawn**: the states above. A handoff that shows only the resting
   state silently hands the build four more decisions.
6. **An explicit "measure this" list.** Every new node, to be contrast-checked in
   code on the three real grounds. The canvas cannot answer it; it can name it.

---

## 7. RECOMMENDED SHAPE OF THE ARC

Four rounds, and **a canvas round first**.

**SR.2 - THE CANVAS.** One session in the design tool against the current panel,
producing grouping and layout for both panels as one surface, at the three
grounds. Output is a decision plus the six handoff items above. **No code.**
Samson reacts to frames instead of to a build - which is the whole reason to do
this at all.

**SR.3 - THE STRUCTURE.** Build the agreed grouping with the existing control
families, existing tokens, existing keys. No new families, no new copy where a
key exists. The measurable work - contrast on every moved node, the gates, the
census - lands here, where it can actually be measured.

**SR.4 - THE MOVES.** Classification B's six candidates, sequenced rather than
done at once, starting with the two that are the same stored field reached from
two panels. Each move is a behaviour change with its own before/after.

**SR.5 - THE MERGE, IF IT SURVIVES SR.2.** Whether Settings and Pro Settings
become one panel organised by subject with Pro rows marked, rather than two
organised by tier. This is the biggest idea in the inventory and the one most
likely to be rejected, so it is last and it is conditional.

**Why the canvas goes first and not second:** SR.3's work is determined by SR.2's
answer. Building structure before the grouping is decided is building the thing
the arc exists to decide.

---

## 8. WHAT THIS DOCUMENT DELIBERATELY DOES NOT DO

It does not design the panel. The three classifications are inputs to that
decision, not the decision. Where the inventory points somewhere obvious - the
two About sections, tracking split across a paywall - it says so, and stops.
