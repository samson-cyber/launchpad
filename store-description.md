# Chrome Web Store Listing

**Live as of the 2.1.0 submission, 2026-09-01.** This file is the canonical record of
what is on the listing. If it disagrees with the dashboard, the dashboard is right and
this file is stale: fix the file. Title and Short Description below are byte-identical
to `_locales/en/messages.json`, which is what Chrome resolves `__MSG_extension_name__`
and `__MSG_extension_description__` against at install time.

## Title
LaunchPad - New Tab Dashboard, Shortcuts, Tasks & Focus Time

## Short Description (132 characters max)
Unlimited shortcuts on your new tab, free. Add tasks, focus sessions and measured time. No account, nothing leaves your browser.

## Category
Productivity

## Full Description

LaunchPad replaces Chrome's new tab with a page that actually holds your working day.

The free tier is a complete launcher. Unlimited shortcuts organised into groups you name, drag and drop, open a whole group in one click, wallpapers, browsing history, session restore, and named sessions you save and relaunch whenever you need them. No caps, no account, no sign-up.

Pro adds the part nobody else does: it measures where your time actually went.

FREE, FOREVER

- Unlimited shortcuts, organised into groups you name
- Open a whole group in one click
- Named sessions: save the tabs you are working in and relaunch the set into a fresh window
- Automatic session restore, so closing a window is never a loss
- Wallpapers, solid colours, or your own image
- Browsing history, grouped by site and searchable
- Import from Chrome bookmarks or top sites
- Right-click any page to add it
- Backup and restore: export everything you have as a file you own

PRO

- Tasks and goals that live on your new tab, with tags, priorities and due dates
- A clock attached to whichever task is active, so you can see what a piece of work actually cost
- Focus sessions with a break cycle, and site blocking that shows a quiet reminder page instead of taking your attention
- Deep Work Time, time by site, time by tag, and your top tasks, measured automatically while you work
- Insights over today, the past 7 days, the last 30, or any range inside your history
- Lifetime focused time per task, once there is more of it than the 30-day window can show
- Sticky notes beside your tasks, with drag to reorder, search, a trash you can restore from, and promote-a-note-into-a-task
- Weekly automatic backup to your Downloads folder
- Multiple workspaces, each with its own shortcuts, tasks and tracked time

NOTHING LEAVES YOUR BROWSER

There is no LaunchPad server. Your shortcuts, tasks, goals, notes, sessions and tracked time live in Chrome's local storage on your machine. No account to create, no analytics, no tracking, no scores and no reports sent anywhere. LaunchPad loads site icons and wallpaper images the way any web page loads an image, and on Pro it checks your licence key about once a day. Nothing else leaves your browser.

PRICING

The launcher is free forever. Pro is $4.99 a month or $39 a year, with a 7-day trial that needs no card and no sign-up.

WHAT IS NEW IN 2.1.0

Sticky notes beside your tasks. Named sessions you save and relaunch. Insights date ranges including custom ranges. Lifetime focused time per task. Full backup and restore, with optional weekly automatic backups on Pro. Plus descriptions on new tasks and goals, a New Tag button, a task options menu, and a long list of fixes.

## Permission justifications (Privacy tab)

> **GAP - NOT RECORDED.** The three justification texts live on the Chrome Web Store
> Privacy tab, and this session cannot see the dashboard. The texts below are **not**
> the listing copy and must not be pasted as such. They record what the code actually
> does with each permission, so that whoever fills this in can check the live
> justification against the truth rather than against memory. **Samson: paste the
> three real justification strings over this block.**

What the build actually uses each for, read from `manifest.json` at `2.1.0`:

- **`history`** (required) - the history panel in the sidebar, which groups the user's
  own browsing history by site and makes it searchable. **Read-only, and provably so:
  the codebase contains exactly one call, `chrome.history.search()`, and no
  `deleteUrl` / `deleteRange` / `deleteAll` anywhere.** Results are filtered to drop
  `chrome://` URLs, rendered in the panel, and never transmitted.
- **`webNavigation`** (required) - focus blocking, and ONLY focus blocking. Three
  listeners (`onBeforeNavigate`, `onHistoryStateUpdated`, `onReferenceFragmentUpdated`)
  all route to a single handler that redirects a TOP-LEVEL frame to the local
  reminder page (`gate.html`) when its host is on the block list during a focus
  session. Subframes are deliberately excluded. It does NOT feed time tracking:
  attribution rides `chrome.tabs.onActivated`/`onUpdated`,
  `chrome.windows.onFocusChanged` and `chrome.idle.onStateChanged`.
  **No `webRequest`.** The extension does not declare or use the blocking
  webRequest API at all; it navigates the tab to its own page rather than
  intercepting requests. That is worth stating in the justification, because it
  is the difference between observing a navigation and inspecting traffic.
- **`downloads`** (**optional**, requested at the moment of use) - the WEEKLY AUTOMATIC
  Pro backup, and nothing else. It writes one file into `LaunchPad Backups/` with
  `saveAs: false` and `conflictAction: "uniquify"`, so it never prompts and never
  overwrites. **Manual export does NOT use it** and works with the permission
  denied: the page builds a blob and clicks an `<a download>`. The permission
  exists only because the weekly backup runs in the service worker, which has no
  anchor to click. Not held unless the user turns automatic backups on, and if the
  user revokes it the scheduling alarm is cleared rather than left to fail. Worth
  stating as optional in the justification, because a reviewer reading the manifest
  will see it in `optional_permissions`.

Full declared set at 2.1.0, for reference: `storage`, `bookmarks`, `contextMenus`,
`history`, `topSites`, `tabs`, `webNavigation`, `alarms`, `search`, `idle`,
`offscreen`; optional `notifications`, `downloads`; hosts
`https://live.dodopayments.com/*` and `https://mylaunchpad.me/*`.

## Tags

*Preserved from the pre-2.1.0 version of this file, unreviewed in this pass.*

**Tags:** new tab, shortcuts, bookmarks, speed dial, unlimited, groups, organize, productivity, dark mode, free, private, drag and drop, new tab page, bookmark manager, quick access
