# Backlog Navigator (bootstrap scaffold)

This package is the minimal scaffold that exists ahead of the main feature
implementation in [PR #580](https://github.com/debrief/debrief-future/pull/580).

It exists primarily to land:

- The three GitHub Actions workflows (`backlog-navigator-{preview,publish,comment}.yml`)
  on `main` so they can fire on subsequent PR + push events.
- A buildable `apps/backlog-navigator/` workspace package so `task lint`,
  `task typecheck`, `task test`, and the workflow trio all have something
  real to operate on.
- A first production deploy at `https://debrief.github.io/debrief-future/backlog-navigator/`
  so the per-PR sticky comment URL resolves.

The full implementation (browse / filter / group-by-epic / context-sensitive
edit / staged push / dry-run mode / PR-mode) lands in PR #580 against this
scaffold. See `specs/242-backlog-navigator/` for the spec.

## Mirrors `apps/spec-navigator/`

Layout, build/test discipline, and workflow trio all mirror
`apps/spec-navigator/`. Keep them in lockstep.
