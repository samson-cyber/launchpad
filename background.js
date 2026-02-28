chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-launchpad",
    title: "Add to LaunchPad",
    contexts: ["page", "link"]
  });
  console.log("[LaunchPad] Context menu created");
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "add-to-launchpad") return;

  try {
    const url = info.linkUrl || info.pageUrl || (tab && tab.url) || "";
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      console.warn("[LaunchPad] Skipping unsupported URL:", url);
      return;
    }

    // For links use the URL hostname as title; for pages use tab title
    const title = info.linkUrl
      ? (info.linkUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || info.linkUrl)
      : ((tab && tab.title) || url);
    const favicon = (tab && tab.favIconUrl) || "";

    const shortcut = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url,
      title,
      favicon,
      addedAt: Date.now()
    };

    const result = await chrome.storage.local.get("data");
    const data = result.data || getDefaultData();

    let ungrouped = data.groups.find((g) => g.id === "ungrouped");
    if (!ungrouped) {
      ungrouped = { id: "ungrouped", name: "Ungrouped", shortcuts: [] };
      data.groups.push(ungrouped);
      data.groupOrder.push("ungrouped");
    }

    ungrouped.shortcuts.push(shortcut);
    await chrome.storage.local.set({ data });
    console.log("[LaunchPad] Shortcut added:", shortcut.title, shortcut.url);
  } catch (err) {
    console.error("[LaunchPad] Failed to add shortcut:", err);
  }
});

function getDefaultData() {
  return {
    groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [] }],
    groupOrder: ["ungrouped"],
    settings: { theme: "system", columns: 6 }
  };
}
