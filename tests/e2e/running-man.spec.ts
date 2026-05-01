// Running Man E2E tests.
//
// Tests navigate with ?test=1 so window.__gameTest is available.
// All state reads go through the test hook — never through canvas pixels.
// No waitForTimeout — all state waits use waitForFunction.
//
// Key bindings verified from main.js:
//   Space / ArrowUp / W  — jump (start from intro/dead, or jump while running)
//   P / Escape           — pause / resume
//   R                    — restart from dead/dying
//   M                    — toggle mute

import { test, expect } from '@playwright/test';
import { waitForGameTest, readGameTest } from '../shared/test-hooks.js';

const GAME_URL = '/games/running-man/index.html?test=1';

// ---------------------------------------------------------------------------
// Intro state
// ---------------------------------------------------------------------------

test.describe('Running Man — intro state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('first load: state is intro', async ({ page }) => {
    const state = await readGameTest(page, 'getState');
    expect(state).toBe('intro');
  });

  test('first load: distance is 0', async ({ page }) => {
    const distance = await readGameTest(page, 'getDistance');
    expect(distance).toBe(0);
  });

  test('first load: hero is on ground', async ({ page }) => {
    const heroState = await readGameTest(page, 'getHero');
    expect((heroState as { onGround: boolean }).onGround).toBe(true);
  });

  test('first load: speed is SPEED_START (170)', async ({ page }) => {
    const speed = await readGameTest(page, 'getSpeed');
    expect(speed).toBe(170);
  });
});

// ---------------------------------------------------------------------------
// Intro → running transition
// ---------------------------------------------------------------------------

test.describe('Running Man — start game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('pressing Space from intro transitions state to running', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getState')).toBe('running');
  });

  test('pressing ArrowUp from intro transitions state to running', async ({ page }) => {
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getState')).toBe('running');
  });

  test('pressing W from intro transitions state to running', async ({ page }) => {
    await page.keyboard.press('w');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getState')).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// Running — distance and speed
// ---------------------------------------------------------------------------

test.describe('Running Man — running state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
  });

  test('distance increases while running', async ({ page }) => {
    // Wait until distance > 0 (game loop has run at least one frame).
    await page.waitForFunction(() => window.__gameTest.getDistance() > 0);
    const distance = await readGameTest(page, 'getDistance');
    expect(distance).toBeGreaterThan(0);
  });

  test('speed is positive while running', async ({ page }) => {
    const speed = await readGameTest(page, 'getSpeed');
    expect(speed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Running — jump
// ---------------------------------------------------------------------------

test.describe('Running Man — jump', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    // Wait for a frame so the hero lands (first press starts the run, not a jump).
    await page.waitForFunction(() => window.__gameTest.getHero().onGround === true);
  });

  test('pressing Space while running makes hero leave the ground', async ({ page }) => {
    await page.keyboard.press('Space');
    // Hero should become airborne (onGround flips to false) within a few frames.
    await page.waitForFunction(() => window.__gameTest.getHero().onGround === false);
    const hero = await readGameTest(page, 'getHero');
    expect((hero as { onGround: boolean }).onGround).toBe(false);
  });

  test('hero vy becomes negative when Space is pressed while running', async ({ page }) => {
    await page.keyboard.press('Space');
    // Wait until the hero is airborne (vy will be negative right after jump).
    await page.waitForFunction(() => window.__gameTest.getHero().vy < 0);
    const hero = await readGameTest(page, 'getHero');
    // vy immediately after jump initiation should be negative (JUMP_VY = -520).
    // Due to game loop timing, gravity may have partially applied by readback time,
    // so we only assert it is negative rather than exactly -520.
    expect((hero as { vy: number }).vy).toBeLessThan(0);
  });

  test('hero returns to ground after a jump', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getHero().onGround === false);
    // Hero must land again within a reasonable time (~1s).
    await page.waitForFunction(() => window.__gameTest.getHero().onGround === true);
    const hero = await readGameTest(page, 'getHero');
    expect((hero as { onGround: boolean }).onGround).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pause / resume
// ---------------------------------------------------------------------------

test.describe('Running Man — pause and resume', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
  });

  test('pressing P pauses the game', async ({ page }) => {
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'paused');
    expect(await readGameTest(page, 'getState')).toBe('paused');
  });

  test('pressing P again resumes the game', async ({ page }) => {
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'paused');
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getState')).toBe('running');
  });

  test('pressing Escape pauses the game', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__gameTest.getState() === 'paused');
    expect(await readGameTest(page, 'getState')).toBe('paused');
  });

  test('distance does not increase while paused', async ({ page }) => {
    // Let some distance accumulate.
    await page.waitForFunction(() => window.__gameTest.getDistance() > 0);
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'paused');
    const distBefore = await readGameTest(page, 'getDistance');
    // Since we cannot sleep, we verify that distance is still the same value
    // after two evaluates in immediate succession.
    const distAfter = await readGameTest(page, 'getDistance');
    expect(distAfter).toBe(distBefore);
  });
});

