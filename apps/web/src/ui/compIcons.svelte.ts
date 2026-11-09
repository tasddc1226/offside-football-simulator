// ───────── 리그·대회 로고 바꾸기 반응형 상태 (T-11-679) ─────────
// 저장은 app-core/compIcons가 맡고, 웹은 상태를 Svelte $state로 감싸 넘긴다(이 기기에만 저장, 서버 동기화 없음).
import { createCompIcons, initialCompIconsState } from '@offside/app-core/compIcons';

export const compIcons = $state(initialCompIconsState());

export const {
  loadCompIcons,
  setCompIcon,
  resetCompIcons,
  exportCompIcons,
  importCompIcons,
  dismissCompIconHint,
} = createCompIcons(compIcons);
