# Handoff — 2026-08-03

Three sessions are folded into this. The first built Search Pulse Phases 0–3.5 and the Pi
deploy scripts; the second built the `millennium` theme end to end, including the supplied
artwork; the third built Phase 4, the `TODAY` view. Read this first, then the documents it
points at. Delete or rewrite it when it stops being true.

**Nothing is in flight.** Working tree clean, no branch parked. The one candidate left in
the Search Pulse plan is Phase 5; the weather-provider switch is still gated at W0. Picking
what to do next is a conversation to have with the user, not something to infer from here.

**One thing is genuinely open, and it is not code.** The Pi was deployed on the night of
2026-08-02/03 and has been collecting since, but **its history has never been read** — the
numbers below and everything Phase 4 was verified against come from the laptop's database.
Run `node scripts/history-db.mjs stats` on the Pi to see what it actually holds. Nothing
depends on the answer; it is worth knowing before trusting the day view's counts.

**The Pi is also running a pre-`millennium`, pre-Phase-4 build.** Picking both up is
`git pull` then `./scripts/pi-setup.sh` and `./scripts/pi-start.sh`. That does **not**
touch the history: `apps/api/data/` is gitignored and stays where it is.

## Where the work stands

| Phase | What | State |
| --- | --- | --- |
| 0 | Carousel shell, swipe navigation, placeholder screen | Done |
| 1 | Live Google Trending Now list | Done |
| 2 | Tap-to-select, trend details panel | Done |
| 3 | SQLite history, rank graph, movement labels | Done |
| — | Ordering fix: SURGING / BIGGEST modes | Done |
| 3.5 | Full-screen trend card: image + 3 headlines | Done |
| — | Raspberry Pi deploy scripts | Done |
| — | `millennium` theme, M1–M8, artwork included | Done |
| 4 | Daily history view (`TODAY`) | Done — 2026-08-03 |
| 5 | Reliability and polish | Not started |

## Phase 4 — the TODAY view

A second list view inside Search Pulse, reached by a visible `NOW` / `TODAY` chip pair.
`docs/search-pulse-plan.md` has the full write-up; the parts worth knowing up front:

- **It is a calendar day in local time**, midnight to now, not a rolling 24 hours. The
  user chose that. `startOfLocalDay` in `history.ts` resolves the boundary through `Intl`,
  reading the offset **twice** — the offset now is not the offset at midnight on a DST
  changeover day.
- **Search Pulse gained a fifth band, 44px, and the ordering chips moved into it.** Neither
  existing strip could hold a chip pair: measured, the region strip had 12px of slack and
  the title bar 50px, against the ~142px needed. The band was paid for out of the trend
  list, whose rows went 66px → 57px against 48px of content.
- **Two figures from the plan's sketch did not survive contact with real data** — peak rank
  and the volume bar. Both are written up under Gotchas below, because both were the kind
  of wrong that renders perfectly.
- **`dayDigest` ranks at read time; no aggregate table was added.** ~1,440 rows a day is
  nothing for SQLite, and it keeps every figure recomputable from the raw record.
- `ranksByFetch` is now shared between the rank graph and the day digest, so the
  tie-sharing rule exists once. Two copies of it would have drifted without failing a
  build.

## The `millennium` theme

Built 2026-08-03 as an intermediary phase at the user's request, between 3.5 and 4. Its
own document is **`docs/millennium-theme-plan.md`** and it is thorough — read it before
touching the theme. The short version, and the parts that reach outside the theme:

- **It is the one thing allowed to break "flat by design" and "original pixel art only."**
  The user made that call explicitly. It is itself the sixth theme; do not generalise the
  exception to the app or to a seventh.
- **It grew the theme system by exactly two things.** A `--line` token in `app.css`, so
  structural rules can differ from `ink` — this one touches all five flat themes and was
  verified not to change them. And `styles/millennium.css`, keyed off `[data-theme]`,
  which reaches into components' private class names by specificity rather than by editing
  them.
