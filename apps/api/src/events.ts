/**
 * Events near the dashboard, fetched and normalised.
 *
 * The provider interface is the point of this file, exactly as it is in
 * `trends.ts`: everything downstream — the pipeline, the route, the browser —
 * knows only that it can ask for a list of `SourceEvent`. Which service
 * produced them, and whether that service was real, is decided by one binding
 * in `server.ts`.
 *
 * That indirection is not speculative here. SerpApi's Google Events engine has
 * returned zero results for every query since 2026-08-04
 * (serpapi/public-roadmap#4117), which is why `MockEventProvider` exists and
 * why development continues without it.
 */

import { parseEventDate } from './event-dates.js';
import type { EventLink, SourceEvent } from './types.js';

/** Raised when the upstream is unreachable or answers with something unusable. */
export class EventsUnavailableError extends Error {
  override readonly name = 'EventsUnavailableError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export interface EventFetchResult {
  readonly events: readonly SourceEvent[];
  /** Upstream calls actually made. Zero for the mock provider. */
  readonly callsMade: number;
  /** Queries that came back with nothing, which is the outage signature. */
  readonly emptyQueries: readonly string[];
}

export interface EventProvider {
  /** Names the provider in logs and in the payload the screen receives. */
  readonly source: 'mock' | 'serpapi';
  /**
   * Every event the configured queries found, normalised but **not**
   * deduplicated, geocoded or distance-filtered — those are the pipeline's job
   * and are done identically for every provider.
   *
   * Returning an empty list is a legitimate answer and means "nothing is on".
   * Only an unreachable or unusable upstream throws.
   */
  getEvents(): Promise<EventFetchResult>;
}

// --- SerpApi --------------------------------------------------------------

const SERPAPI_URL = 'https://serpapi.com/search.json';

/** SerpApi's wire format. Only ever used between `fetch()` and normalisation. */
interface SerpApiEvent {
  readonly title?: string;
  readonly date?: { readonly start_date?: string; readonly when?: string };
  readonly address?: readonly string[] | string;
  readonly link?: string;
  readonly description?: string;
  readonly ticket_info?: readonly {
    readonly source?: string;
    readonly link?: string;
    readonly link_type?: string;
  }[];
  readonly venue?: { readonly name?: string; readonly link?: string };
  readonly thumbnail?: string;
  readonly image?: string;
}

interface SerpApiResponse {
  readonly events_results?: readonly SerpApiEvent[];
  readonly error?: string;
  readonly search_information?: { readonly events_results_state?: string };
}

export class SerpApiEventProvider implements EventProvider {
  readonly source = 'serpapi' as const;

  readonly #apiKey: string;
  readonly #timeoutMs: number;
  readonly #queries: readonly string[];
  readonly #location: string;
  readonly #timeZone: string;
  readonly #now: () => number;

  constructor(options: {
    apiKey: string;
    timeoutMs: number;
    queries: readonly string[];
    /** SerpApi's `location` parameter, e.g. "San Jose, California, United States". */
    location: string;
    timeZone: string;
    now?: () => number;
  }) {
    this.#apiKey = options.apiKey;
    this.#timeoutMs = options.timeoutMs;
    this.#queries = options.queries;
    this.#location = options.location;
    this.#timeZone = options.timeZone;
    this.#now = options.now ?? Date.now;
  }

  async getEvents(): Promise<EventFetchResult> {
    const events: SourceEvent[] = [];
    const emptyQueries: string[] = [];
    let callsMade = 0;
    let failures = 0;

    /*
     * Sequential, not parallel. Seven concurrent requests to a rate-limited
     * account buys a second or two on a fetch that happens once a day, and
     * costs the ability to stop early. Nothing is waiting on this.
     */
    for (const query of this.#queries) {
      callsMade += 1;
      try {
        const found = await this.#search(query);
        if (found.length === 0) emptyQueries.push(query);
        events.push(...found);
      } catch (error) {
        failures += 1;
        // One query failing is not the fetch failing — six good queries still
        // make a screen. Only a total wipeout is worth throwing for.
        if (failures === this.#queries.length) {
          throw new EventsUnavailableError('Every SerpApi query failed', {
            cause: error,
          });
        }
      }
    }

    return { events, callsMade, emptyQueries };
  }

