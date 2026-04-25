// Add an entry here for each game. Each game lives in games/<slug>/index.html.
const GAMES = [
  {
    slug: "running-man",
    title: "Running Man",
    description: "Side-scrolling auto-runner. Jump to survive. Pixel art by PixelLab.",
  },
  {
    slug: "neon-tower-defense",
    title: "Neon Tower Defense",
    description: "Shape-based tower defense with neon aesthetic. All visuals and audio synthesized in code — no sprites, no audio files.",
  },
  {
    slug: "block-fps",
    title: "Block Arena",
    description: "First-person shooter with a polygonal gun and 3D block enemies. Three.js, no build step.",
  },
];

const list = document.getElementById("game-list");
if (GAMES.length > 0) {
  list.innerHTML = "";
  for (const game of GAMES) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `games/${game.slug}/index.html`;
    a.textContent = game.title;
    const p = document.createElement("p");
    p.className = "description";
    p.textContent = game.description;
    li.append(a, p);
    list.append(li);
  }
}
