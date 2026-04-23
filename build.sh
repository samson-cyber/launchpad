#!/bin/bash
set -e

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash them before building." >&2
  echo "Run 'git status' to see what's pending." >&2
  exit 1
fi

rm -f launchpad.zip
powershell.exe -NoProfile -Command "
  \$files = @(
    'manifest.json',
    'newtab.html',
    'newtab.js',
    'newtab.css',
    'background.js',
    'bookmarks.js',
    'storage.js',
    'privacy-policy.html',
    'package.json',
    'assets',
    'icons',
    'lib'
  )
  Compress-Archive -Path \$files -DestinationPath 'launchpad.zip' -Force
"
echo "Created launchpad.zip"
ls -lh launchpad.zip
