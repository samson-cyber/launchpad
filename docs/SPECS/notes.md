# Notes Feature - LaunchPad Pro

Status: **v1.1 SHIPPED.** Drafted 2026-05-15; reconciled to shipped reality 2026-08-30;
Notebooks re-specced against the shipped panel 2026-09-16 (NB.1, Asana 1218038593317315).

> **Read the reconciliation banner in the v1.1 section before trusting any interaction
> described here.** The May draft specced a full-tab, 2D drag-positioned feature. Samson
> redirected the design on 2026-08-29 after seeing the first render, and most interaction
> details changed.
>
> **The Notebooks section below was rewritten on 2026-09-16 and no longer describes a
> master-detail layout.** The version it replaced assumed a full tab area, a left notebook
> column, a right content pane and live `{x, y}` note positions - four assumptions, none of
> which survived the v1.1 redirect. What replaced them is in that section's own banner.
Owner: Samson
Related: `workspaces-data-model.md`, `trash-bin.md`, `tasks-and-goals.md`, `pro-tab-architecture.md`

---

## Purpose

Quick capture of thoughts, meeting notes, and reminders inside LaunchPad. Solves the "scattered text files across my system" problem by giving users a dedicated, visible, capture-first surface inside the new-tab experience. Sticky-note aesthetic chosen for instant recognizability and warm, low-pressure capture vibes.

## Tier

Pro-only. **Notes inherit the Tasks tab's gate rather than owning one** (see Layout): the live
panel is emitted inside the tasks surface and the demo column inside the tasks preview, so there
is no separate Notes gate to keep in sync and no greyed Notes tab to click.

Five license states govern it, per CLAUDE.md "Pro Access States": `trialing`, `active` and
`grace` get the real panel; `free` and **`expired`** get the preview. **`expired` is full preview
lockout, identical to free except CTA copy - there is NO read-only fallback**, so notes are never
more permissive than the tasks surface they sit inside.

## Release plan

- v1.1.0 - Standalone notes. **SHIPPED** across `[1.1.0]`-`[1.1.7]`, riding the 2.1.0 store release.
- Clip-to-note. **SHIPPED** in `[1.14.3]` (TD.3), which gave a note its first structured field
  beyond text (`sourceUrl`) and its first writer outside the page (the service worker).
- Notebooks - the organizational layer. **UNBUILT.** Re-specced 2026-09-16 against the panel that
  exists; the arc is `[1.15.x]` on the marker track, rounds NB.1 (this spec), NB.2 (data model and
  storage) and NB.3 (UI and checkpoint).

**A NUMBERING NOTE, because this doc is where the collision is easiest to trip over.** ROADMAP.md
calls Notebooks `v1.2.0`, which is a **Notes-era release label**, not the `[1.2.0]` feature marker -
that marker belongs to Focus Blocking. ROADMAP records the clash as cosmetic. This spec therefore
says **"Notebooks"** and never "v1.2.0", and the marker-track name for the work is `[1.15.x]`.

## Workspace scoping

Notes are workspace-scoped. Each workspace has its own notes and, once Notebooks ships, its own
notebooks. Switching workspaces shows the active workspace's notes. The data model lives inside the
workspace shape:

```
workspace = {
  ...existing fields...,
  notes: [Note],
  notebooks: [Notebook]  // NOT YET IN CODE - added by NB.2; see the Notebooks data model
}
```

**`notebooks` is not in `getDefaultData` today**, although `workspaces-data-model.md` has listed it
in the workspace shape since the original planning. The doc is ahead of the code; NB.2 makes them
agree. Until then, nothing may read `ws.notebooks` without an array guard.

## Visual design - nostalgic-realistic sticky notes

Design intent: a user seeing the notes panel should recognize "these are sticky notes" within 2 seconds, evoking the physical desk metaphor. Visual cues:

- Paper-textured background using CSS-only noise/grain (no image assets - keep extension light)
- Slight fixed rotation per note (-2 to +2 degrees, assigned at creation time and stored)
- Soft layered drop shadow (1-2 layers for depth)
- Slight curl effect at one corner using CSS pseudo-element
- Paper color palette (initial set, may iterate): cream, butter-yellow, soft-pink, mint, sky-blue, peach, lavender
- Hover state: subtle scale-up + shadow lift (very subtle, not a "click me" bounce)

