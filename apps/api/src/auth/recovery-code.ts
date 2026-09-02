/**
 * T-1-004 D-14. `OFS-XXXX-XXXX-XXXX` 복구 코드: Crockford base32에서 `I L O U 0 1`을 뺀 26자 +
 * 숫자 `2-9` 8자 = 30자 알파벳, 12자리(약 2^59). `crypto.getRandomValues` + rejection sampling으로
 * 모듈로 편향을 없앤다(30은 256의 약수가 아니므로 단순 모듈로는 편향된다).
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 12;
const GROUP_SIZE = 4;
const PREFIX = 'OFS';

if (ALPHABET.length !== 30) {
  throw new Error(`recovery code alphabet must have 30 characters, got ${ALPHABET.length}`);
}

/** 30은 256의 약수가 아니다. 256 - (256 % 30) = 240 위 값은 버리고 다시 뽑는다. */
const REJECTION_CEILING = 256 - (256 % ALPHABET.length);

export type RandomByteSource = (length: number) => Uint8Array;

const defaultRandomBytes: RandomByteSource = (length) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

/** 테스트가 결정론적 stub RNG로 경계값(가장 큰 유효 바이트 255 등)을 고정하는 데 쓴다. */
export function pickAlphabetChar(source: RandomByteSource = defaultRandomBytes): string {
  for (;;) {
    const [byte] = source(1);
    if (byte === undefined) continue;
    if (byte < REJECTION_CEILING) {
      return ALPHABET[byte % ALPHABET.length]!;
    }
  }
}

/** `OFS-XXXX-XXXX-XXXX` 형식 문자열을 만든다. 원문은 호출자가 응답 한 번에만 담고 저장하지 않는다. */
export function generateRecoveryCode(source: RandomByteSource = defaultRandomBytes): string {
  let body = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    body += pickAlphabetChar(source);
  }
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += GROUP_SIZE) {
    groups.push(body.slice(i, i + GROUP_SIZE));
  }
  return `${PREFIX}-${groups.join('-')}`;
}

/** 대문자화 → 공백·하이픈 제거 → 앞의 `OFS` 접두 제거. 해시 전 정규화(브리프). */
export function normalizeRecoveryCode(raw: string): string {
  const stripped = raw.toUpperCase().replace(/[\s-]/g, '');
  return stripped.startsWith(PREFIX) ? stripped.slice(PREFIX.length) : stripped;
}
