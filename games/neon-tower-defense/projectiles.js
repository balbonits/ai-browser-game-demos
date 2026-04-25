// Projectiles — bullets fired by towers. Two flavors:
//   - 'bolt'   : fast homing-ish projectile (single target, 0 AoE)
//   - 'pulse'  : slower projectile, splash damage on impact
//   - 'spike'  : very fast linear shot, can pierce N enemies
//
// Each projectile has a fixed flavor + the tower's level stats baked in
// at fire time, so subsequent tower upgrades don't retroactively affect
// in-flight shots.

import { applySlow, damage, findInAoe } from './enemies.js';
import { pathCircle, pathShape, neon, rgba, spawnBurst, spawnSpark } from './render.js';

export const projectiles = [];

export function resetProjectiles() {
  projectiles.length = 0;
}

export function fireProjectile({
  flavor,    // 'bolt' | 'pulse' | 'spike'
  x, y,      // origin (tower center)
  target,    // enemy reference (homing) — required for bolt/pulse
  vx, vy,    // initial velocity (used by spike for linear path)
  speed,
  dmg,
  aoe = 0,
  slow = 0,
  slowDur = 0,
  pierce = 1,
  color,
  size = 2.5,
}) {
  projectiles.push({
    flavor,
    x, y,
    vx: vx ?? 0, vy: vy ?? 0,
    speed,
    target,
    dmg,
    aoe,
    slow, slowDur,
    pierce,
    color,
    size,
    life: 2.5,
    hits: new Set(),    // enemy ids already hit (for pierce)
  });
}

export function updateProjectiles(dt, onKill) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    if (p.life <= 0) { projectiles.splice(i, 1); continue; }

    // Movement
    if (p.flavor === 'spike') {
      // Linear flight.
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else {
      // Homing toward target. If target is gone or dead, fall back to
      // straight-line on the last vector and let it expire.
      if (p.target && !p.target.dead && !p.target.leaked) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 1) { hitTarget(p, p.target, onKill); projectiles.splice(i, 1); continue; }
        const ux = dx / d, uy = dy / d;
        p.vx = ux * p.speed;
        p.vy = uy * p.speed;
        const step = p.speed * dt;
        if (step >= d) {
          // Will overshoot this frame — resolve hit at the target.
          hitTarget(p, p.target, onKill);
          projectiles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        // Target lost — keep flying along the last vector and expire.
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    // For 'spike', collide along the way with any enemy in radius.
    if (p.flavor === 'spike') {
      const candidates = findInAoe(p.x, p.y, p.size + 6);
      for (const e of candidates) {
        if (p.hits.has(e.id)) continue;
        hitTarget(p, e, onKill);
        if (p.hits.size >= p.pierce) break;
      }
      if (p.hits.size >= p.pierce) {
        projectiles.splice(i, 1);
        continue;
      }
      // Off-screen guard
      if (p.x < -20 || p.x > 500 || p.y < -20 || p.y > 290) {
        projectiles.splice(i, 1);
        continue;
      }
    }
  }
}

function hitTarget(p, enemy, onKill) {
  if (p.hits.has(enemy.id)) return;
  if (enemy.dead || enemy.leaked) return;
  p.hits.add(enemy.id);

  // Direct damage to the primary target. damage() returns true ONLY on
  // the fatal hit, so we only fire onKill / death burst once per enemy.
  const killed = damage(enemy, p.dmg);
  if (p.slow > 0) applySlow(enemy, p.slow, p.slowDur);

  spawnSpark(enemy.x, enemy.y, p.color);
  if (killed) {
    onKill && onKill(enemy);
    spawnBurst(enemy.x, enemy.y, enemy.def.color, 12, 110, 0.5, 1.4);
  }

  // Splash damage for pulse projectiles.
  if (p.aoe > 0) {
    const inAoe = findInAoe(enemy.x, enemy.y, p.aoe);
    spawnBurst(enemy.x, enemy.y, p.color, 8, 90, 0.4, 1.3);
    for (const o of inAoe) {
      if (o === enemy || o.dead || o.leaked) continue;
      const k = damage(o, p.dmg * 0.7);
      if (p.slow > 0) applySlow(o, p.slow * 0.8, p.slowDur * 0.8);
      if (k) {
        onKill && onKill(o);
        spawnBurst(o.x, o.y, o.def.color, 10, 100, 0.45, 1.3);
      }
    }
  }
}

export function drawProjectiles(ctx) {
  for (const p of projectiles) {
    if (p.flavor === 'pulse') {
      // Square missile, rotates with travel direction.
      const ang = Math.atan2(p.vy, p.vx);
      pathShape(ctx, 'square', p.x, p.y, p.size + 0.6, ang);
      neon(ctx, { stroke: p.color, fill: 'auto', fillAlpha: 0.45, glow: 12, width: 1.6 });
    } else if (p.flavor === 'spike') {
      const ang = Math.atan2(p.vy, p.vx);
      pathShape(ctx, 'diamond', p.x, p.y, p.size + 1, ang);
      neon(ctx, { stroke: p.color, fill: 'auto', fillAlpha: 0.6, glow: 14, width: 1.6 });
    } else {
      // bolt — small triangle pointed in direction of travel
      const ang = Math.atan2(p.vy, p.vx);
      pathShape(ctx, 'triangle', p.x, p.y, p.size + 0.5, ang);
      neon(ctx, { stroke: p.color, fill: 'auto', fillAlpha: 0.5, glow: 10, width: 1.2 });
    }
  }
}
