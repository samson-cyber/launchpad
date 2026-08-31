#!/bin/bash
set -e

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash them before building." >&2
  echo "Run 'git status' to see what's pending." >&2
  exit 1
fi

# Ink gate: panel text that sets no colour falls through to --text-primary
# (#202124) and is invisible on the dark frosted surface a wallpaper produces.
# Shipped twice (a68dd89 Insights board, [1.0.18 B-2] sound picker) because it
# looks perfect in the default no-wallpaper theme. Runs before anything is built,
# so a defective build produces no artifact at all.
if ! node tools/check-panel-ink.mjs; then
  echo "ERROR: ink gate failed — panel text would be illegible on a wallpaper." >&2
  exit 1
fi

# Decision-chain gate: the [1.2.0] Focus Blocking block/allow logic. Guards the
# flagship Pro feature's correctness — a regression here either lets a blocked
# site through (the feature silently does nothing) or gates something it must
# never touch (mylaunchpad.me / the checkout host / our own gate page, which
# would make the extension unusable). Pure logic over the real modules, ~0.1s.
if ! node tools/check-focus-decision.mjs; then
  echo "ERROR: focus decision-chain gate failed — block/allow logic has regressed." >&2
  exit 1
fi

# Insights reader gate: the windowed rollups behind the Insights board
# (byDomainForScope and its siblings) against the real tracking.js. A regression
# here misreports the user's own measured time, which is the one thing the board
# exists to be trusted about. ~0.1s.
if ! node tools/check-insights-readers.mjs; then
  echo "ERROR: insights reader gate failed — windowed rollups have regressed." >&2
  exit 1
fi

# Since-format gate: the pill's "Active since" line. Small surface, but it is the
# honesty fix the [1.2.3] round shipped — a broken today/older branch puts a
# misleading timestamp on the flagship Pro surface. ~0.1s.
if ! node tools/check-since-format.mjs; then
  echo "ERROR: since-format gate failed — the pill's 'Active since' line has regressed." >&2
  exit 1
fi

# Trial-copy gate: the trial countdown headline and the license-control gating.
# Both are QA findings from the 2.0.0 pass — a plural boundary and a destructive
# button offered to users who cannot use it. Cheap to keep honest, embarrassing
# to ship wrong on a paywall surface. ~0.1s.
if ! node tools/check-trial-copy.mjs; then
  echo "ERROR: trial-copy gate failed — upgrade/trial copy or license gating has regressed." >&2
  exit 1
fi

# License-line gate: the inline status line under "Check license status now".
# The invariant worth a gate is not the wording but the DIRECTION of failure — a
# network outage must never render as an invalid licence, so the suite drives the
# shipped copy against the real LicenseClient.isTransientError and asserts that an
# unrecognised error with no state flip degrades to "could not reach", not to an
# accusation. Also holds the O1 ink rules for a line the static ink gate cannot
# see. QA 2026-08-10. ~0.1s.
if ! node tools/check-license-line.mjs; then
  echo "ERROR: license-line gate failed — license status feedback has regressed." >&2
  exit 1
fi

# Pro-celebration gate: the one-time activation moment's TRIGGER. Two failure
# modes, both unrecoverable and in opposite directions — celebrating a purchase
# nobody made (devPro override, a trial) or burning the one-time flag without
# showing anything (a buyer who paid and got nothing). Walks the whole matrix
# against the real ProAccess and the real Storage setter, in both an unpacked and
# a store-build context, plus the render arbitration and the O1 ink rules for
# markup no static gate can see. QA 2026-08-10. ~0.2s.
if ! node tools/check-pro-celebration.mjs; then
  echo "ERROR: pro-celebration gate failed — the activation trigger or its arbitration has regressed." >&2
  exit 1
fi

# Chip-ink gate: the ink a chip paints on a colour fill. The one ink rule in the
# product that is ARITHMETIC rather than a browser measurement — a chip fill is
# opaque, so the ratio is identical on every wallpaper frame, which makes it
# provable from source across every fill the product can produce. It guards the
# defect that started the round (a Rec-601 threshold sent #4A90E2 — the first
# colour in BOTH the tag and workspace palettes — to white ink at 3.29:1) and,
# just as importantly, catches any NEW chip that paints text on a fill without
# going through the one chooser. ~0.2s. `--mutate` seeds 9 defects; `--table`
# prints the per-fill ink table.
if ! node tools/check-chip-ink.mjs; then
  echo "ERROR: chip-ink gate failed — a chip's ink on its fill has regressed." >&2
  exit 1
fi

# Today-cockpit gate: the five Dashboard modules' arithmetic. Every figure on
# that surface fails the same quiet way — a wrong number that still looks like a
# number — so the boundaries are asserted rather than eyeballed: the streak's
# today-zero grace and retention cap, the completed-today count's LOCAL midnight,
# the done-ratio's divide-by-zero, an absent blocked count reading 0 and not
# undefined, and quick-add's UTC-midnight-of-the-local-date dueAt encoding (the
# off-by-one-day trap that bites in UTC+8 specifically). Also holds the O1 ink
# rules for markup the static ink gate cannot see, since the whole cockpit is
# JS-rendered. ~0.3s. `--mutate` re-boots it against 13 seeded defects.
if ! node tools/check-today-cockpit.mjs; then
  echo "ERROR: today-cockpit gate failed — a Dashboard figure or its ink has regressed." >&2
  exit 1
fi

