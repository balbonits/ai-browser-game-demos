// Neon Blocks renderer — canvas2D, all visuals code-drawn.
//
// Glow technique: shadowBlur/shadowColor for halos + bright outlines + dim fills.
// Matches the neon-CRT palette/style of neon-tower-defense.

import {
  W, H,
  COLS, ROWS, SPAWN_ROWS, CELL,
  FIELD_LEFT, FIELD_TOP, FIELD_W, FIELD_H,
  HUD_L_X, HUD_L_W, HUD_R_X, HUD_R_W,
  COLORS, PIECE_COLORS,
} from './config.js';
import { TOTAL_ROWS } from './board.js';
import { minosFor } from './piece.js';

const FONT_MONO = "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// --- Color helpers ---

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// --- Background ---

export function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.bg1);
  g.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// --- Playfield ---

export function drawField(ctx) {
  // Field background.
  ctx.fillStyle = COLORS.fieldBg;
  ctx.fillRect(FIELD_LEFT, FIELD_TOP, FIELD_W, FIELD_H);

  // Grid lines.
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(FIELD_LEFT + c * CELL, FIELD_TOP);
    ctx.lineTo(FIELD_LEFT + c * CELL, FIELD_TOP + FIELD_H);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(FIELD_LEFT, FIELD_TOP + r * CELL);
    ctx.lineTo(FIELD_LEFT + FIELD_W, FIELD_TOP + r * CELL);
    ctx.stroke();
  }

  // Border glow.
  ctx.save();
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = COLORS.fieldBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(FIELD_LEFT - 0.5, FIELD_TOP - 0.5, FIELD_W + 1, FIELD_H + 1);
  ctx.restore();
}

// --- Draw a single cell block (neon filled rounded square) ---

export function drawBlock(ctx, col, row, colorHex, alpha = 1.0, glow = true) {
  // Convert from playfield coords (row=0 is spawn buffer top) to canvas coords.
  const x = FIELD_LEFT + col * CELL;
  const y = FIELD_TOP + (row - SPAWN_ROWS) * CELL;
  const pad = 1;
  const r = 2; // corner radius

  ctx.save();
  if (glow && alpha > 0.3) {
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 6;
  }

  // Fill.
  roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, r);
  ctx.fillStyle = rgba(colorHex, alpha * 0.55);
  ctx.fill();

  // Bright outline.
  roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(colorHex, alpha);
  ctx.stroke();

  // Inner highlight (top-left edge).
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(x + pad + r, y + pad);
  ctx.lineTo(x + CELL - pad - r, y + pad);
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = rgba(colorHex, alpha * 0.55);
  ctx.stroke();

  ctx.restore();
}

// --- Draw ghost block (outline only, low alpha) ---

function drawGhostBlock(ctx, col, row, colorHex) {
  const x = FIELD_LEFT + col * CELL;
  const y = FIELD_TOP + (row - SPAWN_ROWS) * CELL;
  const pad = 1;
  const r = 2;

  ctx.save();
  roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(colorHex, COLORS.ghostAlpha);
  ctx.stroke();
  ctx.restore();
}

// --- Draw all locked board cells ---

export function drawBoard(ctx, board) {
  for (let row = SPAWN_ROWS; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const val = board.get(col, row);
      if (val === 0) continue;
      const color = PIECE_COLORS[val];
      drawBlock(ctx, col, row, color, 1.0, true);
    }
  }
}

// --- Draw active piece ---
//
// lockProgress: number in [0, 1] — how far through the lock-delay timer we are.
// 0 = not grounded / just touched down. 1 = about to lock.
// While > 0, the piece outline pulses faster in brightness to signal the grace period.

