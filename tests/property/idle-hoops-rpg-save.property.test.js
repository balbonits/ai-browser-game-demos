// Property test: for any valid SaveState (v2 schema), encodeSave -> decodeSave preserves equality.

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { encodeSave, decodeSave } from '../../public/games/idle-hoops-rpg/save.js';

// ---------------------------------------------------------------------------
// fast-check arbitraries for SaveState shape (v2)
// ---------------------------------------------------------------------------

const arbStats = fc.record({
  shooting:    fc.integer({ min: 1, max: 99 }),
  defense:     fc.integer({ min: 1, max: 99 }),
  athleticism: fc.integer({ min: 1, max: 99 }),
  iq:          fc.integer({ min: 1, max: 99 }),
});

const arbPosition = fc.constantFrom('PG', 'SG', 'SF', 'PF', 'C');

// Emoji excluded from player data to avoid btoa edge cases in the property
// test; roster.js emoji is tested in the save roundtrip unit test instead.
const arbPlayer = fc.record({
  name:          fc.string({ minLength: 3, maxLength: 20 }),
  emoji:         fc.constant('B'),   // ASCII placeholder for property test
  position:      arbPosition,
  level:         fc.integer({ min: 1, max: 99 }),
  xp:            fc.integer({ min: 0, max: 5000 }),
  stats:         arbStats,
  morale:        fc.integer({ min: 0, max: 100 }),
  age:           fc.integer({ min: 19, max: 40 }),
  contractYears: fc.integer({ min: 0, max: 7 }),
  contractValue: fc.integer({ min: 0, max: 10_000_000 }),
});

const arbGameResult = fc.record({
  day:            fc.integer({ min: 0, max: 101 }),
  opponentRating: fc.integer({ min: 30, max: 99 }),
  teamRating:     fc.integer({ min: 30, max: 99 }),
  ourScore:       fc.integer({ min: 60, max: 150 }),
  oppScore:       fc.integer({ min: 60, max: 150 }),
  win:            fc.boolean(),
  topScorer:      fc.string({ minLength: 3, maxLength: 20 }),
});

const arbPlayoff = fc.oneof(
  fc.constant(null),
  fc.record({
    round:         fc.integer({ min: 1, max: 4 }),
    seriesWins:    fc.integer({ min: 0, max: 4 }),
    seriesLosses:  fc.integer({ min: 0, max: 4 }),
    opponentRating: fc.integer({ min: 30, max: 99 }),
  }),
);

const arbSeason = fc.record({
  day:      fc.integer({ min: 0, max: 120 }),
  wins:     fc.integer({ min: 0, max: 82 }),
  losses:   fc.integer({ min: 0, max: 82 }),
  schedule: fc.array(arbGameResult, { maxLength: 10 }),
  phase:    fc.constantFrom('regular', 'playoffs', 'offseason'),
  playoff:  arbPlayoff,
});

const arbTeam = fc.record({
  name:          fc.string({ minLength: 2, maxLength: 25 }),
  money:         fc.integer({ min: 0, max: 50_000_000 }),
  fans:          fc.integer({ min: 0, max: 1_000_000 }),
  rings:         fc.integer({ min: 0, max: 20 }),
  seasonsPlayed: fc.integer({ min: 0, max: 50 }),
});

const arbSeed = fc.string({ minLength: 1, maxLength: 30 });

// v0.2 additions
const arbCareer = fc.record({
  totalWins:   fc.integer({ min: 0, max: 5000 }),
  totalLosses: fc.integer({ min: 0, max: 5000 }),
});

const arbUpgrades = fc.record({
  trainingFacility: fc.integer({ min: 0, max: 10 }),
  scouting:         fc.integer({ min: 0, max: 10 }),
  gymEquipment:     fc.integer({ min: 0, max: 10 }),
  medicalStaff:     fc.integer({ min: 0, max: 10 }),
  marketing:        fc.integer({ min: 0, max: 10 }),
});

const ALL_ACHIEVEMENT_IDS = [
  'first_win', 'first_ring', 'dynasty_5', 'wins_10', 'wins_100', 'wins_500',
  'playoff_bound', 'filthy_rich', 'sellout_crowd', 'veteran_squad', 'hall_of_fame', 'long_career',
];

const arbAchievements = fc.subarray(ALL_ACHIEVEMENT_IDS);

// v2 SaveState arbitrary
const arbSaveState = fc.record({
  v:           fc.constant(2),
  seed:        arbSeed,
  rngCursor:   fc.integer({ min: 0, max: 100_000 }),
  lastTickAt:  fc.integer({ min: 0, max: 2_000_000_000_000 }),
  team:        arbTeam,
  roster:      fc.array(arbPlayer, { minLength: 0, maxLength: 8 }),
  season:      arbSeason,
  career:      arbCareer,
  upgrades:    arbUpgrades,
  achievements: arbAchievements,
});

// ---------------------------------------------------------------------------
// Property: encode -> decode is an identity (v2 states round-trip exactly)
// ---------------------------------------------------------------------------

describe('save roundtrip — property', () => {
  it('for any valid SaveState (v2), decodeSave(encodeSave(state)) deep-equals state', () => {
    fc.assert(
      fc.property(arbSaveState, (state) => {
        const encoded = encodeSave(state);
        const decoded = decodeSave(encoded);
        // Must decode successfully.
        if (decoded === null) return false;
        // Must preserve all fields (deep equality via JSON round-trip).
        return JSON.stringify(decoded) === JSON.stringify(state);
      }),
      { numRuns: 200 },
    );
  });

  it('decodeSave rejects any string with one character changed', () => {
    fc.assert(
      fc.property(
        arbSaveState,
        fc.integer({ min: 0, max: 5 }), // char position offset into payload
        (state, offset) => {
          const encoded = encodeSave(state);
          const colonIdx = encoded.indexOf(':');
          // Tamper one character in the payload (after the colon).
          const payloadStart = colonIdx + 1;
          const tamperIdx = payloadStart + (offset % (encoded.length - payloadStart));
          const original = encoded.charCodeAt(tamperIdx);
          // Flip one bit.
          const tampered = String.fromCharCode(original ^ 1);
          const bad = encoded.slice(0, tamperIdx) + tampered + encoded.slice(tamperIdx + 1);
          // If the tampered char happens to be identical (very rare), skip.
          if (bad === encoded) return true;
          return decodeSave(bad) === null;
        },
      ),
      { numRuns: 100 },
    );
  });
});
