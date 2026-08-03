# Search Pulse — Plan

The working plan for the Search Pulse section of the dashboard. Read this before starting
a phase. Update it as phases land.

Lines marked **AMENDED** record where the plan met reality and reality won.

## Status

| Phase | What | State |
| --- | --- | --- |
| 0 | Carousel shell and placeholder screen | Done — 2026-08-02 |
| 1 | Live Trending Now list | Done — 2026-08-02 |
| 2 | Selected-trend details panel | Done — 2026-08-02 |
| 3 | SQLite history and rank graph | Done — 2026-08-02 |
| 4 | Daily history view | Next |
| 5 | Reliability and polish | Not started |

**Each phase is merged and usable before the next one starts.** Finishing the current
phase is the whole job; do not roll ahead into the next to "complete the feature".

## Objective

A full-screen Raspberry Pi dashboard section called Search Pulse that:

- Shows current United States Google Trending Now searches.
- Is reached by horizontally swiping the dashboard.
- Begins with raw, deterministic Google data.
- Adds simple SEO-style context in a later phase.
- Stores historical snapshots so trends can be viewed over time.
- Contains no OpenAI, generative AI, forums, sentiment analysis, or AI-generated
  conclusions.

The first version answers one question clearly:

> What searches are suddenly capturing people's attention right now?

Later versions answer:

> How long did they remain important, and how did their attention change over time?

## Architecture: one section, many views

Search Pulse is **one screen** in the dashboard carousel, and it stays one screen. Every
feature added to it from here on is a **view inside that section**, not a new page beside
the weather.

```
Dashboard carousel  (horizontal, two pages, and it stops at two)
├── Weather        — WEATHER NOW or 7-DAY FORECAST, chosen in settings
└── Search Pulse   — one section, containing many views:
                     ├── NOW      the live trend list          (Phase 1, built)
                     ├── details  metadata for a selected trend (Phase 2)
                     ├── history  rank over time for a trend    (Phase 3)
                     └── TODAY    the day's strongest trends    (Phase 4)
```

So the horizontal swipe keeps meaning "change dashboard section". Moving between Search
Pulse's own views is a different gesture — a tap, or the vertical switch Phase 4
describes — and never another card in the horizontal carousel.

This is why the screen's layout reserves its bands from the beginning: new views change
what is *in* a band, not how many pages exist.

## Navigation

The dashboard is a horizontal page carousel:

```
[Weather] ← swipe → [Search Pulse]
```

Native CSS scroll snapping, not custom gesture physics.

**AMENDED (Phase 0).** The plan's original snippet sized pages with `100vw` / `100vh`.
That is wrong for this app: the design is authored at a fixed 720 × 720 and scaled by a
single transform, so pages are `flex: 0 0 100%` of the carousel's 704 px content box
instead. The carousel also has to hide its scrollbar — a classic horizontal scrollbar
takes its height out of the content box, and every band on every page is budgeted against
the full 704.

Interaction rules:

- Horizontal swipe changes dashboard sections.
- Search Pulse itself contains no horizontal sliders.
- The screen fits within 720 × 720. Vertical scrolling may come later.
- Small square page indicators show the current section, and are also buttons.

## Final screen layout

Reserved from the beginning so later phases do not require a redesign.

```
┌────────────────────────────────┐
│ SEARCH PULSE                   │  title band, 96 px
│ United States   ● LIVE · 4 MIN │  region band, 64 px
├────────────────────────────────┤
│  1. Major search term   500K+  │
│     █████████████████          │
│  2. Another search      200K+  │  trend band, fills
│     ███████████                │
│  3. Another search      100K+  │
│     ███████                    │
├────────────────────────────────┤
│ TREND DETAILS                  │  details band, 132 px
│ Metadata for the selected trend│
└────────────────────────────────┘
```

The upper section displays trends. The lower section becomes the details panel in Phase 2,
and is where the Phase 3 graph goes.

---

## Phase 0 — Carousel foundation · **DONE**

Create the new screen and swipe navigation without connecting Google data.

1. Add the dashboard carousel container.
2. Place the weather screen into page one.
3. Add an empty Search Pulse component as page two.
4. Add horizontal swipe navigation.
5. Add page-position dots.
6. Verify the layout at exactly 720 × 720.
7. Ensure the weather page continues working normally.

Acceptance criteria — all met:

- Swiping left from weather opens Search Pulse; right returns.
- The transition feels native and needs no button.
- Neither screen is partially visible when the swipe settles.
- Existing weather refresh behaviour is unchanged.

---

## Phase 1 — Live Google Trending Now · **DONE**

Display fresh Google Trending Now data with no analysis and no local history.

### Data source

Google Trending Now's official RSS export for the United States, behind an interface:

