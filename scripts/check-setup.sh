#!/usr/bin/env bash
#
# scripts/check-setup.sh
#
# Diagnose a repo's adoption of the backlog methodology. Reports
# pass/fail for each prerequisite and post-condition. Exit 0 if all
# checks pass, non-zero otherwise.
#
# Run from the root of a repo that's adopted (or is adopting) the
# methodology. No arguments.
#
# Example output:
#   [PASS]   gh CLI installed (2.45.0)
#   [PASS]   gh auth has 'project' scope
#   [FAIL]   .claude/backlog-poll.config.json missing
#   [WARN]   Project field 'Total' missing
#
# Designed to be runnable via curl|bash:
#   curl -fsSL https://raw.githubusercontent.com/DeepBlueCLtd/backlog-navigator/main/scripts/check-setup.sh | bash
#

set -uo pipefail

# Counters
pass=0
fail=0
warn=0

# ANSI colour helpers (skip if not a TTY)
if [[ -t 1 ]]; then
  c_green=$'\e[32m'; c_red=$'\e[31m'; c_yellow=$'\e[33m'; c_reset=$'\e[0m'
else
  c_green=""; c_red=""; c_yellow=""; c_reset=""
fi

ok()   { printf "  ${c_green}[PASS]${c_reset}   %s\n" "$1"; ((pass++)); }
bad()  { printf "  ${c_red}[FAIL]${c_reset}   %s\n" "$1"; ((fail++)); }
warn() { printf "  ${c_yellow}[WARN]${c_reset}   %s\n" "$1"; ((warn++)); }

heading() {
  echo
  printf "${c_yellow}===${c_reset} %s ${c_yellow}===${c_reset}\n" "$1"
}

# ----------------------------------------------------------------
heading "Local tools"

if command -v gh >/dev/null; then
  ok "gh CLI installed ($(gh --version | head -1 | awk '{print $3}'))"
else
  bad "gh CLI not installed (https://cli.github.com/)"
fi

if command -v jq >/dev/null; then
  ok "jq installed ($(jq --version))"
else
  bad "jq not installed (brew install jq / apt install jq)"
fi

if command -v uv >/dev/null; then
  ok "uv installed ($(uv --version 2>&1 | head -1))"
else
  warn "uv not installed — needed for spec-kit (https://docs.astral.sh/uv/)"
fi

if command -v python3 >/dev/null; then
  pyv=$(python3 --version 2>&1 | awk '{print $2}')
  ok "python3 installed ($pyv)"
else
  warn "python3 not installed — spec-kit needs Python 3.11+"
fi

if command -v git >/dev/null; then
  ok "git installed ($(git --version | awk '{print $3}'))"
else
  bad "git not installed"
fi

if command -v curl >/dev/null; then
  ok "curl installed"
else
  warn "curl not installed — setup-project.sh's skill fetch won't work"
fi

# ----------------------------------------------------------------
heading "GitHub auth"

if command -v gh >/dev/null; then
  if gh auth status >/dev/null 2>&1; then
    ok "gh authenticated"
    scopes=$(gh auth status 2>&1 | grep -i 'Token scopes' | head -1)
    if echo "$scopes" | grep -q 'project'; then
      ok "gh auth has 'project' scope"
    else
      bad "gh auth missing 'project' scope — run: gh auth refresh -s repo,project,read:org"
    fi
    if echo "$scopes" | grep -q 'repo'; then
      ok "gh auth has 'repo' scope"
    else
      warn "gh auth missing 'repo' scope"
    fi
  else
    bad "gh not authenticated — run: gh auth login -s repo,project,read:org"
  fi
fi

# ----------------------------------------------------------------
heading "Repo files"

config_file=".claude/backlog-poll.config.json"
worker_skill=".claude/skills/backlog-worker-start/SKILL.md"
poll_skill=".claude/skills/backlog-poll/SKILL.md"
issue_template=".github/ISSUE_TEMPLATE/backlog-item.yml"
add_workflow=".github/workflows/add-to-project.yml"

for f in "$config_file" "$worker_skill" "$poll_skill" "$issue_template" "$add_workflow"; do
  if [[ -f "$f" ]]; then
    ok "$f present"
  else
    bad "$f missing"
  fi
done

if [[ -d ".specify" ]]; then
  ok ".specify/ present (spec-kit installed)"
else
  bad ".specify/ missing — run: uv tool run --from git+https://github.com/github/spec-kit.git specify init . --integration claude --force"
fi

specify_count=$(ls .claude/skills 2>/dev/null | grep -c "^speckit-" || echo 0)
if (( specify_count >= 5 )); then
  ok ".claude/skills/ has $specify_count speckit-* skills"
