/**
 * The local record of what has been trending.
 *
 * Every successful fetch from Google is written here, so the Pi accumulates
 * its own history of public attention rather than only ever showing the
 * current minute. Nothing in this file interprets that history: it stores rank
 * observations and answers arithmetic questions about them.
 *
 * `node:sqlite` is built into Node, so this costs no dependency and, more to
 * the point, no native build on a Raspberry Pi. It needs Node 24 (or 22 with
 * `--experimental-sqlite`), which is why the deploy notes ask for 24.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type {
  TrendDay,
  TrendDayEntry,
  TrendNewsItem,
  TrendHistory,
  TrendHistoryPoint,
  TrendingSearch,
  TrendMovement,
} from './types.js';

/**
 * How far back the rank graph looks. Also the window the client draws, so
 * changing it here changes the axis there.
 */
export const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS trend_snapshots (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    trend_key          TEXT    NOT NULL,
    title              TEXT    NOT NULL,
    approximate_volume TEXT,
    rank               INTEGER NOT NULL,
    related_queries    TEXT    NOT NULL,
    first_seen_at      TEXT    NOT NULL,
    observed_at        TEXT    NOT NULL,
    published_at       TEXT,
    news               TEXT
  );

  CREATE INDEX IF NOT EXISTS trend_snapshots_key_time
    ON trend_snapshots (trend_key, observed_at);

  -- One row per trend per fetch. A retried write with the same timestamp is
  -- the same observation, not a second one, so it is dropped rather than
  -- inflating "times observed".
  CREATE UNIQUE INDEX IF NOT EXISTS trend_snapshots_once
    ON trend_snapshots (trend_key, observed_at);
