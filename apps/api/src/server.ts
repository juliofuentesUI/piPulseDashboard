import Fastify from 'fastify';

import { config } from './config.js';
import { TtlCache } from './cache.js';
import { CategoriserUnavailableError, TrendCategoriser } from './categorise.js';
import { buildEvents } from './event-pipeline.js';
import { SerpApiEventProvider, type EventProvider } from './events.js';
import { MockEventProvider } from './events-mock.js';
import { EventStore } from './events-store.js';
import { MapTilerGeocoder, type Geocoder } from './geocode.js';
import { SchemaMigrationError, startOfLocalDay, TrendHistoryStore } from './history.js';
import { GoogleTrendingRssProvider, type TrendProvider } from './trends.js';
import type {
  ApiErrorBody,
  EventsSnapshot,
  TrendingSearch,
  TrendsRefreshResult,
  TrendsSnapshot,
  WeatherSnapshot,
} from './types.js';
import { fetchWeather } from './weather.js';

const app = Fastify({
  logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
});

const weatherCache = new TtlCache<WeatherSnapshot>({
  ttlMs: config.cacheTtlMs,
  load: () => fetchWeather(config.location, config.requestTimeoutMs),
});

/**
 * Swapping the RSS export for the official API later is a change to this one
 * binding; nothing downstream of the cache knows which one it was.
 */
const trendProvider: TrendProvider = new GoogleTrendingRssProvider({
  timeoutMs: config.trends.requestTimeoutMs,
});

/**
 * The local record. Opening it is allowed to fail — a Pi with a full or
 * read-only disk should still show what is trending right now, just without
 * remembering it — so every use of this is guarded.
 */
let history: TrendHistoryStore | null = null;
try {
  history = new TrendHistoryStore(config.trends.databasePath);

  /*
   * Silent on every start after the first, because there is nothing to say.
   * When it does speak it is the one line that proves an upgrade reached the
   * database rather than only the code — which on a Pi that has been
   * collecting for weeks is the thing worth being sure of.
   */
  if (history.migrationsApplied.length > 0) {
    app.log.info(
      { columns: history.migrationsApplied },
      'Trend history schema upgraded in place',
    );
  }
} catch (error) {
  /*
   * Two failures, one symptom. Both leave the screen with no history, but a
   * schema that would not upgrade is our bug and a disk that will not take a
   * write is the SD card — and from the panel they look identical, which is
   * exactly why the log has to separate them.
   */
  app.log.error(
    { err: error },
    error instanceof SchemaMigrationError
      ? 'Trend history schema could not be upgraded; running without history'
      : 'Trend history unavailable; running without it',
  );
}

/**
 * The categoriser, or null when there is nothing to categorise with.
 *
 * No key means none is constructed, which is the whole "works with it off"
 * property: nothing is called, nothing is logged per fetch, and the screen is
 * exactly what it was before this feature existed.
 */
const categoriser =
  config.categories.enabled && config.categories.apiKey !== ''
    ? new TrendCategoriser({
        apiKey: config.categories.apiKey,
        model: config.categories.model,
        timeoutMs: config.categories.requestTimeoutMs,
        reasoningEffort: config.categories.reasoningEffort,
      })
    : null;

if (categoriser === null) {
  app.log.info('Trend categories are off; no OPENAI_API_KEY set or disabled');
}

/**
 * Stops all categorising until the process restarts.
 *
 * Only one thing trips this: an account with no credit, which answers 429 like
 * a rate limit but never recovers. Everything else is left to heal itself,
 * because "uncategorised" is already the retry list — a trend that fails now is
 * still on the feed in ten minutes and gets asked about again.
 */
let categoriesHalted = false;

/**
 * Only one batch in flight at a time.
 *
 * A fetch takes ten minutes to come round and a batch takes about two seconds,
 * so these should never overlap — but "should never" is not a guarantee, and
 * two concurrent batches would ask about the same trends twice and pay twice.
 */
let categorising: Promise<void> | null = null;

/**
 * Asks about the trends in this fetch that have never been settled.
 *
 * Deliberately **not** awaited by the caller. This runs after the list has
 * already been handed back, so a slow or failing OpenAI cannot delay the
 * screen's first paint — badges simply appear on the next 60-second poll,
 * which is the right trade for a mark that is not load-bearing.
 */
