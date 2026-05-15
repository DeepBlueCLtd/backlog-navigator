# Dummy Spec — Backlog Navigator preview dataset

**Status**: Draft
**Created**: 2026-01-15

This spec is part of the bundled dummy dataset shipped with the Backlog
Navigator standalone repo. It exists so the link cells in the
companion `BACKLOG.md` actually resolve to a rendered file when a
reviewer clicks them — exercising the in-app Markdown link surface
end-to-end.

If you forked this repo to adopt the Backlog Navigator for your own
project, you can safely delete this directory and replace `BACKLOG.md`
with your own content.

## User Story

A reviewer opens the per-PR preview URL with no query parameters,
sees the bundled `BACKLOG.md` render with eight items spanning
multiple statuses and epics, clicks one of the linked items, and
sees this dummy spec rendered with full Markdown support.

## Why this matters

Per-PR preview deployments need to *show* the running app, not just
prove the build works. A static-data dummy means previews are useful
to non-technical reviewers from the very first PR — no query-string
gymnastics, no rate-limit anxiety, no authentication required.

## Acceptance

1. The preview URL renders the dummy `BACKLOG.md` at the root.
2. Clicking any link in the Description column for item #001 or #002
   navigates to this file (rendered inside the SPA, not as a raw
   GitHub blob).
3. The "expand description" affordance works on every row.
4. Filtering by status / epic / category produces the expected subsets.
