// Neon Blocks — design constants, piece definitions, SRS kick tables, scoring.
// Importing this module has no side effects.

// --- Canvas ---

export const W = 480;
export const H = 270;

// Playfield is 10 wide × 20 tall (+ 2-row invisible spawn buffer above).
export const COLS = 10;
export const ROWS = 20;
export const SPAWN_ROWS = 2; // buffer rows above the visible field

// Cell pixel size — the field is 10 cells wide. We keep a wide margin on
// each side for HUD panels. Field is centered.
export const CELL = 12; // px per cell (logical canvas pixels)

// Where the playfield starts (canvas coords). Centered horizontally with
// room for HUD panels on each side.
export const FIELD_LEFT = Math.round(W / 2 - (COLS * CELL) / 2); // 180
export const FIELD_TOP  = 14;  // leave room for top HUD bar
export const FIELD_W    = COLS * CELL;  // 120
export const FIELD_H    = ROWS * CELL;  // 240

// HUD panel widths (left = hold, right = next queue + stats).
export const HUD_L_X = 0;
export const HUD_L_W = FIELD_LEFT;            // 180
export const HUD_R_X = FIELD_LEFT + FIELD_W;  // 300
export const HUD_R_W = W - HUD_R_X;           // 180

// --- Neon palette ---

export const COLORS = {
  bg0: '#03050a',
  bg1: '#0a0e18',
  fieldBg: '#04060d',
  fieldBorder: 'rgba(0, 240, 255, 0.22)',
  gridLine: 'rgba(0, 240, 255, 0.04)',
  hud: '#e6e9f5',
  hudDim: '#8d92a6',
  accent: '#00f0ff',
  magenta: '#ff3df0',
  bad: '#ff3344',
  ok: '#39ff14',
  warn: '#ffee00',
  ghostAlpha: 0.18,
};

// --- Per-piece colors (neon guideline palette) ---

export const PIECE_COLORS = [
  null,        // 0 = empty
  '#00f0ff',   // 1 = I  cyan
  '#ffee00',   // 2 = O  yellow
  '#ff3df0',   // 3 = T  magenta
  '#39ff14',   // 4 = S  green
  '#ff3344',   // 5 = Z  red
  '#3d8aff',   // 6 = J  blue
  '#ff8c00',   // 7 = L  orange
];

// Piece index constants.
export const P_I = 1;
export const P_O = 2;
export const P_T = 3;
export const P_S = 4;
export const P_Z = 5;
export const P_J = 6;
export const P_L = 7;

// --- Piece definitions ---
//
// Each piece is defined as 4 rotation states. Each state is a 4×4 bitmask
// represented as an array of 4 rows (top-to-bottom), each row being 4 bits.
// We use actual coordinate arrays for clarity: array of [col, row] offsets
// from the piece's "pivot" (top-left of its bounding box).
//
// Format: PIECES[pieceType][rotationState] = [[c,r], ...]  (4 minos)

