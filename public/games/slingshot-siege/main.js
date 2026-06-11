// Slingshot Siege — main entry. Matter.js for rigid-body physics, canvas for
// render, vanilla pointer events for input. No build step.
//
// Render is intentionally split into per-actor functions (drawBird, drawPig,
// drawBlock) so PixelLab-generated sprites can swap in later without touching
// the physics or game logic.

import Matter from 'https://esm.sh/matter-js@0.20.0';
import { audio } from './audio.js';
import { LEVELS, GROUND_Y, SLING_X, SLING_Y, BIRDS_PER_LEVEL } from './levels.js';

const W = 960;
const H = 540;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const soundToggle = document.getElementById('sound-toggle');
const levelSelectEl = document.getElementById('level-select');

// ---- Persistent best scores ------------------------------------------------
const STORAGE_KEY = 'slingshot-siege:best-scores:v1';
function loadBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
function saveBest(idx, score) {
  const all = loadBest();
  if (!all[idx] || score > all[idx]) {
    all[idx] = score;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
    return true;
  }
  return false;
}

// ---- Game state ------------------------------------------------------------
const State = {
  AIMING: 'aiming',
  FLYING: 'flying',
  SETTLING: 'settling',   // waiting for world to come to rest after a shot
  WON: 'won',
  LOST: 'lost',
};

let engine = null;
let world = null;
let level = null;
let levelIdx = 0;
let birds = [];           // array of { body, alive } for already-launched birds
let currentBird = null;   // the bird sitting in the pouch (no body yet) or in flight
let stockRemaining = 0;   // how many birds left (including the one in the pouch)
let blocks = [];          // [{ body, w, h, mat }]
let pigs = [];            // [{ body, r, hp, dead }]
let state = State.AIMING;
let score = 0;
let pigsDefeated = 0;
let settleTimer = 0;

// Aim/drag state
let pointerDown = false;
let aimEnd = { x: SLING_X, y: SLING_Y };
const MAX_PULL = 110;     // max drag distance in pixels
const LAUNCH_K = 0.18;    // velocity per pixel pulled (tuned for 960×540)

// End-of-level overlay text
let overlayText = '';
let overlaySub = '';

// ---- World setup -----------------------------------------------------------
function rebuildEngine() {
  if (engine) Matter.Engine.clear(engine);
  engine = Matter.Engine.create({
    gravity: { x: 0, y: 1.0, scale: 0.001 },
    enableSleeping: true,
  });
  world = engine.world;

  // Ground (static)
  Matter.Composite.add(world, Matter.Bodies.rectangle(W / 2, GROUND_Y + 40, W * 2, 80, {
    isStatic: true, friction: 0.6, label: 'ground',
  }));
  // Side walls (static, off-screen) so birds don't fly into the void forever
  Matter.Composite.add(world, [
    Matter.Bodies.rectangle(-40, H / 2, 80, H * 2, { isStatic: true, label: 'wall' }),
    Matter.Bodies.rectangle(W + 40, H / 2, 80, H * 2, { isStatic: true, label: 'wall' }),
  ]);

  Matter.Events.on(engine, 'collisionStart', onCollision);
}

function materialOptions(mat) {
  if (mat === 'stone') return { density: 0.005, friction: 0.7, restitution: 0.05, frictionAir: 0.001 };
  return { density: 0.0018, friction: 0.55, restitution: 0.15, frictionAir: 0.002 };
}

function spawnLevel(idx) {
  levelIdx = idx;
  level = LEVELS[idx];
  rebuildEngine();
  blocks = [];
  pigs = [];
  birds = [];
  currentBird = null;
  stockRemaining = BIRDS_PER_LEVEL;
  score = 0;
  pigsDefeated = 0;
  state = State.AIMING;
  overlayText = '';
  overlaySub = '';

  for (const b of level.blocks) {
    const body = Matter.Bodies.rectangle(b.x, b.y, b.w, b.h, {
      ...materialOptions(b.mat),
      label: `block:${b.mat}`,
    });
    Matter.Composite.add(world, body);
    blocks.push({ body, w: b.w, h: b.h, mat: b.mat });
  }
  for (const p of level.pigs) {
    const body = Matter.Bodies.circle(p.x, p.y, p.r, {
      density: 0.002, friction: 0.5, restitution: 0.2, frictionAir: 0.003,
      label: 'pig',
    });
    Matter.Composite.add(world, body);
    pigs.push({ body, r: p.r, hp: p.hp, maxHp: p.hp, dead: false });
  }

  loadNextBird();
  updateLevelSelectUI();
}

