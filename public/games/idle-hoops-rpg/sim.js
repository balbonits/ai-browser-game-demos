// Simulation core — pure functions except runTick which mutates state.
//
// simulateGame(roster, opponentRating, rng) -> GameResult
// applyXp(roster, gameResult, rng) -> levelUp[]   (re-exported from season.js)
// runTick(state, rng) -> { events }
//   - Plays one game, updates state, handles phase transitions.

import { makeRng } from './rng.js';
import {
  teamRating,
  opponentRating as rollOpponentRating,
  freshSeason,
  buildPlayoffBracket,
  applyXp,
  agePlayers,
  xpForLevel,
  REGULAR_SEASON_GAMES,
  PLAYOFF_QUALIFY_WINS,
  OFFSEASON_PHASES,
} from './season.js';
import { generateRoster } from './roster.js';

export { xpForLevel, applyXp };

// ---------------------------------------------------------------------------
// simulateGame
// ---------------------------------------------------------------------------

/**
 * Simulate one basketball game and return a GameResult.
 * Fully deterministic given the same RNG state.
 *
 * @param {Player[]} roster
 * @param {number} oppRating
 * @param {object} rng
 * @returns {GameResult}
 */
export function simulateGame(roster, oppRating, rng) {
  const starters = roster.slice(0, 5);
  const tRating = teamRating(roster);

  const ourBase = tRating + rng.range(-15, 15);
  const oppBase = oppRating + rng.range(-15, 15);
  const ourScore = 80 + Math.round(ourBase / 3) + rng.range(0, 20);
  const oppScore = 80 + Math.round(oppBase / 3) + rng.range(0, 20);

  // Pick top scorer from starters — weighted by shooting + iq.
  const topScorer = pickTopScorer(starters, rng);

  return {
    opponentRating: oppRating,
    teamRating: tRating,
    ourScore,
    oppScore,
    win: ourScore > oppScore,
    topScorer: topScorer.name,
  };
}

function pickTopScorer(starters, rng) {
  // Weighted by (shooting + iq).
  const weights = starters.map(p => p.stats.shooting + p.stats.iq);
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng.range(0, total - 1);
  for (let i = 0; i < starters.length; i++) {
    if (roll < weights[i]) return starters[i];
    roll -= weights[i];
  }
  return starters[starters.length - 1];
}

// ---------------------------------------------------------------------------
// runTick
// ---------------------------------------------------------------------------

/**
 * Advance the simulation by one tick.
 * Mutates state in place.
 * Returns an event object describing what happened.
 *
 * @param {object} state  - full SaveState
 * @param {object} rng    - makeRng instance (shared cursor)
 * @returns {object}      - { type, gameResult?, levelUps?, ring? }
 */
