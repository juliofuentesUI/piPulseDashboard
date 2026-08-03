import type { TrendDetailView, TrendingSearch, TrendRowView } from './types';
import { formatClock, relativeTime } from './view';

/** How many of the feed's trends the band has room for at 720 x 720. */
export const VISIBLE_TRENDS = 5;

/**
 * Shortest bar the screen will draw, as a percentage. A trend Google listed is
 * a trend; a bar that rounds away to nothing would read as missing data.
 */
const MIN_BAR = 12;

export function toTrendRows(trends: readonly TrendingSearch[]): TrendRowView[] {
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
