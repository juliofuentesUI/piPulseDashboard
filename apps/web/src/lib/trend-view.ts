import type {
  SparklineView,
  TrendCardView,
  TrendDetailView,
  TrendHistory,
  TrendHistoryView,
  TrendingSearch,
  TrendRowView,
} from './types';
import { formatClock, relativeTime } from './view';

/** How many of the feed's trends the band has room for at 720 x 720. */
export const VISIBLE_TRENDS = 5;

/**
 * Shortest bar the screen will draw, as a percentage. A trend Google listed is
 * a trend; a bar that rounds away to nothing would read as missing data.
 */
const MIN_BAR = 12;

export function toTrendRows(
  trends: readonly TrendingSearch[],
  now: Date,
): TrendRowView[] {
  const shown = trends.slice(0, VISIBLE_TRENDS);
  const values = shown.map((trend) => volumeOf(trend.approximateVolume));
  const stated = values.filter((value) => value > 0);
  const max = Math.max(0, ...stated);
  const min = stated.length === 0 ? 0 : Math.min(...stated);

  return shown.map((trend, index) => ({
    id: trend.id,
    rank: String(index + 1),
    title: trend.title.toUpperCase(),
    volume: formatVolume(trend.approximateVolume),
    age: trend.publishedAt === undefined ? '' : shortAgo(trend.publishedAt, now),
    bar: barWidth(values[index] ?? 0, min, max),
  }));
}

/**
 * Bar length on a log scale spanning the list's own range.
 *
 * Linear is useless here: Google's buckets routinely span two orders of
 * magnitude in one list — 200+ alongside 20000+ — so the biggest trend would
 * pin the scale and flatten every other bar to a stub.
 *
 * Log against a fixed origin turns out just as useless in the other
 * direction. When a list happens to run 200+ to 2000+, `log(v)/log(max)` puts
 * a tenfold gap at 70% against 100%: every bar nearly full, nothing to read.
 * The origin at 1 is arbitrary anyway — Google never reports a bucket that
 * small. Anchoring the scale to the smallest bucket *present* is what makes
 * the difference between the rows legible, whatever the day's range.
 *
 * The cost is that the shortest bar looks the same whatever its absolute
 * figure. That is the honest trade for a five-row list: the bar ranks, and
 * Google's own number sits beside it for anyone reading the value.
 */
