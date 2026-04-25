# Maze Runner

**Slug:** `maze-runner` &nbsp;·&nbsp; **Folder:** `games/maze-runner/` &nbsp;·&nbsp; **Status:** playable (v0.1)

Top-down procedural maze runner. Navigate a randomly generated maze from start to exit, collect gems along the way, and beat your best time. The same seed always produces the same maze — share seeds with friends.

## Concept

Classic maze traversal, but with a racing-game urgency: the timer starts the moment you take your first step, and your best time for each seed is saved. Fog of war keeps you from seeing the full maze at once, and the minimap in the corner helps you track where you've been. Collectible gems reward thorough exploration, though the shortest route to the exit wins the timer race.

Three difficulty sizes let you pick a quick run (Small, ~2 minutes) or a long challenge (Large, ~5+ minutes).

## Controls

| Input | Action |
| --- | --- |
| `WASD` or `↑↓←→` | Move one cell at a time (hold to auto-repeat) |
| `Space` or `Enter` (on splash) | Start a new maze with a random seed |
| `R` | Return to splash / regenerate with a new random seed |
| `E` | Open custom seed entry prompt |
| `1` / `2` / `3` | Switch difficulty: Small / Medium / Large |
| `M` | Mute / unmute audio |

## Tech stack

- **Engine:** vanilla JS + Canvas2D. No frameworks. No build step. ES modules.
- **Renderer:** `<canvas>` at 480×270 internal pixels, scaled via CSS with `image-rendering: pixelated`.
- **Frame rate:** 60 fps via `requestAnimationFrame`, delta-time throughout.
- **Audio:** Web Audio API (see `audio.js`). All SFX synthesized at runtime — no audio files.
- **Dependencies:** none.

## Module layout

```
games/maze-runner/
├── index.html
├── style.css
├── main.js    — entry, state machine, game loop, input, rendering, HUD, minimap
├── maze.js    — maze generation (recursive backtracker), gem placement, BFS path
└── audio.js   — Web Audio engine (footstep, bump, gem pickup, start tone, win chime)
```

## Assets

**None.** Every visual is a geometric primitive drawn on the canvas. No `assets/` folder.

## Visual design

Neon dark-room aesthetic, consistent with the neon-tower-defense palette:

| Element | Color |
| --- | --- |
| Background | `#06080f` (near-black) |
| Walls (visible) | `#00c8d8` (cyan) |
| Walls (explored, dim) | `#0a2a30` (dark teal) |
| Cell floor | `#0a0e18` |
| Visited floor | `#0d1a22` |
| Player | `#00f0ff` (bright cyan, with glow) |
| Exit cell | `#39ff14` (neon green) |
| Gem | `#ffd700` (gold, drawn as a 45°-rotated square) |
| Start cell | `rgba(255,61,240,0.18)` (magenta tint) |
| Trail | Fading cyan rectangles, up to 40 cells deep |

Fog of war: cells more than 5 Manhattan-distance from the player are invisible until visited. Previously seen cells render in the dim palette. The minimap in the bottom-right corner reveals explored topology at 3 px/cell.

## Mechanics

### Maze generation (`maze.js`)

**Algorithm: recursive backtracker (depth-first search)**

Why DFS rather than Wilson's or Prim's?
- DFS produces long winding corridors with relatively few dead ends — the player feels like they're navigating rather than searching blind.
- Wilson's (loop-erased random walk) produces more uniformly "branchy" mazes with shorter average dead-end depth; good for puzzle games, feels trickier to navigate quickly.
- DFS is simpler to implement correctly and is well-understood, making it easier to audit.

The algorithm:
1. Start at (0, 0).
2. Pick a random unvisited neighbor; carve a passage (clear the shared wall bits on both cells); push the new cell onto a stack.
3. If no unvisited neighbors exist, pop the stack (backtrack).
4. Repeat until the stack is empty → every cell visited → perfect maze (no loops, fully connected).

**RNG: Mulberry32**

A fast, small, high-quality 32-bit PRNG. Seeded from:
- A numeric seed directly.
- A string seed hashed to 32-bit unsigned int using a djb2-style rolling XOR.

Same seed + same dimensions → identical maze, every time.

### Cell representation

Each cell is a byte in a `Uint8Array`. Wall bits:
- `bit 0` (N = 1): north passage open
- `bit 1` (E = 2): east passage open
- `bit 2` (S = 4): south passage open
- `bit 3` (W = 8): west passage open

### Start and exit

- Start: always (0, 0) — top-left cell.
- Exit: always (cols-1, rows-1) — bottom-right cell.
- Because the DFS produces a spanning tree over all cells, the exit is always reachable.

### Gem placement

Gems are placed in **dead-end cells** (exactly one open wall). This rewards off-the-main-path exploration without blocking the critical route. Gem count per difficulty: Small=3, Medium=6, Large=10.

The gem RNG is seeded from `numericSeed + 1` so gem positions are stable per seed, independent of any mid-game RNG calls.

### Timer

The timer is **0 until the player makes their first move**. This lets the player study the HUD (difficulty, seed) before committing. Elapsed time is displayed in `MM:SS.cc` format.

### Persistence

`localStorage` keys (per seed + difficulty index):

```
maze-runner:best:<diffIdx>:<seed>
```

Only the best (lowest) time is stored. A `★ NEW!` banner appears on the win screen when the previous record is beaten.

### Movement

Moves are tile-snapped (one cell per step). Pressing a direction fires immediately; holding it auto-repeats after 0.18 s initial delay, then every 0.07 s — feels snappy for maze navigation without being uncontrollable.

## Known issues / deferred

- No touch/mobile controls — the game is keyboard-only.
- The solution path is computed via BFS (`bfsPath` in `maze.js`) but not currently displayed. Could be optionally revealed as a hint, or used to drive a "ghost" opponent.
- Fog radius is fixed (4 cells). Could be a difficulty modifier.
- No failure condition — the player can take as long as they like. A countdown timer mode would add pressure.
- Large mazes (29×19) can feel long without a failure state. Boss mode / time limit is a natural v0.2 addition.
- No visual difference between the start cell and a visited cell other than a faint tint.

## Changelog

- `2026-04-24` — v0.1: initial playable build. Recursive backtracker DFS, Mulberry32 seeded RNG, fog of war, gem collectibles, minimap, custom seed prompt, three difficulty sizes, localStorage best-time, Web Audio SFX (footstep / bump / gem / start / win).
