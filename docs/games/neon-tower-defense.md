# Neon Tower Defense

**Slug:** `neon-tower-defense` &nbsp;·&nbsp; **Folder:** `games/neon-tower-defense/` &nbsp;·&nbsp; **Status:** playable (v0.1)

A shape-based tower-defense in a neon CRT aesthetic. Place towers along a snaking path and defend the grid for 12 waves. Every visual is a geometric primitive drawn in code — no sprites, no images. Audio is fully synthesized at runtime.

## Concept

Wave-based tower defense, classic loop:

1. The player has a fixed budget of credits.
2. Enemies enter from the left and walk a fixed path toward the right edge.
3. The player buys towers and places them on buildable tiles to shoot enemies before they leak.
4. Killing enemies awards more credits; surviving a wave awards a bonus.
5. Survive 12 waves to win. Lose all 20 lives and the grid is overrun.

Intended feel: neon, CRT-glowy, fast to grok, hands-off enough that the player can build a layout and watch waves resolve. Single playthrough is ~5–8 minutes.

## Controls

| Input | Action |
| --- | --- |
| `1` / `2` / `3` or click button | Select tower type to place |
| Left click on empty tile | Build the selected tower |
| Left click on placed tower | Open info panel (range + stats) |
| `U` | Upgrade selected tower |
| `S` | Sell selected tower (70% refund of invested credits) |
| `Space` | Start the next wave (skip cooldown, +5¢ bonus) |
| `Esc` | Cancel placement / deselect tower |
| `P` / `Esc` | Pause / resume |
| `M` | Mute / unmute |

## Tech stack

- **Engine:** vanilla JS + Canvas2D. No frameworks. No build step. ES modules.
- **Renderer:** `<canvas>` at 480×270 internal pixels, scaled via CSS with `image-rendering: pixelated`.
- **Frame rate:** 60 fps via `requestAnimationFrame`, delta-time throughout.
- **Audio:** Web Audio API (see `audio.js` and [`docs/audio.md`](../audio.md)). All SFX + music synthesized at runtime — no audio files.
- **Dependencies:** none.

## Module layout

```
games/neon-tower-defense/
├── index.html
├── style.css
├── main.js          – entry, game state, loop, input, HUD wiring
├── config.js        – constants, palette, tower/enemy/wave tables
├── map.js           – path geometry + buildable-tile lookup
├── render.js        – neon shape primitives, glow, path/HUD/buttons, particles
├── enemies.js       – path-following entities, HP, slow effect, targeting helpers
├── towers.js        – placement, upgrades, targeting, firing
├── projectiles.js   – three flavors (bolt/pulse/spike), AoE + pierce
├── waves.js         – segment-based wave sequencer
└── audio.js         – Web Audio engine (SFX + ambient music)
```

`main.js` owns the state machine; the rest are narrow systems with `update*()` / `draw*()` entry points.

## Assets

**None.** This game is a deliberate counterpoint to Running Man: every visual is a geometric primitive drawn from `render.js`, every sound is synthesized in `audio.js`. There is no `assets/` folder.

The shapes are drawn as a layered glow — a soft halo via `shadowBlur` + a brighter outlined core — so triangles, squares, diamonds and hexagons read as glowing CRT-monitor neon.

## Visual & audio design

### Palette

| Role | Color |
| --- | --- |
| Background gradient | `#0a0e18` → `#03050a` |
| Path / HUD accent | `#00f0ff` (cyan) |
| Bolt tower (triangle) | `#00f0ff` |
| Pulse tower (square) | `#ff3df0` (magenta) |
| Spike tower (diamond) | `#b6ff00` (lime) |
| Square enemy | `#ff3344` (red) |
| Hex enemy | `#ff8c00` (orange) |
| Tri enemy | `#ffee00` (yellow) |
| Boss enemy (diamond) | `#d27aff` (purple) |

### Audio voices

- **Tower fires:** distinct timbres — bolt = high square chirp w/ pitch up, pulse = saw thump + filtered noise, spike = high square w/ steep down-bend.
- **Combat:** quiet hit ticks; brighter triangle pop on kill; saw + low-thud + noise burst on boss kill.
- **Game flow:** rising chord on wave start, ascending chord on wave clear, descending alert on life loss, ascending major arpeggio on victory, slow descending sawtooth phrase on defeat.
- **Music:** A-minor pentatonic ambient — long triangle pad held for 8 eighths under a square-wave bass arpeggio + a triangle lead. 96 BPM. Loops indefinitely; fades on pause / death.

