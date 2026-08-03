<script lang="ts">
  import type { SparklineView } from '../types';

  let { width, height, path, dots }: SparklineView = $props();
</script>

<!--
  Geometry only. Every label around this lives in HTML, because the SVG is
  stretched to fill its box with `preserveAspectRatio="none"` and text inside
  it would be stretched with it.

  Drawn on the same terms as the sprites: whole-pixel geometry with
  `crispEdges`, no curves and no smoothing. A rank is an integer observed at a
  moment, and joining the observations with straight segments claims nothing
  the record does not contain.
-->
<svg
  class="spark"
  viewBox="0 0 {width} {height}"
  role="img"
  aria-label="Rank over time"
  shape-rendering="crispEdges"
  preserveAspectRatio="none"
>
  <!-- Top and bottom of the rank space, so the line has something to sit against. -->
  <line class="rule" x1="0" y1="0.5" x2={width} y2="0.5" />
  <line class="rule" x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} />

  <polyline class="line" points={path} fill="none" />

  <!--
    One mark per observation. Without these a single reading would draw
    nothing at all, which is exactly the state a freshly booted Pi is in.
  -->
  {#each dots as dot, i (i)}
    <!--
      The marker is nudged inside the plot at the extremes rather than the
      data being inset: rank 1 is the top line and most observations of an
      interesting trend sit on it, so a marker centred there would lose its
      top half to the edge. The polyline vertex stays exactly where the
      observation was.
    -->
    <rect
      class="dot"
      x={Math.min(Math.max(dot.x - 3, 0), width - 6)}
      y={Math.min(Math.max(dot.y - 3, 0), height - 6)}
      width="6"
      height="6"
    />
  {/each}
</svg>

<style>
  .spark {
    display: block;
    width: 100%;
    height: 100%;
  }

  .rule {
    stroke: var(--c-blue);
    stroke-width: 1;
    opacity: 0.45;
  }

  .line {
    stroke: var(--c-sky);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
  }

  .dot {
    fill: var(--c-ink);
  }
</style>
