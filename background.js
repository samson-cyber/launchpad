/* global chrome, importScripts, Storage */

importScripts('storage.js');
importScripts('tracking-prototype.js');

var DOMAIN_ALIASES = {
  'outlook.live.com': 'microsoft-mail',
  'outlook.cloud.microsoft': 'microsoft-mail',
  'outlook.office.com': 'microsoft-mail',
  'outlook.office365.com': 'microsoft-mail',
  'mail.google.com': 'google-mail',
  'gmail.com': 'google-mail',
  'facebook.com': 'meta',
  'www.facebook.com': 'meta',
  'adsmanager.facebook.com': 'meta-ads',
  'business.facebook.com': 'meta-ads',
  'ads.google.com': 'google-ads',
  'docs.google.com': 'google-docs',
  'sheets.google.com': 'google-docs',
  'slides.google.com': 'google-docs',
  'drive.google.com': 'google-docs'
};

function getMatchKeyBg(url) {
  try {
    var hostname = new URL(url).hostname;
    if (DOMAIN_ALIASES[hostname]) return DOMAIN_ALIASES[hostname];
    return hostname;
  } catch (e) { return null; }
}

async function buildContextMenu() {
  try {
    await chrome.contextMenus.removeAll();

    var data = await Storage.getAll();
    var ws = Storage.getActiveWorkspace(data);
    var groups = (ws && ws.groups) || [];
    var groupOrder = (ws && ws.groupOrder) || [];
    var groupMap = {};
    groups.forEach(function (g) { groupMap[g.id] = g; });

    chrome.contextMenus.create({
      id: "add-to-launchpad",
      title: "Add to LaunchPad",
      contexts: ["page", "link"]
    });

    var ordered = groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean);

    groups.forEach(function (g) {
      if (!ordered.find(function (o) { return o.id === g.id; })) {
        ordered.push(g);
      }
    });

    ordered.forEach(function (group) {
      chrome.contextMenus.create({
        id: "add-to-group_" + group.id,
        parentId: "add-to-launchpad",
        title: group.name,
        contexts: ["page", "link"]
      });
    });

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
  } catch (err) {
    console.error("[LaunchPad] Failed to build context menu:", err);
  }
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
      var tabFavicon = (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://"))
        ? tab.favIconUrl
        : "https://www.google.com/s2/favicons?domain=" + domain + "&sz=128";
      windows[tab.windowId].push({
        url: tab.url,
        title: tab.title || "",
        favicon: tabFavicon
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

chrome.storage.onChanged.addListener(function (changes) {
  if (changes.data) {
    buildContextMenu();
  }
});

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

    var favicon;
    if (!info.linkUrl && tab && tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
      favicon = tab.favIconUrl;
    } else {
      favicon = "https://www.google.com/s2/favicons?domain=" + domain + "&sz=128";
    }

    var shortcut = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url: url,
      title: title,
      favicon: favicon,
      addedAt: Date.now(),
      deletedAt: null
    };

    var data = await Storage.getAll();
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) {
      console.warn("[LaunchPad] No active workspace; cannot add shortcut");
      return;
    }

    var targetGroupId = menuId.replace("add-to-group_", "");
    var targetGroup;

    if (targetGroupId === "new") {
      var newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      targetGroup = { id: newId, name: "New Group", shortcuts: [], deletedAt: null };
      ws.groups.push(targetGroup);
      ws.groupOrder.push(newId);
    } else {
      targetGroup = ws.groups.find(function (g) { return g.id === targetGroupId; });
      if (!targetGroup) {
        targetGroup = ws.groups.find(function (g) { return g.id === "ungrouped"; });
        if (!targetGroup) {
          targetGroup = { id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null };
          ws.groups.push(targetGroup);
          ws.groupOrder.push("ungrouped");
        }
      }
    }

    var matchKey = getMatchKeyBg(url);
    var existingMatch = null;
    targetGroup.shortcuts.forEach(function (s) {
      if (!existingMatch) {
        var sKey = getMatchKeyBg(s.url);
        if (sKey && matchKey && sKey === matchKey) existingMatch = s;
      }
    });

    if (existingMatch) {
      if (!existingMatch.variants) existingMatch.variants = [];
      var variantTitle = shortcut.title;
      try {
        var variantPath = new URL(url).pathname;
        var accountMatch = variantPath.match(/\/u\/(\d+)/);
        if (accountMatch) variantTitle = "Account " + (parseInt(accountMatch[1]) + 1);
      } catch (e) {}
      existingMatch.variants.push({
        id: shortcut.id,
        url: shortcut.url,
        title: variantTitle,
        favicon: shortcut.favicon,
        deletedAt: null
      });
      console.log("[LaunchPad] Auto-nested under", existingMatch.title, ":", shortcut.title);
    } else {
      targetGroup.shortcuts.push(shortcut);
      console.log("[LaunchPad] Shortcut added to", targetGroup.name, ":", shortcut.title);
    }
    await Storage.saveAll(data);
  } catch (err) {
    console.error("[LaunchPad] Failed to add shortcut:", err);
  }
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "save-session") {
    saveCurrentSession();
  }
});

chrome.windows.onRemoved.addListener(function () {
  saveCurrentSession();
});

// Refresh stored favicon when user visits a bookmarked site
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  if (changeInfo.status !== "complete" || !tab.favIconUrl || !tab.url) return;
  if (tab.favIconUrl.startsWith("chrome://")) return;

  try {
    var data = await Storage.getAll();
    if (!data || !Array.isArray(data.workspaces)) return;
    var tabDomain;
    try { tabDomain = new URL(tab.url).hostname; } catch (e) { return; }

    var updated = false;
    data.workspaces.forEach(function (ws) {
      (ws.groups || []).forEach(function (group) {
        (group.shortcuts || []).forEach(function (shortcut) {
          try {
            if (new URL(shortcut.url).hostname === tabDomain) {
              if (tab.favIconUrl !== shortcut.favicon && !(shortcut.favicon && shortcut.favicon.startsWith("data:"))) {
                shortcut.favicon = tab.favIconUrl;
                updated = true;
              }
            }
          } catch (e) {}
          if (shortcut.variants) {
            shortcut.variants.forEach(function (v) {
              try {
                if (new URL(v.url).hostname === tabDomain) {
                  if (tab.favIconUrl !== v.favicon && !(v.favicon && v.favicon.startsWith("data:"))) {
                    v.favicon = tab.favIconUrl;
                    updated = true;
                  }
                }
              } catch (e) {}
            });
          }
        });
      });
    });

    if (updated) {
      await Storage.saveAll(data);
    }
  } catch (err) {
    console.error("[LaunchPad] Failed to refresh favicon from tab:", err);
  }
});
