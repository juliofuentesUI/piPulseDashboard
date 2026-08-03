<script lang="ts">
  import { onMount } from 'svelte';

  import ErrorScreen from './lib/components/ErrorScreen.svelte';
  import LoadingScreen from './lib/components/LoadingScreen.svelte';
  import PageDots from './lib/components/PageDots.svelte';
  import SearchPulse from './lib/components/SearchPulse.svelte';
  import SettingsModal from './lib/components/SettingsModal.svelte';
  import WeatherDashboard from './lib/components/WeatherDashboard.svelte';
  import WeekDashboard from './lib/components/WeekDashboard.svelte';
  import { Dashboard } from './lib/dashboard.svelte';
  import { ScreenStore, type Screen } from './lib/screen.svelte';
  import { ThemeStore, type Theme } from './lib/theme.svelte';
  import { Trends } from './lib/trends.svelte';

  /** The HyperPixel Square panel. Everything below is authored at this size. */
  const DESIGN_SIZE = 720;

  /**
   * The panel is a horizontal carousel of these, in order. The weather page
   * holds whichever of the two weather layouts settings has chosen, so the
   * screen picker keeps meaning what it always did.
   */
  const PAGES = ['WEATHER', 'SEARCH PULSE'] as const;

  const dashboard = new Dashboard();
  const trends = new Trends();
  const themes = new ThemeStore();
  const screens = new ScreenStore();

  /**
   * On the Pi this resolves to exactly 1. On a desktop browser it scales the
   * fixed 720x720 design to fit, so the layout never reflows and never
   * produces a scrollbar.
   */
  let scale = $state(1);
  let menuOpen = $state(false);

  let carousel: HTMLDivElement | undefined = $state();
  let page = $state(0);

  const view = $derived(dashboard.view);
  const refresh = (): void => void dashboard.refresh();

  /**
   * Which page has settled under the viewport. Rounding rather than flooring
   * flips the indicator at the halfway point of a drag, so the dot leads the
   * snap instead of lagging a whole page behind it.
   */
  const onscroll = (): void => {
    if (carousel === undefined || carousel.clientWidth === 0) return;
    page = Math.round(carousel.scrollLeft / carousel.clientWidth);
  };

  /** Animation comes from `scroll-behavior`, so reduced motion is honoured in CSS. */
  const goto = (index: number): void => {
    carousel?.scrollTo({ left: index * carousel.clientWidth });
  };

  /** The menu stays open on pick, so the new palette can be seen taking effect. */
  const pickTheme = (theme: Theme): void => themes.select(theme);

  /**
   * Unlike a theme, the layout is hidden behind the menu — so close it to
   * reveal it, and come back to the weather page if the pick was made from
   * Search Pulse. Otherwise the panel closes onto a screen that did not change.
   */
  const pickScreen = (screen: Screen): void => {
    screens.select(screen);
    menuOpen = false;
    goto(0);
  };

  onMount(() => {
    const fit = (): void => {
      scale = Math.min(window.innerWidth, window.innerHeight) / DESIGN_SIZE;
    };

    fit();
    window.addEventListener('resize', fit);
    dashboard.start();
    trends.start();

    return () => {
      window.removeEventListener('resize', fit);
      dashboard.stop();
      trends.stop();
    };
  });
</script>

<div class="stage">
  <div class="device" style:--scale={scale} style:--size="{DESIGN_SIZE}px">
    <div class="screen">
      <div class="carousel" bind:this={carousel} {onscroll}>
        <!--
          Loading and error states live inside the weather page rather than
          replacing the whole panel, so a weather outage cannot take the other
          page down with it.
        -->
        <section class="page" aria-label="Weather">
          {#if dashboard.phase === 'loading'}
            <LoadingScreen />
          {:else if view === null}
            <ErrorScreen
              failure={dashboard.failure}
              busy={dashboard.isRefreshing}
              onretry={refresh}
            />
          {:else if screens.current.id === 'week'}
            <WeekDashboard
              {view}
              date={dashboard.date}
              clock={dashboard.clock}
              updated={dashboard.updated}
              busy={dashboard.isRefreshing}
              notice={dashboard.notice}
              onrefresh={refresh}
              onmenu={() => (menuOpen = true)}
            />
          {:else}
            <WeatherDashboard
              {view}
              date={dashboard.date}
              clock={dashboard.clock}
              notice={dashboard.notice}
              onrefresh={refresh}
              onmenu={() => (menuOpen = true)}
            />
          {/if}
        </section>

        <section class="page" aria-label="Search Pulse">
          <SearchPulse
            phase={trends.phase}
            rows={trends.rows}
            status={trends.status}
            region={trends.region}
            detail={trends.detail}
            card={trends.card}
            history={trends.history}
            selectedId={trends.selectedId}
            mode={trends.mode}
            onmode={(mode) => trends.setMode(mode)}
            onselect={(id) => trends.select(id)}
            onmenu={() => (menuOpen = true)}
          />
        </section>
      </div>

      <PageDots pages={PAGES} current={page} onselect={goto} />

      {#if menuOpen}
        <SettingsModal
          current={themes.current}
          screen={screens.current}
          onselect={pickTheme}
          onscreen={pickScreen}
          onclose={() => (menuOpen = false)}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--c-ink);
  }

  .device {
    width: var(--size);
    height: var(--size);
    flex: 0 0 auto;
    transform: scale(var(--scale));
    transform-origin: center center;
  }

  /* The thick outer frame of the reference design. Square corners, no shadow. */
  .screen {
    /* Anchors the settings overlay, which is clipped to the panel like everything else. */
    position: relative;
    display: grid;
    /*
     * Explicit, not the implicit `auto` row: an auto row would ask its child
     * how tall it wants to be, the child's own `height: 100%` could not resolve
     * against a row that is still being sized, and the row would lock to the
     * content height. The panel would then be 720 tall with ~774 of content in
     * it. A definite track makes the 704 flow downwards instead.
     */
    grid-template-rows: minmax(0, 1fr);
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--c-bg);
    border: var(--frame) solid var(--c-ink);
  }

  /*
   * The pages, side by side. Native scroll snapping does the whole gesture:
   * a swipe pans the carousel and it settles on a page boundary, with the
   * platform's own momentum. Nothing here reimplements that in JavaScript.
   */
  .carousel {
    display: flex;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;

    /* Keeps a swipe past the last page from triggering browser back-navigation. */
    overscroll-behavior-x: contain;
    scroll-behavior: smooth;

    /*
     * Not cosmetic: a classic horizontal scrollbar takes its height out of the
     * content box, and every band on every page is budgeted against the full
     * 704. Reserving no space keeps those budgets exact.
     */
    scrollbar-width: none;
  }

  .carousel::-webkit-scrollbar {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .carousel {
      scroll-behavior: auto;
    }
  }

  /*
   * 100% of the carousel's content box, which is the same 704 a page occupied
   * before there was a carousel — so the fixed layouts inside are untouched.
   *
   * The explicit row is the contract `.screen` used to provide, and the
   * loading and error screens still depend on it: neither sets a height, so
   * a plain block parent would size them to their content and their
   * `justify-content: center` would centre against that instead of the panel.
   */
  .page {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    flex: 0 0 100%;
    height: 100%;
    min-width: 0;
    scroll-snap-align: start;
  }
</style>
