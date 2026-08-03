/** Runtime configuration, resolved once at import time from the environment. */

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value;
}

export interface LocationConfig {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

export interface TrendsConfig {
  /** Google region code for the feed, e.g. "US". */
  readonly region: string;
  /**
   * How often the *backend* asks Google for a new list. The screen polls this
   * service far more often than this; that is the point of the number.
   */
  readonly cacheTtlMs: number;
  readonly requestTimeoutMs: number;
}

export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly location: LocationConfig;
  readonly cacheTtlMs: number;
  readonly requestTimeoutMs: number;
  readonly trends: TrendsConfig;
}

export const config: AppConfig = {
  port: num(process.env['PORT'], 3000),
  host: str(process.env['HOST'], '0.0.0.0'),
  location: {
    name: str(process.env['WEATHER_LOCATION_NAME'], 'San Jose'),
    latitude: num(process.env['WEATHER_LATITUDE'], 37.3382),
    longitude: num(process.env['WEATHER_LONGITUDE'], -121.8863),
    timezone: str(process.env['WEATHER_TIMEZONE'], 'America/Los_Angeles'),
  },
  cacheTtlMs: num(process.env['WEATHER_CACHE_TTL_MS'], 5 * 60 * 1000),
  requestTimeoutMs: num(process.env['WEATHER_REQUEST_TIMEOUT_MS'], 8000),
  trends: {
    region: str(process.env['TRENDS_REGION'], 'US'),
    cacheTtlMs: num(process.env['TRENDS_CACHE_TTL_MS'], 10 * 60 * 1000),
    requestTimeoutMs: num(process.env['TRENDS_REQUEST_TIMEOUT_MS'], 8000),
  },
};
