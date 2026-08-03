# piPulseDashboard

A Game Boy Advance-inspired dashboard for a **720 × 720 HyperPixel Square Touch**
display on a Raspberry Pi 5.

It is two pages, swiped between horizontally, in a pixel-art neo-brutalist interface that
fills the panel:

- **Weather** — San Jose, California: now, midday and evening, plus a 7-day forecast.
- **Search Pulse** — what the United States is searching Google for right now.

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

`./scripts/pi-start.sh` runs exactly this, once the servers are up:

```bash
chromium --kiosk http://localhost:5173
```

`--kiosk` opens the page full-screen with no tabs or address bar. Exit with `Alt+F4`.

No other flags. If something about the browser needs fixing later, add the flag then —
with an actual problem to point at.

What the script adds around that command is timing and cleanup, not options:

- **It waits for port 5173 to answer before launching.** A browser started before Vite is
  listening lands on an error page and stays there, because nothing reloads it.
- **Closing the browser stops the servers**, and `Ctrl-C` in the terminal stops both.
  Teardown walks the process tree rather than signalling the top of it: `npm start` runs
  `concurrently`, which runs two shells, which run node and vite, and an orphaned `vite`
  still holding 5173 makes the *next* launch fail in a way that looks like a bug in the app.
- **`chromium` and `chromium-browser`** are both tried, since Raspberry Pi OS has used
  each. If neither is installed it says so and keeps serving, because the dashboard is
  still reachable from another device.
- **`--no-browser`** serves without opening anything — for SSH, or reading it from a phone.

### Opening it automatically

```bash
./scripts/pi-setup.sh --autostart      # on, and exit
./scripts/pi-setup.sh --no-autostart   # off, and exit
```

Writes `~/.config/autostart/pipulse.desktop`, so the dashboard opens when the desktop
session loads: plug the Pi in and it comes up. Neither flag installs or builds anything —
turning autostart on should not drag a rebuild along with it.

**A desktop autostart entry rather than a systemd unit**, because the script opens Chromium
and needs a screen to open a window on. systemd would start it before the desktop exists
and leave you wiring up display variables by hand.

It relies on the Pi booting straight to the desktop, which is the default and needs no
setting up — if plugging it in lands you at the desktop without typing a password, you
already have it.

There is no terminal behind an autostarted run, so output goes to `~/pipulse.log`. Read
that first if the dashboard ever does not appear. The log is truncated on each launch
rather than appended, because it carries everything Chromium says and the whole disk is an
SD card.

`Alt+F4` still closes it, and still stops the servers with it.

## Project layout

