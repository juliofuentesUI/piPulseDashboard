# Handoff — 2026-08-03

Written at the end of the session that built Search Pulse Phases 0–3 and specified 3.5.
Read this first, then the three documents it points at. Delete or rewrite it when it stops
being true.

## Where the work stands

| Phase | What | State |
| --- | --- | --- |
| 0 | Carousel shell, swipe navigation, placeholder screen | Done |
| 1 | Live Google Trending Now list | Done |
| 2 | Tap-to-select, trend details panel | Done |
| 3 | SQLite history, rank graph, movement labels | Done |
| — | Ordering fix: SURGING / BIGGEST modes | Done |
| 3.5 | Full-screen trend card: image + 3 headlines | **Next** |
| 4 | Daily history view (`TODAY`) | After 3.5 |
| 5 | Reliability and polish | Not started |

All commits pushed, working tree clean. Nothing is parked on a branch.

**Start with Phase 3.5** — specified in full in the plan doc, decided with the user on
2026-08-03. It comes before Phase 4 at their request.

## Read these, in this order

1. **`CLAUDE.md`** — guardrails. The ban list, one-phase-at-a-time, the two-page carousel
   rule, Node 24. These are non-negotiable and were set by the user.
2. **`docs/search-pulse-plan.md`** — the full plan with a status table. Everywhere reality
   contradicted the original plan is marked **AMENDED**; read those first, they are the
   expensive lessons.
3. **`README.md`** — API contract, layout bands, and the reasoning behind the bar scale,
   the graph axes, and the two orderings.

Per-project memories also load automatically in this directory. They cover Pi deployment,
git workflow, and two gotchas repeated below.

## The five things that surprised us

Each of these cost real debugging time. They are all written up in the plan doc under
**AMENDED**, but here is the short version.

**1. The feed is ordered by recency, not popularity.** This is the big one. The RSS export
lists the 10 most *recently detected* trends, newest first. Feed position is arrival
order. Verified against the live feed: `published strictly newest-first` true, `volume
descending` false, largest trend routinely at position six. Consequences: the list offers
two orderings, and the rank graph plots standing **by volume within each fetch** rather
than feed position. Graphing feed position made `COOLING` near-inevitable — 17 of 18
recorded trends only ever moved *down* the feed, because a `pubDate` never changes.

**2. `relatedQueries` is always empty.** The feed has no related-searches field. Its
`ht:news_item` entries are articles *about* a trend, not searches anyone ran. Phase 2's
details panel was planned around related queries; **that gap is now filled by Phase 3.5**
rather than by inventing them — see 2b below.

**2b. There *is* an image and there *are* headlines — verified 2026-08-03.** Checked after
the user asked whether a trend could show something explaining what it is about:

| Field | State |
| --- | --- |
| `ht:picture` | Present on **10/10** items. Fetched one: 200, JPEG, 8.7 KB, 275 × 183 |
| `ht:picture_source` | Present — names the outlet, e.g. "Reuters" |
| `ht:news_item_title` | Present, 3 per trend, with source and article URL |
| `<description>` | **Empty on 10/10** |
| `ht:news_item_snippet` | **Empty on 30/30** |

So there is no prose about a trend, but the headlines answer "what is this about" well —
`artificial intelligence news` tells you nothing, its headline about Chinese military
researchers tells you everything. This is the strongest candidate for filling the hole
left by `relatedQueries`.

**This is now Phase 3.5** and the decisions are made — see the plan doc for the full spec.
In short: a full-screen card inside Search Pulse, the image duotoned to the active theme
in ~4 lines of CSS, all three headlines quoted with their sources, the article link shown,
QR deferred.

**Showing one headline would have been a bug.** Sampled 2026-08-03: four of five trends had
three headlines about one event, but `artificial intelligence news` returned three
different stories. Picking the first would have asserted the trend was about the first when
it was about all three. That is why all three are shown.

**The image treatment is CSS, not canvas.** An earlier version of this spec called for
palette-posterizing on a canvas; tested against a real feed image on 2026-08-03 and it was
overkill. `filter: grayscale(1) contrast(1.35)` plus `mix-blend-mode: screen` over a
theme-coloured panel does the job in four lines and recolours with the theme for free.
Chunky pixels are a separate effect that CSS genuinely cannot do — `image-rendering:
pixelated` only engages when upscaling, and these images are displayed smaller than they
arrive — so that needs canvas and is deferred.

Open sub-decision: this loads images directly from Google in the browser, the first time
the client talks to Google rather than to our API. CORS allows it
(`access-control-allow-origin: *`); it is a question of whether that property is worth
keeping.

Headlines may be shown **quoted with attribution only** — never summarised, interpreted, or
presented as related searches.

**3. There is no relevance ordering available.** Complete element list: `title`,
`ht:approx_traffic`, `pubDate`, `link`, `description`, `ht:picture`, `ht:picture_source`,
`ht:news_item*`. No score, no rank. Google's relevance ranking is not published. Do not
invent a composite and call it relevance.

