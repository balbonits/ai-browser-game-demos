// Block Arena E2E tests.
//
// Tests navigate with ?test=1 so window.__gameTest is available.
// All state reads go through the test hook â€” never through canvas pixels.
// Always use waitForFunction instead of waitForTimeout for state changes.
//
// Pointer-lock and FPS mouse-look are NOT tested here. Playwright cannot
// simulate the user gesture required to acquire pointer lock in a real
// browser context without special flags. Tests are limited to:
//   - Intro state on load
//   - HP constant at PLAYER_HP (100) before the game starts
//   - Mute toggle persistence in localStorage
//   - Best wave / best score localStorage reads through the test hook
//
// Pointer-lock-dependent tests (pointer lock â†’ PLAYING transition, kill
// tracking, wave progression) are deferred. See docs/games/block-fps.md.

import { test, expect } from '@playwright/test';
import { waitForGameTest, readGameTest } from '../shared/test-hooks.js';

// The React shell intercepts directory URLs in dev mode.
// Use the explicit index.html path to serve the static game directly.
const GAME_URL = '/games/block-fps/index.html?test=1';
const PLAYER_HP = 100;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

test.describe('Block Arena â€” initial state', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any persisted state from previous runs.
    await page.goto(GAME_URL);
    await page.evaluate(() => {
      localStorage.removeItem('block-fps:muted');
      localStorage.removeItem('block-fps:best-wave');
      localStorage.removeItem('block-fps:best-score');
    });
    await page.reload();
    await waitForGameTest(page);
  });

  test('game starts in intro state', async ({ page }) => {
    const state = await readGameTest(page, 'getState');
    expect(state).toBe('intro');
  });

  test('HP is PLAYER_HP (100) on load', async ({ page }) => {
    const hp = await readGameTest(page, 'getHp');
    expect(hp).toBe(PLAYER_HP);
  });

  test('wave index is 0 on load', async ({ page }) => {
    const wave = await readGameTest(page, 'getWave');
    expect(wave).toBe(0);
  });

  test('score is 0 on load', async ({ page }) => {
    const score = await readGameTest(page, 'getScore');
    expect(score).toBe(0);
  });

  test('no enemies alive on load', async ({ page }) => {
    const enemies = await readGameTest(page, 'getEnemies');
    expect((enemies as unknown[]).length).toBe(0);
  });

  test('best wave reads 0 when no progress persisted', async ({ page }) => {
    const bestWave = await readGameTest(page, 'getBestWave');
    expect(bestWave).toBe(0);
  });

  test('best score reads 0 when no progress persisted', async ({ page }) => {
    const bestScore = await readGameTest(page, 'getBestScore');
    expect(bestScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Player state accessors
// ---------------------------------------------------------------------------

test.describe('Block Arena â€” player state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('getPlayer returns a position object with x, y, z', async ({ page }) => {
    const p = await readGameTest(page, 'getPlayer') as { pos: { x: number; y: number; z: number } };
    expect(typeof p.pos.x).toBe('number');
    expect(typeof p.pos.y).toBe('number');
    expect(typeof p.pos.z).toBe('number');
  });

  test('player starts at origin (xâ‰ˆ0, zâ‰ˆ0)', async ({ page }) => {
    const p = await readGameTest(page, 'getPlayer') as { pos: { x: number; z: number } };
    expect(Math.abs(p.pos.x)).toBeLessThan(0.01);
    expect(Math.abs(p.pos.z)).toBeLessThan(0.01);
  });

  test('player alive flag is true on load', async ({ page }) => {
    const p = await readGameTest(page, 'getPlayer') as { alive: boolean };
    expect(p.alive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mute persistence
// ---------------------------------------------------------------------------

test.describe('Block Arena â€” mute persistence', () => {
  test('pressing M sets block-fps:muted to "1" in localStorage', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('block-fps:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    // Navigate away and back so the page re-reads from localStorage.
    await page.goto(GAME_URL);
    const muted = await page.evaluate(() => localStorage.getItem('block-fps:muted'));
    expect(muted).toBe('1');
  });

  test('pressing M twice sets block-fps:muted to "0" in localStorage', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('block-fps:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    await page.keyboard.press('m');
    await page.goto(GAME_URL);
    const muted = await page.evaluate(() => localStorage.getItem('block-fps:muted'));
    expect(muted).toBe('0');
  });

  test('best-wave persists across reload when manually set', async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);

    // Manually write a best wave to localStorage (simulating a previous run).
    await page.evaluate(() => localStorage.setItem('block-fps:best-wave', '5'));
    await page.reload();
    await waitForGameTest(page);

    const bestWave = await readGameTest(page, 'getBestWave');
    expect(bestWave).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// HUD layout + wave label. The game is started with Space (no pointer lock
// needed: resetGame() flips to PLAYING and the lock request may be refused).
// ---------------------------------------------------------------------------

test.describe('Block Arena: HUD', () => {
  async function start(page: import('@playwright/test').Page) {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => (window as any).__gameTest.getState() === 'playing');
  }

  const rect = (page: import('@playwright/test').Page, sel: string) =>
    page.locator(sel).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });

  for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    test(`stat rows do not overlap each other or the HP group at ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await start(page);
      const wave = await rect(page, '#stat-wave');
      const score = await rect(page, '#stat-score');
      const kills = await rect(page, '#stat-kills');
      // Stacked rows: each starts at or below the previous one's bottom.
      expect(wave.bottom).toBeLessThanOrEqual(score.top + 0.5);
      expect(score.bottom).toBeLessThanOrEqual(kills.top + 0.5);
      // Each row has real height (regression: line-height 0 collapsed them).
      expect(wave.bottom - wave.top).toBeGreaterThan(14);
      // HP group sits left of the stat stack.
      const hp = await rect(page, '.hud-top-left');
      const stack = Math.min(wave.left, score.left, kills.left);
      expect(hp.right).toBeLessThanOrEqual(stack);
      // Sound button does not sit on the stat stack.
      const snd = await rect(page, '#sound-toggle');
      expect(snd.left).toBeGreaterThanOrEqual(Math.max(wave.right, score.right, kills.right) - 0.5);
      // Hint stays inside the frame.
      const frame = await rect(page, '#frame');
      const hint = await rect(page, '#hint');
      expect(hint.left).toBeGreaterThanOrEqual(frame.left);
      expect(hint.right).toBeLessThanOrEqual(frame.right);
    });
  }

  test('wave label shows the current wave, never the next one', async ({ page }) => {
    await start(page);
    const label = () => page.locator('#stat-wave').textContent();
    // Before the first wave spawns (3s cooldown) nothing is "next": WAVE 0.
    expect(await label()).toBe('WAVE 0');
    // Wave 1 starts after the cooldown; the label follows it, and never shows WAVE 2.
    const seen = new Set<string>();
    await expect
      .poll(async () => { const l = (await label())!; seen.add(l); return l; }, { timeout: 8000 })
      .toBe('WAVE 1');
    await page.waitForTimeout(1000);
    seen.add((await label())!);
    expect([...seen]).not.toContain('WAVE 2');
    expect(await page.evaluate(() => (window as any).__gameTest.getWave())).toBe(0); // none cleared yet
  });
});