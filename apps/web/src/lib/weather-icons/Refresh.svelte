<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, rect, ring, without, type Rect } from './sprite';

  /**
   * Two arrows chasing each other round a circle.
   *
   * The ring is broken at three and nine o'clock and a head closes each break,
   * pointing the way round — down on the right, up on the left. Breaking it on
   * the horizontal is what makes the heads plain vertical triangles, which is
   * the only kind that still reads at the 34px this sits at in the footer.
   */
  const band: Rect[] = without(
    without(ring(16, 16, 12, 4, BLUE), { x0: 18, x1: 32, y0: 9, y1: 21 }),
    { x0: 0, x1: 14, y0: 12, y1: 24 },
  );

  /** Closes the break at three o'clock, pointing down: clockwise from the top. */
  const headRight: Rect[] = [
    rect(20, 9, 11, 2, BLUE),
    rect(21, 11, 9, 2, BLUE),
    rect(22, 13, 7, 2, BLUE),
    rect(23, 15, 5, 2, BLUE),
    rect(24, 17, 3, 2, BLUE),
  ];

  /** The same head turned half a circle, closing the break at nine o'clock. */
  const headLeft: Rect[] = [
    rect(5, 14, 3, 2, BLUE),
    rect(4, 16, 5, 2, BLUE),
    rect(3, 18, 7, 2, BLUE),
    rect(2, 20, 9, 2, BLUE),
    rect(1, 22, 11, 2, BLUE),
  ];

  const art: Rect[] = [...band, ...headRight, ...headLeft];
</script>

<IconFrame label="Refresh">
  <Pixels rects={art} />
</IconFrame>
