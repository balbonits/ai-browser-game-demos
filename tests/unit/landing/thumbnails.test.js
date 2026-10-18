// Game-card thumbnail contract (registry + files on disk).
//
// Spec: each game has a 960x540 WebP card thumbnail <=100KB at
// public/games/<slug>/thumb.webp, with unique, short alt text that starts
// with the game's title. The featured game also has a 1280x549 wide crop.
// og.png (1200x630) backs the Open Graph / Twitter link preview.

import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GAMES } from '../../../src/data/games.ts';

const PUBLIC = resolve(import.meta.dirname, '../../../public');
const MAX_BYTES = 100 * 1024;

const fileFor = (url) => resolve(PUBLIC, url.replace(/^\//, ''));

// Minimal WebP header reader (lossy VP8, lossless VP8L, extended VP8X).
function webpSize(buf) {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8 ') {
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') {
    return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`unknown WebP chunk ${kind}`);
}

describe('game card thumbnails', () => {
  it('registers a thumbnail for every game at the conventional path', () => {
    // thumb.webp, or a cache-busting rename such as thumb-v2.webp (vercel.json
    // serves thumbnails as immutable for a year, so replacements get new names).
    for (const g of GAMES) {
      expect(g.thumb, g.slug).toMatch(new RegExp(`^/games/${g.slug}/thumb(-[a-z0-9]+)*\\.webp$`));
    }
  });

  it.each(GAMES.map((g) => [g.slug, g]))('%s thumb is a 960x540 WebP <=100KB', (_slug, g) => {
    const file = fileFor(g.thumb);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThanOrEqual(MAX_BYTES);
    expect(webpSize(readFileSync(file))).toEqual({ w: 960, h: 540 });
  });

  it('has short, unique alt text that starts with the game title', () => {
    const seen = new Set();
    for (const g of GAMES) {
      expect(g.thumbAlt.startsWith(`${g.title}:`), g.slug).toBe(true);
      expect(g.thumbAlt.length, g.slug).toBeLessThanOrEqual(125);
      expect(g.thumbAlt.toLowerCase(), g.slug).not.toContain('screenshot of');
      expect(seen.has(g.thumbAlt), `duplicate alt: ${g.thumbAlt}`).toBe(false);
      seen.add(g.thumbAlt);
    }
  });

  it('has exactly one featured game', () => {
    expect(GAMES.filter((g) => g.featured).map((g) => g.slug)).toEqual(['neon-tower-defense']);
  });

  it('every featured or wide game has a 1280x549 wide crop <=100KB', () => {
    const wide = GAMES.filter((g) => g.featured || g.wide);
    expect(wide.map((g) => g.slug)).toEqual(['neon-tower-defense', 'idle-hoops-rpg']);
    for (const g of wide) {
      expect(g.thumbWide, g.slug).toBeTruthy();
      const file = fileFor(g.thumbWide);
      expect(statSync(file).size, g.slug).toBeLessThanOrEqual(MAX_BYTES);
      expect(webpSize(readFileSync(file)), g.slug).toEqual({ w: 1280, h: 549 });
    }
  });

  it('leaves no orphan card: the last desktop row is full', () => {
    // Desktop grid has 2 columns; featured and wide cards take both.
    const span = (g) => (g.featured || g.wide ? 2 : 1);
    const rows = [];
    let used = 0;
    for (const g of GAMES) {
      const s = span(g);
      if (used + s > 2) { rows.push(used); used = 0; }
      used += s;
    }
    rows.push(used);
    expect(rows.at(-1)).toBe(2);
  });

  it('ships a 1200x630 og.png and references it from index.html', () => {
    const png = readFileSync(resolve(PUBLIC, 'og.png'));
    expect(png.toString('ascii', 1, 4)).toBe('PNG');
    expect({ w: png.readUInt32BE(16), h: png.readUInt32BE(20) }).toEqual({ w: 1200, h: 630 });

    const html = readFileSync(resolve(PUBLIC, '../index.html'), 'utf8');
    expect(html).toContain('<meta property="og:image" content="https://games.jdilig.me/og.png"');
    expect(html).toContain('<meta name="twitter:image" content="https://games.jdilig.me/og.png"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  });
});
