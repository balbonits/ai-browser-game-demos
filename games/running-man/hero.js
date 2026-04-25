// Hero state + sprite assets + per-frame update/render.
//
// The hero owns its own physical state (y / vy / animation timers) but
// does not own the game's state machine — the caller passes the current
// state enum to `drawHero` so it can pick the right sprite set.

import {
  HERO_GROUND_Y, HERO_X, HERO_W, HERO_H, HERO_FOOT_PAD, HITBOX,
  GRAVITY, JUMP_VY,
  RUN_FPS, JUMP_FPS, DEATH_FPS,
  STATE,
} from './config.js';
import { loadImage, loadFrames } from './assets.js';

export const hero = {
  y: HERO_GROUND_Y - HERO_H,
  vy: 0,
  animTime: 0,
  deathT: 0,
};

let frames = { run: [], jump: [], death: [], idle: null };

export async function loadHeroAssets() {
  const [run, jump, death, idle] = await Promise.all([
    loadFrames('characters/run', 8),
    loadFrames('characters/jump', 8),
    loadFrames('characters/death', 7),
    loadImage('characters/idle.png'),
  ]);
  frames = { run, jump, death, idle };
}

export function resetHero() {
  hero.y = HERO_GROUND_Y - HERO_H;
  hero.vy = 0;
  hero.animTime = 0;
  hero.deathT = 0;
}

export function heroOnGround() {
  return hero.y >= HERO_GROUND_Y - HERO_H - 0.5;
}

export function heroHitbox() {
  return {
    x: HERO_X + HITBOX.x,
    y: hero.y + HITBOX.y,
    w: HITBOX.w,
    h: HITBOX.h,
  };
}

// Returns true if a jump was initiated.
export function tryJump(gameState) {
  if (gameState !== STATE.RUNNING || !heroOnGround()) return false;
  hero.vy = JUMP_VY;
  hero.animTime = 0;
  return true;
}

// Variable jump: when the player releases the jump input mid-ascent, cap
// the remaining upward velocity. Tap = short hop, hold = full jump arc.
// Only takes effect while still climbing — does nothing once falling.
const MIN_JUMP_VY = -260;
export function cutJump() {
  if (hero.vy < MIN_JUMP_VY) hero.vy = MIN_JUMP_VY;
}

export function updateHeroRunning(dt) {
  hero.vy += GRAVITY * dt;
  hero.y += hero.vy * dt;
  if (hero.y > HERO_GROUND_Y - HERO_H) {
    hero.y = HERO_GROUND_Y - HERO_H;
    hero.vy = 0;
  }
  hero.animTime += dt;
}

export function updateHeroDying(dt) {
  hero.deathT += dt;
}

export function drawHero(ctx, gameState) {
  let img;
  if (gameState === STATE.INTRO) {
    img = frames.idle;
  } else if (gameState === STATE.DYING || gameState === STATE.DEAD) {
    const f = Math.min(frames.death.length - 1, Math.floor(hero.deathT * DEATH_FPS));
    img = frames.death[f];
  } else if (!heroOnGround()) {
    const f = Math.floor(hero.animTime * JUMP_FPS) % frames.jump.length;
    img = frames.jump[f];
  } else {
    const f = Math.floor(hero.animTime * RUN_FPS) % frames.run.length;
    img = frames.run[f];
  }
  if (img) {
    // Render the sprite 5 px bigger than the physics size and lift the
    // visible feet ~5 px above the physics ground line. The 80→85 upscale
    // also scales the sprite's internal foot-padding (20 → 21.25 px), so
    // the unscaled hero.y + HERO_FOOT_PAD anchor would land the feet
    // ~3.75 px BELOW ground at the new scale. We subtract 9 px here:
    // ~4 cancels that downward drift, the remaining 5 lifts the character.
    const drawW = HERO_W + 5;
    const drawH = HERO_H + 5;
    ctx.drawImage(
      img,
      Math.round(HERO_X),
      Math.round(hero.y + HERO_FOOT_PAD - 14),
      drawW,
      drawH,
    );
  }
}
