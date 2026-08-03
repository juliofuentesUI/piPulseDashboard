#!/usr/bin/env node
/**
 * Prepares supplied artwork for the `millennium` theme.
 *
 * The source files are framed gallery tiles: a square of art, a painted gold
 * frame, and a black margin around it, at ~1250px and ~2.4 MB each. The theme
 * needs the opposite of all three — a loose figure, no frame, transparent
 * around it, and small enough that a Raspberry Pi loading it over a kiosk boot
 * does not notice. This does that conversion, and records how, so the next
 * batch of art can be run through the same door.
 *
 *   node scripts/theme-art.mjs <source.png> <dest.png> [--height=620] [--keep-frame]
 *
 * Three passes:
 *
 * 1. **Uncrop the frame.** The gold frame is the brightest thing at the edges,
 *    so the first row and column carrying real brightness locates it, and the
 *    crop steps past it by the frame's own measured thickness. Fixed insets
 *    were tried first and do not survive art whose frame sits at a different
 *    inset, which is half of this set.
 *
 * 2. **Key the black to transparency.** These tiles are painted on near-black
 *    (measured corner luma 0-4), and the theme's panel is near-black stone, so
 *    a hard cut is not needed — a luminance ramp turns the backdrop to nothing
 *    and leaves the lit figure, with the mid-tones fading rather than tearing a
 *    hard edge around the subject.
 *
 * 3. **Box-downsample.** A full box filter, not nearest neighbour: this is
 *    painted art, not the pixel sprites, and the sprites' whole-pixel rule is
 *    about the hand-drawn SVG grid rather than about photographs of paintings.
 *
 * No dependency. Node has zlib and PNG is a simple enough container that
 * pulling in an image library for a script run a handful of times would cost
 * more than it saves — the same reasoning that keeps `node:sqlite` in and a
 * native module out.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Decodes a non-interlaced 8-bit RGB/RGBA PNG to flat RGBA bytes. */
function decode(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  let colourType = 0;
  const parts = [];

  for (let i = 8; i < buffer.length; ) {
    const length = buffer.readUInt32BE(i);
    const tag = buffer.toString('ascii', i + 4, i + 8);
    const body = buffer.subarray(i + 8, i + 8 + length);

    if (tag === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colourType = body[9];
      if (body[8] !== 8) throw new Error(`bit depth ${body[8]} unsupported`);
      if (body[12] !== 0) throw new Error('interlaced PNG unsupported');
    } else if (tag === 'IDAT') {
      parts.push(body);
    }

    i += 12 + length;
  }

  if (colourType !== 2 && colourType !== 6) {
    throw new Error(`colour type ${colourType} unsupported (need RGB or RGBA)`);
  }

  const channels = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);

  let previous = Buffer.alloc(stride);
  let read = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[read];
    read += 1;
    const line = Buffer.from(raw.subarray(read, read + stride));
    read += stride;

    // Undo the per-row filter. Byte-at-a-time on purpose: the Paeth and Average
    // predictors read bytes this same pass has already reconstructed.
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;

      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[x] = (line[x] + pr) & 255;
      }
    }

    for (let x = 0; x < width; x += 1) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = channels === 4 ? line[s + 3] : 255;
    }

    previous = line;
  }

  return { width, height, pixels: out };
}

