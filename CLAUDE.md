# piPulseDashboard

A dashboard for a 720 × 720 HyperPixel Square Touch on a Raspberry Pi 5: the San Jose
weather, and what the United States is searching Google for. `README.md` covers the
architecture, API contract, layout bands, and theming — read it before changing anything
structural.

## Scope

The panel is a horizontal carousel of two pages, swiped between:

- **Weather** — the weather for San Jose, on whichever of two fixed-size layouts settings
  has chosen: current conditions or a 7-day forecast.
- **Search Pulse** — what the United States is searching Google for right now.

Both stay deliberately small and are meant to be done well rather than made bigger. Do not
overbuild them.

Prefer plain CSS and hand-rolled helpers over new dependencies. The pixel sprites and the
runtime payload validation are hand-written on purpose, not for lack of a library.

"Do not overbuild" is about **scope, not tools**. There is no banned-technology list at
all any more: the constraint against React, Tailwind and Docker was lifted early, the stack
settled as Svelte + Vite + Fastify, and the Search Pulse list that banned hosted models and
outside sources was removed on 2026-08-04. Nothing is off the table by default — but a new
dependency, a paid API or a third page still has to be worth what it costs, and that is a
conversation to have rather than a rule to look up.

**Attract mode** — the dashboard driving itself when nobody is touching it — has its own
plan, [docs/attract-mode-plan.md](docs/attract-mode-plan.md). Built 2026-08-04. Two things
to know before reading it: the user calls it "carousel mode", but `carousel` already means the two-page
horizontal scroller everywhere in this repo, so the code and docs say **attract**. And it
does **not** loosen the two-page rule below — it automates the navigation that already
exists and adds no page, no route, and no new way to reach anything.

The weather half has its own plan, [docs/weather-provider-plan.md](docs/weather-provider-plan.md)
— switching from Open-Meteo to Google's Weather API. It is a separate document because the
Search Pulse guardrails below do not apply to it, and three questions have to be settled
before any of it is built.

The `millennium` theme also has its own plan,
[docs/millennium-theme-plan.md](docs/millennium-theme-plan.md). **It is the one part of
this project allowed to break "flat by design" and "original pixel art only"** — gradients,
bevels, a bundled display face and supplied character art, all confined to
`apps/web/src/styles/millennium.css` and its own palette entry. That exception was the
user's explicit call and it does not generalise: it licenses nothing outside that theme,
and a seventh theme does not inherit it. The theme changes no layout, and must not start
to — the reference it was drawn from merges the two weather screens, and we deliberately
kept them separate.

Two operational rules for it:

- **Never copy an image into `apps/web/public/themes/millennium/`.** Art arrives as framed
  gallery tiles at ~2.4 MB each and goes through `scripts/theme-art.mjs`, which crops the
  frame, keys the black backdrop, trims and downsamples — 34 MB to 7.7 MB for the supplied
  set. Use `--keep-frame --no-key` on anything that already has an alpha channel.
- **`millennium.css` targets other components' class names**, so those names are part of
  its contract and renaming one breaks it silently. Check for collisions before writing a
  selector there: `.row`, `.title`, `.bar`, `.head`, `.icon` and `.screen` each belong to
  more than one component, and `.screen` in particular is both the panel and the 7-day
  layout's root.

### Search Pulse

**Starting a fresh session? Read [docs/HANDOFF.md](docs/HANDOFF.md) first** — where the
work stands, what surprised us, and the decisions not to silently revisit.

The plan — phases, screen layout, acceptance criteria — is
[docs/search-pulse-plan.md](docs/search-pulse-plan.md). Read it before starting a phase
and update it as phases land.

**The guardrails that used to live here were removed on 2026-08-04, at the user's
request.** They banned hosted models, AI categorisation, unofficial sources and anything
outside a narrow question, and required every value on screen to trace back to the feed or
to a local rule. They had done their job and had started costing more than they returned.
Recorded rather than quietly deleted so nobody reinstates them from memory or reads an old
commit and thinks a rule was broken.

What survives is not a rule but arithmetic, and it lives in `README.md` and the plan doc
where it is explained rather than asserted: Google's volume figures are the floor of a
bucket and not a count of searches, the feed is ordered by recency and not popularity, and
`ON FEED` measures how long Google listed a trend rather than how long anyone cared.
**Label things as what they are** — that is engineering, not a guardrail, and it is the
only part of the old section worth carrying forward.

**Trend categories** — the badge on each row saying what a trend is about — have their own
plan, [docs/trend-category-plan.md](docs/trend-category-plan.md). Built 2026-08-04. It is
the only part of this project that calls a paid API, and three things about it are
load-bearing:

- **`reasoning_effort: minimal` is the difference between $2.62 a year and about $20.**
  GPT-5 models bill reasoning as output, and this task's evidence is all in the prompt.
  Do not remove it without re-running the arithmetic in the plan.
- **A category is decided once and never recomputed.** That is what stops a badge
  flickering between polls; the model genuinely answers differently on boundary cases.
- **It must work with the key absent.** No key means the categoriser is never constructed
  and the dashboard is exactly what it was before the feature existed.

The layout is currently a two-page carousel, Weather and Search Pulse, with everything else
reached from inside a page. That is a description of what exists, not a limit on what may
be built. A third page is a real design change with real cost — the page indicator, the
swipe gesture and attract mode's tour all assume two — so cost it out before adding one,
but it is no longer forbidden.

### Events map

