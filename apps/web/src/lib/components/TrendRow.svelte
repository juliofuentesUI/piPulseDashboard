<script lang="ts">
  import type { BadgeStyle } from '../badge.svelte';
  import type { TrendRowView } from '../types';
  import CategoryBadge from './CategoryBadge.svelte';

  interface Props extends TrendRowView {
    selected: boolean;
    badge: BadgeStyle;
    onselect: (id: string) => void;
  }

  let {
    id,
    rank,
    title,
    volume,
    age,
    bar,
    category,
    selected,
    badge,
    onselect,
  }: Props = $props();
</script>

<li class="row" class:selected>
  <!--
    The whole row is the target rather than a widget inside it: this is a
    touchscreen, and the row is already the thing a finger is aiming at.
  -->
  <button
    class="hit"
    type="button"
    aria-pressed={selected}
    onclick={() => onselect(id)}
  >
    <span class="rank">{rank}</span>

    <span class="body">
      <span class="line">
        <!-- Absent category, no badge. Nothing is invented to fill the gap. -->
        {#if category !== ''}
          <CategoryBadge {category} variant={badge === 'glyph' ? 'plain' : 'abbrev'} />
        {/if}
        <span class="title">{title}</span>
        <span class="figures">
          {#if volume !== ''}
            <span class="volume">{volume}</span>
          {/if}
          {#if age !== ''}
            <span class="age">{age}</span>
          {/if}
        </span>
      </span>

      <!--
        The bar carries no number of its own; the figure beside the title is
        the only quantity on the row, and it is Google's wording of it.
      -->
      <span class="track">
        <span class="fill" style:--bar="{bar}%"></span>
      </span>
    </span>
  </button>
</li>

<style>
  .row {
    display: grid;
    min-height: 0;
    border-bottom: var(--divider) solid var(--line);
  }

  /* The last row's border would double up with the details band's own edge. */
  .row:last-child {
    border-bottom: 0;
  }

  /*
   * Flat design, so the selected row inverts rather than growing a tick —
   * the same idiom the settings list uses for the option in force.
   */
  .row.selected {
    background: var(--c-ink);
  }

  .hit {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: center;
    gap: 4px;
    width: 100%;
    min-width: 0;
    padding: 0 24px 0 20px;

    font: inherit;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .rank {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--c-blue);
  }

  .body {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  /*
   * One line, clipped rather than wrapped. A long search term must not push
   * the bar out of the row: the band is a fixed height with five rows in it,
   * and every row has to keep its place.
   */
  /*
   * `flex: 1` and not just `min-width: 0`. With three items on a
   * space-between line the title is sized to its content and pushed to the
   * middle, which centres every search term on the panel — a regression the
   * badge introduced by turning two items into three. Filling the free space
   * puts the text back against the badge where it belongs.
   */
  .title {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 23px;
    letter-spacing: 1px;
    color: var(--c-ink);
  }

  /*
   * Volume and age travel together on the right. Both are Google's: how big
   * the search is, and how long ago it said so.
   */
  /*
   * The flex gap dropped to 8px so the badge sits tight against the title it
   * qualifies; this restores the wider separation the figures had, so the badge
   * reads as belonging to the title rather than floating between the two.
   */
  .figures {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex: 0 0 auto;
    margin-left: 6px;
  }

  .volume {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--c-hot);
  }

  .age {
    font-size: 15px;
    letter-spacing: 1px;
    white-space: nowrap;
    color: var(--c-blue);
  }

  .track {
    display: block;
    height: 14px;
    background: var(--c-bg);
    border: var(--divider) solid var(--line);
  }

  .fill {
    display: block;
    width: var(--bar);
    height: 100%;
    background: var(--c-sky);
  }

  /*
   * Inverted, every mark on the row has to cross back over. `warm` rather
   * than `hot` for the figure: hot is an orange tuned to sit on the light
   * panel, and it goes muddy against ink.
   */
  .row.selected .title {
    color: var(--c-bg);
  }

  .row.selected .rank {
    color: var(--c-bg);
  }

  .row.selected .volume {
    color: var(--c-warm);
  }

  .row.selected .age {
    color: var(--c-sky);
  }

  /*
   * The badge has to cross the inversion like every other mark on the row.
   * Drawn plain it is `--c-blue`, which sits on the panel but disappears into
   * an inked selected row — `sky` is the token that stays visible against both,
   * which is the same reason `.age` uses it here.
   *
   * `:global` because the badge is its own component and Svelte's scoping stops
   * at the boundary. The selected state lives on the row, so the rule has to.
   */
  .row.selected :global(.badge.plain) {
    color: var(--c-sky);
  }

  /* The track's own border would vanish into the row, so it inverts too. */
  .row.selected .track {
    background: var(--c-ink);
    border-color: var(--c-bg);
  }
</style>