/** Encodes flat RGBA to a PNG, filtering each row with Up (2). */
function encode({ width, height, pixels }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1);
    raw[at] = 2;
    for (let x = 0; x < stride; x += 1) {
      const here = pixels[y * stride + x];
      const above = y === 0 ? 0 : pixels[(y - 1) * stride + x];
      raw[at + 1 + x] = (here - above) & 255;
    }
  }

  const chunk = (tag, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(tag, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    PNG_MAGIC,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let CRC_TABLE = null;

function crc32(buffer) {
  if (CRC_TABLE === null) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }

  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Finds the art inside the painted frame.
 *
 * Walks in from each edge for the first line bright enough to be the gold, then
 * keeps walking until the brightness falls away again — that run *is* the frame,
 * so its own width is exactly how far past it the crop has to step.
 */
function frameInset({ width, height, pixels }, edge) {
  const horizontal = edge === 'left' || edge === 'right';
  const span = horizontal ? width : height;
  const across = horizontal ? height : width;

  const brightnessAt = (i) => {
    let peak = 0;
    for (let j = 0; j < across; j += 7) {
      const [x, y] = horizontal ? [i, j] : [j, i];
      const p = (y * width + x) * 4;
      if (pixels[p + 3] < 128) continue;
      peak = Math.max(peak, luma(pixels[p], pixels[p + 1], pixels[p + 2]));
    }
    return peak;
  };

  const forward = edge === 'left' || edge === 'top';
  let i = 0;

  // Past the black margin, to the frame. Generous: the margin is plain black.
  const margin = Math.floor(span * 0.15);
  while (i < margin && brightnessAt(forward ? i : span - 1 - i) < 90) i += 1;

  /*
   * Past the frame, to the art — and this one is capped hard at 4% of the span.
   * Uncapped it does not stop at the frame at all: subjects touch their frames
   * (Yugi's spikes reach it on three sides), so "still bright" stays true and
   * the walk carries on into the painting. The first run of this ate 313px a
   * side and returned a portrait cropped to one eye. A painted frame is thin;
   * the cap encodes that, and anything the cap leaves behind `trim` removes.
   */
  const frame = i + Math.ceil(span * 0.04);
  while (i < frame && brightnessAt(forward ? i : span - 1 - i) >= 90) i += 1;

  return i;
}

function crop(image, insets) {
  const width = image.width - insets.left - insets.right;
  const height = image.height - insets.top - insets.bottom;
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const from = ((y + insets.top) * image.width + insets.left) * 4;
    image.pixels.copy(pixels, y * width * 4, from, from + width * 4);
  }

  return { width, height, pixels };
}

/**
 * Turns the near-black backdrop into transparency on a ramp.
 *
 * A hard threshold cuts a jagged edge around hair and highlights; ramping alpha
 * across a luminance band lets the backdrop fall away while the subject's own
 * dark edges stay attached to it.
 */
function keyBlack(image, low, high) {
  const { pixels } = image;

  for (let p = 0; p < pixels.length; p += 4) {
    if (pixels[p + 3] === 0) continue;
    const l = luma(pixels[p], pixels[p + 1], pixels[p + 2]);
    const t = Math.min(1, Math.max(0, (l - low) / (high - low)));
    pixels[p + 3] = Math.round(pixels[p + 3] * t);

    /*
     * Flatten the colour under anything fully transparent. It is invisible
     * either way, but leaving the original noise there costs real bytes: the
     * backdrop is most of the canvas, and deflate can only collapse it into a
     * run once every byte in it agrees. Worth ~40% of the file.
     */
    if (pixels[p + 3] === 0) {
      pixels[p] = 0;
      pixels[p + 1] = 0;
      pixels[p + 2] = 0;
    }
  }

  return image;
}

/** Box-filter downsample, averaging in straight alpha. */
function resize(image, targetHeight) {
  const scale = targetHeight / image.height;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = targetHeight;
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor((y * image.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / height));

    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor((x * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / width));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;

      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const p = (sy * image.width + sx) * 4;
          r += image.pixels[p];
          g += image.pixels[p + 1];
          b += image.pixels[p + 2];
          a += image.pixels[p + 3];
          n += 1;
        }
      }

      const d = (y * width + x) * 4;
      pixels[d] = Math.round(r / n);
      pixels[d + 1] = Math.round(g / n);
      pixels[d + 2] = Math.round(b / n);
      pixels[d + 3] = Math.round(a / n);
    }
  }

  return { width, height, pixels };
}

/** Tightens the canvas to what is actually opaque, so nothing is padding. */
function trim(image) {
  const { width, height, pixels } = image;
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] < 8) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  if (bottom < 0) return image;

  return crop(image, {
    top,
    left,
    right: width - 1 - right,
    bottom: height - 1 - bottom,
  });
}

const [source, dest, ...flags] = process.argv.slice(2);

if (source === undefined || dest === undefined) {
  console.error('usage: theme-art.mjs <source.png> <dest.png> [--height=620] [--keep-frame]');
  process.exit(1);
}

const height = Number(flags.find((f) => f.startsWith('--height='))?.slice(9) ?? 620);
const keepFrame = flags.includes('--keep-frame');

/*
 * The supplied art arrives in two kinds and they need opposite handling.
 *
 * The painted tiles are opaque RGB on near-black, and want both passes: find
 * the frame, then key the backdrop away.
 *
 * The UI pieces — corners, banners, plaques — already carry real alpha (74-92%
 * of their canvas is fully transparent) and are themselves frames. Running
 * either pass over one is destructive: there is no frame to find around a
 * frame, and the black key would eat the deep blue field that is the whole
 * point of a hieroglyph panel. `--keep-frame --no-key` is how those come
 * through, trimmed and resized only.
 */
const noKey = flags.includes('--no-key');

/*
 * `--cell=col,row,cols,rows` takes one tile out of a sheet before anything else
 * runs. The corner ornaments arrive as a 2x2 sheet and each corner has to
 * become its own file, because CSS cannot address a quadrant of a background
 * image and position it independently four times.
 *
 * Cutting on the grid is enough — `trim` then tightens each quadrant down to
 * its own ornament, so the cut only has to be roughly right.
 */
const cell = flags.find((f) => f.startsWith('--cell='))?.slice(7).split(',').map(Number);

const original = decode(readFileSync(source));
let image = original;

if (cell !== undefined) {
  const [col, row, cols, rows] = cell;
  const w = Math.floor(image.width / cols);
  const h = Math.floor(image.height / rows);
  image = crop(image, {
    left: col * w,
    right: image.width - (col + 1) * w,
    top: row * h,
    bottom: image.height - (row + 1) * h,
  });
}

if (!keepFrame) {
  image = crop(image, {
    left: frameInset(image, 'left'),
    right: frameInset(image, 'right'),
    top: frameInset(image, 'top'),
    bottom: frameInset(image, 'bottom'),
  });
}

image = trim(noKey ? image : keyBlack(image, 22, 78));
image = resize(image, Math.min(height, image.height));

const out = encode(image);
writeFileSync(dest, out);

const before = (readFileSync(source).length / 1024 / 1024).toFixed(2);
const after = (out.length / 1024).toFixed(0);
console.log(
  `${dest}  ${original.width}x${original.height} ${before} MB` +
    `  ->  ${image.width}x${image.height} ${after} KB`,
);