- **That class coupling is the theme's main hazard.** Renaming `.column` in
  `ForecastColumn.svelte` drops the gold off one band without failing a build or touching
  the other themes. It already bit once: `.screen` is used by *both* App.svelte's panel and
  WeekDashboard's root, so a bare `.screen` rule painted the stone field and inset shadow
  twice on the 7-day layout for two commits. It is `.device > .screen` now. **Read the
  markup before writing a selector in that file** — a doubled dark vignette is nearly
  invisible in a render.
- **Character art goes in the title band, not behind the page.** The plan originally said
  page-background and was wrong: behind opaque plaques a figure lands at about 2% visible,
  and brightening it to compensate puts a face under a 64px temperature.
- **The painted plaques and frames are `border-image` 9-slices**, which is what makes the
  source resolution irrelevant. A 9-slice needs a border thick enough to hold the bevel,
  so it only suits a **fixed-size box** — that is why the ordering chips are still CSS.

### Adding or changing art

**Never copy a file into `apps/web/public/themes/millennium/`.** Art arrives as framed
gallery tiles at ~2.4 MB each; `scripts/theme-art.mjs` is what turns one into a panel asset
— crops the painted frame, keys the black backdrop, trims, downsamples. It took the
supplied set from 34 MB to 7.7 MB. Pass `--keep-frame --no-key` for anything that already
has an alpha channel or the key will eat its dark field, and `--cell=col,row,cols,rows` to
take one tile out of a sheet.

Six of the fourteen supplied pieces are wired in; **eight are placed and deliberately
unused.** That is not an oversight — every band on this panel already carries data, so
adding one is a decision about what leaves the screen. The inventory, and which is which,
is in that directory's `README.md`. (Eighteen files for fourteen pieces: the corner sheet
was cut into four.)

## What is left

**Attract mode is specified and not started** — `docs/attract-mode-plan.md`, requested
2026-08-04. The dashboard drives itself when nobody is touching it: five seconds a screen,
stops the instant it is touched, resumes a minute after the last input, plus a hidden
control to start it now. **Three questions have to be settled before any code**, two of
which change the shape of it: what is in the tour, where the hidden control lives, and what
an open dialog does to the timer. The user calls it "carousel mode"; the document calls it
attract mode, because `carousel` already means the two-page scroller everywhere else.

It does **not** relax the two-page rule. It drives the navigation that already exists.

**Phase 5, reliability and polish**, is partly done now. Already built: request timeouts,
last-known-good cache, duplicate-snapshot protection, migration support, and migration
logging. Still open: exponential retry on a failed fetch, feed-parsing tests (there are
none at all), a `/api/trends/health` endpoint, burn-in protection, and auto-return to the
top trend after inactivity.

**Two of those overlap attract mode and should not be built before it.** Burn-in protection
is largely what attract mode does — a screen that moves every five seconds needs far less of
it — and "auto-return after inactivity" is a special case of the same idle timer. Decide
attract mode first, then see what is left of both.

**Deploying is `./scripts/pi-setup.sh` then `./scripts/pi-start.sh`**, both documented in
`README.md`. Setup proves SQLite can actually write where the history lives, which is what
separates "Node is too old" from "this SD card is read-only" — the two look identical from
the screen. History moves across with `node scripts/history-db.mjs export`; never copy
`trends.db` by hand, because WAL mode leaves most of the data in a sidecar.

**A weather-provider switch is planned**, Open-Meteo to Google's Weather API, at the user's
request on 2026-08-03 because he finds Google noticeably more accurate for San Jose. It has
its own document, `docs/weather-provider-plan.md`, and it is deliberately **not** in the
Search Pulse plan — different half of the dashboard, different rules. Three questions have
to be answered before any code: how many billable calls one refresh really costs, whether
the 7-day table's three columns can survive Google only offering day/night splits, and demo
key versus real key. Do not start at Phase W1 without W0.

## Read these, in this order

