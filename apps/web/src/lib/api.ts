import type {
  DashboardFailure,
  EventsSnapshot,
  LocalEvent,
  ForecastPeriod,
  ForecastPoint,
  TrendDay,
  TrendDayEntry,
  TrendHistory,
  TrendingSearch,
  TrendMovement,
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
export async function requestTrends(
  signal: AbortSignal,
  options?: { readonly force?: boolean },
): Promise<TrendsSnapshot> {
  if (!navigator.onLine) {
    throw new TrendsRequestError({ kind: 'offline', message: 'NO NETWORK' });
  }

  let response: Response;
  try {
    // `?refresh=1` asks the backend to drop its cache. It enforces its own
    // floor on how often that is honoured, because the feed being protected is
    // Google's and the browser is in no position to police it.
    response = await fetch(
      options?.force === true ? '/api/trends/now?refresh=1' : '/api/trends/now',
      { signal, headers: { accept: 'application/json' } },
    );
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
    isOptionalString(v['sourceUrl']) &&
    isOptionalString(v['imageUrl']) &&
    isOptionalString(v['imageSource']) &&
    isNewsList(v['news'])
  );
}

/**
 * Absent is acceptable, unlike `relatedQueries`.
 *
 * An API build that predates the trend card should cost the card its
 * headlines and nothing more. Requiring the field would turn that into a
 * malformed payload and take the whole live list down with it.
 */
function isNewsList(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;

  return value.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const news = item as Record<string, unknown>;
    return (
      typeof news['title'] === 'string' &&
      isOptionalString(news['source']) &&
      isOptionalString(news['url'])
    );
  });
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

/**
 * The Pi's own record for one trend. Separate from `/api/trends/now` because
 * only the selected trend needs it, and it is a local SQLite read rather than
 * anything upstream — a tap costs nothing outside the machine.
 */
