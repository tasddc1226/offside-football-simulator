import { describe, expect, it } from 'vitest';
import { canonicalize, utf8Encode, type JsonValue } from './canonical.js';

describe('canonicalize', () => {
  it('키 순서가 달라도 같은 문자열을 만든다', () => {
    const a: JsonValue = { b: 1, a: 2 };
    const b: JsonValue = { a: 2, b: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(a)).toBe('{"a":2,"b":1}');
  });

  it('키를 코드포인트 순으로 정렬한다', () => {
    const value: JsonValue = { 가: 1, A: 2, z: 3, 나: 4 };
    expect(canonicalize(value)).toBe('{"A":2,"z":3,"가":1,"나":4}');
  });

  it('비정수 숫자는 throw한다', () => {
    expect(() => canonicalize(1.5)).toThrow(RangeError);
    expect(() => canonicalize(Number.NaN)).toThrow(RangeError);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => canonicalize(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => canonicalize(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('안전 정수는 그대로 통과한다', () => {
    expect(canonicalize(0)).toBe('0');
    expect(canonicalize(-42)).toBe('-42');
    expect(canonicalize(Number.MAX_SAFE_INTEGER)).toBe(String(Number.MAX_SAFE_INTEGER));
  });

  it('undefined 속성을 제거한다', () => {
    const value = { a: 1, b: undefined } as unknown as JsonValue;
    expect(canonicalize(value)).toBe('{"a":1}');
  });

  it('중첩 배열의 순서를 유지한다', () => {
    const value: JsonValue = { list: [3, 1, [2, { z: 1, a: 2 }]] };
    expect(canonicalize(value)).toBe('{"list":[3,1,[2,{"a":2,"z":1}]]}');
  });

  it('문자열을 JSON 이스케이프한다', () => {
    expect(canonicalize('a"b\\c\n')).toBe('"a\\"b\\\\c\\n"');
  });

  it('null과 boolean을 그대로 직렬화한다', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(false)).toBe('false');
  });
});

describe('utf8Encode', () => {
  it('ASCII 문자열을 바이트 그대로 인코딩한다', () => {
    expect(Array.from(utf8Encode('abc'))).toEqual([0x61, 0x62, 0x63]);
  });

  it('한글과 이모지(서로게이트 쌍)를 올바르게 인코딩한다', () => {
    expect(Array.from(utf8Encode('한글💡'))).toEqual([
      0xed, 0x95, 0x9c, 0xea, 0xb8, 0x80, 0xf0, 0x9f, 0x92, 0xa1,
    ]);
  });

  it('빈 문자열은 빈 바이트를 만든다', () => {
    expect(utf8Encode('').length).toBe(0);
  });
});
