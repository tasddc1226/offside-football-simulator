<script lang="ts">
  // 기록실(하단 메뉴) — 명예의 전당 전체 보기(100명씩 페이지)와 영구결번(T-10-076), 라이브 랭킹(팀 랭킹, T-10-092)을
  // 탭으로 오간다.
  import HallOfFame from './HallOfFame.svelte';
  import RetiredWall from './RetiredWall.svelte';
  import TeamRanking from './team/TeamRanking.svelte';
  import Topbar from './Topbar.svelte';
  import { appState, type HofTab } from './state.svelte.js';

  const TABS: Record<HofTab, string> = { legends: '명예의 전당', rn: '영구결번', teams: '팀 랭킹' };
</script>

<div class="wrap">
  <Topbar />
  <div class="seg board-tabs hof-tabs" role="group" aria-label="기록실">
    {#each Object.entries(TABS) as [k, label] (k)}
      <button class="opt" aria-pressed={appState.hof.tab === k} data-hof-tab={k} onclick={() => (appState.hof.tab = k as HofTab)}>{label}</button>
    {/each}
  </div>
  {#if appState.hof.tab === 'rn'}
    <RetiredWall />
  {:else if appState.hof.tab === 'teams'}
    <TeamRanking />
  {:else}
    <HallOfFame full />
  {/if}
</div>
