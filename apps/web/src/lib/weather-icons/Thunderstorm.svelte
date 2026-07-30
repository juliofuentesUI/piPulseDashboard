<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { cloud, rect, type Rect } from './sprite';

  const body: Rect[] = cloud(0, -3, {
    body: 'var(--ic-cloud-dark)',
    shade: 'var(--ic-cloud-dark-shade)',
    highlight: 'var(--ic-cloud)',
  });

  const bolt: Rect[] = [
    rect(13, 15, 4, 1, 'var(--ic-bolt)'),
    rect(12, 16, 4, 1, 'var(--ic-bolt)'),
    rect(11, 17, 4, 1, 'var(--ic-bolt)'),
    rect(9, 18, 7, 1, 'var(--ic-bolt-hi)'),
    rect(12, 19, 3, 1, 'var(--ic-bolt)'),
    rect(11, 20, 3, 1, 'var(--ic-bolt)'),
    rect(10, 21, 3, 1, 'var(--ic-bolt)'),
    rect(9, 22, 2, 1, 'var(--ic-bolt)'),
  ];
</script>

<IconFrame label="Thunderstorm">
  <Pixels rects={body} />
  <g class="bolt"><Pixels rects={bolt} /></g>
</IconFrame>

<style>
  .bolt {
    animation: strike 3.2s steps(1, end) infinite;
  }

  @keyframes strike {
    0%,
    8% {
      opacity: 1;
    }
    9%,
    16% {
      opacity: 0.2;
    }
    17%,
    30% {
      opacity: 1;
    }
    31%,
    100% {
      opacity: 0.65;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bolt {
      animation: none;
      opacity: 1;
    }
  }
</style>
