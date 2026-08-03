<script lang="ts">
  import Raspberry from '../weather-icons/Raspberry.svelte';
  import Refresh from '../weather-icons/Refresh.svelte';

  interface Props {
    /** Wall-clock time of the last successful fetch, already formatted. */
    updated: string;
    busy: boolean;
    onrefresh: () => void;
  }

  let { updated, busy, onrefresh }: Props = $props();
</script>

<div class="bar">
  <span class="brand">
    <span class="logo"><Raspberry /></span>
    <span class="wordmark">RASPBERRY PI WEATHER</span>
  </span>

  <span class="right">
    <span class="updated">{busy ? 'REFRESHING' : `UPDATED ${updated}`}</span>
    <button
      class="refresh"
      type="button"
      onclick={onrefresh}
      disabled={busy}
      aria-label={busy ? 'Refreshing weather' : 'Refresh weather now'}
    >
      <Refresh />
    </button>
  </span>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 18px;
    overflow: hidden;
  }

  .brand,
  .right {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .logo {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
  }

  .wordmark,
  .updated {
    font-size: 18px;
    letter-spacing: 2px;
    white-space: nowrap;
    overflow: hidden;
    color: var(--c-blue);
  }

  /*
   * The status bar refreshes too, but it is invisible as a control. Down here
   * the reference art draws an explicit cycle glyph, so this one looks like a
   * button and carries the padding to be hit with a thumb.
   */
  .refresh {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    padding: 3px;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .refresh:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
