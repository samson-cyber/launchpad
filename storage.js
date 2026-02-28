/* global chrome */

var Storage = (function () {
  "use strict";

  function getDefaultData() {
    return {
      groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [] }],
      groupOrder: ["ungrouped"],
      settings: { theme: "system", columns: 6 }
    };
  }

  async function getAll() {
    try {
      var result = await chrome.storage.local.get("data");
      return result.data || getDefaultData();
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
    var group = data.groups.find(function (g) { return g.id === groupId; });
    if (!group) {
      console.warn("[LaunchPad] addShortcut: group not found:", groupId);
      return;
    }
    shortcut.id = shortcut.id ||
      Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    shortcut.addedAt = shortcut.addedAt || Date.now();
    group.shortcuts.push(shortcut);
    await saveAll(data);
    console.log("[LaunchPad] Shortcut added to", groupId, ":", shortcut.title || shortcut.url);
    return shortcut;
  }

  async function removeShortcut(groupId, shortcutId) {
    var data = await getAll();
    var group = data.groups.find(function (g) { return g.id === groupId; });
    if (!group) return;
    group.shortcuts = group.shortcuts.filter(function (s) { return s.id !== shortcutId; });
    await saveAll(data);
    console.log("[LaunchPad] Shortcut removed:", shortcutId, "from", groupId);
  }

  async function addGroup(name) {
    var data = await getAll();
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var group = { id: id, name: name, shortcuts: [] };
    data.groups.push(group);
    data.groupOrder.push(id);
    await saveAll(data);
    console.log("[LaunchPad] Group added:", name, "(" + id + ")");
    return group;
  }

  async function removeGroup(groupId) {
    if (groupId === "ungrouped") return;
    var data = await getAll();
    data.groups = data.groups.filter(function (g) { return g.id !== groupId; });
    data.groupOrder = data.groupOrder.filter(function (id) { return id !== groupId; });
    await saveAll(data);
    console.log("[LaunchPad] Group removed:", groupId);
  }

  async function reorderShortcuts(groupId, orderedIds) {
    var data = await getAll();
    var group = data.groups.find(function (g) { return g.id === groupId; });
    if (!group) return;
    var byId = new Map(group.shortcuts.map(function (s) { return [s.id, s]; }));
    group.shortcuts = orderedIds.map(function (id) { return byId.get(id); }).filter(Boolean);
    await saveAll(data);
  }

  async function reorderGroups(orderedGroupIds) {
    var data = await getAll();
    data.groupOrder = orderedGroupIds;
    await saveAll(data);
  }

  return {
    getDefaultData: getDefaultData,
    getAll: getAll,
    saveAll: saveAll,
    addShortcut: addShortcut,
    removeShortcut: removeShortcut,
    addGroup: addGroup,
    removeGroup: removeGroup,
    reorderShortcuts: reorderShortcuts,
    reorderGroups: reorderGroups
  };
})();