function categoriseNew(trends: readonly TrendingSearch[]): Promise<void> | null {
  if (categoriser === null || history === null || categoriesHalted) return null;
  if (categorising !== null) return categorising;

  const store = history;
  const model = config.categories.model;

  const pending = store.needCategory(trends.map((trend) => trend.id));
  if (pending.length === 0) return null;

  const batch = trends.filter((trend) => pending.includes(trend.id));

  categorising = (async () => {
    try {
      const result = await categoriser.categorise(batch);

      store.recordCategories(
        { asked: pending, settled: result.categories, model },
        Date.now(),
      );

      if (result.rejected.length > 0) {
        // Never silent. A rejected answer is either a model that drifted or a
        // bug in our validation, and both need to be visible to be found.
        app.log.warn({ rejected: result.rejected }, 'Discarded category answers');
      }

      app.log.info(
        {
          asked: pending.length,
          settled: result.categories.size,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
        },
        'Categorised new trends',
      );
    } catch (error) {
      if (error instanceof CategoriserUnavailableError && error.permanent) {
        categoriesHalted = true;
        app.log.error(
          { err: error },
          'Trend categories halted until restart; this will not recover on its own',
        );
      } else {
        // Counts the attempt even though nothing was settled, so a trend the
        // model will not answer for is eventually left alone rather than asked
        // about on every fetch until it drops off the feed.
        try {
          store.recordCategories(
            { asked: pending, settled: new Map(), model },
            Date.now(),
          );
        } catch (writeError) {
          app.log.error({ err: writeError }, 'Could not record category attempt');
        }
        app.log.warn({ err: error }, 'Could not categorise this batch; will retry');
      }
    } finally {
      categorising = null;
    }
  })();

  return categorising;
}

/**
 * Longest the list will wait for its badges before going out without them.
 *
 * The batch itself measures about 2.3 seconds for ten trends at `minimal`
 * effort, so in the ordinary case this is never reached and the list and its
 * badges arrive together — which is what stops a badge visibly popping in
 * seconds after the row it belongs to.
 *
 * The cap is what keeps that from becoming a dependency. If OpenAI is slow, the
 * list goes out bare and the batch keeps running; the client asks again shortly
 * and picks the answers up. A screen that will not show trending searches
 * because a labelling service is having a bad day would be a much worse
 * dashboard than one with late badges.
 *
 * Paid at most once per upstream fetch — every other request is served from a
 * ten-minute cache and never reaches this path at all.
 */
const CATEGORISE_WAIT_MS = 4000;

/*
 * The screen polls us every minute and we poll Google every ten. This cache is
 * what keeps those two rates apart, so a browser refresh — or a second Pi on
 * the same network — costs Google nothing.
 */
const trendsCache = new TtlCache<readonly TrendingSearch[]>({
  ttlMs: config.trends.cacheTtlMs,
  load: async () => {
    const trends = await trendProvider.getTrendingNow(config.trends.region);

    /*
     * `load` runs only on a cache miss, which is exactly once per successful
     * upstream fetch — so this is the one place a snapshot belongs. The write
     * is deliberately not awaited into the failure path: losing a history row
     * must never cost the screen its live list.
     */
    try {
      history?.record(trends, Date.now());
    } catch (error) {
      app.log.error({ err: error }, 'Could not record trend snapshot');
    }

    /*
     * Wait a moment for the badges, but never longer than the cap.
     *
     * This runs only on a cache miss — once per upstream fetch — so it costs
     * a few seconds every ten minutes and nothing at all in between. What it
     * buys is the list and its badges arriving in the same paint, instead of
     * the badges appearing seconds later on rows the eye has already read.
     */
    const settling = categoriseNew(trends);
    if (settling !== null) {
      await Promise.race([
        settling,
        new Promise((resolve) => setTimeout(resolve, CATEGORISE_WAIT_MS)),
      ]);
    }

    return trends;
  },
});

/**
 * The stored category for each trend, where there is one.
 *
 * Read time, not write time. The list is cached for ten minutes and a trend is
 * usually categorised a second or two after it first appears in one, so
 * attaching this to the cached value would hold every badge back by up to a
 * full cache period for no reason.
 */
