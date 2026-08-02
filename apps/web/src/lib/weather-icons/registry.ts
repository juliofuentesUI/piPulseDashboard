import type { Component } from 'svelte';

import type { MetricView, WeatherIconKey } from '../types';
import ClearDay from './ClearDay.svelte';
import ClearNight from './ClearNight.svelte';
import Cloudy from './Cloudy.svelte';
import Fog from './Fog.svelte';
import HeavyRain from './HeavyRain.svelte';
import PartlyCloudyDay from './PartlyCloudyDay.svelte';
import PartlyCloudyNight from './PartlyCloudyNight.svelte';
import Rain from './Rain.svelte';
import Snow from './Snow.svelte';
import Thunderstorm from './Thunderstorm.svelte';
import Umbrella from './Umbrella.svelte';
import Wind from './Wind.svelte';

/** Every sprite a forecast column can render, keyed by visual state. */
export const WEATHER_ICONS: Readonly<Record<WeatherIconKey, Component>> = {
  'clear-day': ClearDay,
  'clear-night': ClearNight,
  'partly-cloudy-day': PartlyCloudyDay,
  'partly-cloudy-night': PartlyCloudyNight,
  cloudy: Cloudy,
  rain: Rain,
  'heavy-rain': HeavyRain,
  thunderstorm: Thunderstorm,
  snow: Snow,
  fog: Fog,
  wind: Wind,
};

/** The two sprites the bottom metrics row uses. */
export const METRIC_ICONS: Readonly<Record<MetricView['icon'], Component>> = {
  umbrella: Umbrella,
  wind: Wind,
};
