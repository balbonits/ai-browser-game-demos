// Unit tests for the tower-button layout in render.js (pure geometry).
//
// The buttons are drawn into the canvas, so these tests check the numbers the
// drawing code reads: each row has its own band, nothing overlaps, everything
// fits inside the button, the strip clears the path, and the buttons are big
// enough to tap once the canvas is scaled to a phone.

import { describe, it, expect } from 'vitest';
import {
  towerButtonLayout, buttonHitTest, BUTTON_W, BUTTON_H, BUTTON_FONT,
} from '../../../public/games/neon-tower-defense/render.js';
import { W, H, TOWER_KEYS, PATH, PATH_W } from '../../../public/games/neon-tower-defense/config.js';

const COUNT = TOWER_KEYS.length;
const layout = towerButtonLayout(COUNT);

// Vertical extent of a text row (em box, canvas px) from its anchor y with
// textBaseline 'middle'. Deliberately generous: the full font size.
const band = (y, size) => [y - size / 2, y + size / 2];

describe('towerButtonLayout', () => {
  it('returns one button per tower, centered on the canvas, inside it', () => {
    expect(layout.buttons).toHaveLength(COUNT);
    const left = layout.buttons[0].x;
    const right = layout.buttons[COUNT - 1].x + BUTTON_W;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(W);
    expect(left + right).toBeCloseTo(W, 6);
    for (const b of layout.buttons) {
      expect(b.y + b.h).toBeLessThanOrEqual(H);
    }
  });

  it('buttons do not overlap each other', () => {
    for (let i = 1; i < COUNT; i++) {
      const prev = layout.buttons[i - 1];
      expect(layout.buttons[i].x).toBeGreaterThanOrEqual(prev.x + prev.w);
    }
  });

  it('puts the name on its own line above the cost, with a gap', () => {
    for (const b of layout.buttons) {
      const [, nameBottom] = band(b.name.y, BUTTON_FONT.name);
      const [costTop] = band(b.cost.y, BUTTON_FONT.cost);
      expect(nameBottom).toBeLessThan(costTop);
      expect(costTop - nameBottom).toBeGreaterThanOrEqual(2);
    }
  });

  it('orders the rows name < glyph/cost < hotkey with no overlap', () => {
    for (const b of layout.buttons) {
      const [, nameBottom] = band(b.name.y, BUTTON_FONT.name);
      const glyphTop = b.glyph.y - b.glyph.r;
      const glyphBottom = b.glyph.y + b.glyph.r;
      const [keyTop, keyBottom] = band(b.hotkey.y, BUTTON_FONT.key);
      expect(nameBottom).toBeLessThanOrEqual(glyphTop);
      expect(glyphBottom).toBeLessThanOrEqual(keyTop);
      expect(keyBottom).toBeLessThanOrEqual(b.y + b.h);
    }
  });

  it('keeps the glyph and the cost side by side without touching', () => {
    // Widest cost label is four characters (e.g. "¢100"); monospace ~0.62em.
    const costW = 4 * BUTTON_FONT.cost * 0.62;
    for (const b of layout.buttons) {
      expect(b.glyph.x + b.glyph.r).toBeLessThan(b.cost.x);
      expect(b.cost.x + costW).toBeLessThanOrEqual(b.x + b.w);
      expect(b.glyph.x - b.glyph.r).toBeGreaterThanOrEqual(b.x);
    }
  });

  it('fits the widest tower name inside the button', () => {
    const widest = 5; // BOLT / PULSE / SPIKE
    const w = widest * BUTTON_FONT.name * 0.62;
    for (const b of layout.buttons) {
      expect(b.name.x - w / 2).toBeGreaterThanOrEqual(b.x);
      expect(b.name.x + w / 2).toBeLessThanOrEqual(b.x + b.w);
    }
  });

  it('is tall enough to tap: >= 44 CSS px once the canvas is scaled to a 390px-wide phone', () => {
    const frameCssW = 390 * 0.96; // .frame is min(96vw, 960px)
    const scale = frameCssW / W;
    expect(BUTTON_H * scale).toBeGreaterThanOrEqual(44);
    expect(BUTTON_W * scale).toBeGreaterThanOrEqual(44);
  });

  it('stays clear of the enemy path (no overlap with the lowest segment)', () => {
    // Lowest horizontal path run is y=200 starting at x=360, drawn PATH_W wide.
    const lowRun = PATH.filter((p) => p.y >= 190);
    const pathLeft = Math.min(...lowRun.map((p) => p.x)) - PATH_W;
    const right = layout.buttons[COUNT - 1].x + BUTTON_W;
    expect(right).toBeLessThanOrEqual(pathLeft);
  });
});

describe('buttonHitTest', () => {
  it('hits each button at its center and in every row', () => {
    layout.buttons.forEach((b, i) => {
      for (const y of [b.name.y, b.glyph.y, b.hotkey.y, b.y + b.h - 1]) {
        expect(buttonHitTest(b.x + b.w / 2, y, COUNT)).toBe(i);
      }
    });
  });

  it('misses above, below and between buttons', () => {
    const b0 = layout.buttons[0];
    const b1 = layout.buttons[1];
    expect(buttonHitTest(b0.x + 5, b0.y - 1, COUNT)).toBe(-1);
    expect(buttonHitTest(b0.x + 5, b0.y + b0.h + 1, COUNT)).toBe(-1);
    expect(buttonHitTest((b0.x + b0.w + b1.x) / 2, b0.y + 10, COUNT)).toBe(-1);
    expect(buttonHitTest(b0.x - 2, b0.y + 10, COUNT)).toBe(-1);
  });
});
