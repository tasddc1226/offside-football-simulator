// T-11-353 능력치 카드 OVR 반영 비율 · 성장이 느린 이유 · 시즌 결산 흐름 한 줄(표시만).
import { afterEach, describe, expect, it } from 'vitest';
import { newGame } from '@offside/game/engine';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import type { CareerRecord, GameState } from '@offside/game/types';
import { attrData } from './format.js';
import { ageStage, seasonTrendLine } from './scoutHint.js';
import { setLocale } from './i18n/core.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';

const fw = (): GameState => {
  setActiveRng(createRng(7));
  return newGame(
    { name: '테스트', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    3,
  );
};

afterEach(() => setLocale('ko'));

describe('attrData OVR 반영 비율', () => {
  it('항목 비율 합은 100 안팎이고, 항목 비율은 세부 능력치 비율의 합과 맞는다', () => {
    const s = fw();
    const before = JSON.stringify(s);
    const rng = getActiveRng().getState();
    const d = attrData(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(getActiveRng().getState()).toEqual(rng);
    const total = d.groups.reduce((t, g) => t + g.ovrPct, 0);
    expect(total).toBeGreaterThanOrEqual(97);
    expect(total).toBeLessThanOrEqual(103);
    for (const g of d.groups) {
      const rows = g.rows.reduce((t, r) => t + r.ovrPct, 0);
      expect(Math.abs(rows - g.ovrPct)).toBeLessThanOrEqual(g.rows.length);
    }
  });

  it('OVR에 반영되지 않는 세부 능력치는 0이다', () => {
    const d = attrData(fw());
    const zero = d.groups.flatMap((g) => g.rows).filter((r) => r.ovrPct === 0);
    expect(zero.length).toBeGreaterThan(0);
    for (const r of zero) expect(r.bold).toBe(false);
  });

  it('성장이 느린 이유는 없으면 빈 문자열, 있으면 한 줄이다', () => {
    const s = fw();
    s.training = 'rest';
    expect(attrData(s).growthNote).toBe('');
    s.age = 33;
    expect(attrData(s).growthNote).toMatch(/나이가 들어 성장이 \d+% 줄었어요/);
  });
});

describe('seasonTrendLine (결산 코멘트 흐름·나이)', () => {
  const rec = (year: number, rating: number, apps = 30, mil = false) =>
    ({
      year,
      age: 20,
      club: 'c',
      league: 'l',
      apps,
      goals: 0,
      assists: 0,
      cs: 0,
      rating,
      rank: 5,
      ovr: 70,
      honors: [],
      pro: true,
      ...(mil ? { mil: true } : {}),
    }) as CareerRecord;
  const st = (age: number, career: CareerRecord[]) => ({ age, career });

  it('나이 구간', () => {
    expect([18, 23, 24, 29, 30, 40].map(ageStage)).toEqual([
      'young',
      'young',
      'prime',
      'prime',
      'vet',
      'vet',
    ]);
  });

  it('지난 시즌보다 좋아짐·비슷함·나빠짐과 나이를 같이 말한다', () => {
    expect(seasonTrendLine(st(21, [rec(2030, 6.8), rec(2031, 7.1)]), 2031)).toBe(
      '평점 6.80 → 7.10, 지난 시즌보다 좋아졌어요. 아직 한창 클 나이예요.',
    );
    expect(seasonTrendLine(st(26, [rec(2030, 7.0), rec(2031, 7.05)]), 2031)).toBe(
      '평점 7.00 → 7.05, 지난 시즌과 비슷해요. 전성기 나이예요.',
    );
    expect(seasonTrendLine(st(32, [rec(2030, 7.2), rec(2031, 6.8)]), 2031)).toBe(
      '평점 7.20 → 6.80, 지난 시즌보다 나빠졌어요. 이제 몸 관리가 중요한 나이예요.',
    );
  });

  it('평점이 비슷해도 출전이 크게 줄면 출전 수로 말한다', () => {
    expect(seasonTrendLine(st(27, [rec(2030, 7.0, 30), rec(2031, 7.0, 8)]), 2031)).toBe(
      '출전 30경기 → 8경기, 지난 시즌보다 덜 뛰었어요. 전성기 나이예요.',
    );
  });

  it('첫 시즌·이번 시즌 결장·없는 시즌은 null, 군 복무 시즌은 건너뛴다', () => {
    expect(seasonTrendLine(st(19, [rec(2030, 7.0)]), 2030)).toBeNull();
    expect(seasonTrendLine(st(25, [rec(2030, 7.0), rec(2031, 0, 0)]), 2031)).toBeNull();
    expect(seasonTrendLine(st(25, [rec(2030, 7.0)]), 2035)).toBeNull();
    expect(
      seasonTrendLine(st(25, [rec(2030, 6.5), rec(2031, 0, 0, true), rec(2032, 7.0)]), 2032),
    ).toMatch(/^평점 6\.50 → 7\.00/);
  });

  it('영어·일본어에 한글이 섞이지 않는다', () => {
    const s = st(21, [rec(2030, 6.8), rec(2031, 7.1)]);
    setLocale('en', en);
    expect(seasonTrendLine(s, 2031)).toMatch(/^Rating 6\.80 → 7\.10/);
    expect(seasonTrendLine(s, 2031)).not.toMatch(/[가-힣]/);
    setLocale('ja', ja);
    expect(seasonTrendLine(s, 2031)).not.toMatch(/[가-힣]/);
  });
});
