# Trend categories — Plan

**Status: designed, not built. C1 is the exception — the key plumbing landed 2026-08-04.**
Seven of the eight questions at the bottom are still open, and two of them change what gets
built rather than how. Everything above them is either settled by the user's brief or
measured against the running app and the real database on 2026-08-04.

Measurements in this document were taken, not estimated. Where something is inferred it
says so.

## What it is

Each trend gets a **category** — one value from a small closed set — inferred from its
title and its headlines by a hosted model, stored once, and drawn as a small badge on the
row in both the `NOW` list and the `TODAY` list.

The point is glanceability. From across the room, without reading a word, the panel should
say *three sports, one politics, one disaster*.

**This is not an exception to a rule.** The Search Pulse guardrails that banned hosted
models and AI categorisation were removed on 2026-08-04 at the user's request; `CLAUDE.md`
records the removal. There is nothing to seek an exemption from. What survives is the
habit of labelling things as what they are, and this document takes that seriously — the
badge is our inference and the design says so out loud.

## What is settled

Set by the user's brief, not open for the plan to revisit:

- **A fixed, closed set of categories defined in code.** Not free-form model output.
- **An honest uncategorised state.** Never force a guess.
- **The dashboard works completely with this off** — no key, key present but disabled, or
  OpenAI unreachable. Badges disappear; nothing else changes.
- **A trend's category never changes.** Compute once, store, never recompute.
- **Only trends never categorised are sent**, and a fetch's new ones go in **one call**.
- **The key is server-side only** and never reaches the browser.

## The measurements

Three of these changed the design. They are first because everything below depends on
them.

### 1. Row space — the badge has to be a glyph, not a word

Measured with `getBoundingClientRect()` at exactly 720 × 720 against the running app.

**`NOW` rows** — the user's 57px is right; measured 56.8px including the 4px divider.

| | measured |
| --- | --- |
| Band | 704 × 288, five rows at 56.8px |
| Hit area / content | 52.8px / 48px → **4.8px of vertical slack** |
| Rank column | 52px (glyph box 44 × 44) |
| Title line | 26px tall, 604px wide |
| Figures cluster (volume + age) | 132.4px, pinned right, 14px gap |
| **Title box** | **457.6px** |
| Dead space between title and figures, as observed | 189.6 – 293.6px |

**`TODAY` rows** — the user's ~264px is right; measured exactly 264px.

| | measured |
| --- | --- |
| Band | 704 × 500 (457 grid + 15 axis + 28 indicator lane) |
| Row | 318 × 91.4, ten in two columns of five |
| Rank column | 44px, then a 10px gap |
| **Body / title box** | **264px** |
| Body content | 68px (22 title + 5 + 20 facts + 5 + 16 track) → **23.4px of vertical slack** |
| Facts cluster, worst observed (`10K+ PEAK 1H 15M ON FEED`) | 244px of 264 → **20px of slack** |

Then the title widths of all **481 distinct trends** in the database, rendered in the real
font at the real size:

| | `TODAY` @ 19px | `NOW` @ 23px |
| --- | --- | --- |
| p50 | 162px | 193px |
| p75 | 224px | 267px |
| p90 | 323px | 386px |
| max | 709px | 846px |
| **fits the box today** | **84.0%** | **94.6%** |

`TODAY` already clips one title in six, and two of the ten rows on screen while this was
measured were clipped. That is the constraint. Now the cost of a badge:

| Badge | costs | `TODAY` fit | `NOW` fit |
| --- | --- | --- | --- |
| none (today) | 0px | 84.0% | 94.6% |
| **16px glyph + 8px gap** | **24px** | **79.6%** | **94.4%** |
| 20px glyph + 8px gap | 28px | 76.7% | 93.6% |
| three-letter abbreviation, `ENT` | 53px | 71.1% | 92.1% |
| truncated with an ellipsis, `ENT…` | 63px | 71.1% | 90.6% |
| truncated with an ellipsis, `ENTE…` | 73px | 67.2% | 89.6% |
| the word `ENTERTAINMENT` | 152px | **17.0%** | 81.5% |

**A word badge is not viable and the number is not close.** `ENTERTAINMENT` at the
qualifier's 13px is 128px of a 264px row; it would clip five titles in six on `TODAY`. A
16px glyph costs `TODAY` 4.4 points and `NOW` 0.2 points, which is roughly one extra
clipped title every two screens on `TODAY` and nothing at all on `NOW`.

So: **the row carries a short token. The word lives on the trend card and the trend
record**, which are full-screen surfaces with room to spell it out. That split is not a
compromise — you cannot read 13px text from across a room anyway, which is the whole point
of the feature.

**What the short token is, is still open — see Question 9.** Two candidates survive the
measurement: a 16px glyph at 24px total, or a three-letter abbreviation at 53px. The glyph
costs less than half the row space and is legible at a distance where letters are not; the
abbreviation needs no learning. Both are drawn in C0 and chosen by looking.

**An ellipsis is ruled out on the measurement, whichever way that goes.** `ENT…` costs 10px
more than `ENT` and lands on the same 71.1% fit — pure cost for no gain. Worse, an ellipsis
is a promise that there is more text to read, on a badge whose entire job is to be
understood without reading. A three-letter abbreviation is a complete token; a truncation
is a broken word.

### 2. Colour across six themes — colour cannot carry eight values

Each palette's five accent tokens, measured as CIE-Lab ΔE against that theme's background
and against each other:

