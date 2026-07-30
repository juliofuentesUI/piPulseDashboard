/**
 * Tiny helpers for building pixel-art sprites on a 24x24 grid.
 *
 * Everything is expressed as axis-aligned 1px-tall rows so the result stays on
 * the pixel grid at any scale. Colours are CSS custom properties defined in
 * app.css, which keeps every icon inside the same limited palette.
 */

export const GRID = 24;

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

/**
 * A disc with a second, offset disc subtracted from its right-hand side —
 * i.e. a crescent moon. Doing the set difference here avoids SVG masks, which
 * anti-alias and would soften the pixel edges.
 */
export function crescent(
  cx: number,
  cy: number,
  r: number,
  offsetX: number,
  offsetY: number,
  c: string,
): Rect[] {
  const rects: Rect[] = [];
  for (let y = Math.ceil(cy - r); y < cy + r; y += 1) {
    const outer = spanAt(cx, cy, r, y);
    if (outer === null) continue;

    const inner = spanAt(cx + offsetX, cy + offsetY, r, y);
    const x1 = inner === null ? outer.x1 : Math.min(outer.x1, inner.x0);
    if (x1 > outer.x0) rects.push(rect(outer.x0, y, x1 - outer.x0, 1, c));
  }
  return rects;
}

export interface CloudColors {
  readonly body: string;
  readonly shade: string;
  readonly highlight: string;
}

function cloudSilhouette(ox: number, oy: number, c: string): Rect[] {
  return [
    ...disc(15 + ox, 12 + oy, 5, c),
    ...disc(8 + ox, 14 + oy, 4, c),
    rect(5 + ox, 13 + oy, 15, 5, c),
  ];
}

/**
 * A chunky cloud. The shade is the same silhouette drawn one pixel lower and
 * then covered by the body, which leaves a clean one-pixel rim underneath.
 */
export function cloud(ox: number, oy: number, colors: CloudColors): Rect[] {
  return [
    ...cloudSilhouette(ox, oy + 1, colors.shade),
    ...cloudSilhouette(ox, oy, colors.body),
    rect(11 + ox, 7 + oy, 5, 1, colors.highlight),
    rect(9 + ox, 8 + oy, 2, 1, colors.highlight),
    rect(5 + ox, 11 + oy, 4, 1, colors.highlight),
  ];
}
