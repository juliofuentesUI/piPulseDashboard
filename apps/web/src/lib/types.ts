/**
 * Transport types (what `/api/weather` sends) are deliberately kept apart from
 * view types (what the components render). Components never touch a
 * `WeatherSnapshot` directly — `toDashboardView` is the only bridge.
 */

// --- Transport ------------------------------------------------------------

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

export type ForecastPeriod = 'midday' | 'evening';

/** The three time-of-day columns of the 7-day table. */
export type DayPeriod = 'morning' | 'midday' | 'evening';

export interface ForecastPoint {
  readonly period: ForecastPeriod;
  readonly time: string;
  /** Days ahead of today: 0 = today, 1 = tomorrow. */
  readonly dayOffset: number;
  readonly temperature: number;
  readonly condition: string;
  readonly conditionKey: WeatherCondition;
  readonly weatherCode: number;
  readonly isDay: boolean;
  readonly precipitationProbability: number;
}

/** One cell of the 7-day table. */
export interface DayPeriodPoint {
  readonly period: DayPeriod;
  readonly time: string;
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
  /** Days ahead of today: 0 = today. */
  readonly dayOffset: number;
  /** Morning, midday, evening in display order; null where the series has a hole. */
  readonly periods: readonly (DayPeriodPoint | null)[];
  readonly precipitationProbability: number;
}

export interface WeatherSnapshot {
  readonly location: string;
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly condition: string;
  readonly conditionKey: WeatherCondition;
  readonly weatherCode: number;
  readonly isDay: boolean;
  readonly high: number;
  readonly low: number;
  readonly precipitationProbability: number;
  readonly windSpeed: number;
  readonly forecast: readonly ForecastPoint[];
  /** Seven rows for the 7-day table, starting with today. */
  readonly week: readonly DayForecast[];
  readonly updatedAt: string;
}

// --- View -----------------------------------------------------------------

/** The sprites in `lib/weather-icons`. */
export type WeatherIconKey =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'fog'
  | 'wind';

/** One of the three forecast columns, ready to render. */
export interface ColumnView {
  /** NOW / MIDDAY / EVENING. */
  readonly label: string;
  /** Clock time beneath the label. Empty for NOW, which is simply "now". */
  readonly time: string;
  /** Null when the period has no reading, so the column renders an empty slot. */
  readonly icon: WeatherIconKey | null;
  /** Bare number, or "--" when there is no reading. The column adds the degree sign. */
  readonly temperature: string;
  readonly condition: string;
}

export interface MetricView {
  readonly label: string;
  readonly value: string;
  /** Small trailing unit, set apart from the value. */
  readonly unit: string;
  readonly icon: 'umbrella' | 'wind';
}

export interface DashboardView {
  readonly location: string;
  /** Exactly three: now, midday, evening. */
  readonly columns: readonly ColumnView[];
  /** Exactly two: rain chance, wind. */
  readonly metrics: readonly MetricView[];
  /** The 7-day table, rendered by the other screen from the same snapshot. */
  readonly week: WeekView;
}

/** One icon-and-temperature cell of the 7-day table. */
export interface DayCellView {
  /** Null when the period has no reading, so the cell renders empty. */
  readonly icon: WeatherIconKey | null;
  /** Bare number, or "--". The cell adds the degree sign. */
  readonly temperature: string;
}

/** One row of the 7-day table. */
export interface DayRowView {
  /** Stable key for the each-block: the row's local date. */
  readonly key: string;
  /** MON, TUE, ... */
  readonly weekday: string;
  /** Exactly three: morning, midday, evening. */
  readonly cells: readonly DayCellView[];
  /** Bare number; the cell adds the percent sign. */
  readonly rain: string;
  /** How many of the four dots are filled, 0-4. */
  readonly rainDots: number;
}

export interface WeekView {
  /** Column headings for the three periods, e.g. "9:00 AM". */
  readonly headings: readonly string[];
  /** Seven rows, starting with today. */
  readonly rows: readonly DayRowView[];
}

// --- Errors ---------------------------------------------------------------

export type FailureKind = 'offline' | 'network' | 'server' | 'malformed';

export interface DashboardFailure {
  readonly kind: FailureKind;
  /** Short, screen-friendly text. Uppercase, no punctuation. */
  readonly message: string;
}

/** Nothing yet | showing data | failed with nothing to show. */
export type DashboardPhase = 'loading' | 'ready' | 'error';

// --- Search Pulse ---------------------------------------------------------

/**
 * Mirrors the API's `TrendingSearch`. Optional fields are absent whenever the
 * official feed did not state them, and are never filled in downstream.
 */
export interface TrendingSearch {
  readonly id: string;
  readonly title: string;
  readonly approximateVolume?: string;
  readonly publishedAt?: string;
  readonly relatedQueries: readonly string[];
  readonly sourceUrl?: string;
}

export interface TrendsSnapshot {
  readonly region: string;
  readonly trends: readonly TrendingSearch[];
  /** When the list was retrieved from Google, not when we last polled the API. */
  readonly updatedAt: string;
}

/** One rendered row of the trend list. */
export interface TrendRowView {
  readonly id: string;
  readonly rank: string;
  readonly title: string;
  /** Google's bucket, compacted for the panel: "20K+". Empty if unstated. */
  readonly volume: string;
  /** Bar width as a percentage, on a log scale. */
  readonly bar: number;
}

/**
 * The details band for whichever trend is selected. Every field is either
 * something the feed stated or empty — there is no placeholder text here.
 */
export interface TrendDetailView {
  readonly title: string;
  /** Google's bucket, compacted. Empty when the feed stated none. */
  readonly volume: string;
  /** Wall clock of the feed's `pubDate`, e.g. "6:50 PM". Empty if unstated. */
  readonly firstReported: string;
  /** How long ago that was, e.g. "2 HRS AGO". Empty if unstated. */
  readonly age: string;
  /** Google first reported it under 30 minutes ago. */
  readonly isNew: boolean;
}
