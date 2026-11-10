// ───────── 리그·대회 로고 바꾸기 반응형 상태 (T-11-681) ─────────
// 저장은 app-core/compIcons가 맡고, 웹은 상태를 Svelte $state로 감싸 넘긴다(계정 동기화는 compCustomSync.svelte.ts).
import { createCompIcons, initialCompIconsState } from '@offside/app-core/compIcons';

export const compIcons = $state(initialCompIconsState());

export const {
  loadCompIcons,
  setCompIcon,
  resetCompIcons,
  exportCompIcons,
  importCompIcons,
  dismissCompIconHint,
  adoptCompIcons,
} = createCompIcons(
  compIcons,
  () => void import('./compCustomSync.svelte.js').then((m) => m.markCompCustomDirty()),
);
