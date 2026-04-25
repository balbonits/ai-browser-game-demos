// Player — camera, FPS look, movement, health.
//
// PointerLockControls handles mouse-look (yaw on the camera Object3D and
// pitch on its parent). Movement is computed locally: WASD vector
// projected onto the camera's forward/right (yaw-only) axes, with
// acceleration + friction integration so it feels less robotic than
// instant velocity changes.

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
  PLAYER_HP, PLAYER_SPEED, PLAYER_ACCEL, PLAYER_FRICTION, PLAYER_RADIUS,
  PLAYER_EYE, ARENA_HALF, HIT_INVULN, TMP_VEC, TMP_VEC2,
} from './config.js';

export const player = {
  hp: PLAYER_HP,
  maxHp: PLAYER_HP,
  velocity: new THREE.Vector3(),
  alive: true,
  invulnT: 0,
};

const keys = { w: false, a: false, s: false, d: false, shift: false };

let camera = null;
let controls = null;
let domTarget = null;

export function createCamera(aspect) {
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 200);
  camera.position.set(0, PLAYER_EYE, 0);
  return camera;
}

export function createControls(cam, dom) {
  domTarget = dom;
  controls = new PointerLockControls(cam, dom);
  return controls;
}

export function getControls() { return controls; }
export function getCamera() { return camera; }

// Reset state for a new run.
export function resetPlayer() {
  player.hp = PLAYER_HP;
  player.alive = true;
  player.invulnT = 0;
  player.velocity.set(0, 0, 0);
  if (camera) camera.position.set(0, PLAYER_EYE, 0);
}

// Public input helpers — called by main.js's keyboard listener so we
// can centralize edge-cases (e.g. don't accept input when paused).
export function setKey(code, pressed) {
  switch (code) {
    case 'KeyW': case 'ArrowUp':    keys.w = pressed; break;
    case 'KeyS': case 'ArrowDown':  keys.s = pressed; break;
    case 'KeyA': case 'ArrowLeft':  keys.a = pressed; break;
    case 'KeyD': case 'ArrowRight': keys.d = pressed; break;
    case 'ShiftLeft': case 'ShiftRight': keys.shift = pressed; break;
  }
}

export function clearKeys() {
  keys.w = keys.a = keys.s = keys.d = keys.shift = false;
}

// Per-frame update. `obstacles` is a list of AABBs ({minX, maxX, minZ, maxZ})
// from world.js used for player↔arena collision.
export function updatePlayer(dt, obstacles) {
  if (!player.alive) return;
  if (player.invulnT > 0) player.invulnT -= dt;

  // Build forward + right vectors from the camera (yaw only — we don't
  // want pitch to make WASD lift the player off the ground).
  TMP_VEC.set(0, 0, 0);
  if (camera) camera.getWorldDirection(TMP_VEC);
  TMP_VEC.y = 0;
  TMP_VEC.normalize();
  TMP_VEC2.crossVectors(TMP_VEC, camera.up).normalize(); // right vector

  // Desired direction
  let dx = 0, dz = 0;
  if (keys.w) { dx += TMP_VEC.x; dz += TMP_VEC.z; }
  if (keys.s) { dx -= TMP_VEC.x; dz -= TMP_VEC.z; }
  if (keys.d) { dx += TMP_VEC2.x; dz += TMP_VEC2.z; }
  if (keys.a) { dx -= TMP_VEC2.x; dz -= TMP_VEC2.z; }

  const len = Math.hypot(dx, dz);
  if (len > 0.0001) { dx /= len; dz /= len; }

  // Accelerate toward desired direction; friction toward zero otherwise.
  const targetSpeed = (keys.shift ? PLAYER_SPEED * 0.5 : PLAYER_SPEED);
  const wantVx = dx * targetSpeed;
  const wantVz = dz * targetSpeed;

  if (len > 0) {
    player.velocity.x = approach(player.velocity.x, wantVx, PLAYER_ACCEL * dt);
    player.velocity.z = approach(player.velocity.z, wantVz, PLAYER_ACCEL * dt);
  } else {
    player.velocity.x = approach(player.velocity.x, 0, PLAYER_FRICTION * dt);
    player.velocity.z = approach(player.velocity.z, 0, PLAYER_FRICTION * dt);
  }

  // Integrate position with axis-by-axis collision so we slide along
  // walls instead of getting stuck.
  let nx = camera.position.x + player.velocity.x * dt;
  let nz = camera.position.z + player.velocity.z * dt;

  // Arena bounds
  const limit = ARENA_HALF - PLAYER_RADIUS - 0.1;
  if (nx > limit) { nx = limit; player.velocity.x = 0; }
  if (nx < -limit) { nx = -limit; player.velocity.x = 0; }
  if (nz > limit) { nz = limit; player.velocity.z = 0; }
  if (nz < -limit) { nz = -limit; player.velocity.z = 0; }

  // Obstacle AABBs — try X then Z separately for sliding behavior.
  for (const o of obstacles) {
    if (intersectsAabb(nx, camera.position.z, o)) {
      // Resolve along X. Push out by smaller of the two overlaps.
      if (player.velocity.x > 0) nx = o.minX - PLAYER_RADIUS - 0.001;
      else if (player.velocity.x < 0) nx = o.maxX + PLAYER_RADIUS + 0.001;
      player.velocity.x = 0;
    }
  }
  for (const o of obstacles) {
    if (intersectsAabb(nx, nz, o)) {
      if (player.velocity.z > 0) nz = o.minZ - PLAYER_RADIUS - 0.001;
      else if (player.velocity.z < 0) nz = o.maxZ + PLAYER_RADIUS + 0.001;
      player.velocity.z = 0;
    }
  }

  camera.position.x = nx;
  camera.position.z = nz;
  camera.position.y = PLAYER_EYE;
}

function approach(cur, target, step) {
  if (cur < target) return Math.min(cur + step, target);
  if (cur > target) return Math.max(cur - step, target);
  return cur;
}

function intersectsAabb(px, pz, o) {
  return (
    px + PLAYER_RADIUS > o.minX &&
    px - PLAYER_RADIUS < o.maxX &&
    pz + PLAYER_RADIUS > o.minZ &&
    pz - PLAYER_RADIUS < o.maxZ
  );
}

// Apply damage to the player. Returns true if the hit "landed" (i.e.
// the player wasn't in i-frames). The caller plays the hit SFX based
// on the return so we don't spam during contact.
export function damagePlayer(amount) {
  if (!player.alive || player.invulnT > 0) return false;
  player.hp -= amount;
  player.invulnT = HIT_INVULN;
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
  }
  return true;
}
