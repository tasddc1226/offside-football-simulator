import { describe, expect, it } from 'vitest';
import { FORMATIONS, slotRating } from '@offside/contracts/owner-team';
import { TOUR_LIVE, tourMerc, type TourRule } from '@offside/contracts/squad-tour';
import type { LineupCareer } from './sim.js';
import { tourAutoSlots, tourOpponent } from './squadTour.js';
import {
  applyTourOrder,
  playTourSegment,
  startTourLive,
  tourLiveChance,
  tourLiveOver,
  tourLiveResult,
  type TourLive,
} from './squadTourLive.js';

const SEASON = 2;
const WEEK = '2026-11-30';
const STAGE = 5;
const POS = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'] as const;
const card = (i: number, over: Partial<LineupCareer> = {}): LineupCareer => ({
  id: `c${i}`,
  pos: POS[i % POS.length]!,
  dpos: null,
  peak: 90,
  roles: null,
  number: null,
  publicName: null,
  type: `t${i}`,
  foot: 'R',
  nation: i % 2 ? 'BR' : 'FR',
  raised: true,
  mainLeague: 'pl',
  mainClub: null,
  season: SEASON,
  enhance: 0,
  ...over,
});
const cards = Array.from({ length: 16 }, (_, i) => card(i));
const rules: TourRule[] = [];
const opp = tourOpponent(WEEK, STAGE);
const merc = tourMerc(STAGE);
const slotIds = tourAutoSlots('4-3-3', cards, rules, SEASON, merc);
const bench = cards.filter((c) => !slotIds.includes(c.id)).map((c) => c.id);
const start = (seed = 'm1'): TourLive =>
  startTourLive({
    seed,
    season: SEASON,
    formation: '4-3-3',
    slotIds,
    bench,
    tactic: 'possession',
    merc,
    oppTactic: 'counter',
  });
const playAll = (s: TourLive) => {
  while (!tourLiveOver(s)) s = playTourSegment(s, cards, rules, opp);
  return s;
};

describe('원정 투어 작전 경기', () => {
  it('같은 경기 id · 같은 지시면 같은 결과다', () => {
    const a = playAll(start());
    const b = playAll(start());
    expect(a).toEqual(b);
    expect(a.done).toBe(TOUR_LIVE.segments);
    expect(a.events.length).toBe(a.goalsFor + a.goalsAgainst);
    expect(tourLiveResult(a, cards, rules, opp)).toEqual(tourLiveResult(b, cards, rules, opp));
  });

  it('골은 그 구간의 분에 들어간다', () => {
    let s = start('m2');
    for (let k = 0; k < TOUR_LIVE.segments; k++) {
      const before = s.events.length;
      s = playTourSegment(s, cards, rules, opp);
      for (const e of s.events.slice(before)) {
        expect(e.minute).toBeGreaterThan(k * 30);
        expect(e.minute).toBeLessThanOrEqual((k + 1) * 30);
      }
    }
  });

  it('구간이 지나면 체력이 빠지고 교체로 들어온 자리는 다시 찬다', () => {
    const s = playTourSegment(start(), cards, rules, opp);
    expect(s.stamina.every((x) => x < 100)).toBe(true);
    const next = applyTourOrder(s, { subs: [{ slot: 10, cardId: bench[0]! }] }, cards, rules);
    if (typeof next === 'string') throw new Error(next);
    expect(next.stamina[10]).toBe(100);
    expect(next.slotIds[10]).toBe(bench[0]);
    expect(next.subsLeft).toBe(TOUR_LIVE.subs - 1);
    expect(next.bench).not.toContain(bench[0]);
  });

  it('작전 타임이 아닐 때 · 교체 횟수 초과 · 명단에 없는 카드 · 제한 위반은 받지 않는다', () => {
    expect(applyTourOrder(start(), { tactic: 'press' }, cards, rules)).toBe('over');
    const s = playTourSegment(start(), cards, rules, opp);
    expect(applyTourOrder(playAll(start()), { tactic: 'press' }, cards, rules)).toBe('over');
    expect(applyTourOrder(s, { subs: [{ slot: 0, cardId: slotIds[1]! }] }, cards, rules)).toBe(
      'bench',
    );
    expect(applyTourOrder(s, { subs: [{ slot: 99, cardId: bench[0]! }] }, cards, rules)).toBe(
      'slot',
    );
    const four = bench.slice(0, 4).map((cardId, slot) => ({ slot, cardId }));
    expect(applyTourOrder(s, { subs: four }, cards, rules)).toBe('subs');
    // 같은 국적 6명 제한: 선발에 프랑스 선수가 이미 가득이면 프랑스 선수를 더 넣을 수 없다.
    const byId = new Map(cards.map((c) => [c.id, c]));
    const count = (n: string) => slotIds.filter((id) => byId.get(id!)?.nation === n).length;
    const full = count('FR') >= count('BR') ? 'FR' : 'BR';
    const cap: TourRule[] = [{ kind: 'nationCap', max: count(full) }];
    const out = slotIds.findIndex((id) => byId.get(id!)?.nation !== full);
    const inId = bench.find((id) => byId.get(id)?.nation === full)!;
    expect(applyTourOrder(s, { subs: [{ slot: out, cardId: inId }] }, cards, cap)).toBe('rule');
  });

  it('상성에서 앞선 전술이 이길 가망이 더 높다', () => {
    const s = start();
    // 상대는 역습: 점유가 앞서고 전방 압박이 밀린다.
    expect(tourLiveChance(s, cards, rules, opp, 'possession')).toBeGreaterThan(
      tourLiveChance(s, cards, rules, opp, 'press'),
    );
    const strong = cards.map((c) => ({ ...c, peak: 99 }));
    expect(tourLiveChance(s, strong, rules, opp)).toBeGreaterThan(
      tourLiveChance(s, cards, rules, opp),
    );
    expect(slotRating(FORMATIONS['4-3-3'][0]!, cards[0]!)).toBeGreaterThan(0);
  });
});
