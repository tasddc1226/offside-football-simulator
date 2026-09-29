import { describe, expect, it } from 'vitest';
import { fmtValue, iGa, withEulReul, withRo } from './format.js';

describe('withRo', () => {
  it('받침에 맞춰 로/으로를 붙인다', () => {
    expect(withRo('정현우')).toBe('정현우로');
    expect(withRo('신재형')).toBe('신재형으로');
    expect(withRo('김철')).toBe('김철로');
    expect(withRo('Kane')).toBe('Kane(으)로');
  });
  it('숫자로 끝나면 한국어로 읽은 받침을 따른다(후보 3으로, v2로, v7로)', () => {
    expect(withRo('후보 3')).toBe('후보 3으로');
    expect(withRo('후보 2')).toBe('후보 2로');
    expect(withRo('v7')).toBe('v7로');
    expect(withRo('v10')).toBe('v10으로');
    expect(withEulReul('v2')).toBe('v2를');
    expect(withEulReul('v3')).toBe('v3을');
    expect(iGa('v1')).toBe('이');
  });
});

describe('fmtValue (T-10-100 몸값)', () => {
  it('조·억·천만까지만 쓴다', () => {
    expect(fmtValue(0)).toBe('-');
    expect(fmtValue(400)).toBe('1천만 미만');
    expect(fmtValue(3000)).toBe('3천만');
    expect(fmtValue(35_200)).toBe('3억 5천만');
    expect(fmtValue(11_150_000)).toBe('1,115억');
    expect(fmtValue(123_456_789)).toBe('1조 2,345억 7천만');
    expect(fmtValue(100_000_000)).toBe('1조');
  });
});
