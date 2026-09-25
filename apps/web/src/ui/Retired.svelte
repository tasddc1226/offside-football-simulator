<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄). 리포트 본문은 LegendReport(T-10-005)로 옮겼다.
  import { tick } from 'svelte';
  import { appState } from './state.svelte.js';
  import { goHome, goNew } from './actions.js';
  import { viewFromGame } from './legend.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import PublishCard from './PublishCard.svelte';
  import ShareCard from './ShareCard.svelte';

  const v = $derived(viewFromGame(appState.G!));
  // T-10-029: 크레딧이 끝나면 명예의 전당 공개·다음 버튼이 마지막으로 올라온다.
  let done = $state(false);
  let endEl = $state<HTMLDivElement | null>(null);
  function onDone(skipped: boolean) {
    done = true;
    if (!skipped) void tick().then(() => endEl?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }
</script>

<div class="wrap">
  <Topbar />
  <LegendReport {v} credits ondone={onDone} />
  {#if done}
    <div class="credit-wrap credit-in" data-credit="end" bind:this={endEl}>
      {#if v.own?.id}<PublishCard h={v.own} /><ShareCard h={v.own} />{/if}
      <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
      <button class="btn btn-block" data-act="home" onclick={goHome}>명예의 전당 보기</button>
    </div>
  {/if}
</div>