A third page — nearby events as pins on a map — is planned in
[docs/events-map-plan.md](docs/events-map-plan.md). **It is blocked, and the blocker is not
ours:** SerpApi's Google Events engine has returned zero results for every query since
2026-08-04 ([serpapi/public-roadmap#4117](https://github.com/serpapi/public-roadmap/issues/4117)).
Verified on 2026-08-05 by reading the raw HTML Google served SerpApi, which says
*"Can't find events that match."* SerpApi's status page claims the engine is healthy; it is
wrong, so probe the engine rather than trusting the page.

Two things from that plan worth knowing before touching it: **empty SerpApi responses bill
exactly like full ones**, which is why the budget guard has to count results and not just
calls; and **MapTiler counts Leaflet raster tiles as requests, not map sessions**, so the
100k-requests limit is the one that matters and attract mode touring past the map costs
nothing.

Nothing gets built until Phase 0 in that document passes. Phase 0b — the tile-versus-pixel-art
render — needs no SerpApi and can be done while waiting.

## Verifying UI changes

The layout is authored at a fixed 720 × 720 and never reflows, so reading the CSS does
not tell you whether it renders correctly. Start the app with `npm run dev` and drive the
Playwright MCP server against `http://localhost:5173` with the viewport set to 720 × 720.
First-run setup is under "Browser automation" in `README.md`.

There are three layouts — the two weather ones and Search Pulse — and a change to shared
styling, sprites or theming can regress any of them. Check all three, driving the app with
`browser_snapshot` and clicks by accessible name, never by pixel coordinate:

**Touching a shared token — `--line`, `--font-display`, anything in `app.css` — means
checking a flat theme as well as `millennium`.** Those two are the ones that can regress
each other; `millennium.css` is keyed off `[data-theme]` and cannot reach the others, but a
change to the tokens beneath it reaches everything. `gba-blue` and `midnight` are the pair
worth checking: `midnight` inverts `ink` to near-white, which is the assumption most rules
quietly make and the one that breaks first.

- **Between pages**, click **Show WEATHER** or **Show SEARCH PULSE**, the page indicator at
  the bottom of the panel. Those buttons scroll the same carousel a swipe does, so what
  you capture is what a finger gets.
- **Between weather layouts**, click **Open settings**, then **WEATHER NOW** or
  **7-DAY FORECAST**. Picking one closes the panel and returns to the weather page.

The app always opens on the weather page, showing whichever layout was last chosen.

**720 × 720 is not negotiable, because any other size lies about the artwork.**
[App.svelte](apps/web/src/App.svelte) scales the design by
`Math.min(window.innerWidth, window.innerHeight) / 720`, which is exactly 1 on the
HyperPixel but about 0.54 on a phone. At a fractional scale the sprite grid resamples
unevenly, so layout and touch targets stay honest while sprite crispness and outline
alignment do not. Judge those only at 720 × 720 — a capture, or the panel itself.

Do not pass `filename` to `browser_take_screenshot`. Without it the file is auto-named
into `.playwright-mcp/`, which is gitignored; with it the file lands in the repository
root instead and shows up as an untracked stray.

Run `npm run typecheck` before calling a change done — it covers both workspaces.

## Showing the user the dashboard

When the user asks to see the dashboard — "show me", "send me a screenshot", "what does it
look like now" — use the **`show-dashboard`** skill, or let them invoke it directly as
`/show-dashboard`. It screenshots at 720 × 720 and shows the image inline. That is all it
should do.

**Do not publish an Artifact unless the user asks for one in so many words.** Inline images
render fine on mobile and expand to full width when tapped, so a link buys nothing for a
bare screenshot. Artifacts are for deliverables bigger than a picture — a written report,
several captures compared — and the user says when they want one.

## Remote access

Tailscale lives on the **Windows host**, never inside WSL — installing it in WSL was tried
and abandoned, because mirrored networking conflicts with it. Mirrored networking also
means Windows already reaches the WSL dev server on `localhost`, so `tailscale serve` on
the host is all that is needed. Leave Tailscale installation and `serve`/`funnel` config
to the user on Windows; there is nothing to run for it inside WSL.

Do not change the dev server's `host` or `port`, or add WSL port forwarding, to make
remote access work. Those are not the problem. The one thing the repo needs is
`server.allowedHosts` in `apps/web/vite.config.ts`, which is already set.

## Raspberry Pi deploys

`./scripts/pi-setup.sh` once, then `./scripts/pi-start.sh`. Setup handles Node, `npm ci`,
the build, and a real SQLite write-and-read-back check. Start serves both halves, waits
for the port, and opens Chromium in kiosk mode on it; `--no-browser` serves only.
`README.md` covers both, including moving an existing history across with
`scripts/history-db.mjs`.

`./scripts/pi-setup.sh --autostart` opens the dashboard when the desktop session loads;
`--no-autostart` undoes it. Both do only that and exit. It writes an
`~/.config/autostart/` entry, **not a systemd unit** — the script opens Chromium and needs
a screen to open a window on, which systemd starts too early to provide. Booting straight
to the desktop is the default and needs no raspi-config change.

Install **Node 24+** from NodeSource. The version in apt is 18, which is too old for Vite
and fails during install.

The floor moved from 22 to 24 when Search Pulse started storing history: it uses
`node:sqlite`, which Node 22 has only behind `--experimental-sqlite` and 24 has outright.
Built-in SQLite is what keeps this dependency-free and, more to the point, keeps a native
module off a Raspberry Pi.