| Theme | ΔE vs bg: ink / blue / sky / warm / hot | closest pair | separable fills |
| --- | --- | --- | --- |
| `gba-blue` | 90 / 75 / 50 / 76 / 79 | ink–blue 27 | 5 |
| `midnight` | 89 / 67 / 41 / 122 / 109 | blue–sky 31 | 5 |
| `dmg-green` | 64 / 51 / 24 / 24 / 51 | **blue–hot 0** | **3** |
| `brutalist-mono` | 117 / 106 / 87 / **2** / 111 | ink–blue 13 | **3** |
| `amber` | 93 / 76 / 47 / 91 / 96 | blue–hot 21 | 5 |
| `millennium` | 88 / 68 / 78 / 95 / 97 | blue–sky 16 | 4 |

Two facts do the damage. **In `dmg-green`, `blue` and `hot` are the same hex** —
`#306230` both. And **in `brutalist-mono`, `warm` is the background** — ΔE 2, which is that
theme's whole idea: it is monochrome on purpose, and `warm` dropping out is what turns the
sprites into line art.

So the floor is **three separable fills**, in two of the six themes, and it is not a bug to
be fixed — it is what those themes *are*.

**Recommendation: shape carries the category, and one colour says "this is a badge".** Every
badge is drawn in a single token, the same one on every row. Eight hues would be readable
on four themes and mush on two, and a feature that only works on the themes with a colour
wheel is not finished. Five distinct silhouettes at 16px read better from across a room than
five hues at 2:1 contrast anyway.

This is the one place the plan does not do what the brief asked for. The brief said
"colour-coded"; the palettes measurably will not carry it. **Question 4** puts it back to
the user with the numbers.

### 3. What these trends actually are — the headlines are required

A keyword tally over the same 481 titles, deliberately crude, to size the buckets:

| Bucket | share |
| --- | --- |
| **matched nothing** | **53.6%** |
| sport | 14.3% |
| business | 7.9% |
| politics | 5.8% |
| entertainment | 4.4% |
| weather | 4.0% |
| tech | 3.7% |
| health | 2.7% |
| matched more than one | 2.5% |
| crime | 1.0% |

**72.8% of titles are three words or fewer with no digits**, and the unmatched half is
overwhelmingly bare proper nouns: `brenton doyle`, `jo adell`, `casey mize`, `liam hicks`,
`rafael jodar`, `elisabetta cocciaretto`, `alex hoppe`, `aerodiana`, `jake reiner`.

Every one of those is a person. Most are athletes. **None of them is categorisable from the
title**, and this is exactly why a local rule was never going to do this job and a model
is worth paying for.

It also answers the brief's question about headlines directly. `CASEY MIZE` is a coin
flip; *"Tigers' Casey Mize exits start with elbow soreness"* is not. A frontier model might
know a few hundred of these names; a nano-tier model will not, and `ALEX HOPPE` nobody
knows.

**Headline coverage is 99.3%** — 149 of the 150 trends recorded since the `news` column
existed carry them. And the payload is smaller than the brief assumed: the ~639 bytes
figure is the stored JSON *including* `source` and `url`. **The headline titles alone,
joined, average 226 bytes.** That is ~57 tokens.

**Recommendation: send the title plus the three headline titles.** Measured cost of the
headlines over the title alone: **about 40 cents a year** (arithmetic below). They are not
a cost decision.

## The badge

### Shape

A **16 × 16 glyph**, drawn on an 8 × 8 pixel grid so it renders at exactly 2× and stays
crisp — the same discipline `weather-icons/sprite.ts` already enforces, and the reason
720 × 720 is non-negotiable. One SVG component, one rect list per category, themed through
the existing `--c-*` tokens like every other sprite in the app.

Eight glyphs at 8 × 8 is tight but it is the scale the whole dashboard is drawn at, and the
existing weather sprites prove the vocabulary works. If a category cannot be drawn legibly
at 8 × 8, that is an argument against that category, not against the size.

### Saying it is ours

The dashboard already has a grammar for this and it should be extended rather than
reinvented:

- **Google's figures are bare text** in a palette colour — volume, age, the timestamps.
- **The things we assign are filled chips with knocked-out text** — `NEW` in
  `SearchPulse.svelte`, and `RISING` / `COOLING` beside it.

So *no container* already means Google's, and *a filled container* already means ours. The
category badge is a third thing again: `NEW` is arithmetic on a timestamp and cannot be
wrong about anything except its own threshold, while this is a model's reading of a
headline and can simply be mistaken.

**Recommendation: a notched plate.** Every rectangle on this dashboard is square-cornered —
the frame, the plaques, the track, the mode chips, the `NEW` badge. A plate with two
corners cut off, drawn as part of the same SVG so it stays on the pixel grid, is
unmistakably a different kind of object at any distance and in any theme, and it needs no
colour to say so. It reads the way a clipped corner reads on a printed form: *this field
was filled in by someone else*.

The alternative worth rendering beside it is a **dithered fill** — a checkerboard of
theme-coloured pixels behind the glyph instead of a solid one. Dithering is the native
pixel-art idiom for "provisional", it is crisp at 2×, and it costs nothing. It may also
read as noise at 16px, which is exactly the kind of thing that has to be looked at rather
than argued about.

**Both get rendered at 720 × 720 in `gba-blue`, `midnight`, `dmg-green` and `millennium`
and shown to the user before either is committed to.** That is a gate, not a courtesy —
`dmg-green` and `brutalist-mono` are where this design is most likely to fail, and
`midnight` has already broken three separate visual decisions on this project by inverting
`ink`.

