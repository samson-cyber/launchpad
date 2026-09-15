# Release notes - 2.2.0

**Cut 2026-09-15 from `796c3fa`, 132 commits after `v2.1.0` (`15797ad`).** The file
was renamed from `RELEASE-NOTES-NEXT.md` at the moment the build was cut, per its own
instruction and matching the three numbered files beside it.

Same rule as those three: **nothing here describes a feature that is not in the
build.**

**THE "What's new" BLOCK WAS SUBSTANTIALLY INCOMPLETE WHEN THE RELEASE WAS CUT, and
that is worth knowing about this file rather than hiding.** It was written
incrementally across five arcs and covered six topics; the release contains far more
than six. Everything added at cut time was verified against `15797ad` the same way —
a feature is only "new" if a 2.1.0 user did not have it — which is also how two
features were ruled OUT of the notes entirely (see the last section).

---

## PASTE THIS - "What's new" for 2.2.0

Trim to fit the listing. **The first two blocks are the ones every existing user
notices without asking for anything, so they lead.** Everything below them is
additive and can be cut for length.

```
Shortcut icons are bigger and easier to see.

• Every icon now fills much more of its circle, so logos read
  clearly at a glance instead of floating small in the middle.
  Nothing moved: the circles, the spacing and the grid are
  exactly where they were.
• Small, Medium and Large icon sizes all scale together, and
  emoji and lettered icons now grow with the setting like every
  other icon does.

The search bar now defaults to AI Search, with a one-click toggle
back to your default search engine.

• Two tabs sit above the search bar: AI Search and Search.
  AI Search is the one that starts selected.
• Press Enter with AI Search selected and LaunchPad opens
  Google's AI Mode with what you typed already in the box. It is
  a shortcut to google.com - nothing is sent anywhere by
  LaunchPad itself.
• Click Search and Enter goes to your normal search engine again,
  exactly as before. LaunchPad never changes which engine that
  is. Your choice is remembered.

The search bar is also a launcher now.

• Start typing and your own shortcuts, groups and sessions appear
  beneath it. Arrow keys move, Enter opens - no mouse needed.
• Typing an address still just goes there, whichever tab is lit.
• The last row always names where Enter will take you, so nothing
  is guesswork.

A greeting at the top of Home.

• Home opens with the time of day and the date, typed in once a
  day rather than every time you open a tab.
• Click the greeting to cycle through variants. Keep clicking and
  something happens.

LaunchPad in your toolbar, without opening a tab.

• Click the LaunchPad icon for a compact popup: your shortcuts,
  and your focus session with a pause control.
• Keyboard shortcuts for the things you do most - open LaunchPad,
  add the current page, save this window as a session, and pause
  or resume a focus session. Set your own keys in Chrome at
  chrome://extensions/shortcuts.
• Pro: while a focus session runs, the toolbar icon shows the
  minutes left.

A wallpaper that changes, and one per workspace.

• Turn on rotation and LaunchPad picks a different wallpaper
  from its gallery each day, or each hour. Off by default.
• Pro: give any workspace its own wallpaper. Work and Personal
  can look completely different.
• A workspace with its own wallpaper keeps it - rotation carries
  on everywhere else. Settings says so on screen.

Bring your links in from anywhere.

• Paste a list of URLs, or import a file: Chrome/Edge bookmarks
  HTML, Toby, OneTab, Session Buddy and Speed Dial 2 exports.
  LaunchPad works out which one it is - you do not have to say.
• Every import goes into NEW groups. Nothing you already have is
  replaced, merged or deleted, and one click undoes the whole
  import - even after a reload.
• You see exactly what will arrive before it does, including how
  many of the links you already have.
• Imports can also become saved sessions.

Browse your Chrome bookmarks without leaving the new tab.

• A new Bookmarks entry in the sidebar opens your real bookmark
  tree - folders expand, and clicking anything opens it.
• It stays in step with Chrome: add or rename a bookmark and the
  panel updates while it is open.
• Hover any bookmark to add it straight into LaunchPad.
• LaunchPad only ever READS your bookmarks. It never creates,
  moves, renames or deletes anything in them.

Make the grid yours.

• Give any shortcut its own icon - upload one, pick an emoji, or
  use a letter.
• A list view as well as the grid, and a Focus view that clears
  everything except what you are working on.

Group actions no longer hide until you hover.

• "Open All" and the group menu are now always visible on every
  group heading, so opening a whole group in tabs is something
  you can find rather than something you have to discover.
  Nothing moved to make room - those controls always occupied
  that space, they were simply invisible.

Pro: the Dashboard and Insights got a lot more useful.

• Set a daily focus target and watch a ring fill toward it.
• Pick three things for today, and see this week against last.
• A heatmap of the hours you actually focus best.
• Export any date range to CSV, per task and per tag.
```