function loadNextBird() {
  if (stockRemaining <= 0) {
    endLevel(false);
    return;
  }
  // The "pouch" bird isn't a physics body yet; it becomes one on release.
  currentBird = { x: SLING_X, y: SLING_Y, body: null };
  state = State.AIMING;
  aimEnd = { x: SLING_X, y: SLING_Y };
}

function launchBird(vx, vy) {
  const body = Matter.Bodies.circle(SLING_X, SLING_Y, 14, {
    density: 0.004, friction: 0.5, restitution: 0.5, frictionAir: 0.005,
    label: 'bird',
  });
  Matter.Body.setVelocity(body, { x: vx, y: vy });
  Matter.Composite.add(world, body);
  currentBird = { body, launchedAt: performance.now() };
  birds.push({ body, alive: true });
  state = State.FLYING;
  stockRemaining -= 1;
  audio.release();
}

// ---- Collisions ------------------------------------------------------------
function onCollision(evt) {
  for (const pair of evt.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    const speed = Math.hypot(
      (a.velocity.x - b.velocity.x),
      (a.velocity.y - b.velocity.y),
    );
    // Generic thud (block/bird/ground impacts), volume scaled by speed
    if (speed > 2.5) {
      const intensity = Math.min(1, speed / 14);
      audio.thud(intensity);
    }
    // Pig damage: any impact on a pig body with sufficient relative speed
    const pigBody = a.label === 'pig' ? a : (b.label === 'pig' ? b : null);
    if (pigBody) {
      const pig = pigs.find((p) => p.body === pigBody);
      if (pig && !pig.dead) {
        const dmg = Math.max(0, (speed - 2) * 8);
        pig.hp -= dmg;
        if (pig.hp <= 0) {
          pig.dead = true;
          pigsDefeated += 1;
          score += 1000;
          audio.oink();
          // Schedule removal from physics next tick
          setTimeout(() => Matter.Composite.remove(world, pigBody), 0);
        }
      }
    }
  }
}

function endLevel(won) {
  if (won) {
    score += stockRemaining * 500;
    const isBest = saveBest(levelIdx, score);
    overlayText = 'Cleared!';
    overlaySub = `Score ${score}${isBest ? ' · new best' : ''}`;
    state = State.WON;
    audio.win();
  } else {
    overlayText = 'Out of birds';
    overlaySub = `Score ${score} · press R to retry`;
    state = State.LOST;
    audio.lose();
  }
}

function maybeAdvanceAfterShot() {
  // Called once per frame while in SETTLING.
  if (pigs.every((p) => p.dead)) {
    endLevel(true);
    return;
  }
  // Wait for all dynamic bodies to be sleeping, or a short timeout.
  settleTimer += 1;
  const dyn = Matter.Composite.allBodies(world).filter((b) => !b.isStatic);
  const allSleeping = dyn.every((b) => b.isSleeping || Math.hypot(b.velocity.x, b.velocity.y) < 0.15);
  if (allSleeping || settleTimer > 180) {
    settleTimer = 0;
    if (stockRemaining > 0) loadNextBird();
    else endLevel(false);
  }
}

// ---- Input -----------------------------------------------------------------
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  const y = (e.clientY - rect.top) * (H / rect.height);
  return { x, y };
}

function isOverPouch(p) {
  return Math.hypot(p.x - SLING_X, p.y - SLING_Y) < 60;
}

function onPointerDown(e) {
  audio.init();
  if (state !== State.AIMING) return;
  const p = canvasPoint(e);
  if (!isOverPouch(p)) return;
  pointerDown = true;
  canvas.classList.add('dragging');
  canvas.setPointerCapture?.(e.pointerId);
  aimEnd = p;
}

