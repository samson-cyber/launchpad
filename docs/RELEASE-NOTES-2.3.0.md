# Release notes - 2.3.0

**Cut against the LIVE `v2.2.0` (`f8b05da`).** Renamed from `RELEASE-NOTES-NEXT.md`, which was
still empty, by Round WP on 2026-11-10. RELEASE_VERSION `2.3.0` was ruled by Samson on
2026-11-10. A fresh `RELEASE-NOTES-NEXT.md` starts for the release after.

Same rule as the files beside it: **nothing here describes a feature that is not in the build.**

**Baseline: `v2.2.0` -> `f8b05da`.** "New" means a 2.2.0 user did not have it. 2.2.0 is live
(Samson, 2026-11-10), so nothing from `RELEASE-NOTES-2.2.0.md` is repeated here.

**Method.** The range is `git log v2.2.0..<release commit>`. Section B lists every commit in it,
user-facing or not, so nothing is left out by omission. The welcome page was verified live in
scratch Chrome 156 and Edge 157, on the working tree and on the packaged build (Asana
1220373512344858, IMPLEMENTATION).

---

## A. PASTE THIS - "What's new"

```
A short welcome for new installs.

• When you first install LaunchPad, it opens one welcome tab
  before your first new tab. It shows the question Chrome is
  about to ask, "Change back to Google?", and points at Keep it,
  the button that keeps LaunchPad on.
• From there, one click opens your first new tab.
• If LaunchPad gets switched off by mistake, the page tells you
  how to switch it back on.

Updating from an earlier version changes nothing: the welcome tab
only opens on a fresh install.
```

### Listing copy

For Samson to paste into the store DESCRIPTION (not the "What's new" field). It is the one
sentence that reaches people who read the listing before installing:

```
After installing, Chrome asks whether to keep the new tab change. Choose Keep it to use LaunchPad.
```

---

## B. Every commit in the range

Filled in from `git log --oneline v2.2.0..<release commit>` at the cut. User-facing commits
are marked; everything else is internal and is listed so the range is complete.

| Commit | What | User-facing |
|---|---|---|
| `67c91fd` | chore: 2.2.0 store assets (listing frames, sidePanel justification) | No, store assets |
| `1e5cb54` | chore: 2.2.0 promo tiles | No, store assets |
| `0e0ef41` | chore: 2.2.0 store icon | No, store assets |
| `46ef03c` | docs: 2.2.0 submitted; the ElevenLabs licence question is closed | No, docs |
| `9092819` | [1.17.0] feat(onboarding): welcome page on install | **Yes, the welcome tab** |
| `bee5616` | test: harnesses close the welcome tab by URL | No, test harnesses |
| (docs) | docs: Round WP, this file, DECISIONS, BUGS I36, CLAUDE.md release state | No, docs |
| (cut) | the manifest bump to 2.3.0 | No |

**Shipped files changed since 2.2.0:** `background.js` (one block in onInstalled),
`locales/en.js` (13 new `welcome_*` messages, none changed), and the new `welcome.html`,
`welcome.js`, `welcome.css` and `assets/welcome/chrome-keep-prompt.webp`. Nothing else that
ships has changed: the three store-asset commits touch `store-assets/`, `store-description.md`
and `tools/promo/` only.

---

## C. Permissions, against the 2.2.0 baseline

**Permission-neutral.** `permissions`, `optional_permissions`, `host_permissions`, the CSP and
`web_accessible_resources` (none) are identical to `f8b05da`. The only manifest change is
`version`. `chrome.tabs.create`, which opens the welcome tab, needs no permission (and `tabs`
was already granted). The welcome page is the extension's own page, opened by the extension,
so it needs no `web_accessible_resources` entry. No new install warning, and no re-consent
for existing users.

**Privacy.** The welcome page makes no network request (asserted over the CDP Network domain,
and statically by `tools/check-welcome.mjs`), reads and writes no storage, and collects
nothing. `privacy-policy.html` needs no change.

---

## D. Behaviour that changes for EXISTING users without them asking

**None.** onInstalled opens the welcome tab on reason `"install"` only. An update fires
`"update"`, which was verified to open nothing (the real listener invoked against the
service worker with `update`, `chrome_update` and `shared_module_update`), and
`tools/check-welcome.mjs` holds that wiring in every build.

---

## Where this goes at upload

1. Chrome Web Store dashboard, the item, **Store listing**: section A's block goes in the
   version notes / "What's new" field.
2. **Store listing, description:** paste the "Listing copy" sentence where a reader who has not
   installed yet will see it, near the top.
3. **Privacy practices: this submission IS permission-neutral** against 2.2.0. No new
   justification is needed. The `sidePanel` justification written for 2.2.0 carries over
   unchanged.
4. The annotated tag goes on at submission, on the exact commit the uploaded zip was built
   from, per CLAUDE.md. The artifact is the one built in the MAIN checkout at the cut, and its
   sha256 and byte count go in the tag message.

## Predecessors

`RELEASE-NOTES-2.2.0.md` describes **the build users are on now**: 2.2.0 was submitted on
2026-11-09 from `f8b05da` and is live. Leave it as it stands.
