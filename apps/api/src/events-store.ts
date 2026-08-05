/**
 * The permanent record of where places are.
 *
 * A venue does not move. That single fact is what makes this feature cheap:
 * every address is geocoded once, ever, and every refresh afterwards reads
 * SQLite instead of MapTiler. Realistically a few hundred distinct venues over
 * the life of the dashboard, against a free tier of 1,000 lookups a month.
 *
 * This is the same "decide once and store" shape as `trend_categories`, down to
 * the reasoning — see `docs/trend-category-plan.md`. A stored miss is an answer
 * too, which is what stops an unresolvable address being looked up on every
 * refresh forever.
 *
 * `node:sqlite` is built into Node, so this costs no dependency and no native
 * build on a Raspberry Pi. It needs Node 24.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { GeocodeMatch } from './geocode.js';

const SCHEMA = `
  -- Where a place is, decided once and never revisited.
  --
  -- latitude NULL means "looked up and nothing passed the gates" — a real
  -- answer, not a missing row, and the reason an unpinnable address is not
  -- re-queried on every refresh. It mirrors how a stored 'uncategorised'
  -- stops a trend being asked about again.
  CREATE TABLE IF NOT EXISTS venue_geocodes (
    address_key TEXT PRIMARY KEY,
    latitude    REAL,
    longitude   REAL,
    -- 'address' or 'venue': which lookup produced it. A venue-index match is
    -- worth less than a street match and the screen is entitled to know.
    match_source TEXT,
    -- What MapTiler called the place, so a wrong pin can be diagnosed later
    -- without re-querying.
    place_name  TEXT,
    relevance   REAL,
    resolved_at TEXT,
    attempts    INTEGER NOT NULL DEFAULT 0
  );
`;

/**
 * How many times an address may fail before it is left alone.
 *
 * Without this, an address MapTiler will never resolve is looked up on every
 * refresh forever. Three matches `MAX_CATEGORY_ATTEMPTS` for the same reason:
 * a transient network failure deserves another go, a genuine miss does not
 * deserve an unbounded number.
 */
export const MAX_GEOCODE_ATTEMPTS = 3;

/** A schema upgrade failed, as distinct from the disk being unusable. */
export class EventStoreMigrationError extends Error {
  override readonly name = 'EventStoreMigrationError';
  constructor(step: string, options?: { cause?: unknown }) {
    super(`could not apply events schema migration: ${step}`, options);
  }
}

/** A cached lookup. `match` of null means a stored, deliberate miss. */
export interface CachedGeocode {
  readonly match: GeocodeMatch | null;
  readonly attempts: number;
}

export class EventStore {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    const file = resolve(path);
    mkdirSync(dirname(file), { recursive: true });

    this.#db = new DatabaseSync(file);
    // Same reasoning as the trend history: a wall display gets switched off at
    // the socket, and WAL survives that better than the rollback journal.
    this.#db.exec('PRAGMA journal_mode = WAL');
    this.#db.exec(SCHEMA);
  }

  /**
   * What we already know about these places.
   *
   * Returns only rows that have been *settled* — either a usable position or a
   * miss that has run out of attempts. A row still within its attempt budget is
   * deliberately absent, so the caller treats it as "ask again".
   */
  geocodesFor(keys: readonly string[]): Map<string, CachedGeocode> {
    const found = new Map<string, CachedGeocode>();
    if (keys.length === 0) return found;

    const select = this.#db.prepare(
      `SELECT latitude, longitude, match_source, place_name, relevance, attempts
         FROM venue_geocodes WHERE address_key = ?`,
    );

    for (const key of keys) {
      const row = select.get(key) as
        | {
            latitude: number | null;
            longitude: number | null;
            match_source: string | null;
            place_name: string | null;
            relevance: number | null;
            attempts: number;
          }
        | undefined;
      if (row === undefined) continue;

      if (row.latitude !== null && row.longitude !== null) {
        found.set(key, {
          attempts: row.attempts,
          match: {
            latitude: row.latitude,
            longitude: row.longitude,
            source: row.match_source === 'address' ? 'address' : 'venue',
            placeName: row.place_name ?? '',
            relevance: row.relevance ?? 0,
          },
        });
        continue;
      }

      // A miss, and only a settled one. Under the cap it is left out so the
      // caller retries; at or over it, the miss is the answer.
      if (row.attempts >= MAX_GEOCODE_ATTEMPTS) {
        found.set(key, { match: null, attempts: row.attempts });
      }
    }

    return found;
  }

  /** Stores a position. Permanent — a venue does not move. */
  recordHit(key: string, match: GeocodeMatch, atMs: number): void {
    this.#db
      .prepare(
        `INSERT INTO venue_geocodes
           (address_key, latitude, longitude, match_source, place_name, relevance, resolved_at, attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(address_key) DO UPDATE SET
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           match_source = excluded.match_source,
           place_name = excluded.place_name,
           relevance = excluded.relevance,
           resolved_at = excluded.resolved_at`,
      )
      .run(
        key,
        match.latitude,
        match.longitude,
        match.source,
        match.placeName,
        match.relevance,
        new Date(atMs).toISOString(),
      );
  }

  /**
   * Counts a failed attempt, leaving the position NULL.
   *
   * Counting the attempt even though nothing was resolved is the point: it is
   * what eventually retires an address nobody can place, exactly as a counted
   * category attempt retires a trend the model will not answer for.
   */
  recordMiss(key: string, atMs: number): void {
    this.#db
      .prepare(
        `INSERT INTO venue_geocodes (address_key, resolved_at, attempts)
         VALUES (?, ?, 1)
         ON CONFLICT(address_key) DO UPDATE SET
           attempts = venue_geocodes.attempts + 1,
           resolved_at = excluded.resolved_at`,
      )
      .run(key, new Date(atMs).toISOString());
  }

  /** How many places are known, and how many are settled misses. */
  stats(): { readonly resolved: number; readonly missed: number } {
    const row = this.#db
      .prepare(
        `SELECT
           SUM(CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
           SUM(CASE WHEN latitude IS NULL AND attempts >= ? THEN 1 ELSE 0 END) AS missed
         FROM venue_geocodes`,
      )
      .get(MAX_GEOCODE_ATTEMPTS) as { resolved: number | null; missed: number | null };

    return { resolved: row.resolved ?? 0, missed: row.missed ?? 0 };
  }

  close(): void {
    this.#db.close();
  }
}
