#!/usr/bin/env node
/**
 * Wraps a 720 x 720 screenshot in a self-contained HTML page, ready to publish
 * as an Artifact.
 *
 * Screenshots are taken by the Playwright MCP server, which only Claude can
 * drive — a shell script cannot call an MCP tool. So this script starts from a
 * PNG that already exists and handles the deterministic half: read the capture,
 * gather metadata, emit the page. See .claude/skills/show-dashboard for the
 * whole sequence.
 *
 *   node scripts/build-capture.mjs --png .playwright-mcp/page-*.png
 *   node scripts/build-capture.mjs --png shot.png --note "New wind sprite"
 *
 * Node stdlib only, deliberately: the repo prefers hand-rolled helpers to
 * dependencies, and Playwright is not one of ours.
 */

import { execFileSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const DEFAULT_OUT = '.playwright-mcp/capture.html';
const API = process.env['CAPTURE_API'] ?? 'http://127.0.0.1:3000/api/weather';

/**
 * Every dynamic value goes through here. Beyond the usual HTML escaping it
 * folds anything non-ASCII into a numeric reference, because the publish-time
 * wrapper is not guaranteed to declare a charset — a literal UTF-8 page
 * rendered as mojibake when tested. Pure ASCII cannot be misdecoded.
 */
function text(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x00-\x7F]/gu, (c) => `&#${c.codePointAt(0)};`);
}

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** Commit the capture reflects, flagged when the tree has uncommitted edits. */
function describeCommit() {
  const short = git('rev-parse', '--short', 'HEAD');
  if (!short) return 'unknown';
  return git('status', '--porcelain') ? `${short} + local edits` : short;
}

