#!/usr/bin/env bash
#
# scripts/setup-project.sh
#
# One-shot setup of a GitHub Project for a repo adopting the backlog
# methodology. See ../METHODOLOGY.md and ../docs/migration/from-backlog-md.md
# for context.
#
# Does as much as the GitHub API allows; prints clear manual steps for
# the rest at the end. Designed to be idempotent-friendly: refuses to
# run if .claude/backlog-poll.config.json already exists, so you don't
# accidentally create duplicate Projects.
#
# Usage:
#   scripts/setup-project.sh <owner> <repo> [project-title]
#
# Example:
#   scripts/setup-project.sh DeepBlueCLtd backlog-navigator "Backlog Navigator"
#
# Prerequisites:
#   - gh CLI 2.40+, authenticated with scopes: repo, project, read:org
#   - jq
#   - Run from the root of the target repo's working tree (so config and
#     workflow files land in the right place).
#

set -euo pipefail

# ---------- args ----------
OWNER="${1:-}"
REPO="${2:-}"
TITLE="${3:-${REPO} backlog}"

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  cat <<EOF >&2
Usage: $0 <owner> <repo> [project-title]

Example:
  $0 DeepBlueCLtd backlog-navigator "Backlog Navigator"
EOF
  exit 2
fi

# ---------- prereqs ----------
command -v gh >/dev/null || { echo "ERROR: gh CLI not installed" >&2; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq not installed" >&2; exit 1; }

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: not authenticated with gh. Run:" >&2
  echo "  gh auth login -s 'repo,project,read:org'" >&2
  exit 1
fi

if [[ -f .claude/backlog-poll.config.json ]]; then
  echo "ERROR: .claude/backlog-poll.config.json already exists." >&2
  echo "This repo is already set up. Remove the file (and ideally also the" >&2
  echo "linked Project) before re-running." >&2
  exit 1
fi

echo "============================================================"
echo "Backlog methodology setup for $OWNER/$REPO"
echo "============================================================"
echo

# ---------- create project ----------
echo "[1/6] Creating Project '$TITLE'..."
project_json=$(gh project create --owner "$OWNER" --title "$TITLE" --format json)
PROJECT_NUMBER=$(echo "$project_json" | jq -r '.number')
PROJECT_ID=$(echo "$project_json" | jq -r '.id')
PROJECT_URL=$(echo "$project_json" | jq -r '.url')
echo "      ✓ Project #$PROJECT_NUMBER"
echo "        $PROJECT_URL"
echo

# ---------- detect owner type ----------
if gh api "orgs/$OWNER" >/dev/null 2>&1; then
  OWNER_TYPE="organization"
else
  OWNER_TYPE="user"
fi
echo "      (owner type: $OWNER_TYPE)"
echo

# ---------- custom fields ----------
echo "[2/6] Adding custom fields..."

# Text
gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Owner" --data-type TEXT >/dev/null
echo "      ✓ Owner (text)"

# Single-selects
gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Phase" --data-type SINGLE_SELECT \
    --single-select-options "Spec drafting,Plan drafting,Tasks drafting,Decomposing,Designed,Implementing" \
    >/dev/null
echo "      ✓ Phase (single-select, 6 options)"

gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Category" --data-type SINGLE_SELECT \
    --single-select-options "Feature,Enhancement,Tech Debt,Bug,Documentation,Spike" \
    >/dev/null
echo "      ✓ Category (single-select, 6 options)"

gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Complexity" --data-type SINGLE_SELECT \
    --single-select-options "Low,Medium,High" \
    >/dev/null
echo "      ✓ Complexity (single-select, 3 options)"

# Numbers
for f in V M A Total; do
  gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
      --name "$f" --data-type NUMBER >/dev/null
  echo "      ✓ $f (number)"
done
echo

# ---------- visibility ----------
echo "[3/6] Setting visibility to public..."
gh api graphql -f query='
mutation($projectId: ID!) {
  updateProjectV2(input: { projectId: $projectId, public: true }) {
    projectV2 { id public }
  }
}' -f projectId="$PROJECT_ID" >/dev/null
echo "      ✓ public"
echo

# ---------- config file ----------
echo "[4/6] Writing .claude/backlog-poll.config.json..."
mkdir -p .claude
cat > .claude/backlog-poll.config.json <<EOF
{
  "project_owner": "$OWNER",
  "project_owner_type": "$OWNER_TYPE",
  "project_number": $PROJECT_NUMBER,
  "repo": "$OWNER/$REPO",
  "default_branch": "main",
  "workspace_dir": "."
}
EOF
echo "      ✓ wrote .claude/backlog-poll.config.json"
echo

# ---------- issue template ----------
echo "[5/6] Writing .github/ISSUE_TEMPLATE/backlog-item.yml..."
mkdir -p .github/ISSUE_TEMPLATE
cat > .github/ISSUE_TEMPLATE/backlog-item.yml <<'EOF'
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
EOF
echo "      ✓ wrote .github/ISSUE_TEMPLATE/backlog-item.yml"
echo

# ---------- auto-add workflow ----------
echo "[6/6] Writing .github/workflows/add-to-project.yml..."
mkdir -p .github/workflows
cat > .github/workflows/add-to-project.yml <<EOF
name: Add issues to backlog
on:
  issues:
    types: [opened]

jobs:
  add:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v1
        with:
          project-url: $PROJECT_URL
          github-token: \${{ secrets.PROJECT_TOKEN }}
EOF
echo "      ✓ wrote .github/workflows/add-to-project.yml"
echo

# ---------- summary + manual steps ----------
cat <<EOF
============================================================
Automated setup complete.

Project:  $PROJECT_URL
Files written:
  .claude/backlog-poll.config.json
  .github/ISSUE_TEMPLATE/backlog-item.yml
  .github/workflows/add-to-project.yml

------------------------------------------------------------
Remaining manual steps (UI / one-off):

1. Configure the Status field options
   - The default Status field came with placeholder options. Open
     $PROJECT_URL → Settings (⋯) → click the Status field → edit options.
   - Replace with these five, in this order:
     Triage, In Design, Ready, Doing, Done

2. Configure built-in Project workflows
   - In the Project, click 'Workflows' (top-right).
   - Enable "Item added to project" → action: Set Status to Triage.
   - Enable "Item closed"           → action: Set Status to Done.

3. Add the PROJECT_TOKEN secret to the repo
   - GitHub → repo Settings → Secrets and variables → Actions → New
     repository secret.
   - Name:  PROJECT_TOKEN
   - Value: a fine-grained PAT with project:write scope for $OWNER.

4. Commit the new files:
   git add .claude/backlog-poll.config.json \\
           .github/ISSUE_TEMPLATE/backlog-item.yml \\
           .github/workflows/add-to-project.yml
   git commit -m "feat: adopt backlog methodology (Project #$PROJECT_NUMBER)"
   git push

5. Install spec-kit if not already present (creates .specify/ and
   .claude/skills/speckit-*/):
   uv tool run --from git+https://github.com/github/spec-kit.git \\
       specify init . --integration claude --force

6. Migrate any existing BACKLOG.md items
   See docs/migration/from-backlog-md.md, step 7 onward.

7. Start polling
   In a Claude Code session at this repo, run:
   /backlog-worker-start
============================================================
EOF
