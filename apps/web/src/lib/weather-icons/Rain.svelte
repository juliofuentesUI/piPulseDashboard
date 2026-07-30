<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, rect, type Rect } from './sprite';

  const body: Rect[] = cloud(0, -2, {
    body: 'var(--ic-cloud-dark)',
    shade: 'var(--ic-cloud-dark-shade)',
    highlight: 'var(--ic-cloud)',
  });

  const drops: readonly { rects: Rect[]; delay: string }[] = [
    { rects: [rect(7, 17, 2, 3, 'var(--ic-rain)')], delay: '0s' },
    { rects: [rect(12, 17, 2, 3, 'var(--ic-rain-hi)')], delay: '0.45s' },
    { rects: [rect(17, 17, 2, 3, 'var(--ic-rain)')], delay: '0.9s' },
  ];
</script>

<IconFrame label="Rain">
  <Pixels rects={body} />
  {#each drops as drop, i (i)}
    <g class="drop" style:animation-delay={drop.delay}>
      <Pixels rects={drop.rects} />
    </g>
  {/each}
</IconFrame>

<style>
  .drop {
    animation: fall 1.35s linear infinite;
  }

  @keyframes fall {
    0% {
      transform: translateY(0);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translateY(5px);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drop {
      animation: none;
      opacity: 1;
    }
  }
</style>
