// ───────── 저장 로드 (세이브 복원은 웹·앱 공용 @offside/app-core/career restoreGame) ─────────
import { syncClubStrength } from '@offside/app-core/club-strength-sync';
import { setLatestBalance } from '@offside/game/balance';
import {
  restoreGame,
  takePhaseReport,
  configureCareerActivityReporter,
  noteCareerActivity,
} from '@offside/app-core/career';
import { cachedGet } from '@offside/app-core/api/client';
import type { BalanceConfig } from '@offside/contracts';
import { appState } from './state.svelte.js';
// Existing local retirement data remains the source while the upload code loads.
const uploadRetirement: (typeof import('./uploads.js'))['uploadRetirement'] = (...args) =>
  void import('./uploads.js').then((m) => m.uploadRetirement(...args));
const uploadLegacyRetirement: (typeof import('./uploads.js'))['uploadLegacyRetirement'] = (
  ...args
) => void import('./uploads.js').then((m) => m.uploadLegacyRetirement(...args));
import { loadClubCustom } from './clubCustom.svelte.js';

/** 아주 오래된 저장 키(sl_save)를 한 번만 ft_save로 옮기고 지운다. 예전엔 부팅마다 ft_save가 비어 있으면
 * sl_save를 읽어서, 새 커리어를 막 시작한 직후(아직 ft_save가 없을 때) 새로고침하면 옛 선수가 되살아났다. */
function migrateLegacySave() {
  try {
    const old = localStorage.getItem('sl_save');
    if (old == null) return;
    if (localStorage.getItem('ft_save') == null) localStorage.setItem('ft_save', old);
    localStorage.removeItem('sl_save');
  } catch {
    // 저장소 차단 — 옮기지 못하면 옛 선수는 읽지 않는다.
  }
}

let activityReady = false;
export function loadGame() {
  // T-10-009: 유저 클럽 이름을 먼저 CLUBS에 반영해야 세이브를 읽을 때 '현재 소속 최신 이름' 갱신이 커스텀 이름을 읽는다.
  loadClubCustom();
  migrateLegacySave();
  appState.G = restoreGame({ uploadRetirement, uploadLegacyRetirement });
  // T-11-438 중계 도중 끊긴 구간 리포트가 있으면 시즌 탭 맨 위에 다시 보여 준다.
  appState.report = takePhaseReport(appState.G) ?? appState.report;
  if (!activityReady) {
    activityReady = true;
    void import('@offside/app-core/careerActivity')
      .then((m) => {
        m.setCareerActivityActive(document.visibilityState !== 'hidden');
        configureCareerActivityReporter((input) => {
          void m.reportCareerActivity(input);
        });
        noteCareerActivity(appState.G);
        document.addEventListener('visibilitychange', () => {
          m.setCareerActivityActive(document.visibilityState !== 'hidden');
          if (document.visibilityState === 'visible') noteCareerActivity(appState.G);
        });
        window.addEventListener('online', () => void m.flushCareerActivity());
      })
      .catch(() => {
        activityReady = false;
      });
  }
}

/** T-10-016. 앱을 열 때 한 번 최신 밸런스 버전을 받는다. 각 커리어는 다음 시즌 시작부터 이 값을 쓴다.
 * 실패하면(오프라인 등) 저장된 값으로 계속한다. */
export function syncBalance(): void {
  syncClubStrength();
  void cachedGet<BalanceConfig>('/v1/balance', 3_600_000).then((r) => {
    if (r.ok) setLatestBalance(r.data);
  });
}