```
TrendProvider
  └── getTrendingNow(region)
```

Implemented by `GoogleTrendingRssProvider`, so the UI never learns whether the data came
from RSS or a future official API. **No API key and no account** — the feed is public.

### Backend flow

```
Google RSS → Fastify trends service → normalise → cache → GET /api/trends/now → Svelte
```

The frontend never fetches Google directly.

### Refresh behaviour

- Backend refetches every 10 minutes.
- Frontend polls the cached result every 60 seconds.
- A failed poll keeps displaying the last successful response.
- The screen shows the **data's** timestamp, not the last frontend refresh.

### Normalised model

```ts
type TrendingSearch = {
  id: string;
  title: string;
  approximateVolume?: string;
  publishedAt?: string;
  relatedQueries: string[];
  sourceUrl?: string;
};
```

Only fields the official feed supplies are populated. No fabricated percentages, volumes,
categories or durations.

**AMENDED — what the feed actually carries.** Per item: `title` (the search itself),
`ht:approx_traffic` (a bucket floor like `20000+`), `pubDate`, and several
`ht:news_item` headlines. Therefore:

- `relatedQueries` is **always empty**. The feed has no related-searches field. The
  news headlines are articles *about* the trend, not searches anyone ran, and passing
  them off as related queries would put words on the screen nobody typed.
- `sourceUrl` is **always absent**. Every item's `<link>` is the URL of the feed itself,
  so there is nothing per-trend to point at.
- `id` is the title lowercased, trimmed, inner whitespace collapsed — the same key
  Phase 3 stores.

### UI

Five trends at once: rank, search term, Google's figure, and a bar.

**AMENDED — the bar scale.** The plan asked for a logarithmic scale so one huge trend
does not make the rest invisible, which is right. But log against a *fixed origin* fails
the other way: on a list running 200+ to 2000+, `log(v)/log(max)` puts a tenfold gap at
70% against 100%, so every bar looks full. The bar is therefore logarithmic **across the
list's own range**, smallest bucket present to largest. The trade is that the shortest
bar looks the same whatever its absolute figure; Google's own number is printed beside it.

### States — all built

| Condition | Shows |
| --- | --- |
| Loading | `LOADING SEARCH ACTIVITY…` |
| Online, data under 15 min old | lamp + `LIVE · 4 MINS AGO` |
| Online, older | `UPDATED 38 MINS AGO`, no lamp |
| Offline, holding a list | list stays + `OFFLINE · CACHED DATA` |
| Nothing ever loaded | `SEARCH TRENDS ARE TEMPORARILY UNAVAILABLE.` |

Acceptance criteria — all met and verified in the browser:

- Live United States Trending Now searches on screen.
- Data survives a frontend refresh, still reporting its true age.
- Google is contacted only by the backend.
- The screen stays usable when the network drops.
- No AI-generated text. No scraping.

---

## Phase 2 — Basic SEO and trend details · **DONE**

Fill the lower band with deterministic information about the selected trend. This is SEO
*context*, not SEO research.

### Interaction

- The highest-ranked trend is selected by default.
- Tapping another trend selects it.
- The details band updates without changing pages.

### Details panel

Display whatever Google actually provides:

```
TREND DETAILS

Search: earthquake near me
Volume: 500K+
First reported: 7:20 PM
```

**AMENDED — related queries are not available.** The plan's mockup showed a `Related:`
list. The official feed carries no such field (see Phase 1), so it cannot be built from
this source. Options when Phase 2 starts, to be decided then:

1. Ship the panel without related queries.
2. Show the feed's news headlines, clearly labelled as *news about this trend* and never
   as searches.
3. Find a source that genuinely carries related searches, and put it behind
   `TrendProvider` like everything else.

### Deterministic local labels

Simple rules may assign labels such as:

| Label | Rule | State |
| --- | --- | --- |
| `NEW` | First reported less than 30 minutes ago | Built |
| `ACTIVE` | Appeared in the latest response | Dropped |
| `RISING` | Volume bucket or rank increased | Phase 3 |
| `COOLING` | Rank decreased across multiple snapshots | Phase 3 |

These come from explicit code rules a person can read, never from a model.

**AMENDED — only `NEW` ships in Phase 2, and its rule changed.** The plan measures `NEW`
from when *we* first observed a trend, but there is no record of that until Phase 3
stores snapshots. It is measured against the feed's own `pubDate` instead — Google's
report time, which is exact, needs no storage, and survives a reboot.

`ACTIVE` was dropped rather than deferred. Everything in the list appeared in the latest
response by definition, so the label would be true of every row at all times: noise, not
information. It would only start meaning something if the screen also kept showing trends
that had dropped out, which nothing in the plan asks for.

