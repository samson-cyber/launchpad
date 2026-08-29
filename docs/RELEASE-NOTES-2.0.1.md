# Release notes – v2.0.1

Store-listing copy for the fast-follow submission after v2.0.0. **Samson pastes the
block below at upload**; everything after it is context for keeping the claims
honest.

Four changes shipped in this batch. Two are visible to users, two are internal.
Same format as RELEASE-NOTES-2.0.0.md, and the same rule: nothing here describes a
feature that is not in the build.

---

## PASTE THIS – "What's new" (primary)

```
Insights: choose your range.

• Look at today, the past 7 days, the last 30 days, or pick your own
  date range within the 30 days of history LaunchPad keeps.
• The whole board follows your choice: deep work, time by tag, time by
  site and top tasks all move together.
• Your preset is remembered, so you land back on the view you use.

Drag-to-nest now explains itself. Dropping a tile onto a tile from a
different site shows a brief note telling you why they did not group,
instead of quietly reordering them.

Also: rating links now point at the current Chrome Web Store address, and
internal maintenance to how the tracking engine stores one value in its
source. No change to what is measured or kept.
```

---

## Shorter variant, if the field is tight

```
Insights now has a date range: today, the past 7 days, the last 30 days,
or a custom range within your 30 days of history. The whole board follows
your choice and your preset is remembered.

Drag-to-nest explains itself: dropping a tile on a different site's tile
now shows a brief note instead of silently reordering.

Also: updated rating links and internal maintenance. No change to what is
measured or kept.
```

---

## What changed since the v2.0.0 listing text

RELEASE-NOTES-2.0.0.md lists "No date-range control on Insights" under the claims
that copy deliberately does not make, because at the time every card was a fixed
30-day window. **That constraint is lifted in this build** and the 2.0.0 note is
now historical rather than current. Leave the 2.0.0 file as it stands; it
describes the build it shipped with.

## Claims this copy deliberately does NOT make

- **No Day Recap.** Still v2.1. The engine captures the data; the recap surface is
  not in this build, and nothing in this copy hints at one.
- **No change to how long history is kept.** The custom range is bounded by the
  existing 30 days, and the picker says so at the point it stops you. Extending
  retention is a separate decision with storage-size consequences.
- **No claim that the range affects what is measured.** It changes the window you
  are looking through, nothing about capture.
- **"Internal maintenance" is deliberately vague and deliberately present.** The
  tracking engine change is a source-encoding fix with proven-identical runtime
  behaviour, so there is nothing a user can act on, but silently omitting an
  engine-touching change is how a listing loses the right to be believed.

## The two internal items, for support answers

- **Rating links.** Both in-product Rate links (the sidebar entry and the rating
  prompt) pointed at the pre-2023 store host. It still redirects, so nobody was
  broken, but the canonical address is now used directly. No tracking parameters
  were added: these are asks shown to people who already installed, not
  acquisition links.
- **Tracking engine source encoding.** One separator value inside the engine was
  stored as a raw control character in the source file. It is now written as an
  escape. The value the code produces is byte-identical, which was verified
  against the previous build, so stored data and every figure on the board are
  unchanged.

## Where this goes at upload

1. Chrome Web Store dashboard, the item, **Store listing**, version notes /
   "What's new" field.
2. **Privacy practices**: no new permissions in this batch, so the justifications
   from the v2.0.0 submission carry over unchanged. Re-read them for staleness
   anyway if v2.0.0 has not yet been approved at the time 2.0.1 goes up.
