/**
 * Provider output into the thing the screen consumes.
 *
 * Deduplicate, then geocode what needs it, then filter by distance, then sort.
 * Every provider goes through this identically — which is what "swapping the
 * source needs no UI change" actually means in practice.
 *
 * Nothing here talks to a provider or to the network directly. It takes a
 * `Geocoder` and an optional `EventStore` and is otherwise pure, so the whole
 * pipeline is testable against fixtures with no API keys present.
 */

import { normaliseTitle } from './events.js';
import { addressKey, milesBetween, type Geocoder } from './geocode.js';
import type { EventStore } from './events-store.js';
import type { EventCoordinates, EventLink, LocalEvent, SourceEvent } from './types.js';

export interface PipelineResult {
  readonly events: readonly LocalEvent[];
  readonly counts: {
    readonly total: number;
    readonly pinned: number;
    readonly unpinned: number;
    readonly merged: number;
    readonly outsideRadius: number;
  };
  /** Lookups that actually reached MapTiler. Zero once the cache is warm. */
  readonly geocodeCalls: number;
}

export async function buildEvents(input: {
  readonly events: readonly SourceEvent[];
  readonly center: { readonly latitude: number; readonly longitude: number };
  readonly radiusMiles: number;
  readonly geocoder: Geocoder | null;
  readonly store: EventStore | null;
  readonly nowMs: number;
  /** Called for anything worth a log line. Keeps Fastify out of this file. */
  readonly onWarn?: (message: string, error: unknown) => void;
}): Promise<PipelineResult> {
  const deduped = deduplicate(input.events);
  const merged = input.events.length - deduped.length;

  const located = await locate(deduped, input);

  let pinned = 0;
  let unpinned = 0;
  let outsideRadius = 0;
  const kept: LocalEvent[] = [];

  for (const event of located.events) {
    if (event.coordinates === undefined) {
      unpinned += 1;
      kept.push(event);
      continue;
    }

    const miles = milesBetween(input.center, event.coordinates);
    if (miles > input.radiusMiles) {
      outsideRadius += 1;
      continue;
    }

    pinned += 1;
    kept.push({ ...event, distanceMiles: Math.round(miles * 10) / 10 });
  }

  return {
    events: sortEvents(kept),
    counts: { total: kept.length, pinned, unpinned, merged, outsideRadius },
    geocodeCalls: located.geocodeCalls,
  };
}

// --- Deduplication --------------------------------------------------------

/**
 * The same event, found by several queries or listed by several ticket sellers,
 * collapsed into one.
 *
 * The ladder, most trustworthy first:
 *
 *  1. **The provider's own id.** Exact, when a provider publishes stable ones.
 *  2. **Canonical URL.** Two listings pointing at the same page are the same
 *     event.
 *  3. **Normalised title + place + start.** The workhorse rung.
 *  4. **Conservative fuzzy title**, and only when the venue and the start time
 *     already match exactly.
 *
 * **Rung 4 is where this could do damage**, so it is deliberately timid: one
 * normalised title must be a strict token subset of the other. "Sharks vs
 * Kings" merges into "San Jose Sharks vs Los Angeles Kings"; two different
 * bands at the same venue on the same night do not merge into each other,
 * because neither title's words contain the other's.
 *
 * Two things must never merge and do not: **different dates at the same venue**
 * — a weekly farmers' market is a different occurrence each week, and the start
 * date is part of every rung — and **events with no parsed start**, which fall
 * back to their own ids and stay separate.
 */
export function deduplicate(events: readonly SourceEvent[]): SourceEvent[] {
  const kept: SourceEvent[] = [];
  const byId = new Map<string, number>();
  const byUrl = new Map<string, number>();
  const byShape = new Map<string, number>();

  for (const event of events) {
    const shape = shapeKey(event);
    const url = urlKey(event);

    let target =
      byId.get(event.id) ??
      (url === undefined ? undefined : byUrl.get(url)) ??
      byShape.get(shape);

    // Rung 4, only if the first three found nothing.
    if (target === undefined) target = findFuzzy(kept, event);

    if (target !== undefined) {
      const existing = kept[target];
      if (existing !== undefined) {
        kept[target] = merge(existing, event);
        // The merged record may now carry a URL the original lacked, so the
        // indexes are refreshed rather than left pointing at a stale shape.
        indexOne(kept[target] as SourceEvent, target, byId, byUrl, byShape);
        continue;
      }
    }

    const at = kept.length;
    kept.push(event);
    indexOne(event, at, byId, byUrl, byShape);
  }

  return kept;
}

function indexOne(
  event: SourceEvent,
  at: number,
  byId: Map<string, number>,
  byUrl: Map<string, number>,
  byShape: Map<string, number>,
): void {
  byId.set(event.id, at);
  const url = urlKey(event);
  if (url !== undefined) byUrl.set(url, at);
  byShape.set(shapeKey(event), at);
}