The visual style is owned in CSS, no JS dependency. Note that this aesthetic ages with the rest of the UI - acceptable trade-off for personality and brand identity.

---

## v1.1 - Standalone notes

> **RECONCILED 2026-08-30 to what shipped.** Everything below describes the built feature. The
> May draft is superseded on: where notes live (Tasks panel, not a Notes tab), how they are
> created (ghost note, not a header button or empty-space click), how they are ordered (canonical
> array order, not `{x, y}` positions), how they are searched (threshold-gated, text only), how
> trash is reached (footer button, no drag-to-trash), and how promote-and-delete is chosen
> (a checkbox in the modal, not extra menu entries). Reasoning for each is in DECISIONS.md
> 2026-08-30. **Where this doc and `storage.js` / `newtab.js` disagree, the code is right.**

### Layout

Notes are the **right-hand panel of the Tasks tab**, not a tab of their own. The split is roughly
80/20 (tasks/notes) with a **260px floor** on the panel. Below a **900px viewport width** the panel
moves under the tasks content at full width and the stack switches from a vertical column to a
horizontal wrap.

The 900px breakpoint was measured, not chosen: the tasks body first overflows at **730px**, and 900
leaves 170px of clearance above that cliff. The notes stack is `flex: 1; overflow-y: auto` inside
the panel, so it scrolls itself in the wide branch; in the narrow branch the panel grows to content
height and `.tab-panel` becomes the scroller, which is why the trash footer is `position: sticky`.

### Note data model

```
note = {
  id: string (stable unique, "note_" prefix),
  content: string (plain text for v1; markdown is a future consideration),
  color: string (palette TOKEN NAME: cream | butter-yellow | soft-pink | mint | sky-blue | peach | lavender),
  position: { x: number, y: number },  // RESERVED AND DORMANT - see below
  rotation: number,  // -2 to +2 degrees, rolled once at creation and stored, never re-rolled at render
  notebookId: string | null,  // PRESENT AND DORMANT - see below
  sourceUrl: string | null,   // [1.14.3] the page a CLIP came from; null for every other note
  tagIds: [string],  // tag ids, integrates with existing tag system
  createdAt: number,  // epoch ms (Date.now())
  updatedAt: number,  // epoch ms (Date.now())
  deletedAt: number | null  // epoch ms when trashed, per trash-bin.md; null when live
}
```

Timestamps are **epoch milliseconds** (`Date.now()`), not ISO strings. This doc said ISO until
2026-08-29; the sibling entities and `trash-bin.md`'s `deletedAt = Date.now()` always disagreed, and
the 30-day purge sweep does arithmetic on `deletedAt`, so ISO would have broken it. Tag references
are `tagIds`, matching tasks and the purge cascade that cleans ids out of every item's `tagIds`
array. **The shipped `[1.1.0]` implementation in `storage.js` is the reference** for this shape.

**`position` IS DORMANT.** Nothing reads or writes it. **Order is canonical array order** in
`ws.notes`: the stack renders the array as-is, new notes unshift to the front, and drag-to-reorder
permutes the array. The field is kept as reserved space with a marker comment in `storage.js` and
carries no semantics; a future feature that wants it must define them from scratch. Colour is stored
as a token NAME rather than a hex, so a palette change is a CSS edit and never a data migration.

**`sourceUrl` IS LIVE, AND IT IS `http(s)` ONLY.** `[1.14.3]` added it. It is `null` on every note
that is not a clip, and a reader renders nothing when it is absent, so every pre-existing note is
byte-identical through that change. The scheme restriction is a safety rule rather than a tidiness
one: a clip's URL is rendered as a LINK, and a `javascript:` or `data:` URL reaching an `href` would
hand a page the user merely right-clicked a click target inside the product. Anything else stores
`null` and the note keeps its text. `Storage.coerceSourceUrl` is the single gate.

**`notebookId` IS PRESENT AND DORMANT, AND IT IS THE ONE MUSEUM PIECE IN THIS RECORD.** It has
been on the shape since `[1.1.0]`, is written once at creation as `null`, is passed through by
`updateNote`, and **is read by nothing.** That is precisely the field-with-a-writer-and-no-reader
the museum rule forbids, and it survives only because it was specced to be filled by the round that
is now being written. **NB.2 gives it its reader in the same commit that gives it its first real
writer** - see the Notebooks data model. If Notebooks is ever abandoned, this field goes with it.

