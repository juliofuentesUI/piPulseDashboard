<script lang="ts">
  const BLOCKS = [0, 1, 2, 3, 4];
</script>

<section class="loading" aria-live="polite" aria-busy="true">
  <p class="title">WEATHER</p>
  <div class="meter" role="progressbar" aria-label="Loading weather">
    {#each BLOCKS as block (block)}
      <span class="block" style:animation-delay="{block * 0.14}s"></span>
    {/each}
  </div>
  <p class="caption">FETCHING</p>
</section>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
  }

  .title {
    margin: 0;
    font-size: 72px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-ink);
  }

  .meter {
    display: flex;
    gap: 8px;
    padding: 10px;
    border: var(--divider) solid var(--c-ink);
  }

  .block {
    width: 32px;
    height: 44px;
    background: var(--c-bg);
    animation: fill 1.2s steps(1, end) infinite;
  }

  @keyframes fill {
    0%,
    45% {
      background: var(--c-sky);
    }
    46%,
    100% {
      background: var(--c-bg);
    }
  }

  .caption {
    margin: 0;
    font-size: 20px;
    letter-spacing: 5px;
    color: var(--c-blue);
  }

  @media (prefers-reduced-motion: reduce) {
    .block {
      animation: none;
      background: var(--c-sky);
    }
  }
</style>