### Placement

**The title line on both lists, immediately after the title.**

On `NOW` this is free: there is 189–294px of dead air between where the title ends and
where the figures cluster begins, so on a typical row the badge costs the title nothing at
all. On `TODAY` it costs the 4.4 points measured above.

Two placements were measured and rejected:

- **Under the rank number.** `TODAY` has 23.4px of vertical slack in its rows and a 44px
  rank column, so this is genuinely free there — but `NOW` has 4.8px, so it is impossible
  there, and a badge that lives in a different place on each list is two designs.
- **In the facts cluster on `TODAY`.** Worst observed content leaves 20px. Not enough, and
  the cluster is where the qualifiers live, which is the last place a different kind of
  claim should sit.

A third was rejected on the colour finding: **colouring the rank cartouche itself** would
cost no space at all on either list, but it makes colour the only channel, and colour tops
out at three values.

The badge is `aria-hidden` with the category exposed in the row's accessible name, so a
screen reader says "sport" rather than announcing an image.

## The categories

**Eight, plus uncategorised.**

**Expanded to eleven on 2026-08-04**, at the user's request: `ai` and `conflict` added,
`crime`'s glyph changed from a shield to a burglar's mask (the shield moved to `conflict`,
where it always belonged). Nine other candidates were measured and rejected — see the note
in `categorise.ts`. `ai` applies **only when the story is about AI itself**, not when a
share price moved on AI demand; the user chose the tighter reading so the badge cannot
swallow `business`.

| | Covers |
| --- | --- |
| `sport` | Athletes, teams, fixtures, results, transfers |
| `conflict` | War, armed forces, strikes, hostilities |
| `ai` | AI models, capabilities, AI companies, AI policy |
| `politics` | Government, elections, policy, legislation, international affairs |
| `business` | Markets, tickers, companies, money, jobs, prices |
| `entertainment` | Film, TV, music, celebrity, games as culture |
| `tech` | Devices, software, science, space, outages, breaches |
| `health` | Disease, outbreaks, medicine, recalls |
| `weather` | Storms, fires, floods, quakes, air quality — the "disaster" of the brief |
| `crime` | Crimes, trials, investigations, missing persons |
| `obituary` | Someone has died — whoever they were, however it happened |
| `uncategorised` | The headlines did not settle it, or the query is too vague |

### Overlap is resolved by precedence, not by more categories

**Added 2026-08-04**, after the first live batch produced three trends belonging to two
categories each: an Asian AI-investment story (business or tech), a money-laundering review
of a company's bank accounts (business, crime or politics), and a dead jockey (sport or
obituary).

The instinct is to add a category for each. That makes it worse: every new bucket brings
its own two new borders, and the reason to cap the set was never that the ninth idea is
bad — it is that boundaries are where a cheap model drifts.

**None of those three has a correct answer.** The only thing that can actually be wrong is
answering differently on Tuesday than on Monday. So the fix is a stated order, first match
wins:

```
obituary > crime > weather > health > politics > sport > entertainment > tech > business
```

`obituary` leads because a death is the event and the person's profession is the context.
`business` trails because almost anything can be described in terms of money, so it is the
category most likely to swallow the others if it is allowed to win.

This costs no badge, no glyph and no row space, and it is the mechanism real taxonomies
use for exactly this problem.

**What was rejected: a dedicated "boundary" or "ambiguous" badge.** It duplicates
`uncategorised` — both mean *we did not settle it* — and a glance display cannot afford two
different ways of saying nothing. Worse, it would let the model dodge: given a bucket for
hard cases, hard cases go in it, and the badge stops being about the news.

### Why nine

**Not fewer**, because the measured distribution collapses. Sport is the largest bucket
before any name resolution and will grow once the athlete names in the unmatched half are
resolved — plausibly to a third of all trends. A set of four or five would put half the
rows under one badge, and a badge that is the same on half the list has stopped
discriminating.

**Not more**, for three reasons that are all about the same thing:

1. **Nine legible silhouettes at 8 × 8 is ambitious.** Twelve is not drawable. `obituary`
   is the ninth and it was added deliberately, at the user's call, after a dead jockey
   turned up in the very first live batch — deaths trend hard and often. It is also the
   hardest glyph in the set to draw without reaching for something culturally loaded, and
   that difficulty is a live risk to C0 rather than a detail.
2. **Every extra category is a new boundary**, and boundaries are where a small model is
   inconsistent. Is a stadium financing dispute sport or business? Fewer seams, fewer coin
   flips.
3. Forty categories with inconsistent colours is precisely what the brief said it did not
   want, and the mechanism by which that happens is adding one reasonable-sounding
   category at a time.

### Uncategorised is a real value, not a failure

It is in the enum, the instructions state plainly that it is the correct answer when the
headlines do not settle the question, and **a trend with no badge simply has no badge** —
absence costs no row space and asserts nothing.

Two honest caveats. A model told to pick from a list will over-pick; offering the escape
hatch reduces that but does not remove it. And a trend that comes back `uncategorised` is
stored that way and never retried, which is the right call for stability but means a
genuinely ambiguous trend stays blank forever. Both are acceptable; neither should be
discovered later and treated as a bug.

## Cost

The brief asked for arithmetic rather than "we'll cache it". Here it is, with every input
measured against the real database.

### Inputs

