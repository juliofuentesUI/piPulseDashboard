<script lang="ts">
  import type { Rect } from './sprite';

  interface Props {
    rects: readonly Rect[];
  }

  let { rects }: Props = $props();
</script>

{#each rects as r, i (i)}
  <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c} />
{/each}
