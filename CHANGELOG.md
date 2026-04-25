# Changelog

All notable changes to this repository are tracked here. Per-game changelogs live in each game's doc under [`docs/games/`](docs/games/).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); dates are ISO 8601 (`YYYY-MM-DD`).

## [Unreleased]

### Added
- Repo scaffolding: `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/`, `LICENSE` (MIT), `LICENSE-ASSETS` (CC BY 4.0) with a carve-out noting PixelLab-generated art remains governed by PixelLab's ToS.
- `docs/adding-a-game.md`, `docs/pixellab.md`, `docs/conventions.md`, `docs/agents.md`, `docs/deploy.md`.
- Per-game doc structure under `docs/games/` with a `_template.md` and a README index.
- `docs/games/running-man.md` — design + implementation doc for the first game.
- Claude Code subagent personas at `.claude/agents/`:
  - `artist` — PixelLab MCP asset generation and asset-folder organization.
  - `dev` — vanilla-JS / Phaser / PixiJS game code.
- **First game: `running-man`** (vanilla JS + Canvas2D, 480×270 internal resolution). Auto-runner; SPACE / tap to jump; scrolling obstacles; distance scoring with `localStorage` high-score; trip-and-fall death animation. Art generated via PixelLab character `1b27dde3-809d-47ca-8277-68bc6c5565b7` "Human Base" — `running-8-frames`, `running-jump`, `falling-back-death` (east direction). Registered in `games.js` on the landing page.
- `package.json` with a single `dev` script (`npm run dev`) that runs `python3 -m http.server` on a random free port. **No dependencies** — the package.json is a convenience wrapper only.
- `vercel.json` for deploying as a static site to Vercel (clean URLs, cache headers on game assets). Intended as a subsite of `jdilig.me` (e.g. `games.jdilig.me`). See `docs/deploy.md`.
- `.vercel/` added to `.gitignore`.

### Changed
- Relaxed the "no frameworks" stance in `CLAUDE.md`, `AGENTS.md`, `docs/conventions.md`, and `.claude/agents/dev.md`: **Phaser** and **PixiJS** are now explicitly allowed (via CDN, no build step) when a game's scope earns them. Still off-limits without approval: UI frameworks (React/Vue/Svelte), TypeScript, Tailwind, or anything requiring a build step.
- Removed the "no `package.json`" rule (replaced with "no dependencies in `package.json`") now that a dependency-free `package.json` exists for `npm run dev`.
- Reworded local-dev instructions across docs to avoid hard-coded ports — now `npm run dev` or `python3 -m http.server 0` (bind a random free port) so nothing clashes with other local dev servers.
- **Asset layout convention**: no `assets/` umbrella — art categories live at the top level of each game folder (`characters/`, `obstacles/`, `backdrops/`, etc.). Documented in `docs/conventions.md` and `docs/adding-a-game.md`. Migrated `running-man` accordingly.
- **Script layout convention**: games past a few hundred lines split `main.js` into focused modules (`config.js`, `assets.js`, `hero.js`, `obstacles.js`, `backdrop.js`, `audio.js`). `main.js` stays slim as entry + state machine + loop. Documented in `docs/conventions.md`. Running Man is the reference implementation.

