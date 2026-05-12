(function () {
  "use strict";

  var data = null;
  var sortables = [];
  var groupSortable = null;
  var activeMenu = null;
  var activeGroupMenu = null;
  var restoreCloseTimer = null;
  var sidebarLocked = false;
  var modalState = {};
  var rcLoadedItems = [];
  var sidebarGroupObserver = null;
  var sidebarSortable = null;
  var dragState = null;
  var nestingTipTimer = null;
  var activeTab = "home";
  // [1.0.11.3] Authoritative state for sidebar group expansion. Multi-expand
  // model: any subset of group IDs may be expanded simultaneously. Lives
  // in-memory only (DOM-only by contract — never persisted). renderSidebarGroups
  // reads from this Set; toggleSidebarGroup / expand-all button mutate it.
  // Replaces the previous accordion (DOM-class-as-state) model.
  var sidebarExpandedGroupIds = new Set();
  // [1.0.11.6] Drag-to-nest auto-expand: a collapsed sidebar group expands
  // when the user hovers a drag over its row for HOVER_EXPAND_DELAY_MS ms.
  // Standard tree-view pattern (Finder, Notion, VS Code file tree). State
  // is tracked across a single delegated dragover listener on #sidebar so
  // re-renders don't invalidate per-group bindings. No drag-active flag —
  // dragover only fires during an active drag.
  var dragHoverGroupId = null;
  var dragHoverTimer = null;
  var HOVER_EXPAND_DELAY_MS = 600;

  var TAB_IDS = ["home", "tasks", "dashboard", "insights"];
  var PRO_TAB_IDS = ["tasks", "dashboard", "insights"];
  var TAB_LABELS = { home: "Home", tasks: "Tasks", dashboard: "Dashboard", insights: "Insights" };

  var $ = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return [].slice.call((p || document).querySelectorAll(s)); };
  function safeOn(sel, evt, handler, opts) {
    var el = typeof sel === "string" ? $(sel) : sel;
    if (el) el.addEventListener(evt, handler, opts);
  }

  // ===== SVG Icons =====

  var PLUS_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var CLOSE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var MORE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
  var RC_FALLBACK_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
  var CHEVRON_RIGHT_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
  var CHEVRON_DOWN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  var CHEVRONS_DOWN_SVG = '<svg class="sb-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>';
  var CHEVRONS_UP_SVG = '<svg class="sb-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>';
  var FOLDER_SVG = '<svg class="sb-group-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  var THREE_DOT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
  var THREE_DOT_SM_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';

  // ===== Gallery Images =====

  var GALLERY_IMAGES = [
    { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920", thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop", label: "Mountains" },
    { url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920", thumb: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=250&fit=crop", label: "Foggy forest" },
    { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920", thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=250&fit=crop", label: "Tropical beach" },
    { url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920", thumb: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=250&fit=crop", label: "Starry mountain" },
    { url: "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=1920", thumb: "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=400&h=250&fit=crop", label: "Sunset mountains" },
    { url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920", thumb: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=250&fit=crop", label: "Green valley" },
    { url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1920", thumb: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=400&h=250&fit=crop", label: "Lake reflection" },
    { url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920", thumb: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=250&fit=crop", label: "Aerial forest" },
    { url: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920", thumb: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&h=250&fit=crop", label: "Sunrise field" },
    { url: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1920", thumb: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=400&h=250&fit=crop", label: "Ocean wave" },
    { url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920", thumb: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=250&fit=crop", label: "Dramatic peaks" },
    { url: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1920", thumb: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=400&h=250&fit=crop", label: "Northern lights" }
  ];

  var DEFAULT_BG = "color:#f5f5f5";
  var COLOR_PRESETS = [
    { value: "color:#f5f5f5", label: "Light gray" },
    { value: "color:#ffffff", label: "White" },
    { value: "color:#2a2a2a", label: "Dark gray" },
    { value: "color:#000000", label: "Black" },
    { value: "color:#1e3a5f", label: "Soft blue" },
    { value: "color:#3d2818", label: "Soft warm dark" }
  ];
  var currentBg = null;
  var previousBg = null;

  function isColorBg(bgData) {
    return typeof bgData === "string" && bgData.indexOf("color:") === 0;
  }

  function bgLuminance(hex) {
    hex = hex.replace("#", "");
    if (hex.length !== 6) return 1;
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // ===== Favicon System =====

  var FAVICON_OVERRIDES = {
    "mail.google.com": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    "ads.google.com": "https://ads.google.com/favicon.ico",
    "docs.google.com": "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico",
    "sheets.google.com": "https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico",
    "slides.google.com": "https://ssl.gstatic.com/docs/presentations/images/favicon5.ico",
    "drive.google.com": "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
    "calendar.google.com": "https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico",
    "meet.google.com": "https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v1/web-48dp/logo_meet_2020q4_color_1x_web_48dp.png"
  };

  function getFaviconUrl(urlOrShortcut) {
    var url, storedFavicon;
    if (typeof urlOrShortcut === "object" && urlOrShortcut !== null) {
      url = urlOrShortcut.url;
      storedFavicon = urlOrShortcut.favicon;
    } else {
      url = urlOrShortcut;
    }

    // Priority 1: stored favicon (from add-time capture or visit refresh)
    if (storedFavicon && storedFavicon.length > 0) return storedFavicon;

    // Priority 2: curated overrides for sites with generic icons
    var domain;
    try { domain = new URL(url).hostname; } catch (e) { return "assets/placeholder.svg"; }
    if (FAVICON_OVERRIDES[domain]) return FAVICON_OVERRIDES[domain];

    // Priority 3: Google's favicon API
    return "https://www.google.com/s2/favicons?domain=" + domain + "&sz=128";
  }

  function refreshOldFavicons() {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;
    var changed = false;
    Storage.ensureGroupsArray(ws);
    ws.groups.forEach(function (g) {
      g.shortcuts.forEach(function (s) {
        if (!s.url) return;
        if (s.favicon && s.favicon.indexOf("data:") === 0) return;
        // Migrate missing favicons or old DuckDuckGo URLs
        if (!s.favicon || s.favicon.indexOf("duckduckgo.com") !== -1) {
          s.favicon = getFaviconUrl(s.url);
          changed = true;
        }
        // Also refresh variant favicons
        if (s.variants) {
          s.variants.forEach(function (v) {
            if (!v.url) return;
            if (v.favicon && v.favicon.indexOf("data:") === 0) return;
            if (!v.favicon || v.favicon.indexOf("duckduckgo.com") !== -1) {
              v.favicon = getFaviconUrl(v.url);
              changed = true;
            }
          });
        }
      });
    });
    if (changed) {
      Storage.saveAll(data);
    }
  }

  var CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var CHECK_SM_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var POPULAR_SITES = [
    { title: "Google", url: "https://www.google.com" },
    { title: "YouTube", url: "https://www.youtube.com" },
    { title: "Amazon", url: "https://www.amazon.com" },
    { title: "Facebook", url: "https://www.facebook.com" },
    { title: "Instagram", url: "https://www.instagram.com" },
    { title: "Gmail", url: "https://mail.google.com" },
    { title: "Netflix", url: "https://www.netflix.com" },
    { title: "LinkedIn", url: "https://www.linkedin.com" }
  ];
  var obSelectedPopular = {};


  // ===== Sidebar expand-state debug hooks =====
  //
  // [1.0.11.3] Exposed on window so verification snippets can drive the
  // multi-expand state and the expand-all toggle from DevTools without
  // reaching into the IIFE closure. Read-only inspection (.state) returns
  // the live Set reference; mutating it directly bypasses DOM sync and is
  // not recommended outside debugging.
  window.sidebarExpandDebug = {
    get state() { return sidebarExpandedGroupIds; },
    toggleGroup: function (groupId) { toggleSidebarGroup(groupId); },
    toggleAll: function () { toggleAllSidebarGroups(); },
    refreshIcon: function () { updateSidebarExpandAllIcon(); },
    // [1.0.11.6] Drag-to-nest auto-expand verification hooks.
    // simulateDragHover runs the same expand-if-eligible logic the
    // 600ms timer would invoke (still-collapsed + wrapper-exists checks)
    // without requiring the caller to synthesize HTML5 drag events.
    simulateDragHover: function (groupId) { return autoExpandHoveredGroup(groupId); },
    get dragHoverState() { return { groupId: dragHoverGroupId, hasTimer: dragHoverTimer !== null }; },
    // [1.0.11.12] Sidebar panel mutex verification hooks.
    // openPanel(name) routes through the same mutex helper the click
    // handlers use; getCurrentOpenPanel returns the name of the
    // currently-open chain panel (or null). name is "settings",
    // "pro-settings", or "restore-session".
    openPanel: function (name) { return openPanel(name); },
    get currentOpenPanel() { return getCurrentOpenPanel(); },
    // [1.0.11.7] Cross-list drop sync verification hook. Rebuilds the
    // group's shortcuts array from the given list element's direct
    // children (any .shortcuts-grid or .sidebar-shortcut-list works).
    // Does NOT save — caller can inspect data.workspaces[...].shortcuts
    // synchronously and then trigger Storage.saveAll if they want to
    // persist. Returns the new shortcuts array length, or null if the
    // list element lacks data-group-id or the group cannot be resolved.
    syncListFromDOM: function (listEl) {
      if (!listEl || !listEl.dataset || !listEl.dataset.groupId) return null;
      var ws = Storage.getActiveWorkspace(data);
      if (!ws) return null;
      Storage.ensureGroupsArray(ws);
      var allShortcuts = new Map();
      ws.groups.forEach(function (g) {
        g.shortcuts.forEach(function (s) { allShortcuts.set(s.id, s); });
      });
      rebuildGroupFromListElement(listEl, allShortcuts);
      var rebuilt = findGroup(listEl.dataset.groupId);
      return rebuilt ? rebuilt.shortcuts.length : null;
    }
  };

  // ===== Pro state debug helper =====

  // Exposed on window for the new-tab Console. Logs the full data.pro block,
  // current access level, trial days remaining, reactivation-offer status,
  // and timestamps in a human-readable form. No mutations.
  window.proStatusDebug = async function () {
    var d = await Storage.getAll();
    var pro = d.pro || {};
    var fmt = function (ts) { return ts ? new Date(ts).toLocaleString() : "(null)"; };
    console.log("[LaunchPad] Pro status:");
    console.log("  subscriptionStatus:", pro.subscriptionStatus || "(unset)");
    console.log("  licenseKey:", pro.licenseKey || "(null)");
    console.log("  trialStartedAt:", fmt(pro.trialStartedAt));
    console.log("  trialEndedAt:", fmt(pro.trialEndedAt));
    console.log("  lastVerifiedAt:", fmt(pro.lastVerifiedAt));
    console.log("  → access level:", ProAccess.getProAccessLevel(d));
    console.log("  → trial days remaining:", ProAccess.trialDaysRemaining(d));
    console.log("  → reactivation offer active:", ProAccess.isReactivationOfferActive(d));
    return pro;
  };

  // ===== Tab Bar =====

  function isProAccessibleLevel(level) {
    return level === "trialing" || level === "active" || level === "grace";
  }

  function bindTabBar() {
    var bar = $("#tab-bar");
    if (!bar) return;
    bar.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".tab") : null;
      if (!btn) return;
      var id = btn.getAttribute("data-tab");
      if (!id) return;
      setActiveTab(id);
    });
  }

  function setActiveTab(id) {
    if (TAB_IDS.indexOf(id) === -1) id = "home";
    activeTab = id;
    TAB_IDS.forEach(function (t) {
      var btn = document.querySelector('.tab[data-tab="' + t + '"]');
      var panel = document.getElementById("tab-" + t);
      var isActive = (t === id);
      if (btn) {
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      }
      if (panel) {
        panel.classList.toggle("hidden", !isActive);
      }
    });
    // Tab switch is treated as a navigation change — close any open popover and
    // re-derive the CTA state (pulse depends on whether we're on a Pro tab).
    closeUpgradePopover();
    applyCtaState(data);
  }

  function applyTabAccessLevel(level) {
    var hasPro = isProAccessibleLevel(level);
    PRO_TAB_IDS.forEach(function (t) {
      var btn = document.querySelector('.tab[data-tab="' + t + '"]');
      if (btn) btn.classList.toggle("gated", !hasPro);
      renderTabPlaceholder(t, level);
    });
  }

  function applySidebarProEntryVisibility(hasPro) {
    var entry = $("#sb-pro-settings");
    if (!entry) return;
    entry.classList.toggle("hidden", !hasPro);
  }

  function applyAccessLevelUI() {
    var level = (typeof ProAccess !== "undefined" && data)
      ? ProAccess.getProAccessLevel(data)
      : "free";
    var hasPro = isProAccessibleLevel(level);
    applyTabAccessLevel(level);
    applySidebarProEntryVisibility(hasPro);
    applyCtaState(data);
    applyWorkspaceSwitcherState(data);
    if ($("#pro-settings-panel") && !$("#pro-settings-panel").classList.contains("hidden")) {
      renderProSubscriptionSection();
      renderProLicenseSection();
      renderProTagsSection();
      renderProWorkspaceList();
    }
  }

  function renderTabPlaceholder(id, level) {
    var panel = document.getElementById("tab-" + id);
    if (!panel) return;
    var label = TAB_LABELS[id] || id;
    if (isProAccessibleLevel(level)) {
      // [1.0.10] Tasks tab gets a real layout; other Pro tabs stay on the
      // Coming-soon placeholder until their own [1.0.x] tasks land.
      if (id === "tasks") {
        renderTasksTab(panel, data);
        return;
      }
      panel.innerHTML =
        '<div class="tab-placeholder">' +
          '<div class="tab-placeholder-title">' + label + '</div>' +
          '<div class="tab-placeholder-text">Coming soon.</div>' +
        '</div>';
    } else {
      renderProPreview(id, panel, data);
    }
  }

  // ===== Pro Preview Mode =====
  //
  // Free / expired users see a Preview Mode UI when they click a Pro tab:
  // the feature's actual layout shell rendered with hard-coded demo data,
  // plus a thin banner explaining the preview state. NOTHING here writes
  // to chrome.storage; demo data lives in JS constants only.
  //
  // Trialing / active / grace users keep the existing "Coming soon"
  // placeholder until each Pro tab's real implementation lands.

  var DEMO_TAG_PALETTE = {
    shipQ3:    { id: "demo-tag-q3",        name: "ship-q3-report",   color: "#4A90E2" },
    learnTs:   { id: "demo-tag-ts",        name: "learn-typescript", color: "#50C878" },
    ungrouped: { id: "demo-tag-ungrouped", name: "ungrouped",        color: "#9b9b9b" },
    research:  { id: "demo-tag-research",  name: "research",         color: "#E08E4A" },
    admin:     { id: "demo-tag-admin",     name: "admin",            color: "#A569BD" }
  };

  var DEMO_TASKS_DATA = {
    goals: [
      {
        id: "demo-goal-1",
        name: "Ship Q3 report",
        tag: DEMO_TAG_PALETTE.shipQ3,
        deadline: "May 31",
        tasks: [
          { id: "demo-task-1", name: "Draft executive summary",       priority: "high",   active: false, completed: false },
          { id: "demo-task-2", name: "Pull regional revenue numbers", priority: "medium", active: true,  completed: false, elapsed: "00:23:15" }
        ]
      },
      {
        id: "demo-goal-2",
        name: "Learn TypeScript",
        tag: DEMO_TAG_PALETTE.learnTs,
        deadline: "Jun 14",
        tasks: [
          { id: "demo-task-3", name: "Finish generics chapter", priority: null,  active: false, completed: false },
          { id: "demo-task-4", name: "Build a tiny todo app",   priority: "low", active: false, completed: false }
        ]
      }
    ]
  };

  var DEMO_DASHBOARD_DATA = {
    recap: {
      deepWorkText: "3h 42m",
      tasksCompleted: 4,
      goalsProgressed: 1,
      goalsTotal: 2,
      longestStretch: "47m",
      tagBreakdown: [
        { tag: DEMO_TAG_PALETTE.shipQ3,    durationText: "1h 50m" },
        { tag: DEMO_TAG_PALETTE.learnTs,   durationText: "1h 10m" },
        { tag: DEMO_TAG_PALETTE.ungrouped, durationText: "42m" }
      ]
    },
    weekly: {
      todayIndex: 4, // Friday
      days: [
        { label: "Mon", hours: 2.1 },
        { label: "Tue", hours: 3.5 },
        { label: "Wed", hours: 4.2 },
        { label: "Thu", hours: 1.8 },
        { label: "Fri", hours: 3.7 },
        { label: "Sat", hours: 0.5 },
        { label: "Sun", hours: 0   }
      ]
    }
  };

  var DEMO_INSIGHTS_DATA = {
    trend30: {
      todayIndex: 29,
      // Hours per day for the last 30 days, gentle upward trend with light noise.
      days: [
        1.2, 1.0, 1.5, 0.8, 1.4, 1.7, 2.0, 1.3, 1.8, 2.1,
        1.9, 2.3, 2.0, 2.5, 2.2, 2.7, 2.4, 2.9, 2.6, 3.1,
        2.8, 3.3, 3.0, 3.4, 3.2, 3.6, 3.4, 3.7, 3.5, 3.8
      ]
    },
    donut: {
      centerLabel: "32h",
      segments: [
        { tag: DEMO_TAG_PALETTE.shipQ3,    hours: 12 },
        { tag: DEMO_TAG_PALETTE.learnTs,   hours: 9  },
        { tag: DEMO_TAG_PALETTE.ungrouped, hours: 6  },
        { tag: DEMO_TAG_PALETTE.research,  hours: 3  },
        { tag: DEMO_TAG_PALETTE.admin,     hours: 2  }
      ]
    },
    badges: [
      { id: "first-week",   title: "First Week",   desc: "Used LaunchPad 7 days running",          unlocked: true,  glyph: "calendar" },
      { id: "goal-crusher", title: "Goal Crusher", desc: "Completed 5 goals",                      unlocked: true,  glyph: "target"   },
      { id: "deep-diver",   title: "Deep Diver",   desc: "Single 2-hour focus block",              unlocked: true,  glyph: "compass"  },
      { id: "variety",      title: "Variety",      desc: "5 different tags in a week",             unlocked: false, glyph: "layers"   },
      { id: "consistency",  title: "Consistency",  desc: "Deep work every weekday for 2 weeks",    unlocked: false, glyph: "trend"    },
      { id: "marathoner",   title: "Marathoner",   desc: "8-hour deep work day",                   unlocked: false, glyph: "clock"    },
      { id: "curator",      title: "Curator",      desc: "50+ shortcuts organized",                unlocked: false, glyph: "bookmark" }
    ]
  };

  function previewBannerHtml(d) {
    var trialUsed = !!(d && d.pro && d.pro.trialStartedAt);
    var ctaText = trialUsed ? "Upgrade" : "Start free trial";
    return '<div class="pro-preview-banner">' +
      '<span class="pro-preview-banner-text">Preview mode. Upgrade to Pro to use this feature with your data.</span>' +
      '<a href="#" class="pro-preview-banner-cta" data-pro-preview-cta>' + ctaText + '</a>' +
    '</div>';
  }

  function priorityClass(p) {
    if (p === "urgent") return "pp-prio pp-prio-urgent";
    if (p === "high")   return "pp-prio pp-prio-high";
    if (p === "medium") return "pp-prio pp-prio-medium";
    if (p === "low")    return "pp-prio pp-prio-low";
    return "pp-prio-none";
  }

  function renderTagPill(tag) {
    return '<span class="pp-tag-pill" style="background:' + tag.color + ';color:' + tagTextColorFor(tag.color) + '">' + escapeHtml(tag.name) + '</span>';
  }

  function renderTasksPreview() {
    var goalsHtml = DEMO_TASKS_DATA.goals.map(function (g) {
      var doneCount = g.tasks.filter(function (t) { return t.completed; }).length;
      var totalCount = g.tasks.length;
      var pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
      var tasksHtml = g.tasks.map(function (t) {
        var activeBadge = t.active
          ? '<span class="pp-active-badge"><span class="pp-active-dot"></span>active &middot; ' + escapeHtml(t.elapsed || "") + '</span>'
          : '';
        return '<div class="pp-task-row ' + priorityClass(t.priority) + '">' +
            '<input type="checkbox" class="pp-task-check" disabled>' +
            '<span class="pp-task-name">' + escapeHtml(t.name) + '</span>' +
            renderTagPill(g.tag) +
            activeBadge +
          '</div>';
      }).join("");
      return '<div class="pp-goal-card">' +
          '<div class="pp-goal-header">' +
            '<div class="pp-goal-header-left">' +
              '<span class="pp-goal-name">' + escapeHtml(g.name) + '</span>' +
              renderTagPill(g.tag) +
            '</div>' +
            '<div class="pp-goal-header-right">' +
              '<span class="pp-goal-deadline">' + escapeHtml(g.deadline) + '</span>' +
              '<button class="pp-icon-btn" type="button" disabled aria-label="Goal options">' + THREE_DOT_SM_SVG + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="pp-progress">' +
            '<div class="pp-progress-bar"><div class="pp-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<span class="pp-progress-text">' + doneCount + '/' + totalCount + '</span>' +
          '</div>' +
          '<div class="pp-task-list">' + tasksHtml + '</div>' +
          '<button class="pp-add-task-btn" type="button" disabled>+ Add task</button>' +
        '</div>';
    }).join("");

    return '<div class="pp-tasks-header">' +
        '<div class="pp-filter-chips">' +
          '<span class="pp-filter-chip">Priority</span>' +
          '<span class="pp-filter-chip">Tag</span>' +
          '<span class="pp-filter-chip">Status</span>' +
        '</div>' +
        '<div class="pp-sort-dropdown">Sort by: creation date</div>' +
      '</div>' +
      '<div class="pp-section-header">Active Goals</div>' +
      '<div class="pp-goal-list">' + goalsHtml + '</div>' +
      '<div class="pp-section-header">Standalone</div>' +
      '<div class="pp-empty-state">No standalone tasks</div>' +
      '<div class="pp-section-header">Recurring</div>' +
      '<div class="pp-empty-state">No recurring tasks</div>' +
      '<div class="pp-section-header pp-section-header-collapsible">' +
        '<span class="pp-collapse-chevron">' + CHEVRON_RIGHT_SVG + '</span>' +
        'Completed (0)' +
      '</div>';
  }

  function renderDashboardPreview() {
    var d = DEMO_DASHBOARD_DATA;
    var recap = d.recap;

    var tagBreakdownHtml = recap.tagBreakdown.map(function (e) {
      return '<div class="pp-tag-breakdown-item">' +
          renderTagPill(e.tag) +
          '<span class="pp-tag-breakdown-dur">' + escapeHtml(e.durationText) + '</span>' +
        '</div>';
    }).join("");

    var emojis = ["😞", "😐", "🙂", "😊", "🎉"];
    var emojiHtml = emojis.map(function (em) {
      return '<button class="pp-emoji" type="button" disabled>' + em + '</button>';
    }).join("");

    // Weekly bar chart (inline SVG)
    var w = 380, h = 170, padX = 28, padTop = 28, padBottom = 36;
    var bars = d.weekly.days;
    var maxH = Math.max.apply(null, bars.map(function (b) { return b.hours; })) || 1;
    var step = (w - 2 * padX) / bars.length;
    var barW = step * 0.55;
    var chartH = h - padTop - padBottom;
    var barsSvg = bars.map(function (b, i) {
      var x = padX + step * i + (step - barW) / 2;
      var bh = chartH * (b.hours / maxH);
      var y = h - padBottom - bh;
      var cls = (i === d.weekly.todayIndex) ? "pp-bar pp-bar-today" : "pp-bar";
      return '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(bh, 1) + '" rx="3" />' +
        '<text class="pp-bar-label" x="' + (x + barW / 2) + '" y="' + (h - padBottom + 16) + '">' + b.label + '</text>';
    }).join("");
    var weekSvg = '<svg class="pp-week-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Deep work hours this week">' +
        '<line class="pp-axis" x1="' + padX + '" y1="' + (h - padBottom) + '" x2="' + (w - padX) + '" y2="' + (h - padBottom) + '" />' +
        barsSvg +
        '<text class="pp-axis-label" x="' + padX + '" y="' + (padTop - 10) + '">hours of deep work</text>' +
      '</svg>';

    var goalsPct = Math.round((recap.goalsProgressed / recap.goalsTotal) * 100);

    return '<div class="pp-dash-grid">' +
        '<div class="pp-dash-card pp-dash-card-recap">' +
          '<div class="pp-dash-card-title">Today’s Recap</div>' +
          '<div class="pp-recap-big">' +
            '<span class="pp-recap-big-num">' + escapeHtml(recap.deepWorkText) + '</span>' +
            '<span class="pp-recap-big-label">deep work</span>' +
          '</div>' +
          '<div class="pp-recap-row"><span class="pp-recap-num">' + recap.tasksCompleted + '</span> tasks completed</div>' +
          '<div class="pp-recap-row pp-recap-row-stack">' +
            '<div><span class="pp-recap-num">' + recap.goalsProgressed + ' of ' + recap.goalsTotal + '</span> goals making progress</div>' +
            '<div class="pp-progress-bar pp-progress-bar-sm"><div class="pp-progress-fill" style="width:' + goalsPct + '%"></div></div>' +
          '</div>' +
          '<div class="pp-recap-row">Longest focus stretch: <span class="pp-recap-num">' + escapeHtml(recap.longestStretch) + '</span></div>' +
          '<div class="pp-tag-breakdown">' + tagBreakdownHtml + '</div>' +
          '<div class="pp-mood-row">' +
            '<div class="pp-mood-q">How did today feel?</div>' +
            '<div class="pp-mood-emojis">' + emojiHtml + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pp-dash-card pp-dash-card-week">' +
          '<div class="pp-dash-card-title">This week</div>' +
          weekSvg +
        '</div>' +
      '</div>';
  }

  function renderInsightsPreview() {
    var d = DEMO_INSIGHTS_DATA;

    // 30-day trend bars
    var w = 560, h = 190, padX = 32, padTop = 28, padBottom = 32;
    var days = d.trend30.days;
    var maxH = Math.max.apply(null, days) || 1;
    var step = (w - 2 * padX) / days.length;
    var barW = step * 0.6;
    var chartH = h - padTop - padBottom;
    var barsSvg = days.map(function (hours, i) {
      var x = padX + step * i + (step - barW) / 2;
      var bh = chartH * (hours / maxH);
      var y = h - padBottom - bh;
      var cls = (i === d.trend30.todayIndex) ? "pp-bar pp-bar-today" : "pp-bar";
      return '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(bh, 1) + '" rx="2" />';
    }).join("");
    var trendSvg = '<svg class="pp-trend-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Deep work trend over the last 30 days">' +
        '<line class="pp-axis" x1="' + padX + '" y1="' + (h - padBottom) + '" x2="' + (w - padX) + '" y2="' + (h - padBottom) + '" />' +
        barsSvg +
        '<text class="pp-axis-label" x="' + padX + '" y="' + (padTop - 10) + '">hours / day</text>' +
        '<text class="pp-axis-label-sub" x="' + padX + '" y="' + (h - padBottom + 16) + '" text-anchor="start">30 days ago</text>' +
        '<text class="pp-axis-label-sub" x="' + (w - padX) + '" y="' + (h - padBottom + 16) + '" text-anchor="end">today</text>' +
      '</svg>';

    // Donut chart
    var totalH = d.donut.segments.reduce(function (a, s) { return a + s.hours; }, 0) || 1;
    var donutR = 60, donutCx = 80, donutCy = 80, donutCirc = 2 * Math.PI * donutR;
    var donutOffset = 0;
    var donutSegSvg = d.donut.segments.map(function (s) {
      var frac = s.hours / totalH;
      var dash = donutCirc * frac;
      var gap = donutCirc - dash;
      var seg = '<circle class="pp-donut-seg" cx="' + donutCx + '" cy="' + donutCy + '" r="' + donutR + '"' +
        ' stroke="' + s.tag.color + '"' +
        ' stroke-dasharray="' + dash + ' ' + gap + '"' +
        ' stroke-dashoffset="' + (-donutOffset) + '"' +
      '/>';
      donutOffset += dash;
      return seg;
    }).join("");
    var donutSvg = '<svg class="pp-donut" viewBox="0 0 160 160" role="img" aria-label="Time by tag, last 30 days">' +
        '<g transform="rotate(-90 ' + donutCx + ' ' + donutCy + ')">' + donutSegSvg + '</g>' +
        '<text class="pp-donut-center" x="' + donutCx + '" y="' + donutCy + '" text-anchor="middle" dominant-baseline="middle">' + escapeHtml(d.donut.centerLabel) + '</text>' +
      '</svg>';
    var donutLegend = d.donut.segments.map(function (s) {
      return '<div class="pp-donut-legend-row">' +
          '<span class="pp-donut-legend-swatch" style="background:' + s.tag.color + '"></span>' +
          '<span class="pp-donut-legend-name">' + escapeHtml(s.tag.name) + '</span>' +
          '<span class="pp-donut-legend-hrs">' + s.hours + 'h</span>' +
        '</div>';
    }).join("");

    // Achievement badges
    var badgesHtml = d.badges.map(function (b) {
      var lockedCls = b.unlocked ? "" : " pp-badge-locked";
      var glyph = renderBadgeGlyph(b.glyph);
      var subtitle = b.unlocked ? escapeHtml(b.desc) : "Locked";
      return '<div class="pp-badge' + lockedCls + '">' +
          '<div class="pp-badge-icon">' + glyph + '</div>' +
          '<div class="pp-badge-title">' + escapeHtml(b.title) + '</div>' +
          '<div class="pp-badge-sub">' + subtitle + '</div>' +
        '</div>';
    }).join("");

    return '<div class="pp-insights-card">' +
        '<div class="pp-dash-card-title">Deep Work — last 30 days</div>' +
        trendSvg +
      '</div>' +
      '<div class="pp-insights-card">' +
        '<div class="pp-dash-card-title">Time by tag — last 30 days</div>' +
        '<div class="pp-donut-row">' + donutSvg + '<div class="pp-donut-legend">' + donutLegend + '</div></div>' +
      '</div>' +
      '<div class="pp-insights-card">' +
        '<div class="pp-dash-card-title">Achievements</div>' +
        '<div class="pp-badge-grid">' + badgesHtml + '</div>' +
      '</div>';
  }

  function renderBadgeGlyph(glyph) {
    var icons = {
      calendar: '<rect x="4" y="6" width="20" height="18" rx="2" ry="2"/><line x1="4" y1="11" x2="24" y2="11"/><line x1="9" y1="3" x2="9" y2="8"/><line x1="19" y1="3" x2="19" y2="8"/>',
      target:   '<circle cx="14" cy="14" r="11"/><circle cx="14" cy="14" r="7"/><circle cx="14" cy="14" r="3"/>',
      compass:  '<circle cx="14" cy="14" r="11"/><polygon points="18 10 16 16 10 18 12 12"/>',
      layers:   '<polygon points="14 3 26 9 14 15 2 9"/><polyline points="2 14 14 20 26 14"/><polyline points="2 19 14 25 26 19"/>',
      trend:    '<polyline points="3 22 10 14 14 18 25 6"/><polyline points="19 6 25 6 25 12"/>',
      clock:    '<circle cx="14" cy="14" r="11"/><polyline points="14 7 14 14 19 17"/>',
      bookmark: '<path d="M21 25l-7-5-7 5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'
    };
    var inner = icons[glyph] || icons.target;
    return '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  function renderProPreview(id, panel, d) {
    var bodyHtml = "";
    if (id === "tasks")          bodyHtml = renderTasksPreview();
    else if (id === "dashboard") bodyHtml = renderDashboardPreview();
    else if (id === "insights")  bodyHtml = renderInsightsPreview();

    panel.innerHTML =
      '<div class="pro-preview" data-tab="' + id + '">' +
        previewBannerHtml(d) +
        '<div class="pro-preview-content">' + bodyHtml + '</div>' +
      '</div>';

    var cta = panel.querySelector('[data-pro-preview-cta]');
    if (cta) {
      cta.addEventListener("click", function (e) {
        e.preventDefault();
        openUpgradePopover(cta, data);
      });
    }
  }

  // ===== Tasks Tab ([1.0.10]) =====
  //
  // Read-only "looks finished" pass per the PLAN's D1 split. Renders the
  // four sections (Active Goals / Standalone / Recurring / Completed), each
  // section's empty state, and the goal-card layout (name, auto-tag pill,
  // deadline + overdue badge, progress bar, child task rows). The only
  // interactivity is the task checkbox toggle and the Completed-section
  // chevron. Inline editing, modals for the action buttons, the goal
  // context menu, "+ Add task", the Templates link panel, and filter-bar
  // logic all defer to [1.0.10.1].
  //
  // Data sources (existing in storage.js):
  //   Storage.getActiveGoals(ws), getCompletedGoals(ws), getActiveTasks(ws),
  //   getCompletedTasks(ws), getActiveRecurringTemplates(ws), getTagById(ws,id)
  //
  // Re-render trigger:
  //   - Initial render via applyTabAccessLevel → renderTabPlaceholder
  //   - chrome.storage.onChanged path runs applyAccessLevelUI which re-calls
  //     renderTabPlaceholder ([init's onChanged listener]); checkbox toggles
  //     also call renderTasksTab eagerly so the user sees the new state
  //     before the round-trip lands.

  // Short month/day formatter for goal deadlines and recurring "next" hints.
  // Locale-respecting via toLocaleDateString without relying on a heavier
  // formatter; the Tasks tab is a Pro surface and the user's browser locale
  // is the right default.
  function fmtShortDate(ts) {
    if (!ts || typeof ts !== "number") return "";
    try {
      return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  }

  function isOverdue(deadlineAt) {
    return typeof deadlineAt === "number" && deadlineAt < Date.now();
  }

  // Auto-tag pill / standalone tag pills resolve through Storage.getTagById,
  // which returns null for archived tags so deleted-tag IDs render as
  // nothing rather than a broken pill.
  function tagPillHtml(workspace, tagId) {
    if (!tagId) return "";
    var tag = Storage.getTagById(workspace, tagId);
    if (!tag) return "";
    return '<span class="tt-tag-pill" style="background:' + escapeHtml(tag.color) + ';color:' + tagTextColorFor(tag.color) + '">' +
      escapeHtml(tag.name) +
    '</span>';
  }

  // Stable display order for goals: by displayOrder asc, then by createdAt asc
  // as a tiebreaker. Mirrors the Goal CRUD's nextDisplayOrder + createdAt
  // semantics so the rendered order matches what the user would see in any
  // hand-walked iteration.
  function sortedByDisplayOrder(items) {
    return items.slice().sort(function (a, b) {
      var ao = typeof a.displayOrder === "number" ? a.displayOrder : 0;
      var bo = typeof b.displayOrder === "number" ? b.displayOrder : 0;
      if (ao !== bo) return ao - bo;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function tasksHeaderHtml() {
    // Filter bar dropdowns rendered with their default option labels per the
    // PLAN — no logic, no actual filter state. Same with the action buttons
    // and Templates link, all noop until [1.0.10.1].
    return '<header class="tasks-header">' +
        '<div class="tasks-header-left">' +
          '<h1 class="tasks-title">Tasks</h1>' +
          '<div class="tasks-filter-bar" role="toolbar" aria-label="Task filters">' +
            '<select class="tasks-filter" data-filter="priority" aria-label="Priority filter">' +
              '<option value="">Priority</option>' +
              '<option value="urgent">Urgent</option>' +
              '<option value="high">High</option>' +
              '<option value="medium">Medium</option>' +
              '<option value="low">Low</option>' +
            '</select>' +
            '<select class="tasks-filter" data-filter="tag" aria-label="Tag filter">' +
              '<option value="">Tag</option>' +
            '</select>' +
            '<select class="tasks-filter" data-filter="status" aria-label="Status filter">' +
              '<option value="active">Active</option>' +
              '<option value="completed">Completed</option>' +
              '<option value="all">All</option>' +
            '</select>' +
            '<select class="tasks-filter" data-filter="sort" aria-label="Sort by">' +
              '<option value="created">Sort: created</option>' +
              '<option value="due">Sort: due</option>' +
              '<option value="priority">Sort: priority</option>' +
              '<option value="name">Sort: name</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="tasks-header-right">' +
          '<button class="tasks-action" data-action="new-goal" type="button">+ New Goal</button>' +
          '<button class="tasks-action" data-action="new-task" type="button">+ New Task</button>' +
          '<button class="tasks-action" data-action="new-recurring" type="button">+ New Recurring</button>' +
          '<a class="tasks-templates-link" data-action="templates" href="#">Templates</a>' +
        '</div>' +
      '</header>';
  }

  // Single child task row — read-only name + working checkbox. Priority
  // visual treatment (left border) lands in [1.0.12].
  function taskRowHtml(workspace, task) {
    var checked = task.completed ? " checked" : "";
    var completedCls = task.completed ? " is-completed" : "";
    var tagHtml = "";
    var tagIds = Array.isArray(task.tagIds) ? task.tagIds : [];
    for (var i = 0; i < tagIds.length; i++) {
      tagHtml += tagPillHtml(workspace, tagIds[i]);
    }
    return '<li class="tt-task-row' + completedCls + '" data-task-id="' + escapeHtml(task.id) + '">' +
      '<input type="checkbox" class="tt-task-check" data-task-id="' + escapeHtml(task.id) + '"' + checked + ' aria-label="Toggle task complete">' +
      '<span class="tt-task-name">' + escapeHtml(task.name) + '</span>' +
      tagHtml +
    '</li>';
  }

  function goalCardHtml(workspace, goal, allTasks) {
    var children = sortedByDisplayOrder(allTasks.filter(function (t) {
      return t.goalId === goal.id && !t.deletedAt;
    }));
    var doneCount = children.filter(function (t) { return t.completed; }).length;
    var totalCount = children.length;
    var pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    var deadlineHtml = "";
    if (typeof goal.deadlineAt === "number") {
      var overdue = isOverdue(goal.deadlineAt) && goal.status !== "completed";
      deadlineHtml = '<span class="tt-goal-deadline">' + escapeHtml(fmtShortDate(goal.deadlineAt)) + '</span>';
      if (overdue) {
        deadlineHtml += '<span class="tt-overdue-badge">Overdue</span>';
      }
    }

    var tasksListHtml = children.length
      ? children.map(function (t) { return taskRowHtml(workspace, t); }).join("")
      : '<li class="tt-task-empty">No tasks yet.</li>';

    var isCompleted = goal.status === "completed";
    // Strict equality so legacy goals (pre-[1.0.11], no isCollapsed field)
    // and `false` both render as expanded.
    var isCollapsed = goal.isCollapsed === true;
    // [1.0.10.1] Completed-section goals render their card read-only — no
    // three-dot menu, no "+ Add task". Inline name edit is also gated on
    // !isCompleted in the click handler. Reactivation lives in [1.0.10.2+]
    // per spec; this just makes the read-only intent visible.
    var menuBtnHtml = isCompleted ? "" :
      '<button type="button" class="tt-goal-menu-btn" data-goal-id="' + escapeHtml(goal.id) + '" aria-label="Goal options" title="Goal options">' + THREE_DOT_SM_SVG + '</button>';
    var addTaskBlockHtml = isCompleted ? "" :
      '<button type="button" class="tt-goal-add-task" data-goal-id="' + escapeHtml(goal.id) + '">+ Add task</button>' +
      '<div class="tt-add-task-inline hidden" data-goal-id="' + escapeHtml(goal.id) + '">' +
        '<input type="text" class="tt-add-task-input" placeholder="Task name" maxlength="200" autocomplete="off" spellcheck="false">' +
        '<button type="button" class="tt-add-task-save">Add</button>' +
        '<button type="button" class="tt-add-task-cancel">Cancel</button>' +
      '</div>';
    // [1.0.11] When collapsed, the body (child task list + "+ Add task") is
    // omitted entirely. Header (name, auto-tag, deadline + overdue, progress
    // bar) stays visible so the user still sees the goal's at-a-glance state.
    var bodyHtml = isCollapsed ? "" :
      '<ul class="tt-goal-tasks">' + tasksListHtml + '</ul>' + addTaskBlockHtml;

    return '<article class="tt-goal-card' + (isCompleted ? ' is-completed' : '') + '" data-goal-id="' + escapeHtml(goal.id) + '" data-collapsed="' + (isCollapsed ? "true" : "false") + '">' +
      '<header class="tt-goal-header">' +
        '<div class="tt-goal-header-left">' +
          '<span class="tt-goal-chevron" aria-label="Toggle goal collapse">' + CHEVRON_RIGHT_SVG + '</span>' +
          '<span class="tt-goal-name" data-goal-id="' + escapeHtml(goal.id) + '">' + escapeHtml(goal.name) + '</span>' +
          tagPillHtml(workspace, goal.autoTagId) +
        '</div>' +
        '<div class="tt-goal-header-right">' +
          deadlineHtml +
          menuBtnHtml +
        '</div>' +
      '</header>' +
      '<div class="tt-goal-progress">' +
        '<div class="tt-progress-bar"><div class="tt-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="tt-progress-text">' + doneCount + ' of ' + totalCount + ' task' + (totalCount === 1 ? "" : "s") + ' complete</span>' +
      '</div>' +
      bodyHtml +
    '</article>';
  }

  function recurringRowHtml(workspace, template) {
    // Pattern hint mirrors the spec's "Weekly review • every Monday" copy.
    // Daily prints just the time-of-day; weekly prints the day-of-week list;
    // monthly prints the day-of-month.
    var DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var hint = "";
    if (template.frequency === "daily") {
      hint = "Daily at " + (template.timeOfDay || "09:00");
    } else if (template.frequency === "weekly") {
      var days = (template.daysOfWeek || []).map(function (d) { return DOW_LABELS[d] || ""; }).filter(Boolean);
      hint = "Weekly on " + (days.join(", ") || "—") + " at " + (template.timeOfDay || "09:00");
    } else if (template.frequency === "monthly") {
      hint = "Monthly on day " + (template.dayOfMonth || "—") + " at " + (template.timeOfDay || "09:00");
    }
    var pausedBadge = template.isActive ? "" : '<span class="tt-recurring-paused">Paused</span>';
    var tagHtml = "";
    var tagIds = Array.isArray(template.tagIds) ? template.tagIds : [];
    for (var i = 0; i < tagIds.length; i++) {
      tagHtml += tagPillHtml(workspace, tagIds[i]);
    }
    return '<li class="tt-recurring-row" data-template-id="' + escapeHtml(template.id) + '">' +
      '<span class="tt-recurring-icon" aria-hidden="true">↻</span>' +
      '<span class="tt-recurring-name">' + escapeHtml(template.name) + '</span>' +
      '<span class="tt-recurring-hint">' + escapeHtml(hint) + '</span>' +
      tagHtml +
      pausedBadge +
    '</li>';
  }

  // Completed section bundles two streams: completed goals (with their child
  // tasks rendered read-only beneath, matching the Active card layout sans
  // the progress bar) and completed standalone tasks. Recurring instances
  // can also be completed; until [1.0.14] generates them, this stream is
  // just spec-aligned scaffolding.
  function completedBodyHtml(workspace, completedGoals, completedStandalone, allTasks) {
    var goalsHtml = completedGoals.map(function (g) {
      return goalCardHtml(workspace, g, allTasks);
    }).join("");
    var standaloneHtml = completedStandalone.length
      ? '<ul class="tt-standalone-list tt-standalone-list-completed">' +
          completedStandalone.map(function (t) { return taskRowHtml(workspace, t); }).join("") +
        '</ul>'
      : "";
    if (!goalsHtml && !standaloneHtml) {
      return '<div class="tt-empty-state">Nothing completed yet.</div>';
    }
    return goalsHtml + standaloneHtml;
  }

  function renderTasksTab(panel, d) {
    if (!panel) return;
    // [1.0.11.1] Mid-drag re-render suppression. Sortable's drag state lives
    // in the live DOM elements; if onChanged from another tab fires while a
    // local goal-drag is in progress, a renderTasksTab call would destroy
    // those elements and break the drag. The flag is set in the goal-list
    // Sortable's onStart and cleared in onEnd (see bindTasksTabSortables).
    // Centralised here so every caller — eager click handlers, modal
    // commits, and the cross-tab onChanged path — observes the same gate.
    if (panel.dataset.tasksDragActive === "true") return;

    // [1.0.11.17] D4 v2 — scroll position survival across panel rebuild.
    // The panel.innerHTML below replaces the old .tasks-tab element with a
    // new one whose scrollTop starts at 0. overflow-anchor: none (added
    // in [1.0.11.16]) only addresses the in-place anchor heuristic; it does
    // nothing for full DOM replacement. Capture the current scroll position
    // from the OLD .tasks-tab before the rewrite, restore on the NEW one
    // after. Defensive: optional-chain via `?` since pre-first-render the
    // panel has no .tasks-tab yet.
    var prevScroller = panel.querySelector(".tasks-tab");
    var savedScrollTop = prevScroller ? prevScroller.scrollTop : 0;

    var workspace = Storage.getActiveWorkspace(d);
    if (!workspace) {
      panel.innerHTML = '<div class="tasks-tab-empty">No active workspace.</div>';
      return;
    }

    var activeGoals = sortedByDisplayOrder(Storage.getActiveGoals(workspace));
    var completedGoals = sortedByDisplayOrder(Storage.getCompletedGoals(workspace));
    var allActiveTasks = Storage.getActiveTasks(workspace);
    var allCompletedTasks = Storage.getCompletedTasks(workspace);
    // Standalone = goalId === null AND not a recurring instance (per PLAN's
    // milestone definition). Recurring instances surface in their own
    // Recurring section once [1.0.14] generates them; for [1.0.10] we keep
    // them out of Standalone defensively even though no instances exist yet.
    var standaloneActive = sortedByDisplayOrder(allActiveTasks.filter(function (t) {
      return t.goalId === null && !t.isRecurringInstance;
    }));
    var standaloneCompleted = sortedByDisplayOrder(allCompletedTasks.filter(function (t) {
      return t.goalId === null && !t.isRecurringInstance;
    }));
    // For goal cards' child task lists we need both completed and active
    // children together so the progress bar counts work.
    var allTasksForGoals = (Storage.getAllTasks(workspace) || []);

    var recurringTemplates = Storage.getAllRecurringTemplates(workspace);
    // Stable sort: createdAt asc, mirroring the createTag sort in
    // renderProTagsSection.
    recurringTemplates = recurringTemplates.slice().sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    var activeGoalsHtml = activeGoals.length
      ? activeGoals.map(function (g) { return goalCardHtml(workspace, g, allTasksForGoals); }).join("")
      : '<div class="tt-empty-state">No active goals — create your first goal.</div>';

    var standaloneHtml = standaloneActive.length
      ? '<ul class="tt-standalone-list">' +
          standaloneActive.map(function (t) { return taskRowHtml(workspace, t); }).join("") +
        '</ul>'
      : '<div class="tt-empty-state">No standalone tasks.</div>';

    var recurringHtml = recurringTemplates.length
      ? '<ul class="tt-recurring-list">' +
          recurringTemplates.map(function (t) { return recurringRowHtml(workspace, t); }).join("") +
        '</ul>'
      : '<div class="tt-empty-state">No recurring tasks.</div>';

    var completedCount = completedGoals.length + standaloneCompleted.length;

    panel.innerHTML =
      '<div class="tasks-tab" data-tab="tasks">' +
        tasksHeaderHtml() +
        '<div class="tasks-body">' +
          '<section class="tt-section" data-section="active-goals">' +
            '<h2 class="tt-section-title">Active Goals</h2>' +
            '<div class="tt-goal-list">' + activeGoalsHtml + '</div>' +
          '</section>' +
          '<section class="tt-section" data-section="standalone">' +
            '<h2 class="tt-section-title">Standalone</h2>' +
            standaloneHtml +
          '</section>' +
          '<section class="tt-section" data-section="recurring">' +
            '<h2 class="tt-section-title">Recurring' +
              (recurringTemplates.length ? ' <span class="tt-section-count">' + recurringTemplates.length + '</span>' : '') +
            '</h2>' +
            recurringHtml +
          '</section>' +
          '<section class="tt-section tt-completed" data-section="completed" data-collapsed="true">' +
            '<h2 class="tt-section-title">' +
              '<button class="tt-completed-toggle" type="button" aria-expanded="false">' +
                '<span class="tt-completed-chevron">' + CHEVRON_RIGHT_SVG + '</span>' +
                '<span>Completed' + (completedCount ? ' (' + completedCount + ')' : '') + '</span>' +
              '</button>' +
            '</h2>' +
            '<div class="tt-completed-body hidden">' +
              completedBodyHtml(workspace, completedGoals, standaloneCompleted, allTasksForGoals) +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';

    bindTasksTabEvents(panel);
    bindTasksTabSortables(panel, d);

    // [1.0.11.17] D4 v2 — restore scrollTop on the fresh .tasks-tab. If the
    // saved value exceeds the new scrollHeight (e.g., a tab with fewer items
    // after the change), the browser clamps automatically, which is the
    // desired behavior.
    var newScroller = panel.querySelector(".tasks-tab");
    if (newScroller && savedScrollTop) {
      newScroller.scrollTop = savedScrollTop;
    }
  }

  function bindTasksTabEvents(panel) {
    // Bind once per panel — the listeners attach to the panel container,
    // not to its inner DOM, so re-renders that wipe innerHTML don't drop
    // them. A simple flag on the panel element prevents stacking N listeners
    // after N re-renders. Event delegation via target.closest() keeps the
    // handlers working against the freshly-rendered children.
    if (panel.dataset.tasksTabBound === "1") return;
    panel.dataset.tasksTabBound = "1";

    panel.addEventListener("change", async function (e) {
      var target = e.target;
      if (!target || !target.classList) return;

      // Filter dropdowns — logic deferred to [1.0.12]; keep the noop log so
      // the user sees the placeholder until that ships.
      if (target.closest && target.closest(".tasks-filter")) {
        console.log("[1.0.10] noop — filter logic in 1.0.12 (" + target.getAttribute("data-filter") + ")");
        return;
      }

      // Task complete / reactivate via row checkbox.
      if (!target.classList.contains("tt-task-check")) return;
      var taskId = target.getAttribute("data-task-id");
      if (!taskId) return;
      var willComplete = target.checked;
      try {
        if (willComplete) {
          await Storage.completeTask(data, taskId);
        } else {
          await Storage.reactivateTask(data, taskId);
        }
      } catch (err) {
        console.error("[LaunchPad] Tasks tab: task toggle failed", err);
      }
      // Eager re-render so the user sees the new progress bar / completion
      // styling without waiting for the storage.onChanged round-trip. The
      // round-trip's re-render that follows is harmless (same data).
      renderTasksTab(panel, data);
    });

    panel.addEventListener("click", async function (e) {
      var target = e.target;
      if (!target) return;

      // [1.0.11] Goal card chevron — toggle goal.isCollapsed in storage,
      // then eager-render. stopPropagation so the click does not bubble to
      // future drag handles ([1.0.11.1]) or the goal-name inline-edit /
      // three-dot handlers below in this same delegation; the early `return`
      // already prevents the latter two within this listener, but
      // stopPropagation also covers any non-delegated parent listeners.
      var goalChevron = target.closest && target.closest(".tt-goal-chevron");
      if (goalChevron) {
        e.stopPropagation();
        var goalCard = goalChevron.closest(".tt-goal-card");
        if (!goalCard) return;
        var goalCardId = goalCard.getAttribute("data-goal-id");
        if (!goalCardId) return;
        var currentlyCollapsed = goalCard.getAttribute("data-collapsed") === "true";
        try {
          await Storage.updateGoalCollapsed(data, goalCardId, !currentlyCollapsed);
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: goal collapse toggle failed", err);
        }
        // Eager re-render — same convention as the task-checkbox handler in
        // the change listener above. The storage.onChanged round-trip
        // re-render that follows is harmless (same data).
        renderTasksTab(panel, data);
        return;
      }

      // Completed section chevron toggle.
      var toggleBtn = target.closest && target.closest(".tt-completed-toggle");
      if (toggleBtn) {
        var section = toggleBtn.closest(".tt-completed");
        if (!section) return;
        var collapsed = section.getAttribute("data-collapsed") !== "false";
        section.setAttribute("data-collapsed", collapsed ? "false" : "true");
        toggleBtn.setAttribute("aria-expanded", collapsed ? "true" : "false");
        var body = section.querySelector(".tt-completed-body");
        if (body) body.classList.toggle("hidden", !collapsed);
        return;
      }

      // Goal three-dot menu button — open context menu anchored at the button.
      var menuBtn = target.closest && target.closest(".tt-goal-menu-btn");
      if (menuBtn) {
        e.preventDefault();
        e.stopPropagation();
        var goalId = menuBtn.getAttribute("data-goal-id");
        var rect = menuBtn.getBoundingClientRect();
        openGoalContextMenu(rect.right, rect.bottom + 4, goalId);
        return;
      }

      // "+ Add task" button inside a goal card — reveal inline form.
      var addTaskBtn = target.closest && target.closest(".tt-goal-add-task");
      if (addTaskBtn) {
        var card = addTaskBtn.closest(".tt-goal-card");
        if (card) revealAddTaskInline(card);
        return;
      }

      // Inline add-task save / cancel buttons.
      var addSave = target.closest && target.closest(".tt-add-task-save");
      if (addSave) {
        var card2 = addSave.closest(".tt-goal-card");
        if (card2) commitAddTaskInline(card2);
        return;
      }
      var addCancel = target.closest && target.closest(".tt-add-task-cancel");
      if (addCancel) {
        var card3 = addCancel.closest(".tt-goal-card");
        if (card3) hideAddTaskInline(card3);
        return;
      }

      // Inline rename for goal name.
      var goalNameSpan = target.closest && target.closest(".tt-goal-name");
      if (goalNameSpan && goalNameSpan.tagName === "SPAN") {
        var card4 = goalNameSpan.closest(".tt-goal-card");
        // Read-only on completed-section goals — match the menu/add-task
        // suppression in goalCardHtml.
        if (card4 && card4.classList.contains("is-completed")) return;
        var gid = goalNameSpan.getAttribute("data-goal-id");
        if (gid) startGoalNameEdit(goalNameSpan, gid);
        return;
      }

      // Inline rename for task name.
      var taskNameSpan = target.closest && target.closest(".tt-task-name");
      if (taskNameSpan && taskNameSpan.tagName === "SPAN") {
        var taskRow = taskNameSpan.closest(".tt-task-row");
        var tid = taskRow && taskRow.getAttribute("data-task-id");
        if (tid) startTaskNameEdit(taskNameSpan, tid);
        return;
      }

      // Header action buttons → create modals.
      var actionBtn = target.closest && target.closest(".tasks-action");
      if (actionBtn) {
        var action = actionBtn.getAttribute("data-action");
        if (action === "new-goal") openNewGoalModal();
        else if (action === "new-task") openNewTaskModal();
        else if (action === "new-recurring") openNewRecurringModal();
        return;
      }

      // Templates link → empty-state panel.
      var templatesLink = target.closest && target.closest(".tasks-templates-link");
      if (templatesLink) {
        e.preventDefault();
        openTemplatesPanel();
        return;
      }
    });

    // Right-click on goal card opens the context menu. The handler ignores
    // events that originate inside a text input so native browser context
    // menus on inline-edit / add-task inputs continue to work.
    panel.addEventListener("contextmenu", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      var card = e.target && e.target.closest && e.target.closest(".tt-goal-card");
      if (!card) return;
      // Completed-section cards are read-only; let the native menu through.
      if (card.classList.contains("is-completed")) return;
      var goalId = card.getAttribute("data-goal-id");
      if (!goalId) return;
      e.preventDefault();
      openGoalContextMenu(e.clientX, e.clientY, goalId);
    });

    // Inline add-task input keys: Enter commits, Escape cancels.
    panel.addEventListener("keydown", function (e) {
      var input = e.target && e.target.closest && e.target.closest(".tt-add-task-input");
      if (!input) return;
      if (e.key === "Enter") {
        e.preventDefault();
        var card = input.closest(".tt-goal-card");
        if (card) commitAddTaskInline(card);
      } else if (e.key === "Escape") {
        e.preventDefault();
        var card2 = input.closest(".tt-goal-card");
        if (card2) hideAddTaskInline(card2);
      }
    });
  }

  // [1.0.11.1] Bind a SortableJS instance to the Active Goals .tt-goal-list
  // for drag-to-reorder. Called at the end of every renderTasksTab so the
  // instance always points at the freshly-rendered DOM. The previous
  // instance (if any) is destroyed first to avoid stacking. Per the
  // [1.0.11] IMPLEMENTATION's surfaced concern, this picks option (a) —
  // registry-based destroy/rebind — for the [1.0.11.x] family. The same
  // panel-scoped registry shape (panel._sortables) and the panel.dataset
  // .tasksDragActive flag will be reused for task-level Sortable instances
  // in [1.0.11.2].
  function bindTasksTabSortables(panel, d) {
    if (!panel) return;
    panel._sortables = panel._sortables || {};
    if (panel._sortables.goalList) {
      panel._sortables.goalList.destroy();
      panel._sortables.goalList = null;
    }
    if (typeof Sortable === "undefined") {
      console.warn("[LaunchPad] SortableJS not loaded — Tasks tab drag disabled");
      return;
    }
    var listEl = panel.querySelector(".tt-goal-list");
    if (!listEl) return; // No active goals section in DOM (e.g., empty workspace).

    panel._sortables.goalList = new Sortable(listEl, {
      animation: 150,
      draggable: ".tt-goal-card",
      // [1.0.11.17] Explicit isolated group. Pre-[1.0.11.17] this Sortable
      // had no group option, relying on Sortable's anonymous-group default
      // to isolate it from the task Sortables (group: "tasks"). In practice
      // a goal card dragged over a .tt-goal-tasks list could nest into it
      // (filed and verified as bug 1214733591439504). Setting an explicit
      // name plus pull/put: false forces full isolation — goal cards can
      // only reorder within this list, nothing else can drop in.
      group: { name: "tt-goals", pull: false, put: false },
      // Drag handle is the goal header bar. Per PLAN D3, the handle gates
      // drag-start on mousedown+movement; a click without movement still
      // passes through to chevron / three-dot menu / inline-edit handlers.
      handle: ".tt-goal-header",
      // Defensive: never start a drag from inside a text input — the user
      // may be mid-edit on the goal name ([1.0.10.1] inline rename).
      // [1.0.11.16] Also exclude the three-dot menu button (.tt-goal-menu-btn,
      // [1.0.10.1] D6 fix); pre-existing [1.0.11.1] gap surfaced during
      // [1.0.11.15] verification — clicking the button initiated drag instead
      // of opening the menu because Sortable started tracking on a mousedown
      // inside the handle area, and a slight cursor twitch crossed the drag
      // threshold before the click registered.
      // [1.0.11.17] Chevron added to the filter — same root cause as
      // .tt-goal-menu-btn; cursor twitch on click crossed drag threshold and
      // initiated drag instead of toggling collapse. [1.0.11.16] left it
      // unfiltered on the theory that the click handler would beat drag
      // threshold; re-verification proved that too optimistic for real users.
      filter: ".tt-name-input, .tt-goal-menu-btn, .tt-goal-chevron",
      preventOnFilter: false,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      onStart: function () {
        panel.dataset.tasksDragActive = "true";
      },
      onEnd: function () {
        delete panel.dataset.tasksDragActive;
      },
      // onUpdate fires only when the order actually changed (not on a
      // pure click or a drag that ended in the same slot). Persist via
      // Storage.reorderGoals; the storage.onChanged round-trip then
      // re-renders Tasks tab and rebinds this Sortable. No eager
      // renderTasksTab here — Sortable already mutated the DOM into the
      // new order, so an immediate rebuild would only churn identical
      // content.
      onUpdate: async function () {
        try {
          var ws = Storage.getActiveWorkspace(d);
          if (!ws) return;
          var ids = [].slice.call(listEl.querySelectorAll(".tt-goal-card")).map(function (el) {
            return el.getAttribute("data-goal-id");
          }).filter(Boolean);
          await Storage.reorderGoals(d, ids, ws.id);
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: goal reorder failed", err);
        }
      }
    });

    // [1.0.11.15] Task list Sortables — cross-goal drag + standalone + name
    // collision modal. The storage layer (Storage.reassignTaskToGoal,
    // hasTaskNameCollision, generateUniqueTaskName) landed in [1.0.11.14];
    // this commit wires the UI side. One Sortable per active goal's
    // .tt-goal-tasks UL plus one on the active .tt-standalone-list. All share
    // group:'tasks' so drops are symmetric across all four directions
    // (goal→goal, goal→standalone, standalone→goal, within-list reorder).
    // Completed cards (.tt-goal-card.is-completed) and the completed
    // standalone list (.tt-standalone-list-completed) are excluded — those
    // sections are read-only by design; their task rows render in goalCardHtml
    // / completedBodyHtml but no Sortable binds to them.
    if (Array.isArray(panel._sortables.taskLists)) {
      panel._sortables.taskLists.forEach(function (s) { try { s.destroy(); } catch (e) {} });
    }
    panel._sortables.taskLists = [];

    var taskListEls = [];
    [].forEach.call(panel.querySelectorAll(".tt-goal-card:not(.is-completed) .tt-goal-tasks"), function (ul) {
      taskListEls.push(ul);
    });
    var standaloneList = panel.querySelector(".tt-standalone-list:not(.tt-standalone-list-completed)");
    if (standaloneList) taskListEls.push(standaloneList);

    // [1.0.11.16] Resolve the scroll container ONCE so all four task
    // Sortables share the same explicit reference. SortableJS's scroll
    // auto-detect walks up parents looking for overflow:auto/scroll, but
    // the path here (.tt-goal-tasks → .tt-goal-card → .tt-goal-list →
    // .tt-active-goals-section → .tasks-tab) was not reliably picked up
    // during D8 verification — auto-scroll near the viewport edge did not
    // fire. Passing the .tasks-tab element directly bypasses detection.
    var scrollContainerEl = panel.querySelector(".tasks-tab");

    taskListEls.forEach(function (taskListEl) {
      var s = new Sortable(taskListEl, {
        animation: 150,
        // Symmetric pull/put across all task lists in the panel — supports
        // goal↔goal, goal↔standalone, and within-list reorder. The string
        // form `group: "tasks"` would also work (default pull/put true) but
        // the object form documents intent at the call site.
        group: { name: "tasks", pull: true, put: true },
        draggable: ".tt-task-row",
        // Block drag-init on the checkbox so toggling complete still works,
        // and on the empty-state placeholder ("No tasks yet.") which is
        // visual filler not a real row. preventOnFilter: false keeps click
        // events propagating normally for the checkbox.
        filter: ".tt-task-check, .tt-task-empty",
        preventOnFilter: false,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        // [1.0.11.16] Explicit scroll container + slightly more sensitive
        // edge detection. Defaults (true / 30 / 10) failed to trigger
        // auto-scroll during D8 verification on the .tasks-tab container.
        scroll: scrollContainerEl || true,
        scrollSensitivity: 40,
        scrollSpeed: 12,
        onStart: function () { panel.dataset.tasksDragActive = "true"; },
        onEnd: async function (evt) {
          // Clear the drag-active flag BEFORE the async drop sequence so
          // the renderTasksTab at the end (which checks this flag) runs.
          delete panel.dataset.tasksDragActive;
          await handleTaskDrop(evt);
        }
      });
      panel._sortables.taskLists.push(s);
    });
  }

  // [1.0.11.15] Resolve the goalId for a Sortable container element.
  // Active task lists are either inside .tt-goal-card[data-goal-id] (goal
  // task list) or have class .tt-standalone-list (standalone bucket).
  // Returns null for standalone or when no card ancestor is found.
  function taskListGoalId(listEl) {
    if (!listEl) return null;
    if (listEl.classList && listEl.classList.contains("tt-standalone-list")) return null;
    var card = listEl.closest && listEl.closest(".tt-goal-card");
    return card ? card.getAttribute("data-goal-id") : null;
  }

  // [1.0.11.15] Rebuild displayOrder for the tasks visible in a single list
  // element. Walks the LI .tt-task-row direct descendants (children of
  // .tt-goal-tasks or .tt-standalone-list), looks each up in ws.tasks, and
  // assigns displayOrder = index. In-memory mutation only — the caller is
  // responsible for the subsequent Storage.saveAll. Idempotent on a list
  // whose visual order matches its data order (no-op assignments).
  function rebuildTaskDisplayOrderFromList(listEl, d) {
    if (!listEl) return;
    var ws = Storage.getActiveWorkspace(d);
    if (!ws || !Array.isArray(ws.tasks)) return;
    var taskById = {};
    ws.tasks.forEach(function (t) { taskById[t.id] = t; });
    var liEls = listEl.querySelectorAll(".tt-task-row");
    for (var i = 0; i < liEls.length; i++) {
      var tid = liEls[i].getAttribute("data-task-id");
      var t = taskById[tid];
      if (t) t.displayOrder = i;
    }
  }

  // [1.0.11.15] Undo a SortableJS drop's DOM mutation. Used by the
  // collision-modal cancel path and the standalone-disallow path so the
  // visual state matches the unchanged data. Sortable has already moved
  // evt.item into evt.to at evt.newIndex; we remove it and reinsert into
  // evt.from at evt.oldIndex. No event fires from this manual mutation
  // (we're outside Sortable's drag lifecycle by onEnd).
  function revertSortableDrop(evt) {
    if (!evt || !evt.item) return;
    if (evt.item.parentNode) evt.item.parentNode.removeChild(evt.item);
    var oldIndex = (typeof evt.oldIndex === "number") ? evt.oldIndex : 0;
    if (oldIndex < evt.from.children.length) {
      evt.from.insertBefore(evt.item, evt.from.children[oldIndex]);
    } else {
      evt.from.appendChild(evt.item);
    }
  }

  // [1.0.11.15] onEnd sequencer for the four drop cases.
  //
  // Case 1 — Intra-list reorder (evt.from === evt.to): just rebuild
  // displayOrder for that list, single saveAll, render.
  //
  // Case 2 / 4 — Cross-list with goal target: check collision via
  // Storage.hasTaskNameCollision. If clear, await reassignTaskToGoal +
  // rebuild displayOrder + saveAll + render. If collision, openTasksConfirmModal
  // suggesting the next-unique name; the user accepts (rename + reassign +
  // rebuild + save + render) or cancels (revert DOM, no write).
  //
  // Case 3 — Cross-list with standalone target: per the task description
  // Q5 = option C, DISALLOW on collision — revert DOM, showToast, no write.
  // No-collision drops to standalone go through the same reassignTaskToGoal
  // path as goal targets.
  //
  // Any thrown error from reassignTaskToGoal reverts the DOM and surfaces
  // a console.error — the storage method's defensive throws (Commit 1)
  // catch stale IDs / soft-deleted goals immediately, so the drag handler
  // doesn't silently no-op.
  // [1.0.11.16] Use module-level `data` and a fresh document.getElementById
  // lookup for the panel instead of closed-over references from
  // bindTasksTabSortables. The +New Task modal in [1.0.10.1] follows the
  // same pattern (newtab.js around line 1769). Across an async modal wait
  // a foreign-write listener can reassign the module-level `data`; the
  // closed-over `d` would then point to the prior data object and our
  // mutation/render would operate on stale state. Re-resolving here keeps
  // the drop applied to whatever data is current at commit time.
  async function handleTaskDrop(evt) {
    if (!evt || !evt.item) return;
    var taskId = evt.item.getAttribute("data-task-id");
    if (!taskId) return;

    var fromList = evt.from;
    var toList = evt.to;
    var isCrossList = fromList !== toList;

    function refreshPanel() {
      var panel = document.getElementById("tab-tasks");
      if (panel) renderTasksTab(panel, data);
    }

    var ws = Storage.getActiveWorkspace(data);
    var task = ws ? Storage.getTaskById(ws, taskId) : null;
    if (!task) {
      // Task no longer in storage — likely deleted in another tab mid-drag.
      revertSortableDrop(evt);
      return;
    }

    if (!isCrossList) {
      // Case 1 — intra-list reorder. No goalId change, no collision check.
      rebuildTaskDisplayOrderFromList(toList, data);
      try {
        await Storage.saveAll(data);
      } catch (err) {
        console.error("[LaunchPad] Tasks: intra-list reorder save failed", err);
        return;
      }
      refreshPanel();
      return;
    }

    var targetGoalId = taskListGoalId(toList);
    var taskName = task.name;

    var collides = Storage.hasTaskNameCollision(data, taskName, targetGoalId, taskId);

    if (collides && targetGoalId === null) {
      // Case 3 collision — standalone destination DISALLOWS the drop.
      revertSortableDrop(evt);
      showToast('A standalone task named "' + taskName + '" already exists.');
      return;
    }

    if (collides && targetGoalId !== null) {
      // Case 2 / 4 collision — goal destination prompts the user.
      var suggested = Storage.generateUniqueTaskName(data, taskName, targetGoalId, taskId);
      openTasksConfirmModal({
        title: "Name conflict",
        message: 'A task named "' + taskName + '" already exists in this goal. Rename to "' + suggested + '" or cancel?',
        confirmLabel: "Rename and add",
        onConfirm: async function () {
          // Defensive re-check on commit — another tab may have removed
          // the conflicting task in the meantime, in which case we don't
          // need to rename. Recompute the suggested name fresh either way
          // so a concurrent rename can't poison the displayed suggestion.
          var liveCollision = Storage.hasTaskNameCollision(data, taskName, targetGoalId, taskId);
          var opts = {};
          if (liveCollision) {
            opts.newName = Storage.generateUniqueTaskName(data, taskName, targetGoalId, taskId);
          }
          try {
            await Storage.reassignTaskToGoal(data, taskId, targetGoalId, opts);
            rebuildTaskDisplayOrderFromList(toList, data);
            rebuildTaskDisplayOrderFromList(fromList, data);
            await Storage.saveAll(data);
            refreshPanel();
          } catch (err) {
            console.error("[LaunchPad] Tasks: cross-list reassign (with rename) failed", err);
            revertSortableDrop(evt);
          }
        },
        onCancel: function () {
          revertSortableDrop(evt);
        }
      });
      return;
    }

    // No collision — direct reassignment.
    try {
      await Storage.reassignTaskToGoal(data, taskId, targetGoalId);
      rebuildTaskDisplayOrderFromList(toList, data);
      rebuildTaskDisplayOrderFromList(fromList, data);
      await Storage.saveAll(data);
      refreshPanel();
    } catch (err) {
      console.error("[LaunchPad] Tasks: cross-list reassign failed", err);
      revertSortableDrop(evt);
    }
  }

  // ===== Tasks tab interactivity helpers ([1.0.10.1]) =====
  //
  // Modal helper, context menu, inline edit, and inline add-task all live
  // here. State (which modal is open, which context menu is open) lives in
  // module-scope variables so close() reliably reaches into the same DOM
  // the open() created. Re-renders driven by Storage.* don't touch these
  // overlays — they mount to document.body via append, not into #tab-tasks,
  // so an innerHTML wipe of the panel doesn't blow them away.

  var tasksModalEl = null;
  var tasksModalEscapeHandler = null;
  var tasksContextMenuEl = null;
  var tasksContextMenuOutsideHandler = null;
  var tasksContextMenuEscapeHandler = null;

  function closeTasksModal() {
    if (tasksModalEscapeHandler) {
      document.removeEventListener("keydown", tasksModalEscapeHandler);
      tasksModalEscapeHandler = null;
    }
    if (tasksModalEl && tasksModalEl.parentNode) {
      tasksModalEl.parentNode.removeChild(tasksModalEl);
    }
    tasksModalEl = null;
  }

  // Single open-at-a-time modal. opts:
  //   title         — header copy
  //   bodyHtml      — innerHTML of the body region
  //   primaryLabel  — label on the primary button (default "Save")
  //   dangerous     — true => primary button gets the danger style
  //   defaultFocus  — "primary" | "cancel" | "first-input" (default "first-input")
  //   onMounted(el) — called after append (wire input handlers, prefill, etc.)
  //   onPrimary(el) — called on primary click; return false to keep modal open
  //                   (e.g., validation failure surfaces an inline error)
  //   onCancel()    — called on cancel / backdrop / Escape (optional)
  function openTasksModal(opts) {
    closeTasksModal();
    var overlay = document.createElement("div");
    overlay.className = "tt-modal-overlay";
    var titleHtml = opts.title ? '<div class="tt-modal-title">' + escapeHtml(opts.title) + '</div>' : "";
    var primaryLabel = opts.primaryLabel || "Save";
    var primaryClass = "tt-modal-btn tt-modal-primary" + (opts.dangerous ? " tt-modal-btn-danger" : " tt-modal-btn-primary-fill");
    overlay.innerHTML =
      '<div class="tt-modal" role="dialog" aria-modal="true">' +
        '<header class="tt-modal-header">' +
          titleHtml +
          '<button type="button" class="tt-modal-close" aria-label="Close">&times;</button>' +
        '</header>' +
        '<div class="tt-modal-body">' + (opts.bodyHtml || "") + '</div>' +
        '<footer class="tt-modal-footer">' +
          '<button type="button" class="tt-modal-btn tt-modal-cancel">Cancel</button>' +
          '<button type="button" class="' + primaryClass + '">' + escapeHtml(primaryLabel) + '</button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(overlay);
    tasksModalEl = overlay;

    function doCancel() {
      if (typeof opts.onCancel === "function") opts.onCancel();
      closeTasksModal();
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) doCancel();
    });
    overlay.querySelector(".tt-modal-close").addEventListener("click", doCancel);
    overlay.querySelector(".tt-modal-cancel").addEventListener("click", doCancel);

    var primaryBtn = overlay.querySelector(".tt-modal-primary");
    primaryBtn.addEventListener("click", async function () {
      if (typeof opts.onPrimary === "function") {
        var result = await opts.onPrimary(overlay);
        if (result === false) return;
      }
      closeTasksModal();
    });

    tasksModalEscapeHandler = function (e) {
      if (e.key === "Escape") doCancel();
    };
    document.addEventListener("keydown", tasksModalEscapeHandler);

    if (typeof opts.onMounted === "function") {
      opts.onMounted(overlay);
    }

    var focusTarget = null;
    if (opts.defaultFocus === "cancel") {
      focusTarget = overlay.querySelector(".tt-modal-cancel");
    } else if (opts.defaultFocus === "primary") {
      focusTarget = primaryBtn;
    } else {
      focusTarget = overlay.querySelector(".tt-modal-body input, .tt-modal-body textarea, .tt-modal-body select");
    }
    if (focusTarget) {
      try { focusTarget.focus(); } catch (e2) {}
      if (focusTarget.tagName === "INPUT" && focusTarget.type === "text") {
        try { focusTarget.select(); } catch (e3) {}
      }
    }

    return overlay;
  }

  // Confirmation modal. Default focus is on Cancel per PLAN D5 — Enter on
  // the focused Cancel button activates Cancel; Delete requires explicit
  // click or Tab+Enter. Prevents accidental deletes from Enter-spam.
  function openTasksConfirmModal(opts) {
    return openTasksModal({
      title: opts.title,
      bodyHtml: '<p class="tt-modal-message">' + escapeHtml(opts.message || "") + '</p>',
      primaryLabel: opts.confirmLabel || "Confirm",
      dangerous: !!opts.dangerous,
      defaultFocus: "cancel",
      onPrimary: opts.onConfirm
    });
  }

  // ----- Goal create / edit modal -----
  //
  // Shared form between New Goal and Edit Goal. New mode shows the
  // template-source dropdown stub and the auto-tag toggle (default ON);
  // Edit mode hides both — auto-tag toggle change post-creation would
  // require create-or-delete tag plumbing that's out of scope here, and
  // template instantiation only applies at creation time. Edit mode just
  // edits name + deadline.
  function openGoalModal(mode, existingGoal) {
    var isEdit = mode === "edit" && existingGoal;
    var nameValue = isEdit ? existingGoal.name : "";
    var deadlineValue = "";
    if (isEdit && typeof existingGoal.deadlineAt === "number") {
      deadlineValue = ymdFromTs(existingGoal.deadlineAt);
    }
    var autoTagBlock = isEdit ? "" :
      '<label class="tt-modal-row tt-modal-checkbox-row">' +
        '<input type="checkbox" class="tt-goal-autotag" checked>' +
        '<span>Auto-create tag from goal name</span>' +
      '</label>';
    var templateBlock = isEdit ? "" :
      '<div class="tt-modal-row">' +
        '<label class="tt-modal-label">From template</label>' +
        '<select class="tt-goal-template" disabled>' +
          '<option>(Templates available in 1.0.15)</option>' +
        '</select>' +
      '</div>';

    openTasksModal({
      title: isEdit ? "Edit goal" : "New goal",
      primaryLabel: isEdit ? "Save" : "Create",
      bodyHtml:
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-goal-name-input">Name</label>' +
          '<input type="text" id="tt-goal-name-input" class="tt-goal-name-input" maxlength="200" placeholder="Goal name" autocomplete="off" spellcheck="false" value="' + escapeHtml(nameValue) + '">' +
        '</div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-goal-deadline-input">Deadline</label>' +
          '<input type="date" id="tt-goal-deadline-input" class="tt-goal-deadline-input" value="' + escapeHtml(deadlineValue) + '">' +
        '</div>' +
        autoTagBlock +
        templateBlock +
        '<div class="tt-modal-error hidden" role="alert"></div>',
      onMounted: function (overlay) {
        var nameInput = overlay.querySelector(".tt-goal-name-input");
        nameInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            overlay.querySelector(".tt-modal-primary").click();
          }
        });
      },
      onPrimary: async function (overlay) {
        var nameInput = overlay.querySelector(".tt-goal-name-input");
        var deadlineInput = overlay.querySelector(".tt-goal-deadline-input");
        var autoTagInput = overlay.querySelector(".tt-goal-autotag");
        var errorEl = overlay.querySelector(".tt-modal-error");
        var name = (nameInput.value || "").trim();
        if (!name) {
          showModalError(errorEl, "Name is required.");
          nameInput.focus();
          return false;
        }
        var deadlineAt = parseDateInputToTs(deadlineInput.value);
        if (deadlineInput.value && deadlineAt === null) {
          showModalError(errorEl, "Deadline is not a valid date.");
          return false;
        }
        if (isEdit) {
          var renamed = await Storage.renameGoal(data, existingGoal.id, name);
          if (!renamed) { showModalError(errorEl, "Could not rename goal."); return false; }
          await Storage.updateGoalDeadline(data, existingGoal.id, deadlineAt);
        } else {
          var fields = { name: name, deadlineAt: deadlineAt, autoCreateTag: !!(autoTagInput && autoTagInput.checked) };
          var created = await Storage.createGoal(data, fields);
          if (!created) { showModalError(errorEl, "Could not create goal."); return false; }
        }
        var panel = document.getElementById("tab-tasks");
        if (panel) renderTasksTab(panel, data);
      }
    });
  }

  function openNewGoalModal() { openGoalModal("new"); }
  function openEditGoalModal(goal) { openGoalModal("edit", goal); }

  // ----- New Task modal (standalone) -----
  function openNewTaskModal() {
    var workspace = Storage.getActiveWorkspace(data);
    var availableTags = workspace ? Storage.getActiveTags(workspace) : [];
    var tagOptionsHtml = availableTags.map(function (tag) {
      return '<label class="tt-modal-checkbox-row tt-modal-tag-option">' +
        '<input type="checkbox" class="tt-task-tag" value="' + escapeHtml(tag.id) + '">' +
        '<span class="tt-tag-pill" style="background:' + escapeHtml(tag.color) + ';color:' + tagTextColorFor(tag.color) + '">' + escapeHtml(tag.name) + '</span>' +
      '</label>';
    }).join("");
    var tagsBlock = availableTags.length
      ? '<div class="tt-modal-row">' +
          '<label class="tt-modal-label">Tags</label>' +
          '<div class="tt-modal-tag-list">' + tagOptionsHtml + '</div>' +
        '</div>'
      : "";

    openTasksModal({
      title: "New task",
      primaryLabel: "Create",
      bodyHtml:
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-task-name-input">Name</label>' +
          '<input type="text" id="tt-task-name-input" class="tt-task-name-input" maxlength="200" placeholder="Task name" autocomplete="off" spellcheck="false">' +
        '</div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-task-priority-select">Priority</label>' +
          '<select id="tt-task-priority-select" class="tt-task-priority-select">' +
            '<option value="">None</option>' +
            '<option value="low">Low</option>' +
            '<option value="medium">Medium</option>' +
            '<option value="high">High</option>' +
            '<option value="urgent">Urgent</option>' +
          '</select>' +
        '</div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-task-due-input">Due date</label>' +
          '<input type="date" id="tt-task-due-input" class="tt-task-due-input">' +
        '</div>' +
        tagsBlock +
        '<div class="tt-modal-error hidden" role="alert"></div>',
      onMounted: function (overlay) {
        var nameInput = overlay.querySelector(".tt-task-name-input");
        nameInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            overlay.querySelector(".tt-modal-primary").click();
          }
        });
      },
      onPrimary: async function (overlay) {
        var nameInput = overlay.querySelector(".tt-task-name-input");
        var priorityInput = overlay.querySelector(".tt-task-priority-select");
        var dueInput = overlay.querySelector(".tt-task-due-input");
        var errorEl = overlay.querySelector(".tt-modal-error");
        var name = (nameInput.value || "").trim();
        if (!name) {
          showModalError(errorEl, "Name is required.");
          nameInput.focus();
          return false;
        }
        var dueAt = parseDateInputToTs(dueInput.value);
        if (dueInput.value && dueAt === null) {
          showModalError(errorEl, "Due date is not a valid date.");
          return false;
        }
        var priority = priorityInput.value || null;
        var tagIds = [].slice.call(overlay.querySelectorAll(".tt-task-tag:checked")).map(function (cb) { return cb.value; });
        var fields = { name: name, priority: priority, dueAt: dueAt, tagIds: tagIds };
        // Standalone — explicit goalId: null per PLAN.
        fields.goalId = null;
        var created = await Storage.createTask(data, fields);
        if (!created) { showModalError(errorEl, "Could not create task."); return false; }
        var panel = document.getElementById("tab-tasks");
        if (panel) renderTasksTab(panel, data);
      }
    });
  }

  // ----- New Recurring modal -----
  //
  // Conditional fields per frequency: weekly → 7 day-of-week toggles
  // (at least one required), monthly → day-of-month input. timeOfDay
  // defaults to '09:00' per the 2026-05-10 DECISIONS.md entry. The
  // conditional region is wrapped in a single .tt-recur-conditional
  // container that's swapped on frequency change.
  function openNewRecurringModal() {
    var DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var DOW_VALUES = [1, 2, 3, 4, 5, 6, 0];

    function conditionalHtml(frequency) {
      if (frequency === "weekly") {
        var togglesHtml = DOW_LABELS.map(function (label, i) {
          return '<label class="tt-modal-dow-toggle">' +
            '<input type="checkbox" class="tt-recur-dow" value="' + DOW_VALUES[i] + '">' +
            '<span>' + label + '</span>' +
          '</label>';
        }).join("");
        return '<div class="tt-modal-row">' +
            '<label class="tt-modal-label">Days of week</label>' +
            '<div class="tt-modal-dow-row">' + togglesHtml + '</div>' +
          '</div>';
      }
      if (frequency === "monthly") {
        return '<div class="tt-modal-row">' +
            '<label class="tt-modal-label" for="tt-recur-dom-input">Day of month</label>' +
            '<input type="number" id="tt-recur-dom-input" class="tt-recur-dom-input" min="1" max="31" value="1">' +
          '</div>';
      }
      return "";
    }

    openTasksModal({
      title: "New recurring task",
      primaryLabel: "Create",
      bodyHtml:
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-recur-name-input">Name</label>' +
          '<input type="text" id="tt-recur-name-input" class="tt-recur-name-input" maxlength="200" placeholder="Recurring task name" autocomplete="off" spellcheck="false">' +
        '</div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-recur-freq-select">Frequency</label>' +
          '<select id="tt-recur-freq-select" class="tt-recur-freq-select">' +
            '<option value="daily">Daily</option>' +
            '<option value="weekly">Weekly</option>' +
            '<option value="monthly">Monthly</option>' +
          '</select>' +
        '</div>' +
        '<div class="tt-recur-conditional"></div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-recur-time-input">Time of day</label>' +
          '<input type="time" id="tt-recur-time-input" class="tt-recur-time-input" value="09:00">' +
        '</div>' +
        '<label class="tt-modal-row tt-modal-checkbox-row">' +
          '<input type="checkbox" class="tt-recur-active" checked>' +
          '<span>Active</span>' +
        '</label>' +
        '<div class="tt-modal-error hidden" role="alert"></div>',
      onMounted: function (overlay) {
        var freqSelect = overlay.querySelector(".tt-recur-freq-select");
        var conditional = overlay.querySelector(".tt-recur-conditional");
        // Initial state: daily → no conditional fields.
        conditional.innerHTML = conditionalHtml("daily");
        freqSelect.addEventListener("change", function () {
          conditional.innerHTML = conditionalHtml(freqSelect.value);
        });
        var nameInput = overlay.querySelector(".tt-recur-name-input");
        nameInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            overlay.querySelector(".tt-modal-primary").click();
          }
        });
      },
      onPrimary: async function (overlay) {
        var nameInput = overlay.querySelector(".tt-recur-name-input");
        var freqSelect = overlay.querySelector(".tt-recur-freq-select");
        var timeInput = overlay.querySelector(".tt-recur-time-input");
        var activeInput = overlay.querySelector(".tt-recur-active");
        var errorEl = overlay.querySelector(".tt-modal-error");
        var name = (nameInput.value || "").trim();
        if (!name) {
          showModalError(errorEl, "Name is required.");
          nameInput.focus();
          return false;
        }
        var frequency = freqSelect.value;
        var fields = {
          name: name,
          frequency: frequency,
          timeOfDay: timeInput.value || "09:00",
          isActive: !!activeInput.checked,
          tagIds: []
        };
        if (frequency === "weekly") {
          var checked = [].slice.call(overlay.querySelectorAll(".tt-recur-dow:checked"));
          if (checked.length === 0) {
            showModalError(errorEl, "Pick at least one day of the week.");
            return false;
          }
          fields.daysOfWeek = checked.map(function (cb) { return parseInt(cb.value, 10); });
        } else if (frequency === "monthly") {
          var domInput = overlay.querySelector(".tt-recur-dom-input");
          var dom = parseInt(domInput.value, 10);
          if (!dom || dom < 1 || dom > 31) {
            showModalError(errorEl, "Day of month must be between 1 and 31.");
            return false;
          }
          fields.dayOfMonth = dom;
        }
        var created = await Storage.createRecurringTemplate(data, fields);
        if (!created || (created && created.err)) {
          showModalError(errorEl, (created && created.message) || "Could not create recurring task.");
          return false;
        }
        var panel = document.getElementById("tab-tasks");
        if (panel) renderTasksTab(panel, data);
      }
    });
  }

  // ----- Templates panel (stub) -----
  function openTemplatesPanel() {
    openTasksModal({
      title: "Goal templates",
      bodyHtml:
        '<div class="tt-templates-empty">' +
          '<div class="tt-templates-empty-title">No templates yet</div>' +
          '<div class="tt-templates-empty-sub">Save a goal as a template to get started. Full templates management lands in 1.0.15.</div>' +
        '</div>',
      primaryLabel: "Close",
      defaultFocus: "primary",
      onPrimary: function () { /* close */ }
    });
  }

  // ----- Goal context menu -----
  function closeGoalContextMenu() {
    if (tasksContextMenuOutsideHandler) {
      document.removeEventListener("click", tasksContextMenuOutsideHandler, true);
      tasksContextMenuOutsideHandler = null;
    }
    if (tasksContextMenuEscapeHandler) {
      document.removeEventListener("keydown", tasksContextMenuEscapeHandler);
      tasksContextMenuEscapeHandler = null;
    }
    if (tasksContextMenuEl && tasksContextMenuEl.parentNode) {
      tasksContextMenuEl.parentNode.removeChild(tasksContextMenuEl);
    }
    tasksContextMenuEl = null;
  }

  function openGoalContextMenu(x, y, goalId) {
    closeGoalContextMenu();
    if (!goalId) return;
    var menu = document.createElement("div");
    menu.className = "tt-context-menu";
    menu.innerHTML =
      '<button type="button" class="tt-ctx-item" data-action="edit">Edit</button>' +
      '<button type="button" class="tt-ctx-item" data-action="save-template">Save as template</button>' +
      '<button type="button" class="tt-ctx-item" data-action="complete">Mark complete</button>' +
      '<div class="tt-ctx-separator"></div>' +
      '<button type="button" class="tt-ctx-item tt-ctx-danger" data-action="delete">Delete</button>';
    document.body.appendChild(menu);

    // Position with viewport overflow guard. offsetWidth/Height read after
    // append.
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    var px = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    var py = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    menu.style.left = px + "px";
    menu.style.top = py + "px";

    tasksContextMenuEl = menu;

    menu.addEventListener("click", async function (e) {
      var btn = e.target && e.target.closest && e.target.closest(".tt-ctx-item");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      closeGoalContextMenu();
      var workspace = Storage.getActiveWorkspace(data);
      var goal = workspace && Storage.getGoalById(workspace, goalId);
      if (!goal) return;
      var panel = document.getElementById("tab-tasks");
      if (action === "edit") {
        openEditGoalModal(goal);
      } else if (action === "save-template") {
        showToast("Templates in 1.0.15");
      } else if (action === "complete") {
        await Storage.completeGoal(data, goalId);
        if (panel) renderTasksTab(panel, data);
      } else if (action === "delete") {
        var children = (workspace.tasks || []).filter(function (t) {
          return t.goalId === goalId && !t.deletedAt;
        });
        var msg = 'Delete goal "' + goal.name + '"?';
        if (children.length > 0) {
          msg += ' This will also remove its ' + children.length + ' task' + (children.length === 1 ? "" : "s") + '.';
        }
        openTasksConfirmModal({
          title: "Delete goal?",
          message: msg,
          confirmLabel: "Delete",
          dangerous: true,
          onConfirm: async function () {
            await Storage.deleteGoal(data, goalId);
            if (panel) renderTasksTab(panel, data);
          }
        });
      }
    });

    // Outside click closes the menu (delayed so the same click that opened
    // it doesn't immediately close it).
    tasksContextMenuOutsideHandler = function (e) {
      if (!menu.contains(e.target)) closeGoalContextMenu();
    };
    setTimeout(function () {
      document.addEventListener("click", tasksContextMenuOutsideHandler, true);
    }, 0);

    tasksContextMenuEscapeHandler = function (e) {
      if (e.key === "Escape") closeGoalContextMenu();
    };
    document.addEventListener("keydown", tasksContextMenuEscapeHandler);
  }

  // ----- Inline name edit (goal + task) -----
  //
  // Click-to-edit input swap. Blur OR Enter commits via the matching
  // Storage.rename* CRUD (which validates non-empty and case-distinct from
  // current). Escape cancels and reverts to display. The done flag prevents
  // a blur event firing after Enter from double-committing.

  function startGoalNameEdit(span, goalId) {
    if (span.dataset.editing === "1") return;
    span.dataset.editing = "1";
    var current = span.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "tt-name-input";
    input.value = current;
    input.maxLength = 200;
    span.replaceWith(input);
    input.focus();
    input.select();

    var done = false;
    function revertOrRerender() {
      var panel = document.getElementById("tab-tasks");
      if (panel) renderTasksTab(panel, data);
    }
    var commit = async function () {
      if (done) return;
      done = true;
      var newName = (input.value || "").trim();
      if (!newName || newName === current) {
        revertOrRerender();
        return;
      }
      var result = await Storage.renameGoal(data, goalId, newName);
      if (!result) { revertOrRerender(); return; }
      revertOrRerender();
    };
    var cancel = function () {
      if (done) return;
      done = true;
      revertOrRerender();
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
  }

  function startTaskNameEdit(span, taskId) {
    if (span.dataset.editing === "1") return;
    span.dataset.editing = "1";
    var current = span.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "tt-name-input";
    input.value = current;
    input.maxLength = 200;
    span.replaceWith(input);
    input.focus();
    input.select();

    var done = false;
    function rerender() {
      var panel = document.getElementById("tab-tasks");
      if (panel) renderTasksTab(panel, data);
    }
    var commit = async function () {
      if (done) return;
      done = true;
      var newName = (input.value || "").trim();
      if (!newName || newName === current) {
        rerender();
        return;
      }
      var result = await Storage.renameTask(data, taskId, newName);
      if (!result) { rerender(); return; }
      rerender();
    };
    var cancel = function () {
      if (done) return;
      done = true;
      rerender();
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
  }

  // ----- + Add task inline -----
  function revealAddTaskInline(card) {
    // Hide any other open inline form first — only one card at a time.
    document.querySelectorAll(".tt-add-task-inline:not(.hidden)").forEach(function (el) {
      if (el !== card.querySelector(".tt-add-task-inline")) {
        el.classList.add("hidden");
        var prevBtn = el.parentNode && el.parentNode.querySelector(".tt-goal-add-task");
        if (prevBtn) prevBtn.classList.remove("hidden");
      }
    });
    var inline = card.querySelector(".tt-add-task-inline");
    var btn = card.querySelector(".tt-goal-add-task");
    if (!inline) return;
    inline.classList.remove("hidden");
    if (btn) btn.classList.add("hidden");
    var input = inline.querySelector(".tt-add-task-input");
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  function hideAddTaskInline(card) {
    var inline = card.querySelector(".tt-add-task-inline");
    var btn = card.querySelector(".tt-goal-add-task");
    if (inline) inline.classList.add("hidden");
    if (btn) btn.classList.remove("hidden");
    var input = inline && inline.querySelector(".tt-add-task-input");
    if (input) input.value = "";
  }

  async function commitAddTaskInline(card) {
    var inline = card.querySelector(".tt-add-task-inline");
    var input = inline && inline.querySelector(".tt-add-task-input");
    if (!input) return;
    var name = (input.value || "").trim();
    var goalId = card.getAttribute("data-goal-id");
    if (!name || !goalId) {
      hideAddTaskInline(card);
      return;
    }
    var created = await Storage.createTask(data, { name: name, goalId: goalId });
    if (!created) {
      console.warn("[LaunchPad] Tasks tab: createTask failed");
    }
    var panel = document.getElementById("tab-tasks");
    if (panel) renderTasksTab(panel, data);
  }

  // ----- Small helpers -----
  function showModalError(errorEl, msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  // hex -> relative luminance in [0, 1]. Simplified Rec 601 weights —
  // sufficient for tag pill contrast decisions and avoids the sRGB
  // gamma-correction code path. Storage validates 6-char hex via
  // /^#[0-9A-Fa-f]{6}$/, but the helper accepts 3-char too (and a missing
  // leading #) so a future caller passing CSS shorthand still works.
  // Returns 0 for missing/malformed input — that maps to white text via
  // tagTextColorFor, preserving pre-fix behavior for unrecognized colors.
  function getLuminance(hex) {
    if (typeof hex !== "string") return 0;
    var h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return 0;
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // Threshold 0.55 (slightly above the 0.5 midpoint) so borderline pills
  // err toward dark text — the safer accessibility failure mode.
  function tagTextColorFor(hex) {
    return getLuminance(hex) > 0.55 ? "#1a1a1a" : "#ffffff";
  }

  // Date input <-> epoch ms helpers. <input type="date"> reads/writes
  // YYYY-MM-DD. We persist as UTC midnight epoch ms so the same date
  // surfaces consistently across timezones in the goal/task storage.
  function ymdFromTs(ts) {
    if (typeof ts !== "number") return "";
    try {
      var d = new Date(ts);
      var y = d.getUTCFullYear();
      var m = String(d.getUTCMonth() + 1).padStart(2, "0");
      var day = String(d.getUTCDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    } catch (e) {
      return "";
    }
  }
  function parseDateInputToTs(value) {
    if (!value) return null;
    var parts = value.split("-");
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!y || !m || !d) return null;
    var ts = Date.UTC(y, m - 1, d);
    if (isNaN(ts)) return null;
    return ts;
  }

  // ===== Pro Upgrade CTA =====
  //
  // A fifth element on the right side of the tab bar pill. Its label,
  // visual treatment, and click destination derive from the user's access
  // level + active tab + trial-used state. Free / expired users on a Pro
  // tab get a 2s pulse via a CSS @keyframes class (no JS animation).
  //
  // Click routing:
  //   - Pro user (active / grace) -> Pro Settings panel directly.
  //   - Everyone else -> upgrade popover anchored to the CTA pill.
  //   The same popover opens from the [1.0.4] preview banner trial link.
  //
  // The trial countdown text is re-derived every 60s by a page-scope
  // setInterval so the label updates without a reload.

  var ctaCountdownTimer = null;
  var CHECK_PRO_SVG = '<svg class="tab-cta-pro-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  function applyCtaState(d) {
    var cta = $("#tab-cta");
    if (!cta) return;
    var labelEl = cta.querySelector(".tab-cta-label");
    if (!labelEl) return;

    var level = (typeof ProAccess !== "undefined" && d) ? ProAccess.getProAccessLevel(d) : "free";
    var trialUsed = !!(d && d.pro && d.pro.trialStartedAt);
    var onProTab = PRO_TAB_IDS.indexOf(activeTab) !== -1;

    cta.classList.remove("hidden", "is-pulsing", "tab-cta-trial", "tab-cta-pro");

    var labelHtml, ariaLabel;

    if (level === "active" || level === "grace") {
      // State F — Pro badge
      cta.classList.add("tab-cta-pro");
      labelHtml = CHECK_PRO_SVG + '<span>Pro</span>';
      ariaLabel = "Open Pro Settings";
    } else if (level === "trialing") {
      // State E — trial countdown
      cta.classList.add("tab-cta-trial");
      var n = ProAccess.trialDaysRemaining(d);
      var fullText, shortText;
      if (n <= 0) {
        fullText = "Trial ends today";
        shortText = "Today";
      } else if (n === 1) {
        fullText = "Trial · 1 day left";
        shortText = "1d";
      } else {
        fullText = "Trial · " + n + " days left";
        shortText = n + "d";
      }
      labelHtml = '<span class="tab-cta-trial-text-full">' + fullText + '</span>' +
                  '<span class="tab-cta-trial-text-short">' + shortText + '</span>';
      ariaLabel = fullText;
    } else {
      // States A-D — free or expired upgrade CTA
      var ctaText = trialUsed ? "Upgrade" : "Start free trial";
      labelHtml = '<span>' + ctaText + '</span>';
      ariaLabel = ctaText;
      if (onProTab) cta.classList.add("is-pulsing");
    }

    labelEl.innerHTML = labelHtml;
    cta.setAttribute("aria-label", ariaLabel);
  }

  function bindUpgradeCta() {
    var cta = $("#tab-cta");
    if (!cta) return;
    cta.addEventListener("click", function (e) {
      e.stopPropagation();
      var level = ProAccess.getProAccessLevel(data);
      // Trialing / active / grace go straight to Pro Settings — they already have
      // an account context, so the upgrade popover would just be a stub-laden
      // detour. See DECISIONS.md 2026-04-26 "Trialing user CTA click bypasses
      // popover".
      if (level === "trialing" || level === "active" || level === "grace") {
        closeUpgradePopover();
        openPanel("pro-settings");
        return;
      }
      if (isUpgradePopoverOpen()) {
        closeUpgradePopover();
      } else {
        openUpgradePopover(cta, data);
      }
    });
  }

  function startCtaCountdown() {
    if (ctaCountdownTimer) {
      clearInterval(ctaCountdownTimer);
      ctaCountdownTimer = null;
    }
    ctaCountdownTimer = setInterval(function () {
      applyCtaState(data);
    }, 60 * 1000);
  }

  // ----- Upgrade popover -----

  var upgradePopoverEl = null;
  var upgradeEscapeHandler = null;
  var upgradeOutsideHandler = null;

  function isUpgradePopoverOpen() {
    return !!upgradePopoverEl && document.body.contains(upgradePopoverEl);
  }

  // [1.0.5.4] Dodo Test Mode product IDs and checkout host. Live mode swap
  // (DODO_API_BASE in license.js, manifest host_permissions, and these
  // constants) is a pre-launch task. test.checkout.* is the customer-facing
  // checkout host; test.dodopayments.com is the API base used by
  // LicenseClient. Both swap to live.* together.
  var DODO_PRODUCT_IDS = {
    monthly:  "pdt_0NeMmDtVpQQBAmjBhsNuE",
    annual:   "pdt_0NeMmvRkRY7z1b1jL3AaJ",
    lifetime: "pdt_0NeMo1X5TaL65hhFsgmPH"
  };
  var DODO_CHECKOUT_BASE = "https://test.checkout.dodopayments.com/buy/";

  function popoverTitleForState(d) {
    var trialUsed = !!(d && d.pro && d.pro.trialStartedAt);
    // Trialing / active / grace levels never reach the popover (CTA opens Pro
    // Settings directly per the 2026-04-26 routing decision), so only the
    // free / expired branches need copy here.
    return trialUsed
      ? "Upgrade to LaunchPad Pro"
      : "Try LaunchPad Pro free for 7 days";
  }

  function openUpgradePopover(anchorEl, d) {
    closeUpgradePopover();
    if (!anchorEl) return;
    var title = popoverTitleForState(d);
    var trialUsed = !!(d && d.pro && d.pro.trialStartedAt);

    // Trial primary stack only renders when the user hasn't started a trial.
    // Once the trial has been used (active or expired), the popover collapses
    // to "tier buttons + Already have a license?".
    var trialBlock = trialUsed ? "" :
      '<button type="button" class="up-primary">Start free trial</button>' +
      '<div class="up-or-divider"><span>or upgrade now</span></div>';

    var pop = document.createElement("div");
    pop.id = "upgrade-popover";
    pop.innerHTML =
      '<div class="up-header">' +
        '<div class="up-title">' + escapeHtml(title) + '</div>' +
        '<button type="button" class="up-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="up-subhead">Workspaces, tasks, time tracking, and more.</div>' +
      trialBlock +
      '<div class="up-tier-row">' +
        '<button type="button" class="up-tier" data-tier="monthly">Monthly</button>' +
        '<button type="button" class="up-tier" data-tier="annual">Annual</button>' +
        '<button type="button" class="up-tier" data-tier="lifetime">Lifetime</button>' +
      '</div>' +
      '<div class="up-divider"></div>' +
      '<button type="button" class="up-license-toggle">Already have a license?</button>' +
      '<div class="up-license-row hidden">' +
        '<input type="text" class="up-license-input" placeholder="Enter license key" autocomplete="off" spellcheck="false">' +
        '<button type="button" class="up-license-apply">Apply</button>' +
      '</div>' +
      '<div class="up-license-error hidden" role="alert"></div>';

    document.body.appendChild(pop);
    upgradePopoverEl = pop;
    positionUpgradePopover(anchorEl);

    pop.addEventListener("click", function (e) { e.stopPropagation(); });

    pop.querySelector(".up-close").addEventListener("click", closeUpgradePopover);

    // [1.0.5.4] Section E — Start free trial click handler. Sets the trial
    // window without persisting subscriptionStatus = 'free' anywhere; the
    // demotion at trial end is handled at read-time by getProAccessLevel
    // (DECISIONS.md 2026-05-09 PLAN comment, D3).
    //
    // Defense-in-depth guard: popoverTitleForState's !trialUsed branch is
    // what currently keeps this button from rendering when a trial has
    // already been used, but the click handler also bails if trialStartedAt
    // is set — protects against future surfaces that route here without the
    // gate. Rev 1 of [1.0.5.4] (commit fe18493 review).
    var primary = pop.querySelector(".up-primary");
    if (primary) {
      primary.addEventListener("click", async function () {
        if (data.pro && data.pro.trialStartedAt) return;
        if (!data.pro || typeof data.pro !== "object") data.pro = {};
        var now = Date.now();
        data.pro.trialStartedAt = now;
        data.pro.trialEndedAt = now + 7 * 24 * 60 * 60 * 1000;
        data.pro.subscriptionStatus = "trialing";
        await Storage.saveAll(data);
        closeUpgradePopover();
        applyAccessLevelUI();
        showToast("Trial started. Pro features unlocked for 7 days.");
      });
    }

    // [1.0.5.4] Section F — tier button → Dodo hosted checkout. Per-product
    // return_url is configured in the Dodo dashboard; do NOT pass redirect_url
    // as a query param. Background.js's onUpdated listener picks up the
    // license_key when checkout returns to mylaunchpad.me/checkout-return.html.
    pop.querySelectorAll(".up-tier").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tier = btn.dataset.tier;
        var pdtId = DODO_PRODUCT_IDS[tier];
        if (!pdtId) return;
        chrome.tabs.create({
          url: DODO_CHECKOUT_BASE + pdtId + "?quantity=1"
        });
        closeUpgradePopover();
      });
    });

    var toggle = pop.querySelector(".up-license-toggle");
    var row = pop.querySelector(".up-license-row");
    var input = pop.querySelector(".up-license-input");
    var applyBtn = pop.querySelector(".up-license-apply");
    var errorEl = pop.querySelector(".up-license-error");

    function showLicenseError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.classList.remove("hidden");
    }
    function clearLicenseError() {
      if (!errorEl) return;
      if (!errorEl.classList.contains("hidden")) {
        errorEl.classList.add("hidden");
        errorEl.textContent = "";
      }
    }

    toggle.addEventListener("click", function () {
      row.classList.remove("hidden");
      toggle.classList.add("hidden");
      input.focus();
      positionUpgradePopover(anchorEl);
    });

    input.addEventListener("input", clearLicenseError);

    // [1.0.5.4] Section B — Apply existing license form. Real ensureValidated
    // flow replacing the [1.0.5] stub. When the user pastes a different key
    // over an existing one, stale activation state is cleared first so the
    // new key flows through activate() rather than skipping it (which would
    // leave the new key unregistered on Dodo's side — round 1 review note
    // from [1.0.5.3]).
    //
    // Snapshot-and-restore: the pre-clear of instanceId / instanceName /
    // lastVerifiedAt / subscriptionStatus mutates data.pro IN MEMORY before
    // the network call. If validation then fails, any concurrent code path
    // that triggers Storage.saveAll (bookmark add, storage.onChanged
    // round-trip) would persist the corrupted state and silently strip the
    // user's Pro access. Capture the five fields license.js can mutate
    // (licenseKey + the four pre-cleared fields — activate() writes
    // licenseKey on success, so the activate-succeeds / validate-fails path
    // also needs it restored) and restore them on both the structured-
    // failure (else) and thrown-failure (catch) paths. Rev 1 of [1.0.5.4]
    // (commit fe18493 review); rev 2 added licenseKey to the snapshot
    // (commit 9a9a499 review).
    async function applyLicenseFromPopover() {
      var key = (input.value || "").trim();
      clearLicenseError();
      if (!key) {
        showLicenseError("Enter a license key.");
        input.focus();
        return;
      }
      if (typeof LicenseClient === "undefined") {
        showLicenseError("License module unavailable. Reload the page and try again.");
        return;
      }
      input.disabled = true;
      applyBtn.disabled = true;
      var oldText = applyBtn.textContent;
      applyBtn.textContent = "Checking...";

      var snapshot = null;
      try {
        if (!data.pro || typeof data.pro !== "object") data.pro = {};
        if (data.pro.licenseKey && data.pro.licenseKey !== key) {
          snapshot = {
            licenseKey: data.pro.licenseKey,
            instanceId: data.pro.instanceId,
            instanceName: data.pro.instanceName,
            lastVerifiedAt: data.pro.lastVerifiedAt,
            subscriptionStatus: data.pro.subscriptionStatus
          };
          data.pro.instanceId = null;
          data.pro.instanceName = null;
          data.pro.lastVerifiedAt = null;
          data.pro.subscriptionStatus = "free";
        }
        var result = await LicenseClient.ensureValidated(data, key, { force: true });
        if (result && result.ok) {
          await Storage.saveAll(data);
          input.value = "";
          closeUpgradePopover();
          // applyAccessLevelUI re-renders the Pro Settings sections when the
          // panel is visible (newtab.js:250-255), so no explicit re-render
          // is needed here.
          applyAccessLevelUI();
          showToast("License applied. Pro features now active.");
        } else {
          if (snapshot) Object.assign(data.pro, snapshot);
          var msg = (result && result.message) || "Could not validate license.";
          showLicenseError(msg);
        }
      } catch (err) {
        if (snapshot) Object.assign(data.pro, snapshot);
        showLicenseError((err && err.message) || "Unexpected error validating license.");
      } finally {
        input.disabled = false;
        applyBtn.disabled = false;
        applyBtn.textContent = oldText;
      }
    }

    applyBtn.addEventListener("click", applyLicenseFromPopover);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        applyLicenseFromPopover();
      }
    });

    upgradeEscapeHandler = function (e) {
      if (e.key === "Escape") closeUpgradePopover();
    };
    document.addEventListener("keydown", upgradeEscapeHandler);

    upgradeOutsideHandler = function (e) {
      var pop = document.getElementById("upgrade-popover");
      if (!pop) return;
      if (!e.target.isConnected) return;
      if (pop.contains(e.target)) return;
      // Allow re-clicking the CTA pill / banner anchor to toggle without instantly
      // reopening; the anchor's own click handler runs after this and decides.
      if (anchorEl && anchorEl.contains(e.target)) return;
      closeUpgradePopover();
    };
    // Defer attaching outside-click so the same click that opened it doesn't immediately close it.
    setTimeout(function () {
      document.addEventListener("click", upgradeOutsideHandler, true);
    }, 0);
  }

  function positionUpgradePopover(anchorEl) {
    if (!upgradePopoverEl || !anchorEl) return;
    var rect = anchorEl.getBoundingClientRect();
    // Popover sits below the anchor, right-aligned to the anchor's right edge
    // so it doesn't overflow the viewport on standard layouts.
    var top = rect.bottom + 8;
    var popWidth = upgradePopoverEl.offsetWidth || 320;
    var right = window.innerWidth - rect.right;
    var leftCandidate = rect.right - popWidth;
    if (leftCandidate < 8) {
      // Anchor is too close to the left edge — left-align to the anchor's left edge instead.
      upgradePopoverEl.style.left = Math.max(8, rect.left) + "px";
      upgradePopoverEl.style.right = "";
    } else {
      upgradePopoverEl.style.right = Math.max(8, right) + "px";
      upgradePopoverEl.style.left = "";
    }
    upgradePopoverEl.style.top = top + "px";
  }

  function closeUpgradePopover() {
    if (upgradeEscapeHandler) {
      document.removeEventListener("keydown", upgradeEscapeHandler);
      upgradeEscapeHandler = null;
    }
    if (upgradeOutsideHandler) {
      document.removeEventListener("click", upgradeOutsideHandler, true);
      upgradeOutsideHandler = null;
    }
    if (upgradePopoverEl && upgradePopoverEl.parentNode) {
      upgradePopoverEl.parentNode.removeChild(upgradePopoverEl);
    }
    upgradePopoverEl = null;
  }

  // ===== Workspaces =====
  //
  // The switcher widget at the top of the sidebar lets Pro / trialing /
  // grace users move between workspaces. Free / expired users don't see
  // it at all (their data lives in a single workspace). The Pro Settings
  // panel hosts the full Add / Rename / Reorder / Delete CRUD; this
  // section also handles read-only state rendering after a Pro -> free
  // downgrade with multiple workspaces.

  var WORKSPACE_PALETTE = [
    "#4A90E2", "#50C878", "#E08E4A", "#A569BD",
    "#E74C3C", "#F1C40F", "#1ABC9C", "#FF7AC6"
  ];
  var workspaceDropdownEl = null;
  var workspaceDropdownEscapeHandler = null;
  var workspaceDropdownOutsideHandler = null;
  var workspaceSortable = null;

  function workspaceColorForIndex(i) {
    return WORKSPACE_PALETTE[((i % WORKSPACE_PALETTE.length) + WORKSPACE_PALETTE.length) % WORKSPACE_PALETTE.length];
  }

  function workspaceFirstLetter(name) {
    var s = (name || "").trim();
    if (!s) return "?";
    return s.charAt(0).toUpperCase();
  }

  function workspaceIndexInOrder(d, id) {
    if (!d || !Array.isArray(d.workspaceOrder)) return 0;
    var idx = d.workspaceOrder.indexOf(id);
    return idx === -1 ? 0 : idx;
  }

  function genWorkspaceId() {
    return "ws-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function applyWorkspaceSwitcherState(d) {
    var btn = $("#sb-workspace-switcher");
    if (!btn) return;
    var level = (typeof ProAccess !== "undefined" && d) ? ProAccess.getProAccessLevel(d) : "free";
    var visible = isProAccessibleLevel(level);
    btn.classList.toggle("hidden", !visible);
    if (!visible) {
      closeWorkspaceDropdown();
      return;
    }
    var ws = Storage.getActiveWorkspace(d);
    if (!ws) return;
    var chip = btn.querySelector(".sb-ws-chip");
    var name = btn.querySelector(".sb-ws-name");
    var idx = workspaceIndexInOrder(d, ws.id);
    if (chip) {
      chip.style.background = workspaceColorForIndex(idx);
      chip.textContent = workspaceFirstLetter(ws.name);
      chip.classList.toggle("is-readonly", !!ws.isReadOnly);
    }
    if (name) name.textContent = ws.name || ws.id;
    btn.setAttribute("title", "Workspace: " + (ws.name || ws.id));
  }

  function bindWorkspaceSwitcher() {
    var btn = $("#sb-workspace-switcher");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (isWorkspaceDropdownOpen()) {
        closeWorkspaceDropdown();
        return;
      }
      // Lock + expand sidebar so the dropdown anchors to a known layout.
      sidebarLocked = true;
      var sidebar = $("#sidebar");
      if (sidebar) {
        sidebar.classList.add("sidebar-locked");
        sidebar.classList.add("expanded");
      }
      showSidebarPanel();
      openWorkspaceDropdown(btn);
    });
  }

  function isWorkspaceDropdownOpen() {
    return !!workspaceDropdownEl && document.body.contains(workspaceDropdownEl);
  }

  function openWorkspaceDropdown(anchorEl) {
    closeWorkspaceDropdown();
    if (!anchorEl) return;
    var dd = document.createElement("div");
    dd.id = "workspace-dropdown";
    dd.appendChild(buildWorkspaceDropdownBody(false));
    document.body.appendChild(dd);
    workspaceDropdownEl = dd;
    positionWorkspaceDropdown(anchorEl);

    dd.addEventListener("click", function (e) { e.stopPropagation(); });

    workspaceDropdownEscapeHandler = function (e) {
      if (e.key === "Escape") closeWorkspaceDropdown();
    };
    document.addEventListener("keydown", workspaceDropdownEscapeHandler);

    workspaceDropdownOutsideHandler = function (e) {
      // Re-query the live dropdown so a stale closure reference can't make
      // contains() falsely return false. If the click target was detached
      // during its own handler, treat it as in-flight DOM mutation, not an
      // outside click.
      var dd = document.getElementById("workspace-dropdown");
      if (!dd) return;
      if (!e.target.isConnected) return;
      if (dd.contains(e.target)) return;
      if (anchorEl && anchorEl.contains(e.target)) return;
      closeWorkspaceDropdown();
    };
    setTimeout(function () {
      document.addEventListener("click", workspaceDropdownOutsideHandler, true);
    }, 0);
  }

  function buildWorkspaceDropdownBody(showAddInput) {
    var frag = document.createDocumentFragment();
    var order = (data && data.workspaceOrder) || [];
    var byId = {};
    (data && data.workspaces || []).forEach(function (w) { byId[w.id] = w; });

    order.forEach(function (id, idx) {
      var ws = byId[id];
      if (!ws) return;
      var row = document.createElement("button");
      row.type = "button";
      row.className = "ws-dd-row";
      row.dataset.workspaceId = id;
      var color = workspaceColorForIndex(idx);
      var lockHtml = ws.isReadOnly
        ? '<svg class="ws-dd-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        : '';
      var checkHtml = (ws.id === data.activeWorkspaceId)
        ? '<svg class="ws-dd-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
        : '';
      row.innerHTML =
        '<span class="sb-ws-chip' + (ws.isReadOnly ? ' is-readonly' : '') + '" style="background:' + color + '">' + escapeHtml(workspaceFirstLetter(ws.name)) + '</span>' +
        '<span class="ws-dd-name">' + escapeHtml(ws.name || ws.id) + '</span>' +
        lockHtml + checkHtml;
      row.addEventListener("click", function () {
        switchWorkspace(id);
      });
      frag.appendChild(row);
    });

    var divider = document.createElement("div");
    divider.className = "ws-dd-divider";
    frag.appendChild(divider);

    if (showAddInput) {
      var inputRow = document.createElement("div");
      inputRow.className = "ws-dd-input-row";
      inputRow.innerHTML =
        '<input type="text" class="ws-dd-input" placeholder="Workspace name" autocomplete="off" spellcheck="false" maxlength="48">' +
        '<button type="button" class="ws-dd-create">Create</button>';
      var input = inputRow.querySelector(".ws-dd-input");
      var createBtn = inputRow.querySelector(".ws-dd-create");
      var submit = function () {
        var name = (input.value || "").trim();
        if (!name) {
          showToast("Workspace name required");
          input.focus();
          return;
        }
        createWorkspace(name);
      };
      createBtn.addEventListener("click", submit);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") { e.preventDefault(); refreshWorkspaceDropdown(false); }
      });
      frag.appendChild(inputRow);
      // Defer focus until after appendChild
      setTimeout(function () { input.focus(); }, 0);
    } else {
      var addRow = document.createElement("button");
      addRow.type = "button";
      addRow.className = "ws-dd-row ws-dd-add";
      addRow.innerHTML =
        '<span class="ws-dd-add-glyph">+</span>' +
        '<span class="ws-dd-name">Add workspace</span>';
      addRow.addEventListener("click", function () {
        refreshWorkspaceDropdown(true);
      });
      frag.appendChild(addRow);
    }
    return frag;
  }

  function refreshWorkspaceDropdown(showAddInput) {
    if (!workspaceDropdownEl) return;
    workspaceDropdownEl.innerHTML = "";
    workspaceDropdownEl.appendChild(buildWorkspaceDropdownBody(!!showAddInput));
    var anchor = $("#sb-workspace-switcher");
    if (anchor) positionWorkspaceDropdown(anchor);
  }

  function positionWorkspaceDropdown(anchorEl) {
    if (!workspaceDropdownEl || !anchorEl) return;
    var rect = anchorEl.getBoundingClientRect();
    workspaceDropdownEl.style.top = (rect.bottom + 4) + "px";
    // Sidebar is at left, so dropdown sits aligned with the switcher's left edge.
    workspaceDropdownEl.style.left = Math.max(8, rect.left) + "px";
  }

  function closeWorkspaceDropdown() {
    // No-op when nothing is open. openWorkspaceDropdown calls this
    // preventatively at the top of its body — without this guard, the
    // sidebarLocked = true that bindWorkspaceSwitcher's click handler just
    // set would be clobbered back to false before the dropdown renders, and
    // a subsequent mouseleave would collapse the sidebar to 48px while the
    // dropdown stays anchored to the now-orphan switcher position.
    if (!workspaceDropdownEl && !workspaceDropdownEscapeHandler && !workspaceDropdownOutsideHandler) {
      return;
    }
    if (workspaceDropdownEscapeHandler) {
      document.removeEventListener("keydown", workspaceDropdownEscapeHandler);
      workspaceDropdownEscapeHandler = null;
    }
    if (workspaceDropdownOutsideHandler) {
      document.removeEventListener("click", workspaceDropdownOutsideHandler, true);
      workspaceDropdownOutsideHandler = null;
    }
    if (workspaceDropdownEl && workspaceDropdownEl.parentNode) {
      workspaceDropdownEl.parentNode.removeChild(workspaceDropdownEl);
    }
    workspaceDropdownEl = null;
    // Release the sidebar lock the switcher acquired on open. Mouseleave
    // on the sidebar will then collapse it via existing handlers.
    sidebarLocked = false;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.remove("sidebar-locked");
      if (!sidebar.matches(":hover")) {
        sidebar.classList.remove("expanded");
        hideSidebarPanel();
      }
    }
  }

  async function switchWorkspace(workspaceId) {
    if (!workspaceId || workspaceId === data.activeWorkspaceId) {
      closeWorkspaceDropdown();
      return;
    }
    var exists = (data.workspaces || []).some(function (w) { return w.id === workspaceId; });
    if (!exists) {
      closeWorkspaceDropdown();
      return;
    }
    var grid = document.getElementById("tab-home");
    if (grid) grid.classList.add("is-swapping");
    closeWorkspaceDropdown();
    setTimeout(async function () {
      data.activeWorkspaceId = workspaceId;
      // [1.0.11.5] Workspace switch is a context reset, not a prune. Each
      // workspace is its own sidebar context, so expansion does not carry
      // across switches — even for groups whose IDs happen to exist in
      // both workspaces (notably "ungrouped", which lives in every
      // workspace with the same ID and would otherwise survive a groupOrder
      // prune). Full clear here; pruneSidebarExpandedGroupIds() in
      // renderSidebarGroups still handles the group-delete case where an
      // ID outlives its group within a single workspace.
      sidebarExpandedGroupIds.clear();
      await Storage.saveAll(data);
      render();
      applyWorkspaceSwitcherState(data);
      requestAnimationFrame(function () {
        if (grid) grid.classList.remove("is-swapping");
      });
    }, 150);
  }

  async function createWorkspace(name) {
    var trimmed = (name || "").trim();
    if (!trimmed) {
      showToast("Workspace name required");
      return;
    }
    var id = genWorkspaceId();
    if (!Array.isArray(data.workspaces)) data.workspaces = [];
    if (!Array.isArray(data.workspaceOrder)) data.workspaceOrder = [];
    data.workspaces.push({
      id: id,
      name: trimmed,
      createdAt: Date.now(),
      isReadOnly: false,
      groupOrder: ["ungrouped"],
      groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null }],
      goals: [],
      tasks: [],
      tags: [],
      tracking: {}
    });
    data.workspaceOrder.push(id);
    data.activeWorkspaceId = id;
    // [1.0.11.5] Symmetric with switchWorkspace — workspace transition is a
    // context reset (see comment there). Clear, not prune.
    sidebarExpandedGroupIds.clear();
    await Storage.saveAll(data);
    render();
    applyWorkspaceSwitcherState(data);
    closeWorkspaceDropdown();
    if ($("#pro-settings-panel") && !$("#pro-settings-panel").classList.contains("hidden")) {
      renderProWorkspaceList();
    }
    showToast("Workspace created");
  }

  async function renameWorkspace(id, newName) {
    var trimmed = (newName || "").trim();
    if (!trimmed) return false;
    var ws = (data.workspaces || []).find(function (w) { return w.id === id; });
    if (!ws) return false;
    if (ws.isReadOnly) return false;
    if (ws.name === trimmed) return true;
    ws.name = trimmed;
    await Storage.saveAll(data);
    applyWorkspaceSwitcherState(data);
    return true;
  }

  async function deleteWorkspace(id) {
    var ws = (data.workspaces || []).find(function (w) { return w.id === id; });
    if (!ws) return;
    if ((data.workspaces || []).length <= 1) {
      showToast("You need at least one workspace");
      return;
    }
    var ok = window.confirm("Delete workspace \"" + ws.name + "\"? This cannot be undone.");
    if (!ok) return;
    data.workspaces = data.workspaces.filter(function (w) { return w.id !== id; });
    data.workspaceOrder = data.workspaceOrder.filter(function (wid) { return wid !== id; });
    var activeChanged = (data.activeWorkspaceId === id);
    if (activeChanged) {
      data.activeWorkspaceId = data.workspaceOrder[0];
    }
    // [1.0.11.5] When the active workspace itself is being deleted, treat
    // it like a workspace switch — full context reset. When a non-active
    // workspace is deleted, the active sidebar state is untouched and the
    // Set stays as the user left it; renderSidebarGroups' prune on the
    // next render is sufficient if anything went stale.
    if (activeChanged) sidebarExpandedGroupIds.clear();
    await Storage.saveAll(data);
    render();
    applyWorkspaceSwitcherState(data);
    renderProWorkspaceList();
    showToast("Workspace deleted");
  }

  async function reorderWorkspaces(orderedIds) {
    if (!Array.isArray(orderedIds)) return;
    data.workspaceOrder = orderedIds.slice();
    await Storage.saveAll(data);
    applyWorkspaceSwitcherState(data);
  }

  function renderReadOnlyBanner() {
    var existing = document.getElementById("workspace-readonly-banner");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var ws = Storage.getActiveWorkspace(data);
    if (!ws || !ws.isReadOnly) return;
    var grid = document.getElementById("shortcut-grid-area");
    if (!grid) return;
    var banner = document.createElement("div");
    banner.id = "workspace-readonly-banner";
    banner.className = "workspace-readonly-banner";
    banner.innerHTML =
      '<span class="workspace-readonly-banner-text">This workspace is read-only. Upgrade to Pro to edit.</span>' +
      '<a href="#" class="workspace-readonly-banner-cta" data-readonly-cta>Upgrade</a>';
    grid.insertBefore(banner, grid.firstChild);
    var cta = banner.querySelector("[data-readonly-cta]");
    if (cta) {
      cta.addEventListener("click", function (e) {
        e.preventDefault();
        if (typeof openUpgradePopover === "function") {
          openUpgradePopover(cta, data);
        } else {
          showToast("Upgrade flow coming soon");
        }
      });
    }
  }

  var DAY_MS_LOCAL = 24 * 60 * 60 * 1000;

  function bindProSettings() {
    safeOn("#sb-pro-settings", "click", function (e) {
      e.stopPropagation();
      openPanel("pro-settings");
    });
    safeOn("#pro-settings-close", "click", function () { closeProSettingsPanel(); });
    safeOn("#pro-license-apply", "click", handleLicenseApply);
    safeOn("#pro-license-clear", "click", handleLicenseClear);
    safeOn("#pro-license-check", "click", handleLicenseCheckNow);
    var input = $("#pro-license-input");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleLicenseApply();
        }
      });
    }
    bindProTagsControls();
  }

  function openProSettingsPanel() {
    var panel = $("#pro-settings-panel");
    if (!panel) return;
    if (!panel.classList.contains("hidden")) { closeProSettingsPanel(); return; }

    // [1.0.11.12] Cross-panel mutual exclusion is handled by openPanel().
    // hideGroupMenu is kept here because it is orthogonal to the sidebar
    // panel chain (group-context-menu vs. sidebar panel).
    hideGroupMenu();

    sidebarLocked = true;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.add("sidebar-locked");
      sidebar.classList.add("expanded");
    }
    showSidebarPanel();

    panel.classList.remove("hidden");
    var versionEl = $("#pro-settings-version");
    if (versionEl) versionEl.textContent = "LaunchPad v" + chrome.runtime.getManifest().version;
    renderProSubscriptionSection();
    renderProLicenseSection();
    renderProTagsSection();
    renderProWorkspaceList();
    renderProAnalyticsToggle();
  }

  function closeProSettingsPanel(opts) {
    var panel = $("#pro-settings-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    panel.classList.add("hidden");

    closeTagPalettePopover();
    clearPendingTagDelete();
    closeTagCreateForm();

    // [1.0.11.12] silent close — used by openPanel() during a panel swap
    // to keep sidebarLocked = true throughout. Without this, closing the
    // outgoing panel unsets the lock and the incoming open immediately
    // re-sets it, briefly flickering the sidebar's expanded/locked
    // classes and potentially racing against the mouseleave collapse path.
    if (opts && opts.silent) return;

    sidebarLocked = false;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.remove("sidebar-locked");
      if (!sidebar.matches(":hover")) {
        sidebar.classList.remove("expanded");
        hideSidebarPanel();
      }
    }
  }

  function planLabelForLevel(level) {
    if (level === "trialing") return "Plan: Trial";
    if (level === "active") return "Plan: Pro";
    if (level === "grace") return "Plan: Pro (grace)";
    return "Plan: Free";
  }

  function renderProSubscriptionSection() {
    var host = $("#pro-sub-content");
    if (!host) return;
    var level = ProAccess.getProAccessLevel(data);
    var html = '<p class="pro-sub-line">' + escapeHtml(planLabelForLevel(level)) + '</p>';

    if (level === "trialing") {
      var days = ProAccess.trialDaysRemaining(data);
      var trialMeta = (days <= 0)
        ? "Trial ends today."
        : "Trial ends in " + days + " day" + (days === 1 ? "" : "s") + ".";
      html += '<p class="pro-sub-line pro-sub-meta">' + escapeHtml(trialMeta) + '</p>';
    } else if (level === "active" || level === "grace") {
      var lastVerified = (data.pro && data.pro.lastVerifiedAt) || 0;
      if (lastVerified) {
        var diff = Date.now() - lastVerified;
        var daysAgo = Math.floor(diff / DAY_MS_LOCAL);
        var label = daysAgo <= 0 ? "today" : (daysAgo + " day" + (daysAgo === 1 ? "" : "s") + " ago");
        html += '<p class="pro-sub-line pro-sub-meta">Last verified: ' + label + '.</p>';
      } else {
        html += '<p class="pro-sub-line pro-sub-meta">Last verified: never.</p>';
      }
    }

    if (level === "grace") {
      html += '<span class="pro-warning">Verification overdue &mdash; reconnect to keep access.</span>';
    }

    host.innerHTML = html;
  }

  function renderProLicenseSection() {
    var host = $("#pro-license-current");
    if (!host) return;
    var key = (data.pro && data.pro.licenseKey) || null;
    if (key) {
      host.classList.remove("pro-license-empty");
      host.textContent = "Active license: " + key;
    } else {
      host.classList.add("pro-license-empty");
      host.textContent = "No license applied.";
    }
    // [1.0.5.4] Section C — Check license status now button is only meaningful
    // when a license key is set. Hide it for the empty state.
    var checkRow = $("#pro-license-check-row");
    if (checkRow) checkRow.classList.toggle("hidden", !key);
  }

  function renderProWorkspaceList() {
    var host = $("#pro-workspace-list");
    if (!host) return;
    if (workspaceSortable) { workspaceSortable.destroy(); workspaceSortable = null; }

    var workspaces = (data && data.workspaces) || [];
    var order = (data && data.workspaceOrder) || workspaces.map(function (w) { return w.id; });
    var byId = {};
    workspaces.forEach(function (w) { byId[w.id] = w; });

    var rows = order
      .map(function (id) { return byId[id]; })
      .filter(Boolean)
      .map(function (ws) {
        var idx = workspaceIndexInOrder(data, ws.id);
        var color = workspaceColorForIndex(idx);
        var isLast = workspaces.length === 1;
        var deleteCls = "pws-delete" + (isLast ? " is-disabled" : "");
        var deleteTitle = isLast ? "You need at least one workspace." : "Delete workspace";
        var roCls = ws.isReadOnly ? " is-readonly" : "";
        return '<li class="pro-workspace-row' + roCls + '" data-workspace-id="' + escapeHtml(ws.id) + '">' +
          '<span class="pws-drag-handle" title="Drag to reorder">☰</span>' +
          '<span class="pws-chip' + (ws.isReadOnly ? ' is-readonly' : '') + '" style="background:' + color + '">' + escapeHtml(workspaceFirstLetter(ws.name)) + '</span>' +
          '<span class="pws-name' + roCls + '">' + escapeHtml(ws.name || ws.id) + '</span>' +
          '<button type="button" class="' + deleteCls + '" title="' + escapeHtml(deleteTitle) + '" aria-label="Delete workspace">×</button>' +
        '</li>';
      })
      .join("");
    host.innerHTML = rows;

    // Inline rename
    host.querySelectorAll(".pws-name").forEach(function (nameEl) {
      nameEl.addEventListener("click", function () {
        if (nameEl.classList.contains("is-readonly")) return;
        startWorkspaceRename(nameEl);
      });
    });

    // Delete
    host.querySelectorAll(".pws-delete").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (btn.classList.contains("is-disabled")) {
          showToast("You need at least one workspace");
          return;
        }
        var row = btn.closest(".pro-workspace-row");
        if (!row) return;
        deleteWorkspace(row.dataset.workspaceId);
      });
    });

    // Drag-to-reorder
    if (typeof Sortable !== "undefined") {
      workspaceSortable = new Sortable(host, {
        animation: 200,
        handle: ".pws-drag-handle",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        filter: ".pro-workspace-row.is-readonly .pws-drag-handle",
        onEnd: async function () {
          var ids = [].slice.call(host.querySelectorAll(".pro-workspace-row")).map(function (li) {
            return li.dataset.workspaceId;
          });
          await reorderWorkspaces(ids);
        }
      });
    }

    var addBtnRow = $("#pro-workspace-add-row");
    if (!addBtnRow) {
      var section = host.parentNode;
      addBtnRow = document.createElement("div");
      addBtnRow.id = "pro-workspace-add-row";
      addBtnRow.className = "settings-row pws-add-row";
      addBtnRow.innerHTML =
        '<input type="text" id="pro-workspace-add-input" class="pws-add-input" placeholder="New workspace name" autocomplete="off" spellcheck="false" maxlength="48">' +
        '<button type="button" id="pro-workspace-add-btn" class="settings-btn">Add workspace</button>';
      // Insert directly after the workspace list
      if (host.nextSibling) {
        section.insertBefore(addBtnRow, host.nextSibling);
      } else {
        section.appendChild(addBtnRow);
      }
      var input = addBtnRow.querySelector("#pro-workspace-add-input");
      var btn = addBtnRow.querySelector("#pro-workspace-add-btn");
      var submit = function () {
        var name = (input.value || "").trim();
        if (!name) {
          showToast("Workspace name required");
          input.focus();
          return;
        }
        input.value = "";
        createWorkspace(name);
      };
      btn.addEventListener("click", submit);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
      });
    }

    // Drop the [1.0.3] "Coming in v1.0.6" subtitle now that this section is live.
    var subtitle = host.parentNode && host.parentNode.querySelector(".pro-section-subtitle");
    if (subtitle) {
      subtitle.textContent = workspaces.length + " workspace" + (workspaces.length === 1 ? "" : "s");
    }

    // Drop the placeholder "Add workspace" button from [1.0.3] (it carries
    // the "Coming in v1.0.6" tooltip and is wired to nothing).
    var legacyBtn = host.parentNode && host.parentNode.querySelector(".settings-row .settings-btn[disabled]");
    if (legacyBtn && legacyBtn.parentNode) {
      var parentRow = legacyBtn.parentNode;
      if (parentRow.classList.contains("settings-row") && !parentRow.id) {
        parentRow.parentNode.removeChild(parentRow);
      }
    }
  }

  function startWorkspaceRename(nameEl) {
    var row = nameEl.closest(".pro-workspace-row");
    if (!row) return;
    var id = row.dataset.workspaceId;
    var current = nameEl.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "pws-name-input";
    input.value = current;
    input.maxLength = 48;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    var done = false;
    var commit = async function () {
      if (done) return;
      done = true;
      var newName = (input.value || "").trim();
      if (!newName) {
        // Restore original
        var span = document.createElement("span");
        span.className = "pws-name";
        span.textContent = current;
        span.addEventListener("click", function () { startWorkspaceRename(span); });
        input.replaceWith(span);
        return;
      }
      var ok = await renameWorkspace(id, newName);
      var span2 = document.createElement("span");
      span2.className = "pws-name";
      span2.textContent = ok ? newName : current;
      span2.addEventListener("click", function () { startWorkspaceRename(span2); });
      input.replaceWith(span2);
    };
    var cancel = function () {
      if (done) return;
      done = true;
      var span = document.createElement("span");
      span.className = "pws-name";
      span.textContent = current;
      span.addEventListener("click", function () { startWorkspaceRename(span); });
      input.replaceWith(span);
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
  }

  function renderProAnalyticsToggle() {
    var toggle = $("#pro-analytics-toggle");
    if (!toggle) return;
    var enabled = !!(data && data.settings && data.settings.combinedAnalyticsEnabled);
    toggle.checked = enabled;
  }

  // ===== Pro Settings: Tags section ([1.0.9.1]) =====
  //
  // Manual tag CRUD UI. Lists workspace tags (active + archived) sorted by
  // createdAt asc, supports inline create / rename / recolor / soft-delete
  // through the Storage namespace. Archived tags are read-only and dimmed
  // — Restore lives in the future Trash view per trash-bin.md.
  // All workspace.tags reads go through Storage.getAllTags / getTagById; no
  // direct workspace.tags access in this section.

  var pendingTagDeleteId = null;
  var pendingTagDeleteTimer = null;
  var openTagPalettePopover = null; // current popover element when recolor open
  var tagPaletteOutsideHandler = null;

  function bindProTagsControls() {
    safeOn("#pro-tag-new-btn", "click", openTagCreateForm);
    safeOn("#pro-tag-create-cancel", "click", closeTagCreateForm);
    safeOn("#pro-tag-create-save", "click", commitTagCreate);
    var nameInput = $("#pro-tag-create-name");
    if (nameInput) {
      nameInput.addEventListener("input", function () {
        var saveBtn = $("#pro-tag-create-save");
        if (saveBtn) saveBtn.disabled = !(nameInput.value || "").trim();
        clearProTagCreateError();
      });
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); commitTagCreate(); }
        if (e.key === "Escape") { e.preventDefault(); closeTagCreateForm(); }
      });
    }
  }

  function clearProTagCreateError() {
    var errorEl = $("#pro-tag-create-error");
    if (errorEl && !errorEl.classList.contains("hidden")) {
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    }
  }

  function showProTagCreateError(message) {
    var errorEl = $("#pro-tag-create-error");
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function renderProTagsSection() {
    var listHost = $("#pro-tags-list");
    if (!listHost) return;
    closeTagPalettePopover();
    clearPendingTagDelete();

    var ws = Storage.getActiveWorkspace(data);
    var tags = ws ? Storage.getAllTags(ws) : [];
    tags = tags.slice().sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    var subtitle = document.querySelector(".pro-tags-subtitle");
    var activeCount = tags.filter(function (t) { return !t.deletedAt; }).length;
    if (subtitle) {
      if (tags.length === 0) {
        subtitle.textContent = "";
      } else {
        var archivedCount = tags.length - activeCount;
        subtitle.textContent = activeCount + " active tag" + (activeCount === 1 ? "" : "s") +
          (archivedCount > 0 ? " · " + archivedCount + " in trash" : "");
      }
    }

    var emptyEl = document.querySelector(".pro-tags-empty");
    if (emptyEl) {
      if (tags.length === 0) emptyEl.classList.remove("hidden");
      else emptyEl.classList.add("hidden");
    }

    listHost.innerHTML = tags.map(function (tag) {
      var archived = !!tag.deletedAt;
      var rowCls = "pro-tag-row" + (archived ? " archived" : "");
      var rowTitle = archived ? ' title="Restore via Trash (coming soon)."' : "";
      return '<li class="' + rowCls + '" data-tag-id="' + escapeHtml(tag.id) + '"' + rowTitle + '>' +
        '<button class="pro-tag-color-swatch" type="button" style="background:' + escapeHtml(tag.color) + '" aria-label="Change color"></button>' +
        '<span class="pro-tag-name">' + escapeHtml(tag.name) + '</span>' +
        (archived ? '<span class="pro-tag-archived-label">in trash</span>' : '') +
        '<button class="pro-tag-delete" type="button" aria-label="Delete tag" title="Delete tag">🗑</button>' +
      '</li>';
    }).join("");

    listHost.querySelectorAll(".pro-tag-row").forEach(function (row) {
      if (row.classList.contains("archived")) return;
      var tagId = row.dataset.tagId;
      var nameEl = row.querySelector(".pro-tag-name");
      var swatchEl = row.querySelector(".pro-tag-color-swatch");
      var deleteEl = row.querySelector(".pro-tag-delete");
      if (nameEl) nameEl.addEventListener("click", function () { startTagRename(nameEl, tagId); });
      if (swatchEl) swatchEl.addEventListener("click", function (e) {
        e.stopPropagation();
        openTagPalette(swatchEl, tagId);
      });
      if (deleteEl) deleteEl.addEventListener("click", function (e) {
        e.stopPropagation();
        handleTagDeleteClick(deleteEl, tagId);
      });
    });
  }

  function tagPaletteSwatchHTML(color, selected) {
    var cls = "pro-tag-swatch" + (selected ? " selected" : "");
    return '<button type="button" class="' + cls + '" style="background:' + escapeHtml(color) + '" data-color="' + escapeHtml(color) + '" aria-label="Color ' + escapeHtml(color) + '"></button>';
  }

  function openTagCreateForm() {
    var form = $("#pro-tag-create-form");
    var addRow = document.querySelector(".pro-tag-add-row");
    var nameInput = $("#pro-tag-create-name");
    var paletteHost = $("#pro-tag-create-palette");
    var saveBtn = $("#pro-tag-create-save");
    if (!form || !nameInput || !paletteHost) return;

    var ws = Storage.getActiveWorkspace(data);
    var defaultColor = ws ? Storage.nextAutoTagColor(ws) : (Storage.TAG_PALETTE && Storage.TAG_PALETTE[0]);
    var palette = Storage.TAG_PALETTE || [];
    paletteHost.innerHTML = palette.map(function (c) {
      return tagPaletteSwatchHTML(c, c === defaultColor);
    }).join("");
    paletteHost.dataset.selected = defaultColor;
    paletteHost.querySelectorAll(".pro-tag-swatch").forEach(function (sw) {
      sw.addEventListener("click", function () {
        paletteHost.querySelectorAll(".pro-tag-swatch").forEach(function (s) { s.classList.remove("selected"); });
        sw.classList.add("selected");
        paletteHost.dataset.selected = sw.dataset.color;
      });
    });

    nameInput.value = "";
    if (saveBtn) saveBtn.disabled = true;
    clearProTagCreateError();
    form.classList.remove("hidden");
    if (addRow) addRow.style.display = "none";
    setTimeout(function () { nameInput.focus(); }, 0);
  }

  function closeTagCreateForm() {
    var form = $("#pro-tag-create-form");
    var addRow = document.querySelector(".pro-tag-add-row");
    if (form) form.classList.add("hidden");
    if (addRow) addRow.style.display = "";
    clearProTagCreateError();
  }

  async function commitTagCreate() {
    var nameInput = $("#pro-tag-create-name");
    var paletteHost = $("#pro-tag-create-palette");
    if (!nameInput) return;
    clearProTagCreateError();
    var name = (nameInput.value || "").trim();
    if (!name) return;
    var color = (paletteHost && paletteHost.dataset.selected) || null;
    var fields = { name: name };
    if (color) fields.color = color;
    var result = await Storage.createTag(data, fields);
    // [1.0.9.2] round 6: surface duplicate-name conflict inline; keep form
    // open and refocus the input so the user can correct without re-opening.
    if (result && result.err === "duplicate") {
      showProTagCreateError(result.message);
      nameInput.focus();
      nameInput.select();
      return;
    }
    if (!result) {
      showToast("Could not create tag.");
      return;
    }
    closeTagCreateForm();
    renderProTagsSection();
  }

  function startTagRename(nameEl, tagId) {
    var current = nameEl.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "pro-tag-name-input";
    input.value = current;
    input.maxLength = 48;

    // [1.0.9.2] round 6: wrap input + error in a flex column so the duplicate
    // -name error sits below the input without breaking the row's
    // align-items: center flex layout. Wrapper inherits flex: 1 so the input
    // takes the same width the bare span did.
    var wrap = document.createElement("span");
    wrap.className = "pro-tag-rename-wrap";
    var errorEl = document.createElement("span");
    errorEl.className = "pro-tag-rename-error hidden";
    wrap.appendChild(input);
    wrap.appendChild(errorEl);
    nameEl.replaceWith(wrap);
    input.focus();
    input.select();

    var done = false;
    var revert = function (text) {
      var span = document.createElement("span");
      span.className = "pro-tag-name";
      span.textContent = text;
      span.addEventListener("click", function () { startTagRename(span, tagId); });
      wrap.replaceWith(span);
    };
    var clearError = function () {
      if (!errorEl.classList.contains("hidden")) {
        errorEl.classList.add("hidden");
        errorEl.textContent = "";
      }
    };
    var commit = async function () {
      if (done) return;
      var newName = (input.value || "").trim();
      if (!newName || newName === current) {
        done = true;
        revert(current);
        return;
      }
      var result = await Storage.renameTag(data, tagId, newName);
      // [1.0.9.2] round 6: surface duplicate-name conflict inline; keep edit
      // open with the input focused so the user can correct without losing
      // their typed value. blur-triggered commits also re-focus here, which
      // means the user has to explicitly Escape to abandon a duplicate.
      if (result && result.err === "duplicate") {
        errorEl.textContent = result.message;
        errorEl.classList.remove("hidden");
        input.focus();
        input.select();
        return;
      }
      done = true;
      revert(result ? newName : current);
    };
    var cancel = function () {
      if (done) return;
      done = true;
      revert(current);
    };
    input.addEventListener("input", clearError);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
  }

  function openTagPalette(anchorEl, tagId) {
    closeTagPalettePopover();
    var ws = Storage.getActiveWorkspace(data);
    var tag = ws ? Storage.getTagById(ws, tagId) : null;
    if (!tag) return;
    var palette = Storage.TAG_PALETTE || [];
    var pop = document.createElement("div");
    pop.className = "pro-tag-palette-popover";
    pop.innerHTML = palette.map(function (c) {
      return tagPaletteSwatchHTML(c, c === tag.color);
    }).join("");
    var panel = $("#pro-settings-panel");
    (panel || document.body).appendChild(pop);

    var rect = anchorEl.getBoundingClientRect();
    pop.style.left = Math.round(rect.left) + "px";
    pop.style.top = Math.round(rect.bottom + 4) + "px";

    pop.querySelectorAll(".pro-tag-swatch").forEach(function (sw) {
      sw.addEventListener("click", async function (e) {
        e.stopPropagation();
        var newColor = sw.dataset.color;
        closeTagPalettePopover();
        if (newColor && newColor !== tag.color) {
          await Storage.updateTagColor(data, tagId, newColor);
          renderProTagsSection();
        }
      });
    });

    openTagPalettePopover = pop;
    tagPaletteOutsideHandler = function (e) {
      if (!pop.contains(e.target) && e.target !== anchorEl) {
        closeTagPalettePopover();
      }
    };
    setTimeout(function () {
      document.addEventListener("click", tagPaletteOutsideHandler);
    }, 0);
  }

  function closeTagPalettePopover() {
    if (openTagPalettePopover && openTagPalettePopover.parentNode) {
      openTagPalettePopover.parentNode.removeChild(openTagPalettePopover);
    }
    openTagPalettePopover = null;
    if (tagPaletteOutsideHandler) {
      document.removeEventListener("click", tagPaletteOutsideHandler);
      tagPaletteOutsideHandler = null;
    }
  }

  function clearPendingTagDelete() {
    if (pendingTagDeleteTimer) {
      clearTimeout(pendingTagDeleteTimer);
      pendingTagDeleteTimer = null;
    }
    if (pendingTagDeleteId) {
      var prev = document.querySelector('.pro-tag-row[data-tag-id="' + pendingTagDeleteId + '"] .pro-tag-delete');
      if (prev) {
        prev.classList.remove("confirming");
        prev.title = "Delete tag";
        prev.textContent = "🗑";
      }
      pendingTagDeleteId = null;
    }
  }

  async function handleTagDeleteClick(btn, tagId) {
    if (pendingTagDeleteId === tagId) {
      // Second click — confirm.
      clearPendingTagDelete();
      await Storage.deleteTag(data, tagId);
      renderProTagsSection();
      return;
    }
    // First click — switch to confirm state. Auto-revert after 3s.
    clearPendingTagDelete();
    pendingTagDeleteId = tagId;
    btn.classList.add("confirming");
    btn.title = "Click again to confirm — restore from Trash within 30 days.";
    btn.textContent = "Delete?";
    pendingTagDeleteTimer = setTimeout(function () { clearPendingTagDelete(); }, 3000);
  }

  async function handleLicenseApply() {
    var input = $("#pro-license-input");
    if (!input) return;
    var key = (input.value || "").trim();
    if (!key) {
      showToast("Enter a license key first.");
      return;
    }
    var ok = ProAccess.applyLicenseKey(data, key);
    if (!ok) {
      showToast("License key not recognized.");
      return;
    }
    await Storage.saveAll(data);
    input.value = "";
    showToast("License applied. Pro features now active.");
    renderProSubscriptionSection();
    renderProLicenseSection();
    applyTabAccessLevel("active");
    applySidebarProEntryVisibility(true);
    applyCtaState(data);
  }

  // [1.0.5.4] Section C — Force a license validation against Dodo. opts.force
  // bypasses the 24h debounce in LicenseClient.ensureValidated. Used by Pro
  // users who paid mid-session and want to confirm their entitlement without
  // waiting for the next-day passive refresh.
  async function handleLicenseCheckNow() {
    var btn = $("#pro-license-check");
    if (!btn) return;
    if (!data.pro || !data.pro.licenseKey) {
      showToast("No license to check.");
      return;
    }
    if (typeof LicenseClient === "undefined") {
      showToast("License module unavailable. Reload the page and try again.");
      return;
    }
    var oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Checking...";
    try {
      var result = await LicenseClient.ensureValidated(data, data.pro.licenseKey, { force: true });
      await Storage.saveAll(data);
      renderProSubscriptionSection();
      renderProLicenseSection();
      applyCtaState(data);
      if (result && result.ok) {
        var status = data.pro.subscriptionStatus;
        if (status === "active") showToast("License active.");
        else if (status === "invalid") showToast("License expired.");
        else showToast("License status: " + (status || "unknown") + ".");
      } else {
        var msg = (result && result.message) || "Could not validate license.";
        showToast(msg);
      }
    } catch (err) {
      showToast((err && err.message) || "Unexpected error validating license.");
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }

  async function handleLicenseClear() {
    if (!data.pro || !data.pro.licenseKey) {
      showToast("No license to clear.");
      return;
    }
    var ok = window.confirm("Remove this license? You'll lose Pro access until you re-enter a valid key.");
    if (!ok) return;
    ProAccess.clearLicense(data);
    await Storage.saveAll(data);
    showToast("License cleared.");
    renderProSubscriptionSection();
    renderProLicenseSection();
    // Sidebar entry visibility / tab gating handled by storage.onChanged listener.
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ===== Init =====

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    console.log("[LaunchPad] Initializing...");
    data = await Storage.getAll();

    // Guard against missing settings (corrupted storage)
    if (!data.settings) {
      data.settings = { columns: 6 };
      await Storage.saveAll(data);
      console.warn("[LaunchPad] Repaired missing settings");
    }
    if (!data.settings.collapsedGroups) {
      data.settings.collapsedGroups = {};
    }

    // One-time cleanup: remove any variant that duplicates the parent URL
    var cleaned = false;
    var initWs = Storage.getActiveWorkspace(data);
    if (initWs) {
      Storage.ensureGroupsArray(initWs);
      initWs.groups.forEach(function (g) {
        g.shortcuts.forEach(function (s) {
          if (s.variants && s.variants.length > 0) {
            var before = s.variants.length;
            s.variants = s.variants.filter(function (v) {
              return v.url !== s.url;
            });
            if (s.variants.length < before) cleaned = true;
            if (s.variants.length === 0) delete s.variants;
          }
        });
      });
    }
    if (cleaned) {
      await Storage.saveAll(data);
      console.log("[LaunchPad] Cleaned up duplicate variants");
    }

    // [1.0.5.4] Section A — Per-newtab ensureValidated trigger. Runs before
    // the first render so applyAccessLevelUI consumes the freshest
    // subscriptionStatus. The 24h debounce inside ensureValidated short-
    // circuits most calls (one timestamp comparison, no network). Only fires
    // when a license key is set; trial users skip this entirely.
    //
    // Skip Storage.saveAll when ensureValidated returns cached:true — the
    // debounce path doesn't mutate data.pro, so persisting would just
    // re-write unchanged bytes on every newtab open within the 24h window.
    // Rev 1 of [1.0.5.4] (commit fe18493 review).
    if (data.pro && data.pro.licenseKey && typeof LicenseClient !== "undefined") {
      try {
        var result = await LicenseClient.ensureValidated(data, data.pro.licenseKey);
        if (!result || !result.cached) {
          await Storage.saveAll(data);
        }
      } catch (err) {
        console.error("[LaunchPad] ensureValidated startup call failed:", err);
      }
    }

    await loadBackground();
    applyIconSize(data.settings.iconSize || "medium");
    applySearch();

    // Check if onboarding needed
    var onboardingDone = await Storage.getOnboardingComplete();
    if (!onboardingDone && Bookmarks.isFirstRun(data)) {
      showOnboarding();
    }

    render();
    refreshOldFavicons();
    bindEvents();
    bindTabBar();
    bindProSettings();
    bindUpgradeCta();
    bindWorkspaceSwitcher();
    applyAccessLevelUI();
    startCtaCountdown();
    Bookmarks.bindEvents(function (newData) {
      data = newData;
      hideFirstRunToast();
      render();
      // If onboarding triggered a bookmark import, advance to step 2
      if (obPendingBookmarks) {
        obPendingBookmarks = false;
        goToObStep(2);
      }
    });

    // Listen for external storage changes (e.g. context menu adds a shortcut)
    //
    // [1.0.11.2] Write-provenance gate. Storage.saveAll tags every same-page
    // write with TAB_INSTANCE_ID + a writeId in the __lastWrite metadata key
    // (atomic with the data write). If this event corresponds to one of our
    // own pending writes, skip render() — the user action that triggered the
    // write already updated the DOM, and a full render wipes DOM-only state
    // (sidebar group expansion, focus, etc.). Foreign writes (other newtab
    // tabs, the background service worker's context-menu adds) still render.
    chrome.storage.onChanged.addListener(function (changes) {
      var meta = changes.__lastWrite && changes.__lastWrite.newValue;
      if (meta && meta.tab === Storage.TAB_INSTANCE_ID && Storage._pendingWriteIds.has(meta.writeId)) {
        Storage._pendingWriteIds.delete(meta.writeId);
        return;
      }
      if (changes.data) {
        console.log("[LaunchPad] Storage changed externally, refreshing");
        data = changes.data.newValue || Storage.getDefaultData();
        if (!data.settings) data.settings = { columns: 6 };
        render();
        applyAccessLevelUI();
      }
      // [1.0.11.9] Wallpaper lives under a separate storage key
      // (launchpad_background) and Storage.saveBackground bypasses
      // Storage.saveAll entirely — so the data branch above never fires
      // for wallpaper-only edits in another tab. Pick those up directly.
      // loadBackground re-reads the key and runs applyBackground; same
      // tab gets a harmless re-apply (the source already applied it via
      // the preview path), foreign tab gets the actual cross-tab sync.
      if (changes.launchpad_background) {
        loadBackground();
      }
    });

    // Check for promo toasts (delayed) and right-click tip
    setTimeout(checkPromoToast, 2000);
    checkRightClickTip();

    var readyWs = Storage.getActiveWorkspace(data);
    var readyGroups = (readyWs && readyWs.groups) || [];
    console.log("[LaunchPad] Ready —", readyGroups.length, "group(s),",
      readyGroups.reduce(function (n, g) { return n + g.shortcuts.length; }, 0), "shortcut(s)");
  }

  // ===== First-Run Toast =====

  function showFirstRunToast() {
    var toast = $("#first-run-toast");
    if (toast) toast.classList.remove("hidden");
    console.log("[LaunchPad] First run — showing toast");
  }

  function hideFirstRunToast() {
    var toast = $("#first-run-toast");
    if (toast) toast.classList.add("hidden");
  }

  // ===== Promo Toast (one-time BMC / Rate) =====

  async function checkPromoToast() {
    // One-time migration from old promo storage keys to promoState
    var raw = await chrome.storage.local.get(["promoState", "tabOpenCount", "bmcToastDismissed", "rateToastDismissed"]);
    if (!raw.promoState && (raw.tabOpenCount || raw.bmcToastDismissed || raw.rateToastDismissed)) {
      var migrated = {
        openCount: raw.tabOpenCount || 0,
        lastPromo: null,
        lastPromoOpen: 0
      };
      // Old schedule: BMC at count >= 5, Rate at count >= 12. If Rate was
      // dismissed the user almost certainly saw BMC too; if only BMC was
      // dismissed they were between 5 and 12. Set lastPromoOpen to the
      // migrated openCount so the new alternating cadence (every 20) starts
      // from now and the user is not immediately re-prompted.
      if (raw.rateToastDismissed) {
        migrated.lastPromo = "rate";
        migrated.lastPromoOpen = migrated.openCount;
      } else if (raw.bmcToastDismissed) {
        migrated.lastPromo = "coffee";
        migrated.lastPromoOpen = migrated.openCount;
      }
      await chrome.storage.local.set({ promoState: migrated });
      await chrome.storage.local.remove(["tabOpenCount", "bmcToastDismissed", "rateToastDismissed"]);
      raw.promoState = migrated;
    }

    var promo = raw.promoState || { openCount: 0, lastPromo: null, lastPromoOpen: 0 };

    promo.openCount = (promo.openCount || 0) + 1;

    var showType = null;

    if (promo.openCount === 3) {
      showType = "rate";
    } else if (promo.openCount === 8) {
      showType = "coffee";
    } else if (promo.openCount > 8 && promo.lastPromoOpen > 0 && (promo.openCount - promo.lastPromoOpen) >= 20) {
      // Alternate: show whichever wasn't shown last
      showType = (promo.lastPromo === "rate") ? "coffee" : "rate";
    }

    if (showType) {
      promo.lastPromo = showType;
      promo.lastPromoOpen = promo.openCount;
      showPromoToast(showType);
    }

    await chrome.storage.local.set({ promoState: promo });
  }

  function showPromoToast(type) {
    // Remove any existing promo toast first
    var existing = document.querySelector(".promo-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "promo-toast";

    if (type === "rate") {
      toast.innerHTML = '<span class="promo-toast-icon">\u2B50</span>' +
        '<span class="promo-toast-text">Enjoying LaunchPad? Leave a quick rating!</span>' +
        '<a href="https://chrome.google.com/webstore/detail/jfmmagapjdionoomkjmkfppcplkjilnp" target="_blank" class="promo-toast-action">Rate</a>' +
        '<button class="promo-toast-dismiss" title="Dismiss">&times;</button>';
    } else {
      toast.innerHTML = '<span class="promo-toast-icon">\u2615</span>' +
        '<span class="promo-toast-text">LaunchPad is free & ad-free. Support the dev?</span>' +
        '<a href="https://buymeacoffee.com/cybersamwise" target="_blank" class="promo-toast-action">Buy me a coffee</a>' +
        '<button class="promo-toast-dismiss" title="Dismiss">&times;</button>';
    }

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(function () {
      toast.classList.add("visible");
    });

    // Auto-dismiss after 6 seconds
    var timer = setTimeout(function () {
      toast.classList.remove("visible");
      setTimeout(function () { toast.remove(); }, 300);
    }, 6000);

    // Manual dismiss
    toast.querySelector(".promo-toast-dismiss").addEventListener("click", function () {
      clearTimeout(timer);
      toast.classList.remove("visible");
      setTimeout(function () { toast.remove(); }, 300);
    });
  }

  // ===== Right-Click Tip =====

  var rcTipTimer = null;

  async function checkRightClickTip() {
    var result = await chrome.storage.local.get(["promoState", "rightClickTipShown"]);
    var count = (result.promoState && result.promoState.openCount) || 0;
    // Show on 2nd tab open (not first — user is still in onboarding)
    if (count >= 2 && !result.rightClickTipShown) {
      showRightClickTip();
    }
  }

  function showRightClickTip() {
    // Don't show if a promo toast is already visible
    if (document.querySelector(".promo-toast")) return;

    var tip = $("#rc-tip");
    if (!tip) return;

    tip.classList.remove("hidden");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        tip.classList.add("tip-visible");
      });
    });

    rcTipTimer = setTimeout(function () {
      dismissRightClickTip();
    }, 10000);
  }

  function dismissRightClickTip() {
    var tip = $("#rc-tip");
    if (!tip || tip.classList.contains("hidden")) return;

    if (rcTipTimer) {
      clearTimeout(rcTipTimer);
      rcTipTimer = null;
    }

    chrome.storage.local.set({ rightClickTipShown: true });

    tip.classList.remove("tip-visible");
    setTimeout(function () {
      tip.classList.add("hidden");
    }, 400);
  }

  // ===== Onboarding =====

  var obCurrentStep = 1;
  var obSelectedBg = "";
  var obPendingBookmarks = false;

  function showOnboarding() {
    var overlay = $("#onboarding-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    obCurrentStep = 1;
    obSelectedPopular = {};
    updateObDots();
    previewTopSites();
    renderObPopularSites();
    console.log("[LaunchPad] Onboarding started");
  }

  function hideOnboarding() {
    var overlay = $("#onboarding-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  function goToObStep(step) {
    obCurrentStep = step;
    $$(".ob-step").forEach(function (el) {
      el.classList.toggle("hidden", parseInt(el.dataset.step) !== step);
    });
    updateObDots();
    if (step === 2) {
      renderObBgColors();
      renderObGallery();
    }
    // Show onboarding overlay if it was hidden (e.g. during bookmark import)
    $("#onboarding-overlay").classList.remove("hidden");
  }

  function updateObDots() {
    $$(".ob-dot").forEach(function (dot) {
      dot.classList.toggle("active", parseInt(dot.dataset.step) <= obCurrentStep);
    });
  }

  function previewTopSites() {
    if (!chrome.topSites || !chrome.topSites.get) return;
    chrome.topSites.get(function (sites) {
      var preview = $("#ob-top-sites-preview");
      if (!preview || !sites || !sites.length) return;
      var html = sites.slice(0, 8).map(function (site) {
        var domain = getDomain(site.url);
        var favicon = getFaviconUrl(site.url);
        return '<img class="ob-preview-favicon" src="' + favicon + '" alt="" width="20" height="20" title="' + esc(site.title || domain) + '">';
      }).join("");
      preview.innerHTML = html;
    });
  }

  function importTopSites(callback) {
    if (!chrome.topSites || !chrome.topSites.get) {
      console.warn("[LaunchPad] chrome.topSites not available");
      if (callback) callback();
      return;
    }
    chrome.topSites.get(function (sites) {
      if (!sites || !sites.length) {
        if (callback) callback();
        return;
      }
      var groupId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      var shortcuts = sites.map(function (site, i) {
        return {
          id: Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 7),
          url: site.url,
          title: site.title || getDomain(site.url),
          addedAt: Date.now(),
          deletedAt: null
        };
      });
      var topSitesWs = Storage.getActiveWorkspace(data);
      if (!topSitesWs) {
        if (callback) callback();
        return;
      }
      topSitesWs.groups.push({ id: groupId, name: "Top Sites", shortcuts: shortcuts, deletedAt: null });
      topSitesWs.groupOrder.push(groupId);
      Storage.saveAll(data).then(function () {
        render();
        console.log("[LaunchPad] Imported", shortcuts.length, "top sites");
        if (callback) callback();
      });
    });
  }

  function handleObTopSites() {
    importTopSites(function () {
      addSelectedPopularSites().then(function () {
        render();
        goToObStep(2);
      });
    });
  }

  function handleObBookmarks() {
    obPendingBookmarks = true;
    addSelectedPopularSites().then(function () {
      render();
      hideOnboarding();
      Bookmarks.showPicker();
      // If user cancels bookmark picker, re-show onboarding at step 2
      waitForHidden($("#bookmark-overlay"), function () {
        if (obPendingBookmarks) {
          obPendingBookmarks = false;
          goToObStep(2);
        }
      });
    });
  }

  function handleObBoth() {
    importTopSites(function () {
      handleObBookmarks();
    });
  }

  function waitForHidden(el, callback) {
    if (el.classList.contains("hidden")) {
      callback();
      return;
    }
    var observer = new MutationObserver(function () {
      if (el.classList.contains("hidden")) {
        observer.disconnect();
        callback();
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  }

  function renderObBgColors() {
    var grid = $("#ob-bg-color-grid");
    if (!grid) return;
    obSelectedBg = currentBg || DEFAULT_BG;
    grid.innerHTML = COLOR_PRESETS.map(function (preset) {
      var hex = preset.value.slice(6);
      var isSelected = obSelectedBg === preset.value;
      return '<button class="ob-bg-thumb ob-bg-color-swatch' + (isSelected ? ' selected' : '') + '" data-bg="' + preset.value + '" type="button" title="' + esc(preset.label) + '" style="background-color: ' + hex + ';">' +
        '<span class="ob-bg-check">' + CHECK_SVG + '</span>' +
        '</button>';
    }).join("");
  }

  function renderObGallery() {
    var grid = $("#ob-bg-grid");
    if (!grid) return;
    grid.innerHTML = GALLERY_IMAGES.map(function (img) {
      var isSelected = obSelectedBg === img.url;
      return '<button class="ob-bg-thumb' + (isSelected ? ' selected' : '') + '" data-bg="' + img.url + '" type="button" title="' + esc(img.label) + '">' +
        '<span class="ob-bg-check">' + CHECK_SVG + '</span>' +
        '<img src="' + img.thumb + '" alt="' + esc(img.label) + '" loading="lazy">' +
        '</button>';
    }).join("");
  }

  function selectObBg(thumbEl) {
    $$(".ob-bg-thumb", $("#ob-bg-color-grid")).forEach(function (el) { el.classList.remove("selected"); });
    $$(".ob-bg-thumb", $("#ob-bg-grid")).forEach(function (el) { el.classList.remove("selected"); });
    thumbEl.classList.add("selected");
    obSelectedBg = thumbEl.dataset.bg;
    applyBackground(obSelectedBg);
  }

  function handleObBgNext() {
    var bg = obSelectedBg || DEFAULT_BG;
    Storage.saveBackground(bg).then(function () {
      applyBackground(bg);
    });
    goToObStep(3);
  }

  function handleObUploadOwn() {
    $("#ob-file-input").click();
  }

  function handleObFileUpload(file) {
    if (!file || !file.type.startsWith("image/")) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        resizeImage(img, function (dataUrl) {
          obSelectedBg = dataUrl;
          applyBackground(dataUrl);
          // Mark all thumbs as unselected (custom upload)
          $$(".ob-bg-thumb", $("#ob-bg-grid")).forEach(function (el) {
            el.classList.remove("selected");
          });
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async function finishOnboarding() {
    // Save background if selected
    if (obSelectedBg) {
      await Storage.saveBackground(obSelectedBg);
      applyBackground(obSelectedBg);
    }
    await Storage.setOnboardingComplete();
    hideOnboarding();
    render();
    console.log("[LaunchPad] Onboarding complete");
  }

  // ===== Onboarding Popular Sites =====

  function renderObPopularSites() {
    var row = $("#ob-popular-row");
    if (!row) return;
    row.innerHTML = POPULAR_SITES.map(function (site, i) {
      var domain = getDomain(site.url);
      var favicon = getFaviconUrl(site.url);
      return '<button class="ob-popular-item" data-index="' + i + '" type="button">' +
        '<div class="ob-popular-icon">' +
          '<img src="' + favicon + '" alt="" width="20" height="20">' +
          '<span class="ob-popular-check">' + CHECK_SM_SVG + '</span>' +
        '</div>' +
        '<span class="ob-popular-label">' + esc(site.title) + '</span>' +
      '</button>';
    }).join("");
  }

  function toggleObPopularSite(index) {
    if (obSelectedPopular[index]) {
      delete obSelectedPopular[index];
    } else {
      obSelectedPopular[index] = true;
    }
    var items = $$(".ob-popular-item", $("#ob-popular-row"));
    items.forEach(function (el) {
      el.classList.toggle("selected", !!obSelectedPopular[parseInt(el.dataset.index)]);
    });
  }

  async function addSelectedPopularSites() {
    var indices = Object.keys(obSelectedPopular);
    if (!indices.length) return;
    var shortcuts = indices.map(function (i, idx) {
      var site = POPULAR_SITES[parseInt(i)];
      return {
        id: Date.now().toString(36) + idx.toString(36) + Math.random().toString(36).slice(2, 7),
        url: site.url,
        title: site.title,
        addedAt: Date.now(),
        deletedAt: null
      };
    });
    var popularWs = Storage.getActiveWorkspace(data);
    if (!popularWs) return;
    // Add to "Ungrouped" group or create "Quick Start"
    var ungrouped = popularWs.groups.find(function (g) { return g.id === "ungrouped"; });
    if (ungrouped) {
      ungrouped.shortcuts = ungrouped.shortcuts.concat(shortcuts);
    } else {
      var groupId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      popularWs.groups.push({ id: groupId, name: "Quick Start", shortcuts: shortcuts, deletedAt: null });
      popularWs.groupOrder.push(groupId);
    }
    await Storage.saveAll(data);
    obSelectedPopular = {};
    console.log("[LaunchPad] Added", shortcuts.length, "popular sites");
  }

  // ===== Sidebar Panel Mutual Exclusion =====
  //
  // [1.0.11.12] The Settings panel, Pro Settings panel, and Restore Session
  // dropdown all lock the sidebar (sidebarLocked = true, sidebar-locked +
  // expanded classes). They are mutually exclusive — opening any one should
  // close any other that is already open. Without coordination, e.g. opening
  // Pro Settings while Settings is open leaves both panels visible stacked.
  //
  // openPanel(name) is the single entry point that callers (sidebar button
  // click handlers, programmatic opens like the Pro CTA) route through.
  // It walks the registry, silently closes any other open chain panel
  // (silent: true keeps sidebarLocked = true across the swap to avoid
  // toggling the lock off/on which can race the sidebar mouseleave path),
  // then calls the target's open function — which still preserves its own
  // toggle behaviour (already-open + same target → close).
  //
  // History overlay (#history-overlay) is intentionally NOT in this chain:
  // it is a fullscreen modal that does not touch sidebarLocked, so it
  // composes orthogonally over any sidebar panel. The wallpaper picker
  // (#bg-overlay) is launched from Settings via an explicit closeSettings
  // → openBgModal pair (see settings-change-wallpaper handler) and stays
  // outside this registry.
  var SIDEBAR_PANEL_CHAIN = [
    { name: "settings",         selector: "#settings-panel",     open: function () { openSettingsPanel(); },     close: function (opts) { closeSettingsPanel(opts); } },
    { name: "pro-settings",     selector: "#pro-settings-panel", open: function () { openProSettingsPanel(); },  close: function (opts) { closeProSettingsPanel(opts); } },
    { name: "restore-session",  selector: "#restore-dropdown",   open: function () { openRestoreDropdown(); },   close: function (opts) { closeRestoreDropdown(opts); } }
  ];

  function isPanelOpen(panel) {
    var el = $(panel.selector);
    return !!(el && !el.classList.contains("hidden"));
  }

  function getCurrentOpenPanel() {
    for (var i = 0; i < SIDEBAR_PANEL_CHAIN.length; i++) {
      if (isPanelOpen(SIDEBAR_PANEL_CHAIN[i])) return SIDEBAR_PANEL_CHAIN[i].name;
    }
    return null;
  }

  function openPanel(name) {
    var target = null;
    for (var i = 0; i < SIDEBAR_PANEL_CHAIN.length; i++) {
      if (SIDEBAR_PANEL_CHAIN[i].name === name) { target = SIDEBAR_PANEL_CHAIN[i]; break; }
    }
    if (!target) return;
    // Close every OTHER chain panel that's currently open, silently so the
    // sidebar lock stays on for the incoming open. If the target is already
    // open, fall through — target.open()'s own toggle path will close it.
    SIDEBAR_PANEL_CHAIN.forEach(function (p) {
      if (p === target) return;
      if (isPanelOpen(p)) p.close({ silent: true });
    });
    target.open();
  }

  // ===== Settings Panel =====

  function openSettingsPanel() {
    var panel = $("#settings-panel");
    if (!panel) return;
    if (!panel.classList.contains("hidden")) { closeSettingsPanel(); return; }

    // [1.0.11.12] Cross-panel mutual exclusion is handled by openPanel().
    // hideGroupMenu kept here (orthogonal to the sidebar panel chain).
    hideGroupMenu();

    // Lock sidebar open and force expanded
    sidebarLocked = true;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.add("sidebar-locked");
      sidebar.classList.add("expanded");
    }
    showSidebarPanel();

    panel.classList.remove("hidden");
    document.getElementById('settings-version').textContent = 'LaunchPad v' + chrome.runtime.getManifest().version;
    updateSettingsUI();
  }

  function closeSettingsPanel(opts) {
    var panel = $("#settings-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    panel.classList.add("hidden");

    // [1.0.11.12] silent close — see closeProSettingsPanel for rationale.
    if (opts && opts.silent) return;

    sidebarLocked = false;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.remove("sidebar-locked");
      // Collapse sidebar if mouse is not over it
      if (!sidebar.matches(":hover")) {
        sidebar.classList.remove("expanded");
        hideSidebarPanel();
      }
    }
  }

  function updateSettingsUI() {
    // Icon size segmented control
    var iconSize = (data.settings && data.settings.iconSize) || "medium";
    $$(".seg-btn", $("#settings-icon-size")).forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.value === iconSize);
    });

    // Wallpaper thumbnail
    updateWallpaperThumb();
  }

  function updateWallpaperThumb() {
    var thumb = $("#settings-wallpaper-thumb");
    if (!thumb) return;
    if (isColorBg(currentBg)) {
      thumb.style.backgroundImage = "none";
      thumb.style.backgroundColor = currentBg.slice(6);
    } else if (currentBg) {
      thumb.style.backgroundImage = "url('" + currentBg + "')";
      thumb.style.backgroundColor = "";
    } else {
      thumb.style.backgroundImage = "none";
      thumb.style.backgroundColor = "";
    }
    var removeBtn = $("#settings-remove-wallpaper");
    if (removeBtn) {
      removeBtn.style.display = (currentBg && currentBg !== DEFAULT_BG) ? "" : "none";
    }
  }

  function applyIconSize(size) {
    var html = document.documentElement;
    html.classList.remove("icon-size-small", "icon-size-large");
    if (size === "small") html.classList.add("icon-size-small");
    else if (size === "large") html.classList.add("icon-size-large");
  }

  function applySearch() {
    var form = $("#search-form");
    var input = $("#search-input");
    if (input) input.placeholder = "Search or type a URL";
    if (form && !form._searchHandlerAttached) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var query = $("#search-input").value.trim();
        if (!query) return;
        // Detect URLs: contains a dot and no spaces
        if (query.indexOf(".") !== -1 && query.indexOf(" ") === -1) {
          var url = query;
          if (!/^https?:\/\//i.test(url)) url = "https://" + url;
          chrome.tabs.update({ url: url });
        } else {
          // Use Chrome's built-in search — respects user's default search engine
          chrome.search.query({ text: query, disposition: "CURRENT_TAB" });
        }
      });
      form._searchHandlerAttached = true;
    }
  }

  // ===== Backup / Restore =====

  function showToast(message, durationMs) {
    var toast = $("#open-all-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove("visible");
    }, durationMs || 3000);
  }

  async function exportBackup() {
    var raw = await chrome.storage.local.get(["data", "launchpad_background"]);
    // Read raw to avoid silently exporting the default skeleton when there's
    // real-but-unusual user data (Storage.getAll's fallback would mask that).
    // BUT: on a fresh install raw.data is undefined, which JSON-stringifies to
    // null and produces an unrestorable backup. Substitute the default skeleton
    // in that one case so every export is a valid restorable envelope.
    var envelope = {
      launchpadBackup: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      data: raw.data || Storage.getDefaultData(),
      background: raw.launchpad_background || null
    };
    var json = JSON.stringify(envelope, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "launchpad-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Backup downloaded");
  }

  // Returns "ok", "not-launchpad", or "empty-or-corrupted"
  function validateBackup(envelope) {
    if (!envelope || envelope.launchpadBackup !== true) return "not-launchpad";
    if (typeof envelope.version !== "number") return "not-launchpad";
    var d = envelope.data;
    if (!d || typeof d !== "object") return "empty-or-corrupted";
    if (!d.settings || typeof d.settings !== "object") return "empty-or-corrupted";
    if (Array.isArray(d.workspaces)) {
      // New (workspace-aware) shape
      if (!d.workspaces.length) return "empty-or-corrupted";
      return "ok";
    }
    // Legacy flat shape (pre-migration backup)
    if (!Array.isArray(d.groups)) return "empty-or-corrupted";
    if (!Array.isArray(d.groupOrder)) return "empty-or-corrupted";
    return "ok";
  }

  function handleBackupFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function () {
      var envelope;
      try {
        envelope = JSON.parse(reader.result);
      } catch (err) {
        showToast("Invalid backup file");
        return;
      }
      var status = validateBackup(envelope);
      if (status === "not-launchpad") {
        showToast("This doesn't look like a LaunchPad backup file");
        return;
      }
      if (status === "empty-or-corrupted") {
        showToast("This backup file is empty or corrupted. Nothing to import.");
        return;
      }
      var dateStr = "an unknown date";
      if (envelope.exportedAt) {
        try { dateStr = new Date(envelope.exportedAt).toLocaleDateString(); } catch (e) {}
      }
      var ok = confirm("This will replace all your current shortcuts and groups with the backup from " + dateStr + ". Your current data will be saved as a recovery backup. Continue?");
      if (!ok) return;

      // Save current state as recovery (envelope-like, full revertability)
      var current = await chrome.storage.local.get(["data", "launchpad_background"]);
      await chrome.storage.local.set({
        data_pre_import_backup: {
          data: current.data || null,
          background: current.launchpad_background || null
        }
      });
      // Apply imported envelope
      await chrome.storage.local.set({ data: envelope.data });
      if (envelope.hasOwnProperty("background")) {
        await Storage.saveBackground(envelope.background);
      }
      // Close panel during the window where storage is updated but DOM not yet re-rendered
      closeSettingsPanel();
      // Re-init relevant subset of init()
      data = await Storage.getAll();
      if (!data.settings) data.settings = { columns: 6 };
      if (!data.settings.collapsedGroups) data.settings.collapsedGroups = {};
      await loadBackground();
      applyIconSize(data.settings.iconSize || "medium");
      refreshOldFavicons();
      render();
      showToast("Backup restored.");
    };
    reader.onerror = function () {
      showToast("Could not read file");
    };
    reader.readAsText(file);
  }

  // ===== Domain Alias Map =====

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

  // ===== Variant Helpers =====

  function getBaseDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) { return null; }
  }

  function getMatchKey(url) {
    try {
      var hostname = new URL(url).hostname;
      if (DOMAIN_ALIASES[hostname]) return DOMAIN_ALIASES[hostname];
      return hostname;
    } catch (e) { return null; }
  }

  function generateVariantLabel(parentUrl, variantUrl, variantTitle, parentTitle) {
    try {
      var variantPath = new URL(variantUrl).pathname;
      // Gmail-style: /mail/u/0/ vs /mail/u/1/
      var accountMatch = variantPath.match(/\/u\/(\d+)/);
      if (accountMatch) return "Account " + (parseInt(accountMatch[1]) + 1);
      // Shopify-style: /store/name
      var storeMatch = variantPath.match(/\/store\/([^\/]+)/);
      if (storeMatch) return storeMatch[1];
      // Fallback: use the page title if different from parent
      if (variantTitle && variantTitle !== parentTitle) return variantTitle;
      // Last resort: truncated path
      return variantPath.substring(0, 30) || "Variant";
    } catch (e) {
      return variantTitle || "Variant";
    }
  }

  function findDomainMatchInGroup(groupId, url) {
    var key = getMatchKey(url);
    if (!key) return null;
    var group = findGroup(groupId);
    if (!group) return null;
    return group.shortcuts.find(function (s) {
      return getMatchKey(s.url) === key;
    }) || null;
  }

  // ===== Variant Dropdown =====

  var variantDropdownState = null;
  var variantCtxState = null;

  function showVariantDropdown(shortcutId, groupId, anchorEl) {
    closeVariantDropdown();
    var group = findGroup(groupId);
    if (!group) return;
    var shortcut = group.shortcuts.find(function (s) { return s.id === shortcutId; });
    if (!shortcut || !shortcut.variants || !shortcut.variants.length) return;

    variantDropdownState = { shortcutId: shortcutId, groupId: groupId, anchorEl: anchorEl };
    sidebarLocked = true;

    // Build items: parent first, then variants
    var items = [{
      id: "__parent__",
      url: shortcut.url,
      title: shortcut.customLabel || shortcut.title || getBaseDomain(shortcut.url) || "",
      favicon: shortcut.customIcon || getFaviconUrl(shortcut),
      isParent: true
    }];
    shortcut.variants.forEach(function (v) {
      items.push({
        id: v.id,
        url: v.url,
        title: v.customLabel || v.title || generateVariantLabel(shortcut.url, v.url, v.title, shortcut.title),
        favicon: v.customIcon || getFaviconUrl(v),
        isParent: false
      });
    });

    // Create dropdown element
    var dropdown = document.createElement("div");
    dropdown.className = "variant-dropdown";
    dropdown.dataset.shortcutId = shortcutId;
    dropdown.dataset.groupId = groupId;
    dropdown.innerHTML = '<div class="variant-dropdown-arrow"></div><div class="variant-dropdown-list"></div>';

    var list = dropdown.querySelector(".variant-dropdown-list");

    items.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "variant-dropdown-row";
      row.dataset.url = item.url;
      row.dataset.variantId = item.id;
      row.dataset.isParent = item.isParent ? "true" : "false";

      // Make non-parent rows draggable for ungroup
      if (!item.isParent) {
        row.draggable = true;
        row.addEventListener("dragstart", function (e) {
          e.dataTransfer.setData("text/plain", JSON.stringify({
            variantId: item.id,
            parentId: shortcutId,
            groupId: groupId,
            title: item.title,
            isParent: false
          }));
          e.dataTransfer.effectAllowed = "move";
          var zone = $("#ungroup-drop-zone");
          if (zone) zone.classList.add("visible");
        });
        row.addEventListener("dragend", function () {
          var zone = $("#ungroup-drop-zone");
          if (zone) zone.classList.remove("visible", "drag-over");
        });
      }

      var img = document.createElement("img");
      img.src = item.favicon;
      img.width = 20;
      img.height = 20;
      img.alt = "";
      row.appendChild(img);

      var label = document.createElement("span");
      label.className = "variant-dropdown-label";
      label.textContent = item.title;
      row.appendChild(label);

      var moreBtn = document.createElement("button");
      moreBtn.className = "variant-dropdown-more";
      moreBtn.title = "Options";
      moreBtn.textContent = "\u22EE";
      moreBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        showVariantCtxMenu(e, item, shortcutId, groupId);
      });
      row.appendChild(moreBtn);

      // Click row to open URL
      row.addEventListener("click", function (e) {
        if (e.defaultPrevented) return;
        chrome.tabs.update({ url: item.url });
        closeVariantDropdown();
      });

      list.appendChild(row);
    });

    document.body.appendChild(dropdown);

    // Position centered below anchor
    var rect = anchorEl.getBoundingClientRect();
    var dropdownWidth = dropdown.offsetWidth;
    var left = rect.left + rect.width / 2 - dropdownWidth / 2;
    var top = rect.bottom + 8;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - dropdownWidth - 8));
    if (top + dropdown.offsetHeight > window.innerHeight - 8) {
      top = rect.top - dropdown.offsetHeight - 8;
      // Flip arrow
      var arrow = dropdown.querySelector(".variant-dropdown-arrow");
      arrow.style.top = "auto";
      arrow.style.bottom = "-6px";
      arrow.style.transform = "translateX(-50%) rotate(180deg)";
    }

    dropdown.style.left = left + "px";
    dropdown.style.top = top + "px";

    // Reposition arrow to point at icon center
    var arrowLeft = rect.left + rect.width / 2 - left;
    var arrowEl = dropdown.querySelector(".variant-dropdown-arrow");
    arrowEl.style.left = arrowLeft + "px";

    // Animate in
    requestAnimationFrame(function () {
      dropdown.classList.add("visible");
    });

  }

  function closeVariantDropdown() {
    closeVariantCtxMenu();
    closeVariantIconDialog();
    var existing = document.querySelector(".variant-dropdown");
    // No-op when nothing is open. Otherwise this clobbers sidebarLocked any
    // time it's called by the generic outside-click handler — including for
    // clicks on inputs in unrelated panels (Pro Settings, etc.).
    if (!existing && !variantDropdownState) return;
    if (existing) existing.remove();
    if (variantDropdownState) {
      var anchorEl = variantDropdownState.anchorEl;
      if (anchorEl) anchorEl.classList.remove("variants-open");
      variantDropdownState = null;
    }
    sidebarLocked = false;
    var sidebar = $("#sidebar");
    if (sidebar && !sidebar.matches(":hover")) sidebar.classList.remove("expanded");
  }

  // ===== Variant Bubble Context Menu =====

  function showVariantCtxMenu(e, item, parentShortcutId, groupId) {
    closeVariantCtxMenu();
    closeVariantIconDialog();
    hideMenu();
    closeNestSubmenu();
    variantCtxState = { item: item, parentShortcutId: parentShortcutId, groupId: groupId };
    var menu = $("#variant-ctx-menu");

    // Show/hide items based on parent vs variant
    var ungroupBtn = $("#vctx-ungroup");
    var deleteBtn = $("#vctx-delete");
    if (ungroupBtn) ungroupBtn.classList.toggle("hidden", item.isParent);
    if (deleteBtn) deleteBtn.classList.toggle("hidden", item.isParent);

    menu.classList.remove("hidden");
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";

    // Ensure menu stays on screen
    var mr = menu.getBoundingClientRect();
    if (mr.right > window.innerWidth - 8) menu.style.left = (window.innerWidth - mr.width - 8) + "px";
    if (mr.bottom > window.innerHeight - 8) menu.style.top = (window.innerHeight - mr.height - 8) + "px";
  }

  function closeVariantCtxMenu() {
    var menu = $("#variant-ctx-menu");
    if (menu) menu.classList.add("hidden");
    variantCtxState = null;
  }

  async function handleVariantCtxAction(action) {
    if (!variantCtxState) return;
    var item = variantCtxState.item;
    var parentId = variantCtxState.parentShortcutId;
    var groupId = variantCtxState.groupId;
    closeVariantCtxMenu();

    if (action === "rename") {
      // Prompt for new label
      var currentLabel = item.title || "";
      var newLabel = prompt("Rename variant:", currentLabel);
      if (newLabel !== null && newLabel.trim()) {
        var g = findGroup(groupId);
        if (!g) return;
        var p = g.shortcuts.find(function (s) { return s.id === parentId; });
        if (!p) return;
        if (item.isParent) {
          p.customLabel = newLabel.trim();
        } else if (p.variants) {
          var v = p.variants.find(function (vv) { return vv.id === item.id; });
          if (v) v.customLabel = newLabel.trim();
        }
        await Storage.saveAll(data);
        // Update label in dropdown row without closing
        var row = document.querySelector('.variant-dropdown-row[data-variant-id="' + item.id + '"]');
        if (row) {
          var labelEl = row.querySelector(".variant-dropdown-label");
          if (labelEl) labelEl.textContent = newLabel.trim();
        }
        data = await Storage.getAll();
        render();
      }
    } else if (action === "changeicon") {
      // Show icon dialog near the dropdown row
      var row = document.querySelector('.variant-dropdown-row[data-variant-id="' + item.id + '"]');
      if (row) showVariantIconDialog(row, item, parentId, groupId);
      return;
    } else if (action === "ungroup") {
      // Remove variant and make it standalone
      var group = findGroup(groupId);
      if (!group) return;
      var parent = group.shortcuts.find(function (s) { return s.id === parentId; });
      if (!parent || !parent.variants) return;
      var vIdx = parent.variants.findIndex(function (v) { return v.id === item.id; });
      if (vIdx === -1) return;
      var removed = parent.variants.splice(vIdx, 1)[0];
      if (!parent.variants.length) delete parent.variants;
      // Add as standalone after parent
      var pIdx = group.shortcuts.indexOf(parent);
      group.shortcuts.splice(pIdx + 1, 0, {
        id: removed.id,
        url: removed.url,
        title: removed.customLabel || removed.title,
        favicon: removed.favicon,
        addedAt: Date.now(),
        deletedAt: null
      });
      await Storage.saveAll(data);
      closeVariantDropdown();
      data = await Storage.getAll();
      render();
    } else if (action === "delete") {
      var group2 = findGroup(groupId);
      if (!group2) return;
      var parent2 = group2.shortcuts.find(function (s) { return s.id === parentId; });
      if (!parent2 || !parent2.variants) return;
      parent2.variants = parent2.variants.filter(function (v) { return v.id !== item.id; });
      if (!parent2.variants.length) delete parent2.variants;
      await Storage.saveAll(data);
      closeVariantDropdown();
      data = await Storage.getAll();
      render();
    }
  }

  // ===== Variant Icon Dialog =====

  var iconDialogState = null;

  function showVariantIconDialog(bubble, item, parentShortcutId, groupId) {
    closeVariantIconDialog();
    iconDialogState = { item: item, parentShortcutId: parentShortcutId, groupId: groupId, bubble: bubble };

    var dialog = $("#variant-icon-dialog");
    var input = $("#vid-url-input");
    input.value = item.customIcon || "";

    var rect = bubble.getBoundingClientRect();
    dialog.classList.remove("hidden");
    var left = rect.right + 8;
    if (left + 220 > window.innerWidth - 8) left = rect.left - 228;
    dialog.style.left = left + "px";
    dialog.style.top = rect.top + "px";

    var dr = dialog.getBoundingClientRect();
    if (dr.bottom > window.innerHeight - 8) {
      dialog.style.top = Math.max(8, window.innerHeight - dr.height - 8) + "px";
    }

    input.focus();
  }

  function closeVariantIconDialog() {
    var dialog = $("#variant-icon-dialog");
    if (dialog) dialog.classList.add("hidden");
    iconDialogState = null;
  }

  function saveVariantIcon(url) {
    if (!iconDialogState) return;
    var item = iconDialogState.item;
    var parentId = iconDialogState.parentShortcutId;
    var groupId = iconDialogState.groupId;
    var bubble = iconDialogState.bubble;

    var group = findGroup(groupId);
    if (!group) return;
    var parent = group.shortcuts.find(function (s) { return s.id === parentId; });
    if (!parent) return;

    if (item.isParent) {
      parent.customIcon = url || "";
    } else if (parent.variants) {
      var variant = parent.variants.find(function (v) { return v.id === item.id; });
      if (variant) variant.customIcon = url || "";
    }

    Storage.saveAll(data);

    // Update the bubble image live
    if (bubble) {
      var img = bubble.querySelector("img");
      if (img) {
        if (url) {
          img.src = url;
          img.classList.add("custom-icon");
        } else {
          // Reset to default favicon
          img.src = item.isParent ? getFaviconUrl(parent) : getFaviconUrl(parent.variants.find(function (v) { return v.id === item.id; }) || parent);
          img.classList.remove("custom-icon");
        }
      }
    }

    closeVariantIconDialog();
    console.log("[LaunchPad] Variant icon updated:", url ? "custom" : "reset to default");
  }

  // ===== Nest Submenu =====

  function showNestSubmenu(shortcutId, groupId, anchorEl) {
    closeNestSubmenu();
    var group = findGroup(groupId);
    if (!group) return;
    var shortcut = group.shortcuts.find(function (s) { return s.id === shortcutId; });
    if (!shortcut) return;

    var others = group.shortcuts.filter(function (s) {
      return s.id !== shortcutId;
    });
    if (!others.length) return;

    var panel = $("#nest-submenu");
    $(".nest-submenu-list", panel).innerHTML = others.map(function (s) {
      var favicon = getFaviconUrl(s);
      return '<button class="nest-submenu-item" data-target-id="' + s.id + '" type="button">' +
        '<img src="' + esc(favicon) + '" alt="" width="20" height="20">' +
        '<span>' + esc(s.title || getDomain(s.url)) + '</span>' +
      '</button>';
    }).join("");

    // Position next to anchor
    var rect = anchorEl.getBoundingClientRect();
    panel.classList.remove("hidden");
    panel.style.top = rect.top + "px";
    panel.style.left = (rect.right + 4) + "px";

    var panelRect = panel.getBoundingClientRect();
    if (panelRect.right > window.innerWidth - 8) {
      panel.style.left = (rect.left - panelRect.width - 4) + "px";
    }
    if (panelRect.bottom > window.innerHeight - 8) {
      panel.style.top = Math.max(8, window.innerHeight - panelRect.height - 8) + "px";
    }
  }

  function closeNestSubmenu() {
    var panel = $("#nest-submenu");
    if (panel) panel.classList.add("hidden");
  }

  // ===== [1.0.9.2] Tag attach submenu + inline create popover =====
  //
  // The submenu is shared between the bookmark right-click menu, the group
  // right-click menu, and the sidebar shortcut right-click menu. A single
  // `tagSubmenuContext` captures which item the user opened it on; the same
  // submenu DOM is repopulated each time. The "Create new tag..." entry at
  // the bottom opens an inline popover that creates + attaches in one step.

  var tagSubmenuContext = null;
  var tagSubmenuFromSidebar = false;
  var tagCreateContext = null;
  var tagCreatePopoverSelectedColor = null;

  function findItemByContext(ctx) {
    if (!ctx) return null;
    if (ctx.type === "group") {
      return findGroup(ctx.groupId) || null;
    }
    if (ctx.type === "shortcut") {
      var group = findGroup(ctx.groupId);
      if (!group) return null;
      return group.shortcuts.find(function (s) { return s.id === ctx.shortcutId; }) || null;
    }
    return null;
  }

  function openTagSubmenu(anchorEl, context) {
    closeTagSubmenu();
    if (!context) return;
    var item = findItemByContext(context);
    if (!item) return;
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;

    tagSubmenuContext = context;
    tagSubmenuFromSidebar = !!context.fromSidebar;
    // Note: do NOT touch sidebarLocked or sidebar classes here. The parent
    // menu (group menu / sidebar shortcut ctx menu) is the lock owner — it
    // sets the lock when it opens and releases it when it closes. The tag
    // submenu opens as a sibling popover beside the still-visible parent;
    // dual ownership of `sidebarLocked` would race the parent's release on
    // outside-click and prematurely collapse the sidebar while the parent
    // menu is still showing. The fromSidebar flag is retained only so close
    // logic can know the original context if needed.

    var panel = $("#tag-submenu");
    if (!panel) return;
    var listEl = panel.querySelector(".tag-submenu-list");
    if (!listEl) return;

    var attachedIds = Storage.ensureTagIdsArray(item);
    var attachedSet = {};
    attachedIds.forEach(function (tid) { attachedSet[tid] = true; });

    var activeTags = Storage.getActiveTags(ws);
    var headerEl = panel.querySelector(".tag-submenu-header");
    var separatorEl = panel.querySelector(".tag-submenu-separator");

    if (!activeTags.length) {
      // Per [1.0.9.2] edge case: empty tag list shows only the "Create new tag..."
      // entry, no list / header / separator.
      listEl.innerHTML = "";
      if (headerEl) headerEl.classList.add("hidden");
      if (separatorEl) separatorEl.classList.add("hidden");
    } else {
      if (headerEl) headerEl.classList.remove("hidden");
      if (separatorEl) separatorEl.classList.remove("hidden");
      listEl.innerHTML = activeTags.map(function (tag) {
        var color = (typeof tag.color === "string" && /^#[0-9a-fA-F]{6}$/.test(tag.color)) ? tag.color : "#6fb1ff";
        var attached = !!attachedSet[tag.id];
        return '<button class="tag-submenu-item' + (attached ? " attached" : "") + '" data-tag-id="' + esc(tag.id) + '" type="button">' +
          '<span class="tag-submenu-swatch" style="background:' + color + '"></span>' +
          '<span class="tag-submenu-name">' + esc(tag.name) + '</span>' +
          '<svg class="tag-submenu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</button>';
      }).join("");
    }

    var rect = anchorEl.getBoundingClientRect();
    panel.classList.remove("hidden");
    panel.style.top = rect.top + "px";
    panel.style.left = (rect.right + 4) + "px";

    var panelRect = panel.getBoundingClientRect();
    if (panelRect.right > window.innerWidth - 8) {
      panel.style.left = (rect.left - panelRect.width - 4) + "px";
    }
    if (panelRect.bottom > window.innerHeight - 8) {
      panel.style.top = Math.max(8, window.innerHeight - panelRect.height - 8) + "px";
    }
  }

  function closeTagSubmenu() {
    var panel = $("#tag-submenu");
    if (!panel || panel.classList.contains("hidden")) {
      tagSubmenuContext = null;
      tagSubmenuFromSidebar = false;
      return;
    }
    panel.classList.add("hidden");
    tagSubmenuContext = null;
    tagSubmenuFromSidebar = false;
    // Note: do NOT release the sidebar lock here. The parent menu (group
    // menu / sidebar shortcut ctx menu) owns the lock and releases it when
    // its own close runs. Releasing here while the parent menu is still
    // visible would collapse the sidebar mid-flow.
  }

  async function toggleItemTag(context, tagId) {
    var item = findItemByContext(context);
    if (!item || !tagId) return;
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;
    var liveTag = Storage.getTagById(ws, tagId);
    if (!liveTag) return; // tag was deleted between submenu open and click
    var tagIds = Storage.ensureTagIdsArray(item);
    var idx = tagIds.indexOf(tagId);
    if (idx === -1) {
      tagIds.push(tagId);
    } else {
      tagIds.splice(idx, 1);
    }
    await Storage.saveAll(data);

    // Update submenu visual without closing — user may want to toggle multiple tags.
    var btn = document.querySelector('#tag-submenu .tag-submenu-item[data-tag-id="' + tagId + '"]');
    if (btn) btn.classList.toggle("attached", idx === -1);

    // Re-render the affected surfaces so pills appear/disappear immediately.
    // Sidebar shortcut entries do not render pills in [1.0.9.2] (only sidebar
    // GROUP entries do), so the shortcut path skips the sidebar refresh.
    if (context.type === "shortcut") {
      renderMainGrid();
    } else if (context.type === "group") {
      renderMainGrid();
      renderSidebarGroups();
    }
  }

  function openTagCreatePopover(anchorEl, context) {
    closeTagCreatePopover();
    if (!context) return;
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;

    tagCreateContext = context;
    var pop = $("#tag-create-popover");
    if (!pop) return;
    var nameInput = $("#tag-create-popover-name");
    var paletteHost = $("#tag-create-popover-palette");
    var saveBtn = $("#tag-create-popover-save");

    var palette = Storage.TAG_PALETTE || [];
    var defaultColor = (typeof Storage.nextAutoTagColor === "function") ? Storage.nextAutoTagColor(ws) : palette[0];
    tagCreatePopoverSelectedColor = defaultColor;

    paletteHost.innerHTML = palette.map(function (c) {
      var selected = c === defaultColor;
      return '<button type="button" class="pro-tag-swatch' + (selected ? " selected" : "") + '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join("");

    paletteHost.querySelectorAll(".pro-tag-swatch").forEach(function (sw) {
      sw.addEventListener("click", function () {
        paletteHost.querySelectorAll(".pro-tag-swatch").forEach(function (s) { s.classList.remove("selected"); });
        sw.classList.add("selected");
        tagCreatePopoverSelectedColor = sw.dataset.color;
      });
    });

    nameInput.value = "";
    if (saveBtn) saveBtn.disabled = true;
    clearTagCreatePopoverError();

    pop.classList.remove("hidden");

    var rect = anchorEl.getBoundingClientRect();
    pop.style.left = rect.left + "px";
    pop.style.top = (rect.bottom + 6) + "px";

    var popRect = pop.getBoundingClientRect();
    if (popRect.right > window.innerWidth - 8) {
      pop.style.left = (window.innerWidth - popRect.width - 8) + "px";
    }
    if (popRect.bottom > window.innerHeight - 8) {
      pop.style.top = Math.max(8, rect.top - popRect.height - 6) + "px";
    }

    setTimeout(function () { nameInput.focus(); }, 0);
  }

  function closeTagCreatePopover() {
    var pop = $("#tag-create-popover");
    if (!pop || pop.classList.contains("hidden")) {
      tagCreateContext = null;
      return;
    }
    pop.classList.add("hidden");
    tagCreateContext = null;
    tagCreatePopoverSelectedColor = null;
    clearTagCreatePopoverError();
  }

  function clearTagCreatePopoverError() {
    var errorEl = $("#tag-create-popover-error");
    if (errorEl && !errorEl.classList.contains("hidden")) {
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    }
  }

  function showTagCreatePopoverError(message) {
    var errorEl = $("#tag-create-popover-error");
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  async function commitTagCreatePopover() {
    if (!tagCreateContext) return;
    var nameInput = $("#tag-create-popover-name");
    if (!nameInput) return;
    clearTagCreatePopoverError();
    var name = (nameInput.value || "").trim();
    if (!name) return;
    var fields = { name: name };
    if (tagCreatePopoverSelectedColor) fields.color = tagCreatePopoverSelectedColor;
    var result = await Storage.createTag(data, fields);
    // [1.0.9.2] round 6: surface duplicate-name conflict inline; keep popover
    // open and refocus the input. Same shape as the Pro Settings create form
    // so the UX is consistent regardless of where the user creates the tag.
    if (result && result.err === "duplicate") {
      showTagCreatePopoverError(result.message);
      nameInput.focus();
      nameInput.select();
      return;
    }
    if (!result) {
      showToast("Could not create tag.");
      return;
    }
    var tag = result;
    // Immediately attach the new tag to the originating item.
    var ctx = tagCreateContext;
    var item = findItemByContext(ctx);
    if (item) {
      var tagIds = Storage.ensureTagIdsArray(item);
      if (tagIds.indexOf(tag.id) === -1) {
        tagIds.push(tag.id);
        await Storage.saveAll(data);
      }
    }
    closeTagCreatePopover();
    closeTagSubmenu();
    hideMenu();
    hideGroupMenu();
    closeSidebarShortcutCtxMenu();
    renderMainGrid();
    renderSidebarGroups();
  }

  async function nestShortcutWith(shortcutId, targetId, groupId) {
    // Find the shortcut and target across all groups (dragged may have moved cross-group)
    var shortcut = null;
    var shortcutGroup = null;
    var target = null;
    var targetGroup = null;

    var nestWs = Storage.getActiveWorkspace(data);
    if (!nestWs) return;
    Storage.ensureGroupsArray(nestWs);
    nestWs.groups.forEach(function (g) {
      g.shortcuts.forEach(function (s) {
        if (s.id === shortcutId) { shortcut = s; shortcutGroup = g; }
        if (s.id === targetId) { target = s; targetGroup = g; }
      });
    });

    if (!shortcut || !target || shortcut === target) return;
    // Extra guard: don't nest target into itself
    if (shortcutId === targetId) return;

    var wasFirstNest = !target.variants || target.variants.length === 0;

    // Initialize variants array on target if needed
    if (!target.variants) target.variants = [];

    // Guard: don't add duplicate variant (check by ID and URL)
    var alreadyNested = target.variants.some(function (v) {
      return v.id === shortcut.id || v.url === shortcut.url;
    });
    if (!alreadyNested) {
      // Do NOT add target as a variant of itself — only add the dragged shortcut
      target.variants.push({
        id: shortcut.id,
        url: shortcut.url,
        title: shortcut.title,
        favicon: shortcut.favicon,
        deletedAt: null
      });
    }

    // Remove the dragged shortcut from ALL groups (not just shortcutGroup)
    // SortableJS may have moved the DOM element cross-group before onEnd fires
    nestWs.groups.forEach(function (g) {
      g.shortcuts = g.shortcuts.filter(function (s) { return s.id !== shortcutId; });
    });

    await Storage.saveAll(data);
    data = await Storage.getAll();
    render();
    console.log("[LaunchPad] Nested shortcut", shortcut.title, "under", target.title);

    // If this was the first nest (target had no variants before), offer rename
    if (wasFirstNest) {
      showNestRenameDialog(targetId, groupId || (targetGroup && targetGroup.id));
    }
  }

  function showNestRenameDialog(shortcutId, groupId) {
    var shortcutEl = document.querySelector('.shortcut[data-id="' + shortcutId + '"]');
    if (!shortcutEl) return;
    var shortcut = findShortcutById(shortcutId);
    if (!shortcut) return;

    // Remove any existing dialog
    var existing = $("#nest-rename-dialog");
    if (existing) existing.remove();

    var rect = shortcutEl.getBoundingClientRect();
    var domain = getBaseDomain(shortcut.url) || shortcut.title || "";

    var dialog = document.createElement("div");
    dialog.id = "nest-rename-dialog";
    dialog.innerHTML =
      '<div class="nrd-title">Shortcuts grouped! Name this group?</div>' +
      '<input type="text" class="nrd-input" value="' + esc(shortcut.title || domain) + '">' +
      '<div class="nrd-actions">' +
        '<button class="nrd-save" type="button">Save</button>' +
        '<button class="nrd-skip" type="button">Skip</button>' +
      '</div>';

    // Position near the shortcut
    dialog.style.position = "fixed";
    dialog.style.left = Math.min(rect.left, window.innerWidth - 260) + "px";
    dialog.style.top = (rect.bottom + 8) + "px";
    if (rect.bottom + 140 > window.innerHeight) {
      dialog.style.top = (rect.top - 120) + "px";
    }

    document.body.appendChild(dialog);

    var input = dialog.querySelector(".nrd-input");
    input.focus();
    input.select();

    var closed = false;
    var close = function () {
      if (closed) return;
      closed = true;
      dialog.remove();
    };

    var save = async function () {
      var val = input.value.trim();
      if (val && shortcut) {
        shortcut.customLabel = val;
        await Storage.saveAll(data);
        data = await Storage.getAll();
        render();
      }
      close();
    };

    dialog.querySelector(".nrd-save").addEventListener("click", save);
    dialog.querySelector(".nrd-skip").addEventListener("click", close);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") { e.preventDefault(); close(); }
    });

    // Close on outside click (delayed to avoid immediate trigger)
    setTimeout(function () {
      var outsideClick = function (e) {
        if (!dialog.contains(e.target)) {
          close();
          document.removeEventListener("mousedown", outsideClick);
        }
      };
      document.addEventListener("mousedown", outsideClick);
    }, 100);
  }

  async function ungroupAll(shortcutId, groupId) {
    var group = findGroup(groupId);
    if (!group) return;
    var idx = group.shortcuts.findIndex(function (s) { return s.id === shortcutId; });
    if (idx === -1) return;
    var shortcut = group.shortcuts[idx];
    if (!shortcut.variants || !shortcut.variants.length) return;

    // Convert variants to standalone shortcuts, inserted after the parent
    var standalones = shortcut.variants.map(function (v) {
      return {
        id: v.id,
        url: v.url,
        title: v.title,
        favicon: v.favicon,
        addedAt: Date.now(),
        deletedAt: null
      };
    });

    // Remove variants from parent
    delete shortcut.variants;

    // Insert standalones after the parent
    var args = [idx + 1, 0].concat(standalones);
    Array.prototype.splice.apply(group.shortcuts, args);

    await Storage.saveAll(data);
    data = await Storage.getAll();
    render();
    console.log("[LaunchPad] Ungrouped", standalones.length, "variants from", shortcut.title);
  }

  // ===== Grid Placeholders =====

  function getGridColumnCount(gridEl) {
    gridEl.offsetHeight; // force layout
    var style = window.getComputedStyle(gridEl);
    var columns = style.getPropertyValue('grid-template-columns');
    if (!columns || columns === 'none') return 6;
    return columns.split(' ').filter(function (s) { return s.trim(); }).length;
  }

  function ensurePlaceholders(gridEl) {
    $$(".grid-placeholder", gridEl).forEach(function (el) { el.remove(); });
    var cols = getGridColumnCount(gridEl);
    for (var i = 0; i < cols; i++) {
      var ph = document.createElement("div");
      ph.className = "grid-placeholder";
      gridEl.appendChild(ph);
    }
  }

  function ensureAllPlaceholders() {
    $$(".shortcuts-grid").forEach(ensurePlaceholders);
  }

  // ===== Render =====

  function render() {
    destroySortables();
    var container = $("#groups");
    var ws = Storage.getActiveWorkspace(data);
    var groups = (ws && ws.groups) || [];
    var groupOrder = (ws && ws.groupOrder) || [];
    var groupMap = {};
    groups.forEach(function (g) { groupMap[g.id] = g; });
    var singleGroup = groupOrder.length <= 1;
    document.body.classList.toggle("workspace-readonly", !!(ws && ws.isReadOnly));
    container.innerHTML = groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean)
      .map(function (g) { return groupHTML(g, singleGroup); })
      .join("");
    ensureAllPlaceholders();
    initSortables();
    renderSidebarGroups();
    initSidebarSortable();
    initSidebarGroupObserver();
    checkNestingTooltip();
    renderReadOnlyBanner();
    // [1.0.11.9] Re-apply document-root settings so a foreign-write render
    // also surfaces wallpaper + icon-size changes (previously one-time init
    // only). Idempotent — applyBackground / applyIconSize replace classes
    // and inline styles wholesale, so a re-run with unchanged values is a
    // visual no-op. loadBackground is async fire-and-forget; the brief
    // delay before background-image lands is acceptable for foreign sync.
    loadBackground();
    applyIconSize((data && data.settings && data.settings.iconSize) || "medium");
  }

  function groupHTML(group, singleGroup) {
    var collapsed = data.settings.collapsedGroups && data.settings.collapsedGroups[group.id];
    var groupClass = "group" + (collapsed ? " collapsed" : "");
    var moreBtn = '<button class="group-more-btn" data-group-id="' + group.id + '" title="Group options">' + THREE_DOT_SVG + "</button>";
    var shortcutCount = group.shortcuts.length;
    var countBadge = '<span class="group-count">(' + shortcutCount + " shortcut" + (shortcutCount !== 1 ? "s" : "") + ")</span>";
    var openAllBtn = shortcutCount > 0
      ? '<button class="group-open-all-btn" data-group-id="' + group.id + '" title="Open all shortcuts in new tabs">\u25B6 Open All</button>'
      : '';
    var gridStyle = collapsed ? ' style="max-height:0"' : '';
    var emptyHint = shortcutCount === 0
      ? '<span class="empty-group-hint">or right-click any page \u2192 Add to LaunchPad</span>'
      : '';
    var groupTagPills = tagPillsHTML(group, Storage.getActiveWorkspace(data), "group-tag-pills");
    return (
      '<section class="' + groupClass + '" data-group-id="' + group.id + '">' +
        '<div class="group-header">' +
          '<div class="group-header-left" data-group-id="' + group.id + '">' +
            '<button class="group-collapse-btn" data-group-id="' + group.id + '" title="' + (collapsed ? "Expand" : "Collapse") + '">' + CHEVRON_DOWN_SVG + "</button>" +
            '<h2 class="group-name" data-group-id="' + group.id + '">' + esc(group.name) + "</h2>" +
            groupTagPills +
            countBadge +
          "</div>" +
          '<div class="group-header-actions">' +
            openAllBtn +
            moreBtn +
          "</div>" +
        "</div>" +
        '<div class="shortcuts-grid" data-group-id="' + group.id + '"' + gridStyle + '>' +
          group.shortcuts.map(function (s) { return shortcutHTML(s); }).join("") +
          addTileHTML(group.id) +
          emptyHint +
        "</div>" +
      "</section>"
    );
  }

  function shortcutHTML(s) {
    var domain = getDomain(s.url);
    var favicon = getFaviconUrl(s);
    var hasVariants = s.variants && s.variants.length > 0;
    var badge = hasVariants
      ? '<span class="variant-badge">' + (1 + s.variants.length) + '</span>'
      : '';
    var displayName = hasVariants
      ? esc(s.customLabel || s.title || getBaseDomain(s.url) || domain)
      : esc(s.title || domain);
    var tagPills = tagPillsHTML(s, Storage.getActiveWorkspace(data), "shortcut-tag-pills");
    return (
      '<div class="shortcut' + (hasVariants ? ' has-variants' : '') + '" data-id="' + s.id + '">' +
        '<a href="' + esc(s.url) + '" class="shortcut-link" title="' + esc(s.title || s.url) + '">' +
          '<div class="shortcut-icon">' +
            '<img src="' + favicon + '" alt="" width="24" height="24" loading="lazy" data-url="' + esc(s.url) + '">' +
            badge +
            tagPills +
          "</div>" +
          '<span class="shortcut-name">' + displayName + "</span>" +
        "</a>" +
        '<button class="shortcut-more" title="More actions">' + MORE_SVG + "</button>" +
      "</div>"
    );
  }

  // ===== [1.0.9.2] Tag pill rendering =====
  //
  // Renders a row of colored pills for the item's tagIds. Three call sites
  // pass different `sizeClass` values to swap the visual: bookmarks use
  // dot-only "shortcut-tag-pills", group headers use name-bearing
  // "group-tag-pills", sidebar group entries use dot-only "sb-group-tag-pills".
  // Soft-deleted tags (tag.deletedAt set) render dimmed via the `.archived`
  // modifier class — per spec, the association persists until day-30 trash
  // auto-purge cleans up the tag ID from items.
  function tagPillsHTML(item, ws, sizeClass) {
    if (!ws || !item) return "";
    var tagIds = Storage.ensureTagIdsArray(item);
    if (!tagIds.length) return "";
    var tags = ws.tags || [];
    var tagMap = {};
    tags.forEach(function (t) { tagMap[t.id] = t; });
    var nameInPill = sizeClass === "group-tag-pills";
    var pills = [];
    tagIds.forEach(function (tid) {
      var tag = tagMap[tid];
      if (!tag) return; // tag was hard-deleted (e.g. day-30 sweep) — no pill to render
      var archived = !!tag.deletedAt;
      var color = (typeof tag.color === "string" && /^#[0-9a-fA-F]{6}$/.test(tag.color)) ? tag.color : "#6fb1ff";
      var label = nameInPill ? esc(tag.name) : "";
      var classes = "tag-pill" + (archived ? " archived" : "");
      var titleAttr = nameInPill ? "" : ' title="' + esc(tag.name) + (archived ? " (archived)" : "") + '"';
      pills.push('<span class="' + classes + '" style="background:' + color + ';color:' + tagTextColorFor(color) + '"' + titleAttr + '>' + label + "</span>");
    });
    if (!pills.length) return "";
    return '<span class="' + sizeClass + '">' + pills.join("") + "</span>";
  }

  function addTileHTML(groupId) {
    return (
      '<button class="add-tile" data-group-id="' + groupId + '" title="Add shortcut">' +
        '<div class="add-tile-icon">' + PLUS_SVG + '</div>' +
        '<span class="add-tile-label">Add shortcut</span>' +
      '</button>'
    );
  }

  // ===== Group Collapse & Show More =====

  async function toggleGroupCollapse(groupId) {
    if (!data.settings.collapsedGroups) data.settings.collapsedGroups = {};
    var groupEl = document.querySelector('.group[data-group-id="' + groupId + '"]');
    if (!groupEl) return;
    var grid = groupEl.querySelector('.shortcuts-grid');
    if (!grid) return;

    var isCollapsed = groupEl.classList.contains('collapsed');

    if (isCollapsed) {
      // Expand
      delete data.settings.collapsedGroups[groupId];
      grid.style.maxHeight = '0px';
      groupEl.classList.remove('collapsed');
      // Force reflow so the browser registers the 0px state
      grid.offsetHeight;
      grid.style.maxHeight = grid.scrollHeight + 'px';
      var onExpand = function () {
        grid.style.maxHeight = '';
        grid.removeEventListener('transitionend', onExpand);
      };
      grid.addEventListener('transitionend', onExpand);
    } else {
      // Collapse
      data.settings.collapsedGroups[groupId] = true;
      grid.style.maxHeight = grid.scrollHeight + 'px';
      // Force reflow so the browser registers the current height
      grid.offsetHeight;
      groupEl.classList.add('collapsed');
      grid.style.maxHeight = '0px';
      var onCollapse = function () {
        grid.removeEventListener('transitionend', onCollapse);
      };
      grid.addEventListener('transitionend', onCollapse);
    }

    await Storage.saveAll(data);
  }

  // ===== Sidebar Functions =====

  // [1.0.11.5] Drop IDs that no longer correspond to extant groups in the
  // active workspace's groupOrder — i.e. groups that were deleted while
  // their entry in the Set lingered. Called by renderSidebarGroups as a
  // safety net for the group-delete case. NOT used for workspace switches:
  // each workspace is its own sidebar context, so workspace-transition
  // sites (switchWorkspace, createWorkspace, deleteWorkspace when active)
  // clear the Set entirely rather than prune against groupOrder. Note
  // "ungrouped" exists in every workspace with the same ID, so a prune
  // would incorrectly preserve it across a switch — see [1.0.11.5]
  // call-site comments for the reasoning.
  function pruneSidebarExpandedGroupIds() {
    var ws = Storage.getActiveWorkspace(data);
    var validIds = new Set((ws && ws.groupOrder) || []);
    sidebarExpandedGroupIds.forEach(function (id) {
      if (!validIds.has(id)) sidebarExpandedGroupIds.delete(id);
    });
  }

  function renderSidebarGroups() {
    var list = $("#sb-group-list");
    if (!list) return;

    var ws = Storage.getActiveWorkspace(data);
    var groups = (ws && ws.groups) || [];
    var groupOrder = (ws && ws.groupOrder) || [];
    var groupMap = {};
    groups.forEach(function (g) { groupMap[g.id] = g; });

    // [1.0.11.5] Safety net for the group-delete case: drop any IDs that
    // outlived their group. Workspace transitions are handled at the
    // transition sites themselves (full Set clear in switchWorkspace /
    // createWorkspace / deleteWorkspace-when-active) — by the time render
    // reaches here on a switch, the Set is already empty and this call is
    // a no-op. See pruneSidebarExpandedGroupIds() comment for the split.
    pruneSidebarExpandedGroupIds();

    list.innerHTML = groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean)
      .map(function (g) {
        var sbTagPills = tagPillsHTML(g, ws, "sb-group-tag-pills");
        // [1.0.11.3] Set is authoritative — replaces the previous DOM-snapshot
        // pattern that read sb-expanded classes off the wrapper.
        var wasExpanded = sidebarExpandedGroupIds.has(g.id);
        var wrapperClass = "sb-group-wrapper" + (wasExpanded ? " sb-expanded" : "");
        var chevronClass = "sb-group-expand-chevron" + (wasExpanded ? " expanded" : "");
        var listStyle = wasExpanded ? ' style="max-height:200px"' : '';
        return '<div class="' + wrapperClass + '" data-group-id="' + g.id + '">' +
          '<div class="sb-group-item" data-group-id="' + g.id + '" title="' + esc(g.name) + '">' +
            '<span class="sidebar-drag-handle" title="Drag to reorder">\u2807</span>' +
            '<span class="' + chevronClass + '">' + CHEVRON_RIGHT_SVG + '</span>' +
            FOLDER_SVG +
            '<span class="sb-group-name">' + esc(g.name) + '</span>' +
            sbTagPills +
            '<span class="sb-group-count">' + g.shortcuts.length + '</span>' +
            '<button class="sb-group-more" data-group-id="' + g.id + '" type="button" title="Group options">' + THREE_DOT_SM_SVG + '</button>' +
          '</div>' +
          '<div class="sidebar-shortcut-list" data-group-id="' + g.id + '"' + listStyle + '>' +
            sidebarShortcutListHTML(g) +
          '</div>' +
        '</div>';
      }).join("");
    initSidebarShortcutSortables();
    updateSidebarExpandAllIcon();
  }

  function sidebarShortcutListHTML(group) {
    if (!group.shortcuts || !group.shortcuts.length) {
      return '<span class="sidebar-shortcut-empty">No shortcuts</span>';
    }
    return group.shortcuts.map(function (s) {
      var favicon = getFaviconUrl(s);
      var hasVariants = s.variants && s.variants.length > 0;
      var chevron = hasVariants
        ? '<span class="sidebar-variant-chevron" data-shortcut-id="' + s.id + '">\u25B8</span>'
        : '';
      var variantBadge = hasVariants
        ? '<span class="sidebar-shortcut-variant-badge">' + (1 + s.variants.length) + '</span>'
        : '';
      var sidebarDisplayName = hasVariants
        ? esc(s.customLabel || s.title || getDomain(s.url))
        : esc(s.title || getDomain(s.url));
      var html = '<div class="sidebar-shortcut-item" data-shortcut-id="' + s.id + '"' +
        (hasVariants ? '' : ' data-url="' + esc(s.url) + '"') +
        ' title="' + esc(s.title || s.url) + '">' +
        '<span class="sidebar-shortcut-drag-handle" title="Drag to reorder">\u2807</span>' +
        chevron +
        '<img src="' + favicon + '" alt="" width="16" height="16">' +
        '<span class="sidebar-shortcut-name">' + sidebarDisplayName + '</span>' +
        variantBadge +
      '</div>';
      if (hasVariants) {
        html += '<div class="sidebar-variant-list" data-parent-id="' + s.id + '">';
        // Parent as first sub-item
        html += '<div class="sidebar-variant-item sidebar-shortcut-item" data-variant-url="' + esc(s.url) + '" title="' + esc(s.title || s.url) + '">' +
          '<img src="' + favicon + '" alt="" width="16" height="16">' +
          '<span class="sidebar-shortcut-name">' + esc(s.title || getDomain(s.url)) + '</span>' +
        '</div>';
        // Then variants
        s.variants.forEach(function (v) {
          var vFavicon = v.favicon || getFaviconUrl(v);
          html += '<div class="sidebar-variant-item sidebar-shortcut-item" data-variant-url="' + esc(v.url) + '" title="' + esc(v.title || v.url) + '">' +
            '<img src="' + vFavicon + '" alt="" width="16" height="16">' +
            '<span class="sidebar-shortcut-name">' + esc(v.customLabel || v.title || v.url) + '</span>' +
          '</div>';
        });
        html += '</div>';
      }
      return html;
    }).join("");
  }

  function initSidebarSortable() {
    if (sidebarSortable) { sidebarSortable.destroy(); sidebarSortable = null; }
    var list = $("#sb-group-list");
    if (!list || typeof Sortable === "undefined") return;
    var ws = Storage.getActiveWorkspace(data);
    var readOnly = !!(ws && ws.isReadOnly);
    sidebarSortable = new Sortable(list, {
      animation: 150,
      disabled: readOnly,
      draggable: ".sb-group-wrapper",
      ghostClass: "sb-group-ghost",
      handle: ".sidebar-drag-handle",
      filter: ".sb-group-more, .sidebar-shortcut-list",
      preventOnFilter: false,
      onEnd: async function () {
        var ws = Storage.getActiveWorkspace(data);
        if (!ws) return;
        ws.groupOrder = $$("#sb-group-list > .sb-group-wrapper").map(function (el) { return el.dataset.groupId; });
        await Storage.saveAll(data);
        // Re-render main page to match new order
        var container = $("#groups");
        var groupMap = {};
        Storage.ensureGroupsArray(ws);
        ws.groups.forEach(function (g) { groupMap[g.id] = g; });
        var singleGroup = ws.groupOrder.length <= 1;
        container.innerHTML = ws.groupOrder
          .map(function (id) { return groupMap[id]; })
          .filter(Boolean)
          .map(function (g) { return groupHTML(g, singleGroup); })
          .join("");
        ensureAllPlaceholders();
        initSortables();
        initSidebarGroupObserver();
        console.log("[LaunchPad] Groups reordered via sidebar drag:", ws.groupOrder);
      }
    });
  }

  var sidebarShortcutSortables = [];

  function initSidebarShortcutSortables() {
    destroySidebarShortcutSortables();
    if (typeof Sortable === "undefined") return;
    var ws = Storage.getActiveWorkspace(data);
    var readOnly = !!(ws && ws.isReadOnly);
    $$(".sidebar-shortcut-list").forEach(function (listEl) {
      var groupId = listEl.dataset.groupId;
      if (!groupId) return;
      var s = new Sortable(listEl, {
        animation: 150,
        // [1.0.11.7] Join the main-grid Sortable group so a bookmark can be
        // dragged between any sidebar group and any main-grid group, plus
        // sidebar↔sidebar. Default pull/put semantics are symmetric.
        group: "shortcuts",
        // [1.0.11.7] Honor the read-only flag. Previously the sidebar
        // Sortable mutated data even in read-only workspaces — pre-existing
        // bug surfaced because adding the "shortcuts" group above would
        // otherwise extend that mutation across all groups.
        disabled: readOnly,
        draggable: ".sidebar-shortcut-item",
        ghostClass: "sb-shortcut-ghost",
        handle: ".sidebar-shortcut-drag-handle",
        filter: ".sidebar-shortcut-empty",
        preventOnFilter: false,
        onEnd: async function (evt) {
          await syncAfterShortcutDrop(evt);
          // Always re-render after a sidebar-sourced drop. Even within-list
          // reorder needs render() because the variant sub-list (a sibling
          // of its parent .sidebar-shortcut-item) does not move with the
          // parent in SortableJS — it would orphan otherwise. Cross-list
          // additionally has a class-mismatched element (e.g. a sidebar
          // item now sitting inside a main-grid .shortcuts-grid); render
          // rebuilds with the correct element type for the destination.
          render();
          console.log("[LaunchPad] Shortcut drag (sidebar source):", { from: evt.from.dataset.groupId, to: evt.to.dataset.groupId });
        }
      });
      sidebarShortcutSortables.push(s);
    });
  }

  function destroySidebarShortcutSortables() {
    sidebarShortcutSortables.forEach(function (s) { s.destroy(); });
    sidebarShortcutSortables = [];
  }

  function renderMainGrid() {
    destroySortables();
    var container = $("#groups");
    var ws = Storage.getActiveWorkspace(data);
    var groups = (ws && ws.groups) || [];
    var groupOrder = (ws && ws.groupOrder) || [];
    var groupMap = {};
    groups.forEach(function (g) { groupMap[g.id] = g; });
    var singleGroup = groupOrder.length <= 1;
    container.innerHTML = groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean)
      .map(function (g) { return groupHTML(g, singleGroup); })
      .join("");
    ensureAllPlaceholders();
    initSortables();
    initSidebarGroupObserver();
  }

  // ===== Sidebar Shortcut Context Menu =====

  var sidebarCtxState = null;

  function showSidebarShortcutCtxMenu(e, shortcutId, groupId) {
    e.preventDefault();
    e.stopPropagation();
    closeSidebarShortcutCtxMenu();

    var group = findGroup(groupId);
    if (!group) return;
    var shortcut = group.shortcuts.find(function (s) { return s.id === shortcutId; });
    if (!shortcut) return;

    sidebarCtxState = { shortcutId: shortcutId, groupId: groupId };

    var menu = $("#sidebar-shortcut-ctx-menu");
    if (!menu) return;

    // Lock sidebar open
    sidebarLocked = true;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.add("sidebar-locked", "expanded");
    }
    showSidebarPanel();

    menu.classList.remove("hidden");
    var rect = e.target.closest(".sidebar-shortcut-item").getBoundingClientRect();
    menu.style.top = rect.top + "px";
    menu.style.left = (rect.right + 4) + "px";

    // Keep within viewport
    var menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth - 8) {
      menu.style.left = (rect.left - menuRect.width - 4) + "px";
    }
    if (menuRect.bottom > window.innerHeight - 8) {
      menu.style.top = (window.innerHeight - menuRect.height - 8) + "px";
    }
  }

  function closeSidebarShortcutCtxMenu() {
    var menu = $("#sidebar-shortcut-ctx-menu");
    if (menu) menu.classList.add("hidden");
    if (sidebarCtxState) {
      sidebarCtxState = null;
      sidebarLocked = false;
      var sidebar = $("#sidebar");
      if (sidebar) {
        sidebar.classList.remove("sidebar-locked");
        if (!sidebar.matches(":hover")) {
          sidebar.classList.remove("expanded");
          hideSidebarPanel();
        }
      }
    }
  }

  async function handleSidebarCtxAction(action) {
    if (!sidebarCtxState) return;
    var groupId = sidebarCtxState.groupId;
    var shortcutId = sidebarCtxState.shortcutId;
    var group = findGroup(groupId);
    if (!group) { closeSidebarShortcutCtxMenu(); return; }
    var shortcut = group.shortcuts.find(function (s) { return s.id === shortcutId; });
    if (!shortcut) { closeSidebarShortcutCtxMenu(); return; }

    // [1.0.9.2 round 3] Add-tag opens tag submenu as a sibling popover and
    // KEEPS the sidebar ctx menu visible (Finder-style). The previous
    // capture-then-close-then-reopen pattern was needed only because tag
    // submenu was managing the sidebar lock itself — that's now owned solely
    // by the parent menu, so we can leave the parent open. Outside-click
    // handlers exempt #tag-submenu and #tag-create-popover so a click in the
    // tag submenu doesn't dismiss the ctx menu.
    if (action === "add-tag") {
      var ctxMenuEl = $("#sidebar-shortcut-ctx-menu");
      if (ctxMenuEl) {
        openTagSubmenu(
          ctxMenuEl,
          { type: "shortcut", shortcutId: shortcutId, groupId: groupId, fromSidebar: true }
        );
      }
      return;
    }

    closeSidebarShortcutCtxMenu();

    if (action === "open") {
      chrome.tabs.update({ url: shortcut.url });
    } else if (action === "open-new-tab") {
      chrome.tabs.create({ url: shortcut.url });
    } else if (action === "rename") {
      startSidebarInlineEdit(shortcutId, groupId, "title");
    } else if (action === "edit-url") {
      startSidebarInlineEdit(shortcutId, groupId, "url");
    } else if (action === "delete") {
      var hasVariants = shortcut.variants && shortcut.variants.length > 0;
      if (hasVariants) {
        if (!confirm("This shortcut has " + shortcut.variants.length + " nested variant(s). Delete all?")) return;
      }
      group.shortcuts = group.shortcuts.filter(function (s) { return s.id !== shortcutId; });
      await Storage.saveAll(data);
      refreshSidebarGroup(groupId);
      renderMainGrid();
      console.log("[LaunchPad] Deleted shortcut from sidebar:", shortcut.title);
    }
  }

  function startSidebarInlineEdit(shortcutId, groupId, field) {
    var itemEl = document.querySelector('.sidebar-shortcut-item[data-shortcut-id="' + shortcutId + '"]');
    if (!itemEl) return;
    var group = findGroup(groupId);
    if (!group) return;
    var shortcut = group.shortcuts.find(function (s) { return s.id === shortcutId; });
    if (!shortcut) return;

    // Lock sidebar
    sidebarLocked = true;
    var sidebar = $("#sidebar");
    if (sidebar) sidebar.classList.add("sidebar-locked", "expanded");
    showSidebarPanel();

    var nameEl = itemEl.querySelector(".sidebar-shortcut-name");
    if (!nameEl) return;

    var currentVal = field === "url" ? shortcut.url : (shortcut.title || getDomain(shortcut.url));
    var input = document.createElement("input");
    input.type = "text";
    input.className = "sidebar-inline-edit";
    input.value = currentVal;

    nameEl.style.display = "none";
    itemEl.insertBefore(input, nameEl.nextSibling);
    input.focus();
    input.select();

    var saved = false;
    var finish = async function (save) {
      if (saved) return;
      saved = true;
      var val = input.value.trim();
      input.remove();
      nameEl.style.display = "";

      if (save && val && val !== currentVal) {
        if (field === "url") {
          // Validate URL
          var normalized = val;
          if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
          try { new URL(normalized); } catch (e) { return; }
          shortcut.url = normalized;
          itemEl.dataset.url = normalized;
        } else {
          shortcut.title = val;
        }
        await Storage.saveAll(data);
        refreshSidebarGroup(groupId);
        renderMainGrid();
      }

      // Unlock sidebar
      sidebarLocked = false;
      if (sidebar) {
        sidebar.classList.remove("sidebar-locked");
        if (!sidebar.matches(":hover")) {
          sidebar.classList.remove("expanded");
          hideSidebarPanel();
        }
      }
    };

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", function () { finish(true); });
  }

  function refreshSidebarGroup(groupId) {
    var wrapper = document.querySelector('.sb-group-wrapper[data-group-id="' + groupId + '"]');
    if (!wrapper) return;
    var listEl = wrapper.querySelector(".sidebar-shortcut-list");
    if (!listEl) return;
    var group = findGroup(groupId);
    if (!group) return;
    var wasExpanded = wrapper.classList.contains("sb-expanded");
    listEl.innerHTML = sidebarShortcutListHTML(group);
    // Update shortcut count
    var countEl = wrapper.querySelector(".sb-group-count");
    if (countEl) countEl.textContent = group.shortcuts.length;
    // Re-init sortable for this list
    initSidebarShortcutSortables();
    if (wasExpanded) {
      listEl.style.maxHeight = "200px";
    }
  }

  // [1.0.11.3] DOM-mutation helpers split out so toggleSidebarGroup, expand-all,
  // and collapse-all share the same animation contract. State (the Set) is
  // managed by the callers; these helpers only touch the DOM.
  function expandSidebarGroupDom(wrapper) {
    if (!wrapper) return;
    var shortcutList = wrapper.querySelector(".sidebar-shortcut-list");
    var chevron = wrapper.querySelector(".sb-group-expand-chevron");
    if (!shortcutList) return;
    if (wrapper.classList.contains("sb-expanded")) return;
    wrapper.classList.add("sb-expanded");
    if (chevron) chevron.classList.add("expanded");
    shortcutList.style.maxHeight = shortcutList.scrollHeight + "px";
    var onTransEnd = function () {
      shortcutList.style.maxHeight = "200px";
      shortcutList.removeEventListener("transitionend", onTransEnd);
    };
    shortcutList.addEventListener("transitionend", onTransEnd);
  }

  function collapseSidebarGroupDom(wrapper) {
    if (!wrapper) return;
    var shortcutList = wrapper.querySelector(".sidebar-shortcut-list");
    var chevron = wrapper.querySelector(".sb-group-expand-chevron");
    if (!shortcutList) return;
    if (!wrapper.classList.contains("sb-expanded")) return;
    shortcutList.style.maxHeight = shortcutList.scrollHeight + "px";
    shortcutList.offsetHeight; // force reflow
    shortcutList.style.maxHeight = "0";
    wrapper.classList.remove("sb-expanded");
    if (chevron) chevron.classList.remove("expanded");
  }

  function toggleSidebarGroup(groupId) {
    var wrapper = document.querySelector('.sb-group-wrapper[data-group-id="' + groupId + '"]');
    if (!wrapper) return;

    // [1.0.11.3] Multi-expand: the Set is authoritative. add/delete this ID;
    // no longer auto-collapse other expanded groups (former accordion model).
    if (sidebarExpandedGroupIds.has(groupId)) {
      sidebarExpandedGroupIds.delete(groupId);
      collapseSidebarGroupDom(wrapper);
    } else {
      sidebarExpandedGroupIds.add(groupId);
      expandSidebarGroupDom(wrapper);
    }
    updateSidebarExpandAllIcon();
  }

  // [1.0.11.3] Expand-all / collapse-all toggle button. Icon flips based on
  // whether any group is currently expanded. Click is a no-op while
  // sidebarLocked is true (a panel/menu owns the sidebar) — matches the
  // "lock-respecting" convention used elsewhere.
  function updateSidebarExpandAllIcon() {
    var btn = $("#sb-expand-all");
    if (!btn) return;
    var iconSlot = btn.querySelector(".sb-expand-all-icon");
    var labelEl = btn.querySelector(".sb-label");
    var allCollapsed = sidebarExpandedGroupIds.size === 0;
    if (iconSlot) iconSlot.innerHTML = allCollapsed ? CHEVRONS_DOWN_SVG : CHEVRONS_UP_SVG;
    if (labelEl) labelEl.textContent = allCollapsed ? "Expand all" : "Collapse all";
    btn.setAttribute("title", allCollapsed ? "Expand all groups" : "Collapse all groups");
    btn.setAttribute("aria-label", allCollapsed ? "Expand all groups" : "Collapse all groups");
  }

  function toggleAllSidebarGroups() {
    if (sidebarLocked) return;
    var wrappers = $$("#sb-group-list > .sb-group-wrapper");
    if (sidebarExpandedGroupIds.size === 0) {
      // Expand all
      wrappers.forEach(function (w) {
        var gid = w.dataset.groupId;
        if (!gid) return;
        sidebarExpandedGroupIds.add(gid);
        expandSidebarGroupDom(w);
      });
    } else {
      // Collapse all
      sidebarExpandedGroupIds.clear();
      wrappers.forEach(collapseSidebarGroupDom);
    }
    updateSidebarExpandAllIcon();
  }

  // [1.0.11.6] Auto-expand a single sidebar group, with the same DOM-sync
  // contract as toggleSidebarGroup's expand branch. Re-checks the
  // "still collapsed" invariant first — the caller's check may be stale
  // by the time we run (timer callback, debug-namespace call from the
  // console). Returns true if an expand actually happened. Intentionally
  // does NOT gate on sidebarLocked: the lock guards against stray
  // stationary clicks, but a drag-in-progress is a deliberate user
  // gesture that should not be silently swallowed because some
  // unrelated panel happens to be open.
  function autoExpandHoveredGroup(targetGroupId) {
    if (!targetGroupId) return false;
    if (sidebarExpandedGroupIds.has(targetGroupId)) return false;
    var wrapper = document.querySelector('.sb-group-wrapper[data-group-id="' + targetGroupId + '"]');
    if (!wrapper) return false;
    sidebarExpandedGroupIds.add(targetGroupId);
    expandSidebarGroupDom(wrapper);
    updateSidebarExpandAllIcon();
    return true;
  }

  // [1.0.11.6] Single delegated dragover handler bound at #sidebar in
  // bindEvents. Tracks the currently-hovered collapsed group and starts
  // a HOVER_EXPAND_DELAY_MS timer; if the cursor stays put long enough,
  // autoExpandHoveredGroup fires. Cursor moving to a different group
  // restarts the timer; cursor leaving any group row (or moving onto an
  // already-expanded group) cancels it.
  function handleSidebarDragover(e) {
    var item = e.target.closest(".sb-group-item");
    var groupId = item ? item.dataset.groupId : null;
    if (!groupId || sidebarExpandedGroupIds.has(groupId)) {
      dragHoverGroupId = null;
      if (dragHoverTimer) { clearTimeout(dragHoverTimer); dragHoverTimer = null; }
      return;
    }
    if (groupId !== dragHoverGroupId) {
      if (dragHoverTimer) clearTimeout(dragHoverTimer);
      dragHoverGroupId = groupId;
      var captured = groupId;
      dragHoverTimer = setTimeout(function () {
        dragHoverTimer = null;
        // Bail if the cursor moved to a different group (or off any
        // group) while the timer was pending. autoExpandHoveredGroup's
        // own "still collapsed" check covers the case where some other
        // path expanded this group in the meantime.
        if (dragHoverGroupId !== captured) return;
        autoExpandHoveredGroup(captured);
      }, HOVER_EXPAND_DELAY_MS);
    }
  }

  function initSidebarGroupObserver() {
    if (sidebarGroupObserver) sidebarGroupObserver.disconnect();
  }

  function openHistoryOverlay() {
    var overlay = $("#history-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    var panel = $("#history-panel");
    if (panel) panel.classList.remove("closing");
    // Always reset to "Today" filter on open
    rcActiveFilter = "today";
    updateRcFilterLabel();
    var datePicker = $("#rc-date-picker");
    if (datePicker) datePicker.classList.add("hidden");
    var searchInput = $("#rc-search-input");
    if (searchInput) searchInput.value = "";
    loadRcData("today");
  }

  function closeHistoryOverlay() {
    var overlay = $("#history-overlay");
    if (!overlay || overlay.classList.contains("hidden")) return;
    var panel = $("#history-panel");
    if (panel) {
      panel.classList.add("closing");
      setTimeout(function () {
        overlay.classList.add("hidden");
        panel.classList.remove("closing");
      }, 200);
    } else {
      overlay.classList.add("hidden");
    }
  }

  function openRestoreDropdown() {
    var dd = $("#restore-dropdown");
    if (!dd) return;
    if (!dd.classList.contains("hidden")) { closeRestoreDropdown(); return; }

    // Lock sidebar open and force expanded
    sidebarLocked = true;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.add("sidebar-locked");
      sidebar.classList.add("expanded");
    }
    showSidebarPanel();

    dd.classList.remove("hidden");
    // Position flush with expanded sidebar edge
    var btn = $("#sb-restore");
    if (btn) {
      var rect = btn.getBoundingClientRect();
      dd.style.top = rect.top + "px";
    }
    dd.style.left = "260px";
    loadRestoreSessions();
  }

  function closeRestoreDropdown(opts) {
    if (restoreCloseTimer) { clearTimeout(restoreCloseTimer); restoreCloseTimer = null; }
    closeRestoreDateMenu();
    var dd = $("#restore-dropdown");
    // Only unlock sidebar if the dropdown was actually open
    if (!dd || dd.classList.contains("hidden")) return;
    dd.classList.add("hidden");

    // [1.0.11.12] silent close — see closeProSettingsPanel for rationale.
    if (opts && opts.silent) return;

    sidebarLocked = false;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.remove("sidebar-locked");
      if (!sidebar.matches(":hover")) {
        sidebar.classList.remove("expanded");
        hideSidebarPanel();
      }
    }
  }

  var restoreSessions = {};
  var restoreSelectedDate = null;

  function getDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatDateLabel(dateKey) {
    var today = getDateKey(new Date());
    var yesterday = getDateKey(new Date(Date.now() - 86400000));
    if (dateKey === today) return "Today";
    if (dateKey === yesterday) return "Yesterday";
    var parts = dateKey.split("-");
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate();
  }

  function formatSavedTime(timestamp) {
    if (!timestamp) return "";
    var d = new Date(timestamp);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 || 12;
    return "Saved at " + h12 + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
  }

  function countSessionTabs(session) {
    if (!session || !session.windows) return 0;
    var n = 0;
    session.windows.forEach(function (w) { n += (w.tabs || []).length; });
    return n;
  }

  function renderSessionTabs(windows) {
    if (!windows || !windows.length) return "";
    var html = "";
    windows.forEach(function (w) {
      (w.tabs || []).forEach(function (t) {
        var domain = getDomain(t.url);
        var favicon = t.favicon || getFaviconUrl(t.url);
        html += '<a class="restore-tab-item" href="' + esc(t.url) + '" title="' + esc(t.url) + '">' +
          '<img src="' + esc(favicon) + '" alt="" width="16" height="16">' +
          '<span class="restore-tab-title">' + esc(t.title || domain) + '</span>' +
          '<span class="restore-tab-domain">' + esc(domain) + '</span>' +
        '</a>';
      });
    });
    return html;
  }

  function loadRestoreSessions() {
    chrome.storage.local.get("savedSessions", function (result) {
      var saved = result.savedSessions || {};
      // Filter to only date-keyed entries
      restoreSessions = {};
      Object.keys(saved).forEach(function (k) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && saved[k] && saved[k].windows && saved[k].windows.length) {
          restoreSessions[k] = saved[k];
        }
      });

      var dateKeys = Object.keys(restoreSessions).sort().reverse();
      var emptyMsg = $("#restore-empty");
      var dateBar = $("#restore-date-bar");
      var infoBar = $("#restore-session-info");
      var tabList = $("#restore-tab-list");

      if (!dateKeys.length) {
        if (dateBar) dateBar.style.display = "none";
        if (infoBar) infoBar.style.display = "none";
        if (tabList) tabList.style.display = "none";
        if (emptyMsg) emptyMsg.classList.remove("hidden");
        return;
      }

      if (emptyMsg) emptyMsg.classList.add("hidden");
      if (dateBar) dateBar.style.display = "";
      if (infoBar) infoBar.style.display = "";
      if (tabList) tabList.style.display = "";

      // Build date menu
      var menu = $("#restore-date-menu");
      if (menu) {
        menu.innerHTML = dateKeys.map(function (k) {
          return '<button class="restore-date-option" data-date="' + k + '" type="button">' + formatDateLabel(k) + '</button>';
        }).join("");
      }

      // Default: most recent date that is NOT today
      var todayKey = getDateKey(new Date());
      if (!restoreSelectedDate || !restoreSessions[restoreSelectedDate]) {
        restoreSelectedDate = dateKeys.find(function (k) { return k !== todayKey; }) || dateKeys[0];
      }

      showRestoreDate(restoreSelectedDate);
    });
  }

  function showRestoreDate(dateKey) {
    restoreSelectedDate = dateKey;
    var session = restoreSessions[dateKey];
    var label = $("#restore-date-label");
    if (label) label.textContent = formatDateLabel(dateKey);

    // Update active state in menu
    $$("#restore-date-menu .restore-date-option").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.date === dateKey);
    });

    var tabCount = countSessionTabs(session);
    var countEl = $("#restore-tab-count");
    if (countEl) {
      countEl.textContent = tabCount + " tab" + (tabCount !== 1 ? "s" : "") + " \u00B7 " + formatSavedTime(session ? session.timestamp : null);
    }

    var allBtn = $("#restore-all-btn");
    if (allBtn) allBtn.textContent = "Restore All (" + tabCount + ")";

    var tabList = $("#restore-tab-list");
    if (tabList) {
      tabList.innerHTML = session ? renderSessionTabs(session.windows) : '';
    }
  }

  function toggleRestoreDateMenu() {
    var menu = $("#restore-date-menu");
    var btn = $("#restore-date-btn");
    if (!menu) return;
    var isOpen = !menu.classList.contains("hidden");
    menu.classList.toggle("hidden", isOpen);
    if (btn) btn.classList.toggle("open", !isOpen);
  }

  function closeRestoreDateMenu() {
    var menu = $("#restore-date-menu");
    var btn = $("#restore-date-btn");
    if (menu) menu.classList.add("hidden");
    if (btn) btn.classList.remove("open");
  }

  function restoreSessionTabs(windows) {
    if (!windows || !windows.length) return;
    windows.forEach(function (w) {
      if (!w.tabs || !w.tabs.length) return;
      var urls = w.tabs.map(function (t) { return t.url; });
      chrome.windows.create({ url: urls[0] }, function (newWin) {
        urls.slice(1).forEach(function (url) {
          chrome.tabs.create({ windowId: newWin.id, url: url });
        });
      });
    });
    closeRestoreDropdown();
  }

  function toggleMobileSidebar() {
    var sidebar = $("#sidebar");
    var backdrop = $("#sidebar-backdrop");
    if (!sidebar) return;
    var isOpen = sidebar.classList.contains("mobile-open");
    sidebar.classList.toggle("mobile-open", !isOpen);
    if (backdrop) backdrop.classList.toggle("visible", !isOpen);
  }

  function showSidebarPanel() {
    var panel = $("#sidebar-panel");
    if (panel) panel.classList.add("visible");
  }

  function hideSidebarPanel() {
    // Defensive lock check: sidebarLocked is the primary signal, but any
    // ctx-menu-or-popover that was opened from the sidebar also relies on
    // the panel staying visible. Including their state objects in the guard
    // prevents the panel from collapsing during async re-render windows
    // (e.g., toggleItemTag's `await Storage.saveAll(data)`) where the lock
    // variable might appear out-of-sync from the open menus.
    if (sidebarLocked || sidebarCtxState || tagSubmenuContext || tagCreateContext) return;
    var panel = $("#sidebar-panel");
    if (panel) panel.classList.remove("visible");
  }

  // ===== History Section =====

  var rcActiveFilter = "today";
  var rcCustomStart = null;
  var rcCustomEnd = null;

  function loadRcData(filter) {
    if (filter === "custom") {
      if (rcCustomStart && rcCustomEnd) {
        loadHistory(rcCustomStart.getTime(), rcCustomEnd.getTime() + 86400000);
      }
    } else {
      var now = new Date();
      var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      var startTime, endTime;
      if (filter === "today") {
        startTime = startOfToday;
        endTime = Date.now();
      } else if (filter === "yesterday") {
        startTime = startOfToday - 86400000;
        endTime = startOfToday;
      } else if (filter === "week") {
        startTime = startOfToday - 7 * 86400000;
        endTime = Date.now();
      } else if (filter === "all") {
        startTime = 0;
        endTime = Date.now();
      }
      loadHistory(startTime, endTime);
    }
  }

  function loadHistory(startTime, endTime) {
    if (!chrome.history || !chrome.history.search) {
      console.warn("[LaunchPad] chrome.history API not available");
      return;
    }
    var maxFetch = (rcActiveFilter === "all") ? 500 : (rcActiveFilter === "week" || rcActiveFilter === "custom") ? 1000 : 500;
    chrome.history.search({
      text: "",
      startTime: startTime,
      endTime: endTime,
      maxResults: maxFetch
    }, function (results) {
      var items = (results || [])
        .filter(function (r) { return r.url && !/^chrome:\/\//i.test(r.url); })
        .map(function (r) { return { url: r.url, title: r.title, lastVisitTime: r.lastVisitTime || Date.now(), visitCount: r.visitCount || 1 }; });
      showRcItems(items);
    });
  }

  function groupByDomain(items) {
    var map = {};
    var order = [];
    items.forEach(function (item) {
      var domain = getDomain(item.url);
      if (!map[domain]) {
        map[domain] = { domain: domain, pages: [], latestTime: 0, totalVisits: 0 };
        order.push(domain);
      }
      var group = map[domain];
      // Deduplicate by URL within domain
      var existing = group.pages.find(function (p) { return p.url === item.url; });
      if (existing) {
        existing.visitCount = (existing.visitCount || 1) + (item.visitCount || 1);
        if ((item.lastVisitTime || 0) > (existing.lastVisitTime || 0)) {
          existing.lastVisitTime = item.lastVisitTime;
          existing.title = item.title || existing.title;
        }
      } else {
        group.pages.push({ url: item.url, title: item.title || domain, lastVisitTime: item.lastVisitTime || 0, visitCount: item.visitCount || 1 });
      }
      group.totalVisits += (item.visitCount || 1);
      if ((item.lastVisitTime || 0) > group.latestTime) {
        group.latestTime = item.lastVisitTime || 0;
      }
    });
    // Sort groups by most recent visit time
    return order.map(function (d) { return map[d]; }).sort(function (a, b) {
      return b.latestTime - a.latestTime;
    });
  }

  function showRcItems(items) {
    rcLoadedItems = items;
    var list = $("#recently-closed-list");
    var query = ($("#rc-search-input") && $("#rc-search-input").value || "").toLowerCase().trim();

    closeDomainPanel();

    if (query) {
      // When searching, show individual matching pages (not grouped)
      var filtered = items.filter(function (t) {
        return (t.title && t.title.toLowerCase().indexOf(query) !== -1) ||
               (t.url && t.url.toLowerCase().indexOf(query) !== -1);
      });
      if (!filtered.length) {
        list.innerHTML = '<div class="rc-empty-state"><div class="rc-empty-state-icon">&#128269;</div><div class="rc-empty-state-text">No matches found</div></div>';
        return;
      }
      list.innerHTML = filtered.map(function (t) { return rcFlatItemHTML(t); }).join("");
      return;
    }

    var groups = groupByDomain(items);
    if (!groups.length) {
      var emptyMsg = rcActiveFilter === "today" ? "No browsing history yet today" : "No pages found for this period";
      list.innerHTML = '<div class="rc-empty-state"><div class="rc-empty-state-icon">&#128214;</div><div class="rc-empty-state-text">' + emptyMsg + '</div></div>';
      return;
    }
    list.innerHTML = groups.map(function (g) { return rcDomainHTML(g); }).join("");
  }

  function rcDomainHTML(group) {
    var favicon = getFaviconUrl("https://" + group.domain);
    var badge = group.pages.length > 1
      ? '<span class="rc-badge">' + group.pages.length + '</span>'
      : '';
    return (
      '<div class="rc-item" data-rc-domain="' + esc(group.domain) + '">' +
        '<div class="rc-link">' +
          '<div class="rc-icon">' +
            '<img src="' + favicon + '" alt="" width="20" height="20" loading="lazy">' +
            badge +
          '</div>' +
          '<span class="rc-name">' + esc(group.domain) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function rcFlatItemHTML(tab) {
    var domain = getDomain(tab.url);
    var favicon = getFaviconUrl(tab.url);
    var title = tab.title || domain;
    return (
      '<div class="rc-item">' +
        '<a href="' + esc(tab.url) + '" class="rc-link" title="' + esc(title) + '">' +
          '<div class="rc-icon">' +
            '<img src="' + favicon + '" alt="" width="20" height="20" loading="lazy">' +
          '</div>' +
          '<span class="rc-name">' + esc(title) + '</span>' +
        '</a>' +
      '</div>'
    );
  }

  // --- Domain detail panel ---

  function openDomainPanel(domain, anchorEl) {
    var groups = groupByDomain(rcLoadedItems);
    var group = groups.find(function (g) { return g.domain === domain; });
    if (!group) return;

    // Single page — just navigate
    if (group.pages.length === 1) {
      window.open(group.pages[0].url, "_blank");
      return;
    }

    var panel = $("#rc-domain-panel");
    var title = $("#rc-panel-title");
    var listEl = $("#rc-panel-list");

    title.textContent = group.domain + " (" + group.pages.length + " pages)";

    // Sort pages by most recent
    var sorted = group.pages.slice().sort(function (a, b) {
      return (b.lastVisitTime || 0) - (a.lastVisitTime || 0);
    });

    listEl.innerHTML = sorted.map(function (p) {
      var favicon = getFaviconUrl("https://" + group.domain);
      var time = p.lastVisitTime ? formatTime(p.lastVisitTime) : "";
      var countNote = p.visitCount > 1 ? " (visited " + p.visitCount + " times)" : "";
      var displayTitle = (p.title || group.domain) + countNote;
      return (
        '<a href="' + esc(p.url) + '" class="rc-panel-item" title="' + esc(p.url) + '">' +
          '<img src="' + favicon + '" alt="" width="16" height="16" loading="lazy">' +
          '<span class="rc-panel-item-title">' + esc(displayTitle) + '</span>' +
          (time ? '<span class="rc-panel-item-meta">' + time + '</span>' : '') +
        '</a>'
      );
    }).join("");

    // Position panel near the clicked icon
    var rect = anchorEl.getBoundingClientRect();
    panel.classList.remove("hidden");
    panel.style.top = (rect.bottom + 6) + "px";
    panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 340)) + "px";

    // Recheck if panel goes off-screen below
    var panelRect = panel.getBoundingClientRect();
    if (panelRect.bottom > window.innerHeight - 8) {
      panel.style.top = Math.max(8, rect.top - panelRect.height - 6) + "px";
    }
  }

  function closeDomainPanel() {
    var panel = $("#rc-domain-panel");
    if (panel) panel.classList.add("hidden");
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
  }

  function updateRcFilterLabel() {
    var label = $("#rc-filter-label");
    if (rcActiveFilter === "today") label.textContent = "Today";
    else if (rcActiveFilter === "yesterday") label.textContent = "Yesterday";
    else if (rcActiveFilter === "week") label.textContent = "Last 7 days";
    else if (rcActiveFilter === "all") label.textContent = "All";
    else if (rcActiveFilter === "custom" && rcCustomStart && rcCustomEnd) {
      label.textContent = formatShortDate(rcCustomStart) + " \u2013 " + formatShortDate(rcCustomEnd);
    }
  }

  function formatShortDate(d) {
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[d.getMonth()] + " " + d.getDate();
  }

  function toggleRcFilterMenu() {
    var menu = $("#rc-filter-menu");
    var btn = $("#rc-filter-btn");
    var isOpen = !menu.classList.contains("hidden");
    menu.classList.toggle("hidden");
    btn.classList.toggle("open", !isOpen);
    if (!isOpen) {
      $$(".rc-filter-option").forEach(function (opt) {
        opt.classList.toggle("active", opt.dataset.filter === rcActiveFilter);
      });
    }
  }

  function closeRcFilterMenu() {
    $("#rc-filter-menu").classList.add("hidden");
    $("#rc-filter-btn").classList.remove("open");
  }

  function selectRcFilter(filter) {
    closeRcFilterMenu();
    var datePicker = $("#rc-date-picker");
    if (filter === "custom") {
      datePicker.classList.remove("hidden");
      rcActiveFilter = "custom";
      updateRcFilterLabel();
      return;
    }
    datePicker.classList.add("hidden");
    rcActiveFilter = filter;
    updateRcFilterLabel();
    loadRcData(filter);
  }

  function applyCustomDateRange() {
    var startVal = $("#rc-date-start").value;
    var endVal = $("#rc-date-end").value;
    if (!startVal || !endVal) return;
    rcCustomStart = new Date(startVal + "T00:00:00");
    rcCustomEnd = new Date(endVal + "T00:00:00");
    if (rcCustomStart > rcCustomEnd) {
      var tmp = rcCustomStart;
      rcCustomStart = rcCustomEnd;
      rcCustomEnd = tmp;
    }
    rcActiveFilter = "custom";
    updateRcFilterLabel();
    loadRcData("custom");
  }

  function filterRcBySearch() {
    showRcItems(rcLoadedItems);
  }

  // ===== Background =====

  async function loadBackground() {
    var bgData = await Storage.getBackground();
    if (!bgData || bgData === "__none__") {
      bgData = DEFAULT_BG;
      await Storage.saveBackground(bgData);
    }
    applyBackground(bgData);
  }

  function applyBackground(bgData) {
    var html = document.documentElement;
    html.classList.remove("bg-image", "bg-light", "bg-dark");
    if (isColorBg(bgData)) {
      var hex = bgData.slice(6);
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundRepeat = "";
      document.body.style.backgroundAttachment = "";
      document.body.style.backgroundColor = hex;
      html.classList.add("has-bg");
      html.classList.add(bgLuminance(hex) >= 0.5 ? "bg-light" : "bg-dark");
    } else {
      document.body.style.backgroundImage = "url('" + bgData + "')";
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.backgroundColor = "";
      html.classList.add("has-bg", "bg-image");
    }
    currentBg = bgData;
  }

  function openBgModal() {
    previousBg = currentBg;
    $("#bg-overlay").classList.remove("hidden");
    $("#bg-url-input").value = "";
    hideBgError();
    renderBgColors();
    renderBgGallery();
    switchBgTab("gallery");
  }

  function closeBgModal() {
    $("#bg-overlay").classList.add("hidden");
    hideBgError();
    updateWallpaperThumb();
  }

  function previewBg(bg) {
    if (previousBg === null) return;
    applyBackground(bg);
    renderBgColors();
    renderBgGallery();
  }

  async function commitBgPreview() {
    if (currentBg !== previousBg) {
      await Storage.saveBackground(currentBg);
    }
    previousBg = null;
    closeBgModal();
  }

  function cancelBgPreview() {
    if (previousBg !== null) {
      if (previousBg !== currentBg) applyBackground(previousBg);
      previousBg = null;
    }
    closeBgModal();
  }

  function renderBgColors() {
    var grid = $("#bg-color-grid");
    if (!grid) return;
    grid.innerHTML = COLOR_PRESETS.map(function (preset) {
      var hex = preset.value.slice(6);
      var isSelected = currentBg === preset.value;
      return '<button class="bg-gallery-thumb bg-color-swatch' + (isSelected ? ' selected' : '') + '" data-bg="' + preset.value + '" type="button" title="' + esc(preset.label) + '" style="background-color: ' + hex + ';">' +
        '<span class="bg-check">' + CHECK_SVG + '</span>' +
        '</button>';
    }).join("");
  }

  function renderBgGallery() {
    var grid = $("#bg-gallery-grid");
    if (!grid) return;
    grid.innerHTML = GALLERY_IMAGES.map(function (img) {
      var isSelected = currentBg === img.url;
      return '<button class="bg-gallery-thumb' + (isSelected ? ' selected' : '') + '" data-bg="' + img.url + '" type="button" title="' + esc(img.label) + '">' +
        '<span class="bg-check">' + CHECK_SVG + '</span>' +
        '<img src="' + img.thumb + '" alt="' + esc(img.label) + '" loading="lazy">' +
        '</button>';
    }).join("");
  }

  function switchBgTab(tabName) {
    $$(".bg-tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    $$(".bg-tab-content").forEach(function (content) {
      content.classList.toggle("hidden", content.dataset.tab !== tabName);
    });
  }

  function handleBgGalleryClick(thumbEl) {
    var bg = thumbEl.dataset.bg;
    if (bg) previewBg(bg);
  }

  function showBgError(msg) {
    var el = $("#bg-error");
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideBgError() {
    var el = $("#bg-error");
    el.textContent = "";
    el.classList.add("hidden");
  }

  function resizeImage(img, callback) {
    var MAX_WIDTH = 1920;
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (w > MAX_WIDTH) {
      h = Math.round(h * (MAX_WIDTH / w));
      w = MAX_WIDTH;
    }
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    callback(dataUrl);
  }

  function handleBgUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
      showBgError("Please select a valid image file.");
      return;
    }
    hideBgError();
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        resizeImage(img, function (dataUrl) {
          if (dataUrl.length > 5 * 1024 * 1024) {
            console.warn("[LaunchPad] Background image is large (" + Math.round(dataUrl.length / 1024 / 1024) + "MB)");
          }
          previewBg(dataUrl);
        });
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      showBgError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  }

  function handleBgUrl(url) {
    url = (url || "").trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      showBgError("Please enter a valid URL starting with http:// or https://");
      return;
    }
    hideBgError();
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      resizeImage(img, function (dataUrl) {
        previewBg(dataUrl);
      });
    };
    img.onerror = function () {
      showBgError("Could not load image. The server may block external access. Try uploading the image instead.");
    };
    img.src = url;
  }

  function handleBgRemove() {
    previewBg(DEFAULT_BG);
  }

  // ===== Events =====

  function bindEvents() {
    // Sidebar buttons
    safeOn("#sb-history", "click", openHistoryOverlay);
    safeOn("#history-panel-close", "click", closeHistoryOverlay);
    safeOn("#history-overlay", "click", function (e) {
      if (e.target === e.currentTarget) closeHistoryOverlay();
    });
    safeOn("#sb-restore", "click", function (e) {
      e.stopPropagation();
      openPanel("restore-session");
    });
    safeOn("#restore-date-btn", "click", function (e) {
      e.stopPropagation();
      toggleRestoreDateMenu();
    });
    safeOn("#restore-date-menu", "click", function (e) {
      var opt = e.target.closest(".restore-date-option");
      if (opt) {
        showRestoreDate(opt.dataset.date);
        closeRestoreDateMenu();
      }
    });
    safeOn("#restore-all-btn", "click", function () {
      var session = restoreSessions[restoreSelectedDate];
      if (session && session.windows) restoreSessionTabs(session.windows);
    });
    safeOn("#restore-tab-list", "click", function (e) {
      var item = e.target.closest(".restore-tab-item");
      if (item) {
        e.preventDefault();
        window.open(item.href, "_blank");
        closeRestoreDropdown();
      }
    });

    // Restore dropdown hover — keep open while mouse is over it
    safeOn("#restore-dropdown", "mouseenter", function () {
      if (restoreCloseTimer) { clearTimeout(restoreCloseTimer); restoreCloseTimer = null; }
    });
    safeOn("#restore-dropdown", "mouseleave", function () {
      restoreCloseTimer = setTimeout(closeRestoreDropdown, 400);
    });
    safeOn("#sb-add-group", "click", addGroup);
    safeOn("#sb-expand-all", "click", toggleAllSidebarGroups);
    // [1.0.11.6] Drag-to-nest auto-expand. Single delegated handler at the
    // sidebar root — survives every renderSidebarGroups innerHTML rewrite.
    safeOn("#sidebar", "dragover", handleSidebarDragover);
    safeOn("#sb-group-list", "click", function (e) {
      // Three-dot menu button
      var moreBtn = e.target.closest(".sb-group-more");
      if (moreBtn) {
        e.preventDefault();
        e.stopPropagation();
        showGroupMenu(moreBtn.dataset.groupId, moreBtn);
        return;
      }

      // Drag handles — do nothing (SortableJS handles them)
      if (e.target.closest(".sidebar-drag-handle") || e.target.closest(".sidebar-shortcut-drag-handle")) return;

      // Variant chevron — toggle variant sub-list
      var variantChevron = e.target.closest(".sidebar-variant-chevron");
      if (variantChevron) {
        e.preventDefault();
        e.stopPropagation();
        var parentId = variantChevron.dataset.shortcutId;
        var listEl = variantChevron.closest(".sidebar-shortcut-list");
        if (listEl) {
          var variantList = listEl.querySelector('.sidebar-variant-list[data-parent-id="' + parentId + '"]');
          if (variantList) {
            var isOpen = variantList.classList.contains("expanded");
            variantList.classList.toggle("expanded", !isOpen);
            variantChevron.classList.toggle("expanded", !isOpen);
          }
        }
        return;
      }

      // Variant item — open the VARIANT's own URL
      var variantItem = e.target.closest(".sidebar-variant-item");
      if (variantItem && variantItem.dataset.variantUrl) {
        e.preventDefault();
        e.stopPropagation();
        chrome.tabs.update({ url: variantItem.dataset.variantUrl });
        return;
      }

      // Shortcut item — if it has variants, toggle variant sub-list; otherwise open URL
      var shortcutItem = e.target.closest(".sidebar-shortcut-item:not(.sidebar-variant-item)");
      if (shortcutItem && shortcutItem.dataset.shortcutId) {
        e.preventDefault();
        e.stopPropagation();
        // Check if this shortcut has a variant sub-list
        var listEl = shortcutItem.closest(".sidebar-shortcut-list");
        var parentId = shortcutItem.dataset.shortcutId;
        if (listEl) {
          var variantList = listEl.querySelector('.sidebar-variant-list[data-parent-id="' + parentId + '"]');
          var chevronEl = shortcutItem.querySelector(".sidebar-variant-chevron");
          if (variantList) {
            // Has variants — toggle expansion
            var isOpen = variantList.classList.contains("expanded");
            variantList.classList.toggle("expanded", !isOpen);
            if (chevronEl) chevronEl.classList.toggle("expanded", !isOpen);
            return;
          }
        }
        // No variants — open the URL
        if (shortcutItem.dataset.url) {
          chrome.tabs.update({ url: shortcutItem.dataset.url });
        }
        return;
      }

      // Group row — toggle expand only. [1.0.11.13] Removed the
      // scrollToGroup(groupId) call: it forced the main grid to align
      // the clicked group at the top of #shortcut-grid-area, producing
      // a few-pixel scroll shift whenever the group was already
      // partially or fully visible. The expansion itself is the user's
      // intent here; navigation to the group is available via clicking
      // a bookmark in the sidebar (which actually opens a URL).
      var groupItem = e.target.closest(".sb-group-item");
      if (groupItem) {
        var groupId = groupItem.dataset.groupId;
        toggleSidebarGroup(groupId);
      }
    });

    // Right-click on sidebar shortcuts AND on sidebar group rows. Both
    // dispatch through this single delegated listener on the stable parent
    // (#sb-group-list never re-renders; renderSidebarGroups rewrites only
    // its innerHTML, so the listener survives every render lifecycle).
    safeOn("#sb-group-list", "contextmenu", function (e) {
      // Shortcut row right-click
      var shortcutItem = e.target.closest(".sidebar-shortcut-item");
      if (shortcutItem && shortcutItem.dataset.shortcutId) {
        var listEl = shortcutItem.closest(".sidebar-shortcut-list");
        if (!listEl) return;
        showSidebarShortcutCtxMenu(e, shortcutItem.dataset.shortcutId, listEl.dataset.groupId);
        return;
      }
      // Group row right-click → open #group-menu near the cursor (NOT at the
      // .sb-group-more 3-dot button position, which sits at the far right of
      // the row and visually disconnects the menu from the click point).
      // Synthesize an anchor with a 1x1 rect at the cursor coords; delegate
      // closest() to the actual DOM element so showGroupMenu's
      // anchor.closest("#sidebar") sidebar-detection still resolves correctly
      // (this anchor IS inside #sidebar, so groupMenuFromSidebar=true and the
      // sidebar lock engages as expected).
      var groupItem = e.target.closest(".sb-group-item");
      if (groupItem && groupItem.dataset.groupId) {
        e.preventDefault();
        e.stopPropagation();
        var cx = e.clientX, cy = e.clientY;
        var cursorAnchor = {
          getBoundingClientRect: function () {
            return { left: cx, top: cy, right: cx + 1, bottom: cy + 1, width: 1, height: 1 };
          },
          closest: function (sel) { return groupItem.closest(sel); }
        };
        showGroupMenu(groupItem.dataset.groupId, cursorAnchor);
      }
    });

    // Sidebar shortcut context menu actions
    safeOn("#sidebar-shortcut-ctx-menu", "click", function (e) {
      var opt = e.target.closest(".sb-ctx-option");
      if (opt) handleSidebarCtxAction(opt.dataset.action);
    });

    // Close sidebar ctx menu on outside click and escape. Exempt the tag
    // submenu and create popover so a click inside either of them (a tag
    // toggle, "Create new tag...", or the create-form input) doesn't dismiss
    // the parent ctx menu — Finder-style nesting per [1.0.9.2 round 3].
    document.addEventListener("click", function (e) {
      if (sidebarCtxState
          && !e.target.closest("#sidebar-shortcut-ctx-menu")
          && !e.target.closest("#tag-submenu")
          && !e.target.closest("#tag-create-popover")) {
        closeSidebarShortcutCtxMenu();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebarCtxState) {
        closeSidebarShortcutCtxMenu();
      }
    });

    // Ungroup drop zone for variant bubble drag-out
    var ungroupZone = $("#ungroup-drop-zone");
    if (ungroupZone) {
      ungroupZone.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        ungroupZone.classList.add("drag-over");
      });
      ungroupZone.addEventListener("dragleave", function () {
        ungroupZone.classList.remove("drag-over");
      });
      ungroupZone.addEventListener("drop", async function (e) {
        e.preventDefault();
        ungroupZone.classList.remove("visible", "drag-over");
        try {
          var payload = JSON.parse(e.dataTransfer.getData("text/plain"));
          var group = findGroup(payload.groupId);
          if (!group) return;
          var parent = group.shortcuts.find(function (s) { return s.id === payload.parentId; });
          if (!parent || !parent.variants) return;
          var draggedTitle = payload.title || "shortcut";

          if (payload.isParent) {
            // Parent dragged out — promote first variant to new parent
            var parentIdx = group.shortcuts.indexOf(parent);
            if (parent.variants.length === 1) {
              // Only 1 variant — both become standalone
              var onlyVariant = parent.variants[0];
              var newStandalone = {
                id: onlyVariant.id,
                url: onlyVariant.url,
                title: onlyVariant.customLabel || onlyVariant.title,
                favicon: onlyVariant.favicon,
                addedAt: Date.now(),
                deletedAt: null
              };
              delete parent.variants;
              delete parent.customLabel;
              group.shortcuts.splice(parentIdx + 1, 0, newStandalone);
            } else {
              // Multiple variants — first variant becomes new parent
              var newParentData = parent.variants.shift();
              var remainingVariants = parent.variants;
              var oldParentStandalone = {
                id: parent.id,
                url: parent.url,
                title: parent.customLabel || parent.title,
                favicon: parent.favicon,
                addedAt: Date.now(),
                deletedAt: null
              };
              // Replace parent in-place with new parent
              group.shortcuts[parentIdx] = {
                id: newParentData.id,
                url: newParentData.url,
                title: newParentData.customLabel || newParentData.title,
                favicon: newParentData.favicon,
                variants: remainingVariants,
                addedAt: Date.now(),
                deletedAt: null
              };
              // Add old parent as standalone after new parent
              group.shortcuts.splice(parentIdx + 1, 0, oldParentStandalone);
            }
          } else {
            // Variant dragged out
            var variantIdx = parent.variants.findIndex(function (v) { return v.id === payload.variantId; });
            if (variantIdx === -1) return;
            var variant = parent.variants[variantIdx];
            parent.variants.splice(variantIdx, 1);
            if (parent.variants.length === 0) delete parent.variants;
            var parentIdx2 = group.shortcuts.indexOf(parent);
            var standalone = {
              id: variant.id,
              url: variant.url,
              title: variant.title,
              favicon: variant.favicon,
              addedAt: Date.now(),
              deletedAt: null
            };
            group.shortcuts.splice(parentIdx2 + 1, 0, standalone);
          }

          await Storage.saveAll(data);
          closeVariantDropdown();
          data = await Storage.getAll();
          render();
          var toast = $("#open-all-toast");
          if (toast) {
            toast.textContent = "Ungrouped \"" + draggedTitle + "\"";
            toast.classList.add("visible");
            clearTimeout(toast._timer);
            toast._timer = setTimeout(function () { toast.classList.remove("visible"); }, 3000);
          }
          console.log("[LaunchPad] Ungrouped via drag:", draggedTitle);
        } catch (err) {
          console.error("[LaunchPad] Failed to ungroup:", err);
        }
      });
    }

    // Group context menu option clicks
    safeOn("#group-menu", "click", function (e) {
      var opt = e.target.closest(".gm-option");
      if (opt) handleGroupMenuAction(opt.dataset.action);
    });

    // Delete dialog handlers
    safeOn("#gd-cancel", "click", hideDeleteDialog);
    safeOn("#gd-confirm", "click", confirmDeleteGroup);
    safeOn("#gd-move-delete", "click", moveAndDeleteGroup);
    safeOn("#group-delete-overlay", "click", function (e) {
      if (e.target === e.currentTarget) hideDeleteDialog();
    });
    safeOn("#sb-settings", "click", function (e) { e.stopPropagation(); openPanel("settings"); });

    // Settings panel events
    safeOn("#settings-close", "click", function () { closeSettingsPanel(); });
    safeOn("#settings-icon-size", "click", function (e) {
      var btn = e.target.closest(".seg-btn");
      if (!btn) return;
      data.settings.iconSize = btn.dataset.value;
      Storage.saveAll(data);
      applyIconSize(btn.dataset.value);
      updateSettingsUI();
      console.log("[LaunchPad] Icon size set to:", btn.dataset.value);
    });
    safeOn("#settings-change-wallpaper", "click", function () {
      closeSettingsPanel();
      openBgModal();
    });
    safeOn("#settings-remove-wallpaper", "click", function () {
      handleBgRemove();
      updateWallpaperThumb();
    });
    safeOn("#settings-import-bookmarks", "click", function () {
      closeSettingsPanel();
      Bookmarks.showPicker();
    });
    safeOn("#settings-export-backup", "click", exportBackup);
    safeOn("#settings-import-backup", "click", function () {
      var input = $("#settings-backup-file");
      if (input) input.click();
    });
    safeOn("#settings-backup-file", "change", function () {
      if (this.files && this.files[0]) handleBackupFile(this.files[0]);
      this.value = "";
    });
    safeOn("#sidebar-hamburger", "click", toggleMobileSidebar);
    safeOn("#sidebar-backdrop", "click", toggleMobileSidebar);

    // Sidebar hover — JS-driven expand/collapse
    safeOn("#sidebar", "mouseenter", function () {
      var sidebar = $("#sidebar");
      if (sidebar) sidebar.classList.add("expanded");
      showSidebarPanel();
    });
    safeOn("#sidebar", "mouseleave", function () {
      var sidebar = $("#sidebar");
      // Same defensive lock check as hideSidebarPanel: any open ctx menu /
      // tag submenu / tag create popover keeps the sidebar expanded so the
      // user can finish their interaction. sidebarLocked alone is enough in
      // theory; the additional state checks guard against any window where
      // the lock variable could be out-of-sync with the actually-open UI.
      var keepOpen = sidebarLocked || sidebarCtxState || tagSubmenuContext || tagCreateContext;
      if (sidebar && !keepOpen) sidebar.classList.remove("expanded");
      hideSidebarPanel();
      if (keepOpen) return;
      hideGroupMenu();
      closeRestoreDropdown();
    });

    // Group context menu — close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideGroupMenu();
    });

    // Global favicon error fallback — try Google API, then placeholder
    document.addEventListener("error", function (e) {
      var img = e.target;
      if (img.tagName !== "IMG") return;
      if (!img.closest(".shortcut-icon, .rc-icon, .ob-popular-icon, .ob-preview-favicon, .restore-tab-item, .rc-panel-item")) return;

      var url = img.dataset.url || (img.closest("a[href]") && img.closest("a[href]").href) || "";
      var domain;
      try { domain = new URL(url).hostname; } catch (ex) { domain = ""; }
      var googleSrc = domain ? "https://www.google.com/s2/favicons?domain=" + domain + "&sz=128" : "";

      if (googleSrc && img.getAttribute("src") !== googleSrc) {
        img.src = googleSrc;
      } else {
        img.src = "assets/placeholder.svg";
        img.onerror = null;
      }
    }, true);

    // First-run toast events
    safeOn("#toast-dismiss", "click", hideFirstRunToast);
    safeOn("#toast-import", "click", function (e) {
      e.preventDefault();
      hideFirstRunToast();
      Bookmarks.showPicker();
    });

    // Right-click tip
    safeOn("#rc-tip-dismiss", "click", dismissRightClickTip);

    // Nesting tooltip dismiss
    safeOn("#nesting-tooltip .nest-tip-dismiss", "click", async function () {
      hideNestingTooltip();
      if (data && data.settings) {
        data.settings.nestingTipDismissed = true;
        await Storage.saveAll(data);
      }
    });

    // Delegated clicks on groups container
    safeOn("#groups", "click", function (e) {
      var el;

      // Group name — inline rename (must check BEFORE group-header-left)
      el = e.target.closest(".group-name");
      if (el) { e.stopPropagation(); startRename(el); return; }

      // Open All button
      el = e.target.closest(".group-open-all-btn");
      if (el) { e.stopPropagation(); openAllInGroup(el.dataset.groupId); return; }

      // Chevron — collapse/expand
      el = e.target.closest(".group-collapse-btn");
      if (el) { toggleGroupCollapse(el.dataset.groupId); return; }

      // Nested shortcut — click to toggle variant dropdown
      el = e.target.closest(".shortcut.has-variants");
      if (el && !e.target.closest(".shortcut-more")) {
        e.preventDefault();
        e.stopPropagation();
        var grid = el.closest(".shortcuts-grid");
        if (!grid) return;
        var sid = el.dataset.id;
        // Toggle: if already open for this shortcut, close it
        if (variantDropdownState && variantDropdownState.shortcutId === sid) {
          closeVariantDropdown();
        } else {
          showVariantDropdown(sid, grid.dataset.groupId, el.querySelector(".shortcut-icon"));
        }
        return;
      }

      el = e.target.closest(".add-tile");
      if (el) { openModal("add", el.dataset.groupId); return; }

      el = e.target.closest(".group-more-btn");
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        showGroupMenu(el.dataset.groupId, el);
        return;
      }

      el = e.target.closest(".shortcut-more");
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        var tile = el.closest(".shortcut");
        var grid = tile.closest(".shortcuts-grid");
        showMenu(tile.dataset.id, grid.dataset.groupId, el);
        return;
      }
    });

    // Right-click on main-grid shortcut tiles AND on group headers. Both
    // dispatch through this single delegated listener on #groups (the stable
    // parent that never re-renders; renderMainGrid rewrites only its
    // innerHTML, so the listener survives every render lifecycle).
    safeOn("#groups", "contextmenu", function (e) {
      // Shortcut tile right-click → bookmark menu.
      var tile = e.target.closest(".shortcut");
      if (tile) {
        if (e.target.closest(".shortcut-more")) return;
        if (e.target.closest(".add-tile")) return;
        var grid = tile.closest(".shortcuts-grid");
        if (!grid) return;
        e.preventDefault();
        e.stopPropagation();
        showMenu(tile.dataset.id, grid.dataset.groupId, tile);
        return;
      }
      // Group header right-click → group menu near the cursor (NOT at the
      // .group-more-btn 3-dot button, which sits far right of the header
      // and visually disconnects the menu from the click). Synthesize a
      // cursor anchor; delegate closest() to the actual header element so
      // showGroupMenu's anchor.closest("#sidebar") sidebar-detection still
      // resolves correctly (header is in main grid → returns null →
      // groupMenuFromSidebar=false → no sidebar lock).
      var groupHeader = e.target.closest(".group-header");
      if (groupHeader) {
        var groupSection = groupHeader.closest(".group");
        if (!groupSection || !groupSection.dataset.groupId) return;
        e.preventDefault();
        e.stopPropagation();
        var cx = e.clientX, cy = e.clientY;
        var cursorAnchor = {
          getBoundingClientRect: function () {
            return { left: cx, top: cy, right: cx + 1, bottom: cy + 1, width: 1, height: 1 };
          },
          closest: function (sel) { return groupHeader.closest(sel); }
        };
        showGroupMenu(groupSection.dataset.groupId, cursorAnchor);
      }
    });

    // Enter key on group header triggers Open All
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      var header = document.querySelector(".group-header:hover");
      if (!header) return;
      var section = header.closest(".group");
      if (section) { openAllInGroup(section.dataset.groupId); }
    });

    // Modal
    safeOn("#modal-cancel", "click", closeModal);
    safeOn("#modal-save", "click", saveModal);
    safeOn("#modal-overlay", "click", function (e) {
      if (e.target === e.currentTarget) closeModal();
    });
    safeOn("#modal-import-bookmarks", "click", function (e) {
      e.preventDefault();
      closeModal();
      Bookmarks.showPicker();
    });
    safeOn("#modal-icon-upload", "click", function () {
      var fileInput = $("#modal-icon-file");
      if (fileInput) fileInput.click();
    });
    safeOn("#modal-icon-file", "change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 102400) {
        alert("Icon file must be under 100KB.");
        this.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        modalState.customFavicon = ev.target.result;
        var preview = $("#modal-icon-preview");
        if (preview) preview.src = ev.target.result;
        var resetBtn = $("#modal-icon-reset");
        if (resetBtn) resetBtn.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    });
    safeOn("#modal-icon-reset", "click", function () {
      modalState.customFavicon = "";
      var preview = $("#modal-icon-preview");
      if (preview && modalState.shortcut) {
        preview.src = getFaviconUrl(modalState.shortcut);
      }
      this.classList.add("hidden");
      var fileInput = $("#modal-icon-file");
      if (fileInput) fileInput.value = "";
    });
    safeOn("#modal-url", "input", function () {
      var nameEl = $("#modal-name");
      if (nameEl && nameEl.dataset.edited === "true") return;
      var domain = getDomain(this.value.trim());
      if (domain && nameEl) nameEl.value = domain.replace(/^www\./, "");
    });
    safeOn("#modal-name", "input", function () {
      this.dataset.edited = "true";
    });
    safeOn("#modal-url", "keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); saveModal(); }
    });
    safeOn("#modal-name", "keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); saveModal(); }
    });

    // Context menu items
    safeOn("#menu-edit", "click", function () {
      if (!activeMenu) return;
      var group = findGroup(activeMenu.groupId);
      var sc = group && group.shortcuts.find(function (s) { return s.id === activeMenu.shortcutId; });
      if (sc) openModal("edit", activeMenu.groupId, sc);
      hideMenu();
    });
    safeOn("#menu-remove", "click", async function () {
      if (!activeMenu) return;
      await Storage.removeShortcut(activeMenu.groupId, activeMenu.shortcutId);
      hideMenu();
      data = await Storage.getAll();
      render();
    });
    safeOn("#menu-open-default", "click", function () {
      if (!activeMenu) return;
      var group = findGroup(activeMenu.groupId);
      var sc = group && group.shortcuts.find(function (s) { return s.id === activeMenu.shortcutId; });
      if (sc) chrome.tabs.update({ url: sc.url });
      hideMenu();
    });
    safeOn("#menu-manage-variants", "click", function () {
      if (!activeMenu) return;
      var tile = document.querySelector('.shortcut[data-id="' + activeMenu.shortcutId + '"]');
      if (tile) {
        showVariantDropdown(activeMenu.shortcutId, activeMenu.groupId, tile.querySelector(".shortcut-icon"));
      }
      hideMenu();
    });
    safeOn("#menu-ungroup", "click", async function () {
      if (!activeMenu) return;
      await ungroupAll(activeMenu.shortcutId, activeMenu.groupId);
      hideMenu();
    });
    safeOn("#menu-nest-with", "click", function () {
      if (!activeMenu) return;
      var menuEl = $("#shortcut-menu");
      showNestSubmenu(activeMenu.shortcutId, activeMenu.groupId, menuEl);
    });

    // Nest submenu item click
    safeOn("#nest-submenu", "click", async function (e) {
      var item = e.target.closest(".nest-submenu-item");
      if (!item || !activeMenu) return;
      var targetId = item.dataset.targetId;
      await nestShortcutWith(activeMenu.shortcutId, targetId, activeMenu.groupId);
      closeNestSubmenu();
      hideMenu();
    });

    // [1.0.9.2] Add-tag submenu invocation from the bookmark right-click menu.
    safeOn("#menu-add-tag", "click", function () {
      if (!activeMenu) return;
      var menuEl = $("#shortcut-menu");
      openTagSubmenu(menuEl, { type: "shortcut", shortcutId: activeMenu.shortcutId, groupId: activeMenu.groupId });
    });

    // [1.0.9.2] Tag submenu interaction — toggle attach/detach OR open create popover.
    safeOn("#tag-submenu", "click", async function (e) {
      var createBtn = e.target.closest(".tag-submenu-create");
      if (createBtn) {
        var ctxForCreate = tagSubmenuContext;
        var anchor = $("#tag-submenu");
        closeTagSubmenu();
        openTagCreatePopover(anchor, ctxForCreate);
        return;
      }
      var item = e.target.closest(".tag-submenu-item");
      if (!item || !tagSubmenuContext) return;
      var tagId = item.dataset.tagId;
      await toggleItemTag(tagSubmenuContext, tagId);
    });

    // [1.0.9.2] Tag create popover wiring (save / cancel / input state / keys).
    safeOn("#tag-create-popover-save", "click", commitTagCreatePopover);
    safeOn("#tag-create-popover-cancel", "click", function () { closeTagCreatePopover(); });
    safeOn("#tag-create-popover-name", "input", function (e) {
      var saveBtn = $("#tag-create-popover-save");
      if (saveBtn) saveBtn.disabled = !((e.target.value || "").trim());
      clearTagCreatePopoverError();
    });
    safeOn("#tag-create-popover-name", "keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        if ((e.target.value || "").trim()) commitTagCreatePopover();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeTagCreatePopover();
      }
    });

    // Variant bubble context menu actions
    safeOn("#variant-ctx-menu", "click", function (e) {
      var item = e.target.closest(".vctx-item");
      if (item) handleVariantCtxAction(item.dataset.action);
    });

    // Variant icon dialog
    safeOn("#vid-save", "click", function () {
      var url = ($("#vid-url-input").value || "").trim();
      saveVariantIcon(url);
    });
    safeOn("#vid-reset", "click", function () {
      saveVariantIcon("");
    });
    safeOn("#vid-url-input", "keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); saveVariantIcon((this.value || "").trim()); }
      if (e.key === "Escape") { e.preventDefault(); closeVariantIconDialog(); }
    });

    // History section
    safeOn("#rc-filter-btn", "click", function (e) {
      e.stopPropagation();
      toggleRcFilterMenu();
    });
    safeOn("#rc-filter-menu", "click", function (e) {
      var opt = e.target.closest(".rc-filter-option");
      if (opt) selectRcFilter(opt.dataset.filter);
    });
    safeOn("#recently-closed-list", "click", function (e) {
      var item = e.target.closest(".rc-item[data-rc-domain]");
      if (!item) return;
      e.preventDefault();
      openDomainPanel(item.dataset.rcDomain, item);
    });
    safeOn("#rc-panel-close", "click", closeDomainPanel);
    safeOn("#rc-date-start", "change", applyCustomDateRange);
    safeOn("#rc-date-end", "change", applyCustomDateRange);
    safeOn("#rc-search-input", "input", filterRcBySearch);

    // Background modal
    safeOn("#bg-overlay", "click", function (e) {
      if (e.target === e.currentTarget) cancelBgPreview();
    });
    safeOn("#bg-cancel", "click", cancelBgPreview);
    safeOn("#bg-save", "click", commitBgPreview);
    safeOn("#bg-upload-btn", "click", function () {
      var fi = $("#bg-file-input");
      if (fi) fi.click();
    });
    safeOn("#bg-file-input", "change", function () {
      if (this.files && this.files[0]) handleBgUpload(this.files[0]);
      this.value = "";
    });
    safeOn("#bg-url-apply", "click", function () {
      var inp = $("#bg-url-input");
      if (inp) handleBgUrl(inp.value);
    });
    safeOn("#bg-url-input", "keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); handleBgUrl(this.value); }
    });
    safeOn("#bg-remove", "click", handleBgRemove);

    // Background gallery tabs
    safeOn("#bg-tabs", "click", function (e) {
      var tab = e.target.closest(".bg-tab");
      if (tab) switchBgTab(tab.dataset.tab);
    });
    safeOn("#bg-gallery-grid", "click", function (e) {
      var thumb = e.target.closest(".bg-gallery-thumb");
      if (thumb) handleBgGalleryClick(thumb);
    });
    safeOn("#bg-color-grid", "click", function (e) {
      var thumb = e.target.closest(".bg-gallery-thumb");
      if (thumb) handleBgGalleryClick(thumb);
    });

    // Onboarding events
    safeOn("#ob-top-sites", "click", handleObTopSites);
    safeOn("#ob-bookmarks", "click", function () { handleObBookmarks(); });
    safeOn("#ob-both", "click", handleObBoth);
    safeOn("#ob-skip-import", "click", function (e) {
      e.preventDefault();
      addSelectedPopularSites().then(function () { render(); goToObStep(2); });
    });
    safeOn("#ob-bg-next", "click", handleObBgNext);
    safeOn("#ob-skip-bg", "click", function (e) {
      e.preventDefault();
      Storage.saveBackground(DEFAULT_BG);
      applyBackground(DEFAULT_BG);
      goToObStep(3);
    });
    safeOn("#ob-upload-own", "click", handleObUploadOwn);
    safeOn("#ob-file-input", "change", function () {
      if (this.files && this.files[0]) handleObFileUpload(this.files[0]);
      this.value = "";
    });
    safeOn("#ob-get-started", "click", finishOnboarding);
    safeOn("#ob-popular-row", "click", function (e) {
      var item = e.target.closest(".ob-popular-item");
      if (item) toggleObPopularSite(parseInt(item.dataset.index));
    });
    safeOn("#ob-bg-grid", "click", function (e) {
      var thumb = e.target.closest(".ob-bg-thumb");
      if (thumb) selectObBg(thumb);
    });
    safeOn("#ob-bg-color-grid", "click", function (e) {
      var thumb = e.target.closest(".ob-bg-thumb");
      if (thumb) selectObBg(thumb);
    });

    // Close menus on outside click
    document.addEventListener("click", function (e) {
      // If the click target was synchronously detached during the target's
      // own click handler (e.g. inline rename's replaceWith, or the workspace
      // dropdown's "Add workspace" innerHTML rebuild), .closest() walks an
      // empty parent chain and returns null for everything — which would
      // falsely match "outside the panel" for every check below. Bail.
      if (!e.target.isConnected) return;
      if (!e.target.closest("#shortcut-menu") && !e.target.closest(".shortcut-more") && !e.target.closest("#nest-submenu") && !e.target.closest("#tag-submenu") && !e.target.closest("#tag-create-popover")) {
        hideMenu();
        closeNestSubmenu();
      }
      // Close tag submenu when click is outside both the submenu and any
      // open create popover (which is its child flow).
      if (!e.target.closest("#tag-submenu") && !e.target.closest("#tag-create-popover") &&
          !e.target.closest("#menu-add-tag") && !e.target.closest('[data-action="add-tag"]')) {
        closeTagSubmenu();
        closeTagCreatePopover();
      }
      if (!e.target.closest(".variant-dropdown") && !e.target.closest("#variant-ctx-menu") && !e.target.closest("#variant-icon-dialog") && !e.target.closest(".shortcut.has-variants")) {
        closeVariantDropdown();
      }
      if (!e.target.closest("#group-menu") && !e.target.closest(".group-more-btn") && !e.target.closest(".sb-group-more")
          && !e.target.closest("#tag-submenu") && !e.target.closest("#tag-create-popover")) {
        hideGroupMenu();
      }
      if (!e.target.closest("#rc-filter-btn") && !e.target.closest("#rc-filter-menu")) {
        closeRcFilterMenu();
      }
      if (!e.target.closest("#rc-domain-panel") && !e.target.closest(".rc-item[data-rc-domain]")) {
        closeDomainPanel();
      }
      if (!e.target.closest("#restore-dropdown") && !e.target.closest("#sb-restore")) {
        closeRestoreDropdown();
      }
      if (!e.target.closest("#restore-date-btn") && !e.target.closest("#restore-date-menu")) {
        closeRestoreDateMenu();
      }
      if (!e.target.closest("#settings-panel") && !e.target.closest("#sb-settings")) {
        closeSettingsPanel();
      }
      if (!e.target.closest("#pro-settings-panel") && !e.target.closest("#sb-pro-settings")) {
        closeProSettingsPanel();
      }
    });

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal(); hideMenu(); hideGroupMenu(); hideDeleteDialog();
        cancelBgPreview(); closeRcFilterMenu(); closeDomainPanel(); closeSettingsPanel();
        closeProSettingsPanel();
        closeHistoryOverlay(); closeRestoreDropdown();
        closeVariantDropdown(); closeVariantCtxMenu(); closeVariantIconDialog(); closeNestSubmenu();
        closeTagSubmenu(); closeTagCreatePopover();
        var sidebar = $("#sidebar");
        if (sidebar && sidebar.classList.contains("mobile-open")) toggleMobileSidebar();
      }
    });

    // Close menu on scroll
    window.addEventListener("scroll", function () {
      hideMenu();
      hideGroupMenu();
      var ctxMenu = document.getElementById("variant-ctx-menu");
      var iconDialog = document.getElementById("variant-icon-dialog");
      if ((ctxMenu && !ctxMenu.classList.contains("hidden")) || (iconDialog && !iconDialog.classList.contains("hidden"))) return;
      closeVariantDropdown();
    });
    var gridArea = $("#shortcut-grid-area");
    if (gridArea) gridArea.addEventListener("scroll", function () {
      var ctxMenu = document.getElementById("variant-ctx-menu");
      var iconDialog = document.getElementById("variant-icon-dialog");
      if ((ctxMenu && !ctxMenu.classList.contains("hidden")) || (iconDialog && !iconDialog.classList.contains("hidden"))) return;
      closeVariantDropdown();
    });

    // Click outside to close variant dropdown
    document.addEventListener("click", function (e) {
      if (variantDropdownState && !e.target.closest(".variant-dropdown") && !e.target.closest(".shortcut.has-variants") && !e.target.closest("#variant-ctx-menu") && !e.target.closest("#variant-icon-dialog")) {
        closeVariantDropdown();
      }
    });

    // Escape to close variant dropdown
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && variantDropdownState) {
        closeVariantDropdown();
      }
    });

  }

  // ===== Context Menu =====

  function showMenu(shortcutId, groupId, anchor) {
    var ws = Storage.getActiveWorkspace(data);
    if (ws && ws.isReadOnly) {
      // Read-only workspaces suppress the edit menu entirely.
      hideMenu();
      return;
    }
    hideMenu();
    activeMenu = { shortcutId: shortcutId, groupId: groupId };
    var menu = $("#shortcut-menu");
    var group = findGroup(groupId);
    var shortcut = group && group.shortcuts.find(function (s) { return s.id === shortcutId; });
    var hasVariants = shortcut && shortcut.variants && shortcut.variants.length > 0;

    // Toggle variant-specific menu items
    var openDefault = $("#menu-open-default");
    var manageVariants = $("#menu-manage-variants");
    var ungroupBtn = $("#menu-ungroup");
    var nestWith = $("#menu-nest-with");
    var removeBtn = $("#menu-remove");

    if (openDefault) openDefault.classList.toggle("hidden", !hasVariants);
    if (manageVariants) manageVariants.classList.toggle("hidden", !hasVariants);
    if (ungroupBtn) ungroupBtn.classList.toggle("hidden", !hasVariants);
    if (nestWith) nestWith.classList.toggle("hidden", hasVariants);
    if (removeBtn) {
      // Update the text after the SVG
      var textNodes = [];
      removeBtn.childNodes.forEach(function (n) {
        if (n.nodeType === 3 && n.textContent.trim()) textNodes.push(n);
      });
      if (textNodes.length) textNodes[0].textContent = hasVariants ? " Delete all" : " Remove";
    }

    var rect = anchor.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + "px";
    menu.style.left = rect.left + "px";
    menu.classList.remove("hidden");

    var menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - menuRect.width - 8) + "px";
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = (rect.top - menuRect.height - 4) + "px";
    }
  }

  function hideMenu() {
    // Note: do NOT call closeTagSubmenu() here. The document-level outside-click
    // handler calls hideMenu() any time a click lands outside #shortcut-menu —
    // including legitimate add-tag clicks in the SIDEBAR ctx menu, which open
    // the tag submenu just before the document handler fires. If hideMenu
    // closed the tag submenu, the submenu would be closed in the same tick it
    // was opened. Tag submenu close is owned by its own outside-click branch
    // and the Escape handler.
    $("#shortcut-menu").classList.add("hidden");
    closeNestSubmenu();
    activeMenu = null;
  }

  // ===== Modal =====

  function openModal(mode, groupId, shortcut) {
    modalState = { mode: mode, groupId: groupId, shortcut: shortcut || null, customFavicon: null };
    $("#modal-title").textContent = mode === "edit" ? "Edit shortcut" : "Add shortcut";
    $("#modal-name").value = shortcut ? (shortcut.title || "") : "";
    $("#modal-url").value = shortcut ? (shortcut.url || "") : "";
    $("#modal-name").dataset.edited = mode === "edit" ? "true" : "false";

    // Icon row — show in edit mode
    var iconRow = $("#modal-icon-row");
    var iconPreview = $("#modal-icon-preview");
    var resetBtn = $("#modal-icon-reset");
    if (iconRow) {
      if (mode === "edit" && shortcut) {
        iconRow.classList.remove("hidden");
        var currentFavicon = getFaviconUrl(shortcut);
        iconPreview.src = currentFavicon;
        resetBtn.classList.toggle("hidden", !(shortcut.favicon && shortcut.favicon.indexOf("data:") === 0));
      } else {
        iconRow.classList.add("hidden");
        iconPreview.src = "assets/placeholder.svg";
        resetBtn.classList.add("hidden");
      }
    }

    $("#modal-overlay").classList.remove("hidden");
    (mode === "edit" ? $("#modal-name") : $("#modal-url")).focus();
  }

  function closeModal() {
    $("#modal-overlay").classList.add("hidden");
    modalState = {};
    var fileInput = $("#modal-icon-file");
    if (fileInput) fileInput.value = "";
  }

  async function saveModal() {
    var name = $("#modal-name").value.trim();
    var url = normalizeUrl($("#modal-url").value.trim());
    if (!url || url === "https://") return;

    if (modalState.mode === "add") {
      // Check for domain match — offer to nest
      var existingMatch = findDomainMatchInGroup(modalState.groupId, url);
      if (existingMatch && confirm('A shortcut for "' + (getBaseDomain(url) || url) + '" already exists (' + (existingMatch.title || '') + '). Nest this as a variant?')) {
        if (!existingMatch.variants) existingMatch.variants = [];
        var variantTitle = name || generateVariantLabel(existingMatch.url, url, name, existingMatch.title);
        existingMatch.variants.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          url: url,
          title: variantTitle,
          favicon: modalState.customFavicon || getFaviconUrl(url),
          deletedAt: null
        });
        await Storage.saveAll(data);
      } else {
        var newShortcut = {
          url: url,
          title: name || getDomain(url).replace(/^www\./, ""),
          favicon: getFaviconUrl(url)
        };
        if (modalState.customFavicon) newShortcut.favicon = modalState.customFavicon;
        await Storage.addShortcut(modalState.groupId, newShortcut);
      }
    } else if (modalState.mode === "edit" && modalState.shortcut) {
      var group = findGroup(modalState.groupId);
      var sc = group && group.shortcuts.find(function (s) { return s.id === modalState.shortcut.id; });
      if (sc) {
        sc.url = url;
        sc.title = name || getDomain(url).replace(/^www\./, "");
        if (modalState.customFavicon) {
          sc.favicon = modalState.customFavicon;
        } else if (modalState.customFavicon === "") {
          sc.favicon = "";
        }
        await Storage.saveAll(data);
      }
    }

    closeModal();
    data = await Storage.getAll();
    render();
  }

  // ===== Group Operations =====

  async function addGroup() {
    var ws = Storage.getActiveWorkspace(data);
    if (ws && ws.isReadOnly) {
      showToast("This workspace is read-only.");
      return;
    }
    var name = prompt("Group name:");
    if (!name || !name.trim()) return;
    await Storage.addGroup(name.trim());
    data = await Storage.getAll();
    render();
  }

  function startRename(nameEl) {
    var groupId = nameEl.dataset.groupId;
    var current = nameEl.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "group-name-input";
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    var saved = false;
    var save = async function () {
      if (saved) return;
      saved = true;
      var newName = input.value.trim() || current;
      var group = findGroup(groupId);
      if (group && group.name !== newName) {
        group.name = newName;
        await Storage.saveAll(data);
        console.log("[LaunchPad] Group renamed:", groupId, "→", newName);
      }
      data = await Storage.getAll();
      render();
    };

    input.addEventListener("blur", save);
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { e.preventDefault(); input.value = current; input.blur(); }
    });
  }

  // ===== Group Context Menu =====

  var groupMenuFromSidebar = false;

  function showGroupMenu(groupId, anchor) {
    hideGroupMenu();
    activeGroupMenu = groupId;
    var menu = $("#group-menu");
    if (!menu) return;
    var rect = anchor.getBoundingClientRect();

    // Disable "Open All" if group has no shortcuts
    var group = findGroup(groupId);
    var openAllOpt = menu.querySelector('[data-action="openall"]');
    if (openAllOpt) {
      var empty = !group || !group.shortcuts.length;
      openAllOpt.classList.toggle("gm-disabled", empty);
      openAllOpt.disabled = empty;
    }

    // Lock sidebar open if menu was triggered from sidebar
    groupMenuFromSidebar = !!anchor.closest("#sidebar");
    if (groupMenuFromSidebar) {
      sidebarLocked = true;
      var sidebar = $("#sidebar");
      if (sidebar) {
        sidebar.classList.add("sidebar-locked");
        sidebar.classList.add("expanded");
      }
      showSidebarPanel();
    }

    menu.classList.remove("hidden");
    menu.style.top = (rect.bottom + 4) + "px";
    menu.style.left = rect.left + "px";

    // If overflowing right, align to right edge of button
    var menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth - 8) {
      menu.style.left = (rect.right - menuRect.width) + "px";
    }
    // If overflowing bottom, show above the button
    if (menuRect.bottom > window.innerHeight - 8) {
      menu.style.top = (rect.top - menuRect.height - 4) + "px";
    }
  }

  function hideGroupMenu() {
    var menu = $("#group-menu");
    if (!menu || menu.classList.contains("hidden")) {
      activeGroupMenu = null;
      return;
    }
    menu.classList.add("hidden");
    activeGroupMenu = null;

    // Unlock sidebar if the menu was opened from sidebar
    if (groupMenuFromSidebar) {
      groupMenuFromSidebar = false;
      sidebarLocked = false;
      var sidebar = $("#sidebar");
      if (sidebar) {
        sidebar.classList.remove("sidebar-locked");
        if (!sidebar.matches(":hover")) {
          sidebar.classList.remove("expanded");
          hideSidebarPanel();
        }
      }
    }
  }

  function handleGroupMenuAction(action) {
    var groupId = activeGroupMenu;

    // [1.0.9.2 round 3] Add-tag opens tag submenu as a sibling popover and
    // KEEPS the group menu visible (Finder-style). The previous
    // capture-then-close-then-reopen pattern was needed only because tag
    // submenu was managing the sidebar lock itself — that's now owned solely
    // by the parent menu, so we leave the parent open. groupMenuFromSidebar
    // continues to track the lock; it'll be released by hideGroupMenu when
    // the user dismisses the parent menu via outside-click or Escape.
    // Outside-click handlers exempt #tag-submenu and #tag-create-popover.
    if (action === "add-tag") {
      if (!groupId) { hideGroupMenu(); return; }
      var groupMenuEl = $("#group-menu");
      if (groupMenuEl) {
        openTagSubmenu(
          groupMenuEl,
          { type: "group", groupId: groupId, fromSidebar: groupMenuFromSidebar }
        );
      }
      return;
    }

    hideGroupMenu();
    if (!groupId) return;

    if (action === "openall") {
      openAllInGroup(groupId);
    } else if (action === "rename") {
      // Try sidebar name first, then main page name
      var nameEl = document.querySelector('.group[data-group-id="' + groupId + '"] .group-name');
      if (nameEl) {
        startRename(nameEl);
      } else {
        // Fallback: prompt rename
        var group = findGroup(groupId);
        if (!group) return;
        var newName = prompt("Rename group:", group.name);
        if (newName && newName.trim() && newName.trim() !== group.name) {
          group.name = newName.trim();
          Storage.saveAll(data).then(function () {
            data = null;
            Storage.getAll().then(function (d) { data = d; render(); });
          });
        }
      }
    } else if (action === "delete") {
      showDeleteDialog(groupId);
    }
  }

  function showDeleteDialog(groupId) {
    var group = findGroup(groupId);
    if (!group) return;
    var overlay = $("#group-delete-overlay");
    var titleEl = $("#gd-title");
    var msgEl = $("#gd-message");
    var moveSection = $("#gd-move-section");
    var moveCount = $("#gd-move-count");
    var moveTarget = $("#gd-move-target");
    var confirmBtn = $("#gd-confirm");

    titleEl.textContent = 'Delete group "' + group.name + '"?';

    var count = group.shortcuts.length;
    if (count > 0) {
      msgEl.textContent = "This group has " + count + " shortcut" + (count !== 1 ? "s" : "") + ". You can move them to another group or delete everything.";
      moveCount.textContent = count;
      // Build dropdown of other groups
      var moveWs = Storage.getActiveWorkspace(data);
      var moveGroups = (moveWs && moveWs.groups) || [];
      moveTarget.innerHTML = moveGroups
        .filter(function (g) { return g.id !== groupId; })
        .map(function (g) { return '<option value="' + g.id + '">' + esc(g.name) + '</option>'; })
        .join("");
      moveSection.classList.remove("hidden");
      confirmBtn.textContent = "Delete All";
    } else {
      msgEl.textContent = 'Delete empty group "' + group.name + '"?';
      moveSection.classList.add("hidden");
      confirmBtn.textContent = "Delete";
    }

    overlay.dataset.groupId = groupId;
    overlay.classList.remove("hidden");
  }

  function hideDeleteDialog() {
    var overlay = $("#group-delete-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
      delete overlay.dataset.groupId;
    }
  }

  async function confirmDeleteGroup() {
    var overlay = $("#group-delete-overlay");
    var groupId = overlay.dataset.groupId;
    if (!groupId) return;
    hideDeleteDialog();
    await Storage.removeGroup(groupId);
    data = await Storage.getAll();
    render();
  }

  async function moveAndDeleteGroup() {
    var overlay = $("#group-delete-overlay");
    var groupId = overlay.dataset.groupId;
    if (!groupId) return;
    var targetId = $("#gd-move-target").value;
    if (!targetId) return;

    var group = findGroup(groupId);
    var target = findGroup(targetId);
    if (!group || !target) return;

    // Move shortcuts to target group
    target.shortcuts = target.shortcuts.concat(group.shortcuts);
    group.shortcuts = [];
    await Storage.saveAll(data);

    hideDeleteDialog();
    await Storage.removeGroup(groupId);
    data = await Storage.getAll();
    render();
  }

  // ===== Sortable (Drag & Drop) =====

  function initSortables() {
    if (typeof Sortable === "undefined") {
      console.warn("[LaunchPad] SortableJS not loaded — drag-and-drop disabled");
      return;
    }
    var ws = Storage.getActiveWorkspace(data);
    var readOnly = !!(ws && ws.isReadOnly);

    $$(".shortcuts-grid").forEach(function (grid) {
      var s = new Sortable(grid, {
        group: "shortcuts",
        animation: 200,
        disabled: readOnly,
        draggable: ".shortcut",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        filter: ".shortcut-more, .add-tile, .grid-placeholder, .empty-group-hint",
        preventOnFilter: false,
        onStart: function (evt) {
          $$(".shortcuts-grid").forEach(function (g) {
            g.classList.add("is-dragging");
          });
          startDragNestTracking(evt);
        },
        onMove: function (evt) {
          return updateDragNestTracking(evt);
        },
        onEnd: async function (evt) {
          var nestResult = finishDragNestTracking(evt);
          $$(".shortcuts-grid").forEach(function (g) {
            g.classList.remove("is-dragging");
          });
          $$(".grid-placeholder").forEach(function (el) { el.remove(); });

          if (nestResult) {
            // Nesting handled — revert SortableJS move by re-rendering
            await nestResult;
          } else {
            // [1.0.11.7] Use the generalized sync so a drop into a sidebar
            // list (cross-class element) also updates that group's data.
            // syncShortcutsFromDOM (which only walks .shortcuts-grid) would
            // miss the sidebar destination.
            await syncAfterShortcutDrop(evt);
            // [1.0.11.8] Always render. The main grid's own DOM was already
            // mutated correctly by SortableJS for within-main-grid moves, but
            // the sidebar mirrors the same data and the [1.0.11.2] write-
            // provenance gate suppresses its onChanged-triggered refresh for
            // our own writes — without an explicit render the sidebar
            // continues to show the bookmark in its old group. Symmetric
            // with sidebar-source onEnd, which has rendered unconditionally
            // since [1.0.11.7].
            render();
          }
          ensureAllPlaceholders();
        }
      });
      sortables.push(s);
    });
  }

  // ===== Drag-to-Nest System =====

  function startDragNestTracking(evt) {
    var draggedEl = evt.item;
    var draggedId = draggedEl.dataset.id;
    var draggedShortcut = null;
    var draggedGroupId = null;

    // Find the dragged shortcut data
    var dragWs = Storage.getActiveWorkspace(data);
    var dragGroups = (dragWs && dragWs.groups) || [];
    dragGroups.forEach(function (g) {
      g.shortcuts.forEach(function (s) {
        if (s.id === draggedId) {
          draggedShortcut = s;
          draggedGroupId = g.id;
        }
      });
    });

    if (!draggedShortcut) return;

    var draggedMatchKey = getMatchKey(draggedShortcut.url);

    dragState = {
      draggedId: draggedId,
      draggedDomain: draggedMatchKey,
      draggedGroupId: draggedGroupId,
      hoveredTarget: null,
      shiftHeld: false,
      draggedTitle: draggedShortcut.title || ""
    };

    // Highlight matching domain shortcuts and freeze them
    highlightNestTargets(draggedId, draggedMatchKey, false);

    // Listen for shift key
    dragState._keyDown = function (e) {
      if (e.key === "Shift" && dragState && !dragState.shiftHeld) {
        dragState.shiftHeld = true;
        highlightNestTargets(dragState.draggedId, dragState.draggedDomain, true);
      }
    };
    dragState._keyUp = function (e) {
      if (e.key === "Shift" && dragState && dragState.shiftHeld) {
        dragState.shiftHeld = false;
        highlightNestTargets(dragState.draggedId, dragState.draggedDomain, false);
      }
    };
    document.addEventListener("keydown", dragState._keyDown);
    document.addEventListener("keyup", dragState._keyUp);

    // Track mouse position for drop detection
    dragState._mouseMove = function (e) {
      if (!dragState) return;
      // drag events sometimes fire with 0,0 coordinates — ignore those
      if (e.clientX === 0 && e.clientY === 0) return;
      dragState.lastX = e.clientX;
      dragState.lastY = e.clientY;
      checkNestHover(e.clientX, e.clientY);
    };
    document.addEventListener("drag", dragState._mouseMove);

    // Hide nesting tooltip during drag
    hideNestingTooltip();
  }

  function highlightNestTargets(draggedId, draggedMatchKey, shiftMode) {
    // Remove all existing highlights and freeze flags
    $$(".shortcut-nest-target, .shortcut-nest-target-all").forEach(function (el) {
      el.classList.remove("shortcut-nest-target", "shortcut-nest-target-all");
      delete el.dataset.nestTarget;
    });

    $$(".shortcut").forEach(function (el) {
      if (el.dataset.id === draggedId) return;
      if (shiftMode) {
        el.classList.add("shortcut-nest-target-all");
        el.dataset.nestTarget = "true";
      } else if (draggedMatchKey) {
        var shortcut = findShortcutById(el.dataset.id);
        if (shortcut) {
          var targetKey = getMatchKey(shortcut.url);
          if (targetKey && targetKey === draggedMatchKey) {
            el.classList.add("shortcut-nest-target");
            el.dataset.nestTarget = "true";
          }
        }
      }
    });
  }

  function checkNestHover(x, y) {
    if (!dragState) return;
    var dropLabel = $("#nest-drop-label");

    var hovered = null;
    $$(".shortcut").forEach(function (el) {
      if (el.dataset.id === dragState.draggedId) return;
      if (el.classList.contains("sortable-ghost")) return;
      if (el.dataset.nestTarget !== "true") return;
      var iconEl = el.querySelector(".shortcut-icon");
      if (!iconEl) return;
      var rect = iconEl.getBoundingClientRect();
      var pad = 18;
      if (x >= rect.left - pad && x <= rect.right + pad &&
          y >= rect.top - pad && y <= rect.bottom + pad) {
        hovered = el;
      }
    });

    if (hovered !== dragState.hoveredTarget) {
      // Remove previous highlight
      if (dragState.hoveredTarget) {
        dragState.hoveredTarget.classList.remove("shortcut-nest-hover");
      }
      dragState.hoveredTarget = hovered;
      if (hovered) {
        hovered.classList.add("shortcut-nest-hover");
        var shortcut = findShortcutById(hovered.dataset.id);
        if (shortcut && dropLabel) {
          var iconRect = hovered.querySelector(".shortcut-icon").getBoundingClientRect();
          dropLabel.textContent = "Drop to group";
          dropLabel.style.left = (iconRect.left + iconRect.width / 2) + "px";
          dropLabel.style.top = (iconRect.top - 24) + "px";
          dropLabel.classList.add("visible");
        }
      } else if (dropLabel) {
        dropLabel.classList.remove("visible");
      }
    }
  }

  function updateDragNestTracking(evt) {
    if (!dragState) return;
    // If dragging over a frozen nest target, prevent SortableJS from inserting there
    var related = evt.related;
    if (related && related.dataset && related.dataset.nestTarget === "true") {
      return false; // Prevent SortableJS from placing element near frozen target
    }
  }

  function finishDragNestTracking(evt) {
    if (!dragState) return null;

    var state = dragState;

    // Final hover check
    if (state.lastX !== undefined && state.lastY !== undefined) {
      checkNestHover(state.lastX, state.lastY);
    }

    var targetEl = state.hoveredTarget;

    // Robust fallback: if hover tracking lost the target (common due to SortableJS
    // moving DOM elements during animation), scan all shortcuts by coordinate proximity
    if (!targetEl && state.lastX && state.lastY) {
      var bestDist = Infinity;
      var dropX = state.lastX;
      var dropY = state.lastY;

      $$(".shortcut").forEach(function (el) {
        if (el.dataset.id === state.draggedId) return;
        if (el.classList.contains("sortable-ghost")) return;
        if (el.classList.contains("sortable-drag")) return;

        // Check domain match (or shift-mode was active)
        var shortcut = findShortcutById(el.dataset.id);
        if (!shortcut) return;
        var targetKey = getMatchKey(shortcut.url);
        if (!targetKey || (targetKey !== state.draggedDomain && !state.shiftHeld)) return;

        var iconEl = el.querySelector(".shortcut-icon");
        if (!iconEl) return;
        var rect = iconEl.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dist = Math.sqrt((dropX - cx) * (dropX - cx) + (dropY - cy) * (dropY - cy));

        // Must be within 60px of the icon center
        if (dist < 60 && dist < bestDist) {
          bestDist = dist;
          targetEl = el;
        }
      });
    }

    // Also check SortableJS siblings as last resort
    if (!targetEl && evt && evt.item) {
      [evt.item.previousElementSibling, evt.item.nextElementSibling].forEach(function (adj) {
        if (targetEl) return;
        if (!adj || !adj.dataset || !adj.dataset.id) return;
        if (adj.dataset.id === state.draggedId) return;
        if (adj.classList.contains("sortable-ghost")) return;
        var shortcut = findShortcutById(adj.dataset.id);
        if (!shortcut) return;
        var adjKey = getMatchKey(shortcut.url);
        if (adjKey && adjKey === state.draggedDomain) {
          var adjIcon = adj.querySelector(".shortcut-icon");
          if (adjIcon && state.lastX && state.lastY) {
            var adjRect = adjIcon.getBoundingClientRect();
            var adjPad = 40;
            if (state.lastX >= adjRect.left - adjPad && state.lastX <= adjRect.right + adjPad &&
                state.lastY >= adjRect.top - adjPad && state.lastY <= adjRect.bottom + adjPad) {
              targetEl = adj;
            }
          }
        }
      });
    }

    // Cleanup event listeners
    document.removeEventListener("keydown", state._keyDown);
    document.removeEventListener("keyup", state._keyUp);
    document.removeEventListener("drag", state._mouseMove);

    // Remove visual highlights
    $$(".shortcut-nest-target, .shortcut-nest-target-all").forEach(function (el) {
      el.classList.remove("shortcut-nest-target", "shortcut-nest-target-all");
      delete el.dataset.nestTarget;
    });
    $$(".shortcut-nest-hover").forEach(function (el) {
      el.classList.remove("shortcut-nest-hover");
    });

    var dropLabel = $("#nest-drop-label");
    if (dropLabel) dropLabel.classList.remove("visible");

    dragState = null;

    // If a valid nest target was found, perform nesting
    if (targetEl && targetEl.dataset.id !== state.draggedId) {
      var targetId = targetEl.dataset.id;
      var targetGroupId = null;
      var gridEl = targetEl.closest(".shortcuts-grid");
      if (gridEl) targetGroupId = gridEl.dataset.groupId;
      if (!targetGroupId) targetGroupId = state.draggedGroupId;

      var draggedTitle = state.draggedTitle;
      var targetShortcut = findShortcutById(targetId);
      var targetTitle = targetShortcut ? targetShortcut.title : "";

      console.log("[LaunchPad] Drag-to-nest:", state.draggedId, "→", targetId);

      return (async function () {
        await nestShortcutWith(state.draggedId, targetId, targetGroupId);

        var toast = $("#open-all-toast");
        if (toast) {
          toast.textContent = "Grouped \"" + draggedTitle + "\" under \"" + targetTitle + "\"";
          toast.classList.add("visible");
          clearTimeout(toast._timer);
          toast._timer = setTimeout(function () { toast.classList.remove("visible"); }, 3000);
        }

        if (data.settings && !data.settings.nestingTipDismissed) {
          data.settings.nestingTipDismissed = true;
          await Storage.saveAll(data);
        }
      })();
    }

    return null;
  }

  function findShortcutById(id) {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return null;
    var found = null;
    Storage.ensureGroupsArray(ws);
    ws.groups.forEach(function (g) {
      g.shortcuts.forEach(function (s) {
        if (s.id === id) found = s;
      });
    });
    return found;
  }

  // ===== Nesting Tooltip =====

  function checkNestingTooltip() {
    if (!data || !data.settings) return;
    if (data.settings.nestingTipDismissed) return;
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;

    // Look for shortcuts with matching domains across groups
    var match = null;
    Storage.ensureGroupsArray(ws);
    ws.groups.forEach(function (g) {
      if (match) return;
      var keyMap = {};
      g.shortcuts.forEach(function (s) {
        if (match) return;
        var key = getMatchKey(s.url);
        if (!key) return;
        // Skip shortcuts that already have variants
        if (s.variants && s.variants.length > 0) return;
        if (keyMap[key]) {
          match = { domain: key, first: keyMap[key], second: s.title };
        } else {
          keyMap[key] = s.title;
        }
      });
    });

    if (!match) return;

    // Show tooltip after delay
    if (nestingTipTimer) clearTimeout(nestingTipTimer);
    nestingTipTimer = setTimeout(function () {
      var tip = $("#nesting-tooltip");
      if (!tip) return;
      var text = tip.querySelector(".nest-tip-text");
      if (text) {
        text.textContent = "Drag \"" + match.second + "\" onto \"" + match.first + "\" to nest them — they share the same domain!";
      }
      tip.classList.add("visible");

      // Auto-dismiss after 8 seconds
      setTimeout(function () {
        hideNestingTooltip();
      }, 8000);
    }, 2000);
  }

  function hideNestingTooltip() {
    if (nestingTipTimer) { clearTimeout(nestingTipTimer); nestingTipTimer = null; }
    var tip = $("#nesting-tooltip");
    if (tip) tip.classList.remove("visible");
  }

  function destroySortables() {
    if (groupSortable) { groupSortable.destroy(); groupSortable = null; }
    if (sidebarSortable) { sidebarSortable.destroy(); sidebarSortable = null; }
    destroySidebarShortcutSortables();
    sortables.forEach(function (s) { s.destroy(); });
    sortables = [];
  }

  async function syncShortcutsFromDOM() {
    // Per [1.0.9.2] Q4: drag is reorganization, not tagging; tagIds preserved
    // unchanged. The map below holds the full shortcut object reference per
    // id, so when this function reassigns group.shortcuts based on DOM order
    // it preserves every field on each record (including tagIds). No tag
    // mutation happens here, by construction.
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;
    var allShortcuts = new Map();
    Storage.ensureGroupsArray(ws);
    ws.groups.forEach(function (g) {
      g.shortcuts.forEach(function (s) { allShortcuts.set(s.id, s); });
    });

    $$(".shortcuts-grid").forEach(function (gridEl) {
      var groupId = gridEl.dataset.groupId;
      var group = findGroup(groupId);
      if (!group) return;
      group.shortcuts = $$(".shortcut", gridEl)
        .map(function (el) { return allShortcuts.get(el.dataset.id); })
        .filter(Boolean);
    });

    await Storage.saveAll(data);
  }

  // [1.0.11.7] Direct-children walker that works on both .shortcuts-grid
  // (main grid) and .sidebar-shortcut-list (sidebar). Pulls shortcut IDs
  // from data-id (main-grid item) OR data-shortcut-id (sidebar item),
  // skipping everything else (.add-tile, .grid-placeholder, .empty-group-hint,
  // .sidebar-variant-list, .sidebar-shortcut-empty). Used by cross-list
  // drop sync so source and destination can be either container type.
  // Direct children only — variants nested under their parent's
  // .sidebar-variant-list intentionally do not contribute.
  function rebuildGroupFromListElement(listEl, allShortcuts) {
    if (!listEl) return;
    var groupId = listEl.dataset.groupId;
    if (!groupId) return;
    var group = findGroup(groupId);
    if (!group) return;
    var directChildren = Array.prototype.slice.call(listEl.children);
    group.shortcuts = directChildren
      .map(function (el) {
        var id = el.dataset.id || el.dataset.shortcutId;
        return id ? allShortcuts.get(id) : null;
      })
      .filter(Boolean);
  }

  // [1.0.11.7] Generalized post-drop sync for shortcut drags. Rebuilds the
  // destination group from evt.to and (for cross-list drops) also the
  // source group from evt.from, then saves. Works transparently across
  // sidebar↔sidebar, sidebar↔main-grid, and within-list reorders.
  async function syncAfterShortcutDrop(evt) {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;
    Storage.ensureGroupsArray(ws);
    var allShortcuts = new Map();
    ws.groups.forEach(function (g) {
      g.shortcuts.forEach(function (s) { allShortcuts.set(s.id, s); });
    });
    rebuildGroupFromListElement(evt.to, allShortcuts);
    if (evt.from !== evt.to) {
      rebuildGroupFromListElement(evt.from, allShortcuts);
    }
    await Storage.saveAll(data);
  }

  // ===== Open All in Group =====

  function openAllInGroup(groupId) {
    var group = findGroup(groupId);
    if (!group || !group.shortcuts.length) return;
    var urls = [];
    group.shortcuts.forEach(function (s) {
      urls.push(s.url);
      if (s.variants) {
        s.variants.forEach(function (v) { urls.push(v.url); });
      }
    });
    urls.forEach(function (url, i) {
      chrome.tabs.create({ url: url, active: i === 0 });
    });
    showOpenAllToast(urls.length, group.name);
  }

  function showOpenAllToast(count, groupName) {
    var toast = $("#open-all-toast");
    if (!toast) return;
    toast.textContent = "Opened " + count + " tab" + (count !== 1 ? "s" : "") + " from " + groupName;
    toast.classList.add("visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove("visible");
    }, 3000);
  }

  // ===== Utilities =====

  function findGroup(id) {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return undefined;
    return ws.groups.find(function (g) { return g.id === id; });
  }

  function esc(str) {
    var el = document.createElement("span");
    el.textContent = str || "";
    return el.innerHTML;
  }

  function getDomain(url) {
    try { return new URL(normalizeUrl(url)).hostname; }
    catch (e) { return url; }
  }

  function normalizeUrl(url) {
    url = (url || "").trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    return url;
  }
})();
