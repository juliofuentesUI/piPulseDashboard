import Fastify from 'fastify';

import { config } from './config.js';
import { TtlCache } from './cache.js';
import type { ApiErrorBody, WeatherSnapshot } from './types.js';
import { fetchWeather } from './weather.js';

const app = Fastify({
  logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
});

const weatherCache = new TtlCache<WeatherSnapshot>({
  ttlMs: config.cacheTtlMs,
  load: () => fetchWeather(config.location, config.requestTimeoutMs),
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
