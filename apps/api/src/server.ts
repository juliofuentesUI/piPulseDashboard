import Fastify from 'fastify';

import { config } from './config.js';
import { TtlCache } from './cache.js';
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

/*
 * The screen polls us every minute and we poll Google every ten. This cache is
 * what keeps those two rates apart, so a browser refresh — or a second Pi on
 * the same network — costs Google nothing.
 */
const trendsCache = new TtlCache<readonly TrendingSearch[]>({
  ttlMs: config.trends.cacheTtlMs,
  load: () => trendProvider.getTrendingNow(config.trends.region),
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
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

void start();
