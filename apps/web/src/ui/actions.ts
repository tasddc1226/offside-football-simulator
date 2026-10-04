// ───────── 게임 진행 액션 ─────────
// 진행 로직(게임 로직 호출 순서·시트 뷰 모델)은 웹·앱 공용(@offside/app-core/game-actions, T-11-002)이다.
// 웹은 Svelte 상태·시트·저장·업로드·분석을 넘긴다.
import { createGameActions } from '@offside/app-core/game-actions';
import { analytics, trackPage } from '../analytics/index.js';
import { appState } from './state.svelte.js';
import { save, toast, uploadSeason, uploadRetirement } from './helpers.js';
import { motionOK } from './motion.js';
import { sheet } from './sheetState.svelte.js';

export const {
  advance,
  nextPending,
  chooseEvent,
  pickOption,
  doRetire,
  confirmNew,
  retireAsk,
  startCareer,
  rollCandidates,
} = createGameActions({
  state: appState,
  sheet,
  save,
  toast,
  scrollTop: (smooth) =>
    window.scrollTo(smooth ? { top: 0, behavior: motionOK ? 'smooth' : 'auto' } : { top: 0 }),
  uploadSeason,
  uploadRetirement,
  analytics,
  trackPage,
});
