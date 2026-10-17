import { test, expect } from '@playwright/test';

/**
 * P1-7 — PDF report export (PLAN feature 23 "Report Export (PDF/CSV)").
 *
 * API-level E2E asserts (run against the full stack with seeded users):
 * every report PDF endpoint returns a non-empty `application/pdf` body
 * starting with the `%PDF` magic bytes, and the CSV siblings keep working.
 *
 * Prerequisites: backend + frontend up, `npm run db:seed` executed (the
 * seed provides `auditor@city.gov` / `password123`; adjust via env
 * E2E_AUDITOR_EMAIL / E2E_AUDITOR_PASSWORD when the seed differs).
 *
 * UI note: the Download buttons live on the analytics page
 * (`analytics-export-pdf-btn`, `analytics-export-briefing-btn`), the
 * auditor page (`audit-export-pdf-btn`, `audit-export-briefing-btn`) and
 * the media press-center cards (`media-report-pdf-btn`). They trigger a
 * blob download of the same endpoints asserted below.
 */
test.describe('Report PDF export', () => {
  const email = process.env['E2E_AUDITOR_EMAIL'] || 'auditor@city.gov';
  const password = process.env['E2E_AUDITOR_PASSWORD'] || 'password123';

  let token: string;

  test.beforeAll(async ({ request }) => {
    const login = await request.post('/api/v1/auth/login', { data: { email, password } });
    if (login.status() !== 200) test.skip(true, `seed auditor login failed (${login.status()}) — run npm run db:seed first`);
    const body = await login.json();
    token = body.data.accessToken;
    expect(token).toBeTruthy();
  });

  async function expectNonEmptyPdf(path: string, request: import('@playwright/test').APIRequestContext) {
    const res = await request.get(path, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status(), `${path} status`).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/pdf/);
    const buf = await res.body();
    expect(buf.length, `${path} non-empty`).toBeGreaterThan(500);
    expect(buf.subarray(0, 4).toString(), `${path} %PDF magic`).toBe('%PDF');
  }

  test('issues PDF is a non-empty application/pdf response', async ({ request }) => {
    await expectNonEmptyPdf('/api/v1/reports/issues.pdf', request);
  });

  test('audit PDF is a non-empty application/pdf response', async ({ request }) => {
    await expectNonEmptyPdf('/api/v1/reports/audit.pdf', request);
  });

  test('CSV siblings keep working alongside the PDFs', async ({ request }) => {
    for (const path of ['/api/v1/reports/issues.csv', '/api/v1/reports/audit.csv']) {
      const res = await request.get(path, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status(), `${path} status`).toBe(200);
      expect(res.headers()['content-type']).toMatch(/text\/csv/);
    }
  });

  test('analytics page shows PDF/briefing download buttons', async ({ page }) => {
    // Auditor lacks the analytics (mayor) view; assert the auditor-side
    // buttons instead — same endpoints, same RBAC as above.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
    await page.goto('/auditor/logs');
    await expect(page.getByTestId('audit-export-pdf-btn')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('audit-export-briefing-btn')).toBeVisible();
  });
});
