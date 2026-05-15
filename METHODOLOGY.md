# Backlog as Issues + Project: a methodology

This document describes a way of running a project's backlog using
GitHub Issues and a single GitHub Project per repo, with status
transitions that *drive* work (rather than just report on it). It is
written as a general adoption guide — any repo that wants to manage a
backlog this way can follow it, regardless of language or stack.

It is a sibling to [`ADOPTING.md`](ADOPTING.md), which covers the
markdown-based Backlog Navigator. The two approaches coexist in this
repo today; this document captures the direction the project is moving.

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

**Epics** are parent issues. When a maintainer drags an Epic to
**In Design**, a Claude Code agent interviews on the issue, drafts a
spec PR, and decomposes the Epic into sub-issues. Non-Epic items get
the same interview-then-spec-PR treatment. Moving a card to **Doing**
fires a second agent that reads the linked spec and opens an
implementation PR for human review.

The Project itself is publicly viewable — there is no separate
`BACKLOG.md` to maintain.

---

## Project schema

Create a Project (org-level or user-level, your choice) and link it to
the repo. Configure it with these fields:

| Field        | Type                | Values / notes                                                              |
|--------------|---------------------|------------------------------------------------------------------------------|
| Status       | Single-select       | `Triage`, `In Design`, `Ready`, `Doing`, `Done`                              |
| Category     | Single-select       | e.g. `Feature`, `Enhancement`, `Tech Debt`, `Bug`, `Documentation`, `Spike`  |
| Complexity   | Single-select       | `Low`, `Medium`, `High`                                                      |
| V            | Number              | Value score (0–5)                                                            |
| M            | Number              | Mission score (0–5)                                                          |
| A            | Number              | Affordability / ease score (0–5)                                             |
| Total        | Number              | `V + M + A`, recomputed by an Action — see below                             |

Make the Project's visibility **public** so anyone can read the
backlog without a GitHub account.

### Why V / M / A + Total

The three-dimensional score captures *why* an item ranks where it does
rather than collapsing rationale into a single P0/P1/P2. Total is the
sortable summary. Adopters who don't want this can keep a single
`Priority` field instead — the rest of the methodology is unchanged.

### Maintaining Total

Projects v2 has no computed fields. A small workflow listens for item
edits and writes `Total = V + M + A` back. Sketch:

```yaml
# .github/workflows/recompute-total.yml
on:
  schedule: [{ cron: "*/15 * * * *" }]   # belt-and-braces fallback
  workflow_dispatch:
  # Project item edits don't have a first-class trigger; either poll on
  # a schedule or wire a project_v2_item.edited webhook via a GitHub App.

jobs:
  recompute:
    runs-on: ubuntu-latest
    steps:
      - name: Recompute Total for all items
        env:
          GH_TOKEN: ${{ secrets.PROJECT_TOKEN }}   # PAT with project:write
        run: |
          # GraphQL: list project items, read V/M/A, write V+M+A to Total
          # See docs/methodology/recompute-total.gql for the queries.
```

A real implementation needs a GitHub App or a PAT with `project` scope;
the schedule-based fallback handles the common case where there is no
webhook listener.

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

The item is being specified. A spec file is being produced.

**On entry**: a Claude Code agent is dispatched (see *Agent triggers*
below). For non-Epic items, the agent posts clarifying questions on
the issue and, once answered, opens a PR adding
`specs/NNN-<slug>/spec.md`. For Epic parent issues, the agent
additionally decomposes the Epic into sub-issues, each filed as a
child of the parent.

**Exit criteria**: the spec PR is merged. The issue body is updated
(by the agent or maintainer) with a link to the merged spec file.
Maintainer drags the card to **Ready**.

### Ready

A queue of shovel-ready items: spec exists, scope is understood, no
external blockers. Order within this column is the de facto work
queue.

**Exit criteria**: capacity is available to implement. Maintainer
drags to **Doing**.

### Doing

Implementation is in flight.

**On entry**: a Claude Code agent is dispatched. It reads the issue,
follows the link to the spec, implements the change, and opens a PR
ready for human review. The PR references the issue with a closing
keyword (`Closes #NNN`).

**Exit criteria**: the implementation PR is merged. The issue closes
automatically, and the Project's built-in workflow moves the card to
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

**Decomposition**: when a maintainer drags an Epic to **In Design**,
the dispatched agent first interviews on the parent issue to clarify
scope, then creates child sub-issues for each distinct work unit. Each
child is added to the Project (also in Triage or In Design,
depending on convention) and inherits the parent's Epic linkage
through the sub-issue relationship.

**Status independence**: once child sub-issues exist, each progresses
through the state machine on its own. The Epic parent stays in
**In Design** until all children are at least **Ready**, then moves
through **Ready / Doing / Done** in step with its children. Adopters
can pick a stricter or looser convention; the methodology only
requires that the Epic parent does not close until all children are
closed (GitHub enforces this automatically for sub-issues).

---

## Agent triggers

The methodology assumes status changes can trigger work. This
section describes the **contract** for each trigger; the concrete
agent prompt is project-specific.

