// T-11-605 선수 만들기 입력을 이 탭의 sessionStorage에 둔다. 새로 고침해도 고르던 입력과 단계가 남고, 탭을 닫으면 사라진다
// (다시 열면 기본값인 T-11-294는 그대로). 저장소가 막힌 환경이면 저장 없이 평소처럼 쓴다.
import { parseCreateDraft } from '@offside/app-core/create-steps';
import { appState } from './state.svelte.js';

const KEY = 'ft_create_draft';

export function saveCreateDraft(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ C: appState.C, step: appState.createStep }));
  } catch {
    // 저장하지 못해도 화면은 그대로 쓴다.
  }
}

export function clearCreateDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 지우지 못해도 다음 저장에서 덮어쓴다.
  }
}

/** 이어 쓸 입력이 있으면 appState에 넣고 true. 이 탭에서 앱을 연 뒤 첫 진입만 되살린다(이후로는 메모리의 입력이 최신이다). */
let restored = false;
export function restoreCreateDraft(): boolean {
  if (restored) return false;
  restored = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    const v = raw ? parseCreateDraft(JSON.parse(raw)) : null;
    if (!v) return false;
    Object.assign(appState.C, v.draft);
    appState.createStep = v.step;
    return true;
  } catch {
    return false;
  }
}
