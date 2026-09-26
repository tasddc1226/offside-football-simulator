// ───────── 저장본 마이그레이션 (T-10-046) ─────────
// 예전 형식의 ft_save를 지금 게임 로직이 읽는 형식으로 고친다. 화면(ui/boot.ts loadGame)이 불러온 직후 한 번
// 부른다. 저장·업로드 같은 부수 효과는 부른 쪽이 맡는다 — 여기서는 저장본과 활성 RNG만 건드린다.
// 저장 형식을 바꾸면 이 함수에 변환을 더하고 save.test.ts에 옛 저장본 사례를 추가한다.
import { clubsIn, leagueOf } from './engine.js';
import { initSubs, legacyOvr } from './attributes.js';
import { natInit } from './national.js';
import { createRng, freshSeed, setActiveRng } from './rng.js';
import { ensureTitles } from './titles.js';
import type { GameState } from './types.js';

/** 읽을 수 있는 저장 형식 버전. 다른 값이면 저장본을 버리고 새로 시작한다. */
export const SAVE_VERSION = 1;

/** 저장본을 제자리에서 고치고 활성 RNG를 저장된 시드로 되돌린다. newCid: 커리어 ID를 이번에 새로 만들었는지
 * (부른 쪽이 바로 저장해야 한다 — 안 그러면 다음 부팅 때 또 다른 ID가 생겨 서버 기록과 어긋난다). */
export function migrateSave(G: GameState): { newCid: boolean } {
  // 구버전 저장에는 RNG 상태가 없습니다 — 새 시드로 이어서 플레이합니다.
  if (G.rng && typeof G.rng.seed === 'number') setActiveRng(createRng(G.rng.seed));
  else {
    const seed = freshSeed();
    setActiveRng(createRng(seed));
    G.rng = { seed };
  }
  natInit(G);
  // 세부 능력치 도입 이전 저장 데이터: 카드 능력치와 기존 OVR 을 기준으로 세부 능력치를 만듭니다
  // (활성 RNG를 쓰므로 RNG 복원 뒤에 한다).
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
  const newCid = !G.cid;
  if (newCid) G.cid = crypto.randomUUID();
  // T-10-026: 칭호 도입 전 저장 — 이미 채운 조건의 칭호를 조용히 채운다(RNG·인기 변화 없음).
  ensureTitles(G);
  // 구단 이름이 바뀌어도 기존 저장의 현재 소속은 최신 이름으로
  const gClubId = G.club.id;
  const c = clubsIn(G.leagueId)
    .concat(clubsIn('hs'))
    .find((x) => x.id === gClubId);
  if (c) G.club.name = c.name;
  return { newCid };
}
