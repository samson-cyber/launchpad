# The design pack, part 2 — every surface but Home and the sidebar

Part 1 covered the Dashboard, Settings, Pro Settings and the pill. This part covers everything else, so the whole product can be audited visually against the design research in one pass.

**Home and the sidebar panels are excluded deliberately** — Samson is keeping their layout and behaviour, so they are locked and out of scope.

**The same one rule as part 1:**

> **Every frame exists on three grounds because the product cannot classify a photograph, and a layout that works on one ground has not been tested.**

`applyBackground` derives a luminance class for **colour** wallpapers only. A photograph gets `bg-image` and **neither** `bg-light` nor `bg-dark`, so not one of the 705 `html.bg-light` rules reaches it. This part measured what that costs: **13 text nodes on the Tasks tab fall under the floor over a photograph and none of them fails on the dark default.**

The three grounds are `dark` (`#2a2a2a`, the shipped default), `photo` (the gallery's *Tropical beach*, a real photograph from the product's own list) and `light` (`#f5f5f5`).

---

## Every frame, in one line

Every frame below was viewed before it was listed, and every floating element still painted over a clip was enumerated and named first — part 1 shipped three frames with a tip toast across them before that check existed.

### Tasks — `tasks-{dark,photo,light}.png`
1328×2757, sized to the content rather than clipped at 900.
- **`tasks-dark.png`** — the full board on the default ground: six goals at six completion states including the 76-character one, 21 open tasks, the Standalone group, Recurring with four templates and the habit grid filled, Completed (18) and Deleted (3), and the Notes column with its notebook chip strip.
- **`tasks-photo.png`** — the same board over the beach. Every card is dark frost; the notes keep their paper colours, which is the one part of the product that does not follow the ground.
- **`tasks-light.png`** — the same board white-tinted. The multi-tag `+2` chips and the priority spines are the loudest things on the surface here.

### Insights — `insights-{dark,photo,light}.png`
1328×1756, full height.
- **`insights-dark.png`** — range selector, 64h7m hero, hours/day chart, time by tag with the donut, time by site, top tasks, the best-focus-hours heatmap, this-week-vs-last, achievements, Export CSV.
- **`insights-photo.png`** — the same over the photograph.
- **`insights-light.png`** — the same white-tinted. One node under floor on this ground, none on the other two.

