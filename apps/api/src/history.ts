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
    observed_at        TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS trend_snapshots_key_time
    ON trend_snapshots (trend_key, observed_at);

  -- One row per trend per fetch. A retried write with the same timestamp is
  -- the same observation, not a second one, so it is dropped rather than
  -- inflating "times observed".
  CREATE UNIQUE INDEX IF NOT EXISTS trend_snapshots_once
    ON trend_snapshots (trend_key, observed_at);
`;

export class TrendHistoryStore {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    const file = resolve(path);
    mkdirSync(dirname(file), { recursive: true });

    this.#db = new DatabaseSync(file);
    // Survives an unclean power cut better than the default rollback journal,
    // which matters on a wall display that gets switched off at the socket.
    this.#db.exec('PRAGMA journal_mode = WAL');
    this.#db.exec(SCHEMA);
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
    const insert = this.#db.prepare(`
      INSERT OR IGNORE INTO trend_snapshots
        (trend_key, title, approximate_volume, rank, related_queries,
         first_seen_at, observed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.#db.exec('BEGIN');
    try {
      trends.forEach((trend, index) => {
        const seen = earliest.get(trend.id) as { first: string | null } | undefined;
        insert.run(
          trend.id,
          trend.title,
          trend.approximateVolume ?? null,
          index + 1,
          JSON.stringify(trend.relatedQueries),
          seen?.first ?? observedAt,
          observedAt,
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
        `SELECT trend_key, approximate_volume, observed_at
         FROM trend_snapshots
         WHERE observed_at >= ?
         ORDER BY observed_at ASC`,
      )
      .all(since) as {
      trend_key: string;
      approximate_volume: string | null;
      observed_at: string;
    }[];

    const byFetch = new Map<string, { key: string; volume: number }[]>();
    for (const row of rows) {
      const fetch = byFetch.get(row.observed_at) ?? [];
      fetch.push({ key: row.trend_key, volume: volumeOf(row.approximate_volume) });
      byFetch.set(row.observed_at, fetch);
    }

    const points: TrendHistoryPoint[] = [];
    for (const [at, fetch] of byFetch) {
      // Ties share the better rank, so two trends both on 500+ are both #3
      // rather than one being arbitrarily called worse than the other.
      const sorted = [...fetch].sort((a, b) => b.volume - a.volume);
      const index = sorted.findIndex((entry) => entry.key === trendKey);
      if (index === -1) continue;

      const volume = sorted[index]?.volume ?? 0;
      const rank = sorted.findIndex((entry) => entry.volume === volume) + 1;
      points.push({ at, rank });
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

  close(): void {
    this.#db.close();
  }
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
