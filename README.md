# Backlog Navigator

This repo hosts **two related things**:

1. **A methodology** for running a project's backlog as GitHub
   Issues + a single Project per repo, with status transitions that
   *drive* spec-kit and Claude Code work rather than just labelling
   it. This is the project's main focus.
   - **[`METHODOLOGY.md`](METHODOLOGY.md)** — the reference.
   - **[`docs/adopt-methodology.md`](docs/adopt-methodology.md)** —
     the how-to-adopt-it-in-your-repo walkthrough.
   - **[Slide deck](docs/presentation/methodology-review.html)** —
     pitch it to your team in 15 slides.

2. **A standalone mobile-first PWA** ("the Backlog Navigator") for
   editing a markdown-based `BACKLOG.md` in any repo. Predates the
   methodology and is kept working during the transition.
   - **[`ADOPTING.md`](ADOPTING.md)** — adoption guide for the
     navigator app.
   - Public instance: <https://DeepBlueCLtd.github.io/backlog-navigator/>

If you're new here and want to adopt the methodology in your repo,
**start with [`docs/adopt-methodology.md`](docs/adopt-methodology.md)**.

---

## The navigator app, at a glance

> **⚠ DEPRECATED.** The navigator PWA is no longer actively maintained.
> Its `BACKLOG.md` fixture has been archived, its CI workflows are
> disabled (set to `workflow_dispatch` only), and the deployed Pages
> instance may show stale or broken state. The sections below describe
> the app as it was before deprecation; they're preserved for historical
> reference and for anyone choosing to continue maintaining it.

A mobile-friendly PWA that reads `BACKLOG.md` from a GitHub repo and lets
anyone with a phone (or a desktop) triage the queue. Inline-edit cells,
expand descriptions, push changes back as a pull request.

---

## What it offers

- **Mobile-first triage.** A card list with bottom-sheet editors on
  phones; a virtualised 12-column table on desktop. Both share the same
  parser, state, and push pipeline.
- **Sort, filter, group.** Per-column sort, filter by status / category /
  epic / complexity, group-by-epic, free-text search, show/hide
  completed items.
- **Inline editing with pending-state.** Edit cells, expand
  descriptions, see a dirty-count badge. Nothing leaves the browser
  until you click *Push Changes*.
- **PR-based writes.** A push creates a branch and opens a pull request
  in your repo. The navigator never force-pushes and never writes
  directly to `main`.
- **Strict round-trip parser.** Parsing then serialising
  `BACKLOG.md` returns the byte-identical input — no lossy edits,
  diffs stay reviewable.
- **Zero backend.** A static SPA. GitHub PATs live only in
  `localStorage` and reads work anonymously against the 60 req/hr
  public rate limit.
- **PWA / offline-friendly.** Installable on phone or desktop, with a
  service worker and update prompt.
- **Per-PR previews.** Every PR against this repo gets its own preview
  URL via a sticky comment.

---

## Adopt it for your project

If you have a repo with a `BACKLOG.md` (or are willing to add one), you
can be triaging it through the navigator in minutes. See
**[ADOPTING.md](ADOPTING.md)** for the full guide; the short version:

- **Path 1 — Zero infrastructure.** Add a `BACKLOG.md` to your repo
  and share `https://deepbluecltd.github.io/backlog-navigator/?repo=<your-org>/<your-repo>&branch=main`.
  No fork, no hosting.
- **Path 2 — Fork and self-host** on your own GitHub Pages if you want
  your own branded instance or your org policy prohibits third-party
  hosting.
- **Path 3 — Sticky PR comments** (combines with 1 or 2). Drop
  [`docs/consumer-workflows/backlog-comment.yml`](docs/consumer-workflows/backlog-comment.yml)
  into your repo's `.github/workflows/` to auto-comment a navigator
  link on every PR that touches `BACKLOG.md`.

[ADOPTING.md](ADOPTING.md) also documents the `BACKLOG.md` format the
parser expects (Epics table, Items table, column shapes, status
lozenges).

---

## Develop locally

For working on the navigator codebase itself:

```sh
git clone git@github.com:DeepBlueCLtd/backlog-navigator.git
cd backlog-navigator
pnpm install
pnpm dev
```