export const PIECES = {
  [P_I]: [
    // rot 0: ████ (horizontal)
    [[0,1],[1,1],[2,1],[3,1]],
    // rot 1: vertical, offset right
    [[2,0],[2,1],[2,2],[2,3]],
    // rot 2: horizontal, one row down
    [[0,2],[1,2],[2,2],[3,2]],
    // rot 3: vertical, offset left
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  [P_O]: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ],
  [P_T]: [
    // rot 0: top flat  .█.
    //                  ███
    [[1,0],[0,1],[1,1],[2,1]],
    // rot 1: right █.
    //              ██
    //              █.
    [[1,0],[1,1],[2,1],[1,2]],
    // rot 2: bottom ███
    //               .█.
    [[0,1],[1,1],[2,1],[1,2]],
    // rot 3: left  .█
    //              ██
    //              .█
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  [P_S]: [
    // rot 0: .██
    //        ██.
    [[1,0],[2,0],[0,1],[1,1]],
    // rot 1:
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ],
  [P_Z]: [
    // rot 0: ██.
    //        .██
    [[0,0],[1,0],[1,1],[2,1]],
    // rot 1:
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ],
  [P_J]: [
    // rot 0: █..
    //        ███
    [[0,0],[0,1],[1,1],[2,1]],
    // rot 1: ██
    //        █.
    //        █.
    [[1,0],[2,0],[1,1],[1,2]],
    // rot 2: ███
    //        ..█
    [[0,1],[1,1],[2,1],[2,2]],
    // rot 3: .█
    //        .█
    //        ██
    [[1,0],[1,1],[0,2],[1,2]],
  ],
  [P_L]: [
    // rot 0: ..█
    //        ███
    [[2,0],[0,1],[1,1],[2,1]],
    // rot 1: █.
    //        █.
    //        ██
    [[1,0],[1,1],[1,2],[2,2]],
    // rot 2: ███
    //        █..
    [[0,1],[1,1],[2,1],[0,2]],
    // rot 3: ██
    //        .█
    //        .█
    [[0,0],[1,0],[1,1],[1,2]],
  ],
};

// --- SRS Wall Kick Tables ---
//
// Standard Rotation System kick tables per the Tetris guideline.
// Each entry is [dx, dy] offsets to try when rotating. y-down coordinates
// (positive y = down on screen). The guideline uses y-up, so we flip y.
//
// JLSTZ kicks: same table for all 5 pieces.
// I kicks: separate table.
//
// Key: `${fromRot}->${toRot}` — 5 offsets per transition.

export const KICKS_JLSTZ = {
  '0->1': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '1->0': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
  '1->2': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
  '2->1': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '2->3': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
  '3->2': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '3->0': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '0->3': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
};

export const KICKS_I = {
  '0->1': [[ 0,0],[-2,0],[ 1,0],[-2, 1],[ 1,-2]],
  '1->0': [[ 0,0],[ 2,0],[-1,0],[ 2,-1],[-1, 2]],
  '1->2': [[ 0,0],[-1,0],[ 2,0],[-1,-2],[ 2, 1]],
  '2->1': [[ 0,0],[ 1,0],[-2,0],[ 1, 2],[-2,-1]],
  '2->3': [[ 0,0],[ 2,0],[-1,0],[ 2,-1],[-1, 2]],
  '3->2': [[ 0,0],[-2,0],[ 1,0],[-2, 1],[ 1,-2]],
  '3->0': [[ 0,0],[ 1,0],[-2,0],[ 1, 2],[-2,-1]],
  '0->3': [[ 0,0],[-1,0],[ 2,0],[-1,-2],[ 2, 1]],
};

// --- Gravity curve (frames per cell drop at 60 fps) ---
//
// Index = level - 1. L19+ all use 1 frame/cell.

export const GRAVITY = [
  60, 48, 37, 28, 21, 16, 11, 8, 6, // L1–L9
   4,  4,  4,                        // L10–L12
   3,  3,  3,                        // L13–L15
   2,  2,  2,                        // L16–L18
   1,                                // L19+
];

// How many frames/cell given a level (1-based).
export function gravityFrames(level) {
  const idx = Math.min(level - 1, GRAVITY.length - 1);
  return GRAVITY[idx];
}

// --- Lock delay ---
export const LOCK_DELAY_MS = 500;
export const LOCK_RESET_MAX = 15;

// --- Perfect Clear scores (× level, indexed by line count 1–4) ---
export const PC_SCORES = [0, 800, 1200, 1800, 2000];
// B2B Tetris PC awarded when prev lock was also B2B-qualifying and this is a Tetris PC.
export const PC_B2B_TETRIS_SCORE = 3200;

// --- T-spin no-line scores (× level) ---
export const TSPIN_NO_LINE_SCORE      = 400;
export const TSPIN_MINI_NO_LINE_SCORE = 100;

// --- DAS / ARR ---
export const DAS_MS = 150;  // initial delay
export const ARR_MS = 30;   // repeat interval
export const SOFT_DROP_MULT = 20; // gravity multiplier

// --- Scoring ---

export const LINE_SCORES = [0, 100, 300, 500, 800]; // [0, single, double, triple, tetris]
export const TSPIN_SCORES = [0, 800, 1200, 1600];   // [0, single, double, triple]
export const TSPIN_MINI_SCORES = [0, 200, 400];      // [0, single, double]
export const SOFT_DROP_SCORE = 1;   // per cell
export const HARD_DROP_SCORE = 2;   // per cell
export const COMBO_SCORE = 50;      // × combo × level
export const B2B_MULT = 1.5;        // back-to-back multiplier

// Lines needed to advance to next level (Marathon/Daily).
export const LINES_PER_LEVEL = 10;

// Sprint target lines.
export const SPRINT_LINES = 40;

// --- Modes ---
export const MODE_MARATHON = 'marathon';
export const MODE_SPRINT   = 'sprint';
export const MODE_DAILY    = 'daily';

// --- localStorage keys ---
export const STORAGE = Object.freeze({
  SCORES_MARATHON: 'neon-blocks:scores:marathon',
  SCORES_SPRINT:   'neon-blocks:scores:sprint',
  DAILY_PREFIX:    'neon-blocks:daily:',
  MUTED:           'neon-blocks:muted',
});

export const SCOREBOARD_LIMIT = 10;