1. **`CLAUDE.md`** — guardrails. The ban list, one-phase-at-a-time, the two-page carousel
   rule, Node 24. These are non-negotiable and were set by the user.
2. **`docs/search-pulse-plan.md`** — the full plan with a status table. Everywhere reality
   contradicted the original plan is marked **AMENDED**; read those first, they are the
   expensive lessons.
3. **`README.md`** — API contract, layout bands, and the reasoning behind the bar scale,
   the graph axes, and the two orderings.

Then, only if the work touches them:

4. **`docs/millennium-theme-plan.md`** — the theme, and every placement that was tried and
   rejected before the one that shipped.
5. **`docs/weather-provider-plan.md`** — the Open-Meteo → Google switch, still at W0.
6. **`docs/attract-mode-plan.md`** — the self-driving display, specified and not started.

Per-project memories also load automatically in this directory. They cover Pi deployment,
git workflow, and two gotchas repeated below.

## The six things that surprised us

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

**This became Phase 3.5, and it is built.** A full-screen card inside Search Pulse, reached
by tapping the details band and left by the back control in its header; the image duotoned
to the active theme in ~4 lines of CSS; all three headlines quoted with their sources; the
article shown as outlet and domain in plain text rather than a tappable link, because a tap
on a kiosk navigates away with no way back. QR remains the deferred answer for reaching an
article.

**Showing one headline would have been a bug.** Sampled 2026-08-03: four of five trends had
three headlines about one event, but `artificial intelligence news` returned three
different stories. Picking the first would have asserted the trend was about the first when
it was about all three. That is why all three are shown.

**The image treatment is CSS, not canvas.** An earlier version of this spec called for
palette-posterizing on a canvas; tested against a real feed image on 2026-08-03 and it was
overkill. Chunky pixels are a separate effect that CSS genuinely cannot do —
`image-rendering: pixelated` only engages when upscaling, and these images are displayed
smaller than they arrive — so that needs canvas and is deferred.

**Use a `color`-blend overlay**, not `screen` or `multiply`. All three were rendered side
by side across all five themes; the plan doc has the CSS and the comparison table. Short
version: `screen` suits `gba-blue` alone and blows out elsewhere; `multiply` works
everywhere but goes nearly greyscale on `midnight`, defeating the point; the `color`
overlay holds a visible theme hue in all five *and* keeps the photo legible. The user
picked it from the rendered comparison.

**The overlay token is `sky`, not `ink` — and the first spec had this wrong.** Written with
`var(--c-ink)` the treatment renders flat grey on `midnight`, which is the very failure
`multiply` was rejected for. The `color` blend hands back the *overlay's* chroma spread
(`max − min` of its RGB), and midnight's ink `#eaf2ff` has a spread of 21/255, so there is
no hue in it to give. Measured over a real feed image, `sky` is the only token in the mid
range in all five palettes; the numbers are in the plan doc. The blend mode was never the
problem.

**Test any image treatment against `midnight`.** Its `ink` is near-white while every other
theme's is dark, so it inverts assumptions the other four share — it broke both rejected
options *and* the first choice of overlay token. Do not judge a treatment from `gba-blue`.

Chunky pixels are a separate effect that CSS genuinely cannot do — `image-rendering:
pixelated` only engages when upscaling, and these images are displayed smaller than they
arrive — so that needs canvas and is deferred. The plan's acceptance criterion said the
image should "read as pixel art", which contradicted that; it has been corrected to the
duotone and the theme recolour, which is what shipped.

Settled: images load **directly from Google in the browser**. Phase 1's "Google is
contacted only by the backend" was written to protect the rate-limited RSS endpoint, and
these are `gstatic` CDN thumbnails cached a year, so the reason does not carry over. A
proxy route with a host allowlist is ~30 lines if that property is ever wanted absolutely.
The parser drops any URL that is not http(s) before it can reach an `src`.

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

## What TODAY claims, and what it must never claim

