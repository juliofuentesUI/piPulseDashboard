<script lang="ts">
  interface Props {
    busy: boolean;
    label?: string;
    onpress: () => void;
  }

  let { busy, label = 'REFRESH', onpress }: Props = $props();
</script>

<button
  class="button"
  type="button"
  onclick={onpress}
  disabled={busy}
  aria-busy={busy}
  aria-label={busy ? 'Refreshing weather' : 'Refresh weather now'}
>
  {busy ? 'WAIT' : label}
</button>

<style>
  .button {
    /* Comfortably past the 44px touch target minimum. */
    min-width: 220px;
    min-height: 76px;
    padding: 0 28px;

    font: inherit;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-ink);

    background: var(--c-warm);
    border: var(--divider) solid var(--line);
    cursor: pointer;
  }

  /* Flat design, so a press swaps the fill rather than moving the button. */
  .button:active:not(:disabled) {
    background: var(--c-hot);
  }

  .button:disabled {
    background: var(--c-bg);
    color: var(--c-blue);
    cursor: default;
  }
</style>
