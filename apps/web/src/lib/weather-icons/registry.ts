import type { Component } from 'svelte';

import type { WeatherIconKey } from '../types';
import ClearDay from './ClearDay.svelte';
import ClearNight from './ClearNight.svelte';
import Cloudy from './Cloudy.svelte';
import Fog from './Fog.svelte';
import PartlyCloudy from './PartlyCloudy.svelte';
import Rain from './Rain.svelte';
import Snow from './Snow.svelte';
import Thunderstorm from './Thunderstorm.svelte';

/** Every sprite the dashboard can render, keyed by visual state. */
export const WEATHER_ICONS: Readonly<Record<WeatherIconKey, Component>> = {
  'clear-day': ClearDay,
  'clear-night': ClearNight,
  'partly-cloudy': PartlyCloudy,
  cloudy: Cloudy,
  rain: Rain,
  thunderstorm: Thunderstorm,
  snow: Snow,
  fog: Fog,
};
