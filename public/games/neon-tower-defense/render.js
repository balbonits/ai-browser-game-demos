// Neon rendering helpers + particle system.
//
// All visuals in the game are drawn from these primitives — there are no
// sprites anywhere. Each "neon" draw call lays down a soft halo via
// `shadowBlur`/`shadowColor` plus a brighter outlined core, giving shapes
// a glowing CRT vibe.

import { W, H, FIELD_TOP, COLORS, TILE, COLS, ROWS, PATH_W, PATH } from './config.js';
import { buildable, PATH_SEGMENTS } from './map.js';

// --- Color helpers ---

// '#rrggbb' → 'rgba(r, g, b, a)'.
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// --- Shape paths ---
//
// Each `path*` function defines the shape geometry on the current canvas
// path (call ctx.beginPath() before, ctx.fill()/.stroke() after). All
// shapes are centered on (cx, cy) with `size` as the outer radius.

export function pathCircle(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
}

export function pathSquare(ctx, cx, cy, size, angle = 0) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r = size;
  // Four corners (TL, TR, BR, BL) rotated by `angle`.
  const pts = [
    [-r, -r], [r, -r], [r, r], [-r, r],
  ];
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const px = cx + x * c - y * s;
    const py = cy + x * s + y * c;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function pathDiamond(ctx, cx, cy, size, angle = 0) {
  // Diamond = square rotated 45°.
  pathSquare(ctx, cx, cy, size * 0.78, angle + Math.PI / 4);
}

export function pathTriangle(ctx, cx, cy, size, angle = 0) {
  // Equilateral triangle, point at `angle`.
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pts = [
    [size, 0],
    [-size * 0.6, size * 0.7],
    [-size * 0.6, -size * 0.7],
  ];
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const px = cx + x * c - y * s;
    const py = cy + x * s + y * c;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function pathHex(ctx, cx, cy, size, angle = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = angle + i * Math.PI / 3;
    const x = cx + Math.cos(a) * size;
    const y = cy + Math.sin(a) * size;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Generic "draw a shape by name" — used by towers/enemies that store a
// shape name in their config table.
export function pathShape(ctx, name, cx, cy, size, angle = 0) {
  switch (name) {
    case 'square':   return pathSquare(ctx, cx, cy, size, angle);
    case 'diamond':  return pathDiamond(ctx, cx, cy, size, angle);
    case 'triangle': return pathTriangle(ctx, cx, cy, size, angle);
    case 'hex':      return pathHex(ctx, cx, cy, size, angle);
    case 'circle':
    default:         return pathCircle(ctx, cx, cy, size);
  }
}

// --- Neon stroke + fill ---

// Draw the current path as a glowing neon shape: a soft fill + a bright
// stroke + a halo via shadowBlur. Caller has already built the path.
export function neon(ctx, {
  stroke = '#00f0ff',
  fill = null,
  fillAlpha = 0.18,
  width = 1.6,
  glow = 10,
} = {}) {
  ctx.save();
  if (glow > 0) {
    ctx.shadowColor = stroke;
    ctx.shadowBlur = glow;
  }
  if (fill !== null) {
    ctx.fillStyle = fill === 'auto' ? rgba(stroke, fillAlpha) : fill;
    ctx.fill();
  }
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

// --- Background ---

// Static gradient + a faint grid only over buildable tiles. The path
// drawing layers on top.
export function drawBackground(ctx) {
  // Vertical gradient backdrop.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.bg1);
  g.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid dots on buildable tiles only — gives the player a
  // "where can I place" signal without heavy lines.
  ctx.fillStyle = COLORS.grid;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!buildable[r][c]) continue;
      const x = c * TILE + TILE / 2;
      const y = FIELD_TOP + r * TILE + TILE / 2;
      ctx.fillRect(Math.round(x) - 0.5, Math.round(y) - 0.5, 1, 1);
    }
  }
}

// --- Path ---
//
// Drawn as a stroked polyline with a wide halo + a thinner bright core.

export function drawPath(ctx) {
  ctx.save();

  // Outer glow halo
  ctx.shadowColor = COLORS.path;
  ctx.shadowBlur = 18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(COLORS.path, 0.10);
  ctx.lineWidth = PATH_W * 2 + 6;
  strokePathLine(ctx);

  // Mid-tone path body
  ctx.shadowBlur = 10;
  ctx.strokeStyle = rgba(COLORS.path, 0.18);
  ctx.lineWidth = PATH_W * 2;
  strokePathLine(ctx);

  // Inner crisp neon edge
  ctx.shadowBlur = 6;
  ctx.strokeStyle = COLORS.path;
  ctx.lineWidth = 1.4;
  strokePathLine(ctx);

  ctx.restore();
}

