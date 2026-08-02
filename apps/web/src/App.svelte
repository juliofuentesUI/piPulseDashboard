<script lang="ts">
  import { onMount } from 'svelte';

  import ErrorScreen from './lib/components/ErrorScreen.svelte';
  import LoadingScreen from './lib/components/LoadingScreen.svelte';
  import SettingsModal from './lib/components/SettingsModal.svelte';
  import WeatherDashboard from './lib/components/WeatherDashboard.svelte';
  import { Dashboard } from './lib/dashboard.svelte';
  import { ThemeStore, type Theme } from './lib/theme.svelte';

  /** The HyperPixel Square panel. Everything below is authored at this size. */
  const DESIGN_SIZE = 720;

  const dashboard = new Dashboard();
  const themes = new ThemeStore();

  /**
   * On the Pi this resolves to exactly 1. On a desktop browser it scales the
   * fixed 720x720 design to fit, so the layout never reflows and never
   * produces a scrollbar.
   */
  let scale = $state(1);
  let menuOpen = $state(false);

  const view = $derived(dashboard.view);
  const refresh = (): void => void dashboard.refresh();

  /** The menu stays open on pick, so the new palette can be seen taking effect. */
  const pickTheme = (theme: Theme): void => themes.select(theme);

  onMount(() => {
    const fit = (): void => {
      scale = Math.min(window.innerWidth, window.innerHeight) / DESIGN_SIZE;
    };

    fit();
    window.addEventListener('resize', fit);
    dashboard.start();

    return () => {
      window.removeEventListener('resize', fit);
      dashboard.stop();
    };
  });
</script>

<div class="stage">
  <div class="device" style:--scale={scale} style:--size="{DESIGN_SIZE}px">
    <div class="screen">
      {#if dashboard.phase === 'loading'}
        <LoadingScreen />
      {:else if view === null}
        <ErrorScreen
          failure={dashboard.failure}
          busy={dashboard.isRefreshing}
          onretry={refresh}
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

      {#if menuOpen}
        <SettingsModal
          current={themes.current}
          onselect={pickTheme}
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
</style>
