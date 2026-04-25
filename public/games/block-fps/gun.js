// Gun — polygonal viewmodel + raycast firing + recoil.
//
// The gun is a small composite of `BoxGeometry` parts parented to the
// camera so it stays glued to the view. Firing performs a raycast from
// the camera center through the scene; the first hit on an enemy mesh
// applies damage. Visuals: muzzle flash + tracer beam + a brief recoil
// kick on the gun group (translates back, returns).

import * as THREE from 'three';
import {
  COLORS, GUN_DAMAGE, GUN_RATE, GUN_SPREAD, ARENA_HALF, FOG_FAR,
} from './config.js';
import {
  spawnTracer, spawnSparks, attachMuzzleFlash, fireMuzzleFlash,
} from './world.js';

let gunGroup = null;        // The composite mesh, parented to camera.
let muzzleAnchor = null;    // Empty Object3D at the barrel tip (world-space lookup).
let recoilT = 0;            // Cooldown timer for current recoil animation.
let cooldown = 0;           // Time until next shot is allowed.

const RECOIL_DUR = 0.07;
const RECOIL_KICK = 0.08;

// Build the polygonal gun. All pieces are simple boxes; orientation is
// "muzzle along -Z, top of receiver toward +Y". The whole assembly is
// shifted right + down a touch so it lives in the lower-right quadrant
// of the viewport. Outlines drawn via EdgesGeometry give the
// hard-shadow polygonal look the user asked for.
export function buildGun(camera) {
  if (gunGroup) return gunGroup;
  gunGroup = new THREE.Group();
  gunGroup.position.set(0.22, -0.22, -0.55);
  gunGroup.rotation.y = -0.04; // tiny inward cant so the gun feels held
  camera.add(gunGroup);

  const bodyMat   = new THREE.MeshLambertMaterial({ color: COLORS.gunBody });
  const accentMat = new THREE.MeshBasicMaterial({ color: COLORS.gunAccent });
  const gripMat   = new THREE.MeshLambertMaterial({ color: COLORS.gunGrip });
  const sightMat  = new THREE.MeshBasicMaterial({ color: COLORS.gunSight });

  const edgeMat = new THREE.LineBasicMaterial({
    color: COLORS.gunAccent, transparent: true, opacity: 0.75,
  });

  // Helper: create a box mesh + edges, parent to gunGroup, apply position.
  function part(w, h, d, x, y, z, mat = bodyMat, edge = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    gunGroup.add(m);
    if (edge) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      e.position.copy(m.position);
      gunGroup.add(e);
    }
    return m;
  }

  // Receiver / slide (main body).
  part(0.10, 0.10, 0.32, 0, 0, -0.04);
  // Barrel — narrower, sticks out the front.
  part(0.05, 0.05, 0.20, 0, 0.005, -0.20);
  // Top accent rail (cyan bright)
  part(0.04, 0.012, 0.30, 0, 0.060, -0.04, accentMat, false);
  // Iron sight at the rear (small red cube)
  part(0.018, 0.020, 0.018, 0, 0.080, 0.06, sightMat, false);
  // Front sight (small red cube)
  part(0.018, 0.020, 0.018, 0, 0.045, -0.28, sightMat, false);
  // Trigger guard (a flat plate)
  part(0.05, 0.020, 0.07, 0, -0.060, 0.02);
  // Grip — angled box behind the receiver, tilted forward a hair.
  const gripGeo = new THREE.BoxGeometry(0.045, 0.16, 0.06);
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.rotation.x = -0.20;
  grip.position.set(0, -0.12, 0.06);
  gunGroup.add(grip);
  const gripEdges = new THREE.LineSegments(new THREE.EdgesGeometry(gripGeo), edgeMat);
  gripEdges.rotation.copy(grip.rotation);
  gripEdges.position.copy(grip.position);
  gunGroup.add(gripEdges);

  // Magazine — tiny extension under the grip.
  const magGeo = new THREE.BoxGeometry(0.04, 0.05, 0.05);
  const mag = new THREE.Mesh(magGeo, accentMat);
  mag.rotation.x = -0.20;
  mag.position.set(0, -0.21, 0.082);
  gunGroup.add(mag);

  // Muzzle flash anchor (where flashes / tracers originate).
  muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0.005, -0.32); // tip of barrel
  gunGroup.add(muzzleAnchor);
  attachMuzzleFlash(muzzleAnchor);

  return gunGroup;
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2(0, 0); // center of screen
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