---

## Context for whoever cuts the release

### The AI Search default changes what Enter does for every existing user

**This is the second entry on this page that ships to everyone with no opt-out,
and it belongs in the notes for the same reason the icon change does.** Before
`[1.12.3]`, Enter in the Home search bar ran `chrome.search.query` - the user's
own default engine. It now opens `www.google.com/search?udm=50&q=<query>` -
Google's AI Mode - unless the user picks the Search tab.

**IT POINTED AT THE GEMINI APP UNTIL 2026-09-15, AND THAT DID NOT WORK.**
`[1.12.3]` shipped `gemini.google.com/app?q=<query>`, and **Gemini accepts no
URL prefill of any kind** - `?q=`, `?prompt=`, `?text=` and a `#fragment` were
each driven, signed in and signed out, and the prompt box came up EMPTY every
time. Pressing Enter opened Gemini with nothing in it. The round that built it
asserted that LaunchPad's own navigation carried the encoded query and never
loaded the page that was supposed to consume it (BUGS.md **P25**).

**Google AI Mode does accept it**, verified in a real signed-in browser: the
query lands in the box and an AI answer comes back. So the destination moved
and the tab was renamed to match. **If this ships before 2.2.0 goes out, the
Gemini behaviour never reached a single user** and the note above is the only
version anyone needs; if 2.1.0 shipped with it, say plainly that the AI tab
opened an empty Gemini and now does not.

**One default, not two.** The 2026-09-12 amendment on the spec task reversed an
earlier ruling that would have given new installs Gemini and left existing users
on Search. The reasoning is recorded there and is worth repeating here: two
defaults is a *permanent* tax - the product behaves differently for two
populations forever, every future round touching the bar reasons about both, and
every support question starts with "which did you install". Against that, the
bar has near-zero usage (Samson uses LaunchPad daily and had never touched it),
so the population whose habit breaks is close to empty. `[1.10.7]` set the
precedent: a deliberate improvement ships for everyone and gets announced.

**How the default reaches existing users at all** is worth knowing, because it
was built one round earlier on purpose. `[1.12.2]` stored the tab choice at
`data.settings.searchMode` and **deliberately never wrote a value at boot** - an
absent key means *has not chosen*. So every profile that never touched the tabs
still has no key, and `[1.12.3]` only had to invert the read: the exact string
`"search"` selects Search, and everything else - including absent - is the AI
tab. A user who clicked Search in `[1.12.2]` keeps Search. **The same inverted
test carried the 2026-09-15 rename for free**: a profile storing the old
`"gemini"` token is not the exact string `"search"`, so it resolves to the AI
tab with nothing written and no migration to run.

### Describe it as a shortcut to Google AI Mode, NOT as a search engine option

**This listing has been rejected once over a search control visible in a
screenshot, so the framing is not cosmetic.** The single-purpose policy targets
extensions that HIJACK search - silently redirecting the omnibox, or changing
the default engine without consent. This does neither:

- It is **an ordinary navigation** to `www.google.com/search?udm=50&q=`, exactly
  what a Google shortcut in the grid would be with the query appended. No API,
  no key, no new permission, and **no network call from the extension**. The
  permission set is byte-identical to the packaged 2.1.0 build.
- It **never touches the user's default search engine.** The Search tab still
  goes through `chrome.search.query`, which is precisely the API that respects
  that setting - and is why this product has no engine picker and is not
  gaining one.
- It is **user-initiated and visible**: two labelled tabs, one click apart, and
  the row at the bottom of the suggestion list names the destination before the
  user presses Enter.

Wording for the listing should follow that: *a shortcut to Google's AI search
from the search bar*, with the toggle back to your own search engine mentioned
in the same breath. Do not write "choose your search engine", and do not write
"Gemini" - the destination is Google AI Mode and naming the wrong product in a
store listing is the kind of discrepancy a reviewer can check.

### The icon change affects everyone, and there is no opt-out

**This is the entry on this page that most needs to be in the notes.**
`[1.10.7]` raised the icon fill ratio from about a quarter of the circle's area
to roughly 71% of its width — `--icon-inner` went 24px to 34px at the default
tier, 20 to 26 at Small and 28 to 40 at Large. Circles are untouched at
36 / 48 / 56, and the grid's column count, every tile position and the total
grid height were measured identical before and after.

But **every existing user gets the new size on update, with no setting to turn
it off.** Every round of the `[1.10.x]` arc before it shipped its feature off or
at today's default, so this is the one change in the arc that a returning user
will notice without having asked for anything. It should not arrive unannounced,
which is why it leads the block above.

Two known limits, both worth knowing before anyone answers a support mail:

