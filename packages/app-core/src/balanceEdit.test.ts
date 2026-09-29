import { describe, expect, it } from 'vitest';
import { BALANCE_SPEC } from '@offside/contracts/balance';
import { diffLines, setKnobValue, setMapValue } from './balanceEdit.js';

describe('setKnobValue', () => {
  it('기본값과 같거나 비우면 값을 지운다', () => {
    const def = String(BALANCE_SPEC.growthScale.def);
    expect(setKnobValue({ growthScale: 1.2 }, 'growthScale', def)).toEqual({});
    expect(setKnobValue({ growthScale: 1.2 }, 'growthScale', '')).toEqual({});
  });
  it('범위를 벗어나면 끝값으로 맞춘다', () => {
    expect(setKnobValue({}, 'growthScale', '9')).toEqual({
      growthScale: BALANCE_SPEC.growthScale.max,
    });
  });
});

describe('setMapValue', () => {
  it('넣고 빼며, 비면 표 자체를 없앤다', () => {
    const a = setMapValue({}, 'eventWeight', 'ev-1', 2);
    expect(a).toEqual({ eventWeight: { 'ev-1': 2 } });
    expect(setMapValue(a, 'eventWeight', 'ev-1', null)).toEqual({});
  });
});

describe('diffLines', () => {
  it('적용 중인 값과 같으면 비어 있다', () => {
    expect(diffLines({ growthScale: 1.2 }, { growthScale: 1.2 })).toEqual([]);
  });
  it('다른 수치를 줄 단위로 알린다', () => {
    const lines = diffLines({}, { growthScale: 1.2 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('1 → 1.2');
  });
});
