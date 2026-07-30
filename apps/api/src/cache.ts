/**
 * A single-slot TTL cache with request coalescing and stale-on-error.
 *
 * The dashboard polls on a timer and there is exactly one location, so a
 * one-entry cache is all this needs. Two properties matter:
 *
 *  - concurrent misses share one upstream request (no stampede on boot), and
 *  - if the upstream call fails but we still hold a previous value, we hand
 *    that back rather than failing. The screen keeps showing weather.
 */

export type CacheState = 'fresh' | 'revalidated' | 'stale';

export interface CacheResult<T> {
  readonly value: T;
  /** Epoch ms at which `value` was actually fetched. */
  readonly storedAt: number;
  readonly state: CacheState;
}

interface Entry<T> {
  readonly value: T;
  readonly storedAt: number;
}

export class TtlCache<T> {
  readonly #ttlMs: number;
  readonly #load: () => Promise<T>;
  readonly #now: () => number;

  #entry: Entry<T> | undefined;
  #inflight: Promise<Entry<T>> | undefined;

  constructor(options: { ttlMs: number; load: () => Promise<T>; now?: () => number }) {
    this.#ttlMs = options.ttlMs;
    this.#load = options.load;
    this.#now = options.now ?? Date.now;
  }

  /**
   * Returns a cached value if it is younger than the TTL, otherwise refreshes.
   * Only rejects when there is nothing cached *and* the refresh failed.
   */
  async get(): Promise<CacheResult<T>> {
    const cached = this.#entry;
    if (cached !== undefined && this.#now() - cached.storedAt < this.#ttlMs) {
      return { value: cached.value, storedAt: cached.storedAt, state: 'fresh' };
    }

    try {
      const entry = await this.#refresh();
      return { value: entry.value, storedAt: entry.storedAt, state: 'revalidated' };
    } catch (error) {
      if (cached !== undefined) {
        return { value: cached.value, storedAt: cached.storedAt, state: 'stale' };
      }
      throw error;
    }
  }

  /** Drops the cached value so the next `get()` is forced to hit upstream. */
  invalidate(): void {
    this.#entry = undefined;
  }

  #refresh(): Promise<Entry<T>> {
    const existing = this.#inflight;
    if (existing !== undefined) return existing;

    const inflight = this.#load()
      .then((value) => {
        const entry: Entry<T> = { value, storedAt: this.#now() };
        this.#entry = entry;
        return entry;
      })
      .finally(() => {
        this.#inflight = undefined;
      });

    this.#inflight = inflight;
    return inflight;
  }
}
