// Single-string save encoding and decoding.
//
// Format: "<8-char-hex-hash>:<base64Payload>"
// where base64Payload = btoa(JSON.stringify(saveState))
// and hash = 8 hex chars from djb2(base64Payload).
//
// On decode: recompute hash, compare, reject mismatches.
// On decode: accept v === 2 directly; migrate v === 1 via migrateV1ToV2.
// Anything else → null (fresh start).

import { djb2 } from './rng.js';
import { defaultUpgrades } from './upgrades.js';

export const SAVE_KEY = 'idle-hoops-rpg:save:v1';
export const MUTE_KEY = 'idle-hoops-rpg:muted';
const SCHEMA_VERSION = 2;

/**
 * Compute 8-char lowercase hex from djb2 of a string.
 */
export function hashPayload(base64) {
  const raw = djb2(base64);
  return raw.toString(16).padStart(8, '0').slice(0, 8);
}

// Unicode-safe btoa/atob wrappers.
// Standard btoa() only accepts Latin1 bytes; emoji in player data are multi-byte.
// We percent-encode the JSON string first so every byte is ASCII before base64.
function toBase64(str) {
  // encodeURIComponent -> all non-ASCII become %XX escape sequences (ASCII).
  // unescape converts %XX back to single Latin1 bytes. Then btoa is safe.
  return btoa(unescape(encodeURIComponent(str)));
}

function fromBase64(b64) {
  // Reverse: atob -> Latin1 string, escape -> %XX, decodeURIComponent -> original.
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * Encode a SaveState to the save string format.
 * @param {object} state
 * @returns {string}  "<hash>:<base64>"
 */
export function encodeSave(state) {
  const payload = toBase64(JSON.stringify(state));
  const hash = hashPayload(payload);
  return `${hash}:${payload}`;
}

/**
 * Migrate a v1 SaveState to v2.
 * Best-effort: derives career wins/losses from season + seasonsPlayed.
 * @param {object} state - v1 SaveState
 * @returns {object} - v2 SaveState
 */
export function migrateV1ToV2(state) {
  // Best-effort career total: assume ~41 wins per past season (league-average).
  // Current season wins/losses are accurate; past seasons are estimated.
  const pastSeasons = state.team?.seasonsPlayed ?? 0;
  const estimatedPastWins   = pastSeasons * 41;
  const estimatedPastLosses = pastSeasons * 41;
  const currentWins   = state.season?.wins   ?? 0;
  const currentLosses = state.season?.losses ?? 0;

  return {
    ...state,
    v: 2,
    career: {
      totalWins:   estimatedPastWins   + currentWins,
      totalLosses: estimatedPastLosses + currentLosses,
    },
    upgrades: defaultUpgrades(),
    achievements: [],
  };
}

/**
 * Decode a save string back to a SaveState, or return null on failure.
 * Fails on: hash mismatch, unknown version, JSON parse error.
 * - v === 2 → accepted as-is
 * - v === 1 → migrated to v2 via migrateV1ToV2
 * - anything else → null
 * @param {string} str
 * @returns {object|null}
 */
export function decodeSave(str) {
  if (typeof str !== 'string' || !str.includes(':')) return null;
  const colonIdx = str.indexOf(':');
  const storedHash = str.slice(0, colonIdx);
  const payload = str.slice(colonIdx + 1);
  try {
    const expectedHash = hashPayload(payload);
    if (storedHash !== expectedHash) return null;
    const decoded = JSON.parse(fromBase64(payload));
    if (!decoded) return null;
    if (decoded.v === SCHEMA_VERSION) return decoded;           // v2 — use as-is
    if (decoded.v === 1) return migrateV1ToV2(decoded);        // v1 — migrate
    return null;                                               // unknown version
  } catch {
    return null;
  }
}

/**
 * Load the save from localStorage; returns null if absent or invalid.
 */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return decodeSave(raw);
  } catch {
    return null;
  }
}

/**
 * Persist the save state to localStorage.
 */
export function persistSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, encodeSave(state));
  } catch {}
}

/**
 * Wipe the save from localStorage.
 */
export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}