export function drawPiece(ctx, piece, lockProgress = 0) {
  const color = PIECE_COLORS[piece.type];
  const minos = piece.minos();

  // Settling pulse: interpolate alpha and glow intensity as piece approaches lock.
  // Subtle — just enough to make the grace period legible.
  let alpha = 1.0;
  let extraBloom = 0;
  if (lockProgress > 0) {
    // Fast pulse using a sine wave driven by the progress itself.
    // Beat frequency increases from ~2 Hz near 0% to ~8 Hz near 100%.
    const pulseBeat = 2 + lockProgress * 6;
    // Use the Date clock (ms) so the pulse is absolute, not frame-relative.
    const phase = (Date.now() / 1000) * Math.PI * 2 * pulseBeat;
    const pulse = 0.5 + 0.5 * Math.sin(phase); // [0, 1]
    // Alpha dims slightly (0.75–1.0) and brightens with pulse.
    alpha = 0.75 + 0.25 * (1 - lockProgress) + 0.10 * pulse;
    // Extra bloom increases as lockProgress approaches 1.
    extraBloom = lockProgress * 4 * pulse;
  }

  for (const [c, r] of minos) {
    if (r < SPAWN_ROWS) continue; // clip to visible field
    if (extraBloom > 0) {
      // Draw an additional outer glow ring on top of the normal block.
      const x = FIELD_LEFT + c * CELL;
      const y = FIELD_TOP + (r - SPAWN_ROWS) * CELL;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 + extraBloom;
      ctx.strokeStyle = rgba(color, 0.35 * (lockProgress));
      ctx.lineWidth = 1.5;
      roundRect(ctx, x + 0.5, y + 0.5, CELL - 1, CELL - 1, 2);
      ctx.stroke();
      ctx.restore();
    }
    drawBlock(ctx, c, r, color, alpha, true);
  }
}

// --- Draw ghost piece ---

export function drawGhost(ctx, piece, ghostRow) {
  const color = PIECE_COLORS[piece.type];
  const minos = minosFor(piece.type, piece.rot, piece.col, ghostRow);
  for (const [c, r] of minos) {
    if (r < SPAWN_ROWS) continue;
    // Don't draw ghost where piece already is.
    const pMinos = piece.minos();
    const overlap = pMinos.some(([pc, pr]) => pc === c && pr === r);
    if (overlap) continue;
    drawGhostBlock(ctx, c, r, color);
  }
}

// --- Draw a mini piece preview (for hold/next boxes) ---

function drawMiniPiece(ctx, type, rot, centerX, centerY, cellSize = 8) {
  const color = PIECE_COLORS[type];
  const minos = minosFor(type, rot, 0, 0);

  // Compute bounding box center.
  let minC = 9, maxC = 0, minR = 9, maxR = 0;
  for (const [c, r] of minos) {
    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  }
  const offX = ((minC + maxC + 1) / 2) * cellSize;
  const offY = ((minR + maxR + 1) / 2) * cellSize;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  for (const [c, r] of minos) {
    const px = Math.round(centerX + c * cellSize - offX);
    const py = Math.round(centerY + r * cellSize - offY);
    const pad = 1, rr = 1;
    roundRect(ctx, px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2, rr);
    ctx.fillStyle = rgba(color, 0.55);
    ctx.fill();
    roundRect(ctx, px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2, rr);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(color, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

// --- HUD panel frame helper ---

function drawPanel(ctx, x, y, w, h, label) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,13,0.75)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 4;
  ctx.strokeStyle = rgba(COLORS.accent, 0.30);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 4);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (label) {
    ctx.font = `bold 7px ${FONT_MONO}`;
    ctx.fillStyle = rgba(COLORS.hudDim, 0.85);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + w / 2, y + 3);
  }
  ctx.restore();
}

// --- Left HUD: Hold piece ---

export function drawHoldPanel(ctx, holdType, canHold) {
  const panelX = HUD_L_X + 8;
  const panelW = HUD_L_W - 16;
  const panelH = 48;
  const panelY = FIELD_TOP + 16;
  drawPanel(ctx, panelX, panelY, panelW, panelH, 'HOLD');

  if (holdType !== null) {
    const alpha = canHold ? 1.0 : 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawMiniPiece(ctx, holdType, 0, panelX + panelW / 2, panelY + panelH / 2 + 4);
    ctx.restore();
  }
}

// --- Right HUD: Next queue (5 pieces) ---

export function drawNextPanel(ctx, nextPieces) {
  const panelX = HUD_R_X + 8;
  const panelW = HUD_R_W - 16;
  const panelH = 148;
  const panelY = FIELD_TOP + 16;
  drawPanel(ctx, panelX, panelY, panelW, panelH, 'NEXT');

  const slotH = (panelH - 18) / 5;
  for (let i = 0; i < Math.min(5, nextPieces.length); i++) {
    const cy = panelY + 18 + i * slotH + slotH / 2;
    const alpha = i === 0 ? 1.0 : 0.5 + (4 - i) * 0.12;
    const sz = i === 0 ? 9 : 7;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawMiniPiece(ctx, nextPieces[i], 0, panelX + panelW / 2, cy, sz);
    ctx.restore();
  }
}

