// Neon Blocks — state machine, game loop, input, HUD wiring.
//
// States: SPLASH → PLAYING → PAUSED → GAME_OVER
//         PLAYING can go to PAUSED and back.
//         GAME_OVER → SPLASH (R key).
//
// Modes: marathon, sprint, daily.

import {
  MODE_MARATHON, MODE_SPRINT, MODE_DAILY,
  LOCK_DELAY_MS, LOCK_RESET_MAX,
  DAS_MS, ARR_MS, SOFT_DROP_MULT,
  LINE_SCORES, TSPIN_SCORES, TSPIN_MINI_SCORES,
  TSPIN_NO_LINE_SCORE, TSPIN_MINI_NO_LINE_SCORE,
  SOFT_DROP_SCORE, HARD_DROP_SCORE,
  COMBO_SCORE, B2B_MULT,
  PC_SCORES, PC_B2B_TETRIS_SCORE,
  LINES_PER_LEVEL, SPRINT_LINES,
  STORAGE, SCOREBOARD_LIMIT,
  gravityFrames,
} from './config.js';

import { Board } from './board.js';
import { Piece }              from './piece.js';
import { Bag, todayUTC }      from './bag.js';
import { AudioEngine }        from './audio.js';
import {
  drawBackground, drawField, drawBoard, drawPiece, drawGhost,
  drawHoldPanel, drawNextPanel, drawStats, drawTopBar,
  drawCRT, drawLineFlash, drawParticles, drawPauseOverlay, drawGameOver,
  drawSplash, triggerLineClearFX, spawnLineClearParticles,
  updateFX, updateParticles, clearParticles, getShakeOffset,
  drawPerfectClearBanner,
  splashHitTest,
} from './render.js';

import { W as CANVAS_W, H as CANVAS_H } from './config.js';