- **Some sites publish a logo with whitespace baked into the image.** Those
  render smaller inside the same box than a logo that bleeds to its edges, and
  raising the fill ratio makes that difference more visible rather than less.
  Measured across six real favicons the spread was small — 96.1% to 100% of the
  box — but the fixture contained no heavily padded example, so this is a real
  possibility that simply did not reproduce in testing.
- **Requesting a larger favicon cannot create detail a site does not publish.**
  The Google S2 request went from `sz=128` to `sz=256` for HiDPI headroom, but a
  site that only ships a 16px or 32px icon returns a soft image at any size.

### The group controls were already taking up their space

`[1.10.10]` made `Open All` and the group `...` menu permanent. They had been at
`opacity: 0`, revealed on `.group-header:hover` — and because `opacity` is not a
layout property, **the header height, every first-tile position and the total
grid height are byte-identical before and after**. There is no density cost to
warn anyone about; the only change is ink.

Two things worth knowing if this comes up:

- It also closes a keyboard defect nobody reported. An `opacity: 0` button is
  still in the tab order, so a keyboard user has always been able to land on
  these controls while they were invisible.
- The same round found that neither control had a light-wallpaper ink rule, so
  on a pale wallpaper they rested at 2.80:1 and 2.31:1. That was survivable
  while they only appeared under the pointer; it is not survivable for a control
  that is always on screen, so both now rest at 4.8:1 and 3.4:1.

### The alignment bug was real, and it only ever affected Pro users with an active task

`[1.10.11]` found it after three rounds of measuring the wrong page. The docked
active-task card reserves a 300px lane so content does not slide under it, and
that reserve sat on `.tab-panel` - which centres the clock, the search bar and
the grid, but **not** the logo and tab bar, because the header is a sibling of
the panel rather than a child. The result was Home's header sitting **150px** to
the right of Home's content, on any Pro profile with an active task selected,
whenever the card was expanded.

The reserve now sits on `#content`, which contains the header *and* all four
panels, so the whole column re-centres together in the space the card leaves.
Clearance from the card is unchanged at 62px, measured at 1280, 1659 and 1920.

`[1.10.12]` then fixed the movement itself, which had been half-broken since
2.0.0: the transition was declared **inside** the `body.sat-card-open` rule, so
it only existed while the class did. The column animated open and snapped shut -
9 interpolated frames one way, zero the other. The declaration moved to
`#content`'s base rule, where it survives the class going away, and both
directions now run the same 200ms slide. It also gained the
`prefers-reduced-motion` fallback it never had.

If a user asks why this was never noticed: every test fixture read "No active
task", so the class that applies the reserve was never set. It is worth a line
in the notes only if the release is thin - the users who saw it are Pro users who
keep an active task running, and to them it will read as the page finally
lining up.

### The bookmarks panel needs no new permission, and that was checked first

`bookmarks` has been in the manifest since long before this, held so the
one-shot importer could read the tree. The panel reads the same tree, so **the
permission diff against the packaged `v2.1.0` build is empty** - no new install
warning on anyone's update. That was verified as the first act of `[1.11.1]`,
because if it had NOT been held the whole item needed re-deciding rather than
quietly shipping a warning.

Worth having ready if anyone asks: **the read is one-way and enforced.**
`tools/check-bookmarks-readonly.mjs` fails the build if any shipped file calls
`create`, `remove`, `removeTree`, `move` or `update` on `chrome.bookmarks`,
including through dynamic member access.

Performance, measured rather than hoped: opening the panel took 65ms at 100
bookmarks, 82ms at 1,000 and 73ms at 3,000, because only expanded folders render
their children. Expanding one folder holding all 3,000 took 236ms.

### Import: what was measured, and what is honestly unverified

**Storage.** The fear going in was that a large import would reach the 10 MB
`chrome.storage.local` ceiling. Measured on a realistic used profile, it does not
come close: an imported shortcut costs **~236 bytes**, so a 400-bookmark Toby
export is **0.9%** of the quota and a 1,000-line OneTab dump is **2.27%**. The
headroom is roughly **44,000 shortcuts**. The thing that actually threatens that
quota is base64 image data, which `[1.10.2]` measured at 200 icons for 89.6%.

The refusal still exists, because a write that exceeds the quota throws *after*
the caller has mutated its data and the value then reads back absent - an import
that discovered that second would have silently dropped someone's bookmarks. It
projects the serialised size and refuses before writing anything. It is a guard
against pathological input, not against a normal export.

**Formats.** Real export files could not be obtained for four of the six.
Bookmarks HTML is a published standard and was exercised against a structurally
faithful file; Toby, OneTab, Session Buddy and Speed Dial 2 were built from their
documented shapes. **If a support question ever arrives about one of those four,
ask for the file** - it is the thing that has never been seen. Underneath the
brand-specific readers is a generic extractor that finds links in any JSON or
text, so a format that has drifted still imports its links and only loses the
grouping.

