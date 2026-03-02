(function () {
  "use strict";

  var data = null;
  var sortables = [];
  var groupSortable = null;
  var activeMenu = null;
  var activeGroupMenu = null;
  var groupMenuCloseTimer = null;
  var restoreCloseTimer = null;
  var sidebarLocked = false;
  var modalState = {};
  var rcLoadedItems = [];
  var sidebarGroupObserver = null;
  var sidebarSortable = null;
  var faviconCache = {};
  var saveCacheTimeout;

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

  // ===== Favicon System =====

  var FAVICON_OVERRIDES = {
    "mail.google.com": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    "docs.google.com": "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico",
    "sheets.google.com": "https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico",
    "slides.google.com": "https://ssl.gstatic.com/docs/presentations/images/favicon5.ico",
    "drive.google.com": "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
    "calendar.google.com": "https://ssl.gstatic.com/calendar/images/favicon_v2021_48.ico",
    "meet.google.com": "https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v1/web-48dp/logo_meet_2020q4_color_1x_web_48dp.png",
    "maps.google.com": "https://maps.google.com/favicon.ico",
    "photos.google.com": "https://ssl.gstatic.com/imagemods/ui/1/photos_2016/ic_photos_googblue_28dp.png",
    "play.google.com": "https://www.gstatic.com/android/market_images/web/favicon_v3.ico",
    "ads.google.com": "https://ads.google.com/favicon.ico",
    "analytics.google.com": "https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg",
    "console.cloud.google.com": "https://www.gstatic.com/devrel-devsite/prod/v0e0f589edd85502a40d78d7d0b2f6c3f0c3a3549efb2a4e64ce0c4d3340e511e/cloud/images/favicons/onecloud/favicon.ico",
    "outlook.live.com": "https://res.cdn.office.net/assets/mail/pwa/v1/pngs/Outlook_256x256.png",
    "outlook.office.com": "https://res.cdn.office.net/assets/mail/pwa/v1/pngs/Outlook_256x256.png",
    "teams.microsoft.com": "https://statics.teams.cdn.office.net/hashedassets-new/favicon/favicon-prod.ico",
    "sellercentral.amazon.com": "https://sellercentral.amazon.com/favicon.ico",
    "admin.shopify.com": "https://cdn.shopify.com/shopifycloud/web/assets/v1/favicon-default.ico"
  };

  function getFaviconUrl(url) {
    var domain;
    try { domain = new URL(url).hostname; } catch (e) { return "assets/placeholder.svg"; }

    if (FAVICON_OVERRIDES[domain]) return FAVICON_OVERRIDES[domain];
    if (faviconCache[domain]) return faviconCache[domain];

    return "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=128";
  }

  function cacheFavicon(imgElement, domain) {
    if (!domain || faviconCache[domain]) return;
    try {
      var canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(imgElement, 0, 0, 64, 64);
      var dataUrl = canvas.toDataURL("image/png");
      faviconCache[domain] = dataUrl;
      debouncedSaveFaviconCache();
    } catch (e) {
      // Canvas tainted by cross-origin image — skip caching
    }
  }

  function debouncedSaveFaviconCache() {
    clearTimeout(saveCacheTimeout);
    saveCacheTimeout = setTimeout(function () {
      var keys = Object.keys(faviconCache);
      if (keys.length > 500) {
        var trimmed = {};
        keys.slice(keys.length - 500).forEach(function (k) { trimmed[k] = faviconCache[k]; });
        faviconCache = trimmed;
      }
      chrome.storage.local.set({ faviconCache: faviconCache });
    }, 2000);
  }

  function refreshOldFavicons() {
    var changed = false;
    data.groups.forEach(function (g) {
      g.shortcuts.forEach(function (s) {
        if (!s.url) return;
        // Skip custom user-uploaded favicons (data: URLs)
        if (s.favicon && s.favicon.indexOf("data:") === 0) return;
        var newFavicon = getFaviconUrl(s.url);
        if (s.favicon !== newFavicon) {
          s.favicon = newFavicon;
          changed = true;
        }
      });
    });
    if (changed) {
      Storage.saveAll(data);
      console.log("[LaunchPad] Refreshed old favicon URLs to higher quality sources");
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

  var SEARCH_ENGINES = {
    google: { action: "https://www.google.com/search", param: "q", placeholder: "Search Google or type a URL" },
    bing: { action: "https://www.bing.com/search", param: "q", placeholder: "Search Bing or type a URL" },
    duckduckgo: { action: "https://duckduckgo.com/", param: "q", placeholder: "Search DuckDuckGo or type a URL" },
    yahoo: { action: "https://search.yahoo.com/search", param: "p", placeholder: "Search Yahoo or type a URL" }
  };

  // ===== Init =====

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    console.log("[LaunchPad] Initializing...");
    data = await Storage.getAll();

    // Load favicon cache for instant icon display
    faviconCache = await new Promise(function (resolve) {
      chrome.storage.local.get("faviconCache", function (result) {
        resolve(result.faviconCache || {});
      });
    });

    // Guard against missing settings (corrupted storage)
    if (!data.settings) {
      data.settings = { columns: 6 };
      await Storage.saveAll(data);
      console.warn("[LaunchPad] Repaired missing settings");
    }
    if (!data.settings.collapsedGroups) {
      data.settings.collapsedGroups = {};
    }

    await loadBackground();
    applyIconSize(data.settings.iconSize || "medium");
    applySearchEngine(data.settings.searchEngine || "google");

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

    // Increment tab counter and check for promo toasts / right-click tip
    incrementTabCounter();
    checkRightClickTip();

    console.log("[LaunchPad] Ready —", data.groups.length, "group(s),",
      data.groups.reduce(function (n, g) { return n + g.shortcuts.length; }, 0), "shortcut(s)");
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

  var promoToastTimer = null;

  async function incrementTabCounter() {
    var result = await chrome.storage.local.get(["tabOpenCount", "bmcToastDismissed", "rateToastDismissed"]);
    var count = (result.tabOpenCount || 0) + 1;
    await chrome.storage.local.set({ tabOpenCount: count });

    // Check BMC toast (5th open)
    if (count >= 5 && !result.bmcToastDismissed) {
      showPromoToast("bmc");
      return;
    }
    // Check Rate toast (12th open)
    if (count >= 12 && !result.rateToastDismissed) {
      showPromoToast("rate");
    }
  }

  function showPromoToast(type) {
    var toast = $("#promo-toast");
    if (!toast) return;

    var icon = $("#promo-toast-icon");
    var text = $("#promo-toast-text");
    var cta = $("#promo-toast-cta");
    var dismiss = $("#promo-toast-dismiss");

    if (type === "bmc") {
      icon.textContent = "\u2615";
      text.textContent = "Enjoying LaunchPad? Consider buying me a coffee to support development!";
      cta.textContent = "Support \u2615";
      dismiss.textContent = "Maybe later";
      toast.dataset.type = "bmc";
    } else {
      icon.textContent = "\u2B50";
      text.textContent = "Love LaunchPad? A quick rating on the Chrome Web Store helps others find it!";
      cta.textContent = "Rate \u2B50";
      dismiss.textContent = "Not now";
      toast.dataset.type = "rate";
    }

    toast.classList.remove("hidden");
    // Trigger slide-in animation on next frame
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add("toast-visible");
      });
    });

    // Auto-dismiss after 15 seconds
    promoToastTimer = setTimeout(function () {
      dismissPromoToast();
    }, 15000);
  }

  function dismissPromoToast() {
    var toast = $("#promo-toast");
    if (!toast || toast.classList.contains("hidden")) return;

    if (promoToastTimer) {
      clearTimeout(promoToastTimer);
      promoToastTimer = null;
    }

    var type = toast.dataset.type;
    var flagKey = type === "bmc" ? "bmcToastDismissed" : "rateToastDismissed";
    var obj = {};
    obj[flagKey] = true;
    chrome.storage.local.set(obj);

    toast.classList.remove("toast-visible");
    setTimeout(function () {
      toast.classList.add("hidden");
    }, 400);
  }

  // ===== Right-Click Tip =====

  var rcTipTimer = null;

  async function checkRightClickTip() {
    var result = await chrome.storage.local.get(["tabOpenCount", "rightClickTipShown"]);
    var count = result.tabOpenCount || 0;
    // Show on 2nd tab open (not first — user is still in onboarding)
    if (count >= 2 && !result.rightClickTipShown) {
      showRightClickTip();
    }
  }

  function showRightClickTip() {
    // Don't show if a promo toast is already visible
    var promoToast = $("#promo-toast");
    if (promoToast && !promoToast.classList.contains("hidden")) return;

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
          addedAt: Date.now()
        };
      });
      data.groups.push({ id: groupId, name: "Top Sites", shortcuts: shortcuts });
      data.groupOrder.push(groupId);
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

  function renderObGallery() {
    var grid = $("#ob-bg-grid");
    if (!grid) return;
    var html = '<button class="ob-bg-thumb ob-bg-none selected" data-bg="" type="button">' +
      '<span class="ob-bg-check">' + CHECK_SVG + '</span>' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '<span>None</span></button>';
    html += GALLERY_IMAGES.map(function (img) {
      return '<button class="ob-bg-thumb" data-bg="' + img.url + '" type="button" title="' + esc(img.label) + '">' +
        '<span class="ob-bg-check">' + CHECK_SVG + '</span>' +
        '<img src="' + img.thumb + '" alt="' + esc(img.label) + '" loading="lazy">' +
        '</button>';
    }).join("");
    grid.innerHTML = html;
    obSelectedBg = "";
  }

  function selectObBg(thumbEl) {
    $$(".ob-bg-thumb", $("#ob-bg-grid")).forEach(function (el) {
      el.classList.remove("selected");
    });
    thumbEl.classList.add("selected");
    obSelectedBg = thumbEl.dataset.bg;
    // Live preview
    if (obSelectedBg) {
      applyBackground(obSelectedBg);
    } else {
      removeBackgroundVisual();
    }
  }

  function handleObBgNext() {
    // Save the selected background
    if (obSelectedBg) {
      Storage.saveBackground(obSelectedBg).then(function () {
        applyBackground(obSelectedBg);
      });
    } else {
      Storage.saveBackground(null);
      removeBackgroundVisual();
    }
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
        addedAt: Date.now()
      };
    });
    // Add to "Ungrouped" group or create "Quick Start"
    var ungrouped = data.groups.find(function (g) { return g.id === "ungrouped"; });
    if (ungrouped) {
      ungrouped.shortcuts = ungrouped.shortcuts.concat(shortcuts);
    } else {
      var groupId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      data.groups.push({ id: groupId, name: "Quick Start", shortcuts: shortcuts });
      data.groupOrder.push(groupId);
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

    // Search engine custom dropdown
    var engine = (data.settings && data.settings.searchEngine) || "google";
    var label = $("#search-engine-label");
    if (label) {
      var names = { google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", yahoo: "Yahoo" };
      label.textContent = names[engine] || "Google";
    }
    $$(".settings-dropdown-option", $("#settings-search-engine")).forEach(function (opt) {
      opt.classList.toggle("active", opt.dataset.value === engine);
    });

    // Wallpaper thumbnail
    updateWallpaperThumb();
  }

  function updateWallpaperThumb() {
    var thumb = $("#settings-wallpaper-thumb");
    if (!thumb) return;
    var bgUrl = document.body.style.backgroundImage;
    if (bgUrl && bgUrl !== "none") {
      thumb.style.backgroundImage = bgUrl;
    } else {
      thumb.style.backgroundImage = "none";
    }
    // Show/hide remove button based on whether background exists
    var removeBtn = $("#settings-remove-wallpaper");
    if (removeBtn) {
      removeBtn.style.display = (bgUrl && bgUrl !== "none") ? "" : "none";
    }
  }

  function applyIconSize(size) {
    var html = document.documentElement;
    html.classList.remove("icon-size-small", "icon-size-large");
    if (size === "small") html.classList.add("icon-size-small");
    else if (size === "large") html.classList.add("icon-size-large");
  }

  function applySearchEngine(engine) {
    var config = SEARCH_ENGINES[engine] || SEARCH_ENGINES.google;
    var form = $("#search-form");
    var input = $("#search-input");
    if (form) form.action = config.action;
    if (input) {
      input.name = config.param;
      input.placeholder = config.placeholder;
    }
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
    var groupMap = {};
    data.groups.forEach(function (g) { groupMap[g.id] = g; });
    var singleGroup = data.groupOrder.length <= 1;
    container.innerHTML = data.groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean)
      .map(function (g) { return groupHTML(g, singleGroup); })
      .join("");
    ensureAllPlaceholders();
    initSortables();
    renderSidebarGroups();
    initSidebarSortable();
    initSidebarGroupObserver();
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
    var favicon = (s.favicon && s.favicon.indexOf("data:") === 0) ? s.favicon : getFaviconUrl(s.url);
    return (
      '<div class="shortcut" data-id="' + s.id + '">' +
        '<a href="' + esc(s.url) + '" class="shortcut-link" title="' + esc(s.title || s.url) + '">' +
          '<div class="shortcut-icon">' +
            '<img crossorigin="anonymous" src="' + favicon + '" alt="" width="24" height="24" loading="lazy" data-url="' + esc(s.url) + '" data-domain="' + esc(domain) + '">' +
          "</div>" +
          '<span class="shortcut-name">' + esc(s.title || domain) + "</span>" +
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
    var groupMap = {};
    data.groups.forEach(function (g) { groupMap[g.id] = g; });
    list.innerHTML = data.groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean)
      .map(function (g) {
        return '<div class="sb-group-item" data-group-id="' + g.id + '" title="' + esc(g.name) + '">' +
          FOLDER_SVG +
          '<span class="sb-group-name">' + esc(g.name) + '</span>' +
          '<span class="sb-group-count">' + g.shortcuts.length + '</span>' +
          '<button class="sb-group-more" data-group-id="' + g.id + '" type="button" title="Group options">' + THREE_DOT_SM_SVG + '</button>' +
        '</div>';
      }).join("");
  }

  function initSidebarSortable() {
    if (sidebarSortable) { sidebarSortable.destroy(); sidebarSortable = null; }
    var list = $("#sb-group-list");
    if (!list || typeof Sortable === "undefined") return;
    sidebarSortable = new Sortable(list, {
      animation: 150,
      draggable: ".sb-group-item",
      ghostClass: "sb-group-ghost",
      filter: ".sb-group-more",
      preventOnFilter: false,
      onEnd: async function () {
        data.groupOrder = $$("#sb-group-list > .sb-group-item").map(function (el) { return el.dataset.groupId; });
        await Storage.saveAll(data);
        // Re-render main page to match new order
        var container = $("#groups");
        var groupMap = {};
        data.groups.forEach(function (g) { groupMap[g.id] = g; });
        var singleGroup = data.groupOrder.length <= 1;
        container.innerHTML = data.groupOrder
          .map(function (id) { return groupMap[id]; })
          .filter(Boolean)
          .map(function (g) { return groupHTML(g, singleGroup); })
          .join("");
        ensureAllPlaceholders();
        initSortables();
        initSidebarGroupObserver();
        console.log("[LaunchPad] Groups reordered via sidebar drag:", data.groupOrder);
      }
    });
  }

  function scrollToGroup(groupId) {
    var el = document.querySelector('.group[data-group-id="' + groupId + '"]');
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (bgData) {
      applyBackground(bgData);
    }
  }

  function applyBackground(bgUrl) {
    document.body.style.backgroundImage = "url('" + bgUrl + "')";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundAttachment = "fixed";
    document.documentElement.classList.add("has-bg");
  }

  function removeBackgroundVisual() {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundRepeat = "";
    document.body.style.backgroundAttachment = "";
    document.documentElement.classList.remove("has-bg");
  }

  function openBgModal() {
    $("#bg-overlay").classList.remove("hidden");
    $("#bg-url-input").value = "";
    hideBgError();
    renderBgGallery();
    switchBgTab("gallery");
  }

  function closeBgModal() {
    $("#bg-overlay").classList.add("hidden");
    hideBgError();
    updateWallpaperThumb();
  }

  function renderBgGallery() {
    var grid = $("#bg-gallery-grid");
    if (!grid) return;
    var currentBg = document.body.style.backgroundImage;
    var html = '<button class="bg-gallery-thumb bg-gallery-none' + (!currentBg ? ' selected' : '') + '" data-bg="" type="button">' +
      '<span class="bg-check">' + CHECK_SVG + '</span>' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '<span>None</span></button>';
    html += GALLERY_IMAGES.map(function (img) {
      var isSelected = currentBg && currentBg.indexOf(img.url) !== -1;
      return '<button class="bg-gallery-thumb' + (isSelected ? ' selected' : '') + '" data-bg="' + img.url + '" type="button" title="' + esc(img.label) + '">' +
        '<span class="bg-check">' + CHECK_SVG + '</span>' +
        '<img src="' + img.thumb + '" alt="' + esc(img.label) + '" loading="lazy">' +
        '</button>';
    }).join("");
    grid.innerHTML = html;
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
    var url = thumbEl.dataset.bg;
    if (url) {
      // Gallery image — store URL directly (saves space)
      Storage.saveBackground(url).then(function () {
        applyBackground(url);
        closeBgModal();
      });
    } else {
      // "None" selected — remove background
      handleBgRemove();
    }
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
          Storage.saveBackground(dataUrl).then(function () {
            applyBackground(dataUrl);
            closeBgModal();
          });
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
        Storage.saveBackground(dataUrl).then(function () {
          applyBackground(dataUrl);
          closeBgModal();
        });
      });
    };
    img.onerror = function () {
      showBgError("Could not load image. The server may block external access. Try uploading the image instead.");
    };
    img.src = url;
  }

  async function handleBgRemove() {
    await Storage.saveBackground(null);
    removeBackgroundVisual();
    closeBgModal();
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
      var moreBtn = e.target.closest(".sb-group-more");
      if (moreBtn) {
        e.preventDefault();
        e.stopPropagation();
        showGroupMenu(moreBtn.dataset.groupId, moreBtn);
        return;
      }
      var item = e.target.closest(".sb-group-item");
      if (item) scrollToGroup(item.dataset.groupId);
    });

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
    safeOn("#search-engine-btn", "click", function (e) {
      e.stopPropagation();
      var menu = $("#search-engine-menu");
      var btn = $("#search-engine-btn");
      if (!menu) return;
      var isOpen = !menu.classList.contains("hidden");
      menu.classList.toggle("hidden", isOpen);
      if (btn) btn.classList.toggle("open", !isOpen);
    });
    safeOn("#search-engine-menu", "click", function (e) {
      var opt = e.target.closest(".settings-dropdown-option");
      if (!opt) return;
      data.settings.searchEngine = opt.dataset.value;
      Storage.saveAll(data);
      applySearchEngine(opt.dataset.value);
      updateSettingsUI();
      $("#search-engine-menu").classList.add("hidden");
      var btn = $("#search-engine-btn");
      if (btn) btn.classList.remove("open");
      console.log("[LaunchPad] Search engine set to:", opt.dataset.value);
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

    // Group context menu — close on mouseleave after 300ms delay
    safeOn("#group-menu", "mouseleave", function () {
      groupMenuCloseTimer = setTimeout(hideGroupMenu, 300);
    });
    safeOn("#group-menu", "mouseenter", function () {
      if (groupMenuCloseTimer) { clearTimeout(groupMenuCloseTimer); groupMenuCloseTimer = null; }
    });

    // Global favicon error fallback — step-based fallback chain
    document.addEventListener("error", function (e) {
      var img = e.target;
      if (img.tagName !== "IMG") return;
      if (!img.closest(".shortcut-icon, .rc-icon, .ob-popular-icon, .ob-preview-favicon, .restore-tab-item, .rc-panel-item")) return;

      var url = img.dataset.url || (img.closest("a[href]") && img.closest("a[href]").href) || "";
      var domain;
      try { domain = new URL(url).hostname; } catch (ex) { domain = ""; }
      if (!domain) { img.src = "assets/placeholder.svg"; return; }

      var src = img.getAttribute("src") || "";
      var tried = (img.dataset.triedFallbacks || "").split(",").filter(Boolean);

      // Mark current source as tried
      if (src.indexOf("google.com/s2/favicons") !== -1) tried.push("google");
      else if (src.indexOf("duckduckgo.com") !== -1) tried.push("ddg");
      else if (src.indexOf("/favicon.ico") !== -1) tried.push("direct");
      else tried.push("other");
      img.dataset.triedFallbacks = tried.join(",");

      // Try next untried source
      if (tried.indexOf("google") === -1) {
        img.src = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=128";
      } else if (tried.indexOf("ddg") === -1) {
        img.src = "https://icons.duckduckgo.com/ip3/" + domain + ".ico";
      } else if (tried.indexOf("direct") === -1) {
        img.removeAttribute("crossorigin");
        try { img.src = new URL(url).origin + "/favicon.ico"; } catch (ex) { img.src = "assets/placeholder.svg"; }
      } else {
        img.src = "assets/placeholder.svg";
      }
    }, true);

    // Global favicon load handler — cache successfully loaded favicons
    document.addEventListener("load", function (e) {
      var img = e.target;
      if (img.tagName !== "IMG") return;
      if (!img.closest(".shortcut-icon, .rc-icon, .ob-popular-icon, .ob-preview-favicon, .restore-tab-item, .rc-panel-item")) return;
      var src = img.src || "";
      // Don't cache data URLs (already cached) or local placeholders
      if (src.indexOf("data:") === 0 || src.indexOf("assets/") !== -1 || src.indexOf("placeholder") !== -1) return;
      var domain = img.dataset.domain;
      if (!domain) {
        var url = img.dataset.url || (img.closest("a[href]") && img.closest("a[href]").href) || "";
        try { domain = new URL(url).hostname; } catch (ex) { return; }
      }
      if (domain && !faviconCache[domain]) {
        cacheFavicon(img, domain);
      }
    }, true);

    // First-run toast events
    safeOn("#toast-dismiss", "click", hideFirstRunToast);
    safeOn("#toast-import", "click", function (e) {
      e.preventDefault();
      hideFirstRunToast();
      Bookmarks.showPicker();
    });

    // Promo toast events
    safeOn("#promo-toast-cta", "click", function () {
      var toast = $("#promo-toast");
      var type = toast ? toast.dataset.type : "";
      if (type === "bmc") {
        window.open("https://buymeacoffee.com/cybersamwise", "_blank");
      } else {
        window.open("https://chrome.google.com/webstore/detail/launchpad/EXTENSION_ID_HERE", "_blank");
      }
      dismissPromoToast();
    });
    safeOn("#promo-toast-dismiss", "click", function (e) { e.preventDefault(); dismissPromoToast(); });
    safeOn("#promo-toast-close", "click", dismissPromoToast);

    // Right-click tip
    safeOn("#rc-tip-dismiss", "click", dismissRightClickTip);

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
        preview.src = getFaviconUrl(modalState.shortcut.url);
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
      if (e.target === e.currentTarget) closeBgModal();
    });
    safeOn("#bg-cancel", "click", closeBgModal);
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
      Storage.saveBackground(null);
      removeBackgroundVisual();
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

    // Close menus on outside click
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#shortcut-menu") && !e.target.closest(".shortcut-more")) {
        hideMenu();
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
      if (!e.target.closest("#search-engine-btn") && !e.target.closest("#search-engine-menu")) {
        var seMenu = $("#search-engine-menu");
        var seBtn = $("#search-engine-btn");
        if (seMenu) seMenu.classList.add("hidden");
        if (seBtn) seBtn.classList.remove("open");
      }
    });

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal(); hideMenu(); hideGroupMenu(); hideDeleteDialog();
        closeBgModal(); closeRcFilterMenu(); closeDomainPanel(); closeSettingsPanel();
        closeHistoryOverlay(); closeRestoreDropdown();
        var sidebar = $("#sidebar");
        if (sidebar && sidebar.classList.contains("mobile-open")) toggleMobileSidebar();
      }
    });

    // Close menu on scroll
    window.addEventListener("scroll", function () { hideMenu(); hideGroupMenu(); });

  }

  // ===== Context Menu =====

  function showMenu(shortcutId, groupId, anchor) {
    hideMenu();
    activeMenu = { shortcutId: shortcutId, groupId: groupId };
    var menu = $("#shortcut-menu");
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
        var currentFavicon = (shortcut.favicon && shortcut.favicon.indexOf("data:") === 0)
          ? shortcut.favicon : getFaviconUrl(shortcut.url);
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
      var newShortcut = {
        url: url,
        title: name || getDomain(url).replace(/^www\./, "")
      };
      if (modalState.customFavicon) newShortcut.favicon = modalState.customFavicon;
      await Storage.addShortcut(modalState.groupId, newShortcut);
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

  function showGroupMenu(groupId, anchor) {
    hideGroupMenu();
    activeGroupMenu = groupId;
    var menu = $("#group-menu");
    if (!menu) return;
    var rect = anchor.getBoundingClientRect();
    var sidebar = $("#sidebar");

    // Disable "Open All" if group has no shortcuts
    var group = findGroup(groupId);
    var openAllOpt = menu.querySelector('[data-action="openall"]');
    if (openAllOpt) {
      var empty = !group || !group.shortcuts.length;
      openAllOpt.classList.toggle("gm-disabled", empty);
      openAllOpt.disabled = empty;
    }

    // Lock sidebar + panel open while context menu is visible
    sidebarLocked = true;
    if (sidebar) {
      sidebar.classList.add("sidebar-locked");
      sidebar.classList.add("expanded");
    }
    showSidebarPanel();

    menu.classList.remove("hidden");
    menu.style.top = rect.top + "px";
    // Position at sidebar expanded width (260px) + 8px gap
    menu.style.left = "268px";

    // If overflowing right, flip to left side
    var menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth - 8) {
      menu.style.left = (260 - menuRect.width - 8) + "px";
    }
    // If overflowing bottom, shift up
    if (menuRect.bottom > window.innerHeight - 8) {
      menu.style.top = Math.max(8, window.innerHeight - menuRect.height - 8) + "px";
    }
  }

  function hideGroupMenu() {
    if (groupMenuCloseTimer) { clearTimeout(groupMenuCloseTimer); groupMenuCloseTimer = null; }
    var menu = $("#group-menu");
    // Only unlock sidebar if the menu was actually open
    if (!menu || menu.classList.contains("hidden")) {
      activeGroupMenu = null;
      return;
    }
    menu.classList.add("hidden");
    activeGroupMenu = null;

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
      moveTarget.innerHTML = data.groups
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
        onStart: function () {
          $$(".shortcuts-grid").forEach(function (g) {
            g.classList.add("is-dragging");
          });
        },
        onEnd: async function () {
          $$(".shortcuts-grid").forEach(function (g) {
            g.classList.remove("is-dragging");
          });
          $$(".grid-placeholder").forEach(function (el) { el.remove(); });
          await syncShortcutsFromDOM();
          ensureAllPlaceholders();
          console.log("[LaunchPad] Shortcuts reordered via drag");
        }
      });
      sortables.push(s);
    });
  }

  function destroySortables() {
    if (groupSortable) { groupSortable.destroy(); groupSortable = null; }
    if (sidebarSortable) { sidebarSortable.destroy(); sidebarSortable = null; }
    sortables.forEach(function (s) { s.destroy(); });
    sortables = [];
  }

  async function syncShortcutsFromDOM() {
    var allShortcuts = new Map();
    data.groups.forEach(function (g) {
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
    group.shortcuts.forEach(function (s, i) {
      chrome.tabs.create({ url: s.url, active: i === 0 });
    });
    showOpenAllToast(group.shortcuts.length, group.name);
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
    return data.groups.find(function (g) { return g.id === id; });
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
