import { describe, expect, it } from 'vitest';
import { newGame } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import { detectCareerHighs, nextMilestones } from './records.js';
import type { CareerRecord } from './types.js';

function makeRec(over: Partial<CareerRecord>): CareerRecord {
  return {
    year: 2026, age: 18, club: 'test', league: 'K리그1', apps: 0, goals: 0, assists: 0, cs: 0,
    rating: 0, rank: 1, ovr: 60, honors: [], pro: true, ...over,
  };
}

describe('detectCareerHighs', () => {
  it('첫 시즌은 비교 대상이 없으니 CH가 아니다', () => {
    setActiveRng(createRng(1));
    const s = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 1);
    const rec = makeRec({ goals: 10 });
    s.career.push(rec);
    expect(detectCareerHighs(s, rec)).toEqual([]);
  });

  it('이전 최고 기록을 넘으면 해당 지표가 CH로 잡힌다', () => {
    setActiveRng(createRng(1));
    const s = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 1);
    s.career.push(makeRec({ year: 2026, goals: 5, assists: 2, apps: 20, rating: 6.8 }));
    const rec2 = makeRec({ year: 2027, goals: 12, assists: 1, apps: 15, rating: 7.5 });
    s.career.push(rec2);
    const ch = detectCareerHighs(s, rec2);
    expect(ch).toContain('goals');
    expect(ch).toContain('rating');
    expect(ch).not.toContain('assists');
    expect(ch).not.toContain('apps');
  });

  it('DF/GK는 무실점(cs) 경신도 CH로 잡히지만 FW/MF는 잡히지 않는다', () => {
    setActiveRng(createRng(1));
    const df = newGame({ name: 'b', number: 4, pos: 'DF', foot: '오른발', type: 'stopper', trait: 'late' }, 1);
    df.career.push(makeRec({ year: 2026, cs: 3 }));
    const rec2 = makeRec({ year: 2027, cs: 9 });
    df.career.push(rec2);
    expect(detectCareerHighs(df, rec2)).toContain('cs');
  });
});

describe('nextMilestones', () => {
  it('통산 기록이 없으면 각 지표의 첫 목표가 남은 양 그대로 나온다', () => {
    setActiveRng(createRng(1));
    const s = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 1);
    const miles = nextMilestones(s);
    expect(miles.length).toBeGreaterThan(0);
    const goalsMile = miles.find((m) => m.key === 'goals');
    expect(goalsMile?.have).toBe(0);
    expect(goalsMile?.remaining).toBe(goalsMile?.target);
  });

  it('목표를 넘긴 지표는 다음 구간으로 넘어간다', () => {
    setActiveRng(createRng(1));
    const s = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 1);
    s.career.push(makeRec({ goals: 35 }));
    const miles = nextMilestones(s);
    const goalsMile = miles.find((m) => m.key === 'goals');
    expect(goalsMile?.target).toBe(50);
    expect(goalsMile?.have).toBe(35);
  });
});
