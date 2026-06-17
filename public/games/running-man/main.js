// Running Man — entry point.
//
// Responsibilities kept here (everything else is in its own module):
//   - Canvas + DOM handles
//   - Game-level state (speed / distance / score / milestones / state machine)
//   - Input wiring
//   - Main rAF loop + update/render orchestration
//   - Intro & death overlays (pure canvas text)

import {
  W, H, GROUND_Y,
  HERO_X, HERO_H, HERO_GROUND_Y,
  SPEED_START, SPEED_MAX, SPEED_RAMP,
  STATE, STORAGE, HISTORY_STORE_MAX, HISTORY_RENDER_MAX,
} from './config.js';
import { AudioEngine } from './audio.js';
import {
  hero, loadHeroAssets, resetHero, heroHitbox, tryJump, cutJump,
  updateHeroRunning, updateHeroDying, drawHero,
} from './hero.js';
import {
  loadObstacleAssets, resetObstacles, spawnObstacle,
  updateObstacles, drawObstacles, obstacles, aabb,
} from './obstacles.js';
import {
  loadBackdropAssets, resetBackdrop, updateBackdrop,
  drawSkyGradient, drawBackdropFar,
} from './backdrop.js';

// --- Canvas + DOM ---

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const scoreEl = document.getElementById('score');
const hintEl = document.getElementById('hint');
const soundToggle = document.getElementById('sound-toggle');

// --- Audio ---

const audio = new AudioEngine();
function updateSoundToggleUI() {
  soundToggle.textContent = audio.muted ? '🔇' : '🔊';
  soundToggle.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
}
updateSoundToggleUI();

// --- Game state ---

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE.HISTORY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function recordRun(meters) {
  game.history.push(meters);
  if (game.history.length > HISTORY_STORE_MAX) {
    game.history.splice(0, game.history.length - HISTORY_STORE_MAX);
  }
  localStorage.setItem(STORAGE.HISTORY, JSON.stringify(game.history));
}

const game = {
  state: STATE.INTRO,
  speed: SPEED_START,
  distance: 0,
  nextSpawn: 1.2,
  nextMilestone: 100,
  introT: 0,
  best: Number(localStorage.getItem(STORAGE.BEST) || 0),
  history: loadHistory(),
};

// --- Test hook (gated by ?test=1) ---
// Read-only surface for E2E tests. Absent in production (no ?test=1).
// All accessors return copies or primitives — tests cannot mutate game state.
// Placed here so it has access to `game`, `hero`, and `obstacles`.
if (new URLSearchParams(location.search).has('test')) {
  window.__gameTest = {
    getState:     () => game.state,
    getDistance:  () => game.distance,
    getBest:      () => Number(localStorage.getItem(STORAGE.BEST) || 0),
    getHero:      () => ({ x: HERO_X, y: hero.y, vy: hero.vy, onGround: hero.y >= HERO_GROUND_Y - HERO_H - 0.5 }),
    getSpeed:     () => game.speed,
    getObstacles: () => obstacles.map((o) => ({ x: o.x, y: o.y, name: o.type?.name ?? o.name })),
  };
}

function resetGame() {
  resetHero();
  resetObstacles();
  resetBackdrop();
  game.state = STATE.RUNNING;
  game.speed = SPEED_START;
  game.distance = 0;
  game.nextSpawn = 1.2;
  game.nextMilestone = 100;
  hintEl.textContent = 'SPACE to jump';
  audio.start();
  audio.startMusic();
}

// --- Input ---

function togglePause() {
  if (game.state === STATE.RUNNING) {
    game.state = STATE.PAUSED;
    audio.stopMusic();
    hintEl.textContent = 'paused · P to resume';
  } else if (game.state === STATE.PAUSED) {
    game.state = STATE.RUNNING;
    audio.startMusic();
    hintEl.textContent = 'SPACE to jump';
  }
}