// --- Right HUD: Stats (score, lines, level) ---

export function drawStats(ctx, { mode, score, lines, level, time, linesLeft, date, combo, b2b }) {
  const panelX = HUD_R_X + 8;
  const panelW = HUD_R_W - 16;
  const panelY = FIELD_TOP + 172;
  const panelH = FIELD_H - 172 - 4;
  drawPanel(ctx, panelX, panelY, panelW, panelH, null);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lx = panelX + 6;
  let ly = panelY + 6;
  const lineH = 15;

  const label = (t, color = COLORS.hudDim) => {
    ctx.font = `7px ${FONT_MONO}`;
    ctx.fillStyle = color;
    ctx.fillText(t, lx, ly);
  };
  const value = (t, color = COLORS.hud, glow = false) => {
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
    }
    ctx.font = `bold 9px ${FONT_MONO}`;
    ctx.fillStyle = color;
    ctx.fillText(t, lx, ly);
    ctx.shadowBlur = 0;
  };

  // Sprint shows time + lines remaining.
  if (mode === 'sprint') {
    label('TIME');
    ly += 8;
    value(formatTime(time || 0), COLORS.accent, true);
    ly += lineH;
    label('LEFT');
    ly += 8;
    value(String(linesLeft ?? 0), COLORS.warn, true);
    ly += lineH;
  } else {
    // Marathon / Daily.
    label('SCORE');
    ly += 8;
    value(String(score), COLORS.accent, true);
    ly += lineH;
    label('LINES');
    ly += 8;
    value(String(lines), COLORS.hud);
    ly += lineH;
    label('LEVEL');
    ly += 8;
    value(String(level), COLORS.magenta, true);
    ly += lineH;
    if (date) {
      label(date, rgba(COLORS.hudDim, 0.7));
      ly += lineH;
    }
  }

  // Combo indicator.
  if (combo > 0) {
    ctx.shadowColor = COLORS.warn;
    ctx.shadowBlur = 6 + combo * 2;
    ctx.font = `bold 9px ${FONT_MONO}`;
    ctx.fillStyle = COLORS.warn;
    ctx.fillText(`${combo}× COMBO`, lx, ly);
    ctx.shadowBlur = 0;
    ly += lineH;
  }

  // B2B indicator.
  if (b2b > 0) {
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 4;
    ctx.font = `bold 7px ${FONT_MONO}`;
    ctx.fillStyle = rgba(COLORS.magenta, 0.9);
    ctx.fillText(`B2B ×${b2b}`, lx, ly);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// --- Perfect Clear banner ---
//
// Displayed for ~1.5s after a perfect clear. Caller passes the elapsed time
// since the PC triggered; this function draws the fading banner and returns
// true while it should still be shown.

export function drawPerfectClearBanner(ctx, elapsed) {
  const DURATION = 1.5;
  if (elapsed >= DURATION) return false;

  const t = 1 - elapsed / DURATION; // 1 → 0 fade
  const alpha = Math.min(1, t * 2.5); // quick fade-in, slow fade-out

  const cy = FIELD_TOP + FIELD_H * 0.38;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // additive blend
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow halo.
  ctx.shadowColor = COLORS.ok;
  ctx.shadowBlur = 22 * t;
  ctx.fillStyle = rgba(COLORS.ok, alpha * 0.85);
  ctx.font = `bold 14px ${FONT_MONO}`;
  ctx.fillText('PERFECT CLEAR!', FIELD_LEFT + FIELD_W / 2, cy);

  ctx.shadowBlur = 0;
  ctx.restore();
  return true;
}

// --- CRT overlay (scanlines + vignette) ---

export function drawCRT(ctx) {
  ctx.save();

  // Scanlines — every other pixel row.
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < H; y += 2) {
    ctx.fillRect(0, y, W, 1);
  }

  // Vignette.
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

// --- Top HUD bar ---

export function drawTopBar(ctx, { mode, score, level, time, linesLeft, date, paused }) {
  // Thin semi-transparent strip at the top for mode label.
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,10,0.70)';
  ctx.fillRect(0, 0, W, FIELD_TOP);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 7px ${FONT_MONO}`;

  let modeLabel = mode === 'marathon' ? 'MARATHON' : mode === 'sprint' ? 'SPRINT' : 'DAILY';
  if (paused) modeLabel += ' — PAUSED';
  ctx.fillStyle = rgba(COLORS.accent, 0.7);
  ctx.fillText(modeLabel, W / 2, FIELD_TOP / 2);
  ctx.restore();
}

// --- Line clear flash state (array of rows to flash + timer) ---

let flashRows = [];
let flashTimer = 0;
let shakeTimer = 0;
let shakeAmt = 0;

export function triggerLineClearFX(rows, isTetrisOrTspin) {
  flashRows = [...rows];
  flashTimer = 0.08; // 80ms flash
  if (isTetrisOrTspin) {
    shakeTimer = 0.12;
    shakeAmt = 4;
  }
}

export function updateFX(dt) {
  if (flashTimer > 0) flashTimer = Math.max(0, flashTimer - dt);
  if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);
}

export function getShakeOffset() {
  if (shakeTimer <= 0) return { x: 0, y: 0 };
  const intensity = (shakeTimer / 0.12) * shakeAmt;
  return {
    x: (Math.random() - 0.5) * 2 * intensity,
    y: (Math.random() - 0.5) * 2 * intensity,
  };
}

export function drawLineFlash(ctx) {
  if (flashTimer <= 0 || flashRows.length === 0) return;
  const alpha = flashTimer / 0.08;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.75})`;
  for (const r of flashRows) {
    const y = FIELD_TOP + (r - SPAWN_ROWS) * CELL;
    ctx.fillRect(FIELD_LEFT, y, FIELD_W, CELL);
  }
  ctx.restore();
}