Then open `http://localhost:5173/`. **Note:** this repo's own
`BACKLOG.md` has been archived to
[`docs/history/BACKLOG.md.archived`](docs/history/BACKLOG.md.archived)
now that the project uses the [methodology](METHODOLOGY.md) and a
GitHub Project. The navigator's default "bundled demo" therefore needs
a follow-up (point its default fixture at a different file or repo).
For now, append `?repo=<org>/<name>&branch=<branch>`
to the URL.

---

## Configuration

The app is configured via build-time `VITE_*` env vars (defaults reproduce
this repo's behaviour). Full details in [CONFIGURATION.md](CONFIGURATION.md).

Quick reference:

| Env var | Default | Purpose |
|---|---|---|
| `VITE_DEFAULT_OWNER` | `DeepBlueCLtd` | Default GitHub org for the BACKLOG source |
| `VITE_DEFAULT_REPO` | `backlog-navigator` | Default GitHub repo |
| `VITE_PROD_HOST` | `DeepBlueCLtd.github.io` | Production host string |
| `VITE_BASE_URL` | `/backlog-navigator/` | Vite base path |
| `VITE_APP_NAME` | derived | PWA manifest `name` |
| `VITE_APP_SHORT_NAME` | derived | PWA manifest `short_name` |
| `VITE_BACKLOG_NAV_DRY_RUN` | `false` | Build-time dry-run flag (preview deploys override) |

URL params accepted by the hosted SPA:

| Param | Example | Purpose |
|---|---|---|
| `?repo=<org>/<name>` | `?repo=acme/foo` | Point at a different repo |
| `?branch=<name>` | `?branch=main` | Specific branch (defaults to `main`) |
| `?pr=<n>` | `?pr=512` | Legacy form — resolves against bundled default |
| `?dryRun=1` | | Override push-as-no-op for this session |

---

## Tests

```sh
pnpm lint
pnpm typecheck
pnpm test                # Vitest (unit)
pnpm test:e2e            # Playwright (in-process route mock — no creds needed)
```

A contributor with **no** `DeepBlueCLtd`-issued credentials should be able to
produce a green build locally. If you hit a wall, it's a bug — file an issue.

---

## Deployment

This repo deploys to GitHub Pages from the `gh-pages` branch:

- Production: `main` → `https://DeepBlueCLtd.github.io/backlog-navigator/`
- Per-PR preview: `pull_request` → `https://DeepBlueCLtd.github.io/backlog-navigator/previews/pr-<n>/`

Both deploys use `JamesIves/github-pages-deploy-action@v4` with
`clean-exclude: previews/` so main redeploys never wipe in-flight
preview folders.

Setup (one-time, per repo):

1. GitHub web UI: `Settings → Pages → Source: Deploy from a branch → gh-pages → /`.
   (The dropdown only lists branches that exist — trigger the first
   workflow before flipping this.)
2. Optional: add `LHCI_GITHUB_APP_TOKEN` secret for PR-level Lighthouse
   status checks.
3. Optional: copy `.github/workflows-optional/live.yml` to
   `.github/workflows/live.yml` if you want nightly drift detection
   against the upstream GitHub API. Requires `LIVE_GITHUB_TOKEN` secret.

---

## Architecture pointers

- `src/parser/` — `BACKLOG.md` ↔ in-memory model. Strict round-trip
  guarantee: parsing then serialising returns the byte-identical input.
- `src/github/` — thin REST client + Zod-validated boundary.
- `src/state/` — Zustand store + pending-edits + push pipeline.
- `src/components/` — desktop UI (table) + mobile UI (card list).
- `src/pwa/` — service-worker registration + update prompt.
- `e2e/mock-github.ts` — in-process route mock for the GitHub API.

The desktop UI is a virtualised 12-column table; the mobile UI is a
virtualised card list with bottom-sheet editors. Both share the parser,
state, and push pipeline.

---

## Security

GitHub PATs are stored only in `localStorage` and never logged. The app
makes write calls only when the user clicks "Push Changes" — at all
other times, the app is read-only and works without a PAT against the
60-req/hour anonymous rate limit.

See [SECURITY.md](SECURITY.md) for details, including PAT scopes and
secret rotation guidance.

---

## License

(Adopters: add your preferred license. The kit ships placeholder text
only; this template makes no license assertion.)
