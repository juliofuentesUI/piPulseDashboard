<script lang="ts">
  import qrcode from 'qrcode-generator';

  import type { TrendHeadlineView } from '../types';

  interface Props {
    headline: TrendHeadlineView;
    onclose: () => void;
  }

  let { headline, onclose }: Props = $props();

  let dialog: HTMLDivElement | undefined = $state();

  /** Same as the legend and the settings dialog: take focus so Escape lands. */
  $effect(() => {
    dialog?.focus();
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onclose();
  }

  /**
   * The code itself, as an SVG path string.
   *
   * `typeNumber: 0` lets the library choose the smallest version that fits.
   * Measured against the live feed: headline URLs run 72–167 characters, which
   * lands between version 5 and version 9 in byte mode — so pinning a version
   * would either refuse the long ones or waste modules on the short ones.
   *
   * Error correction `M` (~15%) rather than `L`. This is photographed off a
   * glossy panel at an angle, often from a metre away, and the extra redundancy
   * costs a few modules where a failed scan costs the whole feature.
   */
  const cells = $derived.by(() => {
    if (headline.url === '') return null;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(headline.url);
      qr.make();

      const count = qr.getModuleCount();
      const grid: boolean[][] = [];
      for (let row = 0; row < count; row += 1) {
        const line: boolean[] = [];
        for (let col = 0; col < count; col += 1) line.push(qr.isDark(row, col));
        grid.push(line);
      }
      return { count, grid };
    } catch {
      // A URL too long for even the largest version, or an encoder fault. The
      // panel says so rather than drawing a code that will not scan.
      return null;
    }
  });

  /** The address in words, as a fallback and as a check on what was encoded. */
  const shownUrl = $derived(headline.url.replace(/^https?:\/\//, ''));
</script>

<svelte:window {onkeydown} />

<!--
  The same skeleton as SettingsModal and CategoryLegend — backdrop, scrim
  button, `.panel` with `.head`/`.heading`/`.close` and a `.body`.

  Not laziness: `millennium.css` styles dialogs by reaching into those class
  names from outside, so a dialog that invents its own structure arrives
  unstyled in that theme and nowhere else. Matching means the gold framing and
  the stone field apply here for free.
-->
<div class="backdrop">
  <button
    class="scrim"
    type="button"
    tabindex="-1"
    aria-label="Close QR code"
    onclick={onclose}
  ></button>

  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label="Scan to open article"
    tabindex="-1"
    bind:this={dialog}
  >
    <header class="head">
      <h2 class="heading">SCAN TO READ</h2>
      <button class="close" type="button" onclick={onclose} aria-label="Close QR code">
        ×
      </button>
    </header>

    <div class="body">
      {#if cells === null}
        <p class="none">NO LINK FOR THIS HEADLINE</p>
      {:else}
        <!--
          Drawn as one <svg> of rects on a white field rather than as an image.

          The quiet zone is not optional — the spec asks for four modules of
          clear margin and scanners genuinely fail without it, so the viewBox is
          the module count plus eight and the grid is offset by four.

          **White and black, not theme tokens.** Every other pixel on this panel
          follows the palette; this one must not. A code drawn in `dmg-green`'s
          two greens has nowhere near the contrast a scanner needs, and amber on
          near-black is worse. The panel around it stays themed — the code is a
          machine-readable object sitting on it, and it is allowed to look like
          one.
        -->
        <svg
          class="qr"
          viewBox="0 0 {cells.count + 8} {cells.count + 8}"
          shape-rendering="crispEdges"
          role="img"
          aria-label="QR code linking to {shownUrl}"
        >
          <rect x="0" y="0" width={cells.count + 8} height={cells.count + 8} fill="#ffffff" />
          {#each cells.grid as row, y (y)}
            {#each row as dark, x (x)}
              {#if dark}
                <rect x={x + 4} y={y + 4} width="1" height="1" fill="#000000" />
              {/if}
            {/each}
          {/each}
        </svg>
      {/if}

      <!--
        The headline is quoted verbatim with its source, the same rule the rest
        of the screen follows. Nothing here summarises or rewords it.
      -->
      <figure class="quote">
        <blockquote class="text">{headline.text}</blockquote>
        {#if headline.source !== '' || headline.host !== ''}
          <figcaption class="attrib">
            {headline.source}{#if headline.source !== '' && headline.host !== ''}<span
                class="sep">·</span
              >{/if}{headline.host}
          </figcaption>
        {/if}
      </figure>

      {#if headline.url !== ''}
        <p class="url">{shownUrl}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
  }

  .scrim {
    position: absolute;
    inset: 0;
    padding: 0;
    background: var(--c-ink);
    border: 0;
    opacity: 0.55;
    cursor: pointer;
  }

  .panel {
    position: relative;
    display: grid;
    grid-template-rows: 76px minmax(0, 1fr);
    width: 560px;
    /*
     * 620, not the legend's 580. Measured: at 600 the body overflowed by 9px in
     * `millennium`, which adds its own framing inside the panel — enough to
     * raise a scrollbar over a code that fits perfectly well. Still clears the
     * 704 of usable panel height with room either side.
     */
    max-height: 620px;
    background: var(--c-bg);
    border: var(--frame) solid var(--line);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    border-bottom: var(--divider) solid var(--line);
  }

  .heading {
    margin: 0;
    font-family: var(--font-display);
    font-size: 30px;
    color: var(--c-ink);
  }

  .close {
    width: 48px;
    height: 48px;
    font-family: var(--font-pixel);
    font-size: 30px;
    line-height: 1;
    color: var(--c-ink);
    background: none;
    border: 0;
    cursor: pointer;
  }

  .body {
    display: grid;
    justify-items: center;
    gap: 14px;
    overflow-y: auto;
    padding: 18px 24px 24px;
  }

  /*
   * 300px on a 720px panel. Measured against the encoder at real URL lengths:
   * 75 chars is 37 modules (6.7px each), 148 chars is 49 modules (5.3px), and
   * 220 chars — well past the 167 longest seen on the live feed — is 61 modules
   * at 4.4px. All comfortably above the ~2px where phone cameras start failing
   * at an angle.
   */
  .qr {
    display: block;
    width: 300px;
    height: 300px;
  }

  .quote {
    margin: 0;
    text-align: center;
  }

  .text {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: 15px;
    line-height: 1.3;
    color: var(--c-ink);
  }

  .attrib {
    margin-top: 6px;
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--c-blue);
  }

  .sep {
    padding: 0 6px;
  }

  /*
   * Shown as text, not as a link. There is no browser chrome on a kiosk panel
   * and nothing to follow a link with — which is the entire reason the code
   * above exists. This is here so a person can read the address, or check that
   * the code points where they expect before pointing a camera at it.
   */
  /*
   * The one string on this panel that must not be uppercased.
   *
   * `body` sets `text-transform: uppercase` for the whole design, and for every
   * other piece of text here that is a style choice. For a URL it is a factual
   * error: the host is case-insensitive but the path is not, so an uppercased
   * address is one that would 404 if somebody typed it. The QR encodes the real
   * string either way — this is about the line a person reads.
   */
  .url {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--c-sky);
    overflow-wrap: anywhere;
    text-align: center;
    text-transform: none;
  }

  .none {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--c-ink);
  }
</style>
