import { createContext, useContext, type ReactNode } from 'react';
import type { ServiceWorkerUpdateState } from '../types';

/**
 * Service-worker update context. Lives outside the StoreApi reducer because
 * the SW lifecycle is orthogonal to backlog state and shouldn't bloat reducer
 * transitions (data-model.md note).
 */
interface PWAUpdateContextValue {
  state: ServiceWorkerUpdateState;
}

const PWAUpdateContext = createContext<PWAUpdateContextValue>({
  state: { kind: 'up-to-date' },
});

export function PWAUpdateProvider({
  state,
  children,
}: {
  state: ServiceWorkerUpdateState;
  children: ReactNode;
}): JSX.Element {
  return <PWAUpdateContext.Provider value={{ state }}>{children}</PWAUpdateContext.Provider>;
}

export function usePWAUpdateState(): ServiceWorkerUpdateState {
  return useContext(PWAUpdateContext).state;
}

/**
 * Visual surface for the SW update lifecycle. Phase 2 mounts this as an
 * empty placeholder; the actual banner content is filled in Phase 7
 * (Story 5 — PWA install + update).
 */
export function UpdatePrompt(): JSX.Element | null {
  const state = usePWAUpdateState();
  if (state.kind === 'up-to-date') return null;
  // Phase 2 placeholder — non-rendering. Phase 7 task T064 fills this in.
  return null;
}
