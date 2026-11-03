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

test.describe('landing page game cards', () => {
  const SLUGS = [
    'running-man',
    'neon-tower-defense',
    'block-fps',
    'maze-runner',
    'neon-blocks',
    'idle-hoops-rpg',
  ];

  test('every game card has a thumbnail with alt text that loads', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('li[data-slug]');
    await expect(cards).toHaveCount(SLUGS.length);

    for (const slug of SLUGS) {
      const img = page.locator(`li[data-slug="${slug}"] img`);
      await img.scrollIntoViewIfNeeded(); // lazy-loaded below the fold
      const alt = await img.getAttribute('alt');
      expect(alt, `${slug} alt`).toBeTruthy();
      expect(alt!.length, `${slug} alt length`).toBeLessThanOrEqual(125);
      await expect(img).toHaveAttribute('width', '960');
      await expect(img).toHaveAttribute('height', '540');
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), {
          message: `${slug} thumbnail should load`,
        })
        .toBeGreaterThan(0);
    }
  });

  test('Neon Tower Defense is the featured hero card, first and full width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const first = page.locator('li[data-slug]').first();
    await expect(first).toHaveAttribute('data-slug', 'neon-tower-defense');
    await expect(first).toContainText('Featured');

    const grid = await page.locator('ul:has(> li[data-slug])').boundingBox();
    const box = await first.boundingBox();
    expect(box!.width).toBeGreaterThan(grid!.width * 0.95);

    // Wide crop is picked on desktop widths.
    const src = await first.locator('img').evaluate((el: HTMLImageElement) => el.currentSrc);
    expect(src).toContain('/games/neon-tower-defense/thumb-wide');
  });

  test('thumbnails reserve their space (no layout shift) before loading', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.route('**/*.webp', (route) => route.abort());
    await page.goto('/');
    const frame = page.locator('li[data-slug="running-man"] img').locator('xpath=ancestor::div[1]');
    const box = await frame.boundingBox();
    expect(box!.height).toBeGreaterThan(150);
    expect(Math.abs(box!.width / box!.height - 16 / 9)).toBeLessThan(0.02);
  });

  test('card has no horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