**4. The feed covers only ~2.5 hours.** Ten slots, a new trend every 10–20 minutes, so a
search is visible for a couple of hours and then drops out. `?hours=24`, `?sort=relevance`
and `?status=active` are all ignored — byte-identical responses. The legacy
`trendingsearches/daily/rss` is retired (404).

**5. Volumes look tiny next to `trends.google.com`.** That page shows accumulated totals
for trends up to a day old; ours shows trends in their first hours. Both are real. This
bounds Phase 4 — see below.

## What Phase 4 needs to know before starting

(Phase 3.5 comes first — see the plan doc.)

The plan's `TODAY` view is "the day's strongest trends, from stored history". It is
buildable, but **be precise with the user about what it can say.**

Our record holds every trend that *started* in a window, with the volume it had **while
young** — not accumulated totals. A trend that reaches 200K+ over 18 hours is captured
during its first couple of hours at maybe 5K+, then drops out of the feed and is never
seen again. So `TODAY` answers *"what caught fire today"*, not *"what were the day's
biggest searches"*. Those sound the same and are not.

The user understands this; it was discussed at length. Do not quietly present the view as
matching Google's 24-hour page.

Also relevant: `TODAY` is the natural home for showing more than five trends. We store all
ten per fetch but render five, and the user asked about this — the decision was to keep
five on the live list because the hidden five are, by definition, the least interesting
under whichever ordering is active. If more are wanted later, two columns of five beats
scrolling on a wall display.

## Decisions already made — do not silently revisit

| Decision | Why |
| --- | --- |
| Keep five rows on the live list | Glance display; hidden rows are the least relevant |
| No third `HOTTEST` ordering mode | Offered, not taken. Two real orderings is enough |
| Rank graph plots volume rank, not feed position | Feed position only ever goes down |
| Axis spans the history that exists, capped at 24h | A fixed axis made most graphs unreadable |
| Bar is log-scaled across the list's own range | Both linear and fixed-origin log were useless |
| `ACTIVE` label dropped | True of every row always; it is noise |
| `active` column dropped from the schema | Would be `1` on every row ever written |
| Carousel stays two pages | User's rule. New views go *inside* Search Pulse |
| Trend card shows all three headlines | One headline misrepresents broad queries |
| Card image duotoned to the theme in CSS | Fixes the clash in 4 lines; canvas was overkill |
| Article link shown, QR deferred | QR suits a wall display but needs an encoder |

## Gotchas

**The dev server serves stale code.** Both Vite and `tsx watch` silently missed rapid
file rewrites in this WSL setup, twice, and both times it looked like a code bug. Vite
served a module missing a function the file plainly had; `tsx watch` stopped restarting
the API entirely and a new route 404'd. Not inotify exhaustion — 9 of 128 instances in
use. **Before debugging code that "isn't working", check what is actually being served:**

```bash
curl -s http://localhost:5173/src/lib/trend-view.ts | grep -c someNewFunction
ps --ppid <tsx-watch-pid> -o pid,etime          # is the API child stale?
```

`touch` on the file usually revives Vite. `tsx watch` needed a full restart. Avoid
rewriting one file several times in quick succession — batch edits into a single write.

**The API may not be running.** The previous session left it running as a background
process, which dies with the session. Run `npm run dev` from the repo root; it starts both
the Fastify API on 3000 and Vite on 5173.

**Node 24 is required**, not 22. `node:sqlite` is behind `--experimental-sqlite` on 22.
This raised the Pi's deploy floor — see CLAUDE.md.

**Verify at exactly 720 × 720, and check all three layouts** — `WEATHER NOW`,
`7-DAY FORECAST`, and Search Pulse. Drive Playwright by accessible name, never by pixel
coordinate. Never pass `filename` to `browser_take_screenshot`.

**Do not deliver screenshots with `SendUserFile`.** They arrive on the user's phone as
broken cards. Let the `browser_take_screenshot` tool result be the image and say in the
reply which capture shows what.

## The data

SQLite at `apps/api/data/trends.db`, gitignored, WAL mode. As of this handoff: 180 rows,
18 fetches, 21 distinct trends, ~150 minutes of history, 484 KB on disk. Roughly 1,440
rows/day, ~26 MB for 90 days.

Schema is one row per trend per fetch: `trend_key`, `title`, `approximate_volume`, `rank`
(feed position), `related_queries`, `first_seen_at`, `observed_at`. A unique index on
`(trend_key, observed_at)` makes a repeated write idempotent.

**`rank` in the table is feed position.** The volume ranking the graph uses is computed at
read time in `historyFor`, by grouping the window's rows by `observed_at` and sorting on
parsed volume. That was deliberate — it avoided a migration and keeps both orderings
recoverable from what is already stored.

Endpoints: `/api/health`, `/api/weather`, `/api/trends/now`, `/api/trends/history?key=`.

## How the user works

Ask before changing direction on their plan; they will say when they want something built.
They read carefully and push back on hand-waving — when something is uncertain, say which
part is verified and which is inferred. Several times the right answer was to test against
the live feed or the database rather than reason about it, and that was always what they
wanted. Explanations should be plain; they asked more than once for simpler language and
were right to.

They are often on a phone, so keep replies scannable.
