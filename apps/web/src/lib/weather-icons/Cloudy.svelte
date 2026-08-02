<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, cloud, outlined, SKY, type Rect } from './sprite';

  /** A cooler cloud behind and above reads as overcast rather than as one cloud. */
  const back = cloud(3, -1, { body: SKY, shade: BLUE });
  const front = cloud(-3, 6);

  const art: Rect[] = [...outlined(back), ...outlined(front)];
</script>

<IconFrame label="Cloudy">
  <Pixels rects={art} />
</IconFrame>
