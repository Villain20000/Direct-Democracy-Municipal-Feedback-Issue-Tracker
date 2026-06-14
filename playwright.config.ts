import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the Direct Democracy project.
 *
 * Runs against the dev stack (`npm run dev` at the repo root),
 * which boots:
 *   - Angular dev server on http://localhost:4200
 *   - Express backend on http://localhost:3001
 *   - Postgres + Redis (from docker-compose)
 *
 * In CI we use the same `webServer` block — Playwright boots
 * the stack, waits for both ports to be ready, runs the suite,
 * and tears everything down on exit. For local dev you can
 * pre-start the stack and skip the boot by setting
 * `PLAYWRIGHT_SKIP_WEBSERVER=1`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env['PLAYWRIGHT_SKIP_WEBSERVER']
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:4200',
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
