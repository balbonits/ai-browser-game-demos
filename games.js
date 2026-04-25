// Registry of games shown on the landing page.
//
// Each game gets:
//   slug         — folder under games/<slug>/
//   title        — display name
//   year         — when it was started
//   kind         — short genre label, shown in the card meta line
//   description  — one-sentence card body, sentence case, ends in a period
//   tags         — short tech tags shown as mono chips
//
// Add an entry here for each game.

const GAMES = [
  {
    slug: "running-man",
    title: "Running Man",
    year: "2026",
    kind: "Side-scroller",
    description:
      "A side-scrolling auto-runner. Jump to clear obstacles, beat your distance.",
    tags: ["Vanilla JS", "Canvas2D", "PixelLab", "Web Audio"],
  },
  {
    slug: "neon-tower-defense",
    title: "Neon Tower Defense",
    year: "2026",
    kind: "Tower defense",
    description:
      "Shape-based tower defense, neon CRT aesthetic. Every visual is geometry, every sound is synthesized.",
    tags: ["Vanilla JS", "Canvas2D", "Web Audio"],
  },
  {
    slug: "block-fps",
    title: "Block Arena",
    year: "2026",
    kind: "First-person shooter",
    description:
      "First-person shooter with a polygonal gun and 3D block enemies.",
    tags: ["Three.js", "WebGL", "Web Audio"],
  },
  {
    slug: "maze-runner",
    title: "Maze Runner",
    year: "2026",
    kind: "Procedural maze",
    description:
      "Procedurally generated mazes seeded by a string or number. Race the clock, collect gems.",
    tags: ["Vanilla JS", "Canvas2D", "Procedural", "Web Audio"],
  },
];

// ---- Render the game grid ----

const list = document.getElementById("game-list");
if (list) {
  if (GAMES.length === 0) {
    list.innerHTML =
      '<li class="empty">No games yet — add the first one in <code>games/</code>.</li>';
  } else {
    list.innerHTML = "";
    for (const game of GAMES) {
      const li = document.createElement("li");
      li.className = "card game-card";
      li.tabIndex = 0;
      li.setAttribute("role", "link");

      const meta = document.createElement("div");
      meta.className = "game-card-meta";
      meta.innerHTML = `<span class="meta-dot" aria-hidden="true"></span>${escapeHtml(
        game.year,
      )} · ${escapeHtml(game.kind)}`;

      const arrow = document.createElement("span");
      arrow.className = "game-card-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>';

      const top = document.createElement("div");
      top.className = "game-card-top";
      top.append(meta, arrow);

      const title = document.createElement("h3");
      title.className = "game-card-title";
      const a = document.createElement("a");
      a.href = `games/${game.slug}/index.html`;
      a.textContent = game.title;
      title.append(a);

      const desc = document.createElement("p");
      desc.className = "game-card-desc";
      desc.textContent = game.description;

      const tags = document.createElement("div");
      tags.className = "game-card-tags";
      for (const t of game.tags) {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.textContent = t;
        tags.append(chip);
      }

      li.append(top, title, desc, tags);

      // Whole-card click navigates to the game (anchor still focusable for a11y).
      li.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        a.click();
      });
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          a.click();
        }
      });

      list.append(li);
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
