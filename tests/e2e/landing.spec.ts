import { test, expect } from '@playwright/test';

test.describe('landing page', () => {
  test('responds with a successful status', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
  });

  test('renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
