import { describe, expect, it } from 'vitest';
import { cardFootNote, iGa, withEulReul, withRo } from './format.js';

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

describe('cardFootNote (T-11-080)', () => {
  it('능력치 안내가 먼저, 그다음 기준가, 둘 다 없으면 null', () => {
    expect(cardFootNote({ attrs: null, cardValue: 543_000 })).toBe('능력치 기록 없음');
    expect(cardFootNote({ attrs: {}, attrsEstimated: true, cardValue: 543_000 })).toBe(
      '추정 능력치',
    );
    expect(cardFootNote({ attrs: {}, cardValue: 543_000 })).toBe('기준가 54억 3천만');
    expect(cardFootNote({ attrs: {}, cardValue: null })).toBeNull();
  });
});
