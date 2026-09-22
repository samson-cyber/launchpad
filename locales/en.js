/* global I18n */

// =========================================================================
// [1.5.0] R2 - the English catalogue for STATIC MARKUP.
//
// 223 strings out of newtab.html and gate.html, resolved into the DOM by
// i18n-dom.js against the data-i18n attributes those files now carry. The
// English text ALSO remains in the markup as the fallback, so a page renders
// correctly even if this file never loads - which is what makes the round's
// byte-identical claim provable rather than merely likely.
//
// NOT IN HERE, deliberately:
//   privacy-policy.html - dropped from localization entirely. Extracting it
//     into a catalogue the page cannot read would be a second source of truth
//     for text that is never translated, and two sources drift. It is on the
//     gate's exclusion list with that reason recorded. Revisit when a human
//     translation is deliberately commissioned; a machine-translated privacy
//     policy is a legal document nobody has reviewed.
//   offscreen.html - its only string is a <title> on a document that is never
//     rendered, so no user can ever see it.
//
// EVERY MESSAGE CARRIES A DESCRIPTION naming its surface, and the ones whose
// English text collides with another message carry a SENSE. Those two fields
// are the whole defence against a translator flattening a distinction the
// product depends on, because a translator never sees this source.
// =========================================================================

I18n.register("en", {
  "bgmodal_change_background": {
    "message": "Change Background",
    "description": "Text on the bgmodal surface."
  },
  "bgmodal_colors": {
    "message": "Colors",
    "description": "Text on the bgmodal surface."
  },
  "bgmodal_gallery": {
    "message": "Gallery",
    "description": "Text on the bgmodal surface."
  },
  "bgmodal_images": {
    "message": "Images",
    "description": "Text on the bgmodal surface."
  },
  "bgmodal_paste_image_url": {
    "message": "Paste image URL...",
    "description": "placeholder attribute on the bgmodal surface."
  },
  "bgmodal_remove_background": {
    "message": "Remove background",
    "description": "Text on the bgmodal surface."
  },
  "bgmodal_tab_url": {
    "message": "URL",
    "description": "TAB NAME in the wallpaper picker, not a form label.",
    "sense": "tab.name"
  },
  "bgmodal_tip_use_launchpad_s_background": {
    "message": "Tip: Use LaunchPad's background picker instead of Chrome's ‘Customize Chrome’ to keep your shortcuts visible.",
    "description": "Text on the bgmodal surface."
  },
  "bgmodal_upload": {
    "message": "Upload",
    "description": "Text on the bgmodal surface."
  },
  "bgmodal_upload_image": {
    "message": "Upload image",
    "description": "Text on the bgmodal surface."
  },
  "bookmarkmodal_import_bookmarks": {
    "message": "Import Bookmarks",
    "description": "Text on the bookmarkmodal surface."
  },
  "bookmarkmodal_import_btn": {
    "message": "Import",
    "description": "VERB on the confirm button of the bookmark importer. English collapses this with the Import feature NAME; most languages do not.",
    "sense": "action.import"
  },
  "bookmarkmodal_select_all_none": {
    "message": "Select all / none",
    "description": "Text on the bookmarkmodal surface."
  },
  "bookmarkmodal_select_folders_to_import_as": {
    "message": "Select folders to import as shortcut groups.",
    "description": "Text on the bookmarkmodal surface."
  },
  "common_apply": {
    "message": "Apply",
    "description": "Generic action label, shared across surfaces. Shared by 2 sinks: newtab.html:368 text, newtab.html:697 text.",
    "sense": "action.generic"
  },
  "prosettings_mode_work": {
    "message": "Work",
    "description": "Button selecting which mode preset the focus-session lengths below are editing."
  },
  "prosettings_mode_casual": {
    "message": "Casual",
    "description": "Button selecting which mode preset the focus-session lengths below are editing."
  },
  "prosettings_which_mode_these_lengths": {
    "message": "Which mode these lengths belong to",
    "description": "Accessible group label on the two mode buttons above the focus-session lengths."
  },
  "prosettings_each_mode_keeps_its_own_lengths": {
    "message": "Each mode keeps its own lengths. A session runs under the mode of the workspace it started in.",
    "description": "Note under the mode selector, explaining that the lengths are per mode and that a running session keeps the mode it began with."
  },
  "prosettings_chain_after_break": {
    "message": "Roll into the next work phase after a break, with a 10-second countdown you can cancel",
    "description": "Checkbox enabling phase chaining for the selected mode. Names the countdown so the user knows the advance is never silent."
  },
  "prosettings_reminders": {
    "message": "Reminders",
    "description": "Pro Settings section heading for due-date reminders."
  },
  "prosettings_due_reminders_toggle": {
    "message": "Remind me about work due today, once each morning",
    "description": "Checkbox enabling due-date reminder notifications."
  },
  "prosettings_due_reminders_note": {
    "message": "Off by default. Sends one desktop notification per task, at 9am or the first time the browser is open after it, and only in a Work workspace.",
    "description": "Note under the reminders switch, stating the default, the cadence, the time and the mode gate."
  },
  "sat_next_phase_in_seconds": {
    "plural": {"one": "Next phase in {count}s", "other": "Next phase in {count}s"},
    "description": "Countdown on the session-done card before the next work phase begins. Reports the time remaining and does not urge; a Cancel control sits beside it."
  },
  "notebooks_add_to_notebook": {
    "message": "Add to notebook",
    "description": "Row on a note right-click menu. Opens a picker whose FIRST row is New notebook, so a user with no notebooks yet can make their first one from a surface every note already has. This is the discoverable path: the chip strip does not exist until a notebook does."
  },
  "notebooks_all_notes": {
    "message": "All notes",
    "description": "The first chip in the notebook strip, always present and never removable. It is a SCOPE, not a notebook: selecting it shows every live note, which is the panel behaviour that shipped before notebooks existed. It is also the drop target for dragging a note out of a notebook."
  },
  "notebooks_create_failed": {
    "message": "That notebook could not be created.",
    "description": "Toast when the notebook writer refuses. Rare: the only refusal is an empty name, and every caller passes the default name from the catalogue."
  },
  "notebooks_default_name": {
    "message": "New notebook",
    "description": "The name a notebook is born with, from every route. Deliberately NOT derived from either note in a drag-to-combine: deriving would mean picking one of the two arbitrarily and baking that guess into a label the user then has to correct, and the first line of a clipped paragraph makes a particularly bad folder name. Inline rename opens immediately with the text selected, so naming it is one typed word."
  },
  "notebooks_deleted_toast": {
    "plural": {"=0": "Notebook deleted.", "one": "Notebook deleted. Its note is in All notes.", "other": "Notebook deleted. Its {count} notes are in All notes."},
    "description": "Toast after a notebook is deleted. Says where the notes went, in the past tense, because the modal promised it a moment earlier and the promise is worth confirming. The zero case omits the clause rather than saying \"its 0 notes\"."
  },
  "notebooks_delete_confirm": {
    "message": "Delete notebook",
    "description": "The dangerous button in the delete-notebook dialog. Names the thing being deleted so it cannot be misread as deleting the notes."
  },
  "notebooks_delete_message": {
    "plural": {"=0": "It is empty. The notebook goes to trash for 30 days.", "one": "Its 1 note stays in All notes. The notebook goes to trash for 30 days.", "other": "Its {count} notes stay in All notes. The notebook goes to trash for 30 days."},
    "description": "The delete-notebook dialog body. The count is read from live membership at open time, never remembered, and it is the whole reassurance of this dialog: a user who believes their notes are about to be deleted with the notebook will not click. The word STAY is also a promise that restoring the notebook will not bring them back."
  },
  "notebooks_delete_title": {
    "message": "Delete {name}?",
    "description": "Title of the delete-notebook dialog. The name is the user own, unquoted here because the dialog title already reads as one."
  },
  "notebooks_new_notebook": {
    "message": "New notebook",
    "description": "First row of the add-to-notebook picker, and the label on the strip plus control. First ALWAYS, even with twenty notebooks below it: a create control that migrates to the bottom of a growing list gets harder to find the longer the product is used."
  },
  "notebooks_notebooks": {
    "message": "Notebooks",
    "description": "Accessible name for the chip strip, and the entity label on the notebook context menus."
  },
  "notebooks_purge_message": {
    "message": "This removes the notebook for good. Any notes it once held are already in All notes and are not affected.",
    "description": "Body of the permanent-delete dialog for a trashed notebook. States plainly that no notes are at risk, because permanent deletion is the moment a user most needs to know a container is not taking anything with it."
  },
  "notebooks_purge_title": {
    "message": "Delete this notebook permanently?",
    "description": "Title of the permanent-delete dialog for a trashed notebook."
  },
  "notebooks_remove_from_notebook": {
    "message": "Remove from notebook",
    "description": "Row on a note right-click menu, shown ONLY when the note is in a notebook rather than greyed out when it is not. The keyboard equivalent of dragging a note onto the All notes chip. The note lands at the top of the standalone stack."
  },
  "notebooks_rename": {
    "message": "Rename",
    "description": "Row on a notebook chip right-click menu. Opens inline rename on the chip itself with the text selected."
  },
  "notebooks_restored_empty_toast": {
    "message": "Notebook restored, empty. Its notes stayed in All notes.",
    "description": "Toast after restoring a notebook from the trash. Carries the consequence at the moment it matters: deleting released the notes, so restoring cannot bring them back, and a user who expected them needs telling where they are rather than being left to go looking."
  },
  "notebooks_trash_restores_empty": {
    "message": "Restores empty",
    "description": "Second line on a trashed-notebook row in the notes trash. The row says this before the user clicks Restore, because the person reading this list is exactly the person about to be surprised by it."
  },
  "notif_due_today_title": {
    "message": "Due today",
    "description": "Title of the desktop notification for a task due on the current day."
  },
  "notif_due_overdue_title": {
    "message": "Overdue",
    "description": "Title of the desktop notification for a task whose due date has passed."
  },
  "common_cancel": {
    "message": "Cancel",
    "description": "Generic action label, shared across surfaces. Shared by 6 sinks: newtab.html:392 text, newtab.html:612 text, newtab.html:643 text, newtab.html:662 text.",
    "sense": "action.generic"
  },
  "common_close": {
    "message": "Close",
    "description": "Generic action label, shared across surfaces. Shared by 6 sinks: newtab.html:173 attr:title, newtab.html:245 attr:title, newtab.html:267 attr:title, newtab.html:288 attr:title.",
    "sense": "action.generic"
  },
  "common_delete": {
    "message": "Delete",
    "description": "Generic action label, shared across surfaces. Shared by 5 sinks: newtab.html:556 text, newtab.html:566 text, newtab.html:597 text, newtab.html:613 text.",
    "sense": "action.generic"
  },
  "common_done": {
    "message": "Done",
    "description": "Generic action label, shared across surfaces.",
    "sense": "action.generic"
  },
  "common_remove": {
    "message": "Remove",
    "description": "Generic action label, shared across surfaces. Shared by 2 sinks: newtab.html:314 text, newtab.html:547 text.",
    "sense": "action.generic"
  },
  "common_rename": {
    "message": "Rename",
    "description": "Generic action label, shared across surfaces. Shared by 4 sinks: newtab.html:553 text, newtab.html:562 text, newtab.html:589 text, newtab.html:734 text.",
    "sense": "action.generic"
  },
  "common_save": {
    "message": "Save",
    "description": "Generic action label, shared across surfaces. Shared by 4 sinks: newtab.html:391 text, newtab.html:573 text, newtab.html:708 text, newtab.html:760 text.",
    "sense": "action.generic"
  },
  "common_unit_minutes": {
    "message": "min",
    "description": "Names the \"min\" feature wherever it appears. Shared by 3 sinks: newtab.html:428 text, newtab.html:435 text, newtab.html:442 text.",
    "sense": "feature.name"
  },
  "feature_add_group_name": {
    "message": "Add Group",
    "description": "Names the \"Add Group\" feature wherever it appears. Shared by 2 sinks: newtab.html:47 text, newtab.html:43 attr:title.",
    "sense": "feature.name"
  },
  "feature_add_tag_name": {
    "message": "Add tag",
    "description": "Names the \"Add tag\" feature wherever it appears. Shared by 3 sinks: newtab.html:540 text, newtab.html:593 text, newtab.html:736 text.",
    "sense": "feature.name"
  },
  "feature_expand_all_name": {
    "message": "Expand all groups",
    "description": "Names the \"Expand all groups\" feature wherever it appears. Shared by 2 sinks: newtab.html:36 attr:title, newtab.html:36 attr:aria-label.",
    "sense": "feature.name"
  },
  "feature_history_name": {
    "message": "History",
    "description": "Names the \"History\" feature wherever it appears. Shared by 3 sinks: newtab.html:20 text, newtab.html:172 text, newtab.html:16 attr:title.",
    "sense": "feature.name"
  },
  "feature_bookmarks_name": {
    "message": "Bookmarks",
    "description": "Names the Bookmarks feature wherever it appears: the sidebar entry, its title attribute and the tree aria-label.",
    "sense": "feature.name"
  },
  "bookmarks_panel_heading": {
    "message": "Bookmarks",
    "description": "Heading of the bookmarks panel."
  },
  "bookmarks_panel_intro": {
    "message": "Your Chrome bookmarks, live. Click to open, or add one to LaunchPad.",
    "description": "One-line explanation at the top of the bookmarks panel."
  },
  "bookmarks_empty": {
    "message": "No bookmarks yet",
    "description": "Shown in the bookmarks panel when the browser has no bookmarks at all."
  },
  "bookmarks_empty_hint": {
    "message": "Bookmarks you save in Chrome show up here.",
    "description": "Second line of the bookmarks panel empty state."
  },
  "bookmarks_untitled": {
    "message": "Untitled",
    "description": "Fallback label for a bookmark or folder saved with no title."
  },
  "bookmarks_already_added": {
    "message": "Already in LaunchPad",
    "description": "Marks a bookmark row whose URL is already a shortcut in the active workspace. Replaces the add button rather than sitting beside it - a + that cannot do anything reads as broken. Also the toast if a click gets through on a stale row."
  },
  "bookmarks_add_to_launchpad": {
    "message": "Add to LaunchPad",
    "description": "Tooltip on the per-row button that copies a bookmark into the current workspace."
  },
  "bookmarks_added_toast": {
    "message": "Added \"{title}\" to LaunchPad",
    "description": "Toast confirming a bookmark was copied into the current workspace from the bookmarks panel. {title} is the bookmark's own title."
  },
  "bookmarks_add_needs_group": {
    "message": "Add a group first, then add bookmarks to it",
    "description": "Toast shown when there is no group to add a bookmark into."
  },
  "bookmarks_folder_count": {
    "plural": {"=0": "Empty", "one": "1 item", "other": "{count} items"},
    "description": "Count of direct children on a bookmarks folder row. The =0 form reads Empty rather than 0 items, because an empty folder is a state rather than a quantity."
  },
  "feature_import_name": {
    "message": "Import",
    "description": "The NAME of the Import feature, on the sidebar and its panel header. Shared by 3 sinks: newtab.html:56 text, newtab.html:244 text, newtab.html:52 attr:title.",
    "sense": "feature.name"
  },
  "feature_nest_with_name": {
    "message": "Nest with...",
    "description": "Names the \"Nest with...\" feature wherever it appears. Shared by 2 sinks: newtab.html:536 text, newtab.html:579 text.",
    "sense": "feature.name"
  },
  "feature_pro_settings_name": {
    "message": "Pro Settings",
    "description": "Names the \"Pro Settings\" feature wherever it appears. Shared by 3 sinks: newtab.html:70 text, newtab.html:351 text, newtab.html:66 attr:title.",
    "sense": "feature.name"
  },
  "feature_rate_name": {
    "message": "Rate LaunchPad",
    "description": "Names the \"Rate LaunchPad\" feature wherever it appears. Shared by 2 sinks: newtab.html:86 text, newtab.html:82 attr:title.",
    "sense": "feature.name"
  },
  "feature_restore_session_name": {
    "message": "Restore Session",
    "description": "Names the \"Restore Session\" feature wherever it appears. Shared by 3 sinks: newtab.html:26 text, newtab.html:209 text, newtab.html:22 attr:title.",
    "sense": "feature.name"
  },
  "feature_sessions_name": {
    "message": "Sessions",
    "description": "Names the \"Sessions\" feature wherever it appears. Shared by 4 sinks: newtab.html:32 text, newtab.html:230 text, newtab.html:28 attr:title, newtab.html:228 attr:aria-label.",
    "sense": "feature.name"
  },
  "feature_settings_name": {
    "message": "Settings",
    "description": "Names the \"Settings\" feature wherever it appears. Shared by 3 sinks: newtab.html:78 text, newtab.html:287 text, newtab.html:74 attr:title.",
    "sense": "feature.name"
  },
  "feature_tags_name": {
    "message": "Tags",
    "description": "Names the \"Tags\" feature wherever it appears. Shared by 2 sinks: newtab.html:384 text, newtab.html:744 text.",
    "sense": "feature.name"
  },
  "feature_tips_name": {
    "message": "Tips",
    "description": "Names the \"Tips\" feature wherever it appears. Shared by 3 sinks: newtab.html:62 text, newtab.html:266 text, newtab.html:58 attr:title.",
    "sense": "feature.name"
  },
  "gate_5_more_minutes": {
    "message": "5 more minutes",
    "description": "Text on the gate surface."
  },
  "gate_blocked_during_focus_launchpad": {
    "message": "Blocked during focus - LaunchPad",
    "description": "Text on the gate surface."
  },
  "gate_focus": {
    "message": "Focus",
    "sense": "page.gate",
    "description": "Heading on the BLOCKING GATE page. Not the pomodoro work-phase label with the same word (sat_pomo_phase_focus)."
  },
  "gate_is_blocked": {
    "message": "is blocked",
    "description": "Text on the gate surface."
  },
  "groupdelete_delete_group": {
    "message": "Delete group?",
    "description": "Text on the groupdelete surface."
  },
  "groupdelete_move_delete": {
    "message": "Move & Delete",
    "description": "Text on the groupdelete surface."
  },
  "habit_track_on_grid": {
    "message": "Track this on a month grid",
    "description": "Checkbox in the recurring-task dialog. Turning it on draws a month grid of completed days on the template row. Says what the control DOES rather than naming a concept, because the result is checkable and the concept is not."
  },
  "habit_track_hint": {
    "message": "A square fills on each day you complete this. Nothing is counted and nothing resets.",
    "description": "Sub-label under the month-grid checkbox. The second sentence is the promise the grid makes and is load-bearing: it tells the user up front that this is a record, not a scoreboard, so turning it on cannot feel like signing up to be measured."
  },
  "habit_grid_label": {
    "plural": {"one": "{month}: {count} day completed", "other": "{month}: {count} days completed"},
    "description": "Accessible label for the whole month grid, which is a single image to a screen reader. Names only what was DONE. There is deliberately no count of days not done, because the grid does not show one either."
  },
  "habit_day_done": {
    "message": "{date}: completed",
    "description": "Tooltip on a filled square."
  },
  "habit_day_open": {
    "message": "{date}: waiting",
    "description": "Tooltip on a partly-filled square, meaning an instance for that day exists and is not ticked. WAITING, not late and not due: the square makes no claim about whether the day is going badly."
  },
  "habit_day_skipped": {
    "message": "{date}: not added",
    "description": "Tooltip on the faintest square, meaning the catch-up ceiling declined to create that day instance. It says what the PRODUCT did. There is no tooltip at all on an empty day, because an empty day is the absence of a mark and giving it words would be the grid commenting on a gap."
  },
  "recurring_caught_up": {
    "message": "Picked up where you left off.",
    "description": "First half of the notice shown once after a sweep that hit the instance ceiling. Deliberately about resuming rather than about an absence. Must never acquire a count of days away."
  },
  "recurring_caught_up_detail": {
    "plural": {"one": "{count} earlier instance was not added.", "other": "{count} earlier instances were not added."},
    "description": "Second half of the catch-up notice. Counts what the product did NOT create, which is a fact about the sweep rather than about the user. Passive on purpose: the user is not the actor in this sentence."
  },
  "recurring_caught_up_dismiss": {
    "message": "Dismiss",
    "description": "Accessible label for the X that clears the catch-up notice permanently."
  },
  "history_all": {
    "message": "All",
    "description": "Text on the history surface."
  },
  "history_custom_range": {
    "message": "Custom range...",
    "description": "Text on the history surface."
  },
  "history_last_7_days": {
    "message": "Last 7 days",
    "description": "Text on the history surface."
  },
  "history_search_history": {
    "message": "Search history...",
    "description": "placeholder attribute on the history surface."
  },
  "icondialog_https": {
    "message": "https://...",
    "description": "placeholder attribute on the icondialog surface."
  },
  "icondialog_paste_an_image_url": {
    "message": "Paste an image URL:",
    "description": "Text on the icondialog surface."
  },
  "icondialog_reset_to_default": {
    "message": "Reset to default",
    "description": "Text on the icondialog surface."
  },
  "import_add_your_top_sites_from": {
    "message": "Add your top sites from Chrome",
    "description": "Text on the import surface."
  },
  "import_bring_your_existing_links_into": {
    "message": "Bring your existing links into LaunchPad.",
    "description": "Text on the import surface."
  },
  "import_chrome_bookmarks": {
    "message": "Chrome bookmarks",
    "description": "Text on the import surface."
  },
  "import_paste_links_title": {
    "message": "Paste links",
    "description": "Import panel option: paste a list of URLs."
  },
  "import_paste_links_desc": {
    "message": "A list of URLs, one per line",
    "description": "Sub-label under the Paste links import option."
  },
  "import_from_file_title": {
    "message": "Import a file",
    "description": "Import panel option: choose an export file from another tool."
  },
  "import_from_file_desc": {
    "message": "Bookmarks HTML, Toby, OneTab, Session Buddy, Speed Dial 2",
    "description": "Sub-label naming the export formats the file importer reads."
  },
  "import_paste_label": {
    "message": "Paste your links",
    "description": "Label above the paste textarea."
  },
  "import_paste_placeholder": {
    "message": "https://example.com",
    "description": "Placeholder inside the paste textarea."
  },
  "import_preview_btn": {
    "message": "Preview",
    "description": "Button that parses the pasted text and shows what would be imported."
  },
  "import_confirm_btn": {
    "message": "Import",
    "description": "Button that performs the import shown in the preview."
  },
  "import_undo_btn": {
    "message": "Undo that import",
    "description": "Button that removes everything the last import created."
  },
  "import_preview_summary": {
    "plural": {"one": "1 link from {source}", "other": "{count} links from {source}"},
    "description": "Preview headline. {source} names the detected format, for example Bookmarks HTML."
  },
  "import_preview_into_groups": {
    "plural": {"one": "into 1 new group", "other": "into {count} new groups"},
    "description": "Second half of the preview headline when importing as groups."
  },
  "import_preview_skipped": {
    "plural": {"=0": "", "one": "1 link was left out because it is not a web address.", "other": "{count} links were left out because they are not web addresses."},
    "description": "Preview note about entries dropped by the http/https allowlist, such as bookmarklets."
  },
  "import_preview_already": {
    "plural": {"=0": "", "one": "1 of these is already in LaunchPad. Importing adds it again.", "other": "{count} of these are already in LaunchPad. Importing adds them again."},
    "description": "Preview note about links that already exist, so importing the same file twice is a visible choice rather than a surprise."
  },
  "import_nothing_found": {
    "message": "No web links found in that file",
    "description": "Shown when a chosen file or paste contains nothing importable."
  },
  "import_too_big": {
    "message": "That import is too large for LaunchPad's storage. Nothing was imported. Try a smaller file, or remove some shortcuts first.",
    "description": "Refusal shown BEFORE any write when an import would exceed the browser storage quota."
  },
  "import_done_toast": {
    "plural": {"one": "Imported 1 link", "other": "Imported {count} links"},
    "description": "Toast confirming a completed import."
  },
  "import_undone_toast": {
    "message": "Import undone",
    "description": "Toast confirming the last import was removed."
  },
  "import_undo_available": {
    "plural": {"one": "Last import: 1 link from {source}", "other": "Last import: {count} links from {source}"},
    "description": "Line above the undo button naming what the last import brought in."
  },
  "import_dest_groups": {
    "message": "As groups of shortcuts",
    "description": "Import destination choice: create shortcut groups."
  },
  "import_dest_sessions": {
    "message": "As saved sessions",
    "description": "Import destination choice: create named sessions instead of shortcut groups."
  },
  "import_most_visited_sites": {
    "message": "Most visited sites",
    "description": "Text on the import surface."
  },
  "import_pick_folders_to_import_as": {
    "message": "Pick folders to import as groups",
    "description": "Text on the import surface."
  },
  "page_add_shortcut": {
    "message": "Add shortcut",
    "description": "Text on the page surface."
  },
  "page_don_t_show_again": {
    "message": "Don't show again",
    "description": "Text on the page surface."
  },
  "page_drop_here_to_ungroup": {
    "message": "Drop here to ungroup",
    "description": "Text on the page surface."
  },
  "page_edit_shortcut": {
    "message": "Edit shortcut",
    "description": "Text on the page surface."
  },
  "page_edit_url": {
    "message": "Edit URL",
    "description": "Text on the page surface."
  },
  "page_got_it": {
    "message": "Got it",
    "description": "Text on the page surface."
  },
  "page_https": {
    "message": "https://",
    "description": "placeholder attribute on the page surface."
  },
  "page_icon": {
    "message": "Icon",
    "description": "Text on the page surface."
  },
  "page_launchpad": {
    "message": "LaunchPad",
    "description": "Text on the page surface."
  },
  "page_manage_variants": {
    "message": "Manage variants",
    "description": "Text on the page surface."
  },
  "page_menu": {
    "message": "Menu",
    "description": "title attribute on the page surface."
  },
  "page_name": {
    "message": "Name",
    "description": "Text on the page surface."
  },
  "page_new_tab": {
    "message": "New Tab",
    "description": "Text on the page surface."
  },
  "page_open": {
    "message": "Open",
    "description": "Text on the page surface."
  },
  "page_open_all": {
    "message": "Open All",
    "description": "Text on the page surface."
  },
  "page_open_default": {
    "message": "Open default",
    "description": "Text on the page surface."
  },
  "page_open_in_new_tab": {
    "message": "Open in new tab",
    "description": "Text on the page surface."
  },
  "page_or_import_from_chrome_bookmarks": {
    "message": "or Import from Chrome Bookmarks",
    "description": "Text on the page surface."
  },
  "launcher_ask_ai_about": {
    "message": "Ask Google AI about",
    "description": "[1.12.5] Prefix of the launcher's last row when the AI Search tab is active; the query follows in quotes. The row exists so that what Enter does is visible rather than folklore, so this must name the REAL destination - which is Google AI Mode (www.google.com/search?udm=50), not the Gemini app. It said \"Ask Gemini about\" until 2026-09-15, when Gemini was measured to accept no URL query at all and the tab was repointed."
  },
  "launcher_go_to": {
    "message": "Go to",
    "description": "[1.12.3] Prefix of the launcher's last row when the query looks like a bare domain, in EITHER mode - Enter navigates there rather than searching. Before [1.12.3] this row said \"Search the web for ...\" while Enter jumped to the site."
  },
  "page_search_ai": {
    "message": "Search your shortcuts, or ask Google AI",
    "description": "[1.12.5] Placeholder in the Home search field while the AI SEARCH tab is active. Mirrors page_search_or_type_a_url's shape deliberately: the shortcut half stays FIRST because the launcher matches shortcuts in both modes and that is the half the address bar cannot do ([1.12.1]'s finding, re-ruled in [1.12.3]). \"ask Google AI\" rather than anything about an assistant - this is a shortcut to Google AI Mode with the query appended, not an AI embedded in the page, and the copy must not claim otherwise. It named Gemini until 2026-09-15."
  },
  "searchmode_ai": {
    "message": "AI Search",
    "description": "[1.12.5] Left tab of the Home search bar's mode strip. Means Google AI Mode, which is where Enter goes while it is lit. NOT a product name - translate it as the ordinary words for an AI-answered search. It read \"Gemini\" until 2026-09-15; the tab was repointed because the Gemini app accepts no URL query. Measured to fit the 80px tab with 19px to spare at the Large text tier."
  },
  "searchmode_group": {
    "message": "Search mode",
    "description": "[1.12.2] aria-label on the Home search bar's two-button mode strip."
  },
  "searchmode_search": {
    "message": "Search",
    "description": "[1.12.2] Right tab of the Home search bar's mode strip. Means the user's DEFAULT search engine, which chrome.search.query decides - not Google specifically, so it must not be translated as a brand."
  },
  "page_search_or_type_a_url": {
    "message": "Search your shortcuts, or the web",
    "description": "Placeholder in the Home search field, bound in markup and re-applied by applySearch(). [1.12.1] changed it from \"Search or type a URL\", which was Chrome's own omnibox copy verbatim - a field that announces itself as the address bar gets used like the address bar, which is to say not at all. This field does something the omnibox CANNOT: [1.10.1] made it search shortcuts, groups and sessions inline. The shortcut half is named first because it is the half that is not available anywhere else."
  },
  "page_tip_right_click_any_webpage": {
    "message": "💡 Tip: Right-click any webpage and select ‘Add to LaunchPad’ to quickly save it to any group!",
    "description": "Text on the page surface."
  },
  "page_ungroup_all": {
    "message": "Ungroup all",
    "description": "Text on the page surface."
  },
  "prosettings_about_title": {
    "message": "About",
    "description": "Section heading in the Pro Settings panel. Independently editable from the free one."
  },
  "prosettings_add": {
    "message": "Add",
    "description": "Text on the prosettings surface."
  },
  "prosettings_add_workspace": {
    "message": "Add workspace",
    "description": "Text on the prosettings surface."
  },
  "prosettings_analytics": {
    "message": "Analytics",
    "description": "Text on the prosettings surface."
  },
  "prosettings_block_automatically_during_focus_sessions": {
    "message": "Block automatically during focus sessions",
    "description": "Text on the prosettings surface."
  },
  "prosettings_blocked_sites_redirect_to_a": {
    "message": "Blocked sites redirect to a gentle gate during focus.",
    "description": "Text on the prosettings surface."
  },
  "prosettings_cancel_subscription": {
    "message": "Cancel subscription",
    "description": "Text on the prosettings surface."
  },
  "prosettings_check_license_status_now": {
    "message": "Check license status now",
    "description": "Text on the prosettings surface."
  },
  "prosettings_chime_1_soft_bell": {
    "message": "Chime 1, soft bell",
    "description": "Text on the prosettings surface."
  },
  "prosettings_chime_2_rising_triad": {
    "message": "Chime 2, rising triad",
    "description": "Text on the prosettings surface."
  },
  "prosettings_chime_3_warm_tone": {
    "message": "Chime 3, warm tone",
    "description": "Text on the prosettings surface."
  },
  "prosettings_clear_license": {
    "message": "Clear license",
    "description": "Text on the prosettings surface."
  },
  "prosettings_coming_in_v1_0_6": {
    "message": "Coming in v1.0.6: workspace management",
    "description": "Text on the prosettings surface."
  },
  "prosettings_coming_in_v1_0_6_2": {
    "message": "Coming in v1.0.6",
    "description": "title attribute on the prosettings surface."
  },
  "prosettings_cycles_before_long_break": {
    "message": "Cycles before long break",
    "description": "Text on the prosettings surface."
  },
  "prosettings_default_paper_colour_for_new": {
    "message": "Default paper colour for new notes",
    "description": "aria-label attribute on the prosettings surface."
  },
  "prosettings_desktop_notifications_at_each_phase": {
    "message": "Desktop notifications at each phase boundary (fires even with no tab open)",
    "description": "Text on the prosettings surface."
  },
  "prosettings_enter_license_key": {
    "message": "Enter license key",
    "description": "placeholder attribute on the prosettings surface."
  },
  "prosettings_focus_blocking": {
    "message": "Focus blocking",
    "description": "Text on the prosettings surface."
  },
  "prosettings_focus_sessions": {
    "message": "Focus sessions",
    "description": "Text on the prosettings surface."
  },
  "prosettings_license_key": {
    "message": "License key",
    "description": "Text on the prosettings surface."
  },
  "prosettings_long_break": {
    "message": "Long break",
    "description": "Text on the prosettings surface."
  },
  "prosettings_new_tag": {
    "message": "+ New tag",
    "description": "Text on the prosettings surface."
  },
  "prosettings_no_blocked_sites_yet_add": {
    "message": "No blocked sites yet. Add one below. Subdomains are included automatically.",
    "description": "Text on the prosettings surface."
  },
  "prosettings_no_tags_yet_create_your": {
    "message": "No tags yet. Create your first tag with the + button below, or create a goal. Each goal can auto-create a tag.",
    "description": "Text on the prosettings surface."
  },
  "prosettings_none": {
    "message": "None",
    "description": "Text on the prosettings surface."
  },
  "prosettings_notes": {
    "message": "Notes",
    "description": "Text on the prosettings surface."
  },
  "prosettings_paper_colour_for_new_notes": {
    "message": "Paper colour for new notes. Leave unset to cycle the palette.",
    "description": "Text on the prosettings surface."
  },
  "prosettings_privacy_policy": {
    "message": "Privacy policy",
    "description": "Text on the prosettings surface."
  },
  "prosettings_reactivate": {
    "message": "Reactivate",
    "description": "Text on the prosettings surface."
  },
  "prosettings_reset_cycle_count": {
    "message": "Reset cycle count",
    "description": "Text on the prosettings surface."
  },
  "prosettings_short_break": {
    "message": "Short break",
    "description": "Text on the prosettings surface."
  },
  "prosettings_daily_focus_target": {
    "message": "Daily focus target",
    "description": "Label for the number input in Pro Settings > Analytics that sets a daily focused-time target in minutes. GLOBAL, not per workspace, because the Dashboard figure it is measured against can itself be combined across workspaces. An EMPTY field means no target, which is a real state: the Dashboard ring is absent entirely rather than shown at zero."
  },
  "prosettings_focus_target_hint": {
    "message": "Leave it empty for no target. The Dashboard ring appears once you set one.",
    "description": "Subtitle under the daily focus target input in Pro Settings > Analytics. States that absence of a target is a supported state, not an omission. Rendered by the data-i18n DOM pass."
  },
  "prosettings_show_combined_analytics_across_all": {
    "message": "Show combined analytics across all workspaces",
    "description": "Text on the prosettings surface."
  },
  "prosettings_site_to_block": {
    "message": "Site to block",
    "description": "aria-label attribute on the prosettings surface."
  },
  "prosettings_sound_at_each_phase_boundary": {
    "message": "Sound at each phase boundary",
    "description": "Text on the prosettings surface."
  },
  "prosettings_subscription": {
    "message": "Subscription",
    "description": "Text on the prosettings surface."
  },
  "prosettings_total_your_focused_time_across": {
    "message": "Total your focused time across every workspace on the Dashboard.",
    "description": "Text on the prosettings surface."
  },
  "prosettings_unavailable_title": {
    "message": "Available with Pro launch",
    "description": "Names the \"Available with Pro launch\" feature wherever it appears. Shared by 2 sinks: newtab.html:359 attr:title, newtab.html:360 attr:title.",
    "sense": "feature.name"
  },
  "prosettings_work": {
    "message": "Work",
    "description": "Text on the prosettings surface."
  },
  "prosettings_work_and_break_lengths_changes": {
    "message": "Work and break lengths. Changes apply to your next phase.",
    "description": "Text on the prosettings surface."
  },
  "prosettings_workspaces": {
    "message": "Workspaces",
    "description": "Text on the prosettings surface."
  },
  "prosettings_youtube_com": {
    "message": "youtube.com",
    "description": "placeholder attribute on the prosettings surface."
  },
  "recent_filter_current_today": {
    "message": "Today",
    "description": "The CURRENT VALUE of the recently-closed filter, not the menu option.",
    "sense": "filter.value"
  },
  "recent_filter_option_today": {
    "message": "Today",
    "description": "A selectable OPTION in the recently-closed filter menu.",
    "sense": "filter.option"
  },
  "recent_filter_option_yesterday": {
    "message": "Yesterday",
    "description": "A selectable OPTION in the recently-closed filter menu.",
    "sense": "filter.option"
  },
  "restore_date_yesterday": {
    "message": "Yesterday",
    "description": "Date label in the Restore Session flyout, not a filter option.",
    "sense": "date.label"
  },
  "restore_empty": {
    "message": "No saved sessions yet. Sessions are saved automatically every 5 minutes.",
    "description": "Empty state of the AUTOMATIC five-minute Restore Session flyout.",
    "sense": "session.autorestore"
  },
  "restore_restore_all": {
    "message": "Restore All",
    "description": "Text on the restore surface."
  },
  "sessionmenu_attach_to_task": {
    "message": "Attach to task",
    "description": "Text on the sessionmenu surface."
  },
  "sessionmenu_detach_from_task": {
    "message": "Detach from task",
    "description": "Text on the sessionmenu surface."
  },
  "sessionmenu_session_options": {
    "message": "Session options",
    "description": "aria-label attribute on the sessionmenu surface."
  },
  "sessionmenu_update_from_current_window": {
    "message": "Update from current window",
    "description": "Text on the sessionmenu surface."
  },
  "sessions_named_empty": {
    "message": "No saved sessions yet. Save the tabs you have open to make one.",
    "description": "Empty state of the NAMED sessions flyout. A different feature from the automatic restore; the two open with the same sentence in English and must not merge.",
    "sense": "session.named"
  },
  "sessions_save_current_tabs": {
    "message": "Save current tabs",
    "description": "Text on the sessions surface."
  },
  "settings_about_title": {
    "message": "About",
    "description": "Section heading in the free Settings panel."
  },
  "settings_all_data_stored_locally_no": {
    "message": "All data stored locally. No tracking.",
    "description": "Text on the settings surface."
  },
  "settings_appearance": {
    "message": "Appearance",
    "description": "Text on the settings surface."
  },
  "settings_automatic_weekly_backup": {
    "message": "Automatic weekly backup",
    "description": "Text on the settings surface."
  },
  "settings_backup": {
    "message": "Backup",
    "description": "Text on the settings surface."
  },
  "settings_backups_include_your_shortcuts_groups": {
    "message": "Backups include your shortcuts, groups, settings, wallpaper, notes, tasks, licence key, and your tracked focus history. Stored locally on your device only.",
    "description": "Text on the settings surface."
  },
  "settings_change": {
    "message": "Change",
    "description": "Text on the settings surface."
  },
  "settings_data": {
    "message": "Data",
    "description": "Text on the settings surface."
  },

  "settings_alias_look": {
    "message": "appearance theme look icons text size layout grid compact list focus view notes paper colour color",
    "description": "SEARCH ALIASES, never rendered. Space-separated words a user might TYPE to find a row in the Appearance tile of Settings, matched in addition to each row's own visible label. Translate to the words a speaker of your language would actually type, not word-for-word: the point is recall, so include the common misnomer and the alternative spelling. Order and punctuation are irrelevant."
  },
  "settings_alias_wallpaper": {
    "message": "wallpaper background image photo picture rotate rotation dim dimming brightness",
    "description": "SEARCH ALIASES, never rendered. Typed words that should find the Wallpaper tile's rows in Settings. See settings_alias_look for how to translate an alias list."
  },
  "settings_alias_pro": {
    "message": "pro subscription licence license key plan billing upgrade trial account",
    "description": "SEARCH ALIASES, never rendered. Typed words that should find the Pro tile's rows in Settings. See settings_alias_look."
  },
  "settings_alias_tags": {
    "message": "tags tag labels colours colors trash",
    "description": "SEARCH ALIASES, never rendered. Typed words that should find the Tags tile's rows in Settings. See settings_alias_look."
  },
  "settings_alias_focus": {
    "message": "focus sessions session pomodoro timer countdown work break chime sound notification duration length",
    "description": "SEARCH ALIASES, never rendered. Typed words that should find the Focus sessions tile's rows in Settings. 'pomodoro' and 'timer' are the words users reach for and the product deliberately does not use on the surface, which is exactly why they belong here. See settings_alias_look."
  },
  "settings_alias_blocking": {
    "message": "focus blocking block blocked sites distraction distractions allow deny schedule budget friction",
    "description": "SEARCH ALIASES, never rendered. Typed words that should find the Focus blocking tile's rows in Settings. See settings_alias_look."
  },
  "settings_alias_workspaces": {
    "message": "workspaces workspace mode work casual switch profile",
    "description": "SEARCH ALIASES, never rendered. Typed words that should find the Workspaces tile's rows in Settings. See settings_alias_look."
  },
  "settings_alias_data": {
    "message": "data backup export import restore download json reset erase delete storage",
    "description": "SEARCH ALIASES, never rendered. Typed words that should find the Data tile's rows in Settings. See settings_alias_look."
  },
  "settings_export_backup": {
    "message": "Export backup",
    "description": "Text on the settings surface."
  },
  "settings_icon_size": {
    "message": "Icon Size",
    "description": "Text on the settings surface."
  },
  "settings_iconsize_large": {
    "message": "Large",
    "description": "ICON SIZE option. Independent of the text-size control with the same word.",
    "sense": "size.icon"
  },
  "settings_iconsize_medium": {
    "message": "Medium",
    "description": "ICON SIZE option. Independent of the text-size control with the same word.",
    "sense": "size.icon"
  },
  "settings_iconsize_small": {
    "message": "Small",
    "description": "ICON SIZE option. Independent of the text-size control with the same word.",
    "sense": "size.icon"
  },
  "settings_import_backup": {
    "message": "Import backup",
    "description": "Text on the settings surface."
  },
  "settings_import_chrome_bookmarks": {
    "message": "Import Chrome Bookmarks",
    "description": "Text on the settings surface."
  },
  "settings_text_size": {
    "message": "Text Size",
    "description": "Text on the settings surface."
  },
  "settings_textsize_large": {
    "message": "Large",
    "description": "TEXT SIZE option. Independent of the icon-size control with the same word.",
    "sense": "size.text"
  },
  "settings_textsize_medium": {
    "message": "Medium",
    "description": "TEXT SIZE option. Independent of the icon-size control with the same word.",
    "sense": "size.text"
  },
  "settings_textsize_small": {
    "message": "Small",
    "description": "TEXT SIZE option. Independent of the icon-size control with the same word.",
    "sense": "size.text"
  },
  "settings_dim_wallpaper": {
    "message": "Dim wallpaper",
    "description": "Label for the Settings range control that darkens the wallpaper behind the page. Sentence case, like every other settings label. Rendered by the data-i18n DOM pass."
  },
  "settings_rotate_wallpaper": {
    "message": "Rotate wallpaper",
    "description": "Settings row label for automatic wallpaper rotation."
  },
  "settings_rotate_off": {
    "message": "Off",
    "sense": "state.rotation",
    "description": "Wallpaper rotation disabled. The default, and the first segment of the three-way control. NOT the focus-blocking Off (dash_blocking_off), which is a different control on a different surface."
  },
  "settings_rotate_day": {
    "message": "Daily",
    "description": "Wallpaper rotation: change the picture once a day. One segment of a three-way control, so it is one word to match Small/Medium/Large and Grid/Compact/List beside it."
  },
  "settings_rotate_hour": {
    "message": "Hourly",
    "description": "Wallpaper rotation: change the picture every hour. One segment of a three-way control."
  },
  "settings_wallpaper_this_workspace": {
    "message": "Just for this workspace",
    "description": "Settings checkbox: give the current workspace its own wallpaper instead of using the global one. Pro."
  },
  "wallpaper_note_ws_overrides_rotation": {
    "message": "This workspace has its own wallpaper, so rotation does not apply here. Other workspaces still rotate.",
    "description": "Shown when a per-workspace wallpaper and rotation are both set, so the user is told which one wins rather than reading it as a bug."
  },
  "wallpaper_note_rotating": {
    "message": "The wallpaper changes automatically. Picking one for a workspace stops it changing there.",
    "description": "Shown when rotation is on and no per-workspace wallpaper is set."
  },
  "wallpaper_too_large": {
    "message": "There is not enough browser storage for that wallpaper. Nothing was changed. Try a smaller image, or remove a wallpaper from another workspace.",
    "description": "Refusal shown BEFORE any write when a wallpaper would push storage past its safe ceiling."
  },
  "wallpaper_write_failed": {
    "message": "That wallpaper could not be saved. Nothing was changed.",
    "description": "Shown when the wallpaper write was refused by the browser."
  },
  "settings_wallpaper": {
    "message": "Wallpaper",
    "description": "Text on the settings surface."
  },
  "shortcutmodal_url_label": {
    "message": "URL",
    "description": "Form FIELD LABEL for the shortcut address input.",
    "sense": "form.label"
  },
  "sidebar_expand_all": {
    "message": "Expand all",
    "description": "Text on the sidebar surface."
  },
  "sidebar_workspace": {
    "message": "Workspace",
    "description": "title attribute on the sidebar surface."
  },
  "tabbar_dashboard": {
    "message": "Dashboard",
    "description": "Text on the tabbar surface."
  },
  "tabbar_home": {
    "message": "Home",
    "description": "Text on the tabbar surface."
  },
  "tabbar_insights": {
    "message": "Insights",
    "description": "Text on the tabbar surface."
  },
  "tabbar_launchpad_sections": {
    "message": "LaunchPad sections",
    "description": "aria-label attribute on the tabbar surface."
  },
  "tabbar_tasks": {
    "message": "Tasks",
    "description": "The Tasks TAB LABEL in the tab bar. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "tabbar_upgrade_to_pro": {
    "message": "Upgrade to Pro",
    "description": "aria-label attribute on the tabbar surface."
  },
  "tag_create_name_placeholder": {
    "message": "Tag name",
    "description": "Names the \"Tag name\" feature wherever it appears. Shared by 2 sinks: newtab.html:390 attr:placeholder, newtab.html:757 attr:placeholder.",
    "sense": "feature.name"
  },
  "tagmenu_create_new_tag": {
    "message": "Create new tag...",
    "description": "Text on the tagmenu surface."
  },
  "tagpopover_new_tag": {
    "message": "New tag",
    "description": "Text on the tagpopover surface."
  },
  "tips_launchpad_pro_is_on_the": {
    "message": "LaunchPad Pro is on the way. Focus tracking, goals, and more.",
    "description": "Text on the tips surface."
  },
  "tips_restore_examples": {
    "message": "Restore examples",
    "description": "Text on the tips surface."
  },
  "variantmenu_change_icon": {
    "message": "Change icon",
    "description": "Text on the variantmenu surface."
  },
  "variantmenu_ungroup": {
    "message": "Ungroup",
    "description": "Text on the variantmenu surface."
  }
});


