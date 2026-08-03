<script lang="ts">
  import type { TrendCardView, TrendHeadlineView, TrendHistoryView } from '../types';
  import Sparkline from './Sparkline.svelte';

  interface Props {
    card: TrendCardView;
    history: TrendHistoryView | null;
    onback: () => void;
  }

  let { card, history, onback }: Props = $props();

  /**
   * The image is loaded straight from Google's CDN, so it can fail on its own
   * while the rest of the card is perfectly good. Remembering *which* URL
   * failed rather than a boolean means the next trend gets a fresh attempt
   * without anything having to reset the flag.
   */
  let failedUrl = $state('');

  const showArt = $derived(card.imageUrl !== '' && card.imageUrl !== failedUrl);

  /**
   * The picture shares its row with the first headline; the rest run the full
   * width beneath. Without a picture there is no reason to keep a narrow
   * column, so every headline goes wide.
   */
  const lead = $derived(showArt ? card.headlines[0] ?? null : null);
  const rest = $derived(showArt ? card.headlines.slice(1) : card.headlines);

  /** The feed gave us nothing to explain this trend with. Say so, invent nothing. */
  const bare = $derived(!showArt && card.headlines.length === 0);
</script>

<!--
  One headline, quoted and attributed. `blockquote` and `figcaption` are the
  markup for exactly that, and using them is not decoration: the rule this
  screen lives under is that a headline may be shown verbatim with its source
  named, and never summarised, interpreted or passed off as a related search.
