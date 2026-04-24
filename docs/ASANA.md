# LaunchPad Pro — Asana Development Workflow

Adapted from the reelabs ASANA workflow, with two changes specific to LaunchPad Pro:

1. **Work-area-based grouping** (not phase-based). LaunchPad Pro v1 is smaller than reelabs and doesn't have clean phase boundaries — tasks are grouped by functional area.
2. **Specs & Decisions section** added. Design specs and architectural decision records live in Asana as spec tasks alongside the dev work they drive.

Everything else follows the reelabs pattern.

---

## Project Details

- **Project:** LaunchPad Pro - Development Log
- **Project ID:** `1214252324886224`
- **Project URL:** https://app.asana.com/1/1205089459732869/project/1214252324886224

---

## Team

| Name | Asana GID | Role |
|------|-----------|------|
| Samson Stephens | `1205089461792179` | Lead (solo for now) |

---

## Sections

| Section | GID | Purpose |
|---------|-----|---------|
| Specs & Decisions | `1214252324886227` | Spec documents and architectural decisions — reference material, not actively worked |
| In Progress | `1214252324886228` | Work currently being executed in Claude Code |
| Needs Review | `1214252324886229` | Claude Code output awaiting review in Claude Chat |
| Completed | `1214252324886230` | Reviewed and confirmed work |
| Bugs / Issues | `1214252324886231` | Open problems found during development |
| Fixed Bugs / Issues | `1214252324886232` | Resolved bugs confirmed fixed |

---

## Work Areas

LaunchPad Pro v1 work is grouped into these areas. Use as the `[Area]` prefix in task names:

| Area | Scope |
|------|-------|
| **Prototype** | Experimental / validation work before full implementation (e.g., tracking engine prototype) |
| **Foundation** | Workspace switching, Pro settings panel, data model, base schema |
| **Tasks** | Goal/task system, tags, active task picker |
| **Tracking** | Full tab time tracking engine, idle handling, storage |
| **Experience** | Day Recap, Start of Day, achievements, dashboards |
| **Infrastructure** | Billing, license verification, upgrade flow, beta onboarding |
| **Polish** | Performance, edge cases, migration paths, Pro v1 release prep |

---

## Task Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Work item | `[Area]: [Task]` | `Tracking: Tab activation listener with idle handling` |
| Bug | `Bug: [Area] — [what's wrong]` | `Bug: Tracking — idle state not detected on laptop sleep` |
| Spec | `Spec: [doc name]` | `Spec: Day Recap UX and behaviors` |
| Standalone fix | `Fix: [description]` | `Fix: Task completion animation timing` |

---

## Task Consolidation Rules

- **One task per piece of work.** Updates accumulate on that task — don't create new tasks for iterations on the same work.
- **Bugs get separate tasks** (so they trace through the Bugs → Fixed Bugs lifecycle) but are always prefixed with the originating area.
- **Small fixes within a task's scope stay in that task.** Only create a bug task when the issue is distinct enough to warrant its own tracking.
- **Claude Code must update existing tasks, never create new ones for summaries.** The only new tasks Claude Code creates are bug reports in Bugs / Issues.

---

## Comment-Based Communication

Comments are the timeline within a task. All communication between Claude Chat, Claude Code, and reviewers happens via comments on the task — not by creating new tasks or repeatedly updating the description.

### Comment Types

| Who | Prefix | Purpose |
|-----|--------|---------|
| Claude Chat | `PLAN —` | Summarizes what was discussed and what the Claude Code prompt covers |
| Claude Code | `IMPLEMENTATION —` | Summarizes what was built, files changed, issues found, what to review |
| Claude Chat | `REVIEW —` | Reviews Claude Code's work against the plan, confirms or flags issues |
| Claude Chat | `RESOLVED —` | Resolution summary when moving bugs to Fixed Bugs / Issues |
| Human | *(no prefix)* | Ad hoc notes, context, corrections |

### How Comments Work

1. **Task description** is the stable summary — written once at creation by Claude Chat, updated by Claude Code on completion with the final state.
2. **Comments** are the timeline — each step in the lifecycle adds a comment. When you open any task, you read the description for "what is this?" and scroll comments for "what happened?"
3. **Reviews happen via comments, not new tasks.** If a review passes, a final comment says so and the task moves to Completed. If it fails, a comment explains what needs fixing and the same task ID goes back to Claude Code.
4. **Iterations stay on one task.** Subsequent Claude Code sessions use the SAME task ID and add another IMPLEMENTATION comment.

### What Claude Chat Does NOT Post to Asana

Claude Chat writes Claude Code prompts in the chat interface only — **never** in Asana comments or task descriptions. Samson copies the prompt from the Claude Chat conversation manually and pastes it into Claude Code.

Why: Asana is the output log (what was built, what needs review, what was fixed). The chat is the working medium. Mixing them clutters Asana with large prompt text that isn't part of the task record.