## Mechanics

### Map

- 480×270 canvas. Top 22 px is the in-canvas HUD strip.
- Path is a polyline with 7 vertices forming a rough "Z" with two switchbacks.
- 30 cols × 15 rows × 16-px tiles in the field. Tiles within 18 px of the path centerline are non-buildable (computed once at module load).

### Towers

| Tower | Shape | Cost (L1/L2/L3) | Notes |
| --- | --- | --- | --- |
| **Bolt** | Triangle (cyan) | 40 / 50 / 70 | Fast single-target. L3 adds 25% slow. |
| **Pulse** | Square (magenta) | 80 / 100 / 140 | Splash AoE on impact. L3 adds slow. |
| **Spike** | Diamond (lime) | 100 / 130 / 180 | Long range, brutal damage. L2 pierces 2, L3 pierces 4. |

Targeting is "first along path" for all towers — the standard TD priority. The body smoothly aims at the target before firing.

### Enemies

| Enemy | Shape | HP | Speed | Value | Lives |
| --- | --- | --- | --- | --- | --- |
| Square | Square (red) | 30 | 50 | 6¢ | 1 |
| Tri | Triangle (yellow) | 24 | 95 | 8¢ | 1 |
| Hex | Hexagon (orange) | 80 | 40 | 12¢ | 1 |
| Diamond (boss) | Diamond (purple) | 600 | 28 | 80¢ | 5 |

Boss waves: 4, 8, 12.

### Waves

12 hand-tuned waves, each composed of one or more "segments" (count, gap-between-spawns, delay-before-segment). The wave is "clear" only after all segments finish spawning AND the field is empty. A wave-clear bonus of `20 + waveIndex × 4` credits is granted on top of per-kill values.

Inter-wave cooldown is 6 seconds; pressing `Space` skips the rest of the cooldown for a +5¢ bonus.

### Endless mode

After clearing wave 12 the run does **not** end — it transitions into endless mode and the wave counter keeps climbing (`WAVE 13 ∞`, `WAVE 14 ∞`, …). The 12 wave templates cycle (`idx → WAVES[(idx-1) % 12]`) so the player keeps seeing varied compositions, and a per-wave multiplier tightens the screws:

| Scalar | Per wave past 12 | Cap |
| --- | --- | --- |
| Enemy HP | `+30%` | none |
| Enemy speed | `+4%` | `1.40×` |
| Spawn count per segment | `+8%` | none |
| Kill reward | `+25%` | none |

Reward scales close to the HP curve so the player stays solvent for upgrades, but eventually the HP/count combo overruns any tower setup — endless is a score-attack (highest wave reached) rather than a winnable mode.

Boss waves still hit on every 4th index (16, 20, 24, …) as the cycle repeats. Every 5 cleared waves past wave 12 fires a `SURVIVED N WAVES` milestone banner + victory cue.

### Economy

- Starting credits: 120.
- Starting lives: 20.
- Sell refund: 70% of total invested credits per tower.
- Upgrade cost is the L2/L3 cost listed above (added to "invested" for refund math).

### Persistence

`localStorage`:

- `neon-td:best` — highest wave reached.
- `neon-td:muted` — audio mute preference.

## Known issues / deferred

- No mobile-tuned layout. Touch *should* work via synthetic `click` events, but range previews on hover obviously won't.
- Enemy targeting is a single fixed mode ("first"). Per-tower targeting (last/strongest/weakest/closest) could be a polish pass.
- No path variations or branches — one fixed map.
- No retry-from-wave option; defeat always restarts from wave 1.
- 60 fps assumes desktop hardware; older devices haven't been profiled.

## Changelog

- `2026-04-25` — v0.1: initial playable build. Vanilla JS + Canvas2D, neon shape-based art (no sprites), Web Audio synth (no files), 12 hand-tuned waves with 3 boss waves, 3 tower types with 3 levels each, 4 enemy types, build/upgrade/sell economy, slow + AoE + pierce mechanics.
- `2026-04-25` — v0.2: endless mode. After wave 12 the campaign dissolves into a score-attack: the 12 wave templates cycle and a per-wave multiplier scales HP / speed / spawn count / kill reward. The win screen is gone — only defeat ends a run. Wave label switches from `NN/12` to `NN ∞` and `localStorage[neon-td:best]` keeps tracking the highest wave reached.
