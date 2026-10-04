// ───────── 반응형 앱 상태 ─────────
// 상태의 모양·처음 값은 웹·앱 공용(@offside/app-core/state, T-11-002)이다. 웹은 Svelte 5 `$state`로 감싸
// 컴포넌트가 구독한다(원본 ui.ts의 수동 render() 대신).
import { initialAppState, type AppState } from '@offside/app-core/state';

export * from '@offside/app-core/state';

export const appState = $state<AppState>(initialAppState());

export const toastState = $state<{ text: string; visible: boolean }>({ text: '', visible: false });
