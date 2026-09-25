<script lang="ts">
  // T-10-005 은퇴 선수 상세 — 명예의 전당에서 언제든 다시 들어온다(내 선수 · 다른 유저의 선수).
  import { appState } from './state.svelte.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import PublishCard from './PublishCard.svelte';

  const v = $derived(appState.legend);
</script>

<div class="wrap">
  <Topbar />
  <button class="btn btn-block" data-act="hof-back" onclick={() => (appState.screen = appState.legendBack)}>← 명예의 전당</button>
  {#if v}
    <LegendReport {v} />
    {#if v.own?.id}<PublishCard h={v.own} />{/if}
  {/if}
</div>
