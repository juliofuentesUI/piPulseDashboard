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
| `corner-tl/tr/bl/br.png` | The panel's four corners, on one pseudo-element |
| `divider-eye.png` | Stretched across the rule under every band heading |
| `plaque-blank.png` | 9-sliced: the rank cartouches, and the `UNITED STATES` tablet |
| `panel-wide.png` | 9-sliced: the settings dialog's frame |

Swapping any of them is a one-line change in `apps/web/src/styles/millennium.css` — every
file below is prepared the same way and will drop straight in.

### Two things worth knowing before adding more

**A 9-slice is how a fixed-size painting fits a box it was never drawn for.** The corners
are drawn at their own scale and only the edges and centre stretch, so one 836 × 184
plaque fits a 44px rank cartouche *and* a 560px dialog without the bevel thinning on
either. `fill` keeps the painted face rather than only its border. This is why source
resolution does not matter here.

**It needs a border thick enough to hold the bevel, so it needs a fixed box.** The
ordering chips were the obvious candidate and had to be turned down: `.mode` is a 2px
border on a content-sized chip, and taking the active one to 10px makes it wider and
taller than the inactive one, so the pair jumps every time the ordering changes.

## Available, not currently used

| File | What |
| --- | --- |
| `obelisk.png` | Blue creature, square |
| `slifer.png` | Red creature, landscape |
| `exodia.png` | Gold creature, wide panorama — the only 2.5:1 piece |
| `puzzle-medallion.png` | Millennium Puzzle on a carved medallion |
| `puzzle-tile.png` | Millennium Puzzle on a plain stone tile |
| `puzzle-mark.png` | Millennium Puzzle alone, transparent — the one usable as an icon |
| `banner-hieroglyph.png` | Wide hieroglyph banner with a winged eye |
| `panel-tall.png` | Framed hieroglyph panel, blue field, deeper |
| `corners.png` | The unsliced source sheet for the four corner files |

`corners.png` is kept as the source of the four `corner-*.png` files. Re-cut them with:

```sh
node scripts/theme-art.mjs apps/web/public/themes/millennium/corners.png \
  apps/web/public/themes/millennium/corner-tl.png \
  --cell=0,0,2,2 --height=110 --keep-frame --no-key
```

`--cell=col,row,cols,rows` takes one tile from a sheet; the other three are `1,0`, `0,1`
and `1,1`.

## Where the originals are

Not in the repo. What is here is derived: cropped, keyed, and downsampled to at most
480 px on the long edge, which is already larger than anything the 720 px panel draws.
Keep the originals if you want to re-derive at a different size; nothing in the build
needs them.