Our record holds every trend that *started* in a window, with the volume it had **while
young** — not accumulated totals. A trend that reaches 200K+ over 18 hours is captured
during its first couple of hours at maybe 5K+, then drops out of the feed and is never
seen again. So `TODAY` answers *"what caught fire today"*, not *"what were the day's
biggest searches"*. Those sound the same and are not.

The screen says `CAUGHT FIRE · BY PEAK VOLUME` for exactly this reason, and every volume on
it is qualified `PEAK`. **Do not soften that wording into "biggest" or "top searches"**, and
do not present the view as matching Google's 24-hour page. The user understands the
distinction; it was discussed at length before the view was built.

`TODAY` is also where the other five trends per fetch finally appear: it shows ten, in two
columns. The live list still shows five, because its hidden rows are by definition the
least interesting under whichever ordering is active — that decision stands.

**The tiebreaks are weaker than the primary key, and it is not visible in the code.**
Fetches and minutes-on-feed measure how long *Google listed* a trend. The feed evicts on
arrival order, ten slots newest-first, so a churny hour flushes everything in it — observed:
`appropriations bill` was pushed out at `10000+` by a feed topping out at `5000+`. Peak
volume is the only key immune to this. Full write-up under **AMENDED** in the plan; the
short version is that `ON FEED` is the honest label and must not become `ACTIVE`, `LASTED`
or `HELD`.

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
| Card image tinted by a `color`-blend overlay | Only option holding theme hue on all five themes |
| The overlay's colour is `sky` | Measured: the only token with chroma in all five palettes |
| Article shown as outlet · domain, not a link | A tap on a kiosk navigates away with no way back |
| Card is entered from the details band | The band already describes the trend; biggest target |
| ~~Headlines not stored in SQLite~~ **reversed 2026-08-04** | A day view has to say what its trends were *about*, and the feed drops them |
| The image is still not stored | Only headlines were asked for; a CDN URL that may expire is a separate call |
| Headlines stored only when they change | Measured: every-row would be ~79 MB/90d against a ~26 MB database |
| Card image fetched by the browser, not proxied | The rule protected the rate-limited feed, not a CDN |
| `millennium` may break flat design; nothing else may | User's explicit call, scoped to that one theme |
| The three layouts do not change for a theme | The reference merges the two weather screens; we kept them apart |
| Theme-specific CSS lives in one `[data-theme]` sheet | Beats scattering rules through twenty components |
| Character art sits in the title band | The only slack on any layout; behind the page it is 2% visible |
| Eight of fourteen art pieces stay unused | Each would have to displace a reading to appear |
| Art is committed, not gitignored | User's call, told it was third-party art in a public repo |
| `TODAY` is a local calendar day, not rolling 24h | User's call: it is what the name claims, and it is reproducible |
| `NOW`/`TODAY` is a visible chip pair, not a swipe | A gesture nobody can see is a view nobody knows exists |
| Search Pulse gained a 44px views band | Measured: no existing strip had room for a chip pair |
| `TODAY` shows ten rows in two columns | The room exists here; scrolling is useless on a wall display |
| Peak rank ranks but is not displayed | All ten shown rows reach #1; it would read as noise |
| `TODAY`'s strip plots time, not volume | Two buckets across ten rows made a volume bar misleading |
| No daily aggregate table | Read-time ranking keeps every figure recomputable from raw rows |
| The open view is not remembered across restarts | `NOW` is the resting state, as the weather page is for the carousel |

## Gotchas

**The dev server serves stale code.** Three times now, and every time it presented as a
code bug. Vite served a module missing a function the file plainly had; `tsx watch`
stopped restarting the API entirely and a new route 404'd; and a CSS rule that had worked
minutes earlier simply stopped applying. Not inotify exhaustion — 9 of 128 instances in
use.

**A `git checkout` triggers it too.** That third case was `git checkout main` before a
fast-forward merge: it briefly reverts a file to main's version and then restores it, and
the watcher latched the intermediate. So it is not only rapid rewrites — any fast
swap-and-restore of a watched file can do it, and branch switching does that by design.

