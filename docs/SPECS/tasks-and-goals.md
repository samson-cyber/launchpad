# Spec: Tasks, Goals, Tags — Data Model and UX

Status: Draft (v2, 2026-04-24)
Owner: Samson
Related: `workspaces-data-model.md`, `pro-tab-architecture.md`, `tracking-engine.md` (pending), `achievements.md` (pending)

v2 note: v1 drafted earlier in the same session; v2 adds explicit pause button on active task, due-date hierarchy rule between goals and tasks, and locks all design questions raised during v1 review.

---

## What and Why

Pro users organize their work with three linked concepts:

- **Goals** — larger objectives with one or more child tasks, optionally deadlined, auto-tagged
- **Tasks** — discrete actionable items, either under a goal or standalone, optionally prioritized
- **Tags** — labels attached to tasks, bookmarks, and bookmark groups, used by the tracking engine to attribute focus time to goals

Together these form the "what should I be working on right now?" layer that the tracking engine attributes time against. A user's goal is the frame; tasks are the moves; tags thread that intent through their browsing so tab time becomes meaningful rather than abstract.

The experience is designed around two dopamine moments: small celebrations on task completion, a larger celebration on goal completion (when all child tasks are done). Everything else is subordinate to getting those two moments to feel right.

---

## Scope

### In scope for v1

