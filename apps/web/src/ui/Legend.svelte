<script lang="ts">
  // T-10-005 은퇴 선수 상세 — 명예의 전당 · 구단주의 내 선수에서 언제든 다시 들어온다.
  import { appState } from './state.svelte.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import OwnHofCards from './OwnHofCards.svelte';
  import ShareBar from './ShareBar.svelte';

  const v = $derived(appState.legend);
</script>

<div class="wrap">
  <Topbar />
  <!-- T-10-126 내가 은퇴시킨 선수(v.own)는 버튼 없이 뒤로 가기·밀어서 돌아간다. -->
  {#if !v?.own}
    <button class="btn btn-block" data-act="hof-back" onclick={() => (appState.screen = appState.legendBack)}>← 이전으로</button>
  {/if}
  {#if v}
    <LegendReport {v} />
    {#if v.own?.id}<OwnHofCards {v} />{/if}
    {#if v.shareId}<ShareBar id={v.shareId} />{/if}
  {/if}
</div>
