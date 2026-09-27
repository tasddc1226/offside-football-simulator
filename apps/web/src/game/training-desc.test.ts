import { describe, expect, it } from 'vitest';
import { newGame, applyTraining, trainingCard, trainingHelp, TRAININGS } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-10-074: 훈련 카드의 숫자가 실제 효과와 같은지.
const fw = (): GameState => {
  setActiveRng(createRng(5));
  const s = newGame(
    { name: '테스트', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    3,
  );
  s.cond = 50;
  s.morale = 50;
  s.money = 1_000_000;
  return s;
};
const tr = (id: string) => TRAININGS.find((t) => t.id === id)!;
/** 설명에서 `이름 +N`·`이름 −N`(또는 -N)을 읽는다. */
const num = (desc: string, name: string) => {
  const m = desc.match(new RegExp(`${name} ([+−-])(\\d+)`));
  return m ? (m[1] === '+' ? 1 : -1) * Number(m[2]) : undefined;
};

describe('훈련 설명 (T-10-074)', () => {
  it.each(['sho', 'phy', 'rest', 'coach', 'media'])('%s: 카드의 컨디션 변화가 실제와 같다', (id) => {
    const s = fw();
    const d = trainingCard(s, tr(id)).effect.join(' · ');
    s.training = id;
    applyTraining(s);
    expect(s.cond - 50).toBe(num(d, '컨디션'));
  });

  it('휴식은 사기, 미디어는 인기 범위를 보여 준다', () => {
    const s = fw();
    expect(num(trainingCard(s, tr('rest')).effect.join(' · '), '사기')).toBe(4);
    expect(trainingCard(s, tr('media')).effect).toContain('인기 +5~9');
  });

  it('능력치 훈련은 오르는 능력치·주력 여부·OVR 비중을 설명한다', () => {
    const s = fw();
    expect(trainingCard(s, tr('phy')).effect[0]).toBe('피지컬·스피드 ▲');
    expect(trainingCard(s, tr('coach')).tag).toMatch(/^비용 /);
    const help = trainingHelp(s, tr('sho'));
    expect(help).toMatch(/능력치가 크게 오르고/);
    expect(help).toMatch(/주력 능력치(라|가 아니라)/);
    expect(help).toMatch(/OVR에서 슈팅 비중은 \d+%/);
    // 숨은 잠재력 값은 드러내지 않는다.
    expect(help).not.toMatch(/잠재력 \d/);
  });
});