### Legal / attribution (public-facing)
- `credits.html` at the site root — full public summary of licensing: MIT for code, CC BY 4.0 for original assets, and an explicit carve-out noting PixelLab-generated pixel art remains governed by [PixelLab's ToS](https://pixellab.ai/termsofservice). Includes per-game credits (character IDs, template names, tool attributions).
- Every page (`index.html`, `games/<slug>/index.html`, `credits.html`) now carries `<meta name="copyright">` + `<meta name="author">` and a footer with license links. Legal posture is visible on the deployed site, not just in the repo's `LICENSE` files.
- Landing page footer links: `LICENSE`, `LICENSE-ASSETS`, PixelLab ToS, `credits.html`.
- Per-game footer shows a compact legal strip with the same links.

### Running Man (v0.1)
- Replaced placeholder rectangle obstacles with 3 PixelLab map-object sprites (rock, cactus, crate) — randomized per spawn, per-sprite hitboxes inside the 48×48/48×64 sprite canvas.
- Added 3-layer parallax backdrop: distant mountains (0.15× scroll), drifting clouds (0.30×), foreground grass tufts (1.00×, drawn over hero for depth). All PixelLab map-objects.
- Rebuilt the intro as a proper splash screen: title, accent underline, blinking "press SPACE" prompt, best-score line, with the animated parallax visible behind it.
- Added Web Audio engine (`audio.js`): synthesized SFX (start / jump / milestone / death) and a looping chip-tune pentatonic melody with a square-wave bass. Fade-out on death. Mute button in HUD + `M` shortcut; persisted in `localStorage`.
- Milestone chime every 100m.
- Regenerated the `falling-back-death` animation (user re-ran on PixelLab side).

### Neon Tower Defense (v0.2)
- **Endless mode.** After wave 12 the campaign no longer ends — the wave counter keeps climbing into score-attack territory. The 12 wave templates cycle (`idx → WAVES[(idx-1) % 12]`) and a per-wave multiplier scales enemy HP `+30%`, speed `+4%` (capped at `1.40×`), spawn count `+8%`, and kill reward `+25%`. Reward scales close to the HP curve so the player stays solvent through upgrades. Defeat is the only run-ender now. HUD label flips from `NN/12` to `NN ∞`, `best: wave NN ∞` shows on the intro, and a `SURVIVED N WAVES` milestone fires every 5 endless waves.

### Neon Tower Defense (v0.1)
- New game added: shape-based tower defense in a neon CRT aesthetic. **No PixelLab, no audio files.** Every visual is a geometric primitive drawn from `render.js`; every sound is synthesized at runtime in `audio.js`. Intended as a counterpoint to Running Man's pixel-art pipeline — the same engine philosophy (vanilla JS + Canvas2D + Web Audio), but a completely different aesthetic stack.
- 12 hand-tuned waves with 3 boss waves (4, 8, 12). 3 tower types × 3 upgrade levels each (Bolt/Pulse/Spike triangle/square/diamond). 4 enemy shapes (square / tri / hex / diamond-boss). Build / upgrade / sell economy with a 70% refund. Mechanics include AoE splash, pierce, and slow.
- Modules: `main.js` (state machine + loop + input), `config.js` (tables + palette), `map.js` (path + buildable mask), `render.js` (neon shape primitives + glow + particles), `enemies.js`, `towers.js`, `projectiles.js`, `waves.js`, `audio.js`.
- Persists best wave + mute preference in `localStorage` (`neon-td:best` / `neon-td:muted`).
- Registered in `games.js`, doc at [`docs/games/neon-tower-defense.md`](docs/games/neon-tower-defense.md).

### Running Man (v0.2)
- **Art swap.** `cactus` → felled `log`, `crate` → road `crack`, rock regenerated without the bag. Mid-distance blue mountains replaced with a dense pine `forest.png` banner. Three cloud variants (`cloud.png`, `cloud-large.png`, `cloud-small.png`) clustered into bunches with sky gaps in a 960 px banner; horizontal flips give extra silhouette variety.
- **Layered horizon.** Far mountains and forest both tile with 30% overlap so peaks and trees blend seam-free. Cloud band shifted 20 px down. Far mountains anchored 31 px below the natural horizon to free up sky.
- **Road redraw.** Center divider down the middle of the road (IRL-style) replaced the under-feet stripe.
- **Hero render.** Sprite scaled 80 → 85 px and lifted ~14 px so the visible feet sit slightly above `HERO_GROUND_Y` for breathing room.
- **Tight collision.** Hitboxes for hero and all obstacles measured directly from each PNG's alpha bbox — collider matches visible art 1:1. Removed the stale `padBottom` shift in `drawObstacles`. Hero hitbox shrunk `26×50` → `20×39`.
- **Spacing rhythm.** `spawnObstacle` mixes three gap moods: 15% tight bursts, 60% standard cadence, 25% long breathers (which shrink at half-rate so late-game still has open beats). Patterns rebuilt for the new sprites — stacking is rock-only.
- **Variable-height jump.** Releasing input mid-ascent caps upward velocity (`MIN_JUMP_VY = -260`). Tap = hop, hold = full arc.
- **Run history.** Last 20 runs persisted to `localStorage[running-man:history]`. Death overlay shows the 5 most recent runs, current marked ▶, all-time best marked ★.
- See [`docs/games/running-man.md`](docs/games/running-man.md) for the full v0.2 changelog entry.

---

## How to update this file

- Add changes under `[Unreleased]` as they happen.
- When cutting a version (e.g. tagging `v0.1.0`), rename `[Unreleased]` to `[0.1.0] - YYYY-MM-DD` and start a fresh `[Unreleased]` block above it.
- Group entries under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Link to the relevant game doc when the change is game-specific (e.g. "see [`docs/games/running-man.md`](docs/games/running-man.md)").
