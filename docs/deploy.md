# Deploy

This repo deploys as a static site to **Vercel**, intended as a subsite of `jdilig.me`.

## Files involved

- [`vercel.json`](../vercel.json) — clean URLs (no `.html` in the path), long-lived cache on `/games/<slug>/assets/*`, short cache on JS/CSS.
- [`package.json`](../package.json) — holds the `dev` script only. **No dependencies, no build step.** Vercel treats this as a plain static project.

## Deploying the first time

1. Log in to Vercel (https://vercel.com/dashboard) with the same account that hosts `jdilig.me`.
2. Click **Add New → Project** and import this repository (connect via GitHub if it's not already).
3. When Vercel asks for framework preset, pick **Other** (or let it auto-detect — with no build script it'll just serve files).
4. Leave **Build Command** empty, **Output Directory** empty (defaults to repo root), **Install Command** empty.
5. Deploy.

After the first deploy, Vercel will give you a `<project>.vercel.app` URL.

## Attaching it as a subsite of jdilig.me

Two options, pick one:

### Option A — subdomain (`games.jdilig.me`) **recommended**

1. In the new Vercel project's **Settings → Domains**, add `games.jdilig.me`.
2. Vercel will show you the DNS record to add (usually a `CNAME` pointing at `cname.vercel-dns.com`).
3. Add that record wherever `jdilig.me`'s DNS lives.
4. Wait a minute, verify, done.

Pros: clean separation, independent project in Vercel, can deploy independently of the main portfolio.

### Option B — subpath (`jdilig.me/games`)

This requires editing the main `jdilig.me` project (not this repo). Add a rewrite in that project's `vercel.json` pointing `/games/:path*` to this project. More complicated; only worth it if you really want everything under one origin.

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
