// Maze generation via recursive backtracker (depth-first search).
//
// Why recursive backtracker?
//   - Produces long, winding corridors with few dead ends — perfect for a
//     "runner" feel where the path forward feels purposeful.
//   - Simple to implement and deterministic given the same RNG state.
//   - Contrast: Wilson's gives more uniform random spanning trees (shorter
//     average dead-end length, feels more "branchy") — better for puzzle
//     games. DFS feels better for racing-against-time.
//
// Cell representation: each cell is a bitfield of open walls:
//   bit 0 = N wall open
//   bit 1 = E wall open
//   bit 2 = S wall open
//   bit 3 = W wall open
//
// Grid is cols × rows. Index = row * cols + col.

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

const OPPOSITE = { [N]: S, [S]: N, [E]: W, [W]: E };
const DIRS = [N, E, S, W];
const DC = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
const DR = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };

// Mulberry32 PRNG — fast, small, and good enough for maze gen.
// Returns a function that produces [0, 1) floats.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert a string seed to a 32-bit integer.
function hashSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  // djb2-style hash
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

// Fisher-Yates shuffle using the provided RNG.
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate a maze of `cols` × `rows` cells.
// Returns { cols, rows, cells, seed, numericSeed }.
// `cells` is a Uint8Array where cells[idx] = bitmask of open walls.
export function generateMaze(cols, rows, seed = null) {
  const numericSeed = hashSeed(seed ?? Math.floor(Math.random() * 0xFFFFFFFF));
  const rng = mulberry32(numericSeed);

  const cells = new Uint8Array(cols * rows); // all walls closed initially

  const visited = new Uint8Array(cols * rows);
  const stack = [];

  // Start at top-left cell.
  const startIdx = 0;
  visited[startIdx] = 1;
  stack.push({ col: 0, row: 0 });

  while (stack.length > 0) {
    const { col, row } = stack[stack.length - 1];
    const idx = row * cols + col;

    // Gather unvisited neighbours.
    const dirs = shuffle([...DIRS], rng);
    let carved = false;

    for (const dir of dirs) {
      const nc = col + DC[dir];
      const nr = row + DR[dir];
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nidx = nr * cols + nc;
      if (visited[nidx]) continue;

      // Carve passage.
      cells[idx] |= dir;
      cells[nidx] |= OPPOSITE[dir];
      visited[nidx] = 1;
      stack.push({ col: nc, row: nr });
      carved = true;
      break;
    }

    if (!carved) stack.pop();
  }

  return { cols, rows, cells, seed: seed ?? numericSeed, numericSeed };
}

// Compute straight-line distance between two cells (in cell units).
function cellDist(c1, r1, c2, r2) {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

// Pick gem positions: scatter gems along dead-end cells, avoiding start/exit.
// Returns an array of { col, row } objects.
export function pickGems(maze, startCol, startRow, exitCol, exitRow, count, rng) {
  const { cols, rows, cells } = maze;
  // Dead-end cells = only one open wall.
  const deadEnds = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const walls = cells[idx];
      const openCount = [N, E, S, W].filter(d => walls & d).length;
      if (openCount === 1) {
        // Exclude start and exit.
        if ((c === startCol && r === startRow) || (c === exitCol && r === exitRow)) continue;
        deadEnds.push({ col: c, row: r });
      }
    }
  }

  shuffle(deadEnds, rng);
  return deadEnds.slice(0, Math.min(count, deadEnds.length));
}

// BFS to compute shortest path from (sc, sr) to (ec, er).
// Returns an array of { col, row } from start to end (inclusive), or null.
export function bfsPath(maze, sc, sr, ec, er) {
  const { cols, rows, cells } = maze;
  const visited = new Uint8Array(cols * rows);
  const parent = new Int32Array(cols * rows).fill(-1);
  const queue = [sr * cols + sc];
  visited[sr * cols + sc] = 1;

  while (queue.length > 0) {
    const idx = queue.shift();
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    if (c === ec && r === er) {
      // Reconstruct path.
      const path = [];
      let cur = idx;
      while (cur !== -1) {
        path.unshift({ col: cur % cols, row: Math.floor(cur / cols) });
        cur = parent[cur];
      }
      return path;
    }
    for (const dir of DIRS) {
      if (!(cells[idx] & dir)) continue;
      const nc = c + DC[dir];
      const nr = r + DR[dir];
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nidx = nr * cols + nc;
      if (visited[nidx]) continue;
      visited[nidx] = 1;
      parent[nidx] = idx;
      queue.push(nidx);
    }
  }
  return null;
}
