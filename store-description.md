# Chrome Web Store Listing

**Updated 2026-11-09 for the NEXT submission - not live until it is uploaded.** (Was: live as of the 2.1.0 submission, 2026-09-01.) This file is the canonical record of
what is on the listing. If it disagrees with the dashboard, the dashboard is right and
this file is stale: fix the file. Title and Short Description below are byte-identical
to `_locales/en/messages.json`, which is what Chrome resolves `__MSG_extension_name__`
and `__MSG_extension_description__` against at install time.

## Title
LaunchPad - New Tab Dashboard, Shortcuts, Tasks & Focus Time

## Short Description (132 characters max)
Unlimited shortcuts on your new tab, free. Add tasks, focus sessions and measured time. No account; your work stays on your device.

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
- See where your time went today: time on each site, on the Dashboard
- Open tabs: every window and tab in one panel, park a window, reopen recently closed tabs

PRO

- Tasks and goals that live on your new tab, with tags, priorities and due dates
- A clock attached to whichever task is active, so you can see what a piece of work actually cost
- Focus sessions with a break cycle, and site blocking that shows a quiet reminder page instead of taking your attention
- Deep Work Time, time by tag, and your top tasks, plus the full history of time by site, measured automatically while you work
- A month calendar of due and repeating tasks: drag to reschedule, double-click to add a task or a reminder with a chime and a spoken prompt
- Insights over today, the past 7 days, the last 30, or any range inside your history
- Lifetime focused time per task, once there is more of it than the 30-day window can show
- Sticky notes beside your tasks, with drag to reorder, search, a trash you can restore from, and promote-a-note-into-a-task
- Weekly automatic backup to your Downloads folder
- Multiple workspaces, each with its own shortcuts, tasks and tracked time

YOUR WORK STAYS ON YOUR DEVICE

There is no LaunchPad server and no LaunchPad account. Your shortcuts, tasks, goals, notes, sessions and tracked time live in Chrome's storage on your machine and are never sent to us. No analytics, no scores and no reports sent anywhere.

A few things do leave, and we say exactly which. Site icons and gallery wallpapers load the way any web page loads an image. AI Search, the search bar's default tab, opens Google with what you typed; the Search tab uses your own default engine. On Pro, your licence key is checked with our payment provider at most every six hours. And if you use Chrome sync, your LaunchPad settings and licence key follow you to your other computers through your own Google account. Your shortcuts, tasks and tracked time never do.

PRICING

The launcher is free forever. Pro is $4.99 a month or $39 a year, with a 7-day trial that needs no card and no sign-up.

WHAT IS NEW

A fresh new look. Time on sites is now free for today. AI Search in the search bar, with one click back to your own engine. Your settings follow you between computers with Chrome sync. On Pro: a month calendar with reminders, workspace modes with scheduled blocking, the toolbar popup and side panel, and Insights that read top to bottom.

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

- **`sidePanel`** (required, **NEW IN 2.2.0** - the Privacy tab needs a justification for
  it before the upload is accepted). Paste-ready text:

  > Shows LaunchPad's companion view in Chrome's side panel: the user's current task, the focus timer and today's time, beside the page they are working on. The user opens it from Chrome's side panel menu. The extension makes no calls to the sidePanel API; the permission is required only because the manifest declares a side panel page. The panel reads LaunchPad's own data stored on the device and sends nothing anywhere.

  Read from the build: `manifest.json` declares `side_panel.default_path = side-panel.html`
  and there is no `chrome.sidePanel` call anywhere in the code. The panel is the same
  companion module as the toolbar popup (`companion.js`), mounted in a second page.
  **Install warnings are unchanged by it**: the browser's own
  `getPermissionWarningsByManifest` returns the same four warnings for the store 2.1.0
  manifest and the 2.2.0 artifact's manifest (checked 2026-11-09; a control that adds
  `management` gained a fifth line, so the check can fail). Existing users are not asked to
  re-approve.

Full declared set at 2.2.0, for reference: `storage`, `bookmarks`, `contextMenus`,
`history`, `topSites`, `tabs`, `webNavigation`, `alarms`, `search`, `idle`,
`offscreen`, `sidePanel`; optional `notifications`, `downloads`; hosts
`https://live.dodopayments.com/*` and `https://mylaunchpad.me/*`. At 2.1.0 it was the same
without `sidePanel`.

## Tags

*Preserved from the pre-2.1.0 version of this file, unreviewed in this pass.*

**Tags:** new tab, shortcuts, bookmarks, speed dial, unlimited, groups, organize, productivity, dark mode, free, private, drag and drop, new tab page, bookmark manager, quick access