// Try to fire the gun. Always returns a result object so the caller can
// distinguish "didn't fire" (cooldown gated) from "fired but missed":
//   { fired: bool, enemy: Enemy|null, point: Vector3|null }
//
// `targets` — an array of Mesh objects (enemies + walls/pillars). The gun
// raycasts against all of them; the closest hit on an enemy mesh resolves
// to a damage event, but obstacle hits truncate the tracer end-point so
// bullets never appear to travel through walls.
export function tryFire(scene, camera, targets, dt) {
  cooldown -= dt;
  if (cooldown > 0) return { fired: false, enemy: null, point: null };
  cooldown = GUN_RATE;
  return fireNow(scene, camera, targets);
}

function fireNow(scene, camera, targets) {
  // Tiny random spread for organic feel.
  const sx = (Math.random() - 0.5) * GUN_SPREAD;
  const sy = (Math.random() - 0.5) * GUN_SPREAD;
  _ndc.set(sx, sy);
  _raycaster.setFromCamera(_ndc, camera);

  const hits = _raycaster.intersectObjects(targets, false);
  let hit = null;
  if (hits.length > 0) hit = hits[0];

  // World-space muzzle position (start of tracer).
  muzzleAnchor.getWorldPosition(_from);

  // Where the tracer ends — at the hit point, or far along the ray.
  if (hit) {
    _to.copy(hit.point);
  } else {
    camera.getWorldDirection(_dir);
    _to.copy(_from).add(_dir.multiplyScalar(FOG_FAR));
  }

  spawnTracer(scene, _from, _to);
  fireMuzzleFlash();
  triggerRecoil();

  if (hit && hit.object && hit.object.userData && hit.object.userData.kind === 'enemy') {
    spawnSparks(scene, hit.point, hit.object.userData.color || 0xffffff, 6, 6, 0.4);
    return { fired: true, enemy: hit.object.userData.enemy, point: hit.point };
  } else if (hit) {
    // Wall / pillar hit — small dust spark, no damage.
    spawnSparks(scene, hit.point, COLORS.accent, 3, 3, 0.25);
  }
  return { fired: true, enemy: null, point: null };
}

function triggerRecoil() {
  recoilT = RECOIL_DUR;
}

export function updateGun(dt) {
  if (!gunGroup) return;
  if (recoilT > 0) {
    recoilT -= dt;
    const t = Math.max(0, recoilT) / RECOIL_DUR; // 1 → 0 over duration
    // Pull back along Z, ease back to rest.
    gunGroup.position.z = -0.55 + RECOIL_KICK * t;
    // Tiny upward muzzle climb.
    gunGroup.rotation.x = -0.18 * t;
  } else {
    gunGroup.position.z = -0.55;
    gunGroup.rotation.x = 0;
  }
}

// Allow holding-the-button autofire. Caller sends true while down.
let firing = false;
export function setFiring(on) { firing = !!on; }
export function isFiring() { return firing; }

// Convenience used by main update — only fires when input is held AND
// pointer is locked AND game is in playing state. Caller passes the
// scene + camera + active enemy mesh list each frame.
export function maybeAutoFire(scene, camera, targets, dt, allowed) {
  if (!allowed || !firing) {
    cooldown -= dt;
    if (cooldown < 0) cooldown = 0;
    return { fired: false, enemy: null, point: null };
  }
  return tryFire(scene, camera, targets, dt);
}

export function getGunDamage() { return GUN_DAMAGE; }
