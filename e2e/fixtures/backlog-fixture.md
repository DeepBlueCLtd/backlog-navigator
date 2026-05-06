# Backlog (E2E Test Fixture)

Hand-curated fixture used by Playwright E2E tests in `apps/backlog-navigator/e2e/`.
This file is **not** a real backlog — it exists to provide deterministic test
data so the E2E suite is decoupled from the live `BACKLOG.md` (see #245).

See `README.md` in this directory for the row-by-row coverage matrix.

## Epics

Large features broken down into multiple backlog items.

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | Epic One Title | Short description of epic one | specified |
| E02 | Epic Two Title | Short description of epic two | specified |

## Items

The 12-column items table.

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 001 | Feature | First feature item — baseline target for status edits | 3 | 2 | 4 | 9 | Low | proposed |  | 2026-01-01 | 2026-01-12 |
| 002 | Tech Debt | [Refactor parser internals](https://example.com/specs/002.md) — see `[[E01]]` | 2 | 1 | 4 | 7 | Low | approved | E01 | 2026-01-01 | 2026-01-11 |
| 003 | Enhancement | Improve filter bar copy and tooltips | 2 | 2 | 3 | 7 | Low | clarified |  | 2026-01-01 | 2026-01-10 |
| 004 | Bug | Fix sort indicator misalignment in dark theme — see `[[E02]]` | 1 | 1 | 4 | 6 | Low | specified | E02 | 2026-01-01 | 2026-01-09 |
| 005 | Infrastructure | Wire up the preview review-app pipeline for the navigator | 3 | 2 | 3 | 8 | Medium | implementing |  | 2026-01-01 | 2026-01-08 |
| ~~006~~ | ~~Documentation~~ | ~~Document the row strikethrough rendering path~~ | ~~1~~ | ~~1~~ | ~~3~~ | ~~5~~ | ~~Low~~ | ~~complete~~ |  | ~~2026-01-01~~ | ~~2026-01-07~~ |
| 007 | Research Spike | Time-boxed spike on offline mobile sync — see `[[E01]]` | 2 | 2 | 3 | 7 | Low | blocked | E01 | 2026-01-01 | 2026-01-06 |
| 008 | Feature | Cancelled feature — superseded by an external library | 2 | 1 | 3 | 6 | Low | rejected |  | 2026-01-01 | 2026-01-05 |
| 009 | Enhancement | Quick-capture idea, awaiting interview to scope | 1 | 2 | 3 | 6 | Low | needs-interview |  | 2026-01-01 | 2026-01-04 |
| 010 | Tech Debt | Edge-case row \| pipe inside text \| and a [link](https://example.com/edge.md) — see `[[E02]]` | 2 | 1 | 4 | 7 | Low | proposed | E02 | 2026-01-01 | 2026-01-03 |
| 011 | Bug | Crash on empty filter set — straightforward repro | 2 | 1 | 4 | 7 | Low | approved |  | 2026-01-01 | 2026-01-02 |
| 012 | Feature | Group-by-Epic toggle for the items table — see `[[E01]]` | 3 | 3 | 3 | 9 | Low | clarified | E01 | 2026-01-01 | 2026-01-01 |

## Categories

End-of-document marker so the parser can detect the items-table boundary.

## Notes

This fixture is hand-curated. Do not regenerate from the live `BACKLOG.md`.
