// Block Arena — entry point.
//
// Owns the renderer, the game-level state machine, the rAF loop, and
// the input wiring. Other modules expose narrow `update*()`/`draw*()`
// surfaces and stay agnostic to game state.

import * as THREE from 'three';

import {
  STATE, STORAGE, WAVE_COOLDOWN, TOTAL_WAVES, PLAYER_HP,
} from './config.js';
import { AudioEngine } from './audio.js';
import {
  createScene, buildArena, buildLights,
  updateTracers, updateSparks, updateMuzzleFlash,
  clearTracers, clearSparks,
} from './world.js';
import {
  createCamera, createControls,
  player, resetPlayer, updatePlayer, damagePlayer, setKey, clearKeys,
} from './player.js';
import {
  buildGun, updateGun, setFiring, maybeAutoFire, getGunDamage,
} from './gun.js';
import {
  enemyMeshes, setScene, resetEnemies, updateEnemies,
  damageEnemy, reapDead, aliveCount,
} from './enemies.js';
import {
  startWave, resetWaves, updateWaves, isWaveActive, isWaveSpawningDone,
} from './waves.js';

// --- DOM handles ---

const canvas = document.getElementById('game');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const overlayMeta = document.getElementById('overlay-meta');
const hpFill = document.getElementById('hp-fill');
const hpNum = document.getElementById('hp-num');
const statWave = document.getElementById('stat-wave');
const statScore = document.getElementById('stat-score');
const statKills = document.getElementById('stat-kills');
const hintEl = document.getElementById('hint');
const soundToggle = document.getElementById('sound-toggle');
const frame = document.getElementById('frame');

// --- Renderer + scene ---

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = createScene();
buildLights(scene);
const arena = buildArena(scene);
setScene(scene);

const camera = createCamera(canvas.clientWidth / canvas.clientHeight);
scene.add(camera);
buildGun(camera);

// PointerLockControls — handles mouse-look (no manual quaternion math).
// We pass document.body as the lock element so any click within the
// frame engages it.
const controls = createControls(camera, document.body);

