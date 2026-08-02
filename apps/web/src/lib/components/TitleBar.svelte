<script lang="ts">
  interface Props {
    onswap: () => void;
  }

  let { onswap }: Props = $props();

  const DOTS = [0, 1, 2, 3, 4, 5];
</script>

<div class="row">
  <h1 class="title">WEATHER</h1>

  <!--
    The 3x2 grid is decoration in the reference design. Here it doubles as the
    theme switcher: it already reads as a menu affordance, so the dashboard
    gains a control without gaining a widget.
  -->
  <button class="menu" type="button" onclick={onswap} aria-label="Change theme">
    {#each DOTS as dot (dot)}
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
    font-size: 100px;
    font-weight: 700;
    line-height: 0.86;
    letter-spacing: 2px;
    white-space: nowrap;
    color: var(--c-ink);
  }

  .menu {
    display: grid;
    grid-template-columns: repeat(3, 18px);
    gap: 6px;
    flex: 0 0 auto;

    /* Padding is what lifts the 66x42 glyph to a comfortable touch target. */
    padding: 14px;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .dot {
    width: 18px;
    height: 18px;
    background: var(--c-blue);
  }

  .menu:active .dot {
    background: var(--c-hot);
  }
</style>
