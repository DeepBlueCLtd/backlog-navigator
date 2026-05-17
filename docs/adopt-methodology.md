# Adopting the backlog methodology

This is the **how-to** for adopting the methodology described in
[`METHODOLOGY.md`](../METHODOLOGY.md) in your own repo. It's a
walkthrough — literal commands, expected outputs, verification at
each step, and a troubleshooting section seeded from real failures.

You should be able to go from a fresh repo to a running orchestrator
in ~20 minutes. If you have an existing `BACKLOG.md`, allow another
~20 minutes for migration.

---

## At a glance

You'll end up with:

- A **public GitHub Project** linked to your repo, with the
  methodology's schema (`Status`, `Phase`, `Owner`, `Category`,
  `Complexity`, `V`, `M`, `A`, `Total`).
- An **issue template** (`.github/ISSUE_TEMPLATE/backlog-item.yml`)
  and an **auto-add workflow** so new issues land in `Triage`.
- **Spec-kit** installed (`.claude/skills/speckit-*/`, `.specify/`).
- The **orchestrator skills** (`backlog-worker-start`,
  `backlog-poll`) in `.claude/skills/`.
- A **config file** (`.claude/backlog-poll.config.json`) pointing the
  orchestrator at your Project.

Then, in any Claude Code session against the repo, you run
`/backlog-worker-start` and the orchestrator starts polling the
Project, claiming work, and producing spec / plan / tasks / impl PRs
as you drag cards through the state machine.

---

## Prerequisites

Have these on your local machine:

| Tool | Version | How to check | If missing |
|------|---------|--------------|------------|
| `gh` CLI | 2.40 or later | `gh --version` | <https://cli.github.com/> |
| `jq` | any modern | `jq --version` | `brew install jq` / `apt install jq` / `dnf install jq` |
| `uv` | 0.4 or later | `uv --version` | <https://docs.astral.sh/uv/> |
| `python3` | 3.11+ | `python3 --version` | OS package manager |
| `git` | any modern | `git --version` | OS package manager |
| Claude Code | CLI or web | <https://claude.com/claude-code> | — |

And these on GitHub:

- **Auth scopes**: `gh auth status` should list `repo`, `project`,
  `read:org`. If not, run:

  ```sh
  gh auth refresh -s repo,project,read:org
  ```

- **Project creation permission** on the org or user you want to own
  the Project. Org-owned Projects need org admin or appropriate
  member permission.

---

## What you'll do, in five phases

1. **Bootstrap the Project + scaffolding.** One script, mostly
   automatic.
2. **Manual UI steps** the script can't do (Status field options,
   built-in Project workflows — including the auto-add).
3. **Install spec-kit** (one `uv` command).
4. **Commit** the new files and **push**.
5. **Start the orchestrator** from a Claude Code session.

The migration of an existing `BACKLOG.md` is an optional sixth phase
documented at the end.

---

## Phase 1 — Bootstrap the Project + scaffolding

Clone your target repo and `cd` into it:

```sh
git clone https://github.com/your-org/your-repo
cd your-repo
```

Run the setup script. It lives in *this* (the methodology) repo, but
you don't need to clone it — just fetch and run:

```sh
curl -fsSL https://raw.githubusercontent.com/DeepBlueCLtd/backlog-navigator/main/scripts/setup-project.sh \
  | bash -s your-org your-repo "Your Project Title"
```

