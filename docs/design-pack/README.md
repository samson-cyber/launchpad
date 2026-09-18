# The design pack — Settings / Dashboard redesign (SR.2)

Everything the canvas round needs about the product as it is today, so that SR.2 can spend its time on grouping and layout instead of on archaeology.

**The one rule for reading this pack:**

> **Every frame exists on three grounds because the product cannot classify a photograph, and a layout that works on one ground has not been tested.**

`applyBackground` derives a luminance class for **colour** wallpapers only — `bg-light` or `bg-dark`. A photograph gets `bg-image` and **neither**, so not one of the 705 `html.bg-light` rules reaches it. That is why a photograph is a third ground rather than a variation of the other two, and why "it looks fine on dark" is not a result.

---

## What is here

| File | What it is |
| --- | --- |
| `dashboard-{dark,photo,light}.png` | The Dashboard tab, 1440×900. |
| `settings-{dark,photo,light}.png` | The Settings panel, full height. |
| `prosettings-{dark,photo,light}.png` | Pro Settings, full height. |
| `pill-states.png` | The active-task pill in all six states it has. |
| `controls/*.md` + `controls/*-sheet.png` | One file per control family: the live markup, every CSS rule that styles it, and a frame of it on all three grounds. |
| `tokens.css` | Verbatim from the commit. |
| `tokens-annotated.md` | Every token, its value on each ground, and what it is for. **Read its first section before naming a token.** |
| `busy-fixture.md` | The content the canvas should use. Real names. |
| `settings-inventory.md` | SR.1's count, travelling with the frames. |

---

## The three grounds

| Key | `html` class | What it is |
| --- | --- | --- |
| `dark` | `has-bg bg-dark` | `#2a2a2a`, the shipped default. A fresh install is on this. |
| `photo` | `has-bg bg-image` | The gallery's *Tropical beach*, a real photograph from the product's own list. **No luminance class.** |
| `light` | `has-bg bg-light` | `#f5f5f5`, a light colour preset. |

There is no fourth "no wallpaper" ground. `loadBackground` self-heals a missing record to the default **and persists it**, so no shipped state lacks `has-bg`.

---

## Every frame, in one line

**Dashboard** — captured at 1440×900, the frame a user actually occupies.

- `dashboard-dark.png` — The full board on the default ground: hero `4h6m`, Suggested next, streak/week/blocking column, then Due today (9 rows, 4 overdue) beside Goals and Focused-today-by-site. Note the **void below the Goals card** — that is the room the ruling proposes to use.
- `dashboard-photo.png` — The same board over the beach photograph. Every card is dark frost regardless of how bright the photo is, and the gap between the two right-hand cards is where the photo shows through.
- `dashboard-light.png` — The same board on `#f5f5f5`. Cards go white-tinted; the ink inside them flips to black because those cards restate the ink ramp.

**Settings** — 320px wide, 1101px of content. Captured on a viewport sized to the content so the whole panel is in one image; at 1440×900 it overflows.

- `settings-dark.png` — Appearance / Privacy / Data / Backup / About. **No `Remove` button beside `Change`**, because `#2a2a2a` *is* the default wallpaper and there is nothing to remove. The frames differ in control count, not only in colour.
- `settings-photo.png` — Same panel, with the beach thumbnail in the wallpaper slot and `Remove` present.
- `settings-light.png` — Same panel, white-tinted. The clearest view of the **zero-gap seam**: "Just for this workspace" abuts "Dim wallpaper" with no separation at all, which is the mechanism behind "jumbled".

**Pro Settings** — 360px wide, **2852px** of content. Ten sections.

- `prosettings-dark.png` — The whole panel in one image: Subscription, Licence key, Tags (12 rows), Workspaces (3 + create form), Analytics, Notes, Focus sessions, Reminders, Focus blocking (8 sites), About.
- `prosettings-photo.png` — The same, over the photograph.
- `prosettings-light.png` — The same, white-tinted. One live-state difference from its siblings: the cycle-reset row reads "Reset cycle count · No active task" here because the frames are captured in sequence and the pill's state moved between them. Nothing in the layout changed.

**The pill**

- `pill-states.png` — Six states stacked, top to bottom: **1** no active task · **2** a task, card mode · **3** the same task, slim · **4** a running session (ring + countdown, `Stop`, focus blocking auto-on) · **5** paused (amber, `Resume`, blocking released) · **6** the `WORK` mode chip on the card head. Every state is driven through the product's own controls or its own writers.

**Controls** — each sheet is dark | photograph | light, left to right, on a mid grey that flatters neither end of the ramp.

- `controls/segmented-sheet.png` — Icon size. The track and the active segment on all three grounds.
- `controls/checkbox-sheet.png` — Focus view. A label above a checkbox whose own label is a full sentence.
- `controls/slider-sheet.png` — Dim wallpaper. The row above it is cut into the frame **because the two rows abut** — that is the panel, not the crop.
- `controls/buttonrow-sheet.png` — Export backup, full-width.
- `controls/textinput-sheet.png` — Licence key with its `Apply` button.
- `controls/numberinput-sheet.png` — A Focus-session length: a number field with a unit beside it.
- `controls/radio-sheet.png` — Sound at each phase boundary, the product's only radio group.
- `controls/section-sheet.png` — The entire Appearance section on all three grounds. **The most useful single image in the pack**: five control families stacked, with the spacing rhythm — and the lack of one — visible end to end.

---

## What the pack does NOT decide

Taken straight from SR.1's answer, because it is the line the whole arc rests on: **the canvas decides layout and grouping; the code decides everything measurable.**

A canvas cannot tell you a token reads 2.53:1 through a `backdrop-filter` over a photograph. Two rounds in September found exactly that in shipped chrome and neither would have been visible in a mock. So:

- **Name tokens, never hex.** A hex in a handoff becomes a hex in the stylesheet and the per-ground pair is silently lost.
- **Name the surface with the token.** `--ink-secondary` means "secondary text" only inside a card that restates the ramp — see the first section of `tokens-annotated.md`, which is the pack's most important page.
- Contrast, the census gate, the 26 build gates and the non-resting states are all settled in code afterwards.

---

## How these were produced

Busy fixture (`tools/seed-fixture.mjs --profile busy-messy`), Pro enabled, real Edge via `tools/browser-launch.mjs` on an isolated scratch profile, `deviceScaleFactor: 2`.

Two things were fixed after looking at the first captures, and both are worth knowing because they are the kind of thing that makes a reference frame quietly wrong:

1. **A tip toast sat across the Time-by-site card in three frames.** `#rc-tip` fires on the second page open and was not in the hide list. It is now silenced through the product's own `rightClickTipShown` flag rather than by hiding the node, so it cannot return on the next reload — and the harness now enumerates every floating element still painted over the clip and names it, instead of relying on a list of selectors somebody remembered to write.
2. **The Focus-blocking section was being framed empty.** The fixture seeds no blocked sites; the eight are seeded through `Storage.addBlockedDomain` and the count is asserted before any frame is captured.
