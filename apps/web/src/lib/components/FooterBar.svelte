<script lang="ts">
  import type { Notice } from '../dashboard.svelte';
  import RefreshButton from './RefreshButton.svelte';

  interface Props {
    notice: Notice;
    busy: boolean;
    onrefresh: () => void;
  }

  let { notice, busy, onrefresh }: Props = $props();
</script>

<footer class="bar panel">
  <p class="notice" data-tone={notice.tone} role="status" aria-live="polite">
    {notice.text}
  </p>
  <RefreshButton {busy} onpress={onrefresh} />
</footer>

<style>
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 16px;
    height: 96px;
  }

  .notice {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 3px;
  }

  .notice[data-tone='ok'] {
    color: var(--c-dim);
  }

  .notice[data-tone='busy'] {
    color: var(--c-cyan);
  }

  .notice[data-tone='warn'] {
    color: var(--c-amber);
  }

  .notice[data-tone='error'] {
    color: var(--c-red);
  }
</style>
