<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { disc, HOT, outlined, rect, WARM, type Rect } from './sprite';

  const body = disc(16, 16, 8, WARM);

  /** Cardinal rays are straight bars; diagonals are two stepped blocks. */
  const rays: Rect[] = [
    rect(15, 1, 2, 5, HOT),
    rect(15, 26, 2, 5, HOT),
    rect(1, 15, 5, 2, HOT),
    rect(26, 15, 5, 2, HOT),
    rect(6, 6, 2, 2, HOT),
    rect(8, 8, 2, 2, HOT),
    rect(24, 6, 2, 2, HOT),
    rect(22, 8, 2, 2, HOT),
    rect(6, 24, 2, 2, HOT),
    rect(8, 22, 2, 2, HOT),
    rect(24, 24, 2, 2, HOT),
    rect(22, 22, 2, 2, HOT),
  ];

  const art: Rect[] = [...outlined(body, HOT), ...rays];
</script>

<IconFrame label="Clear">
  <Pixels rects={art} />
</IconFrame>
