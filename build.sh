#!/bin/bash
set -e

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash them before building." >&2
  echo "Run 'git status' to see what's pending." >&2
  exit 1
fi

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
    'privacy-policy.html',
    'package.json',
    'assets',
    'icons',
    'lib'
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