```
piPulseDashboard/
├── apps/
│   ├── api/                      Fastify service
│   │   ├── src/
│   │   │   ├── server.ts         routes, error handling, shutdown
│   │   │   ├── weather.ts        Open-Meteo fetch, validation, normalisation
│   │   │   ├── trends.ts         TrendProvider, Google RSS fetch and parsing
│   │   │   ├── history.ts        SQLite snapshots, rank metrics, movement
│   │   │   ├── cache.ts          TTL cache, coalescing, stale-on-error
│   │   │   ├── config.ts         environment-driven config
│   │   │   └── types.ts          upstream types vs. our API contract
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                      Svelte 5 + Vite front end
│       ├── src/
│       │   ├── App.svelte        720×720 shell, scaling, page carousel, theme swap
│       │   ├── app.css           default palette tokens and reset
│       │   ├── main.ts
│       │   └── lib/
│       │       ├── api.ts        typed client for /api/weather and /api/trends/now
│       │       ├── dashboard.svelte.ts   weather state, timers, refresh policy
│       │       ├── trends.svelte.ts      trend state, 60s poll, freshness policy
│       │       ├── theme.svelte.ts       palettes and the hot swap
│       │       ├── screen.svelte.ts      which of the two weather layouts is showing
│       │       ├── types.ts      transport types vs. view types
│       │       ├── view.ts       snapshot → view model, time formatting
│       │       ├── trend-view.ts trend rows, log bar scale, volume formatting,
│       │       │                 the card's quoted headlines
│       │       ├── components/   WeatherDashboard, WeekDashboard, ForecastTable,
│       │       │                 SearchPulse, TrendRow, TrendCard, Sparkline,
│       │       │                 PageDots, StatusHeader, TitleBar, FooterBar, …
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

### `GET /api/trends/now`

```json
{
  "region": "US",
  "trends": [
    {
      "id": "does sheepstealer die",
      "title": "does sheepstealer die",
      "approximateVolume": "20000+",
      "publishedAt": "2026-08-03T01:50:00.000Z",
      "relatedQueries": [],
      "imageUrl": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9Gc…",
      "imageSource": "Reuters",
      "news": [
        {
          "title": "House of the Dragon season 3: what to know before the premiere",
          "source": "Reuters",
          "url": "https://www.reuters.com/…"
        }
      ]
    }
  ],
  "updatedAt": "2026-08-03T03:43:30.440Z"
}
```

Ten trending searches for the region, highest-ranked first, from Google's
[Trending Now RSS export](https://trends.google.com/trending/rss?geo=US) — public, no
API key, no account.

`updatedAt` is when the list was **retrieved from Google**, not when the client asked us
for it. Those differ by up to the cache TTL on every request served from cache, and a
screen that reports freshness has to report the age of the data.

**Only fields the feed actually states are present.** `approximateVolume` is Google's own
bucket verbatim, "+" included, because it is the floor of a range and not a count.
`publishedAt` is absent if the item's `pubDate` will not parse.

`relatedQueries` is **always empty**, and that is a property of the source rather than a
gap in the code. The feed gives each item a set of `ht:news_item` headlines — articles
*about* the trend, not other searches people ran. Presenting those as related queries
would put words on the screen nobody searched for. `sourceUrl` is absent for the same
kind of reason: every item's `<link>` is the URL of the feed itself, so there is nothing
per-trend to point at.

`news` carries those headlines as what they are: articles, quoted verbatim, each with the
outlet that published it. Three per item in practice, on every item checked against the
live feed. The trend card shows **all** of them — a broad query like `artificial
intelligence news` comes back with three unrelated stories, so promoting the first to "the
headline" would assert the trend is about something it is only a third about. There is no
prose to go with them: `<description>` and `ht:news_item_snippet` are empty on every item
and every article, so nothing on the screen describes a trend in sentences of its own.

`imageUrl` and `imageSource` are the item's `ht:picture` thumbnail and its credit, on
Google's image CDN. The browser loads it directly; a URL that is not http(s) is dropped by
the parser rather than passed to an `src`. How Google associates an article or a picture
with a query is not published, and nothing here describes a mechanism for it.

`id` is the title lowercased, trimmed, with inner whitespace collapsed. It recognises the
same search written with different spacing, and deliberately does no more than that —
deciding that two differently worded searches mean the same thing is a judgement this
feature does not make.

Response headers include `x-cache` and `age`, as `/api/weather` does. Cached for **10
minutes**; a cold cache plus a failed fetch returns `503`.

### `GET /api/trends/history?key=…`

Everything this Pi has recorded about one trend. `key` is a `TrendingSearch.id`.

```json
{
  "trendKey": "bryan kohberger motive",
  "points": [{ "at": "2026-08-03T04:43:27.012Z", "rank": 5 }],
  "timesObserved": 25,
  "movement": "cooling",
  "firstSeenAt": "2026-08-03T00:43:27.012Z",
  "latestRank": 5,
  "peakRank": 1,
  "activeMinutes": 240
}
```

None of this comes from Google. Every figure is counted from observations this machine
made, which is the point.

**`rank` here is standing by volume among every trend seen in the same fetch — not the
position the trend held in the feed.** The feed is ordered newest-first, so its position
slides downward on its own as newer trends arrive; graphing that would say nothing about
the search, and would make `COOLING` almost inevitable for everything. Volume is stored on
every row, so the real ranking is recoverable without a schema change. Ties share the
better rank, so two trends both on `500+` are both `#3`.

