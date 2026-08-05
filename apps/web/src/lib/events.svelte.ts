/**
 * What is on near the dashboard, and which of it the page is showing.
 *
 * Mirrors `trends.svelte.ts`: the store owns the fetch, the polling, the
 * filter and the selection, and the component draws whatever it is handed.
 *
 * The backend refreshes from upstream once a day, so this polls slowly — it
 * exists to pick up a refresh that happened while the panel was showing another
 * page, not to drive one.
 */

import { requestEvents, EventsRequestError } from './api';
import type { DashboardFailure, DashboardPhase, EventsSnapshot, LocalEvent } from './types';

/** Which slice of the week the page is showing. */
export type EventFilter = 'today' | 'week';

export const EVENT_FILTERS: readonly { id: EventFilter; name: string }[] = [
  { id: 'today', name: 'TODAY' },
  { id: 'week', name: 'THIS WEEK' },
];

/** Map or list. Two ways to read the same events, not two sets of them. */
export type EventView = 'map' | 'list';

export const EVENT_VIEWS: readonly { id: EventView; name: string }[] = [
  { id: 'map', name: 'MAP' },
  { id: 'list', name: 'LIST' },
];

/**
 * How the list is ordered. Map view has no ordering — a map shows position.
 *
 * `distance` is the one the list exists for: "what is on near me, nearest
 * first" is a question the map can only answer by eye.
 */
export type EventSort = 'distance' | 'time';

export const EVENT_SORTS: readonly { id: EventSort; name: string }[] = [
  { id: 'distance', name: 'NEAREST' },
  { id: 'time', name: 'SOONEST' },
];

/**
 * How often the page asks again.
 *
 * Five minutes against a backend that refreshes daily. Deliberately unrelated
 * to the upstream cadence: this only has to notice that the day rolled over or
 * that a restart re-fetched, and a wall display has all the time in the world.
 */
const POLL_MS = 5 * 60 * 1000;

export class Events {
  phase = $state<DashboardPhase>('loading');
  snapshot = $state<EventsSnapshot | null>(null);
  failure = $state<DashboardFailure | null>(null);

  filter = $state<EventFilter>('week');
  view = $state<EventView>('map');
  sort = $state<EventSort>('distance');

  /** The event whose sheet is open, or null. Never an index — the list reorders. */
  selectedId = $state<string | null>(null);

  #timer: ReturnType<typeof setInterval> | undefined;
  #controller: AbortController | undefined;

  /** Every event in the snapshot, already sorted by the backend. */
  readonly all = $derived<readonly LocalEvent[]>(this.snapshot?.events ?? []);

  /**
   * What the current filter admits.
   *
   * `TODAY` is derived here rather than fetched, which is the whole reason the
   * backend asks upstream for a week at a time: switching filters is free and
   * never costs an API call.
   *
   * An event whose date could not be parsed has no `startsAt`, so it cannot be
   * placed in a day and is shown only under `THIS WEEK`. That is the honest
   * answer — it is not known to be today.
   */
  readonly visible = $derived<readonly LocalEvent[]>(
    this.filter === 'week' ? this.all : this.all.filter(isToday),
  );

  /** Only events with a position can be pins. */
  readonly pins = $derived<readonly LocalEvent[]>(
    this.visible.filter((event) => event.coordinates !== undefined),
  );

  /**
   * How many of the visible events cannot be drawn.
   *
   * Shown on screen rather than swallowed: an event we could not place is still
   * an event, and silently dropping it would be the one dishonest thing this
   * page could do.
   */
  readonly unpinned = $derived(this.visible.length - this.pins.length);

  /** True when the events on screen are fabricated. The page must say so. */
  readonly isMock = $derived(this.snapshot?.source === 'mock');

  /**
   * The visible events in the list's chosen order.
   *
   * Events with no position sort last under either ordering, and that is the
   * point of showing them at all: they are the ones the map cannot represent,
   * so the list is the only place they exist. Dropping them here would recreate
   * exactly the gap this view was built to close.
   */
  readonly ordered = $derived<readonly LocalEvent[]>(
    [...this.visible].sort((a, b) => {
      if (this.sort === 'distance') {
        const near = compareOptionalNumber(a.distanceMiles, b.distanceMiles);
        if (near !== 0) return near;
      }
      const soon = compareOptionalString(a.startsAt, b.startsAt);
      if (soon !== 0) return soon;
      return a.title.localeCompare(b.title);
    }),
  );

  readonly selected = $derived<LocalEvent | null>(
    this.selectedId === null
      ? null
      : (this.all.find((event) => event.id === this.selectedId) ?? null),
  );

  select(id: string): void {
    this.selectedId = id;
  }

  close(): void {
    this.selectedId = null;
  }

  setFilter(filter: EventFilter): void {
    if (this.filter === filter) return;
    this.filter = filter;
    // A sheet left open would be showing an event the new filter excludes.
    this.close();
  }

  setView(view: EventView): void {
    if (this.view === view) return;
    this.view = view;
    // The sheet is anchored to the bottom of whichever view is showing, and
    // carrying it across reads as a panel that failed to close.
    this.close();
  }

  setSort(sort: EventSort): void {
    this.sort = sort;
  }

  /**
   * Opens the list *on* the events that could not be placed.
   *
   * Reached from the "N NOT PLACED" count on the map, which is otherwise the
   * only trace of them — the map cannot draw an event with no position, so
   * without this the count is the whole of what a person can learn about it.
   *
   * Selecting the first one is what makes this a destination rather than a
   * gesture. Unplaced events sort last under either ordering, so merely
   * switching to the list leaves them below the fold on a twelve-card grid —
   * the same dead end, one tap further along. The list scrolls the selection
   * into view, and the sheet opens on it.
   */
  showUnplaced(): void {
    this.view = 'list';
    this.sort = 'distance';

    const first = this.ordered.find((event) => event.coordinates === undefined);
    this.selectedId = first?.id ?? null;
  }

  start(): void {
    void this.#load();
    this.#timer = setInterval(() => void this.#load(), POLL_MS);
  }

  stop(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    this.#controller?.abort();
    this.#controller = undefined;
  }

  async #load(): Promise<void> {
    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;

    try {
      const snapshot = await requestEvents(controller.signal);
      this.snapshot = snapshot;
      this.failure = null;
      this.phase = 'ready';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      /*
       * A failed poll that still has events falls through to the events. The
       * page says the data is stale; that is truer than an error screen over a
       * list we are still holding.
       */
      this.failure =
        error instanceof EventsRequestError
          ? error.failure
          : { kind: 'network', message: 'CANNOT REACH API' };
      this.phase = this.snapshot === null ? 'error' : 'ready';
    }
  }
}

/**
 * Whether an event starts on the panel's own calendar day.
 *
 * Drawn on the browser's local clock, which on the Pi is the dashboard's
 * timezone. A laptop in another zone will draw the boundary in its own, which
 * is a development-only difference and the honest behaviour for a page whose
 * whole subject is "near here, now".
 */
/** Undefined sorts last, which is what "no distance known" should do. */
function compareOptionalNumber(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

function compareOptionalString(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a < b ? -1 : 1;
}

function isToday(event: LocalEvent): boolean {
  if (event.startsAt === undefined) return false;

  const start = new Date(event.startsAt);
  const now = new Date();
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}
