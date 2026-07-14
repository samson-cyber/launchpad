/* global chrome, ProAccess */

var Storage = (function () {
  "use strict";

  // [1.0.11.2] Write-provenance: same-page storage writes tag themselves so the
  // newtab onChanged listener can skip its full render() for our OWN writes
  // (the user action that triggered the write already updated the DOM
  // optimistically; re-rendering wipes DOM-only state like sidebar expansion).
  // TAB_INSTANCE_ID identifies this page; _pendingWriteIds holds writeIds we
  // emitted but the listener has not yet acknowledged. Listener compares both,
  // and only writes that match THIS tab AND a known writeId are suppressed.
  // See newtab.js chrome.storage.onChanged for the gate.
  var TAB_INSTANCE_ID = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  var _pendingWriteIds = new Set();

  function genWriteId() {
    return (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  }

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
        instanceId: null,
        instanceName: null,
        email: null,
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
        instanceId: null,
        instanceName: null,
        email: null,
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
      // [1.0.11.2] Tag this write so the newtab's onChanged listener can
      // distinguish OWN writes from foreign ones (other tab, service worker).
      // Both keys land in the same chrome.storage.local.set call so they
      // arrive atomically in a single onChanged event.
      var writeId = genWriteId();
      _pendingWriteIds.add(writeId);
      await chrome.storage.local.set({
        data: data,
        __lastWrite: { tab: TAB_INSTANCE_ID, writeId: writeId, ts: Date.now() }
      });
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
   *   [1.0.9.2] round 7: when `autoCreateTag` is true and an ACTIVE tag
   *   already exists whose name kebab-cases to the same form as the goal
   *   name, that tag is REUSED instead of creating a duplicate. The reused
   *   tag's `autoGeneratedFromGoalId` is cleared if it was tied to a
   *   different goal (the tag becomes shared, no longer 1:1-tied to any
   *   single goal). Soft-deleted tags are skipped — same active-only policy
   *   as round 6 manual-tag dedup. `tagColor` is silently ignored on reuse;
   *   the existing tag's color stands.
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
    //
    // [1.0.9.2] round 7: auto-tag dedup. Before pushing a new auto-tag, scan
    // ACTIVE tags for a kebab-form collision so manual tags whose
    // case/whitespace happens to render to the same kebab as the candidate
    // auto-tag are reused (manual "Work Tasks" → kebab "work-tasks" matches
    // auto for goal "Work Tasks"). Soft-deleted tags are skipped — same
    // active-only policy as round 6 manual-tag dedup. On reuse, if the
    // existing tag was tied to another goal (autoGeneratedFromGoalId is a
    // string), clear it so the tag becomes shared-not-owned and the
    // originating goal's deletion no longer cascades a tag this new goal
    // depends on. The deleteGoal cascade below was tightened in the same
    // round to require autoGeneratedFromGoalId === goal.id, so cleared ties
    // mean the reused tag survives both goals' deletions.
    //
    // renameGoal intentionally does NOT participate in this dedup — the
    // 2026-04-27 tag-name decoupling rule keeps the auto-tag name fixed at
    // goal-creation time. See DECISIONS.md 2026-05-09 (round 7) for why.
    if (autoCreateTag) {
      var tags = ensureTagsArray(ws);
      var candidateKebab = kebabCase(name);
      var existing = null;
      for (var ti = 0; ti < tags.length; ti++) {
        var t = tags[ti];
        if (!t || t.deletedAt) continue;
        if (typeof t.name !== "string") continue;
        if (kebabCase(t.name) === candidateKebab) {
          existing = t;
          break;
        }
      }
      if (existing) {
        if (typeof existing.autoGeneratedFromGoalId === "string" && existing.autoGeneratedFromGoalId !== goal.id) {
          existing.autoGeneratedFromGoalId = null;
        }
        goal.autoTagId = existing.id;
      } else {
        var tag = {
          id: genTagId(),
          name: candidateKebab,
          color: tagColor !== null ? tagColor : nextAutoTagColor(ws),
          autoGeneratedFromGoalId: goal.id,
          createdAt: now,
          deletedAt: null
        };
        tags.push(tag);
        goal.autoTagId = tag.id;
      }
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
   * Toggle the goal's collapse state. Used by the [1.0.11] Tasks tab goal
   * card chevron — when true, the UI hides the goal's child task list and
   * the "+ Add task" affordance, leaving the header (name, auto-tag pill,
   * deadline + overdue badge, progress bar) visible. Persisted to storage
   * so the state survives reloads and syncs across tabs via storage.onChanged.
   * Existing goals (pre-[1.0.11]) without the field render as expanded via
   * the render-time `goal.isCollapsed === true` strict check — no migration.
   * @returns {Promise<object|null>}
   */
  async function updateGoalCollapsed(data, goalId, isCollapsed, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var v = !!isCollapsed;
    if (goal.isCollapsed === v) return goal;
    goal.isCollapsed = v;
    await saveAll(data);
    return goal;
  }

  /**
   * Renumber active goals' displayOrder values to match the order of the
   * provided id list. Used by the [1.0.11.1] Tasks tab goal drag-to-reorder
   * — Sortable's onUpdate handler reads the new DOM order, then this method
   * persists by mapping each id to its index (0, 1, 2, ...). Single saveAll
   * for the whole batch.
   *
   * Validation rejects the call (returns null without writing) if:
   *   - orderedGoalIds is not an array of strings,
   *   - any id is missing from the workspace's goals,
   *   - any id refers to a soft-deleted goal (deletedAt set), or
   *   - any id refers to a non-active goal (status !== "active").
   *
   * Goals NOT in orderedGoalIds keep their existing displayOrder. Callers
   * are expected to pass the full active set so the resulting indexes are
   * dense; otherwise the omitted goals will collide with the new indexes.
   * @returns {Promise<object[]|null>} the workspace's goals array on success
   */
  async function reorderGoals(data, orderedGoalIds, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return null;
    if (!Array.isArray(orderedGoalIds)) {
      console.warn("[LaunchPad] reorderGoals: orderedGoalIds must be an array");
      return null;
    }
    var goals = ensureGoalsArray(ws);
    var goalById = {};
    goals.forEach(function (g) { goalById[g.id] = g; });
    for (var i = 0; i < orderedGoalIds.length; i++) {
      var id = orderedGoalIds[i];
      if (typeof id !== "string") {
        console.warn("[LaunchPad] reorderGoals: every id must be a string");
        return null;
      }
      var g = goalById[id];
      if (!g) {
        console.warn("[LaunchPad] reorderGoals: id not found in workspace: " + id);
        return null;
      }
      if (g.deletedAt) {
        console.warn("[LaunchPad] reorderGoals: id refers to a soft-deleted goal: " + id);
        return null;
      }
      if (g.status !== "active") {
        console.warn("[LaunchPad] reorderGoals: id refers to a non-active goal: " + id);
        return null;
      }
    }
    for (var j = 0; j < orderedGoalIds.length; j++) {
      goalById[orderedGoalIds[j]].displayOrder = j;
    }
    await saveAll(data);
    return goals;
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

    // [1.0.9.2] round 7: cascade tightened. Only soft-delete the tag if it's
    // still tied to THIS goal (autoGeneratedFromGoalId === goalId). Reused
    // tags have autoGeneratedFromGoalId cleared in createGoal's dedup block
    // so they survive the originating goal's deletion when other goals
    // depend on them. Manual tags (autoGeneratedFromGoalId === null) are
    // also preserved — never cascade-delete a tag the user created by hand,
    // even if some goal happens to reference it via autoTagId.
    var cascadedTagId = null;
    if (goal.autoTagId && Array.isArray(ws.tags)) {
      var tag = ws.tags.find(function (t) { return t && t.id === goal.autoTagId; });
      if (tag && !tag.deletedAt && tag.autoGeneratedFromGoalId === goalId) {
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
   * Soft-deleted (trashed) goals: deletedAt !== null. Powers the Tasks-tab
   * Deleted box. Not sorted here — the caller orders by deletedAt.
   */
  function getDeletedGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return g.deletedAt != null; });
  }

  /**
   * Restore a soft-deleted goal (deletedAt -> null). Per trash-bin.md the goal
   * returns to the goals list; its separately-trashed child tasks stay trashed
   * (they carry their own deletedAt and are restored individually). Finds the
   * goal regardless of deleted state (findLiveGoal would skip it). Idempotent on
   * an already-live goal. @returns {Promise<object|null>}
   */
  async function restoreGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goals = ws && ws.goals;
    if (!Array.isArray(goals)) return null;
    var goal = goals.find(function (g) { return g && g.id === goalId; });
    if (!goal) return null;
    if (goal.deletedAt == null) return goal;
    goal.deletedAt = null;
    await saveAll(data);
    return goal;
  }

  /**
   * Permanently delete a goal — hard splice from ws.goals, no recovery. The
   * ONLY delete that is irreversible (per trash-bin.md, permanent delete is the
   * only action that confirms; the caller shows the modal). Removes just the
   * goal record; any cascade-trashed child tasks keep their own deletedAt and
   * remain as their own Deleted-box rows / purge on their own schedule.
   * @returns {Promise<boolean>} true if a goal was removed.
   */
  async function deleteGoalPermanent(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goals = ws && ws.goals;
    if (!Array.isArray(goals)) return false;
    var idx = goals.findIndex(function (g) { return g && g.id === goalId; });
    if (idx === -1) return false;
    goals.splice(idx, 1);
    await saveAll(data);
    return true;
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

  /**
   * [1.0.11.14] Auto-tag resolution for a goal in the active workspace.
   * Pure function over `data`. Returns the goal's autoTagId string or
   * null if the goal is missing, soft-deleted, or has no auto-tag bound.
   * Used by reassignTaskToGoal's auto-tag swap math. Defensive: returns
   * null on any missing input rather than throwing, so callers can
   * treat "source goal deleted mid-drag" as "no source auto-tag to
   * remove" without branching.
   */
  function getGoalAutoTagId(data, goalId) {
    if (goalId === null || goalId === undefined) return null;
    var ws = resolveWorkspaceFromData(data);
    if (!ws) return null;
    var goal = getGoalById(ws, goalId);
    if (!goal) return null;
    return goal.autoTagId || null;
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
   * Restore a soft-deleted task (deletedAt -> null). Counterpart to deleteTask;
   * used by the 5-second Undo toast on direct delete and the Tasks-tab Deleted
   * box. Finds the task regardless of deleted state (findLiveTask would skip it).
   * Idempotent on an already-live task.
   *
   * Restore homing (trash-bin.md): task -> parent goal if that goal is still
   * live; if the parent goal is trashed or purged, the task becomes standalone
   * (goalId -> null) so it lands in the Standalone section rather than dangling
   * under a goal that no longer renders. The Undo path is unaffected in practice
   * (the parent goal is virtually always still live moments after deletion).
   * @returns {Promise<object|null>}
   */
  async function restoreTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tasks = ws && ws.tasks;
    if (!Array.isArray(tasks)) return null;
    var task = tasks.find(function (t) { return t && t.id === taskId; });
    if (!task) return null;
    if (task.deletedAt == null) return task;
    task.deletedAt = null;
    // Re-home to standalone if the parent goal is no longer live.
    if (task.goalId != null && !findLiveGoal(ws, task.goalId)) {
      task.goalId = null;
    }
    await saveAll(data);
    return task;
  }

  /**
   * Soft-deleted (trashed) tasks: deletedAt !== null. Powers the Tasks-tab
   * Deleted box. Not sorted here — the caller orders by deletedAt.
   */
  function getDeletedTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return t.deletedAt != null; });
  }

  /**
   * Permanently delete a task — hard splice from ws.tasks, no recovery. The
   * only irreversible delete (the caller confirms via modal per trash-bin.md).
   * @returns {Promise<boolean>} true if a task was removed.
   */
  async function deleteTaskPermanent(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tasks = ws && ws.tasks;
    if (!Array.isArray(tasks)) return false;
    var idx = tasks.findIndex(function (t) { return t && t.id === taskId; });
    if (idx === -1) return false;
    tasks.splice(idx, 1);
    await saveAll(data);
    return true;
  }

  // 30-day trash retention (trash-bin.md Auto-Purge).
  var TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  /**
   * Opportunistic trash cleanup for the Tasks-tab surface: hard-remove goals and
   * tasks in the given (or active) workspace whose deletedAt is older than 30
   * days, before the Deleted box renders. This is the "opportunistic cleanup on
   * trash view open" from trash-bin.md, scoped to the two types this surface
   * shows; the full daily cross-type, cross-workspace alarm sweep (groups,
   * bookmarks, tags, other workspaces) is a separate Backlog task.
   *
   * The array splices run SYNCHRONOUSLY (before the first await), so a caller
   * that invokes this without awaiting still reads the purged arrays on the very
   * next line. saveAll only runs when something was actually removed, so calling
   * this on every render does not amplify writes. @returns {Promise<number>}
   * count removed.
   */
  async function purgeExpiredTrash(data, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return 0;
    var cutoff = Date.now() - TRASH_TTL_MS;
    var removed = 0;
    var expired = function (item) {
      return item && item.deletedAt != null && item.deletedAt < cutoff;
    };
    if (Array.isArray(ws.goals)) {
      for (var gi = ws.goals.length - 1; gi >= 0; gi--) {
        if (expired(ws.goals[gi])) { ws.goals.splice(gi, 1); removed++; }
      }
    }
    if (Array.isArray(ws.tasks)) {
      for (var ti = ws.tasks.length - 1; ti >= 0; ti--) {
        if (expired(ws.tasks[ti])) { ws.tasks.splice(ti, 1); removed++; }
      }
    }
    if (removed > 0) {
      await saveAll(data);
      console.log("[LaunchPad] Trash purge removed " + removed + " expired item(s)");
    }
    return removed;
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

  // [1.0.11.14] Cross-goal drag support for Tasks tab. The storage layer
  // for [1.0.11.2] Commit 1 — the SortableJS wiring and the name-collision
  // modal land in Commit 2. Three functions here:
  //   - hasTaskNameCollision: pure predicate, used by the modal to decide
  //     whether to prompt and used by reassignTaskToGoal to validate any
  //     resolved name still doesn't collide.
  //   - generateUniqueTaskName: pure, "name", "name (2)", "name (3)" walk;
  //     bumps an existing trailing " (N)" rather than appending a fresh
  //     " (2)". Used by callers that want auto-resolve without prompting.
  //   - reassignTaskToGoal: atomic mutation — goalId, tagIds (auto-tag
  //     swap), optional rename — followed by a single saveAll(). Throws
  //     on invalid input (rather than the warn+null pattern moveTaskToGoal
  //     uses) so the drag-end handler in Commit 2 surfaces problems
  //     loudly instead of silently no-op'ing on a typo.
  //
  // moveTaskToGoal stays as-is for callers that only need goalId
  // mutation without the auto-tag swap.

  /**
   * Trim-and-compare-case-sensitive collision check.
   * targetGoalId === null scopes to standalone tasks (task.goalId === null).
   * excludeTaskId is omitted from the search (so the dragged task does
   * not collide with itself).
   * Returns false when the active workspace has no tasks array.
   */
  function hasTaskNameCollision(data, name, targetGoalId, excludeTaskId) {
    if (typeof name !== "string") return false;
    var trimmed = name.trim();
    if (!trimmed) return false;
    var ws = resolveWorkspaceFromData(data);
    if (!ws) return false;
    var tasks = ensureTasksArray(ws);
    if (!tasks) return false;
    var scope = (targetGoalId === undefined) ? null : targetGoalId;
    return tasks.some(function (t) {
      if (!t || t.deletedAt) return false;
      if (excludeTaskId && t.id === excludeTaskId) return false;
      if (t.goalId !== scope) return false;
      return (typeof t.name === "string") && t.name.trim() === trimmed;
    });
  }

  /**
   * "name", "name (2)", "name (3)" suffix walk. Returns baseName
   * unchanged when no collision. If baseName already ends in " (N)",
   * increments N rather than appending a fresh " (2)".
   * Bounded by the finite number of tasks in the workspace.
   */
  function generateUniqueTaskName(data, baseName, targetGoalId, excludeTaskId) {
    if (typeof baseName !== "string") return baseName;
    var trimmed = baseName.trim();
    if (!trimmed) return baseName;
    if (!hasTaskNameCollision(data, trimmed, targetGoalId, excludeTaskId)) return trimmed;
    var match = trimmed.match(/^(.*?) \((\d+)\)$/);
    var root, n;
    if (match) {
      root = match[1];
      n = parseInt(match[2], 10) + 1;
    } else {
      root = trimmed;
      n = 2;
    }
    while (true) {
      var candidate = root + " (" + n + ")";
      if (!hasTaskNameCollision(data, candidate, targetGoalId, excludeTaskId)) return candidate;
      n++;
    }
  }

  /**
   * Atomic cross-goal task reassignment.
   *
   * - newGoalId === null moves the task to the standalone bucket.
   * - opts.newName, when present, renames the task in the same write.
   *
   * Auto-tag swap: removes the source goal's autoTagId (if any) and
   * adds the destination goal's autoTagId (if any). Set semantics
   * handle the edge cases:
   *   - source and target share the same auto-tag → delete-then-add
   *     leaves the tag present (only goalId changes).
   *   - task already carries the target auto-tag → Set.add is idempotent.
   *   - source goal soft-deleted mid-drag → getGoalAutoTagId returns
   *     null, delete is a no-op.
   *
   * Single Storage.saveAll() at the end — the [1.0.11.2] own-write
   * provenance gate handles the resulting onChanged correctly.
   *
   * Throws (rather than returning null) on invalid input so the
   * Commit 2 drag-end handler surfaces problems loudly:
   *   - taskId not found / soft-deleted in the active workspace
   *   - newGoalId non-null but not a string OR not a live goal
   *   - opts.newName present but not a non-empty trimmed string
   *
   * @returns {Promise<object>} the updated task
   */
  async function reassignTaskToGoal(data, taskId, newGoalId, opts) {
    var options = opts || {};
    var ws = resolveWorkspaceFromData(data);
    if (!ws) throw new Error("reassignTaskToGoal: active workspace not found");
    var task = findLiveTask(ws, taskId);
    if (!task) throw new Error("reassignTaskToGoal: task not found: " + taskId);
    if (newGoalId !== null) {
      if (typeof newGoalId !== "string") {
        throw new Error("reassignTaskToGoal: newGoalId must be a string or null");
      }
      if (!findLiveGoal(ws, newGoalId)) {
        throw new Error("reassignTaskToGoal: target goal not found or soft-deleted: " + newGoalId);
      }
    }
    if (options.newName !== undefined) {
      if (typeof options.newName !== "string" || options.newName.trim().length === 0) {
        throw new Error("reassignTaskToGoal: opts.newName must be a non-empty string");
      }
    }

    var sourceAutoTagId = getGoalAutoTagId(data, task.goalId);
    var targetAutoTagId = getGoalAutoTagId(data, newGoalId);

    var newTags = new Set(Array.isArray(task.tagIds) ? task.tagIds : []);
    if (sourceAutoTagId) newTags.delete(sourceAutoTagId);
    if (targetAutoTagId) newTags.add(targetAutoTagId);

    task.goalId = newGoalId;
    task.tagIds = Array.from(newTags);
    if (options.newName !== undefined) task.name = options.newName.trim();

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

  // ===== Due-date hierarchy checks ([1.0.13]) =====
  //
  // Pure, read-only conflict checks that sit IN FRONT OF updateTaskDueAt /
  // updateGoalDeadline. No mutation, no saveAll — callers branch on the
  // returned descriptor, then call the existing updater with the resolved
  // value. checkTaskDueConflict also serves 1.0.14's recurring drag-into-goal
  // check (it ships here unwired to a UI commit point; the task-side 3-button
  // modal lands in 1.0.13.1 against a real call site).
  //
  // Day-comparison basis: dueAt and deadlineAt are both stored as UTC-midnight
  // epoch ms (newtab.js parseDateInputToTs -> Date.UTC). Normalize BOTH sides
  // to their UTC calendar day; only a strictly-later UTC day is a conflict,
  // the same UTC day is not. Do NOT floor to local midnight — that shifts the
  // day by one for users behind UTC (a UTC-midnight stamp reads as the prior
  // local day).
  function utcDay(ts) {
    var d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  /**
   * Would setting task.dueAt to candidateDueAt push it past its parent goal's
   * deadline (strictly-later UTC day)? Fires regardless of the task's own
   * completed state. Pure read — no mutation, no saveAll.
   *
   * No-conflict when: task missing, standalone (goalId == null), candidate
   * null, parent goal missing or deadline-less, or candidate day on/before the
   * goal-deadline day.
   *
   * @returns {{ conflict: boolean, goalId: string|null, goalName: string|null,
   *   goalDeadlineAt: number|null, candidateDueAt: number|null }}
   */
  function checkTaskDueConflict(data, taskId, candidateDueAt, workspaceId) {
    var noConflict = {
      conflict: false, goalId: null, goalName: null,
      goalDeadlineAt: null, candidateDueAt: candidateDueAt
    };
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return noConflict;
    var task = getTaskById(ws, taskId);
    if (!task || task.goalId == null || candidateDueAt == null) return noConflict;
    var goal = getGoalById(ws, task.goalId);
    if (!goal || goal.deadlineAt == null) return noConflict;
    if (utcDay(candidateDueAt) <= utcDay(goal.deadlineAt)) return noConflict;
    return {
      conflict: true, goalId: goal.id, goalName: goal.name,
      goalDeadlineAt: goal.deadlineAt, candidateDueAt: candidateDueAt
    };
  }

  /**
   * Would setting goal.deadlineAt to candidateDeadlineAt land before the latest
   * due date among the goal's constraining children? Constraining children =
   * live (getAllTasks already excludes deletedAt), incomplete, goalId match,
   * dueAt != null. Completed / soft-deleted / null-due children are ignored.
   * Pure read — no mutation, no saveAll.
   *
   * Not blocked when the candidate is null or no constraining child's due day
   * is strictly after the candidate day.
   *
   * @returns {{ blocked: boolean, blockingTaskId: string|null,
   *   blockingTaskName: string|null, blockingDueAt: number|null,
   *   candidateDeadlineAt: number|null }}
   */
  function checkGoalDeadlineConflict(data, goalId, candidateDeadlineAt, workspaceId) {
    var notBlocked = {
      blocked: false, blockingTaskId: null, blockingTaskName: null,
      blockingDueAt: null, candidateDeadlineAt: candidateDeadlineAt
    };
    if (candidateDeadlineAt == null) return notBlocked;
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return notBlocked;
    var children = getAllTasks(ws).filter(function (t) {
      return t.goalId === goalId && !t.completed && t.dueAt != null;
    });
    if (!children.length) return notBlocked;
    var latest = children.reduce(function (a, b) { return b.dueAt > a.dueAt ? b : a; });
    if (utcDay(latest.dueAt) > utcDay(candidateDeadlineAt)) {
      return {
        blocked: true, blockingTaskId: latest.id, blockingTaskName: latest.name,
        blockingDueAt: latest.dueAt, candidateDeadlineAt: candidateDeadlineAt
      };
    }
    return notBlocked;
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

  // [1.0.9.2] round 6: case-insensitive trim-equal duplicate-name check across
  // ACTIVE tags only. Soft-deleted tags don't block reuse — they're awaiting
  // the day-30 trash auto-purge and the user's intent is to rebind the name.
  // excludeTagId lets renameTag skip the tag being renamed (so a no-op rename
  // and case-only changes on the same tag don't trip the check). Auto-tag
  // creation in createGoal pushes directly to workspace.tags and bypasses this
  // check intentionally — auto-tag uniqueness is a separate concern (kebab
  // collisions across goals) and out of scope here.
  function isDuplicateTagName(workspace, name, excludeTagId) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return false;
    var normalized = name.trim().toLowerCase();
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (!t || t.deletedAt) continue;
      if (excludeTagId && t.id === excludeTagId) continue;
      if (typeof t.name === "string" && t.name.trim().toLowerCase() === normalized) {
        return true;
      }
    }
    return false;
  }

  function duplicateTagError(name) {
    return { err: "duplicate", message: "A tag named '" + name + "' already exists in this workspace." };
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
   * [1.0.9.2] round 6: rejects case-insensitive trim-equal duplicate names
   * within the workspace's ACTIVE tags. Returns { err: "duplicate", message }
   * on conflict; null on other validation failures (empty name, bad color);
   * the tag on success.
   *
   * @param {object} data
   * @param {object} fields — { name (required, trimmed, non-empty), color? (default = next palette rotation), autoGeneratedFromGoalId? (default null) }
   * @param {string} [workspaceId]
   * @returns {Promise<object|{err:string,message:string}|null>}
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
    if (isDuplicateTagName(ws, name, null)) {
      return duplicateTagError(name);
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
   * [1.0.9.2] round 6: tightened to reject case-insensitive trim-equal
   * duplicates against active tags (excluding self). Returns
   * { err: "duplicate", message } on conflict; returns the tag on success
   * (including no-op rename to the same name and case-only changes on the
   * same tag).
   * @returns {Promise<object|{err:string,message:string}|null>}
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
    if (isDuplicateTagName(ws, name, tagId)) {
      return duplicateTagError(name);
    }
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

  // ===== Recurring Task Templates =====
  //
  // Schema-only landing in [1.0.10] per the PLAN (D2). The Tasks tab in
  // [1.0.10] consumes getAllRecurringTemplates / getActiveRecurringTemplates
  // for read-only rendering of the Recurring section. The chrome.alarms
  // sweep that materializes instances into workspace.tasks lands in [1.0.14]
  // and reads nextScheduledAt; nothing here touches alarms.
  //
  // Per-workspace, mirroring goals / tasks / tags. ensureRecurringTemplatesArray
  // already exists upstream as a forward-looking stub; this section gives it
  // its first real consumer. Soft-delete via deletedAt from day one — same
  // pattern as Goal/Task CRUD, ready for the Trash Bin UI.
  //
  // Schema follows the PLAN's recurring template definition: name, frequency
  // ('daily'|'weekly'|'monthly'), daysOfWeek (only for weekly), dayOfMonth
  // (only for monthly), timeOfDay (HH:mm 24-hour), nextScheduledAt
  // (populated by [1.0.14]), isActive, tagIds, plus the standard
  // createdAt / updatedAt / deletedAt fields. workspaceId is implicit via the
  // workspace.recurringTemplates collection — no FK field needed.

  var VALID_RECURRING_FREQUENCIES = ["daily", "weekly", "monthly"];
  var TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

  function genRecurringTemplateId() {
    return "rtmpl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function findLiveRecurringTemplate(workspace, templateId) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return null;
    var t = arr.find(function (x) { return x.id === templateId; });
    if (!t || t.deletedAt) return null;
    return t;
  }

  function isValidTimeOfDay(s) {
    return typeof s === "string" && TIME_OF_DAY_REGEX.test(s);
  }

  // Validates the frequency-specific fields together so the caller can't end
  // up with a 'weekly' template missing daysOfWeek or a 'monthly' template
  // missing dayOfMonth. Returns null on success, an { err, message } shape
  // on failure (matching the createTag duplicate-name return pattern).
  function validateRecurringPattern(frequency, daysOfWeek, dayOfMonth) {
    if (VALID_RECURRING_FREQUENCIES.indexOf(frequency) === -1) {
      return { err: "invalid_frequency", message: "frequency must be 'daily', 'weekly', or 'monthly'." };
    }
    if (frequency === "weekly") {
      if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
        return { err: "weekly_requires_days", message: "Weekly templates require at least one day-of-week." };
      }
      for (var i = 0; i < daysOfWeek.length; i++) {
        var d = daysOfWeek[i];
        if (typeof d !== "number" || d < 0 || d > 6 || (d | 0) !== d) {
          return { err: "invalid_day_of_week", message: "daysOfWeek values must be integers 0-6." };
        }
      }
    } else if (frequency === "monthly") {
      if (typeof dayOfMonth !== "number" || dayOfMonth < 1 || dayOfMonth > 31 || (dayOfMonth | 0) !== dayOfMonth) {
        return { err: "invalid_day_of_month", message: "Monthly templates require dayOfMonth as an integer 1-31." };
      }
    }
    return null;
  }

  /**
   * Create a recurring template in the (optionally specified) workspace.
   *
   * @param {object} data — full storage object
   * @param {object} fields — { name (required), frequency (required), daysOfWeek?, dayOfMonth?, timeOfDay? (default "09:00"), isActive? (default true), tagIds? (default []), nextScheduledAt? (default null) }
   * @param {string} [workspaceId] — defaults to active workspace
   * @returns {Promise<object|{err:string,message:string}|null>}
   */
  async function createRecurringTemplate(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createRecurringTemplate: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createRecurringTemplate: name is required and must be non-empty after trim");
      return null;
    }

    var frequency = f.frequency;
    var daysOfWeek = (f.daysOfWeek === undefined) ? null : f.daysOfWeek;
    var dayOfMonth = (f.dayOfMonth === undefined) ? null : f.dayOfMonth;
    var patternErr = validateRecurringPattern(frequency, daysOfWeek, dayOfMonth);
    if (patternErr) {
      console.warn("[LaunchPad] createRecurringTemplate:", patternErr.message);
      return patternErr;
    }

    // timeOfDay defaults to 09:00. [1.0.14]'s alarm sweep needs a time-of-day
    // anchor to compute the next scheduled occurrence; null would force every
    // caller to default it themselves.
    var timeOfDay = (f.timeOfDay === undefined || f.timeOfDay === null) ? "09:00" : f.timeOfDay;
    if (!isValidTimeOfDay(timeOfDay)) {
      console.warn("[LaunchPad] createRecurringTemplate: timeOfDay must match HH:mm 24-hour");
      return null;
    }

    var isActive = (f.isActive === undefined) ? true : !!f.isActive;

    var tagIds;
    if (f.tagIds === undefined || f.tagIds === null) {
      tagIds = [];
    } else if (!Array.isArray(f.tagIds) || !f.tagIds.every(function (t) { return typeof t === "string"; })) {
      console.warn("[LaunchPad] createRecurringTemplate: tagIds must be an array of strings");
      return null;
    } else {
      tagIds = f.tagIds.slice();
    }

    var nextScheduledAt = (f.nextScheduledAt === undefined) ? null : f.nextScheduledAt;
    if (nextScheduledAt !== null && typeof nextScheduledAt !== "number") {
      console.warn("[LaunchPad] createRecurringTemplate: nextScheduledAt must be a number or null");
      return null;
    }

    var arr = ensureRecurringTemplatesArray(ws);
    var now = Date.now();
    // Normalize the off-frequency fields so a 'daily' template doesn't carry
    // a stale daysOfWeek and a 'weekly' template doesn't carry a stale
    // dayOfMonth. Keeps the stored shape stable for downstream code in
    // [1.0.14] reading these fields without a frequency check.
    var template = {
      id: genRecurringTemplateId(),
      name: name,
      frequency: frequency,
      daysOfWeek: frequency === "weekly" ? daysOfWeek.slice() : null,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : null,
      timeOfDay: timeOfDay,
      nextScheduledAt: nextScheduledAt,
      isActive: isActive,
      tagIds: tagIds,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    arr.push(template);
    await saveAll(data);
    return template;
  }

  /**
   * Patch an existing recurring template. Only the fields present on the
   * `updates` object are applied; everything else preserved. Frequency-related
   * fields validated together when frequency is touched.
   *
   * @returns {Promise<object|{err:string,message:string}|null>}
   */
  async function updateRecurringTemplate(data, templateId, updates, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var template = findLiveRecurringTemplate(ws, templateId);
    if (!template) return null;
    var u = updates || {};

    if (Object.prototype.hasOwnProperty.call(u, "name")) {
      var name = typeof u.name === "string" ? u.name.trim() : "";
      if (!name) {
        console.warn("[LaunchPad] updateRecurringTemplate: name must be non-empty after trim");
        return null;
      }
      template.name = name;
    }

    // Frequency / daysOfWeek / dayOfMonth re-validate together: re-resolve
    // each field from the update or fall back to the stored value, then run
    // the joint pattern validator. Caller can change frequency without
    // re-supplying the off-frequency fields (we just clear them).
    var touchedPattern =
      Object.prototype.hasOwnProperty.call(u, "frequency") ||
      Object.prototype.hasOwnProperty.call(u, "daysOfWeek") ||
      Object.prototype.hasOwnProperty.call(u, "dayOfMonth");
    if (touchedPattern) {
      var freq = Object.prototype.hasOwnProperty.call(u, "frequency") ? u.frequency : template.frequency;
      var dow = Object.prototype.hasOwnProperty.call(u, "daysOfWeek")
        ? u.daysOfWeek
        : template.daysOfWeek;
      var dom = Object.prototype.hasOwnProperty.call(u, "dayOfMonth")
        ? u.dayOfMonth
        : template.dayOfMonth;
      var patternErr = validateRecurringPattern(freq, dow, dom);
      if (patternErr) {
        console.warn("[LaunchPad] updateRecurringTemplate:", patternErr.message);
        return patternErr;
      }
      template.frequency = freq;
      template.daysOfWeek = freq === "weekly" ? dow.slice() : null;
      template.dayOfMonth = freq === "monthly" ? dom : null;
    }

    if (Object.prototype.hasOwnProperty.call(u, "timeOfDay")) {
      if (!isValidTimeOfDay(u.timeOfDay)) {
        console.warn("[LaunchPad] updateRecurringTemplate: timeOfDay must match HH:mm 24-hour");
        return null;
      }
      template.timeOfDay = u.timeOfDay;
    }

    if (Object.prototype.hasOwnProperty.call(u, "isActive")) {
      template.isActive = !!u.isActive;
    }

    if (Object.prototype.hasOwnProperty.call(u, "tagIds")) {
      if (u.tagIds === null) {
        template.tagIds = [];
      } else if (!Array.isArray(u.tagIds) || !u.tagIds.every(function (t) { return typeof t === "string"; })) {
        console.warn("[LaunchPad] updateRecurringTemplate: tagIds must be an array of strings");
        return null;
      } else {
        template.tagIds = u.tagIds.slice();
      }
    }

    if (Object.prototype.hasOwnProperty.call(u, "nextScheduledAt")) {
      if (u.nextScheduledAt !== null && typeof u.nextScheduledAt !== "number") {
        console.warn("[LaunchPad] updateRecurringTemplate: nextScheduledAt must be a number or null");
        return null;
      }
      template.nextScheduledAt = u.nextScheduledAt;
    }

    template.updatedAt = Date.now();
    await saveAll(data);
    return template;
  }

  /**
   * Soft-delete a recurring template. Existing instances already materialized
   * into workspace.tasks remain untouched (per spec: "Deleting template
   * trashes the template. Existing instances remain as individual tasks.").
   *
   * @returns {Promise<object|null>}
   */
  async function deleteRecurringTemplate(data, templateId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var template = findLiveRecurringTemplate(ws, templateId);
    if (!template) return null;
    template.deletedAt = Date.now();
    await saveAll(data);
    return template;
  }

  /**
   * Active recurring templates: !deletedAt && isActive.
   */
  function getActiveRecurringTemplates(workspace) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return [];
    return arr.filter(function (t) { return !t.deletedAt && t.isActive; });
  }

  /**
   * All non-deleted recurring templates (active + paused).
   */
  function getAllRecurringTemplates(workspace) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return [];
    return arr.filter(function (t) { return !t.deletedAt; });
  }

  /**
   * Lookup by id. Returns null if missing OR soft-deleted.
   */
  function getRecurringTemplateById(workspace, templateId) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return null;
    var t = arr.find(function (x) { return x.id === templateId; });
    if (!t || t.deletedAt) return null;
    return t;
  }

  return {
    // [1.0.11.2] Write-provenance hooks — see saveAll() above.
    TAB_INSTANCE_ID: TAB_INSTANCE_ID,
    _pendingWriteIds: _pendingWriteIds,
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
    updateGoalCollapsed: updateGoalCollapsed,
    reorderGoals: reorderGoals,
    completeGoal: completeGoal,
    reactivateGoal: reactivateGoal,
    deleteGoal: deleteGoal,
    restoreGoal: restoreGoal,
    deleteGoalPermanent: deleteGoalPermanent,
    getActiveGoals: getActiveGoals,
    getCompletedGoals: getCompletedGoals,
    getAllGoals: getAllGoals,
    getDeletedGoals: getDeletedGoals,
    getGoalById: getGoalById,
    getGoalAutoTagId: getGoalAutoTagId,
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
    restoreTask: restoreTask,
    deleteTaskPermanent: deleteTaskPermanent,
    getDeletedTasks: getDeletedTasks,
    purgeExpiredTrash: purgeExpiredTrash,
    moveTaskToGoal: moveTaskToGoal,
    reassignTaskToGoal: reassignTaskToGoal,
    hasTaskNameCollision: hasTaskNameCollision,
    generateUniqueTaskName: generateUniqueTaskName,
    getActiveTasks: getActiveTasks,
    getCompletedTasks: getCompletedTasks,
    getAllTasks: getAllTasks,
    getTaskById: getTaskById,
    // Due-date hierarchy checks ([1.0.13]) — pure reads, no mutation
    checkTaskDueConflict: checkTaskDueConflict,
    checkGoalDeadlineConflict: checkGoalDeadlineConflict,
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
    nextAutoTagColor: nextAutoTagColor,
    // Recurring task templates ([1.0.10] schema landing; [1.0.14] adds
    // alarm-driven instance materialization)
    createRecurringTemplate: createRecurringTemplate,
    updateRecurringTemplate: updateRecurringTemplate,
    deleteRecurringTemplate: deleteRecurringTemplate,
    getActiveRecurringTemplates: getActiveRecurringTemplates,
    getAllRecurringTemplates: getAllRecurringTemplates,
    getRecurringTemplateById: getRecurringTemplateById
  };
})();
