import { describe, expect, it } from 'vitest';
import type { PlayStyle } from '@offside/contracts';
import { STYLE_COUNTERS } from '@offside/contracts/play-style';
import { EVENTS } from './events-data.js';
import './event-registry.js';
import { styleReport } from './playStyleReport.js';

const base = (o: Partial<PlayStyle> = {}): PlayStyle => ({
  from: 18,
  betOdds: 800,
  ...(Object.fromEntries(STYLE_COUNTERS.map((k) => [k, 0])) as Record<
    (typeof STYLE_COUNTERS)[number],
    number
  >),
  bets: 16,
  betWins: 8,
  longshots: 3,
  safe: 10,
  sure: 8,
  ...o,
});
const seasons = (clubs: string[], from = 18) =>
  clubs.map((club, i) => ({ age: from + i, club, league: i ? 'K리그1' : '고교 리그' }));
const pros = (n: number, club = 'A') => seasons(['고교', ...Array.from({ length: n }, () => club)]);

describe('T-10-077 플레이 성향 리포트', () => {
  it('선택 기록이 없거나 너무 적으면 그리지 않는다', () => {
    expect(styleReport(undefined, pros(3))).toBeNull();
    expect(styleReport(base({ bets: 2, safe: 2, sure: 2 }), pros(3))).toBeNull();
  });

  it('평범한 커리어는 균형 잡힌 현실주의자', () => {
    const r = styleReport(base(), seasons(['고교', 'A', 'A', 'B', 'C']))!;
    expect(r.type.key).toBe('balanced');
    expect(r.also).toEqual([]);
    expect(r).toMatchObject({ choices: 34, luck: 0, since: null });
  });

  it('한 팀에서 8시즌 넘게 뛰면 원클럽 — 병역(상무) 시즌은 세지 않는다', () => {
    const career = [...pros(9), { age: 28, club: '김천 상무', league: 'K리그1', mil: true }];
    expect(styleReport(base(), career)!.type.key).toBe('oneclub');
  });

  it('운이 기대보다 3번 이상 좋으면 강운, 승부수 비율이 높으면 곁들인다', () => {
    const r = styleReport(base({ betWins: 12, longshots: 10 }), seasons(['고교', 'A', 'B']))!;
    expect(r.luck).toBe(4);
    expect(r.type.key).toBe('lucky');
    expect(r.also.map((t) => t.key)).toEqual(['allin']);
  });

  it('가장 낮은 확률로 성공한 선택은 이벤트 제목으로, 도중부터 셌으면 그 나이', () => {
    const ev = EVENTS[0]!;
    const r = styleReport(
      base({ from: 25, best: { id: ev.id, p: 0.18 } }),
      pros(10, 'X').concat(seasons(['Y'], 29)),
    )!;
    expect(r.best).toEqual({ title: ev.title, pct: 18 });
    expect(r.since).toBe(25);
    expect(styleReport(base({ best: { id: 'gone', p: 0.1 } }), pros(3))!.best).toBeNull();
  });
});
