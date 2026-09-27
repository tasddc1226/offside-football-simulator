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

  const LABEL: Record<(typeof MAIN_SCREENS)[number], string> = {
    hof: '기록실',
    board: '소식',
    home: '홈',
    owner: '구단주',
    settings: '설정',
  };
  const OPEN: Record<(typeof MAIN_SCREENS)[number], () => void> = {
    hof: openHof,
    board: () => openBoard('notice'),
    home: () => (goHome(), window.scrollTo(0, 0)),
    owner: () => go('owner'),
    settings: () => go('settings'),
  };
</script>

<nav class="tabs main-nav" aria-label="메인 메뉴">
  {#each MAIN_SCREENS as k (k)}
    <button data-act={k} aria-current={appState.screen === k ? 'page' : undefined} onclick={OPEN[k]}>
      <TabIcon name={k} />{LABEL[k]}
    </button>
  {/each}
</nav>
