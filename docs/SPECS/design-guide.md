# LaunchPad design guide: research findings and the rules that follow

Date: 2026-09-01
Companion to: `launchpad-expansion-research-2026-09-01.md`
Scope: what users say they love and hate about competing new-tab products, what makes personal dashboards engaging without being judgemental, and a guide that governs both the existing surfaces (Dashboard, Insights, Tasks, pill, gate, settings) and everything on the expansion list. The Home grid keeps its Google-default bookmark layout; that is the product's handshake and it is not touched.

---

## 1. What the research says

### 1.1 What people love and hate, from reviews

**Momentum (2M+ Chrome installs, 13K reviews).** Loved: one large centred clock, a single line of intention, a gorgeous daily photo, and nothing else competing. Reviewers call it "simple yet sophisticated" and "calm". Hated: clutter creeping back after updates ("I have to go uncheck a dozen options to get rid of the clutter"), promotional pop-ups that were on by default (a ten-year user's one-star review and a public apology from the company), and a delay before the address bar accepts typing on a new tab.

**Bonjourr (Chrome Favourite 2023).** Loved: "iOS-inspired", rounded frosted settings panels, mood-of-the-day photos, custom fonts, "smooth", "gives a gorgeous look". The word that recurs is *calm*. Its design rule is one opinionated column you leave alone after setup.

**Infinity New Tab (300K, 24K reviews).** Loved: changing shortcut icons ("I've been looking for an extension that lets me change icon images for SO LONG"), the flat icon set, the wallpaper library. Hated: "widgets covering the whole screen, too visually cluttered", everything on by default so new users "spend twenty minutes turning widgets off and still find the page busy".

**Speed Dial 2.** Loved: keyboard reach (Tab, arrows, "/" to search), the classic dial grid. Hated: a redesigned folder dropdown that "needs precise aiming and two clicks" where the old one was "big buttons, one click", thumbnails that vanish, and basics moved behind Pro. A changelog line worth noting: "Improved dark theme (no white flashing when opening new tab)". First-paint flash is a real complaint in this category.

**Tabisto.** Its theme model is four knobs: wallpaper, accent colour, blur, density. Its pitch against Infinity: "starts quiet".

**Start Page HQ.** Widgets "turn to frosted glass over the background so the page stays readable in dark and light themes". Glass over wallpaper is now the category default, which means the differentiator is execution, not the material.

**Rize (the time-tracker LaunchPad Pro competes with).** "Clean design" is the second most-praised attribute after passive tracking. The criticism: "want fuller summary views" and "more granular categorisation". Users want the summary to say more, not the chart to show more.

### 1.2 Dashboard UX evidence

- Every 2026 dashboard guide converges on the same three rules: **size is hierarchy** (Stripe shows four KPI cards above the fold and nothing else competes), **progressive disclosure** (surface the one number that answers "am I okay", then let people drill), and **colour means status, never decoration** (red means broken, not "look here"). LaunchPad already holds "one honest number per claim" as doctrine; the layout has not caught up with it.
- Fintech dashboards (Mercury, Ramp) earn trust by leading with one number. That is exactly the Dashboard's job: focused today.
- Linear is the reference for density without clutter: 36px rows, keyboard-first, almost no chrome. That is the Tasks tab's job.
- Dashboards fail when treated as "data murals" rather than cockpits; every element has to earn its pixels by helping someone decide or act.

### 1.3 Rings, streaks and the guilt problem

- Apple's Activity rings work on the Gestalt principle of closure: an unfinished circle asks to be closed. The ring is the most successful personal-metric UI ever shipped, and it is a shape, not a score.
- Smashing Magazine's 2026 streak-design piece and the Macworld expert panel both land on the same caveat: daily streaks become guilt engines; **weekly consistency is "more realistic and less guilt-inducing"**. LaunchPad's doctrine (one-shot recognition, no persistent nagging, no score) is already on the right side of this; the guide makes the ring a target the user set and the streak a quiet number, never a red warning.

### 1.4 Glass, validated and warned

- Apple's Liquid Glass (WWDC 2025, shipping across iOS 26 and macOS Tahoe) made translucent layered surfaces the platform default. LaunchPad's three frost tiers were the right bet.
- The same sources record the failure mode: beta users reported "menu legibility" issues and a "distracting glossy nature". Accessibility reviews put the number on it: text on translucent surfaces over photos routinely fails WCAG. The mitigations named are the ones LaunchPad already practises (neutral ink, text shadow over busy backgrounds, measured contrast). The guide keeps glass and adds a user-controllable dim.

### 1.5 What this means for LaunchPad in one paragraph

The category rewards calm, punishes clutter, and has standardised on glass over wallpaper. The differentiator is therefore not a new material but discipline: one hero per surface, size as hierarchy, one accent, quiet secondary ink, motion only in answer to an action, and a first paint with no flash. The Home grid already has this discipline because it inherits Google's. The Dashboard and Insights boards were built card by card and read as a grid of equal tiles, which is why they feel empty and underwhelming at the same time: nothing is large enough to be the point.

---

## 2. Design principles (the six rules every surface follows)

1. **One hero per surface.** Each tab, card and panel has exactly one thing that is unmistakably the largest. Dashboard: focused today. Insights: deep-work-per-day bars. Tasks: the active task row. Pill: the running number. Gate: the blocked host. If two things compete for hero, one of them moves down a tier.
2. **Size is hierarchy; colour is state.** Importance is carried by type size and weight and by how much space a module gets. Colour is reserved for meaning: blue accent for the interactive and the live, amber for paused, gold for earned, green for the gate, red for urgent and errors. Never a colour "to make it pop".
3. **Glass is the material; ink is measured.** Every surface uses the three frost tiers by variable. Every text node on glass is measured on the four reachable frames (dark solid, dark photo, bright photo, light solid) per BUGS.md Section O, and a user-facing wallpaper dim exists so the user can win the fight on their own photo.
4. **Quiet by default.** Nothing decorative is on by default. New modules ship off or collapsed unless they are the hero. A user who installs LaunchPad and never opens Settings should see a calm page. (Infinity's most-repeated complaint is the inverse.)
5. **Motion answers an action.** Motion shows what changed: a completion settles, a card expands, a workspace fades across. No ambient animation, no hover lifts on every card, no page-load cascade. One orchestrated moment per surface at most (the badge splash and the completion dwell are the two that exist and both are correct). `prefers-reduced-motion` is honoured everywhere.
6. **Copy is part of the layout.** Sentence case, plain verbs, consequence-labelled actions ("End focus session", not "Stop"), and a boundary that names itself at the point of confusion (BUGS D16). No exclamation marks, no mantras, no "you've got this".

---

## 3. Tokens

These extend what `newtab.css :root` already defines. Nothing below replaces an existing token; the existing frost tiers, the `--fs-8` to `--fs-15` ramp, `--sat-accent` and the gold rule stay exactly as shipped.

### 3.1 Surfaces (unchanged, restated so CC never reaches for literals)

| Tier | Use | Background | Blur |
|---|---|---|---|
| Card | panels, sections, cards, submenus | `var(--pro-frost-card-bg)` | `var(--pro-frost-card-blur)` |
| Floater | modals, popovers, dropdowns | `var(--pro-frost-floater-bg)` | `var(--pro-frost-floater-blur)` |
| Menu | context menus, pickers | `var(--pro-frost-menu-bg)` | `var(--pro-frost-menu-blur)` |

Light-wallpaper variants override Card and Floater under `html.has-bg.bg-light` (two-class form, per O1). Menus stay dark on light wallpapers.

**New: a wallpaper dim.** `--wall-dim` (0 to 0.6, default 0) applied as a single full-page overlay beneath all panels and above the wallpaper. Exposed in Settings as "Dim wallpaper" beside the wallpaper picker. This is the cheapest fix for the "text over my photo is hard to read" class of complaint and it is the one knob Tabisto, Bonjourr and Start Page HQ all expose in some form.

### 3.2 Ink (per surface family, never cross-borrowed)

On glass (the card's white-alpha ramp):

| Role | Value | Use |
|---|---|---|
| Primary | `rgba(255,255,255,0.92)` | headlines, hero numerals, task names |
| Secondary | `rgba(255,255,255,0.68)` | labels, captions, secondary rows |
| Tertiary | `rgba(255,255,255,0.46)` | timestamps, zero states, disabled |
| Hairline | `rgba(255,255,255,0.10)` | dividers, card edges |

On light solid wallpaper, the same four roles re-based on a dark ramp (`rgba(32,33,36,…)` at 0.92 / 0.68 / 0.50 / 0.10). O3 is the rule: never use a light-theme token on a dark-default surface or vice versa; re-base on the surface's own family.

Dimming is done by choosing a lower ink role on the **text node**, never by `opacity` on a container holding a control (O2).

### 3.3 Accent and state colours (one accent, four states, that is all)

| Name | Dark frames | Light solid | Meaning |
|---|---|---|---|
| Accent | `#8ab4f8` | `#1a73e8` | interactive, live, active row, focus ring |
| Paused | amber (the shipped `.paused` tint) | same | global pause, and only that |
| Earned | `#ffd66e` | same | achievements and `.pro-celebrate` only; gold is earned, never decorative |
| Gate | soft green (the shipped gate colour) | same | the blocking page and its return state |
| Urgent | red (shipped priority border) | same | urgent priority, destructive confirms, errors |

Rule: the accent is the **only** colour used to mean "this is live or clickable". Tag pills keep their palette because they are identifiers, not states; they are the one sanctioned exception and they are never used to encode anything else.

No gradient washes on cards or backgrounds. The single existing gradient (the CTA fill on the tab bar) stays; nothing new adopts it.

### 3.4 Typography

- **Family:** the system UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). No webfont: the CSP forbids external fonts, bundling one grows the 609 KiB zip for no gain, and the system face is what Google's own new tab uses, which is the handshake Home is keeping. Bonjourr's "custom fonts" praise is real, but it is a B7 option for the user, not a default.
- **Weights:** 400, 500, 600. Nothing bolder. Hero numerals at 500, not 700; large type reads heavy on its own.
- **Numerals:** `font-variant-numeric: tabular-nums` on **every** ticking or comparable number (the pill, the stopwatch, the stat strip, chart axes, the export table). A proportional numeral that jitters as it ticks is the single most common tell of an unpolished timer.
- **Scale:** the shipped ramp `--fs-8` to `--fs-15` governs everything at or below 15px. Above it, three display sizes and no others:
  - `--fs-display-1`: 56px, weight 500, letter-spacing -0.02em. Dashboard hero, Insights period total.
  - `--fs-display-2`: 36px, weight 500. The shipped recap numerals, secondary stats.
  - `--fs-display-3`: 24px, weight 500. Card titles that carry a number (goal progress, streak).
- **Labels:** sentence case, secondary ink, `--fs-11` or `--fs-12`. The shipped all-caps eyebrows ("ACTIVE", "FOCUSED TODAY") are a candidate for this change; see Section 7. Never add a label above content that the content already explains.
- **Line length:** under 80 characters for any prose (recap copy, gate copy, empty states).
- **Text shadow** stays on anything that sits directly on wallpaper (Home grid names, greeting, search). It is removed on anything inside a frost surface, where the surface does the work.

### 3.5 Shape, depth, spacing

- **Radius scale, three values only:** 8px (tiles, buttons, inputs, chips), 14px (cards and panels), 999px (pills and rings). Same-radius-on-everything is the SaaS-card tell; the three-step scale is how hierarchy shows in silhouette.
- **Elevation:** Card tier has no shadow (the blur and the hairline edge are its depth). Floater tier carries one shadow token, `0 12px 32px rgba(0,0,0,0.35)`. Menus carry the same. No other shadows anywhere, and no hover shadow lift.
- **Spacing:** an 8px base, with 4 / 8 / 12 / 16 / 24 / 32 / 48 as the only steps. Card padding 20px. Gap between cards 16px. Section gap 32px.
- **Grid:** Dashboard and Insights adopt the Tasks tab's content width (wide) and a 12-column grid with 16px gutters. Below 900px the same stacking breakpoint Notes already uses.

### 3.6 Motion

- Durations: 150ms (state), 240ms (open/close), 400ms (settle). Easing: `cubic-bezier(0.2, 0, 0, 1)` for entrances, `cubic-bezier(0.4, 0, 1, 1)` for exits.
- Allowed: the completion dwell and settle (shipped), the badge splash (shipped), workspace cross-fade (150/150, shipped), the ring filling once on load to its value (a single 400ms sweep, once per open, never looping), expand and collapse of a card or goal.
- Not allowed: hover translate or scale on cards, pulsing on anything except the shipped CTA and the shipped paused glyph, staggered entrance cascades, skeleton shimmer (data is local; render it).
- `prefers-reduced-motion`: every allowed motion has a static fallback, as the splash and goal sweep already do.

---

## 4. Layouts

Home keeps the Google-default bookmark layout, the centred logo, the search bar, the tab bar under the logo, the sidebar and the top-right pill. Not redesigned here beyond the token and ink rules.

### 4.1 Dashboard (today)

Doctrine: the Dashboard answers "what about today". Its hero is focused today. Its second job is "what do I pick up". Everything else is context.

```
+------------------------------------------------------------------+
|  [ring] 2h 14m           Pick up                Streak  12 days   |
|  focused today           Ship the launch          This week 9h 40m|
|  of 4h target            announcement                             |
|  3 tasks done            [Resume]  [Switch]                       |
|  16 blocked                                                       |
+----------------------------------+-------------------------------+
|  Today                           |  Goals                        |
|  [ ] Draft pricing page   !high  |  Ship 2.1.0        7 of 9  ## |
|  [ ] Reply to Nadia              |  Grow to 1k        2 of 5  #  |
|  [ ] Weekly review  (recurring)  |  Learn TS          0 of 4     |
|  Today's three: pick up to 3  +  |                               |
+----------------------------------+-------------------------------+
```

- **Hero band (span 12).** Left third: the ring (F5) around the `--fs-display-1` focused-today numeral, with the target and the two small counts (tasks done, blocked) beneath in secondary ink. The ring's stroke is the accent; its track is the hairline. When no target is set, the ring is absent and the numeral stands alone at the same size. Middle third: the pick-up card, the one place on the Dashboard with an outlined primary button (the shipped outline rule). Right third: streak and "this week so far", `--fs-display-3`, secondary labels. Nothing in the hero band pulses.
- **Row two.** Today (span 7): the due-today list and G9 today's three, 36px rows, checkbox left, priority as the shipped left border, quiet options pill on hover. Goals (span 5): each goal one row, name, fraction, and a thin progress bar in the accent; a 5-of-5 goal shows in full per the 2026-08-11 rule.
- **Evening state** swaps the hero band for the recap: same band, same sizes, the numeral becomes the day's total and the pick-up card becomes "Work's done" or the open list, per the existing invariant.
- **Empty states** are invitations in the interface's voice: "Nothing due today. Add one from Tasks or pick three above." Never a sad illustration, never a grey box.

### 4.2 Insights (the past)

Doctrine: Insights answers "what has happened". Its hero is the deep-work-per-day chart.

```
+------------------------------------------------------------------+
| Today | 7 days | 30 days | Custom            History starts 31 Jul |
+------------------------------------------------------------------+
|  12h 1m over 7 days                              longest 1h 52m  |
|  ##  ###  #  ####  ##  ###  ####    (deep work per day, bars)     |
+----------------------+----------------------+--------------------+
|  By tag   (donut)    |  By site  (6 rows)   |  Top tasks (6 rows)|
+----------------------+----------------------+--------------------+
|  Best focus hours (heatmap, F3)             |  This week vs last |
|                                             |  (F2)              |
+---------------------------------------------+--------------------+
|  Achievements  (3 x 2)                                            |
+------------------------------------------------------------------+
```

- The range selector is the first row and the only control on the board; its horizon caption derives from the retention constant (D16).
- **Hero (span 12).** Period total at `--fs-display-1`, longest stretch beside it at `--fs-display-3`, the bar chart beneath at full width. Bars are the accent at 0.85 alpha, today's bar at full; axis captions in secondary ink and tabular numerals; no gridlines, one baseline hairline.
- **Row two, three equal cards** for tag, site and task. Equal because they are peers; this is the one row where equal tiles are correct. Site rows carry no favicons, ever.
- **Row three:** the heatmap (span 8) uses the accent at five alpha steps; the weekly review card (span 4) is the only place on Insights with a comparison arrow, and the arrow is neutral ink, not green or red (a week with less focused time is information, not a fault).
- **Achievements** at the bottom in the shipped 3 x 2, gold only on earned tiles, unearned tiles in tertiary ink with no lock icon.
- The board scrolls inside its panel (R1); nothing is clipped.

### 4.3 Tasks and Notes

Already the strongest surface. Rules that hold it there: 36px rows, one hero row (the active task, accent ink on its live figure only), priority carried by the left border and nothing else, the options pill at rest opacity 0 and revealed on hover or `:focus-within`, tag pills as identifiers. The Notes panel keeps its paper material (texture, rotation, curl, shadow); paper is confined to notes and never used elsewhere, so it stays a signature rather than a theme.

### 4.4 The pill (active task surface)

The one element present on every tab. Card tier, one running numeral in `--fs-display-2` with tabular numerals, label beneath in secondary ink, consequence-labelled actions. Paused is the only state that changes its colour (amber). The A2 toolbar badge mirrors it: minutes remaining, or the amber mark, or nothing.

### 4.5 The gate

Already correct: a mostly empty dark page, the blocked host in soft green, one line of honest context, two exits. E1 and E2 add a reason line in the same position ("30 minutes on youtube.com today" or "Blocked until 17:00"). E3 friction reuses the same page with a ten-second ring (the same ring component as the Dashboard, in the gate's green) counting down before the button enables.

### 4.6 Settings (free and Pro)

The known limitation (dark glass on light backgrounds) is closed by the token rules: settings panels use the Floater tier and pick up the light override like every other floater. Rows are 44px, label left, control right, a one-line secondary description beneath any row whose consequence is not obvious (the tracking dependency for E1 lives here). Sections separated by a hairline and 24px, no section headers in caps.

### 4.7 New surfaces from the expansion list

- **Toolbar popup (A1):** 360px wide, Floater tier, three stacked modules: the pill's content, quick-add, and the last three named sessions. No tab bar, no scrolling beyond three modules.
- **Side panel (A5):** the same companion module at the panel's native width, with the Tasks list replacing the three-session strip.
- **Command palette (A7), if built:** Floater tier, one input, results in 36px rows, no icons other than the type glyph, accent on the selected row.
- **Custom icons (B4):** letter tiles use the accent on Card-tier background at 8px radius, the letter at 500 weight; emoji tiles sit on the same background so the grid stays a grid.
- **Habit grid (G7):** a 7-column month grid of 12px squares, accent at four alpha steps, empty days in hairline ink, no red, no "missed" label.

---

## 5. Components (the shared vocabulary)

| Component | Rule |
|---|---|
| Stat | numeral first, label beneath, tabular numerals, no icon |
| Ring | accent stroke, hairline track, 6px stroke at display-1, 3px at display-3, fills once on load |
| Bar chart | accent bars, one baseline, no gridlines, axis in secondary ink |
| Donut | accent plus tag colours only, total in the centre, legend as a list not a key |
| List row | 36px, name in primary ink, one secondary value right-aligned, hover reveals controls |
| Card | Card tier, 14px radius, 20px padding, title in `--fs-13` at 500 weight, never all caps |
| Button primary | outlined, accent border, per the measured outline rule; solid only on the hosted checkout path |
| Button quiet | text in secondary ink, no border, hover to primary ink |
| Chip and pill | 999px radius, 8px horizontal padding |
| Toast | Menu tier, bottom centre, one line, one action, 5s |
| Empty state | one sentence, one action, no illustration |
| Confirm | Floater tier, consequence in the title, Cancel keeps its place per the footer convention |

---

## 6. Copy voice (restated as design rules)

- Sentence case everywhere, including buttons and section titles.
- Verbs on actions; the action keeps its name through the flow ("Save session" produces "Session saved").
- The number and its unit stay together and are never split by a line break.
- Empty and error states say what happened and what to do next, in the interface's voice, never apologising.
- No mantras, quotes, greetings by name, or motivational lines; the product shows, it does not exhort. (Momentum's mantras are its brand; they would be a costume on this one.)
- The em dash ban applies to every visible string.

---

## 7. What to update on the shipped product

Ordered by visible impact per unit of work. Each is its own Asana task; the first four are a visual arc with a checkpoint sweep.

1. **Dashboard widen and hero band.** Adopt the Tasks content width and the Section 4.1 layout. The focused-today numeral becomes `--fs-display-1`; the stat strip collapses into the hero band; the ring lands with F5. This is the single change that turns "empty" into "cockpit".
2. **Insights widen and re-tier.** Adopt Section 4.2. Deep-work bars become the hero at full width; the three peer cards become one row; achievements move to the bottom.
3. **Label case pass.** All-caps eyebrows and labels ("ACTIVE", "FOCUSED TODAY", "Active task" eyebrows, any caps section headers) become sentence case in secondary ink at `--fs-11` or `--fs-12`, with hierarchy carried by the numeral's size instead. One CSS pass, one gate update (`pill-clarity` and `today-cockpit` assert visible text).
4. **Tabular numerals** on every ticking or comparable number. One declaration on the shared numeral classes, measured for layout shift before and after.
5. **Wallpaper dim slider** in Settings, with `--wall-dim` as the single token. Free.
6. **Settings panel light-theme fix** via the Floater tier, closing the 2026-04-24 known limitation.
7. **Radius and shadow normalisation** to the three-value scale and the one floater shadow. Mostly deletions.
8. **Hover-motion audit.** Remove any transform or shadow change on hover that is not revealing a control. Keep the sticky-note lift, which is the paper's own affordance.
9. **First-paint check.** Body background colour is set in static CSS before any script runs, so a dark-theme user never sees a white frame (the Speed Dial 2 complaint). Verify in the scratch profile with a paint timeline, not by eye.
10. **Empty-state copy sweep** across Dashboard, Insights, Tasks, Sessions and Trash, to the Section 6 voice.

Not touched: the Home grid, the tab bar, the sidebar, the sticky-note material, the gate page's structure, the achievements set.

---

## 8. What to apply on everything new (the CC prompt checklist)

Paste into the PLAN of any task that touches UI:

- Surfaces use the three frost tiers by variable; no literal `rgba(30,30,30,…)`, no literal `blur()`.
- Ink comes from the surface's own family (Section 3.2); no cross-theme tokens; `html.has-bg.bg-light` two-class overrides; dim text nodes, never containers with controls.
- Every JS-rendered text node is measured on the four reachable frames before the round closes (BUGS O1).
- One hero per surface; state which element it is in the PLAN.
- Colour carries state only (accent, paused, earned, gate, urgent). Gold appears only on earned moments.
- Type: system stack, weights 400/500/600, ramp tokens at or below 15px, the three display tokens above, tabular numerals on any number that ticks or is compared, sentence-case labels.
- Radius 8 / 14 / 999. Shadow only on Floater and Menu tiers. Spacing on the 8px scale.
- Motion only in answer to an action, from the allowed list, with a reduced-motion fallback.
- Copy per Section 6; consequence-labelled actions; boundaries name themselves.
- New modules ship off or collapsed unless they are the surface's hero.
- Preview surfaces render no create affordances (unchanged rule).
- The visual sweep happens at the arc checkpoint; a visually load-bearing change is flagged for Samson's eyes before close.

---

## 9. Three directions considered, and the one this guide takes

- **Editorial calm (Momentum's shape):** one giant number centred, everything else hidden. Rejected for the Dashboard because it cannot hold the pick-up card, the list and the goals without hiding them, and the whole point of the cockpit is that those are visible.
- **Paper everywhere (extend the sticky-note material):** rejected. Paper is a signature because it is confined to Notes; spread across the Dashboard it becomes a theme and loses the "these are sticky notes in two seconds" recognition the Notes spec was built for.
- **Instrument panel (this guide):** glass stays the material, size becomes the hierarchy, one hero per surface, one accent, a ring where a target exists. It is the direction the product's own doctrine already points at ("one honest number per claim", "Dashboard is today"); the boards just never got the layout to match. Boldness is spent in exactly one place: the display-1 numeral with the ring. Everything around it is quiet.

---

## 10. Sources

- Chrome Web Store and Firefox Add-ons reviews for Momentum, Bonjourr, Infinity New Tab and Speed Dial 2 (2024 to 2026), plus Extpose and chrome-stats review digests.
- Tabisto and Start Page HQ product pages and comparison posts (2026).
- Rize product pages and Product Hunt reviews (2026).
- UXPin "Dashboard Design Principles" (June 2026); Aufait UX dashboard guides (July 2026); 925 Studios "35 SaaS Dashboard Design Examples" (July 2026); Art of Styleframe "Dashboard Design Patterns 2026".
- Smashing Magazine, "Designing a Streak System: The UX and Psychology of Streaks" (Feb 2026); Trophy, "The Psychology of Close Your Rings" (Feb 2026); Macworld expert panel on Activity rings (July 2026).
- Dev.to and Everyday UX on Apple Liquid Glass (2025 to 2026); Axess Lab, "Glassmorphism Meets Accessibility" (June 2026).
- LaunchPad's own DECISIONS.md (frost tiers, text-size ramp, outline affordance, gold is earned, website brand pass) and BUGS.md Section O (ink doctrine).
