<script lang="ts">
  const BLOCKS = [0, 1, 2, 3, 4];
</script>

<section class="loading panel" aria-live="polite" aria-busy="true">
  <p class="title">PIPULSE</p>
  <div class="meter" role="progressbar" aria-label="Loading weather">
    {#each BLOCKS as block (block)}
      <span class="block" style:animation-delay="{block * 0.14}s"></span>
    {/each}
  </div>
  <p class="caption">FETCHING WEATHER</p>
</section>

<style>
  .loading {
    grid-row: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
  }

  .title {
    margin: 0;
    font-size: 44px;
    font-weight: 700;
    letter-spacing: 12px;
    color: var(--c-amber);
    text-shadow: 0 5px 0 var(--c-void);
  }

  .meter {
    display: flex;
    gap: 10px;
    padding: 12px;
    border: 4px solid var(--c-line);
    background: var(--c-screen);
  }

  .block {
    width: 28px;
    height: 40px;
    background: var(--c-line-soft);
    animation: fill 1.2s steps(1, end) infinite;
  }

  @keyframes fill {
    0%,
    45% {
      background: var(--c-cyan);
    }
    46%,
    100% {
      background: var(--c-line-soft);
    }
  }

  .caption {
    margin: 0;
    font-size: 18px;
    letter-spacing: 5px;
    color: var(--c-dim);
  }

  @media (prefers-reduced-motion: reduce) {
    .block {
      animation: none;
      background: var(--c-cyan);
    }
  }
</style>
