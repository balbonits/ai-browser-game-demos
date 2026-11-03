// Neon Tower Defense E2E tests.
//
// Uses ?test=1 to expose window.__gameTest. All state reads go through
// the test hook — never through canvas pixels.
// Never use waitForTimeout — always waitForFunction for state changes.

import { test, expect, type Page } from '@playwright/test';
import { waitForGameTest, readGameTest } from '../shared/test-hooks.js';

const GAME_URL = '/games/neon-tower-defense/index.html?test=1';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

test.describe('Neon Tower Defense — initial state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('game starts in intro state', async ({ page }) => {
    expect(await readGameTest(page, 'getState')).toBe('intro');
  });

  test('money starts at 120 (STARTING_MONEY)', async ({ page }) => {
    // Money is initialized in the game object but only set to STARTING_MONEY
    // after resetGame(). In intro state, game.money is the initial object value.
    // The hook reads game.money directly — verify it's 120 (initial assignment).
    expect(await readGameTest(page, 'getMoney')).toBe(120);
  });

  test('lives starts at 20 (STARTING_LIVES)', async ({ page }) => {
    expect(await readGameTest(page, 'getLives')).toBe(20);
  });

  test('wave starts at 0', async ({ page }) => {
    expect(await readGameTest(page, 'getWave')).toBe(0);
  });

  test('towers array is empty on load', async ({ page }) => {
    const towers = await readGameTest(page, 'getTowers');
    expect((towers as unknown[]).length).toBe(0);
  });

  test('enemies array is empty on load', async ({ page }) => {
    const enemies = await readGameTest(page, 'getEnemies');
    expect((enemies as unknown[]).length).toBe(0);
  });

  test('best score reads from localStorage (neon-td:best)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('neon-td:best', '7'));
    await page.reload();
    await waitForGameTest(page);
    expect(await readGameTest(page, 'getBest')).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Intro → Ready transition
// ---------------------------------------------------------------------------

test.describe('Neon Tower Defense — game start', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('Space in intro transitions to ready state', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'ready');
    expect(await readGameTest(page, 'getState')).toBe('ready');
  });

  test('Enter in intro transitions to ready state', async ({ page }) => {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__gameTest.getState() === 'ready');
    expect(await readGameTest(page, 'getState')).toBe('ready');
  });

  test('click in intro transitions to ready state', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.click();
    await page.waitForFunction(() => window.__gameTest.getState() === 'ready');
    expect(await readGameTest(page, 'getState')).toBe('ready');
  });

  test('after starting, money is 120 and lives is 20', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'ready');
    expect(await readGameTest(page, 'getMoney')).toBe(120);
    expect(await readGameTest(page, 'getLives')).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Ready → Running (wave start)
// ---------------------------------------------------------------------------

test.describe('Neon Tower Defense — wave start', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    // Start the game.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'ready');
  });

  test('Space in ready state starts wave (transitions to running)', async ({ page }) => {
    // Space skips cooldown and starts next wave.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getState')).toBe('running');
  });

  test('wave counter does not increment on wave start (only on clear)', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'running');
    expect(await readGameTest(page, 'getWave')).toBe(0);
  });

  test('cooldown auto-starts wave when expired (state becomes running)', async ({ page }) => {
    // After resetGame(), cooldown = 6s. In ready state the cooldown ticks down
    // until the wave starts automatically. waitForFunction polls until running.
    await page.waitForFunction(
      () => window.__gameTest.getState() === 'running',
      { timeout: 10_000 },
    );
    expect(await readGameTest(page, 'getState')).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// Pause / unpause
// ---------------------------------------------------------------------------

test.describe('Neon Tower Defense — pause', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    // Start and wait for ready state.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__gameTest.getState() === 'ready');
  });

  test('P in ready state pauses the game', async ({ page }) => {
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'paused');
    expect(await readGameTest(page, 'getState')).toBe('paused');
  });

  test('P again in paused state resumes the game', async ({ page }) => {
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() === 'paused');
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__gameTest.getState() !== 'paused');
    const state = await readGameTest(page, 'getState');
    expect(state).toBe('ready'); // resumes to pre-pause state
  });

  test('Escape key pauses the game (when no placement active)', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__gameTest.getState() === 'paused');
    expect(await readGameTest(page, 'getState')).toBe('paused');
  });
});

