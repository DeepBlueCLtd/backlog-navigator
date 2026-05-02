/**
 * Run Playwright E2E tests with @sparticuz/chromium in CI / Claude Code.
 * Mirrors apps/spec-navigator/run-playwright.mjs.
 */
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const CHROMIUM_PATH_FILE = join(process.cwd(), '.chromium-path');

async function main() {
  console.log('Extracting chromium from @sparticuz/chromium...');
  const chromium = (await import('@sparticuz/chromium')).default;
  const executablePath = await chromium.executablePath();
  console.log(`Chromium extracted to: ${executablePath}`);

  if (!existsSync(dirname(CHROMIUM_PATH_FILE))) {
    mkdirSync(dirname(CHROMIUM_PATH_FILE), { recursive: true });
  }
  writeFileSync(CHROMIUM_PATH_FILE, executablePath, 'utf8');

  console.log('Running Playwright tests...');
  const args = process.argv.slice(2).join(' ');
  const command = `CHROMIUM_PATH="${executablePath}" pnpm exec playwright test ${args}`;

  try {
    execSync(command, { stdio: 'inherit', shell: true, cwd: process.cwd() });
  } catch (error) {
    process.exitCode = error.status || 1;
  } finally {
    try {
      unlinkSync(CHROMIUM_PATH_FILE);
    } catch {
      // ignore
    }
  }
}

main().catch(console.error);
