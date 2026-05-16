---
name: "backlog-poll"
description: "Reconcile a GitHub Project board against on-disk speckit artefacts. Invokes speckit skills for outstanding work; asks the maintainer questions in chat when blocked."
argument-hint: "(none — designed to be driven by /loop)"
compatibility: "Requires spec-kit installed (.specify/), gh CLI authenticated with project scope, and .claude/backlog-poll.config.json configured."
metadata:
  author: "DeepBlueCLtd / backlog-navigator"
  source: "https://github.com/DeepBlueCLtd/backlog-navigator/blob/main/.claude/skills/backlog-poll/SKILL.md"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

This skill takes no required arguments. It is designed to be invoked
by `/loop <interval> /backlog-poll`. The following optional flags are
recognised in `$ARGUMENTS`:

- `--dry-run` — report decisions in chat but take no action.
- `--issue <N>` — only consider this issue this tick.

See [`METHODOLOGY.md`](../../../METHODOLOGY.md) for the full
methodology this orchestrator implements.

## Pre-flight

Perform these checks in order. If any fail, report in chat and exit
the tick without further action.

1. **Working tree is clean.** Run `git status --porcelain`. If any
   output, abort: "working tree dirty — orchestrator won't combine
   maintainer work with agent commits".
2. **Spec-kit is installed.** Confirm `.specify/` exists. If not,
   abort with the install command from `METHODOLOGY.md`.
3. **Configuration is present.** Read
   `.claude/backlog-poll.config.json`. Expected shape:

   ```json
   {
     "project_owner": "<github org or user that owns the Project>",
     "project_owner_type": "organization" | "user",
     "project_number": <integer>,
     "repo": "<owner>/<repo>",
     "default_branch": "main"
   }
   ```

   If the file is missing or malformed, abort with the expected shape
   in the error message.
4. **GitHub auth.** Run `gh auth status`. Abort if not authenticated.
   The authenticated identity needs `repo` and `project` scopes.
5. **Lock directory exists.** Create `.claude/in-flight/` if absent.

## Lock check

Before any work, check `.claude/in-flight/` for outstanding lock files
(any `*.md`).

- For each lock file, parse the YAML frontmatter and report in chat:

  > Still awaiting input on issue #N (phase: `<phase>`, started
  > `<timestamp>`):
  > <the body of the lock file's `## Outstanding questions` section>

- If any locks were reported, **exit the tick**. Do not fetch Project
  state, do not consider any other items, do not recompute Total.
  The maintainer must answer the outstanding question(s) so the
  agent can finish that work before new work starts.

Locks are committed to the repo (see *Lock files*, below), so they
survive Claude Code session restarts and ephemeral cloud-container
churn.

## Fetch Project state

Use `gh api graphql` to fetch every Project item in a single query.
The query must include, per item:

- The linked Issue's `number`, `title`, `body`, `state` (`OPEN` /
  `CLOSED`), and `url`.
- The Project field values for `Status`, `Category`, `Complexity`,
  `V`, `M`, `A`, `Total`.
- The Issue's parent / sub-issue relationships (if any).
- Labels on the Issue (to detect the `epic` convention).

Build an in-memory list keyed by issue number. Do not write this to
disk — it's per-tick state, regenerated next tick.

If the Project schema doesn't expose all expected fields, log which
ones are missing and continue with what's available. Don't abort
unless `Status` itself is missing.

## Recompute Total

For each item where all of V, M, A are present and
`Total ≠ V + M + A`, write the corrected `Total` back via the
appropriate `updateProjectV2ItemFieldValue` GraphQL mutation.

Log each correction:

> Recomputed Total for #N: was X, now Y (V=a, M=b, A=c)

If `--dry-run` is set, report what would change instead of mutating.

## Decide one action

This skill performs **at most one action per tick**. Predictable,
bounded behaviour, and it gives the maintainer a chance to interject
between actions.

Walk items in priority order (highest `Total` first; ties broken by
oldest issue number) and pick the first that matches an actionable
row:

| Status      | Artefact state                                                       | Action                                                                       |
|-------------|----------------------------------------------------------------------|------------------------------------------------------------------------------|
| `Triage`    | (any)                                                                | **None** — maintainer's job to score and advance.                            |
| `In Design` | No `specs/<n>-*/spec.md` exists                                      | Invoke `/speckit-specify`. See *Speckit invocation*.                         |
| `In Design` | Spec has unresolved `[NEEDS CLARIFICATION]` markers                  | Invoke `/speckit-clarify` (or surface the markers in chat).                  |
| `In Design` | Spec exists, no `plan.md`                                            | Invoke `/speckit-plan`.                                                      |
| `In Design` | Plan exists, no `tasks.md`                                           | Invoke `/speckit-tasks`.                                                     |
| `In Design` | Tasks exist; **Epic parent**; no sub-issues filed                    | Invoke `/speckit-taskstoissues`.                                             |
| `In Design` | All design artefacts present (Epic: + sub-issues); design PR merged  | **None** — flag in chat that the maintainer can drag to `Ready`.             |
| `Ready`     | (any)                                                                | **None** — maintainer's job to drag to `Doing` when capacity is available.   |
| `Doing`     | No implementation PR open or merged                                  | Invoke `/speckit-implement`.                                                 |
| `Doing`     | Implementation PR open                                               | **None** — but flag in chat if CI is red.                                    |
| `Done`      | (any)                                                                | **None**.                                                                    |

