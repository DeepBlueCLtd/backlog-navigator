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
 * Issue 1A regression guard.
 *
 * Open the bottom-sheet status editor in iPad-portrait (768x1024 — mobile
 * layout), make a dirty edit, then resize the viewport to 1024x768
 * (desktop layout). The cross-mode crossing must surface the FR-009
 * discard-confirm dialog rather than silently destroying the edit
 * (Article I.3 — no silent failures).
 *
 * This spec runs explicitly in the `tablet-portrait` project so it
 * starts in mobile mode; the resize crosses the breakpoint into desktop.
 */
test.describe('Backlog Navigator — cross-mode rotation regression (Issue 1A)', () => {
  test('dirty bottom-sheet surfaces discard-confirm on cross-breakpoint resize', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'tablet-portrait') {
      test.skip(true, 'Spec only meaningful in the tablet-portrait project (768x1024 → 1024x768).');
      return;
    }
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    // Open the status editor on the first card.
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const beforeStatus = (await firstCard.getByTestId('status-chip').textContent()) ?? '';
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();

    // Make a dirty edit.
    const select = sheet.locator('select[aria-label="Status"]');
    const newStatus = beforeStatus.toLowerCase().includes('approved') ? 'specified' : 'approved';
    await select.selectOption(newStatus);

    // Cross the 1024 px breakpoint by resizing the viewport.
    await page.setViewportSize({ width: 1024, height: 768 });

    // The discard-confirm dialog should appear.
    await expect(page.getByTestId('discard-confirm')).toBeVisible();

    // Save commits the edit.
    await page.getByTestId('discard-confirm-save').click();
    await expect(page.getByTestId('discard-confirm')).toBeHidden();

    // We're now on desktop layout — confirm the table is visible.
    await expect(page.locator('table.items')).toBeVisible();
  });
});
