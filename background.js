/* global chrome */

function getDefaultData() {
  return {
    groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [] }],
    groupOrder: ["ungrouped"],
    settings: { columns: 6 }
  };
}

async function buildContextMenu() {
  await chrome.contextMenus.removeAll();

  var result = await chrome.storage.local.get("data");
  var data = result.data || getDefaultData();
  var groupMap = {};
  data.groups.forEach(function (g) { groupMap[g.id] = g; });

  // Parent item
  chrome.contextMenus.create({
    id: "add-to-launchpad",
    title: "Add to LaunchPad",
    contexts: ["page", "link"]
  });

  // Child items for each group, in groupOrder
  var ordered = (data.groupOrder || [])
    .map(function (id) { return groupMap[id]; })
    .filter(Boolean);

  ordered.forEach(function (group) {
    chrome.contextMenus.create({
      id: "add-to-group_" + group.id,
      parentId: "add-to-launchpad",
      title: group.name,
      contexts: ["page", "link"]
    });
  });

  // Separator + New Group
  chrome.contextMenus.create({
    id: "add-to-group_separator",
    parentId: "add-to-launchpad",
    type: "separator",
    contexts: ["page", "link"]
  });

  chrome.contextMenus.create({
    id: "add-to-group_new",
    parentId: "add-to-launchpad",
    title: "+ New Group...",
    contexts: ["page", "link"]
  });

  console.log("[LaunchPad] Context menu rebuilt with", ordered.length, "group(s)");
}

// ===== Session Saving System =====

function getTodayKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

async function saveCurrentSession() {
  try {
    var tabs = await chrome.tabs.query({});
    var windows = {};
    tabs.forEach(function (tab) {
      if (/^chrome:\/\/|^chrome-extension:\/\//.test(tab.url || "")) return;
      if (!windows[tab.windowId]) windows[tab.windowId] = [];
      var domain;
      try { domain = new URL(tab.url).hostname; } catch (e) { domain = ""; }
      windows[tab.windowId].push({
        url: tab.url,
        title: tab.title || "",
        favicon: "https://icons.duckduckgo.com/ip3/" + domain + ".ico"
      });
    });
    var windowList = Object.keys(windows).map(function (wid) {
      return { tabs: windows[wid] };
    }).filter(function (w) { return w.tabs.length > 0; });
    if (!windowList.length) return;

    var result = await chrome.storage.local.get("savedSessions");
    var saved = result.savedSessions || {};
    var todayKey = getTodayKey();
    saved[todayKey] = { windows: windowList, timestamp: Date.now() };
    await chrome.storage.local.set({ savedSessions: saved });
    console.log("[LaunchPad] Session saved for", todayKey, ":", windowList.length, "window(s)");
  } catch (err) {
    console.error("[LaunchPad] Failed to save session:", err);
  }
}

async function pruneOldSessions() {
  try {
    var result = await chrome.storage.local.get("savedSessions");
    var saved = result.savedSessions || {};
    // Remove legacy keys
    delete saved.current;
    delete saved.previous;
    var keys = Object.keys(saved).sort().reverse();
    if (keys.length > 7) {
      keys.slice(7).forEach(function (k) { delete saved[k]; });
      await chrome.storage.local.set({ savedSessions: saved });
      console.log("[LaunchPad] Pruned old sessions, keeping", Math.min(keys.length, 7), "days");
    }
  } catch (err) {
    console.error("[LaunchPad] Failed to prune sessions:", err);
  }
}

// Build on install / startup
chrome.runtime.onInstalled.addListener(function () {
  buildContextMenu();
  chrome.alarms.create("save-session", { periodInMinutes: 5 });
  saveCurrentSession();
});
chrome.runtime.onStartup.addListener(function () {
  buildContextMenu();
  chrome.alarms.create("save-session", { periodInMinutes: 5 });
  saveCurrentSession();
  pruneOldSessions();
});

// Rebuild when storage changes (groups added/renamed/deleted)
chrome.storage.onChanged.addListener(function (changes) {
  if (changes.data) {
    buildContextMenu();
  }
});

// Handle clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  var menuId = info.menuItemId;
  if (typeof menuId !== "string" || !menuId.startsWith("add-to-group_")) return;

  try {
    var url = info.linkUrl || info.pageUrl || (tab && tab.url) || "";
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      console.warn("[LaunchPad] Skipping unsupported URL:", url);
      return;
    }

    var title = info.linkUrl
      ? (info.linkUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || info.linkUrl)
      : ((tab && tab.title) || url);

    var domain;
    try { domain = new URL(url).hostname; } catch (e) { domain = url; }
    var favicon = "https://icons.duckduckgo.com/ip3/" + domain + ".ico";

    var shortcut = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url: url,
      title: title,
      favicon: favicon,
      addedAt: Date.now()
    };

    var result = await chrome.storage.local.get("data");
    var data = result.data || getDefaultData();

    var targetGroupId = menuId.replace("add-to-group_", "");
    var targetGroup;

    if (targetGroupId === "new") {
      // Create a new group
      var newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      targetGroup = { id: newId, name: "New Group", shortcuts: [] };
      data.groups.push(targetGroup);
      data.groupOrder.push(newId);
    } else {
      targetGroup = data.groups.find(function (g) { return g.id === targetGroupId; });
      if (!targetGroup) {
        // Fallback to ungrouped
        targetGroup = data.groups.find(function (g) { return g.id === "ungrouped"; });
        if (!targetGroup) {
          targetGroup = { id: "ungrouped", name: "Ungrouped", shortcuts: [] };
          data.groups.push(targetGroup);
          data.groupOrder.push("ungrouped");
        }
      }
    }

    targetGroup.shortcuts.push(shortcut);
    await chrome.storage.local.set({ data: data });
    console.log("[LaunchPad] Shortcut added to", targetGroup.name, ":", shortcut.title);
  } catch (err) {
    console.error("[LaunchPad] Failed to add shortcut:", err);
  }
});

// Save session periodically via alarm
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "save-session") {
    saveCurrentSession();
  }
});

// Save session when a window closes
chrome.windows.onRemoved.addListener(function () {
  saveCurrentSession();
});
