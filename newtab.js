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
    chrome.storage.onChanged.addListener(function (changes) {
      if (changes.data) {
        console.log("[LaunchPad] Storage changed externally, refreshing");
        data = changes.data.newValue || Storage.getDefaultData();
        if (!data.settings) data.settings = { columns: 6 };
        render();
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

  // ===== Settings Panel =====

  function openSettingsPanel() {
    var panel = $("#settings-panel");
    if (!panel) return;
    if (!panel.classList.contains("hidden")) { closeSettingsPanel(); return; }

    // Close other panels first
    closeRestoreDropdown();
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

  function closeSettingsPanel() {
    var panel = $("#settings-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    panel.classList.add("hidden");

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

  async function nestShortcutWith(shortcutId, targetId, groupId) {
    // Find the shortcut and target across all groups (dragged may have moved cross-group)
    var shortcut = null;
    var shortcutGroup = null;
    var target = null;
    var targetGroup = null;

    var nestWs = Storage.getActiveWorkspace(data);
    if (!nestWs) return;
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
    return (
      '<section class="' + groupClass + '" data-group-id="' + group.id + '">' +
        '<div class="group-header">' +
          '<div class="group-header-left" data-group-id="' + group.id + '">' +
            '<button class="group-collapse-btn" data-group-id="' + group.id + '" title="' + (collapsed ? "Expand" : "Collapse") + '">' + CHEVRON_DOWN_SVG + "</button>" +
            '<h2 class="group-name" data-group-id="' + group.id + '">' + esc(group.name) + "</h2>" +
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
    return (
      '<div class="shortcut' + (hasVariants ? ' has-variants' : '') + '" data-id="' + s.id + '">' +
        '<a href="' + esc(s.url) + '" class="shortcut-link" title="' + esc(s.title || s.url) + '">' +
          '<div class="shortcut-icon">' +
            '<img src="' + favicon + '" alt="" width="24" height="24" loading="lazy" data-url="' + esc(s.url) + '">' +
            badge +
          "</div>" +
          '<span class="shortcut-name">' + displayName + "</span>" +
        "</a>" +
        '<button class="shortcut-more" title="More actions">' + MORE_SVG + "</button>" +
      "</div>"
    );
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

  function renderSidebarGroups() {
    var list = $("#sb-group-list");
    if (!list) return;
    var ws = Storage.getActiveWorkspace(data);
    var groups = (ws && ws.groups) || [];
    var groupOrder = (ws && ws.groupOrder) || [];
    var groupMap = {};
    groups.forEach(function (g) { groupMap[g.id] = g; });
    list.innerHTML = groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean)
      .map(function (g) {
        return '<div class="sb-group-wrapper" data-group-id="' + g.id + '">' +
          '<div class="sb-group-item" data-group-id="' + g.id + '" title="' + esc(g.name) + '">' +
            '<span class="sidebar-drag-handle" title="Drag to reorder">\u2807</span>' +
            '<span class="sb-group-expand-chevron">' + CHEVRON_RIGHT_SVG + '</span>' +
            FOLDER_SVG +
            '<span class="sb-group-name">' + esc(g.name) + '</span>' +
            '<span class="sb-group-count">' + g.shortcuts.length + '</span>' +
            '<button class="sb-group-more" data-group-id="' + g.id + '" type="button" title="Group options">' + THREE_DOT_SM_SVG + '</button>' +
          '</div>' +
          '<div class="sidebar-shortcut-list" data-group-id="' + g.id + '">' +
            sidebarShortcutListHTML(g) +
          '</div>' +
        '</div>';
      }).join("");
    initSidebarShortcutSortables();
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
    sidebarSortable = new Sortable(list, {
      animation: 150,
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
    $$(".sidebar-shortcut-list").forEach(function (listEl) {
      var groupId = listEl.dataset.groupId;
      if (!groupId) return;
      var s = new Sortable(listEl, {
        animation: 150,
        draggable: ".sidebar-shortcut-item",
        ghostClass: "sb-shortcut-ghost",
        handle: ".sidebar-shortcut-drag-handle",
        filter: ".sidebar-shortcut-empty",
        preventOnFilter: false,
        onEnd: async function () {
          var group = findGroup(groupId);
          if (!group) return;
          var allShortcuts = {};
          group.shortcuts.forEach(function (sc) { allShortcuts[sc.id] = sc; });
          var newOrder = $$(".sidebar-shortcut-item", listEl)
            .map(function (el) { return allShortcuts[el.dataset.shortcutId]; })
            .filter(Boolean);
          group.shortcuts = newOrder;
          await Storage.saveAll(data);
          renderMainGrid();
          console.log("[LaunchPad] Shortcuts reordered via sidebar in group:", groupId);
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

  function scrollToGroup(groupId) {
    var el = document.querySelector('.group[data-group-id="' + groupId + '"]');
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleSidebarGroup(groupId) {
    var wrapper = document.querySelector('.sb-group-wrapper[data-group-id="' + groupId + '"]');
    if (!wrapper) return;
    var shortcutList = wrapper.querySelector(".sidebar-shortcut-list");
    var chevron = wrapper.querySelector(".sb-group-expand-chevron");
    if (!shortcutList) return;

    var isExpanded = wrapper.classList.contains("sb-expanded");

    if (isExpanded) {
      // Collapse
      shortcutList.style.maxHeight = shortcutList.scrollHeight + "px";
      shortcutList.offsetHeight; // force reflow
      shortcutList.style.maxHeight = "0";
      wrapper.classList.remove("sb-expanded");
      if (chevron) chevron.classList.remove("expanded");
    } else {
      // Collapse any other expanded group (accordion behavior)
      $$(".sb-group-wrapper.sb-expanded").forEach(function (other) {
        if (other === wrapper) return;
        var otherList = other.querySelector(".sidebar-shortcut-list");
        var otherChevron = other.querySelector(".sb-group-expand-chevron");
        if (otherList) {
          otherList.style.maxHeight = otherList.scrollHeight + "px";
          otherList.offsetHeight;
          otherList.style.maxHeight = "0";
        }
        other.classList.remove("sb-expanded");
        if (otherChevron) otherChevron.classList.remove("expanded");
      });

      // Expand
      wrapper.classList.add("sb-expanded");
      if (chevron) chevron.classList.add("expanded");
      shortcutList.style.maxHeight = shortcutList.scrollHeight + "px";
      // After transition, allow natural overflow for internal scrolling
      var onTransEnd = function () {
        shortcutList.style.maxHeight = "200px";
        shortcutList.removeEventListener("transitionend", onTransEnd);
      };
      shortcutList.addEventListener("transitionend", onTransEnd);
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

  function closeRestoreDropdown() {
    if (restoreCloseTimer) { clearTimeout(restoreCloseTimer); restoreCloseTimer = null; }
    closeRestoreDateMenu();
    var dd = $("#restore-dropdown");
    // Only unlock sidebar if the dropdown was actually open
    if (!dd || dd.classList.contains("hidden")) return;
    dd.classList.add("hidden");

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
    if (sidebarLocked) return;
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
      openRestoreDropdown();
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

      // Group row — toggle expand and scroll to group
      var groupItem = e.target.closest(".sb-group-item");
      if (groupItem) {
        var groupId = groupItem.dataset.groupId;
        toggleSidebarGroup(groupId);
        scrollToGroup(groupId);
      }
    });

    // Right-click on sidebar shortcuts
    safeOn("#sb-group-list", "contextmenu", function (e) {
      var shortcutItem = e.target.closest(".sidebar-shortcut-item");
      if (!shortcutItem || !shortcutItem.dataset.shortcutId) return;
      var listEl = shortcutItem.closest(".sidebar-shortcut-list");
      if (!listEl) return;
      showSidebarShortcutCtxMenu(e, shortcutItem.dataset.shortcutId, listEl.dataset.groupId);
    });

    // Sidebar shortcut context menu actions
    safeOn("#sidebar-shortcut-ctx-menu", "click", function (e) {
      var opt = e.target.closest(".sb-ctx-option");
      if (opt) handleSidebarCtxAction(opt.dataset.action);
    });

    // Close sidebar ctx menu on outside click and escape
    document.addEventListener("click", function (e) {
      if (sidebarCtxState && !e.target.closest("#sidebar-shortcut-ctx-menu")) {
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
    safeOn("#sb-settings", "click", function (e) { e.stopPropagation(); openSettingsPanel(); });

    // Settings panel events
    safeOn("#settings-close", "click", closeSettingsPanel);
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
      if (sidebar && !sidebarLocked) sidebar.classList.remove("expanded");
      hideSidebarPanel();
      if (sidebarLocked) return;
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
      if (!e.target.closest("#shortcut-menu") && !e.target.closest(".shortcut-more") && !e.target.closest("#nest-submenu")) {
        hideMenu();
        closeNestSubmenu();
      }
      if (!e.target.closest(".variant-dropdown") && !e.target.closest("#variant-ctx-menu") && !e.target.closest("#variant-icon-dialog") && !e.target.closest(".shortcut.has-variants")) {
        closeVariantDropdown();
      }
      if (!e.target.closest("#group-menu") && !e.target.closest(".group-more-btn") && !e.target.closest(".sb-group-more")) {
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
    });

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal(); hideMenu(); hideGroupMenu(); hideDeleteDialog();
        cancelBgPreview(); closeRcFilterMenu(); closeDomainPanel(); closeSettingsPanel();
        closeHistoryOverlay(); closeRestoreDropdown();
        closeVariantDropdown(); closeVariantCtxMenu(); closeVariantIconDialog(); closeNestSubmenu();
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

    $$(".shortcuts-grid").forEach(function (grid) {
      var s = new Sortable(grid, {
        group: "shortcuts",
        animation: 200,
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
            await syncShortcutsFromDOM();
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
    console.log("[NEST DEBUG] hoveredTarget:", targetEl ? targetEl.dataset.id : "null");
    console.log("[NEST DEBUG] lastX:", state.lastX, "lastY:", state.lastY);
    console.log("[NEST DEBUG] draggedDomain:", state.draggedDomain);

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
        console.log("[NEST DEBUG] candidate:", el.dataset.id, "key:", targetKey, "dist:", Math.round(dist));

        // Must be within 60px of the icon center
        if (dist < 60 && dist < bestDist) {
          bestDist = dist;
          targetEl = el;
        }
      });
      console.log("[NEST DEBUG] fallback result:", targetEl ? targetEl.dataset.id : "null");
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

    console.log("[NEST DEBUG] No nest target found, returning null");
    return null;
  }

  function findShortcutById(id) {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return null;
    var found = null;
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
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return;
    var allShortcuts = new Map();
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
