import Fastify from 'fastify';

import { config } from './config.js';
import { TtlCache } from './cache.js';
import { SchemaMigrationError, startOfLocalDay, TrendHistoryStore } from './history.js';
import { GoogleTrendingRssProvider, type TrendProvider } from './trends.js';
import type { ApiErrorBody, TrendingSearch, TrendsSnapshot, WeatherSnapshot } from './types.js';
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

    return trends;
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

app.get('/api/trends/now', async (request, reply) => {
  try {
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
     * `storedAt` and not "now": this is when the list was actually retrieved
     * from Google, which is the age the screen has to report. The two numbers
     * differ by up to the cache TTL on every request served from cache.
     */
    const snapshot: TrendsSnapshot = {
      region: config.trends.region,
      trends: result.value,
      updatedAt: new Date(result.storedAt).toISOString(),
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
    return history.dayDigest({
      sinceMs: startOfLocalDay(now, config.location.timezone),
      untilMs: now,
      timezone: config.location.timezone,
      limit: DAY_ENTRY_LIMIT,
    });
  } catch (error) {
    request.log.error({ err: error }, 'Trend day digest failed');
    const body: ApiErrorBody = {
      error: 'history_unavailable',
      message: 'Could not read trend history.',
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
        process.exit(0);
      },
      () => process.exit(1),
    );
  });
}

void start();
