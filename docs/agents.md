# Subagents

This repo defines two project-level Claude Code subagents in `.claude/agents/`:

- [`artist`](../.claude/agents/artist.md) — pixel art & asset generation (PixelLab MCP).
- [`dev`](../.claude/agents/dev.md) — game code (vanilla JS, Phaser, PixiJS).

The goal is a clean separation: **what does the game look like** vs. **how does the game work**. Keeping these in separate personas prevents one agent from drifting into the other's lane, keeps tool access scoped, and makes conversations easier to follow.

## When to use `artist`

Delegate to `artist` when the task is about:

- Creating a new character, tileset, or map object via PixelLab.
- Generating or regenerating an animation (run, jump, death, idle, etc.).
- Downloading a PixelLab character ZIP and extracting sprites into a game's `assets/` folder.
- Renaming / organizing existing asset files.
- Questions about which PixelLab template to use.
- Licensing / attribution questions about generated art.

Examples of prompts:
- "Generate an 8-frame run animation for character `<uuid>`, east direction only."
- "Download the character ZIP and put the running frames under `games/running-man/assets/`."
- "Make a top-down grass-and-stone tileset for `games/maze/`."

The `artist` agent has access to all PixelLab MCP tools, `Read`, `Write`, `Bash` (for curl/unzip), and `WebFetch`. It does **not** have `Edit` — it's meant to drop new files, not rewrite game code.

## When to use `dev`

Delegate to `dev` when the task is about:

- Writing or editing HTML, CSS, or JavaScript in `games/<slug>/`.
- Implementing game loops, input, collision, physics, UI, scoring.
- Wiring a sprite sheet (already produced by `artist`) into the canvas.
- Registering a new game in `games.js`.
- Modifying shared root files (`index.html`, `games.js`, `styles.css`) — though structural changes still need user approval.
- Running a local dev server (`python3 -m http.server`) to test.

Examples of prompts:
- "Implement a one-button jump mechanic with gravity and variable jump height."
- "Wire `hero-run.png` (80×80, 8 frames horizontal) into the runner game at 12 fps."
- "Add a score counter that increments per obstacle cleared."

The `dev` agent has `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, and `WebFetch`. It does **not** have PixelLab MCP tools — it must delegate art generation back through the orchestrator.

## How the two collaborate

A typical new-game flow:

1. **User → orchestrator:** "Make a new game: side-scrolling runner, using Human Base character."
2. **Orchestrator → `artist`:** "Generate run/jump/death animations for character `<uuid>`, east only. Report dimensions and frame counts when done."
3. **Orchestrator → `dev`:** "Build a vanilla-JS runner in `games/running-man/` using these sprites: `hero-run.png` 80×80 × 8 frames, `hero-jump.png` …, etc."
4. **Orchestrator → `dev`:** "Register the game in `games.js`."
5. **Orchestrator:** tests by opening the landing page, reports result to the user.

The orchestrator is responsible for:
- Splitting a user request into art vs. code tasks.
- Passing the sprite dimensions/layout from `artist`'s report into `dev`'s prompt.
- Not doing either agent's job inline — if the orchestrator is about to call PixelLab MCP directly or write game code directly, stop and delegate instead.

## Cost and tool access notes

- `artist` can spend PixelLab credits. Template animations are cheap (1/dir). Custom animations are expensive (20–40/dir) and require user confirmation on a second call with `confirm_cost=true`.
- `dev` has no paid-API access and no way to generate art. That's by design.

## Adding or editing personas

Agent files are in `.claude/agents/*.md` with YAML frontmatter (`name`, `description`, `tools`, `model`). Edit them when the workflow changes, when a new category of task emerges, or when tool access needs tightening. If a new persona is needed (e.g. `sound-designer`, `level-designer`), add it as a separate file and document it here.
