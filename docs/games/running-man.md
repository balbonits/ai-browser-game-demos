# Running Man

**Slug:** `running-man` &nbsp;·&nbsp; **Folder:** `games/running-man/` &nbsp;·&nbsp; **Status:** playable (v0.2)

The first game in the repo. A minimal side-scrolling auto-runner: your character runs automatically to the right; you time jumps to clear obstacles. Trip and fall on contact.

## Concept

A short-session arcade runner. The player never stops running — the only verb is *jump*. Obstacles scroll in from the right at a gradually increasing pace. Scoring is distance-based (or obstacles-cleared). Hitting an obstacle plays the trip/fall animation and ends the run.

Intended feel: simple, readable pixel art; tight one-button input; a playable loop under 60 seconds the first time, "just one more run" on repeat.

## Controls

| Input | Action |
| --- | --- |
| `Space` / `↑` / `W` / Tap | Jump / start / retry |
| `P` / `Esc` | Pause / resume |
| `R` | Restart after death |
| `M` | Toggle mute |

## Tech stack

- **Engine:** vanilla JS + Canvas2D. No frameworks. No build step.
- **Renderer:** `<canvas>` at 480×270 internal pixels, scaled up via CSS with `image-rendering: pixelated`.
- **Frame rate:** 60 fps via `requestAnimationFrame`, delta-time throughout.
- **Audio:** synthesized at runtime via Web Audio API (see `audio.js` + [`docs/audio.md`](../audio.md)). No audio files.
- **Dependencies:** none.

Why vanilla: the repo's convention is vanilla-first for small demos. A one-button runner is a few hundred lines of game logic; an engine would be overkill for the first game. Later games may use Phaser or PixiJS per the repo conventions.

## Module layout

```
games/running-man/
├── index.html
├── style.css
├── main.js          – entry + game state + loop + input + overlays
├── config.js        – tunable constants, OBSTACLE_TYPES, STATE enum
├── assets.js        – loadImage / loadFrames helpers
├── hero.js          – hero physics + sprite rendering
├── obstacles.js     – spawn, physics, collision (AABB)
├── backdrop.js      – 3-layer parallax (mountains / clouds / grass)
├── audio.js         – Web Audio engine (SFX + looping music)
├── characters/      – hero sprites (idle, run, jump, death)
├── obstacles/       – rock, log, crack
└── backdrops/       – far-mountains, forest, cloud variants
```

Each module has a narrow role. `main.js` is the only file that knows about the game's full state machine; the others expose `loadXAssets()` / `resetX()` / `updateX()` / `drawX()` entry points and nothing more.

## Assets

All assets live under `games/running-man/assets/`.

**PixelLab character used:**

- `1b27dde3-809d-47ca-8277-68bc6c5565b7` — "Human Base" (plain androgynous humanoid, 8 directions, 80×80 canvas, character ~48px tall, ~36px wide, low top-down view)

**Character** (east direction only — side-scroller always faces right):

| Folder | Source | Dimensions per frame | Frames |
| --- | --- | --- | --- |
| `characters/run/frame-0…7.png` | PixelLab template `running-8-frames` (east) | 80×80 | 8 |
| `characters/jump/frame-0…7.png` | PixelLab template `running-jump` (east) | 80×80 | 8 |
| `characters/death/frame-0…6.png` | PixelLab template `falling-back-death` (east, regenerated 2026-04-24) | 80×80 | 7 |
| `characters/idle.png` | PixelLab east rotation | 80×80 | 1 |

**Obstacles** (3 base sprites, composed into varied patterns at runtime):

| File | Source | Dimensions | Hitbox (inside sprite) |
| --- | --- | --- | --- |
| `obstacles/rock.png` | PixelLab map-object, low top-down | 48×48 | `ox:8 oy:16 w:32 h:30` |
| `obstacles/cactus.png` | PixelLab map-object, low top-down | 48×64 | `ox:16 oy:10 w:16 h:50` |
| `obstacles/crate.png` | PixelLab map-object, low top-down | 48×48 | `ox:8 oy:10 w:32 h:36` |

Each spawn picks one of `OBSTACLE_PATTERNS` (defined in `config.js`). A pattern is a list of pieces that compose into one logical obstacle group:

- `name`: which of the 3 base sprites
- `scale`: per-piece sprite + hitbox multiplier (0.6–1.3 typical)
- `dx`: horizontal offset from group origin
- `stack: true`: sit on top of the previous piece in the group

