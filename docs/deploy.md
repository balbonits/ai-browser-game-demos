# Deploy

This repo is deployed as a static site to **Vercel**.

**Live URL:** <https://ai-browser-game-demos.vercel.app>

The Vercel project (`ai-browser-game-demos`) is connected to the GitHub repo, so every push to `main` auto-deploys to production. There's no build step — Vercel just serves the repo's files as static assets.

## Files involved

- [`vercel.json`](../vercel.json) — clean URLs (no `.html` in the path), long-lived cache on `/games/<slug>/assets/*`, short cache on JS/CSS.
- [`.vercelignore`](../.vercelignore) — excludes local Claude state, the `.git` folder, the `docs/` folder, and root-level `.md` files (everything that's only meaningful inside the repo, not at runtime).
- [`package.json`](../package.json) — holds the `dev` script only. **No dependencies, no build step.** Vercel treats this as a plain static project.

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

3. **Subsequent updates**: just `git push origin main`. Vercel picks it up.

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
npm run dev
```

That runs `python3 -m http.server 0 --bind 127.0.0.1` — it binds a free port and prints the URL. Open it and click through to the games.

## What NOT to commit

- `.vercel/` folder (auto-created by Vercel CLI, git-ignored).
- Any environment secrets (we have none right now, keep it that way).

## Future tweaks to consider

- **Meta tags / OG images** — for social sharing when a specific game URL is linked.
- **`robots.txt` / `sitemap.xml`** — once there are multiple games and it's publicly launched.
- **Analytics** — Vercel Web Analytics is one line in `vercel.json` or a `<script>` include; add only if you actually want it.
