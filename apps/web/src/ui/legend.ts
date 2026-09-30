// ───────── T-10-005 은퇴 선수 상세 · 공개 명예의 전당 ─────────
// 상세 뷰 만들기·열기는 app-core/legend가 맡는다. 웹은 공유 링크 경로만 따로 둔다.
import { createLegends } from '@offside/app-core/legend';
import { appState } from './state.svelte.js';
import { toast, uploadRetirement } from './helpers.js';
import { SHARE_PATH } from '../share-path.js';
import { rnOf } from './retiredNumber.svelte.js';

export const {
  viewFromEntry,
  viewFromGame,
  openLocalLegend,
  openPublicLegend,
  openPublicLegendById,
  setLegendPublic,
  loadSharedLegend,
} = createLegends({
  state: appState,
  rnOf,
  toast,
  uploadRetirement,
  scrollTop: () => window.scrollTo(0, 0),
});

// ───────── T-10-029 은퇴 커리어 공유 링크 ─────────
// 링크는 `/career/<커리어 id>` — 공개 명예의 전당 상세(/v1/hof/:id)를 보기 전용 화면(SharedCareer)으로
// 그린다. 커리어 id는 클라이언트가 만든 UUID라 추측할 수 없다. 워커(worker.ts APP_PATHS)가 앱 셸로 내려 준다.
export const shareUrl = (careerId: string) => `${window.location.origin}/career/${careerId}`;

/** 공유 링크로 들어왔으면 보기 전용 화면을 연다(앱 시작 때 한 번). */
export function routeSharedCareer() {
  const m = SHARE_PATH.exec(window.location.pathname);
  if (!m) return;
  appState.sharedCareer = m[1]!.toLowerCase();
  appState.screen = 'shared';
}
