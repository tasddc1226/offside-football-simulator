import { describe, expect, it } from 'vitest';
import { fmtMoney } from './engine.js';

describe('fmtMoney', () => {
  it('만 단위와 억 단위를 천만 단위로 반올림해 표시한다', () => {
    expect(fmtMoney(1260)).toBe('1,260만');
    expect(fmtMoney(10000)).toBe('1억');
    expect(fmtMoney(135000)).toBe('13억 5,000만');
    expect(fmtMoney(22100)).toBe('2억 2,000만');
  });

  it('반올림이 1억이 되면 억으로 올린다', () => {
    expect(fmtMoney(189770)).toBe('19억');
    expect(fmtMoney(19600)).toBe('2억');
  });

  it('음수는 부호만 앞에 붙인다', () => {
    expect(fmtMoney(-15000)).toBe('-1억 5,000만');
    expect(fmtMoney(-3000)).toBe('-3,000만');
  });
});
