<script lang="ts">
  import IconFrame from './IconFrame.svelte';
  import Pixels from './Pixels.svelte';
  import { disc, rect, type Rect } from './sprite';

  const rays: Rect[] = [
    rect(11, 0, 2, 3, 'var(--ic-sun-ray)'),
    rect(11, 21, 2, 3, 'var(--ic-sun-ray)'),
    rect(0, 11, 3, 2, 'var(--ic-sun-ray)'),
    rect(21, 11, 3, 2, 'var(--ic-sun-ray)'),
    rect(4, 4, 2, 2, 'var(--ic-sun-ray)'),
    rect(18, 4, 2, 2, 'var(--ic-sun-ray)'),
    rect(4, 18, 2, 2, 'var(--ic-sun-ray)'),
    rect(18, 18, 2, 2, 'var(--ic-sun-ray)'),
  ];

  const body: Rect[] = [
    ...disc(12, 12, 6, 'var(--ic-sun)'),
    rect(9, 7, 4, 1, 'var(--ic-sun-hi)'),
    rect(8, 8, 2, 2, 'var(--ic-sun-hi)'),
    rect(7, 10, 1, 2, 'var(--ic-sun-hi)'),
    rect(14, 15, 4, 1, 'var(--ic-sun-shade)'),
    rect(16, 13, 2, 2, 'var(--ic-sun-shade)'),
  ];
</script>

<IconFrame label="Clear sky">
  <g class="rays"><Pixels rects={rays} /></g>
  <Pixels rects={body} />
</IconFrame>

<style>
  .rays {
    transform-origin: 50% 50%;
    animation: flare 4s ease-in-out infinite alternate;
  }

  @keyframes flare {
    from {
      opacity: 0.55;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rays {
      animation: none;
    }
  }
</style>
