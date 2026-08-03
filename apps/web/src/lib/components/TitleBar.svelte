<script lang="ts">
  interface Props {
    /** Band heading. A long one needs `size` brought down to fit beside the grid. */
    title?: string;
    /** Title size in design pixels. */
    size?: number;
    /**
     * Rows in the dot grid. The reference art draws 3x2 on the dashboard and
     * 3x3 on the 7-day screen; it is the same control either way.
     */
    dotRows?: number;
    onmenu: () => void;
  }

  let { title = 'WEATHER', size = 100, dotRows = 2, onmenu }: Props = $props();

  const dots = $derived(Array.from({ length: dotRows * 3 }, (_, i) => i));

  /** Keeps the glyph to roughly one height whatever the row count. */
  const dotSize = $derived(dotRows >= 3 ? 14 : 18);
</script>

<div class="row">
  <h1 class="title" style:--title-size="{size}px">{title}</h1>

  <!--
    The dot grid is decoration in the reference design. Here it opens settings:
    it already reads as a menu affordance, so the screen gains a control
    without gaining a widget.
  -->
  <button
    class="menu"
    type="button"
    onclick={onmenu}
    aria-label="Open settings"
    style:--dot="{dotSize}px"
  >
    {#each dots as dot (dot)}
      <span class="dot"></span>
    {/each}
  </button>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 24px;
    overflow: hidden;
    border-bottom: var(--divider) solid var(--c-ink);
  }

  .title {
    margin: 0;
    font-size: var(--title-size);
    font-weight: 700;
    line-height: 0.86;
    letter-spacing: 2px;
    white-space: nowrap;
    color: var(--c-ink);
  }

  .menu {
    display: grid;
    grid-template-columns: repeat(3, var(--dot));
    gap: 6px;
    flex: 0 0 auto;

    /* Padding is what lifts the small glyph to a comfortable touch target. */
    padding: 14px;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .dot {
    width: var(--dot);
    height: var(--dot);
    background: var(--c-blue);
  }

  .menu:active .dot {
    background: var(--c-hot);
  }
</style>
