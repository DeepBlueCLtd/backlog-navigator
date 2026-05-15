# Security Policy

## Supported versions

The latest release on `main` is the only supported version. Older
versions are not patched; pin to a tag if you need a stable release
window.

---

## Reporting a vulnerability

Email security@DeepBlueCLtd.github.io (or your project's preferred channel) with a
description, reproduction steps, and the affected version/commit.
Do **not** open a public issue for security-sensitive reports.

We aim to acknowledge within 72 hours and ship a fix within 14 days
for high-severity issues. Low-severity issues are batched into the
next release.

---

## GitHub Personal Access Token (PAT) handling

The app accepts the user's own GitHub PAT to enable write operations
(create branch, commit, open PR). PAT handling rules:

1. **Stored in `localStorage` only.** Never sent to any server other
   than `https://api.github.com`. No telemetry, no third-party
   storage.
2. **Never logged.** PATs do not appear in console output, network
   inspector previews, or thrown error messages.
3. **User-revocable.** The Settings panel shows whether a token is
   stored and offers a "Clear token" action that removes it from
   `localStorage` immediately.
4. **Scope guidance.** The app requires `repo` scope (classic PAT) or
   fine-grained `contents: read+write` + `pull requests: read+write`
   on the target repo. The Settings panel links to GitHub's PAT
   creation page with the recommended scope pre-selected.

If a user accidentally pastes a token into a shared browser, they should
revoke it on github.com immediately — the app cannot revoke tokens on
the user's behalf.

---

## Workflow security baseline

Threats specific to a public GitHub Pages SPA driven by Actions:

1. **`GITHUB_TOKEN` declared at minimum scope per workflow.**
   The default permissions for `GITHUB_TOKEN` were tightened in 2023; even
   so, every workflow in `.github/workflows/` should pin its `permissions:`
   block to exactly what it needs. The kit's defaults:

   | Workflow | `permissions` |
   |---|---|
   | `ci.yml` | (default — read-only; no writes needed) |
   | `lighthouse.yml` | (default) |
   | `deploy.yml` | `contents: write` (gh-pages push only) |
   | `pr-preview.yml` | `contents: write`, `pull-requests: write` (sticky comment) |
   | `pr-preview-cleanup.yml` | `contents: write` |

   If you add a workflow, set its `permissions:` at workflow level (not
   job level) and grant only what's needed. Avoid `permissions: write-all`.

2. **Do not use `pull_request_target` against the head ref.**
   `pull_request_target` runs in the *base* repo context and has access to
   secrets — using it to check out the PR head ref means executing
   attacker-controlled code with secret access. The kit's `pr-preview.yml`
   triggers on plain `pull_request` (no secret access; builds run in a
   sandbox per the GitHub Actions security model) and renders against the
   bundled `VITE_DEFAULT_OWNER`/`VITE_DEFAULT_REPO`, not against the PR's
   own GitHub history. If you need to act on a PR with elevated scopes,
   use a `workflow_run`-triggered follow-up that reads the artifact
   produced by the `pull_request` job rather than the head ref directly.

3. **Pin third-party actions to a commit SHA.**
   `@v4` resolves to whatever the action's maintainer points the `v4` tag
   at — including, in some past supply-chain incidents, an altered
   commit. Pin to a SHA for the actions you don't control:

   ```yaml
   uses: JamesIves/github-pages-deploy-action@<full-40-char-sha>  # v4.5.0
   ```

   First-party `actions/*` (`actions/checkout`, `actions/setup-node`,
   `actions/github-script`) are GitHub-maintained and conventionally
   pinned to `@v4` major-version tags; pinning these to SHAs is best
   practice but lower priority than pinning third-party actions.

4. **`.env*` files never enter source control.**
   The kit's `.gitignore` includes `.env` and `.env.local`. The
   `import-from-source.sh` script has a Step 3 guard that refuses to
   proceed if a `.env*` file is present anywhere in the extracted
   branch — protecting against a stray committed env file travelling
   out of the monorepo. If the guard fires: rotate any secrets the file
   contains immediately, remove the file from the source repo's history
   (`git filter-repo` or BFG), then re-run.

5. **Service-worker scope confined to the app's base path.**
   `vite-plugin-pwa` is configured so the service worker registers at
   the `VITE_BASE_URL` scope (e.g., `/<repo>/`). It cannot intercept
   requests outside that path on the same origin. If a future build
   moves the app to the origin root (`VITE_BASE_URL=/`), audit the
   scope before deploying.

---

## CI secrets

This repo uses the following Actions secrets:

| Secret | Required? | Scope | Used by |
|---|---|---|---|
| `GITHUB_TOKEN` | Auto-provided | Per-workflow `permissions:` block | `deploy.yml`, `pr-preview.yml`, `pr-preview-cleanup.yml` |
| `LHCI_GITHUB_APP_TOKEN` | Optional | PR status checks | `lighthouse.yml` |
| `LIVE_GITHUB_TOKEN` | Optional (opt-in) | Read-only on target repo | `live.yml` (if enabled) |

### Rotation policy

- `GITHUB_TOKEN`: auto-rotated per workflow run; no manual rotation.
- `LHCI_GITHUB_APP_TOKEN`: rotate annually, or immediately on staff
  departure / suspected compromise. Update via
  `Settings → Secrets and variables → Actions`.
- `LIVE_GITHUB_TOKEN`: fine-grained PAT — rotate per the issuing org's
  policy. Use a service identity rather than an individual's account
  where possible.

### Leak response

If a secret is suspected leaked:

1. **Revoke immediately** on github.com (`Settings → Developer
   settings → Personal access tokens` for PATs; `Settings → Apps`
   for GitHub Apps).
2. Rotate the secret in `Settings → Secrets and variables → Actions`.
3. Audit recent workflow runs for unexpected activity.
4. Open a follow-up issue tracking the rotation and any policy
   changes the incident reveals.

---

## Branch protection

`main` should be protected with these settings:

- Require pull request reviews before merging (1 approving review).
- Require status checks to pass before merging:
  - `ci.yml / lint-typecheck-test`
  - `ci.yml / e2e`
  - `lighthouse.yml / lighthouse`
- Require branches to be up to date before merging.
- Restrict who can push to `main` (deploy automation only).

`pr-preview.yml` is **not** a required gate — preview deploys are
nice-to-have, not merge blockers.

---

## Bundled dummy dataset

This repo ships a small dummy `BACKLOG.md` and a sample `specs/`
directory at the root, used to render meaningful content on the
default URL (and on per-PR previews). The dummy dataset is
intentionally generic — no production credentials, no internal links,
no business-confidential strings. If you fork this repo for adopter
use, you may replace the dummy with your own sample content.
