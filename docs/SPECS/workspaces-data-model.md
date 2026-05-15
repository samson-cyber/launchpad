# Spec: Workspaces — Data Model and UI

Status: Draft (v2, 2026-04-24)
Owner: Samson
Related: `pro-value-proposition.md`, `pro-tab-architecture.md`

v2 note: This spec was reframed mid-scoping-session from a fixed two-workspace (Work + Personal) design to a generic N-workspace user-managed model. See DECISIONS.md entry "Workspaces as generic user-managed containers (reframe)" for context. v1 of this file assumed Work/Personal defaults; v2 generalizes.

> Updated 2026-04-26 ([1.0.6]): Workspace switcher placement is now sidebar-top (above the History entry), not the header strip — the [1.0.2] decision dropped the header strip from v1, and sidebar placement matches workspaces' role as a navigation primitive. Keyboard shortcuts (Ctrl+1..9) are dropped per the same [1.0.2] decision (Chrome reserves Ctrl+1..8 for browser tabs). The "Workspace Switcher UI" and "Managing Workspaces" sections were rewritten to reflect the implementation. Workspace deletion is hard-delete via window.confirm in v1, not a soft-delete via the trash-bin system — see the trash-bin coupling sub-section. See DECISIONS.md entry "Workspace switcher placement: sidebar top" for the placement rationale.

---

## What and Why

Workspaces are user-managed containers of bookmarks, groups, goals, tasks, tags, and tracking data. Each workspace represents a context the user wants to keep isolated — a client, a job, a side project, work vs personal life, etc. All workspaces have identical feature sets; the user chooses what each one means.

Free users get exactly 1 workspace, default name "Main", renameable. Pro users can create unlimited workspaces.

The portfolio-worker persona drives this design: a freelancer with 3 active clients wants "Acme Corp," "Beta LLC," and "Personal" as separate contexts, not "Work" and "Personal." The reframe from fixed Work/Personal to generic N-workspaces makes Pro substantially more compelling for that persona while being a simpler mental model overall.

---

## Data Model

Storage key: `"data"` (unchanged — backward compatible).

Old shape (free, pre-Pro):

```json
{
  "groupOrder": ["ungrouped", "mma9emcf0dgqt"],
  "groups": [ ... ],
  "settings": { ... }
}
```

New shape (Pro-capable):

```json
{
  "workspaces": [
    {
      "id": "main",
      "name": "Main",
      "createdAt": 1772600000000,
      "isReadOnly": false,
      "groupOrder": ["ungrouped", "mma9emcf0dgqt"],
      "groups": [ ... ],
      "goals": [],
      "tasks": [],
      "tags": [],
      "tracking": { ... },
      "notes": [],         // Notes feature (v1.1.0)
      "notebooks": []      // Notebooks feature (v1.2.0)
    }
  ],
  "workspaceOrder": ["main"],
  "activeWorkspaceId": "main",
  "settings": {
    "collapsedGroups": {},
    "columns": 6,
    "iconSize": "medium",
    "theme": "system",
    "combinedAnalyticsEnabled": false
  },
  "pro": {
    "licenseKey": null,
    "trialStartedAt": null,
    "trialEndedAt": null,
    "subscriptionStatus": "free",
    "lastVerifiedAt": null
  }
}
```

Key choices:

- **`workspaces` is an array, not a keyed object.** Ordering via `workspaceOrder`. Adding a workspace pushes to the array.
- **`activeWorkspaceId` persists across new-tab opens.** Workspace is the user's current context, not a transient view state. (Home tab reset behavior is separate — see `pro-tab-architecture.md`.)
- **`goals`, `tasks`, `tags`, `tracking` live per-workspace.** Not global.
- **`isReadOnly` flag per workspace.** Set to true for non-first workspaces after a Pro → free downgrade. UI disables editing actions on read-only workspaces.
- **`settings` stays global.** Column count, icon size, theme are user preferences. `combinedAnalyticsEnabled` toggles a "show time across all workspaces" view in Dashboard.
- **`pro` block tracks license state.** See `billing-and-license.md`.
- **Notes and notebooks live per-workspace.** Notes ship in v1.1.0; notebooks ship in v1.2.0.