| | measured | source |
| --- | --- | --- |
| Median fetch interval | 10.4 min | 182 fetches |
| Fetches per day, collecting continuously | 144 | 10-minute cache TTL |
| **New trends per fetch, steady state** | **2.53** (max 7) | 177 fetches with a ≤20 min gap |
| Fetches with **zero** new trends | 29 / 177 = **16.4%** | same |
| Title length | 15 bytes avg, 57 max | 481 distinct trends |
| **Three headline titles, joined** | **226 bytes** ≈ 57 tokens | 149 trends |
| Headline coverage | 99.3% | 150 trends since the column existed |

Note the brief's "~210 distinct trends a day" is low against this database: 2.53 × 144 is
**~364 a day**. Part of that is real churn and part is the key churning faster than the
story does — `S&P 500`, `S AND P 500`, `SP500` and `S&P 500 FUTURES` are four keys for one
thing, and `IGA ŚWIĄTEK` / `IGA SWIATEK` are two. The arithmetic below uses 364, which is
the pessimistic and correct figure to design against.

### Calls and tokens per day

- **Calls/day** = 144 fetches × 83.6% that carry at least one new trend = **~120**
- **Trends categorised/day** = 144 × 2.53 = **~364**
- **Input tokens/day** = 120 × 300 (instructions) + 364 × 70 (title + headlines +
  scaffolding) = **~61,500**
- **Output tokens/day** = 364 × 15 + 120 × 10 = **~6,700**

### Money, at `gpt-5-nano` ($0.05 / 1M in, $0.40 / 1M out)

| Scenario | Calls/day | In | Out | **Per day** | **Per year** |
| --- | --- | --- | --- | --- | --- |
| **Designed** (dedupe + batch, headlines) | 120 | 61,500 | 6,700 | **$0.0057** | **$2.10** |
| Title only, no headlines | 120 | 40,400 | 6,700 | $0.0047 | $1.71 |
| Worst case: 10 new every fetch | 144 | 144,000 | 23,000 | $0.0164 | $6.00 |
| No dedupe at all — every row, every fetch | 144 | 144,000 | 23,000 | $0.0164 | $6.00 |

Two conclusions, and the second one matters more than the first.

**The headlines cost about 40 cents a year.** Given they are what makes `CASEY MIZE`
answerable at all, that is not a trade-off, it is a rounding error.

**Deduping saves about four dollars a year, so money is not why we do it.** The real
reasons are:

1. **Determinism.** A model asked the same question twice may answer differently. Storing
   the first answer forever is what stops a badge flickering between `sport` and
   `entertainment` between polls on a display nobody is touching. This is a correctness
   property and nothing else buys it.
2. **Not making 1,440 API calls a day from a Raspberry Pi** to re-derive 364 answers.
3. **Rate limits and latency**, below.

The worst case is a Pi restarted repeatedly, or one coming back after a long outage, where
the whole feed looks new. Even then it is six dollars a year. **There is no scenario in
this design where the money is the problem** — which is worth stating plainly so that the
next decision here is made on quality rather than on an imagined bill.

### AMENDED — reasoning tokens, and the 10x setting the arithmetic above missed

**The table above is right only because of one parameter, and the first draft of this
document never mentioned it.** Measured against the live API on 2026-08-04:

| Configuration | in | out | per call | per year |
| --- | --- | --- | --- | --- |
| ten trends, default effort | 1,101 | **2,222** | $0.000944 | $41 |
| ten trends, `reasoning_effort: low` | 1,101 | 816 | $0.000381 | $17 |
| **ten trends, `reasoning_effort: minimal`** | 1,101 | **176** | $0.000125 | $5.49 |
| **three trends (the real batch), minimal** | 678 | 65 | $0.000060 | **$2.62** |

The GPT-5 family are reasoning models and **reasoning is billed as output**. On defaults,
94% of the bill was the model thinking about a nine-way label whose evidence was already
in the prompt. The projection of ~160 output tokens per call was right for the *answer* and
wrong by 14x for what actually gets billed.

So the design's real cost is **$2.62/year**, close to the original estimate — but only with
`reasoning_effort: minimal` set. Left on defaults it is roughly $20/year for the same
answers, and nothing would have said so.

**It costs no accuracy here.** Same ten live trends, minimal against default: identical on
the seven that have a clear answer, differing only on `apac`, `angel reese` and
`anamaria goltes` — the three the earlier live batch had already flagged as genuinely
ambiguous. `gpt-5-mini/minimal` also settled 10/10 and agreed with nano on eight, for 5x
the price.

### Prompt caching does not apply

OpenAI's automatic prompt cache has a minimum prefix length of 1,024 tokens. The shared
instruction block is ~300. Padding it to reach the threshold would cost more than the
discount returns. Nothing to do here; noted so nobody adds it as an optimisation.

### Rate limits

120 calls a day is **five an hour**. Every paid tier's limit is orders of magnitude above
that. Rate limiting is a failure mode to handle correctly, not a capacity constraint.

## Model choice

**Recommendation: `gpt-5-nano`.** It is the cheapest current model, and this task —
one short label from a ten-value enum, given a title and three headlines — is at the
bottom of the difficulty range. Paying for a larger model buys accuracy on exactly the
cases the headlines already resolve.

**The key in use has access to every model**, verified 2026-08-04, so this is a free
choice rather than a constrained one. At the token volumes above it is not a cheap one:

| Model | Per year | vs nano |
| --- | --- | --- |
| **`gpt-5-nano`** | **$2.10** | 1× |
| `gpt-5.4-nano` | $7.55 | 4× |
| `gpt-5-mini` | $10.50 | 5× |
| `gpt-5.4-mini` | $27.84 | 13× |
| `gpt-5` | $52.51 | 25× |
| `gpt-5.5` | $185.60 | 88× |

