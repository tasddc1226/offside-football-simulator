export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

/**
 * 두 문자열을 코드포인트 순으로 비교한다. `localeCompare`는 로캘에 따라 결과가 달라지므로
 * 문자열 이터레이터(코드포인트 단위로 순회, 서로게이트 쌍을 하나로 묶는다)로 직접 비교한다.
 */
export function compareCodePoints(a: string, b: string): number {
  const ai = a[Symbol.iterator]();
  const bi = b[Symbol.iterator]();
  for (;;) {
    const an = ai.next();
    const bn = bi.next();
    if (an.done && bn.done) return 0;
    if (an.done) return -1;
    if (bn.done) return 1;
    const ac = an.value.codePointAt(0) as number;
    const bc = bn.value.codePointAt(0) as number;
    if (ac !== bc) return ac < bc ? -1 : 1;
  }
}

function encodeValue(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`canonicalize: 안전한 정수만 허용한다. 받은 값: ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(encodeValue).join(',')}]`;
  }
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort(compareCodePoints);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${encodeValue(value[key] as JsonValue)}`).join(',')}}`;
}

/**
 * 객체 키를 코드포인트 순으로 정렬하고 공백 없이 직렬화한다. `undefined` 속성은 제거하고
 * 배열 순서는 그대로 유지한다. 안전 정수가 아닌 숫자(NaN·Infinity·소수 포함)는 throw한다.
 */
export function canonicalize(value: JsonValue): string {
  return encodeValue(value);
}

/**
 * `TextEncoder` 없이 UTF-8 바이트를 직접 만든다. 서로게이트 쌍(예: 이모지)을 코드포인트로
 * 합쳐 4바이트 인코딩까지 처리한다.
 */
export function utf8Encode(s: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const codePoint = s.codePointAt(i) as number;
    if (codePoint > 0xffff) {
      i++;
    }
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}