// ---------------------------------------------------------------------------
// Mute persistence
// ---------------------------------------------------------------------------

test.describe('Neon Tower Defense — mute', () => {
  test('M key stores mute preference in neon-td:muted', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('neon-td:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    const muted = await page.evaluate(() => localStorage.getItem('neon-td:muted'));
    expect(muted).toBe('1');
  });

  test('pressing M twice toggles mute off and stores 0', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('neon-td:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    await page.keyboard.press('m');
    const muted = await page.evaluate(() => localStorage.getItem('neon-td:muted'));
    expect(muted).toBe('0');
  });

  test('mute preference persists across reload', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.evaluate(() => localStorage.removeItem('neon-td:muted'));
    await page.reload();
    await waitForGameTest(page);

    await page.keyboard.press('m');
    // Reload and read from localStorage without pressing M again.
    await page.goto(GAME_URL);
    const muted = await page.evaluate(() => localStorage.getItem('neon-td:muted'));
    expect(muted).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// Tower buttons (bottom strip): name and cost must not overlap
// ---------------------------------------------------------------------------
//
// The buttons are drawn into the canvas, so the DOM can't tell us where the
// text landed. An init script wraps CanvasRenderingContext2D.fillText and, for
// every string drawn in the bottom strip, records the real ink bounding box
// (measureText actualBoundingBox*) in canvas pixels. The test then asserts on
// what the game actually drew, so it fails on the old layout (cost text drawn
// over the tower name).

type TextBox = { text: string; left: number; right: number; top: number; bottom: number };

const BUTTON_SPECS = [
  { name: 'BOLT', cost: '¢40' },
  { name: 'PULSE', cost: '¢80' },
  { name: 'SPIKE', cost: '¢100' },
];

async function installFillTextRecorder(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __fillTextLog: Record<string, unknown> };
    w.__fillTextLog = {};
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number, ...rest: [number?]) {
      if (y > 200) {
        // Bottom strip only (tower buttons). Keep the latest box per string.
        const m = this.measureText(text);
        w.__fillTextLog[text] = {
          text,
          left: x - m.actualBoundingBoxLeft,
          right: x + m.actualBoundingBoxRight,
          top: y - m.actualBoundingBoxAscent,
          bottom: y + m.actualBoundingBoxDescent,
        };
      }
      return orig.call(this, text, x, y, ...rest);
    };
  });
}

async function readTextBoxes(page: Page): Promise<Record<string, TextBox>> {
  await page.waitForFunction(
    () => {
      const log = (window as unknown as { __fillTextLog: Record<string, unknown> }).__fillTextLog;
      return ['BOLT', 'PULSE', 'SPIKE', '¢40', '¢80', '¢100'].every((t) => t in log);
    },
  );
  return page.evaluate(() => (window as unknown as { __fillTextLog: Record<string, TextBox> }).__fillTextLog);
}

