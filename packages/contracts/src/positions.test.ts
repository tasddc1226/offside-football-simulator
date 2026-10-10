import { describe, expect, it } from 'vitest';
import {
  AWARDS_PER_SEASON,
  CONTROL_BASE,
  CONTROL_CAP,
  controlPoints,
  legendAwardCount,
  legendTerms,
  type LegendTotals,
} from './hof-rules.js';
import {
  anonName,
  DETAIL_GROUP,
  DETAIL_POSITIONS,
  DETAILS_OF,
  detailPosOpen,
} from './positions.js';

const ZERO: LegendTotals = {
  goals: 0,
  assists: 0,
  cs: 0,
  apps: 0,
  trophies: 0,
  awards: 0,
  caps: 0,
  peak: 0,
  ballon: 0,
  ballonRankPoints: 0,
  worldCups: 0,
  control: 0,
};

describe('세부 포지션 (T-10-091)', () => {
  it('세부 포지션 8종은 모두 큰 포지션 하나에 속하고, 큰 포지션 목록과 겹치지 않는다', () => {
    const listed = Object.values(DETAILS_OF).flat();
    expect([...listed].sort()).toEqual([...DETAIL_POSITIONS].sort());
    for (const [g, ds] of Object.entries(DETAILS_OF))
      for (const d of ds) expect(DETAIL_GROUP[d]).toBe(g);
  });

  it('시즌 1 개막(2026-10-06 0시 KST)부터 고를 수 있다', () => {
    expect(detailPosOpen('2026-10-05T14:59:59.999Z')).toBe(false);
    expect(detailPosOpen('2026-10-05T15:00:00.000Z')).toBe(true);
  });

  it('레전드 점수는 윙어·수비형 미드필더만 가중을 보정한다', () => {
    const t = { ...ZERO, goals: 100, assists: 100 };
    expect(legendTerms('FW', t, 'ST')).toEqual(legendTerms('FW', t));
    expect(legendTerms('FW', t, null)).toEqual(legendTerms('FW', t));
    expect(legendTerms('FW', t, 'W').assists).toBeGreaterThan(legendTerms('FW', t).assists);
    expect(legendTerms('MF', t, 'DM').goals).toBeGreaterThan(legendTerms('MF', t).goals);
  });

  it('경기 장악은 중앙·수비형 미드필더(CM·DM)만, 평점이 기준을 넘는 몫을 상한까지 센다', () => {
    const seasons = [
      { apps: 30, rating: CONTROL_BASE + 0.25 },
      { apps: 30, rating: CONTROL_BASE + 3 },
      { apps: 30, rating: CONTROL_BASE - 0.5 },
    ];
    expect(controlPoints(seasons)).toBeCloseTo(30 * 0.25 + 30 * CONTROL_CAP);
    const t = { ...ZERO, control: controlPoints(seasons) };
    for (const d of ['CM', 'DM']) expect(legendTerms('MF', t, d).control).toBeGreaterThan(0);
    // T-11-168 골·도움을 공격수만큼 쌓는 AM은 장악 몫이 없다.
    expect(legendTerms('MF', t, 'AM').control).toBe(0);
    expect(legendTerms('MF', t).control).toBe(0);
    expect(legendTerms('FW', t, 'W').control).toBe(0);
    expect(legendTerms('DF', t, 'CB').control).toBe(0);
  });

  it(`세부 포지션 선수는 개인상을 시즌당 ${AWARDS_PER_SEASON}개까지 센다`, () => {
    const awards = [2030, 2030, 2030, 2030, 2030, 2031].map((year) => ({ year }));
    expect(legendAwardCount(awards)).toBe(6);
    expect(legendAwardCount(awards, 'ST')).toBe(AWARDS_PER_SEASON + 1);
  });
});

describe('익명 선수 표기(T-11-106)', () => {
  it('lang이 없으면 한국어 그대로, en이면 영어', () => {
    expect(anonName('FW', 9)).toBe('익명의 공격수 No.9');
    expect(anonName('GK', null)).toBe('익명의 골키퍼');
    expect(anonName('FW', 9, 'en')).toBe('Anonymous forward No.9');
    expect(anonName('MF', null, 'en')).toBe('Anonymous midfielder');
  });
});
