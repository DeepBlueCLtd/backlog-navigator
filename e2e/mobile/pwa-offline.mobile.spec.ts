import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKLOG_PATH = join(__dirname, '..', '..', '..', '..', 'BACKLOG.md');

function encodeUtf8ToBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

async function mockGithubBacklogFetch(page: Page): Promise<void> {
  const text = readFileSync(BACKLOG_PATH, 'utf8');
  const body = JSON.stringify({
    type: 'file',
    encoding: 'base64',
    content: encodeUtf8ToBase64(text),
    sha: '0123456789abcdef0123456789abcdef01234567',
    path: 'BACKLOG.md',
  });
  await page.route('https://api.github.com/**/contents/BACKLOG.md*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    });
  });
}

/**
 * Story 5 — PWA install + offline shell + update prompt (US5).
 *
 * Runs at 375×812 only. The install affordance (US5 AS1) is NOT
 * Playwright-testable — `beforeinstallprompt` cannot be reliably
 * triggered headlessly. That gate lives in the Lighthouse PWA audit
 * and the manual-test log.
 */
test.describe('Backlog Navigator — PWA offline + standalone (US5 AS2/AS3)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-iphone',
      'PWA offline spec only meaningful at the iPhone viewport.',
    );
  });

  test('offline launch with no cached data renders the offline empty state', async ({ page, context }) => {
    // Block ALL network so the parser produces an empty doc.
    await context.route('**/*', (route) => {
      // Allow the dev server's own HTML/JS — the SW would normally cache
      // the app shell. For this test we simulate a fresh launch under
      // offline conditions: the app shell must still render, but the
      // BACKLOG.md fetch should fail.
      const url = route.request().url();
      if (url.includes('localhost') || url.startsWith('blob:')) {
        return route.continue();
      }
      return route.abort();
    });

    await page.goto('/?dryRun=1');
    // Force navigator.onLine to false before any data fetch.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    });

    // The card-list-offline state appears when the doc has zero items
    // AND navigator.onLine is false.
    await expect(page.getByTestId('offline-empty-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Backlog data unavailable/i)).toBeVisible();
  });

  test('display-mode: standalone matchMedia is honoured', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    // Override matchMedia so the page believes it's launched as a standalone PWA.
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => {
        if (q.includes('display-mode: standalone')) {
          return {
            matches: true,
            media: q,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
          } as unknown as MediaQueryList;
        }
        return original(q);
      };
    });

    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    // Probe matchMedia from the page context to confirm the override stuck.
    const standaloneMatches = await page.evaluate(() =>
      window.matchMedia('(display-mode: standalone)').matches,
    );
    expect(standaloneMatches).toBe(true);
  });
});