function onPointerMove(e) {
  if (!pointerDown) return;
  const p = canvasPoint(e);
  const dx = p.x - SLING_X;
  const dy = p.y - SLING_Y;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, MAX_PULL);
  const angle = Math.atan2(dy, dx);
  aimEnd = {
    x: SLING_X + Math.cos(angle) * clamped,
    y: SLING_Y + Math.sin(angle) * clamped,
  };
  audio.stretch(clamped / MAX_PULL);
}

function onPointerUp() {
  if (!pointerDown) return;
  pointerDown = false;
  canvas.classList.remove('dragging');
  const dx = SLING_X - aimEnd.x;
  const dy = SLING_Y - aimEnd.y;
  const pull = Math.hypot(dx, dy);
  if (pull < 12) {
    // Barely pulled — cancel without consuming a bird
    audio.stretchEnd();
    aimEnd = { x: SLING_X, y: SLING_Y };
    return;
  }
  launchBird(dx * LAUNCH_K, dy * LAUNCH_K);
  aimEnd = { x: SLING_X, y: SLING_Y };
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);
canvas.addEventListener('pointerleave', onPointerUp);

window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') { spawnLevel(levelIdx); return; }
  if (e.key === '1') { spawnLevel(0); return; }
  if (e.key === '2') { spawnLevel(1); return; }
  if (e.key === '3') { spawnLevel(2); return; }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
  if ((state === State.WON || state === State.LOST) && (e.key === 'Enter' || e.key === ' ')) {
    if (state === State.WON && levelIdx < LEVELS.length - 1) spawnLevel(levelIdx + 1);
    else spawnLevel(levelIdx);
  }
});

soundToggle.addEventListener('click', toggleMute);
function toggleMute() {
  const next = !audio.isMuted();
  audio.setMuted(next);
  soundToggle.textContent = next ? '🔇' : '🔊';
  soundToggle.setAttribute('aria-label', next ? 'Unmute sound' : 'Mute sound');
}

// Level select buttons
levelSelectEl.hidden = false;
for (const btn of levelSelectEl.querySelectorAll('button[data-level]')) {
  btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.level);
    spawnLevel(idx);
  });
}
function updateLevelSelectUI() {
  for (const btn of levelSelectEl.querySelectorAll('button[data-level]')) {
    const idx = Number(btn.dataset.level);
    btn.classList.toggle('active', idx === levelIdx);
  }
}

// ---- Render ----------------------------------------------------------------
function drawBackdrop() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#2a2418');
  grad.addColorStop(0.5, '#3a2e1f');
  grad.addColorStop(1, '#5a4a32');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Distant hills (parallax-style flat silhouettes)
  ctx.fillStyle = '#241c12';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(0, GROUND_Y - 60);
  ctx.quadraticCurveTo(200, GROUND_Y - 110, 380, GROUND_Y - 70);
  ctx.quadraticCurveTo(560, GROUND_Y - 30, 720, GROUND_Y - 80);
  ctx.quadraticCurveTo(880, GROUND_Y - 130, W, GROUND_Y - 50);
  ctx.lineTo(W, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // Ground
  ctx.fillStyle = '#1c160e';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 0.5);
  ctx.lineTo(W, GROUND_Y + 0.5);
  ctx.stroke();
}

