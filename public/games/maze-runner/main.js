// Maze Runner — main entry, game loop, state machine, input, rendering.
//
// States: SPLASH → PLAYING → WIN
// From WIN or PLAYING the player can press R to go back to SPLASH (new seed)
// or E to enter a custom seed prompt.
//
// The maze is drawn using a camera offset so the player stays centered.
// Fog-of-war hides cells more than FOG_RADIUS cells away from the player.
// A minimap is drawn in the top-right corner showing the full maze at a
// tiny scale.

import { generateMaze, pickGems, bfsPath, N, E, S, W } from './maze.js';
import { AudioEngine } from './audio.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CW = 480;
const CH = 270;

// Difficulty presets: [cols, rows, gemCount, label]
const DIFFICULTIES = [
  { cols: 11, rows: 9,  gems: 3,  label: 'Small'  },
  { cols: 19, rows: 13, gems: 6,  label: 'Medium' },
  { cols: 29, rows: 19, gems: 10, label: 'Large'  },
];
let diffIdx = 1; // default Medium

const CELL_PX = 14;       // canvas pixels per maze cell (logical)
const WALL_W  = 2;        // wall thickness in px
const FOG_RADIUS = 4;     // cells of visibility (fog of war)

// Colors.
const C_BG       = '#06080f';
const C_WALL     = '#00c8d8';       // cyan wall
const C_WALL_DIM = '#0a2a30';       // far-fog wall tint
const C_FLOOR    = '#0a0e18';       // cell interior
const C_FLOOR_VISITED = '#0d1a22';  // slightly brighter once seen
const C_PLAYER   = '#00f0ff';       // bright cyan dot
const C_EXIT     = '#39ff14';       // neon green exit
const C_GEM      = '#ffd700';       // gold gem
const C_TRAIL    = 'rgba(0,240,255,0.18)';
const C_START    = '#ff3df0';       // magenta start tile

// localStorage helpers.
const STORAGE_PREFIX = 'maze-runner:best:';
const SCOREBOARD_PREFIX = 'maze-runner:scores:';
const SCOREBOARD_LIMIT = 10;
const HISTORY_KEY = 'maze-runner:history';
const HISTORY_LIMIT = 20;
const HISTORY_DISPLAY_LIMIT = 10;     // shown in the on-screen list

function bestKey(seed, diff) {
  return `${STORAGE_PREFIX}${diff}:${seed}`;
}
function getBest(seed, diff) {
  const v = localStorage.getItem(bestKey(seed, diff));
  return v !== null ? parseFloat(v) : null;
}
function saveBest(seed, diff, time) {
  const prev = getBest(seed, diff);
  if (prev === null || time < prev) {
    localStorage.setItem(bestKey(seed, diff), time.toFixed(3));
    return true;
  }
  return false;
}

// --- Scoreboard (top 10 per difficulty) ---

function scoreKey(diff) {
  return `${SCOREBOARD_PREFIX}${diff}`;
}

