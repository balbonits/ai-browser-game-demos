// Registry of games shown on the landing page.
//
// Each game is a self-contained static folder under public/games/<slug>/.
// The fields here populate the home-page card grid; the live links resolve
// to /games/<slug>/index.html (Vite serves public/ at the site root).

export type Game = {
  slug: string;
  title: string;
  year: string;
  kind: string;
  description: string;
  tags: string[];
};

export const GAMES: Game[] = [
  {
    slug: 'running-man',
    title: 'Running Man',
    year: '2026',
    kind: 'Side-scroller',
    description:
      'A side-scrolling auto-runner. Jump to clear obstacles, beat your distance.',
    tags: ['Vanilla JS', 'Canvas2D', 'PixelLab', 'Web Audio'],
  },
  {
    slug: 'neon-tower-defense',
    title: 'Neon Tower Defense',
    year: '2026',
    kind: 'Tower defense',
    description:
      'Shape-based tower defense, neon CRT aesthetic. Every visual is geometry, every sound is synthesized.',
    tags: ['Vanilla JS', 'Canvas2D', 'Web Audio'],
  },
  {
    slug: 'block-fps',
    title: 'Block Arena',
    year: '2026',
    kind: 'First-person shooter',
    description:
      'First-person shooter with a polygonal gun and 3D block enemies.',
    tags: ['Three.js', 'WebGL', 'Web Audio'],
  },
  {
    slug: 'maze-runner',
    title: 'Maze Runner',
    year: '2026',
    kind: 'Procedural maze',
    description:
      'Procedurally generated mazes seeded by a string or number. Race the clock, collect gems.',
    tags: ['Vanilla JS', 'Canvas2D', 'Procedural', 'Web Audio'],
  },
  {
    slug: 'neon-blocks',
    title: 'Neon Blocks',
    year: '2026',
    kind: 'Falling-block puzzle',
    description:
      'Full-featured Tetris-style puzzle with SRS rotation, T-spins, hold, ghost piece, and layered synthesized music that grows with your level.',
    tags: ['Vanilla JS', 'Canvas2D', 'Web Audio'],
  },
];
