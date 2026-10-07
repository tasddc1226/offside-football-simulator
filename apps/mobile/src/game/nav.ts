// ───────── 화면 전환 (웹 ui/nav.ts와 같은 동작) ─────────
// go·openHof·openBoard는 맨 위로 올리고, goHome·goNew·goContinue는 스크롤을 그대로 둔다.
import type { BoardKey } from '@offside/contracts/board-limits';
import { hofStart, type Screen } from '@offside/app-core/state';
import { appState } from '../store';
import { scrollTo } from '../ui/scroll';
import { closeSheet, confirmNew, navStack, nextPending } from './host';

/** 화면을 바꾸고 맨 위로 올린다. */
export function go(screen: Screen) {
  appState.screen = screen;
  scrollTo(0);
}

// T-11-141 설정 '확률과 공정성' → 확률 도감을 열고 그 칸을 펼쳐 둔다(한 번만 읽힌다, 웹 ui/nav.ts).
let fairnessFocus = false;
export function goFairness() {
  fairnessFocus = true;
  go('dex');
}
export function takeFairnessFocus(): boolean {
  const v = fairnessFocus;
  fairnessFocus = false;
  return v;
}
export function goNew() {
  if (appState.G && !appState.G.retired) return confirmNew();
  appState.screen = 'create';
}
export function goContinue() {
  appState.screen = 'game';
  // 이어할 이벤트·결산이 있으면 시트를 연다.
  if (appState.G?.pending) nextPending();
}
export function goHome() {
  appState.screen = 'home';
  closeSheet();
}
/** 명예의 전당 전체 보기(100명씩 페이지). */
export function openHof() {
  appState.hof = hofStart();
  go('hof');
}
/** 소식 화면을 연다. postId가 있으면 그 글을 바로 연다. */
export function openBoard(board: BoardKey, postId: string | null = null) {
  appState.board = board;
  appState.boardOpenId = postId;
  go('board');
}
/** '← 이전으로'(BackBar): 이전 기록이 있으면 되살리고, 없으면 fallback. */
export function goBack(fallback: () => void) {
  if (!navStack.back()) fallback();
}
