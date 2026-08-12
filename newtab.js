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

  // [1.0.12] Tasks tab filter/sort state. In-memory ONLY — deliberately NOT
  // persisted to chrome.storage.local or `data`. Resets to defaults on every
  // new-tab load (per-session, must not carry across new tabs). priorities and
  // tagIds are multi-select (OR within each); status drives section visibility;
  // sort reorders within each section. See applyTaskFilterSort / taskMatchesFilters.
  var taskFilterState = {
    priorities: [], // subset of 'urgent'|'high'|'medium'|'low'; [] = no priority filter
    tagIds: [],     // tag ids; [] = no tag filter
    status: "active", // 'active' | 'completed' | 'all'  (default mirrors the scaffold's first option)
    sort: "created"   // 'created' | 'due' | 'priority' | 'name'
  };
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
  // [2.0 ink] The due-date pill's icon. Deliberately NOT sized in px like its
  // neighbours above: it replaces a text glyph whose size came from the pill's
  // font-size, and this round may not change font sizes — so it takes 1em and
  // the existing .tt-due-icon rules keep owning the size. stroke="currentColor"
  // is the whole point: the emoji it replaces ignored `color` on every frame.
  var CALENDAR_SVG = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  var CHEVRON_DOWN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  var CHEVRONS_DOWN_SVG = '<svg class="sb-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>';
  var CHEVRONS_UP_SVG = '<svg class="sb-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>';
  var FOLDER_SVG = '<svg class="sb-group-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  var THREE_DOT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
  var THREE_DOT_SM_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
  var TRASH_SM_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

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

  // [1.0.19 D11] The first-paint default. Was "color:#f5f5f5" — an abrasive
  // white on a fresh install. Now the darkest NEUTRAL preset from
  // COLOR_PRESETS below: #2a2a2a, luminance 0.165, which resolves to
  // html.has-bg.bg-dark — i.e. NOT bg-light, so the primary dark styling path
  // (white ink, frosted surfaces) applies, which is what every surface in this
  // codebase is authored against by default.
  //
  // Chosen over the other three dark presets deliberately: #000000 is pure
  // black (excluded unless it were the only dark option), while #1e3a5f (navy)
  // and #3d2818 (brown) are TINTED and would fight the neutral frost, whose
  // own base is rgba(30,30,30,...) — #2a2a2a sits alongside that as one
  // continuous dark-glass system.
  //
  // Deliberately NOT a gallery image: all twelve GALLERY_IMAGES entries are
  // remote Unsplash URLs, so an image default would make first paint depend on
  // a third-party fetch, and the image path adds bg-image with NEITHER
  // luminance class — every html.bg-light override would silently stop
  // applying. See the [1.0.19] POLISH UNBLOCK.
  //
  // Scope: this value reaches users ONLY through loadBackground's self-heal
  // (record falsy or "__none__"). Nothing migrates persisted records, so every
  // existing user — including anyone who persisted the old #f5f5f5 — is
  // untouched.
  var DEFAULT_BG = "color:#2a2a2a";
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

  // ===== Dev-only Pro override =====

  // Console helper to flip the dev Pro override consumed by
  // ProAccess.getProAccessLevel. Gated on the same signal as pro-access.js
  // IS_UNPACKED — update_url is undefined for unpacked installs and populated
  // for store-packaged builds — so window.LP.devPro is NEVER defined in the
  // published Web Store build. Default OFF; flag lives at top-level
  // data.__devProOverride (not inside data.pro).
  if (!chrome.runtime.getManifest().update_url) {
    window.LP = window.LP || {};
    window.LP.devPro = async (on = true) => {
      data.__devProOverride = !!on;
      await Storage.saveAll(data);
      // applyAccessLevelUI re-derives the level and re-renders the tab bar
      // (incl. Pro tab panels via applyTabAccessLevel), sidebar Pro entry, CTA,
      // workspace switcher, and the Pro Settings panel — no reload needed.
      applyAccessLevelUI();
      console.log("[LaunchPad] devPro override:", !!on,
        "→ access level:", ProAccess.getProAccessLevel(data));
    };

    // [2.0] Preview the activation celebration. The trigger deliberately
    // EXCLUDES the devPro override (a dev toggle is not a purchase), which would
    // otherwise leave the moment unpreviewable without a real card charge — so
    // this clears the one-time flag and paints it directly.
    //
    // It shows the card unconditionally rather than re-running the trigger,
    // because the trigger would correctly refuse: a dev machine has no real
    // entitlement. That is the point of a preview hook, and it is IS_UNPACKED-
    // gated exactly like devPro, so it cannot exist in the store build.
    window.LP.replayProCelebration = async () => {
      // Tear down FIRST: endProTour sets the flag on exit, so clearing before it
      // would immediately re-set what we just cleared.
      endProTour();
      var existing = document.querySelector(".pro-celebrate");
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      if (Storage.clearProCelebrated(data)) await Storage.saveAll(data);
      proOnboardingBusy = false;
      showProCelebration();
      console.log("[LaunchPad] Pro celebration: replayed (flag cleared).",
        "Real trigger would fire:", ProAccess.isRealProEntitlement(data));
    };
  }

  // ===== Trial-CTA gate ([Pre-launch] 1216701870177421) =====
  //
  // FLIPPED TRUE AT v2.0.0 — the trial funnel is LIVE. It was gated off for the
  // v1.0.5 store build (DECISIONS.md 2026-07-19, option c1): billing was not yet
  // smoke-tested and the trial belonged to this launch, so a trial started then
  // would have burned a user's one 7-day window against a still-placeholder Pro.
  // Teaser mode kept the tab bar, locked Pro tabs and preview-mode clicks (the
  // [1.0.4] pattern) but rendered the CTA as an inert "Coming soon" chip.
  //
  // The flag and trialCtaLive() are KEPT rather than deleted along with the
  // teaser branches: this is the switch that turns the trial funnel off again if
  // billing ever needs to be pulled in a hurry, and one boolean is a far cheaper
  // lever than re-deriving which surfaces to gate. The teaser branches below are
  // its off-state, and they must keep working.
  var TRIAL_CTA_ENABLED = true;
  //
  // Dev builds ALWAYS keep the live trial CTA so the trial flow stays testable
  // (same IS_UNPACKED signal as the LP.devPro block above / pro-access.js:
  // update_url is undefined for unpacked installs, populated for store builds).
  // Rule: the trial CTA is live when TRIAL_CTA_ENABLED is true OR the build is
  // unpacked; only a PACKED build with the flag false is in teaser mode.
  function trialCtaLive() {
    return TRIAL_CTA_ENABLED || !chrome.runtime.getManifest().update_url;
  }

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
    // [Experience] Per-tab header layout (DECISIONS 2026-07-14, option B). Home
    // keeps the centered hero; the Pro tabs (incl. free-user preview) get the
    // compact top-aligned band. #content-header is a single persistent element
    // shared across tabs (never re-rendered on switch), so toggling one class on
    // it and letting CSS transition the size properties gives the smooth one-shot
    // Home<->Pro animation with no FLIP, no scroll listeners. The v3 flex chain
    // absorbs the reclaimed height into the content region automatically.
    var header = document.getElementById("content-header");
    if (header) header.classList.toggle("is-compact", PRO_TAB_IDS.indexOf(id) !== -1);
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
    // [1.0.20] D8 triggers 2 and 3. setActiveTab is the ONLY place that knows
    // the Dashboard just became visible — it does not re-render panel content
    // for anyone else, and the Dashboard is the one panel whose correctness is
    // a function of the wall clock and of work done on other tabs. Gated on Pro
    // access so a free user's preview is never overwritten (D10); the period
    // watch is torn down on the way out so it never runs against a hidden tab.
    if (id === "dashboard" && isProAccessibleLevel(currentAccessLevel())) {
      var dashPanel = document.getElementById("tab-dashboard");
      if (dashPanel) renderDashboardTab(dashPanel, data);
      dashStartPeriodWatch();
    } else {
      dashStopPeriodWatch();
    }

    // [1.0.22 D10] Insights activation re-render — the badge grid reflects state
    // changed on other tabs (a goal completed on Tasks, a retro unlock). Same
    // Pro-gated pattern as the Dashboard hook above; no watcher to tear down.
    if (id === "insights" && isProAccessibleLevel(currentAccessLevel())) {
      var insPanel = document.getElementById("tab-insights");
      if (insPanel) renderInsightsTab(insPanel, data);
    }

    // [1.2.1 fix] Hand keyboard scrolling to the panel that just became visible.
    // The panel is the tab's scroll container (see .tab-panel in newtab.css), but a
    // div is not a keyboard scroll target unless it holds focus — and after a tab
    // switch focus is on the .tab BUTTON, which lives in #content-header, OUTSIDE
    // the panel. Measured before this line existed: PageDown after switching moved
    // nothing on any of the four tabs, including the two that already had inner
    // scrollers, so this is an app-wide gap the Insights board merely exposed.
    // tabindex=-1 (set in the markup) makes the panel focusable without adding a
    // Tab stop; preventScroll keeps the focus call itself from jumping the board.
    // HOME IS DELIBERATELY EXCLUDED: #search-input owns focus there by autofocus,
    // and Home is a type-to-search surface first — stealing focus to enable
    // PageDown would break the affordance the whole tab exists for.
    if (PRO_TAB_IDS.indexOf(id) !== -1) {
      var activePanel = document.getElementById("tab-" + id);
      if (activePanel) {
        try { activePanel.focus({ preventScroll: true }); } catch (e) { activePanel.focus(); }
      }
    }

    // Tab switch is treated as a navigation change — close any open popover and
    // re-derive the CTA state (pulse depends on whether we're on a Pro tab).
    closeUpgradePopover();
    applyCtaState(data);
  }

  // The access level is derived, never cached (applyAccessLevelUI re-reads it
  // on every pass so a lapsing trial takes effect without a reload). This is
  // the same derivation, factored out for the callers that need it on its own.
  function currentAccessLevel() {
    return (typeof ProAccess !== "undefined" && data)
      ? ProAccess.getProAccessLevel(data)
      : "free";
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
    // [1.0.16] D9 — the widget is Pro-gated on the same signal as every other
    // Pro entry point, so a trial lapsing mid-session hides it without reload.
    renderActiveTaskWidget();
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
      // [1.0.20] Dashboard shell — a third branch mirroring Tasks (D8 trigger 1).
      if (id === "dashboard") {
        renderDashboardTab(panel, data);
        return;
      }
      // [1.0.22] Insights shell — the live Achievements section (D9).
      if (id === "insights") {
        renderInsightsTab(panel, data);
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

  // ===== [1.0.20] Dashboard shell + [1.0.21] Start of Day card =====
  //
  // Arc B. The Dashboard is the "today" surface. Two states, no card registry:
  // a Start-of-Day card during the day and a calm close-out card in the evening.
  // A registry was the original April plan and was dropped deliberately (D2) —
  // there is exactly one card per state, and a switcher with one entry per slot
  // is machinery pretending to be architecture. Day Recap (v2.1) builds whatever
  // selector it actually needs when a second card exists to select between.

  // 04:00 local. The night-owl floor: before it, the user is still finishing
  // YESTERDAY, so they get the evening card rather than a "good morning" at
  // 01:30 (D4). Named because it is a product boundary, not an arithmetic
  // constant — and because the codebase already has a near-miss neighbour in
  // background.js's local-03:00 recurring-sweep anchor that it must not be
  // confused with.
  var DASHBOARD_DAY_FLOOR_MINUTES = 4 * 60;

  // PURE. Takes the instant and the boundary; touches no clock and no storage,
  // so the boundary matrix is testable without mocking Date. `now` is epoch ms
  // (or a Date); endOfDayMinutes is minutes since LOCAL midnight.
  //
  // These boundaries govern WHICH CARD SHOWS and nothing else (D4). Every
  // FIGURE the Dashboard reports stays local-midnight-based, because the
  // tracking engine's day aggregates are pre-split at local midnight
  // (splitAcrossLocalDays) and no read-time adjustment can un-split them.
  // Between 00:00 and 04:00 the evening card therefore reports the NEW day's
  // near-zero total, which is honest: it says "today", and the engine's today
  // did in fact just roll over.
  function dashboardPeriod(now, endOfDayMinutes) {
    var d = (now instanceof Date) ? now : new Date(now);
    var minutes = d.getHours() * 60 + d.getMinutes();
    if (minutes < DASHBOARD_DAY_FLOOR_MINUTES) return "evening";
    return (minutes < endOfDayMinutes) ? "day" : "evening";
  }

  // ----- Suggestion cascade (D6) -----
  //
  // Tier 1: has a due date        — earliest dueAt, then priority desc, then oldest
  // Tier 2: no due date, priority — priority desc, then oldest
  // Tier 3: neither               — oldest ("longest pending")
  //
  // One comparator over the locked tier order rather than three sorted passes
  // concatenated: a single total order is what a sort actually needs, and the
  // tie-breaks are then provably exhaustive by reading down one function.
  function dashboardSuggestionTier(t) {
    if (typeof t.dueAt === "number") return 1;
    if (t.priority) return 2;
    return 3;
  }

  function dashboardCompareSuggestions(a, b) {
    var ta = dashboardSuggestionTier(a);
    var tb = dashboardSuggestionTier(b);
    if (ta !== tb) return ta - tb;

    var pa = PRIORITY_RANK[a.priority] || 0;
    var pb = PRIORITY_RANK[b.priority] || 0;

    if (ta === 1) {
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      if (pa !== pb) return pb - pa;
    } else if (ta === 2) {
      if (pa !== pb) return pb - pa;
    }
    // Tier 3, and the final tie-break for every tier: oldest first.
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  // Scope: active workspace, incomplete, non-trashed. getActiveTasks is the
  // right reader and getAllTasks is NOT — getAllTasks excludes trashed but
  // KEEPS completed (BUGS.md J5: "check, don't assume"), which would let a
  // finished task be suggested. Recurring instances are ordinary task records
  // by the time they land here (they come off the shared newTaskObject builder
  // with a real createdAt and their own instance dueAt), so they participate
  // through tier 1 with no special case.
  function dashboardPickSuggestion(ws) {
    if (!ws) return null;
    var candidates = Storage.getActiveTasks(ws);
    if (!candidates.length) return null;
    return candidates.slice().sort(dashboardCompareSuggestions)[0];
  }

  // "Today", encoded the way dueAt is encoded: the UTC-midnight stamp of the
  // user's LOCAL calendar date.
  //
  // Both halves of that sentence are load-bearing, and getting either wrong is
  // an off-by-one day.
  //   - Comparing dueAt against a LOCAL-midnight timestamp is wrong: dueAt is
  //     UTC-midnight, and the two encodings disagree for users away from UTC
  //     (storage.js:2371 — it shifts the day for users behind UTC).
  //   - But Storage.utcDay(Date.now()) is ALSO wrong, and this one bites in
  //     Bali specifically. utcDay() is built to compare two STORED values,
  //     both already UTC-midnight; feeding it a wall-clock instant asks a
  //     different question — "which UTC day is it right now" — and in UTC+8
  //     between 00:00 and 08:00 local the answer is YESTERDAY. A task due today
  //     would read as due tomorrow every morning before 8am.
  // So: take the local calendar date, then re-encode it as UTC-midnight, which
  // is exactly the space dueAt lives in.
  function dashboardTodayAsUtcDay(now) {
    var d = (now == null) ? new Date() : new Date(now);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dashboardDueLabel(dueAt) {
    if (typeof dueAt !== "number") return "";
    var today = dashboardTodayAsUtcDay();
    var due = Storage.utcDay(dueAt);
    if (due < today) return "Overdue";
    if (due === today) return "Due today";
    return "Due " + fmtShortDate(dueAt);
  }

  // ----- Focused Today line (D5) -----
  //
  // Two-phase, exactly like the active-task card's readout: the panel paints
  // synchronously with a placeholder and the engine's number lands a tick
  // later. renderTabPlaceholder and its callers are synchronous innerHTML
  // builders — making the Dashboard render async would push that up the whole
  // call chain for one line of text.
  //
  // No live ticker in v1 (D5). The line is refreshed by the D8 triggers.
  var dashReadoutToken = 0;
  // [2.0] Separate staleness token for the recap read — it must NOT share
  // dashReadoutToken with dashRefreshFocused (both fire from one render; a shared
  // counter would make each invalidate the other's guard mid-paint).
  var dashRecapToken = 0;

  // [2.0] THE shared duration formatter — Samson's locked rule (task
  // 1216757107669726). ms -> ">=1h: XhYm" (1h23m), "whole hours: Xh" (12h,
  // never 12h0m), "<1h: Xm" (23m, never 0h23m). Every user-facing duration
  // LABEL on the Insights board (donut center, legend, Top Tasks) and the
  // Dashboard (focused line, recap lines, summary strip) speaks through this one
  // function, so they all read identically. Out of scope: the pill/card H:MM:SS
  // live ticker (satFmtLong) — that is a second-resolution CLOCK, not a duration
  // label, and stays H:MM:SS.
  function fmtDurationHM(ms) {
    var totalMin = Math.floor(Math.max(0, ms) / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h > 0) return m > 0 ? (h + "h" + m + "m") : (h + "h");
    return m + "m";
  }

  // Whether the line renders at all, and in which scope. Suppression is a
  // RENDER-LEVEL gate, not a reader concern: with tracking disabled the reader
  // legitimately returns 0, and painting a bare "0h 0m" would tell the user
  // they did nothing today when the truth is that nothing was measured (D5).
  // Global trackingPaused does NOT suppress — settled time is still real.
  function dashFocusedScope(d) {
    var ws = Storage.getActiveWorkspace(d);
    var combined = !!(d && d.settings && d.settings.combinedAnalyticsEnabled);
    if (combined) return { mode: "combined", workspaceId: null };
    if (!Storage.isTrackingEnabled(ws)) return null;
    return { mode: "workspace", workspaceId: ws ? ws.id : null };
  }

  // [2.0 cockpit] The focused figure is now the strip's FIRST TILE rather than a
  // standalone bar — same reader, same two-phase fill, same staleness token; only
  // the element it lands in moved. The em-dash placeholder is unchanged: it is the
  // "not read yet" state, distinct from a measured 0m.
  async function dashRefreshFocused(panel, scope) {
    if (!panel || !scope) return;
    if (typeof Tracking === "undefined" || !Tracking.focusedTodayForWorkspace) return;
    var token = ++dashReadoutToken;
    var r;
    try {
      r = (scope.mode === "combined")
        ? await Tracking.focusedTodayCombined()
        : await Tracking.focusedTodayForWorkspace(scope.workspaceId);
    } catch (err) {
      console.error("[LaunchPad] Dashboard: focused-time read failed", err);
      return;
    }
    // A late resolution must not paint over a newer render (workspace switch,
    // period flip). Same staleness guard as satRefreshReadout, token-based
    // because the scope alone does not distinguish two renders of one scope.
    if (token !== dashReadoutToken) return;
    var el = panel.querySelector('[data-dash-focused]');
    if (!el) return;
    var open = r.openSince ? Math.max(0, Date.now() - r.openSince) : 0;
    el.textContent = fmtDurationHM(r.baseMs + open);
  }

  // ===== [2.0] Day Recap — evening recap lines (PLAN D1) =====
  //
  // Up to three TODAY-scoped lines beneath the focused line: Most focused (top
  // task), Longest session, Top tag. Each is SUPPRESSED independently — a line is
  // simply absent when its figure is empty (measured-nothing, not a "0" that
  // reads as did-nothing). All settled-only, so they agree exactly with the
  // Insights board's today figures (byTag/byTask/longestSession are all
  // settled-only there too). The scope is the Dashboard's own convention, already
  // computed by dashFocusedScope; a null scope suppressed the shell upstream, so
  // this only runs for a live scope.
  //
  // Reads a [todayKey] window through the board's windowed readers — a today
  // rollup with zero new spine (the readers filter by exact key membership). The
  // one-key window is built on lastNLocalDayKeys, the mandated day-key helper.

  // Top real task for the scope today, orphans DROPPED (an unnameable purged/
  // trashed id never wins the line — its minutes still count in the focused
  // total). Returns { name, ms } or null. Combined mode carries a workspace
  // suffix, mirroring the board's Top Tasks.
  function dashRecapTopTask(byTask, d, combined) {
    var best = null;
    byTask.forEach(function (b) {
      var ws = Storage.resolveWorkspaceFromData(d, b.workspaceId);
      var task = ws ? Storage.getTaskById(ws, b.taskId) : null;
      if (!task) return;
      if (!best || b.ms > best.ms) {
        best = { name: combined ? (task.name + " — " + ws.name) : task.name, ms: b.ms };
      }
    });
    return best;
  }

  // Top real tag for the scope today. byTag holds only real tag ids, so the
  // Untagged remainder (a board-computed balance, never a byTag entry) inherently
  // cannot compete for this line. Orphaned buckets (the board's Deleted-tags) do
  // not resolve via getTagById and are dropped, so a Deleted-tags bucket never
  // wins either — the line shows the top REAL tag or the caller suppresses it.
  function dashRecapTopTag(byTag, d, combined) {
    var best = null;
    byTag.forEach(function (b) {
      var ws = Storage.resolveWorkspaceFromData(d, b.workspaceId);
      var tag = ws ? Storage.getTagById(ws, b.tagId) : null;
      if (!tag) return;
      if (!best || b.ms > best.ms) {
        best = { name: combined ? (tag.name + " — " + ws.name) : tag.name, ms: b.ms };
      }
    });
    return best;
  }

  function dashRecapLineHtml(label, name, ms) {
    var value = name
      ? escapeHtml(name) + " · " + fmtDurationHM(ms)
      : fmtDurationHM(ms);
    return '<div class="dash-recap-line">' +
        '<span class="dash-recap-label">' + label + '</span>' +
        '<span class="dash-recap-value">' + value + '</span>' +
      '</div>';
  }

  async function dashRefreshRecap(panel, scope, d) {
    if (!panel || !scope) return;
    if (typeof Tracking === "undefined" || !Tracking.byTaskForScope) return;
    var token = ++dashRecapToken;
    var keys = Tracking.lastNLocalDayKeys(1); // [todayKey]
    var byTask, byTag, longestMs;
    try {
      var res = await Promise.all([
        Tracking.byTaskForScope(scope.workspaceId, keys),
        Tracking.byTagForScope(scope.workspaceId, keys),
        Tracking.longestSessionForScope(scope.workspaceId, keys)
      ]);
      byTask = res[0]; byTag = res[1]; longestMs = res[2];
    } catch (err) {
      console.error("[LaunchPad] Dashboard: recap read failed", err);
      return;
    }
    // A late resolution must not paint over a newer render (period flip, workspace
    // switch). Same guard as dashRefreshFocused, own token.
    if (token !== dashRecapToken) return;
    var el = panel.querySelector('[data-dash-recap]');
    if (!el) return;

    var combined = (scope.mode === "combined");
    var lines = [];
    var topTask = dashRecapTopTask(byTask, d, combined);
    if (topTask) lines.push(dashRecapLineHtml("Most focused", topTask.name, topTask.ms));
    if (longestMs > 0) lines.push(dashRecapLineHtml("Longest session", null, longestMs));
    var topTag = dashRecapTopTag(byTag, d, combined);
    if (topTag) lines.push(dashRecapLineHtml("Top tag", topTag.name, topTag.ms));
    // Empty when every line suppressed — the .dash-recap:empty rule collapses the
    // tile, so the card keeps only its calm header + the focused line.
    el.innerHTML = lines.join("");
  }

  // ===== [2.0] The Today cockpit =====
  //
  // The tense split, made structural. The Dashboard owns TODAY — glance between
  // sessions, then DO something; Insights owns the last thirty days. Before this
  // round the tab was a single card (greeting + one suggestion + one number),
  // which competed with Insights for the same job and gave the user nothing to
  // act on. Five modules replace it: a stat strip, goals progress, a focus
  // streak, the due-today list, and quick-add.
  //
  // ZERO NEW CAPTURE, and zero delta to tracking.js. Every figure composes a
  // reader that already existed: the engine's focused-today and windowed-range
  // reads, and the pure cockpit readers added to storage.js this round over
  // fields existing writers already maintain (focusStats.byDay, task.completedAt,
  // the goalId back-reference, task.dueAt).
  //
  // THE CARD IDIOM IS THE INSIGHTS BOARD'S, reused rather than reinvented — the
  // [1.2.1] zero-new-CSS precedent. .insights-strip for the strip, .pp-insights-
  // card + .pp-dash-card-title for the modules, .insights-task-row for the goal
  // gauges, .insights-empty for empty states. They are the same kind of object on
  // the same kind of surface, and they already carry their light-wallpaper ink
  // overrides, which is the half of the reuse that actually protects anything.

  // How many goals the progress module shows. A cockpit is a glance surface: past
  // five bars it stops being one. The list is recency-ordered, so the cap drops
  // the goals the user has not touched in longest.
  var DASH_GOALS_MAX = 5;
  // How many due/overdue rows before the list defers to the Tasks tab. A long
  // overdue backlog is real and must not be silently truncated, so the overflow
  // is COUNTED OUT LOUD rather than just cut.
  var DASH_DUE_MAX = 10;

  // ----- Module 1: the today stat strip -----
  //
  // Tile 1 is two-phase (the engine read lands a tick later); tiles 2-4 are
  // synchronous reads off `data`, so they are correct in the first paint and tick
  // immediately on a local mutation with no reload.
  function dashStripHtml(d, ws, scope) {
    var tiles = [];

    // Suppressed exactly as the old focused line was (D5): with per-workspace
    // tracking off the reader honestly returns 0, and "0m focused today" would
    // tell the user they did nothing when the truth is nothing was measured. The
    // tile is absent rather than zeroed.
    if (scope) {
      tiles.push({
        num: '<span data-dash-focused>—</span>',
        label: (scope.mode === "combined") ? "focused today · all workspaces" : "focused today"
      });
    }

    var todayKey = Storage.localDayKey();

    tiles.push({
      num: escapeHtml(String(Storage.tasksCompletedOnDay(ws, todayKey))),
      label: "tasks completed"
    });

    // A ZERO IS A REAL ANSWER HERE, and this is the one tile where that has to be
    // said out loud. "0 distractions blocked" means the counter was running and
    // nothing tried to get through — it is not the focused tile's measured-nothing
    // case, because focusStats counts whether or not blocking is currently armed.
    // The figure is global rather than scoped: focusStats is a single all-
    // workspaces record by design (storage.js C8), so the label claims no scope it
    // does not have.
    tiles.push({
      num: escapeHtml(String(Storage.focusBlockedOnDay(d, todayKey))),
      label: "distractions blocked"
    });

    // The pill's tri-state, READ rather than reimplemented. Storage.focusArmState
    // is the same derivation satFocusRowHtml renders — including its honest
    // reading that a PAUSED work phase is "off" — so the strip can never disagree
    // with the pill about whether blocking is on. The wording is the pill's too.
    var armState = Storage.focusArmState(d);
    tiles.push({
      num: armState === "off" ? "Off" : (armState === "auto" ? "On (auto)" : "On"),
      label: "focus blocking"
    });

    return tiles.map(function (t) {
      return '<div class="insights-strip-item">' +
          '<span class="insights-strip-num">' + t.num + '</span>' +
          '<span class="insights-strip-label">' + t.label + '</span>' +
        '</div>';
    }).join("");
  }

  // ----- Module 2: goals progress -----
  //
  // Recency-ordered done-ratios off Storage.goalProgressList, rendered in the
  // board's own gauge row: name | bar | ratio, which is exactly .insights-task-
  // row's three-column grid. Unlike the retired dashboardTopGoals this does NOT
  // hide a goal whose tasks are all done — a goal sitting at 5 of 5 waiting to be
  // closed is precisely what a progress module should be showing.
  function dashGoalsHtml(ws) {
    var entries = Storage.goalProgressList(ws);
    if (!entries.length) {
      return '<div class="dash-note">No active goals — ' +
          '<button type="button" class="dash-inline-link" data-dash-action="goto-tasks">create one in Tasks</button>.' +
        '</div>';
    }
    var shown = entries.slice(0, DASH_GOALS_MAX);
    var overflow = entries.length - shown.length;
    return shown.map(function (e) {
      return '<div class="insights-task-row">' +
          '<span class="insights-task-name">' + escapeHtml(e.goal.name) + '</span>' +
          '<span class="insights-task-bar"><span class="insights-task-bar-fill" style="width:' + e.pct + '%"></span></span>' +
          '<span class="insights-task-dur">' + e.done + ' of ' + e.total + '</span>' +
        '</div>';
    }).join("") + (overflow > 0
      ? '<div class="dash-note">' + overflow + ' more in ' +
          '<button type="button" class="dash-inline-link" data-dash-action="goto-tasks">Tasks</button>.' +
        '</div>'
      : "");
  }

  // ----- Module 3: the focus streak -----
  //
  // Composed PAGE-SIDE from focusedRangeForScope over the engine's own retention
  // window, folded by the pure Storage.focusStreakFromRange. A new tracking.js
  // reader was considered and rejected: the composition is two lines and one
  // await against a reader that already returns exactly the { dayKey: ms } map a
  // streak needs, so an engine-side reader would be a second way to say the same
  // thing — and tracking.js carries the M1 ripgrep-invisibility cost for anything
  // added to it. tracking.js is untouched by this round.
  var dashStreakToken = 0;

  // `null` is the pre-read placeholder, the same "not read yet" state the focused
  // tile's em-dash means, and deliberately distinct from a measured streak of 0.
  function dashStreakBodyHtml(streak) {
    var num = "—";
    var note = "";
    if (streak) {
      // capped = the walk ran off the start of the retention window, so the count
      // is a floor and not a total. "30+" rather than an exact 30 we cannot see.
      num = streak.capped ? (streak.days + "+") : String(streak.days);
      if (streak.days === 0) {
        note = '<div class="dash-note">Focus on something today to start one.</div>';
      } else if (!streak.todayCounted) {
        // Today-zero grace: the streak stands, it just has not been extended yet.
        // Saying so is what stops the number reading as a loss at 09:00.
        note = '<div class="dash-note">Through yesterday — today is still open.</div>';
      }
    }
    return '<div class="dash-streak">' +
        '<span class="insights-strip-num">' + escapeHtml(num) + '</span>' +
        '<span class="insights-strip-label">day streak</span>' +
      '</div>' + note;
  }

  async function dashRefreshStreak(panel, scope) {
    if (!panel || !scope) return;
    if (typeof Tracking === "undefined" || !Tracking.focusedRangeForScope) return;
    var token = ++dashStreakToken;
    // The engine's OWN retention constant, not a restated 30 — a retention change
    // must not leave the streak silently reading a window that no longer exists.
    var keys = Tracking.lastNLocalDayKeys(Tracking.RETENTION_DAYS || 30);
    var range;
    try {
      range = await Tracking.focusedRangeForScope(scope.workspaceId, keys);
    } catch (err) {
      console.error("[LaunchPad] Dashboard: streak read failed", err);
      return;
    }
    // Own token, for the same reason dashRecapToken is not dashReadoutToken: all
    // three reads fire from one render, and a shared counter would make each
    // invalidate the others' guard mid-paint.
    if (token !== dashStreakToken) return;
    var el = panel.querySelector("[data-dash-streak]");
    if (!el) return;
    el.innerHTML = dashStreakBodyHtml(Storage.focusStreakFromRange(range, keys));
  }

  // ----- Module 4: due today (+ its header block) -----
  //
  // The suggested-next card is no longer a card floating on its own — it is the
  // HEAD of this module, which is the only thing it was ever pointing at. The day
  // variants and their arbitration are UNCHANGED (D6): an active task already
  // answers "what now" and is never argued with; otherwise one suggestion off the
  // locked tier cascade; otherwise the calm empty line.
  //
  // `dueOpen` is the due-today module's OWN open set, read once by the render and
  // handed to both this head and the list below it — see the evening branch.
  function dashHeadHtml(d, ws, period, dueOpen) {
    if (period === "evening") {
      // "Work’s done." is a claim about the BOARD, not about the clock, and the
      // clock was the only thing it used to check. Live finding 2026-08-11: the
      // line rendered directly above five Overdue rows in the very list this head
      // belongs to. So the close-out is gated on the same open set that list
      // renders — zero open items and it stands; anything still open and the
      // header says so. The day is still over either way; that is why the title
      // does not move and the line is a statement rather than a nudge.
      var open = (dueOpen || []).length;
      if (open > 0) {
        return '<div class="dash-head" data-dash-variant="evening-open">' +
            '<div class="pp-dash-card-title">That’s the day</div>' +
            '<div class="dash-headline">' +
              (open === 1 ? 'One still on the board.' : 'Still a few on the board.') +
            '</div>' +
          '</div>';
      }
      return '<div class="dash-head" data-dash-variant="evening">' +
          '<div class="pp-dash-card-title">That’s the day</div>' +
          '<div class="dash-headline">Work’s done.</div>' +
        '</div>';
    }

    var res = Storage.resolveActiveTask(d);
    var activeTask = (res && !res.stale) ? res.task : null;

    // VARIANT A — pick up where you left off.
    if (activeTask) {
      var goal = activeTask.goalId ? Storage.getGoalById(ws, activeTask.goalId) : null;
      var paused = Storage.isTrackingPaused(d);
      return '<div class="dash-head" data-dash-variant="pickup">' +
          '<div class="pp-dash-card-title">Pick up where you left off</div>' +
          '<div class="dash-headline">' + escapeHtml(activeTask.name) + '</div>' +
          (goal ? '<div class="dash-sub">in ' + escapeHtml(goal.name) + '</div>' : '') +
          '<button type="button" class="dash-cta" data-dash-action="continue">' +
            (paused ? "Resume" : "Continue") +
          '</button>' +
        '</div>';
    }

    var suggestion = dashboardPickSuggestion(ws);

    // VARIANT C — nothing to do at all. The copy changed with the module: there
    // is now an input directly below, so sending the user to another tab to add
    // their first task would be pointing past the thing in front of them.
    if (!suggestion) {
      return '<div class="dash-head" data-dash-variant="empty">' +
          '<div class="dash-headline">Nothing on the list.</div>' +
          '<div class="dash-sub">Add something below when you are ready.</div>' +
        '</div>';
    }

    // VARIANT B — one suggestion. The goals gauges that used to sit inside this
    // card are now their own module, so the card is the suggestion and nothing
    // else.
    var dueLabel = dashboardDueLabel(suggestion.dueAt);
    var prioLabel = suggestion.priority ? PRIORITY_LABELS[suggestion.priority] : "";
    var metaBits = [];
    if (dueLabel) metaBits.push('<span class="dash-meta-due' + (dueLabel === "Overdue" ? " is-overdue" : "") + '">' + escapeHtml(dueLabel) + '</span>');
    if (prioLabel) metaBits.push('<span class="dash-meta-prio">' + escapeHtml(prioLabel) + '</span>');

    return '<div class="dash-head" data-dash-variant="suggestion">' +
        '<div class="pp-dash-card-title">Suggested next</div>' +
        '<div class="dash-headline">' + escapeHtml(suggestion.name) + '</div>' +
        (metaBits.length ? '<div class="dash-meta">' + metaBits.join("") + '</div>' : '') +
        '<button type="button" class="dash-cta" data-dash-action="lets-go" data-task-id="' + escapeHtml(suggestion.id) + '">' +
          'Let’s go' +
        '</button>' +
      '</div>';
  }

  // Due-today + overdue, earliest first so overdue leads naturally. Overdue is
  // visually distinct but CALM — the existing .dash-meta-due.is-overdue chip,
  // reused, rather than a red row: a backlog the user already knows about does not
  // need to be shouted at every time they open a tab.
  //
  // `dueOpen` comes from the render's single read so this list and the header
  // above it are literally the same array. The fallback keeps the builder
  // callable on its own — it is the identical pure read, one tick later.
  function dashDueListHtml(ws, dueOpen) {
    var todayUtc = dashboardTodayAsUtcDay();
    var due = dueOpen || Storage.tasksDueByDay(ws, todayUtc);
    if (!due.length) return '<div class="dash-note">Nothing due today.</div>';

    var shown = due.slice(0, DASH_DUE_MAX);
    var overflow = due.length - shown.length;
    return shown.map(function (t) {
      var overdue = Storage.utcDay(t.dueAt) < todayUtc;
      return '<div class="dash-due-row">' +
          '<input type="checkbox" class="tt-task-check dash-due-check" data-task-id="' + escapeHtml(t.id) + '" ' +
            'aria-label="Complete ' + escapeHtml(t.name) + '">' +
          '<span class="dash-due-name">' + escapeHtml(t.name) + '</span>' +
          (overdue ? '<span class="dash-meta-due is-overdue">Overdue</span>' : '') +
        '</div>';
    }).join("") + (overflow > 0
      // Counted out loud, never silently cut — a list that stops at ten and says
      // nothing reads as "that is all of them".
      ? '<div class="dash-note">' + overflow + ' more due or overdue in ' +
          '<button type="button" class="dash-inline-link" data-dash-action="goto-tasks">Tasks</button>.' +
        '</div>'
      : "");
  }

  // ----- Module 5: quick-add -----
  //
  // At the foot of the due-today module because that is what it adds to. Type,
  // Enter, done — no due-date picker, no priority, no goal: anything more is the
  // Tasks tab's job, and a cockpit input that opens a form is not a quick-add.
  function dashQuickAddHtml() {
    return '<div class="dash-quickadd">' +
        '<input type="text" class="tt-add-task-input dash-quickadd-input" data-dash-quickadd ' +
          'placeholder="Add a task due today…" aria-label="Add a task due today">' +
      '</div>';
  }

  // No name to greet with — LaunchPad has never asked for one and this line is
  // not the place to start.
  function dashGreeting() {
    var h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  function renderDashboardTab(panel, d, periodOverride) {
    if (!panel) return;
    var ws = Storage.getActiveWorkspace(d);
    // periodOverride is passed by the watcher/reconcile, which have ALREADY read
    // the boundary fresh from storage; everyone else gets the cached boundary for
    // an instant, no-flash first paint (dashboardPeriod stays pure — only the
    // SOURCE of its boundary argument differs). See dashSyncPeriod for why the
    // cache can be stale.
    var period = periodOverride || dashboardPeriod(Date.now(), Storage.getEndOfDayMinutes(d));
    var scope = dashFocusedScope(d);
    // ONE read of the open due/overdue set, feeding both the module's header and
    // its list. The evening header now makes a claim ABOUT this list, and a second
    // read would be a second chance for the two to disagree.
    var dueOpen = Storage.tasksDueByDay(ws, dashboardTodayAsUtcDay());

    // [2.0] Day Recap: today-scoped recap lines in the evening, unchanged, filled
    // two-phase by dashRefreshRecap and gated on the SAME scope that gates the
    // focused tile. :empty collapses it when every line suppresses.
    var recapShell = (period === "evening" && scope) ? '<div class="dash-recap" data-dash-recap></div>' : '';

    // The streak is a TRACKING-derived module, so it obeys the same suppression
    // rule as the focused tile: with tracking off the engine legitimately measures
    // nothing, and a "0 day streak" would read as a failure the user did not have.
    var streakCard = scope
      ? '<div class="pp-insights-card">' +
          '<div class="pp-dash-card-title">Focus streak</div>' +
          '<div data-dash-streak>' + dashStreakBodyHtml(null) + '</div>' +
        '</div>'
      : '';

    panel.dataset.dashPeriod = period;
    // LAYOUT: greeting, then the full-width strip, then two columns — due-today
    // primary, goals + streak secondary — collapsing to one column at narrow
    // width. The greeting is the TAB's header line now rather than a card title
    // buried in two of five variants, so it is the one thing that is always there.
    panel.innerHTML =
      '<div class="dash-tab" data-period="' + period + '">' +
        '<div class="dash-greeting">' + escapeHtml(dashGreeting()) + '</div>' +
        '<div class="insights-strip">' + dashStripHtml(d, ws, scope) + '</div>' +
        '<div class="dash-cockpit">' +
          '<div class="dash-col dash-col-primary">' +
            '<div class="pp-insights-card">' +
              dashHeadHtml(d, ws, period, dueOpen) +
              '<div class="pp-dash-card-title dash-due-title">Due today</div>' +
              '<div class="dash-due-list">' + dashDueListHtml(ws, dueOpen) + '</div>' +
              dashQuickAddHtml() +
            '</div>' +
          '</div>' +
          '<div class="dash-col dash-col-secondary">' +
            '<div class="pp-insights-card">' +
              '<div class="pp-dash-card-title">Goals</div>' +
              '<div class="insights-task-list">' + dashGoalsHtml(ws) + '</div>' +
            '</div>' +
            streakCard +
            recapShell +
          '</div>' +
        '</div>' +
      '</div>';

    bindDashboardEvents(panel);
    dashRefreshFocused(panel, scope);
    if (scope) dashRefreshStreak(panel, scope);
    if (period === "evening" && scope) dashRefreshRecap(panel, scope, d);

    // [1.0.20 F1] Reconcile the first paint against the FRESH stored boundary.
    // Skipped when we were handed a fresh period already (the watcher/reconcile),
    // so this cannot recurse. Same render-then-patch two-phase shape as
    // dashRefreshFocused above, and for the same reason: the boundary source in
    // this tab's cached `data` can lag storage after a provenance-suppressed
    // own-tab settings write.
    if (!periodOverride) dashSyncPeriod(panel);
  }

  // Own-tab eager repaint after a cockpit mutation. Our own write is provenance-
  // suppressed by design (the storage.onChanged gate skips the own-tab refresh so
  // DOM state survives), so nothing else will repaint this panel — this call is
  // what makes the strip's completed-today count tick and the completed row leave
  // the list WITHOUT a reload. The Tasks panel gets the same courtesy the Tasks
  // tab already pays the Dashboard (D8 F3), since both hold the same task.
  function dashRepaintAfterMutation(panel) {
    renderDashboardTab(panel, data);
    var tasksPanel = document.getElementById("tab-tasks");
    if (tasksPanel) renderTasksTab(tasksPanel, data);
  }

  function bindDashboardEvents(panel) {
    // Bind once per panel, delegated — same rationale as bindTasksTabEvents:
    // the listener lives on the panel container, which survives the innerHTML
    // rewrite, and a dataset flag stops N renders stacking N listeners.
    if (panel.dataset.dashBound === "1") return;
    panel.dataset.dashBound = "1";

    panel.addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-dash-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-dash-action");

      if (action === "lets-go") {
        var taskId = btn.getAttribute("data-task-id");
        if (!taskId) return;
        // Through satActivate — the SINGLE activation funnel. It carries
        // clearPause (Rule 4: an explicit "start this" clears a global pause in
        // the same atomic write) and the eager renders that keep the pill and
        // the Tasks panel from drifting. Reimplementing activation here would
        // be a second funnel, which is precisely what satActivate's comment
        // says must not exist.
        var ok = await satActivate(taskId, null);
        if (!ok) return;
        setActiveTab("home");
        return;
      }

      if (action === "continue") {
        // Continue on an already-active task: switch to Home, and if the user
        // is globally paused, resume — same start-means-start reading of
        // Rule 4 that satActivate applies, without re-activating the task
        // (which would be a no-op write the engine could read as a boundary).
        if (Storage.isTrackingPaused(data)) await satSetPaused(false);
        setActiveTab("home");
        return;
      }

      if (action === "goto-tasks") {
        setActiveTab("tasks");
      }
    });

    // Due-row completion. `change` rather than `click` for the same reason the
    // Tasks tab uses it: it is the checkbox's own state event, so keyboard
    // activation works without a second handler.
    panel.addEventListener("change", async function (e) {
      var box = e.target;
      if (!box || !box.classList || !box.classList.contains("dash-due-check")) return;

      // This list holds INCOMPLETE tasks only, so an unchecked box has no meaning
      // here — restore it rather than silently swallowing the gesture.
      if (!box.checked) { box.checked = true; return; }

      var taskId = box.getAttribute("data-task-id");
      if (!taskId) return;
      box.disabled = true;

      // COMPLETING THE ACTIVE TASK GOES THROUGH satComplete, always. A bare
      // completeTask leaves data.activeTask pointing at a finished task — the pill
      // keeps showing it, and, worse, the engine never gets the boundary that
      // closes the session: satComplete's clearActiveTask IS that boundary, and
      // its ordering is what makes focus right up to the moment of completion
      // still attribute to the task. Same single-funnel rule as satActivate.
      var active = Storage.resolveActiveTask(data);
      if (active && !active.stale && active.task.id === taskId) {
        await satComplete();   // owns its own renders, toast and goal celebration
        return;
      }

      try {
        await Storage.completeTask(data, taskId);
      } catch (err) {
        console.error("[LaunchPad] Dashboard: task complete failed", err);
      }
      dashRepaintAfterMutation(panel);
    });

    // Quick-add. Enter commits; the input is not in a <form>, so there is no
    // submit to suppress and no page-navigation risk to guard against.
    panel.addEventListener("keydown", async function (e) {
      var input = e.target;
      if (!input || !input.hasAttribute || !input.hasAttribute("data-dash-quickadd")) return;
      if (e.key !== "Enter") return;
      e.preventDefault();

      var name = (input.value || "").trim();
      if (!name) return;
      input.disabled = true;

      // dueAt is UTC-midnight of the LOCAL calendar date — the space dueAt
      // actually lives in. See dashboardTodayAsUtcDay's note for the two ways to
      // get this wrong by a day, one of which bites in UTC+8 specifically.
      var created;
      try {
        created = await Storage.createTask(data, { name: name, dueAt: dashboardTodayAsUtcDay() });
      } catch (err) {
        console.error("[LaunchPad] Dashboard: quick-add failed", err);
      }
      if (!created) {
        // createTask rejects (empty name, bad field) by returning null and warning.
        // Re-enable and leave the text in place rather than clearing the user's
        // typing on a failure they can still fix.
        input.disabled = false;
        return;
      }

      dashRepaintAfterMutation(panel);
      // The panel was re-rendered, so the focused element is gone with it. Put the
      // caret back in the FRESH input: quick-add is a repeat action, and losing
      // focus after every entry turns adding three tasks into three clicks.
      var next = panel.querySelector("[data-dash-quickadd]");
      if (next) next.focus();
    });
  }

  // ----- D8 re-render plumbing -----
  //
  // Still deliberately NOT the Tasks tab's ~40 eager mutation-site calls. The
  // triggers:
  //   (1) renderTabPlaceholder — init, access-level change, workspace switch,
  //       and (via the same applyAccessLevelUI pass) foreign-tab writes. Also the
  //       F2 combined-analytics toggle re-render, routed through this gated path.
  //   (2) every ACTIVATION of the Dashboard tab — this is what makes the card
  //       fresh after the user completes tasks elsewhere and comes back.
  //   (3) a 60s period check while the panel is visible, plus an after-paint
  //       reconcile on every render — both via dashSyncPeriod, which reads the
  //       boundary FRESH from storage so a same-tab settings write reaches it
  //       (the [1.0.20 F1] live finding); re-renders ONLY on a period flip.
  //   (4) [1.0.20 F3] three bounded active-task sites (satActivate/satCancel/
  //       satComplete) — a stale pick-up card offering a COMPLETED task is wrong,
  //       not merely old. Three sites, exactly; still not the 40-site pattern.
  var dashPeriodTimer = null;
  var dashPeriodToken = 0;

  function dashStopPeriodWatch() {
    if (dashPeriodTimer) {
      clearInterval(dashPeriodTimer);
      dashPeriodTimer = null;
    }
  }

  // [1.0.20 F1] The one "is the shown period still right?" check, against the
  // FRESH stored boundary. It is the fix for the live finding: a same-tab
  // settings write (a console poke today, the end-of-day picker tomorrow) is
  // provenance-suppressed by design — the storage.onChanged gate skips the
  // own-tab refresh so DOM state survives — which leaves this tab's cached `data`
  // holding the OLD boundary indefinitely. Reading `data` here would compare the
  // clock against a stale boundary forever; reading storage is the honest source.
  //
  // (The PRODUCTION clock-crossing path — fixed boundary, moving clock — was
  // never affected: Date.now() is always fresh and the boundary did not change,
  // so cached and stored agreed. This becomes a real bug the day the picker
  // ships, since a picker IS a same-tab settings write.)
  //
  // Shared by the 60s watcher tick AND the after-paint reconcile — both ask the
  // same question, and async is fine in both. Passes the fresh period into
  // renderDashboardTab so that render uses it verbatim and cannot loop by
  // recomputing from the stale cache. Token-guarded so a slow read landing after
  // a newer render/tick is discarded.
  async function dashSyncPeriod(panel) {
    if (!panel || panel.classList.contains("hidden") || !panel.isConnected) return;
    var token = ++dashPeriodToken;
    var boundary;
    try {
      boundary = Storage.getEndOfDayMinutes(await Storage.getAll());
    } catch (err) {
      console.error("[LaunchPad] Dashboard: end-of-day read failed", err);
      return;
    }
    if (token !== dashPeriodToken || !panel.isConnected) return;
    var period = dashboardPeriod(Date.now(), boundary);
    // Re-render ONLY on a flip. An unchanged period must not repaint — a silent
    // minute-by-minute innerHTML rewrite would throw away focus and restart the
    // focused-time read for nothing.
    if (panel.dataset.dashPeriod === period) return;
    renderDashboardTab(panel, data, period);
  }

  function dashStartPeriodWatch() {
    dashStopPeriodWatch();
    dashPeriodTimer = setInterval(function () {
      dashSyncPeriod(document.getElementById("tab-dashboard"));
    }, 60000);
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
    // [1.0.24 item 4 / D-SIXTH] Preview-is-the-promise: the SIX shipped badges.
    // Curator is un-banked (2026-07-20) and restored here with its original copy;
    // Marathoner remains the sole banked future candidate. Consistency copy was
    // corrected to the live definition (was "Deep work every weekday for 2 weeks").
    badges: [
      { id: "first-week",   title: "First Week",   desc: "Used LaunchPad 7 days running",          unlocked: true,  glyph: "calendar" },
      { id: "goal-crusher", title: "Goal Crusher", desc: "Completed 5 goals",                      unlocked: true,  glyph: "target"   },
      { id: "deep-diver",   title: "Deep Diver",   desc: "Single 2-hour focus block",              unlocked: true,  glyph: "compass"  },
      { id: "variety",      title: "Variety",      desc: "5 different tags in a week",             unlocked: false, glyph: "layers"   },
      { id: "consistency",  title: "Consistency",  desc: "Complete a task 7 days running",         unlocked: false, glyph: "trend"    },
      { id: "curator",      title: "Curator",      desc: "50+ shortcuts organized",                unlocked: false, glyph: "bookmark" }
    ]
  };

  function previewBannerHtml(d) {
    var trialUsed = !!(d && d.pro && d.pro.trialStartedAt);
    if (!trialUsed && !trialCtaLive()) {
      // teaser mode (TRIAL_CTA_ENABLED = false) — the preview STAYS (locked-tab clicks are untouched),
      // but the trial link becomes an inert "Coming soon" chip. Rendered without
      // the data-pro-preview-cta hook, so the click binder below never wires it.
      return '<div class="pro-preview-banner">' +
        '<span class="pro-preview-banner-text">Preview mode. Full Pro is coming soon.</span>' +
        '<span class="pro-preview-banner-cta is-teaser" aria-disabled="true">Coming soon</span>' +
      '</div>';
    }
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

  // ===== [2.0] Shared Insights SVG builders =====
  //
  // Extracted verbatim from the preview's inline construction so the LIVE board
  // (renderInsightsTab) and the free PREVIEW (renderInsightsPreview) render
  // through ONE code path — the audit's "parameterize the preview's SVG" mandate
  // made literal. The preview passes demo data; the board passes real
  // aggregates. Output is byte-identical to the pre-refactor preview when fed the
  // same inputs (asserted in the reader/render harness), so the free tier is
  // untouched.

  // Mono-series bar chart. `hours` is a plain number[]; the bar at `todayIndex`
  // gets the solid highlight class (CSS-fixed color — fine for a single series,
  // per the audit). The maxH `|| 1` and 1px height floor keep an all-zero or
  // sparse window honest rather than blank — a new user's chart filling in day
  // by day is the feature, so there is deliberately no empty state here.
  function insightsBarChartSvg(hours, todayIndex, ariaLabel) {
    var w = 560, h = 190, padX = 32, padTop = 28, padBottom = 32;
    var maxH = Math.max.apply(null, hours) || 1;
    var step = (w - 2 * padX) / hours.length;
    var barW = step * 0.6;
    var chartH = h - padTop - padBottom;
    var barsSvg = hours.map(function (hrs, i) {
      var x = padX + step * i + (step - barW) / 2;
      var bh = chartH * (hrs / maxH);
      var y = h - padBottom - bh;
      var cls = (i === todayIndex) ? "pp-bar pp-bar-today" : "pp-bar";
      return '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(bh, 1) + '" rx="2" />';
    }).join("");
    return '<svg class="pp-trend-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + ariaLabel + '">' +
        '<line class="pp-axis" x1="' + padX + '" y1="' + (h - padBottom) + '" x2="' + (w - padX) + '" y2="' + (h - padBottom) + '" />' +
        barsSvg +
        '<text class="pp-axis-label" x="' + padX + '" y="' + (padTop - 10) + '">hours / day</text>' +
        '<text class="pp-axis-label-sub" x="' + padX + '" y="' + (h - padBottom + 16) + '" text-anchor="start">30 days ago</text>' +
        '<text class="pp-axis-label-sub" x="' + (w - padX) + '" y="' + (h - padBottom + 16) + '" text-anchor="end">today</text>' +
      '</svg>';
  }

  // Donut ring. `segments` is [{ color, value }]; the ring's denominator is the
  // SUM of the segment values, so the ring ALWAYS sums to exactly its own whole —
  // the donut cannot lie about itself. `centerLabel` is the caller's own string;
  // the board computes it from that same segment sum so center, ring and legend
  // agree by construction.
  function insightsDonutSvg(segments, centerLabel, ariaLabel) {
    var total = segments.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
    var offset = 0;
    var segSvg = segments.map(function (s) {
      var frac = s.value / total;
      var dash = circ * frac;
      var gap = circ - dash;
      var seg = '<circle class="pp-donut-seg" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
        ' stroke="' + s.color + '"' +
        ' stroke-dasharray="' + dash + ' ' + gap + '"' +
        ' stroke-dashoffset="' + (-offset) + '"' +
      '/>';
      offset += dash;
      return seg;
    }).join("");
    return '<svg class="pp-donut" viewBox="0 0 160 160" role="img" aria-label="' + ariaLabel + '">' +
        '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">' + segSvg + '</g>' +
        '<text class="pp-donut-center" x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="middle">' + escapeHtml(centerLabel) + '</text>' +
      '</svg>';
  }

  // Legend rows for the donut. `rows` is [{ color, name, valueText }].
  function insightsDonutLegend(rows) {
    return rows.map(function (r) {
      return '<div class="pp-donut-legend-row">' +
          '<span class="pp-donut-legend-swatch" style="background:' + r.color + '"></span>' +
          '<span class="pp-donut-legend-name">' + escapeHtml(r.name) + '</span>' +
          '<span class="pp-donut-legend-hrs">' + r.valueText + '</span>' +
        '</div>';
    }).join("");
  }

  function renderInsightsPreview() {
    var d = DEMO_INSIGHTS_DATA;

    // 30-day trend bars — through the shared builder.
    var trendSvg = insightsBarChartSvg(d.trend30.days, d.trend30.todayIndex, "Deep work trend over the last 30 days");

    // Donut chart + legend — through the shared builders. The demo segments carry
    // {tag:{name,color}, hours}; map them to the builders' {color,value}/name shape.
    var donutSvg = insightsDonutSvg(
      d.donut.segments.map(function (s) { return { color: s.tag.color, value: s.hours }; }),
      d.donut.centerLabel,
      "Time by tag, last 30 days"
    );
    var donutLegend = insightsDonutLegend(
      d.donut.segments.map(function (s) { return { color: s.tag.color, name: s.tag.name, valueText: s.hours + "h" }; })
    );

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

  // ===== [1.0.22] Insights tab — live Achievements section =====
  //
  // The five shipped badges (D2), reusing the preview's renderBadgeGlyph icon
  // set and .pp-badge visual language (D3 mirror principle). Earned badges are
  // lit and show WHEN they were earned; locked badges are dimmed but show their
  // REAL description (D9 divergence from the preview's "Locked" subtitle — a Pro
  // user deserves to see the target). Trends are a v2.1 promise; the history is
  // already accruing behind the scenes.
  var INSIGHTS_BADGES = [
    { id: "first-week",   title: "First Week",   desc: "Open LaunchPad 7 days running",          glyph: "calendar" },
    { id: "goal-crusher", title: "Goal Crusher", desc: "Complete 5 different goals",             glyph: "target"   },
    { id: "deep-diver",   title: "Deep Diver",   desc: "A single 2-hour focus session",         glyph: "compass"  },
    { id: "variety",      title: "Variety",      desc: "Complete tasks across 5 tags in a week", glyph: "layers"   },
    { id: "consistency",  title: "Consistency",  desc: "Complete a task 7 days running",         glyph: "trend"    },
    { id: "curator",      title: "Curator",      desc: "Organize 50+ shortcuts",                 glyph: "bookmark" }
  ];
  var INSIGHTS_BADGE_BY_ID = INSIGHTS_BADGES.reduce(function (m, b) { m[b.id] = b; return m; }, {});

  // ===== [2.0] Insights live analytics board (Asana 1216743756248660) =====
  //
  // The board that fulfils the free preview's promise on the Pro tab: a summary
  // strip, 30-day Deep Work bars, Time by Tag donut, and Top Tasks — all from the
  // real per-day aggregates — sitting ABOVE the existing Achievements card. The
  // insights-soon placeholder is retired (D4). Free users never reach here
  // (renderProPreview owns the gated branch); this runs only inside the
  // Pro-accessible path, same as the Achievements card always has.

  // Two grays for the donut's two computed buckets, data-carried into the segment
  // stroke + legend swatch (no new donut CSS needed). Untagged inherits the demo
  // "ungrouped" gray; Deleted tags is a second, darker, distinguishable gray.
  // Both verified against the card frame in the three-frame harness.
  var INSIGHTS_UNTAGGED_COLOR = "#9b9b9b";
  var INSIGHTS_DELETED_TAG_COLOR = "#6d6d6d";

  // Staleness guard for the async board reads — a late resolution must not paint
  // over a newer render (workspace switch, scope flip, onChanged repaint). Same
  // token discipline as dashReadoutToken.
  var insightsReadToken = 0;

  // "YYYY-MM-DD" (a LOCAL day key) -> local-midnight epoch ms, so a best-day key
  // formats through fmtShortDate on the same local basis the aggregates use.
  function insightsKeyToTs(key) {
    var p = String(key).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }

  // ONE scope for the whole board (D3), the Dashboard convention verbatim:
  // combined -> every workspace; otherwise the active workspace. Returns null to
  // SUPPRESS the tracking-derived surfaces entirely when that workspace has
  // tracking disabled (measured-nothing is not did-nothing) — the Achievements
  // card renders regardless. Combined mode ignores per-workspace disabled flags
  // (the established D5 semantics); global trackingPaused never suppresses.
  function insightsScope(d) {
    var combined = !!(d && d.settings && d.settings.combinedAnalyticsEnabled);
    if (combined) return { mode: "combined", workspaceId: null };
    var ws = Storage.getActiveWorkspace(d);
    if (!Storage.isTrackingEnabled(ws)) return null;
    return { mode: "workspace", workspaceId: ws ? ws.id : null };
  }

  // The Achievements card — unchanged behaviour, extracted so both the suppressed
  // and the full board render it identically (D3: always present).
  function insightsAchievementsCardHtml(d) {
    var ach = Storage.getAchievements(d);
    var earnedCount = 0;
    var badgesHtml = INSIGHTS_BADGES.map(function (b) {
      var e = ach.earned[b.id];
      var lit = !!e;
      if (lit) earnedCount++;
      // Lit -> when earned; locked -> the real target (D9).
      var sub = lit ? ("Earned " + escapeHtml(fmtShortDate(e.earnedAt))) : escapeHtml(b.desc);
      return '<div class="pp-badge insights-badge' + (lit ? "" : " pp-badge-locked") + '"' + (lit ? ' data-earned="1"' : '') + '>' +
          '<div class="pp-badge-icon">' + renderBadgeGlyph(b.glyph) + '</div>' +
          '<div class="pp-badge-title">' + escapeHtml(b.title) + '</div>' +
          '<div class="pp-badge-sub">' + sub + '</div>' +
        '</div>';
    }).join("");
    return '<div class="pp-insights-card">' +
        '<div class="pp-dash-card-title">Achievements ' +
          '<span class="insights-badge-count">' + earnedCount + ' of ' + INSIGHTS_BADGES.length + '</span>' +
        '</div>' +
        '<div class="pp-badge-grid">' + badgesHtml + '</div>' +
      '</div>';
  }

  // Two-phase render (D5): paint the card frames synchronously (no blank flash —
  // titles and Achievements are immediate), then fill the tracking surfaces from
  // the async readers. When suppressed, the tracking shell is absent entirely and
  // only Achievements renders.
  function renderInsightsTab(panel, d) {
    if (!panel) return;
    var scope = insightsScope(d);
    var trackingShell = scope
      ? '<div class="insights-strip" data-ins-strip></div>' +
        '<div class="pp-insights-card">' +
          '<div class="pp-dash-card-title">Deep Work — last 30 days</div>' +
          '<div data-ins-deepwork></div>' +
        '</div>' +
        '<div class="pp-insights-card">' +
          '<div class="pp-dash-card-title">Time by tag — last 30 days</div>' +
          '<div class="pp-donut-row" data-ins-donut></div>' +
        '</div>' +
        '<div class="pp-insights-card">' +
          '<div class="pp-dash-card-title">Time by site — last 30 days</div>' +
          '<div class="insights-task-list insights-site-list" data-ins-topsites></div>' +
        '</div>' +
        '<div class="pp-insights-card">' +
          '<div class="pp-dash-card-title">Top tasks — last 30 days</div>' +
          '<div class="insights-task-list" data-ins-toptasks></div>' +
        '</div>'
      : "";

    panel.innerHTML =
      '<div class="insights-tab">' +
        trackingShell +
        insightsAchievementsCardHtml(d) +
      '</div>';

    if (scope) insightsRefresh(panel, scope, d);
  }

  function insightsFill(panel, selector, html) {
    var el = panel.querySelector(selector);
    if (el) el.innerHTML = html;
  }

  // Fill the four tracking surfaces from the windowed readers. One scope drives
  // all of them (D3). Reads run in parallel; a stale token (a newer render landed
  // meanwhile) drops the whole paint.
  async function insightsRefresh(panel, scope, d) {
    if (!panel || !scope) return;
    if (typeof Tracking === "undefined" || !Tracking.focusedRangeForScope) return;
    var token = ++insightsReadToken;
    var keys = Tracking.lastNLocalDayKeys(30);
    var range, byTag, byTask, byDomain;
    try {
      var res = await Promise.all([
        Tracking.focusedRangeForScope(scope.workspaceId, keys),
        Tracking.byTagForScope(scope.workspaceId, keys),
        Tracking.byTaskForScope(scope.workspaceId, keys),
        Tracking.byDomainForScope(scope.workspaceId, keys)
      ]);
      range = res[0]; byTag = res[1]; byTask = res[2]; byDomain = res[3];
    } catch (err) {
      console.error("[LaunchPad] Insights: board read failed", err);
      return;
    }
    if (token !== insightsReadToken) return;

    var combined = (scope.mode === "combined");
    var perDayMs = keys.map(function (k) { return range[k] || 0; });
    var scopeTotalMs = perDayMs.reduce(function (a, b) { return a + b; }, 0);
    var hours = perDayMs.map(function (ms) { return ms / 3600000; });

    insightsFill(panel, "[data-ins-strip]", insightsStripHtml(range, keys, scopeTotalMs));
    insightsFill(panel, "[data-ins-deepwork]",
      insightsBarChartSvg(hours, hours.length - 1, "Deep work over the last 30 days"));
    insightsFill(panel, "[data-ins-donut]", insightsTagDonutHtml(byTag, scopeTotalMs, d, combined));
    insightsFill(panel, "[data-ins-topsites]", insightsTopSitesHtml(byDomain, d, combined));
    insightsFill(panel, "[data-ins-toptasks]", insightsTopTasksHtml(byTask, d, combined));
  }

  // Summary strip: rolling "Last 7 days" total (deliberately NOT a calendar week
  // — no week-start locale question), "Best day" over the window (date + hours),
  // and a flat "Daily avg" = total / 30 with zero days included (a calendar
  // average). All local-day-key based, matching the aggregate basis.
  function insightsStripHtml(range, keys, scopeTotalMs) {
    var last7 = keys.slice(-7).reduce(function (a, k) { return a + (range[k] || 0); }, 0);
    var bestKey = null, bestMs = 0;
    keys.forEach(function (k) {
      var v = range[k] || 0;
      if (v > bestMs) { bestMs = v; bestKey = k; }
    });
    var avgMs = scopeTotalMs / 30;
    var items = [
      { num: fmtDurationHM(last7), label: "last 7 days" },
      { num: bestMs > 0 ? fmtDurationHM(bestMs) : "—",
        label: bestMs > 0 ? ("best day · " + escapeHtml(fmtShortDate(insightsKeyToTs(bestKey)))) : "best day" },
      { num: fmtDurationHM(avgMs), label: "daily avg" }
    ];
    return items.map(function (it) {
      return '<div class="insights-strip-item">' +
          '<span class="insights-strip-num">' + escapeHtml(it.num) + '</span>' +
          '<span class="insights-strip-label">' + it.label + '</span>' +
        '</div>';
    }).join("");
  }

  // Time by Tag donut. Buckets are keyed (workspaceId, tagId) by the reader and
  // NEVER merged across workspaces (Q3) — each resolves against its OWN workspace
  // for live name + color, with a workspace suffix in combined mode. Two computed
  // buckets keep the ring honest: "Deleted tags" collects orphaned ids (trashed/
  // purged after rollup — Q2), and "Untagged" is scopeTotal − Σ tag buckets.
  //
  // Donut-cannot-lie: the ring denominator and the center label are BOTH the sum
  // of the drawn segments, so they always agree. When no session carried more
  // than one tag, Σ tag buckets ≤ scopeTotal and that sum EQUALS scopeTotal
  // (untagged fills the gap) — the PLAN's "=== scope total" invariant, exact.
  // When sessions overlap tags (byTag unions bookmark + task tags, so a segment's
  // ms is credited to each of its tags — tracking.attributeSession), Σ tag
  // buckets can exceed scopeTotal; untagged clamps to 0 and the center reflects
  // the ring's real drawn total rather than understating it. The ring never sums
  // to a number other than its center label.
  function insightsTagDonutHtml(byTag, scopeTotalMs, d, combined) {
    var slices = [];
    var deletedMs = 0, tagTotalMs = 0;
    byTag.forEach(function (b) {
      tagTotalMs += b.ms;
      var ws = Storage.resolveWorkspaceFromData(d, b.workspaceId);
      var tag = ws ? Storage.getTagById(ws, b.tagId) : null;
      if (!tag) { deletedMs += b.ms; return; }
      var name = combined ? (tag.name + " — " + ws.name) : tag.name;
      slices.push({ color: tag.color, name: name, ms: b.ms });
    });
    slices.sort(function (a, b) { return b.ms - a.ms; });

    var untaggedMs = Math.max(0, scopeTotalMs - tagTotalMs);
    var ordered = slices.slice();
    if (deletedMs > 0) ordered.push({ color: INSIGHTS_DELETED_TAG_COLOR, name: "Deleted tags", ms: deletedMs });
    if (untaggedMs > 0) ordered.push({ color: INSIGHTS_UNTAGGED_COLOR, name: "Untagged", ms: untaggedMs });

    if (scopeTotalMs <= 0 || ordered.length === 0) {
      return '<div class="insights-empty">No focus time tracked in the last 30 days yet.</div>';
    }

    var drawnTotalMs = ordered.reduce(function (a, s) { return a + s.ms; }, 0);
    var donutSvg = insightsDonutSvg(
      ordered.map(function (s) { return { color: s.color, value: s.ms }; }),
      fmtDurationHM(drawnTotalMs),
      "Time by tag, last 30 days"
    );
    var legend = insightsDonutLegend(
      ordered.map(function (s) { return { color: s.color, name: s.name, valueText: fmtDurationHM(s.ms) }; })
    );
    return donutSvg + '<div class="pp-donut-legend">' + legend + '</div>';
  }

  // Top Tasks: top 6 by focused ms over the window ([1.2.1] eyeball pass — was 5;
  // Time by site now sits directly above it at 6, and the one-row asymmetry read
  // as an accident when the two lists became neighbours). Names resolve live (renames
  // reflected by construction); workspace suffix in combined mode. Orphaned ids
  // (task purged/trashed after rollup) are DROPPED SILENTLY (Q2) — their minutes
  // still count in every total via focusedRangeForScope; an unnameable rank is
  // noise. Quiet empty line when the window holds no task focus.
  function insightsTopTasksHtml(byTask, d, combined) {
    var rows = [];
    byTask.forEach(function (b) {
      var ws = Storage.resolveWorkspaceFromData(d, b.workspaceId);
      var task = ws ? Storage.getTaskById(ws, b.taskId) : null;
      if (!task) return;
      var name = combined ? (task.name + " — " + ws.name) : task.name;
      rows.push({ name: name, ms: b.ms });
    });
    rows.sort(function (a, b) { return b.ms - a.ms; });

    if (rows.length === 0) {
      return '<div class="insights-empty">No task focus tracked in the last 30 days yet.</div>';
    }

    var maxMs = rows[0].ms || 1;
    return rows.slice(0, 6).map(function (r) {
      var pct = Math.round((r.ms / maxMs) * 100);
      return '<div class="insights-task-row">' +
          '<span class="insights-task-name">' + escapeHtml(r.name) + '</span>' +
          '<span class="insights-task-bar"><span class="insights-task-bar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="insights-task-dur">' + fmtDurationHM(r.ms) + '</span>' +
        '</div>';
    }).join("");
  }

  // [1.2.1 T2/T3/T4] Time by site — top domains over the same 30-day window.
  //
  // Deliberately the Top Tasks idiom, down to REUSING ITS CLASSES rather than
  // cloning them under site-* names: the MINI-PLAN asks for no new visual
  // language, and duplicated CSS is how two things that must look identical
  // start drifting. The container carries an extra insights-site-list class as
  // a targeting hook with no styles attached, so nothing new can drift.
  //
  // T3 PRIVACY, ABSOLUTE: no favicons, ever, and no network of any kind. These
  // rows come from BROWSING data, so fetching an icon for one would transmit
  // the user's browsing domains to a favicon service — the exact thing
  // "nothing leaves the machine" forbids. Text rows only. (Top Tasks has no
  // icons either, so consistency and privacy point the same way.)
  //
  // T4 IDENTITY: the RAW hostname as the engine captured it (domainOf =
  // URL.hostname). No www-stripping, no alias collapsing — we display what
  // was measured, and we do not add a fourth domain-matching semantic alongside
  // the three the codebase already carries.
  //
  // Unlike Top Tasks there is nothing to resolve and therefore nothing to drop:
  // a domain is its own label, so every record the reader returns can be shown.
  function insightsTopSitesHtml(byDomain, d, combined) {
    var rows = [];
    (byDomain || []).forEach(function (b) {
      if (!b || !b.domain) return;
      var name = b.domain;
      if (combined) {
        var ws = Storage.resolveWorkspaceFromData(d, b.workspaceId);
        if (ws) name = b.domain + " — " + ws.name;
      }
      rows.push({ name: name, ms: b.ms });
    });
    rows.sort(function (a, b) { return b.ms - a.ms; });

    if (rows.length === 0) {
      return '<div class="insights-empty">No site time tracked in the last 30 days yet.</div>';
    }

    var maxMs = rows[0].ms || 1;
    return rows.slice(0, 6).map(function (r) {
      var pct = Math.round((r.ms / maxMs) * 100);
      return '<div class="insights-task-row">' +
          '<span class="insights-task-name">' + escapeHtml(r.name) + '</span>' +
          '<span class="insights-task-bar"><span class="insights-task-bar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="insights-task-dur">' + fmtDurationHM(r.ms) + '</span>' +
        '</div>';
    }).join("");
  }

  // [1.0.22 D10] Eager-render Insights when it is the VISIBLE tab, after an event
  // that may have unlocked a badge (a completion via the always-visible pill).
  // Access-gated dispatcher discipline (the F2/F4 class): free users keep their
  // preview; hidden panels do no work. renderInsightsTab reads getAchievements,
  // so a badge earned in the same completion write is lit immediately.
  function renderInsightsPanelEager() {
    if (!isProAccessibleLevel(currentAccessLevel())) return;
    var panel = document.getElementById("tab-insights");
    if (panel && !panel.classList.contains("hidden")) renderInsightsTab(panel, data);
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

  // [1.0.13] UTC-anchored variant of fmtShortDate. dueAt / deadlineAt are stored
  // as UTC-midnight epoch ms, so the deadline-block copy must format on the UTC
  // basis to show the same calendar day the user picked — fmtShortDate renders
  // in local time, which shifts the shown day for users behind UTC.
  function fmtShortDateUTC(ts) {
    if (!ts || typeof ts !== "number") return "";
    try {
      return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
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

  // ===== [1.0.12] Task priority + filter/sort helpers =====

  var PRIORITY_LABELS = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
  // Sort weight for the priority sort: urgent > high > medium > low > none(0).
  var PRIORITY_RANK = { urgent: 4, high: 3, medium: 2, low: 1 };

  function taskPriorityClass(p) {
    if (p === "urgent") return "tt-prio-urgent";
    if (p === "high")   return "tt-prio-high";
    if (p === "medium") return "tt-prio-medium";
    if (p === "low")    return "tt-prio-low";
    return "";
  }

  // Clickable priority pill on each task row. Colored + labelled when a priority
  // is set; a muted flag-only affordance when null (still a click target so the
  // user can assign one). Opens the priority popover (see openPriorityPillPopover).
  function priorityPillHtml(task) {
    var p = task.priority || null;
    var cls = "tt-prio-pill " + (p ? taskPriorityClass(p) : "tt-prio-none");
    var label = p ? PRIORITY_LABELS[p] : "";
    var aria = p ? ("Priority: " + label + " — click to change") : "Set priority";
    return '<button type="button" class="' + cls + '" data-task-id="' + escapeHtml(task.id) +
      '" data-priority="' + (p || "") + '" aria-label="' + escapeHtml(aria) + '" title="' + escapeHtml(aria) + '">' +
      '<span class="tt-prio-flag" aria-hidden="true">⚑</span>' +
      (label ? '<span class="tt-prio-pill-label">' + escapeHtml(label) + '</span>' : '') +
    '</button>';
  }

  // [1.0.13.1] Clickable due-date pill on each task row. Mirrors the priority
  // pill: tinted + labelled (UTC-formatted date) when a due date is set. When
  // null, a muted "add date" pill (calendar glyph + "Add date" text) so the
  // affordance is legible — the spec's "click due date -> date picker" presumes
  // something to click. data-due carries the YYYY-MM-DD so the popover can
  // prefill without a storage lookup. Opens openDueDatePillPopover.
  function dueDatePillHtml(task) {
    var has = typeof task.dueAt === "number";
    var cls = "tt-due-pill" + (has ? "" : " tt-due-none");
    var label = has ? fmtShortDateUTC(task.dueAt) : "";
    var ymd = has ? ymdFromTs(task.dueAt) : "";
    var aria = has ? ("Due " + label + " — click to change") : "Add date";
    return '<button type="button" class="' + cls + '" data-task-id="' + escapeHtml(task.id) +
      '" data-due="' + escapeHtml(ymd) + '" aria-label="' + escapeHtml(aria) + '" title="' + escapeHtml(aria) + '">' +
      // [2.0 ink] Was the U+1F5D3 emoji, and it was the one finding in this round
      // that no colour rule could reach: a colour emoji's pixels come from the
      // font's own bitmap and ignore `color` entirely. Measured [148,148,148] on
      // a dark row and [138,138,138] on a light one — the same mid-grey on all
      // four frames, 2.86:1, moving with the wallpaper not at all.
      //
      // The U+FE0E text-presentation selector was tried first and REJECTED on
      // measurement: it shifted the raster slightly (2.86 -> 3.37) but the glyph
      // still did not take `color`, so it would have shipped a comment claiming a
      // fix that had not happened. An inline SVG on currentColor is the real
      // mechanism — it is the idiom the lock, check and chevron glyphs in this
      // file already use, and it makes the icon inherit the pill's ink on every
      // frame by construction rather than by luck. Sized in em, so the existing
      // font-size rules still own the size and nothing here changes it.
      '<span class="tt-due-icon" aria-hidden="true">' + CALENDAR_SVG + '</span>' +
      (has ? '<span class="tt-due-pill-label">' + escapeHtml(label) + '</span>'
           : '<span class="tt-due-add-label">Add date</span>') +
    '</button>';
  }

  // True when a within-section filter (priority or tag) is narrowing the view.
  // Used to decide whether a goal card with zero matching children should dim —
  // we never dim on the unfiltered default (that would dim every empty goal).
  function tasksFiltersNarrowing() {
    return taskFilterState.priorities.length > 0 || taskFilterState.tagIds.length > 0;
  }

  // Priority + tag predicate for real tasks (AND across types, OR within a
  // multi-select). Status is NOT applied here — it drives section visibility in
  // renderTasksTab, not per-row removal — so a visible section still shows a
  // goal's active + completed children, just narrowed by priority/tag.
  function taskMatchesFilters(task) {
    var P = taskFilterState.priorities;
    if (P.length && P.indexOf(task.priority) === -1) return false;
    var T = taskFilterState.tagIds;
    if (T.length) {
      var ids = Array.isArray(task.tagIds) ? task.tagIds : [];
      var hit = false;
      for (var i = 0; i < ids.length; i++) { if (T.indexOf(ids[i]) !== -1) { hit = true; break; } }
      if (!hit) return false;
    }
    return true;
  }

  // Recurring templates have no priority/completed state, so only the tag filter
  // is meaningful for them; priority/status filters do not apply to templates.
  function recurringMatchesFilters(tpl) {
    var T = taskFilterState.tagIds;
    if (!T.length) return true;
    var ids = Array.isArray(tpl.tagIds) ? tpl.tagIds : [];
    for (var i = 0; i < ids.length; i++) { if (T.indexOf(ids[i]) !== -1) return true; }
    return false;
  }

  // Comparator for the active sort mode. createdAt asc is the universal tiebreak.
  function taskSortComparator() {
    var mode = taskFilterState.sort;
    return function (a, b) {
      var d = 0;
      if (mode === "priority") {
        d = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0); // urgent first, null last
      } else if (mode === "due") {
        var ad = typeof a.dueAt === "number" ? a.dueAt : Infinity; // null dueAt sorts last
        var bd = typeof b.dueAt === "number" ? b.dueAt : Infinity;
        d = ad - bd;
      } else if (mode === "name") {
        d = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      }
      if (d !== 0) return d;
      return (a.createdAt || 0) - (b.createdAt || 0);
    };
  }

  // Apply the priority/tag filter, then the active sort, layered on top of the
  // deletedAt filtering the caller already did. For the default sort ("created")
  // the caller's incoming order is preserved — callers pass lists already in
  // sortedByDisplayOrder (manual drag order, createdAt tiebreak), so drag-to-
  // reorder ([1.0.11.15]) stays authoritative on the default view and only the
  // explicit due/priority/name modes re-order.
  function applyTaskFilterSort(tasks) {
    var filtered = tasks.filter(taskMatchesFilters);
    if (taskFilterState.sort === "created") return filtered;
    return filtered.sort(taskSortComparator());
  }

  function priorityFilterLabel() {
    var n = taskFilterState.priorities.length;
    return n ? "Priority (" + n + ")" : "Priority";
  }
  function tagFilterLabel() {
    var n = taskFilterState.tagIds.length;
    return n ? "Tag (" + n + ")" : "Tag";
  }
  function tasksSelectedAttr(a, b) { return a === b ? " selected" : ""; }

  function tasksHeaderHtml() {
    // [1.0.12] Priority + Tag are multi-select popover buttons (the [1.0.10]
    // scaffold used single <select>s; multi-select needs a checkbox popover —
    // see openTaskFilterPopover). Status + Sort stay native <select>s; their
    // current value is reflected via `selected` so re-renders preserve state.
    var fs = taskFilterState;
    return '<header class="tasks-header">' +
        '<div class="tasks-header-left">' +
          '<h1 class="tasks-title">Tasks</h1>' +
          '<div class="tasks-filter-bar" role="toolbar" aria-label="Task filters">' +
            '<button type="button" class="tasks-filter tasks-filter-multi' + (fs.priorities.length ? ' is-active' : '') + '" data-filter="priority" aria-haspopup="true">' + escapeHtml(priorityFilterLabel()) + '</button>' +
            '<button type="button" class="tasks-filter tasks-filter-multi' + (fs.tagIds.length ? ' is-active' : '') + '" data-filter="tag" aria-haspopup="true">' + escapeHtml(tagFilterLabel()) + '</button>' +
            '<select class="tasks-filter" data-filter="status" aria-label="Status filter">' +
              '<option value="active"' + tasksSelectedAttr(fs.status, "active") + '>Active</option>' +
              '<option value="completed"' + tasksSelectedAttr(fs.status, "completed") + '>Completed</option>' +
              '<option value="all"' + tasksSelectedAttr(fs.status, "all") + '>All</option>' +
            '</select>' +
            '<select class="tasks-filter" data-filter="sort" aria-label="Sort by">' +
              '<option value="created"' + tasksSelectedAttr(fs.sort, "created") + '>Sort: created</option>' +
              '<option value="due"' + tasksSelectedAttr(fs.sort, "due") + '>Sort: due</option>' +
              '<option value="priority"' + tasksSelectedAttr(fs.sort, "priority") + '>Sort: priority</option>' +
              '<option value="name"' + tasksSelectedAttr(fs.sort, "name") + '>Sort: name</option>' +
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

  // Single child task row — read-only name + working checkbox. [1.0.12] adds
  // the priority left-border (color only when a priority is set) and a
  // clickable priority pill.
  // [1.0.16] Is this row the globally-active task? Matched on workspace too:
  // activeTask is global across workspaces and task ids are only unique within
  // one, so id alone could light up a same-id row in the wrong workspace.
  function satIsActiveTaskRow(workspace, task) {
    var a = Storage.getActiveTask(data);
    return !!(a && a.taskId === task.id && a.workspaceId === (workspace && workspace.id));
  }

  function taskRowHtml(workspace, task) {
    var checked = task.completed ? " checked" : "";
    var completedCls = task.completed ? " is-completed" : "";
    // [Tasks v2] Tag column shows a single tag (the common case); extra tags
    // collapse into a "+N" indicator so the fixed-width tag column never breaks
    // the vertical alignment of the controls grid.
    var tagIds = Array.isArray(task.tagIds) ? task.tagIds : [];
    var tagHtml = "";
    if (tagIds.length >= 1) {
      tagHtml = tagPillHtml(workspace, tagIds[0]);
      if (tagIds.length > 1) {
        tagHtml += '<span class="tt-tag-more" title="' + tagIds.length + ' tags">+' + (tagIds.length - 1) + '</span>';
      }
    }
    // [1.0.11.18] Dedicated drag handle as the leftmost element. Mirrors
    // the sidebar shortcut grab-dots pattern (.sidebar-shortcut-drag-handle
    // at newtab.css:3384 using the same ⠇ braille character). The
    // task Sortables (bindTasksTabSortables) only initiate drag on this
    // element via `handle: ".tt-task-handle"`, so checkbox clicks and
    // future task-name interactions reach their handlers without Sortable
    // interception. aria-hidden so screen readers skip the decorative dots.
    var prioCls = taskPriorityClass(task.priority);
    // [Tasks] Right side is a fixed-order controls zone (priority, date, tags,
    // trash) separated from the task info by a divider. Priority + date always
    // render their affordance so their slots hold width whether set or empty;
    // the trash slot is always present. The name (flex:1) truncates so the zone
    // — and the divider — stay at a consistent position row-to-row.
    // [1.0.16] Activation affordance + active indicator, as ONE element. It is
    // not on the name: clicking .tt-task-name already opens the inline rename
    // (startTaskNameEdit), and the name is the row's whole body. Dim-on-hover
    // for any row, solid for the active task.
    // [Polish] The ACTIVE row's glyph is a live play/pause TOGGLE mirroring the
    // card's control — three views of ONE state (card, pill, row glyph), never a
    // per-task pause: it writes the same GLOBAL data.trackingPaused flag.
    //   non-active            -> ▷  "Start task"      (activate; unchanged)
    //   active + running      -> ⏸  "Pause tracking"  (setTrackingPaused(true))
    //   active + paused       -> ▶  "Resume tracking" (amber, per the loud-paused standard)
    // Paused shows PLAY because the glyph advertises what the click DOES, which
    // is also why the active+running glyph is a pause bar rather than the old ▶.
    // data-play-act is read by the delegated handler so routing is driven by the
    // rendered state rather than re-derived at click time — the two cannot drift.
    var isActiveTask = satIsActiveTaskRow(workspace, task);
    var activeCls = isActiveTask ? " is-active-task" : "";
    var rowPaused = isActiveTask && Storage.isTrackingPaused(data);
    var playAct = !isActiveTask ? "activate" : (rowPaused ? "resume" : "pause");
    var playTitle = playAct === "activate" ? "Start task"
      : (playAct === "pause" ? "Pause tracking" : "Resume tracking");
    var playGlyph = playAct === "activate" ? "▷" : (playAct === "pause" ? "⏸" : "▶");
    var playHtml = '<button type="button" class="tt-task-play' + (rowPaused ? ' is-paused' : '') +
      '" data-task-id="' + escapeHtml(task.id) + '" data-play-act="' + playAct +
      '" aria-label="' + escapeHtml(playTitle) + '" title="' + escapeHtml(playTitle) + '"' +
      (isActiveTask ? ' aria-pressed="true"' : '') + '>' + playGlyph + '</button>';

    // [Polish step 8] Paused-active reads at ROW level, not just glyph level.
    // Driven by the SAME rowPaused above that routes the glyph's three states —
    // one source of truth (active + the global trackingPaused flag), computed at
    // render time. No new state, and the row and its glyph cannot disagree
    // because a single boolean produces both.
    var pausedRowCls = rowPaused ? " is-paused" : "";
    return '<li class="tt-task-row' + completedCls + activeCls + pausedRowCls + (prioCls ? ' ' + prioCls : '') + '" data-task-id="' + escapeHtml(task.id) + '">' +
      '<span class="tt-task-handle" aria-hidden="true" title="Drag to reorder">⠇</span>' +
      '<input type="checkbox" class="tt-task-check" data-task-id="' + escapeHtml(task.id) + '"' + checked + ' aria-label="Toggle task complete">' +
      playHtml +
      // [2.0 timing] The name and its time readouts are ONE cluster now, so both
      // numbers sit beside the task they describe instead of at the far right of
      // the row. See .tt-task-main — the name shrinks and truncates, the readouts
      // never do. Inline rename still targets .tt-task-name and replaceWith()s it
      // inside this wrapper, so the readouts survive an open edit.
      '<span class="tt-task-main">' +
        '<span class="tt-task-name" title="' + escapeHtml(task.name) + '">' + escapeHtml(task.name) + '</span>' +
        // The ACTIVE row's live figure — the engine's focused-today for this
        // task, or the SESSION ELAPSED while a work phase runs (satRowLiveState
        // owns that switch). Painted by the SAME 1s text path as the pill
        // (satPaintTime), so there is no second timer and no re-render per tick.
        (isActiveTask ? satRowLiveHtml() : "") +
        // Windowed tracked time. Rendered EMPTY and filled by ttRefreshTaskTimes a
        // tick later — the byTask read is async and taskRowHtml is a synchronous
        // builder, the same two-phase shape the cockpit uses. A task with no
        // measured time shows nothing at all rather than a "0m" that cannot tell
        // "never worked on" from "worked on before the window".
        '<span class="tt-task-time" data-task-time="' + escapeHtml(task.id) + '"></span>' +
      '</span>' +
      '<div class="tt-task-controls">' +
        '<span class="tt-task-slot tt-slot-priority">' + priorityPillHtml(task) + '</span>' +
        '<span class="tt-task-slot tt-slot-date">' + dueDatePillHtml(task) + '</span>' +
        '<span class="tt-task-slot tt-slot-tags">' + tagHtml + '</span>' +
        '<button type="button" class="tt-task-slot tt-task-trash" data-task-id="' + escapeHtml(task.id) + '" aria-label="Delete task" title="Delete task">' + TRASH_SM_SVG + '</button>' +
      '</div>' +
    '</li>';
  }

  // [2.0 pill clarity] Windowed per-task time for the Tasks tab's rows.
  //
  // ONE read for the whole panel, not one per row: byTaskForScope returns every
  // task's total for the window in a single pass, so N rows cost N lookups in a
  // map rather than N engine reads.
  //
  // Patches the DOM instead of re-rendering, deliberately — renderTasksTab
  // rebuilds the panel wholesale, which would blur an open inline rename and
  // reset the scroller. The slots were rendered empty, so this only ever fills
  // them in.
  //
  // Same honesty rules as the pill's line: the label says "last N days" off the
  // engine's own retention constant (never "this month" — the window is rolling,
  // and on the 3rd it would claim thirty days of data), and zero renders NOTHING.
  var ttTaskTimesToken = 0;

  async function ttRefreshTaskTimes(panel) {
    if (!panel) return;
    if (typeof Tracking === "undefined" || !Tracking.byTaskForScope) return;
    var token = ++ttTaskTimesToken;
    var scope = dashFocusedScope(data);
    // Tracking off: the reader would honestly return nothing, and painting an
    // empty chip on every row would suggest "no time" rather than "not measured".
    if (!scope) return;
    var rows;
    try {
      rows = await Tracking.byTaskForScope(SAT_ALL_WORKSPACES, Tracking.lastNLocalDayKeys(satWindowDays()));
    } catch (err) {
      console.error("[LaunchPad] Tasks tab: windowed task times read failed", err);
      return;
    }
    if (token !== ttTaskTimesToken) return;
    var byId = {};
    (rows || []).forEach(function (r) { if (r && r.taskId) byId[r.taskId] = (byId[r.taskId] || 0) + (r.ms || 0); });
    var days = satWindowDays();
    panel.querySelectorAll("[data-task-time]").forEach(function (slot) {
      var ms = byId[slot.getAttribute("data-task-time")] || 0;
      if (!(ms > 0)) { slot.innerHTML = ""; return; }
      var txt = fmtDurationHM(ms);
      slot.innerHTML = '<span class="tt-time-chip" title="' +
        escapeHtml(txt + " tracked in the last " + days + " days") + '">' + escapeHtml(txt) + '</span>';
    });
  }

  function goalCardHtml(workspace, goal, allTasks) {
    var children = sortedByDisplayOrder(allTasks.filter(function (t) {
      return t.goalId === goal.id && !t.deletedAt;
    }));
    // Progress reflects ALL non-deleted children, independent of any filter, so
    // the bar stays a truthful goal-completion gauge while the list narrows.
    var doneCount = children.filter(function (t) { return t.completed; }).length;
    var totalCount = children.length;
    var pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
    // [1.0.12] Visible list = priority/tag filter + active sort applied within
    // the card. Zero matches under an active filter dims the card (kept, not
    // removed); under no filter an empty goal renders normally (never dimmed).
    var visibleChildren = applyTaskFilterSort(children);
    var dimmed = tasksFiltersNarrowing() && visibleChildren.length === 0;

    var deadlineHtml = "";
    if (typeof goal.deadlineAt === "number") {
      var overdue = isOverdue(goal.deadlineAt) && goal.status !== "completed";
      deadlineHtml = '<span class="tt-goal-deadline">' + escapeHtml(fmtShortDate(goal.deadlineAt)) + '</span>';
      if (overdue) {
        deadlineHtml += '<span class="tt-overdue-badge">Overdue</span>';
      }
    }

    var tasksListHtml = visibleChildren.length
      ? visibleChildren.map(function (t) { return taskRowHtml(workspace, t); }).join("")
      : (tasksFiltersNarrowing()
          ? '<li class="tt-task-empty">No tasks match the current filter.</li>'
          : '<li class="tt-task-empty">No tasks yet.</li>');

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

    return '<article class="tt-goal-card' + (isCompleted ? ' is-completed' : '') + (dimmed ? ' tt-goal-dimmed' : '') + '" data-goal-id="' + escapeHtml(goal.id) + '" data-collapsed="' + (isCollapsed ? "true" : "false") + '">' +
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
        '<div class="tt-progress-bar">' +
          '<span class="tt-progress-pct tt-progress-pct-base" aria-hidden="true">' + pct + '%</span>' +
          '<div class="tt-progress-fill" style="width:' + pct + '%">' +
            '<span class="tt-progress-pct tt-progress-pct-fill" aria-hidden="true">' + pct + '%</span>' +
          '</div>' +
        '</div>' +
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
    return '<li class="tt-recurring-row" data-template-id="' + escapeHtml(template.id) + '" title="Right-click to manage">' +
      '<span class="tt-recurring-icon" aria-hidden="true">↻</span>' +
      '<span class="tt-recurring-name">' + escapeHtml(template.name) + '</span>' +
      '<span class="tt-recurring-hint">' + escapeHtml(hint) + '</span>' +
      tagHtml +
      pausedBadge +
    '</li>';
  }

  var TRASH_TTL_DAYS = 30;
  var TRASH_DAY_MS = 24 * 60 * 60 * 1000;

  // Whole days remaining before a trashed item (deletedAt) auto-purges at day
  // 30. Clamped at 0 (an item at/past expiry shows "0 days" until the next
  // opportunistic purge removes it).
  function trashDaysRemaining(deletedAt) {
    if (typeof deletedAt !== "number") return TRASH_TTL_DAYS;
    var elapsedDays = Math.floor((Date.now() - deletedAt) / TRASH_DAY_MS);
    return Math.max(0, TRASH_TTL_DAYS - elapsedDays);
  }

  // Countdown urgency band (trash-bin.md "neutral → amber → red as it
  // approaches zero"): >7 neutral, 3–7 amber, ≤2 red.
  function trashCountdownClass(daysRemaining) {
    if (daysRemaining <= 2) return "tt-trash-days-red";
    if (daysRemaining <= 7) return "tt-trash-days-amber";
    return "tt-trash-days-neutral";
  }

  // ----- COMPLETED box -----
  //
  // The celebration move's always-visible destination. Lists completed goals
  // and completed STANDALONE tasks as compact rows (struck name + completion
  // date), newest first by completedAt. Completed CHILD tasks of an active goal
  // are intentionally NOT listed here — they grey in place inside their goal
  // card for the progress bar (unchanged behavior); a completed goal represents
  // its own completed children. Right-click a row to reactivate (see
  // openCompletedContextMenu). Height-capped with internal scroll so a large
  // history stays compact.
  function completedRowHtml(kind, id, name, completedAt) {
    return '<li class="tt-completed-row" data-kind="' + kind + '" data-id="' + escapeHtml(id) + '" title="Right-click or Restore to reactivate">' +
        '<span class="tt-completed-kind" aria-hidden="true">' + (kind === "goal" ? "◎" : "✓") + '</span>' +
        '<span class="tt-completed-name">' + escapeHtml(name) + '</span>' +
        '<span class="tt-completed-date">' + escapeHtml(fmtShortDate(completedAt)) + '</span>' +
        '<span class="tt-completed-actions">' +
          '<button type="button" class="tt-completed-btn tt-completed-restore" data-action="restore-completed">Restore</button>' +
        '</span>' +
      '</li>';
  }

  function completedBoxHtml(workspace, completedGoals, completedStandalone) {
    var items = [];
    completedGoals.forEach(function (g) {
      items.push({ kind: "goal", id: g.id, name: g.name, at: g.completedAt || 0 });
    });
    completedStandalone.forEach(function (t) {
      items.push({ kind: "task", id: t.id, name: t.name, at: t.completedAt || 0 });
    });
    items.sort(function (a, b) { return b.at - a.at; }); // newest first
    var count = items.length;
    var bodyHtml = count
      ? '<ul class="tt-completed-list">' +
          items.map(function (it) { return completedRowHtml(it.kind, it.id, it.name, it.at); }).join("") +
        '</ul>'
      : '<div class="tt-empty-state">No completed tasks yet.</div>';
    // [Tasks] Bulk action, only when the box has rows: Clear soft-deletes them
    // into the Deleted box (recoverable), so it confirms but isn't danger-styled.
    var actionsHtml = count
      ? '<span class="tt-box-actions">' +
          '<button type="button" class="tt-box-action" data-action="clear-completed">Clear</button>' +
        '</span>'
      : '';
    return '<section class="tt-section tt-box tt-completed-box" data-section="completed">' +
        '<div class="tt-box-header">' +
          '<h2 class="tt-section-title">Completed' +
            (count ? ' <span class="tt-section-count">' + count + '</span>' : '') +
          '</h2>' +
          actionsHtml +
        '</div>' +
        '<div class="tt-box-body">' + bodyHtml + '</div>' +
      '</section>';
  }

  // ----- DELETED box -----
  //
  // The Tasks-tab trash surface (DECISIONS 2026-07-14). Lists trashed goals and
  // tasks of the current workspace, newest deletion first, each with a type
  // indicator, name, "X days remaining" countdown (neutral → amber → red), and
  // per-row Restore / Delete Permanently actions. Permanent delete is the only
  // action that confirms (trash-bin.md). Restore homing is handled in Storage
  // (task → parent goal if alive else standalone; goal → goals list).
  function deletedBoxHtml(workspace, deletedGoals, deletedTasks) {
    var items = [];
    deletedGoals.forEach(function (g) {
      items.push({ kind: "goal", id: g.id, name: g.name, at: g.deletedAt || 0 });
    });
    deletedTasks.forEach(function (t) {
      items.push({ kind: "task", id: t.id, name: t.name, at: t.deletedAt || 0 });
    });
    items.sort(function (a, b) { return b.at - a.at; }); // newest deletion first
    var count = items.length;
    var bodyHtml = count
      ? '<ul class="tt-deleted-list">' +
          items.map(function (it) {
            var days = trashDaysRemaining(it.at);
            var daysCls = trashCountdownClass(days);
            return '<li class="tt-deleted-row" data-kind="' + it.kind + '" data-id="' + escapeHtml(it.id) + '" title="' + escapeHtml(it.kind === "goal" ? "Goal" : "Task") + '">' +
                '<span class="tt-deleted-kind" aria-hidden="true">' + (it.kind === "goal" ? "◎" : "▪") + '</span>' +
                '<span class="tt-deleted-name">' + escapeHtml(it.name) + '</span>' +
                '<span class="tt-trash-days ' + daysCls + '">' + days + (days === 1 ? " day left" : " days left") + '</span>' +
                '<span class="tt-deleted-actions">' +
                  '<button type="button" class="tt-deleted-btn tt-deleted-restore" data-action="restore-deleted">Restore</button>' +
                  '<button type="button" class="tt-deleted-btn tt-deleted-purge" data-action="purge-deleted">Delete</button>' +
                '</span>' +
              '</li>';
          }).join("") +
        '</ul>'
      : '<div class="tt-empty-state">Nothing deleted. Items stay here 30 days.</div>';
    // [Tasks] Bulk actions, only when the box has rows. Restore all is
    // non-destructive (no confirm); Empty is the ONLY permanent, danger-styled
    // action and always confirms with a live count.
    var actionsHtml = count
      ? '<span class="tt-box-actions">' +
          '<button type="button" class="tt-box-action" data-action="restore-all">Restore all</button>' +
          '<button type="button" class="tt-box-action tt-box-action-danger" data-action="empty-trash">Empty</button>' +
        '</span>'
      : '';
    return '<section class="tt-section tt-box tt-deleted-box" data-section="deleted">' +
        '<div class="tt-box-header">' +
          '<h2 class="tt-section-title">Deleted' +
            (count ? ' <span class="tt-section-count">' + count + '</span>' : '') +
          '</h2>' +
          actionsHtml +
        '</div>' +
        '<div class="tt-box-body">' + bodyHtml + '</div>' +
      '</section>';
  }

  // Task-completion celebration timing (see the "Completion Celebrations →
  // Task completion" subsection of docs/SPECS/tasks-and-goals.md).
  var TASK_COMPLETE_DWELL_MS = 1500;  // in-place green fill sweep across the row
  var TASK_COMPLETE_LEAVE_MS = 300;   // fade/slide for rows that leave to Completed

  // Animate a just-completed task row, then settle the panel. completeTask has
  // already persisted; this only drives the visual acknowledgment so completion
  // never reads as deletion.
  //
  // Uniform beat: 150ms checkmark pop + a ~900ms in-place dwell (green tint +
  // dimmed text). Then the row settles by DESTINATION:
  //   - LEAVES its visible spot (standalone task → Completed section, or a
  //     goal-child whose goal just auto-completed → the whole card relocates):
  //     ~300ms fade/slide + toast "✓ Moved to Completed".
  //   - STAYS (goal-child under a still-active goal greys in place, because the
  //     goal card keeps completed children for its progress bar): settle to the
  //     is-completed styling + toast "✓ Task completed".
  //
  // Goal auto-completion seam: when goalAutoCompleted, the goal card's move to
  // Completed happens in the deferred settle render below — i.e. AFTER the task
  // animation, per spec. A goal-completion celebration (not yet implemented)
  // hooks in there; this task does not add one.
  //
  // Render-suppression window (rapid multi-complete safety): the [1.0.11.2]
  // write-provenance gate already suppresses the onChanged re-render for our own
  // completeTask write, so nothing re-renders DURING the dwell. We additionally
  // defer OUR settle renderTasksTab until the last in-flight completion finishes
  // (panel._completingCount), so one completion's settle never destroys another
  // completing row mid-animation. Trade-off: with overlapping completes, an
  // early finisher's row holds its transient state until the last one settles.
  function runTaskCompletionCelebration(panel, row, result) {
    panel._completingCount = (panel._completingCount || 0) + 1;
    var autoGoalId = (result && result.goalAutoCompleted && result.autoCompletedGoal) ? result.autoCompletedGoal.id : null;
    var settle = function () {
      panel._completingCount = Math.max(0, (panel._completingCount || 1) - 1);
      if (panel._completingCount === 0) {
        renderTasksTab(panel, data);
        // [1.0.24 item 3] The goal card relocated to Completed in the render just
        // above; sweep it now, in place. [1.0.22 D10] Goal Crusher may have
        // unlocked — refresh Insights if it is the visible tab.
        if (autoGoalId) { celebrateGoalCompletion(autoGoalId); renderInsightsPanelEager(); }
      }
    };
    // No row element to animate (e.g. filtered out of view) — settle only.
    if (!row || !row.classList) { settle(); return; }

    var task = result && result.task;
    var goalAutoCompleted = !!(result && result.goalAutoCompleted);
    // Standalone tasks move to the Completed section. A goal-child moves only if
    // its goal just auto-completed (the whole card relocates); otherwise it
    // greys in place inside its still-active goal card.
    var leavesView = !task || task.goalId == null || goalAutoCompleted;

    // 150ms checkmark pop + the left→right green fill sweep begin together.
    // Feed the dwell length to the CSS sweep so its duration tracks this one
    // constant (see .tt-task-row.tt-completing::before).
    row.style.setProperty("--tt-complete-dwell", TASK_COMPLETE_DWELL_MS + "ms");
    row.classList.add("tt-completing");

    setTimeout(function () {
      if (leavesView) {
        showToast("✓ Moved to Completed");
        row.classList.add("tt-completing-leave"); // ~300ms fade/slide out
        setTimeout(settle, TASK_COMPLETE_LEAVE_MS);
      } else {
        showToast("✓ Task completed");
        settle();
      }
    }, TASK_COMPLETE_DWELL_MS);
  }

  // [Tasks] Direct task delete per trash-bin.md: soft-delete + eager re-render +
  // a 5-second Undo toast — no confirmation modal (the trash bin + Undo are the
  // safety net). Undo restores the task (deletedAt -> null) and re-renders. Used
  // by the row trash icon and the task context-menu Delete (goal delete keeps
  // its confirm modal — goals cascade).
  async function deleteTaskWithUndo(taskId) {
    if (!taskId) return;
    try {
      await Storage.deleteTask(data, taskId);
    } catch (err) {
      console.error("[LaunchPad] Tasks tab: deleteTask failed", err);
      return;
    }
    var panel = document.getElementById("tab-tasks");
    if (panel) renderTasksTab(panel, data);
    showUndoToast("Deleted. Restore from Trash within 30 days.", async function () {
      try {
        await Storage.restoreTask(data, taskId);
      } catch (err2) {
        console.error("[LaunchPad] Tasks tab: restoreTask failed", err2);
      }
      var p = document.getElementById("tab-tasks");
      if (p) renderTasksTab(p, data);
    }, 5000);
  }

  // [Tasks] Deleted-box: restore a trashed goal or task (deletedAt -> null).
  // Storage handles restore homing (task -> parent goal if alive, else
  // standalone; goal -> goals list). Eager re-render + confirmation toast.
  async function restoreDeletedItem(kind, id) {
    if (!id) return;
    try {
      if (kind === "goal") await Storage.restoreGoal(data, id);
      else await Storage.restoreTask(data, id);
    } catch (err) {
      console.error("[LaunchPad] Tasks tab: restore from Deleted failed", err);
      return;
    }
    var panel = document.getElementById("tab-tasks");
    if (panel) renderTasksTab(panel, data);
    showToast(kind === "goal" ? "Goal restored" : "Task restored");
  }

  // [Polish] Completed-box: reactivate a completed goal or task via the visible
  // hover Restore button — same reactivate path as the right-click menu
  // (Storage.reactivateGoal / reactivateTask). Their rich return
  // (goalAutoReactivated / autoReactivatedGoal — a completed task flips its
  // parent goal back to active) is reflected by the eager re-render, exactly as
  // the right-click path does; captured here so any future handling has it.
  // Right-click reactivate (openCompletedContextMenu) is untouched.
  async function reactivateCompletedItem(kind, id) {
    if (!id) return;
    try {
      if (kind === "goal") await Storage.reactivateGoal(data, id);
      else await Storage.reactivateTask(data, id);
    } catch (err) {
      console.error("[LaunchPad] Tasks tab: reactivate from Completed failed", err);
      return;
    }
    var panel = document.getElementById("tab-tasks");
    if (panel) renderTasksTab(panel, data);
    showToast(kind === "goal" ? "Goal reactivated" : "Task reactivated");
  }

  // [Tasks] Deleted-box: permanent delete — the ONLY delete that confirms
  // (trash-bin.md). Hard-splices the record; no Undo. On confirm, re-render.
  function confirmPurgeDeletedItem(kind, id, name) {
    if (!id) return;
    var label = kind === "goal" ? "goal" : "task";
    openTasksConfirmModal({
      title: "Delete permanently?",
      message: 'Permanently delete the ' + label + ' "' + name + '"? This cannot be undone.',
      confirmLabel: "Delete permanently",
      dangerous: true,
      onConfirm: async function () {
        try {
          if (kind === "goal") await Storage.deleteGoalPermanent(data, id);
          else await Storage.deleteTaskPermanent(data, id);
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: permanent delete failed", err);
        }
        var panel = document.getElementById("tab-tasks");
        if (panel) renderTasksTab(panel, data);
      }
    });
  }

  // ----- [Tasks] Bottom-box bulk actions -----
  //
  // Counts are read LIVE from storage at click time (not from the rendered DOM),
  // so a modal can never quote a stale number. Each action batches into ONE
  // saveAll via the Storage bulk fns, then re-renders through the normal eager
  // path (which restores the empty state once a box is emptied).

  function pluralItems(n) { return n + " item" + (n === 1 ? "" : "s"); }

  function deletedBoxCount() {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return 0;
    return Storage.getDeletedGoals(ws).length + Storage.getDeletedTasks(ws).length;
  }

  // Mirrors what the Completed box renders: completed goals + completed
  // STANDALONE tasks (a completed goal's children are represented by the goal).
  function completedBoxCount() {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return 0;
    var standalone = Storage.getCompletedTasks(ws).filter(function (t) { return t.goalId === null; });
    return Storage.getCompletedGoals(ws).length + standalone.length;
  }

  function eagerRenderTasks() {
    var panel = document.getElementById("tab-tasks");
    if (panel) renderTasksTab(panel, data);
  }

  // Empty — the ONLY truly destructive bulk action, so it confirms with a live
  // count and danger styling. Hard-removes every trashed goal/task, one saveAll.
  function confirmEmptyTrash() {
    var n = deletedBoxCount();
    if (!n) return;
    openTasksConfirmModal({
      title: "Empty trash?",
      message: "Permanently delete all " + pluralItems(n) + "? This cannot be undone.",
      confirmLabel: "Delete permanently",
      dangerous: true,
      onConfirm: async function () {
        try {
          var removed = await Storage.emptyTrash(data);
          eagerRenderTasks();
          showToast("Permanently deleted " + pluralItems(removed));
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: empty trash failed", err);
        }
      }
    });
  }

  // Restore all — non-destructive, so NO confirmation. Storage restores goals
  // before tasks so a task trashed alongside its goal returns under it.
  async function restoreAllDeleted() {
    if (!deletedBoxCount()) return;
    try {
      var restored = await Storage.restoreAllTrash(data);
      eagerRenderTasks();
      showToast("Restored " + pluralItems(restored));
    } catch (err) {
      console.error("[LaunchPad] Tasks tab: restore all failed", err);
    }
  }

  // Clear — soft-deletes the Completed box into the Deleted box (NOT permanent),
  // so it confirms honestly about the 30-day recovery window but isn't danger-
  // styled. Completed goals cascade their children, as a per-item goal delete does.
  function confirmClearCompleted() {
    var n = completedBoxCount();
    if (!n) return;
    openTasksConfirmModal({
      title: "Clear completed?",
      message: "Move all " + n + " completed " + (n === 1 ? "item" : "items") +
        " to Deleted? They stay recoverable for 30 days.",
      confirmLabel: "Move to Deleted",
      onConfirm: async function () {
        try {
          var cleared = await Storage.clearCompletedItems(data);
          eagerRenderTasks();
          showToast("Moved " + pluralItems(cleared) + " to Deleted");
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: clear completed failed", err);
        }
      }
    });
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
    // The panel.innerHTML below replaces the old scroll container with a
    // new one whose scrollTop starts at 0. overflow-anchor: none (added
    // in [1.0.11.16]) only addresses the in-place anchor heuristic; it does
    // nothing for full DOM replacement. Capture the current scroll position
    // from the OLD scroller before the rewrite, restore on the NEW one after.
    // [Tasks v3] The scroller is now .tasks-body (the fixed .tasks-header no
    // longer scrolls); pre-v3 this read .tasks-tab. Defensive: null-guard since
    // pre-first-render the panel has no .tasks-body yet.
    var prevScroller = panel.querySelector(".tasks-body");
    var savedScrollTop = prevScroller ? prevScroller.scrollTop : 0;

    // [Polish] Capture each goal's current progress-fill width so the freshly
    // rendered card can animate from the old value to the new one — a plain CSS
    // width transition can't fire on the recreated element. Mirrors savedScrollTop.
    var prevFillWidth = {};
    [].forEach.call(panel.querySelectorAll(".tt-goal-card"), function (card) {
      var gid = card.getAttribute("data-goal-id");
      var f = card.querySelector(".tt-progress-fill");
      if (gid && f && f.style.width) prevFillWidth[gid] = f.style.width;
    });

    var workspace = Storage.getActiveWorkspace(d);
    if (!workspace) {
      panel.innerHTML = '<div class="tasks-tab-empty">No active workspace.</div>';
      return;
    }

    // [Tasks] Opportunistic trash cleanup before the Deleted box renders
    // (trash-bin.md). [Trash] purgeExpiredTrash now sweeps ALL collections across
    // ALL workspaces (groups/bookmarks/goals/tasks/tags/recurring+goal
    // templates), but still SYNCHRONOUSLY (before its first await) and only writes
    // when it removed something — so this un-awaited call has already mutated the
    // active workspace's arrays by the time getDeleted*/getCompleted* read them
    // just below, and it does not amplify storage writes on the common no-op
    // render. The daily 'trash-purge' alarm (background.js) covers Chrome-open
    // overnight; this covers the moment the user opens Tasks.
    Storage.purgeExpiredTrash(d);

    // [1.0.14] Opportunistic recurring sweep on Tasks-tab render (D2). Mirrors
    // the purge pattern: runRecurringSweep mutates ws.tasks / template
    // nextScheduledAt SYNCHRONOUSLY before its internal awaited saveAll, so this
    // un-awaited call has already materialized any due instances by the time the
    // task lists are read below. It only writes when it generated something, and
    // is a cheap no-op once nextScheduledAt is in the future — so it's safe to
    // run on every render. The 03:00 alarm covers Chrome-open-overnight; this
    // covers Chrome-was-closed catch-up the moment the user opens Tasks.
    Storage.runRecurringSweep(d);

    var activeGoals = sortedByDisplayOrder(Storage.getActiveGoals(workspace));
    var completedGoals = sortedByDisplayOrder(Storage.getCompletedGoals(workspace));
    var deletedGoals = Storage.getDeletedGoals(workspace);
    var deletedTasks = Storage.getDeletedTasks(workspace);
    var allActiveTasks = Storage.getActiveTasks(workspace);
    var allCompletedTasks = Storage.getCompletedTasks(workspace);
    // Standalone = goalId === null. [1.0.14] D6: generated recurring INSTANCES
    // are ordinary tasks living in their goal/standalone lists — a standalone
    // instance (goalId null) belongs in Standalone like any task, and a
    // goal-bound instance appears under its goal (goalCardHtml already includes
    // it). The [1.0.10] defensive `!isRecurringInstance` exclusion is removed
    // now that instances exist; the RECURRING section lists TEMPLATES, not
    // instances. (Completed/trashed instances flow to the Completed/Deleted
    // boxes via standaloneCompleted / getDeletedTasks like any task.)
    var standaloneActive = sortedByDisplayOrder(allActiveTasks.filter(function (t) {
      return t.goalId === null;
    }));
    var standaloneCompleted = sortedByDisplayOrder(allCompletedTasks.filter(function (t) {
      return t.goalId === null;
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

    // [1.0.12] Standalone list: priority/tag filter + active sort on top of the
    // deletedAt + goalId===null base.
    var standaloneVisible = applyTaskFilterSort(standaloneActive);
    var standaloneHtml = standaloneVisible.length
      ? '<ul class="tt-standalone-list">' +
          standaloneVisible.map(function (t) { return taskRowHtml(workspace, t); }).join("") +
        '</ul>'
      : '<div class="tt-empty-state">' +
          (tasksFiltersNarrowing() && standaloneActive.length ? 'No standalone tasks match the current filter.' : 'No standalone tasks.') +
        '</div>';

    // [1.0.12] Recurring: tag filter only (templates carry no priority/status);
    // createdAt order preserved on the default sort, re-sorted otherwise.
    var recurringVisible = recurringTemplates.filter(recurringMatchesFilters);
    if (taskFilterState.sort !== "created") {
      recurringVisible = recurringVisible.slice().sort(taskSortComparator());
    }
    var recurringHtml = recurringVisible.length
      ? '<ul class="tt-recurring-list">' +
          recurringVisible.map(function (t) { return recurringRowHtml(workspace, t); }).join("") +
        '</ul>'
      : '<div class="tt-empty-state">' +
          (taskFilterState.tagIds.length && recurringTemplates.length ? 'No recurring tasks match the current filter.' : 'No recurring tasks.') +
        '</div>';

    // [1.0.12] Status drives ACTIVE-section visibility (locked interaction
    // model): 'completed' hides the active goals/standalone/recurring sections;
    // 'active'/'all' show them. The Completed + Deleted boxes at the bottom are
    // a persistent surface and render regardless of the status filter (see the
    // trash-row below) — the Completed box is the celebration move's always-
    // visible destination, so it must not be gated away in the default view.
    var showActiveSections = taskFilterState.status !== "completed";

    var activeGoalsSectionHtml = showActiveSections
      ? '<section class="tt-section" data-section="active-goals">' +
          '<h2 class="tt-section-title">Active Goals</h2>' +
          '<div class="tt-goal-list">' + activeGoalsHtml + '</div>' +
        '</section>'
      : '';
    var standaloneSectionHtml = showActiveSections
      ? '<section class="tt-section" data-section="standalone">' +
          '<h2 class="tt-section-title">Standalone</h2>' +
          standaloneHtml +
        '</section>'
      : '';
    var recurringSectionHtml = showActiveSections
      ? '<section class="tt-section" data-section="recurring">' +
          '<h2 class="tt-section-title">Recurring' +
            (recurringVisible.length ? ' <span class="tt-section-count">' + recurringVisible.length + '</span>' : '') +
          '</h2>' +
          recurringHtml +
        '</section>'
      : '';
    // [Tasks] Completed + Deleted boxes — two side-by-side boxes on one row
    // below Recurring, always rendered (the per-tab trash surface, DECISIONS
    // 2026-07-14). The Completed box is the celebration move animation's visible
    // destination; the Deleted box is the Tasks-tab trash with restore /
    // permanent-delete / 30-day countdowns.
    var trashRowHtml =
      '<div class="tt-trash-row">' +
        completedBoxHtml(workspace, completedGoals, standaloneCompleted) +
        deletedBoxHtml(workspace, deletedGoals, deletedTasks) +
      '</div>';

    panel.innerHTML =
      '<div class="tasks-tab" data-tab="tasks">' +
        tasksHeaderHtml() +
        '<div class="tasks-body">' +
          activeGoalsSectionHtml +
          standaloneSectionHtml +
          recurringSectionHtml +
          trashRowHtml +
        '</div>' +
      '</div>';

    bindTasksTabEvents(panel);
    bindTasksTabSortables(panel, d);
    // [2.0 pill clarity] Fill the per-task time slots. Two-phase and fire-and-
    // forget: the rows are already on screen, and the chips land a tick later
    // without re-rendering anything (a repaint here would fight inline rename).
    ttRefreshTaskTimes(panel);

    // [1.0.11.17] D4 v2 — restore scrollTop on the fresh scroller. If the
    // saved value exceeds the new scrollHeight (e.g., a tab with fewer items
    // after the change), the browser clamps automatically, which is the
    // desired behavior. [Tasks v3] scroller is now .tasks-body.
    var newScroller = panel.querySelector(".tasks-body");
    if (newScroller && savedScrollTop) {
      newScroller.scrollTop = savedScrollTop;
    }

    // [Polish] Animate each changed goal's progress fill from its previous width
    // to the new one. Set the old width with transitions off, then (after two
    // frames so the start value is committed) restore the CSS transition and set
    // the target — the fill's inner % reveal follows the width via overflow.
    var fillAnims = [];
    [].forEach.call(panel.querySelectorAll(".tt-goal-card"), function (card) {
      var gid = card.getAttribute("data-goal-id");
      var f = gid && card.querySelector(".tt-progress-fill");
      if (!f) return;
      var target = f.style.width;
      var prev = prevFillWidth[gid];
      if (prev != null && prev !== "" && prev !== target) {
        f.style.transition = "none";
        f.style.width = prev;
        fillAnims.push({ f: f, target: target });
      }
    });
    if (fillAnims.length) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          fillAnims.forEach(function (a) {
            a.f.style.transition = "";
            a.f.style.width = a.target;
          });
        });
      });
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

    // [Tasks v3] Close any open Tasks popover/context menu when the inner
    // scroll region (.tasks-body) scrolls. Those menus are body-mounted and
    // position:fixed (mountTasksPopover / openTaskContextMenu / openGoal
    // ContextMenu), so an overflow ancestor cannot clip them — but their
    // fixed position is computed once from the trigger's viewport rect, so on
    // inner scroll the trigger row moves out from under them. Closing (rather
    // than repositioning) matches the transient nature of these menus and the
    // existing outside-click/Escape dismissal. Bound once with capture:true
    // because scroll events do not bubble — the capture phase still delivers
    // the .tasks-body scroll to this panel-level listener, so it survives the
    // per-render innerHTML rewrite that recreates .tasks-body.
    panel.addEventListener("scroll", function () {
      closeGoalContextMenu();
    }, true);

    // [Tasks] Same rationale for the sidebar push-not-overlay: when the sidebar
    // expands/collapses on a Pro tab, #content's margin-left animates and the
    // content region reflows, so a body-mounted fixed popover/menu anchored to a
    // task row would drift. Close it when that margin transition starts. #content
    // is a stable element (never re-rendered), so this one-time listener lives
    // for the page. Filtered to margin-left so the compact-header padding
    // transition (which bubbles here) doesn't trigger it; closeGoalContextMenu is
    // a no-op when nothing is open.
    var contentEl = document.getElementById("content");
    if (contentEl && !contentEl.dataset.tasksReflowBound) {
      contentEl.dataset.tasksReflowBound = "1";
      contentEl.addEventListener("transitionstart", function (e) {
        if (e.propertyName === "margin-left") closeGoalContextMenu();
      });
    }

    panel.addEventListener("change", async function (e) {
      var target = e.target;
      if (!target || !target.classList) return;

      // [1.0.12] Status / Sort <select>s. Priority and Tag are popover buttons
      // (no change event) handled in the click listener below. Filter/sort
      // state is in-memory only — never persisted — then an eager re-render
      // reflows the sections/lists (the storage.onChanged path is not involved,
      // nothing is written).
      var filterSel = target.closest && target.closest("select.tasks-filter");
      if (filterSel) {
        var kind = filterSel.getAttribute("data-filter");
        if (kind === "status") {
          taskFilterState.status = filterSel.value;
          renderTasksTab(panel, data);
        } else if (kind === "sort") {
          taskFilterState.sort = filterSel.value;
          renderTasksTab(panel, data);
        }
        return;
      }

      // Task complete / reactivate via row checkbox.
      if (!target.classList.contains("tt-task-check")) return;
      var taskId = target.getAttribute("data-task-id");
      if (!taskId) return;
      var willComplete = target.checked;

      if (!willComplete) {
        // Reactivation path is unchanged: flip state + immediate settle render.
        try {
          await Storage.reactivateTask(data, taskId);
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: task reactivate failed", err);
        }
        renderTasksTab(panel, data);
        return;
      }

      // Completion runs the celebration flow (checkmark pop + in-place dwell +
      // destination-named settle). completeTask has already saved by the time
      // the animation runs; the settle re-render is deferred to the end so the
      // dwell is visible (and rapid completes don't clobber each other). Grab
      // the row NOW — the panel isn't re-rendered until the flow settles.
      var row = target.closest(".tt-task-row");
      var completeResult;
      try {
        completeResult = await Storage.completeTask(data, taskId);
      } catch (err) {
        console.error("[LaunchPad] Tasks tab: task complete failed", err);
        renderTasksTab(panel, data);
        return;
      }
      runTaskCompletionCelebration(panel, row, completeResult);
    });

    panel.addEventListener("click", async function (e) {
      var target = e.target;
      if (!target) return;

      // [1.0.12] Priority / Tag multi-select filter buttons → checkbox popover.
      var filterBtn = target.closest && target.closest(".tasks-filter-multi");
      if (filterBtn) {
        e.preventDefault();
        e.stopPropagation();
        openTaskFilterPopover(filterBtn, filterBtn.getAttribute("data-filter"));
        return;
      }

      // [1.0.12] Task-row priority pill → priority popover (set / change / clear).
      var prioPill = target.closest && target.closest(".tt-prio-pill");
      if (prioPill) {
        e.preventDefault();
        e.stopPropagation();
        var pillTaskId = prioPill.getAttribute("data-task-id");
        var current = prioPill.getAttribute("data-priority") || null;
        if (pillTaskId) openPriorityPillPopover(prioPill, pillTaskId, current);
        return;
      }

      // [1.0.13.1] Task-row due-date pill → due-date popover (set / change / clear).
      var duePill = target.closest && target.closest(".tt-due-pill");
      if (duePill) {
        e.preventDefault();
        e.stopPropagation();
        var dueTaskId = duePill.getAttribute("data-task-id");
        var currentYmd = duePill.getAttribute("data-due") || "";
        if (dueTaskId) openDueDatePillPopover(duePill, dueTaskId, currentYmd);
        return;
      }

      // [Tasks] Task-row trash → direct soft-delete + Undo toast (no confirm
      // modal), per trash-bin.md.
      var trashBtn = target.closest && target.closest(".tt-task-trash");
      if (trashBtn) {
        e.preventDefault();
        e.stopPropagation();
        var trashTaskId = trashBtn.getAttribute("data-task-id");
        if (trashTaskId) deleteTaskWithUndo(trashTaskId);
        return;
      }

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

      // [Polish] Completed-box row Restore button — visible hover action that
      // mirrors the Deleted box; calls the same reactivate path as right-click.
      var completedBtn = target.closest && target.closest(".tt-completed-btn");
      if (completedBtn) {
        e.preventDefault();
        e.stopPropagation();
        var completedRow = completedBtn.closest(".tt-completed-row");
        if (!completedRow) return;
        var cKind = completedRow.getAttribute("data-kind");
        var cId = completedRow.getAttribute("data-id");
        if (cId) reactivateCompletedItem(cKind, cId);
        return;
      }

      // [Tasks] Bottom-box HEADER bulk actions (Clear / Restore all / Empty).
      // Resolved before the per-row branches — these live in the box header, not
      // in a row, so the row lookups below would miss them anyway.
      var boxAction = target.closest && target.closest(".tt-box-action");
      if (boxAction) {
        e.preventDefault();
        e.stopPropagation();
        var bulk = boxAction.getAttribute("data-action");
        if (bulk === "clear-completed") confirmClearCompleted();
        else if (bulk === "restore-all") restoreAllDeleted();
        else if (bulk === "empty-trash") confirmEmptyTrash();
        return;
      }

      // [Tasks] Deleted-box row actions — Restore / Delete Permanently.
      var deletedBtn = target.closest && target.closest(".tt-deleted-btn");
      if (deletedBtn) {
        e.preventDefault();
        e.stopPropagation();
        var deletedRow = deletedBtn.closest(".tt-deleted-row");
        if (!deletedRow) return;
        var dKind = deletedRow.getAttribute("data-kind");
        var dId = deletedRow.getAttribute("data-id");
        var dName = (deletedRow.querySelector(".tt-deleted-name") || {}).textContent || "item";
        if (!dId) return;
        var dAction = deletedBtn.getAttribute("data-action");
        if (dAction === "restore-deleted") {
          restoreDeletedItem(dKind, dId);
        } else if (dAction === "purge-deleted") {
          confirmPurgeDeletedItem(dKind, dId, dName);
        }
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

      // [1.0.16] Play glyph — make this task active. Ahead of the name branch
      // below on purpose: the two affordances are adjacent and this one is a
      // <button>, so it must claim the click before any name-zone handling.
      var playBtn = target.closest && target.closest(".tt-task-play");
      if (playBtn) {
        // [Polish] Three-way route on the state the row was RENDERED in. Only
        // the active row carries pause/resume; every other row still activates,
        // so clicking a different row's glyph while one is active switches
        // activation exactly as before (satActivate no-ops on the same task).
        var playAction = playBtn.getAttribute("data-play-act") || "activate";
        if (playAction === "pause") { satSetPaused(true); return; }
        if (playAction === "resume") { satSetPaused(false); return; }
        var playId = playBtn.getAttribute("data-task-id");
        var playWs = Storage.getActiveWorkspace(data);
        if (playId && playWs) satActivate(playId, playWs.id);
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
        else if (action === "new-recurring") openRecurringModal(null);
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

    // Right-click on a task row or goal card opens the matching context menu.
    // The handler ignores events that originate inside a text input so native
    // browser context menus on inline-edit / add-task inputs continue to work.
    panel.addEventListener("contextmenu", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

      // [Tasks] Completed-box row → dedicated Reactivate menu. Checked first
      // because these rows live outside the goal-card/task-row DOM the branches
      // below resolve against.
      var completedRow = e.target && e.target.closest && e.target.closest(".tt-completed-row");
      if (completedRow) {
        var cKind = completedRow.getAttribute("data-kind");
        var cId = completedRow.getAttribute("data-id");
        if (!cId) return;
        e.preventDefault();
        openCompletedContextMenu(e.clientX, e.clientY, cKind, cId);
        return;
      }

      // [1.0.14] RECURRING template row → template management menu (edit /
      // pause / delete). Templates are not tasks, so resolve before the task/
      // goal branches.
      var recurringRow = e.target && e.target.closest && e.target.closest(".tt-recurring-row");
      if (recurringRow) {
        var templateId = recurringRow.getAttribute("data-template-id");
        if (!templateId) return;
        e.preventDefault();
        openRecurringContextMenu(e.clientX, e.clientY, templateId);
        return;
      }

      // Task row MUST be resolved before the goal card. A .tt-task-row LI is
      // nested inside its parent .tt-goal-card, so a bare closest(".tt-goal-card")
      // walks up from the clicked task to the goal and opens the goal menu with
      // the goal's id — the reported bug (Delete on a task said "Delete goal").
      // Checking the task row first binds the menu to the clicked task instead.
      var taskRow = e.target && e.target.closest && e.target.closest(".tt-task-row");
      if (taskRow) {
        // Rows inside a completed (read-only) goal card defer to the native
        // menu, mirroring the is-completed rule for goal cards below.
        var ownerCard = taskRow.closest(".tt-goal-card");
        if (ownerCard && ownerCard.classList.contains("is-completed")) return;
        var taskId = taskRow.getAttribute("data-task-id");
        if (!taskId) return;
        e.preventDefault();
        openTaskContextMenu(e.clientX, e.clientY, taskId);
        return;
      }

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
    // Completed cards (.tt-goal-card.is-completed) are excluded — read-only by
    // design; their task rows render in goalCardHtml but no Sortable binds to
    // them. The Completed/Deleted boxes are compact lists with no Sortable.
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
    // .tt-active-goals-section → the scroller) was not reliably picked up
    // during D8 verification — auto-scroll near the viewport edge did not
    // fire. Passing the scroll element directly bypasses detection.
    // [Tasks v3] The scroller is now .tasks-body (was .tasks-tab pre-v3).
    var scrollContainerEl = panel.querySelector(".tasks-body");

    taskListEls.forEach(function (taskListEl) {
      var s = new Sortable(taskListEl, {
        animation: 150,
        // Symmetric pull/put across all task lists in the panel — supports
        // goal↔goal, goal↔standalone, and within-list reorder. The string
        // form `group: "tasks"` would also work (default pull/put true) but
        // the object form documents intent at the call site.
        group: { name: "tasks", pull: true, put: true },
        draggable: ".tt-task-row",
        // [1.0.11.18] Drag is initiated ONLY from the explicit grab handle
        // (.tt-task-handle) prepended to every .tt-task-row by taskRowHtml.
        // The previous filter approach (".tt-task-check, .tt-task-empty"
        // with preventOnFilter: false) made the entire row draggable except
        // those two surfaces; this was awkward in practice — the row body
        // is also the editable task name, so click-and-drag on the name
        // conflated drag-init with edit-init. The empty-state placeholder
        // .tt-task-empty is a different <li> class anyway and is naturally
        // excluded by draggable: ".tt-task-row", so no extra filter is
        // needed.
        handle: ".tt-task-handle",
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

    // [1.0.14] Item 6 — dragging a recurring INSTANCE into a GOAL asks whether
    // to move the whole template (future instances bind to the goal) or just
    // this occurrence, then applies the [1.0.13] hierarchy check on the
    // instance's date. Gated on isRecurringInstance so ordinary task drags fall
    // straight through to the shipped collision logic below, unchanged.
    if (task.isRecurringInstance && targetGoalId !== null) {
      handleRecurringInstanceDrop(evt, taskId, task, targetGoalId, toList, fromList);
      return;
    }

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

  // [1.0.14] Item 6 — recurring instance dragged into a goal. Offers "move the
  // template into this goal" (sets template.goalId → future instances bind here)
  // vs "move just this instance", then runs the [1.0.13] hierarchy check on the
  // instance's date against the new parent goal. Cancel/dismiss reverts the DOM.
  // Collision handling is intentionally the simple revert-on-throw path (not the
  // full rename modal) — recurring instances share the template name, and the
  // reviewer live-pass covers the interaction (Section I).
  function handleRecurringInstanceDrop(evt, taskId, task, targetGoalId, toList, fromList) {
    var templateId = task.recurringTemplateId;

    async function apply(moveTemplate) {
      try {
        if (moveTemplate && templateId) {
          await Storage.updateRecurringTemplate(data, templateId, { goalId: targetGoalId });
        }
        await Storage.reassignTaskToGoal(data, taskId, targetGoalId);
        rebuildTaskDisplayOrderFromList(toList, data);
        rebuildTaskDisplayOrderFromList(fromList, data);
        await Storage.saveAll(data);
        var panel = document.getElementById("tab-tasks");
        if (panel) renderTasksTab(panel, data);
        // [1.0.13] hierarchy check on the instance's own date vs the new goal.
        // Fires the resolution modal (extend goal / clamp instance) — the
        // interactive path DOES apply the hierarchy rule (unlike generation, D5).
        // Deferred to a macrotask so the move modal's own closeTasksModal (which
        // runs right after this onPrimary/onClick resolves) can't immediately
        // close the conflict modal we just opened.
        var conflict = Storage.checkTaskDueConflict(data, taskId, task.dueAt);
        if (conflict && conflict.conflict) {
          setTimeout(function () { openTaskDueConflictModal(taskId, conflict); }, 0);
        }
      } catch (err) {
        console.error("[LaunchPad] Tasks: recurring instance drop failed", err);
        revertSortableDrop(evt);
      }
    }

    openTasksModal({
      title: "Move recurring task",
      bodyHtml: '<p class="tt-modal-message">This is an instance of a recurring task. ' +
        'Move the whole template into this goal (future instances will belong to it), ' +
        'or move just this occurrence?</p>',
      primaryLabel: "Move just this instance",
      defaultFocus: "primary",
      onPrimary: async function () { await apply(false); },
      extraButtons: [{
        label: "Move the template into this goal",
        onClick: async function () { await apply(true); }
      }],
      // onCancel covers the Cancel button, backdrop click, AND Escape.
      onCancel: function () { revertSortableDrop(evt); }
    });
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
    // [1.0.13.1] Backward-compatible extra footer buttons. When opts.extraButtons
    // is absent, footerCls and extraButtonsHtml are empty and the default
    // Cancel + primary footer is byte-for-byte unchanged. Each entry:
    // { label, className?, onClick(overlay) } — onClick returning false keeps
    // the modal open (mirrors onPrimary's contract). Extras render between
    // Cancel and primary; the footer wraps when they are present so long
    // hierarchy-modal labels don't overflow.
    var extraButtons = Array.isArray(opts.extraButtons) ? opts.extraButtons : [];
    var extraButtonsHtml = extraButtons.map(function (b, i) {
      var cls = b.className || "tt-modal-btn";
      return '<button type="button" class="' + cls + ' tt-modal-extra" data-extra-index="' + i + '">' + escapeHtml(b.label || "") + '</button>';
    }).join("");
    var footerCls = "tt-modal-footer" + (extraButtons.length ? " tt-modal-footer-wrap" : "");
    overlay.innerHTML =
      '<div class="tt-modal" role="dialog" aria-modal="true">' +
        '<header class="tt-modal-header">' +
          titleHtml +
          '<button type="button" class="tt-modal-close" aria-label="Close">&times;</button>' +
        '</header>' +
        '<div class="tt-modal-body">' + (opts.bodyHtml || "") + '</div>' +
        '<footer class="' + footerCls + '">' +
          '<button type="button" class="tt-modal-btn tt-modal-cancel">Cancel</button>' +
          extraButtonsHtml +
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

    // [1.0.13.1] Wire extra footer buttons. No-op when extraButtons is empty.
    extraButtons.forEach(function (b, i) {
      var el = overlay.querySelector('.tt-modal-extra[data-extra-index="' + i + '"]');
      if (!el) return;
      el.addEventListener("click", async function () {
        if (typeof b.onClick === "function") {
          var r = await b.onClick(overlay);
          if (r === false) return;
        }
        closeTasksModal();
      });
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
    // [1.0.15] D3 — instantiation entry point. Populate the "From template"
    // select with the workspace's active goal templates; picking one prefills
    // the name (still editable) and, on Create, instantiates instead of a blank
    // goal. Disabled with an empty-state option when no templates exist.
    var templateBlock = "";
    if (!isEdit) {
      var tplWs = Storage.getActiveWorkspace(data);
      var tpls = tplWs ? Storage.getActiveGoalTemplates(tplWs).slice().sort(function (a, b) {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }) : [];
      var tplOptions = tpls.length
        ? '<option value="">— None (blank goal) —</option>' +
            tpls.map(function (t) { return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.name) + '</option>'; }).join("")
        : '<option value="">No templates yet</option>';
      templateBlock =
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-goal-template-select">From template</label>' +
          '<select id="tt-goal-template-select" class="tt-goal-template"' + (tpls.length ? "" : " disabled") + '>' +
            tplOptions +
          '</select>' +
        '</div>';
    }

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
          // [Polish] Read-only computed deadline shown (instead of the date input)
          // while a template is selected — its deadline comes from the offset.
          '<div class="tt-goal-deadline-computed hidden" aria-live="polite"></div>' +
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
        // [1.0.15] Template pick → prefill the (still-editable) name. [Polish]
        // Deadline handling depends on whether the template OWNS a deadline:
        //   - offset present → the template's date wins, so show it read-only in
        //     human phrasing ("20 Jul 2026 · set by this template");
        //   - offset null → the template doesn't define a deadline, so leave the
        //     ordinary editable date input (identical to blank-goal creation) —
        //     no lock, no message;
        //   - selection cleared → also the ordinary editable input.
        var tplSelect = overlay.querySelector(".tt-goal-template");
        var deadlineInput = overlay.querySelector(".tt-goal-deadline-input");
        var deadlineComputed = overlay.querySelector(".tt-goal-deadline-computed");

        // "20 Jul 2026" from a whole-day offset off today (UTC calendar day) —
        // the exact UTC-midnight date instantiation will set.
        var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        function templateDeadlineLabel(offsetDays) {
          var now = new Date();
          var dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offsetDays * 86400000);
          return dt.getUTCDate() + " " + MONTHS[dt.getUTCMonth()] + " " + dt.getUTCFullYear() + " · set by this template";
        }
        function showEditableDeadline() {
          deadlineComputed.classList.add("hidden");
          deadlineComputed.textContent = "";
          deadlineInput.classList.remove("hidden");
        }

        if (tplSelect && !tplSelect.disabled && deadlineInput && deadlineComputed) {
          tplSelect.addEventListener("change", function () {
            var ws2 = Storage.getActiveWorkspace(data);
            var tpl = tplSelect.value && ws2 ? Storage.getGoalTemplateById(ws2, tplSelect.value) : null;
            if (tpl) nameInput.value = tpl.name;
            if (tpl && typeof tpl.deadlineOffsetDays === "number") {
              // Template owns the deadline → read-only computed date.
              deadlineComputed.textContent = templateDeadlineLabel(tpl.deadlineOffsetDays);
              deadlineInput.classList.add("hidden");
              deadlineComputed.classList.remove("hidden");
            } else {
              // No template, or template without an offset → ordinary date input.
              showEditableDeadline();
            }
          });
        }
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
          // [1.0.13] Due-date hierarchy: block moving the deadline earlier than
          // the latest due date among live, incomplete, dated child tasks. Only
          // check when the deadline actually changed — rename-only / unchanged-
          // deadline submits keep prior behavior. On block, commit NOTHING (no
          // rename, no deadline) and keep this modal open via an inline error.
          // (The block uses an inline error rather than a 1-button acknowledge
          // modal because openTasksModal is single-instance and can't stack a
          // second modal over this open edit-goal modal.)
          if (deadlineAt !== existingGoal.deadlineAt) {
            var dl = Storage.checkGoalDeadlineConflict(data, existingGoal.id, deadlineAt);
            if (dl.blocked) {
              showModalError(errorEl, dl.blockingTaskName + " is due " + fmtShortDateUTC(dl.blockingDueAt) + " — can't set goal deadline before that. Update the task first or pick a later deadline.");
              return false;
            }
          }
          var renamed = await Storage.renameGoal(data, existingGoal.id, name);
          if (!renamed) { showModalError(errorEl, "Could not rename goal."); return false; }
          await Storage.updateGoalDeadline(data, existingGoal.id, deadlineAt);
        } else {
          var tplSel = overlay.querySelector(".tt-goal-template");
          var templateId = tplSel && !tplSel.disabled ? tplSel.value : "";
          if (templateId) {
            // [1.0.15] D3 — instantiate: goal + auto-tag + child tasks, one
            // saveAll. Name may be user-edited. [Polish] Pass the editable
            // deadline; Storage applies it ONLY when the template has no offset
            // (an offset always wins), so for an offset template the hidden
            // input's value is ignored.
            var inst = await Storage.instantiateGoalTemplate(data, templateId, {
              name: name,
              deadlineAt: deadlineAt,
              autoCreateTag: !!(autoTagInput && autoTagInput.checked)
            });
            if (!inst) { showModalError(errorEl, "Could not create goal from template."); return false; }
          } else {
            var fields = { name: name, deadlineAt: deadlineAt, autoCreateTag: !!(autoTagInput && autoTagInput.checked) };
            var created = await Storage.createGoal(data, fields);
            if (!created) { showModalError(errorEl, "Could not create goal."); return false; }
          }
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
  // [1.0.14] Recurring template modal — shared create + edit. `existing` null →
  // create; a template object → edit (prefilled; commits via
  // updateRecurringTemplate). D7: on an EDIT that changes the pattern, we also
  // recompute nextScheduledAt so FUTURE instances follow the new pattern;
  // already-generated instances are ordinary tasks and stay untouched.
  function openRecurringModal(existing) {
    var isEdit = !!existing;
    var DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var DOW_VALUES = [1, 2, 3, 4, 5, 6, 0];

    function conditionalHtml(frequency) {
      if (frequency === "weekly") {
        var pre = (isEdit && Array.isArray(existing.daysOfWeek)) ? existing.daysOfWeek : [];
        var togglesHtml = DOW_LABELS.map(function (label, i) {
          var chk = pre.indexOf(DOW_VALUES[i]) !== -1 ? " checked" : "";
          return '<label class="tt-modal-dow-toggle">' +
            '<input type="checkbox" class="tt-recur-dow" value="' + DOW_VALUES[i] + '"' + chk + '>' +
            '<span>' + label + '</span>' +
          '</label>';
        }).join("");
        return '<div class="tt-modal-row">' +
            '<label class="tt-modal-label">Days of week</label>' +
            '<div class="tt-modal-dow-row">' + togglesHtml + '</div>' +
          '</div>';
      }
      if (frequency === "monthly") {
        var domVal = (isEdit && typeof existing.dayOfMonth === "number") ? existing.dayOfMonth : 1;
        return '<div class="tt-modal-row">' +
            '<label class="tt-modal-label" for="tt-recur-dom-input">Day of month</label>' +
            '<input type="number" id="tt-recur-dom-input" class="tt-recur-dom-input" min="1" max="31" value="' + domVal + '">' +
          '</div>';
      }
      return "";
    }

    var initFreq = isEdit ? existing.frequency : "daily";
    function freqOption(v, label) {
      return '<option value="' + v + '"' + (initFreq === v ? " selected" : "") + '>' + label + '</option>';
    }

    openTasksModal({
      title: isEdit ? "Edit recurring task" : "New recurring task",
      primaryLabel: isEdit ? "Save" : "Create",
      bodyHtml:
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-recur-name-input">Name</label>' +
          '<input type="text" id="tt-recur-name-input" class="tt-recur-name-input" maxlength="200" placeholder="Recurring task name" autocomplete="off" spellcheck="false" value="' + (isEdit ? escapeHtml(existing.name) : "") + '">' +
        '</div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-recur-freq-select">Frequency</label>' +
          '<select id="tt-recur-freq-select" class="tt-recur-freq-select">' +
            freqOption("daily", "Daily") + freqOption("weekly", "Weekly") + freqOption("monthly", "Monthly") +
          '</select>' +
        '</div>' +
        '<div class="tt-recur-conditional"></div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-recur-time-input">Time of day</label>' +
          '<input type="time" id="tt-recur-time-input" class="tt-recur-time-input" value="' + (isEdit ? escapeHtml(existing.timeOfDay || "09:00") : "09:00") + '">' +
        '</div>' +
        '<label class="tt-modal-row tt-modal-checkbox-row">' +
          '<input type="checkbox" class="tt-recur-active"' + ((!isEdit || existing.isActive) ? " checked" : "") + '>' +
          '<span>Active</span>' +
        '</label>' +
        '<div class="tt-modal-error hidden" role="alert"></div>',
      onMounted: function (overlay) {
        var freqSelect = overlay.querySelector(".tt-recur-freq-select");
        var conditional = overlay.querySelector(".tt-recur-conditional");
        conditional.innerHTML = conditionalHtml(initFreq);
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
          isActive: !!activeInput.checked
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

        var result;
        if (isEdit) {
          // D7: recompute nextScheduledAt only when the pattern actually changed,
          // so future instances follow the new pattern; a rename / time / active
          // toggle leaves the existing schedule intact.
          var patternChanged =
            frequency !== existing.frequency ||
            JSON.stringify(fields.daysOfWeek || null) !== JSON.stringify(existing.daysOfWeek || null) ||
            (fields.dayOfMonth || null) !== (existing.dayOfMonth || null);
          if (patternChanged) {
            fields.nextScheduledAt = Storage.nextRecurrenceUTC(
              { frequency: frequency, daysOfWeek: fields.daysOfWeek || null, dayOfMonth: fields.dayOfMonth || null },
              Date.now(), true
            );
          }
          result = await Storage.updateRecurringTemplate(data, existing.id, fields);
        } else {
          fields.tagIds = [];
          result = await Storage.createRecurringTemplate(data, fields);
        }
        if (!result || (result && result.err)) {
          showModalError(errorEl, (result && result.message) ||
            (isEdit ? "Could not save recurring task." : "Could not create recurring task."));
          return false;
        }
        var panel = document.getElementById("tab-tasks");
        if (panel) renderTasksTab(panel, data);
      }
    });
  }

  // ----- Templates panel (stub) -----
  // [1.0.15] Goal templates management panel (the Tasks-banner "Templates"
  // link). Lists the workspace's goal templates with hover Edit / Duplicate /
  // Delete and a "New template" button; Edit/New open the editor modal (which
  // reopens this panel on close). Duplicate/Delete act in place and re-render
  // the list. Soft-delete, no confirm (consistent with task delete), Undo toast.
  var GOAL_TPL_PRIORITIES = [["", "None"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["urgent", "Urgent"]];

  function goalTemplateOffsetSummary(tpl) {
    if (tpl.deadlineOffsetDays == null) return "no deadline";
    var d = tpl.deadlineOffsetDays;
    return d === 0 ? "due same day" : "due +" + d + " day" + (d === 1 ? "" : "s");
  }

  function goalTemplateListHtml(workspace) {
    var tpls = (workspace ? Storage.getActiveGoalTemplates(workspace) : []).slice().sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    if (!tpls.length) {
      return '<div class="tt-templates-empty">' +
          '<div class="tt-templates-empty-title">No templates yet</div>' +
          '<div class="tt-templates-empty-sub">Right-click an active goal → “Save as template”, or create one below.</div>' +
        '</div>';
    }
    return '<ul class="tt-tpl-list">' + tpls.map(function (tpl) {
      var n = Array.isArray(tpl.taskList) ? tpl.taskList.length : 0;
      return '<li class="tt-tpl-row" data-template-id="' + escapeHtml(tpl.id) + '">' +
          '<div class="tt-tpl-row-main">' +
            '<span class="tt-tpl-name" title="' + escapeHtml(tpl.name) + '">' + escapeHtml(tpl.name) + '</span>' +
            '<span class="tt-tpl-meta">' + n + ' task' + (n === 1 ? "" : "s") + ' · ' + escapeHtml(goalTemplateOffsetSummary(tpl)) + '</span>' +
          '</div>' +
          '<span class="tt-tpl-actions">' +
            '<button type="button" class="tt-tpl-btn" data-action="edit">Edit</button>' +
            '<button type="button" class="tt-tpl-btn" data-action="duplicate">Duplicate</button>' +
            '<button type="button" class="tt-tpl-btn tt-tpl-btn-danger" data-action="delete">Delete</button>' +
          '</span>' +
        '</li>';
    }).join("") + '</ul>';
  }

  function templatesPanelBodyHtml(workspace) {
    return '<div class="tt-tpl-panel-body">' +
        goalTemplateListHtml(workspace) +
        '<button type="button" class="tt-tpl-new-btn">+ New template</button>' +
      '</div>';
  }

  function refreshTemplatesPanel(overlay) {
    var body = overlay.querySelector(".tt-tpl-panel-body");
    if (body) body.innerHTML = "";
    var fresh = templatesPanelBodyHtml(Storage.getActiveWorkspace(data));
    // Replace the whole body region's inner HTML (list + button).
    var wrapper = overlay.querySelector(".tt-modal-body");
    if (wrapper) wrapper.innerHTML = fresh;
  }

  function openTemplatesPanel() {
    var overlay = openTasksModal({
      title: "Goal templates",
      bodyHtml: templatesPanelBodyHtml(Storage.getActiveWorkspace(data)),
      primaryLabel: "Close",
      defaultFocus: "primary",
      onMounted: function (ov) {
        // Delegated on the modal body so it survives in-place list re-renders.
        var body = ov.querySelector(".tt-modal-body");
        if (!body) return;
        body.addEventListener("click", async function (e) {
          var newBtn = e.target.closest && e.target.closest(".tt-tpl-new-btn");
          if (newBtn) {
            // Defer so this panel's close (from the editor's openTasksModal)
            // doesn't race the editor opening.
            openGoalTemplateEditModal(null);
            return;
          }
          var actionBtn = e.target.closest && e.target.closest(".tt-tpl-btn");
          if (!actionBtn) return;
          var row = actionBtn.closest(".tt-tpl-row");
          if (!row) return;
          var templateId = row.getAttribute("data-template-id");
          var action = actionBtn.getAttribute("data-action");
          var ws = Storage.getActiveWorkspace(data);
          var tpl = ws && Storage.getGoalTemplateById(ws, templateId);
          if (!tpl) return;
          if (action === "edit") {
            openGoalTemplateEditModal(tpl);
          } else if (action === "duplicate") {
            await Storage.duplicateGoalTemplate(data, templateId);
            refreshTemplatesPanel(ov);
          } else if (action === "delete") {
            await Storage.deleteGoalTemplate(data, templateId);
            refreshTemplatesPanel(ov);
            showUndoToast('Template "' + tpl.name + '" deleted.', async function () {
              // Restore = clear deletedAt (no dedicated restore fn; templates
              // have no Deleted-box surface in v1).
              var ws2 = Storage.getActiveWorkspace(data);
              var arr = ws2 && ws2.goalTemplates;
              var t = Array.isArray(arr) ? arr.find(function (x) { return x.id === templateId; }) : null;
              if (t) { t.deletedAt = null; await Storage.saveAll(data); }
              // Reopen the panel to reflect the restore (it may have been closed).
              openTemplatesPanel();
            }, 5000);
          }
        });
      }
    });
    return overlay;
  }

  // [1.0.15] Goal-template editor — shared New/Edit. Fields: name, description,
  // deadline offset (days; blank = no deadline), and a task-list editor (name +
  // priority rows, add/remove, SortableJS reorder). Saving reopens the panel.
  function openGoalTemplateEditModal(existing) {
    var isEdit = !!existing;

    function priorityOptions(sel) {
      return GOAL_TPL_PRIORITIES.map(function (p) {
        return '<option value="' + p[0] + '"' + (sel === p[0] ? " selected" : "") + '>' + p[1] + '</option>';
      }).join("");
    }
    function taskRowHtml(name, priority) {
      return '<li class="tt-tpl-task-row">' +
          '<span class="tt-tpl-task-handle" aria-hidden="true" title="Drag to reorder">⠇</span>' +
          '<input type="text" class="tt-tpl-task-name" maxlength="200" placeholder="Task name" value="' + escapeHtml(name || "") + '">' +
          '<select class="tt-tpl-task-priority">' + priorityOptions(priority || "") + '</select>' +
          '<button type="button" class="tt-tpl-task-remove" aria-label="Remove task">×</button>' +
        '</li>';
    }

    var initTasks = (isEdit && Array.isArray(existing.taskList)) ? existing.taskList : [];
    var offsetVal = (isEdit && typeof existing.deadlineOffsetDays === "number") ? existing.deadlineOffsetDays : "";

    var reopen = function () { setTimeout(openTemplatesPanel, 0); };

    openTasksModal({
      title: isEdit ? "Edit template" : "New template",
      primaryLabel: isEdit ? "Save" : "Create",
      bodyHtml:
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-tpl-name">Name</label>' +
          '<input type="text" id="tt-tpl-name" class="tt-tpl-name-input" maxlength="200" placeholder="Template name" autocomplete="off" spellcheck="false" value="' + (isEdit ? escapeHtml(existing.name) : "") + '">' +
        '</div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-tpl-desc">Description</label>' +
          '<input type="text" id="tt-tpl-desc" class="tt-tpl-desc-input" maxlength="500" placeholder="Optional" autocomplete="off" value="' + (isEdit ? escapeHtml(existing.description || "") : "") + '">' +
        '</div>' +
        '<div class="tt-modal-row">' +
          '<label class="tt-modal-label" for="tt-tpl-offset">Deadline (days from creation)</label>' +
          '<input type="number" id="tt-tpl-offset" class="tt-tpl-offset-input" min="0" step="1" placeholder="none" value="' + offsetVal + '">' +
        '</div>' +
        '<div class="tt-tpl-tasks-editor">' +
          '<label class="tt-modal-label">Tasks</label>' +
          '<ul class="tt-tpl-task-list">' + initTasks.map(function (t) { return taskRowHtml(t.name, t.priority); }).join("") + '</ul>' +
          '<button type="button" class="tt-tpl-add-task">+ Add task</button>' +
        '</div>' +
        '<div class="tt-modal-error hidden" role="alert"></div>',
      onMounted: function (overlay) {
        var listEl = overlay.querySelector(".tt-tpl-task-list");
        var addBtn = overlay.querySelector(".tt-tpl-add-task");
        addBtn.addEventListener("click", function () {
          listEl.insertAdjacentHTML("beforeend", taskRowHtml("", ""));
          var last = listEl.lastElementChild;
          var inp = last && last.querySelector(".tt-tpl-task-name");
          if (inp) inp.focus();
        });
        listEl.addEventListener("click", function (e) {
          var rm = e.target.closest && e.target.closest(".tt-tpl-task-remove");
          if (rm) { var row = rm.closest(".tt-tpl-task-row"); if (row) row.remove(); }
        });
        if (typeof Sortable !== "undefined") {
          new Sortable(listEl, {
            handle: ".tt-tpl-task-handle",
            draggable: ".tt-tpl-task-row",
            animation: 150,
            ghostClass: "sortable-ghost",
            chosenClass: "sortable-chosen",
            dragClass: "sortable-drag"
          });
        }
      },
      onPrimary: async function (overlay) {
        var errorEl = overlay.querySelector(".tt-modal-error");
        var name = (overlay.querySelector(".tt-tpl-name-input").value || "").trim();
        if (!name) { showModalError(errorEl, "Name is required."); return false; }
        var description = overlay.querySelector(".tt-tpl-desc-input").value || "";
        var offsetRaw = overlay.querySelector(".tt-tpl-offset-input").value;
        var offset = null;
        if (offsetRaw !== "" && offsetRaw != null) {
          var parsed = parseInt(offsetRaw, 10);
          if (isNaN(parsed) || parsed < 0) { showModalError(errorEl, "Deadline days must be 0 or more (blank for none)."); return false; }
          offset = parsed;
        }
        var taskList = [].slice.call(overlay.querySelectorAll(".tt-tpl-task-row")).map(function (row) {
          return {
            name: (row.querySelector(".tt-tpl-task-name").value || "").trim(),
            priority: row.querySelector(".tt-tpl-task-priority").value || null
          };
        }).filter(function (t) { return t.name; });

        var result;
        if (isEdit) {
          result = await Storage.renameGoalTemplate(data, existing.id, name);
          if (result) {
            await Storage.updateGoalTemplateDescription(data, existing.id, description);
            await Storage.updateGoalTemplateOffset(data, existing.id, offset);
            await Storage.updateGoalTemplateTaskList(data, existing.id, taskList);
          }
        } else {
          result = await Storage.createGoalTemplate(data, {
            name: name, description: description, deadlineOffsetDays: offset, taskList: taskList
          });
        }
        if (!result) { showModalError(errorEl, "Could not save template."); return false; }
        reopen();
      },
      onCancel: reopen
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

  // [Polish] Non-interactive header that names the entity a Tasks-tab context
  // menu targets ("Goal: …" / "Task: …"). Muted; name truncated to ~24 chars
  // (+ ellipsis; the full name shows in the title tooltip). Emits the header
  // plus the existing separator so it sits above the actions. Not a
  // .tt-ctx-item, so the menu's click handler ignores it (non-interactive).
  function ctxEntityHeaderHtml(prefix, name) {
    var full = String(name == null ? "" : name);
    var shown = full.length > 24 ? full.slice(0, 24) + "…" : full;
    return '<div class="tt-ctx-header" title="' + escapeHtml(full) + '">' +
        escapeHtml(prefix + ": " + shown) +
      '</div>' +
      '<div class="tt-ctx-separator"></div>';
  }

  // [Tasks] Completed-box row context menu — a single Reactivate action for a
  // completed goal or task. Reuses the shared tasks-menu lifecycle (single
  // instance via closeGoalContextMenu, viewport-guarded position, outside-click
  // + Escape dismissal). reactivateTask/reactivateGoal flip the item back to
  // active (and auto-reactivate a parent goal / greys undone), then re-render.
  function openCompletedContextMenu(x, y, kind, id) {
    closeGoalContextMenu();
    if (!id) return;
    var workspace = Storage.getActiveWorkspace(data);
    var name = "";
    if (kind === "goal") {
      var g = workspace && Storage.getGoalById(workspace, id);
      name = g ? g.name : "";
    } else {
      var t = workspace && Storage.getTaskById(workspace, id);
      name = t ? t.name : "";
    }
    var menu = document.createElement("div");
    menu.className = "tt-context-menu";
    menu.innerHTML =
      ctxEntityHeaderHtml(kind === "goal" ? "Goal" : "Task", name) +
      '<button type="button" class="tt-ctx-item" data-action="reactivate">Reactivate</button>';
    document.body.appendChild(menu);

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
      closeGoalContextMenu();
      try {
        if (kind === "goal") await Storage.reactivateGoal(data, id);
        else await Storage.reactivateTask(data, id);
      } catch (err) {
        console.error("[LaunchPad] Tasks tab: reactivate from Completed failed", err);
      }
      var panel = document.getElementById("tab-tasks");
      if (panel) renderTasksTab(panel, data);
    });

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

  // [1.0.14] RECURRING template management menu (D7): Edit, Pause/Activate,
  // Delete. Edits affect future instances only; deleting soft-deletes the
  // template and leaves already-generated instances as ordinary tasks.
  function openRecurringContextMenu(x, y, templateId) {
    closeGoalContextMenu();
    if (!templateId) return;
    var workspace = Storage.getActiveWorkspace(data);
    var tpl = workspace && Storage.getRecurringTemplateById(workspace, templateId);
    if (!tpl) return;
    var menu = document.createElement("div");
    menu.className = "tt-context-menu";
    menu.innerHTML =
      ctxEntityHeaderHtml("Recurring", tpl.name) +
      '<button type="button" class="tt-ctx-item" data-action="edit">Edit</button>' +
      '<button type="button" class="tt-ctx-item" data-action="toggle-active">' + (tpl.isActive ? "Pause" : "Activate") + '</button>' +
      '<div class="tt-ctx-separator"></div>' +
      '<button type="button" class="tt-ctx-item tt-ctx-danger" data-action="delete">Delete</button>';
    document.body.appendChild(menu);

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
      var ws2 = Storage.getActiveWorkspace(data);
      var live = ws2 && Storage.getRecurringTemplateById(ws2, templateId);
      if (!live) return;
      var panel = document.getElementById("tab-tasks");
      if (action === "edit") {
        openRecurringModal(live);
      } else if (action === "toggle-active") {
        try {
          await Storage.updateRecurringTemplate(data, templateId, { isActive: !live.isActive });
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: toggle recurring active failed", err);
        }
        if (panel) renderTasksTab(panel, data);
      } else if (action === "delete") {
        try {
          await Storage.deleteRecurringTemplate(data, templateId);
        } catch (err2) {
          console.error("[LaunchPad] Tasks tab: delete recurring template failed", err2);
        }
        if (panel) renderTasksTab(panel, data);
        showToast("Recurring task deleted — existing instances kept");
      }
    });

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

  function openGoalContextMenu(x, y, goalId) {
    closeGoalContextMenu();
    if (!goalId) return;
    var headerWorkspace = Storage.getActiveWorkspace(data);
    var headerGoal = headerWorkspace && Storage.getGoalById(headerWorkspace, goalId);
    var menu = document.createElement("div");
    menu.className = "tt-context-menu";
    menu.innerHTML =
      ctxEntityHeaderHtml("Goal", headerGoal ? headerGoal.name : "") +
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
        // [1.0.15] D2 — capture name/description/deadline-offset + all live child
        // tasks (name+priority) as a reusable goal template.
        try {
          var savedTpl = await Storage.saveGoalAsTemplate(data, goalId);
          showToast(savedTpl ? 'Saved "' + goal.name + '" as a template' : "Could not save template");
        } catch (err) {
          console.error("[LaunchPad] Tasks: saveGoalAsTemplate failed", err);
        }
      } else if (action === "complete") {
        await Storage.completeGoal(data, goalId);
        if (panel) renderTasksTab(panel, data);
        celebrateGoalCompletion(goalId);   // [1.0.24 item 3] immediate, in place
        renderInsightsPanelEager();         // [1.0.22 D10] Goal Crusher may have unlocked
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

  // Task-row context menu. Mirrors openGoalContextMenu's lifecycle (single
  // instance via closeGoalContextMenu, viewport-guarded positioning, outside-
  // click + Escape dismissal) but every action is bound to the clicked TASK's
  // id. Actions use existing Storage task CRUD; none touch goal records. The
  // complete/reactivate label reflects the task's current completion state.
  function openTaskContextMenu(x, y, taskId) {
    closeGoalContextMenu();
    if (!taskId) return;
    var workspace = Storage.getActiveWorkspace(data);
    var task = workspace && Storage.getTaskById(workspace, taskId);
    if (!task) return;
    var completeLabel = task.completed ? "Reactivate" : "Mark complete";
    // [1.0.16] Entry point (3). Directly under the entity header — it is the
    // primary verb for an open task. Suppressed on a completed task (nothing to
    // focus on) and on the already-active one (setActiveTask is idempotent, but
    // offering a no-op reads as broken).
    var isActiveTask = satIsActiveTaskRow(workspace, task);
    var makeActiveHtml = (!task.completed && !isActiveTask)
      ? '<button type="button" class="tt-ctx-item" data-action="make-active">Make active</button>'
      : "";
    var menu = document.createElement("div");
    menu.className = "tt-context-menu";
    menu.innerHTML =
      ctxEntityHeaderHtml("Task", task.name) +
      makeActiveHtml +
      '<button type="button" class="tt-ctx-item" data-action="edit">Edit</button>' +
      '<button type="button" class="tt-ctx-item" data-action="duplicate">Duplicate</button>' +
      '<button type="button" class="tt-ctx-item" data-action="toggle-complete">' + escapeHtml(completeLabel) + '</button>' +
      '<div class="tt-ctx-separator"></div>' +
      '<button type="button" class="tt-ctx-item tt-ctx-danger" data-action="delete">Delete</button>';
    document.body.appendChild(menu);

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
      var panel = document.getElementById("tab-tasks");
      if (action === "make-active") {
        var mws = Storage.getActiveWorkspace(data);
        if (mws) await satActivate(taskId, mws.id);
      } else if (action === "edit") {
        // Inline rename on the live row's name span — same affordance as
        // clicking the name directly (startTaskNameEdit).
        var span = panel && panel.querySelector('.tt-task-row[data-task-id="' + taskId + '"] .tt-task-name');
        if (span && span.tagName === "SPAN") startTaskNameEdit(span, taskId);
      } else if (action === "duplicate") {
        await Storage.duplicateTask(data, taskId);
        if (panel) renderTasksTab(panel, data);
      } else if (action === "toggle-complete") {
        // Re-read completion at click time so the correct branch runs even if
        // it changed since the menu opened.
        var ws2 = Storage.getActiveWorkspace(data);
        var t2 = ws2 && Storage.getTaskById(ws2, taskId);
        var ctxCompleteRes = null;
        if (t2) {
          if (t2.completed) await Storage.reactivateTask(data, taskId);
          else ctxCompleteRes = await Storage.completeTask(data, taskId);
        }
        if (panel) renderTasksTab(panel, data);
        // [1.0.24 item 3 / 1.0.22 D10] auto-goal completion via this path too.
        if (ctxCompleteRes && ctxCompleteRes.goalAutoCompleted && ctxCompleteRes.autoCompletedGoal) {
          celebrateGoalCompletion(ctxCompleteRes.autoCompletedGoal.id);
        }
        renderInsightsPanelEager();
      } else if (action === "delete") {
        // Per trash-bin.md, regular task delete is direct (soft-delete + Undo
        // toast), no confirm modal — same flow as the row trash icon.
        deleteTaskWithUndo(taskId);
      }
    });

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

  // [1.0.12] Anchor a freshly-built popover below an element, append it, and
  // wire the same outside-click + Escape dismissal as the goal context menu.
  // Reuses the tasksContextMenu* slot + closeGoalContextMenu so only one
  // menu/popover is ever open at a time.
  function mountTasksPopover(menu, anchorEl) {
    document.body.appendChild(menu);
    var rect = anchorEl.getBoundingClientRect();
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    var px = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    var py = rect.bottom + 4;
    if (py + h > window.innerHeight - 8) py = Math.max(8, rect.top - h - 4); // flip above if no room below
    menu.style.left = px + "px";
    menu.style.top = py + "px";

    tasksContextMenuEl = menu;
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

  // [1.0.12] Priority popover for a task row's pill. Single-select: the four
  // priorities + Clear (sets priority back to null). On pick:
  // Storage.updateTaskPriority (which saveAll's internally) then an EAGER
  // renderTasksTab — the storage.onChanged write-provenance gate ([1.0.11.2])
  // suppresses re-render for our own same-tab writes, so relying on onChanged
  // alone would leave the change invisible until reload. Mirrors the checkbox /
  // collapse / complete handlers, which eager-render for the same reason.
  function openPriorityPillPopover(anchorEl, taskId, current) {
    closeGoalContextMenu();
    if (!taskId) return;
    var menu = document.createElement("div");
    menu.className = "tt-context-menu tt-prio-popover";
    var rows = [["urgent", "Urgent"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]];
    var html = rows.map(function (r) {
      var activeCls = current === r[0] ? " tt-ctx-active" : "";
      return '<button type="button" class="tt-ctx-item tt-prio-opt' + activeCls + '" data-priority="' + r[0] + '">' +
        '<span class="tt-prio-swatch ' + taskPriorityClass(r[0]) + '" aria-hidden="true"></span>' + r[1] +
      '</button>';
    }).join("");
    html += '<div class="tt-ctx-separator"></div>' +
      '<button type="button" class="tt-ctx-item tt-prio-opt' + (!current ? " tt-ctx-active" : "") + '" data-priority="">Clear priority</button>';
    menu.innerHTML = html;

    menu.addEventListener("click", async function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest(".tt-prio-opt");
      if (!btn) return;
      closeGoalContextMenu();
      var raw = btn.getAttribute("data-priority");
      var newPriority = raw ? raw : null;
      try {
        await Storage.updateTaskPriority(data, taskId, newPriority);
      } catch (err) {
        console.error("[LaunchPad] Tasks tab: updateTaskPriority failed", err);
      }
      var panel = document.getElementById("tab-tasks");
      if (panel) renderTasksTab(panel, data); // eager — see [1.0.11.2] gate note above
    });

    mountTasksPopover(menu, anchorEl);
  }

  // [1.0.13.1] Eager Tasks-tab re-render after a same-tab write. The
  // [1.0.11.2] write-provenance gate suppresses the storage.onChanged
  // re-render for our own writes, so every commit path here renders eagerly
  // (same convention as openPriorityPillPopover / the checkbox + chevron
  // handlers). No-op when the Tasks panel isn't mounted.
  function rerenderTasksPanel() {
    var panel = document.getElementById("tab-tasks");
    if (panel) renderTasksTab(panel, data);
  }

  // [1.0.13.1] Due-date popover for a task row's pill. A date input prefilled
  // with the task's current due day (UTC YYYY-MM-DD), plus Set / Clear. Set
  // reads the input (empty = clear); Clear commits null directly. Both route
  // through commitTaskDueAt, which runs the hierarchy check. Mirrors the
  // priority popover's mount + single-open-at-a-time behavior.
  function openDueDatePillPopover(anchorEl, taskId, currentYmd) {
    closeGoalContextMenu();
    if (!taskId) return;
    var menu = document.createElement("div");
    menu.className = "tt-context-menu tt-due-popover";
    menu.innerHTML =
      '<div class="tt-due-popover-row">' +
        '<input type="date" class="tt-due-input" value="' + escapeHtml(currentYmd || "") + '">' +
      '</div>' +
      '<div class="tt-due-popover-actions">' +
        '<button type="button" class="tt-ctx-item tt-due-clear">Clear</button>' +
        '<button type="button" class="tt-ctx-item tt-due-set">Set</button>' +
      '</div>';
    var input = menu.querySelector(".tt-due-input");
    menu.querySelector(".tt-due-set").addEventListener("click", function () {
      var candidate = parseDateInputToTs(input.value); // "" or invalid → null (clear)
      closeGoalContextMenu();
      commitTaskDueAt(taskId, candidate);
    });
    menu.querySelector(".tt-due-clear").addEventListener("click", function () {
      closeGoalContextMenu();
      commitTaskDueAt(taskId, null);
    });
    mountTasksPopover(menu, anchorEl);
  }

  // [1.0.13.1] Shared task-due commit path. Runs Storage.checkTaskDueConflict
  // in front of the write. No conflict (standalone task goalId null, goal with
  // null deadline, clear-to-null, or candidate on/before the goal-deadline UTC
  // day) → write directly. Conflict (candidate strictly-later UTC day than the
  // parent goal deadline) → open the 3-button hierarchy modal instead of
  // writing. Cancelling the modal writes nothing and leaves the pill as-is
  // (no re-render), which is the "revert picker" behavior.
  async function commitTaskDueAt(taskId, candidateDueAt) {
    var conflict = Storage.checkTaskDueConflict(data, taskId, candidateDueAt);
    if (!conflict.conflict) {
      try {
        await Storage.updateTaskDueAt(data, taskId, candidateDueAt);
      } catch (err) {
        console.error("[LaunchPad] Tasks tab: updateTaskDueAt failed", err);
      }
      rerenderTasksPanel();
      return;
    }
    openTaskDueConflictModal(taskId, conflict);
  }

  // [1.0.13.1] The task-side half of the due-date hierarchy rule (spec:
  // tasks-and-goals.md "Deadline hierarchy rule"). 3-button modal via the
  // openTasksModal extraButtons extension:
  //   [Extend goal to taskDate]  → updateGoalDeadline then updateTaskDueAt
  //   [Keep goal deadline, …]    → updateTaskDueAt(goal.deadlineAt) verbatim
  //   [Cancel]                   → no writes, pill unchanged
  function openTaskDueConflictModal(taskId, conflict) {
    var taskDateStr = fmtShortDateUTC(conflict.candidateDueAt);
    var goalDateStr = fmtShortDateUTC(conflict.goalDeadlineAt);
    var goalName = conflict.goalName || "the goal";
    openTasksModal({
      title: "Due date after goal deadline",
      bodyHtml: '<p class="tt-modal-message">This task’s due date (' + escapeHtml(taskDateStr) +
        ') is after ' + escapeHtml(goalName) + ' deadline (' + escapeHtml(goalDateStr) +
        '). Extend the goal deadline to match?</p>',
      primaryLabel: "Extend goal to " + taskDateStr,
      defaultFocus: "primary",
      onPrimary: async function () {
        try {
          await Storage.updateGoalDeadline(data, conflict.goalId, conflict.candidateDueAt);
          await Storage.updateTaskDueAt(data, taskId, conflict.candidateDueAt);
        } catch (err) {
          console.error("[LaunchPad] Tasks tab: extend-goal due commit failed", err);
        }
        rerenderTasksPanel();
      },
      extraButtons: [{
        label: "Keep goal deadline, set task to " + goalDateStr,
        onClick: async function () {
          try {
            await Storage.updateTaskDueAt(data, taskId, conflict.goalDeadlineAt);
          } catch (err) {
            console.error("[LaunchPad] Tasks tab: keep-goal due commit failed", err);
          }
          rerenderTasksPanel();
        }
      }]
    });
  }

  // [1.0.12] Multi-select filter popover for the Priority / Tag bar buttons.
  // Checkbox list bound to taskFilterState.priorities / .tagIds (in-memory).
  // Each toggle updates state and eager re-renders; the popover lives on
  // document.body so it survives the panel innerHTML rewrite and stays open for
  // multiple selections. Tag options come from Storage.getActiveTags (non-
  // trashed only — deletedAt-tombstoned tags are excluded).
  function openTaskFilterPopover(anchorEl, kind) {
    closeGoalContextMenu();
    if (kind !== "priority" && kind !== "tag") return;
    var menu = document.createElement("div");
    menu.className = "tt-context-menu tt-filter-popover";

    var rows = [];
    if (kind === "priority") {
      rows = [["urgent", "Urgent"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]];
    } else {
      var ws = Storage.getActiveWorkspace(data);
      var tags = ws ? Storage.getActiveTags(ws) : [];
      rows = tags.map(function (t) { return [t.id, t.name]; });
    }

    if (!rows.length) {
      menu.innerHTML = '<div class="tt-filter-empty">No tags yet.</div>';
    } else {
      var selected = kind === "priority" ? taskFilterState.priorities : taskFilterState.tagIds;
      menu.innerHTML = rows.map(function (r) {
        var checked = selected.indexOf(r[0]) !== -1 ? " checked" : "";
        var swatch = kind === "priority"
          ? '<span class="tt-prio-swatch ' + taskPriorityClass(r[0]) + '" aria-hidden="true"></span>'
          : '';
        return '<label class="tt-filter-row">' +
          '<input type="checkbox" class="tt-filter-check" value="' + escapeHtml(r[0]) + '"' + checked + '>' +
          swatch +
          '<span class="tt-filter-row-label">' + escapeHtml(r[1]) + '</span>' +
        '</label>';
      }).join("");
    }

    menu.addEventListener("change", function (ev) {
      var cb = ev.target && ev.target.closest && ev.target.closest(".tt-filter-check");
      if (!cb) return;
      var val = cb.value;
      var arr = kind === "priority" ? taskFilterState.priorities : taskFilterState.tagIds;
      var idx = arr.indexOf(val);
      if (cb.checked && idx === -1) arr.push(val);
      else if (!cb.checked && idx !== -1) arr.splice(idx, 1);
      var panel = document.getElementById("tab-tasks");
      if (panel) renderTasksTab(panel, data);
    });

    mountTasksPopover(menu, anchorEl);
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

  // ===== [2.0] Chip ink — derived per fill, never eyeballed =====
  //
  // Chips carry a USER-CHOSEN fill: the tag palette, a workspace colour, or a
  // hex the user typed into the tag editor. So the ink cannot be a constant —
  // it has to be computed per fill, and the computation has to be the one the
  // contrast standard actually defines.
  //
  // WHAT WAS WRONG. The previous chooser scored the fill with Rec 601 weights
  // and switched ink at 0.55. Rec 601 is a perceived-brightness formula for
  // analogue video; it is NOT WCAG relative luminance, which linearises each
  // channel through the sRGB transfer function first. The two disagree most in
  // the middle of the range — which is exactly where a chip palette lives. The
  // casualty was #4A90E2: it scores 0.519 on Rec 601, just under the threshold,
  // so it took WHITE ink at 3.29:1. That colour is the FIRST entry in both the
  // tag palette and the workspace palette, so it is the chip on almost every
  // user's first goal and first workspace. Measured across both palettes plus
  // the two accent fills, FIVE of nineteen failed 4.5:1 the same way.
  //
  // THE REPLACEMENT MAKES NO THRESHOLD JUDGEMENT. It computes the real contrast
  // against both candidate inks and takes the better one. A threshold is a guess
  // about where the crossover sits; the ratio IS the crossover, and it costs two
  // multiplications to ask directly.
  //
  // THE DARK CANDIDATE follows the product's own light-fill precedent rather
  // than inventing one: the gold button is #241a00 on #ffd66e — a very dark
  // version of the fill's OWN hue, not a neutral grey. Generalised here as same
  // hue, saturation capped so it cannot go muddy, lightness CHIP_INK_LIGHTNESS.
  //
  // A chip fill is OPAQUE, so every ratio here is wallpaper-independent: the
  // same on the default frame, on a photo, and on a light solid. That is why
  // chips need no has-bg branch, and why this is the one ink rule in the product
  // that can be proved arithmetically instead of measured in a browser.

  // Parses #rgb and #rrggbb, with or without the leading #. Returns null for
  // anything unusable so a caller can fall back rather than compute over
  // garbage — storage validates /^#[0-9A-Fa-f]{6}$/ on write, but the tag
  // editor's fallback fills and any future caller passing CSS shorthand still
  // have to land somewhere defined.
  function hexToRgb(hex) {
    if (typeof hex !== "string") return null;
    var h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // The sRGB transfer function, which is the step the old formula skipped.
  function srgbToLinear(v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  // WCAG 2.x relative luminance. 0 for an unusable fill — the same "treat it as
  // black" fallback the old helper had, so an unparseable colour still resolves
  // to white ink and matches the CSS class default underneath it.
  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return 0;
    return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
  }

  function contrastRatio(a, b) {
    var la = relativeLuminance(a);
    var lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function rgbToHsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var d = mx - mn;
    var l = (mx + mn) / 2;
    var h = 0, s = 0;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = (mx === r) ? ((g - b) / d + (g < b ? 6 : 0))
        : (mx === g) ? ((b - r) / d + 2)
        : ((r - g) / d + 4);
      h /= 6;
    }
    return [h, s, l];
  }

  function hslToHex(h, s, l) {
    var f = function (n) {
      var k = (n + h * 12) % 12;
      var a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    };
    var to = function (v) {
      var n = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
      return n.length === 1 ? "0" + n : n;
    };
    return "#" + to(f(0)) + to(f(8)) + to(f(4));
  }

  // DERIVED, not chosen by eye. At lightness 0.12 the worst fill in the product
  // (#A569BD, workspace 4) lands at 4.45 and fails the 4.5 floor; 0.08 puts that
  // same worst case at 4.83 with margin. The saturation cap keeps a fully
  // saturated fill from producing an ink that reads as a colour rather than as
  // near-black.
  var CHIP_INK_LIGHTNESS = 0.08;
  var CHIP_INK_MAX_SATURATION = 0.9;
  var CHIP_INK_LIGHT = "#ffffff";

  function chipDarkInkFor(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return "#111111";
    var hsl = rgbToHsl(rgb);
    return hslToHex(hsl[0], Math.min(hsl[1], CHIP_INK_MAX_SATURATION), CHIP_INK_LIGHTNESS);
  }

  // THE chip ink chooser. Every chip that paints text on a colour fill goes
  // through this one function — tag pills in the Tasks tab, the goal auto-tag
  // chip, the shortcut tag pills, the free preview's demo pills, and the
  // workspace initial chips — so no surface can drift from the others.
  //
  // Ties go to dark (>=), which is the same "err toward dark on a borderline
  // fill" instinct the old 0.55 threshold was reaching for, now applied where it
  // is actually a tie rather than as a guess about where ties happen.
  function tagTextColorFor(hex) {
    if (!hexToRgb(hex)) return CHIP_INK_LIGHT;
    var dark = chipDarkInkFor(hex);
    return contrastRatio(hex, dark) >= contrastRatio(hex, CHIP_INK_LIGHT) ? dark : CHIP_INK_LIGHT;
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

    cta.classList.remove("hidden", "is-pulsing", "tab-cta-trial", "tab-cta-pro", "tab-cta-teaser");

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
    } else if (!trialUsed && !trialCtaLive()) {
      // teaser mode (TRIAL_CTA_ENABLED = false) — the trial funnel is gated off (see trialCtaLive).
      // Inert "Coming soon" chip: no pulse, no click affordance (bindUpgradeCta
      // also bails, and .tab-cta-teaser sets pointer-events:none). This is the
      // sole trial entry point on the tab bar; gating it here plus the preview
      // banner makes the upgrade popover unreachable for a fresh free user.
      cta.classList.add("tab-cta-teaser");
      labelHtml = '<span>Coming soon</span>';
      ariaLabel = "LaunchPad Pro — coming soon";
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

      // WHERE EVERY ACCESS STATE'S CLICK LANDS. Only the trialing row changed
      // in this round; the rest are enumerated so the next reader can see that
      // at a glance instead of re-deriving it:
      //
      //   free, no trial used   -> this popover, WITH "Start free trial"   (unchanged)
      //   TRIALING              -> this popover, TRIAL VARIANT             (CHANGED)
      //   active               -> Pro Settings                            (unchanged)
      //   grace                -> Pro Settings                            (unchanged)
      //   expired trial        -> this popover, no trial block, "Upgrade"  (unchanged)
      //   invalid license      -> same as expired: getProAccessLevel maps a
      //                           'invalid' subscriptionStatus to "free", and
      //                           trialStartedAt is set, so the chip reads
      //                           "Upgrade" and lands here                 (unchanged)
      //   teaser (flag off)    -> nothing; the early return below           (unchanged)
      //
      // [QA 2026-08-10] TRIALING NO LONGER GOES TO PRO SETTINGS. The 2026-04-26
      // routing decision sent it there on the reasoning that a trialing user
      // "already has an account context" and the popover would be a stub-laden
      // detour. QA on the packed 2.0.0 build showed the cost of that: the chip
      // spends seven days counting down a trial and, when clicked, opened a
      // settings panel with no way to buy. The popover is no longer stub-laden
      // — it carries live tier buttons into checkout — so the premise the old
      // decision rested on is gone. Active and grace keep the old routing:
      // they HAVE Pro, and Pro Settings is genuinely where they want to land.
      if (level === "active" || level === "grace") {
        closeUpgradePopover();
        openPanel("pro-settings");
        return;
      }
      // teaser mode (TRIAL_CTA_ENABLED = false): a free user's CTA is an inert "Coming soon" chip.
      // .tab-cta-teaser already sets pointer-events:none, so this rarely fires —
      // it is the JS backstop so the trial popover cannot open even if the class
      // is missing for any reason.
      var trialUsed = !!(data && data.pro && data.pro.trialStartedAt);
      if (!trialUsed && !trialCtaLive()) return;
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

  var DODO_PRODUCT_IDS = {
    monthly: "pdt_0NewHftUJ9dSIcJcl38Hd",
    annual:  "pdt_0NewPBLmMizbcr3Sif8cr"
  };
  var DODO_CHECKOUT_BASE = "https://checkout.dodopayments.com/buy/";

  // Where Dodo sends the buyer after a successful payment. MUST decode to
  // exactly a path background.js's isCheckoutReturnUrl accepts — host
  // mylaunchpad.me, path /checkout-return or /checkout-return.html — or the
  // auto-activation handoff silently does nothing and the buyer is left to
  // paste a key by hand. That coupling has broken once already (extension
  // commit 07f979e, bug 1215525319408075), so tools/check-bg-queue.mjs now
  // asserts the round trip: it extracts this URL, decodes the redirect_url it
  // carries, and runs it through the real matcher.
  var DODO_RETURN_URL = "https://mylaunchpad.me/checkout-return";

  // One construction site for the hosted-checkout URL, so the return-URL
  // contract cannot drift between tiers.
  function dodoCheckoutUrl(pdtId) {
    return DODO_CHECKOUT_BASE + pdtId +
      "?quantity=1&redirect_url=" + encodeURIComponent(DODO_RETURN_URL);
  }

  // The trial popover's headline. Pure and exported-shaped on purpose so
  // tools/check-trial-copy.mjs can exercise every branch: the plural boundary
  // is the kind of thing that reads fine in the one state a developer happens
  // to be in and embarrassing in the one the user is in.
  //
  // n comes from ProAccess.trialDaysRemaining, which already collapses the
  // final 24 hours to 0 so "ends today" is reachable, and clamps at 0. The
  // negative guard here is belt-and-braces for a hand-edited or clock-shifted
  // record: "-2 days left in your trial" would be worse than useless.
  function trialPopoverHeadline(n) {
    if (!(n > 0)) return "Trial ends today";        // also folds NaN and negatives
    if (n === 1) return "1 day left in your trial";
    return n + " days left in your trial";
  }

  // Popover copy per access state. Returns { title, subhead }.
  function popoverCopyForState(d) {
    var level = (typeof ProAccess !== "undefined" && d) ? ProAccess.getProAccessLevel(d) : "free";

    // [QA 2026-08-10] TRIALING now reaches this popover. It previously could
    // not: the CTA sent trialing users straight to Pro Settings, which meant a
    // user watching their trial count down had NO route to buy from the chip
    // that was doing the counting. The upgrade path is the whole point of that
    // chip, so the trial state gets its own variant — countdown headline, the
    // two tier buttons, and the license row. There is deliberately no "Start
    // free trial" button: they are already in one.
    if (level === "trialing") {
      return {
        title: trialPopoverHeadline(ProAccess.trialDaysRemaining(d)),
        subhead: "Keep your focus going — upgrade any time, and everything you've set up stays."
      };
    }

    var trialUsed = !!(d && d.pro && d.pro.trialStartedAt);
    // In teaser mode (TRIAL_CTA_ENABLED = false) the trial block is suppressed
    // (see openUpgradePopover), so the "free for 7 days" title would be a
    // promise with no button under it — fall back to the upgrade title.
    return {
      title: (trialUsed || !trialCtaLive())
        ? "Upgrade to LaunchPad Pro"
        : "Try LaunchPad Pro free for 7 days",
      subhead: "Workspaces, tasks, time tracking, and more."
    };
  }

  function openUpgradePopover(anchorEl, d) {
    closeUpgradePopover();
    if (!anchorEl) return;
    var copy = popoverCopyForState(d);
    var title = copy.title;
    var trialUsed = !!(d && d.pro && d.pro.trialStartedAt);

    // Trial primary stack only renders when the user hasn't started a trial.
    // Once the trial has been used (IN one, active, or expired), the popover
    // collapses to "tier buttons + Already have a license?". A user mid-trial
    // has trialStartedAt set, so the trial-variant popover gets no "Start free
    // trial" button through this same condition — no second gate needed, and
    // tools/check-trial-copy.mjs asserts that rather than trusting it.
    // teaser mode (TRIAL_CTA_ENABLED = false) also suppresses the trial block (trialCtaLive() false in
    // a packed build). Free-user entry points to this popover are already inert
    // in teaser mode, so this is the defense-in-depth chokepoint: even if a
    // surface routes here, no trial can be started.
    var trialBlock = (trialUsed || !trialCtaLive()) ? "" :
      '<button type="button" class="up-primary">Start free trial</button>' +
      '<div class="up-or-divider"><span>or upgrade now</span></div>';

    var pop = document.createElement("div");
    pop.id = "upgrade-popover";
    pop.innerHTML =
      '<div class="up-header">' +
        '<div class="up-title">' + escapeHtml(title) + '</div>' +
        '<button type="button" class="up-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="up-subhead">' + escapeHtml(copy.subhead) + '</div>' +
      trialBlock +
      '<div class="up-tier-row">' +
        '<button type="button" class="up-tier" data-tier="monthly">Monthly</button>' +
        '<button type="button" class="up-tier" data-tier="annual">Annual</button>' +
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

    // [1.0.5.4] Section F — tier button → Dodo hosted checkout.
    //
    // CORRECTED AT v2.0.0. This comment used to assert the opposite of the
    // truth — that the return URL was configured per-product in the Dodo
    // dashboard and must never be sent as a query parameter. The website round
    // proved that sending it ON THE CHECKOUT URL is the mechanism that actually
    // works, and it is what the checkout-return page and background.js's
    // handler are built around. The dashboard setting is at best a fallback and
    // was never the contract. (Deliberately paraphrased rather than quoted: the
    // old wording was instruction-shaped, and leaving it verbatim in the file
    // means the next person to grep for it finds the rule that was reversed.)
    //
    // background.js's tabs.onUpdated listener picks the license_key off the
    // return navigation and activates Pro; if that fails for any reason the
    // page stays open with the key and manual instructions (extension commit
    // 0e76a76 — the close is conditional on a confirmed activation now).
    pop.querySelectorAll(".up-tier").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tier = btn.dataset.tier;
        var pdtId = DODO_PRODUCT_IDS[tier];
        if (!pdtId) return;
        chrome.tabs.create({
          url: dodoCheckoutUrl(pdtId)
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
      var chipColor = workspaceColorForIndex(idx);
      chip.style.background = chipColor;
      // Same chooser as every other chip (see tagTextColorFor). The workspace
      // palette shares #4A90E2 with the tag palette, so this letter shipped
      // white at 3.29:1 for anyone who never renamed Main.
      chip.style.color = tagTextColorFor(chipColor);
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
        '<span class="sb-ws-chip' + (ws.isReadOnly ? ' is-readonly' : '') + '" style="background:' + color + ';color:' + tagTextColorFor(color) + '">' + escapeHtml(workspaceFirstLetter(ws.name)) + '</span>' +
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
      // [R3] Checklist step 5 rides this write.
      Storage.recordChecklistStep(data, Storage.GS_STEPS.WORKSPACE);
      await Storage.saveAll(data);
      render();
      refreshGettingStartedIfOpen();
      // A workspace switch is a same-tab write to `data`: Storage.saveAll tags
      // it and the write-provenance gate suppresses our OWN onChanged, so the
      // cross-tab refresh path never runs for the tab that made the switch. We
      // must replicate here exactly what a FOREIGN tab's onChanged does —
      // `render(); applyAccessLevelUI();` — or the Pro panels stay a workspace
      // behind until an unrelated render fires. applyAccessLevelUI is a superset
      // of applyWorkspaceSwitcherState: it also re-renders the Tasks panel (via
      // applyTabAccessLevel -> renderTabPlaceholder -> renderTasksTab, which
      // reads the now-switched active workspace) and the active-task widget's
      // cross-workspace state, so switcher label, panel content, and widget all
      // agree immediately with no new tab. (I2 render-flow.)
      applyAccessLevelUI();
      requestAnimationFrame(function () {
        if (grid) grid.classList.remove("is-swapping");
      });
    }, 150);
  }

  // [1.0.25] trackingEnabled defaults to true when omitted — the workspace
  // dropdown's quick-create passes no flag by design (it stays a name-only
  // popover), and the default is ON per the spec. The Pro Settings add-row,
  // which sits directly above the list where each row's toggle lives, is the
  // creation surface that exposes the choice up front.
  async function createWorkspace(name, trackingEnabled) {
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
      tracking: { enabled: trackingEnabled !== false }
    });
    data.workspaceOrder.push(id);
    data.activeWorkspaceId = id;
    // [1.0.11.5] Symmetric with switchWorkspace — workspace transition is a
    // context reset (see comment there). Clear, not prune.
    sidebarExpandedGroupIds.clear();
    await Storage.saveAll(data);
    render();
    // Creating a workspace switches to it (empty), so the Pro panels would
    // otherwise show the PREVIOUS workspace's content — same same-tab stale
    // render as switchWorkspace. applyAccessLevelUI is the superset repaint
    // (Tasks panel + widget + switcher label), and it already re-renders the
    // Pro Settings workspace list when that panel is open, so no separate
    // renderProWorkspaceList call is needed here.
    applyAccessLevelUI();
    closeWorkspaceDropdown();
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
    // Deleting the ACTIVE workspace switches to another one, so the Pro panels
    // need the same superset repaint as switchWorkspace (Tasks panel + widget +
    // switcher label). Unconditional is fine when a non-active workspace is
    // deleted — applyAccessLevelUI just repaints the unchanged active workspace.
    applyAccessLevelUI();
    // Delete is invoked from the Pro Settings panel; keep the explicit list
    // refresh so the removed row disappears regardless of applyAccessLevelUI's
    // panel-open guard.
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
    // [1.0.20 F2] Combined-analytics toggle. Persists through the per-field
    // setter (mutates this tab's `data` + saveAll, provenance-tagged), then
    // EAGERLY repaints the Dashboard: our own write is provenance-suppressed, so
    // nothing else repaints this tab — the same eager-render-after-own-write
    // discipline as the workspace switch and every Tasks mutation. The repaint
    // goes through renderTabPlaceholder, the ACCESS-GATED dispatcher, so a
    // free/expired user's preview is never overwritten (D10) — belt-and-braces,
    // since this control only exists inside the Pro-gated settings panel. Because
    // the setter mutated this tab's cached `data`, the repaint reads the new
    // combined scope from cache immediately; F1's reconcile (the boundary, a
    // different setting) is the complementary half for writes that bypass cache.
    safeOn("#pro-analytics-toggle", "change", async function (e) {
      try {
        await Storage.setCombinedAnalyticsEnabled(data, !!e.target.checked);
      } catch (err) {
        console.error("[LaunchPad] Combined analytics: toggle failed", err);
      }
      renderTabPlaceholder("dashboard", currentAccessLevel());
    });

    // [1.0.18] Pomodoro duration inputs. Each fires its own per-field Storage
    // updater on "change", which clamps + coerces; we then re-render the section
    // so the CLAMPED value is reflected back into the box (e.g. 999 -> 60). The
    // pill's ring reads settings live per tick, so no forced widget render here.
    var pomoBindings = [
      ["#pomo-work-min", Storage.setPomodoroWorkMin],
      ["#pomo-short-break-min", Storage.setPomodoroShortBreakMin],
      ["#pomo-long-break-min", Storage.setPomodoroLongBreakMin],
      ["#pomo-cycles", Storage.setPomodoroCyclesBeforeLongBreak]
    ];
    pomoBindings.forEach(function (pair) {
      safeOn(pair[0], "change", async function (e) {
        try {
          await pair[1](data, e.target.value);
        } catch (err) {
          console.error("[LaunchPad] Pomodoro settings: save failed", err);
        }
        renderProPomodoroSettings();
      });
    });

    // [A2] Reset the running cycle count on the active task's focus state.
    safeOn("#pomo-reset-cycles", "click", async function () {
      try {
        if (await Storage.resetPomodoroCycleCount(data)) {
          renderActiveTaskWidget();
          showToast("Focus cycle count reset.");
        }
      } catch (err) {
        console.error("[LaunchPad] Focus session: reset cycles failed", err);
      }
      renderProPomodoroSettings();
    });

    // [1.0.18 B-1 / B5] Desktop-notifications toggle — permission-gated. Turning ON
    // requests the 'notifications' optional permission from THIS user gesture (the
    // change event); the request call must stay synchronous within the handler, so
    // it is the first thing the ON branch does. Denied/dismissed -> revert the box,
    // show a soft note, and never flip the flag. Granted -> persist the flag (the SW
    // reconciler then schedules the alarm if a phase is running). Turning OFF flips
    // the flag only and KEEPS the permission, so re-enabling never prompts again.
    safeOn("#pomo-notifications-toggle", "change", async function (e) {
      var box = e.target;
      var note = $("#pomo-notifications-note");
      if (note) note.hidden = true;
      if (box.checked) {
        var granted = false;
        try {
          granted = await new Promise(function (resolve) {
            chrome.permissions.request({ permissions: ["notifications"] }, function (g) { resolve(!!g); });
          });
        } catch (err) {
          console.error("[LaunchPad] Focus session: notifications permission request failed", err);
          granted = false;
        }
        if (!granted) {
          box.checked = false;
          if (note) { note.textContent = "Notifications permission was declined."; note.hidden = false; }
          return;
        }
        try {
          await Storage.setPomodoroNotificationsEnabled(data, true);
        } catch (err) {
          console.error("[LaunchPad] Focus session: enable notifications failed", err);
        }
      } else {
        try {
          await Storage.setPomodoroNotificationsEnabled(data, false);
        } catch (err) {
          console.error("[LaunchPad] Focus session: disable notifications failed", err);
        }
      }
    });

    // [1.0.18 B-2] Boundary chime. Two delegated handlers on one container:
    //   change -> persist the selection (whitelist-coerced in the setter)
    //   click on ▶ -> PREVIEW ONLY, writes nothing. Auditioning a chime must not
    //     change what fires at your next boundary; you pick with the radio.
    safeOn("#pomo-sound-options", "change", async function (e) {
      var el = e.target;
      if (!el || el.name !== "pomo-sound") return;
      try {
        await Storage.setPomodoroSound(data, el.value);
      } catch (err) {
        console.error("[LaunchPad] Focus session: save sound failed", err);
      }
      renderProPomodoroSettings();
    });
    safeOn("#pomo-sound-options", "click", function (e) {
      var btn = e.target.closest(".pomo-sound-preview");
      if (!btn) return;
      satPlayPomodoroSound(btn.dataset.sound);
    });

    bindProTagsControls();
    bindFocusBlockingControls();
  }

  function openProSettingsPanel() {
    var panel = $("#pro-settings-panel");
    if (!panel) return;
    if (!panel.classList.contains("hidden")) { closeProSettingsPanel(); return; }

    // [Trash] Collapse the trashed-tags block on every open. Deliberately not
    // persisted: revealing it is a momentary "let me look in the bin", not a
    // preference, so a fresh panel always shows the uncluttered active list.
    proTagsTrashRevealed = false;

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
    renderProPomodoroSettings();
    renderFocusBlockingSection();
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
    }
    // [QA 2026-08-10] "Last verified" USED TO RENDER HERE for active/grace, and
    // that was the wrong home: it is the outcome of the Check button two
    // sections down, so the fact sat far from both the control that changes it
    // and the answer that action reports. It now lives in the inline status line
    // under that button (licenseStatusLine's idle branch) and appears exactly
    // once. The grace WARNING stays below, because that is a different fact --
    // not "when did we last check" but "your access is about to stop".
    //
    // In production, level active/grace implies a stored licence key
    // (clearLicense resets subscriptionStatus to "free"), so moving the fact
    // behind shouldShowLicenseControls cannot orphan it. The one exception is
    // the IS_UNPACKED __devProOverride, which reports "active" with no key at
    // all -- there the line is correctly absent, since there is no licence whose
    // verification date could be reported.

    if (level === "grace") {
      html += '<span class="pro-warning">Verification overdue &mdash; reconnect to keep access.</span>';
    }

    host.innerHTML = html;
  }

  // [QA 2026-08-10] Both destructive/diagnostic license controls are gated on
  // a key ACTUALLY BEING STORED. Pure predicate, one source of truth for the
  // two rows, and harnessable (tools/check-trial-copy.mjs).
  //
  // The entry row and Apply are deliberately NOT gated: entering a key is how
  // the empty state stops being the empty state, and it is the documented
  // recovery path when auto-activation fails.
  function shouldShowLicenseControls(d) {
    return !!(d && d.pro && d.pro.licenseKey);
  }

  // [QA 2026-08-10] The inline status line's copy, as a pure function of the
  // ensureValidated result plus stored pro state, so tools/check-license-line.mjs
  // can walk every branch instead of hoping.
  //
  // TONE is separate from TEXT because the honest outcomes are not all the same
  // KIND of bad. "Expired" is a verdict the user must act on; "could not reach
  // the server" is not a verdict at all and must never be dressed as one. The
  // toast this replaces collapsed both into whatever string came back, so a
  // dropped connection could read as a dead licence.
  //
  // `result` shapes: null = idle (panel just opened, report the STORED fact),
  // {checking:true} = in flight, otherwise an ensureValidated return value.
  function licenseStatusLine(result, pro, nowMs) {
    var status = (pro && pro.subscriptionStatus) || null;
    var lastVerifiedAt = (pro && pro.lastVerifiedAt) || 0;

    function ago() {
      if (!lastVerifiedAt) return "never";
      var days = Math.floor((nowMs - lastVerifiedAt) / DAY_MS_LOCAL);
      if (days <= 0) return "today";
      return days === 1 ? "1 day ago" : days + " days ago";
    }

    if (result && result.checking) return { tone: "idle", text: "Checking..." };

    // Idle render. This is where the Subscription section's old "Last verified"
    // line now lives -- one fact, next to the control that changes it.
    if (!result) {
      if (status === "active") return { tone: "ok", text: "License active — last verified " + ago() + "." };
      if (status === "invalid") return { tone: "bad", text: "License is not valid — last checked " + ago() + "." };
      return { tone: "idle", text: "Not checked yet." };
    }

    // A real answer came back.
    if (result.ok) {
      if (status === "active") return { tone: "ok", text: "License active — verified just now." };
      if (status === "invalid") return { tone: "bad", text: "License is not valid — it may have expired or been cancelled." };
      return { tone: "idle", text: "License status: " + (status || "unknown") + "." };
    }

    // No answer came back. Nothing below may imply a verdict unless we have one.
    //
    // Our own fault -- the check never left the building.
    if (result.error === "invalid_args" || result.error === "module_missing" || result.error === "threw") {
      return { tone: "warn", text: "Could not run the check — reload the page and try again." };
    }
    // Dodo's fault or the network's. State preserved, offline grace lives on.
    if (typeof LicenseClient !== "undefined" && LicenseClient.isTransientError(result.error)) {
      return { tone: "warn", text: "Could not reach the license server — try again." };
    }
    // A definitive rejection -- but only trusted while it AGREES WITH THE STATE
    // MACHINE. ensureValidated flips subscriptionStatus to 'invalid' on exactly
    // the errors it treats as definitive, so if some future error code arrives
    // here without that flip, we do not actually know it was a rejection. The
    // honest non-verdict is the default; the accusation needs evidence.
    if (status === "invalid") {
      return { tone: "bad", text: result.message || "This license was rejected." };
    }
    return { tone: "warn", text: "Could not reach the license server — try again." };
  }

  // Renders the line under the Check button. Gated on the SAME predicate as the
  // button itself, so the fact and the control that updates it appear together
  // or not at all.
  function renderProLicenseCheckStatus(result) {
    var host = $("#pro-license-check-status");
    if (!host) return;
    if (!shouldShowLicenseControls(data)) {
      host.className = "pro-license-check-status hidden";
      host.textContent = "";
      return;
    }
    var line = licenseStatusLine(result, data.pro, Date.now());
    host.className = "pro-license-check-status pro-license-check-" + line.tone;
    host.textContent = line.text;
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
    var show = shouldShowLicenseControls(data);
    // [1.0.5.4] Section C — Check license status now button is only meaningful
    // when a license key is set. Hide it for the empty state.
    var checkRow = $("#pro-license-check-row");
    if (checkRow) checkRow.classList.toggle("hidden", !show);
    // [QA 2026-08-10] ...and so is Clear license, which until now rendered
    // unconditionally. A TRIALING user has no stored key, so they were offered
    // a red "Clear license" button that could only ever answer "No license to
    // clear." — a destructive-looking control that does nothing, on the one
    // surface where a user is already nervous about losing access.
    var clearRow = $("#pro-license-clear-row");
    if (clearRow) clearRow.classList.toggle("hidden", !show);
    // Idle render: report the stored verification fact. Passing null (rather
    // than skipping the call) is what makes the line PERSISTENT -- it carries
    // the last-known answer on every panel open, not only right after a click.
    renderProLicenseCheckStatus(null);
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
        // [1.0.25] Per-workspace tracking toggle. Default ON for every
        // workspace including Main (spec, Workspace Scoping).
        var trackChecked = Storage.isTrackingEnabled(ws) ? " checked" : "";
        return '<li class="pro-workspace-row' + roCls + '" data-workspace-id="' + escapeHtml(ws.id) + '">' +
          '<span class="pws-drag-handle" title="Drag to reorder">☰</span>' +
          '<span class="pws-chip' + (ws.isReadOnly ? ' is-readonly' : '') + '" style="background:' + color + ';color:' + tagTextColorFor(color) + '">' + escapeHtml(workspaceFirstLetter(ws.name)) + '</span>' +
          '<span class="pws-name' + roCls + '">' + escapeHtml(ws.name || ws.id) + '</span>' +
          '<label class="pws-tracking" title="Track focus time while this workspace is active">' +
            '<input type="checkbox" class="pws-tracking-check"' + trackChecked + ' aria-label="Track focus time in this workspace">' +
            '<span>Track</span>' +
          '</label>' +
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

    // [1.0.25] Tracking toggle. Writing `data` is what notifies the engine:
    // the service worker watches this key (D3), re-evaluates the gates on the
    // change and closes any open session when a workspace is switched off.
    // We do NOT rebuild THIS list — the checkbox already shows its own new
    // state, and rebuilding it would tear down the Sortable instance
    // mid-interaction. But [1.0.20 F4] we DO repaint the Dashboard, whose
    // focused-today line reads isTrackingEnabled for the active workspace; see
    // the handler below.
    host.querySelectorAll(".pws-tracking-check").forEach(function (check) {
      check.addEventListener("change", async function (e) {
        e.stopPropagation();
        var row = check.closest(".pro-workspace-row");
        if (!row) return;
        var enabled = check.checked;
        if (!Storage.setTrackingEnabled(data, row.dataset.workspaceId, enabled)) return;
        await Storage.saveAll(data);
        // [1.0.20 F4] Same gap and same fix as F2's analytics toggle (third and
        // last occurrence of the class among the settings handlers): this
        // own-tab write is provenance-suppressed, so the Dashboard visible
        // BEHIND the settings overlay keeps its stale focused-today pill — the
        // suppression logic (dashFocusedScope -> null when tracking is off) is
        // sound, it just never re-runs. Repaint through renderTabPlaceholder,
        // the access-gated dispatcher (D10-safe). This touches only
        // #tab-dashboard, so the workspace-list Sortable above is untouched.
        renderTabPlaceholder("dashboard", currentAccessLevel());
        showToast(enabled ? "Focus tracking on for this workspace" : "Focus tracking off for this workspace");
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
        // [1.0.25] Tracking choice surfaced at creation (spec, Workspace
        // Scoping). Checked by default — the default is ON.
        '<label class="pws-add-tracking" title="Track focus time while this workspace is active">' +
          '<input type="checkbox" id="pro-workspace-add-tracking" checked aria-label="Track focus time in the new workspace">' +
          '<span>Track</span>' +
        '</label>' +
        '<button type="button" id="pro-workspace-add-btn" class="settings-btn">Add workspace</button>';
      // Insert directly after the workspace list
      if (host.nextSibling) {
        section.insertBefore(addBtnRow, host.nextSibling);
      } else {
        section.appendChild(addBtnRow);
      }
      var input = addBtnRow.querySelector("#pro-workspace-add-input");
      var btn = addBtnRow.querySelector("#pro-workspace-add-btn");
      var trackingCheck = addBtnRow.querySelector("#pro-workspace-add-tracking");
      var submit = function () {
        var name = (input.value || "").trim();
        if (!name) {
          showToast("Workspace name required");
          input.focus();
          return;
        }
        var trackingEnabled = !trackingCheck || trackingCheck.checked;
        input.value = "";
        // Reset to the default for the next create — the field is not sticky.
        if (trackingCheck) trackingCheck.checked = true;
        createWorkspace(name, trackingEnabled);
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

  // [1.0.18] Populate the four Pomodoro inputs from the defaulting reader, so a
  // missing/legacy/out-of-range stored value shows its clamped/defaulted number.
  // Pure population — the "change" handlers own writes.
  function renderProPomodoroSettings() {
    var s = Storage.getPomodoroSettings(data);
    var set = function (sel, val) { var el = $(sel); if (el) el.value = String(val); };
    set("#pomo-work-min", s.workMin);
    set("#pomo-short-break-min", s.shortBreakMin);
    set("#pomo-long-break-min", s.longBreakMin);
    set("#pomo-cycles", s.cyclesBeforeLongBreak);
    // [A2] Reset control: enabled only with an active task carrying a count > 0.
    var resetBtn = $("#pomo-reset-cycles");
    var hint = $("#pomo-reset-hint");
    var active = Storage.getActiveTask(data);
    var ps = active ? Storage.hydratePomodoroState(active.pomodoroState) : null;
    if (resetBtn) resetBtn.disabled = !ps || ps.cycleCount === 0;
    if (hint) hint.textContent = ps ? (ps.cycleCount + " completed this task") : "No active task";
    // [1.0.18 B-1 / B5] Reflect the toggle as flag AND permission-actually-held: if
    // the user revoked 'notifications' via chrome://settings behind our back, show
    // OFF regardless of the stored flag (async contains check). Clear any stale
    // decline note on every (re)render.
    var notifToggle = $("#pomo-notifications-toggle");
    var notifNote = $("#pomo-notifications-note");
    if (notifNote) notifNote.hidden = true;
    if (notifToggle) {
      if (!s.notificationsEnabled || !chrome.permissions) {
        notifToggle.checked = false;
      } else {
        chrome.permissions.contains({ permissions: ["notifications"] }, function (has) {
          notifToggle.checked = !!has;
        });
      }
    }
    // [1.0.18 B-2] Reflect the chime selection. s.sound is already whitelist-
    // coerced by the reader, so a legacy/garbage stored id lands on "none" here
    // and the picker always shows exactly one checked radio.
    $$("#pomo-sound-options input[name='pomo-sound']").forEach(function (radio) {
      radio.checked = (radio.value === s.sound);
    });
  }

  // ===== [1.2.0 R1] Pro Settings: Focus blocking section =====
  //
  // Pro gating is INHERITED, not re-implemented: the whole Pro Settings panel is
  // reachable only through the sidebar entry that applySidebarProEntryVisibility
  // hides for free users, which is exactly how the Focus sessions section above
  // is gated. No per-section check, no preview stub.
  //
  // BUGS.md Section O1: every row below is JS-rendered and therefore invisible to
  // tools/check-panel-ink.mjs, so its ink was BROWSER-MEASURED in all three theme
  // branches (ratios in the IMPLEMENTATION comment) rather than assumed. Rows are
  // built with createElement rather than innerHTML — the tags round's reasoning
  // applies verbatim: a user-entered domain is never re-serialised into markup,
  // so it cannot become markup.

  // The note's line is RESERVED, not collapsed — it uses its own `is-quiet`
  // state class rather than the global `.hidden` (which is display:none
  // !important and would collapse the line, moving the toggle below it by 21px
  // every time the note appeared or cleared).
  function clearFocusBlockError() {
    var el = $("#focus-block-error");
    if (el && !el.classList.contains("is-quiet")) {
      el.classList.add("is-quiet");
      el.textContent = "";
    }
  }

  function showFocusBlockError(message) {
    var el = $("#focus-block-error");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("is-quiet");
  }

  function renderFocusBlockingSection() {
    var listHost = $("#focus-block-list");
    if (!listHost) return;

    var entries = Storage.getBlockList(data);
    listHost.textContent = "";
    entries.forEach(function (entry) {
      var li = document.createElement("li");
      li.className = "focus-block-row";

      var name = document.createElement("span");
      name.className = "focus-block-domain";
      name.textContent = entry;
      name.title = entry + " — subdomains included";

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "focus-block-remove";
      remove.textContent = "×";
      remove.title = "Remove " + entry;
      remove.setAttribute("aria-label", "Remove " + entry);
      remove.addEventListener("click", async function () {
        try {
          if (await Storage.removeBlockedDomain(data, entry)) {
            clearFocusBlockError();
            renderFocusBlockingSection();
          }
        } catch (err) {
          console.error("[LaunchPad] Focus blocking: remove failed", err);
        }
      });

      li.appendChild(name);
      li.appendChild(remove);
      listHost.appendChild(li);
    });

    var emptyEl = document.querySelector(".focus-block-empty");
    if (emptyEl) emptyEl.classList.toggle("hidden", entries.length > 0);

    var toggle = $("#focus-auto-arm-toggle");
    if (toggle) toggle.checked = Storage.getFocusSettings(data).autoArmDuringWork;
  }

  // Empty input is a NO-OP, not an error: pressing Enter on an empty box is a
  // slip, and answering it with a red note would be scolding the user for nothing.
  async function commitFocusBlockAdd() {
    var input = $("#focus-block-input");
    if (!input) return;
    if (!(input.value || "").trim()) return;

    var res;
    try {
      res = await Storage.addBlockedDomain(data, input.value);
    } catch (err) {
      console.error("[LaunchPad] Focus blocking: add failed", err);
      return;
    }
    if (!res || !res.ok) {
      showFocusBlockError((res && res.message) || "Could not add that site.");
      return;
    }
    input.value = "";
    clearFocusBlockError();
    renderFocusBlockingSection();
  }

  function bindFocusBlockingControls() {
    safeOn("#focus-block-add-btn", "click", commitFocusBlockAdd);
    var input = $("#focus-block-input");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); commitFocusBlockAdd(); }
      });
      // Typing clears a stale error, matching the tag-create form's behaviour.
      input.addEventListener("input", clearFocusBlockError);
    }
    safeOn("#focus-auto-arm-toggle", "change", async function (e) {
      try {
        await Storage.setFocusAutoArm(data, e.target.checked);
      } catch (err) {
        console.error("[LaunchPad] Focus blocking: auto-arm save failed", err);
      }
    });
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
  // [Trash] Is the trashed-tags block revealed? Transient by design — in-memory
  // only, never written to `data`, and reset to false on every panel open, so
  // the default view is always active tags only.
  var proTagsTrashRevealed = false;
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
    var byCreated = function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); };
    // [Trash] Split explicitly instead of sorting the mixed list. The old
    // createdAt-only sort put trashed tags wherever their age landed — usually
    // ABOVE the active ones, since they tend to be older — which read as an
    // intentional inversion. Active-first is now structural, not incidental.
    var activeTags = tags.filter(function (t) { return !t.deletedAt; }).sort(byCreated);
    var trashedTags = tags.filter(function (t) { return !!t.deletedAt; }).sort(byCreated);

    var subtitle = document.querySelector(".pro-tags-subtitle");
    var activeCount = activeTags.length;
    var archivedCount = trashedTags.length;
    if (subtitle) {
      subtitle.textContent = "";
      if (tags.length > 0) {
        subtitle.appendChild(document.createTextNode(
          activeCount + " active tag" + (activeCount === 1 ? "" : "s") +
          (archivedCount > 0 ? " · " + archivedCount + " in trash" : "")
        ));
        // The counter line doubles as the disclosure. Built as a real element
        // rather than innerHTML so no tag data is ever re-serialised here.
        if (archivedCount > 0) {
          var toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "pro-tags-trash-toggle";
          toggle.textContent = proTagsTrashRevealed ? "Hide" : "Show";
          toggle.addEventListener("click", function () {
            proTagsTrashRevealed = !proTagsTrashRevealed;
            renderProTagsSection();
          });
          subtitle.appendChild(document.createTextNode(" — "));
          subtitle.appendChild(toggle);
        }
      }
    }

    var emptyEl = document.querySelector(".pro-tags-empty");
    if (emptyEl) {
      if (tags.length === 0) emptyEl.classList.remove("hidden");
      else emptyEl.classList.add("hidden");
    }

    // Trashed rows only exist in the DOM while revealed — hidden is the default
    // on every panel open (proTagsTrashRevealed is transient, never persisted).
    var visibleTags = activeTags.concat(proTagsTrashRevealed ? trashedTags : []);

    listHost.innerHTML = visibleTags.map(function (tag) {
      var archived = !!tag.deletedAt;
      var rowCls = "pro-tag-row" + (archived ? " archived" : "");
      var rowTitle = archived ? ' title="In trash — restore within 30 days."' : "";
      return '<li class="' + rowCls + '" data-tag-id="' + escapeHtml(tag.id) + '"' + rowTitle + '>' +
        '<button class="pro-tag-color-swatch" type="button" style="background:' + escapeHtml(tag.color) + '" aria-label="Change color"></button>' +
        '<span class="pro-tag-name">' + escapeHtml(tag.name) + '</span>' +
        (archived
          ? '<span class="pro-tag-archived-label">in trash</span>' +
            '<button class="pro-tag-restore" type="button" title="Restore this tag">Restore</button>' +
            '<span class="pro-tag-restore-error hidden" role="alert"></span>'
          : '') +
        '<button class="pro-tag-delete" type="button" aria-label="Delete tag" title="Delete tag">🗑</button>' +
      '</li>';
    }).join("");

    listHost.querySelectorAll(".pro-tag-row").forEach(function (row) {
      var archivedRow = row.classList.contains("archived");
      if (archivedRow) {
        // Trashed rows stay read-only apart from Restore: no rename, no
        // recolor, no re-delete (the delete button is display:none for them).
        var restoreEl = row.querySelector(".pro-tag-restore");
        if (restoreEl) restoreEl.addEventListener("click", function (e) {
          e.stopPropagation();
          handleTagRestoreClick(row, row.dataset.tagId);
        });
        return;
      }
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

  // The SELECTION RING is ink-on-fill too, and it was white on every fill. A
  // 2px white ring on #F8E71C measures 1.28:1 against the swatch it is meant to
  // mark — four of the eight palette colours failed the 3:1 non-text floor, and
  // on a light wallpaper the settings panel is white glass, so the ring loses its
  // outer edge as well and the selected state disappears entirely.
  //
  // Carried as a custom property rather than an inline border-color so the hover
  // rule still wins when the pointer is over the swatch: an inline declaration
  // would beat :hover and silently kill that affordance.
  function tagPaletteSwatchHTML(color, selected) {
    var cls = "pro-tag-swatch" + (selected ? " selected" : "");
    return '<button type="button" class="' + cls + '" style="background:' + escapeHtml(color) + ';--swatch-ink:' + tagTextColorFor(color) + '" data-color="' + escapeHtml(color) + '" aria-label="Color ' + escapeHtml(color) + '"></button>';
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

  // [Trash] Restore a trashed tag. The one blocking case is a name collision:
  // an active tag may have taken this name while it sat in the bin, so the
  // storage layer refuses and we surface its message inline on the row rather
  // than as a toast — the error belongs next to the row that caused it, and the
  // user's next action (rename that active tag) is right there in the list.
  async function handleTagRestoreClick(row, tagId) {
    var note = row ? row.querySelector(".pro-tag-restore-error") : null;
    if (note) { note.textContent = ""; note.classList.add("hidden"); }
    var res;
    try {
      res = await Storage.restoreTag(data, tagId);
    } catch (err) {
      console.error("[LaunchPad] Tags: restore failed", err);
      return;
    }
    if (res && res.err === "duplicate") {
      if (note) { note.textContent = res.message; note.classList.remove("hidden"); }
      return;
    }
    if (!res) return;                       // unknown id — nothing to say
    // Keep the block revealed so the row visibly leaves the trash group and
    // reappears above; collapsing here would look like the tag vanished.
    renderProTagsSection();
    showToast('Tag "' + res.name + '" restored.');
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
    // The promise this makes is now TRUE: Restore lives on the trashed row,
    // reachable via the "Show" disclosure on this section's counter line. Before
    // that existed this tooltip claimed a recovery path that did not exist.
    btn.title = "Click again to confirm — restore from Pro Settings > Tags within 30 days.";
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
  // [QA 2026-08-10] All feedback from this control now lands in the inline line
  // under the button, including the two precondition failures. The bottom toast
  // is GONE for this action: it reported the answer at the far edge of the
  // viewport, which QA found easy to miss and not instinctive. Nothing here is
  // cross-tab -- the click, the panel, and the answer are all in one tab, and
  // other tabs learn about the state change through storage.onChanged as
  // before -- so the toast was carrying no weight the line cannot carry closer
  // to the eye. Other actions' toasts are untouched.
  async function handleLicenseCheckNow() {
    var btn = $("#pro-license-check");
    if (!btn) return;
    if (!data.pro || !data.pro.licenseKey) {
      // Defensive only: shouldShowLicenseControls hides this row without a
      // stored key, so a click cannot reach here.
      renderProLicenseCheckStatus({ ok: false, error: "invalid_args" });
      return;
    }
    if (typeof LicenseClient === "undefined") {
      renderProLicenseCheckStatus({ ok: false, error: "module_missing" });
      return;
    }
    // ONE indicator, not two competing ones. The LINE owns the progress state;
    // the button only goes inert and KEEPS its label, so what you clicked is
    // still readable while it runs.
    btn.disabled = true;
    renderProLicenseCheckStatus({ checking: true });
    try {
      var result = await LicenseClient.ensureValidated(data, data.pro.licenseKey, { force: true });
      await Storage.saveAll(data);
      renderProSubscriptionSection();
      // renderProLicenseSection() would idle-render the line ("last verified
      // today"), overwriting the fresh "verified just now" we are about to set,
      // so the status render is ordered LAST on purpose.
      renderProLicenseSection();
      applyCtaState(data);
      renderProLicenseCheckStatus(result);
    } catch (err) {
      renderProLicenseCheckStatus({ ok: false, error: "threw", message: (err && err.message) || "" });
    } finally {
      btn.disabled = false;
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
    applyTextSize(Storage.getTextSize(data));
    applySearch();

    // [1.0.19 D2] First-run seeding, behind the SAME latch the wizard used.
    // The grid teaches itself now: instead of a modal takeover, a fresh install
    // gets obviously-example content it can play with and then clear.
    //
    // Both halves of the condition are load-bearing. The flag alone would
    // re-seed nobody but also protect nobody who cleared their grid; the
    // content heuristic alone would re-seed a user who deleted everything,
    // repeatedly. Together: seed exactly once, for genuinely new installs.
    //
    // No background is written here — loadBackground above already substitutes
    // and persists DEFAULT_BG when no record exists (P8).
    var onboardingDone = await Storage.getOnboardingComplete();
    if (!onboardingDone && Bookmarks.isFirstRun(data)) {
      try {
        await Storage.seedDemoContent(data);
      } catch (err) {
        console.error("[LaunchPad] First-run seeding failed:", err);
      }
      await Storage.setOnboardingComplete();
    }

    render();
    refreshOldFavicons();
    bindEvents();
    bindTabBar();
    bindProSettings();
    bindUpgradeCta();
    bindWorkspaceSwitcher();
    bindActiveTaskWidget();
    applyAccessLevelUI();
    startCtaCountdown();
    Bookmarks.bindEvents(function (newData) {
      data = newData;
      render();
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

    // [2.0] Pro activation celebration. FIRST, and synchronously, because the
    // three guards below consult proOnboardingBusy — this must have decided
    // before any of them looks. Only ever fires on the first open after a real
    // purchase; every other open it is a single flag read.
    try {
      maybeShowProCelebration();
    } catch (err) {
      console.error("[LaunchPad] Pro celebration failed", err);
      proOnboardingBusy = false;    // never let a throw here mute the surfaces below
    }

    // Check for promo toasts (delayed) and right-click tip.
    // [2.0] Both defer to the Pro celebration for THIS open — see the
    // arbitration note on maybeShowProCelebration for why the guard lives here
    // and not inside them. The promo one is re-checked at fire time (2s later)
    // rather than now, so a buyer who dismisses the card quickly still gets it.
    setTimeout(function () {
      if (isProOnboardingBusy()) return;
      checkPromoToast();
    }, 2000);
    if (!isProOnboardingBusy()) checkRightClickTip();

    // [1.0.23/1.0.24] Achievements on-open — beside the checkPromoToast
    // precedent. Runs the day-opened engine tick then delivers ONE queued badge
    // splash. Fire-and-forget: it owns its try/catch.
    // [2.0] Also deferred: it PERSISTS its dequeue before painting, so calling
    // it and suppressing later would eat a badge nobody ever saw. A trial user
    // who earned badges and then bought is exactly the collision case.
    if (!isProOnboardingBusy()) runAchievementsOnOpen();

    // [R3] Getting-Started one-time HONEST retro — free-tier, runs for everyone.
    // currentBg is set (loadBackground ran above), so we can pass whether a
    // non-default background is persisted for step 6. Guarded by retroDone; step
    // 2 (right-click) never retro-ticks.
    try {
      if (Storage.retroTickGettingStarted(data, { hasNonDefaultBackground: !!(currentBg && currentBg !== DEFAULT_BG) })) {
        await Storage.saveAll(data);
        refreshGettingStartedIfOpen();
      }
    } catch (err) {
      console.error("[LaunchPad] Getting-Started retro failed", err);
    }

    var readyWs = Storage.getActiveWorkspace(data);
    var readyGroups = (readyWs && readyWs.groups) || [];
    console.log("[LaunchPad] Ready —", readyGroups.length, "group(s),",
      readyGroups.reduce(function (n, g) { return n + g.shortcuts.length; }, 0), "shortcut(s)");
  }

  // [1.0.23/1.0.24] Achievements on-open. Pro-GATED — achievements are a Pro
  // feature, and gating here keeps a free user's storage untouched (the completion
  // choke points are already Pro-only surfaces; pendingCelebrations therefore
  // only ever accrue from Pro paths). Two phases in one open:
  //   1. day-opened engine tick — retro seed (first open after the update),
  //      open-day streak, First Week + Deep Diver; queues any unlocks.
  //   2. deliver ONE badge splash — the OLDEST queued unlock (oldest-first, one
  //      per open; the rest wait for the next open).
  //
  // CONSUME-ON-SHOW ordering (D8): the dequeue is PERSISTED before the overlay
  // is rendered. A crash/tab-close between show and dismiss therefore cannot
  // double-play — the entry is already gone from storage. At-most-once is the
  // right contract for a non-critical nicety: a missed splash beats a repeated
  // one, and if the persist itself fails we DON'T show (the entry is still in
  // storage and simply retries next open — no loss, no double-play). Both phases
  // ride ONE saveAll.
  async function runAchievementsOnOpen() {
    if (!isProAccessibleLevel(currentAccessLevel())) return;
    var maxLongest = 0;
    try {
      if (typeof Tracking !== "undefined" && Tracking.maxLongestSessionMs) {
        maxLongest = await Tracking.maxLongestSessionMs();
      }
    } catch (err) {
      console.error("[LaunchPad] Achievements: tracking read failed", err);
    }
    var dayRes;
    try {
      dayRes = Storage.achievementsOnDayOpened(data, { maxLongestSessionMs: maxLongest });
    } catch (err) {
      console.error("[LaunchPad] Achievements: day-opened evaluation failed", err);
      return;
    }

    var entry = null;
    try {
      entry = Storage.dequeueCelebration(data, "badge-unlock");  // shift oldest (mutate-only)
    } catch (err) {
      console.error("[LaunchPad] Achievements: dequeue failed", err);
    }

    var changed = (dayRes && dayRes.changed) || !!entry;
    if (changed) {
      try {
        await Storage.saveAll(data);
      } catch (err) {
        console.error("[LaunchPad] Achievements: save failed", err);
        // Persist failed — do NOT show a dequeued entry (it is still in storage
        // and will retry next open). Prevents a double-play.
        return;
      }
    }
    if (entry) showBadgeSplash(entry);
  }

  // [1.0.24 item 2] The one-shot Home badge splash. Dark-glass card mounted on
  // #content, sat-sweep idiom (glow + scale, no confetti), ~3s auto-dismiss +
  // click-to-dismiss. CSS-only animation with its OWN reduced-motion fallback
  // (the audit found none to inherit). The queue entry was already consumed
  // (persisted) before this runs — this function only paints and tears down.
  function showBadgeSplash(entry) {
    var meta = INSIGHTS_BADGE_BY_ID[entry && entry.badgeId];
    if (!meta) return;  // unknown/removed badge id — already consumed, safe to skip
    var host = document.getElementById("content");
    if (!host) return;

    var overlay = document.createElement("div");
    overlay.className = "badge-splash";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML =
      '<div class="badge-splash-card">' +
        '<div class="badge-splash-glow" aria-hidden="true"></div>' +
        '<div class="badge-splash-icon">' + renderBadgeGlyph(meta.glyph) + '</div>' +
        '<div class="badge-splash-eyebrow">Achievement unlocked</div>' +
        '<div class="badge-splash-title">' + escapeHtml(meta.title) + '</div>' +
        '<div class="badge-splash-desc">' + escapeHtml(meta.desc) + '</div>' +
      '</div>';

    var timer = null;
    var dismissed = false;
    var dismiss = function () {
      if (dismissed) return;
      dismissed = true;
      if (timer) clearTimeout(timer);
      overlay.classList.add("is-leaving");
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 320);
    };
    overlay.addEventListener("click", dismiss);
    host.appendChild(overlay);
    // Enter on the next frame so the CSS transition runs from the initial state.
    requestAnimationFrame(function () { overlay.classList.add("is-in"); });
    timer = setTimeout(dismiss, 3000);
  }

  // ===== [2.0] Pro activation celebration + first-Pro tour =====
  //
  // A buyer's auto-activation CLOSES the checkout tab (the earned close,
  // 0e76a76), so their very next act is opening a new tab — which until now
  // acknowledged the purchase with nothing but a quietly different badge.
  //
  // ARBITRATION: this owns the render. Three other surfaces can auto-fire on
  // open — the right-click tip, the promo/rate toast, and the achievement badge
  // splash — and all three are suppressed for THIS open at their CALL SITES in
  // init, not inside themselves. That placement is the whole trick: each of them
  // consumes something at the moment it decides to show (the promo scheduler
  // writes lastPromo/lastPromoOpen and its milestones are exact-equality, and
  // the badge splash PERSISTS its dequeue before painting), so a guard placed
  // inside would consume the surface without ever showing it — a silent
  // permanent loss, not a deferral. Guarded at the call site, nothing is read,
  // nothing is written, and each fires normally on the next tab open.
  var proOnboardingBusy = false;

  // True while the celebration card or the tour is on screen.
  function isProOnboardingBusy() { return proOnboardingBusy; }

  // The trigger. Sync (data is already loaded by init) so that the guards above
  // can rely on proOnboardingBusy being set before they are consulted.
  function maybeShowProCelebration() {
    if (!data || data.proCelebrated === true) return false;
    if (typeof ProAccess === "undefined" || !ProAccess.isRealProEntitlement) return false;
    if (!ProAccess.isRealProEntitlement(data)) return false;
    showProCelebration();
    return true;
  }

  var PRO_TOUR_STEPS = [
    { sel: '.tab[data-tab="tasks"]',     text: "Plan it: tasks, goals, and recurring work live here." },
    { sel: '.tab[data-tab="dashboard"]', text: "See your focused time add up across every workspace." },
    { sel: '.tab[data-tab="insights"]',  text: "Deep work, tags, sites, top tasks — measured automatically." },
    { sel: '#active-task-pill',          text: "Start a focus session here; blocking arms itself while you work." }
  ];

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Both dismiss actions land here. Per the brief the flag is set on DISMISS
  // rather than on show, which differs from the badge splash's consume-on-show
  // (D8) on purpose: a tab closed while the card is still up means the buyer
  // never acknowledged it, and replaying it once is better than a buyer who paid
  // and got nothing. The no-op guard in markProCelebrated makes the double call
  // (dismiss, then the tour's own exit) free.
  async function setProCelebrated() {
    try {
      if (Storage.markProCelebrated(data)) await Storage.saveAll(data);
    } catch (err) {
      console.error("[LaunchPad] Pro celebration: flag save failed", err);
    }
  }

  function showProCelebration() {
    var host = document.getElementById("content");
    if (!host) return;
    if (document.querySelector(".pro-celebrate")) return;
    proOnboardingBusy = true;

    var overlay = document.createElement("div");
    overlay.className = "pro-celebrate";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pro-celebrate-title");
    overlay.innerHTML =
      '<div class="pro-celebrate-card">' +
        '<div class="pro-celebrate-glow" aria-hidden="true"></div>' +
        '<div class="pro-celebrate-eyebrow">Pro activated</div>' +
        '<div class="pro-celebrate-title" id="pro-celebrate-title">You’re Pro</div>' +
        '<div class="pro-celebrate-desc">Everything is unlocked. Here’s your thirty-second lay of the land.</div>' +
        '<div class="pro-celebrate-actions">' +
          '<button type="button" class="pro-celebrate-btn is-primary" data-pro-celebrate-tour>Take the tour</button>' +
          '<button type="button" class="pro-celebrate-btn" data-pro-celebrate-skip>Explore on my own</button>' +
        '</div>' +
      '</div>';

    var burst = null;
    var teardown = function (startTour) {
      if (overlay.dataset.closing === "1") return;
      overlay.dataset.closing = "1";
      if (burst) burst.stop();
      document.removeEventListener("keydown", onKey, true);
      overlay.classList.add("is-leaving");
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        // Hand straight to the tour so the surface is never unowned; only the
        // no-tour path releases the arbitration lock here.
        if (startTour) startProTour();
        else proOnboardingBusy = false;
      }, 320);
      setProCelebrated();
    };
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); teardown(false); }
    }

    overlay.addEventListener("click", function (e) {
      if (e.target.closest("[data-pro-celebrate-tour]")) return teardown(true);
      if (e.target.closest("[data-pro-celebrate-skip]")) return teardown(false);
    });
    document.addEventListener("keydown", onKey, true);

    host.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("is-in"); });

    // Particle burst: hand-rolled canvas, no library, no asset, no sound.
    // Under reduce it is not merely stilled but NEVER CREATED — the brief's
    // "card only" — so there is no canvas to composite and nothing animates.
    if (!prefersReducedMotion()) burst = startProBurst(overlay);
    var focusTarget = overlay.querySelector("[data-pro-celebrate-tour]");
    if (focusTarget) focusTarget.focus();
  }

  // ~1.4s one-shot burst that settles: particles decelerate under gravity and
  // fade, then the canvas is removed. Deliberately short of the 2s ceiling.
  function startProBurst(overlay) {
    var canvas = document.createElement("canvas");
    canvas.className = "pro-celebrate-burst";
    canvas.setAttribute("aria-hidden", "true");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = overlay.clientWidth || window.innerWidth;
    var h = overlay.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    overlay.insertBefore(canvas, overlay.firstChild);

    var ctx = canvas.getContext("2d");
    if (!ctx) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); return null; }
    ctx.scale(dpr, dpr);

    // Gold family, matching the badge-splash accent rather than inventing one.
    var COLORS = ["#ffd66e", "#ffb347", "#ffffff", "#8ab4f8"];
    var originX = w / 2;
    var originY = h / 2;
    var parts = [];
    for (var i = 0; i < 90; i++) {
      var angle = (Math.PI * 2 * i) / 90 + (Math.random() * 0.4 - 0.2);
      var speed = 180 + Math.random() * 260;
      parts.push({
        x: originX, y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 90,     // slight upward bias
        size: 2 + Math.random() * 3.5,
        color: COLORS[i % COLORS.length],
        spin: Math.random() * Math.PI
      });
    }

    var DURATION = 1400;
    var raf = null;
    var start = null;
    var stopped = false;
    function stop() {
      if (stopped) return;
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    function frame(ts) {
      if (stopped) return;
      if (start === null) start = ts;
      var elapsed = ts - start;
      var prev = frame.last === undefined ? ts : frame.last;
      var dt = Math.min((ts - prev) / 1000, 0.05);   // clamp: a backgrounded tab
      frame.last = ts;                               // must not teleport particles
      if (elapsed >= DURATION) return stop();

      var fade = 1 - (elapsed / DURATION);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = fade * fade;                 // ease-out the whole field
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        p.vx *= 0.982;                               // drag, so it SETTLES
        p.vy = p.vy * 0.982 + 620 * dt;              // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.spin += dt * 6;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { stop: stop };
  }

  // ---- The tour ------------------------------------------------------------
  //
  // RESIZE: these coach marks REPOSITION, they do not drift-close. Doctrine N2
  // makes drift-close the default for anchored body-mounted popovers because an
  // orphaned popover is worse than a closed one — but N2 also carries the
  // #nest-rename-dialog exception: do not close on resize when closing DESTROYS
  // something the user cannot get back. That applies here with force. Any exit
  // sets the one-time flag, so a drift-close on resize would not just interrupt
  // the tour, it would burn it permanently for a user who merely dragged a
  // window. Repositioning is the same cost (one rect read) and cannot lose
  // anything, so both resize and scroll recompute. Listeners are per-tour and
  // paired with removal in endProTour, the second mechanism N2 sanctions.
  var proTourState = null;

  function startProTour() {
    if (proTourState) return;
    proOnboardingBusy = true;
    proTourState = { index: 0, mark: null, onMove: null, onKey: null };

    var mark = document.createElement("div");
    mark.className = "pro-tour-mark";
    mark.setAttribute("role", "dialog");
    mark.setAttribute("aria-live", "polite");
    document.body.appendChild(mark);
    proTourState.mark = mark;

    mark.addEventListener("click", function (e) {
      if (e.target.closest("[data-pro-tour-next]")) return advanceProTour();
      if (e.target.closest("[data-pro-tour-skip]")) return endProTour();
    });
    proTourState.onMove = function () { positionProTourMark(); };
    proTourState.onKey = function (e) {
      if (e.key === "Escape") { e.stopPropagation(); endProTour(); }
    };
    window.addEventListener("resize", proTourState.onMove);
    window.addEventListener("scroll", proTourState.onMove, true);
    document.addEventListener("keydown", proTourState.onKey, true);

    renderProTourStep();
  }

  function advanceProTour() {
    if (!proTourState) return;
    if (proTourState.index >= PRO_TOUR_STEPS.length - 1) return endProTour();
    proTourState.index++;
    renderProTourStep();
  }

  // Visible enough to point at. Rect-based on purpose (see the note at the call
  // site): a fixed-position anchor has no offsetParent but is perfectly visible.
  function isTourAnchorVisible(el) {
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var cs = window.getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  }

  function clearProTourRing() {
    var ringed = document.querySelectorAll(".pro-tour-target");
    for (var i = 0; i < ringed.length; i++) ringed[i].classList.remove("pro-tour-target");
  }

  function renderProTourStep() {
    if (!proTourState) return;
    var step = PRO_TOUR_STEPS[proTourState.index];
    var last = proTourState.index === PRO_TOUR_STEPS.length - 1;
    var target = document.querySelector(step.sel);
    // An anchor that is not on screen would strand the mark mid-viewport. Skip
    // straight past it rather than pointing at nothing. (The pill is hidden for
    // free users; a Pro user has it, but this keeps the tour honest either way.)
    //
    // Measured by RECT, not offsetParent: offsetParent is null for every
    // position:fixed element, and #active-task-pill is fixed — so the
    // offsetParent test silently skipped the pill step for everyone, tour of
    // four quietly becoming a tour of three. Caught at runtime, not by reading.
    if (!target || !isTourAnchorVisible(target)) {
      if (last) return endProTour();
      proTourState.index++;
      return renderProTourStep();
    }
    // Move the ring. It used to be added to each new anchor without being taken
    // off the previous one, so by step 3 three tabs were ringed at once and only
    // endProTour's sweep cleaned up.
    clearProTourRing();
    proTourState.mark.innerHTML =
      '<div class="pro-tour-arrow" aria-hidden="true"></div>' +
      '<div class="pro-tour-text">' + escapeHtml(step.text) + '</div>' +
      '<div class="pro-tour-foot">' +
        '<span class="pro-tour-count">' + (proTourState.index + 1) + ' of ' + PRO_TOUR_STEPS.length + '</span>' +
        '<span class="pro-tour-btns">' +
          (last ? '' : '<button type="button" class="pro-tour-btn is-quiet" data-pro-tour-skip>Skip</button>') +
          '<button type="button" class="pro-tour-btn is-primary" data-pro-tour-next>' + (last ? "Done" : "Next") + '</button>' +
        '</span>' +
      '</div>';
    target.classList.add("pro-tour-target");
    proTourState.targetEl = target;
    positionProTourMark();
    var nextBtn = proTourState.mark.querySelector("[data-pro-tour-next]");
    if (nextBtn) nextBtn.focus();
  }

  function positionProTourMark() {
    if (!proTourState || !proTourState.targetEl) return;
    var mark = proTourState.mark;
    var r = proTourState.targetEl.getBoundingClientRect();
    var mw = mark.offsetWidth || 260;
    var mh = mark.offsetHeight || 96;
    var GAP = 12;
    // Below the anchor by default; flip above when there is no room. Clamped to
    // the viewport on both axes so a tab at the edge cannot push it off screen.
    var below = (r.bottom + GAP + mh) <= window.innerHeight;
    var top = below ? (r.bottom + GAP) : (r.top - GAP - mh);
    var left = r.left + (r.width / 2) - (mw / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - mh - 8));
    mark.style.top = Math.round(top) + "px";
    mark.style.left = Math.round(left) + "px";
    mark.classList.toggle("is-above", !below);
    // The arrow tracks the anchor's centre even after the mark has been clamped.
    var arrow = mark.querySelector(".pro-tour-arrow");
    if (arrow) {
      var cx = r.left + r.width / 2 - left;
      arrow.style.left = Math.round(Math.max(14, Math.min(cx, mw - 14))) + "px";
    }
    mark.classList.add("is-in");
  }

  function endProTour() {
    if (!proTourState) return;
    var st = proTourState;
    proTourState = null;
    if (st.onMove) {
      window.removeEventListener("resize", st.onMove);
      window.removeEventListener("scroll", st.onMove, true);
    }
    if (st.onKey) document.removeEventListener("keydown", st.onKey, true);
    clearProTourRing();
    if (st.mark && st.mark.parentNode) st.mark.parentNode.removeChild(st.mark);
    proOnboardingBusy = false;
    setProCelebrated();
  }

  // [1.0.24 item 3] IMMEDIATE, in-place goal-completion celebration (resolves the
  // spec'd-never-built goal celebration). A sat-sweep-idiom pass over the goal's
  // card when it is mounted on the visible Tasks tab; best-effort and once — if
  // the card is not mounted (Tasks tab hidden, e.g. completed via the pill), it
  // is a no-op and the existing satComplete toast still names the goal. NOT
  // queued — goal completions are the "immediate" delivery type (D8), distinct
  // from the deferred badge splash. Reduced-motion is honored by the CSS.
  function celebrateGoalCompletion(goalId) {
    if (!goalId) return;
    var sel = (window.CSS && CSS.escape) ? CSS.escape(goalId) : String(goalId).replace(/"/g, '\\"');
    var card = document.querySelector('.tt-goal-card[data-goal-id="' + sel + '"]');
    if (!card) return;
    card.classList.remove("tt-goal-celebrate");
    void card.offsetWidth;                 // restart the animation if re-fired
    card.classList.add("tt-goal-celebrate");
    setTimeout(function () { card.classList.remove("tt-goal-celebrate"); }, 900);
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
    { name: "restore-session",  selector: "#restore-dropdown",   open: function () { openRestoreDropdown(); },   close: function (opts) { closeRestoreDropdown(opts); } },
    // [1.0.19 D5/D6] Both new panels join the chain so they are mutually
    // exclusive with Settings/Pro Settings/Restore exactly like every other
    // sidebar-locking surface.
    { name: "import",           selector: "#import-panel",       open: function () { openImportPanel(); },      close: function (opts) { closeImportPanel(opts); } },
    { name: "tips",             selector: "#tips-panel",         open: function () { openTipsPanel(); },        close: function (opts) { closeTipsPanel(opts); } }
  ];

  // [1.0.19] Import + Tips panels. Deliberately modelled on the Settings panel
  // (lock the sidebar, force expanded, showSidebarPanel) rather than inventing
  // a second panel idiom.
  // [1.0.19 D13] Click-outside-to-close, for the TWO NEW panels only.
  //
  // AUDIT RESULT driving that scope: the existing sidebar-chain panels do NOT
  // close on outside click. Settings and Pro Settings close only via their X
  // or by openPanel() swapping to another chain panel; Restore Session adds
  // mouseleave (its own, and the sidebar's) but still no outside click. The
  // one surface that does close on an outside click is #history-overlay — a
  // fullscreen modal with a real backdrop (e.target === e.currentTarget),
  // deliberately outside this chain. So this is NOT a consistency fix to
  // match; it is new behaviour on the new panels, and the inconsistency with
  // the long-shipped panels is flagged as a follow-up rather than changed
  // here. No Escape handling exists for any chain panel, and none is added.
  //
  // Two exclusions make it behave: the panel itself (so interactive children
  // like Tips' Restore button work), and the panel's OWN sidebar trigger —
  // without that second one the trigger click would close the panel here and
  // then openPanel would immediately reopen it, so it could never be toggled
  // shut from its own button.
  var simplePanelOutside = null;
  var simplePanelPress = null;
  var outsidePressPending = false;

  // [1.0.19 D18] Surfaces that spawn ABOVE an open panel. z-index confirms the
  // layering is already correct — modals and the picker sit at 2000, history at
  // 1500, these panels at 1200 — so they coexist; what was missing was telling
  // the outside-click handler that a click over there is not a click "outside".
  var PANEL_OVERLAY_SELECTORS = [
    "#modal-overlay",       // add-shortcut / edit modal
    "#bg-overlay",          // wallpaper picker
    "#history-overlay",     // history
    "#workspace-dropdown",  // workspace switcher (created dynamically)
    ".tt-context-menu"      // context menus and the Switch dropdown
  ];
  var PANEL_OVERLAY_SELECTOR = PANEL_OVERLAY_SELECTORS.join(",");

  function anyPanelOverlayOpen() {
    for (var i = 0; i < PANEL_OVERLAY_SELECTORS.length; i++) {
      var el = document.querySelector(PANEL_OVERLAY_SELECTORS[i]);
      if (el && !el.classList.contains("hidden")) return true;
    }
    return false;
  }

  function unbindSimplePanelOutside() {
    if (simplePanelOutside) {
      document.removeEventListener("click", simplePanelOutside, true);
      simplePanelOutside = null;
    }
    if (simplePanelPress) {
      document.removeEventListener("mousedown", simplePanelPress, true);
      simplePanelPress = null;
    }
    outsidePressPending = false;
  }

  function bindSimplePanelOutside(sel, triggerSel, closeFn) {
    unbindSimplePanelOutside();

    function isElsewhere(t) {
      if (!t || !t.closest) return false;
      if (t.closest(sel)) return false;
      if (t.closest(triggerSel)) return false;
      if (t.closest(PANEL_OVERLAY_SELECTOR)) return false;
      return true;
    }

    // [1.0.19 D18] The press half of the pair. A click only counts as an
    // outside click if its own MOUSEDOWN also landed outside — i.e. if it was
    // a real press-and-release on the background.
    //
    // That pairing is what defeats the native-dialog case STRUCTURALLY rather
    // than by timing. window.prompt (the Create-a-group flow) blocks the page,
    // and its dismissal produces a stray page click with NO preceding page
    // mousedown — the last real press was on the tip, inside the panel. So the
    // pairing rejects it for the right reason (a release with no matching
    // press is not a click on the background) rather than by racing a timer.
    // It also fixes a pre-existing sibling case for free: press inside the
    // panel, drag out, release — that never should have closed it either.
    simplePanelPress = function (e) {
      outsidePressPending = !anyPanelOverlayOpen() && isElsewhere(e.target);
    };

    simplePanelOutside = function (e) {
      var panel = $(sel);
      if (!panel || panel.classList.contains("hidden")) { unbindSimplePanelOutside(); return; }
      // A press is consumed by exactly one click, however that click arrives.
      var pressWasOutside = outsidePressPending;
      outsidePressPending = false;

      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest(sel)) return;         // inside the panel
      if (t.closest(triggerSel)) return;  // its own trigger — let it toggle
      // Any spawned surface is up, or the click landed in one: not "outside".
      if (anyPanelOverlayOpen()) return;
      if (t.closest(PANEL_OVERLAY_SELECTOR)) return;
      if (!pressWasOutside) return;
      // Deliberately does NOT stopPropagation: the click still reaches its
      // real target, so e.g. the grid's "Pick a background" tile closes this
      // panel AND opens #bg-overlay in the same gesture.
      closeFn();
    };

    // Deferred exactly like satSwitchOutsideHandler, so the click that opened
    // the panel cannot be the one that closes it.
    setTimeout(function () {
      document.addEventListener("mousedown", simplePanelPress, true);
      document.addEventListener("click", simplePanelOutside, true);
    }, 0);
  }

  function openSimplePanel(sel) {
    var panel = $(sel);
    if (!panel) return false;
    hideGroupMenu();
    sidebarLocked = true;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.add("sidebar-locked");
      sidebar.classList.add("expanded");
    }
    showSidebarPanel();
    panel.classList.remove("hidden");
    return true;
  }

  function closeSimplePanel(sel, opts) {
    var panel = $(sel);
    // The already-hidden guard is what keeps a panel swap to exactly ONE
    // close: the outside handler closes it, then openPanel's chain sweep
    // finds it hidden and does nothing.
    if (!panel || panel.classList.contains("hidden")) return;
    panel.classList.add("hidden");
    // Torn down on EVERY close, including the silent chain swap — otherwise a
    // stale listener would keep firing against a hidden panel.
    unbindSimplePanelOutside();
    if (opts && opts.silent) return;
    sidebarLocked = false;
    var sidebar = $("#sidebar");
    if (sidebar) {
      sidebar.classList.remove("sidebar-locked");
      if (!sidebar.matches(":hover")) sidebar.classList.remove("expanded");
    }
    hideSidebarPanel();
  }

  function openImportPanel() {
    var panel = $("#import-panel");
    if (panel && !panel.classList.contains("hidden")) { closeImportPanel(); return; }
    if (openSimplePanel("#import-panel")) {
      bindSimplePanelOutside("#import-panel", "#sb-import", function () { closeImportPanel(); });
    }
  }
  function closeImportPanel(opts) { closeSimplePanel("#import-panel", opts); }

  function openTipsPanel() {
    var panel = $("#tips-panel");
    if (panel && !panel.classList.contains("hidden")) { closeTipsPanel(); return; }
    if (openSimplePanel("#tips-panel")) {
      renderTipsRestoreState();
      renderGettingStarted();
      bindSimplePanelOutside("#tips-panel", "#sb-tips", function () { closeTipsPanel(); });
    }
  }
  function closeTipsPanel(opts) { closeSimplePanel("#tips-panel", opts); }

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

    // [2.0] Text size segmented control — same shape, one row below. Reads
    // through the coercing reader, so a junk stored value shows Medium selected
    // rather than no selection at all.
    var textSize = Storage.getTextSize(data);
    $$(".seg-btn", $("#settings-text-size")).forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.value === textSize);
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

  // [2.0] Text size — the same root-class mechanism as applyIconSize above,
  // deliberately: one apply path, one shape, and MEDIUM is the unclassed base.
  // The class flips the --fs-* ramp in newtab.css and nothing else, so every
  // surface this stylesheet owns moves together — all four tabs, the pill, the
  // panels and modals, the activation celebration, the coach marks.
  //
  // KNOWN BOUNDARY: gate.html is NOT covered. It loads its own gate.css, is
  // already set in large type, and is a transient interstitial the user does not
  // configure from. Out of scope this round, stated rather than discovered.
  //
  // Takes the coerced value from Storage.getTextSize, so an unrecognised stored
  // value can never reach classList as a class name.
  function applyTextSize(size) {
    var html = document.documentElement;
    html.classList.remove("text-size-small", "text-size-large");
    if (size === "small") html.classList.add("text-size-small");
    else if (size === "large") html.classList.add("text-size-large");
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

  // Toast with an Undo action link and a fixed lifetime (default 5s). Reuses the
  // single #open-all-toast surface; rebuilds its content each call (textContent
  // ="" drops any prior message/undo button, so a newer toast cleanly replaces
  // an older one). onUndo fires only if Undo is clicked before the toast hides.
  function showUndoToast(message, onUndo, durationMs) {
    var toast = $("#open-all-toast");
    if (!toast) return;
    var dur = durationMs || 5000;
    toast.textContent = "";
    var msg = document.createElement("span");
    msg.className = "toast-message";
    msg.textContent = message;
    var undo = document.createElement("button");
    undo.type = "button";
    undo.className = "toast-undo";
    undo.textContent = "Undo";
    toast.appendChild(msg);
    toast.appendChild(undo);
    toast.classList.add("visible");
    clearTimeout(toast._timer);
    var handled = false;
    var hide = function () { toast.classList.remove("visible"); };
    toast._timer = setTimeout(hide, dur);
    undo.addEventListener("click", function () {
      if (handled) return;      // guard against a double-click after hide
      handled = true;
      clearTimeout(toast._timer);
      hide();
      if (typeof onUndo === "function") onUndo();
    });
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
      applyTextSize(Storage.getTextSize(data));
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
      return '<button type="button" class="pro-tag-swatch' + (selected ? " selected" : "") + '" data-color="' + c + '" style="background:' + c + ';--swatch-ink:' + tagTextColorFor(c) + '"></button>';
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

    // [R3] Checklist step 3 (drag-to-nest) rides this write. Dragging a DEMO
    // example tile is sandbox play (D18), not the user organizing — it does not
    // tick.
    if (!Storage.isDemoShortcut(shortcut)) Storage.recordChecklistStep(data, Storage.GS_STEPS.NEST);
    await Storage.saveAll(data);
    data = await Storage.getAll();
    render();
    refreshGettingStartedIfOpen();
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

  // ===== [1.0.16 v3] Active-task surface (docked card + slim pill) =====
  //
  // The engine's first visible surface, in the top-right fixed chrome on EVERY
  // tab, with a frosted fill so its text is legible on any wallpaper. v3
  // (DIRECTION v3) makes the expanded state an ALWAYS-OPEN DOCKED CARD — it is
  // furniture, so it does NOT close on scroll / outside-click / Escape the way v2's
  // body-mounted panel did. The single #active-task-pill container renders as one
  // of three states, all in place (no body-mounted panel any more):
  //   - CARD (active + expanded): the default. Eyebrow, name, goal · tag, large
  //     ticking timer, Done/Cancel/Switch, paused indicator, cross-workspace
  //     notice — plus a minimize chevron.
  //   - slim PILL, minimized: active task, but the user minimized the card
  //     (data.activeTaskCardMinimized). Clicking the pill restores the card.
  //   - slim PILL, empty: "No active task +". Clicking opens the Switch dropdown.
  // The minimize preference rides `data` (cross-tab via onChanged, default
  // expanded) and is inert to the engine (Storage.setActiveTaskCardMinimized). The
  // Switch dropdown is still a body-mounted menu anchored to the card's Switch
  // button; only IT keeps the scroll-close behavior.
  //
  // Time shown is today's FOCUSED time for the task (D1), not wall-clock since
  // activation. The readout arrives in two halves from
  // Tracking.focusedTodayForTask: `baseMs` (rolled-up + closed) and `openSince`
  // (the open session's start, iff stamped to this task). Live total = baseMs +
  // (now - openSince). The engine writes only at boundaries, so between them
  // storage is static and the 1s tick is pure local arithmetic.

  var satTickTimer = null;
  var satReadout = { taskId: null, baseMs: 0, openSince: null };
  // [2.0 pill clarity] The active task's total over the retention window. Its own
  // cache and its own staleness token, for the same reason dashRecapToken is not
  // dashReadoutToken: both reads fire from one render and a shared counter would
  // make each invalidate the other's guard mid-paint.
  var satTaskWindow = { taskId: null, ms: 0 };
  var satWindowToken = 0;
  var satSwitchMenuEl = null;
  var satSwitchOutsideHandler = null;
  var satSwitchEscapeHandler = null;
  var satSwitchScrollHandler = null;
  var satSwitchResizeHandler = null;
  var satHealing = false;

  function satHasPro() {
    var level = (typeof ProAccess !== "undefined" && data) ? ProAccess.getProAccessLevel(data) : "free";
    return isProAccessibleLevel(level);
  }

  // m:ss, rolling to h:mm:ss past an hour; tabular-nums so the digits don't
  // jitter as they tick. The slim pill and the card's large timer share this ONE
  // formatter — the pill ticks at second resolution too (the honest ticker), just
  // rendered smaller.
  function satFmtLong(ms) {
    // [1.0.18 fix] Clamp at the formatter — the single point EVERY time surface
    // flows through (ACTIVE, FOCUSED, and the pomodoro countdown on card / pill /
    // tab-title). Guarantees no negative or NaN duration can ever render: a phase
    // that runs past phaseEndsAt holds at 0:00 instead of ticking negative. The
    // `!(ms > 0)` form also folds NaN (NaN > 0 is false) to 0. Pomodoro remaining
    // is already floored in satPomoRemainingMs; this is the belt-and-braces that
    // makes the guarantee independent of any caller.
    if (!(ms > 0)) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  // FOCUSED TODAY — the engine's honest per-day reader (secondary line on the
  // card). baseMs (rolled-up + closed) + the live open span iff a session is
  // stamped to this task; static between engine boundaries.
  function satLiveMs() {
    var open = satReadout.openSince ? Math.max(0, Date.now() - satReadout.openSince) : 0;
    return satReadout.baseMs + open;
  }

  // ACTIVE SINCE — a static timestamp, NOT a counter. [1.2.3]
  //
  // The running ACTIVE counter is gone. It was wall-clock since this sitting
  // began (session-anchored, minus paused and idle spans) and it was working as
  // designed when it read 139:52:01 in live use: Chrome had simply not
  // cold-started in six days, so "this sitting" was six days long. Technically
  // true, practically meaningless — a number that fails the product's own
  // honesty standard. The accurate work-output number already existed one line
  // below it (FOCUSED TODAY, engine-measured), so the fix is prominence, not
  // machinery: FOCUSED TODAY takes the headline and activation becomes this
  // timestamp. A timestamp cannot accumulate into absurdity — it reads honest at
  // any age, including after a fortnight of sleep/lid-close.
  //
  // startedAt is the activation stamp: written once by setActiveTask, never
  // rewritten while the task stays active (re-picking the already-active task is
  // idempotent), and explicitly PRESERVED by anchorBrowserSession. It lives in
  // chrome.storage.local, so it survives reload and full browser restart — which
  // is the whole point of showing it instead of a derived elapsed value.
  //
  // The date is dropped when the activation is today ("Active since 9:04") and
  // shown when it is older ("Active since Aug 2, 9:04"): a bare time on a
  // week-old activation would read as this morning. Local calendar-day
  // comparison, matching achDayKey's convention. Locale-respecting via
  // toLocaleTimeString / fmtShortDate, like every other date surface here.
  //
  // NOTE for future readers: the session-anchor machinery (sessionAnchorAt,
  // anchorBrowserSession, the onStartup write in background.js) survives this
  // removal even though the ACTIVE counter was its only READER. The anchor write
  // also normalizes pausedAt, which the [1.0.18] pomodoro freeze still reads
  // (satPomoRemainingMs below, plus setTrackingPaused's resume shift). Removing
  // it would change how a pause held across a browser restart resumes a phase.
  // It is no longer dead machinery serving a dead counter — pausedAt is now what
  // it is load-bearing for.
  function satActiveSinceText() {
    var a = Storage.getActiveTask(data);
    if (!a || typeof a.startedAt !== "number" || !a.startedAt) return "";
    var d = new Date(a.startedAt);
    var now = new Date();
    var isToday = d.getFullYear() === now.getFullYear() &&
                  d.getMonth() === now.getMonth() &&
                  d.getDate() === now.getDate();
    var time;
    try {
      time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "";
    }
    // [2.0] THE SAME STOPWATCH THE ROW SHOWS, on the card, from the same helper —
    // cross-surface consistency was the brief's lean and it is the right call:
    // two surfaces showing "how long have I been on this" with different numbers
    // would be the drift this line's own [1.2.3] note warns about.
    //
    // The timestamp STAYS, and is why the count can be allowed to run long: the
    // count answers "how long", the timestamp answers "since when", and a bare
    // 31:04:12 is uninterpretable without it.
    var since = isToday ? time : (fmtShortDate(a.startedAt) + ", " + time);
    return "Active " + satFmtStopwatch(satActiveElapsedMs()) + " · since " + since;
  }

  // The since-line markup. Rendered on every card branch that carries the
  // FOCUSED TODAY headline; omitted entirely (not blank) when there is no usable
  // stamp, so a legacy record without startedAt leaves no empty row behind.
  function satSinceHtml() {
    var txt = satActiveSinceText();
    return txt ? '<div class="sat-since">' + escapeHtml(txt) + '</div>' : "";
  }

  // The card's headline block: FOCUSED TODAY as the big number, its label, and
  // the quiet since-line. ONE number in ONE place — the old small "focused
  // today" row is gone rather than duplicated under a headline showing the same
  // value. Shared by the idle card and the session-done card so the two cannot
  // drift apart. `paused` keeps the [1.0.17] loud treatment: the label swaps to
  // PAUSED and .is-paused amber-tints the frozen number, which stays honest
  // because a pause closes the engine session — the value really is frozen.
  // [2.0 pill clarity] THE LIVENESS INDICATOR, and the honesty problem in it.
  //
  // The report: an active task sitting at 0:00 reads dead — nothing says the
  // engine is recording. The obvious fix is a pulsing "tracking" dot. The audit
  // says that exact wording would be a lie most of the time, and here is why.
  //
  // The engine only holds an open session when computeDesired resolves a
  // TRACKABLE focused tab, and domainOf() returns null for anything that is not
  // http/https — including this page. So while the user is looking at the pill,
  // the focused tab IS the new-tab page, there is no open session, and nothing
  // is accruing. A dot claiming "tracking" would be claiming it in the one
  // moment it is reliably false.
  //
  // The signal that IS truthful page-side is satReadout.openSince: it is set
  // from Tracking.focusedTodayForTask, which reports openSince only when the
  // engine's own open session is stamped to THIS task. Non-null means genuine
  // accrual, right now. It is null in the normal case above — and also
  // (correctly) when idle, when the window is blurred, when paused, and when
  // tracking is off.
  //
  // So the indicator says two different true things and never conflates them:
  //   openSince set   -> a pulsing dot and the word "Tracking". Genuine accrual.
  //                      Reachable when the page is visible in a non-focused
  //                      window while a tracked site is focused in another.
  //   armed, not open -> a static dot and "Active", with the explanation in the
  //                      tooltip. This is the fallback the brief names, and it
  //                      is what a user looking at the card will nearly always
  //                      see: the task is active and time records as they browse.
  // Paused and tracking-off render NOTHING: the amber .is-paused treatment and
  // the absent readout already own those states, and a second signal beside them
  // would be the duplication [1.2.3] deleted.
  //
  // Reduced motion drops the animation only — the dot and the words are
  // unchanged, so no information lives in the movement.
  function satTrackingIndicatorHtml(paused) {
    if (paused) return "";
    var res = Storage.resolveActiveTask(data);
    if (!res || res.stale) return "";
    if (!Storage.isTrackingEnabled(res.workspace)) return "";
    var live = satReadout.taskId === res.task.id && satReadout.openSince != null;
    var label = live ? "Tracking" : "Active";
    var title = live ? "Recording time for this task right now." : SAT_LIVE_TITLE;
    return '<span class="sat-live' + (live ? " is-live" : "") + '" title="' + escapeHtml(title) + '">' +
        '<span class="sat-live-dot" aria-hidden="true"></span>' +
        '<span class="sat-live-word">' + escapeHtml(label) + '</span>' +
      '</span>';
  }

  // [2.0 pill clarity] The task's own total over the engine's retention window.
  //
  // Filled two-phase like every other engine read on this surface (satTaskWindow
  // is the cache; satRefreshTaskWindow does the read), so the card paints
  // synchronously and the number lands a tick later.
  //
  // THE LABEL IS THE HONESTY CONSTRAINT. The window is the engine's rolling
  // RETENTION_DAYS, not a calendar month, so it cannot say "this month" — on the
  // 3rd of the month that would claim three days of data as thirty. It says
  // "last 30 days", derived from the engine's own constant rather than a
  // restated 30.
  //
  // Zero renders NOTHING. A task with no measured time showing "0m" is noise on
  // every row it touches, and it is also ambiguous: it cannot distinguish "never
  // worked on" from "worked on before the window".
  //
  // It does NOT restate today's figure. The headline directly above is today's
  // number for this task, and a secondary row repeating a value shown above it
  // is exactly the duplication [1.2.3] removed when it deleted the old small
  // "focused today" row.
  function satWindowLineHtml() {
    var ms = satTaskWindow.taskId && satTaskWindow.ms > 0 ? satTaskWindow.ms : 0;
    if (!ms) return "";
    var txt = fmtDurationHM(ms) + " · last " + satWindowDays() + " days";
    return '<div class="sat-window" title="Tracked time for this task over the last ' +
      satWindowDays() + ' days — the engine keeps no more history than that.">' +
      escapeHtml(txt) + '</div>';
  }

  function satHeadlineHtml(paused) {
    return '<div class="sat-time">' + escapeHtml(satFmtLong(satLiveMs())) + '</div>' +
      '<div class="sat-time-label">' +
        '<span class="sat-time-label-text">' + (paused ? 'Paused' : 'Focused today') + '</span>' +
        satTrackingIndicatorHtml(paused) +
      '</div>' +
      satSinceHtml() +
      satWindowLineHtml();
  }

  // ===== Focus sessions (Pomodoro, [1.0.18]) =====
  //
  // Display + control layer only; phase state lives on data.activeTask.
  // pomodoroState and every read goes through Storage.hydratePomodoroState, so
  // the pill never touches the raw slot. The countdown is pure arithmetic off
  // phaseEndsAt, exactly the ACTIVE-counter model, so a tab close loses nothing
  // and reopening re-derives. [A2] adds auto-advance (work<->break with long
  // break per cadence), graceful expiry, and pause integration — all driven from
  // the page's 1s tick / render / visibilitychange via Storage.reconcilePomodoro.
  // Internal identifiers keep the "pomo" name; USER-FACING strings say "Focus
  // session" (D9), phase labels stay Work / Break / Long break.
  var SAT_POMO_RING_R = 44;                        // must match the <circle r> in satCardHtml
  var SAT_POMO_RING_C = 2 * Math.PI * SAT_POMO_RING_R;
  var SAT_POMO_PHASE_LABEL = { work: "Work", shortBreak: "Break", longBreak: "Long break" };
  var SAT_BASE_TITLE = null;                        // page title, captured lazily on first paint
  var satReconciling = false;                       // one reconcile write in flight at a time
  var satPomoDurOpen = false;                        // D10 duration-chip picker open (card-local UI state)

  // Fallback total (ms) of a phase from CURRENT settings — used ONLY when a legacy
  // A1 running phase carries no stamped phaseDurationMs. Fresh phases stamp their
  // duration at start, so the ring reads the phase's own length (A2 D1-AMEND).
  function satPomoPhaseTotalMs(phase) {
    var s = Storage.getPomodoroSettings(data);
    if (phase === "work") return s.workMin * 60000;
    if (phase === "shortBreak") return s.shortBreakMin * 60000;
    if (phase === "longBreak") return s.longBreakMin * 60000;
    return 0;
  }

  // The running phase, or null. totalMs is the STAMPED phaseDurationMs (exact),
  // falling back to current settings only for a legacy A1 phase. Pure read.
  function satRunningPomo() {
    var a = Storage.getActiveTask(data);
    if (!a) return null;
    var ps = Storage.hydratePomodoroState(a.pomodoroState);
    if (!ps.phase || ps.phaseEndsAt == null) return null;
    var totalMs = ps.phaseDurationMs || satPomoPhaseTotalMs(ps.phase);
    return { phase: ps.phase, phaseEndsAt: ps.phaseEndsAt, totalMs: totalMs, cycleCount: ps.cycleCount };
  }

  // [E1] The session-complete DISPLAY state: phase null + cycleCount > 0 + the
  // stored sessionComplete marker (set only by a completed break — Stop and
  // expiry never set it; hydration enforces the encoding). Pure read; null when
  // not in that state. Stored on pomodoroState, so it survives re-render and
  // reload, stays cross-tab consistent, and dies with activeTask like the rest.
  function satSessionComplete() {
    var a = Storage.getActiveTask(data);
    if (!a) return null;
    var ps = Storage.hydratePomodoroState(a.pomodoroState);
    return ps.sessionComplete ? ps : null;
  }

  // Remaining ms in the running phase, floored at 0. [A2 D4] While tracking is
  // paused the countdown FREEZES: it reads phaseEndsAt - pausedAt, exactly what
  // setTrackingPaused's resume shift restores continuity against. Caller passes
  // the record to avoid re-reading per element.
  function satPomoRemainingMs(pomo) {
    var ref = Date.now();
    if (Storage.isTrackingPaused(data)) {
      var a = Storage.getActiveTask(data);
      if (a && a.pausedAt != null) ref = a.pausedAt;
    }
    return Math.max(0, pomo.phaseEndsAt - ref);
  }

  // [E2] Toast copy for a work-phase completion — focus is the protagonist. The
  // minutes are the COMPLETED phase's stamped phaseDurationMs, NOT current
  // settings (a mid-phase settings edit must not misreport what was done); a
  // legacy A1 phase without a stamp falls back to the current work length.
  // 'advanced' only ever means work -> break under E1 semantics, so there is no
  // break-over variant — break end is a session completion (satMaybeReconcile).
  function satPomoAdvanceToast(res) {
    var ms = (typeof res.fromDurationMs === "number" && res.fromDurationMs > 0)
      ? res.fromDurationMs : satPomoPhaseTotalMs("work");
    return "Nice — " + Math.round(ms / 60000) + " min focused. Break time.";
  }

  // ===== [1.0.18 B-2] Boundary chime =====
  //
  // Page-side playback of the selected chime. Two callers: a boundary THIS tab
  // performed (satFireBoundarySound) and the settings preview buttons.
  //
  // Resolves to whether playback actually STARTED, which is not cosmetic: when
  // the service worker advances a phase in the background it asks an open tab to
  // play (sendSoundToTab) and falls back to an offscreen document if the answer
  // is false — Chrome's autoplay policy can refuse audio in a background tab
  // that has never seen a gesture, and the fallback is what keeps the chime
  // audible in that case.
  function satPlayPomodoroSound(sound) {
    var file = Storage.pomodoroSoundFile(sound);
    if (!file) return Promise.resolve(false);          // 'none' or an unknown id
    var audio;
    try {
      audio = new Audio(chrome.runtime.getURL(file));
    } catch (err) {
      console.error("[LaunchPad] Focus session: audio construct failed", err);
      return Promise.resolve(false);
    }
    var p = audio.play();
    if (!p || !p.then) return Promise.resolve(true);   // pre-promise play(): assume it started
    return p.then(function () { return true; }, function (err) {
      console.warn("[LaunchPad] Focus session: chime blocked", err);
      return false;
    });
  }

  // A boundary THIS tab performed. Routed through the SHARED decision function so
  // the page and the worker cannot drift on when a chime is due — in particular
  // 'expired' returns 'none' there, keeping an unattended timeout silent (D3/B1).
  function satFireBoundarySound(action) {
    var sound = Storage.getPomodoroSettings(data).sound;
    var target = Storage.pomodoroSoundTarget({
      context: "page", action: action, sound: sound, tabOpen: true
    });
    if (target !== "page") return;
    satPlayPomodoroSound(sound);
  }

  // The worker's "play this" for a boundary it advanced in the background while
  // this tab happened to be open. Registered at load rather than inside init(),
  // so a boundary firing during page startup still finds a receiver.
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || msg.type !== "lp-pomodoro-sound") return;
      satPlayPomodoroSound(msg.sound).then(function (played) { sendResponse({ played: played }); });
      return true;   // async response — keep the channel open
    });
  }

  // [A2] Reconcile the running phase against the clock, fire-and-forget. Cheap
  // sync early-outs (not running / paused / not yet due) avoid any storage hit on
  // the vast majority of ticks; only the tick that actually crosses phaseEndsAt
  // reaches Storage.reconcilePomodoro (which itself re-reads for the multi-tab
  // guard). One write in flight at a time via satReconciling.
  function satMaybeReconcile() {
    if (satReconciling) return;
    var pomo = satRunningPomo();
    if (!pomo) return;
    if (Storage.isTrackingPaused(data)) return;          // frozen — cannot cross a boundary
    if (Date.now() <= pomo.phaseEndsAt) return;          // still running
    satReconciling = true;
    Storage.reconcilePomodoro(data)
      .then(function (res) {
        if (res.action === "advanced") {
          showToast(satPomoAdvanceToast(res));
          satFireBoundarySound("advanced");
          renderActiveTaskWidget();
        } else if (res.action === "completed") {
          // [E1/E2] Break finished — the session is over; the card re-renders
          // into its session-complete state. Work never auto-starts.
          showToast("Session complete — ready for another?");
          satFireBoundarySound("completed");
          renderActiveTaskWidget();
        } else if (res.action === "expired") {
          showToast("Focus session ended while you were away.");
          renderActiveTaskWidget();
        } else if (res.raced) {
          renderActiveTaskWidget();                       // adopt the other tab's phase
        }
      })
      .catch(function (err) { console.error("[LaunchPad] Focus session: reconcile failed", err); })
      .then(function () { satReconciling = false; });
  }

  // Tab-title countdown: "(24:59) New Tab" while a phase runs, restored to the
  // page's own title otherwise. SAT_BASE_TITLE is captured once, lazily, from the
  // title the HTML shipped with (a fresh load always resets document.title to it,
  // so the capture is never itself a prefixed value). Driven from both
  // renderActiveTaskWidget (state changes) and satPaintTime (the per-second tick).
  function satUpdateTabTitle() {
    if (SAT_BASE_TITLE === null) SAT_BASE_TITLE = document.title;
    var pomo = satRunningPomo();
    var next = pomo ? ("(" + satFmtLong(satPomoRemainingMs(pomo)) + ") " + SAT_BASE_TITLE) : SAT_BASE_TITLE;
    if (document.title !== next) document.title = next;
  }

  // Repaint the time text without a full re-render (which would fight the Switch
  // dropdown, kill hover states, reset the search field). [1.2.3] The pill's time
  // and the card's LARGE headline now show the SAME number — FOCUSED TODAY — so
  // there is one value to paint into both. The card's since-line is deliberately
  // absent from this path: it is a static timestamp that cannot change while the
  // task stays active, so ticking it would be pure waste (renderActiveTaskWidget
  // rebuilds it on the state changes that can actually move it).
  function satPaintTime() {
    var container = $("#active-task-pill");
    if (!container) return;
    // Tab title tracks the countdown (or restores) on every tick.
    satUpdateTabTitle();
    // Pomodoro mode owns the paint: the countdown + ring are the only time
    // surfaces rendered (a RUNNING phase replaces the headline entirely, so
    // .sat-time is not in the DOM), so update those and return. The session-DONE
    // card is not a running phase, so it falls through and paints its headline
    // through the normal path below. .sat-pomo-time covers both the card and the minimized pill.
    var pomo = satRunningPomo();
    if (pomo) {
      var remaining = satPomoRemainingMs(pomo);
      var mmss = satFmtLong(remaining);
      container.querySelectorAll(".sat-pomo-time").forEach(function (el) { el.textContent = mmss; });
      var fill = container.querySelector(".sat-pomo-ring-fill");
      if (fill) {
        var frac = pomo.totalMs > 0 ? Math.max(0, Math.min(1, remaining / pomo.totalMs)) : 0;
        fill.style.strokeDashoffset = String(SAT_POMO_RING_C * (1 - frac));
      }
      // [2.0 timing] The takeover now keeps FOCUSED TODAY beneath the ring, so
      // this branch can no longer return early — .sat-time IS in the DOM during a
      // running phase and would otherwise freeze at whatever it read when the
      // phase started. Falls through to the shared paint below.
    }
    var focusedText = satFmtLong(satLiveMs());
    var pillTime = container.querySelector(".sat-pill-time");
    if (pillTime) pillTime.textContent = focusedText;
    var big = container.querySelector(".sat-time");
    if (big) big.textContent = focusedText;
    // [2.0 timing] The ACTIVE task's row in the Tasks tab rides this same paint —
    // one 1s text write, no second timer, no re-render (A1). Queried from the
    // document rather than the pill container because the row lives in another
    // panel; a text write cannot disturb an open inline rename, which replaces a
    // SIBLING element (.tt-task-name) and leaves this one untouched.
    //
    // The VALUE comes from satRowLiveState, not from focusedText above: while a
    // work phase runs the row shows the session wall-clock instead. Writing
    // focusedText here would make the row claim engine time for a number that is
    // not engine time — the exact blend the switch exists to prevent. The unit
    // word and the tooltip are written in the same pass, so the figure and its
    // label can never be one tick out of step with each other.
    // [2.0] The card's since-line now carries the SAME stopwatch, so it is a
    // ticking surface too and has to be repainted here rather than only at
    // render. Text-only, like every other write in this function.
    var sinceEl = container.querySelector(".sat-since");
    if (sinceEl) {
      var sinceTxt = satActiveSinceText();
      if (sinceTxt) sinceEl.textContent = sinceTxt;
    }
    var liveState = satRowLiveState();
    document.querySelectorAll(".tt-task-live").forEach(function (el) {
      var val = el.querySelector(".tt-live-val");
      var unit = el.querySelector(".tt-live-unit");
      if (val) val.textContent = liveState.text;
      if (unit) unit.textContent = liveState.unit;
      el.classList.toggle("is-work", liveState.work);
      el.title = liveState.title;
    });
    // [2.0] The liveness indicator is a time surface too, and its truth comes
    // from satReadout.openSince — which is refreshed ASYNCHRONOUSLY, after the
    // card's markup was built. Repainting it here (rather than only at render)
    // is what makes the dot flip when the engine actually opens or closes a
    // session, instead of showing whatever was true at the last full paint.
    var live = container.querySelector(".sat-live");
    if (live) {
      var label = container.querySelector(".sat-time-label");
      var html = satTrackingIndicatorHtml(Storage.isTrackingPaused(data));
      if (!html) live.remove();
      else if (label) live.outerHTML = html;
    }
  }

  function satStopTick() {
    if (satTickTimer) { clearInterval(satTickTimer); satTickTimer = null; }
  }

  function satStartTick() {
    satStopTick();
    // [1.2.3] FOCUSED TODAY is now the only ticking surface. It advances only
    // while an engine session is open on this task, and freezes while paused, so
    // the existing gate (no task / paused -> no timer) still holds; the tick is
    // left ON for an active-but-not-currently-open task rather than tightened to
    // satReadout.openSince, because openSince is refreshed asynchronously by
    // satRefreshReadout and a self-stopping tick would depend on that race.
    // Painting an unchanged string once a second costs nothing.
    // [1.0.18] A running pomodoro also needs the tick, and independently of the
    // ACTIVE gate: the countdown runs even while tracking is paused (pause
    // integration is A2) and needs no engine readout.
    var pomoRunning = !!satRunningPomo();
    if (!pomoRunning && (!satReadout.taskId || Storage.isTrackingPaused(data))) return;
    // [A2] The tick both paints and reconciles — the boundary-crossing detector
    // that drives auto-advance / expiry (satMaybeReconcile early-outs cheaply).
    satTickTimer = setInterval(function () { satPaintTime(); satMaybeReconcile(); }, 1000);
  }

  // Re-read the engine's numbers. Async, but never blocks a render: the pill
  // paints from the cached readout and the fresh value lands a tick later.
  // [2.0 timing] A PER-TASK total must be read ACROSS EVERY WORKSPACE, and this
  // constant is here so the two callers below cannot drift apart on it.
  //
  // Diagnosed live 2026-08-12, after Samson reported no chips on tasks he had
  // demonstrably tracked. The hover hypothesis was wrong — the chip's computed
  // opacity is 1 at rest and nothing gates the controls zone. The real cause is
  // in tracking.js: a day aggregate is keyed by the workspace that was ACTIVE AT
  // CAPTURE, not by the task's own workspace, and rollupBucketOverWindow drops
  // every aggregate whose workspaceId does not match the scope
  // (tracking.js:977). The active task is GLOBAL and may belong to a different
  // workspace than the one being browsed, so a scoped read returns nothing for
  // exactly the tasks a two-workspace user tracks. Reproduced: aggregates under
  // w2 with the rows in w1 -> 0 chips and a blank window line, while the pill's
  // headline read 25 minutes for the same task on the same data. Turning
  // combined analytics on made the chips reappear, which is the scope filter
  // confessing.
  //
  // focusedTodayForTask — the pill headline's own reader — already sums across
  // every workspace's aggregate for precisely this reason, and says so in its
  // comment. These readers now match it. That is also what stops the card's new
  // "last 30 days" line from contradicting the headline directly above it.
  var SAT_ALL_WORKSPACES = null;

  // One sentence, shared by every surface that shows the live figure, so the
  // pill and the task row cannot explain themselves differently.
  var SAT_LIVE_TITLE = "Time records while you browse a site. This page is not tracked, so the number holds here.";

  // [2.0] The stopwatch's own sentence. It says the quiet part out loud: this is
  // a wall-clock, not the engine's measurement, and the two are different numbers
  // about different things.
  var SAT_ACTIVE_TITLE = "Wall-clock since you activated this task, pauses excluded — not measured browsing time.";

  // [2.0] THE ACTIVATION STOPWATCH — time since this task was activated, pauses
  // excluded. ONE number, ONE regime, and it always counts.
  //
  // This SUPERSEDES the session-elapsed switch from the previous round, and its
  // machinery is removed rather than left running alongside. That round showed
  // session-elapsed during a work phase and the engine's figure otherwise, which
  // meant the number RESET when a session started and FROZE whenever one was not
  // running — and a frozen number on an active task reads as broken, which is the
  // report this round answers. The model is simply: an active task's clock
  // counts. A work phase does not reset or replace it; the same count continues
  // and gains the accent.
  //
  //   now − startedAt − (activePausedMs + any span still open)
  //
  // WHAT EACH PIECE IS FOR:
  //   startedAt is the activation stamp, preserved across restarts and by
  //     anchorBrowserSession, so the count CONTINUES across a browser restart.
  //     That is truthful — it is time since you said you were working on this,
  //     not time you were at the machine — and it is why the "since" timestamp
  //     stays beside it: a bare 31:04:12 needs the date to be interpretable.
  //     "End for now" is the lifecycle answer to a count that has gone stale.
  //   activePausedMs is the ACTIVATION-LIFETIME paused total (storage.js), NOT
  //     pausedMs, which the browser-session anchor zeroes. Using pausedMs would
  //     make the stopwatch quietly stop deducting every pause taken before the
  //     last launch.
  //   the open span is added live, so the number freezes the instant Pause is
  //     pressed rather than one storage round trip later.
  //
  // HONESTY. This is a WALL-CLOCK. The engine's figures are a different kind of
  // number — time the engine actually saw on a trackable site — and the two are
  // never added, averaged or shown as one figure: the stopwatch lives on the row,
  // FOCUSED TODAY lives on the card. The word "focused" is reserved for the
  // engine and never appears here. The unit word is "active", which is what this
  // number actually measures.
  function satActiveElapsedMs() {
    var a = Storage.getActiveTask(data);
    if (!a || typeof a.startedAt !== "number" || !a.startedAt) return 0;
    var pausedTotal = (a.activePausedMs || 0) + (a.pausedAt != null ? Math.max(0, Date.now() - a.pausedAt) : 0);
    return Math.max(0, Date.now() - a.startedAt - pausedTotal);
  }

  // M:SS under an hour, H:MM:SS under a day, then Xd Yh. The day form exists
  // because this count legitimately reaches it — a task left active over a
  // weekend is a real state, and "54:12:07" is a number nobody can read.
  function satFmtStopwatch(ms) {
    if (!(ms > 0)) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    if (totalSec < 86400) return satFmtLong(ms);
    var days = Math.floor(totalSec / 86400);
    var hours = Math.floor((totalSec % 86400) / 3600);
    return days + "d " + hours + "h";
  }

  // The row's live slot. `work` is PRESENTATION ONLY — the same count, with the
  // accent treatment while a work phase runs.
  function satRowLiveState() {
    var pomo = satRunningPomo();
    return {
      work: !!(pomo && pomo.phase === "work"),
      text: satFmtStopwatch(satActiveElapsedMs()),
      unit: "active",
      title: SAT_ACTIVE_TITLE
    };
  }

  // Built once for the row's first paint and re-read by the tick, which only ever
  // writes text into these existing nodes — no structural change, nothing an open
  // inline rename can trip over.
  function satRowLiveHtml() {
    var s = satRowLiveState();
    return '<span class="tt-task-live' + (s.work ? ' is-work' : '') + '" title="' + escapeHtml(s.title) + '">' +
        '<span class="tt-live-val">' + escapeHtml(s.text) + '</span>' +
        '<span class="tt-live-unit">' + escapeHtml(s.unit) + '</span>' +
      '</span>';
  }

  // The engine's OWN retention constant, never a restated 30 — if retention ever
  // moves, the label moves with it rather than lying by one digit.
  function satWindowDays() {
    return (typeof Tracking !== "undefined" && Tracking.RETENTION_DAYS) || 30;
  }

  // [2.0 pill clarity] Per-task windowed total, through the EXISTING [1.2.1]
  // byTask reader — no new capture, no new engine surface. Scope follows the same
  // rule the Insights board and the cockpit use (dashFocusedScope): combined
  // analytics reads across workspaces, otherwise the active workspace, and
  // tracking-off suppresses entirely rather than reporting a measured-nothing 0.
  async function satRefreshTaskWindow(taskId) {
    var token = ++satWindowToken;
    if (!taskId || typeof Tracking === "undefined" || !Tracking.byTaskForScope) {
      satTaskWindow = { taskId: null, ms: 0 };
      return;
    }
    var scope = dashFocusedScope(data);
    if (!scope) { satTaskWindow = { taskId: null, ms: 0 }; return; }
    var rows;
    try {
      rows = await Tracking.byTaskForScope(SAT_ALL_WORKSPACES, Tracking.lastNLocalDayKeys(satWindowDays()));
    } catch (err) {
      console.error("[LaunchPad] Active task: windowed task total read failed", err);
      return;
    }
    if (token !== satWindowToken) return;
    var ms = 0;
    (rows || []).forEach(function (r) { if (r && r.taskId === taskId) ms += r.ms || 0; });
    satTaskWindow = { taskId: taskId, ms: ms };
    // Patch in place rather than re-rendering the card: a full repaint here would
    // fight the 1s tick and drop any open duration-chip picker.
    var el = document.querySelector("#active-task-pill .sat-expanded");
    if (!el) return;
    var line = el.querySelector(".sat-window");
    var html = satWindowLineHtml();
    if (line) {
      if (!html) line.remove();
      else line.outerHTML = html;
    } else if (html) {
      var since = el.querySelector(".sat-since");
      var label = el.querySelector(".sat-time-label");
      var anchor = since || label;
      if (anchor) anchor.insertAdjacentHTML("afterend", html);
    }
  }

  async function satRefreshReadout(taskId) {
    if (!taskId || typeof Tracking === "undefined" || !Tracking.focusedTodayForTask) {
      satReadout = { taskId: null, baseMs: 0, openSince: null };
      satStopTick();
      return;
    }
    try {
      var r = await Tracking.focusedTodayForTask(taskId);
      satReadout = { taskId: taskId, baseMs: r.baseMs, openSince: r.openSince };
    } catch (err) {
      console.error("[LaunchPad] Active task: focused-time read failed", err);
      satReadout = { taskId: taskId, baseMs: 0, openSince: null };
    }
    // A late resolution for a task that is no longer active must not paint.
    var res = Storage.resolveActiveTask(data);
    if (!res || res.stale || res.task.id !== satReadout.taskId) return;
    satPaintTime();
    satStartTick();
  }

  // The slim pill — one clickable .sat-pill-face button, in two variants:
  //   - empty: "No active task +" (data-sat-act="pick" -> opens the Switch menu);
  //   - minimized: play glyph + eyebrow/name + ticking m:ss time
  //     (data-sat-act="restore" -> reopens the docked card).
  // The eyebrow sits ABOVE the name (tiny caps, muted — the microlabel idiom);
  // it is static and on its own line, so it never truncates — only the name does,
  // via the ellipsis rules on .sat-pill-name.
  //
  // [1.0.17] `paused` (the GLOBAL tracking-pause flag) drives the loud paused
  // treatment: the play glyph becomes a pause glyph, the eyebrow reads "Paused",
  // and the container's is-paused class amber-tints them + the frozen time. Even
  // the empty state gets a small amber pause glyph so a global pause is never
  // invisible when there is no active task to show (the invisible-flag lesson).
  //
  // In that empty + paused state the glyph is ALSO the resume CONTROL (its own
  // data-sat-act="resume"), because the card — where Resume normally lives — is
  // not shown. The delegated handler routes on the innermost data-sat-act, so a
  // click on the glyph resumes while a click anywhere else on the face still
  // opens the Switch dropdown ("pick"). One click out of the paused-no-task hole.
  // [1.2.0 R3 / C9] Minimized-face armed INDICATOR. Indicator only — C9 is
  // explicit that the face carries no control, so this is a span with no
  // data-sat-act and the whole face keeps behaving as one button.
  //
  // Placed immediately after the leading glyph in every branch, never at the
  // trailing edge, because the phase branch's countdown lives there and its width
  // changes every second. Colour is var(--sat-accent), the ring's own variable,
  // so it inherits the already-solved three-branch treatment over wallpapers
  // rather than inventing a second accent.
  function satFocusPillDot() {
    if (!Storage.focusBlockingActive(data)) return "";
    return '<span class="sat-pill-focus" title="Focus blocking is on" ' +
      'aria-label="Focus blocking is on">●</span>';
  }

  function satPillFaceHtml(res, paused) {
    var inner;
    if (!res) {
      inner = (paused ? '<span class="sat-pill-glyph sat-pill-resume" data-sat-act="resume" ' +
          'role="button" title="Resume tracking" aria-label="Resume tracking">⏸</span>' : '') +
        '<span class="sat-pill-empty">No active task</span>' +
        satFocusPillDot() +
        '<span class="sat-pill-plus" aria-hidden="true">+</span>';
    } else {
      // [1.0.18] Minimized pill during a running phase: the countdown + phase
      // label replace ACTIVE. The time span carries sat-pomo-time so satPaintTime
      // ticks it; it keeps sat-pill-time for styling. The face still restores the
      // card on click (act = "restore" below).
      var pomo = satRunningPomo();
      if (pomo) {
        inner = '<span class="sat-pill-glyph" aria-hidden="true">◷</span>' + satFocusPillDot() +
          '<span class="sat-pill-main">' +
            '<span class="sat-pill-label">' + escapeHtml(SAT_POMO_PHASE_LABEL[pomo.phase] || 'Focus') + '</span>' +
            '<span class="sat-pill-name">' + escapeHtml(res.task.name) + '</span>' +
          '</span>' +
          '<span class="sat-pill-time sat-pomo-time">' + escapeHtml(satFmtLong(satPomoRemainingMs(pomo))) + '</span>';
      } else {
        inner = '<span class="sat-pill-glyph" aria-hidden="true">' + (paused ? '⏸' : '▶') + '</span>' + satFocusPillDot() +
          '<span class="sat-pill-main">' +
            '<span class="sat-pill-label">' + (paused ? 'Paused' : 'Active task') + '</span>' +
            '<span class="sat-pill-name">' + escapeHtml(res.task.name) + '</span>' +
          '</span>' +
          // [1.2.3] FOCUSED TODAY, the same number the card leads with — not a
          // wall-clock counter. No since-line on the face: there is no room, and
          // the card carries it. Frozen amber when paused, as before.
          '<span class="sat-pill-time">' + escapeHtml(satFmtLong(satLiveMs())) + '</span>';
      }
    }
    var act = res ? "restore" : "pick";
    var label = res ? "Restore active task card" : "Pick an active task";
    return '<button type="button" class="sat-pill-face" data-sat-act="' + act + '" ' +
      'aria-label="' + label + '">' + inner + '</button>';
  }

  // The docked card's content (active + expanded). `res` is always a live task
  // here — the empty and minimized states render the slim pill instead. Adds the
  // v3 eyebrow + minimize chevron over the v2 expanded body.
  //
  // [1.0.17] `paused` (the GLOBAL tracking-pause flag) drives a loud state: the
  // card takes .is-paused (amber-tinted, frozen timer), the "focused today" label
  // becomes "Paused", and the Pause control shows as Resume. The [1.0.16] paused
  // CHIP is gone — its state is absorbed into the control (D2), not duplicated.
  // ===== [1.2.0 R3 / C9] The pill's Focus row =====
  //
  // A DEDICATED row, not another button in the shared actionsRow: that row already
  // carries four controls (Done / Pause / x / Switch) across all three card
  // states, and blocking is a mode rather than an action on the task. The
  // sat-pomo-start-row / sat-pomo-stop-row precedent is the same shape.
  //
  // THE LABEL IS THE TEACHING SURFACE, so the row renders in ALL THREE card
  // states and whether or not any sites are listed. With an empty block list it
  // appends a quiet "no sites listed" note — a statement of fact, not a link:
  // Pro Settings is the manage surface and this round adds no navigation.
  //
  // TOGGLE SEMANTICS ARE ADDITIVE, never a fight with the auto path. The control
  // owns the MANUAL arm only, so a tap is always just "flip my manual arm":
  //   off        -> manual on   (blocking starts)
  //   on (auto)  -> manual on   (blocking now SURVIVES the session ending)
  //   on         -> manual off  (if a work phase is still running the label falls
  //                              back to "on (auto)" rather than to "off", which
  //                              is both correct and self-explanatory)
  // The switch's visual state tracks whether blocking is ON BY ANY ROUTE, so it
  // always agrees with the label beside it; only the "(auto)" suffix moves.
  function satFocusRowHtml() {
    var state = Storage.focusArmState(data);          // "off" | "manual" | "auto"
    var on = state !== "off";
    var label = state === "off" ? "Focus blocking: off"
              : state === "auto" ? "Focus blocking: on (auto)"
              : "Focus blocking: on";
    var empty = Storage.getBlockList(data).length === 0;
    var title = on ? "Turn focus blocking off" : "Turn focus blocking on";
    return '<div class="sat-focus-row' + (on ? ' is-on' : '') + '">' +
        '<button type="button" class="sat-focus-toggle" data-sat-act="focus-toggle" ' +
          'role="switch" aria-checked="' + (on ? 'true' : 'false') + '" ' +
          'title="' + title + '" aria-label="' + title + '">' +
          '<span class="sat-focus-knob" aria-hidden="true"></span>' +
        '</button>' +
        '<span class="sat-focus-label">' + escapeHtml(label) + '</span>' +
        (empty ? '<span class="sat-focus-hint">no sites listed</span>' : '') +
      '</div>';
  }

  function satCardHtml(res, paused) {
    var tagIds = Array.isArray(res.task.tagIds) ? res.task.tagIds : [];
    var tagHtml = "";
    if (tagIds.length >= 1) {
      tagHtml = tagPillHtml(res.workspace, tagIds[0]);
      if (tagIds.length > 1) {
        tagHtml += '<span class="tt-tag-more" title="' + tagIds.length + ' tags">+' + (tagIds.length - 1) + '</span>';
      }
    }

    // D8: a foreign task is shown and fully operable — Complete/Cancel work
    // without switching workspace. The switch is an offer, not a prerequisite.
    var foreignHtml = "";
    if (res.isForeign) {
      foreignHtml = '<div class="sat-foreign">' +
          'This task is in ' + escapeHtml(res.workspace.name) +
          '<button type="button" class="sat-foreign-switch" data-sat-act="goto-workspace">' +
            'Switch to ' + escapeHtml(res.workspace.name) +
          '</button>' +
        '</div>';
    }

    // Shared header (eyebrow + minimize, name, goal, tags, foreign note) — used by
    // both the normal card and the [1.0.18] pomodoro-running card.
    var head =
      '<div class="sat-card-head">' +
        '<span class="sat-eyebrow">Active task</span>' +
        '<button type="button" class="sat-card-min" data-sat-act="minimize" ' +
          'title="Minimize" aria-label="Minimize active task card">⌃</button>' +
      '</div>' +
      '<div class="sat-name" title="' + escapeHtml(res.task.name) + '">' + escapeHtml(res.task.name) + '</div>' +
      (res.goal ? '<div class="sat-goal" title="' + escapeHtml(res.goal.name) + '">' + escapeHtml(res.goal.name) + '</div>' : '') +
      (tagHtml ? '<div class="sat-tags">' + tagHtml + '</div>' : '') +
      foreignHtml;

    // D2/D4: one Pause/Resume toggle. Copy is GLOBAL, never per-task. When paused
    // it is the loud amber recovery control. [A2] The action row is SHARED by the
    // normal and running-phase cards so Pause stays available during a phase (P3).
    var pauseBtn = paused
      ? '<button type="button" class="sat-btn sat-btn-resume" data-sat-act="resume" title="Resume tracking">▶ Resume</button>'
      : '<button type="button" class="sat-btn" data-sat-act="pause" title="Pause tracking">⏸ Pause</button>';

    // [2.0 pill clarity] EVERY ACTION WEARS ITS CONSEQUENCE.
    //
    // The trap this replaces: "✓ Done" permanently completed the task, while
    // "done for this session — stop working, the task stays open" hid behind an
    // unlabeled ×. A user finishing a work stretch tapped Done and closed a task
    // they meant to keep. Samson's own framing is the spec: you either have a
    // focus session that tracks the task, or you complete the task — and the
    // missing middle, SET IT DOWN WITHOUT FINISHING, deserves a real name.
    //
    // So the two consequence-bearing actions are labeled, side by side, at equal
    // dignity, and each says what it does to the TASK:
    //   Complete    -> the task ends. It moves to Completed.
    //   End for now -> tracking stops. The task stays open.
    // No confirmation dialog on either: the label is the fix, and friction on an
    // action the user meant is a worse tax than the one it prevents.
    //
    // COMPLETE IS RECOVERABLE, and that is why a label is sufficient rather than
    // a dialog. Verified, not assumed: the Tasks tab's row checkbox unchecks a
    // completed task straight back to open through Storage.reactivateTask (the
    // `if (!willComplete)` branch of the row's change handler), and the Completed
    // box keeps the row reachable. The tooltip says so in as many words.
    //
    // LAYOUT, and the trade it makes. The card is 280px; four labeled controls do
    // not fit on one row and would truncate. Hierarchy per the brief: the two
    // destructive-or-final actions get the labels and the first row; the two
    // NON-destructive session controls take the second row, where Pause keeps its
    // label (it is the [1.0.17] loud amber recovery control when paused —
    // demoting Resume to a bare glyph would weaken the one state that most needs
    // to be obvious) and Switch, the only action with no consequence for the task
    // at all, stays a compact glyph WITH a tooltip and an aria-label.
    var actionsRow =
      '<div class="sat-actions">' +
        '<div class="sat-actions-primary">' +
          '<button type="button" class="sat-btn sat-btn-complete" data-sat-act="complete" ' +
            'title="Complete the task — it moves to Completed. You can uncheck it in Tasks to reopen it.">' +
            '✓ Complete</button>' +
          '<button type="button" class="sat-btn sat-btn-setdown" data-sat-act="cancel" ' +
            'title="Stop tracking for now — the task stays open and keeps its time.">' +
            'End for now</button>' +
        '</div>' +
        '<div class="sat-actions-session">' +
          pauseBtn +
          '<button type="button" class="sat-btn sat-btn-icon" data-sat-act="switch" ' +
            'title="Switch active task" aria-label="Switch active task">⇄</button>' +
        '</div>' +
      '</div>';

    // [A2] Focus session RUNNING: ring + countdown + phase label + Stop, PLUS the
    // shared action row. Stop clears the phase and returns to the elapsed view;
    // Switch gates through the reset-confirm modal (in satActivate); Complete /
    // Cancel act immediately — the phase dies with the task.
    var pomo = satRunningPomo();
    if (pomo) {
      var remaining = satPomoRemainingMs(pomo);
      var frac = pomo.totalMs > 0 ? Math.max(0, Math.min(1, remaining / pomo.totalMs)) : 0;
      var offset = SAT_POMO_RING_C * (1 - frac);
      // [E3] The ring center reads FOCUS during a work phase (the protagonist,
      // per E2's copy direction); break phases keep their phase label. The CSS
      // uppercases. Phase text labels elsewhere (pill eyebrow) stay Work/Break.
      var phaseLabel = pomo.phase === "work" ? "Focus" : (SAT_POMO_PHASE_LABEL[pomo.phase] || "Focus");
      // [2.0 timing] TWO NUMBERS, ONE SYSTEM. The takeover used to replace the
      // headline outright, so starting a focus session made today's total vanish
      // — the user traded the number they are accumulating for the number
      // counting down. Now the ring stays the hero and FOCUSED TODAY sits
      // beneath it, quieter (CSS shrinks it under .sat-expanded-pomo) but
      // present: this session above, today below.
      //
      // It is the SAME satHeadlineHtml the idle card uses, deliberately — a
      // second copy of the headline markup is how the two drift apart. Only its
      // scale changes, and only in CSS.
      //
      // .is-work is the highlight: accent emphasis while a WORK phase runs.
      // Break phases deliberately do NOT take it — the accent means "this is the
      // stretch that counts", and a break is the product telling you to stop.
      var pomoWork = pomo.phase === "work";
      return '<div class="sat-expanded sat-expanded-pomo' + (pomoWork ? ' is-work' : '') + '">' +
          head +
          '<div class="sat-pomo">' +
            '<div class="sat-pomo-ring-wrap">' +
              '<svg class="sat-pomo-ring" viewBox="0 0 100 100" width="104" height="104" aria-hidden="true">' +
                '<circle class="sat-pomo-ring-track" cx="50" cy="50" r="' + SAT_POMO_RING_R + '"></circle>' +
                '<circle class="sat-pomo-ring-fill" cx="50" cy="50" r="' + SAT_POMO_RING_R + '" ' +
                  'stroke-dasharray="' + SAT_POMO_RING_C.toFixed(2) + '" ' +
                  'stroke-dashoffset="' + offset.toFixed(2) + '"></circle>' +
              '</svg>' +
              '<div class="sat-pomo-center">' +
                '<span class="sat-pomo-time">' + escapeHtml(satFmtLong(remaining)) + '</span>' +
                '<span class="sat-pomo-phase">' + escapeHtml(phaseLabel) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="sat-pomo-stop-row">' +
              '<button type="button" class="sat-btn sat-btn-pomo-stop" data-sat-act="pomo-stop" title="Stop focus session">■ Stop</button>' +
            '</div>' +
          '</div>' +
          // Today's total, kept in view under the countdown. Paused cannot be
          // true here in practice (a pause freezes the phase), but the flag is
          // passed through rather than hard-coded false so this call site can
          // never be the one that disagrees with the others.
          '<div class="sat-pomo-today">' + satHeadlineHtml(paused) + '</div>' +
          satFocusRowHtml() +
          actionsRow +
        '</div>';
    }

    // [E1] Session COMPLETE (a break ran to its end): summary + explicit
    // restart. Work NEVER auto-starts — '▶ Start next session' routes through
    // the normal start path (pomo-start clears the marker and begins a work
    // phase), so the long-break cadence math simply continues from cycleCount.
    // User Stop and expiry never set the marker, so they land on the plain
    // card below instead.
    var done = satSessionComplete();
    if (done) {
      var cadence = Storage.getPomodoroSettings(data).cyclesBeforeLongBreak;
      // [1.0.18 Round E, self-flag 1] Show MODULAR position within the cadence,
      // not the raw running total: cycle 5 of a 4-cadence reads "cycle 1 of 4",
      // cycle 8 reads "cycle 4 of 4". cycleCount stays the raw total in storage
      // (reset-hint + long-break math unchanged). Guard cycleCount < 1 -> 1
      // (defensive; the sessionComplete marker encoding requires cycleCount > 0).
      var cyclePos = done.cycleCount < 1 ? 1 : (((done.cycleCount - 1) % cadence) + 1);
      return '<div class="sat-expanded sat-expanded-pomo' + (paused ? ' is-paused' : '') + '">' +
          head +
          // [1.2.3] The session-done card leads with the headline too — this is
          // the moment the number is most worth seeing, and it is the one
          // pomodoro branch with no time surface of its own to conflict with (a
          // RUNNING phase keeps its countdown takeover untouched).
          satHeadlineHtml(paused) +
          '<div class="sat-pomo sat-pomo-done">' +
            '<div class="sat-pomo-done-msg">Session done · cycle ' + cyclePos + ' of ' + cadence + '</div>' +
            '<div class="sat-pomo-start-row">' +
              '<button type="button" class="sat-btn sat-btn-pomo-start" data-sat-act="pomo-start" ' +
                'title="Start the next focus session">▶ Start next session</button>' +
            '</div>' +
          '</div>' +
          satFocusRowHtml() +
          actionsRow +
        '</div>';
    }

    // [A2 D9/D10] Not running: dual counters, then the Focus-session start control
    // with the sticky work length + a tappable duration segment (chips + custom).
    var workMin = Storage.getPomodoroSettings(data).workMin;
    return '<div class="sat-expanded' + (paused ? ' is-paused' : '') + '">' +
        head +
        satHeadlineHtml(paused) +
        '<div class="sat-pomo-start-row">' +
          '<button type="button" class="sat-btn sat-btn-pomo-start" data-sat-act="pomo-start" title="Start a focus session">▶ Focus session</button>' +
          '<button type="button" class="sat-btn sat-btn-pomo-dur" data-sat-act="pomo-duration" ' +
            'title="Change focus length" aria-expanded="' + (satPomoDurOpen ? 'true' : 'false') + '">' +
            escapeHtml(String(workMin)) + ' min ▾</button>' +
        '</div>' +
        (satPomoDurOpen ? satPomoDurChipsHtml(workMin) : "") +
        satFocusRowHtml() +
        actionsRow +
      '</div>';
  }

  // [A2 D10] Preset focus-length chips + a custom numeric input. Picking persists
  // via setPomodoroWorkMin (sticky — Pro Settings and this button read the same
  // stored value). The active preset is highlighted; a non-preset workMin prefills
  // the custom box.
  function satPomoDurChipsHtml(workMin) {
    var presets = [5, 10, 15, 25, 45];
    var chips = presets.map(function (m) {
      return '<button type="button" class="sat-pomo-chip' + (m === workMin ? ' is-active' : '') +
        '" data-sat-act="pomo-dur-pick" data-min="' + m + '">' + m + '</button>';
    }).join("");
    var isPreset = presets.indexOf(workMin) !== -1;
    return '<div class="sat-pomo-dur-row">' + chips +
        '<input type="number" class="sat-pomo-dur-input" data-sat-act="pomo-dur-custom" ' +
          'min="5" max="60" step="1" inputmode="numeric" placeholder="Custom" value="' + (isPreset ? "" : escapeHtml(String(workMin))) + '">' +
      '</div>';
  }

  // Repaint the surface as pill or card per state. Called from render(),
  // applyAccessLevelUI(), and every activate/cancel/complete/minimize path.
  function renderActiveTaskWidget() {
    var pill = $("#active-task-pill");
    if (!pill) return;

    // D9: hidden entirely for free users. No preview stub.
    if (!satHasPro()) {
      pill.classList.add("hidden");
      pill.classList.remove("is-card", "is-empty", "is-paused");
      document.body.classList.remove("sat-card-open");
      pill.innerHTML = "";
      satStopTick();
      satUpdateTabTitle();   // [1.0.18] restore the page title if a trial lapsed mid-phase
      closeSatSwitchMenu();
      return;
    }
    pill.classList.remove("hidden");

    var resolved = Storage.resolveActiveTask(data);

    // Self-heal (item 7). resolveActiveTask reports a task completed or deleted
    // ANYWHERE — including by another tab — as stale, and the pill drops to its
    // empty state. It also clears the stored record: leaving it would keep the
    // engine attributing focus to a task the UI says isn't active, which is
    // exactly the invisible-state mismatch the paused-flag lesson warns about.
    // One write, then resolve returns null and this never fires again.
    if (resolved && resolved.stale) {
      if (!satHealing) {
        satHealing = true;
        console.log("[LaunchPad] Active task: self-healing stale record (" + resolved.reason + ")");
        Storage.clearActiveTask(data)
          .catch(function (err) { console.error("[LaunchPad] Active task: self-heal failed", err); })
          .then(function () { satHealing = false; });
      }
      resolved = null;
    }

    var res = (resolved && !resolved.stale) ? resolved : null;
    if (!res) satReadout = { taskId: null, baseMs: 0, openSince: null };

    // Three states: the docked CARD (active + expanded — the default), or the
    // slim PILL (active + minimized, or empty). Only the card nests buttons; the
    // pill states are a single .sat-pill-face button. The minimize preference is
    // read fresh each render, so a cross-tab flip lands via the render() path.
    var showCard = !!res && !Storage.isActiveTaskCardMinimized(data);
    // [1.0.17] Global manual-pause flag, read fresh each render (a cross-tab flip
    // lands via the render() path). Shown even in the empty state (BUILD 4) so a
    // global pause is never invisible.
    var paused = Storage.isTrackingPaused(data);

    pill.classList.toggle("is-card", showCard);
    pill.classList.toggle("is-empty", !res);
    pill.classList.toggle("is-paused", paused);
    // Reserve room in the Tasks-tab header (via body class) ONLY while the card
    // is expanded, so its top-right + New / Templates cluster slides clear of the
    // card. The slim pill/empty states sit above the cluster and release it.
    document.body.classList.toggle("sat-card-open", showCard);
    pill.setAttribute("title", res ? res.task.name : "Pick an active task");
    if (showCard) {
      pill.setAttribute("role", "region");
      pill.setAttribute("aria-label", "Active task");
      pill.innerHTML = satCardHtml(res, paused);
    } else {
      pill.removeAttribute("role");
      pill.removeAttribute("aria-label");
      pill.innerHTML = satPillFaceHtml(res, paused);
    }

    if (res) {
      // [1.0.18] Immediate first frame (countdown/ring or ACTIVE) + tab title,
      // before the async engine readout lands. satStartTick then keeps the
      // countdown ticking even if the readout path bails (it self-guards, so a
      // double-start from satRefreshReadout's own call is harmless).
      satPaintTime();
      satRefreshReadout(res.task.id);
      satRefreshTaskWindow(res.task.id);
      satStartTick();
      satMaybeReconcile();   // [A2] render is a reconcile point (D3) — catch a boundary crossed while unpainted
    } else {
      satStopTick();
      satUpdateTabTitle();   // restore the page title when the widget empties
    }
  }

  // ----- Minimize / restore -----
  //
  // The card ↔ pill toggle. Writes data.activeTaskCardMinimized (through saveAll,
  // no-op when unchanged) and eager-renders. The write rides `data` so a foreign
  // tab's onChanged repaints the widget (cross-tab sync); computeDesired ignores
  // the flag, so it is inert to the engine. Any open Switch dropdown is closed —
  // it anchored to a button that is about to be replaced.
  async function satSetMinimized(minimized) {
    closeSatSwitchMenu();
    try {
      await Storage.setActiveTaskCardMinimized(data, minimized);
    } catch (err) {
      console.error("[LaunchPad] Active task: minimize toggle failed", err);
    }
    // Eager render: saveAll tags our own writes and the provenance gate
    // suppresses the resulting onChanged, so nothing else will repaint this tab.
    renderActiveTaskWidget();
  }

  // ----- Pause / resume (GLOBAL tracking pause, [1.0.17]) -----
  //
  // Writes data.trackingPaused (through saveAll, no-op when unchanged) and
  // eager-renders. This is a real tracking boundary: the SW's `data` watcher
  // fires Tracking.sync, evaluateGates now returns "paused", and the engine
  // closes the open session — capture stops until resume, when the next boundary
  // reopens one. No engine change (the gate + watcher already exist). Cross-tab
  // via onChanged like every other `data` write. Global, not per-task (D4).
  async function satSetPaused(paused) {
    closeSatSwitchMenu();
    try {
      await Storage.setTrackingPaused(data, paused);
    } catch (err) {
      console.error("[LaunchPad] Active task: pause toggle failed", err);
    }
    renderActiveTaskWidget();
    // [Polish] The row glyph is now a third view of this flag, so the Tasks
    // panel must repaint with the card/pill. Without this, pausing FROM the card
    // left the row glyph stale in THIS tab — our own writes are provenance-
    // tagged, so the onChanged path deliberately will not repaint us. Mirrors
    // satActivate/satCancel, which already pair the two renders for this reason.
    satRenderTasksPanel();
    // [Bug 1216701983826304] trackingPaused is a FOURTH view of this flag: the
    // Dashboard's pick-up card reads it (Continue vs Resume). Same provenance
    // reason as the Tasks panel above — repaint it too, the F3 sat-site pattern.
    renderDashboardTab(document.getElementById("tab-dashboard"), data);
  }

  // ----- Pomodoro start / stop ([1.0.18], Round A1) -----
  //
  // Own-tab writes through Storage, then eager-render the WIDGET only — the same
  // provenance-suppression discipline as the other sat* controls. Unlike
  // satActivate/satSetPaused, pomodoro state does not change which task is active,
  // the pause flag, or completion, so the Tasks panel and Dashboard have nothing
  // new to show: no eager-render triple, just renderActiveTaskWidget. Foreign tabs
  // pick it up via the `data` watcher. Storage.start/stop no-op safely with no
  // active task, so these are inert if somehow fired without one.
  // [1.2.0 R3 / C9] Flip the MANUAL arm. That single operation implements all
  // three tap semantics (off -> on, auto -> manual so it outlives the session,
  // manual -> off with a fallback to "on (auto)" if a phase is still running),
  // because the manual flag is the only thing this control owns.
  //
  // NO SERVICE-WORKER WORK IS NEEDED, and that is by design rather than an
  // omission: the intercept re-derives focusBlockingActive from storage on every
  // navigation, so a write here is the whole handoff. Nothing to notify, nothing
  // to keep in sync.
  async function satToggleFocusArm() {
    try {
      await Storage.setFocusArmed(data, !Storage.isFocusManuallyArmed(data));
    } catch (err) {
      console.error("[LaunchPad] Focus blocking: arm toggle failed", err);
    }
    // Own-tab eager render, the sat* convention. Foreign tabs pick it up through
    // the storage watcher, so no cross-tab messaging here either.
    renderActiveTaskWidget();
  }

  async function satPomoStart() {
    satPomoDurOpen = false;   // close the duration picker on start
    try {
      await Storage.startPomodoroPhase(data);
    } catch (err) {
      console.error("[LaunchPad] Focus session: start failed", err);
      return;
    }
    renderActiveTaskWidget();
  }

  async function satPomoStop() {
    try {
      await Storage.stopPomodoro(data);
    } catch (err) {
      console.error("[LaunchPad] Focus session: stop failed", err);
      return;
    }
    renderActiveTaskWidget();
  }

  // [A2 D10] Persist a sticky focus length and close the picker. Keeps the Pro
  // Settings work-minutes input consistent (both read the same stored value).
  async function satPomoSetWorkMin(val) {
    try {
      await Storage.setPomodoroWorkMin(data, val);
    } catch (err) {
      console.error("[LaunchPad] Focus session: duration save failed", err);
    }
    satPomoDurOpen = false;
    renderActiveTaskWidget();
    if (document.getElementById("pomo-work-min")) renderProPomodoroSettings();
  }

  // [A2 D6] Confirm-gate for switching the active task WHILE a focus phase runs:
  // the switch resets the session (setActiveTask installs a fresh pomodoroState).
  // Reuses the Tasks confirm modal. No confirm when no phase is running.
  function satConfirmSwitchReset(onConfirm) {
    openTasksConfirmModal({
      title: "Switch task?",
      message: "This will reset your focus session.",
      confirmLabel: "Switch and reset",
      onConfirm: onConfirm
    });
  }

  // Make a task active. The single funnel for all entry points (row play glyph,
  // Switch dropdown pick — which the empty pill also opens — and the right-click
  // Make active item) so the eager-render and the toast cannot drift apart
  // between them.
  //
  // [Polish Rule 4] Every one of those is an EXPLICIT user gesture meaning
  // "start this", so all of them clear a global pause as part of the same
  // atomic write (clearPause). Because this is the only funnel, passing it here
  // covers every gesture — and equally, nothing that is not a gesture picks it
  // up. The row glyph's RESUME click is unaffected: it routes to satSetPaused,
  // not here, and is already a resume.
  async function satActivate(taskId, workspaceId) {
    // [A2 D6] Switching AWAY from a task with a running focus phase resets that
    // session — gate it behind a confirm. Covers every switch entry point (row
    // glyph, context menu, Switch dropdown) since this is the single funnel.
    // Re-activating the SAME task, or activating with no phase running, is unchanged.
    var cur = Storage.getActiveTask(data);
    if (cur && cur.taskId !== taskId && satRunningPomo()) {
      closeSatSwitchMenu();
      satConfirmSwitchReset(function () { satActivateNow(taskId, workspaceId); });
      return false;
    }
    return satActivateNow(taskId, workspaceId);
  }

  async function satActivateNow(taskId, workspaceId) {
    try {
      var rec = await Storage.setActiveTask(data, taskId, workspaceId, { clearPause: true });
      if (!rec) return false;
    } catch (err) {
      console.error("[LaunchPad] Active task: activate failed", err);
      return false;
    }
    // Eager render: saveAll tags our own writes and the provenance gate
    // suppresses the resulting onChanged, so nothing else will repaint this tab.
    renderActiveTaskWidget();
    satRenderTasksPanel();
    // [1.0.20 F3] Keep the Dashboard's Start-of-Day card honest after an
    // active-task write. Without this, completing the active task from the pill
    // while the Dashboard shows "Pick up where you left off" leaves the card
    // offering to Continue a COMPLETED task until the next activation — stale AND
    // wrong, not merely old (the live finding). Bounded to exactly these three
    // sat sites, deliberately NOT the Tasks tab's ~40-site pattern. renderDashboard
    // Tab null-guards the panel, so this is a safe one-liner; hidden-safe like
    // satRenderTasksPanel. These paths are Pro-only reachable (the pill is gated
    // at render), so a free user's preview panel is never reached here.
    renderDashboardTab(document.getElementById("tab-dashboard"), data);
    return true;
  }

  // Repaint the Tasks panel whether or not it is the visible tab. setActiveTab
  // only toggles .hidden — it does not re-render — so skipping this when the
  // user is on Home would leave the play glyph lit on the previously-active row
  // until something else happened to render, and they would find it stale on
  // their next visit to the tab. Cheap, panel-guarded, and the same thing every
  // other Tasks mutation does.
  function satRenderTasksPanel() {
    var panel = document.getElementById("tab-tasks");
    if (panel) renderTasksTab(panel, data);
  }

  async function satCancel() {
    // D7: deactivate only — the task itself is untouched.
    try {
      await Storage.clearActiveTask(data);
    } catch (err) {
      console.error("[LaunchPad] Active task: cancel failed", err);
      return;
    }
    renderActiveTaskWidget();
    satRenderTasksPanel();
    renderDashboardTab(document.getElementById("tab-dashboard"), data); // [1.0.20 F3] see satActivate
  }

  // D6: complete via the rich completeTask path, then deactivate.
  //
  // Order matters. completeTask's write does not touch data.activeTask, so the
  // engine sees no boundary from it; the subsequent clear IS the boundary, and
  // it closes the session stamped to this task — so focus right up to the
  // moment of completion still attributes correctly.
  async function satComplete() {
    var res = Storage.resolveActiveTask(data);
    if (!res || res.stale) return;
    var task = res.task;
    var name = task.name;

    var result;
    try {
      result = await Storage.completeTask(data, task.id, res.workspace.id);
    } catch (err) {
      console.error("[LaunchPad] Active task: complete failed", err);
      return;
    }
    if (!result) return;

    try {
      await Storage.clearActiveTask(data);
    } catch (err) {
      console.error("[LaunchPad] Active task: deactivate-after-complete failed", err);
    }

    // The green sweep, then empty. Deliberately the widget's own animation: the
    // task row's celebration cannot run here — the Tasks tab may not even be the
    // visible tab. Done is clicked from the docked card, so the sweep plays on the
    // card in place; if the card is minimized (Done unreachable) or absent, settle
    // immediately.
    var card = document.querySelector("#active-task-pill.is-card .sat-expanded");
    var settle = function () {
      renderActiveTaskWidget();
      satRenderTasksPanel();  // Completed box + any goal flip
      renderDashboardTab(document.getElementById("tab-dashboard"), data); // [1.0.20 F3] see satActivate
      // [1.0.24 item 3] in-place goal celebration if the last task finished a
      // goal (best-effort: the Tasks goal card may not be mounted from here).
      if (result.goalAutoCompleted && result.autoCompletedGoal) celebrateGoalCompletion(result.autoCompletedGoal.id);
      // [1.0.22 D10] the pill is visible on Insights too — refresh it if shown.
      renderInsightsPanelEager();
    };
    if (card) {
      card.classList.add("sat-sweep");
      satStopTick();
      setTimeout(settle, 600);
    } else {
      settle();
    }

    // runTaskCompletionCelebration owns the toast only on its animated path,
    // and that path needs a mounted row — which a sidebar completion has no
    // reason to have. So the widget says it itself.
    showToast(result.goalAutoCompleted && result.autoCompletedGoal
      ? '"' + name + '" complete — goal "' + result.autoCompletedGoal.name + '" finished!'
      : '"' + name + '" complete');
  }

  // --- Switch dropdown (D5): workspace -> goal -> tasks ---------------------
  //
  // A plain body-mounted .tt-context-menu, anchored to the card's Switch button
  // (or, in the empty state, the pill face). It does not touch sidebarLocked /
  // #sidebar. Of the whole surface, only THIS keeps the scroll-close behavior —
  // the card itself is furniture and stays put.

  function closeSatSwitchMenu() {
    if (!satSwitchMenuEl) return;
    if (satSwitchOutsideHandler) {
      document.removeEventListener("click", satSwitchOutsideHandler, true);
      satSwitchOutsideHandler = null;
    }
    if (satSwitchEscapeHandler) {
      document.removeEventListener("keydown", satSwitchEscapeHandler);
      satSwitchEscapeHandler = null;
    }
    if (satSwitchScrollHandler) {
      window.removeEventListener("scroll", satSwitchScrollHandler, true);
      satSwitchScrollHandler = null;
    }
    if (satSwitchResizeHandler) {
      window.removeEventListener("resize", satSwitchResizeHandler);
      satSwitchResizeHandler = null;
    }
    if (satSwitchMenuEl.parentNode) satSwitchMenuEl.parentNode.removeChild(satSwitchMenuEl);
    satSwitchMenuEl = null;
  }

  // Renders the whole list from (query, collapse-state). Both the search input
  // and a workspace header toggle route through this one function — the
  // alternative (mutating rows in place for a toggle, regenerating for a
  // search) gives the two paths different ideas of what is expanded.
  function satSwitchListHtml(query, collapsedWs) {
    var q = (query || "").trim().toLowerCase();
    var collapsed = collapsedWs || {};
    var activeRes = Storage.resolveActiveTask(data);
    var activeId = (activeRes && !activeRes.stale) ? activeRes.task.id : null;
    var activeWsId = (Storage.getActiveWorkspace(data) || {}).id;
    var html = "";
    var matches = 0;

    (data.workspaces || []).forEach(function (ws) {
      var tasks = (ws.tasks || []).filter(function (t) {
        if (t.deletedAt || t.completed) return false;
        return !q || t.name.toLowerCase().indexOf(q) !== -1;
      });
      if (!tasks.length) return;
      matches += tasks.length;

      // A search expands every workspace it hit — a collapsed match is
      // indistinguishable from no match. Otherwise: the user's own toggle if
      // they made one, else the current workspace (D5's default).
      var expanded;
      if (q) expanded = true;
      else if (collapsed[ws.id] !== undefined) expanded = !collapsed[ws.id];
      else expanded = ws.id === activeWsId;

      html += '<button type="button" class="sat-ws-header" data-sat-ws="' + escapeHtml(ws.id) + '" aria-expanded="' + expanded + '">' +
          '<svg class="sat-ws-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
          escapeHtml(ws.name) +
        '</button>';

      if (!expanded) return;

      // Grouped under their goal, standalone last — the spec's hierarchy.
      var byGoal = {};
      var standalone = [];
      tasks.forEach(function (t) {
        if (t.goalId) { (byGoal[t.goalId] = byGoal[t.goalId] || []).push(t); }
        else standalone.push(t);
      });

      var rowHtml = function (t) {
        var isActive = t.id === activeId;
        return '<button type="button" class="sat-switch-task' + (isActive ? " is-active" : "") + '"' +
            ' data-sat-task="' + escapeHtml(t.id) + '" data-sat-task-ws="' + escapeHtml(ws.id) + '">' +
            '<span class="sat-glyph" aria-hidden="true">' + (isActive ? "▶" : "▷") + '</span>' +
            '<span class="sat-switch-task-name">' + escapeHtml(t.name) + '</span>' +
          '</button>';
      };

      Object.keys(byGoal).forEach(function (goalId) {
        var goal = Storage.getGoalById(ws, goalId);
        html += '<div class="sat-goal-header">' + escapeHtml(goal ? goal.name : "Goal") + '</div>';
        html += byGoal[goalId].map(rowHtml).join("");
      });
      if (standalone.length) {
        if (Object.keys(byGoal).length) html += '<div class="sat-goal-header">No goal</div>';
        html += standalone.map(rowHtml).join("");
      }
    });

    if (!matches) {
      html = '<div class="sat-switch-empty">' + (q ? "No tasks match" : "No open tasks yet") + "</div>";
    }
    return html;
  }

  function openSatSwitchMenu(anchorEl) {
    closeSatSwitchMenu();

    var menu = document.createElement("div");
    menu.className = "tt-context-menu sat-switch-menu";
    menu.innerHTML =
      '<input type="text" class="sat-switch-search" placeholder="Search tasks in all workspaces" ' +
        'autocomplete="off" spellcheck="false" aria-label="Search tasks">' +
      '<div class="sat-switch-list">' + satSwitchListHtml("", {}) + '</div>';
    document.body.appendChild(menu);
    satSwitchMenuEl = menu;

    var rect = anchorEl.getBoundingClientRect();
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    var px = Math.min(rect.right + 6, window.innerWidth - w - 8);
    var py = Math.max(8, Math.min(rect.top, window.innerHeight - h - 8));
    menu.style.left = Math.max(8, px) + "px";
    menu.style.top = py + "px";

    var listEl = menu.querySelector(".sat-switch-list");
    var searchEl = menu.querySelector(".sat-switch-search");
    // Per-open, DOM-only: which workspaces the user has toggled shut. Not
    // persisted — the dropdown is transient and D5 specifies the default fresh
    // each time.
    var collapsedWs = {};
    var repaint = function () {
      listEl.innerHTML = satSwitchListHtml(searchEl.value, collapsedWs);
    };

    searchEl.addEventListener("input", repaint);
    searchEl.focus();

    menu.addEventListener("click", async function (e) {
      var hdr = e.target.closest && e.target.closest(".sat-ws-header");
      if (hdr) {
        var wsId = hdr.getAttribute("data-sat-ws");
        collapsedWs[wsId] = hdr.getAttribute("aria-expanded") === "true";
        repaint();
        return;
      }
      var row = e.target.closest && e.target.closest(".sat-switch-task");
      if (!row) return;
      var taskId = row.getAttribute("data-sat-task");
      var taskWs = row.getAttribute("data-sat-task-ws");
      closeSatSwitchMenu();
      await satActivate(taskId, taskWs);
    });

    satSwitchOutsideHandler = function (e) {
      if (!menu.contains(e.target)) closeSatSwitchMenu();
    };
    setTimeout(function () {
      document.addEventListener("click", satSwitchOutsideHandler, true);
    }, 0);

    satSwitchEscapeHandler = function (e) {
      if (e.key === "Escape") closeSatSwitchMenu();
    };
    document.addEventListener("keydown", satSwitchEscapeHandler);

    // v3 scroll-close: the menu is position:fixed off a one-time rect, so any
    // scroll of an ancestor region drifts it. Same rationale as the Tasks-tab
    // popovers. But this is a CAPTURE-phase window listener, so it also receives
    // the menu's OWN list scroll — scroll doesn't bubble, yet capture still reaches
    // ancestors from any scrollable descendant. Unscoped, the first wheel/drag tick
    // on .sat-switch-list slammed the menu shut before it could move: the "list
    // won't scroll" bug (1217092237076418). Ignore scrolls that originate inside
    // the menu; still close on any ancestor/page scroll. Mirrors the contains()
    // guard in satSwitchOutsideHandler above.
    satSwitchScrollHandler = function (e) {
      if (e && e.target && menu.contains(e.target)) return;
      closeSatSwitchMenu();
    };
    window.addEventListener("scroll", satSwitchScrollHandler, true);

    // Same drift-close rationale for viewport resize (DevTools toggle, window
    // resize, zoom): the menu is position:fixed at open-time coords, so a resize
    // that reflows the anchor widget leaves it orphaned mid-screen. Close rather
    // than reposition — matches the transient picker intent (bug 1217092468273137).
    // Paired teardown in closeSatSwitchMenu.
    satSwitchResizeHandler = function () { closeSatSwitchMenu(); };
    window.addEventListener("resize", satSwitchResizeHandler);
  }

  function bindActiveTaskWidget() {
    var pill = $("#active-task-pill");
    if (!pill || pill.dataset.satBound === "1") return;
    pill.dataset.satBound = "1";

    // One delegated handler for the whole surface. The card's action buttons and
    // its minimize chevron carry data-sat-act; the pill face carries "restore"
    // (minimized) or "pick" (empty). Anything else on the card is inert — the card
    // is furniture, not a popover, so a background click does nothing.
    pill.addEventListener("click", async function (e) {
      var actBtn = e.target.closest && e.target.closest("[data-sat-act]");
      if (!actBtn) return;
      var act = actBtn.getAttribute("data-sat-act");
      if (act === "complete") { await satComplete(); return; }
      if (act === "cancel") { await satCancel(); return; }
      if (act === "pomo-start") { await satPomoStart(); return; }
      if (act === "focus-toggle") { await satToggleFocusArm(); return; }
      if (act === "pomo-stop") { await satPomoStop(); return; }
      if (act === "pomo-duration") { satPomoDurOpen = !satPomoDurOpen; renderActiveTaskWidget(); return; }
      if (act === "pomo-dur-pick") { await satPomoSetWorkMin(parseInt(actBtn.getAttribute("data-min"), 10)); return; }
      if (act === "switch" || act === "pick") { openSatSwitchMenu(actBtn); return; }
      if (act === "minimize") { await satSetMinimized(true); return; }
      if (act === "restore") { await satSetMinimized(false); return; }
      if (act === "pause") { await satSetPaused(true); return; }
      if (act === "resume") { await satSetPaused(false); return; }
      if (act === "goto-workspace") {
        var r2 = Storage.resolveActiveTask(data);
        if (r2 && !r2.stale) await switchWorkspace(r2.workspace.id);
        return;
      }
    });

    // [A2 D10] The custom focus-length input fires "change" (not click), so it
    // needs its own delegated listener on the pill surface. Clamp lives in Storage.
    pill.addEventListener("change", async function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-sat-act") === "pomo-dur-custom") {
        await satPomoSetWorkMin(t.value);
      }
    });

    // A backgrounded tab's setInterval is throttled to ~1/min by Chrome, so the
    // number can be well behind by the time the tab is looked at again. Re-read
    // on the way back rather than trusting the tick.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      var res = Storage.resolveActiveTask(data);
      if (res && !res.stale) satRefreshReadout(res.task.id);
      satMaybeReconcile();   // [A2] refocus is a reconcile point (D3) — a phase may have crossed while backgrounded
    });

    // The engine's writes land in tracking_sessions / tracking_days, never in
    // `data` — deliberately, so per-event capture does not re-render every open
    // tab. That means the `data` watcher above will NEVER fire for a session
    // opening or closing, and the widget needs its own listener to stay honest.
    if (typeof Tracking !== "undefined") {
      chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName !== "local") return;
        if (!changes[Tracking.STORE_KEY] && !changes[Tracking.DAYS_KEY]) return;
        var res = Storage.resolveActiveTask(data);
        if (res && !res.stale) {
          satRefreshReadout(res.task.id);
          // A rollup landing (DAYS_KEY) moves the windowed total too.
          if (changes[Tracking.DAYS_KEY]) satRefreshTaskWindow(res.task.id);
        }
        // [2.0] The Insights board is driven by these same keys: a rollup landing
        // (DAYS_KEY) or a session boundary (STORE_KEY, which shifts today's open
        // share) changes what the board shows. renderInsightsPanelEager is
        // self-gating — it repaints ONLY when the panel is visible and Pro, so a
        // background capture event on a non-Insights tab does no work.
        renderInsightsPanelEager();
      });
    }
  }

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
      // [1.0.19 D3] The demo intro group renders as a teaching strip, not a
      // normal group — no header, no count, no add tile.
      .map(function (g) { return g.id === "demo_intro" ? demoIntroHTML() : groupHTML(g, singleGroup); })
      .join("");
    ensureAllPlaceholders();
    initSortables();
    renderSidebarGroups();
    renderActiveTaskWidget();
    initSidebarSortable();
    initSidebarGroupObserver();
    checkNestingTooltip();
    renderReadOnlyBanner();
    // [1.0.11.9] Re-apply document-root settings so a foreign-write render
    // also surfaces wallpaper + icon-size changes (previously one-time init
    // only). Idempotent — applyBackground / applyIconSize / applyTextSize
    // replace classes and inline styles wholesale, so a re-run with unchanged
    // values is a visual no-op. loadBackground is async fire-and-forget; the
    // brief delay before background-image lands is acceptable for foreign sync.
    // [2.0] Text size rides this path too, so a change made in one tab lands in
    // every other open new tab without a reload — same as the wallpaper.
    loadBackground();
    applyIconSize((data && data.settings && data.settings.iconSize) || "medium");
    applyTextSize(Storage.getTextSize(data));
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

  // ===== [1.0.19] First-run example content =====
  //
  // D3: three teaching tiles rendered from the demo_intro group's records, so
  // they are data (cleared in one write with everything else) rather than
  // hard-coded markup with a second source of truth for "are examples present".
  //
  // D4: the Clear Examples control lives on the welcome tile and is GATED on
  // owning a real shortcut. The gate is computed HERE, at render, from
  // Storage.hasRealShortcut — never event-wired. That is what makes every add
  // path (add tile, right-click, bookmark import, top sites, drag) flip it
  // without being special-cased: no path has to remember to announce itself.
  //
  // aria-disabled + a handler guard, NOT the disabled attribute: a disabled
  // button fires no pointer events, so its hover tooltip could never appear —
  // and the tooltip is the whole explanation of why the control is inert.
  function demoIntroHTML() {
    var canClear = Storage.hasRealShortcut(data);
    var clearBtn =
      '<button type="button" class="demo-clear' + (canClear ? '' : ' is-gated') + '"' +
        ' data-demo-act="clear"' +
        ' aria-disabled="' + (canClear ? 'false' : 'true') + '">' +
        'Clear examples' +
      '</button>' +
      (canClear ? '' :
        '<span class="demo-clear-tip" role="tooltip">' +
          'Add your first shortcut to LaunchPad to clear the examples.' +
        '</span>');

    return (
      '<section class="group demo-intro" data-group-id="demo_intro">' +
        '<div class="demo-tiles">' +
          '<div class="demo-tile demo-tile-welcome">' +
            '<div class="demo-tile-title">Welcome to LaunchPad</div>' +
            '<p class="demo-tile-body">Your new tab, organised your way. ' +
              'Everything below is an example — open it, drag it, rename it, ' +
              'then make this grid yours.</p>' +
            '<div class="demo-clear-wrap">' + clearBtn + '</div>' +
          '</div>' +
          '<div class="demo-tile demo-tile-teach">' +
            '<div class="demo-tile-title">Save any page</div>' +
            '<p class="demo-tile-body">Right-click any page → ' +
              '<strong>Add to LaunchPad</strong>. That is the whole habit.</p>' +
          '</div>' +
          '<button type="button" class="demo-tile demo-tile-import" data-demo-act="import">' +
            '<span class="demo-tile-title">Already have bookmarks?</span>' +
            '<span class="demo-tile-body">Bring them in — top sites or Chrome bookmarks.</span>' +
          '</button>' +
          // [1.0.19 D12] A door to the picker that already exists — no new UI.
          // This revives the one genuinely liked job of the dead wizard's
          // screen 2, as a tile the user can ignore rather than a gate.
          '<button type="button" class="demo-tile demo-tile-background" data-demo-act="background">' +
            '<span class="demo-tile-title">Pick a background</span>' +
            '<span class="demo-tile-body">Make it yours — pick a background.</span>' +
          '</button>' +
        '</div>' +
      '</section>'
    );
  }

  // Clear is a single Storage call so the whole demo set leaves in ONE write;
  // the eager render pairing matches satActivate/satSetPaused — our own writes
  // are provenance-tagged, so the onChanged path deliberately will not repaint
  // this tab.
  async function clearDemoExamples() {
    if (!Storage.hasRealShortcut(data)) return; // handler guard for aria-disabled
    try {
      await Storage.clearDemoContent(data);
    } catch (err) {
      console.error("[LaunchPad] Clear examples failed:", err);
      return;
    }
    render();
  }

  // D7: Restore re-runs the same seed. seedDemoContent no-ops when examples are
  // already present, so this is idempotent by construction rather than by a
  // guard here.
  async function restoreDemoExamples() {
    var wrote = false;
    try {
      wrote = await Storage.seedDemoContent(data);
    } catch (err) {
      console.error("[LaunchPad] Restore examples failed:", err);
      return;
    }
    render();
    renderTipsRestoreState();
    return wrote;
  }

  // [1.0.19 D17] Tip 5 ("Switch workspaces") is only genuinely actionable when
  // the workspace switcher exists for this user — applyWorkspaceSwitcherState
  // hides #sb-workspace-switcher for anyone without Pro access. That was
  // EVERYONE on the free-only v1.0.5 build; from v2.0.0 it is only the users
  // without Pro, which is exactly why the row is computed rather than fixed —
  // a fixed actionable row would promise a click that goes nowhere. Computed at panel-open (the same
  // read-at-render discipline as the D4 Clear gate) and demoted to the static
  // treatment when unavailable, so the affordance stays honest either way.
  // [R3] Getting-Started checklist. The six rows reuse the D17 .tip-row shape and
  // keep their D18 doors (data-tip-act); ticked rows get a check + dim but stay
  // clickable as reference tips (zero-loss, R3-D4). Rows 2 and 3 are static
  // (not self-executable); the workspaces row is actionable only when the
  // switcher is available (folds in the old renderTipsActionability logic).
  var GS_ROWS = [
    { step: "1", act: "add-shortcut", vis: "tip-vis-plus",   text: "Add your first shortcut" },
    { step: "2", act: null,           vis: "tip-vis-menu",   html: 'Save a page with right-click &mdash; choose <strong>Add to LaunchPad</strong>' },
    { step: "3", act: null,           vis: "tip-vis-drag",   inner: "<i></i><i></i>", text: "Nest one tile on another" },
    { step: "4", act: "add-group",    vis: "tip-vis-folder", text: "Create a group" },
    { step: "5", act: "workspaces",   vis: "tip-vis-layers", text: "Switch workspaces" },
    { step: "6", act: "background",   vis: "tip-vis-swatch", inner: "<i></i><i></i><i></i>", text: "Pick a background" }
  ];

  function renderGettingStarted() {
    var host = document.getElementById("gs-checklist");
    if (!host) return;
    var gs = Storage.getGettingStarted(data);
    var steps = gs.steps || {};

    // Dismissed -> collapsed to the done-line only (permanent escape hatch).
    if (gs.dismissed) {
      host.innerHTML = '<div class="gs-doneline">You know your way around.</div>';
      return;
    }

    var done = GS_ROWS.reduce(function (n, r) { return n + (steps[r.step] ? 1 : 0); }, 0);
    var total = GS_ROWS.length;
    var complete = done >= total;

    var swBtn = $("#sb-workspace-switcher");
    var switcherAvailable = !!(swBtn && !swBtn.classList.contains("hidden"));

    var header = complete
      ? '<div class="gs-doneline">You know your way around.</div>'
      : '<div class="gs-header"><span class="gs-title">Getting started</span>' +
          '<span class="gs-count">' + done + ' of ' + total + '</span></div>';

    var rowsHtml = GS_ROWS.map(function (r) {
      var checked = !!steps[r.step];
      // Row 5's door only exists when the switcher is available.
      var actionable = !!r.act && (r.step !== "5" || switcherAvailable);
      var tag = actionable ? "button" : "div";
      var open = "<" + tag + ' class="tip-row gs-row ' + (actionable ? "is-actionable" : "is-static") +
        (checked ? " is-checked" : "") + '" data-step="' + r.step + '"' +
        (actionable ? ' type="button" data-tip-act="' + r.act + '" aria-disabled="false"' : ' role="note"') + ">";
      return open +
          '<span class="tip-visual ' + r.vis + '" aria-hidden="true">' + (r.inner || "") + '</span>' +
          '<span class="tip-text">' + (r.html || escapeHtml(r.text)) + '</span>' +
          '<span class="gs-check" aria-hidden="true">' + CHECK_SVG + '</span>' +
        "</" + tag + ">";
    }).join("");

    // The manual dismiss is ALWAYS available while the checklist is shown (R3-D4).
    host.innerHTML = header + '<div class="gs-rows">' + rowsHtml + '</div>' +
      '<button class="gs-dismiss" id="gs-dismiss" type="button">I know my way around</button>';
  }

  // Re-render the checklist iff the Tips panel is open (a tick from an action
  // funnel while the panel is showing lights the row in place).
  function refreshGettingStartedIfOpen() {
    var panel = document.getElementById("tips-panel");
    if (panel && !panel.classList.contains("hidden")) renderGettingStarted();
  }

  async function dismissGettingStartedChecklist() {
    if (Storage.dismissGettingStarted(data)) {
      try { await Storage.saveAll(data); } catch (err) { console.error("[LaunchPad] Getting-Started dismiss save failed", err); }
    }
    renderGettingStarted();
  }

  function renderTipsRestoreState() {
    var btn = $("#tips-restore-examples");
    var note = $("#tips-restore-note");
    if (!btn) return;
    var present = Storage.hasDemoContent(data);
    btn.setAttribute("aria-disabled", present ? "true" : "false");
    btn.classList.toggle("is-gated", present);
    if (note) {
      note.textContent = present
        ? "Examples are already on your grid."
        : "Puts the example groups and tips tiles back on your grid.";
    }
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
          // [1.0.19 D3] The demo intro group renders as a teaching strip, not a
      // normal group — no header, no count, no add tile.
      .map(function (g) { return g.id === "demo_intro" ? demoIntroHTML() : groupHTML(g, singleGroup); })
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
      // [1.0.19 D3] The demo intro group renders as a teaching strip, not a
      // normal group — no header, no count, no add tile.
      .map(function (g) { return g.id === "demo_intro" ? demoIntroHTML() : groupHTML(g, singleGroup); })
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
      // [R3] Checklist step 6. The background lives in a SEPARATE storage key
      // (saveBackground bypasses saveAll), so the tick needs its own data write
      // — provenance-correct (same-tab onChanged suppressed).
      if (Storage.recordChecklistStep(data, Storage.GS_STEPS.BACKGROUND)) {
        try { await Storage.saveAll(data); } catch (err) { console.error("[LaunchPad] Checklist bg-step save failed", err); }
        refreshGettingStartedIfOpen();
      }
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
    // Native <input type="date"> only opens its picker from the small calendar
    // glyph at the right edge — a poor hit target, and users read the whole
    // field as clickable. Delegate on document so this covers every date input
    // at once, including the ones the Tasks modals and the due-date popover
    // build from innerHTML strings after this runs.
    //
    // Keyboard entry is unaffected: showPicker() leaves focus on the input, so
    // typing still routes to the focused segment while the picker is open. The
    // native glyph click also lands here, adding a showPicker() on top of the
    // one the glyph performs itself — harmless, because showPicker() only ever
    // opens the picker; it has no close path to toggle.
    document.addEventListener("click", function (e) {
      var el = e.target;
      if (!el || el.tagName !== "INPUT" || el.type !== "date") return;
      if (el.disabled || el.readOnly) return;
      if (typeof el.showPicker !== "function") return; // non-Chromium / pre-99
      try {
        el.showPicker();
      } catch (err) {
        // Throws when the input is detached or the click was not treated as a
        // user gesture. The native glyph still opens the picker, so there is
        // nothing to recover here.
      }
    });

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

    // [1.0.19 D5/D6] Import + Tips sidebar entries and their panels.
    safeOn("#sb-import", "click", function (e) { e.stopPropagation(); openPanel("import"); });
    safeOn("#sb-tips", "click", function (e) { e.stopPropagation(); openPanel("tips"); });
    safeOn("#import-close", "click", function () { closeImportPanel(); });
    safeOn("#tips-close", "click", function () { closeTipsPanel(); });
    safeOn("#import-top-sites", "click", function () {
      closeImportPanel();
      importTopSites();
    });
    safeOn("#import-bookmarks", "click", function () {
      closeImportPanel();
      Bookmarks.showPicker();
    });
    safeOn("#tips-restore-examples", "click", function () {
      if (this.getAttribute("aria-disabled") === "true") return; // handler guard
      restoreDemoExamples();
    });

    // [1.0.19 D17] Actionable tips. Each routes through the EXISTING opener —
    // nothing new is built, this is a door to surfaces that already exist:
    //   add-shortcut -> openModal("add", groupId)  (the add-tile's own opener)
    //   add-group    -> addGroup()                 (#sb-add-group's own handler)
    //   workspaces   -> #sb-workspace-switcher.click()
    //   background   -> openBgModal()              (Settings' Change wallpaper)
    //
    // The switcher is triggered through its own control rather than by calling
    // its opener, because that opener is an inline listener inside
    // bindWorkspaceSwitcher with no named entry point — and extracting one
    // would mean refactoring Pro-adjacent code this round is not scoped to
    // touch. Clicking the real control reuses the real path exactly.
    //
    // [1.0.19 D18] supersedes D17's close-then-open: the panel now STAYS OPEN
    // behind whatever the tip launched. The tip click is inside the panel, so
    // the outside handler ignores it; and because the tip's own mousedown
    // landed inside too, any stray click the launched surface produces on
    // dismissal has no matching outside press and is ignored as well.
    safeOn("#tips-panel", "click", function (e) {
      // [R3] Manual dismiss — the always-available escape hatch (collapses to the
      // done-line). It carries no data-tip-act, so it is handled before the door
      // routing below and never mistaken for a door.
      if (e.target.closest && e.target.closest("#gs-dismiss")) {
        dismissGettingStartedChecklist();
        return;
      }
      var row = e.target.closest && e.target.closest("[data-tip-act]");
      if (!row) return;
      if (row.getAttribute("aria-disabled") === "true") return; // demoted to static
      var act = row.getAttribute("data-tip-act");

      // [1.0.19 D18] The panel is a playground: a tip opens its target and
      // STAYS OPEN behind it, so you can run the next tip without reopening.
      // (Every target layers above the panel — modals/picker 2000, history
      // 1500, panel 1200 — so they coexist without a stacking conflict.)

      if (act === "add-shortcut") {
        // Target the user's own first group rather than an example one, so a
        // shortcut added from here does not land inside content Clear removes.
        var ws = Storage.getActiveWorkspace(data);
        var gid = null;
        if (ws && Array.isArray(ws.groupOrder)) {
          for (var i = 0; i < ws.groupOrder.length; i++) {
            if (!Storage.isDemoGroup({ id: ws.groupOrder[i] })) { gid = ws.groupOrder[i]; break; }
          }
          if (!gid) gid = ws.groupOrder[0];
        }
        openModal("add", gid);
        return;
      }
      if (act === "add-group") { addGroup(); return; }
      if (act === "workspaces") {
        var sw = $("#sb-workspace-switcher");
        if (sw && !sw.classList.contains("hidden")) sw.click();
        return;
      }
      if (act === "background") { openBgModal(); }
    });

    // [1.0.19 D3/D4] Delegated handlers for the demo intro strip. Routing on
    // data-demo-act keeps the drawn state and the action it performs together,
    // and the gated Clear is guarded here as well as in clearDemoExamples.
    safeOn("#groups", "click", function (e) {
      var actEl = e.target.closest && e.target.closest("[data-demo-act]");
      if (!actEl) return;
      var act = actEl.getAttribute("data-demo-act");
      if (act === "clear") {
        e.preventDefault();
        if (actEl.getAttribute("aria-disabled") === "true") return;
        clearDemoExamples();
        return;
      }
      if (act === "import") {
        e.preventDefault();
        openPanel("import");
        return;
      }
      // [1.0.19 D12] Opens the EXISTING wallpaper picker directly, the same
      // surface Settings' "Change wallpaper" opens (openBgModal, which renders
      // the colour presets + gallery and switches to the Gallery tab). Chosen
      // over "open Settings scrolled to its wallpaper section" because it is
      // strictly smaller — one existing call, no scroll/focus plumbing — and
      // lands the user ON the picker rather than on a button they must then
      // click. #bg-overlay is deliberately outside the sidebar panel chain, so
      // this needs no mutual-exclusion coordination.
      if (act === "background") {
        e.preventDefault();
        openBgModal();
      }
    });

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
    // [2.0] Text size. Applies LIVE on click — the class flip is the whole
    // apply, so there is nothing to re-render. applyTextSize runs before the
    // await so the user sees the change on the click and not one storage round
    // trip later; setTextSize then validates and persists (and no-ops on a
    // re-click of the active tier).
    safeOn("#settings-text-size", "click", async function (e) {
      var btn = e.target.closest(".seg-btn");
      if (!btn) return;
      applyTextSize(btn.dataset.value);
      await Storage.setTextSize(data, btn.dataset.value);
      // Re-read: setTextSize refuses an unrecognised value, so the control must
      // show what is STORED, never what was clicked.
      applyTextSize(Storage.getTextSize(data));
      updateSettingsUI();
      console.log("[LaunchPad] Text size set to:", Storage.getTextSize(data));
    });
    safeOn("#settings-change-wallpaper", "click", function () {
      closeSettingsPanel();
      openBgModal();
    });
    // [bug 1217301679156798] Settings > Appearance > Wallpaper > Remove.
    //
    // This used to call handleBgRemove(), which is the MODAL's remove — it calls
    // previewBg(), and previewBg opens with `if (previousBg === null) return;`.
    // previousBg is only non-null between opening the background modal and
    // committing/cancelling it, so from the Settings panel the guard was always
    // true and the whole click did nothing. Even without the guard it would only
    // have PREVIEWED: persistence lives in commitBgPreview (the modal's Save),
    // which this button never reaches. Two independent reasons for zero effect.
    //
    // Broken by 493c7a6 (2026-04-23, preview-before-commit) which made the shared
    // helper modal-only without updating this second caller; the button predates
    // it (cf883c9, 2026-03-10). Shipped broken in v1.0.4 and v1.0.5.
    //
    // The fix persists directly, so this button converges on exactly what the
    // modal's Remove + Save does: paint DEFAULT_BG (applyBackground also updates
    // currentBg) and write it through. Deliberately does NOT tick the
    // Getting-Started background step the way commitBgPreview does — removing a
    // wallpaper is not "you set a background".
    safeOn("#settings-remove-wallpaper", "click", async function () {
      try {
        applyBackground(DEFAULT_BG);
        await Storage.saveBackground(DEFAULT_BG);
      } catch (err) {
        console.error("[LaunchPad] Wallpaper remove failed:", err);
      }
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

    // Close anchored transient popovers on viewport resize (DevTools toggle,
    // window resize, zoom). Each is position:fixed at coords computed once against
    // an anchor that reflows on resize, so it orphans mid-screen otherwise — the
    // resize analogue of the scroll drift-close above (bug 1217092468273137). One
    // bind-once permanent listener; every close* is a no-op when nothing is open,
    // so no per-open teardown and no leak. closeVariantDropdown cascades to the
    // variant ctx menu + icon dialog. The Switch dropdown self-closes via its own
    // per-open resize listener. Deliberately EXCLUDED: the #nest-rename-dialog —
    // it appears automatically to capture a just-nested group's name, so closing
    // it on resize would silently discard the prompt (it has no scroll-close
    // either, by the same design); a rare visual drift is the lesser evil.
    window.addEventListener("resize", function () {
      hideMenu();
      hideGroupMenu();
      closeVariantDropdown();
      closeGoalContextMenu();
      closeUpgradePopover();
      closeWorkspaceDropdown();
      closeNestSubmenu();
      closeTagSubmenu();
      closeTagCreatePopover();
      closeRestoreDropdown();
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
        // [R3] Add-modal nest: a real URL the user typed, added (step 1) as a
        // nested variant (step 3). Rides this write.
        Storage.recordChecklistStep(data, Storage.GS_STEPS.SHORTCUT);
        Storage.recordChecklistStep(data, Storage.GS_STEPS.NEST);
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
    // [R3-D5] Curator immediacy: a Pro user who just crossed 50 live shortcuts
    // via an add earns now (splash on next open), without waiting for the day-
    // opened backstop. Idempotent, so no double-earn with that backstop.
    await maybeCuratorAfterShortcutAdd();
    refreshGettingStartedIfOpen();
  }

  // [R3-D5] Pro-gated add-event Curator evaluation. The module `data` is fresh
  // (saveModal just re-read it), so the count includes the new shortcut.
  async function maybeCuratorAfterShortcutAdd() {
    if (!isProAccessibleLevel(currentAccessLevel())) return;
    var earned = false;
    try { earned = Storage.achievementsEvaluateCurator(data); } catch (err) { console.error("[LaunchPad] Curator eval failed", err); }
    if (earned) {
      try { await Storage.saveAll(data); } catch (err) { console.error("[LaunchPad] Curator save failed", err); }
      renderInsightsPanelEager();
    }
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
    refreshGettingStartedIfOpen();
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
        // [1.0.19 fix] Demo-marked shortcuts never form a nesting pair. The
        // seeded examples are Google-heavy (Google / Maps / Gmail / Docs /
        // Calendar all reduce to one match key), so on a fresh profile this
        // fired on the very first tab quoting our own example content — the
        // exact first-impression noise the redesign exists to remove.
        //
        // Excluding demo records rather than early-returning on
        // hasDemoContent is the smaller and more honest change: a user who
        // has examples AND two real same-domain shortcuts still gets the tip,
        // which is a genuine case an early-return would suppress.
        if (Storage.isDemoShortcut(s)) return;
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
