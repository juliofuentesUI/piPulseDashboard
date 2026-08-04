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

/** One article the feed associates with a trend. News about it, not a search. */
export interface TrendNewsItem {
  readonly title: string;
  readonly source?: string;
  readonly url?: string;
}

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
  readonly imageUrl?: string;
  readonly imageSource?: string;
  /**
   * Optional here where the API declares it required, on purpose: an API that
   * predates this field should cost the card its headlines, not cost the whole
   * screen its list by failing payload validation.
   */
  readonly news?: readonly TrendNewsItem[];
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
  /** How long ago Google reported it, e.g. "2H AGO". Empty if unstated. */
  readonly age: string;
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

/**
 * One headline on the trend card, ready to render.
 *
 * Quoted and attributed, never condensed. `host` is the article's domain shown
 * as plain text — the link is deliberately not tappable, because a tap on a
 * wall-mounted kiosk navigates away from the dashboard with no way back.
 */
export interface TrendHeadlineView {
  /** Stable key for the each-block: the headline's position in the feed. */
  readonly key: string;
  /** The headline, exactly as Google worded it. Never uppercased. */
  readonly text: string;
  /** The outlet, e.g. "REUTERS". Empty when the feed named none. */
  readonly source: string;
  /** The article's domain, e.g. "wkrc.com". Empty when the feed named none. */
  readonly host: string;
}

/**
 * The full-screen card for one trend: what the feed says the search is *about*.
 *
 * Every field is either something the feed stated or empty. A trend with no
 * picture and no headlines renders without them rather than with a placeholder.
 */
export interface TrendCardView {
  readonly title: string;
  /** Google's bucket, compacted. Empty when the feed stated none. */
  readonly volume: string;
  /** The row's short form, e.g. "2H AGO". Empty when unstated. */
  readonly age: string;
  /** Google first reported it under 30 minutes ago. */
  readonly isNew: boolean;
  /** The feed's thumbnail, on Google's image CDN. Empty when it named none. */
  readonly imageUrl: string;
  /** The outlet that picture came from. Empty when unstated. */
  readonly imageSource: string;
  /** Every headline the feed carried, in its order. Never trimmed to one. */
  readonly headlines: readonly TrendHeadlineView[];
}

/** One stored observation of where a trend sat. Mirrors the API. */
export interface TrendHistoryPoint {
  readonly at: string;
  readonly rank: number;
  /** Google's bucket at *this* observation, not the trend's largest. */
  readonly volume?: string;
  /** Feed position at that moment. Arrival order, never popularity. */
  readonly feedRank?: number;
}

export type TrendMovement = 'rising' | 'cooling' | 'steady';

/** What this Pi has recorded about one trend. Never sourced from Google. */
export interface TrendHistory {
  readonly trendKey: string;
  readonly points: readonly TrendHistoryPoint[];
  readonly timesObserved: number;
  readonly movement: TrendMovement;
  readonly firstSeenAt?: string;
  readonly latestRank?: number;
  readonly peakRank?: number;
  readonly activeMinutes?: number;
}

// --- The day's record -----------------------------------------------------

/** One trend's showing over a day, counted from stored rows. Mirrors the API. */
export interface TrendDayEntry {
  readonly trendKey: string;
  readonly title: string;
  /** The largest bucket Google stated that day, verbatim. Absent if it stated none. */
  readonly peakVolume?: string;
  /** Best standing by volume within a fetch, 1 being the top. */
  readonly peakRank: number;
  readonly timesObserved: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  /** First to last sighting. A span, never a claim of continuous presence. */
  readonly activeMinutes: number;
}

/** A calendar day of stored trends, as the API ranked them. */
export interface TrendDay {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly entries: readonly TrendDayEntry[];
  readonly trendCount: number;
  readonly fetchCount: number;
}

/** One rendered row of the TODAY list. */
export interface TrendDayRowView {
  /** Stable key for the each-block. */
  readonly key: string;
  readonly rank: string;
  readonly title: string;
  /** Google's biggest bucket that day, compacted: "20K+". Empty if unstated. */
  readonly volume: string;
  /** How long it stayed on the feed, e.g. "53M". Empty when never measurable. */
  readonly duration: string;
  /**
   * Where the trend sat in the day, as percentages of midnight-to-now: the
   * offset of its first sighting and the width of its run.
   *
   * This is a time axis, not a quantity — deliberately, and it replaced a
   * volume bar. Ranking by peak volume selects the day's biggest buckets, so
   * the ten rows routinely hold only two distinct values; on a log scale over
   * that range every row draws either full or at the 12% floor, which renders a
   * twofold difference as an eightfold one. The run is the honest thing to draw
   * here, and it is the one the screen's second question asks about.
   */
  readonly spanStart: number;
  readonly spanWidth: number;
}

