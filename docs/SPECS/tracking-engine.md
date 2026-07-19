# Spec: Tracking Engine — Focus-Time Capture

Status: Draft (2026-07-07)
Owner: Samson
Related: `workspaces-data-model.md`, `tasks-and-goals.md`, `pro-tab-architecture.md`, `achievements.md` (pending)

---

## What and Why

The tracking engine is LaunchPad Pro's local-only focus-time capture layer. It attributes browsing time to a workspace, to tags, and to the currently active task, so that tab time becomes meaningful rather than abstract. It is the data source behind the "Deep Work Time" metric that the Pro value proposition names as primary.

The engine ships in **two phases**, per DECISIONS 2026-07-07:

- **CAPTURE (pre-launch)** — the engine itself. `[1.0.25]` capture core, `[1.0.26]` attribution + aggregation + retention. Runs from launch day, writing session records and per-day aggregates.
- **ANALYTICS UI (v2.1)** — Insights charts, Day Recap content, the Deep Diver badge. Everything the captured data feeds.

**Why capture-first:** tracking data only exists from the moment the engine runs. Capturing from launch day means the v2.1 analytics arrive pre-populated with real user history rather than empty for every launch buyer. See DECISIONS 2026-07-07 for the full rationale.

---

## Scope

### In scope for v1 (CAPTURE)

- Focus-session detection, open/close on boundary events
- Domain-only session records with attribution stamped at close
- Per-day rollup aggregates (rollup-on-write)
- 30-day retention pruning of session records; aggregates kept forever
- Orphaned-session reconciliation on service-worker startup
- Per-workspace `trackingEnabled` control
- Entitlement gating (Pro / trial only)
- Manual-pause flag and gate (pause **UI** ships separately in `[1.0.17]`)
- `Tracking.debugSummary()` console helper
- One user-facing line — "Today: Xh Ym focused" — folded into the Dashboard shell (`[1.0.20]`)

### Deferred to v2.1 (ANALYTICS UI)

- Insights charts (breakdowns by domain, tag, task; trends)
- Day Recap content driven by tracking data
- Deep Diver achievement badge

### Out of scope for v1

- Analytics / visualization UI of any kind
- Configurable idle threshold (fixed at 60s in v1)
- Tracking-data export
- Per-URL granularity (domain only, by design)
- Cross-device sync

---

## Architecture

Constraints inherited from the validated April prototype (commit `7ff8af8`):

- **Write-per-event.** Session state is persisted on each boundary event. There is no `chrome.alarms` flush cadence — a 30s minimum alarm interval makes an alarm-based flush unviable for this workload — and no in-memory buffering of pending writes.
- **All cross-event state lives in `chrome.storage`.** Module-level service-worker state is not durable across SW suspends, so nothing the engine needs to survive a suspend may live only in memory.
- **Production keys are separate from the retired `tracking_prototype` key.** The prototype module must not ship (see `BUGS.md` Section H).

---

## Session Model

A **focus session** is contiguous focus on one tab's domain, within one workspace, under one active-task state.

### Session boundaries

Each of the following closes the current session and, where applicable, opens the next:

- Tab switch
- URL commit to a **different domain**
- Window focus change
- Idle / locked transition (`chrome.idle`, 60s detection interval, fixed in v1)
- Active-task change
- Workspace switch
- Manual pause

### Lifecycle

- The open-session record is persisted at open (write-per-event).
- It is closed by the next boundary event.
- **Orphaned open sessions** (from browser or SW death) are reconciled on SW startup, using the last-known event timestamp — the prototype's approach.

### Manual pause

- Manual pause is a **persisted flag** that gates session opening: while paused, no new session opens.
- Idle transitions **never** clear manual pause. (A user who manually paused stays paused even after returning to the keyboard.)
- The pause **flag and gate** ship in `[1.0.25]`. The pause **UI** ships in `[1.0.17]` (see `tasks-and-goals.md`, Active Task Surface).
- Idle additionally deducts from the **ACTIVE** display counter (`idleAt`/`idleMs` on `activeTask`) so it reads "this sitting, while present". That accounting is **display-only and engine-inert** — `computeDesired` reads only `activeTask.taskId`, and session/FOCUSED behaviour is unchanged. See `tasks-and-goals.md`, Active Task State.

---

## Data and Privacy

- **Domain only, never full URLs.** Session records store the domain of the focused tab, never the full URL.
- Attribution — domain → bookmark match → `tagIds`, plus the active task's tags — is resolved **at session close** and stamped onto the record.
- **Local-only.** No network transmission, no third-party analytics (`BUGS.md` G4). All data lives in `chrome.storage.local`.

