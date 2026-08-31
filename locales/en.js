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
  "groupdelete_move": {
    "message": "Move",
    "description": "Text on the groupdelete surface."
  },
  "groupdelete_move_delete": {
    "message": "Move & Delete",
    "description": "Text on the groupdelete surface."
  },
  "groupdelete_shortcuts_to": {
    "message": "shortcuts to:",
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
  "page_reset": {
    "message": "Reset",
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
  "page_upload_custom_icon": {
    "message": "Upload custom icon",
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
    "description": "Text on the tabbar surface."
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
