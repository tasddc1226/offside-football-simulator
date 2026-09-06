import { activeRuleset } from '../engine/content.js';
import { describe, expect, it } from 'vitest';
import { getTeamIdentity } from './team-identity.js';

describe('getTeamIdentity', () => {
  it('알려진 팀 id는 고유한 이니셜과 팀 컬러 변수를 돌려준다', () => {
    expect(getTeamIdentity('cheongyeon-fc')).toEqual({
      initials: '청연',
      colorVar: 'var(--os-team-cheongyeon-fc)',
    });
  });

  it('룰셋에 없는 팀 id는 중립색 폴백을 돌려준다', () => {
    expect(getTeamIdentity('unknown-team')).toEqual({ initials: '?', colorVar: 'var(--os-neutral)' });
  });

  it('활성 룰셋의 12개 구단 모두 폴백 없이 매핑된다', () => {
    for (const team of activeRuleset.teams) {
      expect(getTeamIdentity(team.id).colorVar).not.toBe('var(--os-neutral)');
    }
  });
});
