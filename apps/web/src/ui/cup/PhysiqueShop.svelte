<script lang="ts">
  import { iapText as L } from '@offside/app-core/i18n/ko/iap';
  import WebPayPacks from './WebPayPacks.svelte';
  const { have }: { have: number } = $props();
</script>
<section class="card stack"><h2>{L.physiqueTitle}</h2><p>{L.physiqueNote}</p><p>{L.physiqueHave} · {have}</p><WebPayPacks item="physique"/></section>
