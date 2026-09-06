import { loadRuleset } from '@offside/content';
import { describe, expect, it } from 'vitest';
import { cupProgressLabel, opponentDisplayName } from './competition-labels.js';

const ruleset = loadRuleset('1.0.0');

describe('컵 표시 호환성 (#57)', () => {
  it.each([
    ['R1', '1라운드'], ['R2', '2라운드'], ['SEMI', '준결승'], ['FINAL', '결승'],
    ['WON', '우승'], ['OUT_R1', '1라운드 탈락'], ['OUT_R2', '2라운드 탈락'],
    ['OUT_SEMI', '준결승 탈락'], ['OUT_FINAL', '준우승'], [null, '—'], ['FUTURE', '—'], ['constructor', '—'],
  ])('%s → %s', (code, label) => {
    expect(cupProgressLabel(code)).toBe(label);
  });

  it.each([['R1', '1라운드'], ['R2', '2라운드'], ['SEMI', '준결승'], ['FINAL', '결승']])(
    '이름 없는 %s 상대만 번역하고 원본을 바꾸지 않는다', (round, label) => {
      for (const cup of ruleset.cups) {
        const opponent = { id: `${cup.id}-${round}`, name: `${cup.name} ${round}위 상대` };
        expect(opponentDisplayName(opponent, ruleset)).toBe(`${cup.name} ${label} 상대`);
        expect(opponent.name).toBe(`${cup.name} ${round}위 상대`);
      }
    },
  );

  it('실제 팀과 다른 상대 이름은 유지한다', () => {
    expect(opponentDisplayName({ id: 'cheongyeon-fc', name: '청연 FC' }, ruleset)).toBe('청연 FC');
    expect(opponentDisplayName({ id: 'unknown', name: 'FINAL FC' }, ruleset)).toBe('FINAL FC');
  });

  it('UX-001: 실제 구단 상대는 오버라이드된 이름을 보여준다', () => {
    expect(
      opponentDisplayName({ id: 'cheongyeon-fc', name: '청연 FC' }, ruleset, { 'cheongyeon-fc': '내 라이벌' }),
    ).toBe('내 라이벌');
  });
});
