# Release notes - NEXT

**The next Chrome Web Store submission, unnumbered until it is cut.** Renamed to
`RELEASE-NOTES-<version>.md` at the moment the build is cut, which is also the only
moment the manifest is bumped. The numbered files beside this one each began here.

Same rule as those: **nothing here describes a feature that is not in the build.**

**Written 2026-11-09 against master after MC9** (calendar reminders). Each bullet was
verified against source by a read-only pass (section B gives the file and line). The
reminders bullets were verified live: MC9 passed 26/26 on the working tree and the
packaged build.


**Baseline: `v2.1.0` (`15797ad`).** "New" means a 2.1.0 user did not have it. Everything in
`docs/RELEASE-NOTES-2.2.0.md` is folded in, because 2.2.0 (tag `v2.2.0` -> `5c585ae`, cut from
`796c3fa`) was **built and never uploaded**, so none of it has reached a user. The two blocks
of `docs/RELEASE-NOTES-NEXT.md` are kept, with their warnings, and one factual correction (the
Settings path).

**Method.** Every bullet below was checked against the source on master `0d7971a` (file:line
in section B), not against a commit subject or a DECISIONS entry. Source reading only: **no
browser run was made for this draft** (see D.6). Four bullets from the 2.2.0 file were wrong
or are now wrong, and are corrected here rather than copied (section C, "Corrected").

---

## A. PASTE THIS - "What's new"

Trim from the bottom. **Blocks 1 to 4 must not be cut**: they are what an existing user gets
without asking (1, 2), and the two changes that send or measure anything by default (3, 4).
Block 5 is the one change that takes something away from paying users.

