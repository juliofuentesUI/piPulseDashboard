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
  | 'heavy-rain'
  | 'snow'
  | 'thunderstorm';

export type ForecastPeriod = 'midday' | 'evening';

export interface ForecastPoint {
  readonly period: ForecastPeriod;
  readonly time: string;
  /** Days ahead of today: 0 = today, 1 = tomorrow. */
  readonly dayOffset: number;
  readonly temperature: number;
  readonly condition: string;
  readonly conditionKey: WeatherCondition;
  readonly weatherCode: number;
  readonly isDay: boolean;
  readonly precipitationProbability: number;
}

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
  readonly forecast: readonly ForecastPoint[];
  readonly updatedAt: string;
}

// --- View -----------------------------------------------------------------

/** The sprites in `lib/weather-icons`. */
export type WeatherIconKey =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'fog'
  | 'wind';

/** One of the three forecast columns, ready to render. */
export interface ColumnView {
  /** NOW / MIDDAY / EVENING. */
  readonly label: string;
  /** Clock time beneath the label. Empty for NOW, which is simply "now". */
  readonly time: string;
  /** Null when the period has no reading, so the column renders an empty slot. */
  readonly icon: WeatherIconKey | null;
  /** Bare number, or "--" when there is no reading. The column adds the degree sign. */
  readonly temperature: string;
  readonly condition: string;
}

export interface MetricView {
  readonly label: string;
  readonly value: string;
  /** Small trailing unit, set apart from the value. */
  readonly unit: string;
  readonly icon: 'umbrella' | 'wind';
}

export interface DashboardView {
  readonly location: string;
  /** Exactly three: now, midday, evening. */
  readonly columns: readonly ColumnView[];
  /** Exactly two: rain chance, wind. */
  readonly metrics: readonly MetricView[];
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
