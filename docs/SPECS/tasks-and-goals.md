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
- Active task surface: fixed top-right docked card, minimizing to a pill (paused is a state of both)
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
    "sessionAnchorAt": 1773050000000,
    "pausedAt": null,
    "pausedMs": 0,
    "idleAt": null,
    "idleMs": 0,
    "isPaused": false,
    "pomodoroState": null
  }
}
```

> **Superseded (April model):** pause was originally spec'd as a PER-TASK flag (`isPaused` / `totalPausedMs`). It is now a **global** top-level flag, `data.trackingPaused` — pause stops *tracking*, not *this task*. `isPaused` remains on the record as an inert legacy field. See `DECISIONS.md` 2026-07-19.

- `startedAt`: when the task was made active. Never rewritten while it stays active (re-activating the already-active task must not split the engine session).
- `sessionAnchorAt`: start of the current **browser sitting**, rewritten once per launch by `chrome.runtime.onStartup`. Closed-browser time is structurally uncountable, so ACTIVE counts from `max(startedAt, sessionAnchorAt)`.
- `pausedAt` / `pausedMs`: manual-pause accounting. `pausedAt` is stamped on pause and folded into `pausedMs` on resume.
- `idleAt` / `idleMs`: idle accounting, maintained by the background idle listener. Deliberately separate from the pause fields so manual-pause semantics stay untouched.
- `pomodoroState`: nullable.

**The two counters.** The card shows both, answering different questions:

- **ACTIVE** (headline, ticks every second) = *this sitting, while present*:
  `now - max(startedAt, sessionAnchorAt) - pausedMs - idleMs - (paused ? now - pausedAt : 0) - (idleAt ? now - idleAt : 0)`
  Display-only — the tracking engine never reads these fields.
- **FOCUSED TODAY** (secondary line) = the engine's honest per-day attribution, advancing only inside an open session.

Records predating any of these fields degrade to zero deduction rather than jumping.

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

**Task rows carry their own context menu, reached two ways (2026-08-31).** Right-click a task row, or use the **hover-revealed options pill** in the row's name cluster. Entries: Make active, Edit, Priority, Duplicate, Assign to a goal (reading "Move to another goal" when the task is already in one), Assign session to this task (reading "Change session" when attached), Detach session, Mark complete or Reactivate, and Delete. The session entries are Pro and are **absent** rather than disabled otherwise. Priority opens the shipped priority popover rather than a submenu, so the four levels and Clear stay defined in one place. The pill sits inside `.tt-task-main` at `opacity: 0`, revealed on row hover and independently by `:focus-within` so it stays keyboard-reachable; rendered layout is pixel-identical to a row without it. The row keeps its own flag and trash controls — consolidation was considered and rejected. See DECISIONS.md 2026-08-31.

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

**Manual:** User can mark a goal complete explicitly via right-click → "Mark complete" (useful for goals with no tasks, or to close one out while unfinished tasks remain — see the release rule below).

Completed goals move to the collapsed "Completed" section at the bottom of the Tasks tab. User can reopen by right-click → "Reopen" (moves goal back to active, clears `completedAt`).

**CORRECTION, 2026-08-31.** This paragraph previously read *"Tasks within remain visible but read-only."* **That was never true of shipped code, and the gap it described was a real bug.** The Completed box lists a completed goal as ONE row plus completed STANDALONE tasks; it has never listed a completed goal's children. Goal cards are drawn from `getActiveGoals`, and the standalone list is `goalId === null`. So an unfinished task inside a completed goal belonged to none of the three lists the Tasks tab draws and simply disappeared, while remaining incomplete and undeleted in storage. Samson's real profile carried twenty tasks stranded this way.

**COMPLETING A GOAL NOW RELEASES ITS UNFINISHED TASKS TO STANDALONE**, in the same write, behind a confirm naming how many will move; a one-time marker-guarded sweep repairs profiles that already carry stranded tasks. Only `goalId` changes — name, priority, due date, tags and tracked time survive, and the release is deliberately not routed through `reassignTaskToGoal`, which would also strip the goal's auto-tag. **COMPLETED children stay in the goal**, represented by the goal's own row. **Both completion paths release**, including the automatic one above, which cannot currently strand anything and calls the release anyway so the rule travels with the condition. **Reactivating a goal does not re-adopt released tasks.** Goal DELETION is unchanged and was always safe: it soft-deletes children in the same write, so they appear in the Deleted box. See DECISIONS.md 2026-08-31 and BUGS.md **E8**, **E9**, **Q14**, **L4**.

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
- Tasks banner → Templates panel → "New template" — blank form

Form fields: template name, optional description, optional deadline offset in days, ordered task list (name + optional priority each).

### Management

The Tasks-banner **Templates** panel lists all templates. Rename, edit, delete, duplicate. (Moved from Pro Settings → Templates per the per-tab surfaces philosophy, DECISIONS 2026-07-14.)

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

## Active Task Surface

> **Supersedes** the April sidebar widget (collapsed/expanded inline in the sidebar), replaced by the [1.0.16] v3 docked card.

A single fixed **top-right** surface (`#active-task-pill`), present on every tab. It is *furniture*, not a popover — a background click does nothing. Three renderings, one element:

