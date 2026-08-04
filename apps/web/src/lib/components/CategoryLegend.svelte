<script lang="ts">
  import { CATEGORY_MEANINGS, CATEGORY_ORDER } from '../category-glyphs';
  import CategoryBadge from './CategoryBadge.svelte';

  interface Props {
    /** Why badges are missing, or empty when nothing is wrong. */
    warning: string;
    onclose: () => void;
  }

  let { warning, onclose }: Props = $props();

  let dialog: HTMLDivElement | undefined = $state();

  /** Same as the settings dialog: take focus so Escape and Tab land somewhere. */
  $effect(() => {
    dialog?.focus();
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onclose();
  }
</script>

<svelte:window {onkeydown} />

<!--
  Deliberately the same skeleton as SettingsModal — backdrop, scrim button,
  `.panel` with a `.head`/`.heading`/`.close` header and a scrolling `.body`.

  That is not laziness. `millennium.css` styles dialogs by reaching into those
  class names from outside, so a dialog that invents its own structure arrives
  unstyled in that theme and nowhere else — a failure that is invisible until
  someone switches themes. Matching the skeleton means the gold framing, the
  stone field and the plaque edges apply here for free.

  Both marks are shown on every row rather than only the active one. The legend
  has to be readable by someone who has just switched styles, and showing only
  the current one makes the other permanently unlearnable.
-->
<div class="backdrop">
  <button
    class="scrim"
    type="button"
    tabindex="-1"
    aria-label="Close legend"
    onclick={onclose}
  ></button>

  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label="Category legend"
    tabindex="-1"
    bind:this={dialog}
  >
    <header class="head">
      <h2 class="heading">LEGEND</h2>
      <button class="close" type="button" onclick={onclose} aria-label="Close legend">
        ×
      </button>
    </header>

    <div class="body">
      <!--
        The one thing on this panel that is not Google's, said in words. The
        badge design carries this too, but a legend is where it can be stated
        rather than implied.
      -->
      <p class="note">
        OUR READING OF EACH TREND'S HEADLINES — NOT A FIGURE FROM GOOGLE.
      </p>

      <ul class="rows">
        {#each CATEGORY_ORDER as category (category)}
          <li class="row">
            <span class="marks">
              <CategoryBadge {category} variant="glyph" />
              <CategoryBadge {category} variant="abbrev" />
            </span>
            <span class="meaning">{CATEGORY_MEANINGS[category] ?? ''}</span>
          </li>
        {/each}
      </ul>

      <!--
        The closing note is only true when categorising is actually running.
        With no key every trend is unbadged, and telling someone the headlines
        were unclear would send them looking in the wrong place entirely.
      -->
      {#if warning === ''}
        <p class="note">
          A TREND WITH NO BADGE COULD NOT BE PLACED FROM ITS HEADLINES.
        </p>
      {:else}
        <p class="note alert">
          {warning} — NO TRENDS ARE BEING CATEGORISED. SET OPENAI_API_KEY IN .ENV
          ON THIS MACHINE AND RESTART.
        </p>
      {/if}
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
    gap: 14px;
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

  .note {
    margin: 0;
    font-size: 14px;
    letter-spacing: 2px;
    line-height: 1.4;
    color: var(--c-blue);
  }

  .alert {
    color: var(--c-hot);
  }

  .rows {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    padding: 6px 10px;
    border: var(--divider) solid var(--line);
  }

  /*
   * Fixed width so every meaning starts on the same column. The glyph and the
   * abbreviation are different widths by nature, and a ragged left edge on
   * eleven rows reads as a mistake.
   */
  .marks {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
    width: 84px;
  }

  .meaning {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--c-ink);
  }
</style>