**Comparing served bytes to disk is not a sufficient check.** In the CSS case `curl` came
back byte-identical to disk (19,836 both) with every rule present, while the browser had
parsed only the first of four. Check what the *browser* ended up with:

```bash
curl -s http://localhost:5173/src/lib/trend-view.ts | grep -c someNewFunction
ps --ppid <tsx-watch-pid> -o pid,etime          # is the API child stale?
```

```js
// in the page: does the rule exist, and did it apply?
getComputedStyle(el).position;
[...document.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => /* … */);
```

`touch` on the file revives Vite. `tsx watch` needed a full restart. Avoid rewriting one
file several times in quick succession — batch edits into a single write — and `touch`
after any branch switch before trusting what you see.

**Nothing is recorded unless the dashboard is on screen.** The backend has no timer; it
fetches Google on a cache miss, and only the dashboard's 60-second poll ever misses that
cache. So `pi-start.sh` running with no browser records nothing, and a Pi switched off
records nothing. Measured on the real Pi 2026-08-04: **30 hours of span, 16 fetches** — two
and a half hours of actual collecting. Continuous is ~6 fetches an hour. `pi-setup.sh
--autostart` is the fix, and it must be run *before* `pi-start.sh`, which blocks on the
browser until it closes.

**The API may not be running.** The previous session left it running as a background
process, which dies with the session. Run `npm run dev` from the repo root; it starts both
the Fastify API on 3000 and Vite on 5173.

**Node 24 is required**, not 22. `node:sqlite` is behind `--experimental-sqlite` on 22.
This raised the Pi's deploy floor — see CLAUDE.md.

**Verify at exactly 720 × 720, and check all three layouts** — `WEATHER NOW`,
`7-DAY FORECAST`, and Search Pulse — plus the settings dialog and the trend card, which
are separate surfaces with their own framing. Drive Playwright by accessible name, never
by pixel coordinate. Never pass `filename` to `browser_take_screenshot`.

**Anything touching a shared token means checking a flat theme too.** `millennium.css` is
keyed off `[data-theme]` and cannot reach the others, but `--line`, `--font-display` and
everything else in `app.css` reaches everything. `midnight` is the one to check: its `ink`
is near-white where every other theme's is dark, so it breaks assumptions the other four
share.

**Measure collisions, do not eye them.** Every overlay placement in the theme was settled
by reading back `getBoundingClientRect()` for the element and the thing it might cover.
Guessing produced four wrong answers in a row; measuring produced the right one first
time. Phase 4 repeated the lesson twice in one sitting: the `TODAY` axis caption looked
fine in a render and was measured overlapping the page indicator by 64px — the dots are
drawn *over* it, so the collision is invisible. And a bar that looked uniform in a
screenshot measured correctly at 100% and 12%, so the eye was wrong in both directions.

**Slack in the title bar is theme-dependent.** Measuring it under `millennium` gave 133px;
the same bar at a flat theme's title size has 50px, because the theme restyles `h1.title`
to another face and size. Measure a flat theme — it is the wider case — or a control will
be sized to fit a bar it does not fit.

**A figure that is in the ranking need not be on the screen.** `TODAY` ranks partly on peak
rank, and displaying it would have printed `PEAK #1` on all ten rows: 20% of the day's 160
trends topped a fetch, but ranking by peak volume selects almost exactly the ones that did.
The same measurement is what killed the volume bar on that view — the ten rows held two
distinct buckets, so every bar drew full or at the 12% floor. **Before putting a computed
field on a row, check its spread across the rows that will actually be shown**, not across
the whole table.

**Stubbing `window.fetch` from `browser_evaluate` needs `.bind(window)`.** An unbound call
throws "Illegal invocation", which takes down every other request and drops the panel into
its error screen — it reads exactly like a bug in the change you are testing.

**Do not deliver screenshots with `SendUserFile`.** They arrive on the user's phone as
broken cards. Let the `browser_take_screenshot` tool result be the image and say in the
reply which capture shows what.

