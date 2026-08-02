<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, outlined, rect, SKY, type Rect } from './sprite';

  /** Kept a clear row apart from the cloud, or the outlines merge into a slab. */
  const bands: Rect[] = [
    ...outlined([rect(5, 23, 22, 2, SKY)]),
    ...outlined([rect(9, 28, 15, 2, SKY)]),
  ];

  const art: Rect[] = [...outlined(cloud(0, -2)), ...bands];
</script>

<IconFrame label="Fog">
  <Pixels rects={art} />
</IconFrame>