// ======================================================================
// [1.5.0] R3 - JS BUILDER LABELS.
//
// These reach the DOM through builder functions rather than static markup,
// so they carry no fallback: a missing key renders the key on screen. Each
// is a MARKUP sink and is read with th(), never t().
// ======================================================================
I18n.register("en", {
  "tasks_new_goal": {
    "message": "Goal",
    "description": "The Goal item in the Tasks tab's New menu. Replaced tasks_action_new_goal (\"+ New Goal\"): the plus belonged to a row of four equal buttons that H1b collapsed into one action plus this menu, and a menu item names the thing while the menu it sits in already says New. The Recurring and Tag items reuse tasks_recurring and tasks_tag rather than taking keys of their own. Rendered with th()."
  },
  "tasks_new_menu": {
    "message": "New",
    "description": "The Tasks tab's secondary create button, which opens a menu of Goal / Recurring / Tag. A chevron sits beside it in the markup, so the word is the whole label. It took the slot of tasks_action_new_task (\"+ New Task\"), retired because the primary create button now renders new_new_task (\"New task\"), which is the string the rest of the product already uses for the same act. Rendered with th()."
  },
  "tasks_tile_overdue_oldest": {
    "message": "{name} is oldest",
    "description": "Sub-line on the Tasks tab's OVERDUE count tile, naming the overdue task whose due date is furthest in the past. Absent entirely when nothing is overdue, rather than saying so. {name} is a task name, already escaped by the caller. Rendered with th()."
  },
  "tasks_tile_goals_sub": {
    "message": "{complete} complete · {open} open tasks",
    "description": "Sub-line on the Tasks tab's GOALS count tile. {complete} is the number of completed goals in this workspace, {open} the number of open tasks across it. Rendered with th()."
  },
  "tasks_tile_recurring_next": {
    "message": "{name} next",
    "description": "Sub-line on the Tasks tab's RECURRING count tile, naming the template due to materialise soonest. Absent when no template carries a next date. {name} is a template name, already escaped by the caller. Rendered with th()."
  },
  "goal_progress_aria": {
    "message": "{done} of {total} tasks complete",
    "description": "Accessible name for the goal header's progress bar. H1b moved the bar into the header row and dropped the percentage that used to be written inside the fill, so this carries what a screen reader would otherwise have lost - and it says tasks, which the visible \"2 of 5\" beside it cannot. Rendered through t() into an aria-label."
  },
  "common_of": {
    "message": "of",
    "description": "The word between two numbers in the goal header's progress count - \"2 of 5\". Its own key rather than a literal because the two numbers are placed by the markup and a translation may need a different word, or a different order, between them. Rendered with th()."
  },
  "tasks_action_templates": {
    "message": "Templates",
    "description": "Link to the goal-templates panel, in the Tasks tab header."
  },
  "tasks_filter_bar_aria": {
    "message": "Task filters",
    "description": "Accessible name of the Tasks tab's filter toolbar."
  },
  "tasks_filter_sort_aria": {
    "message": "Sort by",
    "description": "Accessible name of the task sort <select> on the Tasks tab."
  },
  "tasks_filter_status_aria": {
    "message": "Status filter",
    "description": "Accessible name of the task status <select> on the Tasks tab."
  },
  "tasks_sort_created": {
    "message": "Sort: created",
    "description": "Task sort option. The 'Sort:' prefix is part of the visible option text."
  },
  "tasks_sort_due": {
    "message": "Sort: due",
    "description": "Task sort option."
  },
  "tasks_sort_name": {
    "message": "Sort: name",
    "description": "Task sort option."
  },
  "tasks_sort_priority": {
    "message": "Sort: priority",
    "description": "Task sort option."
  },
  "tasks_status_active": {
    "message": "Active",
    "description": "Task STATUS filter option. Not the history panel's 'All'-style filter, and not an active-task indicator."
  },

  "tasks_status_completed": {
    "message": "Completed",
    "sense": "option.filter",
    "description": "Task STATUS filter option on the Tasks tab."
  }
});


