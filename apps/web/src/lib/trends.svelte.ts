import {
  requestTrendDay,
  requestTrendHistory,
  requestTrends,
  TrendsRequestError,
} from './api';
import { readSetting, writeSetting } from './storage';
import {
  orderTrends,
  type PulseMode,
  type PulseView,
  regionName,
  toDayDetail,
  toDayView,
  toTrendCard,
  toTrendDetail,
  toTrendHistoryView,
  toTrendRows,
  VISIBLE_TRENDS,
} from './trend-view';
import type {
  DashboardFailure,
  DashboardPhase,
  TrendDay,
  TrendHistory,
  TrendsSnapshot,
} from './types';
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

const MODE_KEY = 'pipulse:pulse-mode';

/** The ordering last chosen on this device; the feed's own order by default. */
function storedMode(): PulseMode {
  return readSetting(MODE_KEY) === 'biggest' ? 'biggest' : 'surging';
}

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

  /**
   * Remembered like the theme and the weather layout: the Pi is a wall display
   * that gets power-cycled, and coming back up in an ordering nobody chose
   * would read as the dashboard having forgotten itself.
   */
  mode = $state<PulseMode>(storedMode());

  /**
   * Which list is showing. Deliberately *not* remembered across a restart,
   * unlike the ordering and the theme: NOW is the resting state of a wall
   * display, and the same reasoning already puts the carousel back on the
   * weather page and closes the trend card on reload.
   */
  view = $state<PulseView>('now');

  /**
   * Whether the full-screen trend card is showing.
   *
   * Held here rather than inside the component because attract mode has to be
   * able to close it. The card takes over the Search Pulse page, so a tour that
   * navigated away and came back would otherwise find it still open and show a
   * card where the list should be.
   */
  cardOpen = $state(false);

  openCard(): void {
    this.cardOpen = true;
  }

  closeCard(): void {
    this.cardOpen = false;
  }

  #day = $state<TrendDay | null>(null);
  #dayController: AbortController | undefined;

  /** Null until the day's record has actually arrived, so the view can say so. */
  day = $derived(this.#day === null ? null : toDayView(this.#day));

  /**
   * Which of the day's trends has its panel open, by key. Held as a key rather
   * than an entry for the same reason the live list holds one: the day is
   * re-read on every poll, and an index would start describing a different
   * search the moment a new fetch reordered the ten.
   */
  #openDayKey = $state<string | null>(null);
  #dayHistory = $state<TrendHistory | null>(null);
  #dayHistoryController: AbortController | undefined;

  /**
   * Kept apart from the live list's `history`, which belongs to whatever the
   * details band has selected. Sharing one would make opening a day trend
   * silently redraw the rank graph on the page underneath.
   */
  dayTrend = $derived.by(() => {
    if (this.#openDayKey === null || this.#day === null) return null;

    const entry = this.#day.entries.find((row) => row.trendKey === this.#openDayKey);
    if (entry === undefined) return null;

    const history =
      this.#dayHistory !== null && this.#dayHistory.trendKey === this.#openDayKey
        ? this.#dayHistory
        : null;
    return toDayDetail(entry, history, this.#day.startsAt);
  });

  openDayTrend(key: string): void {
    this.#openDayKey = key;
    this.#dayHistory = null;
    void this.#loadDayHistory(key);
  }

  closeDayTrend(): void {
    this.#openDayKey = null;
    this.#dayHistoryController?.abort();
    this.#dayHistory = null;
  }

  async #loadDayHistory(key: string): Promise<void> {
    const controller = new AbortController();
    this.#dayHistoryController?.abort();
    this.#dayHistoryController = controller;

    try {
      this.#dayHistory = await requestTrendHistory(key, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      /*
       * Resolved empty rather than left null. Null means "still reading", and
       * a panel that says so forever is a lie about what it is doing — the
       * summary above the list came from the day digest and is already right.
       */
      this.#dayHistory = { trendKey: key, points: [], timesObserved: 0, movement: 'steady' };
    }
  }

  #ordered = $derived(
    this.#snapshot === null ? [] : orderTrends(this.#snapshot.trends, this.mode),
  );

  rows = $derived(toTrendRows(this.#ordered, this.#now));
  hasData = $derived(this.#snapshot !== null);
  region = $derived(regionName(this.#snapshot?.region));

  /** Only what is on screen is selectable, so the band always matches a row. */
  #visible = $derived(this.#ordered.slice(0, VISIBLE_TRENDS));

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

  /**
   * The same trend the details band is describing, with what the feed says it
   * is about. Derived rather than captured when the card opens, so a poll that
   * lands while the card is up refreshes it instead of leaving it stale.
   */
  card = $derived(
    this.#current === null ? null : toTrendCard(this.#current, this.#now),
  );

  #history = $state<TrendHistory | null>(null);
  #historyController: AbortController | undefined;

  /**
   * Only rendered when it belongs to the trend on screen. The lookup is
   * asynchronous, so without this check a slow response for a previous
   * selection could land after a fast one and describe the wrong search.
   */
  history = $derived(
    this.#history === null || this.#history.trendKey !== this.selectedId
      ? null
      : toTrendHistoryView(this.#history, this.#now),
  );

  select(id: string): void {
    this.#chosen = id;
    void this.#loadHistory(id);
  }

  /**
   * Re-orders in place. A trend picked by hand keeps being described and just
   * moves to a different row; when nothing was picked the panel follows the
   * top of the list, which is a different trend once the ordering changes —
   * so its history has to be fetched.
   */
  setMode(mode: PulseMode): void {
    this.mode = mode;
    writeSetting(MODE_KEY, mode);
    void this.#loadHistory(this.selectedId);
  }

  /**
   * The day's record is only fetched while TODAY is showing.
   *
   * It is a scan of the whole day's rows rather than one trend's, so polling it
   * behind an unopened view would spend that on nothing — and it can only
   * change when the backend records a new fetch, which is every ten minutes.
   */
  setView(view: PulseView): void {
    this.view = view;
    if (view === 'today') void this.#loadDay();
  }

  async #loadDay(): Promise<void> {
    const controller = new AbortController();
    this.#dayController?.abort();
    this.#dayController = controller;

    try {
      this.#day = await requestTrendDay(controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      /*
       * Left exactly as it was, on purpose. Same policy as the graph: a failed
       * lookup keeps the last good record on screen instead of blanking a
       * working view, and an empty one keeps saying it has nothing yet.
       */
    }
  }

  async #loadHistory(key: string): Promise<void> {
    if (key === '') return;

    const controller = new AbortController();
    this.#historyController?.abort();
    this.#historyController = controller;

    try {
      this.#history = await requestTrendHistory(key, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // The list is the point of the screen; losing the graph beside it is
      // not worth an error state over.
      this.#history = null;
    }
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
    this.#historyController?.abort();
    this.#dayController?.abort();
    this.#dayHistoryController?.abort();
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

      /*
       * Reloaded on every poll, not only on a tap: the backend has just
       * written a new observation, so the graph beside the selection has a
       * new point to draw. This also covers the default selection, which
       * nobody ever tapped.
       */
      void this.#loadHistory(this.selectedId);

      // The backend has just recorded a fetch, so the day has a row it did not
      // have a moment ago — but only the open view is worth re-reading for it.
      if (this.view === 'today') void this.#loadDay();
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
