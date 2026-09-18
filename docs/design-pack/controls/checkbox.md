# Checkbox row

**Where it is used:** Focus view, Just for this workspace, Automatic weekly backup

**Panel:** Settings  
**Sampled from:** `#settings-focus-view`

![Checkbox row on dark, a photograph, and light](checkbox-sheet.png)

_Left to right: `has-bg bg-dark` (#2a2a2a), `has-bg bg-image` (the gallery's Tropical beach), `has-bg bg-light` (#f5f5f5). The mid-grey is the sheet, not the product._

## The markup, as it renders

Taken from the live DOM rather than `newtab.html`, because about a third of Pro Settings is injected at runtime and the static file does not contain it.

```html
<div class="settings-row settings-row-stack">
  <label data-i18n="settings_focus_view" class="settings-label">Focus view</label>
  <label class="pro-toggle-row">
    <input type="checkbox" id="settings-focus-view">
    <span data-i18n="settings_hide_the_grid_and_sidebar">Hide the grid and sidebar, leaving search</span>
  </label>
</div>
```

## The rules that style it

Every rule in `newtab.css` whose selector names one of: `.pro-toggle-row`, `.settings-row-stack`, `.settings-label`. 15 rules.

```css
.settings-perws-row.is-locked .pro-toggle-row {
  cursor: not-allowed;
}

.settings-label {
  display: block;
  font-size: var(--fs-13);
  color: var(--text-secondary);
  margin-bottom: var(--space-1-5);
}

/* [1.2.1 fix] THE DEFAULT IS NOW "INTERACTIVE", AND THAT IS THE WHOLE FIX.
   This rule used to be cursor:not-allowed, written when the only instance was
   the permanently-disabled Analytics placeholder. Every row added since has been
   live, so each one had to remember to opt out — the notifications row via
   :has(), the Focus-blocking row via its section class — and the third row to
   need it (Analytics itself, once combined analytics shipped) is the one nobody
   remembered, because it was the row the default was written for. R3's review
   predicted exactly this ("ANY new interactive row on .pro-toggle-row MUST opt
   out"); a default that has to be opted out of every single time is the defect.
   Inverting it means a new row is correct by default and only a genuinely
   disabled one is special — and there is now exactly one selector deciding that,
   keyed to the disabled attribute itself rather than to a hard-coded row id, so
   it cannot go stale when a row goes live.
   Scope note: the forbidden cursor was the ONLY thing wrong with the Analytics
   row. The label was reported dead too, but a real mouse click on its text
   toggles the checkbox and persists the write — measured on all three rows, both
   directions, and from the row's empty right-hand area. The cursor was lying
   about the control, not describing it. */
.pro-toggle-row {
  display: flex;
  align-items: center;
  gap: var(--space-2-5);
  font-size: var(--fs-13);
  color: var(--text-secondary);
  cursor: pointer;
}

/* The box needs it explicitly: cursor does not inherit into a form control, so
   without this the checkbox itself shows the UA default arrow while the label
   beside it shows a pointer. */
.pro-toggle-row input[type="checkbox"] {
  cursor: pointer;
}

.pro-toggle-row:has(input[type="checkbox"]:disabled),
.pro-toggle-row input[type="checkbox"]:disabled {
  cursor: not-allowed;
}

html.has-bg .pro-toggle-row {
  color: var(--ink-secondary);
}

/* [1.0.18 B-1] had a pointer-cursor opt-out here for the notifications row.
   [1.2.1] deleted it: the base .pro-toggle-row is cursor:pointer now, so the
   opt-out is inherited, not declared. Leaving a rule that opts out of a default
   that no longer exists is how the next reader concludes the opt-out is still
   load-bearing and copies it into a fourth row. */
/* [1.0.18] Group rhythm. Focus sessions stacks four unrelated control groups —
   [durations] [reset] [notifications] [sound] — and the notifications row was
   the one seam with NO gap, so it read as part of the reset group. 12px is the
   panel's established inter-group step (.settings-section-title margin-bottom,
   .pomo-reset-row, .pomo-sound all use it), not a new number. Scoped by :has to
   this instance so the Analytics .pro-toggle-row is unaffected. With the reset
   row's own 12px above, it now has equal breathing room on both sides. */
.pro-toggle-row:has(#pomo-notifications-toggle) {
  margin-top: var(--space-3);
}

/* [1.0.18 B-2] Boundary-chime picker. The ▶ preview is a SIBLING of the label,
   never a child: a button inside a <label> would also toggle that label's radio,
   so auditioning a chime would silently change the selection.

   INK (fix, live-pass finding): every text-bearing row here MUST declare its own
   colour AND carry an html.has-bg override, exactly like .pro-toggle-row and
   .pomo-setting-row above. Shipping these rules with no colour at all let the
   text fall through to body {
  color: var(--text-primary)
}

html.has-bg .settings-label {
  color: var(--ink-secondary);
}

html.bg-light .settings-label {
  color: var(--text-secondary);
}

html.bg-light .pro-toggle-row {
  color: var(--text-secondary);
}

/* [1.0.25] Per-workspace focus-tracking toggles: one per row in the Pro
   Settings workspace list, one in the add-workspace row. Plain checkboxes
   rather than a bespoke switch — this inherits the existing settings idiom
   (.pro-toggle-row) and introduces no new interaction affordance.
   .pws-add-row is left at its default align-items so the input and button keep
   their current stretched height; these labels center themselves instead. */
.pws-tracking,
.pws-add-tracking {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  font-size: var(--fs-11);
  color: var(--ink-chrome);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

/* Group rhythm: 12px is the panel's established inter-group step
   (.settings-section-title margin-bottom, .pomo-reset-row, .pomo-sound and the
   notifications row all use it) — measured, not invented.
   Scoped by the section class rather than :has() because this section has one,
   which the notifications row did not; same effect, one less selector feature.
   [1.2.1] The pointer-cursor override that used to live here is gone — the base
   .pro-toggle-row is cursor:pointer now, so this row inherits it. Only the
   group-rhythm margin was ever specific to this section. */
.focus-block-section .pro-toggle-row {
  margin-top: var(--space-3);
}

.settings-row-stack {
  display: block;
}

.settings-row-stack .settings-label {
  display: block; margin-bottom: 6px;
}

```