// ======================================================================
// [1.5.0] R3 - PANEL HEADINGS, split from their sidebar labels.
//
// Each carries the same English text as the sidebar label that opens it,
// and is a separate key on purpose: the label is width-constrained and the
// heading is not. A translator may need different lengths, and only two
// keys can express that.
// ======================================================================
I18n.register("en", {
  "history_panel_heading": {
    "message": "History",
    "description": "Heading of the History panel. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "import_panel_heading": {
    "message": "Import",
    "description": "Heading of the Import panel. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "prosettings_panel_heading": {
    "message": "Pro Settings",
    "description": "Heading of the Pro Settings panel. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "restore_panel_heading": {
    "message": "Restore Session",
    "description": "Heading of the Restore Session flyout, the AUTOMATIC five-minute restore. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "sessions_panel_heading": {
    "message": "Sessions",
    "description": "Heading of the NAMED sessions flyout. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "settings_panel_heading": {
    "message": "Settings",
    "description": "Heading of the Settings panel. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "tasks_header_title": {
    "message": "Tasks",
    "description": "Heading of the Tasks page. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  },
  "tips_panel_heading": {
    "message": "Tips",
    "description": "Heading of the Tips panel. Separate key from the sidebar label carrying the same English text. A sidebar label is WIDTH-CONSTRAINED and a panel heading is not, so a translator may need different lengths for them, and that is their call to make. Two keys can carry one value; one key cannot carry two."
  }
});


// ====================================================================
// [1.5.0] R3 stage A - toast,native-dlg
// ====================================================================
I18n.register("en", {
  "add_group_name": {
    "message": "Group name:",
    "description": "Text sink in addGroup(). Rendered with t()."
  },
  "add_this_workspace_is_read_only": {
    "message": "This workspace is read-only.",
    "description": "Text sink in addGroup(). Rendered with t()."
  },
  "apply_license_applied_pro_features_now_active": {
    "message": "License applied. Pro features now active.",
    "description": "Text sink in applyLicenseFromPopover(). Rendered with t()."
  },
  "backup_could_not_read_file": {
    "message": "Could not read file",
    "description": "Text sink in handleBackupFile(). Rendered with t()."
  },
  "backup_invalid_backup_file": {
    "message": "Invalid backup file",
    "description": "Text sink in handleBackupFile(). Rendered with t()."
  },
  "backup_this_backup_file_is_empty_or": {
    "message": "This backup file is empty or corrupted. Nothing to import.",
    "description": "Text sink in handleBackupFile(). Rendered with t()."
  },
  "backup_this_doesn_t_look_like_a": {
    "message": "This doesn't look like a LaunchPad backup file",
    "description": "Text sink in handleBackupFile(). Rendered with t()."
  },
  "bind_focus_cycle_count_reset": {
    "message": "Focus cycle count reset.",
    "description": "Text sink in bindProSettings(). Rendered with t()."
  },
  "create_workspace_created": {
    "message": "Workspace created",
    "description": "Text sink in createWorkspace(). Rendered with t()."
  },
  "create_workspace_name_required": {
    "message": "Workspace name required",
    "description": "Text sink in createWorkspace(). Rendered with t()."
  },
  "delete_deleted_restore_from_trash_within_30": {
    "message": "Deleted. Restore from Trash within 30 days.",
    "description": "Text sink in deleteTaskWithUndo(). Rendered with t()."
  },
  "delete_workspace_deleted": {
    "message": "Workspace deleted",
    "description": "Text sink in deleteWorkspace(). Rendered with t()."
  },
  "delete_you_need_at_least_one_workspace": {
    "message": "You need at least one workspace",
    "description": "Text sink in deleteWorkspace(). Rendered with t()."
  },
  "export_backup_downloaded": {
    "message": "Backup downloaded",
    "description": "Text sink in exportBackup(). Rendered with t()."
  },
  "group_rename_group": {
    "message": "Rename group:",
    "description": "Text sink in handleGroupMenuAction(). Rendered with t()."
  },
  "launch_that_session_could_not_be_opened": {
    "message": "That session could not be opened.",
    "description": "Text sink in launchNamedSession(). Rendered with t()."
  },
  "license_enter_a_license_key_first": {
    "message": "Enter a license key first.",
    "description": "Text sink in handleLicenseApply(). Rendered with t()."
  },
  "license_license_applied_pro_features_now_active": {
    "message": "License applied. Pro features now active.",
    "description": "Text sink in handleLicenseApply(). Rendered with t()."
  },
  "license_license_cleared": {
    "message": "License cleared.",
    "description": "Text sink in handleLicenseClear(). Rendered with t()."
  },
  "license_license_key_not_recognized": {
    "message": "License key not recognized.",
    "description": "Text sink in handleLicenseApply(). Rendered with t()."
  },
  "license_no_license_to_clear": {
    "message": "No license to clear.",
    "description": "Text sink in handleLicenseClear(). Rendered with t()."
  },
  "pro_workspace_name_required": {
    "message": "Workspace name required",
    "description": "Text sink in renderProWorkspaceList(). Rendered with t()."
  },
  "pro_you_need_at_least_one_workspace": {
    "message": "You need at least one workspace",
    "description": "Text sink in renderProWorkspaceList(). Rendered with t()."
  },
  "read_upgrade_flow_coming_soon": {
    "message": "Upgrade flow coming soon",
    "description": "Text sink in renderReadOnlyBanner(). Rendered with t()."
  },
  "run_moved_to_completed": {
    "message": "✓ Moved to Completed",
    "description": "Text sink in runTaskCompletionCelebration(). Rendered with t()."
  },
  "run_task_completed": {
    "message": "✓ Task completed",
    "description": "Text sink in runTaskCompletionCelebration(). Rendered with t()."
  },
  "sat_focus_session_ended_while_you_were": {
    "message": "Focus session ended while you were away.",
    "description": "Text sink in satMaybeReconcile(). Rendered with t()."
  },
  "sat_session_complete_ready_for_another": {
    "message": "Session complete. Ready for another?",
    "description": "Text sink in satMaybeReconcile(). Rendered with t()."
  },
  "save_name_this_session": {
    "message": "Name this session:",
    "description": "Text sink in saveCurrentTabsAsSession(). Rendered with t()."
  },
  "save_nothing_here_can_be_saved_a": {
    "message": "Nothing here can be saved. A session needs at least one web page open.",
    "description": "Text sink in saveCurrentTabsAsSession(). Rendered with t()."
  },
  "session_nothing_here_can_be_saved_a": {
    "message": "Nothing here can be saved. A session needs at least one web page open.",
    "description": "Text sink in handleSessionCtxAction(). Rendered with t()."
  },
  "session_rename_session": {
    "message": "Rename session:",
    "description": "Text sink in handleSessionCtxAction(). Rendered with t()."
  },
  "sessions_session_restored": {
    "message": "Session restored.",
    "description": "Text sink in openSessionsTrashView(). Rendered with t()."
  },
  "tag_could_not_create_tag": {
    "message": "Could not create tag.",
    "description": "Text sink in commitTagCreate(). Rendered with t()."
  },
  "tag_could_not_create_tag_2": {
    "message": "Could not create tag.",
    "description": "Text sink in commitTagCreatePopover(). Rendered with t()."
  },
  "upgrade_trial_started_pro_features_unlocked_for": {
    "message": "Trial started. Pro features unlocked for 7 days.",
    "description": "Text sink in openUpgradePopover(). Rendered with t()."
  },
  "variant_rename_variant": {
    "message": "Rename variant:",
    "description": "Text sink in handleVariantCtxAction(). Rendered with t()."
  },
  "workspace_workspace_name_required": {
    "message": "Workspace name required",
    "description": "Text sink in buildWorkspaceDropdownBody(). Rendered with t()."
  }
});


// ====================================================================
// [1.5.0] R3 stage B - modal-copy
// ====================================================================
I18n.register("en", {
  "apply_move_just_this_instance": {
    "message": "Move just this instance",
    "description": "Text sink in apply(). Rendered with t()."
  },
  "apply_move_recurring_task": {
    "message": "Move recurring task",
    "description": "Text sink in apply(). Rendered with t()."
  },
  "apply_move_the_template_into_this_goal": {
    "message": "Move the template into this goal",
    "description": "Text sink in apply(). Rendered with t()."
  },
  "badge_consistency": {
    "message": "Consistency",
    "description": "Text sink in renderBadgeGlyph(). Rendered with t()."
  },
  "badge_curator": {
    "message": "Curator",
    "description": "Text sink in renderBadgeGlyph(). Rendered with t()."
  },
  "badge_deep_diver": {
    "message": "Deep Diver",
    "description": "Text sink in renderBadgeGlyph(). Rendered with t()."
  },
  "badge_first_week": {
    "message": "First Week",
    "description": "Text sink in renderBadgeGlyph(). Rendered with t()."
  },
  "badge_goal_crusher": {
    "message": "Goal Crusher",
    "description": "Text sink in renderBadgeGlyph(). Rendered with t()."
  },
  "badge_variety": {
    "message": "Variety",
    "description": "Text sink in renderBadgeGlyph(). Rendered with t()."
  },
  "clear_move_to_deleted": {
    "message": "Move to Deleted",
    "description": "Text sink in confirmClearCompleted(). Rendered with t()."
  },
  "dash_consistency": {
    "message": "Consistency",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_curator": {
    "message": "Curator",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_deep_diver": {
    "message": "Deep Diver",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_distractions_blocked": {
    "message": "Distractions blocked",
    "description": "Text sink in dashStripHtml(). Rendered with t()."
  },
  "dash_first_week": {
    "message": "First Week",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_focus_blocking": {
    "message": "Focus blocking",
    "description": "Text sink in dashStripHtml(). Rendered with t()."
  },
  "dash_fri": {
    "message": "Fri",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_goal_crusher": {
    "message": "Goal Crusher",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_mon": {
    "message": "Mon",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_sat": {
    "message": "Sat",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_sun": {
    "message": "Sun",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_this_week_so_far": {
    "message": "This week so far",
    "description": "Label under the running focused-time total for the current calendar week, in the Dashboard hero band's right region beside the day streak. PRESENT STATE, never a comparison: there is deliberately no 'vs last week' here, because week-versus-last is a past-tense reading that belongs to Insights."
  },
  "dash_todays_three": {
    "message": "Today's three",
    "description": "Section heading for the up-to-three tasks the user has deliberately picked to headline today, leading the Dashboard's Today module above the automatic due-today list."
  },
  "dash_three_pick": {
    "message": "Pick",
    "description": "Button on the Today's three section header that opens the task picker. Hidden once three are picked, because there is nothing left to add."
  },
  "dash_evening_finished": {
    "message": "Finished today",
    "description": "Label under the count of tasks completed today, in the Dashboard's EVENING hero centre. STATED AS FACT, never as praise or reproach: the evening band closes the day honestly and must not push the user back to work, so this is a reading and not a score."
  },
  "dash_evening_still_open": {
    "message": "Still open",
    "description": "Label under the count of tasks still due today, in the Dashboard's EVENING hero centre. Deliberately neutral: 'Still open' reports the board, where 'remaining' or 'outstanding' would imply an obligation the evening state exists not to press."
  },
  "dash_three_toast_one": {
    "message": "Added to today's three",
    "description": "Toast shown when the Today's three picker closes after ONE task was picked. Confirms a deliberate, persisted, per-day choice; the picker stays open across picks so this fires once per session rather than once per pick."
  },
  "dash_three_toast_many": {
    "message": "{count} added to today's three",
    "description": "Toast shown when the Today's three picker closes after two or three tasks were picked. {count} is the number picked in that session. One toast per session, never one per pick, per the quiet-by-default rule."
  },
  "dash_three_toast_failed": {
    "message": "That pick could not be saved.",
    "description": "Toast shown when Storage.setTodaysThree REFUSES a pick. Previously the handler discarded the writer's boolean and closed regardless, so a refused write was invisible to the user and to the console. States the fact plainly without blaming the user; the console carries the reason."
  },
  "dash_three_empty": {
    "message": "Nothing picked yet.",
    "description": "Empty state for Today's three, shown when the user has picked nothing for the current local day. STATE THE CONDITION ONLY, NEVER THE ACTION: [1.7.4] renders a 'Pick up to three' button (dash_three_pick_inline) immediately after this string on the same line, so any call to action added here renders TWICE. That is the duplication [1.6.5] shipped on dash_no_active_goals one arc earlier. An invitation, not a reprimand: picking nothing is a legitimate choice."
  },
  "dash_three_pick_inline": {
    "message": "Pick up to three",
    "description": "Inline link after the Today's three empty state, opening the task picker. It is the ONLY affordance in that state: [1.7.4] removed the section heading and its hairline when nothing is picked, because an empty section does not earn furniture to announce its emptiness."
  },
  "dash_three_remove": {
    "message": "Remove from today's three",
    "description": "Tooltip on the small x that drops one task from Today's three. Removing a pick does not complete or delete the task."
  },
  "dash_three_remove_aria": {
    "message": "Remove {taskName} from today's three",
    "description": "Accessible name for the x that drops one task from Today's three. {taskName} is the user's task title. Uses the catalogue's own {name} interpolation, not the Chrome $NAME$ placeholder form, matching dash_due_complete_task_aria on the row beside it."
  },
  "dash_three_pick_title": {
    "message": "Pick a task for today",
    "description": "Title of the modal that picks one task into Today's three. Singular because the modal adds one at a time and closes."
  },
  "dash_three_search": {
    "message": "Search tasks",
    "description": "Placeholder for the search field in the Today's three picker modal."
  },
  "dash_three_no_tasks": {
    "message": "No tasks left to pick in this workspace.",
    "description": "Shown in the Today's three picker when every open task is already picked, or the workspace has no open tasks. Rendered with th()."
  },
  "dash_session_paused": {
    "message": "Paused",
    "description": "The phase word on the Dashboard hero's running-session block while tracking is paused. Replaces the phase name (Focus / Short break / Long break). The ring beside it goes amber and is the ONE amber signal on this surface, per [1.9.4] finding 5. Rendered with t()."
  },
  "dash_tasks_completed": {
    "message": "Tasks completed",
    "description": "Text sink in dashStripHtml(). Rendered with t()."
  },
  "dash_thu": {
    "message": "Thu",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_tue": {
    "message": "Tue",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_variety": {
    "message": "Variety",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_wed": {
    "message": "Wed",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "empty_delete_permanently": {
    "message": "Delete permanently",
    "description": "Text sink in confirmEmptyTrash(). Rendered with t()."
  },
  "empty_empty_the_notes_trash": {
    "message": "Empty the notes trash?",
    "description": "Text sink in confirmEmptyNotesTrash(). Rendered with t()."
  },
  "empty_empty_the_sessions_trash": {
    "message": "Empty the sessions trash?",
    "description": "Text sink in confirmEmptySessionsTrash(). Rendered with t()."
  },
  "empty_empty_trash": {
    "message": "Empty trash",
    "description": "Text sink in confirmEmptyNotesTrash(). Rendered with t()."
  },
  "empty_empty_trash_2": {
    "message": "Empty trash?",
    "description": "Text sink in confirmEmptyTrash(). Rendered with t()."
  },
  "empty_empty_trash_3": {
    "message": "Empty trash",
    "description": "Text sink in confirmEmptySessionsTrash(). Rendered with t()."
  },
  "goal_complete_goal": {
    "message": "Complete goal",
    "description": "Text sink in openGoalContextMenu(). Rendered with t()."
  },
  "goal_complete_this_goal": {
    "message": "Complete this goal?",
    "description": "Text sink in openGoalContextMenu(). Rendered with t()."
  },
  "goal_delete_goal": {
    "message": "Delete goal?",
    "description": "Text sink in openGoalContextMenu(). Rendered with t()."
  },
  "insights_daily_avg": {
    "message": "Daily avg",
    "description": "Text sink in insightsStripHtml(). Rendered with t()."
  },
  "preview_yours_title": {
    "message": "This is yours - free, local, no account.",
    "description": "THE EYEBROW ON THE ONE LIVE TILE OF THE FREE DASHBOARD, above the user's own time-by-site card. It is the only thing on that surface built from their real data, and the sentence exists to say so before the demo beside it can be mistaken for theirs. Three claims, each literally true and each one the product can be held to: the card is theirs, the tier is free, and nothing left the device. Rendered with th()."
  },
  "preview_pitch_headline": {
    "message": "Pro adds the rest",
    "description": "The headline on the free Dashboard's one action tile - the pitch. Deliberately small and flat: the demo column beside it is the argument, and this line only names what the column is. It must not promise a specific feature, because the demo already shows them and a second list would drift from it. Rendered with th()."
  },
  "preview_pitch_trial": {
    "message": "7 days free. No card.",
    "description": "The sub-line on the free Dashboard's pitch tile, directly above its one button. The two facts a reader needs before pressing it, and both are enforced elsewhere: the trial is 7 days and it takes no payment method. If either ever changes this string is the first thing to fix. Rendered with th()."
  },
  "preview_demo_column_title": {
    "message": "With Pro, a day looks like this",
    "description": "The heading above the DEMO half of the free Dashboard. \"A day\", never \"your day\": the figures below it are invented, and a possessive would make the heading itself the lie every card under it is labelled to prevent. Rendered with th()."
  },
  "preview_example_data": {
    "message": "Preview - example data",
    "description": "THE SELF-LABEL ON EVERY DEMO CARD, on all three free-preview surfaces - Tasks, Dashboard and Insights. It was insights_preview_history and it labelled one row on one surface; it is renamed because the key now names what it IS rather than where it happened to sit. The sentence must stay short enough to ride on a card title's own line beside the title. Rendered with th()."
  },
  "insights_preview_best_day": {
    "message": "best day",
    "description": "Aside label on the Insights preview hero. Rendered with th()."
  },
  "insights_preview_by_site": {
    "message": "Time by site - last 30 days",
    "description": "Peer card title on the Insights preview. Site rows carry NO favicons here either. Rendered with th()."
  },
  "insights_preview_top_tasks": {
    "message": "Top tasks - last 30 days",
    "description": "Peer card title on the Insights preview. Rendered with th()."
  },
  "insights_wk_preview_span": {
    "message": "Mon-Fri, against the same days last week",
    "description": "Span caption on the weekly card in the Insights PREVIEW. Rendered with th()."
  },
  "insights_wk_preview_task": {
    "message": "Ship the Q3 report",
    "description": "Demo top task on the Insights preview weekly card. Rendered with th()."
  },
  "insights_wk_preview_tag": {
    "message": "deep work",
    "description": "Demo top tag on the Insights preview weekly card. Rendered with th()."
  },
  "insights_heat_title": {
    "message": "Best focus hours",
    "description": "Title of the [1.8.5] hour-by-weekday heatmap on Insights. Rendered with th()."
  },
  "insights_heat_none": {
    "message": "No hour-level history yet. Hours are recorded from now on.",
    "description": "Shown when NO day in the range has complete hourly data - a profile that predates [1.8.2]'s capture. Says what will happen rather than only what is missing. Rendered with th()."
  },
  "insights_heat_full": {
    "message": "{shown} days, hours known for all of them",
    "description": "Heatmap caption when every day in the range has complete hourly data. Rendered with t()."
  },
  "insights_heat_partial": {
    "message": "{shown} days shown; {dropped} left out because their hours were not recorded (hours known from {since})",
    "description": "Heatmap caption when days were EXCLUDED. Days without complete hourly data are dropped rather than drawn empty, because an empty cell would assert that no work happened at that hour when the truth is that it was not recorded. The caption is what stops that exclusion being silent. Rendered with t()."
  },
  "insights_export": {
    "message": "Export CSV",
    "description": "The [1.8.4] export control on the Insights range row. Exports the SELECTED range. Rendered with th()."
  },
  "insights_export_done": {
    "message": "Focus data exported.",
    "description": "Toast after the CSV export downloads. Rendered with t()."
  },
  "insights_export_failed": {
    "message": "Export failed - the focus history could not be read.",
    "description": "Toast when the export's reads throw. Rendered with t()."
  },
  "insights_export_nothing": {
    "message": "Nothing to export - tracking is off for this workspace.",
    "description": "Toast when export is pressed with no tracking scope. Rendered with t()."
  },
  "insights_wk_title": {
    "message": "This week vs last",
    "description": "Title of the [1.8.3] weekly review card on Insights. Rendered with th()."
  },
  "insights_wk_span_one": {
    "message": "{day}, against the same day last week",
    "description": "Span caption on the weekly review card when the week is one day old (a Monday). Names WHICH days are being compared, because a like-for-like comparison over one day is a different claim from one over seven. Rendered with t()."
  },
  "insights_wk_span_many": {
    "message": "{from}-{to}, against the same days last week",
    "description": "Span caption on the weekly review card. The comparison is like-for-like: this week's elapsed days against the SAME days of last week, never a partial week against a whole one. Rendered with t()."
  },
  "insights_wk_no_prior": {
    "message": "no last week yet",
    "description": "Shown in place of the comparison on the weekly review card when no previous week exists at all. Deliberately not a 100% drop - there is nothing to compare to, which is different from having done less. Rendered with th()."
  },
  "icon_change_icon": {
    "message": "Change icon",
    "description": "Button in the Edit shortcut modal's Icon row. Opens the same icon picker the tile's more-menu opens, so both surfaces drive one mechanism. Rendered by the data-i18n pass."
  },
  "icon_choose_an_icon": {
    "message": "Choose an icon",
    "description": "Title of the custom-icon picker, opened by shift-clicking a shortcut's icon. Rendered with th()."
  },
  "icon_upload_an_image": {
    "message": "Upload an image",
    "description": "Picker button that opens a file chooser. The image is downscaled to 128x128 WEBP on the way in rather than stored at its original size - a raw 512px PNG is 715 KB and only fourteen would fit in the whole extension quota. Rendered with th()."
  },
  "icon_use_a_letter": {
    "message": "Use a letter",
    "description": "Picker button that makes a lettered tile in the accent colour from the shortcut's first character. Rendered with th()."
  },
  "icon_or_pick_an_emoji": {
    "message": "Or pick an emoji",
    "description": "Label above the emoji row in the icon picker. Rendered with th()."
  },
  "icon_remove_custom_icon": {
    "message": "Remove custom icon",
    "description": "Picker button, shown only when a custom icon is set. Removing restores the site's favicon rather than leaving a blank tile. Rendered with th()."
  },
  "icon_too_large": {
    "message": "That image is still over {kb} KB after resizing. Try a simpler one.",
    "description": "Shown when an uploaded icon exceeds the per-icon cap even after downscaling. The cap is a backstop rather than the main control: chrome.storage writes the whole data object every time, and an over-quota write is silently dropped, so an oversized icon is refused honestly here instead. Rendered with t()."
  },
  "storage_full_change_not_saved": {
    "message": "Chrome's storage is full, so that change was not saved. Remove a few custom icons, wallpapers or old sessions to free up room.",
    "description": "[1.10.3] Shown when a write to chrome.storage.local is rejected for quota. The page has already dropped back to the last saved state by the time this appears, so the past tense is literal rather than a warning about the future: the change is gone, not at risk. It names the three things a user can actually delete to recover space; a bare 'storage is full' leaves them with no move. Rendered with t()."
  },
  "storage_write_failed": {
    "message": "That change could not be saved. LaunchPad has gone back to the last saved version.",
    "description": "[1.10.3] Shown when a write fails for a reason that is NOT the quota: an I/O error, a corrupt profile, an extension being updated underneath the page. Deliberately does not guess at a cause the code does not know, but does state the consequence, because the page has just re-rendered underneath the user and an unexplained visual revert is worse than a vague one. Rendered with t()."
  },
  "storage_nearly_full": {
    "message": "LaunchPad is using {pct}% of Chrome's storage. Remove a few custom icons, wallpapers or old sessions before new changes stop saving.",
    "description": "[1.10.3] The PROACTIVE warning, shown on open at most once a day once usage crosses 80% of the 10 MB chrome.storage.local quota. Distinct from storage_full_change_not_saved in tense and in stakes: nothing has been lost yet, and the whole value of the message is that it arrives while the user can still act. {pct} is a whole number already rounded by the caller. Rendered with t()."
  },
  "icon_could_not_be_set": {
    "message": "That icon could not be set.",
    "description": "Shown when reading or decoding an uploaded image fails. Rendered with t()."
  },
  "clock_good_morning": {
    "message": "Good morning",
    "description": "Greeting on the Home greeting line, above the logo, before noon. Always shown - there is no setting. The browser's own time zone decides which of the three applies. Rendered with t()."
  },
  "clock_good_afternoon": {
    "message": "Good afternoon",
    "description": "Greeting on the Home greeting line, above the logo, noon to 18:00. Always shown - there is no setting. Rendered with t()."
  },
  "clock_good_evening": {
    "message": "Good evening",
    "description": "Greeting on the Home greeting line, above the logo, from 18:00. Always shown - there is no setting. Rendered with t()."
  },
  "greeting_v1_morning": {
    "message": "Morning",
    "description": "Greeting ladder rung 1, before noon. The same greeting clipped shorter."
  },
  "greeting_v1_afternoon": {
    "message": "Afternoon",
    "description": "Greeting ladder rung 1, noon to 18:00."
  },
  "greeting_v1_evening": {
    "message": "Evening",
    "description": "Greeting ladder rung 1, from 18:00."
  },
  "greeting_v2_morning": {
    "message": "Another morning",
    "description": "Greeting ladder rung 2, before noon. Observational rather than welcoming."
  },
  "greeting_v2_afternoon": {
    "message": "Afternoon again",
    "description": "Greeting ladder rung 2, noon to 18:00."
  },
  "greeting_v2_evening": {
    "message": "Late one",
    "description": "Greeting ladder rung 2, from 18:00. Samson's own line."
  },
  "greeting_v_back_again": {
    "message": "Back again",
    "description": "Greeting ladder rung 3, the first shared rung. Dry acknowledgement, not a welcome."
  },
  "greeting_v_still_here": {
    "message": "Still here",
    "description": "Greeting ladder rung 4. A statement, not a question - 'Still here?' would sound plaintive."
  },
  "greeting_v_hello_again": {
    "message": "Hello again",
    "description": "Greeting ladder rung 5. Flat politeness."
  },
  "greeting_v_done_this_one": {
    "message": "We have done this one",
    "description": "Greeting ladder rung 6. The line notices it is repeating itself."
  },
  "greeting_v_running_low": {
    "message": "Running low",
    "description": "Greeting ladder rung 7. Deadpan admission that the supply is finite."
  },
  "greeting_v_last_of_them": {
    "message": "That was the last of them",
    "description": "Greeting ladder rung 8. Stated as fact, with seven rungs still to come, which is the joke."
  },
  "greeting_v_just_clicking": {
    "message": "Now we are just clicking",
    "description": "Greeting ladder rung 9. Names what is happening without objecting to it."
  },
  "greeting_v_still_clicking": {
    "message": "Still clicking",
    "description": "Greeting ladder rung 10. Shorter than the rung before it - the voice is running down, not complaining."
  },
  "greeting_v_date_correct": {
    "message": "The date is still correct",
    "description": "Greeting ladder rung 11. Points at the useful half, which has not moved throughout."
  },
  "greeting_v_nothing_further": {
    "message": "Nothing further",
    "description": "Greeting ladder rung 12. The last thing the line has to say."
  },
  "greeting_v_cannot_end_well": {
    "message": "This cannot end well",
    "description": "Greeting ladder rung 13. The turn - the countdown begins after this."
  },
  "greeting_v_four": {
    "message": "Four",
    "description": "Greeting ladder rung 14. A bare countdown, deadpan by being unexplained."
  },
  "greeting_v_three": {
    "message": "Three",
    "description": "Greeting ladder rung 15, countdown."
  },
  "greeting_v_two": {
    "message": "Two",
    "description": "Greeting ladder rung 16, countdown."
  },
  "greeting_v_one": {
    "message": "One",
    "description": "Greeting ladder rung 17, countdown."
  },
  "greeting_v_nothing_happened": {
    "message": "Nothing happened",
    "description": "Greeting ladder rung 18. The countdown reaches zero and nothing occurs, which is the joke - the line reports it flatly rather than apologising for it."
  },
  "greeting_v_one_more": {
    "message": "One more should do it",
    "description": "Greeting ladder rung 19, the last line before the heading explodes. It is also the longest rung on purpose: the explosion blows up whatever is on screen, and a three-letter heading makes a thin bang."
  },
  "settings_layout": {
    "message": "Layout",
    "description": "Appearance settings label for the grid / compact / list segmented control. Rendered by the data-i18n pass."
  },
  "settings_layout_grid": {
    "message": "Grid",
    "description": "Layout option: the shipped tile grid. The DEFAULT, and the unclassed base - a user who never opens Settings sees exactly this. Rendered by the data-i18n pass."
  },
  "settings_layout_compact": {
    "message": "Compact",
    "description": "Layout option: the same grid at a tighter density. Changes spacing only - gaps, tile padding and the minimum column width - never the icon or text size, which are their own ramps. Rendered by the data-i18n pass."
  },
  "settings_layout_list": {
    "message": "List",
    "description": "Layout option: tiles become full-width rows. Still a CSS grid with one column, so drag-to-reorder keeps working. Rendered by the data-i18n pass."
  },
  "settings_focus_view": {
    "message": "Focus view",
    "description": "Appearance settings label for the Focus view toggle. Rendered by the data-i18n pass."
  },
  "settings_hide_the_grid_and_sidebar": {
    "message": "Hide the grid and sidebar, leaving search",
    "description": "The Focus view toggle. Off by default. It persists across reloads, which is why the view carries its own always-visible exit control. Rendered by the data-i18n pass."
  },
  "focus_leave_focus_view": {
    "message": "Leave Focus view",
    "description": "The exit control shown only in Focus view, pinned top-left outside the content region so nothing the view hides can hide it too. Escape does the same thing. Rendered by the data-i18n pass."
  },
  "launcher_search_the_web_for": {
    "message": "Search the web for",
    "description": "Prefix of the last row of the launcher results, followed by the user's quoted query. That row does exactly what pressing Enter with nothing selected does; it exists so the behaviour is visible rather than folklore. Rendered with t()."
  },
  "launcher_n_results": {
    "message": "{n} results",
    "description": "Announced in the launcher's polite live region when the query changes. Counts only LaunchPad's own matches - shortcuts, groups and sessions - and deliberately not the always-present web-search row, which is an action rather than a result. Rendered with t()."
  },
  "companion_locked": {
    "message": "Focus tracking is a Pro feature. Open LaunchPad in a new tab to start a trial.",
    "description": "The only line the toolbar popup shows to a free or expired user. Rendered with t(). NOT a preview of the pill - D9 hides the pill entirely below Pro, and a preview surface must never render a create affordance, so this explains the empty popup instead of imitating it."
  },
  "companion_no_active_task": {
    "message": "No active task",
    "description": "Toolbar popup, empty state. Mirrors the pill's own empty text. Rendered with t()."
  },
  "companion_active_task": {
    "message": "Active task",
    "description": "Toolbar popup eyebrow above the task name while focus is running. Rendered with t()."
  },
  "companion_paused": {
    "message": "Paused",
    "description": "Toolbar popup eyebrow when tracking is globally paused. The numeral freezes with it. Rendered with t()."
  },
  "companion_start_on_task": {
    "message": "Start a focus session on \u201c{name}\u201d",
    "description": "Tooltip and aria-label on the play glyph beside each row of the side panel's due list. One click makes that task active AND starts a focus session on it. {name} is the task. Side panel only - the toolbar popup's rows stay a reading surface (companion.js finding 3)."
  },
  "companion_start_focus": {
    "message": "▶ Focus · {minutes} min",
    "description": "Side-panel button that starts a focus session on the active task. {minutes} is the current workspace mode's session length - the same value Pro Settings edits and startPomodoroPhase stamps, so the button names the length it would actually use. SIDE PANEL ONLY: the toolbar popup deliberately has no session controls, and companion.js states why. Rendered with t()."
  },
  "companion_focused_today": {
    "message": "Focused today",
    "description": "Toolbar popup label under the SECONDARY numeral - the engine's figure, time actually seen on a trackable site. [1.9.4] CORRECTION: this description previously read 'the same focused-today figure the pill and the card lead with, not a wall-clock counter', which was FALSE in both halves - the [2.0] hero swap made the card lead with the activation stopwatch, and that stopwatch is precisely a wall-clock. The popup was built to that false description and led with a number that is honestly zero whenever the engine has seen no trackable time, which is what Samson found. Rendered with t()."
  },
  "companion_active": {
    "message": "Active",
    "description": "Toolbar popup label under the HERO numeral while a session runs. The pill's own word for this quantity. It is a WALL-CLOCK - time since the task was activated, less paused and idle spans - so the label is never 'Focused', which is reserved for the engine's figure. Rendered with t()."
  },
  "companion_pause": {
    "message": "Pause",
    "description": "Toolbar popup button that pauses tracking globally, so the user does not have to open a new tab to stop the clock. Rendered with t()."
  },
  "companion_resume": {
    "message": "Resume",
    "description": "Toolbar popup button shown in place of Pause while tracking is paused. Rendered with t()."
  },
  "companion_open_launchpad": {
    "message": "Open LaunchPad",
    "description": "Toolbar popup button, present in every state including the empty and the Pro-locked one. The popup's single route out: the empty popup is this surface's most common state and offered no way anywhere. Deliberately NOT a task picker - activating a task starts tracking, and that decision belongs on the page where the board is visible. Rendered with t()."
  },
  "companion_remaining": {
    "message": "Remaining",
    "description": "Toolbar popup label under the numeral during a running Pomodoro phase, where the countdown replaces the focused-today figure. Rendered with t()."
  },
  "insights_wk_focused": {
    "message": "Focused",
    "description": "Row label on the weekly review card. Rendered with th()."
  },
  // "SESSION" DELIBERATELY CARRIES A FOURTH SENSE HERE. Ruled 2026-09-09,
  // reversing [1.8.5] item D, which had renamed this to "Longest stretch" on the
  // grounds that the word already means a saved tab set and a browser session.
  // That reasoning is recorded and was set aside: this is not drift, and it is
  // not to be re-litigated as a collision with the other three senses.
  "insights_wk_longest": {
    "message": "Longest session",
    "description": "Row label on the weekly review card - the longest single unbroken focus session in the week. Uses 'session' in the focus sense, which is deliberate and was ruled on 2026-09-09; do not disambiguate it against the saved-tab-set or browser senses. Rendered with th()."
  },
  "insights_wk_blocked": {
    "message": "Blocks",
    "description": "Row label on the weekly review card - times a blocked site was intercepted. Rendered with th()."
  },
  "insights_wk_snoozed": {
    "message": "Snoozes",
    "description": "Row label on the weekly review card - times a block was snoozed. Rendered with th()."
  },
  "insights_wk_top_task": {
    "message": "Top task",
    "description": "Label on the weekly review card. Rendered with th()."
  },
  "insights_wk_top_tag": {
    "message": "Top tag",
    "description": "Label on the weekly review card. Rendered with th()."
  },
  "insights_last_30_days": {
    "message": "last 30 days",
    "description": "Text sink in insightsKeyToTs(). Rendered with t()."
  },
  "insights_past_7_days": {
    "message": "past 7 days",
    "description": "Text sink in insightsKeyToTs(). Rendered with t()."
  },
  "new_create": {
    "message": "Create",
    "description": "Text sink in openNewTaskModal(). Rendered with t()."
  },
  "new_new_task": {
    "message": "New task",
    "description": "Text sink in openNewTaskModal(). Rendered with t()."
  },
  "notes_empty_trash": {
    "message": "Empty trash",
    "description": "Text sink in openNotesTrashView(). Rendered with t()."
  },
  "notes_notes_trash": {
    "message": "Notes trash",
    "description": "Text sink in openNotesTrashView(). Rendered with t()."
  },
  "purge_delete_permanently": {
    "message": "Delete permanently?",
    "description": "Text sink in confirmPurgeNote(). Rendered with t()."
  },
  "purge_delete_permanently_2": {
    "message": "Delete permanently",
    "description": "Text sink in confirmPurgeNote(). Rendered with t()."
  },
  "purge_delete_permanently_3": {
    "message": "Delete permanently?",
    "description": "Text sink in confirmPurgeDeletedItem(). Rendered with t()."
  },
  "purge_delete_permanently_4": {
    "message": "Delete permanently",
    "description": "Text sink in confirmPurgeDeletedItem(). Rendered with t()."
  },
  "purge_delete_permanently_5": {
    "message": "Delete permanently?",
    "description": "Text sink in confirmPurgeSession(). Rendered with t()."
  },
  "purge_delete_permanently_6": {
    "message": "Delete permanently",
    "description": "Text sink in confirmPurgeSession(). Rendered with t()."
  },
  "purge_this_note_will_be_removed_for": {
    "message": "This note will be removed for good. This cannot be undone.",
    "description": "Text sink in confirmPurgeNote(). Rendered with t()."
  },
  "refresh_name_conflict": {
    "message": "Name conflict",
    "description": "Text sink in refreshPanel(). Rendered with t()."
  },
  "refresh_rename_and_add": {
    "message": "Rename and add",
    "description": "Text sink in refreshPanel(). Rendered with t()."
  },
  "safe_aerial_forest": {
    "message": "Aerial forest",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_black": {
    "message": "Black",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_dark_gray": {
    "message": "Dark gray",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_dramatic_peaks": {
    "message": "Dramatic peaks",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_foggy_forest": {
    "message": "Foggy forest",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_green_valley": {
    "message": "Green valley",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_lake_reflection": {
    "message": "Lake reflection",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_light_gray": {
    "message": "Light gray",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_mountains": {
    "message": "Mountains",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_northern_lights": {
    "message": "Northern lights",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_ocean_wave": {
    "message": "Ocean wave",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_soft_blue": {
    "message": "Soft blue",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_soft_warm_dark": {
    "message": "Soft warm dark",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_starry_mountain": {
    "message": "Starry mountain",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_sunrise_field": {
    "message": "Sunrise field",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_sunset_mountains": {
    "message": "Sunset mountains",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_tropical_beach": {
    "message": "Tropical beach",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "safe_white": {
    "message": "White",
    "description": "Text sink in safeOn(). Rendered with t()."
  },
  "sat_switch_and_reset": {
    "message": "Switch and reset",
    "description": "Text sink in satConfirmSwitchReset(). Rendered with t()."
  },
  "sat_switch_task": {
    "message": "Switch task?",
    "description": "Text sink in satConfirmSwitchReset(). Rendered with t()."
  },
  "sat_this_will_reset_your_focus_session": {
    "message": "This will reset your focus session.",
    "description": "Text sink in satConfirmSwitchReset(). Rendered with t()."
  },
  "session_move_it": {
    "message": "Move it",
    "description": "Text sink in commitSessionAttach(). Rendered with t()."
  },
  "session_move_this_session": {
    "message": "Move this session?",
    "description": "Text sink in commitSessionAttach(). Rendered with t()."
  },
  "session_replace_tabs": {
    "message": "Replace tabs",
    "description": "Text sink in handleSessionCtxAction(). Rendered with t()."
  },
  "sessions_empty_trash": {
    "message": "Empty trash",
    "description": "Text sink in openSessionsTrashView(). Rendered with t()."
  },
  "sessions_sessions_trash": {
    "message": "Sessions trash",
    "description": "Text sink in openSessionsTrashView(). Rendered with t()."
  },
  "task_due_date_after_goal_deadline": {
    "message": "Due date after goal deadline",
    "description": "Text sink in openTaskDueConflictModal(). Rendered with t()."
  },
  "task_name_conflict": {
    "message": "Name conflict",
    "description": "Text sink in commitTaskGoalAssign(). Rendered with t()."
  },
  "task_rename_and_move": {
    "message": "Rename and move",
    "description": "Text sink in commitTaskGoalAssign(). Rendered with t()."
  },
  "templates_goal_templates": {
    "message": "Goal templates",
    "description": "Text sink in openTemplatesPanel(). Rendered with t()."
  }
});


// ====================================================================
// [1.5.0] R3 stage C - dom-assign,set-attr
// ====================================================================
I18n.register("en", {
  "auto_automatic_backup_is_off_because_the": {
    "message": "Automatic backup is off because the downloads permission was removed. Turn it on again to restore the schedule.",
    "description": "Text sink in renderAutoBackupSection(). Rendered with t()."
  },
  "bind_clear_search": {
    "message": "Clear search",
    "description": "Text sink in bindNotesEvents(). Rendered with t()."
  },
  "bind_downloads_permission_was_declined_automatic_backup": {
    "message": "Downloads permission was declined. Automatic backup stays off.",
    "description": "Text sink in bindAutoBackupToggle(). Rendered with t()."
  },
  "bind_notifications_permission_was_declined": {
    "message": "Notifications permission was declined.",
    "description": "Text sink in bindProSettings(). Rendered with t()."
  },
  "check_drop_to_group": {
    "message": "Drop to group",
    "description": "Text sink in checkNestHover(). Rendered with t()."
  },
  "clear_delete_tag": {
    "message": "Delete tag",
    "description": "Text sink in clearPendingTagDelete(). Rendered with t()."
  },
  "delete_delete_all": {
    "message": "Delete All",
    "description": "Text sink in showDeleteDialog(). Rendered with t()."
  },
  "pro_no_license_applied": {
    "message": "No license applied.",
    "description": "Text sink in renderProLicenseSection(). Rendered with t()."
  },
  "tag_click_again_to_confirm_restore_from": {
    "message": "Click again to confirm. Restore from Pro Settings > Tags within 30 days.",
    "description": "Text sink in handleTagDeleteClick(). Rendered with t()."
  },
  "tag_delete": {
    "message": "Delete?",
    "description": "Text sink in handleTagDeleteClick(). Rendered with t()."
  },
  "undo_undo": {
    "message": "Undo",
    "description": "Text sink in showUndoToast(). Rendered with t()."
  },
  "update_all": {
    "message": "All",
    "description": "Text sink in updateRcFilterLabel(). Rendered with t()."
  },
  "update_last_7_days": {
    "message": "Last 7 days",
    "description": "Text sink in updateRcFilterLabel(). Rendered with t()."
  },
  "update_today": {
    "message": "Today",
    "description": "Text sink in updateRcFilterLabel(). Rendered with t()."
  },
  "update_yesterday": {
    "message": "Yesterday",
    "description": "Text sink in updateRcFilterLabel(). Rendered with t()."
  },
  "variant_options": {
    "message": "Options",
    "description": "Text sink in showVariantDropdown(). Rendered with t()."
  },
  "variant_u22ee": {
    "message": "\\u22EE",
    "description": "Text sink in showVariantDropdown(). Rendered with t()."
  },
  "wire_clear_search": {
    "message": "Clear search",
    "description": "Text sink in wirePicker(). Rendered with t()."
  }
});


// ====================================================================
// [1.5.0] R3 stage D - attribute labels (th())
// ====================================================================
I18n.register("en", {
  "add_add_shortcut": {
    "message": "Add shortcut",
    "description": "Attribute label in addTileHTML(). Rendered with th()."
  },
  "completed_right_click_or_restore_to_reactivate": {
    "message": "Right-click or Restore to reactivate",
    "description": "Attribute label in completedRowHtml(). Rendered with th()."
  },
  "dash_add_a_task_due_today": {
    "message": "Add a task due today",
    "description": "Attribute label in dashQuickAddHtml(). Rendered with th()."
  },
  "dash_add_a_task_due_today_2": {
    "message": "Add a task due today…",
    "description": "Attribute label in dashQuickAddHtml(). Rendered with th()."
  },
  "dashboard_deep_work_hours_this_week": {
    "message": "Deep work hours this week",
    "description": "Attribute label in renderDashboardPreview(). Rendered with th()."
  },
  "freq_recurring_task_name": {
    "message": "Recurring task name",
    "description": "Attribute label in freqOption(). Rendered with th()."
  },
  "goal_goal_name": {
    "message": "Goal name",
    "description": "Attribute label in openGoalModal(). Rendered with th()."
  },
  "goal_goal_options": {
    "message": "Goal options",
    "description": "Attribute label in goalCardHtml(). Rendered with th()."
  },
  "goal_optional": {
    "message": "Optional",
    "description": "Attribute label in openGoalModal(). Rendered with th()."
  },
  "goal_task_name": {
    "message": "Task name",
    "description": "Attribute label in goalCardHtml(). Rendered with th()."
  },
  "goal_toggle_goal_collapse": {
    "message": "Toggle goal collapse",
    "description": "Attribute label in goalCardHtml(). Rendered with th()."
  },
  "group_group_options": {
    "message": "Group options",
    "description": "Attribute label in groupHTML(). Rendered with th()."
  },
  "group_open_all_shortcuts_in_new_tabs": {
    "message": "Open all shortcuts in new tabs",
    "description": "Attribute label in groupHTML(). Rendered with th()."
  },
  "insights_date_range": {
    "message": "Date range",
    "description": "Attribute label in insightsRangeSelectorHtml(). Rendered with th()."
  },
  "new_optional": {
    "message": "Optional",
    "description": "Attribute label in openNewTaskModal(). Rendered with th()."
  },
  "new_task_name": {
    "message": "Task name",
    "description": "Attribute label in openNewTaskModal(). Rendered with th()."
  },
  "note_delete_note": {
    "message": "Delete note",
    "description": "Attribute label in noteCardHtml(). Rendered with th()."
  },
  "notes_clear_search": {
    "message": "Clear search",
    "description": "Attribute label in notesSearchHtml(). Rendered with th()."
  },
  "notes_cycle_the_palette": {
    "message": "Cycle the palette",
    "description": "Attribute label in renderNotesDefaultColorSection(). Rendered with th()."
  },
  "notes_cycle_the_palette_2": {
    "message": "Cycle the palette",
    "description": "Attribute label in renderNotesDefaultColorSection(). Rendered with th()."
  },
  "notes_notes_preview": {
    "message": "Notes preview",
    "description": "Attribute label in notesPreviewPanelHtml(). Rendered with th()."
  },
  "notes_search_notes": {
    "message": "Search notes",
    "description": "Attribute label in notesSearchHtml(). Rendered with th()."
  },
  "pro_change_color": {
    "message": "Change color",
    "description": "Attribute label in renderProTagsSection(). Rendered with th()."
  },
  "pro_delete_tag": {
    "message": "Delete tag",
    "description": "Attribute label in renderProTagsSection(). Rendered with th()."
  },
  "pro_delete_workspace": {
    "message": "Delete workspace",
    "description": "Attribute label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_drag_to_reorder": {
    "message": "Drag to reorder",
    "description": "Attribute label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_in_trash_restore_within_30_days": {
    "message": "In trash. Restore within 30 days.",
    "description": "Attribute label in renderProTagsSection(). Rendered with th()."
  },
  "pro_new_workspace_name": {
    "message": "New workspace name",
    "description": "Attribute label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_restore_this_tag": {
    "message": "Restore this tag",
    "description": "Attribute label in renderProTagsSection(). Rendered with th()."
  },
  "pro_track_focus_time_in_the_new": {
    "message": "Track focus time in the new workspace",
    "description": "Attribute label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_track_focus_time_in_this_workspace": {
    "message": "Track focus time in this workspace",
    "description": "Attribute label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_track_focus_time_while_this_workspace": {
    "message": "Track focus time while this workspace is active",
    "description": "Attribute label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_track_focus_time_while_this_workspace_2": {
    "message": "Track focus time while this workspace is active",
    "description": "Attribute label in renderProWorkspaceList(). Rendered with th()."
  },
  "promo_dismiss": {
    "message": "Dismiss",
    "description": "Attribute label in showPromoToast(). Rendered with th()."
  },
  "recurring_right_click_to_manage": {
    "message": "Right-click to manage",
    "description": "Attribute label in recurringRowHtml(). Rendered with th()."
  },
  "sat_pause_tracking": {
    "message": "Pause tracking",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_resume_tracking": {
    "message": "Resume tracking",
    "description": "Attribute label in satPillFaceHtml(). Rendered with th()."
  },
  "sat_stop_tracking_for_now_the_task": {
    "message": "Stop tracking for now. The task stays open and keeps its time.",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "session_options": {
    "message": "Options",
    "description": "Attribute label in sessionRowHtml(). Rendered with th()."
  },
  "session_session_options": {
    "message": "Session options",
    "description": "Attribute label in sessionRowHtml(). Rendered with th()."
  },
  "shortcut_more_actions": {
    "message": "More actions",
    "description": "Attribute label in shortcutHTML(). Rendered with th()."
  },
  "sidebar_drag_to_reorder": {
    "message": "Drag to reorder",
    "description": "Attribute label in renderSidebarGroups(). Rendered with th()."
  },
  "sidebar_drag_to_reorder_2": {
    "message": "Drag to reorder",
    "description": "Attribute label in sidebarShortcutListHTML(). Rendered with th()."
  },
  "sidebar_group_options": {
    "message": "Group options",
    "description": "Attribute label in renderSidebarGroups(). Rendered with th()."
  },
  "task_drag_to_reorder": {
    "message": "Drag to reorder",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
  },
  "task_drag_to_reorder_2": {
    "message": "Drag to reorder",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
  },
  "task_optional": {
    "message": "Optional",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
  },
  "task_remove_task": {
    "message": "Remove task",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
  },
  "task_task_name": {
    "message": "Task name",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
  },
  "task_task_options": {
    "message": "Task options",
    "description": "Attribute label in taskOptionsPillHtml(). Rendered with th()."
  },
  "task_template_name": {
    "message": "Template name",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
  },
  "task_toggle_task_complete": {
    "message": "Toggle task complete",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
  },
  "tasks_goal_options": {
    "message": "Goal options",
    "description": "Attribute label in renderTasksPreview(). Rendered with th()."
  },
  "upgrade_enter_license_key": {
    "message": "Enter license key",
    "description": "Attribute label in openUpgradePopover(). Rendered with th()."
  },
  "workspace_workspace_name": {
    "message": "Workspace name",
    "description": "Attribute label in buildWorkspaceDropdownBody(). Rendered with th()."
  }
});


// ====================================================================
// [1.5.0] R3 stage E - markup labels (th())
// ====================================================================
I18n.register("en", {
  "apply_coming_soon": {
    "message": "Coming soon",
    "description": "Markup label in applyCtaState(). Rendered with th()."
  },
  "apply_pro": {
    "message": "Pro",
    "description": "Markup label in applyCtaState(). Rendered with th()."
  },
  "attach_there_are_no_open_tasks_in": {
    "message": "There are no open tasks in this workspace yet.",
    "description": "Markup label in attachPickerBodyHtml(). Rendered with th()."
  },
  "badge_achievement_unlocked": {
    "message": "Achievement unlocked",
    "description": "Markup label in showBadgeSplash(). Rendered with th()."
  },
  "completed_clear": {
    "message": "Clear",
    "description": "Markup label in completedBoxHtml(). Rendered with th()."
  },
  "completed_no_completed_tasks_yet": {
    "message": "No completed tasks yet. Finished tasks collect here.",
    "description": "Markup label in completedBoxHtml(). Rendered with th()."
  },
  "completed_reactivate": {
    "message": "Reactivate",
    "description": "Markup label in openCompletedContextMenu(). Rendered with th()."
  },
  "completed_restore": {
    "message": "Restore",
    "description": "Markup label in completedRowHtml(). Rendered with th()."
  },
  "conditional_day_of_month": {
    "message": "Day of month",
    "description": "Markup label in conditionalHtml(). Rendered with th()."
  },
  "conditional_days_of_week": {
    "message": "Days of week",
    "description": "Markup label in conditionalHtml(). Rendered with th()."
  },
  "dash_add_something_below_when_you_are": {
    "message": "Add something below when you are ready.",
    "description": "Markup label in dashHeadHtml(). Rendered with th()."
  },
  "dash_create_one_in_tasks": {
    "message": "Create one in Tasks.",
    "description": "Inline link under the Dashboard goals empty state. It is a SENTENCE OF ITS OWN as of R4 - it used to be the tail of 'No active goals - create one in Tasks.', so it began lowercase and its full stop sat in the markup after the button."
  },
  "dash_day_streak": {
    "message": "Day streak",
    "description": "Markup label in dashStreakBodyHtml(). Rendered with th()."
  },
  "dash_focus_on_something_today_to_start": {
    "message": "Focus on something today to start one.",
    "description": "Markup label in dashStreakBodyHtml(). Rendered with th()."
  },
  "dash_nothing_tracked_today": {
    "message": "Nothing tracked yet today.",
    "description": "BOTH Dashboards, in place of the two time lists, when the engine has recorded no time at all today - the Pro tile headed 'Where the time went' and the free Dashboard's own live tile, which share one renderer (dashPassiveHtml). The name said 'free' until the design-pack frames showed it on Pro. A STATEMENT OF FACT AND NOTHING ELSE (ruling 5, 2026-09-22): no invitation, no forecast, no promise about what Pro would show - the tile beside it is the pitch and this one is the user's own. It is NOT pt_no_time_on_tasks, which is a different case (site time exists, no task was active) and which does invite an action. Rendered with th() in the list tile's body at the meta tier. Translators: keep it a single short sentence in the past-to-present tense; 'yet' carries the whole difference between a fact and a complaint.",
    "placeholders": {}
  },

  "dash_nothing_due_today": {
    "message": "Nothing due today. Add one below.",
    "description": "Markup label in dashDueListHtml(). Rendered with th()."
  },
  "dash_nothing_on_the_list": {
    "message": "Nothing on the list.",
    "description": "Markup label in dashHeadHtml(). Rendered with th()."
  },
  "dash_up_next": {
    "message": "Up next",
    "description": "Eyebrow on the Dashboard's action tile - the one orange tile on the surface, carrying the single task the user should do now. Takes Today's Three first and falls back to the earliest due item, so the tile is never empty while there is work."
  },
  "dash_start": {
    "message": "Start",
    "description": "The action tile's button. Makes its task the active task, which is what the pill's own Start does - consequence-labelled per the design guide: it says what the click does, not where it goes."
  },
  "dash_where_the_time_went": {
    "message": "Where the time went",
    "description": "Eyebrow on the Dashboard's time-by-site list tile. Past tense deliberately: the tile reports what was measured today rather than proposing anything."
  },
  "dash_reminders": {
    "message": "Reminders",
    "description": "Label on the toggle on the due-today tile's head. Short because it sits beside the tile's own eyebrow, which already says the tile is about what is due; the Pro Settings equivalent (prosettings_due_reminders_toggle) carries the long form and is a different control on a different surface."
  },
  "dash_reminders_work_only": {
    "message": "Fires in Work mode",
    "description": "Hint beneath the reminders toggle, rendered ONLY when the workspace is in Casual. A reminder fires only in a Work workspace, so on Casual the toggle can read ON while nothing will ever happen - the same shape as the blocking schedule's mode note, and the same fix: say the condition where the control is rather than after the user has waited for a notification that was never coming. Ruled 6bde048; prosettings_due_reminders_note carries the long form."
  },
  "dash_tracking": {
    "message": "Tracking",
    "description": "Label on the toggle on the time-by-site tile's head. It writes the PER-WORKSPACE tracking field - the same field the Workspaces section writes, and NOT the global switch in Settings, which is a different field with a different writer."
  },
  "dash_tracking_off_note": {
    "message": "Tracking is off for this workspace, so nothing is being measured.",
    "description": "Stands in for the Dashboard's focus figure and for the time tile's lists when the workspace has tracking off. Says nothing was MEASURED rather than showing a zero - a 0m that means 'not measured' reads as 'you did nothing', which is the nag the doctrine forbids. Same fact in both places, so it is one message."
  },
  "dash_overdue": {
    "message": "Overdue",
    "description": "Markup label in dashDueListHtml(). Rendered with th()."
  },
  "dash_pick_up_where_you_left_off": {
    "message": "Pick up where you left off",
    "description": "Markup label in dashHeadHtml(). Rendered with th()."
  },
  "dash_suggested_next": {
    "message": "Suggested next",
    "description": "Markup label in dashHeadHtml(). Rendered with th()."
  },
  "dash_tasks": {
    "message": "Tasks",
    "description": "Markup label in dashGoalsHtml(). Rendered with th()."
  },
  "dash_tasks_2": {
    "message": "Tasks",
    "description": "Markup label in dashDueListHtml(). Rendered with th()."
  },
  "dash_that_s_the_day": {
    "message": "That’s the day",
    "description": "Markup label in dashHeadHtml(). Rendered with th()."
  },
  "dash_through_yesterday_today_is_still_open": {
    "message": "Through yesterday. Today is still open.",
    "description": "Markup label in dashStreakBodyHtml(). Rendered with th()."
  },
  "dash_work_s_done": {
    "message": "Work’s done.",
    "description": "Markup label in dashHeadHtml(). Rendered with th()."
  },
  "dashboard_deep_work": {
    "message": "Deep work",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "dashboard_due_today": {
    "message": "Due today",
    "description": "Markup label in renderDashboardTab(). Rendered with th()."
  },
  "dashboard_focus_streak": {
    "message": "Focus streak",
    "description": "Markup label in renderDashboardTab(). Rendered with th()."
  },
  "dashboard_goals": {
    "message": "Goals",
    "description": "Markup label in renderDashboardTab(). Rendered with th()."
  },
  "dashboard_goals_making_progress": {
    "message": "Goals making progress",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "dashboard_hours_of_deep_work": {
    "message": "Hours of deep work",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "dashboard_how_did_today_feel": {
    "message": "How did today feel?",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "dashboard_longest_focus_stretch": {
    "message": "Longest focus stretch:",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "dashboard_tasks_completed": {
    "message": "Tasks completed",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "dashboard_this_week": {
    "message": "This week",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "dashboard_today_s_recap": {
    "message": "Today’s Recap",
    "description": "Markup label in renderDashboardPreview(). Rendered with th()."
  },
  "deleted_empty": {
    "message": "Empty",
    "description": "Markup label in deletedBoxHtml(). Rendered with th()."
  },
  "deleted_nothing_deleted_items_stay_here_30": {
    "message": "Nothing deleted. Items stay here 30 days.",
    "description": "Markup label in deletedBoxHtml(). Rendered with th()."
  },
  "deleted_restore": {
    "message": "Restore",
    "description": "Markup label in deletedBoxHtml(). Rendered with th()."
  },
  "deleted_restore_all": {
    "message": "Restore all",
    "description": "Markup label in deletedBoxHtml(). Rendered with th()."
  },
  "demo_add_to_launchpad": {
    "message": "Add to LaunchPad",
    "description": "Markup label in demoIntroHTML(). Rendered with th()."
  },
  "demo_already_have_bookmarks": {
    "message": "Already have bookmarks?",
    "description": "Markup label in demoIntroHTML(). Rendered with th()."
  },
  "demo_bring_them_in_from_top_sites": {
    "message": "Bring them in from top sites or Chrome bookmarks.",
    "description": "Markup label in demoIntroHTML(). Rendered with th()."
  },
  "demo_make_it_yours_pick_a_background": {
    "message": "Make it yours. Pick a background.",
    "description": "Markup label in demoIntroHTML(). Rendered with th()."
  },
  "demo_pick_a_background": {
    "message": "Pick a background",
    "description": "Markup label in demoIntroHTML(). Rendered with th()."
  },
  "demo_save_any_page": {
    "message": "Save any page",
    "description": "Markup label in demoIntroHTML(). Rendered with th()."
  },
  "demo_welcome_to_launchpad": {
    "message": "Welcome to LaunchPad",
    "description": "Markup label in demoIntroHTML(). Rendered with th()."
  },
  "due_add_date": {
    "message": "Add date",
    "description": "Markup label in dueDatePillHtml(). Rendered with th()."
  },
  "due_clear": {
    "message": "Clear",
    "description": "Markup label in openDueDatePillPopover(). Rendered with th()."
  },
  "due_set": {
    "message": "Set",
    "description": "Markup label in openDueDatePillPopover(). Rendered with th()."
  },
  "freq_active": {
    "message": "Active",
    "description": "Markup label in freqOption(). Rendered with th()."
  },
  "freq_frequency": {
    "message": "Frequency",
    "description": "Markup label in freqOption(). Rendered with th()."
  },
  "freq_name": {
    "message": "Name",
    "description": "Markup label in freqOption(). Rendered with th()."
  },
  "freq_time_of_day": {
    "message": "Time of day",
    "description": "Markup label in freqOption(). Rendered with th()."
  },
  "getting_getting_started": {
    "message": "Getting started",
    "description": "Markup label in renderGettingStarted(). Rendered with th()."
  },
  "getting_i_know_my_way_around": {
    "message": "I know my way around",
    "description": "Markup label in renderGettingStarted(). Rendered with th()."
  },
  "getting_you_know_your_way_around": {
    "message": "You know your way around.",
    "description": "Markup label in renderGettingStarted(). Rendered with th()."
  },
  "getting_you_know_your_way_around_2": {
    "message": "You know your way around.",
    "description": "Markup label in renderGettingStarted(). Rendered with th()."
  },
  "ghost_new_note": {
    "message": "New note",
    "description": "Markup label in ghostNoteHtml(). Rendered with th()."
  },
  "goal_add": {
    "message": "Add",
    "description": "Markup label in goalCardHtml(). Rendered with th()."
  },
  "goal_add_task": {
    "message": "+ Add task",
    "description": "Markup label in goalCardHtml(). Rendered with th()."
  },
  "goal_auto_create_tag_from_goal_name": {
    "message": "Auto-create tag from goal name",
    "description": "Markup label in openGoalModal(). Rendered with th()."
  },
  "goal_deadline": {
    "message": "Deadline",
    "description": "Markup label in openGoalModal(). Rendered with th()."
  },
  "goal_description": {
    "message": "Description",
    "description": "Markup label in openGoalModal(). Rendered with th()."
  },
  "goal_duplicate": {
    "message": "Duplicate",
    "description": "Markup label in goalTemplateListHtml(). Rendered with th()."
  },
  "goal_edit": {
    "message": "Edit",
    "description": "Markup label in goalTemplateListHtml(). Rendered with th()."
  },
  "goal_edit_2": {
    "message": "Edit",
    "description": "Markup label in openGoalContextMenu(). Rendered with th()."
  },
  "goal_from_template": {
    "message": "From template",
    "description": "Markup label in openGoalModal(). Rendered with th()."
  },
  "goal_mark_complete": {
    "message": "Mark complete",
    "description": "Markup label in openGoalContextMenu(). Rendered with th()."
  },
  "goal_name": {
    "message": "Name",
    "description": "Markup label in openGoalModal(). Rendered with th()."
  },
  "goal_no_tasks_match_the_current_filter": {
    "message": "No tasks match the current filter. Clear it to see the rest.",
    "description": "Markup label in goalCardHtml(). Rendered with th()."
  },
  "goal_no_tasks_yet": {
    "message": "No tasks yet. Add the first one below.",
    "description": "Markup label in goalCardHtml(). Rendered with th()."
  },
  "goal_no_templates_yet": {
    "message": "No templates yet",
    "description": "Markup label in openGoalModal(). Rendered with th()."
  },
  "goal_no_templates_yet_2": {
    "message": "No templates yet",
    "description": "Markup label in goalTemplateListHtml(). Rendered with th()."
  },
  "goal_none_blank_goal": {
    "message": "None (blank goal)",
    "description": "Markup label in openGoalModal(). Rendered with th()."
  },
  "goal_overdue": {
    "message": "Overdue",
    "description": "Markup label in goalCardHtml(). Rendered with th()."
  },
  "goal_right_click_an_active_goal_save": {
    "message": "Right-click an active goal → “Save as template”, or create one below.",
    "description": "Markup label in goalTemplateListHtml(). Rendered with th()."
  },
  "goal_save_as_template": {
    "message": "Save as template",
    "description": "Markup label in openGoalContextMenu(). Rendered with th()."
  },
  "insights_achievements": {
    "message": "Achievements",
    "description": "Markup label in renderInsightsPreview(). Rendered with th()."
  },
  "insights_custom": {
    "message": "Custom",
    "description": "Markup label in insightsRangeSelectorHtml(). Rendered with th()."
  },
  "insights_deep_work": {
    "message": "Deep Work",
    "description": "The Insights hero card title, on the live board and on the free preview alike. IT CARRIES NO RANGE: the card names its window once, on the label beneath the figure, because that is where a reader looking at the numeral actually is. Replaced insights_deep_work_last_30_days (preview) and insights_deep_work_range (board), both of which spelled the range into the title and were retired with this change rather than left as orphans a later round could revive. Rendered with th()."
  },
  "insights_from": {
    "message": "From",
    "description": "Markup label in insightsRangeSelectorHtml(). Rendered with th()."
  },
  "insights_hours_day": {
    "message": "Hours / day",
    "description": "Markup label in insightsBarChartSvg(). Rendered with th()."
  },
  "insights_time_by_tag_last_30_days": {
    "message": "Time by tag · last 30 days",
    "description": "Markup label in renderInsightsPreview(). Rendered with th()."
  },
  "insights_to": {
    "message": "To",
    "description": "Markup label in insightsRangeSelectorHtml(). Rendered with th()."
  },
  "nest_shortcuts_grouped_name_this_group": {
    "message": "Shortcuts grouped! Name this group?",
    "description": "Markup label in showNestRenameDialog(). Rendered with th()."
  },
  "nest_skip": {
    "message": "Skip",
    "description": "Markup label in showNestRenameDialog(). Rendered with th()."
  },
  "new_description": {
    "message": "Description",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_due_date": {
    "message": "Due date",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_high": {
    "message": "High",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_low": {
    "message": "Low",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_medium": {
    "message": "Medium",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_name": {
    "message": "Name",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_none": {
    "message": "None",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_priority": {
    "message": "Priority",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "new_urgent": {
    "message": "Urgent",
    "description": "Markup label in openNewTaskModal(). Rendered with th()."
  },
  "notes_delete_permanently": {
    "message": "Delete permanently",
    "description": "Markup label in notesTrashRowHtml(). Rendered with th()."
  },
  "notes_notes": {
    "message": "Notes",
    "description": "Markup label in notesPanelHtml(). Rendered with th()."
  },
  "notes_notes_2": {
    "message": "Notes",
    "description": "Markup label in notesPreviewPanelHtml(). Rendered with th()."
  },
  "notes_nothing_in_the_trash_deleted_notes": {
    "message": "Nothing in the trash. Deleted notes appear here before they are removed for good.",
    "description": "Markup label in notesTrashBodyHtml(). Rendered with th()."
  },
  "notes_promote_to_goal": {
    "message": "Promote to goal",
    "description": "Markup label in openNotesMenu(). Rendered with th()."
  },
  "notes_promote_to_task": {
    "message": "Promote to task",
    "description": "Markup label in openNotesMenu(). Rendered with th()."
  },
  "notes_restore": {
    "message": "Restore",
    "description": "Markup label in notesTrashRowHtml(). Rendered with th()."
  },
  "notes_trash": {
    "message": "Trash",
    "description": "Markup label in notesTrashBarHtml(). Rendered with th()."
  },
  "preview_coming_soon": {
    "message": "Coming soon",
    "description": "Markup label in previewBannerHtml(). Rendered with th()."
  },
  "preview_preview_mode_full_pro_is_coming": {
    "message": "Preview mode. Full Pro is coming soon.",
    "description": "Markup label in previewBannerHtml(). Rendered with th()."
  },
  "preview_preview_mode_upgrade_to_pro_to": {
    "message": "Preview mode. Upgrade to Pro to use this feature with your data.",
    "description": "Markup label in previewBannerHtml(). Rendered with th()."
  },
  "priority_clear_priority": {
    "message": "Clear priority",
    "description": "Markup label in openPriorityPillPopover(). Rendered with th()."
  },
  "pro_add_workspace": {
    "message": "Add workspace",
    "description": "Markup label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_everything_is_unlocked_here_s_your": {
    "message": "Everything is unlocked. Here’s your thirty-second lay of the land.",
    "description": "Markup label in showProCelebration(). Rendered with th()."
  },
  "pro_explore_on_my_own": {
    "message": "Explore on my own",
    "description": "Markup label in showProCelebration(). Rendered with th()."
  },
  "pro_in_trash": {
    "message": "in trash",
    "description": "Markup label in renderProTagsSection(). Rendered with th()."
  },
  "pro_pro_activated": {
    "message": "Pro activated",
    "description": "Markup label in showProCelebration(). Rendered with th()."
  },
  "pro_restore": {
    "message": "Restore",
    "description": "Markup label in renderProTagsSection(). Rendered with th()."
  },
  "pro_skip": {
    "message": "Skip",
    "description": "Markup label in renderProTourStep(). Rendered with th()."
  },
  "pro_take_the_tour": {
    "message": "Take the tour",
    "description": "Markup label in showProCelebration(). Rendered with th()."
  },
  "pro_track": {
    "message": "Track",
    "description": "Markup label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_track_2": {
    "message": "Track",
    "description": "Markup label in renderProWorkspaceList(). Rendered with th()."
  },
  "pro_verification_overdue": {
    "message": "Verification overdue. Reconnect to keep access.",
    "description": "Markup label in renderProSubscriptionSection(). Rendered with th()."
  },
  "pro_you_re_pro": {
    "message": "You’re Pro",
    "description": "Markup label in showProCelebration(). Rendered with th()."
  },
  "promo_enjoying_launchpad_leave_a_quick_rating": {
    "message": "Enjoying LaunchPad? Leave a quick rating!",
    "description": "Markup label in showPromoToast(). Rendered with th()."
  },
  "promo_rate": {
    "message": "Rate",
    "description": "Markup label in showPromoToast(). Rendered with th()."
  },
  "promote_delete_note_after_creating": {
    "message": "Delete note after creating",
    "description": "Markup label in promoteDeleteRowHtml(). Rendered with th()."
  },
  "rc_no_matches_found": {
    "message": "No matches found",
    "description": "Markup label in showRcItems(). Rendered with th()."
  },
  "read_this_workspace_is_read_only_upgrade": {
    "message": "This workspace is read-only. Upgrade to Pro to edit.",
    "description": "Markup label in renderReadOnlyBanner(). Rendered with th()."
  },
  "read_upgrade": {
    "message": "Upgrade",
    "description": "The one-word button that opens the upgrade flow. TWO SINKS, ONE KEY: the read-only workspace banner it was named for, and the tab-bar CTA chip for a user whose trial is used up (applyCtaState state A-D), where it is both the visible label and the accessible name. The read_ prefix records where it first appeared, not the only place it appears. Its never-trialled counterpart is upgrade_start_free_trial - the two are the SAME BUTTON in different states and must stay the same part of speech: an imperative verb, not a noun."
  },
  "recurring_edit": {
    "message": "Edit",
    "description": "Markup label in openRecurringContextMenu(). Rendered with th()."
  },
  "recurring_paused": {
    "message": "Paused",
    "sense": "state.template",
    "description": "Markup label in recurringRowHtml(). Rendered with th()."
  },
  "restore_add_to_launchpad": {
    "message": "Add to LaunchPad",
    "description": "Markup label in restoreDemoExamples(). Rendered with th()."
  },
  "sat_focus_session": {
    "message": "▶ Focus session",
    "description": "Side-panel button that stops the running focus session. Was the pill's; the pill was removed 2026-09-19 and the session controls moved to the side panel, which companion.js's sessionControlsHtml renders. Rendered with t()."
  },
  "sat_no_active_task": {
    "message": "No active task",
    "description": "Markup label in satPillFaceHtml(). Rendered with th()."
  },
  "sat_no_sites_listed": {
    "message": "no sites listed",
    "description": "Markup label in satFocusRowHtml(). Rendered with th()."
  },
  "sat_pause": {
    "message": "⏸ Pause",
    "description": "Markup label in satCardHtml(). Rendered with th()."
  },
  "sat_resume": {
    "message": "▶ Resume",
    "description": "Markup label in satCardHtml(). Rendered with th()."
  },
  "sat_stop": {
    "message": "■ Stop",
    "description": "Markup label in satCardHtml(). Rendered with th()."
  },
  "sessions_delete_permanently": {
    "message": "Delete permanently",
    "description": "Markup label in sessionsTrashRowHtml(). Rendered with th()."
  },
  "sessions_nothing_in_the_trash_deleted_sessions": {
    "message": "Nothing in the trash. Deleted sessions appear here before they are removed for good.",
    "description": "Markup label in sessionsTrashBodyHtml(). Rendered with th()."
  },
  "sessions_restore": {
    "message": "Restore",
    "description": "Markup label in sessionsTrashRowHtml(). Rendered with th()."
  },
  "sessions_trash": {
    "message": "Trash",
    "description": "Markup label in sessionsTrashEntranceHtml(). Rendered with th()."
  },
  "sidebar_no_shortcuts": {
    "message": "No shortcuts",
    "description": "Markup label in sidebarShortcutListHTML(). Rendered with th()."
  },
  "tab_coming_soon": {
    "message": "Coming soon.",
    "description": "Markup label in renderTabPlaceholder(). Rendered with th()."
  },
  "task_add_task": {
    "message": "+ Add task",
    "description": "Markup label in taskRowHtml(). Rendered with th()."
  },
  "task_deadline_days_from_creation": {
    "message": "Deadline (days from creation)",
    "description": "Markup label in taskRowHtml(). Rendered with th()."
  },
  "task_description": {
    "message": "Description",
    "description": "Markup label in taskRowHtml(). Rendered with th()."
  },
  "task_duplicate": {
    "message": "Duplicate",
    "description": "Markup label in openTaskContextMenu(). Rendered with th()."
  },
  "attach_entry": {
    "message": "Attach resources",
    "description": "Menu entry on a task and on a goal, opening the picker that binds a named session, a group or a shortcut for LAUNCHING. Distinct from tagging, which attributes time."
  },
  "attach_capture_window": {
    "message": "Save this window as a named session",
    "description": "Goal menu entry. Captures the current window as a named session and attaches it in one action."
  },
  "attach_kind_named_session": {
    "message": "named session",
    "description": "The kind label for a saved tab set. Always qualified as NAMED session: on a goal the word session also means the browser session and the focus session."
  },
  "attach_kind_group": {
    "message": "group",
    "description": "The kind label for a shortcut group on Home."
  },
  "attach_kind_shortcut": {
    "message": "shortcut",
    "description": "The kind label for a single shortcut."
  },
  "attach_open_title": {
    "plural": {"one": "Open the {kind} {name}, {count} tab", "other": "Open the {kind} {name}, {count} tabs"},
    "description": "Title and accessible label on an attachment chip. Names the kind so a chip beside a tag pill cannot be read as a tag, and the tab count so the click is not a surprise."
  },
  "attach_open_all": {
    "message": "Open all",
    "description": "Control beside the attachment chips that launches every attached resource at once."
  },
  "attach_open_all_title": {
    "message": "Open every attached resource",
    "description": "Title on the Open all control."
  },
  "attach_open_count": {
    "plural": {"one": "Open {count} tab", "other": "Open {count} tabs"},
    "description": "Confirm button when opening several resources at once. Names the number of tabs rather than the number of resources, because tabs are what appear."
  },
  "attach_confirm_many": {
    "message": "This opens {count} tabs from {resources} attached resources. Open them?",
    "description": "Confirm shown when one click would open more tabs than the threshold. Counted from what will actually open, not estimated."
  },
  "attach_nothing_to_open": {
    "message": "There is nothing to open here yet.",
    "description": "Toast when an attachment resolves to no URLs, for example a named session whose tabs were all removed."
  },
  "attach_could_not_open": {
    "message": "Those tabs could not be opened.",
    "description": "Toast when the browser refused to open the window."
  },
  "attach_picker_title": {
    "message": "Attach resources to {name}",
    "description": "Title of the attach picker. Names the task or goal it is binding to."
  },
  "attach_relation_note": {
    "message": "Attached resources open together when you launch this. Tags are separate: they attribute your tracked time and do not open anything.",
    "description": "The sentence at the top of the attach picker. It exists because attach and tag are two different relations on one surface, and a user who confuses them mis-reads their own time reports."
  },
  "attach_search": {
    "message": "Search resources",
    "description": "Placeholder in the attach picker search box."
  },
  "attach_nothing_to_attach": {
    "message": "There are no named sessions, groups or shortcuts in this workspace yet.",
    "description": "Empty state in the attach picker when the workspace has nothing to attach."
  },
  "attach_no_matches": {
    "message": "Nothing matches that.",
    "description": "Empty state in the attach picker when the search filter excludes everything."
  },
  "attach_note_tabs": {
    "plural": {"one": "{count} tab", "other": "{count} tabs"},
    "description": "Secondary line on a named-session row in the attach picker."
  },
  "attach_note_shortcuts": {
    "plural": {"one": "{count} shortcut", "other": "{count} shortcuts"},
    "description": "Secondary line on a group row in the attach picker."
  },
  "attach_attached_remove": {
    "message": "attached, click to remove",
    "description": "Secondary line on an already-attached row in the attach picker. The picker owns detaching, so there is no separate detach menu entry."
  },
  "attach_capture_title": {
    "message": "Name this named session",
    "description": "Title of the prompt that names a window captured from a goal."
  },
  "attach_captured_toast": {
    "plural": {"one": "Saved {count} tab as the named session {name} and attached it.", "other": "Saved {count} tabs as the named session {name} and attached it."},
    "description": "Toast after capturing the current window from a goal. Says both halves of the one action, because it did two things."
  },
  "task_edit": {
    "message": "Edit",
    "description": "Markup label in openTaskContextMenu(). Rendered with th()."
  },
  "task_make_active": {
    "message": "Make active",
    "description": "Markup label in openTaskContextMenu(). Rendered with th()."
  },
  "task_name": {
    "message": "Name",
    "description": "Markup label in taskRowHtml(). Rendered with th()."
  },
  "task_no_goal_standalone": {
    "message": "No goal (standalone)",
    "description": "Markup label in taskGoalPickerRowsHtml(). Rendered with th()."
  },
  "task_no_tags_yet": {
    "message": "No tags yet.",
    "description": "Markup label in openTaskFilterPopover(). Rendered with th()."
  },
  "task_priority": {
    "message": "Priority",
    "description": "Markup label in openTaskContextMenu(). Rendered with th()."
  },
  "task_tasks": {
    "message": "Tasks",
    "description": "Markup label in taskRowHtml(). Rendered with th()."
  },
  "task_there_are_no_saved_sessions_in": {
    "message": "No saved sessions in this workspace yet. Save the tabs you have open.",
    "description": "Markup label in openTaskSessionPicker(). Rendered with th()."
  },
  "tasks_active_goals": {
    "message": "Active Goals",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_active_goals_2": {
    "message": "Active Goals",
    "description": "Markup label in renderTasksTab(). Rendered with th()."
  },
  "tasks_add_task": {
    "message": "+ Add task",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_no_active_goals_create_your_first": {
    "message": "No active goals. Create your first goal.",
    "description": "Markup label in renderTasksTab(). Rendered with th()."
  },
  "tasks_no_active_workspace": {
    "message": "No active workspace.",
    "description": "Markup label in renderTasksTab(). Rendered with th()."
  },
  "tasks_no_recurring_tasks": {
    "message": "No recurring tasks. Create one with New Recurring.",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_no_standalone_tasks": {
    "message": "No standalone tasks. New tasks land here unless you pick a goal.",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_priority": {
    "message": "Priority",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_recurring": {
    "message": "Recurring",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_sort_by_creation_date": {
    "message": "Sort by: creation date",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_standalone": {
    "message": "Standalone",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_standalone_2": {
    "message": "Standalone",
    "description": "Markup label in renderTasksTab(). Rendered with th()."
  },
  "tasks_status": {
    "message": "Status",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "tasks_tag": {
    "message": "Tag",
    "description": "Markup label in renderTasksPreview(). Rendered with th()."
  },
  "templates_new_template": {
    "message": "+ New template",
    "description": "Markup label in templatesPanelBodyHtml(). Rendered with th()."
  },
  "upgrade_already_have_a_license": {
    "message": "Already have a license?",
    "description": "Markup label in openUpgradePopover(). Rendered with th()."
  },
  "upgrade_annual": {
    "message": "Annual",
    "description": "Markup label in openUpgradePopover(). Rendered with th()."
  },
  "upgrade_monthly": {
    "message": "Monthly",
    "sense": "billing.period",
    "description": "Markup label in openUpgradePopover(). Rendered with th()."
  },
  "upgrade_or_upgrade_now": {
    "message": "or upgrade now",
    "description": "Markup label in openUpgradePopover(). Rendered with th()."
  },
  "upgrade_start_free_trial": {
    "message": "Start free trial",
    "description": "The button that begins the 7-day no-card trial. TWO SINKS, ONE KEY: the upgrade popover it was named for, and the tab-bar CTA chip for a user who has never trialled (applyCtaState state A-D), where it is both the visible label and the accessible name. Its trial-used counterpart is read_upgrade; the two are the SAME BUTTON in different states. It must not promise a card is required or that the trial auto-charges, because it neither is nor does."
  },
  "workspace_add_workspace": {
    "message": "Add workspace",
    "description": "Markup label in buildWorkspaceDropdownBody(). Rendered with th()."
  },
  "workspace_create": {
    "message": "Create",
    "description": "Markup label in buildWorkspaceDropdownBody(). Rendered with th()."
  }
});


// ====================================================================
// [1.5.0] R4 stage 1 - interpolated messages, named placeholders
// ====================================================================
I18n.register("en", {
  "addshortcut_domain_exists_nest": {
    "message": "A shortcut for \"{domain}\" already exists ({existingName}). Nest this as a variant?",
    "description": "Offer to nest a new shortcut under an existing one. {domain} is a derived base domain; {existingName} is the user's title for the existing shortcut."
  },
  "backup_damaged_section": {
    "message": "This backup is damaged in its {section} section. Nothing was imported.",
    "description": "Import failure. {section} is a STORAGE KEY NAME such as 'data' or 'sessions' - technical, never translated."
  },
  "dash_due_complete_task_aria": {
    "message": "Complete {taskName}",
    "description": "Accessible name for the checkbox that completes a due task. {taskName} is the user's task title."
  },
  "dash_no_active_goals": {
    "message": "No active goals.",
    "description": "Dashboard goals empty state, in dashGoalsHtml(). STATE THE CONDITION ONLY, NEVER THE ACTION: the renderer appends a 'Create one in Tasks.' link (dash_create_one_in_tasks) immediately after this string, on the same line, so any call to action added here renders TWICE. [1.6.5] added 'Create one in Tasks.' to this message and shipped exactly that duplication. The sentence used to run into the link through an em dash; R4 made both halves standalone sentences."
  },
  "focusblock_remove_site": {
    "message": "Remove {site}",
    "description": "Tooltip and accessible name for the control that removes one blocked site. {site} is a domain."
  },
  "gettingstarted_save_with_right_click": {
    "message": "Save a page with right-click. Choose Add to LaunchPad.",
    "description": "Getting-started step 2. 'Add to LaunchPad' is the context-menu item's own label (restore_add_to_launchpad) and must read identically there."
  },
  "goalconflict_extend_goal_to": {
    "message": "Extend goal to {date}",
    "description": "Primary action when a task's due date passes its goal deadline. {date} is an already-formatted short date."
  },
  "group_grouped_under_toast": {
    "message": "Grouped \"{shortcutName}\" under \"{targetName}\"",
    "description": "Toast after nesting. Both values are user-supplied shortcut titles."
  },
  "group_ungrouped_toast": {
    "message": "Ungrouped \"{shortcutName}\"",
    "description": "Toast after a shortcut is lifted out of a nest. {shortcutName} is the user's shortcut title."
  },
  "groupdelete_delete_empty_group_named": {
    "message": "Delete empty group \"{groupName}\"?",
    "description": "Message when the group being deleted holds no shortcuts. {groupName} is the user's group name."
  },
  "groupdelete_delete_group_named": {
    "message": "Delete group \"{groupName}\"?",
    "description": "Title of the delete-group dialog. {groupName} is the user's group name."
  },
  "nest_hint_same_domain": {
    "message": "Drag \"{shortcutName}\" onto \"{targetName}\" to nest them. They share the same domain.",
    "description": "Hint offering to nest two shortcuts. Both values are user-supplied shortcut titles."
  },
  "prolicense_active_license": {
    "message": "Active license: {licenseKey}",
    "description": "Shown when a license is active. {licenseKey} is the user's key."
  },
  "protags_tag_restored": {
    "message": "Tag \"{tagName}\" restored.",
    "description": "Toast after restoring a trashed tag. {tagName} is user-supplied."
  },
  "purge_delete_goal_named": {
    "message": "Permanently delete the goal \"{goalName}\"? This cannot be undone.",
    "description": "Confirm permanently deleting a GOAL from the Deleted box. See purge_delete_task_named."
  },
  "purge_delete_task_named": {
    "message": "Permanently delete the task \"{taskName}\"? This cannot be undone.",
    "description": "Confirm permanently deleting a TASK from the Deleted box. Separate from the goal wording on purpose: a translated noun spliced into a sentence inflects with the article and case in most languages."
  },
  "restore_restore_all_count": {
    "message": "Restore All ({count})",
    "description": "Button that reopens every tab in a saved session. {count} is the tab count. NOT a plural: a parenthesised numeral with no noun to inflect."
  },
  "sessions_assign_to_task": {
    "message": "Assign a session to {taskName}",
    "description": "Title of the session picker. {taskName} is the user's task title."
  },
  "settings_last_backed_up": {
    "message": "Last backed up {date}.",
    "description": "{date} is an ALREADY-FORMATTED short date such as '31 Aug'. Do not reformat it."
  },
  "settings_launchpad_version": {
    "message": "LaunchPad v{version}",
    "description": "Version line in Settings and Pro Settings. {version} is the manifest version string."
  },
  "tagpalette_choose_color": {
    "message": "Choose {colorName}",
    "description": "Accessible name for one swatch in the tag colour palette. {colorName} is a colour name from the palette. Names the ACTION and the colour; it replaced 'Color butter-yellow', which read a slug aloud."
  },
  "templates_template_deleted": {
    "message": "Template \"{templateName}\" deleted.",
    "description": "Undo toast after deleting a goal template. {templateName} is user-supplied."
  },
  "workspace_switcher_title": {
    "message": "Workspace: {workspaceName}",
    "description": "Tooltip on the workspace switcher. {workspaceName} is user-supplied and falls back to the workspace id."
  },
  "groupdelete_move_shortcuts_to": {
    "plural": {"one": "Move {count} shortcut to:", "other": "Move {count} shortcuts to:"},
    "description": "Label above the group picker when deleting a group that still holds shortcuts. {count} is how many will move. Replaced a sentence split by a <span> value holder."
  }
});


// ====================================================================
// [1.5.0] R4 stage 1 - TAG_PALETTE colour names
// ====================================================================
I18n.register("en", {
  "color_blue": {
    "message": "Blue",
    "description": "Colour name for the tag palette swatch blue. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  },
  "color_green": {
    "message": "Green",
    "description": "Colour name for the tag palette swatch green. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  },
  "color_orange": {
    "message": "Orange",
    "description": "Colour name for the tag palette swatch orange. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  },
  "color_red": {
    "message": "Red",
    "description": "Colour name for the tag palette swatch red. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  },
  "color_purple": {
    "message": "Purple",
    "description": "Colour name for the tag palette swatch purple. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  },
  "color_teal": {
    "message": "Teal",
    "description": "Colour name for the tag palette swatch teal. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  },
  "color_yellow": {
    "message": "Yellow",
    "description": "Colour name for the tag palette swatch yellow. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  },
  "color_magenta": {
    "message": "Magenta",
    "description": "Colour name for the tag palette swatch magenta. Used by tagColorName(); the swatch label reads 'Choose <name>' rather than the hex code."
  }
});


// ====================================================================
// [1.5.0] R4 stage 1b
// ====================================================================
I18n.register("en", {
  "insights_today": {
    "message": "today",
    "description": "The 1-day Insights window as it reads INSIDE a chart title (\"Deep work, today\") - lower case on purpose. The segmented button above the charts says \"Today\" and is a separate string."
  }
});


// ====================================================================
// [1.5.0] R4 stage 2 - plurals, real CLDR forms
// ====================================================================
I18n.register("en", {
  "clear_completed_confirm": {
    "plural": {"one": "Move 1 completed item to Deleted? They stay recoverable for 30 days.", "other": "Move all {count} completed items to Deleted? They stay recoverable for 30 days."},
    "description": "Confirm moving completed tasks to the Deleted box."
  },
  "empty_trash_confirm": {
    "plural": {"one": "Permanently delete 1 item? This cannot be undone.", "other": "Permanently delete all {count} items? This cannot be undone."},
    "description": "Confirm emptying the Tasks Deleted box. The one-form drops the 'all', which read as 'Permanently delete all 1 item?' while the count and the noun were assembled separately."
  },
  "group_opened_tabs_toast": {
    "plural": {"one": "Opened 1 tab from {groupName}", "other": "Opened {count} tabs from {groupName}"},
    "description": "Toast after opening every shortcut in a group. {groupName} is the user's group name."
  },
  "groupdelete_group_has_shortcuts": {
    "plural": {"one": "This group has 1 shortcut. You can move it to another group or delete everything.", "other": "This group has {count} shortcuts. You can move them to another group or delete everything."},
    "description": "Message in the delete-group dialog. The one-form says 'it' rather than 'them', which the assembled English could never do."
  },
  "sessions_pages_left_out": {
    "plural": {"one": "{count} browser page was left out.", "other": "{count} browser pages were left out."},
    "description": "Follows sessions_saved_tabs_toast when browser pages were skipped. The VERB inflects with the count too, which is why this is a plural and not an interpolation."
  },
  "sessions_replace_from_window": {
    "plural": {"one": "Replace the 1 saved tab in {sessionName} with the {openCount} open here? The name stays the same.", "other": "Replace the {count} saved tabs in {sessionName} with the {openCount} open here? The name stays the same."},
    "description": "Confirm replacing a saved session's tabs. {count} is the SAVED tab count and selects the form; {openCount} is how many are open now and takes a role name because only one quantity can select. {sessionName} falls back to sessions_this_session."
  },
  "sessions_saved_tabs_toast": {
    "plural": {"one": "Saved {count} tab.", "other": "Saved {count} tabs."},
    "description": "Toast after saving a session. If browser pages were skipped, sessions_pages_left_out follows as a SECOND sentence - the two counts are independent and only one can drive a form."
  },
  "sessions_updated_tabs_toast": {
    "plural": {"one": "Updated to {count} tab.", "other": "Updated to {count} tabs."},
    "description": "Toast after replacing a saved session's tabs from the current window."
  },
  "shortcut_delete_variants_confirm": {
    "plural": {"one": "This shortcut has 1 nested variant. Delete all?", "other": "This shortcut has {count} nested variants. Delete all?"},
    "description": "Native confirm before deleting a shortcut that carries nested variants. Replaces a 'variant(s)' parenthetical, which no language other than English can render that way."
  },
  "trash_moved_to_deleted_toast": {
    "plural": {"one": "Moved 1 item to Deleted", "other": "Moved {count} items to Deleted"},
    "description": "Toast after clearing completed tasks into the Deleted box."
  },
  "trash_permanently_deleted_toast": {
    "plural": {"one": "Permanently deleted 1 item", "other": "Permanently deleted {count} items"},
    "description": "Toast after emptying the Tasks Deleted box."
  },
  "trash_restored_toast": {
    "plural": {"one": "Restored 1 item", "other": "Restored {count} items"},
    "description": "Toast after restoring everything from the Tasks Deleted box."
  },
  "sessions_this_session": {
    "message": "this session",
    "description": "Stands in for a session with no name, INSIDE sessions_replace_from_window. Its own key rather than an English literal spliced into the sentence."
  }
});

// =========================================================================
// [1.5.0] R5.1 - THE CONCATENATED PROSE.
//
// 62 messages for the 78 construction sites the extended gate exposed in
// 483aca1. Every one of these sentences was assembled across a `+` between
// two markup fragments, which is the shape NO pattern could see before that
// commit - so nobody had ever checked them, and a copy pass in [1.11.x]
// rewrote four of them without moving the construction at all.
//
// THE TERNARY IS THE COMMON SHAPE HERE AND ITS BRANCHES STAY SEPARATE KEYS.
// "One still on the board." and "Still a few on the board." are two
// sentences, not one sentence with a number in it; in another language they
// need not share a structure, and collapsing them into a single key with a
// substitution would make the shorter one untranslatable.
//
// THREE SENTENCES WERE ALREADY IN THE CATALOGUE, ON THE PREVIEW SIDE ONLY -
// tasks_no_standalone_tasks, tasks_no_recurring_tasks and tasks_recurring
// were written for renderTasksPreview() while renderTasksTab() kept its own
// literals. That is [1.6.5]'s bug exactly, and the product sites now share
// the preview's keys rather than getting copies.
// =========================================================================
I18n.register("en", {
    "common_empty_note": {
      "description": "Stand-in name for a note with no content yet. ONE key for three sites: the note card, the notes trash row and the note context menu. Replaces note_empty_note and notes_empty_note.",
      "message": "Empty note",
      "sense": "placeholder.name"
    },
    "common_focused_today": {
      "description": "The engine's own figure for time focused today. ONE key for three sites that each carried their own copy: the dashboard hero (dashHeroFocusHtml), the active-task headline (satHeadlineHtml) and the idle headline (satIdleHeadlineHtml). Replaces sat_focused_today, which named only the third. VOCABULARY LAW: 'focused' is engine-measured time and is never blended with worked or estimated time - a translation that softens it to 'worked on' or 'spent' breaks the distinction the whole tracking surface rests on.",
      "message": "Focused today",
      "sense": "label.metric.engine-time"
    },
    "dash_blocking_off": {
      "description": "FOCUS BLOCKING state on the dashboard hero: blocking is not armed. Not the wallpaper-rotation Off (settings_rotate_off), which is a different control on a different surface.",
      "message": "Off",
      "sense": "state.blocking"
    },
    "dash_blocking_on": {
      "description": "FOCUS BLOCKING armed by hand, the third segment of the three-way state.",
      "message": "On",
      "sense": "state.blocking"
    },
    "dash_blocking_on_auto": {
      "description": "FOCUS BLOCKING armed automatically, as opposed to armed by hand. The parenthetical distinguishes it from the manual On beside it.",
      "message": "On (auto)",
      "sense": "state.blocking"
    },
    "dash_continue": {
      "description": "Dashboard call to action when a focus session is running and the user is being invited back to it.",
      "message": "Continue",
      "sense": "action.focus"
    },
    "dash_focused_today_all_workspaces": {
      "description": "Dashboard hero label when the scope is every workspace rather than the active one. The separate sentence, not common_focused_today with a suffix, because the qualifier may not trail the phrase in another language.",
      "message": "Focused today · all workspaces",
      "sense": "label.metric.engine-time"
    },
    "dash_lets_go": {
      "description": "Dashboard call to action on a SUGGESTED task the user has not started. The apostrophe is the typographic one, matching the rest of the product's copy.",
      "message": "Let’s go"
    },
    "dash_more_due_or_overdue_in_tasks": {
      "description": "Dashboard overflow note under the due/overdue list. Separate from dash_more_in_tasks because it counts a different thing and reads as its own sentence. {tasks} is a link, as above.",
      "message": "",
      "plural": {
        "one": "{count} more due or overdue in {tasks}.",
        "other": "{count} more due or overdue in {tasks}."
      }
    },
    "dash_more_in_tasks": {
      "description": "Dashboard overflow note under a truncated goal list: how many more there are and where to see them. {tasks} is a button linking to the Tasks tab, so the whole sentence is one message and the link is a placeholder - a translation that needs the destination first can have it.",
      "message": "",
      "plural": {
        "one": "{count} more in {tasks}.",
        "other": "{count} more in {tasks}."
      }
    },
    "dash_one_still_on_the_board": {
      "description": "End-of-day headline when exactly ONE task remains open. Deliberately NOT the singular form of dash_still_a_few_on_the_board: the two are different sentences in English and need not share a structure in any other language.",
      "message": "One still on the board."
    },
    "dash_resume": {
      "description": "Dashboard call to action when the focus session is PAUSED. Its counterpart is dash_continue, and the two are separate sentences rather than one key with a substitution.",
      "message": "Resume",
      "sense": "action.focus"
    },
    "dash_still_a_few_on_the_board": {
      "description": "End-of-day headline when more than one task remains open. The vaguer count is the point - the surface does not name a number here.",
      "message": "Still a few on the board."
    },
    "demo_clear_examples": {
      "description": "Button that removes the example shortcuts once the user has added one of their own.",
      "message": "Clear examples"
    },
    "demo_right_click_any_page": {
      "description": "Body of the first-run teaching tile. {action} is the bold menu item (demo_add_to_launchpad), a placeholder rather than a fragment boundary so the emphasised term can move.",
      "message": "Right-click any page → {action}. That is the whole habit."
    },
    "demo_your_new_tab_organised": {
      "description": "Body of the first-run welcome tile. One message rather than three fragments - the three sentences are one paragraph and a translation may repunctuate them.",
      "message": "Your new tab, organised your way. Everything below is an example: open it, drag it, rename it, then make this grid yours."
    },
    "freq_daily": {
      "description": "Recurrence frequency option in the New Recurring modal.",
      "message": "Daily",
      "sense": "frequency.recurring"
    },
    "freq_monthly": {
      "description": "Recurrence frequency option in the New Recurring modal. NOT the billing period with the same word (upgrade_monthly), which names a subscription term.",
      "message": "Monthly",
      "sense": "frequency.recurring"
    },
    "freq_weekly": {
      "description": "Recurrence frequency option in the New Recurring modal.",
      "message": "Weekly",
      "sense": "frequency.recurring"
    },
    "goalconflict_due_after_deadline": {
      "description": "Body of the modal shown when a task's due date falls after its goal's deadline. One sentence with three values rather than four fragments, so a translation can put the dates where its grammar needs them.",
      "message": "This task’s due date ({taskDate}) is after {goalName} deadline ({goalDate}). Extend the goal deadline to match?"
    },

    "insights_history_starts": {
      "description": "Note under the Insights range selector naming the first day with any recorded history. {date} is already formatted by the locale date formatter. Rendered ONLY when the profile has focus time somewhere in the retention window; a profile with none gets insights_history_none instead, because on an empty profile this date is the retention boundary rather than anything the data supports.",
      "message": "History starts {date}"
    },
    "insights_history_none": {
      "description": "Replaces insights_history_starts under the Insights range selector when the profile has NO focus time anywhere in the retention window. States the absence rather than naming the retention boundary, which on an empty profile is a fact about the system and not about the user. VOCABULARY LAW: 'focus time' is the engine's measured figure, not self-reported effort. Rendered with th().",
      "message": "No focus time recorded yet."
    },
    "insights_tag_overlap_note": {
      "description": "One line beneath the Insights tag donut legend, rendered ONLY when the tag totals exceed the period total - i.e. when multi-tagged sessions have made them overlap. INFORMATION, NOT A WARNING: it explains why the parts add up to more than the whole and why no Untagged slice is drawn, both of which are otherwise silent. Matches what the CSV export's tag_note row already says. Rendered with th().",
      "message": "A session can carry several tags, so these add up to more than the period total and untagged time is not shown."
    },
    "insights_no_focus_time_in_range": {
      "description": "Empty state for the tag donut. VOCABULARY LAW: 'focus time' is the engine's measured figure, not self-reported effort.",
      "message": "No focus time tracked in the {range} yet."
    },
    "insights_no_site_time_in_range": {
      "description": "Empty state for the top-sites list. 'Site time' is time on a web domain, which is measured separately from task focus.",
      "message": "No site time tracked in the {range} yet."
    },
    "insights_no_task_focus_in_range": {
      "description": "Empty state for the top-tasks list. Distinct from insights_no_focus_time_in_range: this one is about time attributed to TASKS specifically, and a translation that flattens the two loses which chart is empty.",
      "message": "No task focus tracked in the {range} yet."
    },
    "insights_time_by_site_range": {
      "description": "Insights card title for the per-site list.",
      "message": "Time by site · {range}"
    },
    "insights_time_by_tag_range": {
      "description": "Insights card title for the tag donut.",
      "message": "Time by tag · {range}"
    },
    "insights_top_tasks_range": {
      "description": "Insights card title for the per-task list.",
      "message": "Top tasks · {range}"
    },
    "picker_search_goals": {
      "description": "Search placeholder in the goal picker modal.",
      "message": "Search goals",
      "sense": "placeholder.search"
    },
    "picker_search_sessions": {
      "description": "Search placeholder in the session picker modal. SENSE OF 'SESSION': a saved set of tabs.",
      "message": "Search sessions",
      "sense": "placeholder.search"
    },
    "picker_search_tasks": {
      "description": "Search placeholder in the session-attach picker modal. Distinct from dash_three_search and sat_search_tasks, which are the same words on two other pickers.",
      "message": "Search tasks",
      "sense": "placeholder.search"
    },
    "protour_next": {
      "description": "Advances the Pro tour. The final step shows common_done instead.",
      "message": "Next",
      "sense": "action.generic"
    },
    "recurring_activate": {
      "description": "Context-menu action that resumes a paused recurring template. Counterpart of recurring_pause and a separate sentence from it.",
      "message": "Activate",
      "sense": "action.template"
    },
    "recurring_pause": {
      "description": "Context-menu action that stops a recurring template generating new instances. Not the tracking Pause in the toolbar popup (companion_pause), which pauses measurement.",
      "message": "Pause",
      "sense": "action.template"
    },
    "recurringdrop_instance_or_template": {
      "description": "Body of the modal shown when a recurring INSTANCE is dragged onto a goal. One message, not three fragments: the question depends on the explanation before it and a translation may need to reorder them.",
      "message": "This is an instance of a recurring task. Move the whole template into this goal (future instances will belong to it), or move just this occurrence?"
    },
    "sat_end_for_now": {
      "description": "Focus-card button that stops tracking WITHOUT completing the task. The wording is deliberately not 'Cancel' or 'Stop': nothing is discarded.",
      "message": "End for now",
      "sense": "action.task"
    },
    "sessions_on_task_name": {
      "description": "Tail of the session row naming the task a session is attached to, after a separator glyph. Reads as '... 5 tabs · on Write the report'.",
      "message": "on {name}"
    },
    "sessions_saved_at": {
      "description": "Timestamp line on a saved session row, reading 'Saved at 2:07 pm'. {time} is ALREADY FORMATTED by the browser's locale clock - a translation must not re-order the digits or add its own AM/PM, only move the words around the placeholder. Languages that put the time first can do so; the placeholder is the whole time, not the hour.",
      "message": "Saved at {time}",
      "sense": "label.timestamp.session.saved-tabs"
    },
    "sessions_untitled_session": {
      "description": "Stand-in name for a saved session the user never named. ONE key for three sites: the session row, the session trash row and the session picker. SENSE OF 'SESSION': a saved set of tabs.",
      "message": "Untitled session",
      "sense": "placeholder.name.session.saved-tabs"
    },
    "task_assign_to_a_goal": {
      "description": "Task context-menu action when the task has no goal yet. A separate sentence from task_move_to_another_goal rather than one key with a substitution.",
      "message": "Assign to a goal"
    },
    "task_move_to_another_goal": {
      "description": "Task context-menu action when the task ALREADY belongs to a goal.",
      "message": "Move to another goal"
    },
    "tasks_no_recurring_tasks_match_filter": {
      "description": "Tasks tab empty state when a TAG FILTER has hidden every recurring template. Counterpart of tasks_no_recurring_tasks, which is the genuinely-empty case.",
      "message": "No recurring tasks match the current filter."
    },
    "tasks_no_standalone_tasks_match_filter": {
      "description": "Tasks tab empty state when a FILTER has hidden everything. Its counterpart tasks_no_standalone_tasks is the genuinely-empty case; the two are different sentences and must not be collapsed.",
      "message": "No standalone tasks match the current filter."
    },
    "tasks_preview_active": {
      "description": "Lower-case badge word on the free-tier Tasks PREVIEW, followed by a separator and the elapsed time. Lower case deliberately - it sits mid-phrase, not as a heading.",
      "message": "active",
      "sense": "state.task"
    },
    "tasks_preview_completed_zero": {
      "description": "Section heading on the free-tier Tasks PREVIEW. The zero is BAKED IN because the preview shows a fixed illustrative board rather than the user's data; the real surface counts (tasks_section_completed).",
      "message": "Completed (0)",
      "sense": "heading.section"
    },
    "tasks_section_completed": {
      "description": "SECTION HEADING on the real Tasks tab, followed by a count badge. Not the status FILTER option with the same word (tasks_status_completed), which is a dropdown choice.",
      "message": "Completed",
      "sense": "heading.section"
    },
    "tasks_section_deleted": {
      "description": "SECTION HEADING for the Tasks tab trash, followed by a count badge.",
      "message": "Deleted",
      "sense": "heading.section"
    },
    "tasks_trash_days_left": {
      "description": "Countdown on a trashed item: how long before it is purged. The singular is a separate form rather than an English '+ s'.",
      "message": "",
      "plural": {
        "one": "{count} day left",
        "other": "{count} days left"
      }
    }
  });

// =========================================================================
// [1.5.0] R5.2 - MODAL AND CONFIRM COPY.
//
// 42 messages. TWO POPULATIONS, and the second is the finding:
//
//   29 the gate could see, which the `modal-copy` pattern had caught by its
//      PROPERTY NAME (title / message / label) rather than because they were
//      modals - context menus, OS notifications, inline validation errors,
//      licence-client errors and nine example shortcut titles.
//
//   13 the gate CANNOT see, which are the actual confirm sentences. Eight of
//      the product's fourteen confirm dialogs had a hardcoded half, and only
//      TWO of those halves were in the gate's list. Two of the invisible ones
//      say "This cannot be undone."
//
// A CONFIRM'S TITLE, SENTENCE AND BUTTON ARE ONE UNIT OF MEANING. Every
// description here names its two siblings, so a translator changing one is
// told what the other two say. "Delete" beside "This cannot be undone" is a
// different dialog from "Delete" beside "You can restore this from Trash",
// and a string list cannot show that on its own.
// =========================================================================
I18n.register("en", {
    "block_already_on_list": {
      "description": "Inline error under the focus-blocking input when the typed site is already blocked. {site} is the NORMALISED host the writer resolved, not the raw text the user typed, so it may differ from what is still in the input. The third of the three inline errors from the same writer; the other two are block_enter_a_site and block_not_a_site.",
      "message": "{site} is already on the list"
    },
    "block_enter_a_site": {
      "description": "Inline error under the focus-blocking input when nothing was typed.",
      "message": "Enter a site to block."
    },
    "block_not_a_site": {
      "description": "Inline error when the typed value is not a recognisable domain. The example is deliberately a real, well-known site; it is an ILLUSTRATION and a translation may substitute one that reads as familiar locally.",
      "message": "That doesn't look like a site. Try youtube.com"
    },
    "common_confirm": {
    "message": "Confirm",
    "sense": "action.generic",
    "description": "Fallback label for a confirm dialog's affirmative button, used only when a caller supplies none. Every caller supplies one today, so it does not render; it exists so that a caller which forgets is still translated. Its partner is common_cancel."
  },
  "clip_saved_body": {
    "message": "Saved to your notes.",
    "description": "Body of the notification confirming a selection was clipped to a note. Short because the notification arrives over whatever page the user is reading and should not detain them."
  },
  "clip_saved_title": {
    "message": "Clipped to LaunchPad",
    "description": "Title of the notification confirming a selection was clipped. LaunchPad is the product name and is NOT translated."
  },
  "clip_saved_truncated": {
    "message": "Saved to your notes. The selection was longer than {count} characters, so the end was trimmed.",
    "description": "Replaces clip_saved_body when the selection exceeded the note cap. It names the cap rather than saying only that something was cut, because a user who is told text went missing and not how much cannot tell whether to go back for it."
  },
  "ctxmenu_clip_selection": {
    "message": "Save to LaunchPad note",
    "description": "Item in the browser right-click menu, shown only when text is selected. Saves the selection and the page address as a note. LaunchPad is the product name and is NOT translated. It sits beside Add to LaunchPad rather than inside it: that one saves a page into a group, this one saves text into a note."
  },
  "clear_completed_title": {
      "description": "TITLE of the clear-completed confirm. Its sentence is clear_completed_confirm and its button is clear_move_to_deleted; the three are ONE dialog and the title must not drift from the sentence promising the items stay recoverable.",
      "message": "Clear completed?",
      "sense": "title.confirm"
    },
    "ctxmenu_add_to_launchpad": {
      "description": "Top-level item in the browser's right-click menu. 'LaunchPad' is the product name and is NOT translated.",
      "message": "Add to LaunchPad"
    },
    "ctxmenu_new_group": {
      "description": "Right-click submenu item that creates a group for the page being saved. The leading plus and the ellipsis are part of the label.",
      "message": "+ New Group..."
    },
    "demoshortcut_calendar": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - Google Calendar, as its tile is labelled. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "Calendar",
      "sense": "brand.name"
    },
    "demoshortcut_docs": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - Google Docs, as its tile is labelled. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "Docs",
      "sense": "brand.name"
    },
    "demoshortcut_github": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - the code host. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "GitHub",
      "sense": "brand.name"
    },
    "demoshortcut_gmail": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - the mail service. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "Gmail",
      "sense": "brand.name"
    },
    "demoshortcut_google": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - the search engine. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "Google",
      "sense": "brand.name"
    },
    "demoshortcut_linkedin": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - the professional network. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "LinkedIn",
      "sense": "brand.name"
    },
    "demoshortcut_maps": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - Google Maps, as its tile is labelled. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "Maps",
      "sense": "brand.name"
    },
    "demoshortcut_wikipedia": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - the encyclopedia. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "Wikipedia",
      "sense": "brand.name"
    },
    "demoshortcut_youtube": {
      "description": "Title of an EXAMPLE shortcut seeded on first run - the video site. BRAND NAME: do not invent a translation. Use the name the service itself uses in this language, and leave it in English where it has none. These are copied into the user's own groups at seed time and are renameable, so a later locale change does not rewrite them.",
      "message": "YouTube",
      "sense": "brand.name"
    },
    "goal_complete_strands_tasks": {
      "description": "SENTENCE of the complete-goal confirm when the goal still holds unfinished tasks. Title is goal_complete_this_goal, button is goal_complete_goal. NOT destructive - it says where the tasks go, which is the whole point of asking.",
      "message": "",
      "plural": {
        "one": "\"{goalName}\" still has {count} unfinished task. Completing the goal moves it to Standalone so it stays visible.",
        "other": "\"{goalName}\" still has {count} unfinished tasks. Completing the goal moves them to Standalone so they stay visible."
      }
    },
    "goal_delete_also_removes": {
      "description": "SECOND sentence of the delete-goal confirm, appended to goal_delete_confirm only when the goal holds live tasks. Separate because it is conditional: a goal with no tasks never shows it, and a translation must be able to punctuate the pair for itself.",
      "message": "",
      "plural": {
        "one": "This will also remove its {count} task.",
        "other": "This will also remove its {count} tasks."
      }
    },
    "goal_delete_confirm": {
      "description": "SENTENCE of the delete-goal confirm. Title is goal_delete_goal, button is common_delete. DESTRUCTIVE. When the goal still holds tasks, goal_delete_also_removes follows it as a second sentence.",
      "message": "Delete goal \"{goalName}\"?"
    },
    "license_missing_arguments": {
      "description": "Precondition failure inside the licence client. Reachable only from a programming error, never from a user action, but it can surface through the same status line as the three above, so it is migrated with them.",
      "message": "data and licenseKey are required.",
      "sense": "error.license"
    },
    "license_request_rejected": {
      "description": "Shown when the licence host returns 4xx. Vendor name untranslated, as above.",
      "message": "Dodo request rejected ({status}).",
      "sense": "error.license"
    },
    "license_server_error": {
      "description": "Shown when the licence host returns 5xx. 'Dodo' is the payment vendor's name and is NOT translated. The status number is the HTTP code.",
      "message": "Dodo server error ({status}).",
      "sense": "error.license"
    },
    "license_unexpected_response": {
      "description": "Shown when the licence host answers with something unrecognised. Vendor name untranslated, as above.",
      "message": "Unexpected response from Dodo (status {status}).",
      "sense": "error.license"
    },
    "license_network_error": {
      "description": "Shown when the fetch to the licence host never completed at all - offline, DNS, a blocked host. Vendor name untranslated, as above. THIS IS THE ONE THE USER ACTUALLY SEES ON A DEAD NETWORK: before this key existed the popover rendered the browser's own raw fetch message ('Failed to fetch'), which names nothing the user can act on. The raw message is still carried on the result object for the console; this sentence is what reaches the screen.",
      "message": "Network error contacting Dodo.",
      "sense": "error.license"
    },
    "notes_empty_trash_confirm": {
      "description": "SENTENCE of the empty-notes-trash confirm. Its title is empty_empty_the_notes_trash and its button is empty_empty_trash; the three are ONE dialog. DESTRUCTIVE AND IRREVERSIBLE - the sentence says so, and a translation that drops 'This cannot be undone' removes the only warning the user gets.",
      "message": "",
      "plural": {
        "one": "1 note will be removed for good. This cannot be undone.",
        "other": "{count} notes will be removed for good. This cannot be undone."
      }
    },
    "notif_break_time_body": {
      "description": "BODY of the break notification, naming how long was focused. VOCABULARY LAW: 'focused' is the engine's measured time and must not soften to 'worked' or 'spent'. Its title is notif_break_time_title.",
      "message": "",
      "plural": {
        "one": "Nice, {count} min focused.",
        "other": "Nice, {count} min focused."
      }
    },
    "notif_break_time_title": {
      "description": "TITLE of the OS notification fired when a focus interval ends and a break begins. Its body is notif_break_time_body; the two are ONE notification.",
      "message": "Break time"
    },
    "notif_session_complete_body": {
      "description": "BODY of the session-complete notification. Its button is notif_start_next_session and the pair is ONE notification: the question and the answer must stay consistent.",
      "message": "Ready for another?"
    },
    "notif_session_complete_title": {
      "description": "TITLE of the OS notification fired when a whole pomodoro cadence finishes. SENSE OF 'SESSION': a focus interval, not a saved set of tabs and not a browser session. Body is notif_session_complete_body, button is notif_start_next_session.",
      "message": "Session complete",
      "sense": "title.notification.session.focus-interval"
    },
    "notif_start_next_session": {
      "description": "BUTTON on the session-complete notification. SENSE OF 'SESSION': a focus interval. It answers notif_session_complete_body.",
      "message": "Start next session",
      "sense": "action.notification.session.focus-interval"
    },
    "pt_time_on_tasks": {
      "description": "Sub-heading of the first list: the part of today's site time that had a task active. ENGINE-MEASURED TIME ON WEB PAGES, today only - not wall clock, not session length. The distinction is the whole reason this section exists: a focus session that ran for ten minutes on a PDF records nothing here, and a user who does not know that reads the number as a broken timer. Its peer is pt_time_on_other_sites and the two SUM to the total - they are not overlapping views of one quantity. Do not translate as 'focused', which this product reserves for all engine-measured time and which therefore applies to BOTH lists.",
      "message": "Time on tasks"
    },
    "pt_time_on_other_sites": {
      "description": "Sub-heading of the second list: today's site time with NO task active. ENGINE-MEASURED TIME ON WEB PAGES, today only - not wall clock, not session length. The distinction is the whole reason this section exists: a focus session that ran for ten minutes on a PDF records nothing here, and a user who does not know that reads the number as a broken timer. The word OTHER carries the arithmetic - these are the sites that are not already counted in pt_time_on_tasks above, so the two lists sum rather than overlap. The export already calls this category '(no task)'; this is the same quantity in the interface's voice.",
      "message": "Time on other sites"
    },
    "pt_no_time_on_tasks": {
      "description": "Shown in place of the first list when today has site time but none of it had a task active - the common case for a user who has never started a task. Says what to do, not that something is missing. ENGINE-MEASURED TIME ON WEB PAGES, today only - not wall clock, not session length. The distinction is the whole reason this section exists: a focus session that ran for ten minutes on a PDF records nothing here, and a user who does not know that reads the number as a broken timer. ",
      "message": "No task was active today. Start one to see time here."
    },
    "pt_more_sites": {
      "description": "Row under the site list when more domains were visited than the list shows. {count} is how many are NOT displayed. The hidden ones are still counted in the total above.",
      "message": "{count} more"
    },
    "recur_invalid_day_of_month": {
      "description": "Inline error when the monthly day-of-month is out of range. REWRITTEN 2026-09-17 from \"Monthly templates require dayOfMonth as an integer 1-31.\" - it named a stored field rather than the control, which is labelled Day of month. The range matches that input's own min and max, so the sentence and the control cannot drift apart.",
      "message": "That day of month is out of range. Choose a day from 1 to 31."
    },
    "recur_invalid_day_of_week": {
      "description": "Inline error for a malformed day-of-week list, reachable from an import or a restore rather than from the modal, which offers seven checkboxes. REWRITTEN 2026-09-17 from \"daysOfWeek values must be integers 0-6.\", which named a stored field and its numeric encoding; the control is labelled Days of week and the user ticks named days. DELIBERATELY NOT the same sentence as recur_weekly_requires_days: that one means \"you ticked none\" and this one means \"what arrived was not readable\", and a user who can act on the first cannot act on the second.",
      "message": "Some of the days of week were not recognised. Tick the days this task should repeat on."
    },
    "recur_invalid_frequency": {
      "description": "Inline error when the recurrence frequency is none of the three offered, reachable from an import or a restore rather than from the modal, whose select carries exactly those three, and not from quick-add, whose parser emits only those three. REWRITTEN 2026-09-17 from a field name and a quoted enum. The three words name the OPTIONS the Frequency select shows, so a translation moves them together with the options.",
      "message": "That frequency was not recognised. Choose daily, weekly or monthly."
    },
    "recur_weekly_requires_days": {
      "description": "Inline error in the New Recurring modal when the weekly frequency is chosen and no day is ticked. The only one of the three pattern errors a user can reach through the UI.",
      "message": "Weekly templates require at least one day-of-week."
    },
    "session_move_and_replace": {
      "description": "Confirm sentence for the case where BOTH happen at once - the session leaves a task and displaces another. The third of three distinct sentences, because two things change and the user is told about both.",
      "message": "{sessionName} is attached to {fromTask}, and {toTask} already has {otherSession}. Move it and replace that one?"
    },
    "session_move_from_task": {
      "description": "Confirm sentence when a session is being moved OFF one task ONTO another and nothing is displaced. Title is session_move_this_session, button is session_move_it.",
      "message": "{sessionName} is attached to {fromTask}. Move it to {toTask}?"
    },
    "session_replace_on_task": {
      "description": "Confirm sentence when the destination task already holds a different session and nothing is being moved off. A separate sentence from session_move_from_task, not a variant of it.",
      "message": "{toTask} already has {otherSession} attached. Replace it with {sessionName}?"
    },
    "sessions_empty_trash_confirm": {
      "description": "SENTENCE of the empty-sessions-trash confirm. Title is empty_empty_the_sessions_trash, button is empty_empty_trash_3. DESTRUCTIVE AND IRREVERSIBLE. SENSE OF 'SESSION': a saved set of tabs.",
      "message": "",
      "plural": {
        "one": "1 session will be removed for good. This cannot be undone.",
        "other": "{count} sessions will be removed for good. This cannot be undone."
      },
      "sense": "confirm.session.saved-tabs"
    },
    "sessions_purge_confirm": {
      "description": "SENTENCE of the confirm that permanently deletes ONE saved session. Title is purge_delete_permanently_5, button is purge_delete_permanently_6. DESTRUCTIVE AND IRREVERSIBLE. {sessionName} is the session's own name, or sessions_this_session_start when it has none.",
      "message": "{sessionName} will be removed for good. This cannot be undone.",
      "sense": "confirm.session.saved-tabs"
    },
    "sessions_this_session_start": {
      "description": "SENTENCE-INITIAL form of sessions_this_session, used where an unnamed session begins the sentence. Two keys for one phrase because English capitalises here and mid-sentence does not; a language that does neither will make them identical, which is correct.",
      "message": "This session",
      "sense": "placeholder.name.sentence-initial"
    },
    "sessions_update_from_window_title": {
      "description": "TITLE of the confirm that replaces a saved session's tabs with the open ones. Its sentence is sessions_replace_from_window and its button is session_replace_tabs; all three are ONE dialog.",
      "message": "Update from current window",
      "sense": "title.confirm"
    },
    "tag_duplicate_name": {
      "description": "Inline error when a new or renamed tag collides with a live one. The name is quoted so the user can see exactly which one clashed.",
      "message": "A tag named '{name}' already exists in this workspace."
    },
    "tag_restore_name_taken": {
      "description": "Inline error when RESTORING a trashed tag whose name is now taken. Distinct from tag_duplicate_name: this one is about a restore and names the remedy.",
      "message": "An active tag already has this name. Rename it first."
    },
    "task_goal_collision_confirm": {
      "description": "SENTENCE of the name-collision confirm, shown from BOTH the drag path (refresh_name_conflict / refresh_rename_and_add) and the menu path (task_name_conflict / task_rename_and_move). ONE key for both, because it is one sentence - the two dialogs differ in title and button, not in what they explain.",
      "message": "A task named \"{name}\" already exists in this goal. Rename to \"{suggested}\" or cancel?"
    },
    "tasks_preview_pickup_goal": {
      "description": "Goal name under tasks_preview_pickup_title in the same preview fixture. The leading preposition is part of the phrase as rendered.",
      "message": "in Q3 reporting",
      "sense": "fixture.preview"
    },
    "tasks_preview_pickup_title": {
      "description": "Task name in the FIXTURE board the free-tier Tasks preview shows. Not the user's data - the preview renders a fixed illustrative board, so this is copy the way a screenshot's contents are copy.",
      "message": "Ship the Q3 report",
      "sense": "fixture.preview"
    }
  });

// =========================================================================
// [1.5.0] R5.3 - THE LAST GATE-VISIBLE STRINGS.
//
// 9 messages, and the small number is the point: FIVE of the nine sites
// the gate still listed were sentences the catalogue ALREADY HELD.
//   "That's the day"        -> dash_that_s_the_day, already used ten lines
//                              below the literal, in the same function
//   "Focused today"         -> common_focused_today  (preview shares the
//   "Continue"              -> dash_continue          product's key, and
//   "Good afternoon"        -> clock_good_afternoon   [1.6.5] is why)
//   "Focus blocking is on"  -> sat_focus_blocking_is_on
//
// THE BLOCKING GATE PAGE IS THE ROUND'S FINDING IN MINIATURE. It carries
// SEVEN user-facing strings and the gate could see TWO. "Turn off focus"
// appears twice and only the first was counted; migrating that one alone
// would have left a key and a literal holding one sentence. The whole block
// is one if/else chain in one function, so it was taken together.
//
// A FORMATTED QUANTITY IS A VALUE, NOT A SENTENCE FRAGMENT. fmtMinutes now
// returns a plural-resolved duration that feeds the {duration} placeholder
// of gate_focused_on_task and gate_focused_so_far, exactly as R5.0's date
// formatter feeds a {date}. That keeps rule 1 intact - nothing is
// concatenated around a t() call - without inventing a new rule for it.
// =========================================================================
I18n.register("en", {
    "bookmarks_no_folders_found": {
      "description": "TITLE of the empty state shown in the bookmark import picker when no folder contains any bookmark. Sibling HINT is bookmarks_empty_hint, shared with the bookmarks panel's own empty state. Was delivered through a NATIVE alert() until 2026-09-15 (Asana 1217995910218382); it is an empty state rather than a decision, so it is rendered in the picker that raised it. Historic note kept because the wording still reads as a dialog sentence: which is why it carries no title and no second button - task 1217995910218382 owns replacing that dialog.",
      "message": "No bookmark folders with bookmarks found."
    },
    "gate_blocking_domain": {
      "description": "Footnote on the gate page naming the site that was intercepted and the fact that the rule covers its subdomains. {domain} is the bare host the user typed into the block list. [WM.3] It read 'while focus is on', which became false the moment a schedule or a budget could be the reason - seen on a budget gate frame, directly under a line that had just said the budget was spent. The REASON LINE says when; this says what the rule covers, which is the part it alone knows.",
      "message": "Blocking {domain} and its subdomains."
    },
    "gate_end_focus_session": {
      "description": "End-control label on the blocking gate page when a focus session IS running. SENSE OF 'SESSION': a focus interval, not a saved set of tabs. Counterpart of gate_turn_off_focus.",
      "message": "End focus session",
      "sense": "action.gate.session.focus-interval"
    },
    "gate_focused_on_task": {
      "description": "Context line on the blocking gate page while a focus session runs on a named task. VOCABULARY LAW: 'focused' is the engine's measured time and must not soften to 'worked on' or 'spent'.",
      "message": "{duration} focused on {taskName}"
    },
    "gate_focused_so_far": {
      "description": "Context line on the gate page while a focus session runs with NO task attached. Same vocabulary law as gate_focused_on_task; a separate sentence because there is no task to name.",
      "message": "{duration} focused so far"
    },
    "gate_less_than_a_minute": {
      "description": "Duration shown on the gate page when under a minute has elapsed. Feeds the {duration} placeholder of gate_focused_on_task and gate_focused_so_far, so it reads mid-sentence and is lower case on purpose.",
      "message": "less than a minute",
      "sense": "duration.value"
    },
    "gate_minutes": {
      "description": "Elapsed minutes on the gate page. A VALUE, not a sentence: it feeds the {duration} placeholder of gate_focused_on_task and gate_focused_so_far the way a formatted date feeds one.",
      "message": "",
      "plural": {
        "one": "{count} minute",
        "other": "{count} minutes"
      }
    },
    "gate_turn_off_focus": {
      "description": "End-control label on the blocking gate page when NO focus session is running - manual blocking is on and the click will switch it off. Its counterpart is gate_end_focus_session; C6 requires the label to name exactly what the click will do, so the two must not be merged.",
      "message": "Turn off focus",
      "sense": "action.gate"
    },
    "launcher_search_results": {
      "description": "ACCESSIBLE NAME of the Home launcher's results list. Never rendered as visible text - it is the aria-label a screen reader announces when focus enters the list.",
      "message": "Search results",
      "sense": "a11y.label"
    }
  });

// =========================================================================
// [1.5.0] R5.4 - THE THREE DESTRUCTIVE STRINGS, MIGRATED BEFORE THE FLIP.
//
// None of the three was ever counted by the gate, and all three warn about
// losing something. Two are NATIVE confirm() dialogs, which is why nothing
// reached them: the gate's native-dlg pattern reads the call's first
// argument as a literal, and both of these begin with a concatenation. The
// third is an aria-label assembled by a ternary with no markup anywhere.
//
// THEY ARE MIGRATED FIRST, BEFORE ENFORCING GOES TRUE, because a flag that
// turns green over three irreversible-loss warnings would be the exact
// false all-clear this task's blocker was opened to prevent.
// =========================================================================
I18n.register("en", {
    "dialog_delete_workspace_title": {
      "message": "Delete workspace?",
      "description": "TITLE of the destructive confirm shown before a workspace is deleted. Sibling SENTENCE is workspace_delete_confirm; sibling ACTION is dialog_delete_workspace_action; sibling CANCEL is common_cancel. Was a native window.confirm with no title at all until 2026-09-15."
    },
    "dialog_delete_workspace_action": {
      "message": "Delete workspace",
      "description": "ACTION label on the destructive confirm before a workspace is deleted. Sibling TITLE is dialog_delete_workspace_title; sibling SENTENCE is workspace_delete_confirm. Names the act rather than saying OK, because the button is the last thing read before an irreversible delete."
    },
    "dialog_remove_license_title": {
      "message": "Remove licence key?",
      "description": "TITLE of the destructive confirm shown before a Pro licence key is cleared. Sibling SENTENCE is license_remove_confirm; sibling ACTION is dialog_remove_license_action; sibling CANCEL is common_cancel."
    },
    "dialog_remove_license_action": {
      "message": "Remove key",
      "description": "ACTION label on the confirm before a Pro licence key is cleared. Sibling TITLE is dialog_remove_license_title; sibling SENTENCE is license_remove_confirm."
    },
    "dialog_restore_backup_title": {
      "message": "Restore this backup?",
      "description": "TITLE of the destructive confirm shown before a backup file replaces the current data. Sibling SENTENCE is built by backupConfirmMessage (which composes several catalogue strings); sibling ACTION is dialog_restore_backup_action; sibling CANCEL is common_cancel."
    },
    "dialog_restore_backup_action": {
      "message": "Replace my data",
      "description": "ACTION label on the confirm before a backup is restored over the user's current data. Sibling TITLE is dialog_restore_backup_title. Says what it replaces rather than Restore, because Restore reads as additive and this is not."
    },
    "dialog_delete_variants_title": {
      "message": "Delete shortcut and its variants?",
      "description": "TITLE of the destructive confirm shown before a shortcut carrying variants is deleted. Sibling SENTENCE is shortcut_delete_variants_confirm, which carries the count; sibling ACTION is dialog_delete_variants_action; sibling CANCEL is common_cancel."
    },
    "dialog_delete_variants_action": {
      "message": "Delete all",
      "description": "ACTION label on the confirm before a shortcut and its variants are deleted. Sibling TITLE is dialog_delete_variants_title; sibling SENTENCE is shortcut_delete_variants_confirm."
    },
    "dialog_nest_existing_title": {
      "message": "Nest under the existing shortcut?",
      "description": "TITLE of the NON-destructive confirm offered when an added URL shares a domain with a shortcut already saved. Sibling SENTENCE is addshortcut_domain_exists_nest; sibling ACTION is dialog_nest_existing_action; sibling CANCEL is common_cancel. Cancelling adds it as a separate shortcut, which is why this one is not marked dangerous."
    },
    "dialog_nest_existing_action": {
      "message": "Nest it",
      "description": "ACTION label on the confirm offered when an added URL shares a domain with an existing shortcut. Sibling TITLE is dialog_nest_existing_title; sibling SENTENCE is addshortcut_domain_exists_nest."
    },
    "dialog_rename_variant_title": {
      "message": "Rename variant",
      "description": "TITLE of the text-input dialog that renames a shortcut variant. Sibling FIELD LABEL is dialog_variant_label_field; sibling ACTION is common_save. Replaces a native prompt() with the same question."
    },
    "dialog_variant_label_field": {
      "message": "Label",
      "description": "FIELD LABEL in the rename-variant dialog. Sibling TITLE is dialog_rename_variant_title. One word, because the dialog's title already asked the question."
    },
    "dialog_name_session_title": {
      "message": "Name this session",
      "description": "TITLE of the text-input dialog that names a set of saved tabs. Sibling FIELD LABEL is dialog_session_name_field; sibling ACTION is common_save. The SENTENCE that was the native prompt's question is now the title, so save_name_this_session is no longer rendered at this site."
    },
    "dialog_session_name_field": {
      "message": "Session name",
      "description": "FIELD LABEL in the name-this-session and rename-session dialogs. Sibling TITLES are dialog_name_session_title and dialog_rename_session_title."
    },
    "dialog_rename_session_title": {
      "message": "Rename session",
      "description": "TITLE of the text-input dialog that renames a saved session. Sibling FIELD LABEL is dialog_session_name_field; sibling ACTION is common_save."
    },
    "dialog_new_group_title": {
      "message": "New group",
      "description": "TITLE of the text-input dialog that creates a shortcut group. Sibling FIELD LABEL is dialog_group_name_field; sibling ACTION is dialog_create_group_action."
    },
    "dialog_group_name_field": {
      "message": "Group name",
      "description": "FIELD LABEL in the new-group and rename-group dialogs. Sibling TITLES are dialog_new_group_title and dialog_rename_group_title."
    },
    "dialog_create_group_action": {
      "message": "Create group",
      "description": "ACTION label on the new-group dialog. Sibling TITLE is dialog_new_group_title. Names the act rather than Save, because nothing is being saved over."
    },
    "dialog_rename_group_title": {
      "message": "Rename group",
      "description": "TITLE of the text-input dialog that renames a shortcut group. Sibling FIELD LABEL is dialog_group_name_field; sibling ACTION is common_save."
    },
    "license_remove_confirm": {
      "description": "SENTENCE of the confirm shown before a Pro licence key is cleared. Names the consequence and its remedy in the same breath: access stops, and it comes back on re-entering a valid key. The loss is real but RECOVERABLE, which is why this one does not say 'cannot be undone' and must not be given that phrasing in translation. Native confirm(), so no sibling button keys.",
      "message": "Remove this license? You'll lose Pro access until you re-enter a valid key.",
      "sense": "confirm.destructive"
    },
    "notes_trash_count_label": {
      "description": "ACCESSIBLE NAME and tooltip of the notes-trash bar. The VISIBLE label beside it is notes_trash plus a bare numeral, which needs no pluralisation; this is the sentence a screen reader announces and it does - 'one note in trash' rather than 'Trash 1'. Two keys for one control, deliberately, because a label and a sentence are different things.",
      "message": "",
      "plural": {
        "one": "1 note in trash",
        "other": "{count} notes in trash"
      },
      "sense": "a11y.label"
    },
    "workspace_delete_confirm": {
      "description": "SENTENCE of the confirm shown before a workspace is deleted. DESTRUCTIVE AND IRREVERSIBLE - deleting a workspace takes its goals, tasks, notes and saved sessions with it, and the sentence says so. A translation that drops 'This cannot be undone' removes the only warning the user gets. Delivered through a NATIVE confirm(), which supplies its own OK and Cancel labels - so unlike the in-page dialogs there are no sibling keys to keep this in step with. Not pro_delete_workspace, which is the menu label that opens this.",
      "message": "Delete workspace \"{name}\"? This cannot be undone.",
      "sense": "confirm.destructive"
    }
  });

// =========================================================================
// OT.1 - THE OPEN TABS PANEL.
//
// DECISION 4 OF THE ARC PLAN: every string here that means a SAVED TAB SET
// says "named session", never "session" alone. The word already carries four
// meanings in this product - the tracking engine's focus records, the
// 5-minute auto-restore's savedSessions, the Pomodoro focus session, and the
// browser-restart anchor - and this panel sits next to two of them in the
// sidebar. Each description below says which sense it means so a translator
// is not choosing between four words with no way to tell them apart.
//
// THE PANEL IS "Open tabs", lower-case t, matching "Recently closed" rather
// than the Title Case of the older sidebar entries. Sentence case is the
// design guide's rule (Section 6); the older labels predate it.
// =========================================================================
I18n.register("en", {
    "feature_open_tabs_name": {
      "description": "Sidebar entry and its tooltip for the panel listing every open window and tab. Sits between Bookmarks and Restore Session - the LIVE side of tabs, immediately above the two saved-side entries. Not a saved set: this is what is open right now.",
      "message": "Open tabs",
      "sense": "label.nav.live-tabs"
    },
    "opentabs_panel_heading": {
      "description": "Heading of the Open tabs panel. Matches feature_open_tabs_name exactly; kept as its own key because the sidebar label is width-constrained and a translation may need to shorten one without the other.",
      "message": "Open tabs",
      "sense": "heading.panel"
    },
    "opentabs_panel_intro": {
      "description": "One-line explanation under the Open tabs heading. Says what the list is and what clicking does, because the row click has no visible control of its own.",
      "message": "Every window and tab you have open. Click a tab to switch to it.",
      "sense": "intro.panel"
    },
    "opentabs_filter_placeholder": {
      "description": "Placeholder in the Open tabs filter field. FILTER, not search: it narrows a list already on screen rather than suggesting results for a query. 'address' rather than 'URL' per the copy voice.",
      "message": "Filter by title or address",
      "sense": "placeholder.input.filter"
    },
    "opentabs_filter_clear": {
      "description": "Tooltip and accessible name of the x that empties the Open tabs filter field.",
      "message": "Clear filter",
      "sense": "a11y.label.action"
    },
    "opentabs_this_window": {
      "description": "Group heading for the window the LaunchPad tab is in. It is listed FIRST, so this label is what the user reads before any numbered window.",
      "message": "This window",
      "sense": "heading.group.window"
    },
    "opentabs_window_numbered": {
      "description": "Group heading for any window other than the one LaunchPad is in. {n} is a POSITION IN THIS LIST, counted from 1 - not Chrome's internal window id, which is a large arbitrary number and means nothing to a user.",
      "message": "Window {n}",
      "sense": "heading.group.window"
    },
    "opentabs_switch_to": {
      "description": "Accessible name of the row control that switches to a tab. The whole row is the target; this is what a screen reader announces for it.",
      "message": "Switch to this tab",
      "sense": "a11y.label.action"
    },
    "opentabs_close_tab": {
      "description": "Tooltip and accessible name of the x that closes one tab from the Open tabs panel. Closes the BROWSER TAB, not the panel.",
      "message": "Close tab",
      "sense": "a11y.label.action.destructive"
    },
    "opentabs_this_tab": {
      "description": "Marker shown INSTEAD OF a close control on the row for the LaunchPad tab the panel is open in. A control that cannot act reads as broken, so the row states why there is none.",
      "message": "This tab",
      "sense": "label.state.self"
    },
    "opentabs_this_tab_explain": {
      "description": "Tooltip on opentabs_this_tab. Explains that the panel will not close the tab it is running in, and names where it can be closed instead.",
      "message": "This is the tab the panel is open in. Close it from the browser's tab strip.",
      "sense": "tooltip.explain"
    },
    "opentabs_active_here": {
      "description": "Marker on the ACTIVE tab of each window - the one that window is showing. One per window, so a user scanning several windows can see where each was left.",
      "message": "Active",
      "sense": "label.state.tab"
    },
    "opentabs_pinned": {
      "description": "Marker on a pinned browser tab. Chrome's own term; do not translate to a word that means 'favourite'.",
      "message": "Pinned",
      "sense": "label.state.tab"
    },
    "opentabs_audible": {
      "description": "Marker on a tab that is currently playing sound. Chrome reports this per tab; it says nothing about whether the tab is muted.",
      "message": "Playing audio",
      "sense": "label.state.tab"
    },
    "opentabs_select_tab": {
      "description": "Accessible name of the checkbox that adds one tab to the save selection. The selection is what opentabs_save_selected writes.",
      "message": "Select this tab",
      "sense": "a11y.label.control"
    },
    "opentabs_save_selected": {
      "description": "Button that writes the checked tabs as a NAMED SESSION - a user-named saved set of tabs, the namedSessions entity, NOT the 5-minute auto-restore and NOT a focus session. Consequence-labelled per the copy voice: it says what it makes.",
      "message": "Save as named session",
      "sense": "action.button.create.named-session"
    },
    "opentabs_clear_selection": {
      "description": "Button that unchecks every selected tab in the Open tabs panel. Clears the SELECTION only; closes nothing and saves nothing.",
      "message": "Clear",
      "sense": "action.button"
    },
    "opentabs_empty": {
      "description": "Shown when the panel can find no tabs at all to list. Rare - the LaunchPad tab itself is normally one - so it reads as a statement rather than an invitation.",
      "message": "No open tabs to show.",
      "sense": "empty.panel"
    },
    "opentabs_no_matches": {
      "description": "Shown when a filter is typed and nothing matches. Distinct from opentabs_empty: there ARE tabs, none match. Naming the filter is what tells the user the list is not broken.",
      "message": "No tabs match that filter.",
      "sense": "empty.filtered"
    },
    "opentabs_save_none_eligible": {
      "description": "Toast when every selected tab is a page a named session cannot reopen - chrome:// and extension pages. Uses the same http/https/file rule as every other capture surface.",
      "message": "None of those tabs can be saved to a named session.",
      "sense": "toast.refusal"
    },
    "opentabs_selected_count": {
      "plural": {"one": "{count} tab selected", "other": "{count} tabs selected"},
      "description": "Running count above the save button while a selection is in progress. Counts CHECKED tabs, including any that will be left out at save - the refusal message names those separately rather than silently lowering this number."
    },
    "opentabs_saved_toast": {
      "plural": {"one": "Saved a named session with 1 tab.", "other": "Saved a named session with {count} tabs."},
      "description": "Toast after the selection is written. NAMED SESSION, the saved-tab-set sense. The one-form spells '1' rather than taking {count}, matching sessions_saved_tabs_toast."
    },
    "opentabs_save_left_out": {
      "plural": {"one": "{count} tab was left out.", "other": "{count} tabs were left out."},
      "description": "Follows opentabs_saved_toast when some selected tabs were not capturable. The VERB inflects with the count, which is why this is a plural and not an interpolation - the same shape as sessions_pages_left_out."
    },
    "opentabs_window_tab_count": {
      "plural": {"one": "{count} tab", "other": "{count} tabs"},
      "description": "Tab count on a window group heading in the Open tabs panel. When a filter is active this counts MATCHING tabs, not all of them, so the heading agrees with the rows under it."
    }
  });

// =========================================================================
// OT.2 - PARK THIS WINDOW.
//
// One action saves a window's tabs as a NAMED SESSION and closes them. Every
// string that means the saved set says "named session" (decision 4).
//
// THE CONFIRM NAMES WHAT SURVIVES, not just what goes. Park closes real tabs,
// so the sentence a user reads before pressing it has to account for every tab
// in the window: the ones being saved, the LaunchPad tab that never closes,
// and any pinned tabs, which are deliberately left alone. Those survivors are
// separate keys rather than one assembled sentence because which of them apply
// varies per window, and a sentence that lists a survivor the window does not
// have is worse than one that is a little shorter.
// =========================================================================
I18n.register("en", {
    "opentabs_park_action": {
      "description": "Button on a window group heading in the Open tabs panel. Saves that window's tabs as a named session and closes them. Short because it sits in a 320px panel heading beside the window name and its tab count. VERB, not a noun - the user is parking the window, not looking at a park.",
      "message": "Park",
      "sense": "action.button.destructive-adjacent"
    },
    "opentabs_park_tooltip": {
      "description": "Tooltip and accessible name for opentabs_park_action, which is too short to explain itself. Names BOTH halves of what happens - the save and the close - because the close is the irreversible one.",
      "message": "Save these tabs as a named session and close them",
      "sense": "a11y.label.action.destructive-adjacent"
    },
    "opentabs_park_confirm_title": {
      "description": "Title of the confirm raised by opentabs_park_action. A QUESTION, matching the other destructive confirms in this product.",
      "message": "Park this window?",
      "sense": "heading.dialog.confirm"
    },
    "opentabs_park_confirm_button": {
      "description": "Primary button of the park confirm, styled as the dangerous action with Cancel holding default focus. CONSEQUENCE-LABELLED per the copy voice: it says what it does rather than 'OK', because the close cannot be undone from here.",
      "message": "Park and close",
      "sense": "action.button.confirm.destructive"
    },
    "opentabs_park_nothing": {
      "description": "Toast when park is pressed on a window with nothing parkable - typically a window holding only the LaunchPad tab and pinned tabs. Says so rather than writing an empty named session, which would litter the Sessions list with nothing.",
      "message": "Nothing to park in that window.",
      "sense": "toast.refusal"
    },
    "opentabs_park_write_failed": {
      "description": "Toast when the named session could not be written. THE SECOND SENTENCE IS THE IMPORTANT ONE: it tells the user their tabs are still there. Park writes the session BEFORE closing anything precisely so this case loses nothing, and the message is what makes that visible rather than merely true.",
      "message": "Could not save the named session, so nothing was closed. Your tabs are still open.",
      "sense": "toast.error"
    },
    "opentabs_park_confirm_body": {
      "plural": {"one": "1 tab will be saved as a named session and closed.", "other": "{count} tabs will be saved as a named session and closed."},
      "description": "First line of the park confirm. Counts only the tabs that will ACTUALLY close - the LaunchPad tab and pinned tabs are excluded and named separately by the keys below. The one-form spells '1' rather than taking {count}, matching sessions_saved_tabs_toast."
    },
    "opentabs_park_keeps_this_tab": {
      "description": "Follows opentabs_park_confirm_body when the window being parked is the one LaunchPad is in. Reassures the user that the page they are looking at will not vanish under them.",
      "message": "This LaunchPad tab stays open.",
      "sense": "sentence.confirm.reassurance"
    },
    "opentabs_park_closes_window": {
      "description": "Follows opentabs_park_confirm_body when parking a DIFFERENT window that has nothing left to hold it open. Closing a window's last tab closes the window, which costs its size and position, so the confirm says so rather than letting it be a surprise.",
      "message": "The window closes with its last tab.",
      "sense": "sentence.confirm.consequence"
    },
    "opentabs_park_keeps_pinned": {
      "plural": {"one": "1 pinned tab stays open.", "other": "{count} pinned tabs stay open."},
      "description": "Follows opentabs_park_confirm_body when the window has pinned tabs. PINNED TABS ARE NEITHER SAVED NOR CLOSED: pinning is the user saying this one stays, and parking it would override that. The VERB inflects with the count, which is why this is a plural rather than an interpolation."
    },
    "opentabs_park_done": {
      "plural": {"one": "Parked 1 tab into a named session.", "other": "Parked {count} tabs into a named session."},
      "description": "Toast after a successful park. Says NAMED SESSION so the user knows where to look for what just disappeared."
    },
    "opentabs_park_some_stayed": {
      "plural": {"one": "1 tab would not close and is still open.", "other": "{count} tabs would not close and are still open."},
      "description": "Follows opentabs_park_done when some tabs survived the close. MEASURED, not hypothetical: chrome.tabs.remove is not atomic - given a set containing one stale id it throws and leaves later tabs open - so park closes them one at a time and reports any that refused. The session is already written either way, so nothing is lost; the user just has tabs they did not expect."
    }
  });

// =========================================================================
// OT.3 - RECENTLY CLOSED.
//
// A section at the FOOT of the Open tabs panel rather than a fourth sidebar
// entry: "tabs I have" and "tabs I had" are one subject, and a whole sidebar
// row for a 25-item list is furniture.
//
// NO VISIBLE TIME ON A ROW, deliberately. The list is newest-first, which is
// the ordering a user reads anyway, and a visible clock would add a fourth
// locale-formatted surface to a panel whose rows are already title-over-host.
// The exact time is in the row tooltip, where someone who wants it can find it
// and nobody else pays for it.
// =========================================================================
I18n.register("en", {
    "opentabs_recent_heading": {
      "description": "Heading of the Recently closed section at the foot of the Open tabs panel. Tabs the user has CLOSED, not saved - distinct from a named session, which is a deliberate save. Chrome uses the same phrase in its own menu, which is the point: it is what a user already calls this.",
      "message": "Recently closed",
      "sense": "heading.section"
    },
    "opentabs_recent_empty": {
      "description": "Shown in the Recently closed section when nothing has been closed yet. A statement, not an invitation - there is no action that fills this list except ordinary use.",
      "message": "Nothing closed yet.",
      "sense": "empty.section"
    },
    "opentabs_recent_reopen": {
      "description": "Accessible name of a Recently closed row. Clicking it opens that tab again and REMOVES the row, because once the tab is back the entry has done its job.",
      "message": "Reopen this tab",
      "sense": "a11y.label.action"
    },
    "opentabs_recent_clear": {
      "description": "Button that empties the Recently closed list. Clears the RECORD only - it closes nothing and reopens nothing.",
      "message": "Clear",
      "sense": "action.button"
    },
    "opentabs_recent_cleared": {
      "description": "Toast after the Recently closed list is emptied. Names what went, since the list simply vanishing could read as a fault.",
      "message": "Recently closed list cleared.",
      "sense": "toast.confirmation"
    },
    "opentabs_recent_closed_at": {
      "description": "Row tooltip in Recently closed, below the URL. {time} is ALREADY FORMATTED by the browser locale clock - a translation must not re-order the digits or add its own AM/PM, only move the words around the placeholder.",
      "message": "Closed at {time}",
      "sense": "tooltip.timestamp"
    },
    "opentabs_recent_count": {
      "plural": {"one": "{count} tab", "other": "{count} tabs"},
      "description": "Count on the Recently closed section heading, matching opentabs_window_tab_count's shape so the two headings in this panel read alike. Capped at 25 by the writer, so this never exceeds it."
    }
  });

// =========================================================================
// [WM.1] WORKSPACE MODE
//
// Two modes and no more: Work is the disciplined environment, Casual is the
// absence of it. The words are the user's own - nobody calls it "discipline
// mode" - and neither is scolding: Casual is a legitimate way to use the
// product, not a failure to focus, so its copy states what the mode does
// rather than what the user is not doing.
//
// THE READOUT SAYS "WORK" AND NEVER "CASUAL", so there is deliberately no
// casual counterpart to wsmode_pill_work_title. See satWorkModeChipHtml.
// =========================================================================
I18n.register("en", {
    "wsmode_label": {
      "description": "Label over the mode control in the workspace switcher dropdown. One word, because the control below it names both values.",
      "message": "Mode",
      "sense": "label.field"
    },
    "wsmode_group_label": {
      "description": "Accessible name of the two-option mode control. Names the workspace, because the control sits inside a menu listing several. {workspaceName} is user-supplied and falls back to the workspace id.",
      "message": "Mode for {workspaceName}",
      "sense": "a11y.label.group"
    },
    "wsmode_casual": {
      "description": "The mode that runs no focus rules. The default for every workspace, including every one created before mode existed.",
      "message": "Casual",
      "sense": "action.toggle"
    },
    "wsmode_work": {
      "description": "The disciplined mode. Also the text of the pill chip, which CSS uppercases - the message stays sentence case here because the casing is presentation.",
      "message": "Work",
      "sense": "action.toggle"
    },
    "wsmode_casual_hint": {
      "description": "Tooltip on the Casual option. States what the mode does, not what the user is failing to do.",
      "message": "No focus rules in this workspace.",
      "sense": "tooltip.explanation"
    },
    "wsmode_work_hint": {
      "description": "Tooltip on the Work option. Present tense, because the mode is a state of the workspace rather than an action performed on it.",
      "message": "Focus rules on in this workspace.",
      "sense": "tooltip.explanation"
    },
    "wsmode_now_work": {
      "description": "Toast after flipping a workspace to Work. Names the workspace, because the flip is per workspace and a user may hold several.",
      "message": "{workspaceName} is in Work mode.",
      "sense": "toast.confirmation"
    },
    "wsmode_now_casual": {
      "description": "Toast after flipping a workspace back to Casual. Deliberately symmetric with wsmode_now_work - returning to Casual is not an undo and is not phrased as one.",
      "message": "{workspaceName} is in Casual mode.",
      "sense": "toast.confirmation"
    },
    "wsmode_write_failed": {
      "description": "Toast when the mode flip could not be saved. The in-memory flip is rolled back by re-reading storage before this shows, so the control the user sees again is the truth.",
      "message": "Could not save the mode change.",
      "sense": "toast.error"
    }
  });

// =========================================================================
// [WM.2] THE GATE REASON LINE, AND THE MODE LABELS
//
// The gate page has always described the SESSION and left the reason to be
// inferred. It now NAMES why the page is blocked, in the same line, in the
// same position, because a door that does not say why it is shut is a door
// the user argues with.
//
// ALL THREE REASONS ARE CATALOGUED THOUGH ONLY ONE CAN FIRE. WM.3 builds
// schedules and budgets; writing their copy now means that round adds a
// branch to one reader function and no gate copy at all - and it means the
// three sentences were written together, in one voice, rather than two of
// them bolted on later beside a first that had set a different tone.
//
// THE VOICE IS THE GATE'S OWN: F3=b is GENTLE. No red, no alarm, no scolding.
// Each sentence states a fact the user themselves set up.
// =========================================================================
I18n.register("en", {
    "gate_reason_session_task": {
      "description": "Reason line on the blocking gate while a focus session runs on a named task. A COLON, NOT A FULL STOP AND NOT A DASH. The duration is a sentence FRAGMENT - 'less than a minute' - so a full stop in front of it starts a sentence in lower case - caught in the rendered frame, not in review. An em dash reads better and tools/check-i18n-sites.mjs refuses one in user-facing copy, correctly. A colon is the joiner that is both correct and allowed. VOCABULARY LAW, inherited from gate_focused_on_task: 'focused' is the engine's measured time and must not soften to 'worked on' or 'spent'.",
      "message": "Blocked during your focus session: {duration} focused on {taskName}.",
      "sense": "explanation.reason"
    },
    "gate_reason_session": {
      "description": "Reason line while a focus session runs with NO task attached. Same vocabulary law; a separate sentence because there is no task to name.",
      "message": "Blocked during your focus session: {duration} focused so far.",
      "sense": "explanation.reason"
    },
    "gate_reason_session_armed": {
      "description": "Reason line when blocking is on because the user armed it BY HAND rather than because a session is running. Names the user's own action, since that is the thing they would undo.",
      "message": "Blocked because you turned focus blocking on.",
      "sense": "explanation.reason"
    },
    "gate_reason_budget": {
      "description": "Reason line for a daily-budget rule. WM.3 builds budgets; the copy is written now so that round writes no gate copy. States the limit as spent, not as a failure.",
      "message": "Blocked because you have used today's time on {domain}.",
      "sense": "explanation.reason"
    },
    "gate_reason_schedule": {
      "description": "Reason line for a scheduled rule. WM.3 builds schedules. Present tense and time-bounded - the block is a property of right now, not of the site.",
      "message": "Blocked because {domain} is on your schedule right now.",
      "sense": "explanation.reason"
    },
    "gate_reason_none": {
      "description": "Reason line when the reader finds NO reason - an inert gate. Reachable when Pro lapsed while the tab sat here (decision H) or the page was opened directly. Says plainly that nothing is holding the user, rather than leaving a blocked-looking page with no explanation.",
      "message": "Focus blocking is not on right now.",
      "sense": "explanation.reason"
    },
    "gate_this_site": {
      "description": "Stands in for the domain in a reason line when the gate was reached without one. Matches the headline's existing fallback wording.",
      "message": "this site",
      "sense": "noun.fallback"
    },
    "gate_end_focus": {
      "description": "End control when a manual arm AND a running work phase are BOTH holding the user. One click clears both, so the label names neither: ending only one of them would return the user to this page still blocked, which is the defect this round fixed.",
      "message": "End focus",
      "sense": "action.button"
    },
    "gate_is_not_blocked": {
      "description": "Replaces the headline's \"is blocked\" tail on an INERT gate. The page was reached with nothing actually blocking - Pro lapsed, or it was opened directly - and a headline still asserting a block would contradict the line directly beneath it. Renders after the domain chip, exactly as gate_is_blocked does.",
      "message": "is not blocked",
      "sense": "heading.state"
    },
    "gate_continue": {
      "description": "The only control on an INERT gate. Nothing is blocking, so there is nothing to snooze and nothing to end. NAMES ITS DESTINATION, which is LaunchPad and not the site the user was heading for: C6 governs this page and requires the label to say exactly what the click will do. It read Continue while it went to the destination; when the destination changed, the word had to.",
      "message": "Go to LaunchPad",
      "sense": "action.button"
    },
    "focusblock_mode_schedule": {
      "description": "Row label in Pro Settings for a blocked site governed by a SCHEDULE rather than by focus sessions. Rendered only for non-default modes - a label on every row would repeat the section heading.",
      "message": "On a schedule",
      "sense": "label.state"
    },
    "focusblock_mode_budget": {
      "description": "Row label in Pro Settings for a blocked site governed by a DAILY BUDGET. Same rendering rule as focusblock_mode_schedule.",
      "message": "Daily budget",
      "sense": "label.state"
    }
  });

// =========================================================================
// [WM.3] SCHEDULES AND BUDGETS
//
// THE TWO RULES ARE NAMED BY WHAT THEY DO TO THE USER'S DAY, not by their
// mechanism: "On a schedule" and "Daily budget", never "time window" or
// "quota". A person setting one is deciding when they want to be stopped and
// how long they are willing to spend, and the words are theirs.
//
// E1'S REQUIREMENT LIVES HERE TOO. A budget is spent in measured minutes, so
// it needs tracking on for that workspace - and the copy says it where the
// user SETS one, as a requirement rather than as an error, because at that
// moment it is something they can still act on.
// =========================================================================
I18n.register("en", {
    "focusblock_rules": {
      "description": "Per-row button in Pro Settings that opens the blocking rules for that site. One word, because the row is already narrow and the site name beside it supplies the subject.",
      "message": "Rules",
      "sense": "action.button"
    },
    "focusblock_rules_for_site": {
      "description": "Accessible name and title of the Rules button, and the title of the dialog it opens. {site} is the normalised host.",
      "message": "Blocking rules for {site}",
      "sense": "a11y.label.action"
    },
    "focusblock_mode_label": {
      "description": "Label on the mode picker in the rules dialog. Asks WHEN, which is the actual question - all three modes block the same site.",
      "message": "When to block",
      "sense": "label.field"
    },
    "focusblock_mode_session": {
      "description": "The default mode: block this site while a focus session runs or blocking is armed by hand. Named in the rules dialog and never on a row, where it would repeat the section heading.",
      "message": "During focus sessions",
      "sense": "action.toggle"
    },
    "focusblock_days": {
      "description": "Label over the day-of-week toggles in the rules dialog. Reuses the recurring-task editor's control family.",
      "message": "Days",
      "sense": "label.field"
    },
    "focusblock_from": {
      "description": "Label on the window start time in the rules dialog.",
      "message": "From",
      "sense": "label.field"
    },
    "focusblock_to": {
      "description": "Label on the window end time in the rules dialog.",
      "message": "To",
      "sense": "label.field"
    },
    "focusblock_limit": {
      "description": "Label on the daily budget input, in whole minutes.",
      "message": "Minutes per day",
      "sense": "label.field"
    },
    "focusblock_overnight_note": {
      "description": "Shown under the time fields ONLY when the end time is earlier than the start - the one thing about a window a user cannot see from two time fields. Explains rather than warns: an overnight window is a normal thing to want.",
      "message": "Ends before it starts, so this window runs overnight.",
      "sense": "note.explanation"
    },
    "focusblock_schedule_mode_note": {
      "description": "Shown under the schedule controls, always. A schedule is MODE-GOVERNED (WM.3): blockingReasonActive returns false for schedule unless the current workspace is in Work mode, and WORKSPACE_MODE_DEFAULT is \"casual\" - so a user who sets a schedule and never finds the mode switch has built a rule that can never fire, with nothing on this dialog saying so. Measured 2026-09-18: the same rule returns \"schedule\" in Work and null in Casual at the identical instant. States the condition rather than warning, because Casual is a legitimate state and the schedule is correctly saved either way.",
      "message": "Runs only when this workspace is in Work mode.",
      "sense": "note.explanation"
    },

    "focusblock_casual_offer_title": {
      "description": "Title of the dialog shown AFTER a schedule is saved on a Casual workspace (ROUND F, product decision 2026-09-22, option 2). It leads with the reassuring fact rather than the problem: the rule IS saved, unconditionally, and a title that opened with the mode would read as a refusal. The body carries the condition and the buttons carry the offer.",
      "message": "Your schedule is saved",
      "sense": "dialog.title"
    },
    "focusblock_casual_offer_body": {
      "description": "The one factual line in that dialog. Names the workspace, states the mode, states the consequence, and points at the remedy the button beside it performs - in that order, so a user who dismisses still leaves knowing why. Sibling of focusblock_schedule_mode_note and dash_reminders_work_only; keep the verb 'run' consistent with the first and the 'in Work mode' phrasing consistent with both. NOT a warning: Casual is a legitimate state and the rule is correctly saved either way.",
      "message": "{workspaceName} is in Casual mode, so this schedule will not run until you switch it to Work.",
      "sense": "dialog.body"
    },
    "focusblock_casual_offer_switch": {
      "description": "The action button on that dialog. Flips the ACTIVE workspace to Work through WM.1's writer. Names the destination mode rather than the act ('Switch to Work', not 'Switch mode'), because the user has just been told what Work is for.",
      "message": "Switch to Work",
      "sense": "button.action"
    },
    "focusblock_casual_offer_dismiss": {
      "description": "The quiet dismiss on that dialog, rendered as a LINK rather than a second button so the one coloured control is the one that acts. Declines the offer and changes nothing; the schedule stays saved and stays dormant. Deliberately not 'Cancel' - there is nothing to cancel, the save already happened.",
      "message": "Not now",
      "sense": "button.dismiss"
    },
    "focusblock_budget_mode_note": {
      "description": "Shown under the budget controls, always, and it exists to be READ AGAINST the schedule note beside it. A budget deliberately sits OUTSIDE mode (WM.3: a limit the user set for themselves, which a mode switch must not silently spend or restore), so the doomscroll case still works in a Casual workspace. Without this line the schedule note would imply, by its silence here, that every rule is mode-governed.",
      "message": "Runs in any mode.",
      "sense": "note.explanation"
    },
    "focusblock_budget_needs_tracking": {
      "description": "E1's requirement, shown where the user sets a budget. Stated as what the budget needs rather than as what is wrong, because at this moment it is still something they can act on.",
      "message": "A daily budget is spent in measured minutes, so it needs tracking on for this workspace.",
      "sense": "note.explanation"
    },
    "focusblock_budget_inert": {
      "description": "Shown on a budget ROW, and again in the dialog, when tracking is off for the current workspace. The entry can never be reached, and an entry that looks armed and cannot fire is the preview-ghost as a data state - so the row says so rather than looking live.",
      "message": "Tracking is off here, so this never fires.",
      "sense": "note.warning"
    },
    "focusblock_summary_budget": {
      "description": "A budget row's summary. {minutes} is the whole-minute limit. Compact because it sits inline on a row beside the site name.",
      "message": "{minutes} min/day",
      "sense": "label.state"
    },
    "focusblock_schedule_none": {
      "description": "Summary for a schedule entry that carries no usable window. Not reachable through the editor, which refuses to save one; it exists for a record edited elsewhere.",
      "message": "No hours set",
      "sense": "label.state"
    },
    "focusblock_budget_none": {
      "description": "Summary for a budget entry with no usable limit. Same reachability as focusblock_schedule_none.",
      "message": "No limit set",
      "sense": "label.state"
    },
    "focusblock_schedule_needs_days": {
      "description": "Refusal in the rules dialog when no day is ticked. A window on no days is not a window.",
      "message": "Pick at least one day.",
      "sense": "error.validation"
    },
    "focusblock_schedule_bad_time": {
      "description": "Refusal when the start and end times are the same, or one is unreadable. Equal times are rejected rather than silently meaning all day or nothing.",
      "message": "Start and end must be different times.",
      "sense": "error.validation"
    },
    "focusblock_budget_bad_limit": {
      "description": "Refusal when the daily limit is outside 1 to 1440 minutes. 1440 is a whole day, past which a budget can never be reached.",
      "message": "Minutes must be between 1 and 1440.",
      "sense": "error.validation"
    },
    "focusblock_rule_save_failed": {
      "description": "Shown in the rules dialog when the write itself failed, so the dialog stays open with the user's input intact rather than closing on a change that did not land.",
      "message": "Could not save the rule.",
      "sense": "error.write"
    }
  });
// =========================================================================
// [WM.4] FRICTION, FOCUS SOUNDS, AND THE IDLE THRESHOLD
//
// THE COUNTDOWN REPORTS TIME AND NOTHING ELSE (PLAN decision E). Not one of
// these strings mentions discipline, willpower, or what the user should be
// doing instead. The gate is a door that takes a moment to open, and the copy
// is what a door would say if it could: how long, and that you may leave.
//
// THE TYPED SENTENCE JUDGES NOTHING. "I am choosing to open this" names the
// action in the user's own voice. The alternative the 2026-09-01 ruling was
// written against - something like "I am wasting my time" - would be the
// product telling someone what they are doing with their afternoon, which is
// not a thing it is entitled to say.
// =========================================================================
I18n.register("en", {
    "gate_friction_counting": {
      "description": "The countdown line on the gate while a snooze waits. States the remaining seconds and nothing else. {seconds} counts down.",
      "message": "Snoozing in {seconds}s",
      "sense": "status.countdown"
    },
    "gate_friction_ready": {
      "description": "Replaces the countdown when the wait is over and the snooze can be taken. A statement of readiness, not an instruction.",
      "message": "Ready when you are.",
      "sense": "status.countdown"
    },
    "gate_friction_cancel": {
      "description": "Leaves the countdown and returns to the gate without snoozing. Enabled at every instant of the wait - the door stays a door.",
      "message": "Never mind",
      "sense": "action.button"
    },
    "gate_commit_label": {
      "description": "Label above the commitment input, shown only when the user has armed that toggle and only on a repeat snooze. {sentence} is COMMITMENT_SENTENCE, which must be typed exactly.",
      "message": "Type this to continue: {sentence}",
      "sense": "label.field"
    },
    "prosettings_commitment_toggle": {
      "description": "Pro Settings toggle arming the typed sentence on a repeat snooze. OFF by default - the user asks for this, it is never imposed.",
      "message": "Ask me to type a sentence before a repeat snooze",
      "sense": "label.toggle"
    },
    "prosettings_commitment_note": {
      "description": "Explains the commitment toggle, including that it applies only to a REPEAT snooze within one session, so a user can predict when they will meet it.",
      "message": "Off by default. When on, snoozing the same site twice in one focus session asks you to type one short sentence first.",
      "sense": "note.explanation"
    },
    "prosettings_idle_after": {
      "description": "Label on the idle threshold input. Phrased as what it does to the user rather than as a technical threshold.",
      "message": "Count me idle after",
      "sense": "label.field"
    },
    "prosettings_seconds": {
      "description": "Unit beside the idle threshold input.",
      "message": "seconds",
      "sense": "label.unit"
    },
    "prosettings_idle_note": {
      "description": "Names BOTH readers, because one setting governing two behaviours is exactly the thing a user would not guess, and states the platform floor so a refused value is not a mystery.",
      "message": "Used both to stop tracking and to stop the active-task timer. The browser will not go below 15 seconds.",
      "sense": "note.explanation"
    },
    "quickadd_preview_lead": {
      "description": "Leads the quick-add parse preview. Present tense and conditional - the task has NOT been created yet, and the whole point of the preview is that the user can still change their mind.",
      "message": "Will add",
      "sense": "label.preview"
    },
    "quickadd_preview_due": {
      "description": "Label on the parsed due-date chip in the quick-add preview.",
      "message": "Due",
      "sense": "label.field"
    },
    "quickadd_preview_priority": {
      "description": "Label on the parsed priority chip in the quick-add preview.",
      "message": "Priority",
      "sense": "label.field"
    },
    "quickadd_preview_tags": {
      "description": "Label on the parsed tags chip in the quick-add preview.",
      "message": "Tags",
      "sense": "label.field"
    },
    "quickadd_lands_in_recurring": {
      "message": "This will be added to Recurring, not to this list.",
      "description": "Line under the quick-add preview when the sentence carries a cadence. It exists because the box the user typed into adds TASKS and they are about to get a TEMPLATE, which appears in a different section - so the preview names where it will actually be, rather than letting them look for it in the list they were watching."
    },
    "quickadd_made_recurring": {
      "message": "{name} was added to Recurring.",
      "description": "Toast after a quick-add sentence creates a recurring template. Confirms the thing created is not where the user was looking, which the preview already warned about."
    },
    "quickadd_preview_lead_blocked": {
      "message": "Cannot add",
      "description": "Replaces the WILL ADD label on the Dashboard quick-add when the sentence carries a cadence, which that box does not create. Says the outcome, not the rule; the reason follows on its own line."
    },
    "quickadd_preview_repeats": {
      "message": "Repeats",
      "description": "Key of the cadence chip in the quick-add preview. The value beside it is the cadence in words. There is deliberately no DUE chip on the same row: a recurring template has no single due date."
    },
    "quickadd_recurrence_failed": {
      "message": "That repeating task could not be created.",
      "description": "Fallback toast when the recurring-template writer refuses a quick-add sentence and returns no message of its own. The typed sentence is deliberately kept in the box so it can be fixed rather than retyped."
    },
    "quickadd_recurrence_not_here": {
      "message": "Repeating tasks are added in the Tasks tab. This box adds work due today.",
      "description": "Shown under the Dashboard quick-add preview when the sentence carries a cadence. Two sentences on purpose: where to go, and why this box is not it. The box refuses rather than quietly creating something it does not show."
    },
    "quickadd_repeats_daily": {
      "message": "daily",
      "description": "The cadence in words, beside the Repeats chip, for a sentence like \"water the plants every day\". Lower case because it follows the chip key rather than starting a sentence."
    },
    "quickadd_repeats_monthly": {
      "message": "monthly on day {day}",
      "description": "The cadence in words for a monthly template. DAY N rather than an ordinal (\"the 17th\"): ordinals need per-locale suffix rules, and the product already says \"Monthly on day 17\" on the recurring row itself, so this reuses the vocabulary that shipped."
    },
    "quickadd_repeats_weekly": {
      "plural": {"one": "every {days}", "other": "every {days}"},
      "description": "The cadence in words for a weekly template. The two English forms are identical because only the LIST changes (\"every Friday\" against \"every Mon, Wed and Fri\"), and the list is built by Intl. It is a plural key anyway so a locale whose sentence really does change with the number of days has somewhere to say so."
    },
    "quickadd_time_kept": {
      "message": "Repeats at {time}.",
      "description": "Replaces quickadd_time_not_saved when the sentence is a recurring one. The same condition has to say the opposite thing: a task record drops the parsed time, and a recurring template STORES it as timeOfDay. Leaving the old note in place would have been a lie this feature introduced."
    },
    "quickadd_time_not_saved": {
      "description": "Shown when the user wrote a time of day. A due date in this product is a DAY and carries no time, so the time was used to work out WHICH day and then discarded. Says so plainly rather than letting the user believe a reminder was set - a swallowed time is the same failure as a silently attached due date.",
      "message": "{time} set the day; a due date has no time yet",
      "sense": "note.explanation"
    },
    "quickadd_hint": {
      "description": "Placeholder hint on the quick-add inputs, teaching the grammar by example rather than by a syntax list. The example is the one from the round brief.",
      "message": "Try: Call Nadia tomorrow 3pm !high #acme",
      "sense": "label.placeholder"
    },
    "companion_due_head": {
      "plural": {"one": "Due now ({count})", "other": "Due now ({count})"},
      "description": "Heading of the due list in the side panel. The count is the unsnoozed total, not the number of rows shown, so a user reading it knows the size of the pile rather than the size of the window onto it."
    },
    "companion_due_none": {
      "message": "Nothing due right now.",
      "description": "Empty state of the side panel due list. A full stop and no invitation: the panel already carries one route out, and a second call to action in an empty region would be the surface arguing with itself."
    },
    "companion_due_overdue": {
      "message": "Overdue",
      "description": "Tag on a side-panel due row whose date has passed. A WORD rather than a colour, so the row does not depend on a hue to be read and this surface does not invent a second urgency scale beside the trash countdown one."
    },
    "companion_due_more": {
      "plural": {"one": "{count} more", "other": "{count} more"},
      "description": "Line under the side panel due list when there are more due tasks than the panel shows. It exists so that nothing is hidden without being counted."
    },
    "dashboard_due_on_date": {
      "description": "Due label on a dashboard row for a task due on a FUTURE day. {date} is already formatted by the caller and is a VALUE, not a sentence fragment. Its siblings dash_overdue and dashboard_due_today are different sentences rather than other dates.",
      "message": "Due {date}",
      "sense": "label.due"
    },
    "gate_this_site_headline": {
      "description": "Stand-in for the blocked domain in the gate page's HEADLINE CHIP, used only when the page is reached with no entry in its query string. Renders immediately before gate_is_blocked so the headline still reads as a sentence: 'This site is blocked'. CAPITALISED because it STARTS that sentence - which is the whole reason it is a separate key from gate_this_site, the lower-case form used mid-sentence in the reason line. A language that does not capitalise sentence-initially may give both keys the same value.",
      "message": "This site",
      "sense": "placeholder.name"
    },
    "sessions_default_numbered_name": {
      "description": "The name a saved session is born with from the keyboard command, which has no naming step. {n} counts the workspace's existing sessions plus one, so the first is 'Session 1'. SENSE OF SESSION: a saved set of tabs, not a focus interval and not a browser session. Renameable immediately afterwards.",
      "message": "Session {n}",
      "sense": "name.tabset"
    },
    "group_new_default_name": {
      "description": "The name a group is born with when the right-click 'New group...' route creates one, which has no naming step. Renameable in place. Capitalised as a proper label because it becomes the user's own data the moment it is written.",
      "message": "New Group",
      "sense": "name.group"
    },
    "variant_account_label": {
      "description": "Title given to a nested shortcut whose URL carries a Google-style /u/<n> account segment, so several accounts on one service are told apart in the variant list. {n} is the segment number plus one, so /u/0 reads 'Account 1'.",
      "message": "Account {n}",
      "sense": "name.variant"
    },
    "focus_commitment_sentence": {
      "description": "The sentence a user must TYPE EXACTLY to open a blocked site on a repeat snooze. THE SENTENCE JUDGES NOTHING: it names the action in the user's own voice and costs only the seconds it takes to type. Do not translate it into anything that tells the user what they are doing with their time - 'I am wasting my time' is a thing this product is not entitled to say. It is compared character for character against what the user typed, so the translation must be something a person can retype without ambiguity: avoid curly quotes, avoid trailing punctuation.",
      "message": "I am choosing to open this",
      "sense": "input.exact-match"
    },
    "demo_group_daily": {
      "description": "Name of the first example group seeded on a fresh install. The sparkle marks it as example data the user may clear; keep a leading symbol if the language allows one. Renameable, and it becomes the user's own data at seed time.",
      "message": "✨ Daily examples",
      "sense": "name.group"
    },
    "demo_group_work": {
      "description": "Name of the second example group seeded on a fresh install. Sibling of demo_group_daily and the two should read as a pair. SENSE OF WORK: the kind of site, not the workspace mode (wsmode_work) and not a pomodoro phase (pomodoro_phase_work).",
      "message": "✨ Work examples",
      "sense": "name.group"
    },
    "pomodoro_phase_work": {
      "description": "Eyebrow above the pomodoro timer during a focus interval. SENSE: a PHASE of the timer, NOT the workspace mode (wsmode_work / prosettings_work) and not the kind of example site (demo_group_work). Three keys hold the English word 'Work' and a translator must be free to render them differently. Its siblings are pomodoro_phase_break and pomodoro_phase_long_break.",
      "message": "Work",
      "sense": "phase.pomodoro"
    },
    "pomodoro_phase_break": {
      "description": "Eyebrow above the pomodoro timer during a short break. Sibling of pomodoro_phase_work and pomodoro_phase_long_break; the three are one set and must stay consistent in register.",
      "message": "Break",
      "sense": "phase.pomodoro"
    },
    "pomodoro_phase_long_break": {
      "description": "Eyebrow above the pomodoro timer during the long break after a full cadence. Holds the same English as prosettings_long_break, which is the SETTINGS LABEL for configuring its length - separate keys because one names a state the timer is in and the other names a duration field, and a language may well distinguish them.",
      "message": "Long break",
      "sense": "phase.pomodoro"
    },
    "trash_goal_restored": {
      "description": "Toast after restoring a GOAL from the tasks trash. Its sibling is trash_task_restored; two keys rather than one with a placeholder, because a language may inflect the verb by the noun's gender.",
      "message": "Goal restored",
      "sense": "toast.confirmation"
    },
    "trash_task_restored": {
      "description": "Toast after restoring a TASK from the tasks trash. Sibling of trash_goal_restored - see that key for why they are two.",
      "message": "Task restored",
      "sense": "toast.confirmation"
    },
    "trash_goal_reactivated": {
      "description": "Toast after reactivating a COMPLETED goal, which is a different action from restoring a trashed one: the goal was finished, not deleted. Sibling of trash_task_reactivated.",
      "message": "Goal reactivated",
      "sense": "toast.confirmation"
    },
    "trash_task_reactivated": {
      "description": "Toast after reactivating a COMPLETED task. Sibling of trash_goal_reactivated - see that key.",
      "message": "Task reactivated",
      "sense": "toast.confirmation"
    },
    "goaltpl_saved_as_template": {
      "description": "Toast after saving a goal as a reusable template. {name} is the goal's own name, quoted in the English. Its failure sibling is goaltpl_save_failed.",
      "message": "Saved \"{name}\" as a template",
      "sense": "toast.confirmation"
    },
    "goaltpl_save_failed": {
      "description": "Toast when saving a goal as a template did not succeed. Deliberately does not guess at a cause the code does not know. Sibling of goaltpl_saved_as_template.",
      "message": "Could not save template",
      "sense": "toast.failure"
    },
    "goal_stranded_moved_to_standalone": {
      "description": "Toast after completing a goal that still held unfinished tasks, naming how many were released rather than hidden. THIS SENTENCE IS THE WHOLE POINT of the [1.4.x] fix: a goal completion used to HIDE its unfinished tasks, twenty of the developer's own were affected, and it needed a migration sweep. The user must be told where the tasks went.",
      "message": "",
      "plural": {
        "one": "1 unfinished task moved to Standalone.",
        "other": "{count} unfinished tasks moved to Standalone."
      }
    },
    "wstracking_on_for_workspace": {
      "description": "Toast after switching focus tracking ON for the current workspace. VOCABULARY LAW: 'focus tracking' is the engine's measured time and must not soften to 'activity' or 'usage'. Sibling of wstracking_off_for_workspace.",
      "message": "Focus tracking on for this workspace",
      "sense": "toast.state"
    },
    "wstracking_off_for_workspace": {
      "description": "Toast after switching focus tracking OFF for the current workspace. Sibling of wstracking_on_for_workspace; the pair must stay parallel in structure.",
      "message": "Focus tracking off for this workspace",
      "sense": "toast.state"
    },
    "ws_count_subtitle": {
      "description": "Subtitle under the workspace list in Pro Settings, counting how many exist. A bare count of a noun, so it needs the plural rather than a numeral beside a fixed word.",
      "message": "",
      "plural": {
        "one": "1 workspace",
        "other": "{count} workspaces"
      }
    },
    "pomodoro_completed_this_task": {
      "description": "Hint beside the pomodoro reset control, counting completed cycles on the CURRENT task. Its empty-state sibling is sat_no_active_task, which renders instead when nothing is active - a different sentence rather than a zero form, which is why this key has no '=0'.",
      "message": "",
      "plural": {
        "one": "1 completed this task",
        "other": "{count} completed this task"
      }
    },
    "focusblock_subdomains_included": {
      "description": "Tooltip on a blocked-domain row, stating that the rule covers subdomains as well as the domain itself. {domain} is the entry as the user typed it.",
      "message": "{domain} (subdomains included)",
      "sense": "tooltip.explanation"
    },
    "common_hide": {
      "description": "Toggle label that COLLAPSES a revealed section, shown while the section is open. Its sibling is common_show and the two swap on the same control.",
      "message": "Hide",
      "sense": "action.toggle"
    },
    "common_show": {
      "description": "Toggle label that REVEALS a hidden section, shown while the section is closed. Sibling of common_hide.",
      "message": "Show",
      "sense": "action.toggle"
    },
    "import_preview_more_groups": {
      "description": "Last row of the import preview list when more groups were found than the preview shows, counting the remainder. The leading plus is part of the English convention for 'and this many more' and may be dropped where a language reads better without it.",
      "message": "",
      "plural": {
        "one": "+1 more",
        "other": "+{count} more"
      }
    },
    "backup_restored": {
      "description": "Toast after restoring a backup written by a current version. Its sibling backup_restored_older_format says the same thing for a file in the pre-v2 envelope, and the distinction is worth keeping: a user who sees the older-format wording knows why something might be missing.",
      "message": "Backup restored.",
      "sense": "toast.confirmation"
    },
    "backup_restored_older_format": {
      "description": "Toast after restoring a backup written in the older envelope. Sibling of backup_restored - see that key for why the two are separate.",
      "message": "Backup restored (older format).",
      "sense": "toast.confirmation"
    },
    "task_complete_with_goal": {
      "description": "Toast after completing a task that finished its parent goal too, announcing both. {name} is the task and {goalName} the goal, both quoted in the English. Its simpler sibling is task_complete_plain, which renders when no goal was finished - two keys rather than one with an optional clause, because a trailing optional clause is exactly what a translator cannot reorder.",
      "message": "\"{name}\" complete. Goal \"{goalName}\" finished!",
      "sense": "toast.confirmation"
    },
    "task_complete_plain": {
      "description": "Toast after completing a task that did not finish its parent goal. Sibling of task_complete_with_goal. Deliberately has no full stop in the English, matching the shipped string.",
      "message": "\"{name}\" complete",
      "sense": "toast.confirmation"
    },
    "tips_examples_already_present": {
      "description": "Note under the restore-examples control when the example groups are already on the grid, explaining why the control is inert. Its sibling is tips_examples_restore_hint, which renders when the control WILL do something.",
      "message": "Examples are already on your grid.",
      "sense": "note.state"
    },
    "tips_examples_restore_hint": {
      "description": "Note under the restore-examples control when the examples are absent, naming exactly what the control will put back. Sibling of tips_examples_already_present.",
      "message": "Puts the example groups and tips tiles back on your grid.",
      "sense": "note.action"
    },
    "sidebar_collapse_all": {
      "description": "Label on the sidebar's expand/collapse-all control while every group is expanded. Its sibling is sidebar_expand_all, which is the same control's other state.",
      "message": "Collapse all",
      "sense": "action.toggle"
    },
    "sidebar_collapse_all_groups": {
      "description": "Tooltip and accessible name for the sidebar collapse-all control. Sibling of sidebar_expand_all_groups - see that key.",
      "message": "Collapse all groups",
      "sense": "tooltip.action"
    },
    "sessionmenu_change_task": {
      "description": "Menu label on a shortcut already attached to a task, offering to move it to a different one. Its unattached sibling is sessionmenu_attach_to_task, which the same control shows when nothing is attached.",
      "message": "Change task",
      "sense": "action.menu"
    },
    "task_moved_to_goal": {
      "description": "Toast after moving a task into a goal from the menu. {name} is the task, {goalName} the goal. Its sibling is task_now_standalone, for the move in the other direction.",
      "message": "{name} moved to {goalName}.",
      "sense": "toast.confirmation"
    },
    "task_now_standalone": {
      "description": "Toast after moving a task OUT of a goal. SENSE OF STANDALONE: belonging to no goal, which is a real place in this product rather than an absence. Sibling of task_moved_to_goal.",
      "message": "{name} is now a standalone task.",
      "sense": "toast.confirmation"
    },
    "session_now_on_task": {
      "description": "Toast after attaching a saved session to a task. {name} is the session, {taskName} the task. SENSE OF SESSION: a saved set of tabs. Its sibling is session_no_longer_on_task.",
      "message": "{name} is now on {taskName}.",
      "sense": "toast.confirmation"
    },
    "session_no_longer_on_task": {
      "description": "Toast after detaching a saved session from a task. {name} is the session, {taskName} the task it was on. Its sibling is session_no_longer_on_a_task, used when the previous task cannot be named.",
      "message": "{name} is no longer on {taskName}.",
      "sense": "toast.confirmation"
    },
    "session_no_longer_on_a_task": {
      "description": "The detach toast for the case where the task the session was on could not be resolved - deleted, or in another workspace. Says 'a task' rather than naming one. Sibling of session_no_longer_on_task.",
      "message": "{name} is no longer on a task.",
      "sense": "toast.confirmation"
    },
    "session_deleted_undo": {
      "description": "Toast after soft-deleting a saved session, shown beside an Undo control. {name} is the session's own name. Letting the toast expire leaves the row in the trash rather than destroying it, so this must not read as permanent.",
      "message": "{name} deleted.",
      "sense": "toast.confirmation"
    },
    "sessions_tab_count": {
      "description": "Counts the tabs in a saved session. Used on the session row, its trash row, the row's accessible name and the restore panel. ONE key for all four, because they are one fact about one thing and a language that inflects the noun must inflect it everywhere.",
      "message": "",
      "plural": {
        "one": "1 tab",
        "other": "{count} tabs"
      }
    },
    "rc_domain_page_count": {
      "description": "Heading of the recently-closed panel's per-domain list, naming the domain and how many pages it holds. {domain} is a host name and must not be translated; {count} needs the plural because the noun is counted.",
      "message": "",
      "plural": {
        "one": "{domain} (1 page)",
        "other": "{domain} ({count} pages)"
      }
    },
    "nest_different_sites": {
      "description": "Toast refusing a nest between two shortcuts on different domains. {hostA} and {hostB} are host names and must not be translated. The second sentence must stay: a refusal that does not say what WOULD work reads as a malfunction. Named in August 2026 as one of four shapes no i18n gate has ever been able to see.",
      "message": "{hostA} and {hostB} are different sites. Nest tiles from the same address.",
      "sense": "toast.refusal"
    },
    "tasks_standalone_name_collision": {
      "description": "Toast refusing to move a task to Standalone because a standalone task of that name already exists. {name} is the task's own name, quoted in the English. SENSE OF STANDALONE: belonging to no goal.",
      "message": "A standalone task named \"{name}\" already exists.",
      "sense": "toast.refusal"
    },
    "note_aria_label": {
      "description": "Accessible name of a note card, reading the note's own text after a short prefix so a screen reader announces what the card contains. {text} is the note's content, collapsed to one line and truncated. The empty-note case uses common_empty_note instead.",
      "message": "Note: {text}",
      "sense": "label.accessible"
    },
    "notes_purges_today": {
      "description": "Countdown on a trashed note whose 30 days expire today. A different sentence from the day count rather than a zero form of it, which is why notes_days_remaining has no '=0'.",
      "message": "Purges today",
      "sense": "note.countdown"
    },
    "notes_days_remaining": {
      "description": "Countdown on a trashed note, naming how long before it purges for good. The today case is notes_purges_today, a different sentence rather than a zero form.",
      "message": "",
      "plural": {
        "one": "1 day remaining",
        "other": "{count} days remaining"
      }
    },
    "goaltpl_no_deadline": {
      "description": "Summary on a goal template that sets no deadline. Its siblings are goaltpl_due_same_day and goaltpl_due_offset_days, which cover the other two shapes the same summary line can take.",
      "message": "no deadline",
      "sense": "summary.template"
    },
    "goaltpl_due_same_day": {
      "description": "Summary on a goal template whose deadline is the day the goal is created. Sibling of goaltpl_no_deadline and goaltpl_due_offset_days.",
      "message": "due same day",
      "sense": "summary.template"
    },
    "goaltpl_due_offset_days": {
      "description": "Summary on a goal template whose deadline is a number of days after creation. Sibling of goaltpl_no_deadline and goaltpl_due_same_day; the leading plus is the English convention for an offset.",
      "message": "",
      "plural": {
        "one": "due +1 day",
        "other": "due +{count} days"
      }
    },
    "goaltpl_deadline_computed": {
      "description": "Read-only line in the goal modal showing the date a chosen template will set, so the user sees the actual day rather than an offset. {date} is already formatted by the caller and is a VALUE, not a sentence fragment. The trailing clause names WHY the field is read-only.",
      "message": "{date} · set by this template",
      "sense": "note.explanation"
    },
    "insights_custom_range": {
      "description": "Label on the Insights custom-range control before any range is chosen. Once a range exists the label becomes the formatted dates themselves, which are values rather than prose.",
      "message": "custom range",
      "sense": "label.control"
    },
    "sat_pomo_advance_toast": {
      "description": "Toast shown IN THE PAGE when a focus interval ends and the break begins. It holds the same two sentences as the OS notification notif_break_time_body and notif_break_time_title, joined - the notification is the out-of-page version of this moment and the three must move together. NOT a duplicate key for one sentence: no existing key holds this combined string, and pointing the toast at the body alone would silently drop 'Break time.' VOCABULARY LAW: 'focused' is the engine's measured time and must not soften to 'worked' or 'spent'.",
      "message": "",
      "plural": {
        "one": "Nice, {count} min focused. Break time.",
        "other": "Nice, {count} min focused. Break time."
      }
    },

    "license_checking": {
      "description": "Transient status while a licence check is in flight. TWO SINKS, ONE KEY: the line under the Check button and the Apply button's own label while it waits. The ellipsis is part of the English and may be dropped where a language does not use one. It must say NOTHING about validity - the previous verdict is still on screen and this line must not appear to confirm or contradict it.",
      "message": "Checking...",
      "sense": "status.license"
    },
    "license_verified_never": {
      "description": "Fills {when} in license_active_last_verified and license_not_valid_last_checked when the licence has never been checked. Lower case because it sits INSIDE those sentences rather than starting one. Siblings: license_verified_today, license_verified_days_ago.",
      "message": "never",
      "sense": "value.time"
    },
    "license_verified_today": {
      "description": "Fills {when} when the licence was checked today. Holds the same lower-case English as insights_today, which is the 1-day window inside a CHART TITLE - unrelated surfaces that happen to share a word, and a language that inflects by context must be free to differ. Siblings: license_verified_never, license_verified_days_ago.",
      "message": "today",
      "sense": "value.time"
    },
    "license_verified_days_ago": {
      "description": "Fills {when}, counting days since the last check. The singular/plural boundary here is the class of bug check-trial-copy was written for, so it is a plural object and never a ternary. Siblings: license_verified_never, license_verified_today.",
      "message": "",
      "plural": {
        "one": "1 day ago",
        "other": "{count} days ago"
      }
    },
    "license_active_last_verified": {
      "description": "Idle status under the licence control when the licence is valid. {when} is filled by license_verified_never / _today / _days_ago - a VALUE dropped into this sentence, never a fragment concatenated onto it. Its invalid counterpart is license_not_valid_last_checked and the two must stay parallel in shape.",
      "message": "License active. Last verified {when}.",
      "sense": "status.license"
    },
    "license_not_valid_last_checked": {
      "description": "Idle status when the stored subscription status is invalid. Counterpart of license_active_last_verified, same {when} value. SAYS 'last checked' RATHER THAN 'last verified' on purpose: nothing was verified, so the neutral verb is the honest one.",
      "message": "License is not valid. Last checked {when}.",
      "sense": "status.license"
    },
    "license_not_checked_yet": {
      "description": "Idle status when no check has ever run and no status is stored. A NON-VERDICT: it must not read as either a pass or a failure, because the product genuinely does not know.",
      "message": "Not checked yet.",
      "sense": "status.license"
    },
    "license_active_verified_just_now": {
      "description": "Status after a check that came back good. Says JUST NOW rather than a date, because the user pressed the button a second ago and a date would make a fresh answer look stale.",
      "message": "License active. Verified just now.",
      "sense": "status.license"
    },
    "license_not_valid_expired_or_cancelled": {
      "description": "Status after a check that came back and the state machine agreed the licence is invalid. Names the two ordinary causes rather than accusing the user of anything; both are recoverable and neither is misconduct.",
      "message": "License is not valid. It may have expired or been cancelled.",
      "sense": "status.license"
    },
    "license_status_unknown": {
      "description": "Fallback status line when a check returned successfully but the stored status is neither active nor invalid. {status} is a RAW ENUM VALUE from storage (or the word 'unknown') and is deliberately not translated - it is diagnostic, and a translated enum cannot be matched against the code that produced it.",
      "message": "License status: {status}.",
      "sense": "status.license"
    },
    "license_could_not_run_check": {
      "description": "Status when the check never left the building - bad arguments, a missing module, a throw. BLAMES NEITHER SIDE and asserts nothing about the licence: this is our fault, not the server's and not the user's. Must never contain the words of license_not_valid_*.",
      "message": "Could not run the check. Reload the page and try again.",
      "sense": "status.license"
    },
    "license_could_not_reach_server": {
      "description": "Status when the network or the licence server did not answer. THE WHOLE POINT OF THIS SENTENCE IS THAT IT IS NOT A VERDICT: stored state is preserved and offline grace lives on, so it must never imply the licence is invalid and must never claim a fresh success. It is also the honest DEFAULT for an unrecognised error the state machine did not act on.",
      "message": "Could not reach the license server. Try again.",
      "sense": "status.license"
    },
    "license_rejected": {
      "description": "Last-resort status when the licence server rejected the key and gave no message of its own. Normally the server's own message is shown instead; this renders only when that message is missing.",
      "message": "This license was rejected.",
      "sense": "status.license"
    },
    "trial_ends_today": {
      "description": "Trial headline on the final day, where a day count would read '0 days left'. An EXACT FORM rather than a zero plural, because the sentence changes shape rather than its number. TWO SINKS, ONE KEY: the trial popover headline and the tab-bar countdown chip. Its counted sibling is trial_days_left.",
      "message": "Trial ends today",
      "sense": "heading.trial"
    },
    "trial_days_left": {
      "description": "Trial popover headline, counting the days remaining. The final day uses trial_ends_today instead, which is why this carries no '=0'. The singular boundary is the one check-trial-copy exists to guard.",
      "message": "",
      "plural": {
        "one": "1 day left in your trial",
        "other": "{count} days left in your trial"
      }
    },
    "trial_ends_today_sentence": {
      "description": "Subscription-section meta line on the trial's final day. A SEPARATE KEY from trial_ends_today despite the near-identical English: this one is a full SENTENCE ending in a full stop, sitting in a paragraph, while trial_ends_today is a HEADLINE. A language that punctuates headings differently needs both. Its counted sibling is trial_ends_in_days.",
      "message": "Trial ends today.",
      "sense": "note.trial"
    },
    "trial_ends_in_days": {
      "description": "Subscription-section meta line, counting the days left. Sibling of trial_ends_today_sentence; both are sentences in a paragraph rather than headlines.",
      "message": "",
      "plural": {
        "one": "Trial ends in 1 day.",
        "other": "Trial ends in {count} days."
      }
    },
    "closedpause_named_task": {
      "description": "Toast on reopening the browser, explaining that a task the user left running was paused while the browser was closed. {name} is the task's own name, quoted in the English. Its unnamed sibling is closedpause_unnamed_task. THE INVITATION AT THE END MUST SURVIVE TRANSLATION: the pause is an explanation, not a reprimand, and 'Resume when ready' is what keeps it one.",
      "message": "Paused \"{name}\" while the browser was closed. Resume when ready.",
      "sense": "toast.explanation"
    },
    "closedpause_unnamed_task": {
      "description": "The same reopening notice as closedpause_named_task, for when the task's name cannot be resolved. The name clause is removed rather than left as an empty quotation.",
      "message": "Paused while the browser was closed. Resume when ready.",
      "sense": "toast.explanation"
    },
    "apply_open_pro_settings": {
      "description": "Accessible name for the tab-bar chip when Pro is active or in grace. The chip SHOWS only a tick and the word Pro (apply_pro), which tells a screen-reader user what the state is but not what the control does - this says what pressing it does. An imperative naming the destination, not a description of the badge.",
      "message": "Open Pro Settings",
      "sense": "action.navigate"
    },
    "apply_pro_coming_soon": {
      "description": "Accessible name for the tab-bar chip in teaser mode, whose visible label is the two words of apply_coming_soon. The product name is spelled out here because a screen-reader user meets this chip with no surrounding context, where 'Coming soon' alone names nothing. The chip is INERT in this state, so this must not read as an invitation to press it.",
      "message": "LaunchPad Pro, coming soon",
      "sense": "status.availability"
    },
    "trial_days_left_chip": {
      "description": "The tab-bar countdown chip during a trial, at full width. A CHIP, not a sentence: no final full stop, and the middot separates a label from a count rather than joining two clauses - a language that would not use one should drop it. Its narrow-width sibling is trial_days_short and its final-day form is trial_ends_today, which the chip shares with the popover headline. Distinct from trial_ends_in_days, which is a sentence in a paragraph.",
      "message": "",
      "plural": {
        "one": "Trial · {count} day left",
        "other": "Trial · {count} days left"
      }
    },
    "trial_days_short": {
      "description": "The same countdown as trial_days_left_chip, for the narrow chip where only a few characters fit. English collapses both forms to a digit and a letter; the plural object is kept rather than a single message BECAUSE it is a counted phrase, and a language whose abbreviation changes with the number must be able to say so. Its final-day form is trial_ends_today_short.",
      "message": "",
      "plural": {
        "one": "{count}d",
        "other": "{count}d"
      }
    },
    "trial_ends_today_short": {
      "description": "The narrow-chip form of trial_ends_today, for the final day of a trial. Abbreviated siblings: trial_days_short. Holds the same English as insights_today, which is a 1-day chart window - unrelated surfaces sharing a word, and a language that inflects by context must be free to differ. Capitalised because it stands alone in the chip rather than sitting inside a sentence.",
      "message": "Today",
      "sense": "status.trial"
    }
  });

// [1.5.0] THE CENSUS, pass A - dashboard recap, achievement descriptions,
// insights chart captions and ranges, the CSV export's human-readable
// metadata, and the demo seed. The chart captions are ACCESSIBLE NAMES and
// were invisible to the markup-reading gate (BUGS.md I15); the demo seed is
// content shown once on a fresh profile and is the user's data thereafter.
I18n.register("en", {
    "dash_recap_most_focused": {
      "description": "Day Recap row label: the task the user spent most focused time on today. A LABEL in a two-column row, not a sentence - no final stop. Its two row-mates already had keys and are REPOINTED rather than duplicated: insights_wk_longest and insights_wk_top_tag, both from the weekly review card, which carry the same labels in the same sense.",
      "message": "Most focused",
      "sense": "label.recap"
    },
    "dash_first_week_desc": {
      "description": "What earned the 'first week' achievement, under its title in the EARNED list on the dashboard. Past tense; the still-locked wording is badge_first_week_desc.",
      "message": "Used LaunchPad 7 days running"
    },
    "dash_goal_crusher_desc": {
      "description": "What earned the 'goal crusher' achievement, in the EARNED list. Past tense; the locked form is badge_goal_crusher_desc.",
      "message": "Completed 5 goals"
    },
    "dash_deep_diver_desc": {
      "description": "What earned the 'deep diver' achievement, in the EARNED list. Past tense; the locked form is badge_deep_diver_desc.",
      "message": "Single 2-hour focus block"
    },
    "dash_variety_desc": {
      "description": "What earned the 'variety' achievement, in the EARNED list. Past tense; the locked form is badge_variety_desc.",
      "message": "5 different tags in a week"
    },
    "dash_curator_desc": {
      "description": "What earned the 'curator' achievement, in the EARNED list. Past tense; the locked form is badge_curator_desc.",
      "message": "50+ shortcuts organized"
    },
    "badge_first_week_desc": {
      "description": "What it takes to earn the 'first week' badge, shown while it is still LOCKED. Imperative - it describes something still to do; the earned wording is dash_first_week_desc.",
      "message": "Open LaunchPad 7 days running"
    },
    "badge_goal_crusher_desc": {
      "description": "What it takes to earn the 'goal crusher' badge while LOCKED. Imperative; the earned form is dash_goal_crusher_desc.",
      "message": "Complete 5 different goals"
    },
    "badge_deep_diver_desc": {
      "description": "What it takes to earn the 'deep diver' badge while LOCKED. Imperative; the earned form is dash_deep_diver_desc.",
      "message": "A single 2-hour focus session"
    },
    "badge_variety_desc": {
      "description": "What it takes to earn the 'variety' badge while LOCKED. Imperative; the earned form is dash_variety_desc.",
      "message": "Complete tasks across 5 tags in a week"
    },
    "badge_curator_desc": {
      "description": "What it takes to earn the 'curator' badge while LOCKED. Imperative; the earned form is dash_curator_desc.",
      "message": "Organize 50+ shortcuts"
    },
    "achv_consistency_desc": {
      "description": "What the 'consistency' achievement takes, used in BOTH the earned dashboard list and the locked badge list. ONE KEY, TWO SINKS: every other achievement has a past-tense earned form and an imperative locked form, but this one reads identically in English, so Decision 4 makes it a single key. A language that marks aspect and needs the two to differ should say so rather than translate this twice.",
      "message": "Complete a task 7 days running"
    },
    "badge_locked": {
      "description": "Shown in place of an achievement's description while it is still locked, in the Pro preview badge grid. One word standing alone in a small tile.",
      "message": "Locked",
      "sense": "status.achievement"
    },
    "badge_earned_on": {
      "description": "Shown in place of an achievement's description once it has been earned, naming the day. {date} is an already-formatted short date.",
      "message": "Earned {date}",
      "sense": "status.achievement"
    },
    "insights_trend_caption": {
      "description": "Accessible name for the 30-day deep-work bar chart. A screen-reader user gets this INSTEAD of the bars, so it says what the chart shows rather than merely naming it.",
      "message": "Deep work trend over the last 30 days"
    },
    "insights_axis_start_30": {
      "description": "The left-hand axis label on the fixed 30-day trend chart - the oldest day shown. On a variable range the same position carries a formatted date instead. Its right-hand pair is insights_today.",
      "message": "30 days ago"
    },
    "insights_tag_caption_30": {
      "description": "Accessible name for the time-by-tag donut on the fixed 30-day demo window. The variable-range form is insights_tag_caption.",
      "message": "Time by tag, last 30 days"
    },
    "insights_tag_caption": {
      "description": "Accessible name for the time-by-tag donut, naming whichever range is selected. {range} is a PHRASE such as 'last 30 days' (insights_last_30_days), not a number - the sentence must read naturally with a phrase dropped into it.",
      "message": "Time by tag, {range}"
    },
    "insights_deep_work_caption": {
      "description": "Accessible name for the deep-work bar chart, naming whichever range is selected. {range} is a phrase such as 'last 30 days'.",
      "message": "Deep work, {range}"
    },
    "insights_btn_today": {
      "description": "The button narrowing Insights to today alone. A BUTTON: capitalised and standing alone, where insights_today is the same range named lower-case inside a sentence. DELIBERATE DUPLICATE: Four keys already hold 'Today' - a recent-history filter, an update notice, the narrow trial chip. This one is an Insights range button and a language that inflects a standalone button differently from a filter option must be free to.",
      "message": "Today",
      "sense": "label.range"
    },
    "insights_btn_past_7": {
      "description": "The button narrowing Insights to the last seven days. A button, capitalised; the in-sentence form of the same range is insights_past_7_days.",
      "message": "Past 7 days",
      "sense": "label.range"
    },
    "insights_btn_last_30": {
      "description": "The button widening Insights to the last thirty days. A button, capitalised; the in-sentence form of the same range is insights_last_30_days.",
      "message": "Last 30 days",
      "sense": "label.range"
    },
    "insights_best_day_on": {
      "description": "Label on the summary tile for the most focused day in range. {date} is an already-formatted short date. The middot separates a label from a date rather than joining two clauses - a language that would not use one should drop it.",
      "message": "best day · {date}",
      "sense": "label.insights"
    },
    "insights_deleted_tags": {
      "description": "The donut row gathering focused time that belonged to tags since deleted. A real row, not an error state; its sibling for time carrying no tag at all is insights_untagged.",
      "message": "Deleted tags"
    },
    "insights_untagged": {
      "description": "The donut row gathering focused time that carried no tag at all. Its sibling for time whose tag has since been deleted is insights_deleted_tags.",
      "message": "Untagged"
    },
    "export_meta_measure": {
      "description": "Note in the exported CSV saying what the numbers measure. Sits in the value column beside the constant key 'measure', which is NOT translated because parsers match on it.",
      "message": "engine-measured focused time only; not wall clock or time worked"
    },
    "export_meta_reconciles": {
      "description": "Note in the exported CSV saying which row groups sum to the total. 'range_total' and 'tag_note' are literal column keys in the same file and must NOT be translated.",
      "message": "task, goal and domain rows each sum to range_total; tag rows do not - see tag_note"
    },
    "export_meta_tag_note": {
      "description": "Note in the exported CSV explaining why tag rows can exceed the total. 'range_total' is a literal column key in the same file and must NOT be translated.",
      "message": "a session carrying several tags counts in FULL under each of them, so tag rows can exceed range_total; untagged is then clamped at zero and may understate"
    },
    "export_scope_all_workspaces": {
      "description": "Value of the CSV's 'scope' row when the export covers every workspace rather than one.",
      "message": "all workspaces"
    },
    "export_task_deleted": {
      "description": "Stands in for a task's name in the CSV export when the task was purged and no name survives anywhere. Parenthesised because it is a statement ABOUT the missing name, not a name.",
      "message": "(deleted task)"
    },
    "export_task_none": {
      "description": "Stands in for a task's name in the CSV export, for focused time that belonged to no task.",
      "message": "(no task)"
    },
    "export_goal_none": {
      "description": "Stands in for a goal's name in the CSV export, for tasks belonging to no goal.",
      "message": "(no goal)"
    },
    "export_goal_deleted": {
      "description": "Stands in for a goal's name in the CSV export when the goal was purged.",
      "message": "(deleted goal)"
    },
    "export_goal_unknown": {
      "description": "Stands in for a goal's name in the CSV export when the task that would name it was purged, so the goal cannot be resolved.",
      "message": "(goal unknown - task purged)"
    },
    "export_goal_untasked": {
      "description": "Stands in for a goal's name in the CSV export, for time recorded against no task and therefore against no goal.",
      "message": "(no goal - untasked)"
    },
    "export_tag_deleted": {
      "description": "Stands in for a tag's name in the CSV export when the tag was purged.",
      "message": "(deleted tag)"
    },
    "demo_task_exec_summary": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task on the Tasks board. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Draft executive summary"
    },
    "demo_task_revenue": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task on the Tasks board, REUSED as a row in the Pro preview board - one key, two sinks, because it is the same sentence. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Pull regional revenue numbers"
    },
    "demo_goal_typescript": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo goal name, REUSED as a demo goal in the Pro preview board. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Learn TypeScript"
    },
    "demo_task_generics": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task under the TypeScript demo goal. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Finish generics chapter"
    },
    "demo_task_todo_app": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task under the TypeScript demo goal. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Build a tiny todo app"
    },
    "demo_top_task_generics": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo row in the Insights top-tasks chart. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Learn TypeScript generics"
    },
    "demo_top_task_onboarding": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo row in the Insights top-tasks chart. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Rewrite the onboarding email"
    },
    "demo_top_task_design_system": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo row in the Insights top-tasks chart. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Review the design system"
    },
    "demo_top_task_next_quarter": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo row in the Insights top-tasks chart. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Plan next quarter"
    },
    "demo_top_task_backlog": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo row in the Insights top-tasks chart. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Tidy the backlog"
    },
    "demo_pv_task_exec_summary": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task in the Pro PREVIEW board shown to free users. Deliberately a different sentence from demo_task_exec_summary, which is the real board's. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Draft the executive summary"
    },
    "demo_pv_task_design_review": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task in the Pro preview board shown to free users. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Reply to the design review thread"
    },
    "demo_pv_task_studio": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task in the Pro preview board shown to free users. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Book the studio for Thursday"
    },
    "demo_pv_task_domain": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo task in the Pro preview board shown to free users. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Renew the domain"
    },
    "demo_pv_goal_onboarding": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo goal in the Pro preview board shown to free users. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Rebuild onboarding flow"
    },
    "demo_note_studio": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo sticky note's body. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Call the studio back about the October shoot."
    },
    "demo_note_flights": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo sticky note's body. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Book flights before prices climb again."
    },
    "demo_note_deep_work": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo sticky note's body. 'Sam' is a placeholder person; a translator should use a name common in their own market. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Read the piece on deep work that Sam sent."
    },
    "demo_goal_q3": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo goal name on the Tasks board. Its longer sibling demo_top_task_q3 ('Ship the Q3 report') is the Insights row; they are deliberately different strings. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Ship Q3 report"
    },
    "demo_goal_q3_deadline": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. The deadline shown on a demo goal. An already-formatted SHORT DATE, written out rather than computed, so a translator should give a plausible short date in their own convention rather than translating the month name in isolation. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "May 31"
    },
    "demo_goal_typescript_deadline": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. The deadline shown on the second demo goal. An already-formatted short date; see demo_goal_q3_deadline. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Jun 14"
    },
    "demo_note_groceries": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo sticky note's body. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Groceries: oat milk, coffee, the good bread."
    },
    "demo_note_review_ritual": {
      "description": "Seed content shown once on a brand-new profile so the surface is not empty; it becomes ordinary user data as soon as the user edits it. A demo sticky note's body. A translator should write a natural example for their own market rather than translate this literally.",
      "message": "Idea: a weekly review ritual on Friday afternoons."
    }
  });

