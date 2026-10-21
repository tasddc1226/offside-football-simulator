import { describe, expect, it } from 'vitest';
import { cupLineupVerdict } from './cup.js';

// T-11-436 서버 저장 검사와 편성 화면 줄이 같이 쓰는 판정.
const DRAW = '2026-11-06T03:00:00.000Z';
const before = '2026-11-05T00:00:00.000Z';
const after = '2026-11-07T00:00:00.000Z';
const junior = { division: 'junior' as const, ovrMax: 78, minFilled: 8, drawAt: DRAW };

describe('cupLineupVerdict', () => {
  it('상한 이하 · 최소 인원 이상이면 아무것도 막지 않는다', () => {
    expect(cupLineupVerdict(junior, { ovr: 78, filled: 8 }, after)).toEqual({
      overCap: false,
      capBlocks: false,
      short: false,
    });
  });
  it('상한을 넘으면 추첨 전에는 경고만, 추첨 뒤(추첨 시각 포함)에는 막는다', () => {
    expect(cupLineupVerdict(junior, { ovr: 79, filled: 8 }, before)).toMatchObject({
      overCap: true,
      capBlocks: false,
    });
    expect(cupLineupVerdict(junior, { ovr: 79, filled: 8 }, DRAW).capBlocks).toBe(true);
    expect(cupLineupVerdict(junior, { ovr: 79, filled: 8 }, after).capBlocks).toBe(true);
  });
  it('최소 인원보다 적으면 short', () => {
    expect(cupLineupVerdict(junior, { ovr: 70, filled: 7 }, before).short).toBe(true);
  });
  it('마스터 · 통합 대회는 상한이 없다', () => {
    const master = { ...junior, division: 'master' as const, ovrMax: null };
    expect(cupLineupVerdict(master, { ovr: 99, filled: 8 }, after).overCap).toBe(false);
    const unified = { minFilled: 8, drawAt: DRAW };
    expect(cupLineupVerdict(unified, { ovr: 99, filled: 8 }, after).overCap).toBe(false);
  });
});
