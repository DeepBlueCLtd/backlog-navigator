/**
 * Axe-core accessibility assertions on the loaded browse view + the open
 * Push dialog. Article XIV (a11y).
 */

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockGithubBacklogFetch } from './helpers/mock-github.js';

test.describe('Backlog Navigator a11y', () => {
  test.beforeEach(async ({ page }) => {
    await mockGithubBacklogFetch(page);
  });

  test('browse view has no serious axe violations', async ({ page }) => {
    await page.goto('/?dryRun=1');
    await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    if (serious.length > 0) {
      // Surface every serious violation in the test output for diagnosis.
      console.log(
        'Serious axe violations:',
        JSON.stringify(
          serious.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
          null,
          2,
        ),
      );
    }
    expect(serious).toEqual([]);
  });

  test('Push dialog has no serious axe violations', async ({ page }) => {
    await page.goto('/?dryRun=1');
    await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });
    // Stage one edit so the Push button is enabled.
    const row = page.locator('table.items tbody tr').first();
    await row.locator('td').nth(6).click();
    await row.locator('.cell-editor select[aria-label="Status"]').selectOption('clarified');
    await page.getByTestId('push-changes').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    if (serious.length > 0) {
      console.log(
        'Serious axe violations in dialog:',
        JSON.stringify(
          serious.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
          null,
          2,
        ),
      );
    }
    expect(serious).toEqual([]);
  });
});
