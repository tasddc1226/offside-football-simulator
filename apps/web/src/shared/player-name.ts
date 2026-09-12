// SCR-002 선수 이름 검증(React 없음). 이슈 158(특수문자만으로 된 이름 통과)·104(NPC 이름과 충돌).
//
// 규칙(이슈 158 정책): 앞뒤 공백 제거 후 룰셋 nameMin~nameMax자(1.0.0: 2~12), 한글 또는 영문 문자
// 1자 이상 필수, 허용 문자 = 한글 음절·영문·숫자·공백·`·`·`-`·`'`, 연속 공백 금지, 제어문자 금지.
// domain의 UPDATE_PLAYER_DRAFT 검증(simulate.ts: trim 길이·제어문자)이 최종 권위이고 이 모듈은 그보다
// 좁은 제출 전 UX 규칙이다 — 여기서 통과한 이름은 domain 검증도 반드시 통과한다.
import { isReservedPlayerName } from './reserved-names.js';

export type PlayerNameRules = { nameMin: number; nameMax: number };
export type PlayerNameValidation = { ok: true; value: string } | { ok: false; message: string };

export const PLAYER_NAME_MESSAGES = {
  controlChars: '이름에 제어문자·줄바꿈을 쓸 수 없습니다.',
  length: (rules: PlayerNameRules) => `이름은 ${rules.nameMin}~${rules.nameMax}자여야 합니다.`,
  disallowedChars: "이름에는 한글·영문·숫자·공백과 ·, -, ' 만 쓸 수 있어요.",
  letterRequired: '이름에는 한글 또는 영문이 한 글자 이상 필요해요.',
  doubleSpace: '공백은 연속으로 쓸 수 없어요.',
  reserved: '게임 속 등장인물 이름과 같아요. 다른 이름을 골라 주세요.',
} as const;

// 한글은 완성형 음절(가-힣)만 글자로 센다 — 자모만 나열한 "ㅋㅋ"는 이름이 아니다.
// 아포스트로피는 iOS 스마트 문장부호가 `'`를 `’`(U+2019)로 바꾸므로 둘 다 받는다.
const ALLOWED_CHARS = /^[가-힣A-Za-z0-9 ·\-'’]*$/;
const LETTER = /[가-힣A-Za-z]/;
const DOUBLE_SPACE = /\s{2}/;

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function validatePlayerName(raw: string, rules: PlayerNameRules): PlayerNameValidation {
  if (hasControlChars(raw)) return { ok: false, message: PLAYER_NAME_MESSAGES.controlChars };
  const trimmed = raw.trim();
  if (trimmed.length < rules.nameMin || trimmed.length > rules.nameMax) {
    return { ok: false, message: PLAYER_NAME_MESSAGES.length(rules) };
  }
  if (!ALLOWED_CHARS.test(trimmed)) return { ok: false, message: PLAYER_NAME_MESSAGES.disallowedChars };
  if (!LETTER.test(trimmed)) return { ok: false, message: PLAYER_NAME_MESSAGES.letterRequired };
  if (DOUBLE_SPACE.test(trimmed)) return { ok: false, message: PLAYER_NAME_MESSAGES.doubleSpace };
  if (isReservedPlayerName(trimmed)) return { ok: false, message: PLAYER_NAME_MESSAGES.reserved };
  return { ok: true, value: trimmed };
}