The brief opened with cost being the thing that mattered most, and this is the one decision
in the whole design where the number is not noise — $186 a year to put a nine-way label on a
badge is not proportionate to what the badge does.

**But note what a stronger model actually buys here, because it is not what it sounds
like.** It is not intelligence: `apac` does not become less ambiguous with more reasoning,
because it has no correct answer. What it buys is *consistency* at the boundary — the same
call made the same way every time. The precedence order above buys much of that at nano
prices, which is why it was written before reaching for a bigger model.

**Settle it with evidence, not preference.** The same ten live trends run through nano,
mini and one large model, answers side by side, costs a few cents and takes one command —
the check script already takes a `MODEL` override. That comparison should happen before the
model is fixed.

**`gpt-5-nano` is confirmed reachable on this account** — `GET /v1/models` returned 200 with
118 models, `gpt-5-nano` among them, on 2026-08-04. That was a free call and it retires half
of the first bullet below.

Two things still to confirm with one real call before committing, not to assume:

- **Structured Outputs support on this specific model.** The documentation says
  `json_schema` response format is
  supported on "`gpt-4o-mini`, `gpt-4o-2024-08-06`, and later", which `gpt-5-nano` is —
  but the pricing page does not restate it per model, so it gets verified rather than
  inferred. This matters more than it sounds: with a strict schema and a string enum, the
  model **cannot** return a value outside the set. That turns "a fixed closed set" from a
  hope into an API-level guarantee.
- **Ten in one call.** The brief asks whether one call can reliably do ten trends. It
  should — they are independent, the output is indexed, and 700 tokens of input is
  nothing — but the failure mode if it cannot is *misalignment*, where answer 7 is applied
  to trend 8. That is the worst possible bug here because it renders perfectly. **The
  response must echo the trend title back with each category**, and any answer whose echoed
  title does not match the trend it is aligned to is discarded rather than trusted. Cheap
  insurance, and it makes the failure detectable in a log rather than invisible on a wall.

The stored `model` column (below) exists so that when this choice changes, rows decided
under the old one can be found.

## Failure behaviour

**The first rule: a failure never costs the screen its list.** This is the same property
`history?.record()` already has in `server.ts`, and it is implemented the same way.

**Categorisation is not in the response path at all.** `TtlCache.load()` fetches Google,
records history, and returns. Categorisation is kicked off *after* that, holding no one up.
Badges therefore arrive on the *next* 60-second poll rather than the current one, and that
is correct behaviour, not a lag to engineer away — a badge is worth nothing if waiting for
it delays the list.

| Failure | Behaviour |
| --- | --- |
| No key, or disabled | No categoriser is constructed. Nothing is called, nothing is logged per fetch, no badges. |
| Timeout | `AbortSignal.timeout`, same idiom as `weather.ts` and `trends.ts`. Abandon the batch. |
| 429 rate limited | Log once at `warn`, abandon the batch, do not retry inside the request. |
| **429 `insufficient_quota`** | **Stop calling entirely** until restart. See below — this is not a rate limit. |
| 5xx / network | Same as timeout. |
| Partial answer (7 of 10) | **Store the 7.** The other 3 stay uncategorised and are picked up by the next fetch. Never fill a gap with a guess. |
| Value outside the enum | Discard that entry, leave the trend uncategorised. Validated by hand as well as by the schema. |
| Echoed title does not match | Discard that entry and log it. Misalignment is the one failure that renders perfectly. |
| SQLite unavailable | `history` is already `null`-guarded throughout; no store means no categories and no badges. |
| Shutdown mid-flight | Aborted by signal; the trends are still uncategorised and will be retried. |

### The 429 that never recovers — found by testing, 2026-08-04

**An account with no credit answers `429 Too Many Requests`, the same status as a rate
limit, and the two need opposite handling.** The body is what separates them:
`"type": "insufficient_quota"` against a genuine rate limit's `rate_limit_exceeded`.

This was found by running the first real call: the key authenticated fine against
`GET /v1/models` (200, 118 models, `gpt-5-nano` present) and the first billed call came
back `insufficient_quota`.

It matters because the self-healing design below assumes retrying is free and eventually
works. A rate limit clears in seconds. An unfunded account **never** clears, so the Pi
would make 120 futile calls a day forever, and every new trend would burn its three
attempts against a wall. The `attempts` cap protects a single unanswerable trend; it does
nothing about an unanswerable *account*.

**So: `insufficient_quota` trips a circuit breaker that stops all calls until the process
restarts**, and logs one line saying plainly that the OpenAI account needs credit. Not a
timed backoff — this is a condition only a human with a card can clear, and a restart is
exactly what happens after they clear it.

The log line must quote the reason. Left as a bare "429" it reads as rate limiting, and
somebody spends an afternoon tuning a backoff for a problem that is a billing page.

**Everything else self-heals with no queue and no retry schedule**, because "uncategorised" is
already the retry list. A trend that fails today is still in the feed in ten minutes and
gets asked about again. That is worth protecting: it is why no retry machinery is needed.

The one thing it does not handle is a trend that fails *every* time — a Pi burning five
calls an hour on the same unanswerable trend forever. Hence the `attempts` column, and a
cap of **three**, after which the trend is stored `uncategorised` for good.

## Storage

A **new table**, not a column on `trend_snapshots`:

