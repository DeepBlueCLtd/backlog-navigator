# Configuration

> **⚠ DEPRECATED.** This page documents configuration for the legacy
> Backlog Navigator PWA, which is no longer actively maintained. For
> the recommended methodology — GitHub Issues + Project driven by
> spec-kit and Claude Code — see [`METHODOLOGY.md`](METHODOLOGY.md)
> and [`docs/adopt-methodology.md`](docs/adopt-methodology.md).

---

The Backlog Navigator is configured at two levels:

1. **Build-time** — `VITE_*` env vars consumed at `vite build`. These
   bake their values into the bundle and cannot be changed at runtime.
2. **Runtime** — URL query-string parameters. These override build-time
   defaults for the current session.

A third surface — the **user's GitHub PAT** — lives only in
`localStorage` on the user's device; see [SECURITY.md](SECURITY.md).

---

## Build-time environment variables

### App identity (consumed by `vite.config.ts`)

| Var | Default | Effect |
|---|---|---|
| `VITE_APP_NAME` | `Debrief Backlog Navigator` | PWA manifest `name` |
| `VITE_APP_SHORT_NAME` | `Backlog` | PWA manifest `short_name` |
| `VITE_APP_DESCRIPTION` | `Edit the Debrief project backlog from any device.` | PWA manifest `description` |
| `VITE_THEME_COLOR` | `#1f1f1f` | PWA manifest `theme_color` |
| `VITE_BG_COLOR` | `#ffffff` | PWA manifest `background_color` |
| `VITE_BASE_URL` | `/backlog-navigator/` | Vite `base` path; matches Pages subpath |

The two icon files in `public/` (`icon-192.png`, `icon-512.png`) are
bundled verbatim. To re-brand, swap the icon files and rebuild — no
config change needed.

### GitHub defaults (consumed by `src/defaults.ts`)

| Var | Default | Effect |
|---|---|---|
| `VITE_DEFAULT_OWNER` | `DeepBlueCLtd` | Default GitHub org if URL has no `?repo=` |
| `VITE_DEFAULT_REPO` | `backlog-navigator` | Default repo within the org |
| `VITE_PROD_HOST` | `DeepBlueCLtd.github.io` | Production host string (used in display strings) |

### Behaviour flags (consumed by `src/state/`)

| Var | Default | Effect |
|---|---|---|
| `VITE_BACKLOG_NAV_DRY_RUN` | `false` | If `true`, "Push Changes" is a no-op. Per-PR preview builds set this to `true`. |

---

## Runtime URL parameters

The SPA accepts these query-string parameters. Unknown parameters are
silently ignored to keep URLs forward-compatible.

| Param | Constraint | Default | Purpose |
|---|---|---|---|
| `repo` | `<org>/<name>` regex | bundled default | Override the target repo |
| `branch` | URL-decoded branch name | consumer default | Specific branch |
| `pr` | `^[0-9]+$` | — | **Legacy form** — resolves PR against bundled default |
| `dryRun` | `1`/`true`/`0`/`false` | inherits build flag | Force no-op push for this session |

### Legacy `?pr=<n>` form

This form has been emitted by `DeepBlueCLtd/backlog-navigator`'s GitHub-Actions
sticky-comment workflow since the app's inception in `debrief/debrief-future`
spec #242. **Permanent** backward compatibility — the compat shim
resolves `?pr=<n>` against the bundled default OWNER/REPO and proceeds
as if `?repo=<bundled-default>&branch=<resolved-head>` had been supplied.

### New `?repo=<org>/<name>&branch=<branch>` form

For non-`DeepBlueCLtd` consumers and cross-repo links. Pass `repo` + `branch`
together; either alone falls back to defaults with a non-blocking
warning banner.

### Conflicts

If both `?repo=` and `?pr=` are supplied, `?repo=` wins (it is more
explicit). If `?pr=` resolves against a `?repo=` that doesn't contain
the PR, the "no such PR" empty state is shown — no fallback to the
bundled default.

---

## Precedence (high → low)

1. URL params (`?repo=`, `?branch=`, `?dryRun=`, `?pr=`)
2. Build-time env vars (baked into the bundle)
3. Bundled default (this repo)

---

## Optional drift detection (`live.yml`)

The kit ships `.github/workflows-optional/live.yml` as an opt-in
nightly workflow that runs the Playwright suite against the real
GitHub API (rather than the in-process route mock).

To enable:

```sh
mv .github/workflows-optional/live.yml .github/workflows/live.yml
git add .github/workflows/live.yml && git commit -m "ci: enable live drift detection"
```

Then add a `LIVE_GITHUB_TOKEN` repository secret with a fine-grained
PAT that has **read-only** access to `contents` and `metadata` on the
target repo. The workflow runs daily at 04:00 UTC and on
`workflow_dispatch`.

Drift detection is **not** a merge gate. Failures emit artifacts and
optionally open issues; CI for PRs still uses the in-process mock for
speed and credential-free contributor builds.