// [1.5.0] THE CENSUS, pass A3 - the export's untagged label. One token, so the
// census could not see it; check-insights-readers found it by going red.
I18n.register("en", {
    "export_tag_untagged": {
      "description": "Stands in for a tag's name in the CSV export, for focused time that carried no tag at all. Parenthesised and lower case because it is a statement ABOUT the missing tag, not a tag name - which is what separates it from insights_untagged ('Untagged'), the donut row for the same time on the Insights chart. The two are deliberately different strings on different surfaces.",
      "message": "(untagged)"
    }
  });

// [1.5.0] THE CENSUS, pass B - modal validation, task-row controls, recurrence
// hints, upgrade and licence copy, workspaces and tags, the tour, the backup
// confirmations, the active-task tooltips, focus blocking, the pickers and
// the wallpaper errors.
I18n.register("en", {
    "modal_name_required": {
      "description": "Validation error under the name field when it is left empty. ONE KEY, FOUR SINKS: the goal, task, recurring-task and template modals all state the same rule, so it is written once.",
      "message": "Name is required."
    },
    "modal_deadline_invalid": {
      "description": "Validation error when a goal's deadline is not a date the field can parse. Its task-side sibling is modal_due_date_invalid.",
      "message": "Deadline is not a valid date."
    },
    "modal_due_date_invalid": {
      "description": "Validation error when a task's due date is not a date the field can parse. Its goal-side sibling is modal_deadline_invalid.",
      "message": "Due date is not a valid date."
    },
    "modal_goal_deadline_before_task": {
      "description": "Validation error when a goal's deadline would fall before a task inside it is due. {task} is the blocking task's name and {date} an already-formatted short date. Two sentences: what is wrong, then the two ways out.",
      "message": "{task} is due {date}, so the goal deadline can't be earlier. Update the task first or pick a later deadline."
    },
    "modal_goal_rename_failed": {
      "description": "Error when renaming a goal did not take. A write failed rather than the input being wrong, so it names no field.",
      "message": "Could not rename goal."
    },
    "modal_goal_from_template_failed": {
      "description": "Error when creating a goal from a template did not take.",
      "message": "Could not create goal from template."
    },
    "modal_goal_create_failed": {
      "description": "Error when creating a goal did not take.",
      "message": "Could not create goal."
    },
    "modal_task_create_failed": {
      "description": "Error when creating a task did not take.",
      "message": "Could not create task."
    },
    "modal_pick_a_weekday": {
      "description": "Validation error on a weekly recurring task when no day of the week is ticked.",
      "message": "Pick at least one day of the week."
    },
    "modal_day_of_month_range": {
      "description": "Validation error on a monthly recurring task when the day of month is outside 1-31.",
      "message": "Day of month must be between 1 and 31."
    },
    "modal_recurring_save_failed": {
      "description": "Error when saving an EDITED recurring task did not take. Its create-side sibling is modal_recurring_create_failed.",
      "message": "Could not save recurring task."
    },
    "modal_recurring_create_failed": {
      "description": "Error when creating a NEW recurring task did not take. Its edit-side sibling is modal_recurring_save_failed.",
      "message": "Could not create recurring task."
    },
    "modal_template_deadline_days": {
      "description": "Validation error on a template's deadline-in-days field when it is negative or not a number. The parenthesis says what to do instead of filling it in.",
      "message": "Deadline days must be 0 or more (blank for none)."
    },
    "modal_template_save_failed": {
      "description": "Error when saving a template did not take.",
      "message": "Could not save template."
    },
    "modal_title_edit_goal": {
      "description": "Title of the goal modal when editing an existing goal. Its create-side sibling is modal_title_new_goal.",
      "message": "Edit goal"
    },
    "modal_title_new_goal": {
      "description": "Title of the goal modal when creating one, and also the fallback name for an untitled goal. Its edit-side sibling is modal_title_edit_goal.",
      "message": "New goal"
    },
    "modal_title_edit_recurring": {
      "description": "Title of the recurring-task modal when editing. Its create-side sibling is modal_title_new_recurring.",
      "message": "Edit recurring task"
    },
    "modal_title_new_recurring": {
      "description": "Title of the recurring-task modal when creating. Its edit-side sibling is modal_title_edit_recurring.",
      "message": "New recurring task"
    },
    "modal_title_edit_template": {
      "description": "Title of the template modal when editing. Its create-side sibling is modal_title_new_template.",
      "message": "Edit template"
    },
    "modal_title_new_template": {
      "description": "Title of the template modal when creating. Its edit-side sibling is modal_title_edit_template.",
      "message": "New template"
    },
    "task_due_set_aria": {
      "description": "Accessible name on a task's due-date chip once a date is set. {date} is an already-formatted date. The unset form is task_due_unset_aria.",
      "message": "Due {date}. Click to change"
    },
    "task_filter_priority_n": {
      "description": "The priority filter button showing how many priorities are selected. {count} is that number, in parentheses after the label.",
      "message": "Priority ({count})"
    },
    "task_filter_tag_n": {
      "description": "The tag filter button showing how many tags are selected. {count} is that number.",
      "message": "Tag ({count})"
    },
    "task_play_start": {
      "description": "Tooltip on a task's play control when the task is not yet active - pressing it makes this the active task and starts recording. Its pause and resume siblings already existed and are repointed: sat_pause_tracking, sat_resume_tracking.",
      "message": "Start task"
    },
    "task_mark_complete": {
      "description": "The control that completes an open task. Its opposite for an already-completed one is the existing completed_reactivate. DELIBERATE DUPLICATE: goal_mark_complete already holds 'Mark complete' for a GOAL. A task and a goal are different objects and a language that inflects the verb by its object must be able to differ.",
      "message": "Mark complete"
    },
    "task_recurring_deleted_toast": {
      "description": "Toast after deleting a recurring template, reassuring the user that instances already created are untouched. No final stop: it is a toast, not a sentence in a paragraph.",
      "message": "Recurring task deleted, existing instances kept"
    },
    "task_tracked_in_last_days": {
      "description": "Tooltip on a task's cumulative time chip. {duration} is an already-formatted duration and {count} the number of days in the window.",
      "message": "",
      "plural": {
        "one": "{duration} tracked in the last day",
        "other": "{duration} tracked in the last {count} days"
      }
    },
    "goal_conflict_fallback_name": {
      "description": "Stands in for a goal's name in the deadline-conflict dialog when the name cannot be resolved. Lower case because it sits inside a sentence.",
      "message": "the goal"
    },
    "goal_conflict_keep_deadline": {
      "description": "The choice that keeps the goal's deadline and moves the task's due date to match. {date} is an already-formatted date.",
      "message": "Keep goal deadline, set task to {date}"
    },
    "recur_hint_daily": {
      "description": "One-line summary of a daily recurring template. {time} is a clock time in the user's own format.",
      "message": "Daily at {time}"
    },
    "recur_hint_weekly": {
      "description": "One-line summary of a weekly recurring template. {days} is an already-joined list of weekday names and {time} a clock time. A language that orders 'on Monday, Tuesday at 09:00' differently should reorder the placeholders.",
      "message": "Weekly on {days} at {time}"
    },
    "recur_hint_monthly": {
      "description": "One-line summary of a monthly recurring template. {day} is a day number and {time} a clock time.",
      "message": "Monthly on day {day} at {time}"
    },
    "upgrade_sheet_subhead_trial_used": {
      "description": "Sub-heading on the upgrade sheet for someone whose trial has ended. Reassurance, not a feature list: the point is that nothing they built is lost. Its never-trialled sibling is upgrade_sheet_subhead_new.",
      "message": "Keep your focus going. Upgrade any time, and everything you've set up stays."
    },
    "upgrade_sheet_title_upgrade": {
      "description": "Heading on the upgrade sheet for someone who has already used their trial. Its never-trialled sibling is upgrade_sheet_title_try.",
      "message": "Upgrade to LaunchPad Pro"
    },
    "upgrade_sheet_title_try": {
      "description": "Heading on the upgrade sheet for someone who has never trialled Pro. Names the trial length rather than the price. Its trial-used sibling is upgrade_sheet_title_upgrade.",
      "message": "Try LaunchPad Pro free for 7 days"
    },
    "upgrade_sheet_subhead_new": {
      "description": "Sub-heading on the upgrade sheet for someone who has never trialled Pro - the short feature list. Its trial-used sibling is upgrade_sheet_subhead_trial_used.",
      "message": "Workspaces, tasks, time tracking, and more."
    },
    "license_error_enter_key": {
      "description": "Validation error when Apply is pressed with the licence-key field empty.",
      "message": "Enter a license key."
    },
    "license_error_module_missing": {
      "description": "Error when the licence module failed to load, so the key cannot be checked at all. Tells the user the one thing that might fix it.",
      "message": "License module unavailable. Reload the page and try again."
    },
    "license_error_validate_failed": {
      "description": "Fallback error when the licence check failed and the server sent no message of its own.",
      "message": "Could not validate license."
    },
    "license_error_unexpected": {
      "description": "Fallback error when the licence check threw rather than returning a failure. Distinct from license_error_validate_failed, which is a clean refusal.",
      "message": "Unexpected error validating license."
    },
    "plan_line_trial": {
      "description": "The plan line in Pro settings during a trial. 'Plan:' is a label and the word after it is the tier. Siblings: plan_line_pro, plan_line_grace, plan_line_free.",
      "message": "Plan: Trial"
    },
    "plan_line_pro": {
      "description": "The plan line in Pro settings on a paid, verified subscription. Siblings: plan_line_trial, plan_line_grace, plan_line_free.",
      "message": "Plan: Pro"
    },
    "plan_line_grace": {
      "description": "The plan line in Pro settings for a paid subscription that has not been verified recently - still fully working, hence 'Pro', with the state in parentheses. Siblings: plan_line_pro, plan_line_trial, plan_line_free.",
      "message": "Plan: Pro (grace)"
    },
    "plan_line_free": {
      "description": "The plan line in Pro settings with no Pro access. Siblings: plan_line_trial, plan_line_pro, plan_line_grace.",
      "message": "Plan: Free"
    },
    "ws_delete_blocked_last": {
      "description": "Tooltip on the delete control of the only remaining workspace, explaining why it is refused. A statement of the rule rather than an error, because nothing has gone wrong yet.",
      "message": "You need at least one workspace."
    },
    "focusblock_add_failed": {
      "description": "Fallback error when adding a site to the focus block list failed and the caller sent no message of its own.",
      "message": "Could not add that site."
    },
    "tags_active_count": {
      "description": "The count line above the tag list. {count} is the number of tags not in the trash; its trashed companion is appended separately from tags_in_trash_suffix.",
      "message": "",
      "plural": {
        "one": "{count} active tag",
        "other": "{count} active tags"
      }
    },
    "tags_in_trash_suffix": {
      "description": "Appended to tags_active_count when some tags are in the trash. {count} is that number. The middot separates two counts rather than joining clauses - a language that would not use one should drop it.",
      "message": "· {count} in trash"
    },
    "tour_tasks": {
      "description": "Tour bubble pointing at the Tasks tab. 'Plan it' echoes the tab's own promise; the colon introduces the list.",
      "message": "Plan it: tasks, goals, and recurring work live here."
    },
    "tour_dashboard": {
      "description": "Tour bubble pointing at the Dashboard tab.",
      "message": "See your focused time add up across every workspace."
    },
    "tour_insights": {
      "description": "Tour bubble pointing at the Insights tab. A list of four things and then the point - that none of it has to be logged by hand.",
      "message": "Deep work, tags, sites, top tasks. Measured automatically."
    },
    "tip_add_shortcut": {
      "description": "Step 1 of the first-run tip strip.",
      "message": "Add your first shortcut"
    },
    "tip_nest_tile": {
      "description": "Step 3 of the first-run tip strip - dragging one tile onto another to make a group.",
      "message": "Nest one tile on another"
    },
    "tip_create_group": {
      "description": "Step 4 of the first-run tip strip.",
      "message": "Create a group"
    },
    "tip_switch_workspaces": {
      "description": "Step 5 of the first-run tip strip.",
      "message": "Switch workspaces"
    },
    "topsites_group_name": {
      "description": "Name of the group created by 'Import Top Sites'. Becomes an ordinary group the user can rename, so it is a name rather than a label.",
      "message": "Top Sites"
    },
    "backup_contains_core": {
      "description": "The first item in the list of what a backup file holds. Lower case because it sits inside a sentence built from backup_restore_confirm.",
      "message": "shortcuts, groups and settings"
    },
    "backup_contains_license": {
      "description": "Listed among a backup's contents when it carries a Pro licence key.",
      "message": "license key"
    },
    "backup_contains_tracking": {
      "description": "Listed among a backup's contents when it carries tracked focus history.",
      "message": "tracked focus history"
    },
    "backup_unknown_date": {
      "description": "Stands in for a backup's date when the file does not carry one. Lower case because it sits inside a sentence where a date would.",
      "message": "an unknown date"
    },
    "backup_restore_confirm": {
      "description": "Confirmation before restoring a CURRENT-format backup. {date} is the backup's date (or backup_unknown_date) and {list} an already-joined list of its contents. Says what is replaced, then the safety net, then asks.",
      "message": "This backup from {date} contains: {list}. Importing replaces all of it. Your current data is saved as a recovery backup first. Continue?"
    },
    "backup_restore_confirm_legacy": {
      "description": "Confirmation before restoring an OLDER-format backup, which carries less. {date} and {list} as in backup_restore_confirm. The extra clause exists because the thing NOT replaced is the surprising part.",
      "message": "This is an older backup format from {date}. It contains: {list}. Everything else, including your tracked focus history, is left exactly as it is. Your current data is saved as a recovery backup first. Continue?"
    },
    "variant_same_address": {
      "description": "Shown in place of a shortcut variant's distinguishing detail when two variants resolve to the same address and nothing separates them. Lower case: it sits where a URL fragment would.",
      "message": "same address"
    },
    "sat_title_lifetime": {
      "description": "Tooltip on a task's lifetime total, explaining that it outlives the daily aggregates it was built from. No final stop: it is a short tooltip label.",
      "message": "Total focused time recorded for this task, kept beyond the day aggregates it came from"
    },
    "sat_title_ready": {
      "description": "Tooltip on the active-task time before any browsing has happened. Three short sentences: the state, the trigger, and why the number is not moving while the user reads it.",
      "message": "Ready. Time records as soon as you browse a site. This page is not tracked, so the number holds here."
    },
    "sat_title_active": {
      "description": "Tooltip on the wall-clock reading, drawing the distinction that matters: this is time since activation, NOT measured browsing time. Its measured counterpart is sat_title_lifetime.",
      "message": "Wall-clock since you activated this task, pauses excluded. Not measured browsing time."
    },
    "sat_title_worked": {
      "description": "Tooltip on the worked total - time the task has been the active one, pauses excluded. No final stop.",
      "message": "Total time this task has been active, pauses excluded"
    },
    "focusblock_state_off": {
      "description": "The focus-blocking status line when blocking is off. 'Focus blocking:' is a label; siblings focusblock_state_auto, focusblock_state_on.",
      "message": "Focus blocking: off"
    },
    "focusblock_state_auto": {
      "description": "The focus-blocking status line when blocking arms itself with a focus session. The parenthesis distinguishes it from always-on. Siblings: focusblock_state_off, focusblock_state_on.",
      "message": "Focus blocking: on (auto)"
    },
    "focusblock_state_on": {
      "description": "The focus-blocking status line when blocking is on regardless of a session. Siblings: focusblock_state_off, focusblock_state_auto.",
      "message": "Focus blocking: on"
    },
    "focusblock_turn_off": {
      "description": "Tooltip on the focus-blocking toggle while it is on. Its opposite is focusblock_turn_on.",
      "message": "Turn focus blocking off"
    },
    "focusblock_turn_on": {
      "description": "Tooltip on the focus-blocking toggle while it is off. Its opposite is focusblock_turn_off.",
      "message": "Turn focus blocking on"
    },
    "group_open_all": {
      "description": "The control that opens every shortcut in a group at once. The triangle is a play glyph and should stay; only the words are translated.",
      "message": "▶ Open All"
    },
    "group_empty_hint": {
      "description": "Hint inside an empty group, naming the other way to add a page. The arrow stands for 'then' and is a glyph, not a word.",
      "message": "or right-click any page → Add to LaunchPad"
    },
    "sessions_in_trash": {
      "description": "The count of saved sessions currently in the trash. {count} is that number.",
      "message": "",
      "plural": {
        "one": "{count} session in trash",
        "other": "{count} sessions in trash"
      }
    },
    "picker_no_goals_match": {
      "description": "Shown in the goal picker when the filter matches nothing. Its task-side sibling is picker_no_tasks_match.",
      "message": "No goals match that."
    },
    "picker_no_tasks_match": {
      "description": "Shown in the task picker when the filter matches nothing. Its goal-side sibling is picker_no_goals_match.",
      "message": "No tasks match that."
    },
    "picker_move_task_to_goal": {
      "description": "Title of the goal picker for a task that already belongs to a goal. {task} is the task's name. Its unassigned sibling is picker_assign_task_to_goal.",
      "message": "Move {task} to another goal"
    },
    "picker_assign_task_to_goal": {
      "description": "Title of the goal picker for a task with no goal yet. {task} is the task's name. Its reassignment sibling is picker_move_task_to_goal.",
      "message": "Assign {task} to a goal"
    },
    "picker_attached_note": {
      "description": "Marks the row in the task picker that the session is already attached to.",
      "message": "attached to this session"
    },
    "picker_change_session_task": {
      "description": "Title of the task picker for a session that already has a task. {session} is the session's name, or session_unnamed_fallback when it has none.",
      "message": "Change the task for {session}"
    },
    "picker_attach_session_task": {
      "description": "Title of the task picker for a session with no task yet. {session} as in picker_change_session_task.",
      "message": "Attach {session} to a task"
    },
    "session_unnamed_fallback": {
      "description": "Stands in for a session's name in picker_attach_session_task when it has none. Lower case, inside a sentence; the demonstrative form is the existing sessions_this_session.",
      "message": "session"
    },
    "recent_empty_today": {
      "description": "Shown in the browsing-history panel when today's filter has nothing yet. Its other-period sibling is recent_empty_period.",
      "message": "No browsing history yet today"
    },
    "recent_empty_period": {
      "description": "Shown in the browsing-history panel when a non-today filter has nothing. Its today sibling is recent_empty_today.",
      "message": "No pages found for this period"
    },
    "bg_error_not_an_image": {
      "description": "Error when the chosen file is not an image the browser can read.",
      "message": "Please select a valid image file."
    },
    "bg_error_read_failed": {
      "description": "Error when reading the chosen file failed - the file is an image but could not be loaded.",
      "message": "Failed to read file."
    },
    "bg_error_bad_url": {
      "description": "Error when the pasted wallpaper address is not a usable http(s) URL. Names the two schemes rather than saying 'invalid', because that is the actual fix.",
      "message": "Please enter a valid URL starting with http:// or https://"
    },
    "bg_error_load_failed": {
      "description": "Error when a wallpaper URL loaded nothing. Names the most likely cause - hotlink protection - and the way round it, because 'could not load' alone leaves the user with nothing to try.",
      "message": "Could not load image. The server may block external access. Try uploading the image instead."
    }
  });

