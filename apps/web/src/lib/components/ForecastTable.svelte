<script lang="ts">
  import type { WeekView } from '../types';
  import WeatherIcon from '../weather-icons/WeatherIcon.svelte';

  interface Props {
    week: WeekView;
  }

  let { week }: Props = $props();

  /** Filled/empty pips of the rain meter. */
  const DOTS = [0, 1, 2, 3];

  /** The column the reference art tints, counting from zero. */
  const ACCENT_COLUMN = 1;
</script>

<!--
  A real <table>: the data is a grid of days against times, and the header cells
  are what make a screen reader announce "WED, 1:00 PM, 20 degrees" instead of a
  bare number. The layout is CSS grid regardless, applied to the table parts.
-->
<table class="table">
  <thead>
    <tr class="row head">
      <th class="day" scope="col">DAY</th>
      {#each week.headings as heading, i (i)}
        <th class="cell time" class:accent={i === ACCENT_COLUMN} scope="col">
          {heading}
        </th>
      {/each}
      <th class="rain" scope="col"><span class="stack">RAIN<br />CHANCE</span></th>
    </tr>
  </thead>

  <tbody>
    {#each week.rows as row (row.key)}
      <tr class="row">
        <th class="day" scope="row">{row.weekday}</th>

        {#each row.cells as cell, i (i)}
          <td class="cell" class:accent={i === ACCENT_COLUMN}>
            <span class="icon">
              {#if cell.icon !== null}
                <WeatherIcon icon={cell.icon} />
              {/if}
            </span>
            <span class="temperature">{cell.temperature}<span class="degree">°</span></span>
          </td>
        {/each}

        <td class="rain">
          <span class="meter" aria-hidden="true">
            {#each DOTS as dot (dot)}
              <span class="pip" class:filled={dot < row.rainDots}></span>
            {/each}
          </span>
          <span class="percent">{row.rain}<span class="sign">%</span></span>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  /*
   * Fixed tracks, not auto: the panel is exactly 720x720, so the eight rows and
   * five columns are sized here rather than negotiated with the content. A cell
   * that wanted more would otherwise push the last row past the footer.
   */
  .table {
    display: grid;
    grid-template-rows: 46px repeat(7, minmax(0, 1fr));
    width: 100%;
    height: 100%;
    border-collapse: collapse;
  }

  /* thead/tbody are display:contents so their rows join the table's own grid. */
  .table :global(thead),
  .table :global(tbody) {
    display: contents;
  }

  /*
   * Every row rules itself off, the last one included — that bottom edge is
   * what divides the table from the footer band. Exempting `:last-child` would
   * not do it anyway: `display: contents` leaves each row the last child of its
   * own thead or tbody, so the rule would strip the heading's divider and leave
   * the final row's in place, which is exactly backwards.
   */
  .row {
    display: grid;
    grid-template-columns: 96px repeat(3, minmax(0, 1fr)) 116px;
    min-height: 0;
    border-bottom: var(--divider) solid var(--c-ink);
  }

  .day,
  .cell,
  .rain {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-width: 0;
    min-height: 0;
    padding: 0 6px;
    margin: 0;
    font-weight: 400;
    border-right: var(--divider) solid var(--c-ink);
  }

  .rain {
    flex-direction: column;
    gap: 4px;
    border-right: 0;
  }

  /*
   * The reference art tints the midday column so the eye can run down the
   * warmest reading of each day. color-mix keeps it a tint of the theme's own
   * sky rather than a sixth hard-coded colour.
   */
  .accent {
    background: color-mix(in srgb, var(--c-sky) 22%, transparent);
  }

  /* --- Header row --- */

  .head {
    border-bottom: var(--divider) solid var(--c-ink);
  }

  .head .day,
  .time {
    font-size: 20px;
    letter-spacing: 3px;
    color: var(--c-blue);
  }

  .head .rain {
    gap: 0;
    font-size: 17px;
    line-height: 1.1;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .stack {
    text-align: center;
  }

  /* --- Data rows --- */

  .day {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 3px;
    color: var(--c-ink);
  }

  /*
   * A hard square rather than a percentage: the flex line is centred, not
   * stretched, so a percentage height has no definite box to resolve against
   * and the sprite falls back to sizing off its own width.
   */
  .icon {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
  }

  .temperature {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .degree {
    font-size: 17px;
    vertical-align: top;
  }

  .meter {
    display: flex;
    gap: 7px;
  }

  .pip {
    width: 12px;
    height: 12px;
    border: 2px solid var(--c-blue);
    border-radius: 50%;
  }

  .pip.filled {
    background: var(--c-blue);
  }

  .percent {
    font-size: 27px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .sign {
    margin-left: 3px;
    font-size: 19px;
    color: var(--c-blue);
  }
</style>
