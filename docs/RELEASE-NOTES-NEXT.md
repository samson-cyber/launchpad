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
A wallpaper that changes, and one per workspace.

• Turn on rotation and LaunchPad picks a different wallpaper
  from its gallery each day, or each hour. Off by default.
• Pro: give any workspace its own wallpaper. Work and Personal
  can look completely different.
• A workspace with its own wallpaper keeps it - rotation carries
  on everywhere else. Settings says so on screen.

Bring your links in from anywhere.

• Paste a list of URLs, or import a file: Chrome/Edge bookmarks
  HTML, Toby, OneTab, Session Buddy and Speed Dial 2 exports.
  LaunchPad works out which one it is - you do not have to say.
• Every import goes into NEW groups. Nothing you already have is
  replaced, merged or deleted, and one click undoes the whole
  import - even after a reload.
• You see exactly what will arrive before it does, including how
  many of the links you already have.
• Imports can also become saved sessions.

Browse your Chrome bookmarks without leaving the new tab.

• A new Bookmarks entry in the sidebar opens your real bookmark
  tree - folders expand, and clicking anything opens it.
• It stays in step with Chrome: add or rename a bookmark and the
  panel updates while it is open.
• Hover any bookmark to add it straight into LaunchPad.
• LaunchPad only ever READS your bookmarks. It never creates,
  moves, renames or deletes anything in them.

Shortcut icons are bigger and easier to see.

• Every icon now fills much more of its circle, so logos read
  clearly at a glance instead of floating small in the middle.
  Nothing moved: the circles, the spacing and the grid are
  exactly where they were.
• Small, Medium and Large icon sizes all scale together, and
  emoji and lettered icons now grow with the setting like every
  other icon does.

One note, free, on your new tab.

• A scratchpad sits under your shortcuts on Home. Write in it,
  close the tab, come back - it is still there.
• It is free, and it stays free. If you had Pro and stopped,
  you keep this note.
• Pro still has unlimited notes beside your tasks. This one is
  separate from those and always has been - it is not the first
  of them, so nothing you do in the Notes panel can change it.

Group actions no longer hide until you hover.

• "Open All" and the group menu are now always visible on every
  group heading, so opening a whole group in tabs is something
  you can find rather than something you have to discover.
  Nothing moved to make room - those controls always occupied
  that space, they were simply invisible.
```

---

## What is free and what is Pro, so support answers match the copy

**This section supersedes the one in `RELEASE-NOTES-2.1.0.md` from this build onward.**
That file's version is correct for 2.1.0 and is deliberately not edited - 2.1.0 was
submitted without the free note, and a submitted build's notes describe that build.

- **ONE NOTE IS FREE. UNLIMITED NOTES ARE PRO.** The free one is the **scratchpad on
  Home**, under the shortcut grid. Every tier has it: free, trialing, active, grace and
  **expired**. The unlimited notes stay in the Tasks tab, which is a Pro surface, so a
  free or expired user still sees the demo notes there in preview and still cannot
  create one.
- **The free note is NOT the first of the Pro notes**, and the distinction is the one
  support will be asked about. It lives in its own `homeNote` slot, so a Pro user with
  thirty notes who lapses keeps the scratchpad they were always writing in - not
  whichever note happened to be first in the list. Reordering, deleting, importing or
  restoring notes cannot change which note a downgrade leaves behind, because the
  answer was never in that list.
- **Nothing is lost on downgrade.** The Pro notes stay in storage and come back intact
  on re-subscribe. The scratchpad is untouched by either transition.

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

`[1.10.12]` then fixed the movement itself, which had been half-broken since
2.0.0: the transition was declared **inside** the `body.sat-card-open` rule, so
it only existed while the class did. The column animated open and snapped shut -
9 interpolated frames one way, zero the other. The declaration moved to
`#content`'s base rule, where it survives the class going away, and both
directions now run the same 200ms slide. It also gained the
`prefers-reduced-motion` fallback it never had.