// [1.5.0] THE CENSUS, pass D - importers.js. The FORMAT NAMES are product
// names and each description says to use the name that product uses in the
// market rather than to translate it. The GROUP NAMES are seed content: they
// become real groups the user can rename.
I18n.register("en", {
    "importfmt_toby": {
      "description": "The name of an import format, shown to the user once LaunchPad has worked out which kind of file they gave it. A PRODUCT NAME: use the name that product uses in this market, and leave it in English if it has none. Toby is a tab-manager extension.",
      "message": "Toby"
    },
    "importfmt_session_buddy": {
      "description": "The name of an import format, shown to the user once LaunchPad has worked out which kind of file they gave it. A PRODUCT NAME: use the name that product uses in this market, and leave it in English if it has none. Session Buddy is a tab-manager extension.",
      "message": "Session Buddy"
    },
    "importfmt_speed_dial_2": {
      "description": "The name of an import format, shown to the user once LaunchPad has worked out which kind of file they gave it. A PRODUCT NAME: use the name that product uses in this market, and leave it in English if it has none. Speed Dial 2 is a new-tab extension. The '2' is part of the name, not a version to drop.",
      "message": "Speed Dial 2"
    },
    "importfmt_onetab": {
      "description": "The name of an import format, shown to the user once LaunchPad has worked out which kind of file they gave it. A PRODUCT NAME: use the name that product uses in this market, and leave it in English if it has none. OneTab is a tab-manager extension. One word, capital T.",
      "message": "OneTab"
    },
    "importfmt_bookmarks_html": {
      "description": "The name of an import format, shown to the user once LaunchPad has worked out which kind of file they gave it. A PRODUCT NAME: use the name that product uses in this market, and leave it in English if it has none. Not a product but the export format every browser calls 'Bookmarks HTML' - the Netscape bookmark file. 'HTML' stays.",
      "message": "Bookmarks HTML"
    },
    "importfmt_json_export": {
      "description": "The name of an import format, shown to the user once LaunchPad has worked out which kind of file they gave it. A PRODUCT NAME: use the name that product uses in this market, and leave it in English if it has none. The fallback when the file is JSON carrying links but matches no format LaunchPad recognises. Not a product name; this one is ordinary words and should be translated.",
      "message": "JSON export"
    },
    "importfmt_pasted_links": {
      "description": "The name of an import format, shown to the user once LaunchPad has worked out which kind of file they gave it. A PRODUCT NAME: use the name that product uses in this market, and leave it in English if it has none. The fallback when the user pasted a list of addresses rather than giving a file. Not a product name; ordinary words.",
      "message": "Pasted links"
    },
    "import_group_toby_list": {
      "description": "The name of a group LaunchPad creates during an import. It becomes a REAL GROUP in the user's sidebar and they can rename it, so it is seed content rather than a label. Used for a Toby list that carries no title of its own.",
      "message": "Toby list"
    },
    "import_group_links": {
      "description": "The name of a group LaunchPad creates during an import. It becomes a REAL GROUP in the user's sidebar and they can rename it, so it is seed content rather than a label. Used when every imported link goes into one group - the single-group case. Its multi-group sibling is import_group_numbered.",
      "message": "Imported links"
    },
    "import_group_bookmarks": {
      "description": "The name of a group LaunchPad creates during an import. It becomes a REAL GROUP in the user's sidebar and they can rename it, so it is seed content rather than a label. Used for the top level of a Bookmarks HTML import, holding links that sat outside any folder.",
      "message": "Imported bookmarks"
    },
    "import_group_numbered": {
      "description": "The name of a group LaunchPad creates during an import. It becomes a REAL GROUP in the user's sidebar and they can rename it, so it is seed content rather than a label. Used when an import produced several groups and none had a name. {count} is the group's position, counting from 1. Its single-group sibling is import_group_links.",
      "message": "Imported group {count}"
    },
    "import_group_window": {
      "description": "The name of a group LaunchPad creates during an import. It becomes a REAL GROUP in the user's sidebar and they can rename it, so it is seed content rather than a label. Used for a saved browser window that carries no title. {count} is the window's position, counting from 1.",
      "message": "Window {count}"
    },
    "bell_due_work_label": {
      "description": "Accessible name of the due-work bell in the tab bar. {count} is how many items are due and not snoozed. THE BELL REPORTS WHAT EXISTS, IT DOES NOT URGE. No exclamation, no deadline language, no second person imperative about being late. The bell is ABSENT when the count is zero, so this string never renders a zero and a translation must not add an 'all clear' form.",
      "message": "Due work: {count}"
    },
    "bell_due_work_title": {
      "description": "Title of the list that opens from the bell. Names the SCOPE rather than making a claim about the user: what is due, not what they have failed to do. THE BELL REPORTS WHAT EXISTS, IT DOES NOT URGE. No exclamation, no deadline language, no second person imperative about being late. ",
      "message": "Due work"
    },
    "bell_group_overdue": {
      "description": "Group heading inside the bell's list for tasks whose due date has passed. The list groups them; the COUNT OUTSIDE does not distinguish them, because overdue is the more urgent fact and urgency is what the bell must not carry. Neutral noun, never 'late' or 'missed'.",
      "message": "Overdue"
    },
    "bell_group_today": {
      "description": "Group heading inside the bell's list for tasks due today that are not recurring instances.",
      "message": "Due today"
    },
    "bell_group_recurring": {
      "description": "Group heading inside the bell's list for recurring instances generated for today. Kept separate from Due today because a repeating item is a different kind of commitment and completing one does not finish it for good.",
      "message": "Recurring"
    },
    "bell_snooze": {
      "description": "The lighter of the bell's two actions: hide this row until tomorrow. The task is NOT changed and still appears on the Dashboard's due list - the bell is a signal, not a filter. Returns on its own tomorrow if still undone, so a translation must not imply permanence.",
      "message": "Snooze"
    },
    "bell_go_to_task": {
      "description": "The bell's other action: open the Tasks tab with this task's row in view, expanding its goal if it has one. Navigation only; nothing is written.",
      "message": "Go to task"
    },
    "bell_snoozed_until_tomorrow": {
      "description": "Toast after a snooze. Says what happened and when it ends, so 'snooze' is not a word the user has to guess the duration of. {name} is the task.",
      "message": "{name} snoozed until tomorrow"
    },
    "settings_privacy": {
      "description": "Section heading in the FREE Settings panel holding the track-time opt-out. Named Privacy rather than Tracking because what the row governs is whether the browser measures the user at all, which is the question they are actually answering.",
      "message": "Privacy"
    },
    "settings_track_time_on_sites": {
      "description": "The free opt-out's label. ENGINE-MEASURED TIME ON WEB PAGES - the same sense pt_time_on_other_sites means, and the control that decides whether any of it is recorded. ON by default per the 2026-09-12 ruling. Writes the per-workspace tracking state, the same one Pro Settings writes.",
      "message": "Track time on sites"
    },
    "settings_track_time_note": {
      "description": "Note under the opt-out. Says what it does, what it is for, and where the data goes - the last clause is load-bearing, because a user reading 'track' on a browser extension reasonably assumes it leaves.",
      "message": "On by default. Measures how long you spend on each site so the Dashboard can show today. Stays on this device."
    },
    "settings_track_on": {
      "description": "Toast when the user switches site tracking ON. States the consequence rather than congratulating.",
      "message": "Tracking time on sites"
    },
    "settings_track_off": {
      "description": "Toast when the user switches site tracking OFF. Says what stops AND what happens to what was already measured, because 'off' alone leaves the user wondering whether their history was deleted.",
      "message": "Stopped. Today's card is hidden; nothing already recorded is deleted."
    },
  });

