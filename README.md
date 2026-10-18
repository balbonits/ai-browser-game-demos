# AI Browser Game Demos

**Live site:** <https://games.jdilig.me> &nbsp;·&nbsp; mirror: <https://ai-browser-game-demos.vercel.app>

A personal portfolio showcase: a collection of browser games and game demos, **built entirely by AI** under my direction.

The goal of this repo is to explore what modern AI tooling can produce end-to-end — code, art, audio, design — with me acting as the director rather than the implementer.

## Games

Play them live at <https://games.jdilig.me>, or run the repo locally (see [Running locally](#running-locally)). Each game opens at `/games/<slug>/index.html`. Per-game design notes, full control tables, and changelogs live in [`docs/games/`](docs/games/).

| Game | Genre | How to play | Stack |
| --- | --- | --- | --- |
| [Running Man](public/games/running-man/) ([live](https://games.jdilig.me/games/running-man/index.html)) | Side-scrolling auto-runner | `Space` / `↑` / `W` / tap to jump over obstacles; beat your distance | Vanilla JS · Canvas2D · PixelLab · Web Audio |
| [Neon Tower Defense](public/games/neon-tower-defense/) ([live](https://games.jdilig.me/games/neon-tower-defense/index.html)) | Tower defense | `1`/`2`/`3` pick a tower, click a tile to build, `U` upgrade, `S` sell, `Space` next wave | Vanilla JS · Canvas2D · Web Audio |
| [Block Arena](public/games/block-fps/) (`block-fps`, [live](https://games.jdilig.me/games/block-fps/index.html)) | First-person shooter | Click to lock the mouse, `WASD` move, hold left click to fire, `P` pause | Three.js · WebGL · Web Audio |
| [Maze Runner](public/games/maze-runner/) ([live](https://games.jdilig.me/games/maze-runner/index.html)) | Procedural maze | `WASD` / arrows to move, `Space` start, `E` custom seed, `H` seed history, `1`/`2`/`3` size | Vanilla JS · Canvas2D · Web Audio |
| [Neon Blocks](public/games/neon-blocks/) ([live](https://games.jdilig.me/games/neon-blocks/index.html)) | Falling-block puzzle | Arrows / `A` `D` move, `Space` hard drop, `X`/`Z` rotate, `Shift`/`C` hold | Vanilla JS · Canvas2D · Web Audio |
| [Idle Hoops RPG](public/games/idle-hoops-rpg/) ([live](https://games.jdilig.me/games/idle-hoops-rpg/index.html)) | Idle / RPG | Mostly mouse/tap: manage the roster, buy upgrades, earn achievements; keeps progressing offline | Vanilla JS · DOM UI · localStorage |

The same registry (`slug`, title, genre, description, tags) drives the landing page cards from [`src/data/games.ts`](src/data/games.ts).

## Tools used

- **[Claude Code](https://claude.com/claude-code)** — writes and edits all game code (HTML / CSS / JS) and the landing shell.
- **[PixelLab.ai](https://pixellab.ai)** — generates pixel-art characters, animations, and tilesets via MCP (used by Running Man).
- **[Three.js](https://threejs.org/)** — Block Arena (`block-fps`) loads a pinned `three@0.170.0` from the [esm.sh](https://esm.sh) CDN at runtime via an import map in its `index.html`. It needs network access to play, and nothing is installed or bundled for it.
- **Web Audio API** — every SFX and music track in this repo is synthesized at runtime. No audio files are committed.

No hand-written game code. No hand-drawn art. If a human wrote it, it's an exception and it's noted in that game's folder.

## Structure

The repo has two layers with different rules:

- **Landing shell** — a React 19 + TypeScript + Vite + Tailwind 4 + React Router 7 app that renders the home page and game card grid.
- **Games** — each is a self-contained, buildless static folder (vanilla HTML/CSS/JS, plus CDN libraries when needed). Vite copies `public/` verbatim.

```
index.html                # Vite entry for the React shell
package.json              # scripts + dev dependencies
vite.config.ts            # Vite, Tailwind, and the LICENSE-copy plugin
vitest.config.ts          # unit / replay / property projects
playwright.config.ts      # e2e (Chromium); starts `npm run dev`
vercel.json               # Vercel build + cache config
src/                      # landing shell (React + TS)
  data/games.ts           # game registry shown on the landing page
  components/site/        # Header, Footer, GameCard
  routes/, layouts/, hooks/, styles/
public/
  games/<slug>/           # each game, fully self-contained
  credits.html            # public licensing / credits page
  logo.png
tests/                    # unit, replay, property, e2e, shared helpers
docs/                     # workflows, conventions, testing, per-game docs
.husky/pre-push           # runs `npm test` before every push
.claude/agents/           # artist + dev subagent definitions
CLAUDE.md, AGENTS.md      # guidance for AI coding agents
LICENSE, LICENSE-ASSETS   # repo root; served at the site root by a Vite plugin
```

## Running locally

Requires Node.js; development and testing were done on Node 22 (there is no `engines` field or `.nvmrc`).

```sh
npm install
npm run dev
```

`npm run dev` runs Vite and serves the site at <http://localhost:5173> (the port Playwright also expects). Games are served from `public/games/`, so open them via the landing page or directly, for example <http://localhost:5173/games/neon-blocks/index.html> (include `index.html` in dev; the bare `/games/<slug>/` URL is intercepted by the React router).

Other scripts:

```sh
npm run build     # tsc -b && vite build, output in dist/
npm run preview   # serve the built dist/ locally
```

Games are plain static files over HTTP; opening a game's `index.html` via `file://` will not work for games using ES modules.

## Testing

Tests run locally (npm scripts plus the Husky pre-push hook); there is no cloud CI by design. Four tiers, described in detail in [`docs/testing.md`](docs/testing.md). Currently Neon Blocks and Idle Hoops RPG have per-game tests; the other games have none yet.

```sh
npm test                # unit + replay + property + e2e
npm run test:unit       # Vitest unit and replay projects (fast)
npm run test:property   # Vitest + fast-check property tests
npm run test:e2e        # Playwright end-to-end (Chromium)
npm run test:watch      # Vitest watch mode for unit + replay
```

Playwright needs a browser installed once:

```sh
npx playwright install chromium
```

`npm run test:e2e` starts (or reuses) `npm run dev` on port 5173 automatically.

**Pre-push hook.** [Husky](https://typicode.github.io/husky/) is installed by `npm install` (via the `prepare` script) and `.husky/pre-push` runs `npm test` before every `git push`, so the full suite, including e2e, must pass locally to push. Bypass in an emergency with `git push --no-verify`.

## Deploying

See [`docs/deploy.md`](docs/deploy.md). Vercel builds with `npm run build` and serves `dist/`, auto-deploying on every push to `main`; live at <https://games.jdilig.me> (subdomain of [jdilig.me](https://jdilig.me)).

## Adding a game

See [`docs/adding-a-game.md`](docs/adding-a-game.md). Every game also gets its own doc under [`docs/games/`](docs/games/).

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for repo-wide changes. Per-game changelogs live inside each game's doc under `docs/games/<slug>.md`.

## License

- **Code** — [MIT License](LICENSE). Free to use, copy, modify, and showcase (including on your own portfolio). Attribution appreciated but not required.
- **Original creative assets** — [CC BY 4.0](LICENSE-ASSETS). Free to use with attribution.
- **Third-party AI-generated assets** (e.g. PixelLab-generated pixel art) — governed by the respective provider's Terms of Service. See [PixelLab's ToS](https://pixellab.ai/termsofservice). These are **not** relicensed by this repository.
- **Third-party code dependencies** (e.g. Three.js loaded from esm.sh, React) — governed by their own licenses. Three.js is MIT.
- **Fonts** (Geist, Instrument Serif, JetBrains Mono) — loaded via Google Fonts CDN; all SIL Open Font License.

A full public-facing summary is at [`public/credits.html`](public/credits.html) (deployed alongside the site). Every HTML page also carries a `<meta name="copyright">` tag and a footer with license links, so the legal posture is visible to anyone who opens a game, not just to people browsing this repo.

You are welcome to feature this repository, its games, and screenshots/footage of them on portfolio sites, social posts, and writeups. If you reuse a specific asset, double-check whether it's original (CC BY 4.0) or third-party-generated (provider's terms).
