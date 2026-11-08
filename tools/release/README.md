# tools/release - checks to run before a store submission

Instruments, not gates: `build.sh` runs none of these. They need a browser.
Added 2026-11-08, before the post-redesign cut.

## Upgrade test

Every earlier release check started from a FRESH profile. These two start from
a profile that LIVED on the version users actually have, then update it in
place, the way the store does: same load path, same extension id, the browser
closed gracefully first so storage is flushed (BUGS.md I9).

Build both artifacts and unzip them. The old one comes from its tag, in a
detached worktree; mtimes don't matter here.

    node --experimental-websocket tools/release/upgrade-test.mjs <repo> <pkg-old> <pkg-new> <work-dir>
    node --experimental-websocket tools/release/upgrade-dismissed.mjs <repo> <pkg-old> <pkg-new> <work-dir>

`upgrade-test.mjs` runs three scenarios:

- A, a plain user who changed nothing.
- B, a heavy user: Pro, tags, a goal, tasks, an uploaded wallpaper and a changed setting.
- C, a control: a brand-new install of the new build. It must get the
  fresh-install photograph, which proves the test can tell a new user from an
  upgraded one.

It compares every stored key before and after, and fails on any of these:

- a lost record, a removed key, or a recoloured existing tag;
- a lost wallpaper or setting;
- an existing user given the photograph;
- a console error.

`upgrade-dismissed.mjs` runs scenario D: a user who already saw the
right-click tip and cleared the examples. Neither may come back. Old builds
cannot be driven to that state on demand (the tip runs on a timer, and Clear
examples is gated), so the state is set to exactly what the old build writes,
read from its source.

First run, 2026-11-08, from 2.0.0 to master `8c5479d` (manifest 2.2.0): all
four scenarios pass.
