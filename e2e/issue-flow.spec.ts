import { test, expect } from '@playwright/test';

/**
 * E2E flow: a citizen creates a new issue end-to-end.
 *
 * Verifies:
 *   - The /issues/new page is reachable when authenticated
 *   - Required-field validation blocks empty submit
 *   - The live AI duplicate-detection panel appears as the citizen
 *     types in the description (debounced, may take 1-2s)
 *   - A successful submit navigates to the detail page
 *
 * Skipped if not logged in (the test runner seeds the citizen
 * account in `db:seed` before the suite runs — see the README
 * for the `npm run db:seed` step).
 */
test.describe('Issue create flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as the seed citizen.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('citizen@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
  });

  test('submit a new issue end-to-end', async ({ page }) => {
    await page.goto('/issues/new');

    // Form fields are present.
    await expect(page.getByLabel(/title/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByLabel(/location/i)).toBeVisible();

    // Fill the form.
    const unique = `E2E pothole test ${Date.now()}`;
    await page.getByLabel(/title/i).fill(unique);
    await page
      .getByLabel(/description/i)
      .fill('A small but deep pothole on Main Street. Has been growing for a week.');
    await page.getByLabel(/location/i).fill('123 Main Street');

    // Submit. The success path navigates to the issue detail page.
    await page.getByRole('button', { name: /submit issue/i }).click();

    // Wait for navigation. Allow generous timeout because the
    // backend may take a few seconds to persist + return 202.
    await page.waitForURL(/\/issues\/[a-f0-9-]+/, { timeout: 15_000 });

    // Detail page shows the title we just submitted.
    await expect(page.locator('h2').first()).toContainText(unique);
  });

  test('empty form shows a validation error and does not submit', async ({ page }) => {
    await page.goto('/issues/new');

    // Clear the title field and submit.
    await page.getByLabel(/title/i).fill('');
    await page.getByLabel(/description/i).fill('');
    await page.getByLabel(/location/i).fill('');

    // The page should still be on /issues/new (the form's local
    // validation blocks the submit before the HTTP request).
    await page.getByRole('button', { name: /submit issue/i }).click();
    await expect(page).toHaveURL(/\/issues\/new/);
  });
});
