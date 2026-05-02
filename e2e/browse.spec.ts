import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKLOG_PATH = join(__dirname, '..', '..', '..', 'BACKLOG.md');
const SCREENSHOTS_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'specs',
  '242-backlog-navigator',
  'evidence',
  'screenshots',
);

/**
 * Mock GitHub Contents API response — Playwright intercepts the navigator's
 * fetch to api.github.com and serves the local BACKLOG.md instead, so the
 * navigator renders against real data without leaving the cloud sandbox.
 */
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

test.describe('Backlog Navigator — Story 1 evidence', () => {
  test('renders the dry-run shell', async ({ page }) => {
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('dry-run-banner')).toBeVisible();
    await expect(page.locator('.app-shell')).toBeVisible();
  });

  test('captures browse-light screenshot', async ({ page }) => {
    page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[browser-error]', err.message));
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('dry-run-banner')).toBeVisible();
    // Wait for the table to render.
    await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.items tbody tr').first()).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'browse-light.png'),
      fullPage: false,
    });
  });

  test('captures group-by-epic screenshot', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });
    // Click "Group by epic" toggle in toolbar
    await page.getByRole('button', { name: /Group by epic/i }).click();
    await expect(page.getByTestId('epic-group-header').first()).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'group-by-epic.png'),
      fullPage: false,
    });
  });

  test('captures push-dialog screenshot', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });

    // Stage 3 edits by clicking status cells on the first three rows.
    for (let i = 0; i < 3; i++) {
      const row = page.locator('table.items tbody tr').nth(i);
      // Click the status cell — 9th column (0-indexed 8: id, cat, desc, V, M, A, total, complex, status)
      await row.locator('td').nth(8).click();
      // The cell editor's <select> is inside the row; pick that one (not the
      // FilterBar's Status filter which shares aria-label="Status").
      const dropdown = row.locator('.cell-editor select[aria-label="Status"]');
      await dropdown.selectOption('approved');
    }

    // Wait for footer to update.
    await expect(page.getByTestId('pending-count')).toContainText(/pending edit/);

    // Open the Push dialog
    await page.getByTestId('push-changes').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'push-dialog.png'),
      fullPage: false,
    });

    // Toggle the raw-diff and capture again as evidence
    await page.getByTestId('toggle-diff').click();
    await expect(page.getByTestId('diff-output')).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'push-dialog-with-diff.png'),
      fullPage: false,
    });
  });

  test('captures dry-run-banner screenshot', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('dry-run-banner')).toBeVisible();
    // Banner is at the top — capture just the top of the page
    const banner = page.getByTestId('dry-run-banner');
    await banner.screenshot({
      path: join(SCREENSHOTS_DIR, 'dry-run-banner.png'),
    });
  });

  test('captures edit-controls screenshot', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });

    // Open status editor on the first row
    const firstRow = page.locator('table.items tbody tr').first();
    await firstRow.locator('td').nth(8).click();
    await expect(firstRow.locator('.cell-editor select')).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'edit-controls.png'),
      fullPage: false,
    });
  });
});
