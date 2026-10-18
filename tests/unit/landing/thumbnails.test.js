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
    for (const g of GAMES) {
      expect(g.thumb, g.slug).toBe(`/games/${g.slug}/thumb.webp`);
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

  it('has exactly one featured game, with a 1280x549 wide crop <=100KB', () => {
    const featured = GAMES.filter((g) => g.featured);
    expect(featured.map((g) => g.slug)).toEqual(['neon-tower-defense']);
    const file = fileFor(featured[0].thumbWide);
    expect(statSync(file).size).toBeLessThanOrEqual(MAX_BYTES);
    expect(webpSize(readFileSync(file))).toEqual({ w: 1280, h: 549 });
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
