# The busy fixture — what the canvas should use as content

Every frame in this pack is this data. It is seeded by `tools/seed-fixture.mjs --profile busy-messy`, which is a committed tool, so any of these frames can be reproduced rather than trusted.

**Use these names.** Not "Task 1" and "Group A". The whole point of designing against a busy fixture is that real names have real lengths, and three of the entries below exist specifically to break a layout that only ever saw short ones.

---

## Three workspaces, deliberately at three different scales

| Workspace | Mode | Tracking | Tasks | Notes | Named sessions | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| **Studio** | Work | on | 26 (5 done) | 12 | 3 | The full board. Every frame in this pack is Studio. |
| **Side projects** | Casual | on | 2 | 1 | 0 | Sparse on purpose — the layout with almost nothing in it. |
| **Archive** | Casual | **off** | 0 | 0 | 0 | Empty on purpose — the in-profile route to every zero state, and the only workspace with tracking off. |

A redesign that only looks right on Studio has been tested on one third of the fixture.

---

## Home — 5 groups, 47 shortcuts

| Group | Shortcuts | Why it is there |
| --- | --- | --- |
| Ungrouped | 0 | The empty-group state. |
| Daily | 8 | An ordinary group. |
| **Build** | **24** | Deep enough to scroll inside its own group. |
| Reading | 9 | Contains a 70-character shortcut name. |
| Clients | 6 | Two same-name, same-host pairs — the disambiguation case. |
| Someday | 0 | A second empty group, so "empty" is not a single sample. |

There is also a nested pair under Drive.

---

## Goals — six, at six different completion states

| Goal | Progress |
| --- | --- |
| Migrate the design system | 3 of 3 — complete |
| Ship the Q3 report | 2 of 5 |
| Rebuild onboarding flow | 0 of 4 |
| Rework the pricing page | 0 of 2 |
| Learn the new render pipeline | 0 of 2 |
| **A goal whose name runs long enough to test how the card header truncates it** | 0 of 1 |

The last one is not padding. It is 76 characters and it exists to show where a card header clips.

---

## Tasks — 26 in Studio, 21 open

Real names, real lengths:

> Wireframe the shortened flow · Write the empty-state copy · Cut the third step entirely · Instrument the drop-off · Chart the quarter-over-quarter split · Circulate for comment · Book the studio for Thursday · Interview three lapsed trials · Rewrite the comparison table · Finish the generics chapter · Build a tiny scheduler · Check the header at narrow widths · Reply to the design review thread · Renew the domain · Swap the studio lightbulbs · Reconcile August invoices · Draft the retro agenda · Back up the archive drive · Weekly review · Morning triage

Plus one deliberate outlier: **"A standalone task with a deliberately long name, to see where the row clips it."**

**Due today: 9 rows, 4 of them overdue** — Book the studio for Thursday, Reply to the design review thread, Wireframe the shortened flow, Renew the domain. Priorities run across all four bands, which is what puts the coloured spine on the left of each row.

Side projects has two: *Sketch the album layout*, *Price the risograph run*.

---

## Recurring — four templates, one paused

| Template | Frequency |
| --- | --- |
| Morning triage | daily |
| Weekly review | weekly |
| Backup check | weekly — **paused** |
| Invoice run | monthly |

---

## Tags — 12 active, 2 in trash

`deep work` · `admin` · `writing` · `review` · `client` · `infrastructure and platform work` · plus one auto-tag per goal, including the 76-character one. The long tag names are the reason the Tags list in Pro Settings is 12 rows deep and one of them wraps to two lines.

---

## Focus blocking — eight sites

`news.ycombinator.com` · `reddit.com` · `x.com` · `youtube.com` · `instagram.com` · `linkedin.com` · `netflix.com` · `bbc.co.uk`

**These are not in the fixture.** `busy-messy` seeds no blocked sites at all, so the first capture of Pro Settings framed the Focus-blocking section in its EMPTY state — on a fixture chosen for being full. The eight are seeded by the pack's own frame harness through `Storage.addBlockedDomain`, and the count is asserted before any frame is taken.

**They cost 228px.** Pro Settings measures 2624px of content with no blocked sites and 2852px with eight. Each row carries a name, a `Rules` button and a remove `×`, and the list grows with the user without limit — so the panel's height is partly the user's data, not the design's.

---

## Tracking — 249 sessions over 75 days

51 day aggregates, 99 raw sessions retained after the 30-day prune, every `closedBy` reason represented, and an hour distribution with a morning peak, a lunch dip, empty days, an all-nighter and an early bird. `lifetime.since` is 75 days old, which is past the 30-day floor the lifetime line needs to render at all.

What that produces on the Dashboard frames: **4h6m focused today**, 12h56m this week, a 1-day streak, and a by-site list of four tasks and two domains.

---

## The numbers a layout has to survive

| | |
| --- | --- |
| Longest goal name | 76 characters |
| Longest shortcut name | 70 characters |
| Deepest group | 24 shortcuts |
| Tags list | 12 rows, one wrapping to two lines |
| Blocked sites | 8 rows, unbounded in principle |
| Workspaces | 3 rows plus a create form |
| Due today | 9 rows, 4 overdue |
| Settings content height | 1101px |
| Pro Settings content height | 2852px |
