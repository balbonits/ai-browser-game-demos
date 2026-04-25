// Neon Tower Defense — entry point.
//
// Holds the canvas, the game-level state machine, the input wiring, and
// the rAF loop. Every other module is intentionally narrow-purpose.

import {
  W, H, FIELD_TOP, COLORS,
  STATE, STORAGE,
  STARTING_LIVES, STARTING_MONEY,
  WAVE_COOLDOWN, TOTAL_WAVES, TOWERS, TOWER_KEYS,
} from './config.js';
import { AudioEngine } from './audio.js';
import { pickTile, buildable } from './map.js';
import {
  drawBackground, drawPath, drawHudStrip, drawTowerButtons, buttonHitTest,
  drawCenteredOverlay, drawRangeCircle, rgba, roundRect,
  updateParticles, drawParticles, clearParticles, spawnBurst,
} from './render.js';
import {
  enemies, resetEnemies, updateEnemies, drawEnemies,
} from './enemies.js';
import {
  towers, resetTowers, updateTowers, drawTowers,
  buildTower, sellTower, upgradeTower, nextUpgradeCost, towerStats,
  pickTower, drawBuildGhost,
} from './towers.js';
import {
  resetProjectiles, updateProjectiles, drawProjectiles,
} from './projectiles.js';
import {
  startWave, resetWaves, updateWaves, isWaveActive, isWaveSpawningDone,
} from './waves.js';

// --- Canvas + DOM ---

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const hintEl  = document.getElementById('hint');
const soundToggle = document.getElementById('sound-toggle');

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
  lives: STARTING_LIVES,
  money: STARTING_MONEY,
  wave: 0,                  // last wave completed (0 = none yet)
  cooldown: WAVE_COOLDOWN,
  best: Number(localStorage.getItem(STORAGE.BEST) || 0),
  // Build / select context
  selectedKey: null,        // a tower key the player is placing
  selectedTowerId: null,    // a placed tower the player has selected
  // Mouse position (canvas coords)
  mouse: { x: 0, y: 0 },
  hover: { c: -1, r: -1 },
  hoverTower: null,
  hoverButton: -1,
  pulseT: 0,
  // Banner / hint
  bannerT: 0,
  banner: '',
  // Pre-pause state
  prePauseState: null,
};

function resetGame() {
  resetEnemies();
  resetTowers();
  resetProjectiles();
  resetWaves();
  clearParticles();
  game.state = STATE.READY;
  game.lives = STARTING_LIVES;
  game.money = STARTING_MONEY;
  game.wave = 0;
  game.cooldown = WAVE_COOLDOWN;
  game.selectedKey = null;
  game.selectedTowerId = null;
  game.banner = 'GET READY';
  game.bannerT = 1.6;
  audio.startMusic();
  updateHud();
}

// Stats live on the in-canvas HUD strip now (drawn in drawHudStrip from
// render.js using the current game state). No DOM update needed.
function updateHud() { /* no-op kept for call-site compatibility */ }

// --- Banners / hints ---

function setBanner(text, dur = 1.8) {
  game.banner = text;
  game.bannerT = dur;
}

function setHint(text) {
  hintEl.textContent = text;
}

// --- Wave control ---

function tryStartNextWave({ skipped = false } = {}) {
  if (game.state !== STATE.READY) return false;
  if (game.wave >= TOTAL_WAVES) return false;
  const nextWave = game.wave + 1;
  if (!startWave(nextWave)) return false;
  game.state = STATE.RUNNING;
  game.cooldown = 0;
  if (skipped) {
    // Small bonus for skipping — encourages aggressive play.
    game.money += 5;
  }
  audio.waveStart();
  setBanner(nextWave % 4 === 0 ? `BOSS WAVE ${nextWave}` : `WAVE ${nextWave}`, 1.4);
  updateHud();
  return true;
}

function onWaveCleared() {
  game.wave++;
  // Reward + cooldown.
  const bonus = 20 + game.wave * 4;
  game.money += bonus;
  audio.waveClear();
  if (game.wave >= TOTAL_WAVES) {
    game.state = STATE.WON;
    audio.stopMusic();
    audio.victory();
    persistBest();
    setHint('victory! click to play again');
    return;
  }
  game.state = STATE.READY;
  game.cooldown = WAVE_COOLDOWN;
  setBanner(`WAVE CLEAR · +¢${bonus}`, 1.6);
  setHint('next wave incoming · SPACE to start');
  persistBest();
  updateHud();
}

function persistBest() {
  if (game.wave > game.best) {
    game.best = game.wave;
    localStorage.setItem(STORAGE.BEST, String(game.best));
  }
}

// --- Input helpers ---

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * W;
  const y = ((e.clientY - rect.top) / rect.height) * H;
  return { x, y };
}

function selectTowerKey(key) {
  if (!TOWERS[key]) return;
  if (game.selectedKey === key) {
    game.selectedKey = null;
    setHint('press 1/2/3 or click a button to select');
  } else {
    game.selectedKey = key;
    game.selectedTowerId = null;
    setHint(`placing ${TOWERS[key].name} · click empty tile · ESC to cancel`);
  }
}

function tryBuild(col, row) {
  const key = game.selectedKey;
  if (!key) return false;
  const tw = TOWERS[key];
  if (!buildable[row] || !buildable[row][col]) {
    audio.invalid();
    return false;
  }
  if (game.money < tw.levels[0].cost) {
    audio.invalid();
    setHint(`not enough credits for ${tw.name}`);
    return false;
  }
  const t = buildTower(key, col, row);
  if (!t) { audio.invalid(); return false; }
  game.money -= tw.levels[0].cost;
  audio.build();
  spawnBurst(t.x, t.y, tw.color, 8, 70, 0.5, 1.2);
  // Keep the tower selected so the player can rapidly place several.
  setHint(`placed ${tw.name} · click another tile or press number to switch`);
  updateHud();
  return true;
}

function tryUpgradeSelected() {
  const t = towers.find((x) => x.id === game.selectedTowerId);
  if (!t) return;
  const cost = nextUpgradeCost(t);
  if (cost == null) { audio.invalid(); return; }
  if (game.money < cost) { audio.invalid(); setHint(`upgrade costs ¢${cost}`); return; }
  game.money -= cost;
  upgradeTower(t);
  audio.upgrade();
  spawnBurst(t.x, t.y, t.def.color, 10, 90, 0.45, 1.4);
  updateHud();
}

function trySellSelected() {
  const t = towers.find((x) => x.id === game.selectedTowerId);
  if (!t) return;
  const refund = sellTower(t);
  game.money += refund;
  audio.sell();
  spawnBurst(t.x, t.y, t.def.color, 8, 60, 0.4, 1.0);
  game.selectedTowerId = null;
  updateHud();
}

function togglePause() {
  if (game.state === STATE.PAUSED) {
    game.state = game.prePauseState || STATE.READY;
    audio.startMusic();
    setHint('resumed');
  } else if (game.state === STATE.READY || game.state === STATE.RUNNING) {
    game.prePauseState = game.state;
    game.state = STATE.PAUSED;
    audio.stopMusic();
    setHint('paused · P or Esc to resume');
  }
}

// --- Input wiring ---

window.addEventListener('keydown', (e) => {
  // Prevent SPACE from scrolling and firing the action twice when focused.
  if (['Space', 'KeyM', 'KeyP', 'Escape', 'Digit1', 'Digit2', 'Digit3', 'KeyU', 'KeyS'].includes(e.code)) {
    e.preventDefault();
  }
  audio.init();
  audio.resume();

  if (e.code === 'KeyM') {
    audio.toggleMuted();
    updateSoundToggleUI();
    return;
  }

  if (game.state === STATE.INTRO) {
    if (e.code === 'Space' || e.code === 'Enter') resetGame();
    return;
  }
  if (game.state === STATE.WON || game.state === STATE.LOST) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR') resetGame();
    return;
  }

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (e.code === 'Escape' && game.selectedKey) {
      game.selectedKey = null;
      setHint('cancelled · click a button or press 1/2/3');
      return;
    }
    if (e.code === 'Escape' && game.selectedTowerId != null) {
      game.selectedTowerId = null;
      return;
    }
    togglePause();
    return;
  }

  if (game.state === STATE.PAUSED) return;

  if (e.code === 'Digit1') selectTowerKey(TOWER_KEYS[0]);
  else if (e.code === 'Digit2') selectTowerKey(TOWER_KEYS[1]);
  else if (e.code === 'Digit3') selectTowerKey(TOWER_KEYS[2]);
  else if (e.code === 'Space') {
    // Start the next wave (skip cooldown).
    if (game.state === STATE.READY) tryStartNextWave({ skipped: true });
  } else if (e.code === 'KeyU') {
    tryUpgradeSelected();
  } else if (e.code === 'KeyS') {
    trySellSelected();
  }
});

canvas.addEventListener('mousemove', (e) => {
  const { x, y } = canvasCoords(e);
  game.mouse.x = x;
  game.mouse.y = y;
  game.hoverButton = buttonHitTest(x, y, TOWER_KEYS.length);
  if (y < FIELD_TOP) {
    game.hover.c = -1; game.hover.r = -1;
    game.hoverTower = null;
    return;
  }
  const t = pickTile(x, y);
  if (t) { game.hover.c = t.c; game.hover.r = t.r; }
  else { game.hover.c = -1; game.hover.r = -1; }
  game.hoverTower = pickTower(x, y);
});

