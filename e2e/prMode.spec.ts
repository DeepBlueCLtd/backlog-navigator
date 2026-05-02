/**
 * PR-mode E2E. `?pr=NNN` loads BACKLOG.md from the PR's head branch and
 * commits onto that branch directly (no new branch, no new PR).
 */

import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKLOG_PATH = join(__dirname, '..', '..', '..', 'BACKLOG.md');

test.describe('PR mode (?pr=NNN)', () => {
  test('loads BACKLOG.md from the PR head branch and surfaces the PR-mode banner', async ({
    page,
  }) => {
    const text = readFileSync(BACKLOG_PATH, 'utf8');
    const fileBody = JSON.stringify({
      type: 'file',
      encoding: 'base64',
      content: Buffer.from(text, 'utf8').toString('base64'),
      sha: '0123456789abcdef0123456789abcdef01234567',
      path: 'BACKLOG.md',
    });

    // Mock pulls/123
    await page.route('https://api.github.com/**/pulls/123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          number: 123,
          state: 'open',
          title: 'Update backlog',
          head: { ref: 'feature/refine-backlog', sha: 'fff111000aaa' },
          html_url: 'https://github.com/debrief/debrief-future/pull/123',
        }),
      });
    });

    // Mock the contents read — must be called with ref=feature/refine-backlog
    let observedRef: string | null = null;
    await page.route('https://api.github.com/**/contents/BACKLOG.md*', async (route) => {
      const url = new URL(route.request().url());
      observedRef = url.searchParams.get('ref');
      await route.fulfill({ status: 200, contentType: 'application/json', body: fileBody });
    });

    await page.goto('/?dryRun=1&pr=123');

    // PR-mode banner shows the branch
    await expect(page.getByTestId('pr-mode-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('pr-mode-banner')).toContainText('PR #123');
    await expect(page.getByTestId('pr-mode-banner')).toContainText('feature/refine-backlog');

    // The contents read must have used the head branch as the ref
    expect(observedRef).toBe('feature/refine-backlog');

    // Items table renders
    await expect(page.locator('table.items')).toBeVisible();
  });

  test('invalid PR number surfaces a clear error', async ({ page }) => {
    await page.route('https://api.github.com/**/pulls/9999', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not Found' }),
      });
    });
    await page.goto('/?dryRun=1&pr=9999');
    await expect(page.locator('.banner.error')).toBeVisible({ timeout: 10000 });
  });
});
