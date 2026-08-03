<script lang="ts">
  import type { SparklineView } from '../types';

  let { width, height, path, dots, topLabel, bottomLabel }: SparklineView = $props();

  /** Room for the axis numbers to the left of the plot. */
  const GUTTER = 22;
  const PAD = 4;
</script>

<!--
  Drawn on the same terms as the sprites: whole-pixel geometry with
  `crispEdges`, no curves and no smoothing. A rank is an integer observed at a
  moment, and joining the observations with straight segments claims nothing
  the record does not contain.
-->
<svg
  class="spark"
  viewBox="0 0 {width + GUTTER} {height + PAD * 2}"
  role="img"
  aria-label="Rank over the last 24 hours"
  shape-rendering="crispEdges"
  preserveAspectRatio="none"
>
  <text class="axis" x="0" y={PAD + 7}>{topLabel}</text>
  <text class="axis" x="0" y={height + PAD}>{bottomLabel}</text>

  <g transform="translate({GUTTER} {PAD})">
    <!-- Top and bottom of the rank space, so the line has something to sit against. -->
    <line class="rule" x1="0" y1="0" x2={width} y2="0" />
    <line class="rule" x1="0" y1={height} x2={width} y2={height} />

    <polyline class="line" points={path} fill="none" />

    <!--
      One mark per observation. Without these a single reading would draw
      nothing at all, which is exactly the state a freshly booted Pi is in.
    -->
    {#each dots as dot, i (i)}
      <rect class="dot" x={dot.x - 2} y={dot.y - 2} width="4" height="4" />
    {/each}
  </g>
</svg>

<style>
  .spark {
    display: block;
    width: 100%;
    height: 100%;
  }

  .axis {
    font-family: inherit;
    font-size: 13px;
    fill: var(--c-blue);
  }

  .rule {
    stroke: var(--c-blue);
    stroke-width: 1;
    opacity: 0.45;
  }

  .line {
    stroke: var(--c-sky);
    stroke-width: 3;
  }

  .dot {
    fill: var(--c-ink);
  }
</style>
