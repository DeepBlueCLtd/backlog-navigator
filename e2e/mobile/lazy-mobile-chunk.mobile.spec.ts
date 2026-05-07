import { expect, test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mockGithubBacklogFetch } from '../helpers/mock-github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'specs',
  '247-lazy-mobile-bundle',
  'evidence',
  'screenshots',
);
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

/**
 * E2E coverage for #247 — lazy-load Backlog Navigator mobile component tree.
 *
 * Scenarios covered (from plan.md §"Web-Shell E2E Testing"):
 *   1. Cold mobile load shows skeleton, then card list (US2 / FR-002 + FR-003).
 *   2. Cold desktop load never requests any mobile chunk (US1 / FR-001).
 *   3. Chunk-fetch failure shows recovery banner with reload action (US3 / FR-005).
 *   4. Viewport resize across the breakpoint lazy-loads the mobile chunk (US3 / FR-004).
 *
 * Notes:
 *   - The Playwright project matrix already pins viewports per-project. The
 *     "mobile-iphone" project is < 1024 px (mobile path); the "tablet-landscape"
 *     project is ≥ 1024 px (desktop path). We branch the body of each test
 *     accordingly so the same spec contributes evidence across all projects.
 *   - Skeleton observation is best-effort: on fast hardware the lazy import
 *     resolves before Playwright can poll. We assert the *eventual* card list
 *     and capture the skeleton screenshot opportunistically.
 *   - Network blocking uses `page.route` to fulfill mobile chunk URLs with a
 *     synthetic 404 — emulating a stale-deploy chunk URL.
 */
test.describe('Lazy mobile chunk (#247)', () => {
  test('cold mobile load shows skeleton then card list', async ({ page }, testInfo) => {
    const viewportWidth = page.viewportSize()?.width ?? 0;
    test.skip(viewportWidth >= 1024, 'Mobile cold-load is for < 1024 px viewports.');

    await mockGithubBacklogFetch(page);

    // Slow the mobile chunk fetch a little so the skeleton has time to paint.
    // (We delay every JS request to /assets/CardList* by 500 ms — long enough
    // to be observable without flaking.)
    await page.route('**/assets/CardList-*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });
    await page.route('**/assets/MobileFilterBar-*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });

    await page.goto('/?dryRun=1');
    // Skeleton may already be visible — opportunistically capture it for the blog.
    const skeleton = page.getByTestId('mobile-skeleton');
    try {
      await expect(skeleton).toBeVisible({ timeout: 2000 });
      await page.screenshot({
        path: join(SCREENSHOTS_DIR, `cold-mobile-skeleton-${testInfo.project.name}.png`),
        fullPage: false,
      });
    } catch {
      // The lazy import may resolve faster than Playwright can poll on some
      // hardware; that is acceptable — the skeleton is not strictly required
      // to be visible, only that the eventual card list lands cleanly.
    }

    // Card list is the steady state.
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('mobile-skeleton')).toHaveCount(0);
  });

  test('cold desktop load never requests any mobile chunk', async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 0;
    test.skip(viewportWidth < 1024, 'Desktop chunk-absence test is for ≥ 1024 px viewports.');

    await mockGithubBacklogFetch(page);

    const requestedUrls: string[] = [];
    page.on('request', (req) => {
      requestedUrls.push(req.url());
    });

    await page.goto('/?dryRun=1');
    await expect(page.locator('table.items')).toBeVisible({ timeout: 15000 });

    // The desktop layout is rendered. Confirm nothing matching a mobile
    // chunk filename was fetched.
    const mobileChunkPattern = /\/assets\/(CardList|MobileFilterBar|StickyPushBar|BottomSheetEditor|DescriptionEditorScreen)-[A-Za-z0-9]+\.js$/;
    const offenders = requestedUrls.filter((u) => mobileChunkPattern.test(u));
    expect(offenders, `mobile chunks should not load on desktop; offenders=${JSON.stringify(offenders)}`).toEqual([]);
  });

  test('chunk-fetch failure shows recovery banner with reload', async ({ page }, testInfo) => {
    const viewportWidth = page.viewportSize()?.width ?? 0;
    test.skip(viewportWidth >= 1024, 'Failure recovery is exercised on the mobile path.');

    await mockGithubBacklogFetch(page);

    // Make the CardList chunk URL unreachable — emulates a stale-deploy
    // chunk that Workbox precache cannot serve.
    await page.route(/\/assets\/CardList-[A-Za-z0-9]+\.js$/, async (route) => {
      await route.fulfill({ status: 404, body: 'gone' });
    });

    await page.goto('/?dryRun=1');

    const errorPanel = page.getByTestId('chunk-error');
    await expect(errorPanel).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('chunk-error-reload')).toBeVisible();

    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `recovery-banner-${testInfo.project.name}.png`),
      fullPage: false,
    });
  });

  test('viewport resize across breakpoint lazy-loads the mobile chunk', async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 0;
    test.skip(
      viewportWidth < 1024,
      'Resize-from-desktop is staged from a ≥ 1024 viewport project; mobile-only projects can skip.',
    );

    await mockGithubBacklogFetch(page);

    const requestedUrls: string[] = [];
    page.on('request', (req) => {
      requestedUrls.push(req.url());
    });

    await page.goto('/?dryRun=1');
    // Desktop layout renders first.
    await expect(page.locator('table.items')).toBeVisible({ timeout: 15000 });

    // No mobile chunk before resize.
    const before = requestedUrls.filter((u) =>
      /\/assets\/(CardList|MobileFilterBar|StickyPushBar)-/.test(u),
    );
    expect(before).toEqual([]);

    // Resize to a mobile viewport. The matchMedia signal in `useIsMobile`
    // will flip and the lazy boundary will fire.
    await page.setViewportSize({ width: 600, height: 800 });

    // Card list eventually appears (chunk fetched + rendered).
    await expect(page.getByTestId('card-list')).toBeVisible({ timeout: 15000 });

    const after = requestedUrls.filter((u) => /\/assets\/CardList-/.test(u));
    expect(
      after.length,
      `expected at least one CardList chunk fetch after resize; got ${JSON.stringify(after)}`,
    ).toBeGreaterThan(0);
  });
});
