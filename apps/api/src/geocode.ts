/**
 * Turning an address or a venue name into a place we can put a pin.
 *
 * Every rule in this file was measured against MapTiler's live endpoint on
 * 2026-08-05 and the results are recorded in `docs/events-map-plan.md`
 * (measurement 7). Read that before loosening any of them — the defaults are
 * not merely imprecise, they are confidently wrong in a way that would put
 * pins in Egypt and Nicaragua on a wall display.
 *
 * The four rules, and what each one alone fails to catch:
 *
 *  1. **Venue names go to the POI index** (`types=poi`). Default settings got
 *     zero of six real venues right; the POI index got four of six exactly
 *     right at relevance 1.
 *  2. **`place_type` is the confidence signal, not `relevance`.** When the
 *     geocoder cannot find a thing it falls back to a container — a city, a
 *     postcode, a landform — and says which. Only `address` and `poi` mean it
 *     found what was asked for.
 *  3. **Relevance still filters**, but never alone: "SAP Center" scored 0.912
 *     for a landform in Egypt and "Online Event" scored 0.92 for a business in
 *     Norwich.
 *  4. **Distance is the last line and catches what nothing else does.** The
 *     Norwich result passes rules 1–3 and is killed only by being 5,349 miles
 *     from San Jose.
 *
 * Rule 4's bound is a **sanity** bound, not the screen's radius, and the two are
 * deliberately different numbers. This one asks "is this result nonsense?"; the
 * pipeline separately asks "is this near enough to show?". Sharing one value
 * conflated them — a real venue 25 miles away came back indistinguishable from
 * an address nobody could place, so the screen could not tell the user which
 * had happened.
 *
 * And one prohibition: **never send `bbox`.** It does not reject out-of-area
 * results, it forces a result into the box — "Online Event" constrained to a
 * San Jose box returned a real venue in Milpitas, 6.4 miles away and entirely
 * fabricated. That defeats rule 4, which is the strongest rule here. Use
 * `proximity`, which biases ranking without constraining results, and check the
 * distance afterwards.
 */

const GEOCODE_URL = 'https://api.maptiler.com/geocoding';

/**
 * Below this, a match is not trusted even when its type is right.
 *
 * 0.8 rather than 1.0 because a correct street address with a spelling
 * variation scores below 1 routinely, and rules 2 and 4 are doing the real
 * work. Measured misses scored 0.37 and 0.67; measured hits scored 1.
 */
const MIN_RELEVANCE = 0.8;

/**
 * Rule 4's default ceiling, in miles.
 *
 * Wide enough that no plausible Bay Area venue is refused, narrow enough that
 * every measured failure is caught: Norwich was 5,349 miles out, Egypt 7,667,
 * Nicaragua 2,867. The furthest genuine venue in the fixtures is 25 miles.
 */
const DEFAULT_SANITY_MILES = 150;

/** The only `place_type` values that mean "I found the thing you asked for". */
const ADDRESS_TYPES = new Set(['address']);
const VENUE_TYPES = new Set(['poi']);

export interface GeocodeMatch {
  readonly latitude: number;
  readonly longitude: number;
  /** Which of the two lookups produced it. */
  readonly source: 'address' | 'venue';
  /** What MapTiler called the place. Stored for debugging a bad pin later. */
  readonly placeName: string;
  readonly relevance: number;
}

/** Raised only when the service is unreachable — never for "no good match". */
export class GeocoderUnavailableError extends Error {
  override readonly name = 'GeocoderUnavailableError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export interface Geocoder {
  /**
   * Resolves an event's location, or `null` when no result passes the gates.
   *
   * `null` is a normal answer and means *listed but not pinned*. It is not an
   * error and must never be treated as one.
   */
  locate(query: {
    readonly address?: string | undefined;
    readonly venue?: string | undefined;
  }): Promise<GeocodeMatch | null>;
}

interface MapTilerFeature {
  readonly center?: readonly number[];
  readonly place_name?: string;
  readonly place_type?: readonly string[];
  readonly relevance?: number;
}

export class MapTilerGeocoder implements Geocoder {
  readonly #key: string;
  readonly #timeoutMs: number;
  readonly #proximity: string;
  readonly #center: { latitude: number; longitude: number };
  readonly #sanityMiles: number;

  constructor(options: {
    apiKey: string;
    timeoutMs: number;
    /** Biases ranking towards the dashboard's location, and bounds rule 4. */
    center: { latitude: number; longitude: number };
    /**
     * Rule 4's ceiling: beyond this a result is treated as nonsense rather than
     * as a distant venue. **Not the display radius** — generous on purpose, so
     * that "too far to show" stays distinguishable from "could not be placed".
     */
    sanityMiles?: number;
  }) {
    this.#key = options.apiKey;
    this.#timeoutMs = options.timeoutMs;
    this.#center = options.center;
    this.#sanityMiles = options.sanityMiles ?? DEFAULT_SANITY_MILES;
    this.#proximity = `${options.center.longitude},${options.center.latitude}`;
  }