`RISING` and `COOLING` compare against earlier snapshots, which is Phase 3's job. They
were not faked from a single in-memory comparison, because a label derived that way would
silently reset every time the Pi restarted.

### What Google Trends does not supply

It shows demand movement. It does **not** provide keyword difficulty, search ranking
difficulty, cost per click, advertising competition, or conversion probability. Do not
label any value as one of those unless a dedicated SEO provider is added and is genuinely
supplying it.

Acceptance criteria:

- Tapping a trend changes the details panel.
- Missing data is omitted, never replaced with invented values.
- Every status label can be explained by a documented rule.
- No subjective business recommendations.

---

## Phase 3 — Local history and the graph · **DONE**

Begin building a personal historical record of public attention.

### Storage

Each backend snapshot goes into SQLite:

```
trend_snapshots
- id
- trend_key
- title
- approximate_volume
- rank
- related_queries
- first_seen_at
- observed_at
```

Stored with `node:sqlite`, built into Node, so the history costs no dependency and no
native build on the Pi. It needs **Node 24** — 22 has it only behind
`--experimental-sqlite` — which raised the deploy floor.

**AMENDED — `active` was dropped.** A row exists only because the trend was in that
response, so the column would be `1` on every row ever written: dead weight that reads
like it means something. Presence is the observation. Phase 4's active duration comes
from the span between first and last sighting, which the timestamps already give.

Opening the database is allowed to fail. A Pi with a full or read-only disk still shows
what is trending right now, just without remembering it, and a failed write is logged
rather than propagated — losing a history row must never cost the screen its live list.

Deduplicate on a normalised key: lowercase, trim, collapse repeated spaces. Do **not**
merge differently worded searches because they look semantically similar.

### The graph

**This is the graph requirement.** A small sparkline beside the selected trend:

```
RANK — LAST 24 HOURS

1 ┤      ╭──╮
2 ┤  ╭───╯  ╰╮
3 ┤──╯       ╰──
```

**Rank over time comes first, and rank is the right first metric** — it is the one value
that is consistently available, exact, and locally observed. Volume buckets are floors of
a range, so a volume line would draw a smooth curve out of numbers that only ever step
between buckets. Do not pretend volume buckets are exact search counts.

The graph lives in the details band, as a view of whichever trend is selected.

### Additional deterministic metrics

```
First seen:       2h 20m ago
Latest rank:      #3
Peak rank:        #1
Times observed:   14
Active duration:  2h 10m
```

Acceptance criteria:

- Every successful fetch creates a historical snapshot.
- Restarting the Pi does not erase history.
- Selecting a trend displays its last 24 hours.
- Rank history uses real stored observations.
- Approximate volume stays clearly labelled approximate.

---

## Phase 4 — Daily search history

Turn Search Pulse into a record of what captured attention each day.

A vertical switch between two views **inside the Search Pulse section**:

- **NOW** — current live trends.
- **TODAY** — the day's trends, ranked deterministically by highest reported volume
  bucket, then best rank reached, then number of snapshots observed, then total active
  duration.

```
TODAY'S SEARCH ACTIVITY

1. Major event
   Peak #1 · Active 6h 20m

2. Sports result
   Peak #2 · Active 3h 10m
```

No written summary is generated. The records speak for themselves.

### Retention

- Detailed snapshots for at least 90 days.
- Daily aggregates permanently.
- Add cleanup only after storage size is measured.

Acceptance criteria:

- The strongest trends of the current day are viewable.
- Daily results are reproducible from stored data.
- Restarting or updating the app does not erase the archive.
- No news interpretation, no AI summary.

---

## Phase 5 — Reliability and polish

Make Search Pulse dependable enough to run continuously.

- Request timeout, exponential retry delay, last-known-good cache.
- Feed parsing tests.
- Database migration support.
- Logging for failed updates.
- Protection against duplicate snapshots.
- Clean handling of unexpected RSS fields.
- Screen burn-in protection through subtle periodic movement.
- Optional automatic return to the first trend after inactivity.

### Health endpoint

`GET /api/trends/health`

```json
{
  "status": "healthy",
  "lastSuccessfulFetch": "2026-08-02T19:40:00-07:00",
  "cachedTrendCount": 20,
  "dataAgeMinutes": 8
}
```

---

## Explicitly out of scope

Never add any of these to Search Pulse:

- OpenAI APIs, Gemini summaries, local language models
- Reddit or forum data
- News summarisation, sentiment analysis, AI categorisation
- Business-idea generation, opportunity scoring
- Search-result scraping
- Keyword difficulty, CPC estimates, advertising competition

The short version of the rule: everything on this screen must trace back to the official
feed or to an explicit local rule over snapshots we stored ourselves. A field the feed
does not supply is left out, never inferred.
