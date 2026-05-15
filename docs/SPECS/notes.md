# Notes Feature - LaunchPad Pro

Status: Draft (v1, 2026-05-15)
Owner: Samson
Related: `workspaces-data-model.md`, `trash-bin.md`, `tasks-and-goals.md`, `pro-tab-architecture.md`

---

## Purpose

Quick capture of thoughts, meeting notes, and reminders inside LaunchPad. Solves the "scattered text files across my system" problem by giving users a dedicated, visible, capture-first surface inside the new-tab experience. Sticky-note aesthetic chosen for instant recognizability and warm, low-pressure capture vibes.

## Tier

Pro-only feature. Free users see a greyed-out Notes tab in the tab bar. Clicking opens Preview Mode with hardcoded demo content (non-interactive) and the standard pulsing upgrade CTA.

## Release plan

- v1.1.0 - Standalone notes (this spec covers it in full)
- v1.2.0 - Notebooks (organizational layer on top, designed in this spec but built later)

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

Design intent: a user opening the Notes tab should recognize "these are sticky notes" within 2 seconds, evoking the physical desk metaphor. Visual cues:

- Paper-textured background using CSS-only noise/grain (no image assets - keep extension light)
- Slight fixed rotation per note (-2 to +2 degrees, assigned at creation time and stored)
- Soft layered drop shadow (1-2 layers for depth)
- Slight curl effect at one corner using CSS pseudo-element
- Paper color palette (initial set, may iterate): cream, butter-yellow, soft-pink, mint, sky-blue, peach, lavender
- Hover state: subtle scale-up + shadow lift (very subtle, not a "click me" bounce)

The visual style is owned in CSS, no JS dependency. Note that this aesthetic ages with the rest of the UI - acceptable trade-off for personality and brand identity.

---

## v1.1 - Standalone notes

### Layout

The Notes tab takes the full content area (same as Tasks/Dashboard/Insights). Standalone notes appear in a draggable grid filling the tab. v1.2 will split this area into a left notebook column (1/5) and right content area (4/5); v1.1 ships as full-grid.

### Note data model

```
note = {
  id: string (stable unique),
  content: string (plain text for v1; markdown is a future consideration),
  color: string (palette key: 'cream' | 'butter-yellow' | 'soft-pink' | 'mint' | 'sky-blue' | 'peach' | 'lavender'),
  position: { x: number, y: number },  // grid coordinates
  rotation: number,  // -2 to +2 degrees, assigned at creation
  notebookId: string | null,  // null for v1.1 (always standalone); v1.2 introduces optional notebook association
  tags: [string],  // tag ids, integrates with existing tag system
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp,
  deletedAt: ISO timestamp | null  // for soft-delete, matches universal trash-bin pattern
}
```

### Interactions

- Create note: '+' button in tab header, or click empty grid area
- Inline editing: click note to enter edit mode, click outside or press Esc to save
- Drag positioning: notes are absolutely positioned, drag updates {x,y} with light 8-12px grid snap on drop. Position persists immediately to storage.
- Right-click menu on a note: Change color, Add/remove tags, Promote to task, Promote to goal, Delete
- Search/filter bar at top of tab: real-time text search on content + tag chip filter (AND logic)
- Color picker: palette swatch grid accessible via right-click menu or color indicator on the note itself

### Promote-to-task

Right-click note - "Promote to task" opens the existing task creation modal with note content pre-filled (first ~80 chars - task name, full content - description). User picks target goal or "Standalone" from existing dropdown. On confirm, task is created; note remains untouched (promote = copy, not move). Secondary menu option "Promote and delete note" does the same but soft-deletes the note after task creation.

### Promote-to-goal

Right-click note - "Promote to goal" opens the existing goal creation modal with note content as the goal description. User can edit the goal name (defaults to first line of note). On confirm, goal is created; note remains unless "and delete" selected.

### Trash can UI

A persistent trash can icon lives in the bottom-right corner of the Notes tab. Aesthetic matches the sticky-note paper-and-pen theme. A small badge shows the count of trashed notes when non-zero.

Interactions:
- Drag a note onto the trash can - soft-delete (sets deletedAt, removes from grid). Trash can shows visual response on hover (opens or highlights).
- Right-click menu "Delete" - same outcome.
- Click trash can icon - opens a trash view (modal or in-tab overlay) showing all trashed notes for this workspace. Each item shows: content preview (~3 lines), days until permanent deletion, Restore button, Delete Permanently button. An "Empty Trash" button purges all trashed notes immediately, with a confirmation.

30-day auto-purge is handled by the universal trash-bin lifecycle per `docs/SPECS/trash-bin.md`. The Notes trash can is just the visual surface for the Notes portion of that bin.

### Free user Preview Mode

When a free user clicks the Notes tab, they see a hardcoded demo with 6-8 sticky notes in a sample layout. Notes are non-interactive (no create, drag, edit, delete). The pulsing upgrade CTA per [1.0.5] is visible. Demo content should feel relatable (e.g., grocery items, meeting reminders, recipe ideas) but contain no real-looking PII.

### Empty states

- No notes exist: soft empty state with "Drop your first note here" (or click to create) copy
- All notes filtered out: "No notes match this filter" with a clear-filter action

---

## v1.2 - Notebooks

### Layout change

The Notes tab area splits into two columns:
- Left 1/5: notebook column - vertical list of notebooks + a persistent "Standalone Notes" item at top + a "+" empty drop target at the bottom for drag-to-create-notebook
- Right 4/5: content area - swaps between standalone notes grid (default) and a notebook's contents (when a notebook is selected)

The "Standalone Notes" item at the top of the left column is always visible, always clickable, and returns the right pane to the standalone grid when clicked. Acts as the "home" of the Notes tab.

### Notebook data model

```
notebook = {
  id: string (stable unique),
  name: string,
  position: number,  // position in the left column list
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp,
  deletedAt: ISO timestamp | null
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

- Universal trash bin (`docs/SPECS/trash-bin.md`): notes and notebooks use the existing soft-delete + 30-day auto-purge lifecycle
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
