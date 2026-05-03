import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { IPHONE, IPAD_PORTRAIT, IPAD_LANDSCAPE } from './e2e/helpers/viewports';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const chromiumPathFile = join(__dirname, '.chromium-path');
let chromiumPath: string | undefined = process.env.CHROMIUM_PATH;
if (!chromiumPath && existsSync(chromiumPathFile)) {
  chromiumPath = readFileSync(chromiumPathFile, 'utf8').trim();
}
const useSparticuz = !!chromiumPath;

console.log(`Playwright config: useSparticuz=${useSparticuz}, chromiumPath=${chromiumPath}`);

const launchOptions = useSparticuz
  ? {
      executablePath: chromiumPath,
      headless: true,
      args: [
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--no-zygote',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
      ],
    }
  : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    launchOptions,
  },
  // Per-viewport projects for #244 mobile parity (FR-021).
  // Existing desktop specs run under the default project; mobile specs run
  // under the three named projects so a single `pnpm test:e2e mobile/`
  // exercises all three viewports.
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testIgnore: /mobile\//,
    },
    {
      name: 'mobile-iphone',
      use: { ...devices['Desktop Chrome'], viewport: IPHONE, hasTouch: true },
      testMatch: /mobile\//,
    },
    {
      name: 'tablet-portrait',
      use: { ...devices['Desktop Chrome'], viewport: IPAD_PORTRAIT, hasTouch: true },
      testMatch: /mobile\//,
    },
    {
      name: 'tablet-landscape',
      use: { ...devices['Desktop Chrome'], viewport: IPAD_LANDSCAPE, hasTouch: true },
      testMatch: /mobile\//,
    },
  ],
  webServer: {
    command: 'pnpm preview --port 5175',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  timeout: 30000,
});
