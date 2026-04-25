// Towers — placeable structures that target enemies and fire projectiles.
//
// A tower stores its grid cell, type key (bolt/pulse/spike), current level
// (1-3), accumulated invested cost (for sell refund), and a fire cooldown.
// Stats are looked up from TOWERS[key].levels[level - 1] each access so
// upgrades take effect immediately.

import { TOWERS, TILE, FIELD_TOP } from './config.js';
import { tileCenter, buildable } from './map.js';
import { findFirstInRange } from './enemies.js';
import { fireProjectile } from './projectiles.js';
import { pathShape, neon, drawRangeCircle, rgba, spawnSpark } from './render.js';

export const towers = [];

let _nextId = 1;

export function resetTowers() {
  // Mark all previously-built tiles as buildable again.
  for (const t of towers) {
    if (buildable[t.row]) buildable[t.row][t.col] = true;
  }
  towers.length = 0;
}

export function buildTower(key, col, row) {
  if (!buildable[row] || !buildable[row][col]) return null;
  const def = TOWERS[key];
  if (!def) return null;
  const center = tileCenter(col, row);
  const t = {
    id: _nextId++,
    key,
    def,
    col, row,
    x: center.x,
    y: center.y,
    level: 1,
    invested: def.levels[0].cost,
    cooldown: 0,
    angle: 0,
  };
  towers.push(t);
  buildable[row][col] = false;
  return t;
}

export function sellTower(t) {
  const idx = towers.indexOf(t);
  if (idx < 0) return 0;
  const refund = Math.round(t.invested * 0.7);
  towers.splice(idx, 1);
  buildable[t.row][t.col] = true;
  return refund;
}

export function upgradeTower(t) {
  if (t.level >= t.def.levels.length) return false;
  const cost = t.def.levels[t.level].cost;  // .levels[level] (next)
  t.level++;
  t.invested += cost;
  return true;
}

export function nextUpgradeCost(t) {
  if (t.level >= t.def.levels.length) return null;
  return t.def.levels[t.level].cost;
}

export function towerStats(t) {
  return t.def.levels[t.level - 1];
}

// Pick a tower at canvas (mx, my). Returns the tower or null.
export function pickTower(mx, my) {
  let best = null;
  let bestD = Infinity;
  for (const t of towers) {
    const d = Math.hypot(mx - t.x, my - t.y);
    if (d <= TILE * 0.6 && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function updateTowers(dt, onFire) {
  for (const t of towers) {
    if (t.cooldown > 0) t.cooldown -= dt;
    const stats = towerStats(t);

    // Acquire target.
    const target = findFirstInRange(t.x, t.y, stats.range);
    if (!target) continue;

    // Aim — face the body toward the target so the player can read it.
    const ang = Math.atan2(target.y - t.y, target.x - t.x);
    // Smooth angle interp so the body doesn't snap; faster turn for bolt.
    const turnRate = t.key === 'bolt' ? 16 : t.key === 'spike' ? 10 : 6;
    let da = ang - t.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    t.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, da));

    // Fire.
    if (t.cooldown <= 0) {
      const flavor = t.key;
      const sp = stats.speed;
      const ux = Math.cos(t.angle);
      const uy = Math.sin(t.angle);
      fireProjectile({
        flavor,
        x: t.x + ux * 8,
        y: t.y + uy * 8,
        target: flavor === 'spike' ? null : target,
        vx: ux * sp,
        vy: uy * sp,
        speed: sp,
        dmg: stats.dmg,
        aoe: stats.aoe,
        slow: stats.slow,
        slowDur: stats.slowDur,
        pierce: stats.pierce,
        color: t.def.color,
        size: flavor === 'spike' ? 3.0 : 2.6,
      });
      // Muzzle flash
      spawnSpark(t.x + ux * 10, t.y + uy * 10, t.def.color, ux * 30, uy * 30);
      onFire && onFire(t.key);
      t.cooldown = stats.rate;
    }
  }
}

export function drawTowers(ctx, { selectedId = null } = {}) {
  for (const t of towers) {
    const stats = towerStats(t);

    // Pedestal — a thin ring under the tower body so it reads as "placed."
    ctx.save();
    ctx.shadowColor = t.def.color;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = rgba(t.def.color, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Body
    pathShape(ctx, t.def.shape, t.x, t.y, 6.2, t.angle);
    neon(ctx, {
      stroke: t.def.color,
      fill: 'auto',
      fillAlpha: 0.35,
      glow: 10,
      width: 1.6,
    });

    // Level pip(s)
    for (let i = 0; i < t.level; i++) {
      const px = t.x - 4 + i * 4;
      const py = t.y + 9;
      ctx.save();
      ctx.shadowColor = t.def.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (selectedId === t.id) {
      drawRangeCircle(ctx, t.x, t.y, stats.range, t.def.color);
    }
  }
}

// Build-ghost preview at a tile. Drawn under the cursor while a tower
// is being placed.
export function drawBuildGhost(ctx, key, col, row, valid) {
  const def = TOWERS[key];
  if (!def) return;
  const c = tileCenter(col, row);
  const stats = def.levels[0];
  drawRangeCircle(ctx, c.x, c.y, stats.range, valid ? def.color : '#ff3344');

  // Ghosted body
  ctx.save();
  ctx.globalAlpha = 0.65;
  pathShape(ctx, def.shape, c.x, c.y, 6.2);
  neon(ctx, {
    stroke: valid ? def.color : '#ff3344',
    fill: 'auto',
    fillAlpha: valid ? 0.25 : 0.18,
    glow: valid ? 10 : 6,
    width: 1.4,
  });
  ctx.restore();
}
