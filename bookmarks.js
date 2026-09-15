/* global chrome, Storage */

var Bookmarks = (function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var idCounter = 0;

  // ===== Read bookmark tree =====

  async function getTree() {
    try {
      var tree = await chrome.bookmarks.getTree();
      var folders = [];
      walk(tree[0].children || [], folders);
      console.log("[LaunchPad] Bookmark folders found:", folders.length);
      return folders;
    } catch (err) {
      console.error("[LaunchPad] Failed to read bookmarks:", err);
      return [];
    }
  }

  function walk(nodes, folders) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node.children) continue;

      var bookmarks = [];
      for (var j = 0; j < node.children.length; j++) {
        var child = node.children[j];
        if (child.url) {
          bookmarks.push({ title: child.title || "", url: child.url });
        }
      }

      if (bookmarks.length > 0) {
        folders.push({ id: node.id, title: node.title || "Bookmarks", bookmarks: bookmarks });
      }

      walk(node.children, folders);
    }
  }

  // ===== Show picker modal =====

  async function showPicker() {
    var folders = await getTree();

    var overlay = $("#bookmark-overlay");
    var list = $("#bookmark-folder-list");

    // [1.12] WAS A NATIVE alert(), AND IT SHOULD NEVER HAVE BEEN A DIALOG.
    // "No bookmark folders with bookmarks found" is an EMPTY STATE, not a
    // decision - there is nothing to confirm or cancel. It is rendered in the
    // picker the user just opened, in the same shape the bookmarks PANEL
    // already uses for its own empty state (.bm-empty / -title / -hint in
    // newtab.js), rather than handed across the IIFE boundary to newtab.js's
    // modal: that boundary is a fact about the product's seams (BUGS I27), and
    // a new cross-file dialog API for one message is not worth inventing.
    //
    // The two action buttons are hidden because neither can do anything with
    // nothing; Cancel stays, because closing is the only move left and a
    // surface with no way out is worse than the alert was.
    if (folders.length === 0) {
      list.innerHTML =
        '<div class="bm-empty">' +
          '<p class="bm-empty-title"></p>' +
          '<p class="bm-empty-hint"></p>' +
        '</div>';
      list.querySelector(".bm-empty-title").textContent =
        I18n.t("bookmarks_no_folders_found");
      list.querySelector(".bm-empty-hint").textContent =
        I18n.t("bookmarks_empty_hint");
      var selectAll = $("#bookmark-select-all");
      var importBtn = $("#bookmark-import-btn");
      if (selectAll) selectAll.hidden = true;
      if (importBtn) importBtn.hidden = true;
      overlay.classList.remove("hidden");
      return;
    }
    var selectAllBtn = $("#bookmark-select-all");
    var importBtnEl = $("#bookmark-import-btn");
    if (selectAllBtn) selectAllBtn.hidden = false;
    if (importBtnEl) importBtnEl.hidden = false;

    list.innerHTML = folders.map(function (f) {
      return (
        '<label class="bookmark-folder-item">' +
          '<input type="checkbox" value="' + f.id + '"> ' +
          '<span class="bookmark-folder-name">' + esc(f.title) + '</span>' +
          '<span class="bookmark-folder-count">' + f.bookmarks.length + '</span>' +
        '</label>'
      );
    }).join("");

    overlay.classList.remove("hidden");
    overlay._folders = folders;
    console.log("[LaunchPad] Bookmark picker opened");
  }

  function hidePicker() {
    $("#bookmark-overlay").classList.add("hidden");
  }

  // ===== Import selected folders =====

  function makeId() {
    idCounter++;
    return Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  async function importSelected() {
    var overlay = $("#bookmark-overlay");
    var folders = overlay._folders || [];
    var checked = [].slice.call(overlay.querySelectorAll('input[type="checkbox"]:checked'));

    if (checked.length === 0) return;

    var selectedIds = {};
    checked.forEach(function (cb) { selectedIds[cb.value] = true; });

    var data = await Storage.getAll();
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) {
      hidePicker();
      return data;
    }

    for (var i = 0; i < folders.length; i++) {
      var folder = folders[i];
      if (!selectedIds[folder.id]) continue;

      var groupId = makeId();
      var shortcuts = folder.bookmarks.map(function (bm) {
        return {
          id: makeId(),
          url: bm.url,
          title: bm.title || getDomain(bm.url),
          favicon: "",
          addedAt: Date.now(),
          deletedAt: null
        };
      });

      ws.groups.push({ id: groupId, name: folder.title, shortcuts: shortcuts, deletedAt: null });
      ws.groupOrder.push(groupId);
    }

    await Storage.saveAll(data);
    hidePicker();
    console.log("[LaunchPad] Imported", checked.length, "bookmark folder(s)");
    return data;
  }

  // ===== Check if first run =====

  function isFirstRun(data) {
    var ws = Storage.getActiveWorkspace(data);
    if (!ws) return true;
    var groups = ws.groups || [];
    var totalShortcuts = 0;
    for (var i = 0; i < groups.length; i++) {
      totalShortcuts += (groups[i].shortcuts || []).length;
    }
    return groups.length <= 1 && totalShortcuts === 0;
  }

  // ===== Bind events =====

  function bindEvents(onImportDone) {
    $("#bookmark-cancel").addEventListener("click", hidePicker);
    $("#bookmark-overlay").addEventListener("click", function (e) {
      if (e.target === e.currentTarget) hidePicker();
    });
    $("#bookmark-import-btn").addEventListener("click", async function () {
      var newData = await importSelected();
      if (newData && onImportDone) onImportDone(newData);
    });

    $("#bookmark-select-all").addEventListener("click", function () {
      var boxes = [].slice.call($("#bookmark-folder-list").querySelectorAll('input[type="checkbox"]'));
      var allChecked = boxes.every(function (cb) { return cb.checked; });
      boxes.forEach(function (cb) { cb.checked = !allChecked; });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hidePicker();
    });
  }

  // ===== Utilities =====

  // [1.5.1] Escapes quotes, matching newtab.js escapeHtml character for
  // character. The previous body (span + textContent + innerHTML) escaped
  // & < > but NOT quotes, for the reason explained on esc() in newtab.js.
  // This file is a separate IIFE with no access to that one, so it carries
  // the body rather than a dependency: a six-line pure function is cheaper to
  // duplicate than a load-order coupling between two page scripts.
  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return url; }
  }

  return {
    showPicker: showPicker,
    hidePicker: hidePicker,
    isFirstRun: isFirstRun,
    bindEvents: bindEvents
  };
})();
