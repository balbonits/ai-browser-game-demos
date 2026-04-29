// 7-bag randomizer with seeded RNG.
//
// Each "bag" is a shuffled [I, O, T, S, Z, J, L]. When a bag is exhausted
// the next is pre-generated so the "next" queue can always look ahead.
// Seeded mode (Daily) keeps the sequence deterministic.

import { P_I, P_O, P_T, P_S, P_Z, P_J, P_L } from './config.js';

const ALL_PIECES = [P_I, P_O, P_T, P_S, P_Z, P_J, P_L];

// --- Mulberry32 PRNG (ported from maze-runner/maze.js) ---

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// djb2 string → 32-bit int (same as maze-runner).
export function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

// Return today's UTC date as "YYYY-MM-DD".
export function todayUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Fisher-Yates shuffle in place.
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Bag ---

export class Bag {
  // seedStr: string or null (null = random).
  constructor(seedStr = null) {
    if (seedStr !== null) {
      this._rng = mulberry32(djb2(seedStr));
    } else {
      this._rng = mulberry32(Math.floor(Math.random() * 0xFFFFFFFF) >>> 0);
    }
    this._queue = [];
    this._fillBag();
    this._fillBag(); // pre-fill so next-queue of 5 is always available
  }

  _fillBag() {
    const bag = shuffle([...ALL_PIECES], this._rng);
    for (const p of bag) this._queue.push(p);
  }

  // Peek at the next `n` pieces without consuming them.
  peek(n = 5) {
    while (this._queue.length < n) this._fillBag();
    return this._queue.slice(0, n);
  }

  // Consume and return the next piece type.
  next() {
    if (this._queue.length < 8) this._fillBag();
    return this._queue.shift();
  }
}
