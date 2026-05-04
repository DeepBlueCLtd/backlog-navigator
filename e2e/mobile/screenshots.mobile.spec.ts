import { test, type Page } from '@playwright/test';
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
 * Polish-phase capture for the named evidence artefacts in tasks.md
 * (T072-T078). One scenario per screenshot. Runs at the iPhone viewport
 * unless the artefact is explicitly cross-viewport.
 */
test.describe('Backlog Navigator — evidence screenshots', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-iphone',
      'Polish screenshots run at the iPhone viewport.',
    );
  });

  test('cardlist-iphone-light.png', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await page.getByTestId('card-list').waitFor({ timeout: 10000 });
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'cardlist-iphone-light.png'),
    });
  });

  test('bottomsheet-status-edit.png', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await page.getByTestId('card-list').waitFor({ timeout: 10000 });
    await page.getByTestId(/^item-card-\d+$/).first().getByTestId('status-chip').click();
    await page.getByTestId('bottom-sheet').waitFor();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'bottomsheet-status-edit.png'),
    });
  });

  test('description-editor-fullscreen.png', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await page.getByTestId('card-list').waitFor({ timeout: 10000 });
    await page
      .getByTestId(/^item-card-\d+$/)
      .first()
      .getByTestId('item-card-description')
      .click();
    await page.getByTestId('description-editor-screen').waitFor();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'description-editor-fullscreen.png'),
    });
  });

  test('sticky-push-bar.png', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await page.getByTestId('card-list').waitFor({ timeout: 10000 });

    // Make a dirty edit so the sticky bar appears.
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const beforeStatus = (await firstCard.getByTestId('status-chip').textContent()) ?? '';
    await firstCard.getByTestId('status-chip').click();
    const sheet = page.getByTestId('bottom-sheet');
    await sheet.waitFor();
    const select = sheet.locator('select[aria-label="Status"]');
    const newStatus = beforeStatus.toLowerCase().includes('approved')
      ? 'specified'
      : 'approved';
    await select.selectOption(newStatus);
    await sheet.getByTestId('bottom-sheet-save').click();
    await sheet.waitFor({ state: 'hidden' });

    await page.getByTestId('sticky-push-bar').waitFor();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'sticky-push-bar.png'),
    });
  });

  test('offline-empty-state.png', async ({ page, context }) => {
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('localhost') || url.startsWith('blob:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.goto('/?dryRun=1');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    });
    await page.getByTestId('offline-empty-state').waitFor({ timeout: 10000 });
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'offline-empty-state.png'),
    });
  });

  test('discard-confirm-dialog.png', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await page.getByTestId('card-list').waitFor({ timeout: 10000 });
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('item-card-description').click();
    await page.getByTestId('description-editor-screen').waitFor();
    await page.getByTestId('description-editor-textarea').fill('a change');
    await page.getByTestId('description-editor-cancel').click();
    await page.getByTestId('discard-confirm').waitFor();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'discard-confirm-dialog.png'),
    });
  });

  test('copy-speckit-command-tooltip.png', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await page.getByTestId('card-list').waitFor({ timeout: 10000 });
    // Hover over the copy button on the first card so its title attribute
    // surfaces (the OS-level tooltip won't render in headless, but the
    // chip's "📋 Copy cmd" label is the actionable part).
    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const copyBtn = firstCard.getByTestId('copy-speckit-command');
    await copyBtn.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'copy-speckit-command.png'),
    });
  });
});
