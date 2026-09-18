# Tokens, annotated

Every custom property the product declares, its value on each of the three grounds, and what it is for. Values are READ FROM THE CASCADE in a real browser on the busy fixture, not parsed out of the stylesheet.

`tokens.css` sits beside this file, verbatim from the commit.

---

## Read this first: only 7 of 88 tokens change with the ground, and the ink ramp is not one of them

This is the single most important fact for a handoff, and it is the opposite of what the names suggest.

These SEVEN resolve differently on `<html>` depending on the wallpaper:

| Token | dark | photograph | light |
| --- | --- | --- | --- |
| `--pro-frost-card-bg` | `rgba(30, 30, 30, 0.85)` | `rgba(30, 30, 30, 0.85)` | `rgba(255, 255, 255, 0.85)` |
| `--pro-frost-floater-bg` | `rgba(30, 30, 30, 0.92)` | `rgba(30, 30, 30, 0.92)` | `rgba(255, 255, 255, 0.92)` |
| `--sat-accent` | `#8ab4f8` | `#8ab4f8` | `#1a73e8` |
| `--sat-accent-ink` | `#8ab4f8` | `#8ab4f8` | `#15539b` |
| `--sat-amber` | `#f1c40f` | `#f1c40f` | `#8a6d09` |
| `--search-surface` | `rgba(255, 255, 255, 0.9)` | `rgba(255, 255, 255, 0.9)` | `#fff` |
| `--tt-play-outline` | `rgba(255, 255, 255, 0.92)` | `rgba(255, 255, 255, 0.92)` | `rgba(0, 0, 0, 0.78)` |

**The other 81 resolve identically on all three.** Including the whole `--ink-*` ramp, which is white-alpha at `:root` on every ground:

```
  --ink-primary   rgba(255,255,255,0.90)   on dark, on a photograph, AND on a light wallpaper
```
`--ink-*` is flipped to its black values **inside specific card subtrees**, never by `html.bg-light`. Measured on the light ground:

| Scope | --ink-primary | --ink-secondary | --ink-meta | --ink-chrome |
| --- | --- | --- | --- | --- |
| `:root` (html) | `rgba(255, 255, 255, 0.90)` | `rgba(255, 255, 255, 0.70)` | `rgba(255, 255, 255, 0.60)` | `rgba(255, 255, 255, 0.50)` |
| inside a Dashboard card | `rgba(0, 0, 0, 0.87)` | `rgba(0, 0, 0, 0.66)` | `rgba(0, 0, 0, 0.70)` | `rgba(0, 0, 0, 0.64)` |
| inside a Settings section | `rgba(255, 255, 255, 0.90)` | `rgba(255, 255, 255, 0.70)` | `rgba(255, 255, 255, 0.60)` | `rgba(255, 255, 255, 0.50)` |

**So there are two ink systems, one per panel, and the redesign has to pick one.** The Dashboard's cards restate `--ink-*` and therefore follow the ground. The Settings panels do not restate anything - they use `--text-primary` / `--text-secondary` / `--text-hint`, which are FIXED light-theme values, plus a long tail of `html.bg-light` rules to correct them. Moving a control from Pro Settings onto the Dashboard, which is what SR.2 is testing, moves it from the second system into the first.

**What this means for the canvas:** naming a token is not enough on its own. `--ink-secondary` means "secondary text" only inside a card that restates the ramp. Say the token AND the surface: "`--ink-secondary`, on a Card-tier surface".

---

## Ink on a card - THE RAMP

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--ink-primary` | `rgba(255, 255, 255, 0.90)` | same | same | PRIMARY TEXT ON A CARD. Headings, task names, figures. |
| `--ink-secondary` | `rgba(255, 255, 255, 0.70)` | same | same | SECONDARY TEXT ON A CARD. Sub-labels, meta lines, the row beneath a heading. This is the answer to "secondary text on a card". |
| `--ink-meta` | `rgba(255, 255, 255, 0.60)` | same | same | Metadata on a card - a count, a unit, a date beside a figure. One step below secondary. |
| `--ink-chrome` | `rgba(255, 255, 255, 0.50)` | same | same | Card chrome - the faintest text that is still text. Axis labels, counts on a badge. |
| `--ink-hint` | `rgba(255, 255, 255, 0.40)` | same | same | Placeholder-weight ink. Below the text floor on a light ground by design; use only where the words are not load-bearing. |

## Surfaces on a card

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--surface-line` | `rgba(255, 255, 255, 0.18)` | same | same | Hairline on a card. Section rules, row separators. Never text. |
| `--surface-fill` | `rgba(255, 255, 255, 0.10)` | same | same | Faint tint on a card. Hover washes, badge backgrounds. Never text. |

