// 홈 하단 메뉴(웹 MainNav.svelte) — 기록실 · 소식 · 홈 · 구단주 · 설정.
import { useSnapshot } from 'valtio';
import type { Screen } from '@offside/app-core/state';
import { appState } from '../store';
import { go, goHome, openBoard, openHof } from '../game/nav';
import { scrollTo } from './scroll';
import { TabBar } from './TabBar';
import { shellText as L } from '@offside/app-core/i18n/ko/shell';

export const MAIN_SCREENS = [
  'hof',
  'board',
  'home',
  'owner',
  'settings',
] as const satisfies readonly Screen[];
export const hasMainNav = (s: Screen) => (MAIN_SCREENS as readonly Screen[]).includes(s);

const label = (k: (typeof MAIN_SCREENS)[number]): string =>
  ({
    hof: L.navHof,
    board: L.navBoard,
    home: L.navHome,
    owner: L.navOwner,
    settings: L.navSettings,
  })[k];
const OPEN: Record<(typeof MAIN_SCREENS)[number], () => void> = {
  hof: openHof,
  // T-10-113 소식 화면에서 다시 누르면 보고 있던 게시판의 목록으로 돌아간다.
  board: () => (appState.screen === 'board' ? appState.boardTop++ : openBoard('notice')),
  home: () => (goHome(), scrollTo(0)),
  owner: () => go('owner'),
  settings: () => go('settings'),
};

export function MainNav() {
  const { screen, achNew } = useSnapshot(appState);
  return (
    <TabBar
      label={L.navLabel}
      items={MAIN_SCREENS.map((k) => ({
        key: k,
        label: label(k),
        active: screen === k,
        onPress: OPEN[k],
        ...(k === 'owner' ? { dot: achNew } : {}),
      }))}
    />
  );
}
