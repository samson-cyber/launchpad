# Release notes - 2.3.0

**Cut 2026-11-10 against the LIVE `v2.2.0` (`f8b05da`), and RE-CUT twice the same day** after Samson's
hands-on passes. The build commit is the LAST re-cut commit (section B). The `62d761d` and `fb959be`
artifacts were replaced before upload. At the second re-cut Samson ruled that the first-open tour
([1.17.1]) and one-click add ([1.17.2]) ship in 2.3.0 rather than the release after. Renamed from `RELEASE-NOTES-NEXT.md`, which was still empty, by Round WP on 2026-11-10. RELEASE_VERSION `2.3.0` was ruled by Samson on
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
  before your first new tab. It shows the question Chrome may
  ask, "Change back to Google?", and points at Keep it, the
  button that keeps LaunchPad on.
• From there, one click opens your first new tab.
• If LaunchPad gets switched off by mistake, the page tells you
  how to switch it back on.

Updating from an earlier version changes nothing: the welcome tab
only opens on a fresh install.

A quick tour on your first new tab.

• The first time you open LaunchPad, each example card glows in
  turn, with time to read it. Then Clear examples turns blue: one
  click and the board is yours.

One click to add your favourite sites.

• The Import panel now starts with your most visited sites and ten
  popular ones (YouTube, Gmail, Google Drive, Outlook, WhatsApp,
  ChatGPT, Netflix, LinkedIn, Reddit, Amazon). Click one and it is
  on your board. You stay signed in as usual.
• A nearly empty board shows the same one-click picks on Home until
  you have a few shortcuts. Hide them any time.

Import > Most visited sites now tells you what it added, skips
sites you already have, and adds to your Top Sites group instead
of making a second one.
```

### Listing copy

For Samson to paste into the store DESCRIPTION (not the "What's new" field). It is the one
sentence that reaches people who read the listing before installing:

```
After installing, Chrome asks whether to keep the new tab change. Choose Keep it to use LaunchPad.
```

---

## B. Every commit in the range

From `git log --oneline v2.2.0..<release commit>` at the cut. User-facing commits are marked;
everything else is internal and is listed so the range is complete.

| Commit | What | User-facing |
|---|---|---|
| `67c91fd` | chore: 2.2.0 store assets (listing frames, sidePanel justification) | No, store assets |
| `1e5cb54` | chore: 2.2.0 promo tiles | No, store assets |
| `0e0ef41` | chore: 2.2.0 store icon | No, store assets |
| `46ef03c` | docs: 2.2.0 submitted; the ElevenLabs licence question is closed | No, docs |
| `9092819` | [1.17.0] feat(onboarding): welcome page on install | **Yes, the welcome tab** |
| `bee5616` | test: harnesses close the welcome tab by URL | No, test harnesses |
| `e80ee42` | docs: Round WP, this file, DECISIONS, BUGS I36, CLAUDE.md release state | No, docs |
| `a9bbfc0` | chore: default.webp no longer needs an EXPECTED_UNREFERENCED excuse | No, build tooling |
| `62d761d` | chore: 2.3.0 cut, manifest to 2.3.0 (first cut; its artifact was replaced before upload) | No |
| `ef76356` | chore: 2.3.0 store frames | No, store assets |
| `6ead142` | fix: Most visited sites feedback and no duplicates; welcome copy "may ask" | **Yes** |
| `fb959be` | chore: 2.3.0 re-cut 1 (its artifact was replaced before upload) | No |
| `f76ca9d` | [1.17.1] feat(first-run): the first-open tour on the example cards | **Yes** |
| `2448897` | [1.17.2] feat(import): one click to add, in Import and on a nearly empty Home | **Yes** |
| `6cb5e7a` | docs: DECISIONS for the four items from the first look | No, docs |
| `e164808` | [1.17.1] fix(first-run): the tour slows down (3s per card, 5s group fade) | **Yes** |
| `449fa94` | docs: 2.3.0 takes the tour and one-click add; the slower pace | No, docs |
| the re-cut | chore: 2.3.0 re-cut 2, this table final (THE BUILD COMMIT; its hash is in the tag) | No |

**Shipped files changed since 2.2.0:** `background.js` (one block in onInstalled); `newtab.js`
(importTopSites, the first-open tour replacing the Clear examples pulse, one-click add, one
FAVICON_OVERRIDES entry); `newtab.css` (tour and chip styles); `newtab.html` (the Import panel's
one-click section); `locales/en.js` (13 `welcome_*`, 3 `topsites_*` and 8 one-click messages
added, none existing changed); and the new `welcome.html`,
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

**One-click add** uses the existing `topSites` permission (read locally) and the grid's existing
icon source (Google's favicon service, disclosed under "Website icons"). The Home strip's Hide
is a per-device `chrome.storage.local` key, `quickStartHidden`, which never leaves the device.

**Privacy.** The welcome page makes no network request (asserted over the CDP Network domain,
and statically by `tools/check-welcome.mjs`), reads and writes no storage, and collects
nothing. `privacy-policy.html` needs no change.

---

## D. Behaviour that changes for EXISTING users without them asking

- **The welcome tab: none.** It opens on reason `"install"` only.
- **The first-open tour: none.** It runs only when `promoState.openCount` is 0, which no existing
  user has.
- **Clear examples turns blue** for an existing user who still shows the examples. It was a grey
  pill that pulsed on the first three opens.
- **The Home one-click strip APPEARS for an existing user with fewer than six shortcuts and no
  examples.** It is dismissible with Hide, and it retires by itself at six. This is the one change
  an updating user may notice unprompted.
- **The Import panel** opens with the one-click chips above its four existing options.

The welcome tab's install-only wiring: An update fires
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