## Frosted tiers

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--pro-frost-card-bg` | `rgba(30, 30, 30, 0.85)` | same | **`rgba(255, 255, 255, 0.85)`** | CARD TIER surface - panels, sections, cards, submenus. Flips white-tinted on a light wallpaper. GROUND-KEYED. |
| `--pro-frost-card-blur` | `blur(12px)` | same | same | Card tier blur. Pair it with the card bg; a bg without the blur is not the tier. |
| `--pro-frost-floater-bg` | `rgba(30, 30, 30, 0.92)` | same | **`rgba(255, 255, 255, 0.92)`** | FLOATER TIER surface - modals, popovers, dropdowns, dialogs. GROUND-KEYED. |
| `--pro-frost-floater-blur` | `blur(14px)` | same | same | Floater tier blur. |
| `--pro-frost-menu-bg` | `rgba(30, 30, 30, 0.95)` | same | same | MENU TIER surface - context menus, pickers. NOT ground-keyed; light-wallpaper menus set a white background directly instead, so check the concrete selector. |
| `--pro-frost-menu-blur` | `blur(12px)` | same | same | Menu tier blur. |

## Text in the SETTINGS panels

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--text-primary` | `#202124` | same | same | PRIMARY TEXT IN THE SETTINGS PANELS (#202124). A fixed LIGHT-THEME value - see the warning at the top of this file. |
| `--text-secondary` | `#5f6368` | same | same | SECONDARY TEXT IN THE SETTINGS PANELS (#5f6368). Fixed light-theme value. |
| `--text-hint` | `#9aa0a6` | same | same | Hint text in the settings panels (#9aa0a6). Fixed, and under the text floor on the panel's own light plate - the 2026-09-17 sweep replaced five uses of it. |
| `--border` | `#dfe1e5` | same | same | The light-theme hairline. Settings uses it; Pro cards use --surface-line instead. |
| `--bg` | `#fff` | same | same | The page base in the no-wallpaper theme. Almost nothing renders on it - every shipped state has a wallpaper. |
| `--bg-card` | `#fff` | same | same | A card base in the no-wallpaper theme. See --pro-frost-card-bg for the one that actually ships. |
| `--bg-hover` | `rgba(0, 0, 0, 0.04)` | same | same | Hover wash on a light surface. |

## Accent and brand

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--accent` | `#1a73e8` | same | same | The light-theme interactive blue (#1a73e8). Tuned for a WHITE base; on dark frost it measures 2.38:1, so it is not the one to reach for on a card. |
| `--accent-text` | `#fff` | same | same | Text placed ON an --accent fill. |
| `--sat-accent` | `#8ab4f8` | same | **`#1a73e8`** | Accent FILL, ground-keyed (#8ab4f8 dark / #1a73e8 light). For graphical fills at a 3:1 floor. |
| `--sat-accent-ink` | `#8ab4f8` | same | **`#15539b`** | Accent INK, ground-keyed (#8ab4f8 dark / #15539b light). For accent-coloured TEXT and glyphs at a 4.5:1 floor. The distinction from --sat-accent is deliberate and is the one most often got wrong. |
| `--pro-ink-accent` | `#6fb1ff` | same | same | Interactive blue for controls on Pro's DARK frost. A single value, not ground-keyed - on a light-tinted surface it measures 1.84:1. Prefer --sat-accent-ink for ink. |
| `--pro-identity-from` | `#4a90e2` | same | same | Start of the Pro brand gradient. NEVER define this as var(--accent) - a gate fails the build if you do. |
| `--pro-identity-to` | `#6fb1ff` | same | same | End of the Pro brand gradient. Same rule. |
| `--sat-amber` | `#f1c40f` | same | **`#8a6d09`** | The pill's PAUSED amber, ground-keyed. |

## Type scale

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--fs-8` | `9px` | same | same | 9px. |
| `--fs-9` | `10px` | same | same | 10px. |
| `--fs-10` | `11px` | same | same | 11px. |
| `--fs-11` | `12px` | same | same | 12px. |
| `--fs-11-5` | `12.5px` | same | same | 12.5px. |
| `--fs-12` | `13px` | same | same | 13px. |
| `--fs-12-5` | `13.5px` | same | same | 13.5px. |
| `--fs-13` | `14px` | same | same | 14px. |
| `--fs-13-5` | `14.5px` | same | same | 14.5px. |
| `--fs-14` | `15px` | same | same | 15px. |
| `--fs-15` | `15px` | same | same | 15px. |
| `--display-1` | `56px` | same | same | The hero numeral (Insights total). Scales with the text-size setting. |
| `--display-2` | `36px` | same | same | Second display size. |
| `--display-3` | `24px` | same | same | Third display size, used for the Dashboard's streak and week figures. |
| `--display-weight` | `500` | same | same | Weight for the display sizes. |

## Spacing

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--space-1` | `4px` | same | same | 4px. |
| `--space-1-5` | `6px` | same | same | 6px. The TIGHT gutter - chip padding, icon-to-label gaps, dense rows. A real step, not drift: 140 declarations use it. |
| `--space-2` | `8px` | same | same | 8px. |
| `--space-2-5` | `10px` | same | same | 10px. The COMFORTABLE gutter - panel padding, row spacing. 114 declarations. |
| `--space-3` | `12px` | same | same | 12px. |
| `--space-4` | `16px` | same | same | 16px. |
| `--space-5` | `24px` | same | same | 24px. |
| `--space-6` | `32px` | same | same | 32px. |
| `--space-7` | `48px` | same | same | 48px. |

## Radius

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--radius-sm` | `4px` | same | same | 4px. Swatches, small chips. |
| `--radius-md` | `6px` | same | same | 6px. Buttons, inputs. |
| `--radius-lg` | `8px` | same | same | 8px. Cards, dropdowns. |
| `--radius-xl` | `12px` | same | same | 12px. The pill card, large surfaces. |
| `--radius-pill` | `999px` | same | same | 999px. Pills and segmented tracks. |
| `--radius-circle` | `50%` | same | same | 50%. Icon circles, swatches, radio marks. |

## Shadow

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--shadow-color` | `rgba(32, 33, 36, 0.28)` | same | same | The shadow colour every elevation uses. |
| `--shadow-floater` | `0 4px 16px rgba(32, 33, 36, 0.28)` | same | same | The one floater shadow. A target rather than a description - the sheet still carries 57 distinct box-shadows. |

## Shortcut icons

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--icon-bg` | `#f1f3f4` | same | same | The circle behind a shortcut icon. |
| `--icon-bg-hover` | `#e8eaed` | same | same | That circle, hovered. |
| `--icon-contain-bg` | `#d7dade` | same | same | The tile behind a letterboxed custom icon - deliberately distinct from --icon-bg or the letterboxing reads as a hole. |
| `--icon-inner` | `34px` | same | same | The size of whatever sits inside the icon circle - favicon, emoji or letter. One source of truth for all five kinds. |

## Search

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--search-bg` | `#f1f3f4` | same | same | Search field base, no-wallpaper theme. |
| `--search-bg-focus` | `#fff` | same | same | Search field, focused. |
| `--search-surface` | `rgba(255, 255, 255, 0.9)` | same | **`#fff`** | The search field's surface over a wallpaper. GROUND-KEYED. |

## Tasks, priorities and the habit grid

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--prio-urgent` | `#e74c3c` | same | same | Priority flag, urgent. |
| `--prio-high` | `#e67e22` | same | same | Priority flag, high. |
| `--prio-medium` | `#f1c40f` | same | same | Priority flag, medium. |
| `--prio-low` | `#5dade2` | same | same | Priority flag, low. |
| `--tt-play-outline` | `rgba(255, 255, 255, 0.92)` | same | **`rgba(0, 0, 0, 0.78)`** | The task row's play-glyph outline. GROUND-KEYED. |
| `--tt-play-outline-active` | `rgba(0, 0, 0, 0.85)` | same | same | That outline on the active row. |
| `--habit-ink` | `(unset on html)` | same | same | The habit grid's filled-cell ink. |
| `--habit-hairline` | `(unset on html)` | same | same | The habit grid's cell hairline. |
| `--dash-ring-size` | `72px` | same | same | Diameter of the Dashboard focus ring. Scales with the text-size setting. |

## Notes

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--note-ink` | `#2c2417` | same | same | Ink on a sticky note. The note papers are fixed colours, so this does not follow the ground. |
| `--note-ink-dim` | `rgba(44, 36, 23, 0.55)` | same | same | Secondary ink on a sticky note. |
| `--notes-trash-h` | `(unset on html)` | same | same | Height reserved for the notes trash strip. |
| `--note-paper-cream` | `#fdf6e3` | same | same | Sticky-note paper, cream. Fixed - notes keep their colour on every ground. |
| `--note-paper-butter-yellow` | `#fff3b0` | same | same | Sticky-note paper, butter yellow. Fixed - notes keep their colour on every ground. |
| `--note-paper-soft-pink` | `#ffd9e0` | same | same | Sticky-note paper, soft pink. Fixed - notes keep their colour on every ground. |
| `--note-paper-mint` | `#d4f0e0` | same | same | Sticky-note paper, mint. Fixed - notes keep their colour on every ground. |
| `--note-paper-sky-blue` | `#d6ecff` | same | same | Sticky-note paper, sky blue. Fixed - notes keep their colour on every ground. |
| `--note-paper-peach` | `#ffe0cc` | same | same | Sticky-note paper, peach. Fixed - notes keep their colour on every ground. |
| `--note-paper-lavender` | `#e6dcff` | same | same | Sticky-note paper, lavender. Fixed - notes keep their colour on every ground. |

## Wallpaper

| Token | dark | photograph | light | For |
| --- | --- | --- | --- | --- |
| `--wall-dim` | `0` | same | same | How dark the wallpaper dim overlay is. 0 means no dim. |
| `--wall-fade` | `450ms` | same | same | How long one wallpaper takes to become the next. |
