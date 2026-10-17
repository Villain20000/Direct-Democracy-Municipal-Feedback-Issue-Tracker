import { test, expect } from '@playwright/test';

/**
 * P2-19 (media) + P2-20 (auditor) dashboard parity, plus the P0-3
 * saved-search UI flow.
 *
 * Prerequisites: backend + frontend up, `npm run db:seed` executed (seed
 * logins `press@herald.com`, `auditor@city.gov`, `citizen1@email.com` /
 * `password123`; override via E2E_* env vars when the seed differs).
 */

const MEDIA_EMAIL = process.env['E2E_MEDIA_EMAIL'] || 'press@herald.com';
const AUDITOR_EMAIL = process.env['E2E_AUDITOR_EMAIL'] || 'auditor@city.gov';
const CITIZEN_EMAIL = process.env['E2E_CITIZEN_EMAIL'] || 'citizen1@email.com';
const PASSWORD = process.env['E2E_PASSWORD'] || 'password123';

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
}

test.describe('Media press center (P2-19)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, MEDIA_EMAIL, PASSWORD);
  });

  test('minutes archive + API/RSS card render on /media', async ({ page }) => {
    await page.goto('/media');
    await expect(page.getByTestId('media-minutes-archive')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('media-api-rss')).toBeVisible();
    await expect(page.getByTestId('media-api-rss')).toContainText(/portal\/meetings/i);
  });

  test('historical comparison chart card renders on /media', async ({ page }) => {
    await page.goto('/media');
    await expect(page.getByTestId('media-historical-comparison')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Auditor oversight (P2-20)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, AUDITOR_EMAIL, PASSWORD);
  });

  test('ER graph + budget trail + timeline render on /auditor', async ({ page }) => {
    await page.goto('/auditor');
    await expect(page.getByTestId('auditor-er-graph')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('auditor-budget-trail')).toBeVisible();
    await expect(page.getByTestId('auditor-resolution-timeline')).toBeVisible();
  });
});

test.describe('Saved searches (P0-3 frontend)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, CITIZEN_EMAIL, PASSWORD);
  });

  test('citizen can save the current filter combo and see the chip', async ({ page }) => {
    await page.goto('/issues');
    const row = page.getByTestId('saved-searches-row');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /save search|💾/i }).first().click();
    const name = `e2e-${Date.now()}`;
    await page.getByTestId('save-search-name').fill(name);
    await page.getByTestId('save-search-confirm').click();
    await expect(row.getByText(name)).toBeVisible({ timeout: 10_000 });
  });
});
