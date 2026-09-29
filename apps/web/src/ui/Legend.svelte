<script lang="ts">
  // T-10-005 은퇴 선수 상세 — 명예의 전당 · 구단주의 내 선수에서 언제든 다시 들어온다.
  import { appState } from './state.svelte.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import OwnHofCards from './OwnHofCards.svelte';
  import ShareBar from './ShareBar.svelte';
  import { autoTour } from './autoTour.js';

  const v = $derived(appState.legend);
</script>

<!-- T-10-127 3초 동안 가만히 있으면 다음 장면으로 천천히 넘어간다. -->
<div class="wrap" use:autoTour>
  <Topbar />
  {#if v}
    <LegendReport {v} />
    {#if v.own?.id}<OwnHofCards {v} />{/if}
  {/if}
  <!-- T-10-128 위쪽 '이전으로' 대신 모든 선수에 같은 아래 바: 홈으로 + 공유하기(내 선수) 또는 이전으로. -->
  <ShareBar id={v?.shareId ?? null} back={() => (appState.screen = appState.legendBack)} />
</div>
