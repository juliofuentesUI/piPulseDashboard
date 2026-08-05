/** Runtime configuration, resolved once at import time from the environment. */

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value;
}

/** Anything but an explicit "false"/"0"/"off" is on, so a typo fails safe. */
function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return !['false', '0', 'off', 'no'].includes(value.trim().toLowerCase());
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
  /** SQLite file for the local history, resolved against the API's cwd. */
  readonly databasePath: string;
}

/**
 * Semantic categorisation of trends, which is the one thing here that costs
 * money and talks to a third party.
 *
 * There is no `enabled: true` by default anywhere in this block, and that is
 * deliberate: with no key nothing is constructed, nothing is called and the
 * dashboard runs exactly as it did before this existed. "Works with it off" is
 * the default path rather than a branch someone has to remember to test.
 */
export interface CategoriesConfig {
  /** Absent unless set. Its absence is the off switch. */
  readonly apiKey: string;
  /** An explicit off switch for keeping the key but stopping the calls. */
  readonly enabled: boolean;
  readonly model: string;
  /**
   * How hard the model may think. `minimal` measured 10x cheaper than the
   * default with identical answers on everything unambiguous — GPT-5 models
   * bill reasoning as output, and this task's evidence is all in the prompt.
   */
  readonly reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  readonly requestTimeoutMs: number;
}

/**
 * The events map: what is on near the dashboard, as pins.
 *
 * `provider` is the switch the whole feature turns on. It defaults to `mock`
 * because SerpApi's Google Events engine has returned nothing since 2026-08-04
 * and a default that silently spends a 250-a-month quota on empty responses
 * would be the wrong one — see `docs/events-map-plan.md`.
 *
 * **Mock data must be visibly labelled on screen.** `EventsSnapshot.source`
 * carries the answer to the browser for exactly that reason.
 */
export interface EventsConfig {
  /** `mock` or `serpapi`. Anything unrecognised falls back to `mock`. */
  readonly provider: 'mock' | 'serpapi';
  /** Backend-only, never logged, never sent to the browser. */
  readonly serpApiKey: string;
  /** Backend-only. The browser gets `VITE_MAPTILER_KEY` for tiles instead. */
  readonly mapTilerKey: string;
  /** How far out an event may be and still appear. The user chose 20. */
  readonly radiusMiles: number;
  /**
   * How often the backend asks upstream. A day, because seven queries daily is
   * ~217 searches against a 250 free tier, and events do not turn over hourly.
   */
  readonly cacheTtlMs: number;
  readonly requestTimeoutMs: number;
  readonly geocodeTimeoutMs: number;
  /**
   * How far out a geocoding result may land before it is treated as nonsense.
   * Separate from `radiusMiles`, which is what the screen shows.
   */
  readonly geocodeSanityMiles: number;
  /** SQLite file for the permanent address-to-coordinate cache. */
  readonly databasePath: string;
  /** SerpApi's `location` parameter. Not the same thing as the map centre. */
  readonly searchLocation: string;
  /** The seven searches, run once per refresh. */
  readonly queries: readonly string[];
}

export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly location: LocationConfig;
  readonly cacheTtlMs: number;
  readonly requestTimeoutMs: number;
  readonly trends: TrendsConfig;
  readonly categories: CategoriesConfig;
  readonly events: EventsConfig;
}

/**
 * The seven searches. Overlapping on purpose — deduplication merges what they
 * share, and the overlap is what stops a single phrasing deciding the whole
 * screen's contents.
 */
const DEFAULT_EVENT_QUERIES: readonly string[] = [
  'events near San Jose CA',
  'farmers markets and street fairs near San Jose CA',
  'free community events near San Jose CA',
  'live music and nightlife near San Jose CA',
  'art museum and cultural events near San Jose CA',
  'food festivals and pop-up events near San Jose CA',
  'tech meetups and networking events near San Jose CA',
];

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
    databasePath: str(process.env['TRENDS_DB_PATH'], 'data/trends.db'),
  },
  categories: {
    apiKey: str(process.env['OPENAI_API_KEY'], ''),
    enabled: bool(process.env['TRENDS_CATEGORY_ENABLED'], true),
    model: str(process.env['TRENDS_CATEGORY_MODEL'], 'gpt-5-nano'),
    reasoningEffort: reasoning(process.env['TRENDS_CATEGORY_EFFORT']),
    requestTimeoutMs: num(process.env['TRENDS_CATEGORY_TIMEOUT_MS'], 30_000),
  },
  events: {
    provider: provider(process.env['EVENTS_PROVIDER']),
    serpApiKey: str(process.env['SERPAPI_KEY'], ''),
    mapTilerKey: str(process.env['MAPTILER_KEY'], ''),
    radiusMiles: num(process.env['EVENTS_RADIUS_MILES'], 20),
    cacheTtlMs: num(process.env['EVENTS_CACHE_TTL_MS'], 24 * 60 * 60 * 1000),
    requestTimeoutMs: num(process.env['EVENTS_REQUEST_TIMEOUT_MS'], 15_000),
    geocodeTimeoutMs: num(process.env['EVENTS_GEOCODE_TIMEOUT_MS'], 8000),
    geocodeSanityMiles: num(process.env['EVENTS_GEOCODE_SANITY_MILES'], 150),
    databasePath: str(process.env['EVENTS_DB_PATH'], 'data/events.db'),
    searchLocation: str(
      process.env['EVENTS_SEARCH_LOCATION'],
      'San Jose, California, United States',
    ),
    queries: list(process.env['EVENTS_QUERIES']) ?? DEFAULT_EVENT_QUERIES,
  },
};

/**
 * Defaults to `mock`, and an unrecognised value falls back to it too.
 *
 * Failing towards the provider that costs nothing is the safe direction: a typo
 * in `EVENTS_PROVIDER` shows fabricated events clearly labelled as such, rather
 * than quietly spending a quota that bills for empty responses.
 */
function provider(value: string | undefined): EventsConfig['provider'] {
  return (value ?? '').trim().toLowerCase() === 'serpapi' ? 'serpapi' : 'mock';
}

/** A `|`-separated override for the query list, or undefined to use the default. */
function list(value: string | undefined): readonly string[] | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parts = value
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return parts.length === 0 ? undefined : parts;
}

/** Falls back to `minimal` rather than the model's default, which is expensive. */
function reasoning(value: string | undefined): CategoriesConfig['reasoningEffort'] {
  const asked = (value ?? '').trim().toLowerCase();
  return asked === 'low' || asked === 'medium' || asked === 'high' ? asked : 'minimal';
}
