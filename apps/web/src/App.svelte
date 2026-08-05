<script lang="ts">
  import { onMount } from 'svelte';

  import DayTrendModal from './lib/components/DayTrendModal.svelte';
  import ErrorScreen from './lib/components/ErrorScreen.svelte';
  import EventsMap from './lib/components/EventsMap.svelte';
  import LoadingScreen from './lib/components/LoadingScreen.svelte';
  import PageDots from './lib/components/PageDots.svelte';
  import CategoryLegend from './lib/components/CategoryLegend.svelte';
  import SearchPulse from './lib/components/SearchPulse.svelte';
  import SettingsModal from './lib/components/SettingsModal.svelte';
  import WeatherDashboard from './lib/components/WeatherDashboard.svelte';
  import WeekDashboard from './lib/components/WeekDashboard.svelte';
  import { Attract } from './lib/attract.svelte';
  import { BadgeStore, type BadgeStyle } from './lib/badge.svelte';
  import { Dashboard } from './lib/dashboard.svelte';
  import { Events } from './lib/events.svelte';
  import { ScreenStore, SCREENS, type Screen } from './lib/screen.svelte';
  import { ThemeStore, type Theme } from './lib/theme.svelte';
  import { Trends } from './lib/trends.svelte';

  /** The HyperPixel Square panel. Everything below is authored at this size. */
  const DESIGN_SIZE = 720;

  /**
   * The panel is a horizontal carousel of these, in order. The weather page
   * holds whichever of the two weather layouts settings has chosen, so the
   * screen picker keeps meaning what it always did.
   */
  const PAGES = ['WEATHER', 'SEARCH PULSE', 'EVENTS'] as const;

  const dashboard = new Dashboard();
  const trends = new Trends();
  const events = new Events();
  const themes = new ThemeStore();
  const badges = new BadgeStore();
  const screens = new ScreenStore();

  /**
   * Attract mode drives the panel through `goto` and the stores — the same
   * calls a tap makes — so it adds no navigation of its own.
   *
   * `screens.show` rather than `screens.select`: the tour visits both weather
   * layouts and must not overwrite the one that was chosen. `onstop` puts the
   * chosen layout back, so handing control to a person restores exactly what
   * they had.
   */
  const attract = new Attract({
    apply: (stop) => {
      if (stop.screen !== undefined) {
        const screen = SCREENS.find((option) => option.id === stop.screen);
        if (screen !== undefined) screens.show(screen);
      }
      if (stop.pulse !== undefined) trends.setView(stop.pulse);

      // A card left open would otherwise still be covering the Search Pulse
      // page when the tour arrives back at it.
      trends.closeCard();
      goto(stop.page);
    },
    onstop: () => screens.restore(),
  });

  /**
   * On the Pi this resolves to exactly 1. On a desktop browser it scales the
   * fixed 720x720 design to fit, so the layout never reflows and never
   * produces a scrollbar.
   */
  let scale = $state(1);
  let menuOpen = $state(false);
  let legendOpen = $state(false);

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

  /**
   * Turning it on closes the dialog and starts the tour at once — there is
   * nothing to look at behind a settings panel, and a control whose effect is
   * invisible for a minute reads as broken. Turning it off leaves the dialog up,
   * because the point of switching it off is to keep reading undisturbed.
   */
  const pickCarousel = (on: boolean): void => {
    if (on) menuOpen = false;
    attract.setEnabled(on);
  };

  /**
   * Deliberately leaves the dialog open, unlike the screen picker.
   *
   * The two badge styles are a close call and the way anyone settles it is by
   * flipping between them a few times. Closing the panel on every pick would
   * make that four taps a comparison instead of one.
   */
  const pickBadge = (style: BadgeStyle): void => badges.select(style);

  /**
   * The legend replaces the settings dialog rather than stacking on it.
   *
   * Two dialogs on a 720px panel leave the lower one as a rim of frame around
   * the upper, which reads as a rendering fault rather than as depth. Closing
   * on the way out also means Escape does the obvious thing from either.
   */
  const openLegend = (): void => {
    menuOpen = false;
    legendOpen = true;
  };

  /**
   * Any input from a person hands the panel back and restarts the countdown.
   *
   * Pointer and key events only, never scroll: the tour navigates *by*
   * scrolling the carousel, so a scroll listener would read the tour's own
   * first step as a person touching the panel and switch itself off at once.
   */
  const touched = (): void => attract.touched();

  onMount(() => {
    const fit = (): void => {
      scale = Math.min(window.innerWidth, window.innerHeight) / DESIGN_SIZE;
    };

    fit();
    window.addEventListener('resize', fit);
    for (const event of ['pointerdown', 'keydown', 'wheel'] as const) {
      window.addEventListener(event, touched, { passive: true });
    }

    dashboard.start();
    trends.start();
    events.start();
    attract.begin();

    return () => {
      window.removeEventListener('resize', fit);
      for (const event of ['pointerdown', 'keydown', 'wheel'] as const) {
        window.removeEventListener(event, touched);
      }
      dashboard.stop();
      trends.stop();
      events.stop();
      attract.dispose();
    };
  });

  /*
   * While anything modal is up the countdown does not run at all, so the tour
   * cannot resume underneath it and nothing closes the user's dialog for them.
   */
  $effect(() => {
    attract.suspend(menuOpen || legendOpen || trends.dayTrend !== null);
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
              onhold={() => attract.start()}
            />
          {:else}
            <WeatherDashboard
              {view}
              date={dashboard.date}
              clock={dashboard.clock}
              notice={dashboard.notice}
              onrefresh={refresh}
              onmenu={() => (menuOpen = true)}
              onhold={() => attract.start()}
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
            day={trends.day}
            selectedId={trends.selectedId}
            mode={trends.mode}
            badge={badges.current}
            categoryWarning={trends.categoryWarning}
            refreshing={trends.refreshing}
            flash={trends.flash}
            onrefresh={() => void trends.refreshNow()}
            view={trends.view}
            onview={(view) => trends.setView(view)}
            onmode={(mode) => trends.setMode(mode)}
            onselect={(id) => trends.select(id)}
            onopenday={(key) => trends.openDayTrend(key)}
            cardOpen={trends.cardOpen}
            onopencard={() => trends.openCard()}
            onclosecard={() => trends.closeCard()}
            onmenu={() => (menuOpen = true)}
            onhold={() => attract.start()}
          />
        </section>

        <section class="page" aria-label="Events">
          <EventsMap
            phase={events.phase}
            snapshot={events.snapshot}
            failure={events.failure}
            events={events.visible}
            pins={events.pins}
            unpinned={events.unpinned}
            isMock={events.isMock}
            filter={events.filter}
            selected={events.selected}
            onfilter={(filter) => events.setFilter(filter)}
            onselect={(id) => events.select(id)}
            onclose={() => events.close()}
            onmenu={() => (menuOpen = true)}
            onhold={() => attract.start()}
          />
        </section>
      </div>

      <PageDots pages={PAGES} current={page} onselect={goto} />

      <!--
        Beside the settings dialog rather than inside Search Pulse, so it
        shares that dialog's stacking context and clears the page indicator.
        Rendered from the store's own state, which means a poll landing while
        it is open refreshes it instead of leaving it stale.
      -->
      {#if trends.dayTrend !== null}
        <DayTrendModal detail={trends.dayTrend} onclose={() => trends.closeDayTrend()} />
      {/if}

      {#if menuOpen}
        <SettingsModal
          current={themes.current}
          screen={screens.current}
          carousel={attract.enabled}
          badge={badges.current}
          onselect={pickTheme}
          onscreen={pickScreen}
          oncarousel={pickCarousel}
          onbadge={pickBadge}
          onlegend={openLegend}
          onclose={() => (menuOpen = false)}
        />
      {/if}

      {#if legendOpen}
        <CategoryLegend
          warning={trends.categoryWarning}
          onclose={() => (legendOpen = false)}
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
    border: var(--frame) solid var(--line);
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
  /*
   * Each page is given its own compositor layer, and that is a performance fix
   * rather than a style.
   *
   * Without it a swipe repaints both pages every frame. The flat themes survive
   * that because they paint flat fills and hairlines; `millennium` does not —
   * it carries fourteen box-shadows, nine `border-image` nine-slices, fifteen
   * gradients, two `filter: drop-shadow`s and two `background-clip: text`
   * headings, against zero of any of them elsewhere. On a Pi 5 that is the
   * difference between a swipe that tracks the finger and one that does not.
   *
   * Promoted, each page is rasterised once and the scroll becomes the GPU
   * moving two textures. The cost is about 4 MB of layer memory for the pair.
   *
   * `contain: paint` is deliberately *not* used with it. It would clip each
   * page to its own box, and the panel already clips at `.screen`; adding a
   * second, tighter clip risks cutting the theme's art for no further gain.
   */
  .page {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    flex: 0 0 100%;
    height: 100%;
    min-width: 0;
    scroll-snap-align: start;
    will-change: transform;
  }
</style>
