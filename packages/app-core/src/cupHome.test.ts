import { describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import {
  CUP_CHAMPION_SEEN,
  CUP_HOME_AFTER_MS,
  cupBeforeDraw,
  cupChampionToShow,
  cupOnHome,
  dismissCupChampion,
} from './cupHome.js';

const final = '2026-10-20T12:00:00.000Z';
const cup = {
  rounds: [
    { round: 'g1', at: '2026-10-13T12:00:00.000Z' },
    { round: 'f', at: final },
  ],
};
const of = (phase: string) => ({ phase, cup }) as unknown as Parameters<typeof cupOnHome>[0];

describe('cupOnHome', () => {
  it('진행 중인 단계는 늘 보인다', () => {
    for (const p of ['soon', 'open', 'closed', 'group', 'knockout'])
      expect(cupOnHome(of(p))).toBe(true);
  });
  it('취소된 대회는 숨긴다', () => {
    expect(cupOnHome(of('cancelled'))).toBe(false);
  });
  it('끝난 대회는 결승 뒤 일주일까지만', () => {
    const t = Date.parse(final);
    expect(cupOnHome(of('done'), t + CUP_HOME_AFTER_MS - 1)).toBe(true);
    expect(cupOnHome(of('done'), t + CUP_HOME_AFTER_MS)).toBe(false);
  });
});

describe('cupBeforeDraw', () => {
  it('접수 전·중·마감 뒤만 추첨 전이다', () => {
    expect(['soon', 'open', 'closed'].every((p) => cupBeforeDraw(p as never))).toBe(true);
    expect(['group', 'knockout', 'done', 'cancelled'].some((p) => cupBeforeDraw(p as never))).toBe(
      false,
    );
  });
});

describe('cupChampionToShow (T-11-290 우승 팝업)', () => {
  const champion = {
    cupId: 's1-1',
    season: 1,
    edition: 1,
    teamId: 'otm_1',
    name: '한강 FC',
    owner: '김구단',
    logo: null,
    doneAt: '2026-10-16T12:05:00.000Z',
  };
  const memory = () => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
    return m;
  };
  it('서버가 우승을 주지 않으면(끝난 대회 없음·옛 응답) 보이지 않는다', () => {
    memory();
    expect(cupChampionToShow(null)).toBeNull();
    expect(cupChampionToShow({ champion: null })).toBeNull();
    expect(cupChampionToShow({} as never)).toBeNull();
  });
  it('처음 보는 대회 우승은 보여 주고, 다시 보지 않기를 누른 대회는 숨긴다', () => {
    const m = memory();
    expect(cupChampionToShow({ champion })).toEqual(champion);
    dismissCupChampion('s1-1');
    expect(m.get(CUP_CHAMPION_SEEN)).toBe('s1-1');
    expect(cupChampionToShow({ champion })).toBeNull();
    // 다음 대회 우승은 다시 보인다.
    expect(
      cupChampionToShow({ champion: { ...champion, cupId: 's1-2', edition: 2 } }),
    ).not.toBeNull();
  });
  it('저장소가 막혀 있으면 보여 준다(기억은 못 한다)', () => {
    setStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(cupChampionToShow({ champion })).toEqual(champion);
    expect(() => dismissCupChampion('s1-1')).not.toThrow();
  });
});
