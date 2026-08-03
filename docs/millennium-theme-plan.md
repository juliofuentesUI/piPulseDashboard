# Millennium theme — Plan

An intermediary phase, added 2026-08-03 at the user's request, between Search Pulse
Phase 3.5 (done) and Phase 4 (deferred until the Pi has accumulated history). It is not a
Search Pulse phase and the Search Pulse guardrails in `CLAUDE.md` do not bear on it — it
adds no data, no source and no claim. It changes how the panel looks and nothing about
what it says.

## Status

| Step | What | State |
| --- | --- | --- |
| M1 | `--line` token: structural rules split from `ink` | **Done** |
| M2 | Cinzel bundled, `--font-display` added | **Done** |
| M3 | `millennium` palette in `THEMES` | **Done** |
| M4 | `styles/millennium.css` — gold, stone, plaques, cartouches | **Done** |
| M5 | Verified at 720×720 across all three layouts + the trend card | **Done** |
| M6 | Verified the other five themes are unchanged | **Done** |
| M7 | Character art dropped into `public/themes/millennium/` | **Waiting on the two files** |

## Objective

A sixth theme, gold leaf over carved stone, inspired by the Duel Monsters reference the
user supplied — **inspired by, not a reproduction of it.** The reference merges the two
weather layouts onto one screen and invents margin for character art. This does neither.

**The layouts do not change.** Settled with the user before any code: `WEATHER NOW`,
`7-DAY FORECAST` and Search Pulse keep their bands, their band heights and their grids,
and the screen picker keeps meaning what it meant. This is a surface treatment over the
three fixed 720×720 compositions, which is exactly why it can be as heavy-handed as it is
without putting any of them at risk.

**It is allowed to break the design rules, and it is the only thing that may.** The
README's "flat by design — no gradients, shadows, rounded corners" and "original pixel art
only" are intact for the other five themes and for the app's structure. This one is the
stated exception, on the user's explicit call.

## What the theme system had to grow

The five original themes are pure data — an object in `THEMES`, no CSS of their own —
because a flat design only ever needed to be told which flat colours to use. Metal is not
a colour. It is a gradient, a bevel and a highlight that knows which way is up, and none of
that fits in a palette entry. Two changes made it expressible:

### `--line`, so a gold frame is sayable at all

`ink` carried two jobs that had only ever agreed by coincidence — *the colour of a
structural rule* and *the colour of primary text*. Measured before touching anything:
59 uses of `var(--c-ink)`, split 27 borders / 22 text / 9 fills. No assignment of a single
token covers a theme with gold framing and parchment numerals.

`app.css` now defines `--line: var(--c-ink)`, and the 25 `solid var(--c-ink)` border
declarations across 14 components became `solid var(--line)`. **The five flat themes render
byte-identically**, because `--line` resolves to exactly what those declarations already
said. Verified in the browser against `gba-blue` and `midnight`, not just reasoned about.

The two remaining `var(--c-ink)` borders were left alone on purpose: the active page dot
and the active ordering chip are *fills* that happen to set a border colour to match, not
structural rules.

### A theme stylesheet, keyed off `[data-theme]`

`styles/millennium.css`, imported once in `main.ts`. Every selector is prefixed
`html[data-theme='millennium']`, worth 0-1-1, so a rule there outranks the component's own
scoped rule (Svelte compiles `.column` to `.column.svelte-hash`, 0-2-0, against our 0-2-1)
with no `!important` and **no component edited for this theme**.

The cost is stated in the file's own header and repeated here because it is the thing most
likely to bite later: **that sheet reaches into other components' private class names, so
those names are now part of this theme's contract.** Renaming `.column` in
`ForecastColumn.svelte` breaks neither the build nor the other five themes — it silently
drops the gold off one band here. The alternative, theme-specific rules scattered through
twenty components, is worse to write, worse to read and far worse to delete.

Class names collide across components — `.row` is a title bar, a trend and a table row;
`.title` is a heading and a search term — so selectors lean on the element type
(`h1.title`, `li.row`, `tr.row`). Getting that wrong is the likeliest way to break the file.

## The palette

```
bg      #150f0a   deep carved stone
surface #cdc3b0   cloud body — sprites only
ink     #f4e6c4   parchment: numerals, headings, primary text
blue    #b9975b   bronze: secondary labels
sky     #c9963f   amber-bronze: bars, plots, the card duotone
warm    #f7d777   bright gold: sun and moon bodies
hot     #e3a71c   deep gold: rays, outlines, figures, alerts
```

