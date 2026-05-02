import { expect, test } from '@playwright/test';

/**
 * Story 1 acceptance check — load the app in dry-run mode and verify the
 * basics render. The app loads BACKLOG.md from `main` via GitHub by default,
 * which won't work in CI without network — so this spec asserts on the dry-run
 * shell instead, which is what preview deployments will exercise.
 */
test.describe('Browse view', () => {
  test('renders the dry-run banner and shell when invoked with ?dryRun=1', async ({ page }) => {
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('dry-run-banner')).toBeVisible();
    // The app shell should render even if the GitHub fetch errors.
    await expect(page.locator('.app-shell')).toBeVisible();
  });
});
