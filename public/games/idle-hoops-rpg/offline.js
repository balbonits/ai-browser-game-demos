// Offline catch-up math — pure functions only.

/**
 * How many ticks are owed given elapsed time.
 *
 * @param {number} now        - current timestamp in ms (e.g. Date.now())
 * @param {number} lastTickAt - timestamp of last sim tick (ms)
 * @param {number} tickMs     - ms per tick (30000 in prod, 100 in test)
 * @param {number} maxTicks   - hard cap (86400 for 30-day vacation limit)
 * @returns {number}          - integer ticks to run; never negative
 */
export function ticksDue(now, lastTickAt, tickMs, maxTicks) {
  const elapsed = now - lastTickAt;
  if (elapsed <= 0) return 0;
  return Math.min(Math.floor(elapsed / tickMs), maxTicks);
}