**Docked card** (active task, not minimized — the default):
- Eyebrow "Active task" + a minimize chevron
- Task name; parent goal name beneath it, if any; tag pills, if any
- If the active task lives in another workspace, a "This task is in X" notice with a one-click switch
- **ACTIVE** — the large ticking headline, with its label reading `Active` or `Paused`
- **FOCUSED TODAY** — the smaller honest line beneath
- Action row: `✓ Done` / `⏸ Pause` (becomes `▶ Resume` when paused) / `×` cancel / `⇄` switch

**Minimized pill** (active task, minimized): play or pause glyph, an eyebrow reading "Active task" or "Paused", the task name (truncating), and the ticking ACTIVE time. The whole face restores the card. The minimize preference is persisted and picked up cross-tab.

**Empty pill** (no active task): "No active task" and a `+`; the face opens the Switch dropdown. **When globally paused with no active task**, it also shows an amber pause glyph which is itself a one-click **Resume** control — the card that normally hosts Resume is not rendered, so without it a paused user with no task would be trapped. A click on the glyph resumes; a click anywhere else on the face still opens the dropdown.

**Self-heal:** if the active task is completed, deleted, or its workspace disappears — including from another tab — the stored record is cleared and the surface drops to the empty pill, so the engine can never attribute focus to a task the UI says is not active.

### The two counters

Both are always shown, labelled, and answer different questions. **`Active Task State` above is authoritative** for the field set and the exact ACTIVE formula; see also `DECISIONS.md` (2026-07-17 dual counters, 2026-07-18 session anchor, 2026-07-19 idle deduct).

- **ACTIVE** — the large one. *This sitting, while present*: session-anchored at browser launch (closed-browser time is structurally uncountable), with **pause deducting loudly** and **idle deducting silently**. Ticks every second; freezes visibly when paused.
- **FOCUSED TODAY** — the smaller one. The tracking engine's honest per-day attribution, advancing only inside an open session. Unaffected by the ACTIVE accounting.

### Making a task active

Entry points, all funnelling through one activation path:
- The **play glyph** on a task row in the Tasks tab
- The card's **Switch** button, or the empty pill's face → hierarchical dropdown (Workspace → Goal → Tasks), current workspace expanded by default, search across all workspaces at the top
- **Right-click** a task anywhere → "Make active"

Previous active task: stays as-is (not completed/cancelled), just no longer active. Tracking stops for the previous task and begins for the new one.

**Rule 4 — activation clears pause.** Every one of those gestures clears the global pause in the *same atomic write* as the activation: pause means "stepped away", and choosing a task is the opposite declaration. No second click. Re-picking the **already-active** task is idempotent and behaves as **Resume** — ACTIVE continues from the frozen value rather than restarting, `startedAt` is not rewritten, and no engine session is split ("carry on", not "start over").

### Task-row integration

The row's glyph is a three-state control over the same global flag as the card, so card, pill and row can never disagree:

