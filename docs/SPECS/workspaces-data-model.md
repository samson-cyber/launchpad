# Spec: Workspaces — Data Model and UI

Status: Draft (v1, 2026-04-24)
Owner: Samson
Related: `pro-value-proposition.md`, `pro-tab-architecture.md`

---

## What and Why

Pro users get two workspaces: Work and Personal. A workspace is a named
container of shortcuts, groups, goals, tasks, tags, and tracking data.
Switching workspaces instantly swaps the visible new-tab content to that
workspace's state.

The goal is context isolation: when Samson starts his workday, he switches
to Work and his Shopify, Amazon, and Outlook Growve shortcuts appear along
with today's work goals. After hours he switches to Personal and sees
YouTube, Instagram, and personal email — with separate tracking if he's
opted in.

Free users only have one workspace (implicit, unnamed). Pro unlocks the
second workspace. v2 may allow custom named workspaces beyond the two.

---

## Data Model (extensible from day one)

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
      "id": "work",
      "name": "Work",
      "createdAt": 1772600000000,
      "groupOrder": ["ungrouped", "mma9emcf0dgqt"],
      "groups": [ ... ],
      "goals": [],
      "tasks": [],
      "tags": [],
      "tracking": { ... }
    },
    {
      "id": "personal",
      "name": "Personal",
      "createdAt": 1772600000001,
      "groupOrder": [],
      "groups": [],
      "goals": [],
      "tasks": [],
      "tags": [],
      "tracking": { ... }
    }
  ],
  "workspaceOrder": ["work", "personal"],
  "activeWorkspaceId": "work",
  "settings": {
    "collapsedGroups": {},
    "columns": 6,
    "iconSize": "medium",
    "theme": "system",
    "personalWorkspaceEnabled": false,
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

- **`workspaces` is an array, not a keyed object.** v2 adds custom
  workspaces by pushing to the array. Zero migration.
- **`workspaceOrder` is separate from the workspaces array.** Lets users
  reorder without rewriting the whole array.
- **`activeWorkspaceId` is global.** Switching workspaces changes this,
  triggers a re-render of the grid.
- **`goals`, `tasks`, `tags`, `tracking` live per-workspace.** Not global.
  A "Learn Rust" goal in Personal doesn't leak into Work.
- **`settings` stays global.** Column count, icon size, theme are user
  preferences, not workspace preferences. `personalWorkspaceEnabled` is
  here because it's a global on/off for whether the second workspace
  exists at all.
- **`pro` block is new.** Tracks license state, trial state, last
  verification. See `billing-and-license.md` spec.

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
        id: "work",
        name: "Work",
        createdAt: now(),
        groupOrder: data.groupOrder || [],
        groups: data.groups || [],
        goals: [],
        tasks: [],
        tags: [],
        tracking: emptyTrackingState()
      }
    ],
    workspaceOrder: ["work"],
    activeWorkspaceId: "work",
    settings: {
      ...data.settings,
      personalWorkspaceEnabled: false,
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

Personal workspace is NOT created at migration. It's created lazily when
the user enables it in settings (Pro only).

**Recovery:** `data_pre_migration_backup` key persists. If migration
produces wrong output, user can restore via debug console or a future
"Restore from pre-migration backup" button in settings.

---

## Workspace Switcher UI

Location: Top-left of tab bar, next to the LaunchPad logo. Small dropdown
button showing the active workspace name with a chevron.

States:

- **Free user:** Switcher not visible at all. The UI shows the single
  workspace as if it were LaunchPad's main view (no framing as "Work").
- **Pro, Personal disabled:** Switcher visible but disabled (greyed), with
  tooltip "Enable Personal workspace in Pro Settings".
- **Pro, both enabled:** Switcher active. Dropdown lists Work and Personal
  with keyboard shortcuts (Ctrl+1, Ctrl+2). Selecting switches the active
  workspace and re-renders.

Animation on switch:

- 150ms fade-out of current grid
- Swap `activeWorkspaceId`
- 150ms fade-in of new grid
- Sidebar also updates to show new workspace's groups

Deferred: visual distinction between workspaces (Work vs Personal wallpaper
or color tint). Worth considering in Experience area but not blocking
Foundation.

---

## Enabling Personal Workspace

In Pro Settings panel:
- Toggle: "Enable Personal workspace"
- Off by default (see DECISIONS.md — marketing leads with Work, Personal
  is discovered)
- When toggled on:
  - Creates `personal` workspace entry with empty groups/goals/tasks
  - Adds "personal" to `workspaceOrder`
  - Switcher becomes active
  - Optional onboarding toast: "Personal workspace ready. Add bookmarks
    you use outside work."
- When toggled off:
  - Shows confirmation modal: "Hide Personal workspace? Your data stays
    saved — you can re-enable anytime."
  - On confirm: removes `personal` from `workspaceOrder` (but keeps the
    data in `workspaces` array)
  - If `activeWorkspaceId === "personal"`, switches to "work"
  - Switcher becomes disabled

This pattern means disabling is reversible with zero data loss.

---

## Pro → Free Downgrade Behavior

When subscription lapses (after 7-day offline grace):

- `pro.subscriptionStatus = "free"`
- Pro tabs (Tasks, Dashboard, Insights) grey out, become view-only
- Workspace switcher disables
- If user was in Personal workspace, switch active to Work
- Personal workspace data preserved (read-only access)
- Pro settings show "Reactivate" CTA with preserved data messaging

Explicitly: NO data deletion on downgrade. See DECISIONS.md entry on
cancellation policy.

---

## Data Size Implications

Per-workspace sizing estimates:

- Groups + shortcuts: ~5 KB typical, ~50 KB heavy user
- Goals + tasks: ~1 KB typical, ~10 KB heavy
- Tags: negligible (<1 KB)
- Tracking (per workspace, 30 days rolling): ~10 MB granular or ~2 MB
  aggregated depending on rollup policy — see tracking spec

Two active workspaces roughly doubles this. Well under the unlimited
storage target (once that permission is added — see tracking spec).

---

## Open Questions

1. Should workspace names be user-editable? (e.g., "Day Job" instead of
   "Work") — leaning yes, low cost, feels personalized. Add rename in
   Pro Settings.
2. Do workspace wallpapers differ? — deferred to Experience area; data
   model already supports via per-workspace `settings.wallpaper` if
   needed (not in current schema, add if/when spec confirms).
3. What happens to active task on workspace switch? — deferred to Tasks
   spec. Leaning: one global active task regardless of current workspace;
   switching workspace doesn't stop tracking.

---

## Dependencies

- Migration must land before any Pro feature that writes new fields
- Tab architecture spec must confirm switcher placement
- License verification spec provides `pro.*` field semantics

---

## Acceptance Criteria (for implementation tasks)

- Free user on existing `data` shape sees no change in behavior after
  update — grid renders identically, all bookmarks preserved
- `data_pre_migration_backup` present in chrome.storage after migration
- Pro user enables Personal workspace → empty second workspace appears in
  switcher, switchable, empty grid renders cleanly
- Switching workspace re-renders grid + sidebar in <300ms
- Disabling Personal workspace doesn't delete its data (verifiable via
  chrome.storage.local.get)
- Pro → free downgrade preserves all workspace data
