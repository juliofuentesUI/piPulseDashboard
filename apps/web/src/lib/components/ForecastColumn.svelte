<script lang="ts">
  import type { ColumnView } from '../types';
  import WeatherIcon from '../weather-icons/WeatherIcon.svelte';

  let { label, time, icon, temperature, condition }: ColumnView = $props();
</script>

<section class="column">
  <p class="label">{label}</p>
  <p class="time">{time}</p>
  <div class="icon">
    {#if icon !== null}
      <WeatherIcon {icon} />
    {/if}
  </div>
  <p class="temperature">{temperature}<span class="degree">°</span></p>
  <p class="condition">{condition}</p>
</section>

<style>
  /*
   * Fixed track heights rather than auto: the three columns must share a
   * baseline even when one condition wraps to two lines and its neighbours
   * do not.
   */
  .column {
    display: grid;
    grid-template-rows: 28px 24px minmax(0, 1fr) 68px 48px;
    gap: 8px;
    justify-items: center;
    align-items: center;
    padding: 12px 8px;
    min-width: 0;
    min-height: 0;
    border-right: var(--divider) solid var(--line);
  }

  .column:last-child {
    border-right: 0;
  }

  p {
    margin: 0;
    text-align: center;
  }

  .label {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 3px;
    color: var(--c-ink);
  }

  .time {
    font-size: 22px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  /*
   * A hard square, not a percentage of the track. A percentage height here does
   * not resolve — the box is centred rather than stretched, so its containing
   * block is indefinite — and the sprite then sizes itself off the column's
   * *width* and spills over the temperature below it.
   *
   * 152 is exactly the space the four fixed tracks, the gaps and the padding
   * leave behind, so the column still adds up to its 376.
   */
  .icon {
    width: 152px;
    height: 152px;
  }

  .temperature {
    font-size: 64px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .degree {
    font-size: 30px;
    vertical-align: top;
  }

  .condition {
    font-size: 20px;
    line-height: 1.1;
    letter-spacing: 2px;
    color: var(--c-blue);
  }
</style>
