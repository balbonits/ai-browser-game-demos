// Parallax backdrop rendering.
//
// Three layers:
//   deepest — far mountains (larger silhouette), 0.05× world speed
//   mid     — pine forest (closer mid-layer), 0.15× world speed
//   sky     — drifting clouds, 0.30× world speed
//
// Images are optional — if they fail to load, the layer simply doesn't draw.

import { W, H, GROUND_Y } from './config.js';
import { loadImage } from './assets.js';

let farMountains = null;
let forest = null;
// Three distinct cloud sprites, mixed into the cloud banner for variety —
// scaling a single sprite wasn't enough to read as different clouds.
let cloudPuffy = null;   // cloud.png       — original mid puffy
let cloudLarge = null;   // cloud-large.png — big cumulus
let cloudSmall = null;   // cloud-small.png — tiny round puff

let scroll = 0;

export async function loadBackdropAssets() {
  // Individual catches so a missing file for one layer doesn't kill the others.
  [farMountains, forest, cloudPuffy, cloudLarge, cloudSmall] = await Promise.all([
    loadImage('backdrops/far-mountains.png').catch(() => null),
    loadImage('backdrops/forest.png').catch(() => null),
    loadImage('backdrops/cloud.png').catch(() => null),
    loadImage('backdrops/cloud-large.png').catch(() => null),
    loadImage('backdrops/cloud-small.png').catch(() => null),
  ]);
}

export function resetBackdrop() {
  scroll = 0;
}

export function updateBackdrop(dt, speed) {
  scroll += speed * dt;
}

// Tile an image horizontally with parallax scroll. If `targetH` is given,
// the image is rendered scaled to that height (preserving aspect ratio).
// We scale at draw time rather than at art-generation time so we can resize
// freely without re-running PixelLab.
function tileLayer(ctx, img, y, mult, periodExtra = 0, targetH = null) {
  const dh = targetH ?? img.height;
  const dw = targetH ? Math.round(img.width * (dh / img.height)) : img.width;
  const period = dw + periodExtra;
  const off = ((scroll * mult) % period + period) % period;
  for (let x = -off; x < W + period; x += period) {
    if (targetH) {
      ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
    } else {
      ctx.drawImage(img, Math.round(x), Math.round(y));
    }
  }
}

// Anchor a tiled layer so the BOTTOM OF THE VISIBLE ART (not the bottom of
// the transparent canvas) sits at `groundY`. `padBottomSrc` is the count of
// fully-transparent pixels below the art in the source PNG. The container
// is allowed to overflow past groundY — the road is drawn on top of us.
//
// `overlapFrac` is the fraction of the destination width that successive
// repeats overlap by (0 = butt joint, 0.3 = each repeat starts 30% before
// the previous one ends). Use overlap to hide tile seams when the source
// art runs edge-to-edge.
function tileLayerAnchored(ctx, img, groundY, mult, targetH, padBottomSrc, overlapFrac = 0) {
  const scale = targetH / img.height;
  const padBottomDst = Math.round(padBottomSrc * scale);
  const y = groundY - targetH + padBottomDst;
  const dw = Math.round(img.width * scale);
  const periodExtra = -Math.round(dw * overlapFrac);
  tileLayer(ctx, img, y, mult, periodExtra, targetH);
}

