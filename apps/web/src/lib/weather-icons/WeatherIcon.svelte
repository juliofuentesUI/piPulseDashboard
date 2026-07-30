<script lang="ts">
  import type { WeatherIconKey } from '../types';
  import { WEATHER_ICONS } from './registry';

  interface Props {
    icon: WeatherIconKey;
  }

  let { icon }: Props = $props();

  const Sprite = $derived(WEATHER_ICONS[icon]);
</script>

<Sprite />