/** The reading on screen, so the page says what the dashboard was showing. */
async function currentReading() {
  try {
    const response = await fetch(API, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    const { location, temperature, condition } = await response.json();
    const parts = [location, temperature != null ? `${temperature}°` : null, condition?.toLowerCase()];
    return parts.filter(Boolean).join(' · ') || null;
  } catch {
    // The API being down says nothing about whether the capture is good.
    return null;
  }
}

function formatCaptureTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function page({ base64, captured, commit, reading, note }) {
  const cells = [
    ['Captured', captured],
    ['Commit', commit],
    reading ? ['Reading', reading] : null,
    note ? ['Change', note] : null,
  ].filter(Boolean);

  // The 1px grid gap shows the hairline through, so a half-empty final row
  // reads as an empty box. Two columns divide 2 and 4 evenly; three cells get
  // a full-width final one instead.
  const spanLast = cells.length % 2 === 1;

  const meta = cells
    .map(([label, value], i) => {
      const span = spanLast && i === cells.length - 1 ? ' class="wide"' : '';
      return `    <div${span}>\n      <dt>${text(label)}</dt>\n      <dd>${text(value)}</dd>\n    </div>`;
    })
    .join('\n');

  const alt = reading
    ? `The piPulse weather dashboard at 720 by 720 pixels, showing ${text(reading)}.`
    : 'The piPulse weather dashboard captured at 720 by 720 pixels.';

  return `<title>piPulse capture &mdash; 720 &times; 720</title>

<style>
  /* Palette is the dashboard's own theme data (apps/web/src/lib/theme.svelte.ts):
     light is \`gba-blue\`, dark is \`midnight\`. The page and the capture agree. */
  :root {
    --ground: #f8f5ed;
    --surface: #ffffff;
    --ink: #082b69;
    --secondary: #2868b8;
    --accent: #f28a16;
    --highlight: #ffc928;
    --hairline: #c8d6ea;
    --mono: ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #081428;
      --surface: #10233f;
      --ink: #eaf2ff;
      --secondary: #73aeef;
      --hairline: #2e5e9e;
    }
  }

  /* The viewer's own toggle stamps data-theme and must beat the media query
     in both directions. */
  :root[data-theme='dark'] {
    --ground: #081428;
    --surface: #10233f;
    --ink: #eaf2ff;
    --secondary: #73aeef;
    --hairline: #2e5e9e;
  }

  :root[data-theme='light'] {
    --ground: #f8f5ed;
    --surface: #ffffff;
    --ink: #082b69;
    --secondary: #2868b8;
    --hairline: #c8d6ea;
  }

  body {
    margin: 0;
    padding: 2rem 1.25rem 4rem;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--mono);
    font-size: 15px;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
  }

  .page {
    max-width: 780px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--secondary);
  }

  h1 {
    margin: 0;
    font-size: clamp(1.5rem, 6vw, 2.1rem);
    line-height: 1.15;
    text-wrap: balance;
  }

  h1 .rule {
    display: block;
    width: 3.5rem;
    height: 4px;
    margin-top: 0.9rem;
    background: var(--accent);
  }

  .lede {
    margin: 1.1rem 0 0;
    max-width: 62ch;
    color: var(--secondary);
  }

  .meta {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    background: var(--hairline);
    border: 1px solid var(--hairline);
  }

  .meta > div {
    background: var(--surface);
    padding: 0.7rem 0.85rem;
  }

  .meta > div.wide {
    grid-column: 1 / -1;
  }

  .meta dt {
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--secondary);
  }

  .meta dd {
    margin: 0.3rem 0 0;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .controls .label {
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--secondary);
    margin-right: 0.2rem;
  }

  button {
    font-family: inherit;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.45rem 0.9rem;
    color: var(--ink);
    background: var(--surface);
    border: 2px solid var(--ink);
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    background: var(--accent);
    border-color: var(--accent);
    color: #0b1220;
  }

  button:focus-visible {
    outline: 3px solid var(--highlight);
    outline-offset: 2px;
  }

  /* Wide content scrolls in its own container so the body never does. */
  .frame {
    border: 3px solid var(--ink);
    background: var(--surface);
    overflow-x: auto;
    overscroll-behavior-x: contain;
  }

  .frame img {
    display: block;
    width: 100%;
    max-width: 720px;
    height: auto;
    margin: 0 auto;
  }

  .frame[data-scale='actual'] img {
    width: 720px;
    max-width: none;
    height: 720px;
    image-rendering: pixelated;
    margin: 0;
  }

  figcaption {
    font-size: 0.8rem;
    color: var(--secondary);
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
    }
  }
</style>

<div class="page">
  <header>
    <p class="eyebrow">piPulse dashboard &middot; pixel capture</p>
    <h1>720 &times; 720, at true scale<span class="rule"></span></h1>
    <p class="lede">
      The size of the actual HyperPixel panel. This is the one thing the live tailnet
      view cannot give you: on a 390 px phone the dashboard scales to about 0.54, the
      sprite grid resamples unevenly, and crispness stops being judgeable.
    </p>
  </header>

  <dl class="meta">
${meta}
  </dl>

  <figure>
    <div class="controls">
      <span class="label">Scale</span>
      <button type="button" id="fit" aria-pressed="true">Fit width</button>
      <button type="button" id="actual" aria-pressed="false">1:1 pixels</button>
    </div>

    <div class="frame" id="frame" data-scale="fit">
      <img src="data:image/png;base64,${base64}" alt="${alt}" />
    </div>

    <figcaption id="caption">
      Scaled to fit &mdash; good for layout and composition, but the browser is
      resampling, so do not judge sprite edges here.
    </figcaption>
  </figure>
</div>

<script>
  const frame = document.getElementById('frame');
  const caption = document.getElementById('caption');
  const buttons = {
    fit: document.getElementById('fit'),
    actual: document.getElementById('actual'),
  };

  const captions = {
    fit: 'Scaled to fit \\u2014 good for layout and composition, but the browser is resampling, so do not judge sprite edges here.',
    actual: '1:1 with nearest-neighbour rendering \\u2014 every pixel is one the panel would light. Scroll sideways to pan.',
  };

  function setScale(mode) {
    frame.dataset.scale = mode;
    caption.textContent = captions[mode];
    for (const [key, button] of Object.entries(buttons)) {
      button.setAttribute('aria-pressed', String(key === mode));
    }
    if (mode === 'actual') {
      frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2;
    }
  }

  buttons.fit.addEventListener('click', () => setScale('fit'));
  buttons.actual.addEventListener('click', () => setScale('actual'));
</script>
`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      png: { type: 'string' },
      out: { type: 'string', default: DEFAULT_OUT },
      note: { type: 'string' },
    },
  });

  if (!values.png) {
    console.error('Usage: node scripts/build-capture.mjs --png <file.png> [--out <file.html>] [--note "what changed"]');
    process.exit(1);
  }

  const png = await readFile(values.png);
  const { mtime } = await stat(values.png);

  const html = page({
    base64: png.toString('base64'),
    captured: formatCaptureTime(mtime),
    commit: describeCommit(),
    reading: await currentReading(),
    note: values.note,
  });

  const nonAscii = html.match(/[^\x00-\x7F]/gu);
  if (nonAscii) {
    throw new Error(`page is not pure ASCII, found: ${[...new Set(nonAscii)].join(' ')}`);
  }

  await writeFile(values.out, html, 'utf8');

  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log(`png    ${values.png} (${kb(png.length)})`);
  console.log(`page   ${values.out} (${kb(Buffer.byteLength(html))})`);
  console.log('\nPublish it with the Artifact tool, passing this path as file_path.');
}

await main();
