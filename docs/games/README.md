# Per-game docs

Every game in this repo has its own doc file in this folder, named `<slug>.md` (matching the game's folder name under `games/`).

## Why

Per-game docs capture things that don't belong in the code:

- **Design intent** — what the game *is* and *isn't*, why certain mechanics were chosen.
- **Controls** — key bindings, touch/mouse support.
- **Asset inventory** — sprite dimensions, frame counts, which PixelLab character IDs were used, licensing.
- **Engine / tech stack** — vanilla, Phaser, PixiJS, etc. and why.
- **Known issues** — rough edges, deferred polish.
- **Changelog** — per-game version log (small; the repo-level `CHANGELOG.md` covers the whole project).

If the information is in the code already (variable names, file paths, obvious structure), don't duplicate it here. This doc is for *why* and *what-you-can't-see*.

## Template

Use [`_template.md`](_template.md) as the starting point when adding a new game doc.

## Index

Game docs are listed here in chronological order of when they were started. Update this list when adding a new game.

- [`running-man.md`](running-man.md) — side-scrolling auto-runner (first game, vanilla JS).
- [`neon-tower-defense.md`](neon-tower-defense.md) — shape-based tower defense, neon CRT aesthetic, 100% code-drawn visuals + synthesized audio (no PixelLab, no audio files).
- [`block-fps.md`](block-fps.md) — first-person shooter, 3D, polygonal gun, block enemies, Three.js via CDN.
- [`maze-runner.md`](maze-runner.md) — top-down procedural maze runner, recursive-backtracker DFS, seeded RNG, fog of war, gem collectibles, minimap (no PixelLab, no audio files).
- [`neon-blocks.md`](neon-blocks.md) — Tetris-style falling-block puzzle, SRS rotation, T-spins, 7-bag, three modes (Marathon/Sprint/Daily), layered synth music (no PixelLab, no audio files).
