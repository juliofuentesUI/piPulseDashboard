<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, disc, rect, type Rect } from './sprite';

  const sun: Rect[] = [
    rect(8, 0, 2, 2, 'var(--ic-sun-ray)'),
    rect(0, 8, 2, 2, 'var(--ic-sun-ray)'),
    rect(17, 8, 2, 2, 'var(--ic-sun-ray)'),
    rect(2, 2, 2, 2, 'var(--ic-sun-ray)'),
    rect(15, 2, 2, 2, 'var(--ic-sun-ray)'),
    ...disc(9, 9, 5, 'var(--ic-sun)'),
    rect(7, 5, 3, 1, 'var(--ic-sun-hi)'),
    rect(5, 7, 2, 2, 'var(--ic-sun-hi)'),
  ];

  const body: Rect[] = cloud(-1, 4, {
    body: 'var(--ic-cloud)',
    shade: 'var(--ic-cloud-shade)',
    highlight: 'var(--ic-cloud-hi)',
  });
</script>

<IconFrame label="Partly cloudy">
  <Pixels rects={sun} />
  <g class="cloud"><Pixels rects={body} /></g>
</IconFrame>

<style>
  .cloud {
    animation: drift 9s ease-in-out infinite alternate;
  }

  @keyframes drift {
    from {
      transform: translateX(-1px);
    }
    to {
      transform: translateX(1px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cloud {
      animation: none;
    }
  }
</style>