If a user asks why this was never noticed: every test fixture read "No active
task", so the class that applies the reserve was never set. It is worth a line
in the notes only if the release is thin - the users who saw it are Pro users who
keep an active task running, and to them it will read as the page finally
lining up.

### The bookmarks panel needs no new permission, and that was checked first

`bookmarks` has been in the manifest since long before this, held so the
one-shot importer could read the tree. The panel reads the same tree, so **the
permission diff against the packaged `v2.1.0` build is empty** - no new install
warning on anyone's update. That was verified as the first act of `[1.11.1]`,
because if it had NOT been held the whole item needed re-deciding rather than
quietly shipping a warning.

Worth having ready if anyone asks: **the read is one-way and enforced.**
`tools/check-bookmarks-readonly.mjs` fails the build if any shipped file calls
`create`, `remove`, `removeTree`, `move` or `update` on `chrome.bookmarks`,
including through dynamic member access.

Performance, measured rather than hoped: opening the panel took 65ms at 100
bookmarks, 82ms at 1,000 and 73ms at 3,000, because only expanded folders render
their children. Expanding one folder holding all 3,000 took 236ms.

### Import: what was measured, and what is honestly unverified

**Storage.** The fear going in was that a large import would reach the 10 MB
`chrome.storage.local` ceiling. Measured on a realistic used profile, it does not
come close: an imported shortcut costs **~236 bytes**, so a 400-bookmark Toby
export is **0.9%** of the quota and a 1,000-line OneTab dump is **2.27%**. The
headroom is roughly **44,000 shortcuts**. The thing that actually threatens that
quota is base64 image data, which `[1.10.2]` measured at 200 icons for 89.6%.

The refusal still exists, because a write that exceeds the quota throws *after*
the caller has mutated its data and the value then reads back absent - an import
that discovered that second would have silently dropped someone's bookmarks. It
projects the serialised size and refuses before writing anything. It is a guard
against pathological input, not against a normal export.

**Formats.** Real export files could not be obtained for four of the six.
Bookmarks HTML is a published standard and was exercised against a structurally
faithful file; Toby, OneTab, Session Buddy and Speed Dial 2 were built from their
documented shapes. **If a support question ever arrives about one of those four,
ask for the file** - it is the thing that has never been seen. Underneath the
brand-specific readers is a generic extractor that finds links in any JSON or
text, so a format that has drifted still imports its links and only loses the
grouping.

**Safety.** Only `http` and `https` survive an import. Bookmark exports really do
contain `javascript:` bookmarklets, and one of those in a tile would run in the
extension's own page.

### Wallpaper: why rotation uses the gallery, and what it costs

Measured before it was built, on a realistic used profile:

- **One uploaded wallpaper costs ~1.08 MB stored** - 10.6% of the 10 MB browser
  quota. Uploads are already capped at 1920px wide and JPEG-encoded, and that is
  what is left after the cap.
- **One gallery pick costs 67 bytes**, because it stores the Unsplash URL rather
  than the picture. That is over 16,000 times cheaper.
- **Four per-workspace uploads would be 42% of the quota.** Seven rotating
  uploads would be 74%, and twelve would be 127% - past the ceiling entirely.

So **rotation stores no images at all.** It stores a mode, and the picture is
derived from the date against the bundled gallery. Nothing accumulates, there is
no index to drift, and every tab agrees without syncing.

**That means rotation uses the disclosed Unsplash path** - the same one picking a
gallery wallpaper already uses today. It adds no new destination and no new
disclosure; it makes an existing one recur. Anyone who never turns rotation on
never touches it, which is why it ships off.

**Per-workspace wallpapers refuse before they write.** Four uploads is 42% of the
quota and the wallpaper writer was found to fail *silently* at the ceiling, so a
per-workspace write now projects its own size first and says no rather than
losing the picture quietly.

**No backup format changed.** The wallpaper key now holds a richer value, but the
backup envelope carries that key verbatim and never looks inside it, so v1 and v2
backups both still restore - proven by importing a real file of each.

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
