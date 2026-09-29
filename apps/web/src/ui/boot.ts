// ───────── 저장 로드 (세이브 복원은 웹·앱 공용 @offside/app-core/career restoreGame) ─────────
import { setLatestBalance } from '@offside/game/balance';
import { restoreGame } from '@offside/app-core/career';
import { cachedGet } from '../api/client.js';
import type { BalanceConfig } from '@offside/contracts';
import { appState } from './state.svelte.js';
import { uploadLegacyRetirement, uploadRetirement } from './helpers.js';
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

export function loadGame() {
  // T-10-009: 유저 클럽 이름을 먼저 CLUBS에 반영해야 세이브를 읽을 때 '현재 소속 최신 이름' 갱신이 커스텀 이름을 읽는다.
  loadClubCustom();
  migrateLegacySave();
  appState.G = restoreGame({ uploadRetirement, uploadLegacyRetirement });
}

/** T-10-016. 앱을 열 때 한 번 최신 밸런스 버전을 받는다. 각 커리어는 다음 시즌 시작부터 이 값을 쓴다.
 * 실패하면(오프라인 등) 저장된 값으로 계속한다. */
export function syncBalance(): void {
  void cachedGet<BalanceConfig>('/v1/balance', 3_600_000).then((r) => {
    if (r.ok) setLatestBalance(r.data);
  });
}
