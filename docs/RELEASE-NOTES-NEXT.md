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
