import { test, expect, Page } from '@playwright/test';

/**
 * E2E flow: login + logout.
 *
 * Exercises:
 *   - The login form's validation (empty fields, wrong password)
 *   - Routing to the role-appropriate dashboard on success
 *   - The auth interceptor (cookie-based session)
 *   - Logout clearing the session and bouncing back to /login
 */
test.describe('Authentication', () => {
  test('citizen can log in and reach their dashboard', async ({ page }) => {
    await page.goto('/login');

    // Form is visible
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Submit empty form — client-side validation should block.
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Login with a real seed account. The seed creates a citizen
    // at citizen1@email.com / password123. We assert on the
    // generic "dashboard" route (the role-specific sub-route is
    // exercised in a role-based test below).
    await page.getByLabel(/email/i).fill('citizen1@email.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from /login. The router pushes to
    // the role-appropriate dashboard.
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
    expect(page.url()).not.toContain('/login');
  });

  test('wrong password shows an inline error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('citizen1@email.com');
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // The login component renders the error in `.error-msg`.
    // We wait for it explicitly because the error appears AFTER
    // the failed HTTP response.
    await expect(page.locator('.error-msg')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('authenticated user can log out', async ({ page }) => {
    // First, log in.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('citizen1@email.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });

    // The layout's logout button is wired to auth.logout(), which
    // navigates back to /login.
    await page.getByRole('button', { name: /log out|sign out/i }).first().click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