  async locate(query: {
    readonly address?: string | undefined;
    readonly venue?: string | undefined;
  }): Promise<GeocodeMatch | null> {
    /*
     * A street address first, because it resolves to a building where a venue
     * name resolves to whatever the POI index has. Note that MapTiler discards
     * the venue name from a combined string — measured: querying "El Quito
     * Park, 12855 Paseo Presada, Saratoga, CA 95070" echoed back only the
     * street tokens. So the two lookups are genuinely separate, and sending a
     * combined string would silently be an address-only lookup.
     */
    if (hasStreetNumber(query.address)) {
      const match = await this.#lookup(query.address as string, 'address');
      if (match !== null) return match;
    }

    /*
     * Then the venue name, against the POI index. Reached both when there was
     * no street address and when there was one that did not resolve — measured:
     * "101 Paseo De San Antonio" geocodes to San Antonio, Costa Rica, which
     * rule 2 rejects, and the venue name is the better second chance.
     */
    if (query.venue !== undefined && query.venue.trim() !== '') {
      const match = await this.#lookup(query.venue, 'venue');
      if (match !== null) return match;
    }

    /*
     * An address with no street number, as a last attempt against POI. Covers
     * "Guadalupe River Park, San Jose, CA" arriving in the address field.
     */
    if (
      !hasStreetNumber(query.address) &&
      query.address !== undefined &&
      query.address.trim() !== ''
    ) {
      return this.#lookup(query.address, 'venue');
    }

    return null;
  }

  async #lookup(
    text: string,
    kind: 'address' | 'venue',
  ): Promise<GeocodeMatch | null> {
    const url = new URL(`${GEOCODE_URL}/${encodeURIComponent(text.trim())}.json`);
    url.searchParams.set('key', this.#key);
    url.searchParams.set('proximity', this.#proximity);
    url.searchParams.set('limit', '5');
    // Rule 1. Without this, a venue name is matched as free text against the
    // whole world and returns high-relevance nonsense.
    if (kind === 'venue') url.searchParams.set('types', 'poi');
    // Deliberately no `bbox`. See the prohibition at the top of this file.

    let body: { features?: readonly MapTilerFeature[] };
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.#timeoutMs),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new GeocoderUnavailableError(
          `MapTiler geocoding responded ${response.status} ${response.statusText}`,
        );
      }
      body = (await response.json()) as { features?: readonly MapTilerFeature[] };
    } catch (error) {
      if (error instanceof GeocoderUnavailableError) throw error;
      throw new GeocoderUnavailableError('Could not reach MapTiler geocoding', {
        cause: error,
      });
    }

    const allowed = kind === 'address' ? ADDRESS_TYPES : VENUE_TYPES;

    for (const feature of body.features ?? []) {
      // Rule 2 — the container types mean "I did not find it".
      if (!(feature.place_type ?? []).some((type) => allowed.has(type))) continue;

      // Rule 3.
      const relevance = feature.relevance ?? 0;
      if (relevance < MIN_RELEVANCE) continue;

      // MapTiler returns [longitude, latitude]. Getting this backwards puts
      // California in the Indian Ocean, which rule 4 would then reject — so the
      // symptom of the mistake is "nothing ever geocodes", not a wrong pin.
      const longitude = feature.center?.[0];
      const latitude = feature.center?.[1];
      if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude)) continue;
      if (latitude < -90 || latitude > 90) continue;
      if (longitude < -180 || longitude > 180) continue;

      // Rule 4 — nonsense, not distance-from-the-screen. A real venue beyond
      // this is impossible; a match beyond it is a different continent.
      const miles = milesBetween(this.#center, { latitude, longitude });
      if (miles > this.#sanityMiles) continue;

      return {
        latitude,
        longitude,
        source: kind,
        placeName: feature.place_name ?? text,
        relevance,
      };
    }

    return null;
  }
}

/**
 * Whether a string looks like a street address rather than a venue name.
 *
 * A leading number is the signal, because that is what MapTiler's address index
 * keys on. "12855 Paseo Presada" yes; "El Quito Park" no; "Levi's Stadium" no.
 * A PO box or a suite-first string would fool it, and being wrong here costs a
 * wasted lookup rather than a wrong pin — the type gate still applies.
 */
export function hasStreetNumber(address: string | undefined): boolean {
  return address !== undefined && /(^|,\s*)\d+\s+\S/.test(address.trim());
}

/**
 * The identity of a place for caching purposes: case-folded, punctuation
 * flattened, whitespace collapsed.
 *
 * Deliberately conservative, in the same spirit as `trendKey`. It exists so
 * that "12855 Paseo Presada, Saratoga, CA" and "12855 Paseo Presada,
 * Saratoga, CA " are one lookup, not so that two different ways of naming a
 * place are merged.
 */
export function addressKey(query: {
  readonly address?: string | undefined;
  readonly venue?: string | undefined;
}): string {
  const parts = [query.venue ?? '', query.address ?? ''];
  return parts
    .join(' | ')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Great-circle distance in miles. */
export function milesBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const EARTH_RADIUS_MILES = 3958.8;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(h));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
