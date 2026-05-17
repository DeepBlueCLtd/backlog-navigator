#!/usr/bin/env bash
#
# scripts/setup-project.sh
#
# One-shot setup of a GitHub Project for a repo adopting the backlog
# methodology. See ../METHODOLOGY.md and ../docs/adopt-methodology.md
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
# Optional flags (set as env vars):
#   SOURCE_BRANCH=main            # methodology repo branch to fetch skills from
#   SOURCE_REPO=DeepBlueCLtd/backlog-navigator
#   SKIP_SKILL_FETCH=0            # set to 1 to skip fetching orchestrator skills
#
# Example:
#   scripts/setup-project.sh DeepBlueCLtd backlog-navigator "Backlog Navigator"
#
# Prerequisites:
#   - gh CLI 2.40+, authenticated with scopes: repo, project, read:org
#   - jq
#   - curl (for fetching skill files)
#   - Run from the root of the target repo's working tree (so config and
#     workflow files land in the right place).
#

set -euo pipefail

# ---------- args ----------
OWNER="${1:-}"
REPO="${2:-}"
TITLE="${3:-${REPO} backlog}"

SOURCE_REPO="${SOURCE_REPO:-DeepBlueCLtd/backlog-navigator}"
SOURCE_BRANCH="${SOURCE_BRANCH:-main}"
SKIP_SKILL_FETCH="${SKIP_SKILL_FETCH:-0}"

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  cat <<EOF >&2
Usage: $0 <owner> <repo> [project-title]

Example:
  $0 DeepBlueCLtd backlog-navigator "Backlog Navigator"

Optional environment variables:
  SOURCE_BRANCH=main           # branch of $SOURCE_REPO to fetch skills from
  SOURCE_REPO=owner/repo       # methodology repo (default: $SOURCE_REPO)
  SKIP_SKILL_FETCH=1           # skip fetching the orchestrator skills
EOF
  exit 2
fi

# ---------- prereqs ----------
command -v gh   >/dev/null || { echo "ERROR: gh CLI not installed" >&2; exit 1; }
command -v jq   >/dev/null || { echo "ERROR: jq not installed" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not installed" >&2; exit 1; }

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

# ---------- orchestrator skills ----------
SKILLS_FETCHED=""
if [[ "$SKIP_SKILL_FETCH" != "1" ]]; then
  echo "[6/6] Fetching orchestrator skills from $SOURCE_REPO@$SOURCE_BRANCH..."
  mkdir -p .claude/skills/backlog-worker-start .claude/skills/backlog-poll
  fetch_skill() {
    local name="$1"
    local url="https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/.claude/skills/${name}/SKILL.md"
    if curl -fsSL "$url" -o ".claude/skills/${name}/SKILL.md"; then
      echo "      ✓ .claude/skills/${name}/SKILL.md"
    else
      echo "      ✗ failed to fetch ${name} from ${url}" >&2
      return 1
    fi
  }
  fetch_skill "backlog-worker-start"
  fetch_skill "backlog-poll"
  SKILLS_FETCHED="yes"
  echo
else
  echo "[6/6] Skipped skill fetch (SKIP_SKILL_FETCH=1)."
  echo "      Copy .claude/skills/backlog-worker-start/ and .claude/skills/backlog-poll/"
  echo "      from $SOURCE_REPO before running /backlog-worker-start."
  echo
fi

# ---------- summary + manual steps ----------
cat <<EOF
============================================================
Automated setup complete.

Project:  $PROJECT_URL
Files written:
  .claude/backlog-poll.config.json
  .github/ISSUE_TEMPLATE/backlog-item.yml
$( [[ -n "$SKILLS_FETCHED" ]] && echo "  .claude/skills/backlog-worker-start/SKILL.md
  .claude/skills/backlog-poll/SKILL.md" )

------------------------------------------------------------
Remaining manual steps (UI / one-off):

1. Configure the Status field options
   - The default Status field came with placeholder options. Open
     $PROJECT_URL → Settings (⋯) → click the Status field → edit options.
   - Replace with these five, in this order:
     Triage, In Design, Ready, Doing, Done

2. Configure built-in Project workflows
   In the Project, click 'Workflows' (top-right). Enable these three:
   - "Auto-add to project"     → filter: repo:$OWNER/$REPO is:issue
                                 (auto-adds new issues; no Action / PAT
                                  needed)
   - "Item added to project"   → action: Set Status to Triage
   - "Item closed"             → action: Set Status to Done

3. Install spec-kit (creates .specify/ and .claude/skills/speckit-*/):
   uv tool run --from git+https://github.com/github/spec-kit.git \\
       specify init . --integration claude --force

4. Commit the new files:
   git add .claude/ .specify/ \\
           .github/ISSUE_TEMPLATE/backlog-item.yml \\
           CLAUDE.md
   git commit -m "feat: adopt backlog methodology (Project #$PROJECT_NUMBER)"
   git push

5. (Optional) Migrate any existing BACKLOG.md items
   See docs/migration/from-backlog-md.md in $SOURCE_REPO.

6. Start the orchestrator
   In a Claude Code session at this repo, run:
   /backlog-worker-start

For the full walkthrough, see:
   https://github.com/$SOURCE_REPO/blob/$SOURCE_BRANCH/docs/adopt-methodology.md

Verify your setup any time:
   curl -fsSL https://raw.githubusercontent.com/$SOURCE_REPO/$SOURCE_BRANCH/scripts/check-setup.sh | bash
============================================================
EOF
