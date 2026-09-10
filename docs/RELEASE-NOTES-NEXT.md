# Release notes - NEXT (unnumbered)

**This file is deliberately not numbered.** The manifest version is bumped
manually, only at a Chrome Web Store submission, and the annotated tag follows
the artifact — so a `RELEASE-NOTES-2.2.0.md` sitting here before a submission
would be asserting a version that does not exist yet. Rename this file to
`RELEASE-NOTES-<version>.md` at the moment the submission is cut, the same way
the three numbered files beside it were written.

Same rule as those three: **nothing here describes a feature that is not in the
build.**

---

## PASTE THIS - "What's new" (draft, grows until the release is cut)

```
Shortcut icons are bigger and easier to see.

• Every icon now fills much more of its circle, so logos read
  clearly at a glance instead of floating small in the middle.
  Nothing moved: the circles, the spacing and the grid are
  exactly where they were.
• Small, Medium and Large icon sizes all scale together, and
  emoji and lettered icons now grow with the setting like every
  other icon does.

Group actions no longer hide until you hover.

• "Open All" and the group menu are now always visible on every
  group heading, so opening a whole group in tabs is something
  you can find rather than something you have to discover.
  Nothing moved to make room - those controls always occupied
  that space, they were simply invisible.
```

---

## Context for whoever cuts the release

### The icon change affects everyone, and there is no opt-out

**This is the entry on this page that most needs to be in the notes.**
`[1.10.7]` raised the icon fill ratio from about a quarter of the circle's area
to roughly 71% of its width — `--icon-inner` went 24px to 34px at the default
tier, 20 to 26 at Small and 28 to 40 at Large. Circles are untouched at
36 / 48 / 56, and the grid's column count, every tile position and the total
grid height were measured identical before and after.

But **every existing user gets the new size on update, with no setting to turn
it off.** Every round of the `[1.10.x]` arc before it shipped its feature off or
at today's default, so this is the one change in the arc that a returning user
will notice without having asked for anything. It should not arrive unannounced,
which is why it leads the block above.

Two known limits, both worth knowing before anyone answers a support mail:

- **Some sites publish a logo with whitespace baked into the image.** Those
  render smaller inside the same box than a logo that bleeds to its edges, and
  raising the fill ratio makes that difference more visible rather than less.
  Measured across six real favicons the spread was small — 96.1% to 100% of the
  box — but the fixture contained no heavily padded example, so this is a real
  possibility that simply did not reproduce in testing.
- **Requesting a larger favicon cannot create detail a site does not publish.**
  The Google S2 request went from `sz=128` to `sz=256` for HiDPI headroom, but a
  site that only ships a 16px or 32px icon returns a soft image at any size.

### The group controls were already taking up their space

`[1.10.10]` made `Open All` and the group `...` menu permanent. They had been at
`opacity: 0`, revealed on `.group-header:hover` — and because `opacity` is not a
layout property, **the header height, every first-tile position and the total
grid height are byte-identical before and after**. There is no density cost to
warn anyone about; the only change is ink.

Two things worth knowing if this comes up:

- It also closes a keyboard defect nobody reported. An `opacity: 0` button is
  still in the tab order, so a keyboard user has always been able to land on
  these controls while they were invisible.
- The same round found that neither control had a light-wallpaper ink rule, so
  on a pale wallpaper they rested at 2.80:1 and 2.31:1. That was survivable
  while they only appeared under the pointer; it is not survivable for a control
  that is always on screen, so both now rest at 4.8:1 and 3.4:1.

### The alignment bug was real, and it only ever affected Pro users with an active task

`[1.10.11]` found it after three rounds of measuring the wrong page. The docked
active-task card reserves a 300px lane so content does not slide under it, and
that reserve sat on `.tab-panel` - which centres the clock, the search bar and
the grid, but **not** the logo and tab bar, because the header is a sibling of
the panel rather than a child. The result was Home's header sitting **150px** to
the right of Home's content, on any Pro profile with an active task selected,
whenever the card was expanded.

The reserve now sits on `#content`, which contains the header *and* all four
panels, so the whole column re-centres together in the space the card leaves.
Clearance from the card is unchanged at 62px, measured at 1280, 1659 and 1920.

If a user asks why this was never noticed: every test fixture read "No active
task", so the class that applies the reserve was never set. It is worth a line
in the notes only if the release is thin - the users who saw it are Pro users who
keep an active task running, and to them it will read as the page finally
lining up.

### Not in the notes, deliberately

- **The accent picker.** `[1.10.4]` added a Settings > Appearance > Accent row
  with four colours; `[1.10.8]` removed it. It landed after the `v2.1.0`
  submission and **no release ever carried it**, so there is nothing for a user
  to be told — they never had it. The `--accent` token itself is unchanged and
  every surface that reads it still renders the same blue.
- **The alignment fix** (`[1.10.4]`) and the **one-shortcut-identity fix**
  (`[1.10.6]`) are corrections to behaviour users never saw working differently
  in a shipped build, or that only appear in states they are unlikely to have
  hit. Include them only if the release is otherwise thin.