```sql
CREATE TABLE IF NOT EXISTS trend_categories (
  trend_key  TEXT    PRIMARY KEY,
  category   TEXT    NOT NULL,
  model      TEXT    NOT NULL,
  decided_at TEXT    NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 1
);
```

Why a table rather than a column:

- **A category is per trend, not per observation.** `trend_snapshots` has one row per trend
  per fetch — 1,820 rows for 481 trends. A column there would be written on one row and
  read with a "most recent non-null" lookup, which is exactly the awkwardness `news`
  already carries and for a value that genuinely never changes.
- **"Which trends have never been categorised?" becomes one query** against a primary key,
  and that query is the whole cost-control mechanism.
- **`model` and `attempts` have nowhere sensible to live on a snapshot row.**

### On the `#migrate()` pattern

The brief asks to follow it, and the honest answer is that **a new table does not need it**.
`#migrate()` exists because `CREATE TABLE IF NOT EXISTS` silently does nothing to a table
that already exists, so a new *column* never reaches a Pi that has been collecting for
weeks. A new *table* is created correctly by the `SCHEMA` block on the next start, on a
fresh database and a three-week-old one alike.

What does carry over is the discipline: check before acting, throw `SchemaMigrationError`
rather than a bare error so the log can tell "the schema would not upgrade" from "the disk
will not take a write", and report what was applied so the one line that proves an upgrade
reached the database still gets printed.

One real snag to flag: `#migrate()`'s `additions` list is hardcoded to `trend_snapshots`.
The day `trend_categories` gains a column, that function needs a table parameter. Better to
know now than to discover it by adding a column that silently never arrives.

**Nothing is back-filled.** Trends already in the record when this ships stay
uncategorised: they are gone from the feed, their headlines may be missing, and paying to
categorise 481 historical trends nobody will look at again is the one place in this design
where money could actually be wasted. `TODAY` will therefore show badges on the trends that
started after the feature landed and blanks above them, for one day.

## Configuration and the key

`config.ts` gains a `categories` block in the existing idiom, plus a `bool` helper beside
`num` and `str`:

```
OPENAI_API_KEY            (no default — its absence is the off switch)
TRENDS_CATEGORY_MODEL     gpt-5-nano
TRENDS_CATEGORY_ENABLED   true
TRENDS_CATEGORY_TIMEOUT_MS 10000
```

**The feature is on if and only if a key is present**, with `TRENDS_CATEGORY_ENABLED` as an
explicit off switch for keeping the key but stopping the calls. That makes "works with no
key" the default path rather than a branch someone has to remember to test.

The key never leaves the API process. The browser receives category strings and nothing
else, and no route accepts text to categorise — there is no proxy endpoint, deliberately.

### A verified gap that has to be fixed first

**`.env` does not currently reach the API process.** Nothing loads it: there is no `dotenv`
dependency, and `config.ts` reads `process.env` directly. Vite loads the root `.env` for
itself via `loadEnv`, and `pi-start.sh` greps it with `sed` for `WEB_PORT`, but the Fastify
process only ever sees what the shell exported. Every API setting has been running on its
default.

So adding `OPENAI_API_KEY` to `.env` today would **silently do nothing**, which is the worst
possible failure for a secret — it looks configured and is not.

The fix costs one flag and no dependency, since the repo already requires Node 24:

```
dev:   tsx watch --env-file-if-exists=../../.env src/server.ts
start: node --env-file-if-exists=.env dist/server.js
```

`--env-file-if-exists` rather than `--env-file` so a machine without a `.env` still starts.

## The Pi deploy

Whatever is decided about where the key lives, three things change on the Pi:

1. **The key has to get onto it.** With the recommended approach that is a `.env` file
   written once. `pi-setup.sh` should prompt for it and write it if absent, and say plainly
   when it is skipped — a Pi silently running without badges because a file is missing is
   the exact failure mode this project keeps rediscovering.
2. **`npm run build` is still the whole upgrade.** No dependency is added; the OpenAI call
   is `fetch` against a documented JSON endpoint, in keeping with the hand-rolled RSS parser
   and payload validation.
3. **The database gains a table on first start**, in place, alongside the existing history.
   Upgrading still cannot lose history — `apps/api/data/` is gitignored, `pi-start.sh` never
   touches the database, and `pi-setup.sh` only deletes it behind `--seed` *and* `--force`.

If the repo goes private, add a fourth: **`git pull` on the Pi needs credentials.** See
Question 1.

## What this deliberately does not do

- **No third page, no new view, no new route.** The badge appears on rows that already
  exist. The two-page carousel is untouched and attract mode's tour needs no change.
- **No layout changes.** Both lists keep their band heights, their row counts and their
  grids. The badge fits in existing space or it does not ship.
- **No re-categorisation, ever.** Not on a model change, not on a category-set change, not
  on a title rewording. If the set changes, old rows keep their old value and the `model`
  column is how you find them.
- **No back-fill of the existing 481 trends.**
- **No confidence score on screen.** A number next to a badge invites reading it as
  precision the model does not have.
- **No summarising, ever.** Headlines go *to* the model. Nothing the model writes comes back
  to the screen except one enum value — it never produces prose, and the existing rule that
  headlines are quoted verbatim with attribution is untouched.
- **No categorising of anything but trends.** Not the weather, not the headlines
  individually.
- **No local keyword fallback.** A rule-based guess when the API is down would produce a
  *different, worse* badge that looks identical to a real one. Blank is honest; a fallback
  is not.

## Open questions

Eight. Each has a recommendation. The first three change what gets built.

### 1. The API key in the repo — **ANSWERED: no. It lives in `.env`, written by setup**