function strokePathLine(ctx) {
  ctx.beginPath();
  for (let i = 0; i < PATH.length; i++) {
    const p = PATH[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

// --- HUD top strip (in-canvas) ---
//
// A 22-px tall strip at the top of the canvas. Layout, left-to-right:
//   ♥ lives    ¢ money    [centered status]    WAVE NN/TOTAL
// All stats live in the canvas (no HTML overlay) so the chrome stays
// pixel-perfect with the gameplay frame.

export function drawHudStrip(ctx, {
  wave = 0, total = 12,
  lives = 0, money = 0,
  status = 'ready', cooldown = 0,
} = {}) {
  ctx.save();

  // Translucent strip background with a thin neon underline.
  ctx.fillStyle = rgba(COLORS.bg0, 0.85);
  ctx.fillRect(0, 0, W, FIELD_TOP);
  ctx.fillStyle = rgba(COLORS.path, 0.25);
  ctx.fillRect(0, FIELD_TOP - 1, W, 1);
  ctx.shadowColor = COLORS.path;
  ctx.shadowBlur = 4;
  ctx.fillRect(0, FIELD_TOP - 1, W, 1);
  ctx.shadowBlur = 0;

  ctx.font = "bold 11px 'SF Mono', ui-monospace, Menlo, monospace";
  ctx.textBaseline = 'middle';
  const cy = FIELD_TOP / 2 + 1;

  // Lives (left, red).
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.bad;
  ctx.shadowColor = COLORS.bad;
  ctx.shadowBlur = 6;
  ctx.fillText(`♥ ${lives}`, 8, cy);

  // Money (next to lives, lime).
  ctx.fillStyle = COLORS.ok;
  ctx.shadowColor = COLORS.ok;
  ctx.shadowBlur = 6;
  ctx.fillText(`¢ ${money}`, 56, cy);

  // Wave readout (right, magenta). In endless mode (wave > total) the
  // "/total" portion is replaced with an infinity glyph so the player
  // knows they've crossed into score-attack.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.warn;
  ctx.shadowColor = COLORS.warn;
  ctx.shadowBlur = 6;
  const waveLabel = wave > total
    ? `WAVE ${String(wave).padStart(2, '0')} ∞`
    : `WAVE ${String(wave).padStart(2, '0')}/${total}`;
  ctx.fillText(waveLabel, W - 36, cy);
  ctx.shadowBlur = 0;

  // Status (center) — tells the player what's going on.
  let label = '';
  let color = COLORS.hudDim;
  if (status === 'ready') { label = `next wave in ${cooldown.toFixed(1)}s · SPACE`; color = COLORS.path; }
  else if (status === 'running') { label = 'wave in progress'; color = COLORS.warn; }
  else if (status === 'paused') { label = 'PAUSED'; color = COLORS.hudDim; }
  else if (status === 'won') { label = 'COMPLETE'; color = COLORS.ok; }
  else if (status === 'lost') { label = 'OVERRUN'; color = COLORS.bad; }
  if (label) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, cy);
  }

  ctx.restore();
}

// --- Tower buttons (bottom strip) ---
//
// Three tower-buy slots drawn at the bottom of the canvas — each shows
// the tower's signature shape in its color, the level-1 cost, and the
// hotkey. Selected slot pulses; unaffordable slots dim.

const BUTTON_W = 56;
const BUTTON_H = 36;
const BUTTON_GAP = 6;

export function drawTowerButtons(ctx, {
  towers,
  keys,
  selectedKey,
  money,
  hoverKey = null,
  pulseT = 0,
} = {}) {
  ctx.save();
  const total = keys.length * BUTTON_W + (keys.length - 1) * BUTTON_GAP;
  const startX = (W - total) / 2;
  const y = H - BUTTON_H - 6;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const tw = towers[key];
    const cost = tw.levels[0].cost;
    const x = startX + i * (BUTTON_W + BUTTON_GAP);
    const cx = x + BUTTON_W / 2;
    const cy = y + BUTTON_H / 2;

    const affordable = money >= cost;
    const selected = key === selectedKey;
    const hovered = key === hoverKey;
    const dim = !affordable;

    // Frame
    ctx.shadowColor = tw.color;
    ctx.shadowBlur = selected ? 14 + Math.sin(pulseT * 8) * 4 : (hovered ? 8 : 4);
    ctx.fillStyle = rgba(tw.color, dim ? 0.05 : (selected ? 0.22 : 0.12));
    ctx.strokeStyle = dim ? rgba(tw.color, 0.35) : tw.color;
    ctx.lineWidth = selected ? 1.8 : 1.2;
    roundRect(ctx, x, y, BUTTON_W, BUTTON_H, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Shape glyph (left-ish)
    pathShape(ctx, tw.shape, cx - 14, cy - 2, 7);
    neon(ctx, { stroke: tw.color, fill: 'auto', fillAlpha: dim ? 0.10 : 0.30, glow: dim ? 4 : 10, width: 1.6 });

    // Cost
    ctx.fillStyle = dim ? rgba(COLORS.ok, 0.45) : COLORS.ok;
    ctx.shadowColor = COLORS.ok;
    ctx.shadowBlur = dim ? 0 : 6;
    ctx.font = "bold 10px 'SF Mono', ui-monospace, Menlo, monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`¢${cost}`, cx - 4, cy - 5);
    ctx.shadowBlur = 0;

    // Hotkey
    ctx.fillStyle = rgba(COLORS.hud, dim ? 0.4 : 0.85);
    ctx.font = "9px 'SF Mono', ui-monospace, Menlo, monospace";
    ctx.fillText(`${i + 1}`, cx - 4, cy + 8);

    // Tower name (top of button)
    ctx.fillStyle = rgba(COLORS.hud, dim ? 0.35 : 0.7);
    ctx.font = "8px 'SF Mono', ui-monospace, Menlo, monospace";
    ctx.textAlign = 'center';
    ctx.fillText(tw.name.toUpperCase(), cx, y + 6);
  }

  ctx.restore();
  return { startX, y, w: total, h: BUTTON_H };
}

// Compute hit-tested key for a (mx, my) inside the button strip.
export function buttonHitTest(mx, my, keysCount) {
  const total = keysCount * BUTTON_W + (keysCount - 1) * BUTTON_GAP;
  const startX = (W - total) / 2;
  const y = H - BUTTON_H - 6;
  if (my < y || my > y + BUTTON_H) return -1;
  for (let i = 0; i < keysCount; i++) {
    const x = startX + i * (BUTTON_W + BUTTON_GAP);
    if (mx >= x && mx <= x + BUTTON_W) return i;
  }
  return -1;
}

// --- Misc helpers ---

export function roundRect(ctx, x, y, w, h, r) {
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

// Range-circle preview (for build ghost or selected tower).
export function drawRangeCircle(ctx, cx, cy, range, color = COLORS.path, alpha = 0.22) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = rgba(color, alpha * 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, range, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(color, alpha);
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// HP bar over an enemy (only drawn when damaged or boss-tier).
export function drawHpBar(ctx, x, y, w, frac, color = COLORS.bad) {
  ctx.save();
  ctx.fillStyle = rgba('#000000', 0.55);
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
  ctx.fillStyle = rgba(color, 0.85);
  ctx.fillRect(x - w / 2, y, Math.max(0, w * frac), 2);
  ctx.restore();
}

// --- Particles ---

export const particles = [];

export function spawnBurst(x, y, color, count = 8, speed = 70, life = 0.45, size = 1.4) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.6 + Math.random() * 0.8);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life, maxLife: life,
      color, size,
    });
  }
}

export function spawnSpark(x, y, color, dx = 0, dy = 0) {
  particles.push({
    x, y,
    vx: dx + (Math.random() - 0.5) * 30,
    vy: dy + (Math.random() - 0.5) * 30,
    life: 0.25, maxLife: 0.25,
    color, size: 1.0,
  });
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
}

export function drawParticles(ctx) {
  ctx.save();
  for (const p of particles) {
    const t = p.life / p.maxLife;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
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

// --- Overlays (intro / pause / win / lose) ---

export function drawCenteredOverlay(ctx, { title, subtitle, accent = COLORS.path } = {}) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 10, 0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (title) {
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.shadowBlur = 0;
  }

  if (subtitle) {
    const lines = Array.isArray(subtitle) ? subtitle : [subtitle];
    ctx.fillStyle = rgba(COLORS.hud, 0.85);
    ctx.font = "12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, H / 2 + 8 + i * 16);
    }
  }
  ctx.restore();
}
