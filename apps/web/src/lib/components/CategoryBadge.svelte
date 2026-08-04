<script lang="ts">
  import {
    CATEGORY_ABBREVIATIONS,
    CATEGORY_GLYPHS,
    GLYPH_GRID,
  } from '../category-glyphs';

  interface Props {
    category: string;
    /**
     * Which candidate to draw. Question 9 in the plan.
     *
     * `plain` was added during the C0 render: knocking a 16px glyph out of a
     * 20px plate leaves the shape touching the plate edge, and the eye reads
     * the plate instead of the shape. Drawing the glyph directly gives the
     * silhouette the full 16px, at the cost of the filled-chip grammar that
     * says "we assigned this".
     */
    variant?: 'glyph' | 'plain' | 'abbrev';
  }

  let { category, variant = 'glyph' }: Props = $props();

  const rects = $derived(CATEGORY_GLYPHS[category] ?? []);
  const abbrev = $derived(CATEGORY_ABBREVIATIONS[category] ?? '');
</script>

<!--
  Everything else on these rows came from Google. This did not — it is our
  reading of a headline, and the shape of the badge is what says so.

  The cut corners are the whole device. Every other rectangle on this panel is
  square: the frame, the plaques, the track, the mode chips, the NEW badge. A
  notched plate is a different kind of object at any distance and in any theme,
  and it says "filled in by someone else" the way a clipped corner does on a
  printed form — without spending a colour the monochrome themes do not have.

  The notch is stepped rather than mitred. A 45-degree clip antialiases, which
  is exactly the soft edge the whole design avoids; a single axis-aligned step
  stays on the pixel grid.

  aria-hidden because the row's accessible name carries the category as a word.
  A screen reader should say "sport", not announce an image.
-->
<span
  class="badge"
  class:abbrev={variant === 'abbrev'}
  class:plain={variant === 'plain'}
  aria-hidden="true"
>
  {#if variant === 'abbrev'}
    <span class="letters">{abbrev}</span>
  {:else}
    <svg
      class="glyph"
      viewBox="0 0 {GLYPH_GRID} {GLYPH_GRID}"
      width="16"
      height="16"
      shape-rendering="crispEdges"
    >
      {#each rects as rect, index (index)}
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} />
      {/each}
    </svg>
  {/if}
</span>

<style>
  /*
   * Sits on the title line, so it centres against text rather than sharing its
   * baseline — a 16px block on a baseline hangs below the letters.
   */
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    flex: 0 0 auto;

    box-sizing: content-box;
    width: 16px;
    height: 16px;
    padding: 2px;

    color: var(--c-bg);
    background: var(--c-blue);

    /*
     * Top-left and bottom-right notched, in one axis-aligned step each. Two
     * opposite corners rather than all four: all four reads as a rounded chip,
     * which is the opposite of the intent, and two makes the cut deliberate.
     */
    clip-path: polygon(
      4px 0,
      100% 0,
      100% calc(100% - 4px),
      calc(100% - 4px) calc(100% - 4px),
      calc(100% - 4px) 100%,
      0 100%,
      0 4px,
      4px 4px
    );
  }

  .badge.abbrev {
    width: auto;
    height: auto;
    padding: 3px 6px;
  }

  /* No plate: the glyph itself is the mark, drawn in the label colour. */
  .badge.plain {
    color: var(--c-blue);
    background: none;
    clip-path: none;
  }

  .glyph {
    display: block;
    fill: currentColor;
  }

  .letters {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    /* The trailing letter-space would otherwise push the text off centre. */
    margin-right: -2px;
    line-height: 1;
  }
</style>
