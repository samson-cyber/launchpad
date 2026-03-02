/* global chrome */

function getDefaultData() {
  return {
    groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [] }],
    groupOrder: ["ungrouped"],
    settings: { theme: "system", columns: 6 }
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

// Build on install / startup
chrome.runtime.onInstalled.addListener(function () {
  buildContextMenu();
});
chrome.runtime.onStartup.addListener(function () {
  buildContextMenu();
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
    var favicon = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=64";

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
