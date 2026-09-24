<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄). 리포트 본문은 LegendReport(T-10-005)로 옮겼다.
  import { appState } from './state.svelte.js';
  import { goHome, goNew } from './actions.js';
  import { viewFromGame } from './legend.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import PublishCard from './PublishCard.svelte';

  const v = $derived(viewFromGame(appState.G!));
</script>

<div class="wrap">
  <Topbar />
  <LegendReport {v} />
  {#if v.own?.id}<PublishCard h={v.own} />{/if}
  <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
  <button class="btn btn-block" data-act="home" onclick={goHome}>명예의 전당 보기</button>
</div>