Inconsistencies — flag in chat without taking action:

- Status is `Ready` or `Doing` but no spec file exists.
- Issue is `CLOSED` but Status is not `Done`.
- Issue is `OPEN` but Status is `Done`.
- `Total` is stored but one or more of V/M/A is missing.
- Item is in `In Design` but `specs/<n>-*/` directory exists yet
  isn't on a feature branch — likely orphaned.

If nothing is actionable and no inconsistencies, emit a single-line
status:

> Polled at <ts>: <N> Triage, <M> In Design, <K> Ready, <J> Doing,
> <C> Done. All clean.

## Speckit invocation

When this skill invokes a speckit skill, it does so by reading the
target skill at `.claude/skills/speckit-<phase>/SKILL.md` and
following its **Outline** against the selected issue. Treat the
issue body (and any clarifying comments on the issue) as the
`$ARGUMENTS` the speckit skill expects.

Before invoking, write a lock file. After (or on block), update or
delete it. Concretely:

### Lock files

Location: `.claude/in-flight/<issue-number>.md`.

Frontmatter:

```yaml
---
issue: <issue-number>
phase: specify | clarify | plan | tasks | taskstoissues | implement
started: <ISO 8601 timestamp>
branch: <feature-branch-name-or-null>
---
```

Body sections:

- `## Plan` — one-line description of what the agent is about to do.
- `## Outstanding questions` — populated if and when the agent
  blocks on a maintainer answer. Each question on its own bullet.

Commit the lock file on the current branch (typically the speckit
feature branch). Push the branch. This ensures cloud-CC container
restarts can resume.

### Sequence

1. Determine the feature short-name (per speckit-specify's
   conventions). Create or check out a feature branch named per
   `.specify/init-options.json`'s `branch_numbering` setting.
2. Write the lock file on the feature branch. Commit and push.
3. Follow the target speckit skill's Outline.
4. If at any point the skill needs information that isn't in the
   issue body, the issue comments, or the repo:
   - Append the question(s) to the lock file's
     `## Outstanding questions` section. Commit and push the update.
   - Post the questions in chat for the maintainer.
   - **Exit the tick.** Do not delete the lock.
5. If the speckit skill completes without blocking:
   - Ensure all generated artefacts (spec, plan, tasks, code) are
     committed on the feature branch.
   - Open a PR via `gh pr create`. PR body should reference the
     issue:
     - For spec-only PRs: `Refs #<n>`.
     - For implementation PRs: `Closes #<n>`.
   - Delete the lock file (in a final commit). Push.
6. Report what was done in chat.

### Epic-specific step: taskstoissues

Every item in `In Design` goes through `specify` → optional `clarify`
→ `plan` → `tasks`. **Epic parents** get one additional phase:
`/speckit-taskstoissues`, which fires once `tasks.md` exists on the
feature branch and no child sub-issues have been filed yet.

Sub-issues created by `/speckit-taskstoissues` are added to the
Project in `Triage`, where each gets its own scoping. Linkage to the
Epic is via GitHub's native sub-issue relationship.

A non-Epic item finishes its In-Design work when `tasks.md` is
written and the design PR opens — there is no `taskstoissues` step.

## Summarise

End every tick with one chat message of this shape:

```
Backlog poll at <ts>:
  Action taken:     <one line, or "none">
  Awaiting input:   <issue numbers, or "none">
  Inconsistencies:  <one line summary, or "none">
  Next tick will:   <one-line forecast>
```

Keep it terse. The maintainer should be able to skim it in three
seconds.

## Notes for adopters

This skill is the canonical orchestrator described in
`METHODOLOGY.md`. To adopt:

1. Copy this file (and any companion files in
   `.claude/skills/backlog-poll/`) into your own repo's
   `.claude/skills/backlog-poll/`.
2. Create `.claude/backlog-poll.config.json` pointing at your
   Project (see *Pre-flight*).
3. Install spec-kit if you haven't (see `METHODOLOGY.md`).
4. From a Claude Code session in your repo, run
   `/loop 15m /backlog-poll`.

Operational constraints:

- The skill does not edit the default branch directly. It only
  commits to feature branches and opens PRs.
- The skill commits lock files (`.claude/in-flight/*.md`) on
  feature branches, where they are visible in PR diffs as a record
  of in-flight state. Lock files are removed before the PR closes
  out.
- The skill never auto-merges. Spec and implementation PRs are
  always for human review.

If your team's speckit phase ordering differs (e.g. always run
`/speckit-clarify` before `/speckit-plan`, or skip
`/speckit-checklist` outputs), edit the *Decide one action* table
in your copy locally.