// --- Particles ---

const particles = [];

export function spawnLineClearParticles(rows, board) {
  const big = rows.length >= 4;
  for (const r of rows) {
    for (let c = 0; c < COLS; c++) {
      const val = board.get(c, r);
      const color = val > 0 ? PIECE_COLORS[val] : COLORS.accent;
      const count = big ? 15 : 10;
      for (let i = 0; i < count; i++) {
        const cx = FIELD_LEFT + c * CELL + CELL / 2;
        const cy = FIELD_TOP + (r - SPAWN_ROWS) * CELL + CELL / 2;
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI; // mostly upward
        const speed = (big ? 60 : 40) * (0.5 + Math.random());
        particles.push({
          x: cx + (Math.random() - 0.5) * CELL,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.5 + Math.random() * 0.3,
          maxLife: 0.8,
          color,
          size: big ? 1.8 : 1.2,
        });
      }
    }
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 60 * dt; // slight upward float
    p.vx *= 0.95;
  }
}

export function drawParticles(ctx) {
  ctx.save();
  for (const p of particles) {
    const t = p.life / p.maxLife;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 5;
    ctx.fillStyle = rgba(p.color, t);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function clearParticles() {
  particles.length = 0;
}

// --- Overlay (splash / pause / game over) ---

export function drawOverlay(ctx, lines) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,10,0.80)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// --- Splash screen ---

// Splash card geometry (kept in module scope so click hit-tests can reuse it).
const SPLASH_BTN_W = 140;
const SPLASH_BTN_H = 34;
const SPLASH_BTN_GAP = 8;
const SPLASH_BTN_Y = 92;
const SPLASH_MODES = ['marathon', 'sprint', 'daily'];

export function splashHitTest(canvasX, canvasY) {
  const totalW = SPLASH_MODES.length * SPLASH_BTN_W + (SPLASH_MODES.length - 1) * SPLASH_BTN_GAP;
  let bx = W / 2 - totalW / 2;
  for (const id of SPLASH_MODES) {
    if (
      canvasX >= bx && canvasX <= bx + SPLASH_BTN_W &&
      canvasY >= SPLASH_BTN_Y && canvasY <= SPLASH_BTN_Y + SPLASH_BTN_H
    ) return id;
    bx += SPLASH_BTN_W + SPLASH_BTN_GAP;
  }
  return null;
}

export function drawSplash(ctx, { selectedMode, blinkOn, scores }) {
  drawBackground(ctx);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title.
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 18;
  ctx.font = `bold 28px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.accent;
  ctx.fillText('NEON BLOCKS', W / 2, 52);
  ctx.shadowBlur = 0;

  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('falling-block puzzle · synthesized audio · neon CRT visuals', W / 2, 72);

  // Mode buttons.
  const modes = [
    { id: 'marathon', label: '1  MARATHON', sub: 'endless score attack' },
    { id: 'sprint',   label: '2  SPRINT',   sub: '40 lines — fastest time' },
    { id: 'daily',    label: '3  DAILY',    sub: todayLabel() + ' · daily seed' },
  ];

  const btnW = SPLASH_BTN_W, btnH = SPLASH_BTN_H, btnGap = SPLASH_BTN_GAP;
  const totalW = modes.length * btnW + (modes.length - 1) * btnGap;
  let bx = W / 2 - totalW / 2;
  const by = SPLASH_BTN_Y;

  for (const m of modes) {
    const active = selectedMode === m.id;
    ctx.save();
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = active ? 12 : 4;
    ctx.fillStyle = active ? rgba(COLORS.accent, 0.18) : rgba(COLORS.accent, 0.06);
    roundRect(ctx, bx, by, btnW, btnH, 4);
    ctx.fill();
    ctx.strokeStyle = active ? COLORS.accent : rgba(COLORS.accent, 0.30);
    ctx.lineWidth = active ? 1.5 : 1;
    roundRect(ctx, bx, by, btnW, btnH, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = active ? COLORS.accent : COLORS.hudDim;
    ctx.font = `bold 10px ${FONT_MONO}`;
    ctx.fillText(m.label, bx + btnW / 2, by + btnH / 2 - 6);
    ctx.fillStyle = rgba(active ? COLORS.accent : COLORS.hudDim, 0.7);
    ctx.font = `8px ${FONT_MONO}`;
    ctx.fillText(m.sub, bx + btnW / 2, by + btnH / 2 + 8);
    ctx.restore();
    bx += btnW + btnGap;
  }

  // Press to start blink.
  if (blinkOn) {
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 8;
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('PRESS SPACE TO START', W / 2, 148);
    ctx.shadowBlur = 0;
  }

  ctx.font = `8px ${FONT_MONO}`;
  ctx.fillStyle = rgba(COLORS.hudDim, 0.8);
  ctx.fillText('1/2/3 or ←→ pick mode · click to select · Space to start', W / 2, 164);
  ctx.fillText('In-game: ←→/AD move  ↑/X rot CW  Z rot CCW  ↓/S soft  Space hard  Shift/C hold  P pause  R menu  M mute', W / 2, 176);

  // Scoreboard preview for selected mode.
  _drawSplashScores(ctx, selectedMode, scores);

  drawCRT(ctx);
  ctx.restore();
}

function todayLabel() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function _drawSplashScores(ctx, mode, scores) {
  if (!scores || scores.length === 0) return;

  const sx = W / 2 - 130;
  const sy = 192;

  ctx.font = `bold 8px ${FONT_MONO}`;
  ctx.fillStyle = rgba(COLORS.hudDim, 0.8);
  ctx.textAlign = 'left';
  const modeLabel = mode === 'marathon' ? 'MARATHON TOP 5' :
                    mode === 'sprint'   ? 'SPRINT TOP 5 TIMES' : 'DAILY BEST';
  ctx.fillText(modeLabel, sx, sy);

  const show = scores.slice(0, 5);
  for (let i = 0; i < show.length; i++) {
    const e = show[i];
    const rowY = sy + 12 + i * 11;
    ctx.font = `8px ${FONT_MONO}`;
    ctx.fillStyle = i === 0 ? COLORS.warn : COLORS.hudDim;
    const left = `${i+1}. `;
    let right = '';
    if (mode === 'sprint') {
      right = formatTime(e.time) + (e.when ? '  ' + daysSince(e.when) : '');
    } else {
      right = fmtScore(e.score) + `  L${e.level}  ${e.lines}L`;
    }
    ctx.textAlign = 'left';
    ctx.fillText(left + right, sx, rowY);
  }
}

// --- Pause overlay ---

export function drawPauseOverlay(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,10,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 16;
  ctx.font = `bold 22px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.accent;
  ctx.fillText('PAUSED', W / 2, H / 2 - 14);
  ctx.shadowBlur = 0;
  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('P / Esc to resume · R for splash · M mute', W / 2, H / 2 + 8);
  ctx.restore();
}

// --- Game Over overlay ---

export function drawGameOver(ctx, {
  mode, score, lines, level, time,
  scores, rank, newBest, tspinCount, tetrises
}) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,10,0.88)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const isWin = mode === 'sprint';
  const titleColor = isWin ? COLORS.ok : COLORS.bad;
  const titleText  = isWin ? 'SPRINT CLEAR!' : 'GAME OVER';

  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 18;
  ctx.font = `bold 24px ${FONT_MONO}`;
  ctx.fillStyle = titleColor;
  ctx.fillText(titleText, W / 2, 32);
  ctx.shadowBlur = 0;

  // Summary.
  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.hud;
  if (mode === 'sprint') {
    ctx.fillText(`Time: ${formatTime(time)}   Lines: ${lines}`, W / 2, 50);
  } else {
    ctx.fillText(`Score: ${fmtScore(score)}   Lines: ${lines}   Level: ${level}`, W / 2, 50);
  }

  ctx.font = `8px ${FONT_MONO}`;
  ctx.fillStyle = rgba(COLORS.hudDim, 0.8);
  ctx.fillText(`T-spins: ${tspinCount}   Tetrises: ${tetrises}`, W / 2, 62);

  if (newBest) {
    ctx.shadowColor = COLORS.warn;
    ctx.shadowBlur = 8;
    ctx.font = `bold 10px ${FONT_MONO}`;
    ctx.fillStyle = COLORS.warn;
    ctx.fillText(mode === 'sprint' ? 'NEW BEST TIME!' : 'NEW HIGH SCORE!', W / 2, 76);
    ctx.shadowBlur = 0;
  }

  // Scoreboard.
  const modeLabel = mode === 'marathon' ? 'MARATHON TOP 10' :
                    mode === 'sprint'   ? 'SPRINT TOP 10' : 'DAILY RECORD';
  ctx.font = `bold 8px ${FONT_MONO}`;
  ctx.fillStyle = rgba(COLORS.hudDim, 0.7);
  ctx.fillText(`— ${modeLabel} —`, W / 2, 90);

  const tableX = W / 2 - 140;
  const rowH = 11;
  let ry = 100;

  const show = (scores || []).slice(0, 10);
  for (let i = 0; i < 10; i++) {
    const e = show[i];
    const isCurrent = i + 1 === rank;
    ctx.font = `8px ${FONT_MONO}`;
    ctx.textAlign = 'left';

    if (isCurrent) {
      ctx.fillStyle = rgba(titleColor, 0.14);
      ctx.fillRect(tableX - 4, ry - 5, 288, rowH);
      ctx.fillStyle = titleColor;
      ctx.shadowColor = titleColor;
      ctx.shadowBlur = 4;
    } else {
      ctx.fillStyle = e ? COLORS.hudDim : rgba(COLORS.hudDim, 0.3);
      ctx.shadowBlur = 0;
    }

    ctx.fillText(`${i+1}.`, tableX, ry);
    if (e) {
      if (mode === 'sprint') {
        ctx.fillText(formatTime(e.time), tableX + 24, ry);
      } else {
        ctx.fillText(fmtScore(e.score), tableX + 24, ry);
        ctx.fillText(`L${e.level}`, tableX + 96, ry);
        ctx.fillText(`${e.lines}L`, tableX + 132, ry);
      }
      if (e.when) {
        ctx.fillStyle = rgba(COLORS.hudDim, 0.5);
        ctx.fillText(daysSince(e.when), tableX + 188, ry);
      }
    } else {
      ctx.fillText('—', tableX + 24, ry);
    }
    ctx.shadowBlur = 0;
    ry += rowH;
  }

  ctx.textAlign = 'center';
  ctx.font = `bold 9px ${FONT_MONO}`;
  ctx.fillStyle = rgba(COLORS.hud, 0.85);
  ctx.fillText('R = back to menu', W / 2, H - 12);
  ctx.restore();
}

// --- Helpers ---

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
}

function fmtScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function daysSince(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}
