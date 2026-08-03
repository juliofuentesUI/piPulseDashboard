# Handoff — 2026-08-03

Two sessions are folded into this. The first built Search Pulse Phases 0–3.5 and the Pi
deploy scripts; the second built the `millennium` theme end to end, including the supplied
artwork. Read this first, then the documents it points at. Delete or rewrite it when it
stops being true.

**Nothing is in flight.** Working tree clean, `main` pushed, no branch parked, no question
outstanding. The next session starts from a standing stop — which means picking what to do
next is a conversation to have with the user, not something to infer from this file. The
two candidates are Phase 4 and the weather-provider switch, and **both are explicitly
gated**; see below.

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
| 4 | Daily history view (`TODAY`) | **Deferred — deploy first** |
| 5 | Reliability and polish | Not started |

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

## Neither of the two obvious next steps is unblocked

**Do not start Phase 4.** The user deferred it on 2026-08-03 to get the current version
onto the Pi first, and that ordering is right on its own merits: Phase 4 is only as good as
the history behind it, and there were 230 rows over 3.7 hours when the call was made. Let
the Pi accumulate a real record before designing a day view against it. Read "What Phase 4
needs to know before starting" below when it does come round — the promise it can honestly
make is narrower than its name suggests.

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

## What Phase 4 needs to know before starting

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
| Card image tinted by a `color`-blend overlay | Only option holding theme hue on all five themes |
| The overlay's colour is `sky` | Measured: the only token with chroma in all five palettes |
| Article shown as outlet · domain, not a link | A tap on a kiosk navigates away with no way back |
| Card is entered from the details band | The band already describes the trend; biggest target |
| Headlines and image not stored in SQLite | They describe the present; the card reads the live list |
| Card image fetched by the browser, not proxied | The rule protected the rate-limited feed, not a CDN |
| `millennium` may break flat design; nothing else may | User's explicit call, scoped to that one theme |
| The three layouts do not change for a theme | The reference merges the two weather screens; we kept them apart |
| Theme-specific CSS lives in one `[data-theme]` sheet | Beats scattering rules through twenty components |
| Character art sits in the title band | The only slack on any layout; behind the page it is 2% visible |
| Eight of fourteen art pieces stay unused | Each would have to displace a reading to appear |
| Art is committed, not gitignored | User's call, told it was third-party art in a public repo |

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
time.

**Do not deliver screenshots with `SendUserFile`.** They arrive on the user's phone as
broken cards. Let the `browser_take_screenshot` tool result be the image and say in the
reply which capture shows what.

## The data

SQLite at `apps/api/data/trends.db`, gitignored, WAL mode. As of this handoff: **500 rows,
50 fetches, 136 distinct trends, ~16.5 hours of history** (2026-08-03 04:43Z → 21:16Z),
~2 MB on disk with the WAL. Roughly 1,440 rows/day, ~26 MB for 90 days.

That 16.5 hours is still a laptop's record, not the Pi's, and it is the thing Phase 4 is
waiting on — 136 distinct trends across a day is a real sample, but it is one day and it
stops whenever this machine sleeps.

The table is **`trend_snapshots`**, one row per trend per fetch: `id`, `trend_key`,
`title`, `approximate_volume`, `rank` (feed position), `related_queries`, `first_seen_at`,
`observed_at`. A unique index on `(trend_key, observed_at)` makes a repeated write
idempotent.

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
