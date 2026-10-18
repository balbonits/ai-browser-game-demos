# PixelLab MCP

Reference for generating pixel art in this repo using the PixelLab MCP server.

## Available tools

**Characters**
- `create_character` — generate a character with directional views.
- `animate_character` — produce an animation for an existing character.
- `get_character`, `list_characters`, `delete_character`.

**Tilesets**
- `create_topdown_tileset` — top-down game tiles.
- `create_sidescroller_tileset` — platformer tiles.
- `create_tiles_pro` — higher-fidelity tile generation.
- `create_isometric_tile` — single isometric tile.
- `create_map_object` — a standalone map object / prop.
- Each has matching `get_*`, `list_*`, `delete_*` tools.

## How jobs work

All generation calls are **non-blocking** and return a **job ID**. You must:

1. Call the `create_*` or `animate_*` tool → receive `job_id`.
2. Poll with the matching `get_*` tool until the job reports complete.
3. Download the resulting image(s) from the URL(s) the job returns.
4. Save the file(s) under `public/games/<slug>/<category>/` (e.g. `characters/`, `obstacles/`, `backdrops/`) with descriptive names.

Do **not** commit raw API responses or temporary job data — only the final image files.

## Conventions

- **Naming.** `hero-idle.png`, `enemy-slime-walk.png`, `tiles-forest.png`. Kebab-case, descriptive.
- **Location.** Always under a top-level category folder inside the consuming game (`public/games/<slug>/characters/`, etc.). Never in the repo root.
- **Reuse.** If two games share art, copy it into each game's own category folders — keep games self-contained. Only extract to a shared folder if it becomes genuinely painful to maintain duplicates.
- **Attribution.** PixelLab-generated art is governed by [PixelLab's TOS](https://pixellab.ai/termsofservice). The repo's `LICENSE-ASSETS` does **not** re-license PixelLab output.

## Credits & cost

PixelLab requires an active subscription (with credit fallback). Before running a large batch of generations, confirm scope with the human — you're spending their credits.

## Troubleshooting

- **Job stuck pending** — some jobs take minutes. Poll at reasonable intervals (not every second).
- **Bad output** — re-run with a tighter prompt; don't try to edit pixel art by hand.
- **MCP not available** — verify the PixelLab MCP server is configured for this project; the tools appear under `mcp__pixellab__*`.
