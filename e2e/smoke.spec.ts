import { expect, test } from '@playwright/test';

test('bootstrap shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.locator('.banner')).toContainText('Backlog Navigator');
});
