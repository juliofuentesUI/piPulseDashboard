<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, crescent, HOT, outlined, sparkle, WARM, type Rect } from './sprite';

  const moon = crescent(12, 10, 7, 6, 0, WARM, 8);

  const art: Rect[] = [
    ...outlined(moon, HOT),
    ...sparkle(22, 4, 2, WARM),
    ...outlined(cloud(3, 6)),
  ];
</script>

<IconFrame label="Partly cloudy night">
  <Pixels rects={art} />
</IconFrame>