// Resize handler — defined after `camera` so the closure can read it.
// First call happens here too (post-init) so the renderer matches the
// canvas's CSS-driven size on boot.
function sizeRenderer() {
  const w = canvas.clientWidth || 960;
  const h = canvas.clientHeight || 540;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
sizeRenderer();
window.addEventListener('resize', sizeRenderer);

// --- Audio ---

const audio = new AudioEngine();
function updateSoundToggleUI() {
  soundToggle.textContent = audio.muted ? '🔇' : '🔊';
  soundToggle.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
}
updateSoundToggleUI();

// --- Game state ---

const game = {
  state: STATE.INTRO,
  wave: 0,                  // last completed wave (0 = none yet)
  cooldown: WAVE_COOLDOWN,
  score: 0,
  kills: 0,
  bestWave: Number(localStorage.getItem(STORAGE.BEST_WAVE) || 0),
  bestScore: Number(localStorage.getItem(STORAGE.BEST_SCORE) || 0),
  prePauseState: null,
  bannerT: 0,
  banner: '',
};

function resetGame() {
  resetEnemies();
  resetWaves();
  resetPlayer();
  clearTracers(scene);
  clearSparks(scene);
  game.state = STATE.PLAYING;
  game.wave = 0;
  game.cooldown = WAVE_COOLDOWN * 0.75; // shorter first cooldown
  game.score = 0;
  game.kills = 0;
  setBanner('GET READY', 1.6);
  hideOverlay();
  updateHud();
  audio.startMusic();
}

function setBanner(text, dur = 1.6) { game.banner = text; game.bannerT = dur; }

function showOverlay(title, sub, meta = '') {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlayMeta.textContent = meta;
  overlayEl.classList.remove('hidden');
}
function hideOverlay() {
  overlayEl.classList.add('hidden');
}

function updateHud() {
  const pct = Math.max(0, Math.min(1, player.hp / PLAYER_HP));
  hpFill.style.width = `${(pct * 100).toFixed(1)}%`;
  hpNum.textContent = `${player.hp}`;
  // Wave label — switch to ∞ glyph past the named campaign.
  const wDisp = game.state === STATE.PLAYING ? Math.max(1, game.wave + 1) : Math.max(0, game.wave);
  const wLabel = wDisp > TOTAL_WAVES ? `WAVE ${wDisp} ∞` : `WAVE ${wDisp}`;
  statWave.textContent = wLabel;
  statScore.textContent = `SCORE ${game.score}`;
  statKills.textContent = `KILLS ${game.kills}`;
}

function persistBest() {
  if (game.wave > game.bestWave) {
    game.bestWave = game.wave;
    localStorage.setItem(STORAGE.BEST_WAVE, String(game.wave));
  }
  if (game.score > game.bestScore) {
    game.bestScore = game.score;
    localStorage.setItem(STORAGE.BEST_SCORE, String(game.score));
  }
}

// --- Wave control ---

function tryStartNextWave() {
  if (game.state !== STATE.PLAYING) return false;
  if (isWaveActive()) return false;
  const next = game.wave + 1;
  if (!startWave(next)) return false;
  audio.waveStart();
  setBanner(next > TOTAL_WAVES ? `WAVE ${next} ∞` : `WAVE ${next}`, 1.4);
  game.cooldown = 0;
  updateHud();
  return true;
}

function onWaveCleared() {
  game.wave++;
  const bonus = 50 + game.wave * 10;
  game.score += bonus;
  audio.waveClear();
  setBanner(`WAVE CLEAR · +${bonus}`, 1.6);
  game.cooldown = WAVE_COOLDOWN;
  persistBest();
  updateHud();
}

// --- Damage/kill callbacks ---

function onPlayerDamage(amount) {
  if (game.state !== STATE.PLAYING) return false;
  const landed = damagePlayer(amount);
  if (landed) {
    audio.playerHit();
    setBanner(`-${amount} HP`, 0.5);
    if (!player.alive) {
      onPlayerDeath();
    }
    updateHud();
  }
  return landed;
}

function onPlayerDeath() {
  game.state = STATE.DEAD;
  audio.stopMusic();
  audio.defeat();
  persistBest();
  if (controls.isLocked) controls.unlock();
  setFiring(false);
  showOverlay(
    'GRID OVERRUN',
    'click or press SPACE to retry',
    `wave ${game.wave + 1} · score ${game.score} · kills ${game.kills}` +
    (game.score >= game.bestScore && game.bestScore > 0 ? '  ·  new best!' : ''),
  );
}

// --- Input ---

window.addEventListener('keydown', (e) => {
  if (['Space', 'KeyR', 'KeyM', 'KeyP', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
    // Don't preventDefault Esc — pointer lock relies on it.
    if (e.code !== 'Escape') e.preventDefault();
  }
  audio.init();
  audio.resume();

  if (e.code === 'KeyM') {
    audio.toggleMuted();
    updateSoundToggleUI();
    return;
  }

  if (game.state === STATE.INTRO) {
    if (e.code === 'Space' || e.code === 'Enter') startFromIntro();
    return;
  }
  if (game.state === STATE.DEAD) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR') startFromIntro();
    return;
  }

  if (e.code === 'KeyP') {
    togglePause();
    return;
  }
  if (e.code === 'Escape') {
    // Pointer lock handles this natively (releases the lock); we'll
    // catch the unlock event below to flip into PAUSED.
    return;
  }

  if (game.state === STATE.PAUSED) return;

  // Movement keys → player
  setKey(e.code, true);

  // Manual wave-start (Space) when between waves.
  if (e.code === 'Space' && !isWaveActive() && game.cooldown > 0) {
    game.cooldown = 0;
  }
});

window.addEventListener('keyup', (e) => {
  setKey(e.code, false);
});

// Mouse → fire (left button only). Auto-fire while held.
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  audio.init();
  audio.resume();
  if (game.state === STATE.INTRO) { startFromIntro(); return; }
  if (game.state === STATE.DEAD) { startFromIntro(); return; }
  if (game.state === STATE.PAUSED) {
    if (controls.isLocked === false) {
      // Click to re-engage pointer lock.
      controls.lock();
    }
    return;
  }
  if (game.state !== STATE.PLAYING) return;
  setFiring(true);
});
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  setFiring(false);
});

