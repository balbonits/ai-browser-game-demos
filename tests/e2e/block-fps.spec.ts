// Block Arena E2E tests.
//
// Tests navigate with ?test=1 so window.__gameTest is available.
// All state reads go through the test hook — never through canvas pixels.
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
// Pointer-lock-dependent tests (pointer lock → PLAYING transition, kill
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

test.describe('Block Arena — initial state', () => {
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

test.describe('Block Arena — player state', () => {
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

  test('player starts at origin (x≈0, z≈0)', async ({ page }) => {
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

test.describe('Block Arena — mute persistence', () => {
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
