import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { divisionRules } from '@offside/contracts/team-division';
import { resolveBalance } from '@offside/contracts/balance';
import { divisionEmblem } from './divisionEmblem.js';
import {
  divisionHead,
  divisionName,
  divisionShiftView,
  markDivisionSeen,
  takeDivisionChange,
} from './teamDivision.js';

const rules = divisionRules(resolveBalance());

describe('T-11-375 디비전 화면 규칙', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('팀 머리: 다음 디비전까지 남은 점수 · 막대 · 강등 보호 · 마스터', () => {
    expect(divisionHead({ rating: 1025, division: 2 }, rules)).toMatchObject({
      name: '세미프로 I',
      pct: 50,
      guard: false,
      line: '프로 II까지 25점',
    });
    expect(divisionHead({ rating: 1035, division: 3 }, rules)).toMatchObject({
      guard: true,
      pct: 0,
    });
    expect(divisionHead({ rating: 1400, division: 7 }, rules)).toMatchObject({
      name: '마스터',
      pct: 100,
    });
    // 디비전을 모르는 옛 응답은 그리지 않는다.
    expect(divisionHead({ rating: 1000 }, rules)).toBeNull();
    expect(divisionHead(null, rules)).toBeNull();
  });

  it('결과 창 승격 · 강등은 바뀌었을 때만', () => {
    expect(divisionShiftView({ from: 2, to: 3 })).toMatchObject({ up: true, division: 3 });
    expect(divisionShiftView({ from: 3, to: 2 })).toMatchObject({ up: false, division: 2 });
    expect(divisionShiftView({ from: 3, to: 3 })).toBeNull();
    expect(divisionShiftView(undefined)).toBeNull();
  });

  it('받은 경기로 바뀐 디비전은 같은 시즌에 한 번만 알린다', () => {
    // 처음 보는 시즌은 알리지 않고 기억만 한다.
    expect(takeDivisionChange(1, 3)).toBeNull();
    expect(takeDivisionChange(1, 3)).toBeNull();
    expect(takeDivisionChange(1, 2)).toMatchObject({ from: 3, to: 2 });
    expect(takeDivisionChange(1, 2)).toBeNull();
    // 내가 건 경기로 바뀐 건 결과 창에서 봤으니 다시 알리지 않는다.
    markDivisionSeen(1, 4);
    expect(takeDivisionChange(1, 4)).toBeNull();
    // 새 시즌은 알리지 않는다.
    expect(takeDivisionChange(2, 0)).toBeNull();
  });

  it('엠블럼: 아마추어 빈 방패 · II 갈매기표 하나 · I 둘 · 마스터 별', () => {
    expect(divisionEmblem(0).chevrons).toHaveLength(0);
    expect(divisionEmblem(3).chevrons).toHaveLength(1);
    expect(divisionEmblem(4).chevrons).toHaveLength(2);
    expect(divisionEmblem(7)).toMatchObject({ chevrons: [], star: expect.any(String) });
    expect(divisionName(99)).toBe('마스터');
  });
});
