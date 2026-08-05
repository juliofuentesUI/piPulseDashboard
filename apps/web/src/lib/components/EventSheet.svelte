<script lang="ts">
  import type { LocalEvent } from '../types';

  interface Props {
    event: LocalEvent;
    onclose: () => void;
  }

  let { event, onclose }: Props = $props();

  /**
   * The date line, preferring our parsed instant and falling back to whatever
   * the source said.
   *
   * `when` is never discarded — it is the honest field, and an event whose
   * date would not parse still has to say something true about when it is.
   */
  const dateLine = $derived.by(() => {
    if (event.startsAt === undefined) return event.when.toUpperCase();

    const start = new Date(event.startsAt);
    const day = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(start);

    // Midnight means the source gave a date and no clock time, so showing
    // "12:00 AM" would be inventing precision we were never given.
    const midnight = start.getHours() === 0 && start.getMinutes() === 0;
    if (midnight) return day.toUpperCase();

    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(start);
    return `${day} · ${time}`.toUpperCase();
  });

  const place = $derived(event.venue ?? event.address ?? '');

  /**
   * Why this event has no pin, in words.
   *
   * Only ever shown for an event that is genuinely unplaceable. Saying nothing
   * would leave a row in the list that never highlights on the map, which reads
   * as a bug rather than as a limitation.
   */
  const unpinnedNote = $derived(
    event.coordinates === undefined ? 'NO MAP LOCATION FOR THIS ADDRESS' : '',
  );
</script>

<!--
  A sheet of our own rather than a Leaflet popup.

  A popup on a 720px panel is small, hard to hit with a finger, and carries
  Leaflet's own stylesheet into six themes that know nothing about it. This is
  an ordinary component in this project's idiom, so it themes for free and can
  be sized for a touchscreen.
-->
<section class="sheet" aria-label="Event details">
  <header class="head">
    <h2 class="title">{event.title}</h2>
    <button class="close" type="button" aria-label="Close event details" onclick={onclose}>
      ×
    </button>
  </header>

  <p class="date">{dateLine}</p>

  {#if place !== ''}
    <p class="place">
      {place}
      {#if event.distanceMiles !== undefined}
        <span class="miles">· {event.distanceMiles} MI</span>
      {/if}
    </p>
  {/if}

  {#if unpinnedNote !== ''}
    <p class="warn">{unpinnedNote}</p>
  {/if}

  {#if event.description !== undefined}
    <p class="blurb">{event.description}</p>
  {/if}

  <!--
    The URL is shown as text rather than as a link. Nothing on a kiosk panel
    can follow one — there is no browser chrome and no keyboard — so a link
    would be a control that does nothing. The address is what a person needs
    to look it up on their own phone.
  -->
  {#if event.url !== undefined}
    <p class="link">{event.url.replace(/^https?:\/\//, '')}</p>
  {/if}
</section>

<style>
  /*
   * Anchored to the bottom of the map band, not of the panel: the page
   * indicator lives in the panel's last few pixels and a sheet over it would
   * cover the only way to leave this page by tapping.
   */
  .sheet {
    position: absolute;
    inset: auto 0 0 0;
    z-index: 400; /* above Leaflet's own panes, which top out at 700 for controls */
    display: grid;
    gap: 6px;
    max-height: 62%;
    overflow-y: auto;
    /*
     * The generous bottom padding is clearance, not spacing. The page indicator
     * is overlaid on the panel's last ~34px and draws above this sheet, so
     * anything that runs to the bottom edge — a long URL especially — would
     * pass under the dots.
     */
    padding: 12px 16px 40px;
    background: var(--c-bg);
    border-top: var(--divider) solid var(--line);
  }

  .head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .title {
    flex: 1;
    margin: 0;
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 1.15;
    color: var(--c-ink);
    text-transform: uppercase;
  }

  /*
   * 44px of hit area around a 24px glyph, which is the same trade the page
   * indicator makes: a finger needs the target, the design does not want the
   * mark that size.
   */
  .close {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    margin: -8px -8px 0 0;
    font-family: var(--font-pixel);
    font-size: 26px;
    line-height: 1;
    color: var(--c-ink);
    background: none;
    border: 0;
    cursor: pointer;
  }

  .date {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: 15px;
    color: var(--c-blue);
  }

  .place,
  .blurb,
  .link,
  .warn {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: 14px;
    line-height: 1.35;
    color: var(--c-ink);
  }

  .miles {
    color: var(--c-blue);
  }

  /* Same treatment the Search Pulse strip gives a warning: stated, not styled loud. */
  .warn {
    color: var(--c-hot);
  }

  .blurb {
    /*
     * Three lines, then it stops. The sheet is a pointer to an event, not a
     * page about it, and an unbounded blurb would push the map out of view on
     * a panel with no room to spare.
     */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }

  .link {
    color: var(--c-blue);
    overflow-wrap: anywhere;
  }
</style>
