# Backlog Navigator E2E Fixtures

Hand-curated test data for the Playwright E2E suite under
`apps/backlog-navigator/e2e/`. The fixture replaces a previous live
coupling to the repo-root `BACKLOG.md`, which broke CI on 2026-05-02 when
a routine deploy flipped item 244's status to `approved` and turned the
test's `selectOption('approved')` call into a no-op (Push button stayed
disabled, click timed out).

See `specs/245-navigator-e2e-fixture/spec.md` for the full background.

## Files

| File | Purpose |
|------|---------|
| `backlog-fixture.md` | 12-row backlog file mirroring the production `BACKLOG.md` shape: scoring/legend preamble, epics table, items table. Round-trips byte-stable through `parseBacklog` / `serializeBacklog`. |
| `README.md` | This file — coverage matrix, update instructions, and the hand-curated warning. |

## Coverage Matrix

The 12 fixture items are designed so every workflow state, every category, and
every parser edge case is exercised by at least one row. **Do not "tidy" the
fixture** without tracing the impact on the spec files that target specific
row IDs.

| Row | Category       | Status            | Epic | Why this row exists |
|-----|----------------|-------------------|------|---------------------|
| 001 | Feature        | `proposed`        | —    | Baseline target. With default sort (`updated DESC`), this row renders first; tests rely on flipping it to `approved` / `tasked` / `clarified` as a guaranteed status change. |
| 002 | Tech Debt      | `approved`        | E01  | Description contains a Markdown link + an `[[E01]]` epic tag — exercises link rendering and epic-tag parsing in one cell. |
| 003 | Enhancement    | `clarified`       | —    | Workflow-state coverage; sits at row 3 with default sort, so tests targeting `tasked` for the first three rows produce three distinct edits. |
| 004 | Bug            | `specified`       | E02  | Workflow-state coverage; one of the E02-tagged rows for the group-by-Epic view. |
| 005 | Infrastructure | `implementing`    | —    | Active phase coverage — surfaces under the `Active` phase filter. |
| 006 | Documentation  | `complete`        | —    | Strikethrough render — every non-empty cell wrapped in `~~…~~` (per-cell strikethrough is the canonical wire format, not row-level). Hidden by default unless the user toggles "include completed". |
| 007 | Research Spike | `blocked`         | E01  | Active phase + blocked-status coverage. |
| 008 | Feature        | `rejected`        | —    | Terminal-status coverage. (Note: the spec idea text used the colloquial `wont-do`; the parser canonicalises this to `rejected`.) |
| 009 | Enhancement    | `needs-interview` | —    | Triage-phase coverage — the `/idea --defer` intake state. |
| 010 | Tech Debt      | `proposed`        | E02  | **Parser edge-case row.** Description contains an escaped pipe (`\|`), a Markdown link, and an `[[E02]]` epic tag — all in one cell. Round-trip serialisation must restore the `\|` escape verbatim. |
| 011 | Bug            | `approved`        | —    | Second `approved` row so phase/status filters return non-singleton results. |
| 012 | Feature        | `clarified`       | E01  | Third E01-tagged row + duplicate `clarified` so the group-by-Epic view has a meaningful E01 group. |

### Sort order

The `Updated` column is reverse-ordered so default sort
(`sortKey: 'updated', sortDir: 'desc'`) renders the table in
**001 → 012** order. This makes `page.locator('table.items tbody tr').first()`
deterministic — it always points to row 001. Several specs depend on this.
**If you change the dates, also re-check the desktop and mobile specs.**

### Statuses excluded from the fixture

`planned` and `tasked` are valid workflow states but no fixture row carries
them — the dropdown allows transitioning to them, and tests use them as
target values for the first three rows (which are `proposed`/`approved`/
`clarified`). Adding a row in either of those states is fine, but make sure
no spec relies on the dropdown target being absent from the table.

`parked` is also valid but excluded; combined with `rejected` (row 008) the
two terminal statuses outside `complete` are covered by row 008 alone.

## Updating the Fixture

### Routine row additions (status flips, copy-edits) — DO NOT update the fixture

The fixture is **decoupled** from `BACKLOG.md`. Day-to-day backlog churn
should not touch this file.

### Format / column changes (rare) — DO update the fixture

If the BACKLOG.md column structure changes (a column added, removed, or
reordered, or a new workflow status is introduced), update both files in
the same PR:

1. Update `BACKLOG.md` (the production file).
2. Update `backlog-fixture.md` to the new column layout. **Hand-author the
   change** — never copy-paste rows from `BACKLOG.md`. The fixture is a
   stable test artefact; copying production rows reintroduces the live
   coupling this spec was created to fix.
3. Run `pnpm typecheck && node run-playwright.mjs` and confirm the entire
   E2E suite still passes.
4. Run `pnpm test` and confirm `liveBacklog.roundtrip.test.ts` still passes
   against the live `BACKLOG.md` (it deliberately reads the live file —
   that gate is intentional).
5. If a new workflow state is introduced, add a row exercising it.

### When NOT to regenerate

There is no script that generates this fixture, and there should not be
one. The whole point of the fixture is to be a **stable, hand-curated
artefact** that doesn't drift with backlog activity. If you find yourself
about to write `regenerate-fixture.sh`, stop and re-read the failure mode
described at the top of this file.

## Cross-references

- `specs/245-navigator-e2e-fixture/` — the spec, plan, and tasks for this
  feature.
- `apps/backlog-navigator/e2e/helpers/mock-github.ts` — the shared
  helper that loads this fixture into the Playwright route mock.
- `apps/backlog-navigator/src/parser/__tests__/liveBacklog.roundtrip.test.ts` —
  the Vitest gate that **deliberately** reads the live `BACKLOG.md`. Do
  not point this at the fixture.
