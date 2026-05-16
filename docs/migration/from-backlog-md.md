# Migrating from `BACKLOG.md` to a GitHub Project

A runbook for moving a repo's backlog out of a version-controlled
`BACKLOG.md` and into a public GitHub Project with issues, per the
[methodology](../../METHODOLOGY.md).

Estimated time:

- **~15 minutes** for a small backlog (under 20 items).
- **~1 hour** for a medium backlog (20–100 items) — worth scripting
  the per-item loop; see *Bulk migration* at the end.
- **Significantly longer** beyond that — script everything, including
  a dry-run that prints the planned issues without filing them.

You run these commands locally against your own GitHub account; they
don't run in the orchestrator session.

---

## Prerequisites

1. **`gh` CLI** installed (2.40 or later) and authenticated:

   ```sh
   gh auth login -s "repo,project,read:org"
   ```

   The `project` scope is required for everything below. `read:org` is
   needed if the Project will be owned by an org rather than a user.

2. **`jq`** installed (used by some of the snippets).

3. **Repo cloned locally**, with spec-kit already installed (see
   [`METHODOLOGY.md`](../../METHODOLOGY.md) → *Toolchain*). Confirm:

   ```sh
   test -d .specify && echo "spec-kit ok"
   ```

4. **A backup of the current `BACKLOG.md`** — just in case. Tag the
   commit before you start:

   ```sh
   git tag pre-migration-backlog
   git push origin pre-migration-backlog
   ```

---

## Step 1 — Create the Project

```sh
OWNER="DeepBlueCLtd"        # your GitHub org or user
TITLE="Backlog Navigator"   # human-readable Project title

gh project create --owner "$OWNER" --title "$TITLE" --format json \
    | tee project-create.json | jq .
```

Capture the Project's number and node ID — you'll use them in every
subsequent command:

```sh
PROJECT_NUMBER=$(jq -r '.number' project-create.json)
PROJECT_ID=$(jq -r '.id' project-create.json)
echo "Project #$PROJECT_NUMBER  ($PROJECT_ID)"
```

---

## Step 2 — Configure custom fields

Status, Category, and Complexity are single-select; V, M, A, Total are
numbers. The Project ships with a default Status field — we'll
overwrite its options rather than add a second one.

### 2a. Reset the Status options

```sh
gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
    | jq '.fields[] | select(.name=="Status") | .id' -r \
    > .status-field-id
STATUS_FIELD_ID=$(cat .status-field-id)
```

GitHub doesn't expose Status option editing via `gh project field-*`,
so use a GraphQL mutation:

```sh
gh api graphql -f query='
mutation($projectId: ID!, $fieldId: ID!) {
  updateProjectV2Field(input: {
    projectId: $projectId
    fieldId: $fieldId
    singleSelectOptions: [
      { name: "Triage",    color: GRAY,   description: "Newly filed, awaiting scoring" }
      { name: "In Design", color: BLUE,   description: "Spec being produced" }
      { name: "Ready",     color: PURPLE, description: "Shovel-ready" }
      { name: "Doing",     color: YELLOW, description: "Implementation in flight" }
      { name: "Done",      color: GREEN,  description: "Closed and merged" }
    ]
  }) { projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } } }
}' -f projectId="$PROJECT_ID" -f fieldId="$STATUS_FIELD_ID"
```

### 2b. Create the remaining fields

```sh
# Single-selects
gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Phase" --data-type SINGLE_SELECT \
    --single-select-options "Spec drafting,Plan drafting,Tasks drafting,Decomposing,Designed,Implementing"

gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Category" --data-type SINGLE_SELECT \
    --single-select-options "Feature,Enhancement,Tech Debt,Bug,Documentation,Spike"

gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Complexity" --data-type SINGLE_SELECT \
    --single-select-options "Low,Medium,High"

# Numbers
for f in V M A Total; do
  gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
      --name "$f" --data-type NUMBER
done
```

### 2c. Verify

```sh
gh project field-list "$PROJECT_NUMBER" --owner "$OWNER"
```

You should see seven custom fields plus the defaults (Status, Title,
Assignees, etc.).

---

## Step 3 — Make the Project public

`gh project` doesn't expose visibility, so use GraphQL:

```sh
gh api graphql -f query='
mutation($projectId: ID!) {
  updateProjectV2(input: { projectId: $projectId, public: true })
    { projectV2 { id public } }
}' -f projectId="$PROJECT_ID"
```

Confirm by visiting `https://github.com/orgs/$OWNER/projects/$PROJECT_NUMBER`
in a private browser window (i.e. unauthenticated).

---

## Step 4 — Configure the Project's built-in workflows

These have to be set in the UI today (no API):

1. Open the Project, click **Workflows** in the top-right.
2. Enable **"Item closed"** → set action to **Set Status to Done**.
3. Enable **"Item added to project"** → set action to **Set Status to
   Triage**.

That's it.

---

## Step 5 — Add the issue template

