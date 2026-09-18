# v2 handoff — Warm Bento across every surface

The document Claude Code builds from. Every surface has a board on the canvas (https://claude.ai/artifact/HJH3cCzviU1hruZjUCeA5P, the V2-* boards) and a token set in the design system (https://claude.ai/artifact/YBuudND828VcaH8KYTUNj6). The canvas decided layout and grouping; this document says what the code decides — everything measurable — and in what order.

**The one rule carries over unchanged:** every surface is measured on the three real grounds (has-bg bg-dark, has-bg bg-image with a bright photo, has-bg bg-light) with tools/pixel-contrast.mjs, before it is called done. The canvas cannot see contrast through frost; the code can.

---

## 0. What changes in the doctrine — DECISIONS entries, written FIRST

Four amendments. Each is an appended DECISIONS.md entry dated 2026-09-18, citing the canvas ruling, written before any product code so the build inherits them rather than smuggling them in.

1. **One accent becomes one ACTION colour plus a TINT PER TILE KIND.** `action` orange is the one thing to do. `tile-overdue` rose, `tile-goals` green, `tile-blocking` violet carry meaning on the surface. Text on any tile stays achromatic (`ink`, `ink-mute`); only a tile's eyebrow takes its lifted ink (`ink-on-overdue` etc.). The research's "multi-accent" warning is acknowledged and the rule is: colour on the tile, never on the words.
2. **The frost tier is a family.** Card-tier frost is no longer one dark. `tile-hero`, `tile-list` and the three tints are each a gradient pair at 82% (list at 72%), 18px blur with 130% saturation, over the wallpaper. `pro-frost-card-bg` is retired in favour of the family. pixel-contrast measures ink on each tint.
3. **Space Grotesk, product-wide.** Including Home's greeting, wordmark, tab labels and shortcut names at their current sizes. Roboto goes. Loaded from the extension's own fonts/ (no remote fetch — CSP), so the woff2 files ship in the zip and build.sh's allowlist knows them.
4. **The radius ramp.** `tile` 20px on every tile; `inner` 12px on a button inside one; `pill` 999px on chips; `check` 5px. The 8px card radius is retired.

What does NOT change: nothing nags; absent-not-zero; the priority spine at 3px as the only priority signal; amber for paused; the three grounds; the census gate; the bell's doctrine gate; Home's layout; the sidebar panels.

---

## 1. Foundations — one session, everything depends on it

**H0.** tokens.css gains the v2 set beside the v1 set (v1 stays until the last surface migrates, then a sweep). The tile becomes a CSS component: `.tile`, `.tile--hero`, `.tile--action`, `.tile--overdue`, `.tile--goals`, `.tile--blocking`, `.tile--list`, each setting its gradient pair, its eyebrow ink variable, and the shared radius/border/inset/frost. Space Grotesk in fonts/, `@font-face`, and `body { font-family }` flipped. The four DECISIONS entries. The design-guide's 3.3 table updated to the new per-ground pairs.

**The grid** as a utility: `.bento` four columns, 176px rows, 14px gap; `.span-2`, `.span-2x2`, `.span-3`.

Verified: the token set compiles; every `.tile--*` renders on three grounds with its eyebrow ink measured; Space Grotesk loads offline (CSP asserted, no network request); build.sh's allowlist carries the font files and the source gate agrees. Nothing user-visible changes yet except the face — every surface still uses v1 classes. **That is the assertion: byte-identical DOM, one font-family difference.**

---

## 2. Surfaces — what each board decided

Each entry: the board · what changes · what stays · what is measured · which files.

### Dashboard — V2 board 8 (Sw8-BentoPhoto) is the reference, with Recommended's four controls
Changes: the whole tab becomes a bento grid. Hero 2×2 with the figure in the action gradient; Up-next 2×1 in the action tint with the Start button; Overdue, Goals, Blocking as 1×1 count tiles in their tints; Due-today 2×2 list tile; Time-by-site list tile. The mode chip pair beside the greeting; reminders toggle on the due tile's head; tracking toggle on the time tile's head. The Overdue badge is the word in `action`, no fill (ruled 2026-09-18). The greeting stays as text on the wallpaper with its shadow.
Stays: every reader — todayTasksAndSitesForScope, getDueWork, the hero's figure — is untouched. This is a re-render, not a re-derive.
Measured: every text node on every tile, three grounds. The action tile's dark ink at 4.5+. The free preview's byte-identity assertion (PT.2, f77e19c) changes shape a fourth time — the preview is rebuilt in §2 Preview.
Files: newtab.js Dashboard region, newtab.css Dashboard region.

### Tasks — V2-Tasks
Changes: three count tiles across the top (overdue rose, goals green, recurring violet). Each goal a list tile: name, progress bar, count, ⋯ — no slug chip. The row: spine · checkbox · name · duration · date · tag-as-text · ⋯ on hover; no play glyph (it lives in the hover ⋯ and the context menu), no priority chip, no delete icon (586c84a). One orange "New task"; "New ▾" holds Goal / Recurring / Tag; Templates as a text link. Filters: Active / Completed segmented, sort on the right. Notes: a fourth column, a list tile holding paper cards; paper colours unchanged; the notebook chip strip in the action tint.
Stays: every writer; the recurring section's habit grid (its cells take `action` at the three alphas); the archive boxes capped at 320px.
Measured: 16 type styles collapse to the v2 ramp — report the table. The 13 photo-ground nodes re-measured after the tiles land, since most now sit on a tile rather than the wallpaper.
Files: newtab.js Tasks region, newtab.css Tasks region.

### Settings — V2-Settings, and option 3 from the earlier ruling
Changes: ONE panel. Settings and Pro Settings merge. Three columns of tiles by subject: Look, Wallpaper (list tint) · Focus sessions (violet, PRO), Blocking (rose, PRO) · Workspaces (green, PRO), Data (list), Pro (list). Three control families: toggle, segmented pill, stepper. Search at the top. The licence key in the Pro tile, reachable on expiry. The sidebar's two entries become one.
Stays: every writer, every storage key. The per-workspace tracking toggle and the Privacy row's global toggle both survive as rows in their tiles (they are different fields).
Measured: the control families on each tint — the segmented pill on rose and violet and green, since 271b31b found .seg-btn under floor on the floater. SR.1's 66 controls accounted for: each one's new tile named, or its removal ruled.
Files: newtab.js Settings + Pro Settings regions (they merge), newtab.css likewise, newtab.html's two panels become one.

### The pill — V2-PillZones (supersedes V2-Pill, 2026-09-19)
**H2b, FIX-2, FIX-3 and FIX-4 built this surface as MODES — list, or card, or running — and Samson rejected each. FIX-5 replaces the architecture, against board V2-PillZones.** ONE 300px pill, FOUR ZONES that reveal, the LIST IS THE FLOOR. `HEAD` always: the task name or "No active task", the state dot, the chevron. `FOCUS` while a session runs: a 56px conic ring with the phase inside, Pause/Resume as the one filled primary and Stop as an outline beside it. `TASK` while a task is active: the stopwatch and its unit word, the stamp and the worked clock on one meta line, the engine line under it, the blocking row, Complete and End for now as links. `LIST` ALWAYS beneath: the workspace tree, folded to one line ("22 more tasks") while a session runs. Zones are separated by a 1px `--tile-rule` and each is padded 12px 16px. The element carries `.tile` with three overrides: 16px radius, FIX-3's `rgba(38,30,34,0.60)` frost at `blur(14px)` (0.90 on a light ground), and padding 0 because the zones carry it. `max-height: 60vh`, the list scrolling inside itself. The slim face and the 28px dot both survive, one click apart. **The pill never pushes Home — `[1.10.11]`'s reserve is deleted (DECISIONS, 2026-09-19).**
Stays: position fixed top-right; every reader and writer; the mode stamp; the bar-to-pill clearance DB.1 measured.
Measured: the ring's fill against its own tile at 3:1; the chip; every state on three grounds — the pill sits on the wallpaper, not a tile, so its own frost is the ground.
Files: newtab.js pill region, newtab.css pill region.

### Insights — V2-Insights (after the 2026-09-18 fix)
Changes: bento. Hero 2×2 with the figure in the gradient; hours/day 2×2 with bars filling the tile; time-by-tag 2×1 green with a 112px donut and a legend; by-site and top-tasks as list tiles; this-week violet; heatmap as a 3-wide list tile with cells in `action` alphas; achievements rose. Range selector as a segmented pill; Export beside the history caption.
Stays: every chart's data path; the heatmap's geometry (fixed-basis labels); the unearned badges deliberately faint (1292ef4).
Measured: the donut's segments at 3:1 against the green tile; the bar fills; every eyebrow on its tint.
Files: newtab.js Insights region, newtab.css Insights region.

### Popup and side panel — V2-Companion
Changes: hero-tinted tiles at 16px on Chrome's own dark. The popup: ring, chip, task, the two figures, Pause and the link. The side panel: the module tile, the due-work list tile with overdue/due-today groups, and a controls tile with the mode pair, the reminders toggle (with "Fires in Work mode" when Casual, ruled 6bde048) and the tracking toggle.
Stays: companion.js's mount contract; the popup as a display plus pause; getDueWork on both.
Measured: one ground each (Chrome's surface), every node.
Files: companion.js, companion.css, companion-popup.js, side-panel.js.

### The gate — V2-Gate
Changes: the blocked states take the overdue tint — a blocked page is a rose page — with the host in `action-soft`, the reason in a rose-lifted ink, the actions as pills (the primary in `action`). The friction ring as a conic in `action`. The inert state in the hero tint.
Stays: one ground (gate.css has no has-bg model — WM.2); every button's destination (53cfc42); the friction escalation.
Measured: every node on the rose tile; the ring at 3:1.
Files: gate.js, gate.css.

### Modals — V2-Modals
Changes: the destructive confirm takes the overdue tint with the rose lifted to its button (that is the danger affordance now — aeaf99d's red is replaced, not restyled). Other confirms and the attach picker in the hero tint. The context menu at menu-tier 96% with Delete in the rose ink. The rules editor (271b31b) in the language: segmented pill, day chips in the action tint, the time steppers, the mode note.
Stays: confirmModal's contract; every dialog's buttons and destinations (ebe7339's harness re-run); the one-writer rule.
Measured: every modal on the floater tier over each of three grounds; the danger button against the rose tile.
Files: newtab.js modal region, newtab.css modal region.

### The free preview — V2-Preview
Changes: STRUCTURE, not skin. Real on the left at half width — the user's time-by-site card in a list tile, labelled "This is yours — free, local, no account." The demo on the right at reduced opacity, every card labelled "Preview · example data" (f77e19c). The pitch is the single action tile with the trial length and one button. No fake figure sits above a real one.
Stays: renderProPreview as the only renderer; the census labels.
Measured: the demo tiles at reduced opacity must still clear the floor for their labels — or the labels sit outside the opacity.
Files: newtab.js renderProPreview, newtab.css.

### Home — the face only
Changes: Space Grotesk on the greeting, wordmark, tab labels, shortcut names, group headers, the search bar and its two tabs. Sizes unchanged. The bell and the Pro chip inherit.
Stays: everything else. Layout locked. The text-shadows are load-bearing (980420c) and stay.
Measured: the light-ground sweep re-run on Home, since a face change moves stroke widths and the tab labels were at 2.51 before eaa3a69.
Files: newtab.css Home region only.

---

## 3. Batches — file ownership, parallelism

**H0 — foundations.** One session. tokens.css, fonts/, build.sh, DECISIONS.md, the design guide, the `.tile` and `.bento` components. Nothing else starts until H0 merges.

**H1 — three sessions in parallel.**
- H1a Dashboard: newtab.js/css Dashboard region.
- H1b Tasks: newtab.js/css Tasks region.
- H1c Settings merge: newtab.js/css/html Settings + Pro Settings. The largest; it may need two rounds.
Three sessions in newtab.css by region, as the September batches ran. Rebase before merging; a branch carrying earlier commits pushes them all.

**H2 — four sessions in parallel, after H1.**
- H2a Insights: newtab.js/css Insights region.
- H2b The pill: newtab.js/css pill region.
- H2c Companion: companion.*, side-panel.js — no newtab.*.
- H2d The gate: gate.js/css — no newtab.*.

**H3 — three sessions in parallel, after H2.**
- H3a Modals: newtab.js/css modal region.
- H3b Preview: renderProPreview.
- H3c Home's face: newtab.css Home region.

**H4 — one session.** The checkpoint: every surface driven on the busy fixture; the packaged smoke; the v1 token sweep (retire what nothing reads, with the museum rule); design pack part 3 — every V2 board's real counterpart frame, three grounds; the light-ground sweep re-run product-wide. And the DECISIONS entry that closes the arc.

Then Samson's sweep, then the motion research.

---

## 4. The verification standard, unchanged

- Driven, not asserted. Every action from a click to persisted state.
- Three grounds, pixel-contrast, every text node, before a surface is called done. Frames viewed.
- The census gate ENFORCING on every string.
- 26 gates plus the boot check, every round, counts reported.
- M3 through a writer, M7 from the blob, M9 no NUL.
- A premise audit first. This spec has been wrong before it was built once already; every H-round quotes what it finds before it changes it.
- IMPLEMENTATION comments only. Never a REVIEW.

---

## 5. Out of scope

The blocking favicon grid (its own spec, 1218620694560561). Palette choices beyond warm (the token set makes them possible; none is built). Motion (its own research pass after H4). Any change to a reader or writer — v2 is a re-render.
