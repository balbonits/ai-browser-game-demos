// Neon Blocks E2E tests.
//
// Tests navigate with ?test=1 so window.__gameTest is available.
// All state reads go through the test hook — never through canvas pixels.
// Always use waitForFunction instead of waitForTimeout for state changes.

import { test, expect } from '@playwright/test';
import { waitForGameTest, readGameTest } from '../shared/test-hooks.js';

// The React shell intercepts directory URLs (e.g. /games/neon-blocks/) in dev
// mode. Using the explicit index.html path serves the static game file directly.
const GAME_URL = '/games/neon-blocks/index.html?test=1';

// ---------------------------------------------------------------------------
// Splash — mode selection
// ---------------------------------------------------------------------------

test.describe('Neon Blocks splash', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  // Regression test for the splash bug fixed in ac1cda6 (arrow keys on splash).
  test('arrow keys cycle modes forward: marathon → sprint → daily → marathon', async ({ page }) => {
    expect(await readGameTest(page, 'getMode')).toBe('marathon');
    await page.keyboard.press('ArrowRight');
    expect(await readGameTest(page, 'getMode')).toBe('sprint');
    await page.keyboard.press('ArrowRight');
    expect(await readGameTest(page, 'getMode')).toBe('daily');
    await page.keyboard.press('ArrowRight');
    expect(await readGameTest(page, 'getMode')).toBe('marathon');
  });

  test('arrow keys cycle modes backward: marathon → daily → sprint → marathon', async ({ page }) => {
    expect(await readGameTest(page, 'getMode')).toBe('marathon');
    await page.keyboard.press('ArrowLeft');
    expect(await readGameTest(page, 'getMode')).toBe('daily');
    await page.keyboard.press('ArrowLeft');
    expect(await readGameTest(page, 'getMode')).toBe('sprint');
    await page.keyboard.press('ArrowLeft');
    expect(await readGameTest(page, 'getMode')).toBe('marathon');
  });

  test('number key 2 selects sprint mode', async ({ page }) => {
    await page.keyboard.press('2');
    expect(await readGameTest(page, 'getMode')).toBe('sprint');
  });

  test('number key 3 selects daily mode', async ({ page }) => {
    await page.keyboard.press('3');
    expect(await readGameTest(page, 'getMode')).toBe('daily');
  });
});

// ---------------------------------------------------------------------------
// Splash → game start
// ---------------------------------------------------------------------------

test.describe('Neon Blocks game start', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('Enter starts the selected mode and transitions state to PLAYING', async ({ page }) => {
    // Select sprint first via number key.
    await page.keyboard.press('2');
    expect(await readGameTest(page, 'getMode')).toBe('sprint');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
    expect(await readGameTest(page, 'getState')).toBe('PLAYING');
    expect(await readGameTest(page, 'getMode')).toBe('sprint');
  });
});

// ---------------------------------------------------------------------------
// Gameplay — hard drop
// ---------------------------------------------------------------------------

test.describe('Neon Blocks gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    // Start marathon mode.
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
  });

  test('hard drop locks a piece onto the board', async ({ page }) => {
    // Capture the next piece type before dropping — it will become the active piece.
    const nextBefore = await readGameTest(page, 'getNext');
    // Hard drop locks the current piece.
    await page.keyboard.press('Space');
    // Wait until the board has at least 4 non-zero cells (locked piece minos).
    await page.waitForFunction(() => {
      const cells = window.__gameTest.getBoard();
      return cells !== null && cells.filter(c => c !== 0).length >= 4;
    });
    const boardAfter = await readGameTest(page, 'getBoard');
    const nonZero = (boardAfter as number[]).filter((c: number) => c !== 0).length;
    expect(nonZero).toBeGreaterThanOrEqual(4);
    // The next queue's former first piece is now the active piece.
    const pieceAfter = await readGameTest(page, 'getPiece');
    expect((pieceAfter as { type: number }).type).toBe((nextBefore as number[])[0]);
  });

  test('pause/unpause via P key changes state', async ({ page }) => {
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PAUSED');
    expect(await readGameTest(page, 'getState')).toBe('PAUSED');
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
    expect(await readGameTest(page, 'getState')).toBe('PLAYING');
  });
});

// ---------------------------------------------------------------------------
// Mute persistence
// ---------------------------------------------------------------------------

test.describe('Neon Blocks mute', () => {
  test('mute persists as "1" in localStorage after pressing M', async ({ page }) => {
    // Clear any pre-existing mute state.
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('neon-blocks:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    // Navigate fresh to the same URL to confirm persistence.
    await page.goto(GAME_URL);
    const muted = await page.evaluate(() => localStorage.getItem('neon-blocks:muted'));
    expect(muted).toBe('1');
  });

  test('unmute persists as "0" in localStorage after pressing M twice', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('neon-blocks:muted'));
    await page.reload();
    await waitForGameTest(page);

    // Mute, then unmute.
    await page.keyboard.press('m');
    await page.keyboard.press('m');
    await page.goto(GAME_URL);
    const muted = await page.evaluate(() => localStorage.getItem('neon-blocks:muted'));
    expect(muted).toBe('0');
  });
});
