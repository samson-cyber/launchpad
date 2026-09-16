# Firefox Port - Assessment

**Written 2026-09-16 (PF.5, Asana 1218038783305055). Measured against LaunchPad at
`e8b1a10`, manifest version `2.2.0`.**

> **THIS DOCUMENT DESCRIBES FIREFOX AS OF 2026-09-16 AND WILL GO STALE.** Firefox's MV3
> story has moved every year since 2022 and two of the gaps below are open Mozilla bugs
> with no landed fix, which means they can close without anyone here noticing. Every
> compatibility claim carries the MDN page it came from so a future reader can re-check
> the claim rather than trust this summary. **If this document is more than six months
> old, re-read the citations before acting on the recommendation.**

> **THIS IS A RESEARCH ROUND AND IT BUILDS NOTHING.** Per the PLAN's decision H it
> produces a costed assessment and a recommendation. The decision is Samson's, and the
> task's own sequencing puts it after Edge has proved a second store is worth having -
> which has not happened, because Edge has not shipped.

---

## 1. Method, and what would make this assessment wrong

Three sources, in descending authority:

1. **The code.** Every API count below is a measured `grep` over the files `build.sh`
   actually ships, not an estimate. `tools/` and `docs/` are excluded: a port does not
   have to carry a test harness into the zip.
2. **MDN's per-API pages**, cited inline. MDN's aggregate "Browser support for
   JavaScript APIs" table renders its compatibility data client-side and could not be
   read as text, so each claim is taken from the individual API page instead, which
   states support in prose.
3. **Mozilla's Extension Workshop** for store policy.

