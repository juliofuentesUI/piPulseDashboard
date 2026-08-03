import type { LocationConfig } from './config.js';
import type {
  DayForecast,
  DayPeriod,
  DayPeriodPoint,
  ForecastPeriod,
  ForecastPoint,
  OpenMeteoResponse,
  WeatherCondition,
  WeatherSnapshot,
} from './types.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * A week of hourly data. Seven fills the 7-day table starting today, and the
 * spare days past tomorrow also give the rolling `forecast` strip somewhere to
 * land when an evening reading late at night rolls forward.
 */
const FORECAST_DAYS = 7;

/** How many rows the 7-day table renders, today included. */
const WEEK_DAYS = 7;

/** Local hour each dashboard column aims at. */
const PERIOD_HOURS: Readonly<Record<ForecastPeriod, number>> = {
  midday: 13,
  evening: 19,
};

const PERIODS: readonly ForecastPeriod[] = ['midday', 'evening'];

/** Local hour each column of the 7-day table aims at. */
const DAY_PERIOD_HOURS: Readonly<Record<DayPeriod, number>> = {
  morning: 9,
  midday: 13,
  evening: 19,
};

const DAY_PERIODS: readonly DayPeriod[] = ['morning', 'midday', 'evening'];

/** How far ahead the single rain number looks. */
const RAIN_WINDOW_HOURS = 12;

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
  url.searchParams.set(
    'hourly',
    'temperature_2m,weather_code,is_day,precipitation_probability',
  );
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('forecast_days', String(FORECAST_DAYS));
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
    precipitationProbability: upcomingPrecipitationProbability(raw),
    windSpeed: Math.round(raw.current.wind_speed_10m),
    forecast: buildForecast(raw),
    week: buildWeek(raw),
    updatedAt: toOffsetIso(Date.now(), raw.utc_offset_seconds),
  };
}

// --- Look-ahead columns ---------------------------------------------------

function buildForecast(raw: OpenMeteoResponse): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  for (const period of PERIODS) {
    const point = forecastPoint(raw, period);
    if (point !== null) points.push(point);
  }
  return points;
}

function forecastPoint(
  raw: OpenMeteoResponse,
  period: ForecastPeriod,
): ForecastPoint | null {
  const index = selectHour(raw, PERIOD_HOURS[period]);
  if (index === -1) return null;

  const time = raw.hourly.time[index];
  const temperature = raw.hourly.temperature_2m[index];
  const code = raw.hourly.weather_code[index];
  if (time === undefined || temperature === undefined || code === undefined) {
    return null;
  }

  const { key, label } = describeWeatherCode(code);
  return {
    period,
    time: `${time}:00${offsetSuffix(raw.utc_offset_seconds)}`,
    dayOffset: daysBetween(raw.current.time, time),
    temperature: Math.round(temperature),
    condition: label,
    conditionKey: key,
    weatherCode: code,
    isDay: raw.hourly.is_day[index] === 1,
    precipitationProbability: clamp(
      Math.round(raw.hourly.precipitation_probability[index] ?? 0),
      0,
      100,
    ),
  };
}

/**
 * Finds the hourly entry for `hour` on the soonest day where it has not
 * already gone by, compared at hour rather than minute granularity.
 *
 * So at 13:40 the midday column still shows today's 13:00; from 14:00 it rolls
 * to tomorrow, and `dayOffset` tells the client to label it as such. Open-Meteo
 * timestamps are fixed-width local ISO strings, so comparing them as strings is
 * the same as comparing them as instants.
 */
function selectHour(raw: OpenMeteoResponse, hour: number): number {
  const currentHour = `${raw.current.time.slice(0, 13)}:00`;
  const target = String(hour).padStart(2, '0');

  for (let i = 0; i < raw.hourly.time.length; i += 1) {
    const stamp = raw.hourly.time[i];
    if (stamp === undefined || stamp.slice(11, 13) !== target) continue;
    if (stamp >= currentHour) return i;
  }
  return -1;
}

// --- The 7-day table ------------------------------------------------------

