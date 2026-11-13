// 홈 리그 칸의 '내 리그' 엠블럼. 로그인한 구단주가 리그에 배치됐을 때만 그 부 · 리그를 돌려준다.
// 내 배치는 계정마다 다른 응답(서버 no-store)이라 계정 열쇠별로만 들고 있는다. 열쇠가 바뀌면(로그인 · 계정 변경 · 로그아웃)
// 이전 값을 바로 버리고, 늦게 도착한 이전 계정 응답은 무시한다. 이 모듈은 API를 부르지 않는다(불러오기는 load로 받는다).
import { isMember } from './account.js';
import type { Profile } from './api/client.js';
import type { LeagueMeResponse } from './api/league.js';

export interface LeagueSpot {
  tier: number;
  league: number;
}

/** 내 배치 응답 → 엠블럼을 그릴 부 · 리그. 배치 전 · 배치에서 빠짐 · 응답 없음이면 null. */
export function leagueSpotOf(me: Pick<LeagueMeResponse, 'placement'> | null): LeagueSpot | null {
  const p = me?.placement;
  return p && p.status !== 'dropped' && p.tier && p.league
    ? { tier: p.tier, league: p.league }
    : null;
}

type Account = Pick<Profile, 'id' | 'linked'> | 'error' | null | undefined;

/** 내 리그를 물을 계정 열쇠. 세션이 있고 로그인한 구단주로 확인된 계정만, 아니면 null(묻지도 그리지도 않는다). */
export function leagueSpotKey(account: Account, session: string | null): string | null {
  return session && account && account !== 'error' && isMember(account)
    ? `${account.id}:${session}`
    : null;
}

/** 같은 계정으로 홈에 돌아올 때 다시 묻지 않는 시간(홈 리그 칸의 공개 응답 메모와 같다). */
export const LEAGUE_SPOT_MS = 120_000;

export function createLeagueSpotStore(
  load: () => Promise<LeagueMeResponse | null>,
  now: () => number = () => Date.now(),
) {
  let key: string | null = null;
  let spot: LeagueSpot | null = null;
  /** 지금 열쇠로 받아 둔 시각. 0이면 아직 받지 않았거나 실패했다. */
  let loadedAt = 0;
  let loading = false;
  let seq = 0;
  const listeners = new Set<() => void>();

  function set(next: LeagueSpot | null) {
    if (next?.tier === spot?.tier && next?.league === spot?.league) return;
    spot = next;
    for (const fn of listeners) fn();
  }

  return {
    /** 그 열쇠의 계정에 그릴 엠블럼. 열쇠가 지금 들고 있는 계정과 다르면 null(이전 계정 것을 보여 주지 않는다). */
    get: (forKey: string | null): LeagueSpot | null =>
      forKey !== null && forKey === key ? spot : null,
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    /** 지금 계정 열쇠에 맞춘다. force면 받아 둔 값이 있어도 다시 받는다(당겨서 새로고침). 실패하면 숨긴다. */
    async sync(next: string | null, force = false): Promise<void> {
      if (next !== key) {
        key = next;
        loadedAt = 0;
        loading = false;
        seq++;
        set(null);
      }
      if (next === null) return;
      if (!force && (loading || (loadedAt && now() - loadedAt < LEAGUE_SPOT_MS))) return;
      const n = ++seq;
      loading = true;
      let me: LeagueMeResponse | null;
      try {
        me = await load();
      } catch {
        me = null;
      }
      if (n !== seq) return;
      loading = false;
      loadedAt = me ? now() : 0;
      set(leagueSpotOf(me));
    },
  };
}
