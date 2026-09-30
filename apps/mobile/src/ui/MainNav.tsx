// 홈 하단 메뉴(웹 MainNav.svelte) — 기록실 · 소식 · 홈 · 구단주 · 설정.
import { useSnapshot } from 'valtio';
import type { Screen } from '@offside/app-core/state';
import { appState } from '../store';
import { go, goHome, openBoard, openHof } from '../game/nav';
import { scrollTo } from './scroll';
import { TabBar } from './TabBar';

export const MAIN_SCREENS = [
  'hof',
  'board',
  'home',
  'owner',
  'settings',
] as const satisfies readonly Screen[];
export const hasMainNav = (s: Screen) => (MAIN_SCREENS as readonly Screen[]).includes(s);

const LABEL: Record<(typeof MAIN_SCREENS)[number], string> = {
  hof: '기록실',
  board: '소식',
  home: '홈',
  owner: '구단주',
  settings: '설정',
};
const OPEN: Record<(typeof MAIN_SCREENS)[number], () => void> = {
  hof: openHof,
  // T-10-113 소식 화면에서 다시 누르면 보고 있던 게시판의 목록으로 돌아간다.
  board: () => (appState.screen === 'board' ? appState.boardTop++ : openBoard('notice')),
  home: () => (goHome(), scrollTo(0)),
  owner: () => go('owner'),
  settings: () => go('settings'),
};

export function MainNav() {
  const { screen } = useSnapshot(appState);
  return (
    <TabBar
      label="메인 메뉴"
      items={MAIN_SCREENS.map((k) => ({
        key: k,
        label: LABEL[k],
        active: screen === k,
        onPress: OPEN[k],
      }))}
    />
  );
}
