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
| — | Ordering fix: `SURGING` / `BIGGEST` — see the AMENDED section at the end | Done — 2026-08-02 |
| 3.5 | Full-screen trend card | Done — 2026-08-03 |
| — | Raspberry Pi deploy scripts | Done — 2026-08-03 |
| 4 | Daily history view (`TODAY`) | Done — 2026-08-03 |
| 5 | Reliability and polish | Not started |

**Phase 4 was deferred on 2026-08-03 and un-deferred the same day**, once the Pi had been
deployed and had collected its own history. The reason for waiting held: a day view is only
as good as the record behind it, and at the time of the deferral that record was 230 rows
over 3.7 hours. It was built against 167 trends over 43 fetches of a full local day.

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
                     ├── card     image and headlines for a trend (Phase 3.5)
                     └── TODAY    the day so far, from our record (Phase 4, built)
```

So the horizontal swipe keeps meaning "change dashboard section". Moving between Search
Pulse's own views is a different gesture — a tap on the details band for the card, a chip
in the views band for `NOW` / `TODAY` — and never another card in the horizontal carousel.

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

## Phase 3.5 — Full-screen trend card · **DONE**

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

```html
<div class="shot"><img src={imageUrl} alt=""></div>
```
```css
.shot {
  position: relative;
  isolation: isolate;          /* keep the blend inside this box */
  background: var(--c-ink);
}
.shot img { filter: grayscale(1) contrast(1.35) brightness(1.05); }
.shot::after {                 /* the theme colour, laid over the photo */
  content: '';
  position: absolute;
  inset: 0;
  background: var(--c-sky);
  mix-blend-mode: color;
}
```

**AMENDED — the overlay is `sky`, not `ink`. Measured while building, 2026-08-03.** As
written with `var(--c-ink)`, this snippet produces a **flat greyscale image on
`midnight`** — the exact failure the table below pins on `multiply`, and the reason the
rule above says to test against that theme.

The maths says it has to. The `color` blend hands back the *overlay's* chroma — its
`max − min` RGB spread — with the photo's luminosity. Midnight's `ink` is `#eaf2ff`, a
spread of 21/255, so there is no hue in it to give. Mean chroma of the composited tile
over a real feed image, 0–255:

| overlay | gba-blue | midnight | dmg-green | brutalist | amber |
| --- | --- | --- | --- | --- | --- |
| `ink` *(as first specced)* | 82 | **19** | **36** | 139 | 122 |
| `sky` | 101 | 93 | 90 | 115 | 86 |
| `blue` | 112 | 101 | **44** | 135 | 126 |

`sky` is the only token in the mid range in all five palettes. `ink` fails `midnight` and
is weak on `dmg-green`; `blue` beats it on four and then collapses on `dmg-green`.

The `color` blend mode itself is unchanged — that decision stands. This is the token that
lets it keep the promise the decision was made on.

Pure CSS, no JavaScript, and it **recolours with the theme** for free because the overlay
is a theme token — switch to Amber CRT and the photo goes amber.

**`color` overlay, chosen after testing all five themes side by side on 2026-08-03.** It
holds a visible theme hue in every one *and* keeps the photo's tonal range, so the subject
stays legible. Two alternatives were tried and rejected:

| Tried | Result |
| --- | --- |
| `mix-blend-mode: screen` on the image | Suits `gba-blue` only. Blows out to near-white on `midnight` and washes out on the other three |
| `mix-blend-mode: multiply` on the image | Works everywhere, but goes **nearly greyscale on `midnight`** — which defeats the point of a theme-coloured treatment |
| `mix-blend-mode: luminosity` overlay | Unusable. Renders a flat grey block |

**Test any image treatment against `midnight` specifically.** Its `ink` is `#eaf2ff` — near
white — while every other theme's is dark, so it inverts assumptions the other four share.
It is what broke both rejected options.

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

**Settled: images load directly from Google in the browser.** This is the first time the
client talks to Google rather than to our API, and Phase 1's "Google is contacted only by
the backend" was written for the *rate-limited RSS endpoint* — one browser refresh costing
an upstream fetch is what the backend cache exists to prevent. These are
`encrypted-tbn*.gstatic.com` CDN thumbnails, cached a year, on a host built to be hit by
browsers, so that reason does not carry over. A proxy route with a host allowlist is
roughly thirty lines if the property is ever wanted absolutely.

The URL is validated before it reaches an `src`: `parseTrendingRss` drops anything that is
not http(s), so a feed that ever carried a `javascript:` or `data:` value would be treated
like any other field it did not supply.

