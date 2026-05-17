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
     "default_branch": "main",
     "workspace_dir": "."
   }
   ```

   `workspace_dir` is the directory the orchestrator does its
   branch work in. Default `"."` (the current checkout). For local
   CC sessions running alongside human edits, set to a dedicated
   git worktree (see `METHODOLOGY.md` → *Branch strategy*).

   If the file is missing or malformed, abort with the expected shape
   in the error message.
4. **GitHub auth.** Run `gh auth status`. Abort if not authenticated.
   The authenticated identity needs `repo` and `project` scopes.
5. **Lock directory exists.** Create `.claude/in-flight/` if absent.
6. **Worker identity.** Read `/tmp/backlog-poll-worker-id` (single
   line). If absent, abort with: "Run `/backlog-worker-start` first
   to establish this session's worker identity." Store the value as
   `$WORKER_ID` for use throughout the tick.

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
- The Project field values for `Status`, `Phase`, `Owner`,
  `Category`, `Complexity`, `V`, `M`, `A`, `Total`.
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

Decisions are made from the `(Status, Phase, Owner)` triple on the
Project item — **API state**, never working-tree state. This is what
keeps the orchestrator from re-triggering a phase whose output is
still sitting in an open PR (not yet merged to `main`), and what lets
multiple workers cooperate without colliding.

**Ownership filter (applied first):**

For each item, look at the `Owner` field:

- `Owner == $WORKER_ID` — this is my ticket. Continue working on it.
- `Owner == <some other worker>` — not mine. Skip entirely.
- `Owner` is empty — candidate. I may try to claim it (see *Claim a
  ticket* below).

Walk items in priority order (highest `Total` first; ties broken by
oldest issue number). Prefer items already owned by me before
claiming new ones. Pick the first that matches an actionable row:

| Status      | Phase             | Action                                                                                                  |
|-------------|-------------------|---------------------------------------------------------------------------------------------------------|
| `Triage`    | (any)             | **None** — maintainer scores and advances.                                                              |
| `In Design` | *(empty)*         | Create design branch `<NNN>-<slug>`; run `/speckit-specify`; commit + push; open design PR; set Phase = `Spec drafting`. |
| `In Design` | `Spec drafting`   | If `spec.md` contains `[NEEDS CLARIFICATION]` markers, run `/speckit-clarify`. Otherwise run `/speckit-plan`; commit + push; set Phase = `Plan drafting`. |
| `In Design` | `Plan drafting`   | Run `/speckit-tasks`; commit + push; set Phase = `Tasks drafting`.                                       |
| `In Design` | `Tasks drafting`  | If issue has the `epic` label: run `/speckit-taskstoissues`; set Phase = `Decomposing`. Otherwise: set Phase = `Designed`. |
| `In Design` | `Decomposing`     | Verify sub-issues exist on the parent; set Phase = `Designed`.                                          |
| `In Design` | `Designed`        | **None** — flag in chat: "design done, drag to Ready when design PR has merged."                        |
| `Ready`     | (any)             | **None** — maintainer drags to Doing when capacity is available.                                        |
| `Doing`     | `Designed`        | Create impl branch `<NNN>-<slug>-impl`; run `/speckit-implement`; commit + push; open impl PR with `Closes #<n>`; set Phase = `Implementing`. |
| `Doing`     | `Implementing`    | **None** — wait for impl PR to merge. Flag in chat if CI on the PR is red.                              |
| `Done`      | (any)             | **None**.                                                                                                |

Inconsistencies — flag in chat without taking action:

- `Status` is `Ready` or `Doing` but `Phase` is not at least
  `Designed`.
- Issue is `CLOSED` but `Status` is not `Done`.
- Issue is `OPEN` but `Status` is `Done`.
- `Total` is stored but one or more of V/M/A is missing.
- The design branch `<NNN>-<slug>` is missing on the remote but
  `Phase` says design work has started.

If nothing is actionable and no inconsistencies, emit a single-line
status:

