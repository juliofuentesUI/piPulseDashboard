/**
 * A stand-in for Google Events, good enough to build a screen against.
 *
 * This exists because SerpApi's Google Events engine has returned zero results
 * for every query since 2026-08-04 (serpapi/public-roadmap#4117) and the rest
 * of the feature should not wait for it.
 *
 * Two things make it worth more than a hardcoded array:
 *
 *  - **The addresses are real.** With a MapTiler key configured, these events
 *    geocode for real, through the real four-gate rule, and land on the real
 *    map at their real distances. The mock exercises the production path rather
 *    than bypassing it.
 *  - **The awkward cases are deliberate.** Duplicates across queries, a
 *    recurring market on two dates that must *not* merge, a venue MapTiler
 *    genuinely cannot find, an online event that must never be pinned, missing
 *    optional fields, an unparseable date, and one event outside the radius.
 *    Each is annotated with what it is there to prove.
 *
 * **The screen must say this data is fabricated.** `EventsSnapshot.source` is
 * how it knows. A wall display showing invented events as real would be the
 * worst failure this project could have.
 */

import { eventId } from './events.js';
import type { EventFetchResult, EventProvider } from './events.js';
import type { SourceEvent } from './types.js';

const Q_GENERAL = 'events near San Jose CA';
const Q_MARKETS = 'farmers markets and street fairs near San Jose CA';
const Q_FREE = 'free community events near San Jose CA';
const Q_MUSIC = 'live music and nightlife near San Jose CA';
const Q_ART = 'art museum and cultural events near San Jose CA';
const Q_FOOD = 'food festivals and pop-up events near San Jose CA';
const Q_TECH = 'tech meetups and networking events near San Jose CA';

/** One fixture, before dates are anchored to the current week. */
interface MockSeed {
  /** Days from today. Kept small so everything lands inside `date:week`. */
  readonly inDays: number;
  readonly startHour?: number;
  readonly endHour?: number;
  /** Overrides the generated string, for the unparseable-date case. */
  readonly whenOverride?: string;
  readonly title: string;
  readonly venue?: string;
  readonly address?: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly url?: string;
  readonly links?: readonly { label: string; url: string }[];
  readonly queries: readonly string[];
  readonly coordinates?: { latitude: number; longitude: number };
  /** Why this fixture exists. Not shipped to the screen; documentation. */
  readonly proves: string;
}