### Interactions

- **Create: the ghost note**, a dashed, faded, un-rotated, curl-less placeholder card **at the TOP of
  the stack**, rendered exactly once and always first. Clicking it creates a note and enters edit
  immediately. It is the only creation affordance (no header button, no click-empty-space), and it
  **doubles as the zero-notes empty state**.
- **Inline editing:** click a note to edit; click outside or press Escape both **save**. An empty
  note abandoned by either route deletes itself rather than persisting blank. The card flattens its
  rotation while it holds the editing caret (a caret inside a transformed element blinks once and
  dies - BUGS.md **D19**), so the note straightens as you write and tilts back when you are done.
- **Drag to REORDER**, vertically within the panel, on the shared SortableJS idiom. Commits by note
  ID rather than by list index, because the stack shows only live notes while the array also holds
  soft-deleted ones. **Reorder is disabled while a search filter is active.**
- **Right-click menu, exactly three entries** plus the swatch row: Change colour (seven swatches),
  Promote to task, Promote to goal, Delete. Tag assignment from notes does not exist yet.
- **Per-note hover trash**, top-right of the card, clear of the bottom-right curl. Revealed on hover
  and on `:focus-within`, so it is reachable by keyboard.
- **Search: a slim input that renders ONLY above 6 live notes.** Case-insensitive substring on
  content, text only; no tag chips (there is no tag-assignment affordance for notes to filter on).
  Clearing restores the stack. The ghost note stays visible and functional while filtering, and
  creating from it clears the filter.
- **Keyboard:** Tab / Shift+Tab across notes, Enter to edit the focused note, Escape to save, ARIA
  labels on every interactive control, tier-aware focus rings. **Ctrl+N and arrow-key spatial
  navigation are deliberately cut** per the standing click-only rejection.
- **Clip a selection from any page** (`[1.14.3]`): highlight text, right-click, Save to LaunchPad.
  The note is written **by the service worker**, not the page - through `enqueueBgData`, because a
  background writer of the `data` key that skips the queue clobbers or is clobbered by a concurrent
  `getAll -> mutate -> saveAll` elsewhere. Entitlement is **re-checked at write time**, not only
  when the menu was built: the menu is a cached artifact of the last rebuild and entitlement can
  lapse in between. **The clip lands at the TOP of the standalone stack**, which is where a new note
  lands, and it carries `sourceUrl`. This is the one note-creation path with no LaunchPad surface on
  screen, which is why its acknowledgement prefers a notification over a toast.

### Notes settings (Pro Settings)

One setting: **default paper colour for new notes**, a seven-swatch picker plus a "cycle" option,
stored as a token name. Precedence is explicit choice > setting > cycle, and **absence means cycle**,
so the count-keyed palette rotation stays the untouched default.

### Promote-to-task

Right-click a note, "Promote to task", opens the existing task creation modal pre-filled: first ~80
characters of content as the task name (truncated on a word boundary), the full content as the
**description**. The user picks a target goal or "Standalone" from the existing dropdown.

**"Promote and delete" is a CHECKBOX INSIDE THE MODAL** ("Delete note after creating", default
unchecked), not a second menu entry. Promote is copy-semantics by default: on plain confirm the note
is untouched. A cancelled modal creates nothing and deletes nothing, and a failed creation leaves the
note alive.

**The Description field did not exist before this feature.** Neither creation modal had one, in
either tab, while both data models had stored `description` all along. It was added to **New Task and
New Goal both, always visible**, as a multi-line textarea. Every user meets it whether or not they
ever touch a note.

### Promote-to-goal

Same shape: goal name defaults to the first line of the note, full content becomes the goal
description, and the same "delete after creating" checkbox applies.

### Trash

**There is no trash can to drag onto.** Drag-to-trash is cut: SortableJS reorder owns dragging in the
stack, and a second drag semantic in the same column is a mode conflict. Deletion has two affordances,
the per-note hover trash and the menu item, and both route through one function so they cannot drift.

The trash entrance is a **full-width button in the panel footer**, styled on the `.tasks-action`
family and `position: sticky; bottom: 0`. It renders **only when the workspace has trashed notes** -
zero chrome at zero trash, mirroring the search threshold. Visible label is `Trash - N`; the
accessible name pluralises properly ("1 note in trash" / "2 notes in trash"). The strip behind it is
fully transparent and `pointer-events: none`, so it cannot sit between the cursor and a bottom drop
target.