// [1.16.1] DB.2 - completion from the bell. The recurring second confirm and
// the undo toast are BUILT here, not reused: the task row has neither. See the
// premise-audit note in newtab.js beside dueBellComplete.
I18n.register("en", {
    "bell_complete": {
      "description": "The bell row's third action: completes the task. LAST of the three on purpose - the ruling requires the destructive act to be the harder one to reach, and snooze, the lighter act, is first. Its row-side equivalent is the checkbox, which has no label at all.",
      "message": "Complete"
    },
    "bell_recurring_confirm_title": {
      "description": "Title of the second confirmation shown when the task being completed from the bell is a RECURRING INSTANCE. Only recurring instances get this dialog; an ordinary task completes with no confirm, exactly as it does from the row.",
      "message": "Complete this recurring task?"
    },
    "bell_recurring_confirm_body": {
      "description": "Body of the recurring second confirmation. {name} is the task. It must say plainly that the task REPEATS and that completing it closes only today's instance - the whole point of the second confirm is that a user might believe they are finishing the series for good. The second sentence names snooze, which stays available at this moment per the ruling.",
      "message": "{name} repeats. Completing it closes today's instance; the next one arrives on its schedule. To set it aside for today instead, snooze it."
    },
    "bell_recurring_confirm_action": {
      "description": "The primary button on the recurring second confirmation. Names the act rather than saying 'OK', so the button reads as what it does when read alone.",
      "message": "Complete today's"
    },
    "bell_completed_undo": {
      "description": "The undo toast after completing a task from the bell. {name} is the task. UNDO IS MANDATORY here per the ruling: snooze and complete sit adjacent on a compact control and mean opposite things, so a mis-tap must be recoverable in one action from the same place. The toast's button is undo_undo.",
      "message": "{name} completed"
    }
  });

