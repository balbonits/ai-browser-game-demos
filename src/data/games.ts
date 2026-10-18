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
  /** Short alt text for the card thumbnail (<=125 chars, starts with the title). */
  thumbAlt: string;
  /** Card thumbnail, 960x540 (16:9), at public/games/<slug>/thumb[-suffix].webp. */
  thumb: string;
  /** Featured game: shown first as a full-width hero card. */
  featured?: boolean;
  /** Optional wide (21:9, 1280x549) crop used by the hero card on wide screens. */
  thumbWide?: string;
  /**
   * Span both grid columns on desktop (using `thumbWide`) without the "Featured"
   * hero treatment. Use it to keep an odd last card from sitting alone in a row.
   */
  wide?: boolean;
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
    thumb: '/games/running-man/thumb.webp',
    thumbAlt:
      'Running Man: a pixel runner on a dusk road in front of pine forest, mountains and clouds.',
  },
  {
    slug: 'neon-tower-defense',
    title: 'Neon Tower Defense',
    year: '2026',
    kind: 'Tower defense',
    description:
      'Shape-based tower defense, neon CRT aesthetic. Every visual is geometry, every sound is synthesized.',
    tags: ['Vanilla JS', 'Canvas2D', 'Web Audio'],
    thumb: '/games/neon-tower-defense/thumb.webp',
    thumbAlt:
      'Neon Tower Defense: red enemies advance along a glowing cyan path above the tower build bar.',
    thumbWide: '/games/neon-tower-defense/thumb-wide.webp',
    featured: true,
  },
  {
    slug: 'block-fps',
    title: 'Block Arena',
    year: '2026',
    kind: 'First-person shooter',
    description:
      'First-person shooter with a polygonal gun and 3D block enemies.',
    tags: ['Three.js', 'WebGL', 'Web Audio'],
    thumb: '/games/block-fps/thumb.webp',
    thumbAlt:
      'Block Arena: first-person view of a dark wireframe arena with red block enemies and a cyan gun.',
  },
  {
    slug: 'maze-runner',
    title: 'Maze Runner',
    year: '2026',
    kind: 'Procedural maze',
    description:
      'Procedurally generated mazes seeded by a string or number. Race the clock, collect gems.',
    tags: ['Vanilla JS', 'Canvas2D', 'Procedural', 'Web Audio'],
    thumb: '/games/maze-runner/thumb.webp',
    thumbAlt:
      'Maze Runner: a glowing maze with yellow gems, plus the seed and timer along the top.',
  },
  {
    slug: 'neon-blocks',
    title: 'Neon Blocks',
    year: '2026',
    kind: 'Falling-block puzzle',
    description:
      'Modern falling-block puzzle with SRS rotation, T-spins, hold, ghost piece, and layered synthesized music that grows with your level.',
    tags: ['Vanilla JS', 'Canvas2D', 'Web Audio'],
    thumb: '/games/neon-blocks/thumb.webp',
    thumbAlt:
      'Neon Blocks: a neon falling-block board half full, with hold and next-piece panels.',
  },
  {
    slug: 'idle-hoops-rpg',
    title: 'Idle Hoops RPG',
    year: '2026',
    kind: 'Idle / RPG',
    description:
      'Idle basketball career sim with single-string hashed save and offline catch-up.',
    tags: ['Vanilla JS', 'DOM UI', 'localStorage', 'Idle'],
    // thumb-v2 / thumb-wide-v2: re-shot from the fixed layout (new names bust the immutable cache).
    thumb: '/games/idle-hoops-rpg/thumb-v2.webp',
    thumbAlt:
      'Idle Hoops RPG: team dashboard showing the record, money and a roster with orange stat bars.',
    thumbWide: '/games/idle-hoops-rpg/thumb-wide-v2.webp',
    wide: true,
  },
];