function handleAction() {
  audio.init();
  audio.resume();
  if (game.state === STATE.INTRO || game.state === STATE.DEAD) {
    resetGame();
  } else if (game.state === STATE.PAUSED) {
    // Tapping or pressing space while paused resumes — nice for mobile.
    togglePause();
  } else if (game.state === STATE.RUNNING) {
    if (tryJump(game.state)) audio.jump();
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    handleAction();
  } else if (e.code === 'KeyR' && (game.state === STATE.DEAD || game.state === STATE.DYING)) {
    e.preventDefault();
    audio.init();
    audio.resume();
    resetGame();
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    audio.init();
    audio.toggleMuted();
    updateSoundToggleUI();
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (game.state === STATE.RUNNING || game.state === STATE.PAUSED) {
      audio.init();
      audio.resume();
      togglePause();
    }
  }
});
// Variable-height jump: while the input is held, the jump arc plays out
// in full (initial JUMP_VY); releasing early caps the upward velocity so
// short taps become short hops. We listen on window so a release outside
// the canvas (drag-off, key released elsewhere) still cuts the jump.
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (game.state === STATE.RUNNING) cutJump();
  }
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleAction();
});
window.addEventListener('pointerup', () => {
  if (game.state === STATE.RUNNING) cutJump();
});
window.addEventListener('pointercancel', () => {
  if (game.state === STATE.RUNNING) cutJump();
});
soundToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.init();
  audio.toggleMuted();
  updateSoundToggleUI();
});

// --- Update ---

function update(dt) {
  // Backdrop always drifts — on intro/paused screens, use a gentle ambient speed.
  let scrollSpeed;
  if (game.state === STATE.INTRO) scrollSpeed = 50;
  else if (game.state === STATE.PAUSED) scrollSpeed = 0;
  else scrollSpeed = game.speed;
  updateBackdrop(dt, scrollSpeed);

  if (game.state === STATE.INTRO) {
    game.introT += dt;
  } else if (game.state === STATE.PAUSED) {
    // frozen
  } else if (game.state === STATE.RUNNING) {
    game.distance += game.speed * dt;
    game.speed = Math.min(SPEED_MAX, game.speed + SPEED_RAMP * dt);
    updateHeroRunning(dt);

    game.nextSpawn -= dt;
    if (game.nextSpawn <= 0) game.nextSpawn = spawnObstacle(game.speed);
    updateObstacles(dt, game.speed);

    const meters = Math.floor(game.distance / 10);
    while (meters >= game.nextMilestone) {
      audio.milestone();
      game.nextMilestone += 100;
    }

    const hb = heroHitbox();
    for (const o of obstacles) {
      if (aabb(hb, o)) {
        game.state = STATE.DYING;
        audio.death();
        audio.stopMusic();
        audio.deathTune();
        if (meters > game.best) {
          game.best = meters;
          localStorage.setItem(STORAGE.BEST, String(meters));
        }
        recordRun(meters);
        break;
      }
    }
  } else if (game.state === STATE.DYING) {
    updateHeroDying(dt);
    if (hero.deathT > 1.5) {
      game.state = STATE.DEAD;
      hintEl.textContent = 'SPACE or R to retry';
    }
  }

  const meters = Math.floor(game.distance / 10);
  scoreEl.textContent = `${meters}m${game.best ? `  ·  best ${game.best}m` : ''}`;
}

// --- Render ---