```
A new look, and bigger icons.

• LaunchPad has been redesigned: cleaner tiles, a new typeface,
  calmer slate-and-indigo colours, and smoother switching between
  tabs.
• Shortcut icons fill much more of their circle, so logos read at
  a glance. Nothing moved: the grid and spacing are unchanged.
• Settings is one page of tiles in two columns, with a search box.
  Pro settings now live there too.
• Times read the way you would say them: "3hr 45min".

The search bar now defaults to AI Search, with a one-click toggle
back to your own search engine.

• Two tabs sit above the search bar: AI Search and Search. AI
  Search starts selected.
• With AI Search selected, Enter opens Google's AI Mode with what
  you typed. Click Search and Enter goes to your default search
  engine, exactly as before. Your choice is remembered.
• The search bar is also a launcher: start typing and your
  shortcuts, groups and saved sessions appear. Arrow keys and
  Enter, no mouse needed.

See where your time went today - now free.

• The Dashboard shows today's time on each site, on every
  profile, free included. Nothing to set up.
• Pro keeps the history: ranges, comparisons, the heatmap, the
  weekly view and the export.

Your browsing time is measured on this device, and you can switch
it off.

• To show that card, LaunchPad now records time on sites for free
  profiles too, where it previously recorded nothing. It is ON by
  default, from the first tab you open after updating.
• It stays on your device. Nothing is uploaded or shared, and no
  new permission was added for it.
• To turn it off: Settings > Data > Track time on sites. Off stops
  recording and hides the card. Nothing already recorded is
  deleted.

Your settings follow you to your other computers.

• If you use Chrome sync, your LaunchPad preferences and your Pro
  licence key now travel between your computers through your
  Google account, so a second computer is set up for you.
• Your shortcuts, tasks, notes, sessions and tracked time do NOT
  travel. They stay on each device.
• Chrome's own sync setting controls this. With Chrome sync off,
  nothing is carried anywhere.

Pro: the active-task card on Home is gone.

• Home is now just your shortcuts. Your active task and running
  focus session show on the Dashboard instead.
• The play button on a task now starts a focus session in one
  click. Stop, pause and blocking are in Chrome's side panel.
• Deleting a task is in its right-click menu (or the Edit task
  box on the calendar), not on the row.

New for everyone.

• Open tabs: see every window and tab in the sidebar, filter them,
  save a selection as a named session, or Park a whole window
  (save it, then close it). The last 25 closed tabs can be reopened.
• A greeting at the top of Home, with the time of day and date.
  Click it for variants.
• Wallpaper rotation: a different gallery photo each day or hour.
  Off by default.
• Import from a pasted list of links, a Chrome/Edge bookmarks
  file, Toby, OneTab, Session Buddy or Speed Dial 2. Imports go
  into new groups, nothing is replaced, and one click undoes it.
• A Bookmarks panel in the sidebar shows your Chrome bookmarks.
  LaunchPad only reads them; it never changes them.
• Give any shortcut its own icon: upload one, pick an emoji, or
  use a letter. Plus a list view and a Focus view.
• "Open All" and the group menu are always visible on group
  headings, instead of hiding until you hover.
• Keyboard shortcuts: open LaunchPad, add the current page, save
  this window as a session. None is set by default - assign your
  own keys at chrome://extensions/shortcuts.

Pro: tasks and a calendar.

• A month calendar on the Tasks tab: drag a task to another day,
  click it to edit or delete it, or double-click a day to add one.
• Reminders on the calendar: double-click a day and choose Add
  reminder. Give it a title if you like, pick a time, and at that
  moment a chime and a short spoken reminder play. Turn the voice
  off for just the chime, or add a desktop notification.
• A reminder missed while your browser was closed goes off when
  you open it, if it is still the same day.
• Type tasks naturally: "Call Nadia tomorrow !high #acme" sets the
  due date, priority and tag. Add "every Monday" to make it repeat.
• A bell beside the tabs counts work due. Snooze it, jump to the
  task, or complete it, with an Undo.
• Completing a task anywhere now has an Undo.
• An optional sound, and a short spoken reminder, when tasks reach
  their due date, once a day. Off for existing users: turn it on
  in Settings > Data > Sound when tasks are due.
• Attach shortcuts, groups or saved sessions to a task or goal.
• Track a repeating task on a month grid, a habit view that fills
  a square each day you do it.

Pro: focus that fits how you work.

• Work and Casual modes per workspace, each with its own session
  lengths. Casual changes nothing; Work turns the rules on.
• Block sites on a schedule or after a daily time budget (Work
  mode), not only during a focus session.
• Optional friction before you can snooze a blocked site: a short
  wait, and a sentence to type on a repeat.
• Optional morning desktop reminder for work due today.
• The focus chimes are new, cleaner recorded sounds.

Pro: LaunchPad in your toolbar and side panel.

• Click the LaunchPad toolbar icon for your active task and a
  pause button.
• Open LaunchPad in Chrome's side panel for due work, start and
  stop a focus session, blocking, and the day's switches.
• The toolbar icon shows the minutes left in a focus session.

Pro: Dashboard and Insights.

• Set a daily focus target and watch a ring fill toward it.
• Pick three things for today, and see this week against last.
• Insights reads top to bottom: deep work, time by tag and by site,
  top tasks, best focus hours. Today is drawn hour by hour.
• Numbers count up and bars grow in when you open a tab.
• Export any date range to CSV, by task, tag and site.

Pro: notes and wallpaper.

• Notebooks: group your notes into notebooks of their own.
• Select text on any page, right-click, and save it to a note.
• Give any workspace its own wallpaper.

Fixes.

• "Nest with..." no longer disappears from every other
  right-click menu.
• Creating a tag from the right-click menu opens next to the menu,
  not in the corner of the screen.
```

**Bullet count: 51** bullets plus the calendar-reminders placeholder line, in 14 blocks.

---

## B. Evidence table

Line numbers are master `0d7971a`. "2.2.0" in the Source column means the item is in
`RELEASE-NOTES-2.2.0.md` and was re-verified here.

