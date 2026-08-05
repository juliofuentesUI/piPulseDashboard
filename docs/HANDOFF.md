# Handoff — 2026-08-05 (evening)

Rewritten after the session that built the events map. The previous handoff said the next
session would be *planning* that feature; it planned it and then built most of it, so that
document is gone. Delete or rewrite this one when it stops being true.

## Start here — the events map needs a new data source

**The map is built and works. It has no real data, and getting some is the open problem.**

`docs/events-map-plan.md` is the reference for all of it.

**SerpApi's Google Events engine has returned zero results for every query since
2026-08-04** — verified repeatedly, most recently on the evening of 2026-08-05. It is not our
configuration and not SerpApi's parser: the raw HTML Google served them says *"Can't find
events that match"*, and the same failure reproduces in Austin, Buenos Aires and Brazil.
[serpapi/public-roadmap#4117](https://github.com/serpapi/public-roadmap/issues/4117) is still
open, still has no staff comment, no assignee and no ETA.

**The user's decision on 2026-08-05 was to stop waiting on it and look for a different
source.** That is the next piece of work on this feature. Things to know before starting:

- **The provider interface already exists for exactly this.** `EventProvider` in
  `apps/api/src/events.ts`, one binding in `server.ts`, and everything downstream — pipeline,
  route, browser — sees the same normalised `LocalEvent`. A new source is a new class, not a
  rewrite. `MockEventProvider` is the worked example.
- **Whatever replaces it must supply, at minimum:** a title, some date text, and either a
  street address or a venue name. Coordinates are a bonus, not a requirement — the geocoder
  handles the rest and caches permanently.
- **Cost it out first.** SerpApi's free tier bills empty responses exactly like full ones,
  which is the trap that made the outage expensive rather than merely annoying. Whatever
  comes next, check what a zero-result call costs before wiring it to a daily refresh.
- **Eventbrite is still out** — its public event search was removed in February 2020.

**Nothing else about the feature is blocked.** With `EVENTS_PROVIDER=mock` the page runs
end to end, and the switchover is one environment variable.

## What exists now

### The events map — a third carousel page

Three commits: `1cea137` (backend), `00c103a` (the page), `97cbdac` (list view), `8c147d5`
(placeholder art). Built against mock data throughout.

| | |
| --- | --- |
| `EventProvider` + SerpApi and Mock implementations | `apps/api/src/events.ts`, `events-mock.ts` |
| MapTiler geocoding behind four measured gates | `apps/api/src/geocode.ts` |
| Permanent address→coordinate cache in SQLite | `apps/api/src/events-store.ts` |
| Dedup, distance filter, ordering | `apps/api/src/event-pipeline.ts` |
| Free-text date parsing | `apps/api/src/event-dates.ts` |
| Leaflet map, created once and never destroyed | `EventsMap.svelte` |
| Two-column list with sorting and thumbnails | `EventList.svelte` |
| Bottom sheet, generated placeholder tiles | `EventSheet.svelte`, `EventThumb.svelte` |

15 mock fixtures with duplicates, a recurring market, an unplaceable online event and one
outside the radius. They exercise the real geocoder, so the mock tests the production path
rather than bypassing it.

### QR codes on headlines — `02c4ee5`

Tapping a headline in the trend card or the day-trend record opens a QR code for the
article. Headlines always carried real publisher URLs; the view layer had been discarding
them. `qrcode-generator`, 8.8 KB gzipped, zero dependencies.

## What is NOT built, and matters before real data

- **Budget guards.** No monthly ledger, no ceiling, no backoff when a source returns
  nothing. Nothing can run away while the provider is `mock`, but these must exist before
  any paid source is wired up. Question 2 in the plan has the design.
- **Events are not persisted** — only geocodes are. A restart re-fetches.
- **No freshness readout and no manual refresh** on the events page, where Search Pulse has
  both.
- **No marker clustering.** Eleven pins do not need it; real density might.
- **Nothing has run on the Pi's own hardware yet** beyond loading. The plan's real Pi risk
  is swipe smoothness with a third compositor layer carrying raster tiles, and only the
  device will show it.
- **There is no test runner in this repo at all** — no `test` script, no test files, either
  workspace. The user's call on 2026-08-05: tests once the feature works fully.
- **`README.md` does not document the events endpoint** or the budget arithmetic.

## The keys, and what happened to them

**Both the SerpApi and MapTiler keys were committed to this public repository on
2026-08-05**, in `pi-setup.sh`, so a Pi with no keyboard could receive them by `git pull`.
They were removed again in `385d981`.

**They are still in git history and always will be.** Deletion did not retire them —
rotation does, and at the time of writing **it has not been done**. The user knows and chose
to defer it. If it still has not happened, it is worth one reminder and no more.

What replaced the mechanism: `scripts/pi-keys.env`, untracked and gitignored beside `.env`,
carried to the Pi on a USB stick or over SSH. `pi-setup.sh` reads it and appends only
missing values, so a key already rotated on the Pi is never clobbered.

**The laptop cannot reach the Pi.** WSL has no tailscale interface — `raspberrypi` resolves
via the Windows resolver but every port times out, because traffic routes to the home
gateway which knows nothing about `100.x`. Any scp or ssh has to run from Windows, not WSL.

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
2. **`docs/events-map-plan.md`** — the current work, and where the events source problem is
   written down in full: the outage evidence, the four geocoding gates, the budget
   arithmetic, and the open questions each with a recommendation.
3. **`docs/trend-category-plan.md`** — the closest thing to a worked example of how this
   project plans a feature: measure first, record what the measurement killed, ask the user
   the questions that actually change the design.
4. **`README.md`** — API contract, layout bands, the reasoning behind the bar scale and the
   two orderings.

Then, only if the work touches them: `docs/search-pulse-plan.md`,
`docs/attract-mode-plan.md`, `docs/millennium-theme-plan.md`,
`docs/weather-provider-plan.md` (still gated at W0, three questions unanswered).

## Gotchas

**`VITE_` variables are compile-time, not runtime.** Vite substitutes them into the
JavaScript during `npm run build`, so a bundle built before a key exists carries an empty
value forever and no amount of correct `.env` afterwards changes it. This cost a real
debugging round on the Pi: `pi-setup.sh` was building before it seeded the keys, and the map
reported "NO MAP KEY SET" with a perfectly correct `.env` beside it. Fixed in `3127a00` by
seeding first. Only `VITE_`-prefixed values are affected; everything the API reads is
ordinary runtime environment.

**Do not reuse a class name `millennium.css` targets, unless you want what it does.** It
reaches into other components by class name, so a *new* component picking one up inherits
styling meant for something else — invisible in the other five themes. Caught twice in one
session: `.foot` is the 7-day footer and carries 44px of padding each side, which destroyed
a card's meta row; `.views` is Search Pulse's full-width band and carries an inset channel.
Both renamed. `.where` was kept deliberately, because inheriting the gold plaque was right.
Check before naming: `grep -oE "\.[a-z][a-z-]*" apps/web/src/styles/millennium.css | sort -u`.

**Empty upstream responses can still cost money.** SerpApi bills a query that returns
nothing exactly like one that returns twenty events — 250 → 244 across six empty probes.
Any budget guard has to count *results*, not calls.

**Verify a QR by rebuilding its grid, not by looking at it.** There is no scanner in this
environment. Pull the rendered module grid out of the DOM and compare it against an
independently generated one; a corrupted render and a correct one look identical at a
glance.

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
