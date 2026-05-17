# Adopting the Backlog Navigator

> **⚠ DEPRECATED.** This document covers the legacy Backlog Navigator
> PWA — a Markdown-based approach to managing a backlog through a
> version-controlled `BACKLOG.md` file. The recommended approach is
> now the **methodology** described in
> [`METHODOLOGY.md`](METHODOLOGY.md), which uses GitHub Issues + a
> single Project per repo, driven by spec-kit and Claude Code.
>
> If you want to **adopt the new methodology** in your repo, follow
> [`docs/adopt-methodology.md`](docs/adopt-methodology.md).
>
> This file is preserved for reference and for any project that still
> wants to use the navigator PWA against an existing `BACKLOG.md`. The
> navigator's deployed instance is no longer actively maintained.

---

This document is for **other projects** that want to use the Backlog
Navigator to read and edit their own `BACKLOG.md`. There are three
adoption paths, ranging from zero-infrastructure to fully self-hosted.

If you're working on the navigator itself (codebase, CI, deployment of
this repo), see [CONFIGURATION.md](CONFIGURATION.md) instead.

---

## Three adoption paths

### Path 1 — Zero infrastructure: link to the public hosted instance

The simplest case. Use this if you want analysts to be able to triage
your project's backlog without standing up any infrastructure.

1. Add a `BACKLOG.md` to your repo's root following the format below.
2. Share this URL with your team:
   ```
   https://deepbluecltd.github.io/backlog-navigator/?repo=<your-org>/<your-repo>&branch=main
   ```
3. Anyone with the link can read your backlog. To *edit*, they create a
   GitHub PAT (see below) and paste it into the navigator's Settings
   panel — the navigator opens a PR back to your repo.

**Pros**: no infrastructure, no fork, instant onboarding.
**Cons**: your team relies on this hosted instance's availability;
you can't customise branding or behaviour.

### Path 2 — Fork and self-host on your own GitHub Pages

Use this if you want your own branded instance, or if your org policy
prohibits relying on third-party hosting.

1. **Fork** `DeepBlueCLtd/backlog-navigator` to your org.
2. In your fork's `.github/workflows/deploy.yml`, the build already
   reads `VITE_DEFAULT_OWNER` and `VITE_DEFAULT_REPO` as env vars. Set
   them in the workflow's `env:` block to point at your repo:
   ```yaml
   - name: Build
     run: pnpm build
     env:
       VITE_BASE_URL: /<your-fork-name>/
       VITE_DEFAULT_OWNER: <your-org>
       VITE_DEFAULT_REPO: <your-repo>
   ```
3. Replace this repo's `BACKLOG.md` (currently a dummy with 8 items
   illustrating the format) with your own. Re-deploy.
4. Configure GitHub Pages on your fork:
   `Settings → Pages → Source: Deploy from a branch → gh-pages → /`.
5. Your hosted instance is now `https://<your-org>.github.io/<your-fork-name>/`.

You also get the per-PR preview pipeline (`pr-preview.yml`) for free —
every PR against your fork gets its own preview URL via a sticky
comment.

**Pros**: your own branded instance, full control, isolated from
upstream availability.
**Cons**: you maintain a fork (rebase periodically against upstream).

### Path 3 — Sticky-comment-on-PR (combines with Path 1 or 2)

Use this if you want every PR that touches `BACKLOG.md` in your repo to
automatically post a comment pointing reviewers at the navigator.

1. Pick a hosted navigator instance (Path 1's public one, or Path 2's
   self-host).
2. Copy [`consumer-workflows/backlog-comment.yml`](consumer-workflows/backlog-comment.yml)
   to your repo's `.github/workflows/backlog-comment.yml`.
3. Edit the `navUrl` line to point at your chosen instance.
4. Done. Open a PR that edits `BACKLOG.md`; the workflow posts a sticky
   comment with a `?pr=<n>`-keyed link.

