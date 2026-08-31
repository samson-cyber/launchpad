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

Sessions: save the tabs you are working in.

• Name a set of open tabs, keep it, and relaunch the whole set
  into a new window in one click. These are sessions you name
  and save on purpose, separate from the automatic five minute
  restore, which is unchanged.
• Rename one, update it from the window you have open now, or
  delete it. Deleted sessions wait 30 days in a trash you can
  open, so you can put one back or clear it out for good.
• Free, with no limit on how many you keep.
• On Pro, attach a session to a task and launch it straight
  from the task row.

Task rows have a visible options button. Hover a task to reach
its menu without right clicking, and set priority or move a task
to a goal from there.

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

Fixed: completing a goal no longer hides the unfinished tasks
inside it. They move to Standalone so you can still see them, and
LaunchPad puts back any task an earlier completion left out of
sight.

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

Sessions: name a set of open tabs, keep it, and relaunch the whole
set into a new window in one click. These are sessions you name and
save on purpose, separate from the automatic five minute restore,
which is unchanged. Deleted ones wait 30 days in a trash you can
open and restore from. Free and unlimited; on Pro you can attach
one to a task.

Task rows have a visible options button, so the row menu no longer
needs a right click, and priority and move-to-a-goal live in it.

Fixed: completing a goal no longer hides the unfinished tasks
inside it.

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
- **Sessions are FREE, and their trash is free with them.** Saving, launching, renaming,
  updating, deleting, restoring and permanently deleting all work on a free profile and
  on an expired one. That is deliberate: the launcher is the free tier's identity, and
  sessions are launching. **Attaching a session to a task is Pro**, not because it was
  gated but because tasks are Pro. On a free or expired profile the attach entries are
  simply **absent** rather than shown-and-disabled, and there is **no upsell inside the
  sessions flyout**. A stored attachment survives a downgrade and returns intact on
  upgrade.
- **The task options button is free**, as the row menu behind it always was. Two of its
  entries (assign and detach a session) are Pro and follow the rule above.
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
- **No claim that sessions replace or change session restore.** They are a separate
  mechanism with separate storage and a separate lifecycle, and the copy says so in the
  same breath it introduces them. The five-minute auto-restore is untouched by this
  release. **The word "session" now carries three meanings across the product** (the
  automatic restore, a focus session on the timer, and a saved set of tabs), so wherever
  the copy uses it, the distinguishing property is named alongside it.
- **No claim that sessions sync, upload, or reach the network at all.** Tabs are captured
  from the window with the browser permission LaunchPad already holds, and each tab's icon
  is stored from the page itself at the moment it is saved rather than fetched from an
  icon service. **This release adds no new required permission**; the only permission
  change in 2.1.0 is the optional `downloads` for the weekly backup.
- **The goal-completion item is stated as a FIX, because it is one.** It repairs a
  pre-existing defect rather than adding behaviour, and it silently puts back tasks an
  earlier completion had hidden. Announcing it as a feature would misdescribe what
  changed, and omitting it would leave users unable to explain why tasks reappeared.
- **"Internal maintenance" is deliberately vague and deliberately present.** It covers
  the tracking-engine source-encoding fix, the rating-link host update, an escaping fix
  in how names are written into the page, and groundwork for future translation. None of
  it is something a user can act on. Silently omitting engine-touching changes is how a
  listing loses the right to be believed.
- **NO CLAIM THAT ANYTHING IS TRANSLATED, because nothing is.** This build carries the
  machinery for translation and exactly one language, English, rendering precisely what it
  rendered before. Naming it in the copy would promise a language the user cannot select.
  It is inside "internal maintenance" because it touched a great deal of code and a listing
  that hides that is not being straight; it is not in the feature list because a feature
  the user cannot use is not a feature.

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
- **Escaping fix for names written into the page.** The helper that puts a user's own text
  into the page escaped the characters that matter in body text but not the quote
  characters that matter inside an HTML attribute, so a session or tag named with a quote
  could put markup where markup does not belong. It needed a name the user had typed
  themselves, so it was never a route in from outside, and it is fixed in the shared helper
  rather than at the one place it was noticed. If support is asked: no data was exposed and
  no action is needed.
- **Translation groundwork, with nothing translated.** Around 440 of the product's messages
  now live in one catalogue with stable identifiers and a note for each explaining where it
  appears, and the code asks that catalogue for them instead of holding the words inline.
  English is the only language present and the words are unchanged, apart from a small
  number of sentences reworded to drop a dash the house style no longer uses. Adding a
  language is now a matter of supplying one file; that decision has not been made.

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

`RELEASE-NOTES-2.0.0.md` describes **the build users are currently on**: v2.0.0 was
submitted on 2026-08-14 and is live. Nothing in this file re-announces it, which is
deliberate; the Pro launch is not news to anyone updating from 2.0.0.

`RELEASE-NOTES-2.0.1.md` describes a build that was prepared, fully gated and **never
uploaded**. Its four items are therefore genuinely new to users and are named in the
copy above rather than restated as their own release.

Leave both files as they stand: each describes the build it was written for.