A trigger is fired by a workflow that listens for Project status
changes (via a `project_v2_item.edited` webhook through a GitHub App,
or by polling) and dispatches a Claude Code session — for example via
the Claude Code Action, or via a custom runner.

### Trigger: Status → `In Design`

**Input**:
- The issue (title, body, comments).
- Whether the issue is an Epic parent (has the `epic` label or is
  referenced as a parent by other issues).

**Expected output**:
- One or more clarifying questions posted as a comment on the issue,
  if scope is unclear.
- Once questions are answered (or if none were needed): a PR adding
  `specs/<NNN>-<slug>/spec.md` with the spec content.
- For Epic parents: in addition to the spec PR, sub-issues are
  created under the parent, each added to the Project.

**Done when**: the spec PR is merged and the issue body contains a
link to the merged spec file.

### Trigger: Status → `Doing`

**Input**:
- The issue.
- The linked spec file at `specs/<NNN>-<slug>/spec.md`.

**Expected output**:
- A branch from the default branch.
- An implementation PR against the default branch, in **ready for
  review** state (not draft), referencing the issue with a closing
  keyword.

**Done when**: the implementation PR is merged. The issue closes
automatically; the Project's built-in workflow advances the card to
`Done`.

### Why "open a PR" and not "self-merge"

Both triggers stop at *PR open*. Spec content and implementation
content are reviewed by humans before they land. The agent saves
typing, not judgement. Adopters with stronger CI and higher trust can
extend either trigger to auto-merge on green; the methodology
recommends against starting there.

---

## Reference workflow sketches

The workflows in this section are sketches, not turn-key. They show
the shape — adopters fill in tokens, Project IDs, and (in the case of
the trigger workflow) the choice of agent runner.

### Sketch: status → agent dispatch

```yaml
# .github/workflows/project-status-trigger.yml
# Dispatches a Claude Code agent when an item's Status changes.

on:
  workflow_dispatch:           # invoked by the webhook receiver
    inputs:
      issue_number:
        required: true
      new_status:
        required: true         # "In Design" | "Doing"

jobs:
  in-design:
    if: ${{ inputs.new_status == 'In Design' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run design agent
        uses: anthropics/claude-code-action@v1  # or equivalent
        with:
          prompt-file: .github/prompts/in-design.md
          issue-number: ${{ inputs.issue_number }}

  doing:
    if: ${{ inputs.new_status == 'Doing' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run build agent
        uses: anthropics/claude-code-action@v1
        with:
          prompt-file: .github/prompts/doing.md
          issue-number: ${{ inputs.issue_number }}
```

The webhook receiver (a small GitHub App or serverless function)
listens for `project_v2_item.edited`, reads the new Status, and
invokes `workflow_dispatch` on this workflow with the issue number
and new status as inputs.

### Sketch: Total recomputer

See the snippet under *Project schema*. The real implementation is
~30 lines of GraphQL: list items in the Project, read V/M/A, write
V+M+A to Total if different.

### Sketch: auto-add to Project

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

1. **Create the Project**. One Project per repo. Visibility: public.
   Configure the field schema in *Project schema*.
2. **Set the default Status** to `Triage` in the Project's settings.
3. **Enable GitHub's built-in `item_closed → Done` Project workflow.**
4. **Add the issue template** at
   `.github/ISSUE_TEMPLATE/backlog-item.yml` (see *Intake*).
5. **Add the auto-add workflow** at
   `.github/workflows/add-to-project.yml` (see *Intake*).
6. **Add the Total recomputer** at
   `.github/workflows/recompute-total.yml` (see *Project schema*).
7. **Wire the status-trigger dispatcher**. This is the most
   project-specific step: a webhook receiver that listens for Project
   item edits and dispatches your agent of choice. The reference
   sketch above uses Claude Code; adopters can substitute.
8. **Decide your Epic convention**. The methodology assumes Epics are
   parent issues using sub-issues. If your team uses milestones or
   labels for Epics, document the deviation locally.
9. **Link the Project** from `README.md` and `CONTRIBUTING.md`.
10. **Retire any prior `BACKLOG.md`**. Migrate items by filing them as
    issues (one-time effort) and archiving the file.

---

## Open questions and known limits

- **No first-class trigger for Project item edits.** GitHub Actions
  does not have a native `on: project_v2_item.edited` trigger.
  Wiring the status-change dispatch requires either a GitHub App
  receiving webhooks or polling. This is the heaviest piece of
  infrastructure the methodology requires.
- **Total field drift.** Until a webhook-based recomputer is wired,
  the schedule-based fallback means Total can be a few minutes stale.
  Acceptable for triage; not acceptable for hard sorting.
- **Reproducibility.** Unlike a `BACKLOG.md` in git, the Project state
  at the time of a given commit cannot be reconstructed from the repo
  alone. If you need that, render a snapshot to a committed file on a
  schedule.
- **Permissions.** Project visibility is repo-independent. A public
  Project on a private repo can leak issue titles; check before making
  the Project public.