`peakRank` is the best position it has been seen holding,
`timesObserved` how many fetches it appeared in, `activeMinutes` the span from first to
most recent sighting — a span, not a claim of continuous presence.

An unseen key is a normal `200` with `timesObserved: 0`, not a `404`. That is what every
trend looks like on a Pi that has only just been switched on.

`movement` is a documented rule, not a judgement. A *lower* rank number is a better
position, so a decrease is a rise:

| Value | Rule |
| --- | --- |
| `rising` | The latest observation ranks better than the one before |
| `cooling` | Two consecutive declines |
| `steady` | Neither, including "not enough history to say" |

The asymmetry is deliberate: attention arrives abruptly, so one improvement is enough to
call a rise, while a single slip down the list is as often noise as it is a trend fading.

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
| `TRENDS_REGION` | `US` | Google geo code for the trends feed |
| `TRENDS_CACHE_TTL_MS` | `600000` | How often the backend refetches (10 minutes) |
| `TRENDS_REQUEST_TIMEOUT_MS` | `8000` | Upstream request timeout |
| `TRENDS_DB_PATH` | `data/trends.db` | Local history, relative to the API's cwd |

## Layout

### Pages

The panel is a horizontal carousel: the weather page, then Search Pulse. It is a flex row
inside the frame with `scroll-snap-type: x mandatory` and one snap point per page, so the
whole gesture — the pan, the momentum, the settle onto a page edge — is the platform's.
Nothing reimplements it in JavaScript, and a swipe can never leave two pages half-showing.

Each page is `flex: 0 0 100%` of the track, which is the same 704 px a screen occupied
before there was a carousel, so the fixed layouts inside are untouched. The track hides
its scrollbar with `scrollbar-width: none` — not for looks: a classic horizontal scrollbar
takes its height out of the content box, and every band on every page is budgeted against
the full 704.

`PageDots.svelte` draws the position indicator over the bottom of the panel, and its two
marks are also buttons — swiping is the point, but a scroll-snap carousel offers a
keyboard user nothing on its own. They are overlaid rather than given a band because both
weather layouts budget their heights to the pixel; the strip is transparent and spaced so
the `WEATHER NOW` metric divider runs down between the two marks.

### Weather

Two layouts, chosen in settings and remembered in `localStorage`. Both are four bands
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

### Search Pulse

`SearchPulse.svelte`, on the same four-band budget as the 7-day screen:

| Band | Height | Contents |
| --- | --- | --- |
| Title | 96 px | `SEARCH PULSE`, and the 3 × 3 menu grid |
| Region | 64 px | `UNITED STATES`, and the freshness report |
| Trends | fills | Five `TrendRow`s, equal height |
| Details | 212 px | What the feed said about the selected trend, and the rank graph |

Title above region is the reverse of the weather screens, which lead with a status strip.
This screen leads with its name, which is the order the design calls for and the one that
puts the freshness figure and the live lamp on the two rows that have to carry them.

The region strip's right-hand side is the whole of the screen's self-reporting, and every
branch of it is a fact rather than a mood:

| Condition | Shows |
| --- | --- |
| Online, data younger than 15 minutes | lamp + `LIVE · 4 MINS AGO` |
| Online, older than that | `UPDATED 38 MINS AGO`, no lamp |
| Offline, still holding a list | `OFFLINE · CACHED DATA`, no lamp |
| Nothing ever loaded | the failure, e.g. `TRENDS SOURCE DOWN` |

Fifteen minutes is the backend's ten-minute refresh plus enough slack to absorb one
missed fetch without crying wolf.

### Ordering: SURGING and BIGGEST

**The feed is ordered newest-detected-first, not by popularity.** Verified against the
live export: `published strictly newest-first` is true, `volume descending` is false, and
the largest trend routinely sits at position six. Treating feed position as a rank is
therefore wrong, and two chips in the region strip choose what the list means:

