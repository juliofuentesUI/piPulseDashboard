<script lang="ts">
  import type { StatTile } from '../types';

  interface Props {
    tiles: readonly StatTile[];
  }

  let { tiles }: Props = $props();
</script>

<section class="grid" aria-label="Forecast details">
  {#each tiles as tile (tile.label)}
    <div class="tile panel">
      <span class="label">{tile.label}</span>
      <span class="value" data-tone={tile.tone}>{tile.value}</span>
    </div>
  {/each}
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .tile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    height: 88px;
  }

  .label {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-dim);
  }

  .value {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 2px;
    text-shadow: 0 4px 0 var(--c-void);
  }

  .value[data-tone='amber'] {
    color: var(--c-amber);
  }

  .value[data-tone='cyan'] {
    color: var(--c-cyan);
  }

  .value[data-tone='pink'] {
    color: var(--c-pink);
  }

  .value[data-tone='green'] {
    color: var(--c-green);
  }
</style>
