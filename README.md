# AI Browser Game Demos

**Live site:** <https://games.jdilig.me> &nbsp;·&nbsp; mirror: <https://ai-browser-game-demos.vercel.app>

A personal collection of browser games and game demos, **built entirely by AI** under my direction.

The goal of this repo is to explore what modern AI tooling can produce end-to-end — code, art, audio, design — with me acting as the director rather than the implementer.

## Games

| Slug | Genre | Stack |
| --- | --- | --- |
| [`running-man`](games/running-man/) | Side-scrolling auto-runner | Vanilla JS · Canvas2D · PixelLab · Web Audio |
| [`neon-tower-defense`](games/neon-tower-defense/) | Shape-based tower defense | Vanilla JS · Canvas2D · Web Audio |
| [`block-fps`](games/block-fps/) | First-person shooter | Three.js (CDN) · WebGL · Web Audio |
| [`maze-runner`](games/maze-runner/) | Procedurally generated maze | Vanilla JS · Canvas2D · Web Audio |

Per-game notes (design, controls, asset inventory, changelog) live in [`docs/games/`](docs/games/).

## Tools used

- **[Claude Code](https://claude.com/claude-code)** — writes and edits all game code (HTML / CSS / JS).
- **[PixelLab.ai](https://pixellab.ai)** — generates pixel-art characters, animations, and tilesets via MCP.
- **[Three.js](https://threejs.org/)** — pulled in via [esm.sh](https://esm.sh) CDN for the 3D game (`block-fps`). No build step.
- **Web Audio API** — every SFX and music track in this repo is synthesized at runtime. No audio files are committed.

No hand-written game code. No hand-drawn art. If a human wrote it, it's an exception and it's noted in that game's folder.

## Structure

```
/                  # landing page that lists all games
index.html         # static landing page
games.js           # registry of games shown on the landing page
styles.css         # shared landing-page styles
games/<slug>/      # each game is fully self-contained here
docs/              # project documentation (workflows, conventions, notes)
CLAUDE.md          # guidance for Claude Code specifically
AGENTS.md          # guidance for any AI coding agent
```

Each game lives in its own folder under `games/<slug>/` with its own `index.html` and assets. Games are pure static HTML/CSS/JS — no build step, no server.

## Running locally

```sh
npm run dev
```

That binds a random free port (so it never collides with another project's dev server) and prints the URL. No install step — the script is a thin wrapper around `python3 -m http.server`.

You can also just open `index.html` directly in a browser for the landing page, but individual games that use ES modules need to be served over HTTP (`file://` blocks module loading).

## Deploying

See [`docs/deploy.md`](docs/deploy.md). Auto-deploys to Vercel on every push to `main`; live at <https://games.jdilig.me> (subdomain of [jdilig.me](https://jdilig.me)).

## Adding a game

See [`docs/adding-a-game.md`](docs/adding-a-game.md). Every game also gets its own doc under [`docs/games/`](docs/games/).

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for repo-wide changes. Per-game changelogs live inside each game's doc under `docs/games/<slug>.md`.

## License

- **Code** — [MIT License](LICENSE). Free to use, copy, modify, and showcase (including on your own portfolio). Attribution appreciated but not required.
- **Original creative assets** — [CC BY 4.0](LICENSE-ASSETS). Free to use with attribution.
- **Third-party AI-generated assets** (e.g. PixelLab-generated pixel art) — governed by the respective provider's Terms of Service. See [PixelLab's ToS](https://pixellab.ai/termsofservice). These are **not** relicensed by this repository.
- **Third-party code dependencies** (e.g. Three.js loaded via CDN) — governed by their own licenses. Three.js is MIT.
- **Fonts** (Geist, Instrument Serif, JetBrains Mono) — loaded via Google Fonts CDN; all SIL Open Font License.

A full public-facing summary is at [`credits.html`](credits.html) (deployed alongside the site). Every HTML page also carries a `<meta name="copyright">` tag and a footer with license links, so the legal posture is visible to anyone who opens a game, not just to people browsing this repo.

You are welcome to feature this repository, its games, and screenshots/footage of them on portfolio sites, social posts, and writeups. If you reuse a specific asset, double-check whether it's original (CC BY 4.0) or third-party-generated (provider's terms).
