// Test-hook gating: window.__gameTest must exist ONLY for the exact query
// value ?test=1. Any other `test` parameter (bare ?test, ?test=0, ?test=true,
// a look-alike key) must leave the hook, and for Idle Hoops the fast test
// clock, switched off.

import { test, expect } from '@playwright/test';

const GAMES = [
  'running-man',
  'neon-tower-defense',
  'block-fps',
  'maze-runner',
  'neon-blocks',
  'idle-hoops-rpg',
];

const NOT_ENABLED = ['', '?test', '?test=', '?test=0', '?test=true', '?test=yes', '?test=1x', '?testing=1', '?x=test'];

for (const slug of GAMES) {
  test.describe(`${slug}: __gameTest gating`, () => {
    test('?test=1 exposes the hook', async ({ page }) => {
      await page.goto(`/games/${slug}/index.html?test=1`);
      await page.waitForFunction(() => Boolean((window as any).__gameTest));
    });

    test('any other test parameter does not', async ({ page }) => {
      for (const qs of NOT_ENABLED) {
        await page.goto(`/games/${slug}/index.html${qs}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(250);
        const present = await page.evaluate(() => typeof (window as any).__gameTest !== 'undefined');
        expect(present, `${slug}${qs || ' (no query)'}`).toBe(false);
      }
    });
  });
}

test('idle-hoops-rpg: ?test=true does not speed up the tick clock', async ({ page }) => {
  // Seed a save with an old lastTickAt via ?test=1, then reload WITHOUT strict test mode.
  await page.goto('/games/idle-hoops-rpg/index.html?test=1');
  await page.waitForFunction(() => Boolean((window as any).__gameTest));
  const seed = await page.evaluate(() => (window as any).__gameTest.getSeed());
  // Reload with a lax value: normal 30s clock, so ~600ms must not advance the season.
  await page.goto('/games/idle-hoops-rpg/index.html?test=true');
  await page.waitForLoadState('networkidle');
  const key = 'idle-hoops-rpg:save:v1';
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.waitForTimeout(600); // test mode would have ticked ~6 times by now
  const after = await page.evaluate((k) => localStorage.getItem(k), key);
  expect(after).toBe(before);
  expect(typeof seed).toBe('string');
});