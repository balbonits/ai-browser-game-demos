import { describe, it, expect } from 'vitest';
import { encodeSave, decodeSave, hashPayload, migrateV1ToV2 } from '../../../public/games/idle-hoops-rpg/save.js';

// Minimal valid v1 SaveState — for migration / rejection tests.
function minimalStateV1(overrides = {}) {
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

// Minimal valid v2 SaveState — the current schema.
function minimalState(overrides = {}) {
  return {
    v: 2,
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
    career: { totalWins: 0, totalLosses: 0 },
    upgrades: { trainingFacility: 0, scouting: 0, gymEquipment: 0, medicalStaff: 0, marketing: 0 },
    achievements: [],
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
    expect(decoded.v).toBe(2);
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

  it('returns null for unknown future version (v=3)', () => {
    // v: 3 is not a known schema version — decode must reject it.
    const state = minimalState({ v: 3 });
    const encoded = encodeSave(state);
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

describe('v1 -> v2 migration', () => {
  it('v1 save migrates to v2 on decode: result has v=2', () => {
    const v1 = minimalStateV1();
    const encoded = encodeSave(v1);
    const decoded = decodeSave(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded.v).toBe(2);
  });

  it('v1 save migrates to v2 on decode: career, upgrades, achievements fields exist', () => {
    const v1 = minimalStateV1();
    const decoded = decodeSave(encodeSave(v1));
    expect(decoded).not.toBeNull();
    expect(decoded.career).toBeDefined();
    expect(typeof decoded.career.totalWins).toBe('number');
    expect(typeof decoded.career.totalLosses).toBe('number');
    expect(decoded.upgrades).toBeDefined();
    expect(Array.isArray(decoded.achievements)).toBe(true);
  });

  it('v1 migration preserves all v1 fields (seed, money, roster, season)', () => {
    const roster = [{
      name: 'Old Player', emoji: '🏀', position: 'C', level: 3, xp: 50,
      stats: { shooting: 60, defense: 70, athleticism: 55, iq: 65 },
      morale: 80, age: 28, contractYears: 1, contractValue: 200_000,
    }];
    const v1 = minimalStateV1({
      seed: 'migration-test',
      team: { name: 'Old Team', money: 750_000, fans: 8_000, rings: 1, seasonsPlayed: 3 },
      roster,
      season: { day: 10, wins: 6, losses: 4, schedule: [], phase: 'regular', playoff: null },
    });
    const decoded = decodeSave(encodeSave(v1));
    expect(decoded.seed).toBe('migration-test');
    expect(decoded.team.money).toBe(750_000);
    expect(decoded.team.rings).toBe(1);
    expect(decoded.roster).toHaveLength(1);
    expect(decoded.roster[0].name).toBe('Old Player');
    expect(decoded.season.wins).toBe(6);
    expect(decoded.season.losses).toBe(4);
  });

  it('migrateV1ToV2: seasonsPlayed=2, currentWins=30 -> career.totalWins >= 30 and ~112', () => {
    // Migration heuristic: 2 past seasons * 41 wins/season + 30 current = 112.
    const v1 = minimalStateV1({
      team: { name: 'Test Team', money: 500_000, fans: 5_000, rings: 0, seasonsPlayed: 2 },
      season: { day: 30, wins: 30, losses: 0, schedule: [], phase: 'regular', playoff: null },
    });
    const migrated = migrateV1ToV2(v1);
    expect(migrated.career.totalWins).toBeGreaterThanOrEqual(30);
    // 2 * 41 + 30 = 112
    expect(migrated.career.totalWins).toBe(112);
  });

  it('migrateV1ToV2 with zero past seasons uses only current season counts', () => {
    const v1 = minimalStateV1({
      season: { day: 5, wins: 3, losses: 2, schedule: [], phase: 'regular', playoff: null },
    });
    const migrated = migrateV1ToV2(v1);
    expect(migrated.career.totalWins).toBe(3);
    expect(migrated.career.totalLosses).toBe(2);
  });

  it('upgrades from migrateV1ToV2 are all at level 0', () => {
    const v1 = minimalStateV1();
    const migrated = migrateV1ToV2(v1);
    expect(migrated.upgrades.trainingFacility).toBe(0);
    expect(migrated.upgrades.scouting).toBe(0);
    expect(migrated.upgrades.gymEquipment).toBe(0);
    expect(migrated.upgrades.medicalStaff).toBe(0);
    expect(migrated.upgrades.marketing).toBe(0);
  });
});
