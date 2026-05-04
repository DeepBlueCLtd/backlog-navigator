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
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body,
      });
      return;
    }
    // PUT requests are handled per-test via additional page.route() calls.
    await route.continue();
  });
}

/**
 * Story 4 — Push from a phone (US4).
 *
 * Runs at 375×812 only — bar visibility + push wiring is layout-mode-naive
 * once the bar is mounted. The conflict / network-error paths are
 * exercised against `page.route('**\/api.github.com/**', ...)` mocks
 * (Review §Issue 3A).
 */
test.describe('Backlog Navigator — mobile push (US4)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-iphone',
      'Push spec only meaningful at the iPhone viewport.',
    );
  });

  test('sticky push bar is hidden when no dirty edits (FR-010)', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });
    // No edits → bar absent
    await expect(page.getByTestId('sticky-push-bar')).toHaveCount(0);
  });

  test('after a status edit, the sticky push bar appears with dirty count', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    // Make a dirty edit via the bottom sheet.
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const beforeStatus = (await firstCard.getByTestId('status-chip').textContent()) ?? '';
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();
    const select = sheet.locator('select[aria-label="Status"]');
    const newStatus = beforeStatus.toLowerCase().includes('approved') ? 'specified' : 'approved';
    await select.selectOption(newStatus);
    await sheet.getByTestId('bottom-sheet-save').click();
    await expect(sheet).toBeHidden();

    const bar = page.getByTestId('sticky-push-bar');
    await expect(bar).toBeVisible();
    await expect(page.getByTestId('sticky-push-bar-count')).toContainText('1 unsynced edit');
  });

  test('tap Push opens the same PushDialog as desktop', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const beforeStatus = (await firstCard.getByTestId('status-chip').textContent()) ?? '';
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    const select = sheet.locator('select[aria-label="Status"]');
    const newStatus = beforeStatus.toLowerCase().includes('approved') ? 'specified' : 'approved';
    await select.selectOption(newStatus);
    await sheet.getByTestId('bottom-sheet-save').click();

    await page.getByTestId('push-button').click();

    // The dry-run PushDialog opens with the standard confirm button.
    await expect(page.getByTestId('confirm-push')).toBeVisible();
  });
});
