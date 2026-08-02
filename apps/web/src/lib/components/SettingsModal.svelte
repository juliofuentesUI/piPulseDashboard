<script lang="ts">
  import { THEMES, type Theme } from '../theme.svelte';

  interface Props {
    current: Theme;
    onselect: (theme: Theme) => void;
    onclose: () => void;
  }

  let { current, onselect, onclose }: Props = $props();

  let dialog: HTMLDivElement | undefined = $state();

  /** The panel takes focus on open so Escape and Tab land somewhere sensible. */
  $effect(() => {
    dialog?.focus();
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onclose();
  }

  /** The chips in a row's swatch, in the order they read best. */
  const CHIPS = ['ink', 'blue', 'sky', 'warm', 'hot'] as const;
</script>

<svelte:window {onkeydown} />

<div class="backdrop">
  <!-- A real button rather than a click handler on the scrim div, so tapping
       outside to dismiss is reachable and announced like any other control. -->
  <button class="scrim" type="button" tabindex="-1" aria-label="Close settings" onclick={onclose}
  ></button>

  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    tabindex="-1"
    bind:this={dialog}
  >
    <header class="head">
      <h2 class="heading">SETTINGS</h2>
      <button class="close" type="button" onclick={onclose} aria-label="Close settings">
        ×
      </button>
    </header>

    <div class="body">
      <!-- Further option groups go here as sibling <section class="group"> blocks. -->
      <section class="group">
        <h3 class="group-heading">THEME</h3>
        <ul class="options">
          {#each THEMES as theme (theme.id)}
            <li>
              <button
                class="option"
                class:active={theme.id === current.id}
                type="button"
                aria-pressed={theme.id === current.id}
                onclick={() => onselect(theme)}
              >
                <span class="swatch" style:background={theme.palette.bg}>
                  {#each CHIPS as chip (chip)}
                    <span class="chip" style:background={theme.palette[chip]}></span>
                  {/each}
                </span>
                <span class="name">{theme.name}</span>
              </button>
            </li>
          {/each}
        </ul>
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
    border: var(--frame) solid var(--c-ink);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    border-bottom: var(--divider) solid var(--c-ink);
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
    border: var(--divider) solid var(--c-ink);
    cursor: pointer;
  }

  /* Grid gap rather than a margin between groups, so adding one needs no CSS. */
  .body {
    display: grid;
    align-content: start;
    gap: 24px;
    padding: 20px;
    overflow-y: auto;
  }

  .group-heading {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 4px;
    color: var(--c-blue);
  }

  .options {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    min-height: 66px;
    padding: 0 16px;

    font: inherit;
    font-size: 22px;
    letter-spacing: 3px;
    text-align: left;
    color: var(--c-ink);

    background: var(--c-bg);
    border: var(--divider) solid var(--c-ink);
    cursor: pointer;
  }

  /* Flat design, so the selected row inverts rather than growing a tick. */
  .option.active {
    background: var(--c-ink);
    color: var(--c-bg);
  }

  /*
   * The swatch paints the other theme's colours, which are not custom
   * properties yet — only the active theme's are — so they come from the
   * palette object as inline styles.
   */
  .swatch {
    display: flex;
    flex: 0 0 auto;
    gap: 3px;
    padding: 5px;
    border: 2px solid currentColor;
  }

  .chip {
    width: 10px;
    height: 26px;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }
</style>
