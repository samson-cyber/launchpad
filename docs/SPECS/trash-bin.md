# Spec: Trash Bin / Soft Delete System

Status: Draft (v1, 2026-04-24)
Owner: Samson
Related: `workspaces-data-model.md`, `pro-tab-architecture.md`

---

## What and Why

Unified soft-delete system for all user-created content: bookmarks, groups, goals, tasks, and tags. Instead of immediately removing an item, the system marks it with a `deletedAt` timestamp. Deleted items disappear from normal views but remain in a Trash Bin for 30 days, after which they are permanently removed by a daily auto-purge.

This addresses a class of user frustration the existing backup/export system doesn't solve. Backup/export protects against catastrophic loss ("my laptop died, I'm restoring"); Trash Bin protects against the far more common "oh shit I didn't mean to delete that" moment. A user who accidentally deletes a bookmark today shouldn't need to restore an entire JSON export from two weeks ago to get it back.

Trash Bin is a **free-tier feature**. Consistent with LaunchPad's "we respect your data" positioning, it sits alongside backup/export as a short-horizon recovery mechanism available to every user, not a paywalled safety net.

---

## Scope

### In scope

- Bookmarks
- Groups (as a unit — see Cascade Behavior)
- Goals (Pro feature; trash logic applies uniformly, restore requires active Pro after downgrade)
- Tasks (Pro, same downgrade rules as goals)
- Tags (Pro, same downgrade rules)

### Out of scope

- Workspaces (handled separately via disable-preserves-data — see `workspaces-data-model.md`)
- Settings (cannot be deleted)
- Wallpapers (managed separately in Settings)
- Session snapshots (managed by session restore system)

---

## Data Model

Every user-created entity gains a nullable `deletedAt` field:

```json
{
  "id": "abc123",
  "title": "...",
  "url": "...",
  "addedAt": 1772414162035,
  "deletedAt": null
}
```

- When deleted: `deletedAt = Date.now()`
- When restored: `deletedAt = null`
- When auto-purged: entity is removed from its parent array entirely

The `deletedAt` field is added by the `Foundation: Storage schema migration to workspace-aware shape` task. All existing items receive `deletedAt: null` during migration.

### Filter semantics

Normal views filter out any item where `deletedAt !== null`. The Trash view filters to items where `deletedAt !== null`.

No separate trash storage structure — items remain in their original parent arrays, just with a non-null `deletedAt`. This simplifies restore (no need to re-home the item) and keeps the data model flat.

### Tag associations on deletion

When a tag is deleted, its own `deletedAt` is set. Items that were tagged with it retain the tag ID in their `tagIds` array. Tag picker and filters exclude trashed tags, so the dimmed-but-present association shows as an "archived tag" badge on the item detail view. If the tag is restored within 30 days, everything snaps back. If the tag auto-purges at day 30, the tag ID is cleaned up from all items' `tagIds` arrays at that moment as part of the same batch sweep.

---

## Deletion Flow

User deletes an item (via right-click menu, delete button, or keyboard shortcut). System:

1. Sets `deletedAt = Date.now()` on the item.
2. Writes the updated state to `chrome.storage.local`.
3. Re-renders the view (item disappears from normal views).
4. Shows a brief toast: "Deleted. Restore from Trash within 30 days." with an Undo link that reverses step 1 if clicked within ~5 seconds.

No confirmation modal on regular delete — the toast plus trash bin is the safety net. Confirmation modals appear only for permanent deletion from the trash.

---

## Trash View UX

### Entry point

An icon adjacent to the Settings cog in the sidebar. When trash contains items, a small badge shows the count. When empty, the icon is slightly dimmed.

Clicking the icon opens the Trash View as a panel (same frosted glass aesthetic as other panels: `backdrop-filter: blur(12px); background: rgba(30,30,30,0.85)`).

### Layout

- **Header**: "Trash" title, total count ("12 items"), "Empty Trash" button (right-aligned, with confirmation)
- **Filter tabs**: All / Bookmarks / Groups / Goals / Tasks / Tags, with counts per tab
- **Search bar**: matches item names across types
- **Item list**: default sort is deletion date, newest first

### Item row

- Type icon (left, 16px)
- Item name (bold)
- Parent context (e.g., "in group Work" or "in goal Ship Pro v1") as secondary text
- Deletion date, relative ("2 days ago")
- "X days remaining" countdown — subtle color shift (neutral → amber → red) as it approaches zero
- Actions visible on hover: Restore, Delete Permanently

### Bulk actions

- Checkbox selection per item
- Selecting items reveals a bulk action bar: "X selected", Restore Selected, Delete Permanently Selected
- "Select All" at top of current filter view

### Empty state

Centered message: "Nothing in the trash. Deleted items will appear here for 30 days before being permanently removed."

---

## Restore Flow

### Single-item restore

- **Bookmark**: if its parent group still exists (not trashed, not purged), returns to its original group at its original position (or end if position is ambiguous). If the parent group is trashed or purged, the bookmark returns to "ungrouped" in the current workspace.
- **Group**: the group plus all bookmarks trashed with it as a unit are all restored together, returned to the group's original position in `groupOrder`.
- **Goal**: returns to the goals list. Its tasks (if trashed separately) remain trashed unless individually restored.
- **Task**: if parent goal still exists, task returns under that goal. If parent goal is trashed or purged, task becomes a standalone task in the current workspace.
- **Tag**: reappears in the tag picker; dimmed badges on tagged items become normal tag badges again.

### Partial restore from a trashed group

