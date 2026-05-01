// Season structure: schedule generation, playoff bracketing, off-season phases.
//
// Days 0-81:   regular season (82 games)
// Days 82-101: playoffs (up to 4 best-of-7 rounds = 28 games max)
// Day 102+:    off-season (draft -> FA -> camp, ~3 ticks each)

export const REGULAR_SEASON_GAMES = 82;
export const PLAYOFF_QUALIFY_WINS = 41;

// Off-season sub-phases consumed one tick each.
export const OFFSEASON_PHASES = ['draft', 'free_agency', 'training_camp'];

/**
 * Compute the average of an array of numbers.
 */
function avg(nums) {
  if (!nums.length) return 50;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

/**
 * Average rating of the team's starting 5.
 * We define starters as the first 5 players on the roster.
 */
export function teamRating(roster) {
  const starters = roster.slice(0, 5);
  const statSum = starters.map(p =>
    (p.stats.shooting + p.stats.defense + p.stats.athleticism + p.stats.iq) / 4
  );
  return Math.round(avg(statSum));
}

/**
 * Generate an opponent rating for a regular-season game.
 * Opponents cluster around the team rating with some noise.
 */
export function opponentRating(teamRating, rng) {
  const delta = rng.range(-15, 15);
  return Math.max(30, Math.min(99, teamRating + delta));
}

/**
 * Generate a fresh season object (no games played).
 */
export function freshSeason() {
  return {
    day: 0,
    wins: 0,
    losses: 0,
    schedule: [],
    phase: 'regular',
    playoff: null,
  };
}

/**
 * Build the initial playoff bracket state after qualifying.
 * 4 rounds; opponent ratings scale up each round.
 */
export function buildPlayoffBracket(teamRating, rng) {
  return {
    round: 1,           // 1..4
    seriesWins: 0,
    seriesLosses: 0,
    // Opponent ratings escalate: R1 = team+5, R2 = +10, R3 = +15, R4 = +20
    opponentRating: Math.min(99, teamRating + 5 + rng.range(0, 8)),
  };
}

/**
 * XP needed to reach the next level from level n.
 * Formula: 500 + n * 200
 */
export function xpForLevel(n) {
  return 500 + n * 200;
}

/**
 * Apply game result XP to all players.
 * win: top scorer +200, other starters +100, bench +50.
 * loss: halved.
 * Mutates roster in place; returns list of {player, oldLevel, newLevel} level-up events.
 */
export function applyXp(roster, gameResult, rng) {
  const mult = gameResult.win ? 1 : 0.5;
  const levelUps = [];

  for (let i = 0; i < roster.length; i++) {
    const player = roster[i];
    let xpGain;
    if (player.name === gameResult.topScorer) {
      xpGain = Math.round(200 * mult);
    } else if (i < 5) {
      xpGain = Math.round(100 * mult);
    } else {
      xpGain = Math.round(50 * mult);
    }
    player.xp += xpGain;

    // Level up loop — can gain multiple levels if XP is high enough.
    while (player.level < 99 && player.xp >= xpForLevel(player.level)) {
      player.xp -= xpForLevel(player.level);
      const oldLevel = player.level;
      player.level++;
      // +1 to one stat weighted by position.
      levelUpStat(player, rng);
      levelUps.push({ name: player.name, oldLevel, newLevel: player.level });
    }
  }

  return levelUps;
}

// Stat weights for level-up: [shooting, defense, athleticism, iq] relative probability.
const LEVELUP_WEIGHTS = {
  PG: [1, 1, 2, 3],
  SG: [3, 1, 2, 1],
  SF: [2, 2, 2, 1],
  PF: [1, 2, 2, 2],
  C:  [1, 3, 2, 1],
};

const STAT_KEYS = ['shooting', 'defense', 'athleticism', 'iq'];

function levelUpStat(player, rng) {
  const weights = LEVELUP_WEIGHTS[player.position] || [1, 1, 1, 1];
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng.range(0, total - 1);
  let chosen = 'shooting';
  for (let i = 0; i < STAT_KEYS.length; i++) {
    if (roll < weights[i]) { chosen = STAT_KEYS[i]; break; }
    roll -= weights[i];
  }
  player.stats[chosen] = Math.min(99, player.stats[chosen] + 1);
}

/**
 * Age all players by one season.
 * After age 30, 25% chance per season to lose -1 athleticism.
 * Retires players at age 40 (removes from roster, replaced by a fresh rookie).
 * Mutates roster in place.
 */
export function agePlayers(roster, rng) {
  for (const player of roster) {
    player.age++;
    player.contractYears = Math.max(0, player.contractYears - 1);
    if (player.age > 30) {
      // 25% chance of -1 athleticism per season.
      if (rng.range(0, 3) === 0) {
        player.stats.athleticism = Math.max(1, player.stats.athleticism - 1);
      }
    }
  }
}
