# piPulseDashboard

A Game Boy Advance-inspired weather dashboard for a **720 × 720 HyperPixel Square Touch**
display on a Raspberry Pi 5.

It shows the weather for San Jose, California — now, midday and evening — in a
pixel-art neo-brutalist interface, full-screen, with no scrolling.

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

## Remote access over Tailscale

To check the dashboard from a phone off the LAN — on cellular, say — put the machine on a
[tailnet](https://tailscale.com/) and let Tailscale front the dev server.

On a Windows + WSL setup, Tailscale belongs on the **Windows host**, not inside WSL.
Mirrored networking already shares `localhost` between the two, so Windows reaches the
WSL dev server with no port forwarding, and WSL needs no Tailscale of its own. From
PowerShell, with `npm run dev` running in WSL:

```powershell
tailscale serve --bg 5173     # tailnet-only HTTPS
tailscale serve status        # prints the https://<node>.<tailnet>.ts.net URL
tailscale serve reset         # undo
```

Install Tailscale on the phone, sign into the same account, and open that URL.

Two things make this work:

- **`server.allowedHosts` includes `.ts.net`.** `tailscale serve` forwards the original
  `Host` header, so requests arrive as the tailnet FQDN rather than `localhost`, and Vite
  rejects hostnames it does not recognise. The leading dot matches any `*.ts.net` name.
- **Only port 5173 is exposed.** The client calls `/api/weather` as a relative path and
  Vite proxies it to Fastify inside the machine, so port 3000 never leaves it.

Hot reload works over the tailnet as-is — edit a component and the phone updates without
a refresh. Vite's client derives its websocket URL from the page, so an HTTPS page gives
`wss://` on 443 with no `server.hmr` config. Don't add `hmr.clientPort` to "fix" this; it
would break HMR for local `localhost:5173` development.

Prefer `tailscale serve` to `tailscale funnel`. Both give HTTPS, but `serve` is reachable
only from your own tailnet, whereas `funnel` publishes the dev server to the whole
internet — and the hostname is discoverable in public Certificate Transparency logs, so
an unlisted URL is not a security boundary. A dev server serves your project source; keep
it off the public internet unless you have a reason.

## Scripts

Run from the repository root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Fastify API + Vite dev server, concurrently |
| `npm run build` | Compiles the API to `dist/` and bundles the web app |
| `npm run start` | Serves the built output (API + `vite preview`) |
| `npm run typecheck` | `tsc --noEmit` for the API, `svelte-check` for the web app |

## Browser automation

`.mcp.json` checks a [Playwright MCP](https://github.com/microsoft/playwright-mcp) server
into the repository, so Claude Code — or any MCP-aware editor — can drive a real browser
against the running dashboard: open `localhost:5173`, resize to 720 × 720, tap the status
bar, screenshot the result. It is a development aid only. Nothing in the app depends on
it, and the dashboard builds and runs without it.

Because the config is committed, an editor opening this repository will **ask before
enabling the server**. That prompt is deliberate: a checked-in `.mcp.json` is an
instruction to run a command on your machine, and no repository should get to do that
silently. Declining costs you nothing but the automation.

First run needs a browser, once per machine:

```bash
npx @playwright/mcp@latest install-browser chrome-for-testing
```

The server is pinned to `--browser chromium` because its default is the system Chrome
channel at `/opt/google/chrome/chrome`, which a Raspberry Pi OS or WSL image will not
have. Without the flag every call fails with `Chromium distribution 'chrome' is not
found`.

Output lands in `.playwright-mcp/` in the repository root, which is ignored by git:
accessibility snapshots and a console log after every action, plus any screenshot you
ask for. The one exception is `browser_take_screenshot` with an explicit `filename` —
that resolves against the working directory and drops the file in the repository root,
ignoring `--output-dir`. Omit `filename` and it is auto-named into `.playwright-mcp/`
instead.

The command is pinned to `@playwright/mcp@latest`, so the available tools can change
between sessions. Pin a version instead if you would rather they did not.

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
│       │       ├── screen.svelte.ts      which of the two layouts is showing
│       │       ├── types.ts      transport types vs. view types
│       │       ├── view.ts       snapshot → view model, time formatting
│       │       ├── components/   WeatherDashboard, WeekDashboard, ForecastTable,
│       │       │                 StatusHeader, TitleBar, FooterBar, …
│       │       └── weather-icons/  thirteen original pixel-art sprites,
│       │                           plus the sprite/outline helpers
│       ├── index.html
│       ├── package.json
│       ├── svelte.config.js
│       ├── tsconfig.json
│       └── vite.config.ts
├── package.json                  npm workspaces + scripts
├── .mcp.json                     Playwright MCP server, for browser automation
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
  "week": [
    {
      "date": "2026-08-02",
      "dayOffset": 0,
      "periods": [
        {
          "period": "morning",
          "time": "2026-08-02T09:00:00-07:00",
          "temperature": 69,
          "condition": "CLEAR",
          "conditionKey": "clear",
          "weatherCode": 0,
          "isDay": true
        },
        { "period": "midday", "time": "2026-08-02T13:00:00-07:00", "temperature": 87 },
        { "period": "evening", "time": "2026-08-02T19:00:00-07:00", "temperature": 80 }
      ],
      "precipitationProbability": 0
    }
  ],
  "updatedAt": "2026-08-01T18:28:14-07:00"
}
```

The last two `periods` entries above are abbreviated; every entry carries the same
fields as the first.

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

A period is omitted from the array if the hourly series cannot supply it; the client
draws an empty column rather than collapsing the grid.

### The week

`week` is seven rows for the 7-day screen, starting with today, each holding the three
hours that screen's columns show — 09:00, 13:00 and 19:00 local, in display order.

It is deliberately **not** derived from `forecast`. The two answer different questions:

- `forecast` rolls a period forward to tomorrow once it has passed, because a
  three-column "what's next" strip should never show an hour that is behind you.
- `week` rows are dated, so today's row keeps its morning and midday cells all evening.
  The hourly series still carries them — it starts at local midnight — and a hole
  punched in the first row would read as missing data rather than as elapsed time.

A `periods` entry is `null` where the series genuinely has no reading; the table renders
that cell as `--`. The row's `precipitationProbability` is the day's maximum, which is
what the table's four-dot meter and percentage both come from.

Both fields are served from **one** upstream request: `forecast_days=7` returns 168
hourly entries, which is every hour of all seven days, so the whole screen costs no extra
API traffic.

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

Two screens, chosen in settings and remembered in `localStorage`. Both are four bands
inside the thick outer frame, all at fixed pixel heights because the panel is always
exactly 720 × 720.

**`WEATHER NOW`** (`WeatherDashboard.svelte`) — the default:

| Band | Height | Contents |
| --- | --- | --- |
| Status | 76 px | Date, location, live clock |
| Title | 116 px | `WEATHER`, and the 3 × 2 menu grid |
| Forecast | fills | Three equal columns: NOW, MIDDAY, EVENING |
| Metrics | 132 px | Rain chance, wind |

Each forecast column uses fixed grid track heights, so the three share a baseline even
when one condition label wraps and its neighbours do not.

**`7-DAY FORECAST`** (`WeekDashboard.svelte`):

| Band | Height | Contents |
| --- | --- | --- |
| Status | 64 px | Date, location, live clock |
| Title | 96 px | `7-DAY FORECAST`, and the 3 × 3 menu grid |
| Table | fills | 46 px heading row, then seven equal day rows |
| Footer | 60 px | Raspberry Pi wordmark, last-updated time, refresh |

The table's five columns are `96px repeat(3, 1fr) 116px` — weekday, the three hours,
then rain chance. It is a real `<table>` so a screen reader announces "WED, 1:00 PM, 20
degrees" rather than a bare number; `thead` and `tbody` are `display: contents` so the
rows join the table's own grid.

Every row carries its own bottom border, the last one included — that edge is what
divides the table from the footer. Exempting `:last-child` does not work here: under
`display: contents` each row is the last child of its own `thead` or `tbody`, so the
rule would strip the *heading's* divider and leave the final row's in place.

The midday column is tinted with `color-mix(in srgb, var(--c-sky) 22%, transparent)`, so
the accent stays a tint of the active theme rather than a sixth hard-coded colour.

## Controls

The reference design has no visible buttons, so both controls are hidden in plain sight:

- **Tap the status bar** (the date/clock row) to force a refresh. It is a 700 × 72
  target, which is hard to miss on a touchscreen.
- **Tap the menu grid** beside the title to open settings. Dismiss with the close
  button, a tap outside the panel, or `Escape`.

Keyboard focus draws a visible outline on both, since neither looks like a control.

The 7-day screen adds one visible control: a refresh glyph in the footer band, which the
reference art draws there. It does the same thing as tapping the status bar.

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

Five ship today: `gba-blue` (the default), `midnight`, `dmg-green`, `brutalist-mono` and
`amber`. **To add one, append an object to `THEMES` in
`apps/web/src/lib/theme.svelte.ts`.** That is the whole change; nothing else references
a colour literal, and the settings list picks it up on its own. The choice is remembered
in `localStorage` and reapplied before the first paint, so a non-default theme never
flashes the default one.

`brutalist-mono` shows what the role-based naming buys: it sets `surface` and `warm` —
the two fill roles — to the background, so cloud bodies and sun discs go hollow and the
sprites read as line art without a single sprite being redrawn.

## Settings

`SettingsModal.svelte` is the panel behind the menu grid. It is built as a stack of
option groups — screen first, then theme:

```svelte
<section class="group">
  <h3 class="group-heading">THEME</h3>
  ...
</section>
```

Add another group as a sibling `<section class="group">`. Spacing comes from the grid
`gap` on the container, so nothing else needs touching.

The two groups differ in what they do to the panel afterwards, on purpose. Picking a
**theme** leaves it open, so the change can be seen happening. Picking a **screen**
closes it, because the thing that changed is behind the panel.

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
- Gaps in a curve are cut with `without()`, which trims rows against a box rather than
  discarding whole rects. Filtering instead only drops a run that *starts* inside the
  box, which leaves the overhang behind — that is the difference between the refresh
  glyph reading as two arrows and reading as a "no entry" sign.
- The Raspberry Pi mark in the footer is redrawn in theme tokens rather than its real red
  and green. Every other sprite follows the palette, and a logo keeping its own colours
  would be the one thing that stops looking right under Amber CRT or DMG Green.
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
- Browser automation is optional and downloads ~300 MB on first use. Skip it and
  everything else still works.