/**
 * Rung 2: the canonical URL **and the day**, never the URL alone.
 *
 * Found by a fixture, not by reasoning. A weekly farmers' market has one page
 * for every occurrence, so matching on URL alone silently collapsed next
 * Saturday's market into this Saturday's — exactly the "do not merge separate
 * dates of a recurring market" case, defeated by the rung meant to be the
 * second most trustworthy.
 *
 * A URL with no parsed start is not a usable key at all: it would merge every
 * undated listing on a venue's site into one event.
 */
function urlKey(event: SourceEvent): string | undefined {
  if (event.url === undefined) return undefined;
  if (event.startsAt === undefined) return undefined;
  return `${event.url.toLowerCase()}@${event.startsAt.slice(0, 10)}`;
}

/** Rung 3: normalised title, place, and the calendar day it starts. */
function shapeKey(event: SourceEvent): string {
  return [normaliseTitle(event.title), placeKey(event), dayKey(event)].join('|');
}

function placeKey(event: SourceEvent): string {
  const place = event.venue ?? event.address ?? '';
  return place.toLowerCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The day an event starts, or its own id when that is unknown.
 *
 * Falling back to the id rather than to a shared empty string is what stops
 * every undated event in a fetch collapsing into one row.
 */
function dayKey(event: SourceEvent): string {
  return event.startsAt === undefined ? `id:${event.id}` : event.startsAt.slice(0, 10);
}

/**
 * Rung 4. Requires an exact venue match, an exact start match, and one title's
 * words to be a strict subset of the other's.
 */
function findFuzzy(kept: readonly SourceEvent[], event: SourceEvent): number | undefined {
  if (event.startsAt === undefined) return undefined;
  const place = placeKey(event);
  if (place === '') return undefined;

  const words = new Set(normaliseTitle(event.title).split(' ').filter(Boolean));
  if (words.size === 0) return undefined;

  for (let index = 0; index < kept.length; index += 1) {
    const candidate = kept[index];
    if (candidate === undefined) continue;
    if (candidate.startsAt !== event.startsAt) continue;
    if (placeKey(candidate) !== place) continue;

    const theirs = new Set(normaliseTitle(candidate.title).split(' ').filter(Boolean));
    if (theirs.size === 0) continue;
    if (isSubset(words, theirs) || isSubset(theirs, words)) return index;
  }

  return undefined;
}

function isSubset(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const word of a) if (!b.has(word)) return false;
  return true;
}

/**
 * Two records of one event into the better one.
 *
 * Field by field, the more complete value wins — a listing with a description
 * beats one without, whichever arrived first. Links and queries are unioned,
 * because "which of our searches found this" is the whole point of tracking
 * them and discarding one would lose a category badge.
 */
function merge(existing: SourceEvent, incoming: SourceEvent): SourceEvent {
  return {
    ...existing,
    // The longer title is usually the fuller one: "San Jose Sharks vs Los
    // Angeles Kings" over "Sharks vs Kings".
    title: incoming.title.length > existing.title.length ? incoming.title : existing.title,
    ...pick('when', existing.when, incoming.when),
    ...pickOptional('startsAt', existing.startsAt, incoming.startsAt),
    ...pickOptional('endsAt', existing.endsAt, incoming.endsAt),
    ...pickOptional('venue', existing.venue, incoming.venue),
    ...pickOptional('address', existing.address, incoming.address),
    ...pickOptional('description', existing.description, incoming.description),
    ...pickOptional('thumbnailUrl', existing.thumbnailUrl, incoming.thumbnailUrl),
    ...pickOptional('url', existing.url, incoming.url),
    ...((existing.coordinates ?? incoming.coordinates) === undefined
      ? {}
      : { coordinates: existing.coordinates ?? incoming.coordinates }),
    links: unionLinks(existing.links, incoming.links),
    queries: [...new Set([...existing.queries, ...incoming.queries])],
  };
}

function pick<K extends string>(key: K, a: string, b: string): Record<K, string> {
  return { [key]: b.length > a.length ? b : a } as Record<K, string>;
}

function pickOptional<K extends string>(
  key: K,
  a: string | undefined,
  b: string | undefined,
): Record<K, string> | Record<string, never> {
  const chosen = a ?? b;
  if (chosen === undefined) return {};
  // Both present: keep the longer, which is the more specific address or the
  // fuller description.
  if (a !== undefined && b !== undefined) {
    return { [key]: b.length > a.length ? b : a } as Record<K, string>;
  }
  return { [key]: chosen } as Record<K, string>;
}

function unionLinks(a: readonly EventLink[], b: readonly EventLink[]): readonly EventLink[] {
  const seen = new Map<string, EventLink>();
  for (const link of [...a, ...b]) {
    if (!seen.has(link.url)) seen.set(link.url, link);
  }
  return [...seen.values()];
}

// --- Geocoding ------------------------------------------------------------

