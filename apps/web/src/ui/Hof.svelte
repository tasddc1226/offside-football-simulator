<script lang="ts">
  // 기록실(하단 메뉴) — 명예의 전당 전체 보기(100명씩 페이지)와 영구결번(T-10-076), 라이브 랭킹(팀 랭킹, T-10-092)을
  // 탭으로 오간다. T-11-028 구단주 랭킹(구단주 시즌 업적 점수)을 더했다.
  import AdSlot from '../ads/AdSlot.svelte';
  import HallOfFame from './HallOfFame.svelte';
  import RetiredWall from './RetiredWall.svelte';
  import AchievementRanking from './team/AchievementRanking.svelte';
  import TeamRanking from './team/TeamRanking.svelte';
  import Topbar from './Topbar.svelte';
  import { appState, type HofTab } from './state.svelte.js';

  const TABS: Record<HofTab, string> = {
    legends: '명예의 전당',
    rn: '영구결번',
    teams: '팀 랭킹',
    ach: '구단주 랭킹',
  };

  const tabKeys = Object.keys(TABS) as HofTab[];
  function onTabKey(event: KeyboardEvent, tab: HofTab) {
    const index = tabKeys.indexOf(tab);
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabKeys.length;
    else if (event.key === 'ArrowLeft') next = (index + tabKeys.length - 1) % tabKeys.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabKeys.length - 1;
    else return;
    event.preventDefault();
    document.getElementById(`hof-tab-${tabKeys[next]}`)?.focus();
  }
</script>

<div class="wrap">
  <Topbar />
  <h1 class="sr-only">{TABS[appState.hof.tab]}</h1>
  <div class="hof-tabs" role="tablist" aria-label="기록실">
    {#each Object.entries(TABS) as [k, label] (k)}
      <button type="button" role="tab" id="hof-tab-{k}" aria-selected={appState.hof.tab === k} aria-controls="hof-tab-panel" tabindex={appState.hof.tab === k ? 0 : -1} data-hof-tab={k} onclick={() => (appState.hof.tab = k as HofTab)} onkeydown={(event) => onTabKey(event, k as HofTab)}>{label}</button>
    {/each}
  </div>
  <div id="hof-tab-panel" role="tabpanel" aria-labelledby="hof-tab-{appState.hof.tab}" tabindex="0">
    {#if appState.hof.tab === 'rn'}
      <RetiredWall />
    {:else if appState.hof.tab === 'teams'}
      <TeamRanking />
      <AdSlot place="records-bottom" />
    {:else if appState.hof.tab === 'ach'}
      <AchievementRanking />
    {:else}
      <HallOfFame full />
      <AdSlot place="records-bottom" />
    {/if}
  </div>
</div>
