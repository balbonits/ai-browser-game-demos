# Neon Blocks

**Slug:** `neon-blocks` &nbsp;·&nbsp; **Folder:** `public/games/neon-blocks/` &nbsp;·&nbsp; **Status:** playable

Full-featured Tetris-style falling-block puzzle with SRS rotation, T-spins, three game modes, and layered synthesized music that grows with your level.

## Concept

Neon Blocks is a guideline-compliant Tetris-style puzzle in the neon-CRT aesthetic of the repo's other code-drawn games. The player stacks falling tetrominoes to clear lines and score points. Three modes give replayability: endless Marathon for score attack, Sprint for a 40-line time trial, and Daily for a deterministic daily challenge seeded by the UTC date. All visuals are drawn on a canvas; all audio is synthesized via the Web Audio API. No sprites, no audio files.

The showcase mechanic is the layered music engine: four layers (bass, melody, arp, hi-hat) cut in as the level rises, and the BPM ratchets upward at L13 and L17.

## Controls

| Input | Action |
| --- | --- |
| `←` `→` / `A` `D` | Move left / right (DAS 150ms, ARR 30ms) |
| `↓` / `S` | Soft drop (gravity ×20) |
| `Space` | Hard drop |
| `↑` / `X` | Rotate clockwise (SRS); hold at spawn for IRS |
| `Z` | Rotate counter-clockwise (SRS); hold at spawn for IRS |
| `Shift` / `C` | Hold piece (once per spawn); hold at spawn for IHS |
| `P` / `Esc` | Pause / unpause |
| `R` | Return to splash (any state) |
| `M` | Mute / unmute |
| `1` / `2` / `3` | Select mode on splash (Marathon / Sprint / Daily) |
| `Space` / `Enter` | Start selected mode on splash |

**IRS (Initial Rotation System):** if a rotate key is held when a new piece spawns, that rotation is applied immediately at spawn. CW takes priority over CCW.

**IHS (Initial Hold System):** if the hold key is held when a new piece spawns, a hold swap is applied immediately at spawn.

## Tech stack

- **Engine:** vanilla JS + Canvas2D, ES modules.
- **Renderer:** `<canvas>` at 480×270 internal, CSS-scaled with `image-rendering: pixelated`.
- **Frame rate:** targets 60 fps via `requestAnimationFrame`, delta-time throughout.
- **Dependencies:** none. No CDN libraries.

## Assets

No external assets. All visuals are drawn programmatically using Canvas2D primitives (rounded rectangles, shadowBlur glow halos). All audio is synthesized via the Web Audio API.

## Mechanics

### 7-bag randomizer

Each bag is a shuffled `[I, O, T, S, Z, J, L]` sequence. A new bag is generated automatically when the current one is exhausted. The Bag class pre-fills two bags so the 5-piece next queue is always available. Seeded with Mulberry32 (djb2 string hash) for Daily mode; random seed otherwise.

### SRS rotation with wall kicks

All four rotation states per piece, with the Tetris Guideline kick tables:

- JLSTZ: standard 5-offset table per rotation pair.
- I: separate 5-offset table per rotation pair.
- Kicks use screen-space y-down coordinates (y signs flipped from the y-up guideline source).
- If all 5 offsets collide, rotation is aborted.

### T-spin detection (3-corner rule)

After a piece locks, if the piece is a T and the last action was a rotation:

1. Check the 4 diagonal corners around the T's center.
2. If 3+ corners are filled (board cells or walls): check whether the 2 "front" corners (the side the T points) are both filled.
3. Both front filled → **T-spin** (full). Otherwise → **T-spin Mini**.
4. Fewer than 3 corners → no T-spin.

T-spin type is cleared on any non-rotation move action (`wasLastActionRotation` flag on Piece).

### Lock delay

500ms after the piece first touches the floor/stack. Any successful move or rotation resets the timer — up to 15 resets per piece. After 15 resets the timer continues accumulating (no longer resets) but the piece still gets the remainder of the 500ms window before it locks. The piece does **not** lock instantly when the cap is hit.

**Step reset:** every time the piece falls to a new lowest row it has never reached before, the reset counter resets to 0. This matches the modern guideline (Tetr.io / Jstris defaults) and ensures players are never arbitrarily punished for holding a piece above the stack.

### Scoring

| Event | Score |
| --- | --- |
| Single / Double / Triple / Tetris | 100 / 300 / 500 / 800 × level |
| T-spin Single / Double / Triple | 800 / 1200 / 1600 × level |
| T-spin Mini Single / Double | 200 / 400 × level |
| T-spin (no lines) | 400 × level |
| T-spin Mini (no lines) | 100 × level |
| Soft drop | +1 per cell |
| Hard drop | +2 per cell |
| Combo | +50 × combo × level (combo resets on no-line-clear lock) |
| Back-to-back (Tetris or T-spin consecutive) | ×1.5 on line-clear score |
| Perfect Clear — Single / Double / Triple | 800 / 1200 / 1800 × level |
| Perfect Clear — Tetris | 2000 × level |
| Perfect Clear — B2B Tetris | 3200 × level |