const SEEDS: readonly MockSeed[] = [
  {
    proves: 'the ordinary case: full address, clean date, geocodes via the address index',
    inDays: 2,
    startHour: 9,
    endHour: 13,
    title: "San Jose Downtown Farmers' Market",
    venue: 'San Pedro Square',
    address: '87 N San Pedro St, San Jose, CA 95110',
    description:
      'Weekly market with local produce, prepared food and live acoustic music along San Pedro Street.',
    // Deliberately unreachable, so the broken-image fallback is exercised as
    // well as the missing-image one. They are different paths: this fires
    // `onerror` after a failed request, where an absent field never requests.
    thumbnailUrl: 'https://example.invalid/img/missing.jpg',
    url: 'https://example.org/sj-farmers-market',
    queries: [Q_MARKETS],
  },
  {
    proves: 'DUPLICATE of the above found by a second query — must merge, unioning queries',
    inDays: 2,
    startHour: 9,
    endHour: 13,
    title: "San Jose Downtown Farmers Market",
    venue: 'San Pedro Square',
    address: '87 N San Pedro St, San Jose, CA 95110',
    url: 'https://example.org/sj-farmers-market',
    queries: [Q_FREE],
  },
  {
    proves: 'RECURRING: same market, next week — must NOT merge with the two above',
    inDays: 9,
    startHour: 9,
    endHour: 13,
    title: "San Jose Downtown Farmers' Market",
    venue: 'San Pedro Square',
    address: '87 N San Pedro St, San Jose, CA 95110',
    url: 'https://example.org/sj-farmers-market',
    queries: [Q_MARKETS],
  },
  {
    proves: 'venue name only, no street address — exercises the POI index path',
    inDays: 3,
    startHour: 19,
    endHour: 22,
    title: 'San Jose Sharks vs Los Angeles Kings',
    venue: 'SAP Center',
    description: 'Regular season home game.',
    thumbnailUrl: poster(210),
    url: 'https://example.org/sharks-kings',
    links: [{ label: 'Ticketmaster', url: 'https://example.org/tickets/sharks' }],
    queries: [Q_GENERAL],
  },
  {
    proves: 'FUZZY DUPLICATE of the Sharks game: reworded title, same venue and start',
    inDays: 3,
    startHour: 19,
    endHour: 22,
    title: 'Sharks vs Kings',
    venue: 'SAP Center',
    links: [{ label: 'SeatGeek', url: 'https://example.org/seatgeek/sharks' }],
    queries: [Q_MUSIC],
  },
  {
    proves:
      'provider-supplied coordinates — must skip geocoding entirely. Also the ' +
      'one seed dated today, so the TODAY filter has something to show.',
    inDays: 0,
    startHour: 17,
    endHour: 21,
    title: 'Music in the Park: Summer Series',
    venue: 'Plaza de César Chávez',
    address: '194 S Market St, San Jose, CA 95113',
    description: 'Free outdoor concert series in the heart of downtown.',
    coordinates: { latitude: 37.3323, longitude: -121.8887 },
    queries: [Q_MUSIC, Q_FREE],
  },
  {
    proves: 'full street address well outside downtown — real 7.3mi distance via address index',
    inDays: 4,
    startHour: 18,
    endHour: 20,
    title: 'El Quito Park Summer Concert',
    venue: 'El Quito Park',
    address: '12855 Paseo Presada, Saratoga, CA 95070',
    description: 'Community band performance on the lawn. Bring a blanket.',
    queries: [Q_FREE, Q_MUSIC],
  },
  {
    proves:
      'THE POSTCODE RESCUES IT, and this is why the two-pass design exists. ' +
      'MapTiler has no POI for this venue at all, and "101 Paseo De San Antonio, ' +
      'San Jose, CA" without a postcode resolves to San Antonio, COSTA RICA — ' +
      'caught only by the place_type gate, which returns `municipality`. With the ' +
      'postcode it resolves correctly to 0.3mi at relevance 0.906. Verified 2026-08-05.',
    inDays: 5,
    startHour: 20,
    title: 'An Evening of Chamber Music',
    venue: 'Hammer Theatre Center',
    address: '101 Paseo De San Antonio, San Jose, CA 95112',
    description: 'String quartet performing Debussy and Ravel.',
    queries: [Q_ART],
  },
  {
    proves:
      'ONLINE EVENT: no real location. Measured to pin to Norwich, England without the ' +
      'distance gate. Must never appear on the map.',
    inDays: 2,
    startHour: 12,
    title: 'Remote Web Performance Workshop',
    address: 'Online Event',
    description: 'Livestreamed workshop on rendering performance.',
    url: 'https://example.org/perf-workshop',
    queries: [Q_TECH],
  },
  {
    proves: 'minimal event: no description, no thumbnail, no URL, no venue',
    inDays: 3,
    startHour: 11,
    title: 'Japantown Community Clean-Up',
    address: '565 N 5th St, San Jose, CA 95112',
    queries: [Q_FREE],
  },
  {
    proves: 'UNPARSEABLE DATE: `when` survives verbatim, startsAt is absent',
    inDays: 0,
    whenOverride: 'Check website for dates',
    title: 'Rotating Exhibition: Bay Area Printmakers',
    venue: 'San Jose Museum of Art',
    address: '110 S Market St, San Jose, CA 95113',
    description: 'Ongoing exhibition; see the museum website for current hours.',
    url: 'https://example.org/sjma-printmakers',
    queries: [Q_ART],
  },
  {
    proves: 'OUTSIDE RADIUS: ~25 miles away, geocodes fine, must be filtered out',
    inDays: 4,
    startHour: 12,
    endHour: 22,
    title: 'Beach Boardwalk Summer Concert',
    venue: 'Santa Cruz Beach Boardwalk',
    address: '400 Beach St, Santa Cruz, CA 95060',
    description: 'Free Friday night concert on the beach.',
    queries: [Q_MUSIC],
  },
  {
    proves: 'address but no venue name — the address index must carry it alone',
    inDays: 1,
    startHour: 18,
    endHour: 21,
    title: 'South Bay JavaScript Meetup',
    address: '2025 Gateway Pl, San Jose, CA 95110',
    description: 'Monthly talks and networking. Pizza at 6, talks at 7.',
    url: 'https://example.org/sbjs',
    queries: [Q_TECH],
  },
  {
    proves: 'multi-day range — start is taken from the first date, end left alone',
    inDays: 5,
    startHour: 10,
    endHour: 18,
    title: 'South FIRST FRIDAYS Art Walk',
    venue: 'SoFA District',
    address: '333 S 1st St, San Jose, CA 95113',
    description: 'Galleries, studios and street vendors across the SoFA district.',
    thumbnailUrl: poster(30),
    queries: [Q_ART, Q_FREE],
  },
  {
    proves: 'two ticket sources on one event — links must both survive',
    inDays: 6,
    startHour: 11,
    endHour: 20,
    title: 'San Jose Street Food Festival',
    venue: 'Guadalupe River Park',
    address: '438 Coleman Ave, San Jose, CA 95110',
    description: 'Forty food trucks, live music and a beer garden along the river.',
    thumbnailUrl: poster(140),
    url: 'https://example.org/street-food',
    links: [
      { label: 'Eventbrite', url: 'https://example.org/eb/street-food' },
      { label: 'Official site', url: 'https://example.org/street-food/tickets' },
    ],
    queries: [Q_FOOD, Q_GENERAL],
  },
];

