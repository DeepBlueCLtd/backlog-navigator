import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import { validateManifest } from './src/pwa/manifestSchema';

const manifest = validateManifest({
  name: 'Debrief Backlog Navigator',
  short_name: 'Backlog',
  description: 'Edit the Debrief project backlog from any device.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  theme_color: '#1f1f1f',
  background_color: '#ffffff',
  icons: [
    {
      src: 'icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: 'icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
});

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/debrief-future/backlog-navigator/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        // App shell only — never cache GitHub responses (FR-019, R-2).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://api.github.com',
            handler: 'NetworkOnly',
            options: { cacheName: 'github-api-noncache' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://raw.githubusercontent.com',
            handler: 'NetworkOnly',
            options: { cacheName: 'github-raw-noncache' },
          },
        ],
        // Old SW remains active until the user confirms reload (FR-020).
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    'import.meta.env.VITE_BACKLOG_NAV_DRY_RUN': JSON.stringify(
      process.env.VITE_BACKLOG_NAV_DRY_RUN || 'false',
    ),
  },
});