// Click on the overlay also re-locks. The overlay covers the canvas
// with `pointer-events: auto` so clicks land here.
overlayEl.addEventListener('click', () => {
  audio.init();
  audio.resume();
  if (game.state === STATE.INTRO || game.state === STATE.DEAD) startFromIntro();
  else if (game.state === STATE.PAUSED) controls.lock();
});

// Pointer-lock change listener — flip between PLAYING/PAUSED.
controls.addEventListener('lock', () => {
  if (game.state === STATE.PAUSED) {
    game.state = STATE.PLAYING;
    audio.startMusic();
    hideOverlay();
  } else if (game.state === STATE.INTRO) {
    // resetGame already locked us in.
    hideOverlay();
  }
  hintEl.textContent = 'WASD move · click fire · Esc pause';
});
controls.addEventListener('unlock', () => {
  if (game.state === STATE.PLAYING) {
    game.state = STATE.PAUSED;
    audio.stopMusic();
    setFiring(false);
    clearKeys();
    showOverlay('PAUSED', 'click to resume', '');
  }
  hintEl.textContent = 'click to play · WASD move · mouse look · click fire · Esc pause';
});

soundToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.init();
  audio.resume();
  audio.toggleMuted();
  updateSoundToggleUI();
});

function togglePause() {
  if (game.state === STATE.PLAYING) {
    if (controls.isLocked) controls.unlock();
  } else if (game.state === STATE.PAUSED) {
    controls.lock();
  }
}

function startFromIntro() {
  resetGame();
  // Engage pointer lock so the player can start moving immediately.
  // Some browsers gate this to actual user gestures, which is why this
  // function is only called from a click/keydown handler.
  if (!controls.isLocked) controls.lock();
}

// --- Update / loop ---

let last = 0;

function update(dt) {
  if (game.bannerT > 0) game.bannerT -= dt;

  // Particles always update (so end-of-game sparks finish out).
  updateTracers(dt, scene);
  updateSparks(dt, scene);
  updateMuzzleFlash(dt);
  updateGun(dt);

  if (game.state !== STATE.PLAYING) return;

  // Wave progression.
  if (!isWaveActive()) {
    game.cooldown -= dt;
    if (game.cooldown <= 0) tryStartNextWave();
  } else {
    updateWaves(dt);
  }

  updatePlayer(dt, arena.obstacles);
  updateEnemies(dt, camera.position, arena.obstacles, onPlayerDamage);

  // Auto-fire if mouse held. `maybeAutoFire` returns { fired, enemy, point }
  // — we play fire SFX on every actual shot (hit or miss), and layer hit
  // / kill SFX when applicable.
  const r = maybeAutoFire(scene, camera, enemyMeshes, dt, controls.isLocked);
  if (r.fired) {
    audio.fire();
    if (r.enemy) {
      audio.enemyHit();
      const killed = damageEnemy(r.enemy, getGunDamage());
      if (killed) {
        audio.enemyKill(r.enemy.kind === 'heavy');
        game.kills++;
        game.score += r.enemy.def.score;
      }
    }
  }

  // Reap dead enemies (their score was already credited on the fatal hit).
  reapDead();

  // Wave complete?
  if (isWaveSpawningDone() && aliveCount() === 0 && !isWaveActive()) {
    onWaveCleared();
  }

  updateHud();
}

// --- Render ---

function render() {
  renderer.render(scene, camera);
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// --- Boot ---

requestAnimationFrame((t) => {
  last = t;
  loop(t);
});

// Initial overlay (intro state).
showOverlay(
  'BLOCK ARENA',
  'click to play',
  game.bestWave > 0
    ? `best: wave ${game.bestWave} · score ${game.bestScore}`
    : 'WASD move · mouse look · click fire · Esc pause',
);
updateHud();