function drawSlingshot() {
  // Y-shaped wooden frame at (SLING_X, GROUND_Y) tapering up to the pouch.
  ctx.strokeStyle = '#5a3a1f';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(SLING_X, GROUND_Y);
  ctx.lineTo(SLING_X, SLING_Y + 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(SLING_X - 18, SLING_Y - 4);
  ctx.lineTo(SLING_X, SLING_Y + 8);
  ctx.lineTo(SLING_X + 18, SLING_Y - 4);
  ctx.stroke();

  // Band — drawn from the two fork tips through the pouch (current aimEnd)
  const pouch = (state === State.AIMING) ? aimEnd : { x: SLING_X, y: SLING_Y };
  ctx.strokeStyle = '#241510';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(SLING_X - 18, SLING_Y - 4);
  ctx.lineTo(pouch.x, pouch.y);
  ctx.lineTo(SLING_X + 18, SLING_Y - 4);
  ctx.stroke();
}

function drawBlock(b) {
  const v = b.body.vertices;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(v[0].x, v[0].y);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
  ctx.closePath();
  if (b.mat === 'stone') {
    ctx.fillStyle = '#6f6457';
    ctx.strokeStyle = '#2a2520';
  } else {
    ctx.fillStyle = '#a4732e';
    ctx.strokeStyle = '#3b2811';
  }
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle wood grain / stone speckle, axis-aligned in body local space
  ctx.translate(b.body.position.x, b.body.position.y);
  ctx.rotate(b.body.angle);
  ctx.globalAlpha = 0.25;
  if (b.mat === 'stone') {
    ctx.fillStyle = '#3a342c';
    for (let i = 0; i < 6; i++) {
      const sx = (Math.sin(i * 12.9) * 0.4) * b.w;
      const sy = (Math.cos(i * 7.3) * 0.4) * b.h;
      ctx.fillRect(sx - 2, sy - 2, 3, 3);
    }
  } else {
    ctx.strokeStyle = '#3b2811';
    ctx.lineWidth = 1;
    for (let gy = -b.h / 2 + 4; gy < b.h / 2 - 2; gy += 6) {
      ctx.beginPath();
      ctx.moveTo(-b.w / 2 + 2, gy);
      ctx.lineTo(b.w / 2 - 2, gy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPig(p) {
  const { position: pos, angle } = p.body;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);

  // Body
  ctx.fillStyle = '#7bb24e';
  ctx.strokeStyle = '#2d4a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belly highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(-p.r * 0.25, p.r * 0.2, p.r * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#5e8c3a';
  ctx.beginPath();
  ctx.ellipse(0, p.r * 0.1, p.r * 0.5, p.r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2d4a1a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Nostrils
  ctx.fillStyle = '#2d4a1a';
  ctx.beginPath();
  ctx.arc(-p.r * 0.15, p.r * 0.1, 1.5, 0, Math.PI * 2);
  ctx.arc( p.r * 0.15, p.r * 0.1, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Eyes — whites + pupils. Pupils track toward the slingshot when alive.
  const lookAngle = Math.atan2(SLING_Y - pos.y, SLING_X - pos.x) - angle;
  const lookX = Math.cos(lookAngle) * 1.5;
  const lookY = Math.sin(lookAngle) * 1.5;
  for (const ex of [-p.r * 0.35, p.r * 0.35]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, -p.r * 0.2, p.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(ex + lookX, -p.r * 0.2 + lookY, p.r * 0.10, 0, Math.PI * 2);
    ctx.fill();
  }

  // HP tint when damaged
  if (p.hp < p.maxHp) {
    const dmg = 1 - p.hp / p.maxHp;
    ctx.globalAlpha = dmg * 0.4;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBird(body) {
  const { position: pos, angle } = body;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);
  // Body
  ctx.fillStyle = '#d94f3d';
  ctx.strokeStyle = '#5a1d14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Belly
  ctx.fillStyle = '#f3d3a8';
  ctx.beginPath();
  ctx.ellipse(2, 3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#f1a13c';
  ctx.strokeStyle = '#5a3a14';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(11, -2);
  ctx.lineTo(20, 0);
  ctx.lineTo(11, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Eye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(5, -4, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(6, -4, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Tuft
  ctx.strokeStyle = '#5a1d14';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-3, -13); ctx.lineTo(-1, -18);
  ctx.moveTo( 0, -14); ctx.lineTo( 2, -19);
  ctx.stroke();
  ctx.restore();
}

function drawPouchBird() {
  if (!currentBird || state !== State.AIMING) return;
  // Bird sits at aimEnd while the player drags.
  const pos = aimEnd;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = '#d94f3d';
  ctx.strokeStyle = '#5a1d14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f3d3a8';
  ctx.beginPath();
  ctx.ellipse(2, 3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1a13c';
  ctx.beginPath();
  ctx.moveTo(11, -2);
  ctx.lineTo(20, 0);
  ctx.lineTo(11, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a3a14';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(5, -4, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(6, -4, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTrajectoryHint() {
  if (state !== State.AIMING || !pointerDown) return;
  const vx = (SLING_X - aimEnd.x) * LAUNCH_K;
  const vy = (SLING_Y - aimEnd.y) * LAUNCH_K;
  const g = 1.0; // matches engine gravity y
  let x = SLING_X, y = SLING_Y;
  let velx = vx, vely = vy;
  ctx.fillStyle = 'rgba(255, 179, 71, 0.55)';
  for (let i = 0; i < 22; i++) {
    // Step the projection 4 sub-steps per dot for smoother arc
    for (let k = 0; k < 4; k++) {
      x += velx * 0.6;
      y += vely * 0.6;
      vely += g * 0.6 * 0.06;
    }
    if (y > GROUND_Y) break;
    ctx.beginPath();
    ctx.arc(x, y, 2 + i * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUD() {
  // Birds remaining
  ctx.fillStyle = 'rgba(243, 236, 223, 0.85)';
  ctx.font = '500 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Birds: ${stockRemaining}`, 16, 28);
  // Score
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 16, 50);
  // Level name + best
  const best = loadBest()[levelIdx];
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(243, 236, 223, 0.75)';
  ctx.fillText(`Level ${levelIdx + 1} · ${level.name}`, W - 16, 28);
  if (best) {
    ctx.fillStyle = 'rgba(255, 179, 71, 0.85)';
    ctx.fillText(`Best ${best}`, W - 16, 50);
  }
}

function drawOverlay() {
  if (state !== State.WON && state !== State.LOST) return;
  ctx.fillStyle = 'rgba(5, 4, 3, 0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = state === State.WON ? '#ffb347' : '#d94f3d';
  ctx.font = 'bold 56px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(overlayText, W / 2, H / 2 - 20);
  ctx.fillStyle = '#f3ecdf';
  ctx.font = '500 22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(overlaySub, W / 2, H / 2 + 20);
  ctx.fillStyle = 'rgba(243, 236, 223, 0.65)';
  ctx.font = '400 16px ui-monospace, SFMono-Regular, Menlo, monospace';
  if (state === State.WON && levelIdx < LEVELS.length - 1) {
    ctx.fillText('Enter → next level · R → retry', W / 2, H / 2 + 56);
  } else if (state === State.WON) {
    ctx.fillText('All levels cleared. R → retry · 1/2/3 → jump', W / 2, H / 2 + 56);
  } else {
    ctx.fillText('R → retry · 1/2/3 → jump to level', W / 2, H / 2 + 56);
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawBackdrop();
  drawSlingshot();
  drawTrajectoryHint();
  for (const b of blocks) drawBlock(b);
  for (const p of pigs) if (!p.dead) drawPig(p);
  for (const b of birds) if (b.alive) drawBird(b.body);
  drawPouchBird();
  drawHUD();
  drawOverlay();
}

// ---- Update / cleanup ------------------------------------------------------
function cullOutOfBounds() {
  // Birds that fly off-screen are considered done
  for (const b of birds) {
    if (!b.alive) continue;
    const { x, y } = b.body.position;
    if (x < -100 || x > W + 100 || y > H + 200) {
      b.alive = false;
      Matter.Composite.remove(world, b.body);
    }
  }
  // Bird that's clearly settled (low velocity for ~1s) — treat as resolved
  if (state === State.FLYING && currentBird && currentBird.body) {
    const v = currentBird.body.velocity;
    const speed = Math.hypot(v.x, v.y);
    if (speed < 0.25 && performance.now() - currentBird.launchedAt > 1200) {
      state = State.SETTLING;
    }
    // Or bird left the world
    if (!birds.some((b) => b.body === currentBird.body && b.alive)) {
      state = State.SETTLING;
    }
  }
}

function loop(t) {
  Matter.Engine.update(engine, 1000 / 60);
  cullOutOfBounds();
  if (state === State.SETTLING) maybeAdvanceAfterShot();
  render();
  requestAnimationFrame(loop);
}

// ---- Boot ------------------------------------------------------------------
spawnLevel(0);
requestAnimationFrame(loop);
