/**
 * Detect whether the navigator is running in dry-run preview mode.
 *
 * Resolution order:
 *   1. URL `?dryRun=1` (operator override; useful in dev)
 *   2. `import.meta.env.VITE_BACKLOG_NAV_DRY_RUN === 'true'` (build-time flag
 *      baked into preview deployments)
 *   3. live mode otherwise
 */

export type DeploymentMode = 'live' | 'dry-run';

interface ViteEnv {
  readonly VITE_BACKLOG_NAV_DRY_RUN?: string;
}
interface ViteImportMeta {
  readonly env?: ViteEnv;
}

export function detectDeploymentMode(search: string = ''): DeploymentMode {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('dryRun') === '1') return 'dry-run';
  const meta = import.meta as unknown as ViteImportMeta;
  const env = meta.env?.VITE_BACKLOG_NAV_DRY_RUN;
  if (env === 'true' || env === '1') return 'dry-run';
  return 'live';
}

export function detectPrNumber(search: string = ''): number | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = params.get('pr');
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}
