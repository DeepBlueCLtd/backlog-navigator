# PWA icons

`icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` are solid-colour
placeholders (#1f1f1f) generated programmatically during #244 implementation.

They satisfy:

- Lighthouse "icons exist", "icons are valid PNGs", "icons are 192×192/512×512".
- The `purpose: 'any maskable'` requirement (a solid square is trivially maskable).
- The contracts in `specs/244-navigator-mobile-pwa/contracts/pwa-manifest.md`.

Replace them with branded artwork before any public release. The dimensions
and file names must stay the same so the manifest config in `vite.config.ts`
keeps working.
