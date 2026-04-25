# <Game Title>

**Slug:** `<slug>` &nbsp;·&nbsp; **Folder:** `games/<slug>/` &nbsp;·&nbsp; **Status:** in-progress | playable | archived

One-line tagline describing the game.

## Concept

A short paragraph: what the game *is*, what the player *does*, and the intended feel (tone, difficulty curve, session length).

## Controls

| Input | Action |
| --- | --- |
| `Space` / Tap | Jump |
| `R` | Restart |

## Tech stack

- **Engine:** vanilla JS + Canvas2D (or Phaser 3 via CDN, or PixiJS via CDN).
- **Renderer:** `<canvas>` at `WxH`.
- **Frame rate:** targets 60 fps via `requestAnimationFrame`, delta-time throughout.
- **Dependencies:** none / list of CDN-loaded libs.

## Assets

All assets live under `games/<slug>/assets/`.

| File | Source | Dimensions | Frames | Notes |
| --- | --- | --- | --- | --- |
| `hero-run.png` | PixelLab (character `<uuid>`, template `running-8-frames`) | 80×80 | 8 | East-facing |

PixelLab character IDs used:
- `<uuid>` — "Character Name"

Licensing: PixelLab-generated art is governed by [PixelLab's ToS](https://pixellab.ai/termsofservice). Original assets authored for this game are CC BY 4.0 per the repo's `LICENSE-ASSETS`.

## Mechanics

Describe non-obvious game logic: jump physics tuning, difficulty ramp, spawn rates, scoring formula.

## Known issues / deferred

- …

## Changelog

- `YYYY-MM-DD` — initial playable build.
