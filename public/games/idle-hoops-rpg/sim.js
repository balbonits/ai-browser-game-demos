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
import { computeMultipliers } from './multipliers.js';
import { evaluate } from './achievements.js';

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
 * @returns {object}      - { type, gameResult?, levelUps?, ring?, newAchievements? }
 */
export function runTick(state, rng) {
  // v2 field presence check:
  // If these fields exist (v2 save or migrated save), we track and mutate them.
  // If they are absent (v1 test fixture state), we leave state untouched so
  // replay / property test snapshots remain stable. computeMultipliers and
  // evaluate handle absent fields gracefully via null-coalescing reads.
  const hasCareer       = 'career'       in state;
  const hasAchievements = 'achievements' in state;
  // upgrades: computeMultipliers reads state.upgrades ?? {} — no mutation needed.

  const season = state.season;

  // --- Regular season ---
  if (season.phase === 'regular') {
    const mult = computeMultipliers(state);

    const tRating = teamRating(state.roster);
    const oppRating = rollOpponentRating(tRating, rng);
    const result = simulateGame(state.roster, oppRating, rng);
    result.day = season.day;

    season.schedule.push(result);
    if (result.win) {
      season.wins++;
      if (hasCareer) state.career.totalWins++;
      const fanGain = rng.range(50, 200);
      state.team.fans = Math.min(1_000_000, state.team.fans + Math.round(fanGain * mult.money));
    } else {
      season.losses++;
      if (hasCareer) state.career.totalLosses++;
      state.team.fans = Math.max(0, state.team.fans - rng.range(20, 80));
    }

    // Prize money per game, scaled by marketing multiplier.
    const baseGamePay = result.win ? rng.range(15_000, 50_000) : rng.range(5_000, 20_000);
    const gamePay = Math.round(baseGamePay * mult.money);
    state.team.money += gamePay;
    state.team.money = Math.max(0, state.team.money);

    const levelUps = applyXp(state.roster, result, rng, mult.xp);

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

    const newAchievements = hasAchievements ? evaluate(state) : [];
    return { type: 'game', gameResult: result, levelUps, newAchievements };
  }

  // --- Playoffs ---
  if (season.phase === 'playoffs') {
    const mult = computeMultipliers(state);

    const pb = season.playoff;
    const result = simulateGame(state.roster, pb.opponentRating, rng);
    result.day = season.day;
    season.schedule.push(result);

    if (result.win) {
      pb.seriesWins++;
      if (hasCareer) state.career.totalWins++;
      const fanGain = rng.range(200, 800);
      state.team.fans = Math.min(1_000_000, state.team.fans + Math.round(fanGain * mult.money));
      const playoffPay = rng.range(50_000, 150_000);
      state.team.money += Math.round(playoffPay * mult.money);
    } else {
      pb.seriesLosses++;
      if (hasCareer) state.career.totalLosses++;
    }

    state.team.money = Math.max(0, state.team.money);
    const levelUps = applyXp(state.roster, result, rng, mult.xp);
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

    const newAchievements = hasAchievements ? evaluate(state) : [];
    return { type: 'playoff_game', gameResult: result, levelUps, seriesEnded, ringWon, newAchievements };
  }

  // --- Off-season ---
  if (season.phase === 'offseason') {
    return _tickOffseason(state, rng, hasAchievements);
  }

  return { type: 'noop', newAchievements: [] };
}

// ---------------------------------------------------------------------------
// Off-season helpers
// ---------------------------------------------------------------------------

function _startOffseason(state) {
  state.season.offseasonPhase = 0; // index into OFFSEASON_PHASES
}

function _tickOffseason(state, rng, hasAchievements = false) {
  const phaseIdx = state.season.offseasonPhase ?? 0;

  if (phaseIdx >= OFFSEASON_PHASES.length) {
    // Off-season complete -> new season.
    _beginNewSeason(state, rng);
    const newAchievements = hasAchievements ? evaluate(state) : [];
    return { type: 'new_season', newAchievements };
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

    // Scouting upgrade: bump each stat by upgrade level (capped at 99).
    const scoutingLevel = (state.upgrades ?? {}).scouting ?? 0;
    if (scoutingLevel > 0) {
      for (const key of ['shooting', 'defense', 'athleticism', 'iq']) {
        rookie.stats[key] = Math.min(99, rookie.stats[key] + scoutingLevel);
      }
    }

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

    // gymEquipment: extra +1 stat boosts distributed across the roster.
    const gymLevel = (state.upgrades ?? {}).gymEquipment ?? 0;
    if (gymLevel > 0) {
      const statKeys = ['shooting', 'defense', 'athleticism', 'iq'];
      for (let boost = 0; boost < gymLevel; boost++) {
        // Pick a random player from the full roster and a random stat.
        const playerIdx = rng.range(0, state.roster.length - 1);
        const key = statKeys[rng.range(0, 3)];
        state.roster[playerIdx].stats[key] = Math.min(99, state.roster[playerIdx].stats[key] + 1);
      }
    }
  }

  state.season.offseasonPhase = phaseIdx + 1;
  const newAchievements = hasAchievements ? evaluate(state) : [];
  return { type: 'offseason', phase: phaseName, newAchievements };
}

function _beginNewSeason(state, rng) {
  const medicalLevel = (state.upgrades ?? {}).medicalStaff ?? 0;
  agePlayers(state.roster, rng, medicalLevel);
  state.team.seasonsPlayed++;
  // Reset season (keep roster, team stats).
  state.season = freshSeason();
  delete state.season.offseasonPhase;
}
