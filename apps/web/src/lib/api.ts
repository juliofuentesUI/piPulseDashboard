import type { DashboardFailure, WeatherCondition, WeatherSnapshot } from './types';

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
  'snow',
  'thunderstorm',
];

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
    CONDITIONS.includes(v['conditionKey'] as WeatherCondition)
  );
}