function drawGround() {
  // Asphalt body — fills from the horizon line down to the canvas bottom.
  // Subtle vertical gradient so it reads as a 3D-ish road surface, darker
  // at the far edge (top) and slightly lighter near the viewer (bottom).
  const grad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  grad.addColorStop(0, '#13171f');
  grad.addColorStop(1, '#22293a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Far edge of the road / horizon. Faint blue tint to suggest distance.
  ctx.fillStyle = 'rgba(122, 162, 247, 0.18)';
  ctx.fillRect(0, GROUND_Y, W, 1);

  // Scrolling center divider — dashed line down the middle of the road,
  // like the painted center stripe on a real two-way road.
  const tick = 36;
  const offset = Math.floor(game.distance) % tick;
  const centerY = Math.round((GROUND_Y + H) / 2);
  ctx.fillStyle = '#6b7388';
  for (let x = -offset; x < W; x += tick) {
    ctx.fillRect(x, centerY, 18, 2);
  }

  // Subtle near-edge highlight at the very bottom of the canvas — the
  // viewer-side curb.
  ctx.fillStyle = 'rgba(122, 162, 247, 0.10)';
  ctx.fillRect(0, H - 1, W, 1);
}

function drawIntroOverlay() {
  // Semi-transparent vignette for readability
  ctx.fillStyle = 'rgba(15, 17, 22, 0.38)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const y0 = H / 2 - 10;
  ctx.fillText('RUNNING MAN', W / 2, y0);

  // Subtle underline accent
  ctx.fillStyle = '#7aa2f7';
  ctx.fillRect(W / 2 - 90, y0 + 8, 180, 2);

  ctx.font = '13px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(230, 230, 230, 0.9)';
  ctx.fillText('auto-runner · jump to survive', W / 2, y0 + 30);

  // Blinking prompt
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillStyle = `rgba(230, 230, 230, ${0.55 + Math.sin(game.introT * 4) * 0.35})`;
  ctx.fillText('press SPACE or tap to start', W / 2, y0 + 60);

  if (game.best) {
    ctx.font = '11px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    ctx.fillStyle = '#8a8f98';
    ctx.fillText(`best: ${game.best}m`, W / 2, y0 + 82);
  }
}

function drawPausedOverlay() {
  ctx.fillStyle = 'rgba(15, 17, 22, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6e6e6';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('paused', W / 2, H / 2 - 6);
  ctx.font = '12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillStyle = '#8a8f98';
  ctx.fillText('P or ESC to resume', W / 2, H / 2 + 14);
}

function drawDeadOverlay() {
  ctx.fillStyle = 'rgba(15, 17, 22, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  const current = Math.floor(game.distance / 10);
  const isNewBest = current >= game.best && game.best > 0;

  // Big distance for the just-finished run.
  ctx.fillStyle = '#e6e6e6';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(`${current}m`, W / 2, 60);

  // "new best!" accent — only if we tied or beat the stored record.
  if (isNewBest) {
    ctx.fillStyle = '#7aa2f7';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    ctx.fillText('new best!', W / 2, 80);
  }

  // Recent-runs panel — most recent on top. The current run is the last
  // entry; we mark it with ▶ and any all-time best with ★. Showing past
  // attempts gives the player a sense of progression run-to-run.
  ctx.fillStyle = '#8a8f98';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('— recent runs —', W / 2, 105);

  const recent = game.history.slice(-HISTORY_RENDER_MAX).reverse();
  ctx.font = '12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    const y = 124 + i * 16;
    const isCurrent = i === 0;
    const isBest = game.best > 0 && m === game.best;
    let prefix = '  ';
    if (isCurrent) prefix = '▶ ';
    let suffix = '';
    if (isBest) suffix = '  ★';
    ctx.fillStyle = isCurrent ? '#e6e6e6' : '#8a8f98';
    ctx.fillText(`${prefix}${m}m${suffix}`, W / 2, y);
  }

  // Retry prompt anchored near the bottom so the panel above can grow
  // without colliding with it.
  ctx.fillStyle = '#8a8f98';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('SPACE or R to retry', W / 2, H - 24);
}

function render() {
  // Back to front:
  drawSkyGradient(ctx);
  drawBackdropFar(ctx);
  drawGround();
  drawObstacles(ctx);
  drawHero(ctx, game.state);

  if (game.state === STATE.INTRO) drawIntroOverlay();
  else if (game.state === STATE.PAUSED) drawPausedOverlay();
  else if (game.state === STATE.DEAD) drawDeadOverlay();
}

// --- Main loop ---

let last = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// --- Boot ---

(async () => {
  try {
    await Promise.all([
      loadHeroAssets(),
      loadObstacleAssets(),
      loadBackdropAssets(),
    ]);
    requestAnimationFrame((t) => {
      last = t;
      loop(t);
    });
  } catch (err) {
    scoreEl.textContent = '!';
    hintEl.textContent = String(err.message || err);
    console.error(err);
  }
})();
