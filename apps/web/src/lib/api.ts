import type {
  DashboardFailure,
  ForecastPeriod,
  ForecastPoint,
  TrendingSearch,
  TrendsSnapshot,
  WeatherCondition,
  WeatherSnapshot,
} from './types';

/** A fetch failure already translated into something the screen can show. */
export class WeatherRequestError extends Error {
  readonly failure: DashboardFailure;

  constructor(failure: DashboardFailure, options?: { cause?: unknown }) {
    super(failure.message, options);
    this.name = 'WeatherRequestError';
    this.failure = failure;
  }
}

const CONDITIONS: readonly WeatherCondition[] = [
  'clear',
  'partly-cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'heavy-rain',
  'snow',
  'thunderstorm',
];

const PERIODS: readonly ForecastPeriod[] = ['midday', 'evening'];

/**
 * Calls the local Fastify endpoint. The path stays relative so Vite's proxy
 * decides which port to hit — nothing here knows about port 3000.
 */
export async function requestWeather(signal: AbortSignal): Promise<WeatherSnapshot> {
  if (!navigator.onLine) {
    throw new WeatherRequestError({ kind: 'offline', message: 'NO NETWORK' });
  }

  let response: Response;
  try {
    response = await fetch('/api/weather', {
      signal,
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new WeatherRequestError(
      { kind: 'network', message: 'CANNOT REACH API' },
      { cause: error },
    );
  }

  if (!response.ok) {
    // 502/504 come from the dev proxy when Fastify itself is not listening;
    // 503 is Fastify telling us the weather provider failed.
    if (response.status === 502 || response.status === 504) {
      throw new WeatherRequestError({ kind: 'network', message: 'CANNOT REACH API' });
    }
    throw new WeatherRequestError({
      kind: 'server',
      message: response.status === 503 ? 'WEATHER SOURCE DOWN' : `API ERROR ${response.status}`,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new WeatherRequestError(
      { kind: 'malformed', message: 'BAD RESPONSE' },
      { cause: error },
    );
  }

  if (!isWeatherSnapshot(payload)) {
    throw new WeatherRequestError({ kind: 'malformed', message: 'BAD RESPONSE' });
  }
  return payload;
}

function isWeatherSnapshot(value: unknown): value is WeatherSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['location'] === 'string' &&
    typeof v['temperature'] === 'number' &&
    typeof v['apparentTemperature'] === 'number' &&
    typeof v['condition'] === 'string' &&
    typeof v['weatherCode'] === 'number' &&
    typeof v['isDay'] === 'boolean' &&
    typeof v['high'] === 'number' &&
    typeof v['low'] === 'number' &&
    typeof v['precipitationProbability'] === 'number' &&
    typeof v['windSpeed'] === 'number' &&
    typeof v['updatedAt'] === 'string' &&
    CONDITIONS.includes(v['conditionKey'] as WeatherCondition) &&
    Array.isArray(v['forecast']) &&
    v['forecast'].every(isForecastPoint)
  );
}

function isForecastPoint(value: unknown): value is ForecastPoint {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['time'] === 'string' &&
    typeof v['dayOffset'] === 'number' &&
    typeof v['temperature'] === 'number' &&
    typeof v['condition'] === 'string' &&
    typeof v['weatherCode'] === 'number' &&
    typeof v['isDay'] === 'boolean' &&
    typeof v['precipitationProbability'] === 'number' &&
    PERIODS.includes(v['period'] as ForecastPeriod) &&
    CONDITIONS.includes(v['conditionKey'] as WeatherCondition)
  );
}

// --- Search Pulse ---------------------------------------------------------

/** A trends fetch failure, already translated into something the screen can show. */
export class TrendsRequestError extends Error {
  readonly failure: DashboardFailure;

  constructor(failure: DashboardFailure, options?: { cause?: unknown }) {
    super(failure.message, options);
    this.name = 'TrendsRequestError';
    this.failure = failure;
  }
}

/**
 * Asks *our* service for the cached list. The client never talks to Google:
 * the feed is unauthenticated and rate-limited by IP, and one browser refresh
 * costing an upstream request is exactly what the backend cache exists to
 * prevent.
 */
export async function requestTrends(signal: AbortSignal): Promise<TrendsSnapshot> {
  if (!navigator.onLine) {
    throw new TrendsRequestError({ kind: 'offline', message: 'NO NETWORK' });
  }

  let response: Response;
  try {
    response = await fetch('/api/trends/now', {
      signal,
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TrendsRequestError(
      { kind: 'network', message: 'CANNOT REACH API' },
      { cause: error },
    );
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 504) {
      throw new TrendsRequestError({ kind: 'network', message: 'CANNOT REACH API' });
    }
    throw new TrendsRequestError({
      kind: 'server',
      message: response.status === 503 ? 'TRENDS SOURCE DOWN' : `API ERROR ${response.status}`,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new TrendsRequestError(
      { kind: 'malformed', message: 'BAD RESPONSE' },
      { cause: error },
    );
  }

  if (!isTrendsSnapshot(payload)) {
    throw new TrendsRequestError({ kind: 'malformed', message: 'BAD RESPONSE' });
  }
  return payload;
}

function isTrendsSnapshot(value: unknown): value is TrendsSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['region'] === 'string' &&
    typeof v['updatedAt'] === 'string' &&
    Array.isArray(v['trends']) &&
    v['trends'].every(isTrendingSearch)
  );
}

/**
 * Only `id`, `title` and `relatedQueries` are required, matching the API: the
 * rest are absent whenever Google did not state them, and an absent field is
 * the normal case rather than a malformed payload.
 */
function isTrendingSearch(value: unknown): value is TrendingSearch {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['title'] === 'string' &&
    Array.isArray(v['relatedQueries']) &&
    v['relatedQueries'].every((q) => typeof q === 'string') &&
    isOptionalString(v['approximateVolume']) &&
    isOptionalString(v['publishedAt']) &&
    isOptionalString(v['sourceUrl'])
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