**Safety.** Only `http` and `https` survive an import. Bookmark exports really do
contain `javascript:` bookmarklets, and one of those in a tile would run in the
extension's own page.

### Wallpaper: why rotation uses the gallery, and what it costs

Measured before it was built, on a realistic used profile:

- **One uploaded wallpaper costs ~1.08 MB stored** - 10.6% of the 10 MB browser
  quota. Uploads are already capped at 1920px wide and JPEG-encoded, and that is
  what is left after the cap.
- **One gallery pick costs 67 bytes**, because it stores the Unsplash URL rather
  than the picture. That is over 16,000 times cheaper.
- **Four per-workspace uploads would be 42% of the quota.** Seven rotating
  uploads would be 74%, and twelve would be 127% - past the ceiling entirely.

So **rotation stores no images at all.** It stores a mode, and the picture is
derived from the date against the bundled gallery. Nothing accumulates, there is
no index to drift, and every tab agrees without syncing.

**That means rotation uses the disclosed Unsplash path** - the same one picking a
gallery wallpaper already uses today. It adds no new destination and no new
disclosure; it makes an existing one recur. Anyone who never turns rotation on
never touches it, which is why it ships off.

**Per-workspace wallpapers refuse before they write.** Four uploads is 42% of the
quota and the wallpaper writer was found to fail *silently* at the ceiling, so a
per-workspace write now projects its own size first and says no rather than
losing the picture quietly.

**No backup format changed.** The wallpaper key now holds a richer value, but the
backup envelope carries that key verbatim and never looks inside it, so v1 and v2
backups both still restore - proven by importing a real file of each.

### Free versus Pro: nothing moved across the line in this release

**Notes are Pro, and they stayed Pro.** `[1.11.4]` built ONE FREE SCRATCHPAD NOTE on
Home and `b3efbf0` cut it before any release carried it, so the free/Pro boundary is
exactly where 2.1.0 left it. Nothing in this release moves a feature from Pro to free
or back, and the notes above must not imply otherwise.

What is Pro in the list above, and it is marked as such in the copy: **per-workspace
wallpaper**, **the toolbar badge** (it counts a focus session, which is tracking), and
**the Dashboard and Insights block**. Everything else in the list is free — the
launcher, the greeting, the popup itself, wallpaper rotation, imports, the bookmarks
panel, custom icons, list and Focus views, and the group controls.

### A running focus session keeps the service worker awake, and that is by design

`[1.9.2]` measured this rather than reading it from the docs, and it is worth knowing
before anyone answers a question about battery or memory. **While a focus session is
counting down, the 30-second badge alarm wakes the service worker, so it does not
sleep.** Proven alive across 60s of no other activity with the badge ticking on wall
clock.

**It is bounded, and the bound is the point.** The alarm is CLEARED whenever the badge
is not counting down, so a paused session and an absent session wake nothing. A free
profile never paints the badge at all, so it never holds the worker open.

The same measurement found the other half: with the alarm cleared by hand Chrome
suspends the worker after ~30s and **retains the painted badge text**, so a badge
cannot self-clear. That is why the repaint is wired to `onStartup` — a browser killed
mid-session leaves a stale number that the next launch corrects.

### Not in the notes, deliberately

- **The clock line.** `[1.10.2]` added an optional clock, date and greeting line
  with three separate toggles; `[1.11.3c]` removed all three and `[1.11.x]` replaced
  the idea with the greeting that now leads Home. Both the addition and the removal
  land INSIDE this release window, so **no shipped build ever carried the clock
  line** and there is nothing for a user to be told about its removal. The greeting
  that replaced it IS in the notes above, because that part is visible.
- **The search-bar resting pulse.** `[1.12.4]` built it and `f066338` cut it four
  commits later, on the same round's own measurements. Never shipped.
- **The frosted surface behind Home's bare text.** `81fb511` built it, Samson saw it
  on a real photograph and rejected it, and `980420c` reverted it byte-for-byte the
  same day. Never shipped.
- **The accent picker.** `[1.10.4]` added a Settings > Appearance > Accent row
  with four colours; `[1.10.8]` removed it. It landed after the `v2.1.0`
  submission and **no release ever carried it**, so there is nothing for a user
  to be told — they never had it. The `--accent` token itself is unchanged and
  every surface that reads it still renders the same blue.
- **The alignment fix** (`[1.10.4]`) and the **one-shortcut-identity fix**
  (`[1.10.6]`) are corrections to behaviour users never saw working differently
  in a shipped build, or that only appear in states they are unlikely to have
  hit. Include them only if the release is otherwise thin.
