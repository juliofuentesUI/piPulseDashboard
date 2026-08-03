<script lang="ts">
  import type { MetricView } from '../types';
  import MetricIcon from '../weather-icons/MetricIcon.svelte';

  let { label, value, unit, icon }: MetricView = $props();
</script>

<section class="metric">
  <div class="icon"><MetricIcon {icon} /></div>
  <div class="text">
    <p class="label">{label}</p>
    <p class="value">{value}<span class="unit">{unit}</span></p>
  </div>
</section>

<style>
  .metric {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 0 20px;
    min-width: 0;
    border-right: var(--divider) solid var(--line);
  }

  .metric:last-child {
    border-right: 0;
  }

  .icon {
    flex: 0 0 auto;
    width: 82px;
    height: 82px;
  }

  .text {
    min-width: 0;
  }

  p {
    margin: 0;
  }

  .label {
    font-size: 22px;
    line-height: 1.15;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .value {
    font-size: 46px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .unit {
    margin-left: 4px;
    font-size: 22px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }
</style>
