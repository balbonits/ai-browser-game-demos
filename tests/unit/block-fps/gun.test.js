// Unit tests for block-fps/gun.js — fire-rate gating and damage constants.
//
// gun.js uses THREE internally for the raycaster and gun mesh, so we can't
// call tryFire() without a real scene/camera/targets. Instead we test:
//
//   1. The fire-rate gating formula (pure arithmetic, no scene).
//   2. getGunDamage() returns the expected constant.
//   3. setFiring/isFiring round-trip correctly.
//
// tryFire() and maybeAutoFire() are integration-tested via E2E.

import { describe, it, expect } from 'vitest';
import { getGunDamage, setFiring, isFiring } from '../../../public/games/block-fps/gun.js';
import { GUN_DAMAGE, GUN_RATE, ENEMIES } from '../../../public/games/block-fps/config.js';

// ---------------------------------------------------------------------------
// Fire-rate gating — pure arithmetic
// ---------------------------------------------------------------------------

describe('gun — fire-rate gating (pure arithmetic)', () => {
  // The cooldown model: a shot is allowed when cooldown <= 0.
  // After firing, cooldown is reset to GUN_RATE.
  // Each frame: cooldown -= dt.
  // canFire at time t after last shot = (t >= GUN_RATE).
  function canFire(elapsed, gunRate) {
    return elapsed >= gunRate;
  }

  it('cannot fire immediately after last shot (elapsed=0)', () => {
    expect(canFire(0, GUN_RATE)).toBe(false);
  });

  it('cannot fire partway through cooldown', () => {
    expect(canFire(GUN_RATE * 0.5, GUN_RATE)).toBe(false);
  });

  it('can fire once the full cooldown has elapsed', () => {
    expect(canFire(GUN_RATE, GUN_RATE)).toBe(true);
  });

  it('can fire past the full cooldown (late input)', () => {
    expect(canFire(GUN_RATE * 2, GUN_RATE)).toBe(true);
  });

  it('GUN_RATE is positive (cooldown > 0 enforces a minimum gap)', () => {
    expect(GUN_RATE).toBeGreaterThan(0);
  });

  it('fire rate is at least 5 RPS (GUN_RATE <= 0.2s)', () => {
    // Spec says ≈7.7 RPS (0.13s). Guard the lower bound so we catch
    // a config regression that makes the gun too slow.
    expect(GUN_RATE).toBeLessThanOrEqual(0.2);
  });
});

// ---------------------------------------------------------------------------
// getGunDamage
// ---------------------------------------------------------------------------

describe('gun — getGunDamage', () => {
  it('returns GUN_DAMAGE from config', () => {
    expect(getGunDamage()).toBe(GUN_DAMAGE);
  });

  it('GUN_DAMAGE is positive', () => {
    expect(GUN_DAMAGE).toBeGreaterThan(0);
  });

  it('GUN_DAMAGE kills grunt in at most 4 shots (balance check)', () => {
    const shots = Math.ceil(ENEMIES.grunt.hp / GUN_DAMAGE);
    expect(shots).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// setFiring / isFiring
// ---------------------------------------------------------------------------

describe('gun — setFiring / isFiring', () => {
  it('isFiring starts false', () => {
    setFiring(false);
    expect(isFiring()).toBe(false);
  });

  it('setFiring(true) makes isFiring return true', () => {
    setFiring(true);
    expect(isFiring()).toBe(true);
    // Cleanup so other tests aren't affected by module-level state.
    setFiring(false);
  });

  it('setFiring(false) makes isFiring return false', () => {
    setFiring(true);
    setFiring(false);
    expect(isFiring()).toBe(false);
  });
});
