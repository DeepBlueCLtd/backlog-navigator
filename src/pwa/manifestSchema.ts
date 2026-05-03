import { z } from 'zod';

/**
 * Zod schema for the PWA manifest config we hand to vite-plugin-pwa.
 *
 * Per `contracts/pwa-manifest.md`, all fields below are required for
 * Lighthouse PWA ≥ 90. Validate at build time so a typo fails fast,
 * before the manifest is emitted.
 */

const ICON_PURPOSES = ['any', 'maskable', 'monochrome'] as const;
const ICON_TYPES = ['image/png', 'image/svg+xml'] as const;
const DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui', 'browser'] as const;
const ORIENTATIONS = [
  'any',
  'natural',
  'portrait',
  'portrait-primary',
  'portrait-secondary',
  'landscape',
  'landscape-primary',
  'landscape-secondary',
] as const;

const HEX_COLOUR_RE = /^#[0-9a-fA-F]{3,8}$/;

const manifestIconSchema = z.object({
  src: z.string().min(1, 'icon src must be non-empty'),
  sizes: z.string().regex(/^\d+x\d+$/, 'icon sizes must be NxM (e.g. "192x192")'),
  type: z.enum(ICON_TYPES),
  purpose: z
    .string()
    .min(1)
    .refine(
      (raw) => {
        const tokens = raw.split(/\s+/).filter(Boolean);
        return tokens.length > 0 && tokens.every((t) => (ICON_PURPOSES as readonly string[]).includes(t));
      },
      {
        message: `icon purpose tokens must be a subset of ${ICON_PURPOSES.join(', ')}`,
      },
    ),
});

export const manifestSchema = z
  .object({
    name: z.string().min(1, 'name required'),
    short_name: z.string().min(1).max(12, 'short_name must be ≤ 12 characters'),
    description: z.string().min(1),
    start_url: z.string().min(1),
    scope: z.string().min(1),
    display: z.enum(DISPLAY_MODES),
    orientation: z.enum(ORIENTATIONS),
    theme_color: z.string().regex(HEX_COLOUR_RE, 'theme_color must be a hex string'),
    background_color: z.string().regex(HEX_COLOUR_RE, 'background_color must be a hex string'),
    icons: z.array(manifestIconSchema).min(1),
  })
  .superRefine((m, ctx) => {
    if (m.display !== 'standalone') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'display MUST be "standalone" per FR-017 / Story 5 AS2',
        path: ['display'],
      });
    }
    const has192 = m.icons.some((i) => i.sizes === '192x192');
    const has512 = m.icons.some((i) => i.sizes === '512x512');
    if (!has192) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'icons[] must include at least one 192x192 entry',
        path: ['icons'],
      });
    }
    if (!has512) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'icons[] must include at least one 512x512 entry',
        path: ['icons'],
      });
    }
    const everyMaskable = m.icons.every((i) => i.purpose.split(/\s+/).includes('maskable'));
    if (!everyMaskable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'every icon must include "maskable" in its purpose tokens (per contracts/pwa-manifest.md)',
        path: ['icons'],
      });
    }
  });

export type ManifestConfig = z.infer<typeof manifestSchema>;

/**
 * Helper for the Vite config — validates and returns the typed manifest.
 * Throws a readable error if invalid, which fails the build.
 */
export function validateManifest(raw: unknown): ManifestConfig {
  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`PWA manifest config is invalid:\n${issues}`);
  }
  return result.data;
}