| Mode | Order | #1 is |
| --- | --- | --- |
| `SURGING` | the feed's own | the most recently detected |
| `BIGGEST` | by Google's volume figure | the largest of the current batch |

The choice is remembered in `localStorage`, like the theme and the weather layout.

Google's own **relevance** ordering is deliberately absent: the RSS export has no such
field and their ranking is not published, so a composite of our own carrying Google's
word for it would be a claim we cannot support.

The sort is stable and the input arrives newest-first, so trends sharing a volume bucket
keep recency order within it.

**The feed only covers about 2.5 hours.** It holds ten items and a new trend arrives every
ten to twenty minutes, so a search stays visible for a couple of hours and then drops out
— our stored history shows exactly that, trends drifting from position 1 to 10 and gone.
This is why the panel's figures are small next to `trends.google.com`: that page shows
accumulated totals for trends up to a day old, while this one shows trends in their first
hours. Both are real; they answer different questions.

A row is a rank, the search, Google's figure, how long ago Google reported it, and a bar. **The bar is logarithmic across
the list's own range** — smallest bucket present to largest — and that range matters as
much as the log does. Linear is hopeless when a list runs 200+ against 20000+: the top
trend pins the scale and flattens the rest to stubs. But log against a fixed origin fails
the other way; on a list running 200+ to 2000+, `log(v)/log(max)` puts a tenfold gap at
70% against 100%, so every bar is nearly full and the row order is the only thing left to
read. Anchoring to the smallest bucket present keeps the rows legible whatever the day's
spread. The cost is that the shortest bar looks the same whatever its absolute figure,
which is the honest trade for five rows with Google's own number printed beside each one.

Titles are clipped with an ellipsis rather than wrapped: the band is a fixed height
divided into five, so a long search term must not push its neighbours out of place.

Tapping a row selects it and the details band describes it; the top trend is selected on
arrival. The whole row is the target, because on a touchscreen the row is already what a
finger is aiming at, and the selected one inverts — the same idiom the settings list uses
for the option in force.

**Selection is held by trend id, not by row index.** The list is replaced every time a
poll lands and ranks shift between polls, so an index would quietly start describing a
different search. If the selected trend drops out of the feed entirely, the panel falls
back to the top trend rather than describing something no longer on screen.

The details band shows only what the feed stated — the search, Google's figure marked
`APPROX`, and the time it was first reported. **A field with nothing behind it is dropped
rather than shown with a dash**, so the panel is never padded out with placeholder rows.
Its bottom padding is the page indicator's lane: unlike the weather screens, whose last
band has slack for the dots to sit in, this one is dense enough to run a line of text
straight under them.

The band's right half is the local record: a rank graph and, beneath the facts, when this
Pi first saw the trend and how many fetches it has appeared in.

**The graph's x-axis spans the history that exists, capped at 24 hours** — not a fixed 24
hours always. A trend four hours old drawn on a day-wide axis occupies the rightmost
sixth and is unreadable, and most trends are hours old, so that would be the normal case
rather than the edge one.

Stretching to fit is only honest if the axis says what it covers, so **both ends are
named** — `9:43 PM` under the left edge, `NOW` under the right, and the span in the
heading as `RANK · LAST 40M`. Without those the empty part of a short axis reads as
missing data rather than as "we only started watching recently", which is what it
actually means. The floor is one refresh interval, which exists only so a single
observation has a span to sit in.

The y-axis is the opposite: **fixed at ranks 1 to 10**, the length of the list Google
returns, never scaled to what the trend happened to do. A search that only ever wobbled
between #8 and #9 should read as a flat line near the bottom, not as drama across a
zoomed axis. Observations are marked individually as well as joined, because a single
reading would otherwise draw nothing at all — which is exactly the state a freshly booted
Pi is in. A marker is nudged inside the plot at the extremes while its polyline vertex
stays put: rank 1 is the top line and most observations of an interesting trend sit on
it, so a marker centred there would lose its top half to the edge.

