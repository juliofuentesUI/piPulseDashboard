<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, dome, drop, INK, rect, type Rect } from './sprite';

  /** Canopy, then the shaft, then the hook curling left and back up. */
  const body: Rect[] = [
    ...dome(16, 15, 12, INK),
    rect(15, 14, 2, 10, INK),
    rect(13, 22, 2, 2, INK),
    rect(11, 19, 2, 4, INK),
  ];

  const drops: Rect[] = [
    ...drop(4, 21, BLUE),
    ...drop(26, 21, BLUE),
    ...drop(22, 27, BLUE),
  ];

  const art: Rect[] = [...body, ...drops];
</script>

<IconFrame label="Rain chance">
  <Pixels rects={art} />
</IconFrame>
