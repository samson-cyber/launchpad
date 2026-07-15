/* global chrome, importScripts, Storage, ProAccess, LicenseClient, Tracking */

importScripts('storage.js');
importScripts('pro-access.js');
importScripts('license.js');
importScripts('tracking.js');

var PRO_RECONCILE_ALARM = "launchpad-pro-reconcile";
var PRO_RECONCILE_PERIOD_MINUTES = 360; // 6 hours, well above the 30s minimum

// [1.0.14] Recurring instance generation. A daily alarm (~03:00 local) + a
// catch-up run on install/startup materialize template occurrences into task
// instances. The handler is STATELESS (no module-level mutable state — the
// prototype lesson, commit 7ff8af8): it reads storage, runs the shared
// Storage.runRecurringSweep (which advances nextScheduledAt + creates instances
// in one saveAll, idempotent under double-fire), and writes back. The Tasks tab
// runs the same sweep opportunistically on open, so a Chrome-was-closed gap is
// caught up whichever path fires first.
var RECURRING_SWEEP_ALARM = "recurring-sweep";

// Next 03:00 in LOCAL time as an epoch. chrome.alarms has no cron; we anchor
// with `when` + a 1440-minute period so it re-fires daily near 03:00.
function nextRecurringSweepAt() {
  var d = new Date();
  d.setHours(3, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

async function runRecurringSweepBg() {
  try {
    var data = await Storage.getAll();
    var res = await Storage.runRecurringSweep(data); // saveAll's internally when it changes state
    if (res && res.instancesCreated) {
      console.log("[LaunchPad] Recurring sweep: created " + res.instancesCreated +
        " instance(s), advanced " + res.templatesAdvanced + " template(s), skipped " + res.skipped);
    }
  } catch (err) {
    console.error("[LaunchPad] Recurring sweep failed:", err);
  }
}

// [Trash] Daily 30-day trash auto-purge — mirrors the recurring-sweep pattern
// exactly: a stateless handler (reads storage, runs the shared
// Storage.purgeExpiredTrash which does all removals in one saveAll, no
// module-level mutable state), fired by a named daily alarm (~03:00 local, the
// same anchor as recurring-sweep) plus a catch-up on install/startup. The Tasks
// tab's opportunistic render-path call to the same function is unchanged.
var TRASH_PURGE_ALARM = "trash-purge";

async function runTrashPurgeBg() {
  try {
    var data = await Storage.getAll();
    await Storage.purgeExpiredTrash(data); // saveAll's + logs the count internally when it removes anything
  } catch (err) {
    console.error("[LaunchPad] Trash purge failed:", err);
  }
}

async function runProReconcile() {
  try {
    var data = await Storage.getAll();
    var changed = ProAccess.reconcileProState(data);
    if (changed) {
      await Storage.saveAll(data);
      console.log("[LaunchPad] Pro state reconciled:", data.pro.subscriptionStatus);
    }
  } catch (err) {
    console.error("[LaunchPad] Pro reconcile failed:", err);
  }
}

// [Bugfix] One-time retirement cleanup for the April tab-tracking prototype
// (tracking-prototype.js, deleted in this commit). Its disposable key
// accumulated full URLs since April — validation concluded, so the key goes
// (BUGS.md H3). Store users never received the prototype: it landed after the
// 1.0.4 submission, so this only ever fires on a dev profile.
//
// Read-first rather than an unconditional remove: once the key is gone this is
// a single cheap get that returns nothing, so no persisted "already cleaned"
// flag is needed and the steady-state path never writes.
var TRACKING_PROTOTYPE_KEY = "tracking_prototype";

async function cleanupTrackingPrototype() {
  try {
    var result = await chrome.storage.local.get(TRACKING_PROTOTYPE_KEY);
    if (result[TRACKING_PROTOTYPE_KEY] === undefined) return;
    await chrome.storage.local.remove(TRACKING_PROTOTYPE_KEY);
    console.log("[LaunchPad] Retired tracking prototype: removed disposable key " + TRACKING_PROTOTYPE_KEY);
  } catch (err) {
    console.error("[LaunchPad] Tracking prototype cleanup failed:", err);
  }
}

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

// Debounced context menu rebuild.
//
// Rapid storage writes (e.g. during onboarding) used to fire many overlapping
// rebuilds, which raced inside chrome.contextMenus and surfaced as
// "Cannot create item with duplicate id". The wrapper collapses bursts into a
// single rebuild and reads storage fresh when the timer fires — the last
// caller's data always wins. setTimeout is ~75ms, well under the SW idle
// suspend threshold so it is safe per BUGS.md A2.
var CONTEXT_MENU_REBUILD_DELAY_MS = 75;
var contextMenuRebuildTimer = null;

function requestContextMenuRebuild() {
  if (contextMenuRebuildTimer) clearTimeout(contextMenuRebuildTimer);
  contextMenuRebuildTimer = setTimeout(function () {
    contextMenuRebuildTimer = null;
    rebuildContextMenuNow();
  }, CONTEXT_MENU_REBUILD_DELAY_MS);
}

async function rebuildContextMenuNow() {
  var data;
  try {
    data = await Storage.getAll();
  } catch (err) {
    console.error("[LaunchPad] Failed to load data for context menu:", err);
    return;
  }

  var ws = Storage.getActiveWorkspace(data);
  var groups = (ws && ws.groups) || [];
  var groupOrder = (ws && ws.groupOrder) || [];
  var groupMap = {};
  groups.forEach(function (g) { groupMap[g.id] = g; });

  var ordered = groupOrder
    .map(function (id) { return groupMap[id]; })
    .filter(Boolean);

  groups.forEach(function (g) {
    if (!ordered.find(function (o) { return o.id === g.id; })) {
      ordered.push(g);
    }
  });

  // Use the callback form of removeAll: creates run only after Chrome has
  // fully torn the previous menu down, eliminating the duplicate-id race.
  chrome.contextMenus.removeAll(function () {
    if (chrome.runtime.lastError) {
      console.error("[LaunchPad] contextMenus.removeAll failed:", chrome.runtime.lastError.message);
      return;
    }

    chrome.contextMenus.create({
      id: "add-to-launchpad",
      title: "Add to LaunchPad",
      contexts: ["page", "link"]
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

    if (chrome.runtime.lastError) {
      console.error("[LaunchPad] contextMenus.create failed:", chrome.runtime.lastError.message);
      return;
    }

    console.log("[LaunchPad] Context menu rebuilt with", ordered.length, "group(s)");
  });
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
  requestContextMenuRebuild();
  chrome.alarms.create("save-session", { periodInMinutes: 5 });
  chrome.alarms.create(PRO_RECONCILE_ALARM, { periodInMinutes: PRO_RECONCILE_PERIOD_MINUTES });
  chrome.alarms.create(RECURRING_SWEEP_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  chrome.alarms.create(TRASH_PURGE_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  saveCurrentSession();
  runProReconcile();
  runRecurringSweepBg();
  runTrashPurgeBg();
  cleanupTrackingPrototype();
  Tracking.start();
});
chrome.runtime.onStartup.addListener(function () {
  requestContextMenuRebuild();
  chrome.alarms.create("save-session", { periodInMinutes: 5 });
  chrome.alarms.create(PRO_RECONCILE_ALARM, { periodInMinutes: PRO_RECONCILE_PERIOD_MINUTES });
  chrome.alarms.create(RECURRING_SWEEP_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  chrome.alarms.create(TRASH_PURGE_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  saveCurrentSession();
  pruneOldSessions();
  runProReconcile();
  runRecurringSweepBg();
  runTrashPurgeBg();
  cleanupTrackingPrototype();
  Tracking.start();
});

chrome.storage.onChanged.addListener(function (changes) {
  if (changes.data) {
    requestContextMenuRebuild();
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
  } else if (alarm.name === PRO_RECONCILE_ALARM) {
    runProReconcile();
  } else if (alarm.name === RECURRING_SWEEP_ALARM) {
    runRecurringSweepBg();
  } else if (alarm.name === TRASH_PURGE_ALARM) {
    runTrashPurgeBg();
  }
});

chrome.windows.onRemoved.addListener(function () {
  saveCurrentSession();
});

// [1.0.5.3] Dodo checkout return URL handler. Dodo redirects to
// https://mylaunchpad.me/checkout-return.html?license_key=...&email=...
// after a successful purchase (one-time and subscription products both
// land here; product-type-specific fields like payment_id / subscription_id
// are ignored — entitlement state comes from LicenseClient.ensureValidated).
//
// Cloudflare Pages 307-redirects /checkout-return.html -> /checkout-return
// (clean-URL convention), so the committed tab URL has NO .html. Match both
// the clean and .html paths, host-scoped, tolerating a trailing slash.
function isCheckoutReturnUrl(rawUrl) {
  if (!rawUrl) return false;
  var u;
  try { u = new URL(rawUrl); } catch (e) { return false; }
  if (u.hostname !== 'mylaunchpad.me') return false;
  var path = u.pathname.replace(/\/+$/, '');   // tolerate trailing slash
  return path === '/checkout-return' || path === '/checkout-return.html';
}

// Top-level listener (registered on every SW wake; same listener function
// reference each time so Chrome dedups). Filters on changeInfo.url so it
// only does work for matching URLs. Closes the tab unconditionally — the
// license key is persisted regardless of the validate outcome so the user
// has a path to retry validation from Pro Settings later if the network
// call failed.
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  if (!changeInfo.url) return;
  if (!isCheckoutReturnUrl(changeInfo.url)) return;
  await handleCheckoutReturn(tabId, changeInfo.url);
});

async function handleCheckoutReturn(tabId, url) {
  try {
    var parsed;
    try { parsed = new URL(url); } catch (e) {
      console.warn("[LaunchPad] Checkout return: invalid URL", url);
      return;
    }
    var rawKey = parsed.searchParams.get('license_key');
    if (!rawKey) {
      console.warn("[LaunchPad] Checkout return: missing license_key");
      return;
    }
    // Some Dodo flows comma-separate multi-key responses. Take the first.
    var firstKey = rawKey.split(',')[0].trim();
    if (!firstKey) {
      console.warn("[LaunchPad] Checkout return: empty license_key after split");
      return;
    }
    var email = parsed.searchParams.get('email');

    var data = await Storage.getAll();
    if (!data.pro || typeof data.pro !== 'object') data.pro = {};
    data.pro.licenseKey = firstKey;
    if (email) data.pro.email = email;
    await Storage.saveAll(data);

    var result = await LicenseClient.ensureValidated(data, firstKey);
    await Storage.saveAll(data);

    if (result && result.ok) {
      console.log("[LaunchPad] Checkout return: license activated/validated", result.status || "(cached)");
    } else {
      console.warn("[LaunchPad] Checkout return: ensureValidated failed", result && result.stage, result && result.error, result && result.message);
    }
  } catch (err) {
    console.error("[LaunchPad] Checkout return handler failed:", err);
  } finally {
    try {
      await chrome.tabs.remove(tabId);
    } catch (closeErr) {
      console.warn("[LaunchPad] Checkout return: tab close failed", closeErr && closeErr.message);
    }
  }
}

// ===== [1.0.25] Focus-time tracking engine =====
//
// Listener inventory (BUGS.md I1) — what this section adds to background.js:
// four Chrome event listeners plus one storage watcher, and NO alarms. The
// write-per-event architecture (7ff8af8) makes an alarm flush both unnecessary
// and unviable (30s minimum interval), so the alarm dispatch above is untouched
// and 'save-session' / pro-reconcile / 'recurring-sweep' / 'trash-purge' cannot
// collide with anything here.
//
// This file now has three chrome.tabs.onUpdated listeners — checkout-return,
// favicon refresh, and the tracking one below. Each filters on its own
// changeInfo condition and they do not interact; Chrome fans the event out to
// all three.
//
// Every listener funnels into the single stateless Tracking.sync(), which
// re-derives the focused tab and the gates from scratch. Nothing is threaded
// through from the event payload, so no handler carries state the SW could lose
// to a suspend. The engine logic lives in tracking.js — this is only wiring.

chrome.tabs.onActivated.addListener(function () {
  Tracking.sync("tab-switch");
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // URL commits on the active tab only. sync() re-reads the tab itself, so a
  // same-domain commit resolves to the same session and merely refreshes the
  // last-known-event stamp; only a cross-domain commit is a real boundary.
  if (!changeInfo.url) return;
  if (!tab || tab.active !== true) return;
  Tracking.sync("domain-change");
});

chrome.windows.onFocusChanged.addListener(function () {
  // Includes WINDOW_ID_NONE (every Chrome window blurred), which resolves to
  // "no focused window" inside sync and closes the open session (D2).
  Tracking.sync("window-focus");
});

chrome.idle.onStateChanged.addListener(function (newState) {
  // Passed as a hint so sync skips a redundant queryState. Idle NEVER writes
  // the manual-pause flag — returning to the keyboard does not resume a
  // manually paused user (spec).
  Tracking.sync("idle", newState);
});

chrome.storage.onChanged.addListener(function (changes, areaName) {
  // D3: workspace switches, per-workspace trackingEnabled toggles, the manual
  // pause flag and the active task all live in `data` and are all written by
  // the newtab UI rather than the SW. Watching `data` is how the engine sees
  // them without polling.
  //
  // Scoped to `data` deliberately: the engine's own writes land in
  // tracking_sessions, so ignoring every other key is exactly what stops this
  // from feeding back on itself.
  if (areaName !== "local") return;
  if (!changes.data) return;
  Tracking.sync("state-change");
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
