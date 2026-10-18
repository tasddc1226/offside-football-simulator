import { describe, expect, it } from 'vitest';
import type { ManagerCardRules } from '@offside/contracts/manager-rules';
import type { TeamSynergy } from '@offside/contracts/owner-team';
import { coachBreakdown, coachLineBonus, coachLineTag } from './managerCard.js';

// T-11-323 팀 화면 줄 힘에 보이는 감독 보정은 경기 계산(team/sim.ts withCoach)과 같아야 한다.

const card: ManagerCardRules = {
  mastery: { '4-3-3': 'S', '4-4-2': 'C', '3-5-2': 'C' } as ManagerCardRules['mastery'],
  style: 'attack',
  specials: ['wing'],
};
const active = (id: string, kind: TeamSynergy['active'][number]['kind']) => ({
  id,
  name: id,
  desc: '',
  members: [],
  effect: {},
  kind,
});
const synergy = (ids: [string, TeamSynergy['active'][number]['kind']][]): TeamSynergy => ({
  active: ids.map(([id, kind]) => active(id, kind)),
  foot: [],
  lines: { atk: 0, mid: 0, def: 0, gk: 0 },
});

describe('coachLineBonus', () => {
  it('감독 칸이 비면 0이다', () => {
    expect(coachLineBonus(null, '4-3-3', null, 1)).toEqual({ atk: 0, mid: 0, def: 0, gk: 0 });
  });

  it('숙련 · 성향을 더한다(시너지 없으면 특기 없음)', () => {
    // S +1.0, 공격 성향 공격 +1 · 수비 −0.6
    expect(coachLineBonus(card, '4-3-3', synergy([]), 1)).toEqual({
      atk: 2,
      mid: 1,
      def: 0.4,
      gk: 0,
    });
  });

  it('짝 시너지가 켜지면 특기를 더하고, 배지 시너지는 세지 않는다', () => {
    expect(coachLineBonus(card, '4-3-3', synergy([['cross', 'duo']]), 1).atk).toBe(3);
    expect(coachLineBonus(card, '4-3-3', synergy([['cross', 'badge']]), 1).atk).toBe(2);
  });

  it('시너지 반영 전 시즌이면 특기를 빼고 본다', () => {
    expect(coachLineBonus(card, '4-3-3', synergy([['cross', 'duo']]), 0).atk).toBe(2);
  });
});

describe('coachLineTag', () => {
  it('부호를 붙이고 0에 가까우면 비운다', () => {
    expect(coachLineTag(1)).toBe('+1.0');
    expect(coachLineTag(-0.6)).toBe('−0.6');
    expect(coachLineTag(0.01)).toBeNull();
  });
});

describe('coachBreakdown (T-11-382)', () => {
  const both: ManagerCardRules = { ...card, specials: ['wing', 'counter'] };

  it('감독 칸이 비면 null', () => {
    expect(coachBreakdown(null, '4-3-3', null, 1)).toBeNull();
  });

  it('숙련 · 성향 · 켜진 특기를 갈래별로 풀고, 합이 +3을 넘으면 잘린 걸 알린다(디시 290 사례)', () => {
    const b = coachBreakdown(
      both,
      '4-3-3',
      synergy([
        ['cross', 'duo'],
        ['counter', 'duo'],
      ]),
      1,
    )!;
    const atk = b.rows.find((r) => r.line === 'atk')!;
    expect(atk).toEqual({
      line: 'atk',
      label: '공격',
      total: '+3.0',
      parts: '숙련 S +1.0 · 공격 성향 +1.0 · 측면 공략 +1.0 · 역습 전개 +1.0',
      capped: '합은 +4.0이지만 줄마다 최대 +3.0까지만 더해요.',
    });
    // 줄 칸 태그와 같은 값이다.
    expect(
      coachLineBonus(
        both,
        '4-3-3',
        synergy([
          ['cross', 'duo'],
          ['counter', 'duo'],
        ]),
        1,
      ).atk,
    ).toBe(3);
    expect(b.rows.find((r) => r.line === 'def')).toMatchObject({
      total: '+0.4',
      parts: '숙련 S +1.0 · 공격 성향 −0.6',
      capped: null,
    });
    expect(b.off).toEqual([]);
  });

  it('짝 시너지가 여럿 켜져도 특기는 한 번, 꺼진 특기는 따로 알린다', () => {
    const b = coachBreakdown(
      both,
      '4-3-3',
      synergy([
        ['cross', 'duo'],
        ['overlap', 'duo'],
      ]),
      1,
    )!;
    expect(b.rows.find((r) => r.line === 'atk')).toMatchObject({ total: '+3.0', capped: null });
    expect(b.off).toEqual(['역습 전개']);
  });
});