function attachCategories(
  trends: readonly TrendingSearch[],
): readonly TrendingSearch[] {
  if (history === null || trends.length === 0) return trends;

  let categories: Map<string, string>;
  try {
    categories = history.categoriesFor(trends.map((trend) => trend.id));
  } catch (error) {
    // A category is decoration; the list is not. A failed lookup costs badges
    // and nothing else.
    app.log.warn({ err: error }, 'Could not read trend categories');
    return trends;
  }
  if (categories.size === 0) return trends;

  return trends.map((trend) => {
    const category = categories.get(trend.id);
    return category === undefined ? trend : { ...trend, category };
  });
}

/**
 * The events source, chosen by `EVENTS_PROVIDER`.
 *
 * This one binding is the whole point of the `EventProvider` interface: the
 * pipeline, the route and the browser see the same normalised shape either way,
 * so moving to real data is this line and nothing else.
 *
 * It defaults to the mock because SerpApi's Google Events engine has answered
 * every query with nothing since 2026-08-04.
 */
const eventProvider: EventProvider | null = (() => {
  if (config.events.provider === 'serpapi') {
    if (config.events.serpApiKey === '') {
      app.log.error('EVENTS_PROVIDER=serpapi but no SERPAPI_KEY is set; events are off');
      return null;
    }
    return new SerpApiEventProvider({
      apiKey: config.events.serpApiKey,
      timeoutMs: config.events.requestTimeoutMs,
      queries: config.events.queries,
      location: config.events.searchLocation,
      timeZone: config.location.timezone,
    });
  }
  return new MockEventProvider({ timeZone: config.location.timezone });
})();

if (eventProvider?.source === 'mock') {
  app.log.warn(
    'Events are served from the MOCK provider — this data is fabricated. ' +
      'Set EVENTS_PROVIDER=serpapi for real listings.',
  );
}

/**
 * The geocoder, or null when there is no key.
 *
 * Absent means every event is listed and none is pinned, which is a working
 * screen rather than a broken one — the same "works with it off" property the
 * categoriser has.
 */
const geocoder: Geocoder | null =
  config.events.mapTilerKey === ''
    ? null
    : new MapTilerGeocoder({
        apiKey: config.events.mapTilerKey,
        timeoutMs: config.events.geocodeTimeoutMs,
        center: {
          latitude: config.location.latitude,
          longitude: config.location.longitude,
        },
        // Deliberately not `radiusMiles`. This bound rejects nonsense; the
        // pipeline separately drops anything outside the display radius, so
        // "too far away" and "could not be placed" stay different answers.
        sanityMiles: config.events.geocodeSanityMiles,
      });

if (geocoder === null && eventProvider !== null) {
  app.log.warn('No MAPTILER_KEY set; events will be listed but never pinned');
}

/**
 * The permanent address-to-coordinate cache. Opening it is allowed to fail for
 * the same reason the trend history is: a full or read-only SD card should cost
 * pins, not the screen.
 */
let eventStore: EventStore | null = null;
if (eventProvider !== null) {
  try {
    eventStore = new EventStore(config.events.databasePath);
  } catch (error) {
    app.log.error({ err: error }, 'Geocode cache unavailable; running without it');
  }
}

/*
 * A day, not ten minutes. Seven SerpApi searches a day is ~217 a month against
 * a 250 free tier; three-hourly would be 1,680 and past the paid plan too.
 *
 * Nothing drives this on a timer. Like the trends cache, it refreshes on the
 * first miss after the TTL — so a Pi that is switched off spends no quota, and
 * a carousel swipe or a browser reload costs nothing.
 */
const eventsCache = new TtlCache<EventsSnapshot>({
  ttlMs: config.events.cacheTtlMs,
  load: async () => {
    if (eventProvider === null) throw new Error('events are disabled');

    const fetched = await eventProvider.getEvents();

    if (fetched.emptyQueries.length > 0) {
      // The signature of the current outage. Logged as a count rather than a
      // failure, because Google returning nothing is not an error we can fix.
      app.log.warn(
        { empty: fetched.emptyQueries.length, of: fetched.callsMade },
        'Some event queries returned nothing',
      );
    }

    const built = await buildEvents({
      events: fetched.events,
      center: {
        latitude: config.location.latitude,
        longitude: config.location.longitude,
      },
      radiusMiles: config.events.radiusMiles,
      geocoder,
      store: eventStore,
      nowMs: Date.now(),
      onWarn: (message, error) => app.log.warn({ err: error }, message),
    });

    app.log.info(
      {
        source: eventProvider.source,
        upstreamCalls: fetched.callsMade,
        geocodeCalls: built.geocodeCalls,
        ...built.counts,
      },
      'Events refreshed',
    );

    return {
      events: built.events,
      updatedAt: new Date().toISOString(),
      source: eventProvider.source,
      center: {
        name: config.location.name,
        latitude: config.location.latitude,
        longitude: config.location.longitude,
      },
      radiusMiles: config.events.radiusMiles,
      counts: built.counts,
    };
  },
});

