import { test, expect } from '@playwright/test';

/**
 * E2E flow: ward rep opens the issues map.
 */
test.describe('Issues map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('wardrep1@city.gov');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
  });

  test('ward rep can open the issues map page', async ({ page }) => {
    await page.goto('/ward/map');
    await expect(page.locator('.page-title')).toContainText(/issues map|χάρτης θεμάτων/i, { timeout: 10_000 });
    await expect(page.locator('#issues-map')).toBeVisible();
  });
});