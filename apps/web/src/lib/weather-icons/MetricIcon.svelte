<script lang="ts">
  import type { MetricView } from '../types';
  import { METRIC_ICONS } from './registry';

  interface Props {
    icon: MetricView['icon'];
  }

  let { icon }: Props = $props();

  const Sprite = $derived(METRIC_ICONS[icon]);
</script>

<Sprite />
