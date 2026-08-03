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
| 3.5 | Full-screen trend card | **Next** |
| 4 | Daily history view | Not started |
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
this source. Options, still open:

1. Ship the panel without related queries.
2. Show the feed's news headlines, clearly labelled as *news about this trend* and never
   as searches.
3. Find a source that genuinely carries related searches, and put it behind
   `TrendProvider` like everything else.

**Option 2 is better supported than it first looked.** Verified 2026-08-03: every item
carries three `ht:news_item_title` headlines with a source and article URL, and an
`ht:picture` thumbnail — 10/10 items, 275 × 183 JPEG, ~9 KB. What it does *not* carry is
prose: `<description>` is empty on 10/10 and `ht:news_item_snippet` on 30/30.

A headline explains a title that explains nothing on its own — `artificial intelligence
news` versus a Reuters headline about Chinese military researchers. Quoting one with its
source attributed is not summarising and is allowed. Costs to settle first: a photographic
thumbnail clashes with a flat pixel-art screen and needs a deliberate treatment; and
loading `gstatic.com` images would be the first time the client talks to Google, which the
API could proxy to avoid.

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

## Phase 3.5 — Full-screen trend card

Added 2026-08-03, ahead of Phase 4, at the user's request. A trend's title often explains
nothing on its own — `PROFESSOR`, `XMEN`, `AERODIANA` — while the feed carries a picture
and three news headlines that explain it completely. This surfaces them.

### The view

A **view inside Search Pulse**, not a new carousel page — the two-page rule holds. Tapping
the details band of a selected trend swaps the list for a full-screen card; a tap goes
back. The list stays glanceable by default and the card gets room to breathe.

```
┌────────────────────────────────────────────┐
│ ← TORNADOES                     1K+ · 2H   │
├────────────────────────────────────────────┤
│  ┌──────────────┐  GALLERY: Storm damage   │
│  │  posterized  │  after apparent tornado  │
│  │    image     │  hits Tri-State          │
│  │              │  WKRC · wkrc.com         │
│  └──────────────┘                          │
│  Strong storms and tornado warnings rattle │
│  Southwest Ohio — WYSO Public Radio        │
│                                            │
│  Tornado warning issued in Butler County   │
│  as storms barrel toward area — Cincinnati │
│  Enquirer                                  │
├────────────────────────────────────────────┤
│  RANK · LAST 2H        [graph]   PEAK #3   │
└────────────────────────────────────────────┘
```

### All three headlines, not one

**Showing a single headline is unreliable and the feed proves it.** Sampled 2026-08-03:
`tornadoes`, `daredevil`, `upcoming meteor showers` and `what is a data breach` each had
three headlines describing one event, so any single one would do. But `artificial
intelligence news` returned three *different* stories — Chinese military AI, an Anthropic
complaint, and Chinese tech advances. Picking the first would have asserted the trend was
about the first when it was about all three.

So all three are shown. Where they agree you learn the event; where they diverge you can
see the trend is broad, and that divergence is itself information.

How Google associates articles with a query is **not published**. Do not describe a
mechanism for it.

### The image, duotoned to the theme — CSS only

Greyscale the photo and blend it onto a panel painted in a theme colour:

```css
.shot { background: var(--c-ink); }
.shot img { filter: grayscale(1) contrast(1.35) brightness(1.05);
            mix-blend-mode: screen; }
```

That is the whole treatment. Four lines, no JavaScript, and it **recolours with the
theme** for free because the blend target is a theme token — switch to Amber CRT and the
photo goes amber.

**AMENDED — the original spec said canvas palette-posterizing; that was overkill.** Tested
side by side on 2026-08-03 against a real feed image. The duotone alone takes the photo
from an obvious foreign object to something in the palette, which was the entire problem.

The chunky-pixel look is a *separate* job and **cannot be done in CSS at all**:
`image-rendering: pixelated` only applies when the browser upscales, and these images
arrive at 275 px and are displayed smaller, so it never engages. `transform: scale()` does
not help either — that is a compositor operation with its own smoothing. Getting blockiness
means canvas: draw small, read back, redraw with `imageSmoothingEnabled = false`. Deferred;
it is a nicety, not what made the photo fit.

If canvas is ever revisited, CORS is not a blocker — verified that
`encrypted-tbn*.gstatic.com` returns `access-control-allow-origin: *`, so with
`crossorigin="anonymous"` the canvas is untainted. Images are cached a year.

Open sub-decision either way: this loads images **directly from Google in the browser**,
the first time the client talks to Google rather than to our API. No technical need to
proxy; a question of whether that property is worth keeping.

### The article link

Show it. The user asked for it and the feed provides `ht:news_item_url` per headline.

**QR codes are explicitly deferred** — considered and held off. They would suit a wall
display, since an article is unreadable on a 720 × 720 panel but scannable to a phone, and
a QR is black-and-white blocks that fit the aesthetic. The cost is an encoder: a small
library or ~250 lines of Reed-Solomon. Revisit if reaching articles becomes a real need.

Worth remembering: tapping a link on a wall-mounted kiosk navigates away from the
dashboard. Decide deliberately whether the link is tappable or shown as text.

### Work this needs

The API does not carry any of this yet:

- `parseTrendingRss` must extract `ht:picture`, `ht:picture_source`, and each
  `ht:news_item`'s title, source and URL.
- `TrendingSearch` gains optional `imageUrl`, `imageSource`, and a `news` array. Same rule
  as everything else: absent when the feed does not state it.
- Decide whether headlines and image belong in `trend_snapshots`. They describe the
  present rather than history, so probably not — but say so on purpose.

### Acceptance criteria

- Tapping into a trend shows its card; a tap returns to the list.
- All three headlines appear, quoted verbatim, each with its source named.
- The image reads as pixel art and recolours with the theme.
- A trend whose feed entry lacks an image or headlines renders without them, not with a
  placeholder.
- Nothing on the card is summarised, interpreted, or presented as a related search.

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

## The feed is ordered by recency — AMENDED, 2026-08-02

Checked against the live export after the screen disagreed with `trends.google.com`:

```
published strictly newest-first?   True
volume descending (a real rank)?   False
biggest volume sits at position    6
feed covers                        2.5 hours
```

So feed position is **arrival order, not popularity**, and the plan's assumption that
rank means importance was wrong. Consequences, all now addressed:

- The list offers two orderings, `SURGING` (the feed's own) and `BIGGEST` (by volume).
- The rank graph plots standing **by volume within each fetch**, recovered from stored
  volumes without a schema change. Graphing feed position would have made `COOLING`
  near-inevitable for every trend, since everything slides down as newer ones arrive.
- `RELEVANCE` is not offered. The export has no such field and Google's ranking is not
  published; a composite of ours carrying their word would be a claim we cannot support.

The feed's 2.5-hour window also bounds what Phase 4 can promise. Our record will hold
every trend that *started* in a window, with the volume it had while young — not the
accumulated totals `trends.google.com` shows for trends up to a day old. It answers "what
caught fire today", not "what were the day's biggest searches".

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
