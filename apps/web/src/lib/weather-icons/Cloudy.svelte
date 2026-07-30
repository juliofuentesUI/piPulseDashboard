<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, type Rect } from './sprite';

  const back: Rect[] = cloud(-4, -4, {
    body: 'var(--ic-cloud-dark)',
    shade: 'var(--ic-cloud-dark-shade)',
    highlight: 'var(--ic-cloud)',
  });

  const front: Rect[] = cloud(2, 3, {
    body: 'var(--ic-cloud)',
    shade: 'var(--ic-cloud-shade)',
    highlight: 'var(--ic-cloud-hi)',
  });
</script>

<IconFrame label="Cloudy">
  <g class="back"><Pixels rects={back} /></g>
  <g class="front"><Pixels rects={front} /></g>
</IconFrame>

<style>
  .back {
    animation: drift-back 11s ease-in-out infinite alternate;
  }

  .front {
    animation: drift-front 8s ease-in-out infinite alternate;
  }

  @keyframes drift-back {
    from {
      transform: translateX(1px);
    }
    to {
      transform: translateX(-1px);
    }
  }

  @keyframes drift-front {
    from {
      transform: translateX(-1px);
    }
    to {
      transform: translateX(1px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .back,
    .front {
      animation: none;
    }
  }
</style>
