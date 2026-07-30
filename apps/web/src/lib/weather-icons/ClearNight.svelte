<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { crescent, rect, type Rect } from './sprite';

  // Wide crescent first, then a narrower one on top: the extra sliver left
  // exposed on the outer rim becomes the lit edge.
  const moon: Rect[] = [
    ...crescent(15, 12, 8, 7, -3, 'var(--ic-moon-hi)'),
    ...crescent(15, 12, 8, 4, -3, 'var(--ic-moon)'),
  ];

  const stars: readonly { rects: Rect[]; delay: string }[] = [
    { rects: [rect(20, 3, 2, 2, 'var(--ic-star)')], delay: '0s' },
    { rects: [rect(2, 6, 1, 1, 'var(--ic-star)')], delay: '0.9s' },
    { rects: [rect(3, 17, 2, 2, 'var(--ic-star)')], delay: '1.7s' },
  ];
</script>

<IconFrame label="Clear night sky">
  {#each stars as star, i (i)}
    <g class="star" style:animation-delay={star.delay}>
      <Pixels rects={star.rects} />
    </g>
  {/each}
  <Pixels rects={moon} />
</IconFrame>

<style>
  .star {
    animation: twinkle 3.6s steps(2, end) infinite;
  }

  @keyframes twinkle {
    0%,
    60% {
      opacity: 1;
    }
    61%,
    100% {
      opacity: 0.15;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .star {
      animation: none;
    }
  }
</style>
