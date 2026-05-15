// Achievements — permanent milestone rewards that stack into multipliers.

export const ACHIEVEMENTS = [
  {
    id: 'first_win',
    name: 'First Win',
    description: 'Win your very first career game.',
    condition: (state) => (state.career?.totalWins ?? 0) >= 1,
    reward: { money: 0.05 },
  },
  {
    id: 'first_ring',
    name: 'Champion',
    description: 'Win your first championship ring.',
    condition: (state) => (state.team?.rings ?? 0) >= 1,
    reward: { money: 0.10, xp: 0.10 },
  },
  {
    id: 'dynasty_5',
    name: 'Dynasty',
    description: 'Win 5 championship rings.',
    condition: (state) => (state.team?.rings ?? 0) >= 5,
    reward: { money: 0.25, xp: 0.25 },
  },
  {
    id: 'wins_10',
    name: 'Getting Going',
    description: 'Accumulate 10 career wins.',
    condition: (state) => (state.career?.totalWins ?? 0) >= 10,
    reward: { xp: 0.05 },
  },
  {
    id: 'wins_100',
    name: 'Century Mark',
    description: 'Accumulate 100 career wins.',
    condition: (state) => (state.career?.totalWins ?? 0) >= 100,
    reward: { xp: 0.10 },
  },
  {
    id: 'wins_500',
    name: 'Win Machine',
    description: 'Accumulate 500 career wins.',
    condition: (state) => (state.career?.totalWins ?? 0) >= 500,
    reward: { xp: 0.20 },
  },
  {
    id: 'playoff_bound',
    name: 'Playoff Bound',
    description: 'Reach the playoffs for the first time.',
    condition: (state) => state.season?.phase === 'playoffs',
    reward: { money: 0.10 },
  },
  {
    id: 'filthy_rich',
    name: 'Filthy Rich',
    description: 'Accumulate $5,000,000 in team funds.',
    condition: (state) => (state.team?.money ?? 0) >= 5_000_000,
    reward: { money: 0.05 },
  },
  {
    id: 'sellout_crowd',
    name: 'Sellout Crowd',
    description: 'Attract 500,000 fans.',
    condition: (state) => (state.team?.fans ?? 0) >= 500_000,
    reward: { money: 0.10 },
  },
  {
    id: 'veteran_squad',
    name: 'Veteran Squad',
    description: 'Bring your roster\'s average level to 10 or higher.',
    condition: (state) => {
      const roster = state.roster ?? [];
      if (!roster.length) return false;
      const avg = roster.reduce((s, p) => s + (p.level ?? 1), 0) / roster.length;
      return avg >= 10;
    },
    reward: { xp: 0.05 },
  },
  {
    id: 'hall_of_fame',
    name: 'Hall of Famer',
    description: 'Develop any player to level 30 or higher.',
    condition: (state) => (state.roster ?? []).some(p => (p.level ?? 1) >= 30),
    reward: { xp: 0.05 },
  },
  {
    id: 'long_career',
    name: 'Long Career',
    description: 'Play through 5 complete seasons.',
    condition: (state) => (state.team?.seasonsPlayed ?? 0) >= 5,
    reward: { money: 0.05, xp: 0.05 },
  },
];

/**
 * Check all locked achievements. Unlock any whose condition is met.
 * Mutates state.achievements in place.
 * @param {object} state - full SaveState
 * @returns {string[]} newly unlocked achievement IDs
 */
export function evaluate(state) {
  if (!state.achievements) state.achievements = [];
  const unlocked = new Set(state.achievements);
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlocked.has(ach.id)) continue;
    try {
      if (ach.condition(state)) {
        state.achievements.push(ach.id);
        unlocked.add(ach.id);
        newlyUnlocked.push(ach.id);
      }
    } catch {
      // Defensive: never crash runTick because an achievement condition threw.
    }
  }

  return newlyUnlocked;
}

/**
 * Sum the reward multipliers across all unlocked achievements.
 * @param {object} state - full SaveState
 * @returns {{ money: number, xp: number }}
 */
export function achievementMultipliers(state) {
  const unlocked = new Set(state.achievements ?? []);
  let money = 0;
  let xp = 0;

  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.has(ach.id)) continue;
    money += ach.reward.money ?? 0;
    xp    += ach.reward.xp    ?? 0;
  }

  return { money, xp };
}
