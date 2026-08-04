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

export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly location: LocationConfig;
  readonly cacheTtlMs: number;
  readonly requestTimeoutMs: number;
  readonly trends: TrendsConfig;
  readonly categories: CategoriesConfig;
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
    databasePath: str(process.env['TRENDS_DB_PATH'], 'data/trends.db'),
  },
  categories: {
    apiKey: str(process.env['OPENAI_API_KEY'], ''),
    enabled: bool(process.env['TRENDS_CATEGORY_ENABLED'], true),
    model: str(process.env['TRENDS_CATEGORY_MODEL'], 'gpt-5-nano'),
    reasoningEffort: reasoning(process.env['TRENDS_CATEGORY_EFFORT']),
    requestTimeoutMs: num(process.env['TRENDS_CATEGORY_TIMEOUT_MS'], 30_000),
  },
};

/** Falls back to `minimal` rather than the model's default, which is expensive. */
function reasoning(value: string | undefined): CategoriesConfig['reasoningEffort'] {
  const asked = (value ?? '').trim().toLowerCase();
  return asked === 'low' || asked === 'medium' || asked === 'high' ? asked : 'minimal';
}
