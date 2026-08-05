<script lang="ts">
  import type { TrendDayDetailView, TrendHeadlineView } from '../types';
  import Sparkline from './Sparkline.svelte';

  interface Props {
    detail: TrendDayDetailView;
    onclose: () => void;
    /** Opens the QR code for a headline. Only called when it has a URL. */
    onqr: (headline: TrendHeadlineView) => void;
  }

  let { detail, onclose, onqr }: Props = $props();

  let dialog: HTMLDivElement | undefined = $state();

  /** The panel takes focus on open so Escape and Tab land somewhere sensible. */
  $effect(() => {
    dialog?.focus();
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onclose();
  }
</script>

<svelte:window {onkeydown} />

<!--
  Deliberately the settings dialog's markup, class name for class name:
  `.backdrop`, `.scrim`, `.panel`, `.head`, `.heading`, `.close`, `.body`.
  Themes reach these by name — `millennium` hangs its hieroglyph border-image
  and its gold Cinzel heading off `.panel` and `.panel .heading` — so matching
  the structure is what makes a second dialog inherit the first one's frame
  instead of needing its own copy of it.
-->
<div class="backdrop">
  <!-- A real button rather than a click handler on the scrim div, so tapping
       outside to dismiss is reachable and announced like any other control. -->
  <button class="scrim" type="button" tabindex="-1" aria-label="Close trend record" onclick={onclose}
  ></button>

  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label="Trend record"
    tabindex="-1"
    bind:this={dialog}
  >
    <header class="head">
      <h2 class="heading">RECORD</h2>
      <button class="close" type="button" onclick={onclose} aria-label="Close trend record">
        ×
      </button>
    </header>

    <div class="body">
      <p class="search">{detail.title}</p>

      <!--
        Everything here was counted from rows this machine wrote. `PEAK` and
        `APPROX` both stay: the figure is the largest bucket Google published
        while the trend was on the feed, which is neither a total for the day
        nor a count of searches.
      -->
      <dl class="facts">
        {#if detail.volume !== ''}
          <dt>PEAK</dt>
          <dd>{detail.volume} <span class="qualifier">APPROX</span></dd>
        {/if}

        {#if detail.ran !== ''}
          <dt>ON FEED</dt>
          <dd>
            {detail.ran}
            {#if detail.duration !== ''}
              <span class="qualifier">{detail.duration}</span>
            {/if}
          </dd>
        {/if}

        <dt>FETCHES</dt>
        <dd>{detail.fetches} <span class="qualifier">TODAY</span></dd>

        <dt>BEST RANK</dt>
        <dd>{detail.bestRank} <span class="qualifier">BY VOLUME</span></dd>

        <!--
          All-time and ours. It is here because a trend that started last night
          lists more observations below than the day's fetch count above, and
          without this the two look like they disagree.
        -->
        <!--
          Google's clock, then ours, in that order. They answer different
          questions and the gap between them is real: we meet a trend whenever
          we next poll, which runs about a quarter of an hour behind in steady
          state and hours behind after any gap in collection. Absent on trends
          whose rows all predate the column, rather than filled in.
        -->
        {#if detail.reported !== ''}
          <dt>REPORTED</dt>
          <dd>{detail.reported} <span class="qualifier">GOOGLE</span></dd>
        {/if}

        {#if detail.firstSeen !== ''}
          <dt>FIRST SEEN</dt>
          <dd>{detail.firstSeen} <span class="qualifier">OURS</span></dd>
        {/if}
      </dl>

      <!--
        Two lines on one time axis, because they answer different questions.
        Volume is how big the search got; rank is how big it was against
        everything else trending at that moment. A search can hold its bucket
        while sliding down the ranking because bigger things arrived, and only
        the pair shows that.
      -->
      {#if detail.volumePlot !== null || detail.rankPlot !== null}
        <section class="group">
          {#if detail.volumePlot !== null}
            <h3 class="group-heading">VOLUME <span class="qualifier">APPROX</span></h3>
            <div class="frame">
              <div class="gutter">
                <span>{detail.volumePlot.topLabel}</span>
                <span>{detail.volumePlot.bottomLabel}</span>
              </div>
              <div class="plot">
                <Sparkline {...detail.volumePlot} label="Volume over time" />
              </div>
            </div>
          {/if}

          {#if detail.rankPlot !== null}
            <h3 class="group-heading rank-heading">RANK <span class="qualifier">OF TEN</span></h3>
            <div class="frame">
              <div class="gutter">
                <span>{detail.rankPlot.topLabel}</span>
                <span>{detail.rankPlot.bottomLabel}</span>
              </div>
              <div class="plot">
                <Sparkline {...detail.rankPlot} label="Rank over time" />
              </div>
            </div>
          {/if}

          <!-- Named once: both lines are drawn over the same span. -->
          <p class="axis">
            <span>{detail.rankPlot?.startLabel ?? detail.volumePlot?.startLabel ?? ''}</span>
            <span>{detail.rankPlot?.endLabel ?? detail.volumePlot?.endLabel ?? ''}</span>
          </p>
        </section>
      {/if}

      <!--
        What the feed said the search was about, recorded at the time.
        All of them, in the feed's order: sampled against the live feed, four
        of five trends returned three headlines about one event while a broad
        query like `artificial intelligence news` returned three unrelated
        stories — so picking the first would assert the trend was about that
        story when it was about a third of it. Where they agree you learn the
        event; where they diverge you learn the query is broad.

        The article is outlet and domain as plain text, never a link. A tap on
        a wall-mounted kiosk navigates away with no way back.
      -->
      {#if detail.headlines.length > 0}
        <section class="group">
          <h3 class="group-heading">WHAT IT WAS ABOUT</h3>
          <!--
            Deliberately the trend card's own structure and class names —
            `figure.quote`, `blockquote.text`, `figcaption.attrib`, `.sep`. The
            same reasoning as the dialog frame: `millennium` gives `.quote` a
            plaque, so matching the markup gets it here too. It also inherits
            the `text-transform: none` the card needs and the reason for it.
          -->
          <ul class="headlines">
            {#each detail.headlines as headline (headline.key)}
              <li>
                <!--
                  Interactive on the figure, not wrapped in a button: a button
                  may only hold phrasing content, and the figure/blockquote/
                  figcaption markup is load-bearing here — it is what says the
                  headline is quoted verbatim with its source named.
                -->
                <figure class="quote" class:tappable={headline.url !== ''}>
                  <blockquote class="text">{headline.text}</blockquote>
                  {#if headline.source !== '' || headline.host !== ''}
                    <figcaption class="attrib">{headline.source}{#if headline.source !== '' && headline.host !== ''}<span class="sep">·</span>{/if}{headline.host}{#if headline.url !== ''}<span class="scan" aria-hidden="true"></span>{/if}</figcaption>
                  {/if}
                  {#if headline.url !== ''}
                    <!--
                      A real button stretched over the quote, not a role on the
                      figure. Same reasoning as the trend card: a button may
                      only hold phrasing content, and the figure/blockquote/
                      figcaption markup is what says the headline is quoted
                      verbatim with its source named.
                    -->
                    <button
                      class="tap"
                      type="button"
                      aria-label="Show QR code for: {headline.text}"
                      onclick={() => onqr(headline)}
                    ></button>
                  {/if}
                </figure>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <section class="group">
        <!--
          The window is named because it is wider than the summary's. The
          summary counts from local midnight; this is the trend's arc over a
          rolling day, which is the more useful thing to look at and the more
          confusing thing to leave unlabelled.
        -->
        <h3 class="group-heading">OBSERVATIONS · LAST 24H</h3>

        <!--
          The stored rows themselves, oldest first. This is the one place on the
          dashboard that shows a search *moving* — a row can only carry a peak
          and a span, and neither can show a trend climbing, falling back, and
          climbing again. `SLOT` is its position in Google's feed at that
          moment, which is arrival order and slides down on its own as newer
          trends arrive; it is here because it explains why a trend disappears
          while still large, not because it ranks anything.
        -->
        {#if !detail.loaded}
          <p class="note">READING THE RECORD…</p>
        {:else if detail.observations.length === 0}
          <p class="note">NO OBSERVATIONS TO SHOW.</p>
        {:else}
          <table class="log">
            <thead>
              <tr>
                <th scope="col">TIME</th>
                <th scope="col">VOLUME</th>
                <th scope="col">SLOT</th>
              </tr>
            </thead>
            <tbody>
              {#each detail.observations as observation (observation.key)}
                <tr>
                  <td>{observation.time}</td>
                  <td class="volume">
                    {observation.volume}
                    <!-- Two stored figures compared, nothing more. -->
                    {#if observation.rose}
                      <span class="rose" aria-label="larger than the observation before">▲</span>
                    {/if}
                  </td>
                  <td>{observation.slot}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
  }

  .scrim {
    position: absolute;
    inset: 0;
    padding: 0;
    background: var(--c-ink);
    border: 0;
    opacity: 0.82;
    cursor: pointer;
  }

  .panel {
    position: relative;
    display: grid;
    grid-template-rows: 76px minmax(0, 1fr);
    width: 560px;
    max-height: 580px;
    background: var(--c-bg);
    border: var(--frame) solid var(--line);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    border-bottom: var(--divider) solid var(--line);
  }

  .heading {
    margin: 0;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 5px;
    color: var(--c-ink);
  }

  .close {
    width: 56px;
    height: 56px;
    font: inherit;
    font-size: 36px;
    line-height: 1;
    color: var(--c-ink);
    background: var(--c-bg);
    border: var(--divider) solid var(--line);
    cursor: pointer;
  }

  .body {
    display: grid;
    align-content: start;
    gap: 20px;
    padding: 20px;
    overflow-y: auto;
  }

  /* Squared off and in palette, like the settings dialog's. */
  .body::-webkit-scrollbar {
    width: 10px;
  }

  .body::-webkit-scrollbar-track {
    background: var(--c-bg);
  }

  .body::-webkit-scrollbar-thumb {
    background: var(--c-blue);
  }

  /*
   * The search itself, allowed to wrap. Naming the trend is what the panel is
   * for, so clipping it would defeat the panel — every other value is short.
   */
  .search {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 1px;
    line-height: 1.15;
    overflow-wrap: anywhere;
    color: var(--c-ink);
  }

  .facts {
    display: grid;
    grid-template-columns: 132px minmax(0, 1fr);
    align-items: baseline;
    gap: 8px 14px;
    margin: 0;
  }

  .facts dt {
    font-size: 16px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .facts dd {
    margin: 0;
    min-width: 0;
    font-size: 20px;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .group-heading {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-blue);
  }

  .note {
    margin: 0;
    font-size: 18px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  /* The second plot's heading needs air the first one already has above it. */
  .rank-heading {
    margin-top: 16px;
  }

  /* Value gutter beside the line, matching the details band's framing. */
  .frame {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    column-gap: 8px;
    height: 60px;
  }

  .gutter {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 13px;
    line-height: 1;
    color: var(--c-blue);
  }

  .plot {
    min-width: 0;
  }

  /* One time axis under both lines, because both are drawn over one span. */
  .axis {
    display: flex;
    justify-content: space-between;
    margin: 6px 0 0 64px;
    font-size: 13px;
    letter-spacing: 1px;
    color: var(--c-blue);
  }

  .headlines {
    display: grid;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .quote {
    display: grid;
    gap: 6px;
    margin: 0;
    min-width: 0;
  }

  /*
   * `relative` anchors the stretched button. Safe against `millennium`, which
   * gives `.quote` only a plaque fill and shadow and no position of its own.
   */
  .quote.tappable {
    position: relative;
    cursor: pointer;
  }

  .tap {
    position: absolute;
    inset: 0;
    background: none;
    border: 0;
    cursor: pointer;
  }

  /* Same code-shaped mark the trend card uses, for the same reason. */
  .scan {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 8px;
    vertical-align: middle;
    background: var(--c-blue);
    box-shadow: 0 0 0 2px var(--c-bg), 0 0 0 4px var(--c-blue);
  }

  /*
   * `body` sets `text-transform: uppercase` for the whole dashboard, and this
   * is one of the two places that must undo it. Everywhere else the screen is
   * writing its own labels; here it is quoting someone else's sentence, and
   * capitals are both harder to read and less faithful to what Google wrote.
   */
  .text {
    margin: 0;
    font-size: 18px;
    line-height: 1.25;
    letter-spacing: 0;
    text-transform: none;
    overflow-wrap: anywhere;
    color: var(--c-ink);
  }

  .attrib {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .sep {
    padding: 0 6px;
  }

  /* Monospace figures in columns, which is what the whole table is for. */
  .log {
    width: 100%;
    border-collapse: collapse;
    font-size: 19px;
    letter-spacing: 1px;
  }

  .log th {
    padding: 0 0 6px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 3px;
    text-align: left;
    color: var(--c-blue);
    border-bottom: var(--divider) solid var(--line);
  }

  .log td {
    padding: 7px 0;
    text-align: left;
    color: var(--c-ink);
  }

  .log tbody tr + tr td {
    border-top: 2px solid var(--line);
  }

  .log th:last-child,
  .log td:last-child {
    text-align: right;
  }

  .volume {
    font-weight: 700;
    color: var(--c-hot);
  }

  .rose {
    font-size: 14px;
    color: var(--c-blue);
  }

  /*
   * "APPROX", "BY VOLUME" and the duration all qualify the figure beside them
   * rather than decorate it. Google's number is the floor of a bucket and the
   * rank is ours, so the panel keeps saying which is which.
   */
  .qualifier {
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }
</style>
