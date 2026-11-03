<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄). 리포트 본문은 LegendReport(T-10-005)로 옮겼다.
  import { appState } from './state.svelte.js';
  import { go, goHome, goNew } from './nav.js';
  import { loadHOF } from '@offside/game/hof-store';
  import { viewFromGame } from './legend.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import OwnHofCards from './OwnHofCards.svelte';
  import ShareBar from './ShareBar.svelte';
  import { retiredText as L } from '@offside/app-core/i18n/ko/retired';

  const v = $derived(viewFromGame(appState.G!));
  // T-11-611 첫 커리어만 끝내고 떠나는 사람이 가장 많다. 첫 은퇴에만 내 구단으로 가는 길을 함께 보여 준다(서버 요청 없이 기기 기록으로 판단).
  const firstRetire = loadHOF().length <= 1;
</script>

<div class="wrap">
  <Topbar />
  <!-- T-10-029: 명예의 전당 공개·다음 버튼은 크레딧 맨 아래에, 공유 버튼은 화면 아래에 고정된다(T-10-067). -->
  <LegendReport {v} fresh={appState.G?.cid}>
    {#snippet end()}
      {#if v.own?.id}<OwnHofCards {v} />{/if}
      {#await import('./AppConversion.svelte') then { default: AppConversion }}<AppConversion context="retire" />{/await}
      <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>{L.newCareer}</button>
      {#if firstRetire}<button class="btn btn-block" data-act="my-club" onclick={() => go('owner')}>{L.myClub}</button>{/if}
      <button class="btn btn-block" data-act="home" onclick={goHome}>{L.seeHof}</button>
    {/snippet}
  </LegendReport>
  {#if v.shareId}<ShareBar id={v.shareId} />{/if}
</div>
