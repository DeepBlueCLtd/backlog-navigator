/**
 * Target viewports for mobile-parity Playwright projects (FR-021).
 *
 * Three sizes:
 *   - IPHONE — 375 × 812 (iPhone X portrait, the floor for spec.md SC-001).
 *   - IPAD_PORTRAIT — 768 × 1024 (still mobile layout per A-2; below 1024px).
 *   - IPAD_LANDSCAPE — 1024 × 768 (boundary case: desktop layout per FR-001
 *     edge case — viewport-width = 1024 means the desktop table renders).
 */
export const IPHONE = { width: 375, height: 812 } as const;
export const IPAD_PORTRAIT = { width: 768, height: 1024 } as const;
export const IPAD_LANDSCAPE = { width: 1024, height: 768 } as const;

export type ViewportName = 'mobile-iphone' | 'tablet-portrait' | 'tablet-landscape';

export const VIEWPORTS: Record<ViewportName, { width: number; height: number }> = {
  'mobile-iphone': IPHONE,
  'tablet-portrait': IPAD_PORTRAIT,
  'tablet-landscape': IPAD_LANDSCAPE,
};
