// Maze Runner E2E tests.
//
// Tests navigate with ?test=1 so window.__gameTest is available.
// All state reads go through the test hook — never through canvas pixels.
// Use waitForFunction instead of waitForTimeout for state changes.
//
// URL uses explicit index.html: the React dev server intercepts directory
// URLs in dev mode; the explicit filename bypasses that.

import { test, expect } from '@playwright/test';
import { waitForGameTest, readGameTest } from '../shared/test-hooks.js';

const GAME_URL = '/games/maze-runner/index.html?test=1';

// Wall bit constants — mirror maze.js exports so tests are self-contained.
const N = 1, E = 2, S = 4, W = 8;

// Map a wall bit to the Arrow key that moves in that direction.
const wallToKey: Record<number, string> = {
  [N]: 'ArrowUp',
  [E]: 'ArrowRight',
  [S]: 'ArrowDown',
  [W]: 'ArrowLeft',
};

// ---------------------------------------------------------------------------
// Splash — initial state
// ---------------------------------------------------------------------------

test.describe('Maze Runner splash', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('initial state is SPLASH', async ({ page }) => {
    expect(await readGameTest(page, 'getState')).toBe('SPLASH');
  });

  test('getSeed() is null before any game starts', async ({ page }) => {
    expect(await readGameTest(page, 'getSeed')).toBeNull();
  });

  test('getMaze() is null before any game starts', async ({ page }) => {
    expect(await readGameTest(page, 'getMaze')).toBeNull();
  });

  test('default difficulty index is 1 (Medium)', async ({ page }) => {
    expect(await readGameTest(page, 'getDiff')).toBe(1);
  });

  test('pressing 1 sets difficulty to 0 (Small)', async ({ page }) => {
    await page.keyboard.press('1');
    expect(await readGameTest(page, 'getDiff')).toBe(0);
  });

  test('pressing 3 sets difficulty to 2 (Large)', async ({ page }) => {
    await page.keyboard.press('3');
    expect(await readGameTest(page, 'getDiff')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Splash → game start
// ---------------------------------------------------------------------------

test.describe('Maze Runner game start', () => {
  test.beforeEach(async ({ page }) => {
    // Use Small difficulty so the maze is smallest and fastest to generate.
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('1'); // Small
  });

  test('Space transitions state to PLAYING', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
    expect(await readGameTest(page, 'getState')).toBe('PLAYING');
  });

  test('maze is non-null after Space is pressed', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
    const maze = await readGameTest(page, 'getMaze');
    expect(maze).not.toBeNull();
  });

  test('player starts at (0, 0)', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
    const player = await readGameTest(page, 'getPlayer');
    expect(player).toEqual({ col: 0, row: 0 });
  });

  test('exit is at bottom-right corner of the Small maze (10, 8)', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
    const exitCell = await readGameTest(page, 'getExit');
    // Small: 11 cols × 9 rows → exit at (10, 8).
    expect(exitCell).toEqual({ col: 10, row: 8 });
  });
});

// ---------------------------------------------------------------------------
// Gameplay — movement
// ---------------------------------------------------------------------------

test.describe('Maze Runner gameplay — movement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('1'); // Small
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');
  });

  test('player moves away from (0,0) after pressing an open-wall direction', async ({ page }) => {
    // Read the maze cells to find which wall(s) at cell 0 are open.
    const maze = await page.evaluate(() => window.__gameTest.getMaze());
    const cell0 = maze.cells[0]; // bitmask for (0,0)

    // Find the first open wall direction.
    let keyToPress: string | null = null;
    for (const [wall, key] of Object.entries(wallToKey)) {
      if (cell0 & Number(wall)) {
        keyToPress = key;
        break;
      }
    }
    expect(keyToPress).not.toBeNull(); // DFS guarantees at least one open wall

    await page.keyboard.press(keyToPress!);

    // Wait until the player position changes.
    await page.waitForFunction(() => {
      const p = window.__gameTest.getPlayer();
      return p.col !== 0 || p.row !== 0;
    });

    const playerAfter = await readGameTest(page, 'getPlayer');
    expect(playerAfter.col !== 0 || playerAfter.row !== 0).toBe(true);
  });

  test('pressing into a closed wall leaves player at the same position', async ({ page }) => {
    // Find a closed wall direction at (0,0).
    const maze = await page.evaluate(() => window.__gameTest.getMaze());
    const cell0 = maze.cells[0];

    let closedKey: string | null = null;
    for (const [wall, key] of Object.entries(wallToKey)) {
      if (!(cell0 & Number(wall))) {
        closedKey = key;
        break;
      }
    }

    if (closedKey === null) {
      // Edge case: (0,0) has all 4 directions open (impossible for a corner cell
      // in DFS — skip this test by treating it as vacuously passing).
      return;
    }

    const before = await readGameTest(page, 'getPlayer');
    await page.keyboard.press(closedKey);
    // Small pause to let the frame process — no state change expected.
    await page.waitForTimeout(80);
    const after = await readGameTest(page, 'getPlayer');
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Return to splash
// ---------------------------------------------------------------------------

test.describe('Maze Runner — R key returns to splash', () => {
  test('pressing R during PLAYING returns state to SPLASH', async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('1');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');

    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__gameTest.getState() === 'SPLASH');
    expect(await readGameTest(page, 'getState')).toBe('SPLASH');
  });

  test('maze is null after returning to splash', async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('1');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'PLAYING');

    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__gameTest.getState() === 'SPLASH');
    expect(await readGameTest(page, 'getMaze')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Mute persistence
// ---------------------------------------------------------------------------

test.describe('Maze Runner mute', () => {
  // Storage key confirmed from audio.js: const STORAGE_KEY = 'maze-runner:muted';

  test('pressing M writes "1" to localStorage key maze-runner:muted', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('maze-runner:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    await page.goto(GAME_URL);
    const muted = await page.evaluate(() => localStorage.getItem('maze-runner:muted'));
    expect(muted).toBe('1');
  });

  test('pressing M twice writes "0" to localStorage key maze-runner:muted', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('maze-runner:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    await page.keyboard.press('m');
    await page.goto(GAME_URL);
    const muted = await page.evaluate(() => localStorage.getItem('maze-runner:muted'));
    expect(muted).toBe('0');
  });
});