// ---------------------------------------------------------------------------
// Canvas setup
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const audio = new AudioEngine();

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function getScores(mode) {
  try {
    const raw = localStorage.getItem(STORAGE['SCORES_' + mode.toUpperCase()]);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function addScore(mode, entry) {
  const key = STORAGE['SCORES_' + mode.toUpperCase()];
  const list = getScores(mode);
  list.push(entry);
  if (mode === MODE_SPRINT) {
    list.sort((a, b) => a.time - b.time);
  } else {
    list.sort((a, b) => b.score - a.score);
  }
  const trimmed = list.slice(0, SCOREBOARD_LIMIT);
  try { localStorage.setItem(key, JSON.stringify(trimmed)); } catch {}
  return trimmed.findIndex(e => e === entry) + 1; // 1-based rank, or 0 if not found
}

function getDailyRecord(dateStr) {
  try {
    const raw = localStorage.getItem(STORAGE.DAILY_PREFIX + dateStr);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDailyRecord(dateStr, entry) {
  const prev = getDailyRecord(dateStr);
  if (!prev || entry.score > prev.score) {
    try { localStorage.setItem(STORAGE.DAILY_PREFIX + dateStr, JSON.stringify(entry)); } catch {}
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

let gameState = 'SPLASH'; // 'SPLASH' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'
let selectedMode = MODE_MARATHON;

// In-game state.
let board   = null;
let piece   = null;  // active piece
let holdType  = null;
let canHold   = true;
let bag     = null;
let nextPieces = [];

// Scoring / progression.
let score   = 0;
let lines   = 0;
let level   = 1;
let combo   = -1;  // -1 = no active combo; increments on each line-clear lock
let b2b     = 0;   // back-to-back count
let tspinCount = 0;
let tetrises   = 0;

// Sprint.
let sprintTime  = 0;
let sprintStart = null;
let linesLeft   = SPRINT_LINES;

// Daily.
let dailyDate = '';

// Gravity.
let gravityAccum  = 0;   // accumulated fractional frames
let softDropping  = false;

// Lock delay.
let lockTimer       = 0;    // ms accumulated while grounded
let lockResets      = 0;
let pieceLowestRow  = 0;    // deepest row the active piece has ever reached (step-reset)

// Perfect Clear banner.
let pcBannerElapsed = Infinity; // seconds since last PC; Infinity = not shown

// Game-over state.
let gameOverData = null;

// Splash blink.
let blinkTimer = 0;
let blinkOn    = true;

// ---------------------------------------------------------------------------
// DAS / ARR state
// ---------------------------------------------------------------------------

const das = {
  left: { held: false, timer: 0 },
  right: { held: false, timer: 0 },
};

// IRS / IHS key state — track which action keys are currently held so that
// spawnPiece() can apply an initial rotation or hold on spawn.
// DAS timers reset on press (keydown only fires once per physical key-press
// because we guard: `if (!das.left.held) { ... }` before setting held=true).
const heldKeys = {
  rotateCW:  false, // ArrowUp / x / X
  rotateCCW: false, // z / Z
  hold:      false, // Shift / c / C
};

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

document.addEventListener('keydown', e => {
  audio.init();
  audio.resume();

  // Mute toggle — always available.
  if (e.key === 'm' || e.key === 'M') {
    const m = audio.toggleMuted();
    const btn = document.getElementById('sound-toggle');
    if (btn) { btn.textContent = m ? '🔇' : '🔊'; btn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound'); }
    return;
  }

  if (gameState === 'SPLASH') {
    const modes = [MODE_MARATHON, MODE_SPRINT, MODE_DAILY];
    if (e.key === '1') { selectedMode = MODE_MARATHON; }
    else if (e.key === '2') { selectedMode = MODE_SPRINT; }
    else if (e.key === '3') { selectedMode = MODE_DAILY; }
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      const i = modes.indexOf(selectedMode);
      selectedMode = modes[(i - 1 + modes.length) % modes.length];
    }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      const i = modes.indexOf(selectedMode);
      selectedMode = modes[(i + 1) % modes.length];
    }
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      startGame(selectedMode);
    }
    return;
  }

  if (gameState === 'GAME_OVER') {
    if (e.key === 'r' || e.key === 'R') {
      gameState = 'SPLASH';
      audio.stopMusic();
    }
    return;
  }

  if (gameState === 'PAUSED') {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      unpause();
    } else if (e.key === 'r' || e.key === 'R') {
      gameState = 'SPLASH';
      audio.stopMusic();
    }
    return;
  }

  // PLAYING.
  if (gameState !== 'PLAYING') return;
  e.preventDefault();

  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A':
      // Guard: only reset DAS timer on the actual key-press, not on key-repeat.
      // Browsers may re-fire keydown during autorepeat; guarding preserves DAS
      // carry-over across piece spawns when the key stays held.
      if (!das.left.held) { das.left.timer = 0; }
      das.left.held = true;
      tryMoveH(-1);
      break;
    case 'ArrowRight': case 'd': case 'D':
      if (!das.right.held) { das.right.timer = 0; }
      das.right.held = true;
      tryMoveH(1);
      break;
    case 'ArrowDown': case 's': case 'S':
      softDropping = true;
      break;
    case ' ':
      hardDrop();
      break;
    case 'ArrowUp': case 'x': case 'X':
      heldKeys.rotateCW = true;
      tryRotate(1);
      break;
    case 'z': case 'Z':
      heldKeys.rotateCCW = true;
      tryRotate(-1);
      break;
    case 'Shift': case 'c': case 'C':
      heldKeys.hold = true;
      tryHold();
      break;
    case 'p': case 'P': case 'Escape':
      pause();
      break;
    case 'r': case 'R':
      gameState = 'SPLASH';
      audio.stopMusic();
      break;
  }
});

canvas.addEventListener('pointerdown', e => {
  audio.init();
  audio.resume();

  if (gameState !== 'SPLASH') return;

  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width)  * CANVAS_W;
  const cy = ((e.clientY - rect.top)  / rect.height) * CANVAS_H;
  const hit = splashHitTest(cx, cy);
  if (hit) {
    if (selectedMode === hit) {
      startGame(selectedMode);
    } else {
      selectedMode = hit;
    }
  }
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    das.left.held = false;
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    das.right.held = false;
  }
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    softDropping = false;
  }
  if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') {
    heldKeys.rotateCW = false;
  }
  if (e.key === 'z' || e.key === 'Z') {
    heldKeys.rotateCCW = false;
  }
  if (e.key === 'Shift' || e.key === 'c' || e.key === 'C') {
    heldKeys.hold = false;
  }
});

