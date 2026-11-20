# Release notes - 2.3.1

**Cut 2026-11-20 against the LIVE `v2.3.0` (`faa2181`).** RELEASE_VERSION `2.3.1` was ruled by
Samson on 2026-11-20, after he confirmed 2.3.0 is live. Renamed from `RELEASE-NOTES-NEXT.md`, which
was still empty. A fresh `RELEASE-NOTES-NEXT.md` starts for the release after.

Same rule as the files beside it: **nothing here describes a feature that is not in the build.**

**Baseline: `v2.3.0` -> `faa2181`.** "New" means a 2.3.0 user did not have it. 2.3.0 is live
(Samson, 2026-11-20), so nothing from `RELEASE-NOTES-2.3.0.md` is repeated here.

**Method.** The range is `git log v2.3.0..<build commit>`. Section B lists every commit in it,
user-facing or not, so nothing is left out by omission. Both feature commits were verified in a
scratch Edge profile, on the working tree and on the packaged build (Asana 1220694906838673,
the two IMPLEMENTATION comments). Samson confirmed the dialog on his own profile on 2026-11-19:
"Works on my profile, drag feels good", and the hint line "reads right".

---

## A. PASTE THIS - "What's new"

```
Easier ways to manage stacked shortcuts.

• Manage variants now opens a box listing every link in a stack.
  Drag them into any order, or use the arrow keys. The first link
  is the one the stack opens.
• Each link has an Edit button for its name and address, plus
  Ungroup and Delete.
• Drag any link to the top to make it the stack's default.
• In the sidebar, right-click a link inside a stack to open,
  rename, edit, ungroup or delete it. Right-click the stack
  itself for Manage variants.

Fixes

• Renaming a stack now changes the name you see.
• The options button on each link in a stack's list shows its
  icon again.
```

No store description change is needed.

---

## B. Every commit in the range

From `git log --oneline v2.3.0..<build commit>` at the cut.

| Commit | What | User-facing |
|---|---|---|
| `484850d` | docs: 2.3.0 submitted from faa2181; v2.3.0 applied at submission | No, docs |
| `5fd2436` | fix(variants): sidebar variant rows get a LaunchPad menu, Manage variants opens, stack renames land | **Yes** |
| `04b3f89` | feat(variants): Manage variants opens a dialog - drag to reorder, Edit on every row | **Yes** |
| the cut | chore: 2.3.1 cut, manifest 2.3.1, these notes (THE BUILD COMMIT; its hash is in the artifact name and the tag) | No |

**Shipped files changed since 2.3.0:**
- `newtab.js`: the sidebar variant-row menu, the stack rename fields, the Manage variants dialog, and the shared ungroup and delete helpers.
- `newtab.css`: the dialog's styles.
- `newtab.html`: two sidebar menu items, Ungroup and Manage variants.
- `locales/en.js`: 8 `variants_manager_*` messages added. One existing message corrected: `variant_u22ee` was a doubled escape and is now the glyph.
- `manifest.json`: `version` only.

Nothing else that ships has changed. `484850d` touches `CLAUDE.md` only.

---

## C. Permissions, against the 2.3.0 baseline

**Permission-neutral.** `permissions`, `optional_permissions`, `host_permissions`, the CSP and
`web_accessible_resources` (none) are identical to `faa2181`. The only manifest change is `version`.
There is no new install warning and no re-consent for existing users.

**Privacy.** No new storage key. The dialog writes the same `data` blob through `Storage.saveAll`
that the rest of Home writes. Its row icons use the grid's existing icon source and the grid's
existing fallback (Google's favicon service, disclosed under "Website icons"). It makes no other
request. `privacy-policy.html` needs no change.

---

## D. Behaviour that changes for EXISTING users without them asking

- **Manage variants opens a box.** Before, it did nothing; it had not worked since March 2026 (`0cced1c`). A left-click on a stack's tile still opens the quick dropdown, unchanged.
- **Right-clicking a link inside a stack in the sidebar** shows LaunchPad's menu instead of the browser's.
- **Renaming a stack that has a name changes that name.** This applies to sidebar Rename and to Edit shortcut's Name field.
  - Before, both wrote the default link's own title, which a named stack does not show. The save had no visible effect.
  - Edit shortcut on a named stack now opens with the stack's name in the Name field, not the default link's title.
  - The default link's own title is now edited from its row in Manage variants.
- **Stored data:** reordering and promoting change only the order of a stack's links and which one is the default. Nothing is migrated, and a 2.3.0 profile needs no conversion.

---

## Where this goes at upload

1. Chrome Web Store dashboard, the item, **Package**: upload the stamped artifact,
   `launchpad-2.3.1-<build commit>.zip`. Its sha256 and byte count are in the Asana
   release-engineering thread and will go in the tag message.
2. **Store listing:** section A's block goes in the version notes / "What's new" field. The
   description is unchanged.
3. **Privacy practices:** no change, because this submission is permission-neutral against 2.3.0.
4. **After upload,** the annotated tag goes on at submission, on the exact commit the zip was
   built from, per CLAUDE.md.

## Predecessors

`RELEASE-NOTES-2.3.0.md` describes **the build users are on now**: 2.3.0 was submitted on
2026-11-10 from `faa2181` and is live (Samson, 2026-11-20). Leave it as it stands.
