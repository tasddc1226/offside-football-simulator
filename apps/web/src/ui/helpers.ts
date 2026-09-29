// ───────── 저장 · 업로드 · 토스트 (ui.ts 43~142줄 포트) ─────────
// 업로드 본문·순서는 웹·앱 공용(@offside/app-core/upload, T-11-002). 큐 모듈은 동적 import로 메인 청크와 분리한다.
import { createUploader } from '@offside/app-core/upload';
import { appState, toastState } from './state.svelte.js';
import { takePlaySignals } from '../sync/playSignals.js';

import { saveGame } from '@offside/app-core/career';

export { pushEvLog, seasonLabel } from '@offside/app-core/career';

// T-9-009: 빌드 시 vite define으로 커밋 SHA가 들어온다(vite.config.ts). 테스트 등 define이 없는
// 환경은 'dev'.
declare const __APP_VERSION__: string | undefined;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

// T-10-116 세이브는 이 브라우저 localStorage에만 있다 — 용량 초과로 못 쓰면 한 번만 알리고 백업을 안내한다.
let saveWarned = false;
export function save() {
  const s = appState.G;
  const ok = saveGame(s);
  if (!s) return;
  if (ok) return void keepStorage();
  if (saveWarned) return;
  saveWarned = true;
  toast('저장 공간이 부족해 진행 상황을 저장하지 못했어요. 설정에서 백업해 두세요.');
}

/** T-10-116 브라우저가 저장소를 함부로 지우지 않게 '영구 저장'을 한 번 요청한다(UI 없음, 실패해도 무시).
 * 진행 중 세이브가 있을 때만 — Firefox는 이 요청에 권한 안내를 띄운다. */
let keepAsked = false;
export function keepStorage() {
  if (keepAsked) return;
  keepAsked = true;
  try {
    const st = navigator.storage;
    void st
      ?.persisted?.()
      .then((p) => (p ? undefined : st.persist?.()))
      .catch(() => {});
  } catch {
    // 지원하지 않는 브라우저
  }
}

const uploader = createUploader({
  outbox: () => import('../sync/outbox.js'),
  appVersion: APP_VERSION,
  signals: takePlaySignals,
});
export const { uploadSeason, uploadRetirement, uploadLegacyRetirement, enqueueAllSeasons } =
  uploader;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(t: string) {
  toastState.text = t;
  toastState.visible = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastState.visible = false), 2200);
}