// Cloud "banner" pattern: a long repeating strip with multiple clouds
// clustered into bunches with gaps between, then tiled across the sky.
// Each entry picks one of three distinct sprites + an optional horizontal
// flip + a scale, so the eye doesn't catch the repeat. Heights are mild
// — no cloud sits where the mountains will be.
//
// The list is intentionally dense and grouped: clusters of 3-5 clouds
// overlap to read as bunches, with sky gaps between clusters.
//   kind: 'puffy' | 'large' | 'small'
const CLOUD_BANNER = [
  // Cluster A — big bunch on the left
  { kind: 'large', dx:   0, dy:  6, scale: 1.0 },
  { kind: 'puffy', dx:  55, dy: 22, scale: 1.0 },
  { kind: 'small', dx:  90, dy: 10, scale: 1.1, flip: true },
  { kind: 'puffy', dx: 110, dy: 30, scale: 0.85, flip: true },
  { kind: 'large', dx: 150, dy: 14, scale: 0.7 },

  // small gap

  // Cluster B — mid bunch
  { kind: 'small', dx: 240, dy: 28, scale: 1.3 },
  { kind: 'puffy', dx: 270, dy: 12, scale: 0.95 },
  { kind: 'large', dx: 320, dy: 22, scale: 0.85, flip: true },
  { kind: 'small', dx: 380, dy:  8, scale: 1.0, flip: true },
  { kind: 'puffy', dx: 405, dy: 26, scale: 1.1 },

  // small gap

  // Cluster C — tall bunch on the right
  { kind: 'large', dx: 500, dy:  4, scale: 1.0 },
  { kind: 'small', dx: 555, dy: 24, scale: 1.2, flip: true },
  { kind: 'puffy', dx: 590, dy: 14, scale: 0.9 },
  { kind: 'puffy', dx: 640, dy: 30, scale: 1.0 },
  { kind: 'large', dx: 690, dy: 18, scale: 0.75, flip: true },

  // Cluster D — small trailing puffs to close the loop
  { kind: 'small', dx: 780, dy: 26, scale: 1.0 },
  { kind: 'puffy', dx: 820, dy: 12, scale: 0.85, flip: true },
  { kind: 'small', dx: 870, dy: 32, scale: 1.1 },
];
const CLOUD_BANNER_W = 960;

function getCloud(kind) {
  if (kind === 'large') return cloudLarge;
  if (kind === 'small') return cloudSmall;
  return cloudPuffy;
}

// Vertical offset applied to every cloud entry — shifts the whole sky band
// down without touching each entry's dy.
const CLOUD_BAND_OFFSET_Y = 20;

function drawCloudBanner(ctx, mult = 0.3) {
  // If none of the cloud sprites loaded, bail.
  if (!cloudPuffy && !cloudLarge && !cloudSmall) return;
  const period = CLOUD_BANNER_W;
  const off = ((scroll * mult) % period + period) % period;
  for (let bx = -off; bx < W + period; bx += period) {
    for (const c of CLOUD_BANNER) {
      const img = getCloud(c.kind);
      if (!img) continue;
      const dw = Math.round(img.width * c.scale);
      const dh = Math.round(img.height * c.scale);
      const x = Math.round(bx + c.dx);
      const y = Math.round(c.dy + CLOUD_BAND_OFFSET_Y);
      if (c.flip) {
        // Horizontal flip via canvas transform — extra silhouette variety
        // without doubling the sprite library.
        ctx.save();
        ctx.translate(x + dw, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y, dw, dh);
      }
    }
  }
}

export function drawSkyGradient(ctx) {
  // A subtle vertical gradient baked into JS (instead of the canvas CSS
  // background) so the splash screen renders correctly when the canvas is
  // captured / screenshotted.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1e2836');
  g.addColorStop(0.7, '#3e4a5c');
  g.addColorStop(1, '#4a5468');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawBackdropFar(ctx) {
  // Cloud banner — a wide strip of clustered clouds drifting across the
  // sky. Drawn first so mountains render on top of it.
  drawCloudBanner(ctx, 0.3);

  // Far-back deepest layer. The PNG has 10 px of transparent padding below
  // its art (measured from alpha channel), so we anchor by visible art.
  // 30% overlap blends each repeat into the next so the silhouette reads
  // as one continuous range instead of repeating peaks.
  if (farMountains) {
    tileLayerAnchored(ctx, farMountains, GROUND_Y + 31, 0.05, 120, 10, 0.3);
  }

  // Pine forest mid-layer. PNG has 12 px of bottom padding (measured from
  // alpha). 30% overlap so neighboring tiles' trees blend together into
  // one continuous wall of forest with no visible seams.
  if (forest) {
    tileLayerAnchored(ctx, forest, GROUND_Y + 7.5, 0.15, 80, 12, 0.3);
  }
}

