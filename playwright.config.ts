import { defineConfig } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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
  webServer: {
    command: 'pnpm preview --port 5175',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  timeout: 30000,
});