function getScores(diff) {
  try {
    const raw = localStorage.getItem(scoreKey(diff));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Add a new run to the scoreboard for `diff`. Sorts ascending by time
// (faster is better); cuts to SCOREBOARD_LIMIT entries. Returns the
// 1-based rank of the new entry, or 0 if it didn't make the cut.
function addScore(diff, entry) {
  const list = getScores(diff);
  list.push(entry);
  list.sort((a, b) => a.time - b.time);
  const trimmed = list.slice(0, SCOREBOARD_LIMIT);
  localStorage.setItem(scoreKey(diff), JSON.stringify(trimmed));
  const rank = trimmed.indexOf(entry) + 1;  // 0 if filtered out
  return rank;
}

// --- Seed history ---
//
// Tracks the last N distinct (seed, diff) combinations the player has
// started. Most recent first, deduped on (seed,diff): playing the same
// seed again moves it to the front rather than adding a duplicate.

function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function recordHistory(seed, diff) {
  const list = getHistory();
  const key = `${diff}:${String(seed)}`;
  // Drop any prior entry for the same (seed, diff) — we'll re-add at the front.
  const deduped = list.filter(e => `${e.diff}:${String(e.seed)}` !== key);
  deduped.unshift({
    seed: String(seed),
    diff,
    lastPlayed: Date.now(),
  });
  const trimmed = deduped.slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const audio = new AudioEngine();

// Input map (held keys).
const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup',   e => { keys[e.key] = false; });

let state = 'SPLASH';  // 'SPLASH' | 'PLAYING' | 'WIN' | 'HISTORY'

// Maze data (populated in newGame).
let maze     = null;
let startCol = 0, startRow = 0;
let exitCol  = 0, exitRow  = 0;
let gems     = [];   // [{col, row, collected}]
let solutionPath = null; // for optional hint / not drawn in this version

// Player state.
let player = { col: 0, row: 0 };

// Trail: last N visited cells, used for trail rendering.
const TRAIL_MAX = 40;
let trail = [];

// Fog: Uint8Array of cells the player has ever been in range of.
let fogSeen = null;

// Timing.
let elapsed = 0;   // seconds since run start
let startTs = null;

// Camera offset (canvas px, top-left of viewport mapped to maze coords).
let camX = 0, camY = 0;

// Move throttle — one cell per keypress, not held.
let moveQueue = { dx: 0, dy: 0 };
let lastMoveDir = { dx: 0, dy: 0 };

// Flash effects.
let flashMsg  = '';
let flashTimer = 0;
let winNewBest = false;

// Last completed run's scoreboard rank — used to highlight the current
// row on the WIN screen. 0 = didn't make the top-10.
let winRank = 0;
// Snapshot of the scoreboard at the time of the win so the renderer
// shows the post-insert state without re-querying every frame.
let winScores = [];

// Sound-toggle button.
const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', () => {
  audio.init();
  const m = audio.toggleMuted();
  soundBtn.textContent = m ? '🔇' : '🔊';
  soundBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
});

// ---------------------------------------------------------------------------
// New game
// ---------------------------------------------------------------------------

function newGame(seedInput) {
  const diff = DIFFICULTIES[diffIdx];
  const { cols, rows, gems: gemCount } = diff;

  // Seed: use provided or generate random.
  const seed = seedInput ?? Math.floor(Math.random() * 999999);

  maze = generateMaze(cols, rows, seed);

  // Start = top-left, Exit = bottom-right (guaranteed to be reachable by the
  // DFS algorithm — every cell in a DFS maze is connected).
  startCol = 0; startRow = 0;
  exitCol = cols - 1; exitRow = rows - 1;

  // Use the maze's rng-equivalent (re-seed via same hash) for gem placement.
  // We re-run mulberry32 with numericSeed + 1 so gems are stable per seed.
  const gemRng = mulberry32Rng(maze.numericSeed + 1);
  gems = pickGems(maze, startCol, startRow, exitCol, exitRow, gemCount, gemRng)
    .map(g => ({ ...g, collected: false }));

  player = { col: startCol, row: startRow };
  trail = [{ col: startCol, row: startRow }];

  // Track in seed history for the "retry past runs" picker.
  recordHistory(maze.seed, diffIdx);

  fogSeen = new Uint8Array(cols * rows);
  updateFog();

  elapsed = 0;
  startTs = null;  // timer starts on first move

  moveQueue = { dx: 0, dy: 0 };
  lastMoveDir = { dx: 0, dy: 0 };
  flashMsg = '';
  flashTimer = 0;
  winNewBest = false;

  updateCamera();
  state = 'PLAYING';

  audio.init();
  audio.resume();
  audio.startTone();
  audio.startMusic();
}

// Inline mulberry32 for use in newGame without re-importing.
function mulberry32Rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

// We process moves one at a time, not held. To support smooth held movement,
// we queue the *first* new direction pressed each frame.

function gatherInput() {
  const up    = keys['ArrowUp']    || keys['w'] || keys['W'];
  const down  = keys['ArrowDown']  || keys['s'] || keys['S'];
  const left  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];

  if      (up)    return { dx: 0,  dy: -1 };
  else if (down)  return { dx: 0,  dy:  1 };
  else if (left)  return { dx: -1, dy:  0 };
  else if (right) return { dx:  1, dy:  0 };
  return null;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

const DIR_WALL = [
  { dx: 0, dy: -1, wall: N },
  { dx: 0, dy:  1, wall: S },
  { dx: -1, dy: 0, wall: W },
  { dx:  1, dy: 0, wall: E },
];

function tryMove(dx, dy) {
  if (state !== 'PLAYING') return;

  const { cols, rows, cells } = maze;
  const { col, row } = player;
  const idx = row * cols + col;

  // Find the wall bit for this direction.
  const dw = DIR_WALL.find(d => d.dx === dx && d.dy === dy);
  if (!dw) return;

  if (cells[idx] & dw.wall) {
    // Passage open — move.
    const nc = col + dx;
    const nr = row + dy;
    if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) return;
    player.col = nc;
    player.row = nr;

    // Timer starts on first move.
    if (startTs === null) startTs = performance.now();
    elapsed = (performance.now() - startTs) / 1000;

    // Trail.
    trail.push({ col: nc, row: nr });
    if (trail.length > TRAIL_MAX) trail.shift();

    // Fog.
    updateFog();

    // Camera.
    updateCamera();

    // Footstep SFX.
    audio.footstep();

    // Gem collection.
    for (const gem of gems) {
      if (!gem.collected && gem.col === nc && gem.row === nr) {
        gem.collected = true;
        audio.gemPickup();
        flashMsg = '+GEM';
        flashTimer = 0.8;
      }
    }

    // Check win.
    if (nc === exitCol && nr === exitRow) {
      triggerWin();
    }
  } else {
    // Wall — bump.
    audio.bump();
  }
}