// Sound toggle button.
document.getElementById('sound-toggle')?.addEventListener('click', () => {
  audio.init();
  const m = audio.toggleMuted();
  const btn = document.getElementById('sound-toggle');
  if (btn) { btn.textContent = m ? '🔇' : '🔊'; btn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound'); }
});

// ---------------------------------------------------------------------------
// Game start / setup
// ---------------------------------------------------------------------------

function startGame(mode) {
  selectedMode = mode;

  board    = new Board();
  board.reset();

  holdType = null;
  canHold  = true;
  score    = 0;
  lines    = 0;
  level    = 1;
  combo    = -1;
  b2b      = 0;
  tspinCount = 0;
  tetrises   = 0;
  softDropping = false;
  gravityAccum = 0;
  lockTimer  = 0;
  lockResets = 0;

  pieceLowestRow  = 0;
  pcBannerElapsed = Infinity;
  clearParticles();

  if (mode === MODE_SPRINT) {
    linesLeft  = SPRINT_LINES;
    sprintTime  = 0;
    sprintStart = null;
  }

  if (mode === MODE_DAILY) {
    dailyDate = todayUTC();
    bag = new Bag(dailyDate);
  } else {
    bag = new Bag(null);
  }

  nextPieces = bag.peek(5);
  spawnPiece();

  gameState = 'PLAYING';
  audio.startMusic(level);
}

function spawnPiece() {
  const type = bag.next();
  nextPieces = bag.peek(5);
  piece = new Piece(type);
  canHold = true;

  // IRS (Initial Rotation System) — if a rotation key is held at the moment of
  // spawn, apply that rotation immediately. Rotate CW takes priority over CCW.
  // This does not consume a lock-reset; the piece simply spawns in that rotation.
  if (heldKeys.rotateCW) {
    piece.rotate(1, board);
  } else if (heldKeys.rotateCCW) {
    piece.rotate(-1, board);
  }

  // Check spawn collision (top-out).
  if (board.collides(piece.type, piece.rot, piece.col, piece.row)) {
    triggerGameOver();
    return;
  }

  lockTimer       = 0;
  lockResets      = 0;
  pieceLowestRow  = piece.row; // track deepest row for step-reset

  // IHS (Initial Hold System) — if the hold key is held, immediately swap.
  // Guard: canHold is already true here, but only apply if we haven't just
  // recursed from tryHold() (tryHold sets canHold=false before calling
  // spawnPiece again, so IHS won't recurse).
  if (heldKeys.hold && canHold) {
    tryHold();
  }
}

function pause() {
  if (gameState !== 'PLAYING') return;
  gameState = 'PAUSED';
  audio.pauseMusic();
}

function unpause() {
  if (gameState !== 'PAUSED') return;
  gameState = 'PLAYING';
  audio.resumeMusic();
}

// ---------------------------------------------------------------------------
// Piece actions
// ---------------------------------------------------------------------------

function tryMoveH(dir) {
  if (!piece) return;
  const moved = piece.moveH(dir, board);
  if (moved) {
    audio.move();
    // Reset lock-delay timer if grounded AND under the reset cap.
    // Once the cap is hit, we stop resetting — timer keeps accumulating so the
    // piece still locks after the normal 500ms rather than locking instantly.
    if (piece.isGrounded(board) && lockResets < LOCK_RESET_MAX) {
      lockTimer = 0;
      lockResets++;
    }
  }
}

function tryRotate(dir) {
  if (!piece) return;
  const ok = piece.rotate(dir, board);
  if (ok) {
    audio.rotate();
    // Same cap-aware logic as tryMoveH.
    if (piece.isGrounded(board) && lockResets < LOCK_RESET_MAX) {
      lockTimer = 0;
      lockResets++;
    }
  }
}

function tryHold() {
  if (!canHold || !piece) return;
  const prev = holdType;
  holdType = piece.type;
  canHold  = false;
  audio.hold();

  if (prev !== null) {
    piece = new Piece(prev);
  } else {
    const type = bag.next();
    nextPieces = bag.peek(5);
    piece = new Piece(type);
  }
  lockTimer      = 0;
  lockResets     = 0;
  pieceLowestRow = piece.row;
}

function hardDrop() {
  if (!piece) return;
  const startRow = piece.row;
  const gRow = piece.ghostRow(board);
  const dropped = gRow - startRow;

  piece.row = gRow;
  score += dropped * HARD_DROP_SCORE;
  audio.hardDrop();

  // Start sprint timer on first action.
  if (selectedMode === MODE_SPRINT && sprintStart === null && dropped > 0) {
    sprintStart = performance.now();
  }

  lockPiece();
}

function softDropTick() {
  if (!piece) return;
  if (piece.moveDown(board)) {
    score += SOFT_DROP_SCORE;
    audio.softDrop();
    if (selectedMode === MODE_SPRINT && sprintStart === null) {
      sprintStart = performance.now();
    }
  }
}

// ---------------------------------------------------------------------------
// Locking and line clearing
// ---------------------------------------------------------------------------

function lockPiece() {
  if (!piece) return;

  // T-spin detection before locking.
  const tspinResult = piece.tspinType(board);

  board.lock(piece);
  audio.lock();

  const fullRows = board.fullRows();
  const numLines = fullRows.length;

  if (numLines > 0) {
    // Capture particles before clearing.
    spawnLineClearParticles(fullRows, board);

    // Flash + shake FX.
    const bigFX = numLines >= 4 || tspinResult === 'tspin';
    triggerLineClearFX(fullRows, bigFX);

    board.clearRows(fullRows);

    // Scoring.
    let lineScore = 0;
    let isB2B = false;

    if (tspinResult === 'tspin') {
      lineScore = TSPIN_SCORES[numLines] || 0;
      isB2B = true;
      tspinCount++;
      audio.tspin();
    } else if (tspinResult === 'mini') {
      lineScore = TSPIN_MINI_SCORES[Math.min(numLines, 2)] || 0;
      audio.tspinMini();
    } else if (numLines === 4) {
      lineScore = LINE_SCORES[4];
      isB2B = true;
      tetrises++;
      audio.tetris();
    } else {
      lineScore = LINE_SCORES[numLines] || 0;
      if (numLines === 1) audio.lineSingle();
      else if (numLines === 2) audio.lineDouble();
      else if (numLines === 3) audio.lineTriple();
    }

    // Back-to-back bonus (consecutive Tetris or T-spins).
    if (isB2B && b2b > 0) {
      lineScore = Math.round(lineScore * B2B_MULT);
    }
    if (isB2B) {
      b2b++;
    } else {
      b2b = 0;
    }

    // Combo — line-clearing lock increments combo.
    combo++;
    if (combo > 0) {
      lineScore += COMBO_SCORE * combo * level;
    }

    score += lineScore * level;
    lines += numLines;

    // Perfect Clear — check after clearing if the board is entirely empty.
    // Award a PC bonus on top of the line-clear score (does not reset combo).
    if (board.cells.every(c => c === 0)) {
      let pcScore;
      // B2B Tetris PC: previous lock was also B2B-qualifying AND this is a Tetris (4 lines).
      if (numLines === 4 && b2b > 1) {
        pcScore = PC_B2B_TETRIS_SCORE;
      } else {
        pcScore = PC_SCORES[Math.min(numLines, 4)] || 0;
      }
      score += pcScore * level;
      audio.perfectClear();
      pcBannerElapsed = 0; // start banner timer
    }

    // Sprint: start timer on first line clear if not started.
    if (selectedMode === MODE_SPRINT) {
      if (sprintStart === null) sprintStart = performance.now();
      linesLeft = Math.max(0, SPRINT_LINES - lines);
    }

    // Level up (Marathon/Daily only).
    if (selectedMode !== MODE_SPRINT) {
      const newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
      if (newLevel > level) {
        level = newLevel;
        audio.levelUp();
        audio.setMusicLevel(level);
      }
    }

    // Sprint win condition.
    if (selectedMode === MODE_SPRINT && linesLeft <= 0) {
      triggerGameOver(true);
      return;
    }
  } else {
    // No lines cleared.
    // T-spin no-line scoring: award base bonus even without a line clear.
    // Combo breaks on a non-clearing lock (including T-spin no-line, per guideline).
    if (tspinResult === 'tspin') {
      score += TSPIN_NO_LINE_SCORE * level;
      tspinCount++;
      audio.tspin();
    } else if (tspinResult === 'mini') {
      score += TSPIN_MINI_NO_LINE_SCORE * level;
      audio.tspinMini();
    }
    // Combo resets on any non-line-clearing lock.
    combo = -1;
  }

  spawnPiece();
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

function triggerGameOver(sprintWin = false) {
  gameState = 'GAME_OVER';
  audio.stopMusic();
  if (!sprintWin) audio.gameOver();

  const finalTime = selectedMode === MODE_SPRINT && sprintStart !== null
    ? (performance.now() - sprintStart) / 1000
    : sprintTime;

  let rank = 0;
  let newBest = false;
  let scores = [];

  if (selectedMode === MODE_MARATHON) {
    const entry = { score, lines, level, when: Date.now() };
    rank = addScore(MODE_MARATHON, entry);
    scores = getScores(MODE_MARATHON);
    newBest = rank === 1;
  } else if (selectedMode === MODE_SPRINT && sprintWin) {
    const entry = { time: finalTime, lines, when: Date.now() };
    rank = addScore(MODE_SPRINT, entry);
    scores = getScores(MODE_SPRINT);
    newBest = rank === 1;
  } else if (selectedMode === MODE_DAILY) {
    const entry = { score, lines, level, when: Date.now() };
    newBest = saveDailyRecord(dailyDate, entry);
    const daily = getDailyRecord(dailyDate);
    scores = daily ? [daily] : [];
    rank = newBest ? 1 : 0;
  }

  gameOverData = {
    mode: selectedMode,
    score,
    lines,
    level,
    time: finalTime,
    scores,
    rank,
    newBest,
    tspinCount,
    tetrises,
    sprintWin,
  };
}

// ---------------------------------------------------------------------------
// Gravity update (called each frame with dt in seconds)
// ---------------------------------------------------------------------------

function updateGravity(dt) {
  if (!piece || gameState !== 'PLAYING') return;

  // Sprint timer.
  if (selectedMode === MODE_SPRINT && sprintStart !== null) {
    sprintTime = (performance.now() - sprintStart) / 1000;
  }

  const fps = 60;
  const gFrames = gravityFrames(selectedMode === MODE_SPRINT ? 1 : level);
  const mult    = softDropping ? SOFT_DROP_MULT : 1;
  const framesPerCell = Math.max(1, gFrames / mult);

  gravityAccum += dt * fps;

  while (gravityAccum >= framesPerCell) {
    gravityAccum -= framesPerCell;
    const moved = piece.moveDown(board);
    if (softDropping && moved) {
      score += SOFT_DROP_SCORE;
      if (selectedMode === MODE_SPRINT && sprintStart === null) sprintStart = performance.now();
    }
    if (!moved) break; // hit ground
  }

  // Step-reset: if the piece has fallen to a new lowest row, reset the move-reset
  // counter (guideline "step reset" — used by Tetr.io and Jstris). This lets the
  // player keep manipulating a piece as it falls through open space.
  if (piece.row > pieceLowestRow) {
    pieceLowestRow = piece.row;
    lockResets = 0;
  }

  // Lock delay.
  if (piece.isGrounded(board)) {
    lockTimer += dt * 1000;
    // Lock only when the 500ms window expires. The reset-cap (LOCK_RESET_MAX)
    // no longer force-locks immediately — it just stops accepting further resets
    // so the timer runs out naturally. This gives the player the full grace period
    // even after exhausting their resets.
    if (lockTimer >= LOCK_DELAY_MS) {
      lockTimer = 0;
      lockPiece();
    }
  } else {
    // Piece became airborne — reset timer. lockResets is intentionally NOT reset
    // here; it only resets via the step-reset logic above (new lowest row).
    lockTimer = 0;
  }
}

// ---------------------------------------------------------------------------
// DAS / ARR update
// ---------------------------------------------------------------------------

function updateDAS(dt) {
  if (gameState !== 'PLAYING') return;
  const dtMs = dt * 1000;

  for (const [dir, state] of [[das.left, -1], [das.right, 1]]) {
    if (dir.held) {
      dir.timer += dtMs;
      // Only enter ARR after the initial DAS delay has elapsed.
      if (dir.timer >= DAS_MS) {
        // How far past the DAS threshold are we? Each ARR_MS fires one move.
        const extra = dir.timer - DAS_MS;
        const steps = Math.floor(extra / ARR_MS);
        // Consume exactly those steps from the timer, leaving the remainder.
        dir.timer = DAS_MS + (extra - steps * ARR_MS);
        for (let i = 0; i < steps; i++) tryMoveH(state);
      }
    } else {
      dir.timer = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Main game loop
// ---------------------------------------------------------------------------

let lastTime = 0;

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Blink for splash.
  blinkTimer += dt;
  if (blinkTimer >= 0.6) { blinkOn = !blinkOn; blinkTimer = 0; }

  // Updates.
  updateFX(dt);
  updateParticles(dt);

  if (gameState === 'PLAYING') {
    updateDAS(dt);
    updateGravity(dt);
    // Advance PC banner timer.
    if (pcBannerElapsed < Infinity) pcBannerElapsed += dt;
  }

  // --- Render ---

  const shake = getShakeOffset();
  ctx.save();
  if (shake.x !== 0 || shake.y !== 0) {
    ctx.translate(Math.round(shake.x), Math.round(shake.y));
  }

  if (gameState === 'SPLASH') {
    const splashScores = selectedMode === MODE_DAILY
      ? (getDailyRecord(todayUTC()) ? [getDailyRecord(todayUTC())] : [])
      : getScores(selectedMode);
    drawSplash(ctx, { selectedMode, blinkOn, scores: splashScores });
  } else {
    // Playing / Paused / Game Over — draw game world.
    drawBackground(ctx);
    drawField(ctx);

    if (board) drawBoard(ctx, board);

    if (piece && gameState !== 'GAME_OVER') {
      const ghostR = piece.ghostRow(board);
      drawGhost(ctx, piece, ghostR);
      // Pass lock progress [0,1] so the settling pulse is visible.
      const lockProg = piece.isGrounded(board)
        ? Math.min(1, lockTimer / LOCK_DELAY_MS)
        : 0;
      drawPiece(ctx, piece, lockProg);
    }

    drawLineFlash(ctx);
    drawParticles(ctx);

    // Perfect Clear banner (fades over 1.5s, additive blend).
    if (pcBannerElapsed < 1.5) {
      drawPerfectClearBanner(ctx, pcBannerElapsed);
    }

    // HUD.
    drawTopBar(ctx, {
      mode: selectedMode,
      paused: gameState === 'PAUSED',
    });
    drawHoldPanel(ctx, holdType, canHold);
    drawNextPanel(ctx, nextPieces);
    drawStats(ctx, {
      mode: selectedMode,
      score,
      lines,
      level,
      time: sprintTime,
      linesLeft,
      date: selectedMode === MODE_DAILY ? dailyDate : null,
      combo: Math.max(0, combo),
      b2b,
    });

    drawCRT(ctx);

    if (gameState === 'PAUSED') {
      drawPauseOverlay(ctx);
    } else if (gameState === 'GAME_OVER' && gameOverData) {
      drawGameOver(ctx, gameOverData);
    }
  }

  ctx.restore();

  requestAnimationFrame(loop);
}

// Kick off.
requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });
