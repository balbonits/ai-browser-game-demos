// Idle Hoops RPG — entry point.
//
// Responsibilities:
//   - Load save or create fresh state.
//   - Run offline catch-up (runTick N times).
//   - Mount DOM UI and start tick interval.
//   - Register window.__gameTest (gated by ?test=1).

import { makeRng } from './rng.js';
import { encodeSave, decodeSave, loadSave, persistSave, wipeSave, SAVE_KEY, MUTE_KEY } from './save.js';
import { ticksDue } from './offline.js';
import { generateRoster } from './roster.js';
import { freshSeason } from './season.js';
import { runTick } from './sim.js';
import { mount, render, showWelcomeBack } from './ui.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// In test mode the tick interval is 100ms so E2E tests don't wait.
const IS_TEST = new URLSearchParams(location.search).has('test');
const TICK_MS = IS_TEST ? 100 : 30_000;

// Vacation cap: 30 days * 24h * 3600s / 30s = 86400 ticks.
const MAX_OFFLINE_TICKS = IS_TEST ? 10_000 : 86_400;

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

let state = null;   // SaveState
let rng = null;     // makeRng instance — shared cursor
let paused = false;
let tickIntervalId = null;

// ---------------------------------------------------------------------------
// State creation
// ---------------------------------------------------------------------------

function newState(seedStr) {
  const r = makeRng(seedStr, 0);
  const roster = generateRoster(r);
  const s = {
    v: 1,
    seed: seedStr,
    rngCursor: r.cursor,
    lastTickAt: Date.now(),
    team: {
      name: 'Your Team',
      money: 1_000_000,
      fans: 10_000,
      rings: 0,
      seasonsPlayed: 0,
    },
    roster,
    season: freshSeason(),
  };
  return s;
}

function freshSeed() {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
  }
}

// ---------------------------------------------------------------------------
// Tick execution
// ---------------------------------------------------------------------------

function doTick() {
  if (!state || paused) return;
  rng = makeRng(state.seed, state.rngCursor);
  const event = runTick(state, rng);
  state.rngCursor = rng.cursor;
  state.lastTickAt = Date.now();
  persistSave(state);
  rerender();
  return event;
}

function rerender() {
  render(state, {
    paused,
    tickMs: TICK_MS,
    saveString: encodeSave(state),
  });
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', e => {
  if (e.key === ' ') {
    e.preventDefault();
    paused = !paused;
    rerender();
  } else if (e.key === 'r' || e.key === 'R') {
    // Handled by UI reset confirm modal
  } else if (e.key === 'm' || e.key === 'M') {
    // Mute reserved for v0.2
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  // Try loading persisted save.
  const saved = loadSave();

  if (saved) {
    state = saved;
    rng = makeRng(state.seed, state.rngCursor);

    // Offline catch-up.
    const due = ticksDue(Date.now(), state.lastTickAt, TICK_MS, MAX_OFFLINE_TICKS);
    if (due > 0) {
      const beforeWins = state.season.wins;
      const beforeLosses = state.season.losses;
      const beforeMoney = state.team.money;
      const beforeRings = state.team.rings;
      let levelUpCount = 0;

      for (let i = 0; i < due; i++) {
        rng = makeRng(state.seed, state.rngCursor);
        const ev = runTick(state, rng);
        state.rngCursor = rng.cursor;
        if (ev.levelUps) levelUpCount += ev.levelUps.length;
      }
      state.lastTickAt = Date.now();
      persistSave(state);

      // Show welcome-back modal.
      showWelcomeBack({
        ticks: due,
        wins: state.season.wins - beforeWins,
        losses: state.season.losses - beforeLosses,
        money: state.team.money - beforeMoney,
        rings: state.team.rings - beforeRings,
        levelUps: levelUpCount,
      });
    }
  } else {
    // Fresh start.
    state = newState(freshSeed());
    rng = makeRng(state.seed, state.rngCursor);
    persistSave(state);
  }

  // Mount UI.
  mount(document.getElementById('app'), {
    onReset: resetSave,
    onPause: () => { paused = !paused; rerender(); },
    onCopySettings: () => {},
    onImport: () => {
      const s = prompt('Paste save string:');
      if (s) {
        const decoded = decodeSave(s);
        if (decoded) {
          state = decoded;
          rng = makeRng(state.seed, state.rngCursor);
          persistSave(state);
          rerender();
        } else {
          alert('Invalid save string.');
        }
      }
    },
  });

  rerender();

  // Start tick interval.
  tickIntervalId = setInterval(doTick, TICK_MS);
}

function resetSave() {
  wipeSave();
  clearInterval(tickIntervalId);
  state = newState(freshSeed());
  rng = makeRng(state.seed, state.rngCursor);
  persistSave(state);
  rerender();
  tickIntervalId = setInterval(doTick, TICK_MS);
}

// ---------------------------------------------------------------------------
// Test hook — gated by ?test=1
// ---------------------------------------------------------------------------

if (IS_TEST) {
  window.__gameTest = {
    // Read accessors.
    getState: () => {
      if (!state) return 'loading';
      if (paused) return 'paused';
      if (state.season.phase === 'offseason') return 'offseason';
      return 'playing';
    },
    getSeed:     () => state?.seed ?? null,
    getDay:      () => state?.season?.day ?? 0,
    getPhase:    () => state?.season?.phase ?? 'regular',
    getRecord:   () => ({ wins: state?.season?.wins ?? 0, losses: state?.season?.losses ?? 0 }),
    getMoney:    () => state?.team?.money ?? 0,
    getFans:     () => state?.team?.fans ?? 0,
    getRings:    () => state?.team?.rings ?? 0,
    getRoster:   () => JSON.parse(JSON.stringify(state?.roster ?? [])),
    getSchedule: () => JSON.parse(JSON.stringify(state?.season?.schedule ?? [])),
    getSaveString: () => state ? encodeSave(state) : null,
    getDecoded:  () => {
      const ss = state ? encodeSave(state) : null;
      return ss ? decodeSave(ss) : null;
    },

    // TEST ONLY mutators.
    triggerTick: (n = 1) => {
      for (let i = 0; i < n; i++) doTick();
    },
    setLastTickAt: (ms) => {
      if (!state) return;
      state.lastTickAt = ms;
      persistSave(state);
    },
    forceSeed: (s) => {
      wipeSave();
      clearInterval(tickIntervalId);
      state = newState(s);
      rng = makeRng(state.seed, state.rngCursor);
      persistSave(state);
      rerender();
      tickIntervalId = setInterval(doTick, TICK_MS);
    },
    clearSave: () => {
      wipeSave();
    },
  };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

boot();
