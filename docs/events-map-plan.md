# Events map — Plan

**Status: Phase 1 built against mock data, 2026-08-05. Phase 2 — the map page — not
started.** The user's decision was to stop waiting on the source and build the backend
behind the provider interface, with a `MockEventProvider` standing in.

**The blocker is still there and is still upstream of us.** SerpApi's Google Events engine
returns zero results for every query and has done since 2026-08-04. Real data is one
environment variable away — `EVENTS_PROVIDER=serpapi` — and that path is built, wired and
verified against the live (empty) API.

**DIRECTION CHANGED 2026-08-05 (evening): stop waiting, find a different source.** Re-probed
that evening and the engine was still empty; issue #4117 was still open with no staff
comment, no assignee and no ETA, and the reporter's own examples show the same failure in
Austin, Buenos Aires and Brazil with Google's direct link empty too. The user's call was that
a source which can go to zero worldwide, indefinitely, and bill for the zeroes is not one to
wait on.

So the open work on this feature is **choosing a replacement provider**, not polishing what
exists. `EventProvider` was built for exactly this: a new source is a new class and one
binding in `server.ts`. Requirements are low — a title, some date text, and either a street
address or a venue name; coordinates are optional because the geocoder handles the rest and
caches permanently. **Check what a zero-result call costs before wiring anything to a daily
refresh**, which is the trap measurement 2 records.

Everything in this document that could be measured without that source **was** measured, on
2026-08-05, against the live APIs and the running app. Where something is inferred it says
so. Where the outage prevented a measurement, it says that too, and names what the missing
measurement would settle.

## What it is

A **third page in the carousel**: events happening near San Jose, drawn as pins on a map.
Tap a pin, get that event's details.

The two existing pages answer *what is it like outside* and *what is everyone searching
for*. This one answers *what is happening near me*. It is the first page in this project
whose content is a place rather than a number.

## What is settled

Set by the user, not open for this plan to revisit.

- **Stack: SerpApi for events, MapTiler for tiles and geocoding, Leaflet for the map.**
  Decided 2026-08-05. Eventbrite was ruled out earlier — its public event search was
  removed in February 2020 and never replaced.
- **Centre on `config.location`** — the existing San Jose downtown point, `37.3382,
  -121.8863`, already used by the weather half. Not a second, separate events centre, and
  not ZIP 95128. One dashboard, one location.
- **20-mile radius.**
- **One neutral tile style plus a per-theme CSS filter**, not six hand-authored MapTiler
  styles — subject to rendering both before committing.
- **An address that will not geocode leaves the event listed but not pinned**, never
  dropped and never guessed at, and the count of such events is **visible on screen**.
  Measurement 7 shows this path is taken often enough to matter, and that the harder problem
  is not addresses that *fail* but addresses that *succeed with the wrong answer at full
  confidence*.
- **The source sits behind a provider interface**, the same shape as `TrendProvider` in
  `apps/api/src/trends.ts`.
- **`SERPAPI_KEY` is backend-only.** The MapTiler tile key reaches the browser because the
  browser fetches tiles directly.

## The measurements

Five. The first one stopped the project, and the second and third overturned assumptions
carried in from `docs/HANDOFF.md`.

### 1. The source returns nothing — measured 2026-08-05

Nine live calls. Six probing the events engine, one on a different engine as a control, one
of SerpApi's own documented examples, one account check.

| Request | Result |
| --- | --- |
| `google_events`, `q=events near San Jose CA`, `location=San Jose…`, `htichips=date:week` | **0** |
| same, no date filter | **0** |
| `google_events`, `q=Events in San Jose` | **0** |
| `google_events`, `q=events in San Jose, CA` | **0** |
| `google_events`, `q=events in New York` | **0** |
| `google_events`, `q=concerts in Austin` | **0** |
| `google_events`, `q=Events in Austin, TX` — *SerpApi's own documented example, verbatim* | **0** |
| `google`, `q=coffee`, same key, same `curl`, seconds apart | **10 organic results** |

Every events response carried `"events_results_state": "Fully empty"` and
`"error": "Google hasn't returned any results for this query."`

**This is not our configuration.** The control proves the key, the account, the network path
and the request shape are all sound — the same credential and the same `curl` invocation
returned ten results from a different engine. No browser was involved at any point, so CORS
cannot apply; no client library was involved, so no wrapper can be out of date. SerpApi
echoed the parameters back in `search_parameters` and resolved
`location_used: "San Jose,California,United States"`, confirming it accepted them.

**It is not SerpApi's parser either, and this is the decisive measurement.** Each SerpApi
response carries a `raw_html_file` — SerpApi's own capture of what Google sent *them*, which
nothing on our side can influence. Retrieved for `concerts in Austin`: 227,154 bytes, no
captcha, no consent wall, `<title>concerts in Austin</title>`. Its entire visible text:

