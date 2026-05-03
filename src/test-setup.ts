// Vitest setup — jsdom polyfills.
//
// `useIsMobile` (from @debrief/components) calls `window.matchMedia`,
// which jsdom does not implement out of the box. The polyfill below
// returns a stable "no media query matched" object that satisfies the
// MediaQueryList shape; tests that need to drive the breakpoint pass
// `isMobileOverride` to <EditorOverlayProvider> directly rather than
// poking matchMedia state.

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
