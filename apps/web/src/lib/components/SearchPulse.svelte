<script lang="ts">
  import {
    PULSE_MODES,
    PULSE_VIEWS,
    type PulseMode,
    type PulseView,
  } from '../trend-view';
  import type { BadgeStyle } from '../badge.svelte';
  import type { PulseStatus } from '../trends.svelte';
  import type {
    DashboardPhase,
    TrendHeadlineView,
    TrendCardView,
    TrendDayView,
    TrendDetailView,
    TrendHistoryView,
    TrendRowView,
  } from '../types';
  import Refresh from '../weather-icons/Refresh.svelte';
  import DayList from './DayList.svelte';
  import Sparkline from './Sparkline.svelte';
  import TitleBar from './TitleBar.svelte';
  import TrendCard from './TrendCard.svelte';
  import TrendRow from './TrendRow.svelte';

  interface Props {
    phase: DashboardPhase;
    rows: readonly TrendRowView[];
    status: PulseStatus;
    region: string;
    detail: TrendDetailView | null;
    card: TrendCardView | null;
    history: TrendHistoryView | null;
    day: TrendDayView | null;
    selectedId: string;
    mode: PulseMode;
    view: PulseView;
    /** How the category badge draws itself, from settings. */
    badge: BadgeStyle;
    /** Why badges are missing, or empty when nothing is wrong. */
    categoryWarning: string;
    /** True while a manual refresh is in flight. */
    refreshing: boolean;
    /** Short-lived message about what the last refresh press did. */
    flash: string;
    onrefresh: () => void;
    onview: (view: PulseView) => void;
    onmode: (mode: PulseMode) => void;
    onselect: (id: string) => void;
    /** Opens the record for one of the day's trends, by key. */
    onopenday: (key: string) => void;
    /** Whether the full-screen trend card is showing. Owned by the store. */
    cardOpen: boolean;
    onopencard: () => void;
    onclosecard: () => void;
    onmenu: () => void;
    onhold?: () => void;
    /** Opens the QR code for one of the trend card's headlines. */
    onqr: (headline: TrendHeadlineView) => void;
  }

  let {
    phase,
    rows,
    status,
    region,
    detail,
    card,
    history,
    day,
    selectedId,
    mode,
    view,
    badge,
    categoryWarning,
    refreshing,
    flash,
    onrefresh,
    onview,
    onmode,
    onselect,
    onopenday,
    cardOpen,
    onopencard,
    onclosecard,
    onmenu,
    onhold,
    onqr,
  }: Props = $props();

  /** Movement is only worth a badge when the record actually shows one. */
  const movement = $derived(
    history === null || history.movement === 'steady' ? null : history.movement,
  );

  /**
   * Which of this section's views is showing.
   *
   * A view *inside* Search Pulse, reached by a tap — never a third page beside
   * the weather. A horizontal swipe means "change dashboard section" and has to
   * keep meaning only that, so the card takes over this page rather than
   * joining the carousel.
   *
   * The open flag lives in the store rather than here, because attract mode has
   * to be able to close it: a card left open would still be covering this page
   * when the tour came back round to it.
   */
</script>

