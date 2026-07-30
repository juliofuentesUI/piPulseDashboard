<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, rect, type Rect } from './sprite';

  const body: Rect[] = cloud(0, -5, {
    body: 'var(--ic-cloud-dark)',
    shade: 'var(--ic-cloud-dark-shade)',
    highlight: 'var(--ic-cloud)',
  });

  const bands: readonly { rects: Rect[]; delay: string }[] = [
    { rects: [rect(2, 15, 20, 2, 'var(--ic-fog)')], delay: '0s' },
    { rects: [rect(4, 19, 17, 2, 'var(--ic-fog-hi)')], delay: '1.3s' },
  ];
</script>

<IconFrame label="Fog">
  <Pixels rects={body} />
  {#each bands as band, i (i)}
    <g class="band" style:animation-delay={band.delay}>
      <Pixels rects={band.rects} />
    </g>
  {/each}
</IconFrame>

<style>
  .band {
    animation: roll 7s ease-in-out infinite alternate;
  }

  @keyframes roll {
    from {
      transform: translateX(-2px);
      opacity: 0.6;
    }
    to {
      transform: translateX(2px);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .band {
      animation: none;
      opacity: 1;
    }
  }
</style>
