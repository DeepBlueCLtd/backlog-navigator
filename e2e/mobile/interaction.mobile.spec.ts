import { expect, test, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKLOG_PATH = join(__dirname, '..', '..', '..', '..', 'BACKLOG.md');
const SCREENSHOTS_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'specs',
  '244-navigator-mobile-pwa',
  'evidence',
  'screenshots',
);
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

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
 * Story 2 — Edit a row from a phone or tablet (US2).
 *
 * Runs at all three target viewports. Tablet-landscape (1024×768)
 * renders the desktop layout — those assertions are skipped to keep
 * the spec single-purpose; the desktop interaction spec (#242
 * `interaction.spec.ts`) covers the corresponding ≥1024 px path.
 */
test.describe('Backlog Navigator — mobile interaction (US2)', () => {
  test('tap status chip → bottom sheet opens with current status', async ({ page }, testInfo) => {
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      test.skip(true, 'Bottom sheet is mobile-only.');
      return;
    }
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    // Click the status chip on the first card.
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('status-chip').click();

    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();
    // The sheet header reads "Status — #NNN".
    await expect(sheet.getByText(/^Status — #\d+/)).toBeVisible();

    // Capture screenshot for evidence (project tag in name).
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `bottomsheet-status-edit-${testInfo.project.name}.png`),
    });
  });

  test('change status + Save → card reflects new value, dirty marker appears', async ({ page }) => {
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      test.skip(true, 'Bottom sheet is mobile-only.');
      return;
    }
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const beforeStatus = (await firstCard.getByTestId('status-chip').textContent()) ?? '';
    await firstCard.getByTestId('status-chip').click();

    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();

    // Pick a new status from the embedded StatusDropdown <select>. The
    // value is constrained to EDITABLE_STATUS_VALUES; pick one that is
    // very unlikely to match the current status.
    const select = sheet.locator('select[aria-label="Status"]');
    const newStatus = beforeStatus.toLowerCase().includes('approved') ? 'specified' : 'approved';
    await select.selectOption(newStatus);

    // Save the edit.
    await sheet.getByTestId('bottom-sheet-save').click();
    await expect(sheet).toBeHidden();

    // Card now shows the new status + dirty marker.
    await expect(firstCard).toHaveAttribute('data-dirty', 'true');
    const afterStatus = (await firstCard.getByTestId('status-chip').textContent()) ?? '';
    expect(afterStatus.toLowerCase()).toContain(newStatus);
  });

  test('drag-down (simulated) on a clean sheet dismisses without commit', async ({ page }) => {
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      test.skip(true, 'Bottom sheet is mobile-only.');
      return;
    }
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();

    // Cancel button — easier to drive than a synthetic pointer drag in
    // headless. The drag path is unit-tested in BottomSheet.test.tsx.
    await sheet.getByTestId('bottom-sheet-cancel').click();
    await expect(sheet).toBeHidden();
    // Card is NOT marked dirty.
    await expect(firstCard).not.toHaveAttribute('data-dirty', 'true');
  });

  test('cancel after dirty edit surfaces discard-confirm dialog', async ({ page }) => {
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      test.skip(true, 'Bottom sheet is mobile-only.');
      return;
    }
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const beforeStatus = (await firstCard.getByTestId('status-chip').textContent()) ?? '';
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();

    const select = sheet.locator('select[aria-label="Status"]');
    const newStatus = beforeStatus.toLowerCase().includes('approved') ? 'specified' : 'approved';
    await select.selectOption(newStatus);

    // Cancel — the dialog should appear because the value changed.
    await sheet.getByTestId('bottom-sheet-cancel').click();
    await expect(page.getByTestId('discard-confirm')).toBeVisible();

    // Discard the changes.
    await page.getByTestId('discard-confirm-discard').click();
    await expect(page.getByTestId('discard-confirm')).toBeHidden();
    await expect(sheet).toBeHidden();
    await expect(firstCard).not.toHaveAttribute('data-dirty', 'true');
  });
});
