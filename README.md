# Backlog Navigator

Interactive UI for `BACKLOG.md`. Browse, filter, and group items by epic;
edit any cell with a context-sensitive control; stage edits in `localStorage`;
push every staged change as a single commit + PR.

See `specs/242-backlog-navigator/spec.md` for the full feature spec.

## Quick start

```sh
pnpm install
pnpm --filter @debrief/backlog-navigator dev
```

The app loads `BACKLOG.md` from `main` (or from a PR head branch when invoked
with `?pr=NNN`). All edits are staged locally; nothing is pushed to GitHub
until the reviewer clicks **Push Changes** and confirms.

## Modes

| Mode | Activation | Behaviour |
|------|------------|-----------|
| Live | default | Reads `BACKLOG.md` from `main`. Push opens a new PR. |
| PR | `?pr=NNN` URL param | Reads `BACKLOG.md` from PR's head branch. Push commits onto the branch. |
| Dry-run | `VITE_BACKLOG_NAV_DRY_RUN=true` build, or `?dryRun=1` URL param | UI identical, but **Push Changes** is a no-op. Used by per-PR preview deployments. |

## Tests

```sh
pnpm --filter @debrief/backlog-navigator test          # vitest unit tests
pnpm --filter @debrief/backlog-navigator test:e2e:cloud # playwright (cloud / CI)
```

## Architecture

Mirrors `apps/spec-navigator/` exactly. Keep them in lockstep.
