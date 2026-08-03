<script lang="ts">
  import type { Notice } from '../dashboard.svelte';

  interface Props {
    date: string;
    clock: string;
    location: string;
    /** Null in the resting state, when the middle slot falls back to the location. */
    notice: Notice | null;
    onrefresh: () => void;
  }

  let { date, clock, location, notice, onrefresh }: Props = $props();

  const alert = $derived(notice?.tone === 'warn' || notice?.tone === 'error');
</script>

<!--
  The reference has no refresh control, but the dashboard still needs one, so
  the whole bar is the button. It looks exactly like the reference and gives a
  finger a 700x72 target, which is hard to miss on a small touchscreen.
-->
<button class="bar" type="button" onclick={onrefresh} aria-label="Refresh weather">
  <time class="date">{date}</time>
  <span
    class="middle"
    class:notice={notice !== null}
    class:alert
    role="status"
    aria-live="polite"
  >
    {notice?.text ?? location}
  </span>
  <time class="clock">{clock}</time>
</button>

<style>
  .bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 0 24px;

    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    border-bottom: var(--divider) solid var(--line);
    cursor: pointer;
  }

  .date,
  .clock {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 3px;
    white-space: nowrap;
  }

  .date {
    justify-self: start;
    color: var(--c-ink);
  }

  .clock {
    justify-self: end;
    color: var(--c-blue);
  }

  .middle {
    justify-self: center;
    font-size: 18px;
    letter-spacing: 3px;
    color: var(--c-blue);
    white-space: nowrap;
    overflow: hidden;
  }

  /* Anything the screen has to say about itself outranks the place name. */
  .middle.notice {
    font-weight: 700;
  }

  .middle.alert {
    color: var(--c-hot);
  }
</style>
