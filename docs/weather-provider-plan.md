# Weather provider — Plan

Switching the weather half of the dashboard from Open-Meteo to Google's Weather API.

Read this before starting a phase. Update it as phases land. Lines marked **AMENDED**
record where the plan met reality and reality won.

**This is not in `docs/search-pulse-plan.md` on purpose.** That document is scoped to
Search Pulse and carries its guardrails — the ban on hosted models, unofficial sources and
inferred fields. Weather is the dashboard's other half and answers to none of that, so
mixing them would leave the next reader unsure which rules apply to what.

## Status

| Phase | What | State |
| --- | --- | --- |
| W0 | Settle the three open questions below | **Next** |
| W1 | `WeatherProvider` interface, Open-Meteo behind it | Not started |
| W2 | Google provider, built but not default | Not started |
| W3 | Run both side by side and compare | Not started |
| W4 | Make Google the default, keep Open-Meteo as fallback | Not started |
| W5 | Key handling on the Pi | Not started |

## Why

The user judges Google's forecast noticeably more accurate for San Jose than Open-Meteo's.
That is the whole reason and it is a good one — accuracy is the only thing this half of the
screen is for. Nothing below argues against the switch; it argues about what it costs and
what has to be decided first.

## What is verified

Checked 2026-08-03 against Google's own documentation.

| Question | Answer |
| --- | --- |
| Is there a demo key needing no credit card? | **Yes.** The Maps Demo Key, launched 2025 |
| Does it cover the Weather API? | **Yes**, explicitly listed |
| Is it allowed for production? | **No.** "Not designed for production use" |
| What is its daily limit? | **Not published**, and "subject to change" |
| What happens at the limit? | Usage pauses until the next day. No charges |
| Free tier on a real key | 10,000 billable events per month |
| Price beyond that | $0.15 per 1,000 calls |
| Hourly forecast horizon | 240 hours |
| Daily forecast horizon | 10 days |

Fields the dashboard needs, and whether Google supplies them:

| Needed | Google | Note |
| --- | --- | --- |
| Current temperature | `temperature` | |
| Feels-like | `feelsLikeTemperature` | |
| Day or night | `isDaytime` | Selects the day/night sprites |
| Condition | `weatherCondition.type` | A named enum, **not** a WMO number |
| Wind speed | `wind.speed` | |
| Rain chance | `precipitation.probability` | |
| Daily high / low | daily forecast | |
| Fahrenheit and mph | `unitsSystem=IMPERIAL` | Same as today, no conversion needed |
| Local time | `displayDateTime` + `timeZone.id` | Also gives UTC `interval.startTime` |

So the data is all there. The problems are elsewhere.

## Three things to settle before writing any code — Phase W0

### 1. How many calls does one refresh actually cost?

**This is the one that decides whether the switch is free or not.** Open-Meteo returns
current, hourly and daily in a *single* request. Google splits them across three endpoints,
and the hourly one paginates: `pageSize` defaults to **24 hours**.

The 7-day table needs three fixed local hours — 09:00, 13:00 and 19:00 — on each of seven
dated rows, which means the hourly series has to reach 168 hours. There is no way to ask
for scattered hours; you get a contiguous run from now.

If `pageSize` cannot be raised above 24, that is **seven** hourly calls, so nine per
refresh rather than one. The arithmetic, assuming one call is one billable event:

