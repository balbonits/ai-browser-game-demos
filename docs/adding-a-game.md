# Adding a game

Step-by-step checklist for adding a new game to the repo.

## 1. Pick a slug

Short, lowercase, kebab-case. Examples: `asteroid-sweep`, `pixel-platformer`, `tile-match`.

This is the folder name and the URL segment.

## 2. Create the folder

```
games/<slug>/
  index.html
  main.js          # entry + loop
  style.css        # optional; only if you need game-specific styles
  characters/      # hero / enemy sprites (one category per top-level folder)
  obstacles/       # obstacle / prop sprites
  backdrops/       # parallax layers
  <other>/         # add more categories as needed (enemies, fx, pickups, ui…)
```

**Art categories are top-level inside the game folder**, not under a shared `assets/`. This scales better as categories accumulate. See `docs/conventions.md` for the full rule.

As the game grows past a few hundred lines of JS, split `main.js` into focused modules (`config.js`, `hero.js`, `obstacles.js`, `backdrop.js`, `audio.js`, etc.). See `games/running-man/` for the reference layout.

Recommended `index.html` shell:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Game Title</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <canvas id="game" width="640" height="360"></canvas>
  <script type="module" src="main.js"></script>
</body>
</html>
```

## 3. Generate any art

Use PixelLab MCP (see [`pixellab.md`](pixellab.md)). Save results in the appropriate top-level category folder inside the game — `characters/`, `obstacles/`, `backdrops/`, etc. Do not commit raw job metadata — only the final PNGs.

## 4. Register the game

Edit `games.js` at the repo root and add an entry:

```js
const GAMES = [
  {
    slug: "asteroid-sweep",
    title: "Asteroid Sweep",
    description: "Clear the field. Don't get hit.",
  },
];
```

The landing page picks this up automatically.

## 5. Test

Open the root `index.html` in a browser (or run `python3 -m http.server 0` — it'll pick a free port and print the URL). Click through to your game and play it.

If you're using ES modules (`type="module"`), you **must** serve via HTTP — `file://` will block module loading.

## 6. Commit

One commit per game is fine for small demos. For bigger games, split by milestone (scaffold → art → mechanics → polish).
