# Backlog as Issues + Project: a methodology

This document describes a way of running a project's backlog using
GitHub Issues and a single GitHub Project per repo, with status
transitions that *drive* work (rather than just report on it). It is
written as a general adoption guide — any repo that wants to manage a
backlog this way can follow it, regardless of language or stack.

It is a sibling to [`ADOPTING.md`](ADOPTING.md), which covers the
markdown-based Backlog Navigator. The two approaches coexist in this
repo today; this document captures the direction the project is moving.

This repo doubles as the methodology's **testbed**. The
[GitHub spec-kit](https://github.com/github/spec-kit) toolkit is
installed here (`.claude/skills/`, `.specify/`), backlog items live
in this repo's own Project, and the supporting orchestration command
(`/backlog-poll`) is exercised against real work before being
recommended to other repos.

---

## Why this exists

Keeping a backlog in a version-controlled `BACKLOG.md` works well until
multiple PRs in flight need to touch it. Then:

- Two PRs that add or reorder items conflict on the same lines.
- Status changes (e.g. marking an item *implementing*) collide with
  unrelated edits.
- Every backlog tweak becomes a code review, even when it has nothing
  to do with code.

Moving the backlog to GitHub Issues + a Project removes the merge
conflict problem entirely (writes are serialised server-side), couples
items to native GitHub features (assignees, sub-issues, linked PRs,
mobile app), and lets status transitions trigger real work rather than
just being a label.

The price is that the backlog is no longer reproducible from git alone;
the Project is the source of truth. We accept that trade.

---

## Overview

A repo hosts a single **public GitHub Project** with one item per
**Issue**. Items move through five statuses, dragged only by
maintainers:

```
Triage  →  In Design  →  Ready  →  Doing  →  Done
```

Anyone can file an issue using a minimal template (title + free-text
description). A workflow auto-adds new issues to the Project in
**Triage**.

Items carry a small set of custom Project fields: **Category**,
**Complexity**, **V / M / A** scores and a derived **Total**, plus the
standard **Status**.

When a maintainer drags an item to **In Design**, the orchestrator
runs the speckit design phases against it — `/speckit-specify`,
optionally `/speckit-clarify`, then `/speckit-plan` and
`/speckit-tasks`. **Epics** are parent issues; they get the same
treatment plus a final `/speckit-taskstoissues` step that files each
generated task as a child sub-issue under the Epic. Moving a card to
**Doing** invokes `/speckit-implement`, which opens an implementation
PR for human review.

The Project itself is publicly viewable — there is no separate
`BACKLOG.md` to maintain.

---

## Toolchain

This methodology composes on top of [GitHub spec-kit](https://github.com/github/spec-kit),
which provides the per-phase skills the orchestrator drives:

| Skill                       | Role                                                                 |
|-----------------------------|----------------------------------------------------------------------|
| `/speckit-constitution`     | (One-time, per repo.) Capture project principles.                    |
| `/speckit-specify`          | Produce `specs/<NNN>-<slug>/spec.md` for an issue.                   |
| `/speckit-clarify`          | *(Optional)* Pose structured clarifying questions before planning.   |
| `/speckit-plan`             | Produce `plan.md` from the spec.                                     |
| `/speckit-tasks`            | Produce `tasks.md` from the plan.                                    |
| `/speckit-taskstoissues`    | File each task as a GitHub sub-issue of the parent (Epic flow).      |
| `/speckit-implement`        | Implement the feature against the plan/tasks; open a PR.             |
| `/speckit-analyze`          | *(Optional)* Cross-artefact consistency check.                       |
| `/speckit-checklist`        | *(Optional)* Quality checklist for a spec / plan.                    |

Install spec-kit in your repo once:

```sh
uv tool run --from git+https://github.com/github/spec-kit.git \
    specify init . --integration claude --force
```

This adds `.claude/skills/speckit-*/` and `.specify/`; commit both —
they are the source of truth for the per-phase workflow.

Spec-kit skills are invocable both by humans (slash commands) and by
other agents. The methodology uses both: maintainers drive intermediate
phases by hand when they want fine control, and the orchestration
agent (`/backlog-poll`) drives the bookend phases automatically on
status change.

---

## Project schema

Create a Project (org-level or user-level, your choice) and link it to
the repo. Configure it with these fields:

| Field        | Type                | Values / notes                                                                                                  |
|--------------|---------------------|------------------------------------------------------------------------------------------------------------------|
| Status       | Single-select       | `Triage`, `In Design`, `Ready`, `Doing`, `Done`. Dragged by maintainers.                                         |
| Phase        | Single-select       | *(empty)*, `Spec drafting`, `Plan drafting`, `Tasks drafting`, `Decomposing`, `Designed`, `Implementing`. Maintained by the orchestrator (see *Phase field*). |
| Owner        | Text                | Worker ID (e.g. `bn-swift-mango-7234`) of the worker currently handling this item. Empty = unclaimed. See *Workers*. |
| Category     | Single-select       | e.g. `Feature`, `Enhancement`, `Tech Debt`, `Bug`, `Documentation`, `Spike`                                      |
| Complexity   | Single-select       | `Low`, `Medium`, `High`                                                                                          |
| V            | Number              | Value score (0–5)                                                                                                |
| M            | Number              | Mission score (0–5)                                                                                              |
| A            | Number              | Affordability / ease score (0–5)                                                                                 |
| Total        | Number              | `V + M + A`, recomputed by `/backlog-poll`                                                                       |

Make the Project's visibility **public** so anyone can read the
backlog without a GitHub account.

### Why V / M / A + Total

The three-dimensional score captures *why* an item ranks where it does
rather than collapsing rationale into a single P0/P1/P2. Total is the
sortable summary. Adopters who don't want this can keep a single
`Priority` field instead — the rest of the methodology is unchanged.

### The `Phase` field

`Phase` is the orchestrator's source of truth for "where in the
speckit pipeline is this item." It is **API-state, not git-state** —
so the orchestrator never has to guess at whether a feature branch's
artefacts are merged, on a PR, or partially written. It just reads
Phase.

Lifecycle of a typical issue:

```
(empty)
  └─ orchestrator runs /speckit-specify
     → Phase = Spec drafting
        └─ orchestrator runs /speckit-plan
           → Phase = Plan drafting
              └─ orchestrator runs /speckit-tasks
                 → Phase = Tasks drafting
                    ├─ non-Epic: → Phase = Designed
                    └─ Epic: orchestrator runs /speckit-taskstoissues
                       → Phase = Decomposing
                          → Phase = Designed
                             [ maintainer drags Status to Ready, then Doing ]
                                └─ orchestrator runs /speckit-implement
                                   → Phase = Implementing
                                      [ impl PR merges; Status auto-→ Done ]
```

`Phase` is written by the orchestrator via GraphQL whenever it
advances a phase. Maintainers don't edit it. If a maintainer drags
`Status` somewhere inconsistent with `Phase` (e.g. `Ready` while
`Phase=Plan drafting`), the orchestrator flags it in chat without
acting.

### Maintaining Total

Projects v2 has no computed fields, so `Total = V + M + A` is written
back by `/backlog-poll` on every tick alongside the Phase updates. No
separate workflow is required.

---

## The state machine

Maintainers move cards. External contributors cannot — they file
issues and comment, but the Project is the maintainer's tool.

### Triage

The landing zone. Every newly filed issue arrives here automatically.

**Exit criteria**: a maintainer has read the issue, decided it is real
work the project wants to do, and given it a Category, Complexity, and
preliminary V/M/A scores. The maintainer then drags it to **In Design**
(if it needs a spec) or directly to **Ready** (if the issue body is
already enough to implement against — rare).

### In Design

The item is being specified, planned, and broken into tasks. The
orchestrator advances **one phase per tick**, updating the `Phase`
field as it goes:

1. Phase *(empty)* → `/speckit-specify` produces
   `specs/<NNN>-<slug>/spec.md` on the design branch; design PR opens;
   Phase = `Spec drafting`.
2. Phase `Spec drafting` with `[NEEDS CLARIFICATION]` markers →
   `/speckit-clarify` runs. Stays in `Spec drafting` until clean.
3. Phase `Spec drafting` (clean) → `/speckit-plan` produces `plan.md`;
   Phase = `Plan drafting`.
4. Phase `Plan drafting` → `/speckit-tasks` produces `tasks.md`;
   Phase = `Tasks drafting`.
5. Phase `Tasks drafting`:
   - **Non-Epic** → Phase = `Designed`.
   - **Epic** → `/speckit-taskstoissues` files each task as a
     sub-issue under the parent; Phase = `Decomposing`, then
     `Designed` once sub-issues exist.

When Phase reaches `Designed`, the orchestrator stops and flags in
chat: "design done, drag to Ready when the design PR has merged."

Maintainers may also drive any of these phases by hand at any point
(`/speckit-clarify`, `/speckit-analyze`, `/speckit-checklist`, or
re-runs of any phase). The orchestrator picks back up from whatever
state the `Phase` field is in.

**Exit criteria**: design PR merged; for Epics, sub-issues exist;
Phase = `Designed`. Maintainer drags the card to **Ready**.

### Ready

A queue of shovel-ready items: spec exists, scope is understood, no
external blockers. Order within this column is the de facto work
queue.

**Exit criteria**: capacity is available to implement. Maintainer
drags to **Doing**.

### Doing

Implementation is in flight.

**On entry** (Status = `Doing`, Phase = `Designed`): the orchestrator
creates the implementation branch (see *Branch strategy*) and invokes
`/speckit-implement`. The skill reads the spec, plan, and tasks;
implements the change; runs project checks; opens an implementation
PR referencing the issue with a closing keyword (`Closes #NNN`).
Phase = `Implementing`. The PR is opened ready for review (not
draft) so human review is the next step.

**Exit criteria**: the implementation PR is merged. The issue closes
automatically; the Project's built-in workflow moves the card to
**Done**.

### Done

Terminal. The issue is closed; the linked PR is merged.

GitHub's default Project workflow (`item_closed` → `Status: Done`)
handles this transition automatically — no custom action required.

---

## Intake

### Issue template

Create `.github/ISSUE_TEMPLATE/backlog-item.yml`:

```yaml
name: Backlog item
description: Propose work for the backlog. Triage will categorise it.
title: "[item] "
body:
  - type: textarea
    id: description
    attributes:
      label: Description
      description: What's the work? Why does it matter? Anything you know about scope, constraints, examples.
    validations:
      required: true
```

Deliberately minimal. Category, Complexity, scoring, and Epic
assignment are all set by maintainers during triage. Asking the filer
to guess Category creates noise; asking them to score V/M/A creates
arguments.

### Auto-add to Project

A workflow file in the repo adds every newly opened issue to the
Project in the `Triage` column:

```yaml
# .github/workflows/add-to-project.yml
on:
  issues:
    types: [opened]

jobs:
  add:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v1
        with:
          project-url: https://github.com/orgs/<your-org>/projects/<n>
          github-token: ${{ secrets.PROJECT_TOKEN }}
```

The action sets the default status to whatever the Project has
configured as its default — set that to `Triage` in the Project's
settings.

---

## Epics and sub-issues

Epics are parent issues. They use GitHub's native sub-issue
relationship (the newer Issues experience), so the hierarchy is a
first-class GitHub object — not labels, not a custom field.

**Filing an Epic**: maintainers file an Epic the same way as any other
item, but title it `[epic] <theme>` and (optionally) label it `epic`.
The intake workflow puts it in Triage like any other issue.

**Decomposition**: Epics go through the same In-Design phases as
every other item (`specify` → optional `clarify` → `plan` → `tasks`).
What's specific to an Epic is the final step: once `tasks.md` exists,
the orchestrator runs `/speckit-taskstoissues`, which files each task
as a child sub-issue under the Epic. Each sub-issue is added to the
Project in Triage, where it gets its own scoping (Category, scores,
Complexity) before being dragged onward. Sub-issue linkage to the
Epic is native — no labels or custom fields required.

**Status independence**: once child sub-issues exist, each progresses
through the state machine on its own. The Epic parent stays in
**In Design** until all children are at least **Ready**, then moves
through **Ready / Doing / Done** in step with its children. Adopters
can pick a stricter or looser convention; the methodology only
requires that the Epic parent does not close until all children are
closed (GitHub enforces this automatically for sub-issues).

---

## Branch strategy

Each issue produces **one feature, two PRs**:

1. **Design branch** — named `<NNN>-<slug>` to match the speckit
   feature directory. Created when the orchestrator runs
   `/speckit-specify` for the first time. Each subsequent design
   phase (`clarify`, `plan`, `tasks`, and `taskstoissues` for
   Epics) commits to this same branch. A single **design PR** opens
   after the first commit and stays open as the orchestrator pushes
   successive commits, giving reviewers a running view of the design.
   Merges to `main` when Phase reaches `Designed` and the maintainer
   reviews it.

2. **Implementation branch** — named `<NNN>-<slug>-impl`. Created
   when Status moves to `Doing` and the orchestrator runs
   `/speckit-implement`. The **implementation PR** opens against
   `main`, references the issue with `Closes #NNN`, and merges when
   the maintainer signs off.

Two PRs per issue, two clean review surfaces. The design PR is
review-of-intent; the implementation PR is review-of-code. They
don't have to be merged in lockstep — the design PR usually merges
first (so the spec is on `main` before implementation references
it), but you can keep both open for late design tweaks during
implementation if needed.

### Worktrees (optional, local CC only)

In a cloud Claude Code session the container is the orchestrator's
domain and plain branch switching is fine. If you run
`/backlog-poll` in a local CC session while also coding in the same
checkout, the orchestrator's branch flips will collide with your
own work. The fix is a dedicated git worktree:

```sh
git worktree add ../backlog-poll-workspace main
```

…and set `workspace_dir` in `.claude/backlog-poll.config.json` to
`../backlog-poll-workspace`. The orchestrator does all its branch
work there; your primary checkout stays on whatever you were doing.

---

## Orchestration

Status changes need to dispatch speckit skills somehow, and GitHub
Actions does not expose `project_v2_item.edited` as a native workflow
trigger. The methodology resolves this by polling from a long-lived
Claude Code session.

A maintainer starts a Claude Code session (local or in the cloud) and
runs:

```
/loop 15m /backlog-poll
```

Every tick, `/backlog-poll` does roughly the following:

1. Checks `.claude/in-flight/` for outstanding lock files. If any, logs
   what it's waiting on and exits — no new work this tick.
2. Fetches the Project state via GraphQL (per-item: `Status`, `Phase`,
   `V`, `M`, `A`, `Total`, sub-issue relationships).
3. Recomputes `Total = V + M + A` for any items where it drifted, via
   GraphQL mutation.
4. For each item, decides what to do from the `(Status, Phase)` pair
   and advances **one phase per tick**. The decision table is keyed
   off the API state — never off the working tree or merged-to-`main`
   artefacts — so long-running phases whose work-in-progress lives
   only on a feature branch never get re-triggered:

| Status     | Phase                | Action                                                                                |
|------------|----------------------|---------------------------------------------------------------------------------------|
| Triage     | (any)                | None — maintainer scores and advances.                                                |
| In Design  | *(empty)*            | Create design branch; run `/speckit-specify`; open design PR; set Phase = `Spec drafting`. |
| In Design  | `Spec drafting`      | If `[NEEDS CLARIFICATION]` markers exist, run `/speckit-clarify`. Otherwise run `/speckit-plan`; commit; set Phase = `Plan drafting`. |
| In Design  | `Plan drafting`      | Run `/speckit-tasks`; commit; set Phase = `Tasks drafting`.                            |
| In Design  | `Tasks drafting`     | Non-Epic: set Phase = `Designed`. Epic: run `/speckit-taskstoissues`; set Phase = `Decomposing`. |
| In Design  | `Decomposing`        | Verify sub-issues filed; set Phase = `Designed`.                                       |
| In Design  | `Designed`           | None — flag in chat: "design done, drag to Ready when design PR has merged."          |
| Ready      | (any)                | None — maintainer drags to Doing when capacity is available.                          |
| Doing      | `Designed`           | Create impl branch; run `/speckit-implement`; open impl PR; set Phase = `Implementing`. |
| Doing      | `Implementing`       | None — wait for impl PR to merge.                                                     |
| Done       | (any)                | None.                                                                                  |
| (any)      | (mismatched)         | Flag inconsistency in chat without acting (e.g. Status = `Ready` while Phase = `Plan drafting`). |

5. When a skill blocks on a maintainer answer, the agent writes
   `.claude/in-flight/<issue-number>.md` with the question and
   timestamp, asks the question in chat, and exits. The lock file
   makes the next `/loop` tick a no-op until the question is answered
   and the work completes — the agent removes the lock then. Locks
   handle the "currently asking" case; `Phase` handles the "PR open,
   awaiting merge" case.

Both PR-opening transitions stop at *PR open*. Spec and implementation
content are reviewed by humans before they land — the agent saves
typing, not judgement. Adopters with stronger CI and higher trust can
extend either transition to auto-merge on green; the methodology
recommends against starting there.

### A note on the webhook alternative

A webhook-driven variant is possible: a GitHub App listening for
`project_v2_item.edited`, firing `repository_dispatch` at the repo, a
workflow invoking the Claude Code Action with the new status and
issue number. It trades the live-session requirement for hosting a
webhook receiver and moves human-in-the-loop questions from chat to
issue comments. Teams that want hands-off automation can build it on
top of the same trigger contracts above; the methodology doesn't
recommend or document the build in detail. The polling path stays the
canonical orchestration.

---

## Workers

A "worker" is a Claude Code session running `/loop 15m /backlog-poll`.
Multiple workers can cooperate on the same Project, each handling its
own ticket in parallel.

### Joining the pool

You start a worker by running `/backlog-worker-start` in a fresh CC
session. The skill:

1. Reads `repo` from `.claude/backlog-poll.config.json` and derives a
   short repo tag (initials of hyphenated parts, e.g.
   `backlog-navigator` → `bn`).
2. Generates a petname identity like `bn-swift-mango-7234`. The
   `$$` suffix is the shell's PID, preventing local collisions.
3. Writes the identity to `/tmp/backlog-poll-worker-id`.
4. Invokes `/loop 15m /backlog-poll`.

To run a second worker on the same Project, open another CC session
(local or cloud) and run `/backlog-worker-start` there. The second
session generates its own petname; the two never conflict because
`/tmp` is per-container in cloud CC and the PID suffix differs
locally.

### Claiming a ticket

Each tick, `/backlog-poll` reads `Owner` for every Project item
alongside `Status` and `Phase`. The decision is:

- `Owner` == this worker → keep working on the item.
- `Owner` == any other worker → skip it entirely.
- `Owner` is empty → candidate for me to claim.

To claim a candidate, the worker writes its identity into `Owner`
via GraphQL, then **re-reads** `Owner` immediately. If the read-back
returns this worker's identity, the claim succeeded. If it returns a
different identity, another worker raced to claim it first — the
losing worker moves on to the next candidate.

The read-back-confirm pattern handles the small race window between
two workers polling simultaneously.

### Releasing a ticket

Workers hold ownership only when they're actively advancing the
item or waiting on a maintainer chat answer. At natural human-review
gates the worker releases (clears `Owner`):

- After advancing `Phase` to `Designed` — the design PR is open and
  the maintainer needs to review and merge it before dragging to
  Ready.
- After opening the implementation PR (`Phase = Implementing`,
  `Status = Doing`) — the impl PR is open awaiting review.

Releasing lets a different worker pick the ticket up when it next
becomes actionable (e.g. when the maintainer drags from Ready to
Doing).

### When workers go wrong

If a worker dies (its container shuts down, it gets stuck, etc.) any
ticket still bearing its `Owner` is stranded. Other workers, seeing
a foreign `Owner`, will skip it forever. Recovery is currently
manual: a maintainer clears the `Owner` field on the stranded
ticket in the Project UI, after which any worker can re-claim it.

A heartbeat field (last-seen timestamp) with stale-after-N-minutes
auto-recovery is a future refinement; not in scope yet.

---

## Reference artefacts

### `/backlog-worker-start` and `/backlog-poll`

Two skills together form the orchestrator:

- `.claude/skills/backlog-worker-start/SKILL.md` — generates the
  worker identity into `/tmp/backlog-poll-worker-id` and kicks off
  `/loop 15m /backlog-poll`. Run this once per CC session.
- `.claude/skills/backlog-poll/SKILL.md` — the per-tick logic: read
  the worker identity, fetch Project state, claim or continue work
  on items, advance the `Phase` field, ask questions in chat when
  blocked.

Both are canonical references; adopters can copy them into their own
repo or reference this one. The high-level flow is described in
*Orchestration* and *Workers* above.

### Auto-add to Project

See the snippet under *Intake*. Uses `actions/add-to-project@v1`
unchanged.

---

## Public visibility

The whole point of "anyone can read the backlog" is that the Project
itself is publicly viewable. Make the Project's visibility public in
its settings.

Link to it prominently:

- From the repo's `README.md`.
- From release notes ("see the Project for what's next").
- From `CONTRIBUTING.md` ("see the Project for the current queue;
  file an issue to propose work").

There is no generated `BACKLOG.md` or status page. If you want one,
write a workflow that periodically renders the Project's GraphQL
output to a committed file — the methodology does not require it.

---

## Adoption checklist

For a repo adopting this methodology:

> **Fast path**: this repo ships `scripts/setup-project.sh` which
> handles steps 2, 5, 6 and the config file in one command:
> `scripts/setup-project.sh <owner> <repo>`. It prints what remains
> as manual UI steps (Status options, built-in workflows, the
> `PROJECT_TOKEN` secret). Steps 1 and 7+ are still done by hand.

1. **Install spec-kit** (see *Toolchain*). Commit `.claude/skills/` and
   `.specify/`.
2. **Create the Project**. One per repo. Visibility: public. Configure
   the field schema in *Project schema*.
3. **Set the default Status** to `Triage` in the Project's settings.
4. **Enable GitHub's built-in `item_closed → Done` Project workflow.**
5. **Add the issue template** at
   `.github/ISSUE_TEMPLATE/backlog-item.yml` (see *Intake*).
6. **Add the auto-add workflow** at
   `.github/workflows/add-to-project.yml` (see *Intake*).
7. **Adopt the orchestrator**. Copy or reference
   `.claude/skills/backlog-worker-start/SKILL.md` and
   `.claude/skills/backlog-poll/SKILL.md`, then run
   `/backlog-worker-start` from a Claude Code session (local or
   cloud).
8. **Decide your Epic convention**. The methodology assumes Epics are
   parent issues using sub-issues. If your team uses milestones or
   labels for Epics, document the deviation locally.
9. **Link the Project** from `README.md` and `CONTRIBUTING.md`.
10. **Retire any prior `BACKLOG.md`**. Migrate items by filing them as
    issues (one-time effort) and archiving the file. A reference
    runbook lives at `docs/migration/from-backlog-md.md` in this repo.

---

## Open questions and known limits

- **Requires a live Claude Code session.** If no CC session is running
  `/loop 15m /backlog-poll`, cards sit on the board untouched. For
  cloud CC a long-running session is the natural home; for local CC
  the maintainer has to remember to start it. Lock files in
  `.claude/in-flight/` survive container churn, so a freshly resumed
  session picks up where the last left off.
- **Dispatch latency.** Status-change to action is up to one `/loop`
  interval (~15 minutes by default). Acceptable for backlog work; tune
  the interval if you want tighter.
- **Total field drift within a tick.** Between ticks, V/M/A edits don't
  immediately update Total. Acceptable for triage; not for hard sorting.
- **Reproducibility.** Unlike a `BACKLOG.md` in git, the Project state
  at the time of a given commit cannot be reconstructed from the repo
  alone. If you need that, render a snapshot to a committed file on a
  schedule.
- **Permissions.** Project visibility is repo-independent. A public
  Project on a private repo can leak issue titles; check before making
  the Project public.
- **Speckit version drift.** Pin spec-kit to a release tag in the
  install command and re-run the init periodically to pull updates.
  Skills are markdown; diffing the update against your committed
  copies is straightforward.
