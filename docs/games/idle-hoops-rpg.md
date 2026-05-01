# Idle Hoops RPG

**Slug:** `idle-hoops-rpg` &nbsp;·&nbsp; **Folder:** `public/games/idle-hoops-rpg/` &nbsp;·&nbsp; **Status:** in-progress

An idle / incremental basketball career sim. You manage a pro team across seasons, playoffs, and the off-season — even when the tab is closed.

## Concept

Idle Hoops RPG mirrors a simplified, RPG-fied "career mode" of pro basketball. The team plays games on a real-time clock; players gain XP and level up; seasons end in playoffs and a possible championship; the off-season cycles through draft, free agency, and training camp. The whole thing keeps progressing while you're offline — open the tab next morning and you'll find a "while you were away" summary of games played, money earned, and any rings won.

The showcase mechanic is **persistence as a single hashed string**. The entire game state (roster, season, money, RNG cursor, last-tick timestamp) is encoded into one base64 string, prefixed with an integrity hash, and stored under a single `localStorage` key. Corrupt the string and the game refuses to load it. Copy-paste the string and the game restores byte-perfect on a different machine. Save state is a "seed" in the literal sense.

The visual aesthetic borrows from shadcn/ui — dark zinc backgrounds, rounded cards, ghost buttons, badges — implemented in vanilla CSS (no React, no Tailwind, no build step). Player portraits and UI accents are emoji.

## Controls

The game is mostly idle — there are no real-time inputs. UI is mouse / tap.

| Input | Action |
| --- | --- |
| Tab buttons | Switch between Roster / Schedule / Standings / Off-Season / Settings |
| `Space` | Pause / unpause the sim clock |
| `M` | Mute / unmute (no audio in v0.1, reserved) |
| `R` | Reset save (with confirmation modal) |

Off-season actions (Draft / Free Agency / Training Camp) are click-driven; if the player skips, defaults are auto-applied so the sim never stalls.

## Tech stack

- **Engine:** vanilla JS, ES modules. **No canvas** — the entire UI is DOM (divs, buttons), styled to a shadcn-like aesthetic.
- **Renderer:** plain DOM with CSS transitions. No `<canvas>`.
- **Frame rate:** the sim is event-driven (one game per `TICK_MS` real-time interval), not frame-driven. UI re-renders on state change.
- **Dependencies:** none. No CDN libraries.

## Assets

No external assets. Player portraits are emoji (🏀 🏃 ⛹️ 🏋️ 🤾 etc.). UI uses CSS variables and rounded cards. No PixelLab generations, no images on disk.

## Persistence — the single-string save

This is the core mechanic and the main thing tests prove out.

### Save format

```text
<hash>:<base64Payload>
```

- `<base64Payload>` — `btoa(JSON.stringify(saveState))`. Standard base64.
- `<hash>` — 8-char hex djb2 hash of `<base64Payload>`. Integrity check, not crypto. Detects accidental corruption / hand edits.
- Stored at `localStorage` key: `idle-hoops-rpg:save:v1`. Version is in the key so a future format bump is unambiguous.

### saveState shape (v1)

```ts
type SaveState = {
  v: 1;                    // schema version
  seed: string;            // RNG seed string (deterministic, hashable)
  rngCursor: number;       // how many random numbers have been drawn
  lastTickAt: number;      // Date.now() at last sim tick
  team: {
    name: string;
    money: number;
    fans: number;
    rings: number;
    seasonsPlayed: number;
  };
  roster: Player[];        // 8 entries
  season: {
    day: number;           // 0..82 regular, 83..101 playoffs, 102 offseason
    wins: number;
    losses: number;
    schedule: GameResult[];  // length 82, filled as games play
    phase: 'regular' | 'playoffs' | 'offseason';
    playoff: PlayoffState | null;
  };
};

type Player = {
  name: string;
  emoji: string;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  level: number;          // 1..99
  xp: number;             // resets on level-up
  stats: {
    shooting: number;     // 1..99
    defense: number;
    athleticism: number;
    iq: number;
  };
  morale: number;         // 0..100
  age: number;            // 19..40
  contractYears: number;
  contractValue: number;
};

type GameResult = {
  day: number;
  opponentRating: number;
  teamRating: number;
  ourScore: number;
  oppScore: number;
  win: boolean;
  topScorer: string;      // player name
};
```

