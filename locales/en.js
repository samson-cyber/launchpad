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
  "common_preview": {
    "message": "Preview",
    "description": "Generic action label, shared across surfaces. Shared by 3 sinks: newtab.html:469 attr:title, newtab.html:473 attr:title, newtab.html:477 attr:title.",
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
    "description": "Text on the gate surface."
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
  "page_search_or_type_a_url": {
    "message": "Search or type a URL",
    "description": "placeholder attribute on the page surface."
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
  "prosettings_preview_chime_1": {
    "message": "Preview Chime 1",
    "description": "aria-label attribute on the prosettings surface."
  },
  "prosettings_preview_chime_2": {
    "message": "Preview Chime 2",
    "description": "aria-label attribute on the prosettings surface."
  },
  "prosettings_preview_chime_3": {
    "message": "Preview Chime 3",
    "description": "aria-label attribute on the prosettings surface."
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
    "description": "Wallpaper rotation disabled. The default, and the first segment of the three-way control."
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
  "tasks_action_new_goal": {
    "message": "+ New Goal",
    "description": "Tasks tab header action. The leading + is part of the label."
  },
  "tasks_action_new_recurring": {
    "message": "+ New Recurring",
    "description": "Tasks tab header action. The leading + is part of the label."
  },
  "tasks_action_new_tag": {
    "message": "+ New Tag",
    "description": "Tasks tab header action. The leading + is part of the label."
  },
  "tasks_action_new_task": {
    "message": "+ New Task",
    "description": "Tasks tab header action. The leading + is part of the label."
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
  "tasks_status_all": {
    "message": "All",
    "description": "Task STATUS filter option. A DIFFERENT filter from the history panel's 'All' (history_all); the two must not share a key."
  },
  "tasks_status_completed": {
    "message": "Completed",
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
  "insights_preview_history": {
    "message": "Preview - example data",
    "description": "Row-one caption on the Insights PREVIEW, where the horizon caption sits on the real board. Names the data as an example so the preview cannot be mistaken for the user's own history. Rendered with th()."
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
  "active_active_task": {
    "message": "Active task",
    "description": "Text sink in renderActiveTaskWidget(). Rendered with t()."
  },
  "apply_search_or_type_a_url": {
    "message": "Search or type a URL",
    "description": "Text sink in applySearch(). Rendered with t()."
  },
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
  "sat_change_focus_length": {
    "message": "Change focus length",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_complete_the_task_it_moves_to": {
    "message": "Complete the task. It moves to Completed, and you can uncheck it in Tasks to reopen it.",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_custom": {
    "message": "Custom",
    "description": "Attribute label in satPomoDurChipsHtml(). Rendered with th()."
  },
  "sat_focus_blocking_is_on": {
    "message": "Focus blocking is on",
    "description": "Attribute label in satFocusPillDot(). Rendered with th()."
  },
  "sat_focus_blocking_is_on_2": {
    "message": "Focus blocking is on",
    "description": "Attribute label in satFocusPillDot(). Rendered with th()."
  },
  "sat_minimize": {
    "message": "Minimize",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_minimize_active_task_card": {
    "message": "Minimize active task card",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_pause_tracking": {
    "message": "Pause tracking",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_resume_tracking": {
    "message": "Resume tracking",
    "description": "Attribute label in satPillFaceHtml(). Rendered with th()."
  },
  "sat_resume_tracking_2": {
    "message": "Resume tracking",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_search_tasks": {
    "message": "Search tasks",
    "description": "Attribute label in openSatSwitchMenu(). Rendered with th()."
  },
  "sat_search_tasks_in_all_workspaces": {
    "message": "Search tasks in all workspaces",
    "description": "Attribute label in openSatSwitchMenu(). Rendered with th()."
  },
  "sat_start_a_focus_session": {
    "message": "Start a focus session",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_start_the_next_focus_session": {
    "message": "Start the next focus session",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_stop_focus_session": {
    "message": "Stop focus session",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_stop_tracking_for_now_the_task": {
    "message": "Stop tracking for now. The task stays open and keeps its time.",
    "description": "Attribute label in satCardHtml(). Rendered with th()."
  },
  "sat_switch_active_task": {
    "message": "Switch active task",
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
  "task_delete_task": {
    "message": "Delete task",
    "description": "Attribute label in taskRowHtml(). Rendered with th()."
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
  "dash_nothing_due_today": {
    "message": "Nothing due today. Add one below.",
    "description": "Markup label in dashDueListHtml(). Rendered with th()."
  },
  "dash_nothing_on_the_list": {
    "message": "Nothing on the list.",
    "description": "Markup label in dashHeadHtml(). Rendered with th()."
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
  "insights_deep_work_last_30_days": {
    "message": "Deep Work · last 30 days",
    "description": "Markup label in renderInsightsPreview(). Rendered with th()."
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
  "note_empty_note": {
    "message": "Empty note",
    "description": "Markup label in noteCardHtml(). Rendered with th()."
  },
  "notes_delete_permanently": {
    "message": "Delete permanently",
    "description": "Markup label in notesTrashRowHtml(). Rendered with th()."
  },
  "notes_empty_note": {
    "message": "Empty note",
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
    "description": "Markup label in renderReadOnlyBanner(). Rendered with th()."
  },
  "recurring_edit": {
    "message": "Edit",
    "description": "Markup label in openRecurringContextMenu(). Rendered with th()."
  },
  "recurring_paused": {
    "message": "Paused",
    "description": "Markup label in recurringRowHtml(). Rendered with th()."
  },
  "restore_add_to_launchpad": {
    "message": "Add to LaunchPad",
    "description": "Markup label in restoreDemoExamples(). Rendered with th()."
  },
  "sat_active_task": {
    "message": "Active task",
    "description": "Markup label in satCardHtml(). Rendered with th()."
  },
  "sat_focus_session": {
    "message": "▶ Focus session",
    "description": "Markup label in satCardHtml(). Rendered with th()."
  },
  "sat_focused_today": {
    "message": "Focused today",
    "description": "Markup label in satIdleHeadlineHtml(). Rendered with th()."
  },
  "sat_no_active_task": {
    "message": "No active task",
    "description": "Markup label in satPillFaceHtml(). Rendered with th()."
  },
  "sat_no_goal": {
    "message": "No goal",
    "description": "Markup label in satSwitchListHtml(). Rendered with th()."
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
  "sat_start_next_session": {
    "message": "▶ Start next session",
    "description": "Markup label in satCardHtml(). Rendered with th()."
  },
  "sat_stop": {
    "message": "■ Stop",
    "description": "Markup label in satCardHtml(). Rendered with th()."
  },
  "sat_worked_on_this_task": {
    "message": "worked on this task",
    "description": "Markup label in satWorkedLineHtml(). Rendered with th()."
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
  "task_detach_session": {
    "message": "Detach session",
    "description": "Markup label in openTaskContextMenu(). Rendered with th()."
  },
  "task_duplicate": {
    "message": "Duplicate",
    "description": "Markup label in openTaskContextMenu(). Rendered with th()."
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
    "description": "Markup label in openUpgradePopover(). Rendered with th()."
  },
  "upgrade_or_upgrade_now": {
    "message": "or upgrade now",
    "description": "Markup label in openUpgradePopover(). Rendered with th()."
  },
  "upgrade_start_free_trial": {
    "message": "Start free trial",
    "description": "Markup label in openUpgradePopover(). Rendered with th()."
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
  "sat_window_tracked_time_title": {
    "message": "Tracked time for this task over the last {days} days. The engine keeps no more history than that.",
    "description": "Tooltip on the active-task time window. {days} is the retention window in days (7 or 30)."
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