Clicking it opens the trash view as a modal overlay, scoped to the current workspace: content preview
(~3 lines), days until permanent deletion, Restore, Delete Permanently, and Empty Trash with
confirmation. The countdown carries the **amber/red band shift** `trash-bin.md` describes, using the
tasks-side `trashCountdownClass` helper and its tokens (<=2 days red, <=7 amber) so the two trash
surfaces cannot diverge.

30-day auto-purge is the universal lifecycle per `docs/SPECS/trash-bin.md`. **Notes had to be
registered explicitly in that sweep** - both in its entity enumeration and in its tag-id cascade -
because both are hardcoded lists rather than a registry. See BUGS.md **E5**.

### Free user Preview Mode

A free or expired user opening the **Tasks** tab gets the tasks preview shell, and the notes column is
emitted inside it: **five** demo notes (not the May draft's 6-8; the panel is a 20% column) in five
distinct paper colours, realistic and PII-free, rendered through the **same card component** as real
notes so the styling path is identical rather than merely similar.

The preview is inert: no create, no edit, no drag, no delete. **No ghost note** - a create affordance
on a surface that can never create reads as broken rather than as locked. Preview cards carry no hover
trash, are not keyboard focusable, and are `aria-hidden`. The preview writes **nothing** to storage,
and the standard pulsing upgrade CTA belongs to the tasks preview shell.

### Empty states

- **No notes exist:** the ghost note IS the empty state. There is no separate empty-state branch to
  keep in sync.
- **All notes filtered out:** the stack empties while the ghost note and the search input remain, so
  the filter is visibly clearable.

---

## Notebooks

> **RE-SPECCED 2026-09-16 (NB.1).** The version this replaces described a master-detail layout: a
> left notebook column at 1/5, a right content pane at 4/5, a persistent "Standalone Notes" home
> item, and drag-out restoring `{x, y}` grid positions. **All four assumptions are dead.** Notes are
> not a tab; they are a 20% column of the Tasks tab with a 260px floor, so there is no 4/5 pane to
> swap and no room for a column inside a column. `position` is dormant and holds nothing, so there
> are no positions to restore. Everything below is written against the panel that exists, and every
> decision names what it costs the notes stack, because the stack is the feature and Notebooks is
> an organiser sitting on top of it.

### What a notebook groups, and what "feed" means

**A notebook groups NOTES AND NOTHING ELSE.** It is not a container for tasks, goals, sessions or
attachments; those have their own homes and their own relations, and a notebook that grouped two
kinds of thing would immediately need a rule for what "delete" means to each.

The task's framing is that quick-add and clip "feed" notebooks. Concretely, and this is narrower
than it sounds:

- **Clip FEEDS notes, and therefore feeds notebooks only through a note.** `[1.14.3]` gives every
  clip a note at the top of the standalone stack. See "What a clip does" below, which rules that it
  keeps landing exactly there.
- **QUICK-ADD DOES NOT FEED NOTES AT ALL, and the plan's wording is loose here.** `[1.14.1]`'s
  quick-add parses a sentence into a **TASK** - title, due date, priority, tags. It has no note
  path, on either of its two surfaces. The only bridge between the two features runs the OTHER
  way: **promote-to-task** turns a note into a task. So "quick-add feeds notebooks" describes
  nothing that exists, and NB.2 should not go looking for it. If a future round wants a note
  quick-add, that is a new surface and a new decision, not a wiring job.

### Layout: a chip strip, not a column

**THE DECISION: notebooks are a single-row strip of chips between the panel title and the search
input. There is no notebook column, because there is no room for one.**

The panel is `flex: 0 0 20%` with `min-width: 260px`. Splitting 260px into a notebook column and a
notes stack leaves roughly 130px each - narrower than a single note card, on the surface whose
entire job is showing note cards. A collapsed rail is no better: 24px of permanent chrome is nearly
10% of the panel's floor width, spent on a control used far less often than the stack beside it.

So the strip runs horizontally: `All notes` first and always, then one chip per notebook, then a
trailing `+` that creates one. It scrolls horizontally when the chips overflow rather than wrapping
to a second row, because a strip that can grow to two rows can grow to three and the stack pays for
every one of them.

**WHAT IT COSTS THE STACK: one row, about 32px, and only when at least one notebook exists.** The
strip is **threshold-gated exactly as its two neighbours already are** - the search input renders
only above 6 live notes, and the trash bar renders only when the workspace has trashed notes. Zero
notebooks means zero chrome, so a user who never makes one sees a panel byte-identical to today's.
That is the panel's established idiom and Notebooks does not get to be the first exception to it.

**Selecting a chip scopes the stack; it does not navigate.** `All notes` shows every live note,
which is today's behaviour unchanged. A notebook chip filters the stack to that notebook's notes.
The ghost note stays first in both scopes, and creating from it inside a notebook scope creates the
note **in that notebook** - the scope is the context, so the create affordance means what the strip
says it means. There is no "notebook view" as a separate screen; there is one stack with a scope.

**Because a scope is not a screen, every per-note behaviour is unchanged inside one.** Promote-to-
task, promote-to-goal, colour, the hover trash, inline edit and the "delete note after creating"
checkbox are the same menu on the same card, and promote **leaves `notebookId` alone** - a note
promoted from inside a notebook stays in that notebook unless the checkbox deletes it. The previous
draft carried a whole section asserting this; under the scope model there is nothing to assert,
because there is no second code path for it to diverge from. **Search is the one exception and it
needs deciding in NB.3: a filter inside a notebook scope searches THAT notebook only.** Searching
everything from inside a scope would make the scope a lie, and reorder is already disabled while a
filter is active, so the two interact in the way they already do.

Below the 900px breakpoint the panel already moves under the tasks content at full width and the
stack becomes a horizontal wrap. **The strip needs no second layout there** - it is already a
horizontal row, and at full width it simply has more room.

### Drag-to-combine

**THE GESTURE: drag one note onto another and drop. The two become a notebook.** No modifier key.

**Why this is buildable here when drag-to-trash was refused, since the two look alike.** Drag-to-
trash was cut because SortableJS owns dragging in this column and a second drag semantic in the
same column is a mode conflict. That reasoning was about a drop target OUTSIDE the list - a can in
the footer that the sortable knows nothing about. **Drop-on-item is a different shape and this
codebase already ships it**: the Home grid nests one shortcut into another by hit-testing the
pointer against a target's own sub-element, gating on a `data-nest-target` flag, and highlighting
the target - all while SortableJS continues to own ordinary sorting on the same grid. Notebooks
reuses that idiom rather than inventing a second one.

**NO MODIFIER KEY, AND THIS IS A HARD CONSTRAINT RATHER THAN A PREFERENCE.** The grid's nest reads
a held Shift to choose between two nest outcomes. Chrome **swallows key events during a native
drag** (BUGS.md **I8**'s neighbourhood), which is why shift-drag is the product's worked example of
a gesture that cannot be exercised end to end and has to be named as a gap instead of claimed.
Combining is a single unambiguous outcome, so it needs no second mode - and specifying it without a
modifier is what keeps NB.3 verifiable rather than shipping on an untestable gesture.

**THE NEW NOTEBOOK IS CALLED "New notebook", and the name is NOT derived from either note.**
Deriving it would mean picking one of the two arbitrarily and baking that guess into a label the
user then has to correct; the first line of a clipped paragraph makes a particularly bad folder
name. Instead **inline rename opens immediately on creation with the text selected**, the shape
goal and group renaming already use, so naming it is one typed word and dismissing the rename keeps
the default.

**WHAT HAPPENS TO BOTH NOTES' POSITIONS: both leave the standalone stack, and inside the notebook
the order is TARGET FIRST, DRAGGED SECOND.** The target was already sitting where the user aimed;
the dragged note arrived. **Array order stays canonical inside a notebook exactly as it is in the
stack** - one ordering model in this feature, not two - and `position {x, y}` stays dormant. A
notebook must not assume that field holds anything, which is the assumption that killed the
previous draft of this section.

**The menu route is equal, not a fallback.** A note's right-click menu gains **Add to notebook**,
listing existing notebooks plus "New notebook...". Drag is faster; the menu is reachable by
keyboard, and a gesture that only exists as a drag is a gesture a keyboard user does not have.

### Drag-out

**THE GESTURE: with a notebook scope active, drag a note onto the `All notes` chip.** That chip is
the only standalone target guaranteed to be on screen whenever a notebook is selected, which is
what makes it the right one - the old spec's "Standalone Notes" home item does not exist and is not
coming back.

**THE NOTE LANDS AT THE TOP OF THE STANDALONE STACK.** Not appended at the bottom. "It came back"
and "it just arrived" are the same event from the stack's point of view, and both a new note and a
clip already land at the top; dropping a note to the bottom of a forty-note stack makes a
deliberate action look like it did nothing. The menu equivalent is **Remove from notebook**, on the
same note menu.

A notebook emptied this way **is not auto-deleted.** An empty notebook is a container the user made
and may be about to fill; deleting it out from under them to tidy up is the product making a
decision it was not asked to make.

### Deletion: the notes are released, never cascaded

**THE DECISION: deleting a notebook soft-deletes THE NOTEBOOK ONLY. Its notes are released to the
top of the standalone stack. There is no cascade option.**

**Why, and it is the strongest argument in this spec.** `[1.4.x]` fixed a defect where completing a
goal HID its unfinished tasks; twenty of Samson's own tasks were affected and needed a migration
sweep to recover. A notebook that silently takes twelve notes into the trash with it is that same
visible wrong in a new costume - a container disappearing and taking uncounted work with it. A
notebook is an ORGANISER, not a container of record: the notes existed before it and do not depend
on it. So the safe default is the one where nothing the user did not individually name gets deleted.

**THE OLD SPEC'S TWO-OPTION MODAL IS CUT.** It offered "Move notes to standalone" (default) and
"Delete notebook and all notes". A destructive modal that asks the user to choose between two
irreversible-feeling outcomes, under the time pressure of having just clicked Delete, is a worse
surface than one that does the safe thing and says so. The cascade is still reachable in one extra
step - release, then delete the notes - and that route has the advantage that **each deletion is
visible and separately restorable**, which the cascade never was.

**THE MODAL IS `confirmModal`, per the no-native-dialogs rule**, and it **states the count**:

> **Delete "Research"?**
> Its 4 notes stay in All notes. The notebook goes to trash for 30 days.
> [Cancel] [Delete notebook]

Marked `dangerous`. The count is rendered from the live membership at open time rather than a
remembered number, and it is the whole reassurance: a user who believes their notes are about to go
with it will not click, and a modal that does not say so leaves them guessing.

### The trash unit

**THE DECISION: a trashed notebook is its OWN trash row and carries no notes. Restoring it restores
an empty notebook. Purge at 30 days removes the notebook record only.**

**This is not a second decision; it is the first one seen from the trash's side.** Because deletion
releases the notes, there are never any notes inside a trashed notebook to unit up with. Had the
cascade survived, the trash would have needed a composite row that renders a notebook plus a note
count, a restore that re-attaches every child by id, a purge that deletes notes the user never
trashed, and a rule for what happens when a released-then-trashed note is restored into a notebook
that has since been purged. The release decision deletes all four problems rather than solving them.

**THE CONSEQUENCE, STATED RATHER THAN BURIED: restoring a notebook does NOT restore its membership.**
The notes were released when it was deleted and they stay where they are. That is the price of the
release rule and it is the right price - re-grouping a handful of notes is a minute's work, and a
note that vanished with a folder is not recoverable by any amount of work if the user never noticed.
The deletion modal's wording carries this: it says the notes STAY, which is also a promise that they
will not come back.

**30-day purge is the universal lifecycle** per `trash-bin.md`, unchanged and not re-litigated here.

### Data model

```
notebook = {
  id: string,            // "nb_" prefix, stable unique
  name: string,
  createdAt: number,     // epoch ms (Date.now())
  updatedAt: number,     // epoch ms (Date.now())
  deletedAt: number | null   // epoch ms when trashed, per trash-bin.md; null when live
}
```

**THERE IS NO `position` FIELD, and its absence is deliberate.** The previous draft carried
`position: number` for a note's place in the left column list. There is no left column, and
`ws.notebooks` array order is canonical for the chip strip exactly as `ws.notes` array order is
canonical for the stack. **One ordering model in this feature, not two** - the same rule that the
v1.1 redirect had to establish the hard way when a render-time sort and an array push disagreed and
a committed reorder had nowhere to land.

**`note.notebookId` IS THE ASSOCIATION, and NB.2 discharges the museum rule on it.** The field
already exists, already defaults to `null`, and is already passed through by `updateNote`. It has
had no reader since `[1.1.0]`. NB.2 adds its first real writer and its first reader **in the same
commit**, which is what the museum rule asks for.

**Per-field updaters, no whole-object writes:**

- `createNotebook(data, fields, workspaceId)`
- `renameNotebook(data, notebookId, name, workspaceId)`
- `deleteNotebook(data, notebookId, workspaceId)` - soft-delete, AND release membership
- `restoreNotebook(data, notebookId, workspaceId)`
- `deleteNotebookPermanent(data, notebookId, workspaceId)`
- `reorderNotebooks(data, orderedIds, workspaceId)`
- `setNoteNotebook(data, noteId, notebookId | null, workspaceId)`

**`setNoteNotebook` IS THE ONLY WRITER OF MEMBERSHIP**, and that is the load-bearing line in this
list. Drag-to-combine, drag-out, the menu's Add to notebook, the menu's Remove from notebook and
the release inside `deleteNotebook` are five callers of one function. Five callers each doing their
own assignment is five chances for the rule to drift, and the product has a worked example of
exactly that: `[1.4.7]` put the release-on-goal-completion in a shared helper rather than at each
call site, on the reasoning that it "belongs to the state change, not to one caller's reasoning".

**`deleteNotebook` RELEASES BEFORE IT SOFT-DELETES, in that order and in one write.** The ordering
matters for the same reason `[1.4.7]`'s does: no reader may observe a trashed notebook that still
holds live notes, and doing the release after the soft-delete leaves exactly that window.

**Purge registration AT BIRTH.** `"notebooks"` joins `purgeExpiredTrash`'s per-workspace entity
list **in the commit that creates the record type**, not a later one. That list is a hardcoded
literal rather than a registry (BUGS.md **E5**, generalised in **E7**), and notes are the standing
proof of the cost: they soft-deleted correctly and **simply never purged** from `[1.1.0]` until
`[1.1.3]`, while the trash view counted down to a deletion that could never arrive.

**Notebooks carry NO `tagIds`, so the purge sweep's SECOND hardcoded list - the tag-id cascade - is
deliberately NOT touched.** Stated explicitly so a later reader auditing E5 does not "complete" the
registration by adding notebooks to a cascade that has nothing to clean.

**`ensureNotebooksArrays(data)` joins `getAll`'s sweep chain**, in the shape of `ensureNotesArrays`:
assign `ws.notebooks = []` **only** when the field is missing or not an array, and return whether
anything changed. **I28 is the whole reason that shape matters.** `getAll` runs its sweeps on every
single call and writes the entire blob back if any of them reports a change, so a sweep that is not
idempotent does not write once - it writes forever, on every read, in every context. The warm-fixture
assertion in the background-queue gate is what catches it.

`getDefaultData`'s workspace shape gains `notebooks: []` in the same commit. **Note for NB.2:**
`workspaces-data-model.md` has listed `"notebooks": []` in the workspace shape since the v1.2.0
planning, but `getDefaultData` has never had the key - the doc is ahead of the code, and NB.2 makes
them agree rather than treating the doc as evidence the field exists.

### What a clip does

**THE DECISION: a clipped note lands STANDALONE, at the top of the stack. Unchanged by this arc.**
No "Clipped" notebook, no capture into the active notebook. **NB.2 must not modify
`clipSelectionToNoteBg`.**

Three reasons, and the first is decisive on its own:

1. **The clip is written by the SERVICE WORKER, which cannot know which chip is active.** The
   active scope is page state, in one tab, of possibly several. The worker would have to read UI
   state it does not own, or guess - and a clip filed into a notebook the user was not looking at
   is a clip they will not find.
2. **An auto-created "Clipped" notebook is a folder nobody asked for**, and it turns every
   subsequent clip into something filed away rather than something that arrived.
3. **The top of the standalone stack is where the user already looks** for the thing that just
   happened, which is exactly why `[1.14.3]` put it there.

A clip can of course be dragged into a notebook afterwards, like any other note.

### Pro

**Notebooks inherit the Tasks tab's gate, one level further down than notes already do.** There is
no notebooks gate to keep in sync, for the same reason there is no notes gate. The five license
states behave exactly as they do for notes: `trialing`, `active` and `grace` get the real thing;
`free` and `expired` get the preview, with **`expired` a full preview lockout identical to free**
except CTA copy.

**THE FREE PREVIEW SHOWS NO NOTEBOOKS AND NO CHIP STRIP.** Two independent reasons, and either
alone is sufficient:

- **The preview rule forbids it.** A preview surface must never render a create affordance, and the
  strip's trailing `+` is one. A control that cannot do anything reads as broken rather than as
  locked - the `[1.1.4]` preview-ghost bug is the worked example, and it was this same panel.
- **The threshold already excludes it.** The strip renders only when at least one notebook exists,
  and the preview writes nothing to storage, so there is never a notebook for it to show.

**The preview therefore stays byte-identical to what ships today** - the same five demo notes in the
same five colours through the same card component. That is not a happy accident; it is the property
that makes the preview claim provable in NB.3 rather than merely likely.

### Visual

A chip is a text pill carrying the notebook's name and its live note count. The active chip is
filled; the rest are outlined. **No stacked-paper illustration** - the previous draft's 2-3 peeking
note corners were sized for a left-column item in a full tab, and at chip scale in a 260px strip
they would be decoration nobody can resolve.

**Ink is declared, and it is verified by BROWSER MEASUREMENT rather than by the static gate.** The
chip strip is JS-rendered inside a panel whose surface darkens under `html.has-bg`, which puts it
exactly where `tools/check-panel-ink.mjs` cannot see it: the gate parses static `newtab.html`, so a
container filled at runtime presents it with zero text nodes and passes vacuously (BUGS.md **O1**).
So NB.3 measures the chip's ink in a real browser on **every ground the panel can render on** - no
wallpaper, image, dark solid and light solid - and not only the one it is being looked at on.

**Copy the ink from the node you sit next to.** The chips sit inside `.notes-panel`, which declares
its own ink to mirror `.tasks-tab`. A new rule in there that declares a colour of its own can
override the thing that is already correct - and on a light wallpaper that mistake paints white on
white. The neighbouring nodes in this panel are the reference, not a general has-bg recipe.

Every user-visible string goes through `t()` / `th()` and lives in `locales/en.js`:
`check-i18n-sites` is **ENFORCING**, and a hardcoded sentence in any shape it can see fails the
build.

### The word "notebook"

Checked across the tree for a collision, because the product has form here - "session" carries four
distinct senses and their collisions have cost rounds.

**"Notebook" is clean.** It appears in `DECISIONS.md`, `ROADMAP.md`, `trash-bin.md`,
`workspaces-data-model.md` and this file, and in all of them it means exactly one thing: a grouping
of notes. In code it appears only as `note.notebookId`, which is this same concept. It collides with
none of the four senses of "session", and nothing else in the product is called a notebook.

**The one collision that does exist is a NUMBER, not a word**, and it is recorded above: ROADMAP's
`v1.2.0` Notes-era release label against the `[1.2.0]` feature marker. Cosmetic, already known, and
the reason this spec never uses "v1.2.0" as a name.

---

## Notes touching other systems

- Universal trash bin (`docs/SPECS/trash-bin.md`): notes use the existing soft-delete + 30-day
  auto-purge lifecycle. **Registration is explicit, not automatic** - the sweep's entity list and
  its tag-id cascade are both hardcoded, and notes were absent from both until `[1.1.3]`.
- Tag system (existing): notes are taggable; tag rename/delete cascades to notes per existing tag system behavior
- Workspaces: notes and notebooks belong to a workspace; workspace switch shows the active workspace's content
- Tasks/Goals: promote-to-task and promote-to-goal integrate with existing creation modals; no new modals introduced
- Context menus (`background.js`): the clip entry joins the worker's menu rebuild and reads
  `isProAccessibleLevel` there, so entitlement is decided in one place rather than copied. The
  entry is **absent** on free and expired rather than disabled.
- **Quick-add (`[1.14.1]`) does NOT touch notes.** It parses a sentence into a TASK on the Tasks tab
  box and the Dashboard picker. Recorded here because the Notebooks plan describes quick-add as
  "feeding" notebooks and it does not - the only bridge between the two features is
  promote-to-task, which runs the other way.

---

## Out of scope (future considerations)

- Markdown rendering in note content (v1+)
- Note resizing (fixed-size cards in v1)
- Cross-workspace note copy/move
- Note sharing or export
- Free-form (non-grid) draggable corkboard view
- Markdown support
- Unified cross-tab trash view (Notes has its own trash icon for v1; future may unify)