### Session record shape

```json
{
  "id": "sess-abc",
  "workspaceId": "workspace-1",
  "domain": "docs.google.com",
  "start": 1775260800000,
  "end": 1775262600000,
  "tagIds": ["tag-abc"],
  "activeTaskId": "task-xyz",
  "bookmarkId": "bm-123",
  "closedBy": "tab-switch"
}
```

- `activeTaskId`: nullable (no active task at the time).
- `bookmarkId`: nullable (domain matched no bookmark).
- `closedBy`: the boundary reason that closed the session.

### Per-day aggregates

- Keyed by **local calendar day** (`YYYY-MM-DD` from local time).
- **Deliberate contrast with task due dates**, which are UTC-normalized per the `[1.0.13]` lesson. Due dates are calendar commitments and must mean the same instant everywhere; day aggregates answer "what did I *do* today" in the user's lived day, so they follow local time. **This contrast is intentional and must be documented both here and in code comments** at the point where the day key is computed.

Aggregate shape per day:

```json
{
  "day": "2026-07-14",
  "totalFocusedMs": 0,
  "byDomain": {},
  "byTag": {},
  "byTask": {},
  "longestSessionMs": 0
}
```

- **Rollup-on-write:** each aggregate field is incremented at session close. Aggregates are never recomputed from raw records at read time.

### Retention

- **Session records** are pruned at **30 days** on SW startup.
- **Per-day aggregates** are kept **forever** (ROADMAP policy). Because aggregates roll up on write, pruning raw records never loses aggregate history.

---

## Workspace Scoping

- Each workspace carries a `trackingEnabled` boolean.
- **Default TRUE** for all workspaces, including Main.
- The toggle is visible at workspace creation and as a row in the Pro Settings workspaces list.
- `trackingEnabled = false`: no session records are written for that workspace, and its aggregates are left untouched.

This **supersedes the 2026-04-24 Work/Personal tracking split.** Workspaces are now generic, user-managed containers, so the old Work-tags / Personal-domain-only taxonomy no longer maps — tags attribute wherever goals exist. The underlying privacy principle survives, but as **visible per-workspace control** rather than per-type defaults.

---

## Entitlement

- The engine runs only when `reconcileProState` grants Pro or trial.
- **Downgrade stops capture.** Existing session records and aggregates are preserved, consistent with the read-only downgrade behavior elsewhere in Pro.

---

## Surfaces (v1)

- **`Tracking.debugSummary()`** — console helper. Prints today's aggregate, the open-session state, and a `bytes-in-use` readout. Primary observability surface for the capture phase.
- **"Today: Xh Ym focused"** — one user-facing line on the Dashboard shell (`[1.0.20]`). Hidden when tracking is off for the current workspace.

Everything else — charts, Day Recap content, breakdowns, the Deep Diver badge — is **v2.1**.

---

## Dependencies

- `workspaces-data-model.md` — workspace scoping, `trackingEnabled`
- `tasks-and-goals.md` — active task drives attribution; tags; pause/idle mechanics
- `pro-tab-architecture.md` — the `[1.0.20]` Dashboard surface hosting the "Today" line
- Achievements redefinition (DECISIONS 2026-07-07) — Deep Diver deferred to v2.1

---

## Acceptance Criteria

- The engine writes a session record on each boundary event; no `chrome.alarms` flush is used
- Session records store domain only — no full URL appears in any record
- A session closes and re-attributes on tab switch, cross-domain URL commit, window focus change, idle/locked transition, active-task change, workspace switch, and manual pause
- An open session left orphaned by browser/SW death is reconciled on SW startup from the last-known event timestamp
- Manual pause gates session opening; returning to the keyboard while manually paused does not resume capture
- Attribution (tags via domain→bookmark match plus active-task tags) is stamped at session close
- Per-day aggregates key on the local calendar day; the local-vs-UTC contrast with due dates is documented in code
- Aggregates roll up on write and are never recomputed at read time
- Session records prune at 30 days on SW startup; per-day aggregates persist
- A workspace with `trackingEnabled = false` writes no records and leaves its aggregates untouched; default is ON
- Capture runs only under Pro/trial entitlement; downgrade stops capture and preserves existing data
- `Tracking.debugSummary()` reports today's aggregate, open-session state, and bytes-in-use
- The "Today: Xh Ym focused" line renders on the Dashboard shell and hides when tracking is off for the current workspace

---

## Open Questions

- Whether the v2.1 analytics UI reads aggregates only, or ever needs to re-scan raw records within the 30-day window (affects whether any additional rollup dimensions must be captured now vs. derivable later). Flagged for the v2.1 Insights spec; does not block capture.
