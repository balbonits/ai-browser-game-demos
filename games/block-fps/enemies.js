// Enemies — block adversaries that spawn at arena edges, chase the
// player, deal contact damage, and explode into sparks on death.
//
// Each enemy is a Three.js Mesh with userData linking back to its
// game-state record so a raycast hit can resolve to "the enemy" cheaply.

import * as THREE from 'three';
import {
  ENEMIES, COLORS, ARENA_HALF, FLOOR_Y, PLAYER_RADIUS, TMP_VEC, TMP_VEC2,
} from './config.js';
import { spawnSparks } from './world.js';

export const enemies = [];          // game-state records
export const enemyMeshes = [];      // raycast targets (kept in lockstep with enemies)

let scene = null;
let _nextId = 1;

export function setScene(s) { scene = s; }

export function resetEnemies() {
  for (const e of enemies) {
    scene.remove(e.mesh);
    if (e.edges) scene.remove(e.edges);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
    if (e.edges) e.edges.geometry.dispose();
  }
  enemies.length = 0;
  enemyMeshes.length = 0;
}

// Spawn at a random position along the arena perimeter so the player
// can be flanked from any direction. `mul` lets endless mode scale HP.
export function spawnEnemy(kind, mul = null) {
  const def = ENEMIES[kind];
  if (!def) return null;
  const hpMul = (mul && mul.hp) || 1;
  const hp = Math.max(1, Math.round(def.hp * hpMul));
  const size = def.size;

  // Edge-spawn around the arena perimeter, just inside the wall line.
  const margin = 1.2;
  const pickEdge = Math.floor(Math.random() * 4);
  let x, z;
  const lim = ARENA_HALF - margin;
  switch (pickEdge) {
    case 0: x = -lim;                       z = (Math.random() * 2 - 1) * lim; break;
    case 1: x =  lim;                       z = (Math.random() * 2 - 1) * lim; break;
    case 2: z = -lim;                       x = (Math.random() * 2 - 1) * lim; break;
    default: z =  lim;                      x = (Math.random() * 2 - 1) * lim; break;
  }

  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshLambertMaterial({ color: def.color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, FLOOR_Y + size / 2, z);
  scene.add(mesh);

  // Outline for the polygonal-neon look — picks the body color so
  // each enemy reads as glowing in its kind's hue.
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.85 });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  scene.add(edges);

  const e = {
    id: _nextId++,
    kind,
    def,
    mesh,
    edges,
    hp,
    maxHp: hp,
    speed: def.speed,
    spinT: 0,
    contactT: 0,        // time since last contact damage
    dead: false,
  };
  // Backlink so a raycast hit on the mesh can find the entity.
  mesh.userData.enemy = e;
  mesh.userData.kind = 'enemy';
  mesh.userData.color = def.color;

  enemies.push(e);
  enemyMeshes.push(mesh);
  return e;
}

// Per-frame update. `playerPos` is a Vector3 (camera position). `obstacles`
// keeps enemies from clipping through pillars. Returns total contact damage
// inflicted on the player this frame so main.js can pipe it through
// damagePlayer + audio.
export function updateEnemies(dt, playerPos, obstacles, onDamagePlayer) {
  const aliveMeshes = [];
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) {
      // Already flagged dead → cleanup happens in killEnemy. Skip.
      continue;
    }

    // Move toward player (XZ only).
    TMP_VEC.copy(playerPos);
    TMP_VEC.y = e.mesh.position.y;
    TMP_VEC2.subVectors(TMP_VEC, e.mesh.position);
    TMP_VEC2.y = 0;
    const dist = TMP_VEC2.length();
    if (dist > 0.0001) TMP_VEC2.divideScalar(dist);
    const step = e.speed * dt;
    let nx = e.mesh.position.x + TMP_VEC2.x * step;
    let nz = e.mesh.position.z + TMP_VEC2.z * step;

    // Don't go past the player's body — when in melee, sit at touch range.
    if (dist <= PLAYER_RADIUS + e.def.size * 0.5) {
      nx = e.mesh.position.x;
      nz = e.mesh.position.z;
    }

    // Push away from obstacles axis-by-axis so enemies path around them.
    const r = e.def.size * 0.5;
    for (const o of obstacles) {
      if (aabbOverlap(nx, e.mesh.position.z, r, o)) {
        if (TMP_VEC2.x > 0) nx = o.minX - r - 0.01;
        else if (TMP_VEC2.x < 0) nx = o.maxX + r + 0.01;
      }
    }
    for (const o of obstacles) {
      if (aabbOverlap(nx, nz, r, o)) {
        if (TMP_VEC2.z > 0) nz = o.minZ - r - 0.01;
        else if (TMP_VEC2.z < 0) nz = o.maxZ + r + 0.01;
      }
    }

    e.mesh.position.x = nx;
    e.mesh.position.z = nz;
    if (e.edges) e.edges.position.copy(e.mesh.position);

    // Spin a bit so they read as "active" rather than static cubes.
    e.spinT += dt;
    e.mesh.rotation.y = e.spinT * 1.6;
    if (e.edges) e.edges.rotation.copy(e.mesh.rotation);

    // Contact damage when very close.
    e.contactT -= dt;
    if (dist <= PLAYER_RADIUS + e.def.size * 0.55 && e.contactT <= 0) {
      const landed = onDamagePlayer && onDamagePlayer(e.def.dmg);
      e.contactT = e.def.contactRate;
      if (landed) {
        // Slight knockback for both — pushes enemy away from player.
        e.mesh.position.x -= TMP_VEC2.x * 0.4;
        e.mesh.position.z -= TMP_VEC2.z * 0.4;
        if (e.edges) e.edges.position.copy(e.mesh.position);
      }
    }

    aliveMeshes.push(e.mesh);
  }

  // Keep enemyMeshes in lockstep so raycast targets only include living enemies.
  enemyMeshes.length = 0;
  for (const m of aliveMeshes) enemyMeshes.push(m);
}

function aabbOverlap(px, pz, r, o) {
  return (
    px + r > o.minX &&
    px - r < o.maxX &&
    pz + r > o.minZ &&
    pz - r < o.maxZ
  );
}

// Apply damage to an enemy. Returns true if this hit was fatal.
// Caller is expected to call killEnemy() to reap dead entities.
export function damageEnemy(e, amount) {
  if (e.dead) return false;
  e.hp -= amount;
  if (e.hp <= 0) {
    e.hp = 0;
    e.dead = true;
    return true;
  }
  return false;
}

// Reap dead enemies — should be called once per frame after damage has
// been applied. Returns array of killed entities (so main can score
// + play SFX without re-walking the list).
export function reapDead() {
  const killed = [];
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.dead) continue;
    spawnSparks(scene, e.mesh.position, e.def.color, 14, 8, 0.6);
    scene.remove(e.mesh);
    if (e.edges) scene.remove(e.edges);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
    if (e.edges) {
      e.edges.geometry.dispose();
      e.edges.material.dispose();
    }
    killed.push(e);
    enemies.splice(i, 1);
    // Also remove from raycast targets.
    const idx = enemyMeshes.indexOf(e.mesh);
    if (idx >= 0) enemyMeshes.splice(idx, 1);
  }
  return killed;
}

export function aliveCount() { return enemies.length; }
