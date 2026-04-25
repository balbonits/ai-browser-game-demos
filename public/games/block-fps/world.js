// World — Three.js scene, arena geometry, lighting, particles.

import * as THREE from 'three';
import { COLORS, ARENA_HALF, FLOOR_Y, WALL_HEIGHT, FOG_NEAR, FOG_FAR } from './config.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.fog, FOG_NEAR, FOG_FAR);
  return scene;
}

// Build the arena: a dark floor with neon grid lines, four short outer
// walls, plus a few obstacle pillars to break up sight lines.
export function buildArena(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // Floor — flat dark plane.
  const floorGeo = new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2);
  const floorMat = new THREE.MeshLambertMaterial({ color: COLORS.floorDark });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  root.add(floor);

  // Floor grid — neon lines in a regular spacing.
  const grid = new THREE.GridHelper(
    ARENA_HALF * 2, ARENA_HALF, COLORS.wallEdge, COLORS.floorLine,
  );
  grid.position.y = FLOOR_Y + 0.001; // sit just above floor to avoid z-fight
  // Tone down opacity so the grid reads as ambient lighting, not a fence.
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  root.add(grid);

  // Walls — four short walls along the arena perimeter.
  const wallMat = new THREE.MeshLambertMaterial({ color: COLORS.walls });
  const wallEdgeMat = new THREE.LineBasicMaterial({
    color: COLORS.wallEdge, transparent: true, opacity: 0.85,
  });
  const wallSpec = [
    // [w, h, d, x, z]
    [ARENA_HALF * 2, WALL_HEIGHT, 0.4, 0, -ARENA_HALF],
    [ARENA_HALF * 2, WALL_HEIGHT, 0.4, 0,  ARENA_HALF],
    [0.4, WALL_HEIGHT, ARENA_HALF * 2, -ARENA_HALF, 0],
    [0.4, WALL_HEIGHT, ARENA_HALF * 2,  ARENA_HALF, 0],
  ];
  for (const [w, h, d, x, z] of wallSpec) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, FLOOR_Y + h / 2, z);
    root.add(mesh);
    // Outline: wireframe via EdgesGeometry. Catches the neon glow nicely
    // against the dark wall body.
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wallEdgeMat);
    edges.position.copy(mesh.position);
    root.add(edges);
  }

  // Obstacle pillars — a few rectangular blocks scattered in the arena
  // to break sight-lines and force movement. Hand-placed so the layout
  // is consistent across runs.
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x121828 });
  const pillarSpec = [
    // [w, h, d, x, z]
    [3, 2.0, 3,  9,  9],
    [3, 2.0, 3, -9, -9],
    [4, 1.6, 4, -10, 8],
    [4, 1.6, 4,  10, -8],
    [2.4, 3.2, 2.4, 0, 0], // central pillar — blocks line of sight from above
  ];
  const obstacles = [];
  for (const [w, h, d, x, z] of pillarSpec) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, pillarMat);
    mesh.position.set(x, FLOOR_Y + h / 2, z);
    root.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wallEdgeMat);
    edges.position.copy(mesh.position);
    root.add(edges);
    // Save AABB info for player + enemy collision.
    obstacles.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      maxY: h,
      mesh,
    });
  }

  return { root, obstacles };
}

// Lighting — flat-ish "neon arena" feel: low ambient + one directional
// from above for the bare minimum of shading on enemy faces.
export function buildLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(8, 14, 6);
  scene.add(dir);
  // A subtle cyan rim light from the opposite side gives enemy back-edges
  // a glow that reads against the dark fog.
  const rim = new THREE.DirectionalLight(COLORS.accent, 0.30);
  rim.position.set(-8, 5, -10);
  scene.add(rim);
}

// --- Tracer beams ---
// A tracer is a thin line drawn from the gun muzzle to the hit point (or
// far into the scene if the shot missed). Tracers fade in 0.08 s.

const tracerMat = new THREE.LineBasicMaterial({
  color: COLORS.accent, transparent: true, opacity: 1,
});
const tracers = [];

export function spawnTracer(scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = tracerMat.clone();
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.08, maxLife: 0.08, mat });
}

export function updateTracers(dt, scene) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.mat.dispose();
      tracers.splice(i, 1);
      continue;
    }
    t.mat.opacity = (t.life / t.maxLife);
  }
}

export function clearTracers(scene) {
  for (const t of tracers) {
    scene.remove(t.line);
    t.line.geometry.dispose();
    t.mat.dispose();
  }
  tracers.length = 0;
}

// --- Hit / death sparks ---
//
// A spark is a small box that flies away from a hit point on a random
// trajectory and fades over ~0.5 s. Used for both bullet impacts and
// enemy explosions (more particles → bigger pop).

const sparks = [];
const sparkGeo = new THREE.BoxGeometry(0.10, 0.10, 0.10);

export function spawnSparks(scene, position, color, count = 6, speed = 6, life = 0.45) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const m = new THREE.Mesh(sparkGeo, mat);
    m.position.copy(position);
    const a = Math.random() * Math.PI * 2;
    const upBias = 0.4 + Math.random() * 0.6;
    const sp = speed * (0.5 + Math.random());
    const vx = Math.cos(a) * sp;
    const vy = upBias * sp;
    const vz = Math.sin(a) * sp;
    scene.add(m);
    sparks.push({
      mesh: m, mat,
      vx, vy, vz,
      life, maxLife: life,
    });
  }
}

export function updateSparks(dt, scene) {
  const gravity = 18;
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.geometry; // shared, do not dispose
      s.mat.dispose();
      sparks.splice(i, 1);
      continue;
    }
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy -= gravity * dt;
    s.mat.opacity = s.life / s.maxLife;
    // Tumble for visual flair.
    s.mesh.rotation.x += dt * 6;
    s.mesh.rotation.y += dt * 8;
  }
}

export function clearSparks(scene) {
  for (const s of sparks) {
    scene.remove(s.mesh);
    s.mat.dispose();
  }
  sparks.length = 0;
}

// --- Muzzle flash ---
// A short-lived bright cone at the gun barrel tip. Re-uses one mesh and
// just toggles visibility / scale.

let muzzleMesh = null;
let muzzleLife = 0;

export function attachMuzzleFlash(parent) {
  if (muzzleMesh) return muzzleMesh;
  const geo = new THREE.ConeGeometry(0.06, 0.18, 8);
  geo.rotateX(-Math.PI / 2); // point down -Z
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfff0a0, transparent: true, opacity: 0.0,
  });
  muzzleMesh = new THREE.Mesh(geo, mat);
  muzzleMesh.position.set(0, 0, -0.08); // attached at barrel tip
  parent.add(muzzleMesh);
  return muzzleMesh;
}

export function fireMuzzleFlash() {
  if (!muzzleMesh) return;
  muzzleLife = 0.06;
  muzzleMesh.material.opacity = 1.0;
  muzzleMesh.scale.set(1, 1, 1.6 + Math.random() * 0.4);
}

export function updateMuzzleFlash(dt) {
  if (!muzzleMesh || muzzleLife <= 0) return;
  muzzleLife -= dt;
  if (muzzleLife <= 0) {
    muzzleMesh.material.opacity = 0;
    return;
  }
  muzzleMesh.material.opacity = muzzleLife / 0.06;
}
