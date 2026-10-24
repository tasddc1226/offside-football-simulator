import { describe, expect, it } from 'vitest';
import {
  BEST11_POOL,
  best11Admits,
  best11Gate,
  best11Keep,
  best11Raw,
  rankBest11,
  type Best11Candidate,
  type Best11Season,
} from './best11-rules.js';
import type { DetailPos } from './positions.js';

const season = (o: Partial<Best11Season> = {}): Best11Season => ({
  league: '프리미어리그',
  apps: 60,
  goals: 20,
  assists: 10,
  cs: 20,
  rating: 7,
  honors: [],
  ...o,
});
const seasons = (n: number, o: Partial<Best11Season> = {}) =>
  Array.from({ length: n }, () => season(o));

let seq = 0;
const cand = (dpos: DetailPos, s: Best11Season[], owner = `p${seq}`): Best11Candidate => ({
  careerId: `c${++seq}`,
  ownerId: owner,
  dpos,
  retiredAt: `2026-10-${String(10 + (seq % 20)).padStart(2, '0')}T00:00:00.000Z`,
  raw: best11Raw(dpos, s)!,
});

describe('T-11-463 best11Raw', () => {
  it('프로 300경기 · 20경기 이상 시즌 5개가 자격이고, 아마추어 리그는 세지 않는다', () => {
    expect(best11Raw('ST', seasons(5))).not.toBeNull();
    expect(best11Raw('ST', seasons(4))).toBeNull();
    expect(best11Raw('ST', seasons(6, { apps: 49 }))).toBeNull(); // 294경기
    expect(best11Raw('ST', [...seasons(4), season({ league: '고교 리그' })])).toBeNull();
  });

  it('리그 수준 보정: 같은 평점이라도 약한 리그는 낮게 본다', () => {
    const pl = best11Raw('ST', seasons(5, { rating: 9 }))!;
    const k3 = best11Raw('ST', seasons(5, { rating: 9, league: 'K3리그' }))!;
    expect(pl.rating).toBe(9);
    expect(k3.rating).toBeCloseTo(6 + 3 * (0.5 / 6));
    expect(k3.rawRating).toBe(9);
  });

  it('시즌마다 수상은 3개까지, 자기 포지션 상은 2배', () => {
    const honors = ['발롱도르', '득점왕', '올해의 팀', '대회 MVP'];
    const st = best11Raw('ST', [season({ honors }), ...seasons(4)])!;
    const cb = best11Raw('CB', [season({ honors }), ...seasons(4)])!;
    expect(st.award).toBe(10 + 2 * 2 + 1.5);
    expect(cb.award).toBe(10 + 2 + 1.5);
    expect(st.posAwards).toBe(1);
    expect(cb.posAwards).toBe(0);
  });
});

describe('T-11-463 순위 · 한 구단주 한 자리', () => {
  it('같은 구단주는 지수가 가장 높은 자리 하나만 갖는다', () => {
    const star = cand(
      'ST',
      [season({ rating: 9, honors: ['발롱도르'] }), ...seasons(4, { rating: 9 })],
      'same',
    );
    const wing = cand('LW', seasons(5, { rating: 8.5 }), 'same');
    const other = cand('LW', seasons(5, { rating: 7 }), 'other');
    const { pick } = rankBest11([star, wing, other]);
    expect(pick.ST?.c.careerId).toBe(star.careerId);
    expect(pick.LW?.c.careerId).toBe(other.careerId);
    expect(pick.GK).toBeNull();
  });

  it('통합 풀백(FB)은 LB · RB 어느 쪽 후보도 되지만 한 자리만 차지한다', () => {
    const fb = cand('FB', seasons(5, { rating: 8 }));
    const rb = cand('RB', seasons(5, { rating: 7 }));
    const { pick } = rankBest11([fb, rb]);
    expect(new Set([pick.LB?.c.careerId, pick.RB?.c.careerId])).toEqual(
      new Set([fb.careerId, rb.careerId]),
    );
  });
});

describe('T-11-463 후보 줄이기 · 은퇴 거르기', () => {
  const pool = Array.from({ length: BEST11_POOL + 10 }, (_, i) =>
    cand('GK', seasons(5, { rating: 6.5 + i * 0.05, cs: 10 + (i % 7) })),
  );

  it('지수 상위와 정규화 기준 후보를 남기면 남은 후보의 순위 · 지수가 그대로다', () => {
    const keep = best11Keep(pool);
    const kept = pool.filter((c) => keep.has(c.careerId));
    expect(kept.length).toBeLessThan(pool.length);
    const full = rankBest11(pool).rankings.GK.slice(0, 10);
    const cut = rankBest11(kept).rankings.GK.slice(0, 10);
    expect(cut.map((s) => [s.c.careerId, s.index])).toEqual(
      full.map((s) => [s.c.careerId, s.index]),
    );
  });

  it('커트라인 아래 은퇴는 거르고, 위 은퇴 · 기준을 넘는 은퇴 · 빈 시즌은 받는다', () => {
    const gate = best11Gate(pool);
    expect(gate.GK!.floor).toBeGreaterThan(0);
    expect(best11Admits(gate, 'GK', best11Raw('GK', seasons(5, { rating: 6.1, cs: 1 }))!)).toBe(
      false,
    );
    expect(best11Admits(gate, 'GK', best11Raw('GK', seasons(5, { rating: 9.5, cs: 15 }))!)).toBe(
      true,
    );
    expect(best11Admits(gate, 'GK', best11Raw('GK', seasons(5, { rating: 6.1, cs: 40 }))!)).toBe(
      true,
    );
    expect(best11Admits(gate, 'ST', best11Raw('ST', seasons(5))!)).toBe(true);
    expect(best11Admits(null, 'GK', best11Raw('GK', seasons(5))!)).toBe(true);
  });
});
