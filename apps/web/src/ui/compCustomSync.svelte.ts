// ───────── 대회 · 수상 이름과 리그 · 대회 로고의 계정 동기화 (T-11-684) ─────────
// 맞추는 일은 app-core/compCustomSync가 맡고, 웹은 상태를 Svelte $state로 감싸 넘긴다. 첫 화면 번들에 싣지 않으려고
// 이름표 · 로고 저장(customNames · compIcons)은 이 모듈을 변경이 생겼을 때 동적으로 불러 쓴다.
import { createCompCustomSync, initialCompCustomSyncState } from '@offside/app-core/compCustomSync';
import { adoptCompIcons, compIcons } from './compIcons.svelte.js';
import { adoptCustomNames, customNames } from './customNames.svelte.js';

export const compCustomSync = $state(initialCompCustomSyncState());

export const { markCompCustomDirty, syncCompCustom } = createCompCustomSync(compCustomSync, {
  names: () => $state.snapshot(customNames.map),
  icons: () => $state.snapshot(compIcons.map),
  adoptNames: adoptCustomNames,
  adoptIcons: adoptCompIcons,
});
