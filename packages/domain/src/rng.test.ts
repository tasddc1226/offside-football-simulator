import { describe, expect, it } from 'vitest';
import { nextUint32, roll100, rollInt, seedRng, type RngState } from './rng.js';

function drawSequence(seed: string, count: number): number[] {
  let state = seedRng(seed);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const drawn = nextUint32(state);
    values.push(drawn.value);
    state = drawn.state;
  }
  return values;
}

describe('seedRng', () => {
  it('같은 seed는 항상 같은 초기 상태를 만든다', () => {
    expect(seedRng('offside-fixture-01')).toEqual(seedRng('offside-fixture-01'));
  });

  it('다른 seed는 다른 초기 상태를 만든다', () => {
    expect(seedRng('offside-fixture-01')).not.toEqual(seedRng('offside-fixture-02'));
  });

  it('draws는 0에서 시작한다', () => {
    expect(seedRng('any-seed').draws).toBe(0);
  });
});

describe('nextUint32', () => {
  it('같은 seed 두 번 실행하면 같은 수열 100개를 만든다', () => {
    expect(drawSequence('offside-fixture-01', 100)).toEqual(drawSequence('offside-fixture-01', 100));
  });

  it('draws를 매 호출마다 1씩 늘린다', () => {
    let state = seedRng('draw-count');
    for (let i = 1; i <= 5; i++) {
      const drawn = nextUint32(state);
      expect(drawn.state.draws).toBe(i);
      state = drawn.state;
    }
  });

  it('입력 상태 객체를 바꾸지 않는다', () => {
    const state = seedRng('immutability');
    const snapshot: RngState = { s: [...state.s] as [number, number, number, number], draws: state.draws };
    nextUint32(state);
    expect(state).toEqual(snapshot);
  });

  it('값은 32비트 부호 없는 정수 범위 안이다', () => {
    for (const value of drawSequence('range-check', 500)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('rollInt', () => {
  it('0..max-1 범위를 벗어나지 않는다', () => {
    let state = seedRng('rollint-range');
    for (let i = 0; i < 1000; i++) {
      const rolled = rollInt(state, 6);
      expect(rolled.value).toBeGreaterThanOrEqual(0);
      expect(rolled.value).toBeLessThan(6);
      state = rolled.state;
    }
  });

  it('rollInt(_, 6) 60,000회 결과가 0..5 각각 9,000~11,000회 나온다(공정성)', () => {
    let state = seedRng('rollint-fairness');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) {
      const rolled = rollInt(state, 6);
      counts[rolled.value] = (counts[rolled.value] ?? 0) + 1;
      state = rolled.state;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(9000);
      expect(count).toBeLessThanOrEqual(11000);
    }
  });

  it('입력 상태 객체를 바꾸지 않는다', () => {
    const state = seedRng('rollint-immutability');
    const snapshot: RngState = { s: [...state.s] as [number, number, number, number], draws: state.draws };
    rollInt(state, 10);
    expect(state).toEqual(snapshot);
  });

  it('maxExclusive가 0 이하면 throw한다', () => {
    const state = seedRng('rollint-invalid');
    expect(() => rollInt(state, 0)).toThrow(RangeError);
    expect(() => rollInt(state, -1)).toThrow(RangeError);
  });
});

describe('roll100', () => {
  it('범위는 1..100이다', () => {
    let state = seedRng('roll100-range');
    for (let i = 0; i < 2000; i++) {
      const rolled = roll100(state);
      expect(rolled.value).toBeGreaterThanOrEqual(1);
      expect(rolled.value).toBeLessThanOrEqual(100);
      state = rolled.state;
    }
  });
});
