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
  <span class="pip" aria-hidden="true"></span>
  <span class="text">{busy ? 'WAIT' : label}</span>
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    /* Comfortably past the 44px touch target minimum. */
    min-width: 210px;
    min-height: 72px;
    padding: 0 24px;

    font: inherit;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-void);

    background: var(--c-amber);
    border: 4px solid var(--c-void);
    box-shadow:
      inset 0 4px 0 rgba(255, 255, 255, 0.55),
      inset 0 -5px 0 rgba(0, 0, 0, 0.28),
      0 6px 0 var(--c-void);

    cursor: pointer;
    touch-action: manipulation;
    transition: none;
  }

  .button:focus-visible {
    outline: 4px solid var(--c-cyan);
    outline-offset: 4px;
  }

  /* Physical button press: the face drops onto its own shadow. */
  .button:active:not(:disabled) {
    transform: translateY(6px);
    box-shadow:
      inset 0 4px 0 rgba(255, 255, 255, 0.4),
      inset 0 -5px 0 rgba(0, 0, 0, 0.28),
      0 0 0 var(--c-void);
  }

  .button:disabled {
    background: var(--c-panel-hi);
    color: var(--c-mute);
    cursor: default;
  }

  .pip {
    width: 14px;
    height: 14px;
    background: var(--c-void);
    box-shadow: 6px 0 0 -3px var(--c-void);
  }

  .button:disabled .pip {
    background: var(--c-mute);
    box-shadow: 6px 0 0 -3px var(--c-mute);
    animation: pulse 1s steps(2, end) infinite;
  }

  @keyframes pulse {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .button:disabled .pip {
      animation: none;
    }
  }
</style>
