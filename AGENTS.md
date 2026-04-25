# AGENTS.md

Guidance for any AI coding agent (Claude Code, Cursor, Copilot, Aider, etc.) working in this repo. Claude-specific notes live in [`CLAUDE.md`](CLAUDE.md); deeper docs in [`docs/`](docs/).

## Project purpose

Showcase of browser games built **entirely by AI** under human direction. The human directs and reviews; agents implement.

## Two-layer architecture

This repo has **two layers with different rules**. Don't apply game rules to the shell or vice versa.

### Layer 1 — landing shell (`/`, `src/`)

- React 19 + TypeScript + Vite + Tailwind 4 + React Router 7. Mirrors `jdilig-me-v3` so design tokens, components, and behaviour stay in sync with the parent site.
- Build with `npm run build` (`tsc -b && vite build`); output goes to `dist/`. Vercel auto-detects Vite.
- Static assets (`LICENSE`, `LICENSE-ASSETS`, `logo.png`, `credits.html`, the games folders) live in `public/` and are served verbatim. Repo-root `LICENSE` + `LICENSE-ASSETS` are surfaced via a small Vite plugin so they remain a single source of truth at the repo root.

### Layer 2 — games (`public/games/<slug>/`)

- **Static only, no build step.** A game must run by opening its `index.html` over an HTTP server — no bundler, no transpilation, no `npm install` required.
- Vanilla HTML/CSS/JS by default. **Phaser**, **PixiJS**, and **Three.js** are permitted via CDN when a game's scope earns them — confirm first use on a given game with the user.
- **Off-limits inside a game folder:** UI frameworks (React/Vue/Svelte), TypeScript, Tailwind, anything requiring a build step. Games stay portable static folders.
- Self-contained: each game owns its assets under top-level category folders inside its slug folder.

## Non-negotiables

1. **Layer 2 stays buildless.** Even if the shell has a build, individual games must remain pure static folders.
2. **No hand-written game code.** Agents implement; the human directs and reviews. If a human authors something, it's noted in the game's folder.
3. **Self-contained games.** Everything a game needs lives under `public/games/<slug>/`. Do not share code or assets between games unless that's formally extracted into a shared module (ask first).
4. **Register games** in `src/data/games.ts` so the landing page picks them up.
5. **Attribution honesty.** The premise of this repo is "AI-built" — keep that claim truthful.

## Repository layout

```
index.html              # Vite entry (React app shell)
package.json            # React + Vite + TS + Tailwind deps
vite.config.ts          # Vite + Tailwind plugin + license-copy plugin
tsconfig*.json          # TS configs (project references)
src/                    # React app source
  main.tsx              # entry
  App.tsx               # router root
  router.tsx            # routes table
  index.css             # Tailwind + tokens import
  styles/tokens.css     # design tokens (mirrored from jdilig-me-v3)
  layouts/SiteLayout.tsx
  components/site/      # Header, Footer, GameCard
  components/icons.tsx
  data/games.ts         # game registry (typed)
  routes/Home.tsx
  hooks/useTheme.ts
public/                 # served verbatim at site root
  games/<slug>/         # one folder per game; vanilla static
  credits.html
  logo.png
docs/                   # workflows, conventions, asset pipeline notes
LICENSE, LICENSE-ASSETS # repo-root, served via vite plugin
```

## Workflow for adding a game

1. Pick a short kebab-case slug (e.g. `asteroid-sweep`).
2. Create `public/games/<slug>/index.html` with a minimal shell and any sibling files it needs.
3. Generate art via PixelLab MCP (characters, tilesets, etc.) and save under top-level category folders inside the game folder.
4. Add an entry to `GAMES` in `src/data/games.ts` with `slug`, `title`, `year`, `kind`, `description`, `tags`.
5. Test by running `npm run dev` and clicking through.

Full checklist: [`docs/adding-a-game.md`](docs/adding-a-game.md).

## Coding conventions

- **Inside a game folder**: vanilla HTML/CSS/JS, ES modules welcome. Phaser/PixiJS/Three.js via CDN. No TS, no Tailwind, no build step.
- **Inside `src/`**: TypeScript strict, React 19 functional components, Tailwind utilities + design tokens, React Router 7 hooks-style routing. Mirror `jdilig-me-v3` patterns where applicable.

## Asset generation

Pixel art comes from PixelLab via MCP. See [`docs/pixellab.md`](docs/pixellab.md). Jobs are async — get a job ID, poll, download, commit under `public/games/<slug>/<category>/`.

## Licenses

- Code: MIT (see [`LICENSE`](LICENSE)).
- Original creative assets authored for this repo: CC BY 4.0 (see [`LICENSE-ASSETS`](LICENSE-ASSETS)).
- PixelLab-generated art is governed by [PixelLab's TOS](https://pixellab.ai/termsofservice); do not relicense it beyond what PixelLab permits.
- Third-party libraries (React, Three.js, etc.) are governed by their own upstream licenses; not relicensed here.

## Per-game documentation

Every game gets its own doc file at `docs/games/<slug>.md`. It captures design intent, controls, asset inventory, and known issues. See [`docs/agents.md`](docs/agents.md) and [`docs/games/README.md`](docs/games/README.md) for the template and expectations.

## Subagents (Claude Code)

Two project-level subagents live under `.claude/agents/`:

- **`artist`** — PixelLab MCP asset generation and organization.
- **`dev`** — game code (vanilla / Phaser / PixiJS / Three.js inside `public/games/<slug>/`) and shell code (React / TS / Tailwind inside `src/`).

Orchestrators delegate to these by task type. See [`docs/agents.md`](docs/agents.md).

## Ask before

- Adding a build step **inside a game folder** (don't — propose a different solution).
- Pulling in a new engine (Phaser, PixiJS, Three.js) for the first time on a given game.
- Adding a new top-level dependency to `package.json`.
- Adding a new shell route or restructuring `src/`.
- Extracting shared code into a new top-level module.
- Deleting or renaming an existing game.