The legacy `?pr=<n>` form is permanent — the navigator resolves it
against its bundled default OWNER/REPO. If you self-hosted (Path 2),
the bundled default is *your* repo, so `?pr=<n>` resolves into your
own PR history.

---

## `BACKLOG.md` structure

The navigator parses a strict Markdown layout. Deviating breaks the
parser; sticking to it is straightforward.

### Top-level shape

The parser is strict about section order: **Epics first, then Items.**

```markdown
# Title (optional preamble)

Free text introduction.

## Epics

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | Epic name | What this epic covers | active |
...

## Items

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 001 | Feature | First item — ... See [[E01]]. | 4 | 3 | 2 | 9 | Medium | proposed | E01 | 2026-01-01 | 2026-01-15 |
...
```

### Column reference (Epics table)

The Epics table must have **exactly these four columns in this order**:

| Column | Required | Format | Example | Notes |
|---|---|---|---|---|
| ID | yes | `E00`–`E99` | `E01` | Two-digit zero-padded; uniqueness enforced |
| Title | yes | free text | `Epic name` | Shown in group-by-epic headers |
| Description | yes | free text | `What this epic covers` | Multi-sentence OK |
| Status | yes | free text | `active`, `complete`, `parked` | No enforced enum; you pick the labels |

### Column reference (Items table)

The Items table must have **exactly these twelve columns in this order**:

| Column | Required | Format | Example | Notes |
|---|---|---|---|---|
| ID | yes | digits | `001` | Must be unique; reused on strikethrough |
| Category | yes | free text | `Feature`, `Bug`, `Tech Debt`, `Enhancement`, `Documentation` | No enforced taxonomy; you pick the labels |
| Description | yes | Markdown | `[Title](specs/001/spec.md) — short summary. See [[E01]].` | Supports Markdown links, bold/italic, `[[E##]]` epic tags, and escaped `\|` for literal pipes |
| V | optional | 1, 3, 5, or `-` | `4` | "Value" score |
| M | optional | 1, 3, 5, or `-` | `3` | "Media" score |
| A | optional | 1, 3, 5, or `-` | `2` | "Autonomy" score |
| Total | optional | sum of V+M+A | `9` | Column header **must be exactly `Total`**. If absent, the navigator computes from V/M/A; if all three are `-`, leave `-` |
| Complexity | optional | `Low`, `Medium`, `High`, or `-` | `Medium` | Hand-assigned |
| Status | yes | enum (see below) | `proposed` | |
| Epic | optional | `E00`–`E99` or blank | `E01` | Refers to an epic in the Epics table |
| Created | yes | ISO date | `2026-01-15` | Sentinel `2025-01-01` is used if git history is unavailable |
| Updated | yes | ISO date | `2026-02-08` | |

### Status taxonomy (enum)

The parser accepts these status values and renders them as coloured
lozenges:

| Status | Phase | Notes |
|---|---|---|
| `needs-interview` | Triage | Awaiting requirements gathering |
| `proposed` | Active | New idea |
| `approved` | Active | Approved for spec work |
| `specified` | Active | Spec written |
| `clarified` | Active | Spec questions resolved |
| `planned` | Active | Implementation plan exists |
| `tasked` | Active | Tasks broken down |
| `implementing` | Active | Code in progress |
| `complete` | Terminal | Shipped (typically rendered strikethrough — see below) |
| `blocked` | Terminal | Blocked on external dependency |
| `parked` | Terminal | Deliberately deferred |
| `rejected` | Terminal | Decided against |

You can define your own additional statuses, but the navigator's
filter UI won't surface them in the default dropdown. If you need a
custom taxonomy, fork (Path 2) and edit `src/types.ts`.

### Epic ID format

Epic IDs match the regex `^E\d{2}$` — i.e., `E00` through `E99`.
Reference an epic from an item's Description via `[[E01]]`, which the
navigator renders as a coloured pill. The recommended convention is
to put the tag at the **end** of the Description (e.g.,
`Short summary. See [[E01]].`) and also populate the item's dedicated
`Epic` column with the same ID. The parser accepts inline tags
anywhere in the Description, but the dedicated column is what
group-by-epic uses.