Two of these are load-bearing in ways worth recording:

**`surface` is free.** It is the cloud body and nothing else — the only `var(--c-surface)`
outside the sprite module *is* the sprite module — so it can be an overcast grey while
every other token is metal.

**`sky` must keep real chroma.** It fills the trend bar, strokes the rank plot, and is the
overlay the trend card's photo is duotoned through. That `color` blend hands back the
overlay's own `max − min` RGB spread, so a near-neutral here renders the card greyscale.
This is the trap `midnight` already documented; `#c9963f` has a spread of 138 and produces
the sepia the card now shows.

## Design decisions

| Decision | Why |
| --- | --- |
| Layouts untouched; surface treatment only | User's call. Keeps three fixed compositions out of the blast radius |
| Cinzel for band headings only | Inscriptional Roman capitals is the reference's letterform. Data stays monospace so columns stay aligned |
| Headings use gradient-clipped gold; sub-headings flat gold | At 20px the gradient's midtone lands inside the stroke and reads as a smudge. Gradients need glyphs big enough to hold them |
| `--title-size × 0.82` under this theme | Cinzel sets wider than the monospace it replaces. `7-DAY FORECAST` overran its band outright |
| `filter: drop-shadow`, not `text-shadow` | `background-clip: text` forces `color: transparent`, which kills a text shadow. The filter also follows the letterforms rather than their box |
| Selected trend row *lights up* rather than inverting | Inverting onto parchment bleaches the brightest thing on the panel. Same signal, opposite mechanism |
| Rain and wind stay blue inside sprites | `blue`/`sky` are bronze labels on the panel and weather inside a sprite. Redefining the properties on the icon container re-resolves them for that subtree only |
| The umbrella is knocked back to stone grey | It is the only sprite drawn in `ink`; at full parchment it outshouted the temperatures two bands above it |
| The scrim is overridden to the void colour | It dims with `ink`, which is parchment here — unoverridden it washes the dashboard out in cream instead of dimming it |
| Plaques are a veil (0.88), not a solid | So the character art behind the page reads through the stonework |
| Character art is a page *background*, not an element | No free space on a 720×720 display to put a foreground cut-out without covering something. As a background it sits above the stone and below every band with no `z-index` invented for it |

## The character art — M7

Two optional PNGs, documented in `apps/web/public/themes/millennium/README.md`:

| File | Where |
| --- | --- |
| `weather-figure.png` | Behind the weather page, bled off the bottom-left |
| `pulse-figure.png` | Behind Search Pulse, bled off the bottom-right |

**The theme is complete and correct without them.** A `url()` that 404s paints nothing, so
an absent file costs one request and shows no error — verified by rendering the theme both
with placeholder figures and with the directory empty. Nothing about this theme waits on
an asset.

Single figures on transparency, roughly 2:3, cropped to stand on the bottom of their own
canvas. Not full scenes: a busy rectangle behind five trend rows is noise where one
silhouette is depth. One number tunes how strongly they show — the alpha in the two
`rgba(21, 15, 10, 0.84)` washes — and it should be judged against Search Pulse, which has
the most text over the art.

The user chose to commit these rather than gitignore them, having been told they are
third-party character art in a repo that gets pushed.

## Acceptance criteria

- [x] A sixth entry in the settings theme list, with a working swatch, remembered in
      `localStorage` like the other five
- [x] All three layouts render correctly at exactly 720 × 720 — checked in the browser,
      not by reading CSS
- [x] The trend card renders, and its photo duotones to amber rather than to grey
- [x] The settings panel, its scrim and its option list are themed
- [x] `gba-blue` and `midnight` render exactly as before the `--line` change
- [x] `npm run typecheck` clean across both workspaces
- [ ] Character art present and judged at 720 × 720 — **waiting on M7**

## Out of scope

Deliberately not done, and not to be added without being asked:

- Merging the two weather layouts, as the reference does. The user kept them separate
- A raster frame or 9-slice border. The frame is a `border-image` gradient: no asset, no
  request, and exact at any scale the panel is transformed to
- A hieroglyph bitmap for the stone. It is three CSS gradients, resolution-independent on
  a panel scaled by a transform
- Animation. The theme is as static as the five before it, which is what keeps the Pi idle
- Theming the Raspberry Pi wordmark's sprite beyond the palette it already follows
