// Level data. Coordinates are in canvas-space (960×540), origin top-left,
// y grows downward. Ground sits at y=GROUND_Y.

export const GROUND_Y = 480;
export const SLING_X = 180;
export const SLING_Y = GROUND_Y - 80; // top of slingshot pouch

// Materials. `mat` keys map to render styling + Matter friction/density in main.js.
//   wood: light, bouncy, breaks easily
//   stone: heavy, soaks impacts

function block(x, y, w, h, mat = 'wood') {
  return { x, y, w, h, mat };
}
function pig(x, y, hp = 50) {
  // hp absorbs incoming impact damage (impact speed × constant).
  // 50 = 1 solid hit from a fresh launch, or a rolling block with momentum.
  return { x, y, r: 18, hp };
}

// Level 1 — tutorial. One pig perched on a single horizontal beam.
function level1() {
  const baseY = GROUND_Y - 30;
  return {
    name: 'Easy Pickings',
    par: 1,
    blocks: [
      block(720, baseY, 120, 20, 'wood'),
    ],
    pigs: [
      pig(720, baseY - 35),
    ],
  };
}

// Level 2 — small pyramid with two pigs.
function level2() {
  const baseY = GROUND_Y - 30;
  return {
    name: 'Two-Pig Pyramid',
    par: 2,
    blocks: [
      block(680, baseY - 35, 20, 80, 'wood'),
      block(800, baseY - 35, 20, 80, 'wood'),
      block(740, baseY - 85, 160, 20, 'wood'),
      block(740, baseY - 110, 60, 20, 'stone'),
    ],
    pigs: [
      pig(700, baseY - 25),  // ground-level pig behind the left pillar
      pig(740, baseY - 130), // pig on top of the stone slab
    ],
  };
}

// Level 3 — taller keep, three pigs at staggered heights, including one
// protected by a stone roof.
function level3() {
  const baseY = GROUND_Y - 30;
  return {
    name: 'The Stone Keep',
    par: 3,
    blocks: [
      // Lower fortification
      block(660, baseY - 35, 20, 80, 'wood'),
      block(820, baseY - 35, 20, 80, 'wood'),
      block(740, baseY - 85, 200, 20, 'stone'),
      // Upper tower
      block(700, baseY - 135, 20, 80, 'wood'),
      block(780, baseY - 135, 20, 80, 'wood'),
      block(740, baseY - 185, 120, 20, 'wood'),
      // Cap
      block(740, baseY - 215, 60, 20, 'stone'),
    ],
    pigs: [
      pig(620, baseY - 25),  // exposed ground-level pig
      pig(740, baseY - 130), // mid pig protected by stone roof
      pig(740, baseY - 235), // top pig on the cap
    ],
  };
}

export const LEVELS = [level1(), level2(), level3()];

export const BIRDS_PER_LEVEL = 3;
