<script lang="ts">
  import type { Notice } from '../dashboard.svelte';
  import type { DashboardView } from '../types';
  import FooterBar from './FooterBar.svelte';
  import ForecastTable from './ForecastTable.svelte';
  import StatusHeader from './StatusHeader.svelte';
  import TitleBar from './TitleBar.svelte';

  interface Props {
    view: DashboardView;
    date: string;
    clock: string;
    updated: string;
    busy: boolean;
    notice: Notice | null;
    onrefresh: () => void;
    onmenu: () => void;
  }

  let { view, date, clock, updated, busy, notice, onrefresh, onmenu }: Props = $props();
</script>

<div class="screen">
  <StatusHeader {date} {clock} location={view.location} {notice} {onrefresh} />

  <!--
    62px, not the dashboard's 100: "7-DAY FORECAST" is fourteen characters
    against "WEATHER"'s seven, and the band is 704px wide with the dot grid in
    it. Anything larger wraps or clips.
  -->
  <TitleBar title="7-DAY FORECAST" size={62} dotRows={3} {onmenu} />

  <ForecastTable week={view.week} />

  <FooterBar {updated} {busy} {onrefresh} />
</div>

<style>
  /*
   * Four bands in fixed pixels, adding up to the 704 inside the frame. The
   * table takes what the other three leave, and sizes its own eight rows.
   *
   * minmax(0, 1fr), not 1fr: a bare 1fr carries an automatic minimum, so a tall
   * table would grow past the space left over and push the footer off the
   * bottom of the panel instead of being made to fit.
   */
  .screen {
    display: grid;
    grid-template-rows: 64px 96px minmax(0, 1fr) 60px;
    width: 100%;
    height: 100%;
  }
</style>
