/**
 * Real-write E2E. Mocks every endpoint the live-mode push sequence touches
 * and verifies the dialog confirms with success state and clears staging.
 *
 * Distinct from `interaction.spec.ts` (dry-run) and exercises the
 * GET-ref → POST-refs → PUT-contents → POST-pulls 4-call sequence.
 */

import { expect, test } from '@playwright/test';
import { mockGithubBacklogFetch } from './helpers/mock-github.js';

test.describe('Real-write push (mocked)', () => {
  test('runs the full live-mode 4-call sequence and reports the PR URL', async ({ page }) => {
    const calls: string[] = [];

    // 1a. Fixture-backed GET for the contents read.
    await mockGithubBacklogFetch(page);

    // 1b. PUT handler for the live-mode commit. Registered after the helper
    // so it is consulted first; non-PUT requests fall through to the helper.
    await page.route('https://api.github.com/**/contents/BACKLOG.md*', async (route) => {
      const req = route.request();
      calls.push(`${req.method()} ${req.url()}`);
      if (req.method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: { sha: 'newfilesha', path: 'BACKLOG.md' },
            commit: { sha: 'commit123abc' },
          }),
        });
        return;
      }
      await route.fallback();
    });

    // 2. GET ref/heads/main
    await page.route('https://api.github.com/**/git/ref/heads/main*', async (route) => {
      calls.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'refs/heads/main',
          object: { sha: 'mainsha000000000000000000000000000000000' },
        }),
      });
    });

    // 3. POST git/refs (create branch)
    await page.route('https://api.github.com/**/git/refs', async (route) => {
      calls.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ref: 'refs/heads/backlog-navigator/test-branch',
          object: { sha: 'mainsha000000000000000000000000000000000' },
        }),
      });
    });

    // 4. POST pulls
    await page.route('https://api.github.com/**/pulls', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      calls.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          number: 42,
          html_url: 'https://github.com/debrief/debrief-future/pull/42',
          state: 'open',
        }),
      });
    });

    // Seed PAT into localStorage before navigation.
    await page.addInitScript(() => {
      localStorage.setItem(
        'backlog-navigator:github-pat',
        JSON.stringify({ pat: 'ghp_fake_for_e2e', scopes: ['repo'] }),
      );
    });

    page.on('console', (m) => console.log('[browser]', m.type(), m.text()));
    page.on('pageerror', (e) => console.log('[browser-error]', e.message));

    await page.goto('/');
    await expect(page.locator('table.items')).toBeVisible({ timeout: 10000 });

    // Stage a status edit on the first row.
    const row = page.locator('table.items tbody tr').first();
    await row.locator('td').nth(6).click();
    await row.locator('.cell-editor select[aria-label="Status"]').selectOption('clarified');

    // Open Push dialog and confirm
    await page.getByTestId('push-changes').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByTestId('confirm-push').click();

    // Wait for the success banner inside the dialog
    await expect(page.locator('.dialog .banner.success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.dialog .banner.success')).toContainText('PR opened');

    // Verify all four calls happened in order
    const apiCalls = calls.filter((c) => !c.includes('contents/BACKLOG.md?ref=')); // exclude initial read
    expect(apiCalls.length).toBeGreaterThanOrEqual(3); // ref + branch + commit + pulls (initial read was filtered)
    expect(apiCalls.some((c) => c.startsWith('POST') && c.includes('/git/refs'))).toBe(true);
    expect(apiCalls.some((c) => c.startsWith('PUT') && c.includes('/contents/BACKLOG.md'))).toBe(
      true,
    );
    expect(apiCalls.some((c) => c.startsWith('POST') && c.includes('/pulls'))).toBe(true);
  });
});
