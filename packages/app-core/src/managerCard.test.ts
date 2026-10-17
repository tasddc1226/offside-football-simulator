import { describe, expect, it } from 'vitest';
import type { ManagerCardRules } from '@offside/contracts/manager-rules';
import type { TeamSynergy } from '@offside/contracts/owner-team';
import { coachLineBonus, coachLineTag } from './managerCard.js';

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
