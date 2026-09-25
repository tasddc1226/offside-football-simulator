import { afterEach, describe, expect, it } from 'vitest';
import './index.js';
import { BALANCE_SPEC, resolveBalance, sanitizeBalance } from '@offside/contracts/balance';
import { BAL, adoptLatestBalance, choiceOdds, eventWeight, setLatestBalance, useCareerBalance } from './balance.js';
import { newGame, newSeason } from './engine.js';
import { createRng, setActiveRng } from './rng.js';

// T-10-016 서버 밸런스: 커리어마다 버전을 저장하고, 새 버전은 다음 시즌 시작부터 적용한다.
const game = (seed = 1) => {
  setActiveRng(createRng(seed));
  return newGame({ name: '홍길동', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, seed);
};

afterEach(() => {
  setLatestBalance(null);
  useCareerBalance(null);
});

describe('밸런스 설정 (T-10-016)', () => {
  it('서버 값은 알려진 키만 남기고 범위로 자른다', () => {
    expect(sanitizeBalance({ injuryRate: 0.9, growthScale: 1.2, bogus: 1, eventWeight: { knock: 9, 'Bad Id': 1 }, choiceBonus: { 'knock:0': -0.1, knock: 0.2 } })).toEqual({
      injuryRate: BALANCE_SPEC.injuryRate.max,
      growthScale: 1.2,
      eventWeight: { knock: 5 },
      choiceBonus: { 'knock:0': -0.1 },
    });
    expect(sanitizeBalance('nope')).toEqual({});
    expect(resolveBalance().koreaStr).toBe(BALANCE_SPEC.koreaStr.def);
  });

  it('서버 설정이 없으면 기본값(버전 0)으로 돌고, 새 커리어는 받아 둔 최신 버전으로 바로 시작한다', () => {
    expect(game().bal).toBeUndefined();
    expect(BAL.growthScale).toBe(1);
    setLatestBalance({ version: 2, values: { growthScale: 0.9 } });
    expect(game().bal).toEqual({ v: 2, values: { growthScale: 0.9 } });
    expect(BAL.growthScale).toBe(0.9);
  });

  it('새 버전은 다음 시즌 시작부터 그 커리어에 적용되고, 불러올 때는 커리어에 저장된 값을 쓴다', () => {
    const s = game();
    setLatestBalance({ version: 3, values: { growthScale: 1.3 } });
    expect(BAL.growthScale).toBe(1); // 시즌 도중에는 바뀌지 않는다.
    s.season = newSeason(s);
    expect(s.bal).toEqual({ v: 3, values: { growthScale: 1.3 } });
    expect(BAL.growthScale).toBe(1.3);

    // 버전이 없는 다른 커리어를 불러오면 기본값으로 돌아간다.
    useCareerBalance(null);
    expect(BAL.growthScale).toBe(1);
    useCareerBalance(s);
    expect(BAL.growthScale).toBe(1.3);

    // 서버가 버전 0(설정 없음)으로 돌아가면 다음 시즌부터 기본값.
    setLatestBalance({ version: 0, values: {} });
    expect(adoptLatestBalance(s)).toBe(true);
    expect(BAL.growthScale).toBe(1);
    expect(adoptLatestBalance(s)).toBe(false);
  });

  it('선택지 확률 보정과 이벤트 가중치', () => {
    const s = game();
    setLatestBalance({ version: 1, values: { choiceBonus: { 'knock:0': 0.2, 'knock:1': -0.9 }, eventWeight: { knock: 0 } } });
    adoptLatestBalance(s);
    expect(choiceOdds(0.5, 'knock', 0)).toBeCloseTo(0.7);
    expect(choiceOdds(0.3, 'knock', 1)).toBe(0.01); // -0.9는 -0.5로 잘리고, 결과는 1% 아래로 가지 않는다.
    expect(choiceOdds(undefined, 'knock', 0)).toBe(1);
    expect(choiceOdds(0.5, 'derby', 0)).toBe(0.5);
    expect(eventWeight('knock')).toBe(0);
    expect(eventWeight('derby')).toBe(1);
  });
});
