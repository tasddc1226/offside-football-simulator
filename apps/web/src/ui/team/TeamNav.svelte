<script lang="ts">
  // T-11-026 내 팀 하단 메뉴 — 편성 · 경기 · (가운데) 구단주 · 업적 · 기록. 경기 결과는 '경기' 탭 안이다.
  import { go } from '../nav.js';
  import { appState, type TeamView } from '../state.svelte.js';
  import TabIcon from '../TabIcon.svelte';
  import NavIntro from '../NavIntro.svelte';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { shellText as S } from '@offside/app-core/i18n/ko/shell';

  let { navOn, onswitch }: { navOn: TeamView; onswitch: (v: TeamView) => void } = $props();

  const nav = (): [TeamView, string, 'lineup' | 'season' | 'trophy' | 'career'][] => [
    ['team', L.navLineup, 'lineup'],
    ['opponents', L.navMatches, 'season'],
    ['achievements', L.navAch, 'trophy'],
    ['history', L.navHistory, 'career'],
  ];
</script>

<!-- 내 팀 탭 4개 + 가운데 구단주(게임 화면 탭바와 같은 모양). 구단주는 화면을 떠나는 버튼이라 tablist 밖에 둔다. -->
<nav class="tabs sub-nav" aria-label={L.navLabel}>
  <div class="tabs-inner" role="tablist">
    {#each nav() as [k, l, icon], i (k)}
      <button role="tab" data-team-tab={k} aria-selected={navOn === k} style:--i={i < 2 ? i : i + 1} onclick={() => onswitch(k)}>
        <TabIcon name={icon} />{l}
        {#if k === 'achievements' && appState.achNew}<span class="tab-dot"><span class="sr-only">{L.navNewAch({ n: appState.achNew })}</span></span>{/if}
        {#if k === 'opponents' && appState.friendReq}<span class="tab-dot" data-friend-dot><span class="sr-only">{S.friendReq({ n: appState.friendReq })}</span></span>{/if}
      </button>
    {/each}
  </div>
  <button class="tab-home" data-act="team-back" style:--i={2} onclick={() => go('owner')}>
    <TabIcon name="owner" />{L.navOwner}
  </button>
  <NavIntro kind="team" />
</nav>
