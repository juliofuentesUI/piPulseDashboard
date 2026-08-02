/**
 * Helpers for building pixel-art sprites on a 32x32 grid.
 *
 * Everything is expressed as axis-aligned 1px-tall rows so the result stays on
 * the pixel grid at any scale. Colours are the theme's custom properties, which
 * is what lets a sprite drawn once follow every palette.
 */

export const GRID = 32;

/** The theme tokens, spelled once so the sprites below stay readable. */
export const INK = 'var(--c-ink)';
export const SURFACE = 'var(--c-surface)';
export const BLUE = 'var(--c-blue)';
export const SKY = 'var(--c-sky)';
export const WARM = 'var(--c-warm)';
export const HOT = 'var(--c-hot)';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly c: string;
}

export function rect(x: number, y: number, w: number, h: number, c: string): Rect {
  return { x, y, w, h, c };
}

interface Span {
  readonly x0: number;
  readonly x1: number;
}

/** Horizontal extent of a circle at row `y`, or null if the row misses it. */
function spanAt(cx: number, cy: number, r: number, y: number): Span | null {
  const dy = y + 0.5 - cy;
  const squared = r * r - dy * dy;
  if (squared <= 0) return null;

  const half = Math.sqrt(squared);
  const x0 = Math.round(cx - half);
  const x1 = Math.round(cx + half);
  return x1 > x0 ? { x0, x1 } : null;
}

/** A filled pixel circle, one rect per row. */
export function disc(cx: number, cy: number, r: number, c: string): Rect[] {
  const rects: Rect[] = [];
  for (let y = Math.ceil(cy - r); y < cy + r; y += 1) {
    const span = spanAt(cx, cy, r, y);
    if (span !== null) rects.push(rect(span.x0, y, span.x1 - span.x0, 1, c));
  }
  return rects;
}

/** The top half of a disc — the umbrella canopy. */
export function dome(cx: number, cy: number, r: number, c: string): Rect[] {
  return disc(cx, cy, r, c).filter((row) => row.y < cy);
}

/**
 * A disc with a second, offset disc subtracted from its right-hand side —
 * i.e. a crescent moon. Doing the set difference here avoids SVG masks, which
 * anti-alias and would soften the pixel edges.
 *
 * `innerR` slightly larger than `r` deepens the bite, which is what sharpens
 * the horns; equal radii give a fat lens rather than a crescent.
 */
export function crescent(
  cx: number,
  cy: number,
  r: number,
  offsetX: number,
  offsetY: number,
  c: string,
  innerR = r,
): Rect[] {
  const rects: Rect[] = [];
  for (let y = Math.ceil(cy - r); y < cy + r; y += 1) {
    const outer = spanAt(cx, cy, r, y);
    if (outer === null) continue;

    const inner = spanAt(cx + offsetX, cy + offsetY, innerR, y);
    const x1 = inner === null ? outer.x1 : Math.min(outer.x1, inner.x0);
    if (x1 > outer.x0) rects.push(rect(outer.x0, y, x1 - outer.x0, 1, c));
  }
  return rects;
}

// --- Outlining ------------------------------------------------------------
//
// The reference art gives every solid shape a hard one-pixel border. Deriving
// it from the shape rather than drawing it by hand means each sprite is
// described once, and the border colour is a theme token like everything else.

/** Room for the border of a shape that runs right up to the edge of the grid. */
const MARGIN = 2;
const SPAN = GRID + MARGIN * 2;

function rasterise(rects: readonly Rect[]): Uint8Array {
  const cells = new Uint8Array(SPAN * SPAN);
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y += 1) {
      for (let x = r.x; x < r.x + r.w; x += 1) {
        const gx = x + MARGIN;
        const gy = y + MARGIN;
        if (gx < 0 || gy < 0 || gx >= SPAN || gy >= SPAN) continue;
        cells[gy * SPAN + gx] = 1;
      }
    }
  }
  return cells;
}

function filled(cells: Uint8Array, gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= SPAN || gy >= SPAN) return false;
  return cells[gy * SPAN + gx] === 1;
}

/**
 * Every empty cell orthogonally touching a filled one, merged into horizontal
 * runs so a border costs a handful of rects rather than one per pixel.
 */
export function outline(rects: readonly Rect[], color: string): Rect[] {
  const cells = rasterise(rects);
  const border: Rect[] = [];

  for (let gy = 0; gy < SPAN; gy += 1) {
    let start = -1;
    for (let gx = 0; gx <= SPAN; gx += 1) {
      const isBorder =
        gx < SPAN &&
        !filled(cells, gx, gy) &&
        (filled(cells, gx - 1, gy) ||
          filled(cells, gx + 1, gy) ||
          filled(cells, gx, gy - 1) ||
          filled(cells, gx, gy + 1));

      if (isBorder && start === -1) {
        start = gx;
      } else if (!isBorder && start !== -1) {
        border.push(rect(start - MARGIN, gy - MARGIN, gx - start, 1, color));
        start = -1;
      }
    }
  }
  return border;
}

/**
 * A shape with its border behind it. Composite sprites call this once per
 * element, in back-to-front order, so a cloud drawn over a sun carries its own
 * border across the join exactly as it does in the reference art.
 */
export function outlined(rects: readonly Rect[], color = INK): Rect[] {
  return [...outline(rects, color), ...rects];
}

// --- Shared shapes --------------------------------------------------------

export interface CloudColors {
  readonly body: string;
  readonly shade: string;
}

const DEFAULT_CLOUD: CloudColors = { body: SURFACE, shade: SKY };

/**
 * A chunky cloud, 22x15, with two rows of shading along its flat underside.
 * Occupies x5..26, y7..21 at zero offset — horizontally centred on the grid,
 * and narrow enough to leave a sun or moon visible beside it.
 */
export function cloud(ox = 0, oy = 0, colors: CloudColors = DEFAULT_CLOUD): Rect[] {
  return [
    rect(ox + 5, oy + 15, 22, 7, colors.body),
    ...disc(ox + 12, oy + 13, 6, colors.body),
    ...disc(ox + 21, oy + 15, 5, colors.body),
    rect(ox + 5, oy + 20, 22, 2, colors.shade),
  ];
}

/** A 3x4 teardrop with its point at the top. */
export function drop(x: number, y: number, c: string): Rect[] {
  return [rect(x + 1, y, 1, 2, c), rect(x, y + 2, 3, 2, c)];
}

/**
 * A four-pointed star: a cross of arm length `r`, thickened at the centre by
 * four corner pixels. Those are skipped below r=2, where they would meet the
 * arm tips and fill the star in to a solid block.
 */
export function sparkle(cx: number, cy: number, r: number, c: string): Rect[] {
  const arms = [
    rect(cx - r, cy, r * 2 + 1, 1, c),
    rect(cx, cy - r, 1, r * 2 + 1, c),
  ];
  if (r < 2) return arms;

  return [
    ...arms,
    rect(cx - 1, cy - 1, 1, 1, c),
    rect(cx + 1, cy - 1, 1, 1, c),
    rect(cx - 1, cy + 1, 1, 1, c),
    rect(cx + 1, cy + 1, 1, 1, c),
  ];
}

/** A five-pixel plus sign — a snowflake at this scale. */
export function flake(cx: number, cy: number, r: number, c: string): Rect[] {
  return [
    rect(cx - r, cy, r * 2 + 1, 1, c),
    rect(cx, cy - r, 1, r * 2 + 1, c),
    rect(cx - 1, cy - 1, 3, 3, c),
  ];
}
