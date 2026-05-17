#!/usr/bin/env bash
#
# scripts/migrate-testbed-items.sh
#
# Adds the 12 migrated testbed issues (#4-#15) to Project #4 and sets
# their Project field values per the migration mapping table.
#
# One-off script. Run once locally with your gh auth; safe to re-run
# if you ever need to redo it (gh project item-add is idempotent —
# returns the existing item ID).
#
# Usage:
#   scripts/migrate-testbed-items.sh
#
# Prereqs: gh CLI authenticated with project:write scope; jq.
#

set -euo pipefail

OWNER="DeepBlueCLtd"
REPO="backlog-navigator"
PROJECT_NUMBER=4

# ---------- discover project + field IDs ----------
echo "Looking up Project #$PROJECT_NUMBER..."
project_json=$(gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json)
PROJECT_ID=$(echo "$project_json" | jq -r '.id')
echo "  Project ID: $PROJECT_ID"

echo "Looking up field IDs and option IDs..."
fields_json=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 50)

get_field_id() {
  echo "$fields_json" | jq -r --arg n "$1" '.fields[] | select(.name==$n) | .id'
}
get_option_id() {
  echo "$fields_json" | jq -r --arg fn "$1" --arg on "$2" \
    '.fields[] | select(.name==$fn) | .options[] | select(.name==$on) | .id'
}

FIELD_STATUS=$(get_field_id "Status")
FIELD_PHASE=$(get_field_id "Phase")
FIELD_CATEGORY=$(get_field_id "Category")
FIELD_COMPLEXITY=$(get_field_id "Complexity")
FIELD_V=$(get_field_id "V")
FIELD_M=$(get_field_id "M")
FIELD_A=$(get_field_id "A")
FIELD_TOTAL=$(get_field_id "Total")

# Resolve all single-select option IDs we'll use
opt_status_triage=$(get_option_id "Status" "Triage")
opt_status_indesign=$(get_option_id "Status" "In Design")
opt_status_doing=$(get_option_id "Status" "Doing")
opt_status_done=$(get_option_id "Status" "Done")

opt_phase_specdrafting=$(get_option_id "Phase" "Spec drafting")
opt_phase_implementing=$(get_option_id "Phase" "Implementing")

opt_cat_feature=$(get_option_id "Category" "Feature")
opt_cat_enhancement=$(get_option_id "Category" "Enhancement")
opt_cat_techdebt=$(get_option_id "Category" "Tech Debt")
opt_cat_bug=$(get_option_id "Category" "Bug")
opt_cat_doc=$(get_option_id "Category" "Documentation")
opt_cat_spike=$(get_option_id "Category" "Spike")

opt_cmpx_low=$(get_option_id "Complexity" "Low")
opt_cmpx_med=$(get_option_id "Complexity" "Medium")
opt_cmpx_high=$(get_option_id "Complexity" "High")

echo "  ok"
echo