### The article link

Show it. The user asked for it and the feed provides `ht:news_item_url` per headline.

**Shown as text, not tappable — decided 2026-08-03.** The card prints the outlet and the
article's domain, `WKRC · wkrc.com`, which is what the mockup above already draws. Tapping
a link on a wall-mounted kiosk navigates away from the dashboard with no way back, and the
panel has no browser chrome to return with.

**QR codes are explicitly deferred** — considered and held off. They would suit a wall
display, since an article is unreadable on a 720 × 720 panel but scannable to a phone, and
a QR is black-and-white blocks that fit the aesthetic. The cost is an encoder: a small
library or ~250 lines of Reed-Solomon. That, not a tappable link, is the answer if
reaching articles ever becomes a real need.

### Work this needed — all done

- `parseTrendingRss` extracts `ht:picture`, `ht:picture_source`, and each `ht:news_item`'s
  title, source and URL. The added patterns cannot collide with the nested ones: `\b` after
  `ht:picture` keeps it off `<ht:picture_source>`, because an underscore is a word
  character and leaves no boundary there.
- `TrendingSearch` gained optional `imageUrl` and `imageSource`, plus a `news` array that
  is empty rather than absent, the way `relatedQueries` is.
- **Headlines and image are deliberately not stored in `trend_snapshots`.** They describe
  what a search is about *now*; the card always renders the live trend from
  `/api/trends/now`, never from history. Storing three headlines and four URLs per trend
  per fetch would multiply the row size for data nothing reads, and Phase 4 ranks on
  volume, rank and duration — none of which needs them.
- The web client's copy of `news` is optional where the API's is required, on purpose: an
  API build that predates the field should cost the card its headlines, not fail payload
  validation and take the live list down with it.

### Acceptance criteria — all met and verified in the browser

- Tapping the details band shows the card; the back control returns to the list.
- All three headlines appear, quoted verbatim, each with its source named.
- The image is duotoned into the theme palette and recolours with the theme. Checked in
  all five.
- A trend whose feed entry lacks an image or headlines renders without them, not with a
  placeholder — verified by failing the image load.
- Nothing on the card is summarised, interpreted, or presented as a related search.

**AMENDED — "reads as pixel art" was dropped from the criteria above.** It contradicted the
amendment three paragraphs up, which established that chunky pixels cannot be done in CSS
at all and are deferred to a canvas pass. The criterion the shipped treatment is held to is
the duotone and the theme recolour.

One thing the build confirmed about the three-headline rule, from the live feed: `nazca
lines` returned three headlines that agreed on the event and **disagreed on the death toll**
— one said 11, two said 13. They are shown as they were written, and not reconciled.

---

## Phase 4 — Daily search history — BUILT 2026-08-03

Turn Search Pulse into a record of what captured attention each day.

Two views **inside the Search Pulse section**, reached by a visible `NOW` / `TODAY` switch:

- **NOW** — current live trends.
- **TODAY** — the day's trends, ranked deterministically by highest reported volume
  bucket, then best rank reached, then number of snapshots observed, then total active
  duration, then `trend_key`.

The ordering is exactly as planned. `trend_key` was added as a final tiebreak so that
"reproducible from stored data" is literally true, order included.

### What shipped, and the three places it differs from the sketch above

**The switch is a pair of chips, not a vertical swipe — AMENDED.** The plan said "vertical
switch". A wall display has no hover and no menu, so a gesture nobody can see is a view
nobody knows exists — the same reasoning that already keeps both ordering chips visible.
The horizontal swipe also already means "change section", and a second swipe axis on one
panel is easy to catch with a thumb.

**It needed a new band, and the band was measured before it was built — AMENDED.** Neither
existing strip could hold the switch: the region strip had **12px** of slack against the
~142px a chip pair needs, and the title bar had **50px** at a flat theme's title size. So
Search Pulse gained a fifth band of 44px, paid for out of the trend list — rows went from
66px to 57px, against the 48px their text and bar actually occupy. The ordering chips moved
down into that band, which leaves the region strip describing what is shown and the new
band holding the two controls that shape it.

Watch the measurement trap here: `millennium` restyles `h1.title` to a different face and
size, so slack in that bar is **theme-dependent**. Measure a flat theme, which is the wider
case.

