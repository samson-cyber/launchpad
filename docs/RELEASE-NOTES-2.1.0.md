# Release notes - v2.1.0

Store-listing copy for the next Chrome Web Store submission. **Samson pastes the
block below at upload**; everything after it is context for choosing between
variants and for keeping the claims honest.

This is the release the deferred 2.0.1 batch folded into. Same format and the same
rule as the two files beside it: nothing here describes a feature that is not in the
build.

---

## PASTE THIS - "What's new" (primary)

```
Sticky notes, right beside your tasks (Pro).

• Write a note in the panel next to your task list. Pick its paper
  colour, drag notes into the order you want, and search them once
  the stack gets long.
• Turn a note into a task or a goal in one step, keeping the note
  or letting it go.
• Deleted notes wait in the trash for 30 days, so changing your
  mind costs nothing.

Insights: choose your range. Look at today, the past 7 days, the
last 30 days, or pick your own dates within the 30 days of history
LaunchPad keeps. The whole board follows your choice.

Lifetime focused time for each task, shown once it can tell you
something the 30-day figure cannot.

Backup, properly. Export and import now cover everything, including
your tracked focus history, and they stay free. Pro can also back
itself up once a week into your Downloads folder, and never deletes
a backup it has made.

Nested shortcuts that share a name now show what tells them apart.

Also: dropping a tile onto one from a different site now explains
why they did not group, new tasks and goals have a description
field, tags can be created from the Tasks header, and internal
maintenance.

Your data still never leaves your machine.
```

---

## Shorter variant, if the field is tight

```
Sticky notes beside your tasks (Pro): write, colour, reorder, search,
and turn any note into a task or a goal. Deleted notes wait 30 days
in the trash.

Insights now has a date range: today, the past 7 days, the last 30,
or your own dates within the 30 days of history LaunchPad keeps.

Lifetime focused time per task, shown once it says more than the
30-day figure.

Backup now covers everything including your tracked focus history,
and stays free. Pro adds a weekly automatic backup to your Downloads
folder.

Also: same-named nested shortcuts show what tells them apart,
drag-to-nest explains its refusals, descriptions on new tasks and
goals, and a New Tag button.
```

---

## What is free and what is Pro, so support answers match the copy

- **Notes are Pro.** They live in the Tasks tab, which is a Pro surface, so a free or
  expired user sees the demo notes in preview and cannot create one. The copy says
  "(Pro)" on the headline for exactly this reason.
- **Export and import are FREE, and that is deliberate.** Exporting your own data is a
  right, not a paid feature. This release widens what a backup covers for everyone.
- **The weekly automatic backup is Pro**, default OFF, and asks for permission to save
  files only at the moment it is switched on.
- **Insights and lifetime focused time are Pro**, as the whole Insights board already
  was.

## Claims this copy deliberately does NOT make

- **No claim that anything is sent anywhere.** The automatic backup writes a file into
  the user's own Downloads folder using the browser's own download mechanism. No
  server, no account, no cloud API. If their Downloads folder happens to be synced by
  OneDrive, Drive or iCloud, that is their arrangement and not something LaunchPad
  does.
- **No claim that backups are managed for you.** The extension never deletes a backup
  it has written. Weekly files accumulate, and tidying them is the user's business.
  This is stated as a promise ("never deletes") rather than left implied.
- **No change to how long history is kept.** The date range is still bounded by the
  existing 30 days of per-event history, and the picker says so where it stops you.
  Lifetime focused time is an accumulator that grows from now on; it does not
  retroactively invent history, and where it can only repeat the 30-day figure it
  stays hidden rather than pretending to add something.
- **No claim about unshipped surfaces.** Nothing in this copy names a feature that is
  not in this build, in the paste blocks or anywhere else in this file.
- **"Internal maintenance" is deliberately vague and deliberately present.** It covers
  the tracking-engine source-encoding fix and the rating-link host update, neither of
  which a user can act on. Silently omitting engine-touching changes is how a listing
  loses the right to be believed.

## The internal items, for support answers

- **Rating links.** Both in-product Rate links pointed at the pre-2023 store host. It
  still redirects, so nobody was broken, but the canonical address is used directly
  now. No tracking parameters were added: these are asks shown to people who already
  installed, not acquisition links.
- **Tracking engine source encoding.** One separator value inside the engine was stored
  as a raw control character in the source file and is now written as an escape. The
  value the code produces is byte-identical, verified against the previous build, so
  stored data and every figure on the board are unchanged.
- **Same-named nested shortcuts.** The second line under a variant is derived from the
  address already stored, and appears only when two rows in the same dropdown share a
  title. LaunchPad does not read page content to work out which account a tile belongs
  to, and this feature deliberately does not either.

## Where this goes at upload

1. Chrome Web Store dashboard, the item, **Store listing**, version notes /
   "What's new" field.
2. **Privacy practices: this submission is NOT permission-neutral.** It adds
   `downloads` as an **optional** permission for the weekly automatic backup. Optional
   permissions carry no install warning and no re-consent prompt for existing users,
   but the listing needs a justification for it. The `webNavigation` justification from
   the earlier Pro work carries over unchanged; re-read both for staleness at upload.
3. The version number, the annotated tag and the artifact are all decided at
   submission, per CLAUDE.md. The artifact is built fresh from the commit being
   submitted.

## Predecessors

`RELEASE-NOTES-2.0.0.md` and `RELEASE-NOTES-2.0.1.md` describe builds that were
prepared and never uploaded. Leave both as they stand: each describes the build it was
written for, and 2.0.1's content rides along inside this release rather than being
restated as new.