/**
 * Coordinates for everything that needs them, from the cache wherever possible.
 *
 * Three tiers, in order: the provider already said, SQLite already knows, or we
 * ask MapTiler once and store the answer forever. A venue does not move, so the
 * third tier runs at most once per distinct address for the life of the
 * dashboard.
 */
async function locate(
  events: readonly SourceEvent[],
  input: {
    readonly geocoder: Geocoder | null;
    readonly store: EventStore | null;
    readonly nowMs: number;
    readonly onWarn?: (message: string, error: unknown) => void;
  },
): Promise<{ events: readonly LocalEvent[]; geocodeCalls: number }> {
  const needed = events.filter(
    (event) => event.coordinates === undefined && hasPlace(event),
  );
  const keys = new Map<string, string>();
  for (const event of needed) keys.set(event.id, addressKey(event));

  // `match: undefined` is a *stored miss* — we asked and nothing passed the
  // gates — which is a different thing from the key being absent, meaning we
  // have not asked yet. The pipeline treats them differently, so the type has
  // to keep them apart.
  let cached = new Map<string, { match: EventCoordinates | undefined }>();
  if (input.store !== null) {
    try {
      const rows = input.store.geocodesFor([...new Set(keys.values())]);
      cached = new Map(
        [...rows].map(([key, value]) => [
          key,
          { match: value.match === null ? undefined : toCoordinates(value.match) },
        ]),
      );
    } catch (error) {
      // A broken cache costs lookups, never the screen.
      input.onWarn?.('Could not read the geocode cache', error);
    }
  }

  const resolved = new Map<string, EventCoordinates | undefined>();
  let geocodeCalls = 0;

  for (const event of needed) {
    const key = keys.get(event.id);
    if (key === undefined) continue;
    if (resolved.has(key)) continue;

    const hit = cached.get(key);
    if (hit !== undefined) {
      resolved.set(key, hit.match);
      continue;
    }

    if (input.geocoder === null) {
      resolved.set(key, undefined);
      continue;
    }

    try {
      geocodeCalls += 1;
      const match = await input.geocoder.locate({
        ...(event.address === undefined ? {} : { address: event.address }),
        ...(event.venue === undefined ? {} : { venue: event.venue }),
      });

      if (match === null) {
        resolved.set(key, undefined);
        try {
          input.store?.recordMiss(key, input.nowMs);
        } catch (error) {
          input.onWarn?.('Could not record a geocode miss', error);
        }
      } else {
        resolved.set(key, toCoordinates(match));
        try {
          input.store?.recordHit(key, match, input.nowMs);
        } catch (error) {
          input.onWarn?.('Could not record a geocode hit', error);
        }
      }
    } catch (error) {
      /*
       * The geocoder being down is not this event's fault and not permanent.
       * Nothing is stored, so the next refresh tries again — unlike a genuine
       * miss, which is stored precisely so it is not retried.
       */
      resolved.set(key, undefined);
      input.onWarn?.('Geocoding failed; the event will be listed but not pinned', error);
    }
  }

  const located = events.map((event): LocalEvent => {
    if (event.coordinates !== undefined) {
      return {
        ...event,
        coordinates: {
          latitude: event.coordinates.latitude,
          longitude: event.coordinates.longitude,
          source: 'provider',
        },
      };
    }

    const key = keys.get(event.id);
    const match = key === undefined ? undefined : resolved.get(key);
    if (match === undefined) {
      // `coordinates` is deliberately absent rather than undefined, because
      // exactOptionalPropertyTypes treats those as different things.
      const { coordinates: _dropped, ...rest } = event;
      return rest;
    }
    return { ...event, coordinates: match };
  });

  return { events: located, geocodeCalls };
}

function toCoordinates(match: {
  latitude: number;
  longitude: number;
  source: 'address' | 'venue';
}): EventCoordinates {
  return { latitude: match.latitude, longitude: match.longitude, source: match.source };
}

function hasPlace(event: SourceEvent): boolean {
  return (
    (event.address !== undefined && event.address.trim() !== '') ||
    (event.venue !== undefined && event.venue.trim() !== '')
  );
}

// --- Ordering -------------------------------------------------------------

/**
 * Soonest first, and pinned before unpinned.
 *
 * Unpinned events go last because the page is a map: an event with no pin is
 * still shown and still counted, but it cannot be the first thing the list
 * points at. Undated events go last of all, since "soonest" means nothing
 * for them.
 */
export function sortEvents(events: readonly LocalEvent[]): LocalEvent[] {
  return [...events].sort((a, b) => {
    const pinnedDiff = Number(b.coordinates !== undefined) - Number(a.coordinates !== undefined);
    if (pinnedDiff !== 0) return pinnedDiff;

    if (a.startsAt !== undefined && b.startsAt !== undefined) {
      if (a.startsAt !== b.startsAt) return a.startsAt < b.startsAt ? -1 : 1;
    } else if (a.startsAt !== b.startsAt) {
      return a.startsAt === undefined ? 1 : -1;
    }

    return a.title.localeCompare(b.title);
  });
}
