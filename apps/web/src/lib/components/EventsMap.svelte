<script lang="ts">
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  import {
    EVENT_FILTERS,
    EVENT_VIEWS,
    type EventFilter,
    type EventSort,
    type EventView,
  } from '../events.svelte';
  import type { DashboardFailure, DashboardPhase, EventsSnapshot, LocalEvent } from '../types';
  import EventList from './EventList.svelte';
  import EventSheet from './EventSheet.svelte';
  import TitleBar from './TitleBar.svelte';

  interface Props {
    phase: DashboardPhase;
    snapshot: EventsSnapshot | null;
    failure: DashboardFailure | null;
    events: readonly LocalEvent[];
    pins: readonly LocalEvent[];
    unpinned: number;
    isMock: boolean;
    filter: EventFilter;
    view: EventView;
    sort: EventSort;
    /** Every visible event in the list's order, pinned or not. */
    ordered: readonly LocalEvent[];
    selected: LocalEvent | null;
    onfilter: (filter: EventFilter) => void;
    onview: (view: EventView) => void;
    onsort: (sort: EventSort) => void;
    onshowunplaced: () => void;
    onselect: (id: string) => void;
    onclose: () => void;
    onmenu: () => void;
    onhold?: () => void;
  }

  let {
    phase,
    snapshot,
    failure,
    events,
    pins,
    unpinned,
    isMock,
    filter,
    view,
    sort,
    ordered,
    selected,
    onfilter,
    onview,
    onsort,
    onshowunplaced,
    onselect,
    onclose,
    onmenu,
    onhold,
  }: Props = $props();

  /**
   * The tile key, and the only piece of this feature that reaches the browser.
   *
   * Public by construction — the browser fetches tiles directly, so there is no
   * arrangement in which this stays secret. `SERPAPI_KEY` and the geocoding key
   * are backend-only and never appear here.
   */
  const TILE_KEY = import.meta.env['VITE_MAPTILER_KEY'] ?? '';

  /**
   * Toner: stark black-and-white line work, no photography, no colour of its
   * own. Chosen because every other pixel on this panel is flat six-colour
   * artwork, and a conventional street map dropped into it reads as a
   * photograph pasted into a painting. Being colourless is what lets one style
   * serve all six themes through a CSS filter.
   *
   * **256px tiles, and `detectRetina` stays off.** MapTiler bills a rendered
   * raster 512 tile — including HiDPI — as four requests against a 256 tile's
   * one, and the HyperPixel is 720x720 at a device pixel ratio of 1, so the
   * larger tile would cost four times as much and show nothing extra.
   */
  const TILE_URL = `https://api.maptiler.com/maps/toner-v2/256/{z}/{x}/{y}.png?key=${TILE_KEY}`;

  let host: HTMLDivElement | undefined = $state();
  let map: L.Map | undefined;
  let markerLayer: L.LayerGroup | undefined;
  let tilesFailed = $state(false);

  /** Marker objects by event id, so a selection can restyle one without a redraw. */
  const markers = new Map<string, L.Marker>();

  const hasKey = TILE_KEY !== '';

  /**
   * A square, in the panel's own colours, rather than Leaflet's teardrop PNG.
   *
   * Two reasons. Leaflet's default icon is a bundled image whose path does not
   * survive a Vite build without extra wiring, and it is a glossy drop-shadowed
   * pin that belongs to a different design language entirely. A `divIcon` is an
   * ordinary element, so it themes with everything else.
   */
  function pinIcon(active: boolean): L.DivIcon {
    return L.divIcon({
      className: 'pin-wrap',
      html: `<span class="pin${active ? ' active' : ''}"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  onMount(() => {
    if (host === undefined || !hasKey) return;

    /*
     * Created once, here, and never destroyed. The carousel keeps every page
     * mounted, so this survives swipes and attract mode alike — which is not
     * merely an optimisation. A map torn down and rebuilt on every visit would
     * re-request its tiles, and attract mode reaches this page roughly every 25
     * seconds; that is ~17,000 tile requests a day against a 100,000-a-month
     * allowance, and MapTiler suspends a free plan for the rest of the month
     * when it is exceeded. Reused, it costs nothing after the first paint.
     */
    map = L.map(host, {
      center: [37.3382, -121.8863],
      zoom: 11,
      // A 720px panel has no room for chrome, and the zoom control is a
      // 26px target no finger wants. Pinch and drag still work.
      zoomControl: false,
      attributionControl: true,
      // Nothing here scrolls a page, and a stray wheel event on a kiosk
      // should not zoom the map out to the ocean.
      scrollWheelZoom: false,
    });

    const tiles = L.tileLayer(TILE_URL, {
      tileSize: 256,
      detectRetina: false,
      minZoom: 8,
      maxZoom: 16,
      // Required by the licence, and not ours to drop.
      attribution:
        '<a href="https://www.maptiler.com/copyright/">MapTiler</a> · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    /*
     * A tile error is not a broken page. MapTiler pauses a free plan that goes
     * over quota, and a blank grey square with no explanation is a much worse
     * outcome than a list — so the basemap is allowed to fail and the page says
     * so and carries on.
     */
    tiles.on('tileerror', () => {
      tilesFailed = true;
    });

    tiles.addTo(map);
    markerLayer = L.layerGroup().addTo(map);

    /*
     * The carousel hides this page by scrolling it out of view, and Leaflet
     * sizes itself against a container that was 0x0 when the map was built.
     * Watching for visibility is what makes the first swipe here show a map
     * rather than a grey rectangle, and it works for attract mode's navigation
     * without the tour having to know this page exists.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            map?.invalidateSize();
            /*
             * Framed on the next frame, not this one. `invalidateSize` updates
             * Leaflet's idea of the container, but fitting bounds against it in
             * the same tick uses the size it had a moment ago — which, the
             * first time this page is reached, is the 0x0 it was built at. The
             * symptom is pins sitting half off the bottom edge.
             */
            requestAnimationFrame(() => frame());
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(host);

    draw();
    frame();

    return () => {
      observer.disconnect();
      // Deliberately not destroying the map: see the comment above. The page
      // only unmounts when the whole app does.
    };
  });

  /**
   * The set of pins currently framed, so the view is only re-fitted when the
   * pins actually change.
   *
   * Without this, every five-minute poll would yank the map back to the default
   * framing and undo whatever a person had panned to — a wall display that
   * quietly resets itself under your hand.
   */
  let framedFor = '';

  /*
   * Coming back from the list, the map's container was `visibility: hidden` and
   * may have been resized underneath it. `invalidateSize` is cheap and idempotent,
   * and skipping it leaves Leaflet drawing against a stale viewport — the same
   * grey-rectangle failure the IntersectionObserver exists to prevent, reached by
   * a different route.
   */
  $effect(() => {
    if (view !== 'map') return;
    requestAnimationFrame(() => map?.invalidateSize());
  });

  /** Redraws markers whenever the visible set or the selection changes. */
  $effect(() => {
    const signature = pins.map((event) => event.id).join('|');
    // Referenced so the effect re-runs when the selection changes too.
    void selected;

    draw();

    if (signature !== framedFor) {
      framedFor = signature;
      frame();
    }
  });

  function draw(): void {
    if (markerLayer === undefined) return;

    markerLayer.clearLayers();
    markers.clear();

    for (const event of pins) {
      const position = event.coordinates;
      if (position === undefined) continue;

      const marker = L.marker([position.latitude, position.longitude], {
        icon: pinIcon(event.id === selected?.id),
        keyboard: false,
        title: event.title,
      });
      marker.on('click', () => onselect(event.id));
      marker.addTo(markerLayer);
      markers.set(event.id, marker);
    }
  }

  /**
   * Frames whatever is on screen, rather than sitting on a fixed zoom.
   *
   * Most events cluster downtown and a few sit ten miles out, so a fixed zoom
   * is either too tight for the outliers or too loose for the cluster.
   * `maxZoom` stops a single pin filling the panel with one street.
   */
  function frame(): void {
    if (map === undefined) return;

    const positions = pins
      .map((event) => event.coordinates)
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map((c) => [c.latitude, c.longitude] as [number, number]);

    if (positions.length === 0) {
      map.setView([37.3382, -121.8863], 11);
      return;
    }
    /*
     * Generous padding: a marker is anchored at its centre, so `fitBounds` will
     * happily put an edge pin's outer half past the edge. 48 clears the 22px
     * icon and leaves the attribution strip somewhere to sit.
     */
    map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 13 });
  }

  /** The one-line status under the title. */
  const statusLine = $derived.by(() => {
    if (phase === 'loading') return 'LOADING EVENTS…';
    if (phase === 'error') return failure?.message ?? 'EVENTS UNAVAILABLE';
    /*
     * The empty message has to name the filter that produced it. "NOTHING ON
     * THIS WEEK" under an active TODAY button reads as a broken screen rather
     * than as an empty day, and the two are genuinely different facts.
     */
    if (events.length === 0) {
      return filter === 'today' ? 'NOTHING ON TODAY' : 'NOTHING ON THIS WEEK';
    }

    const shown = `${pins.length} ON MAP`;
    return unpinned > 0 ? `${shown} · ${unpinned} NOT PLACED` : shown;
  });
</script>

<div class="events">
  <TitleBar title="EVENTS" size={56} dotRows={3} {onmenu} {onhold} />

  <div class="strip">
    <span class="where">{snapshot?.center.name ?? 'SAN JOSE'}</span>

    <!--
      Fabricated data has to say so, in the same place a person already looks
      to ask how current this is. A wall display showing invented events as
      real is the one failure this page must not have — so the marker sits in
      the strip permanently, not in a tooltip and not only in a log.
    -->
    {#if isMock}
      <span class="mock">MOCK DATA</span>
    {/if}

    {#if failure !== null && snapshot !== null}
      <span class="warn">CACHED</span>
    {/if}

    <!--
      The unplaced count is a control, not a readout. An event with no position
      cannot be a pin, so without a way through to the list this number is the
      whole of what a person can ever learn about it — which is most of the way
      to having dropped it.
    -->
    {#if unpinned > 0 && phase === 'ready'}
      <span class="status">
        <span class="shown">{pins.length} ON MAP</span>
        <button class="unplaced" type="button" onclick={onshowunplaced}>
          {unpinned} NOT PLACED
        </button>
      </span>
    {:else}
      <span class="status">{statusLine}</span>
    {/if}
  </div>

  <!--
    Two nav groups in one 44px band, which is the arrangement Search Pulse
    already uses for its view and ordering controls. On a wall display there is
    no hover and no menu, so a control you cannot see is one nobody knows about.
  -->
  <div class="bands">
    <nav class="filters" aria-label="Event range">
      {#each EVENT_FILTERS as option (option.id)}
        <button
          class="filter"
          class:active={option.id === filter}
          type="button"
          aria-pressed={option.id === filter}
          onclick={() => onfilter(option.id)}
        >
          {option.name}
        </button>
      {/each}
    </nav>

    <nav class="filters view-switch" aria-label="Event view">
      {#each EVENT_VIEWS as option (option.id)}
        <button
          class="filter"
          class:active={option.id === view}
          type="button"
          aria-pressed={option.id === view}
          onclick={() => onview(option.id)}
        >
          {option.name}
        </button>
      {/each}
    </nav>
  </div>

  <div class="band">
    {#if view === 'list'}
      <EventList events={ordered} {sort} selectedId={selected?.id ?? null} {onsort} {onselect} />
    {/if}

    {#if view === 'map' && !hasKey}
      <!--
        No key is a configuration state, not a fault, and it says which one.
        The events themselves are unaffected — only the basemap is missing.
      -->
      <div class="fallback">
        <p class="lead">NO MAP KEY SET</p>
        <p class="hint">VITE_MAPTILER_KEY IS EMPTY</p>
      </div>
    {:else if view === 'map' && tilesFailed}
      <div class="fallback">
        <p class="lead">MAP TILES UNAVAILABLE</p>
        <p class="hint">SWITCH TO LIST TO SEE EVENTS</p>
      </div>
    {/if}

    <!--
      Hidden rather than unmounted when the list is showing.

      Destroying the map to show a list would mean rebuilding it — and
      re-requesting every tile — each time someone flips between the two. That
      is the same reasoning that keeps the map alive across carousel pages, and
      switching views is a far more frequent action than switching pages.
    -->
    <div
      class="map"
      class:hidden={!hasKey || tilesFailed || view === 'list'}
      bind:this={host}
    ></div>

    {#if selected !== null}
      <EventSheet event={selected} {onclose} />
    {/if}
  </div>
</div>

<style>
  /*
   * Four bands to the same 704 the other pages use: title, strip, filters, and
   * the map takes what is left. The numbers match Search Pulse deliberately —
   * the two content pages should not disagree about where their headings sit.
   */
  .events {
    display: grid;
    grid-template-rows: 96px 64px 44px minmax(0, 1fr);
    width: 100%;
    height: 100%;
  }

  .strip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    border-bottom: var(--divider) solid var(--line);
  }

  .where {
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--c-ink);
  }

  /*
   * Reversed out rather than merely coloured. Six themes make colour alone
   * unreliable — `dmg-green` renders blue and hot as the same hex — and this
   * badge is the one thing on the page that must read in all of them.
   */
  .mock {
    padding: 3px 6px;
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--c-bg);
    background: var(--c-ink);
  }

  .warn {
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--c-hot);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    font-family: var(--font-pixel);
    font-size: 13px;
    color: var(--c-blue);
  }

  .shown {
    color: var(--c-blue);
  }

  /*
   * Underlined rather than merely coloured. Six themes make colour alone an
   * unreliable way to say "this is tappable" — in `dmg-green` the warning and
   * accent tokens are the same hex — and this is the only control on the page
   * that does not look like a button already.
   */
  .unplaced {
    padding: 0;
    font-family: var(--font-pixel);
    font-size: 13px;
    color: var(--c-hot);
    text-decoration: underline;
    text-underline-offset: 3px;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .bands {
    display: grid;
    grid-template-columns: 1fr auto;
    border-bottom: var(--divider) solid var(--line);
  }

  .filters {
    display: flex;
  }

  /*
   * `.view-switch`, not `.views`. `millennium.css` gives `.views` an inset
   * stone channel and 14px of padding, which is right for Search Pulse's
   * full-width view band and wrong for a two-button nav sitting inside another
   * band. Same class-name contract as `.foot` above.
   */
  .view-switch {
    border-left: var(--divider) solid var(--line);
  }

  .view-switch .filter {
    flex: 0 0 auto;
    padding: 0 18px;
  }

  .filter {
    flex: 1;
    font-family: var(--font-pixel);
    font-size: 14px;
    color: var(--c-ink);
    background: none;
    border: 0;
    border-right: var(--divider) solid var(--line);
    cursor: pointer;
  }

  .filter:last-child {
    border-right: 0;
  }

  /* Flat design, so the active filter fills in rather than growing a rule. */
  .filter.active {
    color: var(--c-bg);
    background: var(--c-ink);
  }

  .band {
    position: relative;
    overflow: hidden;
  }

  .map {
    width: 100%;
    height: 100%;
    background: var(--c-bg);
  }

  .map.hidden {
    visibility: hidden;
  }

  .fallback {
    position: absolute;
    inset: 0;
    z-index: 300;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 8px;
    background: var(--c-bg);
  }

  .lead {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--c-ink);
  }

  .hint {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: 13px;
    color: var(--c-blue);
  }

  /*
   * The tile imagery, recoloured to the active theme.
   *
   * One greyscale style plus a filter, rather than six hand-authored MapTiler
   * styles: no extra tile requests, nothing to re-fetch when the theme changes,
   * and one thing to maintain instead of six. `--map-filter` is defined per
   * theme in app.css.
   *
   * `:global` because these elements are Leaflet's, created outside Svelte's
   * compiler and therefore carrying none of its scoping attributes.
   */
  .map :global(.leaflet-tile-pane) {
    filter: var(--map-filter);
  }

  .map :global(.leaflet-container) {
    background: var(--c-bg);
    font-family: var(--font-pixel);
  }

  /* Leaflet's own chrome, brought into the panel's palette. */
  .map :global(.leaflet-control-attribution) {
    padding: 1px 5px;
    font-size: 9px;
    color: var(--c-ink);
    background: var(--c-bg);
  }

  .map :global(.leaflet-control-attribution a) {
    color: var(--c-blue);
  }

  /*
   * A flat square with a hard outline — the same visual grammar as the page
   * indicator's dots and the badge above. No shadow, no gradient, no radius.
   */
  .map :global(.pin) {
    display: block;
    width: 16px;
    height: 16px;
    margin: 3px;
    background: var(--c-bg);
    border: 3px solid var(--c-blue);
  }

  .map :global(.pin.active) {
    background: var(--c-ink);
    border-color: var(--c-ink);
  }
</style>
