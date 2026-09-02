/**
 * 키 정렬 + 공백 없는 canonical JSON 직렬화. checksum과 선택지 중복 검사에 쓴다.
 * `@offside/domain`은 devDependency(타입 전용)라 domain의 canonicalize를 런타임에 가져올 수
 * 없으므로 CLI 전용으로 별도 구현한다.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entryValue]) => [key, sortKeysDeep(entryValue)] as const);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}
