# Millennium theme art

Fourteen pieces, supplied as framed gallery tiles at ~1250 px and ~2.4 MB each and
prepared for the panel with `scripts/theme-art.mjs`. That script is the only way art
should enter this directory — it crops the painted frame off, keys the near-black backdrop
to transparency, trims the canvas to what is actually opaque, and downsamples. The set
went from **34 MB to 7.7 MB** through it, which is the difference between a reasonable
kiosk asset folder and an unreasonable one.

```sh
# A painted tile on black — crop the frame, key the backdrop.
node scripts/theme-art.mjs source.png apps/web/public/themes/millennium/name.png --height=480

# An already-transparent UI piece — trim and resize only.
node scripts/theme-art.mjs source.png apps/web/public/themes/millennium/name.png \
  --height=280 --keep-frame --no-key
```

Use `--keep-frame --no-key` for anything that already has an alpha channel. Running the
black key over a hieroglyph panel eats the deep blue field that is the point of it, and
there is no frame to find around something that *is* a frame.

## In use

| File | Where |
| --- | --- |
| `yugi.png` | Title band of both weather layouts, behind the heading |
| `kaiba.png` | Title band of Search Pulse, behind the heading |

Swapping either is a one-line change in `apps/web/src/styles/millennium.css` — every file
below is prepared the same way and will drop straight in.

## Available, not currently used

| File | What |
| --- | --- |
| `obelisk.png` | Blue creature, square |
| `slifer.png` | Red creature, landscape |
| `exodia.png` | Gold creature, wide panorama — the only 2.5:1 piece |
| `puzzle-medallion.png` | Millennium Puzzle on a carved medallion |
| `puzzle-tile.png` | Millennium Puzzle on a plain stone tile |
| `puzzle-mark.png` | Millennium Puzzle alone, transparent — the one usable as an icon |
| `corners.png` | Four corner ornaments on one sheet; needs slicing to use |
| `banner-hieroglyph.png` | Wide hieroglyph banner with a winged eye |
| `divider-eye.png` | Slim divider bar with a winged eye |
| `plaque-blank.png` | Blank gold plaque |
| `panel-wide.png` | Framed hieroglyph panel, blue field |
| `panel-tall.png` | Framed hieroglyph panel, blue field, deeper |

**These are deliberately unused rather than forgotten.** The panel is a 720 × 720
information display whose every band is already a plaque with data on it, and each of
these would have to displace something to appear. The two that are in use went into the
one place with genuine slack. Adding more means deciding what leaves the screen — a real
design call, not a matter of dropping in a file.

Two notes if you do reach for them:

- `corners.png` is a **sheet of four**, not a single ornament. It needs slicing into
  quadrants before anything can use one corner.
- The panel's own corners are occupied on every layout — the date and clock at the top,
  the metric icons at the bottom — so corner ornaments have nowhere to sit without
  covering a reading.

## Where the originals are

Not in the repo. What is here is derived: cropped, keyed, and downsampled to at most
480 px on the long edge, which is already larger than anything the 720 px panel draws.
Keep the originals if you want to re-derive at a different size; nothing in the build
needs them.