> concerts in Austin · Sign in · **Events filters list · Recommended for you** · Learn more
> · **Can't find events that match. CLEAR FILTERS · SEE WEB RESULTS** · …

Google rendered its events vertical and populated it with nothing, for a major city, with no
filters applied.

**Corroborated:** [serpapi/public-roadmap#4117](https://github.com/serpapi/public-roadmap/issues/4117),
*"[Google Events API] Empty results for all queries"* — opened 2026-08-04, updated
2026-08-05, still open, labelled *Prioritized work* and *type: bug*. No staff reply and no
ETA at time of writing.

**Contradicted by:** SerpApi's own [status page](https://status.serpapi.com/), which showed
Events as operational at 99.97% uptime throughout. The status page is wrong. Do not use it
to decide whether this feature can be built — probe the engine.

**Unresolved, and recorded so nobody re-derives it:** Bright Data's 2026 Google URL-parameter
writeup claims Google silently disabled `ibp=htl;events` in September 2025. That cannot be
squared with the engine having worked until 2026-08-04, and it is a secondary source. It is
noted, not believed. If the engine is still dark in a month, it becomes the more likely
explanation and the source decision genuinely reopens.

### 2. Empty responses still bill — measured 2026-08-05

The account went from 250 searches to 244 across six empty probes, and `this_month_usage`
read `6`. **A query that returns nothing costs exactly what a query returning twenty events
costs.**

This is not a footnote. The design carried in from the user's notes runs seven queries a
day, sized at 210–217 searches against a 250 quota — under 15% slack. During an outage like
the current one, that design spends the entire monthly quota to receive nothing at all, and
does it silently. It is the reason Question 2 below exists.

Account state at time of writing: free plan, 250/month, **241 left**, renews 2026-09-05,
rate limit 250/hour.

### 3. MapTiler counts Leaflet tiles as requests, not map sessions

Per [MapTiler's sessions-vs-requests guide](https://docs.maptiler.com/guides/account/sessions-vs-requests/):
a **map session** is an SDK concept. Third-party libraries hitting the tile API — which is
exactly Leaflet with a raster XYZ URL — are *"tracked by request."*

**This retires the worry recorded in `HANDOFF.md`.** The handoff asked whether attract mode
touring past the map creates a new map session every five seconds. It does not, because
Leaflet raster tiles never create map sessions at all. The counter that matters is API
requests.

Free plan limits, from [MapTiler's pricing page](https://www.maptiler.com/cloud/pricing/):

| Counter | Free allowance | What we consume |
| --- | --- | --- |
| Map sessions | 5,000/month | **zero** — SDK only |
| API requests | 100,000/month | tiles, and geocoding if it counts here |
| Search sessions | 1,000/month | geocoding, cached forever |

On exceeding any of them, a free plan **pauses until the next billing cycle**. That failure —
a wall display going blank until the 1st — is worse than stale data, which is why
Question 4 exists.

### 4. The tile budget is not a constraint — arithmetic, from measurement 3

At 720 × 720 with 256px tiles, the visible grid is `ceil(720/256) + 1 = 4` across and 4 down
— **16 tiles** for a cold load at one zoom level, before any panning.

The Pi reboots roughly once a day (the deploy is `git pull && npm run build && sudo reboot`,
and autostart opens Chromium fresh). One cold load a day at 16 tiles is **~480 requests a
month against 100,000** — under half a percent. Allow a generous 10× for a person panning
and zooming, plus theme switches, and it is still around 5%.

Two things protect that number, and both are budget guards rather than optimisations:

- **256 × 256 tiles, not 512.** MapTiler counts a rendered raster 512 × 512 tile — including
  HiDPI/Retina — as **4 requests**. A 256 × 256 rendered raster tile counts as 1. Leaflet's
  `detectRetina` must stay **off**; the HyperPixel is 720 × 720 at a device pixel ratio of 1,
  so it would buy nothing and cost four times as much.
- **Create the Leaflet map once and call `invalidateSize()`**, never recreate it on page
  visibility. Attract mode reaches the map page every ~25 seconds. A map recreated on each
  visit that also missed the browser cache would issue ~17,000 tile requests a day and pause
  the account in under a week. Cached, it issues zero.

**Not yet verified:** whether MapTiler's geocoding, called from our backend rather than from
a search box, is billed against *search sessions* or against *API requests*. It is cheap
either way because results are cached permanently, but the plan should say which counter it
lands on. One call will settle it — see Phase 0.

### 5. The third page is nearly free in code, and the risk is elsewhere

Read against the running source on 2026-08-05.

| Change | File | Size |
| --- | --- | --- |
| One string in `PAGES` | [App.svelte:28](../apps/web/src/App.svelte#L28) | one line |
| One `<section class="page">` | [App.svelte:224](../apps/web/src/App.svelte#L224) | a block |
| Extra stop in `ATTRACT_TOUR` | [attract.svelte.ts:76](../apps/web/src/lib/attract.svelte.ts#L76) | one entry |
| Page indicator | `PageDots.svelte` | **none** |
| Carousel arithmetic | `App.svelte` `onscroll` / `goto` | **none** |

`PageDots` already iterates `pages` and derives everything from it, so it handles three
without modification. `Math.round(scrollLeft / clientWidth)` is already N-page safe. The
handoff's estimate that this is "bounded, mostly `PageDots`, `ATTRACT_TOUR` and the carousel
arithmetic" was right about the boundary and wrong about which parts move — two of the three
need nothing.

**The real cost is a compositor layer, and it is a Pi risk.**
[App.svelte:373–390](../apps/web/src/App.svelte#L373-L390) gives every `.page` its own layer
via `will-change: transform`, at roughly 2 MB each, and the comment records *why*: without
it the `millennium` theme could not hold a swipe on a Pi 5. A live tile map is a far heavier
layer than flat pixel art — raster imagery rather than flat fills and hairlines.

**So the thing most likely to go wrong on the Pi is swipe smoothness, not map rendering.**
That deserves measuring on the Pi itself and not on the laptop, and it is the one risk in
this feature that a desktop browser will not reveal.

### 6. Leaflet's cost, measured

Leaflet 1.9.4, from the npm registry and unpkg on 2026-08-05:

| | bytes |
| --- | --- |
| `leaflet.js` | 147,552 raw / **42,345 gzipped** |
| `leaflet.css` | 14,806 raw |
| **Dependencies** | **none** |

Zero transitive dependencies, no WebGL, no native build. This is the easiest thing in the
feature to justify under `CLAUDE.md`'s "worth what it costs" test, and it is the only new
front-end dependency the project would take on.

### 7. Geocoding works, and the default settings are actively dangerous

Measured 2026-08-05 against MapTiler's live forward-geocoding endpoint, using the address the
user supplied — *El Quito Park, 12855 Paseo Presada, Saratoga, CA 95070* — and then a spread
of realistic venue shapes.

**The supplied address resolves exactly:** `37.282085, -121.998627`, relevance `1`,
`place_type: ['address']`, 7.3 miles from downtown San Jose. So the mechanism works and the
20-mile radius arithmetic works.

**But MapTiler silently discards the venue name.** The response echoes the tokens it actually
used: `['12855','paseo','presada','saratoga','ca','95070']` — *El Quito Park* is gone. It
geocoded the street address and ignored the venue. That is fine when a street address is
present and catastrophic when it is not, because SerpApi frequently supplies only a venue
name.

Six venue names, queried with default settings and then with `types=poi`:

| Venue name | Default settings | With `types=poi` |
| --- | --- | --- |
| El Quito Park | El Quino, **Nicaragua** (rel 0.69, 2,867 mi) | **El Quito Park, Saratoga** (rel 1, 7.3 mi) |
| SAP Center | spa center, **مصر / Egypt** (rel **0.91**, 7,667 mi) | **SAP Center, San Jose** (rel 1, 0.9 mi) |
| Levi's Stadium | Stadium Loop, **Washington** (rel **0.92**, 640 mi) | **Levi's Stadium, Santa Clara** (rel 1, 6.4 mi) |
| Guadalupe River Park | Parkview, San Jose (rel 0.70) — wrong place | **Guadalupe River Park & Gardens** (rel 1, 1.4 mi) |
| Hammer Theatre Center | Theatre Center, **New Jersey** (rel 0.55) | Kazakhstan (rel 0.37) — **miss** |
| "Online Event" | Iwięcino, **Polska** (rel 0.48) | Norwich, **England** (rel **0.92**) |

**Default settings got zero of six right.** The POI index got four of six exactly right at
relevance 1. **Querying `types=poi` for venue names is not a refinement, it is the difference
between working and not.**

Four findings follow, and each one is load-bearing:

**a. `relevance` is not a confidence score and must never be used alone.** `SAP Center`
scored **0.912** for a landform in Egypt. `Levi's Stadium` scored **0.92** for a street in
Washington state. `"Online Event"` scored **0.92** for a business in Norwich. Meanwhile a
venue-plus-city query like *"El Quito Park, Saratoga, CA"* returns relevance **1** — for the
**centroid of Saratoga**, because the venue name was dropped. High confidence, wrong pin.

**b. `place_type` is the signal `relevance` is not.** When the geocoder cannot find the thing
it falls back to a container and says so: `municipality`, `place`, `locality`, `postal_code`,
`major_landform`. **Accept only `address` (from a street address) or `poi` (from a venue
name). Reject every container type** — a `municipality` result means "I found the city, not
your venue", and pinning it would place an event at a city centre with no indication anything
was guessed.

**c. The distance gate is the last line and it catches what nothing else does.**
`"Online Event"` returns a real `poi` at relevance 0.92. Type gate passes. Relevance gate
passes. Only "5,349 miles from San Jose" kills it.

**d. `bbox` is a trap — do not use it.** It does not reject out-of-area results, it *forces*
a result into the box. `"Online Event"` constrained to a box around San Jose returned
*"Event Venue, 90 South Abel Street, Milpitas"* — **6.4 miles away, inside the radius, and
entirely fabricated.** It converts an obviously-wrong distant answer into a subtly-wrong
nearby one, defeating guard (c), which is our best filter. **Use `proximity` instead** — it
biases ranking without constraining results — **and gate on distance afterwards.**

So the geocoding rule, measured rather than assumed:

```
if the event has a street address:
    geocode it plain          -> require place_type 'address'
else:
    geocode the venue name with types=poi -> require place_type 'poi'

always: proximity bias, never bbox
always: relevance >= ~0.8
always: within 20 miles of config.location
any gate fails -> listed, not pinned, and counted on screen
```

**All four gates are required.** Each one alone lets something through: relevance alone
admits Norwich; type alone admits Norwich; distance alone admits the fabricated Milpitas pin;
POI alone admits nothing useful without the others.

**Coverage is good but not complete.** *Hammer Theatre Center* is a real, well-known San Jose
venue and the POI index does not have it — with or without city context. Its street address
fails too: *"101 Paseo De San Antonio"* geocodes to **San Antonio, Costa Rica** at relevance
0.52, caught only by the `place_type: municipality` gate. **The listed-but-not-pinned path is
not an edge case; it will be exercised regularly**, which is exactly why the user's ruling
that it stays visible on screen is the right one.

**Still unmeasured:** which MapTiler counter this bills against — *search sessions* (1k/month)
or *API requests* (100k/month). MapTiler exposes no programmatic usage endpoint, so this needs
a look at the account dashboard after a known number of calls. Roughly 20 were made during
this session. It is cheap either way, because results are cached permanently.

## What the build found — Phase 1, 2026-08-05

Built and verified against the running server. **Two of the fixtures caught real bugs, which
is the entire argument for having written them that way.**

### 1. Canonical URL is not a safe dedup key on its own

The ladder in the user's notes puts canonical URL at rung 2, above title-and-venue matching.
Correct in general, and **wrong for recurring events**: a weekly farmers' market has one page
for every occurrence, so matching on URL alone silently collapsed next Saturday's market into
this Saturday's.

That is precisely the "do not merge separate dates of a recurring farmers market" rule the
notes call out — defeated by the rung meant to be the second most trustworthy. Measured
before: 15 fixtures → 12 events, `merged: 3`, one market. After: `merged: 2`, both markets
present.

**The fix is one line — the URL key is `url@YYYY-MM-DD`, not `url`.** A URL with no parsed
start date is not used as a key at all, since it would merge every undated listing on a
venue's site into one event.

### 2. "Could not place it" and "too far away" were the same number

The geocoder's distance gate (rule 4 in measurement 7) and the screen's 20-mile radius were
one value. They are different questions — *is this result nonsense?* versus *is this near
enough to show?* — and sharing a number made a real venue 25 miles away come back
indistinguishable from an address nobody could place.

Santa Cruz Beach Boardwalk was reported as `unpinned` rather than `outsideRadius`. The screen
would have said "1 event not on the map" about an event that geocoded perfectly.

**Now two numbers**: `EVENTS_GEOCODE_SANITY_MILES` (150, generous, rejects garbage) and
`EVENTS_RADIUS_MILES` (20, the display radius). Every measured garbage result was thousands
of miles out — Norwich 5,349, Egypt 7,667, Nicaragua 2,867 — so 150 separates them cleanly.

### 3. A postcode rescues an address the POI index cannot find

Measurement 7 recorded *Hammer Theatre Center* as unresolvable by either route, with its
street address geocoding to San Antonio, **Costa Rica**. That is true of
`"101 Paseo De San Antonio, San Jose, CA"`. Adding the postcode —
`"…, San Jose, CA 95112"` — resolves it correctly, 0.3 miles out, at relevance 0.906.

**This does not weaken measurement 7, it explains it.** The Costa Rica result is still what
the four gates are for; `place_type: municipality` is what caught it. What changed is the
expected frequency of the listed-but-not-pinned path: it depends on whether SerpApi supplies
postcodes, which is still unmeasurable while the source is dark.

### Verified behaviour

Against the running server, mock provider, 15 fixtures:

| | measured |
| --- | --- |
| Fixtures in → events out | 15 → 12, `merged: 2` |
| Pinned / unpinned / outside radius | 11 / 1 / 1 |
| Geocode calls, cold cache | **11** |
| Geocode calls, after restart | **1** (the one miss, retrying) |
| Geocode calls, steady state | **0** |
| Cold response / warm response | 0.70s / 0.14s |

The single unpinned event is `"Online Event"`, which is correct — measurement 7 showed it
pinning to Norwich, England without the gates. The retry stopped at three attempts and the
miss is stored permanently, so steady state costs MapTiler nothing.

**The SerpApi path was verified against the live, broken engine** at a cost of one search:
`EVENTS_PROVIDER=serpapi` with a single query returned HTTP 200, `source: serpapi`, zero
events, and logged `Some event queries returned nothing` as a warning rather than an error.
That is the correct degradation — an outage reads as "nothing is on", not as a broken screen.

### What Phase 1 deliberately left out

- **Events are not persisted to disk.** Only the geocode cache is. A restart re-fetches;
  with the mock that is free, and with SerpApi the daily TTL means at most one extra call.
  The plan's failure table wants last-known-good events across restarts, and that is Phase 1b.
- **The budget guards from Question 2 are not built.** No ledger, no hard ceiling, no yield
  backoff. Nothing calls SerpApi automatically yet — the provider defaults to `mock` — so
  nothing can run away, but these must exist before `EVENTS_PROVIDER=serpapi` is set on the
  Pi.
- **No UI.** Phase 2.

## What the outage killed

Recorded so it is not quietly reinstated from the user's original notes.

**The fixture-first workflow cannot start.** The notes say: *"make one controlled live query,
save a sanitized fixture, and build/test against fixtures."* That is the right approach and
it is exactly what Phase 0 does — but there is no payload to capture, so it cannot begin.

Three design areas are blocked behind that fixture, and no amount of planning substitutes
for it:

- **Whether geocoding is needed at all.** SerpApi's documented event fields carry no
  latitude or longitude. But each event has an `event_location_map` containing an `image`,
  and Google's static-map thumbnails frequently encode `center=lat,lng` in the URL. **If
  they do, most geocoding disappears.** This is the single highest-value thing the first
  real payload answers, and it cannot be checked against an empty response.
- **The deduplication ladder.** The priority order in the user's notes — stable ID, then
  canonical URL, then normalised title + venue + start time, then conservative fuzzy match —
  is the right *shape*. Whether the fields it relies on are actually present and stable is a
  question for real strings.
- **Date parsing.** `date.when` is free text along the lines of `"Sat, Aug 8, 7 – 10 PM"`.
  Deriving *Today* in `America/Los_Angeles` from that is the fiddliest code in the backend,
  and writing it against imagined formats is how it gets written twice.

**The seven-query daily design is not safe as specified**, per measurement 2. It is not
killed, but it cannot ship with a budget guard that counts calls without also counting
whether anything came back.

## Architecture

Reusing what exists rather than inventing beside it.

### Backend

```
apps/api/src/
  events.ts        EventProvider interface + SerpApiEventProvider
                   Mirrors trends.ts: one binding in server.ts, nothing
                   downstream knows the source.
  geocode.ts       MapTilerGeocoder. Address in, coordinates out, or null.
  events-store.ts  SQLite: cached events, the venue geocode cache, the
                   monthly call ledger.
```

`server.ts` gains `/api/events`, following the shape `/api/trends/now` already has:
`TtlCache`, `x-cache` and `age` headers, last-known-good on upstream failure, and a
`503` with a typed `ApiErrorBody` only when there is no cache at all.

**Storage follows `trend_categories` exactly**, and for the same reason recorded in
`docs/trend-category-plan.md`: decide once, store, never recompute. A venue's coordinates
never change, so the geocode cache is keyed by normalised address and is permanent. As with
`trend_categories`, `CREATE TABLE IF NOT EXISTS` reaches an existing database and needs no
`#migrate()` entry — but note the standing caveat that `#migrate()`'s `additions` list is
still hardcoded to `trend_snapshots` and will need a table parameter the day any of these
tables gains a column.

The three tables, sketched:

- **`events`** — one row per deduplicated event. Includes the merged source links and the
  query categories that discovered it.
- **`venue_geocodes`** — normalised address → lat/lng, or a recorded miss. A miss is stored
  so the same unresolvable address is not looked up on every refresh, mirroring how a stored
  `uncategorised` stops a retry.
- **`events_fetch_log`** — one row per upstream call: when, which query, how many events came
  back. This is what makes Question 2's budget guard possible, because it records
  *usefulness* and not merely *count*.

### Frontend

```
apps/web/src/lib/
  events.svelte.ts              store, mirroring trends.svelte.ts
  components/EventsMap.svelte   the page: Leaflet instance, markers
  components/EventSheet.svelte  the bottom sheet
```

**No timer on the backend.** This project's established pattern, recorded in `HANDOFF.md`,
is that nothing is fetched unless the dashboard is on screen — the backend fetches on a cache
miss and only the dashboard's poll ever misses. That property is worth keeping here: a Pi
that is switched off should not be spending SerpApi quota. The daily refresh therefore
becomes *"the first cache miss after the interval has elapsed"*, not a `setInterval`.

### The map, concretely

- Leaflet map created **once**, on first mount, and never destroyed. `invalidateSize()` on
  becoming visible.
- 256 × 256 raster tiles, `detectRetina: false`.
- Marker clustering — but hand-rolled or via Leaflet's own primitives rather than adding
  `markercluster` as a second dependency, unless a render shows it is genuinely needed at
  this event count.
- **A Svelte bottom sheet, not a Leaflet popup.** Agreed with the user's notes. A popup on a
  720 × 720 panel is small, hard to hit with a finger, and cannot be styled to match six
  themes without fighting Leaflet's own CSS. A sheet is our component, in our idiom.
- **Required MapTiler and OpenStreetMap attribution.** Non-negotiable and part of the licence.

### Theming

Six themes. The settled approach is **one neutral greyscale MapTiler style, restyled per
theme with a CSS filter on Leaflet's tile pane** — no extra tile requests, no extra styles to
author or maintain, and no visible reload when the theme changes.

**This is settled in principle and unproven in practice.** The user agreed the premise and
also agreed it needs rendering first. If the filter approach looks wrong, the fallback is
custom MapTiler styles, and the cost of that fallback is six styles to author and a tile
refetch on every theme change.

`midnight` is the theme to check first, as always: its `ink` is near-white where every other
theme's is dark, so an inverting filter tuned on `gba-blue` will be wrong there.

## Failure behaviour

The screen must work, and say why, in every one of these. This is the part the categories
feature got right and it is worth copying wholesale.

| Condition | What the screen does |
| --- | --- |
| No `SERPAPI_KEY` | The page is not built at all — same "absence is the off switch" property as the categoriser. The carousel goes back to two pages. |
| SerpApi returns empty (**today's condition**) | Last-known-good cached events, clearly marked stale with their age. If there is no cache, an honest empty state saying the source returned nothing — not an error, because it is not our fault and not the user's. |
| SerpApi unreachable or erroring | Cached events, marked stale. |
| Monthly budget guard tripped | Cached events, and the screen says the refresh is paused until the quota resets, with the date. |
| MapTiler paused (quota exceeded) | **Tiles fail but the page must not.** Fall back to the event *list* with no basemap. A blank grey square is a broken display; a list is a working one. |
| An address will not geocode | The event is listed and not pinned, and the count is shown — *"3 events not on the map"*. Never dropped, never guessed. |
| Geocoder unreachable | Events already geocoded still pin. New ones list without pins and retry on the next refresh. |
| No database | Everything degrades to a single in-memory fetch. Same guard as `history` in `server.ts`. |

The through-line: **every failure degrades to something narrower that still works**, and the
screen names the reason. Nothing here shows a spinner forever or a blank map.

## Configuration

New `.env` entries, following the existing conventions. Already written on 2026-08-05.

```
SERPAPI_KEY=          # backend only, never logged, never to the browser
MAPTILER_KEY=         # backend only — geocoding
VITE_MAPTILER_KEY=    # reaches the browser — tiles
```

The MapTiler key is split into two variables deliberately even though both hold the same
value today. A tile key that reaches the browser is public by construction; a geocoding key
called from the backend need not be. Splitting them now means origin-restricting the tile key
later is a config change rather than a refactor.

`config.ts` gains an `events` block in the existing idiom, with **absence of `SERPAPI_KEY` as
the off switch** — the property that made the categoriser safe.

`.env.example` needs the same treatment the OpenAI key got: documented, explained, and with
the off-switch behaviour stated.

**Both keys currently in `.env` were pasted into a chat transcript on 2026-08-05 and must be
rotated before this ships.**

## The Pi deploy

`pi-setup.sh` already prompts for `OPENAI_API_KEY` and the mechanism generalises. It will
need to prompt for the SerpApi and MapTiler keys too, in the same idiom, with skipping a
supported answer.

Worth carrying forward from the categories work: `.env` is gitignored and cannot arrive by
`git pull`, which is exactly why the prompt exists.

## What this deliberately does not do

- **No GPS, no browser geolocation.** The Pi has none and the dashboard's location is fixed
  in `config.ts`. "Near me" means "near the configured location", which is honest.
- **No second event provider**, and no PredictHQ, Ticketmaster or Eventbrite. The provider
  interface exists so that decision *can* be revisited cheaply — not so that it is made now.
- **No AI anywhere in this feature.** Categorising, summarising or ranking events with a
  model is not in scope. The query categories come from which of the seven searches found an
  event, which is a fact rather than an inference.
- **No ticket purchasing, no deep links beyond the event's own URL.**
- **No user-supplied search.** The queries are fixed in config. A text field on a
  touchscreen panel invites unbounded quota spend.
- **No layout change to the two existing pages.** Their band heights and grids are untouched.
- **No writing of event data we did not receive.** A missing venue is blank, not "TBA".

## Open questions

Five. Each carries a recommendation. The first two change what gets built.

### 1. Refresh cadence — **recommend: once daily, but count useful results**

The arithmetic, against a 250/month free tier:

| Cadence | Queries | Searches/month | Verdict |
| --- | --- | --- | --- |
| 7 queries, hourly | 168/day | 5,040 | far past the $25 plan |
| 7 queries, every 3h | 56/day | 1,680 | needs the $25/1,000 plan, and exceeds it |
| 7 queries, every 6h | 28/day | 840 | needs the $25 plan |
| **7 queries, daily** | **7/day** | **~217** | **fits free, ~13% slack** |
| 4 queries, daily | 4/day | ~124 | fits free, 50% slack |

The handoff framed this as *"every 3 hours fits the free tier; hourly doesn't."* **That was
wrong, and the correction matters:** three-hourly is 1,680 searches a month — nearly seven
times the free tier and past the paid one. It only worked as arithmetic for a *single* query,
not for seven. Recorded here because it is exactly the sort of number that gets carried
forward unchecked.

Events genuinely do not change quickly — a farmers' market on Saturday is on the feed all
week — so daily is not a compromise. **Recommend seven queries daily**, with the caveat in
Question 2. If the slack proves too thin, dropping to five queries costs little; the seven
overlap heavily by design and deduplication merges them.

### 2. What the budget guard counts — **recommend: calls AND yield, with automatic backoff**

The user's notes say *"stop automatic calls at 225, preserving a safety reserve."* That is
right and insufficient, because of measurement 2: **during an outage it spends 225 searches
to receive nothing.**

Recommend three guards rather than one:

- **Hard ceiling at 225/month.** As specified. Never exceeded automatically.
- **Yield backoff.** If a full refresh cycle returns zero events across *all* queries, treat
  the source as down and back off — try one probe query on the next cycle rather than seven.
  One search a day to detect recovery instead of seven a day to confirm an outage.
- **Reserve for manual use.** The 25 searches between 225 and 250 stay available for a
  deliberate refresh, so a person can always force a check.

The yield backoff is what today's finding argues for directly. Without it, this month's
outage would have cost 210 searches and produced an empty screen.

### 3. Where the third page sits, and whether attract mode visits it — **recommend: last, and yes, one stop**

**Position: last.** `WEATHER`, `SEARCH PULSE`, `EVENTS`. The app always opens on the weather
page, and inserting the map in the middle would change what a swipe from weather reaches —
muscle memory on a wall panel is worth more than thematic grouping.

**Attract mode: one stop, appended.** The tour goes from four stops to five, and a loop from
20 seconds to 25. A map is a good thing to look at from across a room and it costs no extra
tile requests once cached.

Open sub-question with no recommendation yet: whether the attract stop should select an event
and show the sheet, or just show the map. The categories plan faced the same question about
trend cards and answered *not for now, adding it later is a change to one array*. The same
answer probably applies, and for the same reason.

### 4. What happens if MapTiler pauses — **recommend: build the list fallback from the start**

MapTiler pauses a free plan for the remainder of the month on exceeding any limit. Per
measurement 4 the tile budget has roughly 20× headroom, so this should never happen — but
"should never" is what the 429 circuit breaker was also for, and that one fired.

**Recommend the events page degrade to a list with no basemap**, and that this is built in
Phase 1 rather than retrofitted. A fallback written after the fact is a fallback nobody has
seen work.

### 5. Does the events page need its own settings? — **recommend: no, not initially**

The settings dialog currently carries themes, weather layout, attract mode and badge style.
Candidates here would be radius, which queries run, and Today vs This Week.

Today/This Week is an on-page filter, not a setting — it is a view control like Search
Pulse's `NOW` / `TODAY`, and belongs on the page. Radius and query selection are
configuration, and configuration in this project lives in `.env`. **Recommend no new settings
entries**, and revisit only if the page proves to need them.

## Phases

**Phase 0 is a gate, not a task.** Nothing below it starts until it passes.

### Phase 0 — the source returns, and we capture a fixture — **BLOCKED**

1. Re-probe `google_events` for San Jose. If it returns events, continue; if not, stop and
   re-check another day.
2. Capture one real payload, sanitise it, commit it as a fixture.
3. **From that payload, answer the three blocked questions:** does `event_location_map`
   carry coordinates; are the dedup fields present and stable; what do the date strings
   actually look like.
4. ~~One MapTiler geocode call~~ — **done, 2026-08-05, see measurement 7.** Geocoding works
   and the four-gate rule is settled. What remains is to read the MapTiler account dashboard
   and record whether it bills against *search sessions* or *API requests*; roughly 20 calls
   were made on 2026-08-05, so the counter that moved is the answer.
5. Once real events are in hand, re-run measurement 7's gates against their *actual* address
   strings. The gates were derived from realistic addresses, not from SerpApi's own — the
   split between "has a street address" and "venue name only" is the number that matters, and
   it decides how often the listed-but-not-pinned path is taken.

If step 1 keeps failing for a few weeks, the source decision reopens and this document needs
a new section rather than an edit.

### Phase 0b — the tile render, which needs no SerpApi

Independent of the blocker and worth doing while waiting. A throwaway page at 720 × 720 with
Leaflet, MapTiler tiles and the CSS filter approach, rendered against `gba-blue` and
`midnight` and `millennium`. **Settles the theming question before any of it is built**,
which the handoff correctly identified as the part most likely to look wrong.

### Phase 1 — backend

`EventProvider` and the SerpApi implementation, geocoding with the permanent cache,
normalisation, deduplication, the three tables, the budget guards, `/api/events`. Built and
tested entirely against the Phase 0 fixture. **No live calls in tests, ever.**

### Phase 2 — the page — **BUILT 2026-08-05**

Third carousel entry, Leaflet map created once, the bottom sheet, the Today / This Week
filter, and the no-basemap fallback. Marker clustering is **not** built — eleven pins do not
need it, and it wants a render against real density before a hand-rolled implementation is
worth writing.

**A list view was added beyond the original plan**, at the user's request: the same events as
two columns of cards with thumbnails, ordered by distance or by time, switched by a MAP /
LIST pair beside the range filter.

It closed a real gap rather than only adding a view. The map showed a count of events it
could not place — "1 NOT PLACED" — and nothing else about them, which meant an event with no
usable address existed on screen only as a digit. The plan's ruling was *listed* but not
pinned; what was built was *counted* but not listed, which is most of the way to having
dropped it. The count is now a control that opens the list on the event itself.

Two collisions with `millennium.css`'s class-name contract were found by rendering, and both
were invisible in the other five themes:

- **`.foot`** is the 7-day footer's class and carries 44px of padding each side to clear the
  corner ornaments. A card's meta row inheriting 88px of padding lost its venue name. Renamed
  to `.meta`.
- **`.views`** is Search Pulse's full-width view band and carries an inset stone channel plus
  14px of padding, which is wrong on a two-button nav nested inside another band. Renamed to
  `.view-switch`.

Three other collisions were checked and deliberately kept: `millennium` qualifies `.title` by
element (`h1.title`), only targets `.card .head` rather than `.head`, and `.date` adds a
text-shadow that suits the sheet. **`.where` is kept on purpose** — it inherits the gold
plaque, which is what Search Pulse's region strip already looks like.

### Phase 3 — theming and the Pi

Apply the Phase 0b result across all six themes. Then measure on the Pi itself: swipe
smoothness with three compositor layers, and whether the map layer costs what measurement 5
suspects it might.

### Phase 4 — deploy

`pi-setup.sh` prompts for the two new keys. `.env.example` documents them. `README.md` gets
the events contract, the budget arithmetic, and the honest statement of what the data is —
Google's event listings, as SerpApi scraped them, geocoded by MapTiler, within 20 miles of
downtown San Jose.

## Testing

Following the project's existing patterns.

- Normalisation and deduplication, against the fixture.
- Date filtering across the `America/Los_Angeles` boundary — the case that matters is an
  event late on a day when UTC has already rolled over, the same trap `startOfLocalDay`
  already handles for trends.
- Distance calculation and the 20-mile cut.
- Budget guards: the hard ceiling, the yield backoff, and the manual reserve.
- Carousel resizing — that `invalidateSize()` is called and that the map is **not** recreated.
- Every row of the failure table.

**Live API calls must never run automatically.** The only live calls in this project's
history have been deliberate, counted, and made by a person.

---

*Written 2026-08-05, after nine live SerpApi calls, four documentation checks and a read of
the running source. The source outage is the reason this is a plan and not a build.*