canvas.addEventListener('mouseleave', () => {
  game.hoverButton = -1;
  game.hover.c = -1; game.hover.r = -1;
  game.hoverTower = null;
});

canvas.addEventListener('click', (e) => {
  audio.init();
  audio.resume();
  const { x, y } = canvasCoords(e);

  if (game.state === STATE.INTRO) { resetGame(); return; }
  if (game.state === STATE.WON || game.state === STATE.LOST) { resetGame(); return; }
  if (game.state === STATE.PAUSED) { togglePause(); return; }

  // Click a tower-buy button?
  const btn = buttonHitTest(x, y, TOWER_KEYS.length);
  if (btn >= 0) {
    selectTowerKey(TOWER_KEYS[btn]);
    return;
  }

  // Click an existing tower?
  const t = pickTower(x, y);
  if (t) {
    // If we were placing, selecting an existing tower exits placement.
    game.selectedKey = null;
    game.selectedTowerId = t.id;
    setHint(`${t.def.name} L${t.level} · U upgrade · S sell`);
    return;
  }

  // Click an empty tile while placing → build.
  if (game.selectedKey) {
    const tile = pickTile(x, y);
    if (tile) tryBuild(tile.c, tile.r);
    return;
  }

  // Click empty space without selecting anything → deselect.
  game.selectedTowerId = null;
});

soundToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.init();
  audio.resume();
  audio.toggleMuted();
  updateSoundToggleUI();
});

// --- Update ---

function update(dt) {
  game.pulseT += dt;
  if (game.bannerT > 0) game.bannerT -= dt;

  // Particles always update (so death pops finish even on pause-edge).
  updateParticles(dt);

  if (game.state === STATE.INTRO || game.state === STATE.PAUSED ||
      game.state === STATE.WON || game.state === STATE.LOST) {
    return;
  }

  if (game.state === STATE.READY) {
    game.cooldown -= dt;
    if (game.cooldown <= 0) tryStartNextWave({ skipped: false });
  }

  updateTowers(dt, onTowerFire);
  updateProjectiles(dt, onEnemyKilled);
  updateEnemies(dt, onEnemyLeaked);

  if (game.state === STATE.RUNNING) {
    updateWaves(dt);
    if (isWaveSpawningDone() && enemies.length === 0 && !isWaveActive()) {
      onWaveCleared();
    }
  }
}

function onEnemyLeaked(e) {
  game.lives -= e.def.damage;
  audio.loseLife();
  setBanner(`-${e.def.damage} ♥`, 0.6);
  if (game.lives <= 0) {
    game.lives = 0;
    game.state = STATE.LOST;
    audio.stopMusic();
    audio.defeat();
    persistBest();
    setHint('overrun · click to retry');
  }
  updateHud();
}

function onEnemyKilled(e) {
  game.money += e.def.value;
  if (e.kind === 'boss') audio.bossKill();
  else audio.enemyKill();
  updateHud();
}

function onTowerFire(key) {
  if (key === 'bolt') audio.fireBolt();
  else if (key === 'pulse') audio.firePulse();
  else if (key === 'spike') audio.fireSpike();
}

// --- Render ---

