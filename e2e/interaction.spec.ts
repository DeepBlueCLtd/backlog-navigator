/**
 * Records the dry-run push flow as a webm video. The CI artefact is copied
 * into specs/242-backlog-navigator/evidence/screenshots/interaction.webm
 * for the feature post.
 */

import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mockGithubBacklogFetch } from './helpers/mock-github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EVIDENCE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'specs',
  '242-backlog-navigator',
  'evidence',
  'screenshots',
);

test.use({
  video: { mode: 'on', size: { width: 1280, height: 720 } },
});

test('records dry-run push flow', async ({ page }) => {
  await mockGithubBacklogFetch(page);

  await page.goto('/?dryRun=1');
  await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });

  // Stage 3 status edits. Fixture rows 001/002/003 are
  // `proposed`/`approved`/`clarified` respectively, so flipping them all to
  // `tasked` is a guaranteed change for every row (no no-op) — the dry-run
  // diff will show three real edits.
  for (let i = 0; i < 3; i++) {
    const row = page.locator('table.items tbody tr').nth(i);
    await row.locator('td').nth(6).click();
    await page.waitForTimeout(250);
    const dropdown = row.locator('.cell-editor select[aria-label="Status"]');
    await dropdown.selectOption('tasked');
    await page.waitForTimeout(250);
  }

  await page.waitForTimeout(400);
  await page.getByTestId('push-changes').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(700);

  await page.getByTestId('toggle-diff').click();
  await expect(page.getByTestId('diff-output')).toBeVisible();
  await page.waitForTimeout(700);

  await page.getByTestId('confirm-push').click();
  await page.waitForTimeout(1200);

  const video = page.video();
  // Must close the page (and ideally the context) BEFORE the video file is
  // flushed and finalised. Capture the path post-close so the file is sized.
  await page.close();
  if (video) {
    const tmpPath = await video.path();
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    copyFileSync(tmpPath, join(EVIDENCE_DIR, 'interaction.webm'));
  }
});
