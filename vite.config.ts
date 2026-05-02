import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/debrief-future/backlog-navigator/',
  plugins: [react()],
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
