import { test, expect } from '@playwright/test';

/**
 * E2E flow: public transparency portal (no auth required).
 */
test.describe('Transparency portal', () => {
  test('loads public portal stats without signing in', async ({ page }) => {
    await page.goto('/portal');
    await expect(page.getByTestId('portal-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /city transparency portal|πύλη διαφάνειας/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in|σύνδεση/i })).toBeVisible();
    await expect(page.getByText(/total issues|συνολικά θέματα/i)).toBeVisible();
  });
});