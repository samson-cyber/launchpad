# Release notes - NEXT

**The next Chrome Web Store submission, unnumbered until it is cut.** Renamed to
`RELEASE-NOTES-<version>.md` at the moment the build is cut, which is also the only
moment the manifest is bumped - the four numbered files beside this one each began
here.

Same rule as those four: **nothing here describes a feature that is not in the build.**

---

## PASTE THIS - "What's new"

Trim to fit the listing. The first block leads because it is the only one every
existing user gets without asking for anything, and the only one that changes what
the extension does on a profile that has never subscribed.

### See where your time went today - free

LaunchPad has always measured how long you spend on each site. Until now only Pro
could see it. **Now the Dashboard shows today's time by site on every profile, free
included** - the sites you actually spent the day on, in order, with the time on each.

Open the Dashboard and it is the first thing there. Nothing to set up, no tasks to
create, no trial to start. If you use Pro's tasks, the same card splits the day into
**time on tasks** and **time on other sites**, and the two add up to your total.

**What stays Pro:** the history. Ranges, comparisons, the heatmap, the weekly review
and the export are the paid half. Today is free.

### Your browsing is measured on this device, and you can switch it off

**This is a change worth reading even if you skip the rest.** Because passive time is
now free, the engine records site time on free profiles too, where previously it
recorded nothing at all. It is **on by default**, so an existing free user is
measured from the first tab they open after updating.

Everything it records **stays on your device**. Nothing is uploaded, nothing is
shared, and no new permission was added for this - it uses the tab and window events
the extension already had.

If you would rather it did not: **Settings -> Privacy -> Track time on sites**. Off
stops the recording and hides the card. Nothing already recorded is deleted.

---

## NOTES FOR WHOEVER CUTS THE BUILD

**The second block is not optional and must not be trimmed for length.** A product
that starts measuring a user's browsing on update has to say so plainly, in the
listing, in the same words a user would use. The feature is defensible - it is local,
it is off-switchable, and it is what makes the free tier worth anything - and it is
exactly the kind of change that reads as a betrayal if a user discovers it rather
than being told.

**The permission diff for this change is EMPTY.** Passive capture rides
`tabs` / `windows` / `idle`, all of which the extension already had for Pro tracking;
opening it to free profiles added nothing. If a reviewer asks, that is the answer.
