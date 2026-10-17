import { describe, expect, it } from 'vitest';
import {
  newGame,
  applyTraining,
  trainingCard,
  trainingHelp,
  trainingOvrNote,
  trainingGrowthNotes,
  growthSlowNote,
  focusOf,
  TRAININGS,
} from './engine.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { ovr } from './attributes.js';
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
  it('OVR 안내는 능력치 선택에만 나타나고 저장 상태를 바꾸지 않는다', () => {
    const s = fw();
    const before = JSON.stringify(s);
    expect(trainingOvrNote(s, tr('sho'))).toMatch(/OVR에서 슈팅 비중은 \d+%/);
    for (const id of ['rest', 'coach', 'media']) expect(trainingOvrNote(s, tr(id))).toBe('');
    // T-11-219 성장 배율은 버튼이 아니라 설명 칸에: 주력이면 초록, 아니면 주황, 치우침 규칙은 흐리게.
    const focus = focusOf(s)[0]!;
    const off = TRAININGS.find(
      (t) => t.attr && t.attr !== 'phy' && !focusOf(s).includes(t.attr),
    )!.id;
    expect(trainingCard(s, tr(focus)).tag).toBe('');
    expect(trainingGrowthNotes(s, tr(focus)).map((n) => n.tone)).toEqual(['good', 'muted']);
    expect(trainingGrowthNotes(s, tr(off))[0]!.tone).toBe('warn');
    for (const id of ['rest', 'coach', 'media']) expect(trainingGrowthNotes(s, tr(id))).toEqual([]);
    expect(JSON.stringify(s)).toBe(before);
  });

  it.each(['sho', 'phy', 'rest', 'coach', 'media'])(
    '%s: 카드의 컨디션 변화가 실제와 같다',
    (id) => {
      const s = fw();
      const d = trainingCard(s, tr(id)).effect.join(' · ');
      s.training = id;
      applyTraining(s);
      expect(s.cond - 50).toBe(num(d, '컨디션'));
    },
  );

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

// T-11-353 능력치 카드 "성장이 느린 이유" 한 줄: 표시만이라 상태·RNG를 건드리지 않는다.
describe('growthSlowNote (T-11-353)', () => {
  const pure = (s: GameState) => {
    const before = JSON.stringify(s);
    const rng = getActiveRng().getState();
    const note = growthSlowNote(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(getActiveRng().getState()).toEqual(rng);
    return note;
  };
  /** 숨은 잠재력을 지금 OVR에 맞춰 잠재력 배율을 하한까지 내린다. */
  const capPot = (s: GameState) => {
    s.pot = ovr(s) - (s.bloom ?? 0) - (s.flags.potBonus ?? 0);
  };

  it('어린 선수가 휴식 중이면 이유가 없다', () => {
    const s = fw();
    s.training = 'rest';
    expect(pure(s)).toBe('');
  });

  it('개인 코치는 고르게 조금씩 키운다고 알린다', () => {
    const s = fw();
    s.training = 'coach';
    expect(pure(s)).toMatch(/개인 코치는 여러 능력치를/);
  });

  it('나이가 들면 나이 감소율을, 잠재력에 닿으면 잠재력 감소율을 알린다', () => {
    const old = fw();
    old.age = 33;
    old.training = 'sho';
    expect(pure(old)).toMatch(/^나이가 들어 성장이 \d+% 줄었어요/);

    const capped = fw();
    capPot(capped);
    capped.training = 'rest';
    const note = pure(capped);
    expect(note).toMatch(/잠재력에 거의 닿아 성장이 \d+% 줄었어요/);
    // 숨은 잠재력 숫자는 드러내지 않는다.
    expect(note).not.toMatch(/잠재력 \d/);
  });

  it('두 이유가 겹치면 더 크게 깎는 쪽 하나만 보여 준다', () => {
    const s = fw();
    s.age = 34; // 나이 배율 0.08 / 1.3 ≈ 0.06 < 잠재력 하한
    capPot(s);
    const note = pure(s);
    expect(note).toMatch(/^나이가 들어/);
    expect(note).not.toMatch(/잠재력/);
  });
});
