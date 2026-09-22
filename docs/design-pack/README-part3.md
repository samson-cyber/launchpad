# Design pack, part 3 — the v2 surfaces as they ship

Captured 2026-09-22 from `4a74eb0`, the final tree of the Warm Bento arc.

## How these were made, and why it matters

**Through the product's own controls, never composed** (BUGS I27). Every ground
is set with `Storage.saveBackgroundConfig` followed by a reload — the same
writer the wallpaper picker calls — and every surface is reached by clicking the
control a user clicks. Nothing here is assembled from pieces and nothing is a
mock: if a frame shows it, the product did it, on the fixture named below.

**Fixture:** four tasks seeded through `Storage.createTask` (two overdue, one due
today, one future), the first made active. `LP.devPro(true)` except where a
filename says `free`. 1440x900, transitions and animations frozen at capture.

## The naming

    v2-<surface>-<ground>-4a74eb0.png     the wallpaper surfaces
    v2-free-<tab>-4a74eb0.png             the free preview, one ground
    v2-<panel|popup>-<state>-4a74eb0.png  the companion documents

## Three grounds for the wallpaper surfaces

`dark` (#2a2a2a, the shipped default), `light` (#f5f5f5, a light solid), `photo`
(a generated gradient photograph). Home, Tasks, Dashboard, Insights and the one
Settings panel, on each.

## Three STATES for the companion documents, and no grounds (ruling 15)

The popup and side panel are painted by Chrome over browser chrome and **never
over the wallpaper**. `companion.css` mentions `has-bg` / `bg-light` only in
comments explaining their absence, and H4.0 proved it by writing a
red-and-white wallpaper to storage and finding both documents still compositing
on `#1a1518`. So the axis that varies here is state, not ground: **idle**,
**running**, **paused** — each reached by clicking the panel's own Start and
Pause, never by writing storage.

## What these frames caught

- **The Pro Dashboard shows "Nothing tracked yet today."** The line was added for
  the FREE surface under ruling 5, and the frames showed it landing on Pro too —
  both Dashboards share `dashPassiveHtml`. Right behaviour, wrong key name; the
  key was renamed from `dash_free_nothing_tracked` to `dash_nothing_tracked_today`
  in the same commit.
- **The paused panel's amber is nearly invisible early in a phase.** The ring is a
  conic sweep proportional to elapsed time, so at 24:58 remaining roughly 0.1% of
  it is amber and the paused state reads almost entirely from the Resume button.
  That is the evidence for Samson's check 13, not a defect anyone has ruled on.

## Retired here

`sidepanel.png` (ruling 16) — captured before H2c's tile language and before the
due-work grouping, so it showed a panel that no longer exists in two separate
ways. `pill-states.png` — the active-task pill was removed in `a9e2947`.
