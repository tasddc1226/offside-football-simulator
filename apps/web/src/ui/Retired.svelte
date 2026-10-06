<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄). 리포트 본문은 LegendReport(T-10-005)로 옮겼다.
  import { appState } from './state.svelte.js';
  import { goHome, goNew } from './nav.js';
  import { viewFromGame } from './legend.js';
  import AdSlot from '../ads/AdSlot.svelte';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import OwnHofCards from './OwnHofCards.svelte';
  import ShareBar from './ShareBar.svelte';

  const v = $derived(viewFromGame(appState.G!));
</script>

<div class="wrap">
  <Topbar />
  <!-- T-10-029: 명예의 전당 공개·다음 버튼은 크레딧 맨 아래에, 공유 버튼은 화면 아래에 고정된다(T-10-067). -->
  <LegendReport {v}>
    {#snippet end()}
      {#if v.own?.id}<OwnHofCards {v} />{/if}
      <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
      <button class="btn btn-block" data-act="home" onclick={goHome}>명예의 전당 보기</button>
    {/snippet}
  </LegendReport>
  <!-- T-11-108: 결산과 다음 행동 버튼을 모두 지난 뒤, 본문과 함께 스크롤되는 광고 한 칸. -->
  <AdSlot place="retired-bottom" />
  {#if v.shareId}<ShareBar id={v.shareId} />{/if}
</div>
