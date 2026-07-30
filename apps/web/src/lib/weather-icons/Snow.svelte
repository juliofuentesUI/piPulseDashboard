<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, rect, type Rect } from './sprite';

  const body: Rect[] = cloud(0, -2, {
    body: 'var(--ic-cloud)',
    shade: 'var(--ic-cloud-shade)',
    highlight: 'var(--ic-cloud-hi)',
  });

  /** A three-pixel plus sign reads as a flake at this size. */
  function flake(x: number, y: number): Rect[] {
    return [
      rect(x + 1, y, 1, 3, 'var(--ic-snow)'),
      rect(x, y + 1, 3, 1, 'var(--ic-snow)'),
    ];
  }

  const flakes: readonly { rects: Rect[]; delay: string }[] = [
    { rects: flake(6, 17), delay: '0s' },
    { rects: flake(11, 17), delay: '1s' },
    { rects: flake(16, 17), delay: '2s' },
  ];
</script>

<IconFrame label="Snow">
  <Pixels rects={body} />
  {#each flakes as item, i (i)}
    <g class="flake" style:animation-delay={item.delay}>
      <Pixels rects={item.rects} />
    </g>
  {/each}
</IconFrame>

<style>
  .flake {
    animation: drift-down 3s linear infinite;
  }

  @keyframes drift-down {
    0% {
      transform: translate(0, 0);
      opacity: 0;
    }
    25% {
      opacity: 1;
    }
    50% {
      transform: translate(1px, 2px);
    }
    75% {
      opacity: 1;
    }
    100% {
      transform: translate(0, 5px);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flake {
      animation: none;
      opacity: 1;
    }
  }
</style>
