/**
 * Inlined from @debrief/components/hooks/useIsMobile (debrief-future #246).
 * Kept in-repo to avoid a runtime dependency on the debrief monorepo.
 * If divergence is needed, edit freely; if the upstream version improves,
 * pull the change manually.
 *
 * See specs/249-extract-backlog-navigator/research.md R-007 for the rationale.
 */

import { useState, useEffect } from 'react';

/**
 * Hook that returns true when the viewport is at or below the given breakpoint.
 * Uses `window.matchMedia` for efficient, event-driven updates (no resize polling).
 */
// eslint-disable-next-line no-restricted-syntax -- intentional inline-copy per spec 249 R-007 (extraction-prep)
export function useIsMobile(breakpoint = 767): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    // Sync in case initial state was stale (SSR hydration edge case)
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