**Peak rank is ranked on but not displayed — AMENDED.** The sketch put `Peak #1` on every
row. Measured against a real day: 20% of the day's 160 trends topped a fetch at some point,
but **all ten rows shown did** — ranking by peak volume selects almost exactly the trends
that led a fetch, so the column would have read `PEAK #1` ten times out of ten. That is the
same noise the `ACTIVE` label was dropped for. It still breaks ties in the sort.

**The row's bar plots time, not volume — AMENDED.** A volume bar was built first, on the
live list's log-over-own-range scale. It was wrong here for a structural reason: ranking by
peak volume clusters the ten rows into one or two buckets, and on that day it was exactly
two, so every bar drew either 100% or the 12% floor — rendering a twofold difference as an
eightfold one. The strip now spans local midnight to now, with the filled part running from
first sighting to last, and the axis is labelled under the list. It answers the screen's
second question directly, from the same stored fields.

```
UNITED STATES        SINCE 12:00 AM      167 TRENDS · 43 FETCHES
[NOW][TODAY]                        CAUGHT FIRE · BY PEAK VOLUME

 1  RYAN ZEFERJAHN            6  JOEY BART
    20K+ PEAK 53M ON FEED        10K+ PEAK 22M ON FEED
    ─────────────────▂──         ──────────────▂─────
 …                            …
12:00 AM  TIME ON FEED                                     NOW
```

No written summary is generated. The records speak for themselves.

### The tiebreaks measure Google's listing, not attention — AMENDED 2026-08-03

Found while explaining the screen, and it is not obvious from the code. **Rules 3 and 4 —
fetches appeared in, and minutes on feed — are partly a statement about how busy the news
was**, not purely about how long a search held people.

The feed holds ten slots ordered newest-first, so a trend is pushed out when ten newer ones
are detected, whatever it is doing. Worked example from the record:

```
appropriations bill   10:43 AM  feed slot 8  10000+
                      10:54 AM  feed slot 8  10000+
                      11:04 AM  gone

the 11:04 feed's largest member: cyclospora, 5000+
```

It was dropped while **twice the size of anything that replaced it**. Two fetches and ten
minutes is therefore "Google listed it for ten minutes", not "interest lasted ten minutes".
10:43–11:04 was a churny stretch — ten brand-new trends inside twenty minutes — and
everything alive in it got flushed fast. The same search at a quiet hour would have sat in
the feed far longer on identical real-world interest.

Consequences, and none of them are a reason to change the ranking:

- **Rule 1 is clean and the others are not.** Peak volume is Google's own stated figure and
  is not affected by feed churn. That is why the band says `BY PEAK VOLUME` and why volume
  is the primary key rather than a tiebreak.
- **Do not read a 21-versus-10-minute gap as a fact about public attention.** It is a
  reasonable ordering, not a measurement.
- **`ON FEED` is the honest label** and must stay. `ACTIVE`, `LASTED` or `HELD` would all
  claim the thing this cannot support.
- If a future phase wants real staying power, it needs a different source. The feed cannot
  answer it, and no arithmetic over these rows can recover it.

### The day boundary

`TODAY` runs from **local midnight** in the dashboard's own zone, not UTC and not a rolling
24 hours. The user chose the calendar day: it is what the name claims, and the same query
run twice gives the same answer, where a rolling window silently changes membership on
every fetch. The cost is that the view is nearly empty at 1 a.m., which the band states
outright — `SINCE 12:00 AM` beside the trend and fetch counts.

Rows are stored in UTC and San Jose is seven hours behind it, so a UTC boundary would have
rolled the list over in the late afternoon and called it a new day. `startOfLocalDay` in
`history.ts` reads the zone's offset through `Intl` — twice, because the offset *at this
moment* is not the offset in force at midnight on a DST changeover day.

### Retention

- Detailed snapshots for at least 90 days.
- Daily aggregates permanently.
- Add cleanup only after storage size is measured.

**No aggregate table was added, deliberately.** `dayDigest` scans the day's rows and ranks
them at read time, which is ~1,440 rows for a full day and well under a millisecond in
SQLite. It is the same choice Phase 3 made for the rank graph, for the same reason: it
avoids a migration and keeps every figure recomputable from the raw record. Revisit it if a
90-day view is ever built, not before.

Acceptance criteria — all met:

- The strongest trends of the current day are viewable. ✔ ten of them, two columns
- Daily results are reproducible from stored data. ✔ total order, `trend_key` last
- Restarting or updating the app does not erase the archive. ✔ unchanged schema
- No news interpretation, no AI summary. ✔ nothing but arithmetic over stored rows

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
