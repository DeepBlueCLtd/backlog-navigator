import type { ServiceWorkerUpdateState } from '../types';

export type { ServiceWorkerUpdateState };
export type PWAInstallState = 'not-installed' | 'installable' | 'installed';

/**
 * Thin wrapper around `virtual:pwa-register`.
 *
 * Imports the virtual module dynamically so:
 *   - the test harness (vitest) doesn't choke on the missing virtual module,
 *   - the SW registration only runs in real browser builds.
 *
 * The caller is `main.tsx`, which passes a callback that pipes the
 * `ServiceWorkerUpdateState` into the React context that backs `<UpdatePrompt>`.
 *
 * Per Article I.3, registration failures are logged but never thrown — the
 * app still works without a service worker.
 */
export async function startServiceWorker(
  onUpdate: (state: ServiceWorkerUpdateState) => void,
): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    onUpdate({ kind: 'up-to-date' });
    return;
  }
  try {
    // Dynamic import — the virtual module is only resolvable under a
    // vite-plugin-pwa build context.
    const mod = (await import(/* @vite-ignore */ 'virtual:pwa-register')) as {
      registerSW: (opts: {
        immediate?: boolean;
        onNeedRefresh?: () => void;
        onOfflineReady?: () => void;
        onRegisterError?: (err: unknown) => void;
      }) => (reload?: boolean) => Promise<void>;
    };
    const updateSW = mod.registerSW({
      immediate: true,
      onNeedRefresh: () => {
        onUpdate({
          kind: 'update-available',
          reload: async () => {
            onUpdate({ kind: 'updating' });
            await updateSW(true);
          },
        });
      },
      onOfflineReady: () => {
        // App shell cached; nothing user-visible required (the user sees the app already).
      },
      onRegisterError: (err) => {
        // Per Article I.3 — surface, do not swallow.
        // eslint-disable-next-line no-console
        console.error('[pwa] service worker registration failed', err);
      },
    });
    onUpdate({ kind: 'up-to-date' });
  } catch (err) {
    // Dynamic-import failure (e.g. dev mode without the plugin runtime).
    // eslint-disable-next-line no-console
    console.warn('[pwa] virtual:pwa-register unavailable; running without SW', err);
    onUpdate({ kind: 'up-to-date' });
  }
}
