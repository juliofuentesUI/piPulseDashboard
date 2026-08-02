<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, cloud, drop, outlined, SKY, type Rect } from './sprite';

  /** A cooler, heavier cloud and five drops instead of three. */
  const body = cloud(0, 0, { body: SKY, shade: BLUE });
  const drops: Rect[] = [3, 9, 15, 21, 27].flatMap((x) => outlined(drop(x, 25, SKY)));

  const art: Rect[] = [...outlined(body), ...drops];
</script>

<IconFrame label="Heavy rain">
  <Pixels rects={art} />
</IconFrame>
