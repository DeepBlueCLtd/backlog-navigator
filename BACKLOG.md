# Backlog — DeepBlueCLtd/backlog-navigator

A bundled dummy dataset shipped with the Backlog Navigator standalone repo.
Renders at the default URL (no query params) so reviewers can exercise
every UI surface — sort, filter, group, description expand, lozenge
rendering, push (dry-run) — without pointing at any real project.

To replace with your own backlog, edit this file and re-deploy.

## Epics

Large features broken down into multiple backlog items.

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | Dummy Epic One | Two open items (#001, #002) and one completed item (#007) — exercises mixed-status epic rendering. | specified |
| E02 | Dummy Epic Two | Two items spanning Tech Debt and Bug categories. | specified |
| E03 | Dummy Epic Three | A spike and a triage-state item for exercising the needs-interview lozenge. | specified |

## Items

The 12-column items table.

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 001 | Feature | [Bundled dummy item — proposed](specs/001-dummy-spec/spec.md) — exercises the proposed status lozenge and a Markdown link in the Description column. See `[[E01]]`. | 4 | 3 | 2 | 9 | Medium | proposed | E01 | 2025-12-01 | 2026-01-15 |
| 002 | Enhancement | [Bundled dummy item — approved](specs/001-dummy-spec/spec.md) — exercises the approved status; same epic as #001 so group-by-epic shows two items together. See `[[E01]]`. | 3 | 4 | 4 | 11 | High | approved | E01 | 2025-12-05 | 2026-02-01 |
| 003 | Tech Debt | Bundled dummy item — clarified, *no link* — exercises descriptions without links and the Tech Debt category. See `[[E02]]`. | 2 | 1 | 4 | 7 | Low | clarified | E02 | 2025-12-12 | 2026-02-10 |
| 004 | Bug | Bundled dummy bug-fix item — implementing — exercises the implementing-status badge and a different category. See `[[E02]]`. | 5 | 5 | 5 | 15 | High | implementing | E02 | 2026-01-02 | 2026-03-04 |
| 005 | Feature | Bundled dummy item — needs-interview — exercises the triage-state lozenge (alternative styling). See `[[E03]]`. | - | - | - | - | Medium | needs-interview | E03 | 2026-01-15 | 2026-01-15 |
| 006 | Documentation | Bundled dummy item — *no epic*, exercises the `(unassigned)` epic group. | 1 | 1 | 3 | 5 | Low | approved |  | 2026-02-01 | 2026-02-08 |
| ~~007~~ | ~~Feature~~ | ~~Bundled dummy item — complete (strikethrough rendering test). See `[[E01]]`.~~ | ~~3~~ | ~~3~~ | ~~3~~ | ~~9~~ | ~~Medium~~ | ~~complete~~ | ~~E01~~ | ~~2026-02-10~~ | ~~2026-02-20~~ |
| 008 | Research Spike | Bundled dummy item with an `escaped \| pipe` and **bold inline markup** to exercise parser edge cases. See `[[E03]]`. | 2 | 3 | 2 | 7 | Medium | proposed | E03 | 2026-03-01 | 2026-03-01 |
| 009 | Feature | Smoke-test item added on a PR branch — exercises pr-preview.yml so the preview tree visibly differs from main. See `[[E01]]`. | 1 | 1 | 1 | 3 | Low | proposed | E01 | 2026-05-15 | 2026-05-15 |

## Notes

End-of-document marker so the parser can detect the items-table boundary.