| Weather cache TTL | Refreshes/day | Calls/month at 3 per refresh | at 9 per refresh |
| --- | --- | --- | --- |
| 5 min *(today's default)* | 288 | 25,920 | 77,760 |
| 15 min | 96 | 8,640 | 25,920 |
| 20 min | 72 | 6,480 | 19,440 |
| 30 min | 48 | 4,320 | 12,960 |

The free tier is 10,000. **At today's five-minute TTL the switch costs money whatever
happens**, and if the hourly endpoint really does cap `pageSize` at 24 it costs money at
every TTL in that table.

Find out what the real maximum `pageSize` is before anything else. Do it the way this
project has settled every other question of this kind: call the live endpoint and look,
rather than reasoning about the documentation.

Either way, `WEATHER_CACHE_TTL_MS` should go up. Five minutes was chosen when a refresh was
free. Weather does not move that fast, and Search Pulse already refreshes on ten.

### 2. The 7-day table's three columns

Google's daily forecast splits a day into **`daytimeForecast` and `nighttimeForecast`** —
two periods, not three. The table's morning / midday / evening columns cannot come from it.

So either:

- **Keep pulling 168 hourly hours**, and pay whatever question 1 says that costs; or
- **Redesign the 7-day table to two columns**, which is a visible design change to a screen
  that currently works, and would need the user's agreement rather than a quiet decision.

Do not start W2 without picking one. Discovering this halfway through is how a phase turns
into a redesign.

### 3. Demo key or real key

The demo key is genuinely free and genuinely covers the Weather API. It is also documented
as not for production, with an unpublished daily limit that can change under you — and a
wall display refreshing all day is exactly the thing that phrase is about.

The saving grace is that **this app already degrades correctly**. `TtlCache` serves the
last good snapshot when a refresh fails, and the screen reports the data's real age, so a
paused key shows `UPDATED 3 HRS AGO` rather than an error. A pause is a stale reading, not
a blank panel.

Recommended: prototype on the demo key, which is precisely what it is for, and move to a
real key with billing before calling W4 done. At the TTLs above a real key is very likely
free anyway, and it removes a limit nobody can see.

## Phase W1 — A `WeatherProvider` interface

No behaviour change. Weather is fetched today by a bare `fetchWeather()` in
[`weather.ts`](../apps/api/src/weather.ts), while trends already go through a
`TrendProvider` interface so that "the UI never learns whether the data came from RSS or a
future official API". Weather should have the same shape, for the same reason.

```ts
interface WeatherProvider {
  getWeather(location: LocationConfig): Promise<WeatherSnapshot>;
}
```

`OpenMeteoProvider` implements it, `server.ts` binds one instance, and nothing else
changes. That binding is the whole of the eventual switch.

Acceptance: the dashboard behaves identically, and `npm run typecheck` passes.

## Phase W2 — A Google provider

`GoogleWeatherProvider`, built and tested but **not** wired in as the default.

Two pieces of real work beyond fetching:

**Condition mapping.** `describeWeatherCode()` maps WMO numbers to the thirteen sprites.
Google returns named types instead, so it needs a sibling that maps those. The sprites and
the `WeatherCondition` buckets do not change — only what feeds them.

**`weatherCode` leaves the contract.** `WeatherSnapshot.weatherCode` is a raw WMO number,
kept "so the client can be smarter later without an API change". Nothing in the UI reads
it, and under Google it would be a number no source ever stated — which is exactly the kind
of invented field the rest of this project refuses. Drop it, or replace it with the
provider's own condition string. Do not fabricate a WMO equivalent.

**Time handling is easier than feared.** The existing normaliser leans on Open-Meteo's
fixed-width local ISO strings, comparing them as text to pick hours. Google gives UTC
instants *plus* a `displayDateTime` with local parts and a `utcOffset`, so local hours are
readable without a timezone library. Build from `displayDateTime` and the string-comparison
tricks survive.

Acceptance: given a recorded Google response, the provider produces a `WeatherSnapshot`
indistinguishable in shape from the Open-Meteo one, and the three layouts render from it.

## Phase W3 — Compare them

Run both providers for a few days and log both answers, before anything is switched.

The premise of this whole plan is that Google is more accurate here. That is the user's
observation, it is plausible, and it is also the kind of claim this project checks rather
than assumes. A few days of both against what actually happened settles it, and if Google
wins as expected the switch is made on a record instead of an impression.

## Phase W4 — Switch, and keep Open-Meteo

Make Google the default. **Keep Open-Meteo behind the same interface as a fallback**, used
when Google fails or the key is paused.

This is nearly free once W1 exists, and it answers the demo key's one real weakness: the
worst case stops being "no weather today" and becomes "slightly worse weather today".
Open-Meteo needs no key, so the fallback cannot fail for the reason the primary did.

Acceptance: pulling the key entirely leaves the dashboard working on Open-Meteo, and the
screen never claims data it does not have.

## Phase W5 — The key on the Pi

Today the Pi needs no key and no account for anything. That property ends here, and the
deploy has to say so:

- The key lives in `.env` at the repo root, read by `config.ts`. **It stays on the API side
  and never reaches the browser** — the client already only ever calls `/api/weather`.
- `.env` is gitignored already. Confirm it, and never commit a key.
- `pi-setup.sh` should check the key is present and say plainly what is missing if not,
  the same way it checks Node and SQLite.
- `README.md` currently says "no API key, no account". That becomes true of Search Pulse
  only, and needs correcting rather than quietly leaving wrong.

## What does not change

- The two weather layouts, the sprites, and the 720 × 720 budget — subject to question 2.
- `WeatherSnapshot` as the contract between API and client, minus `weatherCode`.
- The rule the whole dashboard runs on: a field the source does not supply is left out,
  never inferred. A different provider does not loosen it.
- Search Pulse. Nothing here touches it.
