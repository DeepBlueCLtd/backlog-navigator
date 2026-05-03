/**
 * Type stub for the virtual module exposed by `vite-plugin-pwa`.
 * The plugin synthesises this module at build time; without a stub,
 * `tsc` rejects the dynamic import in `registerSW.ts`.
 */
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(opts?: RegisterSWOptions): (reload?: boolean) => Promise<void>;
}
