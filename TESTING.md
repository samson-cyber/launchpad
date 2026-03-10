# LaunchPad — Testing Guide

## Loading the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `launchpad` project folder
5. Open a new tab — you should see the LaunchPad page

> After making code changes, click the **reload** button (circular arrow) on the extension card at `chrome://extensions`, then open a new tab to see changes.

## Test Checklist

### First-Run Experience
- [ ] On first load (no data), the welcome screen appears with two buttons
- [ ] "Import from Chrome Bookmarks" opens the bookmark picker modal
- [ ] "Start from scratch" creates a "My Shortcuts" group and shows the main UI
- [ ] The welcome screen hides after either action
- [ ] The "Add group" button reappears after the welcome screen is dismissed

### Search Bar
- [ ] Search bar is centered and has correct styling
- [ ] Typing text and pressing Enter navigates to `google.com/search?q=...`
- [ ] Search bar gets a shadow on hover/focus
- [ ] Placeholder text reads "Search Google or type a URL"

### Adding Shortcuts
- [ ] Click the **+** button in a group header to open the Add Shortcut modal
- [ ] Pasting a URL auto-populates the Name field with the domain
- [ ] Editing the Name field stops auto-population (manual override)
- [ ] Clicking **Done** adds the shortcut with correct favicon and name
- [ ] Pressing **Enter** in either field submits the modal
- [ ] Clicking **Cancel** or the overlay backdrop closes the modal without saving
- [ ] Pressing **Escape** closes the modal

### Editing Shortcuts
- [ ] Hovering over a shortcut shows the three-dot (⋮) menu button
- [ ] Clicking the three-dot button opens a dropdown with "Edit shortcut" and "Remove"
- [ ] "Edit shortcut" opens the modal pre-filled with the shortcut's name and URL
- [ ] Saving the edit updates the shortcut in place
- [ ] "Remove" deletes the shortcut immediately

### Favicon Fallback
- [ ] Shortcuts with valid domains show Google favicon API icons
- [ ] Shortcuts with invalid/nonexistent domains fall back to the gray globe (`assets/placeholder.svg`)
- [ ] Test with a fake URL like `https://thissitedoesnotexist12345.com`

### Groups
- [ ] **Add group**: Click "+ Add group" at the bottom, enter a name, confirm
- [ ] **Rename group**: Click on a group name, edit inline, press Enter to save or Escape to cancel
- [ ] **Delete group**: Click the X button on a group header → confirm dialog → group removed
- [ ] The "Ungrouped" group cannot be deleted (no X button shown)
- [ ] Empty groups display correctly (just the header)

### Drag and Drop
- [ ] **Reorder shortcuts**: Drag a shortcut tile within a group to reorder
- [ ] **Move between groups**: Drag a shortcut from one group into another
- [ ] **Reorder groups**: Drag a group header to reorder entire groups
- [ ] After each drag operation, reload the new tab page — the order should persist

### Dark Mode
- [ ] The moon/sun toggle button is in the bottom-right corner
- [ ] Clicking it toggles between light and dark mode
- [ ] Dark mode uses `#202124` background and light text
- [ ] The theme persists after opening a new tab
- [ ] Setting "system" follows OS dark mode preference

### Context Menu (Right-Click)
- [ ] Right-click on any webpage → "Add to LaunchPad" option appears
- [ ] Clicking it adds the page as a shortcut to the "Ungrouped" group
- [ ] Right-click on a link → "Add to LaunchPad" adds the link URL
- [ ] Open a new tab to verify the shortcut was added

### Bookmark Import
- [ ] Click the gear icon (bottom-left) → "Import Bookmarks"
- [ ] The bookmark picker modal shows Chrome bookmark folders with checkboxes
- [ ] Each folder shows the bookmark count
- [ ] "Select all / none" toggles all checkboxes
- [ ] Clicking **Import** creates one group per selected folder
- [ ] Each group contains the folder's bookmarks as shortcuts
- [ ] Clicking **Cancel** or the overlay backdrop closes without importing

### Settings Gear
- [ ] Gear icon is in the bottom-left corner
- [ ] Clicking it opens a small popup menu
- [ ] Clicking outside closes the menu
- [ ] Pressing Escape closes the menu

### Storage Sync (Background ↔ New Tab)
- [ ] Add a shortcut via right-click context menu on a page
- [ ] The new tab page should auto-update (no manual refresh needed)

## Debugging

Open the browser console to see `[LaunchPad]` log messages:
- **New tab page**: Right-click on the page → Inspect → Console
- **Service worker**: Go to `chrome://extensions` → click "service worker" link on the LaunchPad card

### Common Issues

| Issue | Fix |
|---|---|
| Extension not loading | Check `chrome://extensions` for errors. Click the "Errors" button on the extension card. |
| "Add to LaunchPad" missing from right-click | Reload the extension. The context menu is created on install. |
| New tab shows blank page | Check console for JS errors. Ensure all files are in the project folder. |
| Shortcuts not saving | Check console for `[LaunchPad] Storage write failed` errors. |
| SortableJS not loading | Check network tab — CDN may be blocked. Drag-and-drop will be disabled gracefully. |
| Favicons not loading | Google's favicon API requires internet. Offline mode falls back to placeholder. |
| Dark mode resets | Ensure `chrome.storage.local` is working (check console for errors). |
| Bookmark import shows no folders | You need at least one bookmark folder with bookmarks in Chrome. |

## Removing Debug Logs

All debug messages use `console.log("[LaunchPad] ...")`. To remove them before publishing:

```bash
grep -rn "console\." *.js
```

Remove or comment out the log lines, then reload the extension.
