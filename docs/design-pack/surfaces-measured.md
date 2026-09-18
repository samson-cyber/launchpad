# Surfaces, measured

A census, not a redesign. Every number below is read from a real browser on the busy fixture at 1440 wide, so the audit starts from facts rather than impressions.

**What "under floor" counts.** The method is `eaa3a69`'s exactly: one painted frame and one inkless frame per surface per ground, each text node measured over its own Range rect with `tools/pixel-contrast.mjs`, and an `elementFromPoint` hit test so occluded or clipped nodes are excluded rather than mis-measured. Floor is 4.5:1, or 3.0:1 for WCAG-large text.

**The denominator is what is ON SCREEN at 1440×900**, which is the frame a user occupies — not the whole scroll. Tasks alone hides another 1,128px below the fold, so a full-scroll census would be a different and larger number. Stated because a count without its denominator is a decoration.

---

## Content height

| Surface | Panel at 1440×900 | Its own scrollHeight | Deepest inner scroller | Overflows by |
| --- | --- | --- | --- | --- |
| **Tasks** | 808px | 808px | **1936px** | 1,128px, and **not in the panel** — see below |
| **Insights** | 808px | 1461px | 1461px | 653px |
| **Dashboard** | 808px | 829px | 829px | 21px |

**Tasks does not overflow its panel — it overflows three separate scrollers inside it.** That is the structural fact of the surface and the one most likely to shape a redesign:

| Scroller | Behaviour |
| --- | --- |
| `.tasks-body` | grows with the viewport |
| `.notes-stack` | grows with the viewport |
| `.tt-box-body` | **capped at `max-height: 320px`** — the Completed (18) and Deleted (3) boxes scroll inside themselves at any window size, hiding 292px that no amount of screen will reveal |

So "how tall is Tasks" has no single answer: the board, the notes column and the archive boxes each scroll independently, and one of them is capped by design.

---

## Control types per surface

Counted from the live DOM, visible controls only, segmented children counted individually because a user meets three buttons rather than one control.

| Surface | Distinct types | Breakdown |
| --- | --- | --- |
| **Tasks** | **5** | button ×121 · checkbox ×7 · select ×2 · text input ×1 · link ×1 |
| **Insights** | **2** | segmented button ×4 · button ×1 |
| **Dashboard** | **3** | button ×2 · checkbox ×2 · text input ×1 |

**121 buttons on the Tasks tab, in one 808px frame.** That is the number worth sitting with. SR.1 measured 22 operable controls on Settings and 44 on Pro Settings and called the panel jumbled; Tasks carries 131 in the part of it you can see.

**Insights is the opposite extreme: two control types and five controls total** for a surface of 1,461px. It is almost entirely read-only.

---

## Text sizes per surface

Counted as `font-size/font-weight` pairs on visible text nodes.

| Surface | Distinct sizes | Most used | The tail |
| --- | --- | --- | --- |
| **Tasks** | **16** | 12px/400 (116 nodes) | 22px/600, 15px/700, 12.5px/600, 12.5px/400, 11px/600 — each on 1–2 nodes |
| **Insights** | **10** | 13px/400 (31 nodes) | 56px/500 on exactly one node (the hero), 24px/500 on two |
| **Dashboard** | **11** | 14px/400 (24 nodes) | 56px/500 on one, 24px/600 on one, 22px/600 on one |

**Sixteen type styles on one tab**, and the half-steps (12.5px) appear twice each. Whatever else a redesign does, this is the ramp it inherits.

---

## Nodes under the text floor

| Surface | dark (#2a2a2a) | a photograph | light (#f5f5f5) | measured |
| --- | --- | --- | --- | --- |
| **Tasks** | 0 | **13** | 5 | 51 |
| **Insights** | 0 | 0 | 1 | 61 |
| **Dashboard** | 0 | **2** | 0 | 48 |

**The photograph is the worst ground, and that is the whole argument for three frames.** Thirteen nodes on the Tasks tab fail over a bright photo and none of them fails on the dark default. This is the same mechanism part 1 found on Home: `applyBackground` derives a luminance class for **colour** wallpapers only, so a photograph gets `bg-image` and neither `bg-light` nor `bg-dark` — not one of the 705 `html.bg-light` rules reaches it.

A layout signed off on the dark default has been tested against the ground where nothing fails.

---

## The other surfaces

| Surface | Ground(s) | Note |
| --- | --- | --- |
| **The gate** | **one** | `gate.css` has no `has-bg` model at all; WM.2 measured four identical readings. Three frames would be three copies of one picture, so it is captured once per STATE instead. |
| **The popup** | **one** | Chrome paints it over browser chrome, never over the wallpaper. `companion.css` says so in its own header. 360px fixed. |
| **The side panel** | **one** | Same reason. Width is Chrome's and the user's, so the frame is one sample of a draggable range, not the width. |

---

## Two numbers that disagree, found while measuring

**The bell says 9 and the side panel says 2.** The bell's list reads "Due work" with an Overdue group and a Due today group over nine rows; the side panel beneath the same module reads "DUE NOW (2)". Both are correct for their own definition and the product never says which is which. Worth a decision before either surface is redesigned.

**The side panel is mostly empty.** At 900px tall the module and its two due rows occupy about 300px; the remaining two thirds is void. If the ruling is that controls belong where the things are, this is the other surface with room.