export function runTick(state, rng) {
  const season = state.season;

  // --- Regular season ---
  if (season.phase === 'regular') {
    const tRating = teamRating(state.roster);
    const oppRating = rollOpponentRating(tRating, rng);
    const result = simulateGame(state.roster, oppRating, rng);
    result.day = season.day;

    season.schedule.push(result);
    if (result.win) {
      season.wins++;
      state.team.fans = Math.min(1_000_000, state.team.fans + rng.range(50, 200));
    } else {
      season.losses++;
      state.team.fans = Math.max(0, state.team.fans - rng.range(20, 80));
    }

    // Prize money per game.
    const gamePay = result.win ? rng.range(15_000, 50_000) : rng.range(5_000, 20_000);
    state.team.money += gamePay;
    state.team.money = Math.max(0, state.team.money);

    const levelUps = applyXp(state.roster, result, rng);

    season.day++;

    // Transition: end of regular season.
    if (season.day >= REGULAR_SEASON_GAMES) {
      if (season.wins >= PLAYOFF_QUALIFY_WINS) {
        season.phase = 'playoffs';
        season.playoff = buildPlayoffBracket(tRating, rng);
      } else {
        season.phase = 'offseason';
        season.playoff = null;
        _startOffseason(state);
      }
    }

    return { type: 'game', gameResult: result, levelUps };
  }

  // --- Playoffs ---
  if (season.phase === 'playoffs') {
    const pb = season.playoff;
    const result = simulateGame(state.roster, pb.opponentRating, rng);
    result.day = season.day;
    season.schedule.push(result);

    if (result.win) {
      pb.seriesWins++;
      state.team.fans = Math.min(1_000_000, state.team.fans + rng.range(200, 800));
      state.team.money += rng.range(50_000, 150_000);
    } else {
      pb.seriesLosses++;
    }

    state.team.money = Math.max(0, state.team.money);
    const levelUps = applyXp(state.roster, result, rng);
    season.day++;

    // Series over?
    let seriesEnded = false;
    let ringWon = false;

    if (pb.seriesWins >= 4) {
      // Won the series.
      if (pb.round >= 4) {
        // Championship!
        ringWon = true;
        state.team.rings++;
        state.team.money += 500_000;
        season.phase = 'offseason';
        _startOffseason(state);
      } else {
        // Advance round.
        pb.round++;
        pb.seriesWins = 0;
        pb.seriesLosses = 0;
        const tRating = teamRating(state.roster);
        pb.opponentRating = Math.min(99, tRating + (pb.round - 1) * 5 + rng.range(0, 8));
      }
      seriesEnded = true;
    } else if (pb.seriesLosses >= 4) {
      // Eliminated.
      season.phase = 'offseason';
      _startOffseason(state);
      seriesEnded = true;
    }

    return { type: 'playoff_game', gameResult: result, levelUps, seriesEnded, ringWon };
  }

  // --- Off-season ---
  if (season.phase === 'offseason') {
    return _tickOffseason(state, rng);
  }

  return { type: 'noop' };
}

// ---------------------------------------------------------------------------
// Off-season helpers
// ---------------------------------------------------------------------------

function _startOffseason(state) {
  state.season.offseasonPhase = 0; // index into OFFSEASON_PHASES
}

function _tickOffseason(state, rng) {
  const phaseIdx = state.season.offseasonPhase ?? 0;

  if (phaseIdx >= OFFSEASON_PHASES.length) {
    // Off-season complete -> new season.
    _beginNewSeason(state, rng);
    return { type: 'new_season' };
  }

  const phaseName = OFFSEASON_PHASES[phaseIdx];

  if (phaseName === 'draft') {
    // Auto-draft: pick a random young player to replace the worst bench player.
    const bench = state.roster.slice(5);
    const worstIdx = bench.reduce((wi, p, i) => {
      const sc = (p.stats.shooting + p.stats.defense + p.stats.athleticism + p.stats.iq) / 4;
      const wsc = (bench[wi].stats.shooting + bench[wi].stats.defense + bench[wi].stats.athleticism + bench[wi].stats.iq) / 4;
      return sc < wsc ? i : wi;
    }, 0);
    // Generate a fresh rookie to replace worst bench slot.
    const rookieRng = makeRng(state.seed + ':draft:' + state.team.seasonsPlayed, rng.cursor);
    const rookie = generateRoster(rookieRng)[0];
    rookie.age = 19 + rng.range(0, 3);
    rookie.level = 1;
    rookie.xp = 0;
    state.roster[5 + worstIdx] = rookie;
  } else if (phaseName === 'free_agency') {
    // Auto-FA: give a small morale/money boost.
    state.team.money = Math.max(0, state.team.money - rng.range(50_000, 200_000));
    for (const p of state.roster) {
      p.morale = Math.min(100, p.morale + rng.range(0, 10));
    }
  } else if (phaseName === 'training_camp') {
    // Training camp: +1 to a random stat for each player.
    for (const p of state.roster) {
      const key = ['shooting', 'defense', 'athleticism', 'iq'][rng.range(0, 3)];
      p.stats[key] = Math.min(99, p.stats[key] + 1);
    }
  }

  state.season.offseasonPhase = phaseIdx + 1;
  return { type: 'offseason', phase: phaseName };
}

function _beginNewSeason(state, rng) {
  agePlayers(state.roster, rng);
  state.team.seasonsPlayed++;
  // Reset season (keep roster, team stats).
  state.season = freshSeason();
  delete state.season.offseasonPhase;
}