### Strikethrough (completed rows)

Wrap **every** cell value in a row in `~~` to mark it complete:

```markdown
| ~~007~~ | ~~Feature~~ | ~~[Title](spec.md). See [[E01]].~~ | ~~3~~ | ~~3~~ | ~~3~~ | ~~9~~ | ~~Medium~~ | ~~complete~~ | ~~E01~~ | ~~2026-02-10~~ | ~~2026-02-20~~ |
```

The navigator's "show / hide completed" toggle filters on this
pattern.

### Round-trip safety

The parser-serialiser pair is **byte-stable**: parsing `BACKLOG.md`,
making no edits, and re-serialising produces an output identical to
the input. This means:
- Comments, blank lines, and unusual whitespace are preserved.
- Rows the parser couldn't fully understand are kept as raw rows
  (you'll see a parse warning in the navigator's UI, but the row
  isn't deleted or rewritten).
- Hand-edits and navigator-edits coexist cleanly.

If you make a hand-edit that breaks parsing, the navigator surfaces a
parse-warning banner; fix the offending line and reload.

---

## GitHub PAT setup (for editing via the navigator)

The navigator reads `BACKLOG.md` without authentication (anonymous
GitHub API, 60 req/hr rate-limited). To **edit** — open a PR, push a
commit — you need a Personal Access Token.

### Creating a PAT

The navigator's Settings panel has a one-click link with the right
scope pre-selected:

```
https://github.com/settings/tokens/new?scopes=repo
```

This generates a **classic PAT** with `repo` scope (the minimum needed
to create branches, commit files, and open PRs).

Alternatively, for least-privilege, use a **fine-grained PAT** scoped
to *only* your backlog repo with these permissions:
- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only (auto-included)

### Storage

The PAT is stored only in your browser's `localStorage` for the
navigator's origin. It is **never** sent to any server other than
`https://api.github.com`. No telemetry, no third-party storage.

### Rotation

Revoke and replace tokens on the schedule your org requires. The
Settings panel has a "Clear token" action that removes the PAT from
`localStorage` immediately. After clearing, the navigator drops to
read-only mode.

### Shared / kiosk browsers

If your team uses shared browsers (kiosks, lab PCs), users should
clear the token after each session via the Settings panel. The
navigator does not auto-expire stored tokens.

---

## Frequently asked

**Q: Does the navigator work without internet?**
A: Once loaded, the SPA shell works offline (PWA service worker
caches the bundle). But every read/write hits `api.github.com`, so
backlog *content* requires network. The navigator surfaces a network
error banner when offline; your local edits stay pending until you
reconnect.

**Q: Can I use my own non-debrief scoring rubric?**
A: The V·M·A columns are fixed in the schema. If your project uses
different scoring (RICE, ICE, MoSCoW), you'd need to fork and edit
`src/types.ts` + the column-rendering logic. Lower-friction
alternative: use Categories as a freeform field for your custom
labels.

**Q: How do I add a new status value?**
A: Fork (Path 2) and edit `STATUS_VALUES` in `src/types.ts` plus the
filter dropdown. The parser accepts unknown statuses as raw values —
they round-trip but won't appear in the filter UI.

**Q: Multiple repos in one navigator instance?**
A: Use the `?repo=<org>/<name>&branch=<branch>` URL form to switch
repos at runtime. The instance you host (Path 2) has its own default
repo baked in, but the URL form overrides at runtime.

**Q: How does the navigator handle merge conflicts?**
A: If `BACKLOG.md` has moved on the target branch since you loaded
it, the navigator's "Push Changes" surfaces a stale-base error and
asks you to reload. Your pending edits are preserved across the
reload; you re-apply them against the new base.

---

## Where to go from here

- Setting up CI for your fork? → [CONFIGURATION.md](CONFIGURATION.md)
- PAT security policy? → [SECURITY.md](SECURITY.md)
- Reporting a bug or proposing a feature? → open an issue against
  the upstream repo.
