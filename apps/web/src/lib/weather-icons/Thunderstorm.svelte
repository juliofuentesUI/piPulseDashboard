<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, cloud, HOT, outlined, rect, SKY, WARM, type Rect } from './sprite';

  /** Rows of the bolt from y=21 down, as [x, width]. The wide row is the kink. */
  const BOLT: readonly (readonly [number, number])[] = [
    [17, 6],
    [16, 6],
    [15, 6],
    [14, 6],
    [13, 11],
    [18, 5],
    [17, 5],
    [16, 4],
    [15, 3],
  ];

  const bolt: Rect[] = BOLT.map(([x, w], i) => rect(x, 21 + i, w, 1, WARM));

  const art: Rect[] = [
    ...outlined(cloud(0, -2, { body: SKY, shade: BLUE })),
    ...outlined(bolt, HOT),
  ];
</script>

<IconFrame label="Thunderstorm">
  <Pixels rects={art} />
</IconFrame>
