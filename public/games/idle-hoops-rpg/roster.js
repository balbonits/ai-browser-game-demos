// Initial roster generation — fully deterministic via the passed-in RNG.
// 8 players, one per starting lineup slot + bench.

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

// Small name pools to keep the binary tiny.
const FIRST_NAMES = [
  'Alex', 'Jordan', 'Marcus', 'DeShawn', 'Tyler',
  'Zion', 'Malik', 'Devon', 'Chris', 'Andre',
  'Isaiah', 'Jaylen', 'Trey', 'Kendall', 'Darius',
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Davis', 'Brown',
  'Jones', 'Miller', 'Wilson', 'Moore', 'Taylor',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
];

const EMOJIS = ['🏀', '🏃', '⛹️', '🏋️', '🤾', '🙌', '💪', '🌟'];

// Stat weights by position. Values are relative weights for
// [shooting, defense, athleticism, iq].
const STAT_WEIGHTS = {
  PG: [1, 1, 2, 3],
  SG: [3, 1, 2, 1],
  SF: [2, 2, 2, 1],
  PF: [1, 2, 2, 2],
  C:  [1, 3, 2, 1],
};

/**
 * Roll a single stat given position weighting.
 * Returns a value in [40, 70] weighted by position.
 */
function rollStat(rng, positionWeight) {
  const base = 40 + rng.range(0, 20);
  const bonus = rng.range(0, positionWeight * 3);
  return Math.min(99, base + bonus);
}

/**
 * Generate the initial 8-player roster using rng.
 * @param {object} rng - makeRng instance
 * @returns {Player[]}
 */
export function generateRoster(rng) {
  const roster = [];

  // 5 starters (one per position) + 3 bench (random positions).
  const positions = [...POSITIONS, ...POSITIONS.slice(0, 3).map(p => p)];
  // Shuffle the bench positions to be a bit random.
  const benchPositions = [POSITIONS[rng.range(0, 4)], POSITIONS[rng.range(0, 4)], POSITIONS[rng.range(0, 4)]];
  const allPositions = [...POSITIONS, ...benchPositions];

  const usedNames = new Set();

  for (let i = 0; i < 8; i++) {
    let firstName, lastName, fullName;
    // Avoid duplicate full names.
    let attempts = 0;
    do {
      firstName = rng.pick(FIRST_NAMES);
      lastName = rng.pick(LAST_NAMES);
      fullName = `${firstName} ${lastName}`;
      attempts++;
    } while (usedNames.has(fullName) && attempts < 20);
    usedNames.add(fullName);

    const position = allPositions[i];
    const weights = STAT_WEIGHTS[position];
    const player = {
      name: fullName,
      emoji: EMOJIS[i % EMOJIS.length],
      position,
      level: 1,
      xp: 0,
      stats: {
        shooting:    rollStat(rng, weights[0]),
        defense:     rollStat(rng, weights[1]),
        athleticism: rollStat(rng, weights[2]),
        iq:          rollStat(rng, weights[3]),
      },
      morale: 80 + rng.range(0, 20),
      age: 19 + rng.range(0, 12),
      contractYears: rng.range(1, 4),
      contractValue: (rng.range(1, 10)) * 100_000,
    };
    roster.push(player);
  }

  return roster;
}
