# Spec: Workspaces — Data Model and UI

Status: Draft (v2, 2026-04-24)
Owner: Samson
Related: `pro-value-proposition.md`, `pro-tab-architecture.md`

v2 note: This spec was reframed mid-scoping-session from a fixed two-workspace (Work + Personal) design to a generic N-workspace user-managed model. See DECISIONS.md entry "Workspaces as generic user-managed containers (reframe)" for context. v1 of this file assumed Work/Personal defaults; v2 generalizes.

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
      "tracking": { ... }
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

Location: Top-left of header strip, before the LaunchPad logo.

States:

- **Free user:** Switcher not visible. The single workspace displays as LaunchPad's main view; the user doesn't see or need to think about the workspace concept.
- **Pro user with 1 workspace:** Switcher visible showing workspace name + chevron. Dropdown shows current workspace + "Add workspace" entry at bottom.
- **Pro user with 2+ workspaces:** Switcher shows active workspace name + chevron. Dropdown lists all workspaces with checkmark on active, plus "Add workspace" at bottom. Keyboard shortcuts Ctrl+1..9 jump to workspaces 1-9.
- **Pro → free downgrade with N workspaces:** Switcher remains visible and usable. First workspace is fully editable; others are read-only with a small lock icon next to their name in the dropdown and in the header when active.

Animation on switch:
- 150ms fade-out of current grid
- Swap `activeWorkspaceId`
- 150ms fade-in of new grid
- Sidebar also updates to show new workspace's groups

Deferred: visual distinction between workspaces (per-workspace wallpaper or color tint). Data model supports it via per-workspace `settings` field if needed later; not in v1.

---

## Managing Workspaces (Pro Settings)

The Workspaces section of Pro Settings lists all workspaces with these controls:

- **Drag handle** — reorder via drag, updates `workspaceOrder`
- **Inline rename** — click name, type, Enter to save
- **Delete button** — per-workspace; shows confirmation modal "Delete [name]? Data moves to trash and auto-purges in 30 days." Respects the trash-bin system.
- **"Add workspace" button** — at bottom of list. Opens small dialog: name input + "Create" button. Creates an empty workspace, adds to `workspaces` array, adds id to `workspaceOrder`, switches `activeWorkspaceId` to the new workspace.

Edge cases:
- User cannot delete their last remaining workspace (delete button hidden or disabled with tooltip "You need at least one workspace").
- Deleting the active workspace switches active to the next workspace in order.
- Read-only workspaces (downgrade state) cannot be renamed or reordered; delete is still permitted.

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
