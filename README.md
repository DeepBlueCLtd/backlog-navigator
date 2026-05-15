# Backlog Navigator

A mobile-friendly PWA that reads `BACKLOG.md` from a GitHub repo and lets
anyone with a phone (or a desktop) triage the queue. Inline-edit cells,
expand descriptions, push changes back as a pull request.

This repo is the **standalone home** of the Backlog Navigator. It was
extracted from `debrief/debrief-future` (`apps/backlog-navigator/`) so
any project with a `BACKLOG.md` and speckit can adopt it without
depending on the source monorepo.

---

## Quickstart

```sh
git clone git@github.com:DeepBlueCLtd/backlog-navigator.git
cd backlog-navigator
pnpm install
pnpm dev
```

Then open `http://localhost:5173/` to see the bundled dummy `BACKLOG.md`
render. To point at a different repo, append `?repo=<org>/<name>&branch=<branch>`
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
