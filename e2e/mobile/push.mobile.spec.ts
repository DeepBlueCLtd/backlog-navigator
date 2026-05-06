import { expect, test } from '@playwright/test';
import { mockGithubBacklogFetch } from '../helpers/mock-github.js';

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

    // Make a dirty edit via the bottom sheet. Fixture row 001 is `proposed`
    // → `approved` is a guaranteed change (no-op-free per #245).
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();
    const select = sheet.locator('select[aria-label="Status"]');
    await select.selectOption('approved');
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

    // Fixture row 001 is `proposed`; flip to `approved` as a deterministic edit.
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    const select = sheet.locator('select[aria-label="Status"]');
    await select.selectOption('approved');
    await sheet.getByTestId('bottom-sheet-save').click();

    await page.getByTestId('push-button').click();

    // The dry-run PushDialog opens with the standard confirm button.
    await expect(page.getByTestId('confirm-push')).toBeVisible();
  });
});
