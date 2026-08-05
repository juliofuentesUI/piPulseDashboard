<script lang="ts">
  /**
   * The tile shown where an event has no picture.
   *
   * This is the ordinary case, not the exception: SerpApi's `thumbnail` is
   * optional and most listings carry none, so a grid of these is what the list
   * usually looks like. That is the whole argument for drawing something rather
   * than leaving a crossed-out box — the placeholder is most of the page.
   *
   * **It is a placeholder, not a picture.** Flat geometry in the panel's own
   * palette, which cannot be mistaken for a photograph of an event at any size.
   * Nothing here invents content: the shapes carry no meaning and are not
   * derived from what the event is about.
   *
   * **Composition varies, colour does not.** Six themes make colour an
   * unreliable way to tell two things apart — the category-badge work measured
   * `blue` and `hot` as the same hex in `dmg-green`, and `warm` as the
   * background itself in `brutalist-mono`. So every tile uses the same two
   * tokens and the arrangement is what differs.
   */

  interface Props {
    /** Stable per event, so a card keeps the same tile across polls. */
    seed: string;
  }

  let { seed }: Props = $props();

  /**
   * A small non-negative hash. FNV-1a, which is short enough to read and
   * spreads adjacent strings — event ids share long prefixes, so a naive sum
   * would hand most cards the same variant.
   */
  function hash(value: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return Math.abs(h);
  }

  const variant = $derived(hash(seed) % 4);
</script>

<!--
  Drawn at 24x24 and scaled, so the shapes land on a coarse grid rather than
  wherever a 72px box happens to put them. That is the same reasoning the
  weather sprites use, and it is what keeps the edges hard at any card size.
-->
<svg class="thumb-art" viewBox="0 0 24 24" aria-hidden="true" preserveAspectRatio="none">
  <rect class="field" x="0" y="0" width="24" height="24" />

  {#if variant === 0}
    <!-- Disc and block, the arrangement the fixtures used. -->
    <circle class="mark" cx="8" cy="9" r="4" />
    <rect class="mark" x="14" y="5" width="6" height="6" />
    <rect class="band" x="0" y="16" width="24" height="8" />
  {:else if variant === 1}
    <!-- Stacked bars, weighted low. -->
    <rect class="mark" x="3" y="5" width="18" height="3" />
    <rect class="band" x="3" y="11" width="12" height="3" />
    <rect class="mark" x="3" y="17" width="18" height="3" />
  {:else if variant === 2}
    <!-- Off-centre disc with a corner block. -->
    <circle class="mark" cx="15" cy="13" r="6" />
    <rect class="band" x="2" y="2" width="8" height="8" />
  {:else}
    <!-- Two blocks and a rule. -->
    <rect class="mark" x="3" y="4" width="7" height="7" />
    <rect class="band" x="13" y="4" width="8" height="16" />
    <rect class="mark" x="3" y="15" width="7" height="5" />
  {/if}
</svg>

<style>
  .thumb-art {
    display: block;
    width: 100%;
    height: 100%;
  }

  /*
   * `sky` for the field and `bg` knocked out of it. Both are distinct from each
   * other in all six palettes, which is the property that matters here — this
   * has to read as a filled tile everywhere, including the two themes where
   * half the palette collapses onto itself.
   */
  .field {
    fill: var(--c-sky);
  }

  .mark {
    fill: var(--c-bg);
  }

  .band {
    fill: var(--c-blue);
  }
</style>