(If you'd rather not `curl | bash`, clone the methodology repo first
and run the script directly:

```sh
git clone https://github.com/DeepBlueCLtd/backlog-navigator /tmp/bn
/tmp/bn/scripts/setup-project.sh your-org your-repo "Your Project Title"
```

…run from your target repo's directory.)

### What the script does

1. Creates a public GitHub Project for your org.
2. Adds the 8 custom fields with their options.
3. Flips Project visibility to public.
4. Writes `.claude/backlog-poll.config.json` pointing the orchestrator
   at the new Project.
5. Writes `.github/ISSUE_TEMPLATE/backlog-item.yml`.
6. Fetches the two orchestrator skills from the methodology repo into
   your `.claude/skills/`.
7. Prints the remaining manual UI steps.

(There is **no auto-add workflow file** to write — the auto-add
behaviour is handled by a built-in Project workflow you'll enable in
Phase 2. No `PROJECT_TOKEN` secret or external Action needed.)

### Verify Phase 1

After the script exits:

```sh
ls .claude/backlog-poll.config.json \
   .claude/skills/backlog-worker-start/SKILL.md \
   .claude/skills/backlog-poll/SKILL.md \
   .github/ISSUE_TEMPLATE/backlog-item.yml
```

All four files should exist. And:

```sh
gh project field-list <project-number> --owner your-org \
  | jq -r '.fields[].name' | sort
```

Should include: `A`, `Assignees`, `Category`, `Complexity`, `Labels`,
`Owner`, `Phase`, `Status`, `Title`, `Total`, `V`, `M`, plus a handful
of GitHub defaults. The eight custom fields are the ones to confirm:
`Status`, `Phase`, `Owner`, `Category`, `Complexity`, `V`, `M`, `A`,
`Total`.

If any of the custom fields is missing — see
[Troubleshooting → Field-create failed silently](#field-create-failed-silently).

---

## Phase 2 — The four UI-only steps

The Projects v2 API has gaps. These four things still need a click in
the GitHub UI. The script prints these at the end too, but they're
listed here for reference.

### 2a. Configure the Status field options

The default `Status` field came with placeholder options. Replace
them.

1. Open your Project at `https://github.com/orgs/your-org/projects/<n>`.
2. Click the `…` menu → **Settings** → **Status** field → **Manage
   options**.
3. Replace existing options with these five, **in this exact order**:
   - `Triage`
   - `In Design`
   - `Ready`
   - `Doing`
   - `Done`
4. Save.

### 2b. Configure the built-in Project workflows

Three workflows give you the full auto-triage flow without any
secrets or GitHub Actions:

1. In the Project, click **Workflows** (top-right).
2. **"Auto-add to project"** → enable.
   - Set the filter to `repo:your-org/your-repo is:issue`
     (substitute your owner/repo).
   - Optional: add `is:open` and exclude labels you don't want on the
     backlog (e.g. `-label:question`).
   - Save.
3. **"Item added to project"** → enable → set action to
   *Set value: Status = Triage*. Save.
4. **"Item closed"** → enable → set action to
   *Set value: Status = Done*. Save.

Together: new issues automatically land in `Triage`; closing an issue
marks it `Done`. No `PROJECT_TOKEN` secret, no Action, no PAT.

### 2c. Verify Phase 2

File a throwaway issue in your repo (the regular GitHub Issues UI is
fine). Within ~30 seconds it should appear on your Project board
under `Triage`. If not, see
[Troubleshooting → Auto-add isn't firing](#auto-add-isnt-firing).
Close that throwaway issue — verify it moves to `Done`.

---

## Phase 3 — Install spec-kit

Spec-kit provides the per-phase skills (`speckit-specify`,
`speckit-plan`, etc.) the orchestrator drives. Install in your repo:

```sh
uv tool run --from git+https://github.com/github/spec-kit.git \
    specify init . --integration claude --force
```

This adds `.claude/skills/speckit-*/` and `.specify/`. Both should
be committed — they're the source of truth for the per-phase
workflow.

### Verify Phase 3

```sh
ls .claude/skills/ | grep speckit | head
```

You should see at least: `speckit-specify`, `speckit-plan`,
`speckit-tasks`, `speckit-taskstoissues`, `speckit-implement`, plus a
few quality skills (`speckit-clarify`, `speckit-analyze`,
`speckit-checklist`) and the git-integration skills.

---

## Phase 4 — Commit and push

```sh
git add .claude/ .specify/ .github/ISSUE_TEMPLATE/ CLAUDE.md
git commit -m "feat: adopt backlog methodology (Project #<n>)"
git push
```

(Replace `<n>` with the Project number from Phase 1.)

### Verify Phase 4

```sh
git log --oneline -1
```

Confirms the commit landed. The push to GitHub should succeed without
warnings. If the auto-add workflow fires for any open issue you have,
you'll see those land on the Project board.

---

## Phase 5 — Start the orchestrator

In a Claude Code session at this repo (local CLI or
[claude.com/claude-code](https://claude.com/claude-code) web), run:

```
/backlog-worker-start
```

You should see something like:

> Worker **`xx-swift-mango-7234`** ready. Polling the backlog every
> 15 minutes; claimed tickets will appear under this name in the
> Project's `Owner` field.

…where `xx` is a short derivation of your repo name (e.g. `my-repo`
becomes `mr`).

The skill then invokes `/loop 15m /backlog-poll` — you'll see ticks
arrive every 15 minutes. Each tick:

- Lists what's outstanding,
- Claims one unowned item,
- Advances it one phase (`/speckit-specify` for fresh `In Design`
  items, etc.).

### What to expect on the first tick

If you have no issues yet: the orchestrator reports "all clean" and
sleeps. File an issue using the new template, drag it to `In Design`,
and the next tick (or run `/backlog-poll` manually for an immediate
poll) will produce a spec PR.

If you migrated an existing `BACKLOG.md` (see below): the orchestrator
will start working through the queue, top of `Total` first.

---

## Optional Phase 6 — Migrate an existing `BACKLOG.md`

If you're starting greenfield, skip this section.

If you have an existing `BACKLOG.md` (or similar tabular backlog),
the *generic* approach is:

1. **Parse your file** into rows.
2. **File each row as a GitHub issue** with `gh issue create`.
3. **Add each issue to the Project** with `gh project item-add`.
4. **Set its field values** with `gh project item-edit` per row.
5. **Close any "done"/"complete" rows** with `gh issue close`.
6. **Archive the old file** under `docs/history/` and link from
   `README.md` to the new Project.

The methodology repo's testbed migration is a worked example you can
copy and adapt:

- Runbook: <https://github.com/DeepBlueCLtd/backlog-navigator/blob/main/docs/migration/from-backlog-md.md>
- Working script for the testbed:
  <https://github.com/DeepBlueCLtd/backlog-navigator/blob/main/scripts/migrate-testbed-items.sh>

The script is hard-coded to the testbed's 12 issues — fork it,
replace the `process_item` lines with rows from your own backlog, and
run.

---

## Verifying the whole adoption

Run the bundled diagnostic anytime:

```sh
curl -fsSL https://raw.githubusercontent.com/DeepBlueCLtd/backlog-navigator/main/scripts/check-setup.sh \
  | bash
```

It checks every prerequisite and post-condition listed above. Useful
the first time, and useful any time later if the orchestrator
suddenly starts behaving oddly.

---

## Troubleshooting

### gh isn't authenticated for `project` scope

Symptom: `gh project create` or `field-create` errors with
`HTTP 401` or `Forbidden`.

Fix:

```sh
gh auth refresh -s repo,project,read:org
```

Then re-run.

### `jq: command not found`

Install jq:

- macOS: `brew install jq`
- Ubuntu/Debian: `sudo apt install jq`
- Fedora: `sudo dnf install jq`

Re-run the script. It's idempotent so partial progress is preserved.

### Field-create failed silently

If `scripts/setup-project.sh` exited cleanly but `gh project
field-list` doesn't show all 8 expected custom fields, something
swallowed a field-create error.

Diagnosis:

```sh
gh project field-list <project-number> --owner your-org --format json \
  | jq -r '.fields[].name' | sort
```

Compare against the expected set above. Re-create just the missing
ones, e.g.:

```sh
gh project field-create <project-number> --owner your-org \
    --name "Category" --data-type SINGLE_SELECT \
    --single-select-options "Feature,Enhancement,Tech Debt,Bug,Documentation,Spike"
```

Available data types: `TEXT`, `NUMBER`, `SINGLE_SELECT`, `DATE`,
`ITERATION`. The methodology uses the first three.

### `field-id must be provided` during migration

You ran a migration script (or `scripts/migrate-testbed-items.sh`)
and got this error. It means a field referenced by name in the
script doesn't exist in the Project yet. The pre-flight check at the
top of the script lists which ones are missing — add them with
`gh project field-create`, then re-run.

### Auto-add isn't firing

You filed a test issue and it didn't show up on the Project board
within ~60 seconds.

Common causes:

- **The "Auto-add to project" Project workflow isn't enabled.** Open
  the Project → Workflows → confirm "Auto-add to project" is enabled.
- **Filter doesn't match.** Open that workflow's filter and confirm
  it's `repo:your-org/your-repo is:issue` (or whatever you set).
  Filter is case-sensitive.
- **The Project doesn't have access to the repo.** A
  user-owned Project can only see public repos by default — if your
  repo is private, the Project must be owned by an org/user with
  access.
- **You're filing in a different repo than the filter expects.**

### `/backlog-worker-start` says config not found

The skill couldn't read `.claude/backlog-poll.config.json`. Either
you ran the worker from outside the repo's working tree, or Phase 4
(commit + push) didn't include the config file in the working tree of
the CC session.

Fix: confirm `cat .claude/backlog-poll.config.json` returns valid
JSON pointing at your Project.

### Worker generates a fresh ID every tick

Symptom: in cloud Claude Code, each tick reports a different worker
identity, and items keep getting re-claimed.

Cause: `/tmp` is being cleared between ticks (rare; some sandbox
configs). The lock file at `/tmp/backlog-poll-worker-id` is meant to
persist for the life of the container.

Fix: move the worker-id file to a more durable location by editing
`backlog-worker-start/SKILL.md` in your repo to use, e.g.,
`/home/user/.backlog-poll-worker-id` instead of `/tmp/...`. Update
`backlog-poll/SKILL.md` to read from the same path.

### Orchestrator opens conflicting PRs

Two workers claim the same item and both open PRs.

Cause: race in the claim step. Should be very rare — the read-back
confirm catches almost all races.

Fix:

1. Manually clear `Owner` on the contested issue in the UI.
2. Close (don't merge) the duplicate PR.
3. Next tick will re-claim and continue.

---

## Where to ask for help

- **Methodology issues**: open an issue at
  <https://github.com/DeepBlueCLtd/backlog-navigator>.
- **Spec-kit issues**: <https://github.com/github/spec-kit>.
- **Claude Code issues**: <https://github.com/anthropics/claude-code/issues>.

---

## Going deeper

Once you've got it running, these are worth reading:

- [`METHODOLOGY.md`](../METHODOLOGY.md) — the full reference. Field
  semantics, Phase lifecycle, branch strategy, worker pool, why
  things are the way they are.
- [`docs/presentation/methodology-review.html`](presentation/methodology-review.html)
  — 15-slide deck for explaining the methodology to a team.
- The orchestrator skills themselves
  (`.claude/skills/backlog-worker-start/SKILL.md` and
  `.claude/skills/backlog-poll/SKILL.md`) — read them top to bottom
  to understand exactly what each tick does.
