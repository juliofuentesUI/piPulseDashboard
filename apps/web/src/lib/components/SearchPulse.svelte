<script lang="ts">
  import type { PulseStatus } from '../trends.svelte';
  import type { DashboardPhase, TrendDetailView, TrendRowView } from '../types';
  import TitleBar from './TitleBar.svelte';
  import TrendRow from './TrendRow.svelte';

  interface Props {
    phase: DashboardPhase;
    rows: readonly TrendRowView[];
    status: PulseStatus;
    region: string;
    detail: TrendDetailView | null;
    selectedId: string;
    onselect: (id: string) => void;
    onmenu: () => void;
  }

  let { phase, rows, status, region, detail, selectedId, onselect, onmenu }: Props =
    $props();
</script>

<div class="pulse">
  <TitleBar title="SEARCH PULSE" size={56} dotRows={3} {onmenu} />

  <div class="region">
    <span class="where">{region}</span>

    <span class="status">
      {#if status.live}
        <span class="lamp"></span>
      {/if}
      <span class="status-text">{status.text}</span>
    </span>
  </div>

  <!--
    Three ways this band can read, and only the last one shows numbers: still
    loading, nothing ever loaded, or a list. A failed poll that still has a
    list falls through to the list — the region strip above says it is cached,
    which is truer than an error page over data we are still holding.
  -->
  {#if rows.length > 0}
    <ol class="trends">
      {#each rows as row (row.id)}
        <TrendRow {...row} selected={row.id === selectedId} {onselect} />
      {/each}
    </ol>
  {:else}
    <div class="empty">
      <p class="lead">
        {phase === 'loading'
          ? 'LOADING SEARCH ACTIVITY…'
          : 'SEARCH TRENDS ARE TEMPORARILY UNAVAILABLE.'}
      </p>
    </div>
  {/if}

  <!--
    Whatever the feed stated about the selected trend, and nothing else. Each
    field disappears rather than showing a dash or a guess when Google did not
    supply it, so the panel is never padded out with placeholder rows.
  -->
  <div class="details">
    <div class="details-head">
      <h2 class="details-heading">TREND DETAILS</h2>
      {#if detail?.isNew}
        <span class="badge">NEW</span>
      {/if}
    </div>

    {#if detail === null}
      <p class="details-note">NO TREND SELECTED.</p>
    {:else}
      <dl class="facts">
        <dt>SEARCH</dt>
        <dd class="search">{detail.title}</dd>

        {#if detail.volume !== ''}
          <dt>VOLUME</dt>
          <dd>{detail.volume} <span class="qualifier">APPROX</span></dd>
        {/if}

        {#if detail.firstReported !== ''}
          <dt>REPORTED</dt>
          <dd>{detail.firstReported} <span class="qualifier">{detail.age}</span></dd>
        {/if}
      </dl>
    {/if}
  </div>
</div>

<style>
  /*
   * Four bands in fixed pixels adding up to the 704 inside the frame. The
   * trend list takes what the other three leave.
   *
   * Title above region, which is the reverse of the weather screens: they lead
   * with a status strip, and this screen leads with its name. That is the
   * order the design calls for, and it is what puts the freshness figure and
   * the LIVE lamp on the two rows that later have to carry them.
   */
  .pulse {
    display: grid;
    grid-template-rows: 96px 64px minmax(0, 1fr) 148px;
    width: 100%;
    height: 100%;
  }

  .region {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 24px;
    overflow: hidden;
    border-bottom: var(--divider) solid var(--c-ink);
  }

  .where {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 3px;
    white-space: nowrap;
    color: var(--c-ink);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  /* Square, like every other mark in this design. Lit only when truly current. */
  .lamp {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    background: var(--c-hot);
  }

  .status-text {
    font-size: 18px;
    letter-spacing: 2px;
    white-space: nowrap;
    overflow: hidden;
    color: var(--c-blue);
  }

  /*
   * Equal rows, so five trends divide the band evenly and a short list still
   * fills it rather than stacking at the top.
   */
  .trends {
    display: grid;
    grid-auto-rows: 1fr;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border-bottom: var(--divider) solid var(--c-ink);
  }

  .empty {
    display: grid;
    align-content: center;
    justify-items: center;
    min-height: 0;
    padding: 0 24px;
    border-bottom: var(--divider) solid var(--c-ink);
  }

  .lead {
    margin: 0;
    font-size: 24px;
    letter-spacing: 3px;
    text-align: center;
    color: var(--c-blue);
  }

  /*
   * The bottom padding is the page indicator's lane. Unlike the weather
   * screens, whose last band has slack the dots can sit in, this one is dense
   * enough to run a line of text straight under them.
   */
  .details {
    display: grid;
    align-content: center;
    gap: 10px;
    min-height: 0;
    padding: 0 24px 28px;
  }

  .details-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .details-heading {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-blue);
  }

  /*
   * The one label on the screen we assign ourselves, so it says exactly what
   * it means: Google first reported this search under 30 minutes ago.
   */
  .badge {
    padding: 2px 8px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 3px;
    color: var(--c-bg);
    background: var(--c-hot);
  }

  .details-note {
    margin: 0;
    font-size: 18px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  /*
   * A real definition list: a screen reader announces "search, does
   * sheepstealer die" rather than two loose strings. `display: grid` on the
   * list puts the dt/dd pairs into columns.
   */
  .facts {
    display: grid;
    grid-template-columns: 122px minmax(0, 1fr);
    align-items: baseline;
    gap: 4px 14px;
    margin: 0;
  }

  .facts dt {
    font-size: 16px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .facts dd {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 20px;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .search {
    font-weight: 700;
  }

  /*
   * "APPROX" is not decoration. Google's figure is the floor of a bucket, and
   * the screen has to keep saying so wherever it prints one.
   */
  .qualifier {
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }
</style>
