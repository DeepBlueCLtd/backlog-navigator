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

// jsdom does not compute layout. `@tanstack/react-virtual` reads
// `parent.getBoundingClientRect().height` and `parent.clientHeight` to
// decide which rows are in view; without a stub it returns 0 and renders
// no items. Provide a fixed virtualised viewport for tests so CardList
// tests can assert which rows mount.
if (typeof Element !== 'undefined') {
  const FIXED_VIEWPORT_HEIGHT = 2000;
  const FIXED_VIEWPORT_WIDTH = 375;

  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(): number {
      return FIXED_VIEWPORT_HEIGHT;
    },
  });
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(): number {
      return FIXED_VIEWPORT_WIDTH;
    },
  });

  const originalGetBCR = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    const r = originalGetBCR.call(this);
    if (r.height > 0 || r.width > 0) return r;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: FIXED_VIEWPORT_WIDTH,
      bottom: FIXED_VIEWPORT_HEIGHT,
      width: FIXED_VIEWPORT_WIDTH,
      height: FIXED_VIEWPORT_HEIGHT,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
}