app.get('/api/health', async () => ({
  ok: true,
  location: config.location.name,
  cacheTtlMs: config.cacheTtlMs,
}));

app.get('/api/weather', async (request, reply) => {
  try {
    const result = await weatherCache.get();

    if (result.state === 'stale') {
      request.log.warn('Serving stale weather; upstream refresh failed');
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - result.storedAt) / 1000));
    reply
      .header('cache-control', 'no-cache')
      .header('x-cache', result.state)
      .header('age', String(ageSeconds));

    return result.value;
  } catch (error) {
    request.log.error({ err: error }, 'Weather lookup failed with no cached fallback');
    const body: ApiErrorBody = {
      error: 'weather_unavailable',
      message: 'Could not retrieve weather data right now.',
    };
    return reply.code(503).send(body);
  }
});

/**
 * Shortest gap allowed between *forced* upstream fetches.
 *
 * The ten-minute cache exists to protect an unauthenticated feed that Google
 * rate-limits by IP, and a button on a touchscreen is exactly the thing that
 * would hammer it — a wall display invites idle prodding in a way a CLI does
 * not. This is the floor that keeps "refresh now" from becoming "refresh
 * forty times".
 *
 * Thirty seconds, not the full ten minutes: the point of the control is that
 * the ten minutes is sometimes too long to wait, so a floor anywhere near it
 * would defeat the feature. Google's feed only turns over every ten to twenty
 * minutes anyway, so a faster press mostly returns the same list — which costs
 * one request and disappoints nobody.
 */
const FORCED_FETCH_FLOOR_MS = 30_000;

let lastForcedFetchMs = 0;

app.get('/api/trends/now', async (request, reply) => {
  try {
    /*
     * `?refresh=1` drops the cache so the next read goes to Google. Refused
     * silently inside the floor: the honest answer to "refresh" when the data
     * is fifteen seconds old is the data we already have, and an error would
     * make a working button look broken.
     */
    const forced = (request.query as { refresh?: string }).refresh === '1';
    let refreshResult: TrendsRefreshResult | undefined;
    if (forced) {
      const now = Date.now();
      const since = now - lastForcedFetchMs;
      if (since >= FORCED_FETCH_FLOOR_MS) {
        lastForcedFetchMs = now;
        trendsCache.invalidate();
        refreshResult = { honoured: true, retryAfterMs: FORCED_FETCH_FLOOR_MS };
        request.log.info('Manual refresh; dropping the trends cache');
      } else {
        refreshResult = { honoured: false, retryAfterMs: FORCED_FETCH_FLOOR_MS - since };
        request.log.info({ withinMs: since }, 'Manual refresh refused; inside the floor');
      }
    }

    const result = await trendsCache.get();

    if (result.state === 'stale') {
      request.log.warn('Serving stale trends; Google refresh failed');
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - result.storedAt) / 1000));
    reply
      .header('cache-control', 'no-cache')
      .header('x-cache', result.state)
      .header('age', String(ageSeconds));

    /*
     * Categories are attached at read time rather than stored on the cached
     * list, so a trend categorised a minute after it was fetched gets its badge
     * on the very next poll instead of waiting out the ten-minute cache.
     *
     * Guarded like every other use of the store: no database, no categories, no
     * badges, and the list is untouched.
     */
    const withCategories = attachCategories(result.value);

    /*
     * `storedAt` and not "now": this is when the list was actually retrieved
     * from Google, which is the age the screen has to report. The two numbers
     * differ by up to the cache TTL on every request served from cache.
     */
    const snapshot: TrendsSnapshot = {
      region: config.trends.region,
      trends: withCategories,
      updatedAt: new Date(result.storedAt).toISOString(),
      categories: {
        state: categoriser === null ? 'off' : categoriesHalted ? 'halted' : 'ready',
        pending: withCategories.filter((trend) => trend.category === undefined).length,
      },
      ...(refreshResult === undefined ? {} : { refresh: refreshResult }),
    };
    return snapshot;
  } catch (error) {
    request.log.error({ err: error }, 'Trends lookup failed with no cached fallback');
    const body: ApiErrorBody = {
      error: 'trends_unavailable',
      message: 'Could not retrieve search trends right now.',
    };
    return reply.code(503).send(body);
  }
});

