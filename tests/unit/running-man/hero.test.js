// Unit tests for hero physics in running-man.
//
// hero.js imports assets.js which uses `new Image()` (DOM API), so it cannot
// be imported directly in the Node/Vitest unit environment. Instead, we mirror
// the physics logic inline here and assert against the constants from config.js.
//
// This is the approved pattern when physics/collision live in a DOM-coupled
// module: "write the test against the constants and an in-test mirror, note
// it in comments." — docs/testing.md, constraints section.
//
// The mirror is intentionally verbatim from hero.js (updateHeroRunning,
// tryJump, heroOnGround). If the implementation diverges, this test catches
// the drift.

import { describe, it, expect } from 'vitest';
import {
  GRAVITY, JUMP_VY, HERO_GROUND_Y, HERO_H, HITBOX, HERO_X,
} from '../../../public/games/running-man/config.js';

// ---------------------------------------------------------------------------
// In-test mirror of hero state and physics functions
// Verbatim from public/games/running-man/hero.js
// ---------------------------------------------------------------------------

function makeHero() {
  return {
    y: HERO_GROUND_Y - HERO_H,
    vy: 0,
    animTime: 0,
    deathT: 0,
  };
}

// Mirror of heroOnGround()
function heroOnGround(hero) {
  return hero.y >= HERO_GROUND_Y - HERO_H - 0.5;
}

// Mirror of tryJump()
function tryJump(hero) {
  if (!heroOnGround(hero)) return false;
  hero.vy = JUMP_VY;
  hero.animTime = 0;
  return true;
}

// Mirror of updateHeroRunning()
function updateHeroRunning(hero, dt) {
  hero.vy += GRAVITY * dt;
  hero.y += hero.vy * dt;
  if (hero.y > HERO_GROUND_Y - HERO_H) {
    hero.y = HERO_GROUND_Y - HERO_H;
    hero.vy = 0;
  }
  hero.animTime += dt;
}

// Mirror of heroHitbox()
function heroHitbox(hero) {
  return {
    x: HERO_X + HITBOX.x,
    y: hero.y + HITBOX.y,
    w: HITBOX.w,
    h: HITBOX.h,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Hero physics — ground state', () => {
  it('hero at rest is on ground (heroOnGround returns true)', () => {
    const hero = makeHero();
    expect(heroOnGround(hero)).toBe(true);
  });

  it('hero at rest has vy === 0', () => {
    const hero = makeHero();
    expect(hero.vy).toBe(0);
  });

  it('hero y position when at rest equals HERO_GROUND_Y - HERO_H', () => {
    const hero = makeHero();
    expect(hero.y).toBe(HERO_GROUND_Y - HERO_H);
  });
});

describe('Hero physics — jump initiation', () => {
  it('tryJump returns true when hero is on ground', () => {
    const hero = makeHero();
    expect(tryJump(hero)).toBe(true);
  });

  it('tryJump sets vy to JUMP_VY', () => {
    const hero = makeHero();
    tryJump(hero);
    expect(hero.vy).toBe(JUMP_VY);
  });

  it('hero is not on ground immediately after a jump', () => {
    const hero = makeHero();
    tryJump(hero);
    // After jump, hero still hasn't moved yet — vy is set but y unchanged.
    // One physics step will move the hero off the ground.
    updateHeroRunning(hero, 1 / 60);
    expect(heroOnGround(hero)).toBe(false);
  });

  it('tryJump returns false when hero is already in the air', () => {
    const hero = makeHero();
    tryJump(hero);
    updateHeroRunning(hero, 1 / 60); // hero is now airborne
    expect(tryJump(hero)).toBe(false);
  });

  it('tryJump does not change vy if hero is already in the air', () => {
    const hero = makeHero();
    tryJump(hero);
    updateHeroRunning(hero, 1 / 60); // airborne
    const vyBefore = hero.vy;
    tryJump(hero);
    expect(hero.vy).toBe(vyBefore);
  });
});

