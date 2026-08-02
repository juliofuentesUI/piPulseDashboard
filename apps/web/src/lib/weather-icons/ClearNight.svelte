<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { crescent, HOT, outlined, sparkle, WARM, type Rect } from './sprite';

  const moon = crescent(19, 16, 11, 7, 0, WARM, 12);

  const art: Rect[] = [
    ...outlined(moon, HOT),
    ...sparkle(27, 7, 2, WARM),
    ...sparkle(25, 22, 2, WARM),
  ];
</script>

<IconFrame label="Clear night">
  <Pixels rects={art} />
</IconFrame>
