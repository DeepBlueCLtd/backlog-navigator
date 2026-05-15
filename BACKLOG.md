# Backlog — DeepBlueCLtd/backlog-navigator

A bundled dummy dataset shipped with the Backlog Navigator standalone repo.
Renders at the default URL (no query params) so reviewers can exercise
every UI surface — sort, filter, group, description expand, lozenge
rendering, push (dry-run) — without pointing at any real project.

To replace with your own backlog, edit this file and re-deploy.

## Items

| ID | Category | Description | V | M | A | V·M·A | Complexity | Status | Epic | Created | Updated |
|----|---|---|---|---|---|---|---|---|---|---|---|
| 001 | Feature | [[E01]] [Bundled dummy item — proposed](specs/001-dummy-spec/spec.md) — exercises the proposed status lozenge and a Markdown link in the Description column. | 4 | 3 | 2 | 9 | Medium | proposed |  | 2025-12-01 | 2026-01-15 |
| 002 | Enhancement | [[E01]] [Bundled dummy item — approved](specs/001-dummy-spec/spec.md) — exercises the approved status; same epic as #001 so group-by-epic shows two items together. | 3 | 4 | 4 | 11 | High | approved |  | 2025-12-05 | 2026-02-01 |
| 003 | Tech Debt | [[E02]] Bundled dummy item — clarified, *no link* — exercises descriptions without links and the Tech Debt category. | 2 | 1 | 4 | 7 | Low | clarified |  | 2025-12-12 | 2026-02-10 |
| 004 | Bug | [[E02]] Bundled dummy bug-fix item — implementing — exercises the implementing-status badge and a different category. | 5 | 5 | 5 | 15 | High | implementing |  | 2026-01-02 | 2026-03-04 |
| 005 | Feature | [[E03]] Bundled dummy item — needs-interview — exercises the triage-state lozenge (alternative styling). | - | - | - | - | Medium | needs-interview |  | 2026-01-15 | 2026-01-15 |
| 006 | Documentation | Bundled dummy item — *no epic*, exercises the `(unassigned)` epic group. | 1 | 1 | 3 | 5 | Low | approved |  | 2026-02-01 | 2026-02-08 |
| ~~007~~ | ~~Feature~~ | ~~[[E01]] Bundled dummy item — complete (strikethrough rendering test).~~ | ~~3~~ | ~~3~~ | ~~3~~ | ~~9~~ | ~~Medium~~ | ~~complete~~ |  | ~~2026-02-10~~ | ~~2026-02-20~~ |
| 008 | Research Spike | [[E03]] Bundled dummy item with an `escaped \| pipe` and **bold inline markup** to exercise parser edge cases. | 2 | 3 | 2 | 7 | Medium | proposed |  | 2026-03-01 | 2026-03-01 |
| 009 | Feature | [[E01]] Smoke-test item added on a PR branch — exercises pr-preview.yml so the preview tree visibly differs from main. | 1 | 1 | 1 | 3 | Low | proposed |  | 2026-05-15 | 2026-05-15 |

## Epics

| Epic | Title | Description |
|---|---|---|
| E01 | Dummy Epic One | Two open items (#001, #002) and one completed item (#007) — exercises mixed-status epic rendering. |
| E02 | Dummy Epic Two | Two items spanning Tech Debt and Bug categories. |
| E03 | Dummy Epic Three | A spike and a triage-state item for exercising the needs-interview lozenge. |
