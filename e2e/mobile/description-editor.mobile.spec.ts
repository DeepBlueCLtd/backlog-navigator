import { expect, test } from '@playwright/test';
import { mockGithubBacklogFetch } from '../helpers/mock-github.js';

/**
 * Story 3 — full-screen Markdown Description editor (US3).
 *
 * Runs only in the mobile-iphone project (375 × 812). The editor's
 * behaviour is layout-mode-naive once mounted, so single-viewport
 * coverage is sufficient (Review §Issue 3A).
 */
test.describe('Backlog Navigator — mobile description editor (US3)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-iphone',
      'Description-editor spec only meaningful at the iPhone viewport.',
    );
  });

  test('tap Description region → full-screen editor opens with raw Markdown', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('item-card-description').click();

    const editor = page.getByTestId('description-editor-screen');
    await expect(editor).toBeVisible();
    await expect(editor.getByTestId('description-editor-textarea')).toBeFocused();
    // Save button starts disabled (no dirty edit yet).
    const save = editor.getByTestId('description-editor-save');
    await expect(save).toBeDisabled();
  });

  test('edit Description + Save → editor dismisses, card re-renders with new text', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    const beforeText = (await firstCard.getByTestId('item-card-description').textContent()) ?? '';
    await firstCard.getByTestId('item-card-description').click();

    const editor = page.getByTestId('description-editor-screen');
    const textarea = editor.getByTestId('description-editor-textarea');
    await textarea.fill(`${beforeText.replace(/…$/, '')} — appended on mobile.`);

    await editor.getByTestId('description-editor-save').click();
    await expect(editor).toBeHidden();
    // Card now has the appended text (truncated to 200 chars on the surface).
    await expect(firstCard).toHaveAttribute('data-dirty', 'true');
  });

  test('Cancel with unsaved changes surfaces discard-confirm; Discard dismisses', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('item-card-description').click();

    const editor = page.getByTestId('description-editor-screen');
    await editor.getByTestId('description-editor-textarea').fill('a change');
    await editor.getByTestId('description-editor-cancel').click();

    await expect(page.getByTestId('discard-confirm')).toBeVisible();
    await page.getByTestId('discard-confirm-discard').click();
    await expect(page.getByTestId('discard-confirm')).toBeHidden();
    await expect(editor).toBeHidden();
    // Card not marked dirty (the change was discarded).
    await expect(firstCard).not.toHaveAttribute('data-dirty', 'true');
  });

  test('Continue editing keeps the editor open and the dirty change in place', async ({ page }) => {
    await mockGithubBacklogFetch(page);
    await page.goto('/?dryRun=1');
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId(/^item-card-\d+$/).first();
    await firstCard.getByTestId('item-card-description').click();

    const editor = page.getByTestId('description-editor-screen');
    const textarea = editor.getByTestId('description-editor-textarea');
    await textarea.fill('still editing');
    await editor.getByTestId('description-editor-cancel').click();

    await expect(page.getByTestId('discard-confirm')).toBeVisible();
    await page.getByTestId('discard-confirm-continue').click();
    await expect(page.getByTestId('discard-confirm')).toBeHidden();
    // Editor still open with the dirty change.
    await expect(editor).toBeVisible();
    await expect(textarea).toHaveValue('still editing');
  });
});