**Asana comments Claude Chat SHOULD write:**
- `PLAN —` comments (context, scope, success/failure criteria for the task)
- `REVIEW —` comments (assessing Claude Code's work against the plan)
- `RESOLVED —` comments (when closing bugs)

**Asana comments Claude Chat should NOT write:**
- The Claude Code prompt itself
- Copy-paste blocks intended for Claude Code
- Code snippets (unless necessary for review discussion)

### Comment Formatting — Plain Text Only

All Asana comments (from Claude Chat AND Claude Code) must be posted as **plain text** using the `text` parameter of the `add_comment` API — **never** `html_text`.

Reasons:
- Plain text is readable in the Asana UI, in API responses, in copy-paste, and in downstream review
- HTML comments with `<strong>`, `<code>`, `<ul>` tags etc. render as formatted output in Asana but become visually dense and noisy
- Plain text eliminates any risk of mismatched tags or unsupported elements
- Samson prefers to scan comments quickly; formatting discipline beats formatting density

Conventions for readability in plain text:

- **Section headers** at the top of a comment use all-caps or a clear label: `IMPLEMENTATION —` / `PLAN —` / `REVIEW —` / `RESOLVED —`
- **Blank lines** separate logical sections within a comment
- **Bulleted lists** use `-` or `•` (lowercase, sentence case content)
- **Inline references** to files, commits, functions use plain backticks only if context demands it; otherwise just the name (e.g., `tracking-prototype.js`, commit 713508e, `trackingExport()`). Asana renders nothing special for backticks in plain text, but reviewers recognize them
- **Numeric lists** use `1.` / `2.` / `3.`
- **No HTML tags**. Not `<strong>`, not `<code>`, not `<br>`, not `<ul>/<li>`. If you find yourself wanting to bold something, rewrite the sentence so the important point stands alone on its own line

This rule applies to PLAN, IMPLEMENTATION, REVIEW, RESOLVED, and any other comment type.

Asana task descriptions use Markdown-style headers (## Context, ## What was done) that render as plain text — this is acceptable because the format is consistent and stable.

---

## Workflow Loop

```
1. PLAN (Claude Chat)
   - Discuss feature, architecture, or fix
   - Write prompt for Claude Code
   - Create "In Progress" task in Asana, assigned to Samson
   - Record task ID
   - Add PLAN — comment summarizing scope
   - Include task ID at top of Claude Code prompt:
     "Asana Task ID: 1234567890 - Update this task when complete."

2. EXECUTE (Claude Code)
   - Read the prompt and task ID
   - Build the code
   - On completion:
     - UPDATE the existing task description (do not overwrite Context section)
     - ADD an IMPLEMENTATION — comment
     - MOVE task from "In Progress" to "Needs Review" (add_projects with section_id)
   - Do NOT create new tasks for summaries — always update the original
   - If bugs found, CREATE separate tasks in "Bugs / Issues" (only new tasks Code should create)

3. REVIEW (Claude Chat)
   - User asks: "check the latest Asana update"
   - Pull task from "Needs Review"
   - Read description and comments; review against original plan
   - ADD a REVIEW — comment
   - If confirmed: move to "Completed"
   - If issues: discuss fixes, write next prompt with SAME task ID, iterate

4. BUG LIFECYCLE
   - New bugs: "Bugs / Issues" section
   - Bug task name prefixed with area: "Bug: [Area] — [description]"
   - Fix is applied → task moves to Needs Review → confirmed → moves to Fixed Bugs / Issues
   - When confirmed working:
     a. Add RESOLVED — comment explaining what was fixed, how verified, caveats
     b. Mark task completed
     c. Move to "Fixed Bugs / Issues"

5. SPEC LIFECYCLE
   - Specs live in "Specs & Decisions" section
   - Task naming: "Spec: [doc name]"
   - Description contains the full spec (or link to markdown file in `docs/SPECS/`)
   - Specs don't move through In Progress → Completed; they stay in Specs & Decisions
   - When a spec evolves, add an UPDATE — comment describing the change; do not create a new spec task

6. REPEAT
   - Each work item follows this loop
   - One task = one piece of work from plan through completion
   - Asana project becomes a living history of the build
```

---

## Task Format

**Task Name:** Follow naming convention above.

**Description:**

```
## Context
[1-2 paragraphs written by Claude Chat at task creation. Explains WHY this
work exists. What problem does it solve? What was the user experience before?
What should it be after? What spec or decision led to this task? Intelligible
to someone reading the task with no prior context.]

## What was done
[Filled in by Claude Code on completion.]

## Files affected
- path/to/file1.js — [what changed]
- path/to/file2.css — [what changed]

## Dependencies
- [Packages added, APIs used, env vars needed]

## Issues encountered
- [Bugs, blockers, surprises — or "None"]

## Next steps
- [What should happen after this task is reviewed]
```

**Context section guidelines:**
- Written at task creation by Claude Chat, before Claude Code starts
- Claude Code should NOT overwrite this section
- Answers: why are we doing this, what's wrong today, what does success look like
- References originating spec or discussion

---

## CRITICAL: Project Placement Rules

**Every task MUST remain in project `1214252324886224` at all times.**

These rules exist because tasks have repeatedly drifted out of project membership in other projects:

1. **Creating a task:** Always include `project_id` and the correct `section_id`. Verify the task appears in the project.
2. **Updating a task:** NEVER use `remove_projects`. NEVER clear project membership. Only use `add_projects` to move between sections within the same project.
3. **Moving between sections:** Use `add_projects` with the new section GID. Do NOT remove from old and add to new — `add_projects` to a section in the same project handles the move.
4. **After any task operation:** Verify the task still has `memberships` including project `1214252324886224`. If not, immediately re-add.

**Common mistakes:**
- Using `add_projects` without `section_id` — places task in "Untitled section"
- Update operation silently removing project membership
- Creating tasks without project placement (invisible in the dev log)

---

## Session-Start Prompts

### For Claude Chat

> We are building LaunchPad Pro (paid tier of LaunchPad Chrome extension). Asana project: "LaunchPad Pro - Development Log" (ID: `1214252324886224`).
>
> **Sections:** Specs & Decisions (`1214252324886227`), In Progress (`1214252324886228`), Needs Review (`1214252324886229`), Completed (`1214252324886230`), Bugs / Issues (`1214252324886231`), Fixed Bugs / Issues (`1214252324886232`).
>
> **Work areas:** Prototype, Foundation, Tasks, Tracking, Experience, Infrastructure, Polish.
>
> **Task naming:** Work items = "[Area]: [Task]". Bugs = "Bug: [Area] — [description]". Specs = "Spec: [name]". Fixes = "Fix: [description]".
>
> **Workflow:**
> - When planning work, create a task in "In Progress" assigned to me. Note the task ID. Add a PLAN — comment summarizing scope.
> - When writing a Claude Code prompt, include the Asana task ID at the top: "Asana Task ID: [ID] - Update this task when complete and move to Needs Review."
> - When I say "check Asana" or "review", pull the task from "Needs Review", read description AND comments, review against plan, add a REVIEW — comment.
> - If confirmed, move to Completed. If issues, discuss fixes and write next Claude Code prompt with SAME task ID.
> - When a bug fix is confirmed, add a RESOLVED — comment, mark completed, move to Fixed Bugs / Issues.
> - All communication lives as comments. Description is the stable summary.
> - One task per piece of work. Consolidate.
> - ALWAYS verify tasks land in project `1214252324886224`.
>
> Do this proactively. Log decisions, features, architecture changes as tasks as we go. Assign all tasks to me.

### For Claude Code

> You are working on LaunchPad in `C:\Dev\Git\launchpad`. Asana project: "LaunchPad Pro - Development Log" (ID: `1214252324886224`).
>
> **After completing each prompt or meaningful code change:**
> 1. Look for the Asana Task ID at the top of the prompt
> 2. UPDATE THAT EXISTING TASK description — do not create a new task for the summary
> 3. PRESERVE the existing "## Context" section. Fill in or update: What was done, Files affected, Dependencies, Issues encountered, Next steps
> 4. ADD A COMMENT prefixed with "IMPLEMENTATION —" summarizing: what was built, key decisions, what reviewer should check. **Use the `text` parameter of add_comment, NEVER `html_text`. Plain text only — no `<strong>`, `<code>`, `<ul>` or any HTML tags.** See the Comment Formatting section of ASANA.md.
> 5. Move task to "Needs Review" using `add_projects` with project_id `1214252324886224` and section_id `1214252324886229`
> 6. Assign to me
> 7. If bugs found, create separate NEW tasks in "Bugs / Issues" — use `add_projects` with project_id `1214252324886224` and section_id `1214252324886231`. Name: "Bug: [Area] — [description]"
> 8. When fixing a previously logged bug: update description with fix, add RESOLVED — comment (plain text), mark completed, move to "Fixed Bugs / Issues" using `add_projects` with project_id `1214252324886224` and section_id `1214252324886232`
>
> **CRITICAL PROJECT RULES:**
> - NEVER use `remove_projects`. Tasks must ALWAYS remain in project `1214252324886224`.
> - ALWAYS use `add_projects` with BOTH `project_id` AND `section_id` when moving between sections.
> - After updates, verify the task still belongs to the project. If `memberships` doesn't include `1214252324886224`, immediately re-add.
> - Every new task MUST include `add_projects` with the project ID and correct section_id.
>
> Task ID provided in prompts as: "Asana Task ID: 1234567890"
> If no task ID is provided, ask before proceeding with Asana updates.
>
> Do this automatically after every meaningful piece of work.