/**
 * The TODAY view: the day so far, from this Pi's own record.
 *
 * `window` and `scope` exist so the screen can never overstate what it holds —
 * a day two hours old says so, and the row count is reported against how many
 * trends were actually seen rather than implying ten is all there were.
 */
export interface TrendDayView {
  /** The day's start on the wall clock, e.g. "SINCE 12:00 AM". */
  readonly window: string;
  /** What the day holds, e.g. "160 TRENDS · 41 FETCHES". */
  readonly scope: string;
  /** Left end of the run axis, e.g. "12:00 AM". Empty when there is no day. */
  readonly axisStart: string;
  /** Right end of it. Always the present moment. */
  readonly axisEnd: string;
  /**
   * Quarter-day gridlines along the run axis, as percentages — only the ones
   * the day has actually reached.
   *
   * They exist to stop the track reading as a bar that failed to fill. The
   * trend list's bar and this one share `.track`/`.fill` so the themes paint
   * both, but there they mean "how big" and grow from the left edge, while
   * here they mean "when" and float. Graduations are what tell the eye which
   * of the two it is looking at.
   */
  readonly marks: readonly number[];
  /** Ranked best first. Empty when the day has recorded nothing yet. */
  readonly rows: readonly TrendDayRowView[];
}

/** One stored observation, as the day modal lists it. */
export interface TrendObservationView {
  /** Stable key for the each-block: the observation's instant. */
  readonly key: string;
  /** Wall clock of that fetch, e.g. "12:05 AM". */
  readonly time: string;
  /** Google's bucket then, compacted: "10K+". Empty when it stated none. */
  readonly volume: string;
  /** Feed position then, e.g. "8". Empty when unknown. */
  readonly slot: string;
  /** True where this observation's bucket is larger than the one before it. */
  readonly rose: boolean;
}

/**
 * Everything the record holds about one of the day's trends.
 *
 * Opened from a TODAY row. Every field is counted from stored observations,
 * and the observation list is the raw rows themselves — which is the point of
 * the panel. The row above it can only show a peak and a span; the arc between
 * them, including a search falling back before climbing again, exists nowhere
 * else on the dashboard.
 */
export interface TrendDayDetailView {
  readonly title: string;
  /** Largest bucket that day, compacted. Empty when the feed stated none. */
  readonly volume: string;
  /** First sighting to last, e.g. "12:05 AM → 12:15 AM". */
  readonly ran: string;
  /** How long that was, e.g. "10M". Empty for a single sighting. */
  readonly duration: string;
  /** Fetches *within the day*, which is the window the summary describes. */
  readonly fetches: string;
  /** Best standing by volume within a fetch, e.g. "#1". */
  readonly bestRank: string;
  /**
   * When this machine first recorded the trend, ever — e.g. "SUN 11:03 PM".
   * Carries a weekday because it is often before the day being summarised,
   * which is what explains a log longer than the day's fetch count.
   */
  readonly firstSeen: string;
  /**
   * Oldest first, over a rolling 24 hours rather than the day — a wider window
   * than the summary above it, deliberately, because it is the trend's real
   * arc. Rows from before local midnight carry a weekday.
   */
  readonly observations: readonly TrendObservationView[];
  /** True once the lookup has answered, so the panel can say "nothing yet". */
  readonly loaded: boolean;
}

/** Sparkline geometry in design pixels, ready for the SVG to draw. */
export interface SparklineView {
  readonly width: number;
  readonly height: number;
  /** "x,y x,y …" for the polyline. */
  readonly path: string;
  /** Marker per observation, so a single reading is still visible. */
  readonly dots: readonly { readonly x: number; readonly y: number }[];
  readonly topLabel: string;
  readonly bottomLabel: string;
  /** The span the x-axis actually covers, e.g. "4H" — never more than 24H. */
  readonly windowLabel: string;
  /** Clock time at the left edge of the axis, e.g. "9:26 PM". */
  readonly startLabel: string;
  /** Right edge. Always the present moment. */
  readonly endLabel: string;
}

/** The history half of the details band. */
export interface TrendHistoryView {
  readonly sparkline: SparklineView | null;
  readonly firstSeen: string;
  readonly peakRank: string;
  readonly latestRank: string;
  readonly observed: string;
  readonly movement: TrendMovement;
}