**What would make this wrong:** MDN documents the API, not the shipped build. Two
claims below (the CSP, and AMO's treatment of a vendored minified library) are
policy-adjacent and are settled by a **validator or a reviewer**, not by a doc page.
Both are marked as needing a real submission to settle, and neither is load-bearing
for the recommendation.

---

## 2. The port's surface, measured

**345 `chrome.*` call sites across 19 namespaces in 12 shipped files.**

| Namespace | Calls | Files | Members used |
| --- | ---: | ---: | --- |
| `storage` | 100 | 7 | `local` 63, `onChanged` 16, `session` 8 |
| `tabs` | 63 | 5 | `create` 13, `update` 11, `query` 10, `onUpdated` 10, `remove` 5, `getCurrent` 3, `sendMessage` 2, `onRemoved` 2, `get` 2, `onCreated`/`onReplaced`/`onActivated` 1 each |
| `runtime` | 48 | 10 | `lastError` 10, `getURL` 10, `getManifest` 9, `onMessage` 5, `getContexts` 4, `sendMessage` 3, `onStartup` 2, `getPlatformInfo` 2, `onInstalled` 1 |
| `alarms` | 34 | 3 | `create` 15, `clear` 7, `get` 5, `onAlarm` 1 |
| `permissions` | 13 | 2 | `contains` 5, `request` 3 |
| `windows` | 12 | 3 | `create` 3, `update` 2, `onRemoved`/`onFocusChanged`/`getCurrent`/`getLastFocused` 1 each |
| `notifications` | 11 | 1 | `create` 3, **`onButtonClicked` 2**, `clear` 1 |
| `contextMenus` | 8 | 1 | `create` 5, `removeAll` 1, `onClicked` 1 |
| `idle` | 8 | 3 | `setDetectionInterval` 3, `onStateChanged` 2, `queryState` 2 |
| `i18n` | 7 | 1 | `getUILanguage` 2 |
| `downloads` | 5 | 3 | `download` 3 |
| **`offscreen`** | **5** | **1** | `closeDocument` 2, `createDocument` 1 |
| `webNavigation` | 5 | 1 | `onBeforeNavigate`, `onHistoryStateUpdated`, `onReferenceFragmentUpdated` |
| `bookmarks` | 5 | 2 | `getTree` 3 |
| `action` | 4 | 1 | `setBadgeTextColor` 2, `setBadgeText` 1, `setBadgeBackgroundColor` 1 |
| `commands` | 4 | 1 | `onCommand` 2 |
| `search` | 4 | 2 | `query` 4 |
| `topSites` | 4 | 1 | `get` 2 |
| `history` | 4 | 1 | `search` 2 |
| `sessions` | 1 | 1 | - |

By file: `background.js` 158, `newtab.js` 95, `storage.js` 37, `tracking.js` 16,
`companion.js` 10, `i18n.js` 10, `gate.js` 8, `locales/en.js` 5, `license.js` 2,
`offscreen.js` 2, `bookmarks.js` 1, `pro-access.js` 1.

**TWO THINGS THE BRIEF'S API LIST DID NOT NAME, and both matter.**

- **`chrome.permissions` (13), `chrome.windows` (12), `chrome.commands` (4),
  `chrome.i18n` (7) and `chrome.sessions` (1) are all in the surface** and were not on
  the list to assess. All five are supported in Firefox, so none changes the answer -
  but a port plan built from the brief's list alone would have been 37 call sites short.
- **`chrome.sidePanel` HAS ZERO CALL SITES.** The `sidePanel` permission and the
  `side_panel` key are declared in `manifest.json`, and no JavaScript ever calls the
  API: the panel is opened from Chrome's own browser UI against `side_panel.default_path`.
  That makes the sidebar port **materially cheaper than the brief assumed** - see §5.3.

---

## 3. `manifest.json`, key by key

| Key / value | Firefox MV3 | Note |
| --- | --- | --- |
| `manifest_version: 3` | Supported | |
| `name` / `description` via `__MSG_*` | Supported | `default_locale` present, as required |
| `version: "2.2.0"` | Supported | AMO version strings are more permissive, not less |
| `permissions` | see §4 | one entry is Chrome-only |
| `optional_permissions` | Supported | |
| `host_permissions` | Supported | |
| `content_security_policy.extension_pages` | **needs a validator run** | §5.8 |
| `chrome_url_overrides.newtab` | Supported, **with a user consent prompt** | §5.7 |
| `background.service_worker` | **NOT SUPPORTED** | §5.5 - the one structural change |
| `side_panel` | **NOT SUPPORTED** - Firefox uses `sidebar_action` | §5.3 |
| `action` + `default_popup` | Supported | |
| `commands` | Supported | |
| `icons` | Supported | |
| `minimum_chrome_version` | Ignored by Firefox | harmless; Firefox uses `browser_specific_settings.gecko.strict_min_version` |
| **`browser_specific_settings`** | **MISSING, and required** | §5.4 - `storage.sync` does not work without it |

---

## 4. The permission list

`["storage", "bookmarks", "contextMenus", "history", "topSites", "tabs", "webNavigation", "alarms", "search", "idle", "offscreen", "sidePanel"]`

**Ten of twelve are supported in Firefox unchanged.** The two that are not are
`offscreen` and `sidePanel`, and both are covered below. `optional_permissions`
(`notifications`, `downloads`) are both supported, with one method gap in
`notifications` (§5.6).

---

## 5. Subsystem assessment

Each entry states WHAT BREAKS, WHAT THE PORT NEEDS, and a COST IN ROUNDS.

### 5.1 `chrome.offscreen` - the chime with no tab open

**WHAT BREAKS - and it is much less than it looks.** MDN's WebExtensions API index
lists 52 namespaces and **`offscreen` is not among them**
([MDN: JavaScript APIs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)).
Firefox has no equivalent.

But the code already handles its absence. `background.js:989` opens with:

```js
if (!chrome.offscreen || !chrome.runtime.getContexts) return false;
```

and `closeSoundOffscreen` guards the same way. The chime's router,
`firePomodoroSound`, tries a **page-message to an open LaunchPad tab first** and only
falls through to the offscreen document when no tab is open or the tab declines. So on
Firefox today the behaviour would be: **the chime plays normally whenever a LaunchPad
tab is open, and is silently skipped when none is.** No throw, no console error, no
broken feature - one degraded edge case.

**WHAT THE PORT NEEDS.** Firefox's background context is an **event page**, which is a
real DOM document and can therefore hold an `<audio>` element directly - the thing a
Chrome service worker cannot do and the entire reason `chrome.offscreen` exists. So
`playSoundViaOffscreen` gains a Firefox branch that plays in the background page
itself, and the offscreen document is simply never created. The shared pure function
that chooses the route (`Storage.pomodoroSoundTarget`) does not change; it gains a
fourth target value.

**COST: 1 round.** Small, well-isolated, and the existing feature detection means the
un-ported state is degraded rather than broken - so this could even ship in a later
round than the rest.

### 5.2 `chrome.search.query` - THE BRIEF EXPECTED A COST AND THERE IS NONE

**WHAT BREAKS: nothing.** The brief anticipated "different semantics". Measured, the
product has **one** call site:

```js
chrome.search.query({ text: query, disposition: newTab ? "NEW_TAB" : "CURRENT_TAB" });
```

Firefox's `search.query` takes `text` (required) and an optional `disposition` whose
valid values are `CURRENT_TAB`, `NEW_TAB` and `NEW_WINDOW`, and it requires the
`"search"` manifest permission - which the product already declares
([MDN: search.query](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/search/query)).
The call is **character-for-character valid on Firefox**.

The one documented difference is that Firefox's version has **no `engine` parameter**
for naming a specific search engine. The product does not use one - and could not, since
`chrome.search` was deliberately reduced in v1.0.2 to "use the user's default engine, no
picker" for a Chrome Web Store single-purpose policy. That old constraint makes this
port free.

**COST: 0 rounds.**

### 5.3 The side panel - cheaper than the brief assumed

**WHAT BREAKS.** Firefox has no `sidePanel` API and no `side_panel` manifest key; it
uses `sidebar_action` and the `sidebarAction` API. MDN is explicit that these are not
interchangeable:

> "Chrome provides support for sidebars through the `sidePanel` API. **This API is not
> compatible with `sidebarAction`.**"
> ([MDN: sidebarAction](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/sidebarAction))

**WHAT THE PORT NEEDS - and this is where PF.1's design pays.** The product calls
**zero** `chrome.sidePanel` methods; the panel exists entirely as a manifest key
pointing at `side-panel.html`. And `companion.js` was built for exactly this:

```js
// TWO MOUNT POINTS. The popup now, the side panel in [1.16.0]. That is why
// mount() takes its container as an argument
function mount(container, opts) { ... }
```

So the Firefox sidebar is a **third call to an existing `mount()`**, against a
`sidebar_action.default_panel` HTML file that is a near-copy of `side-panel.html`. No
API shim, because there is no API being called.

The one real loss: Firefox has not implemented `setBadgeText`, `getBadgeText`,
`setBadgeBackgroundColor`, `getBadgeBackgroundColor`, `onFocus` or `onBlur` on
`sidebarAction` (same MDN page). The product does not use any of them **on the sidebar**
- its badge calls are `chrome.action.*`, which is a different namespace and is supported.

**COST: 1 round.**

### 5.4 `chrome.storage.sync` - the sentence the privacy policy needs, and a missing manifest key

**WHAT BREAKS.** `storage.sync` is supported in Firefox, with **identical quotas** to
Chrome's - 102400 bytes total, 8192 per item, 512 items
([MDN: storage.sync](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync)).
Three Firefox-specific facts, and the first is a hard blocker:

1. **It does not work at all without an add-on ID.** MDN: *"The implementation of
   `storage.sync` in Firefox relies on the Add-on ID. If you use `storage.sync`, you
   must set an ID for your extension using the `browser_specific_settings`
   manifest.json key."* **`manifest.json` has no `browser_specific_settings` key.**
2. **The user must opt in.** *"a user must have `Add-ons` selected in the 'Sync' section
   in `about:preferences`"* - so sync can silently do nothing on a correctly built
   extension, which is a support burden Chrome does not have.
3. **Firefox for Android does not sync at all.** *"Firefox for Android does not
   synchronize data with the user's account."*

**THE POLICY CONSEQUENCE, AND IT IS THE REAL ONE.** Data syncs to **Mozilla's** servers
under the user's Mozilla account, not Google's. The published privacy policy's "No data
ever leaves your device" claim is already strained by Dodo Payments and by Chrome's
`storage.sync`; a Firefox build adds a **second** third-party destination with a
different operator and a different jurisdiction. The policy would need a Firefox
sentence naming Mozilla explicitly - not a rewording of the Chrome one.

**Note on sequencing:** `storage.sync` is **not in the tree at `e8b1a10`** - PF.2 is
building it in a parallel session as this is written. So the numbers above describe what
PF.2 will land, not what exists. Re-check before acting.

**COST: 1 round** for the manifest key and the two behavioural guards (unsynced-user,
Android), **plus a policy edit that is Samson's to write, not a round.**

### 5.5 The background context - the one structural change

**WHAT BREAKS.** `background.service_worker` is the only way this product declares its
background, and MDN is unambiguous:

> "`background.service_worker` is not supported (see [Firefox bug 1573659](https://bugzil.la/1573659))."
> ([MDN: manifest background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background))

Firefox MV3 uses an **event page** - a non-persistent background page that unloads when
idle and reloads to serve its listeners.

**WHAT THE PORT NEEDS, and it is smaller than "rewrite the worker".** MDN gives the
cross-browser shape explicitly, and **the same file serves both**:

```json
"background": {
  "scripts": ["background.js"],
  "service_worker": "background.js"
}
```

> "To support browsers with different Manifest V3 background script implementations,
> specify both `scripts` and `service_worker` in the `background` key."

Since Firefox 121 the background page starts regardless of `service_worker` being
present (Firefox bug 1860304), so one manifest carries both browsers.

**THE REAL WORK IS NOT THE KEY, IT IS THE ASSUMPTIONS.** `background.js` is 158
`chrome.*` call sites written against a worker that has no DOM and no persistent state.
An event page has a DOM (which §5.1 exploits) and the same non-persistence, so the
product's existing discipline - everything through `chrome.storage`, nothing held in
module scope across wakes, `enqueueBgData` serialising every `data` write - **transfers
unchanged and is exactly what makes this cheap.** A product that kept state in worker
globals would be facing a rewrite here; this one is not.

Two specifics to verify rather than assume: `chrome.runtime.onStartup` (2 sites) and
`chrome.runtime.getContexts` (4 sites, all in the offscreen path being replaced anyway).

**COST: 1 round**, most of it verification rather than editing.

### 5.6 The rest of the API surface

| API | Firefox | Action needed |
| --- | --- | --- |
| `storage.local` / `onChanged` / `session` | Supported | none |
| `tabs` (13 members) | Supported | none |
| `runtime` | Supported | `getContexts` only used in the offscreen path |
| `alarms` | Supported | none |
| `permissions` | Supported | none |
| `windows` | Supported | none |
| `contextMenus` | Supported (Firefox also exposes it as `menus`) | none |
| `bookmarks` | Supported | none |
| `history` | Supported | none |
| `topSites` | Supported | none |
| `idle` | Supported | none |
| `webNavigation` | Supported | none - see §5.9 |
| `downloads` | Supported | none |
| `action` | Supported | none |
| `commands` | Supported | none |
| `i18n` | Supported | none |
| `sessions` | Supported | none |
| **`notifications.onButtonClicked`** | **NOT SUPPORTED** | **a real break - below** |

**`notifications.onButtonClicked` is the one silent break in this table.** MDN:

> "at the time of writing, Firefox doesn't support the notification function method
> `onButtonClicked`, while Firefox is the only browser that supports `onShown`."
> ([MDN: Differences between API implementations](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Differences_between_API_implementations))

The product has **2 call sites**, in `background.js`. This is the dangerous kind of
gap: registering a listener for an unsupported event does not throw, so the buttons
render (or do not) and clicking them does nothing. Whatever those two buttons do needs
a non-button route on Firefox - clicking the notification body, most likely.

**COST: folded into §5.1's round** - same file, same subsystem, same verification pass.

### 5.7 The new-tab override

**WHAT BREAKS: nothing functional.** `chrome_url_overrides.newtab` is supported
([MDN: chrome_url_overrides](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_url_overrides)).

**WHAT DIFFERS: Firefox asks the user's permission, and Chrome does not.** Mozilla's
support documentation states that when an extension takes over the New Tab page,
*Firefox will ask you when you open it for the first time if that change is okay*, and
the Home settings then name the extension with a **"Disable Extension"** button
([Mozilla Support: An extension changed my New Tab page or home page](https://support.mozilla.org/en-US/kb/extension-changed-my-new-tab-page)).

That is a **product** consequence, not an engineering one, and it is the single most
under-rated line in this document: **LaunchPad's entire value proposition is the new-tab
page, and on Firefox the first thing a new install does is show a dialog offering to
turn it off.** Chrome has no such prompt. A first-run experience that opens with "is
this okay?" converts worse than one that just works, and no amount of porting removes it.

**COST: 0 rounds of engineering; a first-run copy decision, and an unknown conversion cost.**

### 5.8 The Content Security Policy - unsettled, and settled by a validator

The product ships:

```
script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https:; font-src 'self';
```

MDN states that in MV3 the `script-src` and `worker-src` directives *"may only have
these values: `'self'`, `'none'`, `'wasm-unsafe-eval'`"* and that *"all CSP sources that
refer to external or non-static content are forbidden in CSP directives covering script
content"*
([MDN: content_security_policy](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy)).

The product's `script-src 'self'` satisfies that. **What the page does not settle is
`style-src 'unsafe-inline'`** - the restriction is written as scoped to script-covering
directives, but the page also shows `'unsafe-inline'` in an invalid example without
naming which directive it was in.

**I am not going to guess.** The authority here is the AMO validator, not a doc page,
and the cost of finding out is one upload of a build nobody has to publish. **This is
the first thing to test if the port ever starts**, because a CSP rejection is cheap to
discover and expensive to discover late. The product uses inline `style=` attributes in
generated markup extensively (chip fills, progress widths, ring offsets), so a genuine
`style-src` restriction would be a much larger change than anything else in this
document - which is exactly why it should be settled first and not assumed.

**COST: unknown until tested. Bounded at "one throwaway upload" to find out.**

### 5.9 The Dodo checkout return

`webNavigation` is supported, and the product uses three of its events
(`onBeforeNavigate`, `onHistoryStateUpdated`, `onReferenceFragmentUpdated`) to catch the
return from Dodo's hosted checkout against `https://mylaunchpad.me/checkout-return`,
with or without `.html`. The `host_permissions` entries are supported. Nothing in the
matcher is Chrome-specific.

The coupling worth naming is the one `CLAUDE.md` already records: the website serves that
route through Cloudflare clean-URL routing, and a routing change can break auto-activation.
**A Firefox build doubles the surface on which that coupling has to be verified**, and it
touches real money, so it cannot be verified by anyone without the Dodo account.

**COST: 0 rounds of code; 1 credentialed manual check per release, forever.**

---

## 6. The store: AMO versus the Chrome Web Store

**Source-code submission.** AMO requires a source upload when an add-on uses
*"code minifiers"*, *"tools that generate a single file from other files"*, template
engines, or *"any other custom tool that takes files, applies pre-processing, and
generates file(s) to include in the extension"*, and the submission must carry a README
naming the OS, tool versions, and *"a list of all the commands to generate an identical
copy of the extension from the source code"*
([Extension Workshop: Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)).

**LaunchPad has no build pipeline** - vanilla JS, direct file edit, and `build.sh` only
zips the tree. So the policy's trigger, which is about *your build process*, does not
obviously fire. The ambiguity is `lib/Sortable.min.js`: 44137 bytes of pre-minified
third-party code (Sortable 1.15.0, MIT), vendored as-is and never processed here.

**The cheap answer is to remove the question rather than argue it:** ship the
**non-minified** `Sortable.js`. It costs about 60KB in the zip, it is the same MIT
library, and it converts a reviewer judgement call into a non-event. I would do that
regardless of whether the port happens, because it also makes the Chrome package easier
to audit.

**Other AMO differences worth pricing:**

- **Human review.** AMO reviews can request changes and correspond with the developer;
  the CWS is largely automated with an opaque appeal. Different failure mode, not
  obviously worse, but it is a second review queue to satisfy per release.
- **Two listings to maintain forever** - screenshots, descriptions, changelogs, and
  the privacy disclosures, which now differ between the two (Mozilla sync versus Google
  sync). This is the cost that does not appear in any round estimate.
- **The reverse direction:** AMO permits things the CWS does not, none of which this
  product wants. The `chrome.search` reduction forced in v1.0.2 by the CWS
  single-purpose policy would not have been required on AMO - but undoing it now would
  mean two different search behaviours to maintain, which is worse than the limitation.

---

## 7. The business case, stated rather than argued

**Firefox's desktop share is somewhere between 3.8% and 7.6%, and the sources
disagree by a factor of two.** StatCounter-derived figures collected 2026-09-16 range
from 3.79% (May 2026) to 4.05% to 7.59% (August 2026, matched 28-day windows), with
mobile share around 0.6%. The spread reflects different windows and methodologies rather
than real volatility, and **the direction of travel is downward in every one of them**
([Firefox market share, Sept 2026](https://technologychecker.io/blog/firefox-market-share),
[Browser market share 2026](https://backlinko.com/browser-market-share)).

I am not going to pretend to a precision the sources do not have. **Call it 4-7% of
desktop, shrinking.**

**What a second store has earned so far: nothing, because Edge has not shipped.** That
is the number that matters most and it is zero - not zero installs, but zero evidence
either way. The hypothesis "a second store is worth the maintenance" is **untested**,
and Edge is the cheap way to test it: Chromium, the same MV3 APIs, the same
`browser-launch.mjs` harness, the same artifact. Firefox is the expensive way to test
the same hypothesis.

**THE COST THAT DOES NOT APPEAR IN THE ROUND ESTIMATE, and it is the largest one.**
The 22 build gates, `tools/pixel-contrast.mjs`, `tools/browser-launch.mjs` and every CDP
harness in `tools/` are built on Chromium - `--load-extension`, `--remote-debugging-port`,
CDP. **None of that drives Firefox**, which needs `web-ext` and the Remote Debugging
Protocol instead. A Firefox build therefore means either:

- verifying Firefox by hand, forever, which is exactly the practice this codebase has
  spent a fortnight replacing with measurement; or
- **porting the harness as well as the product** - a second browser launcher, a second
  screenshot path, and the four-ground ink measurement re-established on Gecko's
  compositor, whose `backdrop-filter` rendering is its own unknown.

That is not a round. That is an ongoing tax on every future round, on a product with one
developer.

---

## 8. Cost summary

| Work | Rounds |
| --- | ---: |
| Manifest: `background.scripts`, `browser_specific_settings`, `sidebar_action`, drop `offscreen`/`sidePanel` | 1 |
| Background as an event page - verify the 158 call sites, `onStartup`, non-persistence | 1 |
| Chime: event-page audio replacing the offscreen document, plus `notifications.onButtonClicked` | 1 |
| Sidebar: third `mount()` against `sidebar_action` | 1 |
| `storage.sync`: Firefox ID, unsynced-user and Android guards | 1 |
| AMO submission: listing, source question, first review cycle | 1 |
| **Port subtotal** | **6** |
| CSP: unknown until a validator sees it; bounded at one throwaway upload | 0-? |
| **Harness: a second browser in `tools/`** | **2-4, and never finished** |

**Six rounds to a Firefox build that works. The harness is what makes it eight to ten,
and the maintenance is permanent.**

Against that: `search.query` costs nothing, the sidebar is one round instead of several
because PF.1 designed for it, and the background port is cheap because the product
already treats its worker as stateless. **The port is not hard. The second platform is
expensive.** Those are different sentences and only the second one should drive the
decision.

---

## 9. Recommendation

**DO NOT BUILD NOW. BUILD AFTER EDGE REPORTS, AND ONLY IF EDGE SHOWS A SECOND STORE
EARNS ITS UPKEEP.**

The reasoning, in order:

1. **The hypothesis under test is "a second store is worth maintaining", and Edge tests
   it for almost nothing.** Edge is Chromium: same APIs, same manifest, same artifact,
   same harness, no port. If a second listing does not earn installs on the platform
   that costs nothing, it will not earn them on the one that costs eight rounds and a
   permanent tax.
2. **The task's own sequencing already says this**, and nothing found in this assessment
   contradicts it. Edge has not shipped, so the precondition is simply not met.
3. **The engineering is genuinely affordable and that is not the problem.** Six rounds
   is a real but ordinary number. The problem is the ninth round and every round after
   it, where a solo developer verifies two browsers instead of one, on a harness that
   currently drives only one.
4. **4-7% of desktop and falling** does not, on its own, justify doubling the
   verification surface of a product whose whole recent effort has gone into making
   verification trustworthy.

**What would change my answer.** Any one of these, and I would revisit:

- Edge ships and a second store measurably earns installs.
- A specific user asks for it - one real request from a paying user outweighs the
  share statistics, because the statistics measure browsers and the request measures demand.
- The harness gets ported for another reason, making the marginal cost of Firefox small.
- Mozilla lands `offscreen` or a `sidePanel` shim, shrinking the port further. Both are
  worth re-checking annually; this document's citations are how.

**Two things worth doing now, regardless, because they are cheap and useful either way:**

1. **Ship the unminified `Sortable.js`.** Removes the AMO source-code question before it
   is ever asked, and makes the Chrome package easier to audit today.
2. **Add `browser_specific_settings.gecko.id` when PF.2 lands `storage.sync`.** It is
   inert on Chrome, and without it a Firefox build's sync silently does nothing. Adding
   it now costs one line; adding it later means a migration, because the add-on ID is
   what Firefox keys the synced data to.

---

## 10. What this document does not cover

- **Firefox for Android**, beyond noting that `storage.sync` does not work there. The
  product is a new-tab replacement and the mobile story is a different product decision.
- **Performance on Gecko.** Not measurable without building.
- **Whether the ink measurements hold on Gecko's compositor.** `backdrop-filter`
  rendering differs between engines, and the four-ground ink work is Chromium-measured
  throughout. This is a real unknown and it belongs to the harness cost in §7.
- **Dodo Payments' behaviour in Firefox**, which needs the live account.