# Text-size gate: the [2.0] Settings > Appearance tier ramp. The defect this
# exists for is SILENT — Small's contract is that it is today's sizing byte for
# byte, and one wrong value in the small block breaks it while everything still
# renders. The suite holds that as a structural invariant (a token is named after
# its own Small value), plus the no-inversion ordering across all three tiers, the
# "no hard literal below the floor" rule that stops a future rule escaping the
# setting, the reader's coercion, and the fact that an accessibility setting is
# never Pro-gated. ~0.2s. `--mutate` re-boots it against 16 seeded defects;
# `--table` prints the ramp.
if ! node tools/check-text-size.mjs; then
  echo "ERROR: text-size gate failed — the tier ramp, its wiring or its coercion has regressed." >&2
  exit 1
fi

# Pill-clarity gate: the flagship widget's consequence labels, its liveness
# indicator, the collision reserve and the windowed per-task time. The one that
# earns the gate is the LABEL/ACTION BINDING: a control that says "Complete" but
# routes to deactivate — or the reverse — is a silent, user-visible data event
# (a task closed that the user meant to keep), and it is exactly the defect this
# round removed. Also holds the indicator's truthfulness against the engine's own
# open session rather than mere activation, and the "last 30 days" copy against
# the calendar-month lie. ~0.2s. `--mutate` re-boots it against 23 seeded defects.
if ! node tools/check-pill-clarity.mjs; then
  echo "ERROR: pill-clarity gate failed — an action label, the tracking claim, the reserve or the window copy has regressed." >&2
  exit 1
fi

# L1 serialization gate: every background `data` writer must stay inside the
# enqueueBgData FIFO. Regressions here are SILENT DATA LOSS — one writer's blob
# overwrites another's — which is why this is a release gate and not a habit.
# ~2.3s: it injects storage latency on purpose so cycles genuinely interleave.
if ! node tools/check-bg-queue.mjs; then
  echo 'ERROR: background-queue gate failed — a `data` writer is not serialized (L1).' >&2
  exit 1
fi

# i18n site gate ([1.5.0]). SKELETON: it does NOT yet fail on hardcoded strings,
# because nothing has migrated and it would fail on all ~719 at once. What it
# DOES enforce today is its own integrity — the pattern self-test plus two
# anti-vacuity floors (P2) — and the catalogue value rules (no markup, no em
# dash, every message described), so those hold from the first message R2
# writes rather than being retrofitted across 763 values. Exit 2 means the gate
# is broken, which is deliberately distinct from a violation. Flip ENFORCING at
# the end of R3.
if ! node tools/check-i18n-sites.mjs; then
  echo 'ERROR: i18n site gate failed — the gate is broken, or a catalogue value breaks its rules.' >&2
  exit 1
fi

# NOTE — the mutation passes (`--mutate` on either suite above) are development
# verification, not release gates: they re-boot the subject once per seed and the
# queue one takes ~16s. Run them when the code under test changes; the gates here
# stay fast enough that nobody is tempted to skip the build.

rm -f launchpad.zip

# Package the allowlist. NOTE: do NOT use Compress-Archive — PowerShell 5.1's
# Compress-Archive writes sub-directory entries with BACKSLASH separators
# (icons\icon16.png), which violate the ZIP spec (APPNOTE 4.4.17 mandates '/')
# and make Chrome reject the install with "Could not load icon 'icons/icon16.png'"
# (RUNWAY STEP 1 live finding, 2026-07-21). Instead build the archive entry by
# entry via System.IO.Compression and set each entry name explicitly with forward
# slashes ([char]47), expanding directories to their files. Allowlist principle is
# unchanged — only the encoding is fixed.
powershell.exe -NoProfile -Command "
  \$ErrorActionPreference = 'Stop'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  \$allow = @(
    'manifest.json',
    'newtab.html',
    'newtab.js',
    'newtab.css',
    'background.js',
    'bookmarks.js',
    'license.js',
    'pro-access.js',
    'storage.js',
    'tracking.js',
    'i18n.js',
    '_locales',
    'offscreen.html',
    'offscreen.js',
    'gate.html',
    'gate.js',
    'gate.css',
    'privacy-policy.html',
    'package.json',
    'assets',
    'icons',
    'lib',
    'sounds'
  )
  \$root = (Get-Location).Path
  \$zip = [System.IO.Compression.ZipFile]::Open((Join-Path \$root 'launchpad.zip'), 'Create')
  try {
    foreach (\$item in \$allow) {
      \$full = Join-Path \$root \$item
      if (-not (Test-Path \$full)) { throw ('allowlist item missing from repo: ' + \$item) }
      if (Test-Path \$full -PathType Container) {
        Get-ChildItem -Path \$full -Recurse -File | ForEach-Object {
          \$rel = \$_.FullName.Substring(\$root.Length + 1).Replace([char]92, [char]47)
          [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(\$zip, \$_.FullName, \$rel)
        }
      } else {
        \$rel = \$item.Replace([char]92, [char]47)
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(\$zip, \$full, \$rel)
      }
    }
  } finally {
    \$zip.Dispose()
  }
"
echo "Created launchpad.zip"

# Package gate: every manifest-declared file (scripts, pages, AND assets —
# icons / action.default_icon / web_accessible_resources / content_scripts / ...)
# plus everything the pages/service worker reference must resolve to a real zip
# entry with the EXACT forward-slash path Chrome expects. Fails the build (and
# discards the artifact) otherwise, so a defective zip never leaves this script.
if ! node tools/verify-package.mjs launchpad.zip; then
  echo "ERROR: package gate failed — discarding defective launchpad.zip" >&2
  rm -f launchpad.zip
  exit 1
fi

ls -lh launchpad.zip