function barWidth(value: number, min: number, max: number): number {
  // No figure stated for this trend, so there is nothing to draw to scale.
  if (value <= 0) return MIN_BAR;
  // One bucket in the list, or every trend in the same one: all bars equal.
  if (max <= min) return 100;

  const fraction = (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return clamp(Math.round(MIN_BAR + fraction * (100 - MIN_BAR)), MIN_BAR, 100);
}

/**
 * The numeric floor of one of Google's buckets: "20000+" is 20000.
 *
 * Used only to size a bar. It is a lower bound on a range, never a count of
 * searches, and nothing on the screen presents it as one.
 */
export function volumeOf(raw: string | undefined): number {
  if (raw === undefined) return 0;

  const match = /(\d[\d.,]*)\s*([km])?/i.exec(raw);
  if (match === null) return 0;

  const digits = Number.parseFloat((match[1] ?? '').replace(/,/g, ''));
  if (!Number.isFinite(digits)) return 0;

  const suffix = match[2]?.toLowerCase();
  return digits * (suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1);
}

/**
 * Google's own figure, compacted to fit the row: "20000+" becomes "20K+".
 *
 * The trailing "+" is carried over only when the feed wrote one, because it is
 * what marks the number as the bottom of a bucket rather than a total.
 */
export function formatVolume(raw: string | undefined): string {
  if (raw === undefined) return '';

  const value = volumeOf(raw);
  if (value <= 0) return '';

  return `${compact(value)}${raw.includes('+') ? '+' : ''}`;
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${round1(value / 1_000_000)}M`;
  if (value >= 1_000) return `${round1(value / 1_000)}K`;
  return String(Math.round(value));
}

function round1(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * How recently Google must have first reported a trend for it to count as new.
 *
 * The plan words this rule as "first observed less than 30 minutes ago". Until
 * Phase 3 stores snapshots there is no record of when *we* first saw a trend,
 * so it is measured against the feed's own `pubDate` instead: Google's report
 * time, which is exact, needs no storage, and does not reset when the Pi does.
 */
const NEW_WITHIN_MS = 30 * 60 * 1000;

export function toTrendDetail(trend: TrendingSearch, now: Date): TrendDetailView {
  const published =
    trend.publishedAt === undefined ? null : new Date(trend.publishedAt);
  const known = published !== null && !Number.isNaN(published.getTime());

  return {
    title: trend.title.toUpperCase(),
    volume: formatVolume(trend.approximateVolume),
    firstReported: known ? formatClock(published) : '',
    age: known ? relativeTime(trend.publishedAt as string, now) : '',
    isNew: known && now.getTime() - published.getTime() < NEW_WITHIN_MS,
  };
}

/**
 * The card view: what the feed says the selected search is *about*.
 *
 * Every headline the feed carried is passed through, in the feed's order and
 * with its own wording. Picking one would be a claim about which story the
 * trend is really about, and the feed shows why that claim fails — a broad
 * query like `artificial intelligence news` comes back with three unrelated
 * stories, so the first one is not the trend, it is a third of it. Where the
 * three agree you learn the event; where they diverge you learn the query is
 * broad, and the divergence is itself the information.
 */
export function toTrendCard(trend: TrendingSearch, now: Date): TrendCardView {
  const detail = toTrendDetail(trend, now);

  return {
    title: detail.title,
    volume: detail.volume,
    // The header runs the figure and the age together on one line, so it takes
    // the row's short form — "2H AGO" rather than the panel's "2 HRS AGO".
    age: trend.publishedAt === undefined ? '' : shortAgo(trend.publishedAt, now),
    isNew: detail.isNew,
    imageUrl: trend.imageUrl ?? '',
    imageSource: (trend.imageSource ?? '').toUpperCase(),
    headlines: (trend.news ?? []).map((item, index) => ({
      key: String(index),
      // Not uppercased, unlike everything else on this screen. These are
      // sentences of someone else's prose quoted verbatim, and a hundred
      // characters of capitals is both harder to read and less faithful.
      text: item.title,
      source: (item.source ?? '').toUpperCase(),
      host: hostOf(item.url),
    })),
  };
}

/**
 * The domain of an article, e.g. "wkrc.com", with a leading `www.` dropped.
 *
 * Shown as text beside the outlet's name rather than made tappable: a tap on a
 * wall-mounted kiosk navigates away from the dashboard with no way back, and
 * the full URL is far too long for the card. Empty for anything unparseable,
 * which is the same treatment every other unstated field gets.
 */
export function hostOf(url: string | undefined): string {
  if (url === undefined) return '';

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const REGION_NAMES: Readonly<Record<string, string>> = {
  US: 'UNITED STATES',
};

/**
 * Spells out the region the API says the list is for. Unknown codes are shown
 * as themselves rather than guessed at, and nothing is claimed before the
 * first response arrives — the client does not know the region until then.
 */
export function regionName(code: string | undefined): string {
  if (code === undefined) return '';
  return REGION_NAMES[code] ?? code.toUpperCase();
}

// --- Local history --------------------------------------------------------

/** The window the graph covers. Matches `HISTORY_WINDOW_MS` in the API. */
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The rank space the axis spans, which is the length of the list Google
 * returns. Fixed rather than scaled to whatever the trend happened to do:
 * a search that only ever wobbled between #8 and #9 should read as a flat
 * line near the bottom, not as dramatic movement across a zoomed axis.
 */
const RANK_SPACE = 10;

const SPARK_WIDTH = 250;
const SPARK_HEIGHT = 76;

/** Half the side of an observation marker, in the same design pixels. */
const MARKER = 3;

/**
 * Narrowest the axis will get: one refresh interval, which is the smallest
 * gap two observations can genuinely have.
 *
 * This was an hour to begin with, and an hour was wrong. A trend observed for
 * twenty-four minutes then drew into the right 40% with the left half blank —
 * which reads as missing data rather than as "we started watching recently",
 * and is the same unreadable crowding a fixed 24-hour axis produced. The floor
 * exists only so a single observation has a span to sit in.
 */
const MIN_WINDOW_MS = 10 * 60 * 1000;

export function toSparkline(
  history: TrendHistory,
  nowMs: number,
): SparklineView | null {
  if (history.points.length === 0) return null;

  const stamps = history.points
    .map((point) => Date.parse(point.at))
    .filter((at) => !Number.isNaN(at));
  if (stamps.length === 0) return null;

  /*
   * The axis spans the history that exists, capped at 24 hours — not a fixed
   * 24 hours always.
   *
   * A trend four hours old plotted on a fixed day-wide axis draws into the
   * rightmost sixth and is unreadable, and most trends are hours old, so that
   * would be the normal case rather than the edge one. Stretching to fit is
   * only honest if the axis says what it covers, so the label carries the real
   * span and the graph is titled from it.
   */
  const oldest = Math.min(...stamps);
  const spanMs = Math.max(
    MIN_WINDOW_MS,
    Math.min(HISTORY_WINDOW_MS, nowMs - oldest),
  );

  const dots = history.points
    .map((point) => {
      const at = Date.parse(point.at);
      if (Number.isNaN(at)) return null;

      const elapsed = clamp((nowMs - at) / spanMs, 0, 1);
      const rank = clamp(point.rank, 1, RANK_SPACE);

      /*
       * Inset by the marker's half-width at both ends. The newest observation
       * sits at the right edge by definition, and without this its mark is
       * drawn half outside the plot.
       */
      const span = SPARK_WIDTH - MARKER * 2;

      return {
        x: Math.round(MARKER + span * (1 - elapsed)),
        y: Math.round(((rank - 1) / (RANK_SPACE - 1)) * SPARK_HEIGHT),
      };
    })
    .filter((dot): dot is { x: number; y: number } => dot !== null);

  if (dots.length === 0) return null;

  return {
    width: SPARK_WIDTH,
    height: SPARK_HEIGHT,
    path: dots.map((dot) => `${dot.x},${dot.y}`).join(' '),
    dots,
    topLabel: '1',
    bottomLabel: String(RANK_SPACE),
    windowLabel: coarseDuration(Math.round(spanMs / 60_000)),
    // The axis start, not the first observation: with the floor applied the
    // two differ, and the label has to describe the axis it sits under.
    startLabel: formatClock(new Date(nowMs - spanMs)),
    endLabel: 'NOW',
  };
}

export function toTrendHistoryView(
  history: TrendHistory,
  now: Date,
): TrendHistoryView {
  return {
    sparkline: toSparkline(history, now.getTime()),
    firstSeen:
      history.firstSeenAt === undefined ? '' : durationAgo(history.firstSeenAt, now),
    peakRank: history.peakRank === undefined ? '' : `#${history.peakRank}`,
    latestRank: history.latestRank === undefined ? '' : `#${history.latestRank}`,
    // Bare number: the panel labels this row FETCHES, so repeating the word
    // in the value only cost the column the room it needed.
    observed: history.timesObserved === 0 ? '' : String(history.timesObserved),
    movement: history.movement,
  };
}