// [PT.3] The zero case, and the hero's label. pt_focused_today_by_site
// REPLACES pt_today_by_site_title (decision H); the old key is removed in the
// same commit so there is no second heading left for a later round to revive.
I18n.register("en", {
    "pt_focused_today_by_site": {
      "description": "ENGINE-MEASURED TIME ON WEB PAGES. Not wall clock, not session length. REPLACES pt_today_by_site_title, and the change is decision H. The old heading read 'Today, by site' directly beneath the Dashboard hero's 'Focused today' and its number - two labels for ONE quantity, with nothing saying so. The two lists under this heading SUM to the hero's figure exactly (PT.1 reconciled them to the millisecond), so the heading now borrows the hero's own words and adds the axis. A reader who sees 'Focused today 2h30m' and then 'Focused today, by site' cannot take them for two different measurements. The words 'Focused today' must match common_focused_today exactly, in every language - if that key is retranslated this one moves with it or the pairing is lost. The word SITE is load-bearing and may not be dropped: the invisible boundary is what produced both failures this feature was opened about.",
      "message": "Focused today, by site"
    },
    "pt_tracking_off_pill": {
      "description": "Replaces the active-task card's 'Focused today' FIGURE when tracking is switched off for this workspace. NOT a zero: a zero is a statement about the user's day, and the truth is that nothing was measured. The same rule the Dashboard hero already follows by rendering nothing at all - this surface cannot go absent, because the card around it is about the task rather than about time, so it says the state instead. Names the switch in the words the Settings row uses so the user can find it.",
      "message": "Not tracking"
    },
    "pt_tracking_off_pill_title": {
      "description": "Tooltip on pt_tracking_off_pill, naming where the switch is. Settings → Privacy → Track time on sites is the free panel's row added in PT.2; the wording matches that row's label exactly so the user searches for the words they are shown.",
      "message": "Time on sites is switched off for this workspace. Settings › Privacy › Track time on sites."
    },
    "pt_tracking_off_hero_combined": {
      "description": "Replaces the Dashboard hero's figure in the 'all workspaces' scope when NO workspace is tracking. In the single-workspace scope the hero renders nothing at all (dashFocusedScope returns null), which is the better answer and is unchanged; the combined scope cannot use it, because 'all workspaces' with SOME tracking is a real figure and the hero has to stay. So the figure is replaced only when every workspace is off, and it says the state rather than 0m.",
      "message": "Not tracking"
    }
  });