**Settled 2026-08-04, and built — this is the only part of this plan that exists.** The key
goes in `.env` on each machine, `pi-setup.sh` prompts for it on the Pi, and the repo stays
free of it. The user also confirmed the Pi workflow stays `git pull`, with no SSH.

What landed:

- **`.env` now reaches the API.** `--env-file-if-exists=../../.env` on both the `dev` and
  `start` scripts in `apps/api/package.json`. Verified end to end: with `PORT=3999` and
  `WEATHER_LOCATION_NAME=EnvFileProof` in `.env`, the built server bound 3999 and
  `/api/health` reported `EnvFileProof`. Before this it bound 3000 and said San Jose,
  because nothing read the file.
- **`pi-setup.sh` asks for the key** in the same idiom it already uses for the Node install.
  Skipping is a supported answer. Verified against seven cases through a real pty: no
  terminal at all, an empty `OPENAI_API_KEY=` line, a key already present, awkward
  characters (`/ + _ - =`) round-tripping verbatim, running it twice leaving exactly one
  assignment, empty input skipping, and a malformed key warning but storing. The key is
  read with `read -rs` and never appears on screen — a Pi is usually a screen in a room —
  and `.env` is `chmod 600`.
- **`.env.example` documents the key** and records that the file used to reach Vite only.

One shell trap worth keeping: **`[ -r /dev/tty ]` is not a test for having a terminal.** The
node exists and passes `-r` with no controlling terminal, and the open then fails — which
printed a prompt nobody could answer, then an error, before falling through. Opening it in
a subshell is the only honest check.

The original reasoning, kept because it is why the answer went this way:

The brief said to commit the key and make the repo private to compensate. Two problems:

- **Git history is permanent.** A key committed once is in every clone, every backup and
  every fork forever; removing it later means rewriting every commit and force-pushing. If
  the repo is ever flipped back to public — or a single collaborator is added, or a CI
  service is authorised — the key is already out.
- **The benefit is one line, once.** `.env` is already gitignored, `config.ts` already reads
  the environment, and the only actual cost of keeping the key out of git is writing one
  file on the Pi — which `pi-setup.sh` can prompt for. That is the entire saving being
  bought.

**Making the repo private is a good idea on its own merits** and worth doing regardless: it
also retires the awkwardness recorded in the decisions table about third-party artwork
sitting in a public repo. But private is defence in depth, not a secret store.

**Recommended: repo goes private, key stays in `.env`.** Then the Pi needs read access to a
private remote, and the right mechanism is a **deploy key** — SSH, read-only, scoped to this
one repository, revocable from the Pi without touching anything else. A personal access
token would put credentials for the whole GitHub account on a device hanging on a wall.

**Still open under this heading: whether the repo goes private.** It was recommended on its
own merits and has not been decided. It is now independent of the key — nothing about the
build depends on it — but if it does go private, the Pi needs read access to a private
remote, and the right mechanism is a **deploy key**: SSH, read-only, scoped to this one
repository, revocable from the Pi without touching anything else. A personal access token
would put credentials for the whole GitHub account on a device hanging on a wall.

### 2. Are the headlines sent? — **recommend: yes**

Measured cost over title-only: **~40¢/year**. Measured benefit: 72.8% of titles are three
words or fewer and the unmatched half is mostly bare personal names that no model reliably
places. Coverage is 99.3%.

The counter-argument is real but small: it means our request to OpenAI contains other
people's headlines. They are public news headlines from a public feed, and nothing comes
back but an enum value.

### 3. `weather` or `disaster`? — **recommend: one category, called `weather`**

The brief's example says "one disaster". The data has both kinds and they do not separate
cleanly: `atlanta weather` and `phoenix weather` are routine lookups, while `oregon fires`,
`flash flood warning`, `dust storm` and `earthquake` are events. Splitting them creates a
boundary the model has to judge on every call — *is an air quality warning weather or
disaster?* — and boundaries are where a small model is inconsistent.

Recommend one category covering both, named `weather`. It sits oddly next to a dashboard
whose other page is the weather, which is worth knowing before choosing. The alternative —
`disaster` covering fires/floods/quakes/outbreaks, with routine weather lookups falling to
`uncategorised` — is defensible and would match the brief's wording more literally.

### 4. Colour: one token, or a coarse grouping? — **recommend: one token**

Measured above: two of the six themes offer three separable fills and `dmg-green` renders
`blue` and `hot` identically. Eight colours is not available.

Recommended: every badge in one token, shape carries the category. The alternative is
colour encoding a **three-way grouping** that survives every theme, with the glyph
distinguishing within it — but every grouping proposed so far is an editorial claim
(*is sport a diversion?*) and this dashboard has been careful not to make those.

### 5. Which token? — **recommend: `--c-blue`**

`blue` is already the app's voice for everything it says about itself: the qualifiers
(`APPROX`, `PEAK`, `ON FEED`), the rank numbers, the axis labels, the band headings. A
badge in `blue` joins that voice.

`hot` is the alternative and is what `NEW` uses. It is louder, which suits a badge meant to
be read across a room — but `hot` measures 2.3:1 against the background on `gba-blue` and is
identical to `blue` on `dmg-green`, so it is the weaker choice on exactly the themes that
are already hardest.

### 6. Notched plate or dithered fill? — **recommend: render both, then decide**

This is a look, and this project has been wrong about looks in a render and right after
measuring — the trend card's blend mode took three options across five themes before the
correct one was obvious. **Nothing is committed until both are on screen at 720 × 720 in at
least `gba-blue`, `midnight`, `dmg-green` and `millennium`.**

