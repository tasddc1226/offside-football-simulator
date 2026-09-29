// ───────── 화면 전환 ─────────
// 화면(appState.screen)을 바꾸는 곳. go·openHof·openBoard는 맨 위로 올리고, goHome·goNew·goContinue는
// 스크롤을 그대로 둔다(원래 동작).
import type { BoardKey } from '@offside/contracts/board-limits';
import { loadGameSheets } from './sheets/gameSheets.svelte.js';
import { closeSheet } from './sheetState.svelte.js';
import { appState, hofStart, type Screen } from './state.svelte.js';

/** 화면을 바꾸고 맨 위로 올린다. */
export function go(screen: Screen) {
  appState.screen = screen;
  window.scrollTo(0, 0);
}

// T-10-104: 게임 화면·액션(게임 엔진 포함)·게임 시트 본문은 홈에서 바로 쓰지 않아 첫 화면 번들에서 뗐다. 누르는 순간
// 불러오되, 홈이 한가할 때(main.ts)나 버튼에 손이 닿을 때(warmGame) 미리 받아 둬 첫 클릭이 느리지 않게 한다.
const loadActions = () => Promise.all([import('./actions.js'), loadGameSheets()]).then(([a]) => a);
/** 게임 진입에 필요한 청크를 미리 받아 둔다(실행은 안 한다). 실패해도 클릭 때 다시 시도한다. */
export function warmGame() {
  void Promise.all([import('./Game.svelte'), loadActions()]).catch(() => {});
}

export function goNew() {
  if (appState.G && !appState.G.retired) return void loadActions().then((a) => a.confirmNew());
  appState.screen = 'create';
  warmGame(); // 선수를 만드는 동안 게임 청크를 받아 둔다.
}
export function goContinue() {
  appState.screen = 'game';
  // 이어할 이벤트·결산이 있으면 게임 청크가 온 뒤 시트를 연다(Game 화면은 App이 같은 청크를 불러 그린다).
  if (appState.G && appState.G.pending) void loadActions().then((a) => a.nextPending());
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
/** 소식 화면을 연다. postId가 있으면 그 글을 바로 연다(홈의 소식 섹션에서). */
export function openBoard(board: BoardKey, postId: string | null = null) {
  appState.board = board;
  appState.boardPost = postId;
  go('board');
}
