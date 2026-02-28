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

    if (folders.length === 0) {
      alert("No bookmark folders with bookmarks found.");
      return;
    }

    var overlay = $("#bookmark-overlay");
    var list = $("#bookmark-folder-list");

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
          addedAt: Date.now()
        };
      });

      data.groups.push({ id: groupId, name: folder.title, shortcuts: shortcuts });
      data.groupOrder.push(groupId);
    }

    await Storage.saveAll(data);
    hidePicker();
    console.log("[LaunchPad] Imported", checked.length, "bookmark folder(s)");
    return data;
  }

  // ===== Check if first run =====

  function isFirstRun(data) {
    var totalShortcuts = 0;
    for (var i = 0; i < data.groups.length; i++) {
      totalShortcuts += data.groups[i].shortcuts.length;
    }
    return data.groups.length <= 1 && totalShortcuts === 0;
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

  function esc(str) {
    var el = document.createElement("span");
    el.textContent = str || "";
    return el.innerHTML;
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
