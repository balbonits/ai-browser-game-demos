// Multipliers — single source of truth for how gains are multiplied.
// Pure derivation from upgrades + achievements. No mutation.

import { achievementMultipliers } from './achievements.js';

/**
 * Compute current effective multipliers from state.
 * Missing fields default to 0 so un-migrated (v1) states behave like baseline.
 * @param {object} state - full SaveState
 * @returns {{ money: number, xp: number }}
 */
export function computeMultipliers(state) {
  const u = state.upgrades ?? {};
  const a = achievementMultipliers(state);
  return {
    money: 1 + 0.10 * (u.marketing          ?? 0) + (a.money ?? 0),
    xp:    1 + 0.10 * (u.trainingFacility   ?? 0) + (a.xp   ?? 0),
  };
}
