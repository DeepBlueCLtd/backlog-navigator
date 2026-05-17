# Extraction-kit follow-ups

> **⚠ DEPRECATED.** These notes relate to the legacy Backlog Navigator
> PWA extraction process and are no longer actively tracked. The
> project's working backlog is now the GitHub Project at
> <https://github.com/orgs/DeepBlueCLtd/projects/4>; see
> [`METHODOLOGY.md`](METHODOLOGY.md).

---

Bugs and gaps discovered after running the kit at
`specs/249-extract-backlog-navigator/extraction-kit` from
`debrief-future@claude/implement-speckit-249-xKZX8`. Each item should
be back-ported to that branch so the next adopter doesn't hit it.

## Confirmed bugs (fixed locally, kit still needs the patch)

- **`extraction-kit/workflows/pr-preview.yml` JS syntax error.** The
  `actions/github-script` body uses `\\\`` to try to escape backticks
  inside a JS template literal, but in a YAML `|` block backslashes
  are preserved literally — the runner-side JS parser sees `\\\`` and
  throws `SyntaxError`. Use a single backslash (`\\``).

- **`extraction-kit/workflows/ci.yml` missing ffmpeg install.** The
  e2e job runs chromium via `@sparticuz/chromium` (no ffmpeg shipped),
  so `e2e/interaction.spec.ts`'s `test.use({ video })` fails with
  *"Executable doesn't exist at .../ffmpeg-1011/ffmpeg-linux"*. Add
  `pnpm exec playwright install ffmpeg` after the install step.

- **`extraction-kit/templates/BACKLOG.dummy.md` is parser-invalid.**
  Three independent mismatches with the parser contract:
  (1) section order — dummy has Items before Epics; parser expects
  Epics first; (2) Items header column 7 is `V·M·A`; parser expects
  `Total`; (3) Epics header has 3 columns; parser expects 4 columns
  (`ID | Title | Description | Status`). The replacement that
  parses + round-trips is checked into this repo's `BACKLOG.md`.

## Latent bugs in the extracted source (not kit's fault, but worth flagging)

- **`e2e/mobile/lazy-mobile-chunk.mobile.spec.ts` chunk regex.** Uses
  `[A-Za-z0-9]+` to match vite's bundle hash, but vite hashes can
  contain `_` and `-` (e.g. `CardList-Cd_x-GQH.js`). Widen to
  `[A-Za-z0-9_-]+`.

## Kit-level design gaps (no PR-1 reproduction; observed via deployed preview)

These are not bugs in any single file — they're shape issues in
how the extraction kit wires the preview workflow against the app.

- **PR preview can't preview the PR's BACKLOG content.** The app
  (`src/App.tsx:85`) hardcodes `targetRef = 'main'` unless `?pr=N`
  is supplied. The pr-preview workflow does not pass `?pr=N` in its
  default-view URL, so the preview at `/previews/pr-<n>/` *always*
  fetches BACKLOG.md from `main`, regardless of what the PR changes.
  Two possible fixes — pick one:
  1. **Kit-side**: have the pr-preview workflow build the app with
     `VITE_DEFAULT_BRANCH=${{ github.event.pull_request.head.ref }}`
     and have the app fall back to that env var when no `?pr=` is
     supplied. The default preview URL would then reflect the PR.
  2. **Kit-side**: change the sticky comment's "Default view" link
     to `${previewUrl}?pr=${prNumber}` so users land on the PR-mode
     view by default.

- **Sticky comment advertises `?repo=&branch=` URLs the app doesn't
  parse.** Currently `src/App.tsx` only knows `?pr=N`; the comment's
  "Same repo, branch" and "Third-party adopter form" lines are dead
  links. Either implement the URL form (parse `?branch=`, fall back
  to `?repo=`), or remove those bullets from the sticky comment in
  `extraction-kit/workflows/pr-preview.yml`.

- **Add `VITE_DEFAULT_BRANCH` to the kit's configuration seam.**
  The kit already documents `VITE_DEFAULT_OWNER` and
  `VITE_DEFAULT_REPO` in `extraction-kit/templates/CONFIGURATION.md`.
  Adding `VITE_DEFAULT_BRANCH` (default `main`) gives adopters a way
  to preview a non-main branch as the bundled default, which is the
  building block needed for the previous bullet.
