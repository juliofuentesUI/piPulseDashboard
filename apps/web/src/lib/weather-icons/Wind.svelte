<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, rect, SKY, type Rect } from './sprite';

  /**
   * Three strokes: the outer two curl back on themselves at the right-hand end,
   * the middle one runs straight through. The gap between a stroke and its own
   * return is what makes the curl read as a curl rather than a step. Left
   * unoutlined — these are moving air, not solid objects.
   */
  const art: Rect[] = [
    rect(4, 8, 18, 3, SKY),
    rect(19, 3, 3, 8, SKY),
    rect(14, 3, 8, 3, SKY),

    rect(2, 15, 25, 3, BLUE),

    rect(4, 22, 18, 3, SKY),
    rect(19, 22, 3, 8, SKY),
    rect(14, 27, 8, 3, SKY),
  ];
</script>

<IconFrame label="Wind">
  <Pixels rects={art} />
</IconFrame>
