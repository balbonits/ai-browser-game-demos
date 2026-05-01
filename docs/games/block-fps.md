# Block Arena

**Slug:** `block-fps` &nbsp;·&nbsp; **Folder:** `games/block-fps/` &nbsp;·&nbsp; **Status:** playable (v0.1)

A first-person shooter built entirely by AI. The player wields a polygonal gun (low-poly viewmodel made of `BoxGeometry` parts) and defends an arena from waves of 3D-block enemies. Three.js via CDN, no build step, no third-party assets — every model is procedural geometry, every sound is synthesized at runtime.

## Concept

Wave-based arena shooter, first-person:

1. The player stands in a small enclosed arena (40 × 40 units) with a few pillars for cover.
2. Block enemies spawn at the perimeter and walk straight toward the player.
3. Click to fire a hitscan (raycast) shot. Successive shots are gated by a fire-rate timer with a tiny spread.
4. Surviving the wave's spawn budget AND clearing the field advances to the next wave (with a short cooldown — `Space` skips it).
5. Take 0 HP and the run ends.

Intended feel: stark neon void, satisfying click-pop-explode loop, sub-minute waves. A 3D counterpoint to the 2D pixel/shape pieces of the prior games.

## Controls

| Input | Action |
| --- | --- |
| `W` / `A` / `S` / `D` (or arrows) | Move |
| `Shift` (held) | Walk (half speed) |
| Mouse | Look (locked while playing) |
| Left click (held) | Auto-fire |
| `Space` | Skip inter-wave cooldown |
| `P` | Pause |
| `Esc` | Release pointer lock (auto-pauses) |
| `M` | Mute |

The first click on the canvas (intro / dead / paused screens) engages [Pointer Lock](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API). Pressing `Esc` releases the lock, which auto-pauses the game. Click again to re-lock and resume.

## Tech stack