---

## Migration: Free → Pro-capable shape

**Timing:** Runs once, on first new-tab load after the Pro update ships.

Pseudo-code:

```
migrate(data):
  if data.workspaces exists:
    return data  # already migrated

  newData = {
    workspaces: [
      {
        id: "main",
        name: "Main",
        createdAt: now(),
        isReadOnly: false,
        groupOrder: data.groupOrder || [],
        groups: data.groups || [],
        goals: [],
        tasks: [],
        tags: [],
        tracking: emptyTrackingState()
      }
    ],
    workspaceOrder: ["main"],
    activeWorkspaceId: "main",
    settings: {
      ...data.settings,
      combinedAnalyticsEnabled: false
    },
    pro: {
      licenseKey: null,
      trialStartedAt: null,
      trialEndedAt: null,
      subscriptionStatus: "free",
      lastVerifiedAt: null
    }
  }

  # Backup original before writing
  chrome.storage.local.set({ "data_pre_migration_backup": data })
  chrome.storage.local.set({ "data": newData })
  return newData
```

All existing items receive `deletedAt: null` during migration (per trash-bin.md).

**Recovery:** `data_pre_migration_backup` key persists. If migration produces wrong output, user can restore via debug console or a "Restore from pre-migration backup" button in Settings.

---

## Workspace Switcher UI

Location: Sidebar top, above the existing History entry. Hidden entirely
for free / expired users; visible for trialing / active / grace.

Two visual modes mirror the sidebar's collapsed / expanded states:

- **Collapsed (sidebar 48px wide):** A 28×28 circular chip showing the
  active workspace's first letter (uppercase) on a deterministic palette
  color derived from the workspace's index in `workspaceOrder` (8-color
  rotation).
- **Expanded (sidebar 260px wide):** Chip + workspace name + chevron.

If the active workspace has `isReadOnly === true`, a small lock badge
overlays the chip in both modes.

Click handler: locks the sidebar expanded (`sidebarLocked = true`),
opens a frosted-glass dropdown anchored below the switcher widget via
`getBoundingClientRect()` (position: fixed). Dropdown contents:

- One row per workspace in `workspaceOrder` order: chip + name +
  checkmark on the active row + lock badge if `isReadOnly`
- Divider
- "Add workspace" entry that, when clicked, replaces itself inline with
  an input + Create button (no separate dialog)

Close: click outside (capture-phase), Escape, or selection of a row.
Closing releases the sidebar lock; mouseleave then collapses the
sidebar via existing handlers.

No keyboard shortcuts. Ctrl+1..8 conflicts with Chrome's reserved tab
shortcuts; revisit only if user feedback requests it.

Animation on switch:
- 150ms fade-out of `#tab-home` grid (CSS `is-swapping` class)
- Swap `activeWorkspaceId`, persist via `Storage.saveAll`
- Re-render grid + sidebar groups
- Fade-in via `requestAnimationFrame` removing `is-swapping`

Sidebar group list re-renders synchronously inside `render()`; only
the grid fade is animated.

Deferred: visual distinction between workspaces (per-workspace
wallpaper or color tint). Data model supports it via per-workspace
`settings` field if needed later; not in v1.

### Read-only banner on the grid

When `activeWorkspace.isReadOnly === true`, a thin banner renders above
the shortcut grid: "This workspace is read-only. Upgrade to Pro to
edit." with a trailing "Upgrade" link that opens the same upgrade
popover from [1.0.5] anchored to the link. Edit affordances are gated:
`#sb-add-group` and `.add-tile` placeholders hide via a body-class
toggle (`workspace-readonly`); the shortcut context menu suppresses
itself entirely; SortableJS instances on the grid and sidebar group
list are constructed with `disabled: true`.

---

## Managing Workspaces (Pro Settings)

The Workspaces section of Pro Settings lists all workspaces with these controls:

