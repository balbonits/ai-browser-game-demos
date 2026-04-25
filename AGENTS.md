# AGENTS.md

Guidance for any AI coding agent (Claude Code, Cursor, Copilot, Aider, etc.) working in this repo. Claude-specific notes live in [`CLAUDE.md`](CLAUDE.md); deeper docs in [`docs/`](docs/).

## Project purpose

Showcase of browser games built **entirely by AI** under human direction. The human directs and reviews; agents implement.

## Non-negotiables

1. **Static only, no build step.** No bundler, no `npm install` needed to run the games. A `package.json` exists for the `npm run dev` convenience script *only* — it must stay dependency-free. Third-party libraries load via CDN. Games must run by opening `games/<slug>/index.html` in a browser (via `npm run dev` for ES modules).
2. **Vanilla-first.** Default to plain HTML/CSS/JS with `<canvas>`. Engines like **Phaser** and **PixiJS** are permitted when a game's scope genuinely needs them — pull them in via CDN and confirm the choice with the user before using them for the first time on a given game.
3. **Still off-limits without approval:** UI frameworks (React/Vue/Svelte), TypeScript, Tailwind, or anything requiring a build step.
4. **Self-contained games.** Everything a game needs lives under `games/<slug>/`. Do not share code or assets between games unless that's formally extracted into a shared module (ask first).
5. **Register games** in `games.js` at the repo root so they show on the landing page.
6. **Attribution honesty.** If a file was authored or edited by a human, note it in a comment or the game's folder README. The premise of this repo is "AI-built" — keep that claim truthful.

## Repository layout

```
index.html       # landing page (shared)
games.js         # landing-page game registry (shared)
styles.css       # landing-page styles (shared)
games/<slug>/    # one folder per game; owns its own HTML/CSS/JS/assets
docs/            # workflows, conventions, asset pipeline notes
```

## Workflow for adding a game

1. Pick a short kebab-case slug (e.g. `asteroid-sweep`).
2. Create `games/<slug>/index.html` with a minimal shell and any sibling files it needs.
3. Generate art via PixelLab MCP (characters, tilesets, etc.) and save under `games/<slug>/assets/`.
4. Add an entry to `GAMES` in `games.js` with `slug`, `title`, `description`.
5. Test by opening the root `index.html` and clicking through.

Full checklist: [`docs/adding-a-game.md`](docs/adding-a-game.md).

## Coding conventions

- Vanilla HTML/CSS/JS as the default. ES modules welcome if the browser can load them directly.
- **Phaser** and **PixiJS** are acceptable engines when a game's scope earns them — load via CDN, confirm first use on a game with the user.
- Prefer `<canvas>` for game rendering; DOM is fine for UI/menus.
- Keep files small and readable. These are demos.
- Do not introduce TypeScript, React, Vue, Svelte, Vite, Webpack, Tailwind, or any build-step tooling without being asked.

## Asset generation

Pixel art comes from PixelLab via MCP. See [`docs/pixellab.md`](docs/pixellab.md). Jobs are async — get a job ID, poll, download, commit under the game's `assets/`.

## Licenses

- Code: MIT (see [`LICENSE`](LICENSE)).
- Original creative assets authored for this repo: CC BY 4.0 (see [`LICENSE-ASSETS`](LICENSE-ASSETS)).
- PixelLab-generated art is governed by [PixelLab's TOS](https://pixellab.ai/termsofservice); do not relicense it beyond what PixelLab permits.

## Per-game documentation

Every game gets its own doc file at `docs/games/<slug>.md`. It captures design intent, controls, asset inventory, and known issues. See [`docs/agents.md`](docs/agents.md) and [`docs/games/README.md`](docs/games/README.md) for the template and expectations.

## Subagents (Claude Code)

Two project-level subagents live under `.claude/agents/`:

- **`artist`** — PixelLab MCP asset generation and organization.
- **`dev`** — vanilla-JS (or Phaser/PixiJS) game code.

Orchestrators (the main conversation) delegate to these by task type. See [`docs/agents.md`](docs/agents.md) for the full rundown.

## Ask before

- Adding a dependency, build tool, or package manager (Node/npm).
- Pulling in a new engine (Phaser, PixiJS) for the first time on a given game.
- Changing shared root files (`index.html`, `games.js`, `styles.css`) in a structural way.
- Extracting shared code into a new top-level module.
- Deleting or renaming an existing game.
