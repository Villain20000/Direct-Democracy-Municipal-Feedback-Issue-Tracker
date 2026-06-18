import { test, expect } from '@playwright/test';

/**
 * E2E flow: citizen subscribes to an issue for status updates.
 */
test.describe('Issue subscribe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('citizen1@email.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
  });

  test('citizen can subscribe and unsubscribe from an issue', async ({ page }) => {
    await page.goto('/issues');
    await page.locator('a[href^="/issues/"]').first().click();
    await page.waitForURL(/\/issues\/[a-f0-9-]+/, { timeout: 10_000 });

    const subscribeBtn = page.getByTestId('issue-subscribe-btn');
    await expect(subscribeBtn).toBeVisible();

    await subscribeBtn.click();
    await expect(subscribeBtn).toContainText(/unfollow|διακοπή/i, { timeout: 5_000 });

    await subscribeBtn.click();
    await expect(subscribeBtn).toContainText(/follow|παρακολούθηση/i, { timeout: 5_000 });
  });
});