<script lang="ts">
  import type { TrendDayRowView } from '../types';

  interface Props {
    rows: readonly TrendDayRowView[];
    /** Ends of the run axis every row is drawn against. */
    axisStart: string;
    axisEnd: string;
    /** Quarter-day gridlines, as percentages along that axis. */
    marks: readonly number[];
    onopen: (key: string) => void;
  }

  let { rows, axisStart, axisEnd, marks, onopen }: Props = $props();
</script>

<!--
  Ten rows in two columns of five, filled down the left column first.
  Two columns rather than a scroll: this is a wall display with no scrollbar
  and nobody standing at it to drag one, so anything below the fold is gone.
-->
<div class="wrap">
<ol class="days">
  {#each rows as row (row.key)}
    <li class="day-row">
      <!--
        The whole row is the target, like the live list's. This is a
        touchscreen and the row is already what a finger is aiming at.
      -->
      <button class="hit" type="button" onclick={() => onopen(row.key)}>
      <span class="rank">{row.rank}</span>

      <span class="body">
        <span class="title">{row.title}</span>

        <!--
          Both figures are qualified where they sit, because both are easy to
          over-read. The volume is the biggest bucket Google published while
          the trend was young and on the feed, not a total for the day; the
          duration is first sighting to last, which is a span and not a claim
          that it was there throughout.
        -->
        <span class="facts">
          {#if row.volume !== ''}
            <span class="volume">{row.volume}</span>
            <span class="qualifier">PEAK</span>
          {/if}
          {#if row.duration !== ''}
            <span class="stay">{row.duration}</span>
            <span class="qualifier">ON FEED</span>
          {/if}
        </span>

        <!--
          When in the day it ran, not how big it was. The track is midnight to
          now — the same span for every row, labelled once under the list — and
          the filled part is first sighting to last, so the ten runs can be read
          against each other and against the clock.
        -->
        <span class="track">
          <!--
            Graduations first, run over the top. Without them the track reads as
            a bar that failed to fill, because the trend list's bar is exactly
            that and shares these class names — the eye arrives already trained.
          -->
          {#each marks as mark (mark)}
            <span class="mark" style:--at="{mark}%"></span>
          {/each}
          <span
            class="fill"
            style:--run-start="{row.spanStart}%"
            style:--run-width="{row.spanWidth}%"
          ></span>
        </span>
      </span>
      </button>
    </li>
  {/each}
</ol>

<!--
  The axis, named once for both columns. Without this the strip on each row is
  a shape with no scale; with it, "ran mid-morning for twenty minutes" is
  readable straight off the row. The sparkline in the details band frames its
  own axis the same way, for the same reason.

  Both labels sit on the left and only the far end on the right. Centring the
  caption put it directly under the page indicator, which overlays this band —
  measured at 64px of overlap, and invisible in a render because the dots are
  drawn over the top of it.
-->
<p class="axis">
  <span class="axis-end">{axisStart}<span class="axis-label">TIME ON FEED</span></span>
  <span>{axisEnd}</span>
</p>
</div>

<style>
  /* Rows take what is left after the axis has its line. */
  .wrap {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
  }

  /*
   * Column-flow over five fixed rows, so rank 1-5 runs down the left and 6-10
   * down the right. Row-flow would read 1,2 / 3,4 across, which puts rank 2
   * beside rank 1 and makes the ordering look like it goes sideways.
   */
  .days {
    display: grid;
    grid-template-rows: repeat(5, minmax(0, 1fr));
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    column-gap: 20px;
    min-height: 0;
    margin: 0;
    padding: 0 24px;
    list-style: none;
  }

  .axis {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0;
    padding: 0 24px;
    font-size: 13px;
    letter-spacing: 1px;
    color: var(--c-blue);
  }

  .axis-end {
    display: flex;
    align-items: baseline;
    gap: 14px;
  }

  .axis-label {
    letter-spacing: 3px;
  }

  .day-row {
    display: grid;
    min-width: 0;
    min-height: 0;
  }

  /* The grid moved onto the button so the whole row is the hit area. */
  .hit {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;

    font: inherit;
    text-align: left;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  /* Flat design: pressing recolours rather than moving anything. */
  .hit:active .title {
    color: var(--c-hot);
  }

  /* Same cartouche the live list uses, so a rank reads the same on both. */
  .rank {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 1px;
    text-align: center;
    color: var(--c-blue);
  }

  .body {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  /*
   * One line, clipped. Ten rows on a fixed grid means no row may grow, and a
   * long search term is the one thing here that could push one.
   */
  .title {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 19px;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .facts {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .volume {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--c-hot);
  }

  .stay {
    font-size: 17px;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  /*
   * Not decoration. "PEAK" keeps the figure from reading as a day's total and
   * "ON FEED" keeps the duration from reading as attendance — the screen has
   * to keep saying what each number is wherever it prints one.
   */
  .qualifier {
    font-size: 13px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .qualifier:not(:last-child) {
    margin-right: 6px;
  }

  /*
   * A time axis rather than a quantity, so the fill is offset into it instead
   * of growing from the left edge. Same class names as the trend list's bar on
   * purpose: the themes already know how to paint a track and its fill.
   */
  /*
   * 16px, not 10. `--divider` is 4px on every theme and applies top and bottom,
   * so a 10px track leaves a 2px interior — the border was eight of the ten
   * pixels and the run had almost nowhere to paint. This leaves 8px inside,
   * which is more than the trend list's bar gets and right for a track whose
   * job is to show a position rather than a length.
   */
  .track {
    position: relative;
    display: block;
    height: 16px;
    background: var(--c-bg);
    border: var(--divider) solid var(--line);
  }

  /*
   * A hairline, and dim. It has to be enough to read the track as a scale and
   * not enough to compete with the run, which is the only thing on the row
   * carrying data.
   *
   * Both numbers were set against `gba-blue` rather than a dark theme, because
   * that is where it goes wrong: its track is cream and its run a pale blue, so
   * a graduation in the ink colour reads *stronger* than the data it sits
   * under. At 1px and 0.3 the run is four times the width and the darker mark
   * of the two in every theme.
   */
  .mark {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--at);
    width: 1px;
    background: var(--line);
    opacity: 0.3;
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 var(--run-start);
    display: block;
    width: var(--run-width);
    background: var(--c-sky);
  }
</style>
