# Conventions

Code and file conventions for this repo.

## Folder layout

```
/
├── index.html           # Vite entry for the React landing shell
├── package.json         # scripts + shell/test dev dependencies (games never import from it)
├── vite.config.ts, vitest.config.ts, playwright.config.ts, tsconfig*.json
├── vercel.json          # Vercel build + cache config
├── src/                 # landing shell: React + TS + Tailwind
│   ├── data/games.ts    # game registry (shared)
│   ├── components/site/ # Header, Footer, GameCard
│   └── routes/, layouts/, hooks/, styles/
├── public/              # served verbatim at the site root
│   ├── credits.html
│   ├── logo.png
│   └── games/
│       └── <slug>/
│           ├── index.html
│           ├── main.js           # entry + loop + orchestration
│           ├── style.css         # optional
│           ├── <module>.js …     # split by responsibility as the game grows
│           ├── characters/       # hero / enemy sprites
│           ├── obstacles/        # obstacle / prop sprites
│           ├── backdrops/        # parallax layers
│           └── <other>/          # any additional category (enemies, fx, etc.)
├── tests/               # unit / replay / property / e2e / shared
├── .husky/pre-push      # runs `npm test`
├── .claude/agents/      # artist + dev subagents
├── docs/
│   ├── games/                # one doc per game
│   ├── audio.md              # Web Audio conventions
│   ├── deploy.md             # Vercel setup
│   ├── testing.md            # test tiers + workflow
│   └── …
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── CHANGELOG.md
├── LICENSE
└── LICENSE-ASSETS
```

**No single `assets/` umbrella.** Each art category gets its own top-level folder inside the game (`characters/`, `obstacles/`, `backdrops/`, etc.). This scales better as games accumulate more distinct categories (enemies, pickups, fx, UI) and keeps imports obvious at a glance.

## Slugs

- Lowercase, kebab-case, no spaces, no punctuation.
- Short but descriptive: `asteroid-sweep`, not `ast` or `my-first-asteroid-game`.
- Immutable once a game is published — treat the slug as the public URL.

## JavaScript

- Vanilla ES modules (`<script type="module">`) as the default.
- **Phaser** and **PixiJS** are acceptable engines when a game's scope earns them. Load via CDN (`<script src="https://cdn.jsdelivr.net/npm/phaser@3...">`). Confirm the engine choice with the user the first time it's used on a given game.
- Inside a game folder: no transpilation, no bundler. The root `package.json` belongs to the landing shell and test tooling (React, Vite, Tailwind, Vitest, Playwright); game code must never depend on it or on `node_modules`.
- Target modern evergreen browsers (latest Chrome/Firefox/Safari). Don't add polyfills for IE.
- Prefer `const` / `let`; avoid `var`.
- Small files over clever files.

### When to split into modules

`main.js` alone is fine for a tiny game (a few hundred lines). Past that, split by responsibility:

- `config.js` — tunable constants, enum tables, state machine values.
- `assets.js` — tiny reusable loaders (`loadImage`, `loadFrames`).
- `hero.js` / `enemies.js` / `obstacles.js` — one module per kind-of-thing, each exposing `loadXAssets()` / `resetX()` / `updateX()` / `drawX()`.
- `backdrop.js` — parallax layers.
- `audio.js` — the Web Audio engine.
- `main.js` — stays slim: entry point, game state, input wiring, main loop.

The goal: only `main.js` knows about the full state machine. Every other module exposes a handful of functions and keeps its internal state private. See `public/games/running-man/` for the reference implementation.

## CSS

- The landing shell is styled with Tailwind utilities plus design tokens in `src/styles/tokens.css` — no per-page CSS files.
- Per-game styles live inside `public/games/<slug>/style.css` (plain CSS).
- Mobile-friendly layouts are nice-to-have, not required, for demos.

## Assets

- Pixel art lives in **top-level category folders inside the game** (`public/games/<slug>/characters/`, `obstacles/`, `backdrops/`, etc.) — see "Folder layout" above. No shared `assets/` umbrella.
- PNG for images unless there's a reason to use something else.
- **No audio files.** All audio in this repo is synthesized at runtime via the Web Audio API. See [`audio.md`](audio.md). If a game genuinely needs sample-based audio, raise it as a conversation first.

## Commit messages

- Short, imperative: `add asteroid-sweep game`, `fix landing page grid on narrow viewports`.
- One logical change per commit. Per-game scaffolding can be one commit; add mechanics in follow-ups.

## What NOT to add

- `node_modules` or build output (`dist/`, `playwright-report/`, `test-results/`) — all git-ignored.
- UI frameworks (React, Vue, Svelte, Solid) inside a game folder — React is for the landing shell in `src/` only.
- TypeScript, Tailwind, CSS-in-JS build tooling inside a game folder.
- Bundlers or any build step inside a game folder. (The shell has a Vite build; games are copied verbatim from `public/`.)
- New top-level dependencies in `package.json` without asking.
- Shared game engines / abstractions — each game is independent until a pattern genuinely repeats 3+ times.

Game engines like **Phaser** and **PixiJS** are explicitly *allowed* (not on this "no" list) when a game's scope earns them.
