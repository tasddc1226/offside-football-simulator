// 부수 효과 없는 모듈 — 워커(공유 미리보기)도 게임 난수 상태를 만들지 않고 쓴다. rng.ts가 다시 내보낸다.
/** 문자열을 32비트 정수로 접는 FNV-1a 해시. 암호학적 용도 아님 — RNG를 소비하지 않는 결정적 선택용. */
export function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
