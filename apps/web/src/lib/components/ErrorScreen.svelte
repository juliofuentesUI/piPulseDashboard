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

<section class="error" role="alert">
  <!-- A chunky exclamation mark, built from blocks to stay on the pixel grid. -->
  <div class="mark" aria-hidden="true">
    <span class="stem"></span>
    <span class="dot"></span>
  </div>
  <p class="headline">{failure?.message ?? 'NO WEATHER DATA'}</p>
  <p class="hint">{hint}</p>
  <RefreshButton {busy} label="RETRY" onpress={onretry} />
</section>

<style>
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
  }

  .mark {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .stem {
    width: 30px;
    height: 80px;
    background: var(--c-hot);
    border: var(--divider) solid var(--c-ink);
  }

  .dot {
    width: 30px;
    height: 30px;
    background: var(--c-hot);
    border: var(--divider) solid var(--c-ink);
  }

  .headline {
    margin: 0;
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-ink);
    text-align: center;
  }

  .hint {
    margin: 0 0 10px;
    font-size: 18px;
    letter-spacing: 3px;
    color: var(--c-blue);
    text-align: center;
  }
</style>
