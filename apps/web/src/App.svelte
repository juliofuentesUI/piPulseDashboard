<script lang="ts">
  import { onMount } from 'svelte';

  import ErrorScreen from './lib/components/ErrorScreen.svelte';
  import FooterBar from './lib/components/FooterBar.svelte';
  import HeroPanel from './lib/components/HeroPanel.svelte';
  import LoadingScreen from './lib/components/LoadingScreen.svelte';
  import StatGrid from './lib/components/StatGrid.svelte';
  import StatusBar from './lib/components/StatusBar.svelte';
  import { Dashboard } from './lib/dashboard.svelte';

  /** The HyperPixel Square panel. Everything below is authored at this size. */
  const DESIGN_SIZE = 720;

  const dashboard = new Dashboard();

  /**
   * On the Pi this resolves to exactly 1. On a desktop browser it scales the
   * fixed 720x720 design to fit, so the layout never reflows and never
   * produces a scrollbar.
   */
  let scale = $state(1);

  const view = $derived(dashboard.view);
  const refresh = () => void dashboard.refresh();

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
        <StatusBar
          location={view.location}
          clock={dashboard.clock}
          online={dashboard.online}
        />
        <HeroPanel
          icon={view.icon}
          temperature={view.temperature}
          condition={view.condition}
          feelsLike={view.feelsLike}
        />
        <StatGrid tiles={view.tiles} />
        <FooterBar
          notice={dashboard.notice}
          busy={dashboard.isRefreshing}
          onrefresh={refresh}
        />
      {/if}

      <div class="crt" aria-hidden="true"></div>
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
    background: var(--c-void);
  }

  .device {
    width: var(--size);
    height: var(--size);
    flex: 0 0 auto;
    transform: scale(var(--scale));
    transform-origin: center center;
  }

  .screen {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    gap: 10px;
    padding: 12px;
    overflow: hidden;

    background:
      repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.014) 0 2px,
        rgba(0, 0, 0, 0) 2px 4px
      ),
      var(--c-screen);
    border: 6px solid var(--c-bezel);
    box-shadow: inset 0 0 0 3px var(--c-line-soft);
  }

  /* Static scanlines and vignette — no animation, so it costs nothing on the Pi. */
  .crt {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.22) 0 1px,
        rgba(0, 0, 0, 0) 1px 3px
      ),
      radial-gradient(
        130% 130% at 50% 32%,
        rgba(255, 255, 255, 0.05) 0%,
        rgba(0, 0, 0, 0) 46%,
        rgba(0, 0, 0, 0.55) 100%
      );
  }
</style>