- Goals with optional description, optional deadline, auto-generated tag
- Tasks under goals (inherit parent goal's tag)
- Standalone tasks (no parent, no auto-tag, manual tags allowed)
- Task priorities (low, medium, high, urgent, none)
- Task due dates (with hierarchy rule vs parent goal deadline)
- Duplicate task action
- Recurring tasks (daily, weekly, monthly patterns)
- Goal templates (save a goal's structure, instantiate new goals from it)
- One global active task
- Active task widget in sidebar (collapsed / expanded / paused states)
- Pomodoro timer on active task (customizable durations in Pro Settings)
- Pause button on active task
- Completed goals section (collapsed, reopenable)
- Tag manual creation, color customization, attachment to bookmarks
- Tasks tab layout with goals, standalone, recurring, completed
- Drag-to-goal behavior with name collision handling

### Deferred to v2 or later

- Sub-goals (goal nesting)
- Task dependencies (blocking relationships)
- Advanced templates with field templating (e.g., `{{client_name}}`)
- Multi-assignee (solo product)
- Kanban view
- External task sync (Todoist, Notion imports)
- AI task suggestions
- Template field defaults that auto-fill at instantiation
- Keyboard shortcut for "Add task" (deferred; no shortcut in v1)

---

## Data Model

All goals, tasks, tags, and templates live per-workspace (inside `workspaces[i]`).

### Goal

```json
{
  "id": "goal-abc",
  "name": "Ship LaunchPad Pro v1",
  "description": "Full Pro launch including tasks, tracking, billing",
  "deadlineAt": 1775260800000,
  "status": "active",
  "autoTagId": "tag-abc",
  "isCollapsed": false,
  "createdAt": 1772600000000,
  "completedAt": null,
  "deletedAt": null,
  "displayOrder": 1
}
```

- `status`: `"active"` | `"completed"` — goals transition to `completed` automatically when all child tasks are complete, or manually via a "Mark goal complete" action.
- `autoTagId`: nullable. If user opts out of auto-tagging at goal creation, this is null.
- `deadlineAt`: nullable. Goal without deadline has no overdue indicator.
- `isCollapsed`: user's per-goal collapse state in the Tasks tab, default false (expanded).
- `displayOrder`: for manual sort (drag-to-reorder).

### Task

```json
{
  "id": "task-xyz",
  "name": "Write Day Recap spec",
  "description": null,
  "goalId": "goal-abc",
  "dueAt": 1773164400000,
  "priority": "high",
  "tagIds": ["tag-abc"],
  "completed": false,
  "completedAt": null,
  "createdAt": 1772700000000,
  "deletedAt": null,
  "displayOrder": 3,
  "isRecurringInstance": false,
  "recurringTemplateId": null
}
```

- `goalId`: nullable. `null` means standalone task.
- `priority`: `"low"` | `"medium"` | `"high"` | `"urgent"` | `null`. Visual: left-border color on task row when set; no border when null.
- `tagIds`: array. Populated with parent goal's tag at creation (if parent has auto-tag); user can add/remove manually.
- `isRecurringInstance`: true for tasks generated from a recurring template.
- `recurringTemplateId`: nullable, points to the recurring template that generated this instance.

### Recurring Task Template

Separate data type from tasks. Generates instances on a schedule.

```json
{
  "id": "rtmpl-1",
  "name": "Weekly review",
  "description": null,
  "priority": "medium",
  "tagIds": [],
  "goalId": null,
  "pattern": {
    "type": "weekly",
    "daysOfWeek": [1],
    "timeOfDay": null,
    "monthDate": null
  },
  "nextInstanceAt": 1773048000000,
  "lastInstanceId": "task-inst-5",
  "createdAt": 1772600000000,
  "deletedAt": null
}
```

- `pattern.type`: `"daily"` | `"weekly"` | `"monthly"`.
- `pattern.daysOfWeek`: array of 0-6 (Sunday-Saturday) for weekly. Ignored otherwise.
- `pattern.monthDate`: 1-31 for monthly. Ignored otherwise.
- `pattern.timeOfDay`: nullable.

### Goal Template

```json
{
  "id": "gtmpl-1",
  "name": "New client onboarding",
  "description": "Standard onboarding flow for new clients",
  "deadlineOffsetDays": 14,
  "taskList": [
    { "name": "Send welcome email", "priority": "high" },
    { "name": "Schedule kickoff call", "priority": "medium" },
    { "name": "Set up shared folder", "priority": null },
    { "name": "Send intro questionnaire", "priority": null }
  ],
  "createdAt": 1772600000000,
  "deletedAt": null
}
```

### Tag

```json
{
  "id": "tag-abc",
  "name": "ship-pro",
  "color": "#4A90E2",
  "autoGeneratedFromGoalId": "goal-abc",
  "createdAt": 1772600000000,
  "deletedAt": null
}
```

- Auto-tag colors cycle through an 8-color palette based on goal creation order at the point of auto-creation. User can override color at goal creation (and edit anytime via tag management).
- Tags attach to tasks, bookmarks, bookmark groups via `tagIds` arrays.

### Active Task State

Global across workspaces, top-level in `data`:

```json
{
  "activeTask": {
    "taskId": "task-xyz",
    "workspaceId": "workspace-1",
    "startedAt": 1773050000000,
    "isPaused": false,
    "pausedAt": null,
    "totalPausedMs": 0,
    "pomodoroState": null
  }
}
```

- `isPaused`: true when user manually paused. Persists across new-tab opens and workspace switches.
- `pausedAt`: timestamp when pause was activated; null when not paused.
- `totalPausedMs`: accumulated paused milliseconds for this task session. Used to compute actual active elapsed time = (now - startedAt) - totalPausedMs - (current pause duration if paused).
- `pomodoroState`: nullable.

Pomodoro state:

```json
{
  "cycleStartedAt": 1773050000000,
  "phase": "work",
  "phaseEndsAt": 1773051500000,
  "completedCycles": 0,
  "phasePausedMs": 0
}
```

- `phasePausedMs`: paused time accumulated within the current phase. Used to extend `phaseEndsAt` correctly after resume.

---

## Goal Lifecycle

### Creation

Entry points:
- "+ New Goal" button on Tasks tab
- Right-click empty area in Tasks tab → "New Goal"
- "Create goal from template" flow (see Templates section)

Form fields:
- Name (required)
- Description (optional)
- Deadline (optional — date picker)
- Auto-create tag (checkbox, default on)
- Tag color (if auto-creating; defaults to next color in the 8-palette rotation based on creation order; user can override)

On save:
- Goal added to workspace's `goals` array with `isCollapsed: false`
- If auto-create tag is on, tag is created and `autoTagId` set
- Goal card appears at the bottom of the active goals list

### Editing

Click goal name → inline edit.
Click deadline → date picker.
Click description → inline edit.
Right-click goal → context menu: Edit, Save as template, Mark complete, Delete.

### Deadline hierarchy rule

**Rule:** A child task's due date cannot exceed its parent goal's deadline without user confirmation. A parent goal's deadline cannot move earlier than any existing child task's due date.

**Task due date after goal deadline:**
- Modal: "This task's due date (June 10) is after 'Ship Pro v1' deadline (May 31). Extend the goal deadline to match?"
- Options: `[Extend goal to June 10]` `[Keep goal deadline, set task to May 31]` `[Cancel]`

**Goal deadline moved earlier than existing child task:**
- Blocked with message: "'Finalize Dodo integration' is due May 20 — can't set goal deadline before that. Update the task first or pick a later deadline."

**Standalone tasks (no parent goal):**
- No constraint logic. Due date is whatever user sets.

**Recurring task instances:**
- If dragged into a goal, the instance date becomes that task's due date and triggers the hierarchy check.

### Completion

**Automatic:** When the last incomplete child task of a goal is completed, goal transitions to `status: "completed"`, `completedAt` is set, and the goal-completion celebration triggers.

**Manual:** User can mark a goal complete explicitly via right-click → "Mark complete" (useful for goals with no tasks or to close out with incomplete tasks).

Completed goals move to the collapsed "Completed" section at the bottom of the Tasks tab. Tasks within remain visible but read-only. User can reopen by right-click → "Reopen" (moves goal back to active, clears `completedAt`).

### Overdue state

If a goal has a deadline and it passes with incomplete tasks, the goal stays `active` and shows a subtle "Overdue" badge in amber. No prompt.

### Collapse state

Each goal card has a chevron to collapse/expand. Collapsed shows header only (name, tag, deadline, progress bar). Expanded shows child tasks too. State persists per goal via `isCollapsed` field.

### Deletion

Right-click → Delete → confirmation → goal and all its tasks trash together (see `trash-bin.md`). Auto-tag is also trashed.

---

## Task Lifecycle

### Creation

Entry points:
- "+ Add task" button under a goal card (adds as child)
- "+ Add task" button in standalone section
- Right-click goal → "Add task"

Quick-add pattern: type a name, press Enter, task created. Advanced fields (description, due date, priority, additional tags) on hover or in detail panel.

### Editing

Click task name → inline edit.
Click priority pill → priority selector.
Click due date → date picker.
Right-click task → Duplicate, Make Active, Delete, Move to Goal, Edit details.

### Completion

Click checkbox → task marked complete, `completedAt` set, small celebration fires.

If last incomplete child of a goal → goal celebration fires after task celebration.

If task was active → active task clears.

### Reactivation

Right-click completed task → "Reactivate" → `completed = false`, `completedAt = null`, keeps original `createdAt`.

### Duplicate

Right-click → "Duplicate" → New task with:
- Name: original + " (copy)"
- Same tags, priority, goalId, dueAt
- `completed: false`, new `createdAt`, fresh `id`

### Deletion

Right-click → Delete → trashed. Individual tasks can be restored from trash independently of parent goal.

---

## Tag System

### Auto-creation

When creating a goal with "Auto-create tag" checked:
- Tag created: `name = lowercase-kebab-case(goal.name)`
- Color: rotates through an 8-color palette based on creation order; user can override at creation
- `autoGeneratedFromGoalId` set to the goal
- All child tasks inherit this tag at task creation

### Manual creation

Users can create tags independent of goals:
- Pro Settings → Tags section: list with create/rename/delete/recolor
- Tag picker inline: "Create new tag..." option in the picker

### Attachment

- **Tasks** — auto from parent goal, or manually via task detail panel
- **Bookmarks** — right-click bookmark → Add tag → pick from list or create new (per-workspace tag list)
- **Bookmark groups** — right-click group → Add tag → applies to the group (applies to new bookmarks added later)

### Visual treatment

Colored pills — solid background, white text, rounded. Consistent across tasks, bookmarks, goal cards.

### Tag deletion

Right-click → Delete → trashed. Items retain tag ID with dimmed "archived tag" badge. Restore within 30 days brings full associations back. Auto-purge at day 30 removes tag IDs from all items.

If an auto-generated tag's parent goal is hard-deleted (past trash retention), tag is permanently removed. During 30-day trash window, restoring the goal restores the tag.

---

## Recurring Tasks

### Creation

Entry: "+ New recurring task" button in Recurring section.

Form fields:
- Name (required)
- Pattern type: Daily / Weekly / Monthly
- Weekly: day-of-week multi-select
- Monthly: date picker (1-31)
- Optional: time of day
- Priority (optional)
- Tags (optional)
- Parent goal (optional)

On save: template stored, first instance generated at `nextInstanceAt`.

### Instance generation

`chrome.alarms` daily sweep at ~03:00 local time:
1. Iterates all recurring templates across all workspaces
2. For each template with `nextInstanceAt <= now`, generates a task instance
3. **Overdue handling (Q5 locked to option B):** if current time is past `nextInstanceAt` by more than one full period, generate the missed instance marked overdue AND the upcoming one. User can retroactively complete or delete.
4. Sets `isRecurringInstance: true`, `recurringTemplateId: template.id`
5. Updates `template.nextInstanceAt` to next occurrence
6. Updates `template.lastInstanceId`

Opportunistic: on Tasks tab open, same sweep runs before rendering.

### Completion

Completing an instance marks it complete. Next instance is generated by the scheduled sweep, not immediately on completion.

### Recurring task in a goal

Dragging a recurring instance into a goal opens modal:
- "Move the template into this goal" — future instances generated under this goal, inherit goal's tag
- "Move just this instance" — current instance becomes non-recurring task under goal; template continues generating instances in the standalone/ungrouped recurring section

### Editing

Right-click template → Edit → same form as creation.
- Pattern changes apply to future instances only
- Name/priority/tag changes apply to template only; existing instances keep their values

### Deletion

Deleting template trashes the template. Existing instances remain as individual tasks.

---

## Goal Templates

### Creation

- Right-click active goal → "Save as template" — captures name, description, deadline-offset (computed from now), current task list
- Pro Settings → Templates → "New template" — blank form

Form fields: template name, optional description, optional deadline offset in days, ordered task list (name + optional priority each).

### Management

Pro Settings → Templates section lists all templates. Rename, edit, delete, duplicate.

### Instantiation

Tasks tab → "+ New Goal from template" button (or dropdown on "+ New Goal") → select template → optional name adjustment → Create.

On instantiation:
- New goal created with template's name
- Deadline set to `now + deadlineOffsetDays` if set
- Each task in `taskList` becomes a new task under the goal
- Goal's auto-tag created (unless user unchecked)
- Template not modified; can be instantiated multiple times

Standalone tasks cannot be created from templates in v1.

---

## Task Priorities

Enum: `"low"` | `"medium"` | `"high"` | `"urgent"` | `null`.

### Visual treatment

- Left border color on task row **only when priority is set**:
  - Urgent: red
  - High: orange
  - Medium: yellow
  - Low: blue (subtle)
- No border when `priority: null` (clean default)
- Small pill in task detail view showing priority name

### Interactions

- Click priority pill → popover with priority options (click again to clear)

### Filtering and sorting

Tasks tab filter bar:
- Priority (multi-select)
- Tag (multi-select)
- Status (active / completed / all)
- Sort by: creation date (default), due date, priority, name

---

## Tasks Tab Layout

**1. Header strip**
- "Tasks" title
- Filter bar: priority, tag, status, sort dropdown
- Actions: "+ New Goal" (dropdown for "from template"), "+ New Task" (standalone), "+ Recurring"
- "Templates" link → Templates management

**2. Active Goals section**
- Cards for each goal with `status: "active"`
- User-draggable, default sort by `displayOrder`
- Collapsible via chevron (state persists per goal)
- Card: name, auto-tag pill, deadline + overdue badge, progress bar, child tasks, "+ Add task", context menu

**3. Standalone Tasks section**
- Header "Standalone"
- Flat list of tasks with `goalId: null` and not recurring instances
- Sort: by priority desc then creation asc (or user-customizable)
- "+ Add task" button at top

**4. Recurring Tasks section**
- Header "Recurring" with count badge
- Two sub-areas:
  - Templates list (patterns visible: "Weekly review • every Monday"), right-click to edit/delete
  - Active instances interleaved chronologically (or within parent goal if attached)
- Recurring instances in other sections get a small ↻ icon to distinguish

**5. Completed section** (collapsed by default)
- Expandable header "Completed (N)"
- Completed goals + child tasks
- Completed standalone tasks
- Completed recurring instances (up to 30 days; older auto-purge)

### Drag behavior

- Standalone task → goal card: moves in, inherits goal's tag. Name collision modal: "A task named 'Foo' already exists. Rename to 'Foo (2)' or cancel?"
- Task between goals: moves, auto-tag changes to new goal's tag. Same collision handling.
- Task out of goal: becomes standalone, loses auto-tag (keeps manual tags).
- Recurring task → goal: modal asks "move template" vs "move instance".
- Goal cards cannot nest. Goals reorderable among themselves.

---

## Active Task Widget

Lives in sidebar, accessible from every tab. Three visual states: collapsed, expanded, paused (variant of collapsed/expanded).

### Collapsed state

Small compact element in sidebar, below group list, above Settings cog:
- Active, not paused: `▶ 00:23:15` (play icon + elapsed time)
- Active, paused: `⏸ 00:23:15` (pause icon + frozen elapsed time)
- No active task: "No active task" + "+" icon to pick one
- Click to expand

### Expanded state

Click collapsed widget → expands inline in sidebar:
- Task name (bold, ~2 lines)
- Parent goal name (secondary text, if any)
- Tag pill (if any)
- Elapsed time (large, prominent)
- Progress ring if pomodoro running
- Action buttons:
  - Complete (✓)
  - Cancel (×)
  - Switch (⇄)
  - Pause/Resume (⏸ / ▶)
  - Pomodoro (⏱)

Clicks outside or cursor leaving sidebar (with `sidebarLocked = false`) collapses back.

### Making a task active

Three entry points:
- Click a task in Tasks tab → immediately active (replaces any currently active)
- Expanded widget → Switch → hierarchical dropdown (Workspace → Goal → Tasks), current workspace expanded by default, search bar at top for filtering across all tasks
- Right-click a task anywhere → "Make active"

Previous active task: stays as-is (not completed/cancelled), just no longer active. Tracking stops for previous, begins for new.

### Pause behavior

Pause button in expanded widget. When pressed:
- `activeTask.isPaused = true`
- `activeTask.pausedAt = now`
- Widget's elapsed time freezes
- Collapsed icon changes from ▶ to ⏸
- Tracking engine stops attributing time to this task
- If pomodoro is running, the current phase also pauses (timer freezes at its current remaining duration)

On resume (pressing the button again):
- Accumulated pause duration added to `totalPausedMs`
- `isPaused = false`, `pausedAt = null`
- Elapsed time resumes counting from where it stopped
- Pomodoro phase resumes; `phaseEndsAt` extended by the pause duration

**Pause vs idle detection:**
- Manual pause is sacred — tracking stays paused until user resumes, even if they return to the keyboard
- Idle detection only acts when user has NOT manually paused. If user goes idle without pausing, tracking pauses silently and resumes silently on activity. No state written to `isPaused` — idle is invisible to the user by design.
- If user manually pauses then goes idle, they stay paused (expected).

**Pause persists across workspace switches and new-tab opens.**

### Completing / Cancelling

- Complete: task marked complete, celebration fires, active task clears. Works even if paused (unpause + complete in one action).
- Cancel: active task clears. Task stays incomplete, no celebration, not marked complete. Works whether paused or not.

### Switching during pomodoro

Confirmation modal: "Switch task? This will reset your pomodoro cycle." `[Switch and reset]` `[Cancel]`.

---

## Pomodoro Timer

### Defaults

- Work: 25 minutes
- Short break: 5 minutes
- Long break: 15 minutes
- Cycles before long break: 4

Customizable in Pro Settings → Pomodoro:
- Work duration (5-60 min)
- Short break (1-30 min)
- Long break (5-60 min)
- Cycles before long break (2-10)

### Starting a cycle

Expanded widget → Pomodoro button → starts work phase.

Widget switches to pomodoro display:
- Progress ring
- Countdown ("24:37") replaces elapsed time
- Phase indicator ("Work" / "Short break" / "Long break")
- Stop button (square)

### Phase transitions

On phase end:
- Subtle toast: "Work phase complete. Break time." / "Break over. Back to work?"
- Phase flips automatically
- No audio by default (opt-in in Pro Settings)

### Stopping a cycle

Stop button → pomodoro state clears, widget returns to elapsed-time display. Task remains active. Cycle count does NOT reset — it accumulates until the task is completed, cancelled, or user explicitly resets.

### Pausing during pomodoro

When user pauses (main pause button): pomodoro pauses with it. Resume picks up at the same phase with the remaining time extended accordingly. No cycle-count change.

---

## Completion Celebrations

### Task completion

- Checkmark scale animation (150ms)
- Row fades to 50% opacity, moves to Completed section (300ms)
- Inline toast: "✓ Task completed"
- If last task of a goal → goal celebration fires next

### Goal completion

- Goal card glows (teal accent, 500ms)
- Toast: "🎯 Goal achieved: [goal name]" + subtext ("6 days, 14 tasks completed")
- Goal card animates to Completed section (400ms)
- Achievement badge toast follows if unlocked (see `achievements.md`)

No confetti, no full-screen takeover, no sound by default.

---

## Cross-Workspace Behavior

- Goals, tasks, tags, templates per-workspace
- Active task state global (one across all workspaces)
- Switching workspaces: active task unaffected, tracking continues
- If user is in Workspace A with an active task from Workspace B: widget shows active task; clicking it reveals "This task is in [Workspace B]" with offer to switch workspaces
- Combined analytics toggle (Pro Settings) aggregates task/goal completion counts across workspaces for Dashboard

---

## Free Tier Interaction

- Free users see Tasks tab as greyed (Pro)
- Click → Preview Mode with hardcoded demo goals/tasks (never writes to storage)
- Free tier workspace data: `goals`, `tasks`, `tags`, `taskTemplates`, `recurringTemplates` stay empty arrays
- Post-trial downgrade: existing goals/tasks preserved (read-only), per downgrade spec

---

## Dependencies

- `Foundation: Storage schema migration to workspace-aware shape` — add per-workspace `goals`, `tasks`, `tags`, `taskTemplates`, `recurringTemplates` arrays + `deletedAt`
- `Foundation: Tab bar scaffold` — Tasks tab lives here
- `Foundation: Pro tab preview mode with demo data` — Tasks tab preview
- `workspaces-data-model.md` — workspace scoping
- `tracking-engine.md` (pending) — active task drives attribution, pause/idle mechanics
- `achievements.md` (pending) — goal completion unlocks badges
- `trash-bin.md` — goals, tasks, tags, templates soft-delete

---

## Acceptance Criteria

- User creates a goal with name only; auto-tag created by default in rotating palette color
- User adds tasks to a goal; tasks inherit parent goal's auto-tag
- User creates standalone tasks with no parent goal; no auto-tag
- Completing the last incomplete task of a goal triggers goal celebration
- User explicitly marks a goal complete even with incomplete tasks
- Setting a task's due date beyond its parent goal's deadline triggers the hierarchy modal
- Moving a goal's deadline earlier than any child task's due date is blocked with message
- User reactivates completed tasks via right-click
- Duplicate task creates new task with "(copy)" suffix
- Recurring template generates instances on schedule; overdue scenario generates both missed and upcoming instances
- Goal templates save from active goals and instantiate new goals
- Dragging a task between goals handles name collisions with modal
- Dragging a recurring task to a goal prompts "move template" vs "move instance"
- Active task widget shows elapsed time (collapsed) or full controls (expanded)
- Pause button freezes elapsed time, changes icon to ⏸, tracking stops
- Resume restores tracking and pomodoro state correctly
- Idle detection doesn't override manual pause
- One active task persists across workspace switches and new-tab opens
- Pomodoro timer defaults to 25/5, customizable in Pro Settings
- Pomodoro pauses and resumes correctly with main pause button
- Completed goals section collapsed by default, per-goal collapse state persisted
- Task priorities render with colored left borders when set; no border when null
- Tags render as colored pills consistently across tasks, bookmarks, goal cards
- Deleting a goal trashes goal, child tasks, auto-tag together
- Free user preview mode shows hardcoded demo data, zero writes to storage
- Goal card collapse state persists across new-tab opens

---

## Open Questions

All within-spec questions from v1 are now resolved. Remaining items are cross-spec concerns:

1. **Time attribution granularity** — how the tracking engine maps URLs → tags → active task → time in detail. Lives in `tracking-engine.md` (pending, blocked on prototype data).
2. **Which goal completions unlock which achievements** — lives in `achievements.md` (pending, Experience area).
3. **Day Recap rendering of completed goals/tasks** — lives in `day-recap.md` (pending, Experience area).
4. **Soft cap / warning on recurring task instance accumulation** — if a user never opens LaunchPad for 60 days, do we generate 60 missed daily instances? Probably want a ceiling (e.g., max 7 overdue instances kept, older skipped silently). Flag for implementation; doesn't block spec.