const overlaps = (a: TextBox, b: TextBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test.describe('Neon Tower Defense — tower buttons layout', () => {
  test.beforeEach(async ({ page }) => {
    await installFillTextRecorder(page);
    await page.goto(GAME_URL);
    await waitForGameTest(page);
  });

  test('tower name and cost text do not overlap (name sits above the cost)', async ({ page }) => {
    const boxes = await readTextBoxes(page);
    for (const { name, cost } of BUTTON_SPECS) {
      const n = boxes[name];
      const c = boxes[cost];
      expect(overlaps(n, c), `${name} box ${JSON.stringify(n)} overlaps ${cost} box ${JSON.stringify(c)}`).toBe(false);
      // Name on its own line, cost beneath it.
      expect(c.top - n.bottom, `${name} should end at least 2px above ${cost}`).toBeGreaterThanOrEqual(2);
    }
  });

  test('each button label sits inside its button', async ({ page }) => {
    const boxes = await readTextBoxes(page);
    const layout = await page.evaluate(() => window.__gameTest.getTowerButtons());
    expect(layout.buttons).toHaveLength(3);
    layout.buttons.forEach((b: { x: number; y: number; w: number; h: number }, i: number) => {
      const { name, cost } = BUTTON_SPECS[i];
      for (const t of [boxes[name], boxes[cost]]) {
        expect(t.left, t.text).toBeGreaterThanOrEqual(b.x);
        expect(t.right, t.text).toBeLessThanOrEqual(b.x + b.w);
        expect(t.top, t.text).toBeGreaterThanOrEqual(b.y);
        expect(t.bottom, t.text).toBeLessThanOrEqual(b.y + b.h);
      }
    });
  });

  for (const width of [320, 390, 768, 1280]) {
    test(`no horizontal scroll at ${width}px and every button is clickable`, async ({ page }) => {
      await page.setViewportSize({ width, height: Math.round(width * 1.8) });
      await page.reload();
      await waitForGameTest(page);
      const scroll = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      expect(scroll.sw).toBeLessThanOrEqual(scroll.iw);

      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__gameTest.getState() === 'ready');

      const layout = await page.evaluate(() => window.__gameTest.getTowerButtons());
      const box = (await page.locator('#game').boundingBox())!;
      const scale = box.width / 480;

      // The HTML hint overlay must not sit on top of the buttons, neither the
      // default hint nor the longer one shown while placing a tower.
      const strip = {
        left: box.x + layout.buttons[0].x * scale,
        right: box.x + (layout.buttons[2].x + layout.buttons[2].w) * scale,
        top: box.y + layout.buttons[0].y * scale,
        bottom: box.y + (layout.buttons[0].y + layout.buttons[0].h) * scale,
      };
      const hintClear = async (when: string) => {
        const h = (await page.locator('#hint').boundingBox())!;
        const hit = h.x < strip.right && strip.left < h.x + h.width && h.y < strip.bottom && strip.top < h.y + h.height;
        expect(hit, `#hint overlaps the tower buttons (${when}) at ${width}px: ${JSON.stringify(h)} vs ${JSON.stringify(strip)}`).toBe(false);
      };
      await hintClear('default hint');

      const names = ['Bolt', 'Pulse', 'Spike'];
      for (let i = 0; i < 3; i++) {
        const b = layout.buttons[i];
        // Tap target size in CSS pixels. 44px is the target wherever the 16:9
        // frame is wide enough to give it (>= 390px viewports).
        if (width >= 390) {
          expect(b.h * scale, `button ${i} height at ${width}px`).toBeGreaterThanOrEqual(44);
          expect(b.w * scale, `button ${i} width at ${width}px`).toBeGreaterThanOrEqual(44);
        }
        // Click the bottom edge band of the button (inside the hotkey row) and
        // make sure the game selected that tower.
        await page.mouse.click(box.x + (b.x + b.w / 2) * scale, box.y + (b.y + b.h - 5) * scale);
        await expect(page.locator('#hint')).toContainText(`placing ${names[i]}`);
        await hintClear(`placing ${names[i]}`);
        await page.keyboard.press('Escape');
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Test hook smoke test
// ---------------------------------------------------------------------------

test.describe('Neon Tower Defense — test hook', () => {
  test('window.__gameTest is defined with ?test=1', async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    const hookExists = await page.evaluate(() => typeof window.__gameTest);
    expect(hookExists).toBe('object');
  });

  test('window.__gameTest is absent without ?test=1', async ({ page }) => {
    await page.goto('/games/neon-tower-defense/index.html');
    // Give the game a moment to initialize.
    await page.waitForFunction(() => typeof window !== 'undefined');
    const hookExists = await page.evaluate(() => typeof window.__gameTest);
    expect(hookExists).toBe('undefined');
  });

  test('getTowers returns copies (not live references)', async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGameTest(page);
    // Mutating the returned array should not affect game state.
    const mutated = await page.evaluate(() => {
      const t1 = window.__gameTest.getTowers();
      t1.push({ kind: 'injected' });
      const t2 = window.__gameTest.getTowers();
      return t2.length; // should still be the real count
    });
    expect(mutated).toBe(0); // no real towers placed
  });
});