| Row state | Glyph | Tooltip | Click |
|---|---|---|---|
| Not active | play (revealed on row hover) | "Start task" | activate |
| Active, running | pause | "Pause tracking" | pause tracking |
| Active, paused | play, amber | "Resume tracking" | resume tracking |

Clicking a *different* row's glyph while one task is active switches activation, as before. When globally paused with an active task, that task's **entire row** takes an amber tint and ring, so the paused state reads at row level rather than from the glyph alone.

### Pause behavior

Pause is GLOBAL — it pauses tracking, not one task. The control lives on the active-task card (and the row glyph mirrors it). When pressed:
- `data.trackingPaused = true`
- `activeTask.pausedAt = now` (after folding any pending `idleAt` into `idleMs`, so the two spans can never double-deduct)
- ACTIVE freezes; the card, minimized pill and the task's row all take the **loud amber** paused treatment
- The engine's gate returns `paused`, so the open session closes and none reopen
- If pomodoro is running, the current phase also pauses (timer freezes at its current remaining duration)

On resume (pressing the button again):
- Accumulated pause duration added to `pausedMs`; `pausedAt = null`
- `data.trackingPaused = false`; the amber treatment clears everywhere
- ACTIVE resumes from the frozen value with no jump; the engine reopens a session on the next boundary
- Pomodoro phase resumes; `phaseEndsAt` extended by the pause duration

Activation also clears pause: every explicit activation gesture clears `trackingPaused` in the same write (start means start). Re-picking the already-active task behaves as Resume — ACTIVE continues from the frozen value rather than restarting.

**Pause vs idle detection:**
- Manual pause is sacred — tracking stays paused until the user resumes, even if they return to the keyboard. Idle never writes the pause flag.
- Idle acts only when the user has NOT manually paused. Going idle closes the engine session silently and it reopens silently on activity.
- Idle additionally **deducts from ACTIVE** (`idleAt`/`idleMs`), so the counter reads honest on return rather than counting time the user was away.
- **The asymmetry is deliberate:** pause is LOUD (amber, frozen, labelled — a user declaration reflected back), idle is SILENT (no amber, no label, no idle UI — an automatic inference the user did not ask for). Idle remains invisible by design.
- If the user manually pauses then goes idle, they stay paused, and the idle listener no-ops entirely while paused.

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

Hybrid acknowledgment (decided 2026-07-14) — completion must read as "done and filed," never as deletion:

- **Checkmark pop** — the checkbox scales up and back (150ms).
- **In-place dwell (~900ms)** — the row stays where it is with a faint green tint and dimmed text. This is the acknowledgment beat; the row does not move yet.
- **Settle, named by destination** (the toast names where the task went, so it teaches itself):
  - **Standalone task** (or a goal-child whose goal just auto-completed, so the whole card relocates) → the row fades/slides out (~300ms) into the Completed section, toast **"✓ Moved to Completed"**.
  - **Goal-child task under a still-active goal** → the row stays in its goal card and settles into the greyed, struck-through completed styling **in place**. The goal card keeps its completed children so the progress bar stays truthful, so these tasks do *not* move to the Completed section. Toast **"✓ Task completed"**.
- **Goal auto-completion sequencing** — when completing the task finishes its parent goal (all children done), the goal's move to Completed happens in the post-animation settle render, i.e. AFTER the task animation, per spec. A goal-completion celebration (see Goal completion below) is not yet implemented; the sequencing seam is preserved for when it is.
- **Rapid multi-completes** are coalesced — the panel defers its settle re-render until the last in-flight completion animation finishes, so one completion never interrupts another's animation.

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
- Active task surface shows the ACTIVE counter (minimized pill) or full controls (docked card)
- Pause button freezes ACTIVE, applies the loud amber treatment, tracking stops
- Resume restores tracking and pomodoro state correctly, ACTIVE continuing with no jump
- Idle detection doesn't override manual pause
- Going idle silently freezes ACTIVE (no amber, no label) and it reads honest on return
- Idle and pause never double-deduct, in either order
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
