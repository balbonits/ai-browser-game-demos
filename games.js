// Add an entry here for each game. Each game lives in games/<slug>/index.html.
const GAMES = [
  {
    slug: "running-man",
    title: "Running Man",
    description: "Side-scrolling auto-runner. Jump to survive. Pixel art by PixelLab.",
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
