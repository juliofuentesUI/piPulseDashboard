# piPulseDashboard

A Game Boy Advance-inspired weather dashboard for a **720 × 720 HyperPixel Square Touch**
display on a Raspberry Pi 5.

It shows the weather for San Jose, California — now, midday and evening — in a
pixel-art neo-brutalist interface, full-screen, with no scrolling.

> `docs/screenshot.png` predates the current design and is no longer linked here.
> Replace it with a fresh capture and add the image back when convenient.

## Getting started

```bash
git clone https://github.com/juliofuentesUI/piPulseDashboard.git
cd piPulseDashboard
npm install
npm run dev
```

Then open **http://localhost:5173**.

> `npm run dev` starts two processes: the Fastify API on port **3000** and the Vite dev
> server on port **5173**. The dashboard is on **5173**. Port 3000 only answers under
> `/api`, so visiting `http://localhost:3000/` directly returns a 404 — that is correct.

The dev server binds to `0.0.0.0`, so you can also open the dashboard from another
machine on the same network at `http://<pi-ip>:5173`.

## Scripts

Run from the repository root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Fastify API + Vite dev server, concurrently |
| `npm run build` | Compiles the API to `dist/` and bundles the web app |
| `npm run start` | Serves the built output (API + `vite preview`) |
| `npm run typecheck` | `tsc --noEmit` for the API, `svelte-check` for the web app |

## Kiosk mode on the Pi

Once `npm run dev` (or `npm run start`) is running, launch Chromium full-screen:

```bash
chromium --kiosk http://localhost:5173
```

- `chromium` — launches the Chromium browser.
- `--kiosk` — opens the page full-screen with no tabs, address bar, or other browser
  chrome, and blocks the usual ways of leaving the page. Exit with `Alt+F4`.
- `http://localhost:5173` — the locally running Svelte application.

Startup is **not** automated yet. When you are ready for that, a `systemd --user`
service or an entry in `~/.config/autostart/` is the usual next step.

On some Raspberry Pi OS images the binary is named `chromium-browser` instead of
`chromium`.

## Project layout

```
piPulseDashboard/
├── apps/
│   ├── api/                      Fastify service
│   │   ├── src/
│   │   │   ├── server.ts         routes, error handling, shutdown
│   │   │   ├── weather.ts        Open-Meteo fetch, validation, normalisation
│   │   │   ├── cache.ts          5-minute TTL cache, coalescing, stale-on-error
│   │   │   ├── config.ts         environment-driven config
│   │   │   └── types.ts          upstream types vs. our API contract
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                      Svelte 5 + Vite front end
│       ├── src/
│       │   ├── App.svelte        720×720 shell, scaling, theme swap
│       │   ├── app.css           default palette tokens and reset
│       │   ├── main.ts
│       │   └── lib/
│       │       ├── api.ts        typed client for /api/weather
│       │       ├── dashboard.svelte.ts   state, timers, refresh policy
│       │       ├── theme.svelte.ts       palettes and the hot swap
│       │       ├── types.ts      transport types vs. view types
│       │       ├── view.ts       snapshot → view model, time formatting
│       │       ├── components/   WeatherDashboard, StatusHeader, TitleBar,
│       │       │                 ForecastColumn, MetricPanel, …
│       │       └── weather-icons/  eleven original pixel-art sprites,
│       │                           plus the sprite/outline helpers
│       ├── index.html
│       ├── package.json
│       ├── svelte.config.js
│       ├── tsconfig.json
│       └── vite.config.ts
├── package.json                  npm workspaces + scripts
├── .env.example
└── .gitignore
```

## API

### `GET /api/weather`

```json
{
  "location": "San Jose",
  "temperature": 81,
  "apparentTemperature": 79,
  "condition": "CLEAR",
  "conditionKey": "clear",
  "weatherCode": 0,
  "isDay": true,
  "high": 86,
  "low": 58,
  "precipitationProbability": 0,
  "windSpeed": 9,
  "forecast": [
    {
      "period": "midday",
      "time": "2026-08-02T13:00:00-07:00",
      "dayOffset": 1,
      "temperature": 91,
      "condition": "CLEAR",
      "conditionKey": "clear",
      "weatherCode": 0,
      "isDay": true,
      "precipitationProbability": 0
    },
    {
      "period": "evening",
      "time": "2026-08-01T19:00:00-07:00",
      "dayOffset": 0,
      "temperature": 80,
      "condition": "CLEAR",
      "conditionKey": "clear",
      "weatherCode": 0,
      "isDay": true,
      "precipitationProbability": 0
    }
  ],
  "updatedAt": "2026-08-01T18:28:14-07:00"
}
```

Temperatures are whole degrees Fahrenheit and wind is MPH. `conditionKey` and `isDay`
are what the client uses to pick a sprite; `weatherCode` is the raw WMO code, kept so
the client can get smarter without an API change. `high` and `low` are still served but
the current layout does not show them.

The top-level `precipitationProbability` is the **highest hourly probability over the
next 12 hours**, not the current minute — one number on a wall display should answer
"will I need an umbrella today". The per-hour figure inside a `forecast` entry is that
hour specifically.

Response headers include `x-cache: fresh | revalidated | stale` and `age`.

### Forecast periods

`forecast` carries the two look-ahead columns, in display order. Midday targets 13:00
local, evening 19:00, and each resolves to **the soonest day on which that hour has not
already gone by**, compared at hour granularity:

- At 11:00, both are today.
- At 13:40, midday is still today's 13:00 — the hour has not finished.
- At 18:28, midday can only be satisfied by tomorrow, so `dayOffset` is `1` and the
  column renders `TMR 1:00 PM`. Evening is still ahead, so it stays today.

