import type { LocationConfig } from './config.js';
import type {
  OpenMeteoResponse,
  WeatherCondition,
  WeatherSnapshot,
} from './types.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/** Raised when the upstream provider is unreachable or answers with nonsense. */
export class WeatherUnavailableError extends Error {
  override readonly name = 'WeatherUnavailableError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export function buildRequestUrl(location: LocationConfig): URL {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('timezone', location.timezone);
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
  );
  url.searchParams.set('hourly', 'precipitation_probability');
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('forecast_days', '1');
  return url;
}

export async function fetchWeather(
  location: LocationConfig,
  timeoutMs: number,
): Promise<WeatherSnapshot> {
  const url = buildRequestUrl(location);

  let payload: unknown;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new WeatherUnavailableError(
        `Open-Meteo responded ${response.status} ${response.statusText}`,
      );
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof WeatherUnavailableError) throw error;
    throw new WeatherUnavailableError('Could not reach Open-Meteo', { cause: error });
  }

  assertOpenMeteoResponse(payload);
  return normalize(payload, location);
}

// --- Normalisation --------------------------------------------------------

export function normalize(
  raw: OpenMeteoResponse,
  location: LocationConfig,
): WeatherSnapshot {
  const { key, label } = describeWeatherCode(raw.current.weather_code);

  return {
    location: location.name,
    temperature: Math.round(raw.current.temperature_2m),
    apparentTemperature: Math.round(raw.current.apparent_temperature),
    condition: label,
    conditionKey: key,
    weatherCode: raw.current.weather_code,
    isDay: raw.current.is_day === 1,
    high: Math.round(raw.daily.temperature_2m_max[0] ?? raw.current.temperature_2m),
    low: Math.round(raw.daily.temperature_2m_min[0] ?? raw.current.temperature_2m),
    precipitationProbability: currentPrecipitationProbability(raw),
    windSpeed: Math.round(raw.current.wind_speed_10m),
    updatedAt: toOffsetIso(Date.now(), raw.utc_offset_seconds),
  };
}

/**
 * Open-Meteo only reports precipitation probability hourly, so we line the
 * current timestamp up with the hourly series and fall back to today's max.
 */
function currentPrecipitationProbability(raw: OpenMeteoResponse): number {
  const currentHour = `${raw.current.time.slice(0, 13)}:00`;
  const index = raw.hourly.time.indexOf(currentHour);
  const hourly = index === -1 ? undefined : raw.hourly.precipitation_probability[index];
  const value = hourly ?? raw.daily.precipitation_probability_max[0] ?? 0;
  return clamp(Math.round(value), 0, 100);
}

/** Maps a WMO weather code to the icon bucket and label the UI renders. */
export function describeWeatherCode(code: number): {
  key: WeatherCondition;
  label: string;
} {
  switch (code) {
    case 0:
      return { key: 'clear', label: 'CLEAR' };
    case 1:
      return { key: 'clear', label: 'MOSTLY CLEAR' };
    case 2:
      return { key: 'partly-cloudy', label: 'PARTLY CLOUDY' };
    case 3:
      return { key: 'cloudy', label: 'OVERCAST' };
    case 45:
      return { key: 'fog', label: 'FOG' };
    case 48:
      return { key: 'fog', label: 'FREEZING FOG' };
    case 51:
    case 53:
    case 55:
      return { key: 'drizzle', label: 'DRIZZLE' };
    case 56:
    case 57:
      return { key: 'drizzle', label: 'FREEZING DRIZZLE' };
    case 61:
      return { key: 'rain', label: 'LIGHT RAIN' };
    case 63:
      return { key: 'rain', label: 'RAIN' };
    case 65:
      return { key: 'rain', label: 'HEAVY RAIN' };
    case 66:
    case 67:
      return { key: 'rain', label: 'FREEZING RAIN' };
    case 71:
      return { key: 'snow', label: 'LIGHT SNOW' };
    case 73:
      return { key: 'snow', label: 'SNOW' };
    case 75:
      return { key: 'snow', label: 'HEAVY SNOW' };
    case 77:
      return { key: 'snow', label: 'SNOW GRAINS' };
    case 80:
    case 81:
      return { key: 'rain', label: 'SHOWERS' };
    case 82:
      return { key: 'rain', label: 'HEAVY SHOWERS' };
    case 85:
    case 86:
      return { key: 'snow', label: 'SNOW SHOWERS' };
    case 95:
      return { key: 'thunderstorm', label: 'THUNDERSTORM' };
    case 96:
    case 99:
      return { key: 'thunderstorm', label: 'HAILSTORM' };
    default:
      return { key: 'cloudy', label: 'UNKNOWN' };
  }
}

/** Formats an instant in the location's local time, e.g. 2026-07-30T01:00:00-07:00. */
export function toOffsetIso(epochMs: number, offsetSeconds: number): string {
  const local = new Date(epochMs + offsetSeconds * 1000).toISOString().slice(0, 19);
  const sign = offsetSeconds < 0 ? '-' : '+';
  const absolute = Math.abs(offsetSeconds);
  const hours = String(Math.floor(absolute / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((absolute % 3600) / 60)).padStart(2, '0');
  return `${local}${sign}${hours}:${minutes}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// --- Runtime validation ---------------------------------------------------
// Hand-rolled rather than pulling in a schema library for one endpoint.

function assertOpenMeteoResponse(value: unknown): asserts value is OpenMeteoResponse {
  if (!isRecord(value)) {
    throw new WeatherUnavailableError('Open-Meteo returned a non-object payload');
  }

  if (typeof value['utc_offset_seconds'] !== 'number') {
    fail('utc_offset_seconds');
  }

  const current = value['current'];
  if (
    !isRecord(current) ||
    typeof current['time'] !== 'string' ||
    typeof current['temperature_2m'] !== 'number' ||
    typeof current['apparent_temperature'] !== 'number' ||
    typeof current['weather_code'] !== 'number' ||
    typeof current['wind_speed_10m'] !== 'number' ||
    (current['is_day'] !== 0 && current['is_day'] !== 1)
  ) {
    fail('current');
  }

  const hourly = value['hourly'];
  if (
    !isRecord(hourly) ||
    !isArrayOf(hourly['time'], (item): item is string => typeof item === 'string') ||
    !isArrayOf(
      hourly['precipitation_probability'],
      (item): item is number | null => item === null || typeof item === 'number',
    )
  ) {
    fail('hourly');
  }

  const daily = value['daily'];
  if (
    !isRecord(daily) ||
    !isArrayOf(daily['temperature_2m_max'], isNumber) ||
    !isArrayOf(daily['temperature_2m_min'], isNumber) ||
    !isArrayOf(
      daily['precipitation_probability_max'],
      (item): item is number | null => item === null || typeof item === 'number',
    )
  ) {
    fail('daily');
  }
}

function fail(field: string): never {
  throw new WeatherUnavailableError(`Open-Meteo payload is missing or malformed: ${field}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(predicate);
}