One label is ours rather than Google's: `NEW`, when the feed first reported the trend
under 30 minutes ago. The plan words that rule as "first observed less than 30 minutes
ago", meaning first observed by us — but until Phase 3 stores snapshots there is no
record of when we first saw anything, so it is measured against the feed's own `pubDate`.
That is Google's report time: exact, needing no storage, and it does not reset when the
Pi does. `RISING` and `COOLING` come from the stored rank history and are described under
`GET /api/trends/history` above.

### The trend card

`TrendCard.svelte`. A title like `PROFESSOR` or `AERODIANA` explains nothing on its own,
while the feed already carries a picture and three headlines that explain it completely.
Tapping the details band swaps the list for a card on those; the back control in its
header returns. Three bands again, to the same 704:

| Band | Height | Contents |
| --- | --- | --- |
| Header | 96 px | Back control and the search, the figure and its age |
| Article | fills | The picture, and every headline the feed carried |
| Graph | 156 px | The same rank plot, given the width it never had below the list |

**It is a view inside Search Pulse, not a third page.** The carousel stays two pages; a
horizontal swipe means "change dashboard section" and has to keep meaning only that.
Everything this section gains is reached by a tap.

**All three headlines are shown, never one.** Sampled against the live feed: four of five
trends had three headlines about a single event, so any one of them would have done — but
`artificial intelligence news` returned three *different* stories, and picking the first
would have asserted the trend was about that story when it was about all three. Where they
agree you learn the event; where they diverge you learn the query is broad, and the
divergence is itself the information. They are also not reconciled: `nazca lines` came back
with one headline saying 11 dead and two saying 13, and the card shows what each outlet
wrote.

Headlines are the one text on the dashboard that is **not** uppercased. Everywhere else the
screen writes its own labels; here it quotes a hundred characters of someone else's
sentence, and capitals would be both harder to read and less faithful. Each carries its
outlet and the article's domain as plain text — deliberately not a link, because a tap on a
wall-mounted kiosk navigates away from the dashboard with no way back. A QR code is the
deferred answer to actually reaching an article.

**The picture is duotoned to the active theme in four lines of CSS.** The image is
greyscaled and a panel of `--c-sky` is laid over it on `mix-blend-mode: color`, inside
`isolation: isolate` so the blend stays in the box. It re-tints with the theme for free,
because the overlay is a theme token.

The token matters more than it looks. The `color` blend hands back the *overlay's* chroma —
its `max − min` RGB spread — with the photo's luminosity, so a near-neutral overlay
produces a near-greyscale image whatever the theme is nominally set to. Mean chroma of the
composited image, measured over a real feed thumbnail:

| overlay | gba-blue | midnight | dmg-green | brutalist | amber |
| --- | --- | --- | --- | --- | --- |
| `--c-ink` | 82 | **19** | **36** | 139 | 122 |
| `--c-sky` | 101 | 93 | 90 | 115 | 86 |
| `--c-blue` | 112 | 101 | **44** | 135 | 126 |

`sky` is the only one of the three in the mid range in every palette. `ink` collapses on
`midnight`, whose ink is `#eaf2ff` — near white where every other theme's is dark, which is
why **any image treatment has to be checked against that theme specifically**.

Chunky pixels are a separate effect and CSS cannot do them at all: `image-rendering:
pixelated` only engages when the browser upscales, and these arrive at 275 px and are drawn
smaller, so it never fires. That needs a canvas pass and is deferred; the duotone is what
took the photo from an obvious foreign object to something in the palette.

A trend whose entry carries no picture, or whose picture fails to load, renders without one
and the headlines take the full width. Nothing is substituted for it.

## Controls

The reference design has no visible buttons, so both controls are hidden in plain sight:

- **Tap the status bar** (the date/clock row) to force a refresh. It is a 700 × 72
  target, which is hard to miss on a touchscreen.
