import { requestTrends, TrendsRequestError } from './api';
import { regionName, toTrendDetail, toTrendRows, VISIBLE_TRENDS } from './trend-view';
import type { DashboardFailure, DashboardPhase, TrendsSnapshot } from './types';
import { relativeTime } from './view';

/**
 * How often the screen asks *our* service. The service refreshes from Google
 * every ten minutes, so most of these are answered from its cache and cost
 * Google nothing — that gap between the two rates is deliberate.
 */
const POLL_INTERVAL_MS = 60 * 1000;

/**
 * Past this, the list is no longer keeping up with the backend's ten-minute
 * refresh and stops calling itself live. The slack over ten minutes covers one
 * missed upstream fetch without crying wolf.
 */
const STALE_AFTER_MS = 15 * 60 * 1000;

/** The one-line freshness report in the region strip. */
export interface PulseStatus {
  /** Whether to draw the lamp. True only when genuinely current. */
  readonly live: boolean;
  readonly text: string;
}

/**
 * Owns the trend list, its timer, and its failure policy.
 *
 * Same rule as the weather dashboard: a failed poll never destroys the last
 * good list. `phase` only falls back to `'error'` when nothing has ever
 * loaded, so a dropped network leaves the screen showing what it last knew,
 * labelled as cached rather than presented as current.
 */
export class Trends {
  phase = $state<DashboardPhase>('loading');
  failure = $state<DashboardFailure | null>(null);
  online = $state(true);

  #snapshot = $state<TrendsSnapshot | null>(null);
  #now = $state(new Date());

  #timer: ReturnType<typeof setInterval> | undefined;
  #controller: AbortController | undefined;

  /**
   * The trend the details band is describing, by id.
   *
   * Held as an id rather than an index because the list is replaced every time
   * a poll lands: ranks shift, and an index would silently start describing a
   * different search.
   */
  #chosen = $state<string | null>(null);

  rows = $derived(this.#snapshot === null ? [] : toTrendRows(this.#snapshot.trends));
  hasData = $derived(this.#snapshot !== null);
  region = $derived(regionName(this.#snapshot?.region));

  /** Only what is on screen is selectable, so the band always matches a row. */
  #visible = $derived(this.#snapshot?.trends.slice(0, VISIBLE_TRENDS) ?? []);

  /**
   * Falls back to the top trend, which covers both the first render and the
   * case where the chosen trend has dropped out of the feed since — a stale
   * panel describing a search no longer on screen would be worse than moving.
   */
  #current = $derived(
    this.#visible.find((trend) => trend.id === this.#chosen) ?? this.#visible[0] ?? null,
  );

  selectedId = $derived(this.#current?.id ?? '');
  detail = $derived(
    this.#current === null ? null : toTrendDetail(this.#current, this.#now),
  );

  select(id: string): void {
    this.#chosen = id;
  }

  #ageMs = $derived(
    this.#snapshot === null
      ? Number.POSITIVE_INFINITY
      : this.#now.getTime() - new Date(this.#snapshot.updatedAt).getTime(),
  );

  /**
   * Every branch below is a fact about the data, not a mood: the lamp is lit
   * only while we are online and holding a list younger than the stale window.
   */
  status = $derived<PulseStatus>(
    this.#snapshot === null
      ? // Nothing to report an age for, so the strip reports the reason
        // instead of sitting blank while the band below explains itself.
        { live: false, text: this.failure?.message ?? '' }
      : !this.online
        ? { live: false, text: 'OFFLINE · CACHED DATA' }
        : this.#ageMs > STALE_AFTER_MS
          ? { live: false, text: `UPDATED ${this.#age()}` }
          : { live: true, text: `LIVE · ${this.#age()}` },
  );

  start(): void {
    this.online = navigator.onLine;
    window.addEventListener('online', this.#handleOnline);
    window.addEventListener('offline', this.#handleOffline);

    this.#timer = setInterval(() => {
      // Re-reading the clock is what ages the "3 MINS AGO" between fetches.
      this.#now = new Date();
      void this.refresh();
    }, POLL_INTERVAL_MS);

    void this.refresh();
  }

  stop(): void {
    window.removeEventListener('online', this.#handleOnline);
    window.removeEventListener('offline', this.#handleOffline);
    clearInterval(this.#timer);
    this.#controller?.abort();
  }

  async refresh(): Promise<void> {
    const controller = new AbortController();
    this.#controller?.abort();
    this.#controller = controller;

    try {
      const snapshot = await requestTrends(controller.signal);
      this.#snapshot = snapshot;
      this.#now = new Date();
      this.failure = null;
      this.phase = 'ready';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      this.failure =
        error instanceof TrendsRequestError
          ? error.failure
          : { kind: 'network', message: 'UNEXPECTED ERROR' };

      // Only give up the screen if there is genuinely nothing to show.
      this.phase = this.#snapshot === null ? 'error' : 'ready';
    }
  }

  #age(): string {
    return this.#snapshot === null ? '' : relativeTime(this.#snapshot.updatedAt, this.#now);
  }

  #handleOnline = (): void => {
    this.online = true;
    void this.refresh();
  };

  #handleOffline = (): void => {
    this.online = false;
  };
}