| # | Bullet | Verified in current source | Source |
| --- | --- | --- | --- |
| 1 | Redesign: tiles, typeface, colours, smooth switching | `tokens.css:496` `--font-sans: Figtree, ...`; `tokens.css:417,423` `--ink #eceef4`, `--action #8b93ff`; `newtab.js:964` `document.startViewTransition`; `fonts/figtree-latin*.woff2` | H0-H4 (`aa79686`..`d0ed641`), DP1 `320a32d`, DP3 `ee0a0a2`, MC2 `93788ee`; DECISIONS 2026-11-08 DP1, DP3, MC |
| 2 | Bigger icons, grid unchanged | `tokens.css:57` `--icon-inner: 34px`; `newtab.css:7321` 26px (Small), `:7346` 40px (Large) | 2.2.0, `[1.10.7]` |
| 3 | Settings as tiles, two columns, search, Pro settings merged | `newtab.html:530-821` eight `data-set-tile` sections; `newtab.html:503` `#settings-search`; `sb-pro-settings` present in v2.1.0 sidebar, absent on master | H1c `7a22637`, `4cb7420`, H3d `51211d1` |
| 4 | "3hr 45min" | `storage.js:5939-5940` `[MC1]` hr form | MC1 `329cd66`; DECISIONS MC |
| 5 | AI Search default + toggle | `newtab.html:223-228` (AI Search `is-active`); `storage.js:654-656` `getSearchMode` (anything but `"search"` is AI); `newtab.js:19043` `google.com/search?udm=50&q=`; `newtab.js:19052` `chrome.search.query` | 2.2.0, `[1.12.3]`; DECISIONS 2026-09-15 AI tab -> Google AI Mode |
| 6 | Launcher | `newtab.js:18722` `launcherSearch`, kinds group/shortcut/session at `:18738,:18754,:18766` | 2.2.0 |
| 7 | Free time by site today | `newtab.js:1058` free Dashboard -> `renderFreeDashboard` (`:6129`); `pt_focused_today_by_site` at `newtab.js:2935` | PT.1-3 `b7aff64`, `7897845`, `793cf7c`; RELEASE-NOTES-NEXT |
| 8 | Pro keeps history | `tracking.js:250-258` (Samson's 2026-09-12 ruling quoted in code) | PT.2 |
| 9-11 | Passive tracking on by default, local, toggle path | `tracking.js:96-115,267` (per-workspace switch is the only gate; no Pro gate); `storage.js:251-252` absent -> `enabled = true`; `newtab.html:821-827` Data tile > "Track time on sites"; `newtab.js:6134-6140` card absent when off | PT.2; RELEASE-NOTES-NEXT (path corrected, see C) |
| 12-14 | Settings + licence sync | `storage.js:10311-10328` `SYNC_SETTING_FIELDS`; `:10519-10520` licence key + rotation mode; `:10354-10360` exclusions; `background.js:1379` `runSyncMerge("installed")`; `privacy-policy.html` Chrome sync paragraph | PF.2 `250cb05`, follow-up `11989c4`, `8611444`; DECISIONS 2026-09-16 x2 |
| 15 | Active-task pill removed; session on Dashboard | `newtab.html` 0 matches for `sat-card`/pill (v2.1.0: 26 `sat*` refs in newtab.js); `newtab.js:1851` `dashHeroFocusHtml` | `a9e2947`, `66ce4ae`, `ff53383`; DECISIONS 2026-09-19 "The active-task pill is REMOVED" |
| 16 | Play = start a session; Stop/pause/blocking in side panel | `newtab.js:8227` `taskPlayHtml`, `:22202` `satStartOnTask`; `companion.js:681-723` session controls, `side-panel.js:76-80` `showSessionControls: true` | `ff53383`, H3d `51211d1` |
| 17 | Per-row delete gone; delete via menu / Edit task | v2.1.0 `newtab.js` has `tt-task-trash` (2 hits), master 0; `newtab.js:4074` `openEditTaskModal` (only caller `:3973`, the calendar) | `2edf6bf`, MC7 `7874715` |
| 18 | Open tabs, Park, Recently closed (25) | `newtab.html:43,365-381`; `locales/en.js:4343-4377` Park; `storage.js:6985-7021` `RECENTLY_CLOSED_MAX = 25`; no Pro gate in `openOpenTabsPanel` (`newtab.js:17466`) | OT.1-3 `22081d9`, `90d99ff`, `ebe4e68` |
| 19 | Greeting | `newtab.js:19357-19395` (cycle + `GREETING_EXPLODE_AT`) | 2.2.0 |
| 20 | Wallpaper rotation, off by default | `newtab.js:25266` `GALLERY_URLS` (rotation pool, filtered `rotate !== false`); `locales/en.js:998` "Rotate wallpaper" | 2.2.0 `[1.11.3]`; W1 `453efff` |
| 21 | Import formats, new groups, undo | `importers.js` (Toby/OneTab/Session Buddy/Speed Dial readers); `newtab.html:79,393` | 2.2.0 |
| 22 | Bookmarks panel, read-only | `newtab.html:37` `#sb-bookmarks`; build gate `tools/check-bookmarks-readonly.mjs` in `build.sh:297` | 2.2.0 `[1.11.1]` |
| 23 | Custom icon, list view, Focus view | `locales/en.js:1700,1704` letter/emoji; `:1840` Grid, `:1852` Focus view | 2.2.0 |
| 24 | Group actions always visible | `newtab.css:1102` comment records the hover reveal removed | 2.2.0 `[1.10.10]` |
| 25 | Keyboard shortcuts, none bound | `manifest.json` `commands` (4 entries, **no `suggested_key`**); `background.js:1796-1811` | 2.2.0 |
| 26 | Calendar on Tasks: drag, edit, delete, double-click add | `storage.js:8951` `calendarMonth`; `newtab.js:3756`, `:9376` (on Tasks); `locales/en.js:6266` "Add task?", `:6234` "Edit task" | MC4-MC8 `93788ee`..`bab3497`; DECISIONS MC4, MC5, MC7, MC8 |
| 27 | Natural quick add, with repeat | `quickadd.js` header (`!high #acme`, recurrence); `newtab.js:12217` `quickAddParse` | TD.1 `e30b771`, `4cdd69c`, `7a15d75` |
| 28 | Due bell: snooze, go to task, complete with undo | `newtab.html:174-178` `#due-bell` (SVG bell); `newtab.js:492-493` Pro gate | DB.1 `d65f0dc`, DB.2 `f863859`, MC7 |
| 29 | Undo on every completion | `newtab.js:8948` `showCompletionUndoToast` | `270ebab` |
| 30 | Due sound + spoken reminder, off for updaters | `storage.js:10191-10206` `dueSoundToAnnounce` (Pro, switch, due today, once a day); `storage.js:10187` `dueSoundFile`; `background.js:1379-1389` default written only on `reason === "install"`; `newtab.html` Data tile rows; `sounds/due-reminder.wav`, `sounds/due-chime.wav` | MC7 `7874715`, `abf73f8`, MC8 `bab3497`; DECISIONS MC7, MC8 |
| 31 | Attach resources | `storage.js:7402` `attachResource`; `locales/en.js:3049` | TD.2 `6ca024f` |
| 32 | Habit month grid | `storage.js:8828` `habitGridMonth`; `locales/en.js:376-380` | TD.4 `9c6b525` |
| 33 | Work/Casual modes, per-mode lengths | `newtab.html:699` Mode row; `storage.js:1323-1386` `modePresets`; `locales/en.js:813` | WM.1 `4c5297e`, WM.5 `af0ddb7`; DECISIONS 2026-09-15 Workspace mode |
| 34 | Schedule / budget blocking (Work) | `locales/en.js:4551,4581,4586,4652,4663` | WM.2-3 `b962196`, `2d048bb`, Round F `2e49b4f` |
| 35 | Friction | `locales/en.js` ~4740-4748 ("Snoozing in {seconds}s", "Type this to continue") | WM.4 `193122d` |
| 36 | Morning due reminder | `locales/en.js:117,121` (9am, once, Work only, off by default) | WM.5 `af0ddb7` |
| 37 | New chimes | `sounds/chime1-3.wav` (dated 2026-11-08) | DP4 `6ab6dac`; DECISIONS DP4 |
| 38 | Toolbar popup: active task + pause (Pro) | `manifest.json` `action.default_popup`; `companion-popup.js:42` mounts with `{}`; `companion.js:475-490` free/expired get one locked line | 2.2.0 (corrected, see C) |
| 39 | Side panel (Pro) | `manifest.json` `side_panel`; `side-panel.js:76-80`; same `companion.js:475` Pro gate | PF.1 `0c2d8d4`, H4.0 `add29ae`, `b1c99c5` |
| 40 | Badge minutes | `background.js:753,873` `setBadgeText` | 2.2.0 `[1.9.x]` |
| 41 | Focus target ring | `newtab.js:1410-1433`, `:1851-1871`; `newtab.html:748` `#pro-focus-target` | 2.2.0 |
| 42 | Pick three; this week vs last | `newtab.js:1646-1699` `dash-three`; MC6 weekly columns | 2.2.0 |
| 43 | Insights story order; Today by hour | `locales/en.js:5395` "Deep work by hour"; DP2 `insightsTagShareHtml` | DP2 `9b72037`, `e2e5141`; IT `46db91a`; DECISIONS DP2, IT |
| 44 | Count up, bars grow | `tools/check-motion.mjs` gate; MC3/MC6 | MC3 `93788ee`, MC6 `0f99811` |
| 45 | CSV export by task, tag, site | `newtab.js:5575` `insightsExportCsv` (byTag, byTask, byDomain); absent in v2.1.0 | 2.2.0 |
| 46 | Notebooks | `locales/en.js:129-152` | NB.2-3 `14bd410`, `a27361b` |
| 47 | Clip selection to note (Pro) | `background.js:656-662` (created only when `ProAccess.hasProAccess`) | TD.3 `6282d1b` |
| 48 | Per-workspace wallpaper | `locales/en.js:1015-1019` "Just for this workspace" | 2.2.0 |
| 49 | Fix: Nest with... | `newtab.js:26984` `!!(...)`, `:26996`; bug present in v2.1.0 (`newtab.js:14477` + `:17565`, un-coerced toggle) | RC `3e2e44e` |
| 50 | Fix: tag popover position | RC `3e2e44e`; v2.1.0 `newtab.js:17277-17279` closes the submenu before measuring it | RC `3e2e44e` |

---

## C. Excluded items, and why

### Corrected (in the 2.2.0 or NEXT file, wrong or now wrong)

- **"Click the LaunchPad icon for a compact popup: your shortcuts..." (2.2.0).** The popup has
  **never shown shortcuts**, at `v2.2.0` or now (`companion.js` has no shortcut code at
  either). It shows the active task, two figures, Pause/Resume, the due list and "Open
  LaunchPad", **and only on Pro**: free and expired users get one line, "Focus tracking is a
  Pro feature. Open LaunchPad in a new tab to start a trial." (`locales/en.js:1872`).
  Rewritten as a Pro bullet.
- **"pause or resume a focus session" keyboard shortcut (2.2.0).** The command pauses or resumes
  *tracking on the active task* and is Pro-only (`background.js:1772-1789`). Dropped from the
  free shortcut list to stay short and true; it still exists.
- **"Settings -> Privacy -> Track time on sites" (NEXT).** There is no Privacy section after the
  H1c redesign. The row is in the **Data** tile (`newtab.html:821-827`). Corrected.
- **"Gemini" (2.2.0's conditional).** `v2.1.0` had no search modes at all, so the Gemini
  behaviour never reached a user. No mention needed.

### Cut, reverted or replaced inside the window

- **Focus sounds (E6, WM.4).** Cut in `2102a00`; keys swept by `dropFocusSoundSettings`
  (`storage.js:747`). DECISIONS 2026-09-16.
- **Space Grotesk.** Replaced by Figtree (DP1). Never shipped.
- **Dashboard calendar.** Moved to Tasks (MC8). Describe it only where it is.
- **MC7's first voice ("Heads up..." 4.65 s).** Replaced in MC8. Never shipped.
- **The warm orange "Warm Bento" palette.** Replaced by slate and indigo (DP3). Never shipped.
- **Accent picker, free scratchpad note, clock line, search-bar resting pulse, Home frosted
  surface.** All built and removed before any release (2.2.0 file's own list).
- **The pill redesigns H2b / FIX-3..5.** The surface was then removed; only the removal is user-facing.

### Never shipped, so not a fix users will notice

- **Seven Settings switches ignored clicks** (`aa3055c`). Introduced by `4cb7420` after the cut.
- **Durations grouping thousands** (`fd20c9f`). Introduced by `240d1b4`, after the cut.
- **The "Gemini opened empty" fix.** Gemini never shipped (above).
- **Duplicate `controls` key that hid the side panel's Start** (`b1c99c5` re-apply). Side panel is new.
- **Schedule "not firing"** (`1a21625`). No code change; the report predated WM.3.
- **Side panel Start unreachable, Dashboard hero "never built"** (`ff53383`). Both on surfaces new in this window.
- Most `fix:` commits from H1 to IR (ink, contrast, scrollbars, floaters, action colour). They
  fix v2 surfaces that never shipped. Shipped-surface ink fixes are real but not listable.

### Real, but too small or internal to list

- **Gate page:** on a block that has already ended, the button now reads "Go to LaunchPad" and
  goes there, instead of Continue to the site (`53cfc42`, `gate.js:264-282`). Pro, rare state.
- **Tasks row:** the priority pill and the amber Overdue chip went. Priority is the row's coloured edge (`2edf6bf`).
- **Focus sessions settings:** 11 rows became 4, the rest under "Advanced" (`4cb7420`). The chime is a dropdown.
- **Time by tag** is a share bar and list, not a ring (DP2).
- **New tags** take the least-used colour instead of always blue (DP6 `58c0304`).
- **A focused empty note** is not faded (`ced66b4`).
- **First run:** Clear examples sits above the demo tiles and pulses on the first three opens.
  First-run tips no longer cover Add shortcut (FR `c06d3b4`..`08848ff`). Fresh installs only.
- **Fresh installs open on a bundled photo** (W2 `5eb97c3`, `newtab.js:188`
  `FRESH_INSTALL_BG`). Existing profiles unchanged. New users only, so not in the update notes.
- **Rotation pool narrowed to 10 dark images** (W1). Rotation itself is new, so no existing user notices.
- **Rate prompt waits** until the user has added a shortcut of their own (`newtab.js:16507`).
- **Firefox add-on id** in the manifest (`11989c4`). Inert on Chrome.
- **SortableJS unminified.** No behaviour change.
- **i18n migration, RTL logical properties, Intl durations** (`dc279e7`, `36dff5b`...`46a9655`). English unchanged.

### Internal (gates, tools, docs, store assets)

All `tools/*` and `check-*` gates, `sweep-ink` / TL rounds, the design pack, DECISIONS/BUGS/docs
commits, the handover, `tools/promo` and the store screenshots/video (DP5, DP7),
`tools/release` upgrade test (`471368b`), and the 2.2.0 release commits.

---

## D. For whoever cuts the release

### D.1 Manifest diff, `v2.1.0` -> master (verbatim)

```diff
-  "version": "2.1.0",
+  "version": "2.2.0",
   "description": "__MSG_extension_description__",
   "default_locale": "en",
-  "permissions": ["storage", "bookmarks", "contextMenus", "history", "topSites", "tabs", "webNavigation", "alarms", "search", "idle", "offscreen"],
+  "browser_specific_settings": {
+    "gecko": {
+      "id": "launchpad@mylaunchpad.me"
+    }
+  },
+  "permissions": ["storage", "bookmarks", "contextMenus", "history", "topSites", "tabs", "webNavigation", "alarms", "search", "idle", "offscreen", "sidePanel"],
   "optional_permissions": ["notifications", "downloads"],
@@
   "background": {
     "service_worker": "background.js"
   },
+  "side_panel": {
+    "default_path": "side-panel.html"
+  },
+  "action": {
+    "default_popup": "companion.html",
+    "default_title": "LaunchPad",
+    "default_icon": {
+      "16": "icons/icon16.png",
+      "48": "icons/icon48.png",
+      "128": "icons/icon128.png"
+    }
+  },
+  "commands": {
+    "open-launchpad": {
+      "description": "Open LaunchPad in a new tab"
+    },
+    "add-current-page": {
+      "description": "Add the current page to LaunchPad"
+    },
+    "save-window-as-session": {
+      "description": "Save this window as a named session"
+    },
+    "toggle-focus-pause": {
+      "description": "Pause or resume focus tracking (Pro)"
+    }
+  },
```

Field by field:

| Field | v2.1.0 -> master |
| --- | --- |
| `permissions` | **+ `sidePanel`** (one addition) |
| `optional_permissions` | unchanged (`notifications`, `downloads`) |
| `host_permissions` | unchanged (`live.dodopayments.com`, `mylaunchpad.me`) |
| `optional_host_permissions` | absent in both |
| `content_security_policy` | unchanged |
| `commands` | **new**, 4 entries, no `suggested_key` |
| `side_panel` | **new** |
| `action` | **new** (toolbar popup) |
| `browser_specific_settings` | **new** (Firefox id; Chrome ignores it) |
| `minimum_chrome_version` | unchanged, `116` |

- `action` and `commands` came in at 2.2.0. `sidePanel`, `side_panel` and
  `browser_specific_settings` came in after it (PF.1, PF.2 follow-up). **The 2.2.0 tag message's
  "permission diff EMPTY" is not true of master.**
- **Install warning:** DECISIONS 2026-09-16 records that `getPermissionWarningsByManifest`
  returned the same four warnings with `sidePanel` added. The browser control proved the check
  could fail. **Not re-run for this draft.** Re-run it on the final artifact's manifest.
- **The Privacy tab needs a justification for `sidePanel`.** `store-description.md` lists the
  2.1.0 set and has no row for it. The privacy policy already lists it.
- `browser_specific_settings` shows as an "Unrecognized manifest key" note on unpacked Chrome
  builds. It should not block a store upload. Unverified against the CWS and Edge upload paths.

### D.2 Behaviour that changes for EXISTING users without them asking

1. **Enter in the Home search bar goes to Google AI Mode** (`google.com/search?udm=50`), not to
   the user's default engine. This applies to everyone who never touched the tabs, which is
   every 2.1.0 user, since 2.1.0 had no tabs (`storage.js:654-656`).
2. **Free and expired profiles start being measured.** Site time is recorded from the first tab
   after update (`storage.js:251-252` defaults `tracking.enabled` to true; `tracking.js` has no
   Pro gate). It is local and kept for 30 days.
3. **Settings and the licence key go into `chrome.storage.sync` with no LaunchPad switch**,
   whenever Chrome sync is on (PF.2). Merged on install and on change. The licence key is a
   credential: it travels, the verdict does not.
4. **Pro: the active-task pill is gone from Home.** Its jobs moved (DECISIONS 2026-09-19 table).
   The play glyph now starts a focus session instead of only activating the task. Stop, the
   blocking arm and the 10-second Work-mode countdown are **side-panel only**.
5. **Pro: no trash icon on task rows.** Delete is in the right-click menu, or Edit task from the
   calendar.
6. **Pro: chimes sound different** (same names, new recordings).
7. **Pro Settings is merged into Settings.** The `sb-pro-settings` sidebar entry is gone.
   Focus-session options fold under "Advanced".
8. **The toolbar icon now opens a popup.** In 2.1.0 there was no `action`. For free users the
   popup is a single Pro upsell line.
9. **The whole visual language changes** (v2). Text sizes, spacing and colours move on every
   surface except Home's grid geometry.

**Also not a change for existing users: calendar reminders** (MC9). A reminder exists only
if the user makes one. Its desktop notification asks for the `notifications` permission at
first use, and that permission was already optional in 2.1.0. Reminders are Pro, appear on
the calendar only, and fire from the worker on an alarm.

**Deliberately NOT a change for existing users:** the due sound. It is written ON only when
`onInstalled` reason is `"install"` and no value exists (`background.js:1383-1388`). Updating
profiles read off. It also needs Pro and a task that *reached* today. Tasks created today and
overdue tasks never ring (`storage.js:10199-10205`). The voice (`dueVoiceEnabled`) is on unless
switched off, but only plays when the sound is on. Neither setting syncs. Also unchanged:
wallpaper for existing profiles (the bundled photo is fresh-install only), and workspace mode
(defaults to Casual, so schedules and auto-advance arm nothing).

### D.3 Privacy-policy and listing conflicts (fix BEFORE the build where marked)

The bundled `privacy-policy.html` and `launchpad-website/privacy-policy.html` prose are
**byte-identical** (10,658 bytes each, compared here), last updated September 16, 2026. The
website repo is at `origin/main`; whether Cloudflare is serving that commit was not checked.

1. **SHIPPED IN THE PACKAGE: `_locales/en/messages.json` `extension_description` says "No
   account, nothing leaves your browser."** This is the store short description and the text
   under the extension in Chrome. With sync on by default, the licence key and preferences leave
   the browser for any Chrome-sync user. **It must change before the artifact is built**, and
   `store-description.md` carries the same sentence and a "NOTHING LEAVES YOUR BROWSER" section.
   The old "No data ever leaves your device" line is gone from the policy, which now describes
   sync, so the policy itself is consistent on this point.
2. **Policy, "Searches": "your browser hands the query to whichever search engine you have set as
   your default in Chrome."** False for the default tab. AI Search sends the query to
   `www.google.com`. Pre-existing since 2.2.0's code, but 2.2.0 never shipped, so it goes live
   with this release. Needs a sentence naming Google AI Mode and the Search tab.
3. **Policy, "Chrome sync - What travels"** reads as a complete list. `SYNC_SETTING_FIELDS`
   (`storage.js:10312-10328`) also syncs `dueRemindersEnabled`, `columns`, `locale`,
   `endOfDayMinutes`, `focusTargetMin`, `insightsRangeDays`, `defaultNoteColor`,
   `combinedAnalyticsEnabled` and `modePresets`. None is sensitive, but the list is not
   complete. Either list them or say "and similar display and focus preferences".
4. **Policy "There is no analytics or tracking of any kind" / listing "no tracking"** sits beside
   on-by-default site-time measurement for every profile. It is local and not analytics in the
   policy's sense, but a reviewer or user can read the two as contradictory. Suggest naming the
   local site-time measurement and its off switch in the policy.
5. **Policy "Tracking": "LaunchPad does not count how many times you open it."** The page keeps a
   local `promoState.openCount` (`newtab.js:15820,16454,16507`) for the rate prompt and the
   first-run pulse. It is pre-existing (in v2.1.0 too), local, and never sent, but the sentence
   is literally false.
6. **Policy "Permissions" list.** `tabs` is described only as saving/restoring tabs. It now also
   powers the Open tabs panel and the free site-time measurement. Recently closed (last 25 URLs
   and titles) is stored locally in `data` and is in backups. The policy's "What stays" list
   does not name it. Low risk.
7. **Website `compare/speed-dial-2.html:328`** says "no cloud sync". Settings sync now exists.
8. **Listing (`store-description.md`)** puts "time by site" under PRO (now free for today) and
   says the licence is checked "about once a day" (the policy says at most every six hours). Its
   "WHAT IS NEW IN 2.1.0" paragraph needs replacing.

### D.4 Store-policy sensitivities

- **The AI search framing note in `RELEASE-NOTES-2.2.0.md` still applies in full.** The feature
  is unchanged on master: plain navigation to `udm=50`, `chrome.search.query` kept for the Search
  tab, no engine picker, no network call from the extension. Describe it as *a shortcut to
  Google's AI search, with a toggle back to your own engine*. Never say "Gemini" or "choose your
  search engine". The UI no longer says Gemini anywhere (`locales/en.js:612,620,624`). The
  listing was rejected once over a visible search control, so the store screenshots (DP5, now on
  the v2 UI) should be checked for how the two tabs read.
- **Single purpose.** The product now has a new tab page, a toolbar popup, a side panel, site
  blocking, site-time measurement and a desktop notification. All of it centres on the new tab.
  The listing text should still lead with the new tab, so a reviewer reads the popup and panel
  as companions to it.
- **CWS Privacy-practices form.** Re-answer it with passive site-time on by default for all users
  and Chrome sync of a licence key. Both are local or Google-account-held and not sent to the
  developer, but the answers should be re-checked against the new behaviour, not carried over.
- **ElevenLabs licence (DECISIONS DP4, still open).** The three chimes, `due-reminder.wav` and
  `due-chime.wav` are ElevenLabs output. The reminder includes a library voice ("Adam Stone").
  DP4 says Samson should confirm the account was on a paid plan **before the next store
  submission**. MC7 and MC8 add voice output under the same open question.

### D.5 Release-engineering flags

- **Version and tag.** The manifest still reads `2.2.0`, and tag `v2.2.0` points at `5c585ae`,
  176 commits behind master. That tag marks a build that was never submitted. Under the CLAUDE.md
  doctrine ("a present `v<version>` tag means that version was submitted") it is already
  misleading. Two options:
  - (a) Bump to a new number (e.g. `2.3.0`) at the cut. `v2.2.0` stays as a documented
    never-submitted tag, and CLAUDE.md's release-state block says so.
  - (b) Ship as `2.2.0` and move the tag. That rewrites a pushed annotated tag.
  It is Samson's call, but **do not upload master as `2.2.0` with the existing tag left in
  place**.
- **Uploading replaces 2.1.0 if it is still in review** (CLAUDE.md). Confirm 2.1.0's store status
  first: it changes whether "2.0.0 -> this" or "2.1.0 -> this" is the real upgrade path. These
  notes assume 2.1.0. A 2.0.0 user also gains everything in `RELEASE-NOTES-2.1.0.md`.
- **Rebuild from master in the MAIN checkout.** The 2.2.0 artifact predates v2. `tools/release/
  upgrade-test.mjs` (`471368b`) tests an upgrade from the live store version and suits this cut.
- **Rename `docs/RELEASE-NOTES-NEXT.md`** at the cut, per its own header. Its two blocks are in
  section A above, with the Settings path corrected.

### D.6 What I could not verify

- **No runtime check.** Every claim was verified by reading source and diffing tags. No browser
  was launched, so behaviour such as "Enter opens AI Mode with the query filled" or "five tabs
  ring once" rests on code and on the rounds' own recorded live runs, not on a run made for
  these notes.
- **Install-warning parity with `sidePanel`.** Cited from DECISIONS, not re-run.
- **Whether the tag item on the shortcut right-click menu is Pro-only.** No Pro gate was found
  in page code around `#menu-add-tag`. The fix bullet is left unmarked.
- **The 2.2.0 file's measured claims** (icon fill percentages, import storage costs, bookmarks
  timings) were not re-measured. Only their presence in source was checked.
- **2.1.0 approval state, the live listing text and the Privacy-tab justifications.** All are in
  the store dashboard.
- **Whether `mylaunchpad.me/privacy-policy` serves the repo's current file.**
- **ElevenLabs plan status.**
- **A reminder's desktop notification after the permission is granted.** The live check
  cannot answer Chrome's permission prompt in a headless profile. Save waits on the prompt
  with nothing written, which is the correct flow. That a notification then appears is a
  human check.
