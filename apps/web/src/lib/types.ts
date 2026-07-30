/**
 * Transport types (what `/api/weather` sends) are deliberately kept apart from
 * view types (what the components render). Components never touch a
 * `WeatherSnapshot` directly — `toDashboardView` is the only bridge.
 */

// --- Transport ------------------------------------------------------------

export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export interface WeatherSnapshot {
  readonly location: string;
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly condition: string;
  readonly conditionKey: WeatherCondition;
  readonly weatherCode: number;
  readonly isDay: boolean;
  readonly high: number;
  readonly low: number;
  readonly precipitationProbability: number;
  readonly windSpeed: number;
  readonly updatedAt: string;
}

// --- View -----------------------------------------------------------------

/** The eight sprites in `lib/weather-icons`. */
export type WeatherIconKey =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'fog';

export interface StatTile {
  readonly label: string;
  readonly value: string;
  /** Palette accent, used as the tile's value colour. */
  readonly tone: 'amber' | 'cyan' | 'pink' | 'green';
}

export interface DashboardView {
  readonly location: string;
  readonly icon: WeatherIconKey;
  readonly temperature: string;
  readonly condition: string;
  readonly feelsLike: string;
  readonly tiles: readonly StatTile[];
  readonly updatedLabel: string;
}

// --- Errors ---------------------------------------------------------------

export type FailureKind = 'offline' | 'network' | 'server' | 'malformed';

export interface DashboardFailure {
  readonly kind: FailureKind;
  /** Short, screen-friendly text. Uppercase, no punctuation. */
  readonly message: string;
}

/** Nothing yet | showing data | failed with nothing to show. */
export type DashboardPhase = 'loading' | 'ready' | 'error';
