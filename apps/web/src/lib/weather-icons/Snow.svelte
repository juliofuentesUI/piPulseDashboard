<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { BLUE, cloud, flake, outlined, type Rect } from './sprite';

  /** Flakes stay unoutlined — a border on a one-pixel arm just fills it in. */
  const flakes: Rect[] = [
    ...flake(7, 27, 3, BLUE),
    ...flake(16, 28, 3, BLUE),
    ...flake(25, 27, 3, BLUE),
  ];

  const art: Rect[] = [...outlined(cloud(0, 0)), ...flakes];
</script>

<IconFrame label="Snow">
  <Pixels rects={art} />
</IconFrame>
