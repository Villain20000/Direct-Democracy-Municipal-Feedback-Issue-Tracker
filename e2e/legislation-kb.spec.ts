import { test, expect } from '@playwright/test';

/**
 * E2E flow: mayor opens the legislation knowledge base.
 */
test.describe('Legislation knowledge base', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('mayor@city.gov');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
  });

  test('mayor can open the documents knowledge base', async ({ page }) => {
    await page.goto('/admin/documents');
    await expect(page.locator('.page-title')).toContainText(/legislation knowledge base|βάση γνώσης νομοθεσίας/i, { timeout: 10_000 });
    await expect(page.getByText(/documents|έγγραφα/i).first()).toBeVisible();
  });
});