> Polled at <ts>: <N> Triage, <M> In Design, <K> Ready, <J> Doing,
> <C> Done. All clean.

## Claim a ticket

Before doing actual phase work on an unowned candidate, claim it:

1. Write `Owner = $WORKER_ID` for the item via
   `updateProjectV2ItemFieldValue` GraphQL mutation.
2. **Re-fetch the item's `Owner` field.** If the read-back returns
   `$WORKER_ID`, claim succeeded — proceed. If it returns a different
   value (another worker beat us to it), abandon this item and try
   the next candidate.

The read-back-confirm handles the race window between two workers
polling simultaneously. The window is small, but the check is cheap.

## Release a ticket

A worker releases a ticket (clears `Owner` back to empty) when the
ticket enters a state that requires maintainer attention:

- After advancing `Phase` to `Designed` (the design PR sits open
  awaiting maintainer review and the drag from `In Design` to
  `Ready`).
- After opening the implementation PR and setting `Phase` to
  `Implementing` (the impl PR sits open awaiting maintainer review;
  merge auto-flips Status to `Done`).

Releasing means: clear `Owner` (write empty/null), then exit the tick
without taking further action on this item. The next worker (possibly
this same one, on a later tick after the maintainer has acted) is
free to pick it back up if its `(Status, Phase)` becomes actionable
again.

The worker keeps ownership while inside a phase that's still
producing artefacts (between Phase = `Spec drafting` and `Plan
drafting`, etc.) and while blocked on a chat question (see *Lock
files*).

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

### Branches

Two branches per issue (see `METHODOLOGY.md` → *Branch strategy*):

- **Design branch** `<NNN>-<slug>` — carries `spec.md`, `plan.md`,
  `tasks.md` (and, for Epics, the side-effect of sub-issue creation).
  Created on the first specify run; reused for `plan`, `tasks`, and
  any `clarify` re-runs. One **design PR** opens after the first
  commit and stays open through subsequent commits.
- **Implementation branch** `<NNN>-<slug>-impl` — carries the
  implementation. Created when `Phase = Designed` and Status moves
  to `Doing`. One **implementation PR** opens against the default
  branch with `Closes #<n>`.

Always create branches off the default branch (`config.default_branch`),
not off whatever branch the working tree happens to be on.

### Sequence

1. **Claim** the ticket if not already owned by `$WORKER_ID` (see
   *Claim a ticket*). If the claim attempt fails, abandon this item
   and try the next candidate.
2. `cd` to `config.workspace_dir`. Fetch and rebase onto the default
   branch. Switch to (or create) the appropriate branch for the
   selected phase per *Branches* above.
3. Write or update the lock file on that branch. Commit and push.
4. Read and follow the target speckit skill's Outline (treat the
   issue body and any relevant comments as `$ARGUMENTS`).
5. If at any point the skill needs information that isn't in the
   issue body, the issue comments, or the repo:
   - Append the question(s) to the lock file's
     `## Outstanding questions` section. Commit and push the update.
   - Post the questions in chat for the maintainer.
   - **Exit the tick.** Do not delete the lock. **Keep ownership** —
     the question belongs to this worker.
6. If the speckit skill completes without blocking:
   - Commit the generated artefacts on the current branch and push.
   - **First commit on a design branch**: open the design PR via
     `gh pr create`, body referencing `Refs #<n>`. Subsequent design
     phases just push — the existing PR auto-updates.
   - **First commit on an impl branch**: open the impl PR with body
     `Closes #<n>`.
   - Delete the lock file in a final commit. Push.
   - Update the `Phase` Project field for the issue via a GraphQL
     mutation (e.g. → `Plan drafting` after specify completes).
   - **Release ownership** if the new `Phase` is a human-gate state
     (`Designed` or `Implementing` with an open PR): clear the
     `Owner` field via GraphQL. Otherwise keep ownership for the
     next tick's continuation work.
7. Report what was done in chat.

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
