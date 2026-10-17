// T-11-338 진행 중인 감독 커리어 이어 하기 카드(홈 · 내 구단 맨 위). 감독 엔진(@offside/game/manager)을 끌어오지 않고 기기
// 세이브에서 보여 줄 값만 읽는다 — 홈은 첫 화면 번들이라 엔진을 import하면 예산을 넘는다. 서버는 부르지 않는다.
import { loadKey } from '@offside/game/storage';

/** @offside/game/manager의 MANAGER_SAVE_KEY와 같다(테스트가 확인한다). */
export const MANAGER_RESUME_KEY = 'ft_mgr_save';

export interface ManagerResume {
  /** 선수 시절 이름(이 기기에만 있다). */
  name: string | null;
  /** 지금 구단 이름(저장값, 한국어). 제의를 고르는 중이면 null. */
  club: string | null;
  /** 지금 치르는 시즌(1부터, 총 시즌을 넘지 않는다). */
  n: number;
  total: number;
  /** 끝까지 치르고 감독 카드로 확정만 남았다. */
  done: boolean;
}

type Saved = {
  id?: unknown;
  name?: unknown;
  club?: { name?: unknown } | null;
  season?: unknown;
  seasonsTotal?: unknown;
  phase?: unknown;
};

/** 기기에 진행 중 감독 세이브가 있으면 이어 하기 카드 값, 없거나 읽을 수 없으면 null. */
export function managerResume(): ManagerResume | null {
  const s = loadKey<Saved>(MANAGER_RESUME_KEY);
  if (!s || typeof s !== 'object' || typeof s.id !== 'string') return null;
  const total = typeof s.seasonsTotal === 'number' && s.seasonsTotal > 0 ? s.seasonsTotal : 0;
  const season = typeof s.season === 'number' ? s.season : 0;
  if (!total) return null;
  return {
    name: typeof s.name === 'string' && s.name ? s.name : null,
    club: s.club && typeof s.club.name === 'string' ? s.club.name : null,
    n: Math.min(season + 1, total),
    total,
    done: s.phase === 'done',
  };
}
