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
  var PLUS_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var CLOSE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var MORE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';

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

    applyTheme();

    if (Bookmarks.isFirstRun(data)) {
      Bookmarks.showWelcome();
    }

    render();
    bindEvents();
    Bookmarks.bindEvents(function (newData) {
      data = newData;
      Bookmarks.hideWelcome();
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

  // ===== Theme =====

  function isDark() {
    var t = (data.settings && data.settings.theme) || "system";
    return t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function applyTheme() {
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
    container.innerHTML = data.groupOrder
      .map(function (id) { return groupMap[id]; })
      .filter(Boolean)
      .map(function (g) { return groupHTML(g); })
      .join("");
    initSortables();
  }

  function groupHTML(group) {
    var deleteBtn = group.id === "ungrouped"
      ? ""
      : '<button class="group-delete-btn" data-group-id="' + group.id + '" title="Delete group">' + CLOSE_SVG + "</button>";
    return (
      '<section class="group" data-group-id="' + group.id + '">' +
        '<div class="group-header">' +
          '<h2 class="group-name" data-group-id="' + group.id + '">' + esc(group.name) + "</h2>" +
          '<div class="group-header-actions">' +
            '<button class="group-add-btn" data-group-id="' + group.id + '" title="Add shortcut">' + PLUS_SVG + "</button>" +
            deleteBtn +
          "</div>" +
        "</div>" +
        '<div class="shortcuts-grid" data-group-id="' + group.id + '">' +
          group.shortcuts.map(function (s) { return shortcutHTML(s); }).join("") +
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

  // ===== Events =====

  function bindEvents() {
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#add-group-btn").addEventListener("click", addGroup);

    // Delegated clicks on groups container
    $("#groups").addEventListener("click", function (e) {
      var el;

      el = e.target.closest(".group-add-btn");
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

    // URL auto-populates name
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

    // Close menus on outside click
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#shortcut-menu") && !e.target.closest(".shortcut-more")) {
        hideMenu();
      }
      if (!e.target.closest("#settings-menu") && !e.target.closest("#settings-btn")) {
        $("#settings-menu").classList.add("hidden");
      }
    });

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeModal(); hideMenu(); $("#settings-menu").classList.add("hidden"); }
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
