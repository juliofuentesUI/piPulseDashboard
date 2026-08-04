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

/** The three time-of-day columns of the 7-day table. */
export type DayPeriod = 'morning' | 'midday' | 'evening';

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

/**
 * One cell of the 7-day table: a single hourly reading, at a fixed local hour.
 *
 * Deliberately thinner than `ForecastPoint` — a table cell is an icon and a
 * number, so it carries no per-hour rain figure. The row's own
 * `precipitationProbability` covers the whole day instead.
 */
export interface DayPeriodPoint {
  readonly period: DayPeriod;
  /** ISO 8601 with the location's UTC offset, e.g. "2026-08-04T09:00:00-07:00". */
  readonly time: string;
  /** Whole degrees Fahrenheit. */
  readonly temperature: number;
  readonly condition: string;
  readonly conditionKey: WeatherCondition;
  readonly weatherCode: number;
  readonly isDay: boolean;
}

/** One row of the 7-day table. */
export interface DayForecast {
  /** Local calendar date, "YYYY-MM-DD". */
  readonly date: string;
  /** Days ahead of the current local date: 0 = today. */
  readonly dayOffset: number;
  /**
   * Morning, midday and evening in display order. An entry is null when the
   * hourly series cannot supply that hour — today's row loses the periods that
   * have already gone by, which is why the table has to tolerate holes.
   */
  readonly periods: readonly (DayPeriodPoint | null)[];
  /** Percent, 0-100: the day's highest hourly probability. */
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
  /**
   * Seven rows for the 7-day table, starting with today. Independent of
   * `forecast` above: that one rolls a period forward to tomorrow once it has
   * passed, which is right for a three-column "what's next" strip and wrong for
   * a table whose rows are dated.
   */
  readonly week: readonly DayForecast[];
  /** ISO 8601 with the location's UTC offset, e.g. "2026-07-30T01:00:00-07:00". */
  readonly updatedAt: string;
}

// --- Trends contract ------------------------------------------------------

/**
 * One article the feed associates with a trend.
 *
 * News *about* the search, never another search. How Google decides which
 * articles belong to a query is not published, so nothing here describes a
 * mechanism for it, and nothing downstream may summarise or interpret a
 * headline — it is quoted verbatim with its outlet named, or it is left out.
 */
export interface TrendNewsItem {
  /** The headline, exactly as the feed words it. */
  readonly title: string;
  /** The outlet that published it, e.g. "Reuters". */
  readonly source?: string;
  /** The article itself. Absent unless the feed states an http(s) URL. */
  readonly url?: string;
}

/**
 * What a trend is about, as inferred by a model from its headlines.
 *
 * **The one value in this file that Google did not supply.** Everything else on
 * a trend row is the feed's wording or arithmetic over stored rows; this is a
 * reading, and it can simply be wrong. The badge is drawn as a notched plate
 * for exactly that reason, and the legend says so in words.
 *
 * A string rather than a union, because the closed set lives in
 * `categorise.ts` and the web app has its own copy of these shapes — a union
 * here would have to be kept identical in three places to add one category.
 * The set is enforced where it is decided and where it is stored.
 */
export type TrendCategory = string;

/**
 * One trending search: what the official feed states, plus one thing it does
 * not.
 *
 * Every optional field is absent rather than guessed when Google does not
 * supply it. That rule still holds for all of them **except `category`**, which
 * is ours and is marked as such wherever it appears. It was worth breaking the
 * "feed only" framing of this type rather than bolting on a parallel map that
 * every caller would have to join by hand — but the distinction is real and the
 * screen has to keep making it.
 */
export interface TrendingSearch {
  /** Normalised form of the title. Stable across fetches; see `trendKey`. */
  readonly id: string;
  /** The search itself, as Google words it. */
  readonly title: string;
  /**
   * Google's own approximation, verbatim — "200+", "20000+". A lower bound on
   * a bucket, never an exact count, so it stays a string and keeps its "+".
   */
  readonly approximateVolume?: string;
  /** ISO 8601, from the item's `pubDate`. Absent if that date will not parse. */
  readonly publishedAt?: string;
  /**
   * Other searches Google associates with this one. The Trending Now RSS feed
   * does not carry them, so this provider always returns an empty array — see
   * the note in `trends.ts`.
   */
  readonly relatedQueries: readonly string[];
  /** A page about this trend, when the feed names one per item. */
  readonly sourceUrl?: string;
  /**
   * The thumbnail the feed picked for this trend, on Google's image CDN.
   * Absent when the item names none.
   */
  readonly imageUrl?: string;
  /** The outlet that thumbnail came from, e.g. "Reuters". */
  readonly imageSource?: string;
  /**
   * Articles the feed associates with this trend — three per item in practice,
   * though nothing requires that. Empty when the item carries none, the same
   * way `relatedQueries` is empty rather than absent.
   */
  readonly news: readonly TrendNewsItem[];
  /**
   * Ours, not Google's — see `TrendCategory`. Absent when the trend has not
   * been categorised: no key configured, the model could not place it, or it
   * simply has not been asked about yet. All three draw no badge.
   */
  readonly category?: TrendCategory;
}

/**
 * Whether categorising is working, so the panel can say why there are no
 * badges instead of leaving it to be guessed.
 *
 * Four states look identical from across a room — no key configured, the key
 * rejected, a batch still in flight, and everything fine on trends that are
 * simply new. Only one of those is healthy, and on a wall display with no
 * keyboard there was previously no way to tell them apart. That was reported
 * as the feature being "inconsistent", which is exactly what it looks like.
 */