function render() {
  drawBackground(ctx);
  drawPath(ctx);

  // Range preview for selected placed tower.
  const sel = game.selectedTowerId != null ? towers.find((t) => t.id === game.selectedTowerId) : null;
  if (sel) {
    const stats = towerStats(sel);
    drawRangeCircle(ctx, sel.x, sel.y, stats.range, sel.def.color);
  }

  drawTowers(ctx, { selectedId: game.selectedTowerId });
  drawEnemies(ctx);
  drawProjectiles(ctx);
  drawParticles(ctx);

  // Build ghost
  if (game.selectedKey && game.hover.c >= 0) {
    const valid = !!buildable[game.hover.r] && buildable[game.hover.r][game.hover.c];
    const tw = TOWERS[game.selectedKey];
    const canAfford = game.money >= tw.levels[0].cost;
    drawBuildGhost(ctx, game.selectedKey, game.hover.c, game.hover.r, valid && canAfford);
  }

  // Hover ring on a placed tower (when not currently building).
  if (!game.selectedKey && game.hoverTower && game.hoverTower.id !== game.selectedTowerId) {
    const t = game.hoverTower;
    drawRangeCircle(ctx, t.x, t.y, towerStats(t).range, t.def.color, 0.18);
  }

  // HUD strip + tower buttons.
  drawHudStrip(ctx, {
    wave: game.state === STATE.RUNNING ? Math.min(TOTAL_WAVES, game.wave + 1) : game.wave,
    total: TOTAL_WAVES,
    lives: game.lives,
    money: game.money,
    status: game.state === STATE.READY ? 'ready'
          : game.state === STATE.RUNNING ? 'running'
          : game.state === STATE.PAUSED ? 'paused'
          : game.state === STATE.WON ? 'won'
          : game.state === STATE.LOST ? 'lost'
          : 'ready',
    cooldown: Math.max(0, game.cooldown),
  });
  drawTowerButtons(ctx, {
    towers: TOWERS,
    keys: TOWER_KEYS,
    selectedKey: game.selectedKey,
    money: game.money,
    hoverKey: game.hoverButton >= 0 ? TOWER_KEYS[game.hoverButton] : null,
    pulseT: game.pulseT,
  });

  // Selected-tower info panel
  if (sel) drawTowerInfo(ctx, sel);

  // Floating banner
  if (game.bannerT > 0 && game.banner) {
    const a = Math.min(1, game.bannerT * 1.2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    ctx.fillStyle = COLORS.path;
    ctx.shadowColor = COLORS.path;
    ctx.shadowBlur = 14;
    ctx.fillText(game.banner, W / 2, H / 2 - 60);
    ctx.restore();
  }

  // State overlays
  if (game.state === STATE.INTRO) {
    drawCenteredOverlay(ctx, {
      title: 'NEON TOWER DEFENSE',
      subtitle: [
        '12 waves · place towers · don\'t let shapes leak',
        game.best > 0 ? `best: wave ${game.best}` : 'click or press SPACE to begin',
      ],
      accent: COLORS.path,
    });
  } else if (game.state === STATE.PAUSED) {
    drawCenteredOverlay(ctx, {
      title: 'PAUSED',
      subtitle: 'P or Esc to resume',
      accent: COLORS.hudDim,
    });
  } else if (game.state === STATE.WON) {
    drawCenteredOverlay(ctx, {
      title: 'GRID SECURED',
      subtitle: [`survived all ${TOTAL_WAVES} waves`, 'click or press SPACE to play again'],
      accent: COLORS.ok,
    });
  } else if (game.state === STATE.LOST) {
    drawCenteredOverlay(ctx, {
      title: 'GRID OVERRUN',
      subtitle: [
        `reached wave ${game.wave + 1}/${TOTAL_WAVES}`,
        game.wave >= game.best && game.best > 0 ? 'new best!' : '',
        'click or press SPACE to retry',
      ].filter(Boolean),
      accent: COLORS.bad,
    });
  }
}

function drawTowerInfo(ctx, t) {
  const stats = towerStats(t);
  const w = 132;
  const h = 56;
  // Place panel near tower but constrained to the canvas.
  let px = t.x + 12;
  let py = t.y - h / 2;
  if (px + w > W - 4) px = t.x - w - 12;
  if (py < FIELD_TOP + 4) py = FIELD_TOP + 4;
  if (py + h > H - 56) py = H - 56 - h;

  ctx.save();
  ctx.shadowColor = t.def.color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = rgba(t.def.color, 0.10);
  ctx.strokeStyle = t.def.color;
  ctx.lineWidth = 1.2;
  roundRect(ctx, px, py, w, h, 5);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = t.def.color;
  ctx.font = "bold 11px 'SF Mono', ui-monospace, Menlo, monospace";
  ctx.fillText(`${t.def.name}  L${t.level}`, px + 8, py + 6);

  ctx.fillStyle = rgba(COLORS.hud, 0.85);
  ctx.font = "9px 'SF Mono', ui-monospace, Menlo, monospace";
  ctx.fillText(`DMG ${stats.dmg}   RNG ${stats.range}`, px + 8, py + 22);
  const rateText = `RoF ${stats.rate.toFixed(2)}s`;
  const extra = stats.aoe > 0 ? `   AOE ${stats.aoe}`
              : stats.pierce > 1 ? `   PIERCE ${stats.pierce}`
              : stats.slow > 0 ? `   SLOW ${(stats.slow * 100) | 0}%`
              : '';
  ctx.fillText(rateText + extra, px + 8, py + 34);

  // Upgrade / sell footer
  const refund = Math.round(t.invested * 0.7);
  const upCost = nextUpgradeCost(t);
  ctx.fillStyle = upCost == null ? rgba(COLORS.hudDim, 0.7) : COLORS.ok;
  ctx.shadowColor = COLORS.ok;
  ctx.shadowBlur = upCost == null ? 0 : 4;
  ctx.fillText(upCost == null ? 'MAX' : `U: ¢${upCost}`, px + 8, py + 46);
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba(COLORS.hud, 0.7);
  ctx.fillText(`S: +¢${refund}`, px + 70, py + 46);
  ctx.restore();
}

// --- Loop ---

let last = 0;
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