/**
 * One row per local date, each carrying the three fixed hours the table's
 * columns show.
 *
 * Rows are dated rather than relative, so today's row keeps its morning and
 * midday cells after those hours have gone by. The hourly series still holds
 * them — it starts at local midnight — and a hole punched in the first row
 * would read as missing data rather than as elapsed time.
 */
function buildWeek(raw: OpenMeteoResponse): DayForecast[] {
  const today = raw.current.time.slice(0, 10);
  const byTime = new Map<string, number>();
  for (let i = 0; i < raw.hourly.time.length; i += 1) {
    const stamp = raw.hourly.time[i];
    if (stamp !== undefined) byTime.set(stamp, i);
  }

  const rows: DayForecast[] = [];
  for (let day = 0; day < raw.daily.time.length && rows.length < WEEK_DAYS; day += 1) {
    const date = raw.daily.time[day];
    // Guards against a provider that ever starts the series before today.
    if (date === undefined || date < today) continue;

    rows.push({
      date,
      dayOffset: daysBetween(today, date),
      periods: DAY_PERIODS.map((period) => dayPoint(raw, byTime, date, period)),
      precipitationProbability: clamp(
        Math.round(raw.daily.precipitation_probability_max[day] ?? 0),
        0,
        100,
      ),
    });
  }
  return rows;
}

function dayPoint(
  raw: OpenMeteoResponse,
  byTime: ReadonlyMap<string, number>,
  date: string,
  period: DayPeriod,
): DayPeriodPoint | null {
  const hour = String(DAY_PERIOD_HOURS[period]).padStart(2, '0');
  const index = byTime.get(`${date}T${hour}:00`);
  if (index === undefined) return null;

  const temperature = raw.hourly.temperature_2m[index];
  const code = raw.hourly.weather_code[index];
  if (temperature === undefined || code === undefined) return null;

  const { key, label } = describeWeatherCode(code);
  return {
    period,
    time: `${date}T${hour}:00:00${offsetSuffix(raw.utc_offset_seconds)}`,
    temperature: Math.round(temperature),
    condition: label,
    conditionKey: key,
    weatherCode: code,
    isDay: raw.hourly.is_day[index] === 1,
  };
}

/** Whole days between the date halves of two local ISO timestamps. */
function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

/**
 * The screen has room for one rain number, so it reports the worst hour in the
 * near future rather than the current one — a dry minute with a downpour due at
 * four o'clock should not read as 0%.
 */
function upcomingPrecipitationProbability(raw: OpenMeteoResponse): number {
  const currentHour = `${raw.current.time.slice(0, 13)}:00`;
  const start = raw.hourly.time.findIndex((stamp) => stamp >= currentHour);

  if (start !== -1) {
    const end = Math.min(start + RAIN_WINDOW_HOURS, raw.hourly.time.length);
    let highest = -1;
    for (let i = start; i < end; i += 1) {
      const value = raw.hourly.precipitation_probability[i];
      if (typeof value === 'number' && value > highest) highest = value;
    }
    if (highest >= 0) return clamp(Math.round(highest), 0, 100);
  }

  // Nothing usable in the hourly series; today's headline figure will do.
  return clamp(Math.round(raw.daily.precipitation_probability_max[0] ?? 0), 0, 100);
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
      return { key: 'heavy-rain', label: 'HEAVY RAIN' };
    case 66:
      return { key: 'rain', label: 'FREEZING RAIN' };
    case 67:
      return { key: 'heavy-rain', label: 'FREEZING RAIN' };
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
      return { key: 'heavy-rain', label: 'HEAVY SHOWERS' };
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
  return `${local}${offsetSuffix(offsetSeconds)}`;
}

/** The trailing "+HH:MM" / "-HH:MM" of an ISO 8601 timestamp. */
export function offsetSuffix(offsetSeconds: number): string {
  const sign = offsetSeconds < 0 ? '-' : '+';
  const absolute = Math.abs(offsetSeconds);
  const hours = String(Math.floor(absolute / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((absolute % 3600) / 60)).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
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
    !isArrayOf(hourly['temperature_2m'], isNumber) ||
    !isArrayOf(hourly['weather_code'], isNumber) ||
    !isArrayOf(hourly['is_day'], isNumber) ||
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
    !isArrayOf(daily['time'], (item): item is string => typeof item === 'string') ||
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
