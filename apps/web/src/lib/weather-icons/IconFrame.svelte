<script lang="ts">
  import type { Snippet } from 'svelte';

  import { GRID } from './sprite';

  interface Props {
    /** Accessible name, e.g. "Clear sky". */
    label: string;
    children: Snippet;
  }

  let { label, children }: Props = $props();
</script>

<svg
  class="frame"
  viewBox="0 0 {GRID} {GRID}"
  role="img"
  aria-label={label}
  shape-rendering="crispEdges"
  xmlns="http://www.w3.org/2000/svg"
>
  {@render children()}
</svg>

<style>
  .frame {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    overflow: visible;
  }
</style>