app.get('/api/trends/history', async (request, reply) => {
  const key = (request.query as { key?: string }).key?.trim();
  if (key === undefined || key === '') {
    const body: ApiErrorBody = {
      error: 'key_required',
      message: 'Pass ?key= the trend id to look up.',
    };
    return reply.code(400).send(body);
  }

  if (history === null) {
    const body: ApiErrorBody = {
      error: 'history_unavailable',
      message: 'Trend history storage is not available.',
    };
    return reply.code(503).send(body);
  }

  try {
    reply.header('cache-control', 'no-cache');
    // An unseen trend is a normal answer, not an error: it is what every
    // trend looks like on a Pi that has only just been switched on.
    return history.historyFor(key, Date.now());
  } catch (error) {
    request.log.error({ err: error }, 'Trend history lookup failed');
    const body: ApiErrorBody = {
      error: 'history_unavailable',
      message: 'Could not read trend history.',
    };
    return reply.code(503).send(body);
  }
});

/**
 * How many of the day's trends the TODAY view has room for: all ten of a
 * fetch, in two columns of five. The live list deliberately shows five, because
 * its hidden rows are the least interesting under whichever ordering is active;
 * a day's record has no such excuse, and the room exists here.
 */
const DAY_ENTRY_LIMIT = 10;

app.get('/api/trends/today', async (request, reply) => {
  if (history === null) {
    const body: ApiErrorBody = {
      error: 'history_unavailable',
      message: 'Trend history storage is not available.',
    };
    return reply.code(503).send(body);
  }

  try {
    /*
     * The day is drawn on the dashboard's own wall clock, not UTC. Rows are
     * stored in UTC and San Jose is seven hours behind it, so a UTC boundary
     * would roll the list over in the late afternoon and call it a new day.
     */
    const now = Date.now();
    reply.header('cache-control', 'no-cache');

    const day = history.dayDigest({
      sinceMs: startOfLocalDay(now, config.location.timezone),
      untilMs: now,
      timezone: config.location.timezone,
      limit: DAY_ENTRY_LIMIT,
    });

    // Only the ten entries that survived the cut need a lookup, same as the
    // headlines are attached after the list is trimmed rather than before.
    const categories = history.categoriesFor(
      day.entries.map((entry) => entry.trendKey),
    );
    if (categories.size === 0) return day;

    return {
      ...day,
      entries: day.entries.map((entry) => {
        const category = categories.get(entry.trendKey);
        return category === undefined ? entry : { ...entry, category };
      }),
    };
  } catch (error) {
    request.log.error({ err: error }, 'Trend day digest failed');
    const body: ApiErrorBody = {
      error: 'history_unavailable',
      message: 'Could not read trend history.',
    };
    return reply.code(503).send(body);
  }
});

app.get('/api/events', async (request, reply) => {
  if (eventProvider === null) {
    const body: ApiErrorBody = {
      error: 'events_disabled',
      message: 'The events source is not configured.',
    };
    return reply.code(503).send(body);
  }

  try {
    const result = await eventsCache.get();

    if (result.state === 'stale') {
      request.log.warn('Serving stale events; the upstream refresh failed');
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - result.storedAt) / 1000));
    reply
      .header('cache-control', 'no-cache')
      .header('x-cache', result.state)
      .header('age', String(ageSeconds));

    /*
     * `storedAt` rather than "now", same as the trends route: this is when the
     * list was actually fetched, which is the age the screen has to report.
     */
    return { ...result.value, updatedAt: new Date(result.storedAt).toISOString() };
  } catch (error) {
    request.log.error({ err: error }, 'Events lookup failed with no cached fallback');
    const body: ApiErrorBody = {
      error: 'events_unavailable',
      message: 'Could not retrieve nearby events right now.',
    };
    return reply.code(503).send(body);
  }
});

async function start(): Promise<void> {
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      `Weather for ${config.location.name} (${config.location.latitude}, ${config.location.longitude})`,
    );
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    void app.close().then(
      () => {
        history?.close();
        eventStore?.close();
        process.exit(0);
      },
      () => process.exit(1),
    );
  });
}

void start();
