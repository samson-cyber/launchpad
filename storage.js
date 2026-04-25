/* global chrome */

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
    getOnboardingComplete: getOnboardingComplete,
    setOnboardingComplete: setOnboardingComplete
  };
})();
