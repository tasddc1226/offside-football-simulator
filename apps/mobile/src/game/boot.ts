// ───────── 앱 시작 (웹 main.ts · ui/boot.ts와 같은 순서) ─────────
import { AccessibilityInfo, AppState } from 'react-native';
import { setLatestBalance } from '@offside/game/balance';
import type { BalanceConfig } from '@offside/contracts';
import { restoreGame } from '@offside/app-core/career';
import { cachedGet, hasSessionHint } from '@offside/app-core/api/client';
import { flushOutbox } from '@offside/app-core/outbox';
import { NEWS_GAP_MS } from '@offside/app-core/news';
import { ensureSession, loadSession } from '../platform/session';
import { checkStoreUpdate } from '../platform/storeUpdate';
import { checkForUpdate } from '../platform/updates';
import { appState, prefs } from '../store';
import {
  checkNews,
  loadClubCustom,
  syncClubCustom,
  uploadLegacyRetirement,
  uploadRetirement,
  watchRetiredNumberAlerts,
} from './host';

let booted = false;

/** 세이브·세션을 읽고 서버와 맞추기 시작한다. 첫 화면을 그리기 전에 한 번. */
export async function boot(): Promise<void> {
  if (booted) return;
  booted = true;
  await loadSession();
  // 유저 클럽 이름을 먼저 CLUBS에 반영해야 세이브를 읽을 때 현재 소속 이름이 커스텀 이름을 읽는다.
  loadClubCustom();
  appState.G = restoreGame({ uploadRetirement, uploadLegacyRetirement });

  void AccessibilityInfo.isReduceMotionEnabled().then((on) => (prefs.motionOK = !on));
  AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => (prefs.motionOK = !on));

  // 최신 밸런스 — 각 커리어는 다음 시즌부터 쓴다. 실패하면 저장된 값으로.
  void cachedGet<BalanceConfig>('/v1/balance', 3_600_000).then((r) => {
    if (r.ok) setLatestBalance(r.data);
  });
  // 앱 세션이 없으면(첫 실행) 받고, 있으면 서버의 클럽 꾸미기와 맞춘다.
  void ensureSession().then(
    (ok) => ok && hasSessionHint() && void syncClubCustom().catch(() => {}),
  );
  watchRetiredNumberAlerts();
  // 새 소식: 열 때·앱으로 돌아올 때·10분마다. 못 보낸 업로드·새 앱 번들(OTA)·스토어 업데이트도 돌아올 때 다시 본다.
  void checkNews();
  void checkStoreUpdate();
  AppState.addEventListener('change', (st) => {
    if (st !== 'active') return;
    void checkNews();
    void flushOutbox();
    void checkForUpdate();
    void checkStoreUpdate();
  });
  setInterval(() => AppState.currentState === 'active' && void checkNews(), NEWS_GAP_MS);
  void ensureSession().then(() => flushOutbox());
}
