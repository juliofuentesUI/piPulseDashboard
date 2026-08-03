<script lang="ts">
  import type { TrendRowView } from '../types';

  let { rank, title, volume, bar }: TrendRowView = $props();
</script>

<li class="row">
  <span class="rank">{rank}</span>

  <div class="body">
    <div class="line">
      <span class="title">{title}</span>
      {#if volume !== ''}
        <span class="volume">{volume}</span>
      {/if}
    </div>

    <!--
      The bar carries no number of its own; the figure beside the title is the
      only quantity on the row, and it is Google's wording of it.
    -->
    <div class="track">
      <div class="fill" style:--bar="{bar}%"></div>
    </div>
  </div>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: center;
    gap: 4px;
    min-height: 0;
    padding: 0 24px 0 20px;
    border-bottom: var(--divider) solid var(--c-ink);
  }

  /* The last row's border would double up with the details band's own edge. */
  .row:last-child {
    border-bottom: 0;
  }

  .rank {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--c-blue);
  }

  .body {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
  }

  /*
   * One line, clipped rather than wrapped. A long search term must not push
   * the bar out of the row: the band is a fixed height with five rows in it,
   * and every row has to keep its place.
   */
  .title {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 23px;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .volume {
    flex: 0 0 auto;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--c-hot);
  }

  .track {
    height: 14px;
    background: var(--c-bg);
    border: var(--divider) solid var(--c-ink);
  }

  .fill {
    width: var(--bar);
    height: 100%;
    background: var(--c-sky);
  }
</style>