function triggerWin() {
  if (startTs !== null) {
    elapsed = (performance.now() - startTs) / 1000;
  }
  const gemCount = gems.filter(g => g.collected).length;
  winNewBest = saveBest(maze.seed, diffIdx, elapsed);

  // Push this run onto the per-difficulty top-10 scoreboard. The rank
  // returned by addScore is 0 if the run didn't make the cut, otherwise
  // 1-indexed; the WIN renderer uses it to highlight the current row.
  const entry = {
    time: elapsed,
    seed: String(maze.seed),
    gems: gemCount,
    gemsTotal: gems.length,
    when: Date.now(),
  };
  winRank = addScore(diffIdx, entry);
  winScores = getScores(diffIdx);

  state = 'WIN';
  audio.winChime();
  flashMsg = winNewBest ? 'NEW BEST!' : 'YOU WIN!';
  flashTimer = 99;
}

// ---------------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------------

function updateFog() {
  const { cols, rows } = maze;
  const { col, row } = player;
  for (let r = Math.max(0, row - FOG_RADIUS); r <= Math.min(rows - 1, row + FOG_RADIUS); r++) {
    for (let c = Math.max(0, col - FOG_RADIUS); c <= Math.min(cols - 1, col + FOG_RADIUS); c++) {
      // Circular fog (Manhattan-ish: skip corners).
      if (Math.abs(c - col) + Math.abs(r - row) <= FOG_RADIUS + 1) {
        fogSeen[r * cols + c] = 1;
      }
    }
  }
}

