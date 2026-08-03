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
   */
  historyFor(trendKey: string, nowMs: number): TrendHistory {
    const totals = this.#db
      .prepare(
        `SELECT MIN(observed_at) AS first_seen,
                MAX(observed_at) AS last_seen,
                MIN(rank)        AS peak_rank,
                COUNT(*)         AS times_observed
         FROM trend_snapshots
         WHERE trend_key = ?`,
      )
      .get(trendKey) as {
      first_seen: string | null;
      last_seen: string | null;
      peak_rank: number | null;
      times_observed: number;
    };

    if (totals.times_observed === 0 || totals.first_seen === null) {
      return { trendKey, points: [], timesObserved: 0, movement: 'steady' };
    }

    const since = new Date(nowMs - HISTORY_WINDOW_MS).toISOString();
    const rows = this.#db
      .prepare(
        `SELECT observed_at, rank
         FROM trend_snapshots
         WHERE trend_key = ? AND observed_at >= ?
         ORDER BY observed_at ASC`,
      )
      .all(trendKey, since) as { observed_at: string; rank: number }[];

    const points: TrendHistoryPoint[] = rows.map((row) => ({
      at: row.observed_at,
      rank: row.rank,
    }));

    const latest = this.#db
      .prepare(
        `SELECT rank FROM trend_snapshots
         WHERE trend_key = ? ORDER BY observed_at DESC LIMIT 1`,
      )
      .get(trendKey) as { rank: number } | undefined;

    const firstSeen = Date.parse(totals.first_seen);
    const lastSeen = Date.parse(totals.last_seen ?? totals.first_seen);

    return {
      trendKey,
      points,
      timesObserved: totals.times_observed,
      firstSeenAt: totals.first_seen,
      ...(latest === undefined ? {} : { latestRank: latest.rank }),
      ...(totals.peak_rank === null ? {} : { peakRank: totals.peak_rank }),
      activeMinutes: Math.max(0, Math.round((lastSeen - firstSeen) / 60_000)),
      movement: movementOf(points),
    };
  }

  close(): void {
    this.#db.close();
  }
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