- **Drag handle** (☰) — reorder via SortableJS, updates `workspaceOrder`. Disabled cursor on read-only rows.
- **Colored chip** — same palette + first-letter treatment as the sidebar switcher.
- **Inline rename** — click the name span, an input replaces it, Enter or blur commits, Escape restores. Empty input restores the original name (no save).
- **Delete button** (×) — per-row. Confirms via `window.confirm` (hard delete in v1; see trash-bin coupling below). Disabled when only one workspace remains, with a tooltip "You need at least one workspace."
- **Add workspace row** — input + Add button at the bottom of the list, separate from the dropdown's add affordance. Both call the same `createWorkspace` internally.

Edge cases:
- User cannot delete their last remaining workspace (delete button visibly disabled, JS guard double-checks).
- Deleting the active workspace switches `activeWorkspaceId` to `workspaceOrder[0]`.
- Read-only workspaces (downgrade state) cannot be renamed or reordered; delete is still permitted (so users can clean up after downgrade).

### Trash-bin coupling

Workspace deletion in v1 is a hard delete via `window.confirm`, not a
soft delete via the universal trash-bin system. Reasoning: the trash-
bin spec (`trash-bin.md`) explicitly excludes workspaces from its
scope, and adding workspace-level soft-delete semantics (tombstoning
30 days of bookmarks / groups / goals / tasks / tags as a single
restorable unit) is a meaningfully larger design problem than item-
level trash. If user feedback shows accidental workspace deletes are a
real failure mode, revisit by either bringing workspaces under the
trash-bin or adding a workspace-specific recovery affordance.

---

## Pro → Free Downgrade Behavior

When subscription lapses (after 7-day offline grace):

- `pro.subscriptionStatus = "free"`
- First workspace in `workspaceOrder` remains fully editable. `isReadOnly = false` on workspace[0]; all others get `isReadOnly = true`.
- If `activeWorkspaceId` was a read-only workspace at downgrade, `activeWorkspaceId` is NOT forcibly switched. User can view the read-only workspace's data; the UI displays a banner "This workspace is read-only. Upgrade to Pro to edit." with editing controls disabled.
- "Add workspace" button hides or shows "Upgrade to add more workspaces" tooltip.
- Pro tabs (Tasks, Dashboard, Insights) grey out as normal.

Re-upgrading restores `isReadOnly = false` across all workspaces, immediately.

Explicitly: NO data deletion on downgrade. See DECISIONS.md entry on cancellation policy.

---

## Data Size Implications

Per-workspace sizing estimates:

- Groups + shortcuts: ~5 KB typical, ~50 KB heavy user
- Goals + tasks: ~1 KB typical, ~10 KB heavy
- Tags: negligible (<1 KB)
- Tracking (per workspace, 30 days rolling): ~10 MB granular or ~2 MB aggregated depending on rollup policy — see tracking spec

Heavy portfolio-worker user with 5 active workspaces: ~50 MB. Requires `unlimitedStorage` permission (planned for tracking anyway).

---

## Open Questions

1. Should we cap the number of workspaces at some reasonable upper bound (e.g., 20)? Probably no hard cap, but worth adding a soft warning at 10+ if UI starts to feel cluttered. Revisit if users report issues.
2. Do workspace wallpapers differ from the global wallpaper? Deferred to Experience area.
3. Workspace ID collisions when importing from another user's exported data — should we generate fresh IDs on import? Probably yes. Spec for backup/restore.

---

## Dependencies

- Migration must land before any Pro feature that writes new fields
- Tab architecture spec confirms switcher placement in header strip
- License verification spec provides `pro.*` field semantics
- Trash bin spec relies on `deletedAt` field added during migration

---

## Acceptance Criteria (for implementation tasks)

- Free user on existing `data` shape sees no change in behavior after Pro update ships — grid renders identically, all bookmarks preserved
- `data_pre_migration_backup` present in chrome.storage after migration
- Pro user can create a workspace from Pro Settings; new workspace appears in switcher, switchable, empty grid renders cleanly
- Pro user can rename, reorder (drag), and delete workspaces
- Switching workspace re-renders grid + sidebar in <300ms
- `activeWorkspaceId` persists across new-tab opens
- Deleting a workspace sends it to trash (per trash-bin.md) — auto-purge after 30 days
- Pro → free downgrade: first workspace stays editable, all others become read-only with lock icon; user can still view but not edit
- Pro re-upgrade restores editability across all workspaces
- Last remaining workspace cannot be deleted