Drilling into a trashed group in the Trash view shows its bookmarks. Individual bookmarks can be restored without restoring the whole group. These orphaned restores go to "ungrouped" in the current workspace (user can drag them elsewhere afterward).

### Bulk restore

All selected items are restored one by one using the single-item logic above. Any items whose restore target no longer exists go to their respective fallback locations ("ungrouped", standalone task, etc.).

---

## Cascade Behavior

### Group deletion

When a user deletes a group, the entire group is trashed as a unit. A single trash entry represents the group and contains references to all its bookmarks. The bookmarks themselves get `deletedAt` set to match the group's deletion time.

**Exception:** a bookmark that was individually trashed *before* the group was trashed stays as its own separate trash entry. It does not get "absorbed" into the group's trash entry. This preserves individual deletion context.

### Bookmark deletion

Individual bookmarks are trashed individually — simple case, no cascade.

### Tag deletion

See "Tag associations on deletion" above. Associations on items preserved until restore or purge.

### Nested items (variants)

LaunchPad bookmarks support nested variants (the "parent shortcut with children" pattern). When a parent shortcut with variants is deleted, the whole parent + variants unit is trashed together. On restore, everything comes back intact.

---

## Auto-Purge

### Timing

`chrome.alarms` fires a daily sweep at approximately 03:00 local time. The alarm is created on extension install and persists across service-worker suspensions.

### Sweep logic

```
for each workspace in data.workspaces:
  for each collection (groups, bookmarks inside groups, goals, tasks, tags):
    remove any item where deletedAt !== null and (now - deletedAt) > 30 days
for any tags removed in this sweep:
  remove the tag's ID from all items' tagIds arrays
log purge count for debug console
```

Single alarm, single function. No per-item timers.

### Opportunistic cleanup

When the user opens the Trash View, the same sweep logic runs on the current data before rendering. This handles the edge case where Chrome was closed for a week and the alarm didn't fire — the user shouldn't see items that should have been purged.

### Quota implications

Realistic worst case: user imports 500 Chrome bookmarks and deletes 400 at once. 400 bookmarks × ~200 bytes = ~80 KB. Add groups, goals, tasks, tags and the absolute ceiling is ~250 KB held in trash at once. Negligible against the 10 MB `chrome.storage.local` quota (and the planned `unlimitedStorage` permission for tracking data).

---

## Pro Downgrade Interaction

When a Pro user downgrades to free, trashed Pro-only entities (goals, tasks, tags) remain in the Trash view but are:

- Visually greyed
- Show "Upgrade to restore" instead of a Restore button
- Still subject to 30-day auto-purge (items do not persist forever)

If the user reactivates Pro within 30 days, they can restore these items normally. After 30 days, auto-purge removes them permanently.

This matches the broader "no data deletion on downgrade" policy: the user's trashed data isn't destroyed by the downgrade itself, but the normal purge timer continues to run.

---

## Dependencies

- `Foundation: Storage schema migration to workspace-aware shape` (GID `1214257243702923`) — adds the `deletedAt` field to all user-created entities. Must land first.
- Any existing delete handler in the codebase — needs to be updated to set `deletedAt` instead of splicing from the parent array. Small wiring change, covered by a dedicated task.

---

## Implementation tasks (to be created in Backlog when spec is picked up)

Anticipated tasks, likely in Polish area:

1. **Polish: Soft-delete wiring for existing delete actions** — update bookmark/group/goal/task delete handlers to set `deletedAt` rather than splice. Small, pure-logic change.
2. **Polish: Trash view panel + sidebar icon** — icon placement, panel layout, filter tabs, search, item rendering.
3. **Polish: Restore flow** — single-item restore, partial restore from trashed group, bulk restore.
4. **Polish: Auto-purge sweep** — `chrome.alarms` daily sweep + opportunistic cleanup on trash view open.
5. **Polish: Delete confirmation UX** — toast with 5-second Undo for regular delete, confirmation modal for permanent delete from trash.

These will be created when the spec is officially picked up for implementation (likely after Foundation completes).

---

## Acceptance Criteria

- User deletes a bookmark: it disappears from the grid, appears in Trash with a 30-day countdown. Toast shows with 5-second Undo link.
- Within 5 seconds of delete, Undo restores the bookmark exactly where it was.
- Trash view opens via sidebar icon. Filter tabs work. Search matches names. Item rows show correct parent context and countdown.
- Restore places items back in correct original location (or fallback location for orphans).
- Bulk restore and bulk permanent delete both work from multi-select.
- 30-day auto-purge removes items (verifiable by setting `deletedAt` to 31 days ago in `chrome.storage.local` and opening the trash view — opportunistic cleanup fires).
- Deleting a group sends group + bookmarks as a unit. Drilling into the group in trash shows bookmarks, which can be individually restored.
- Deleting a tag dims its badge on tagged items; restoring makes badges normal again; auto-purge at day 30 removes the tag ID from all items' `tagIds` arrays.
- Pro downgrade with Pro-only items in trash: items visible, greyed, "Upgrade to restore" shown; auto-purge continues running.
- Trash storage stays under 1 MB in realistic high-volume deletion scenarios.

---

## Open Questions

None blocking. Deferred considerations for future iterations:

1. Should there be a "Recently Restored" section to easily undo a mistaken restore? Probably not — restore is cheap to reverse (just delete again). YAGNI for v1.
2. Should we offer an export of trash contents before auto-purge as a final safety net? Deferred — probably yes, but can be a v1.1 enhancement if users ask.
3. Should Settings include a "Empty Trash on uninstall" preference? Deferred — privacy-aware users may want this, but not for v1.
