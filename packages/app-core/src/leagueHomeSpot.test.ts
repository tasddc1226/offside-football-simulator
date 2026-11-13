import { describe, expect, it } from 'vitest';
import type { LeagueMeResponse } from './api/league';
import {
  LEAGUE_SPOT_MS,
  createLeagueSpotStore,
  leagueSpotKey,
  leagueSpotOf,
} from './leagueHomeSpot';

type Placement = NonNullable<LeagueMeResponse['placement']>;
const me = (placement: Partial<Placement> | null): LeagueMeResponse => ({
  entry: null,
  canEnter: false,
  team: null,
  placement: placement
    ? { status: 'placed', tier: 1, league: 1, teamId: null, rank: null, ...placement }
    : null,
});

/** 응답 시점을 테스트가 정하는 불러오기. */
function deferred() {
  const calls: ((v: LeagueMeResponse | null) => void)[] = [];
  const fails: ((e: unknown) => void)[] = [];
  const load = () =>
    new Promise<LeagueMeResponse | null>((resolve, reject) => {
      calls.push(resolve);
      fails.push(reject);
    });
  return { load, calls, fails };
}

const owner = (id: string) => ({ id, linked: { google: true, toss: false, apple: false } });
const A = leagueSpotKey(owner('a'), 'tok-a')!;
const B = leagueSpotKey(owner('b'), 'tok-b')!;

describe('홈 리그 칸 내 리그 엠블럼', () => {
  it('배치된 부 · 리그만 돌려주고 배치 전 · 빠짐 · 응답 없음은 숨긴다', () => {
    expect(leagueSpotOf(me({ tier: 3, league: 2 }))).toEqual({ tier: 3, league: 2 });
    expect(leagueSpotOf(me({ status: 'forfeited', tier: 2, league: 4 }))).toEqual({
      tier: 2,
      league: 4,
    });
    expect(leagueSpotOf(me(null))).toBe(null);
    expect(leagueSpotOf(me({ status: 'dropped', tier: null, league: null }))).toBe(null);
    expect(leagueSpotOf(me({ status: 'dropped', tier: 3, league: 2 }))).toBe(null);
    expect(leagueSpotOf(null)).toBe(null);
  });

  it('로그인한 구단주로 확인된 계정만 열쇠가 있다', () => {
    expect(A).not.toBe(B);
    expect(leagueSpotKey(owner('a'), null)).toBe(null);
    expect(
      leagueSpotKey({ id: 'g', linked: { google: false, toss: false, apple: false } }, 'tok'),
    ).toBe(null);
    expect(
      leagueSpotKey({ id: 'ap', linked: { google: false, toss: false, apple: true } }, 'tok'),
    ).not.toBe(null);
    expect(leagueSpotKey(undefined, 'tok')).toBe(null);
    expect(leagueSpotKey(null, 'tok')).toBe(null);
    expect(leagueSpotKey('error', 'tok')).toBe(null);
    // 같은 계정이라도 세션이 바뀌면 다시 묻는다.
    expect(leagueSpotKey(owner('a'), 'tok-2')).not.toBe(A);
  });

  it('비로그인이면 묻지 않는다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    await store.sync(null);
    expect(d.calls).toHaveLength(0);
    expect(store.get(null)).toBe(null);
  });

  it('배치된 계정은 엠블럼을 보이고 미배정 계정은 숨긴다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    let notified = 0;
    store.subscribe(() => notified++);
    const p = store.sync(A);
    expect(store.get(A)).toBe(null);
    d.calls[0]!(me({ tier: 2, league: 3 }));
    await p;
    expect(store.get(A)).toEqual({ tier: 2, league: 3 });
    expect(notified).toBe(1);

    const q = store.sync(B);
    d.calls[1]!(me(null));
    await q;
    expect(store.get(B)).toBe(null);
  });

  it('계정이 바뀌면 응답을 기다리지 않고 이전 엠블럼을 바로 지운다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    const p = store.sync(A);
    d.calls[0]!(me({ tier: 1, league: 1 }));
    await p;
    // 열쇠가 바뀐 그 렌더(동기화 전)에도 새 계정에는 이전 엠블럼을 주지 않는다.
    expect(store.get(B)).toBe(null);
    void store.sync(B);
    expect(store.get(B)).toBe(null);
    expect(store.get(A)).toBe(null);
  });

  it('로그아웃하면 바로 지우고, 늦게 온 이전 계정 응답은 버린다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    const p = store.sync(A);
    await store.sync(null);
    d.calls[0]!(me({ tier: 1, league: 1 }));
    await p;
    expect(store.get(A)).toBe(null);
    expect(store.get(null)).toBe(null);
  });

  it('계정 변경과 응답이 엇갈려도 새 계정에 이전 계정 엠블럼이 남지 않는다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    const a = store.sync(A);
    const b = store.sync(B);
    // 새 계정 응답(미배정)이 먼저, 이전 계정 응답(배치)이 나중에 온다.
    d.calls[1]!(me(null));
    await b;
    d.calls[0]!(me({ tier: 1, league: 2 }));
    await a;
    expect(store.get(B)).toBe(null);
    expect(store.get(A)).toBe(null);
  });

  it('A → B → A로 돌아와도 처음 A 요청의 늦은 응답을 쓰지 않는다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    const first = store.sync(A);
    void store.sync(B);
    const again = store.sync(A);
    d.calls[0]!(me({ tier: 9, league: 9 }));
    await first;
    expect(store.get(A)).toBe(null);
    d.calls[2]!(me({ tier: 2, league: 1 }));
    await again;
    expect(store.get(A)).toEqual({ tier: 2, league: 1 });
  });

  it('오류면 숨기고, 보이던 엠블럼도 새로고침이 실패하면 숨긴다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    const p = store.sync(A);
    d.calls[0]!(null);
    await p;
    expect(store.get(A)).toBe(null);

    const ok = store.sync(A);
    d.calls[1]!(me({ tier: 1, league: 1 }));
    await ok;
    expect(store.get(A)).toEqual({ tier: 1, league: 1 });

    const thrown = store.sync(A, true);
    d.fails[2]!(new Error('network'));
    await thrown;
    expect(store.get(A)).toBe(null);
  });

  it('같은 계정으로 홈에 돌아오면 다시 묻지 않고, 시간이 지나거나 당기면 다시 묻는다', async () => {
    const d = deferred();
    let t = 1_000;
    const store = createLeagueSpotStore(d.load, () => t);
    const p = store.sync(A);
    // 받는 중에 또 불러도 요청은 하나다.
    void store.sync(A);
    expect(d.calls).toHaveLength(1);
    d.calls[0]!(me({ tier: 1, league: 1 }));
    await p;

    await store.sync(A);
    expect(d.calls).toHaveLength(1);

    const pulled = store.sync(A, true);
    expect(d.calls).toHaveLength(2);
    d.calls[1]!(me({ tier: 1, league: 2 }));
    await pulled;
    expect(store.get(A)).toEqual({ tier: 1, league: 2 });

    t += LEAGUE_SPOT_MS;
    void store.sync(A);
    expect(d.calls).toHaveLength(3);
  });

  it('실패는 기억하지 않아 다음에 다시 묻는다', async () => {
    const d = deferred();
    const store = createLeagueSpotStore(d.load);
    const p = store.sync(A);
    d.calls[0]!(null);
    await p;
    void store.sync(A);
    expect(d.calls).toHaveLength(2);
  });
});
