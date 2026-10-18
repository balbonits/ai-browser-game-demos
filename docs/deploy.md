# Deploy

This repo is deployed to **Vercel** as a Vite build: the React landing shell is compiled to `dist/`, and `public/` (including every game under `public/games/<slug>/`) is copied into it verbatim.

**Primary URL:** <https://games.jdilig.me> &nbsp;·&nbsp; **Mirror:** <https://ai-browser-game-demos.vercel.app>

The Vercel project (`ai-browser-game-demos`) is connected to the GitHub repo, so every push to `main` auto-deploys to production. Vercel runs `npm run build` (`tsc -b && vite build`) and serves `dist/`. The games themselves have no build step. The custom domain `games.jdilig.me` is attached as a Vercel domain via a `CNAME` at the registrar pointing to `cname.vercel-dns.com`.

## Files involved

- [`vercel.json`](../vercel.json) — framework `vite`, build command `npm run build`, output directory `dist`, clean URLs, `trailingSlash: true`, long-lived cache on game images (`/games/**/*.png|jpg|…`), short cache on JS/CSS.
- [`.vercelignore`](../.vercelignore) — excludes local Claude state, the `.git` folder, the `docs/` folder, and root-level `.md` files (everything that's only meaningful inside the repo, not at runtime).
- [`package.json`](../package.json) — holds the `dev`, `build`, `preview`, and test scripts plus React/Vite/Tailwind/Vitest/Playwright dependencies. Games never import from it.

## How it was set up

1. **Initial deploy** (one-time, already done):
   ```sh
   vercel deploy --prod --yes
   ```
   That created the project under `john-diligs-projects` scope and produced the `*.vercel.app` URL above.

2. **GitHub integration** (one-time, already done):
   ```sh
   vercel git connect
   ```
   That linked the GitHub repo so subsequent pushes auto-deploy.

3. **Subsequent updates**: just `git push origin main`. Vercel picks it up and runs the build.

## Manual redeploy

If you ever need to deploy outside of git:

```sh
vercel deploy --prod
```

For a preview (non-production) deploy:

```sh
vercel deploy
```

## Attaching it as a subsite of jdilig.me (optional)

Two options, pick one:

### Option A — subdomain (`games.jdilig.me`) **recommended**

1. In the Vercel project's **Settings → Domains**, add `games.jdilig.me`. Or via CLI:
   ```sh
   vercel domains add games.jdilig.me ai-browser-game-demos
   ```
2. Vercel will show you the DNS record to add (usually a `CNAME` pointing at `cname.vercel-dns.com`).
3. Add that record at the registrar where `jdilig.me`'s DNS lives.
4. Wait a minute, verify, done.

Pros: clean separation, independent project in Vercel, can deploy independently of the main portfolio.

### Option B — subpath (`jdilig.me/games`)

This requires editing the main `jdilig.me` project (`jdilig-me-v3`). Add a rewrite in that project's `vercel.json` pointing `/games/:path*` to this project. More complicated and couples the deploys; only worth it if you really want everything under one origin.

## Local testing before deploy

```sh
npm install   # first time only
npm run dev
```

That runs Vite at <http://localhost:5173>. Open it and click through to the games. To check the production build, run `npm run build && npm run preview`.

## What NOT to commit

- `.vercel/` folder (auto-created by Vercel CLI, git-ignored).
- Any environment secrets (we have none right now, keep it that way).

## Future tweaks to consider

- **Meta tags / OG images** — for social sharing when a specific game URL is linked.
- **`robots.txt` / `sitemap.xml`** — once there are multiple games and it's publicly launched.
- **Analytics** — Vercel Web Analytics is one line in `vercel.json` or a `<script>` include; add only if you actually want it.
