# Notes Feature - LaunchPad Pro

Status: **v1.1 SHIPPED.** Drafted 2026-05-15; reconciled to shipped reality 2026-08-30.

> **Read the reconciliation banner in the v1.1 section before trusting any interaction
> described here.** The May draft specced a full-tab, 2D drag-positioned feature. Samson
> redirected the design on 2026-08-29 after seeing the first render, and most interaction
> details changed. The v1.2 Notebooks section below is still unbuilt design intent and has
> NOT been re-specced against what v1.1 actually shipped.
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
- v1.2.0 - Notebooks (organizational layer on top, designed in this spec but built later). **Unbuilt**,
  and its layout assumptions predate the v1.1 redirect.

## Workspace scoping

Notes are workspace-scoped. Each workspace has its own notes and (in v1.2) notebooks. Switching workspaces shows the active workspace's notes. The data model lives inside the workspace shape:

```
workspace = {
  ...existing fields...,
  notes: [Note],
  notebooks: [Notebook]  // v1.2 only
}
```

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
  notebookId: string | null,  // null for v1.1 (always standalone); v1.2 would introduce association
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

## v1.2 - Notebooks

### Layout change

The Notes tab area splits into two columns:
- Left 1/5: notebook column - vertical list of notebooks + a persistent "Standalone Notes" item at top + a "+" empty drop target at the bottom for drag-to-create-notebook
- Right 4/5: content area - swaps between standalone notes grid (default) and a notebook's contents (when a notebook is selected)

The "Standalone Notes" item at the top of the left column is always visible, always clickable, and returns the right pane to the standalone grid when clicked. Acts as the "home" of the Notes tab.

**Superseded 2026-08-30:** this assumed notes carry live `{x, y}` positions. They do not - v1.1
ships canonical array order and `position` is dormant (see the v1.1 data model). There is nothing
to clamp. A Notebooks design must decide ordering within a notebook from scratch, and should also
account for the fact that notes live in a 20% panel of the Tasks tab rather than a full tab area,
which is the larger unre-specced assumption in this whole section.

### Notebook data model

```
notebook = {
  id: string (stable unique),
  name: string,
  position: number,  // position in the left column list
  createdAt: number,  // epoch ms (Date.now())
  updatedAt: number,  // epoch ms (Date.now())
  deletedAt: number | null  // epoch ms when trashed, per trash-bin.md; null when live
}
```

A note's optional `notebookId` field associates it with a notebook. Notes without `notebookId` are standalone.

### Notebook interactions

- Click "Create notebook" button or the empty "+" target - creates a new notebook with default name "New notebook" (inline rename available)
- Drag standalone note onto the "+" empty target - creates a new notebook containing that note
- Drag standalone note onto an existing notebook in the left column - adds the note to that notebook
- Right-click on a standalone note - "Move to notebook" menu - lists existing notebooks for selection (alternative to drag)
- Click a notebook in the left column - right pane swaps to show that notebook's contents (a grid of just the notes in this notebook). The notebook is highlighted in the left column to indicate selection.
- While in notebook view: drag a note out onto the "Standalone Notes" item in the left column - the note leaves the notebook and rejoins standalone (position appended to standalone grid)
- Create new notes directly inside a notebook view (they're added with `notebookId` set to the active notebook)

### Notebook visual

Each notebook icon in the left column shows a small stack visual - 2-3 paper notes peeking out underneath the top note, evoking a physical stack. The notebook's name appears below the visual. Selected notebook is highlighted.

### Notebook deletion

Right-click notebook - "Delete" opens a confirmation modal with two options:
- "Move notes to standalone, delete notebook" (default) - notebook is soft-deleted; its notes are pushed back to the standalone grid (positions are lost; notes are appended at the end of the standalone grid)
- "Delete notebook and all notes" - notebook and all child notes are soft-deleted together. In trash view, they appear as a single notebook unit; restoring the notebook restores all child notes inside it.

A notebook can also be dragged onto the trash can - same flow with the same modal.

### Promote actions from inside a notebook

Promote-to-task and Promote-to-goal work the same from inside notebook view as from standalone view. The note's `notebookId` is preserved or cleared based on whether the user chose "and delete" (which clears it via soft-delete).

---

## Notes touching other systems

- Universal trash bin (`docs/SPECS/trash-bin.md`): notes use the existing soft-delete + 30-day
  auto-purge lifecycle. **Registration is explicit, not automatic** - the sweep's entity list and
  its tag-id cascade are both hardcoded, and notes were absent from both until `[1.1.3]`.
- Tag system (existing): notes are taggable; tag rename/delete cascades to notes per existing tag system behavior
- Workspaces: notes and notebooks belong to a workspace; workspace switch shows the active workspace's content
- Tasks/Goals: promote-to-task and promote-to-goal integrate with existing creation modals; no new modals introduced

---

## Out of scope (future considerations)

- Markdown rendering in note content (v1+)
- Note resizing (fixed-size cards in v1)
- Cross-workspace note copy/move
- Note sharing or export
- Free-form (non-grid) draggable corkboard view
- Markdown support
- Unified cross-tab trash view (Notes has its own trash icon for v1; future may unify)
