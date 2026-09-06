import { loadRuleset } from '@offside/content';
import { describe, expect, it } from 'vitest';
import { resolveTeamName } from './team-names.js';

const ruleset = loadRuleset('1.0.0');

describe('resolveTeamName', () => {
  it('오버라이드가 있으면 오버라이드, 없으면 룰셋 기본 이름을 돌려준다', () => {
    expect(resolveTeamName(ruleset, 'cheongyeon-fc', { 'cheongyeon-fc': '내 팀' })).toBe('내 팀');
    expect(resolveTeamName(ruleset, 'cheongyeon-fc', {})).toBe('청연 FC');
  });

  it('룰셋에 없는 팀 id는 undefined를 돌려준다(호출부가 자기 fallback을 쓴다)', () => {
    expect(resolveTeamName(ruleset, 'unknown-team', { 'unknown-team': '내 팀' })).toBeUndefined();
  });
});