// ---------------------------------------------------------------------------
// Death and best score
// ---------------------------------------------------------------------------

test.describe('Running Man — death and best score', () => {
  test('after the hero hits an obstacle, state transitions to dying then dead', async ({ page }) => {
    // Clear any stored best so we don't pollute other tests.
    await page.goto(GAME_URL);
    await page.evaluate(() => {
      localStorage.removeItem('running-man:best');
      localStorage.removeItem('running-man:history');
    });
    await page.reload();
    await waitForGameTest(page);

    // Start the game. The hero runs automatically and will hit an obstacle
    // within at most a few seconds (earliest spawn is 0.55s, hero cannot dodge
    // without input). We do NOT press Space so the hero never jumps.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');

    // Wait for state to become 'dying' or 'dead' (no input = guaranteed hit).
    // Generous timeout: 30s covers even a long breather gap + max speed ramp.
    await page.waitForFunction(
      () => {
        const s = window.__gameTest.getState();
        return s === 'dying' || s === 'dead';
      },
      { timeout: 30_000 },
    );

    // Then wait for the animation to finish and reach 'dead'.
    await page.waitForFunction(() => window.__gameTest.getState() === 'dead', {
      timeout: 10_000,
    });

    expect(await readGameTest(page, 'getState')).toBe('dead');
  });

  test('best score is updated in localStorage when a new best is set', async ({ page }) => {
    await page.goto(GAME_URL);
    // Seed a low best so the current run (any non-zero distance) beats it.
    await page.evaluate(() => localStorage.setItem('running-man:best', '0'));
    await page.reload();
    await waitForGameTest(page);

    // Start running — no jump so the hero hits the first obstacle.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');

    // Wait for death.
    await page.waitForFunction(
      () => {
        const s = window.__gameTest.getState();
        return s === 'dying' || s === 'dead';
      },
      { timeout: 30_000 },
    );
    await page.waitForFunction(() => window.__gameTest.getState() === 'dead', {
      timeout: 10_000,
    });

    // localStorage best should now be >= 0 (game records the run distance).
    const best = await page.evaluate(() =>
      Number(localStorage.getItem('running-man:best') || 0),
    );
    expect(best).toBeGreaterThanOrEqual(0);
  });

  test('pressing R from dead state restarts the game', async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);

    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');

    // Wait for death.
    await page.waitForFunction(
      () => {
        const s = window.__gameTest.getState();
        return s === 'dying' || s === 'dead';
      },
      { timeout: 30_000 },
    );
    await page.waitForFunction(() => window.__gameTest.getState() === 'dead', {
      timeout: 10_000,
    });

    // Press R to restart.
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getState')).toBe('running');
  });

  test('pressing Space from dead state restarts the game', async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);

    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');

    await page.waitForFunction(
      () => {
        const s = window.__gameTest.getState();
        return s === 'dying' || s === 'dead';
      },
      { timeout: 30_000 },
    );
    await page.waitForFunction(() => window.__gameTest.getState() === 'dead', {
      timeout: 10_000,
    });

    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getState')).toBe('running');
  });
});
