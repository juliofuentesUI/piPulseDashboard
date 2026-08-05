# Handoff — 2026-08-05

Rewritten after the session that built trend categories. The previous handoff covered
Search Pulse phases 0–5, the `millennium` theme and attract mode; all of that is still true
and still described in the plan documents it pointed at. This one covers what changed and
what happens next. Delete or rewrite it when it stops being true.

## Start here — the next session is planning, not building

**The next session designs a new screen: a map of nearby events, as pins, on the
carousel.** The user's description: a cheap maps API or library, pins from Eventbrite,
tapping a pin shows that event's details, and it has to be performant on a Pi.

**Nothing is to be built until a plan exists and the user has agreed to it.** They asked
explicitly for back-and-forth until there is shared agreement on what the feature is. That
is the job — not code.

**Search Pulse is paused, deliberately, and it is in a good state.** Everything below about
it is context, not a queue. Do not pick up its open items unless asked.

### Four things to know before planning the map

These are not objections. They are the costs, and the user has been clear that costs get
discussed rather than discovered.

**1. Eventbrite has no public event search, and has not since February 2020.** Verified
2026-08-05. The `GET /v3/events/search/` endpoint was removed and there is no replacement
for searching events across the platform — only *retrieve by ID*, *list by venue*, and
*list by organization*. Broad discovery requires their distribution partner programme,
which is an application. **This may be the single fact that reshapes the feature**, and it
should be settled before anything is designed around it. Ticketmaster's Discovery API is
the usual substitute and does support latitude/longitude search on a free tier; SeatGeek is
another. None of this has been decided.

**2. It is a third page, and everything assumes two.** `PAGES` in `App.svelte`, the page
indicator, the swipe gesture and attract mode's four-stop tour were all written for two
pages. `CLAUDE.md` no longer forbids a third — it says to cost it out first, and that is
this plan's job. The cost is real but bounded; it is mostly `PageDots`, `ATTRACT_TOUR` and
the carousel's scroll arithmetic.

