<script lang="ts">
  import type { WeatherIconKey } from '../types';
  import WeatherIcon from '../weather-icons/WeatherIcon.svelte';

  interface Props {
    icon: WeatherIconKey;
    temperature: string;
    condition: string;
    feelsLike: string;
  }

  let { icon, temperature, condition, feelsLike }: Props = $props();
</script>

<section class="hero panel" aria-label="Current conditions">
  <div class="sprite">
    <WeatherIcon {icon} />
  </div>
  <p class="temperature">{temperature}</p>
  <p class="condition">{condition}</p>
  <p class="feels">{feelsLike}</p>
</section>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 0;
    overflow: hidden;
  }

  .sprite {
    width: 120px;
    height: 120px;
    flex: 0 0 auto;
    filter: drop-shadow(0 4px 0 var(--c-void));
  }

  .temperature {
    margin: 2px 0 0;
    font-size: 104px;
    font-weight: 700;
    line-height: 0.9;
    letter-spacing: 2px;
    color: var(--c-ink);
    text-shadow:
      0 6px 0 var(--c-void),
      0 0 24px rgba(167, 157, 219, 0.25);
  }

  .condition {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 5px;
    color: var(--c-amber);
    text-shadow: 0 3px 0 var(--c-void);
  }

  .feels {
    margin: 0;
    font-size: 15px;
    letter-spacing: 3px;
    color: var(--c-dim);
  }
</style>
