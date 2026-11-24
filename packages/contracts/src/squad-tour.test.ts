import { describe, expect, it } from 'vitest';
import {
  TOUR,
  TOUR_MAIN_STAGES,
  TOUR_POOL,
  tourCapKey,
  tourEligible,
  tourFee,
  tourLineupOk,
  tourRankCompare,
  tourRules,
  tourScore,
  type TourCard,
} from './squad-tour.js';

const card = (over: Partial<TourCard> = {}): TourCard => ({
  peak: 90,
  enhance: 0,
  season: 2,
  nation: null,
  type: 'a',
  mainLeague: 'pl',
  ...over,
});

/** 2026-11-30부터 n번째 월요일. */
const monday = (n: number) =>
  new Date(Date.UTC(2026, 10, 30) + n * 7 * 86400000).toISOString().slice(0, 10);

describe('원정 투어 규칙', () => {
  it('10년 치 주마다 본선 제한 종류가 겹치지 않고 무한 원정 전용 제한이 본선에 나오지 않는다', () => {
    const extra = new Set(TOUR_POOL.extra.map((r) => JSON.stringify(r)));
    for (let n = 0; n < 520; n++) {
      const week = monday(n);
      const rules = Array.from({ length: TOUR_MAIN_STAGES }, (_, i) => tourRules(week, i + 1)[0]!);
      expect(new Set(rules.map((r) => r.kind)).size, week).toBe(TOUR_MAIN_STAGES);
      expect(
        rules.some((r) => extra.has(JSON.stringify(r))),
        week,
      ).toBe(false);
      // 시즌 제한은 6~7차전에 나오지 않는다.
      expect(
        rules.slice(5).some((r) => r.kind === 'season'),
        week,
      ).toBe(false);
    }
  });

  it('같은 주 · 같은 경기는 늘 같은 제한이다', () => {
    expect(tourRules('2026-11-30', 5)).toEqual(tourRules('2026-11-30', 5));
    expect(tourRules('2026-11-30', 12)).toEqual(tourRules('2026-11-30', 12));
  });

  it('지난 시즌 제한은 이번 시즌보다 앞선 모든 시즌(프리시즌 포함)을 받는다', () => {
    const past = { kind: 'season', when: 'past' } as const;
    expect(tourEligible(past, card({ season: 0 }), 3)).toBe(true);
    expect(tourEligible(past, card({ season: 2 }), 3)).toBe(true);
    expect(tourEligible(past, card({ season: 3 }), 3)).toBe(false);
  });

  it('국적이 비어 있는 카드는 기본 국적 카드와 같은 묶음으로 센다', () => {
    const rule = { kind: 'nationCap', max: 2 } as const;
    expect(tourCapKey(rule, card())).toBe(tourCapKey(rule, card({ nation: 'KR' })));
    expect(tourLineupOk([rule], [card(), card({ nation: 'KR' }), card()], 2)).toBe(false);
    expect(tourLineupOk([rule], [card(), card({ nation: 'KR' }), card({ nation: 'BR' })], 2)).toBe(
      true,
    );
  });

  it('유형 · 리그를 모르는 카드는 인원 제한에 세지 않는다', () => {
    const cards = [card({ type: null }), card({ type: null }), card({ type: null })];
    expect(tourLineupOk([{ kind: 'typeCap', max: 2 }], cards, 2)).toBe(true);
  });

  it('순위는 점수 → 그 점수까지 쓴 도전 수 → 먼저 이른 시각 순이다', () => {
    const a = { score: 500, triesAtScore: 4, reachedAt: '2026-12-01T03:00:00.000Z' };
    const rows = [
      { ...a, score: 400, triesAtScore: 1 },
      { ...a, triesAtScore: 6 },
      { ...a, reachedAt: '2026-12-02T03:00:00.000Z' },
      a,
    ];
    expect([...rows].sort(tourRankCompare)).toEqual([rows[3], rows[2], rows[1], rows[0]]);
  });

  it('본선 대전료는 뒤로 갈수록 오르되 마지막 경기에 4분의 1 넘게 몰리지 않는다', () => {
    const total = TOUR.fee.reduce((x, y) => x + y, 0);
    expect(total).toBe(8_000_000);
    expect(tourFee(TOUR_MAIN_STAGES) / total).toBeLessThanOrEqual(0.25);
    expect(tourScore(3, 5, 1)).toBe(380);
    expect(tourScore(3, -1, 2)).toBe(300);
  });
});
