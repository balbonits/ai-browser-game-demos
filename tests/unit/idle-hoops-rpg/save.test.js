import { describe, it, expect } from 'vitest';
import { encodeSave, decodeSave, hashPayload } from '../../../public/games/idle-hoops-rpg/save.js';

// Minimal valid SaveState for roundtrip tests.
function minimalState(overrides = {}) {
  return {
    v: 1,
    seed: 'test-seed',
    rngCursor: 0,
    lastTickAt: 1_700_000_000_000,
    team: {
      name: 'Test Team',
      money: 500_000,
      fans: 5_000,
      rings: 0,
      seasonsPlayed: 0,
    },
    roster: [],
    season: {
      day: 0,
      wins: 0,
      losses: 0,
      schedule: [],
      phase: 'regular',
      playoff: null,
    },
    ...overrides,
  };
}

describe('hashPayload', () => {
  it('returns exactly 8 hex characters', () => {
    expect(hashPayload('somebase64payload')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    const s = 'any-string';
    expect(hashPayload(s)).toBe(hashPayload(s));
  });

  it('different inputs produce different hashes (sanity)', () => {
    expect(hashPayload('aaa')).not.toBe(hashPayload('bbb'));
  });
});

describe('encodeSave / decodeSave — roundtrip', () => {
  it('roundtrip preserves all top-level fields', () => {
    const state = minimalState();
    const decoded = decodeSave(encodeSave(state));
    expect(decoded).not.toBeNull();
    expect(decoded.v).toBe(1);
    expect(decoded.seed).toBe('test-seed');
    expect(decoded.rngCursor).toBe(0);
    expect(decoded.lastTickAt).toBe(1_700_000_000_000);
  });

  it('roundtrip preserves team sub-object', () => {
    const state = minimalState({ team: { name: 'Cool Team', money: 999, fans: 42, rings: 2, seasonsPlayed: 3 } });
    const decoded = decodeSave(encodeSave(state));
    expect(decoded.team.name).toBe('Cool Team');
    expect(decoded.team.money).toBe(999);
    expect(decoded.team.rings).toBe(2);
    expect(decoded.team.seasonsPlayed).toBe(3);
  });

  it('roundtrip preserves season schedule array', () => {
    const schedule = [
      { day: 0, opponentRating: 55, teamRating: 60, ourScore: 98, oppScore: 87, win: true, topScorer: 'Alex Smith' },
    ];
    const state = minimalState({ season: { day: 1, wins: 1, losses: 0, schedule, phase: 'regular', playoff: null } });
    const decoded = decodeSave(encodeSave(state));
    expect(decoded.season.schedule).toHaveLength(1);
    expect(decoded.season.schedule[0].win).toBe(true);
    expect(decoded.season.schedule[0].topScorer).toBe('Alex Smith');
  });

  it('roundtrip preserves non-empty roster', () => {
    const roster = [{
      name: 'Alex Smith', emoji: '🏀', position: 'PG', level: 5, xp: 123,
      stats: { shooting: 70, defense: 60, athleticism: 65, iq: 80 },
      morale: 90, age: 25, contractYears: 2, contractValue: 500_000,
    }];
    const state = minimalState({ roster });
    const decoded = decodeSave(encodeSave(state));
    expect(decoded.roster).toHaveLength(1);
    expect(decoded.roster[0].name).toBe('Alex Smith');
    expect(decoded.roster[0].stats.iq).toBe(80);
  });
});

describe('decodeSave — rejection', () => {
  it('returns null for empty string', () => {
    expect(decodeSave('')).toBeNull();
  });

  it('returns null for string without colon', () => {
    expect(decodeSave('nocolon')).toBeNull();
  });

  it('returns null when hash is wrong (tampered payload)', () => {
    const encoded = encodeSave(minimalState());
    // Tamper: flip one char in the base64 payload.
    const colonIdx = encoded.indexOf(':');
    const tampered = encoded.slice(0, colonIdx + 1) + 'X' + encoded.slice(colonIdx + 2);
    expect(decodeSave(tampered)).toBeNull();
  });

  it('returns null when hash prefix is wrong (preserve payload)', () => {
    const encoded = encodeSave(minimalState());
    // Replace hash prefix with zeros.
    const colonIdx = encoded.indexOf(':');
    const badHash = '00000000';
    const tampered = badHash + encoded.slice(colonIdx);
    expect(decodeSave(tampered)).toBeNull();
  });

  it('returns null for version mismatch (v=2)', () => {
    const state = minimalState({ v: 2 });
    // Encode as-is (wrong version), compute proper hash.
    const encoded = encodeSave(state);
    // decodeSave will parse it but reject v !== 1.
    expect(decodeSave(encoded)).toBeNull();
  });

  it('returns null for completely invalid base64', () => {
    // Compute a real hash of the garbage so it gets past hash check... actually
    // we can just embed a known-bad string that won't survive atob().
    // Easiest: pass a string where the hash matches but base64 is invalid.
    // hashPayload of '!!!' is some value; we don't know it, so just pass
    // a string that won't survive the JSON.parse step.
    const garbage = hashPayload('valid') + ':valid';
    // payload = 'valid' which is not valid base64 with embedded JSON
    expect(decodeSave(garbage)).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(decodeSave(null)).toBeNull();
    expect(decodeSave(undefined)).toBeNull();
    expect(decodeSave(42)).toBeNull();
  });
});

describe('encodeSave format', () => {
  it('produces a string in "<8hex>:<base64>" format', () => {
    const encoded = encodeSave(minimalState());
    expect(encoded).toMatch(/^[0-9a-f]{8}:.+$/);
  });

  it('two encodes of the same state produce identical strings', () => {
    const state = minimalState();
    expect(encodeSave(state)).toBe(encodeSave(state));
  });
});