That is why the upstream request asks for two days of hourly data. A period is omitted
from the array if the hourly series cannot supply it; the client draws an empty column
rather than collapsing the grid.

### `GET /api/health`

Liveness plus the configured location and cache TTL.

### Behaviour

- Data comes from [Open-Meteo](https://open-meteo.com/), which needs **no API key**.
- Responses are cached in memory for **5 minutes**. Concurrent misses share a single
  upstream request.
- If Open-Meteo fails but a previous response is cached, that response is served with
  `x-cache: stale` rather than an error. Only a cold cache plus a failure returns `503`.
- All third-party API logic stays in the Fastify app. The Svelte app only ever calls the
  relative path `/api/weather`; Vite proxies it in both `dev` and `preview`, so no port
  is hardcoded in the client.

## Configuration

Every value has a working default, so a `.env` file is optional. Copy `.env.example` to
`.env` at the repository root to change any of them — both apps read from that one file.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Fastify port |
| `HOST` | `0.0.0.0` | Fastify bind address |
| `WEB_PORT` | `5173` | Vite dev/preview port |
| `WEATHER_LOCATION_NAME` | `San Jose` | Name shown in the status bar |
| `WEATHER_LATITUDE` | `37.3382` | |
| `WEATHER_LONGITUDE` | `-121.8863` | |
| `WEATHER_TIMEZONE` | `America/Los_Angeles` | |
| `WEATHER_CACHE_TTL_MS` | `300000` | Cache lifetime (5 minutes) |
| `WEATHER_REQUEST_TIMEOUT_MS` | `8000` | Upstream request timeout |

## Layout

Four bands inside a thick outer frame, all at fixed pixel heights because the panel is
always exactly 720 × 720:

| Band | Height | Contents |
| --- | --- | --- |
| Status | 76 px | Date, location, live clock |
| Title | 116 px | `WEATHER`, and the 3 × 2 menu grid |
| Forecast | fills | Three equal columns: NOW, MIDDAY, EVENING |
| Metrics | 132 px | Rain chance, wind |

Each forecast column uses fixed grid track heights, so the three share a baseline even
when one condition label wraps and its neighbours do not.

## Controls

The reference design has no visible buttons, so both controls are hidden in plain sight:

- **Tap the status bar** (the date/clock row) to force a refresh. It is a 700 × 72
  target, which is hard to miss on a touchscreen.
- **Tap the 3 × 2 menu grid** beside the title to cycle themes.

Keyboard focus draws a visible outline on both, since neither looks like a control.

## Themes

A theme is seven colours, published as CSS custom properties on `<html>`. Every rule in
the app — panel fills, dividers, type, and the pixel sprites — resolves back to one of
those seven, so swapping is a synchronous property write on one element: no rebuild, no
reload, nothing re-fetched.

| Token | Role |
| --- | --- |
| `bg` | Page and panel background |
| `surface` | Cloud bodies and raised fills |
| `ink` | Outlines, borders, headings, primary numbers |
| `blue` | Secondary labels and framing |
| `sky` | Cloud shading, rain, wind |
| `warm` | Sun and moon bodies |
| `hot` | Rays, warm outlines, alerts |

Tokens are named for their role in the artwork rather than their hue, so an inverted
theme stays coherent — in `midnight`, `ink` is near-white.

Four ship today: `gba-blue` (the default), `midnight`, `dmg-green` and `amber`. **To add
one, append an object to `THEMES` in `apps/web/src/lib/theme.svelte.ts`.** That is the
whole change; nothing else references a colour literal. The choice is remembered in
`localStorage` and reapplied before the first paint, so a non-default theme never
flashes the default one.

## Front-end behaviour

- Shows a styled loading screen, then fetches `/api/weather`.
- Auto-refreshes every **10 minutes**; the clock ticks on the wall-clock minute.
- A failed refresh **never blanks the screen**. The last good reading stays up and the
  middle of the status bar says what went wrong. The full-screen error state only
  appears when there has never been a successful load.
- The status bar is otherwise quiet: it shows the location, and speaks up only for
  refreshing, failures, no network, or a reading older than 30 minutes. That last one
  catches a suspended tab, where timers stop firing and stale numbers would otherwise
  sit there looking current.
- Losing and regaining the network is detected via `online`/`offline` events, and
  regaining it triggers an immediate refresh.

## Design notes

- Original pixel art only — no Nintendo logos, game graphics, or Game Boy Advance
  branding.
- Sprites are built from rects on a 32 × 32 grid (`lib/weather-icons/sprite.ts`) and
  rendered as SVG with `shape-rendering="crispEdges"`, so every edge lands on a whole
  pixel at any scale.
- Outlines are **derived, not drawn**: `outline()` rasterises a shape and emits a rect
  for every empty cell touching a filled one, merged into horizontal runs. Each sprite
  is therefore described once, and the border colour is a theme token like everything
  else. Composite sprites call `outlined()` per element, back to front, so a cloud drawn
  over a sun carries its own border across the join.
- The layout is authored at a fixed 720 × 720 and scaled with a single transform, so it
  is pixel-exact on the HyperPixel and never reflows or produces a scrollbar on a
  desktop browser.
- Flat by design: no gradients, shadows, rounded corners or scanline overlays. The only
  animation left is the loading meter, disabled under `prefers-reduced-motion: reduce`.
  The sprites are static, which keeps the Pi idle.
- No webfont is bundled, so the type falls back to the sharpest monospace available.
  To go fully pixel, drop a `.woff2` into `apps/web/public/fonts/` and add a matching
  `@font-face` named `Pixel Operator` — the font stack in `app.css` already looks for it.

## Requirements

- Node.js 20 or newer (developed on 24).
- No database, no Docker, no API key.
