import { describe, expect, it } from 'vitest';
import { koMatchAt } from './koSearch.js';

describe('koMatchAt (T-10-099 국적 검색)', () => {
  it('부분 글자·띄어쓰기를 무시하고 찾는다', () => {
    expect(koMatchAt('브라질', '라질')).toBeGreaterThanOrEqual(0);
    expect(koMatchAt('트리니다드 토바고', '다드토바')).toBeGreaterThanOrEqual(0);
    expect(koMatchAt('브라질', '칠레')).toBe(-1);
    expect(koMatchAt('몰디브', '브')).toBe(2);
    expect(koMatchAt('브라질', '')).toBe(0);
  });
  it('초성과 섞어 쓴 검색어도 찾는다', () => {
    expect(koMatchAt('브라질', 'ㅂㄹㅈ')).toBeGreaterThanOrEqual(0);
    expect(koMatchAt('대한민국', 'ㄷ한')).toBeGreaterThanOrEqual(0);
    expect(koMatchAt('브라질', 'ㄹㅂ')).toBe(-1);
  });
  it('타이핑 중인 마지막 글자도 맞는 것으로 본다', () => {
    expect(koMatchAt('브라질', '브')).toBeGreaterThanOrEqual(0);
    expect(koMatchAt('브라질', '블')).toBeGreaterThanOrEqual(0); // 브 + ㄹ(라)
    expect(koMatchAt('브라질', '브랒')).toBeGreaterThanOrEqual(0);
    expect(koMatchAt('블루', '브')).toBeGreaterThanOrEqual(0);
    expect(koMatchAt('브라질', '븐')).toBe(-1);
    expect(koMatchAt('브라질', '블라')).toBe(-1); // 마지막 글자만 느슨하게 본다
  });
});
