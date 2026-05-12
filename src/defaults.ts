/**
 * Build-time defaults for backlog-navigator.
 *
 * Two surfaces consume defaults:
 *
 * A. Runtime defaults — read at module-load via `import.meta.env`. These are
 *    the constants exported below. They feed `src/github/api.ts` and
 *    `src/strings.ts`. Adopters override by setting `VITE_*` env vars at
 *    build time.
 *
 * B. Build-time defaults consumed by `vite.config.ts` (PWA manifest fields,
 *    Vite `base` path). Those are read directly via `process.env` in
 *    `vite.config.ts` because that file evaluates *before* `import.meta.env`
 *    is available. Surface documented in `data-model.md` §B; not re-exported
 *    here to avoid implying a runtime cross-import.
 *
 * Reference: specs/249-extract-backlog-navigator/data-model.md §A and the
 * coupling-inventory (docs/extraction-audit/backlog-navigator/).
 */

interface DefaultsEnv {
  readonly VITE_DEFAULT_OWNER?: string;
  readonly VITE_DEFAULT_REPO?: string;
  readonly VITE_PROD_HOST?: string;
}
interface DefaultsImportMeta {
  readonly env?: DefaultsEnv;
}

const env = (import.meta as unknown as DefaultsImportMeta).env ?? {};

export const DEFAULT_OWNER: string = env.VITE_DEFAULT_OWNER ?? 'debrief';

export const DEFAULT_REPO: string = env.VITE_DEFAULT_REPO ?? 'debrief-future';

export const DEFAULT_REPO_LABEL: string = `${DEFAULT_OWNER}/${DEFAULT_REPO}`;

export const PROD_HOST: string = env.VITE_PROD_HOST ?? 'debrief.github.io';
