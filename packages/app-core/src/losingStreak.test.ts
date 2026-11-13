import { describe, expect, it } from 'vitest';
import type { TeamMatch } from './api/team.js';
import { STREAK_HINT_MIN, streakStep } from './losingStreak.js';

type Lines = { atk: number; mid: number; def: number; gk: number };
const even: Lines = { atk: 80, mid: 80, def: 80, gk: 80 };
const side = (goals: number, xg?: number, lines?: Lines) => ({
  teamId: 't',
  name: '팀',
  owner: '감독',
  formation: '4-3-3' as const,
  ovr: 80,
  goals,
  ratingChange: null,
  ...(xg === undefined ? {} : { xg, lines }),
});
const match = (
  id: string,
  gf: number,
  ga: number,
  o: { xg?: [number, number]; mine?: Lines; opp?: Lines; friendly?: boolean; away?: boolean } = {},
): TeamMatch => {
  const xg = o.xg ?? [2, 1];
  return {
    id,
    home: side(gf, xg[0], o.mine ?? even),
    away: side(ga, xg[1], o.opp ?? even),
    events: [],
    mine: o.away ? 'away' : 'home',
    createdAt: '2026-11-13T00:00:00.000Z',
    ...(o.friendly ? { friendly: true } : {}),
  };
};
const day1 = new Date('2026-11-13T03:00:00.000Z');
const day2 = new Date('2026-11-14T03:00:00.000Z');
/** 경기를 차례로 넣고 마지막 답을 돌려준다. */
function play(ms: TeamMatch[], now = day1, raw: string | null = null) {
  let hint = null as ReturnType<typeof streakStep>['hint'];
  for (const m of ms) {
    const r = streakStep(raw, m, now);
    if (r.raw !== null) raw = r.raw;
    hint = r.hint;
  }
  return { raw, hint };
}

describe('T-11-722 랭크 연패 안내', () => {
  it('세 번 연달아 져야 알리고, 기대 득점이 앞섰으면 운 이야기를 한다', () => {
    const two = play([match('a', 0, 1), match('b', 1, 2)]);
    expect(two.hint).toBeNull();
    const three = play([match('c', 0, 2, { xg: [2.2, 1.5] })], day1, two.raw);
    expect(STREAK_HINT_MIN).toBe(3);
    expect(three.hint).toMatchObject({ n: 3, kind: 'luck', line: null });
    expect(three.hint!.title).toBe('3연패 중이에요');
    expect(three.hint!.body).toContain('6.2 : 3.5');
  });

  it('기대 득점이 밀렸으면 평균으로 가장 밀린 줄을 고칠 곳으로 준다', () => {
    const weakDef: Lines = { atk: 80, mid: 80, def: 70, gk: 70 };
    const lose = (id: string) => match(id, 0, 2, { xg: [1.2, 2.4], mine: weakDef });
    const r = play([lose('a'), lose('b'), lose('c')]);
    expect(r.hint).toMatchObject({ n: 3, kind: 'weak', line: 'def' });
    expect(r.hint!.body).toBe('최근 3경기에서 수비벽이 상대 공격보다 평균 10 약했어요.');
  });

  it('이기거나 비기면 연패가 끊긴다', () => {
    const r = play([match('a', 0, 1), match('b', 0, 1), match('c', 1, 1), match('d', 0, 1)]);
    expect(r.hint).toBeNull();
    expect(JSON.parse(r.raw!).n).toBe(1);
  });

  it('친선전과 받은 경기는 기록을 건드리지 않는다', () => {
    const two = play([match('a', 0, 1), match('b', 0, 1)]);
    expect(streakStep(two.raw, match('f', 3, 0, { friendly: true }), day1)).toEqual({
      raw: null,
      hint: null,
    });
    expect(streakStep(two.raw, match('r', 3, 0, { away: true }), day1).raw).toBeNull();
    expect(play([match('c', 0, 1)], day1, two.raw).hint?.n).toBe(3);
  });

  it('하루에 한 경기에서만 보이고, 같은 경기는 다시 넣어도 같은 답이다', () => {
    const three = play([match('a', 0, 1), match('b', 0, 1), match('c', 0, 1)]);
    expect(three.hint?.n).toBe(3);
    const again = streakStep(three.raw, match('c', 0, 1), day1);
    expect(again.hint?.n).toBe(3);
    expect(JSON.parse(again.raw!).n).toBe(3);
    // 같은 날 네 번째 패배에는 다시 띄우지 않는다.
    const four = play([match('d', 0, 1)], day1, again.raw);
    expect(four.hint).toBeNull();
    // 다음 날 또 지면 다시 알린다(평균은 최근 5경기까지).
    const next = play([match('e', 0, 1), match('f', 0, 1)], day2, four.raw);
    expect(next.hint).toBeNull();
    const fresh = play([match('e', 0, 1)], day2, four.raw);
    expect(fresh.hint).toMatchObject({ n: 5 });
    expect(fresh.hint!.body).toContain('최근 5경기');
  });

  it('기대 득점이 없는 옛 경기나 깨진 기록은 처음부터 센다', () => {
    const old: TeamMatch = { ...match('x', 0, 1), home: side(0), away: side(1) };
    expect(play([match('a', 0, 1), match('b', 0, 1), old]).hint).toBeNull();
    expect(streakStep('{broken', match('a', 0, 1), day1).hint).toBeNull();
    expect(JSON.parse(streakStep('{broken', match('a', 0, 1), day1).raw!).n).toBe(1);
  });
});