/**
 * "2H 20M AGO", keeping the minutes that `relativeTime` drops.
 *
 * On this screen the difference matters: the weather's "2 HRS AGO" is about a
 * reading that is either current or not, while here it is how long a search
 * has been holding public attention.
 */
export function durationAgo(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  return `${formatDuration(minutes)} AGO`;
}

/**
 * The axis label's version of a duration: "4H", not "4H 2M".
 *
 * An axis states the scale, and stating it to the minute implies the graph is
 * readable to the minute, which at 250 pixels for four hours it is not.
 */
function coarseDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(5, Math.round(minutes / 5) * 5)}M`;
  return `${Math.round(minutes / 60)}H`;
}

/**
 * "2H AGO", "35M AGO" — the row's version, kept short because it shares a
 * line with the search term and Google's figure.
 */
export function shortAgo(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  if (minutes < 60) return `${minutes}M AGO`;
  return `${Math.floor(minutes / 60)}H AGO`;
}

/** "45M", "2H 20M", "1D 3H". */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}M`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes === 0 ? `${hours}H` : `${hours}H ${minutes}M`;

  const days = Math.floor(hours / 24);
  const spare = hours % 24;
  return spare === 0 ? `${days}D` : `${days}D ${spare}H`;
}

// --- Ordering -------------------------------------------------------------

/**
 * How the list is ordered. Both are properties the feed genuinely carries;
 * Google's own "relevance" ordering is not among them, because the RSS export
 * has no such field and their ranking is not published. Inventing a score and
 * calling it relevance would put Google's name on our arithmetic.
 */
export type PulseMode = 'surging' | 'biggest';

export const PULSE_MODES: readonly { id: PulseMode; name: string }[] = [
  { id: 'surging', name: 'SURGING' },
  { id: 'biggest', name: 'BIGGEST' },
];

/**
 * `surging` is the feed's own order, which is strictly newest-detected first —
 * verified against the live feed, where the largest trend routinely sits at
 * position six. `biggest` re-sorts by Google's volume figure so the number
 * beside a row means what a rank normally means.
 *
 * The sort is stable and the input arrives newest-first, so trends sharing a
 * volume bucket stay in recency order within it.
 */
export function orderTrends(
  trends: readonly TrendingSearch[],
  mode: PulseMode,
): readonly TrendingSearch[] {
  if (mode === 'surging') return trends;
  return [...trends].sort(
    (a, b) => volumeOf(b.approximateVolume) - volumeOf(a.approximateVolume),
  );
}
