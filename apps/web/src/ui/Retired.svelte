<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄). 리포트 본문은 LegendReport(T-10-005)로 옮겼다.
  import { appState } from './state.svelte.js';
  import { goHome, goNew } from './actions.js';
  import { viewFromGame } from './legend.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import OwnHofCards from './OwnHofCards.svelte';

  const v = $derived(viewFromGame(appState.G!));
</script>

<div class="wrap">
  <Topbar />
  <!-- T-10-029: 크레딧이 끝나면 명예의 전당 공개·공유·다음 버튼이 마지막으로 올라온다. -->
  <LegendReport {v} credits>
    {#snippet end()}
      {#if v.own?.id}<OwnHofCards h={v.own} />{/if}
      <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
      <button class="btn btn-block" data-act="home" onclick={goHome}>명예의 전당 보기</button>
    {/snippet}
  </LegendReport>
</div>
