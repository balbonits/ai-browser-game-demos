// Enemies — path-following entities with HP and a body shape.
//
// An enemy stores its progress (a scalar 0..PATH_LEN) along the path,
// remaining HP, current speed (which can be temporarily reduced by a
// slow effect), and the cached source ENEMIES entry. The position+angle
// is looked up from `pointAt(progress)` each frame.

import { ENEMIES } from './config.js';
import { pointAt, PATH_LEN } from './map.js';
import { pathShape, neon, drawHpBar, rgba, spawnBurst } from './render.js';

export const enemies = [];

let _nextId = 1;

export function spawnEnemy(kind) {
  const def = ENEMIES[kind];
  if (!def) return null;
  const e = {
    id: _nextId++,
    kind,
    def,
    progress: 0,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    slowT: 0,         // remaining slow duration
    slowFrac: 0,      // current slow fraction (0..1)
    x: 0, y: 0, a: 0,
    dead: false,
    leaked: false,    // true if it walked off the end
    spinT: 0,         // for body rotation animation
  };
  // Initialize position at the start of the path.
  const p = pointAt(0);
  e.x = p.x; e.y = p.y; e.a = p.a;
  enemies.push(e);
  return e;
}

export function resetEnemies() {
  enemies.length = 0;
}

export function updateEnemies(dt, onLeak, onKill) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // Dead/leaked enemies were flagged elsewhere (damage() / leak path).
    // Splice them out here so we keep the array clean for the rest of
    // the frame; the kill/leak callbacks already fired at flag time.
    if (e.dead || e.leaked) {
      enemies.splice(i, 1);
      continue;
    }

    // Slow timer
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) {
        e.slowT = 0;
        e.slowFrac = 0;
      }
    }

    const speed = e.def.speed * (1 - e.slowFrac);
    e.progress += speed * dt;
    e.spinT += dt;

    if (e.progress >= PATH_LEN) {
      e.leaked = true;
      onLeak && onLeak(e);
      enemies.splice(i, 1);
      continue;
    }

    const p = pointAt(e.progress);
    e.x = p.x;
    e.y = p.y;
    e.a = p.a;
  }
}

export function drawEnemies(ctx) {
  for (const e of enemies) {
    const def = e.def;
    // Body — rotates a bit so squares/triangles read as moving.
    const spinSpeed = def.shape === 'square' ? 1.5
                    : def.shape === 'triangle' ? 0
                    : def.shape === 'hex' ? 0.8
                    : 0.4;
    const ang = def.shape === 'triangle' ? e.a : e.spinT * spinSpeed;
    pathShape(ctx, def.shape, e.x, e.y, def.size, ang);
    neon(ctx, {
      stroke: def.color,
      fill: 'auto',
      fillAlpha: 0.30,
      glow: 10,
      width: 1.4,
    });

    // HP bar — only when below max, or always for the boss (so the
    // player can pace damage).
    if (e.hp < e.maxHp || e.kind === 'boss') {
      drawHpBar(ctx, e.x, e.y - def.size - 4, def.size * 2 + 4, e.hp / e.maxHp, def.color);
    }

    // Slow halo
    if (e.slowFrac > 0) {
      ctx.save();
      ctx.shadowColor = '#7af0ff';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = rgba('#7af0ff', 0.35);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, def.size + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Damage helper used by projectiles. Returns true ONLY for the fatal
// hit — the one that transitioned hp from > 0 to <= 0. Subsequent hits
// on an already-dead enemy return false, so kill-credit / death effects
// don't double-fire from splash damage or pierce.
export function damage(enemy, amount) {
  if (enemy.dead || enemy.leaked || enemy.hp <= 0) return false;
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    enemy.dead = true;
    return true;
  }
  return false;
}

export function applySlow(enemy, frac, dur) {
  // Take the strongest slow currently in flight.
  if (frac > enemy.slowFrac) {
    enemy.slowFrac = frac;
    enemy.slowT = dur;
  } else if (enemy.slowT < dur) {
    enemy.slowT = dur;
  }
}

// Find the enemy "first" along the path within (cx, cy, range). Returns
// null if nothing is in range. "First" means closest to PATH_LEN
// (closest to escaping) — the standard TD priority.
export function findFirstInRange(cx, cy, range) {
  let best = null;
  let bestProg = -Infinity;
  const r2 = range * range;
  for (const e of enemies) {
    if (e.dead || e.leaked) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy > r2) continue;
    if (e.progress > bestProg) {
      bestProg = e.progress;
      best = e;
    }
  }
  return best;
}

// Find all enemies inside an AoE radius around (cx, cy). Skips dead
// enemies that haven't yet been spliced from the array.
export function findInAoe(cx, cy, radius) {
  const r2 = radius * radius;
  const out = [];
  for (const e of enemies) {
    if (e.dead || e.leaked) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy <= r2) out.push(e);
  }
  return out;
}