## The data

SQLite at `apps/api/data/trends.db`, gitignored, WAL mode. As of this handoff: **600 rows,
60 fetches, 177 distinct trends, ~17.9 hours of history** (2026-08-03 04:43Z → 22:37Z),
~2 MB on disk with the WAL. Roughly 1,440 rows/day, ~26 MB for 90 days.

**That is the laptop's record, and it is the one Phase 4 was built and verified against.**
It was enough — 167 trends over 43 fetches within a single local day, which is the shape
the day view actually consumes. The Pi has been collecting since the night of
2026-08-02/03 and **its database has never been read**; `node scripts/history-db.mjs stats`
on the Pi is the way to see it. Expect a longer, unbroken record than this one, which stops
whenever the laptop sleeps.

The table is **`trend_snapshots`**, one row per trend per fetch: `id`, `trend_key`,
`title`, `approximate_volume`, `rank` (feed position), `related_queries`, `first_seen_at`,
`observed_at`, `published_at`. A unique index on `(trend_key, observed_at)` makes a
repeated write idempotent.

**There is a migration step now, and it is the pattern to follow.** `CREATE TABLE IF NOT
EXISTS` does nothing to a table that already exists, so a new column never reaches a Pi
that has been collecting for weeks — and that history is the thing least worth losing.
`#migrate()` in `history.ts` reads `PRAGMA table_info` and adds what is missing, on every
start, idempotently. Add to it rather than editing `SCHEMA` alone.

**`news` reverses an earlier decision, on purpose.** Phase 3.5 deliberately did not store
headlines — "they describe the present; the card reads the live list" — and that was right
for the card, which only ever shows a trend still on the feed. It is wrong for `TODAY`: the
feed drops a trend after a couple of hours, so without a stored copy the day view can never
say what any of its trends were *about*. The old reasoning still holds where it was made.

**Headlines are written only when they change.** A trend sits in three to six fetches and
its headlines rarely move between them, so storing them on every row is the same ~639 bytes
repeated — measured at **~79 MB over 90 days** against a database otherwise projected at
~26 MB. `record()` compares against the last stored set and writes `NULL` when identical.
Two consequences worth knowing: reads must take the **most recent non-null** row, and that
lookup has to reach **outside** the day window, because a trend that started last night
carries its headlines on a yesterday row. `dayDigest` does this after slicing to ten, so it
is ten small queries rather than one per trend in the day.

**`published_at` is Google's detection time; `first_seen_at` is ours.** They are not
interchangeable: measured against the live feed, our first sighting runs **13–23 minutes
late** in steady state, and hours late after any gap in collection, because we meet a trend
whenever we next poll. Google's `pubDate` also lands on exact ten-minute boundaries — it
buckets its own detection. Rows written before the column existed keep `NULL` and the
screen shows no `REPORTED` for them; **they are never back-filled**, because we do not know
what the feed said then.

**`rank` in the table is feed position.** The volume ranking the graph uses is computed at
read time in `historyFor`, by grouping the window's rows by `observed_at` and sorting on
parsed volume. That was deliberate — it avoided a migration and keeps both orderings
recoverable from what is already stored.

Endpoints: `/api/health`, `/api/weather`, `/api/trends/now`, `/api/trends/history?key=`,
`/api/trends/today`.

`/api/trends/today` takes no parameters — the window is always local midnight to now — and
caps its list at ten while reporting the day's true `trendCount` alongside it, so ten rows
out of a hundred and sixty read as a top ten rather than as the whole day.

## How the user works

Ask before changing direction on their plan; they will say when they want something built.
They read carefully and push back on hand-waving — when something is uncertain, say which
part is verified and which is inferred. Several times the right answer was to test against
the live feed or the database rather than reason about it, and that was always what they
wanted. Explanations should be plain; they asked more than once for simpler language and
were right to.

They are often on a phone, so keep replies scannable.