export async function requestTrendHistory(
  key: string,
  signal: AbortSignal,
): Promise<TrendHistory> {
  let response: Response;
  try {
    response = await fetch(`/api/trends/history?key=${encodeURIComponent(key)}`, {
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
    throw new TrendsRequestError({
      kind: 'server',
      message: response.status === 503 ? 'NO HISTORY STORE' : `API ERROR ${response.status}`,
    });
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isTrendHistory(payload)) {
    throw new TrendsRequestError({ kind: 'malformed', message: 'BAD RESPONSE' });
  }
  return payload;
}

/**
 * The Pi's record for the whole day, already ranked by the API.
 *
 * Ranked there rather than here on purpose: the ordering is a documented rule
 * over stored rows, and the rows are in SQLite. Sorting in the browser would
 * mean shipping the day's history to it and keeping a second copy of the rule.
 */
export async function requestTrendDay(signal: AbortSignal): Promise<TrendDay> {
  let response: Response;
  try {
    response = await fetch('/api/trends/today', {
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
    throw new TrendsRequestError({
      kind: 'server',
      message: response.status === 503 ? 'NO HISTORY STORE' : `API ERROR ${response.status}`,
    });
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isTrendDay(payload)) {
    throw new TrendsRequestError({ kind: 'malformed', message: 'BAD RESPONSE' });
  }
  return payload;
}

function isTrendDay(value: unknown): value is TrendDay {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['startsAt'] === 'string' &&
    typeof v['endsAt'] === 'string' &&
    typeof v['timezone'] === 'string' &&
    typeof v['trendCount'] === 'number' &&
    typeof v['fetchCount'] === 'number' &&
    Array.isArray(v['entries']) &&
    v['entries'].every(isTrendDayEntry)
  );
}

function isTrendDayEntry(value: unknown): value is TrendDayEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['trendKey'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['peakRank'] === 'number' &&
    typeof v['timesObserved'] === 'number' &&
    typeof v['firstSeenAt'] === 'string' &&
    typeof v['lastSeenAt'] === 'string' &&
    typeof v['activeMinutes'] === 'number' &&
    // Absent whenever Google stated no bucket, which is the normal case for a
    // trend that never grew — not a malformed payload.
    isOptionalString(v['peakVolume']) &&
    // Absent on rows written before the column existed, so an API newer than
    // the database is a normal state rather than a broken response.
    isOptionalString(v['reportedAt']) &&
    isNewsList(v['news'])
  );
}

function isTrendHistory(value: unknown): value is TrendHistory {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['trendKey'] === 'string' &&
    typeof v['timesObserved'] === 'number' &&
    MOVEMENTS.includes(v['movement'] as TrendMovement) &&
    Array.isArray(v['points']) &&
    v['points'].every((p) => {
      if (typeof p !== 'object' || p === null) return false;
      const point = p as Record<string, unknown>;
      return typeof point['at'] === 'string' && typeof point['rank'] === 'number';
    })
  );
}

const MOVEMENTS: readonly TrendMovement[] = ['rising', 'cooling', 'steady'];

// --- Events map -----------------------------------------------------------

/** A fetch failure already translated into something the screen can show. */
export class EventsRequestError extends Error {
  readonly failure: DashboardFailure;

  constructor(failure: DashboardFailure, options?: { cause?: unknown }) {
    super(failure.message, options);
    this.name = 'EventsRequestError';
    this.failure = failure;
  }
}

/**
 * Nearby events, already normalised, deduplicated, geocoded and distance-cut by
 * the backend.
 *
 * The page never learns which provider produced these beyond
 * `snapshot.source` — and it needs that only so it can say when the data is
 * fabricated.
 */
export async function requestEvents(signal: AbortSignal): Promise<EventsSnapshot> {
  if (!navigator.onLine) {
    throw new EventsRequestError({ kind: 'offline', message: 'NO NETWORK' });
  }

  let response: Response;
  try {
    response = await fetch('/api/events', {
      signal,
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new EventsRequestError(
      { kind: 'network', message: 'CANNOT REACH API' },
      { cause: error },
    );
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 504) {
      throw new EventsRequestError({ kind: 'network', message: 'CANNOT REACH API' });
    }
    throw new EventsRequestError({
      kind: 'server',
      message: response.status === 503 ? 'EVENTS SOURCE DOWN' : `API ERROR ${response.status}`,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new EventsRequestError(
      { kind: 'malformed', message: 'BAD RESPONSE' },
      { cause: error },
    );
  }

  if (!isEventsSnapshot(payload)) {
    throw new EventsRequestError({ kind: 'malformed', message: 'BAD RESPONSE' });
  }
  return payload;
}

/*
 * Hand-rolled, like every other validator here. An empty `events` array is
 * valid and means "nothing is on" — which since 2026-08-04 is also what a
 * working SerpApi call looks like, so it must never read as a malformed
 * response.
 */
function isEventsSnapshot(value: unknown): value is EventsSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['updatedAt'] === 'string' &&
    (v['source'] === 'mock' || v['source'] === 'serpapi') &&
    typeof v['radiusMiles'] === 'number' &&
    isEventCenter(v['center']) &&
    isEventCounts(v['counts']) &&
    Array.isArray(v['events']) &&
    v['events'].every(isLocalEvent)
  );
}

function isEventCenter(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['name'] === 'string' &&
    typeof v['latitude'] === 'number' &&
    typeof v['longitude'] === 'number'
  );
}

function isEventCounts(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['total'] === 'number' &&
    typeof v['pinned'] === 'number' &&
    typeof v['unpinned'] === 'number'
  );
}

function isLocalEvent(value: unknown): value is LocalEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['title'] === 'string' &&
    // `when` is the honest field and is always present, even when the date
    // could not be parsed into an instant.
    typeof v['when'] === 'string' &&
    Array.isArray(v['links']) &&
    Array.isArray(v['queries']) &&
    isOptionalString(v['startsAt']) &&
    isOptionalString(v['venue']) &&
    isOptionalString(v['address']) &&
    isEventCoordinates(v['coordinates'])
  );
}

/** Absent is valid and means the event is listed but not pinned. */
function isEventCoordinates(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['latitude'] === 'number' && typeof v['longitude'] === 'number';
}