- **Engine:** vanilla JS + [Three.js](https://threejs.org/) `0.170.0` via [esm.sh](https://esm.sh) CDN. No build step. ES modules. An `<script type="importmap">` in `index.html` aliases `three` and `three/addons/` so every module imports them like a real npm package.
- **Renderer:** `<canvas>` sized to the surrounding frame's CSS box (16:9 aspect). `WebGLRenderer` with `antialias: true`, fog enabled.
- **Frame rate:** 60 fps via `requestAnimationFrame`, delta-time throughout.
- **Audio:** Web Audio API (see [`docs/audio.md`](../audio.md)). All SFX + ambient music synthesized at runtime — no audio files.
- **Dependencies:** Three.js + its bundled `PointerLockControls` addon. **Nothing installed** — both come from the CDN at runtime.

## Module layout

```
games/block-fps/
├── index.html       – canvas + HUD overlays + Three importmap
├── style.css
├── main.js          – entry, game state, rAF loop, input wiring, HUD
├── config.js        – constants (palette, player, gun, enemies, waves)
├── world.js         – scene setup, arena, lighting, fog, particles, tracers
├── player.js        – camera, PointerLockControls, WASD movement, health
├── gun.js           – polygonal viewmodel + raycast firing + recoil
├── enemies.js       – block enemies, contact damage, spawn helpers
├── waves.js         – wave sequencer (reuses templates in endless mode)
└── audio.js         – Web Audio synth (SFX + ambient pad music)
```

## Visual & audio design

### Polygonal gun

The viewmodel is built from `BoxGeometry` primitives parented to the camera so it stays glued to the view. Each piece has an `EdgesGeometry` outline drawn alongside the body to keep the polygonal silhouette readable against the dark arena. Pieces:

- Receiver / slide (dark steel body, large box)
- Barrel (narrower box extending forward)
- Top accent rail (cyan unlit strip — the "neon trim")
- Front + rear iron sights (small red cubes)
- Trigger guard (flat plate)
- Grip (angled box, tilted forward 0.20 rad)
- Magazine extension (small cyan cube under the grip)
- Muzzle anchor (empty `Object3D` at the barrel tip — used as the origin for tracers + muzzle flash)

Recoil animation: 0.07 s ease-out kick — the group translates back along Z and tilts up briefly, then snaps to rest.

### Arena

- 40×40 unit floor with a `GridHelper` overlay at 35% opacity for a subtle "void grid" feel.
- Four perimeter walls (short height, neon-edge outlined).
- Five hand-placed pillars (1 central tall, 4 corner-ish low) for cover and to break sight-lines.
- `Fog(color, 18, 60)` so distant geometry fades into black — gives depth without lighting overhead.

### Lighting

Flat-ish neon look on purpose: low ambient `0.45`, one directional from above `0.55`, plus a cyan rim light from behind for edge glow. Materials use `MeshLambertMaterial` for cheap shading + flat polygonal color blocks.

### Enemies

| Kind | Color | HP | Speed | Damage | Score | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Grunt | red | 32 | 2.6 | 8 | 10 | Default block. |
| Charger | yellow | 18 | 5.4 | 6 | 14 | Smaller + faster, harder to track. |
| Heavy | purple | 110 | 1.8 | 16 | 35 | Large boss block, big explosion on death. |

Each enemy is a `BoxGeometry` mesh + an `EdgesGeometry` outline in its color. They spin slowly so you read them as live.

Enemy AI: each frame, project the world-space vector to the player onto XZ, normalize, and step forward by `speed * dt`. AABB-collide with arena pillars on each axis separately so they slide around obstacles. On contact (within `radius + size*0.55`), deal `dmg` once per `contactRate` seconds, with a slight knockback.

### Audio

- **Fire:** punchy low square thump + filtered noise crack (≈ 0.07 s).
- **Hit:** quick metallic chirp.
- **Kill:** triangle pop with downward bend; heavies get a layered saw + low sine + filtered noise burst.
- **Player damage:** distorted thud + noise splash.
- **Wave start / clear:** rising / ascending triangle chord stabs.
- **Defeat:** slow descending sawtooth phrase in minor.
- **Music:** very low-tempo (78 BPM) D-minor pad — long held triangle + sine notes plus a sparse square arpeggio. Sits well under continuous gunfire.

## Mechanics

### Player

- Eye height 1.65 units. Camera at world-space `(camera.x, 1.65, camera.z)` always.
- Movement is acceleration-based: input vector projected onto camera yaw → desired velocity → smooth `approach()` toward it with `PLAYER_ACCEL = 50`, `PLAYER_FRICTION = 12` for a slight "weighty" feel rather than instant velocity change.
- Collision: arena bounds + per-pillar AABB sliding. Each axis is resolved independently so the player slides along walls instead of getting stuck.
- Health: 100 HP. Taking damage triggers `HIT_INVULN = 0.45 s` of i-frames so a single contact can't drain you instantly.

### Gun

- Hitscan via `THREE.Raycaster` set from camera center (NDC `(0, 0)`) plus a tiny `GUN_SPREAD` jitter.
- Fire rate `GUN_RATE = 0.13 s` (≈ 7.7 RPS). Damage per hit `GUN_DAMAGE = 28`.
- Tracer: `Line` from muzzle world-position to the hit point (or far along the ray on miss), fades over 0.08 s.
- Muzzle flash: short-lived bright cone at the barrel tip.

### Waves

8 hand-tuned wave templates in `config.js`. Each spec:

```js
{ count, spawnEvery, kinds, max }
```

- `count` is the spawn budget for the wave.
- `spawnEvery` is seconds between spawns.
- `kinds` is the random pool drawn from per spawn (so `['grunt', 'grunt', 'charger']` weights grunts 2/3).
- `max` caps simultaneously-alive enemies — prevents the screen from piling up if the player struggles.

Wave clears when the budget is exhausted AND the field is empty. After wave 8, the last template loops in **endless mode** with multipliers: `+20%` HP per endless wave (no cap) and `+10%` count. The HUD wave label switches from `WAVE NN` to `WAVE NN ∞`.

### Persistence

`localStorage`:
- `block-fps:best-wave` — highest wave reached.
- `block-fps:best-score` — highest total score.
- `block-fps:muted` — audio mute preference.

## Known issues / deferred

- **No mobile support.** Touch + mobile pointer events don't translate cleanly to mouse-look + click-fire. Desktop only for now.
- **Pointer lock requires HTTPS or localhost.** Hosted on Vercel that's fine; opening `index.html` via `file://` won't work — use `npm run dev`.
- **No physics other than AABB.** Enemy/wall collision is axis-by-axis; there's no fancy capsule physics. Good enough for arenas of this size.
- **Performance unprofiled on low-end mobile/integrated graphics.** A handful of cubes + edges + sparks should be fine, but explicit perf passes haven't been done.
- **No reload / ammo.** Infinite ammo with cooldown only. Could be added as a polish pass.

## Testing

The game exposes a read-only debug hook on `window.__gameTest` when loaded with `?test=1` in the URL (`/games/block-fps/index.html?test=1`). In production (no `?test=1`) the hook is absent — gated by the query parameter check at the bottom of `main.js`, after all game variables are initialized.

### THREE bare-import resolution

`config.js` uses `import * as THREE from 'three'` (a bare specifier) to construct `TMP_VEC` and `TMP_VEC2`. The browser resolves this via the `<script type="importmap">` in `index.html`. Node-side Vitest needs the same bare specifier resolved — solved by adding `three@0.170.0` as a devDependency in `package.json`. The game itself still loads THREE from the esm.sh CDN at runtime; the devDep is test-only scaffolding. This is the "Option 1 (preferred)" approach from the brief.

### Hook surface (`window.__gameTest`)

| Accessor | Returns |
| --- | --- |
| `getState()` | Current game state string: `'intro'` \| `'playing'` \| `'paused'` \| `'dead'` |
| `getWave()` | Last completed wave index (0 = none yet) |
| `getScore()` | Current score (number) |
| `getHp()` | Current player HP (number; 100 at start) |
| `getEnemies()` | Array of `{ kind, hp, pos: { x, y, z } }` copies for each alive enemy |
| `getPlayer()` | `{ pos: { x, y, z }, vel: { x, y, z }, hp, alive }` — all plain numbers, no THREE refs |
| `getBestWave()` | Best wave reached across all runs (`localStorage`) |
| `getBestScore()` | Best score across all runs (`localStorage`) |

All accessors return copies. THREE.Vector3 values are serialized to plain `{ x, y, z }` objects so Playwright's `evaluate()` can serialize them across the page boundary.

### Test files

| Tier | File | What it covers |
| --- | --- | --- |
| Unit | `tests/unit/block-fps/config.test.js` | ENEMIES table (hp/speed/score sanity), WAVES (count/spawnEvery/kinds validity, TOTAL_WAVES=8), endlessMultipliers, game constants |
| Unit | `tests/unit/block-fps/enemies.test.js` | `damageEnemy`: HP reduction, overkill clamp-to-0, dead guard, per-kind shot counts |
| Unit | `tests/unit/block-fps/gun.test.js` | Fire-rate gating formula (pure arithmetic), `getGunDamage`, `setFiring`/`isFiring` round-trip |
| Unit | `tests/unit/block-fps/waves.test.js` | Wave state machine: `startWave`/`resetWaves`/`markWaveCleared` and all boolean accessor contracts |
| Replay | `tests/replay/block-fps.replay.test.js` | Deterministic damage sequences: grunt (2 shots), charger (1 shot), heavy (4 shots); mixed-wave total (7 shots) |
| Property | `tests/property/block-fps-damage.property.test.js` | HP never negative; `final hp == max(0, start - sum(damages))` for any sequence |
| Property | `tests/property/block-fps-endless.property.test.js` | `endlessMultipliers(idx).hp >= 1` and `.count >= 1` for any idx; strictly increasing past TOTAL_WAVES |
| E2E | `tests/e2e/block-fps.spec.ts` | Intro state on load, HP=100, wave=0, score=0, no alive enemies, player position, mute persistence, best-wave localStorage |

### Skipped / deferred test coverage

**Pointer-lock-dependent gameplay (E2E).** Playwright cannot simulate the user gesture required to acquire pointer lock in a headless browser context without `--enable-features` flags. Consequently:
- The `intro → playing` state transition (requires pointer lock) is not E2E tested.
- Wave spawn progression (requires playing state) is not E2E tested.
- Kill counting and score accumulation are not E2E tested.

These behaviors are covered indirectly by unit and replay tests (damage model, wave state machine). A full integration test would require either running Playwright with `--enable-features=PointerLockOptions` or refactoring the start trigger to not require pointer lock. Deferred.

**Replay tier — limited scope.** The game uses `Math.random()` (unseeded) for enemy spawn positions, enemy kind selection, bullet spread, and spark trajectories. Full deterministic replay of the 3D game loop would require seeding Math.random and constructing a real THREE scene. Instead, the replay tier tests only the damage model (the one fully deterministic layer), which is sufficient to catch balance config regressions.

**`updateEnemies`, `spawnEnemy`, `updateWaves`, `tryFire` (unit).** These functions require a THREE scene or call `Math.random()` in ways that make unit testing impractical without substantial test infrastructure. Their contracts are enforced by config unit tests + damage unit/property/replay tests at a lower level.

## Changelog

- `2026-05-01` — v0.2 test backfill:
  - **Test hook added** to `main.js` (gated by `?test=1`): `getState`, `getWave`, `getScore`, `getHp`, `getEnemies`, `getPlayer`, `getBestWave`, `getBestScore`.
  - **`enemies` imported** in `main.js` (was missing from the import list; needed for the `getEnemies` hook).
  - **`three` added** as a devDependency (`^0.170.0`) so Vitest resolves the bare `'three'` specifier in Node.
  - **Unit tests added:** `config.test.js` (35 assertions), `enemies.test.js` (15 assertions), `gun.test.js` (12 assertions), `waves.test.js` (14 assertions).
  - **Replay test added:** `block-fps.replay.test.js` (4 deterministic damage snapshots).
  - **Property tests added:** `block-fps-damage.property.test.js` (2 invariants × 200 runs), `block-fps-endless.property.test.js` (4 invariants × 200 runs).
  - **E2E tests added:** `block-fps.spec.ts` (13 tests: initial state, player state, mute persistence).

- `2026-04-25` — v0.1: initial playable build. Three.js via esm.sh CDN, vanilla ES modules, no build step. Polygonal gun viewmodel, raycast hitscan firing, 3-enemy-type wave system (grunt/charger/heavy), 8 hand-tuned waves + endless mode with HP/count multipliers. PointerLock-based FPS controls (WASD + mouse-look). Web Audio synth (no audio files).
