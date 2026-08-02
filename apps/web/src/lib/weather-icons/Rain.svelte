<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, drop, outlined, SKY, type Rect } from './sprite';

  const drops: Rect[] = [7, 15, 23].flatMap((x) => outlined(drop(x, 26, SKY)));

  const art: Rect[] = [...outlined(cloud(0, 1)), ...drops];
</script>

<IconFrame label="Rain">
  <Pixels rects={art} />
</IconFrame>