- **Tap the menu grid** beside the title to open settings. Dismiss with the close
  button, a tap outside the panel, or `Escape`.

Keyboard focus draws a visible outline on both, since neither looks like a control.

The 7-day screen adds one visible control: a refresh glyph in the footer band, which the
reference art draws there. It does the same thing as tapping the status bar.

**Swipe horizontally** to change pages. The two marks at the bottom of the panel show
which page is showing and switch to the other when tapped; each carries 9 px of padding
so a 14 px mark is a 32 px target. Nothing beneath that overhang is interactive on either
page, so the extra reach costs no other control.

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

- Shows a styled loading screen, then fetches `/api/weather`. Both it and the full-screen
  error state render *inside* the weather page rather than replacing the panel, so a
  weather outage cannot take the other page down with it.
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
- Search Pulse polls `/api/trends/now` every **60 seconds** and follows the same rule: a
  failed poll never destroys the last good list. The screen keeps showing it, relabelled
  as cached, and only reports the failure when nothing has ever loaded. The 60-second
  poll against a 10-minute backend cache is why the browser can refresh freely without
  any of it reaching Google.

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

## Deploying to the Raspberry Pi

```bash
git clone https://github.com/juliofuentesUI/piPulseDashboard.git
cd piPulseDashboard
./scripts/pi-setup.sh          # once
./scripts/pi-start.sh          # every time
```

`pi-setup.sh` installs Node 24 from NodeSource if the machine has something older
(**apt's is 18, which cannot build this**), runs `npm ci`, builds both workspaces, and then
proves SQLite works by opening a throwaway database in the data directory and reading a row
back. That last step is the one worth having: it separates "Node is too old" from "this SD
card is full or mounted read-only", which otherwise present identically as a dashboard with
no history.

It asks before installing Node. Pass `--yes` to skip the prompt, or `--skip-node` to leave
the installation alone.

`pi-start.sh` serves the built front end on **5173** and Fastify on **3000**, waits for the
front end to answer, then runs `chromium --kiosk http://localhost:5173`. It deliberately
does no installing and no building, so it starts in a second and fails loudly rather than
quietly rebuilding a wall display. `Ctrl-C`, or `Alt+F4` in the browser, stops everything.

**`npm ci` installs dev dependencies on purpose.** The built front end is served by
`vite preview`, so Vite has to be there. Do not prune them.

### Moving the history across

The Pi starts with no history, so every graph reads `NO HISTORY RECORDED YET` until it has
been running for a while. To carry an existing record over, export it on the machine that
has one:

```bash
node scripts/history-db.mjs export     # → apps/api/data/trends-seed.db
scp apps/api/data/trends-seed.db pi@raspberrypi.local:~/
```

and import it during setup:

```bash
./scripts/pi-setup.sh --seed ~/trends-seed.db
```

**Do not copy `trends.db` yourself.** The database runs in WAL mode, so recent writes sit
in a `trends.db-wal` sidecar until a checkpoint folds them in — on this machine the main
file was 20 KB while its WAL held 622 KB, so a plain `scp` of `trends.db` would have
carried a fraction of the data and looked like it worked. `export` is `VACUUM INTO`, which
reads the WAL as well and writes one consistent file with no sidecars.

Importing onto a Pi that already has history **refuses** unless you pass `--force`, and
prints what it was about to replace first.

`scripts/history-db.mjs` also answers `stats <file>`, which is the quickest way to find out
whether a database has anything in it.

## Requirements

- Node.js 24 or newer. Search Pulse stores its history in `node:sqlite`, which Node 22
  has only behind `--experimental-sqlite`.
- No Docker, no API key, and no dependency for the database — SQLite is built into Node,
  which keeps a native module and its compile step off the Raspberry Pi.
- Nothing in the dependency tree compiles, so there is no native build on ARM.
- Browser automation is optional and downloads ~300 MB on first use. Skip it and
  everything else still works.