# ---------- pre-flight: warn about missing fields ----------
missing=()
[[ -z "$FIELD_STATUS"     ]] && missing+=("Status")
[[ -z "$FIELD_PHASE"      ]] && missing+=("Phase")
[[ -z "$FIELD_CATEGORY"   ]] && missing+=("Category")
[[ -z "$FIELD_COMPLEXITY" ]] && missing+=("Complexity")
[[ -z "$FIELD_V"          ]] && missing+=("V")
[[ -z "$FIELD_M"          ]] && missing+=("M")
[[ -z "$FIELD_A"          ]] && missing+=("A")
[[ -z "$FIELD_TOTAL"      ]] && missing+=("Total")
if (( ${#missing[@]} > 0 )); then
  echo "WARNING: these expected fields are missing from Project #$PROJECT_NUMBER:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  echo "Their values will be skipped. Add them with gh project field-create and re-run if you want them set." >&2
  echo >&2
fi

# ---------- helpers ----------

# Add an issue (by number) to the project, return its project item ID
add_to_project() {
  local issue_number="$1"
  local url="https://github.com/$OWNER/$REPO/issues/$issue_number"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" --format json \
      | jq -r '.id'
}

set_select() {
  local item_id="$1" field_id="$2" option_id="$3"
  [[ -z "$option_id" || "$option_id" == "null" ]] && return 0
  [[ -z "$field_id"  || "$field_id"  == "null" ]] && return 0
  gh project item-edit \
      --id "$item_id" --project-id "$PROJECT_ID" \
      --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null
}

set_number() {
  local item_id="$1" field_id="$2" value="$3"
  [[ -z "$value" ]] && return 0
  [[ -z "$field_id" || "$field_id" == "null" ]] && return 0
  gh project item-edit \
      --id "$item_id" --project-id "$PROJECT_ID" \
      --field-id "$field_id" --number "$value" >/dev/null
}

# Process one item:
#   $1 issue_number
#   $2 category-option-id (or empty)
#   $3 complexity-option-id (or empty)
#   $4 V    (or empty)
#   $5 M    (or empty)
#   $6 A    (or empty)
#   $7 Total (or empty)
#   $8 status-option-id (or empty)
#   $9 phase-option-id  (or empty)
process_item() {
  local n="$1" cat="$2" cmpx="$3" v="$4" m="$5" a="$6" total="$7" status="$8" phase="$9"
  echo "Issue #$n:"
  local item_id
  item_id=$(add_to_project "$n")
  echo "  added to project (item_id: $item_id)"
  set_select "$item_id" "$FIELD_CATEGORY"   "$cat"
  set_select "$item_id" "$FIELD_COMPLEXITY" "$cmpx"
  set_number "$item_id" "$FIELD_V" "$v"
  set_number "$item_id" "$FIELD_M" "$m"
  set_number "$item_id" "$FIELD_A" "$a"
  set_number "$item_id" "$FIELD_TOTAL" "$total"
  set_select "$item_id" "$FIELD_STATUS" "$status"
  set_select "$item_id" "$FIELD_PHASE"  "$phase"
  echo "  fields set"
}

# ---------- the data ----------

# Epics — start in In Design so /backlog-poll's first work is to spec them.
process_item  4  ""                  ""               ""  ""  ""  ""  "$opt_status_indesign" ""
process_item  5  ""                  ""               ""  ""  ""  ""  "$opt_status_indesign" ""
process_item  6  ""                  ""               ""  ""  ""  ""  "$opt_status_indesign" ""

# Item 001 (#7) - Feature, Medium, 4/3/2/9, In Design, Phase empty
process_item  7  "$opt_cat_feature"     "$opt_cmpx_med"  4   3   2   9   "$opt_status_indesign" ""
# Item 002 (#8) - Enhancement, High, 3/4/4/11, In Design, Phase empty
process_item  8  "$opt_cat_enhancement" "$opt_cmpx_high" 3   4   4   11  "$opt_status_indesign" ""
# Item 003 (#9) - Tech Debt, Low, 2/1/4/7, In Design, Phase = Spec drafting
process_item  9  "$opt_cat_techdebt"    "$opt_cmpx_low"  2   1   4   7   "$opt_status_indesign" "$opt_phase_specdrafting"
# Item 004 (#10) - Bug, High, 5/5/5/15, Doing, Phase = Implementing
process_item 10  "$opt_cat_bug"         "$opt_cmpx_high" 5   5   5   15  "$opt_status_doing"    "$opt_phase_implementing"
# Item 005 (#11) - Feature, Medium, unscored, Triage
process_item 11  "$opt_cat_feature"     "$opt_cmpx_med"  ""  ""  ""  ""  "$opt_status_triage"   ""
# Item 006 (#12) - Documentation, Low, 1/1/3/5, In Design, Phase empty
process_item 12  "$opt_cat_doc"         "$opt_cmpx_low"  1   1   3   5   "$opt_status_indesign" ""
# Item 007 (#13) - Feature, Medium, 3/3/3/9; closed. Status defaults to Done via workflow,
# but we set explicitly in case the workflow isn't yet configured.
process_item 13  "$opt_cat_feature"     "$opt_cmpx_med"  3   3   3   9   "$opt_status_done"     ""
# Item 008 (#14) - Spike, Medium, 2/3/2/7, In Design, Phase empty
process_item 14  "$opt_cat_spike"       "$opt_cmpx_med"  2   3   2   7   "$opt_status_indesign" ""
# Item 009 (#15) - Feature, Low, 1/1/1/3, In Design, Phase empty
process_item 15  "$opt_cat_feature"     "$opt_cmpx_low"  1   1   1   3   "$opt_status_indesign" ""

echo
echo "Done. Inspect the board:"
echo "  https://github.com/orgs/$OWNER/projects/$PROJECT_NUMBER"