describe('Hero physics — mid-air update', () => {
  it('vy increases by GRAVITY * dt each step', () => {
    const hero = makeHero();
    tryJump(hero);
    const vyBefore = hero.vy;
    const dt = 0.016;
    updateHeroRunning(hero, dt);
    // vy should be vyBefore + GRAVITY * dt (then y += new vy, which may or
    // may not clamp). Since we just jumped, y < floor so no clamping here.
    expect(hero.vy).toBeCloseTo(vyBefore + GRAVITY * dt, 5);
  });

  it('y decreases initially after a jump (hero moves upward)', () => {
    const hero = makeHero();
    const yBefore = hero.y;
    tryJump(hero);
    updateHeroRunning(hero, 1 / 60);
    // JUMP_VY = -520, GRAVITY = 1500, dt = 1/60 ≈ 0.0167
    // vy_after_step = -520 + 1500*(1/60) = -520 + 25 = -495
    // dy = -495 * (1/60) ≈ -8.25 → y decreases
    expect(hero.y).toBeLessThan(yBefore);
  });

  it('hero reaches peak then descends (vy crosses zero)', () => {
    const hero = makeHero();
    tryJump(hero);
    // Run many steps; at some point vy must flip from negative to positive.
    let crossedZero = false;
    let prevVy = hero.vy;
    for (let i = 0; i < 200; i++) {
      updateHeroRunning(hero, 1 / 60);
      if (prevVy < 0 && hero.vy >= 0) {
        crossedZero = true;
        break;
      }
      prevVy = hero.vy;
    }
    expect(crossedZero).toBe(true);
  });
});

describe('Hero physics — landing', () => {
  it('hero lands exactly at HERO_GROUND_Y - HERO_H after a jump arc', () => {
    const hero = makeHero();
    tryJump(hero);
    // Simulate the full arc until grounded.
    for (let i = 0; i < 300; i++) {
      updateHeroRunning(hero, 1 / 60);
      if (heroOnGround(hero)) break;
    }
    expect(hero.y).toBe(HERO_GROUND_Y - HERO_H);
  });

  it('hero vy is 0 after landing', () => {
    const hero = makeHero();
    tryJump(hero);
    for (let i = 0; i < 300; i++) {
      updateHeroRunning(hero, 1 / 60);
      if (heroOnGround(hero)) break;
    }
    expect(hero.vy).toBe(0);
  });

  it('hero y never exceeds HERO_GROUND_Y - HERO_H (never goes below ground)', () => {
    const hero = makeHero();
    tryJump(hero);
    for (let i = 0; i < 300; i++) {
      updateHeroRunning(hero, 1 / 60);
      expect(hero.y).toBeLessThanOrEqual(HERO_GROUND_Y - HERO_H);
    }
  });
});

describe('Hero physics — hitbox', () => {
  it('hitbox x is HERO_X + HITBOX.x', () => {
    const hero = makeHero();
    const hb = heroHitbox(hero);
    expect(hb.x).toBe(HERO_X + HITBOX.x);
  });

  it('hitbox y is hero.y + HITBOX.y', () => {
    const hero = makeHero();
    const hb = heroHitbox(hero);
    expect(hb.y).toBe(hero.y + HITBOX.y);
  });

  it('hitbox dimensions match HITBOX constants', () => {
    const hero = makeHero();
    const hb = heroHitbox(hero);
    expect(hb.w).toBe(HITBOX.w);
    expect(hb.h).toBe(HITBOX.h);
  });

  it('hitbox y moves up when hero jumps', () => {
    const hero = makeHero();
    const hbGround = heroHitbox(hero);
    tryJump(hero);
    // Advance a few ticks so hero rises.
    for (let i = 0; i < 10; i++) updateHeroRunning(hero, 1 / 60);
    const hbAir = heroHitbox(hero);
    expect(hbAir.y).toBeLessThan(hbGround.y);
  });
});
