<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, disc, HOT, outlined, type Rect } from './sprite';

  /*
   * The Raspberry Pi mark, redrawn in theme tokens rather than its real red and
   * green — every other sprite on the panel follows the palette, and a logo that
   * kept its own colours would be the one thing that stops looking right when
   * the screen is switched to Amber CRT or DMG Green.
   */

  /**
   * Two leaves, each a pair of overlapping discs leaning away from the centre.
   * Kept upright and close in: drawn as wide diagonals they stop reading as
   * leaves at 34px and start reading as wings.
   */
  const leaves: Rect[] = [
    ...outlined([...disc(12, 5, 2.8, BLUE), ...disc(13, 9, 2.6, BLUE)]),
    ...outlined([...disc(20, 5, 2.8, BLUE), ...disc(19, 9, 2.6, BLUE)]),
  ];

  /**
   * Six drupelets in a 3-2-1 triangle, back row first. Each carries its own
   * outline, so a berry drawn later cuts a hard edge into the one behind it and
   * the cluster reads as separate berries rather than one blob. A triangle
   * survives being shrunk to a footer glyph where a rounder cluster does not.
   */
  const BERRIES: readonly (readonly [number, number])[] = [
    [9, 17],
    [16, 17],
    [23, 17],
    [12, 23],
    [20, 23],
    [16, 28],
  ];

  const berries: Rect[] = BERRIES.flatMap(([cx, cy]) =>
    outlined(disc(cx, cy, 3.6, HOT)),
  );

  const art: Rect[] = [...leaves, ...berries];
</script>

<IconFrame label="Raspberry Pi">
  <Pixels rects={art} />
</IconFrame>