Create `.github/ISSUE_TEMPLATE/backlog-item.yml` with the minimal
template from [`METHODOLOGY.md`](../../METHODOLOGY.md#issue-template).
Commit it to your default branch.

---

## Step 6 — Add the auto-add workflow

Create `.github/workflows/add-to-project.yml` with the snippet from
[`METHODOLOGY.md`](../../METHODOLOGY.md#auto-add-to-project). You'll
need a secret called `PROJECT_TOKEN` — a fine-grained PAT with
`project: write` for the Project's owner. Add it in
**Settings → Secrets and variables → Actions**.

Commit and push the workflow. Test it by opening a throw-away issue
and confirming it lands in the Project as `Triage`. Close it
afterwards.

---

## Step 7 — Migrate existing items

This is the longest step. The goal: for each row in `BACKLOG.md`,
file a GitHub issue, add it to the Project, set the custom field
values, and (for sub-items) link to the parent.

### 7a. Inventory what's in `BACKLOG.md`

Open `BACKLOG.md` and list out every Epic and Item with their fields.
For this repo's bundled dummy backlog, that's:

- 3 Epics (`E01`, `E02`, `E03`).
- 9 Items (`001`–`009`), of which `007` is complete.

For larger backlogs, parse `BACKLOG.md` programmatically — the
parser in `src/parser/` can be reused, or you can write a one-off
script.

### 7b. File the Epics first

Sub-issues require the parent to exist already, so Epics go first.

```sh
EPIC_TITLE="Dummy Epic One"
EPIC_DESC=$'Two open items (#001, #002) and one completed item (#007) — exercises mixed-status epic rendering.\n\nOriginal ID: E01'
gh issue create \
    --title "[epic] $EPIC_TITLE" \
    --body "$EPIC_DESC" \
    --label epic \
    --repo "$OWNER/<repo>" \
    | tee /tmp/epic-e01.txt
```

Note the issue URL it prints — you'll need it.

Add to Project:

```sh
EPIC_ISSUE_URL=$(tail -1 /tmp/epic-e01.txt)
gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" \
    --url "$EPIC_ISSUE_URL" --format json \
    | jq -r '.id' > /tmp/epic-e01-item-id.txt
```

Set the Status to `In Design` (Epics start in design — they're
already approved by being Epics):

```sh
EPIC_ITEM_ID=$(cat /tmp/epic-e01-item-id.txt)
STATUS_OPTION_ID_IN_DESIGN=$(gh project field-list "$PROJECT_NUMBER" \
    --owner "$OWNER" --format json \
    | jq -r '.fields[] | select(.name=="Status") | .options[] | select(.name=="In Design") | .id')

gh project item-edit --id "$EPIC_ITEM_ID" --project-id "$PROJECT_ID" \
    --field-id "$STATUS_FIELD_ID" \
    --single-select-option-id "$STATUS_OPTION_ID_IN_DESIGN"
```

Repeat for `E02` and `E03`.

### 7c. File the Items

For each item in the Items table:

```sh
# Example: item 001
ITEM_TITLE="Bundled dummy item — proposed"
ITEM_DESC=$'Original ID: 001\nOriginal Epic: E01\n\n[Bundled dummy item — proposed](specs/001-dummy-spec/spec.md) — exercises the proposed status lozenge and a Markdown link in the Description column.'

gh issue create --title "$ITEM_TITLE" --body "$ITEM_DESC" \
    --repo "$OWNER/<repo>" \
    | tee /tmp/item-001.txt
```

Add to Project and set fields. The full set per item, expressed as
shell variables you fill in per row:

```sh
NEW_STATUS="In Design"      # mapped from old status; see table below
CATEGORY="Feature"
COMPLEXITY="Medium"
V=4
M=3
A=2
TOTAL=$((V + M + A))         # write 9 in this case

ITEM_URL=$(tail -1 /tmp/item-001.txt)
ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" \
    --url "$ITEM_URL" --format json | jq -r '.id')

# (Use the same gh project item-edit pattern as in 7b for each field.)
```

### 7d. Status and Phase mapping

Use this mapping when filling in `NEW_STATUS` and `NEW_PHASE` for each
row. Phase tells the orchestrator how much speckit work has already
been done — items partway through their lifecycle skip phases the
orchestrator would otherwise re-run.

| `BACKLOG.md` status | New `Status`            | Initial `Phase`        |
|---------------------|-------------------------|------------------------|
| `needs-interview`   | `Triage`                | *(empty)*              |
| `proposed`          | `In Design`             | *(empty)*              |
| `approved`          | `In Design`             | *(empty)*              |
| `specified`         | `In Design`             | `Spec drafting`        |
| `clarified`         | `In Design`             | `Spec drafting`        |
| `planned`           | `Ready`                 | `Designed`             |
| `tasked`            | `Ready`                 | `Designed`             |
| `implementing`      | `Doing`                 | `Implementing`         |
| `blocked`           | `Doing` (flag in chat)  | `Implementing`         |
| `complete`          | close the issue; auto-→ `Done` | (n/a)           |
| `parked`            | close the issue; do not add to Project | (n/a)    |
| `rejected`          | close the issue; do not add to Project | (n/a)    |

If a migrated item already has artefacts on disk (e.g. a `specified`
item with an existing `specs/<id>-*/spec.md`), confirm the Phase is
set so the orchestrator doesn't re-run `/speckit-specify`.

For items mapped to `complete`/`parked`/`rejected`, close the issue
with the appropriate state reason after filing:

```sh
gh issue close <issue-number> --reason completed   # or not-planned
```

### 7e. Link sub-issues to Epics

Sub-issue linkage isn't exposed by `gh issue` directly — use GraphQL:

```sh
# CHILD_ISSUE_ID and EPIC_ISSUE_ID are GitHub global node IDs (not numbers).
# Fetch them with: gh issue view <number> --json id --jq .id
gh api graphql -f query='
mutation($parent: ID!, $child: ID!) {
  addSubIssue(input: { issueId: $parent, subIssueId: $child })
    { issue { number } subIssue { number } }
}' -f parent="$EPIC_ISSUE_ID" -f child="$CHILD_ISSUE_ID"
```

### 7f. Reconcile spec directory names

Existing spec dirs are named `specs/001-dummy-spec/` after the old
BACKLOG.md IDs. New GitHub issue numbers won't match (GitHub assigns
globally per repo). You have two options:

- **Option A: rename spec dirs to match new issue numbers.** Cleanest
  long-term. One-time cost. Update every link to a spec inside its
  matching issue body afterwards.
- **Option B: keep old spec dir names; link explicitly.** Each
  issue body cites the spec path verbatim. Old IDs survive as
  directory prefixes — slight drift, no rewrite cost.

We recommend Option A for the testbed (small data set, clean slate)
and Option B for adopters with substantial spec history.

---

## Step 8 — Create the orchestrator config

```sh
cat > .claude/backlog-poll.config.json <<EOF
{
  "project_owner": "$OWNER",
  "project_owner_type": "organization",
  "project_number": $PROJECT_NUMBER,
  "repo": "$OWNER/<repo>",
  "default_branch": "main"
}
EOF
```

Commit it. The orchestrator skill at
`.claude/skills/backlog-poll/SKILL.md` reads this on every tick.

---

## Step 9 — Archive `BACKLOG.md`

Move the old file to history and update the README:

```sh
git mv BACKLOG.md docs/history/BACKLOG.md.archived
```

Edit the file to add a header at the top:

```markdown
> **Archived.** This backlog moved to the GitHub Project on <DATE>.
> See <project URL>. Kept here as a historical record.
```

Update the repo's `README.md` to point at the Project rather than the
file. Update any CI/workflows that referenced `BACKLOG.md`.

Commit and push.

---

## Step 10 — Start the loop

In a Claude Code session (local or cloud) at this repo:

```
/loop 15m /backlog-poll
```

Verify the first tick:

- It should pre-flight successfully.
- It should report the Project state ("polled at <ts>: ...").
- It may flag inconsistencies left over from migration (e.g. an item
  in `In Design` with no spec). Resolve those by hand.
- Then drag a card and see if the next tick picks it up.

---

## Rollback

If something goes wrong partway through:

- The repo is unchanged until Step 5 (issue template) and Step 6
  (workflow). Until then, just delete the Project (`gh project delete
  $PROJECT_NUMBER --owner $OWNER`) and start over.
- After Step 5–6, revert the workflow/template commits.
- After Step 7, close any issues you filed (`gh issue list --state open
  --label "..."  | xargs -L1 gh issue close`) and delete the Project.
- Step 9 is reversible — `git mv` the BACKLOG.md back.

The `pre-migration-backlog` tag you created in *Prerequisites* lets
you reset to the original state if needed.

---

## Bulk migration (adopters with >50 items)

Roll the per-item loop into a script:

```sh
#!/usr/bin/env bash
# migrate-items.sh — file an issue + add to Project for each row of a CSV
# CSV columns: title,description,category,complexity,V,M,A,new_status,old_id,parent_old_id

set -euo pipefail

while IFS=, read -r title desc cat cmpx v m a status old_id parent_old_id; do
  url=$(gh issue create --title "$title" --body "$desc" --repo "$OWNER/<repo>" \
        | tail -1)
  item_id=$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" \
            --url "$url" --format json | jq -r '.id')

  # set each field via gh project item-edit
  # link to parent if parent_old_id is set
  # close issue if status==complete
done < items.csv
```

Run with `--dry-run` first (you implement it as `echo` instead of
`gh ...`) to inspect what would happen.

---

## Known gotchas

- **`gh project field-create` may not support `--single-select-options`
  on older `gh` versions.** Upgrade to 2.40+ if the option list is
  rejected.
- **Sub-issue API requires the new Issues experience** to be enabled
  for the repo. Confirm in the repo's settings before Step 7e.
- **Closing an issue with `state reason "not planned"` does NOT trigger
  the Project's `item_closed → Done` workflow** — those items end up
  removed from the Project automatically (with the default "remove on
  close" workflow). Adjust your workflow settings if you want them
  retained in `Done`.
- **Public Project on a private repo leaks issue titles.** If your
  repo is private, the Project visibility decision is consequential.
