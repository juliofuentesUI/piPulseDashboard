<script lang="ts">
  import type { Notice } from '../dashboard.svelte';
  import type { DashboardView } from '../types';
  import ForecastColumn from './ForecastColumn.svelte';
  import MetricPanel from './MetricPanel.svelte';
  import StatusHeader from './StatusHeader.svelte';
  import TitleBar from './TitleBar.svelte';

  interface Props {
    view: DashboardView;
    date: string;
    clock: string;
    notice: Notice | null;
    onrefresh: () => void;
    onswap: () => void;
  }

  let { view, date, clock, notice, onrefresh, onswap }: Props = $props();
</script>

<div class="dashboard">
  <StatusHeader {date} {clock} location={view.location} {notice} {onrefresh} />
  <TitleBar {onswap} />

  <div class="forecast">
    {#each view.columns as column (column.label)}
      <ForecastColumn {...column} />
    {/each}
  </div>

  <div class="metrics">
    {#each view.metrics as metric (metric.label)}
      <MetricPanel {...metric} />
    {/each}
  </div>
</div>

<style>
  /*
   * The four bands of the reference design, in fixed pixels because the panel
   * is always exactly 720x720 — App.svelte scales the whole thing when it is
   * being viewed anywhere else.
   */
  /*
   * minmax(0, 1fr), not 1fr: a bare 1fr carries an automatic minimum, so a tall
   * column would grow the track past the space left over and push the metrics
   * row off the bottom of the panel instead of being made to fit.
   */
  .dashboard {
    display: grid;
    grid-template-rows: 76px 116px minmax(0, 1fr) 132px;
    width: 100%;
    height: 100%;
  }

  .forecast {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    min-height: 0;
    border-bottom: var(--divider) solid var(--c-ink);
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    min-height: 0;
  }
</style>
