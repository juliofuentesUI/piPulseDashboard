<script lang="ts">
  interface Props {
    location: string;
    clock: string;
    online: boolean;
  }

  let { location, clock, online }: Props = $props();
</script>

<header class="bar panel">
  <h1 class="location">{location}</h1>
  <div class="right">
    <span
      class="link"
      class:down={!online}
      role="status"
      aria-label={online ? 'Network connected' : 'Network unavailable'}
    ></span>
    <time class="clock">{clock}</time>
  </div>
</header>

<style>
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    height: 74px;
  }

  .location {
    margin: 0;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 3px;
    color: var(--c-ink);
    text-shadow: 0 3px 0 var(--c-void);
  }

  .right {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .clock {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--c-amber);
    text-shadow: 0 3px 0 var(--c-void);
  }

  /* A chunky square "signal" pip rather than an icon, to stay on-grid. */
  .link {
    width: 14px;
    height: 14px;
    background: var(--c-green);
    box-shadow:
      inset 0 0 0 3px var(--c-void),
      0 0 0 3px var(--c-line-soft);
  }

  .link.down {
    background: var(--c-red);
    animation: blink 1.6s steps(1, end) infinite;
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0.25;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .link.down {
      animation: none;
    }
  }
</style>