### 7. Is `uncategorised` truly blank, or a mark? — **recommend: blank**

A trend with no category gets no badge. It costs no space, asserts nothing, and matches how
every other unstated field on this screen already behaves — a missing volume is absent, not
a dash.

The counter-argument: blank is ambiguous between "the model said it could not tell" and
"this trend has not been looked at yet", and those are different facts. If that distinction
matters on the panel it needs a mark, which costs 16px on every unlabelled row. Recommend
not paying it — the distinction is visible in the database, which is where it belongs.

### 9. Glyph or three-letter abbreviation? — **ANSWERED: both, behind a setting**

**Settled 2026-08-04, and built.** The render was supposed to pick a winner and instead made
the case for shipping both: `BADGES · TEXT / GLYPH` in settings, remembered, with `TEXT` as
the default so a freshly-started panel is readable before anyone has opened the legend.

That is only affordable because of the **legend** the user asked for in the same breath.
"You have to learn the icons" was the whole argument against glyphs, and a legend is the
answer to it — the two arrived together and depend on each other.

Two things the render decided on its own:

- **The glyph is drawn plain, not knocked out of a plate.** At 16px inside a 20px plate the
  silhouette touches the edges and the eye reads the plate: `sport` and `tech` both came out
  as plain squares, and both had to be hollowed into rings before they read at all.
- **Drawn plain it needed `--c-sky` on a selected row.** `--c-blue` vanishes into an inked
  row — the same reason `.age` already switches token there.

**The notched plate survives on the text badge**, where it is doing its job: two corners cut
in a single axis-aligned step, no antialiasing, and it reads as a different kind of object
in `gba-blue`, `midnight` and `millennium` alike without spending a colour the monochrome
themes do not have.

### The legend, and what it caught immediately

A dialog listing all eleven categories with **both** marks and a plain-English meaning,
opened from settings. It deliberately reuses SettingsModal's exact class skeleton —
`.panel`, `.head`, `.heading`, `.close`, `.body` — because `millennium.css` styles dialogs
by reaching into those names from outside. Matching them means the gold frame, winged eye
and Cinzel heading apply with **no new theme CSS at all**. Verified on screen.

It replaces the settings dialog rather than stacking: two dialogs on a 720px panel leave the
lower one as a rim of frame, which reads as a rendering fault. `legendOpen` also joins the
`attract.suspend` condition, so the tour cannot resume underneath it.

**It paid for itself on first render.** `ai` was drawn as the conventional four-pointed
sparkle — which at 8 x 8 is a cross with four dots, and `health` is a cross. Side by side in
the legend they were the same mark. Invisible while drawing glyphs one at a time, obvious in
a column. `ai` is now a node cluster, which has no straight arms and so cannot collide with
the cross, the chip or the ball.

**Still to look at:** `obituary` is the weakest glyph in the set — a candle at 8 x 8 is close
to a plain block — and `tech`, `weather` and `crime` are all horizontal masses at this size.

### 9b. The original framing, kept

Raised by the user 2026-08-04, proposing truncated text on the row with the full badge in
the detail view. **The architecture is right and is already the plan** — short on the row,
spelled out on the full-screen surfaces. The open part is only what the short form is.

| | costs | `TODAY` fit | Legible across a room? | Needs learning? |
| --- | --- | --- | --- | --- |
| 16px glyph | 24px | 79.6% | yes — shape reads at distance | yes, once |
| `ENT` | 53px | 71.1% | no — 13px letters do not | no |

The glyph wins on both space and distance; the abbreviation wins on being self-evident, and
that is a real advantage this document should not wave away. The detail view is what
teaches a glyph set, which is why it is worth having either way.

Not a decision to argue about in prose — it is the exact question C0's render exists to
settle.

### 8. Does the badge go on the trend card and the trend record? — **recommend: yes, in words**

Both are full-screen surfaces with room, and the word is what makes the glyph learnable —
without it the icon set has no legend anywhere in the app. It also costs nothing: no
measurement is at risk on either surface.

Worth confirming rather than assuming, because it is scope: it means touching
`TrendCard.svelte` and `DayTrendModal.svelte`, not just the two row components.

## Phases, once the questions are answered

Small, and in this order for a reason — the two that can kill the design come first.

| | | Why here |
| --- | --- | --- |
| **C0** | Draw the badge, render both treatments at 720 × 720 across four themes, get a decision | The design gate. No API key needed, no cost, and it is the part most likely to fail |
| ~~**C1**~~ | ~~`.env` reaches the API, `pi-setup.sh` prompts for the key~~ **Done 2026-08-04** | Nothing else could be tested until a key could actually arrive |
| **C1b** | The `categories` config block and the `bool` helper | Deliberately deferred to C2: config nothing reads is dead code, and the model default is still an open question |
| **C2** | `categorise.ts`: one call, strict schema, echo check, hand validation. Verified against ten real trends | Confirms `gpt-5-nano` and ten-per-call before anything is stored |
| **C3** | `trend_categories` table, store and read, uncategorised query, `attempts` cap | |
| **C4** | Wire into `server.ts` after the cache load, all failure paths, key absent verified | |
| **C5** | Contract fields, both row components, both full-screen surfaces | |
| **C6** | Verify all three layouts × the theme pairs that break each other; `npm run typecheck` | The standing rule |

**C0 and C2 are both gates**, and either can send this back to the drawing board without
anything having been built on top of it.