### Integrity / migration

- On load, split on first `:`, recompute the hash, compare. Mismatch → `null`, fresh start.
- On load, check `parsed.v === 1`. Mismatch → `null`, fresh start (future versions will migrate, not silently ignore).
- The save string never contains anything that can't be reconstructed from the seed + cursor + tick count. This is the test for "is this really a seed?" — a property test asserts the round-trip.

## Offline / idle catch-up

The single most important UX behavior.

### Tick model

- One **sim tick** = one basketball game played + scoreboard update + player XP allocation + (if applicable) season-phase transition.
- `TICK_MS = 30_000` in production (one game every 30 real-time seconds while tab is open).
- `TICK_MS = 100` when `?test=1` (so E2E tests don't sit waiting for sim time).
- The visible clock UI ("next game in: 0:23") drives off `TICK_MS`.

### Catch-up math

```js
// On boot, after loading save:
const elapsed = Date.now() - saveState.lastTickAt;
const ticksDue = Math.min(
  Math.floor(elapsed / TICK_MS),
  MAX_OFFLINE_TICKS,         // cap: 30 days * 24h * 3600s / 30s = 86400 ticks
);
for (let i = 0; i < ticksDue; i++) runOneTick();
saveState.lastTickAt = Date.now();
```

The cap protects against a save 6 months old running thousands of seasons in one boot. After cap, the surplus time is silently discarded (a "vacation cap" — documented in the welcome-back modal).

### Welcome-back summary

After catch-up, show a modal: games played, wins/losses, money earned, rings won (if any), level-ups (if any), notable events ("traded for veteran X" — v0.2+). Click to dismiss.

## Game simulation

A simulated game is pure: same inputs (team, opp rating, RNG cursor) → same result.

```js
function simulateGame(team, opponentRating, rng) {
  const teamRating = avgStats(team.starters);
  const ourBase = teamRating + rng.range(-15, 15);
  const oppBase = opponentRating + rng.range(-15, 15);
  const ourScore = 80 + Math.round(ourBase / 3) + rng.range(0, 20);
  const oppScore = 80 + Math.round(oppBase / 3) + rng.range(0, 20);
  const topScorer = pickTopScorer(team.starters, rng);
  return { ourScore, oppScore, win: ourScore > oppScore, topScorer: topScorer.name };
}
```

Numbers will be tuned in implementation; the contract is: **deterministic given seed + cursor**. A replay test asserts this.

### Player progression

- Win → top scorer gets +200 XP, other starters get +100, bench gets +50.
- Loss → halve those numbers.
- Level threshold: `xpForLevel(n) = 500 + n * 200`. Round numbers; tunable.
- Level-up: +1 to one random stat (weighted by position: PG → IQ-heavy, C → defense-heavy).
- Aging: +1 age per season. After age 30, 25% chance per season of -1 to athleticism. Retires at 40.

### Season structure

- **Regular season:** 82 games. Days 0–81. Opponent rating drawn from a pool around team rating ± noise.
- **Playoffs:** if `wins >= 41` (sub-.500 misses). 4 rounds, best-of-7, opponent ratings climb. Days 82–101 (if playoffs go full length).
- **Off-season:** day 102+. Three phases: Draft → Free Agency → Training Camp. Each consumes ~3 ticks; if player doesn't intervene, defaults apply.
- After off-season, day resets to 0 and `seasonsPlayed += 1`.

## RNG

- Same primitives as Neon Blocks: **Mulberry32** PRNG seeded from a **djb2** hash of the seed string.
- `rng.cursor` is persisted in the save string. On boot, the RNG is seeded from `seed`, then advanced by `rngCursor` draws to resume from where the save left off.
- Default seed: a random `crypto.randomUUID().slice(0,8)` on first boot. Deterministic from then on.

## UI structure

DOM, no canvas. Single-page; tabs swap inner content.

### Header (always visible)

- Team name + 🏀 logo
- Record (W-L) — large
- Money 💰, Fans 🎟️, Rings 🏆 — small badges
- Season day + phase pill ("Day 42 — Regular Season")
- Pause/play button + sim-speed pill

### Tabs

| Tab | Content |
| --- | --- |
| **Roster** | Player cards. Emoji portrait, name, position pill, level + XP bar, stats. Click → detail modal. |
| **Schedule** | Last 5 results + next 5 upcoming. Each row: day, opponent rating, score line. |
| **Standings** | Single-line "you are #N in your conference" + championship history list. |
| **Off-Season** | Only enabled during phase=offseason. Draft / FA / Camp prompts. |
| **Settings** | Seed (read-only display + copy-to-clipboard), reset, mute, save string export/import. |

### Aesthetic

shadcn-like. Vanilla CSS with custom properties:

```css
:root {
  --bg: hsl(240 10% 4%);
  --card: hsl(240 6% 10%);
  --border: hsl(240 4% 16%);
  --muted: hsl(240 4% 46%);
  --fg: hsl(0 0% 98%);
  --accent: hsl(25 95% 53%);  /* basketball orange */
  --radius: 0.625rem;
}
```

Cards have `border: 1px solid var(--border); border-radius: var(--radius); background: var(--card);`. Buttons have ghost / primary variants. Pills, badges, XP bars all built from divs.

## Test hook surface

Per [docs/testing.md](../testing.md), exposed only when `?test=1`. Read-only except where noted as `// TEST ONLY`.

```js
window.__gameTest = {
  // Read accessors
  getState:      () => 'loading' | 'splash' | 'playing' | 'paused' | 'offseason' | 'celebrating',
  getSeed:       () => string,
  getDay:        () => number,
  getPhase:      () => 'regular' | 'playoffs' | 'offseason',
  getRecord:     () => { wins, losses },
  getMoney:      () => number,
  getFans:       () => number,
  getRings:      () => number,
  getRoster:     () => Player[],            // copies, not refs
  getSchedule:   () => GameResult[],        // copies
  getSaveString: () => string | null,
  getDecoded:    () => SaveState | null,    // saveString → decoded; null on bad hash

  // TEST ONLY mutators (gated by ?test=1)
  triggerTick:   (n: number) => void,       // advance n sim ticks immediately
  setLastTickAt: (ms: number) => void,      // override timestamp for offline-catch-up tests
  forceSeed:     (s: string) => void,       // restart with given seed
  clearSave:     () => void,                // wipe localStorage key
};
```

Mutators exist only because the alternative is brittle E2E timing. They never run in production (the entire `__gameTest` block is gated by the query param).

## Storage keys

- `idle-hoops-rpg:save:v1` — the save string.
- `idle-hoops-rpg:muted` — `'1'` or `'0'`.

(Mirrors Neon Blocks' `neon-blocks:muted` convention.)

## Open questions / deferred

- **Audio.** v0.1 ships silent. Reserved Web Audio synth for crowd cheer / game-end stinger in v0.2.
- **Trades and transactions.** v0.1 has draft + FA + camp. Mid-season trades come later.
- **Multiple save slots.** v0.1 is single slot. Save-string export/import already supports portability.
- **Mobile.** Cards reflow with CSS grid; no drag interactions. Should work on mobile out of the box.

## Testing

See [docs/testing.md](../testing.md) for the four-tier framework and the test-hook contract.

**Test files:**

- `tests/unit/idle-hoops-rpg/save.test.js` — encode/decode/hash roundtrip, version mismatch, corrupt-hash rejection
- `tests/unit/idle-hoops-rpg/sim.test.js` — `simulateGame` determinism, XP curve, level-up triggers, season-phase transitions
- `tests/unit/idle-hoops-rpg/offline.test.js` — `ticksDue(now, lastTick, tickMs, max)` math, vacation cap
- `tests/unit/idle-hoops-rpg/rng.test.js` — Mulberry32 + djb2 determinism, cursor resume
- `tests/replay/idle-hoops-rpg.replay.test.js` — seed `'alpha'` + N ticks → snapshot hash of final state
- `tests/property/idle-hoops-rpg-save.property.test.js` — for any valid SaveState, encode→decode→equal
- `tests/property/idle-hoops-rpg-bounds.property.test.js` — money never negative; record sums always equal day-in-regular-season
- `tests/e2e/idle-hoops-rpg.spec.ts` — save persists across reload, offline catch-up renders welcome-back, corrupt save → fresh start

## Changelog

- `2026-05-01` — initial spec.
