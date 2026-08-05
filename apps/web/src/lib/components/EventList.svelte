<script lang="ts">
  import { EVENT_SORTS, type EventSort } from '../events.svelte';
  import type { LocalEvent } from '../types';
  import EventThumb from './EventThumb.svelte';

  interface Props {
    events: readonly LocalEvent[];
    sort: EventSort;
    selectedId: string | null;
    onsort: (sort: EventSort) => void;
    onselect: (id: string) => void;
  }

  let { events, sort, selectedId, onsort, onselect }: Props = $props();

  let grid: HTMLOListElement | undefined = $state();

  /**
   * Brings the selected card into view.
   *
   * Needed because a selection can arrive from outside this component — the
   * map's "N NOT PLACED" jumps straight here — and the card it names is
   * usually below the fold, since unplaced events sort last.
   *
   * `block: 'nearest'` so a card already on screen is left where it is; a tap
   * that scrolled the list under the finger would be its own bug.
   */
  $effect(() => {
    if (selectedId === null || grid === undefined) return;
    const card = grid.querySelector(`[data-event-id="${CSS.escape(selectedId)}"]`);
    card?.scrollIntoView({ block: 'nearest' });
  });

  /**
   * Thumbnails that failed to load, by event id.
   *
   * Tracked rather than hidden with CSS because a broken `<img>` renders the
   * browser's own placeholder glyph, which belongs to no theme here. Once a URL
   * has failed the slot is replaced outright.
   */
  let broken = $state<Record<string, true>>({});

  const shortDate = (event: LocalEvent): string => {
    if (event.startsAt === undefined) {
      // The source's own words, since there is no instant to format. Trimmed to
      // fit a card; the sheet shows it in full.
      return event.when.toUpperCase().slice(0, 22);
    }
    const start = new Date(event.startsAt);
    const day = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(start);

    const midnight = start.getHours() === 0 && start.getMinutes() === 0;
    if (midnight) return day.toUpperCase();

    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(start);
    return `${day} · ${time}`.toUpperCase();
  };
</script>

<div class="list-view">
  <!--
    The ordering, in its own compact row rather than in the band above.

    That band already carries the range filter and the map/list switch, and a
    third pair of buttons would put six controls across 704px. This row belongs
    to the list and disappears with it, which is also honest: a map has no
    ordering to choose.
  -->
  <div class="sorting">
    <span class="count">{events.length} EVENT{events.length === 1 ? '' : 'S'}</span>
    <nav class="sorts" aria-label="List ordering">
      {#each EVENT_SORTS as option (option.id)}
        <button
          class="sort"
          class:active={option.id === sort}
          type="button"
          aria-pressed={option.id === sort}
          onclick={() => onsort(option.id)}
        >
          {option.name}
        </button>
      {/each}
    </nav>
  </div>

  {#if events.length === 0}
    <div class="empty">
      <p class="lead">NOTHING TO LIST</p>
    </div>
  {:else}
    <!--
      Two columns. At 704px each card gets ~346px, which fits a 96px thumbnail
      beside two lines of title at 14px — measured against the longest fixture
      title. One column would show three cards where this shows six, and the
      whole point of the list is seeing more at once than the map can pin.
    -->
    <ol class="cards" bind:this={grid}>
      {#each events as event (event.id)}
        <li>
          <button
            class="card"
            class:selected={event.id === selectedId}
            data-event-id={event.id}
            type="button"
            onclick={() => onselect(event.id)}
          >
            <span class="thumb">
              {#if event.thumbnailUrl !== undefined && broken[event.id] !== true}
                <img
                  src={event.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onerror={() => (broken = { ...broken, [event.id]: true })}
                />
              {:else}
                <!--
                  Not a fallback so much as the ordinary case: `thumbnail` is
                  optional upstream and most listings carry none. Drawn in the
                  panel's own palette so a page of them still looks like this
                  dashboard, and flat enough that it cannot be read as a photo
                  of the event.
                -->
                <EventThumb seed={event.id} />
              {/if}
            </span>

            <span class="text">
              <span class="title">{event.title}</span>
              <span class="when">{shortDate(event)}</span>
              <span class="meta">
                {#if event.distanceMiles !== undefined}
                  <span class="miles">{event.distanceMiles} MI</span>
                {:else}
                  <!--
                    The reason this row exists. An event with no position cannot
                    be a pin, so the list is the only place it appears at all —
                    and it says why rather than simply lacking a distance.
                  -->
                  <span class="unplaced">NOT ON MAP</span>
                {/if}
                {#if event.venue !== undefined}
                  <span class="venue">{event.venue}</span>
                {/if}
              </span>
            </span>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .list-view {
    display: grid;
    grid-template-rows: 36px minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }

  .sorting {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    border-bottom: var(--divider) solid var(--line);
  }

  .count {
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--c-blue);
  }

  .sorts {
    display: flex;
    margin-left: auto;
  }

  .sort {
    padding: 3px 10px;
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--c-ink);
    background: none;
    border: 2px solid var(--line);
    border-right-width: 0;
    cursor: pointer;
  }

  .sort:last-child {
    border-right-width: 2px;
  }

  .sort.active {
    color: var(--c-bg);
    background: var(--c-ink);
  }

  /*
   * Scrolls, unlike the trend list which is pinned to exactly five rows.
   *
   * The difference is that a trend list is a ranking — the sixth entry is by
   * definition less interesting than the fifth — where this is a catalogue of
   * what is on, and the twelfth event is as real as the first.
   */
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 0;
    padding: 8px;
    overflow-y: auto;
    list-style: none;
    /* The page indicator is overlaid on the panel's last ~34px. */
    padding-bottom: 40px;
  }

  .cards li {
    min-width: 0;
  }

  .card {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 8px;
    width: 100%;
    padding: 6px;
    text-align: left;
    background: none;
    border: 2px solid var(--line);
    cursor: pointer;
  }

  .card.selected {
    background: var(--c-ink);
  }

  .card.selected .title,
  .card.selected .when,
  .card.selected .miles,
  .card.selected .venue,
  .card.selected .unplaced {
    color: var(--c-bg);
  }

  .thumb {
    display: block;
    width: 72px;
    height: 72px;
    overflow: hidden;
    background: var(--c-bg);
    border: 2px solid var(--line);
  }

  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text {
    display: grid;
    align-content: start;
    gap: 3px;
    min-width: 0;
  }

  .title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    font-family: var(--font-pixel);
    font-size: 13px;
    line-height: 1.2;
    color: var(--c-ink);
  }

  .when {
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--c-blue);
  }

  /*
   * `.meta`, not `.foot`. `millennium.css` styles `.foot` — it is the 7-day
   * footer's class — with 44px of padding on each side to clear the corner
   * ornaments, and a card's 13px meta row inheriting 88px of padding loses its
   * venue entirely. The collision is invisible in five themes and only appears
   * in the sixth, which is exactly the failure CLAUDE.md warns about.
   */
  .meta {
    display: flex;
    gap: 6px;
    min-width: 0;
    font-family: var(--font-pixel);
    font-size: 11px;
  }

  .miles {
    flex: 0 0 auto;
    color: var(--c-ink);
  }

  /* Stated in the warning colour, like the Search Pulse strip's own warning. */
  .unplaced {
    flex: 0 0 auto;
    color: var(--c-hot);
  }

  .venue {
    min-width: 0;
    overflow: hidden;
    color: var(--c-sky);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    display: grid;
    place-content: center;
  }

  .lead {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--c-ink);
  }
</style>
