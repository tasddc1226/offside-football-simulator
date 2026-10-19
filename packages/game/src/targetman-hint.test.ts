import { describe, expect, it } from 'vitest';
import { newGame, trainingOvrNote, investTarget, TRAININGS } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import { mainRole, roleChoices } from './attributes.js';
import type { GameState } from './types.js';

// T-11-399 문의: 주력 피지컬·슈팅 타깃맨이 스트라이커로 잡히면 훈련 안내가 피지컬 5%만 보여 줬다.
const target = (): GameState => {
  setActiveRng(createRng(7));
  return newGame(
    {
      name: '테스트',
      number: 9,
      pos: 'FW',
      dpos: 'ST',
      foot: '오른발',
      focus: ['phy', 'sho'],
      trait: 'normal',
    },
    7,
  );
};
const tr = (id: string) => TRAININGS.find((t) => t.id === id)!;

describe('타깃맨 두 역할 안내 (T-11-399)', () => {
  it('스트라이커로 잡힌 타깃맨은 후보 역할이 둘이다', () => {
    const s = target();
    expect(s.type).toBe('target');
    expect(mainRole(s)).toBe('ST');
    expect(roleChoices(s)).toEqual(['ST', 'TM']);
  });

  it('피지컬 훈련 안내에 타깃맨 비중도 나온다', () => {
    const s = target();
    expect(trainingOvrNote(s, tr('phy'))).toBe(
      '지금 포지션 OVR에서 피지컬 비중은 5%예요. 타깃맨 OVR에서는 23%이고, 둘 중 높은 쪽이 OVR이 돼요.',
    );
    // 비중이 같은 능력치(패스 0%)는 한 줄만.
    expect(trainingOvrNote(s, tr('pas'))).toBe('지금 포지션 OVR에서 패스 비중은 0%예요.');
  });

  it('강점 특훈은 타깃맨 핵심인 피지컬도 고를 수 있다', () => {
    const s = target();
    s.attrs.phy = 90;
    expect(investTarget(s, 'best')).toBe('phy');
  });

  it('보통 선수는 후보 역할이 하나다', () => {
    setActiveRng(createRng(7));
    const s = newGame(
      {
        name: '테스트',
        number: 9,
        pos: 'FW',
        dpos: 'ST',
        foot: '오른발',
        focus: ['sho', 'pac'],
        trait: 'normal',
      },
      7,
    );
    expect(roleChoices(s)).toEqual(['ST']);
    expect(trainingOvrNote(s, tr('phy'))).toBe('지금 포지션 OVR에서 피지컬 비중은 5%예요.');
  });
});