function inFog(col, row) {
  const { cols } = maze;
  const dx = Math.abs(col - player.col);
  const dy = Math.abs(row - player.row);
  return dx + dy > FOG_RADIUS + 1;
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

function updateCamera() {
  const cx = player.col * CELL_PX + CELL_PX / 2;
  const cy = player.row * CELL_PX + CELL_PX / 2;
  camX = cx - CW / 2;
  camY = cy - CH / 2;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function cellToScreen(col, row) {
  return {
    x: Math.round(col * CELL_PX - camX),
    y: Math.round(row * CELL_PX - camY),
  };
}

// Check if a cell is on screen (with 1-cell padding).
function onScreen(col, row) {
  const { x, y } = cellToScreen(col, row);
  return x > -CELL_PX * 2 && x < CW + CELL_PX * 2 &&
         y > -CELL_PX * 2 && y < CH + CELL_PX * 2;
}

// ---------------------------------------------------------------------------
// Draw maze
// ---------------------------------------------------------------------------

function drawMaze() {
  const { cols, rows, cells } = maze;

  // Cull to visible cells.
  const colMin = Math.max(0, Math.floor(camX / CELL_PX) - 1);
  const colMax = Math.min(cols - 1, Math.ceil((camX + CW) / CELL_PX) + 1);
  const rowMin = Math.max(0, Math.floor(camY / CELL_PX) - 1);
  const rowMax = Math.min(rows - 1, Math.ceil((camY + CH) / CELL_PX) + 1);

  for (let r = rowMin; r <= rowMax; r++) {
    for (let c = colMin; c <= colMax; c++) {
      const idx = r * cols + c;
      const { x, y } = cellToScreen(c, r);
      const seen = fogSeen[idx];
      const nearPlayer = !inFog(c, r);
      const visited = trail.some(t => t.col === c && t.row === r);

      // Cell floor.
      if (seen) {
        ctx.fillStyle = visited ? C_FLOOR_VISITED : C_FLOOR;
        ctx.fillRect(x, y, CELL_PX, CELL_PX);
      }

      if (!seen) continue; // don't draw walls for unseen cells

      const wallColor = nearPlayer ? C_WALL : C_WALL_DIM;

      // Draw walls: for each wall that is CLOSED, draw a line.
      // We draw N and W walls only to avoid doubling up with neighbours.
      const open = cells[idx];

      ctx.fillStyle = wallColor;

      // North wall.
      if (!(open & N)) {
        ctx.fillRect(x, y, CELL_PX, WALL_W);
      }
      // West wall.
      if (!(open & W)) {
        ctx.fillRect(x, y, WALL_W, CELL_PX);
      }
      // South wall (only needed on last row).
      if (r === rows - 1 && !(open & S)) {
        ctx.fillRect(x, y + CELL_PX - WALL_W, CELL_PX, WALL_W);
      }
      // East wall (only needed on last col).
      if (c === cols - 1 && !(open & E)) {
        ctx.fillRect(x + CELL_PX - WALL_W, y, WALL_W, CELL_PX);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Draw trail
// ---------------------------------------------------------------------------

function drawTrail() {
  for (let i = 0; i < trail.length - 1; i++) {
    const t = trail[i];
    const { x, y } = cellToScreen(t.col, t.row);
    const alpha = (i / trail.length) * 0.35;
    ctx.fillStyle = `rgba(0,240,255,${alpha})`;
    ctx.fillRect(x + WALL_W + 1, y + WALL_W + 1, CELL_PX - WALL_W * 2 - 2, CELL_PX - WALL_W * 2 - 2);
  }
}

// ---------------------------------------------------------------------------
// Draw start / exit / gems / player
// ---------------------------------------------------------------------------

function drawSpecialCells() {
  const { cols } = maze;

  // Start cell.
  {
    const { x, y } = cellToScreen(startCol, startRow);
    if (fogSeen[startRow * cols + startCol]) {
      ctx.fillStyle = 'rgba(255,61,240,0.18)';
      ctx.fillRect(x + WALL_W, y + WALL_W, CELL_PX - WALL_W * 2, CELL_PX - WALL_W * 2);
    }
  }

  // Exit cell — draw a bright green glow.
  {
    const { x, y } = cellToScreen(exitCol, exitRow);
    if (fogSeen[exitRow * cols + exitCol]) {
      ctx.fillStyle = 'rgba(57,255,20,0.25)';
      ctx.fillRect(x + WALL_W, y + WALL_W, CELL_PX - WALL_W * 2, CELL_PX - WALL_W * 2);
      // Arrow indicator: draw a tiny cross/plus in the cell center.
      ctx.fillStyle = C_EXIT;
      const cx = x + CELL_PX / 2;
      const cy = y + CELL_PX / 2;
      const s = 2;
      ctx.fillRect(cx - s, cy - 1, s * 2, 2);
      ctx.fillRect(cx - 1, cy - s, 2, s * 2);
    }
  }

  // Gems.
  for (const gem of gems) {
    if (gem.collected) continue;
    if (!fogSeen[gem.row * cols + gem.col]) continue;
    const { x, y } = cellToScreen(gem.col, gem.row);
    const cx = x + CELL_PX / 2;
    const cy = y + CELL_PX / 2;
    // Diamond shape drawn as a rotated square.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const s = Math.round(CELL_PX * 0.28);
    ctx.fillStyle = C_GEM;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Draw player
// ---------------------------------------------------------------------------

function drawPlayer() {
  const { x, y } = cellToScreen(player.col, player.row);
  const cx = Math.round(x + CELL_PX / 2);
  const cy = Math.round(y + CELL_PX / 2);
  const r = Math.round(CELL_PX * 0.30);

  // Glow.
  ctx.shadowColor = C_PLAYER;
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = C_PLAYER;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function drawHUD() {
  const diff = DIFFICULTIES[diffIdx];

  // Semi-transparent bar at top.
  ctx.fillStyle = 'rgba(6,8,15,0.72)';
  ctx.fillRect(0, 0, CW, 22);

  ctx.fillStyle = '#e6e9f5';
  ctx.font = `bold 9px ${FONT_MONO}`;
  ctx.textBaseline = 'middle';

  // Seed label.
  const seedLabel = String(maze.seed).length > 12
    ? String(maze.seed).slice(0, 12) + '…'
    : String(maze.seed);
  ctx.textAlign = 'left';
  ctx.fillText(`SEED ${seedLabel}`, 6, 11);

  // Timer.
  const t = startTs === null ? 0 : elapsed;
  const timeStr = formatTime(t);
  ctx.textAlign = 'center';
  ctx.fillText(timeStr, CW / 2, 11);

  // Gems collected.
  const collected = gems.filter(g => g.collected).length;
  const gemStr = gems.length > 0 ? `GEM ${collected}/${gems.length}` : '';
  ctx.textAlign = 'right';
  ctx.fillText(`${diff.label.toUpperCase()} · ${gemStr}`, CW - 6, 11);

  // Best time.
  const best = getBest(maze.seed, diffIdx);
  if (best !== null) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8d92a6';
    ctx.font = `8px ${FONT_MONO}`;
    ctx.fillText(`BEST ${formatTime(best)}`, 6, 20);
  }

  // Flash message.
  if (flashTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = `bold 12px ${FONT_MONO}`;
    const alpha = Math.min(1, flashTimer);
    ctx.fillStyle = `rgba(255,215,0,${alpha})`;
    ctx.fillText(flashMsg, CW / 2, CH / 2 - 20);
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------

const MM_CELL = 3;   // pixels per cell in the minimap
const MM_PAD  = 4;   // padding inside the minimap box

function drawMinimap() {
  if (!maze) return;
  const { cols, rows, cells } = maze;
  const mmW = cols * MM_CELL;
  const mmH = rows * MM_CELL;
  const ox = CW - mmW - MM_PAD * 2 - 4;
  const oy = CH - mmH - MM_PAD * 2 - 4;

  // Background.
  ctx.fillStyle = 'rgba(6,8,15,0.80)';
  ctx.fillRect(ox, oy, mmW + MM_PAD * 2, mmH + MM_PAD * 2);
  ctx.strokeStyle = 'rgba(0,200,216,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, mmW + MM_PAD * 2 - 1, mmH + MM_PAD * 2 - 1);

  const bx = ox + MM_PAD;
  const by = oy + MM_PAD;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (!fogSeen[idx]) continue;

      const px = bx + c * MM_CELL;
      const py = by + r * MM_CELL;

      // Floor.
      ctx.fillStyle = '#0d1a22';
      ctx.fillRect(px, py, MM_CELL, MM_CELL);

      // Walls (N and W only).
      const open = cells[idx];
      ctx.fillStyle = '#006070';
      if (!(open & N)) ctx.fillRect(px, py, MM_CELL, 1);
      if (!(open & W)) ctx.fillRect(px, py, 1, MM_CELL);
      if (r === rows - 1 && !(open & S)) ctx.fillRect(px, py + MM_CELL - 1, MM_CELL, 1);
      if (c === cols - 1 && !(open & E)) ctx.fillRect(px + MM_CELL - 1, py, 1, MM_CELL);
    }
  }

  // Exit dot.
  ctx.fillStyle = C_EXIT;
  ctx.fillRect(bx + exitCol * MM_CELL, by + exitRow * MM_CELL, MM_CELL, MM_CELL);

  // Uncollected gems.
  for (const gem of gems) {
    if (gem.collected) continue;
    if (!fogSeen[gem.row * cols + gem.col]) continue;
    ctx.fillStyle = C_GEM;
    ctx.fillRect(bx + gem.col * MM_CELL + 1, by + gem.row * MM_CELL + 1, 1, 1);
  }

  // Player dot.
  ctx.fillStyle = C_PLAYER;
  ctx.fillRect(bx + player.col * MM_CELL, by + player.row * MM_CELL, MM_CELL, MM_CELL);
}

// ---------------------------------------------------------------------------
// Splash screen
// ---------------------------------------------------------------------------

function drawSplash() {
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, CW, CH);

  // Title.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = C_WALL;
  ctx.font = `bold 28px ${FONT_MONO}`;
  ctx.shadowColor = C_WALL;
  ctx.shadowBlur = 12;
  ctx.fillText('MAZE RUNNER', CW / 2, CH / 2 - 60);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#8d92a6';
  ctx.font = `10px ${FONT_MONO}`;
  ctx.fillText('find the exit · collect gems · beat your time', CW / 2, CH / 2 - 38);

  // Difficulty selector.
  const btnW = 58, btnH = 20, btnGap = 8;
  const totalW = DIFFICULTIES.length * btnW + (DIFFICULTIES.length - 1) * btnGap;
  let bx = CW / 2 - totalW / 2;
  const by = CH / 2 - 18;

  ctx.font = `bold 9px ${FONT_MONO}`;
  for (let i = 0; i < DIFFICULTIES.length; i++) {
    const active = i === diffIdx;
    ctx.fillStyle = active ? C_WALL : '#1a2a32';
    ctx.fillRect(bx, by, btnW, btnH);
    ctx.fillStyle = active ? '#06080f' : '#8d92a6';
    ctx.fillText(`${i + 1} ${DIFFICULTIES[i].label.toUpperCase()}`, bx + btnW / 2, by + btnH / 2);
    bx += btnW + btnGap;
  }

  // Prompt.
  ctx.fillStyle = '#e6e9f5';
  ctx.font = `bold 10px ${FONT_MONO}`;
  const blink = Math.floor(performance.now() / 600) % 2 === 0;
  if (blink) ctx.fillText('PRESS SPACE TO START', CW / 2, CH / 2 + 14);

  ctx.fillStyle = '#8d92a6';
  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText('E = custom seed · H = seed history · 1/2/3 = difficulty · M = mute', CW / 2, CH / 2 + 30);

  // Best time hint per difficulty.
  const best = getBest('__any__', diffIdx); // not per-seed on splash
  // (We don't know the seed yet; skip best-time on splash.)
}

// ---------------------------------------------------------------------------
// Seed history overlay
// ---------------------------------------------------------------------------
//
// Press H from splash to view the last N (seed, difficulty) pairs the
// player has started. Number keys 1-9 (and 0 for slot 10) pick a row
// to replay; ESC or H return to splash.

function drawHistory() {
  // Background.
  ctx.fillStyle = 'rgba(6,8,15,0.92)';
  ctx.fillRect(0, 0, CW, CH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = C_WALL;
  ctx.shadowColor = C_WALL;
  ctx.shadowBlur = 10;
  ctx.font = `bold 16px ${FONT_MONO}`;
  ctx.fillText('SEED HISTORY', CW / 2, 26);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#8d92a6';
  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText('replay any run · press number key to start', CW / 2, 44);

  const list = getHistory().slice(0, HISTORY_DISPLAY_LIMIT);

  if (list.length === 0) {
    ctx.fillStyle = '#5a607a';
    ctx.font = `10px ${FONT_MONO}`;
    ctx.fillText('no runs yet — start a maze first', CW / 2, CH / 2);
  } else {
    // Table.
    const tableX = 50;
    const rowH = 14;
    const headerY = 70;

    ctx.font = `8px ${FONT_MONO}`;
    ctx.fillStyle = '#5a607a';
    ctx.textAlign = 'left';
    ctx.fillText('#',     tableX,        headerY);
    ctx.fillText('SIZE',  tableX + 22,   headerY);
    ctx.fillText('SEED',  tableX + 70,   headerY);
    ctx.fillText('BEST',  tableX + 230,  headerY);

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const rowY = headerY + 14 + i * rowH;
      const sizeLabel = (DIFFICULTIES[e.diff]?.label || '?').slice(0, 1);
      const seedDisp = e.seed.length > 18 ? e.seed.slice(0, 18) + '…' : e.seed;
      const best = getBest(e.seed, e.diff);
      const bestStr = best !== null ? formatTime(best) : '—';

      // Slot number key — 1-9 then 0 for slot 10.
      const slotKey = i < 9 ? String(i + 1) : '0';

      ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillStyle = C_WALL;
      ctx.fillText(slotKey, tableX, rowY);

      ctx.font = `10px ${FONT_MONO}`;
      ctx.fillStyle = '#c9cdd9';
      ctx.fillText(sizeLabel, tableX + 22, rowY);
      ctx.fillText(seedDisp,  tableX + 70, rowY);
      ctx.fillStyle = best !== null ? C_GEM : '#5a607a';
      ctx.fillText(bestStr,   tableX + 230, rowY);
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6e9f5';
  ctx.font = `bold 9px ${FONT_MONO}`;
  ctx.fillText('1-9, 0 = replay slot · ESC or H = back', CW / 2, CH - 14);
}

// ---------------------------------------------------------------------------
// Win screen overlay
// ---------------------------------------------------------------------------

function drawWin() {
  // Darken the maze underneath.
  ctx.fillStyle = 'rgba(6,8,15,0.85)';
  ctx.fillRect(0, 0, CW, CH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // --- Top: title + run summary ---

  ctx.font = `bold 18px ${FONT_MONO}`;
  ctx.fillStyle = C_EXIT;
  ctx.shadowColor = C_EXIT;
  ctx.shadowBlur = 14;
  ctx.fillText('YOU ESCAPED!', CW / 2, 22);
  ctx.shadowBlur = 0;

  const gemsCollected = gems.filter(g => g.collected).length;
  ctx.font = `10px ${FONT_MONO}`;
  ctx.fillStyle = '#e6e9f5';
  ctx.fillText(
    `Time ${formatTime(elapsed)}   ·   Gems ${gemsCollected}/${gems.length}   ·   Seed ${String(maze.seed).slice(0, 14)}`,
    CW / 2, 42,
  );

  if (winNewBest) {
    ctx.fillStyle = C_GEM;
    ctx.shadowColor = C_GEM;
    ctx.shadowBlur = 6;
    ctx.font = `bold 10px ${FONT_MONO}`;
    ctx.fillText('★ NEW BEST FOR THIS SEED', CW / 2, 56);
    ctx.shadowBlur = 0;
  }

  // --- Middle: top-10 scoreboard for this difficulty ---

  const diffLabel = DIFFICULTIES[diffIdx].label.toUpperCase();
  ctx.font = `bold 9px ${FONT_MONO}`;
  ctx.fillStyle = '#8d92a6';
  ctx.fillText(`— TOP 10 (${diffLabel}) —`, CW / 2, 76);

  // Table header.
  const tableX = 60;
  const tableW = CW - tableX * 2;
  const rowH = 11;
  const headerY = 90;

  ctx.font = `8px ${FONT_MONO}`;
  ctx.fillStyle = '#5a607a';
  ctx.textAlign = 'left';
  ctx.fillText('#',     tableX,            headerY);
  ctx.fillText('TIME',  tableX + 22,       headerY);
  ctx.fillText('GEMS',  tableX + 96,       headerY);
  ctx.fillText('SEED',  tableX + 144,      headerY);

  // Rows.
  ctx.textAlign = 'left';
  for (let i = 0; i < SCOREBOARD_LIMIT; i++) {
    const rowY = headerY + 12 + i * rowH;
    const row = winScores[i];
    const isCurrent = (i + 1) === winRank;

    if (isCurrent) {
      // Highlight strip behind the current run.
      ctx.fillStyle = 'rgba(57,255,20,0.14)';
      ctx.fillRect(tableX - 6, rowY - rowH / 2, tableW + 12, rowH);
      ctx.fillStyle = C_EXIT;
      ctx.shadowColor = C_EXIT;
      ctx.shadowBlur = 4;
    } else if (row) {
      ctx.fillStyle = '#c9cdd9';
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#3a4055';
      ctx.shadowBlur = 0;
    }

    ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText(`${i + 1}.`, tableX, rowY);

    if (row) {
      ctx.fillText(formatTime(row.time),                     tableX + 22,  rowY);
      ctx.fillText(`${row.gems}/${row.gemsTotal}`,           tableX + 96,  rowY);
      const seedDisp = String(row.seed).length > 14
        ? String(row.seed).slice(0, 14) + '…'
        : String(row.seed);
      ctx.fillText(seedDisp,                                 tableX + 144, rowY);
    } else {
      ctx.fillStyle = '#3a4055';
      ctx.fillText('—',                                       tableX + 22,  rowY);
      ctx.fillText('—',                                       tableX + 96,  rowY);
      ctx.fillText('—',                                       tableX + 144, rowY);
    }
    ctx.shadowBlur = 0;
  }

  // --- Bottom: prompt ---

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6e9f5';
  ctx.font = `bold 9px ${FONT_MONO}`;
  ctx.fillText('R = new maze · E = custom seed', CW / 2, CH - 12);
}

// ---------------------------------------------------------------------------
// Custom seed prompt (simple canvas-drawn dialog)
// ---------------------------------------------------------------------------

let promptActive = false;
let promptBuffer = '';
let promptError  = '';

function drawPrompt() {
  // Dim background.
  ctx.fillStyle = 'rgba(6,8,15,0.82)';
  ctx.fillRect(0, 0, CW, CH);

  const pw = 240, ph = 80;
  const px = CW / 2 - pw / 2;
  const py = CH / 2 - ph / 2;

  ctx.fillStyle = '#0d1622';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = C_WALL;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e6e9f5';
  ctx.font = `bold 10px ${FONT_MONO}`;
  ctx.fillText('ENTER SEED (string or number)', CW / 2, py + 16);

  // Input field.
  const fieldW = pw - 20, fieldH = 20;
  const fx = CW / 2 - fieldW / 2;
  const fy = py + 30;
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(fx, fy, fieldW, fieldH);
  ctx.strokeStyle = C_WALL;
  ctx.lineWidth = 1;
  ctx.strokeRect(fx + 0.5, fy + 0.5, fieldW - 1, fieldH - 1);

  ctx.fillStyle = C_WALL;
  ctx.font = `10px ${FONT_MONO}`;
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  ctx.fillText(promptBuffer + (blink ? '|' : ' '), CW / 2, fy + fieldH / 2);

  ctx.fillStyle = '#8d92a6';
  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText('ENTER = confirm · ESC = cancel', CW / 2, py + 64);

  if (promptError) {
    ctx.fillStyle = '#ff4444';
    ctx.fillText(promptError, CW / 2, py + 78);
  }
}

// ---------------------------------------------------------------------------
// Keyboard event for prompt and global shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', e => {
  audio.init();
  audio.resume();

  // Custom seed prompt.
  if (promptActive) {
    if (e.key === 'Escape') {
      promptActive = false;
      promptBuffer = '';
      promptError  = '';
    } else if (e.key === 'Enter') {
      const raw = promptBuffer.trim();
      if (raw.length === 0) {
        promptError = 'Seed cannot be empty.';
      } else {
        promptActive = false;
        promptBuffer = '';
        promptError  = '';
        newGame(raw);
      }
    } else if (e.key === 'Backspace') {
      promptBuffer = promptBuffer.slice(0, -1);
    } else if (e.key.length === 1) {
      if (promptBuffer.length < 24) promptBuffer += e.key;
    }
    e.preventDefault();
    return;
  }

  // Global shortcuts.
  if (e.key === 'M' || e.key === 'm') {
    audio.init();
    const m = audio.toggleMuted();
    soundBtn.textContent = m ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    return;
  }

  if (state === 'SPLASH') {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      newGame(null);
    } else if (e.key === '1') { diffIdx = 0; }
    else if (e.key === '2') { diffIdx = 1; }
    else if (e.key === '3') { diffIdx = 2; }
    else if (e.key === 'e' || e.key === 'E') {
      promptActive = true;
      promptBuffer = '';
      promptError  = '';
    } else if (e.key === 'h' || e.key === 'H') {
      state = 'HISTORY';
    }
    return;
  }

  if (state === 'HISTORY') {
    // ESC or H closes; number keys pick a slot.
    if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
      state = 'SPLASH';
      return;
    }
    // Slots 1-9 map to indices 0-8; "0" maps to index 9 (the 10th slot).
    let pickIdx = -1;
    if (e.key >= '1' && e.key <= '9') pickIdx = parseInt(e.key, 10) - 1;
    else if (e.key === '0') pickIdx = 9;
    if (pickIdx >= 0) {
      const list = getHistory().slice(0, HISTORY_DISPLAY_LIMIT);
      const entry = list[pickIdx];
      if (entry) {
        diffIdx = entry.diff;
        newGame(entry.seed);
      }
    }
    return;
  }

  if (state === 'WIN' || state === 'PLAYING') {
    if (e.key === 'r' || e.key === 'R') {
      state = 'SPLASH';
      maze = null;
      audio.stopMusic();
    } else if (e.key === 'e' || e.key === 'E') {
      promptActive = true;
      promptBuffer = '';
      promptError  = '';
    } else if (e.key === 'h' || e.key === 'H') {
      // Open history overlay; current play stays paused under it.
      // We only allow this from WIN, not mid-PLAYING (would freeze the run).
      if (state === 'WIN') state = 'HISTORY';
    } else if (e.key === '1') { diffIdx = 0; }
    else if (e.key === '2') { diffIdx = 1; }
    else if (e.key === '3') { diffIdx = 2; }
  }
});

// ---------------------------------------------------------------------------
// Move throttle — only fire on keydown, not held
// ---------------------------------------------------------------------------

const moveState = { queued: false, dx: 0, dy: 0, cooldown: 0 };
const MOVE_INITIAL_DELAY = 0.18; // seconds before held key repeats
const MOVE_REPEAT_DELAY  = 0.07; // seconds between repeats while held

document.addEventListener('keydown', e => {
  if (promptActive) return;
  if (state !== 'PLAYING') return;

  let dx = 0, dy = 0;
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') dy = -1;
  if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') dy =  1;
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') dx = -1;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx =  1;

  if (dx !== 0 || dy !== 0) {
    // Fire immediately on first press.
    tryMove(dx, dy);
    // Queue repeat.
    moveState.queued  = true;
    moveState.dx      = dx;
    moveState.dy      = dy;
    moveState.cooldown = MOVE_INITIAL_DELAY;
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  if (promptActive) return;
  let dx = 0, dy = 0;
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') dy = -1;
  if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') dy =  1;
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') dx = -1;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx =  1;

  if (dx === moveState.dx && dy === moveState.dy) {
    moveState.queued = false;
  }
});

// ---------------------------------------------------------------------------
// Main game loop
// ---------------------------------------------------------------------------

let lastTime = 0;

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Update timer.
  if (state === 'PLAYING' && startTs !== null) {
    elapsed = (now - startTs) / 1000;
  }

  // Flash timer.
  if (flashTimer > 0) flashTimer -= dt;

  // Held-key movement repeat.
  if (state === 'PLAYING' && moveState.queued) {
    moveState.cooldown -= dt;
    if (moveState.cooldown <= 0) {
      tryMove(moveState.dx, moveState.dy);
      moveState.cooldown = MOVE_REPEAT_DELAY;
    }
  }

  // --- Draw ---
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, CW, CH);

  if (state === 'SPLASH') {
    drawSplash();
  } else if (state === 'HISTORY') {
    drawHistory();
  } else if (state === 'PLAYING' || state === 'WIN') {
    drawTrail();
    drawMaze();
    drawSpecialCells();
    drawPlayer();
    drawHUD();
    drawMinimap();
    if (state === 'WIN') drawWin();
  }

  if (promptActive) drawPrompt();

  requestAnimationFrame(loop);
}

requestAnimationFrame(ts => {
  lastTime = ts;
  requestAnimationFrame(loop);
});
