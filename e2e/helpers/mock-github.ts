import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'backlog-fixture.md');

/**
 * Mock GitHub Contents API response — Playwright intercepts the navigator's
 * fetch to api.github.com and serves the hand-curated fixture so the suite
 * never depends on the live BACKLOG.md state.
 *
 * Desktop specs in `e2e/` can call `mockGithubBacklogFetch(page)` and pick up
 * the default fixture path. Mobile specs in `e2e/mobile/` must pass an explicit
 * fixture path (one extra `..`) so the resolution does not depend on caller
 * `__dirname`.
 */
export async function mockGithubBacklogFetch(
  page: Page,
  fixturePath: string = DEFAULT_FIXTURE_PATH,
): Promise<void> {
  const text = readFileSync(fixturePath, 'utf8');
  const body = JSON.stringify({
    type: 'file',
    encoding: 'base64',
    content: Buffer.from(text, 'utf8').toString('base64'),
    sha: '0123456789abcdef0123456789abcdef01234567',
    path: 'BACKLOG.md',
  });
  await page.route('https://api.github.com/**/contents/BACKLOG.md*', async (route) => {
    if (route.request().method() !== 'GET') {
      // Let later-registered handlers (e.g. realWrite's PUT mock) take over.
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    });
  });
}
