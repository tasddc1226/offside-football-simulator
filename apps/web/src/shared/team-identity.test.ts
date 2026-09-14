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

  // 룰셋 1.5.0 승격 뒤 activeRuleset.teams는 K3 필러 4개(생성 이름, 오퍼 풀용)도 포함하는데,
  // 이 팀들은 의도적으로 배지 색이 없다(packages/ui/scripts/check-contrast.mjs BADGE_TEAM_IDS
  // 참고 — "1.5.0(K리그식 27개)"만 검사하고 K3 필러는 빠져 있다). 나머지(YOUTH B팀·K1·K2)는
  // 전부 실제 배지 색이 있어야 한다.
  it('활성 룰셋의 구단은 K3 필러를 빼고 전부 폴백 없이 매핑되고, K3 필러는 중립 폴백이다', () => {
    for (const team of activeRuleset.teams) {
      const colorVar = getTeamIdentity(team.id).colorVar;
      if (team.leagueTier === 3) {
        expect(colorVar).toBe('var(--os-neutral)');
      } else {
        expect(colorVar).not.toBe('var(--os-neutral)');
      }
    }
  });
});
