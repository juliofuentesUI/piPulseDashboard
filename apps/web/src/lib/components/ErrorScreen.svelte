<script lang="ts">
  import type { DashboardFailure } from '../types';
  import RefreshButton from './RefreshButton.svelte';

  interface Props {
    failure: DashboardFailure | null;
    busy: boolean;
    onretry: () => void;
  }

  let { failure, busy, onretry }: Props = $props();

  const hint = $derived(
    failure?.kind === 'offline'
      ? 'CHECK THE WIFI CONNECTION'
      : failure?.kind === 'network'
        ? 'IS THE API RUNNING ON PORT 3000'
        : 'RETRY IN A MOMENT',
  );
</script>

<section class="error panel" role="alert">
  <div class="mark" aria-hidden="true">
    <span class="bar"></span>
    <span class="dot"></span>
  </div>
  <p class="headline">{failure?.message ?? 'NO WEATHER DATA'}</p>
  <p class="hint">{hint}</p>
  <RefreshButton {busy} label="RETRY" onpress={onretry} />
</section>

<style>
  .error {
    grid-row: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }

  /* A chunky exclamation mark, built from blocks to stay on the pixel grid. */
  .mark {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .bar {
    width: 28px;
    height: 76px;
    background: var(--c-red);
    box-shadow: 0 5px 0 var(--c-void);
  }

  .dot {
    width: 28px;
    height: 28px;
    background: var(--c-red);
    box-shadow: 0 5px 0 var(--c-void);
  }

  .headline {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-ink);
    text-align: center;
    text-shadow: 0 4px 0 var(--c-void);
  }

  .hint {
    margin: 0 0 12px;
    font-size: 17px;
    letter-spacing: 3px;
    color: var(--c-mute);
    text-align: center;
  }
</style>
