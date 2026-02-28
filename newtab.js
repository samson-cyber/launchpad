(function () {
  "use strict";

  var data = null;
  var sortables = [];
  var groupSortable = null;
  var activeMenu = null;
  var modalState = {};

  var $ = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return [].slice.call((p || document).querySelectorAll(s)); };

  // ===== SVG Icons =====

  var MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SUN_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var PLUS_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var CLOSE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var MORE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
  var RC_FALLBACK_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';

  // ===== Init =====

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    console.log("[LaunchPad] Initializing...");
    data = await Storage.getAll();

    // Guard against missing settings (corrupted storage)
    if (!data.settings) {
      data.settings = { theme: "system", columns: 6 };
      await Storage.saveAll(data);
      console.warn("[LaunchPad] Repaired missing settings");
    }

    await loadBackground();
    applyTheme();

    // First-run: show toast instead of welcome screen
    if (Bookmarks.isFirstRun(data)) {
      showFirstRunToast();
    }

    render();
    bindEvents();
    renderRecentlyClosed();
    Bookmarks.bindEvents(function (newData) {
      data = newData;
      hideFirstRunToast();
      render();
    });

    // Listen for external storage changes (e.g. context menu adds a shortcut)
    chrome.storage.onChanged.addListener(function (changes) {
      if (changes.data) {
        console.log("[LaunchPad] Storage changed externally, refreshing");
        data = changes.data.newValue || Storage.getDefaultData();
        if (!data.settings) data.settings = { theme: "system", columns: 6 };
        render();
      }
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (data.settings.theme === "system") applyTheme();
    });

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

  // ===== Theme =====

  function isDark() {
    var t = (data.settings && data.settings.theme) || "system";
    return t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function applyTheme() {
    if (document.documentElement.classList.contains("has-bg")) return;
    var dark = isDark();
    document.documentElement.classList.toggle("dark", dark);
    $("#theme-toggle").innerHTML = dark ? SUN_SVG : MOON_SVG;
  }

  async function toggleTheme() {
    data.settings.theme = isDark() ? "light" : "dark";
    await Storage.saveAll(data);
    applyTheme();
    console.log("[LaunchPad] Theme set to:", data.settings.theme);
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
    initSortables();
  }

  function groupHTML(group, singleGroup) {
    var headerClass = "group-header" + (singleGroup ? " single-group" : "");
    var deleteBtn = (group.id === "ungrouped" || singleGroup)
      ? ""
      : '<button class="group-delete-btn" data-group-id="' + group.id + '" title="Delete group">' + CLOSE_SVG + "</button>";
    return (
      '<section class="group" data-group-id="' + group.id + '">' +
        '<div class="' + headerClass + '">' +
          '<h2 class="group-name" data-group-id="' + group.id + '">' + esc(group.name) + "</h2>" +
          '<div class="group-header-actions">' +
            deleteBtn +
          "</div>" +
        "</div>" +
        '<div class="shortcuts-grid" data-group-id="' + group.id + '">' +
          group.shortcuts.map(function (s) { return shortcutHTML(s); }).join("") +
          addTileHTML(group.id) +
        "</div>" +
      "</section>"
    );
  }

  function shortcutHTML(s) {
    var domain = getDomain(s.url);
    var favicon = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=64";
    return (
      '<div class="shortcut" data-id="' + s.id + '">' +
        '<a href="' + esc(s.url) + '" class="shortcut-link" title="' + esc(s.title || s.url) + '">' +
          '<div class="shortcut-icon">' +
            '<img src="' + favicon + '" alt="" width="24" height="24" loading="lazy" ' +
              'onerror="this.onerror=null;this.src=\'assets/placeholder.svg\'">' +
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

  // ===== Recently Closed / History =====

  var rcDismissed = false;
  var rcActiveFilter = "recent";
  var rcCustomStart = null;
  var rcCustomEnd = null;

  function renderRecentlyClosed() {
    if (rcDismissed) return;
    loadRcData(rcActiveFilter);
  }

  function loadRcData(filter) {
    if (filter === "recent") {
      loadRecentSessions();
    } else if (filter === "custom") {
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
      }
      loadHistory(startTime, endTime);
    }
  }

  function loadRecentSessions() {
    if (!chrome.sessions || !chrome.sessions.getRecentlyClosed) {
      console.warn("[LaunchPad] chrome.sessions API not available");
      return;
    }
    chrome.sessions.getRecentlyClosed({ maxResults: 10 }, function (sessions) {
      var tabs = [];
      (sessions || []).forEach(function (s) {
        if (s.tab && s.tab.url && !/^chrome:\/\//i.test(s.tab.url)) {
          tabs.push({ url: s.tab.url, title: s.tab.title });
        }
      });
      tabs = deduplicateByUrl(tabs).slice(0, 8);
      showRcItems(tabs);
    });
  }

  function loadHistory(startTime, endTime) {
    if (!chrome.history || !chrome.history.search) {
      console.warn("[LaunchPad] chrome.history API not available");
      return;
    }
    chrome.history.search({
      text: "",
      startTime: startTime,
      endTime: endTime,
      maxResults: 100
    }, function (results) {
      var items = (results || [])
        .filter(function (r) { return r.url && !/^chrome:\/\//i.test(r.url); })
        .map(function (r) { return { url: r.url, title: r.title }; });
      items = deduplicateByUrl(items).slice(0, 16);
      showRcItems(items);
    });
  }

  function deduplicateByUrl(items) {
    var seen = {};
    return items.filter(function (item) {
      if (seen[item.url]) return false;
      seen[item.url] = true;
      return true;
    });
  }

  function showRcItems(items) {
    var section = $("#recently-closed");
    var list = $("#recently-closed-list");
    if (!items.length) {
      list.innerHTML = '<span class="rc-empty">No pages found</span>';
      section.classList.remove("hidden");
      updateRcScroll();
      return;
    }
    list.innerHTML = items.map(function (t) { return rcItemHTML(t); }).join("");
    section.classList.remove("hidden");
    updateRcScroll();
  }

  function rcItemHTML(tab) {
    var domain = getDomain(tab.url);
    var favicon = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=64";
    var title = tab.title || domain;
    return (
      '<div class="rc-item">' +
        '<a href="' + esc(tab.url) + '" class="rc-link" title="' + esc(title) + '">' +
          '<div class="rc-icon">' +
            '<img src="' + favicon + '" alt="" width="24" height="24" loading="lazy" ' +
              'onerror="this.onerror=null;this.src=\'assets/placeholder.svg\'">' +
          '</div>' +
          '<span class="rc-name">' + esc(title) + '</span>' +
        '</a>' +
      '</div>'
    );
  }

  function updateRcFilterLabel() {
    var label = $("#rc-filter-label");
    if (rcActiveFilter === "recent") label.textContent = "Recently closed";
    else if (rcActiveFilter === "today") label.textContent = "Visited today";
    else if (rcActiveFilter === "yesterday") label.textContent = "Visited yesterday";
    else if (rcActiveFilter === "week") label.textContent = "Last 7 days";
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

  function updateRcScroll() {
    var wrapper = $("#rc-scroll-wrapper");
    var list = $("#recently-closed-list");
    if (!wrapper || !list) return;
    var hasOverflow = list.scrollWidth > wrapper.clientWidth;
    wrapper.classList.toggle("has-overflow-right", hasOverflow && list.scrollLeft < list.scrollWidth - wrapper.clientWidth - 2);
    wrapper.classList.toggle("has-overflow-left", hasOverflow && list.scrollLeft > 2);
  }

  // ===== Background =====

  async function loadBackground() {
    var bgData = await Storage.getBackground();
    if (bgData) {
      applyBackground(bgData);
    }
  }

  function applyBackground(dataUrl) {
    document.body.style.backgroundImage = 'url("' + dataUrl + '")';
    document.documentElement.classList.add("has-bg");
    document.documentElement.classList.remove("dark");
  }

  function removeBackgroundVisual() {
    document.body.style.backgroundImage = "";
    document.documentElement.classList.remove("has-bg");
    applyTheme();
  }

  function openBgModal() {
    $("#bg-overlay").classList.remove("hidden");
    $("#bg-url-input").value = "";
    hideBgError();
  }

  function closeBgModal() {
    $("#bg-overlay").classList.add("hidden");
    hideBgError();
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
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#add-group-btn").addEventListener("click", addGroup);

    // First-run toast events
    var toastDismiss = $("#toast-dismiss");
    if (toastDismiss) {
      toastDismiss.addEventListener("click", hideFirstRunToast);
    }
    var toastImport = $("#toast-import");
    if (toastImport) {
      toastImport.addEventListener("click", function (e) {
        e.preventDefault();
        hideFirstRunToast();
        Bookmarks.showPicker();
      });
    }

    // Delegated clicks on groups container
    $("#groups").addEventListener("click", function (e) {
      var el;

      el = e.target.closest(".add-tile");
      if (el) { openModal("add", el.dataset.groupId); return; }

      el = e.target.closest(".group-delete-btn");
      if (el) { deleteGroup(el.dataset.groupId); return; }

      el = e.target.closest(".shortcut-more");
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        var tile = el.closest(".shortcut");
        var grid = tile.closest(".shortcuts-grid");
        showMenu(tile.dataset.id, grid.dataset.groupId, el);
        return;
      }

      el = e.target.closest(".group-name");
      if (el) { startRename(el); return; }
    });

    // Modal
    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-save").addEventListener("click", saveModal);
    $("#modal-overlay").addEventListener("click", function (e) {
      if (e.target === e.currentTarget) closeModal();
    });

    // Import bookmarks link inside modal
    $("#modal-import-bookmarks").addEventListener("click", function (e) {
      e.preventDefault();
      closeModal();
      Bookmarks.showPicker();
    });

    // URL auto-populates name (only when name is empty or was auto-filled)
    $("#modal-url").addEventListener("input", function () {
      if ($("#modal-name").dataset.edited === "true") return;
      var domain = getDomain(this.value.trim());
      if (domain) $("#modal-name").value = domain.replace(/^www\./, "");
    });
    $("#modal-name").addEventListener("input", function () {
      this.dataset.edited = "true";
    });

    // Enter in modal fields
    $("#modal-url").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); saveModal(); }
    });
    $("#modal-name").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); saveModal(); }
    });

    // Context menu items
    $("#menu-edit").addEventListener("click", function () {
      if (!activeMenu) return;
      var group = findGroup(activeMenu.groupId);
      var sc = group && group.shortcuts.find(function (s) { return s.id === activeMenu.shortcutId; });
      if (sc) openModal("edit", activeMenu.groupId, sc);
      hideMenu();
    });
    $("#menu-remove").addEventListener("click", async function () {
      if (!activeMenu) return;
      await Storage.removeShortcut(activeMenu.groupId, activeMenu.shortcutId);
      hideMenu();
      data = await Storage.getAll();
      render();
    });

    // Settings gear menu
    $("#settings-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      $("#settings-menu").classList.toggle("hidden");
    });
    $("#settings-import").addEventListener("click", function () {
      $("#settings-menu").classList.add("hidden");
      Bookmarks.showPicker();
    });

    // Recently Closed toolbar
    $("#rc-filter-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      toggleRcFilterMenu();
    });
    $$("#rc-filter-menu .rc-filter-option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        selectRcFilter(this.dataset.filter);
      });
    });
    $("#rc-dismiss").addEventListener("click", function () {
      rcDismissed = true;
      $("#recently-closed").classList.add("hidden");
    });
    $("#rc-date-apply").addEventListener("click", applyCustomDateRange);
    $("#rc-date-start").addEventListener("keydown", function (e) {
      if (e.key === "Enter") applyCustomDateRange();
    });
    $("#rc-date-end").addEventListener("keydown", function (e) {
      if (e.key === "Enter") applyCustomDateRange();
    });
    var rcList = $("#recently-closed-list");
    if (rcList) {
      rcList.addEventListener("scroll", updateRcScroll);
    }

    // Wallpaper / Background
    $("#wallpaper-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      openBgModal();
    });
    $("#bg-overlay").addEventListener("click", function (e) {
      if (e.target === e.currentTarget) closeBgModal();
    });
    $("#bg-cancel").addEventListener("click", closeBgModal);
    $("#bg-upload-btn").addEventListener("click", function () {
      $("#bg-file-input").click();
    });
    $("#bg-file-input").addEventListener("change", function () {
      if (this.files && this.files[0]) handleBgUpload(this.files[0]);
      this.value = "";
    });
    $("#bg-url-apply").addEventListener("click", function () {
      handleBgUrl($("#bg-url-input").value);
    });
    $("#bg-url-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); handleBgUrl(this.value); }
    });
    $("#bg-remove").addEventListener("click", handleBgRemove);

    // Close menus on outside click
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#shortcut-menu") && !e.target.closest(".shortcut-more")) {
        hideMenu();
      }
      if (!e.target.closest("#settings-menu") && !e.target.closest("#settings-btn")) {
        $("#settings-menu").classList.add("hidden");
      }
      if (!e.target.closest("#rc-filter-btn") && !e.target.closest("#rc-filter-menu")) {
        closeRcFilterMenu();
      }
    });

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeModal(); hideMenu(); closeBgModal(); closeRcFilterMenu(); $("#settings-menu").classList.add("hidden"); }
    });

    // Close menu on scroll
    window.addEventListener("scroll", hideMenu);
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
    modalState = { mode: mode, groupId: groupId, shortcut: shortcut || null };
    $("#modal-title").textContent = mode === "edit" ? "Edit shortcut" : "Add shortcut";
    $("#modal-name").value = shortcut ? (shortcut.title || "") : "";
    $("#modal-url").value = shortcut ? (shortcut.url || "") : "";
    $("#modal-name").dataset.edited = mode === "edit" ? "true" : "false";
    $("#modal-overlay").classList.remove("hidden");
    (mode === "edit" ? $("#modal-name") : $("#modal-url")).focus();
  }

  function closeModal() {
    $("#modal-overlay").classList.add("hidden");
    modalState = {};
  }

  async function saveModal() {
    var name = $("#modal-name").value.trim();
    var url = normalizeUrl($("#modal-url").value.trim());
    if (!url || url === "https://") return;

    if (modalState.mode === "add") {
      await Storage.addShortcut(modalState.groupId, {
        url: url,
        title: name || getDomain(url).replace(/^www\./, "")
      });
    } else if (modalState.mode === "edit" && modalState.shortcut) {
      var group = findGroup(modalState.groupId);
      var sc = group && group.shortcuts.find(function (s) { return s.id === modalState.shortcut.id; });
      if (sc) {
        sc.url = url;
        sc.title = name || getDomain(url).replace(/^www\./, "");
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
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = current; input.blur(); }
    });
  }

  async function deleteGroup(groupId) {
    var group = findGroup(groupId);
    if (!group) return;
    var msg = group.shortcuts.length
      ? 'Delete "' + group.name + '" and its ' + group.shortcuts.length + " shortcut(s)?"
      : 'Delete empty group "' + group.name + '"?';
    if (!confirm(msg)) return;
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

    groupSortable = new Sortable($("#groups"), {
      animation: 150,
      handle: ".group-header",
      draggable: ".group",
      ghostClass: "group-ghost",
      onEnd: async function () {
        data.groupOrder = $$("#groups > .group").map(function (el) { return el.dataset.groupId; });
        await Storage.saveAll(data);
        console.log("[LaunchPad] Groups reordered:", data.groupOrder);
      }
    });

    $$(".shortcuts-grid").forEach(function (grid) {
      var s = new Sortable(grid, {
        group: "shortcuts",
        animation: 150,
        draggable: ".shortcut",
        ghostClass: "shortcut-ghost",
        filter: ".shortcut-more",
        preventOnFilter: false,
        onEnd: async function () {
          await syncShortcutsFromDOM();
          console.log("[LaunchPad] Shortcuts reordered via drag");
        }
      });
      sortables.push(s);
    });
  }

  function destroySortables() {
    if (groupSortable) { groupSortable.destroy(); groupSortable = null; }
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
