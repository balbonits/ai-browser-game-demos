// Unit tests for block-fps/gun.js — cooldown gating, damage constant, firing flag.
//
// buildGun()/tryFire() run against a minimal real THREE scene + camera (no
// renderer needed), so the production cooldown logic in gun.js is what's under
// test, not a re-implementation of it. gun.js keeps its cooldown in module
// state, so each test begins by "draining" it with a large-dt fire.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  buildGun, tryFire, maybeAutoFire, getGunDamage, setFiring, isFiring,
} from '../../../public/games/block-fps/gun.js';
import { GUN_DAMAGE, GUN_RATE, ENEMIES } from '../../../public/games/block-fps/config.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
scene.add(camera);
const targets = [];

// Large dt drives the module cooldown to <= 0, fires once, then leaves
// cooldown at exactly GUN_RATE: a known starting point for each test.
function primeCooldown() {
  const r = tryFire(scene, camera, targets, GUN_RATE * 100);
  expect(r.fired).toBe(true);
}

// ---------------------------------------------------------------------------
// Fire-rate gating — real tryFire()
// ---------------------------------------------------------------------------

describe('gun — fire-rate gating (real tryFire)', () => {
  beforeAll(() => {
    buildGun(camera);
  });

  beforeEach(() => {
    setFiring(false);
    primeCooldown();
  });

  it('cannot fire immediately after last shot (dt=0)', () => {
    expect(tryFire(scene, camera, targets, 0).fired).toBe(false);
  });

  it('cannot fire partway through the cooldown', () => {
    expect(tryFire(scene, camera, targets, GUN_RATE * 0.5).fired).toBe(false);
  });

  it('fires once accumulated dt reaches GUN_RATE', () => {
    expect(tryFire(scene, camera, targets, GUN_RATE * 0.5).fired).toBe(false);
    expect(tryFire(scene, camera, targets, GUN_RATE * 0.5).fired).toBe(true);
  });

  it('fires after a late input (dt well past GUN_RATE)', () => {
    expect(tryFire(scene, camera, targets, GUN_RATE * 2).fired).toBe(true);
  });

  it('a shot into empty space reports no enemy and no hit point', () => {
    const r = tryFire(scene, camera, targets, GUN_RATE * 2);
    expect(r).toMatchObject({ fired: true, enemy: null, point: null });
  });

  it('maybeAutoFire does not fire when the trigger is not held', () => {
    expect(maybeAutoFire(scene, camera, targets, GUN_RATE * 2, true).fired).toBe(false);
  });

  it('maybeAutoFire does not fire when not allowed, even if trigger held', () => {
    setFiring(true);
    expect(maybeAutoFire(scene, camera, targets, GUN_RATE * 2, false).fired).toBe(false);
  });

  it('maybeAutoFire fires when trigger held, allowed and cooldown elapsed', () => {
    setFiring(true);
    expect(maybeAutoFire(scene, camera, targets, GUN_RATE * 2, true).fired).toBe(true);
  });

  it('GUN_RATE is positive (cooldown > 0 enforces a minimum gap)', () => {
    expect(GUN_RATE).toBeGreaterThan(0);
  });

  it('fire rate is at least 5 RPS (GUN_RATE <= 0.2s)', () => {
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