/**
 * A small synthetic poster, as a self-contained data URI.
 *
 * The fixtures need *some* thumbnails that actually load, or the list view can
 * only ever be seen in its fallback state and the image path goes unverified.
 * Inline SVG keeps that self-contained: no files added to the repo, no external
 * request, and nothing that could be mistaken for a real event's artwork.
 *
 * Real events carry `thumbnail` or `image` from SerpApi, which are Google-hosted
 * URLs. Those are ordinary remote images and need no help from here.
 */
function poster(hue: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144">` +
    `<rect width="144" height="144" fill="hsl(${hue} 45% 82%)"/>` +
    `<rect y="96" width="144" height="48" fill="hsl(${hue} 50% 62%)"/>` +
    `<circle cx="46" cy="52" r="24" fill="hsl(${hue} 65% 46%)"/>` +
    `<rect x="84" y="30" width="38" height="38" fill="hsl(${hue} 60% 54%)"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class MockEventProvider implements EventProvider {
  readonly source = 'mock' as const;

  readonly #timeZone: string;
  readonly #now: () => number;

  constructor(options: { timeZone: string; now?: () => number }) {
    this.#timeZone = options.timeZone;
    this.#now = options.now ?? Date.now;
  }

  async getEvents(): Promise<EventFetchResult> {
    const now = this.#now();

    const events = SEEDS.map((seed, index) => this.#build(seed, now, index));
    return { events, callsMade: 0, emptyQueries: [] };
  }

  #build(seed: MockSeed, nowMs: number, index: number): SourceEvent {
    /*
     * Anchored to the current week rather than hardcoded, so the fixtures stay
     * inside the Today / This Week filters whenever this runs. A fixed date set
     * would fall out of the window within days and quietly make the screen look
     * broken.
     */
    const day = new Date(nowMs + seed.inDays * 24 * 60 * 60 * 1000);

    const when =
      seed.whenOverride ??
      formatWhen(day, this.#timeZone, seed.startHour, seed.endHour);

    const startsAt =
      seed.whenOverride === undefined && seed.startHour !== undefined
        ? atLocalHour(day, this.#timeZone, seed.startHour)
        : undefined;
    const endsAt =
      seed.whenOverride === undefined && seed.endHour !== undefined
        ? atLocalHour(day, this.#timeZone, seed.endHour)
        : undefined;

    return {
      id: eventId(seed.title, seed.venue ?? seed.address, startsAt, index),
      title: seed.title,
      when,
      ...(startsAt === undefined ? {} : { startsAt }),
      ...(endsAt === undefined ? {} : { endsAt }),
      ...(seed.venue === undefined ? {} : { venue: seed.venue }),
      ...(seed.address === undefined ? {} : { address: seed.address }),
      ...(seed.description === undefined ? {} : { description: seed.description }),
      ...(seed.thumbnailUrl === undefined ? {} : { thumbnailUrl: seed.thumbnailUrl }),
      ...(seed.url === undefined ? {} : { url: seed.url }),
      ...(seed.coordinates === undefined ? {} : { coordinates: seed.coordinates }),
      links: seed.links ?? [],
      queries: seed.queries,
    };
  }
}

/** Google's own phrasing, e.g. "Sat, Aug 8, 9 AM – 1 PM". */
function formatWhen(
  day: Date,
  timeZone: string,
  startHour: number | undefined,
  endHour: number | undefined,
): string {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(day);

  if (startHour === undefined) return date;
  const start = hourLabel(startHour);
  if (endHour === undefined) return `${date}, ${start}`;
  return `${date}, ${start} – ${hourLabel(endHour)}`;
}

function hourLabel(hour24: number): string {
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour} ${meridiem}`;
}

/**
 * The instant at which a given local hour falls on that calendar day.
 *
 * Two passes for the same reason `startOfLocalDay` uses two: the first offset
 * is measured at the wrong instant, the second at very nearly the right one.
 */
function atLocalHour(day: Date, timeZone: string, hour: number): string {
  const parts = zonedParts(day.getTime(), timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, 0);
  const approximate = asUtc - offsetAt(asUtc, timeZone);
  return new Date(asUtc - offsetAt(approximate, timeZone)).toISOString();
}

function zonedParts(
  atMs: number,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const found: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(atMs))) {
    if (part.type !== 'literal') found[part.type] = Number(part.value);
  }

  return {
    year: found['year'] ?? 1970,
    month: found['month'] ?? 1,
    day: found['day'] ?? 1,
    hour: (found['hour'] ?? 0) % 24,
    minute: found['minute'] ?? 0,
    second: found['second'] ?? 0,
  };
}

function offsetAt(atMs: number, timeZone: string): number {
  const parts = zonedParts(atMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(atMs / 1000) * 1000;
}