T-spin no-line locks count as non-clearing for combo purposes (combo breaks). Perfect Clear bonus is awarded on top of the line-clear score.

Level advances every 10 lines (Marathon/Daily). Sprint level is fixed at 1.

### Gravity curve (frames per cell at 60fps)

L1–L9: 60, 48, 37, 28, 21, 16, 11, 8, 6. L10–L12: 4. L13–L15: 3. L16–L18: 2. L19+: 1.

### Modes

- **Marathon** — endless, level ramps, top-10 scoreboard by score.
- **Sprint** — clear 40 lines as fast as possible, level fixed at 1, top-10 by time.
- **Daily** — date-seeded Marathon; per-day best stored (not a ranked list).

### Music layers

A-minor pentatonic at 96 BPM (base):

| Level | Layer |
| --- | --- |
| L1+ | Square-wave bass, root + fifth, half-note pulse |
| L3+ | Triangle melody — 4-bar phrase cycling A4 C5 E5 G5 A5 |
| L5+ | Square arpeggio — 8-step, octave-up chord tones |
| L8+ | Filtered noise hi-hat on off-beat 8th steps |
| L13+ | BPM → 120 (scheduler restarts at new tempo) |
| L17+ | BPM → 140 |

Music fades on pause and fades back in on resume. Game-over plays a descending sawtooth phrase. All layers share one `setInterval` scheduler.

## Persistence (localStorage)

| Key | Value |
| --- | --- |
| `neon-blocks:scores:marathon` | Top-10 array `{score, lines, level, when}` |
| `neon-blocks:scores:sprint` | Top-10 array `{time, lines, when}` |
| `neon-blocks:daily:YYYY-MM-DD` | Daily best `{score, lines, level, when}` |
| `neon-blocks:muted` | `'1'` or `'0'` |

## Module layout

| File | Responsibility |
| --- | --- |
| `index.html` | Canvas shell, meta tags, mute button |
| `style.css` | Frame layout, CRT frame, CSS scaling |
| `main.js` | State machine, game loop, input (DAS/ARR), scoring, gravity, lock delay, game-over wiring |
| `config.js` | Palette, piece definitions, SRS kick tables, gravity curve, scoring constants, storage keys |
| `board.js` | 10×22 grid, collision, lock-in, row detection and clearing, top-out check |
| `piece.js` | Tetromino model, SRS rotation with kicks, T-spin detection, ghost row |
| `bag.js` | 7-bag randomizer, Mulberry32 PRNG, djb2 hash, `todayUTC()` helper |
| `render.js` | Neon block drawing, ghost, hold/next panels, stats HUD, particles, line flash, screen shake, splash, pause, game-over overlays, CRT scanlines + vignette |
| `audio.js` | Layered synth engine: SFX vocabulary + music scheduler |

## Known issues / deferred

- Mobile / touch input is not implemented.
- The sprint timer begins on the first gravity tick or action that moves a piece; players who hard-drop the first piece immediately have no timer lag.
- No "ARE" (appearance delay) between lock and spawn — pieces spawn immediately (matches modern guideline defaults).
- Back-to-back T-spin mini is not separately flagged; it uses the same `isB2B` path as full T-spins. This is guideline-correct.

## Changelog

- `2026-04-28` — v0.2 fix-up pass:
  - **Lock delay corrected.** The reset-cap (15 moves) no longer force-locks instantly; the piece still gets the full remaining 500ms grace period after the cap is hit. Verified that soft-drop and airborne transitions do not incorrectly count toward the cap.
  - **Step reset added.** Every time the piece reaches a new lowest row, the reset counter resets to 0 — matching Tetr.io / Jstris guideline defaults.
  - **Settling pulse added.** While grounded, the active piece's outline brightens and pulses faster as the lock timer approaches 500ms, making the grace period visually legible.
  - **DAS carryover guarded.** `keydown` now checks `if (!held)` before resetting the DAS timer, preventing key-repeat events from erroneously restarting DAS mid-hold.
  - **T-spin no-line scoring added.** Full T-spin (no lines): 400 × level. Mini T-spin (no lines): 100 × level. Both play their respective audio cues. Combo breaks as per guideline.
  - **Perfect Clear detection and bonus added.** Awarded on top of the line-clear score: Single 800, Double 1200, Triple 1800, Tetris 2000, B2B Tetris 3200 (all × level). Accompanied by a ~1.5s neon-green fading "PERFECT CLEAR!" banner (additive blend) and a celebratory ascending arpeggio SFX.
  - **IRS (Initial Rotation System) added.** Holding a rotation key at spawn applies that rotation immediately.
  - **IHS (Initial Hold System) added.** Holding the hold key at spawn triggers a hold swap immediately.
- `2026-04-28` — v0.1 initial playable build: full SRS, T-spin detection, 7-bag, three modes, layered music, neon-CRT rendering, persistence.
