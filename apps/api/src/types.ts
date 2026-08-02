/**
 * Two distinct type families live here:
 *
 *  - `OpenMeteo*` mirrors the upstream provider's wire format. It is only ever
 *    used between `fetch()` and normalisation, and never leaves this service.
 *  - `WeatherSnapshot` is our own contract, returned by `GET /api/weather`.
 *    The web app has its own copy of this shape; changing one means changing
 *    both on purpose.
 */

// --- Upstream (Open-Meteo) ------------------------------------------------

export interface OpenMeteoCurrent {
  readonly time: string;
  readonly temperature_2m: number;
  readonly apparent_temperature: number;
  readonly is_day: 0 | 1;
  readonly weather_code: number;
  readonly wind_speed_10m: number;
}

export interface OpenMeteoHourly {
  readonly time: readonly string[];
  readonly temperature_2m: readonly number[];
  readonly weather_code: readonly number[];
  readonly is_day: readonly number[];
  readonly precipitation_probability: readonly (number | null)[];
}

export interface OpenMeteoDaily {
  readonly time: readonly string[];
  readonly temperature_2m_max: readonly number[];
  readonly temperature_2m_min: readonly number[];
  readonly precipitation_probability_max: readonly (number | null)[];
}

export interface OpenMeteoResponse {
  readonly utc_offset_seconds: number;
  readonly timezone: string;
  readonly current: OpenMeteoCurrent;
  readonly hourly: OpenMeteoHourly;
  readonly daily: OpenMeteoDaily;
}

// --- Our contract ---------------------------------------------------------

/** Visual buckets the UI knows how to draw. Derived from a WMO weather code. */
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

/** The two look-ahead columns on the dashboard, beside the current reading. */
export type ForecastPeriod = 'midday' | 'evening';

/** A single hourly forecast the dashboard renders as one column. */
export interface ForecastPoint {
  readonly period: ForecastPeriod;
  /** ISO 8601 with the location's UTC offset, e.g. "2026-08-01T13:00:00-07:00". */
  readonly time: string;
  /** Days ahead of the current local date: 0 = today, 1 = tomorrow. */
  readonly dayOffset: number;
  /** Whole degrees Fahrenheit. */
  readonly temperature: number;
  readonly condition: string;
  readonly conditionKey: WeatherCondition;
  readonly weatherCode: number;
  readonly isDay: boolean;
  /** Percent, 0-100, for this hour specifically. */
  readonly precipitationProbability: number;
}

export interface WeatherSnapshot {
  /** Human-readable place name, e.g. "San Jose". */
  readonly location: string;
  /** Whole degrees Fahrenheit. */
  readonly temperature: number;
  readonly apparentTemperature: number;
  /** Short label for display, e.g. "CLEAR". */
  readonly condition: string;
  /** Machine-readable bucket used to pick an icon. */
  readonly conditionKey: WeatherCondition;
  /** Raw WMO code, kept so the client can be smarter later without an API change. */
  readonly weatherCode: number;
  /** True between local sunrise and sunset; selects day vs night artwork. */
  readonly isDay: boolean;
  readonly high: number;
  readonly low: number;
  /**
   * Percent, 0-100. The *highest* hourly probability over the next
   * `RAIN_WINDOW_HOURS`, not the current minute — one number on a wall display
   * should answer "will I need an umbrella today".
   */
  readonly precipitationProbability: number;
  /** Miles per hour. */
  readonly windSpeed: number;
  /**
   * Look-ahead points, in display order. Normally `[midday, evening]`; a
   * period is omitted if the hourly series cannot supply it.
   */
  readonly forecast: readonly ForecastPoint[];
  /** ISO 8601 with the location's UTC offset, e.g. "2026-07-30T01:00:00-07:00". */
  readonly updatedAt: string;
}

export interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}