export interface TrendCategoriesStatus {
  /**
   * `off`    — no key, or explicitly disabled. Nothing is ever called.
   * `halted` — the account was rejected; stopped until restart.
   * `ready`  — working. `pending` may still be non-zero while a batch runs.
   */
  readonly state: 'off' | 'halted' | 'ready';
  /** Trends in this list with no category yet. Zero when everything is badged. */
  readonly pending: number;
}

export interface TrendsSnapshot {
  /** Google region code the list was fetched for, e.g. "US". */
  readonly region: string;
  /** Highest-ranked first, in the order the feed lists them. */
  readonly trends: readonly TrendingSearch[];
  /**
   * ISO 8601 instant this list was actually retrieved from Google — not when
   * the client last asked us for it. A screen reporting freshness has to
   * report the data's age, and those two numbers diverge every time we serve
   * from cache.
   */
  readonly updatedAt: string;
  /** Why there are or are not badges. Never absent; see the type. */
  readonly categories: TrendCategoriesStatus;
}

/** One stored observation: where a trend sat at one moment. */
export interface TrendHistoryPoint {
  /** ISO 8601 instant the list was fetched. */
  readonly at: string;
  /** 1 is the top of the list. */
  readonly rank: number;
  /**
   * Google's bucket as stated at *this* observation, verbatim — "20000+".
   * Absent when the feed stated none for it then.
   *
   * Every fetch is stored as its own row, so this is the figure at that
   * moment rather than the trend's largest. Reading them in order is the only
   * way to see a search climb, and the only way to see it fall back.
   */
  readonly volume?: string;
  /** Position in the feed at that moment. Arrival order, never popularity. */
  readonly feedRank?: number;
}

/**
 * Rank direction, from a documented rule over stored observations. `steady`
 * also covers "not enough history to say", which is the honest answer for a
 * trend seen once.
 */
export type TrendMovement = 'rising' | 'cooling' | 'steady';

/**
 * What the local record knows about one trend. Every figure is counted from
 * observations this Pi made; none of it comes from Google.
 */
export interface TrendHistory {
  readonly trendKey: string;
  /** Oldest first, within the history window. Empty when never observed. */
  readonly points: readonly TrendHistoryPoint[];
  readonly timesObserved: number;
  readonly movement: TrendMovement;
  /** All-time, not windowed. Absent when never observed. */
  readonly firstSeenAt?: string;
  readonly latestRank?: number;
  /** Best position ever held, so the *lowest* rank number. */
  readonly peakRank?: number;
  /** First to most recent observation. Not a claim of continuous presence. */
  readonly activeMinutes?: number;
}

/**
 * One trend's showing over a single day, counted from stored observations.
 *
 * Every figure here is ours. Google supplies the volume bucket and nothing
 * else on this record: the ranks, the counts and the durations are arithmetic
 * over rows this Pi wrote, which is the only reason a day view is allowed to
 * exist at all under the no-inference rule.
 */
export interface TrendDayEntry {
  readonly trendKey: string;
  /** The title as most recently stored, so a re-worded trend reads current. */
  readonly title: string;
  /**
   * The largest bucket Google stated for it during the day, verbatim —
   * "20000+". Absent when the feed stated none on any observation.
   */
  readonly peakVolume?: string;
  /**
   * When *Google* says it detected the trend, from the feed's `pubDate`.
   *
   * Different from `firstSeenAt`, which is when this machine next polled and
   * happened to meet it — measured at 13-23 minutes later in steady state, and
   * hours later after any gap in collection. Absent on rows written before the
   * column existed; never back-filled, because we do not know what it said.
   */
  readonly reportedAt?: string;
  /**
   * The headlines the feed carried for this trend, as last recorded.
   *
   * Stored only when they change, so this may come from a row written before
   * the day began — which is the point: the feed drops a trend after a couple
   * of hours, and without a stored copy a day view could never say what any of
   * its trends were actually about. Quoted verbatim with the outlet named,
   * never summarised. Absent for trends recorded before the column existed.
   */
  readonly news?: readonly TrendNewsItem[];
  /**
   * Best standing **by volume within a single fetch** it reached that day, so
   * 1 is the top. The same ranking the graph plots, never feed position.
   */
  readonly peakRank: number;
  /** How many fetches it appeared in that day. */
  readonly timesObserved: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  /**
   * First to last sighting within the day. Presence in between is not
   * checked, so this is a span, never a claim of continuous presence.
   */
  readonly activeMinutes: number;
  /**
   * Ours, not Google's — see `TrendCategory`. Decided once when the trend was
   * first seen and read back here, never recomputed for the day view.
   */
  readonly category?: TrendCategory;
}

/**
 * A calendar day of stored trends, ranked by an explicit local rule.
 *
 * This answers "what caught fire today", not "what were the day's biggest
 * searches" — the feed only ever shows a trend during its first hours, so the
 * volumes here are the ones it carried while young, never the accumulated
 * totals `trends.google.com` reports for a day-old trend. Those two questions
 * sound the same and are not, and the screen must not blur them.
 */
export interface TrendDay {
  /** Local midnight that began the day, as an instant. */
  readonly startsAt: string;
  /** The moment the digest was taken — the day so far, not a whole day. */
  readonly endsAt: string;
  /** IANA zone the day boundary was drawn in, e.g. "America/Los_Angeles". */
  readonly timezone: string;
  /** Ranked best first, already trimmed to what the caller asked for. */
  readonly entries: readonly TrendDayEntry[];
  /** Distinct trends recorded in the day, which may exceed `entries.length`. */
  readonly trendCount: number;
  /** Fetches recorded in the day. */
  readonly fetchCount: number;
}

export interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}
