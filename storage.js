/* global chrome, ProAccess */

var Storage = (function () {
  "use strict";

  function emptyTrackingState() {
    return {};
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function getDefaultData() {
    return {
      workspaces: [{
        id: "main",
        name: "Main",
        createdAt: Date.now(),
        isReadOnly: false,
        groupOrder: ["ungrouped"],
        groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null }],
        goals: [],
        tasks: [],
        tags: [],
        tracking: emptyTrackingState()
      }],
      workspaceOrder: ["main"],
      activeWorkspaceId: "main",
      settings: { columns: 6, collapsedGroups: {}, combinedAnalyticsEnabled: false },
      pro: {
        licenseKey: null,
        trialStartedAt: null,
        trialEndedAt: null,
        subscriptionStatus: "free",
        lastVerifiedAt: null
      }
    };
  }

  function ensureDeletedAtFields(data) {
    var changed = false;
    (data.workspaces || []).forEach(function (ws) {
      (ws.groups || []).forEach(function (g) {
        if (!Object.prototype.hasOwnProperty.call(g, "deletedAt")) { g.deletedAt = null; changed = true; }
        (g.shortcuts || []).forEach(function (s) {
          if (!Object.prototype.hasOwnProperty.call(s, "deletedAt")) { s.deletedAt = null; changed = true; }
          if (s.variants) {
            s.variants.forEach(function (v) {
              if (!Object.prototype.hasOwnProperty.call(v, "deletedAt")) { v.deletedAt = null; changed = true; }
            });
          }
        });
      });
    });
    return changed;
  }

  function migrate(data) {
    if (data && Array.isArray(data.workspaces)) return data;

    var oldData = data || {};
    var migratedSettings = Object.assign(
      { columns: 6, collapsedGroups: {} },
      oldData.settings || {},
      { combinedAnalyticsEnabled: false }
    );
    var newData = {
      workspaces: [{
        id: "main",
        name: "Main",
        createdAt: Date.now(),
        isReadOnly: false,
        groupOrder: oldData.groupOrder || [],
        groups: oldData.groups || [],
        goals: [],
        tasks: [],
        tags: [],
        tracking: emptyTrackingState()
      }],
      workspaceOrder: ["main"],
      activeWorkspaceId: "main",
      settings: migratedSettings,
      pro: {
        licenseKey: null,
        trialStartedAt: null,
        trialEndedAt: null,
        subscriptionStatus: "free",
        lastVerifiedAt: null
      }
    };

    ensureDeletedAtFields(newData);
    return newData;
  }

  function getActiveWorkspaceIndex(data) {
    if (!data || !Array.isArray(data.workspaces) || data.workspaces.length === 0) return 0;
    var idx = data.workspaces.findIndex(function (ws) { return ws.id === data.activeWorkspaceId; });
    if (idx === -1) {
      console.warn("[LaunchPad] Active workspace id not found:", data.activeWorkspaceId, "— falling back to workspace[0]");
      return 0;
    }
    return idx;
  }

  function getActiveWorkspace(data) {
    if (!data || !Array.isArray(data.workspaces) || data.workspaces.length === 0) return null;
    var idx = getActiveWorkspaceIndex(data);
    return data.workspaces[idx] || data.workspaces[0];
  }

  async function getAll() {
    try {
      var result = await chrome.storage.local.get("data");
      var existing = result.data;

      if (!existing) {
        // Fresh install: write default new-shape, no backup created.
        var fresh = getDefaultData();
        await chrome.storage.local.set({ data: fresh });
        console.log("[LaunchPad] Initialized fresh-install data (workspace-aware shape)");
        return fresh;
      }

      if (Array.isArray(existing.workspaces)) {
        // Already migrated. Defensive backfill of deletedAt fields.
        var patched = ensureDeletedAtFields(existing);
        if (patched) {
          await chrome.storage.local.set({ data: existing });
          console.log("[LaunchPad] Backfilled missing deletedAt fields");
        }
        return existing;
      }

      // Old shape: backup, migrate, persist.
      console.log("[LaunchPad] Migrating storage to workspace-aware shape...");
      await chrome.storage.local.set({ data_pre_migration_backup: existing });
      var migrated = migrate(existing);
      await chrome.storage.local.set({ data: migrated });
      console.log("[LaunchPad] Migration complete. Backup saved as data_pre_migration_backup.");
      return migrated;
    } catch (err) {
      console.error("[LaunchPad] Storage read failed:", err);
      return getDefaultData();
    }
  }

  async function saveAll(data) {
    try {
      await chrome.storage.local.set({ data: data });
    } catch (err) {
      console.error("[LaunchPad] Storage write failed:", err);
    }
  }

  async function addShortcut(groupId, shortcut) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var group = ws.groups.find(function (g) { return g.id === groupId; });
    if (!group) {
      console.warn("[LaunchPad] addShortcut: group not found:", groupId);
      return;
    }
    shortcut.id = shortcut.id || genId();
    shortcut.addedAt = shortcut.addedAt || Date.now();
    if (!Object.prototype.hasOwnProperty.call(shortcut, "deletedAt")) shortcut.deletedAt = null;

    // [1.0.9.2] Q3/Q5: group-inherit hook. New bookmark added to a tagged group
    // inherits the group's tagIds, merged with any tagIds the bookmark already
    // carries (union, dedup, preserving order: bookmark's own first, then
    // group's). Add-time only — drag-between-groups (handled in
    // syncShortcutsFromDOM) intentionally does not trigger inheritance, and
    // tagging a group later does not retroactively apply to existing
    // bookmarks. See storage.js shortcut-tag inheritance reasoning.
    var groupTagIds = ensureTagIdsArray(group);
    if (groupTagIds.length) {
      var existingTagIds = ensureTagIdsArray(shortcut);
      var merged = existingTagIds.slice();
      groupTagIds.forEach(function (tid) {
        if (merged.indexOf(tid) === -1) merged.push(tid);
      });
      shortcut.tagIds = merged;
    }

    group.shortcuts.push(shortcut);
    await saveAll(data);
    console.log("[LaunchPad] Shortcut added to", groupId, ":", shortcut.title || shortcut.url);
    return shortcut;
  }

  async function removeShortcut(groupId, shortcutId) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var group = ws.groups.find(function (g) { return g.id === groupId; });
    if (!group) return;
    group.shortcuts = group.shortcuts.filter(function (s) { return s.id !== shortcutId; });
    await saveAll(data);
    console.log("[LaunchPad] Shortcut removed:", shortcutId, "from", groupId);
  }

  async function addGroup(name) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var id = genId();
    var group = { id: id, name: name, shortcuts: [], deletedAt: null };
    ws.groups.push(group);
    ws.groupOrder.push(id);
    await saveAll(data);
    console.log("[LaunchPad] Group added:", name, "(" + id + ")");
    return group;
  }

  async function removeGroup(groupId) {
    if (groupId === "ungrouped") return;
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    ws.groups = ws.groups.filter(function (g) { return g.id !== groupId; });
    ws.groupOrder = ws.groupOrder.filter(function (id) { return id !== groupId; });
    await saveAll(data);
    console.log("[LaunchPad] Group removed:", groupId);
  }

  async function reorderShortcuts(groupId, orderedIds) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var group = ws.groups.find(function (g) { return g.id === groupId; });
    if (!group) return;
    var byId = new Map(group.shortcuts.map(function (s) { return [s.id, s]; }));
    group.shortcuts = orderedIds.map(function (id) { return byId.get(id); }).filter(Boolean);
    await saveAll(data);
  }

  async function reorderGroups(orderedGroupIds) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    ws.groupOrder = orderedGroupIds;
    await saveAll(data);
  }

  async function getBackground() {
    try {
      var result = await chrome.storage.local.get("launchpad_background");
      return result.launchpad_background || null;
    } catch (err) {
      console.error("[LaunchPad] Background read failed:", err);
      return null;
    }
  }

  async function saveBackground(bgData) {
    try {
      if (bgData) {
        await chrome.storage.local.set({ launchpad_background: bgData });
      } else {
        await chrome.storage.local.remove("launchpad_background");
      }
    } catch (err) {
      console.error("[LaunchPad] Background write failed:", err);
    }
  }

  async function getProAccessLevel() {
    if (typeof ProAccess === "undefined") {
      console.warn("[LaunchPad] ProAccess module not loaded");
      return "free";
    }
    var data = await getAll();
    return ProAccess.getProAccessLevel(data);
  }

  async function getOnboardingComplete() {
    try {
      var result = await chrome.storage.local.get("launchpad_onboarding");
      return !!result.launchpad_onboarding;
    } catch (err) {
      return false;
    }
  }

  async function setOnboardingComplete() {
    try {
      await chrome.storage.local.set({ launchpad_onboarding: true });
    } catch (err) {
      console.error("[LaunchPad] Failed to save onboarding flag:", err);
    }
  }

  // ===== Goals =====
  //
  // Goal CRUD on the Storage namespace, per docs/SPECS/tasks-and-goals.md.
  // No UI surface in [1.0.7]; the Tasks tab UI ([1.0.10]) hooks these later.
  // Verification path: console-callable via Storage.* (matches the
  // ProAccess.applyLicenseKey console pattern).
  //
  // Mutating helpers take the full `data` storage object plus an optional
  // workspaceId override (defaults to the active workspace). They persist
  // via saveAll before resolving. Read helpers take a workspace directly so
  // callers can iterate across workspaces without re-resolving.
  //
  // Soft-delete via deletedAt from day one — the Trash Bin UI lands later
  // and immediately has things to display. Goals with deletedAt !== null are
  // filtered out of every read function.
  //
  // Cascade hooks present but no-op until [1.0.8] / [1.0.9] populate the
  // tasks and tags slots. deleteGoal already iterates workspace.tasks and
  // workspace.tags looking for child records to soft-delete with the same
  // timestamp; once those data types exist, cascade activates without
  // touching this file.

  function genGoalId() {
    return "goal_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function resolveWorkspaceFromData(data, workspaceId) {
    if (!data || !Array.isArray(data.workspaces)) return null;
    if (workspaceId) {
      return data.workspaces.find(function (w) { return w.id === workspaceId; }) || null;
    }
    return getActiveWorkspace(data);
  }

  // ===== Workspace-shape array helpers =====
  //
  // Centralized lazy-init for workspace-shape arrays. Older workspace records
  // pre-date a given field and may have it missing or non-array. Each helper
  // guarantees the target field exists as an array on the passed object and
  // returns the array reference, so callers can read/iterate without the
  // scattered `(ws.foo || []).forEach(...)` defensive pattern that the
  // 2026-05-08 audit replaced.
  //
  // Shape mirrors ensureGoalsArray (the [1.0.7] pattern source): null-safe on
  // a missing object, lazy-init when the field is absent or non-array, return
  // the array reference. Same return semantics across all helpers — no
  // behavioral divergence beyond the target field name.

  function ensureGroupsArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.groups)) workspace.groups = [];
    return workspace.groups;
  }

  function ensureWorkspaceOrderArray(data) {
    if (!data) return null;
    if (!Array.isArray(data.workspaceOrder)) data.workspaceOrder = [];
    return data.workspaceOrder;
  }

  // Forward-looking stub for [1.0.14] (recurring task templates per
  // docs/SPECS/tasks-and-goals.md). Field landed early so the helper exists
  // before the feature does — saves a follow-up touch when [1.0.14] wires
  // template generation.
  function ensureRecurringTemplatesArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.recurringTemplates)) workspace.recurringTemplates = [];
    return workspace.recurringTemplates;
  }

  // Forward-looking stub for [1.0.15] (goal/task templates per
  // docs/SPECS/tasks-and-goals.md). Targets `taskTemplates` per the spec's
  // workspace data model — same field referenced in the free-tier downgrade
  // and storage-migration notes.
  function ensureGoalTemplatesArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.taskTemplates)) workspace.taskTemplates = [];
    return workspace.taskTemplates;
  }

  // Item-level helper: bookmarks (shortcuts) and groups both carry a tagIds
  // array under the [1.0.9.2] tag-on-item model. Distinct from the
  // workspace-level helpers above — this normalizes a single record, not a
  // workspace-scoped collection. Lazy-init so legacy records (pre-[1.0.9.2])
  // that never had tagIds set continue to work without a migration sweep.
  function ensureTagIdsArray(item) {
    if (!item) return null;
    if (!Array.isArray(item.tagIds)) item.tagIds = [];
    return item.tagIds;
  }

  function ensureGoalsArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.goals)) workspace.goals = [];
    return workspace.goals;
  }

  function findLiveGoal(workspace, goalId) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return null;
    var goal = goals.find(function (g) { return g.id === goalId; });
    if (!goal) return null;
    if (goal.deletedAt) return null;
    return goal;
  }

  function nextDisplayOrder(goals) {
    var max = 0;
    goals.forEach(function (g) {
      if (typeof g.displayOrder === "number" && g.displayOrder > max) max = g.displayOrder;
    });
    return max + 1;
  }

  /**
   * Create a goal in the (optionally specified) workspace.
   *
   * Auto-tag creation (extended in [1.0.9]):
   *   When `autoCreateTag` is true (default), an auto-tag is created inline
   *   with name = kebabCase(goal.name), color = `tagColor` if provided else
   *   the next palette rotation, and `autoGeneratedFromGoalId` set to the
   *   goal. `goal.autoTagId` is populated atomically with the goal in a
   *   single saveAll. If `tagColor` is provided but invalid, no goal is
   *   created (atomicity matches the rest of createGoal validation).
   *
   *   When `autoCreateTag` is false, `tagColor` is ignored entirely. Any
   *   `autoTagId` passed in `fields` is preserved as-is — useful for callers
   *   who already created a tag elsewhere. When `autoCreateTag` is true,
   *   the auto-creation overrides any provided `autoTagId`.
   *
   * @param {object} data — full storage object
   * @param {object} fields — { name (required, trimmed, non-empty), description?, deadlineAt?, autoTagId?, autoCreateTag? (default true), tagColor? (default null) }
   * @param {string} [workspaceId] — defaults to the active workspace
   * @returns {Promise<object|null>} the created goal, or null on validation failure
   */
  async function createGoal(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createGoal: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createGoal: name is required and must be non-empty after trim");
      return null;
    }
    var deadlineAt = (f.deadlineAt === null || f.deadlineAt === undefined) ? null : f.deadlineAt;
    if (deadlineAt !== null && typeof deadlineAt !== "number") {
      console.warn("[LaunchPad] createGoal: deadlineAt must be a number or null");
      return null;
    }
    var autoTagId = (f.autoTagId === undefined) ? null : f.autoTagId;
    if (autoTagId !== null && typeof autoTagId !== "string") {
      console.warn("[LaunchPad] createGoal: autoTagId must be a string or null");
      return null;
    }
    var description = (f.description === undefined || f.description === null) ? "" : String(f.description);

    var autoCreateTag = (f.autoCreateTag === undefined) ? true : !!f.autoCreateTag;
    var tagColor = (f.tagColor === undefined || f.tagColor === null) ? null : f.tagColor;

    // Atomicity: validate tagColor before any mutation. Invalid color → no goal,
    // no tag. tagColor is silently ignored when autoCreateTag is false.
    if (autoCreateTag && tagColor !== null) {
      if (typeof tagColor !== "string" || !isValidHexColor(tagColor)) {
        console.warn("[LaunchPad] createGoal: tagColor must match /^#[0-9A-Fa-f]{6}$/");
        return null;
      }
    }

    var goals = ensureGoalsArray(ws);
    var now = Date.now();
    var goal = {
      id: genGoalId(),
      name: name,
      description: description,
      deadlineAt: deadlineAt,
      status: "active",
      autoTagId: autoTagId,
      isCollapsed: false,
      createdAt: now,
      completedAt: null,
      deletedAt: null,
      displayOrder: nextDisplayOrder(goals)
    };

    // Auto-tag is created inline (shared saveAll). nextAutoTagColor counts both
    // live and soft-deleted auto-tags so deletions during the 30-day trash
    // window don't perturb the rotation index. tag name is derived from goal
    // name once at creation; subsequent renameGoal does NOT auto-rename the tag.
    if (autoCreateTag) {
      var tags = ensureTagsArray(ws);
      var tag = {
        id: genTagId(),
        name: kebabCase(name),
        color: tagColor !== null ? tagColor : nextAutoTagColor(ws),
        autoGeneratedFromGoalId: goal.id,
        createdAt: now,
        deletedAt: null
      };
      tags.push(tag);
      goal.autoTagId = tag.id;
    }

    goals.push(goal);
    await saveAll(data);
    return goal;
  }

  /**
   * Rename a goal. No-op + null return on empty / missing.
   * @returns {Promise<object|null>}
   */
  async function renameGoal(data, goalId, newName, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var name = typeof newName === "string" ? newName.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] renameGoal: newName must be non-empty after trim");
      return null;
    }
    if (goal.name === name) return goal;
    goal.name = name;
    await saveAll(data);
    return goal;
  }

  /**
   * Update a goal's description. Coerces to string. Empty string allowed.
   * @returns {Promise<object|null>}
   */
  async function updateGoalDescription(data, goalId, newDescription, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var desc = (newDescription === undefined || newDescription === null) ? "" : String(newDescription);
    if (goal.description === desc) return goal;
    goal.description = desc;
    await saveAll(data);
    return goal;
  }

  /**
   * Update a goal's deadline. Pass null to clear.
   * @returns {Promise<object|null>}
   */
  async function updateGoalDeadline(data, goalId, newDeadlineAt, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    if (newDeadlineAt !== null && newDeadlineAt !== undefined && typeof newDeadlineAt !== "number") {
      console.warn("[LaunchPad] updateGoalDeadline: newDeadlineAt must be a number or null");
      return null;
    }
    var v = (newDeadlineAt === undefined) ? null : newDeadlineAt;
    if (goal.deadlineAt === v) return goal;
    goal.deadlineAt = v;
    await saveAll(data);
    return goal;
  }

  /**
   * Mark a goal complete. Idempotent if already completed.
   * Called from [1.0.8]'s task-completion handler (when last incomplete child
   * finishes) or directly for manual "Mark complete" actions.
   * @returns {Promise<object|null>}
   */
  async function completeGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    if (goal.status === "completed") return goal;
    goal.status = "completed";
    goal.completedAt = Date.now();
    await saveAll(data);
    return goal;
  }

  /**
   * Reactivate a completed goal. Idempotent if already active.
   * @returns {Promise<object|null>}
   */
  async function reactivateGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    if (goal.status === "active") return goal;
    goal.status = "active";
    goal.completedAt = null;
    await saveAll(data);
    return goal;
  }

  /**
   * Soft-delete a goal via deletedAt. Returns metadata about cascaded child
   * records so callers can show "X tasks moved to trash" toasts in [1.0.10].
   *
   * Cascade hooks present but no-op in [1.0.7]: workspace.tasks and
   * workspace.tags don't have records yet. When [1.0.8] / [1.0.9] populate
   * those types, the same timestamp soft-deletes child tasks (goalId match)
   * and the auto-tag (autoGeneratedFromGoalId match) without further code
   * changes here.
   *
   * @returns {Promise<{ goal: object, cascadedTaskIds: string[], cascadedTagId: string|null }|null>}
   */
  async function deleteGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var now = Date.now();
    goal.deletedAt = now;

    var cascadedTaskIds = [];
    if (Array.isArray(ws.tasks)) {
      ws.tasks.forEach(function (t) {
        if (t && t.goalId === goalId && !t.deletedAt) {
          t.deletedAt = now;
          cascadedTaskIds.push(t.id);
        }
      });
    }

    var cascadedTagId = null;
    if (goal.autoTagId && Array.isArray(ws.tags)) {
      var tag = ws.tags.find(function (t) { return t && t.id === goal.autoTagId; });
      if (tag && !tag.deletedAt) {
        tag.deletedAt = now;
        cascadedTagId = tag.id;
      }
    }

    await saveAll(data);
    return { goal: goal, cascadedTaskIds: cascadedTaskIds, cascadedTagId: cascadedTagId };
  }

  /**
   * Active goals: deletedAt === null && status === 'active'.
   * Order preserved as stored (caller sorts by displayOrder if it cares).
   */
  function getActiveGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return !g.deletedAt && g.status === "active"; });
  }

  /**
   * Completed goals: deletedAt === null && status === 'completed'.
   */
  function getCompletedGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return !g.deletedAt && g.status === "completed"; });
  }

  /**
   * All non-deleted goals (active + completed).
   */
  function getAllGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return !g.deletedAt; });
  }

  /**
   * Lookup by id. Returns null if the goal is missing OR soft-deleted.
   * Returns the goal even if completed.
   */
  function getGoalById(workspace, goalId) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return null;
    var goal = goals.find(function (g) { return g.id === goalId; });
    if (!goal || goal.deletedAt) return null;
    return goal;
  }

  // ===== Tasks =====
  //
  // Task CRUD on the Storage namespace, mirroring the [1.0.7] goal CRUD shape.
  // No UI surface in [1.0.8]; the Tasks tab UI ([1.0.10]) hooks these later.
  // Verification path: console-callable via Storage.* (matches the
  // ProAccess.applyLicenseKey console pattern).
  //
  // Soft-delete via deletedAt from day one — every read filters out tombstoned
  // tasks. Cascade activation: [1.0.7]'s deleteGoal already iterates
  // workspace.tasks looking for matching goalId records; with tasks now
  // populated, that cascade activates organically without touching deleteGoal.
  //
  // Auto-completion: completeTask flips the parent goal to 'completed' inline
  // when the last incomplete sibling task in the same goal completes
  // (avoiding a double saveAll vs calling Storage.completeGoal). Symmetric
  // auto-reactivation: reactivateTask flips a 'completed' parent goal back
  // to 'active' so the system never sits in the awkward
  // "goal completed but has an incomplete child" state. completeTask and
  // reactivateTask return rich shapes (task + goal-flip metadata) so
  // [1.0.10]'s UI can fire goal-completion celebration animations without
  // re-querying state.
  //
  // Stub-but-stored fields: priority (no visual treatment until [1.0.12]),
  // tagIds (no auto-tag inheritance until [1.0.9]), isRecurringInstance +
  // recurringTemplateId (defaults; [1.0.14] populates). Data model is
  // complete from day one even though enforcement / UI lands later.
  //
  // Active task selection (data.activeTask top-level) is entirely [1.0.16]'s
  // territory — no Storage.setActiveTask here.

  var VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

  function genTaskId() {
    return "task_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function ensureTasksArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.tasks)) workspace.tasks = [];
    return workspace.tasks;
  }

  function findLiveTask(workspace, taskId) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return null;
    var task = tasks.find(function (t) { return t.id === taskId; });
    if (!task || task.deletedAt) return null;
    return task;
  }

  function nextTaskDisplayOrder(tasks) {
    var max = 0;
    tasks.forEach(function (t) {
      if (typeof t.displayOrder === "number" && t.displayOrder > max) max = t.displayOrder;
    });
    return max + 1;
  }

  function isValidPriority(p) {
    return p === null || VALID_PRIORITIES.indexOf(p) !== -1;
  }

  /**
   * Create a task in the (optionally specified) workspace.
   *
   * Tag inheritance (extended in [1.0.9]):
   *   When `tagIds` is omitted (undefined or null) AND `goalId` references a
   *   live goal AND that goal's `autoTagId` points to a live (non-deleted)
   *   tag, the new task's `tagIds` defaults to `[goal.autoTagId]`.
   *   Explicit `tagIds` (including `[]` for "no tags") is respected verbatim
   *   — empty array is "explicitly no tags", not "default". If the parent
   *   goal's `autoTagId` is null or points to a soft-deleted tag, tagIds
   *   defaults to `[]`.
   *
   * @param {object} data
   * @param {object} fields — { name (required), description?, goalId?, dueAt?, priority?, tagIds? }
   * @param {string} [workspaceId]
   * @returns {Promise<object|null>}
   */
  async function createTask(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createTask: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createTask: name is required and must be non-empty after trim");
      return null;
    }

    var goalId = (f.goalId === undefined) ? null : f.goalId;
    if (goalId !== null) {
      if (typeof goalId !== "string") {
        console.warn("[LaunchPad] createTask: goalId must be a string or null");
        return null;
      }
      if (!findLiveGoal(ws, goalId)) {
        console.warn("[LaunchPad] createTask: goalId does not reference a live goal:", goalId);
        return null;
      }
    }

    var dueAt = (f.dueAt === undefined) ? null : f.dueAt;
    if (dueAt !== null && typeof dueAt !== "number") {
      console.warn("[LaunchPad] createTask: dueAt must be a number or null");
      return null;
    }

    var priority = (f.priority === undefined) ? null : f.priority;
    if (!isValidPriority(priority)) {
      console.warn("[LaunchPad] createTask: priority must be one of 'low'|'medium'|'high'|'urgent'|null");
      return null;
    }

    // Inheritance: undefined / null tagIds + live parent goal with live
    // autoTagId → default to [autoTagId]. Explicit tagIds (including [])
    // respected as-is — empty array means "explicitly no tags", not "default".
    var tagIds;
    if (f.tagIds === undefined || f.tagIds === null) {
      tagIds = [];
      if (goalId !== null) {
        var parentGoal = findLiveGoal(ws, goalId);
        if (parentGoal && parentGoal.autoTagId && findLiveTag(ws, parentGoal.autoTagId)) {
          tagIds = [parentGoal.autoTagId];
        }
      }
    } else if (!Array.isArray(f.tagIds)) {
      console.warn("[LaunchPad] createTask: tagIds must be an array of strings");
      return null;
    } else if (!f.tagIds.every(function (t) { return typeof t === "string"; })) {
      console.warn("[LaunchPad] createTask: tagIds must contain only strings");
      return null;
    } else {
      tagIds = f.tagIds.slice();
    }

    var description = (f.description === undefined || f.description === null) ? "" : String(f.description);

    var tasks = ensureTasksArray(ws);
    var task = {
      id: genTaskId(),
      name: name,
      description: description,
      goalId: goalId,
      dueAt: dueAt,
      priority: priority,
      tagIds: tagIds,
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
      deletedAt: null,
      displayOrder: nextTaskDisplayOrder(tasks),
      isRecurringInstance: false,
      recurringTemplateId: null
    };
    tasks.push(task);
    await saveAll(data);
    return task;
  }

  /**
   * Rename a task. Returns null if missing / soft-deleted / empty name.
   * @returns {Promise<object|null>}
   */
  async function renameTask(data, taskId, newName, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    var name = typeof newName === "string" ? newName.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] renameTask: newName must be non-empty after trim");
      return null;
    }
    if (task.name === name) return task;
    task.name = name;
    await saveAll(data);
    return task;
  }

  /**
   * Update a task's description. Coerces to string. Empty allowed.
   * @returns {Promise<object|null>}
   */
  async function updateTaskDescription(data, taskId, newDescription, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    var desc = (newDescription === undefined || newDescription === null) ? "" : String(newDescription);
    if (task.description === desc) return task;
    task.description = desc;
    await saveAll(data);
    return task;
  }

  /**
   * Update a task's due date. Pass null to clear.
   * @returns {Promise<object|null>}
   */
  async function updateTaskDueAt(data, taskId, newDueAt, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (newDueAt !== null && newDueAt !== undefined && typeof newDueAt !== "number") {
      console.warn("[LaunchPad] updateTaskDueAt: newDueAt must be a number or null");
      return null;
    }
    var v = (newDueAt === undefined) ? null : newDueAt;
    if (task.dueAt === v) return task;
    task.dueAt = v;
    await saveAll(data);
    return task;
  }

  /**
   * Update a task's priority. Accepts 'low'|'medium'|'high'|'urgent'|null.
   * @returns {Promise<object|null>}
   */
  async function updateTaskPriority(data, taskId, newPriority, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (!isValidPriority(newPriority)) {
      console.warn("[LaunchPad] updateTaskPriority: newPriority must be one of 'low'|'medium'|'high'|'urgent'|null");
      return null;
    }
    if (task.priority === newPriority) return task;
    task.priority = newPriority;
    await saveAll(data);
    return task;
  }

  /**
   * Complete a task. If this completes the last incomplete sibling under an
   * active parent goal, the goal flips to 'completed' inline (same timestamp,
   * single saveAll). Idempotent: re-calling on a completed task returns the
   * task with goalAutoCompleted=false.
   *
   * @returns {Promise<{ task: object, goalAutoCompleted: boolean, autoCompletedGoal: object|null }|null>}
   */
  async function completeTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (task.completed) {
      return { task: task, goalAutoCompleted: false, autoCompletedGoal: null };
    }
    var now = Date.now();
    task.completed = true;
    task.completedAt = now;

    var goalAutoCompleted = false;
    var autoCompletedGoal = null;
    if (task.goalId) {
      var goal = findLiveGoal(ws, task.goalId);
      if (goal && goal.status === "active") {
        var siblings = (ws.tasks || []).filter(function (t) {
          return t.goalId === task.goalId && !t.deletedAt;
        });
        var allComplete = siblings.length > 0 && siblings.every(function (t) { return t.completed; });
        if (allComplete) {
          goal.status = "completed";
          goal.completedAt = now;
          goalAutoCompleted = true;
          autoCompletedGoal = goal;
        }
      }
    }

    await saveAll(data);
    return { task: task, goalAutoCompleted: goalAutoCompleted, autoCompletedGoal: autoCompletedGoal };
  }

  /**
   * Reactivate a completed task. If the parent goal is currently 'completed',
   * the goal flips back to 'active' inline (single saveAll). Symmetric
   * inverse of auto-completion. Idempotent on already-active tasks.
   *
   * @returns {Promise<{ task: object, goalAutoReactivated: boolean, autoReactivatedGoal: object|null }|null>}
   */
  async function reactivateTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (!task.completed) {
      return { task: task, goalAutoReactivated: false, autoReactivatedGoal: null };
    }
    task.completed = false;
    task.completedAt = null;

    var goalAutoReactivated = false;
    var autoReactivatedGoal = null;
    if (task.goalId) {
      var goal = findLiveGoal(ws, task.goalId);
      if (goal && goal.status === "completed") {
        goal.status = "active";
        goal.completedAt = null;
        goalAutoReactivated = true;
        autoReactivatedGoal = goal;
      }
    }

    await saveAll(data);
    return { task: task, goalAutoReactivated: goalAutoReactivated, autoReactivatedGoal: autoReactivatedGoal };
  }

  /**
   * Duplicate a task as a "(copy)" variant. Preserves description, goalId,
   * dueAt, priority, tagIds. Resets completion state, timestamps, and
   * recurring-instance fields. Returns the new task.
   *
   * @returns {Promise<object|null>}
   */
  async function duplicateTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var orig = findLiveTask(ws, taskId);
    if (!orig) return null;
    var tasks = ensureTasksArray(ws);
    var copy = {
      id: genTaskId(),
      name: orig.name + " (copy)",
      description: orig.description,
      goalId: orig.goalId,
      dueAt: orig.dueAt,
      priority: orig.priority,
      tagIds: Array.isArray(orig.tagIds) ? orig.tagIds.slice() : [],
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
      deletedAt: null,
      displayOrder: nextTaskDisplayOrder(tasks),
      isRecurringInstance: false,
      recurringTemplateId: null
    };
    tasks.push(copy);
    await saveAll(data);
    return copy;
  }

  /**
   * Soft-delete a task via deletedAt. No cascade — tasks don't have children.
   * @returns {Promise<object|null>}
   */
  async function deleteTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    task.deletedAt = Date.now();
    await saveAll(data);
    return task;
  }

  /**
   * Move a task to a different goal, or to standalone (newGoalIdOrNull = null).
   * Validates the target goal is live when non-null.
   *
   * @returns {Promise<object|null>}
   */
  async function moveTaskToGoal(data, taskId, newGoalIdOrNull, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    var target = (newGoalIdOrNull === undefined) ? null : newGoalIdOrNull;
    if (target !== null) {
      if (typeof target !== "string") {
        console.warn("[LaunchPad] moveTaskToGoal: newGoalId must be a string or null");
        return null;
      }
      if (!findLiveGoal(ws, target)) {
        console.warn("[LaunchPad] moveTaskToGoal: target goal not found or soft-deleted:", target);
        return null;
      }
    }
    if (task.goalId === target) return task;
    task.goalId = target;
    await saveAll(data);
    return task;
  }

  /**
   * Active tasks: !deletedAt && !completed.
   */
  function getActiveTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return !t.deletedAt && !t.completed; });
  }

  /**
   * Completed tasks: !deletedAt && completed.
   */
  function getCompletedTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return !t.deletedAt && t.completed; });
  }

  /**
   * All non-deleted tasks (active + completed).
   */
  function getAllTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return !t.deletedAt; });
  }

  /**
   * Lookup by id. Returns null if missing OR soft-deleted.
   */
  function getTaskById(workspace, taskId) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return null;
    var task = tasks.find(function (t) { return t.id === taskId; });
    if (!task || task.deletedAt) return null;
    return task;
  }

  // ===== Tags =====
  //
  // Tag CRUD on the Storage namespace, mirroring the [1.0.7] goal CRUD and
  // [1.0.8] task CRUD shape. No UI surface in [1.0.9] — Pro Settings tags
  // section, right-click attach to bookmarks/groups, and pill rendering on
  // bookmarks/groups land in [1.0.9.1]; tag picker UX in task detail panel
  // lands in [1.0.10]; tag-based filtering in [1.0.12]. Verification path:
  // console-callable via Storage.* (matches the ProAccess.applyLicenseKey
  // console pattern).
  //
  // Soft-delete via deletedAt from day one — every read except getAllTags
  // filters out tombstoned tags. deleteTag does NOT cascade-clear tagIds
  // from items: per spec (`tasks-and-goals.md` Tag deletion section), items
  // retain tag IDs with a dimmed "archived tag" badge until the 30-day
  // trash auto-purge sweeps them. deleteTag here is a pure soft-delete.
  //
  // Cross-cutting wiring:
  //  - createGoal (Goals section) auto-creates a tag inline by default
  //    (autoCreateTag flag), with kebab-case name + rotating palette color.
  //  - createTask (Tasks section) inherits parent goal's autoTagId when
  //    tagIds is omitted; explicit tagIds (including []) respected verbatim.
  //  - deleteGoal's existing iteration over workspace.tags now activates
  //    organically: any tag where autoGeneratedFromGoalId === goal.id is
  //    soft-deleted with the same timestamp, populating cascadedTagId.
  //
  // Tag name decoupling: tag name is derived from goal name once at goal
  // creation. Subsequent renameGoal does NOT auto-rename the tag. User can
  // rename the tag via Pro Settings ([1.0.9.1]) if they want them to match.
  // See DECISIONS.md 2026-04-27 entry for the tradeoff vs auto-rename.

  // 8-color palette for auto-tag rotation. Picked to match the spec example
  // (#4A90E2 first) and provide enough perceptual separation across the
  // wheel for adjacent goals to be distinguishable. Indexed via
  // nextAutoTagColor; user override at goal creation bypasses but does not
  // halt the rotation counter (every auto-tag creation advances the index).
  var TAG_PALETTE = [
    "#4A90E2", // blue
    "#7ED321", // green
    "#F5A623", // orange
    "#D0021B", // red
    "#9013FE", // purple
    "#50E3C2", // teal
    "#F8E71C", // yellow
    "#BD10E0"  // magenta
  ];

  var HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

  function genTagId() {
    return "tag_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function ensureTagsArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.tags)) workspace.tags = [];
    return workspace.tags;
  }

  function findLiveTag(workspace, tagId) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return null;
    var tag = tags.find(function (t) { return t.id === tagId; });
    if (!tag || tag.deletedAt) return null;
    return tag;
  }

  function isValidHexColor(color) {
    return typeof color === "string" && HEX_COLOR_REGEX.test(color);
  }

  // Lowercase, alphanumerics joined by single dash, leading/trailing dashes
  // trimmed, runs of non-alphanumerics collapsed. "Ship LaunchPad Pro v1"
  // → "ship-launchpad-pro-v1". Used for auto-tag name derivation at goal
  // creation; not exported.
  function kebabCase(str) {
    if (typeof str !== "string") return "";
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Counts both live and soft-deleted auto-tags so deletions during the
  // 30-day trash window don't perturb the rotation index. Only auto-tags
  // (autoGeneratedFromGoalId is a string) advance the counter — manual tags
  // share the rotation as a default but don't shift it for future autos.
  function nextAutoTagColor(workspace) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return TAG_PALETTE[0];
    var autoCount = tags.filter(function (t) {
      return t && typeof t.autoGeneratedFromGoalId === "string";
    }).length;
    return TAG_PALETTE[autoCount % TAG_PALETTE.length];
  }

  /**
   * Create a tag in the (optionally specified) workspace. Used internally by
   * createGoal's auto-tag flow and externally for manual tag CRUD.
   *
   * @param {object} data
   * @param {object} fields — { name (required, trimmed, non-empty), color? (default = next palette rotation), autoGeneratedFromGoalId? (default null) }
   * @param {string} [workspaceId]
   * @returns {Promise<object|null>}
   */
  async function createTag(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createTag: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createTag: name is required and must be non-empty after trim");
      return null;
    }

    var color;
    if (f.color === undefined || f.color === null) {
      color = nextAutoTagColor(ws);
    } else if (!isValidHexColor(f.color)) {
      console.warn("[LaunchPad] createTag: color must match /^#[0-9A-Fa-f]{6}$/");
      return null;
    } else {
      color = f.color;
    }

    var autoGeneratedFromGoalId = (f.autoGeneratedFromGoalId === undefined) ? null : f.autoGeneratedFromGoalId;
    if (autoGeneratedFromGoalId !== null && typeof autoGeneratedFromGoalId !== "string") {
      console.warn("[LaunchPad] createTag: autoGeneratedFromGoalId must be a string or null");
      return null;
    }

    var tags = ensureTagsArray(ws);
    var tag = {
      id: genTagId(),
      name: name,
      color: color,
      autoGeneratedFromGoalId: autoGeneratedFromGoalId,
      createdAt: Date.now(),
      deletedAt: null
    };
    tags.push(tag);
    await saveAll(data);
    return tag;
  }

  /**
   * Rename a tag. No-op + null on missing / soft-deleted / empty name.
   * Names are not unique within a workspace — duplicates allowed (separate IDs).
   * @returns {Promise<object|null>}
   */
  async function renameTag(data, tagId, newName, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tag = findLiveTag(ws, tagId);
    if (!tag) return null;
    var name = typeof newName === "string" ? newName.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] renameTag: newName must be non-empty after trim");
      return null;
    }
    if (tag.name === name) return tag;
    tag.name = name;
    await saveAll(data);
    return tag;
  }

  /**
   * Update a tag's color. Validates against /^#[0-9A-Fa-f]{6}$/.
   * @returns {Promise<object|null>}
   */
  async function updateTagColor(data, tagId, newColor, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tag = findLiveTag(ws, tagId);
    if (!tag) return null;
    if (!isValidHexColor(newColor)) {
      console.warn("[LaunchPad] updateTagColor: newColor must match /^#[0-9A-Fa-f]{6}$/");
      return null;
    }
    if (tag.color === newColor) return tag;
    tag.color = newColor;
    await saveAll(data);
    return tag;
  }

  /**
   * Soft-delete a tag via deletedAt. Pure soft-delete: items retaining the
   * tag ID get a dimmed "archived tag" badge per spec; the 30-day trash
   * auto-purge eventually clears tag IDs from items. No cascade here.
   * @returns {Promise<object|null>}
   */
  async function deleteTag(data, tagId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tag = findLiveTag(ws, tagId);
    if (!tag) return null;
    tag.deletedAt = Date.now();
    await saveAll(data);
    return tag;
  }

  /**
   * Active (non-deleted) tags.
   */
  function getActiveTags(workspace) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return [];
    return tags.filter(function (t) { return !t.deletedAt; });
  }

  /**
   * Every tag including soft-deleted ones. Caller filters as needed.
   */
  function getAllTags(workspace) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return [];
    return tags.slice();
  }

  /**
   * Lookup by id. Returns null if missing OR soft-deleted.
   */
  function getTagById(workspace, tagId) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return null;
    var tag = tags.find(function (t) { return t.id === tagId; });
    if (!tag || tag.deletedAt) return null;
    return tag;
  }

  /**
   * First live tag with the given name. Returns null if no live tag matches
   * (or input isn't a string). Tag names are not unique — duplicates return
   * the first match in storage order.
   */
  function getTagByName(workspace, name) {
    if (typeof name !== "string") return null;
    var tags = ensureTagsArray(workspace);
    if (!tags) return null;
    var found = tags.find(function (t) { return !t.deletedAt && t.name === name; });
    return found || null;
  }

  return {
    getDefaultData: getDefaultData,
    getAll: getAll,
    saveAll: saveAll,
    migrate: migrate,
    emptyTrackingState: emptyTrackingState,
    getActiveWorkspace: getActiveWorkspace,
    getActiveWorkspaceIndex: getActiveWorkspaceIndex,
    addShortcut: addShortcut,
    removeShortcut: removeShortcut,
    addGroup: addGroup,
    removeGroup: removeGroup,
    reorderShortcuts: reorderShortcuts,
    reorderGroups: reorderGroups,
    getBackground: getBackground,
    saveBackground: saveBackground,
    getProAccessLevel: getProAccessLevel,
    getOnboardingComplete: getOnboardingComplete,
    setOnboardingComplete: setOnboardingComplete,
    // Workspace-shape array helpers (lazy-init on read)
    ensureGroupsArray: ensureGroupsArray,
    ensureWorkspaceOrderArray: ensureWorkspaceOrderArray,
    ensureRecurringTemplatesArray: ensureRecurringTemplatesArray,
    ensureGoalTemplatesArray: ensureGoalTemplatesArray,
    // Item-level helper (bookmarks + groups, [1.0.9.2])
    ensureTagIdsArray: ensureTagIdsArray,
    // Goals (Pro tasks layer — see docs/SPECS/tasks-and-goals.md)
    createGoal: createGoal,
    renameGoal: renameGoal,
    updateGoalDescription: updateGoalDescription,
    updateGoalDeadline: updateGoalDeadline,
    completeGoal: completeGoal,
    reactivateGoal: reactivateGoal,
    deleteGoal: deleteGoal,
    getActiveGoals: getActiveGoals,
    getCompletedGoals: getCompletedGoals,
    getAllGoals: getAllGoals,
    getGoalById: getGoalById,
    // Tasks (Pro tasks layer — see docs/SPECS/tasks-and-goals.md)
    createTask: createTask,
    renameTask: renameTask,
    updateTaskDescription: updateTaskDescription,
    updateTaskDueAt: updateTaskDueAt,
    updateTaskPriority: updateTaskPriority,
    completeTask: completeTask,
    reactivateTask: reactivateTask,
    duplicateTask: duplicateTask,
    deleteTask: deleteTask,
    moveTaskToGoal: moveTaskToGoal,
    getActiveTasks: getActiveTasks,
    getCompletedTasks: getCompletedTasks,
    getAllTasks: getAllTasks,
    getTaskById: getTaskById,
    // Tags (Pro tasks layer — see docs/SPECS/tasks-and-goals.md)
    TAG_PALETTE: TAG_PALETTE,
    createTag: createTag,
    renameTag: renameTag,
    updateTagColor: updateTagColor,
    deleteTag: deleteTag,
    getActiveTags: getActiveTags,
    getAllTags: getAllTags,
    getTagById: getTagById,
    getTagByName: getTagByName,
    nextAutoTagColor: nextAutoTagColor
  };
})();