// ===== [FIX-8] SETTINGS, CUT TO WHAT A USER TOUCHES ======================
//
// Eight of these fourteen are SHORTER FORMS of keys that stay in the
// catalogue, because their long forms are now the info glyph on the same row
// rather than a paragraph beneath it. Both are live and both are shown; the
// long one is the title and the aria-label, the short one is the label. A
// translator changing one must look at the other.
I18n.register("en", {
    "settings_advanced": {
      "description": "The fold under Focus sessions and Focus blocking. FIX-8 cut those two tiles to the rows a user touches - four and three - and put the rest behind this. It is a summary on a <details>, so it is a control and not a heading; keep it to one word.",
      "message": "Advanced"
    },
    "prosettings_work_length": {
      "description": "The Focus sessions work-phase length. Replaces prosettings_work ('Work'), which sat directly under a Mode row whose first segment is also 'Work' - two different meanings of one word, one line apart. The row is a number of minutes, so the label says which length.",
      "message": "Work length"
    },
    "prosettings_break_length": {
      "description": "The Focus sessions short-break length. Replaces prosettings_short_break ('Short break'); with Long break moved behind Advanced there is no longer a second break on the tile to be short in contrast to, so the word 'short' only raised a question the visible rows no longer answer.",
      "message": "Break length"
    },
    "prosettings_chime": {
      "description": "The label on the Focus sessions chime picker. The control's full sense - a sound at each phase boundary - is its aria-label, which is prosettings_sound_at_each_phase_boundary; this is the row label beside it and has one column to live in.",
      "message": "Chime"
    },
    "prosettings_chain_after_break_short": {
      "description": "Row label for the roll-into-next-phase toggle, behind Advanced. The full sentence, including the ten-second countdown you can cancel, is prosettings_chain_after_break and is now the row's info glyph. Keep this short enough not to wrap beside a toggle.",
      "message": "Roll into the next phase"
    },
    "prosettings_desktop_notifications_short": {
      "description": "Row label for the phase-boundary notifications toggle, behind Advanced. The full sentence, including that it fires with no tab open, is prosettings_desktop_notifications_at_each_phase and is now the row's info glyph.",
      "message": "Desktop notifications"
    },
    "prosettings_commitment_toggle_short": {
      "description": "Row label for the repeat-snooze commitment toggle, behind Focus blocking's Advanced. The full sentence is prosettings_commitment_note and is now the row's info glyph.",
      "message": "Type a sentence before a repeat snooze"
    },
    "prosettings_combined_analytics_short": {
      "description": "Row label for the combined-analytics toggle, which FIX-8 moved from Workspaces to the Data tile. The full sentence, 'Show combined analytics across all workspaces', is prosettings_show_combined_analytics_across_all and is now the row's info glyph.",
      "message": "Combined analytics"
    },
    "prosettings_no_blocked_sites_yet_add_short": {
      "description": "The Focus blocking empty state. Replaces prosettings_no_blocked_sites_yet_add, which told the user to 'add one below' - the add field is now the very next thing on the tile rather than several rows down, so the instruction describes a layout that no longer exists. What survives is the fact they cannot infer: subdomains are covered.",
      "message": "No blocked sites yet. Subdomains are included."
    },
    "settings_bookmarks": {
      "description": "Row label in the Data tile for importing Chrome bookmarks. The verb is on the button (settings_import_from_chrome); this names the subject, so the row reads as a label and a control like every other row on the surface.",
      "message": "Bookmarks"
    },
    "settings_backups": {
      "description": "Row label in the Data tile carrying the Export and Import buttons. Replaces two full-width stacked buttons that repeated the word 'backup' in both of their labels.",
      "message": "Backups"
    },
    "settings_import_from_chrome": {
      "description": "Button beside the Bookmarks row label. Replaces settings_import_chrome_bookmarks ('Import Chrome Bookmarks'), whose subject is now the row label, so repeating 'Bookmarks' in the button would say it twice.",
      "message": "Import from Chrome"
    },
    "common_export": {
      "description": "The Export button on the Data tile's Backups row. Bare verb: its object is the row label beside it. Shares a row with common_import and the two must stay the same length class so the pair does not read lopsided.",
      "message": "Export"
    },
    "common_import": {
      "description": "The Import button on the Data tile's Backups row. Bare verb: its object is the row label beside it. Pairs with common_export.",
      "message": "Import"
    }
  });

// ===== [FIX-9] THE DASHBOARD HERO'S WORKING ZONE =========================
//
// The three figures on the working line are NOT new. The active-task pill
// carried "0:09 active - since 10:50 - 1h39m worked on this task" until
// FIX-6 removed it and its keys with it; these re-home that readout. Every
// one of them is wall-clock rather than engine time, which is why none of
// them may use the word 'focused'.
I18n.register("en", {
    "dash_scope_all_workspaces": {
      "description": "The Dashboard hero figure's label in the combined-analytics scope. Replaces dash_focused_today_all_workspaces, which repeated the tile eyebrow's own 'Focused today' eight lines lower - two labels for one figure. What the repetition was hiding is the SCOPE: with three workspaces, '2h30m focused today' means very different things summed or not, and nothing on the tile said which.",
      "message": "All workspaces"
    },
    "dash_scope_this_workspace": {
      "description": "Fallback for the same label in the single-workspace scope, used only when the workspace has no name - the label is normally the workspace's OWN name, which is the user's text and is never translated.",
      "message": "This workspace"
    },
    "dash_working_active": {
      "description": "The unit word after the Dashboard hero's live elapsed figure, as in '0:09 active'. WALL CLOCK, not engine time: this counts from when the task was made active, which is the same family the Tasks row's own 'active' readout belongs to and deliberately the same word. 'Focused' is reserved for engine-measured time and must not be substituted here. Replaced by dash_session_paused while tracking is paused.",
      "message": "active"
    },
    "dash_working_since": {
      "description": "The timestamp clause on the Dashboard hero's working line. {time} is a locale time, or a short date and time once the activation is older than today - a task left active overnight is a real state and a bare 'since 10:50' the next afternoon is a lie about which 10:50. The count answers 'how long' and this answers 'since when'.",
      "message": "since {time}"
    },
    "dash_working_worked": {
      "description": "The lifetime clause on the Dashboard hero's working line. {duration} is every minute ever banked against this task plus the activation currently running, so it is a much larger number than the elapsed figure beside it - the words 'worked on this task' are what keep the two from reading as a contradiction and may not be shortened to 'worked'.",
      "message": "{duration} worked on this task"
    }
  });