-->
{#snippet quote(headline: TrendHeadlineView)}
  <figure class="quote">
    <blockquote class="text">{headline.text}</blockquote>
    {#if headline.source !== '' || headline.host !== ''}
      <figcaption class="attrib">{headline.source}{#if headline.source !== '' && headline.host !== ''}<span class="sep">·</span>{/if}{headline.host}</figcaption>
    {/if}
  </figure>
{/snippet}

<div class="card">
  <div class="head">
    <!--
      Arrow and title are one target, the same way a trend row is one target:
      this is a touchscreen, and the title is what a finger aims at anyway.
    -->
    <button class="back" type="button" onclick={onback} aria-label="Back to trend list">
      <svg class="arrow" viewBox="0 0 12 12" width="24" height="24" aria-hidden="true" shape-rendering="crispEdges">
        <polygon points="5,1 5,11 0,6" />
        <rect x="5" y="5" width="7" height="2" />
      </svg>
      <span class="name">{card.title}</span>
    </button>

    <span class="figures">
      {#if card.isNew}
        <span class="badge">NEW</span>
      {/if}
      {#if card.volume !== ''}
        <span class="volume">{card.volume}</span>
      {/if}
      {#if card.age !== ''}
        <span class="age">{card.age}</span>
      {/if}
    </span>
  </div>

  <div class="body">
    {#if showArt}
      <div class="lead">
        <div class="art">
          <!--
            Greyscaled, then a panel of the theme's ink laid over it on the
            `color` blend mode: the overlay supplies hue and saturation while
            the photo keeps its own tones, so the subject stays legible and the
            whole thing re-tints when the theme changes, with no script.

            Tested against all five themes. `screen` suited gba-blue alone and
            `multiply` went nearly greyscale on midnight, whose ink is near
            white where every other theme's is dark — that theme is the one any
            image treatment has to be checked against.
          -->
          <div class="shot">
            <!--
              Empty alt on purpose. We cannot describe what a news photo shows
              without inventing a description of it, which is the one thing
              this screen never does. The headline beside it carries the
              meaning, in Google's words.
            -->
            <img
              src={card.imageUrl}
              alt=""
              referrerpolicy="no-referrer"
              onerror={() => (failedUrl = card.imageUrl)}
            />
          </div>

          {#if card.imageSource !== ''}
            <p class="credit">{card.imageSource}</p>
          {/if}
        </div>

        {#if lead !== null}
          {@render quote(lead)}
        {/if}
      </div>
    {/if}

    {#if rest.length > 0}
      <div class="more">
        {#each rest as headline (headline.key)}
          {@render quote(headline)}
        {/each}
      </div>
    {/if}

    {#if bare}
      <p class="nothing">THE FEED CARRIED NO PICTURE OR HEADLINES FOR THIS TREND.</p>
    {/if}
  </div>

  <!--
    The same graph as the details band, given the width it never had there.
    Rank here is standing by volume within each fetch, not position in the
    feed — the feed is ordered newest-first, so its position slides downward on
    its own and would say nothing about the search.
  -->
  <div class="foot">
    <div class="foot-head">
      <p class="graph-label">
        RANK{history?.sparkline == null ? '' : ` · LAST ${history.sparkline.windowLabel}`}
      </p>
      {#if history?.sparkline != null}
        <p class="graph-label">PEAK {history.peakRank} · NOW {history.latestRank}</p>
      {/if}
    </div>

    {#if history?.sparkline != null}
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
    {:else}
      <p class="graph-empty">NO HISTORY RECORDED YET.</p>
    {/if}
  </div>
</div>

<style>
  /*
   * Three bands to the 704 inside the frame, same budgeting as every other
   * layout in this app. The middle one takes what the other two leave, because
   * how much it has to hold depends on how long the headlines are.
   */
  .card {
    display: grid;
    grid-template-rows: 96px minmax(0, 1fr) 156px;
    width: 100%;
    height: 100%;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    /* No left padding: the back button carries it, as hit area. */
    padding: 0 24px 0 0;
    overflow: hidden;
    border-bottom: var(--divider) solid var(--line);
  }

  .back {
    display: flex;
    align-items: center;
    gap: 14px;
    align-self: stretch;
    min-width: 0;
    padding: 0 10px 0 20px;

    font: inherit;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
  }

  /*
   * Drawn rather than typed. An arrow character depends on whichever monospace
   * font the machine happened to have, and the sprites next door are all
   * whole-pixel geometry with `crispEdges` — this is the same thing at 2x.
   */
  .arrow {
    flex: 0 0 auto;
    fill: var(--c-ink);
  }

  .back:active .arrow {
    fill: var(--c-hot);
  }

  /*
   * Clipped, not wrapped. A search term can run to twenty-five characters and
   * the band is a fixed height with a figure sitting beside it.
   */
  .name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  .figures {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex: 0 0 auto;
  }

  /* Google first reported this search under 30 minutes ago. Our one label. */
  .badge {
    padding: 2px 8px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 3px;
    color: var(--c-bg);
    background: var(--c-hot);
  }

  .volume {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--c-hot);
  }

  .age {
    font-size: 16px;
    letter-spacing: 1px;
    white-space: nowrap;
    color: var(--c-blue);
  }

  .body {
    display: grid;
    grid-auto-rows: auto;
    align-content: start;
    gap: 18px;
    min-height: 0;
    padding: 20px 24px;
    overflow: hidden;
    border-bottom: var(--divider) solid var(--line);
  }

  .lead {
    display: grid;
    grid-template-columns: 212px minmax(0, 1fr);
    gap: 20px;
    min-width: 0;
  }

  .art {
    display: grid;
    gap: 8px;
    align-content: start;
  }

  /*
   * `isolation: isolate` is what keeps the blend inside this box — without it
   * the overlay would composite against the panel behind the image too.
   */
  .shot {
    position: relative;
    isolation: isolate;
    width: 204px;
    height: 136px;
    background: var(--c-ink);
    border: var(--divider) solid var(--line);
  }

  .shot img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(1) contrast(1.35) brightness(1.05);
  }

  /*
   * `sky`, not `ink` as the spec's snippet had it.
   *
   * The `color` blend keeps the overlay's own chroma — its max-minus-min RGB
   * spread — and hands the photo's luminosity back. `ink` has almost no spread
   * on midnight (#eaf2ff, 19/255 measured over a real feed image) so it cannot
   * produce a hue there at all, and only 36 on dmg-green. Measured across all
   * five themes, `sky` is the one token in the mid range everywhere: 86 to 115.
   * `blue` scored higher on four and then collapsed to 44 on dmg-green.
   *
   * The blend mode is the decision that was made from a rendered comparison;
   * this is the token that lets it keep the promise.
   */
  .shot::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--c-sky);
    mix-blend-mode: color;
  }

  .credit {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .more {
    display: grid;
    align-content: start;
    gap: 16px;
    min-width: 0;
  }

  .quote {
    display: grid;
    gap: 6px;
    margin: 0;
    min-width: 0;
  }

  /*
   * The one text on the dashboard that is not uppercased. Everywhere else the
   * screen is writing its own labels; here it is quoting a hundred characters
   * of someone else's sentence, and capitals would make it both harder to read
   * and less faithful to what Google actually wrote.
   */
  .text {
    margin: 0;
    font-size: 20px;
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
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  .sep {
    padding: 0 6px;
  }

  .nothing {
    margin: 0;
    font-size: 18px;
    letter-spacing: 2px;
    color: var(--c-blue);
  }

  /* The bottom padding is the page indicator's lane, as on the trend list. */
  .foot {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 8px;
    min-height: 0;
    padding: 14px 24px 28px;
  }

  .foot-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }

  .graph-label,
  .graph-empty {
    margin: 0;
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-blue);
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
</style>
