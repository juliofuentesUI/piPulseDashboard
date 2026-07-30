import { requestWeather, WeatherRequestError } from './api';
import type { DashboardFailure, DashboardPhase, WeatherSnapshot } from './types';
import { formatClock, toDashboardView } from './view';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CLOCK_INTERVAL_MS = 60 * 1000;
/** How long "REFRESHED" stays on screen after a successful fetch. */
const FLASH_MS = 2_500;

export type NoticeTone = 'ok' | 'busy' | 'warn' | 'error';

export interface Notice {
  readonly text: string;
  readonly tone: NoticeTone;
}

/**
 * Owns everything time- and network-related for the screen.
 *
 * The rule this class exists to enforce: a failed fetch never destroys the
 * last good reading. `phase` only falls back to `'error'` when there has
 * never been a successful load.
 */
export class Dashboard {
  phase = $state<DashboardPhase>('loading');
  failure = $state<DashboardFailure | null>(null);
  isRefreshing = $state(false);
  online = $state(true);
  justRefreshed = $state(false);

  #snapshot = $state<WeatherSnapshot | null>(null);
  #now = $state(new Date());

  #refreshTimer: ReturnType<typeof setInterval> | undefined;
  #clockTimeout: ReturnType<typeof setTimeout> | undefined;
  #clockTimer: ReturnType<typeof setInterval> | undefined;
  #flashTimer: ReturnType<typeof setTimeout> | undefined;
  #controller: AbortController | undefined;

  view = $derived(
    this.#snapshot === null ? null : toDashboardView(this.#snapshot, this.#now),
  );

  clock = $derived(formatClock(this.#now));

  /** One line of status text covering loading, success, failure and offline. */
  notice = $derived<Notice>(
    this.isRefreshing
      ? { text: 'REFRESHING...', tone: 'busy' }
      : !this.online
        ? { text: 'NO NETWORK', tone: 'error' }
        : this.failure !== null
          ? { text: this.failure.message, tone: 'warn' }
          : this.justRefreshed
            ? { text: 'REFRESHED', tone: 'ok' }
            : { text: this.view?.updatedLabel ?? 'WAITING', tone: 'ok' },
  );

  start(): void {
    this.online = navigator.onLine;
    window.addEventListener('online', this.#handleOnline);
    window.addEventListener('offline', this.#handleOffline);

    this.#startClock();
    this.#refreshTimer = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
    void this.refresh();
  }

  stop(): void {
    window.removeEventListener('online', this.#handleOnline);
    window.removeEventListener('offline', this.#handleOffline);

    clearInterval(this.#refreshTimer);
    clearTimeout(this.#clockTimeout);
    clearInterval(this.#clockTimer);
    clearTimeout(this.#flashTimer);
    this.#controller?.abort();
  }

  async refresh(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const controller = new AbortController();
    this.#controller = controller;

    try {
      const snapshot = await requestWeather(controller.signal);
      this.#snapshot = snapshot;
      this.#now = new Date();
      this.failure = null;
      this.phase = 'ready';
      this.#flash();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      this.failure =
        error instanceof WeatherRequestError
          ? error.failure
          : { kind: 'network', message: 'UNEXPECTED ERROR' };

      // Only blank the screen if there is genuinely nothing to show.
      this.phase = this.#snapshot === null ? 'error' : 'ready';
    } finally {
      this.isRefreshing = false;
    }
  }

  #flash(): void {
    this.justRefreshed = true;
    clearTimeout(this.#flashTimer);
    this.#flashTimer = setTimeout(() => {
      this.justRefreshed = false;
    }, FLASH_MS);
  }

  /** Ticks on the wall-clock minute rather than 60s after load. */
  #startClock(): void {
    const msUntilNextMinute = CLOCK_INTERVAL_MS - (Date.now() % CLOCK_INTERVAL_MS);
    this.#clockTimeout = setTimeout(() => {
      this.#tick();
      this.#clockTimer = setInterval(() => this.#tick(), CLOCK_INTERVAL_MS);
    }, msUntilNextMinute);
  }

  #tick = (): void => {
    this.#now = new Date();
  };

  #handleOnline = (): void => {
    this.online = true;
    void this.refresh();
  };

  #handleOffline = (): void => {
    this.online = false;
    this.failure = { kind: 'offline', message: 'NO NETWORK' };
  };
}
