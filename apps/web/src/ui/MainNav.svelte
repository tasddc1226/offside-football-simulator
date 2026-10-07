<script lang="ts" module>
  import type { Screen } from './state.svelte.js';
  /** 하단 메뉴가 붙는 화면(메뉴 항목과 같다). */
  export const MAIN_SCREENS = ['hof', 'board', 'home', 'owner', 'settings'] as const satisfies readonly Screen[];
  export const hasMainNav = (s: Screen) => (MAIN_SCREENS as readonly Screen[]).includes(s);
</script>

<script lang="ts">
  // 홈 화면 하단 메뉴(T-10-058) — 기록실 · 소식 · 홈 · 구단주 · 설정. 게임 화면 탭바와 같은 모양에
  // 홈을 가운데 둔다. 화면을 옮기는 메뉴라 tablist가 아니라 버튼 + aria-current로 지금 화면을 표시한다.
  import { appState } from './state.svelte.js';
  import { go, goHome, openBoard, openHof } from './nav.js';
  import TabIcon from './TabIcon.svelte';
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';

  const label = (k: (typeof MAIN_SCREENS)[number]): string =>
    ({ hof: L.navHof, board: L.navBoard, home: L.navHome, owner: L.navOwner, settings: L.navSettings })[k];
  const OPEN: Record<(typeof MAIN_SCREENS)[number], () => void> = {
    hof: openHof,
    // T-10-113 소식 화면에서 다시 누르면 보고 있던 게시판의 목록으로 돌아간다.
    board: () => (appState.screen === 'board' ? appState.boardTop++ : openBoard('notice')),
    home: () => (goHome(), window.scrollTo(0, 0)),
    owner: () => go('owner'),
    settings: () => go('settings'),
  };
</script>

<nav class="tabs main-nav" aria-label={L.navLabel}>
  {#each MAIN_SCREENS as k, i (k)}
    <button data-act={k} aria-current={appState.screen === k ? 'page' : undefined} style:--i={i} onclick={OPEN[k]}>
      <TabIcon name={k} />{label(k)}
      {#if k === 'owner' && (appState.friendReq || appState.achNew || appState.recapNew)}<span class="tab-dot" data-tab-dot><span class="sr-only">{appState.friendReq ? L.friendReq({ n: appState.friendReq }) : appState.achNew ? L.achNew({ n: appState.achNew }) : L.recapNew}</span></span>{/if}
    </button>
  {/each}
</nav>
