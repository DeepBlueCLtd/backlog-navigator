import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ServiceWorkerUpdateState } from '../types';

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
 * Service-worker update banner (FR-020 + contracts/service-worker.md).
 *
 * Renders nothing in the `up-to-date` state. When `update-available`,
 * shows a top-of-viewport banner with Reload + Dismiss buttons. When
 * `updating`, shows a spinner placeholder until the page reloads.
 *
 * Dismiss closes the banner for the current session only — the SW
 * remains in `waiting` state, so the next page navigation re-fires
 * `onNeedRefresh` and the banner returns. No persistence (per
 * contracts/service-worker.md).
 */
export function UpdatePrompt(): JSX.Element | null {
  const state = usePWAUpdateState();
  const [dismissed, setDismissed] = useState(false);

  if (state.kind === 'up-to-date') return null;
  if (state.kind === 'update-available' && dismissed) return null;

  if (state.kind === 'updating') {
    return (
      <div
        className="pwa-update-banner pwa-update-banner-updating"
        data-testid="pwa-update-banner"
        data-state="updating"
        role="status"
      >
        <span aria-label="Updating">⏳ Updating…</span>
      </div>
    );
  }

  return (
    <div
      className="pwa-update-banner pwa-update-banner-available"
      data-testid="pwa-update-banner"
      data-state="update-available"
      role="status"
    >
      <span className="pwa-update-banner-text">
        ✨ An updated Backlog Navigator is ready.
      </span>
      <div className="pwa-update-banner-actions">
        <button
          type="button"
          className="pwa-update-reload"
          data-testid="pwa-update-reload"
          onClick={() => {
            void state.reload();
          }}
        >
          Reload
        </button>
        <button
          type="button"
          className="pwa-update-dismiss"
          data-testid="pwa-update-dismiss"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
