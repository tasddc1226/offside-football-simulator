// ───────── 저장 로드 (형식 변환은 game/save.ts migrateSave) ─────────
import { legendSnapshot, loadHOF, loadKey, saveKey } from '../game/season.js';
import { createRng, freshSeed, setActiveRng } from '../game/rng.js';
import type { GameState } from '../game/types.js';
import { loadSave } from '../game/save.js';
import { setLatestBalance, useCareerBalance } from '../game/balance.js';
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
  // T-10-009: 유저 클럽 이름을 먼저 CLUBS에 반영해야 아래 '현재 소속 최신 이름' 갱신이 커스텀 이름을 읽는다.
  loadClubCustom();
  migrateLegacySave();
  const loaded = loadSave(loadKey<GameState>('ft_save'));
  const G = loaded?.G ?? null;
  if (loaded) {
    const { G: s, newCid } = loaded;
    // T-10-005: 은퇴 상세 스냅샷 도입 전에 은퇴한 선수. 세이브(ft_save)에 남아 있는 마지막 은퇴 선수만
    // 되살릴 수 있다 — 명예의 전당 항목에 커리어 ID와 상세를 붙이고 서버에도 다시 올린다(기본 익명).
    if (s.retired) {
      const hof = loadHOF();
      const h = hof.find((x) => !x.id && x.name === s.name && x.age === s.age && x.peak === s.peak);
      if (h) {
        h.id = s.cid;
        h.detail = legendSnapshot(s);
        saveKey('ft_hof', hof);
        // cid를 방금 만든 선수는 서버에 커리어가 없다 — 시즌부터 보낸다(이미 있던 cid면 시즌을 다시 보내지
        // 않는다: 시즌 PUT은 upsert라 올라가 있던 선택 로그를 빈 값으로 덮는다).
        if (newCid) uploadLegacyRetirement(s, h);
        else uploadRetirement(s.cid, h);
      }
    }
    // 새로 만든 cid는 바로 저장한다 — 안 그러면 다음 부팅 때 또 다른 cid가 생겨 서버 기록과 어긋난다.
    if (newCid) saveKey('ft_save', s);
  } else {
    setActiveRng(createRng(freshSeed()));
  }
  useCareerBalance(G);
  appState.G = G;
}

/** T-10-016. 앱을 열 때 한 번 최신 밸런스 버전을 받는다. 각 커리어는 다음 시즌 시작부터 이 값을 쓴다.
 * 실패하면(오프라인 등) 저장된 값으로 계속한다. */
export function syncBalance(): void {
  void cachedGet<BalanceConfig>('/v1/balance', 3_600_000).then((r) => {
    if (r.ok) setLatestBalance(r.data);
  });
}
