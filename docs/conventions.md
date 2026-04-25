# Conventions

Code and file conventions for this repo.

## Folder layout

```
/
├── index.html           # landing page (shared)
├── games.js             # game registry (shared)
├── styles.css           # landing-page styles (shared)
├── package.json         # dependency-free; only holds `npm run dev`
├── vercel.json          # static-site deploy config
├── games/
│   └── <slug>/
│       ├── index.html
│       ├── main.js           # entry + loop + orchestration
│       ├── style.css         # optional
│       ├── <module>.js …     # split by responsibility as the game grows
│       ├── characters/       # hero / enemy sprites
│       ├── obstacles/        # obstacle / prop sprites
│       ├── backdrops/        # parallax layers
│       └── <other>/          # any additional category (enemies, fx, etc.)
├── .claude/agents/      # artist + dev subagents
├── docs/
│   ├── games/                # one doc per game
│   ├── audio.md              # Web Audio conventions
│   ├── deploy.md             # Vercel setup
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
- No transpilation, no bundler. A root `package.json` exists but holds only the `npm run dev` convenience script — it must stay dependency-free.
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

The goal: only `main.js` knows about the full state machine. Every other module exposes a handful of functions and keeps its internal state private. See `games/running-man/` for the reference implementation.

## CSS

- One shared `styles.css` at the root for the landing page only.
- Per-game styles live inside `games/<slug>/style.css`.
- Mobile-friendly layouts are nice-to-have, not required, for demos.

## Assets

- Pixel art lives in **top-level category folders inside the game** (`games/<slug>/characters/`, `obstacles/`, `backdrops/`, etc.) — see "Folder layout" above. No shared `assets/` umbrella.
- PNG for images unless there's a reason to use something else.
- **No audio files.** All audio in this repo is synthesized at runtime via the Web Audio API. See [`audio.md`](audio.md). If a game genuinely needs sample-based audio, raise it as a conversation first.

## Commit messages

- Short, imperative: `add asteroid-sweep game`, `fix landing page grid on narrow viewports`.
- One logical change per commit. Per-game scaffolding can be one commit; add mechanics in follow-ups.

## What NOT to add

- `package.json`, `node_modules`, build output — this is a no-build repo.
- UI frameworks (React, Vue, Svelte, Solid) — unless explicitly requested for a specific game.
- TypeScript, Tailwind, CSS-in-JS build tooling — unless explicitly requested.
- Bundlers (Vite, Webpack, Rollup, Parcel, esbuild) — anything that requires a build step is out.
- Shared game engines / abstractions — each game is independent until a pattern genuinely repeats 3+ times.

Game engines like **Phaser** and **PixiJS** are explicitly *allowed* (not on this "no" list) when a game's scope earns them.
