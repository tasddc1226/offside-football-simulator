// ───────── 대회·수상 이름 바꾸기 반응형 상태 (T-11-647) ─────────
// 저장은 app-core/customNames가 맡고, 웹은 상태를 Svelte $state로 감싸 넘긴다(계정 동기화는 compCustomSync.svelte.ts).
import { createCustomNames, initialCustomNamesState } from '@offside/app-core/customNames';

export const customNames = $state(initialCustomNamesState());

export const {
  loadCustomNames,
  setCustomName,
  resetCustomNames,
  exportCustomNames,
  importCustomNames,
  adoptCustomNames,
} = createCustomNames(
  customNames,
  () => void import('./compCustomSync.svelte.js').then((m) => m.markCompCustomDirty()),
);
