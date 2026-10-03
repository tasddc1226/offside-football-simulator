<script lang="ts">
  // T-11-026 내 팀 하단 메뉴 — 편성 · 경기 · (가운데) 구단주 · 업적 · 기록. 경기 결과는 '경기' 탭 안이다.
  import { go } from '../nav.js';
  import { appState, type TeamView } from '../state.svelte.js';
  import TabIcon from '../TabIcon.svelte';
  import NavIntro from '../NavIntro.svelte';

  let { navOn, onswitch }: { navOn: TeamView; onswitch: (v: TeamView) => void } = $props();

  const NAV: [TeamView, string, 'lineup' | 'season' | 'trophy' | 'career'][] = [
    ['team', '편성', 'lineup'],
    ['opponents', '경기', 'season'],
    ['achievements', '업적', 'trophy'],
    ['history', '경기 기록', 'career'],
  ];
</script>

<!-- 내 팀 탭 4개 + 가운데 구단주(게임 화면 탭바와 같은 모양). 구단주는 화면을 떠나는 버튼이라 tablist 밖에 둔다. -->
<nav class="tabs sub-nav" aria-label="내 팀 메뉴">
  <div class="tabs-inner" role="tablist">
    {#each NAV as [k, l, icon], i (k)}
      <button role="tab" data-team-tab={k} aria-selected={navOn === k} style:--i={i < 2 ? i : i + 1} onclick={() => onswitch(k)}>
        <TabIcon name={icon} />{l}
        {#if k === 'achievements' && appState.achNew}<span class="tab-dot"><span class="sr-only">새 업적 {appState.achNew}개</span></span>{/if}
      </button>
    {/each}
  </div>
  <button class="tab-home" data-act="team-back" style:--i={2} onclick={() => go('owner')}>
    <TabIcon name="owner" />구단주
  </button>
  <NavIntro kind="team" />
</nav>
