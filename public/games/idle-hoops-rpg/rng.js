// Seeded PRNG with cursor tracking.
//
// Mulberry32 PRNG seeded via djb2 hash of a string.
// The cursor tracks how many draws have been made so the RNG state
// can be persisted to (and restored from) the save string.

// djb2: string -> 32-bit unsigned int.
export function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

// Mulberry32 raw generator factory — returns a () => [0,1) function.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded RNG with cursor tracking.
 *
 * @param {string} seedStr  - deterministic seed (any string)
 * @param {number} [cursor] - how many draws to fast-forward on creation
 * @returns {{ next(): number, range(min, max): number, pick(arr): *, cursor: number }}
 */
export function makeRng(seedStr, cursor = 0) {
  const raw = mulberry32(djb2(seedStr));
  let c = 0;

  // Fast-forward to the saved cursor position.
  while (c < cursor) { raw(); c++; }

  return {
    next() {
      c++;
      return raw();
    },
    /** Integer in [min, max] inclusive. */
    range(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** Pick one element from an array uniformly at random. */
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    },
    get cursor() { return c; },
  };
}