Examples shipped: solo varied scales, rocky patches (2-3 rocks), crate + cactus combos, stacked crates (single, double, triple). Multi-piece groups get a small extra delay before the next spawn so they don't crowd the screen.

**Backdrops** (parallax layers):

| File | Source | Dimensions | Scroll × | Draws at |
| --- | --- | --- | --- | --- |
| `backdrops/far-mountains.png` | PixelLab map-object, side view, flat shading | 320×96 | 0.05 | deepest layer, larger silhouette filling the sky |
| `backdrops/mountains.png` | PixelLab map-object, side view, flat shading | 192×48 | 0.15 | mid-distance range |
| `backdrops/cloud.png` | PixelLab map-object, side view, flat shading | 64×32 | 0.30 | upper sky band, sparse tiling |

*(No foreground layer as of v0.1 — the initial grass tuft sprite didn't read cleanly.)*

All sprites are individual PNGs (no atlas / spritesheet compositing). Loading = one `Image()` per file.

**Licensing:** Character and animations are PixelLab-generated, governed by [PixelLab's ToS](https://pixellab.ai/termsofservice). Not relicensed by this repo's `LICENSE-ASSETS`.

## Mechanics (as implemented)

- **Canvas:** 480×270 internal pixels, CSS-scaled up (`image-rendering: pixelated`) to fit the viewport with `aspect-ratio: 480/270`.
- **Gravity:** 1500 px/s². Jump is a single impulse (`vy = -520 px/s`). Fixed jump height — no variable/held-jump in v0.
- **Ground:** fixed at `y = 218`. Obstacles sit on the same line.
- **Obstacles:** 16×30 rectangles (placeholder art — solid brown with a darker top/bottom strip). Real sprite art can replace these in a later pass.
- **Spawn:** randomized interval between obstacles; gap shrinks from ~1.5s down to ~0.55s as the run progresses.
- **Scroll:** world scrolls left at `speed`, hero is fixed at `x = 80`.
- **Difficulty:** speed ramps from 170 → 380 px/s at +5 px/s each second.
- **Collision:** AABB between a shrunken hero hitbox (`{x:28, y:22, w:26, h:50}` inside the 80×80 sprite) and the obstacle rect.
- **Sprite alignment:** each sprite has transparent padding below the visible art. `HERO_FOOT_PAD = 20` and per-obstacle `padBottom` (rock 4, cactus 11, crate 3) shift the draw y down so the visible bottom of the art sits on `GROUND_Y`. Padding values were measured directly from each PNG's alpha channel.
- **Scoring:** distance in "meters" = `floor(distance / 10)`. High score persisted in `localStorage` under `running-man:best`.
- **States:** `intro → running → dying → dead → running` (loop). Input (SPACE / arrow-up / W / tap) starts the game from intro or dead, jumps while running.

## Audio

Synthesized in `audio.js` (Web Audio API). Events:

- `start` — two ascending triangle notes when the run starts.
- `jump` — square-wave beep with upward pitch bend.
- `milestone` — two-note chime every 100 m.
- `death` — sawtooth pitch-drop + filtered noise impact + low sine thud.
- Background music — C major pentatonic phrase on triangle + square bass, 132 BPM, driven by `setInterval`. Fades out on death.

Mute is persisted per-game in `localStorage` (`running-man:muted`). Toggle via the 🔊 / 🔇 button in the HUD or the `M` key.

## Known issues / deferred

- Mobile touch works via `pointerdown` but the layout hasn't been tuned for phones.
- The PixelLab hero is "low top-down" view, not "side" view, so the running cycle reads OK but isn't a true profile. Acceptable for the first demo.

## Changelog

- `2026-04-24` — v0: initial playable build. Vanilla JS + Canvas2D. PixelLab character `1b27dde3-809d-47ca-8277-68bc6c5565b7` with `running-8-frames`, `running-jump`, `falling-back-death` (east). Placeholder rectangle obstacles.
- `2026-04-24` — v0.1: replaced placeholder obstacles with 3 PixelLab map-object sprites (rock / cactus / crate). Added 3-layer parallax backdrop (mountains / clouds / grass). Reorganized assets into top-level `characters/`, `obstacles/`, `backdrops/` folders (no `assets/` wrapper). Split `main.js` into `config.js`, `assets.js`, `hero.js`, `obstacles.js`, `backdrop.js` modules. Added Web Audio engine in `audio.js` with SFX + looping music + mute toggle. Rebuilt the intro as a proper splash screen with title, blinking prompt, and animated parallax behind it. Regenerated the `falling-back-death` animation.
- `2026-04-24` — v0.1.1: fixed sprite alignment — measured the transparent padding below each sprite's art (hero 20 px, cactus 11 px, rock 4 px, crate 3 px) and offset draw positions so everything visibly sits on the ground line. Removed the grass foreground layer (looked like reeds, not grass).
- `2026-04-24` — v0.1.2: lowered `GROUND_Y` (218 → 238) and tucked the scrolling hash marks tight against the ground line (was 8 px below it) so the visible road surface lines up with where sprites rest — previously sprites were resting at `GROUND_Y` but the eye read the hash marks as "the real ground" since they sat in the dark area below. Added pause (P / Esc, or tap while paused). Music pauses with the game.
- `2026-04-24` — v0.1.3: split the single `GROUND_Y` into three per-layer anchors — `GROUND_Y = 238` (road-top / mountain horizon), `HERO_GROUND_Y = 250` (hero feet, ~20 px from bottom edge), `OBSTACLE_GROUND_Y = 260` (obstacle bases, ~10 px from bottom edge). Hero and obstacles now rest *inside* the road strip rather than on top of it. Added a 3rd backdrop layer: `backdrops/far-mountains.png` (320×96) scrolling at 0.05× for a much deeper, less bare horizon.
- `2026-04-24` — v0.1.4: added a death tune (A-minor descending cadence on triangle + square-wave harmony) that fires on collision. Regenerated `backdrops/mountains.png` at 192×96 (was 192×48) so the mid-distance range covers the gap to the far layer. Added obstacle patterns + per-piece scaling: 16 patterns shipped (solo at varied scales, rocky patches of 2-3 rocks, crate+cactus combos, single/double/triple stacked crates). Each spawn picks a random pattern and emits its constituent pieces as a synchronized group.
- `2026-04-25` — v0.2: substantial polish pass.
  - **Art swap.** Cactus → felled log; crate → road crack; rock regenerated without the bag on top. Mid-distance blue mountains replaced with a dense pine forest banner. Generated three cloud variants (puffy / large cumulus / small puff) and clustered them into bunches with sky gaps in a 960 px banner; horizontal flips give extra silhouette variety without doubling the sprite library.
  - **Layered horizon.** Far mountains tile with 30% overlap so peaks blend into one continuous range; forest tiles with 30% overlap so trees read as a continuous wall. Cloud band shifted 20 px down. Far mountains anchored 31 px below the natural horizon to free up sky.
  - **Road redraw.** Center divider replaces the under-feet stripe — dashed line down the middle of the road, IRL-style. Curb highlight at the canvas bottom edge.
  - **Hero render.** Sprite scaled 80 → 85 px and lifted ~14 px so the visible feet sit a few px above `HERO_GROUND_Y` for breathing room.
  - **Tight collision.** Hitboxes for hero and all obstacles measured directly from each PNG's alpha bbox so the collider matches the visible art 1:1. Removed the stale `padBottom` shift in `drawObstacles` that was leaving hit boxes floating above the visible art. Hero hitbox shrunk from `26×50` → `20×39` (matched to the run-frame union, scaled into canvas pixels).
  - **Obstacle rhythm.** `spawnObstacle` now mixes three gap "moods": 15% tight bursts, 60% standard cadence, 25% long breathers. Speed still tightens each bucket toward its lower bound, but breathers shrink at half-rate so the late game keeps open beats. Patterns rebuilt for the new sprites — stacking is rock-only (logs are wide, cracks are flat); added log+rock debris combos and crack-with-rock-rubble combos.
  - **Variable-height jump.** Releasing the input mid-ascent caps upward velocity to `MIN_JUMP_VY = -260` — taps become hops, holds get the full arc. Wired to `keyup` and `pointerup`/`pointercancel`.
  - **Run history.** Last 20 runs persisted to `localStorage[running-man:history]`. Death overlay redesigned: big distance up top → optional "new best!" → a 5-most-recent panel with the current run marked ▶ and the all-time best marked ★ → retry prompt at bottom.
  - **Misc.** Removed the wispy cloud sprite (read as a glitch). Generated `cloud-large.png` (96×48) and `cloud-small.png` (48×32) and the new `forest.png` (256×96).