### The gate — `gate-{session,schedule,inert}.png`
**One ground, three states, all three now present.** `gate.css` has no `has-bg` model (WM.2 measured four identical readings), so the axis that moves is state, not ground. *(The schedule frame was missing from this pack's first version and is described under the correction below.)*
- **`gate-session.png`** — "youtube.com is blocked", reason *"Blocked during your focus session: less than a minute focused on Wireframe the shortened flow"*, controls **5 more minutes / End focus session**, footnote *"Blocking youtube.com and its subdomains."* Reached by navigating a real tab to a real blocked domain and letting the worker's intercept redirect it.
- **`gate-inert.png`** — "This site is not blocked", *"Focus blocking is not on right now."*, a single **Go to LaunchPad**. This is `gate_reason_none`, and opening the page directly is one of its two documented routes.
- **`gate-schedule.png`** — "news.ycombinator.com is blocked", reason *"Blocked because news.ycombinator.com is on your schedule right now."*, and **one** control: **5 more minutes**. Reached the same way, by a real navigation the worker redirected, **with no session running at all**. The footnote reads *"Blocking news.ycombinator.com and its subdomains."*
  - **It correctly does NOT offer "End focus session"** — there is no session to end. Two further buttons exist in the DOM (`#gate-friction-cancel` "Never mind", `#gate-friction-go`) and both measure 0x0 and are unpainted: they are WM.4 friction controls, and friction is not engaged here. A `textContent` scrape of `.gate-actions button` reports three; only one is on screen. **The painted set is the one this line describes.**

### The popup — `popup-states.png`
360px, one ground (Chrome paints it over browser chrome, never over the wallpaper). Five states stacked top to bottom:
1. **no task** — "No active task" and Open LaunchPad, 94px tall.
2. **task active** — ▶ ACTIVE TASK, the task and its goal, `0:07 ACTIVE` beside `0:00 FOCUSED TODAY`, Pause / Open LaunchPad.
3. **session running** — the WORK chip, `24:54 REMAINING`.
4. **paused** — the chip and ring go amber, Pause becomes **Resume**.
5. **the WORK mode chip** — *identical to 3.* The chip is not a separate state in the popup; it rides the session render. Recorded rather than presented as a fifth thing.

### The side panel — `sidepanel.png`
One ground, 420px sample of a width Chrome and the user own. The module, then **DUE NOW (2)** with two rows — and roughly two thirds of the panel is void below it.

### Modals and confirms — `modals/`
Five families, each on all three grounds, on the Floater tier over the Tasks tab so the surface behind them is real. Each family also has a `-sheet.png` showing dark | photo | light side by side on a mid grey.
- **`task-context-menu-*`** — Make active / Edit / Priority / Duplicate / Move to another goal / Attach resources / Mark complete / **Delete** in red. The light-ground menu is white, not white-tinted frost.
- **`attach-resources-*`** — the picker, 460×551, with named sessions and groups and one item marked *"attached, click to remove"*.
- **`confirm-delete-workspace-*`** — *"Delete workspace "Studio"? This cannot be undone."* **The brief asked whether `aeaf99d`'s light-ground danger red holds: it does.** On light the button is a pale red fill with a red label and reads unmistakably as destructive.
- **`confirm-recurring-complete-*`** — the second confirm, reached from the bell: *"Weekly review repeats. Completing it closes today's instance; the next one arrives on its schedule. To set it aside for today instead, snooze it."*
- **`blocking-rules-*`** — the rules editor with a schedule window set: a `select` ("On a schedule"), seven day checkboxes, and two native time inputs at 12:00 PM–4:00 PM. **This is where the product's eighth control family lives** — the `select` SR.1 said had "moved, not been replaced".

### The free preview — `preview-{tasks,dashboard,insights}.png`
Photo ground only, `LP.devPro(false)`. **These are the frames the research's live-above-demo flag is about, and they are worse than the flag suggests.**
- **`preview-dashboard.png`** — the user's REAL "Focused today, by site" card, then the divider banner, then a DEMO board reading *"2h18m Focused today · 4 Tasks completed · 12 Distractions blocked · 6 Day streak"*. **Two "Focused today" figures on one screen, one true and one invented**, and the demo's goals ("Learn TypeScript") are not the user's.
- **`preview-tasks.png`** — a demo task board with a fake running timer (*"active · 00:23:15"*) beside a **demo** notes column. The banner sits above both, so nothing separates the demo board from the demo column — or from the real Home surface the user just came from. **CORRECTED 2026-09-18.** This line read "**beside the user's real notes**". It is not: `renderTasksPreview` calls `notesPreviewPanelHtml`, which renders `NOTES_DEMO`, and the live column (`notesPanelHtml`) is emitted only by `renderTasksTab` on the Pro branch. Driven on a free profile with a distinctive real note seeded, on master and after, the real note appears in neither preview. **The frame is genuinely unreadable, and that is the finding worth keeping**: `tools/fixture-profiles.js` seeds the busy fixture's twelve real notes with the *same five opening strings* as `NOTES_DEMO` — "Call the studio back about the October shoot." is both `demo_note_studio` and `NOTES[0]` — so on this fixture a demo notes column and a real one cannot be told apart by eye. Every demo card now carries "Preview - example data", which is what makes the question answerable from the frame.
- **`preview-insights.png`** — a static demo, and the only preview that labels itself: **"Preview - example data"** sits in its range bar. The other two do not carry that label.

### The bell — `bell-open.png`
Photo ground. The tab bar at count 9, the list open over it with Overdue and Due today groups and **Snooze / Go to task / Complete** on every row. A third group exists in the list's own scroll below the visible fold.

---

## What is not here, and why

**~~A schedule-blocked gate.~~ CORRECTED 2026-09-18 — it is here now, and the original entry was wrong.** This section used to say a schedule "never blocks on its own", blame `focusBlockingActive` being false with no session, and hand the question to the audit. **That was a defect in this harness, not in the product**, and the correction is kept in place rather than quietly deleted because the shape recurs.

**What was actually wrong:** the harness seeded the schedule correctly and **never set the workspace to Work mode**. Every workspace defaults to Casual, and `blockingReasonActive` refuses the schedule reason on a Casual workspace *by ruling* — the 2026-09-01 decision that scheduled blocking follows the current workspace. So the navigation was let through, correctly, and the pack read a working feature as a broken one. The intercept has **no** session-only pre-gate: it calls `Storage.blockingMatchFor`, which evaluates all three reasons.

**The fix to the harness was one line** (`await Storage.saveAll(d)` after `setWorkspaceMode`, which is mutate-only — BUGS **I34**, the same trap this pack hit three times while seeding). With the workspace actually in Work mode the gate appears on the first navigation, with no session, which is `gate-schedule.png`.

**The lesson, and it is the one worth carrying:** *a fixture that cannot produce a state is not evidence the state is unreachable.* The pack asserted a product conclusion from a harness that never checked its own preconditions. The replacement harness asserts all five before it navigates — Pro level, workspace mode, the stored entry shape, the normalised window, and `blockingReasonFor` already answering `"schedule"` — and refuses to capture anything if one is false. Full account on Asana 1218615823718601.

**The friction countdown mid-ring and the typed-sentence state.** Not attempted. Both sit behind the commitment toggle plus a snooze, and the gate's own `render` refuses to repaint while friction is up.

**The task edit modal.** **There is no task edit modal.** `.tt-task-options` opens a context menu, and its Edit entry turns the row itself into an inline editor (`.tt-name-input`). The menu is framed instead. The inline editor is not framed because the quiet-pass that every frame runs — which blurs the focused element so no caret blinks in a reference — is the same action that closes the editor. The two requirements are in direct conflict; recorded rather than worked around.

**The notebook delete confirm.** The notebook chip does not answer a right-click the way the harness expected; the event reached the task context menu instead. One frame captured on one ground was discarded rather than shipped as three.

---

## What the pack does not decide

Unchanged from part 1, and it is the line the whole arc rests on: **the canvas decides layout and grouping; the code decides everything measurable.** Name tokens rather than hex, and name the surface with the token — `--ink-secondary` means "secondary text" only inside a card that restates the ramp. See `tokens-annotated.md`.

---

## How these were produced

Busy fixture (`tools/seed-fixture.mjs --profile busy-messy`), Pro enabled, real Edge via `tools/browser-launch.mjs` on an isolated scratch profile, `deviceScaleFactor: 2`.

**Four things the fixture does not seed, all added through the product's own writers and asserted before any frame was taken:** two notebooks and five notes assigned to them (without which the Notes chip strip is absent); the daily template flagged `isHabit` **with its `createdAt` back-dated 45 days** (without which every habit cell reads "before" and the grid draws one dot); eight blocked sites (without which Focus blocking frames empty); and multi-tagged tasks.

**The multi-tagging did not achieve what it was for, and that is recorded rather than hidden.** The brief expected the donut's overlap note to fire. It does not, because `byTag` is computed from the tags stored on each recorded *session*, so re-tagging a task afterwards does not retro-tag its history. The note needs sessions recorded while the task was multi-tagged; the Untagged slice is still drawn, which is correct.
