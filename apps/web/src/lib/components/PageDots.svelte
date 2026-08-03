<script lang="ts">
  interface Props {
    /** Page names, in carousel order. Used for the buttons' accessible names. */
    pages: readonly string[];
    /** Index of the page currently settled in the viewport. */
    current: number;
    onselect: (index: number) => void;
  }

  let { pages, current, onselect }: Props = $props();
</script>

<!--
  Squares rather than the usual round dots: nothing else in this design has a
  rounded corner, and the title bar's menu glyph already establishes a square
  dot as this app's idea of a dot.

  They are real buttons as well as an indicator. Swiping is the point, but a
  scroll-snap carousel offers a keyboard user nothing on its own, and these
  give the screen switch a name a screen reader can announce.
-->
<nav class="dots" aria-label="Dashboard pages">
  {#each pages as name, index (name)}
    <button
      class="dot"
      class:active={index === current}
      type="button"
      aria-label="Show {name}"
      aria-current={index === current ? 'true' : undefined}
      onclick={() => onselect(index)}
    ></button>
  {/each}
</nav>

<style>
  /*
   * Overlaid rather than given a band of its own: both weather screens budget
   * their four band heights down to the pixel, and taking rows off them to
   * house an indicator would reflow layouts this change is meant to leave
   * alone. It sits in the slack at the bottom of the last band.
   */
  .dots {
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;

    display: flex;
    gap: 0;
  }

  /*
   * Transparent, and the gap between the two marks is wide enough for the
   * WEATHER NOW screen's metric divider to run down through it. Filling the
   * strip with the panel background instead cut that rule short a few pixels
   * above the frame, which read as a bug rather than as an overlay.
   *
   * The padding is hit area, not spacing: it lifts a 14px mark to a 32px
   * touch target without drawing anything bigger. Nothing beneath it on
   * either screen is interactive, so the overhang costs no other control.
   */
  .dot {
    display: block;
    padding: 9px;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .dot::before {
    content: '';
    display: block;
    width: 14px;
    height: 14px;
    background: var(--c-bg);
    border: 3px solid var(--c-blue);
  }

  /* Flat design, so the current page fills in rather than growing a ring. */
  .dot.active::before {
    background: var(--c-ink);
    border-color: var(--c-ink);
  }
</style>
