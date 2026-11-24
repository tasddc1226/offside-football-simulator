import { describe, expect, it } from 'vitest';
import {
  TOUR,
  TOUR_LIVE,
  TOUR_MAIN_STAGES,
  TOUR_POOL,
  TOUR_TACTICS,
  tourAiTactic,
  tourCapKey,
  tourDrained,
  tourEligible,
  tourFatigue,
  tourFee,
  tourLineupOk,
  tourStarterOk,
  tourRankCompare,
  tourRules,
  tourScore,
  tourTacticEdge,
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

  it('선발은 이번 시즌 카드만 세울 수 있다(제한이 없는 경기도)', () => {
    expect(tourStarterOk(card({ season: 2 }), 2)).toBe(true);
    expect(tourStarterOk(card({ season: 1 }), 2)).toBe(false);
    expect(tourStarterOk(card({ season: 0 }), 2)).toBe(false);
    expect(tourLineupOk([], [card(), card()], 2)).toBe(true);
    expect(tourLineupOk([], [card(), card({ season: 1 })], 2)).toBe(false);
  });

  it('지난 시즌 카드만 받는 제한은 더 뽑지 않는다(선발을 세울 수 없게 된다)', () => {
    const all = [...TOUR_POOL.light, ...TOUR_POOL.mid, ...TOUR_POOL.late, ...TOUR_POOL.extra];
    expect(all.some((r) => r.kind === 'season' && r.when === 'past')).toBe(false);
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

  it('전술마다 둘에게 강하고 둘에게 약하며 상성은 서로 반대다', () => {
    for (const a of TOUR_TACTICS) {
      const edges = TOUR_TACTICS.map((b) => tourTacticEdge(a, b));
      expect(edges.filter((e) => e === 1).length, a).toBe(2);
      expect(edges.filter((e) => e === -1).length, a).toBe(2);
      for (const b of TOUR_TACTICS) expect(tourTacticEdge(a, b) + tourTacticEdge(b, a)).toBe(0);
    }
    expect(tourTacticEdge('possession', 'counter')).toBe(1);
    expect(tourTacticEdge('press', 'counter')).toBe(-1);
    expect(tourTacticEdge('wings', 'park')).toBe(1);
  });

  it('체력은 전방 압박에서 가장 빨리 빠지고, 지치기 전에는 실력이 깎이지 않는다', () => {
    expect(tourDrained(100, 'press')).toBeLessThan(tourDrained(100, 'possession'));
    expect(tourDrained(100, 'park')).toBeGreaterThan(tourDrained(100, 'possession'));
    expect(tourDrained(5, 'press')).toBe(0);
    expect(tourFatigue(100)).toBe(0);
    expect(tourFatigue(TOUR_LIVE.stamina.tiredAt)).toBe(0);
    expect(tourFatigue(50)).toBeGreaterThan(0);
  });

  it('AI 구단은 지고 있으면 전방 압박, 이기고 있으면 밀집 수비, 비기면 시작 전술이다', () => {
    expect(tourAiTactic('wings', -1)).toBe('press');
    expect(tourAiTactic('wings', 2)).toBe('park');
    expect(tourAiTactic('wings', 0)).toBe('wings');
  });
});

describe('상대 구단', () => {
  it('같은 주 · 같은 경기는 늘 같은 구단이고, 본선 7경기는 서로 다른 구단이다', async () => {
    const { TOUR_CLUBS, tourClub } = await import('./squad-tour.js');
    const clubs = Array.from({ length: 7 }, (_, i) => tourClub('2026-11-23', i + 1));
    expect(new Set(clubs).size).toBe(7);
    expect(clubs).toEqual(Array.from({ length: 7 }, (_, i) => tourClub('2026-11-23', i + 1)));
    expect(tourClub('2026-11-23', TOUR_CLUBS.length + 1)).toBe(clubs[0]);
    const other = Array.from({ length: 7 }, (_, i) => tourClub('2026-11-30', i + 1));
    expect(other).not.toEqual(clubs);
  });
});
