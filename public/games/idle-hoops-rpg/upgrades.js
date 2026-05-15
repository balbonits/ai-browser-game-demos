// Upgrades shop — permanent multipliers bought with money.

export const MAX_UPGRADE_LEVEL = 10;

export const UPGRADES = [
  {
    id: 'trainingFacility',
    name: 'Training Facility',
    description: 'Upgrade the gym to accelerate player development.',
    baseCost: 100_000,
    effectText: '+10% XP gain per level (max +100%)',
  },
  {
    id: 'scouting',
    name: 'Scouting Department',
    description: 'Find better prospects in the draft.',
    baseCost: 80_000,
    effectText: '+3% rookie stat floor per level at draft',
  },
  {
    id: 'gymEquipment',
    name: 'Gym Equipment',
    description: 'Better equipment means more gains in training camp.',
    baseCost: 120_000,
    effectText: '+1 extra stat point per level during training camp',
  },
  {
    id: 'medicalStaff',
    name: 'Medical Staff',
    description: 'Protect veteran players from age-related decline.',
    baseCost: 90_000,
    effectText: '-5% age decline chance per level (caps at 0% chance at Lv.5)',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Grow revenue and fan base faster.',
    baseCost: 100_000,
    effectText: '+10% money and fan gain per level',
  },
];

/**
 * Cost to purchase the next level of an upgrade.
 * @param {string} id - upgrade ID
 * @param {number} currentLevel - current level (0..MAX_UPGRADE_LEVEL)
 * @returns {number} cost in money, or Infinity if at cap
 */
export function costFor(id, currentLevel) {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return Infinity;
  const upgrade = UPGRADES.find(u => u.id === id);
  if (!upgrade) return Infinity;
  return Math.round(upgrade.baseCost * Math.pow(currentLevel + 1, 1.5));
}

/**
 * Whether the player can afford the next level of an upgrade.
 * @param {object} state - full SaveState
 * @param {string} id - upgrade ID
 * @returns {boolean}
 */
export function canAfford(state, id) {
  const level = (state.upgrades ?? {})[id] ?? 0;
  return state.team.money >= costFor(id, level);
}

/**
 * Attempt to purchase the next level of an upgrade.
 * Mutates state if successful.
 * @param {object} state - full SaveState
 * @param {string} id - upgrade ID
 * @returns {boolean} true if purchased, false if unaffordable or at cap
 */
export function applyPurchase(state, id) {
  const upgrades = state.upgrades ?? {};
  const level = upgrades[id] ?? 0;
  if (level >= MAX_UPGRADE_LEVEL) return false;
  const cost = costFor(id, level);
  if (state.team.money < cost) return false;

  state.team.money -= cost;
  if (!state.upgrades) state.upgrades = defaultUpgrades();
  state.upgrades[id] = level + 1;
  return true;
}

/**
 * Default upgrades object — all levels at 0.
 * @returns {object}
 */
export function defaultUpgrades() {
  return {
    trainingFacility: 0,
    scouting: 0,
    gymEquipment: 0,
    medicalStaff: 0,
    marketing: 0,
  };
}