{#if cardOpen && card !== null}
  <TrendCard {card} {history} onback={onclosecard} {onqr} />
{:else}
<div class="pulse" class:today={view === 'today'}>
  <TitleBar title="SEARCH PULSE" size={56} dotRows={3} {onmenu} {onhold} />

  <!--
    What this list is and how fresh it is. TODAY answers both differently: its
    freshness is the window it covers and the record behind it, not an age.
  -->
  <div class="region">
    <span class="where">{region}</span>

    <!--
      Only ever drawn when something is actually wrong. Four different causes
      of "no badges" used to look identical from across the room, and the only
      way to tell them apart was a terminal on a machine with no keyboard —
      which is how a rejected API key was reported as the feature being
      inconsistent.
    -->
    {#if categoryWarning !== ''}
      <span class="warn">{categoryWarning}</span>
    {/if}

    <!--
      While a refresh message is up it takes the freshness readout's place
      rather than floating over the panel. A real toast would need a z-index,
      a position and a decision about what it covers on a screen where every
      band is budgeted to the pixel; this needs none of those, and it puts the
      answer exactly where the eye already goes to ask "how current is this".
    -->
    {#if flash !== ''}
      <span class="status">
        <span class="flash">{flash}</span>
      </span>
    {:else if view === 'today'}
      <span class="status-text">{day?.window ?? ''}</span>
      <span class="status">
        <span class="status-text">{day?.scope ?? ''}</span>
      </span>
    {:else}
      <span class="status">
        {#if status.live}
          <span class="lamp"></span>
        {/if}
        <span class="status-text">{status.text}</span>
      </span>
    {/if}

    <!--
      The feed only turns over every ten to twenty minutes and the backend
      caches it for ten, so most of the time this returns the same list. It
      exists for the times that is too long to wait, and it is the same pixel
      glyph the weather footer already uses for the same job.

      The backend enforces its own floor on how often a press reaches Google,
      because the feed is unauthenticated and rate-limited by IP — a button on
      a touchscreen is exactly what would abuse it.
    -->
    <button
      class="refresh"
      type="button"
      onclick={onrefresh}
      disabled={refreshing}
      aria-label={refreshing ? 'Refreshing trends' : 'Refresh trends now'}
    >
      <Refresh />
    </button>
  </div>

  <!--
    Which list, and how it is ordered — the two controls that shape what the
    band below shows, kept together and both always visible. On a wall display
    there is no hover and no menu, so a view or an ordering you cannot see is
    one nobody knows exists. TODAY has a single ordering fixed by a stored
    rule, so its slot states that ordering rather than offering a choice.
  -->
  <div class="views">
    <nav class="modes" aria-label="Search Pulse view">
      {#each PULSE_VIEWS as option (option.id)}
        <button
          class="mode"
          class:active={option.id === view}
          type="button"
          aria-pressed={option.id === view}
          onclick={() => onview(option.id)}
        >
          {option.name}
        </button>
      {/each}
    </nav>

    {#if view === 'today'}
      <!--
        The framing is load-bearing, not a caption. Our record holds each trend
        with the volume it carried while young and on the feed; a search that
        went on to be far bigger had already dropped out of the ten slots hours
        before. So this is what caught fire today, which is a different list
        from the day's biggest searches, and the band has to say which one.
      -->
      <span class="note">CAUGHT FIRE · BY PEAK VOLUME</span>
    {:else}
      <nav class="modes" aria-label="List ordering">
        {#each PULSE_MODES as option (option.id)}
          <button
            class="mode"
            class:active={option.id === mode}
            type="button"
            aria-pressed={option.id === mode}
            onclick={() => onmode(option.id)}
          >
            {option.name}
          </button>
        {/each}
      </nav>
    {/if}
  </div>

  {#if view === 'today'}
    <div class="day-band">
      {#if day === null}
        <div class="empty">
          <p class="lead">READING TODAY'S RECORD…</p>
        </div>
      {:else if day.rows.length === 0}
        <!--
          The honest empty state for a Pi switched on this morning, or one
          whose history store could not be opened. It says nothing was
          recorded, which is a fact about us, not about what people searched.
        -->
        <div class="empty">
          <p class="lead">NOTHING RECORDED YET TODAY.</p>
        </div>
      {:else}
        <DayList
          rows={day.rows}
          {badge}
          axisStart={day.axisStart}
          axisEnd={day.axisEnd}
          marks={day.marks}
          onopen={onopenday}
        />
      {/if}
    </div>
  {:else}

  <!--
    Three ways this band can read, and only the last one shows numbers: still
    loading, nothing ever loaded, or a list. A failed poll that still has a
    list falls through to the list — the region strip above says it is cached,
    which is truer than an error page over data we are still holding.
  -->
  {#if rows.length > 0}
    <ol class="trends">
      {#each rows as row (row.id)}
        <TrendRow {...row} selected={row.id === selectedId} {badge} {onselect} />
      {/each}
    </ol>
  {:else}
    <div class="empty">
      <p class="lead">
        {phase === 'loading'
          ? 'LOADING SEARCH ACTIVITY…'
          : 'SEARCH TRENDS ARE TEMPORARILY UNAVAILABLE.'}
      </p>
    </div>
  {/if}

  <!--
    Whatever the feed stated about the selected trend, and nothing else. Each
    field disappears rather than showing a dash or a guess when Google did not
    supply it, so the panel is never padded out with placeholder rows.
  -->
  <div class="details">
    <!--
      The whole band opens the card, not a widget inside it — the band is
      already the thing describing the selected trend, and a finger on a wall
      display wants the biggest target available. It sits over the text rather
      than wrapping it so the definition list below stays a definition list.
    -->
    {#if detail !== null}
      <button
        class="open"
        type="button"
        aria-label="Open trend card"
        onclick={onopencard}
      ></button>
    {/if}

    <div class="details-head">
      <h2 class="details-heading">TREND DETAILS</h2>
      {#if detail?.isNew}
        <span class="badge">NEW</span>
      {/if}
      {#if movement !== null}
        <span class="badge movement">{movement === 'rising' ? 'RISING' : 'COOLING'}</span>
      {/if}

      <!--
        There is no hover on this panel and no menu, so a view nobody can see
        is a view nobody knows exists. The button above carries the accessible
        name; this is the part a finger can see.
      -->
      {#if detail !== null}
        <span class="hint" aria-hidden="true">
          CARD
          <svg class="chev" viewBox="0 0 12 12" width="24" height="24" shape-rendering="crispEdges">
            <polygon points="7,1 7,11 12,6" />
            <rect x="0" y="5" width="7" height="2" />
          </svg>
        </span>
      {/if}
    </div>

    {#if detail === null}
      <p class="details-note">NO TREND SELECTED.</p>
    {:else}
      <div class="split">
        <dl class="facts">
          <dt>SEARCH</dt>
          <dd class="search">{detail.title}</dd>

          {#if detail.volume !== ''}
            <dt>VOLUME</dt>
            <dd>{detail.volume} <span class="qualifier">APPROX</span></dd>
          {/if}

          {#if detail.firstReported !== ''}
            <dt>REPORTED</dt>
            <dd>{detail.firstReported} <span class="qualifier">{detail.age}</span></dd>
          {/if}

          <!--
            Ours, not Google's: when this Pi first recorded the trend and how
            many times it has seen it since.
          -->
          <!--
            Ours, not Google's: when this Pi first recorded the trend, and on
            its own row how many fetches it has appeared in — the two together
            outran the column and clipped.
          -->
          {#if history !== null && history.firstSeen !== ''}
            <dt>SEEN</dt>
            <dd>{history.firstSeen}</dd>
          {/if}

          {#if history !== null && history.observed !== ''}
            <dt>FETCHES</dt>
            <dd>{history.observed}</dd>
          {/if}
        </dl>

        <div class="graph">
          <p class="graph-label">
            RANK{history?.sparkline == null ? '' : ` · LAST ${history.sparkline.windowLabel}`}
          </p>

          {#if history?.sparkline != null}
            <!--
              The plot is framed rather than self-labelling: rank numbers down
              the left, and both ends of the time axis named underneath, so
              nothing about the scale has to be inferred from the heading.
            -->
            <div class="frame">
              <div class="ranks">
                <span>{history.sparkline.topLabel}</span>
                <span>{history.sparkline.bottomLabel}</span>
              </div>
              <div class="plot"><Sparkline {...history.sparkline} /></div>
              <div class="times">
                <span>{history.sparkline.startLabel}</span>
                <span>{history.sparkline.endLabel}</span>
              </div>
            </div>

            <p class="graph-foot">
              PEAK {history.peakRank} · NOW {history.latestRank}
            </p>
          {:else}
            <p class="graph-empty">NO HISTORY RECORDED YET.</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  {/if}
</div>
{/if}

<style>
  /*
   * Four bands in fixed pixels adding up to the 704 inside the frame. The
   * trend list takes what the other three leave.
   *
   * Title above region, which is the reverse of the weather screens: they lead
   * with a status strip, and this screen leads with its name. That is the
   * order the design calls for, and it is what puts the freshness figure and
   * the LIVE lamp on the two rows that later have to carry them.
   */
  /*
   * The details band grew to take the graph, and the trend rows gave up the
   * room — five rows at 67px rather than 82px. That is the trade the design
   * makes: the list still ranks at a glance, and the selected trend now has
   * somewhere to show its history.
   */
  /*
   * Five bands on NOW, four on TODAY, both adding up to the 704 inside the
   * frame. The list takes whatever the fixed bands leave.
   *
   * The 44px view band was paid for out of the trend list, measured rather than
   * guessed: a row needs 48px for its text line and bar, and had 66px. At 288px
   * for five rows they sit at 57.6px, which still clears the content by nearly
   * ten. TODAY has no details band, so its ten rows get the whole 500px.
   */
  .pulse {
    display: grid;
    grid-template-rows: 96px 64px 44px minmax(0, 1fr) 212px;
    width: 100%;
    height: 100%;
  }

  .pulse.today {
    grid-template-rows: 96px 64px 44px minmax(0, 1fr);
  }

  .region {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 24px;
    overflow: hidden;
    border-bottom: var(--divider) solid var(--line);
  }

  /*
   * Deliberately loud. It is the one thing on this screen that means "go and
   * do something", and it appears so rarely that it should not be missable
   * when it does. `hot` is the same token the NEW badge and the live lamp use.
   */
  .warn {
    flex: 0 0 auto;
    padding: 2px 8px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 2px;
    white-space: nowrap;
    color: var(--c-bg);
    background: var(--c-hot);
  }

  .where {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 2px;
    white-space: nowrap;
    color: var(--c-ink);
  }

  /*
   * Which list on the left, how it is ordered on the right. Both controls
   * shape the band underneath, so they belong together and away from the
   * region strip, which only ever describes what is being shown.
   */
  .views {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 24px;
    overflow: hidden;
    border-bottom: var(--divider) solid var(--line);
  }

  /*
   * Inverted rather than merely coloured. It is transient, so it has one
   * moment to be noticed, and on a wall display a colour change alone is easy
   * to miss at four feet.
   */
  .flash {
    padding: 3px 10px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 2px;
    white-space: nowrap;
    color: var(--c-bg);
    background: var(--c-ink);
  }

  /*
   * 44px square, which is the touch-target floor, inside a 64px band. The
   * sprite is 32px and draws itself, so this is a frame around it rather than
   * a button with a label.
   */
  .refresh {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    padding: 0;
    color: var(--c-blue);
    background: var(--c-bg);
    border: 2px solid var(--c-blue);
    cursor: pointer;
  }

  /* Flat design: a press swaps the fill rather than moving anything. */
  .refresh:active:not(:disabled) {
    background: var(--c-ink);
    color: var(--c-bg);
  }

  .refresh:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* Where the ordering chips would be, naming the ordering TODAY fixes. */
  .note {
    font-size: 15px;
    letter-spacing: 2px;
    white-space: nowrap;
    color: var(--c-blue);
  }

  /* The page indicator's lane, which the details band reserves on the NOW view. */
  .day-band {
    display: grid;
    min-height: 0;
    padding-bottom: 28px;
  }

  /* Last band on the screen, so there is nothing below to divide it from. */
  .day-band .empty {
    border-bottom: 0;
  }

  .modes {
    display: flex;
    flex: 0 0 auto;
    gap: 6px;
  }

  /* Inverts when active, like every other chosen thing in this design. */
  .mode {
    padding: 5px 10px;
    font: inherit;
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-blue);
    background: var(--c-bg);
    border: 2px solid var(--c-blue);
    cursor: pointer;
  }

  .mode.active {
    color: var(--c-bg);
    background: var(--c-ink);
    border-color: var(--c-ink);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  /* Square, like every other mark in this design. Lit only when truly current. */
  .lamp {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    background: var(--c-hot);
  }

  .status-text {
    font-size: 16px;
    letter-spacing: 2px;
    white-space: nowrap;
    overflow: hidden;
    color: var(--c-blue);
  }

  /*
   * Equal rows, so five trends divide the band evenly and a short list still
   * fills it rather than stacking at the top.
   */
  .trends {
    display: grid;
    grid-auto-rows: 1fr;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border-bottom: var(--divider) solid var(--line);
  }

  .empty {
    display: grid;
    align-content: center;
    justify-items: center;
    min-height: 0;
    padding: 0 24px;
    border-bottom: var(--divider) solid var(--line);
  }

  .lead {
    margin: 0;
    font-size: 24px;
    letter-spacing: 3px;
    text-align: center;
    color: var(--c-blue);
  }

  /*
   * The bottom padding is the page indicator's lane. Unlike the weather
   * screens, whose last band has slack the dots can sit in, this one is dense
   * enough to run a line of text straight under them.
   */
  .details {
    /* Anchors the full-band button that opens the card. */
    position: relative;
    display: grid;
    align-content: center;
    gap: 10px;
    min-height: 0;
    padding: 0 24px 28px;
  }

  /*
   * Transparent and the size of the band. No z-index: a positioned element
   * already hit-tests above the in-flow text beneath it, and staying out of
   * the z-index ladder keeps the page indicator and the settings overlay —
   * both later in the document — above it where they belong.
   */
  .open {
    position: absolute;
    inset: 0;
    padding: 0;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .details-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    font-size: 15px;
    letter-spacing: 3px;
    color: var(--c-blue);
  }

  /* Drawn, not typed — the same whole-pixel geometry as the sprites. */
  .chev {
    fill: var(--c-blue);
  }

  .details:active .hint,
  .details:active .chev {
    color: var(--c-hot);
    fill: var(--c-hot);
  }

  .details-heading {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-blue);
  }

  /*
   * The one label on the screen we assign ourselves, so it says exactly what
   * it means: Google first reported this search under 30 minutes ago.
   */
  .badge {
    padding: 2px 8px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 3px;
    color: var(--c-bg);
    background: var(--c-hot);
  }

  .details-note {
    margin: 0;
    font-size: 18px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  /* Facts on the left, the record's own graph on the right. */
  .split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 268px;
    gap: 20px;
    min-height: 0;
  }

  /*
   * A real definition list: a screen reader announces "search, does
   * sheepstealer die" rather than two loose strings. `display: grid` on the
   * list puts the dt/dd pairs into columns.
   */
  .facts {
    display: grid;
    grid-template-columns: 104px minmax(0, 1fr);
    align-content: center;
    align-items: baseline;
    gap: 4px 12px;
    margin: 0;
    min-width: 0;
  }

  /* Enough gap that the plot's top rule does not read as underlining the heading. */
  .graph {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 6px;
    min-height: 0;
  }

  .graph-label,
  .graph-foot,
  .graph-empty {
    margin: 0;
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .graph-foot {
    text-align: right;
  }

  .graph-empty {
    align-self: center;
  }

  /* Rank gutter beside the plot, time labels beneath it. */
  .frame {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    column-gap: 6px;
    min-height: 0;
  }

  .plot {
    grid-column: 2;
    min-height: 0;
  }

  /*
   * Sits against the plot's own top and bottom, which is where ranks 1 and 10
   * actually are — the axis is fixed, so the labels can be too.
   */
  .ranks {
    grid-column: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 13px;
    line-height: 1;
    color: var(--c-blue);
  }

  .times {
    grid-column: 2;
    display: flex;
    justify-content: space-between;
    padding-top: 3px;
    font-size: 13px;
    letter-spacing: 1px;
    color: var(--c-blue);
  }

  .facts dt {
    font-size: 16px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .facts dd {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 20px;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  /*
   * The one value allowed to wrap. Naming the selected search is what this
   * panel is for, so clipping it to "BRYAN KOHBERGER MO…" defeats the band;
   * the other fields are short and stay on one line.
   */
  /* `.facts dd` also matches this element and outranks a bare class. */
  .facts dd.search {
    font-weight: 700;
    white-space: normal;
    overflow: visible;
    overflow-wrap: anywhere;
    line-height: 1.1;
  }

  /*
   * "APPROX" is not decoration. Google's figure is the floor of a bucket, and
   * the screen has to keep saying so wherever it prints one.
   */
  .qualifier {
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }
</style>
