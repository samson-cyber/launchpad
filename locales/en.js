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
  "bind_icon_file_must_be_under_100kb": {
    "message": "Icon file must be under 100KB.",
    "description": "Text sink in bindEvents(). Rendered with t()."
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
    "message": "distractions blocked",
    "description": "Text sink in dashStripHtml(). Rendered with t()."
  },
  "dash_first_week": {
    "message": "First Week",
    "description": "Text sink in dashStartPeriodWatch(). Rendered with t()."
  },
  "dash_focus_blocking": {
    "message": "focus blocking",
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
  "dash_tasks_completed": {
    "message": "tasks completed",
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
    "message": "daily avg",
    "description": "Text sink in insightsStripHtml(). Rendered with t()."
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
