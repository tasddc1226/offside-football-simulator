// ───────── 화면 전환 ─────────
// 화면(appState.screen)을 바꾸는 곳. go·openHof·openBoard는 맨 위로 올리고, goHome·goNew·goContinue는
// 스크롤을 그대로 둔다(원래 동작).
import type { BoardKey } from '@offside/contracts/board-limits';
import { confirmNew, nextPending } from './actions.js';
import { closeSheet } from './sheetState.svelte.js';
import { appState, type HofTab, type Screen } from './state.svelte.js';

/** 화면을 바꾸고 맨 위로 올린다. */
export function go(screen: Screen) {
  appState.screen = screen;
  window.scrollTo(0, 0);
}

export function goNew() {
  if (appState.G && !appState.G.retired) return confirmNew();
  appState.screen = 'create';
}
export function goContinue() {
  appState.screen = 'game';
  if (appState.G && appState.G.pending) nextPending();
}
export function goHome() {
  appState.screen = 'home';
  closeSheet();
}
/** 명예의 전당 전체 보기(100명씩 페이지). */
export function openHof(tab: HofTab) {
  appState.hof = { tab, page: 1, sort: 'score' };
  go('hof');
}
/** 소식 화면을 연다. postId가 있으면 그 글을 바로 연다(홈의 소식 섹션에서). */
export function openBoard(board: BoardKey, postId: string | null = null) {
  appState.board = board;
  appState.boardPost = postId;
  go('board');
}