else
  warn ".claude/skills/ has only $specify_count speckit-* skills (expected 5+)"
fi

# ----------------------------------------------------------------
heading "Config sanity"

if [[ -f "$config_file" ]] && command -v jq >/dev/null; then
  if jq -e . "$config_file" >/dev/null 2>&1; then
    ok "config file is valid JSON"
    project_owner=$(jq -r '.project_owner // empty' "$config_file")
    project_number=$(jq -r '.project_number // empty' "$config_file")
    repo_field=$(jq -r '.repo // empty' "$config_file")
    [[ -n "$project_owner"  ]] && ok "config: project_owner = $project_owner"     || bad "config: project_owner missing"
    [[ -n "$project_number" ]] && ok "config: project_number = $project_number"   || bad "config: project_number missing"
    [[ -n "$repo_field"     ]] && ok "config: repo = $repo_field"                 || bad "config: repo missing"
  else
    bad "config file is not valid JSON"
  fi
fi

# ----------------------------------------------------------------
heading "Project schema (live API)"

if [[ -f "$config_file" ]] \
   && command -v gh >/dev/null \
   && command -v jq >/dev/null \
   && gh auth status >/dev/null 2>&1; then
  project_owner=$(jq -r '.project_owner // empty' "$config_file")
  project_number=$(jq -r '.project_number // empty' "$config_file")

  if [[ -n "$project_owner" && -n "$project_number" ]]; then
    if fields_json=$(gh project field-list "$project_number" --owner "$project_owner" --format json --limit 50 2>/dev/null); then
      ok "Project #$project_number readable via gh"

      check_field() {
        local name="$1"
        if echo "$fields_json" | jq -e --arg n "$name" '.fields[] | select(.name==$n)' >/dev/null; then
          ok "field '$name' present"
        else
          bad "field '$name' missing"
        fi
      }

      check_field "Status"
      check_field "Phase"
      check_field "Owner"
      check_field "Category"
      check_field "Complexity"
      check_field "V"
      check_field "M"
      check_field "A"
      check_field "Total"

      # Check Status options match the methodology
      status_options=$(echo "$fields_json" | jq -r '.fields[] | select(.name=="Status") | .options[]?.name' 2>/dev/null | tr '\n' ',' | sed 's/,$//')
      expected="Triage,In Design,Ready,Doing,Done"
      if [[ "$status_options" == "$expected" ]]; then
        ok "Status options match methodology order: $expected"
      elif [[ -z "$status_options" ]]; then
        warn "could not read Status options (field may not be SingleSelect)"
      else
        warn "Status options are: $status_options  (expected: $expected)"
      fi
    else
      bad "could not read Project #$project_number — check auth scopes and that the Project exists"
    fi
  else
    warn "skipping Project schema checks — config missing project_owner or project_number"
  fi
else
  warn "skipping Project schema checks — gh/jq/auth not all present"
fi

# ----------------------------------------------------------------
heading "Runtime artefacts"

if [[ -f "/tmp/backlog-poll-worker-id" ]]; then
  worker_id=$(cat /tmp/backlog-poll-worker-id 2>/dev/null)
  if [[ -n "$worker_id" ]]; then
    ok "worker identity present (/tmp/backlog-poll-worker-id = $worker_id)"
  else
    warn "/tmp/backlog-poll-worker-id exists but is empty"
  fi
else
  warn "/tmp/backlog-poll-worker-id not found — run /backlog-worker-start to establish a worker identity"
fi

if [[ -d ".claude/in-flight" ]]; then
  locks=$(ls .claude/in-flight/*.md 2>/dev/null | wc -l)
  if (( locks > 0 )); then
    warn ".claude/in-flight/ has $locks lock file(s) — the orchestrator may be awaiting your answer in a chat"
    ls .claude/in-flight/*.md | sed 's/^/         /'
  else
    ok ".claude/in-flight/ exists with no outstanding locks"
  fi
fi

# ----------------------------------------------------------------
heading "Summary"

printf "  ${c_green}%d pass${c_reset}, ${c_yellow}%d warn${c_reset}, ${c_red}%d fail${c_reset}\n" "$pass" "$warn" "$fail"

if (( fail > 0 )); then
  echo
  echo "  See docs/adopt-methodology.md → Troubleshooting in the methodology repo:"
  echo "  https://github.com/DeepBlueCLtd/backlog-navigator/blob/main/docs/adopt-methodology.md"
  exit 1
fi

if (( warn > 0 )); then
  exit 0
fi

exit 0