  async #search(query: string): Promise<readonly SourceEvent[]> {
    const url = new URL(SERPAPI_URL);
    url.searchParams.set('engine', 'google_events');
    url.searchParams.set('q', query);
    url.searchParams.set('location', this.#location);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('gl', 'us');
    /*
     * A week's worth in one call. The Today filter is then derived locally from
     * the parsed start times, so switching between Today and This Week on the
     * panel costs nothing and never triggers another search.
     */
    url.searchParams.set('htichips', 'date:week');
    url.searchParams.set('api_key', this.#apiKey);

    let body: SerpApiResponse;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.#timeoutMs),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new EventsUnavailableError(
          `SerpApi responded ${response.status} ${response.statusText}`,
        );
      }
      body = (await response.json()) as SerpApiResponse;
    } catch (error) {
      if (error instanceof EventsUnavailableError) throw error;
      throw new EventsUnavailableError('Could not reach SerpApi', { cause: error });
    }

    /*
     * "Fully empty" with an `error` string is not a failure — it is Google
     * saying it has nothing, and since 2026-08-04 it is saying that for every
     * query. Treating it as an error would trip the failure path seven times a
     * day and log noise about something we cannot fix. It is reported as an
     * empty query instead, which is what the budget backoff watches.
     */
    return (body.events_results ?? [])
      .map((raw, index) => this.#normalise(raw, query, index))
      .filter(isPresent);
  }

  /**
   * SerpApi's shape into ours.
   *
   * **Unverified against a live payload** — the engine has been empty since
   * 2026-08-04, so these field names come from SerpApi's documentation rather
   * than from a captured response. Everything is treated as optional and an
   * unexpected shape yields a poorer event rather than an exception, which is
   * the same defensive stance `parseTrendingRss` takes.
   */
  #normalise(raw: SerpApiEvent, query: string, index: number): SourceEvent | undefined {
    const title = clean(raw.title);
    // An event with no name is not an event.
    if (title === undefined) return undefined;

    const address = joinAddress(raw.address);
    const venue = clean(raw.venue?.name);
    const when = clean(raw.date?.when) ?? clean(raw.date?.start_date) ?? 'Date not stated';

    const parsed = parseEventDate(
      { when: raw.date?.when, startDate: raw.date?.start_date },
      this.#timeZone,
      this.#now(),
    );

    const links: EventLink[] = [];
    for (const ticket of raw.ticket_info ?? []) {
      const url = httpUrl(ticket.link);
      if (url === undefined) continue;
      links.push({ label: clean(ticket.source) ?? 'Tickets', url });
    }

    return {
      // No stable id is published, so identity is derived. `index` is included
      // only to keep two genuinely different events in one response apart; the
      // dedup ladder never relies on this rung across queries.
      id: eventId(title, venue ?? address, parsed?.startsAt, index),
      title,
      when,
      ...(parsed?.startsAt === undefined ? {} : { startsAt: parsed.startsAt }),
      ...(parsed?.endsAt === undefined ? {} : { endsAt: parsed.endsAt }),
      ...(venue === undefined ? {} : { venue }),
      ...(address === undefined ? {} : { address }),
      ...(clean(raw.description) === undefined
        ? {}
        : { description: clean(raw.description) as string }),
      ...(httpUrl(raw.thumbnail ?? raw.image) === undefined
        ? {}
        : { thumbnailUrl: httpUrl(raw.thumbnail ?? raw.image) as string }),
      ...(httpUrl(raw.link) === undefined ? {} : { url: httpUrl(raw.link) as string }),
      links,
      queries: [query],
    };
  }
}

// --- Shared normalisation helpers -----------------------------------------

/**
 * A derived identity for an event.
 *
 * Not a hash of everything: including the description or the thumbnail would
 * make the same event look new when Google reworded a blurb. Title, place and
 * start are what identify an occurrence.
 */
export function eventId(
  title: string,
  place: string | undefined,
  startsAt: string | undefined,
  salt: number,
): string {
  const parts = [
    normaliseTitle(title),
    (place ?? '').toLowerCase().replace(/\s+/g, ' ').trim(),
    startsAt ?? `#${salt}`,
  ];
  return parts.join('|');
}

/**
 * A title reduced to what identifies it.
 *
 * Conservative on purpose, in the same spirit as `trendKey`: it exists to
 * recognise the *same* event written with different punctuation or a leading
 * article, not to decide that two differently worded events are the same.
 */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** SerpApi writes the address as an array of lines, or occasionally a string. */
export function joinAddress(address: readonly string[] | string | undefined): string | undefined {
  if (address === undefined) return undefined;
  if (typeof address === 'string') return clean(address);

  const parts = address.map((line) => clean(line)).filter(isPresent);
  return parts.length === 0 ? undefined : parts.join(', ');
}

/** Trimmed, or undefined when there was nothing there. */
export function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * A URL only if it is one, and only over http(s).
 *
 * Same reasoning as `trends.ts`: these end up in `href` and `src` attributes,
 * so a `javascript:` or `data:` value from an upstream we do not control must
 * not reach the browser.
 */
export function httpUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
