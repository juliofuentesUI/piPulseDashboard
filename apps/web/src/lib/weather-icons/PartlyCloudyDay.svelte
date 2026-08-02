<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, disc, HOT, outlined, rect, WARM, type Rect } from './sprite';

  const sun = disc(10, 10, 6, WARM);

  /** Only the rays that stay clear of the cloud are worth drawing. */
  const rays: Rect[] = [
    rect(9, 1, 2, 3, HOT),
    rect(3, 3, 2, 2, HOT),
    rect(17, 3, 2, 2, HOT),
    rect(0, 9, 3, 2, HOT),
    rect(18, 9, 3, 2, HOT),
  ];

  const art: Rect[] = [...outlined(sun, HOT), ...rays, ...outlined(cloud(3, 6))];
</script>

<IconFrame label="Partly cloudy">
  <Pixels rects={art} />
</IconFrame>
