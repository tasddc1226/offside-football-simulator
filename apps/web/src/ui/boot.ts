// ───────── 저장 로드 + 마이그레이션 (ui.ts 47~88줄 포트) ─────────
import { clubsIn, leagueOf } from '../game/engine.js';
import { initSubs, legacyOvr } from '../game/attributes.js';
import { natInit } from '../game/national.js';
import { legendSnapshot, loadHOF, loadKey, saveKey } from '../game/season.js';
import { createRng, freshSeed, setActiveRng } from '../game/rng.js';
import type { GameState } from '../game/types.js';
import { setLatestBalance, useCareerBalance } from '../game/balance.js';
import { cachedGet } from '../api/client.js';
import { appState } from './state.svelte.js';
import { uploadRetirement } from './helpers.js';
import { loadClubCustom } from './clubCustom.svelte.js';

export function loadGame() {
  // T-10-009: 유저 클럽 이름을 먼저 CLUBS에 반영해야 아래 '현재 소속 최신 이름' 갱신이 커스텀 이름을 읽는다.
  loadClubCustom();
  let G: GameState | null = loadKey<GameState>('ft_save') || loadKey<GameState>('sl_save');
  if (G && G.v !== 1) G = null;
  if (G) {
    // 구버전 저장에는 RNG 상태가 없습니다 — 새 시드로 이어서 플레이합니다.
    if (G.rng && typeof G.rng.seed === 'number') setActiveRng(createRng(G.rng.seed));
    else {
      const seed = freshSeed();
      setActiveRng(createRng(seed));
      G.rng = { seed };
    }
    natInit(G);
    // 세부 능력치 도입 이전 저장 데이터: 카드 능력치와 기존 OVR 을 기준으로 세부 능력치를 만듭니다
    if (!G.sub) {
      const a = { ...G.attrs };
      initSubs(G, a, legacyOvr(G.pos, a));
      G.seasonStart = { ...G.attrs };
    }
    if (!G.seasonStartSub) G.seasonStartSub = { ...G.sub };
    // 숨은 잠재력(bloom) 도입 전 저장: 스카우트 평가 = 실제 잠재력으로 시작
    if (G.bloom == null) G.bloom = 0;
    // 4구간 → 전반기/후반기 저장 데이터 변환
    if (!G.halves) {
      const tot = leagueOf(G.leagueId).matches;
      const S = G.season || ({ played: 0 } as GameState['season']);
      G.phase = G.phase >= 5 ? 3 : G.phase === 0 ? 0 : S.played < tot / 2 ? 1 : 2;
      (G.chains || []).forEach((c) => {
        c.at = Math.round((c.at * 3) / 5);
        c.until = Math.round((c.until * 3) / 5);
      });
      G.halves = 1;
    }
    // T-9-009: cid(커리어 고유 ID) 도입 이전 저장에는 cid가 없다 — 새로 만들어 채운다. RNG는
    // 절대 쓰지 않는다(crypto.randomUUID()).
    if (!G.cid) G.cid = crypto.randomUUID();
    // 구단 이름이 바뀌어도 기존 저장의 현재 소속은 최신 이름으로
    const gClubId = G.club.id;
    const c = clubsIn(G.leagueId)
      .concat(clubsIn('hs'))
      .find((x) => x.id === gClubId);
    if (c) G.club.name = c.name;
    // T-10-005: 은퇴 상세 스냅샷 도입 전에 은퇴한 선수. 세이브(ft_save)에 남아 있는 마지막 은퇴 선수만
    // 되살릴 수 있다 — 명예의 전당 항목에 커리어 ID와 상세를 붙이고 서버에도 다시 올린다(기본 익명).
    if (G.retired) {
      const s = G;
      const hof = loadHOF();
      const h = hof.find((x) => !x.id && x.name === s.name && x.age === s.age && x.peak === s.peak);
      if (h) {
        h.id = s.cid;
        h.detail = legendSnapshot(s);
        saveKey('ft_hof', hof);
        uploadRetirement(s.cid, h);
      }
    }
  } else {
    setActiveRng(createRng(freshSeed()));
  }
  useCareerBalance(G);
  appState.G = G;
}

/** T-10-016. 앱을 열 때 한 번 최신 밸런스 버전을 받는다. 각 커리어는 다음 시즌 시작부터 이 값을 쓴다.
 * 실패하면(오프라인 등) 저장된 값으로 계속한다. */
export function syncBalance(): void {
  void cachedGet<{ version: number; values: unknown }>('/v1/balance', 3_600_000).then((r) => {
    if (r.ok) setLatestBalance(r.data);
  });
}