`;

/**
 * A schema upgrade failed, as distinct from the disk being unusable.
 *
 * The two look identical from the screen — both end with no history — but they
 * need different fixes, and only one of them is our fault. Opening the store is
 * allowed to fail, so the caller catches either; this is what lets it say which
 * happened in the log rather than reporting a broken column as a broken card.
 */
export class SchemaMigrationError extends Error {
  constructor(step: string, options?: { cause?: unknown }) {
    super(`could not apply schema migration: ${step}`, options);
    this.name = 'SchemaMigrationError';
  }
}

export class TrendHistoryStore {
  readonly #db: DatabaseSync;

  /**
   * Migration steps this open actually applied, in order. Empty on every start
   * after the first — which is the normal case, and why the caller only logs
   * when there is something in it.
   */
  readonly migrationsApplied: readonly string[];

  constructor(path: string) {
    const file = resolve(path);
    mkdirSync(dirname(file), { recursive: true });

    this.#db = new DatabaseSync(file);
    // Survives an unclean power cut better than the default rollback journal,
    // which matters on a wall display that gets switched off at the socket.
    this.#db.exec('PRAGMA journal_mode = WAL');
    this.#db.exec(SCHEMA);
    this.migrationsApplied = this.#migrate();
  }

  /**
   * Brings an existing database up to the schema above, in place.
   *
   * `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists,
   * so a column added to it later never reaches a Pi that has been collecting
   * for weeks — and that history is the thing least worth losing. Each step
   * checks before it acts and is safe to run on every start.
   *
   * Rows written before a column existed keep NULL. They are not back-filled:
   * we do not know what Google said then, and inventing it would put a made-up
   * figure in the one place the whole screen's honesty rests on.
   */
  #migrate(): readonly string[] {
    const columns = this.#db.prepare('PRAGMA table_info(trend_snapshots)').all() as {
      name: string;
    }[];
    const present = new Set(columns.map((column) => column.name));

    /*
     * Every column this schema has gained since the first release, in the order
     * it gained them. `ADD COLUMN` is metadata-only in SQLite — it does not
     * rewrite a single row — so this stays instant whether the table holds a
     * hundred rows or a million.
     */
    const additions: readonly (readonly [string, string])[] = [
      ['published_at', 'TEXT'],
      ['news', 'TEXT'],
    ];

    const applied: string[] = [];
    for (const [name, type] of additions) {
      if (present.has(name)) continue;
      try {
        this.#db.exec(`ALTER TABLE trend_snapshots ADD COLUMN ${name} ${type}`);
      } catch (error) {
        throw new SchemaMigrationError(`add ${name}`, { cause: error });
      }
      applied.push(name);
    }
    return applied;
  }

  /**
   * Writes one row per trend for a single fetch.
   *
   * `first_seen_at` is carried on every row rather than looked up on read: it
   * is resolved once here against what is already stored, so it cannot drift
   * from the observations it summarises.
   */
  record(trends: readonly TrendingSearch[], observedAtMs: number): void {
    const observedAt = new Date(observedAtMs).toISOString();

    const earliest = this.#db.prepare(
      'SELECT MIN(observed_at) AS first FROM trend_snapshots WHERE trend_key = ?',
    );
    /*
     * The last headlines recorded for this trend, so an unchanged set can be
     * written as NULL instead of copied again.
     *
     * A trend sits in three to six fetches and its headlines rarely move
     * between them, so storing them on every row would be the same 639 bytes
     * repeated — measured at ~79 MB over 90 days against a database that is
     * otherwise ~26 MB. Writing only on change keeps the whole arc, including
     * a story whose coverage shifts while it trends, at roughly a tenth of it.
     */
    const lastNews = this.#db.prepare(`
      SELECT news FROM trend_snapshots
      WHERE trend_key = ? AND news IS NOT NULL
      ORDER BY observed_at DESC
      LIMIT 1
    `);
    const insert = this.#db.prepare(`
      INSERT OR IGNORE INTO trend_snapshots
        (trend_key, title, approximate_volume, rank, related_queries,
         first_seen_at, observed_at, published_at, news)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.#db.exec('BEGIN');
    try {
      trends.forEach((trend, index) => {
        const seen = earliest.get(trend.id) as { first: string | null } | undefined;

        // Quoted exactly as the feed worded them, never condensed. An empty
        // list stores nothing rather than an empty array, so "no headlines"
        // and "unchanged since last time" stay the same absent value.
        const news = trend.news.length === 0 ? null : JSON.stringify(trend.news);
        const previous = lastNews.get(trend.id) as { news: string | null } | undefined;

        insert.run(
          trend.id,
          trend.title,
          trend.approximateVolume ?? null,
          index + 1,
          JSON.stringify(trend.relatedQueries),
          seen?.first ?? observedAt,
          observedAt,
          /*
           * Google's own detection time, not ours. It is worth storing beside
           * `first_seen_at` precisely because the two differ: we meet a trend
           * whenever we next poll, which in steady state is a quarter of an
           * hour late and after any gap in collection is hours late. This one
           * does not move when the machine restarts.
           */
          trend.publishedAt ?? null,
          news === previous?.news ? null : news,
        );
      });
      this.#db.exec('COMMIT');
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Everything the details panel knows about one trend, all of it counted
   * from stored observations.
   *
   * The rank reported here is the trend's standing **by volume** among every
   * trend seen in the same fetch — not the position it held in the feed. The
   * feed is ordered newest-first, so its position measures how recently the
   * trend was detected and slides downward on its own as newer ones arrive.
   * Graphing that would say nothing about the search. Volume is stored for
   * every row, so the real ranking is recoverable without a schema change.
   */
  historyFor(trendKey: string, nowMs: number): TrendHistory {
    const totals = this.#db
      .prepare(
        `SELECT MIN(observed_at) AS first_seen,
                MAX(observed_at) AS last_seen,
                COUNT(*)         AS times_observed
         FROM trend_snapshots
         WHERE trend_key = ?`,
      )
      .get(trendKey) as {
      first_seen: string | null;
      last_seen: string | null;
      times_observed: number;
    };

    if (totals.times_observed === 0 || totals.first_seen === null) {
      return { trendKey, points: [], timesObserved: 0, movement: 'steady' };
    }

    /*
     * Every trend from every fetch in the window, not just this one: the
     * ranking is relative, so the others are what this one is ranked against.
     * At ten rows per fetch and a fetch every ten minutes that is ~1,440 rows
     * for a day, which SQLite reads in well under a millisecond.
     */
    const since = new Date(nowMs - HISTORY_WINDOW_MS).toISOString();
    const rows = this.#db
      .prepare(
        `SELECT trend_key, approximate_volume, rank, observed_at
         FROM trend_snapshots
         WHERE observed_at >= ?
         ORDER BY observed_at ASC`,
      )
      .all(since) as {
      trend_key: string;
      approximate_volume: string | null;
      rank: number;
      observed_at: string;
    }[];

    /*
     * This trend's own rows, keyed by fetch, so each point can carry what
     * Google actually said at that moment rather than only where it placed.
     * The figure at each observation is what shows a search climbing — the
     * peak alone cannot, and neither can a rank.
     */
    const own = new Map<string, { volume: string | null; feedRank: number }>();
    for (const row of rows) {
      if (row.trend_key !== trendKey) continue;
      own.set(row.observed_at, { volume: row.approximate_volume, feedRank: row.rank });
    }

    const points: TrendHistoryPoint[] = [];
    for (const [at, ranks] of ranksByFetch(rows)) {
      const rank = ranks.get(trendKey);
      if (rank === undefined) continue;

      const seen = own.get(at);
      points.push({
        at,
        rank,
        ...(seen?.volume == null ? {} : { volume: seen.volume }),
        ...(seen === undefined ? {} : { feedRank: seen.feedRank }),
      });
    }

    const ranks = points.map((point) => point.rank);
    const firstSeen = Date.parse(totals.first_seen);
    const lastSeen = Date.parse(totals.last_seen ?? totals.first_seen);

    return {
      trendKey,
      points,
      timesObserved: totals.times_observed,
      firstSeenAt: totals.first_seen,
      ...(ranks.length === 0
        ? {}
        : { latestRank: ranks[ranks.length - 1] as number, peakRank: Math.min(...ranks) }),
      activeMinutes: Math.max(0, Math.round((lastSeen - firstSeen) / 60_000)),
      movement: movementOf(points),
    };
  }

  /**
   * One calendar day of stored trends, ranked by an explicit local rule.
   *
   * Nothing here is fetched or inferred: the window is arithmetic on a clock,
   * the ranking is arithmetic on rows, and the only figure Google contributed
   * is the volume bucket it published at the time. A trend the feed never
   * stated a volume for still appears, ranked below every trend that has one,
   * rather than being dropped or given a number we made up.
   *
   * The ordering is the plan's, in full, and every step of it is a stored
   * quantity: peak volume bucket, then best rank reached, then fetches seen
   * in, then how long it stayed. `trend_key` breaks any remaining tie so the
   * same stored rows always produce the same list — "reproducible from stored
   * data" has to mean literally reproducible, including the order.
   */
  dayDigest(window: {
    readonly sinceMs: number;
    readonly untilMs: number;
    /** Carried through to the response; the boundary itself is the caller's. */
    readonly timezone: string;
    readonly limit: number;
  }): TrendDay {
    const since = new Date(window.sinceMs).toISOString();
    const until = new Date(window.untilMs).toISOString();

    const rows = this.#db
      .prepare(
        `SELECT trend_key, title, approximate_volume, observed_at, published_at
         FROM trend_snapshots
         WHERE observed_at >= ? AND observed_at <= ?
         ORDER BY observed_at ASC`,
      )
      .all(since, until) as {
      trend_key: string;
      title: string;
      approximate_volume: string | null;
      observed_at: string;
      published_at: string | null;
    }[];

    const ranked = ranksByFetch(rows);

    /*
     * Rows arrive oldest first, so "first" fields are written once and "last"
     * fields are overwritten on every pass — which is what makes the title the
     * most recent wording rather than whichever came first.
     */
    const byKey = new Map<
      string,
      {
        title: string;
        peakVolume: string | null;
        peakValue: number;
        peakRank: number;
        timesObserved: number;
        firstSeenAt: string;
        lastSeenAt: string;
        publishedAt: string | null;
      }
    >();

    for (const row of rows) {
      const value = volumeOf(row.approximate_volume);
      const rank = ranked.get(row.observed_at)?.get(row.trend_key);
      const seen = byKey.get(row.trend_key);

      if (seen === undefined) {
        byKey.set(row.trend_key, {
          title: row.title,
          peakVolume: row.approximate_volume,
          peakValue: value,
          peakRank: rank ?? RANK_SPACE,
          timesObserved: 1,
          firstSeenAt: row.observed_at,
          lastSeenAt: row.observed_at,
          publishedAt: row.published_at,
        });
        continue;
      }

      seen.title = row.title;
      seen.timesObserved += 1;
      seen.lastSeenAt = row.observed_at;
      // Constant per trend in the feed, so the first row that carries one wins
      // — which also lets a row written before the column existed be filled in
      // by a later observation of the same trend.
      seen.publishedAt ??= row.published_at;
      if (value > seen.peakValue) {
        seen.peakValue = value;
        seen.peakVolume = row.approximate_volume;
      }
      if (rank !== undefined && rank < seen.peakRank) seen.peakRank = rank;
    }

    const entries: TrendDayEntry[] = [...byKey].map(([trendKey, seen]) => ({
      trendKey,
      title: seen.title,
      ...(seen.peakVolume === null ? {} : { peakVolume: seen.peakVolume }),
      ...(seen.publishedAt === null ? {} : { reportedAt: seen.publishedAt }),
      peakRank: seen.peakRank,
      timesObserved: seen.timesObserved,
      firstSeenAt: seen.firstSeenAt,
      lastSeenAt: seen.lastSeenAt,
      activeMinutes: Math.max(
        0,
        Math.round((Date.parse(seen.lastSeenAt) - Date.parse(seen.firstSeenAt)) / 60_000),
      ),
    }));

    entries.sort(
      (a, b) =>
        volumeOf(b.peakVolume) - volumeOf(a.peakVolume) ||
        a.peakRank - b.peakRank ||
        b.timesObserved - a.timesObserved ||
        b.activeMinutes - a.activeMinutes ||
        a.trendKey.localeCompare(b.trendKey),
    );

    /*
     * Headlines are attached after the list is cut, not before: only the ten
     * that survive need them, and the lookup has to reach outside the window.
     * Because an unchanged set is stored as NULL, a trend that started before
     * midnight carries its headlines on a row from yesterday — scanning only
     * the day's rows would find nothing and wrongly report it had none.
     */
    const shown = entries.slice(0, window.limit);
    const latestNews = this.#db.prepare(`
      SELECT news FROM trend_snapshots
      WHERE trend_key = ? AND news IS NOT NULL AND observed_at <= ?
      ORDER BY observed_at DESC
      LIMIT 1
    `);

    return {
      startsAt: since,
      endsAt: until,
      timezone: window.timezone,
      entries: shown.map((entry) => {
        const row = latestNews.get(entry.trendKey, until) as { news: string } | undefined;
        const news = parseNews(row?.news);
        return news.length === 0 ? entry : { ...entry, news };
      }),
      trendCount: byKey.size,
      fetchCount: ranked.size,
    };
  }

  close(): void {
    this.#db.close();
  }
}

/**
 * The length of the list Google returns, and so the worst rank there is.
 *
 * Used as the fallback when a row somehow has no computed rank, which keeps an
 * unrankable trend at the bottom instead of accidentally at the top — `0` would
 * sort as the best position on a scale where 1 is best.
 */
const RANK_SPACE = 10;

/**
 * Volume standing within each fetch: `observed_at` → `trend_key` → rank.
 *
 * Ranking is relative, so it has to be computed across a whole fetch rather
 * than one trend's rows — the others are what this one is ranked against.
 * Ties share the better rank, so two trends both on 500+ are both #3 rather
 * than one being arbitrarily called worse than the other.
 *
 * Both the graph and the day digest read their ranks from here. That is the
 * point of it being one function: the tie rule is a documented promise, and
 * two copies of it would drift apart without ever failing a build.
 */
function ranksByFetch(
  rows: readonly {
    trend_key: string;
    approximate_volume: string | null;
    observed_at: string;
  }[],
): Map<string, Map<string, number>> {
  const byFetch = new Map<string, { key: string; volume: number }[]>();
  for (const row of rows) {
    const fetch = byFetch.get(row.observed_at) ?? [];
    fetch.push({ key: row.trend_key, volume: volumeOf(row.approximate_volume) });
    byFetch.set(row.observed_at, fetch);
  }

  const ranked = new Map<string, Map<string, number>>();
  for (const [at, fetch] of byFetch) {
    const sorted = [...fetch].sort((a, b) => b.volume - a.volume);
    const ranks = new Map<string, number>();
    for (const entry of sorted) {
      ranks.set(entry.key, sorted.findIndex((other) => other.volume === entry.volume) + 1);
    }
    ranked.set(at, ranks);
  }
  return ranked;
}

/**
 * The instant a calendar day began on the wall clock of `timeZone`.
 *
 * The screen's day has to be the viewer's day: rows are stored in UTC, and in
 * San Jose that is seven or eight hours ahead, so a UTC day boundary would roll
 * the list over in the afternoon. `Intl` is the only thing in Node that knows
 * when a zone's offset changed, and it costs no dependency.
 *
 * Two passes, and the second one is not redundant. The offset is read *at the
 * given moment*, which on a DST changeover day is not the offset that was in
 * force at midnight — subtracting the wrong one lands an hour off. Applying it
 * once gets close enough to re-read the offset actually in force there, and the
 * second pass uses that. US transitions happen at 2 a.m., so local midnight
 * always exists and is never ambiguous.
 */
export function startOfLocalDay(nowMs: number, timeZone: string): number {
  const parts = zonedParts(nowMs, timeZone);
  const midnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);

  const approximate = midnightAsUtc - offsetAt(nowMs, timeZone);
  return midnightAsUtc - offsetAt(approximate, timeZone);
}

/** Wall-clock fields as that zone reads them at a given instant. */
function zonedParts(
  atMs: number,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const found: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(atMs))) {
    if (part.type !== 'literal') found[part.type] = Number(part.value);
  }

  return {
    year: found['year'] ?? 1970,
    month: found['month'] ?? 1,
    day: found['day'] ?? 1,
    // Some ICU builds render midnight as hour 24 under hour12: false.
    hour: (found['hour'] ?? 0) % 24,
    minute: found['minute'] ?? 0,
    second: found['second'] ?? 0,
  };
}

/** How far ahead of UTC the zone was at that instant, in milliseconds. */
function offsetAt(atMs: number, timeZone: string): number {
  const parts = zonedParts(atMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  // The stored instant carries milliseconds the formatter does not report.
  return asUtc - Math.floor(atMs / 1000) * 1000;
}

/**
 * Stored headlines back into shape, defensively.
 *
 * This is our own JSON, but it is JSON from a column that may have been
 * written by an older build, so a bad parse yields no headlines rather than
 * taking the day view down. Each item is checked: a headline with no title is
 * not a headline, and a `source` or `url` that is not a string is dropped
 * rather than rendered as one.
 */
function parseNews(raw: string | null | undefined): TrendNewsItem[] {
  if (raw === null || raw === undefined) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const items: TrendNewsItem[] = [];
  for (const value of parsed) {
    if (typeof value !== 'object' || value === null) continue;
    const item = value as Record<string, unknown>;
    if (typeof item['title'] !== 'string' || item['title'] === '') continue;

    items.push({
      title: item['title'],
      ...(typeof item['source'] === 'string' ? { source: item['source'] } : {}),
      ...(typeof item['url'] === 'string' ? { url: item['url'] } : {}),
    });
  }
  return items;
}

/**
 * The numeric floor of one of Google's buckets: "20000+" is 20000.
 *
 * Used only to order trends against each other. It is the bottom of a range,
 * never a count of searches, and nothing is presented as one.
 */
export function volumeOf(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;

  const match = /(\d[\d.,]*)\s*([km])?/i.exec(raw);
  if (match === null) return 0;

  const digits = Number.parseFloat((match[1] ?? '').replace(/,/g, ''));
  if (!Number.isFinite(digits)) return 0;

  const suffix = match[2]?.toLowerCase();
  return digits * (suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1);
}

/**
 * Rank movement, by an explicit rule rather than a judgement.
 *
 * A lower rank number is a better position, so a *decrease* is a rise. The
 * asymmetry between the two is deliberate and comes from the plan: rising is
 * called on a single improvement, because attention arrives abruptly, while
 * cooling needs two consecutive declines, because one slip down the list is
 * as often noise as it is a trend fading.
 */
export function movementOf(points: readonly TrendHistoryPoint[]): TrendMovement {
  const ranks = points.map((point) => point.rank);
  const [third, second, last] = [
    ranks[ranks.length - 3],
    ranks[ranks.length - 2],
    ranks[ranks.length - 1],
  ];

  if (last === undefined || second === undefined) return 'steady';
  if (last < second) return 'rising';
  if (last > second && third !== undefined && second > third) return 'cooling';
  return 'steady';
}