**3. A map is the first real dependency this project would take.** The stack is Svelte,
Vite and Fastify, and nothing else on the front end — the sprites, the RSS parser and the
payload validation are all hand-written on purpose. Leaflet or MapLibre would be a genuine
departure. `CLAUDE.md` permits it explicitly ("there is no banned-technology list at all
any more") but requires it to be worth what it costs. Raster tiles on a Pi 5 are probably
fine; WebGL is the open question.

**4. Photographic map tiles will fight this dashboard's entire look.** Every pixel of this
panel is flat, aliased, six-colour pixel art authored at 720 × 720. A standard OSM tile
dropped into it will look like a screenshot pasted into a painting. There are answers —
a hand-styled tile set, a vector map drawn to the palette, or an abstract non-geographic
layout — and picking one is a design decision, not an implementation detail. **This is
likely the hardest part of the feature and it is worth raising early.**

Two smaller things worth clarifying with the user: what "low GPS data" means (the phrase is
ambiguous — coarse coordinates? small payloads?), and where "near me" comes from, since the
dashboard has no GPS and its location is a fixed San Jose in `config.ts`.

## What landed this session

Search Pulse gained semantic trend categories. Seven commits, `f31b3bb` to `a2cde46`, all on
`main` and pushed. The full write-up is **`docs/trend-category-plan.md`**, which records the
measurements, the decisions and the questions the user answered.

| | |
| --- | --- |
| Eleven categories, plus an honest `uncategorised` | `apps/api/src/categorise.ts` |
| One OpenAI call per fetch, only for trends never seen before | same |
| Stored once in `trend_categories`, never recomputed | `apps/api/src/history.ts` |
| A badge on every row, as a glyph or as three letters | `CategoryBadge.svelte`, `category-glyphs.ts` |
| A legend explaining all eleven | `CategoryLegend.svelte` |
| `BADGES` and `LEGEND` in settings | `SettingsModal.svelte` |
| A manual refresh control on Search Pulse | `SearchPulse.svelte` |
| `NO API KEY` / `KEY REJECTED` when categorising is not working | same |

**It costs $2.62 a year.** Measured, not projected — see the plan for the arithmetic.

### The five things that surprised us

**1. GPT-5 models bill reasoning as output, and the first cost estimate missed it entirely.**
Ten trends on default settings spent 1,101 input tokens and **2,222 output tokens** — 94% of
the bill was thinking about a nine-way label whose evidence was already in the prompt.
`reasoning_effort: minimal` cuts it to 176 with identical answers on everything unambiguous.
That one parameter is the difference between $2.62 a year and about $20. It is set in
`config.ts` and **should not be removed without re-running the numbers**.

**2. An unfunded OpenAI account answers `429`, exactly like a rate limit.** The body says
`insufficient_quota` and it never recovers, where a rate limit clears in seconds. Retrying
it means 120 futile calls a day forever, so it trips a circuit breaker that halts
categorising until restart. The log says so in words, because as a bare 429 somebody spends
an afternoon tuning a backoff for what is a billing page.

**3. Colour cannot carry the category, and this was measured across all six themes.** In
`dmg-green`, `blue` and `hot` are the same hex. In `brutalist-mono`, `warm` *is* the
background. The floor is three separable fills, not eight — so shape carries the category
and one token says "this is a badge". The full ΔE table is in the plan.

**4. A word badge does not fit and a glyph barely does.** `ENTERTAINMENT` at 13px is 128px
of a 264px `TODAY` row and would clip five titles in six. Measured over all 481 stored
titles: a 16px glyph costs `TODAY` 4.4 points of fit and `NOW` 0.2. Both badge styles
shipped behind a setting because the render argued for both.

**5. The legend caught a glyph collision on its first render.** `ai` was drawn as the
conventional four-pointed sparkle, which at 8 × 8 is a cross with four dots — and `health`
is a cross. Invisible while drawing glyphs one at a time, obvious the moment eleven sit in a
column. **A legend is a design tool as well as a feature.**

### Known bug, not fixed

**`obituary` is too loose, and it produced a genuinely bad result.** The trend
`bruce springsteen` was badged `OBT` — *someone has died* — from a headline reading
*"Bruce Springsteen says wife Patti Scialfa's cancer is in remission"*. Good news, about
living people.

Two causes, both mine: the gloss says "someone has died — whoever they were and however it
happened", which is loose enough to catch illness; and `obituary` sits first in the
precedence order, so any hint of death beats everything else. The fix is to require that
**the person named in the trend has died**, and to re-check whether it still needs to
outrank `crime`. A milder case from the same batch: a man flying a helicopter to go
shopping was badged `crime`.

**This is the one thing in Search Pulse worth fixing before anything else there.** A
dashboard on a wall saying someone died when they have not is worse than any late badge.

### Still unanswered from the category plan

Questions 3–8 were never formally answered; the build proceeded on the recommendations.
They are listed in `docs/trend-category-plan.md` and none is blocking. The two most worth
revisiting are whether `obituary` should exist at all given the bug above, and whether the
`weather` category sits oddly next to a dashboard whose other page is the weather.

## The Pi

**Deployed and running, on autostart.** The user deploys with:

```bash
git pull && npm run build && sudo reboot
```

**`pi-setup.sh` is only needed to set the API key**, which it now prompts for. `.env` is
gitignored and cannot arrive by `git pull` — that is deliberate, and it is why the prompt
exists. The user writes the key by hand or lets setup ask.

**Logs now exist.** Under `--autostart` there was no terminal, so everything the servers
said went nowhere. `pi-start.sh` tees to `pipulse.log` at the repo root, keeping one
previous run as `pipulse.log.1`.

That change nearly reintroduced a known failure and the shape of it is worth remembering:
piping to `tee` makes `$!` the *tee* process, and `kill_tree` walks children — of tee, which
has none. The whole server tree would have been orphaned on exit, which is the
orphaned-vite-holding-5173 failure that file already warns about. Process substitution
(`> >(tee "$LOG")`) keeps `$!` on npm.

## The data

SQLite at `apps/api/data/trends.db`, gitignored, WAL mode. **The laptop's** database as of
this handoff: 2,290 snapshot rows, 617 distinct trends, 229 fetches, spanning
2026-08-03 → 2026-08-05. 48 trends carry a category, of which **25 are `sport`** — just over
half, which is what the plan predicted and the reason the category set is not smaller.

Two tables now:

- **`trend_snapshots`** — one row per trend per fetch. Unchanged this session.
- **`trend_categories`** — one row per trend. `category` NULL means *tried and not settled*
  and is retried up to three times; a stored value, **including `uncategorised`**, means the
  model answered and is never retried. That distinction is what stops a badge flickering.

A new table needs no `#migrate()` entry: unlike `ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`
does reach a database that already exists. `#migrate()`'s `additions` list is still
hardcoded to `trend_snapshots`, so it will need a table parameter the day
`trend_categories` gains a column.

Endpoints: `/api/health`, `/api/weather`, `/api/trends/now` (accepts `?refresh=1`),
`/api/trends/history?key=`, `/api/trends/today`.

## Read these, in this order

1. **`CLAUDE.md`** — the standing rules, including that there is no banned-technology list
   and that new dependencies are a conversation rather than a lookup.
2. **`docs/trend-category-plan.md`** — the most recent work, and the closest thing to a
   worked example of how this project plans a feature: measure first, record what the
   measurement killed, ask the user the questions that actually change the design.
3. **`README.md`** — API contract, layout bands, the reasoning behind the bar scale and the
   two orderings.

Then, only if the work touches them: `docs/search-pulse-plan.md`,
`docs/attract-mode-plan.md`, `docs/millennium-theme-plan.md`,
`docs/weather-provider-plan.md` (still gated at W0, three questions unanswered).

## Gotchas

**Measure, do not eyeball.** This is the house rule and it earned its place again this
session: the word badge was killed by measuring 481 real titles, the colour scheme by
computing ΔE across six palettes, and the row space by `getBoundingClientRect` rather than a
render. Guessing has produced a wrong answer nearly every time it has been tried here.

**Verify at exactly 720 × 720, across all three layouts** — `WEATHER NOW`, `7-DAY FORECAST`
and Search Pulse — plus the dialogs, which are separate surfaces. Drive Playwright by
accessible name, never by pixel coordinate. Never pass `filename` to
`browser_take_screenshot`.

**Anything touching a shared token means checking a flat theme too.** `millennium.css` is
keyed off `[data-theme]` and cannot reach the others, but `app.css` reaches everything.
`midnight` is the one to check: its `ink` is near-white where every other theme's is dark.

**Match an existing dialog's class skeleton when adding one.** `millennium.css` styles
dialogs by reaching into `.panel`, `.head`, `.heading`, `.close` and `.body` from outside. A
dialog that invents its own structure arrives unstyled in that theme and nowhere else —
invisible until somebody switches themes. `CategoryLegend.svelte` got the gold frame and
Cinzel heading for free by matching.

**The dev server serves stale code.** Five occurrences and counting. Vite has served a
module missing a function the file plainly had; `tsx watch` has stopped restarting entirely.
A `git checkout` triggers it too. `touch` the file, and treat "my change did nothing" as a
stale watcher until proven otherwise.

**Check for a second API process before believing a bug.** Cost real time this session: a
stale `tsx watch` still held port 3000, the new one died with `EADDRINUSE`, and the old one
served a **warm cache** — so a fix looked like it had failed when it had never run.
`ss -lptn 'sport = :3000'` names the holder.

**Nothing is recorded unless the dashboard is on screen.** The backend has no timer; it
fetches Google on a cache miss, and only the dashboard's poll ever misses that cache.

**Node 24 is required**, not 22. `node:sqlite` is behind a flag on 22.

**Do not deliver screenshots with `SendUserFile`.** They arrive on the user's phone as
broken cards. Let the `browser_take_screenshot` tool result be the image.

## How the user works

They read carefully and push back on hand-waving — say which part is verified and which is
inferred, every time. When something is uncertain the right move is almost always to test it
against the live feed, the database or the running app rather than reason about it, and that
has been what they wanted every time.

They ask for plain language and have asked more than once; they are right to. Explain
without jargon and without hedging.

They give direction and expect it followed, but they also expect to be told the cost. Twice
this session they asked for something I partly declined — an unlimited refresh button (given
a 30-second floor, because Google rate-limits by IP) and a floating toast (given an in-strip
message instead, because the layout has no spare room). Both times, stating the reason
plainly was accepted. **Do the work, name what you changed and why, and let them overrule
you.**

They are often on a phone, so keep replies scannable.

**Keys belong in `.env`, never in the conversation.** This came up the hard way last
session: an OpenAI key was pasted into the chat, which put it in a stored transcript and
meant it had to be revoked and reissued before it could be used. The working pattern is that
the user writes the key into `.env` themselves and simply says which variable it is under —
the API reads it through `--env-file-if-exists`, and nothing needs the value to appear in
the conversation at all. If a key does get pasted, say so plainly and once, and treat
rotating it as the first step rather than an aside.
