import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';

/** Repo root, so a single .env at the top level configures both apps. */
const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const apiPort = toPort(env['PORT'], 3000);
  const webPort = toPort(env['WEB_PORT'], 5173);

  // Both dev and preview proxy /api, so the client only ever calls a relative
  // path and never needs to know which port Fastify is on.
  const proxy = {
    '/api': {
      target: `http://127.0.0.1:${apiPort}`,
      changeOrigin: false,
    },
  };

  // Vite rejects unrecognised Host headers. `tailscale serve` forwards the
  // original one, so remote requests arrive as the tailnet FQDN rather than
  // localhost. The leading dot matches every *.ts.net name, which resolves only
  // inside a tailnet — this is not a public opening.
  const allowedHosts = ['.ts.net'];

  return {
    envDir,
    plugins: [svelte()],
    server: {
      host: '0.0.0.0', // reachable from other machines on the LAN
      port: webPort,
      strictPort: true,
      allowedHosts,
      proxy,
    },
    preview: {
      host: '0.0.0.0',
      port: webPort,
      strictPort: true,
      allowedHosts,
      proxy,
    },
    build: {
      target: 'es2022',
      cssTarget: 'chrome111',
    },
  };
});

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}
