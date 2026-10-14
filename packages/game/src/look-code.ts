// 은퇴 기록 직렬화는 첫 화면에서도 쓰므로 꾸미기 가격·그림 모듈과 분리한다.
import type { LookItem, LookState } from './types.js';

// 은퇴 코드만 쓰는 첫 화면에는 가격·선택지 표를 함께 싣지 않는다.
// 저장 코드의 순서이므로 LOOK_ITEMS와 같은 순서를 유지하고 새 항목은 뒤에만 더한다.
export const LOOK_ORDER: LookItem[] = [
  'skin',
  'hair',
  'beard',
  'style',
  'expr',
  'band',
  'wrist',
  'glasses',
  'boots',
  'socks',
];

/** 서버 코드의 글자(항목마다 한 글자). */
export const LOOK_CODE: Record<LookItem, string> = {
  skin: 's',
  hair: 'h',
  beard: 'd',
  style: 'y',
  expr: 'e',
  band: 'a',
  wrist: 'w',
  glasses: 'g',
  boots: 'b',
  socks: 'k',
};

/** 고른 값만 서버용 짧은 코드로(예: `s2h5y3`). 고른 게 없으면 undefined. */
export function lookCode(look: LookState | undefined): string | undefined {
  if (!look) return undefined;
  const code = LOOK_ORDER.filter((k) => look.pick[k] !== undefined)
    .map((k) => `${LOOK_CODE[k]}${look.pick[k]}`)
    .join('');
  return code || undefined;
}
